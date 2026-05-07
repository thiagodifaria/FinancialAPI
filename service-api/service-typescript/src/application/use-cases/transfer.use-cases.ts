import { NotFoundError, TenantId, TransferId } from '../../domain/shared/base-types.js';
import {
  ITransactionRepository,
  Transaction,
} from '../../modules/transactions/transaction.entity.js';
import { ITransferRepository, Transfer } from '../../modules/transfers/transfer.entity.js';

export class TransferUseCases {
  constructor(
    private transferRepo: ITransferRepository,
    private transactionRepo: ITransactionRepository
  ) {}

  async create(input: Transfer, idempotencyKey?: string): Promise<Transfer> {
    const transaction: Transaction = await this.transactionRepo.create(
      {
        tenant_id: input.tenant_id,
        description: input.description ?? 'Internal transfer',
        metadata: {
          ...input.metadata,
          transfer_id: input.id,
          kind: 'transfer',
        },
        entries: [
          {
            account_id: input.source_account_id,
            amount_minor: input.amount_minor,
            direction: 'debit',
          },
          {
            account_id: input.destination_account_id,
            amount_minor: input.amount_minor,
            direction: 'credit',
          },
        ],
      },
      idempotencyKey
    );

    return await this.transferRepo.createPosted(input, transaction.id!);
  }

  list(tenantId: TenantId): Promise<Transfer[]> {
    return this.transferRepo.list(tenantId);
  }

  async findById(tenantId: TenantId, id: TransferId): Promise<Transfer> {
    const transfer = await this.transferRepo.findById(tenantId, id);
    if (!transfer) throw new NotFoundError('Transferência');
    return transfer;
  }
}
