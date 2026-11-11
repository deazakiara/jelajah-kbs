// node tools/gen-seed.mjs → supabase/migrations/20261110000100_seed_kbs.sql
// Mengubah dataset prototipe (src/data.js) menjadi data awal destinasi "kbs" di Supabase.
// Aman dijalankan ulang (upsert). Status operasional & jadwal hasil edit pengelola tidak ditimpa.
import fs from 'fs';
const src = fs.readFileSync(new URL('../src/data.js', import.meta.url), 'utf8');
const DATA = new Function(src + '\nreturn DATA;')();
const core = fs.readFileSync(new URL('../src/core.js', import.meta.url), 'utf8');
const PIN_NAME = new Function('return ' + core.match(/const PIN_NAME = (\{[^}]*\})/)[1])();
const DEST = 'kbs';
const q = v => v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`;
const arr = (a, type) => a && a.length ? `array[${a.map(x => type === 'num' ? Number(x) : q(x)).join(',')}]::${type === 'num' ? 'double precision' : 'text'}[]` : `'{}'::${type === 'num' ? 'double precision' : 'text'}[]`;
const out = [];
out.push(`-- DIBUAT OTOMATIS oleh tools/gen-seed.mjs dari src/data.js. Jangan edit manual; ubah data.js lalu jalankan ulang.`);
out.push(`insert into public.destinations (id, name, plan, max_points, data_as_of, tickets) values (${q(DEST)}, ${q(DATA.meta.destination)}, 'standard', ${DATA.meta.plan.maxPoints}, ${q(DATA.meta.dataAsOf)}, ${q(JSON.stringify(DATA.tickets))}::jsonb)
on conflict (id) do update set name = excluded.name, data_as_of = excluded.data_as_of, tickets = excluded.tickets;`);
const zr = DATA.zones.map(z => `(${q(DEST)}, ${q(z.id)}, ${q(z.name)}, ${q(PIN_NAME[z.id] || null)}, ${q(z.cat)}, ${q(z.icon)}, ${q(z.price)}, ${q(z.status || 'buka')}, ${z.dwell || 0}, ${arr(z.tags)}, ${q(z.desc)}, ${q(z.tips)}, ${arr(z.pos, 'num')}, ${!!z.verified}, ${q(JSON.stringify(DATA.planning.zones[z.id] || {}))}::jsonb)`);
out.push(`insert into public.zones (destination_id, id, name, short_name, cat, icon, price, status, dwell, tags, description, tips, pos, verified, plan) values\n${zr.join(',\n')}
on conflict (destination_id, id) do update set name = excluded.name, short_name = excluded.short_name, cat = excluded.cat, icon = excluded.icon, price = excluded.price, status = excluded.status, dwell = excluded.dwell, tags = excluded.tags, description = excluded.description, tips = excluded.tips, pos = excluded.pos, verified = excluded.verified, plan = excluded.plan, updated_at = now();`);
const pr = DATA.pois.map(p => `(${q(DEST)}, ${q(p.id)}, ${q(p.name)}, ${q(p.type)}, ${arr(p.pos, 'num')}, ${!!p.verified})`);
out.push(`insert into public.pois (destination_id, id, name, type, pos, verified) values\n${pr.join(',\n')}
on conflict (destination_id, id) do update set name = excluded.name, type = excluded.type, pos = excluded.pos, verified = excluded.verified, updated_at = now();`);
const ar = DATA.animals.map(a => `(${q(DEST)}, ${q(a.id)}, ${q(a.name)}, ${q(a.en)}, ${q(a.latin)}, ${q(a.iucn)}, ${q(a.zone)}, ${q(a.fact)})`);
out.push(`insert into public.animals (destination_id, id, name, name_en, latin, iucn, zone_id, fact) values\n${ar.join(',\n')}
on conflict (destination_id, id) do update set name = excluded.name, name_en = excluded.name_en, latin = excluded.latin, iucn = excluded.iucn, zone_id = excluded.zone_id, fact = excluded.fact, updated_at = now();`);
const qr = DATA.qr.map(x => `(${q(DEST)}, ${q(x.id)}, ${q(x.name)}, ${q(x.hint)}, ${arr(x.pos, 'num')})`);
out.push(`insert into public.qr_points (destination_id, id, name, hint, pos) values\n${qr.join(',\n')}
on conflict (destination_id, id) do update set name = excluded.name, hint = excluded.hint, pos = excluded.pos;`);
const sr = DATA.schedule.map(s => `(${q(DEST)}, ${q(s.t)}, ${s.dur || 20}, ${q(s.title)}, ${q(s.zone)}, ${q(s.note || '')})`);
out.push(`-- jadwal awal hanya diisi bila destinasi belum punya jadwal (supaya hasil edit pengelola tidak hilang)
insert into public.schedules (destination_id, t, dur, title, zone_id, note)
select v.* from (values\n${sr.join(',\n')}\n) as v(destination_id, t, dur, title, zone_id, note)
where not exists (select 1 from public.schedules where destination_id = ${q(DEST)});`.replace(/values\n\(/, 'values\n(').replace(/\('kbs', '(\d\d:\d\d)'/g, "('kbs', time '$1'"));
fs.writeFileSync(new URL('../supabase/migrations/20261110000100_seed_kbs.sql', import.meta.url), out.join('\n\n') + '\n');
console.log('seed:', DATA.zones.length, 'zona,', DATA.pois.length, 'fasilitas,', DATA.animals.length, 'satwa,', DATA.qr.length, 'QR,', DATA.schedule.length, 'jadwal');
