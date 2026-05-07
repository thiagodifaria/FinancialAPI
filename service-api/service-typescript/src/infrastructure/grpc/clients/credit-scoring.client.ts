import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ICreditScoringService } from '../../../application/sagas/lending-proposal.saga.js';
import { Money } from '../../../domain/shared/base-types.js';
import { incrementDomainMetric } from '../../observability/metrics.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROTO_PATH = resolveProtoPath();

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

function resolveProtoPath(): string {
  const candidates = [
    process.env.FINANCIAL_API_PROTO_PATH,
    path.resolve(process.cwd(), 'proto/financial.proto'),
    path.resolve(process.cwd(), '../data/proto/financial.proto'),
    path.resolve(__dirname, '../../../../../data/proto/financial.proto'),
  ].filter((candidate): candidate is string => Boolean(candidate));

  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error('financial.proto não encontrado');
  return found;
}

type RiskAnalysisRequest = {
  metadata: {
    request_id: string;
    tenant_id: string;
    idempotency_key: string;
    caller_service: string;
  };
  tenant_id: string;
  account_id: string;
  requested_amount: string;
};

type RiskAnalysisResponse = {
  approved: boolean;
  maximum_limit: string | number;
  reason: string;
};

type CreditScoringClient = grpc.Client & {
  AnalyzeRisk(
    request: RiskAnalysisRequest,
    metadata: grpc.Metadata,
    options: grpc.CallOptions,
    callback: (error: grpc.ServiceError | null, response: RiskAnalysisResponse) => void
  ): void;
};

type FinancialProto = {
  CreditScoring: new (address: string, credentials: grpc.ChannelCredentials) => CreditScoringClient;
};

const loadedDefinition = grpc.loadPackageDefinition(packageDefinition) as unknown as {
  financial_api: { scoring: { v1: FinancialProto } };
};
const financialProto = loadedDefinition.financial_api.scoring.v1;

/**
 * Cliente gRPC para o motor de scoring em Python.
 */
export class GrpcCreditScoringService implements ICreditScoringService {
  private client: CreditScoringClient;
  private timeoutMs: number;
  private maxRetries: number;
  private failurePolicy: 'closed' | 'sandbox_controlled';

  constructor() {
    const host = process.env.SCORING_ENGINE_HOST || 'localhost';
    const port = process.env.SCORING_ENGINE_PORT || '50052';
    this.timeoutMs = Number(process.env.SCORING_ENGINE_TIMEOUT_MS ?? '2500');
    this.maxRetries = Number(process.env.SCORING_ENGINE_RETRIES ?? '1');
    this.failurePolicy =
      process.env.SCORING_FAILURE_POLICY === 'sandbox_controlled' ? 'sandbox_controlled' : 'closed';
    this.client = new financialProto.CreditScoring(`${host}:${port}`, this.credentials());
  }

  async analyze(data: {
    tenant_id: string;
    account_id: string;
    requested_amount: Money;
  }): Promise<{ approved: boolean; maximum_limit: Money; reason: string }> {
    try {
      return await this.callAnalyze(data);
    } catch (error) {
      if (this.failurePolicy === 'sandbox_controlled') {
        return {
          approved: false,
          maximum_limit: 0n,
          reason: `Scoring indisponível; falha controlada em sandbox: ${(error as Error).message}`,
        };
      }
      incrementDomainMetric('scoring', 'failed_closed');
      throw error;
    }
  }

  private async callAnalyze(data: {
    tenant_id: string;
    account_id: string;
    requested_amount: Money;
  }): Promise<{ approved: boolean; maximum_limit: Money; reason: string }> {
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= this.maxRetries) {
      try {
        return await this.singleAnalyze(data);
      } catch (error) {
        lastError = error as Error;
        if (!this.isTransient(error) || attempt === this.maxRetries) break;
        incrementDomainMetric('scoring', 'transient_retry');
        attempt += 1;
      }
    }

    throw lastError ?? new Error('Motor de scoring indisponível');
  }

  private async singleAnalyze(data: {
    tenant_id: string;
    account_id: string;
    requested_amount: Money;
  }): Promise<{ approved: boolean; maximum_limit: Money; reason: string }> {
    return new Promise((resolve, reject) => {
      const metadata = new grpc.Metadata();
      const requestId = `scoring-${Date.now()}`;
      const scoringIdempotencyKey = `scoring-${data.account_id}-${data.requested_amount}`;
      metadata.set('x-tenant-id', data.tenant_id);
      metadata.set('x-request-id', requestId);
      metadata.set('x-idempotency-key', scoringIdempotencyKey);
      metadata.set('x-caller-service', 'financial-api');
      const deadline = new Date(Date.now() + this.timeoutMs);

      this.client.AnalyzeRisk(
        {
          metadata: {
            request_id: requestId,
            tenant_id: data.tenant_id,
            idempotency_key: scoringIdempotencyKey,
            caller_service: 'financial-api',
          },
          tenant_id: data.tenant_id,
          account_id: data.account_id,
          requested_amount: data.requested_amount.toString(),
        },
        metadata,
        { deadline },
        (err, response) => {
          if (err) {
            err.message = `Motor de scoring indisponível ou recusou a decisão: ${err.message}`;
            return reject(err);
          }
          incrementDomainMetric('scoring', response.approved ? 'approved' : 'rejected');
          resolve({
            approved: response.approved,
            maximum_limit: BigInt(response.maximum_limit),
            reason: response.reason,
          });
        }
      );
    });
  }

  private isTransient(error: unknown): boolean {
    const serviceError = error as Partial<grpc.ServiceError>;
    return (
      serviceError.code === grpc.status.UNAVAILABLE ||
      serviceError.code === grpc.status.DEADLINE_EXCEEDED ||
      serviceError.code === grpc.status.RESOURCE_EXHAUSTED
    );
  }

  private credentials(): grpc.ChannelCredentials {
    if (process.env.SCORING_TLS_ENABLED !== 'true') return grpc.credentials.createInsecure();
    const rootCert = process.env.SCORING_CA_CERT_PATH
      ? fs.readFileSync(process.env.SCORING_CA_CERT_PATH)
      : undefined;
    return grpc.credentials.createSsl(rootCert);
  }
}
