// ============================================================
// BACKEND — Supabase (Auth, database, realtime, edge function Kobi)
// Aktif bila window.JELAJAH_CONFIG berisi supabaseUrl + supabaseAnonKey dan supabase-js sudah dimuat.
// Tanpa itu aplikasi tetap jalan dalam MODE DEMO (data disimpan di browser), seperti prototype awal.
// ============================================================
const BE_CFG = Object.assign({ destination: 'kbs', showDemoAccounts: true, kobiDailyHint: true }, window.JELAJAH_CONFIG || {});
const BE = {
  cfg: BE_CFG, dest: BE_CFG.destination,
  on: !!(BE_CFG.supabaseUrl && BE_CFG.supabaseAnonKey && window.supabase && window.supabase.createClient),
  sb: null, stats: null, kobiOff: false, snap: {}, ch: null,
};
if (BE.on) {
  try { BE.sb = window.supabase.createClient(BE_CFG.supabaseUrl, BE_CFG.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }); }
  catch (e) { console.warn('[jelajah] Supabase gagal dibuat, kembali ke mode demo', e); BE.on = false; }
}
const beWarn = (what, error) => { console.warn('[jelajah]', what, error); };
const beFail = (what, error) => { beWarn(what, error); try { toast('Gagal menyimpan ke server: ' + what + '. Coba lagi.'); } catch { } };
const wibOf = iso => { const d = new Date(new Date(iso).getTime() + 7 * 3600e3); return { min: d.getUTCHours() * 60 + d.getUTCMinutes(), date: d.getUTCDate(), month: d.getUTCMonth() }; };
const mapAnnc = r => { const w = wibOf(r.created_at); return { id: r.id, t: hhmm(w.min), text: r.text, level: r.level, auto: r.auto }; };
const mapLog = r => { const w = wibOf(r.created_at); return { id: r.id, t: hhmm(w.min), d: `${w.date} ${MONTHS[w.month]}`, what: r.what, who: r.who_name || 'Pengelola' }; };
const authMsg = error => {
  const m = String(error && (error.message || error.error_description || error) || '');
  if (/invalid login credentials/i.test(m)) return 'Email atau kata sandi salah.';
  if (/email not confirmed/i.test(m)) return 'Email belum dikonfirmasi. Buka tautan di email pendaftaran dulu.';
  if (/already registered|already been registered|user already exists/i.test(m)) return 'Email ini sudah terdaftar. Silakan masuk.';
  if (/rate limit|too many/i.test(m)) return 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.';
  if (/password/i.test(m) && /least|short|weak/i.test(m)) return 'Kata sandi terlalu lemah. Pakai minimal 8 karakter.';
  if (/fetch|network|failed to/i.test(m)) return 'Tidak bisa terhubung ke server. Periksa koneksi internet.';
  return 'Terjadi kesalahan: ' + m;
};

// ---------- akun ----------
BE.profileFor = async user => {
  const { data: p, error } = await BE.sb.from('profiles').select('name, role, destination_id').eq('id', user.id).maybeSingle();
  if (error) beWarn('profil', error);
  const manager = p && p.role === 'pengelola' && (!p.destination_id || p.destination_id === BE.dest);
  return { email: user.email, name: (p && p.name) || (user.user_metadata && user.user_metadata.name) || String(user.email).split('@')[0], role: manager ? 'pengelola' : 'pengunjung', uid: user.id };
};
BE.signIn = async (email, password) => {
  const { data, error } = await BE.sb.auth.signInWithPassword({ email, password });
  if (error) return { error: authMsg(error) };
  const sess = await BE.profileFor(data.user); await BE.pullUser(sess.email); return { sess };
};
BE.signUp = async (name, email, password) => {
  const { data, error } = await BE.sb.auth.signUp({ email, password, options: { data: { name }, emailRedirectTo: location.origin + location.pathname } });
  if (error) { const msg = authMsg(error); return { error: msg, field: /terdaftar/.test(msg) ? 'email' : null }; }
  if (data.user && Array.isArray(data.user.identities) && !data.user.identities.length) return { error: 'Email ini sudah terdaftar. Silakan masuk.', field: 'email' };
  if (!data.session) return { confirm: true };
  const sess = await BE.profileFor(data.user); await BE.pullUser(sess.email); return { sess };
};
BE.signOut = () => BE.sb.auth.signOut().catch(e => beWarn('keluar', e));
BE.forgot = async email => {
  const { error } = await BE.sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
  return error ? { error: authMsg(error) } : {};
};
BE.google = async () => {
  const { error } = await BE.sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
  return error ? { error: /provider is not enabled|unsupported provider/i.test(error.message) ? 'Login Google belum diaktifkan di Supabase (Authentication → Providers → Google).' : authMsg(error) } : {};
};
BE.recover = async () => {
  const p = prompt('Masukkan kata sandi baru (minimal 8 karakter):');
  if (!p) return; if (p.length < 8) { toast('Kata sandi minimal 8 karakter'); return BE.recover(); }
  const { error } = await BE.sb.auth.updateUser({ password: p });
  toast(error ? 'Gagal mengganti kata sandi: ' + authMsg(error) : 'Kata sandi berhasil diganti');
};

