import sql, { SqlExecutor } from '../../infrastructure/database/connection.js';
import { MoneyUtils } from '../../domain/shared/money.utils.js';
import { setTenantContext } from '../../infrastructure/database/tenant-context.js';
import {
  Account,
  AccountEntry,
  AccountListFilters,
  AccountTransaction,
  IAccountRepository,
} from './account.entity.js';
import { AccountId, TenantId } from '../../domain/shared/base-types.js';
import { uuidv7 } from 'uuidv7';

type AccountRow = {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  name: string | null;
  balance_minor: string;
  direction: Account['direction'];
  status: Account['status'];
  metadata: Record<string, unknown>;
};

type EntryRow = {
  id: string;
  transaction_id: string;
  account_id: string;
  amount_minor: string;
  direction: Account['direction'];
  created_at: Date;
};

type AccountTransactionRow = {
  id: string;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
};

export class PostgresAccountRepository implements IAccountRepository {
  /**
   * Define o contexto do Tenant para o Row Level Security (RLS) do Postgres.
   */
  private async setTenantContext(query: SqlExecutor, tenantId: string): Promise<void> {
    await setTenantContext(query, tenantId);
  }

  private toAccount(row: AccountRow): Account {
    return {
      id: row.id,
      tenant_id: row.tenant_id as Account['tenant_id'],
      ...(row.customer_id ? { customer_id: row.customer_id as Account['customer_id'] } : {}),
      ...(row.name ? { name: row.name } : {}),
      balance_minor: MoneyUtils.fromMinorUnits(row.balance_minor),
      direction: row.direction,
      status: row.status,
      metadata: row.metadata ?? {},
    };
  }

  async create(account: Account): Promise<Account> {
    const id = account.id || uuidv7();

    return await sql.begin(async (sqlTx) => {
      await this.setTenantContext(sqlTx, account.tenant_id);

      const [result] = await sqlTx<AccountRow[]>`
        INSERT INTO accounts (id, tenant_id, customer_id, name, balance, direction, status, metadata)
        VALUES (
          ${id},
          ${account.tenant_id},
          ${account.customer_id ?? null},
          ${account.name ?? null},
          ${account.balance_minor.toString()},
          ${account.direction},
          ${account.status},
          ${sqlTx.json(account.metadata as Parameters<typeof sql.json>[0])}
        )
        RETURNING id, tenant_id, customer_id, name, balance::text AS balance_minor, direction, status, metadata
      `;
      if (!result) throw new Error('Falha ao criar conta');
      return this.toAccount(result);
    });
  }

  async list(tenantId: TenantId, filters: AccountListFilters = {}): Promise<Account[]> {
    const limit = Math.min(filters.limit ?? 100, 200);
    const offset = filters.offset ?? 0;
    return await sql.begin(async (sqlTx) => {
      await this.setTenantContext(sqlTx, tenantId);
      const rows = await sqlTx<AccountRow[]>`
        SELECT id, tenant_id, customer_id, name, balance::text AS balance_minor, direction, status, metadata
        FROM accounts
        WHERE (${filters.customer_id ?? null}::uuid IS NULL OR customer_id = ${filters.customer_id ?? null})
          AND (${filters.status ?? null}::lifecycle_status_type IS NULL OR status = ${filters.status ?? null})
        ORDER BY created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
      return rows.map((row) => this.toAccount(row));
    });
  }

  async findById(tenantId: Account['tenant_id'], id: string): Promise<Account | null> {
    return await sql.begin(async (sqlTx) => {
      await this.setTenantContext(sqlTx, tenantId);
      const [result] = await sqlTx<AccountRow[]>`
        SELECT id, tenant_id, customer_id, name, balance::text AS balance_minor, direction, status, metadata
        FROM accounts
        WHERE id = ${id}
      `;
      return result ? this.toAccount(result) : null;
    });
  }

  async findByIdForUpdate(
    tenantId: Account['tenant_id'],
    id: string,
    sqlTransaction: SqlExecutor
  ): Promise<Account | null> {
    const [result] = await sqlTransaction<AccountRow[]>`
      SELECT id, tenant_id, customer_id, name, balance::text AS balance_minor, direction, status, metadata
      FROM accounts
      WHERE id = ${id} AND tenant_id = ${tenantId}
      FOR UPDATE
    `;
    return result ? this.toAccount(result) : null;
  }

  async updateBalance(
    tenantId: Account['tenant_id'],
    id: string,
    newBalance: Account['balance_minor'],
    sqlTransaction: SqlExecutor
  ): Promise<void> {
    await sqlTransaction`
      UPDATE accounts
      SET balance = ${newBalance.toString()}
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
  }

  async listEntries(tenantId: TenantId, accountId: AccountId): Promise<AccountEntry[]> {
    return await sql.begin(async (sqlTx) => {
      await this.setTenantContext(sqlTx, tenantId);
      const rows = await sqlTx<EntryRow[]>`
        SELECT id, transaction_id, account_id, amount::text AS amount_minor, direction, created_at
        FROM entries
        WHERE account_id = ${accountId}
        ORDER BY created_at DESC
        LIMIT 100
      `;
      return rows.map((row) => ({
        id: row.id,
        transaction_id: row.transaction_id,
        account_id: row.account_id as AccountId,
        amount_minor: MoneyUtils.fromMinorUnits(row.amount_minor),
        direction: row.direction,
        created_at: row.created_at.toISOString(),
      }));
    });
  }

  async listTransactions(tenantId: TenantId, accountId: AccountId): Promise<AccountTransaction[]> {
    return await sql.begin(async (sqlTx) => {
      await this.setTenantContext(sqlTx, tenantId);
      const rows = await sqlTx<AccountTransactionRow[]>`
        SELECT DISTINCT t.id, t.description, t.metadata, t.created_at
        FROM transactions t
        JOIN entries e ON e.transaction_id = t.id AND e.tenant_id = t.tenant_id
        WHERE e.account_id = ${accountId}
        ORDER BY t.created_at DESC
        LIMIT 100
      `;
      return rows.map((row) => ({
        id: row.id,
        ...(row.description ? { description: row.description } : {}),
        metadata: row.metadata ?? {},
        created_at: row.created_at.toISOString(),
      }));
    });
  }

  async sumActiveHolds(
    tenantId: TenantId,
    accountId: AccountId
  ): Promise<Account['balance_minor']> {
    return await sql.begin(async (sqlTx) => {
      await this.setTenantContext(sqlTx, tenantId);
      const [row] = await sqlTx<{ total_minor: string | null }[]>`
        SELECT COALESCE(SUM(amount), 0)::text AS total_minor
        FROM holds
        WHERE account_id = ${accountId}
          AND status = 'active'
          AND (expires_at IS NULL OR expires_at > NOW())
      `;
      return MoneyUtils.fromMinorUnits(row?.total_minor ?? '0');
    });
  }
}
