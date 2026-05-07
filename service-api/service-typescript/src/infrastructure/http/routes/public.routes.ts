import { Hono } from 'hono';
import { checkDatabase } from '../../database/connection.js';
import { renderMetrics } from '../../observability/metrics.js';
import { json } from '../http-response.js';
import { openApiDocument } from '../openapi.js';

export function registerPublicRoutes(app: Hono) {
  app.get('/health', (c) => json(c, { status: 'ok' }));
  app.get('/ready', async (c) => {
    await checkDatabase();
    return json(c, { status: 'ready' });
  });
  app.get('/metrics', (c) =>
    c.text(renderMetrics(), 200, { 'content-type': 'text/plain; version=0.0.4' })
  );
  app.get('/openapi.json', (c) => json(c, openApiDocument));
}
