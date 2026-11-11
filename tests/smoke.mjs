// Uji asap website hasil build (dist/deploy).
//   node tests/smoke.mjs          → mode demo (tanpa Supabase)
//   node tests/smoke.mjs --mock   → mode Supabase dengan mock supabase-js (tanpa server sungguhan)
// Butuh: npm run deploy dulu, dan Chromium Playwright (npx playwright install chromium) atau env CHROMIUM_PATH.
import http from 'http';
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
const MOCK = process.argv.includes('--mock');
const ROOT = path.resolve('dist/deploy');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.css': 'text/css' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p); if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(0);
const URL0 = `http://127.0.0.1:${srv.address().port}/`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/favicon|fonts\.g/.test(m.text())) errors.push(m.text()); });
await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ body: '', contentType: 'text/css' }));
if (MOCK) {
  await page.route('**/config.js', r => r.fulfill({ contentType: 'text/javascript', body: 'window.JELAJAH_CONFIG = { supabaseUrl: "https://mock.supabase.co", supabaseAnonKey: "anon-mock", destination: "kbs", showDemoAccounts: true };' }));
  await page.route('**/vendor/supabase/supabase.js', r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(new URL('./mock-supabase.js', import.meta.url), 'utf8') }));
}
let pass = 0, fail = 0;
const check = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log((ok ? '  ok   ' : '  FAIL ') + name + (extra ? '  ' + extra : '')); };
const calls = () => page.evaluate(() => window.__mockdb ? window.__mockdb.calls : []);
const hasCall = async fn => (await calls()).some(fn);
const visible = sel => page.locator(sel).first().isVisible();
const login = async (email, pass) => { await page.fill('#email', email); await page.fill('#pass', pass); await page.click('#authform [type=submit]'); };
const wait = ms => page.waitForTimeout(ms);
const T = 30000;

