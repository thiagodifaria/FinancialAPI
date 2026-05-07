-- Evoluções finais das fases 12-15: movements especializados, pricing rules e rails sandbox.
ALTER TYPE movement_status_type ADD VALUE IF NOT EXISTS 'requires_approval';
ALTER TYPE movement_status_type ADD VALUE IF NOT EXISTS 'processing';
ALTER TYPE movement_status_type ADD VALUE IF NOT EXISTS 'returned';

ALTER TYPE movement_type ADD VALUE IF NOT EXISTS 'internal_transfer';
ALTER TYPE movement_type ADD VALUE IF NOT EXISTS 'inbound_transfer';
ALTER TYPE movement_type ADD VALUE IF NOT EXISTS 'outbound_transfer';
ALTER TYPE movement_type ADD VALUE IF NOT EXISTS 'refund';

DO $$
BEGIN
    CREATE TYPE rail_object_status_type AS ENUM ('created', 'requires_approval', 'processing', 'posted', 'returned', 'failed', 'canceled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS pricing_rules (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    fee_schedule_id UUID REFERENCES fee_schedules(id),
    product TEXT NOT NULL,
    rail TEXT NOT NULL,
    min_amount NUMERIC(20, 0) NOT NULL DEFAULT 0,
    max_amount NUMERIC(20, 0),
    fixed_amount NUMERIC(20, 0) NOT NULL DEFAULT 0,
    percent_bps INTEGER NOT NULL DEFAULT 0,
    status lifecycle_status_type NOT NULL DEFAULT 'active',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pix_keys (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    account_id UUID NOT NULL REFERENCES accounts(id),
    key_type TEXT NOT NULL,
    key_value TEXT NOT NULL,
    status rail_object_status_type NOT NULL DEFAULT 'created',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, key_value)
);

CREATE TABLE IF NOT EXISTS pix_charges (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    account_id UUID NOT NULL REFERENCES accounts(id),
    pix_key_id UUID REFERENCES pix_keys(id),
    amount NUMERIC(20, 0) NOT NULL CHECK (amount > 0),
    status rail_object_status_type NOT NULL DEFAULT 'created',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS boletos (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    account_id UUID NOT NULL REFERENCES accounts(id),
    amount NUMERIC(20, 0) NOT NULL CHECK (amount > 0),
    due_date DATE NOT NULL,
    barcode TEXT NOT NULL,
    status rail_object_status_type NOT NULL DEFAULT 'created',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, barcode)
);

CREATE TABLE IF NOT EXISTS card_products (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name TEXT NOT NULL,
    status lifecycle_status_type NOT NULL DEFAULT 'active',
    spend_controls JSONB NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cards (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    customer_id UUID REFERENCES customers(id),
    account_id UUID NOT NULL REFERENCES accounts(id),
    card_product_id UUID REFERENCES card_products(id),
    last4 TEXT NOT NULL,
    status lifecycle_status_type NOT NULL DEFAULT 'active',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS card_authorizations (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    card_id UUID NOT NULL REFERENCES cards(id),
    account_id UUID NOT NULL REFERENCES accounts(id),
    amount NUMERIC(20, 0) NOT NULL CHECK (amount > 0),
    status rail_object_status_type NOT NULL DEFAULT 'requires_approval',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pricing_rules_tenant_product_rail ON pricing_rules(tenant_id, product, rail);
CREATE INDEX IF NOT EXISTS idx_pix_keys_tenant_account ON pix_keys(tenant_id, account_id);
CREATE INDEX IF NOT EXISTS idx_pix_charges_tenant_account ON pix_charges(tenant_id, account_id);
CREATE INDEX IF NOT EXISTS idx_boletos_tenant_account ON boletos(tenant_id, account_id);
CREATE INDEX IF NOT EXISTS idx_card_products_tenant ON card_products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cards_tenant_account ON cards(tenant_id, account_id);
CREATE INDEX IF NOT EXISTS idx_card_authorizations_tenant_card ON card_authorizations(tenant_id, card_id);

ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE pix_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE pix_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE boletos ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_authorizations ENABLE ROW LEVEL SECURITY;

ALTER TABLE pricing_rules FORCE ROW LEVEL SECURITY;
ALTER TABLE pix_keys FORCE ROW LEVEL SECURITY;
ALTER TABLE pix_charges FORCE ROW LEVEL SECURITY;
ALTER TABLE boletos FORCE ROW LEVEL SECURITY;
ALTER TABLE card_products FORCE ROW LEVEL SECURITY;
ALTER TABLE cards FORCE ROW LEVEL SECURITY;
ALTER TABLE card_authorizations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON pricing_rules;
DROP POLICY IF EXISTS tenant_isolation_policy ON pix_keys;
DROP POLICY IF EXISTS tenant_isolation_policy ON pix_charges;
DROP POLICY IF EXISTS tenant_isolation_policy ON boletos;
DROP POLICY IF EXISTS tenant_isolation_policy ON card_products;
DROP POLICY IF EXISTS tenant_isolation_policy ON cards;
DROP POLICY IF EXISTS tenant_isolation_policy ON card_authorizations;

CREATE POLICY tenant_isolation_policy ON pricing_rules
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON pix_keys
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON pix_charges
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON boletos
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON card_products
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON cards
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON card_authorizations
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

GRANT SELECT, INSERT, UPDATE ON pricing_rules TO ledger_runtime;
GRANT SELECT, INSERT, UPDATE ON pix_keys TO ledger_runtime;
GRANT SELECT, INSERT, UPDATE ON pix_charges TO ledger_runtime;
GRANT SELECT, INSERT, UPDATE ON boletos TO ledger_runtime;
GRANT SELECT, INSERT, UPDATE ON card_products TO ledger_runtime;
GRANT SELECT, INSERT, UPDATE ON cards TO ledger_runtime;
GRANT SELECT, INSERT, UPDATE ON card_authorizations TO ledger_runtime;