// ---------- data pribadi (favorit, paspor, rencana) ----------
const beKey = (k, email) => 'jelajah.' + k + '.' + email;
BE.pullUser = async email => {
  const [f, s, p] = await Promise.all([
    BE.sb.from('favorites').select('item_key').eq('destination_id', BE.dest),
    BE.sb.from('passport_stamps').select('animal_id').eq('destination_id', BE.dest),
    BE.sb.from('visit_plans').select('title, stops, saved_label').eq('destination_id', BE.dest).order('created_at', { ascending: false }).limit(8),
  ]);
  if (f.error || s.error || p.error) { beWarn('data akun', f.error || s.error || p.error); return; }
  const fav = f.data.map(r => r.item_key), seen = s.data.map(r => r.animal_id);
  store.set(beKey('fav', email), fav); store.set(beKey('seen', email), seen);
  store.set(beKey('plans', email), p.data.map(r => ({ title: r.title, stops: r.stops, saved: r.saved_label || '' })));
  BE.snap = { favorites: new Set(fav), passport_stamps: new Set(seen) };
};
BE.pushSet = async (table, col, next) => {
  const prev = BE.snap[table] || new Set(); const add = [...next].filter(x => !prev.has(x)), del = [...prev].filter(x => !next.has(x));
  BE.snap[table] = new Set(next);
  if (add.length) { const { error } = await BE.sb.from(table).upsert(add.map(v => ({ destination_id: BE.dest, [col]: v })), { onConflict: 'user_id,destination_id,' + col, ignoreDuplicates: true }); if (error) beFail(table === 'favorites' ? 'favorit' : 'paspor satwa', error); }
  if (del.length) { const { error } = await BE.sb.from(table).delete().eq('destination_id', BE.dest).in(col, del); if (error) beFail(table === 'favorites' ? 'favorit' : 'paspor satwa', error); }
};
BE.pushPlans = async plans => {
  const { error: e1 } = await BE.sb.from('visit_plans').delete().eq('destination_id', BE.dest).gte('id', 0);
  if (e1) return beFail('rencana', e1);
  if (!plans.length) return;
  const rows = plans.slice().reverse().map(p => ({ destination_id: BE.dest, title: p.title, stops: p.stops, saved_label: p.saved || null }));
  const { error } = await BE.sb.from('visit_plans').insert(rows); if (error) beFail('rencana', error);
};

// ---------- status operasional ----------
BE.applyStatus = r => {
  const [k, id] = r.key.split(':'); let changed = false;
  const setHas = (set, v) => { if (set.has(id) !== v) { v ? set.add(id) : set.delete(id); changed = true; } };
  if (k === 'z' && ZMAP[id]) { setHas(st.closedZones, !!r.closed); S.setZoneClosed(id, !!r.closed); }
  else if (k === 'p' && PMAP[id]) setHas(st.closedPois, !!r.closed);
  else if (k === 'e') { setHas(st.closedEdges, !!r.closed); S.setEdgeClosed(id, !!r.closed); }
  if (r.verified !== null && r.verified !== undefined && k !== 'e') { const key = k + ':' + id; if (st.verified.has(key) !== r.verified) { r.verified ? st.verified.add(key) : st.verified.delete(key); changed = true; } }
  if (changed) { dcache = null; for (const n in nodeCache) delete nodeCache[n]; }
  return changed;
};
BE.setClosed = async (it, closed, anncText) => {
  const { error } = await BE.sb.from('item_status').upsert({ destination_id: BE.dest, key: it.k + ':' + it.id, closed, updated_at: new Date().toISOString() }, { onConflict: 'destination_id,key' });
  if (error) return beFail('status ' + itemName(it), error);
  await BE.announce(anncText, 'info', true);
};
BE.setVerified = async (key, verified) => {
  const { error } = await BE.sb.from('item_status').upsert({ destination_id: BE.dest, key, verified, updated_at: new Date().toISOString() }, { onConflict: 'destination_id,key' });
  if (error) beFail('verifikasi', error);
};
BE.log = async what => {
  const { error } = await BE.sb.from('change_log').insert({ destination_id: BE.dest, what, who_name: session ? session.name : null });
  if (error) beWarn('riwayat', error);
};
BE.addAnnc = r => { if (st.annc.some(a => a.id === r.id)) return null; const a = mapAnnc(r); st.annc.unshift(a); st.annc.sort((x, y) => (y.id || 0) - (x.id || 0)); return a; };
BE.announce = async (text, level = 'info', auto = false) => {
  const { data, error } = await BE.sb.from('announcements').insert({ destination_id: BE.dest, text, level, auto }).select().single();
  if (error) { beFail('pengumuman', error); return false; }
  BE.addAnnc(data); return true;
};
BE.loadSchedule = async () => {
  const { data, error } = await BE.sb.from('schedules').select('t, dur, title, zone_id, note').eq('destination_id', BE.dest).order('t');
  if (error) return beWarn('jadwal', error);
  if (data.length) DATA.schedule.splice(0, DATA.schedule.length, ...data.map(s => ({ t: String(s.t).slice(0, 5), dur: s.dur, title: s.title, zone: ZMAP[s.zone_id] ? s.zone_id : 'plaza', note: s.note || '' })));
};
BE.saveSchedule = async list => {
  const { error } = await BE.sb.rpc('replace_schedule', { dest: BE.dest, items: list.map(s => ({ t: s.t, dur: s.dur, title: s.title, zone: s.zone, note: s.note })) });
  if (error) beFail('jadwal', error);
};

