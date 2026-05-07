import { describe, expect, it } from 'vitest';
import { openApiDocument } from './openapi.js';

describe('OpenAPI contract', () => {
  it('exposes versioned API metadata and critical fintech modules', () => {
    expect(openApiDocument.openapi).toBe('3.1.0');
    expect(openApiDocument.info.version).toBe('1.0.0');
    expect(openApiDocument.paths['/accounts/{id}/balance']).toBeDefined();
    expect(openApiDocument.paths['/reconciliation-runs']).toBeDefined();
    expect(openApiDocument.paths['/webhook-deliveries']).toBeDefined();
    expect(openApiDocument.paths['/customers/{id}/anonymize']).toBeDefined();
  });
});
