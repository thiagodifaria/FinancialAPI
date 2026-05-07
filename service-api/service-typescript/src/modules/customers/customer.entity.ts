import { z } from 'zod';
import {
  CustomerId,
  CustomerIdSchema,
  LifecycleStatusSchema,
  TenantId,
  TenantIdSchema,
} from '../../domain/shared/base-types.js';

export const CustomerSchema = z.object({
  id: CustomerIdSchema.optional(),
  tenant_id: TenantIdSchema,
  type: z.enum(['individual', 'business']),
  name: z.string().min(1),
  document: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  status: LifecycleStatusSchema.default('pending'),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const UpdateCustomerSchema = CustomerSchema.partial().omit({ id: true, tenant_id: true });

export type Customer = z.infer<typeof CustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerSchema>;

export interface ICustomerRepository {
  create(customer: Customer): Promise<Customer>;
  list(tenantId: TenantId): Promise<Customer[]>;
  findById(tenantId: TenantId, id: CustomerId): Promise<Customer | null>;
  update(tenantId: TenantId, id: CustomerId, input: UpdateCustomerInput): Promise<Customer>;
  setStatus(tenantId: TenantId, id: CustomerId, status: Customer['status']): Promise<Customer>;
}
