import { Context } from 'hono';
import { AccountSchema } from '../../../modules/accounts/account.entity.js';
import {
  CreateAccountUseCase,
  GetAccountUseCase,
  ListAccountEntriesUseCase,
  ListAccountTransactionsUseCase,
  ListAccountsUseCase,
  SumAccountHoldsUseCase,
} from '../../../application/use-cases/account.use-cases.js';
import { AccountIdSchema, NotFoundError } from '../../../domain/shared/base-types.js';
import { getTenantId } from '../request-context.js';
import { json } from '../http-response.js';

export class AccountController {
  constructor(
    private createAccountUseCase: CreateAccountUseCase,
    private getAccountUseCase: GetAccountUseCase,
    private listAccountsUseCase: ListAccountsUseCase,
    private listEntriesUseCase: ListAccountEntriesUseCase,
    private listTransactionsUseCase: ListAccountTransactionsUseCase,
    private sumHoldsUseCase: SumAccountHoldsUseCase
  ) {}

  /**
   * Criação de conta com isolamento por Tenant.
   */
  async create(c: Context) {
    const tenantId = getTenantId(c);
    const body = await c.req.json();
    // Injetamos o tenant_id do header no corpo para validação do Zod
    const validated = AccountSchema.parse({ ...body, tenant_id: tenantId });

    const account = await this.createAccountUseCase.execute(validated);
    return json(c, account, 201);
  }

  async list(c: Context) {
    const customerId = c.req.query('customer_id');
    const status = c.req.query('status');
    const limit = c.req.query('limit');
    const offset = c.req.query('offset');
    const filters = {
      ...(customerId ? { customer_id: customerId } : {}),
      ...(status ? { status: status as never } : {}),
      ...(limit ? { limit: Number(limit) } : {}),
      ...(offset ? { offset: Number(offset) } : {}),
    };
    return json(c, {
      data: await this.listAccountsUseCase.execute(getTenantId(c), filters),
    });
  }

  /**
   * Busca conta garantindo que pertence ao Tenant solicitante.
   */
  async findById(c: Context) {
    const tenantId = getTenantId(c);
    const id = c.req.param('id');
    if (!id) return json(c, { error: 'ID da conta é obrigatório' }, 400);

    const account = await this.getAccountUseCase.execute(tenantId, id);
    if (!account) return json(c, { error: 'Conta não encontrada ou acesso negado' }, 404);

    return json(c, account);
  }

  async balance(c: Context) {
    const tenantId = getTenantId(c);
    const id = c.req.param('id');
    if (!id) throw new NotFoundError('Conta');

    const account = await this.getAccountUseCase.execute(tenantId, id);
    if (!account) throw new NotFoundError('Conta');
    const pending = await this.sumHoldsUseCase.execute(tenantId, AccountIdSchema.parse(id));

    return json(c, {
      account_id: account.id,
      ledger_balance_minor: account.balance_minor,
      available_balance_minor:
        account.balance_minor > pending ? account.balance_minor - pending : 0n,
      pending_balance_minor: pending,
    });
  }

  async entries(c: Context) {
    const tenantId = getTenantId(c);
    const accountId = AccountIdSchema.parse(c.req.param('id'));
    return json(c, { data: await this.listEntriesUseCase.execute(tenantId, accountId) });
  }

  async transactions(c: Context) {
    const tenantId = getTenantId(c);
    const accountId = AccountIdSchema.parse(c.req.param('id'));
    return json(c, { data: await this.listTransactionsUseCase.execute(tenantId, accountId) });
  }
}
