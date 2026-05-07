import { uuidv7 } from 'uuidv7';
import sql from '../../infrastructure/database/connection.js';
import { setTenantContext } from '../../infrastructure/database/tenant-context.js';
import { TenantId } from '../../domain/shared/base-types.js';
import {
  incrementDomainMetric,
  setReconciliationGauge,
} from '../../infrastructure/observability/metrics.js';

export type ReconciliationRun = {
  id: string;
  tenant_id: TenantId;
  status: 'pending' | 'running' | 'completed' | 'failed';
  period_start: string;
  period_end: string;
  summary: Record<string, unknown>;
  created_at: string;
};

export type ReconciliationItem = {
  id: string;
  run_id: string;
  status: 'matched' | 'difference' | 'missing_ledger' | 'missing_movement';
  resource_type: string;
  resource_id?: string;
  expected_amount_minor?: bigint;
  actual_amount_minor?: bigint;
  details: Record<string, unknown>;
  created_at: string;
};

type RunRow = Omit<ReconciliationRun, 'created_at'> & { created_at: Date };
type ItemRow = Omit<
  ReconciliationItem,
  'created_at' | 'expected_amount_minor' | 'actual_amount_minor'
> & {
  expected_amount_minor: string | null;
  actual_amount_minor: string | null;
  created_at: Date;
};

export class PostgresReconciliationRepository {
  async createRun(
    tenantId: TenantId,
    input: { period_start: string; period_end: string }
  ): Promise<ReconciliationRun> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const id = uuidv7();

      const [ledger] = await sqlTx<{ entries_amount: string; entries_count: number }[]>`
        SELECT COALESCE(SUM(amount), 0)::text AS entries_amount, COUNT(*)::int AS entries_count
        FROM entries
        WHERE created_at::date BETWEEN ${input.period_start} AND ${input.period_end}
      `;
      const [movements] = await sqlTx<{ movements_amount: string; movements_count: number }[]>`
        SELECT COALESCE(SUM(amount), 0)::text AS movements_amount, COUNT(*)::int AS movements_count
        FROM money_movements
        WHERE created_at::date BETWEEN ${input.period_start} AND ${input.period_end}
      `;

      const expected = BigInt(ledger?.entries_amount ?? '0');
      const actual = BigInt(movements?.movements_amount ?? '0');
      const status = expected === actual ? 'matched' : 'difference';
      const summary = {
        entries_count: ledger?.entries_count ?? 0,
        movements_count: movements?.movements_count ?? 0,
        entries_amount_minor: expected.toString(),
        movements_amount_minor: actual.toString(),
        differences: status === 'matched' ? 0 : 1,
      };
      incrementDomainMetric('reconciliation', 'run_completed');
      setReconciliationGauge('last_differences', Number(summary.differences));
      setReconciliationGauge('last_entries_count', Number(summary.entries_count));
      setReconciliationGauge('last_movements_count', Number(summary.movements_count));

      const [run] = await sqlTx<RunRow[]>`
        INSERT INTO reconciliation_runs (id, tenant_id, status, period_start, period_end, summary, started_at, completed_at)
        VALUES (${id}, ${tenantId}, 'completed', ${input.period_start}, ${input.period_end},
          ${sqlTx.json(summary)}, NOW(), NOW())
        RETURNING id, tenant_id, status, period_start::text, period_end::text, summary, created_at
      `;
      if (!run) throw new Error('Falha ao criar reconciliation run');

      await sqlTx`
        INSERT INTO reconciliation_items (
          id, tenant_id, run_id, status, resource_type, expected_amount, actual_amount, details
        )
        VALUES (
          ${uuidv7()}, ${tenantId}, ${id}, ${status}, 'ledger_vs_money_movements',
          ${expected.toString()}, ${actual.toString()}, ${sqlTx.json(summary)}
        )
      `;

      return this.toRun(run);
    });
  }

  async listRuns(tenantId: TenantId): Promise<ReconciliationRun[]> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const rows = await sqlTx<RunRow[]>`
        SELECT id, tenant_id, status, period_start::text, period_end::text, summary, created_at
        FROM reconciliation_runs ORDER BY created_at DESC LIMIT 100
      `;
      return rows.map((row) => this.toRun(row));
    });
  }

  async listItems(tenantId: TenantId, runId: string): Promise<ReconciliationItem[]> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const rows = await sqlTx<ItemRow[]>`
        SELECT id, run_id, status, resource_type, resource_id,
          expected_amount::text AS expected_amount_minor,
          actual_amount::text AS actual_amount_minor,
          details, created_at
        FROM reconciliation_items
        WHERE run_id = ${runId}
        ORDER BY created_at DESC
      `;
      return rows.map((row) => this.toItem(row));
    });
  }

  async ledgerBalancesReport(tenantId: TenantId): Promise<Array<Record<string, unknown>>> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      return await sqlTx<Array<Record<string, unknown>>>`
        SELECT id AS account_id, customer_id, status, balance::text AS balance_minor, direction, metadata
        FROM accounts
        ORDER BY created_at DESC
        LIMIT 500
      `;
    });
  }

  async reconciliationReport(tenantId: TenantId): Promise<Array<Record<string, unknown>>> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      return await sqlTx<Array<Record<string, unknown>>>`
        SELECT id, status, period_start::text, period_end::text, summary, created_at
        FROM reconciliation_runs
        ORDER BY created_at DESC
        LIMIT 50
      `;
    });
  }

  async outboxReport(tenantId: TenantId): Promise<Array<Record<string, unknown>>> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      return await sqlTx<Array<Record<string, unknown>>>`
        SELECT status, COUNT(*)::int AS total, MIN(created_at) AS oldest_created_at
        FROM outbox_events
        GROUP BY status
        ORDER BY status
      `;
    });
  }

  private toRun(row: RunRow): ReconciliationRun {
    return { ...row, created_at: row.created_at.toISOString() };
  }

  private toItem(row: ItemRow): ReconciliationItem {
    return {
      id: row.id,
      run_id: row.run_id,
      status: row.status,
      resource_type: row.resource_type,
      ...(row.resource_id ? { resource_id: row.resource_id } : {}),
      ...(row.expected_amount_minor
        ? { expected_amount_minor: BigInt(row.expected_amount_minor) }
        : {}),
      ...(row.actual_amount_minor ? { actual_amount_minor: BigInt(row.actual_amount_minor) } : {}),
      details: row.details,
      created_at: row.created_at.toISOString(),
    };
  }
}
