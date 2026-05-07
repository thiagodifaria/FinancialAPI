import { z } from 'zod';
import {
  ApiKeyIdSchema,
  ApiKeyStatusSchema,
  TenantId,
  TenantIdSchema,
} from '../../domain/shared/base-types.js';

export const CreateApiKeySchema = z.object({
  tenant_id: TenantIdSchema,
  name: z.string().min(1),
  scopes: z.array(z.string().min(1)).default(['*']),
  ip_allowlist: z.array(z.string().min(1)).default([]),
});

export type CreateApiKeyInput = z.infer<typeof CreateApiKeySchema>;

export type ApiKey = {
  id: z.infer<typeof ApiKeyIdSchema>;
  tenant_id: TenantId;
  name: string;
  key_prefix: string;
  scopes: string[];
  ip_allowlist: string[];
  status: z.infer<typeof ApiKeyStatusSchema>;
  last_used_at?: string;
  created_at: string;
  revoked_at?: string;
};

export type CreatedApiKey = ApiKey & {
  key: string;
};

export interface IApiKeyRepository {
  create(input: CreateApiKeyInput): Promise<CreatedApiKey>;
  list(tenantId: TenantId): Promise<ApiKey[]>;
  revoke(tenantId: TenantId, id: ApiKey['id']): Promise<ApiKey>;
  rotate(tenantId: TenantId, id: ApiKey['id']): Promise<CreatedApiKey>;
}
