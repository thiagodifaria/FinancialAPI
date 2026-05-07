import { AccountId, NotFoundError, TenantId } from '../../domain/shared/base-types.js';
import { AccountIdSchema } from '../../domain/shared/base-types.js';
import {
  AccountLimit,
  AccountStatusAction,
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
  StatementId,
  StatementRequest,
} from '../../modules/financial-products/financial-product.entity.js';
import { PostgresFinancialProductRepository } from '../../modules/financial-products/financial-product.repository.js';
import { ITransactionRepository } from '../../modules/transactions/transaction.entity.js';

const revenueAccountId = () =>
  AccountIdSchema.parse(
    process.env.FEE_REVENUE_ACCOUNT_ID ?? '0194fd70-0000-7000-8000-000000000103'
  );

export class FinancialProductUseCases {
  constructor(
    private repo: PostgresFinancialProductRepository,
    private transactionRepo: ITransactionRepository
  ) {}

  freezeAccount(input: AccountStatusAction) {
    return this.repo.transitionAccount(input, 'freeze');
  }

  unfreezeAccount(input: AccountStatusAction) {
    return this.repo.transitionAccount(input, 'unfreeze');
  }

  closeAccount(input: AccountStatusAction) {
    return this.repo.transitionAccount(input, 'close');
  }

  setLimit(input: AccountLimit) {
    return this.repo.upsertLimit(input);
  }

  getLimit(tenantId: TenantId, accountId: AccountId) {
    return this.repo.getLimit(tenantId, accountId);
  }

  createStatement(input: StatementRequest) {
    return this.repo.createStatement(input);
  }

  listStatements(tenantId: TenantId, accountId: AccountId) {
    return this.repo.listStatements(tenantId, accountId);
  }

  async getStatement(tenantId: TenantId, id: StatementId) {
    const statement = await this.repo.getStatement(tenantId, id);
    if (!statement) throw new NotFoundError('Statement');
    return statement;
  }

  createExternalAccount(input: ExternalAccount) {
    return this.repo.createExternalAccount(input);
  }

  listExternalAccounts(tenantId: TenantId) {
    return this.repo.listExternalAccounts(tenantId);
  }

  verifyExternalAccount(tenantId: TenantId, id: ExternalAccount['id'], code: string) {
    if (!id) throw new Error('ID da external account é obrigatório');
    return this.repo.verifyExternalAccount(tenantId, id, code);
  }

  createPaymentMethod(input: PaymentMethod) {
    return this.repo.createPaymentMethod(input);
  }

  listPaymentMethods(tenantId: TenantId) {
    return this.repo.listPaymentMethods(tenantId);
  }

  createFeeSchedule(input: FeeSchedule) {
    return this.repo.createFeeSchedule(input);
  }

  listFeeSchedules(tenantId: TenantId) {
    return this.repo.listFeeSchedules(tenantId);
  }

  createPricingRule(input: PricingRule) {
    return this.repo.createPricingRule(input);
  }

  listPricingRules(tenantId: TenantId) {
    return this.repo.listPricingRules(tenantId);
  }

  async chargeFee(input: FeeCharge, idempotencyKey?: string) {
    const transaction = await this.transactionRepo.create(
      {
        tenant_id: input.tenant_id,
        description: input.description,
        metadata: { ...input.metadata, kind: 'fee' },
        entries: [
          {
            account_id: input.account_id,
            amount_minor: input.amount_minor,
            direction: 'debit',
          },
          {
            account_id: revenueAccountId(),
            amount_minor: input.amount_minor,
            direction: 'credit',
          },
        ],
      },
      idempotencyKey
    );
    return this.repo.createFee(input, transaction.id!);
  }

  listFees(tenantId: TenantId) {
    return this.repo.listFees(tenantId);
  }

  async reverseFee(tenantId: TenantId, id: FeeId, idempotencyKey?: string) {
    const fee = await this.repo.findFee(tenantId, id);
    if (!fee) throw new NotFoundError('Fee');
    const transaction = await this.transactionRepo.create(
      {
        tenant_id: tenantId,
        description: `Reversal fee ${id}`,
        metadata: { ...fee.metadata, kind: 'fee_reversal', original_fee_id: id },
        entries: [
          {
            account_id: revenueAccountId(),
            amount_minor: fee.amount_minor,
            direction: 'debit',
          },
          {
            account_id: fee.account_id,
            amount_minor: fee.amount_minor,
            direction: 'credit',
          },
        ],
      },
      idempotencyKey
    );
    return this.repo.reverseFee(tenantId, id, transaction.id!);
  }

  createPixKey(input: PixKey) {
    return this.repo.createPixKey(input);
  }

  listPixKeys(tenantId: TenantId) {
    return this.repo.listPixKeys(tenantId);
  }

  createPixCharge(input: PixCharge) {
    return this.repo.createPixCharge(input);
  }

  listPixCharges(tenantId: TenantId) {
    return this.repo.listPixCharges(tenantId);
  }

  createBoleto(input: Boleto) {
    return this.repo.createBoleto(input);
  }

  listBoletos(tenantId: TenantId) {
    return this.repo.listBoletos(tenantId);
  }

  createCardProduct(input: CardProduct) {
    return this.repo.createCardProduct(input);
  }

  listCardProducts(tenantId: TenantId) {
    return this.repo.listCardProducts(tenantId);
  }

  createCard(input: Card) {
    return this.repo.createCard(input);
  }

  listCards(tenantId: TenantId) {
    return this.repo.listCards(tenantId);
  }

  createCardAuthorization(input: CardAuthorization) {
    return this.repo.createCardAuthorization(input);
  }

  listCardAuthorizations(tenantId: TenantId) {
    return this.repo.listCardAuthorizations(tenantId);
  }
}
