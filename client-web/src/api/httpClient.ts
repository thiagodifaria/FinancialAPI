import type { ApiResponseLog, RuntimeEnvironment } from '../types/api';

export type RequestOptions = {
  env: RuntimeEnvironment;
  method: string;
  path: string;
  body?: unknown;
  idempotencyKey?: string;
};

export async function requestApi(options: RequestOptions): Promise<ApiResponseLog> {
  const started = performance.now();
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };

  if (options.env.apiKey) headers['x-api-key'] = options.env.apiKey;
  if (options.env.bearerToken) headers.authorization = `Bearer ${options.env.bearerToken}`;
  if (options.idempotencyKey) headers['x-idempotency-key'] = options.idempotencyKey;

  const response = await fetch(`${options.env.apiBaseUrl}${options.path}`, {
    method: options.method,
    headers,
    body:
      options.method === 'GET' || options.method === 'DELETE'
        ? undefined
        : JSON.stringify(options.body ?? {}),
  });

  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  const text = await response.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  return {
    status: response.status,
    durationMs: Math.round(performance.now() - started),
    headers: responseHeaders,
    body,
  };
}
