import { createMiddleware } from 'hono/factory';

/**
 * Headers defensivos padrão para reduzir exposição acidental do console/API.
 */
export const securityHeadersMiddleware = createMiddleware(async (c, next) => {
  c.header('x-content-type-options', 'nosniff');
  c.header('x-frame-options', 'DENY');
  c.header('referrer-policy', 'no-referrer');
  c.header('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  c.header('cross-origin-opener-policy', 'same-origin');
  c.header('cross-origin-resource-policy', 'same-site');
  c.header('strict-transport-security', 'max-age=31536000; includeSubDomains');
  await next();
});
