// ============================================================
// WEB UI — landing (khusus pengunjung), satu form login (peran dari akun), web app pengunjung, konsol pengelola
// (logika routing/planner/Kobi dipakai bersama dari core.js)
// ============================================================
const MQ_MOBILE = matchMedia('(max-width: 900px)');
const initials = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

// ---------- storage (aman bila diblokir) ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } },
  del(k) { try { localStorage.removeItem(k); } catch { } },
  sget(k, d) { try { const v = sessionStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  sset(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { } },
  sdel(k) { try { sessionStorage.removeItem(k); } catch { } },
};
async function hashPass(s) {
  try { if (crypto && crypto.subtle) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('jelajah:' + s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); } } catch { }
  let h = 5381; for (const c of 'jelajah:' + s) h = ((h << 5) + h + c.charCodeAt(0)) | 0; return 'd' + (h >>> 0).toString(16);
}
const DEMO = [
  { email: 'pengunjung@jelajah.id', name: 'Pengunjung Demo', role: 'pengunjung', pass: 'jelajah1916' },
  { email: 'admin@kbs.id', name: 'Admin KBS (demo)', role: 'pengelola', pass: 'jelajah1916' },
];
let session = BE.on ? null : (store.get('jelajah.session', null) || store.sget('jelajah.session', null));
let pendingQR = null;

// ---------- persisted ops state (demo, per browser) ----------
const OPS = BE.on ? null : store.get('jelajah.ops', null);
st.annc = [];
if (OPS) {
  (OPS.closedZones || []).forEach(id => st.closedZones.add(id)); (OPS.closedEdges || []).forEach(id => st.closedEdges.add(id)); (OPS.closedPois || []).forEach(id => st.closedPois.add(id));
  (OPS.verified || []).forEach(k => st.verified.add(k)); (OPS.unverified || []).forEach(k => st.verified.delete(k));
  st.log = OPS.log || []; st.annc = OPS.annc || []; if (OPS.schedule) DATA.schedule.splice(0, DATA.schedule.length, ...OPS.schedule);
}
const BASE_VERIFIED = new Set(st.verified);
function saveOps() { if (BE.on) return; store.set('jelajah.ops', { closedZones: [...st.closedZones], closedEdges: [...st.closedEdges], closedPois: [...st.closedPois], verified: [...st.verified].filter(k => !BASE_VERIFIED.has(k)), unverified: [...BASE_VERIFIED].filter(k => !st.verified.has(k)), log: st.log.slice(-60), annc: st.annc.slice(0, 30), schedule: DATA.schedule }); }

// ---------- per-user data ----------
const ukey = k => 'jelajah.' + k + '.' + (session ? session.email : 'anon');
const U = {
  get fav() { return new Set(store.get(ukey('fav'), [])); }, setFav(s) { store.set(ukey('fav'), [...s]); if (BE.on && session) BE.pushSet('favorites', 'item_key', s); },
  get seen() { return new Set(store.get(ukey('seen'), [])); }, setSeen(s) { store.set(ukey('seen'), [...s]); if (BE.on && session) BE.pushSet('passport_stamps', 'animal_id', s); },
  get plans() { return store.get(ukey('plans'), []); }, setPlans(a) { store.set(ukey('plans'), a); if (BE.on && session) BE.pushPlans(a); },
  get loc() { return store.get(ukey('loc'), null); }, setLoc(id) { store.set(ukey('loc'), id); },
};

// ---------- scene & map slot ----------
const mapwrap = $('#mapwrap');
const PIN_HANDLERS = { zone: null, poi: null };
const S = createScene($('#scene'), {
  onPick: id => PIN_HANDLERS.zone && PIN_HANDLERS.zone(id),
  onPickNone: () => { },
  onZoom: d => { st.zoom = d; refreshPins(); },
  onInteract: () => { $('#results').hidden = true; },
});
const park = document.createElement('div'); park.style.cssText = 'position:fixed;left:-9999px;top:0;width:400px;height:300px;'; document.body.append(park);
function mountMap(slot, { hero = false } = {}) {
  (slot || park).prepend(mapwrap); mapwrap.classList.toggle('hero-mode', hero); S.pause(!slot); S.setInteractive(!hero); S.setAutoRotate(hero);
}

// pins
const pinEls = {};
function mkPin(key, html, pos) { const w = document.createElement('div'); w.className = 'pin'; w.innerHTML = `<div class="pin-in">${html}</div>`; $('#pins').append(w); S.addPin(key, pos, w); pinEls[key] = w; return w; }
function rmPin(key) { if (pinEls[key]) { pinEls[key].remove(); S.removePin(key); delete pinEls[key]; } }
ZONES.forEach(z => { const w = mkPin('z:' + z.id, `<button class="zpin" style="--c:${CAT[z.cat].color}" aria-label="${esc(z.name)}"><span class="bub"><span class="pic">${ICO(z.icon || 'paw')}</span><span class="lbl">${esc(PIN_NAME[z.id] || z.name)}</span></span><span class="stem"></span><span class="foot"></span></button>`, [z.pos[0], PIN_Y[z.id] || 2.4, z.pos[1]]); w.querySelector('button').onclick = e => { e.stopPropagation(); PIN_HANDLERS.zone && PIN_HANDLERS.zone(z.id); }; });
POIS.forEach(p => { const t = POI_T[p.type]; const w = mkPin('p:' + p.id, `<button class="fpin" style="--c:${t.color}" aria-label="${esc(p.name)}">${ICO(t.icon)}</button>`, [p.pos[0], p.id === 'foto-surabaya' ? 3.4 : 2.0, p.pos[1]]); w.querySelector('button').onclick = e => { e.stopPropagation(); PIN_HANDLERS.poi && PIN_HANDLERS.poi(p.id); }; });
[['Jl. Raya Darmo', [55.5, 0.4, 2]], ['Jl. Diponegoro', [27, 0.4, -36]], ['Jl. Setail', [11.5, 0.4, -28]], ['Jl. Joyoboyo', [-12, 0.4, 42.4]], ['Terminal Joyoboyo', [45, 4.2, 48.2]]].forEach(([n, p], i) => mkPin('r:' + i, `<div class="rlbl">${n}</div>`, p));
let currentView = 'landing';
function refreshPins() {
  const z = st.zoom, far = z > 100, mid = z > 62 && !far, admin = currentView === 'admin', f = admin ? 'semua' : st.filter;
  const zf = FILTER_ZONE[f], pf = FILTER_POI[f];
  for (const zo of ZONES) {
    const el = pinEls['z:' + zo.id]; const b = el.querySelector('.zpin'); const sel = st.sel === 'z:' + zo.id;
    let show = f === 'semua' ? (admin || zo.cat !== 'staf' || (!far && !mid) || sel) : ((zf && zf(zo)) || sel);
    if (st.plan && st.plan.stops.some(s => s.id === zo.id)) show = true;
    el.hidden = !show;
    b.classList.toggle('compact', !sel && f === 'semua' && ((far && !PRIO.has(zo.id)) || (mid && zo.cat === 'staf')));
    b.classList.toggle('sel', sel);
    const closed = st.closedZones.has(zo.id); b.classList.toggle('closed', closed); const tag = b.querySelector('.tag');
    if (closed && !tag) b.querySelector('.bub').insertAdjacentHTML('beforeend', '<span class="tag">Tutup</span>'); else if (!closed && tag) tag.remove();
  }
  for (const p of POIS) { const el = pinEls['p:' + p.id]; const sel = st.sel === 'p:' + p.id; const show = admin ? z < 80 : pf ? pf.includes(p.type) : (f === 'semua' && z < 58 && p.type !== 'loket'); el.hidden = !(show || sel); const b = el.querySelector('.fpin'); b.classList.toggle('sel', sel); b.classList.toggle('closed', st.closedPois.has(p.id)); }
  for (let i = 0; i < 5; i++) pinEls['r:' + i].hidden = z > 150 || z < 30;
}
function setUserLoc(q) { st.user = q; dcache = null; if (q) { S.setUser(q.pos); rmPin('user'); mkPin('user', `<div class="upin"><span>Anda</span></div>`, [q.pos[0], 0.7, q.pos[1]]); } else { S.setUser(null); rmPin('user'); } }

// ---------- views ----------
const VIEWS = ['landing', 'auth', 'app', 'admin'];
function go(v, opts = {}) {
  currentView = v; document.body.dataset.view = v;
  VIEWS.forEach(n => { $('#v-' + n).hidden = n !== v; });
  $('#acct-menu').hidden = true; $('#results').hidden = true;
  if (v === 'landing') { mountMap($('#slot-hero'), { hero: true }); S.clearRoute(); S.select(null); st.sel = null; st.route = st.plan = null; clearStopPins(); setNightUI(false); S.overview(0.01); renderLandingNav(); window.scrollTo(0, 0); }
  else if (v === 'auth') { mountMap(null); renderAuth(opts.mode || authMode); window.scrollTo(0, 0); }
  else if (v === 'app') { mountMap($('#slot-app')); PIN_HANDLERS.zone = id => openZone(id); PIN_HANDLERS.poi = id => openPoi(id); enterApp(); }
  else if (v === 'admin') { setNightUI(false); PIN_HANDLERS.zone = id => adminFocus('z', id); PIN_HANDLERS.poi = id => adminFocus('p', id); enterAdmin(opts.page || 'ringkasan'); }
  refreshPins();
}
document.addEventListener('click', e => {
  const a = e.target.closest('[data-auth]'); if (a) { e.preventDefault(); if (session) { go(session.role === 'pengelola' ? 'admin' : 'app'); return; } go('auth', { mode: a.dataset.auth }); return; }
  const g = e.target.closest('[data-go]'); if (g) { e.preventDefault(); go(g.dataset.go); }
});
function renderLandingNav() {
  const c = $('.lnav-cta'); if (!session) { c.innerHTML = `<button class="btn ghost" data-auth="masuk">Masuk</button><button class="btn primary" data-auth="daftar">Daftar gratis</button>`; return; }
  c.innerHTML = `<button class="btn primary" data-auth="masuk">${session.role === 'pengelola' ? 'Buka konsol' : 'Buka peta'}</button><button class="btn ghost" id="lnav-out">Keluar</button>`; $('#lnav-out').onclick = logout;
}

