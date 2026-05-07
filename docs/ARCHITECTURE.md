# Architecture Reference

This document describes the architecture currently implemented in the repository. It is intentionally direct: it explains what exists, where it lives, how the pieces talk to each other and which boundaries should be preserved.

---

## 1. System Overview

FinancialAPI is a modular fintech API platform with one main HTTP API, one gRPC scoring service, a PostgreSQL database, Redis, RabbitMQ, observability services and a dedicated client web.

The repository is not a pure microservice platform. The core financial API is a TypeScript service with clear internal modules. The scoring engine is extracted into Python because credit decision logic benefits from isolation behind a stable gRPC contract.

High-level runtime:

```text
client-web / API consumer
        |
        v
TypeScript Core API (Hono)
        |
        +--> PostgreSQL (ledger, tenants, customers, accounts, events, compliance)
        |
        +--> Redis (idempotency reservation and cached response)
        |
        +--> RabbitMQ (outbox publication)
        |
        +--> Python gRPC scoring service
        |
        +--> Prometheus / Jaeger signals
```

---

## 2. Repository Map

| Path | Responsibility |
|------|----------------|
| `README.md` | Short project overview. |
| `README_PT.md` | Detailed Portuguese README. |
| `README_EN.md` | Detailed English README. |
| `LICENSE` | MIT license. |
| `docs/API.md` | HTTP API reference. |
| `docs/ARCHITECTURE.md` | Architecture reference. |
| `docs/OBSERVABILITY.md` | Metrics, tracing and operations signals. |
| `docs/GUIDE.md` | Local guide and practical workflows. |
| `service-api/service-typescript` | Main TypeScript/Hono API. |
| `service-api/service-python` | Python gRPC scoring engine. |
| `service-api/service-postgresql` | PostgreSQL config and migrations. |
| `service-api/data/proto` | Shared proto contract. |
| `client-web` | React/Vite technical console. |
| `infra` | Docker Compose and observability config. |
| `packages/typescript-sdk` | Lightweight TypeScript client. |
| `packages/python-sdk` | Lightweight Python client. |
| `scripts` | Local quality/security helpers. |

---

## 3. Core API Structure

The TypeScript service is organized under `service-api/service-typescript/src`.

| Layer | Path | Role |
|-------|------|------|
| Bootstrap | `src/index.ts` | Telemetry, migrations, cluster, serve and shutdown. |
| HTTP server | `src/infrastructure/http/server.ts` | Middleware and route registration. |
| Composition root | `src/infrastructure/http/composition-root.ts` | Repositories, use cases and controllers wiring. |
| Routes | `src/infrastructure/http/routes` | Public, auth and versioned route groups. |
| Controllers | `src/infrastructure/http/controllers` | HTTP input/output coordination. |
| Use cases | `src/application/use-cases` | Application behavior. |
| Sagas | `src/application/sagas` | Cross-domain workflows. |
| Modules | `src/modules` | Domain repositories and entities. |
| Shared domain | `src/domain/shared` | Base types and money utilities. |
| Database | `src/infrastructure/database` | SQL connection, migrations and tenant context. |
| Cache | `src/infrastructure/cache` | Redis idempotency service. |
| Events | `src/infrastructure/events` | Outbox publisher. |
| gRPC client | `src/infrastructure/grpc` | Credit scoring client. |
| Observability | `src/infrastructure/observability` | Metrics and tracing. |
| Security | `src/infrastructure/security` | Tenant and user auth middleware. |

This structure is intentionally close to a clean architecture without turning every action into excessive abstractions.

---

## 4. Bootstrap Flow

The bootstrap is in `src/index.ts`.

Startup sequence:

1. Start telemetry through `startTelemetry()`.
2. If the process is primary, optionally run migrations when `RUN_MIGRATIONS=true`.
3. Fork worker processes based on `WEB_CONCURRENCY`.
4. Restart worker if it exits.
5. In each worker, create the composition root.
6. Create the Hono server.
7. Start the outbox publisher.
8. Serve on `PORT` or `5000`.
9. On `SIGTERM`, stop outbox publisher and shutdown telemetry.

Design intent:

- Keep `index.ts` thin.
- Keep server construction testable.
- Keep dependency wiring explicit.
- Avoid hidden global service construction inside controllers.
- Allow migration execution to be controlled by environment.

---

## 5. HTTP Server Flow

`createServer()` in `server.ts` wires middlewares and routes.

