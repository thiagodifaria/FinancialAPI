# Local Guide

This guide explains how to run, inspect, validate and extend FinancialAPI locally. It is practical documentation for operating the repository as it exists today.

---

## 1. Requirements

Recommended local tools:

- Docker
- Docker Compose
- Node.js 24+
- npm
- Python with the local `.venv` already available in this workspace
- `curl`
- `jq`
- `rg`

The local stack is container-first for infrastructure and backend runtime. Direct local commands are still useful for typecheck, tests and build.

---

## 2. Start the Stack

```bash
cd infra
docker compose up --build -d
```

Services started:

- PostgreSQL
- Redis
- RabbitMQ
- TypeScript core API
- Python scoring engine
- Prometheus
- Grafana
- Jaeger

Expected local URLs:

| Service | URL |
|---------|-----|
| API | `http://localhost:5000` |
| Versioned API | `http://localhost:5000/v1` |
| OpenAPI | `http://localhost:5000/openapi.json` |
| Metrics | `http://localhost:5000/metrics` |
| Prometheus | `http://localhost:9090` |
| Grafana | `http://localhost:3000` |
| Jaeger | `http://localhost:16686` |
| RabbitMQ UI | `http://localhost:15672` |

---

## 3. Run Client Web

The frontend is a dedicated React/Vite app.

```bash
cd client-web
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

Client-web behavior:

- Configure Base URL.
- Configure API key.
- Configure bearer token after login.
- Open docs.
- Use operations view.
- Use API Explorer.
- Test endpoints with simple mode.
- Edit JSON manually.
- Use ready JSON payloads.
- Inspect responses.
- Capture returned IDs for later requests.

---

## 4. Development Credentials

Default development values:

```text
x-api-key: dev-api-key
email: admin@example.com
password: dev-password
tenant_id: 0194fd70-0000-7000-8000-000000000001
loan_funding_account_id: 0194fd70-0000-7000-8000-000000000101
```

These values are for local development and seeded data. They are not production secrets.

---

## 5. Basic Health Checks

```bash
curl http://localhost:5000/health
curl http://localhost:5000/ready
curl http://localhost:5000/openapi.json | jq '.info'
curl http://localhost:5000/metrics | head
```

Expected:

- health returns success;
- readiness returns success when dependencies are available;
- OpenAPI returns version `1.0.0`;
- metrics returns Prometheus text.

---

## 6. Environment Variables

Common core API variables:

| Variable | Purpose |
|----------|---------|
| `PORT` | API port, default `5000`. |
| `WEB_CONCURRENCY` | Number of Node workers. |
| `RUN_MIGRATIONS` | Runs migrations on startup when true. |
| `DB_HOST` | PostgreSQL host. |
| `DB_PORT` | PostgreSQL port. |
| `DB_NAME` | Database name. |
| `DB_USER` | Runtime database user. |
| `DB_PASSWORD` | Runtime database password. |
| `REDIS_HOST` | Redis host. |
| `REDIS_PORT` | Redis port. |
| `RABBITMQ_HOST` | RabbitMQ host. |
| `SCORING_ENGINE_HOST` | gRPC scoring host. |
| `SCORING_ENGINE_PORT` | gRPC scoring port. |
| `SCORING_ENGINE_TIMEOUT_MS` | Scoring request deadline. |
| `SCORING_ENGINE_RETRIES` | Transient retry count. |
| `SCORING_FAILURE_POLICY` | `closed` or `sandbox_controlled`. |
| `OTEL_ENABLED` | Enables telemetry. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP target. |
| `CORS_ORIGIN` | Allowed browser origin. |

Common client web variables:

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | Default API base URL for the console. |

---

## 7. Local Validation Commands

Core API:

```bash
cd service-api/service-typescript
npm install
npm run typecheck
npm test
npm run build
npm run format:check
```

Client web:

```bash
cd client-web
npm install
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

Repo checks:

```bash
./scripts/sql-lint.sh
./scripts/secret-scan.sh
cd infra && docker compose config
```

Prometheus config:

```bash
cd infra
docker run --rm --entrypoint promtool \
  -v "$PWD/prometheus:/etc/prometheus:ro" \
  prom/prometheus:v2.55.1 \
  check config /etc/prometheus/prometheus.yml
```

