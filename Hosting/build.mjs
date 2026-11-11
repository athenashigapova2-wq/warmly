import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join, extname, relative } from 'node:path';
const root = new URL('../', import.meta.url);
const source = new URL('../dist/warmly/browser/', import.meta.url);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png' };
const assets = {};
// fileURLToPath preserves non-ASCII Windows paths.
const { fileURLToPath } = await import('node:url');
const sourcePath = fileURLToPath(source);
async function walk(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, item.name);
    if (item.isDirectory()) await walk(path);
    else {
      const key = '/' + relative(sourcePath, path).replaceAll('\\', '/');
      let bytes = await readFile(path);
      if (key === '/index.html') bytes = Buffer.from(bytes.toString().replace('<head>', '<head><script>window.__WARMLY_HOSTED__=true;</script>'));
      assets[key] = { type: types[extname(path)] || 'application/octet-stream', body: bytes.toString('base64') };
    }
  }
}
await walk(sourcePath);
if (!assets['/index.html']) throw new Error('Build Angular before packaging the hosted Worker.');
const storage = await readFile(new URL('./supabase-store.js', import.meta.url), 'utf8');
const worker = storage + '\n' + (await readFile(new URL('./worker.js', import.meta.url), 'utf8')).replace("import { createSupabaseStore } from './supabase-store.js';", '').replace('export default createHostedWorker();', `export default createHostedWorker(${JSON.stringify(assets)});`);
await mkdir(new URL('../dist/server/', import.meta.url), { recursive: true });
await mkdir(new URL('../dist/.openai/', import.meta.url), { recursive: true });
await writeFile(new URL('../dist/server/index.js', import.meta.url), worker);
await writeFile(new URL('../dist/.openai/hosting.json', import.meta.url), await readFile(new URL('.openai/hosting.json', root)));
console.log(`Packaged hosted Worker with ${Object.keys(assets).length} Angular assets.`);
