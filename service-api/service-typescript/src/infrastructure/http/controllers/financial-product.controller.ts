import { Context } from 'hono';
import { FinancialProductUseCases } from '../../../application/use-cases/financial-product.use-cases.js';
import {
  AccountIdSchema,
  ExternalAccountIdSchema,
  FeeIdSchema,
  NotFoundError,
  StatementIdSchema,
} from '../../../domain/shared/base-types.js';
import {
  AccountLimitSchema,
  AccountStatusActionSchema,
  BoletoSchema,
  CardAuthorizationSchema,
  CardProductSchema,
  CardSchema,
  ExternalAccountSchema,
  FeeChargeSchema,
  FeeScheduleSchema,
  PaymentMethodSchema,
  PixChargeSchema,
  PixKeySchema,
  PricingRuleSchema,
  StatementRequestSchema,
} from '../../../modules/financial-products/financial-product.entity.js';
import { IdempotencyService } from '../../cache/idempotency.service.js';
import { json } from '../http-response.js';
import { getTenantId } from '../request-context.js';
import { hashRequestPayload } from '../request-hash.js';

export class FinancialProductController {
  constructor(
    private useCases: FinancialProductUseCases,
    private idempotencyService: IdempotencyService
  ) {}

  async freezeAccount(c: Context) {
    return json(c, await this.accountStatusAction(c, 'freeze'));
  }

  async unfreezeAccount(c: Context) {
    return json(c, await this.accountStatusAction(c, 'unfreeze'));
  }

  async closeAccount(c: Context) {
    return json(c, await this.accountStatusAction(c, 'close'));
  }

  async setLimit(c: Context) {
    const tenantId = getTenantId(c);
    const body = await c.req.json();
    const input = AccountLimitSchema.parse({
      ...body,
      tenant_id: tenantId,
      account_id: c.req.param('id'),
    });
    return json(c, await this.useCases.setLimit(input));
  }

  async getLimit(c: Context) {
    const limit = await this.useCases.getLimit(
      getTenantId(c),
      AccountIdSchema.parse(c.req.param('id'))
    );
    if (!limit) throw new NotFoundError('Limites da conta');
    return json(c, limit);
  }

  async createStatement(c: Context) {
    const tenantId = getTenantId(c);
    const body = await c.req.json();
    const input = StatementRequestSchema.parse({
      ...body,
      tenant_id: tenantId,
      account_id: c.req.param('id'),
    });
    return json(c, await this.useCases.createStatement(input), 201);
  }

  async listStatements(c: Context) {
    return json(c, {
      data: await this.useCases.listStatements(
        getTenantId(c),
        AccountIdSchema.parse(c.req.param('id'))
      ),
    });
  }

  async getStatement(c: Context) {
    return json(
      c,
      await this.useCases.getStatement(getTenantId(c), StatementIdSchema.parse(c.req.param('id')))
    );
  }

  async createExternalAccount(c: Context) {
    const tenantId = getTenantId(c);
    const body = await c.req.json();
    const input = ExternalAccountSchema.parse({ ...body, tenant_id: tenantId });
    return json(c, await this.useCases.createExternalAccount(input), 201);
  }

  async listExternalAccounts(c: Context) {
    return json(c, { data: await this.useCases.listExternalAccounts(getTenantId(c)) });
  }

  async verifyExternalAccount(c: Context) {
    const body = await c.req.json();
    return json(
      c,
      await this.useCases.verifyExternalAccount(
        getTenantId(c),
        ExternalAccountIdSchema.parse(c.req.param('id')),
        String(body.code ?? '')
      )
    );
  }

  async createPaymentMethod(c: Context) {
    const tenantId = getTenantId(c);
    const body = await c.req.json();
    const input = PaymentMethodSchema.parse({ ...body, tenant_id: tenantId });
    return json(c, await this.useCases.createPaymentMethod(input), 201);
  }

  async listPaymentMethods(c: Context) {
    return json(c, { data: await this.useCases.listPaymentMethods(getTenantId(c)) });
  }

  async createFeeSchedule(c: Context) {
    const tenantId = getTenantId(c);
    const body = await c.req.json();
    const input = FeeScheduleSchema.parse({ ...body, tenant_id: tenantId });
    return json(c, await this.useCases.createFeeSchedule(input), 201);
  }

  async listFeeSchedules(c: Context) {
    return json(c, { data: await this.useCases.listFeeSchedules(getTenantId(c)) });
  }