---

## 8. First API Calls

Set variables:

```bash
API=http://localhost:5000
KEY=dev-api-key
```

Login:

```bash
curl -X POST "$API/v1/auth/login" \
  -H "content-type: application/json" \
  -H "x-api-key: $KEY" \
  -d '{"email":"admin@example.com","password":"dev-password"}'
```

Tenant:

```bash
curl "$API/v1/tenant" -H "x-api-key: $KEY"
```

OpenAPI:

```bash
curl "$API/openapi.json" | jq '.paths | keys'
```

---

## 9. Customer Flow

Create customer:

```bash
CUSTOMER=$(curl -sS -X POST "$API/v1/customers" \
  -H "content-type: application/json" \
  -H "x-api-key: $KEY" \
  -d '{"type":"individual","name":"Ada Lovelace","email":"ada@example.com","metadata":{"source":"guide"}}' | jq -r .id)
```

Verify:

```bash
curl -X POST "$API/v1/customers/$CUSTOMER/verify" \
  -H "x-api-key: $KEY"
```

Consent:

```bash
curl -X POST "$API/v1/customers/$CUSTOMER/consents" \
  -H "content-type: application/json" \
  -H "x-api-key: $KEY" \
  -d '{"type":"terms","version":"2026-05","accepted":true}'
```

Export:

```bash
curl "$API/v1/customers/$CUSTOMER/export" \
  -H "x-api-key: $KEY"
```

---

## 10. Account and Deposit Flow

Create account:

```bash
ACCOUNT=$(curl -sS -X POST "$API/v1/accounts" \
  -H "content-type: application/json" \
  -H "x-api-key: $KEY" \
  -d "{\"name\":\"Ada Wallet\",\"direction\":\"credit\",\"customer_id\":\"$CUSTOMER\",\"balance_minor\":\"0\"}" | jq -r .id)
```

Deposit:

```bash
curl -X POST "$API/v1/deposits" \
  -H "content-type: application/json" \
  -H "x-api-key: $KEY" \
  -H "x-idempotency-key: deposit-guide-001" \
  -d "{\"destination_account_id\":\"$ACCOUNT\",\"amount_minor\":\"10000\",\"description\":\"Guide deposit\"}"
```

Balance:

```bash
curl "$API/v1/accounts/$ACCOUNT/balance" \
  -H "x-api-key: $KEY"
```

Entries:

```bash
curl "$API/v1/accounts/$ACCOUNT/entries" \
  -H "x-api-key: $KEY"
```

Transactions:

```bash
curl "$API/v1/accounts/$ACCOUNT/transactions" \
  -H "x-api-key: $KEY"
```

---

## 11. Hold Flow

Create hold:

```bash
HOLD=$(curl -sS -X POST "$API/v1/holds" \
  -H "content-type: application/json" \
  -H "x-api-key: $KEY" \
  -d "{\"account_id\":\"$ACCOUNT\",\"amount_minor\":\"2500\",\"reason\":\"Guide hold\"}" | jq -r .id)
```

Check balance:

```bash
curl "$API/v1/accounts/$ACCOUNT/balance" \
  -H "x-api-key: $KEY"
```

Release hold:

```bash
curl -X POST "$API/v1/holds/$HOLD/release" \
  -H "x-api-key: $KEY"
```

---

## 12. Ledger Transaction Flow

Manual transaction:

```bash
curl -X POST "$API/v1/transactions" \
  -H "content-type: application/json" \
  -H "x-api-key: $KEY" \
  -H "x-idempotency-key: transaction-guide-001" \
  -d '{
    "description":"Manual guide transaction",
    "entries":[
      {"account_id":"0194fd70-0000-7000-8000-000000000101","direction":"debit","amount_minor":"1000"},
      {"account_id":"'"$ACCOUNT"'","direction":"credit","amount_minor":"1000"}
    ],
    "metadata":{"source":"guide"}
  }'
```

Important:

- Debit total must equal credit total.
- Use minor-unit strings.
- Use idempotency for retries.
- Do not reuse idempotency keys with different bodies.

---

## 13. Money Movement Flow

