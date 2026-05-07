import { Context } from 'hono';
import { z } from 'zod';
import { UuidSchema, WebhookEndpointIdSchema } from '../../../domain/shared/base-types.js';
import { PostgresEventRepository } from '../../../modules/events/event.repository.js';
import { json } from '../http-response.js';
import { getTenantId } from '../request-context.js';

const WebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).default(['*']),
});

export class EventController {
  constructor(private eventRepo: PostgresEventRepository) {}

  async createWebhook(c: Context) {
    const input = WebhookSchema.parse(await c.req.json());
    return json(c, await this.eventRepo.createWebhook(getTenantId(c), input), 201);
  }

  async listWebhooks(c: Context) {
    return json(c, { data: await this.eventRepo.listWebhooks(getTenantId(c)) });
  }

  async rotateWebhookSecret(c: Context) {
    const id = WebhookEndpointIdSchema.parse(c.req.param('id'));
    return json(c, await this.eventRepo.rotateWebhookSecret(getTenantId(c), id), 201);
  }

  async listEvents(c: Context) {
    return json(c, { data: await this.eventRepo.listEvents(getTenantId(c)) });
  }

  async listDeliveries(c: Context) {
    return json(c, { data: await this.eventRepo.listDeliveries(getTenantId(c)) });
  }

  async retryDelivery(c: Context) {
    const id = UuidSchema.parse(c.req.param('id'));
    return json(c, await this.eventRepo.retryDelivery(getTenantId(c), id));
  }

  async createTestEvent(c: Context) {
    return json(c, await this.eventRepo.createTestEvent(getTenantId(c)), 201);
  }
}
