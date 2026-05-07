# FinancialAPI

![FinancialAPI](https://img.shields.io/badge/FinancialAPI-API-111827?style=for-the-badge&logo=github&logoColor=white)

**API fintech multi-tenant para ledger, wallets, money movement, lending, webhooks, reconciliacao e operacao financeira**

[![TypeScript](https://img.shields.io/badge/TypeScript-core%20api-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-credit%20scoring-3776AB?style=flat&logo=python&logoColor=white)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-client%20web-61DAFB?style=flat&logo=react&logoColor=111827)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-ledger%20storage-316192?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-idempotency-DC382D?style=flat&logo=redis&logoColor=white)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-local%20stack-2496ED?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-success?style=flat)](LICENSE)

---

## Documentacao

**Visao geral resumida:** [README.md](README.md)  
**Read in English:** [README_EN.md](README_EN.md)  
**API Reference:** [docs/API.md](docs/API.md)  
**Architecture Reference:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)  
**Observability Reference:** [docs/OBSERVABILITY.md](docs/OBSERVABILITY.md)  
**Local Guide:** [docs/GUIDE.md](docs/GUIDE.md)  
**Free Demo Deployment:** [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

---

## O que e o FinancialAPI?

FinancialAPI e uma plataforma backend-first para produtos financeiros. O repositorio combina uma API HTTP versionada em TypeScript/Hono, um microservico Python de scoring via gRPC, PostgreSQL para ledger e dados transacionais, Redis para idempotencia, RabbitMQ para outbox/eventos, Prometheus/Grafana/Jaeger para observabilidade e um frontend React dedicado para exploracao da API.

O objetivo do projeto e representar uma base geral para fintech/financeiro sem reduzir o dominio a um CRUD bancario simples. O escopo atual cobre cadastro de customers, autenticacao humana, API keys de tenant, contas financeiras, contas de ledger, saldos, holds, limites, statements, transacoes double-entry, reversals, transfers, deposits, withdrawals, payments, lending, fees, webhooks, reconciliacao, compliance operacional e rails sandbox.

O ponto mais importante de honestidade tecnica e separar o que e real do que e sandbox. Ledger, idempotencia, migrations, auth, outbox, webhook delivery, reconciliation, scoring deterministico e persistencia sao partes reais do projeto. Pix, Boleto e Card Issuing neste estado sao helpers sandbox deterministicos para exercitar fluxos de desenvolvimento, e nao integracoes bancarias/provedores reais.

---

## Estado atual do MVP

Hoje o projeto ja inclui:

- API HTTP em `/v1` com rotas de plataforma financeira.
- OpenAPI disponivel em `/openapi.json`.
- Health, readiness e metrics em rotas publicas.
- Login humano com sessao e refresh/logout.
- API keys com rotacao, revogacao e resolucao de tenant.
- Customers pessoa fisica/juridica com status, update, verify, block, archive, consent, export e anonymize.
- Financial accounts e ledger accounts separados.
- Balances com ledger/current, available e pending/holds.
- Ledger double-entry com transactions e entries.
- Reversal generico de transaction.
- Transfers internos e money movements.
- Deposits, withdrawals, payments, internal/inbound/outbound transfers e refunds.
- External accounts e payment methods.
- Account limits, account status transitions e statements.
- Loan products, simulations, applications, offers, contracts e installments.
- Scoring via gRPC Python com politica deterministica.
- Fee schedules, pricing rules, fee charges e reversal de fee.
- Pix/Boleto/Card sandbox para simulacao de dominio.
- Webhook endpoints, events, webhook deliveries, retry manual e test events.
- Outbox publisher com RabbitMQ.
- Reconciliation runs, items e reports.
- Data retention policies e compliance requests.
- Audit logs para comandos via middleware.
- Client-web React para testar endpoints reais.
- SDK TypeScript simples e SDK Python leve.

---

## Por que o projeto existe

O projeto existe como referencia tecnica de uma API financeira modular. Ele nao tenta ser banco completo, core bancario homologado, PSP, emissor de cartao real ou integracao Pix/Boleto real. O objetivo e mostrar como estruturar uma plataforma financeira com fronteiras de dominio, precisao monetaria, isolamento de tenant, ledger imutavel, observabilidade, idempotencia e DX suficiente para evoluir com seguranca.

A ideia central e tratar dinheiro como dado critico:

- valores financeiros ficam em minor units;
- JSON expoe dinheiro como string inteira;
- o dominio usa `bigint` no TypeScript;
- novas entidades usam UUIDv7;
- ledger e audit sao insert-only por principio;
- movimentacoes sensiveis usam idempotencia;
- o tenant e resolvido antes das rotas `/v1`;
- queries de repositorio aplicam contexto de tenant para RLS;
- operacao publica precisa expor health, readiness e metrics.

---

## Arquitetura em alto nivel

A plataforma esta separada em superficies claras:

| Area | Caminho | Responsabilidade |
|------|---------|------------------|
| Core API | `service-api/service-typescript` | API HTTP, use cases, repositorios, OpenAPI, metrics, outbox |
| Scoring | `service-api/service-python` | Motor gRPC de decisao de credito |
| Database | `service-api/service-postgresql` | PostgreSQL config e migrations versionadas |
| Proto | `service-api/data/proto` | Contrato gRPC entre TypeScript e Python |
| Client Web | `client-web` | Console React para docs, operacao e API Explorer |
| Infra | `infra` | Docker Compose, Prometheus, Grafana, RabbitMQ, Jaeger |
| SDKs | `packages` | Clientes TypeScript e Python |
| Scripts | `scripts` | Secret scan e SQL lint |
| Docs | `docs` | API, arquitetura, observabilidade e guia local |

O bootstrap da API fica em `src/index.ts`. Ele inicia telemetria, aplica migrations quando `RUN_MIGRATIONS=true`, usa cluster de workers e registra shutdown. A montagem HTTP fica em `src/infrastructure/http/server.ts`, e o wiring de dependencias fica em `src/infrastructure/http/composition-root.ts`.

Essa divisao evita que bootstrap, HTTP, use cases, repositorios e dominios se misturem no mesmo arquivo. O padrao foi inspirado na leitura do `server.go` do projeto PRIMME: servidor explicito, composition root claro, rotas agrupadas, middlewares transversais e bootstrap enxuto.

---

## Stack e racional tecnico

| Tecnologia | Uso | Motivo |
|------------|-----|--------|
| TypeScript | Core API | Tipagem estrutural, produtividade e bom encaixe com Hono |
| Hono | HTTP server | API leve, simples e compativel com middlewares enxutos |
| PostgreSQL | Ledger e dados transacionais | Consistencia, RLS, constraints, JSONB e transacoes |
| Redis | Idempotencia | Reserva atomica de chave e resposta cacheada |
| RabbitMQ | Eventos/outbox | Pipeline local de eventos e webhooks |
| Python | Scoring | Regras de credito isoladas por contrato gRPC |
| gRPC | Core para scoring | Contrato tipado, deadline, metadata e erro controlado |
| React/Vite | Client web | Console rapido para testar a API real |
| Prometheus | Metrics | Sinais operacionais por rota e dominio |
| Grafana | Dashboard | Visualizacao operacional local |
| Jaeger/OTel | Tracing | Correlacao de request e spans |
| Docker Compose | Stack local | Reproducibilidade de Postgres, Redis, RabbitMQ, API, scoring e observabilidade |

---

## Modulos de produto

### Auth e Tenant

O acesso machine-to-machine acontece por `x-api-key`. Essa chave resolve o tenant e passa pelo middleware de tenant antes das rotas `/v1`. Login humano e separado e retorna sessao/refresh token para usuarios do tenant.

### Customers

Customers podem representar pessoa fisica ou juridica. O modulo suporta criacao, listagem, consulta, update, verificacao, bloqueio, arquivamento, consentimentos, exportacao e anonimizacao restrita.

### Accounts e Wallets

O projeto separa `financial_accounts` de `accounts`. A conta de ledger carrega direcao, saldo, status e metadata. A financial account representa a relacao de produto/wallet com customer.

### Ledger

Transactions e entries seguem partida dobrada. O codigo valida que a soma de debitos fecha com a soma de creditos. Reversals criam lancamentos compensatorios em vez de alterar historico financeiro.

### Money Movement

Money movement representa intencoes ou objetos operacionais de movimento: deposit, withdrawal, payment, internal transfer, inbound transfer, outbound transfer e refund. Transfers internos tambem possuem uma superficie simplificada em `/v1/transfers`.

### Lending

O dominio de lending inclui produtos, simulacoes, applications, offers, contracts, installments e pagamento de installment. O fluxo de proposta usa o scoring Python via gRPC.

### Fees e Pricing

Fees sao calculadas e cobradas como entries separadas no ledger. Existem fee schedules, pricing rules, fee charges e reversals.

### Rails sandbox

Pix keys/charges, Boletos, Card Products, Cards e Card Authorizations existem como sandbox deterministico. Eles ajudam a testar a modelagem de produto e eventos sem declarar integracao real.

### Events e Webhooks

Eventos de dominio sao persistidos e podem alimentar outbox. Webhook endpoints possuem segredo, eventos inscritos e entregas persistentes. Deliveries guardam status, tentativas, status code, duracao, erro e body truncado.

### Reconciliation e Reports

Reconciliation compara totais de entries e money movements em um periodo, registra run e item, e expoe reports de balances, reconciliation e outbox.

### Compliance

Compliance cobre export de customer, anonymize restrito, requests de compliance e data retention policies. O projeto nao promete KYC/KYB real; ele modela status e operacoes administrativas.

---

## API snapshot

Rotas operacionais:

- `GET /health`
- `GET /ready`
- `GET /metrics`
- `GET /openapi.json`

Auth:

- `POST /v1/auth/login`
- `POST /v1/auth/refresh`
- `POST /v1/auth/logout`
- `GET /v1/auth/me`

Tenant e API keys:

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

Financial accounts e holds:

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

Instruments e pricing:

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

Rails sandbox:

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

Events, audit, reconciliation e compliance:

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

## Como iniciar localmente

```bash
cd infra
docker compose up --build -d
```

Superficies:

- API: `http://localhost:5000/v1`
- OpenAPI: `http://localhost:5000/openapi.json`
- Client Web: `http://localhost:5173`
- Metrics: `http://localhost:5000/metrics`
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3000`
- Jaeger: `http://localhost:16686`
- RabbitMQ: `http://localhost:15672`

Credenciais de desenvolvimento:

```text
x-api-key: dev-api-key
email: admin@example.com
password: dev-password
```

---

## Validacao local

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

Infra e repositorio:

```bash
./scripts/sql-lint.sh
./scripts/secret-scan.sh
cd infra && docker compose config
```

---

## O que nao esta sendo prometido

- Nao ha integracao Pix real.
- Nao ha integracao Boleto real.
- Nao ha integracao Card Issuing real.
- Nao ha KYC/KYB externo real.
- Nao ha liquidacao bancaria real.
- Nao ha conciliacao com extrato de provedor externo real.
- Nao ha garantia de conformidade regulatoria.
- Nao ha frontend de producao para usuario final; existe console tecnico.

Esses pontos sao importantes porque a documentacao do projeto deve refletir o codigo. A API ja tem uma base financeira ampla, e integracoes externas com providers, certificados, contratos, chaves, homologacao e regras reguladoras pertencem ao escopo de integracao/provider, nao ao sandbox documentado aqui.

---

## Licenca

MIT. Veja [LICENSE](LICENSE).

---

## Contato

**Thiago DI Faria** - thiagodifaria@gmail.com

[GitHub](https://github.com/thiagodifaria)  
[LinkedIn](https://linkedin.com/in/thiagodifaria)
