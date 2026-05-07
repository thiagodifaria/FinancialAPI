-- Habilitação de extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Roles separadas: uma para migrations/administração e outra para runtime da API.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ledger_runtime') THEN
        CREATE ROLE ledger_runtime LOGIN PASSWORD 'ledger_runtime_password';
    END IF;
END $$;

-- Definição de tipos customizados
DO $$
BEGIN
    CREATE TYPE direction_type AS ENUM ('debit', 'credit');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
    CREATE TYPE user_role_type AS ENUM ('admin', 'finance', 'support', 'auditor', 'developer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
    CREATE TYPE lifecycle_status_type AS ENUM ('active', 'archived', 'blocked', 'pending', 'verified', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
    CREATE TYPE movement_status_type AS ENUM ('pending', 'posted', 'failed', 'canceled', 'reversed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
    CREATE TYPE lending_status_type AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
    CREATE TYPE api_key_status_type AS ENUM ('active', 'revoked');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
    CREATE TYPE movement_type AS ENUM ('transfer', 'deposit', 'withdrawal', 'payment');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
    CREATE TYPE loan_application_status_type AS ENUM ('pending', 'approved', 'rejected', 'accepted', 'canceled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
    CREATE TYPE loan_contract_status_type AS ENUM ('active', 'paid', 'defaulted', 'canceled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
    CREATE TYPE installment_status_type AS ENUM ('pending', 'paid', 'overdue', 'canceled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
    CREATE TYPE webhook_status_type AS ENUM ('active', 'disabled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
    CREATE TYPE hold_status_type AS ENUM ('active', 'released', 'captured', 'expired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
    CREATE TYPE outbox_status_type AS ENUM ('pending', 'published', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tabela de Tenants (Multi-tenancy)
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    api_key TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- API keys machine-to-machine com rotação/revogação sem trocar o tenant
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name TEXT NOT NULL,
    key_hash TEXT UNIQUE NOT NULL,
    key_prefix TEXT NOT NULL,
    scopes TEXT[] NOT NULL DEFAULT ARRAY['*'],
    ip_allowlist TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    status api_key_status_type NOT NULL DEFAULT 'active',
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS ip_allowlist TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Bloqueio progressivo de tentativas de login por usuário/tenant
CREATE TABLE IF NOT EXISTS login_attempts (
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    email TEXT NOT NULL,
    failed_count INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, email)
);

-- Usuários humanos do tenant, separados das API keys machine-to-machine
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    totp_secret TEXT,
    two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
    role user_role_type NOT NULL DEFAULT 'developer',
    status lifecycle_status_type NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, email)
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT false;

-- Sessões de usuário com token opaco armazenado como hash
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID NOT NULL REFERENCES users(id),
    token_hash TEXT UNIQUE NOT NULL,
    refresh_token_hash TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Customers / account holders: base para wallets, KYC/KYB e produtos financeiros
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    type TEXT NOT NULL CHECK (type IN ('individual', 'business')),
    name TEXT NOT NULL,
    document TEXT,
    email TEXT,
    phone TEXT,
    status lifecycle_status_type NOT NULL DEFAULT 'pending',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Consentimentos mínimos para compliance/termos por customer
CREATE TABLE IF NOT EXISTS customer_consents (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    type TEXT NOT NULL,
    version TEXT NOT NULL,
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}',
    UNIQUE(tenant_id, customer_id, type, version)
);

-- Tabela de Contas (Digital Wallets / Ledger Accounts)
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    customer_id UUID REFERENCES customers(id),
    name TEXT,
    balance NUMERIC(20, 0) NOT NULL DEFAULT 0,
    direction direction_type NOT NULL,
    status lifecycle_status_type NOT NULL DEFAULT 'active',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Compatibilidade para volumes locais já inicializados antes da evolução de produto.
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS status lifecycle_status_type NOT NULL DEFAULT 'active';

-- Financial accounts/wallets públicas separadas das ledger accounts de suporte.
CREATE TABLE IF NOT EXISTS financial_accounts (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    customer_id UUID REFERENCES customers(id),
    ledger_account_id UUID NOT NULL REFERENCES accounts(id),
    name TEXT,
    status lifecycle_status_type NOT NULL DEFAULT 'active',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Holds/reservas afetam saldo disponível sem mutar o ledger até captura/liberação.
CREATE TABLE IF NOT EXISTS holds (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    account_id UUID NOT NULL REFERENCES accounts(id),
    amount NUMERIC(20, 0) NOT NULL CHECK (amount > 0),
    status hold_status_type NOT NULL DEFAULT 'active',
    expires_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    released_at TIMESTAMPTZ
);

-- Tabela de Transações (Cabeçalho Imutável)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    description TEXT,
    idempotency_key TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, idempotency_key)
);

-- Tabela de Lançamentos (Entries - Partidas Dobradas)
CREATE TABLE IF NOT EXISTS entries (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    transaction_id UUID NOT NULL REFERENCES transactions(id),
    account_id UUID NOT NULL REFERENCES accounts(id),
    amount NUMERIC(20, 0) NOT NULL CHECK (amount > 0),
    direction direction_type NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Objeto amigável de movimentação interna, lançado no ledger quando postado
CREATE TABLE IF NOT EXISTS transfers (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    source_account_id UUID NOT NULL REFERENCES accounts(id),
    destination_account_id UUID NOT NULL REFERENCES accounts(id),
    transaction_id UUID REFERENCES transactions(id),
    amount NUMERIC(20, 0) NOT NULL CHECK (amount > 0),
    description TEXT,
    status movement_status_type NOT NULL DEFAULT 'pending',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    posted_at TIMESTAMPTZ
);

-- Movimentações genéricas de sandbox: deposit, withdrawal e payment
CREATE TABLE IF NOT EXISTS money_movements (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    type movement_type NOT NULL,
    source_account_id UUID REFERENCES accounts(id),
    destination_account_id UUID REFERENCES accounts(id),
    transaction_id UUID REFERENCES transactions(id),
    amount NUMERIC(20, 0) NOT NULL CHECK (amount > 0),
    description TEXT,
    status movement_status_type NOT NULL DEFAULT 'pending',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    posted_at TIMESTAMPTZ
);

-- Propostas de lending com snapshot mínimo da decisão
CREATE TABLE IF NOT EXISTS lending_proposals (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    account_id UUID NOT NULL REFERENCES accounts(id),
    amount NUMERIC(20, 0) NOT NULL CHECK (amount > 0),
    status lending_status_type NOT NULL DEFAULT 'PENDING',
    reason TEXT,
    maximum_limit NUMERIC(20, 0),
    transaction_id UUID REFERENCES transactions(id),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS loan_products (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name TEXT NOT NULL,
    annual_interest_bps INTEGER NOT NULL CHECK (annual_interest_bps >= 0),
    min_amount NUMERIC(20, 0) NOT NULL CHECK (min_amount > 0),
    max_amount NUMERIC(20, 0) NOT NULL CHECK (max_amount >= min_amount),
    min_installments INTEGER NOT NULL CHECK (min_installments > 0),
    max_installments INTEGER NOT NULL CHECK (max_installments >= min_installments),
    status lifecycle_status_type NOT NULL DEFAULT 'active',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loan_applications (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    customer_id UUID REFERENCES customers(id),
    account_id UUID NOT NULL REFERENCES accounts(id),
    product_id UUID REFERENCES loan_products(id),
    requested_amount NUMERIC(20, 0) NOT NULL CHECK (requested_amount > 0),
    installments INTEGER NOT NULL CHECK (installments > 0),
    status loan_application_status_type NOT NULL DEFAULT 'pending',
    scoring_snapshot JSONB NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS loan_offers (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    application_id UUID NOT NULL REFERENCES loan_applications(id),
    principal_amount NUMERIC(20, 0) NOT NULL CHECK (principal_amount > 0),
    total_amount NUMERIC(20, 0) NOT NULL CHECK (total_amount > 0),
    installment_amount NUMERIC(20, 0) NOT NULL CHECK (installment_amount > 0),
    annual_interest_bps INTEGER NOT NULL CHECK (annual_interest_bps >= 0),
    installments INTEGER NOT NULL CHECK (installments > 0),
    expires_at TIMESTAMPTZ NOT NULL,
    status lifecycle_status_type NOT NULL DEFAULT 'active',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loan_contracts (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    offer_id UUID NOT NULL REFERENCES loan_offers(id),
    account_id UUID NOT NULL REFERENCES accounts(id),
    disbursement_transaction_id UUID REFERENCES transactions(id),
    principal_amount NUMERIC(20, 0) NOT NULL CHECK (principal_amount > 0),
    total_amount NUMERIC(20, 0) NOT NULL CHECK (total_amount > 0),
    status loan_contract_status_type NOT NULL DEFAULT 'active',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS installments (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    contract_id UUID NOT NULL REFERENCES loan_contracts(id),
    number INTEGER NOT NULL CHECK (number > 0),
    due_date DATE NOT NULL,
    principal_amount NUMERIC(20, 0) NOT NULL CHECK (principal_amount >= 0),
    interest_amount NUMERIC(20, 0) NOT NULL CHECK (interest_amount >= 0),
    total_amount NUMERIC(20, 0) NOT NULL CHECK (total_amount > 0),
    paid_transaction_id UUID REFERENCES transactions(id),
    status installment_status_type NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMPTZ,
    UNIQUE(tenant_id, contract_id, number)
);

CREATE TABLE IF NOT EXISTS webhook_endpoints (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    url TEXT NOT NULL,
    secret_hash TEXT NOT NULL,
    signing_secret TEXT,
    events TEXT[] NOT NULL DEFAULT ARRAY['*'],
    status webhook_status_type NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE webhook_endpoints ADD COLUMN IF NOT EXISTS signing_secret TEXT;

CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    type TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS outbox_events (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    event_id UUID NOT NULL REFERENCES events(id),
    exchange TEXT NOT NULL DEFAULT 'financial.events',
    routing_key TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    status outbox_status_type NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ
);

-- Tabela de Auditoria (INSERT ONLY)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID NOT NULL,
    payload JSONB,
    request_id TEXT,
    user_id UUID,
    idempotency_key TEXT,
    transaction_id UUID,
    user_agent TEXT,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS request_id TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS transaction_id UUID;

CREATE INDEX IF NOT EXISTS idx_accounts_tenant ON accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_accounts_tenant_customer ON accounts(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant_created ON api_keys(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_tenant_email ON users(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_locked ON login_attempts(tenant_id, email, locked_until);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token_hash ON sessions(refresh_token_hash);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_created ON customers(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_consents_tenant_customer ON customer_consents(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_financial_accounts_tenant_customer ON financial_accounts(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_holds_tenant_account_status ON holds(tenant_id, account_id, status);
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_created ON transactions(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entries_tenant_transaction ON entries(tenant_id, transaction_id);
CREATE INDEX IF NOT EXISTS idx_entries_tenant_account ON entries(tenant_id, account_id);
CREATE INDEX IF NOT EXISTS idx_transfers_tenant_created ON transfers(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_money_movements_tenant_created ON money_movements(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lending_proposals_tenant_created ON lending_proposals(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loan_products_tenant_created ON loan_products(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loan_applications_tenant_created ON loan_applications(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loan_offers_tenant_created ON loan_offers(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loan_contracts_tenant_created ON loan_contracts(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_installments_tenant_contract ON installments(tenant_id, contract_id, number);
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_tenant_created ON webhook_endpoints(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_tenant_created ON events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outbox_events_status_created ON outbox_events(status, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created ON audit_logs(tenant_id, created_at DESC);

-- Triggers de Imutabilidade (Bloqueio de UPDATE/DELETE)
CREATE OR REPLACE FUNCTION block_immutable_action()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Operação não permitida: registros financeiros são imutáveis.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_immutable_transactions ON transactions;
DROP TRIGGER IF EXISTS trg_immutable_entries ON entries;
DROP TRIGGER IF EXISTS trg_immutable_audit ON audit_logs;

CREATE TRIGGER trg_immutable_transactions BEFORE UPDATE OR DELETE ON transactions FOR EACH ROW EXECUTE FUNCTION block_immutable_action();
CREATE TRIGGER trg_immutable_entries BEFORE UPDATE OR DELETE ON entries FOR EACH ROW EXECUTE FUNCTION block_immutable_action();
CREATE TRIGGER trg_immutable_audit BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION block_immutable_action();

-- Configuração de Row Level Security (RLS)
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE lending_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE api_keys FORCE ROW LEVEL SECURITY;
ALTER TABLE login_attempts FORCE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;
ALTER TABLE customer_consents FORCE ROW LEVEL SECURITY;
ALTER TABLE financial_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE holds FORCE ROW LEVEL SECURITY;
ALTER TABLE transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE entries FORCE ROW LEVEL SECURITY;
ALTER TABLE transfers FORCE ROW LEVEL SECURITY;
ALTER TABLE money_movements FORCE ROW LEVEL SECURITY;
ALTER TABLE lending_proposals FORCE ROW LEVEL SECURITY;
ALTER TABLE loan_products FORCE ROW LEVEL SECURITY;
ALTER TABLE loan_applications FORCE ROW LEVEL SECURITY;
ALTER TABLE loan_offers FORCE ROW LEVEL SECURITY;
ALTER TABLE loan_contracts FORCE ROW LEVEL SECURITY;
ALTER TABLE installments FORCE ROW LEVEL SECURITY;
ALTER TABLE webhook_endpoints FORCE ROW LEVEL SECURITY;
ALTER TABLE events FORCE ROW LEVEL SECURITY;
ALTER TABLE outbox_events FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON accounts;
DROP POLICY IF EXISTS tenant_isolation_policy ON api_keys;
DROP POLICY IF EXISTS api_key_lookup_policy ON api_keys;
DROP POLICY IF EXISTS tenant_isolation_policy ON login_attempts;
DROP POLICY IF EXISTS tenant_isolation_policy ON users;
DROP POLICY IF EXISTS tenant_isolation_policy ON sessions;
DROP POLICY IF EXISTS tenant_isolation_policy ON customers;
DROP POLICY IF EXISTS tenant_isolation_policy ON customer_consents;
DROP POLICY IF EXISTS tenant_isolation_policy ON financial_accounts;
DROP POLICY IF EXISTS tenant_isolation_policy ON holds;
DROP POLICY IF EXISTS tenant_isolation_policy ON transactions;
DROP POLICY IF EXISTS tenant_isolation_policy ON entries;
DROP POLICY IF EXISTS tenant_isolation_policy ON transfers;
DROP POLICY IF EXISTS tenant_isolation_policy ON money_movements;
DROP POLICY IF EXISTS tenant_isolation_policy ON lending_proposals;
DROP POLICY IF EXISTS tenant_isolation_policy ON loan_products;
DROP POLICY IF EXISTS tenant_isolation_policy ON loan_applications;
DROP POLICY IF EXISTS tenant_isolation_policy ON loan_offers;
DROP POLICY IF EXISTS tenant_isolation_policy ON loan_contracts;
DROP POLICY IF EXISTS tenant_isolation_policy ON installments;
DROP POLICY IF EXISTS tenant_isolation_policy ON webhook_endpoints;
DROP POLICY IF EXISTS tenant_isolation_policy ON events;
DROP POLICY IF EXISTS tenant_isolation_policy ON outbox_events;
DROP POLICY IF EXISTS tenant_isolation_policy ON audit_logs;

CREATE POLICY tenant_isolation_policy ON accounts
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON api_keys
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- Lookup global de hashes para autenticação machine-to-machine antes de conhecer o tenant.
CREATE POLICY api_key_lookup_policy ON api_keys
    FOR SELECT
    USING (status = 'active');

CREATE POLICY tenant_isolation_policy ON login_attempts
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON users
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON sessions
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON customers
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON customer_consents
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON financial_accounts
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON holds
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON transactions
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON entries
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON transfers
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON money_movements
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON lending_proposals
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON loan_products
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON loan_applications
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON loan_offers
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON loan_contracts
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON installments
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON webhook_endpoints
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON events
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON outbox_events
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON audit_logs
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

GRANT USAGE ON SCHEMA public TO ledger_runtime;
GRANT SELECT ON tenants TO ledger_runtime;
GRANT SELECT, INSERT, UPDATE ON api_keys TO ledger_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON login_attempts TO ledger_runtime;
GRANT SELECT, INSERT, UPDATE ON users TO ledger_runtime;
GRANT SELECT, INSERT, UPDATE ON sessions TO ledger_runtime;
GRANT SELECT, INSERT, UPDATE ON customers TO ledger_runtime;
GRANT SELECT, INSERT, UPDATE ON customer_consents TO ledger_runtime;
GRANT SELECT, INSERT, UPDATE ON financial_accounts TO ledger_runtime;
GRANT SELECT, INSERT, UPDATE ON holds TO ledger_runtime;
GRANT SELECT, INSERT, UPDATE ON accounts TO ledger_runtime;
GRANT SELECT, INSERT ON transactions TO ledger_runtime;
GRANT SELECT, INSERT ON entries TO ledger_runtime;
GRANT SELECT, INSERT, UPDATE ON transfers TO ledger_runtime;
GRANT SELECT, INSERT, UPDATE ON money_movements TO ledger_runtime;
GRANT SELECT, INSERT, UPDATE ON lending_proposals TO ledger_runtime;
GRANT SELECT, INSERT, UPDATE ON loan_products TO ledger_runtime;
GRANT SELECT, INSERT, UPDATE ON loan_applications TO ledger_runtime;
GRANT SELECT, INSERT, UPDATE ON loan_offers TO ledger_runtime;
GRANT SELECT, INSERT, UPDATE ON loan_contracts TO ledger_runtime;
GRANT SELECT, INSERT, UPDATE ON installments TO ledger_runtime;
GRANT SELECT, INSERT, UPDATE ON webhook_endpoints TO ledger_runtime;
GRANT SELECT, INSERT ON events TO ledger_runtime;
GRANT SELECT, INSERT, UPDATE ON outbox_events TO ledger_runtime;
GRANT SELECT, INSERT ON audit_logs TO ledger_runtime;

CREATE OR REPLACE FUNCTION enqueue_event_outbox()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO outbox_events (id, tenant_id, event_id, routing_key, payload)
    VALUES (uuid_generate_v4(), NEW.tenant_id, NEW.id, NEW.type, NEW.payload);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_events_outbox ON events;
CREATE TRIGGER trg_events_outbox AFTER INSERT ON events FOR EACH ROW EXECUTE FUNCTION enqueue_event_outbox();

-- Seed de desenvolvimento. A API key pública para dev é: dev-api-key
INSERT INTO tenants (id, name, api_key)
VALUES (
    '0194fd70-0000-7000-8000-000000000001',
    'Demo Tenant',
    crypt('dev-api-key', gen_salt('bf'))
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, tenant_id, email, name, password_hash, role, status)
VALUES (
    '0194fd70-0000-7000-8000-000000000011',
    '0194fd70-0000-7000-8000-000000000001',
    'admin@example.com',
    'Demo Admin',
    crypt('dev-password', gen_salt('bf')),
    'admin',
    'active'
)
ON CONFLICT (tenant_id, email) DO NOTHING;

INSERT INTO api_keys (id, tenant_id, name, key_hash, key_prefix, scopes, status)
VALUES (
    '0194fd70-0000-7000-8000-000000000021',
    '0194fd70-0000-7000-8000-000000000001',
    'Development API Key',
    crypt('dev-api-key', gen_salt('bf')),
    'dev-api',
    ARRAY['*'],
    'active'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO accounts (id, tenant_id, name, balance, direction, metadata)
VALUES (
    '0194fd70-0000-7000-8000-000000000101',
    '0194fd70-0000-7000-8000-000000000001',
    'Loan Funding Account',
    100000000,
    'debit',
    '{"system": true, "kind": "loan_funding"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO accounts (id, tenant_id, name, balance, direction, metadata)
VALUES (
    '0194fd70-0000-7000-8000-000000000102',
    '0194fd70-0000-7000-8000-000000000001',
    'Sandbox External Settlement Account',
    100000000,
    'debit',
    '{"system": true, "kind": "sandbox_settlement"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO loan_products (
    id, tenant_id, name, annual_interest_bps, min_amount, max_amount,
    min_installments, max_installments, status, metadata
)
VALUES (
    '0194fd70-0000-7000-8000-000000000201',
    '0194fd70-0000-7000-8000-000000000001',
    'Sandbox Personal Loan',
    2400,
    1000,
    5000000,
    1,
    24,
    'active',
    '{"system": true}'::jsonb
)
ON CONFLICT (id) DO NOTHING;
