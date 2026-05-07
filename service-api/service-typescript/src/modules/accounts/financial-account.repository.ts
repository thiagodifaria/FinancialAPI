import { uuidv7 } from 'uuidv7';
import sql from '../../infrastructure/database/connection.js';
import { setTenantContext } from '../../infrastructure/database/tenant-context.js';
import {
  FinancialAccountId,
  HoldId,
  NotFoundError,
  TenantId,
} from '../../domain/shared/base-types.js';
import { MoneyUtils } from '../../domain/shared/money.utils.js';
import { FinancialAccount, Hold, IFinancialAccountRepository } from './financial-account.entity.js';

type FinancialAccountRow = {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  ledger_account_id: string;
  name: string | null;
  status: FinancialAccount['status'];
  metadata: Record<string, unknown>;
};

type HoldRow = {
  id: string;
  tenant_id: string;
  account_id: string;
  amount_minor: string;
  status: Hold['status'];
  expires_at: Date | null;
  metadata: Record<string, unknown>;
};

export class PostgresFinancialAccountRepository implements IFinancialAccountRepository {
  async create(input: FinancialAccount): Promise<FinancialAccount> {
    const id = input.id ?? uuidv7();
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, input.tenant_id);
      const [row] = await sqlTx<FinancialAccountRow[]>`
        INSERT INTO financial_accounts (id, tenant_id, customer_id, ledger_account_id, name, status, metadata)
        VALUES (
          ${id}, ${input.tenant_id}, ${input.customer_id ?? null}, ${input.ledger_account_id},
          ${input.name ?? null}, ${input.status}, ${sqlTx.json(input.metadata as never)}
        )
        RETURNING id, tenant_id, customer_id, ledger_account_id, name, status, metadata
      `;
      if (!row) throw new Error('Falha ao criar financial account');
      return this.toFinancialAccount(row);
    });
  }

  async list(tenantId: TenantId): Promise<FinancialAccount[]> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const rows = await sqlTx<FinancialAccountRow[]>`
        SELECT id, tenant_id, customer_id, ledger_account_id, name, status, metadata
        FROM financial_accounts
        ORDER BY created_at DESC
      `;
      return rows.map((row) => this.toFinancialAccount(row));
    });
  }

  async createHold(input: Hold): Promise<Hold> {
    const id = input.id ?? uuidv7();
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, input.tenant_id);
      const [row] = await sqlTx<HoldRow[]>`
        INSERT INTO holds (id, tenant_id, account_id, amount, status, expires_at, metadata)
        VALUES (
          ${id}, ${input.tenant_id}, ${input.account_id}, ${input.amount_minor.toString()},
          ${input.status}, ${input.expires_at ?? null}, ${sqlTx.json(input.metadata as never)}
        )
        RETURNING id, tenant_id, account_id, amount::text AS amount_minor, status, expires_at, metadata
      `;
      if (!row) throw new Error('Falha ao criar hold');
      return this.toHold(row);
    });
  }

  async listHolds(tenantId: TenantId, accountId?: string): Promise<Hold[]> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const rows = await sqlTx<HoldRow[]>`
        SELECT id, tenant_id, account_id, amount::text AS amount_minor, status, expires_at, metadata
        FROM holds
        WHERE (${accountId ?? null}::uuid IS NULL OR account_id = ${accountId ?? null})
        ORDER BY created_at DESC
        LIMIT 100
      `;
      return rows.map((row) => this.toHold(row));
    });
  }

  async setHoldStatus(tenantId: TenantId, id: HoldId, status: Hold['status']): Promise<Hold> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const [row] = await sqlTx<HoldRow[]>`
        UPDATE holds
        SET status = ${status}, released_at = CASE WHEN ${status} IN ('released', 'captured') THEN NOW() ELSE released_at END
        WHERE tenant_id = ${tenantId} AND id = ${id}
        RETURNING id, tenant_id, account_id, amount::text AS amount_minor, status, expires_at, metadata
      `;
      if (!row) throw new NotFoundError('Hold');
      return this.toHold(row);
    });
  }

  private toFinancialAccount(row: FinancialAccountRow): FinancialAccount {
    return {
      id: row.id as FinancialAccountId,
      tenant_id: row.tenant_id as TenantId,
      ...(row.customer_id ? { customer_id: row.customer_id as never } : {}),
      ledger_account_id: row.ledger_account_id as never,
      ...(row.name ? { name: row.name } : {}),
      status: row.status,
      metadata: row.metadata ?? {},
    };
  }

  private toHold(row: HoldRow): Hold {
    return {
      id: row.id as HoldId,
      tenant_id: row.tenant_id as TenantId,
      account_id: row.account_id as never,
      amount_minor: MoneyUtils.fromMinorUnits(row.amount_minor),
      status: row.status,
      ...(row.expires_at ? { expires_at: row.expires_at.toISOString() } : {}),
      metadata: row.metadata ?? {},
    };
  }
}
