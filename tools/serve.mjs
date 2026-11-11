// npm run preview → buka http://localhost:8080 (melayani dist/deploy hasil npm run deploy)
import http from 'http';
import fs from 'fs';
import path from 'path';
const ROOT = path.resolve('dist/deploy'), PORT = +process.env.PORT || 8080;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.css': 'text/css', '.txt': 'text/plain' };
if (!fs.existsSync(ROOT)) { console.error('Belum ada dist/deploy. Jalankan: npm run deploy'); process.exit(1); }
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(PORT, () => console.log(`Jelajah KBS: http://localhost:${PORT}  (Ctrl+C untuk berhenti)`));
