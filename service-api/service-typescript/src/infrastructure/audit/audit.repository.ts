import sql from '../database/connection.js';
import { setTenantContext } from '../database/tenant-context.js';
import { TenantId } from '../../domain/shared/base-types.js';

export type AuditLog = {
  id: string;
  tenant_id: TenantId;
  action: string;
  resource_type: string;
  resource_id: string;
  payload: Record<string, unknown>;
  request_id?: string;
  user_id?: string;
  idempotency_key?: string;
  transaction_id?: string;
  user_agent?: string;
  ip_address?: string;
  created_at: string;
};

type AuditRow = Omit<AuditLog, 'created_at'> & { created_at: Date };

export class PostgresAuditRepository {
  async write(input: Omit<AuditLog, 'id' | 'created_at'>): Promise<void> {
    await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, input.tenant_id);
      await sqlTx`
        INSERT INTO audit_logs (
          tenant_id, action, resource_type, resource_id, payload, request_id,
          user_id, idempotency_key, transaction_id, user_agent, ip_address
        )
        VALUES (
          ${input.tenant_id}, ${input.action}, ${input.resource_type}, ${input.resource_id},
          ${sqlTx.json(input.payload as Parameters<typeof sql.json>[0])},
          ${input.request_id ?? null}, ${input.user_id ?? null}, ${input.idempotency_key ?? null},
          ${input.transaction_id ?? null}, ${input.user_agent ?? null}, ${input.ip_address ?? null}
        )
      `;
    });
  }

  async list(tenantId: TenantId): Promise<AuditLog[]> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const rows = await sqlTx<AuditRow[]>`
        SELECT id, tenant_id, action, resource_type, resource_id, payload, request_id,
               user_id, idempotency_key, transaction_id, user_agent, ip_address, created_at
        FROM audit_logs
        ORDER BY created_at DESC
        LIMIT 200
      `;
      return rows.map((row) => ({
        ...row,
        created_at: row.created_at.toISOString(),
      }));
    });
  }
}
