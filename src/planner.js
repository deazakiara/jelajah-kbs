// ============================================================
// PERENCANA ITINERARY
// Masalahnya: Orienteering Problem with Time Windows (OPTW), varian "Tourist Trip Design Problem".
//   - Tiap zona punya nilai (skor) sesuai preferensi rombongan, waktu kunjungan (dwell), dan bisa punya
//     jendela waktu (jadwal feeding/pertunjukan).
//   - Cari urutan zona dengan TOTAL SKOR TERBESAR yang muat dalam waktu tersedia (jalan kaki + kunjungan
//     + istirahat + jalan ke pintu keluar), tanpa melanggar aturan usia/akses.
// Penyelesaian: Iterated Local Search (Vansteenwegen dkk., 2009):
//   1) sisip-serakah: masukkan zona dengan rasio (tambahan skor)² / tambahan waktu terbesar di posisi terbaik,
//   2) 2-opt: perbaiki urutan supaya jalan kaki lebih pendek → ada waktu untuk zona lain,
//   3) guncang: buang beberapa zona berurutan lalu ulangi 1–2, simpan solusi terbaik.
// Jarak antar zona memakai Dijkstra di graf jalur (core.js), menghormati jalur yang ditutup & mode tanpa tangga.
// Hasilnya deterministik (input sama → itinerary sama) dan selesai dalam hitungan milidetik di HP.
// ============================================================
const PLAN = DATA.planning;
const PLAN_OPEN = 480, PLAN_CLOSE = 960, PLAN_EXITS = [['A', 'gerbang'], ['AB', 'selatan']];
const PLAN_GROUP_KEYS = ['dewasa', 'balita', 'anak', 'remaja', 'lansia'];
const PLAN_ACTS = { wahana: 'Wahana & bermain', show: 'Pertunjukan & feeding', foto: 'Spot foto' };
const PLAN_PACE = { santai: { label: 'Santai', dwell: 1.25, speed: 0.9 }, normal: { label: 'Normal', dwell: 1, speed: 1 }, cepat: { label: 'Cepat', dwell: 0.8, speed: 1.1 } };
const PLAN_DURS = [[60, '1 jam'], [120, '2 jam'], [180, '3 jam'], [240, '4 jam'], ['tutup', 'Sampai tutup']];

// ---------- preferensi ----------
function planPrefs(p = {}) {
  const set = v => new Set(v instanceof Set ? [...v] : Array.isArray(v) ? v : []);
  const group = set(p.group); if (!group.size) group.add('dewasa');
  const lansiaBalita = group.has('lansia') || group.has('balita');
  return {
    group, access: !!p.access, minutes: p.minutes === 'tutup' ? 'tutup' : Math.max(30, Math.min(480, +p.minutes || 120)),
    cats: set(p.cats), langka: !!p.langka, acts: set(p.acts), pace: PLAN_PACE[p.pace] ? p.pace : (lansiaBalita ? 'santai' : 'normal'),
    must: set(p.must), start: Number.isFinite(p.start) ? p.start : null,
  };
}
function planDesc(P) {
  const g = PLAN_GROUP_KEYS.filter(k => P.group.has(k)).map(k => PLAN.groups[k].label.replace(/ \(.*\)/, '')).join(' + ');
  const d = P.minutes === 'tutup' ? 'sampai tutup' : (P.minutes % 60 ? (P.minutes / 60).toFixed(1).replace('.', ',') : P.minutes / 60) + ' jam';
  return `${g} · ${d} · tempo ${PLAN_PACE[P.pace].label.toLowerCase()}${P.access ? ' · tanpa tangga' : ''}`;
}

// ---------- konteks: waktu mulai, kecepatan, jarak ----------
function planCtx(P) {
  const g = [...P.group];
  const speedF = Math.min(...g.map(x => PLAN.speed[x] || 1)) * PLAN_PACE[P.pace].speed;
  const restEvery = Math.min(...g.map(x => PLAN.restEvery[x] || 999));
  const avoidStairs = P.access || P.group.has('lansia');
  let start = P.start ?? wib().min, future = false;
  if (start < PLAN_OPEN || start > PLAN_CLOSE - 45) { start = PLAN_OPEN; future = true; }
  const budget = Math.min(P.minutes === 'tutup' ? Infinity : P.minutes, PLAN_CLOSE - start);
  const sp = startPos(), sNode = nearestNode(sp), memo = {};
  const D = n => memo[n] || (memo[n] = dijkstra(n, { access: avoidStairs }).D);
  const mpm = 66 * speedF;
  const events = {}; for (const s of DATA.schedule) (events[s.zone] = events[s.zone] || []).push({ t: toMin(s.t), dur: s.dur || 20, title: s.title });
  return { P, speedF, restEvery, avoidStairs, start, future, budget, sp, sNode, sOff: dist2(sp, NODES[sNode]), D, tmin: u => u * 5 / mpm, events, wantShow: P.acts.has('show'), heat: P.group.has('lansia') || P.group.has('balita') };
}

