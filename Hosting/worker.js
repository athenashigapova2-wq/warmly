const MAX_BODY = 8192;
const DAY = 86_400_000;
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
const mapMessage = row => ({ id: row.id, sender: { id: row.sender_id, name: row.sender_name }, text: row.text, createdAt: new Date(row.created_at).toISOString() });
async function session(request, db, now) {
  const token = request.headers.get('authorization')?.match(/^Bearer ([\w-]{36,80})$/)?.[1];
  if (!token) fail('Please join the chat first.', 401);
  const found = await db.prepare('SELECT * FROM chat_sessions WHERE token_hash = ? AND expires_at > ?').bind(await hash(token), now).first();
  if (!found) fail('Your session expired. Please join again.', 401);
  return found;
}
async function snapshot(db, member, now) {
  const rows = await db.batch([
    db.prepare('UPDATE chat_sessions SET last_seen = ? WHERE id = ?').bind(now, member.id),
    db.prepare('SELECT id, name FROM chat_sessions WHERE last_seen > ? AND expires_at > ? ORDER BY created_at, id LIMIT 500').bind(now - 30000, now),
    db.prepare('SELECT * FROM chat_messages ORDER BY seq DESC LIMIT 100'),
  ]);
  return { self: { id: member.id, name: member.name }, members: rows[1].results, messages: rows[2].results.reverse().map(mapMessage) };
}
export function createHostedWorker(assets = {}) {
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
        if (url.pathname === '/api/health') return json({ ok: true, storage: 'd1', transport: 'polling' });
        const db = env.DB;
        if (!db) fail('Chat is temporarily unavailable. Please try again shortly.', 503);
        const now = Date.now();
        if (!['GET', 'HEAD'].includes(request.method)) {
          const origin = request.headers.get('origin');
          if (origin && origin !== url.origin) fail('This request is not allowed.', 403);
        }
        if (url.pathname === '/api/chat/session' && request.method === 'POST') {
          const body = await readBody(request);
          const name = typeof body?.name === 'string' ? body.name.trim() : '';
          if (!name || name.length > 32) fail('Your name must be between 1 and 32 characters.', 400);
          const ipHash = await hash(request.headers.get('cf-connecting-ip') || 'local-preview');
          const count = await db.prepare('SELECT COUNT(*) AS total FROM chat_sessions WHERE ip_hash = ? AND created_at > ?').bind(ipHash, now - 60000).first();
          if (count.total >= 20) fail('Too many joins. Please wait a minute and try again.', 429);
          const token = crypto.randomUUID() + crypto.randomUUID();
          const member = { id: crypto.randomUUID(), name };
          await db.batch([
            db.prepare('DELETE FROM chat_sessions WHERE expires_at <= ?').bind(now),
            db.prepare('INSERT INTO chat_sessions (id, token_hash, name, ip_hash, created_at, expires_at, last_seen, last_sent) VALUES (?, ?, ?, ?, ?, ?, ?, 0)').bind(member.id, await hash(token), name, ipHash, now, now + DAY, now),
          ]);
          return json({ token, ...await snapshot(db, member, now) }, 201);
        }
        const member = await session(request, db, now);
        if (url.pathname === '/api/chat/session' && request.method === 'DELETE') {
          await db.prepare('DELETE FROM chat_sessions WHERE id = ?').bind(member.id).run();
          return json({ ok: true });
        }
        if (url.pathname === '/api/chat/state' && request.method === 'GET') return json(await snapshot(db, member, now));
        if (url.pathname === '/api/chat/messages' && request.method === 'POST') {
          const body = await readBody(request);
          const text = typeof body?.text === 'string' ? body.text.trim() : '';
          const key = body?.clientMessageId;
          if (!text || text.length > 2000) fail('Messages must be between 1 and 2000 characters.', 400);
          if (typeof key !== 'string' || !/^[\w-]{1,64}$/.test(key)) fail('Invalid message identifier.', 400);
          const existing = await db.prepare('SELECT * FROM chat_messages WHERE sender_id = ? AND client_message_id = ?').bind(member.id, key).first();
          if (existing) return json({ message: mapMessage(existing) });
          const allowed = await db.prepare('UPDATE chat_sessions SET last_sent = ?, last_seen = ? WHERE id = ? AND last_sent <= ?').bind(now, now, member.id, now - 500).run();
          if (!allowed.meta.changes) fail('Slow down a little. Try again in a second.', 429);
          const id = crypto.randomUUID();
          const result = await db.batch([
            db.prepare('INSERT INTO chat_messages (id, sender_id, sender_name, text, created_at, client_message_id) VALUES (?, ?, ?, ?, ?, ?)').bind(id, member.id, member.name, text, now, key),
            db.prepare('DELETE FROM chat_messages WHERE seq NOT IN (SELECT seq FROM chat_messages ORDER BY seq DESC LIMIT 100)'),
            db.prepare('SELECT * FROM chat_messages WHERE id = ?').bind(id),
          ]);
          return json({ message: mapMessage(result[2].results[0]) }, 201);
        }
        return json({ error: 'Not found.' }, 404);
      } catch (error) {
        if (!error.status) console.error('Warmly hosted request failed:', error.message);
        return json({ error: error.status ? error.message : 'Chat is temporarily unavailable. Please try again.' }, error.status || 503);
      }
    },
  };
}
export default createHostedWorker();