Payment:

```bash
MOVEMENT=$(curl -sS -X POST "$API/v1/payments" \
  -H "content-type: application/json" \
  -H "x-api-key: $KEY" \
  -H "x-idempotency-key: payment-guide-001" \
  -d "{\"source_account_id\":\"$ACCOUNT\",\"amount_minor\":\"1500\",\"description\":\"Guide payment\"}" | jq -r .id)
```

Fail movement:

```bash
curl -X POST "$API/v1/money-movements/$MOVEMENT/fail" \
  -H "x-api-key: $KEY"
```

List movements:

```bash
curl "$API/v1/money-movements" \
  -H "x-api-key: $KEY"
```

---

## 14. External Account and Payment Method Flow

Create external account:

```bash
EXTERNAL=$(curl -sS -X POST "$API/v1/external-accounts" \
  -H "content-type: application/json" \
  -H "x-api-key: $KEY" \
  -d "{\"customer_id\":\"$CUSTOMER\",\"holder_name\":\"Ada Lovelace\",\"institution_name\":\"Sandbox Bank\",\"account_number\":\"123456789\"}" | jq -r .id)
```

Verify external account:

```bash
curl -X POST "$API/v1/external-accounts/$EXTERNAL/verify" \
  -H "x-api-key: $KEY"
```

Create payment method:

```bash
curl -X POST "$API/v1/payment-methods" \
  -H "content-type: application/json" \
  -H "x-api-key: $KEY" \
  -d "{\"customer_id\":\"$CUSTOMER\",\"external_account_id\":\"$EXTERNAL\",\"type\":\"bank_account\",\"label\":\"Sandbox account\"}"
```

---

## 15. Limits and Statements Flow

Set limits:

```bash
curl -X PATCH "$API/v1/accounts/$ACCOUNT/limits" \
  -H "content-type: application/json" \
  -H "x-api-key: $KEY" \
  -d '{"daily_limit_minor":"100000","monthly_limit_minor":"1000000","per_transaction_limit_minor":"50000","currency":"BRL"}'
```

Get limits:

```bash
curl "$API/v1/accounts/$ACCOUNT/limits" \
  -H "x-api-key: $KEY"
```

Create statement:

```bash
STATEMENT=$(curl -sS -X POST "$API/v1/accounts/$ACCOUNT/statements" \
  -H "content-type: application/json" \
  -H "x-api-key: $KEY" \
  -d '{"period_start":"2026-05-01","period_end":"2026-05-31"}' | jq -r .id)
```

Get statement:

```bash
curl "$API/v1/statements/$STATEMENT" \
  -H "x-api-key: $KEY"
```

---

## 16. Lending Flow

List products:

```bash
curl "$API/v1/lending/products" \
  -H "x-api-key: $KEY"
```

Simulate:

```bash
curl -X POST "$API/v1/lending/simulations" \
  -H "content-type: application/json" \
  -H "x-api-key: $KEY" \
  -d '{"amount_minor":"50000","installments":6,"annual_interest_bps":2400}'
```

Create proposal with scoring:

```bash
curl -X POST "$API/v1/lending/proposals" \
  -H "content-type: application/json" \
  -H "x-api-key: $KEY" \
  -H "x-idempotency-key: lending-guide-001" \
  -d "{\"account_id\":\"$ACCOUNT\",\"requested_amount_minor\":\"50000\"}"
```

Operational notes:

- The TypeScript API calls Python scoring through gRPC.
- Scoring requires metadata.
- The default failure mode is fail-closed.
- The sandbox-controlled failure mode must be explicit.

---

## 17. Fee Flow

Create fee schedule:

```bash
SCHEDULE=$(curl -sS -X POST "$API/v1/fee-schedules" \
  -H "content-type: application/json" \
  -H "x-api-key: $KEY" \
  -d '{"name":"Guide fee","product":"wallet","rail":"internal","fixed_amount_minor":"100","percent_bps":0,"min_amount_minor":"0","status":"active"}' | jq -r .id)
```

Charge fee:

