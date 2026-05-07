import { z } from 'zod';
import { TenantId, UserId, UserRoleSchema } from '../../domain/shared/base-types.js';

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .refine((value) => /[A-Za-z]/.test(value) && /[-_!@#$%^&*0-9]/.test(value), {
      message: 'Senha deve combinar letras e números/símbolos',
    }),
  totp_code: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export type AuthUser = {
  id: UserId;
  tenant_id: TenantId;
  email: string;
  name: string;
  role: z.infer<typeof UserRoleSchema>;
  two_factor_enabled?: boolean;
};

export type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  user: AuthUser;
};

export interface IAuthRepository {
  verifyPassword(tenantId: TenantId, email: string, password: string): Promise<AuthUser | null>;
  isLoginLocked(tenantId: TenantId, email: string): Promise<boolean>;
  registerLoginFailure(tenantId: TenantId, email: string): Promise<void>;
  clearLoginFailures(tenantId: TenantId, email: string): Promise<void>;
  createSession(tenantId: TenantId, user: AuthUser): Promise<AuthSession>;
  findUserByAccessToken(token: string): Promise<AuthUser | null>;
  refreshSession(refreshToken: string): Promise<AuthSession | null>;
  revokeAccessToken(token: string): Promise<void>;
}
