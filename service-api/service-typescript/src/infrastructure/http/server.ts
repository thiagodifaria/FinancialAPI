import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { auditMiddleware } from './middlewares/audit.middleware.js';
import { errorHandler } from './middlewares/error-handler.js';
import { requestIdMiddleware } from './middlewares/request-id.middleware.js';
import { securityHeadersMiddleware } from './middlewares/security-headers.middleware.js';
import { metricsMiddleware } from '../observability/metrics.js';
import { AppDependencies } from './composition-root.js';
import { registerAuthRoutes } from './routes/auth.routes.js';
import { registerPublicRoutes } from './routes/public.routes.js';
import { registerV1Routes } from './routes/v1.routes.js';

/**
 * Monta middlewares e rotas sem bootstrap.
 */
export function createServer(deps: AppDependencies): Hono {
  const app = new Hono();

  app.onError(errorHandler);
  app.use('*', requestIdMiddleware);
  app.use('*', securityHeadersMiddleware);
  app.use(
    '*',
    cors({
      origin: process.env.CORS_ORIGIN ?? '*',
      allowHeaders: ['content-type', 'x-api-key', 'x-idempotency-key', 'authorization'],
      allowMethods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    })
  );
  app.use('*', metricsMiddleware);
  app.use('*', auditMiddleware(deps.repositories.auditRepo));

  registerPublicRoutes(app);
  registerAuthRoutes(app, deps);
  registerV1Routes(app, deps);

  return app;
}