// ---------- skor & aturan per zona ----------
function planScoreZone(z, ctx) {
  const P = ctx.P, m = PLAN.zones[z.id]; if (!m) return null;
  if (st.closedZones.has(z.id)) return { out: 'Sedang ditutup pengelola' };
  const g = P.group, kids = g.has('balita') || g.has('anak'), why = [];
  if (P.access && m.access === false) return { out: 'Tidak ramah kursi roda/stroller' };
  if (g.has('lansia') && (m.effort || 0) >= 2) return { out: 'Banyak tangga, kurang nyaman untuk lansia' };
  if (m.ride) {
    const fits = [...g].filter(x => { const [a, b] = PLAN.groups[x].age; return b >= m.ride.min && a <= (m.ride.max ?? 99); });
    if (!fits.length) return { out: `${m.ride.note || 'Wahana'} untuk usia ${m.ride.min}${m.ride.max ? '–' + m.ride.max : '+'} th` };
  }
  let s = 1 + (z.hero ? 1.5 : 0);
  // tanpa pilihan satwa, rombongan dengan balita diasumsikan paling senang satwa yang bisa diajak berinteraksi
  const cats = P.cats.size ? P.cats : g.has('balita') ? new Set(['interaksi']) : P.cats;
  const match = (m.grp || []).filter(c => cats.has(c));
  if (match.length) { s += P.cats.size ? 4 : 2; why.push(PLAN.categories[match[0]]); } else if (!P.cats.size && m.act === 'satwa') s += 1;
  if (P.langka && z.tags.includes('langka')) { s += 2; why.push('Satwa langka'); }
  if (P.acts.has('wahana') && m.act === 'wahana') { s += 3; why.push('Wahana'); }
  if (P.acts.has('show') && m.act === 'show') { s += 2; why.push('Pertunjukan'); }
  if (P.acts.has('foto') && z.tags.includes('foto')) { s += 1.5; why.push('Spot foto'); }
  if (kids && m.kids) { s += m.kids * 1.8; if (m.kids >= 2) why.push(g.has('balita') && !g.has('anak') ? 'Disukai balita' : 'Favorit anak'); }
  if (m.ages) { if ([...g].some(x => m.ages.includes(x))) s += 3; else s *= 0.3; }
  if (!kids && m.act === 'wahana' && (m.kids || 0) >= 2 && !P.acts.has('wahana')) s *= 0.5;
  if (m.ride && kids) { s += 1; why.push(`Usia ${m.ride.min}${m.ride.max ? '–' + m.ride.max : '+'} th`); }
  if (g.has('lansia') && m.effort === 1) s -= 1;
  if (g.has('balita') && (m.effort || 0) >= 2) s -= 1;
  if (ctx.heat && m.indoor) why.push('Teduh');
  if (z.status === 'cek') { s -= 2; why.push('Cek status buka'); }
  if (P.must.has(z.id)) { s += 15; why.unshift('Pilihanmu'); }
  const dwell = Math.max(5, Math.round(z.dwell * PLAN_PACE[P.pace].dwell * (kids && m.act === 'wahana' ? 1.3 : 1)));
  return { score: Math.max(0.2, s), why, dwell };
}

