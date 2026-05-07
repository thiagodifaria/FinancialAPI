import sql, { SqlExecutor } from '../../infrastructure/database/connection.js';
import {
  ConflictError,
  DomainError,
  NotFoundError,
  TenantId,
} from '../../domain/shared/base-types.js';
import { MoneyUtils } from '../../domain/shared/money.utils.js';
import { Transaction, ITransactionRepository, Entry } from './transaction.entity.js';
import { IAccountRepository } from '../accounts/account.entity.js';
import { calculateNewBalance, validateDoubleEntry } from './transaction.logic.js';
import { uuidv7 } from 'uuidv7';
import { incrementLedgerPostings } from '../../infrastructure/observability/metrics.js';

type EntryRow = {
  id: string;
  account_id: string;
  amount_minor: string;
  direction: Entry['direction'];
};

type TransactionRow = {
  id: string;
  tenant_id: string;
  description: string | null;
  metadata: Record<string, unknown>;
};

export class PostgresTransactionRepository implements ITransactionRepository {
  constructor(private accountRepo: IAccountRepository) {}

  private async setTenantContext(query: SqlExecutor, tenantId: string): Promise<void> {
    await query`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
  }

  private toEntry(row: EntryRow): Entry {
    return {
      id: row.id,
      account_id: row.account_id as Entry['account_id'],
      amount_minor: MoneyUtils.fromMinorUnits(row.amount_minor),
      direction: row.direction,
    };
  }

  async create(transaction: Transaction, idempotencyKey?: string): Promise<Transaction> {
    validateDoubleEntry(transaction.entries);
    const txId = transaction.id || uuidv7();

    const createdTransaction = await sql.begin(async (sqlTx) => {
      // Define o contexto do Tenant para RLS
      await this.setTenantContext(sqlTx, transaction.tenant_id);

      await sqlTx`
        INSERT INTO transactions (id, tenant_id, description, idempotency_key, metadata)
        VALUES (
          ${txId},
          ${transaction.tenant_id},
          ${transaction.description ?? null},
          ${idempotencyKey ?? null},
          ${sqlTx.json(transaction.metadata as Parameters<typeof sql.json>[0])}
        )
      `;

      const createdEntries: Entry[] = [];

      for (const entry of transaction.entries) {
        const entryId = entry.id || uuidv7();

        const account = await this.accountRepo.findByIdForUpdate(
          transaction.tenant_id,
          entry.account_id,
          sqlTx
        );
        if (!account) throw new NotFoundError(`Conta ${entry.account_id}`);
        if (account.status !== 'active') {
          throw new DomainError(
            `Conta ${entry.account_id} não aceita movimentação no status ${account.status}`,
            'ACCOUNT_NOT_MOVABLE',
            422
          );
        }

        const newBalance = calculateNewBalance(
          account.balance_minor,
          account.direction,
          entry.direction,
          entry.amount_minor
        );
        await this.accountRepo.updateBalance(transaction.tenant_id, account.id!, newBalance, sqlTx);

        const [createdEntry] = await sqlTx<EntryRow[]>`
          INSERT INTO entries (id, tenant_id, transaction_id, account_id, amount, direction)
          VALUES (
            ${entryId},
            ${transaction.tenant_id},
            ${txId},
            ${entry.account_id},
            ${entry.amount_minor.toString()},
            ${entry.direction}
          )
          RETURNING id, account_id, amount::text AS amount_minor, direction
        `;
        if (!createdEntry) throw new Error('Falha ao criar lançamento');
        createdEntries.push(this.toEntry(createdEntry));
      }

      return {
        id: txId,
        tenant_id: transaction.tenant_id,
        ...(transaction.description ? { description: transaction.description } : {}),
        entries: createdEntries,
        metadata: transaction.metadata,
      };
    });
    incrementLedgerPostings();
    return createdTransaction;
  }

  async list(tenantId: TenantId): Promise<Transaction[]> {
    return await sql.begin(async (sqlTx) => {
      await this.setTenantContext(sqlTx, tenantId);
      const rows = await sqlTx<TransactionRow[]>`
        SELECT id, tenant_id, description, metadata
        FROM transactions
        ORDER BY created_at DESC
        LIMIT 100
      `;

      const result: Transaction[] = [];
      for (const row of rows) {
        const transaction = await this.findById(tenantId, row.id);
        if (transaction) result.push(transaction);
      }
      return result;
    });
  }

  async findById(tenantId: TenantId, id: string): Promise<Transaction | null> {
    return await sql.begin(async (sqlTx) => {
      await this.setTenantContext(sqlTx, tenantId);
      const [transaction] = await sqlTx<TransactionRow[]>`
        SELECT id, tenant_id, description, metadata
        FROM transactions
        WHERE id = ${id}
      `;
      if (!transaction) return null;

      const entries = await sqlTx<EntryRow[]>`
        SELECT id, account_id, amount::text AS amount_minor, direction
        FROM entries
        WHERE transaction_id = ${id}
        ORDER BY created_at ASC
      `;

      return {
        id: transaction.id,
        tenant_id: transaction.tenant_id as Transaction['tenant_id'],
        ...(transaction.description ? { description: transaction.description } : {}),
        entries: entries.map((entry) => this.toEntry(entry)),
        metadata: transaction.metadata ?? {},
      };
    });
  }

  async reverse(tenantId: TenantId, id: string, description?: string): Promise<Transaction> {
    const original = await this.findById(tenantId, id);
    if (!original) throw new NotFoundError('Transação');

    const existing = await sql.begin(async (sqlTx) => {
      await this.setTenantContext(sqlTx, tenantId);
      const [row] = await sqlTx<TransactionRow[]>`
        SELECT id, tenant_id, description, metadata
        FROM transactions
        WHERE metadata->>'reversed_transaction_id' = ${id}
        LIMIT 1
      `;
      return row;
    });
    if (existing)
      throw new ConflictError('Transação já foi revertida', 'TRANSACTION_ALREADY_REVERSED');

    return await this.create({
      tenant_id: tenantId,
      description: description ?? `Reversal of ${id}`,
      metadata: {
        reversed_transaction_id: id,
        kind: 'reversal',
      },
      entries: original.entries.map((entry) => ({
        account_id: entry.account_id,
        amount_minor: entry.amount_minor,
        direction: entry.direction === 'debit' ? 'credit' : 'debit',
      })),
    });
  }
}
