import { LendingProposalId, NotFoundError, TenantId } from '../../domain/shared/base-types.js';
import { LendingProposalSaga } from '../sagas/lending-proposal.saga.js';
import {
  ILendingProposalRepository,
  LendingProposal,
} from '../../modules/lending/lending-proposal.entity.js';

export class LendingUseCases {
  constructor(
    private lendingRepo: ILendingProposalRepository,
    private lendingSaga: LendingProposalSaga
  ) {}

  async request(input: LendingProposal): Promise<LendingProposal> {
    const proposal = await this.lendingRepo.create(input);
    const result = await this.lendingSaga.execute({
      tenant_id: proposal.tenant_id,
      account_id: proposal.account_id,
      amount: proposal.amount_minor,
    });

    if (result.status === 'APPROVED') {
      return await this.lendingRepo.approve(proposal.tenant_id, proposal.id!, {
        transaction_id: result.transaction_id!,
        maximum_limit_minor: result.limit_minor,
        reason: 'Perfil aprovado via motor de risco.',
      });
    }

    return await this.lendingRepo.reject(proposal.tenant_id, proposal.id!, {
      maximum_limit_minor: result.limit_minor,
      reason: result.reason ?? 'Perfil recusado pelo motor de risco.',
    });
  }

  list(tenantId: TenantId): Promise<LendingProposal[]> {
    return this.lendingRepo.list(tenantId);
  }

  async findById(tenantId: TenantId, id: LendingProposalId): Promise<LendingProposal> {
    const proposal = await this.lendingRepo.findById(tenantId, id);
    if (!proposal) throw new NotFoundError('Proposta de lending');
    return proposal;
  }
}
