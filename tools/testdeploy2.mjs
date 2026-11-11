import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const [url, out, w, h] of [['http://127.0.0.1:8790/', 'tools/dep-web.png', 1280, 800], ['http://127.0.0.1:8790/hp/', 'tools/dep-hp.png', 390, 844], ['http://127.0.0.1:8790/#qr-plaza', 'tools/dep-qr.png', 1280, 800]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } }); const p = await ctx.newPage(); const logs = []; const failed = [];
  p.on('pageerror', e => logs.push('PAGEERROR ' + e.message)); p.on('console', m => { if (m.type() === 'error') logs.push(m.text()); });
  p.on('requestfailed', r => { if (!r.url().includes('fonts.')) failed.push(r.url()); });
  await p.route('https://fonts.googleapis.com/**', route => route.fulfill({ body: '', contentType: 'text/css' }));
  await p.goto(url); await p.waitForTimeout(4000); await p.screenshot({ path: out });
  console.log(url, logs.join(' | ') || 'no errors', failed.length ? 'FAILED: ' + failed.join(',') : '');
  await ctx.close();
}
await b.close();