```bash
FEE=$(curl -sS -X POST "$API/v1/fees" \
  -H "content-type: application/json" \
  -H "x-api-key: $KEY" \
  -H "x-idempotency-key: fee-guide-001" \
  -d "{\"fee_schedule_id\":\"$SCHEDULE\",\"account_id\":\"$ACCOUNT\",\"amount_minor\":\"100\"}" | jq -r .id)
```

Reverse fee:

```bash
curl -X POST "$API/v1/fees/$FEE/reverse" \
  -H "x-api-key: $KEY" \
  -H "x-idempotency-key: fee-reversal-guide-001"
```

---

## 18. Sandbox Rail Flow

Pix key:

```bash
curl -X POST "$API/v1/pix/keys" \
  -H "content-type: application/json" \
  -H "x-api-key: $KEY" \
  -d "{\"customer_id\":\"$CUSTOMER\",\"key\":\"ada@example.com\",\"key_type\":\"email\"}"
```

Boleto:

```bash
curl -X POST "$API/v1/boletos" \
  -H "content-type: application/json" \
  -H "x-api-key: $KEY" \
  -d "{\"customer_id\":\"$CUSTOMER\",\"amount_minor\":\"25000\",\"due_date\":\"2026-06-10\"}"
```

Card product:

```bash
curl -X POST "$API/v1/card-products" \
  -H "content-type: application/json" \
  -H "x-api-key: $KEY" \
  -d '{"name":"Sandbox debit","type":"debit","metadata":{"source":"guide"}}'
```

Reminder:

- These are sandbox rails.
- They are not real provider integrations.
- Do not document them as live Pix/Boleto/Card issuing.

---

## 19. Webhook Flow

Create endpoint:

```bash
WEBHOOK=$(curl -sS -X POST "$API/v1/webhook-endpoints" \
  -H "content-type: application/json" \
  -H "x-api-key: $KEY" \
  -d '{"url":"https://example.com/webhooks/financial-api","events":["*"]}')
```

Create test event:

```bash
curl -X POST "$API/v1/webhook-test-events" \
  -H "x-api-key: $KEY"
```

List events:

```bash
curl "$API/v1/events" \
  -H "x-api-key: $KEY"
```

List deliveries:

```bash
curl "$API/v1/webhook-deliveries" \
  -H "x-api-key: $KEY"
```

Retry delivery:

```bash
curl -X POST "$API/v1/webhook-deliveries/<DELIVERY_ID>/retry" \
  -H "x-api-key: $KEY"
```

---

## 20. Reconciliation Flow

Create reconciliation run:

```bash
RUN=$(curl -sS -X POST "$API/v1/reconciliation-runs" \
  -H "content-type: application/json" \
  -H "x-api-key: $KEY" \
  -d '{"period_start":"2026-05-01","period_end":"2026-05-31"}' | jq -r .id)
```

List items:

```bash
curl "$API/v1/reconciliation-runs/$RUN/items" \
  -H "x-api-key: $KEY"
```

Reports:

```bash
curl "$API/v1/reports/ledger-balances" -H "x-api-key: $KEY"
curl "$API/v1/reports/reconciliation" -H "x-api-key: $KEY"
curl "$API/v1/reports/outbox" -H "x-api-key: $KEY"
```

---

## 21. Compliance Flow

List requests:

```bash
curl "$API/v1/compliance-requests" \
  -H "x-api-key: $KEY"
```

Retention policy:

```bash
curl -X POST "$API/v1/data-retention-policies" \
  -H "content-type: application/json" \
  -H "x-api-key: $KEY" \
  -d '{"domain":"customers","retention_days":3650,"action":"retain"}'
```

Anonymize customer:

```bash
curl -X POST "$API/v1/customers/$CUSTOMER/anonymize" \
  -H "content-type: application/json" \
  -H "x-api-key: $KEY" \
  -d '{"reason":"Solicitacao LGPD em ambiente local"}'
```

Important:

- Financial history remains constrained by immutability requirements.
- Anonymization is not deletion of ledger records.
- Compliance behavior here is an application feature, not legal certification.

---

## 22. Database Work

Migrations:

```text
service-api/service-postgresql/migrations/001.sql
service-api/service-postgresql/migrations/002_financial_products.sql
service-api/service-postgresql/migrations/003_super_fintech_domains.sql
service-api/service-postgresql/migrations/004_reconciliation_webhooks_compliance.sql
```

