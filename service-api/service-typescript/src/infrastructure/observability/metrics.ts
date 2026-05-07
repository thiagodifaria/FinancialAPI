import { createMiddleware } from 'hono/factory';
import { SpanStatusCode, trace } from '@opentelemetry/api';

type CounterKey = `${string} ${string} ${number}`;

const requestCounters = new Map<CounterKey, number>();
const requestDurations = new Map<string, { count: number; sum: number }>();
const requestDurationSamples = new Map<string, number[]>();
const domainCounters = new Map<string, number>();
const reconciliationGauges = new Map<string, number>();
let ledgerPostingsTotal = 0;
let idempotencyConflictsTotal = 0;
let idempotencyReplaysTotal = 0;
let idempotencyCachedSuccessTotal = 0;

/**
 * Métricas Prometheus simples e estáveis para a API HTTP.
 */
export const metricsMiddleware = createMiddleware(async (c, next) => {
  const startedAt = performance.now();
  const tracer = trace.getTracer('financial-api');
  const span = tracer.startSpan(`${c.req.method} ${c.req.path}`);

  try {
    await next();
    span.setStatus({ code: c.res.status >= 500 ? SpanStatusCode.ERROR : SpanStatusCode.OK });
  } catch (error) {
    span.recordException(error as Error);
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw error;
  } finally {
    span.end();
  }

  const route = c.req.routePath || c.req.path;
  const method = c.req.method;
  const status = c.res.status;
  const elapsedSeconds = (performance.now() - startedAt) / 1000;

  const counterKey: CounterKey = `${method} ${route} ${status}`;
  requestCounters.set(counterKey, (requestCounters.get(counterKey) ?? 0) + 1);

  const durationKey = `${method} ${route}`;
  const duration = requestDurations.get(durationKey) ?? { count: 0, sum: 0 };
  duration.count += 1;
  duration.sum += elapsedSeconds;
  requestDurations.set(durationKey, duration);

  const samples = requestDurationSamples.get(durationKey) ?? [];
  samples.push(elapsedSeconds);
  if (samples.length > 500) samples.shift();
  requestDurationSamples.set(durationKey, samples);
});

export function incrementLedgerPostings(): void {
  ledgerPostingsTotal += 1;
  incrementDomainMetric('ledger', 'posting');
}

export function incrementIdempotencyConflicts(): void {
  idempotencyConflictsTotal += 1;
  incrementDomainMetric('idempotency', 'conflict');
}

export function incrementIdempotencyReplay(): void {
  idempotencyReplaysTotal += 1;
  incrementDomainMetric('idempotency', 'replay');
}

export function incrementIdempotencyCachedSuccess(): void {
  idempotencyCachedSuccessTotal += 1;
  incrementDomainMetric('idempotency', 'cached_success');
}

export function incrementDomainMetric(domain: string, event: string): void {
  const key = `${domain}:${event}`;
  domainCounters.set(key, (domainCounters.get(key) ?? 0) + 1);
}

export function setReconciliationGauge(name: string, value: number): void {
  reconciliationGauges.set(name, value);
}

export function renderMetrics(): string {
  const lines: string[] = [
    '# HELP http_requests_total Total de requisicoes HTTP.',
    '# TYPE http_requests_total counter',
  ];

  for (const [key, value] of requestCounters.entries()) {
    const [method = 'unknown', route = 'unknown', status = 'unknown'] = key.split(' ');
    lines.push(
      `http_requests_total{method="${method}",route="${route}",status="${status}"} ${value}`
    );
  }

  lines.push(
    '# HELP http_request_duration_seconds_sum Soma da duracao das requisicoes HTTP.',
    '# TYPE http_request_duration_seconds_sum counter'
  );

  for (const [key, value] of requestDurations.entries()) {
    const [method = 'unknown', route = 'unknown'] = key.split(' ');
    lines.push(
      `http_request_duration_seconds_sum{method="${method}",route="${route}"} ${value.sum}`
    );
    lines.push(
      `http_request_duration_seconds_count{method="${method}",route="${route}"} ${value.count}`
    );
  }

  lines.push(
    '# HELP http_request_duration_seconds_p95 P95 aproximado das requisicoes HTTP.',
    '# TYPE http_request_duration_seconds_p95 gauge'
  );
  for (const [key, samples] of requestDurationSamples.entries()) {
    const [method = 'unknown', route = 'unknown'] = key.split(' ');
    const sorted = [...samples].sort((a, b) => a - b);
    const p95 = sorted[Math.floor((sorted.length - 1) * 0.95)] ?? 0;
    lines.push(`http_request_duration_seconds_p95{method="${method}",route="${route}"} ${p95}`);
  }

  lines.push('# HELP ledger_postings_total Total de transacoes postadas no ledger.');
  lines.push('# TYPE ledger_postings_total counter');
  lines.push(`ledger_postings_total ${ledgerPostingsTotal}`);
  lines.push('# HELP idempotency_conflicts_total Total de conflitos de idempotencia.');
  lines.push('# TYPE idempotency_conflicts_total counter');
  lines.push(`idempotency_conflicts_total ${idempotencyConflictsTotal}`);
  lines.push('# HELP idempotency_replays_total Total de replays idempotentes.');
  lines.push('# TYPE idempotency_replays_total counter');
  lines.push(`idempotency_replays_total ${idempotencyReplaysTotal}`);
  lines.push(
    '# HELP idempotency_cached_success_total Total de respostas cacheadas por idempotencia.'
  );
  lines.push('# TYPE idempotency_cached_success_total counter');
  lines.push(`idempotency_cached_success_total ${idempotencyCachedSuccessTotal}`);

  lines.push('# HELP financial_domain_events_total Total de eventos por dominio.');
  lines.push('# TYPE financial_domain_events_total counter');
  for (const [key, value] of domainCounters.entries()) {
    const [domain = 'unknown', event = 'unknown'] = key.split(':');
    lines.push(`financial_domain_events_total{domain="${domain}",event="${event}"} ${value}`);
  }

  lines.push('# HELP reconciliation_state Gauge operacional de conciliacao.');
  lines.push('# TYPE reconciliation_state gauge');
  for (const [name, value] of reconciliationGauges.entries()) {
    lines.push(`reconciliation_state{name="${name}"} ${value}`);
  }

  return `${lines.join('\n')}\n`;
}
