import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

// Static web hosting only. Authentication and messages go directly to Supabase.
export function createChatServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => { res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('Referrer-Policy','strict-origin-when-cross-origin'); next(); });
  app.use(express.static(fileURLToPath(new URL('../dist/warmly/browser', import.meta.url))));
  app.use((error, _req, res, _next) => res.status(error.status === 413 ? 413 : 400).json({ error: error.status === 413 ? 'Request is too large.' : 'Invalid request body.' }));
  return { app, http: createServer(app) };
}
