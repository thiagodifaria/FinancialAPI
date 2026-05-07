# Observability Reference

This document describes how the project exposes health, readiness, metrics, traces, logs, dashboards and alerts. It is based on the TypeScript observability code, Docker Compose infrastructure, Prometheus configuration, Grafana dashboard and the Python scoring service.

---

## 1. Observability Goals

The observability goal is not only to know whether the API is up. The goal is to understand whether financial operations are moving safely.

The platform should help answer:

- Is the API receiving traffic?
- Are routes failing with 5xx?
- Is p95 latency rising?
- Are ledger postings happening?
- Are idempotency conflicts increasing?
- Are idempotent replays being served?
- Are cached idempotency responses being used?
- Are lending/scoring decisions happening?
- Is scoring unavailable?
- Are webhook deliveries failing?
- Is the outbox failing?
- Does reconciliation show differences?
- Is a request correlated by request id?
- Can local operators inspect Prometheus and Grafana?

---

## 2. Operational Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Liveness check. |
| `GET /ready` | Readiness check. |
| `GET /metrics` | Prometheus metrics. |
| `GET /openapi.json` | Contract visibility. |

Operational notes:

- These endpoints are public.
- They are registered in `public.routes.ts`.
- They are outside `/v1`.
- They should remain lightweight.
- They are used by humans, local scripts and infrastructure.

---

## 3. Metrics Implementation

Metrics are implemented in:

```text
service-api/service-typescript/src/infrastructure/observability/metrics.ts
```

The implementation uses an in-memory Prometheus text renderer instead of a heavy metrics dependency.

Current metric families:

- `http_requests_total`
- `http_request_duration_seconds_sum`
- `http_request_duration_seconds_count`
- `http_request_duration_seconds_p95`
- `ledger_postings_total`
- `idempotency_conflicts_total`
- `idempotency_replays_total`
- `idempotency_cached_success_total`
- `financial_domain_events_total`
- `reconciliation_state`

Important behavior:

- Metrics are per worker process.
- In local cluster mode, each worker has its own in-memory metrics.
- Prometheus scrapes the exposed process endpoint.
- For production, a multi-process metrics strategy would need refinement.
- Current metrics are sufficient for local validation and portfolio-grade operational posture.

---

## 4. HTTP Metrics

`metricsMiddleware` wraps all requests.

It records:

- method;
- route;
- response status;
- elapsed seconds;
- request count;
- duration sum;
- duration count;
- approximate p95 based on recent samples.

Metric examples:

```text
http_requests_total{method="GET",route="/health",status="200"} 10
http_request_duration_seconds_sum{method="GET",route="/health"} 0.05
http_request_duration_seconds_count{method="GET",route="/health"} 10
http_request_duration_seconds_p95{method="GET",route="/health"} 0.01
```

Operational interpretation:

- High 5xx rate means application or dependency failures.
- High p95 means route latency is degrading.
- Route-level labels help identify the failing surface.
- Count and sum allow average duration calculations.
- P95 sample behavior is approximate and local-process oriented.

---

## 5. Ledger Metrics

Metric:

```text
ledger_postings_total
```

Domain metric:

```text
financial_domain_events_total{domain="ledger",event="posting"}
```

Meaning:

- The ledger posting metric increases when transaction posting behavior is executed.
- It is useful to know whether financial write activity is happening.
- It should be reviewed together with reconciliation and idempotency metrics.

Operational questions:

- Are postings expected at this time?
- Did postings stop while money movement traffic continues?
- Did postings spike unexpectedly?
- Are postings correlated with webhook events?
- Are postings correlated with reconciliation differences?

---

## 6. Idempotency Metrics

Metrics:

```text
idempotency_conflicts_total
idempotency_replays_total
idempotency_cached_success_total
```

Domain metrics:

```text
financial_domain_events_total{domain="idempotency",event="conflict"}
financial_domain_events_total{domain="idempotency",event="replay"}
financial_domain_events_total{domain="idempotency",event="cached_success"}
```

Meaning:

- Conflict means the same key was reused with a different payload.
- Replay means an existing idempotency record was found.
- Cached success means the service returned a stored successful response.

Operational interpretation:

