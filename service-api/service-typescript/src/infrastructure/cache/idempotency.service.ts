import { Redis } from 'ioredis';
import { ConflictError, TenantId } from '../../domain/shared/base-types.js';
import { MoneyUtils } from '../../domain/shared/money.utils.js';
import {
  incrementIdempotencyCachedSuccess,
  incrementIdempotencyConflicts,
  incrementIdempotencyReplay,
} from '../observability/metrics.js';

type IdempotencyRecord<T> =
  | {
      status: 'processing';
      tenant_id: string;
      request_hash: string;
    }
  | {
      status: 'completed';
      tenant_id: string;
      request_hash: string;
      response: T;
    };

/**
 * Serviço de Idempotência baseado em Redis.
 * Essencial para sistemas financeiros para evitar transações duplicadas em caso de retry.
 */
export class IdempotencyService {
  private redis: Redis;

  constructor() {
    this.redis = process.env.REDIS_URL
      ? new Redis(process.env.REDIS_URL, {
          tls: process.env.REDIS_URL.startsWith('rediss://') ? {} : undefined,
        })
      : new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: Number(process.env.REDIS_PORT) || 6379,
        });
  }

  /**
   * Tenta reservar uma chave de idempotência de forma atômica.
   * A mesma chave só pode ser reutilizada com o mesmo payload e tenant.
   */
  async reserve<T>(
    tenantId: TenantId,
    key: string,
    requestHash: string,
    ttlSeconds = 3600
  ): Promise<
    { status: 'reserved' } | { status: 'cached'; response: T } | { status: 'processing' }
  > {
    const redisKey = this.buildKey(tenantId, key);
    const record: IdempotencyRecord<T> = {
      status: 'processing',
      tenant_id: tenantId,
      request_hash: requestHash,
    };

    const reserved = await this.redis.set(redisKey, JSON.stringify(record), 'EX', ttlSeconds, 'NX');
    if (reserved === 'OK') return { status: 'reserved' };

    const existing = await this.read<T>(tenantId, key);
    if (!existing) return { status: 'processing' };
    incrementIdempotencyReplay();
    if (existing.request_hash !== requestHash) {
      incrementIdempotencyConflicts();
      throw new ConflictError(
        'Chave de idempotência reutilizada com payload diferente',
        'IDEMPOTENCY_KEY_REUSED'
      );
    }

    if (existing.status === 'completed') {
      incrementIdempotencyCachedSuccess();
      return { status: 'cached', response: existing.response };
    }

    incrementIdempotencyConflicts();
    return { status: 'processing' };
  }

  /**
   * Salva o resultado de uma operação vinculada a uma chave de idempotência.
   */
  async save<T>(
    tenantId: TenantId,
    key: string,
    requestHash: string,
    result: T,
    ttlSeconds = 86400
  ): Promise<void> {
    const record: IdempotencyRecord<T> = {
      status: 'completed',
      tenant_id: tenantId,
      request_hash: requestHash,
      response: result,
    };
    await this.redis.set(
      this.buildKey(tenantId, key),
      JSON.stringify(MoneyUtils.toJsonSafe(record)),
      'EX',
      ttlSeconds
    );
  }

  async release(tenantId: TenantId, key: string): Promise<void> {
    await this.redis.del(this.buildKey(tenantId, key));
  }

  private async read<T>(tenantId: TenantId, key: string): Promise<IdempotencyRecord<T> | null> {
    const cached = await this.redis.get(this.buildKey(tenantId, key));
    return cached ? (JSON.parse(cached) as IdempotencyRecord<T>) : null;
  }

  private buildKey(tenantId: TenantId, key: string): string {
    return `idempotency:${tenantId}:${key}`;
  }
}
