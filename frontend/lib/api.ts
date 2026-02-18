import { auth } from '@clerk/nextjs/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

/**
 * Server-side API fetch helper.
 * Use in Server Components, Route Handlers, and Server Actions.
 * Automatically attaches the Clerk JWT token.
 */
export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const { getToken } = await auth();
  const token = await getToken();

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new ApiError(res.status, errorBody.message || res.statusText, errorBody);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

/**
 * Client-side API fetch helper.
 * Use in Client Components with useAuth() token.
 */
export async function clientApiFetch<T = any>(
  path: string,
  token: string | null,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new ApiError(res.status, errorBody.message || res.statusText, errorBody);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: any,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
