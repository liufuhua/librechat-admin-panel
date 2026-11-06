import { createServerOnlyFn } from '@tanstack/react-start';
import { getRequestHeader } from '@tanstack/react-start/server';
import type { SerializableUser } from '@/types';

export const assistantMode = createServerOnlyFn(() => process.env.ASSISTANT_MODE === 'true');

/** Forward only the existing HttpOnly workspace session; never cache role decisions. */
export const assistantFetch = createServerOnlyFn(async (path: string, init: RequestInit = {}): Promise<Response> => {
  const root = process.env.API_SERVER_URL;
  if (!root || !path.startsWith('/api/') || path.includes('..')) {
    throw new Error('Assistant backend configuration is unavailable');
  }
  const cookie = getRequestHeader('cookie') ?? '';
  const session = cookie.split(';').map((item) => item.trim()).find((item) => /^assistant_session=[A-Za-z0-9_-]{40,100}$/.test(item));
  if (!session) return new Response(null, { status: 401 });
  const origin = getRequestHeader('origin');
  const allowedOrigins = new Set(['http://127.0.0.1:3110', process.env.ASSISTANT_PUBLIC_ORIGIN]);
  const method = (init.method ?? 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD' && (!origin || !allowedOrigins.has(origin))) {
    return new Response(null, { status: 403 });
  }
  const headers = new Headers(init.headers);
  headers.set('Cookie', session);
  headers.set('Content-Type', 'application/json');
  headers.set('X-Requested-With', 'nuclear-desktop');
  if (origin) headers.set('Origin', origin);
  const desktop = getRequestHeader('x-desktop-token');
  if (desktop) headers.set('X-Desktop-Token', desktop);
  return fetch(new URL(path, root), { ...init, headers, redirect: 'manual', signal: AbortSignal.timeout(30_000) });
});

export const assistantUser = createServerOnlyFn(async (): Promise<{ valid: boolean; user?: SerializableUser }> => {
  try {
    const response = await assistantFetch('/api/me');
    if (!response.ok) return { valid: false };
    const body = await response.json() as { user?: { id?: string; name?: string; role?: string } };
    if (!body.user?.id || body.user.role !== 'ADMIN') return { valid: false };
    return { valid: true, user: { id: body.user.id, name: body.user.name ?? '', email: '', role: 'ADMIN' } };
  } catch {
    return { valid: false };
  }
});
