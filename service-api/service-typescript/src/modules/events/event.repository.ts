import { randomBytes } from 'node:crypto';
import { uuidv7 } from 'uuidv7';
import sql from '../../infrastructure/database/connection.js';
import { setTenantContext } from '../../infrastructure/database/tenant-context.js';
import { EventId, TenantId, WebhookEndpointId } from '../../domain/shared/base-types.js';
import { incrementDomainMetric } from '../../infrastructure/observability/metrics.js';

export type WebhookEndpoint = {
  id: WebhookEndpointId;
  tenant_id: TenantId;
  url: string;
  events: string[];
  status: 'active' | 'disabled';
  created_at: string;
  secret?: string;
};

export type DomainEvent = {
  id: EventId;
  tenant_id: TenantId;
  type: string;
  resource_type: string;
  resource_id: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type WebhookDelivery = {
  id: string;
  webhook_endpoint_id: WebhookEndpointId;
  outbox_event_id?: string;
  event_type: string;
  url: string;
  status: 'pending' | 'delivered' | 'failed' | 'dead_letter';
  attempt_count: number;
  status_code?: number;
  duration_ms?: number;
  error?: string;
  response_body?: string;
  created_at: string;
  delivered_at?: string;
};

type WebhookRow = Omit<WebhookEndpoint, 'created_at' | 'secret'> & { created_at: Date };
type EventRow = Omit<DomainEvent, 'created_at'> & { created_at: Date };
type DeliveryRow = Omit<WebhookDelivery, 'created_at' | 'delivered_at'> & {
  created_at: Date;
  delivered_at: Date | null;
};

export class PostgresEventRepository {
  async createWebhook(
    tenantId: TenantId,
    input: { url: string; events: string[] }
  ): Promise<WebhookEndpoint> {
    const secret = `whsec_${randomBytes(32).toString('base64url')}`;
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const [row] = await sqlTx<WebhookRow[]>`
        INSERT INTO webhook_endpoints (id, tenant_id, url, secret_hash, signing_secret, events, status)
        VALUES (${uuidv7()}, ${tenantId}, ${input.url}, crypt(${secret}, gen_salt('bf')), ${secret}, ${input.events}, 'active')
        RETURNING id, tenant_id, url, events, status, created_at
      `;
      if (!row) throw new Error('Falha ao criar webhook');
      return { ...this.toWebhook(row), secret };
    });
  }

  async listWebhooks(tenantId: TenantId): Promise<WebhookEndpoint[]> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const rows = await sqlTx<WebhookRow[]>`
        SELECT id, tenant_id, url, events, status, created_at
        FROM webhook_endpoints ORDER BY created_at DESC
      `;
      return rows.map((row) => this.toWebhook(row));
    });
  }

  async rotateWebhookSecret(tenantId: TenantId, id: WebhookEndpointId): Promise<WebhookEndpoint> {
    const secret = `whsec_${randomBytes(32).toString('base64url')}`;
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const [row] = await sqlTx<WebhookRow[]>`
        UPDATE webhook_endpoints
        SET secret_hash = crypt(${secret}, gen_salt('bf')), signing_secret = ${secret}, updated_at = NOW()
        WHERE tenant_id = ${tenantId} AND id = ${id}
        RETURNING id, tenant_id, url, events, status, created_at
      `;
      if (!row) throw new Error('Webhook não encontrado');
      return { ...this.toWebhook(row), secret };
    });
  }

  async createEvent(input: Omit<DomainEvent, 'id' | 'created_at'>): Promise<DomainEvent> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, input.tenant_id);
      const [row] = await sqlTx<EventRow[]>`
        INSERT INTO events (id, tenant_id, type, resource_type, resource_id, payload)
        VALUES (
          ${uuidv7()}, ${input.tenant_id}, ${input.type}, ${input.resource_type},
          ${input.resource_id}, ${sqlTx.json(input.payload as Parameters<typeof sql.json>[0])}
        )
        RETURNING id, tenant_id, type, resource_type, resource_id, payload, created_at
      `;
      if (!row) throw new Error('Falha ao criar evento');
      incrementDomainMetric('events', input.type);
      return this.toEvent(row);
    });
  }

  async listEvents(tenantId: TenantId): Promise<DomainEvent[]> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const rows = await sqlTx<EventRow[]>`
        SELECT id, tenant_id, type, resource_type, resource_id, payload, created_at
        FROM events ORDER BY created_at DESC LIMIT 100
      `;
      return rows.map((row) => this.toEvent(row));
    });
  }

  async listDeliveries(tenantId: TenantId): Promise<WebhookDelivery[]> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const rows = await sqlTx<DeliveryRow[]>`
        SELECT id, webhook_endpoint_id, outbox_event_id, event_type, url, status,
          attempt_count, status_code, duration_ms, error, response_body, created_at, delivered_at
        FROM webhook_deliveries
        ORDER BY created_at DESC
        LIMIT 200
      `;
      return rows.map((row) => this.toDelivery(row));
    });
  }

  async retryDelivery(tenantId: TenantId, id: string): Promise<WebhookDelivery> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const [row] = await sqlTx<DeliveryRow[]>`
        UPDATE webhook_deliveries
        SET status = 'pending', next_attempt_at = NOW(), error = NULL
        WHERE id = ${id}
        RETURNING id, webhook_endpoint_id, outbox_event_id, event_type, url, status,
          attempt_count, status_code, duration_ms, error, response_body, created_at, delivered_at
      `;
      if (!row) throw new Error('Webhook delivery não encontrada');
      incrementDomainMetric('webhooks', 'manual_retry');
      return this.toDelivery(row);
    });
  }

  async createTestEvent(tenantId: TenantId): Promise<DomainEvent> {
    return await this.createEvent({
      tenant_id: tenantId,
      type: 'webhook.test',
      resource_type: 'webhook',
      resource_id: tenantId,
      payload: { test: true, generated_at: new Date().toISOString() },
    });
  }

  private toWebhook(row: WebhookRow): WebhookEndpoint {
    return { ...row, created_at: row.created_at.toISOString() };
  }

  private toEvent(row: EventRow): DomainEvent {
    return { ...row, created_at: row.created_at.toISOString() };
  }

  private toDelivery(row: DeliveryRow): WebhookDelivery {
    return {
      id: row.id,
      webhook_endpoint_id: row.webhook_endpoint_id,
      ...(row.outbox_event_id ? { outbox_event_id: row.outbox_event_id } : {}),
      event_type: row.event_type,
      url: row.url,
      status: row.status,
      attempt_count: row.attempt_count,
      ...(row.status_code ? { status_code: row.status_code } : {}),
      ...(row.duration_ms ? { duration_ms: row.duration_ms } : {}),
      ...(row.error ? { error: row.error } : {}),
      ...(row.response_body ? { response_body: row.response_body } : {}),
      created_at: row.created_at.toISOString(),
      ...(row.delivered_at ? { delivered_at: row.delivered_at.toISOString() } : {}),
    };
  }
}
