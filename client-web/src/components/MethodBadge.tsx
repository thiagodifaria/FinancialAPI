import type { HttpMethod } from '../types/api';

const classes: Record<HttpMethod, string> = {
  GET: 'method method-get',
  POST: 'method method-post',
  PATCH: 'method method-patch',
  PUT: 'method method-put',
  DELETE: 'method method-delete',
};

export function MethodBadge({ method }: { method: HttpMethod }) {
  return <span className={classes[method]}>{method}</span>;
}
