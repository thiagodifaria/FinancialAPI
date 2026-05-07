export type ClientOptions = {
  baseUrl: string;
  apiKey: string;
};

export class FinancialCoreClient {
  constructor(private options: ClientOptions) {}

  customers = {
    create: (body: unknown) => this.request('/v1/customers', { method: 'POST', body }),
    list: () => this.request('/v1/customers'),
  };

  accounts = {
    create: (body: unknown) => this.request('/v1/accounts', { method: 'POST', body }),
    list: () => this.request('/v1/accounts'),
    balance: (id: string) => this.request(`/v1/accounts/${id}/balance`),
    entries: (id: string) => this.request(`/v1/accounts/${id}/entries`),
  };

  moneyMovements = {
    deposit: (body: unknown, idempotencyKey?: string) =>
      this.request('/v1/deposits', { method: 'POST', body, idempotencyKey }),
    withdrawal: (body: unknown, idempotencyKey?: string) =>
      this.request('/v1/withdrawals', { method: 'POST', body, idempotencyKey }),
    payment: (body: unknown, idempotencyKey?: string) =>
      this.request('/v1/payments', { method: 'POST', body, idempotencyKey }),
  };

  lending = {
    simulate: (body: unknown) => this.request('/v1/lending/simulations', { method: 'POST', body }),
    apply: (body: unknown) => this.request('/v1/lending/applications', { method: 'POST', body }),
    offers: () => this.request('/v1/lending/offers'),
    acceptOffer: (id: string, body: unknown) =>
      this.request(`/v1/lending/offers/${id}/accept`, { method: 'POST', body }),
  };

  private async request(
    path: string,
    options: { method?: string; body?: unknown; idempotencyKey?: string } = {}
  ) {
    const response = await fetch(`${this.options.baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.options.apiKey,
        ...(options.idempotencyKey ? { 'x-idempotency-key': options.idempotencyKey } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const payload = await response.json();
    if (!response.ok) throw Object.assign(new Error(payload.error), payload);
    return payload;
  }
}
