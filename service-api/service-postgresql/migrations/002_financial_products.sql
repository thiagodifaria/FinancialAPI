-- Evoluções de produto financeiro geral: status, limites, statements, instrumentos e fees.
DO $$
BEGIN
    CREATE TYPE account_transition_type AS ENUM ('freeze', 'unfreeze', 'close');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
    CREATE TYPE external_account_status_type AS ENUM ('pending_verification', 'verified', 'disabled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
    CREATE TYPE payment_method_type AS ENUM ('bank_account', 'card_token', 'pix_key', 'generic_rail');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
    CREATE TYPE payment_method_status_type AS ENUM ('active', 'disabled', 'requires_verification');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS account_status_transitions (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    account_id UUID NOT NULL REFERENCES accounts(id),
    transition account_transition_type NOT NULL,
    from_status lifecycle_status_type NOT NULL,
    to_status lifecycle_status_type NOT NULL,
    reason TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS account_limits (
    account_id UUID PRIMARY KEY REFERENCES accounts(id),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    daily_limit NUMERIC(20, 0),
    monthly_limit NUMERIC(20, 0),
    per_transaction_limit NUMERIC(20, 0),
    currency TEXT NOT NULL DEFAULT 'BRL',
    metadata JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS statements (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    account_id UUID NOT NULL REFERENCES accounts(id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    opening_balance NUMERIC(20, 0) NOT NULL,
    closing_balance NUMERIC(20, 0) NOT NULL,
    entries_count INTEGER NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, account_id, period_start, period_end)
);

CREATE TABLE IF NOT EXISTS external_accounts (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    customer_id UUID REFERENCES customers(id),
    holder_name TEXT NOT NULL,
    institution_name TEXT NOT NULL,
    account_number_last4 TEXT NOT NULL,
    routing_number TEXT,
    status external_account_status_type NOT NULL DEFAULT 'pending_verification',
    verification_code_hash TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verified_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    customer_id UUID REFERENCES customers(id),
    external_account_id UUID REFERENCES external_accounts(id),
    type payment_method_type NOT NULL,
    label TEXT NOT NULL,
    token TEXT NOT NULL,
    status payment_method_status_type NOT NULL DEFAULT 'active',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fee_schedules (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name TEXT NOT NULL,
    product TEXT NOT NULL,
    rail TEXT NOT NULL,
    fixed_amount NUMERIC(20, 0) NOT NULL DEFAULT 0,
    percent_bps INTEGER NOT NULL DEFAULT 0,
    min_amount NUMERIC(20, 0) NOT NULL DEFAULT 0,
    max_amount NUMERIC(20, 0),
    status lifecycle_status_type NOT NULL DEFAULT 'active',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fees (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    fee_schedule_id UUID REFERENCES fee_schedules(id),
    account_id UUID NOT NULL REFERENCES accounts(id),
    transaction_id UUID REFERENCES transactions(id),
    amount NUMERIC(20, 0) NOT NULL CHECK (amount > 0),
    status movement_status_type NOT NULL DEFAULT 'posted',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_status_transitions_tenant_account ON account_status_transitions(tenant_id, account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_limits_tenant ON account_limits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_statements_tenant_account ON statements(tenant_id, account_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_external_accounts_tenant_customer ON external_accounts(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_tenant_customer ON payment_methods(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_fee_schedules_tenant_product ON fee_schedules(tenant_id, product, rail);
CREATE INDEX IF NOT EXISTS idx_fees_tenant_created ON fees(tenant_id, created_at DESC);

ALTER TABLE account_status_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE fees ENABLE ROW LEVEL SECURITY;

ALTER TABLE account_status_transitions FORCE ROW LEVEL SECURITY;
ALTER TABLE account_limits FORCE ROW LEVEL SECURITY;
ALTER TABLE statements FORCE ROW LEVEL SECURITY;
ALTER TABLE external_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE payment_methods FORCE ROW LEVEL SECURITY;
ALTER TABLE fee_schedules FORCE ROW LEVEL SECURITY;
ALTER TABLE fees FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON account_status_transitions;
DROP POLICY IF EXISTS tenant_isolation_policy ON account_limits;
DROP POLICY IF EXISTS tenant_isolation_policy ON statements;
DROP POLICY IF EXISTS tenant_isolation_policy ON external_accounts;
DROP POLICY IF EXISTS tenant_isolation_policy ON payment_methods;
DROP POLICY IF EXISTS tenant_isolation_policy ON fee_schedules;
DROP POLICY IF EXISTS tenant_isolation_policy ON fees;

CREATE POLICY tenant_isolation_policy ON account_status_transitions
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON account_limits
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON statements
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON external_accounts
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON payment_methods
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON fee_schedules
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON fees
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

GRANT SELECT, INSERT ON account_status_transitions TO ledger_runtime;
GRANT SELECT, INSERT, UPDATE ON account_limits TO ledger_runtime;
GRANT SELECT, INSERT ON statements TO ledger_runtime;
GRANT SELECT, INSERT, UPDATE ON external_accounts TO ledger_runtime;
GRANT SELECT, INSERT, UPDATE ON payment_methods TO ledger_runtime;
GRANT SELECT, INSERT, UPDATE ON fee_schedules TO ledger_runtime;
GRANT SELECT, INSERT, UPDATE ON fees TO ledger_runtime;

-- Contas técnicas usadas por sandbox helpers e cobrança de fees.
INSERT INTO accounts (id, tenant_id, name, balance, direction, metadata)
VALUES (
    '0194fd70-0000-7000-8000-000000000102',
    '0194fd70-0000-7000-8000-000000000001',
    'Sandbox Settlement Account',
    100000000,
    'debit',
    '{"system": true, "kind": "sandbox_settlement"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO accounts (id, tenant_id, name, balance, direction, metadata)
VALUES (
    '0194fd70-0000-7000-8000-000000000103',
    '0194fd70-0000-7000-8000-000000000001',
    'Fee Revenue Account',
    0,
    'credit',
    '{"system": true, "kind": "fee_revenue"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;