- A few replays can be normal after client timeouts.
- Many cached successes can mean clients are retrying aggressively.
- Conflicts can indicate client bugs or unsafe key reuse.
- A conflict spike deserves investigation because money movement retries may be wrong.

---

## 7. Domain Metrics

Metric:

```text
financial_domain_events_total{domain="<domain>",event="<event>"}
```

Current domains include:

- `ledger`
- `idempotency`
- `events`
- `webhooks`
- `outbox`
- `lending`
- `scoring`
- `reconciliation`

Known event examples:

- `ledger/posting`
- `idempotency/conflict`
- `idempotency/replay`
- `idempotency/cached_success`
- `webhooks/delivered`
- `webhooks/failed`
- `webhooks/dead_letter`
- `webhooks/manual_retry`
- `outbox/published`
- `outbox/failed`
- `lending/proposal_started`
- `lending/proposal_approved`
- `lending/proposal_rejected`
- `scoring/approved`
- `scoring/rejected`
- `scoring/transient_retry`
- `scoring/failed_closed`
- `reconciliation/run_completed`

Design reason:

- Financial APIs need domain-aware signals.
- HTTP metrics alone do not explain whether money is stuck.
- Domain labels allow dashboards and alerts to map symptoms to product areas.

---

## 8. Reconciliation Metrics

Metric:

```text
reconciliation_state{name="<name>"}
```

Current gauge names:

- `last_differences`
- `last_entries_count`
- `last_movements_count`

Meaning:

- `last_differences` is `0` when the last run matched and `1` when it found a difference.
- `last_entries_count` records the number of ledger entries considered by the last run.
- `last_movements_count` records the number of money movements considered by the last run.

Operational notes:

- Current reconciliation compares ledger entry totals and money movement totals for a period.
- This is not provider-statement reconciliation.
- It is still useful because it catches internal mismatch patterns.
- Provider-backed integrations have their own reconciliation metrics in the deployment/provider layer.

---

## 9. Tracing

Tracing setup lives in:

```text
service-api/service-typescript/src/infrastructure/observability/tracing.ts
```

HTTP spans are created in the metrics middleware.

Docker Compose config:

```text
OTEL_ENABLED=true
OTEL_SERVICE_NAME=financial-api
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318
OTEL_TRACES_EXPORTER=otlp
```

Jaeger ports:

- UI: `16686`
- OTLP gRPC: `4317`
- OTLP HTTP: `4318`

Tracing goals:

- correlate HTTP request path;
- record error status;
- record exceptions;
- preserve request_id in logs and audit data;
- support repository/use-case spans when those spans are enabled.

Important limitation:

- Current tracing is a base layer.
- It is not yet a complete distributed trace for every SQL/RabbitMQ operation.
- gRPC metadata carries request-style information for scoring and preserves trace-correlation context.

---

## 10. Logging

Logging lives in:

```text
service-api/service-typescript/src/infrastructure/logging/logger.ts
service-api/service-python/src/app/logging.py
```

Expected log fields:

- request id;
- tenant id;
- user id when available;
- idempotency key when relevant;
- transaction id when available;
- policy version for scoring;
- latency for scoring decisions;
- error object where safe.

Security posture:

- Logs should avoid PII.
- Logs should avoid secrets.
- API keys and webhook secrets must not be printed.
- Documents/tokens/payment method raw values should be masked or tokenized.
- Secret scanning is available through `scripts/secret-scan.sh`.

---

## 11. Prometheus Configuration

Config path:

```text
infra/prometheus/prometheus.yml
```

Rule path:

```text
infra/prometheus/alerts.yml
```

Prometheus job:

```yaml
- job_name: 'financial_api'
  static_configs:
    - targets: ['core-engine:5000']
  metrics_path: '/metrics'
```

Local URL:

```text
http://localhost:9090
```

Validation command:

```bash
cd infra
docker run --rm --entrypoint promtool \
  -v "$PWD/prometheus:/etc/prometheus:ro" \
  prom/prometheus:v2.55.1 \
  check config /etc/prometheus/prometheus.yml
```

---

## 12. Prometheus Alerts

Current alerts:

