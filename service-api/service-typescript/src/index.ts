import { serve } from '@hono/node-server';
import cluster from 'node:cluster';
import { availableParallelism } from 'node:os';

import { runMigrations } from './infrastructure/database/connection.js';
import {
  startOutboxPublisher,
  stopOutboxPublisher,
} from './infrastructure/events/outbox.publisher.js';
import { createCompositionRoot } from './infrastructure/http/composition-root.js';
import { createServer } from './infrastructure/http/server.js';
import { logger } from './infrastructure/logging/logger.js';
import { shutdownTelemetry, startTelemetry } from './infrastructure/observability/tracing.js';

startTelemetry();

/**
 * Bootstrap enxuto: cluster, migrations, serve e graceful shutdown.
 * A montagem HTTP fica em server.ts e o wiring em composition-root.ts.
 */
async function startServer() {
  if (cluster.isPrimary) {
    logger.info({ pid: process.pid }, '[FinancialAPI] Processo principal rodando');

    if (process.env.RUN_MIGRATIONS === 'true') {
      await runMigrations();
      logger.info('[DB] Migrações executadas.');
    }

    const numCPUs = Number(process.env.WEB_CONCURRENCY) || Math.min(availableParallelism(), 4);
    for (let i = 0; i < numCPUs; i++) cluster.fork();

    cluster.on('exit', (worker) => {
      logger.warn({ pid: worker.process.pid }, 'Worker desconectado. Reiniciando...');
      cluster.fork();
    });
    return;
  }

  const deps = createCompositionRoot();
  const app = createServer(deps);
  const port = Number(process.env.PORT) || 5000;
  startOutboxPublisher();
  serve({ fetch: app.fetch, port });
  logger.info({ pid: process.pid, port }, '[WORKER] Escutando');
}

startServer().catch((error) => {
  logger.error({ err: error }, 'Falha crítica ao iniciar servidor');
  process.exit(1);
});

process.on('SIGTERM', () => {
  stopOutboxPublisher();
  shutdownTelemetry()
    .catch((error) => logger.error({ err: error }, 'Erro ao encerrar OpenTelemetry'))
    .finally(() => process.exit(0));
});
