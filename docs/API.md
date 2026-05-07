# API Reference

This document describes the public HTTP surface implemented by the TypeScript core API. It is written from the code in `service-api/service-typescript/src/infrastructure/http/routes`, the OpenAPI document in `openapi.ts`, the controllers and the repositories.

The API is versioned under `/v1`. Operational endpoints such as health, readiness, metrics and OpenAPI are public and live outside `/v1`.

---

## 1. API Principles

1. The API is tenant-aware.
2. Tenant access uses `x-api-key`.
3. Human login is separate from machine-to-machine API key access.
4. Financial money values are sent as integer strings.
5. Internal TypeScript money values use `bigint`.
6. New identifiers are generated as UUIDv7.
7. OpenAPI still represents UUIDv7 values as standard `format: uuid`.
8. Financial mutations should use `x-idempotency-key` when supported.
9. Ledger mutations are double-entry.
10. Reversals create compensating ledger records.
11. Audit records are generated for command-like routes.
12. Webhooks are persisted before delivery status is reported.
13. Sandbox rails are deterministic helpers, not real provider integrations.
14. List endpoints are intentionally capped in repository queries where implemented.
15. Errors are normalized by the HTTP error handler.

---

## 2. Base URLs

| Environment | URL |
|-------------|-----|
| Local API | `http://localhost:5000` |
| Versioned API | `http://localhost:5000/v1` |
| OpenAPI | `http://localhost:5000/openapi.json` |
| Health | `http://localhost:5000/health` |
| Readiness | `http://localhost:5000/ready` |
| Metrics | `http://localhost:5000/metrics` |

---

## 3. Common Headers

| Header | Required | Description |
|--------|----------|-------------|
| `content-type: application/json` | Request body only | Required for JSON payloads. |
| `x-api-key` | `/v1` routes | Resolves the tenant. Dev value is `dev-api-key`. |
| `authorization: Bearer <token>` | User-auth routes | Used after `POST /v1/auth/login`. |
| `x-idempotency-key` | Financial commands | Prevents unsafe duplicate processing. |
| `x-request-id` | Optional | Propagated or generated for correlation. |

---

## 4. Money Format

Financial values use minor units.

Examples:

| Human amount | Minor-unit JSON value |
|--------------|-----------------------|
| BRL 1.00 | `"100"` |
| BRL 10.50 | `"1050"` |
| BRL 100.00 | `"10000"` |
| Zero | `"0"` |

Rules:

- Use strings, not JSON numbers, for money.
- Do not send decimals in API fields named `amount_minor`.
- Do not send floating point values.
- Preserve sign semantics required by the endpoint.
- Use `MoneyUtils.fromMinorUnits` behavior as the mental model.
- Values are stored in PostgreSQL numeric/integer-like columns and converted to text for JSON.

---

## 5. Operational Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Liveness signal. |
| `GET` | `/ready` | Readiness signal for dependencies. |
| `GET` | `/metrics` | Prometheus text exposition. |
| `GET` | `/openapi.json` | OpenAPI 3.1 document. |

Operational notes:

- These routes are registered in `public.routes.ts`.
- They do not require `x-api-key`.
- `/metrics` is built by the in-memory Prometheus renderer.
- `/openapi.json` returns the static document exported from `openapi.ts`.
- Readiness should be used by orchestration, smoke checks and local diagnostics.

---

## 6. Authentication Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/v1/auth/login` | API key | Creates a human session. |
| `POST` | `/v1/auth/refresh` | API key | Refreshes a session. |
| `POST` | `/v1/auth/logout` | API key | Revokes/ends a session. |
| `GET` | `/v1/auth/me` | API key + bearer | Returns current user context. |

Login request:

```json
{
  "email": "admin@example.com",
  "password": "dev-password"
}
```

Design notes:

- API key access and human auth are separate.
- The tenant is still resolved by `x-api-key`.
- User auth uses bearer token when required.
- Login has dedicated rate-limit behavior in the security design.
- The client web captures access tokens after successful login.

---

## 7. Tenant and API Key Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/v1/tenant` | Returns the tenant resolved by the API key. |
| `POST` | `/v1/api-keys` | Creates an API key. |
| `GET` | `/v1/api-keys` | Lists tenant API keys. |
| `POST` | `/v1/api-keys/:id/revoke` | Revokes an API key. |
| `POST` | `/v1/api-keys/:id/rotate` | Rotates an API key. |