// ---------- analitik ----------
BE.logScan = (qr, source) => { BE.sb.from('qr_scans').insert({ destination_id: BE.dest, qr_id: qr, source }).then(({ error }) => error && beWarn('catat QR', error)); };
BE.rate = async n => { const { error } = await BE.sb.from('surveys').insert({ destination_id: BE.dest, rating: n }); if (error) beWarn('survei', error); return !error; };
BE.loadStats = async () => {
  const { data, error } = await BE.sb.rpc('dashboard_stats', { dest: BE.dest, days: 30 });
  if (error) { beWarn('statistik', error); return; }
  const days = (data.daily || []).map(x => ({ d: new Date(x.d + 'T00:00:00Z'), v: x.v }));
  BE.stats = { days, total: days.reduce((a, b) => a + b.v, 0), top: (data.top || []).map(x => [QMAP[x.qr] ? QMAP[x.qr].name : x.qr, x.v]), avg: data.survey && data.survey.avg, n: (data.survey && data.survey.n) || 0 };
};

// ---------- Kobi lewat edge function ----------
BE.kobi = async (turns, context, name) => {
  const { data, error } = await BE.sb.functions.invoke('kobi', { body: { messages: turns, context, name } });
  if (!error) return data;
  const status = error.context && error.context.status;
  if (status === 503 || status === 404) BE.kobiOff = true; // belum ada API key / fungsi belum di-deploy
  if (status === 429) return { limit: true };
  beWarn('kobi', error); return null;
};

// AI membantu MEMAHAMI kalimat itinerary (rombongan, durasi, minat); urutan rute tetap dihitung algoritma planner.js
BE.kobiPrefs = async text => {
  const { data, error } = await BE.sb.functions.invoke('kobi', { body: { mode: 'prefs', text } });
  if (error) { const status = error.context && error.context.status; if (status === 503 || status === 404) BE.kobiOff = true; return null; }
  return data && data.prefs;
};

// ---------- realtime ----------
BE.subscribe = () => {
  const f = { schema: 'public', filter: 'destination_id=eq.' + BE.dest };
  let schT = 0;
  BE.ch = BE.sb.channel('jelajah-' + BE.dest)
    .on('postgres_changes', { event: '*', table: 'item_status', ...f }, p => { if (p.new && p.new.key && BE.applyStatus(p.new)) BE.refreshView(); })
    .on('postgres_changes', { event: 'INSERT', table: 'announcements', ...f }, p => { const a = BE.addAnnc(p.new); if (a && currentView === 'app') { showBanner(a.text, a.t); a.seenByVisitor = true; } if (currentView === 'admin' && adminPage === 'pengumuman') enterAdmin('pengumuman'); })
    .on('postgres_changes', { event: '*', table: 'schedules', ...f }, () => { clearTimeout(schT); schT = setTimeout(async () => { await BE.loadSchedule(); if (currentView === 'app' && sideCur.v === 'jadwal') show('jadwal', {}, false); }, 400); })
    .subscribe();
};
BE.refreshView = () => {
  refreshPins();
  if (currentView === 'app') { if (st.route) showRoute(st.route.t); else if (['home', 'zone', 'poi'].includes(sideCur.v)) show(sideCur.v, sideCur.p, false); }
  else if (currentView === 'admin' && adminPage === 'ringkasan') enterAdmin('ringkasan');
};

