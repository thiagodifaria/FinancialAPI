import {
  AccountId,
  InstallmentId,
  LoanContractId,
  LoanOfferId,
  LoanProductId,
  NotFoundError,
  TenantId,
} from '../../domain/shared/base-types.js';
import { LoanApplication, LoanProduct, LoanSimulation } from '../../modules/lending/loan.entity.js';
import { PostgresLoanRepository } from '../../modules/lending/loan.repository.js';
import { ITransactionRepository } from '../../modules/transactions/transaction.entity.js';

const fundingAccountId = () =>
  (process.env.LOAN_FUNDING_ACCOUNT_ID ?? '0194fd70-0000-7000-8000-000000000101') as AccountId;

export class LoanUseCases {
  constructor(
    private loanRepo: PostgresLoanRepository,
    private transactionRepo: ITransactionRepository
  ) {}

  createProduct(input: LoanProduct) {
    return this.loanRepo.createProduct(input);
  }

  listProducts(tenantId: TenantId) {
    return this.loanRepo.listProducts(tenantId);
  }

  async simulate(
    tenantId: TenantId,
    productId: LoanProductId,
    amount: bigint,
    installments: number
  ): Promise<LoanSimulation> {
    const product = await this.loanRepo.findProduct(tenantId, productId);
    if (!product) throw new NotFoundError('Produto de crédito');
    return this.loanRepo.simulate(product, amount, installments);
  }

  async createApplication(input: LoanApplication) {
    const productId = input.product_id ?? ('0194fd70-0000-7000-8000-000000000201' as LoanProductId);
    const product = await this.loanRepo.findProduct(input.tenant_id, productId);
    if (!product) throw new NotFoundError('Produto de crédito');
    const simulation = this.loanRepo.simulate(
      product,
      input.requested_amount_minor,
      input.installments
    );
    return this.loanRepo.createApplication({ ...input, product_id: productId }, simulation);
  }

  listApplications(tenantId: TenantId) {
    return this.loanRepo.listApplications(tenantId);
  }

  listOffers(tenantId: TenantId) {
    return this.loanRepo.listOffers(tenantId);
  }

  async acceptOffer(tenantId: TenantId, offerId: LoanOfferId, accountId: AccountId) {
    const offer = await this.loanRepo.findOffer(tenantId, offerId);
    if (!offer) throw new NotFoundError('Oferta de crédito');
    const transaction = await this.transactionRepo.create({
      tenant_id: tenantId,
      description: `Loan disbursement ${offer.id}`,
      metadata: { kind: 'loan_disbursement', offer_id: offer.id },
      entries: [
        {
          account_id: fundingAccountId(),
          amount_minor: offer.principal_amount_minor,
          direction: 'debit',
        },
        { account_id: accountId, amount_minor: offer.principal_amount_minor, direction: 'credit' },
      ],
    });
    return this.loanRepo.createContract(tenantId, offer, accountId, transaction.id!);
  }

  listContracts(tenantId: TenantId) {
    return this.loanRepo.listContracts(tenantId);
  }

  listInstallments(tenantId: TenantId, contractId: LoanContractId) {
    return this.loanRepo.listInstallments(tenantId, contractId);
  }

  async payInstallment(tenantId: TenantId, installmentId: InstallmentId) {
    const installment = await this.loanRepo.findInstallmentForPayment(tenantId, installmentId);
    if (!installment) throw new NotFoundError('Parcela');
    const transaction = await this.transactionRepo.create({
      tenant_id: tenantId,
      description: `Installment payment ${installment.number}`,
      metadata: { kind: 'installment_payment', installment_id: installment.id },
      entries: [
        {
          account_id: installment.account_id,
          amount_minor: installment.total_amount_minor,
          direction: 'debit',
        },
        {
          account_id: fundingAccountId(),
          amount_minor: installment.total_amount_minor,
          direction: 'credit',
        },
      ],
    });
    return this.loanRepo.markInstallmentPaid(tenantId, installmentId, transaction.id!);
  }
}
