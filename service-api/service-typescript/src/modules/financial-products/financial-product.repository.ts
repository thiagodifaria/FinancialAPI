import { uuidv7 } from 'uuidv7';
import sql from '../../infrastructure/database/connection.js';
import { setTenantContext } from '../../infrastructure/database/tenant-context.js';
import { MoneyUtils } from '../../domain/shared/money.utils.js';
import {
  AccountStatusAction,
  AccountTransition,
  Boleto,
  Card,
  CardAuthorization,
  CardProduct,
  ExternalAccount,
  FeeId,
  FeeCharge,
  FeeSchedule,
  PaymentMethod,
  PixCharge,
  PixKey,
  PricingRule,
  Statement,
  StatementId,
  StatementRequest,
  AccountLimit,
} from './financial-product.entity.js';
import {
  AccountId,
  ExternalAccountId,
  FeeScheduleId,
  NotFoundError,
  TenantId,
} from '../../domain/shared/base-types.js';

type LimitRow = {
  account_id: string;
  tenant_id: string;
  daily_limit_minor: string | null;
  monthly_limit_minor: string | null;
  per_transaction_limit_minor: string | null;
  currency: string;
  metadata: Record<string, unknown>;
};

type ExternalAccountRow = {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  holder_name: string;
  institution_name: string;
  account_number_last4: string;
  routing_number: string | null;
  status: ExternalAccount['status'];
  metadata: Record<string, unknown>;
};

type PaymentMethodRow = {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  external_account_id: string | null;
  type: PaymentMethod['type'];
  label: string;
  token: string;
  status: PaymentMethod['status'];
  metadata: Record<string, unknown>;
};

type FeeScheduleRow = {
  id: string;
  tenant_id: string;
  name: string;
  product: string;
  rail: string;
  fixed_amount_minor: string;
  percent_bps: number;
  min_amount_minor: string;
  max_amount_minor: string | null;
  status: FeeSchedule['status'];
  metadata: Record<string, unknown>;
};

type FeeRow = {
  id: string;
  tenant_id: string;
  fee_schedule_id: string | null;
  account_id: string;
  transaction_id: string | null;
  amount_minor: string;
  status: string;
  metadata: Record<string, unknown>;
};

type PricingRuleRow = {
  id: string;
  tenant_id: string;
  fee_schedule_id: string | null;
  product: string;
  rail: string;
  min_amount_minor: string;
  max_amount_minor: string | null;
  fixed_amount_minor: string;
  percent_bps: number;
  status: PricingRule['status'];
  metadata: Record<string, unknown>;
};

type PixKeyRow = PixKey & { id: string };
type PixChargeRow = Omit<PixCharge, 'amount_minor'> & { id: string; amount_minor: string };
type BoletoRow = Omit<Boleto, 'amount_minor'> & {
  id: string;
  barcode: string;
  amount_minor: string;
};
type CardProductRow = CardProduct & { id: string };
type CardRow = Card & { id: string };
type CardAuthorizationRow = Omit<CardAuthorization, 'amount_minor'> & {
  id: string;
  amount_minor: string;
};

export class PostgresFinancialProductRepository {
  async transitionAccount(
    input: AccountStatusAction,
    transition: 'freeze' | 'unfreeze' | 'close'
  ): Promise<AccountTransition> {
    const toStatus = transition === 'unfreeze' ? 'active' : 'blocked';
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, input.tenant_id);
      const [account] = await sqlTx<{ status: string }[]>`
        SELECT status FROM accounts WHERE id = ${input.account_id} FOR UPDATE
      `;
      if (!account) throw new NotFoundError('Conta');

      await sqlTx`
        UPDATE accounts
        SET status = ${toStatus}
        WHERE id = ${input.account_id}
      `;