// ---------- AUTH ----------
let authMode = 'masuk';
function field(id, label, type = 'text', attrs = '') { return `<div class="field" id="f-${id}"><label for="${id}">${label}</label><div class="inp"><input id="${id}" type="${type}" ${attrs}>${type === 'password' ? `<button type="button" class="iconbtn eye" data-eye="${id}" aria-label="Tampilkan kata sandi">${ICO('eye')}</button>` : ''}</div><div class="msg" id="m-${id}"></div></div>`; }
// Satu form untuk semua: peran (pengunjung / pengelola) dibaca dari akun yang dipakai masuk.
function renderAuth(mode) {
  authMode = mode === 'daftar' ? 'daftar' : 'masuk';
  const daftar = authMode === 'daftar';
  $('#auth-title').textContent = daftar ? 'Buat akun Jelajah' : 'Masuk ke Jelajah';
  $('#auth-sub').innerHTML = daftar ? `Sudah punya akun? <button class="link" data-mode="masuk">Masuk</button>` : `Belum punya akun? <button class="link" data-mode="daftar">Daftar gratis</button>`;
  $('#auth-bubble').textContent = daftar ? 'Yuk bikin akun! Rencana, favorit, dan paspor satwamu nanti tersimpan di sini.' : 'Halo! Masuk dulu ya, biar rencana, favorit, dan paspor satwamu tersimpan.';
  let html = '<form class="form" id="authform" novalidate><div id="formerr"></div>';
  if (!daftar) html += field('email', 'Email', 'email', 'autocomplete="email" placeholder="nama@email.com"') + field('pass', 'Kata sandi', 'password', 'autocomplete="current-password" placeholder="Minimal 8 karakter"') +
    `<div class="row-between"><label class="check"><input type="checkbox" id="remember" checked>Ingat saya</label><button type="button" class="link" id="forgot">Lupa kata sandi?</button></div><button class="btn primary lg block" type="submit">Masuk</button>` +
    `<div class="or">atau</div><button type="button" class="gbtn" id="gbtn"><span class="g">G</span>Masuk dengan Google</button>`;
  else html += field('name', 'Nama lengkap', 'text', 'autocomplete="name" placeholder="Nama kamu"') + field('email', 'Email', 'email', 'autocomplete="email" placeholder="nama@email.com"') + field('pass', 'Kata sandi', 'password', 'autocomplete="new-password" placeholder="Minimal 8 karakter"') + `<div class="meter" id="meter" aria-hidden="true"><i></i><i></i><i></i><i></i></div>` +
    `<div class="field" id="f-agree"><label class="check"><input type="checkbox" id="agree">Saya setuju dengan syarat penggunaan & kebijakan privasi</label><div class="msg" id="m-agree"></div></div><button class="btn primary lg block" type="submit">Buat akun</button>`;
  html += '</form>';
  $('#auth-form').innerHTML = html;
  $('#demo-box').innerHTML = `<b>Akun demo</b>${DEMO.map((d, i) => `<div class="demo-acc"><span><small>${d.role === 'pengelola' ? 'Pengelola (admin)' : 'Pengunjung'}</small><code>${d.email}</code> · <code>${d.pass}</code></span><button class="btn sm ghost" data-fill="${i}">Isi otomatis</button></div>`).join('')}`;
  $('#demo-box').hidden = BE.on && !BE.cfg.showDemoAccounts;
  $$('[data-fill]').forEach(b => b.onclick = () => { const d = DEMO[+b.dataset.fill]; if (authMode !== 'masuk') renderAuth('masuk'); $('#email').value = d.email; $('#pass').value = d.pass; $('#email').focus(); });
  $$('[data-eye]').forEach(b => b.onclick = () => { const i = $('#' + b.dataset.eye); const show = i.type === 'password'; i.type = show ? 'text' : 'password'; b.innerHTML = ICO(show ? 'eyeoff' : 'eye'); b.setAttribute('aria-label', show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'); });
  const pi = $('#pass'); if (pi && daftar) pi.oninput = () => { const v = pi.value; let s = 0; if (v.length >= 8) s++; if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++; if (/\d/.test(v)) s++; if (/[^\w]/.test(v) || v.length >= 12) s++; $('#meter').className = 'meter' + (v ? ' s' + Math.max(1, s) : ''); };
  if ($('#forgot') && BE.on) $('#forgot').onclick = async () => { const em = $('#email').value.trim().toLowerCase(); if (!EMAIL_RE.test(em)) { setErr('email', 'Isi email akunmu dulu, lalu klik Lupa kata sandi'); $('#email').focus(); return; } const r = await BE.forgot(em); formErr(r.error || 'Tautan untuk membuat kata sandi baru sudah dikirim ke ' + em + '. Cek juga folder spam.', r.error ? 'err' : 'info'); };
  else if ($('#forgot')) $('#forgot').onclick = () => formErr('Di versi produksi, tautan reset kata sandi dikirim ke email lewat Supabase Auth. Untuk demo, pakai akun di bawah.', 'info');
  if ($('#gbtn') && BE.on) $('#gbtn').onclick = async () => { const r = await BE.google(); if (r.error) formErr(r.error); };
  else if ($('#gbtn')) $('#gbtn').onclick = () => formErr('Masuk dengan Google aktif di versi produksi (Supabase Auth + Google OAuth). Untuk demo, pakai email & kata sandi.', 'info');
  $('#authform').onsubmit = onAuthSubmit;
  $$('#auth-form input').forEach(i => i.addEventListener('input', () => setErr(i.id, '')));
}
$('#auth-sub').addEventListener('click', e => { const b = e.target.closest('[data-mode]'); if (b) renderAuth(b.dataset.mode); });
function setErr(id, msg) { const f = $('#f-' + id); if (!f) return; f.classList.toggle('err', !!msg); const m = $('#m-' + id); if (m) m.textContent = msg; const i = $('#' + id); if (i) i.setAttribute('aria-invalid', msg ? 'true' : 'false'); }
function formErr(msg, kind = 'err') { $('#formerr').innerHTML = msg ? `<div class="${kind === 'info' ? 'formok' : 'formerr'}">${ICO(kind === 'info' ? 'info' : 'alert', 'sm')}<span>${esc(msg)}</span></div>` : ''; }
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
async function onAuthSubmit(e) {
  e.preventDefault(); formErr('');
  const v = id => ($('#' + id) ? $('#' + id).value.trim() : ''); let ok = true;
  const need = (id, cond, msg) => { if (!cond) { setErr(id, msg); ok = false; } else setErr(id, ''); };
  if (authMode === 'masuk') {
    need('email', EMAIL_RE.test(v('email')), 'Format email belum benar, contoh: nama@email.com'); need('pass', v('pass').length >= 8, 'Kata sandi minimal 8 karakter'); if (!ok) return;
    if (BE.on) { const btn = $('#authform [type=submit]'); btn.disabled = true; btn.textContent = 'Memeriksa…'; const r = await BE.signIn(v('email').toLowerCase(), $('#pass').value); btn.disabled = false; btn.textContent = 'Masuk'; if (r.error) { formErr(r.error); return; } login(r.sess, $('#remember').checked); return; }
    const email = v('email').toLowerCase(); const users = store.get('jelajah.users', []); const demo = DEMO.find(d => d.email === email); const user = users.find(u => u.email === email);
    let acc = null; if (demo && v('pass') === demo.pass) acc = demo; else if (user && user.hash === await hashPass(v('pass'))) acc = user;
    if (!acc) { formErr(demo || user ? 'Kata sandi salah. Coba lagi atau pakai akun demo di bawah.' : 'Email ini belum terdaftar. Daftar dulu, atau pakai akun demo di bawah.'); return; }
    login({ email: acc.email, name: acc.name, role: acc.role }, $('#remember').checked);
  } else {
    need('name', v('name').length >= 2, 'Isi nama minimal 2 huruf'); need('email', EMAIL_RE.test(v('email')), 'Format email belum benar, contoh: nama@email.com'); need('pass', v('pass').length >= 8, 'Kata sandi minimal 8 karakter');
    if (!$('#agree').checked) { setErr('agree', 'Centang persetujuan untuk melanjutkan'); ok = false; } else setErr('agree', '');
    if (!ok) return;
    if (BE.on) { const btn = $('#authform [type=submit]'); btn.disabled = true; btn.textContent = 'Membuat akun…'; const r = await BE.signUp(v('name'), v('email').toLowerCase(), $('#pass').value); btn.disabled = false; btn.textContent = 'Buat akun'; if (r.error) { r.field ? setErr(r.field, r.error) : formErr(r.error); return; } if (r.confirm) { renderAuth('masuk'); $('#email').value = v('email') || ''; formErr('Akun dibuat. Buka tautan konfirmasi yang kami kirim ke email kamu, lalu masuk di sini.', 'info'); return; } login(r.sess, true); toast('Akun dibuat. Selamat menjelajah, ' + r.sess.name.split(' ')[0] + '!'); return; }
    const email = v('email').toLowerCase(); const users = store.get('jelajah.users', []);
    if (users.some(u => u.email === email) || DEMO.some(d => d.email === email)) { setErr('email', 'Email ini sudah terdaftar. Silakan masuk.'); return; }
    users.push({ email, name: v('name'), role: 'pengunjung', hash: await hashPass(v('pass')) }); store.set('jelajah.users', users);
    login({ email, name: v('name'), role: 'pengunjung' }, true); toast('Akun dibuat. Selamat menjelajah, ' + v('name').split(' ')[0] + '!');
  }
}
function login(sess, remember) {
  session = sess;
  if (BE.on) { if (sess.role === 'pengelola') BE.loadManagerData().then(() => { if (currentView === 'admin') enterAdmin(adminPage); }); }
  else if (remember) store.set('jelajah.session', sess); else { store.del('jelajah.session'); store.sset('jelajah.session', sess); }
  if (sess.role === 'pengelola') { go('admin'); toast('Masuk sebagai pengelola. Konsol dibuka.'); } else go('app');
}
function logout() { if (BE.on) { BE.signOut(); st.log = []; } session = null; store.del('jelajah.session'); store.sdel('jelajah.session'); st.chat = []; setUserLoc(null); toast('Kamu sudah keluar'); go('landing'); }

// ============================================================
// VISITOR WEB APP
// ============================================================
const sideEl = $('#side'); let sideCur = { v: 'home', p: {} }; const sideStack = [];
function enterApp() {
  $('#btn-avatar').textContent = initials(session ? session.name : '');
  const locId = pendingQR || (session && U.loc); if (locId && QMAP[locId]) setUserLoc(QMAP[locId]);
  if (pendingQR) { U.setLoc(pendingQR); toast('Lokasi dari QR: ' + QMAP[pendingQR].name); pendingQR = null; }
  setTab('home'); if (st.user) S.flyToPoint(st.user.pos, { dist: 74 }); else S.overview();
  const last = st.annc[0]; if (last && !last.seenByVisitor) { showBanner(last.text, last.t); last.seenByVisitor = true; saveOps(); }
}
function setTab(t) {
  $$('.wtabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  sideStack.length = 0; show(t === 'home' ? 'home' : t, {}, false);
}
$('.wtabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab); });
$('.wnav .logo').addEventListener('click', e => { e.preventDefault(); setTab('home'); });
function clearRouteState() { if (st.route || st.plan) { st.route = null; st.plan = null; S.clearRoute(); clearStopPins(); } }
function show(v, p = {}, push = true) {
  if (push) sideStack.push(sideCur); sideCur = { v, p };
  if (!['route', 'planres'].includes(v)) clearRouteState();
  if (!['zone', 'poi', 'route'].includes(v)) { st.sel = null; S.select(null); }
  const R = { home: sideHome, zone: sideZone, poi: sidePoi, route: sideRoute, list: sideList, plan: sidePlan, planres: sidePlanRes, jadwal: sideJadwal, tiket: sideTiket, akun: sideAkun }[v];
  const mt = `<nav class="mtabs" aria-label="Menu">${[['home', 'map', 'Jelajah'], ['plan', 'route', 'Rencana'], ['jadwal', 'calendar', 'Jadwal'], ['tiket', 'ticket', 'Tiket']].map(([k, i, l]) => `<button data-mt="${k}" class="${(v === k || (k === 'home' && !['plan', 'jadwal', 'tiket'].includes(v))) ? 'on' : ''}">${ICO(i, 'sm')}${l}</button>`).join('')}</nav>`;
  sideEl.innerHTML = mt + `<div class="sp">${R(p)}</div>`; sideEl.scrollTop = 0;
  $$('[data-mt]', sideEl).forEach(b => b.onclick = () => setTab(b.dataset.mt));
  attachViewer(); refreshPins();
}
function back() { const prev = sideStack.pop(); show(prev ? prev.v : 'home', prev ? prev.p : {}, false); }
const head = (title) => `<div class="sp-h"><button class="iconbtn" data-act="back" aria-label="Kembali">${ICO('back')}</button><span class="ttl">${esc(title)}</span><button class="iconbtn" data-act="home" aria-label="Ke beranda" style="margin-left:auto">${ICO('x', 'sm')}</button></div>`;

function sideHome() {
  const n = wib(); const first = session ? session.name.split(' ')[0] : 'Penjelajah'; const seen = U.seen, fav = U.fav, plans = U.plans;
  const quick = [['toilet', 'Toilet'], ['ibadah', 'Mushola'], ['kuliner', 'Makan'], ['p3k', 'P3K']].map(([t, l]) => { const nn = nearestOf(t); return `<button data-quick="${nn ? nn.p.id : ''}" ${nn ? '' : 'disabled'}><span class="ric" style="--c:${POI_T[t].color}">${ICO(POI_T[t].icon)}</span>${l}<small>${nn ? Math.max(1, Math.round(nn.u * 5 / 66)) + ' mnt' : '–'}</small></button>`; }).join('');
  const heroes = ['komodo', 'harimau', 'gajah', 'jerapah', 'orangutan', 'bekantan'].map(id => AMAP[id]).map(a => { const z = ZMAP[a.zone]; const w = walk(target('z', z.id)); return `<button class="nrow" data-open="z:${z.id}"><span class="ric" style="--c:var(--leaf)">${ICO('paw')}</span><span>${esc(a.name)}<small>${esc(z.name)}</small></span><span class="iucn ${a.iucn}">${a.iucn}</span><small>${w.min} mnt</small></button>`; }).join('');
  return `<div class="hello"><h2>Halo, ${esc(first)}</h2><p>${DAYS[n.day]}, ${n.date} ${MONTHS[n.month]} · ${hhmm(n.min)} WIB ${isOpenNow() ? `<span class="pill ok">${ICO('check')}Buka s.d. 16.00</span>` : `<span class="pill bad">${ICO('clock')}Tutup · buka 08.00</span>`}</p></div>
  ${st.user ? `<div class="loccard"><span class="dotblue"></span><span><b>Anda di ${esc(st.user.name)}</b><small>Lokasi dari QR</small></span><button class="btn sm ghost" data-act="qr">${ICO('qr', 'sm')}Ganti</button></div>` : `<div class="loccard empty">${ICO('qr')}<span><b>Lokasi belum diketahui</b><small>Pindai QR di papan informasi supaya jarak & rute akurat</small></span><button class="btn sm mango" data-act="qr">Pindai</button></div>`}
  ${st.annc.length ? `<div class="tip">${ICO('megaphone')}<span><b>Info pengelola · ${esc(st.annc[0].t)}</b><br>${esc(st.annc[0].text)}</span></div>` : ''}
  <div class="sect">Butuh sekarang <span>dari ${esc(startName())}</span></div><div class="quick">${quick}</div>
  <div class="sect">Satwa unggulan</div><div>${heroes}</div>
  <div class="sect">Paspor satwa</div><div class="passport"><span><b>${seen.size}</b> <small>dari ${DATA.animals.length} satwa sudah kamu lihat</small></span><div class="bar"><i style="width:${seen.size / DATA.animals.length * 100}%"></i></div>${seen.size ? `<div class="stamps">${[...seen].slice(-6).map(id => AMAP[id] ? `<span>${esc(AMAP[id].name)}</span>` : '').join('')}</div>` : '<small>Buka zona satwa lalu tekan "Sudah lihat" di kartu satwa.</small>'}</div>
  <div class="sect">Favorit</div>${fav.size ? `<div class="favs">${[...fav].map(id => ZMAP[id] ? `<button data-open="z:${id}">${ICO('heart')}${esc(PIN_NAME[id] || ZMAP[id].name)}</button>` : '').join('')}</div>` : '<p class="empty-note">Tekan ikon hati di halaman zona untuk menyimpan favorit.</p>'}
  ${plans.length ? `<div class="sect">Rencana tersimpan</div>${plans.map((p, i) => `<button class="nrow" data-saved="${i}"><span class="ric" style="--c:#ff6a2b">${ICO('bookmark')}</span><span>${esc(p.title)}<small>${p.stops.length} zona · disimpan ${esc(p.saved)}</small></span>${ICO('chev', 'sm')}</button>`).join('')}` : ''}`;
}
function statusPillW(z) {
  if (st.closedZones.has(z.id)) return `<span class="pill bad">${ICO('alert')}Tutup sementara</span>`;
  if (z.cat === 'staf') return `<span class="pill">${ICO('lock')}Area non-publik</span>`;
  if (z.status === 'cek') return `<span class="pill warn">${ICO('info')}Status perlu dicek</span>`;
  return isOpenNow() ? `<span class="pill ok">${ICO('check')}Buka · s.d. 16.00</span>` : `<span class="pill">${ICO('clock')}Buka 08.00</span>`;
}
function sideZone({ id }) {
  const z = ZMAP[id]; const w = walk(target('z', id)); const animals = (z.animals || []).map(a => AMAP[a]).filter(Boolean); const seen = U.seen, fav = U.fav;
  const heroAn = z.hero ? DATA.animals.find(a => a.model === z.hero || a.id === z.hero) : animals.find(a => modelFor(a)); const model = heroAn ? modelFor(heroAn) : null;
  const near = z.cat === 'staf' ? [] : ['toilet', 'ibadah', 'kuliner'].map(t => nearestOf(t, fromNode(z.node))).filter(Boolean); const ver = st.verified.has('z:' + id);
  return `${head(CAT[z.cat].label)}<div class="dt"><div class="dt-eyebrow" style="--c:${CAT[z.cat].color}">${ICO(z.icon || 'paw', 'sm')}${CAT[z.cat].label}</div><h2>${esc(z.name)}</h2></div>
  <div class="pills">${statusPillW(z)}<span class="pill price">${ICO('ticket')}${esc(z.price)}</span></div>
  ${z.cat !== 'staf' ? `<div class="meta"><span>${ICO('walk', 'sm')}<b>${w.ok ? w.min + ' mnt' : '–'}</b> · ${w.ok ? fmtD(w.m) : 'jalur ditutup'} dari ${esc(startName())}</span>${z.dwell ? `<span>${ICO('clock', 'sm')}±${z.dwell} mnt di sini</span>` : ''}</div>` : ''}
  ${model ? `<div class="viewer" data-model="${model}"><span class="vtag">${ICO('cube', 'sm')}${esc(heroAn.name)} · seret untuk memutar</span></div>` : ''}
  ${z.cat !== 'staf' ? `<div class="actions"><button class="btn primary" data-act="route" data-k="z" data-id="${id}">${ICO('route')}Rute ke sini</button><button class="btn icon fav ${fav.has(id) ? 'on' : ''}" data-act="fav" data-id="${id}" aria-pressed="${fav.has(id)}" aria-label="${fav.has(id) ? 'Hapus dari favorit' : 'Simpan ke favorit'}" title="Favorit">${ICO('heart')}</button><button class="btn icon" data-act="kobi" data-q="Ceritakan tentang ${esc(z.name)} dan tips berkunjungnya." aria-label="Tanya Kobi" title="Tanya Kobi">${KOBI()}</button><button class="btn icon" data-act="speak" data-text="${esc(z.name + '. ' + z.desc + ' ' + (z.tips || ''))}" aria-label="Dengarkan">${ICO('volume')}</button></div>` : ''}
  <p class="desc">${esc(z.desc)}</p>${z.tips ? `<div class="tip">${ICO('sparkle')}<span>${esc(z.tips)}</span></div>` : ''}
  ${animals.length ? `<div class="sect">Satwa di sini <span>ketuk untuk fakta</span></div><div class="acards">${animals.map(a => `<div class="acard ${seen.has(a.id) ? 'isseen' : ''}" data-act="animal" data-id="${a.id}" role="button" tabindex="0"><span class="iucn ${a.iucn}">${a.iucn === 'DOM' ? 'DOMESTIK' : a.iucn + ' · ' + IUCN[a.iucn]}</span><b>${esc(a.name)}</b><i>${esc(a.latin)}</i><p>${esc(a.fact)}</p><button class="seen ${seen.has(a.id) ? 'on' : ''}" data-act="seen" data-id="${a.id}">${ICO('stamp', 'sm')}${seen.has(a.id) ? 'Sudah dilihat' : 'Sudah lihat'}</button></div>`).join('')}</div>` : ''}
  ${near.length ? `<div class="sect">Fasilitas terdekat</div><div>${near.map(n => { const t = POI_T[n.p.type]; return `<button class="nrow" data-open="p:${n.p.id}"><span class="ric" style="--c:${t.color}">${ICO(t.icon)}</span><span>${esc(n.p.name)}</span><small>${fmtD(n.u * 5)}</small>${ICO('chev', 'sm')}</button>`; }).join('')}</div>` : ''}
  <div class="datafoot ${ver ? 'ok' : ''}">${ICO(ver ? 'shield' : 'info')}${ver ? 'Lokasi sesuai denah & sumber publik' : 'Belum diverifikasi pengelola'} · data ${DATA.meta.dataAsOf}</div>`;
}
function sidePoi({ id }) {
  const p = PMAP[id]; const t = POI_T[p.type]; const w = walk(target('p', id)); const closed = st.closedPois.has(id); const ver = st.verified.has('p:' + id);
  const zn = ZONES.filter(z => z.cat !== 'staf').map(z => ({ z, d: dist2(z.pos, p.pos) })).sort((a, b) => a.d - b.d)[0];
  return `${head(t.label)}<div class="dt"><div class="dt-eyebrow" style="--c:${t.color}">${ICO(t.icon, 'sm')}${t.label}</div><h2>${esc(p.name)}</h2></div>
  <div class="pills">${closed ? `<span class="pill bad">${ICO('alert')}Ditutup sementara</span>` : `<span class="pill ok">${ICO('check')}Tersedia</span>`}<span class="pill ${ver ? 'ok' : 'warn'}">${ICO(ver ? 'shield' : 'info')}${ver ? 'Terverifikasi' : 'Lokasi belum diverifikasi'}</span></div>
  <div class="meta"><span>${ICO('walk', 'sm')}<b>${w.min} mnt</b> · ${fmtD(w.m)} dari ${esc(startName())}</span></div>
  <div class="actions"><button class="btn primary" data-act="route" data-k="p" data-id="${id}" ${closed ? 'disabled' : ''}>${ICO('route')}Rute ke sini</button><button class="btn" data-act="kobi" data-q="Apa yang perlu saya tahu tentang ${esc(p.name)}?">${KOBI('ico')}Tanya Kobi</button></div>
  ${zn ? `<div class="sect">Dekat dengan</div><button class="nrow" data-open="z:${zn.z.id}"><span class="ric" style="--c:${CAT[zn.z.cat].color}">${ICO(zn.z.icon || 'paw')}</span><span>${esc(zn.z.name)}</span><small>${fmtD(zn.d * 5)}</small>${ICO('chev', 'sm')}</button>` : ''}
  <div class="datafoot">${ICO('info')}Posisi pada prototipe bersifat ilustratif. Pengelola memperbaruinya lewat konsol.</div>`;
}
function sideList({ title, items }) {
  const rows = items.map(it => { const isZ = it.k === 'z'; const o = isZ ? ZMAP[it.id] : PMAP[it.id]; const t = isZ ? { icon: o.icon || 'paw', color: CAT[o.cat].color } : POI_T[o.type]; return { it, o, t, w: walk(target(it.k, it.id)) }; }).sort((a, b) => a.w.m - b.w.m);
  return `${head('Kategori')}<div class="dt"><div class="dt-eyebrow">${ICO('locate', 'sm')}Diurutkan dari ${esc(startName())}</div><h2>${esc(title)}</h2></div>
  <div>${rows.map(({ it, o, t, w }) => `<button class="nrow" data-open="${it.k}:${it.id}"><span class="ric" style="--c:${t.color}">${ICO(t.icon)}</span><span>${esc(o.name)}${(it.k === 'z' ? st.closedZones.has(o.id) : st.closedPois.has(o.id)) ? '<small style="color:var(--coral)">Tutup sementara</small>' : ''}</span><small>${w.min} mnt · ${fmtD(w.m)}</small>${ICO('chev', 'sm')}</button>`).join('')}</div>`;
}
function sideRoute({ t }) {
  const r = st.route ? st.route.r : null; if (!r) return `${head('Rute')}<p class="empty-note">Rute tidak tersedia.</p>`;
  const base = pathPts(startPos(), t, { access: st.avoidStairs, ignoreClosed: true }); const detour = base && r.m - base.m > 10 ? r.m - base.m : 0; const lm = landmarksOf(r.nodes, t.id);
  return `${head('Rute jalan kaki')}<div class="dt"><div class="dt-eyebrow" style="--c:#ff6a2b">${ICO('route', 'sm')}Rute jalan kaki</div><h2>Ke ${esc(t.name)}</h2></div>
  <div class="rsum"><div><b>${r.min}</b><small>menit</small></div><div><b>${fmtD(r.m).replace(/ k?m$/, '')}</b><small>${r.m < 1000 ? 'meter' : 'km'}</small></div><div><b>${fmtN(Math.round(r.m * 1.35))}</b><small>langkah</small></div></div>
  ${detour ? `<div class="tip">${ICO('alert')}<span>Jalur ${[...st.closedEdges].map(e => e === 'jembatan' ? 'Jembatan Cinta' : e).join(', ')} ditutup pengelola. Rute dialihkan, +${fmtD(detour)}.</span></div>` : ''}
  <label class="toggle">${ICO('wheelchair')}<span>Ramah kursi roda & stroller<br><small style="color:var(--ink-3);font-weight:500">Hindari tangga dan jembatan</small></span><input type="checkbox" class="switch" data-act="access" ${st.avoidStairs ? 'checked' : ''}></label>
  <ol class="steps-v"><li><span class="sv start">${ICO('locate')}</span><span class="st"><b>${esc(startName())}</b><small>Titik awal${st.user ? ' (dari QR)' : ''}</small></span></li>
  ${lm.map(z => `<li><span class="sv">${ICO(z.id === '_bridge' ? 'stairs' : 'walk')}</span><span class="st"><b>Lewati ${esc(z.name)}</b><small>${z.id === '_bridge' ? 'Jembatan bertangga' : 'Penanda arah'}</small></span></li>`).join('')}
  <li><span class="sv end">${ICO('flag')}</span><span class="st"><b>${esc(t.name)}</b><small>Tiba ±${hhmm(wib().min + r.min)} WIB</small></span></li></ol>`;
}
// pilihan perencana versi web (versi HP tetap memakai st.planner.interests)
Object.assign(st.planner, { group: new Set(['dewasa']), cats: new Set(), acts: new Set(), langka: false, pace: 'auto' });
const webPlanPrefs = () => { const p = st.planner; return { group: p.group, cats: p.cats, acts: p.acts, langka: p.langka, minutes: p.minutes, pace: p.pace === 'auto' ? null : p.pace, access: st.avoidStairs }; };
const PL_GROUP_ICO = { dewasa: 'user', balita: 'baby', anak: 'users', remaja: 'user', lansia: 'users' };
const PL_CAT_ICO = { kucing: 'paw', primata: 'paw', burung: 'bird', reptil: 'paw', savana: 'leaf', air: 'fish', interaksi: 'heart' };
const PL_ACT_ICO = { wahana: 'ride', show: 'film', foto: 'camera' };
function sidePlan() {
  const p = st.planner, on = (set, k) => `aria-pressed="${set.has(k)}"`;
  const opt = (pk, k, label, ico, pressed) => `<button class="opt" data-k="${k}" ${pressed}>${ICO(ico)}${esc(label)}</button>`;
  return `<div class="dt"><div class="dt-eyebrow" style="--c:#ff6a2b">${ICO('sparkle', 'sm')}Itinerary otomatis</div><h2>Susun kunjungan sesuai rombonganmu</h2></div>
  <div class="loccard ${st.user ? '' : 'empty'}"><span class="dotblue"></span><span><b>Mulai dari ${esc(startName())}</b><small>${st.user ? 'Lokasi dari QR' : 'Belum pindai QR, dianggap dari pintu utama'}</small></span><button class="btn sm ghost" data-act="qr">${ICO('qr', 'sm')}Ganti</button></div>
  <div class="sect">Siapa saja yang ikut? <span>pilih semua yang sesuai</span></div>
  <div class="opts" data-pk="group">${PLAN_GROUP_KEYS.map(k => opt('group', k, PLAN.groups[k].label, PL_GROUP_ICO[k], on(p.group, k))).join('')}</div>
  <label class="toggle">${ICO('wheelchair')}<span>Pakai kursi roda / stroller<small style="display:block;font-weight:500;color:var(--ink-3)">Hindari tangga & wahana yang sulit diakses</small></span><input type="checkbox" class="switch" id="pl-acc" ${st.avoidStairs ? 'checked' : ''}></label>
  <div class="sect">Satwa yang ingin dilihat <span>kosongkan = semua</span></div>
  <div class="opts" data-pk="cats">${Object.entries(PLAN.categories).map(([k, l]) => opt('cats', k, l, PL_CAT_ICO[k] || 'paw', on(p.cats, k))).join('')}${opt('cats', 'langka', 'Satwa langka', 'shield', `aria-pressed="${p.langka}"`)}</div>
  <div class="sect">Kegiatan lain</div>
  <div class="opts" data-pk="acts">${Object.entries(PLAN_ACTS).map(([k, l]) => opt('acts', k, l, PL_ACT_ICO[k], on(p.acts, k))).join('')}</div>
  <div class="sect">Waktu tersedia</div>
  <div class="seg" data-pk="minutes">${PLAN_DURS.map(([m, l]) => `<button class="opt" data-k="${m}" aria-pressed="${String(p.minutes) === String(m)}">${l}</button>`).join('')}</div>
  <div class="sect">Tempo jalan</div>
  <div class="seg" data-pk="pace">${[['auto', 'Otomatis'], ...Object.entries(PLAN_PACE).map(([k, v]) => [k, v.label])].map(([k, l]) => `<button class="opt" data-k="${k}" aria-pressed="${p.pace === k}">${l}</button>`).join('')}</div>
  <button class="btn primary lg block" data-act="runplan">${ICO('sparkle')}Susun itinerary</button>
  <p class="fine">Batas usia wahana dan akses kursi roda masih perkiraan. Pastikan lagi di loket. Kobi juga bisa menyusun itinerary lewat obrolan.</p>
  ${U.plans.length ? `<div class="sect">Rencana tersimpan</div>${U.plans.map((pl, i) => `<button class="nrow" data-saved="${i}"><span class="ric" style="--c:#ff6a2b">${ICO('bookmark')}</span><span>${esc(pl.title)}<small>${pl.stops.length} zona · ${esc(pl.saved)}</small></span>${ICO('chev', 'sm')}</button>`).join('')}` : ''}`;
}
function runPlan(arg) {
  const res = arg && arg.stops && arg.prefs ? arg : Array.isArray(arg) ? planFixed(arg.map(s => s.id || s), webPlanPrefs()) : planItinerary(webPlanPrefs());
  if (!res.stops.length) { toast('Waktunya terlalu singkat atau syaratnya terlalu ketat. Coba tambah durasi.'); return; }
  clearRouteState(); st.plan = planGeometry(res); S.setRoute(st.plan.pts); S.frameRoute(st.plan.pts, {});
  st.plan.stops.forEach((s, i) => { const z = ZMAP[s.id]; mkPin('stop:' + i, `<div class="stoppin">${i + 1}</div>`, [z.pos[0], (PIN_Y[z.id] || 2.4) + 2.2, z.pos[1]]); });
  $$('.wtabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === 'plan'));
  if (currentView === 'app') { if (!kobiEl.hidden && MQ_MOBILE.matches) kobiEl.hidden = true; show('planres'); } refreshPins();
}
function sidePlanRes() {
  const P = st.plan; if (!P) return `${head('Rencana')}<p class="empty-note">Belum ada rencana.</p>`; const dur = P.end - P.start;
  const why = s => s.why.length ? `<span class="why">${s.why.map(w => `<i>${esc(w)}</i>`).join('')}</span>` : '';
  return `${head('Itinerary')}<div class="dt"><div class="dt-eyebrow" style="--c:#ff6a2b">${ICO('sparkle', 'sm')}Itinerary kunjungan</div><h2>${P.stops.length} zona dalam ${Math.floor(dur / 60) ? Math.floor(dur / 60) + ' jam ' : ''}${dur % 60 ? (dur % 60) + ' mnt' : ''}</h2><p class="fine" style="margin:4px 0 0">${esc(P.desc)}</p></div>
  <div class="rsum"><div><b>${hhmm(P.start)}</b><small>mulai${P.future ? ' (saat buka)' : ''}</small></div><div><b>${fmtD(P.totalM).replace(/ k?m$/, '')}</b><small>${P.totalM < 1000 ? 'meter' : 'km'} jalan</small></div><div><b>${hhmm(P.end)}</b><small>selesai</small></div></div>
  <ol class="steps-v"><li><span class="sv start">${ICO('locate')}</span><span class="st"><b>${esc(startName())}</b><small>Titik awal</small></span></li>
  ${P.stops.map((s, i) => { const z = ZMAP[s.id]; return `<li><span class="sv stop">${i + 1}</span><span class="st"><b>${esc(z.name)}</b><small>${s.walk} mnt jalan${s.wait ? ` · tunggu ${s.wait} mnt` : ''} · ±${s.dwell} mnt · ${esc(z.price)}</small>${why(s)}</span><span class="tm">${hhmm(s.arrive)}</span></li>` +
    (s.rest ? `<li><span class="sv">${ICO('food', 'sm')}</span><span class="st"><b>Istirahat ${PLAN.restMin} mnt</b><small>${esc(s.rest.food ? s.rest.food.name : 'Tempat duduk terdekat')}${s.rest.toilet ? ' · toilet: ' + esc(s.rest.toilet.name) : ''}</small></span></li>` : ''); }).join('')}
  <li><span class="sv end">${ICO('flag')}</span><span class="st"><b>${esc(ZMAP[P.exit].name)}</b><small>Pintu keluar terdekat</small></span><span class="tm">${hhmm(P.end)}</span></li></ol>
  ${P.excluded.length ? `<details class="excl"><summary>Tidak dimasukkan (${P.excluded.length})</summary><ul>${P.excluded.map(x => `<li><b>${esc(x.name)}</b> · ${esc(x.why)}</li>`).join('')}</ul></details>` : ''}
  <div class="actions"><button class="btn" data-act="saveplan">${ICO('bookmark')}Simpan</button><button class="btn" data-act="editplan">${ICO('edit')}Ubah</button><button class="btn primary" data-open="z:${P.stops[0].id}">${ICO('play')}Mulai</button></div>`;
}
function sideJadwal() {
  const n = wib(), now = n.min, open = isOpenNow();
  return `<div class="dt"><div class="dt-eyebrow" style="--c:var(--water)">${ICO('calendar', 'sm')}${DAYS[n.day]}, ${n.date} ${MONTHS[n.month]} · ${hhmm(now)} WIB</div><h2>Jadwal hari ini</h2></div>
  <div class="pills">${open ? `<span class="pill ok">${ICO('check')}Buka s.d. 16.00</span>` : `<span class="pill bad">${ICO('clock')}Tutup · buka 08.00</span>`}</div>
  <div>${DATA.schedule.map((s, i) => { const t = toMin(s.t), live = now >= t && now < t + s.dur, past = now >= t + s.dur; const z = ZMAP[s.zone]; const inMin = t - now; return `<div class="ev ${live ? 'live' : ''} ${past ? 'past' : ''}"><div class="t">${s.t.replace(':', '.')}<small>${s.dur} mnt</small></div><div>${live ? '<span class="badge-live">Sedang berlangsung</span>' : (!past && open && inMin < 120 ? `<span class="pill warn">${ICO('clock')}${inMin} mnt lagi</span>` : '')}<b>${esc(s.title)}</b><span class="where">${esc(z ? z.name : s.zone)}${z ? ' · ' + walk(target('z', z.id)).min + ' mnt jalan' : ''}</span><span class="note">${esc(s.note)}</span><div class="evact">${z ? `<button class="btn sm" data-act="route" data-k="z" data-id="${z.id}">${ICO('route', 'sm')}Rute</button>` : ''}<button class="btn sm ${st.reminders.has(i) ? 'mango' : 'ghost'}" data-rem="${i}">${ICO('bell', 'sm')}${st.reminders.has(i) ? 'Diingatkan' : 'Ingatkan'}</button></div></div></div>`; }).join('')}</div>
  <p class="fine">Contoh jadwal dari sumber publik. Jadwal resmi diisi pengelola lewat konsol.</p>`;
}
function sideTiket() {
  const T = DATA.tickets, M = DATA.meta;
  return `<div class="dt"><div class="dt-eyebrow" style="--c:var(--mango-deep)">${ICO('ticket', 'sm')}${M.hours.open.replace(':', '.')}–${M.hours.close.replace(':', '.')} WIB · setiap hari</div><h2>Tiket & info</h2></div>
  <div class="cashless">${ICO('qr')}<span><b>Non-tunai saja</b>Loket & parkir menerima QRIS dan Brizzi.</span></div>
  <div class="box"><h3>Tiket masuk</h3>${T.entry.map(e => `<div class="prow"><span>${esc(e.label)}${e.note ? `<small>${esc(e.note)}</small>` : ''}</span><b>${esc(e.price)}</b></div>`).join('')}</div>
  <div class="box"><h3>Paket terusan</h3>${T.bundles.map(b => `<div class="bundle"><span class="code">${b.code}</span><small>${esc(b.items)}</small><b>${esc(b.price)}</b></div>`).join('')}</div>
  <div class="box"><h3>Wahana & aktivitas</h3>${T.rides.map(e => `<div class="prow"><span>${esc(e.label)}</span><b>${esc(e.price)}</b></div>`).join('')}</div>
  <div class="box"><h3>Parkir</h3>${T.parking.map(e => `<div class="prow"><span>${esc(e.label)}</span><b>${esc(e.price)}</b></div>`).join('')}</div>
  <div class="box"><h3>Kontak KBS</h3><div class="prow"><span>Telepon</span><b style="user-select:all">${esc(M.contact.phone)}</b></div><div class="prow"><span>Instagram</span><b style="user-select:all">${esc(M.contact.ig)}</b></div><div class="prow"><span>Alamat</span><span style="text-align:right">${esc(M.address)}</span></div></div>
  <p class="fine">${esc(T.asOf)}</p>`;
}
function sideAkun() {
  const seen = U.seen, fav = U.fav, plans = U.plans;
  return `${head('Akun saya')}<div class="profile"><span class="avatar">${initials(session.name)}</span><span><b>${esc(session.name)}</b><small>${esc(session.email)} · ${session.role === 'pengelola' ? 'Pengelola (pratinjau)' : 'Pengunjung'}</small></span></div>
  <div class="mini3"><div><b>${seen.size}</b><small>satwa dilihat</small></div><div><b>${fav.size}</b><small>favorit</small></div><div><b>${plans.length}</b><small>rencana</small></div></div>
  <div class="sect">Paspor satwa</div><div class="passport"><span><b>${seen.size}/${DATA.animals.length}</b> <small>satwa</small></span><div class="bar"><i style="width:${seen.size / DATA.animals.length * 100}%"></i></div>${seen.size ? `<div class="stamps">${[...seen].map(id => AMAP[id] ? `<span>${esc(AMAP[id].name)}</span>` : '').join('')}</div>` : ''}</div>
  ${session.role === 'pengelola' ? `<button class="btn primary block" data-act="toadmin">${ICO('building')}Kembali ke konsol pengelola</button>` : ''}
  ${BE.on ? `<div class="sect">Nilai kunjunganmu</div><div class="rate" style="display:flex;gap:8px;margin-bottom:14px">${[1, 2, 3, 4, 5].map(n => `<button class="btn sm ghost" style="flex:1" data-act="rate" data-id="${n}" aria-label="Nilai ${n} dari 5">${n}</button>`).join('')}</div>` : ''}
  <button class="btn ghost block" data-act="logout">${ICO('logout')}Keluar</button>
  <p class="fine">${BE.on ? 'Akun, favorit, rencana, dan paspor satwamu tersimpan di server Jelajah KBS, jadi tetap ada saat kamu masuk dari perangkat lain.' : 'Data akun di prototype ini disimpan di browser kamu saja. Versi produksi memakai Supabase Auth & database.'}</p>`;
}

// panel events
sideEl.addEventListener('click', e => {
  const t = e.target.closest('[data-act],[data-open],[data-quick],[data-saved],[data-rem],[data-pk] .opt'); if (!t) return;
  if (t.matches('[data-pk] .opt')) {
    const pk = t.parentElement.dataset.pk, k = t.dataset.k, p = st.planner;
    if (pk === 'minutes' || pk === 'pace') { p[pk] = pk === 'minutes' && k !== 'tutup' ? +k : k; $$('.opt', t.parentElement).forEach(o => o.setAttribute('aria-pressed', o === t)); return; }
    if (pk === 'cats' && k === 'langka') p.langka = !p.langka;
    else { const set = p[pk]; set.has(k) ? set.delete(k) : set.add(k); if (pk === 'group' && !set.size) set.add('dewasa'); }
    $$('.opt', t.parentElement).forEach(o => o.setAttribute('aria-pressed', pk === 'cats' && o.dataset.k === 'langka' ? p.langka : p[pk].has(o.dataset.k)));
    return;
  }
  if (t.dataset.open) { const [k, id] = t.dataset.open.split(':'); k === 'z' ? openZone(id) : openPoi(id); return; }
  if (t.dataset.quick) { showRoute(target('p', t.dataset.quick)); return; }
  if (t.dataset.saved !== undefined) { const p = U.plans[+t.dataset.saved]; if (p) runPlan(p.stops.slice()); return; }
  if (t.dataset.rem !== undefined) { const i = +t.dataset.rem; if (st.reminders.has(i)) st.reminders.delete(i); else { st.reminders.add(i); toast('Pengingat dipasang 10 menit sebelum ' + DATA.schedule[i].title.toLowerCase()); } show('jadwal', {}, false); return; }
  const a = t.dataset.act, id = t.dataset.id;
  if (a === 'back') back(); else if (a === 'home') setTab('home');
  else if (a === 'route') showRoute(target(t.dataset.k, id));
  else if (a === 'fav') { const f = U.fav; f.has(id) ? f.delete(id) : f.add(id); U.setFav(f); toast(f.has(id) ? 'Disimpan ke favorit' : 'Dihapus dari favorit'); show('zone', { id }, false); }
  else if (a === 'seen') { e.stopPropagation(); const s = U.seen; s.has(id) ? s.delete(id) : s.add(id); U.setSeen(s); if (s.has(id)) toast(`Cap paspor: ${AMAP[id].name} (${s.size}/${DATA.animals.length})`); const card = t.closest('.acard'); card.classList.toggle('isseen', s.has(id)); t.classList.toggle('on', s.has(id)); t.innerHTML = ICO('stamp', 'sm') + (s.has(id) ? 'Sudah dilihat' : 'Sudah lihat'); }
  else if (a === 'animal') { const was = t.classList.contains('open'); $$('.acard', sideEl).forEach(c => c.classList.remove('open')); if (!was) t.classList.add('open'); const m = modelFor(AMAP[id]); if (m && viewer) viewer.show(m); }
  else if (a === 'kobi') { openKobi(); sendKobi(t.dataset.q); }
  else if (a === 'speak') speak(t.dataset.text || '');
  else if (a === 'qr') openQR();
  else if (a === 'runplan') { st.avoidStairs = $('#pl-acc').checked; dcache = null; runPlan(); }
  else if (a === 'saveplan') { const P = st.plan; const plans = U.plans; const n = wib(); plans.unshift({ title: `${P.stops.length} zona · ${Math.round((P.end - P.start) / 60 * 10) / 10} jam`.replace('.', ','), stops: P.stops.map(s => s.id), saved: `${n.date} ${MONTHS[n.month]} ${hhmm(n.min)}` }); U.setPlans(plans.slice(0, 8)); toast('Rencana disimpan ke akunmu'); }
  else if (a === 'logout') logout(); else if (a === 'toadmin') go('admin');
  else if (a === 'editplan') show('plan');
  else if (a === 'rate') { $$('[data-act="rate"]', sideEl).forEach(b => b.disabled = true); BE.rate(+id).then(ok => toast(ok ? 'Terima kasih! Penilaianmu membantu pengelola KBS.' : 'Penilaian belum terkirim. Coba lagi nanti.')); }
});
sideEl.addEventListener('change', e => { if (e.target.matches('[data-act="access"]')) { st.avoidStairs = e.target.checked; dcache = null; if (st.route) showRoute(st.route.t); } });
sideEl.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.acard')) { e.preventDefault(); e.target.click(); } });

function openZone(id) { if (currentView !== 'app') return; st.sel = 'z:' + id; S.select(id); S.flyToZone(id, {}); show('zone', { id }); st.sel = 'z:' + id; S.select(id); refreshPins(); postBridge('zone', { id }); }
function openPoi(id) { if (currentView !== 'app') return; const p = PMAP[id]; show('poi', { id }); st.sel = 'p:' + id; S.selectPoint(p.pos); S.flyToPoint(p.pos, { dist: 32 }); refreshPins(); postBridge('poi', { id }); }
function showRoute(t) {
  if (currentView !== 'app') go('app');
  const r = pathPts(startPos(), t, { access: st.avoidStairs }); if (!r) { toast('Tidak ada jalur terbuka ke ' + t.name); return; }
  clearRouteState(); st.route = { t, r }; S.setRoute(r.pts); S.frameRoute(r.pts, {}); show('route', { t }); st.sel = (t.kind === 'z' ? 'z:' : 'p:') + t.id; if (t.kind === 'z') S.select(t.id); else S.selectPoint(t.pos); refreshPins();
  postBridge('route', { to: t.id, meters: Math.round(r.m), minutes: r.min });
}
function clearStopPins() { Object.keys(pinEls).filter(k => k.startsWith('stop:')).forEach(rmPin); }

// viewer
const viewerCanvas = document.createElement('canvas'); let viewer = null;
const modelFor = an => !an ? null : (MODEL[an.id] ? an.id : an.model);
function attachViewer() { const slot = $('.viewer', sideEl); if (!slot) { if (viewer) viewer.setActive(false); return; } slot.prepend(viewerCanvas); if (!viewer) viewer = createViewer(viewerCanvas); viewer.setActive(true); viewer.show(slot.dataset.model); }

// chips & map controls
$('#chips').innerHTML = FILTERS.map(f => `<button class="chip${f.id === 'semua' ? ' on' : ''}" data-f="${f.id}" style="${f.c ? '--c:' + f.c : ''}">${ICO(f.icon)}<span>${f.label}</span></button>`).join('');
$('#chips').addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; const f = b.dataset.f; st.filter = f; $$('.chip').forEach(c => c.classList.toggle('on', c.dataset.f === f)); refreshPins();
  if (f === 'akses' || f === 'ibadah') show('list', { title: FILTERS.find(x => x.id === f).label, items: [...ZONES.filter(FILTER_ZONE[f]).map(z => ({ k: 'z', id: z.id })), ...POIS.filter(p => (FILTER_POI[f] || []).includes(p.type)).map(p => ({ k: 'p', id: p.id }))] });
  else if (FILTER_POI[f]) show('list', { title: FILTERS.find(x => x.id === f).label, items: POIS.filter(p => FILTER_POI[f].includes(p.type)).map(p => ({ k: 'p', id: p.id })) });
  else if (f === 'satwa' || f === 'wahana') show('list', { title: f === 'satwa' ? 'Zona satwa' : 'Wahana & bermain', items: ZONES.filter(FILTER_ZONE[f]).map(z => ({ k: 'z', id: z.id })) });
  else if (sideCur.v === 'list') setTab('home');
});
$('#z-in').onclick = () => S.zoom(0.7); $('#z-out').onclick = () => S.zoom(1.4);
$('#c-north').onclick = () => S.resetNorth();
$('#c-mode').onclick = () => { const m = S.mode === '3d' ? '2d' : '3d'; S.setMode(m); $('#c-mode').textContent = m === '3d' ? '2D' : '3D'; toast(m === '2d' ? 'Tampilan 2D dari atas' : 'Tampilan 3D'); };
$('#c-night').onclick = () => { setNightUI(!st.night); toast(st.night ? 'Mode malam · suasana Surabaya Night Zoo' : 'Mode siang'); };
$('#c-loc').onclick = () => { if (st.user) S.flyToPoint(st.user.pos, { dist: 44 }); else openQR(); };
function setNightUI(on) { st.night = on; S.setNight(on); $('#v-app').classList.toggle('night', on); $('#c-night').classList.toggle('on', on); $('#c-night').innerHTML = ICO(on ? 'sun' : 'moon'); }
setInterval(() => { if (currentView === 'app') $('#compass-ico').style.transform = `rotate(${S.azimuth()}rad)`; }, 150);

// search
const q = $('#q'), results = $('#results'); let rIdx = 0;
q.addEventListener('input', () => { const items = searchItems(q.value); rIdx = 0; if (!q.value.trim()) { results.hidden = true; return; } results._items = items;
  results.innerHTML = items.length ? items.map((o, i) => `<button class="rrow ${i === 0 ? 'on' : ''}" data-i="${i}"><span class="ric" style="--c:${o.c}">${ICO(o.icon)}</span><span><b>${esc(o.name)}</b><small>${esc(o.sub)}</small></span><span class="rmeta">${o.w.min} mnt</span></button>`).join('') : `<div class="rempty">Tidak ditemukan. Tekan Enter untuk tanya Kobi.</div>`; results.hidden = false; });
results.addEventListener('click', e => { const b = e.target.closest('.rrow'); if (b) pickResult(results._items[+b.dataset.i]); });
function pickResult(o) { results.hidden = true; q.blur(); q.value = ''; o.k === 'z' ? openZone(o.id) : openPoi(o.id); }
q.addEventListener('keydown', e => { const items = results._items || []; if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); rIdx = (rIdx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % Math.max(1, items.length); $$('.rrow', results).forEach((r, i) => r.classList.toggle('on', i === rIdx)); }
  if (e.key === 'Enter') { if (items[rIdx] && !results.hidden) pickResult(items[rIdx]); else if (q.value.trim()) { openKobi(); sendKobi(q.value.trim()); q.value = ''; results.hidden = true; } }
  if (e.key === 'Escape') { results.hidden = true; q.blur(); } });
document.addEventListener('keydown', e => { if (e.key === '/' && currentView === 'app' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') { e.preventDefault(); q.focus(); } });
document.addEventListener('click', e => { if (!e.target.closest('.wsearch')) results.hidden = true; if (!e.target.closest('#acct-menu,#btn-avatar')) $('#acct-menu').hidden = true; });

// account menu
$('#btn-avatar').onclick = () => { const m = $('#acct-menu'); const r = $('#btn-avatar').getBoundingClientRect(); m.style.top = (r.bottom + 8) + 'px'; m.style.right = Math.max(12, innerWidth - r.right) + 'px'; m.style.left = 'auto';
  m.innerHTML = `<div class="mh"><b>${esc(session.name)}</b><small>${esc(session.email)}</small></div><button data-m="akun">${ICO('user')}Akun saya</button><button data-m="qr">${ICO('qr')}Ganti lokasi (pindai QR)</button>${session.role === 'pengelola' ? `<button data-m="admin">${ICO('building')}Konsol pengelola</button>` : ''}<button data-m="landing">${ICO('home')}Beranda website</button><button data-m="out" class="danger">${ICO('logout')}Keluar</button>`;
  m.hidden = !m.hidden; m.onclick = ev => { const b = ev.target.closest('[data-m]'); if (!b) return; m.hidden = true; const k = b.dataset.m; if (k === 'akun') show('akun'); else if (k === 'qr') openQR(); else if (k === 'admin') go('admin'); else if (k === 'landing') go('landing'); else logout(); }; };

// QR modal
const qrModal = $('#qr-modal');
$('#qr-list').innerHTML = DATA.qr.map(x => `<button data-q="${x.id}">${ICO('qr')}<span><b>${esc(x.name)}</b><small>${esc(x.hint)}</small></span></button>`).join('');
function openQR() { qrModal.hidden = false; qrModal.classList.remove('scanning'); $('#qr-list button').focus(); }
qrModal.addEventListener('click', e => { if (e.target === qrModal || e.target.closest('[data-close]')) qrModal.hidden = true; const b = e.target.closest('[data-q]'); if (!b) return; qrModal.classList.add('scanning');
  setTimeout(() => { qrModal.hidden = true; const qq = QMAP[b.dataset.q]; setUserLoc(qq); U.setLoc(qq.id); if (BE.on) BE.logScan(qq.id, 'menu'); toast('Lokasi terdeteksi: ' + qq.name); S.flyToPoint(qq.pos, { dist: 60 }); if (st.route) showRoute(st.route.t); else show(sideCur.v, sideCur.p, false); }, 700); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { qrModal.hidden = true; } });

// banner
function showBanner(text, t) { const b = $('#banner'); b.hidden = false; b.innerHTML = `${ICO('megaphone')}<span><b>Info pengelola · ${esc(t || hhmm(wib().min))}</b>${esc(text)}</span><button aria-label="Tutup info">${ICO('x', 'sm')}</button>`; b.querySelector('button').onclick = () => b.hidden = true; clearTimeout(showBanner.t); showBanner.t = setTimeout(() => b.hidden = true, 10000); }

// ---------- Kobi drawer ----------
const kobiEl = $('#kobi'); let sampleFn = null, kobiLive = false;
try { if (window.claude && window.claude.use) window.claude.use('sample').then(s => { sampleFn = s; kobiLive = !!s; updateKobiState(); }).catch(() => { }); } catch { }
function updateKobiState() { const el = $('#ai-state'); if (el) { el.classList.toggle('live', kobiLive); el.textContent = kobiLive ? 'AI aktif · menjawab dari data KBS' : 'Mode offline · jawaban dari data lokal'; } }
$('#btn-kobi').onclick = () => kobiEl.hidden ? openKobi() : (kobiEl.hidden = true);
function openKobi() {
  if (currentView !== 'app') go('app'); if (!kobiEl.hidden) return; kobiEl.hidden = false;
  kobiEl.innerHTML = `<div class="chat-h"><span class="av">${KOBI()}</span><span><b>Kobi</b><span class="ai-state" id="ai-state"></span></span><button class="iconbtn" id="kobi-x" aria-label="Tutup Kobi">${ICO('x')}</button></div><div class="msgs" id="msgs" aria-live="polite"></div><div class="sugs" id="sugs">${SUGS.map(s => `<button>${esc(s)}</button>`).join('')}</div><form class="composer" id="composer"><label for="kq" class="sr">Pesan untuk Kobi</label><input id="kq" autocomplete="off" placeholder="Tanya apa saja tentang KBS…"><button class="btn primary" aria-label="Kirim">${ICO('send')}</button></form>`;
  updateKobiState(); $('#kobi-x').onclick = () => kobiEl.hidden = true;
  if (!st.chat.length) st.chat.push({ role: 'bot', text: `Halo${session ? ', ' + session.name.split(' ')[0] : ''}! Aku Kobi, pemandu KBS. ${st.user ? `Kamu sedang di ${st.user.name}.` : 'Pindai QR di papan informasi supaya aku tahu posisimu.'} Tanya soal satwa, fasilitas terdekat, rute, jadwal, atau tiket ya.` });
  st.chat.forEach(m => appendMsg(m));
  $('#sugs').onclick = e => { const b = e.target.closest('button'); if (b) sendKobi(b.textContent); };
  $('#composer').onsubmit = e => { e.preventDefault(); const v = $('#kq').value.trim(); if (v) { $('#kq').value = ''; sendKobi(v); } };
  setTimeout(() => $('#kq') && $('#kq').focus(), 50);
}
const SUGS = ['Toilet terdekat di mana?', 'Di mana lihat komodo?', 'Rute 2 jam bersama anak', 'Jam buka & harga tiket?', 'Satwa paling langka apa saja?', 'Ada pertunjukan apa hari ini?'];
function appendMsg(m) {
  const box = $('#msgs'); if (!box) return null; $$('.qr', box).forEach(q => q.remove()); const d = document.createElement('div'); d.className = 'msg ' + (m.role === 'me' ? 'me' : 'bot') + (m.thinking ? ' thinking' : ''); d.textContent = m.text; if (m.actions && m.actions.length) d.append(actionsEl(m.actions));
  if (m.role === 'bot' && !m.thinking && m.text) { const f = document.createElement('div'); f.className = 'mfoot'; f.innerHTML = `<button>${ICO('volume', 'sm')}Dengarkan</button>`; f.firstChild.onclick = () => speak(m.text); d.append(f); }
  box.append(d);
  if (m.chips && m.chips.length && m === st.chat[st.chat.length - 1]) { const q = document.createElement('div'); q.className = 'qr'; m.chips.forEach(c => { const b = document.createElement('button'); b.textContent = c; b.onclick = () => sendKobi(c); q.append(b); }); box.append(q); }
  box.scrollTop = box.scrollHeight; return d;
}
function actionsEl(actions) {
  const w = document.createElement('div'); w.className = 'acts';
  for (const a of actions) { const b = document.createElement('button'); if (a.type === 'rute') { const wk = walk(a.t); b.className = 'rt'; b.innerHTML = `${ICO('route', 'sm')}Rute ke ${esc(a.t.name)} · ${wk.min} mnt`; b.onclick = () => showRoute(a.t); } else if (a.type === 'lihat') { b.innerHTML = `${ICO('map', 'sm')}${esc(a.t.name)}`; b.onclick = () => a.t.kind === 'z' ? openZone(a.t.id) : openPoi(a.t.id); } else if (a.type === 'plan') { b.className = 'rt'; b.innerHTML = `${ICO('sparkle', 'sm')}Tampilkan rencana di peta`; b.onclick = () => runPlan(); } else if (a.type === 'itin') { b.className = 'rt'; b.innerHTML = `${ICO('map', 'sm')}Tampilkan itinerary di peta`; b.onclick = () => runPlan(a.res); } w.append(b); }
  return w;
}
async function sendKobi(text) {
  openKobi(); if (st.kobiBusy) return;
  const me = { role: 'me', text }; st.chat.push(me); appendMsg(me); const sg = $('#sugs'); if (sg) sg.hidden = true;
  const el = appendMsg({ role: 'bot', text: 'Kobi sedang mencari…', thinking: true }); st.kobiBusy = true;
  const finish = (body, actions, chips) => { el.remove(); const m = { role: 'bot', text: body, actions, chips }; st.chat.push(m); appendMsg(m); st.kobiBusy = false; };
  // itinerary: Kobi bertanya beberapa hal lalu algoritma perencana menyusun rutenya (AI hanya membantu memahami kalimat)
  const ns = norm(text), K = st.kobiPlan;
  const planLike = (K && K.active) || PLAN_INTENT.test(ns) || (K && K.last && PLAN_MODIFY.test(ns));
  if (planLike) {
    let ai = null;
    const isChip = Object.values(PLAN_Q).some(q => q.chips.includes(text));
    if (BE.on && session && !BE.kobiOff && !isChip && text.length > 15) { try { ai = planFromAI(await BE.kobiPrefs(text)); } catch (e) { console.warn('[jelajah] kobi prefs', e); } }
    const it = kobiPlanTurn(text, ai);
    if (it) { setTimeout(() => finish(it.text, it.actions || [], it.chips), ai ? 0 : 380); return; }
  }
  if (sampleFn && kobiLive) {
    try {
      const turns = st.chat.filter(m => !m.thinking).slice(-9, -1).map(m => ({ role: m.role === 'me' ? 'user' : 'assistant', content: m.text || '…' })); while (turns.length && turns[0].role !== 'user') turns.shift();
      const input = [{ role: 'user', content: KOBI_RULES + (session ? `\nNama pengguna: ${session.name}.` : '') + '\n\nDATA:\n' + kobiData() }, ...(turns.length ? [{ role: 'assistant', content: 'Siap, aku Kobi.' }, ...turns] : []), { role: 'user', content: text }];
      const merged = []; for (const t of input) { if (merged.length && merged[merged.length - 1].role === t.role) merged[merged.length - 1].content += '\n\n' + t.content; else merged.push({ ...t }); }
      const { text: out } = await sampleFn(merged, { modelTier: 'quick', cache: false, onText: ({ text: tt }) => { el.classList.remove('thinking'); el.textContent = parseActions(tt).body; const b = $('#msgs'); if (b) b.scrollTop = 1e6; } });
      const { body, actions } = parseActions(out); finish(body, actions); return;
    } catch (e) {
      if (e && ['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].includes(e.code)) { kobiLive = false; updateKobiState(); }
      else if (e && e.code === 'rate_limited') toast('Kobi sedang sibuk. Jawaban dari data lokal.');
    }
  }
  if (BE.on && session && !BE.kobiOff) {
    try {
      const turns = st.chat.filter(m => !m.thinking && m.text).slice(-9).map(m => ({ role: m.role === 'me' ? 'user' : 'assistant', content: m.text }));
      const r = await BE.kobi(turns, kobiData(), session.name);
      if (r && r.text) { if (!kobiLive) { kobiLive = true; updateKobiState(); } const { body, actions } = parseActions(r.text); finish(body, actions); return; }
      if (r && r.limit) toast('Kuota tanya Kobi hari ini sudah habis. Jawaban dari data lokal.');
    } catch (e) { console.warn('[jelajah] kobi', e); }
  }
  setTimeout(() => { const r = localKobi(text); finish(r.text, r.actions); }, 420);
}

// ============================================================
// ADMIN CONSOLE
// ============================================================
let adminPage = 'ringkasan';
const ADMIN_TITLES = { ringkasan: ['Ringkasan', 'Kondisi layanan Jelajah KBS hari ini'], peta: ['Peta & status', 'Buka-tutup zona, fasilitas, dan jalur. Perubahan langsung tampil di peta pengunjung.'], lokasi: ['Data lokasi', 'Verifikasi titik lokasi agar informasi pengunjung akurat'], jadwal: ['Jadwal', 'Jadwal feeding dan pertunjukan yang tampil di aplikasi pengunjung'], pengumuman: ['Pengumuman & riwayat', 'Kirim info ke pengunjung dan lihat riwayat perubahan'] };
$('.anav').addEventListener('click', e => { const b = e.target.closest('[data-page]'); if (b) enterAdmin(b.dataset.page); });
$('#as-visitor').onclick = () => go('app');
$('#adm-logout').onclick = logout;
function enterAdmin(page) {
  adminPage = page; $$('.anav button').forEach(b => b.classList.toggle('on', b.dataset.page === page));
  $('#adm-avatar').textContent = initials(session ? session.name : ''); $('#adm-name').textContent = session ? session.name : ''; $('#adm-email').textContent = session ? session.email : '';
  $('#atitle').textContent = ADMIN_TITLES[page][0]; $('#asub').textContent = ADMIN_TITLES[page][1];
  const R = { ringkasan: admRingkasan, peta: admPeta, lokasi: admLokasi, jadwal: admJadwal, pengumuman: admPengumuman }[page];
  $('#acontent').innerHTML = R(); $('#acontent').scrollTop = 0;
  if (page === 'ringkasan' && BE.on && !enterAdmin.loading) { enterAdmin.loading = true; BE.loadStats().finally(() => { enterAdmin.loading = false; if (currentView === 'admin' && adminPage === 'ringkasan') { $('#acontent').innerHTML = admRingkasan(); bindAdmin(); } }); }
  if (page === 'peta') { mountMap($('#adm-mapslot')); clearRouteState(); S.select(null); st.sel = null; S.overview(0.6); } else mountMap(null);
  bindAdmin(); refreshPins();
}
setInterval(() => { const n = wib(); const c = $('#aclock'); if (c) c.textContent = `${DAYS[n.day]}, ${n.date} ${MONTHS[n.month]} · ${hhmm(n.min)} WIB`; }, 1000);
const ADMIN_STATUS = () => [
  ...ZONES.filter(z => z.cat === 'satwa').map(z => ({ k: 'z', id: z.id, g: 'Zona satwa' })), ...ZONES.filter(z => z.cat === 'wahana').map(z => ({ k: 'z', id: z.id, g: 'Wahana' })),
  { k: 'e', id: 'jembatan', g: 'Jalur', name: 'Jalur Jembatan Cinta' }, ...POIS.filter(p => ['toilet', 'ibadah', 'kuliner', 'p3k', 'laktasi'].includes(p.type)).map(p => ({ k: 'p', id: p.id, g: 'Fasilitas' })),
];
const itemName = it => it.name || (it.k === 'z' ? ZMAP[it.id].name : it.k === 'p' ? PMAP[it.id].name : it.id === 'jembatan' ? 'Jalur Jembatan Cinta' : it.id);
const isClosed = it => it.k === 'z' ? st.closedZones.has(it.id) : it.k === 'p' ? st.closedPois.has(it.id) : st.closedEdges.has(it.id);
function addLog(what) { st.log.push({ t: hhmm(wib().min), d: `${wib().date} ${MONTHS[wib().month]}`, what, who: session ? session.name : 'Admin' }); if (BE.on) BE.log(what); }
function setClosed(it, closed) {
  if (isClosed(it) === closed) return; const name = itemName(it);
  if (it.k === 'z') { closed ? st.closedZones.add(it.id) : st.closedZones.delete(it.id); S.setZoneClosed(it.id, closed); }
  else if (it.k === 'p') { closed ? st.closedPois.add(it.id) : st.closedPois.delete(it.id); }
  else { closed ? st.closedEdges.add(it.id) : st.closedEdges.delete(it.id); S.setEdgeClosed(it.id, closed); dcache = null; for (const k in nodeCache) delete nodeCache[k]; }
  addLog(`${name} ${closed ? 'ditutup sementara' : 'dibuka kembali'}`);
  const anncText = `${name} ${closed ? 'ditutup sementara. Rute dialihkan otomatis.' : 'sudah dibuka kembali.'}`;
  if (BE.on) BE.setClosed(it, closed, anncText); else st.annc.unshift({ t: hhmm(wib().min), text: anncText, level: 'info', auto: true });
  saveOps(); refreshPins(); toast(`${name}: ${closed ? 'ditutup' : 'dibuka'}`);
}
// demo chart data (deterministik, berlabel DEMO)
const QR_DAYS = (() => { const r = mulberry32(2026); const out = []; const today = new Date(Date.now() + 7 * 3600e3); for (let i = 29; i >= 0; i--) { const d = new Date(today.getTime() - i * 864e5); const dow = d.getUTCDay(); const base = dow === 6 ? 1150 : dow === 0 ? 1050 : 430; out.push({ d, v: Math.round(base * (0.82 + r() * 0.36)) }); } return out; })();
const QR_TOP = [['Gerbang Utama', 6120], ['Pintu Selatan · Tunnel Joyoboyo', 4380], ['Plaza Tengah', 3510], ['Dermaga Perahu', 2290], ['Aquanoctudio', 2105]];
function barChart(data) {
  const W = 640, H = 220, L = 40, R = 8, T = 10, B = 26; const hi = Math.max(1, ...data.map(d => d.v)); const step = [100, 200, 250, 500, 1000, 2000].find(s => hi / s <= 4) || 5000; const max = Math.ceil(hi / step) * step; const bw = (W - L - R) / data.length; const y = v => T + (H - T - B) * (1 - v / max);
  let g = ''; for (let i = 0; i <= max / step; i++) { const v = step * i; g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)" stroke-width="1"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${fmtN(Math.round(v))}</text>`; }
  let bars = '', hits = ''; data.forEach((d, i) => { const x = L + i * bw + 1, w = Math.max(2, bw - 2), h = H - B - y(d.v); bars += `<path d="M${x},${H - B} V${y(d.v) + 4} q0,-4 4,-4 H${x + w - 4} q4,0 4,4 V${H - B} Z" fill="var(--bar)" ${d.d.getUTCDay() % 6 === 0 ? '' : 'opacity=".72"'}/>`; hits += `<rect x="${L + i * bw}" y="${T}" width="${bw}" height="${H - T - B}" fill="transparent" data-i="${i}"/>`; if (i % 7 === (data.length - 1) % 7) g += `<text x="${x + w / 2}" y="${H - 8}" text-anchor="middle">${d.d.getUTCDate()} ${MONTHS[d.d.getUTCMonth()]}</text>`; });
  return `<div class="chart" id="qrchart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Grafik batang akses QR per hari selama 30 hari terakhir (data demo)"><g class="axis">${g}</g>${bars}<g>${hits}</g></svg><div class="tt" hidden></div></div>`;
}
const qrDays = () => BE.on && BE.stats ? BE.stats.days : QR_DAYS;
function admRingkasan() {
  const live = BE.on && BE.stats, DT = live ? '' : '<span class="demo-tag">DEMO</span>', days = qrDays(), top = live ? BE.stats.top : QR_TOP;
  const total = ZONES.length + POIS.length, pct = Math.round(st.verified.size / total * 100); const sum = days.reduce((a, b) => a + b.v, 0); const closed = ADMIN_STATUS().filter(isClosed);
  const rating = live ? (BE.stats.n ? String(BE.stats.avg).replace('.', ',') : '–') : '4,6', ratingSub = live ? (BE.stats.n ? `Dari ${fmtN(BE.stats.n)} penilaian pengunjung` : 'Belum ada penilaian') : 'Survei 1–5 setelah kunjungan';
  return `<div class="kpis">
    <div class="kpi"><small>Akses via QR · 30 hari ${DT}</small><b>${fmtN(sum)}</b><div class="sub">${live ? 'Dari pindaian QR di papan info' : 'Puncak di akhir pekan'}</div></div>
    <div class="kpi"><small>Kepuasan pengunjung ${DT}</small><b>${rating}<span>/5</span></b><div class="sub">${ratingSub}</div></div>
    <div class="kpi"><small>Titik lokasi</small><b>${total}<span>/${DATA.meta.plan.maxPoints}</span></b><div class="bar"><i style="width:${total}%"></i></div></div>
    <div class="kpi"><small>Data terverifikasi</small><b>${pct}%</b><div class="bar"><i style="width:${pct}%"></i></div></div></div>
  <div class="grid2"><div class="card"><div class="card-h"><h3>Akses QR per hari</h3>${live ? '' : '<span class="demo-tag">DATA DEMO</span>'}<div class="r fine">Batang penuh = akhir pekan</div></div>${barChart(days)}</div>
    <div class="card"><div class="card-h"><h3>Titik QR terpopuler</h3>${DT}</div>${top.length ? top.map(([n, v]) => `<div class="hbar"><span>${esc(n)}</span><span class="trk"><i style="width:${v / top[0][1] * 100}%"></i></span><b>${fmtN(v)}</b></div>`).join('') : '<p class="empty-note">Belum ada pindaian QR dalam 30 hari terakhir.</p>'}</div></div>
  <div class="grid2"><div class="card"><div class="card-h"><h3>Status hari ini</h3><div class="r"><button class="btn sm ghost" data-page-go="peta">${ICO('map', 'sm')}Kelola di peta</button></div></div>
      ${closed.length ? closed.map(it => `<div class="srow"><span class="sn"><b>${esc(itemName(it))}</b><small>${it.g}</small></span><span class="pill bad">${ICO('alert')}Tutup</span></div>`).join('') : `<p class="empty-note">Semua zona, wahana, fasilitas, dan jalur sedang buka.</p>`}</div>
    <div class="card"><div class="card-h"><h3>Riwayat terbaru</h3></div>${st.log.length ? `<ul class="log">${st.log.slice(-5).reverse().map(l => `<li><time>${l.t}</time><span><b>${esc(l.what)}</b> <span class="who">· ${esc(l.who)}</span></span></li>`).join('')}</ul>` : '<p class="empty-note">Belum ada perubahan. Coba tutup satu wahana di menu Peta & status.</p>'}</div></div>`;
}
function admPeta() {
  const items = ADMIN_STATUS(); let grp = '';
  const rows = items.map((it, i) => { const c = isClosed(it); const h = it.g !== grp ? `<div class="grp">${it.g}</div>` : ''; grp = it.g; return h + `<div class="srow" data-row="${it.k}:${it.id}"><span class="sn"><b>${esc(itemName(it))}</b><small>${it.k === 'z' ? esc(ZMAP[it.id].price) : it.k === 'p' ? POI_T[PMAP[it.id].type].label : 'Jalur pejalan kaki'}</small></span><span class="state ${c ? 'shut' : 'open'}">${c ? 'Tutup' : 'Buka'}</span><input type="checkbox" class="switch" data-st="${i}" ${c ? '' : 'checked'} aria-label="${esc(itemName(it))} buka"></div>`; }).join('');
  return `<div class="mapgrid"><div class="mapcard" id="adm-mapslot"></div><div class="card statuspanel"><div class="card-h"><h3>Status operasional</h3></div><label for="st-q" class="sr">Cari</label><input type="search" id="st-q" placeholder="Cari zona atau fasilitas…">${rows}</div></div>`;
}
function admLokasi() {
  const rows = [...ZONES.map(z => ({ k: 'z', o: z, type: CAT[z.cat].label })), ...POIS.map(p => ({ k: 'p', o: p, type: POI_T[p.type].label }))];
  const f = admLokasi.filter || 'semua'; const list = rows.filter(r => f === 'semua' || (f === 'belum') === !st.verified.has(r.k + ':' + r.o.id)); const pct = Math.round(st.verified.size / rows.length * 100);
  return `<div class="card"><div class="card-h"><h3>${st.verified.size} dari ${rows.length} titik terverifikasi (${pct}%)</h3><div class="r"><div class="tabs2" id="lok-f">${[['semua', 'Semua'], ['belum', 'Belum diverifikasi'], ['sudah', 'Terverifikasi']].map(([k, l]) => `<button data-f="${k}" class="${f === k ? 'on' : ''}">${l}</button>`).join('')}</div></div></div><div class="bar"><i style="width:${pct}%"></i></div></div>
  <div class="card"><div class="tblwrap"><table class="tbl"><thead><tr><th>Nama</th><th>Jenis</th><th>Koordinat peta</th><th>Status</th><th></th></tr></thead><tbody>
  ${list.map(r => { const key = r.k + ':' + r.o.id, v = st.verified.has(key); return `<tr><td><b>${esc(r.o.name)}</b></td><td>${esc(r.type)}</td><td class="num">x ${r.o.pos[0]}, z ${r.o.pos[1]}</td><td>${v ? `<span class="pill ok">${ICO('shield')}Terverifikasi</span>` : `<span class="pill warn">${ICO('info')}Perlu survei</span>`}</td><td style="text-align:right;white-space:nowrap"><button class="btn sm ghost" data-ver="${key}">${v ? 'Batalkan' : 'Verifikasi'}</button> <button class="btn sm" data-see="${key}">${ICO('map', 'sm')}</button></td></tr>`; }).join('')}
  </tbody></table></div></div>`;
}
function admJadwal() {
  return `<div class="card"><div class="card-h"><h3>Jadwal hari ini</h3><div class="r"><button class="btn sm ghost" id="sch-add">${ICO('plus', 'sm')}Tambah</button><button class="btn sm primary" id="sch-save">${ICO('check', 'sm')}Simpan & tampilkan</button></div></div>
  <div class="tblwrap"><table class="tbl" id="sch-tbl"><thead><tr><th style="width:110px">Jam</th><th>Acara</th><th style="width:200px">Lokasi</th><th>Catatan</th><th></th></tr></thead><tbody>
  ${DATA.schedule.map((s, i) => `<tr data-i="${i}"><td><input type="time" value="${s.t}" aria-label="Jam"></td><td><input type="text" value="${esc(s.title)}" aria-label="Acara"></td><td><select aria-label="Lokasi" style="height:36px;border-radius:10px;border:1.5px solid var(--line);background:var(--surface-2);color:var(--ink);font:600 13px var(--font-body);width:100%">${ZONES.filter(z => z.cat !== 'staf').map(z => `<option value="${z.id}" ${z.id === s.zone ? 'selected' : ''}>${esc(z.name)}</option>`).join('')}</select></td><td><input type="text" value="${esc(s.note)}" aria-label="Catatan"></td><td><button class="iconbtn" data-del="${i}" aria-label="Hapus">${ICO('x', 'sm')}</button></td></tr>`).join('')}
  </tbody></table></div><p class="fine" style="margin-top:10px">Jadwal awal diambil dari sumber publik (sebagian dari 2017). Perbarui sesuai jadwal resmi.</p></div>`;
}
function admPengumuman() {
  return `<div class="grid2"><div class="card"><div class="card-h"><h3>Kirim pengumuman</h3></div><form class="annc" id="annc-f"><label for="annc-t" class="sr">Isi pengumuman</label><textarea id="annc-t" maxlength="160" placeholder="mis. Feeding gajah hari ini dimajukan ke 13.30.">Feeding gajah hari ini dimajukan ke 13.30.</textarea><div class="row"><label for="annc-l" class="sr">Tingkat</label><select id="annc-l"><option value="info">Info</option><option value="penting">Penting</option></select><button class="btn primary" type="submit">${ICO('send', 'sm')}Kirim ke pengunjung</button></div></form>
    <div class="sect" style="margin-top:16px">Terkirim</div><div class="sent">${st.annc.length ? st.annc.slice(0, 8).map(a => `<div><time>${esc(a.t)}</time><span>${a.level === 'penting' ? '<b>PENTING · </b>' : ''}${esc(a.text)}</span></div>`).join('') : '<p class="empty-note">Belum ada pengumuman.</p>'}</div></div>
  <div class="card"><div class="card-h"><h3>Riwayat perubahan</h3></div>${st.log.length ? `<ul class="log">${st.log.slice().reverse().map(l => `<li><time>${l.t}</time><span><b>${esc(l.what)}</b> <span class="who">· ${esc(l.who)}, ${esc(l.d || '')}</span></span></li>`).join('')}</ul>` : '<p class="empty-note">Belum ada perubahan.</p>'}</div></div>`;
}
function adminFocus(k, id) { if (adminPage !== 'peta') return; const row = $(`[data-row="${k}:${id}"]`); if (k === 'z') { S.flyToZone(id, {}); S.select(id); } else { S.flyToPoint(PMAP[id].pos, { dist: 32 }); S.selectPoint(PMAP[id].pos); } if (row) { row.scrollIntoView({ block: 'center', behavior: 'smooth' }); row.animate([{ background: 'var(--mango-soft)' }, { background: 'transparent' }], { duration: 1400 }); } }
function bindAdmin() {
  const c = $('#acontent');
  $$('[data-page-go]', c).forEach(b => b.onclick = () => enterAdmin(b.dataset.pageGo));
  if (adminPage === 'ringkasan') { const ch = $('#qrchart'); if (ch) { const tt = $('.tt', ch); ch.addEventListener('pointermove', e => { const r = e.target.closest('rect[data-i]'); if (!r) { tt.hidden = true; return; } const d = qrDays()[+r.dataset.i]; const box = ch.getBoundingClientRect(), rb = r.getBoundingClientRect(); tt.hidden = false; tt.innerHTML = `${DAYS[d.d.getUTCDay()]}, ${d.d.getUTCDate()} ${MONTHS[d.d.getUTCMonth()]} · <b>${fmtN(d.v)}</b> akses`; tt.style.left = (rb.left - box.left + rb.width / 2) + 'px'; tt.style.top = (e.clientY - box.top - 6) + 'px'; }); ch.addEventListener('pointerleave', () => tt.hidden = true); } }
  if (adminPage === 'peta') {
    const items = ADMIN_STATUS(); $$('[data-st]', c).forEach(sw => sw.onchange = () => { const it = items[+sw.dataset.st]; setClosed(it, !sw.checked); const row = sw.closest('.srow'); const s = $('.state', row); s.textContent = sw.checked ? 'Buka' : 'Tutup'; s.className = 'state ' + (sw.checked ? 'open' : 'shut'); });
    $$('.srow', c).forEach(r => r.addEventListener('click', e => { if (e.target.matches('input')) return; const [k, id] = r.dataset.row.split(':'); if (k === 'z') { S.flyToZone(id, {}); S.select(id); } else if (k === 'p') { S.flyToPoint(PMAP[id].pos, { dist: 32 }); S.selectPoint(PMAP[id].pos); } else { S.flyToPoint(NODES.I, { dist: 30 }); S.selectPoint(NODES.I); } }));
    $('#st-q').oninput = e => { const s = norm(e.target.value); $$('.srow', c).forEach(r => r.hidden = s && !norm(r.textContent).includes(s)); };
  }
  if (adminPage === 'lokasi') {
    $('#lok-f').onclick = e => { const b = e.target.closest('[data-f]'); if (b) { admLokasi.filter = b.dataset.f; enterAdmin('lokasi'); } };
    $$('[data-ver]', c).forEach(b => b.onclick = () => { const key = b.dataset.ver; const [k, id] = key.split(':'); const o = k === 'z' ? ZMAP[id] : PMAP[id]; if (st.verified.has(key)) { st.verified.delete(key); addLog('Verifikasi dibatalkan: ' + o.name); } else { st.verified.add(key); addLog('Lokasi diverifikasi: ' + o.name); } if (BE.on) BE.setVerified(key, st.verified.has(key)); saveOps(); enterAdmin('lokasi'); });
    $$('[data-see]', c).forEach(b => b.onclick = () => { const [k, id] = b.dataset.see.split(':'); enterAdmin('peta'); setTimeout(() => adminFocus(k, id), 80); });
  }
  if (adminPage === 'jadwal') {
    const read = () => $$('#sch-tbl tbody tr').map(tr => { const [t, title, note] = $$('input', tr).map(i => i.value); return { t: t || '09:00', dur: 20, title: title.trim() || 'Acara', zone: $('select', tr).value, note: note.trim() }; });
    $('#sch-add').onclick = () => { DATA.schedule.splice(0, DATA.schedule.length, ...read(), { t: '15:30', dur: 20, title: 'Acara baru', zone: 'plaza', note: '' }); enterAdmin('jadwal'); };
    $$('[data-del]', c).forEach(b => b.onclick = () => { const cur = read(); cur.splice(+b.dataset.del, 1); DATA.schedule.splice(0, DATA.schedule.length, ...cur); enterAdmin('jadwal'); });
    $('#sch-save').onclick = () => { const cur = read().sort((a, b) => toMin(a.t) - toMin(b.t)); DATA.schedule.splice(0, DATA.schedule.length, ...cur); addLog(`Jadwal diperbarui (${cur.length} acara)`); if (BE.on) BE.saveSchedule(cur); saveOps(); toast('Jadwal tersimpan dan tampil di aplikasi pengunjung'); enterAdmin('jadwal'); };
  }
  if (adminPage === 'pengumuman') { $('#annc-f').onsubmit = e => { e.preventDefault(); const v = $('#annc-t').value.trim(); if (!v) { toast('Isi pengumuman dulu'); return; } const lvl = $('#annc-l').value; addLog('Pengumuman dikirim: "' + v + '"'); if (BE.on) { $('#annc-f [type=submit]').disabled = true; BE.announce(v, lvl).then(ok => { if (ok) toast('Pengumuman terkirim ke pengunjung'); enterAdmin('pengumuman'); }); return; } st.annc.unshift({ t: hhmm(wib().min), text: v, level: lvl }); saveOps(); toast('Pengumuman terkirim ke pengunjung'); enterAdmin('pengumuman'); }; }
}

// ---------- misc ----------
function toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), ms); }
function postBridge(type, payload) { try { if (window.Jelajah && window.Jelajah.postMessage) window.Jelajah.postMessage(JSON.stringify({ type, ...payload })); } catch { } }
// restore closures in the 3D scene
st.closedZones.forEach(id => ZMAP[id] && S.setZoneClosed(id, true)); st.closedEdges.forEach(id => S.setEdgeClosed(id, true));

// ---------- boot ----------
function boot() {
  const h = (location.hash || '').slice(1);
  if (QMAP[h]) { pendingQR = h; if (BE.on) BE.logScan(h, 'url'); }
  if (session) go(session.role === 'pengelola' ? 'admin' : 'app');
  else if (h === 'masuk' || h === 'daftar') go('auth', { mode: h });
  else if (h === 'pengelola') go('auth', { mode: 'masuk' }); // tautan lama: kini satu form login
  else if (pendingQR) { go('auth', { mode: 'masuk' }); toast('QR terbaca: ' + QMAP[pendingQR].name + '. Masuk untuk melanjutkan.'); }
  else go('landing');
  window.__jelajah = { S, st, go, BE };
}
BE.ready(boot);
