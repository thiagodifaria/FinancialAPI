import amqp from 'amqplib';
import { createHmac } from 'node:crypto';
import sql, { SqlExecutor } from '../database/connection.js';
import { setTenantContext } from '../database/tenant-context.js';
import { logger } from '../logging/logger.js';
import { incrementDomainMetric } from '../observability/metrics.js';

type TenantRow = { id: string };
type OutboxRow = {
  id: string;
  tenant_id: string;
  exchange: string;
  routing_key: string;
  payload: Record<string, unknown>;
};
type WebhookRow = {
  id: string;
  url: string;
  signing_secret: string | null;
  events: string[];
};

let interval: NodeJS.Timeout | null = null;

/**
 * Publicador transacional de eventos.
 * Lê outbox_events e publica no RabbitMQ; eventos ficam retentáveis em caso de falha.
 */
export function startOutboxPublisher(): void {
  if (process.env.OUTBOX_PUBLISHER_ENABLED === 'false') return;
  const intervalMs = Number(process.env.OUTBOX_PUBLISH_INTERVAL_MS ?? 5000);
  interval = setInterval(() => {
    publishPendingOutboxEvents().catch((error) =>
      logger.warn({ err: error }, 'Outbox publisher aguardando broker disponível')
    );
  }, intervalMs);
}

export function stopOutboxPublisher(): void {
  if (interval) clearInterval(interval);
}

async function publishPendingOutboxEvents(): Promise<void> {
  const connectionUrl = process.env.RABBITMQ_URL ?? `amqp://${process.env.RABBITMQ_HOST ?? 'localhost'}:5672`;
  const connection = await amqp.connect(connectionUrl);
  const channel = await connection.createChannel();

  try {
    const tenants = await sql<TenantRow[]>`SELECT id FROM tenants`;
    for (const tenant of tenants) {
      await sql.begin(async (sqlTx) => {
        await setTenantContext(sqlTx, tenant.id as never);
        const events = await sqlTx<OutboxRow[]>`
          SELECT id, tenant_id, exchange, routing_key, payload
          FROM outbox_events
          WHERE status IN ('pending', 'failed')
          ORDER BY created_at ASC
          LIMIT 50
          FOR UPDATE SKIP LOCKED
        `;

        for (const event of events) {
          try {
            await channel.assertExchange(event.exchange, 'topic', { durable: true });
            channel.publish(
              event.exchange,
              event.routing_key,
              Buffer.from(JSON.stringify({ ...event.payload, tenant_id: event.tenant_id })),
              { contentType: 'application/json', persistent: true }
            );
            incrementDomainMetric('outbox', 'published');
            await createWebhookDeliveries(sqlTx, event);
            await dispatchPendingWebhookDeliveries(sqlTx, event.tenant_id);
            await sqlTx`
              UPDATE outbox_events
              SET status = 'published', published_at = NOW(), attempts = attempts + 1
              WHERE id = ${event.id}
            `;
          } catch (error) {
            incrementDomainMetric('outbox', 'failed');
            await sqlTx`
              UPDATE outbox_events
              SET status = 'failed', attempts = attempts + 1, last_error = ${(error as Error).message}
              WHERE id = ${event.id}
            `;
          }
        }
      });
    }
  } finally {
    await channel.close().catch(() => undefined);
    await connection.close().catch(() => undefined);
  }
}

async function createWebhookDeliveries(sqlTx: SqlExecutor, event: OutboxRow): Promise<void> {
  const endpoints = await sqlTx<WebhookRow[]>`
    SELECT id, url, signing_secret, events
    FROM webhook_endpoints
    WHERE tenant_id = ${event.tenant_id}
      AND status = 'active'
      AND ('*' = ANY(events) OR ${event.routing_key} = ANY(events))
  `;

  for (const endpoint of endpoints) {
    await sqlTx`
      INSERT INTO webhook_deliveries (
        id, tenant_id, webhook_endpoint_id, outbox_event_id, event_type, url, payload, status
      )
      VALUES (
        gen_random_uuid(), ${event.tenant_id}, ${endpoint.id}, ${event.id}, ${event.routing_key},
        ${endpoint.url}, ${sqlTx.json(event.payload as Parameters<typeof sql.json>[0])}, 'pending'
      )
    `;
  }
}

async function dispatchPendingWebhookDeliveries(
  sqlTx: SqlExecutor,
  tenantId: string
): Promise<void> {
  const deliveries = await sqlTx<
    {
      id: string;
      webhook_endpoint_id: string;
      event_type: string;
      url: string;
      payload: Record<string, unknown>;
      signing_secret: string | null;
      attempt_count: number;
    }[]
  >`
    SELECT d.id, d.webhook_endpoint_id, d.event_type, d.url, d.payload,
      w.signing_secret, d.attempt_count
    FROM webhook_deliveries d
    JOIN webhook_endpoints w ON w.id = d.webhook_endpoint_id AND w.tenant_id = d.tenant_id
    WHERE d.tenant_id = ${tenantId}
      AND d.status IN ('pending', 'failed')
      AND d.next_attempt_at <= NOW()
    ORDER BY d.created_at ASC
    LIMIT 50
    FOR UPDATE SKIP LOCKED
  `;

  for (const delivery of deliveries) {
    if (!delivery.signing_secret) continue;
    const body = JSON.stringify({
      id: delivery.id,
      tenant_id: tenantId,
      type: delivery.event_type,
      payload: delivery.payload,
    });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac('sha256', delivery.signing_secret)
      .update(`${timestamp}.${body}`)
      .digest('hex');

    const started = Date.now();
    try {
      const response = await fetch(delivery.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-financial-api-timestamp': timestamp,
          'x-financial-api-signature': `sha256=${signature}`,
        },
        body,
      });
      const text = (await response.text()).slice(0, 2000);
      await sqlTx`
        UPDATE webhook_deliveries
        SET status = ${response.ok ? 'delivered' : 'failed'}::webhook_delivery_status_type,
            attempt_count = attempt_count + 1,
            status_code = ${response.status},
            duration_ms = ${Date.now() - started},
            response_body = ${text},
            error = ${response.ok ? null : `HTTP ${response.status}`},
            delivered_at = ${response.ok ? new Date() : null},
            next_attempt_at = NOW() + INTERVAL '5 minutes'
        WHERE id = ${delivery.id}
      `;
      incrementDomainMetric('webhooks', response.ok ? 'delivered' : 'failed');
    } catch (error) {
      const nextAttempts = delivery.attempt_count + 1;
      await sqlTx`
        UPDATE webhook_deliveries
        SET status = ${nextAttempts >= 5 ? 'dead_letter' : 'failed'}::webhook_delivery_status_type,
            attempt_count = attempt_count + 1,
            duration_ms = ${Date.now() - started},
            error = ${(error as Error).message},
            next_attempt_at = NOW() + (${Math.min(60, 2 ** nextAttempts)} || ' minutes')::interval
        WHERE id = ${delivery.id}
      `;
      incrementDomainMetric('webhooks', nextAttempts >= 5 ? 'dead_letter' : 'failed');
      logger.warn(
        { err: error, url: delivery.url, delivery_id: delivery.id },
        'Falha ao entregar webhook externo'
      );
    }
  }
}
