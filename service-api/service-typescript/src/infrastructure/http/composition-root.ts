import {
  CreateAccountUseCase,
  GetAccountUseCase,
  ListAccountEntriesUseCase,
  ListAccountTransactionsUseCase,
  ListAccountsUseCase,
  SumAccountHoldsUseCase,
} from '../../application/use-cases/account.use-cases.js';
import { ApiKeyUseCases } from '../../application/use-cases/api-key.use-cases.js';
import {
  LoginUseCase,
  LogoutUseCase,
  RefreshSessionUseCase,
} from '../../application/use-cases/auth.use-cases.js';
import { CustomerUseCases } from '../../application/use-cases/customer.use-cases.js';
import { FinancialProductUseCases } from '../../application/use-cases/financial-product.use-cases.js';
import { LendingUseCases } from '../../application/use-cases/lending.use-cases.js';
import { LoanUseCases } from '../../application/use-cases/loan.use-cases.js';
import { MoneyMovementUseCases } from '../../application/use-cases/money-movement.use-cases.js';
import {
  GetTransactionUseCase,
  ListTransactionsUseCase,
  PostTransactionUseCase,
  ReverseTransactionUseCase,
} from '../../application/use-cases/transaction.use-cases.js';
import { TransferUseCases } from '../../application/use-cases/transfer.use-cases.js';
import { LendingProposalSaga } from '../../application/sagas/lending-proposal.saga.js';
import { PostgresAuditRepository } from '../audit/audit.repository.js';
import { IdempotencyService } from '../cache/idempotency.service.js';
import { GrpcCreditScoringService } from '../grpc/clients/credit-scoring.client.js';
import { AccountController } from './controllers/account.controller.js';
import { ApiKeyController } from './controllers/api-key.controller.js';
import { AuditController } from './controllers/audit.controller.js';
import { AuthController } from './controllers/auth.controller.js';
import { ComplianceController } from './controllers/compliance.controller.js';
import { ConsentController } from './controllers/consent.controller.js';
import { CustomerController } from './controllers/customer.controller.js';
import { EventController } from './controllers/event.controller.js';
import { FinancialAccountController } from './controllers/financial-account.controller.js';
import { FinancialProductController } from './controllers/financial-product.controller.js';
import { LendingController } from './controllers/lending.controller.js';
import { LoanController } from './controllers/loan.controller.js';
import { MoneyMovementController } from './controllers/money-movement.controller.js';
import { ReconciliationController } from './controllers/reconciliation.controller.js';
import { TransactionController } from './controllers/transaction.controller.js';
import { TransferController } from './controllers/transfer.controller.js';
import { PostgresAccountRepository } from '../../modules/accounts/account.repository.js';
import { PostgresFinancialAccountRepository } from '../../modules/accounts/financial-account.repository.js';
import { PostgresApiKeyRepository } from '../../modules/api-keys/api-key.repository.js';
import { PostgresAuthRepository } from '../../modules/auth/auth.repository.js';
import { PostgresComplianceRepository } from '../../modules/compliance/compliance.repository.js';
import { PostgresConsentRepository } from '../../modules/customers/consent.repository.js';
import { PostgresCustomerRepository } from '../../modules/customers/customer.repository.js';
import { PostgresEventRepository } from '../../modules/events/event.repository.js';
import { PostgresFinancialProductRepository } from '../../modules/financial-products/financial-product.repository.js';
import { PostgresLendingProposalRepository } from '../../modules/lending/lending-proposal.repository.js';
import { PostgresLoanRepository } from '../../modules/lending/loan.repository.js';
import { PostgresMoneyMovementRepository } from '../../modules/money-movements/money-movement.repository.js';
import { PostgresReconciliationRepository } from '../../modules/reconciliation/reconciliation.repository.js';
import { PostgresTransactionRepository } from '../../modules/transactions/transaction.repository.js';
import { PostgresTransferRepository } from '../../modules/transfers/transfer.repository.js';

export type AppDependencies = ReturnType<typeof createCompositionRoot>;

/**
 * Composition root explícito, inspirado no server.go do PRIMME.
 * Centraliza construção de repositórios, use cases e controllers.
 */
export function createCompositionRoot() {
  const accountRepo = new PostgresAccountRepository();
  const financialAccountRepo = new PostgresFinancialAccountRepository();
  const transactionRepo = new PostgresTransactionRepository(accountRepo);
  const authRepo = new PostgresAuthRepository();
  const customerRepo = new PostgresCustomerRepository();
  const transferRepo = new PostgresTransferRepository();
  const lendingProposalRepo = new PostgresLendingProposalRepository();
  const apiKeyRepo = new PostgresApiKeyRepository();
  const movementRepo = new PostgresMoneyMovementRepository();
  const loanRepo = new PostgresLoanRepository();
  const eventRepo = new PostgresEventRepository();
  const auditRepo = new PostgresAuditRepository();
  const consentRepo = new PostgresConsentRepository();
  const financialProductRepo = new PostgresFinancialProductRepository();
  const reconciliationRepo = new PostgresReconciliationRepository();
  const complianceRepo = new PostgresComplianceRepository();
  const idempotencyService = new IdempotencyService();
  const scoringService = new GrpcCreditScoringService();

  const lendingSaga = new LendingProposalSaga(accountRepo, transactionRepo, scoringService);
  const authController = new AuthController(
    new LoginUseCase(authRepo),
    new RefreshSessionUseCase(authRepo),
    new LogoutUseCase(authRepo)
  );
  const accountController = new AccountController(
    new CreateAccountUseCase(accountRepo),
    new GetAccountUseCase(accountRepo),
    new ListAccountsUseCase(accountRepo),
    new ListAccountEntriesUseCase(accountRepo),
    new ListAccountTransactionsUseCase(accountRepo),
    new SumAccountHoldsUseCase(accountRepo)
  );
  const transactionController = new TransactionController(
    new PostTransactionUseCase(transactionRepo),
    new ListTransactionsUseCase(transactionRepo),
    new GetTransactionUseCase(transactionRepo),
    new ReverseTransactionUseCase(transactionRepo),
    idempotencyService
  );

  return {
    repositories: { authRepo, auditRepo },
    controllers: {
      accountController,
      apiKeyController: new ApiKeyController(new ApiKeyUseCases(apiKeyRepo)),
      auditController: new AuditController(auditRepo),
      authController,
      complianceController: new ComplianceController(complianceRepo),
      consentController: new ConsentController(consentRepo),
      customerController: new CustomerController(new CustomerUseCases(customerRepo)),
      eventController: new EventController(eventRepo),
      financialAccountController: new FinancialAccountController(financialAccountRepo),
      financialProductController: new FinancialProductController(
        new FinancialProductUseCases(financialProductRepo, transactionRepo),
        idempotencyService
      ),
      lendingController: new LendingController(
        new LendingUseCases(lendingProposalRepo, lendingSaga),
        idempotencyService
      ),
      loanController: new LoanController(new LoanUseCases(loanRepo, transactionRepo)),
      movementController: new MoneyMovementController(
        new MoneyMovementUseCases(movementRepo, transactionRepo),
        idempotencyService
      ),
      reconciliationController: new ReconciliationController(reconciliationRepo),
      transactionController,
      transferController: new TransferController(
        new TransferUseCases(transferRepo, transactionRepo),
        idempotencyService
      ),
    },
  };
}
