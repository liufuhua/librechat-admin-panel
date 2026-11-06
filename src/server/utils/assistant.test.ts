import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const headers = vi.hoisted(() => new Map<string, string>());
vi.mock('@tanstack/react-start/server', () => ({ getRequestHeader: (key: string) => headers.get(key) }));
import { assistantFetch, assistantUser } from './assistant';

describe('workspace identity adapter', () => {
  beforeEach(() => { headers.clear(); vi.stubEnv('API_SERVER_URL', 'http://assistant-runtime:8110'); vi.stubEnv('ASSISTANT_PUBLIC_ORIGIN', 'http://127.0.0.1:10112'); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it('rejects missing sessions without contacting any backend', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    expect((await assistantFetch('/api/me')).status).toBe(401); expect(fetch).not.toHaveBeenCalled();
  });
  it('forwards only workspace cookie and preserves desktop binding', async () => {
    headers.set('cookie', `other=secret; assistant_session=${'a'.repeat(43)}`);headers.set('x-desktop-token', 'desktop-fixture');
    const fetch = vi.fn().mockResolvedValue(Response.json({ user: { id: 'stable-id', name: '管理员', role: 'ADMIN' } }));vi.stubGlobal('fetch', fetch);
    expect(await assistantUser()).toEqual({ valid: true, user: { id: 'stable-id', name: '管理员', email: '', role: 'ADMIN' } });
    const sent = fetch.mock.calls[0][1].headers as Headers;
    expect(sent.get('Cookie')).toBe(`assistant_session=${'a'.repeat(43)}`);expect(sent.get('X-Desktop-Token')).toBe('desktop-fixture');
  });
  it('fails closed for revoked identity, backend failure, and non-admin', async () => {
    headers.set('cookie', `assistant_session=${'a'.repeat(43)}`);
    const fetch=vi.fn().mockResolvedValueOnce(Response.json({ user:{ id:'u',role:'ANALYSIS' } })).mockResolvedValueOnce(new Response(null,{status:401})).mockRejectedValueOnce(new Error('offline'));vi.stubGlobal('fetch',fetch);
    for(let i=0;i<3;i++)expect(await assistantUser()).toEqual({valid:false});
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it('requires a trusted browser origin for mutations', async () => {
    headers.set('cookie', `assistant_session=${'a'.repeat(43)}`);headers.set('origin','http://wrong.test');
    const fetch=vi.fn().mockResolvedValue(Response.json({ok:true}));vi.stubGlobal('fetch',fetch);
    expect((await assistantFetch('/api/logout',{method:'POST'})).status).toBe(403);expect(fetch).not.toHaveBeenCalled();
    headers.set('origin','http://127.0.0.1:3110');expect((await assistantFetch('/api/logout',{method:'POST'})).status).toBe(200);
  });
});
