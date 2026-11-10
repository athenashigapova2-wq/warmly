import { createServer } from 'node:http';
import { createLocalD1 } from '../tests/d1-adapter.js';
import worker from '../dist/server/index.js';
const DB = createLocalD1();
const port = Number(process.env.HOSTED_PREVIEW_PORT || 4300);
createServer(async (req, res) => {
  try {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const request = new Request(`http://127.0.0.1:${port}${req.url}`, {
      method: req.method, headers: req.headers,
      ...(['GET', 'HEAD'].includes(req.method) ? {} : { body: Buffer.concat(chunks) }),
    });
    const response = await worker.fetch(request, { DB });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) { console.error(error); res.writeHead(500); res.end('Preview failed'); }
}).listen(port, '127.0.0.1', () => console.log(`Hosted preview: http://127.0.0.1:${port}`));
