import { chromium } from 'playwright';
import fs from 'fs';
const [,, file, out, w = '1280', h = '800', waitMs = '4000', script = ''] = process.argv;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, hasTouch: false });
const p = await ctx.newPage();
const logs = [];
p.on('console', m => logs.push(m.type() + ': ' + m.text()));
p.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
await p.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', route => { const u = new URL(route.request().url()); const local = '/home/claude/kbs/node_modules/three/' + u.pathname.replace('/npm/three@0.160.0/', ''); route.fulfill({ body: fs.readFileSync(local), contentType: 'application/javascript' }); });
await p.route('https://fonts.googleapis.com/**', route => route.fulfill({ body: '', contentType: 'text/css' }));
await p.goto('file://' + file);
await p.waitForTimeout(+waitMs);
if (script) { await p.evaluate(script); await p.waitForTimeout(2500); }
await p.screenshot({ path: out });
console.log(logs.slice(0, 30).join('\n'));
await b.close();
