import { Hono } from 'hono';
import { AppDependencies } from '../composition-root.js';
import { json } from '../http-response.js';
import { getTenantId } from '../request-context.js';
import { tenantAuthMiddleware } from '../../security/tenant-auth.middleware.js';

export function registerV1Routes(app: Hono, deps: AppDependencies) {
  const c = deps.controllers;
  app.use('/v1/*', tenantAuthMiddleware);

  app.get('/v1/tenant', (ctx) => json(ctx, { id: getTenantId(ctx) }));
  app.post('/v1/api-keys', (ctx) => c.apiKeyController.create(ctx));
  app.get('/v1/api-keys', (ctx) => c.apiKeyController.list(ctx));
  app.post('/v1/api-keys/:id/revoke', (ctx) => c.apiKeyController.revoke(ctx));
  app.post('/v1/api-keys/:id/rotate', (ctx) => c.apiKeyController.rotate(ctx));

  app.post('/v1/customers', (ctx) => c.customerController.create(ctx));
  app.get('/v1/customers', (ctx) => c.customerController.list(ctx));
  app.get('/v1/customers/:id', (ctx) => c.customerController.findById(ctx));
  app.patch('/v1/customers/:id', (ctx) => c.customerController.update(ctx));
  app.post('/v1/customers/:id/verify', (ctx) => c.customerController.verify(ctx));
  app.post('/v1/customers/:id/block', (ctx) => c.customerController.block(ctx));
  app.post('/v1/customers/:id/archive', (ctx) => c.customerController.archive(ctx));
  app.post('/v1/customers/:id/anonymize', (ctx) => c.complianceController.anonymizeCustomer(ctx));
  app.get('/v1/customers/:id/export', (ctx) => c.complianceController.exportCustomer(ctx));
  app.post('/v1/customers/:id/consents', (ctx) => c.consentController.create(ctx));
  app.get('/v1/customers/:id/consents', (ctx) => c.consentController.list(ctx));

  app.post('/v1/accounts', (ctx) => c.accountController.create(ctx));
  app.get('/v1/accounts', (ctx) => c.accountController.list(ctx));
  app.get('/v1/accounts/:id/balance', (ctx) => c.accountController.balance(ctx));
  app.get('/v1/accounts/:id/entries', (ctx) => c.accountController.entries(ctx));
  app.get('/v1/accounts/:id/transactions', (ctx) => c.accountController.transactions(ctx));
  app.post('/v1/accounts/:id/freeze', (ctx) => c.financialProductController.freezeAccount(ctx));
  app.post('/v1/accounts/:id/unfreeze', (ctx) => c.financialProductController.unfreezeAccount(ctx));
  app.post('/v1/accounts/:id/close', (ctx) => c.financialProductController.closeAccount(ctx));
  app.get('/v1/accounts/:id/limits', (ctx) => c.financialProductController.getLimit(ctx));
  app.patch('/v1/accounts/:id/limits', (ctx) => c.financialProductController.setLimit(ctx));
  app.get('/v1/accounts/:id/statements', (ctx) => c.financialProductController.listStatements(ctx));
  app.post('/v1/accounts/:id/statements', (ctx) =>
    c.financialProductController.createStatement(ctx)
  );
  app.get('/v1/accounts/:id', (ctx) => c.accountController.findById(ctx));
  app.post('/v1/financial-accounts', (ctx) => c.financialAccountController.create(ctx));
  app.get('/v1/financial-accounts', (ctx) => c.financialAccountController.list(ctx));
  app.post('/v1/holds', (ctx) => c.financialAccountController.createHold(ctx));
  app.get('/v1/holds', (ctx) => c.financialAccountController.listHolds(ctx));
  app.post('/v1/holds/:id/release', (ctx) => c.financialAccountController.releaseHold(ctx));
  app.post('/v1/holds/:id/capture', (ctx) => c.financialAccountController.captureHold(ctx));

  app.post('/v1/transactions', (ctx) => c.transactionController.create(ctx));
  app.get('/v1/transactions', (ctx) => c.transactionController.list(ctx));
  app.post('/v1/transactions/:id/reverse', (ctx) => c.transactionController.reverse(ctx));
  app.get('/v1/transactions/:id', (ctx) => c.transactionController.findById(ctx));

  app.post('/v1/transfers', (ctx) => c.transferController.create(ctx));
  app.get('/v1/transfers', (ctx) => c.transferController.list(ctx));
  app.get('/v1/transfers/:id', (ctx) => c.transferController.findById(ctx));
  app.post('/v1/deposits', (ctx) => c.movementController.create(ctx, 'deposit'));
  app.post('/v1/withdrawals', (ctx) => c.movementController.create(ctx, 'withdrawal'));
  app.post('/v1/payments', (ctx) => c.movementController.create(ctx, 'payment'));
  app.post('/v1/internal-transfers', (ctx) =>
    c.movementController.create(ctx, 'internal_transfer')
  );
  app.post('/v1/inbound-transfers', (ctx) => c.movementController.create(ctx, 'inbound_transfer'));
  app.post('/v1/outbound-transfers', (ctx) =>
    c.movementController.create(ctx, 'outbound_transfer')
  );
  app.post('/v1/refunds', (ctx) => c.movementController.create(ctx, 'refund'));
  app.get('/v1/money-movements', (ctx) => c.movementController.list(ctx));
  app.get('/v1/money-movements/:id', (ctx) => c.movementController.findById(ctx));
  app.post('/v1/money-movements/:id/cancel', (ctx) =>
    c.movementController.setStatus(ctx, 'canceled')
  );
  app.post('/v1/money-movements/:id/fail', (ctx) => c.movementController.setStatus(ctx, 'failed'));
  app.post('/v1/money-movements/:id/approve', (ctx) =>
    c.movementController.setStatus(ctx, 'posted')
  );
  app.post('/v1/money-movements/:id/return', (ctx) =>
    c.movementController.setStatus(ctx, 'returned')
  );

  app.post('/v1/external-accounts', (ctx) =>
    c.financialProductController.createExternalAccount(ctx)
  );
  app.get('/v1/external-accounts', (ctx) => c.financialProductController.listExternalAccounts(ctx));
  app.post('/v1/external-accounts/:id/verify', (ctx) =>
    c.financialProductController.verifyExternalAccount(ctx)
  );
  app.post('/v1/payment-methods', (ctx) => c.financialProductController.createPaymentMethod(ctx));
  app.get('/v1/payment-methods', (ctx) => c.financialProductController.listPaymentMethods(ctx));
  app.post('/v1/fee-schedules', (ctx) => c.financialProductController.createFeeSchedule(ctx));
  app.get('/v1/fee-schedules', (ctx) => c.financialProductController.listFeeSchedules(ctx));
  app.post('/v1/pricing-rules', (ctx) => c.financialProductController.createPricingRule(ctx));
  app.get('/v1/pricing-rules', (ctx) => c.financialProductController.listPricingRules(ctx));
  app.post('/v1/fees', (ctx) => c.financialProductController.chargeFee(ctx));
  app.get('/v1/fees', (ctx) => c.financialProductController.listFees(ctx));
  app.post('/v1/fees/:id/reverse', (ctx) => c.financialProductController.reverseFee(ctx));
  app.get('/v1/statements/:id', (ctx) => c.financialProductController.getStatement(ctx));
  app.post('/v1/pix/keys', (ctx) => c.financialProductController.createPixKey(ctx));
  app.get('/v1/pix/keys', (ctx) => c.financialProductController.listPixKeys(ctx));
  app.post('/v1/pix/charges', (ctx) => c.financialProductController.createPixCharge(ctx));
  app.get('/v1/pix/charges', (ctx) => c.financialProductController.listPixCharges(ctx));
  app.post('/v1/boletos', (ctx) => c.financialProductController.createBoleto(ctx));
  app.get('/v1/boletos', (ctx) => c.financialProductController.listBoletos(ctx));
  app.post('/v1/card-products', (ctx) => c.financialProductController.createCardProduct(ctx));
  app.get('/v1/card-products', (ctx) => c.financialProductController.listCardProducts(ctx));
  app.post('/v1/cards', (ctx) => c.financialProductController.createCard(ctx));
  app.get('/v1/cards', (ctx) => c.financialProductController.listCards(ctx));
  app.post('/v1/card-authorizations', (ctx) =>
    c.financialProductController.createCardAuthorization(ctx)
  );
  app.get('/v1/card-authorizations', (ctx) =>
    c.financialProductController.listCardAuthorizations(ctx)
  );

  app.post('/v1/lending/proposals', (ctx) => c.lendingController.requestProposal(ctx));
  app.get('/v1/lending/proposals', (ctx) => c.lendingController.list(ctx));
  app.get('/v1/lending/proposals/:id', (ctx) => c.lendingController.findById(ctx));
  app.post('/v1/lending/products', (ctx) => c.loanController.createProduct(ctx));
  app.get('/v1/lending/products', (ctx) => c.loanController.listProducts(ctx));
  app.post('/v1/lending/simulations', (ctx) => c.loanController.simulate(ctx));
  app.post('/v1/lending/applications', (ctx) => c.loanController.createApplication(ctx));
  app.get('/v1/lending/applications', (ctx) => c.loanController.listApplications(ctx));
  app.get('/v1/lending/offers', (ctx) => c.loanController.listOffers(ctx));
  app.post('/v1/lending/offers/:id/accept', (ctx) => c.loanController.acceptOffer(ctx));
  app.get('/v1/lending/contracts', (ctx) => c.loanController.listContracts(ctx));
  app.get('/v1/lending/contracts/:id/installments', (ctx) =>
    c.loanController.listInstallments(ctx)
  );
  app.post('/v1/lending/installments/:id/pay', (ctx) => c.loanController.payInstallment(ctx));

  app.post('/v1/webhook-endpoints', (ctx) => c.eventController.createWebhook(ctx));
  app.get('/v1/webhook-endpoints', (ctx) => c.eventController.listWebhooks(ctx));
  app.post('/v1/webhook-endpoints/:id/rotate-secret', (ctx) =>
    c.eventController.rotateWebhookSecret(ctx)
  );
  app.get('/v1/webhook-deliveries', (ctx) => c.eventController.listDeliveries(ctx));
  app.post('/v1/webhook-deliveries/:id/retry', (ctx) => c.eventController.retryDelivery(ctx));
  app.post('/v1/webhook-test-events', (ctx) => c.eventController.createTestEvent(ctx));
  app.get('/v1/events', (ctx) => c.eventController.listEvents(ctx));
  app.get('/v1/audit-logs', (ctx) => c.auditController.list(ctx));
  app.post('/v1/reconciliation-runs', (ctx) => c.reconciliationController.createRun(ctx));
  app.get('/v1/reconciliation-runs', (ctx) => c.reconciliationController.listRuns(ctx));
  app.get('/v1/reconciliation-runs/:id/items', (ctx) => c.reconciliationController.listItems(ctx));
  app.get('/v1/reports/ledger-balances', (ctx) => c.reconciliationController.ledgerBalances(ctx));
  app.get('/v1/reports/reconciliation', (ctx) => c.reconciliationController.reconciliation(ctx));
  app.get('/v1/reports/outbox', (ctx) => c.reconciliationController.outbox(ctx));
  app.get('/v1/compliance-requests', (ctx) => c.complianceController.listRequests(ctx));
  app.post('/v1/data-retention-policies', (ctx) =>
    c.complianceController.upsertRetentionPolicy(ctx)
  );
  app.get('/v1/data-retention-policies', (ctx) =>
    c.complianceController.listRetentionPolicies(ctx)
  );
}
