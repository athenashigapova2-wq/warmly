import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { io } from 'socket.io-client';
import { createChatServer } from '../Server/app.js';

async function setup(t) {
  const server = createChatServer();
  server.http.listen(0, '127.0.0.1');
  await once(server.http, 'listening');
  const url = `http://127.0.0.1:${server.http.address().port}`;
  const sockets = [];
  t.after(async () => { sockets.forEach(s => s.disconnect()); await new Promise(resolve => server.io.close(resolve)); });
  async function client(name) {
    const s = io(url, { autoConnect: false, forceNew: true, reconnection: false });
    sockets.push(s);
    const connected = once(s, 'connect'); s.connect(); await connected;
    if (name) await s.timeout(2000).emitWithAck('join', { name });
    return s;
  }
  return { client, url };
}

test('broadcast, attribution, duplicate prevention and history after reconnect', async t => {
  const { client, url } = await setup(t);
  const alice = await client('Alice'); const bob = await client('Bob');
  const received = once(bob, 'message:new');
  const payload = { text: '<img src=x onerror=alert(1)> Привет!', clientMessageId: 'first', sender: { name: 'Fake' } };
  const ack = await alice.timeout(2000).emitWithAck('message:send', payload);
  const [message] = await received;
  assert.equal(message.sender.name, 'Alice'); assert.equal(message.text, payload.text);
  assert.equal(message.id, ack.message.id);
  const duplicate = await alice.timeout(2000).emitWithAck('message:send', payload);
  assert.equal(duplicate.message.id, message.id);
  bob.disconnect();
  const returning = await client();
  const joined = await returning.timeout(2000).emitWithAck('join', { name: 'Bob' });
  assert.equal(joined.messages.length, 1); assert.equal(joined.messages[0].id, message.id);
  assert.deepEqual(await (await fetch(`${url}/api/health`)).json(), { ok: true, storage: 'memory' });
});

test('rejects anonymous sends, invalid names, malformed, empty and oversized messages', async t => {
  const { client } = await setup(t); const socket = await client();
  assert.ok((await socket.timeout(2000).emitWithAck('message:send', { text: 'hello', clientMessageId: 'a' })).error);
  for (const name of ['', ' ', 'x'.repeat(33), null]) assert.ok((await socket.timeout(2000).emitWithAck('join', { name })).error);
  await socket.timeout(2000).emitWithAck('join', { name: 'Alice' });
  for (const text of ['', '  ', 'x'.repeat(2001), 5, null]) assert.ok((await socket.timeout(2000).emitWithAck('message:send', { text, clientMessageId: 'b' })).error);
  socket.emit('message:send', null); // No ack callback must not crash the server.
  const valid = await socket.timeout(2000).emitWithAck('message:send', { text: 'x'.repeat(2000), clientMessageId: 'valid' });
  assert.equal(valid.message.text.length, 2000);
  assert.ok((await socket.timeout(2000).emitWithAck('message:send', { text: 'spam', clientMessageId: 'spam' })).error);
});

test('only joined clients receive messages; presence updates on leave', async t => {
  const { client } = await setup(t); const alice = await client('Alice'); const outsider = await client();
  let leaked = false; outsider.on('message:new', () => { leaked = true; });
  const presence = once(alice, 'presence'); const bob = await client('Bob');
  assert.equal((await presence)[0].length, 2);
  const leaving = once(alice, 'presence'); bob.disconnect();
  assert.equal((await leaving)[0].length, 1);
  await alice.timeout(2000).emitWithAck('message:send', { text: 'hello', clientMessageId: 'room' });
  await outsider.timeout(2000).emitWithAck('join', { name: 'Visitor' });
  assert.equal(leaked, false);
});