// ---------- start ----------
BE.loadContent = async () => {
  const [d, z, p, a, q, s, ann] = await Promise.all([
    BE.sb.from('destinations').select('name, data_as_of, tickets, max_points').eq('id', BE.dest).maybeSingle(),
    BE.sb.from('zones').select('id, name, short_name, price, status, dwell, tags, description, tips, verified, plan').eq('destination_id', BE.dest),
    BE.sb.from('pois').select('id, name, verified').eq('destination_id', BE.dest),
    BE.sb.from('animals').select('id, name, name_en, latin, iucn, zone_id, fact').eq('destination_id', BE.dest),
    BE.sb.from('qr_points').select('id, name, hint').eq('destination_id', BE.dest),
    BE.sb.from('item_status').select('key, closed, verified').eq('destination_id', BE.dest),
    BE.sb.from('announcements').select('*').eq('destination_id', BE.dest).order('created_at', { ascending: false }).limit(30),
  ]);
  const bad = [d, z, p, a, q, s, ann].find(r => r.error); if (bad) throw bad.error;
  if (d.data) { if (d.data.data_as_of) DATA.meta.dataAsOf = d.data.data_as_of; if (d.data.tickets && d.data.tickets.entry) Object.assign(DATA.tickets, d.data.tickets); if (d.data.max_points) DATA.meta.plan.maxPoints = d.data.max_points; }
  for (const r of z.data) { const o = ZMAP[r.id]; if (!o) continue; Object.assign(o, { name: r.name, price: r.price, dwell: r.dwell, tags: r.tags || [], desc: r.description || '', tips: r.tips || '', status: r.status }); if (r.short_name) PIN_NAME[r.id] = r.short_name; if (r.plan && Object.keys(r.plan).length && DATA.planning) DATA.planning.zones[r.id] = r.plan; r.status === 'tutup' ? st.closedZones.add(r.id) : st.closedZones.delete(r.id); r.verified ? st.verified.add('z:' + r.id) : st.verified.delete('z:' + r.id); }
  for (const r of p.data) { const o = PMAP[r.id]; if (!o) continue; o.name = r.name; r.verified ? st.verified.add('p:' + r.id) : st.verified.delete('p:' + r.id); }
  for (const r of a.data) { const o = AMAP[r.id]; if (!o) continue; Object.assign(o, { name: r.name, en: r.name_en || o.en, latin: r.latin || o.latin, iucn: r.iucn || o.iucn, fact: r.fact || o.fact, zone: ZMAP[r.zone_id] ? r.zone_id : o.zone }); }
  for (const r of q.data) { const o = QMAP[r.id]; if (o) Object.assign(o, { name: r.name, hint: r.hint || o.hint }); }
  $('#qr-list').innerHTML = DATA.qr.map(x => `<button data-q="${x.id}">${ICO('qr')}<span><b>${esc(x.name)}</b><small>${esc(x.hint)}</small></span></button>`).join('');
  s.data.forEach(BE.applyStatus); st.closedZones.forEach(id => ZMAP[id] && S.setZoneClosed(id, true));
  st.annc = ann.data.map(mapAnnc);
  await BE.loadSchedule();
};
BE.loadManagerData = async () => {
  if (!session || session.role !== 'pengelola') return;
  const { data, error } = await BE.sb.from('change_log').select('*').eq('destination_id', BE.dest).order('created_at', { ascending: false }).limit(60);
  if (error) return beWarn('riwayat', error);
  st.log = data.reverse().map(mapLog);
};
BE.init = async () => {
  if (!BE.on) return;
  BE.sb.auth.onAuthStateChange(ev => { if (ev === 'PASSWORD_RECOVERY') setTimeout(BE.recover, 300); });
  try {
    const { data } = await BE.sb.auth.getSession();
    if (data && data.session) { session = await BE.profileFor(data.session.user); await BE.pullUser(session.email); }
  } catch (e) { beWarn('sesi', e); }
  try { await BE.loadContent(); await BE.loadManagerData(); BE.subscribe(); }
  catch (e) { beWarn('memuat data server (memakai data bawaan)', e); }
};
BE.ready = fn => { (BE.on ? BE.init() : Promise.resolve()).catch(e => beWarn('init', e)).finally(fn); };