Rules:

- Do not edit an applied migration without a strong reason.
- Add a new migration for new schema work.
- Keep names ordered with numeric prefixes.
- Run SQL lint after adding migrations.
- Avoid destructive SQL on critical tables.
- Keep RLS posture in mind for tenant tables.
- Runtime DB user should not behave like migration admin.

SQL lint:

```bash
./scripts/sql-lint.sh
```

---

## 23. Proto and gRPC Work

Proto file:

```text
service-api/data/proto/financial.proto
```

Generate/check Python stubs:

```bash
cd service-api/service-python
../../.venv/bin/python scripts/generate_grpc.py
../../.venv/bin/python scripts/check_grpc_generated.py
```

Rules:

- Do not leave empty generated stubs.
- Keep package versioned as `financial_api.scoring.v1`.
- Keep metadata fields mandatory in behavior.
- Keep TypeScript client deadlines.
- Retry only transient errors.
- Fail closed by default.

---

## 24. Documentation Work

When adding a feature:

- Update `docs/API.md` if endpoint behavior changes.
- Update `docs/ARCHITECTURE.md` if a boundary changes.
- Update `docs/OBSERVABILITY.md` if signals change.
- Update `docs/GUIDE.md` if local flows change.
- Update `README_PT.md` and `README_EN.md` for visible product scope changes.
- Update root `README.md` only for summarized public positioning.
- Update client-web docs and endpoint specs.
- Do not claim sandbox rails as real integrations.

---

## 25. Quality Gates

The project uses these gates as release discipline. They are not open tasks in this document; they describe the validation posture expected before publishing changes.

| Area | Gate |
|------|------|
| TypeScript core | Typecheck, tests, build and format check. |
| Client web | Typecheck and production build. |
| Python scoring | Ruff, mypy, pytest and generated gRPC verification. |
| SQL | Migration review and SQL lint where applicable. |
| Security | Secret scan and sensitive-log review. |
| Containers | Docker Compose config validation. |
| Observability | Prometheus config check when alerts or scrape config change. |
| Documentation | Public docs, frontend docs and endpoint specs stay aligned with behavior. |

---

## 26. Common Problems

### API key missing

Symptom:

- `/v1` route returns unauthorized.

Fix:

```bash
-H "x-api-key: dev-api-key"
```

### Money sent as number

Symptom:

- validation or precision issue.

Fix:

```json
{
  "amount_minor": "1000"
}
```

### Idempotency conflict

Symptom:

- same key reused with different payload.

Fix:

- use a new key for a new operation;
- reuse the same key only for the exact same retry.

### Scoring unavailable

Symptom:

- lending proposal fails closed.

Fix:

- check `scoring-engine`;
- check gRPC health;
- check `SCORING_ENGINE_HOST`;
- check `SCORING_ENGINE_PORT`.

### Webhook not delivered

Symptom:

- delivery remains failed or dead-letter.

Fix:

- inspect `GET /v1/webhook-deliveries`;
- check endpoint URL;
- check remote response;
- retry delivery if safe.

### Reconciliation difference

Symptom:

- reconciliation run reports difference.

Fix:

- inspect run items;
- compare entries and movement totals;
- inspect failed/returned/canceled movement states.

---

## 27. Final Local Review Before Sharing

Run:

```bash
cd service-api/service-typescript && npm run typecheck && npm test && npm run build && npm run format:check
cd ../../client-web && npm run typecheck && npm run build
cd ../service-api/service-python && ../../.venv/bin/python -m ruff check . && ../../.venv/bin/python -m mypy src tests && ../../.venv/bin/python -m pytest && ../../.venv/bin/python scripts/check_grpc_generated.py
cd ../.. && ./scripts/sql-lint.sh && ./scripts/secret-scan.sh
cd infra && docker compose config
```

Then review:

- root contains only product-relevant folders;
- `.cache` contains local/private planning artifacts;
- docs do not mention fake integrations;
- README uses neutral product language;
- MIT license has the correct author name;
- client-web still builds;
- OpenAPI still exposes current routes;
- Prometheus config still validates.
