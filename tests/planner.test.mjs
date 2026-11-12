// Uji unit perencana itinerary tanpa browser: node tests/planner.test.mjs
import fs from 'fs';
const r = f => fs.readFileSync(new URL('../src/' + f, import.meta.url), 'utf8');
const api = new Function(r('data.js') + '\nconst NODES = DATA.nodes;\n' + r('core.js') + '\n' + r('planner.js') +
  '\nreturn { DATA, st, ZMAP, planItinerary, planFixed, plan, planExtract, kobiPlanTurn, planSummary, hhmm };')();
const { st, ZMAP, planItinerary, planFixed, plan, planExtract, kobiPlanTurn } = api;
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? '  ok   ' : '  FAIL ') + name + (extra ? '  · ' + extra : '')); };
const ids = res => res.stops.map(s => s.id);
const show = res => res.stops.map(s => `${api.hhmm(s.arrive)} ${s.id}`).join(', ') + ` | selesai ${api.hhmm(res.end)}`;
const KIDS_RIDES = ['unta', 'gokart', 'kolam', 'jamur', 'giz'];
const base = { start: 540 };

console.log('Perencana itinerary');
let t0 = Date.now();
const a = planItinerary({ ...base, group: ['dewasa'], minutes: 120, cats: ['kucing'] });
const ms = Date.now() - t0;
ok('dewasa 2 jam: ada Harimau', ids(a).includes('kucing'), show(a));
ok('dewasa 2 jam: muat dalam 120 menit', a.end - a.start <= 120, `${a.end - a.start} mnt`);
ok('dewasa: wahana khusus anak tidak masuk', !ids(a).some(id => KIDS_RIDES.includes(id)));
ok('alasan pengecualian tercatat', a.excluded.some(x => x.id === 'gokart' && /usia 6–15/.test(x.why)), a.excluded.map(x => x.id + ':' + x.why).slice(0, 3).join(' | '));
ok('cepat dihitung (< 400 ms)', ms < 400, ms + ' ms');

const b = planItinerary({ ...base, group: ['dewasa', 'balita', 'lansia'], minutes: 180 });
ok('balita+lansia: tanpa Menara (tangga)', !ids(b).includes('menara'), show(b));
ok('balita+lansia: tanpa go-kart (6–15 th)', !ids(b).includes('gokart'));
ok('balita+lansia: tempo otomatis santai', b.prefs.pace === 'santai');
ok('balita+lansia: ada jeda istirahat', b.stops.some(s => s.rest && s.rest.food), b.stops.filter(s => s.rest).map(s => s.id + '→' + s.rest.food.name).join(', '));
ok('balita+lansia: hindari jalur bertangga', b.avoidStairs === true);
ok('balita+lansia: muat 180 menit', b.end - b.start <= 180);

const c = planItinerary({ ...base, group: ['dewasa'], access: true, minutes: 240 });
ok('kursi roda: tanpa perahu & menara', !ids(c).includes('perahu') && !ids(c).includes('menara'), show(c));

const d = planItinerary({ ...base, group: ['dewasa', 'anak'], acts: ['wahana'], minutes: 180 });
const rides = ids(d).filter(id => ['unta', 'gokart', 'kolam', 'jamur', 'giz', 'rainbow', 'kidszoo', 'perahu'].includes(id));
ok('anak + wahana: minimal 3 wahana', rides.length >= 3, rides.join(', '));

const e1 = planItinerary({ ...base, group: ['dewasa'], minutes: 60 });
ok('1 jam: lebih sedikit zona dan tetap muat', e1.stops.length < a.stops.length + 2 && e1.end - e1.start <= 60, show(e1));

const tutup = planItinerary({ start: 900, group: ['dewasa'], minutes: 'tutup' });
ok('mulai 15.00 "sampai tutup": selesai ≤ 16.00', tutup.end <= 960, show(tutup));

