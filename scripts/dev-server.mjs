// Serveur de développement local : fichiers statiques + Netlify Functions (stockage mémoire) + en-têtes COOP/COEP.
// Usage : npm run dev  →  http://localhost:8888
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.MOTION_MEMORY_STORE ||= '1';
const root = join(fileURLToPath(import.meta.url), '../..');
const port = +(process.env.PORT || 8888);
const fns = {
  '/mcp': (await import('../netlify/functions/mcp.mjs')).default,
  '/api/session': (await import('../netlify/functions/session.mjs')).default,
  '/api/share': (await import('../netlify/functions/share.mjs')).default,
};
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8' };
const SEC = { 'cross-origin-opener-policy': 'same-origin', 'cross-origin-embedder-policy': 'require-corp', 'cross-origin-resource-policy': 'same-origin' };

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    const fn = fns[url.pathname];
    if (fn) {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = chunks.length ? Buffer.concat(chunks) : undefined;
      const r = await fn(new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body }));
      res.writeHead(r.status, Object.fromEntries(r.headers));
      res.end(Buffer.from(await r.arrayBuffer()));
      return;
    }
    let p = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    if (p === '/' || p === '') p = '/index.html';
    if (p === '/parity') p = '/parity.html';
    let file = join(root, p);
    try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html'); } catch { file = join(root, 'index.html'); }
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache', ...SEC });
    res.end(data);
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(String(e.stack || e));
  }
}).listen(port, () => console.log(`Motion Studio : http://localhost:${port}  (MCP : http://localhost:${port}/mcp)`));
