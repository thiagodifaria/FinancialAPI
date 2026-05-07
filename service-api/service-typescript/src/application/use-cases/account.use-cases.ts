import {
  Account,
  AccountListFilters,
  IAccountRepository,
} from '../../modules/accounts/account.entity.js';
import { AccountId, TenantId } from '../../domain/shared/base-types.js';

/**
 * Caso de Uso: Criação de Conta
 * Responsável por orquestrar a lógica de criação de uma nova conta no ledger.
 */
export class CreateAccountUseCase {
  constructor(private accountRepo: IAccountRepository) {}

  async execute(data: Account): Promise<Account> {
    // Aqui poderiam ser adicionadas regras de negócio extras, como validar se o nome da conta é único
    return await this.accountRepo.create(data);
  }
}

/**
 * Caso de Uso: Buscar Conta
 * Encapsula a lógica de recuperação de dados de uma conta.
 */
export class GetAccountUseCase {
  constructor(private accountRepo: IAccountRepository) {}

  async execute(tenantId: TenantId, id: string): Promise<Account | null> {
    return await this.accountRepo.findById(tenantId, id);
  }
}

export class ListAccountsUseCase {
  constructor(private accountRepo: IAccountRepository) {}

  async execute(tenantId: TenantId, filters?: AccountListFilters): Promise<Account[]> {
    return await this.accountRepo.list(tenantId, filters);
  }
}

export class ListAccountEntriesUseCase {
  constructor(private accountRepo: IAccountRepository) {}

  async execute(tenantId: TenantId, accountId: AccountId) {
    return await this.accountRepo.listEntries(tenantId, accountId);
  }
}

export class ListAccountTransactionsUseCase {
  constructor(private accountRepo: IAccountRepository) {}

  async execute(tenantId: TenantId, accountId: AccountId) {
    return await this.accountRepo.listTransactions(tenantId, accountId);
  }
}

export class SumAccountHoldsUseCase {
  constructor(private accountRepo: IAccountRepository) {}

  async execute(tenantId: TenantId, accountId: AccountId) {
    return await this.accountRepo.sumActiveHolds(tenantId, accountId);
  }
}
