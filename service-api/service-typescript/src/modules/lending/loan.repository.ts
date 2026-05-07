import { uuidv7 } from 'uuidv7';
import sql from '../../infrastructure/database/connection.js';
import { setTenantContext } from '../../infrastructure/database/tenant-context.js';
import {
  AccountId,
  InstallmentId,
  LoanApplicationId,
  LoanContractId,
  LoanOfferId,
  LoanProductId,
  NotFoundError,
  TenantId,
} from '../../domain/shared/base-types.js';
import { MoneyUtils } from '../../domain/shared/money.utils.js';
import {
  Installment,
  LoanApplication,
  LoanContract,
  LoanOffer,
  LoanProduct,
  LoanSimulation,
} from './loan.entity.js';

type ProductRow = {
  id: string;
  tenant_id: string;
  name: string;
  annual_interest_bps: number;
  min_amount_minor: string;
  max_amount_minor: string;
  min_installments: number;
  max_installments: number;
  status: LoanProduct['status'];
  metadata: Record<string, unknown>;
};
type ApplicationRow = {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  account_id: string;
  product_id: string | null;
  requested_amount_minor: string;
  installments: number;
  status: LoanApplication['status'];
  scoring_snapshot: Record<string, unknown>;
  metadata: Record<string, unknown>;
};
type OfferRow = {
  id: string;
  tenant_id: string;
  application_id: string;
  principal_amount_minor: string;
  total_amount_minor: string;
  installment_amount_minor: string;
  annual_interest_bps: number;
  installments: number;
  expires_at: Date;
  status: LoanOffer['status'];
  metadata: Record<string, unknown>;
};
type ContractRow = {
  id: string;
  tenant_id: string;
  offer_id: string;
  account_id: string;
  disbursement_transaction_id: string | null;
  principal_amount_minor: string;
  total_amount_minor: string;
  status: LoanContract['status'];
  metadata: Record<string, unknown>;
};
type InstallmentRow = {
  id: string;
  tenant_id: string;
  contract_id: string;
  number: number;
  due_date: Date;
  principal_amount_minor: string;
  interest_amount_minor: string;
  total_amount_minor: string;
  paid_transaction_id: string | null;
  status: Installment['status'];
};
type InstallmentPaymentRow = InstallmentRow & {
  account_id: string;
};

