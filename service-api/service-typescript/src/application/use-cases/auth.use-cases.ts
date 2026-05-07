import { DomainError, TenantId } from '../../domain/shared/base-types.js';
import { AuthSession, IAuthRepository, LoginInput } from '../../modules/auth/auth.entity.js';

export class LoginUseCase {
  constructor(private authRepo: IAuthRepository) {}

  async execute(tenantId: TenantId, input: LoginInput): Promise<AuthSession> {
    if (await this.authRepo.isLoginLocked(tenantId, input.email)) {
      throw new DomainError('Login temporariamente bloqueado', 'LOGIN_LOCKED', 423);
    }

    const user = await this.authRepo.verifyPassword(tenantId, input.email, input.password);
    if (!user) {
      await this.authRepo.registerLoginFailure(tenantId, input.email);
      throw new DomainError('Credenciais inválidas', 'INVALID_CREDENTIALS', 401);
    }

    if (user.two_factor_enabled && !input.totp_code) {
      throw new DomainError('Código 2FA obrigatório', 'TOTP_REQUIRED', 401);
    }

    await this.authRepo.clearLoginFailures(tenantId, input.email);
    return await this.authRepo.createSession(tenantId, user);
  }
}

export class RefreshSessionUseCase {
  constructor(private authRepo: IAuthRepository) {}

  async execute(refreshToken: string): Promise<AuthSession> {
    const session = await this.authRepo.refreshSession(refreshToken);
    if (!session) throw new DomainError('Refresh token inválido', 'INVALID_REFRESH_TOKEN', 401);
    return session;
  }
}

export class LogoutUseCase {
  constructor(private authRepo: IAuthRepository) {}

  async execute(accessToken: string): Promise<void> {
    await this.authRepo.revokeAccessToken(accessToken);
  }
}