| Alert | Signal |
|-------|--------|
| `FinancialCoreHigh5xxRate` | Sustained 5xx responses. |
| `FinancialCoreHighLatencyP95` | P95 above one second. |
| `FinancialCoreIdempotencyConflictSpike` | More than five conflicts in ten minutes. |
| `FinancialCoreWebhookFailures` | Webhook failure/dead-letter increase. |
| `FinancialCoreOutboxFailures` | Outbox failure increase. |
| `FinancialCoreScoringUnavailable` | Scoring failed-closed or transient retry increase. |

Alert design:

- Keep alerts tied to operational risk.
- Avoid alerts for normal low-volume local noise.
- Prefer domain labels when the problem is financial-domain specific.
- Make annotations explain the investigation direction.

---

## 13. Grafana Dashboard

Dashboard path:

```text
infra/grafana/dashboard.json
```

Datasource path:

```text
infra/grafana/datasources.yml
```

Local URL:

```text
http://localhost:3000
```

Current panels:

- Request Rate Por Rota.
- Error Rate 5xx.
- P95 HTTP.
- Ledger Postings.
- Idempotency Conflicts.
- API Scrape Health.
- Eventos Por Dominio.
- Estado Da Conciliacao.
- Idempotency Replays.
- Idempotency Cached Success.
- Lending Events 1h.

Operational use:

- Start with API scrape health.
- Check 5xx and latency.
- Check domain events.
- Check idempotency counters.
- Check reconciliation state.
- Check lending/scoring when credit flows fail.
- Check webhook/outbox when events stop arriving.

---

## 14. RabbitMQ and Outbox Signals

RabbitMQ runs in Docker Compose.

Local UI:

```text
http://localhost:15672
```

Outbox metrics:

```text
financial_domain_events_total{domain="outbox",event="published"}
financial_domain_events_total{domain="outbox",event="failed"}
```

Webhook metrics:

```text
financial_domain_events_total{domain="webhooks",event="delivered"}
financial_domain_events_total{domain="webhooks",event="failed"}
financial_domain_events_total{domain="webhooks",event="dead_letter"}
```

Investigate when:

- outbox failures increase;
- webhook failures increase;
- webhook dead letters appear;
- `/v1/reports/outbox` shows pending/stuck records;
- RabbitMQ is unavailable;
- network calls to webhook endpoints time out.

---

## 15. Scoring Observability

Python scoring paths:

- `service-api/service-python/src/app/server.py`
- `service-api/service-python/src/app/grpc/service.py`
- `service-api/service-python/src/app/observability.py`
- `service-api/service-python/src/app/scoring/policy.py`

TypeScript scoring client:

- `service-api/service-typescript/src/infrastructure/grpc/clients/credit-scoring.client.ts`

Signals:

- scoring approved count;
- scoring rejected count;
- scoring transient retry count;
- scoring failed-closed count;
- policy version in logs;
- latency in Python logs;
- gRPC health service availability.

Health check:

- Docker Compose uses gRPC health check against `localhost:50052`.
- `core-engine` waits for `scoring-engine` to become healthy.

Failure interpretation:

- `failed_closed` means lending is protected by not approving when scoring is unavailable.
- `transient_retry` means the client saw gRPC unavailable/deadline/resource errors and retried.
- `sandbox_controlled` policy should only be used intentionally for local development.

---

## 16. Readiness and Health

Health:

- should answer whether the process is alive;
- should be cheap;
- should not perform heavy dependency checks.

Readiness:

- should answer whether the service can serve real traffic;
- can check dependencies;
- should fail when core dependencies are unavailable.

Container posture:

- scoring has gRPC health check;
- Prometheus has HTTP health check;
- core waits on scoring health;
- DB/Redis/RabbitMQ are dependency services in Compose.

---

## 17. Request Correlation

Request correlation uses:

- request id middleware;
- audit middleware;
- logger context;
- idempotency key when present;
- tenant id from API key;
- user id when bearer user exists;
- gRPC metadata for scoring.

Correlation fields:

- `request_id`
- `tenant_id`
- `user_id`
- `idempotency_key`
- `transaction_id`
- `policy_version`
- `caller_service`

Operational workflow:

1. Capture `request_id` from response/error/log.
2. Inspect logs by request id.
3. Check audit logs for the request.
4. Check ledger transaction id if money moved.
5. Check outbox/webhook delivery if event was expected.
6. Check scoring domain metrics if lending failed.
7. Check reconciliation if ledger/movement totals disagree.