// ---------- simulasi satu urutan ----------
function planEval(route, ctx, C) {
  let t = ctx.start + ctx.tmin(ctx.sOff), node = ctx.sNode, units = ctx.sOff, score = 0, lastRest = ctx.start;
  const visits = [];
  for (let i = 0; i < route.length; i++) {
    const id = route[i], z = ZMAP[id], c = C[id], u = ctx.D(node)[z.node];
    if (!isFinite(u)) return null;
    units += u; const walkMin = ctx.tmin(u); t += walkMin;
    let wait = 0, ev = null, bonus = 0;
    for (const e of ctx.events[id] || []) {
      if (ctx.wantShow && t < e.t && e.t - t <= 20) { wait = e.t - t; t = e.t; ev = e; bonus = 4; break; }
      if (t >= e.t - 5 && t <= e.t + e.dur - 5) { ev = e; bonus = ctx.wantShow ? 4 : 1.5; break; }
    }
    const arrive = t; t += c.dwell;
    if (ctx.heat && PLAN.zones[id] && PLAN.zones[id].indoor && arrive >= 660 && arrive <= 840) bonus += 1;
    score += c.score + bonus;
    let rest = false;
    if (i < route.length - 1 && t - lastRest >= ctx.restEvery) { t += PLAN.restMin + 3; lastRest = t; rest = true; }
    visits.push({ id, arrive, walk: walkMin, wait, ev, rest, node: z.node });
    node = z.node;
  }
  let ex = Infinity, exit = PLAN_EXITS[0]; for (const e of PLAN_EXITS) { const u = ctx.D(node)[e[0]]; if (u < ex) { ex = u; exit = e; } }
  if (!isFinite(ex)) ex = 0;
  units += ex; t += ctx.tmin(ex);
  return { t, score, units, visits, exit, ok: t - ctx.start <= ctx.budget + 0.01 && t <= PLAN_CLOSE + 0.01 };
}

// ---------- Iterated Local Search ----------
function planOptimize(ctx, C, ids) {
  const ev = r => planEval(r, ctx, C);
  const better = (a, b) => a.score > b.score + 1e-6 || (Math.abs(a.score - b.score) <= 1e-6 && a.t < b.t - 0.01);
  const insertAll = (route, e) => {
    for (;;) {
      let best = null;
      for (const id of ids) {
        if (route.includes(id)) continue;
        for (let p = 0; p <= route.length; p++) {
          const r = route.slice(0, p).concat(id, route.slice(p)), e2 = ev(r);
          if (!e2 || !e2.ok) continue;
          const gain = e2.score - e.score; if (gain <= 0) continue;
          const ratio = gain * gain / Math.max(0.5, e2.t - e.t);
          if (!best || ratio > best.ratio + 1e-9) best = { r, e: e2, ratio };
        }
      }
      if (!best) return [route, e];
      route = best.r; e = best.e;
    }
  };
  const twoOpt = (route, e) => {
    for (let improved = true; improved;) {
      improved = false;
      for (let i = 0; i < route.length - 1; i++) for (let j = i + 1; j < route.length; j++) {
        const r = route.slice(0, i).concat(route.slice(i, j + 1).reverse(), route.slice(j + 1)), e2 = ev(r);
        if (e2 && e2.ok && better(e2, e)) { route = r; e = e2; improved = true; }
      }
    }
    return [route, e];
  };
  let cur = [], curE = ev(cur);
  if (!curE || !curE.ok) return { route: [], e: curE };
  [cur, curE] = insertAll(cur, curE); [cur, curE] = twoOpt(cur, curE); [cur, curE] = insertAll(cur, curE);
  let best = cur, bestE = curE, S = 0, R = 1, stale = 0;
  for (let it = 0; it < 120 && stale < 30 && cur.length > 1; it++) {
    const n = cur.length, gone = new Set();
    for (let k = 0; k < R; k++) gone.add(cur[(S + k) % n]);
    let r = cur.filter(x => !gone.has(x)), e = ev(r);
    if (!e || !e.ok) { r = best.slice(); e = bestE; }
    [r, e] = twoOpt(r, e); [r, e] = insertAll(r, e);
    cur = r; curE = e;
    if (better(e, bestE)) { best = r; bestE = e; R = 1; stale = 0; } else { R++; stale++; }
    S = (S + R) % Math.max(1, cur.length);
    if (R > Math.max(1, Math.floor(cur.length / 2))) R = 1;
    if (stale && stale % 10 === 0) { cur = best.slice(); curE = bestE; }
  }
  return { route: best, e: bestE };
}

// ---------- titik istirahat ----------
function planRestSpot(node, ctx) {
  const D = ctx.D(node); let best = { kuliner: null, toilet: null };
  for (const p of POIS) {
    if (st.closedPois.has(p.id) || !['kuliner', 'toilet'].includes(p.type)) continue;
    const u = D[nearestNode(p.pos)] + dist2(NODES[nearestNode(p.pos)], p.pos);
    if (!best[p.type] || u < best[p.type].u) best[p.type] = { p, u };
  }
  return { food: best.kuliner && best.kuliner.p, toilet: best.toilet && best.toilet.p };
}

