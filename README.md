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

## Documentation / Documentacao

**README detalhado em Portugues:** [README_PT.md](README_PT.md)  
**Detailed English README:** [README_EN.md](README_EN.md)  
**API Reference:** [docs/API.md](docs/API.md)  
**Architecture Reference:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)  
**Observability Reference:** [docs/OBSERVABILITY.md](docs/OBSERVABILITY.md)  
**Local Guide:** [docs/GUIDE.md](docs/GUIDE.md)  
**Free Demo Deployment:** [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

---

## What is FinancialAPI?

FinancialAPI is a backend-first fintech platform that exposes a versioned HTTP API under `/v1`, a Python gRPC credit scoring service, a PostgreSQL ledger database, a Redis idempotency layer, a RabbitMQ outbox pipeline, Prometheus/Grafana observability and a dedicated React client web.

The project is intentionally scoped as a general fintech/financial API foundation. It covers customer records, tenant API keys, human auth, financial accounts, ledger accounts, balances, holds, double-entry transactions, transfers, deposits, withdrawals, payments, lending, fees, webhooks, reconciliation, compliance-oriented data operations and sandbox rails.

The sandbox rails for Pix, Boleto and Card Issuing are deterministic development helpers. They are not presented as real banking integrations. Their job is to exercise ledger, audit, webhook, reconciliation and developer flows without pretending to connect to a provider.

---

## Current Scope

- TypeScript/Hono core API running on Node.js.
- Python gRPC scoring service with deterministic policy logic.
- PostgreSQL 17 storage with versioned migrations and Row Level Security posture.
- Redis-backed idempotency for sensitive create/movement operations.
- RabbitMQ/outbox event publication and webhook delivery tracking.
- Prometheus metrics, Grafana dashboards and Jaeger tracing hooks.
- React/Vite `client-web` for documentation, operations and endpoint testing.
- TypeScript and Python SDK examples in `packages/`.

---

## Quick Start

```bash
cd infra
docker compose up --build -d
```

Useful local URLs:

| Surface | URL |
|---------|-----|
| Core API | `http://localhost:5000/v1` |
| OpenAPI | `http://localhost:5000/openapi.json` |
| Health | `http://localhost:5000/health` |
| Readiness | `http://localhost:5000/ready` |
| Metrics | `http://localhost:5000/metrics` |
| Client Web | `http://localhost:5173` |
| Prometheus | `http://localhost:9090` |
| Grafana | `http://localhost:3000` |
| Jaeger | `http://localhost:16686` |
| RabbitMQ UI | `http://localhost:15672` |

Development credentials:

```text
x-api-key: dev-api-key
email: admin@example.com
password: dev-password
```

---

## Main Modules

| Module | What it owns |
|--------|--------------|
| Auth and tenant access | API keys, tenant resolution, human login, sessions and refresh/logout |
| Customers | Individuals/businesses, status transitions, consents, export and anonymization |
| Accounts | Ledger accounts, financial accounts, balances, holds, limits and statements |
| Ledger | Double-entry transactions, entries, reversals and minor-unit money handling |
| Money movement | Transfers, deposits, withdrawals, payments, refunds and inbound/outbound flows |
| Lending | Products, simulations, applications, offers, contracts, installments and scoring |
| Rails sandbox | Pix keys/charges, Boleto issuance and card issuing simulation helpers |
| Fees and pricing | Fee schedules, pricing rules, fee charges and fee reversals |
| Webhooks/events | Event listing, endpoint registration, delivery persistence, retry and signing |
| Reconciliation | Reconciliation runs, items, ledger balance reports and outbox reports |
| Compliance | Customer export, anonymization and data retention policies |
| Developer platform | OpenAPI, client web, SDK examples and local operational scripts |

---

## Local Validation

Core API:

```bash
cd service-api/service-typescript
npm run typecheck
npm test
npm run build
npm run format:check
```

Client web:

```bash
cd client-web
npm run typecheck
npm run build
```

Python scoring:

```bash
cd service-api/service-python
../../.venv/bin/python -m ruff check .
../../.venv/bin/python -m mypy src tests
../../.venv/bin/python -m pytest
../../.venv/bin/python scripts/check_grpc_generated.py
```

Repository checks:

```bash
./scripts/sql-lint.sh
./scripts/secret-scan.sh
cd infra && docker compose config
```

---

## Contact

**Thiago DI Faria** - thiagodifaria@gmail.com

[![GitHub](https://img.shields.io/badge/GitHub-@thiagodifaria-black?style=flat&logo=github)](https://github.com/thiagodifaria)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Thiago_DI_Faria-blue?style=flat&logo=linkedin)](https://linkedin.com/in/thiagodifaria)

---

## License

Licensed under the [MIT License](LICENSE).
