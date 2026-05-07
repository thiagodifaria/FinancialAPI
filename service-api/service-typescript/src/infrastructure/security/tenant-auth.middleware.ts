import { createMiddleware } from 'hono/factory';
import sql from '../database/connection.js';
import { TenantId } from '../../domain/shared/base-types.js';
import { logger } from '../logging/logger.js';
import { getRequestId } from '../http/request-context.js';

type TenantRow = {
  id: string;
  scopes: string[] | null;
  ip_allowlist: string[] | null;
};

/**
 * Autentica o tenant por API key.
 * O header x-tenant-id fica disponível apenas para desenvolvimento local explícito.
 */
export const tenantAuthMiddleware = createMiddleware(async (c, next) => {
  const requestId = getRequestId(c);

  const apiKey = c.req.header('x-api-key');
  if (apiKey) {
    const [tenant] = await sql<TenantRow[]>`
      SELECT id, scopes, ip_allowlist FROM (
        SELECT id, ARRAY['*']::text[] AS scopes, ARRAY[]::text[] AS ip_allowlist
        FROM tenants
        WHERE api_key = crypt(${apiKey}, api_key)
        UNION ALL
        SELECT tenant_id AS id, scopes, ip_allowlist
        FROM api_keys
        WHERE status = 'active'
          AND key_hash = crypt(${apiKey}, key_hash)
      ) matched
      LIMIT 1
    `;

    if (!tenant) {
      logger.warn({ request_id: requestId }, 'API key inválida');
      return c.json({ error: 'Não autorizado', code: 'UNAUTHORIZED', request_id: requestId }, 401);
    }

    const requestIp =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
      c.req.header('cf-connecting-ip') ??
      '';
    const allowlist = tenant.ip_allowlist ?? [];
    if (allowlist.length > 0 && !allowlist.includes(requestIp)) {
      return c.json(
        { error: 'IP não autorizado', code: 'IP_NOT_ALLOWED', request_id: requestId },
        403
      );
    }

    c.set('tenantId' as never, tenant.id as TenantId as never);
    c.set('apiKeyScopes' as never, (tenant.scopes ?? []) as never);
    await sql.begin(async (sqlTx) => {
      await sqlTx`SELECT set_config('app.current_tenant_id', ${tenant.id}, true)`;
      await sqlTx`
        UPDATE api_keys
        SET last_used_at = NOW()
        WHERE tenant_id = ${tenant.id}
          AND status = 'active'
          AND key_hash = crypt(${apiKey}, key_hash)
      `;
    });
    await next();
    return;
  }

  if (process.env.ALLOW_TENANT_HEADER === 'true') {
    const tenantId = c.req.header('x-tenant-id');
    if (tenantId) {
      c.set('tenantId' as never, tenantId as TenantId as never);
      await next();
      return;
    }
  }

  return c.json(
    {
      error: 'x-api-key é obrigatório',
      code: 'MISSING_API_KEY',
      request_id: requestId,
    },
    401
  );
});

export function requireScope(scope: string) {
  return createMiddleware(async (c, next) => {
    const scopes = (c.get('apiKeyScopes' as never) as string[] | undefined) ?? [];
    if (!scopes.includes('*') && !scopes.includes(scope)) {
      return c.json(
        {
          error: 'Escopo insuficiente para a API key',
          code: 'INSUFFICIENT_SCOPE',
          request_id: getRequestId(c),
        },
        403
      );
    }
    await next();
  });
}
