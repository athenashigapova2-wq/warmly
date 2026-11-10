import test from 'node:test';
import assert from 'node:assert/strict';
import { createHostedWorker } from '../Hosting/worker.js';
import { createLocalD1 } from './d1-adapter.js';
function setup(t) {
  const DB = createLocalD1(); t.after(() => DB.close());
  const worker = createHostedWorker();
  async function call(path, method = 'GET', body, token, origin = 'https://warmly.example') {
    const response = await worker.fetch(new Request(`https://warmly.example/api/chat/${path}`, {
      method, headers: { 'Content-Type': 'application/json', Origin: origin, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }), { DB });
    return { status: response.status, body: await response.json() };
  }
  return { DB, call, worker };
}
test('hosted room shares persisted messages and trusts only server-issued identity', async t => {
  const { call, DB } = setup(t);
  const alice = (await call('session', 'POST', { name: 'Alice' })).body;
  const bob = (await call('session', 'POST', { name: 'Bob' })).body;
  assert.equal(alice.members.length, 1); assert.equal(bob.members.length, 2);
  const payload = { text: '<b>Hello</b>', clientMessageId: 'first', sender: { name: 'Fake' } };
  const sent = await call('messages', 'POST', payload, alice.token);
  assert.equal(sent.status, 201); assert.equal(sent.body.message.sender.name, 'Alice');
  assert.equal(sent.body.message.text, '<b>Hello</b>');
  const duplicate = await call('messages', 'POST', payload, alice.token);
  assert.equal(duplicate.body.message.id, sent.body.message.id);
  const state = (await call('state', 'GET', undefined, bob.token)).body;
  assert.equal(state.messages.length, 1); assert.equal(state.messages[0].id, sent.body.message.id);
  const freshWorker = createHostedWorker();
  const persisted = await freshWorker.fetch(new Request('https://warmly.example/api/chat/state', { headers: { Authorization: `Bearer ${bob.token}` } }), { DB });
  assert.equal((await persisted.json()).messages[0].id, sent.body.message.id);
  await call('session', 'DELETE', undefined, alice.token);
  assert.equal((await call('state', 'GET', undefined, alice.token)).status, 401);
  assert.equal((await call('state', 'GET', undefined, bob.token)).body.members.length, 1);
});
test('hosted room rejects invalid input, cross-origin writes, expired sessions and rapid sends', async t => {
  const { call, DB } = setup(t);
  assert.equal((await call('messages', 'POST', { text: 'Hi', clientMessageId: 'a' })).status, 401);
  assert.equal((await call('session', 'POST', { name: 'x'.repeat(33) })).status, 400);
  assert.equal((await call('session', 'POST', { name: 'Alice' }, undefined, 'https://other.example')).status, 403);
  const user = (await call('session', 'POST', { name: 'Alice' })).body;
  for (const text of ['', ' ', 'x'.repeat(2001), 3]) assert.equal((await call('messages', 'POST', { text, clientMessageId: 'a' }, user.token)).status, 400);
  assert.equal((await call('messages', 'POST', { text: 'x'.repeat(10000), clientMessageId: 'big' }, user.token)).status, 413);
  assert.equal((await call('messages', 'POST', { text: 'Hi', clientMessageId: 'a' }, user.token)).status, 201);
  assert.equal((await call('messages', 'POST', { text: 'Spam', clientMessageId: 'b' }, user.token)).status, 429);
  DB.sql.prepare('UPDATE chat_sessions SET expires_at = 0').run();
  assert.equal((await call('state', 'GET', undefined, user.token)).status, 401);
});
test('hosted history retains only 100 messages and old presence expires', async t => {
  const { call, DB } = setup(t);
  const user = (await call('session', 'POST', { name: 'Alice' })).body;
  const old = (await call('session', 'POST', { name: 'Old guest' })).body;
  DB.sql.prepare('UPDATE chat_sessions SET last_seen = 0 WHERE id = ?').run(old.self.id);
  for (let index = 0; index < 102; index++) {
    DB.sql.prepare('UPDATE chat_sessions SET last_sent = 0 WHERE id = ?').run(user.self.id);
    assert.equal((await call('messages', 'POST', { text: `Message ${index}`, clientMessageId: `m${index}` }, user.token)).status, 201);
  }
  const state = (await call('state', 'GET', undefined, user.token)).body;
  assert.equal(state.members.length, 1); assert.equal(state.messages.length, 100);
  assert.equal(state.messages[0].text, 'Message 2'); assert.equal(state.messages[99].text, 'Message 101');
});
