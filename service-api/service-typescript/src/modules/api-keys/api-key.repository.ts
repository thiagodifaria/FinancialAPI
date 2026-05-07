import { createHash, randomBytes } from 'node:crypto';
import { uuidv7 } from 'uuidv7';
import sql from '../../infrastructure/database/connection.js';
import { setTenantContext } from '../../infrastructure/database/tenant-context.js';
import { ApiKeyId, NotFoundError, TenantId } from '../../domain/shared/base-types.js';
import { ApiKey, CreatedApiKey, CreateApiKeyInput, IApiKeyRepository } from './api-key.entity.js';

type ApiKeyRow = {
  id: string;
  tenant_id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  ip_allowlist: string[];
  status: ApiKey['status'];
  last_used_at: Date | null;
  created_at: Date;
  revoked_at: Date | null;
};

export class PostgresApiKeyRepository implements IApiKeyRepository {
  async create(input: CreateApiKeyInput): Promise<CreatedApiKey> {
    const id = uuidv7() as ApiKeyId;
    const key = this.generateKey();
    const keyPrefix = key.slice(0, 12);

    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, input.tenant_id);
      const [row] = await sqlTx<ApiKeyRow[]>`
        INSERT INTO api_keys (id, tenant_id, name, key_hash, key_prefix, scopes, ip_allowlist, status)
        VALUES (
          ${id},
          ${input.tenant_id},
          ${input.name},
          crypt(${key}, gen_salt('bf')),
          ${keyPrefix},
          ${input.scopes},
          ${input.ip_allowlist},
          'active'
        )
        RETURNING id, tenant_id, name, key_prefix, scopes, ip_allowlist, status, last_used_at, created_at, revoked_at
      `;
      if (!row) throw new Error('Falha ao criar API key');
      return { ...this.toApiKey(row), key };
    });
  }

  async list(tenantId: TenantId): Promise<ApiKey[]> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const rows = await sqlTx<ApiKeyRow[]>`
        SELECT id, tenant_id, name, key_prefix, scopes, ip_allowlist, status, last_used_at, created_at, revoked_at
        FROM api_keys
        WHERE tenant_id = ${tenantId}
        ORDER BY created_at DESC
      `;
      return rows.map((row) => this.toApiKey(row));
    });
  }

  async revoke(tenantId: TenantId, id: ApiKeyId): Promise<ApiKey> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const [row] = await sqlTx<ApiKeyRow[]>`
        UPDATE api_keys
        SET status = 'revoked', revoked_at = NOW()
        WHERE tenant_id = ${tenantId} AND id = ${id}
        RETURNING id, tenant_id, name, key_prefix, scopes, ip_allowlist, status, last_used_at, created_at, revoked_at
      `;
      if (!row) throw new NotFoundError('API key');
      return this.toApiKey(row);
    });
  }

  async rotate(tenantId: TenantId, id: ApiKeyId): Promise<CreatedApiKey> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const [current] = await sqlTx<ApiKeyRow[]>`
        SELECT id, tenant_id, name, key_prefix, scopes, ip_allowlist, status, last_used_at, created_at, revoked_at
        FROM api_keys
        WHERE tenant_id = ${tenantId} AND id = ${id}
      `;
      if (!current) throw new NotFoundError('API key');

      await sqlTx`
        UPDATE api_keys
        SET status = 'revoked', revoked_at = NOW()
        WHERE tenant_id = ${tenantId} AND id = ${id}
      `;

      const key = this.generateKey();
      const [row] = await sqlTx<ApiKeyRow[]>`
        INSERT INTO api_keys (id, tenant_id, name, key_hash, key_prefix, scopes, ip_allowlist, status)
        VALUES (
          ${uuidv7()},
          ${tenantId},
          ${current.name},
          crypt(${key}, gen_salt('bf')),
          ${key.slice(0, 12)},
          ${current.scopes},
          ${current.ip_allowlist},
          'active'
        )
        RETURNING id, tenant_id, name, key_prefix, scopes, ip_allowlist, status, last_used_at, created_at, revoked_at
      `;
      if (!row) throw new Error('Falha ao rotacionar API key');
      return { ...this.toApiKey(row), key };
    });
  }

  private generateKey(): string {
    return `fce_${randomBytes(32).toString('base64url')}`;
  }

  private toApiKey(row: ApiKeyRow): ApiKey {
    return {
      id: row.id as ApiKeyId,
      tenant_id: row.tenant_id as TenantId,
      name: row.name,
      key_prefix: row.key_prefix,
      scopes: row.scopes,
      ip_allowlist: row.ip_allowlist,
      status: row.status,
      ...(row.last_used_at ? { last_used_at: row.last_used_at.toISOString() } : {}),
      created_at: row.created_at.toISOString(),
      ...(row.revoked_at ? { revoked_at: row.revoked_at.toISOString() } : {}),
    };
  }
}

export function hashApiKeyForLookup(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}
