import { CheckCircle2, XCircle } from 'lucide-react';
import { stringifyJson } from '../../lib/json';
import type { ApiResponseLog, EndpointSpec, RuntimeEnvironment } from '../../types/api';

type Props = {
  endpoint: EndpointSpec;
  env: RuntimeEnvironment;
  payload: string;
  response: ApiResponseLog | null;
  loading: boolean;
};

export function ResponseConsole({ endpoint, env, payload, response, loading }: Props) {
  return (
    <aside className="response-console">
      <div className="console-head">
        <span>Request</span>
        <code>application/json</code>
      </div>
      <pre className="request-preview">
        <span className={`verb ${endpoint.method.toLowerCase()}`}>{endpoint.method}</span> {endpoint.path}
        {'\n'}x-api-key: {env.apiKey ? '***' : 'none'}
        {'\n'}authorization: {env.bearerToken ? 'Bearer ***' : 'none'}
        {endpoint.method !== 'GET' ? `\n\n${payload}` : ''}
      </pre>
      <div className="console-head">
        <span>Response</span>
        {response && (
          <strong className={response.status < 400 ? 'ok' : 'bad'}>
            {response.status < 400 ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
            {response.status} em {response.durationMs}ms
          </strong>
        )}
      </div>
      <div className="response-body">
        {loading && <div className="spinner" />}
        {!loading && !response && <p>Aguardando requisição...</p>}
        {!loading && response && (
          <>
            <pre className="headers">{stringifyJson(response.headers)}</pre>
            <pre className={response.status < 400 ? 'json ok-text' : 'json bad-text'}>{stringifyJson(response.body)}</pre>
          </>
        )}
      </div>
    </aside>
  );
}
