# FinancialAPI

![FinancialAPI](https://img.shields.io/badge/FinancialAPI-API-111827?style=for-the-badge&logo=github&logoColor=white)

**Multi-tenant fintech API for ledger, wallets, money movement, lending, webhooks, reconciliation and financial operations**

[![TypeScript](https://img.shields.io/badge/TypeScript-core%20api-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-credit%20scoring-3776AB?style=flat&logo=python&logoColor=white)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-client%20web-61DAFB?style=flat&logo=react&logoColor=111827)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-ledger%20storage-316192?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-idempotency-DC382D?style=flat&logo=redis&logoColor=white)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-local%20stack-2496ED?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-success?style=flat)](LICENSE)

---

## Documentation

**Short overview:** [README.md](README.md)  
**Leia em Portugues:** [README_PT.md](README_PT.md)  
**API Reference:** [docs/API.md](docs/API.md)  
**Architecture Reference:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)  
**Observability Reference:** [docs/OBSERVABILITY.md](docs/OBSERVABILITY.md)  
**Local Guide:** [docs/GUIDE.md](docs/GUIDE.md)  
**Free Demo Deployment:** [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

---

## What is FinancialAPI?

FinancialAPI is a backend-first platform for financial products. The repository combines a versioned TypeScript/Hono HTTP API, a Python gRPC scoring microservice, PostgreSQL for ledger and transactional data, Redis for idempotency, RabbitMQ for outbox/events, Prometheus/Grafana/Jaeger for observability and a dedicated React frontend for API exploration.

The goal is to provide a broad fintech/financial API foundation without reducing the domain to a simple banking CRUD. The current scope covers customers, human authentication, tenant API keys, financial accounts, ledger accounts, balances, holds, limits, statements, double-entry transactions, reversals, transfers, deposits, withdrawals, payments, lending, fees, webhooks, reconciliation, operational compliance and sandbox rails.

The most important accuracy rule is to separate real infrastructure from sandbox helpers. Ledger, idempotency, migrations, authentication, outbox, webhook delivery, reconciliation, deterministic scoring and persistence are real parts of the project. Pix, Boleto and Card Issuing are deterministic sandbox helpers in this milestone, not real provider integrations.

---

## Current MVP Status

The project currently includes:

- HTTP API under `/v1`.
- OpenAPI available at `/openapi.json`.
- Public health, readiness and metrics endpoints.
- Human login with session, refresh and logout.
- Tenant API keys with rotation, revocation and tenant resolution.
- Individual/business customers with status, update, verify, block, archive, consent, export and anonymize operations.
- Separate financial accounts and ledger accounts.
- Balances with ledger/current, available and hold-aware values.
- Double-entry ledger with transactions and entries.
- Generic transaction reversal.
- Internal transfers and money movements.
- Deposits, withdrawals, payments, internal/inbound/outbound transfers and refunds.
- External accounts and payment methods.
- Account limits, account status transitions and statements.
- Loan products, simulations, applications, offers, contracts and installments.
- Python gRPC scoring with deterministic policy logic.
- Fee schedules, pricing rules, fee charges and fee reversals.
- Pix/Boleto/Card sandbox flows.
- Webhook endpoints, events, webhook deliveries, manual retry and test events.
- RabbitMQ outbox publisher.
- Reconciliation runs, items and reports.
- Data retention policies and compliance requests.
- Audit logs for command routes through middleware.
- React client web for real endpoint testing.
- Simple TypeScript SDK and lightweight Python SDK.

---

## Why this project exists

This project exists as a technical reference for a modular financial API. It does not claim to be a complete bank, certified core banking system, PSP, real card issuer or real Pix/Boleto integration. Its goal is to show how to structure a financial platform with domain boundaries, monetary precision, tenant isolation, immutable ledger behavior, observability, idempotency and enough developer experience to evolve safely.

The central design idea is to treat money as critical data:

- financial values use minor units;
- JSON exposes money as integer strings;
- TypeScript domain code uses `bigint`;
- new entities use UUIDv7;
- ledger and audit records are treated as insert-only;
- sensitive movement operations use idempotency;
- the tenant is resolved before `/v1` handlers run;
- repositories set tenant context for RLS posture;
- public operations expose health, readiness and metrics.

---

## High-level architecture

The platform is separated into clear surfaces:

| Area | Path | Responsibility |
|------|------|----------------|
| Core API | `service-api/service-typescript` | HTTP API, use cases, repositories, OpenAPI, metrics and outbox |
| Scoring | `service-api/service-python` | gRPC credit decision engine |
| Database | `service-api/service-postgresql` | PostgreSQL config and versioned migrations |
| Proto | `service-api/data/proto` | gRPC contract between TypeScript and Python |
| Client Web | `client-web` | React console for docs, operations and API Explorer |
| Infra | `infra` | Docker Compose, Prometheus, Grafana, RabbitMQ and Jaeger |
| SDKs | `packages` | TypeScript and Python clients |
| Scripts | `scripts` | Secret scan and SQL lint |
| Docs | `docs` | API, architecture, observability and local guide |

The API bootstrap lives in `src/index.ts`. It starts telemetry, applies migrations when `RUN_MIGRATIONS=true`, uses Node cluster workers and registers shutdown hooks. HTTP composition lives in `src/infrastructure/http/server.ts`, while dependency wiring lives in `src/infrastructure/http/composition-root.ts`.

This split keeps bootstrap, HTTP, use cases, repositories and domains from collapsing into one file. The organization was influenced by the `server.go` pattern from the PRIMME project: explicit server object, clear composition root, grouped routes, cross-cutting middleware and thin bootstrap.

---

## Stack and rationale

| Technology | Usage | Rationale |
|------------|-------|-----------|
| TypeScript | Core API | Strong modeling with productive iteration and Hono compatibility |
| Hono | HTTP server | Lightweight API layer with simple middleware composition |
| PostgreSQL | Ledger and transactional data | Consistency, RLS, constraints, JSONB and transactions |
| Redis | Idempotency | Atomic key reservation and cached response storage |
| RabbitMQ | Events/outbox | Local event pipeline and webhook dispatch |
| Python | Scoring | Isolated credit policy logic behind a gRPC contract |
| gRPC | Core-to-scoring | Typed contract, deadlines, metadata and controlled errors |
| React/Vite | Client web | Fast console for testing real API calls |
| Prometheus | Metrics | HTTP and domain operational signals |
| Grafana | Dashboard | Local operational visualization |
| Jaeger/OTel | Tracing | Request and span correlation |
| Docker Compose | Local stack | Reproducible Postgres, Redis, RabbitMQ, API, scoring and observability |

---

## Product modules

### Auth and Tenant

Machine-to-machine access uses `x-api-key`. The key resolves the tenant and passes through tenant middleware before `/v1` handlers. Human login is separate and returns session/refresh tokens for tenant users.

### Customers

Customers can represent individuals or businesses. The module supports create, list, get, update, verify, block, archive, consents, export and restricted anonymization.

### Accounts and Wallets

The project separates `financial_accounts` from `accounts`. The ledger account carries direction, balance, status and metadata. The financial account represents the customer-facing product/wallet relationship.

### Ledger

Transactions and entries follow double-entry accounting. The code validates that debits and credits close exactly. Reversals create compensating postings instead of mutating financial history.

### Money Movement

Money movement represents operational movement objects: deposit, withdrawal, payment, internal transfer, inbound transfer, outbound transfer and refund. Internal transfers also have a simplified `/v1/transfers` surface.

### Lending

The lending domain includes products, simulations, applications, offers, contracts, installments and installment payment. The proposal flow uses the Python scoring service through gRPC.

### Fees and Pricing

Fees are calculated and posted as separate ledger entries. The model includes fee schedules, pricing rules, fee charges and reversals.

### Sandbox Rails

Pix keys/charges, Boletos, Card Products, Cards and Card Authorizations exist as deterministic sandbox flows. They help test product modeling and events without claiming real integration.

### Events and Webhooks

Domain events are persisted and can feed outbox delivery. Webhook endpoints have secrets, subscribed event lists and persistent deliveries. Deliveries store status, attempts, status code, duration, error and truncated response body.

### Reconciliation and Reports

Reconciliation compares entry totals and money movement totals for a period, records a run and item, and exposes balance, reconciliation and outbox reports.

### Compliance

Compliance covers customer export, restricted anonymization, compliance requests and data retention policies. The project does not claim real KYC/KYB provider coverage.

---

## Public API snapshot

Operational:

- `GET /health`
- `GET /ready`
- `GET /metrics`
- `GET /openapi.json`

Auth:

- `POST /v1/auth/login`
- `POST /v1/auth/refresh`
- `POST /v1/auth/logout`
- `GET /v1/auth/me`

Tenant and API keys:

- `GET /v1/tenant`
- `POST /v1/api-keys`
- `GET /v1/api-keys`
- `POST /v1/api-keys/:id/revoke`
- `POST /v1/api-keys/:id/rotate`

Customers:

- `POST /v1/customers`
- `GET /v1/customers`
- `GET /v1/customers/:id`
- `PATCH /v1/customers/:id`
- `POST /v1/customers/:id/verify`
- `POST /v1/customers/:id/block`
- `POST /v1/customers/:id/archive`
- `POST /v1/customers/:id/anonymize`
- `GET /v1/customers/:id/export`
- `POST /v1/customers/:id/consents`
- `GET /v1/customers/:id/consents`

Accounts:

- `POST /v1/accounts`
- `GET /v1/accounts`
- `GET /v1/accounts/:id`
- `GET /v1/accounts/:id/balance`
- `GET /v1/accounts/:id/entries`
- `GET /v1/accounts/:id/transactions`
- `POST /v1/accounts/:id/freeze`
- `POST /v1/accounts/:id/unfreeze`
- `POST /v1/accounts/:id/close`
- `GET /v1/accounts/:id/limits`
- `PATCH /v1/accounts/:id/limits`
- `POST /v1/accounts/:id/statements`
- `GET /v1/accounts/:id/statements`
- `GET /v1/statements/:id`

Financial accounts and holds:

- `POST /v1/financial-accounts`
- `GET /v1/financial-accounts`
- `POST /v1/holds`
- `GET /v1/holds`
- `POST /v1/holds/:id/release`
- `POST /v1/holds/:id/capture`

Ledger:

- `POST /v1/transactions`
- `GET /v1/transactions`
- `GET /v1/transactions/:id`
- `POST /v1/transactions/:id/reverse`

Money movement:

- `POST /v1/transfers`
- `GET /v1/transfers`
- `GET /v1/transfers/:id`
- `POST /v1/deposits`
- `POST /v1/withdrawals`
- `POST /v1/payments`
- `POST /v1/internal-transfers`
- `POST /v1/inbound-transfers`
- `POST /v1/outbound-transfers`
- `POST /v1/refunds`
- `GET /v1/money-movements`
- `GET /v1/money-movements/:id`
- `POST /v1/money-movements/:id/approve`
- `POST /v1/money-movements/:id/fail`
- `POST /v1/money-movements/:id/return`
- `POST /v1/money-movements/:id/cancel`

Instruments and pricing:

- `POST /v1/external-accounts`
- `GET /v1/external-accounts`
- `POST /v1/external-accounts/:id/verify`
- `POST /v1/payment-methods`
- `GET /v1/payment-methods`
- `POST /v1/fee-schedules`
- `GET /v1/fee-schedules`
- `POST /v1/pricing-rules`
- `GET /v1/pricing-rules`
- `POST /v1/fees`
- `GET /v1/fees`
- `POST /v1/fees/:id/reverse`

Sandbox rails:

- `POST /v1/pix/keys`
- `GET /v1/pix/keys`
- `POST /v1/pix/charges`
- `GET /v1/pix/charges`
- `POST /v1/boletos`
- `GET /v1/boletos`
- `POST /v1/card-products`
- `GET /v1/card-products`
- `POST /v1/cards`
- `GET /v1/cards`
- `POST /v1/card-authorizations`
- `GET /v1/card-authorizations`

Lending:

- `POST /v1/lending/proposals`
- `GET /v1/lending/proposals`
- `GET /v1/lending/proposals/:id`
- `POST /v1/lending/products`
- `GET /v1/lending/products`
- `POST /v1/lending/simulations`
- `POST /v1/lending/applications`
- `GET /v1/lending/applications`
- `GET /v1/lending/offers`
- `POST /v1/lending/offers/:id/accept`
- `GET /v1/lending/contracts`
- `GET /v1/lending/contracts/:id/installments`
- `POST /v1/lending/installments/:id/pay`

Events, audit, reconciliation and compliance:

- `POST /v1/webhook-endpoints`
- `GET /v1/webhook-endpoints`
- `POST /v1/webhook-endpoints/:id/rotate-secret`
- `GET /v1/webhook-deliveries`
- `POST /v1/webhook-deliveries/:id/retry`
- `POST /v1/webhook-test-events`
- `GET /v1/events`
- `GET /v1/audit-logs`
- `POST /v1/reconciliation-runs`
- `GET /v1/reconciliation-runs`
- `GET /v1/reconciliation-runs/:id/items`
- `GET /v1/reports/ledger-balances`
- `GET /v1/reports/reconciliation`
- `GET /v1/reports/outbox`
- `GET /v1/compliance-requests`
- `POST /v1/data-retention-policies`
- `GET /v1/data-retention-policies`

---

## Local startup

```bash
cd infra
docker compose up --build -d
```

Surfaces:

- API: `http://localhost:5000/v1`
- OpenAPI: `http://localhost:5000/openapi.json`
- Client Web: `http://localhost:5173`
- Metrics: `http://localhost:5000/metrics`
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3000`
- Jaeger: `http://localhost:16686`
- RabbitMQ: `http://localhost:15672`

Development credentials:

```text
x-api-key: dev-api-key
email: admin@example.com
password: dev-password
```

---

## Local validation

Core API:

```bash
cd service-api/service-typescript
npm run typecheck
npm test
npm run build
npm run format:check
```

Client Web:

```bash
cd client-web
npm run typecheck
npm run build
```

Scoring:

```bash
cd service-api/service-python
../../.venv/bin/python -m ruff check .
../../.venv/bin/python -m mypy src tests
../../.venv/bin/python -m pytest
../../.venv/bin/python scripts/check_grpc_generated.py
```

Repository and infra:

```bash
./scripts/sql-lint.sh
./scripts/secret-scan.sh
cd infra && docker compose config
```

---

## What is not being claimed

- No real Pix integration.
- No real Boleto integration.
- No real Card Issuing integration.
- No external KYC/KYB provider integration.
- No real banking settlement.
- No reconciliation against real provider statements.
- No regulatory compliance guarantee.
- No production end-user frontend; the current frontend is a technical console.

These points matter because documentation must match code. The API already has a broad financial foundation, and provider-backed integrations with certificates, contracts, keys, homologation and regulatory rules belong to provider/integration scope rather than to the sandbox rails documented here.

---

## License

MIT. See [LICENSE](LICENSE).

---

## Contact

**Thiago DI Faria** - thiagodifaria@gmail.com

[GitHub](https://github.com/thiagodifaria)  
[LinkedIn](https://linkedin.com/in/thiagodifaria)