// ---------- API utama ----------
function planItinerary(prefsIn) {
  const P = planPrefs(prefsIn), ctx = planCtx(P), C = {}, out = [];
  for (const z of ZONES) {
    if (z.cat === 'staf' || z.cat === 'layanan') continue;
    const c = planScoreZone(z, ctx); if (!c) continue;
    if (c.out) { out.push({ id: z.id, why: c.out }); continue; }
    if (!isFinite(ctx.D(ctx.sNode)[z.node])) { out.push({ id: z.id, why: ctx.avoidStairs ? 'Hanya bisa lewat jembatan bertangga' : 'Jalur ke sini sedang ditutup' }); continue; }
    if (c.score < 1 && !P.must.has(z.id)) continue; // terlalu kecil manfaatnya untuk rombongan ini
    C[z.id] = c;
  }
  const ids = Object.keys(C).sort((a, b) => C[b].score - C[a].score || (a < b ? -1 : 1));
  const { route, e } = planOptimize(ctx, C, ids);
  const left = ids.filter(id => !route.includes(id) && (C[id].score >= 5 || P.must.has(id))).slice(0, 5).map(id => ({ id, why: 'Tidak cukup waktu' }));
  return planResult(P, ctx, C, route, e, out.concat(left));
}
// urutan tetap (rencana tersimpan): hanya dihitung ulang waktunya
function planFixed(ids, prefsIn) {
  const P = planPrefs(prefsIn), ctx = planCtx(P), C = {};
  ctx.budget = Infinity;
  const route = ids.filter(id => ZMAP[id] && !st.closedZones.has(id) && isFinite(ctx.D(ctx.sNode)[ZMAP[id].node]));
  for (const id of route) C[id] = planScoreZone(ZMAP[id], ctx) || { score: 1, why: [], dwell: ZMAP[id].dwell };
  for (const id of route) if (C[id].out) C[id] = { score: 1, why: [C[id].out], dwell: ZMAP[id].dwell };
  return planResult(P, ctx, C, route, planEval(route, ctx, C), ids.filter(id => !route.includes(id)).map(id => ({ id, why: st.closedZones.has(id) ? 'Sedang ditutup pengelola' : 'Tidak terjangkau' })));
}
function planResult(P, ctx, C, route, e, excluded) {
  const stops = (e ? e.visits : []).map(v => {
    const c = C[v.id], why = c.why.slice(0, 3);
    if (v.ev) why.unshift(`${v.ev.title} ${hhmm(v.ev.t)}`);
    return { id: v.id, arrive: Math.round(v.arrive), walk: Math.max(1, Math.round(v.walk)), dwell: c.dwell, wait: Math.round(v.wait), event: v.ev ? { title: v.ev.title, t: v.ev.t } : null, why, rest: v.rest ? planRestSpot(v.node, ctx) : null };
  });
  return {
    prefs: P, desc: planDesc(P), stops, start: ctx.start, end: e ? Math.round(e.t) : ctx.start, future: ctx.future,
    totalM: e ? Math.round(e.units * 5) : 0, exit: e ? e.exit[1] : 'gerbang', avoidStairs: ctx.avoidStairs,
    excluded: excluded.filter(x => ZMAP[x.id]).map(x => ({ id: x.id, name: ZMAP[x.id].name, why: x.why })),
  };
}
// kompatibel dengan pemanggil lama (versi HP & Kobi lama): plan({interests, minutes, access})
function plan({ interests, minutes, access }) {
  const I = new Set(interests || []), group = ['dewasa'];
  if (I.has('anak')) group.push('anak');
  const cats = ['reptil', 'burung', 'primata', 'kucing', 'air'].filter(k => I.has(k));
  const acts = [['wahana', 'wahana'], ['foto', 'foto'], ['edukasi', 'show']].filter(([k]) => I.has(k)).map(([, a]) => a);
  return planItinerary({ group, cats, acts, langka: I.has('langka'), minutes, access, pace: 'normal' }).stops.map(s => ({ id: s.id, walk: s.walk, dwell: s.dwell }));
}

