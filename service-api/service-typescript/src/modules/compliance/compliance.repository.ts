import { createHash } from 'node:crypto';
import { uuidv7 } from 'uuidv7';
import sql from '../../infrastructure/database/connection.js';
import { setTenantContext } from '../../infrastructure/database/tenant-context.js';
import { CustomerId, TenantId } from '../../domain/shared/base-types.js';

export type ComplianceRequest = {
  id: string;
  customer_id?: CustomerId;
  type: string;
  status: 'pending' | 'completed' | 'rejected';
  reason?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  completed_at?: string;
};

export type RetentionPolicy = {
  id: string;
  domain: string;
  retention_days: number;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

type ComplianceRow = Omit<ComplianceRequest, 'created_at' | 'completed_at'> & {
  created_at: Date;
  completed_at: Date | null;
};
type RetentionRow = Omit<RetentionPolicy, 'created_at'> & { created_at: Date };

export class PostgresComplianceRepository {
  async anonymizeCustomer(
    tenantId: TenantId,
    customerId: CustomerId,
    reason: string
  ): Promise<ComplianceRequest> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const anonymized = `anon_${createHash('sha256').update(`${tenantId}:${customerId}`).digest('hex').slice(0, 16)}`;
      await sqlTx`
        UPDATE customers
        SET name = ${anonymized},
            document = NULL,
            email = NULL,
            phone = NULL,
            metadata = metadata || ${sqlTx.json({ anonymized: true, anonymized_at: new Date().toISOString() })},
            updated_at = NOW()
        WHERE id = ${customerId}
      `;
      const [row] = await sqlTx<ComplianceRow[]>`
        INSERT INTO compliance_requests (
          id, tenant_id, customer_id, type, status, reason, metadata, completed_at
        )
        VALUES (
          ${uuidv7()}, ${tenantId}, ${customerId}, 'customer.anonymize', 'completed', ${reason},
          ${sqlTx.json({ immutable_financial_records_retained: true })}, NOW()
        )
        RETURNING id, customer_id, type, status, reason, metadata, created_at, completed_at
      `;
      if (!row) throw new Error('Falha ao registrar compliance request');
      return this.toCompliance(row);
    });
  }

  async exportCustomer(
    tenantId: TenantId,
    customerId: CustomerId
  ): Promise<Record<string, unknown>> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const [customer] = await sqlTx<Array<Record<string, unknown>>>`
        SELECT id, type, name, document, email, phone, status, metadata, created_at, updated_at
        FROM customers
        WHERE id = ${customerId}
      `;
      const accounts = await sqlTx<Array<Record<string, unknown>>>`
        SELECT id, name, status, balance::text AS balance_minor, direction, metadata
        FROM accounts
        WHERE customer_id = ${customerId}
      `;
      return { customer, accounts };
    });
  }

  async listRequests(tenantId: TenantId): Promise<ComplianceRequest[]> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const rows = await sqlTx<ComplianceRow[]>`
        SELECT id, customer_id, type, status, reason, metadata, created_at, completed_at
        FROM compliance_requests ORDER BY created_at DESC LIMIT 100
      `;
      return rows.map((row) => this.toCompliance(row));
    });
  }

  async upsertRetentionPolicy(
    tenantId: TenantId,
    input: {
      domain: string;
      retention_days: number;
      action: string;
      metadata: Record<string, unknown>;
    }
  ): Promise<RetentionPolicy> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const [row] = await sqlTx<RetentionRow[]>`
        INSERT INTO data_retention_policies (id, tenant_id, domain, retention_days, action, metadata)
        VALUES (${uuidv7()}, ${tenantId}, ${input.domain}, ${input.retention_days}, ${input.action},
          ${sqlTx.json(input.metadata as Parameters<typeof sql.json>[0])})
        ON CONFLICT (tenant_id, domain) DO UPDATE SET
          retention_days = EXCLUDED.retention_days,
          action = EXCLUDED.action,
          metadata = EXCLUDED.metadata
        RETURNING id, domain, retention_days, action, metadata, created_at
      `;
      if (!row) throw new Error('Falha ao salvar retention policy');
      return this.toRetention(row);
    });
  }

  async listRetentionPolicies(tenantId: TenantId): Promise<RetentionPolicy[]> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const rows = await sqlTx<RetentionRow[]>`
        SELECT id, domain, retention_days, action, metadata, created_at
        FROM data_retention_policies ORDER BY domain
      `;
      return rows.map((row) => this.toRetention(row));
    });
  }

  private toCompliance(row: ComplianceRow): ComplianceRequest {
    return {
      id: row.id,
      ...(row.customer_id ? { customer_id: row.customer_id } : {}),
      type: row.type,
      status: row.status,
      ...(row.reason ? { reason: row.reason } : {}),
      metadata: row.metadata,
      created_at: row.created_at.toISOString(),
      ...(row.completed_at ? { completed_at: row.completed_at.toISOString() } : {}),
    };
  }

  private toRetention(row: RetentionRow): RetentionPolicy {
    return { ...row, created_at: row.created_at.toISOString() };
  }
}
