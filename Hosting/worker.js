import { createSupabaseStore } from './supabase-store.js';
const MAX_BODY = 8192;
const json = (value, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const fail = (message, status) => { throw Object.assign(new Error(message), { status }); };
const hash = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(byte => byte.toString(16).padStart(2, '0')).join('');
async function readBody(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) fail('Please send JSON.', 415);
  if (!request.body) fail('A request body is required.', 400);
  const reader = request.body.getReader(); const chunks = []; let size = 0;
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.length;
    if (size > MAX_BODY) { await reader.cancel(); fail('Request is too large.', 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { fail('Please send valid JSON.', 400); }
}
export function createHostedWorker(assets = {}, requestStorage = fetch) {
  return {
    async fetch(request, env) {
      try {
        const url = new URL(request.url);
        if (!url.pathname.startsWith('/api/')) {
          if (!['GET', 'HEAD'].includes(request.method)) return json({ error: 'Method not allowed.' }, 405);
          const asset = assets[url.pathname === '/' ? '/index.html' : url.pathname];
          if (!asset) return new Response('Not found', { status: 404 });
          return new Response(request.method === 'HEAD' ? null : Uint8Array.from(atob(asset.body), char => char.charCodeAt(0)), { headers: { 'Content-Type': asset.type, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Cache-Control': url.pathname === '/' || url.pathname === '/index.html' ? 'no-cache' : 'public, max-age=3600' } });
        }
        const store = createSupabaseStore(env, requestStorage);
        if (url.pathname === '/api/health' && request.method === 'GET') return json(await store.call('health'));
        if (!['GET', 'HEAD'].includes(request.method)) {
          const origin = request.headers.get('origin');
          if (origin && origin !== url.origin) fail('This request is not allowed.', 403);
        }
        if (url.pathname === '/api/chat/session' && request.method === 'POST') {
          const body = await readBody(request);
          const name = typeof body?.name === 'string' ? body.name.trim() : '';
          if (!name || name.length > 32) fail('Your name must be between 1 and 32 characters.', 400);
          const token = crypto.randomUUID() + crypto.randomUUID();
          const result = await store.call('join', { name }, await hash(token), await hash(request.headers.get('cf-connecting-ip') || 'local-preview'));
          return json({ ...result, token }, 201);
        }
        const token = request.headers.get('authorization')?.match(/^Bearer ([\w-]{36,80})$/)?.[1];
        if (!token) fail('Please join the chat first.', 401);
        const tokenHash = await hash(token);
        if (url.pathname === '/api/chat/session' && request.method === 'DELETE') return json(await store.call('leave', {}, tokenHash));
        if (url.pathname === '/api/chat/state' && request.method === 'GET') return json(await store.call('state', {}, tokenHash));
        if (url.pathname === '/api/chat/messages' && request.method === 'POST') {
          const body = await readBody(request);
          const text = typeof body?.text === 'string' ? body.text.trim() : '';
          const key = body?.clientMessageId;
          if (!text || text.length > 2000) fail('Messages must be between 1 and 2000 characters.', 400);
          if (typeof key !== 'string' || !/^[\w-]{1,64}$/.test(key)) fail('Invalid message identifier.', 400);
          return json(await store.call('send', { text, clientMessageId: key }, tokenHash), 201);
        }
        return json({ error: 'Not found.' }, 404);
      } catch (error) {
        if (!error.status) console.error('Warmly request failed.');
        return json({ error: error.status ? error.message : 'Chat is temporarily unavailable. Please try again.' }, error.status || 503);
      }
    },
  };
}
export default createHostedWorker();
