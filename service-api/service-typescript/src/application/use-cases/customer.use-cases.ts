import { CustomerId, TenantId } from '../../domain/shared/base-types.js';
import {
  Customer,
  ICustomerRepository,
  UpdateCustomerInput,
} from '../../modules/customers/customer.entity.js';

export class CustomerUseCases {
  constructor(private customerRepo: ICustomerRepository) {}

  create(customer: Customer): Promise<Customer> {
    return this.customerRepo.create(customer);
  }

  list(tenantId: TenantId): Promise<Customer[]> {
    return this.customerRepo.list(tenantId);
  }

  findById(tenantId: TenantId, id: CustomerId): Promise<Customer | null> {
    return this.customerRepo.findById(tenantId, id);
  }

  update(tenantId: TenantId, id: CustomerId, input: UpdateCustomerInput): Promise<Customer> {
    return this.customerRepo.update(tenantId, id, input);
  }

  verify(tenantId: TenantId, id: CustomerId): Promise<Customer> {
    return this.customerRepo.setStatus(tenantId, id, 'verified');
  }

  block(tenantId: TenantId, id: CustomerId): Promise<Customer> {
    return this.customerRepo.setStatus(tenantId, id, 'blocked');
  }

  archive(tenantId: TenantId, id: CustomerId): Promise<Customer> {
    return this.customerRepo.setStatus(tenantId, id, 'archived');
  }
}
