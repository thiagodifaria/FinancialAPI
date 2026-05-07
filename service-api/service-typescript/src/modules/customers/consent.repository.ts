import { uuidv7 } from 'uuidv7';
import sql from '../../infrastructure/database/connection.js';
import { setTenantContext } from '../../infrastructure/database/tenant-context.js';
import { CustomerId, TenantId } from '../../domain/shared/base-types.js';

export type CustomerConsent = {
  id: string;
  tenant_id: TenantId;
  customer_id: CustomerId;
  type: string;
  version: string;
  accepted_at: string;
  metadata: Record<string, unknown>;
};

type ConsentRow = Omit<CustomerConsent, 'accepted_at'> & { accepted_at: Date };

export class PostgresConsentRepository {
  async create(input: Omit<CustomerConsent, 'id' | 'accepted_at'>): Promise<CustomerConsent> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, input.tenant_id);
      const [row] = await sqlTx<ConsentRow[]>`
        INSERT INTO customer_consents (id, tenant_id, customer_id, type, version, metadata)
        VALUES (
          ${uuidv7()}, ${input.tenant_id}, ${input.customer_id}, ${input.type}, ${input.version},
          ${sqlTx.json(input.metadata as Parameters<typeof sql.json>[0])}
        )
        ON CONFLICT (tenant_id, customer_id, type, version)
        DO UPDATE SET accepted_at = NOW(), metadata = EXCLUDED.metadata
        RETURNING id, tenant_id, customer_id, type, version, accepted_at, metadata
      `;
      if (!row) throw new Error('Falha ao registrar consentimento');
      return this.toConsent(row);
    });
  }

  async list(tenantId: TenantId, customerId: CustomerId): Promise<CustomerConsent[]> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const rows = await sqlTx<ConsentRow[]>`
        SELECT id, tenant_id, customer_id, type, version, accepted_at, metadata
        FROM customer_consents
        WHERE customer_id = ${customerId}
        ORDER BY accepted_at DESC
      `;
      return rows.map((row) => this.toConsent(row));
    });
  }

  private toConsent(row: ConsentRow): CustomerConsent {
    return {
      ...row,
      accepted_at: row.accepted_at.toISOString(),
    };
  }
}
