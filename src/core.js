// ============================================================
// CORE — logika bersama (data, routing, planner, Kobi) untuk versi HP & web
// ============================================================
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ICO = (n, c = '') => `<svg class="ico ${c}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const KOBI = (c = '') => `<svg class="${c}" viewBox="0 0 48 48" aria-hidden="true"><use href="#i-kobi"/></svg>`;
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const fmtN = n => Number(n).toLocaleString('id-ID');

const CAT = {
  satwa: { label: 'Satwa', color: 'var(--leaf)' }, wahana: { label: 'Wahana', color: 'var(--mango-deep)' },
  layanan: { label: 'Layanan', color: 'var(--water)' }, staf: { label: 'Area staf', color: 'var(--stone)' },
};
const POI_T = {
  toilet: { label: 'Toilet', icon: 'toilet', color: 'var(--water)' }, ibadah: { label: 'Tempat ibadah', icon: 'mosque', color: 'var(--primary)' },
  kuliner: { label: 'Kuliner', icon: 'food', color: 'var(--coral)' }, info: { label: 'Informasi', icon: 'info', color: 'var(--berry)' },
  p3k: { label: 'P3K', icon: 'firstaid', color: 'var(--berry)' }, laktasi: { label: 'Ruang laktasi', icon: 'baby', color: 'var(--berry)' },
  souvenir: { label: 'Suvenir', icon: 'shop', color: 'var(--mango-deep)' }, kursiroda: { label: 'Kursi roda', icon: 'wheelchair', color: 'var(--water)' },
  foto: { label: 'Spot foto', icon: 'camera', color: 'var(--plum)' }, loket: { label: 'Loket tiket', icon: 'ticket', color: 'var(--primary)' },
};
const IUCN = { CR: 'Kritis', EN: 'Genting', VU: 'Rentan', NT: 'Hampir terancam', LC: 'Risiko rendah', DD: 'Kurang data', DOM: 'Domestik' };
const PIN_NAME = { gerbang: 'Pintu Utama', selatan: 'Pintu Selatan', pos12: 'Parkir · Pos 12', aviary: 'Aviary', aves: 'Rumah Burung', menara: 'Menara', perahu: 'Perahu & Bekantan', aoudad: 'Pulau Siamang', panggung: 'Animal Story', unta: 'Tunggang Unta', komodo: 'Komodo', reptil: 'Reptil & Buaya', kucing: 'Harimau', primata: 'Primata', gajah: 'Gajah', gokart: 'Go-Kart', sabana: 'Sabana Afrika', kudanil: 'Kuda Nil', herbivora: 'Rusa & Banteng', beruang: 'Beruang Madu', konservasi: 'Konservasi', nursery: 'Nursery', karantina: 'Karantina', masjid: 'Masjid', aquanoctudio: 'Aquanoctudio', direksi: 'Direksi', sekretariat: 'Sekretariat', kidszoo: 'Kids Zoo', jamur: 'Rumah Jamur', rainbow: 'Rainbow Park', giz: 'GIZ Park', plaza: 'Plaza Tengah', kolam: 'Kolam Anak' };
const PIN_Y = { menara: 8.6, aviary: 4.6, gerbang: 4.8, aquanoctudio: 5.6, masjid: 5.2, giz: 4.8, panggung: 3.6, jamur: 3.9, sabana: 3.6, gajah: 3.2, primata: 3.4, perahu: 3.2, aoudad: 3.4, selatan: 3.4, kidszoo: 3.2, rainbow: 3.6 };
const PRIO = new Set(['komodo', 'perahu', 'gajah', 'sabana', 'kucing', 'aquanoctudio', 'kidszoo', 'aviary', 'gerbang', 'primata', 'jamur', 'selatan']);
const FILTERS = [
  { id: 'semua', label: 'Semua', icon: 'map' }, { id: 'satwa', label: 'Satwa', icon: 'paw', c: 'var(--leaf)' }, { id: 'wahana', label: 'Wahana', icon: 'ride', c: 'var(--mango-deep)' },
  { id: 'toilet', label: 'Toilet', icon: 'toilet', c: 'var(--water)' }, { id: 'ibadah', label: 'Ibadah', icon: 'mosque', c: 'var(--primary-ink)' }, { id: 'kuliner', label: 'Kuliner', icon: 'food', c: 'var(--coral)' },
  { id: 'darurat', label: 'Info & P3K', icon: 'firstaid', c: 'var(--berry)' }, { id: 'foto', label: 'Spot foto', icon: 'camera', c: 'var(--plum)' }, { id: 'akses', label: 'Pintu & parkir', icon: 'gate', c: 'var(--water)' },
];
const FILTER_POI = { toilet: ['toilet'], ibadah: ['ibadah'], kuliner: ['kuliner'], darurat: ['info', 'p3k', 'laktasi', 'kursiroda'], foto: ['foto'], akses: ['loket'] };
const FILTER_ZONE = { satwa: z => z.cat === 'satwa', wahana: z => z.cat === 'wahana', ibadah: z => z.id === 'masjid', akses: z => ['gerbang', 'selatan', 'pos12'].includes(z.id), foto: z => ['menara', 'plaza'].includes(z.id) };

const ZONES = DATA.zones, ZMAP = Object.fromEntries(ZONES.map(z => [z.id, z]));
const POIS = DATA.pois, PMAP = Object.fromEntries(POIS.map(p => [p.id, p]));
const AMAP = Object.fromEntries(DATA.animals.map(a => [a.id, a]));
const QMAP = Object.fromEntries(DATA.qr.map(q => [q.id, q]));

const st = {
  user: null, filter: 'semua', sel: null, tab: 'peta', night: false, zoom: 140,
  closedZones: new Set(), closedEdges: new Set(), closedPois: new Set(),
  verified: new Set([...ZONES.filter(z => z.verified).map(z => 'z:' + z.id), ...POIS.filter(p => p.verified).map(p => 'p:' + p.id)]),
  log: [], route: null, plan: null, avoidStairs: false, reminders: new Set(), chat: [], kobiBusy: false,
  planner: { interests: new Set(['anak', 'langka']), minutes: 120 },
};
ZONES.forEach(z => { if (z.status === 'tutup') st.closedZones.add(z.id); });

// ---------- time (WIB) ----------
function wib() { const d = new Date(Date.now() + 7 * 3600e3); return { h: d.getUTCHours(), m: d.getUTCMinutes(), day: d.getUTCDay(), date: d.getUTCDate(), month: d.getUTCMonth(), min: d.getUTCHours() * 60 + d.getUTCMinutes() }; }
const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const hhmm = m => String(Math.floor(m / 60) % 24).padStart(2, '0') + '.' + String(Math.round(m % 60)).padStart(2, '0');
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const isOpenNow = () => { const n = wib().min; return n >= 480 && n < 960; };

// ---------- graph & routing ----------
// NODES = DATA.nodes (didefinisikan di scene.js)
const ADJ = {};
DATA.edges.forEach(([a, b, f = {}]) => { const d = dist2(NODES[a], NODES[b]); (ADJ[a] = ADJ[a] || []).push({ n: b, d, f }); (ADJ[b] = ADJ[b] || []).push({ n: a, d, f }); });
function dijkstra(src, { access = false, ignoreClosed = false } = {}) {
  const D = {}, P = {}, Q = new Set(Object.keys(NODES)); for (const k of Q) D[k] = Infinity; D[src] = 0;
  while (Q.size) { let u = null, best = Infinity; for (const k of Q) if (D[k] < best) { best = D[k]; u = k; } if (u === null) break; Q.delete(u);
    for (const e of ADJ[u] || []) { if (!ignoreClosed && e.f.id && st.closedEdges.has(e.f.id)) continue; if (access && e.f.s) continue; const nd = D[u] + e.d; if (nd < D[e.n]) { D[e.n] = nd; P[e.n] = u; } } }
  return { D, P };
}
function nearestNode(p) { let best = 'A', bd = Infinity; for (const [k, q] of Object.entries(NODES)) { if (k === 'PL') continue; const d = dist2(p, q); if (d < bd) { bd = d; best = k; } } return best; }
const startPos = () => st.user ? st.user.pos : NODES.A;
const startName = () => st.user ? st.user.name : 'Pintu Utama';
let dcache = null;
function fromStart(access = st.avoidStairs) { const key = (st.user ? st.user.id : '-') + '|' + [...st.closedEdges].join() + '|' + access; if (dcache && dcache.key === key) return dcache; const src = nearestNode(startPos()); dcache = { key, src, ...dijkstra(src, { access }) }; return dcache; }
const nodeCache = {};
function fromNode(n) { const key = n + '|' + [...st.closedEdges].join(); if (!nodeCache[key]) nodeCache[key] = dijkstra(n); return nodeCache[key]; }
function target(kind, id) { if (kind === 'z') { const z = ZMAP[id]; return { kind, id, name: z.name, pos: z.pos, node: z.node }; } const p = PMAP[id]; return { kind, id, name: p.name, pos: p.pos, node: nearestNode(p.pos) }; }
function walk(t) { const c = fromStart(); const units = (c.D[t.node] ?? Infinity) + dist2(startPos(), NODES[c.src]) + (t.kind === 'p' ? dist2(NODES[t.node], t.pos) : 0); const m = units * 5; return { m, min: Math.max(1, Math.round(m / 66)), ok: isFinite(units) }; }
const fmtD = m => m < 1000 ? (Math.round(m / 10) * 10) + ' m' : (m / 1000).toFixed(1).replace('.', ',') + ' km';
function pathPts(fromPos, toT, opts = {}) {
  const src = nearestNode(fromPos); const { D, P } = dijkstra(src, opts); if (!isFinite(D[toT.node])) return null;
  const nodes = [toT.node]; while (P[nodes[0]]) nodes.unshift(P[nodes[0]]);
  const pts = [fromPos, ...nodes.map(n => NODES[n])]; if (toT.kind === 'p') pts.push(toT.pos);
  let units = 0; for (let i = 1; i < pts.length; i++) units += dist2(pts[i - 1], pts[i]);
  let stairs = false; for (let i = 1; i < nodes.length; i++) { const e = (ADJ[nodes[i - 1]] || []).find(x => x.n === nodes[i]); if (e && e.f.s) stairs = true; }
  return { pts, nodes, units, m: units * 5, min: Math.max(1, Math.round(units * 5 / 66)), stairs };
}
function landmarksOf(nodes, exclude) { const out = []; const seen = new Set(); for (const n of nodes.slice(1, -1)) { const z = ZONES.find(z => z.node === n && z.cat !== 'staf' && z.id !== exclude && !seen.has(z.id)); if (z) { seen.add(z.id); out.push(z); } if (n === 'I') out.push({ id: '_bridge', name: 'Jembatan Cinta' }); } return out; }
function nearestOf(type, fromNode) { const { D } = fromNode ? fromNode : fromStart(); let best = null; for (const p of POIS) { if (p.type !== type || st.closedPois.has(p.id)) continue; const n = nearestNode(p.pos); const u = D[n] + dist2(NODES[n], p.pos); if (!best || u < best.u) best = { p, u }; } return best; }


// ---------- planner ----------
const INTERESTS = [['langka', 'Satwa langka', 'shield'], ['anak', 'Bersama anak', 'users'], ['reptil', 'Komodo & reptil', 'paw'], ['burung', 'Burung', 'bird'], ['primata', 'Primata', 'paw'], ['kucing', 'Harimau', 'paw'], ['wahana', 'Wahana & bermain', 'ride'], ['foto', 'Spot foto', 'camera'], ['edukasi', 'Edukasi', 'sparkle'], ['air', 'Air & perahu', 'boat']];
// plan() & perencana itinerary ada di planner.js

// ---------- Kobi: data, aturan, parser, jawaban lokal ----------
function resolveId(id) { id = String(id).trim(); if (ZMAP[id]) return target('z', id); if (PMAP[id]) return target('p', id); return null; }
function parseActions(text) {
  const i = text.search(/\n?\s*AKSI\s*:/i); if (i < 0) return { body: text.trim(), actions: [] };
  const body = text.slice(0, i).trim(), line = text.slice(i).replace(/^\s*AKSI\s*:/i, ''); const actions = [];
  const lm = line.match(/lihat\s*=\s*([\w\-, ]+)/i); if (lm) lm[1].split(',').slice(0, 3).forEach(id => { const t = resolveId(id); if (t) actions.push({ type: 'lihat', t }); });
  const rm = line.match(/rute\s*=\s*([\w\-]+)/i); if (rm) { const t = resolveId(rm[1]); if (t) actions.push({ type: 'rute', t }); }
  return { body, actions };
}
function kobiData() {
  const n = wib();
  const zones = ZONES.filter(z => z.cat !== 'staf').map(z => { const w = walk(target('z', z.id)); return `${z.id} | ${z.name} | ${CAT[z.cat].label} | ${z.price} | ${st.closedZones.has(z.id) ? 'TUTUP SEMENTARA' : z.status === 'cek' ? 'status perlu dicek' : 'buka'} | ${w.ok ? w.min + ' mnt jalan (' + fmtD(w.m) + ')' : 'jalur tertutup'} | satwa: ${(z.animals || []).map(a => AMAP[a] && AMAP[a].name).filter(Boolean).join(', ') || '-'} | ${z.desc} ${z.tips || ''}`; }).join('\n');
  const pois = POIS.map(p => { const w = walk(target('p', p.id)); return `${p.id} | ${p.name} | ${POI_T[p.type].label} | ${w.min} mnt jalan (${fmtD(w.m)}) | ${st.closedPois.has(p.id) ? 'TUTUP' : 'tersedia'}${p.verified ? '' : ' | lokasi belum diverifikasi'}`; }).join('\n');
  const animals = DATA.animals.map(a => `${a.name} (${a.en}; ${a.latin}; IUCN ${a.iucn}) di zona ${a.zone}: ${a.fact}`).join('\n');
  const sched = DATA.schedule.map(s => `${s.t} ${s.title} di ${ZMAP[s.zone].name} [zona ${s.zone}] (${s.note})`).join('\n');
  const T = DATA.tickets;
  const tk = [...T.entry.map(e => `${e.label}: ${e.price} ${e.note}`), ...T.bundles.map(b => `Paket ${b.code} ${b.price}: ${b.items}`), ...T.rides.map(r => `${r.label}: ${r.price}`), ...T.parking.map(r => `Parkir ${r.label}: ${r.price}`), T.asOf, 'Pembayaran hanya non-tunai: QRIS dan Brizzi.'].join('\n');
  const closedE = [...st.closedEdges].map(e => e === 'jembatan' ? 'Jembatan Cinta' : e).join(', ');
  return `LOKASI PENGGUNA: ${st.user ? st.user.name + ' (dari QR)' : 'belum memindai QR; anggap dari Pintu Utama'}\nWAKTU SEKARANG: ${DAYS[n.day]} ${hhmm(n.min)} WIB. Jam buka KBS 08.00–16.00 setiap hari.\n${closedE ? 'JALUR DITUTUP: ' + closedE + '\n' : ''}${st.plan ? 'RENCANA AKTIF: ' + st.plan.stops.map(s => ZMAP[s.id].name).join(' → ') + '\n' : ''}\nZONA (id | nama | kategori | harga | status | jarak dari pengguna | satwa | info):\n${zones}\n\nFASILITAS (id | nama | jenis | jarak | status):\n${pois}\n\nSATWA:\n${animals}\n\nJADWAL (contoh, dikelola pengelola):\n${sched}\n\nTIKET:\n${tk}\n\nKONTAK: ${DATA.meta.contact.phone}, Instagram ${DATA.meta.contact.ig}, ${DATA.meta.contact.web}. Alamat: ${DATA.meta.address}.`;
}
const KOBI_RULES = `Kamu adalah Kobi, pemandu wisata AI di aplikasi Jelajah KBS (Kebun Binatang Surabaya). Maskotmu komodo ramah bertopi ranger.
Aturan:
- Jawab dalam Bahasa Indonesia yang hangat dan ringkas, maksimal 90 kata. Boleh pakai poin pendek dengan tanda "-".
- Gunakan HANYA DATA di bawah. Jika informasinya tidak ada, katakan belum tersedia dan sarankan bertanya ke Pusat Informasi atau petugas. Jangan mengarang harga, jadwal, lokasi, atau fakta satwa.
- Untuk pertanyaan "terdekat", pilih berdasarkan jarak jalan kaki pada DATA, dan lewati yang TUTUP.
- Jika relevan, ingatkan untuk tidak memberi makan satwa di luar program feeding resmi.
- Jika jawabanmu menyebut tempat, akhiri dengan SATU baris persis: AKSI: lihat=<id>[,<id>]; rute=<id>
  Gunakan id dari kolom pertama DATA. Maksimal 3 lihat dan 1 rute; isi rute hanya jika pengguna ingin ke sana atau bertanya arah/lokasi. Tidak ada teks apa pun setelah baris AKSI.`;
function localKobi(q) {
  const s = norm(q); const near = (type, label) => { const n = nearestOf(type); if (!n) return { text: `Maaf, ${label} belum tersedia di data.`, actions: [] }; const t = target('p', n.p.id); const w = walk(t); return { text: `${label[0].toUpperCase() + label.slice(1)} terdekat dari ${startName()}: ${n.p.name}, sekitar ${w.min} menit jalan kaki (${fmtD(w.m)}).${n.p.verified ? '' : ' Posisinya belum diverifikasi pengelola, jadi ikuti juga papan arah ya.'}`, actions: [{ type: 'lihat', t }, { type: 'rute', t }] }; };
  if (/(toilet|wc|kamar mandi|kencing|pipis|buang air)/.test(s)) return near('toilet', 'toilet');
  if (/(mushol|masjid|sholat|salat|solat|shalat|ibadah|wudu)/.test(s)) { const r = near('ibadah', 'mushola'); const m = target('z', 'masjid'); r.text += ` Ada juga Masjid di bagian selatan (${walk(m).min} mnt).`; r.actions.splice(1, 0, { type: 'lihat', t: m }); return r; }
  if (/(makan|lapar|kuliner|minum|haus|kafe|cafe|jajan|kantin)/.test(s)) return near('kuliner', 'tempat makan');
  if (/(p3k|sakit|luka|pingsan|darurat|obat|terluka|jatuh)/.test(s)) { const r = near('p3k', 'pos P3K'); r.text += ' Dalam keadaan darurat, segera minta bantuan petugas terdekat.'; return r; }
  if (/(laktasi|menyusui|asi|bayi)/.test(s)) return near('laktasi', 'ruang laktasi');
  if (/(kursi roda|stroller|disabilitas)/.test(s)) { const r = near('kursiroda', 'peminjaman kursi roda'); r.text += ' Aktifkan opsi "Ramah kursi roda" di tab Rute agar jalur bertangga dihindari.'; return r; }
  if (/(hilang|lost|terpisah)/.test(s)) return near('info', 'pusat informasi');
  if (/(parkir|mobil|motor)/.test(s)) return { text: 'Parkir dalam KBS lewat Pos 12: motor Rp5.000, mobil Rp10.000, non-tunai. Saat libur panjang mobil diarahkan ke Terminal Joyoboyo (TIJ), lalu masuk lewat terowongan ke Pintu Selatan.', actions: [{ type: 'lihat', t: target('z', 'pos12') }, { type: 'lihat', t: target('z', 'selatan') }] };
  const dm = s.match(/(\d)\s*jam/);
  if (/(rute|rencana|itinerary|jalur|urutan|keliling)/.test(s) || (dm && /(anak|keluarga)/.test(s))) {
    const ints = new Set(); if (/anak|keluarga/.test(s)) ints.add('anak'); if (/langka/.test(s)) ints.add('langka'); if (/reptil|komodo/.test(s)) ints.add('reptil'); if (/burung/.test(s)) ints.add('burung'); if (/foto/.test(s)) ints.add('foto'); if (/wahana|main/.test(s)) ints.add('wahana'); if (!ints.size) ints.add('langka');
    st.planner.interests = ints; st.planner.minutes = dm ? Math.min(300, +dm[1] * 60) : 120;
    const stops = plan({ interests: ints, minutes: st.planner.minutes, access: st.avoidStairs });
    return { text: `Ini rute ${st.planner.minutes / 60} jam dari ${startName()}:\n${stops.map((x, i) => `${i + 1}. ${ZMAP[x.id].name}`).join('\n')}\nUrutannya sudah memperhitungkan jarak jalan kaki dan waktu kembali ke pintu keluar.`, actions: [{ type: 'plan' }] };
  }
  if (/(jam|buka|tutup|operasional)/.test(s)) return { text: `KBS buka setiap hari pukul 08.00–16.00 WIB, termasuk libur nasional. Sekarang ${isOpenNow() ? 'sedang buka' : 'sedang tutup'}.`, actions: [] };
  if (/(tiket|harga|bayar|qris|tunai|cash|paket|htm|biaya)/.test(s)) return { text: 'Tiket masuk Rp15.000 flat setiap hari, anak di bawah 85 cm gratis. Pembayaran hanya non-tunai (QRIS & Brizzi).\n- Paket E Rp20.000: masuk + Kids Zoo\n- Paket B Rp45.000: + Aquanoctudio\n- Paket A Rp65.000: + Animal Edutainment\nDetail lengkap ada di tab Tiket.', actions: [] };
  if (/(feeding|memberi makan|kasih makan|jadwal|pertunjukan|show|atraksi|edukasi)/.test(s)) { const now = wib().min; const next = DATA.schedule.find(x => toMin(x.t) + x.dur > now) || DATA.schedule[0]; const t = target('z', next.zone); return { text: `Berikutnya: ${next.title} pukul ${next.t.replace(':', '.')} di ${ZMAP[next.zone].name}. Catatan: ${next.note.toLowerCase()}. Lihat semua di tab Jadwal.`, actions: [{ type: 'lihat', t }, { type: 'rute', t }] }; }
  if (/(langka|terancam|punah|kritis|cr\b)/.test(s)) { const cr = DATA.animals.filter(a => a.iucn === 'CR'); return { text: `Satwa berstatus Kritis (CR) di KBS:\n${cr.map(a => `- ${a.name} (${ZMAP[a.zone] ? ZMAP[a.zone].name : '-'})`).join('\n')}`, actions: [...new Set(cr.map(a => a.zone))].filter(z => ZMAP[z] && ZMAP[z].cat !== 'staf').slice(0, 3).map(z => ({ type: 'lihat', t: target('z', z) })) }; }
  const an = DATA.animals.find(a => [a.name, a.en, a.id].some(n => { const nn = norm(n); return s.includes(nn) || nn.split(/[\s/()]+/).some(w => w.length > 3 && s.includes(w)); }));
  if (an && ZMAP[an.zone]) { const z = ZMAP[an.zone]; const t = target('z', z.id); return { text: `${an.name} (${an.latin}) ada di ${z.name}, ${walk(t).min} menit jalan dari ${startName()}. ${an.fact} Status IUCN: ${IUCN[an.iucn]}.`, actions: z.cat === 'staf' ? [] : [{ type: 'lihat', t }, { type: 'rute', t }] }; }
  const zn = ZONES.find(z => s.includes(norm(PIN_NAME[z.id] || z.name)) || s.includes(norm(z.name)));
  if (zn) { const t = target('z', zn.id); return { text: `${zn.name}: ${zn.desc} ${zn.tips || ''}`.trim(), actions: zn.cat === 'staf' ? [] : [{ type: 'lihat', t }, { type: 'rute', t }] }; }
  if (/(halo|hai|hi\b|pagi|siang|sore|malam|assalam)/.test(s)) return { text: 'Halo juga! Mau ke mana dulu? Aku bisa carikan toilet terdekat, menyusun rute sesuai waktu, atau cerita soal satwa.', actions: [] };
  return { text: 'Kobi belum menemukan jawabannya di data. Coba tanya soal satwa, fasilitas terdekat, rute, jadwal, atau tiket. Untuk hal lain, tanyakan ke Pusat Informasi dekat Pintu Utama.', actions: [{ type: 'lihat', t: target('p', 'info') }] };
}

// ---------- speech ----------
function speak(text) {
  try { if (!('speechSynthesis' in window)) { toast('Suara tidak didukung di perangkat ini'); return; } speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text.replace(/\n/g, '. ')); u.lang = 'id-ID'; u.rate = 1.02; const v = speechSynthesis.getVoices().find(v => /id(-|_)ID/i.test(v.lang)); if (v) u.voice = v; speechSynthesis.speak(u); toast('Membacakan…'); } catch { toast('Suara tidak tersedia'); }
}


// ---------- pencarian ----------
function searchItems(s) {
  s = norm(s.trim()); if (!s) return [];
  const out = [];
  for (const z of ZONES) { const hay = norm(z.name + ' ' + (PIN_NAME[z.id] || '') + ' ' + z.tags.join(' ') + ' ' + z.desc); if (hay.includes(s)) out.push({ k: 'z', id: z.id, name: z.name, sub: CAT[z.cat].label, icon: z.icon || 'paw', c: CAT[z.cat].color, score: norm(z.name).startsWith(s) ? 3 : norm(z.name).includes(s) ? 2 : 1 }); }
  for (const a of DATA.animals) { const hay = norm(a.name + ' ' + a.en + ' ' + a.latin); if (hay.includes(s) && ZMAP[a.zone]) out.push({ k: 'z', id: a.zone, name: a.name, sub: 'di ' + ZMAP[a.zone].name, icon: 'paw', c: 'var(--leaf)', score: norm(a.name).startsWith(s) ? 3.5 : 2.5 }); }
  for (const p of POIS) { const t = POI_T[p.type]; const hay = norm(p.name + ' ' + t.label + ' ' + p.type); if (hay.includes(s)) out.push({ k: 'p', id: p.id, name: p.name, sub: t.label, icon: t.icon, c: t.color, score: norm(p.name).startsWith(s) ? 3 : 2 }); }
  const seen = new Set(); return out.filter(o => { const key = o.k + o.id + o.name; if (seen.has(key)) return false; seen.add(key); return true; }).map(o => ({ ...o, w: walk(target(o.k, o.id)) })).sort((a, b) => b.score - a.score || a.w.m - b.w.m).slice(0, 8);
}