Implementation notes:

- Tenant resolution happens in `tenant-auth.middleware.ts`.
- API key operations are handled by `ApiKeyController`.
- API key storage and lookup live in `api-key.repository.ts`.
- Rotation returns a new secret once.
- Revoked keys must not be used for new requests.

---

## 8. Customer Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/v1/customers` | Creates an individual or business customer. |
| `GET` | `/v1/customers` | Lists customers. |
| `GET` | `/v1/customers/:id` | Fetches a customer. |
| `PATCH` | `/v1/customers/:id` | Updates mutable customer data. |
| `POST` | `/v1/customers/:id/verify` | Marks customer as verified. |
| `POST` | `/v1/customers/:id/block` | Blocks customer. |
| `POST` | `/v1/customers/:id/archive` | Archives customer. |
| `POST` | `/v1/customers/:id/anonymize` | Anonymizes customer data where allowed. |
| `GET` | `/v1/customers/:id/export` | Exports customer data. |
| `POST` | `/v1/customers/:id/consents` | Records customer consent. |
| `GET` | `/v1/customers/:id/consents` | Lists customer consents. |

Create example:

```json
{
  "type": "individual",
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "document": "00000000000",
  "metadata": {
    "source": "sandbox"
  }
}
```

Customer status model:

- `pending`
- `verified`
- `rejected`
- `blocked`
- `active`
- `archived`

Compliance notes:

- Anonymization is restricted because financial history cannot simply disappear.
- Export is operational data export, not a guarantee of legal completeness.
- The project models consent and retention surfaces but does not integrate external KYC/KYB providers.

---

## 9. Account and Wallet Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/v1/accounts` | Creates a ledger account. |
| `GET` | `/v1/accounts` | Lists ledger accounts. |
| `GET` | `/v1/accounts/:id` | Fetches a ledger account. |
| `GET` | `/v1/accounts/:id/balance` | Returns balance details. |
| `GET` | `/v1/accounts/:id/entries` | Lists entries for an account. |
| `GET` | `/v1/accounts/:id/transactions` | Lists transactions touching an account. |
| `POST` | `/v1/accounts/:id/freeze` | Freezes account movement. |
| `POST` | `/v1/accounts/:id/unfreeze` | Restores active account state. |
| `POST` | `/v1/accounts/:id/close` | Closes account operationally. |
| `GET` | `/v1/accounts/:id/limits` | Reads account limits. |
| `PATCH` | `/v1/accounts/:id/limits` | Updates account limits. |
| `POST` | `/v1/accounts/:id/statements` | Creates a statement snapshot. |
| `GET` | `/v1/accounts/:id/statements` | Lists account statements. |
| `GET` | `/v1/statements/:id` | Fetches a statement. |

Account create example:

```json
{
  "name": "Customer Wallet",
  "direction": "credit",
  "customer_id": "0194fd70-0000-7000-8000-000000000001",
  "balance_minor": "0",
  "metadata": {}
}
```

Balance response intent:

- `ledger_balance_minor` describes current ledger posture.
- `available_balance_minor` subtracts holds.
- `pending_balance_minor` represents reserved/held amount.

Account direction:

- Debit accounts and credit accounts are accounting concepts.
- The API exposes direction because entries need accounting direction.
- Product naming should not hide ledger semantics.

---

## 10. Financial Accounts and Holds

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/v1/financial-accounts` | Creates customer-facing financial account/wallet record. |
| `GET` | `/v1/financial-accounts` | Lists financial accounts. |
| `POST` | `/v1/holds` | Creates a hold/reservation. |
| `GET` | `/v1/holds` | Lists holds. |
| `POST` | `/v1/holds/:id/release` | Releases a hold. |
| `POST` | `/v1/holds/:id/capture` | Captures a hold. |

Hold notes:

- Holds influence available balance.
- Holds are not the same thing as ledger entries.
- A captured hold should be connected to a movement/ledger operation in a full production integration.
- In the current project, holds are useful for available-balance behavior and operational testing.

---

## 11. Ledger Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/v1/transactions` | Posts a double-entry transaction. |
| `GET` | `/v1/transactions` | Lists transactions. |
| `GET` | `/v1/transactions/:id` | Fetches one transaction. |
| `POST` | `/v1/transactions/:id/reverse` | Creates reversal entries. |

Transaction request shape:

