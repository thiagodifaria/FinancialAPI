import type { LucideIcon } from 'lucide-react';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export type FieldSpec = {
  name: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'select' | 'textarea';
  defaultValue?: string;
  options?: string[];
  placeholder?: string;
};

export type EndpointSpec = {
  id: string;
  method: HttpMethod;
  path: string;
  title: string;
  description: string;
  details?: string[];
  requestNotes?: string[];
  responseNotes?: string[];
  simpleFields?: FieldSpec[];
  bodyTemplate?: Record<string, unknown>;
  idempotent?: boolean;
  captures?: 'accessToken' | 'customerId' | 'accountId' | 'resourceId' | 'productId';
};

export type EndpointCategory = {
  category: string;
  icon: LucideIcon;
  endpoints: EndpointSpec[];
};

export type RuntimeEnvironment = {
  apiBaseUrl: string;
  apiKey: string;
  bearerToken: string;
  customerId: string;
  accountId: string;
  resourceId: string;
  productId: string;
};

export type ApiResponseLog = {
  status: number;
  durationMs: number;
  headers: Record<string, string>;
  body: unknown;
};

export type ApiErrorBody = {
  error?: string;
  code?: string;
  request_id?: string;
};
