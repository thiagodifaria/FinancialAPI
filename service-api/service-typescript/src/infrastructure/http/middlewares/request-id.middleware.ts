import { createMiddleware } from 'hono/factory';
import { randomUUID } from 'node:crypto';

/**
 * Garante request_id estável em logs, erros e respostas.
 */
export const requestIdMiddleware = createMiddleware(async (c, next) => {
  const requestId = c.req.header('x-request-id') || randomUUID();
  c.set('requestId' as never, requestId as never);
  c.header('x-request-id', requestId);
  await next();
});
