import { Hono } from 'hono';
import { AppDependencies } from '../composition-root.js';
import { rateLimitMiddleware } from '../middlewares/rate-limit.middleware.js';
import { tenantAuthMiddleware } from '../../security/tenant-auth.middleware.js';
import { userAuthMiddleware } from '../../security/user-auth.middleware.js';

export function registerAuthRoutes(app: Hono, deps: AppDependencies) {
  const { authController } = deps.controllers;
  app.post(
    '/v1/auth/login',
    rateLimitMiddleware({ keyPrefix: 'auth-login', windowMs: 60_000, max: 10 }),
    tenantAuthMiddleware,
    (c) => authController.login(c)
  );
  app.post('/v1/auth/refresh', (c) => authController.refresh(c));
  app.post('/v1/auth/logout', userAuthMiddleware(deps.repositories.authRepo), (c) =>
    authController.logout(c)
  );
  app.get('/v1/auth/me', userAuthMiddleware(deps.repositories.authRepo), (c) =>
    authController.me(c)
  );
}
