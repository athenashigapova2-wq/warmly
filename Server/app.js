import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createHostedWorker } from '../Hosting/worker.js';

// Local and hosted clients use the same Supabase-backed API. No fallback storage.
export function createChatServer({ env = process.env, requestStorage = fetch } = {}) {
  const app = express();
  const worker = createHostedWorker({}, requestStorage);
  app.disable('x-powered-by');
  app.use('/api', express.raw({ type: () => true, limit: '8kb', inflate: false }));
  app.use('/api', async (req, res) => {
    try {
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) if (typeof value === 'string') headers.set(key, value);
      headers.set('cf-connecting-ip', req.socket.remoteAddress || 'local-preview');
      const request = new Request(`http://${req.headers.host}${req.originalUrl}`, {
        method: req.method, headers,
        ...(['GET', 'HEAD'].includes(req.method) ? {} : { body: req.body || Buffer.alloc(0) }),
      });
      const response = await worker.fetch(request, env);
      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));
      res.send(Buffer.from(await response.arrayBuffer()));
    } catch { res.status(503).json({ error: 'Chat is temporarily unavailable. Please try again.' }); }
  });
  app.use(express.static(fileURLToPath(new URL('../dist/warmly/browser', import.meta.url))));
  app.use((error, _req, res, _next) => res.status(error.status === 413 ? 413 : 400).json({ error: error.status === 413 ? 'Request is too large.' : 'Invalid request body.' }));
  return { app, http: createServer(app) };
}
