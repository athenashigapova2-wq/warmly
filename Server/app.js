import express from 'express';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';

// Ephemeral public room. No accounts or private conversations in this slice.
export function createChatServer() {
  const app = express();
  const http = createServer(app);
  const io = new Server(http, { maxHttpBufferSize: 16_384 });
  const messages = [];
  const members = new Map();
  app.disable('x-powered-by');
  app.get('/api/health', (_req, res) => res.json({ ok: true, storage: 'memory' }));
  app.use(express.static(fileURLToPath(new URL('../dist/warmly/browser', import.meta.url))));
  const presence = () => io.to('general').emit('presence', [...members.values()]);
  io.on('connection', socket => {
    let lastSent = 0;
    const receipts = new Map();
    socket.on('join', (payload, reply) => {
      if (typeof reply !== 'function') return;
      const name = typeof payload?.name === 'string' ? payload.name.trim() : '';
      if (!name || name.length > 32) return reply({ error: 'Имя должно содержать от 1 до 32 символов.' });
      if (!members.has(socket.id)) {
        members.set(socket.id, { id: socket.id, name });
        socket.join('general');
      }
      reply({ self: members.get(socket.id), messages });
      presence();
    });
    socket.on('message:send', (payload, reply) => {
      if (typeof reply !== 'function') return;
      const member = members.get(socket.id);
      if (!member) return reply({ error: 'Сначала войдите в чат.' });
      const text = typeof payload?.text === 'string' ? payload.text.trim() : '';
      const key = payload?.clientMessageId;
      if (!text || text.length > 2000 || typeof key !== 'string' || !/^[\w-]{1,64}$/.test(key)) {
        return reply({ error: 'Сообщение должно содержать от 1 до 2000 символов.' });
      }
      if (receipts.has(key)) return reply({ message: receipts.get(key) });
      if (Date.now() - lastSent < 500) return reply({ error: 'Слишком быстро. Подождите секунду.' });
      lastSent = Date.now();
      const message = { id: randomUUID(), sender: member, text, createdAt: new Date().toISOString() };
      messages.push(message);
      if (messages.length > 100) messages.shift();
      receipts.set(key, message);
      if (receipts.size > 100) receipts.delete(receipts.keys().next().value);
      io.to('general').emit('message:new', message);
      reply({ message });
    });
    socket.on('disconnect', () => { members.delete(socket.id); presence(); });
  });
  return { http, io };
}
