export type DocArticle = {
  id: string;
  title: string;
  section: string;
  html: string;
  toc: string[];
};

export const docs: DocArticle[] = [
  {
    id: "overview",
    section: "Getting Started",
    title: "FinancialAPI",
    toc: ["Produto", "Escopo real", "Sandbox", "Modelo mental", "Jornada sugerida", "Credenciais"],
    html: `
      <h2>Produto</h2>
      <p><strong>FinancialAPI</strong> é uma plataforma API-first para construir experiências financeiras com ledger double-entry, contas, wallets, movimentação de dinheiro, crédito, fees, auditoria, webhooks e reconciliação. A proposta não é ser uma tela administrativa isolada: a API é o centro do produto e este console existe para demonstrar, testar e explicar todos os fluxos públicos.</p>
      <p>A arquitetura separa o core transacional, a camada HTTP, a orquestração de casos de uso, o scoring de crédito, persistência, cache, mensageria e observabilidade. O resultado é uma base que consegue demonstrar comportamento real de plataforma financeira sem esconder decisões importantes como tenant isolation, idempotência, formato de dinheiro, auditoria e rastreabilidade.</p>
      <p>A experiência do site foi desenhada para uma live demo: o visitante abre a documentação, entende o contrato, configura a Base URL, executa endpoints reais, captura IDs retornados e encadeia operações sem depender de um cliente externo de API.</p>

      <h2>Escopo real</h2>
      <p>Os módulos abaixo representam comportamento implementado e testável por HTTP. Eles não são apenas itens de menu: cada domínio possui endpoints, payloads, respostas, validações e integração com a base operacional.</p>
      <table>
        <thead><tr><th>Domínio</th><th>Responsabilidade</th><th>Por que importa</th></tr></thead>
        <tbody>
          <tr><td>Auth</td><td>Login humano, refresh, logout e contexto do usuário atual.</td><td>Separa acesso humano de acesso machine-to-machine.</td></tr>
          <tr><td>API Keys</td><td>Criação, listagem, rotação e revogação de chaves.</td><td>Resolve tenant e permite integração server-to-server.</td></tr>
          <tr><td>Customers</td><td>Cadastro, status, verificação, bloqueio, arquivamento, consentimento, export e anonimização.</td><td>Modela ciclo de vida do cliente financeiro.</td></tr>
          <tr><td>Accounts</td><td>Contas contábeis, saldo, entries, transactions, limites e statements.</td><td>É a base do ledger e da consulta financeira.</td></tr>
          <tr><td>Financial Accounts</td><td>Conta/wallet voltada ao cliente, holds e reservas.</td><td>Expõe visão de produto acima do ledger contábil.</td></tr>
          <tr><td>Ledger</td><td>Transactions double-entry, entries e reversals.</td><td>Garante integridade contábil por débito/crédito.</td></tr>
          <tr><td>Money Movement</td><td>Depósitos, saques, payments, transfers, inbound, outbound, refunds e estados.</td><td>Modela o ciclo operacional de dinheiro.</td></tr>
          <tr><td>Lending</td><td>Products, simulations, proposals, applications, offers, contracts e installments.</td><td>Demonstra crédito com scoring e contrato.</td></tr>
          <tr><td>Fees</td><td>Schedules, pricing rules, cobranças e reversões.</td><td>Permite monetização e lançamento financeiro auditável.</td></tr>
          <tr><td>Events</td><td>Domain events, webhook endpoints, deliveries, retry e test events.</td><td>Abre a plataforma para integração assíncrona.</td></tr>
          <tr><td>Reconciliation</td><td>Runs, items e relatórios operacionais.</td><td>Ajuda a detectar divergência entre dinheiro operacional e ledger.</td></tr>
          <tr><td>Compliance</td><td>Requests e retention policies.</td><td>Cria superfície para privacidade, governança e retenção.</td></tr>
        </tbody>
      </table>

      <h2>Sandbox</h2>
      <p>Alguns domínios existem como sandbox determinístico. Isso é intencional e explícito. Pix, boleto e card issuing permitem exercitar produto, auditoria, eventos, reconciliação e documentação sem afirmar integração real com bancos, SPI, registradoras, adquirentes ou emissores. Integrações provider-backed pertencem a outro escopo operacional e não são prometidas por estes endpoints sandbox.</p>
      <ul>
        <li><strong>Pix sandbox:</strong> cria chaves e cobranças determinísticas para testar payload, status, eventos e relatórios.</li>
        <li><strong>Boleto sandbox:</strong> cria objetos de cobrança para simular lifecycle de boleto sem registro bancário real.</li>
        <li><strong>Cards sandbox:</strong> cria produtos, cartões e autorizações para modelar hold/capture/autorização.</li>
        <li><strong>Scoring sandbox controlado:</strong> permite decisão determinística quando a política de falha permite.</li>
      </ul>

      <h2>Modelo mental</h2>
      <p>O produto fica mais fácil de entender quando cada camada tem uma função clara. <strong>Customer</strong> representa a pessoa ou empresa. <strong>Financial account</strong> é a conta visível ao cliente. <strong>Ledger account</strong> é o registro contábil que sustenta saldo. <strong>Money movement</strong> é o processo operacional de dinheiro. <strong>Ledger transaction</strong> é o fato contábil. <strong>Domain event</strong> conta o que aconteceu para outros sistemas. <strong>Webhook delivery</strong> tenta entregar esse fato a um destino externo.</p>
      <p>Esse modelo evita uma confusão comum em APIs financeiras: tratar saldo, pagamento, ledger e evento como a mesma coisa. Uma movimentação pode estar em processamento enquanto o ledger ainda não foi postado. Uma autorização de cartão pode reservar saldo sem ser captura final. Uma reversão não apaga a transação original; ela cria lançamento compensatório. Uma entrega de webhook pode falhar mesmo quando o evento de domínio foi persistido com sucesso.</p>

      <h2>Jornada sugerida</h2>
      <ol>
        <li>Teste <code>GET /health</code> e <code>GET /ready</code> para confirmar que a API responde e está pronta.</li>
        <li>Execute <code>GET /v1/tenant</code> com <code>x-api-key</code> para validar o tenant resolvido.</li>
        <li>Faça <code>POST /v1/auth/login</code> e capture o bearer token no painel de ambiente.</li>
        <li>Crie um customer e use o ID retornado para criar uma conta financeira ou conta ledger.</li>
        <li>Faça um depósito ou transaction double-entry com <code>x-idempotency-key</code>.</li>
        <li>Consulte saldo, entries e transactions para verificar o efeito contábil.</li>
        <li>Crie fees, holds, payments e lending proposals para explorar fluxos de produto.</li>
        <li>Registre webhook endpoint, gere test event e acompanhe delivery/retry.</li>
        <li>Rode reconciliation e consulte relatórios para fechar a visão operacional.</li>
      </ol>

      <h2>Credenciais</h2>
      <p>Para a demo de desenvolvimento, use <code>x-api-key: dev-api-key</code>. Para autenticação humana, use <code>admin@example.com</code> com <code>dev-password</code>. O bearer token retornado pelo login pode ser colado no painel <strong>Ambiente</strong> e será anexado automaticamente às rotas que precisam de sessão humana.</p>
    `,
  },
  {
    id: "api-reference",
    section: "API",
    title: "Referência Da API",
    toc: ["Contrato", "Headers", "Erros", "Dinheiro", "Auth", "Clientes", "Contas", "Ledger", "Movimentos", "Crédito", "Eventos"],
    html: `
      <h2>Contrato</h2>
      <p>A API pública é versionada em <code>/v1</code>. Endpoints operacionais como health, readiness, metrics e OpenAPI ficam fora do prefixo versionado porque são usados por runtime, monitoramento e automação. Todas as rotas de negócio são tenant-aware e dependem de <code>x-api-key</code>.</p>
      <table>
        <thead><tr><th>Grupo</th><th>Rotas</th><th>Autenticação</th></tr></thead>
        <tbody>
          <tr><td>Operacional</td><td><code>/health</code>, <code>/ready</code>, <code>/metrics</code>, <code>/openapi.json</code></td><td>Público técnico.</td></tr>
          <tr><td>Tenant</td><td><code>/v1/tenant</code></td><td><code>x-api-key</code>.</td></tr>
          <tr><td>Auth humano</td><td><code>/v1/auth/login</code>, <code>/refresh</code>, <code>/logout</code>, <code>/me</code></td><td>API key e, quando aplicável, bearer.</td></tr>
          <tr><td>Financeiro</td><td>Accounts, ledger, movements, holds, fees e lending.</td><td>API key, idempotência em comandos sensíveis.</td></tr>
          <tr><td>Eventos</td><td>Webhooks, deliveries, test events, audit logs e outbox.</td><td>API key.</td></tr>
          <tr><td>Governança</td><td>Compliance requests, retention policies e relatórios.</td><td>API key.</td></tr>
        </tbody>
      </table>

      <h2>Headers</h2>
      <p>Headers são parte central do contrato. Eles não são detalhes opcionais de implementação, porque definem tenant, sessão, idempotência e correlação.</p>
      <table>
        <thead><tr><th>Header</th><th>Quando usar</th><th>Comportamento</th></tr></thead>
        <tbody>
          <tr><td><code>content-type: application/json</code></td><td>Requests com body JSON.</td><td>Permite parse e validação do payload.</td></tr>
          <tr><td><code>x-api-key</code></td><td>Todas as rotas <code>/v1</code>.</td><td>Resolve tenant e autorização machine-to-machine.</td></tr>
          <tr><td><code>authorization: Bearer</code></td><td>Rotas de usuário autenticado.</td><td>Identifica sessão humana dentro do tenant.</td></tr>
          <tr><td><code>x-idempotency-key</code></td><td>Comandos financeiros suportados.</td><td>Evita duplicidade em retry e replay seguro.</td></tr>
          <tr><td><code>x-request-id</code></td><td>Opcional, recomendado.</td><td>Propaga correlação para logs, erros e métricas.</td></tr>
        </tbody>
      </table>

      <h2>Erros</h2>
      <p>Erros são normalizados para que o consumidor não precise interpretar stack trace ou formatos diferentes por controller. O envelope deve trazer status HTTP, código semântico, mensagem e <code>request_id</code>. Em APIs financeiras, o identificador de correlação é essencial: ele permite investigar a tentativa no console, logs, audit logs, deliveries e métricas.</p>
      <pre><code>{
  "error": {
    "code": "validation_error",
    "message": "Invalid request body",
    "request_id": "req_..."
  }
}</code></pre>
      <ul>
        <li><strong>400:</strong> payload inválido, dinheiro mal formatado, campo obrigatório ausente.</li>
        <li><strong>401:</strong> bearer ausente, inválido ou expirado onde sessão humana é exigida.</li>
        <li><strong>403:</strong> API key sem permissão, tenant inválido ou recurso bloqueado.</li>
        <li><strong>404:</strong> recurso inexistente no tenant atual.</li>
        <li><strong>409:</strong> conflito de idempotência, estado inválido ou operação duplicada.</li>
        <li><strong>422:</strong> regra de domínio recusou a operação apesar do JSON ser bem formado.</li>
        <li><strong>500:</strong> falha inesperada com request id para investigação.</li>
      </ul>

      <h2>Dinheiro</h2>
      <p>Valores financeiros trafegam como strings inteiras em minor units. Nunca use float para dinheiro. Exemplo: <code>"100"</code> representa 1,00 em moeda centesimal; <code>"1050"</code> representa 10,50; <code>"0"</code> representa zero. Essa escolha preserva precisão, serialização e compatibilidade com bancos de dados e linguagens diferentes.</p>
      <ul>
        <li>Campos como <code>amount_minor</code>, <code>balance_minor</code>, <code>ledger_balance_minor</code> e <code>available_balance_minor</code> devem ser strings.</li>
        <li>Não envie <code>10.50</code>, <code>"10,50"</code> ou <code>1050.0</code>.</li>
        <li>Valores negativos só devem existir quando a semântica do endpoint permitir.</li>
        <li>Postagens ledger usam quantias positivas e a direção contábil define débito/crédito.</li>
      </ul>

      <h2>Auth</h2>
      <p>Machine-to-machine e login humano são separados. A API key identifica a aplicação/tenant. O bearer token identifica um usuário humano em sessão. Essa separação permite que integrações server-to-server continuem funcionando sem simular usuário final, enquanto rotas sensíveis de operação humana exigem contexto de sessão.</p>
      <p>Fluxo recomendado: validar tenant com <code>GET /v1/tenant</code>, fazer login humano com <code>POST /v1/auth/login</code>, armazenar o bearer no painel de ambiente e então executar <code>GET /v1/auth/me</code> para confirmar o contexto.</p>

      <h2>Clientes</h2>
      <p>Customers representam pessoas físicas ou empresas. O domínio inclui criação, listagem, consulta, atualização, verificação, bloqueio, arquivamento, anonimização, exportação e consentimentos. Status de customer não deve ser tratado como detalhe visual: ele influencia elegibilidade operacional, compliance e risco.</p>
      <ul>
        <li><code>POST /v1/customers</code> cria cadastro com tipo, nome, email, documento e metadata.</li>
        <li><code>POST /v1/customers/:id/verify</code> marca o customer como verificado.</li>
        <li><code>POST /v1/customers/:id/block</code> remove elegibilidade operacional.</li>
        <li><code>POST /v1/customers/:id/anonymize</code> aplica anonimização onde permitido.</li>
        <li><code>POST /v1/customers/:id/consents</code> registra consentimento versionável.</li>
      </ul>

      <h2>Contas</h2>
      <p>Existem duas leituras importantes: conta contábil e conta financeira de produto. A conta contábil sustenta ledger, entries, transactions e saldo. A conta financeira é a visão mais próxima de wallet/conta de cliente. Holds alteram saldo disponível, mas não são a mesma coisa que entries contábeis.</p>
      <table>
        <thead><tr><th>Endpoint</th><th>Uso</th><th>Observação</th></tr></thead>
        <tbody>
          <tr><td><code>POST /v1/accounts</code></td><td>Cria conta ledger.</td><td>Define direção contábil.</td></tr>
          <tr><td><code>GET /v1/accounts/:id/balance</code></td><td>Consulta saldo.</td><td>Mostra ledger, disponível e reservado.</td></tr>
          <tr><td><code>GET /v1/accounts/:id/entries</code></td><td>Lista lançamentos.</td><td>Útil para auditoria e extrato técnico.</td></tr>
          <tr><td><code>PATCH /v1/accounts/:id/limits</code></td><td>Atualiza limites.</td><td>Afeta regras operacionais.</td></tr>
          <tr><td><code>POST /v1/holds</code></td><td>Reserva saldo.</td><td>Modela autorização/reserva antes de captura.</td></tr>
        </tbody>
      </table>

      <h2>Ledger</h2>
      <p>O ledger segue double-entry: cada transaction relevante tem entries com total de débitos igual ao total de créditos. A transação original não deve ser editada para corrigir erro financeiro; a correção é feita por reversal, criando lançamento compensatório e preservando trilha histórica.</p>
      <pre><code>{
  "description": "Manual ledger posting",
  "entries": [
    { "account_id": "source", "direction": "debit", "amount_minor": "1000" },
    { "account_id": "destination", "direction": "credit", "amount_minor": "1000" }
  ]
}</code></pre>
      <ul>
        <li>Use no mínimo duas entries para uma transaction contábil relevante.</li>
        <li>Débitos e créditos precisam fechar no mesmo total.</li>
        <li>Reversal cria nova transaction; não apaga nem reescreve a antiga.</li>
        <li>Metadata deve capturar motivo, origem e correlação externa quando existir.</li>
      </ul>

      <h2>Movimentos</h2>
      <p>Money movements representam o ciclo operacional: depósito, saque, pagamento, transferência interna, inbound transfer, outbound transfer e refund. O movimento pode estar em análise, processando, postado, retornado, falho ou cancelado. O ledger registra o fato contábil; o movement registra a vida operacional daquele dinheiro.</p>
      <p>Comandos de money movement devem ser tratados como sensíveis a retry. Se a conexão cair depois do processamento, o cliente deve poder repetir a mesma requisição com a mesma idempotency key e receber resultado consistente.</p>

      <h2>Crédito</h2>
      <p>Lending cobre produto de crédito, simulação, proposta, application, offer, acceptance, contract e installments. A decisão de proposta passa por scoring gRPC. A postura padrão é falhar fechado para crédito real: se scoring não consegue responder com confiança, a plataforma não deve aprovar automaticamente.</p>
      <ul>
        <li><code>POST /v1/lending/products</code> define produto, taxa, prazo e parâmetros.</li>
        <li><code>POST /v1/lending/simulations</code> calcula parcelas e custo estimado.</li>
        <li><code>POST /v1/lending/proposals</code> chama scoring e registra decisão.</li>
        <li><code>POST /v1/lending/applications</code> cria solicitação formal.</li>
        <li><code>POST /v1/lending/offers/:id/accept</code> cria contrato.</li>
        <li><code>POST /v1/lending/installments/:id/pay</code> registra pagamento de parcela.</li>
      </ul>

      <h2>Eventos</h2>
      <p>Eventos de domínio são a memória assíncrona do que aconteceu. Webhooks permitem entregar esses eventos para consumidores externos. A entrega tem lifecycle próprio: pode ficar aguardando envio, ser entregue, falhar, entrar em retry ou dead-letter. Isso impede que uma falha de rede apague o fato de negócio.</p>
      <p>Webhooks possuem secret com prefixo <code>whsec_</code>, rotação de secret, deliveries rastreáveis, status code, duração, erro e retry manual. Test events ajudam a validar integração antes de depender de eventos reais.</p>
    `,
  },
  {
    id: "architecture",
    section: "Architecture",
    title: "Arquitetura",
    toc: ["Visão geral", "Camadas", "HTTP", "Composition", "Persistência", "Cache", "Mensageria", "Scoring", "Segurança", "Escalabilidade"],
    html: `
      <h2>Visão geral</h2>
      <p>A plataforma usa uma arquitetura modular em que HTTP, domínio, persistência, mensageria, scoring e observabilidade têm fronteiras claras. O objetivo é permitir evolução por domínio sem transformar o servidor em um arquivo central com regra de negócio misturada com roteamento, query SQL e serialização.</p>
      <p>O desenho privilegia previsibilidade. APIs financeiras precisam explicar o que acontece quando uma request falha no meio, quando o usuário repete o clique, quando o provider externo atrasa, quando o webhook cai ou quando a conciliação encontra divergência. Por isso a arquitetura dá destaque a idempotência, outbox, audit log, request id, métricas e transações de banco.</p>

      <h2>Camadas</h2>
      <table>
        <thead><tr><th>Camada</th><th>Responsabilidade</th><th>Regra de qualidade</th></tr></thead>
        <tbody>
          <tr><td>Bootstrap</td><td>Carregar runtime, configuração, observabilidade e servidor.</td><td>Falhar cedo quando configuração essencial estiver inválida.</td></tr>
          <tr><td>HTTP</td><td>Rotas, middlewares, controllers, OpenAPI e response helpers.</td><td>Não concentrar regra financeira complexa.</td></tr>
          <tr><td>Application</td><td>Use cases, sagas e orquestração de fluxo.</td><td>Ser explícita sobre idempotência e transação.</td></tr>
          <tr><td>Domain</td><td>Tipos, dinheiro, invariantes e regras de negócio.</td><td>Não depender de Hono, Redis, PostgreSQL ou RabbitMQ.</td></tr>
          <tr><td>Infrastructure</td><td>Banco, cache, gRPC, mensageria, telemetria e adapters.</td><td>Traduzir contratos externos para tipos internos.</td></tr>
          <tr><td>Console</td><td>Documentação, teste de endpoint, captura de ID e operação rápida.</td><td>Enviar requests reais para a Base URL configurada.</td></tr>
        </tbody>
      </table>

      <h2>HTTP</h2>
      <p>O servidor HTTP registra middlewares globais, roteamento versionado, endpoints operacionais e handlers de erro. O middleware de tenant lê <code>x-api-key</code>, resolve o tenant e injeta contexto para controllers. O request context carrega <code>request_id</code>, headers relevantes e dados que precisam atravessar logs, métricas e respostas.</p>
      <ul>
        <li>Health responde se o processo está vivo.</li>
        <li>Readiness responde se dependências essenciais estão prontas.</li>
        <li>OpenAPI descreve contrato público e usa <code>format: uuid</code> mesmo para UUIDv7.</li>
        <li>Metrics exporta formato Prometheus.</li>
        <li>Erros são normalizados para envelope consistente.</li>
      </ul>

      <h2>Composition</h2>
      <p>O composition root monta a aplicação. Ele instancia adapters de persistência, clients externos, services, use cases e controllers. Isso deixa o wiring rastreável e reduz acoplamento oculto. Quando um módulo cresce, ele deve ganhar dependências explícitas, não imports globais espalhados.</p>
      <p>Essa escolha também ajuda testes e evolução. Um use case pode receber uma porta de persistência, um clock, um gerador de ID, um publicador de eventos e um serviço de idempotência sem saber se por baixo existe PostgreSQL, Redis, RabbitMQ ou implementação em memória para teste.</p>

      <h2>Persistência</h2>
      <p>PostgreSQL guarda o estado transacional: tenants, API keys, sessions, customers, accounts, ledger transactions, entries, money movements, holds, fees, lending, events, audit logs, outbox, webhooks, reconciliation e compliance. Operações financeiras relevantes devem acontecer em transação de banco, especialmente quando atualizam saldo e criam entries.</p>
      <ul>
        <li>Tenant context deve ser aplicado antes de queries sensíveis.</li>
        <li>IDs novos usam UUIDv7 para ordenação temporal e compatibilidade UUID.</li>
        <li>Money fica como minor units, nunca float.</li>
        <li>Audit logs registram ações de comando.</li>
        <li>Outbox evita perder eventos quando a transação principal conclui.</li>
      </ul>

      <h2>Cache</h2>
      <p>Redis é usado principalmente para idempotência e cache operacional de curta duração. O ponto crítico é o hash da request: a mesma idempotency key com payload diferente deve gerar conflito, não replay silencioso. Isso protege endpoints financeiros contra cliques duplicados, timeouts e retries de rede.</p>
      <table>
        <thead><tr><th>Cenário</th><th>Resposta esperada</th></tr></thead>
        <tbody>
          <tr><td>Mesma key, mesmo body, primeira tentativa concluída</td><td>Replay do resultado armazenado.</td></tr>
          <tr><td>Mesma key, body diferente</td><td>Conflito de idempotência.</td></tr>
          <tr><td>Key ausente em comando sensível</td><td>Recusa ou processamento sem garantia, conforme endpoint.</td></tr>
          <tr><td>Processamento em andamento</td><td>Resposta de conflito/estado intermediário para evitar duplicidade.</td></tr>
        </tbody>
      </table>

      <h2>Mensageria</h2>
      <p>Eventos financeiros não devem depender de entrega síncrona para serem considerados registrados. A plataforma persiste domain event e outbox, depois processa entrega para RabbitMQ/webhook. Isso dá resiliência: uma falha temporária de consumer não desfaz uma transação financeira já confirmada.</p>
      <p>O padrão outbox também melhora observabilidade. É possível listar eventos aguardando despacho, falhos, entregues e reprocessados. Webhook deliveries armazenam status, tentativa, duração e erro. Replays são explícitos e auditáveis.</p>

      <h2>Scoring</h2>
      <p>O scoring roda como serviço separado via gRPC. O contrato <code>financial_api.scoring.v1</code> recebe dados de aplicação de crédito, metadata e contexto de tenant/request. A decisão retorna aprovação, limite, razão e sinais calculados. O cliente TypeScript usa deadline e trata falhas transitórias com cuidado.</p>
      <ul>
        <li>Crédito real deve falhar fechado quando scoring fica indisponível.</li>
        <li>Sandbox controlado pode devolver decisão determinística para demonstração.</li>
        <li>Metadata inclui request id, tenant id, idempotency key e caller.</li>
        <li>Métricas de scoring ajudam a detectar indisponibilidade antes de afetar produto.</li>
      </ul>

      <h2>Segurança</h2>
      <p>A segurança começa no contrato de acesso: API key para tenant, bearer para usuário humano, escopos para chaves, audit logs para comandos e mascaramento de segredos. Nenhuma chave secreta deve ser exibida repetidamente depois de criada ou rotacionada. Revogação precisa impedir reutilização.</p>
      <ul>
        <li>Secrets de webhook usam prefixo reconhecível e rotação explícita.</li>
        <li>Login humano tem proteção contra abuso e rastreio de tentativas.</li>
        <li>Tenant isolation é requisito transversal, não detalhe de repository.</li>
        <li>Dados financeiros devem ser exportáveis e auditáveis, mas não apagados de forma ingênua.</li>
      </ul>

      <h2>Escalabilidade</h2>
      <p>A postura de escala é horizontal para o HTTP core, banco transacional como fonte de verdade, Redis para idempotência compartilhada, outbox processada por workers e scoring escalável separadamente. Leituras operacionais usam filtros, índices por tenant e limites para preservar previsibilidade.</p>
      <p>O design favorece módulos com baixo acoplamento. Rails sandbox ficam explícitos como demonstração determinística, e produtos financeiros reutilizam ledger, events, audit e idempotência em vez de reinventar saldo isolado.</p>
    `,
  },
  {
    id: "observability",
    section: "Operations",
    title: "Observabilidade",
    toc: ["Objetivo", "Sinais", "Health", "Métricas", "Logs", "Auditoria", "Webhooks", "Conciliação", "Alertas", "Runbooks"],
    html: `
      <h2>Objetivo</h2>
      <p>Observabilidade em plataforma financeira não é enfeite de infraestrutura. Ela responde perguntas de negócio: uma transação foi postada? Um retry duplicou dinheiro? Um webhook falhou? O scoring ficou indisponível? A conciliação encontrou diferença? Um cliente foi bloqueado antes de tentar sacar?</p>
      <p>O console e a API expõem sinais para investigação ponta a ponta: request id, métricas, audit logs, events, deliveries, reconciliation reports e readiness.</p>

      <h2>Sinais</h2>
      <table>
        <thead><tr><th>Sinal</th><th>Fonte</th><th>Uso operacional</th></tr></thead>
        <tbody>
          <tr><td>Request id</td><td>HTTP context</td><td>Correlaciona erro, log, audit e resposta.</td></tr>
          <tr><td>Metrics</td><td>Prometheus exposition</td><td>Taxa, latência, erro, idempotência e eventos.</td></tr>
          <tr><td>Audit log</td><td>Comandos de negócio</td><td>Explica quem fez o quê, quando e em qual tenant.</td></tr>
          <tr><td>Domain events</td><td>Aplicação/outbox</td><td>Mostra fatos gerados por operações.</td></tr>
          <tr><td>Webhook deliveries</td><td>Dispatcher</td><td>Mostra tentativa, status, erro e retry.</td></tr>
          <tr><td>Reconciliation</td><td>Reports</td><td>Detecta divergência entre ledger e movimentos.</td></tr>
        </tbody>
      </table>

      <h2>Health</h2>
      <p><code>GET /health</code> é liveness: responde se o processo HTTP está vivo. <code>GET /ready</code> é readiness: responde se dependências críticas permitem receber tráfego. Essa diferença importa em deploy: um processo pode estar vivo, mas indisponível para operar se banco, cache ou serviço essencial falhar.</p>

      <h2>Métricas</h2>
      <p>Métricas são expostas em formato Prometheus. Elas devem permitir observar tráfego HTTP, latência aproximada, erros, postagens ledger, conflitos de idempotência, replays, eventos por domínio, scoring, webhooks e conciliação.</p>
      <ul>
        <li><code>http_requests_total</code>: volume por rota/status.</li>
        <li><code>http_request_duration_seconds_p95</code>: postura de latência.</li>
        <li><code>ledger_postings_total</code>: atividade contábil.</li>
        <li><code>idempotency_conflicts_total</code>: payload diferente usando mesma key.</li>
        <li><code>idempotency_replays_total</code>: respostas reaproveitadas com segurança.</li>
        <li><code>financial_domain_events_total</code>: eventos por domínio.</li>
        <li><code>webhook_delivery_failures_total</code>: falhas de entrega externa.</li>
        <li><code>reconciliation_state</code>: estado agregado da conciliação.</li>
      </ul>

      <h2>Logs</h2>
      <p>Logs devem carregar <code>request_id</code>, método, rota, status, latência, tenant quando disponível e erro normalizado. Em produção, logs financeiros precisam evitar segredo, token, senha, API key completa, documento sensível e payloads grandes sem mascaramento.</p>
      <p>Um bom log para incidente não precisa conter tudo; precisa conter o suficiente para encontrar o resto. O request id aponta para audit log, delivery, event e resposta.</p>

      <h2>Auditoria</h2>
      <p>Audit logs registram operações de comando. Eles são diferentes de logs técnicos: audit log existe para responder a perguntas de governança e negócio. Quem criou a key? Quem bloqueou customer? Qual request gerou reversão? Qual tenant executou alteração?</p>
      <ul>
        <li>Audit log deve ser append-only do ponto de vista operacional.</li>
        <li>Metadata deve evitar segredo e payload sensível cru.</li>
        <li>Ações financeiras devem preservar antes/depois quando útil.</li>
        <li>Retenção deve respeitar política do domínio.</li>
      </ul>

      <h2>Webhooks</h2>
      <p>Webhook delivery é observado como lifecycle próprio. O evento pode existir e a delivery falhar. Isso é normal em sistemas distribuídos. Por isso a plataforma lista deliveries, status, tentativas, códigos HTTP, duração, erro e permite retry manual.</p>
      <table>
        <thead><tr><th>Status</th><th>Significado</th><th>Ação</th></tr></thead>
        <tbody>
          <tr><td><code>pending</code></td><td>Aguardando envio.</td><td>Dispatcher deve tentar.</td></tr>
          <tr><td><code>delivered</code></td><td>Destino respondeu com sucesso.</td><td>Nenhuma ação.</td></tr>
          <tr><td><code>failed</code></td><td>Tentativa falhou.</td><td>Avaliar retry, erro e endpoint.</td></tr>
          <tr><td><code>dead_letter</code></td><td>Excedeu política de tentativa.</td><td>Investigar antes de reprocessar.</td></tr>
        </tbody>
      </table>

      <h2>Conciliação</h2>
      <p>Reconciliação compara visões que precisam fechar. A postura implementada verifica ledger e money movements por período. Comparações com provider statements, settlement files, chargebacks, devoluções, rejeições e eventos externos pertencem ao escopo de adapters provider-backed.</p>
      <p>O objetivo não é apenas calcular diferença; é produzir item investigável. Uma diferença sem trilha operacional vira trabalho manual. Uma diferença com run, item, período, totals e request id vira fila de correção.</p>

      <h2>Alertas</h2>
      <ul>
        <li><strong>5xx alto:</strong> indica falha de API ou dependência crítica.</li>
        <li><strong>p95 alto:</strong> degradação de latência percebida.</li>
        <li><strong>idempotency conflicts alto:</strong> cliente enviando payload divergente com mesma key.</li>
        <li><strong>webhook failures alto:</strong> destinos externos indisponíveis ou secret/config incorreto.</li>
        <li><strong>outbox atrasada:</strong> eventos persistidos sem escoamento.</li>
        <li><strong>scoring indisponível:</strong> risco de bloquear origem de crédito.</li>
        <li><strong>reconciliation difference:</strong> divergência financeira que exige investigação.</li>
      </ul>

      <h2>Runbooks</h2>
      <p>Quando uma operação falhar, comece pelo painel de resposta do Explorer. Copie o <code>request_id</code>, confira status HTTP, body e headers. Depois consulte audit logs, events, deliveries e relatórios. Para problemas de dinheiro, compare money movement, ledger transaction, entries e balance. Para problemas de crédito, confira proposal, scoring metadata, application, offer e contract. Para problemas de webhook, confira endpoint, secret, delivery status, attempt count e erro.</p>
    `,
  },
  {
    id: "guide",
    section: "Guide",
    title: "Guia De Testes",
    toc: ["Preparação", "Fluxo mínimo", "Fluxo ledger", "Fluxo wallet", "Fluxo crédito", "Fluxo eventos", "Fluxo reconciliação", "Diagnóstico"],
    html: `
      <h2>Preparação</h2>
      <p>No painel <strong>Ambiente</strong>, confirme Base URL, API key e bearer token. Em uma demo publicada, a Base URL deve apontar para a API pública disponível. Em desenvolvimento, a Base URL comum é <code>http://localhost:5000</code>. A API key de desenvolvimento é <code>dev-api-key</code>.</p>
      <p>O API Explorer possui três modos: <strong>Simples</strong>, para testar sem editar JSON; <strong>JSON Configurável</strong>, para alterar payload padrão; e <strong>JSON Pronto</strong>, para enviar o exemplo completo com um clique. O console captura IDs retornados e os reaplica em endpoints dependentes.</p>

      <h2>Fluxo mínimo</h2>
      <ol>
        <li>Execute <code>GET /health</code>.</li>
        <li>Execute <code>GET /ready</code>.</li>
        <li>Execute <code>GET /v1/tenant</code> com API key.</li>
        <li>Execute <code>POST /v1/auth/login</code> com <code>admin@example.com</code> e <code>dev-password</code>.</li>
        <li>Cole/capture o bearer token no ambiente.</li>
        <li>Execute <code>GET /v1/auth/me</code> para validar sessão.</li>
      </ol>

      <h2>Fluxo ledger</h2>
      <p>O fluxo ledger prova a parte mais importante da plataforma: dinheiro com contabilidade double-entry. Crie duas contas, faça uma transaction com uma entry debit e uma entry credit no mesmo valor, consulte balance e depois reverta.</p>
      <ol>
        <li><code>POST /v1/accounts</code> para criar conta de origem.</li>
        <li><code>POST /v1/accounts</code> para criar conta de destino.</li>
        <li><code>POST /v1/transactions</code> com duas entries balanceadas.</li>
        <li><code>GET /v1/accounts/:id/balance</code> para conferir saldo.</li>
        <li><code>GET /v1/accounts/:id/entries</code> para ver lançamento contábil.</li>
        <li><code>POST /v1/transactions/:id/reverse</code> para criar compensação.</li>
      </ol>

      <h2>Fluxo wallet</h2>
      <p>O fluxo wallet combina customer, financial account, hold e movement. Ele demonstra visão de produto além da contabilidade. Use customer como dono, crie wallet, faça depósito, crie hold e depois capture ou release.</p>
      <ol>
        <li><code>POST /v1/customers</code> para criar cliente.</li>
        <li><code>POST /v1/customers/:id/verify</code> para marcar verificado.</li>
        <li><code>POST /v1/financial-accounts</code> para criar conta financeira.</li>
        <li><code>POST /v1/deposits</code> para entrada de dinheiro.</li>
        <li><code>POST /v1/holds</code> para reserva.</li>
        <li><code>POST /v1/holds/:id/release</code> ou <code>/capture</code> para concluir.</li>
      </ol>

      <h2>Fluxo crédito</h2>
      <p>O fluxo de crédito passa por produto, simulação, proposta com scoring, application, offer, acceptance, contract e pagamento de installment. Ele demonstra integração síncrona com serviço de scoring e persistência da decisão.</p>
      <ol>
        <li><code>POST /v1/lending/products</code> para definir produto.</li>
        <li><code>POST /v1/lending/simulations</code> para calcular parcelas.</li>
        <li><code>POST /v1/lending/proposals</code> para acionar scoring.</li>
        <li><code>POST /v1/lending/applications</code> para criar solicitação formal.</li>
        <li><code>GET /v1/lending/offers</code> para localizar offer.</li>
        <li><code>POST /v1/lending/offers/:id/accept</code> para criar contract.</li>
        <li><code>GET /v1/lending/contracts/:id/installments</code> para consultar parcelas.</li>
        <li><code>POST /v1/lending/installments/:id/pay</code> para pagamento.</li>
      </ol>

      <h2>Fluxo eventos</h2>
      <p>Registre webhook endpoint, gere test event, liste events e deliveries, depois force retry quando uma entrega falhar. Esse fluxo mostra que evento de domínio e entrega HTTP externa são coisas diferentes.</p>
      <ol>
        <li><code>POST /v1/webhook-endpoints</code> cria endpoint e retorna secret uma vez.</li>
        <li><code>POST /v1/webhook-test-events</code> cria evento determinístico.</li>
        <li><code>GET /v1/events</code> mostra fatos gerados.</li>
        <li><code>GET /v1/webhook-deliveries</code> mostra tentativas.</li>
        <li><code>POST /v1/webhook-deliveries/:id/retry</code> reprocessa entrega.</li>
      </ol>

      <h2>Fluxo reconciliação</h2>
      <p>Depois de gerar movimentos e ledger entries, rode reconciliação. O objetivo é confirmar se totais e contagens esperadas estão alinhados. Em uma operação real, esse fluxo evoluiria para comparar arquivos e eventos externos.</p>
      <ol>
        <li><code>POST /v1/reconciliation-runs</code> com período.</li>
        <li><code>GET /v1/reconciliation-runs</code> para listar execuções.</li>
        <li><code>GET /v1/reconciliation-runs/:id/items</code> para ver itens.</li>
        <li><code>GET /v1/reports/ledger-balances</code> para leitura agregada.</li>
        <li><code>GET /v1/reports/reconciliation</code> para resumo operacional.</li>
        <li><code>GET /v1/reports/outbox</code> para status de eventos.</li>
      </ol>

      <h2>Diagnóstico</h2>
      <p>Se uma chamada falhar, verifique nesta ordem: Base URL, API key, bearer token, body JSON, idempotency key, IDs capturados, status HTTP e <code>request_id</code>. Para erro 409, compare idempotency key e payload. Para erro 404, confirme tenant e ID. Para erro 422, leia a regra de domínio. Para erro 500, use request id para investigar logs e métricas.</p>
    `,
  },
  {
    id: "rules",
    section: "Rules",
    title: "Critérios De Governança",
    toc: ["Princípios", "Dinheiro", "Idempotência", "Tenant", "Ledger", "APIs", "Eventos", "Sandbox", "Documentação"],
    html: `
      <h2>Princípios</h2>
      <p>A governança da plataforma preserva sua natureza financeira: tenant, dinheiro, idempotência, auditoria, eventos, erro, observabilidade, replay e contrato público são critérios permanentes de design. Um comportamento público é tratado como completo quando pode ser testado no Explorer, explicado na documentação e observado em operação.</p>

      <h2>Dinheiro</h2>
      <ul>
        <li>Dinheiro deve usar minor units em string no JSON.</li>
        <li>Domínio interno deve evitar float e arredondamento implícito.</li>
        <li>Campos monetários precisam deixar unidade clara no nome.</li>
        <li>Conversões devem ser centralizadas e testáveis.</li>
        <li>Saldo disponível não é igual a saldo ledger quando existem holds.</li>
      </ul>

      <h2>Idempotência</h2>
      <p>Todo comando financeiro novo deve avaliar idempotência. Repetir a mesma operação com a mesma key e o mesmo payload deve ser seguro. Repetir a mesma key com payload diferente deve gerar conflito. Isso protege consumidores, usuários finais e a própria plataforma contra timeouts e retries duplicados.</p>

      <h2>Tenant</h2>
      <p>Tenant isolation é transversal. Nenhuma listagem, consulta, comando ou relatório deve vazar dado entre tenants. API key resolve o tenant antes da regra de negócio. IDs globais não substituem filtro por tenant.</p>

      <h2>Ledger</h2>
      <p>Ledger não deve ser usado como tabela de saldo simples. Ele registra fatos contábeis. Correção é reversal, não edição destrutiva. Entries devem fechar débito e crédito. Metadata deve preservar origem, razão e referência externa quando existir.</p>

      <h2>APIs</h2>
      <ul>
        <li>Endpoints públicos devem preservar status codes, envelope de erro e formato monetário.</li>
        <li>Mudança incompatível precisa de nova versão ou migração clara de contrato.</li>
        <li>OpenAPI deve acompanhar rota real.</li>
        <li>Explorer deve ter exemplo simples, JSON configurável e JSON pronto quando fizer sentido.</li>
        <li>Rotas de listagem devem ter limites, filtros e ordenação previsível quando crescerem.</li>
      </ul>

      <h2>Eventos</h2>
      <p>Eventos devem representar fatos de domínio, não logs genéricos. Webhook delivery deve ser rastreável e reprocessável. Outbox deve impedir perda entre transação de banco e publicação assíncrona. Retry precisa ser explícito e observável.</p>

      <h2>Sandbox</h2>
      <p>Sandbox é explicitamente honesto. Pix, boleto, cards e rails externos aparecem como simulação determinística; provider real, homologação, secrets produtivos e reconciliação externa pertencem ao escopo de integração provider-backed.</p>

      <h2>Documentação</h2>
      <p>A documentação pública do site deve explicar produto, contrato, arquitetura, operação e fluxos de teste sem depender de leitura externa. Cada endpoint no Explorer precisa dizer o que faz, que headers usa, que IDs exige, o que retorna e em qual fluxo aparece.</p>
    `,
  },
];