// ---------- ringkasan teks (untuk Kobi) ----------
function planSummary(res) {
  if (!res.stops.length) return 'Waktunya terlalu singkat untuk menyusun rencana. Coba tambah durasi atau kurangi syaratnya.';
  const dur = res.end - res.start, h = Math.floor(dur / 60), m = dur % 60;
  const lines = res.stops.map((s, i) => {
    let l = `${i + 1}. ${hhmm(s.arrive)} ${ZMAP[s.id].name} (±${s.dwell} mnt)${s.why.length ? ' · ' + s.why.slice(0, 2).join(', ') : ''}`;
    if (s.rest) l += `\n   Istirahat ${PLAN.restMin} mnt di ${s.rest.food ? s.rest.food.name : 'tempat duduk terdekat'}`;
    return l;
  });
  const out = res.excluded.filter(x => x.why !== 'Tidak cukup waktu').slice(0, 3);
  return `Rencana ${res.desc}${res.future ? ', mulai saat buka 08.00' : ''}:\n${lines.join('\n')}\nSelesai ±${hhmm(res.end)} di ${ZMAP[res.exit].name} · ${h ? h + ' jam ' : ''}${m ? m + ' mnt' : ''}, jalan kaki ${fmtD(res.totalM)}.` +
    (out.length ? `\nTidak dimasukkan: ${out.map(x => `${x.name} (${x.why.toLowerCase()})`).join('; ')}.` : '');
}

// ---------- pemahaman bahasa (tanpa AI): ambil preferensi dari kalimat ----------
const PLAN_NLU = {
  cats: { kucing: /harimau|singa|macan|kucing besar|tiger|lion/, primata: /primata|monyet|orang ?utan|kera|lemur|siamang|bekantan|lutung|baboon/, burung: /burung|jalak|kakatua|rangkong|flamingo|pelikan|unggas/, reptil: /komodo|reptil|ular|buaya|kadal|biawak/, savana: /gajah|jerapah|zebra|kuda nil|savana|sabana|banteng|rusa|beruang/, air: /akuarium|aquarium|ikan|hiu|penyu|nokturnal|satwa malam|aquanoctudio|trenggiling/, interaksi: /kids zoo|kelinci|domba|elus|interaksi|kasih makan|memberi makan/ },
  acts: { wahana: /wahana|bermain|main\b|playground|perosotan|kolam|renang|go.?kart|naik unta|tunggang|outbound/, show: /pertunjukan|show|atraksi|feeding|edukasi|animal story/, foto: /foto|selfie/ },
};
const PLAN_WORDNUM = { satu: 1, se: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6 };
function planExtract(text) {
  const s = norm(text), x = { ans: {} }, group = new Set();
  // durasi
  let m;
  if (/sampai tutup|seharian|sepuasnya|full ?day|sampai sore/.test(s)) x.minutes = 'tutup';
  else if (/setengah hari/.test(s)) x.minutes = 240;
  else if ((m = s.match(/(\d+(?:[.,]\d+)?)\s*(jam|j\b|hour)/))) x.minutes = Math.round(parseFloat(m[1].replace(',', '.')) * 60);
  else if ((m = s.match(/\b(satu|dua|tiga|empat|lima|enam)\s*jam|\bsejam\b/))) x.minutes = (PLAN_WORDNUM[m[1]] || 1) * 60;
  else if ((m = s.match(/(\d+)\s*(menit|mnt)/))) x.minutes = +m[1];
  if (x.minutes !== undefined) x.ans.minutes = true;
  // rombongan
  for (const n of [...s.matchAll(/(\d{1,2})\s*(th|thn|tahun|taun|yo)\b/g)].map(r => +r[1])) group.add(n <= 4 ? 'balita' : n <= 12 ? 'anak' : n <= 17 ? 'remaja' : n >= 60 ? 'lansia' : 'dewasa');
  if (/balita|bayi|batita|toddler|anak kecil|masih kecil/.test(s)) group.add('balita');
  if (/\banak|bocil|keponakan|cucu|\bsd\b/.test(s) && !/anak kecil/.test(s) && !group.has('anak') && !group.has('balita') && !group.has('remaja')) group.add('anak');
  if (/remaja|abg|\bsmp\b|\bsma\b|teen/.test(s)) group.add('remaja');
  if (/lansia|nenek|kakek|eyang|\bmbah|\boma\b|\bopa\b|manula|sepuh|orang tua lanjut/.test(s)) group.add('lansia');
  if (/dewasa|sendiri|berdua|pasangan|pacar|teman|istri|suami|keluarga|ayah|ibu|ortu/.test(s) || group.size) group.add('dewasa');
  if (group.size) { x.group = group; x.ans.group = true; }
  if (/kursi roda|stroller|kereta (dorong|bayi)|tongkat|walker|disabilitas|difabel|susah jalan|tanpa tangga/.test(s)) x.access = true;
  // satwa
  const cats = Object.entries(PLAN_NLU.cats).filter(([, r]) => r.test(s)).map(([k]) => k);
  if (cats.length) { x.cats = new Set(cats); x.ans.cats = true; }
  if (/langka|terancam|dilindungi/.test(s)) { x.langka = true; x.ans.cats = true; }
  if (/semua (boleh|satwa|hewan)|bebas|apa saja|terserah|semuanya/.test(s)) x.ans.cats = true;
  // kegiatan
  const acts = Object.entries(PLAN_NLU.acts).filter(([, r]) => r.test(s)).map(([k]) => k);
  if (acts.length) { x.acts = new Set(acts); x.ans.acts = true; }
  if (/satwa saja|lihat satwa aja|tidak usah|nggak usah|gak usah|ga usah|tidak ada/.test(s)) x.ans.acts = true;
  // tempo
  if (/santai|pelan|capek|lelah|nggak buru|tidak buru|gak buru/.test(s)) x.pace = 'santai';
  else if (/cepat|buru|singkat|kilat/.test(s)) x.pace = 'cepat';
  return x;
}
// hasil ekstraksi AI (edge function) → bentuk yang sama dengan planExtract
function planFromAI(j) {
  if (!j || typeof j !== 'object') return null; const x = { ans: {} };
  const pick = (arr, ok) => Array.isArray(arr) ? arr.filter(v => ok.includes(v)) : [];
  const g = pick(j.grup, PLAN_GROUP_KEYS); if (g.length) { x.group = new Set(g); if (!x.group.has('dewasa') && !(g.length === 1 && g[0] === 'lansia')) x.group.add('dewasa'); x.ans.group = true; }
  if (j.kursi_roda === true) x.access = true;
  if (j.durasi_menit === 'tutup' || Number.isFinite(+j.durasi_menit) && +j.durasi_menit > 0) { x.minutes = j.durasi_menit === 'tutup' ? 'tutup' : Math.round(+j.durasi_menit); x.ans.minutes = true; }
  const c = pick(j.kategori, Object.keys(PLAN.categories)); if (c.length) { x.cats = new Set(c); x.ans.cats = true; }
  if (j.langka === true) { x.langka = true; x.ans.cats = true; }
  const a = pick(j.kegiatan, Object.keys(PLAN_ACTS)); if (a.length) { x.acts = new Set(a); x.ans.acts = true; }
  if (PLAN_PACE[j.tempo]) x.pace = j.tempo;
  return x;
}

