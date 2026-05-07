import { uuidv7 } from 'uuidv7';
import sql from '../../infrastructure/database/connection.js';
import { setTenantContext } from '../../infrastructure/database/tenant-context.js';
import { MoneyMovementId, NotFoundError, TenantId } from '../../domain/shared/base-types.js';
import { MoneyUtils } from '../../domain/shared/money.utils.js';
import { IMoneyMovementRepository, MoneyMovement } from './money-movement.entity.js';

type MovementRow = {
  id: string;
  tenant_id: string;
  type: MoneyMovement['type'];
  source_account_id: string | null;
  destination_account_id: string | null;
  transaction_id: string | null;
  amount_minor: string;
  description: string | null;
  status: MoneyMovement['status'];
  metadata: Record<string, unknown>;
};

export class PostgresMoneyMovementRepository implements IMoneyMovementRepository {
  async createPosted(input: MoneyMovement, transactionId: string): Promise<MoneyMovement> {
    const id = input.id ?? uuidv7();
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, input.tenant_id);
      const [row] = await sqlTx<MovementRow[]>`
        INSERT INTO money_movements (
          id, tenant_id, type, source_account_id, destination_account_id, transaction_id,
          amount, description, status, metadata, posted_at
        )
        VALUES (
          ${id},
          ${input.tenant_id},
          ${input.type},
          ${input.source_account_id ?? null},
          ${input.destination_account_id ?? null},
          ${transactionId},
          ${input.amount_minor.toString()},
          ${input.description ?? null},
          'posted',
          ${sqlTx.json(input.metadata as Parameters<typeof sql.json>[0])},
          NOW()
        )
        RETURNING id, tenant_id, type, source_account_id, destination_account_id, transaction_id,
                  amount::text AS amount_minor, description, status, metadata
      `;
      if (!row) throw new Error('Falha ao criar money movement');
      await sqlTx`
        INSERT INTO events (id, tenant_id, type, resource_type, resource_id, payload)
        VALUES (
          ${uuidv7()},
          ${input.tenant_id},
          ${`${input.type}.posted`},
          'money_movement',
          ${id},
          ${sqlTx.json({ transaction_id: transactionId, amount_minor: input.amount_minor.toString() })}
        )
      `;
      return this.toMovement(row);
    });
  }

  async list(tenantId: TenantId, type?: MoneyMovement['type']): Promise<MoneyMovement[]> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const rows = await sqlTx<MovementRow[]>`
        SELECT id, tenant_id, type, source_account_id, destination_account_id, transaction_id,
               amount::text AS amount_minor, description, status, metadata
        FROM money_movements
        WHERE (${type ?? null}::movement_type IS NULL OR type = ${type ?? null})
        ORDER BY created_at DESC
        LIMIT 100
      `;
      return rows.map((row) => this.toMovement(row));
    });
  }

  async findById(tenantId: TenantId, id: MoneyMovementId): Promise<MoneyMovement | null> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const [row] = await sqlTx<MovementRow[]>`
        SELECT id, tenant_id, type, source_account_id, destination_account_id, transaction_id,
               amount::text AS amount_minor, description, status, metadata
        FROM money_movements
        WHERE id = ${id}
      `;
      return row ? this.toMovement(row) : null;
    });
  }

  async setStatus(
    tenantId: TenantId,
    id: MoneyMovementId,
    status: MoneyMovement['status']
  ): Promise<MoneyMovement> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const [row] = await sqlTx<MovementRow[]>`
        UPDATE money_movements
        SET status = ${status}
        WHERE tenant_id = ${tenantId} AND id = ${id}
        RETURNING id, tenant_id, type, source_account_id, destination_account_id, transaction_id,
                  amount::text AS amount_minor, description, status, metadata
      `;
      if (!row) throw new NotFoundError('Money movement');
      return this.toMovement(row);
    });
  }

  private toMovement(row: MovementRow): MoneyMovement {
    return {
      id: row.id as MoneyMovement['id'],
      tenant_id: row.tenant_id as MoneyMovement['tenant_id'],
      type: row.type,
      ...(row.source_account_id ? { source_account_id: row.source_account_id as never } : {}),
      ...(row.destination_account_id
        ? { destination_account_id: row.destination_account_id as never }
        : {}),
      ...(row.transaction_id ? { transaction_id: row.transaction_id } : {}),
      amount_minor: MoneyUtils.fromMinorUnits(row.amount_minor),
      ...(row.description ? { description: row.description } : {}),
      status: row.status,
      metadata: row.metadata ?? {},
    };
  }
}
