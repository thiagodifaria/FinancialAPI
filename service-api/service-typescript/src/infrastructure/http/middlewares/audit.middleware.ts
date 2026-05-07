import { createMiddleware } from 'hono/factory';
import { PostgresAuditRepository } from '../../audit/audit.repository.js';
import { getRequestId } from '../request-context.js';
import { logger } from '../../logging/logger.js';

const zeroUuid = '00000000-0000-0000-0000-000000000000';
const commandMethods = new Set(['POST', 'PATCH', 'DELETE']);

/**
 * Auditoria HTTP transversal para comandos.
 * O log é best-effort: falha de auditoria não derruba a operação financeira já concluída.
 */
export function auditMiddleware(auditRepo: PostgresAuditRepository) {
  return createMiddleware(async (c, next) => {
    await next();

    if (!commandMethods.has(c.req.method) || !c.req.path.startsWith('/v1/')) return;
    if (c.res.status >= 400) return;

    const tenantId = c.get('tenantId' as never) as string | undefined;
    if (!tenantId) return;

    const user = c.get('user' as never) as { id?: string } | undefined;
    const payload = await readJsonResponse(c.res);
    const resourceId = extractUuid(payload?.id) ?? extractUuid(payload?.transaction_id) ?? zeroUuid;
    const idempotencyKey = c.req.header('x-idempotency-key');
    const transactionId = extractUuid(payload?.transaction_id);
    const userAgent = c.req.header('user-agent');

    try {
      await auditRepo.write({
        tenant_id: tenantId as never,
        action: `${c.req.method} ${c.req.routePath || c.req.path}`,
        resource_type: inferResourceType(c.req.path),
        resource_id: resourceId,
        payload: sanitizePayload(payload ?? {}),
        request_id: getRequestId(c),
        ...(user?.id ? { user_id: user.id } : {}),
        ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
        ...(transactionId ? { transaction_id: transactionId } : {}),
        ...(userAgent ? { user_agent: userAgent } : {}),
        ip_address:
          c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
          c.req.header('cf-connecting-ip') ??
          'local',
      });
    } catch (error) {
      logger.error({ err: error, request_id: getRequestId(c) }, 'Falha ao escrever audit log');
    }
  });
}

async function readJsonResponse(response: Response): Promise<Record<string, unknown> | null> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return null;
  try {
    return (await response.clone().json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractUuid(value: unknown): string | undefined {
  return typeof value === 'string' && /^[0-9a-fA-F-]{36}$/.test(value) ? value : undefined;
}

function inferResourceType(path: string): string {
  const [, , segment] = path.split('/');
  return segment?.replaceAll('-', '_') ?? 'unknown';
}

function sanitizePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const clone = { ...payload };
  delete clone.key;
  delete clone.access_token;
  delete clone.refresh_token;
  delete clone.secret;
  return clone;
}
