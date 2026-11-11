import { chromium } from 'playwright';
import fs from 'fs';
const runs = JSON.parse(process.argv[2]);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const r of runs) {
  const ctx = await b.newContext({ viewport: { width: r.w, height: r.h }, deviceScaleFactor: 1, colorScheme: r.dark ? 'dark' : 'light' });
  const p = await ctx.newPage(); const logs = [];
  p.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
  await p.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', route => { const u = new URL(route.request().url()); route.fulfill({ body: fs.readFileSync('/home/claude/kbs/node_modules/three/' + u.pathname.replace('/npm/three@0.160.0/', '')), contentType: 'application/javascript' }); });
  await p.route('https://fonts.googleapis.com/**', route => route.fulfill({ body: '', contentType: 'text/css' }));
  await p.goto('file:///home/claude/kbs/dist/jelajah-kbs.local.html'); await p.waitForTimeout(4000);
  for (const js of (r.js || [])) { await p.evaluate(js); await p.waitForTimeout(r.wait || 3500); }
  await p.screenshot({ path: r.out });
  const ov = await p.evaluate(`document.documentElement.scrollWidth + '/' + document.documentElement.clientWidth`);
  console.log(r.out, 'overflow', ov, logs.join(' | '));
  await ctx.close();
}
await b.close();