      const id = uuidv7();
      const [row] = await sqlTx<
        {
          id: string;
          account_id: string;
          transition: AccountTransition['transition'];
          from_status: string;
          to_status: string;
          reason: string | null;
          metadata: Record<string, unknown>;
        }[]
      >`
        INSERT INTO account_status_transitions (
          id, tenant_id, account_id, transition, from_status, to_status, reason, metadata
        )
        VALUES (
          ${id},
          ${input.tenant_id},
          ${input.account_id},
          ${transition},
          ${account.status},
          ${toStatus},
          ${input.reason ?? null},
          ${sqlTx.json(input.metadata as Parameters<typeof sql.json>[0])}
        )
        RETURNING id, account_id, transition, from_status, to_status, reason, metadata
      `;
      if (!row) throw new Error('Falha ao registrar transição de conta');
      return {
        id: row.id,
        account_id: row.account_id,
        transition: row.transition,
        from_status: row.from_status,
        to_status: row.to_status,
        ...(row.reason ? { reason: row.reason } : {}),
        metadata: row.metadata ?? {},
      };
    });
  }

  async upsertLimit(input: AccountLimit): Promise<AccountLimit> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, input.tenant_id);
      const [row] = await sqlTx<LimitRow[]>`
        INSERT INTO account_limits (
          account_id, tenant_id, daily_limit, monthly_limit, per_transaction_limit, currency, metadata, updated_at
        )
        VALUES (
          ${input.account_id},
          ${input.tenant_id},
          ${input.daily_limit_minor?.toString() ?? null},
          ${input.monthly_limit_minor?.toString() ?? null},
          ${input.per_transaction_limit_minor?.toString() ?? null},
          ${input.currency},
          ${sqlTx.json(input.metadata as Parameters<typeof sql.json>[0])},
          NOW()
        )
        ON CONFLICT (account_id) DO UPDATE SET
          daily_limit = EXCLUDED.daily_limit,
          monthly_limit = EXCLUDED.monthly_limit,
          per_transaction_limit = EXCLUDED.per_transaction_limit,
          currency = EXCLUDED.currency,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
        RETURNING account_id, tenant_id, daily_limit::text AS daily_limit_minor,
          monthly_limit::text AS monthly_limit_minor,
          per_transaction_limit::text AS per_transaction_limit_minor, currency, metadata
      `;
      if (!row) throw new Error('Falha ao salvar limites');
      return this.toLimit(row);
    });
  }

  async getLimit(tenantId: TenantId, accountId: AccountId): Promise<AccountLimit | null> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const [row] = await sqlTx<LimitRow[]>`
        SELECT account_id, tenant_id, daily_limit::text AS daily_limit_minor,
          monthly_limit::text AS monthly_limit_minor,
          per_transaction_limit::text AS per_transaction_limit_minor, currency, metadata
        FROM account_limits
        WHERE account_id = ${accountId}
      `;
      return row ? this.toLimit(row) : null;
    });
  }

  async createStatement(input: StatementRequest): Promise<Statement> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, input.tenant_id);
      const [summary] = await sqlTx<
        { credits: string; debits: string; entries_count: number; current_balance: string }[]
      >`
        SELECT
          COALESCE(SUM(CASE WHEN e.direction = 'credit' THEN e.amount ELSE 0 END), 0)::text AS credits,
          COALESCE(SUM(CASE WHEN e.direction = 'debit' THEN e.amount ELSE 0 END), 0)::text AS debits,
          COUNT(e.id)::int AS entries_count,
          a.balance::text AS current_balance
        FROM accounts a
        LEFT JOIN entries e ON e.account_id = a.id
          AND e.created_at::date >= ${input.period_start}
          AND e.created_at::date <= ${input.period_end}
        WHERE a.id = ${input.account_id}
        GROUP BY a.balance
      `;
      if (!summary) throw new NotFoundError('Conta');
      const current = MoneyUtils.fromMinorUnits(summary.current_balance);
      const net =
        MoneyUtils.fromMinorUnits(summary.credits) - MoneyUtils.fromMinorUnits(summary.debits);
      const opening = current - net;
      const id = uuidv7();
      const [row] = await sqlTx<
        {
          id: string;
          tenant_id: string;
          account_id: string;
          period_start: string;
          period_end: string;
          opening_balance_minor: string;
          closing_balance_minor: string;
          entries_count: number;
          metadata: Record<string, unknown>;
        }[]
      >`
        INSERT INTO statements (
          id, tenant_id, account_id, period_start, period_end, opening_balance, closing_balance, entries_count, metadata
        )
        VALUES (
          ${id},
          ${input.tenant_id},
          ${input.account_id},
          ${input.period_start},
          ${input.period_end},
          ${opening.toString()},
          ${current.toString()},
          ${summary.entries_count},
          ${sqlTx.json({ generated_from: 'entries' })}
        )
        ON CONFLICT (tenant_id, account_id, period_start, period_end) DO UPDATE SET
          closing_balance = EXCLUDED.closing_balance,
          entries_count = EXCLUDED.entries_count
        RETURNING id, tenant_id, account_id, period_start::text, period_end::text,
          opening_balance::text AS opening_balance_minor,
          closing_balance::text AS closing_balance_minor, entries_count, metadata
      `;
      if (!row) throw new Error('Falha ao gerar statement');
      return this.toStatement(row);
    });
  }

  async listStatements(tenantId: TenantId, accountId: AccountId): Promise<Statement[]> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const rows = await sqlTx<Parameters<typeof this.toStatement>[0][]>`
        SELECT id, tenant_id, account_id, period_start::text, period_end::text,
          opening_balance::text AS opening_balance_minor,
          closing_balance::text AS closing_balance_minor, entries_count, metadata
        FROM statements
        WHERE account_id = ${accountId}
        ORDER BY period_start DESC
      `;
      return rows.map((row) => this.toStatement(row));
    });
  }

  async getStatement(tenantId: TenantId, id: StatementId): Promise<Statement | null> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const [row] = await sqlTx<Parameters<typeof this.toStatement>[0][]>`
        SELECT id, tenant_id, account_id, period_start::text, period_end::text,
          opening_balance::text AS opening_balance_minor,
          closing_balance::text AS closing_balance_minor, entries_count, metadata
        FROM statements
        WHERE id = ${id}
      `;
      return row ? this.toStatement(row) : null;
    });
  }

  async createExternalAccount(input: ExternalAccount): Promise<ExternalAccount> {
    const id = input.id ?? uuidv7();
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, input.tenant_id);
      const [row] = await sqlTx<ExternalAccountRow[]>`
        INSERT INTO external_accounts (
          id, tenant_id, customer_id, holder_name, institution_name, account_number_last4,
          routing_number, status, verification_code_hash, metadata
        )
        VALUES (
          ${id}, ${input.tenant_id}, ${input.customer_id ?? null}, ${input.holder_name},
          ${input.institution_name}, ${input.account_number_last4}, ${input.routing_number ?? null},
          ${input.status}, crypt('123456', gen_salt('bf')),
          ${sqlTx.json(input.metadata as Parameters<typeof sql.json>[0])}
        )
        RETURNING id, tenant_id, customer_id, holder_name, institution_name, account_number_last4,
          routing_number, status, metadata
      `;
      if (!row) throw new Error('Falha ao criar external account');
      return this.toExternal(row);
    });
  }

  async verifyExternalAccount(
    tenantId: TenantId,
    id: ExternalAccountId,
    code: string
  ): Promise<ExternalAccount> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const [row] = await sqlTx<ExternalAccountRow[]>`
        UPDATE external_accounts
        SET status = 'verified', verified_at = NOW()
        WHERE id = ${id} AND verification_code_hash = crypt(${code}, verification_code_hash)
        RETURNING id, tenant_id, customer_id, holder_name, institution_name, account_number_last4,
          routing_number, status, metadata
      `;
      if (!row) throw new NotFoundError('External account');
      return this.toExternal(row);
    });
  }

  async listExternalAccounts(tenantId: TenantId): Promise<ExternalAccount[]> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const rows = await sqlTx<ExternalAccountRow[]>`
        SELECT id, tenant_id, customer_id, holder_name, institution_name, account_number_last4,
          routing_number, status, metadata
        FROM external_accounts
        ORDER BY created_at DESC
      `;
      return rows.map((row) => this.toExternal(row));
    });
  }

  async createPaymentMethod(input: PaymentMethod): Promise<PaymentMethod & { id: string }> {
    const id = uuidv7();
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, input.tenant_id);
      const [row] = await sqlTx<PaymentMethodRow[]>`
        INSERT INTO payment_methods (
          id, tenant_id, customer_id, external_account_id, type, label, token, status, metadata
        )
        VALUES (
          ${id}, ${input.tenant_id}, ${input.customer_id ?? null},
          ${input.external_account_id ?? null}, ${input.type}, ${input.label},
          crypt(${input.token}, gen_salt('bf')), ${input.status},
          ${sqlTx.json(input.metadata as Parameters<typeof sql.json>[0])}
        )
        RETURNING id, tenant_id, customer_id, external_account_id, type, label, token, status, metadata
      `;
      if (!row) throw new Error('Falha ao criar payment method');
      return this.toPaymentMethod(row);
    });
  }

  async listPaymentMethods(tenantId: TenantId): Promise<(PaymentMethod & { id: string })[]> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const rows = await sqlTx<PaymentMethodRow[]>`
        SELECT id, tenant_id, customer_id, external_account_id, type, label, token, status, metadata
        FROM payment_methods
        ORDER BY created_at DESC
      `;
      return rows.map((row) => this.toPaymentMethod(row));
    });
  }

  async createFeeSchedule(input: FeeSchedule): Promise<FeeSchedule & { id: string }> {
    const id = uuidv7();
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, input.tenant_id);
      const [row] = await sqlTx<FeeScheduleRow[]>`
        INSERT INTO fee_schedules (
          id, tenant_id, name, product, rail, fixed_amount, percent_bps, min_amount,
          max_amount, status, metadata
        )
        VALUES (
          ${id}, ${input.tenant_id}, ${input.name}, ${input.product}, ${input.rail},
          ${input.fixed_amount_minor.toString()}, ${input.percent_bps},
          ${input.min_amount_minor.toString()}, ${input.max_amount_minor?.toString() ?? null},
          ${input.status}, ${sqlTx.json(input.metadata as Parameters<typeof sql.json>[0])}
        )
        RETURNING id, tenant_id, name, product, rail, fixed_amount::text AS fixed_amount_minor,
          percent_bps, min_amount::text AS min_amount_minor, max_amount::text AS max_amount_minor,
          status, metadata
      `;
      if (!row) throw new Error('Falha ao criar fee schedule');
      return this.toFeeSchedule(row);
    });
  }

  async listFeeSchedules(tenantId: TenantId): Promise<(FeeSchedule & { id: string })[]> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const rows = await sqlTx<FeeScheduleRow[]>`
        SELECT id, tenant_id, name, product, rail, fixed_amount::text AS fixed_amount_minor,
          percent_bps, min_amount::text AS min_amount_minor, max_amount::text AS max_amount_minor,
          status, metadata
        FROM fee_schedules
        ORDER BY created_at DESC
      `;
      return rows.map((row) => this.toFeeSchedule(row));
    });
  }

  async createPricingRule(input: PricingRule): Promise<PricingRule & { id: string }> {
    const id = uuidv7();
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, input.tenant_id);
      const [row] = await sqlTx<PricingRuleRow[]>`
        INSERT INTO pricing_rules (
          id, tenant_id, fee_schedule_id, product, rail, min_amount, max_amount,
          fixed_amount, percent_bps, status, metadata
        )
        VALUES (
          ${id}, ${input.tenant_id}, ${input.fee_schedule_id ?? null}, ${input.product},
          ${input.rail}, ${input.min_amount_minor.toString()},
          ${input.max_amount_minor?.toString() ?? null}, ${input.fixed_amount_minor.toString()},
          ${input.percent_bps}, ${input.status},
          ${sqlTx.json(input.metadata as Parameters<typeof sql.json>[0])}
        )
        RETURNING id, tenant_id, fee_schedule_id, product, rail,
          min_amount::text AS min_amount_minor, max_amount::text AS max_amount_minor,
          fixed_amount::text AS fixed_amount_minor, percent_bps, status, metadata
      `;
      if (!row) throw new Error('Falha ao criar pricing rule');
      return this.toPricingRule(row);
    });
  }

  async listPricingRules(tenantId: TenantId): Promise<(PricingRule & { id: string })[]> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const rows = await sqlTx<PricingRuleRow[]>`
        SELECT id, tenant_id, fee_schedule_id, product, rail,
          min_amount::text AS min_amount_minor, max_amount::text AS max_amount_minor,
          fixed_amount::text AS fixed_amount_minor, percent_bps, status, metadata
        FROM pricing_rules
        ORDER BY created_at DESC
      `;
      return rows.map((row) => this.toPricingRule(row));
    });
  }

  async createFee(
    input: FeeCharge,
    transactionId: string
  ): Promise<FeeCharge & { id: string; transaction_id: string }> {
    const id = uuidv7();
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, input.tenant_id);
      const [row] = await sqlTx<FeeRow[]>`
        INSERT INTO fees (id, tenant_id, fee_schedule_id, account_id, transaction_id, amount, status, metadata)
        VALUES (
          ${id}, ${input.tenant_id}, ${input.fee_schedule_id ?? null}, ${input.account_id},
          ${transactionId}, ${input.amount_minor.toString()}, 'posted',
          ${sqlTx.json(input.metadata as Parameters<typeof sql.json>[0])}
        )
        RETURNING id, tenant_id, fee_schedule_id, account_id, transaction_id,
          amount::text AS amount_minor, status, metadata
      `;
      if (!row) throw new Error('Falha ao criar fee');
      return {
        id: row.id,
        tenant_id: row.tenant_id as never,
        ...(row.fee_schedule_id ? { fee_schedule_id: row.fee_schedule_id as FeeScheduleId } : {}),
        account_id: row.account_id as AccountId,
        amount_minor: MoneyUtils.fromMinorUnits(row.amount_minor),
        description: input.description,
        metadata: row.metadata ?? {},
        transaction_id: row.transaction_id!,
      };
    });
  }

  async listFees(
    tenantId: TenantId
  ): Promise<(FeeCharge & { id: string; transaction_id?: string })[]> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const rows = await sqlTx<FeeRow[]>`
        SELECT id, tenant_id, fee_schedule_id, account_id, transaction_id,
          amount::text AS amount_minor, status, metadata
        FROM fees
        ORDER BY created_at DESC
      `;
      return rows.map((row) => ({
        id: row.id,
        tenant_id: row.tenant_id as never,
        ...(row.fee_schedule_id ? { fee_schedule_id: row.fee_schedule_id as FeeScheduleId } : {}),
        account_id: row.account_id as AccountId,
        amount_minor: MoneyUtils.fromMinorUnits(row.amount_minor),
        description: 'Fee charge',
        metadata: row.metadata ?? {},
        ...(row.transaction_id ? { transaction_id: row.transaction_id } : {}),
      }));
    });
  }

  async reverseFee(
    tenantId: TenantId,
    id: FeeId,
    reversalTransactionId: string
  ): Promise<FeeCharge & { id: string; transaction_id?: string }> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const [row] = await sqlTx<FeeRow[]>`
        UPDATE fees
        SET status = 'reversed',
            metadata = metadata || ${sqlTx.json({ reversal_transaction_id: reversalTransactionId })}
        WHERE id = ${id}
        RETURNING id, tenant_id, fee_schedule_id, account_id, transaction_id,
          amount::text AS amount_minor, status, metadata
      `;
      if (!row) throw new NotFoundError('Fee');
      return this.toFee(row);
    });
  }

  async findFee(
    tenantId: TenantId,
    id: FeeId
  ): Promise<(FeeCharge & { id: string; transaction_id?: string }) | null> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const [row] = await sqlTx<FeeRow[]>`
        SELECT id, tenant_id, fee_schedule_id, account_id, transaction_id,
          amount::text AS amount_minor, status, metadata
        FROM fees
        WHERE id = ${id}
      `;
      return row ? this.toFee(row) : null;
    });
  }

  async createPixKey(input: PixKey): Promise<PixKey & { id: string }> {
    const id = uuidv7();
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, input.tenant_id);
      const [row] = await sqlTx<PixKeyRow[]>`
        INSERT INTO pix_keys (id, tenant_id, account_id, key_type, key_value, status, metadata)
        VALUES (${id}, ${input.tenant_id}, ${input.account_id}, ${input.key_type}, ${input.key_value},
          ${input.status}, ${sqlTx.json(input.metadata as Parameters<typeof sql.json>[0])})
        RETURNING id, tenant_id, account_id, key_type, key_value, status, metadata
      `;
      if (!row) throw new Error('Falha ao criar Pix key');
      return row;
    });
  }

  async listPixKeys(tenantId: TenantId): Promise<(PixKey & { id: string })[]> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      return await sqlTx<PixKeyRow[]>`
        SELECT id, tenant_id, account_id, key_type, key_value, status, metadata
        FROM pix_keys
        ORDER BY created_at DESC
      `;
    });
  }

  async createPixCharge(input: PixCharge): Promise<PixCharge & { id: string }> {
    const id = uuidv7();
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, input.tenant_id);
      const [row] = await sqlTx<PixChargeRow[]>`
        INSERT INTO pix_charges (id, tenant_id, account_id, pix_key_id, amount, status, metadata)
        VALUES (${id}, ${input.tenant_id}, ${input.account_id}, ${input.pix_key_id ?? null},
          ${input.amount_minor.toString()}, ${input.status},
          ${sqlTx.json(input.metadata as Parameters<typeof sql.json>[0])})
        RETURNING id, tenant_id, account_id, pix_key_id, amount::text AS amount_minor, status, metadata
      `;
      if (!row) throw new Error('Falha ao criar Pix charge');
      return { ...row, amount_minor: MoneyUtils.fromMinorUnits(row.amount_minor) };
    });
  }

  async listPixCharges(tenantId: TenantId): Promise<(PixCharge & { id: string })[]> {
    const rows = await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      return await sqlTx<PixChargeRow[]>`
        SELECT id, tenant_id, account_id, pix_key_id, amount::text AS amount_minor, status, metadata
        FROM pix_charges
        ORDER BY created_at DESC
      `;
    });
    return rows.map((row) => ({
      ...row,
      amount_minor: MoneyUtils.fromMinorUnits(row.amount_minor),
    }));
  }

  async createBoleto(input: Boleto): Promise<Boleto & { id: string; barcode: string }> {
    const id = uuidv7();
    const barcode = `34191${id.replaceAll('-', '').slice(0, 39)}`;
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, input.tenant_id);
      const [row] = await sqlTx<BoletoRow[]>`
        INSERT INTO boletos (id, tenant_id, account_id, amount, due_date, barcode, status, metadata)
        VALUES (${id}, ${input.tenant_id}, ${input.account_id}, ${input.amount_minor.toString()},
          ${input.due_date}, ${barcode}, ${input.status},
          ${sqlTx.json(input.metadata as Parameters<typeof sql.json>[0])})
        RETURNING id, tenant_id, account_id, amount::text AS amount_minor, due_date::text AS due_date,
          barcode, status, metadata
      `;
      if (!row) throw new Error('Falha ao criar boleto sandbox');
      return { ...row, amount_minor: MoneyUtils.fromMinorUnits(row.amount_minor) };
    });
  }

  async listBoletos(tenantId: TenantId): Promise<(Boleto & { id: string; barcode: string })[]> {
    const rows = await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      return await sqlTx<BoletoRow[]>`
        SELECT id, tenant_id, account_id, amount::text AS amount_minor, due_date::text AS due_date,
          barcode, status, metadata
        FROM boletos
        ORDER BY created_at DESC
      `;
    });
    return rows.map((row) => ({
      ...row,
      amount_minor: MoneyUtils.fromMinorUnits(row.amount_minor),
    }));
  }

  async createCardProduct(input: CardProduct): Promise<CardProduct & { id: string }> {
    const id = uuidv7();
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, input.tenant_id);
      const [row] = await sqlTx<CardProductRow[]>`
        INSERT INTO card_products (id, tenant_id, name, status, spend_controls, metadata)
        VALUES (${id}, ${input.tenant_id}, ${input.name}, ${input.status},
          ${sqlTx.json(input.spend_controls as Parameters<typeof sql.json>[0])},
          ${sqlTx.json(input.metadata as Parameters<typeof sql.json>[0])})
        RETURNING id, tenant_id, name, status, spend_controls, metadata
      `;
      if (!row) throw new Error('Falha ao criar card product sandbox');
      return row;
    });
  }

  async listCardProducts(tenantId: TenantId): Promise<(CardProduct & { id: string })[]> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      return await sqlTx<CardProductRow[]>`
        SELECT id, tenant_id, name, status, spend_controls, metadata
        FROM card_products
        ORDER BY created_at DESC
      `;
    });
  }

  async createCard(input: Card): Promise<Card & { id: string }> {
    const id = uuidv7();
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, input.tenant_id);
      const [row] = await sqlTx<CardRow[]>`
        INSERT INTO cards (
          id, tenant_id, customer_id, account_id, card_product_id, last4, status, metadata
        )
        VALUES (${id}, ${input.tenant_id}, ${input.customer_id ?? null}, ${input.account_id},
          ${input.card_product_id ?? null}, ${input.last4}, ${input.status},
          ${sqlTx.json(input.metadata as Parameters<typeof sql.json>[0])})
        RETURNING id, tenant_id, customer_id, account_id, card_product_id, last4, status, metadata
      `;
      if (!row) throw new Error('Falha ao criar card sandbox');
      return row;
    });
  }

  async listCards(tenantId: TenantId): Promise<(Card & { id: string })[]> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      return await sqlTx<CardRow[]>`
        SELECT id, tenant_id, customer_id, account_id, card_product_id, last4, status, metadata
        FROM cards
        ORDER BY created_at DESC
      `;
    });
  }

  async createCardAuthorization(
    input: CardAuthorization
  ): Promise<CardAuthorization & { id: string }> {
    const id = uuidv7();
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, input.tenant_id);
      const [row] = await sqlTx<CardAuthorizationRow[]>`
        INSERT INTO card_authorizations (id, tenant_id, card_id, account_id, amount, status, metadata)
        VALUES (${id}, ${input.tenant_id}, ${input.card_id}, ${input.account_id},
          ${input.amount_minor.toString()}, ${input.status},
          ${sqlTx.json(input.metadata as Parameters<typeof sql.json>[0])})
        RETURNING id, tenant_id, card_id, account_id, amount::text AS amount_minor, status, metadata
      `;
      if (!row) throw new Error('Falha ao criar authorization sandbox');
      return { ...row, amount_minor: MoneyUtils.fromMinorUnits(row.amount_minor) };
    });
  }

  async listCardAuthorizations(
    tenantId: TenantId
  ): Promise<(CardAuthorization & { id: string })[]> {
    const rows = await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      return await sqlTx<CardAuthorizationRow[]>`
        SELECT id, tenant_id, card_id, account_id, amount::text AS amount_minor, status, metadata
        FROM card_authorizations
        ORDER BY created_at DESC
      `;
    });
    return rows.map((row) => ({
      ...row,
      amount_minor: MoneyUtils.fromMinorUnits(row.amount_minor),
    }));
  }

  private toLimit(row: LimitRow): AccountLimit {
    return {
      tenant_id: row.tenant_id as TenantId,
      account_id: row.account_id as AccountId,
      daily_limit_minor: row.daily_limit_minor
        ? MoneyUtils.fromMinorUnits(row.daily_limit_minor)
        : undefined,
      monthly_limit_minor: row.monthly_limit_minor
        ? MoneyUtils.fromMinorUnits(row.monthly_limit_minor)
        : undefined,
      per_transaction_limit_minor: row.per_transaction_limit_minor
        ? MoneyUtils.fromMinorUnits(row.per_transaction_limit_minor)
        : undefined,
      currency: row.currency,
      metadata: row.metadata ?? {},
    };
  }

  private toStatement(row: {
    id: string;
    tenant_id: string;
    account_id: string;
    period_start: string;
    period_end: string;
    opening_balance_minor: string;
    closing_balance_minor: string;
    entries_count: number;
    metadata: Record<string, unknown>;
  }): Statement {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      account_id: row.account_id,
      period_start: row.period_start,
      period_end: row.period_end,
      opening_balance_minor: MoneyUtils.fromMinorUnits(row.opening_balance_minor),
      closing_balance_minor: MoneyUtils.fromMinorUnits(row.closing_balance_minor),
      entries_count: row.entries_count,
      metadata: row.metadata ?? {},
    };
  }

  private toExternal(row: ExternalAccountRow): ExternalAccount {
    return {
      id: row.id as ExternalAccount['id'],
      tenant_id: row.tenant_id as ExternalAccount['tenant_id'],
      ...(row.customer_id
        ? { customer_id: row.customer_id as ExternalAccount['customer_id'] }
        : {}),
      holder_name: row.holder_name,
      institution_name: row.institution_name,
      account_number_last4: row.account_number_last4,
      ...(row.routing_number ? { routing_number: row.routing_number } : {}),
      status: row.status,
      metadata: row.metadata ?? {},
    };
  }

  private toPaymentMethod(row: PaymentMethodRow): PaymentMethod & { id: string } {
    return {
      id: row.id,
      tenant_id: row.tenant_id as PaymentMethod['tenant_id'],
      ...(row.customer_id ? { customer_id: row.customer_id as PaymentMethod['customer_id'] } : {}),
      ...(row.external_account_id
        ? { external_account_id: row.external_account_id as PaymentMethod['external_account_id'] }
        : {}),
      type: row.type,
      label: row.label,
      token: 'stored_hash',
      status: row.status,
      metadata: row.metadata ?? {},
    };
  }

  private toFeeSchedule(row: FeeScheduleRow): FeeSchedule & { id: string } {
    return {
      id: row.id,
      tenant_id: row.tenant_id as FeeSchedule['tenant_id'],
      name: row.name,
      product: row.product,
      rail: row.rail,
      fixed_amount_minor: MoneyUtils.fromMinorUnits(row.fixed_amount_minor),
      percent_bps: row.percent_bps,
      min_amount_minor: MoneyUtils.fromMinorUnits(row.min_amount_minor),
      max_amount_minor: row.max_amount_minor
        ? MoneyUtils.fromMinorUnits(row.max_amount_minor)
        : undefined,
      status: row.status,
      metadata: row.metadata ?? {},
    };
  }

  private toPricingRule(row: PricingRuleRow): PricingRule & { id: string } {
    return {
      id: row.id,
      tenant_id: row.tenant_id as PricingRule['tenant_id'],
      ...(row.fee_schedule_id ? { fee_schedule_id: row.fee_schedule_id as FeeScheduleId } : {}),
      product: row.product,
      rail: row.rail,
      min_amount_minor: MoneyUtils.fromMinorUnits(row.min_amount_minor),
      max_amount_minor: row.max_amount_minor
        ? MoneyUtils.fromMinorUnits(row.max_amount_minor)
        : undefined,
      fixed_amount_minor: MoneyUtils.fromMinorUnits(row.fixed_amount_minor),
      percent_bps: row.percent_bps,
      status: row.status,
      metadata: row.metadata ?? {},
    };
  }

  private toFee(row: FeeRow): FeeCharge & { id: string; transaction_id?: string } {
    return {
      id: row.id,
      tenant_id: row.tenant_id as FeeCharge['tenant_id'],
      ...(row.fee_schedule_id ? { fee_schedule_id: row.fee_schedule_id as FeeScheduleId } : {}),
      account_id: row.account_id as AccountId,
      amount_minor: MoneyUtils.fromMinorUnits(row.amount_minor),
      description: 'Fee charge',
      metadata: row.metadata ?? {},
      ...(row.transaction_id ? { transaction_id: row.transaction_id } : {}),
    };
  }
}