console.log(MOCK ? 'MODE SUPABASE (mock)' : 'MODE DEMO');
await page.goto(URL0 + '#qr-gerbang'); await page.waitForSelector('#v-auth:not([hidden])', { timeout: 60000 });
check('QR di URL → diminta masuk', await visible('#v-auth'));
if (MOCK) check('pindaian QR tercatat (qr_scans, source url)', await hasCall(c => c.t === 'qr_scans' && c.payload?.source === 'url' && c.payload?.qr_id === 'qr-gerbang'));
await login('pengunjung@jelajah.id', 'salah12345'); await page.waitForSelector('#formerr .formerr', { timeout: T });
check('kata sandi salah ditolak', /salah/i.test(await page.textContent('#formerr')));
await login('pengunjung@jelajah.id', 'jelajah1916'); await page.waitForSelector('#v-app:not([hidden])', { timeout: T });
check('login pengunjung → web app', await visible('#v-app'));
if (MOCK) {
  check('status dari server diterapkan (toilet plaza tutup)', await page.evaluate(() => __jelajah.st.closedPois.has('wc-plaza')));
  check('pengumuman dari server dimuat', await page.evaluate(() => __jelajah.st.annc.some(a => /server/.test(a.text))));
}
await page.fill('#q', 'komodo'); await wait(400);
const res = await page.textContent('#results');
if (MOCK) check('konten zona dari server (nama baru)', /dari server/.test(res), res.slice(0, 80));
await page.locator('#results button').first().click(); await wait(800);
await page.locator('#side [data-act="fav"]').first().click(); await wait(400);
if (MOCK) check('favorit tersimpan ke server', await hasCall(c => c.t === 'favorites' && c.op === 'upsert'));
await page.click('#btn-kobi'); await page.locator('#sugs button').first().click();
await page.waitForFunction(() => [...document.querySelectorAll('#msgs .msg.bot')].length >= 2 && !document.querySelector('#msgs .thinking'), null, { timeout: T });
const ans = await page.locator('#msgs .msg.bot').last().textContent();
check('Kobi menjawab', ans.length > 20, ans.slice(0, 70).replace(/\s+/g, ' '));
if (MOCK) { check('Kobi lewat edge function', /Kobi server/.test(ans)); const k = (await calls()).find(c => c.fn === 'kobi'); check('konteks data dikirim ke fungsi', k && k.body.context.length > 2000 && k.body.messages.at(-1).role === 'user'); }
// itinerary lewat obrolan Kobi
const lastBot = () => page.locator('#msgs .msg.bot').last().textContent();
const waitBot = n => page.waitForFunction(n => document.querySelectorAll('#msgs .msg.bot').length >= n && !document.querySelector('#msgs .thinking'), n, { timeout: T });
let nb = await page.locator('#msgs .msg.bot').count();
await page.fill('#kq', MOCK ? 'Tolong susun itinerary, aku datang bawa anak dan nenek' : 'tolong susun itinerary dong'); await page.press('#kq', 'Enter'); await waitBot(++nb);
if (MOCK) check('AI membantu memahami kalimat (mode prefs)', await hasCall(c => c.fn === 'kobi' && c.body.mode === 'prefs'));
check('Kobi bertanya dengan pilihan cepat', (await page.locator('#msgs .qr button').count()) >= 3, (await lastBot()).slice(0, 60));
for (let i = 0; i < 4 && !(await page.locator('#msgs .acts button.rt').filter({ hasText: 'itinerary' }).count()); i++) {
  const chips = page.locator('#msgs .qr button'); if (!(await chips.count())) break;
  await chips.first().click(); await waitBot(++nb);
}
const itTxt = await lastBot();
check('Kobi menyusun itinerary', /Rencana/.test(itTxt) && /\n1\. \d\d[.:]\d\d/.test(itTxt), itTxt.split('\n').slice(0, 2).join(' / '));
if (MOCK) check('preferensi dari AI dipakai (3 jam, ada lansia)', /Lansia/.test(itTxt) && /3 jam/.test(itTxt));
await page.locator('#msgs .acts button.rt').filter({ hasText: 'itinerary' }).last().click(); await wait(600);
check('itinerary tampil di panel & peta', await page.evaluate(() => !!__jelajah.st.plan && __jelajah.st.plan.pts.length > 3) && /Itinerary kunjungan/.test(await page.textContent('#side')));
if (!(await page.locator('#kobi').isHidden())) await page.click('#kobi-x');
// itinerary lewat formulir
await page.click('.wtabs [data-tab="plan"]'); await wait(400);
for (const sel of ['[data-pk="group"] [data-k="anak"]', '[data-pk="group"] [data-k="lansia"]', '[data-pk="cats"] [data-k="kucing"]', '[data-pk="acts"] [data-k="show"]', '[data-pk="minutes"] [data-k="180"]']) await page.click(sel);
await page.click('[data-act="runplan"]'); await wait(800);
const side = await page.textContent('#side');
check('formulir → itinerary dengan alasan per zona', /Itinerary kunjungan/.test(side) && (await page.locator('#side .why i').count()) > 3);
check('lansia: Menara Pandang tidak dimasukkan', /Menara Pandang/.test(await page.textContent('#side .excl')) && !(await page.locator('#side .steps-v b', { hasText: 'Menara Pandang' }).count()));
await page.click('[data-act="saveplan"]'); await wait(300);
if (MOCK) check('itinerary tersimpan ke server', await hasCall(c => c.t === 'visit_plans' && c.op === 'insert'));
if (MOCK) {
  await page.evaluate(() => __mockEmit('announcements', 'INSERT', { id: 900, destination_id: 'kbs', text: 'Uji realtime: feeding gajah 13.30', level: 'info', auto: false, created_at: new Date().toISOString() }));
  await wait(300); check('pengumuman realtime muncul sebagai banner', /Uji realtime/.test(await page.textContent('#banner')));
  await page.evaluate(() => __mockEmit('item_status', 'UPDATE', { destination_id: 'kbs', key: 'e:jembatan', closed: true, verified: null }));
  await wait(300); check('penutupan jalur realtime diterapkan', await page.evaluate(() => __jelajah.st.closedEdges.has('jembatan')));
  await page.click('#btn-avatar'); await page.click('#acct-menu [data-m="akun"]'); await wait(300);
  await page.click('#side [data-act="rate"][data-id="5"]'); await wait(300);
  check('survei kepuasan terkirim', await hasCall(c => c.t === 'surveys' && c.payload?.rating === 5));
}
await page.click('#btn-avatar'); await page.click('#acct-menu [data-m="out"]'); await page.waitForSelector('#v-landing:not([hidden])', { timeout: T });
check('keluar → landing', await visible('#v-landing'));
await page.locator('[data-auth="masuk"]').first().click(); await page.waitForSelector('#authform');
await login('admin@kbs.id', 'jelajah1916'); await page.waitForSelector('#v-admin:not([hidden])', { timeout: T });
check('login pengelola → konsol', await visible('#v-admin'));
if (MOCK) {
  await page.waitForFunction(() => /210/.test(document.querySelector('#acontent').textContent), null, { timeout: T }).catch(() => { });
  const txt = await page.textContent('#acontent');
  check('dasbor memakai data server (QR & survei)', /210/.test(txt) && /4,5/.test(txt) && !/DATA DEMO/.test(txt));
  check('riwayat dari server dimuat', await page.evaluate(() => __jelajah.st.log.some(l => /server/.test(l.what))));
}
await page.click('.anav [data-page="peta"]'); await wait(600);
await page.locator('[data-row="z:komodo"] input').click(); await wait(600);
check('tutup zona dari konsol', await page.evaluate(() => __jelajah.st.closedZones.has('komodo')));
if (MOCK) {
  check('status tersimpan (item_status upsert)', await hasCall(c => c.t === 'item_status' && c.op === 'upsert' && c.payload?.key === 'z:komodo' && c.payload?.closed === true));
  check('pengumuman otomatis tersimpan', await hasCall(c => c.t === 'announcements' && c.payload?.auto === true));
  check('riwayat perubahan tersimpan', await hasCall(c => c.t === 'change_log' && /Komodo/.test(c.payload?.what)));
}
await page.click('.anav [data-page="pengumuman"]'); await wait(300); await page.click('#annc-f [type=submit]'); await wait(600);
if (MOCK) check('pengumuman manual tersimpan', await hasCall(c => c.t === 'announcements' && c.payload?.auto === false && /Feeding gajah/.test(c.payload?.text)));
await page.click('.anav [data-page="jadwal"]'); await wait(300);
if (MOCK) check('jadwal dari server tampil di konsol', /Feeding komodo \(server\)/.test(await page.inputValue('#sch-tbl tbody tr input[type=text]')));
await page.click('#sch-save'); await wait(500);
if (MOCK) check('jadwal disimpan lewat RPC', await hasCall(c => c.rpc === 'replace_schedule' && c.args.items.length >= 1));
await page.click('.anav [data-page="lokasi"]'); await wait(300); await page.locator('[data-ver]').first().click(); await wait(500);
if (MOCK) check('verifikasi lokasi tersimpan', await hasCall(c => c.t === 'item_status' && 'verified' in (c.payload || {})));
check('tanpa error JavaScript', !errors.length, errors.slice(0, 3).join(' | '));
console.log(`${pass} lulus, ${fail} gagal`);
await browser.close(); srv.close(); process.exit(fail ? 1 : 0);
