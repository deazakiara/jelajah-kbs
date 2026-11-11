import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const BASE = 'http://127.0.0.1:8765/';
async function page(w, h) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } }); const p = await ctx.newPage(); const logs = [];
  p.on('pageerror', e => logs.push('PAGEERROR ' + e.message)); p.on('console', m => { if (m.type() === 'error') logs.push(m.text()); });
  await p.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  return { ctx, p, logs };
}
// 1) landing desktop
{ const { ctx, p, logs } = await page(1280, 800);
  await p.goto(BASE); await p.waitForTimeout(3500);
  console.log('nav links:', await p.$$eval('.lnav-links a', a => a.map(x => x.textContent)));
  console.log('hero cta:', await p.$$eval('.hero-cta button', a => a.map(x => x.textContent.trim())));
  console.log('#pengelola section exists:', !!(await p.$('section#pengelola')), '| text "Perbarui peta" exists:', (await p.content()).includes('Perbarui peta'));
  console.log('footer links:', await p.$eval('.lfoot-in > div:last-child', d => d.textContent.trim()));
  await p.screenshot({ path: 'tools/a1-landing.png' });
  await p.screenshot({ path: 'tools/a1-landing-full.png', fullPage: true });
  // 2) auth: login admin via form pengunjung
  await p.click('.lnav-cta [data-auth="masuk"]'); await p.waitForTimeout(500);
  console.log('role tabs exist:', !!(await p.$('.role')), '| title:', await p.textContent('#auth-title'));
  console.log('demo rows:', await p.$$eval('.demo-acc', d => d.map(x => x.textContent.replace(/\s+/g, ' ').trim())));
  await p.screenshot({ path: 'tools/a2-auth.png' });
  await p.click('[data-fill="1"]'); await p.click('#authform button[type=submit]'); await p.waitForTimeout(2000);
  console.log('after admin login view:', await p.evaluate(() => document.body.dataset.view), '| toast:', await p.textContent('#toast'));
  await p.screenshot({ path: 'tools/a3-admin.png' });
  // logout -> login pengunjung
  await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); await p.goto(BASE + '#masuk'); await p.reload(); await p.waitForTimeout(2000);
  console.log('#masuk view:', await p.evaluate(() => document.body.dataset.view));
  await p.click('[data-fill="0"]'); await p.click('#authform button[type=submit]'); await p.waitForTimeout(2500);
  console.log('after visitor login view:', await p.evaluate(() => document.body.dataset.view));
  // daftar mode
  await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); await p.goto(BASE + '#daftar'); await p.reload(); await p.waitForTimeout(1500);
  console.log('daftar title:', await p.textContent('#auth-title'), '| fields:', await p.$$eval('#auth-form input', i => i.map(x => x.id)));
  await p.fill('#name', 'Sari Uji'); await p.fill('#email', 'sari@uji.id'); await p.fill('#pass', 'rahasia123'); await p.check('#agree'); await p.click('#authform button[type=submit]'); await p.waitForTimeout(2500);
  console.log('after register view:', await p.evaluate(() => document.body.dataset.view));
  // legacy #pengelola
  await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); await p.goto(BASE + '#pengelola'); await p.reload(); await p.waitForTimeout(1500);
  console.log('#pengelola legacy view:', await p.evaluate(() => document.body.dataset.view), await p.textContent('#auth-title'));
  // wrong password
  await p.fill('#email', 'admin@kbs.id'); await p.fill('#pass', 'salahsalah'); await p.click('#authform button[type=submit]'); await p.waitForTimeout(500);
  console.log('wrong pass msg:', await p.textContent('#formerr'));
  console.log('errors desktop:', logs.join(' | ') || 'none');
  await ctx.close(); }
// 3) mobile landing + auth
{ const { ctx, p, logs } = await page(390, 844);
  await p.goto(BASE); await p.waitForTimeout(3000);
  console.log('mobile scrollWidth:', await p.evaluate(() => document.documentElement.scrollWidth));
  await p.screenshot({ path: 'tools/a4-m-landing-full.png', fullPage: true });
  await p.goto(BASE + '#masuk'); await p.reload(); await p.waitForTimeout(1500);
  console.log('mobile auth scrollWidth:', await p.evaluate(() => document.documentElement.scrollWidth));
  await p.screenshot({ path: 'tools/a5-m-auth.png', fullPage: true });
  console.log('errors mobile:', logs.join(' | ') || 'none');
  await ctx.close(); }
await b.close();
