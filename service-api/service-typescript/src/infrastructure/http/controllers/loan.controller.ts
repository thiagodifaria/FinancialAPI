import { Context } from 'hono';
import { z } from 'zod';
import { LoanUseCases } from '../../../application/use-cases/loan.use-cases.js';
import {
  AccountIdSchema,
  InstallmentIdSchema,
  LoanContractIdSchema,
  LoanOfferIdSchema,
  LoanProductIdSchema,
} from '../../../domain/shared/base-types.js';
import { MoneyUtils } from '../../../domain/shared/money.utils.js';
import { LoanApplicationSchema, LoanProductSchema } from '../../../modules/lending/loan.entity.js';
import { json } from '../http-response.js';
import { getTenantId } from '../request-context.js';

const SimulationSchema = z.object({
  product_id: LoanProductIdSchema,
  amount_minor: z.union([z.string(), z.number(), z.bigint()]).transform(MoneyUtils.fromMinorUnits),
  installments: z.number().int().positive(),
});

const AcceptOfferSchema = z.object({
  account_id: AccountIdSchema,
});

export class LoanController {
  constructor(private loanUseCases: LoanUseCases) {}

  async createProduct(c: Context) {
    const tenantId = getTenantId(c);
    const input = LoanProductSchema.parse({ ...(await c.req.json()), tenant_id: tenantId });
    return json(c, await this.loanUseCases.createProduct(input), 201);
  }

  async listProducts(c: Context) {
    return json(c, { data: await this.loanUseCases.listProducts(getTenantId(c)) });
  }

  async simulate(c: Context) {
    const tenantId = getTenantId(c);
    const input = SimulationSchema.parse(await c.req.json());
    return json(
      c,
      await this.loanUseCases.simulate(
        tenantId,
        input.product_id,
        input.amount_minor,
        input.installments
      )
    );
  }

  async createApplication(c: Context) {
    const tenantId = getTenantId(c);
    const input = LoanApplicationSchema.parse({ ...(await c.req.json()), tenant_id: tenantId });
    return json(c, await this.loanUseCases.createApplication(input), 201);
  }

  async listApplications(c: Context) {
    return json(c, { data: await this.loanUseCases.listApplications(getTenantId(c)) });
  }

  async listOffers(c: Context) {
    return json(c, { data: await this.loanUseCases.listOffers(getTenantId(c)) });
  }

  async acceptOffer(c: Context) {
    const tenantId = getTenantId(c);
    const offerId = LoanOfferIdSchema.parse(c.req.param('id'));
    const input = AcceptOfferSchema.parse(await c.req.json());
    return json(c, await this.loanUseCases.acceptOffer(tenantId, offerId, input.account_id), 201);
  }

  async listContracts(c: Context) {
    return json(c, { data: await this.loanUseCases.listContracts(getTenantId(c)) });
  }

  async listInstallments(c: Context) {
    const contractId = LoanContractIdSchema.parse(c.req.param('id'));
    return json(c, { data: await this.loanUseCases.listInstallments(getTenantId(c), contractId) });
  }

  async payInstallment(c: Context) {
    const installmentId = InstallmentIdSchema.parse(c.req.param('id'));
    return json(c, await this.loanUseCases.payInstallment(getTenantId(c), installmentId), 201);
  }
}