Middleware order:

1. Error handler through `app.onError`.
2. Request ID middleware.
3. Security headers middleware.
4. CORS middleware.
5. Metrics middleware.
6. Audit middleware.
7. Public route registration.
8. Auth route registration.
9. `/v1` route registration.

Important consequences:

- Every request gets a request id.
- Security headers are always applied.
- Metrics wrap all routes.
- Audit middleware can observe command-like routes.
- Tenant authentication is applied inside `registerV1Routes`.
- Public operational endpoints stay unauthenticated.

---

## 6. Composition Root

The composition root creates concrete repositories and use cases once per worker.

Key objects:

- `PostgresAccountRepository`
- `PostgresFinancialAccountRepository`
- `PostgresTransactionRepository`
- `PostgresAuthRepository`
- `PostgresCustomerRepository`
- `PostgresTransferRepository`
- `PostgresLendingProposalRepository`
- `PostgresApiKeyRepository`
- `PostgresMoneyMovementRepository`
- `PostgresLoanRepository`
- `PostgresEventRepository`
- `PostgresAuditRepository`
- `PostgresConsentRepository`
- `PostgresFinancialProductRepository`
- `PostgresReconciliationRepository`
- `PostgresComplianceRepository`
- `IdempotencyService`
- `GrpcCreditScoringService`
- `LendingProposalSaga`

Controllers receive use cases, repositories or services depending on their role. This keeps the route file as pure endpoint registration.

---

## 7. Domain Module Inventory

| Module | Files | Responsibility |
|--------|-------|----------------|
| Accounts | `modules/accounts` | Ledger accounts, financial accounts and holds. |
| API Keys | `modules/api-keys` | Tenant API key persistence and lifecycle. |
| Auth | `modules/auth` | User sessions and login storage. |
| Customers | `modules/customers` | Customers and consents. |
| Transactions | `modules/transactions` | Double-entry ledger behavior. |
| Transfers | `modules/transfers` | Simplified transfer objects. |
| Money Movements | `modules/money-movements` | Movement lifecycle objects. |
| Lending | `modules/lending` | Proposals, products, applications, offers, contracts and installments. |
| Financial Products | `modules/financial-products` | Limits, statements, instruments, fees and sandbox rails. |
| Events | `modules/events` | Events, webhook endpoints and deliveries. |
| Reconciliation | `modules/reconciliation` | Runs, items and reports. |
| Compliance | `modules/compliance` | Retention, export/anonymization records and requests. |

---

## 8. Money Architecture

Financial values are treated as exact values.

Rules:

- API fields use names such as `amount_minor`, `balance_minor`, `limit_minor`.
- JSON values are strings.
- Domain values use `bigint`.
- Utility methods live in `domain/shared/money.utils.ts`.
- No financial behavior should use JavaScript floating point.
- SQL should not store money as float.
- Percent fees use basis points where modeled.

Why this matters:

- JSON numbers can lose precision.
- JavaScript `number` cannot represent every integer safely.
- Financial ledgers require exact arithmetic.
- Reconciliation relies on exact totals.
- Idempotency conflict detection should not be confused by numeric formatting.

---

## 9. Identity Architecture

There are two access models:

1. Machine access through `x-api-key`.
2. Human user access through bearer token after login.

Tenant resolution:

- `/v1/*` routes use `tenantAuthMiddleware`.
- The middleware validates the API key.
- The tenant id becomes request context.
- Repositories set PostgreSQL tenant context before queries.

Human auth:

- `POST /v1/auth/login` accepts email/password.
- `POST /v1/auth/refresh` refreshes a session.
- `POST /v1/auth/logout` ends a session.
- `GET /v1/auth/me` requires bearer context.

Separation rationale:

- Backend integrations should not depend on human sessions.
- Human sessions should not replace tenant API governance.
- API key rotation/revocation is tenant platform behavior.

---

## 10. Ledger Architecture

The ledger is implemented with transactions and entries.

Core concepts:

- A transaction is the accounting event header.
- Entries are postings to accounts.
- Entries have direction.
- Amounts are minor units.
- Debits must equal credits.
- Reversal creates compensating entries.

Important files:

- `transaction.entity.ts`
- `transaction.logic.ts`
- `transaction.repository.ts`
- `transaction.logic.spec.ts`
- `transaction.controller.ts`
- `transaction.use-cases.ts`