// ---------- dialog Kobi: tanya beberapa hal lalu susun itinerary ----------
const PLAN_INTENT = /itinerar|itenerar|itinerer|rencana|susun|rute .*jam|jadwal kunjungan|keliling|urutan kunjungan|mau ke mana (aja|saja|dulu)|rekomendasi rute|paket kunjungan|\bplan\b/;
const PLAN_MODIFY = /lebih santai|lebih cepat|tambah\s*(\d+\s*)?jam|kurangi\s*(\d+\s*)?jam|ulang(i)? dari awal|susun ulang/;
const PLAN_Q = {
  group: { text: 'Siapa saja yang ikut berkunjung?', chips: ['Dewasa saja', 'Bawa balita (0–4 th)', 'Bawa anak (5–12 th)', 'Ada lansia', 'Anak dan lansia', 'Pakai kursi roda/stroller'] },
  minutes: { text: 'Berapa lama mau berkeliling?', chips: ['1 jam', '2 jam', '3 jam', 'Setengah hari (4 jam)', 'Sampai tutup'] },
  cats: { text: 'Satwa apa yang paling ingin dilihat? Boleh sebut lebih dari satu.', chips: ['Harimau & singa', 'Primata', 'Burung', 'Komodo & reptil', 'Gajah & savana', 'Akuarium & satwa malam', 'Satwa langka', 'Semua boleh'] },
  acts: { text: 'Selain lihat satwa, mau ada kegiatan apa?', chips: ['Wahana & bermain', 'Pertunjukan & feeding', 'Spot foto', 'Lihat satwa saja'] },
};
function planMerge(K, x) {
  if (!x) return;
  for (const k of ['minutes', 'pace']) if (x[k] !== undefined) K.prefs[k] = x[k];
  if (x.access) K.prefs.access = true;
  if (x.langka) K.prefs.langka = true;
  if (x.group) K.prefs.group = new Set([...(K.prefs.group || []), ...x.group]);
  if (x.cats) K.prefs.cats = new Set([...(K.prefs.cats || []), ...x.cats]);
  if (x.acts) K.prefs.acts = new Set([...(K.prefs.acts || []), ...x.acts]);
  Object.assign(K.ans, x.ans);
}
function kobiPlanTurn(text, aiPrefs) {
  const s = norm(text), K = st.kobiPlan || (st.kobiPlan = { active: false, prefs: {}, ans: {}, last: null });
  const modify = !!K.last && PLAN_MODIFY.test(s);
  if (!K.active && !modify && !PLAN_INTENT.test(s)) return null;
  if (K.active && /\b(batal|nggak jadi|gak jadi|tidak jadi)\b/.test(s)) { K.active = false; return { text: 'Oke, tidak jadi. Kalau mau disusun lagi, ketik "susun itinerary".' }; }
  if (/ulang(i)? dari awal|susun ulang|reset/.test(s)) { Object.assign(K, { active: true, prefs: {}, ans: {}, last: null }); return planAsk(K, 'Siap, kita mulai dari awal.'); }
  if (modify) {
    K.prefs = Object.assign({}, K.last.prefs, { group: new Set(K.last.prefs.group), cats: new Set(K.last.prefs.cats), acts: new Set(K.last.prefs.acts) });
    const cur = K.prefs.minutes === 'tutup' ? Math.max(60, PLAN_CLOSE - Math.max(PLAN_OPEN, wib().min)) : K.prefs.minutes; let m;
    if (/lebih santai/.test(s)) K.prefs.pace = 'santai';
    if (/lebih cepat/.test(s)) K.prefs.pace = 'cepat';
    if ((m = s.match(/tambah\s*(\d+)?\s*jam/))) K.prefs.minutes = Math.min(480, cur + 60 * (+m[1] || 1));
    if ((m = s.match(/kurangi\s*(\d+)?\s*jam/))) K.prefs.minutes = Math.max(60, cur - 60 * (+m[1] || 1));
    return planDone(K);
  }
  if (!K.active) Object.assign(K, { active: true, prefs: {}, ans: {} });
  planMerge(K, planExtract(text)); planMerge(K, aiPrefs);
  return planAsk(K);
}
function planNeeded(K) {
  const kidsOrUnknown = !K.prefs.group || K.prefs.group.has('balita') || K.prefs.group.has('anak') || K.prefs.group.has('remaja');
  return ['group', 'minutes', 'cats', ...(kidsOrUnknown ? ['acts'] : [])].find(k => !K.ans[k]);
}
function planAsk(K, lead = '') {
  const q = planNeeded(K);
  if (!q) return planDone(K);
  const first = !Object.keys(K.ans).length && !lead;
  return { text: (lead ? lead + ' ' : first ? 'Siap, aku susunkan itinerary yang pas. ' : '') + PLAN_Q[q].text, chips: PLAN_Q[q].chips };
}
function planDone(K) {
  const res = planItinerary(K.prefs); K.last = res; K.active = false;
  return { text: planSummary(res), actions: res.stops.length ? [{ type: 'itin', res }] : [], chips: ['Lebih santai', 'Tambah 1 jam', 'Kurangi 1 jam', 'Ulang dari awal'] };
}

// ---------- garis rute di peta (melewati titik istirahat) ----------
function planGeometry(res) {
  let pts = [], pos = startPos(); const opts = { access: res.avoidStairs };
  const go = t => { const r = pathPts(pos, t, opts); if (!r) return; pts = pts.length ? pts.concat(r.pts.slice(1)) : r.pts; pos = t.kind === 'p' ? t.pos : NODES[t.node]; };
  for (const s of res.stops) { go(target('z', s.id)); if (s.rest && s.rest.food) go(target('p', s.rest.food.id)); }
  return Object.assign({}, res, { pts });
}
