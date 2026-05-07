import { NodeSDK } from '@opentelemetry/sdk-node';
import { logger } from '../logging/logger.js';

let sdk: NodeSDK | null = null;

/**
 * Inicializa OpenTelemetry quando habilitado por ambiente.
 * O exportador pode ser configurado por OTEL_EXPORTER_OTLP_ENDPOINT/OTEL_TRACES_EXPORTER.
 */
export function startTelemetry(): void {
  if (process.env.OTEL_ENABLED !== 'true') return;

  sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME || 'financial-api',
  });
  sdk.start();
  logger.info('OpenTelemetry inicializado');
}

export async function shutdownTelemetry(): Promise<void> {
  if (!sdk) return;
  await sdk.shutdown();
}