Behavior:

1. Controller validates HTTP input.
2. Idempotency may reserve the request.
3. Use case calls repository.
4. Repository runs SQL transaction.
5. Tenant context is set.
6. Transaction row is inserted.
7. Entry rows are inserted.
8. Account balances are updated.
9. Metrics increment ledger postings.
10. Response is returned or cached for idempotency.

---

## 11. Idempotency Architecture

`IdempotencyService` uses Redis.

Flow:

1. Request sends `x-idempotency-key`.
2. Controller hashes request body.
3. Service reserves key for tenant.
4. If key is new, operation proceeds.
5. If key exists with same hash and completed response, cached response is returned.
6. If key exists with different hash, conflict is raised.
7. On success, response is saved.
8. On failure, reservation is released when appropriate.

Metrics:

- `idempotency_conflicts_total`
- `idempotency_replays_total`
- `idempotency_cached_success_total`
- `financial_domain_events_total{domain="idempotency",...}`

Design reason:

- Retry-safe financial APIs need idempotency.
- Network timeouts should not duplicate money movement.
- The idempotency key must be scoped by tenant.

---

## 12. Database Architecture

PostgreSQL lives under `service-api/service-postgresql`.

Migration files:

- `001.sql`
- `002_financial_products.sql`
- `003_super_fintech_domains.sql`
- `004_reconciliation_webhooks_compliance.sql`

Migration runner:

- implemented in `infrastructure/database/connection.ts`;
- creates `schema_migrations`;
- orders SQL files;
- stores checksum;
- prevents silent mutation of applied migrations;
- runs only when `RUN_MIGRATIONS=true`.

Tenant context:

- implemented in `tenant-context.ts`;
- repositories call `setTenantContext`;
- database RLS posture depends on current tenant setting.

Database design posture:

- Financial tables are append-oriented where required.
- New schema changes should use new migration files.
- Old migrations should not be rewritten after being considered applied.
- SQL lint rejects destructive patterns for critical financial tables.

---

## 13. Outbox and Webhook Architecture

Outbox implementation lives in `infrastructure/events/outbox.publisher.ts`.

Event persistence lives in:

- `modules/events/event.repository.ts`
- `webhook_endpoints`
- `webhook_deliveries`
- `events`
- `outbox_events`

Flow:

1. Domain action creates event or outbox record.
2. Outbox publisher scans pending work.
3. RabbitMQ publication is attempted.
4. Webhook delivery can be created.
5. HMAC signature is generated for delivery.
6. Delivery status is persisted.
7. Failure can retry with backoff/jitter.
8. Exhausted delivery becomes dead letter.

Operational fields:

- endpoint id;
- outbox event id;
- event type;
- URL;
- status;
- attempt count;
- status code;
- duration;
- error;
- response body;
- timestamps.

---

## 14. Scoring Architecture

The scoring service is Python.

Paths:

- `service-api/service-python/src/app/server.py`
- `service-api/service-python/src/app/grpc/service.py`
- `service-api/service-python/src/app/scoring/policy.py`
- `service-api/data/proto/financial.proto`

The TypeScript client is:

- `service-api/service-typescript/src/infrastructure/grpc/clients/credit-scoring.client.ts`

Contract behavior:

- Package is `financial_api.scoring.v1`.
- Requests include metadata.
- Client sends deadlines.
- Client retries transient errors.
- Default failure policy is closed.
- Sandbox-controlled failure policy is explicit.
- Python validates input.
- Python returns score, approval, maximum limit, reason and policy version data.

Why gRPC:

- Explicit interface between core and scoring.
- Clear boundary for scoring model and policy work.
- Deadlines and metadata are natural.
- Generated stubs can be checked in CI.

---

## 15. Client Web Architecture

The frontend is a dedicated React/Vite app.

Important paths:

- `client-web/src/App.tsx`
- `client-web/src/api/endpointSpec.ts`
- `client-web/src/api/httpClient.ts`
- `client-web/src/features/api-explorer`
- `client-web/src/features/docs`
- `client-web/src/features/home`
- `client-web/src/features/operations`
- `client-web/src/styles/global.css`

Frontend responsibilities:

- show project home;
- expose local docs;
- provide API Explorer;
- allow Base URL/API key/Bearer configuration;
- send real HTTP calls;
- store captured IDs from responses;
- render response console;
- expose simple/configurable/ready JSON test modes;
- keep endpoint list compatible with the backend.

