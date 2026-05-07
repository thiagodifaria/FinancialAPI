import { ApiKeyId, TenantId } from '../../domain/shared/base-types.js';
import {
  ApiKey,
  CreatedApiKey,
  CreateApiKeyInput,
  IApiKeyRepository,
} from '../../modules/api-keys/api-key.entity.js';

export class ApiKeyUseCases {
  constructor(private apiKeyRepo: IApiKeyRepository) {}

  create(input: CreateApiKeyInput): Promise<CreatedApiKey> {
    return this.apiKeyRepo.create(input);
  }

  list(tenantId: TenantId): Promise<ApiKey[]> {
    return this.apiKeyRepo.list(tenantId);
  }

  revoke(tenantId: TenantId, id: ApiKeyId): Promise<ApiKey> {
    return this.apiKeyRepo.revoke(tenantId, id);
  }

  rotate(tenantId: TenantId, id: ApiKeyId): Promise<CreatedApiKey> {
    return this.apiKeyRepo.rotate(tenantId, id);
  }
}