  async createPricingRule(c: Context) {
    const tenantId = getTenantId(c);
    const body = await c.req.json();
    const input = PricingRuleSchema.parse({ ...body, tenant_id: tenantId });
    return json(c, await this.useCases.createPricingRule(input), 201);
  }

  async listPricingRules(c: Context) {
    return json(c, { data: await this.useCases.listPricingRules(getTenantId(c)) });
  }

  async chargeFee(c: Context) {
    const tenantId = getTenantId(c);
    const idempotencyKey = c.req.header('x-idempotency-key');
    const body = await c.req.json();
    const requestHash = hashRequestPayload(body);

    if (idempotencyKey) {
      const reservation = await this.idempotencyService.reserve(
        tenantId,
        idempotencyKey,
        requestHash
      );
      if (reservation.status === 'cached') return json(c, reservation.response);
    }

    try {
      const input = FeeChargeSchema.parse({ ...body, tenant_id: tenantId });
      const result = await this.useCases.chargeFee(input, idempotencyKey);
      if (idempotencyKey)
        await this.idempotencyService.save(tenantId, idempotencyKey, requestHash, result);
      return json(c, result, 201);
    } catch (error) {
      if (idempotencyKey) await this.idempotencyService.release(tenantId, idempotencyKey);
      throw error;
    }
  }

  async listFees(c: Context) {
    return json(c, { data: await this.useCases.listFees(getTenantId(c)) });
  }

  async reverseFee(c: Context) {
    return json(
      c,
      await this.useCases.reverseFee(
        getTenantId(c),
        FeeIdSchema.parse(c.req.param('id')),
        c.req.header('x-idempotency-key')
      )
    );
  }

  async createPixKey(c: Context) {
    const tenantId = getTenantId(c);
    const body = await c.req.json();
    return json(
      c,
      await this.useCases.createPixKey(PixKeySchema.parse({ ...body, tenant_id: tenantId })),
      201
    );
  }

  async listPixKeys(c: Context) {
    return json(c, { data: await this.useCases.listPixKeys(getTenantId(c)) });
  }

  async createPixCharge(c: Context) {
    const tenantId = getTenantId(c);
    const body = await c.req.json();
    return json(
      c,
      await this.useCases.createPixCharge(PixChargeSchema.parse({ ...body, tenant_id: tenantId })),
      201
    );
  }

  async listPixCharges(c: Context) {
    return json(c, { data: await this.useCases.listPixCharges(getTenantId(c)) });
  }

  async createBoleto(c: Context) {
    const tenantId = getTenantId(c);
    const body = await c.req.json();
    return json(
      c,
      await this.useCases.createBoleto(BoletoSchema.parse({ ...body, tenant_id: tenantId })),
      201
    );
  }

  async listBoletos(c: Context) {
    return json(c, { data: await this.useCases.listBoletos(getTenantId(c)) });
  }

  async createCardProduct(c: Context) {
    const tenantId = getTenantId(c);
    const body = await c.req.json();
    return json(
      c,
      await this.useCases.createCardProduct(
        CardProductSchema.parse({ ...body, tenant_id: tenantId })
      ),
      201
    );
  }

  async listCardProducts(c: Context) {
    return json(c, { data: await this.useCases.listCardProducts(getTenantId(c)) });
  }

  async createCard(c: Context) {
    const tenantId = getTenantId(c);
    const body = await c.req.json();
    return json(
      c,
      await this.useCases.createCard(CardSchema.parse({ ...body, tenant_id: tenantId })),
      201
    );
  }

  async listCards(c: Context) {
    return json(c, { data: await this.useCases.listCards(getTenantId(c)) });
  }

  async createCardAuthorization(c: Context) {
    const tenantId = getTenantId(c);
    const body = await c.req.json();
    return json(
      c,
      await this.useCases.createCardAuthorization(
        CardAuthorizationSchema.parse({ ...body, tenant_id: tenantId })
      ),
      201
    );
  }

  async listCardAuthorizations(c: Context) {
    return json(c, { data: await this.useCases.listCardAuthorizations(getTenantId(c)) });
  }

  private async accountStatusAction(c: Context, action: 'freeze' | 'unfreeze' | 'close') {
    const tenantId = getTenantId(c);
    const body = await c.req.json().catch(() => ({}));
    const input = AccountStatusActionSchema.parse({
      ...body,
      tenant_id: tenantId,
      account_id: c.req.param('id'),
    });
    if (action === 'freeze') return this.useCases.freezeAccount(input);
    if (action === 'unfreeze') return this.useCases.unfreezeAccount(input);
    return this.useCases.closeAccount(input);
  }
}
