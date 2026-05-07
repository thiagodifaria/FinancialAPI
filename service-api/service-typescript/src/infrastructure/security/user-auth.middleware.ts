import { createMiddleware } from 'hono/factory';
import { IAuthRepository } from '../../modules/auth/auth.entity.js';
import { getRequestId } from '../http/request-context.js';

/**
 * Autentica usuários humanos por Bearer token e injeta tenant/user no contexto.
 */
export function userAuthMiddleware(authRepo: IAuthRepository) {
  return createMiddleware(async (c, next) => {
    const authorization = c.req.header('authorization') ?? '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';

    if (!token) {
      return c.json(
        {
          error: 'Bearer token é obrigatório',
          code: 'MISSING_BEARER_TOKEN',
          request_id: getRequestId(c),
        },
        401
      );
    }

    const user = await authRepo.findUserByAccessToken(token);
    if (!user) {
      return c.json(
        {
          error: 'Sessão inválida ou expirada',
          code: 'INVALID_SESSION',
          request_id: getRequestId(c),
        },
        401
      );
    }

    c.set('tenantId' as never, user.tenant_id as never);
    c.set('user' as never, user as never);
    await next();
  });
}

export function requireRole(...roles: string[]) {
  return createMiddleware(async (c, next) => {
    const user = c.get('user' as never) as { role?: string } | undefined;
    if (!user?.role || !roles.includes(user.role)) {
      return c.json(
        {
          error: 'Permissão insuficiente',
          code: 'FORBIDDEN',
          request_id: getRequestId(c),
        },
        403
      );
    }
    await next();
  });
}