The old static `service-typescript/src/public` was removed. That is intentional. The TypeScript API should not ship a second stale UI.

---

## 16. Infra Architecture

Docker Compose is in `infra/docker-compose.yml`.

Services:

- `db`
- `redis`
- `rabbitmq`
- `core-engine`
- `scoring-engine`
- `prometheus`
- `grafana`
- `jaeger`

Important dependencies:

- `core-engine` depends on database, Redis, RabbitMQ and healthy scoring.
- `scoring-engine` exposes gRPC port `50052`.
- `prometheus` scrapes `core-engine:5000`.
- `grafana` reads Prometheus datasource config.
- Jaeger exposes OTLP ports and UI.

Ports:

- Core API: `5000`
- Scoring: `50052`
- PostgreSQL: `5432`
- Redis: `6379`
- RabbitMQ AMQP: `5672`
- RabbitMQ UI: `15672`
- Prometheus: `9090`
- Grafana: `3000`
- Jaeger UI: `16686`
- OTLP gRPC: `4317`
- OTLP HTTP: `4318`

---

## 17. Observability Architecture

Metrics are in `metrics.ts`.

Tracing is in `tracing.ts`.

Logging is in `logger.ts`.

Observable signals:

- HTTP request counters.
- HTTP duration sum/count.
- Approximate p95.
- Ledger postings.
- Idempotency conflicts.
- Idempotency replays.
- Idempotency cached successes.
- Domain event counters.
- Reconciliation gauges.
- OpenTelemetry spans.

Infrastructure config:

- `infra/prometheus/prometheus.yml`
- `infra/prometheus/alerts.yml`
- `infra/grafana/dashboard.json`
- `infra/grafana/datasources.yml`

---

## 18. Security Architecture

Implemented posture:

- Tenant API key required on `/v1`.
- Security headers middleware.
- CORS configured by env.
- User bearer auth for user context route.
- API key rotation and revocation.
- Optional IP allowlist modeled.
- Webhook secret rotation.
- Secret scan script.
- PII masking/logging posture in security phases.

Important truth:

- This is a strong local/platform foundation.
- It is not a regulatory certification.
- Production deployment posture is deliberately documented as an operational boundary: secrets manager, TLS/mTLS policy, hardened network boundaries, identity provider decisions, audit retention policy and compliance review belong to the deployment and governance layer around this API.

---

## 19. Architectural Governance Rules

- Keep route registration in route files.
- Keep dependency wiring in composition root.
- Keep bootstrap thin.
- Keep money as minor-unit strings externally.
- Keep money as `bigint` internally.
- Keep UUIDv7 generation for new identifiers.
- Keep old migrations stable.
- Add new migrations for schema evolution.
- Keep sandbox rails named as sandbox.
- Do not add fake provider integrations.
- Financial commands are reviewed for idempotency.
- Modules are reviewed for audit impact.
- Domain events are reviewed for webhook and outbox impact.
- Public endpoints are reflected in OpenAPI and the client-web endpoint spec.
- Operational risks are represented through metric, log context or runbook guidance.

---

## 20. Module Boundary Review Criteria

These criteria describe how the architecture keeps module boundaries clear. They are not pending tasks; they are the questions used to classify behavior before it enters the public API.

| Criterion | Architectural meaning |
|-----------|------------------------|
| Ledger vs money movement | Distinguishes accounting facts from operational money lifecycle. |
| Product state vs accounting state | Keeps customer-facing product records separate from immutable ledger records. |
| Customer-visible mutation | Identifies commands that affect user-facing status, balance or lifecycle. |
| Money movement | Marks flows that require idempotency, audit and reconciliation awareness. |
| Idempotency | Confirms retry behavior for commands with financial side effects. |
| Audit | Confirms whether the action should be visible in audit logs. |
| Webhook event | Classifies whether downstream consumers need asynchronous notification. |
| Reconciliation | Marks flows that affect financial reports or difference detection. |
| Schema ownership | Confirms whether existing tables model the state or a new table/migration is warranted. |
| RLS and tenant context | Keeps data access tenant-scoped and explicit. |
| Request/user/tenant correlation | Preserves investigation paths across logs, audit and responses. |
| Client-web and SDK contract | Keeps public developer surfaces aligned with backend behavior. |
| Real-vs-sandbox claim | Ensures sandbox rails remain clearly labeled as sandbox. |
