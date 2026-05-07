-- Fases 16-18: reconciliation, webhook deliveries e compliance/LGPD operacional.
DO $$
BEGIN
    CREATE TYPE reconciliation_status_type AS ENUM ('pending', 'running', 'completed', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
    CREATE TYPE reconciliation_item_status_type AS ENUM ('matched', 'difference', 'missing_ledger', 'missing_movement');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
    CREATE TYPE webhook_delivery_status_type AS ENUM ('pending', 'delivered', 'failed', 'dead_letter');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
    CREATE TYPE compliance_request_status_type AS ENUM ('pending', 'completed', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS reconciliation_runs (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    status reconciliation_status_type NOT NULL DEFAULT 'pending',
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    summary JSONB NOT NULL DEFAULT '{}',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reconciliation_items (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    run_id UUID NOT NULL REFERENCES reconciliation_runs(id),
    status reconciliation_item_status_type NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID,
    expected_amount NUMERIC(20, 0),
    actual_amount NUMERIC(20, 0),
    details JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    webhook_endpoint_id UUID NOT NULL REFERENCES webhook_endpoints(id),
    outbox_event_id UUID REFERENCES outbox_events(id),
    event_type TEXT NOT NULL,
    url TEXT NOT NULL,
    status webhook_delivery_status_type NOT NULL DEFAULT 'pending',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status_code INTEGER,
    duration_ms INTEGER,
    error TEXT,
    response_body TEXT,
    payload JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS compliance_requests (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    customer_id UUID REFERENCES customers(id),
    type TEXT NOT NULL,
    status compliance_request_status_type NOT NULL DEFAULT 'pending',
    reason TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS data_retention_policies (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    domain TEXT NOT NULL,
    retention_days INTEGER NOT NULL CHECK (retention_days > 0),
    action TEXT NOT NULL DEFAULT 'review',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, domain)
);

CREATE TABLE IF NOT EXISTS admin_access_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID,
    request_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_runs_tenant_created ON reconciliation_runs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reconciliation_items_tenant_run ON reconciliation_items(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_tenant_status ON webhook_deliveries(tenant_id, status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_compliance_requests_tenant_customer ON compliance_requests(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_data_retention_policies_tenant ON data_retention_policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_admin_access_logs_tenant_created ON admin_access_logs(tenant_id, created_at DESC);

ALTER TABLE reconciliation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_access_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE reconciliation_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_items FORCE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries FORCE ROW LEVEL SECURITY;
ALTER TABLE compliance_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE data_retention_policies FORCE ROW LEVEL SECURITY;
ALTER TABLE admin_access_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON reconciliation_runs;
DROP POLICY IF EXISTS tenant_isolation_policy ON reconciliation_items;
DROP POLICY IF EXISTS tenant_isolation_policy ON webhook_deliveries;
DROP POLICY IF EXISTS tenant_isolation_policy ON compliance_requests;
DROP POLICY IF EXISTS tenant_isolation_policy ON data_retention_policies;
DROP POLICY IF EXISTS tenant_isolation_policy ON admin_access_logs;

CREATE POLICY tenant_isolation_policy ON reconciliation_runs
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON reconciliation_items
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON webhook_deliveries
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON compliance_requests
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON data_retention_policies
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON admin_access_logs
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

GRANT SELECT, INSERT, UPDATE ON reconciliation_runs TO ledger_runtime;
GRANT SELECT, INSERT, UPDATE ON reconciliation_items TO ledger_runtime;
GRANT SELECT, INSERT, UPDATE ON webhook_deliveries TO ledger_runtime;
GRANT SELECT, INSERT, UPDATE ON compliance_requests TO ledger_runtime;
GRANT SELECT, INSERT, UPDATE ON data_retention_policies TO ledger_runtime;
GRANT SELECT, INSERT ON admin_access_logs TO ledger_runtime;