export class PostgresLoanRepository {
  async createProduct(input: LoanProduct): Promise<LoanProduct> {
    const id = input.id ?? uuidv7();
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, input.tenant_id);
      const [row] = await sqlTx<ProductRow[]>`
        INSERT INTO loan_products (
          id, tenant_id, name, annual_interest_bps, min_amount, max_amount,
          min_installments, max_installments, status, metadata
        )
        VALUES (
          ${id}, ${input.tenant_id}, ${input.name}, ${input.annual_interest_bps},
          ${input.min_amount_minor.toString()}, ${input.max_amount_minor.toString()},
          ${input.min_installments}, ${input.max_installments}, ${input.status},
          ${sqlTx.json(input.metadata as Parameters<typeof sql.json>[0])}
        )
        RETURNING id, tenant_id, name, annual_interest_bps, min_amount::text AS min_amount_minor,
                  max_amount::text AS max_amount_minor, min_installments, max_installments, status, metadata
      `;
      if (!row) throw new Error('Falha ao criar produto');
      return this.toProduct(row);
    });
  }

  async listProducts(tenantId: TenantId): Promise<LoanProduct[]> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const rows = await sqlTx<ProductRow[]>`
        SELECT id, tenant_id, name, annual_interest_bps, min_amount::text AS min_amount_minor,
               max_amount::text AS max_amount_minor, min_installments, max_installments, status, metadata
        FROM loan_products ORDER BY created_at DESC
      `;
      return rows.map((row) => this.toProduct(row));
    });
  }

  async findProduct(tenantId: TenantId, id: LoanProductId): Promise<LoanProduct | null> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const [row] = await sqlTx<ProductRow[]>`
        SELECT id, tenant_id, name, annual_interest_bps, min_amount::text AS min_amount_minor,
               max_amount::text AS max_amount_minor, min_installments, max_installments, status, metadata
        FROM loan_products WHERE id = ${id}
      `;
      return row ? this.toProduct(row) : null;
    });
  }

  async createApplication(
    input: LoanApplication,
    simulation: LoanSimulation
  ): Promise<{ application: LoanApplication; offer: LoanOffer }> {
    const applicationId = input.id ?? uuidv7();
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, input.tenant_id);
      const [applicationRow] = await sqlTx<ApplicationRow[]>`
        INSERT INTO loan_applications (
          id, tenant_id, customer_id, account_id, product_id, requested_amount,
          installments, status, scoring_snapshot, metadata, decided_at
        )
        VALUES (
          ${applicationId}, ${input.tenant_id}, ${input.customer_id ?? null}, ${input.account_id},
          ${input.product_id ?? null}, ${input.requested_amount_minor.toString()}, ${input.installments},
          'approved',
          ${sqlTx.json({
            principal_amount_minor: simulation.principal_amount_minor.toString(),
            total_amount_minor: simulation.total_amount_minor.toString(),
            installment_amount_minor: simulation.installment_amount_minor.toString(),
            annual_interest_bps: simulation.annual_interest_bps,
            installments: simulation.installments,
          })},
          ${sqlTx.json(input.metadata as never)},
          NOW()
        )
        RETURNING id, tenant_id, customer_id, account_id, product_id, requested_amount::text AS requested_amount_minor,
                  installments, status, scoring_snapshot, metadata
      `;
      if (!applicationRow) throw new Error('Falha ao criar application');
      const [offerRow] = await sqlTx<OfferRow[]>`
        INSERT INTO loan_offers (
          id, tenant_id, application_id, principal_amount, total_amount,
          installment_amount, annual_interest_bps, installments, expires_at, status, metadata
        )
        VALUES (
          ${uuidv7()}, ${input.tenant_id}, ${applicationId}, ${simulation.principal_amount_minor.toString()},
          ${simulation.total_amount_minor.toString()}, ${simulation.installment_amount_minor.toString()},
          ${simulation.annual_interest_bps}, ${simulation.installments}, NOW() + INTERVAL '7 days',
          'active', '{}'::jsonb
        )
        RETURNING id, tenant_id, application_id, principal_amount::text AS principal_amount_minor,
                  total_amount::text AS total_amount_minor, installment_amount::text AS installment_amount_minor,
                  annual_interest_bps, installments, expires_at, status, metadata
      `;
      if (!offerRow) throw new Error('Falha ao criar offer');
      await sqlTx`
        INSERT INTO events (id, tenant_id, type, resource_type, resource_id, payload)
        VALUES (
          ${uuidv7()}, ${input.tenant_id}, 'loan_application.approved', 'loan_application',
          ${applicationId}, ${sqlTx.json({ offer_id: offerRow.id })}
        )
      `;
      return { application: this.toApplication(applicationRow), offer: this.toOffer(offerRow) };
    });
  }

  async listApplications(tenantId: TenantId): Promise<LoanApplication[]> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const rows = await sqlTx<ApplicationRow[]>`
        SELECT id, tenant_id, customer_id, account_id, product_id, requested_amount::text AS requested_amount_minor,
               installments, status, scoring_snapshot, metadata
        FROM loan_applications ORDER BY created_at DESC LIMIT 100
      `;
      return rows.map((row) => this.toApplication(row));
    });
  }

  async listOffers(tenantId: TenantId): Promise<LoanOffer[]> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const rows = await sqlTx<OfferRow[]>`
        SELECT id, tenant_id, application_id, principal_amount::text AS principal_amount_minor,
               total_amount::text AS total_amount_minor, installment_amount::text AS installment_amount_minor,
               annual_interest_bps, installments, expires_at, status, metadata
        FROM loan_offers ORDER BY created_at DESC LIMIT 100
      `;
      return rows.map((row) => this.toOffer(row));
    });
  }

  async findOffer(tenantId: TenantId, id: LoanOfferId): Promise<LoanOffer | null> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const [row] = await sqlTx<OfferRow[]>`
        SELECT id, tenant_id, application_id, principal_amount::text AS principal_amount_minor,
               total_amount::text AS total_amount_minor, installment_amount::text AS installment_amount_minor,
               annual_interest_bps, installments, expires_at, status, metadata
        FROM loan_offers WHERE id = ${id}
      `;
      return row ? this.toOffer(row) : null;
    });
  }

  async createContract(
    tenantId: TenantId,
    offer: LoanOffer,
    accountId: AccountId,
    transactionId: string
  ): Promise<LoanContract> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const [contractRow] = await sqlTx<ContractRow[]>`
        INSERT INTO loan_contracts (
          id, tenant_id, offer_id, account_id, disbursement_transaction_id,
          principal_amount, total_amount, status, metadata
        )
        VALUES (
          ${uuidv7()}, ${tenantId}, ${offer.id}, ${accountId}, ${transactionId},
          ${offer.principal_amount_minor.toString()}, ${offer.total_amount_minor.toString()}, 'active', '{}'::jsonb
        )
        RETURNING id, tenant_id, offer_id, account_id, disbursement_transaction_id,
                  principal_amount::text AS principal_amount_minor, total_amount::text AS total_amount_minor, status, metadata
      `;
      if (!contractRow) throw new Error('Falha ao criar contrato');
      const contract = this.toContract(contractRow);
      const principalPart = offer.principal_amount_minor / BigInt(offer.installments);
      const interestTotal = offer.total_amount_minor - offer.principal_amount_minor;
      const interestPart = interestTotal / BigInt(offer.installments);
      for (let i = 1; i <= offer.installments; i++) {
        await sqlTx`
          INSERT INTO installments (
            id, tenant_id, contract_id, number, due_date, principal_amount, interest_amount, total_amount, status
          )
          VALUES (
            ${uuidv7()}, ${tenantId}, ${contract.id}, ${i}, CURRENT_DATE + (${i} || ' months')::interval,
            ${principalPart.toString()}, ${interestPart.toString()}, ${offer.installment_amount_minor.toString()}, 'pending'
          )
        `;
      }
      await sqlTx`
        INSERT INTO events (id, tenant_id, type, resource_type, resource_id, payload)
        VALUES (
          ${uuidv7()}, ${tenantId}, 'loan.disbursed', 'loan_contract',
          ${contract.id}, ${sqlTx.json({ transaction_id: transactionId, offer_id: offer.id })}
        )
      `;
      return contract;
    });
  }

  async listContracts(tenantId: TenantId): Promise<LoanContract[]> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const rows = await sqlTx<ContractRow[]>`
        SELECT id, tenant_id, offer_id, account_id, disbursement_transaction_id,
               principal_amount::text AS principal_amount_minor, total_amount::text AS total_amount_minor, status, metadata
        FROM loan_contracts ORDER BY created_at DESC LIMIT 100
      `;
      return rows.map((row) => this.toContract(row));
    });
  }

  async listInstallments(tenantId: TenantId, contractId: LoanContractId): Promise<Installment[]> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const rows = await sqlTx<InstallmentRow[]>`
        SELECT id, tenant_id, contract_id, number, due_date, principal_amount::text AS principal_amount_minor,
               interest_amount::text AS interest_amount_minor, total_amount::text AS total_amount_minor,
               paid_transaction_id, status
        FROM installments WHERE contract_id = ${contractId} ORDER BY number ASC
      `;
      return rows.map((row) => this.toInstallment(row));
    });
  }

  async findInstallmentForPayment(
    tenantId: TenantId,
    installmentId: InstallmentId
  ): Promise<(Installment & { account_id: AccountId }) | null> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const [row] = await sqlTx<InstallmentPaymentRow[]>`
        SELECT i.id, i.tenant_id, i.contract_id, i.number, i.due_date,
               i.principal_amount::text AS principal_amount_minor,
               i.interest_amount::text AS interest_amount_minor,
               i.total_amount::text AS total_amount_minor,
               i.paid_transaction_id, i.status, c.account_id
        FROM installments i
        JOIN loan_contracts c ON c.id = i.contract_id AND c.tenant_id = i.tenant_id
        WHERE i.tenant_id = ${tenantId} AND i.id = ${installmentId}
      `;
      return row ? { ...this.toInstallment(row), account_id: row.account_id as AccountId } : null;
    });
  }

  async markInstallmentPaid(
    tenantId: TenantId,
    installmentId: InstallmentId,
    transactionId: string
  ): Promise<Installment> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const [row] = await sqlTx<InstallmentRow[]>`
        UPDATE installments
        SET status = 'paid', paid_transaction_id = ${transactionId}, paid_at = NOW()
        WHERE tenant_id = ${tenantId} AND id = ${installmentId}
        RETURNING id, tenant_id, contract_id, number, due_date,
                  principal_amount::text AS principal_amount_minor,
                  interest_amount::text AS interest_amount_minor,
                  total_amount::text AS total_amount_minor,
                  paid_transaction_id, status
      `;
      if (!row) throw new NotFoundError('Parcela');
      await sqlTx`
        INSERT INTO events (id, tenant_id, type, resource_type, resource_id, payload)
        VALUES (
          ${uuidv7()}, ${tenantId}, 'installment.paid', 'installment',
          ${installmentId}, ${sqlTx.json({ transaction_id: transactionId })}
        )
      `;
      return this.toInstallment(row);
    });
  }

  simulate(product: LoanProduct, amount: bigint, installments: number): LoanSimulation {
    if (amount < product.min_amount_minor || amount > product.max_amount_minor) {
      throw new NotFoundError('Produto compatível para o valor solicitado');
    }
    const interest =
      (amount * BigInt(product.annual_interest_bps) * BigInt(installments)) / 1200000n;
    const total = amount + interest;
    return {
      principal_amount_minor: amount,
      total_amount_minor: total,
      installment_amount_minor: total / BigInt(installments),
      annual_interest_bps: product.annual_interest_bps,
      installments,
    };
  }

  private toProduct(row: ProductRow): LoanProduct {
    return {
      id: row.id as LoanProductId,
      tenant_id: row.tenant_id as TenantId,
      name: row.name,
      annual_interest_bps: row.annual_interest_bps,
      min_amount_minor: MoneyUtils.fromMinorUnits(row.min_amount_minor),
      max_amount_minor: MoneyUtils.fromMinorUnits(row.max_amount_minor),
      min_installments: row.min_installments,
      max_installments: row.max_installments,
      status: row.status,
      metadata: row.metadata ?? {},
    };
  }

  private toApplication(row: ApplicationRow): LoanApplication {
    return {
      id: row.id as LoanApplicationId,
      tenant_id: row.tenant_id as TenantId,
      ...(row.customer_id ? { customer_id: row.customer_id as never } : {}),
      account_id: row.account_id as never,
      ...(row.product_id ? { product_id: row.product_id as LoanProductId } : {}),
      requested_amount_minor: MoneyUtils.fromMinorUnits(row.requested_amount_minor),
      installments: row.installments,
      status: row.status,
      scoring_snapshot: row.scoring_snapshot ?? {},
      metadata: row.metadata ?? {},
    };
  }

  private toOffer(row: OfferRow): LoanOffer {
    return {
      id: row.id as LoanOfferId,
      tenant_id: row.tenant_id as TenantId,
      application_id: row.application_id as LoanApplicationId,
      principal_amount_minor: MoneyUtils.fromMinorUnits(row.principal_amount_minor),
      total_amount_minor: MoneyUtils.fromMinorUnits(row.total_amount_minor),
      installment_amount_minor: MoneyUtils.fromMinorUnits(row.installment_amount_minor),
      annual_interest_bps: row.annual_interest_bps,
      installments: row.installments,
      expires_at: row.expires_at.toISOString(),
      status: row.status,
      metadata: row.metadata ?? {},
    };
  }

  private toContract(row: ContractRow): LoanContract {
    return {
      id: row.id as LoanContractId,
      tenant_id: row.tenant_id as TenantId,
      offer_id: row.offer_id as LoanOfferId,
      account_id: row.account_id as never,
      ...(row.disbursement_transaction_id
        ? { disbursement_transaction_id: row.disbursement_transaction_id }
        : {}),
      principal_amount_minor: MoneyUtils.fromMinorUnits(row.principal_amount_minor),
      total_amount_minor: MoneyUtils.fromMinorUnits(row.total_amount_minor),
      status: row.status,
      metadata: row.metadata ?? {},
    };
  }

  private toInstallment(row: InstallmentRow): Installment {
    return {
      id: row.id as Installment['id'],
      tenant_id: row.tenant_id as TenantId,
      contract_id: row.contract_id as LoanContractId,
      number: row.number,
      due_date: row.due_date.toISOString().slice(0, 10),
      principal_amount_minor: MoneyUtils.fromMinorUnits(row.principal_amount_minor),
      interest_amount_minor: MoneyUtils.fromMinorUnits(row.interest_amount_minor),
      total_amount_minor: MoneyUtils.fromMinorUnits(row.total_amount_minor),
      ...(row.paid_transaction_id ? { paid_transaction_id: row.paid_transaction_id } : {}),
      status: row.status,
    };
  }
}
