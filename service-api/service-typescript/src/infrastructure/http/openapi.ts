const uuidRef = { $ref: '#/components/schemas/UuidV7' };
const moneyRef = { $ref: '#/components/schemas/MinorUnits' };
const errorResponses = {
  '400': { description: 'Payload inválido' },
  '401': { description: 'Não autorizado' },
  '404': { description: 'Recurso não encontrado' },
} as const;

const idParameter = {
  name: 'id',
  in: 'path',
  required: true,
  schema: uuidRef,
} as const;

const idempotencyParameter = {
  name: 'x-idempotency-key',
  in: 'header',
  required: false,
  schema: { type: 'string' },
} as const;

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'FinancialAPI API',
    version: '1.0.0',
    description:
      'API multi-tenant para produtos financeiros: autenticação, customers, contas, ledger double-entry, money movement, lending, fees, webhooks, compliance, reconciliação, reports e rails sandbox documentados.',
  },
  servers: [{ url: '/v1' }],
  security: [{ ApiKeyAuth: [] }],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
      },
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
      },
    },
    schemas: {
      UuidV7: {
        type: 'string',
        format: 'uuid',
        description:
          'Identificador UUID. A implementação gera UUIDv7 para novos registros; OpenAPI documenta como UUID padrão.',
      },
      MinorUnits: {
        type: 'string',
        pattern: '^-?\\d+$',
        description: 'Valor monetário inteiro em minor units, por exemplo centavos.',
        examples: ['10050'],
      },
      Customer: {
        type: 'object',
        properties: {
          id: uuidRef,
          tenant_id: uuidRef,
          type: { type: 'string', enum: ['individual', 'business'] },
          name: { type: 'string' },
          document: { type: 'string' },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string' },
          status: {
            type: 'string',
            enum: ['active', 'archived', 'blocked', 'pending', 'verified', 'rejected'],
          },
          metadata: { type: 'object', additionalProperties: true },
        },
        required: ['id', 'tenant_id', 'type', 'name', 'status', 'metadata'],
      },
      Account: {
        type: 'object',
        properties: {
          id: uuidRef,
          tenant_id: uuidRef,
          customer_id: uuidRef,
          name: { type: 'string' },
          balance_minor: moneyRef,
          direction: { type: 'string', enum: ['debit', 'credit'] },
          status: {
            type: 'string',
            enum: ['active', 'archived', 'blocked', 'pending', 'verified', 'rejected'],
          },
          metadata: { type: 'object', additionalProperties: true },
        },
        required: ['id', 'tenant_id', 'balance_minor', 'direction', 'status', 'metadata'],
      },
      Balance: {
        type: 'object',
        properties: {
          account_id: uuidRef,
          ledger_balance_minor: moneyRef,
          available_balance_minor: moneyRef,
          pending_balance_minor: moneyRef,
        },
        required: [
          'account_id',
          'ledger_balance_minor',
          'available_balance_minor',
          'pending_balance_minor',
        ],
      },
      Entry: {
        type: 'object',
        properties: {
          account_id: uuidRef,
          amount_minor: moneyRef,
          direction: { type: 'string', enum: ['debit', 'credit'] },
        },
        required: ['account_id', 'amount_minor', 'direction'],
      },
      Transaction: {
        type: 'object',
        properties: {
          id: uuidRef,
          tenant_id: uuidRef,
          description: { type: 'string' },
          entries: { type: 'array', minItems: 2, items: { $ref: '#/components/schemas/Entry' } },
          metadata: { type: 'object', additionalProperties: true },
        },
        required: ['id', 'tenant_id', 'entries', 'metadata'],
      },
      Transfer: {
        type: 'object',
        properties: {
          id: uuidRef,
          tenant_id: uuidRef,
          source_account_id: uuidRef,
          destination_account_id: uuidRef,
          transaction_id: uuidRef,
          amount_minor: moneyRef,
          description: { type: 'string' },
          status: {
            type: 'string',
            enum: [
              'pending',
              'requires_approval',
              'processing',
              'posted',
              'failed',
              'canceled',
              'returned',
              'reversed',
            ],
          },
          metadata: { type: 'object', additionalProperties: true },
        },
        required: [
          'id',
          'tenant_id',
          'source_account_id',
          'destination_account_id',
          'amount_minor',
          'status',
          'metadata',
        ],
      },
      LendingProposal: {
        type: 'object',
        properties: {
          id: uuidRef,
          tenant_id: uuidRef,
          account_id: uuidRef,
          amount_minor: moneyRef,
          status: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED'] },
          reason: { type: 'string' },
          maximum_limit_minor: moneyRef,
          transaction_id: uuidRef,
          metadata: { type: 'object', additionalProperties: true },
        },
        required: ['id', 'tenant_id', 'account_id', 'amount_minor', 'status', 'metadata'],
      },
      AuthSession: {
        type: 'object',
        properties: {
          access_token: { type: 'string' },
          refresh_token: { type: 'string' },
          expires_at: { type: 'string', format: 'date-time' },
          user: { type: 'object', additionalProperties: true },
        },
        required: ['access_token', 'refresh_token', 'expires_at', 'user'],
      },
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          code: { type: 'string' },
          request_id: { type: 'string' },
        },
        required: ['error', 'code', 'request_id'],
      },
    },
  },
  paths: {
    '/auth/login': {
      post: {
        summary: 'Autentica usuário humano do tenant.',
        responses: {
          '201': { description: 'Sessão criada' },
          '401': { description: 'Login inválido' },
        },
      },
    },
    '/auth/refresh': {
      post: {
        security: [],
        summary: 'Renova sessão com refresh token.',
        responses: {
          '200': { description: 'Sessão renovada' },
          '401': { description: 'Token inválido' },
        },
      },
    },
    '/auth/logout': {
      post: {
        security: [{ BearerAuth: [] }],
        summary: 'Revoga sessão atual.',
        responses: { '200': { description: 'Sessão encerrada' } },
      },
    },
    '/auth/me': {
      get: {
        security: [{ BearerAuth: [] }],
        summary: 'Retorna usuário autenticado.',
        responses: { '200': { description: 'Usuário atual' } },
      },
    },
    '/tenant': {
      get: {
        summary: 'Retorna o tenant autenticado pela API key.',
        responses: { '200': { description: 'Tenant atual' } },
      },
    },
    '/api-keys': {
      post: {
        summary: 'Cria API key machine-to-machine.',
        responses: { '201': { description: 'API key criada' }, ...errorResponses },
      },
      get: {
        summary: 'Lista API keys do tenant.',
        responses: { '200': { description: 'Lista de API keys' } },
      },
    },
    '/api-keys/{id}/revoke': {
      post: {
        summary: 'Revoga API key.',
        parameters: [idParameter],
        responses: { '200': { description: 'API key revogada' }, ...errorResponses },
      },
    },
    '/api-keys/{id}/rotate': {
      post: {
        summary: 'Rotaciona API key.',
        parameters: [idParameter],
        responses: { '201': { description: 'Nova API key criada' }, ...errorResponses },
      },
    },
    '/customers': {
      post: {
        summary: 'Cria customer/account holder.',
        responses: { '201': { description: 'Customer criado' }, ...errorResponses },
      },
      get: {
        summary: 'Lista customers do tenant.',
        responses: { '200': { description: 'Lista de customers' } },
      },
    },
    '/customers/{id}': {
      get: {
        summary: 'Busca customer.',
        parameters: [idParameter],
        responses: { '200': { description: 'Customer encontrado' }, ...errorResponses },
      },
      patch: {
        summary: 'Atualiza customer.',
        parameters: [idParameter],
        responses: { '200': { description: 'Customer atualizado' }, ...errorResponses },
      },
    },
    '/customers/{id}/verify': {
      post: {
        summary: 'Marca customer como verificado.',
        parameters: [idParameter],
        responses: { '200': { description: 'Customer verificado' }, ...errorResponses },
      },
    },
    '/customers/{id}/block': {
      post: {
        summary: 'Bloqueia customer.',
        parameters: [idParameter],
        responses: { '200': { description: 'Customer bloqueado' }, ...errorResponses },
      },
    },
    '/customers/{id}/archive': {
      post: {
        summary: 'Arquiva customer.',
        parameters: [idParameter],
        responses: { '200': { description: 'Customer arquivado' }, ...errorResponses },
      },
    },
    '/customers/{id}/anonymize': {
      post: {
        summary: 'Anonimiza PII do customer mantendo registros financeiros imutáveis.',
        parameters: [idParameter],
        responses: { '200': { description: 'Customer anonimizado' }, ...errorResponses },
      },
    },
    '/customers/{id}/export': {
      get: {
        summary: 'Exporta dados do customer para atendimento LGPD.',
        parameters: [idParameter],
        responses: { '200': { description: 'Dados exportados' }, ...errorResponses },
      },
    },
    '/customers/{id}/consents': {
      post: {
        summary: 'Registra consentimento/termos do customer.',
        parameters: [idParameter],
        responses: { '201': { description: 'Consentimento registrado' }, ...errorResponses },
      },
      get: {
        summary: 'Lista consentimentos do customer.',
        parameters: [idParameter],
        responses: { '200': { description: 'Lista de consentimentos' }, ...errorResponses },
      },
    },
    '/accounts': {
      post: {
        summary: 'Cria conta financeira/ledger account.',
        responses: { '201': { description: 'Conta criada' }, ...errorResponses },
      },
      get: {
        summary: 'Lista contas do tenant.',
        responses: { '200': { description: 'Lista de contas' } },
      },
    },
    '/accounts/{id}': {
      get: {
        summary: 'Busca conta.',
        parameters: [idParameter],
        responses: { '200': { description: 'Conta encontrada' }, ...errorResponses },
      },
    },
    '/accounts/{id}/balance': {
      get: {
        summary: 'Consulta saldos ledger, available e pending.',
        parameters: [idParameter],
        responses: { '200': { description: 'Saldo da conta' }, ...errorResponses },
      },
    },
    '/accounts/{id}/entries': {
      get: {
        summary: 'Lista lançamentos da conta.',
        parameters: [idParameter],
        responses: { '200': { description: 'Entries da conta' }, ...errorResponses },
      },
    },
    '/accounts/{id}/transactions': {
      get: {
        summary: 'Lista transações que tocaram a conta.',
        parameters: [idParameter],
        responses: { '200': { description: 'Transações da conta' }, ...errorResponses },
      },
    },
    '/financial-accounts': {
      post: {
        summary: 'Cria financial account/wallet ligada a ledger account.',
        responses: { '201': { description: 'Financial account criada' }, ...errorResponses },
      },
      get: {
        summary: 'Lista financial accounts.',
        responses: { '200': { description: 'Lista de financial accounts' } },
      },
    },
    '/holds': {
      post: {
        summary: 'Cria hold/reserva de saldo disponível.',
        responses: { '201': { description: 'Hold criado' }, ...errorResponses },
      },
      get: {
        summary: 'Lista holds.',
        responses: { '200': { description: 'Lista de holds' } },
      },
    },
    '/holds/{id}/release': {
      post: {
        summary: 'Libera hold.',
        parameters: [idParameter],
        responses: { '200': { description: 'Hold liberado' }, ...errorResponses },
      },
    },
    '/holds/{id}/capture': {
      post: {
        summary: 'Captura hold.',
        parameters: [idParameter],
        responses: { '200': { description: 'Hold capturado' }, ...errorResponses },
      },
    },
    '/transactions': {
      post: {
        summary: 'Registra transação double-entry balanceada.',
        parameters: [idempotencyParameter],
        responses: {
          '201': { description: 'Transação criada' },
          '409': { description: 'Conflito de idempotência' },
        },
      },
      get: {
        summary: 'Lista transações do tenant.',
        responses: { '200': { description: 'Lista de transações' } },
      },
    },
    '/transactions/{id}': {
      get: {
        summary: 'Busca transação.',
        parameters: [idParameter],
        responses: { '200': { description: 'Transação encontrada' }, ...errorResponses },
      },
    },
    '/transactions/{id}/reverse': {
      post: {
        summary: 'Cria transação reversa imutável.',
        parameters: [idParameter],
        responses: { '201': { description: 'Reversal criado' }, ...errorResponses },
      },
    },
    '/transfers': {
      post: {
        summary: 'Movimenta valor entre duas contas internas.',
        parameters: [idempotencyParameter],
        responses: {
          '201': { description: 'Transferência postada' },
          '409': { description: 'Conflito de idempotência' },
        },
      },
      get: {
        summary: 'Lista transferências.',
        responses: { '200': { description: 'Lista de transferências' } },
      },
    },
    '/transfers/{id}': {
      get: {
        summary: 'Busca transferência.',
        parameters: [idParameter],
        responses: { '200': { description: 'Transferência encontrada' }, ...errorResponses },
      },
    },
    '/deposits': {
      post: {
        summary: 'Cria depósito sandbox.',
        parameters: [idempotencyParameter],
        responses: { '201': { description: 'Depósito postado' }, ...errorResponses },
      },
    },
    '/withdrawals': {
      post: {
        summary: 'Cria saque sandbox.',
        parameters: [idempotencyParameter],
        responses: { '201': { description: 'Saque postado' }, ...errorResponses },
      },
    },
    '/payments': {
      post: {
        summary: 'Cria pagamento genérico sandbox.',
        parameters: [idempotencyParameter],
        responses: { '201': { description: 'Pagamento postado' }, ...errorResponses },
      },
    },
    '/internal-transfers': {
      post: {
        summary: 'Cria transferência interna como money movement especializado.',
        parameters: [idempotencyParameter],
        responses: { '201': { description: 'Internal transfer postado' }, ...errorResponses },
      },
    },
    '/inbound-transfers': {
      post: {
        summary: 'Cria inbound transfer sandbox de rail externo para conta interna.',
        parameters: [idempotencyParameter],
        responses: { '201': { description: 'Inbound transfer postado' }, ...errorResponses },
      },
    },
    '/outbound-transfers': {
      post: {
        summary: 'Cria outbound transfer sandbox de conta interna para rail externo.',
        parameters: [idempotencyParameter],
        responses: { '201': { description: 'Outbound transfer postado' }, ...errorResponses },
      },
    },
    '/refunds': {
      post: {
        summary: 'Cria refund sandbox com lançamento no ledger.',
        parameters: [idempotencyParameter],
        responses: { '201': { description: 'Refund postado' }, ...errorResponses },
      },
    },
    '/money-movements': {
      get: {
        summary: 'Lista money movements.',
        responses: { '200': { description: 'Lista de money movements' } },
      },
    },
    '/money-movements/{id}': {
      get: {
        summary: 'Busca money movement.',
        parameters: [idParameter],
        responses: { '200': { description: 'Money movement encontrado' }, ...errorResponses },
      },
    },
    '/money-movements/{id}/cancel': {
      post: {
        summary: 'Test helper: cancela money movement.',
        parameters: [idParameter],
        responses: { '200': { description: 'Money movement cancelado' }, ...errorResponses },
      },
    },
    '/money-movements/{id}/fail': {
      post: {
        summary: 'Test helper: falha money movement.',
        parameters: [idParameter],
        responses: { '200': { description: 'Money movement falhou' }, ...errorResponses },
      },
    },
    '/money-movements/{id}/return': {
      post: {
        summary: 'Test helper: retorna money movement.',
        parameters: [idParameter],
        responses: { '200': { description: 'Money movement retornado' }, ...errorResponses },
      },
    },
    '/money-movements/{id}/approve': {
      post: {
        summary: 'Test helper: aprova money movement.',
        parameters: [idParameter],
        responses: { '200': { description: 'Money movement aprovado' }, ...errorResponses },
      },
    },
    '/lending/proposals': {
      post: {
        summary: 'Solicita proposta de lending com scoring e ledger.',
        parameters: [idempotencyParameter],
        responses: {
          '201': { description: 'Proposta aprovada' },
          '422': { description: 'Proposta recusada' },
        },
      },
      get: {
        summary: 'Lista propostas de lending.',
        responses: { '200': { description: 'Lista de propostas' } },
      },
    },
    '/lending/proposals/{id}': {
      get: {
        summary: 'Busca proposta de lending.',
        parameters: [idParameter],
        responses: { '200': { description: 'Proposta encontrada' }, ...errorResponses },
      },
    },
    '/lending/products': {
      post: {
        summary: 'Cria produto de crédito.',
        responses: { '201': { description: 'Produto criado' }, ...errorResponses },
      },
      get: {
        summary: 'Lista produtos de crédito.',
        responses: { '200': { description: 'Lista de produtos' } },
      },
    },
    '/lending/simulations': {
      post: {
        summary: 'Simula oferta de crédito.',
        responses: { '200': { description: 'Simulação calculada' }, ...errorResponses },
      },
    },
    '/lending/applications': {
      post: {
        summary: 'Cria application e offer de crédito.',
        responses: { '201': { description: 'Application criada' }, ...errorResponses },
      },
      get: {
        summary: 'Lista applications.',
        responses: { '200': { description: 'Lista de applications' } },
      },
    },
    '/lending/offers': {
      get: {
        summary: 'Lista offers.',
        responses: { '200': { description: 'Lista de offers' } },
      },
    },
    '/lending/offers/{id}/accept': {
      post: {
        summary: 'Aceita offer, desembolsa no ledger e cria contrato/installments.',
        parameters: [idParameter],
        responses: { '201': { description: 'Contrato criado' }, ...errorResponses },
      },
    },
    '/lending/contracts': {
      get: {
        summary: 'Lista contratos.',
        responses: { '200': { description: 'Lista de contratos' } },
      },
    },
    '/lending/contracts/{id}/installments': {
      get: {
        summary: 'Lista parcelas do contrato.',
        parameters: [idParameter],
        responses: { '200': { description: 'Lista de parcelas' }, ...errorResponses },
      },
    },
    '/lending/installments/{id}/pay': {
      post: {
        summary: 'Paga parcela, lança no ledger e emite installment.paid.',
        parameters: [idParameter],
        responses: { '201': { description: 'Parcela paga' }, ...errorResponses },
      },
    },
    '/accounts/{id}/freeze': {
      post: {
        summary: 'Congela uma conta financeira e registra transição auditável.',
        parameters: [idParameter],
        responses: { '200': { description: 'Conta congelada' }, ...errorResponses },
      },
    },
    '/accounts/{id}/unfreeze': {
      post: {
        summary: 'Reativa uma conta congelada.',
        parameters: [idParameter],
        responses: { '200': { description: 'Conta reativada' }, ...errorResponses },
      },
    },
    '/accounts/{id}/close': {
      post: {
        summary: 'Fecha/bloqueia uma conta para novas movimentações.',
        parameters: [idParameter],
        responses: { '200': { description: 'Conta fechada' }, ...errorResponses },
      },
    },
    '/accounts/{id}/limits': {
      get: {
        summary: 'Consulta limites operacionais da conta.',
        parameters: [idParameter],
        responses: { '200': { description: 'Limites da conta' }, ...errorResponses },
      },
      patch: {
        summary: 'Define limites operacionais da conta.',
        parameters: [idParameter],
        responses: { '200': { description: 'Limites atualizados' }, ...errorResponses },
      },
    },
    '/accounts/{id}/statements': {
      get: {
        summary: 'Lista statements imutáveis da conta.',
        parameters: [idParameter],
        responses: { '200': { description: 'Lista de statements' }, ...errorResponses },
      },
      post: {
        summary: 'Gera statement para período informado a partir das entries.',
        parameters: [idParameter],
        responses: { '201': { description: 'Statement gerado' }, ...errorResponses },
      },
    },
    '/statements/{id}': {
      get: {
        summary: 'Busca statement por ID.',
        parameters: [idParameter],
        responses: { '200': { description: 'Statement encontrado' }, ...errorResponses },
      },
    },
    '/external-accounts': {
      post: {
        summary: 'Cria conta externa verificável.',
        responses: { '201': { description: 'External account criada' }, ...errorResponses },
      },
      get: {
        summary: 'Lista contas externas.',
        responses: { '200': { description: 'Lista de external accounts' } },
      },
    },
    '/external-accounts/{id}/verify': {
      post: {
        summary: 'Verifica conta externa com código determinístico de sandbox.',
        parameters: [idParameter],
        responses: { '200': { description: 'External account verificada' }, ...errorResponses },
      },
    },
    '/payment-methods': {
      post: {
        summary: 'Cria payment method tokenizado.',
        responses: { '201': { description: 'Payment method criado' }, ...errorResponses },
      },
      get: {
        summary: 'Lista payment methods.',
        responses: { '200': { description: 'Lista de payment methods' } },
      },
    },
    '/fee-schedules': {
      post: {
        summary: 'Cria tabela de precificação/taxas.',
        responses: { '201': { description: 'Fee schedule criado' }, ...errorResponses },
      },
      get: {
        summary: 'Lista tabelas de precificação.',
        responses: { '200': { description: 'Lista de fee schedules' } },
      },
    },
    '/pricing-rules': {
      post: {
        summary: 'Cria regra de pricing por produto, rail e faixa de valor.',
        responses: { '201': { description: 'Pricing rule criada' }, ...errorResponses },
      },
      get: {
        summary: 'Lista regras de pricing.',
        responses: { '200': { description: 'Lista de pricing rules' } },
      },
    },
    '/fees': {
      post: {
        summary: 'Cobra fee lançando débito/crédito no ledger.',
        parameters: [idempotencyParameter],
        responses: { '201': { description: 'Fee cobrada' }, ...errorResponses },
      },
      get: {
        summary: 'Lista fees cobradas.',
        responses: { '200': { description: 'Lista de fees' } },
      },
    },
    '/fees/{id}/reverse': {
      post: {
        summary: 'Estorna fee com lançamento reverso no ledger.',
        parameters: [idParameter, idempotencyParameter],
        responses: { '200': { description: 'Fee estornada' }, ...errorResponses },
      },
    },
    '/pix/keys': {
      post: {
        summary: 'Cria chave Pix sandbox determinística.',
        responses: { '201': { description: 'Pix key criada' }, ...errorResponses },
      },
      get: {
        summary: 'Lista chaves Pix sandbox.',
        responses: { '200': { description: 'Lista de Pix keys' } },
      },
    },
    '/pix/charges': {
      post: {
        summary: 'Cria cobrança Pix sandbox.',
        responses: { '201': { description: 'Pix charge criada' }, ...errorResponses },
      },
      get: {
        summary: 'Lista cobranças Pix sandbox.',
        responses: { '200': { description: 'Lista de Pix charges' } },
      },
    },
    '/boletos': {
      post: {
        summary: 'Emite boleto sandbox determinístico.',
        responses: { '201': { description: 'Boleto criado' }, ...errorResponses },
      },
      get: {
        summary: 'Lista boletos sandbox.',
        responses: { '200': { description: 'Lista de boletos' } },
      },
    },
    '/card-products': {
      post: {
        summary: 'Cria card product sandbox com spend controls.',
        responses: { '201': { description: 'Card product criado' }, ...errorResponses },
      },
      get: {
        summary: 'Lista card products.',
        responses: { '200': { description: 'Lista de card products' } },
      },
    },
    '/cards': {
      post: {
        summary: 'Cria cartão sandbox tokenizado.',
        responses: { '201': { description: 'Card criado' }, ...errorResponses },
      },
      get: {
        summary: 'Lista cartões sandbox.',
        responses: { '200': { description: 'Lista de cards' } },
      },
    },
    '/card-authorizations': {
      post: {
        summary: 'Cria autorização de cartão sandbox.',
        responses: { '201': { description: 'Authorization criada' }, ...errorResponses },
      },
      get: {
        summary: 'Lista autorizações de cartão sandbox.',
        responses: { '200': { description: 'Lista de authorizations' } },
      },
    },
    '/webhook-endpoints': {
      post: {
        summary: 'Cria endpoint de webhook.',
        responses: { '201': { description: 'Webhook criado' }, ...errorResponses },
      },
      get: {
        summary: 'Lista endpoints de webhook.',
        responses: { '200': { description: 'Lista de webhooks' } },
      },
    },
    '/webhook-endpoints/{id}/rotate-secret': {
      post: {
        summary: 'Rotaciona segredo do webhook.',
        parameters: [idParameter],
        responses: { '201': { description: 'Segredo rotacionado' }, ...errorResponses },
      },
    },
    '/webhook-deliveries': {
      get: {
        summary: 'Lista entregas de webhook com status, tentativas e respostas truncadas.',
        responses: { '200': { description: 'Lista de webhook deliveries' } },
      },
    },
    '/webhook-deliveries/{id}/retry': {
      post: {
        summary: 'Reagenda delivery de webhook para nova tentativa.',
        parameters: [idParameter],
        responses: { '200': { description: 'Delivery reagendado' }, ...errorResponses },
      },
    },
    '/webhook-test-events': {
      post: {
        summary: 'Cria evento sandbox para testar webhooks.',
        responses: { '201': { description: 'Evento de teste criado' }, ...errorResponses },
      },
    },
    '/events': {
      get: {
        summary: 'Lista eventos de domínio.',
        responses: { '200': { description: 'Lista de eventos' } },
      },
    },
    '/audit-logs': {
      get: {
        summary: 'Lista audit logs do tenant.',
        responses: { '200': { description: 'Lista de audit logs' } },
      },
    },
    '/reconciliation-runs': {
      post: {
        summary: 'Executa conciliação para um período.',
        responses: { '201': { description: 'Reconciliation run criado' }, ...errorResponses },
      },
      get: {
        summary: 'Lista reconciliation runs.',
        responses: { '200': { description: 'Lista de reconciliation runs' } },
      },
    },
    '/reconciliation-runs/{id}/items': {
      get: {
        summary: 'Lista itens/diferenças de uma conciliação.',
        parameters: [idParameter],
        responses: { '200': { description: 'Itens da conciliação' }, ...errorResponses },
      },
    },
    '/reports/ledger-balances': {
      get: {
        summary: 'Relatório operacional de saldos por conta.',
        responses: { '200': { description: 'Relatório de saldos' } },
      },
    },
    '/reports/reconciliation': {
      get: {
        summary: 'Relatório consolidado de conciliações.',
        responses: { '200': { description: 'Relatório de conciliação' } },
      },
    },
    '/reports/outbox': {
      get: {
        summary: 'Relatório de pendências da outbox/webhooks.',
        responses: { '200': { description: 'Relatório de outbox' } },
      },
    },
    '/compliance-requests': {
      get: {
        summary: 'Lista solicitações de compliance/LGPD.',
        responses: { '200': { description: 'Lista de compliance requests' } },
      },
    },
    '/data-retention-policies': {
      post: {
        summary: 'Cria ou atualiza política de retenção por domínio.',
        responses: { '201': { description: 'Política de retenção salva' }, ...errorResponses },
      },
      get: {
        summary: 'Lista políticas de retenção.',
        responses: { '200': { description: 'Lista de políticas de retenção' } },
      },
    },
  },
} as const;