```json
{
  "description": "Manual ledger posting",
  "metadata": {
    "source": "api"
  },
  "entries": [
    {
      "account_id": "source-account-id",
      "direction": "debit",
      "amount_minor": "1000"
    },
    {
      "account_id": "destination-account-id",
      "direction": "credit",
      "amount_minor": "1000"
    }
  ]
}
```

Ledger invariants:

- At least two entries are expected for meaningful double-entry accounting.
- Debit total must equal credit total.
- Amounts must be positive minor units.
- Entries are persisted with the transaction.
- Account balances are updated inside the database transaction.
- Reversal creates a new transaction.
- Reversal should not mutate the original transaction rows.
- Transaction metadata is JSONB.
- Idempotency key can be attached to transaction creation.

---

## 12. Money Movement Endpoints

| Method | Path | Movement type |
|--------|------|---------------|
| `POST` | `/v1/transfers` | Simplified internal transfer. |
| `GET` | `/v1/transfers` | Transfer list. |
| `GET` | `/v1/transfers/:id` | Transfer detail. |
| `POST` | `/v1/deposits` | Deposit movement. |
| `POST` | `/v1/withdrawals` | Withdrawal movement. |
| `POST` | `/v1/payments` | Payment movement. |
| `POST` | `/v1/internal-transfers` | Internal transfer movement. |
| `POST` | `/v1/inbound-transfers` | Inbound transfer movement. |
| `POST` | `/v1/outbound-transfers` | Outbound transfer movement. |
| `POST` | `/v1/refunds` | Refund movement. |
| `GET` | `/v1/money-movements` | Lists movement objects. |
| `GET` | `/v1/money-movements/:id` | Fetches one movement. |
| `POST` | `/v1/money-movements/:id/approve` | Marks movement posted. |
| `POST` | `/v1/money-movements/:id/fail` | Marks movement failed. |
| `POST` | `/v1/money-movements/:id/return` | Marks movement returned. |
| `POST` | `/v1/money-movements/:id/cancel` | Marks movement canceled. |

Movement request example:

```json
{
  "source_account_id": "optional-source",
  "destination_account_id": "destination-account",
  "amount_minor": "2500",
  "description": "Sandbox deposit",
  "metadata": {
    "rail": "sandbox"
  }
}
```

Movement states:

- `pending`
- `requires_approval`
- `processing`
- `posted`
- `returned`
- `failed`
- `canceled`

Movement notes:

- Movement objects are operational records.
- Ledger transactions are accounting records.
- Some operations create ledger entries immediately.
- Test helpers allow transition simulation.
- Provider-like flows remain sandbox unless a real provider adapter is introduced.

---

## 13. External Accounts and Payment Methods

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/v1/external-accounts` | Registers an external bank account-like instrument. |
| `GET` | `/v1/external-accounts` | Lists external accounts. |
| `POST` | `/v1/external-accounts/:id/verify` | Verifies an external account in sandbox. |
| `POST` | `/v1/payment-methods` | Creates a reusable payment method. |
| `GET` | `/v1/payment-methods` | Lists payment methods. |

Design notes:

- Account number storage uses last4/token-like posture where implemented.
- Verification is deterministic sandbox behavior.
- This is not an open banking or real bank-account verification integration.
- Payment methods support product modeling for payments and rail abstractions.

---

## 14. Fees and Pricing

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/v1/fee-schedules` | Creates a fee schedule. |
| `GET` | `/v1/fee-schedules` | Lists fee schedules. |
| `POST` | `/v1/pricing-rules` | Creates a pricing rule. |
| `GET` | `/v1/pricing-rules` | Lists pricing rules. |
| `POST` | `/v1/fees` | Charges a fee. |
| `GET` | `/v1/fees` | Lists fees. |
| `POST` | `/v1/fees/:id/reverse` | Reverses a fee. |

Fee notes:

- Fees are financial records.
- Fee charges can post ledger entries.
- Reversal should create compensating accounting movement.
- Fee metadata should capture product, rail and business reason.
- Percent pricing uses basis points (`bps`) where modeled.

---

## 15. Sandbox Rail Endpoints

