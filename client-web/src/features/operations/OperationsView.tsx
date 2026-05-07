import { Activity, RefreshCcw } from 'lucide-react';
import { useState } from 'react';
import { requestApi } from '../../api/httpClient';
import { stringifyJson } from '../../lib/json';
import type { ApiResponseLog, RuntimeEnvironment } from '../../types/api';

const checks = [
  ['Health', 'GET', '/health'],
  ['Ready', 'GET', '/ready'],
  ['Customers', 'GET', '/v1/customers'],
  ['Accounts', 'GET', '/v1/accounts'],
  ['Movements', 'GET', '/v1/money-movements'],
  ['Fees', 'GET', '/v1/fees'],
  ['Events', 'GET', '/v1/events'],
  ['Audit', 'GET', '/v1/audit-logs'],
] as const;

export function OperationsView() {
  const stored = localStorage.getItem('financial-api-env');
  const env: RuntimeEnvironment = stored
    ? JSON.parse(stored)
    : {
        apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000',
        apiKey: 'dev-api-key',
        bearerToken: '',
        customerId: '',
        accountId: '',
        resourceId: '',
        productId: '',
      };
  const [results, setResults] = useState<Record<string, ApiResponseLog>>({});
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    const next: Record<string, ApiResponseLog> = {};
    for (const [label, method, path] of checks) {
      next[label] = await requestApi({ env, method, path });
      setResults({ ...next });
    }
    setLoading(false);
  }

  return (
    <main className="ops-view">
      <div className="ops-header">
        <div>
          <span className="section-label">Operações</span>
          <h1>Runtime da API</h1>
          <p>Consultas reais contra o core local usando as credenciais salvas no API Explorer.</p>
        </div>
        <button onClick={refresh} disabled={loading}>
          <RefreshCcw size={16} /> {loading ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>
      <div className="ops-grid">
        {checks.map(([label, , path]) => {
          const result = results[label];
          return (
            <section key={label} className="ops-card">
              <header>
                <Activity size={18} />
                <strong>{label}</strong>
                <code>{path}</code>
                {result && <span className={result.status < 400 ? 'ok' : 'bad'}>{result.status}</span>}
              </header>
              <pre>{result ? stringifyJson(result.body) : 'Sem consulta ainda.'}</pre>
            </section>
          );
        })}
      </div>
    </main>
  );
}