st.closedZones.add('kucing');
const f = planItinerary({ ...base, group: ['dewasa'], minutes: 120, cats: ['kucing'] });
ok('zona ditutup pengelola tidak masuk', !ids(f).includes('kucing') && f.excluded.some(x => x.id === 'kucing' && /ditutup/.test(x.why)));
st.closedZones.delete('kucing');

const g1 = planItinerary({ ...base, group: ['dewasa', 'anak'], minutes: 150, cats: ['primata'] });
const g2 = planItinerary({ ...base, group: ['dewasa', 'anak'], minutes: 150, cats: ['primata'] });
ok('deterministik (input sama → hasil sama)', JSON.stringify(ids(g1)) === JSON.stringify(ids(g2)));

const h = planItinerary({ start: 555, group: ['dewasa'], minutes: 120, acts: ['show'], must: ['sabana'] });
const sab = h.stops.find(s => s.id === 'sabana');
ok('jendela waktu: tiba saat feeding jerapah 09.30', sab && sab.event && Math.abs(sab.arrive - 570) <= 15, sab ? api.hhmm(sab.arrive) + ' ' + (sab.event && sab.event.title) : 'tidak ada');

const fx = planFixed(['komodo', 'kucing', 'gajah'], { ...base, group: ['dewasa'] });
ok('rencana tersimpan: urutan tetap', ids(fx).join() === 'komodo,kucing,gajah', show(fx));
ok('kompatibel plan() lama', Array.isArray(plan({ interests: new Set(['anak', 'langka']), minutes: 120 })));

console.log('Pemahaman bahasa');
const x = planExtract('Saya mau 3 jam bawa anak 6 tahun dan nenek, pengen lihat harimau dan burung, santai aja');
ok('durasi 3 jam', x.minutes === 180);
ok('rombongan anak + lansia + dewasa', x.group && ['anak', 'lansia', 'dewasa'].every(k => x.group.has(k)), x.group && [...x.group].join(','));
ok('satwa: kucing + burung', x.cats && x.cats.has('kucing') && x.cats.has('burung'));
ok('tempo santai', x.pace === 'santai');
const y = planExtract('setengah hari pakai stroller, bayi saya suka kelinci');
ok('setengah hari + stroller + balita + interaksi', y.minutes === 240 && y.access && y.group.has('balita') && y.cats.has('interaksi'));

console.log('Dialog Kobi');
st.kobiPlan = null;
const q1 = kobiPlanTurn('tolong susun itinerary dong');
ok('tanya rombongan dulu', /Siapa saja/.test(q1.text) && q1.chips.length >= 4, q1.text);
const q2 = kobiPlanTurn('Bawa anak (5–12 th)'); ok('lalu durasi', /Berapa lama/.test(q2.text));
const q3 = kobiPlanTurn('2 jam'); ok('lalu satwa', /Satwa apa/.test(q3.text));
const q4 = kobiPlanTurn('Primata'); ok('lalu kegiatan (ada anak)', /kegiatan/.test(q4.text));
const q5 = kobiPlanTurn('Wahana & bermain');
ok('itinerary jadi + tombol peta', q5.actions && q5.actions[0].type === 'itin' && /Rencana/.test(q5.text), q5.text.split('\n')[0]);
const q6 = kobiPlanTurn('Tambah 1 jam');
ok('modifikasi: tambah 1 jam', q6.actions && q6.actions[0].res.prefs.minutes === 180);
const one = (st.kobiPlan = null, kobiPlanTurn('buat rencana 2 jam untuk saya dan pacar, mau lihat komodo, satwa saja'));
ok('satu kalimat lengkap → langsung jadi', one.actions && one.actions[0].res.stops.some(s => s.id === 'komodo'), one.text.split('\n')[0]);
ok('pertanyaan lain tidak dicegat', kobiPlanTurn('toilet terdekat di mana?') === null);

console.log(`${pass} lulus, ${fail} gagal`);
process.exit(fail ? 1 : 0);
