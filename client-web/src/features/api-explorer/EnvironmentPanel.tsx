import { Settings } from 'lucide-react';
import type { RuntimeEnvironment } from '../../types/api';

type Props = {
  env: RuntimeEnvironment;
  setEnv: (env: RuntimeEnvironment) => void;
};

export function EnvironmentPanel({ env, setEnv }: Props) {
  const update = (key: keyof RuntimeEnvironment, value: string) => setEnv({ ...env, [key]: value });

  return (
    <div className="env-panel">
      <h3>
        <Settings size={14} /> Ambiente
      </h3>
      <label>Base URL</label>
      <input value={env.apiBaseUrl} onChange={(event) => update('apiBaseUrl', event.target.value)} />
      <label>API Key</label>
      <input value={env.apiKey} onChange={(event) => update('apiKey', event.target.value)} />
      <label>Bearer Token</label>
      <input
        value={env.bearerToken}
        onChange={(event) => update('bearerToken', event.target.value)}
      />
      <div className="env-mini">
        <span>Customer</span>
        <code>{env.customerId || '--'}</code>
        <span>Account</span>
        <code>{env.accountId || '--'}</code>
        <span>Resource</span>
        <code>{env.resourceId || '--'}</code>
      </div>
    </div>
  );
}