| Method | Path | Rail | Purpose |
|--------|------|------|---------|
| `POST` | `/v1/pix/keys` | Pix sandbox | Creates a deterministic Pix key record. |
| `GET` | `/v1/pix/keys` | Pix sandbox | Lists Pix keys. |
| `POST` | `/v1/pix/charges` | Pix sandbox | Creates a Pix charge-like record. |
| `GET` | `/v1/pix/charges` | Pix sandbox | Lists Pix charges. |
| `POST` | `/v1/boletos` | Boleto sandbox | Creates boleto-like record. |
| `GET` | `/v1/boletos` | Boleto sandbox | Lists boletos. |
| `POST` | `/v1/card-products` | Card sandbox | Creates a card product. |
| `GET` | `/v1/card-products` | Card sandbox | Lists card products. |
| `POST` | `/v1/cards` | Card sandbox | Creates a card record. |
| `GET` | `/v1/cards` | Card sandbox | Lists cards. |
| `POST` | `/v1/card-authorizations` | Card sandbox | Creates authorization-like record. |
| `GET` | `/v1/card-authorizations` | Card sandbox | Lists authorizations. |

Truth-in-documentation notes:

- These endpoints are useful for product breadth.
- They are useful for client-web exploration.
- They are useful for webhook/reconciliation/audit exercises.
- They are not integrations with SPI, banks, boleto registrars or card processors.
- Provider-backed integrations are outside the sandbox rail claim and are tracked as deployment/provider work, not as behavior implied by these sandbox endpoints.

---

## 16. Lending Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/v1/lending/proposals` | Requests a scoring-backed lending proposal. |
| `GET` | `/v1/lending/proposals` | Lists proposals. |
| `GET` | `/v1/lending/proposals/:id` | Fetches proposal. |
| `POST` | `/v1/lending/products` | Creates loan product. |
| `GET` | `/v1/lending/products` | Lists loan products. |
| `POST` | `/v1/lending/simulations` | Simulates loan terms. |
| `POST` | `/v1/lending/applications` | Creates application and offer. |
| `GET` | `/v1/lending/applications` | Lists applications. |
| `GET` | `/v1/lending/offers` | Lists offers. |
| `POST` | `/v1/lending/offers/:id/accept` | Accepts offer and creates contract. |
| `GET` | `/v1/lending/contracts` | Lists contracts. |
| `GET` | `/v1/lending/contracts/:id/installments` | Lists installments. |
| `POST` | `/v1/lending/installments/:id/pay` | Pays installment. |

Scoring request path:

1. HTTP request reaches the lending controller.
2. Lending use case calls the proposal saga.
3. Saga calls the gRPC credit scoring client.
4. TypeScript client sends metadata to Python.
5. Python policy returns approval, limit and reason.
6. Saga persists proposal decision.
7. Metrics increment lending and scoring events.

Scoring metadata:

- `request_id`
- `tenant_id`
- `idempotency_key`
- `caller_service`

Failure policy:

- Default posture is fail closed for real credit decisions.
- `SCORING_FAILURE_POLICY=sandbox_controlled` allows controlled local sandbox behavior.

---

## 17. Events and Webhooks

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/v1/webhook-endpoints` | Registers endpoint and returns secret once. |
| `GET` | `/v1/webhook-endpoints` | Lists endpoints. |
| `POST` | `/v1/webhook-endpoints/:id/rotate-secret` | Rotates endpoint secret. |
| `GET` | `/v1/webhook-deliveries` | Lists delivery attempts. |
| `POST` | `/v1/webhook-deliveries/:id/retry` | Requeues delivery. |
| `POST` | `/v1/webhook-test-events` | Creates deterministic test event. |
| `GET` | `/v1/events` | Lists domain events. |

Webhook delivery states:

- `pending`
- `delivered`
- `failed`
- `dead_letter`

Webhook implementation notes:

- Secrets use `whsec_` prefix.
- Signing secret is stored for delivery signing.
- Delivery stores attempt count.
- Delivery stores status code when present.
- Delivery stores duration in milliseconds.
- Delivery stores error text when failed.
- Response body is truncated by storage logic where applicable.
- Manual retry sets status back to `pending`.

---

## 18. Audit, Reconciliation and Compliance

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/v1/audit-logs` | Lists audit log records. |
| `POST` | `/v1/reconciliation-runs` | Creates a reconciliation run. |
| `GET` | `/v1/reconciliation-runs` | Lists reconciliation runs. |
| `GET` | `/v1/reconciliation-runs/:id/items` | Lists reconciliation items. |
| `GET` | `/v1/reports/ledger-balances` | Lists ledger balance report. |
| `GET` | `/v1/reports/reconciliation` | Lists reconciliation report. |
| `GET` | `/v1/reports/outbox` | Lists outbox status report. |
| `GET` | `/v1/compliance-requests` | Lists compliance requests. |
| `POST` | `/v1/data-retention-policies` | Upserts data retention policy. |
| `GET` | `/v1/data-retention-policies` | Lists retention policies. |

