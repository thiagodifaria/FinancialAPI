import { ArrowRight, BookText, Code2, Server, Terminal } from 'lucide-react';
import type { AppTab } from '../../types/navigation';

const modules = [
  {
    title: 'Guias Detalhados',
    body: 'Aprenda arquitetura financeira, idempotência, ledger e webhooks em guias objetivos.',
    icon: BookText,
    tab: 'docs' as AppTab,
  },
  {
    title: 'Sandbox Interativo',
    body: 'Teste endpoints reais, veja payloads, capture IDs e execute fluxos completos.',
    icon: Terminal,
    tab: 'api' as AppTab,
  },
  {
    title: 'Operação Rápida',
    body: 'Acompanhe health, readiness, events, audit logs, fees e dados do tenant.',
    icon: Server,
    tab: 'ops' as AppTab,
  },
];

export function HomeView({ setTab }: { setTab: (tab: AppTab) => void }) {
  return (
    <main className="home-view">
      <section className="hero">
        <div className="hero-bg" />
        <div className="hero-content">
          <div className="eyebrow"><span /> Console real conectado à API local</div>
          <h1>
            A infraestrutura financeira
            <br />
            <strong>do futuro, hoje.</strong>
          </h1>
          <p>
            Integre contas digitais, ledger, pagamentos, crédito, fees e auditoria em uma
            plataforma financeira limpa, resiliente e pronta para evoluir.
          </p>
          <div className="hero-actions">
            <button onClick={() => setTab('api')}>
              Explorar API <Code2 size={18} />
            </button>
            <button className="secondary" onClick={() => setTab('docs')}>
              Ler docs <BookText size={18} />
            </button>
          </div>
        </div>
      </section>
      <section className="module-grid">
        {modules.map((module) => (
          <button key={module.title} className="module-card" onClick={() => setTab(module.tab)}>
            <module.icon size={24} />
            <h2>{module.title}</h2>
            <p>{module.body}</p>
            <span>Começar <ArrowRight size={16} /></span>
          </button>
        ))}
      </section>
    </main>
  );
}
