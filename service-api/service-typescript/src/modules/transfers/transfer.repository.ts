import { uuidv7 } from 'uuidv7';
import sql from '../../infrastructure/database/connection.js';
import { setTenantContext } from '../../infrastructure/database/tenant-context.js';
import { MoneyUtils } from '../../domain/shared/money.utils.js';
import { TenantId, TransferId } from '../../domain/shared/base-types.js';
import { ITransferRepository, Transfer } from './transfer.entity.js';

type TransferRow = {
  id: string;
  tenant_id: string;
  source_account_id: string;
  destination_account_id: string;
  transaction_id: string | null;
  amount_minor: string;
  description: string | null;
  status: Transfer['status'];
  metadata: Record<string, unknown>;
};

export class PostgresTransferRepository implements ITransferRepository {
  async createPosted(input: Transfer, transactionId: string): Promise<Transfer> {
    const id = input.id ?? uuidv7();
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, input.tenant_id);
      const [row] = await sqlTx<TransferRow[]>`
        INSERT INTO transfers (
          id, tenant_id, source_account_id, destination_account_id, transaction_id,
          amount, description, status, metadata, posted_at
        )
        VALUES (
          ${id},
          ${input.tenant_id},
          ${input.source_account_id},
          ${input.destination_account_id},
          ${transactionId},
          ${input.amount_minor.toString()},
          ${input.description ?? null},
          'posted',
          ${sqlTx.json(input.metadata as Parameters<typeof sql.json>[0])},
          NOW()
        )
        RETURNING id, tenant_id, source_account_id, destination_account_id, transaction_id,
                  amount::text AS amount_minor, description, status, metadata
      `;
      if (!row) throw new Error('Falha ao criar transferência');
      await sqlTx`
        INSERT INTO events (id, tenant_id, type, resource_type, resource_id, payload)
        VALUES (
          ${uuidv7()},
          ${input.tenant_id},
          'transfer.posted',
          'transfer',
          ${id},
          ${sqlTx.json({ transaction_id: transactionId, amount_minor: input.amount_minor.toString() })}
        )
      `;
      return this.toTransfer(row);
    });
  }

  async list(tenantId: TenantId): Promise<Transfer[]> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const rows = await sqlTx<TransferRow[]>`
        SELECT id, tenant_id, source_account_id, destination_account_id, transaction_id,
               amount::text AS amount_minor, description, status, metadata
        FROM transfers
        ORDER BY created_at DESC
        LIMIT 100
      `;
      return rows.map((row) => this.toTransfer(row));
    });
  }

  async findById(tenantId: TenantId, id: TransferId): Promise<Transfer | null> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const [row] = await sqlTx<TransferRow[]>`
        SELECT id, tenant_id, source_account_id, destination_account_id, transaction_id,
               amount::text AS amount_minor, description, status, metadata
        FROM transfers
        WHERE id = ${id}
      `;
      return row ? this.toTransfer(row) : null;
    });
  }

  private toTransfer(row: TransferRow): Transfer {
    return {
      id: row.id as Transfer['id'],
      tenant_id: row.tenant_id as Transfer['tenant_id'],
      source_account_id: row.source_account_id as Transfer['source_account_id'],
      destination_account_id: row.destination_account_id as Transfer['destination_account_id'],
      ...(row.transaction_id ? { transaction_id: row.transaction_id } : {}),
      amount_minor: MoneyUtils.fromMinorUnits(row.amount_minor),
      ...(row.description ? { description: row.description } : {}),
      status: row.status,
      metadata: row.metadata ?? {},
    };
  }
}
