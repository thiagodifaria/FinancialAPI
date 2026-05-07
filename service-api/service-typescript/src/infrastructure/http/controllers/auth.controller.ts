import { Context } from 'hono';
import { z } from 'zod';
import {
  LoginUseCase,
  LogoutUseCase,
  RefreshSessionUseCase,
} from '../../../application/use-cases/auth.use-cases.js';
import { LoginSchema } from '../../../modules/auth/auth.entity.js';
import { getTenantId, getUser } from '../request-context.js';
import { json } from '../http-response.js';

const RefreshSchema = z.object({
  refresh_token: z.string().min(16),
});

export class AuthController {
  constructor(
    private loginUseCase: LoginUseCase,
    private refreshUseCase: RefreshSessionUseCase,
    private logoutUseCase: LogoutUseCase
  ) {}

  async login(c: Context) {
    const tenantId = getTenantId(c);
    const body = LoginSchema.parse(await c.req.json());
    const session = await this.loginUseCase.execute(tenantId, body);
    return json(c, session, 201);
  }

  async refresh(c: Context) {
    const body = RefreshSchema.parse(await c.req.json());
    const session = await this.refreshUseCase.execute(body.refresh_token);
    return json(c, session);
  }

  async logout(c: Context) {
    const token = this.getBearerToken(c);
    await this.logoutUseCase.execute(token);
    return json(c, { status: 'logged_out' });
  }

  async me(c: Context) {
    return json(c, { user: getUser(c) });
  }

  private getBearerToken(c: Context): string {
    const authorization = c.req.header('authorization') ?? '';
    return authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  }
}