Reconciliation notes:

- Current reconciliation compares total entries and total money movements for a period.
- It creates a run record.
- It creates at least one item record.
- It updates domain metrics and gauges.
- It is useful as an operational consistency signal.
- It is not yet reconciliation against an external provider statement.

---

## 19. Idempotency

Idempotency is implemented by `IdempotencyService`.

Relevant behavior:

- The key is scoped by tenant.
- The request hash is calculated from request payload.
- A new request reserves the key.
- A completed request stores response payload.
- A retry with the same key and same hash can return cached response.
- A retry with the same key and different hash creates a conflict.
- Metrics expose replay, conflict and cached success counts.

Recommended usage:

```bash
curl -X POST "$API/v1/deposits" \
  -H "content-type: application/json" \
  -H "x-api-key: $KEY" \
  -H "x-idempotency-key: deposit-001" \
  -d '{"destination_account_id":"...","amount_minor":"1000"}'
```

Idempotency should be used for:

- `POST /v1/transactions`
- `POST /v1/transfers`
- `POST /v1/deposits`
- `POST /v1/withdrawals`
- `POST /v1/payments`
- `POST /v1/internal-transfers`
- `POST /v1/inbound-transfers`
- `POST /v1/outbound-transfers`
- `POST /v1/refunds`
- `POST /v1/lending/proposals`
- `POST /v1/fees`
- creation/capture/cancel-like rail sandbox commands where supported

---

## 20. Error Envelope

The error handler normalizes application errors.

Expected shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Payload invalido",
    "request_id": "req_...",
    "details": {}
  }
}
```

Operational expectations:

- Validation errors should return 400.
- Auth errors should return 401.
- Missing records should return 404.
- Idempotency conflicts should return conflict behavior.
- Unknown errors should avoid leaking internals.
- `request_id` should be available for correlation.

---

## 21. Client Web Relationship

The dedicated frontend is in `client-web`.

It provides:

- home view;
- local docs;
- operations view;
- API explorer;
- environment panel;
- response console;
- endpoint examples;
- simple mode;
- configurable JSON mode;
- ready JSON mode.

The old `service-typescript/src/public` static HTML was removed. The frontend is now a separate app and should remain compatible with the current endpoint surface.

---

## 22. SDKs

TypeScript SDK:

- path: `packages/typescript-sdk/financial-api-client.ts`
- purpose: lightweight example client for API consumers.

Python SDK:

- path: `packages/python-sdk/financial_api_client.py`
- purpose: lightweight stdlib-based client for core flows.

SDK scope:

- They are intentionally simple.
- They are handwritten examples, handwritten clients.
- They document expected consumption patterns.
- They track stable flows used by the public HTTP surface.

---

## 23. API Review Criteria

This table documents the review criteria used to keep public endpoints consistent. It is not a pending backlog; it is the quality gate applied to endpoint design.

| Criterion | Expected API posture |
|-----------|----------------------|
| Tenant context | `/v1` endpoints resolve tenant through `x-api-key`. |
| Financial mutation | Commands that move or reserve money use explicit request semantics. |
| Idempotency | Retry-sensitive commands use or document idempotency behavior. |
| Money format | Monetary fields preserve minor-unit string values and avoid floating point. |
| Error envelope | Errors include a normalized code/message and request correlation. |
| Audit | Command-like operations are visible through audit posture when relevant. |
| Events | Domain events represent facts that downstream consumers may need. |
| Reconciliation | Financial effects are visible to reports or reconciliation flows. |
| OpenAPI | Public behavior is represented in the OpenAPI document. |
| Client web | The API Explorer contains a matching endpoint spec and test payload. |
| Webhooks | Webhook-worthy facts have a delivery path or explicit event surface. |
| Observability | Metrics/log context exist for operationally relevant behavior. |
| Schema | Schema changes are versioned through migrations. |
| Compliance | Retention/export/anonymization behavior is documented when applicable. |
| Sandbox claim | Sandbox rails are labeled as sandbox and not described as provider integrations. |
