// serve.ts — the static server the game is played from, and the one the capture drives.
// It serves game/ at the root, which is how the grader mounts the entry.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const root = join(resolve(import.meta.dirname), 'game');
const argv = process.argv.slice(2);
const portFlag = argv.indexOf('--port');
const port = Number(portFlag >= 0 ? argv[portFlag + 1] : process.env.PORT ?? 8080);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  const asked = decodeURIComponent(url.pathname);
  const file = normalize(join(root, asked === '/' ? '/index.html' : asked));
  if (!file.startsWith(root + sep) && file !== root) {
    response.writeHead(403).end('outside the game');
    return;
  }
  try {
    const bytes = await readFile(file);
    response.writeHead(200, {
      'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': 'no-store',
      'content-length': bytes.length,
    });
    response.end(bytes);
  } catch {
    response.writeHead(404).end('not here');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Pier Nine on http://127.0.0.1:${port}/`);
});