---

## 18. Local Inspection Commands

Metrics:

```bash
curl http://localhost:5000/metrics
```

OpenAPI:

```bash
curl http://localhost:5000/openapi.json | jq '.info'
```

Health:

```bash
curl http://localhost:5000/health
curl http://localhost:5000/ready
```

Prometheus config validation:

```bash
cd infra
docker compose config
docker run --rm --entrypoint promtool \
  -v "$PWD/prometheus:/etc/prometheus:ro" \
  prom/prometheus:v2.55.1 \
  check config /etc/prometheus/prometheus.yml
```

Outbox report:

```bash
curl "$API/v1/reports/outbox" -H "x-api-key: $KEY"
```

Webhook delivery report:

```bash
curl "$API/v1/webhook-deliveries" -H "x-api-key: $KEY"
```

Reconciliation run:

```bash
curl -X POST "$API/v1/reconciliation-runs" \
  -H "content-type: application/json" \
  -H "x-api-key: $KEY" \
  -d '{"period_start":"2026-05-01","period_end":"2026-05-31"}'
```

---

## 19. Incident Playbooks

### API returning 5xx

1. Check Grafana 5xx panel.
2. Check Prometheus `http_requests_total{status=~"5.."}`.
3. Inspect core-engine logs.
4. Check DB/Redis/RabbitMQ availability.
5. Check recent migrations.
6. Check error envelope `request_id`.
7. Reproduce through client-web or curl.

### High p95 latency

1. Identify route from p95 panel.
2. Check whether route is list/report/reconciliation.
3. Check database load.
4. Check RabbitMQ/outbox activity.
5. Check scoring if lending path is slow.
6. Check request volume.
7. Consider indexes or pagination for list endpoints.

### Idempotency conflicts

1. Check conflict spike alert.
2. Identify client and endpoint.
3. Compare idempotency key reuse pattern.
4. Confirm payload hash mismatch.
5. Ask whether client uses unique keys per operation.
6. Do not manually replay money movement without understanding original state.

### Scoring unavailable

1. Check scoring container health.
2. Check gRPC port `50052`.
3. Check `SCORING_ENGINE_HOST` and `SCORING_ENGINE_PORT`.
4. Check TypeScript client retries.
5. Check Python service logs.
6. Confirm failure policy.
7. Avoid switching to sandbox policy in production-like contexts.

### Webhook failures

1. Check `webhook-deliveries`.
2. Inspect status code and error.
3. Confirm destination URL is reachable.
4. Confirm HMAC timestamp/signature expectations.
5. Retry manually if delivery is safe.
6. Watch `webhooks/failed` and `webhooks/dead_letter` metrics.

### Reconciliation difference

1. Check `reconciliation_state{name="last_differences"}`.
2. List reconciliation run items.
3. Compare ledger totals and movement totals.
4. Inspect movements created in the period.
5. Inspect ledger entries created in the period.
6. Check reversals and failed/returned movement states.
7. Document whether the difference is expected or a bug.

---

## 20. Observability Review Criteria

These criteria describe the observability posture used across the implemented modules. They are not pending tasks; they are the questions used to keep new behavior diagnosable.

| Criterion | Operational meaning |
|-----------|---------------------|
| Domain metric | Important business or financial behavior is measurable. |
| Alert | Critical degradation has an actionable signal. |
| Grafana panel | Operators can inspect the signal without reading raw metrics. |
| Request id propagation | HTTP, audit, event and delivery records can be correlated. |
| Audit log | Command-like behavior leaves a business investigation trail. |
| Domain event | Business facts are visible to asynchronous consumers. |
| Outbox | Events that cross process boundaries are durable before dispatch. |
| Webhooks | External delivery has status, attempts, errors and retry behavior. |
| Reconciliation | Financial effects can be compared in reports. |
| Idempotency | Retry-sensitive behavior can be observed for replay and conflict. |
| Logs | Technical failures provide context without leaking secrets or PII. |
| Readiness | Dependency failures are represented as traffic readiness, not liveness. |
| Health | Process liveness remains cheap and predictable. |
| Runbook | Incidents have a documented investigation path. |
