import {
  Transaction,
  ITransactionRepository,
} from '../../modules/transactions/transaction.entity.js';
import { TenantId } from '../../domain/shared/base-types.js';

/**
 * Caso de Uso: Postagem de Transação
 * Centraliza a lógica de criação de transações atômicas de partidas dobradas.
 */
export class PostTransactionUseCase {
  constructor(private transactionRepo: ITransactionRepository) {}

  async execute(data: Transaction, idempotencyKey?: string): Promise<Transaction> {
    // Orquestra a persistência atômica através do repositório
    return await this.transactionRepo.create(data, idempotencyKey);
  }
}

export class ListTransactionsUseCase {
  constructor(private transactionRepo: ITransactionRepository) {}

  execute(tenantId: TenantId): Promise<Transaction[]> {
    return this.transactionRepo.list(tenantId);
  }
}

export class GetTransactionUseCase {
  constructor(private transactionRepo: ITransactionRepository) {}

  execute(tenantId: TenantId, id: string): Promise<Transaction | null> {
    return this.transactionRepo.findById(tenantId, id);
  }
}

export class ReverseTransactionUseCase {
  constructor(private transactionRepo: ITransactionRepository) {}

  execute(tenantId: TenantId, id: string, description?: string): Promise<Transaction> {
    return this.transactionRepo.reverse(tenantId, id, description);
  }
}
