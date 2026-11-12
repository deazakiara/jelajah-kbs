// node deploy.mjs [https://domain] [--https] → dist/deploy/ (siap upload ke hosting statis: CloudPanel/Nginx, cPanel, Netlify, Cloudflare Pages)
//   --https  : .htaccess langsung memaksa HTTPS (khusus hosting Apache/cPanel; di CloudPanel pakai pengaturan Nginx)
// Konfigurasi Supabase (opsional) dibaca dari env SUPABASE_URL + SUPABASE_ANON_KEY, atau dari file jelajah.config.json.
// Tanpa konfigurasi, website berjalan dalam mode demo (data di browser).
import fs from 'fs';
import path from 'path';
const ARGS = process.argv.slice(2);
const FORCE_HTTPS = ARGS.includes('--https');
const r = f => fs.readFileSync('src/' + f, 'utf8');
const OUT = 'dist/deploy';
fs.rmSync(OUT, { recursive: true, force: true });
const mk = p => fs.mkdirSync(path.join(OUT, p), { recursive: true });
['vendor/three/build', 'vendor/three/examples/jsm/controls', 'vendor/three/examples/jsm/utils', 'vendor/supabase', 'hp', 'models', 'data'].forEach(mk);
const T = 'node_modules/three/';
fs.copyFileSync(T + 'build/three.module.min.js', OUT + '/vendor/three/build/three.module.min.js');
for (const f of ['controls/MapControls.js', 'controls/OrbitControls.js', 'utils/BufferGeometryUtils.js']) fs.copyFileSync(T + 'examples/jsm/' + f, OUT + '/vendor/three/examples/jsm/' + f);
fs.copyFileSync(T + 'LICENSE', OUT + '/vendor/three/LICENSE');
const SB = 'node_modules/@supabase/supabase-js/';
fs.copyFileSync(SB + 'dist/umd/supabase.js', OUT + '/vendor/supabase/supabase.js');
if (fs.existsSync(SB + 'LICENSE')) fs.copyFileSync(SB + 'LICENSE', OUT + '/vendor/supabase/LICENSE');
// config.js: nilai publik (URL project + anon/publishable key). JANGAN pernah taruh service_role key di sini.
const fileCfg = fs.existsSync('jelajah.config.json') ? JSON.parse(fs.readFileSync('jelajah.config.json', 'utf8')) : {};
const CFG = {
  supabaseUrl: process.env.SUPABASE_URL || fileCfg.supabaseUrl || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || fileCfg.supabaseAnonKey || '',
  destination: process.env.JELAJAH_DEST || fileCfg.destination || 'kbs',
  showDemoAccounts: process.env.SHOW_DEMO_ACCOUNTS ? process.env.SHOW_DEMO_ACCOUNTS !== 'false' : fileCfg.showDemoAccounts !== false,
};
if (/service_role|sb_secret_/.test(CFG.supabaseAnonKey) || (() => { try { return JSON.parse(Buffer.from(CFG.supabaseAnonKey.split('.')[1] || '', 'base64url').toString()).role === 'service_role'; } catch { return false; } })()) { console.error('STOP: yang diisi adalah service_role/secret key. Pakai anon/publishable key.'); process.exit(1); }
fs.writeFileSync(OUT + '/config.js', `// Dibuat oleh deploy.mjs. Nilai di sini memang publik (dibatasi Row Level Security di Supabase).\nwindow.JELAJAH_CONFIG = ${JSON.stringify(CFG, null, 2)};\n`);
console.log(CFG.supabaseUrl ? 'Supabase: ' + CFG.supabaseUrl + ' (destinasi ' + CFG.destination + ')' : 'Supabase belum diisi → website berjalan dalam MODE DEMO');
const MODELS = 'assets/models';
for (const f of fs.readdirSync(MODELS).filter(f => f.endsWith('.glb'))) fs.copyFileSync(MODELS + '/' + f, OUT + '/models/' + f);
fs.copyFileSync('kbs_data.json', OUT + '/data/kbs_data.json');
// favicon dari simbol Kobi
const icons = r('icons.html'); const k = icons.slice(icons.indexOf('<symbol id="i-kobi"'), icons.indexOf('</symbol>', icons.indexOf('<symbol id="i-kobi"')));
fs.writeFileSync(OUT + '/favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">${k.replace(/<symbol[^>]*>/, '')}</svg>`);
const IMPORTS = `import * as THREE from 'three';\nimport { MapControls } from 'three/addons/controls/MapControls.js';\nimport { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';\n`;
const reset = `<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>`;
function page({ head, css, body, ui, prefix, title, desc, url, extraHead = '' }) {
  const importmap = `<script type="importmap">{"imports":{"three":"${prefix}vendor/three/build/three.module.min.js","three/addons/":"${prefix}vendor/three/examples/jsm/"}}</script>`;
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#1e5b3e">
<link rel="icon" href="${prefix}favicon.svg" type="image/svg+xml">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:type" content="website">
<meta property="og:url" content="${url}">
<link rel="modulepreload" href="${prefix}vendor/three/build/three.module.min.js">
${extraHead}
${reset}
${head.replace(/<meta name="claude:viewport-fit-sides"[^>]*>\n?/, '')}<style>
${css}
</style>
</head>
<body>
${body}
${importmap}
<script type="module">
${IMPORTS}${r('data.js')}
${r('scene.js')}
${r('core.js')}
${r('planner.js')}
${[].concat(ui).map(r).join('\n')}
</script>
</body>
</html>
`;
}
const DOMAIN = (ARGS.find(a => !a.startsWith('--')) || process.env.SITE_URL || 'https://chelsea.cloudcomp.my.id').replace(/\/$/, '');
fs.writeFileSync(OUT + '/index.html', page({ head: r('head-web.html'), css: r('web.css'), body: r('icons.html') + r('web.html'), ui: ['backend.js', 'webui.js'], prefix: './', title: 'Jelajah KBS', desc: 'Peta 3D interaktif dan pemandu AI untuk Kebun Binatang Surabaya.', url: DOMAIN + '/', extraHead: '<script defer src="./config.js"></script>\n<script defer src="./vendor/supabase/supabase.js"></script>' }));
fs.writeFileSync(OUT + '/hp/index.html', page({ head: r('head.html'), css: r('style.css'), body: r('icons.html') + r('body.html'), ui: 'ui.js', prefix: '../', title: 'Jelajah KBS · Versi HP', desc: 'Prototype aplikasi HP Jelajah KBS.', url: DOMAIN + '/hp/' }));
fs.writeFileSync(OUT + '/_headers', `/vendor/*
  Cache-Control: public, max-age=31536000, immutable
/config.js
  Cache-Control: no-cache
/models/*
  Cache-Control: public, max-age=604800
  Access-Control-Allow-Origin: *
/*.glb
  Content-Type: model/gltf-binary
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
`);
fs.writeFileSync(OUT + '/.htaccess', `# Jelajah KBS · konfigurasi Apache/LiteSpeed untuk hosting cPanel
DirectoryIndex index.html
AddType model/gltf-binary .glb
AddType application/javascript .js .mjs
AddType image/svg+xml .svg
AddType application/json .json

<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css application/javascript application/json image/svg+xml model/gltf-binary
</IfModule>

<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType text/html "access plus 0 seconds"
  ExpiresByType application/javascript "access plus 1 month"
  ExpiresByType model/gltf-binary "access plus 7 days"
  ExpiresByType image/svg+xml "access plus 7 days"
  ExpiresByType application/json "access plus 1 hour"
</IfModule>

<IfModule mod_headers.c>
  Header set X-Content-Type-Options "nosniff"
  Header set Referrer-Policy "strict-origin-when-cross-origin"
</IfModule>

${FORCE_HTTPS ? `# Paksa HTTPS (dibuat dengan: node deploy.mjs --https)
RewriteEngine On
RewriteCond %{HTTPS} !=on
RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]` : `# Paksa HTTPS: jalankan "npm run deploy:https" (atau hapus tanda # di 3 baris bawah) SETELAH SSL aktif
# RewriteEngine On
# RewriteCond %{HTTPS} !=on
# RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]`}
`);
fs.writeFileSync(OUT + '/robots.txt', 'User-agent: *\nAllow: /\n');
let total = 0; const walk = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else total += fs.statSync(p).size; } }; walk(OUT);
console.log('deploy siap di', OUT, (total / 1024).toFixed(0) + ' KB');
