import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHostedWorker } from '../Hosting/worker.js';
import { createSupabaseStore } from '../Hosting/supabase-store.js';
import { createChatServer } from '../Server/app.js';
const env = { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_TEST_ONLY' };
const token = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'.repeat(2);
const req = (path, method = 'GET', body) => new Request(`https://warmly.test${path}`, {
  method, headers: { Origin: 'https://warmly.test', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
test('Supabase RPC receives server credentials and hashes; client cannot supply identity', async () => {
  const calls = [];
  const worker = createHostedWorker({}, async (url, options) => {
    calls.push({ url: String(url), options, payload: JSON.parse(options.body) });
    return Response.json({ message: { id: 'message', sender: { id: 'server', name: 'Alice' }, text: 'Hello' } });
  });
  const response = await worker.fetch(req('/api/chat/messages', 'POST', { text: ' Hello ', clientMessageId: 'test', sender: 'Mallory' }), env);
  assert.equal(response.status, 201);
  assert.equal(calls[0].url, 'https://project.supabase.co/rest/v1/rpc/warmly_chat');
  assert.equal(calls[0].options.headers.apikey, env.SUPABASE_SECRET_KEY);
  assert.equal(calls[0].options.headers.Authorization, undefined);
  assert.deepEqual(calls[0].payload.p_payload, { text: 'Hello', clientMessageId: 'test' });
  assert.match(calls[0].payload.p_token_hash, /^[0-9a-f]{64}$/);
  assert.notEqual(calls[0].payload.p_token_hash, token);
  assert.equal(JSON.stringify(await response.json()).includes(env.SUPABASE_SECRET_KEY), false);
});
test('missing Supabase configuration cannot fall back to D1 or memory', async () => {
  let called = false;
  const worker = createHostedWorker({}, async () => { called = true; throw new Error('Unexpected request'); });
  const response = await worker.fetch(req('/api/health'), { DB: { prepare() { throw new Error('D1 must never be used'); } } });
  assert.equal(response.status, 503); assert.equal(called, false);
});
test('Supabase failures are sanitized and application rate limits are preserved', async () => {
  const store = createSupabaseStore(env, async () => new Response('private upstream credentials', { status: 500 }));
  await assert.rejects(store.call('health'), error => error.status === 503 && !error.message.includes('credentials'));
  const limited = createHostedWorker({}, async () => Response.json({ error: 'Slow down a little. Try again in a second.', status: 429 }));
  assert.equal((await limited.fetch(req('/api/chat/messages', 'POST', { text: 'Hello', clientMessageId: 'one' }), env)).status, 429);
});
test('invalid or cross-origin writes never reach Supabase', async () => {
  let calls = 0;
  const worker = createHostedWorker({}, async () => { calls++; return Response.json({}); });
  assert.equal((await worker.fetch(req('/api/chat/messages', 'POST', { text: ' ', clientMessageId: 'one' }), env)).status, 400);
  const cross = req('/api/chat/messages', 'POST', { text: 'Hello', clientMessageId: 'one' }); cross.headers.set('origin', 'https://other.test');
  assert.equal((await worker.fetch(cross, env)).status, 403);
  assert.equal(calls, 0);
});
test('local HTTP server uses the same Supabase API as hosting', async t => {
  const calls = [];
  const { http } = createChatServer({ env, requestStorage: async (_url, options) => { calls.push(JSON.parse(options.body)); return Response.json({ ok: true, storage: 'supabase' }); } });
  http.listen(0, '127.0.0.1'); await once(http, 'listening');
  t.after(() => new Promise(resolve => http.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${http.address().port}/api/health`);
  assert.deepEqual(await response.json(), { ok: true, storage: 'supabase' });
  assert.equal(calls[0].p_action, 'health');
});
