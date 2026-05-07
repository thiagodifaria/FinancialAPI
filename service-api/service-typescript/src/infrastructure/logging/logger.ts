import pino from 'pino';

/**
 * Logger estruturado do core financeiro.
 * Mantemos campos estáveis para facilitar auditoria, tracing e troubleshooting.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'password',
      'token',
      'access_token',
      'refresh_token',
      'authorization',
      'x-api-key',
      'document',
      'email',
      'phone',
      'secret',
      'signing_secret',
      'token',
      '*.password',
      '*.token',
      '*.access_token',
      '*.refresh_token',
      '*.authorization',
      '*.x-api-key',
      '*.document',
      '*.email',
      '*.phone',
      '*.secret',
      '*.signing_secret',
    ],
    censor: '[REDACTED]',
  },
  base: {
    service: 'financial-api',
  },
});
