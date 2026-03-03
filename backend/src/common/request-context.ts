import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'crypto';

export interface RequestContext {
  requestId: string;
  ipAddress: string | null;
  userAgent: string | null;
}

const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext(
  context: Partial<RequestContext>,
  callback: () => void,
) {
  const value: RequestContext = {
    requestId: context.requestId || randomUUID(),
    ipAddress: context.ipAddress || null,
    userAgent: context.userAgent || null,
  };
  requestContextStorage.run(value, callback);
}

export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}
