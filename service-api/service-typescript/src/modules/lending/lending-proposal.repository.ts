import { uuidv7 } from 'uuidv7';
import sql from '../../infrastructure/database/connection.js';
import { setTenantContext } from '../../infrastructure/database/tenant-context.js';
import { LendingProposalId, TenantId } from '../../domain/shared/base-types.js';
import { MoneyUtils } from '../../domain/shared/money.utils.js';
import { ILendingProposalRepository, LendingProposal } from './lending-proposal.entity.js';

type LendingProposalRow = {
  id: string;
  tenant_id: string;
  account_id: string;
  amount_minor: string;
  status: LendingProposal['status'];
  reason: string | null;
  maximum_limit_minor: string | null;
  transaction_id: string | null;
  metadata: Record<string, unknown>;
};

export class PostgresLendingProposalRepository implements ILendingProposalRepository {
  async create(input: LendingProposal): Promise<LendingProposal> {
    const id = input.id ?? uuidv7();
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, input.tenant_id);
      const [row] = await sqlTx<LendingProposalRow[]>`
        INSERT INTO lending_proposals (id, tenant_id, account_id, amount, status, metadata)
        VALUES (
          ${id},
          ${input.tenant_id},
          ${input.account_id},
          ${input.amount_minor.toString()},
          'PENDING',
          ${sqlTx.json(input.metadata as Parameters<typeof sql.json>[0])}
        )
        RETURNING id, tenant_id, account_id, amount::text AS amount_minor, status, reason,
                  maximum_limit::text AS maximum_limit_minor, transaction_id, metadata
      `;
      if (!row) throw new Error('Falha ao criar proposta de lending');
      await sqlTx`
        INSERT INTO events (id, tenant_id, type, resource_type, resource_id, payload)
        VALUES (
          ${uuidv7()},
          ${input.tenant_id},
          'proposal.created',
          'lending_proposal',
          ${id},
          ${sqlTx.json({ amount_minor: input.amount_minor.toString() })}
        )
      `;
      return this.toProposal(row);
    });
  }

  async approve(
    tenantId: TenantId,
    id: LendingProposalId,
    input: { transaction_id: string; maximum_limit_minor: bigint; reason: string }
  ): Promise<LendingProposal> {
    return await this.decide(tenantId, id, {
      status: 'APPROVED',
      reason: input.reason,
      maximum_limit_minor: input.maximum_limit_minor,
      transaction_id: input.transaction_id,
    });
  }

  async reject(
    tenantId: TenantId,
    id: LendingProposalId,
    input: { maximum_limit_minor: bigint; reason: string }
  ): Promise<LendingProposal> {
    return await this.decide(tenantId, id, {
      status: 'REJECTED',
      reason: input.reason,
      maximum_limit_minor: input.maximum_limit_minor,
    });
  }

  async list(tenantId: TenantId): Promise<LendingProposal[]> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const rows = await sqlTx<LendingProposalRow[]>`
        SELECT id, tenant_id, account_id, amount::text AS amount_minor, status, reason,
               maximum_limit::text AS maximum_limit_minor, transaction_id, metadata
        FROM lending_proposals
        ORDER BY created_at DESC
        LIMIT 100
      `;
      return rows.map((row) => this.toProposal(row));
    });
  }

  async findById(tenantId: TenantId, id: LendingProposalId): Promise<LendingProposal | null> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const [row] = await sqlTx<LendingProposalRow[]>`
        SELECT id, tenant_id, account_id, amount::text AS amount_minor, status, reason,
               maximum_limit::text AS maximum_limit_minor, transaction_id, metadata
        FROM lending_proposals
        WHERE id = ${id}
      `;
      return row ? this.toProposal(row) : null;
    });
  }

  private async decide(
    tenantId: TenantId,
    id: LendingProposalId,
    input: {
      status: 'APPROVED' | 'REJECTED';
      reason: string;
      maximum_limit_minor: bigint;
      transaction_id?: string;
    }
  ): Promise<LendingProposal> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const [row] = await sqlTx<LendingProposalRow[]>`
        UPDATE lending_proposals
        SET status = ${input.status},
            reason = ${input.reason},
            maximum_limit = ${input.maximum_limit_minor.toString()},
            transaction_id = ${input.transaction_id ?? null},
            decided_at = NOW()
        WHERE tenant_id = ${tenantId} AND id = ${id}
        RETURNING id, tenant_id, account_id, amount::text AS amount_minor, status, reason,
                  maximum_limit::text AS maximum_limit_minor, transaction_id, metadata
      `;
      if (!row) throw new Error('Proposta de lending não encontrada');
      await sqlTx`
        INSERT INTO events (id, tenant_id, type, resource_type, resource_id, payload)
        VALUES (
          ${uuidv7()},
          ${tenantId},
          ${input.status === 'APPROVED' ? 'proposal.approved' : 'proposal.rejected'},
          'lending_proposal',
          ${id},
          ${sqlTx.json({
            reason: input.reason,
            maximum_limit_minor: input.maximum_limit_minor.toString(),
            transaction_id: input.transaction_id,
          })}
        )
      `;
      return this.toProposal(row);
    });
  }

  private toProposal(row: LendingProposalRow): LendingProposal {
    return {
      id: row.id as LendingProposal['id'],
      tenant_id: row.tenant_id as LendingProposal['tenant_id'],
      account_id: row.account_id as LendingProposal['account_id'],
      amount_minor: MoneyUtils.fromMinorUnits(row.amount_minor),
      status: row.status,
      ...(row.reason ? { reason: row.reason } : {}),
      ...(row.maximum_limit_minor
        ? { maximum_limit_minor: MoneyUtils.fromMinorUnits(row.maximum_limit_minor) }
        : {}),
      ...(row.transaction_id ? { transaction_id: row.transaction_id } : {}),
      metadata: row.metadata ?? {},
    };
  }
}
