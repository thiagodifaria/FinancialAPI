import { createHash, randomBytes } from 'node:crypto';
import { uuidv7 } from 'uuidv7';
import sql from '../../infrastructure/database/connection.js';
import { setTenantContext } from '../../infrastructure/database/tenant-context.js';
import { AuthSession, AuthUser, IAuthRepository } from './auth.entity.js';
import { TenantId, UserId, UserRole } from '../../domain/shared/base-types.js';

type UserRow = {
  id: string;
  tenant_id: string;
  email: string;
  name: string;
  role: UserRole;
  two_factor_enabled: boolean;
};

type SessionUserRow = UserRow & {
  session_id: string;
};

export class PostgresAuthRepository implements IAuthRepository {
  async verifyPassword(
    tenantId: TenantId,
    email: string,
    password: string
  ): Promise<AuthUser | null> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const [user] = await sqlTx<UserRow[]>`
        SELECT id, tenant_id, email, name, role, two_factor_enabled
        FROM users
        WHERE tenant_id = ${tenantId}
          AND lower(email) = lower(${email})
          AND password_hash = crypt(${password}, password_hash)
          AND status = 'active'
        LIMIT 1
      `;
      return user ? this.toUser(user) : null;
    });
  }

  async createSession(tenantId: TenantId, user: AuthUser): Promise<AuthSession> {
    const accessToken = this.generateToken(tenantId);
    const refreshToken = this.generateToken(tenantId);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60);

    await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      await sqlTx`
        INSERT INTO sessions (id, tenant_id, user_id, token_hash, refresh_token_hash, expires_at)
        VALUES (
          ${uuidv7()},
          ${tenantId},
          ${user.id},
          ${this.hashToken(accessToken)},
          ${this.hashToken(refreshToken)},
          ${expiresAt.toISOString()}
        )
      `;
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt.toISOString(),
      user,
    };
  }

  async isLoginLocked(tenantId: TenantId, email: string): Promise<boolean> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const [row] = await sqlTx<{ locked: boolean }[]>`
        SELECT locked_until IS NOT NULL AND locked_until > NOW() AS locked
        FROM login_attempts
        WHERE tenant_id = ${tenantId} AND lower(email) = lower(${email})
      `;
      return row?.locked ?? false;
    });
  }

  async registerLoginFailure(tenantId: TenantId, email: string): Promise<void> {
    await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      await sqlTx`
        INSERT INTO login_attempts (tenant_id, email, failed_count, locked_until, updated_at)
        VALUES (${tenantId}, lower(${email}), 1, NULL, NOW())
        ON CONFLICT (tenant_id, email)
        DO UPDATE SET
          failed_count = login_attempts.failed_count + 1,
          locked_until = CASE
            WHEN login_attempts.failed_count + 1 >= 5 THEN NOW() + INTERVAL '15 minutes'
            ELSE login_attempts.locked_until
          END,
          updated_at = NOW()
      `;
    });
  }

  async clearLoginFailures(tenantId: TenantId, email: string): Promise<void> {
    await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      await sqlTx`
        DELETE FROM login_attempts
        WHERE tenant_id = ${tenantId} AND lower(email) = lower(${email})
      `;
    });
  }

  async findUserByAccessToken(token: string): Promise<AuthUser | null> {
    const tenantId = this.extractTenantId(token);
    if (!tenantId) return null;

    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const [row] = await sqlTx<SessionUserRow[]>`
        SELECT u.id, u.tenant_id, u.email, u.name, u.role, s.id AS session_id
        FROM sessions s
        JOIN users u ON u.id = s.user_id AND u.tenant_id = s.tenant_id
        WHERE s.token_hash = ${this.hashToken(token)}
          AND s.revoked_at IS NULL
          AND s.expires_at > NOW()
          AND u.status = 'active'
        LIMIT 1
      `;
      return row ? this.toUser(row) : null;
    });
  }

  async refreshSession(refreshToken: string): Promise<AuthSession | null> {
    const tenantId = this.extractTenantId(refreshToken);
    if (!tenantId) return null;

    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const [row] = await sqlTx<SessionUserRow[]>`
        SELECT u.id, u.tenant_id, u.email, u.name, u.role, s.id AS session_id
        FROM sessions s
        JOIN users u ON u.id = s.user_id AND u.tenant_id = s.tenant_id
        WHERE s.refresh_token_hash = ${this.hashToken(refreshToken)}
          AND s.revoked_at IS NULL
          AND s.expires_at > NOW()
          AND u.status = 'active'
        LIMIT 1
      `;
      if (!row) return null;

      await sqlTx`UPDATE sessions SET revoked_at = NOW() WHERE id = ${row.session_id}`;
      return await this.createSession(row.tenant_id as TenantId, this.toUser(row));
    });
  }

  async revokeAccessToken(token: string): Promise<void> {
    const tenantId = this.extractTenantId(token);
    if (!tenantId) return;

    await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      await sqlTx`
        UPDATE sessions
        SET revoked_at = NOW()
        WHERE token_hash = ${this.hashToken(token)} AND revoked_at IS NULL
      `;
    });
  }

  private toUser(row: UserRow): AuthUser {
    return {
      id: row.id as UserId,
      tenant_id: row.tenant_id as TenantId,
      email: row.email,
      name: row.name,
      role: row.role,
      two_factor_enabled: row.two_factor_enabled,
    };
  }

  private generateToken(tenantId: TenantId): string {
    return `${tenantId}.${randomBytes(32).toString('base64url')}`;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private extractTenantId(token: string): TenantId | null {
    const [tenantId] = token.split('.');
    if (!tenantId || !/^[0-9a-fA-F-]{36}$/.test(tenantId)) return null;
    return tenantId as TenantId;
  }
}
