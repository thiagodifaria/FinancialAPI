import {
  AccountIdSchema,
  MoneyMovementId,
  NotFoundError,
  TenantId,
} from '../../domain/shared/base-types.js';
import {
  IMoneyMovementRepository,
  MoneyMovement,
} from '../../modules/money-movements/money-movement.entity.js';
import {
  ITransactionRepository,
  Transaction,
} from '../../modules/transactions/transaction.entity.js';

const settlementAccountId = () =>
  AccountIdSchema.parse(
    process.env.SANDBOX_SETTLEMENT_ACCOUNT_ID ?? '0194fd70-0000-7000-8000-000000000102'
  );

export class MoneyMovementUseCases {
  constructor(
    private movementRepo: IMoneyMovementRepository,
    private transactionRepo: ITransactionRepository
  ) {}

  async create(input: MoneyMovement, idempotencyKey?: string): Promise<MoneyMovement> {
    const transaction = await this.transactionRepo.create(
      this.toTransaction(input),
      idempotencyKey
    );
    return await this.movementRepo.createPosted(input, transaction.id!);
  }

  list(tenantId: TenantId, type?: MoneyMovement['type']): Promise<MoneyMovement[]> {
    return this.movementRepo.list(tenantId, type);
  }

  async findById(tenantId: TenantId, id: MoneyMovementId): Promise<MoneyMovement> {
    const movement = await this.movementRepo.findById(tenantId, id);
    if (!movement) throw new NotFoundError('Money movement');
    return movement;
  }

  setStatus(tenantId: TenantId, id: MoneyMovementId, status: MoneyMovement['status']) {
    return this.movementRepo.setStatus(tenantId, id, status);
  }

  private toTransaction(input: MoneyMovement): Transaction {
    const settlement = settlementAccountId();
    if (input.type === 'deposit' || input.type === 'inbound_transfer') {
      if (!input.destination_account_id) throw new Error('destination_account_id é obrigatório');
      return {
        tenant_id: input.tenant_id,
        description: input.description ?? `Sandbox ${input.type}`,
        metadata: { ...input.metadata, kind: input.type },
        entries: [
          { account_id: settlement, amount_minor: input.amount_minor, direction: 'debit' },
          {
            account_id: input.destination_account_id,
            amount_minor: input.amount_minor,
            direction: 'credit',
          },
        ],
      };
    }

    if (input.type === 'withdrawal' || input.type === 'outbound_transfer') {
      if (!input.source_account_id) throw new Error('source_account_id é obrigatório');
      return {
        tenant_id: input.tenant_id,
        description: input.description ?? `Sandbox ${input.type}`,
        metadata: { ...input.metadata, kind: input.type },
        entries: [
          {
            account_id: input.source_account_id,
            amount_minor: input.amount_minor,
            direction: 'debit',
          },
          { account_id: settlement, amount_minor: input.amount_minor, direction: 'credit' },
        ],
      };
    }

    if (!input.source_account_id) throw new Error('source_account_id é obrigatório');
    return {
      tenant_id: input.tenant_id,
      description: input.description ?? `Sandbox ${input.type}`,
      metadata: { ...input.metadata, kind: input.type },
      entries: [
        {
          account_id: input.source_account_id,
          amount_minor: input.amount_minor,
          direction: 'debit',
        },
        {
          account_id: input.destination_account_id ?? settlement,
          amount_minor: input.amount_minor,
          direction: 'credit',
        },
      ],
    };
  }
}
