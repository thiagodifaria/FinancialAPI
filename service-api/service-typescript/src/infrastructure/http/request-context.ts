import { Context } from 'hono';
import { AccountId, TenantId } from '../../domain/shared/base-types.js';
import { AuthUser } from '../../modules/auth/auth.entity.js';

export type AppBindings = {
  Variables: {
    tenantId: TenantId;
    requestId: string;
    user: AuthUser;
    apiKeyScopes: string[];
  };
};

export function getTenantId(c: Context): TenantId {
  return c.get('tenantId' as never) as TenantId;
}

export function getRequestId(c: Context): string {
  return (c.get('requestId' as never) as string | undefined) ?? 'unknown';
}

export function getUser(c: Context): AuthUser {
  return c.get('user' as never) as AuthUser;
}

export function getApiKeyScopes(c: Context): string[] {
  return (c.get('apiKeyScopes' as never) as string[] | undefined) ?? [];
}

export function asAccountId(value: string): AccountId {
  return value as AccountId;
}
