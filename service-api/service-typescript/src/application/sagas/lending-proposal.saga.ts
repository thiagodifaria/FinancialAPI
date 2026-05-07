import {
  AccountId,
  DomainError,
  Money,
  NotFoundError,
  TenantId,
} from '../../domain/shared/base-types.js';
import { logger } from '../../infrastructure/logging/logger.js';
import { incrementDomainMetric } from '../../infrastructure/observability/metrics.js';
import { IAccountRepository } from '../../modules/accounts/account.entity.js';
import { ITransactionRepository } from '../../modules/transactions/transaction.entity.js';

/**
 * Interface para o serviço de Scoring (gRPC)
 */
export interface ICreditScoringService {
  analyze(data: {
    tenant_id: string;
    account_id: string;
    requested_amount: Money;
  }): Promise<{ approved: boolean; maximum_limit: Money; reason: string }>;
}

/**
 * Saga: Proposta de Empréstimo (Orquestrada)
 * Este padrão garante que as etapas sejam executadas em ordem e que
 * tenhamos um rastro claro de auditoria para cada decisão financeira.
 */
export class LendingProposalSaga {
  constructor(
    private accountRepo: IAccountRepository,
    private transactionRepo: ITransactionRepository,
    private scoringService: ICreditScoringService
  ) {}

  async execute(params: { tenant_id: TenantId; account_id: AccountId; amount: Money }) {
    logger.info(
      { tenant_id: params.tenant_id, account_id: params.account_id },
      '[SAGA] Iniciando proposta de empréstimo'
    );
    incrementDomainMetric('lending', 'proposal_started');

    // 1. Verificação de elegibilidade básica (In-process)
    const account = await this.accountRepo.findById(params.tenant_id, params.account_id);
    if (!account) throw new NotFoundError('Conta');

    // 2. Chamada ao Motor de Crédito (Microsserviço Python via gRPC)
    const analysis = await this.scoringService.analyze({
      tenant_id: params.tenant_id,
      account_id: params.account_id,
      requested_amount: params.amount,
    });

    if (!analysis.approved) {
      logger.info({ reason: analysis.reason }, '[SAGA] Proposta negada');
      incrementDomainMetric('lending', 'proposal_rejected');
      return {
        status: 'REJECTED' as const,
        reason: analysis.reason,
        limit_minor: analysis.maximum_limit,
      };
    }

    // 3. Efetivação no Ledger (Partidas Dobradas)
    // O dinheiro do empréstimo sai de uma conta contábil de funding do tenant.
    const fundingAccountId = process.env.LOAN_FUNDING_ACCOUNT_ID as AccountId | undefined;
    if (!fundingAccountId) {
      throw new DomainError(
        'Conta de funding de empréstimos não configurada',
        'LOAN_FUNDING_ACCOUNT_NOT_CONFIGURED',
        500
      );
    }

    const transaction = await this.transactionRepo.create({
      tenant_id: params.tenant_id,
      description: `Loan Approval - ${params.amount}`,
      metadata: {
        product: 'lending',
        source: 'lending-proposal-saga',
      },
      entries: [
        {
          account_id: params.account_id,
          amount_minor: params.amount,
          direction: 'credit',
        },
        {
          account_id: fundingAccountId,
          amount_minor: params.amount,
          direction: 'debit',
        },
      ],
    });

    logger.info({ transaction_id: transaction.id }, '[SAGA] Empréstimo efetivado com sucesso');
    incrementDomainMetric('lending', 'proposal_approved');

    return {
      status: 'APPROVED',
      transaction_id: transaction.id,
      limit_minor: analysis.maximum_limit,
    };
  }
}
