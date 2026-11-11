// ============================================================
// UI — Jelajah KBS (vanilla JS; di Flutter: widget + Riverpod)
// ============================================================
const app = $('#app');
// (helper, konstanta, routing, planner & Kobi engine ada di core.js)
// ---------- scene ----------
const S = createScene($('#scene'), {
  onPick: id => selectZone(id),
  onPickNone: () => { if (app.classList.contains('sheet-open') && !st.route && !st.plan) closeSheet(); },
  onZoom: d => { st.zoom = d; refreshPins(); },
  onInteract: () => { $('#results').hidden = true; },
});

// ---------- pins ----------
const pinEls = {};
function mkPin(key, html, pos) { const w = document.createElement('div'); w.className = 'pin'; w.innerHTML = `<div class="pin-in">${html}</div>`; $('#pins').append(w); S.addPin(key, pos, w); pinEls[key] = w; return w; }
function rmPin(key) { if (pinEls[key]) { pinEls[key].remove(); S.removePin(key); delete pinEls[key]; } }
ZONES.forEach(z => {
  const icon = z.icon || 'paw';
  const w = mkPin('z:' + z.id, `<button class="zpin" style="--c:${CAT[z.cat].color}" data-z="${z.id}" aria-label="${esc(z.name)}"><span class="bub"><span class="pic">${ICO(icon)}</span><span class="lbl">${esc(PIN_NAME[z.id] || z.name)}</span></span><span class="stem"></span><span class="foot"></span></button>`, [z.pos[0], PIN_Y[z.id] || 2.4, z.pos[1]]);
  w.querySelector('button').addEventListener('click', e => { e.stopPropagation(); selectZone(z.id); });
});
POIS.forEach(p => {
  const t = POI_T[p.type]; const y = p.id === 'foto-surabaya' ? 3.4 : p.id === 'foto-jembatan' ? 2.4 : 2.0;
  const w = mkPin('p:' + p.id, `<button class="fpin" style="--c:${t.color}" data-p="${p.id}" aria-label="${esc(p.name)}">${ICO(t.icon)}</button>`, [p.pos[0], y, p.pos[1]]);
  w.querySelector('button').addEventListener('click', e => { e.stopPropagation(); selectPoi(p.id); });
});
[['Jl. Raya Darmo', [55.5, 0.4, 2]], ['Jl. Diponegoro', [27, 0.4, -36]], ['Jl. Setail', [11.5, 0.4, -28]], ['Jl. Joyoboyo', [-12, 0.4, 42.4]], ['Terminal Joyoboyo', [45, 4.2, 48.2]]].forEach(([n, p], i) => mkPin('r:' + i, `<div class="rlbl">${n}</div>`, p));

function refreshPins() {
  const z = st.zoom, far = z > 100, mid = z > 62 && !far, f = st.filter;
  const zf = FILTER_ZONE[f], pf = FILTER_POI[f];
  for (const zo of ZONES) {
    const el = pinEls['z:' + zo.id]; const b = el.querySelector('.zpin'); const sel = st.sel === 'z:' + zo.id;
    let show; if (f === 'semua') show = zo.cat !== 'staf' || !far && !mid || sel; else show = (zf && zf(zo)) || sel;
    if (st.plan && st.plan.stops.some(s => s.id === zo.id)) show = true;
    el.hidden = !show;
    const compact = !sel && (f === 'semua' ? (far && !PRIO.has(zo.id)) || (mid && zo.cat === 'staf') : false);
    b.classList.toggle('compact', compact); b.classList.toggle('sel', sel);
    const closed = st.closedZones.has(zo.id); b.classList.toggle('closed', closed);
    let tag = b.querySelector('.tag'); if (closed && !tag) { b.querySelector('.bub').insertAdjacentHTML('beforeend', '<span class="tag">Tutup</span>'); } else if (!closed && tag) tag.remove();
  }
  for (const p of POIS) {
    const el = pinEls['p:' + p.id]; const sel = st.sel === 'p:' + p.id;
    const show = pf ? pf.includes(p.type) : (f === 'semua' && z < 58 && p.type !== 'loket');
    el.hidden = !(show || sel); const b = el.querySelector('.fpin'); b.classList.toggle('sel', sel); b.classList.toggle('closed', st.closedPois.has(p.id));
  }
  for (let i = 0; i < 5; i++) pinEls['r:' + i].hidden = z > 150 || (z < 30);
}

// user marker
function setUser(q) {
  st.user = q; dcache = null; S.setUser(q.pos); rmPin('user'); mkPin('user', `<div class="upin"><span>Anda</span></div>`, [q.pos[0], 0.7, q.pos[1]]);
  $('#locpill').hidden = false; $('#loc-text').textContent = 'Anda di ' + q.name;
}

// ---------- chips ----------
$('#chips').innerHTML = FILTERS.map(f => `<button class="chip${f.id === 'semua' ? ' on' : ''}" data-f="${f.id}" style="${f.c ? '--c:' + f.c : ''}">${ICO(f.icon)}<span>${f.label}</span></button>`).join('');
$('#chips').addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; setFilter(b.dataset.f); });
function setFilter(f) {
  st.filter = f; $$('.chip').forEach(c => c.classList.toggle('on', c.dataset.f === f)); refreshPins();
  if (FILTER_POI[f]) { const types = FILTER_POI[f]; const near = nearestOf(types[0]); const items = POIS.filter(p => types.includes(p.type)); if (items.length) listSheet(FILTERS.find(x => x.id === f).label, items.map(p => ({ k: 'p', id: p.id })), near ? near.p.id : null); }
  else if (f === 'satwa' || f === 'wahana') { listSheet(f === 'satwa' ? 'Zona satwa' : 'Wahana & bermain', ZONES.filter(FILTER_ZONE[f]).map(z => ({ k: 'z', id: z.id }))); }
  else if (f === 'semua') { if (!st.route && !st.plan) closeSheet(); }
}

// ---------- sheet ----------
const sheetBody = $('#sheet-body');
function openSheet(html, { full = false } = {}) { sheetBody.innerHTML = html; sheetBody.scrollTop = 0; app.classList.add('sheet-open'); app.classList.toggle('sheet-full', full); attachViewer(); }
function closeSheet() {
  app.classList.remove('sheet-open', 'sheet-full'); st.sel = null; S.select(null); viewerSetActive(false);
  if (st.route || st.plan) { st.route = null; st.plan = null; S.clearRoute(); clearStopPins(); $('#navcard').hidden = true; }
  refreshPins();
}
(function sheetDrag() {
  const h = $('#sheet-handle'); let y0 = null, moved = false;
  h.addEventListener('pointerdown', e => { y0 = e.clientY; moved = false; h.setPointerCapture(e.pointerId); });
  h.addEventListener('pointermove', e => { if (y0 !== null && Math.abs(e.clientY - y0) > 8) moved = true; });
  h.addEventListener('pointerup', e => { if (y0 === null) return; const dy = e.clientY - y0; y0 = null; const full = app.classList.contains('sheet-full');
    if (!moved) { app.classList.toggle('sheet-full'); return; } if (dy < -30) app.classList.add('sheet-full'); else if (dy > 50) { if (full) app.classList.remove('sheet-full'); else closeSheet(); } });
})();
sheetBody.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return; const a = b.dataset.act, id = b.dataset.id, k = b.dataset.k;
  if (a === 'close') closeSheet();
  else if (a === 'route') showRoute(target(k, id));
  else if (a === 'kobi') { openTab('kobi'); sendKobi(k === 'z' ? `Ceritakan tentang ${ZMAP[id].name} dan tips berkunjungnya.` : `Apa yang perlu saya tahu tentang ${PMAP[id].name}?`); }
  else if (a === 'speak') speak(b.dataset.text || '');
  else if (a === 'open') { k === 'z' ? selectZone(id) : selectPoi(id); }
  else if (a === 'animal') { const card = b; const was = card.classList.contains('open'); $$('.acard', sheetBody).forEach(c => c.classList.remove('open')); if (!was) card.classList.add('open'); const an = AMAP[id]; const m = modelFor(an); if (m && viewer) viewer.show(m); }
  else if (a === 'access') { st.avoidStairs = b.checked; dcache = null; if (st.route) showRoute(st.route.t, { keepSheet: true }); }
  else if (a === 'start') startNav();
  else if (a === 'replan') openTab('rute');
});
sheetBody.addEventListener('change', e => { const t = e.target; if (t.matches('[data-act="access"]')) { st.avoidStairs = t.checked; dcache = null; if (st.route) showRoute(st.route.t); else if (st.plan) runPlan(); } });

// hero viewer
const viewerCanvas = document.createElement('canvas'); let viewer = null;
const modelFor = an => !an ? null : (MODEL[an.id] ? an.id : an.model);
function attachViewer() { const slot = $('.viewer', sheetBody); if (!slot) { viewerSetActive(false); return; } slot.prepend(viewerCanvas); if (!viewer) viewer = createViewer(viewerCanvas); viewer.setActive(true); viewer.show(slot.dataset.model); }
function viewerSetActive(on) { if (viewer) viewer.setActive(on); }

function statusPill(z) {
  if (st.closedZones.has(z.id)) return `<span class="pill bad">${ICO('alert')}Tutup sementara</span>`;
  if (z.cat === 'staf') return `<span class="pill">${ICO('lock')}Area non-publik</span>`;
  if (z.status === 'cek') return `<span class="pill warn">${ICO('info')}Status perlu dicek</span>`;
  return isOpenNow() ? `<span class="pill ok">${ICO('check')}Buka · s.d. 16.00</span>` : `<span class="pill">${ICO('clock')}Buka 08.00</span>`;
}
function zoneSheet(z) {
  const w = walk(target('z', z.id)); const animals = (z.animals || []).map(a => AMAP[a]).filter(Boolean);
  const heroAn = z.hero ? DATA.animals.find(a => a.model === z.hero || a.id === z.hero) : animals.find(a => modelFor(a));
  const model = heroAn ? modelFor(heroAn) : null;
  const near = z.cat === 'staf' ? [] : ['toilet', 'ibadah', 'kuliner'].map(t => nearestOf(t, fromNode(z.node))).filter(Boolean);
  const ver = st.verified.has('z:' + z.id);
  return `
  <div class="sh-head"><div><div class="sh-eyebrow" style="--c:${CAT[z.cat].color}">${ICO(z.icon || 'paw', 'sm')}${CAT[z.cat].label}</div><h2>${esc(z.name)}</h2></div>
  <button class="sh-close" data-act="close" aria-label="Tutup">${ICO('x', 'sm')}</button></div>
  <div class="pills">${statusPill(z)}<span class="pill price">${ICO('ticket')}${esc(z.price)}</span></div>
  ${z.cat !== 'staf' ? `<div class="meta"><span>${ICO('walk', 'sm')}<b>${w.ok ? w.min + ' mnt' : '–'}</b> · ${w.ok ? fmtD(w.m) : 'jalur ditutup'} dari ${esc(startName())}</span>${z.dwell ? `<span>${ICO('clock', 'sm')}±${z.dwell} mnt di sini</span>` : ''}</div>` : ''}
  ${model ? `<div class="viewer" data-model="${model}"><span class="vtag">${ICO('cube', 'sm')}${esc(heroAn.name)} · putar 360°</span></div>` : ''}
  ${z.cat !== 'staf' ? `<div class="actions"><button class="btn primary" data-act="route" data-k="z" data-id="${z.id}">${ICO('route')}Rute ke sini</button><button class="btn" data-act="kobi" data-k="z" data-id="${z.id}">${KOBI('ico')}Tanya Kobi</button><button class="btn icon" data-act="speak" data-text="${esc(z.name + '. ' + z.desc + ' ' + (z.tips || ''))}" aria-label="Dengarkan">${ICO('volume')}</button></div>` : ''}
  <p class="desc">${esc(z.desc)}</p>
  ${z.tips ? `<div class="tip">${ICO('sparkle')}<span>${esc(z.tips)}</span></div>` : ''}
  ${animals.length ? `<div class="sect">Satwa di sini <span style="font-weight:600;text-transform:none;letter-spacing:0">ketuk untuk fakta</span></div><div class="acards">${animals.map(a => `<button class="acard" data-act="animal" data-id="${a.id}"><span class="iucn ${a.iucn}" title="${IUCN[a.iucn]}">${a.iucn === 'DOM' ? 'DOMESTIK' : a.iucn + ' · ' + IUCN[a.iucn]}</span><b>${esc(a.name)}</b><i>${esc(a.latin)}</i><p>${esc(a.fact)}</p></button>`).join('')}</div>` : ''}
  ${near.length ? `<div class="sect">Fasilitas terdekat</div><div class="near">${near.map(n => { const t = POI_T[n.p.type]; return `<button class="nrow" data-act="open" data-k="p" data-id="${n.p.id}"><span class="ric" style="--c:${t.color}">${ICO(t.icon)}</span><span>${esc(n.p.name)}</span><small>${fmtD(n.u * 5)}</small>${ICO('chev', 'sm')}</button>`; }).join('')}</div>` : ''}
  <div class="datafoot ${ver ? 'ok' : ''}">${ICO(ver ? 'shield' : 'info')}${ver ? 'Lokasi sesuai denah & sumber publik' : 'Belum diverifikasi pengelola'} · data ${DATA.meta.dataAsOf}</div>`;
}
function selectZone(id, opts = {}) {
  const z = ZMAP[id]; if (!z) return; if (st.route || st.plan) { st.route = null; st.plan = null; S.clearRoute(); clearStopPins(); $('#navcard').hidden = true; }
  if (st.tab !== 'peta') openTab('peta');
  st.sel = 'z:' + id; S.select(id); refreshPins(); openSheet(zoneSheet(z)); if (!opts.noFly) S.flyToZone(id, { sheet: true }); postBridge('zone', { id });
  $('#results').hidden = true;
}
function selectPoi(id, opts = {}) {
  const p = PMAP[id]; if (!p) return; if (st.route || st.plan) { st.route = null; st.plan = null; S.clearRoute(); clearStopPins(); $('#navcard').hidden = true; }
  if (st.tab !== 'peta') openTab('peta');
  st.sel = 'p:' + id; S.selectPoint(p.pos); refreshPins();
  const t = POI_T[p.type]; const w = walk(target('p', id)); const closed = st.closedPois.has(id); const ver = st.verified.has('p:' + id);
  const zn = ZONES.filter(z => z.cat !== 'staf').map(z => ({ z, d: dist2(z.pos, p.pos) })).sort((a, b) => a.d - b.d)[0];
  openSheet(`<div class="sh-head"><div><div class="sh-eyebrow" style="--c:${t.color}">${ICO(t.icon, 'sm')}${t.label}</div><h2>${esc(p.name)}</h2></div><button class="sh-close" data-act="close" aria-label="Tutup">${ICO('x', 'sm')}</button></div>
    <div class="pills">${closed ? `<span class="pill bad">${ICO('alert')}Ditutup sementara</span>` : `<span class="pill ok">${ICO('check')}Tersedia</span>`}<span class="pill ${ver ? 'ok' : 'warn'}">${ICO(ver ? 'shield' : 'info')}${ver ? 'Terverifikasi' : 'Lokasi belum diverifikasi'}</span></div>
    <div class="meta"><span>${ICO('walk', 'sm')}<b>${w.ok ? w.min + ' mnt' : '–'}</b> · ${fmtD(w.m)} dari ${esc(startName())}</span></div>
    <div class="actions"><button class="btn primary" data-act="route" data-k="p" data-id="${id}" ${closed ? 'disabled' : ''}>${ICO('route')}Rute ke sini</button><button class="btn" data-act="kobi" data-k="p" data-id="${id}">${KOBI('ico')}Tanya Kobi</button></div>
    ${zn ? `<div class="sect">Dekat dengan</div><div class="near"><button class="nrow" data-act="open" data-k="z" data-id="${zn.z.id}"><span class="ric" style="--c:${CAT[zn.z.cat].color}">${ICO(zn.z.icon || 'paw')}</span><span>${esc(zn.z.name)}</span><small>${fmtD(zn.d * 5)}</small>${ICO('chev', 'sm')}</button></div>` : ''}
    <div class="datafoot">${ICO('info')}Posisi pada prototipe bersifat ilustratif. Pengelola memperbarui lewat dasbor.</div>`);
  if (!opts.noFly) S.flyToPoint(p.pos, { sheet: true, dist: 30 }); postBridge('poi', { id });
}
function listSheet(title, items, highlight) {
  const rows = items.map(it => { const isZ = it.k === 'z'; const o = isZ ? ZMAP[it.id] : PMAP[it.id]; const t = isZ ? { icon: o.icon || 'paw', color: CAT[o.cat].color } : POI_T[o.type]; const w = walk(target(it.k, it.id)); return { it, o, t, w }; }).sort((a, b) => a.w.m - b.w.m);
  openSheet(`<div class="sh-head"><div><div class="sh-eyebrow">${ICO('locate', 'sm')}Diurutkan dari ${esc(startName())}</div><h2>${esc(title)}</h2></div><button class="sh-close" data-act="close" aria-label="Tutup">${ICO('x', 'sm')}</button></div>
  <div class="near" style="margin-top:10px">${rows.map(({ it, o, t, w }) => `<button class="nrow" data-act="open" data-k="${it.k}" data-id="${it.id}"><span class="ric" style="--c:${t.color}">${ICO(t.icon)}</span><span>${esc(o.name)}${(it.k === 'z' ? st.closedZones.has(o.id) : st.closedPois.has(o.id)) ? ' <small style="color:var(--coral)">· tutup</small>' : ''}</span><small>${w.min} mnt · ${fmtD(w.m)}</small>${ICO('chev', 'sm')}</button>`).join('')}</div>`);
  if (rows.length && FILTER_POI[st.filter]) { const r0 = rows[0]; S.flyToPoint(r0.o.pos, { sheet: true, dist: 48 }); }
  else S.overview();
}

// ---------- routing ----------
function showRoute(t, opts = {}) {
  const r = pathPts(startPos(), t, { access: st.avoidStairs }); if (st.tab !== 'peta') openTab('peta');
  if (!r) { toast('Tidak ada jalur terbuka ke ' + t.name); return; }
  const base = pathPts(startPos(), t, { access: st.avoidStairs, ignoreClosed: true });
  st.plan = null; clearStopPins(); st.route = { t, r }; st.sel = (t.kind === 'z' ? 'z:' : 'p:') + t.id; refreshPins();
  S.setRoute(r.pts); if (t.kind === 'z') S.select(t.id); else S.selectPoint(t.pos); S.frameRoute(r.pts, { sheet: true }); postBridge('route', { to: t.id, meters: Math.round(r.m), minutes: r.min });
  const lm = landmarksOf(r.nodes, t.id); const detour = base && r.m - base.m > 10 ? r.m - base.m : 0;
  openSheet(`<div class="sh-head"><div><div class="sh-eyebrow" style="--c:#ff6a2b">${ICO('route', 'sm')}Rute jalan kaki</div><h2>Ke ${esc(t.name)}</h2></div><button class="sh-close" data-act="close" aria-label="Tutup">${ICO('x', 'sm')}</button></div>
  <div class="rsum"><div><b>${r.min}</b><small>menit</small></div><div><b>${fmtD(r.m).replace(' m', '')}</b><small>${r.m < 1000 ? 'meter' : 'km'}</small></div><div><b>${fmtN(Math.round(r.m * 1.35))}</b><small>langkah</small></div></div>
  ${detour ? `<div class="tip">${ICO('alert')}<span>Jalur ${[...st.closedEdges].map(e => e === 'jembatan' ? 'Jembatan Cinta' : e).join(', ')} ditutup pengelola. Rute dialihkan, +${fmtD(detour)}.</span></div>` : ''}
  <label class="toggle">${ICO('wheelchair')}<span>Ramah kursi roda & stroller<br><small style="color:var(--ink-3);font-weight:500">Hindari tangga dan jembatan</small></span><input type="checkbox" data-act="access" ${st.avoidStairs ? 'checked' : ''}></label>
  <ol class="steps-v"><li><span class="sv start">${ICO('locate')}</span><span class="st"><b>${esc(startName())}</b><small>Titik awal${st.user ? ' (dari QR)' : ''}</small></span></li>
  ${lm.map(z => `<li><span class="sv">${ICO(z.id === '_bridge' ? 'stairs' : 'walk')}</span><span class="st"><b>Lewati ${esc(z.name)}</b><small>${z.id === '_bridge' ? 'Jembatan bertangga' : 'Penanda arah'}</small></span></li>`).join('')}
  <li><span class="sv end">${ICO('flag')}</span><span class="st"><b>${esc(t.name)}</b><small>Tiba ±${hhmm(wib().min + r.min)} WIB</small></span></li></ol>
  <div class="actions"><button class="btn primary" data-act="start">${ICO('play')}Mulai navigasi</button></div>`);
}
function startNav() {
  if (!st.route) return; const { t, r } = st.route; app.classList.remove('sheet-open', 'sheet-full');
  const nc = $('#navcard'); nc.hidden = false;
  const lm = landmarksOf(r.nodes, t.id)[0];
  nc.innerHTML = `<span class="nv-ic">${ICO('route', 'lg')}</span><span><b>${esc(t.name)}</b><small>${r.min} mnt · ${fmtD(r.m)}${lm ? ' · lewat ' + esc(lm.name) : ''}</small></span><button id="nav-end">Selesai</button>`;
  $('#nav-end').onclick = () => { closeSheet(); toast('Navigasi selesai'); };
  S.flyToPoint(startPos(), { dist: 34 });
}

// planner
function runPlan() {
  const p = st.planner; const stops = plan({ interests: p.interests, minutes: p.minutes, access: st.avoidStairs });
  if (!stops.length) { toast('Waktu terlalu singkat. Coba tambah durasi.'); return; }
  let pts = []; let pos = startPos(); let totalM = 0; let t0 = wib().min; if (t0 < 480 || t0 > 900) t0 = 480; let clock = t0;
  for (const s of stops) { const z = ZMAP[s.id]; const r = pathPts(pos, target('z', s.id), { access: st.avoidStairs }); if (!r) continue; pts = pts.length ? pts.concat(r.pts.slice(1)) : r.pts; totalM += r.m; s.walk = r.min; clock += r.min; s.arrive = clock; clock += s.dwell; pos = NODES[z.node]; }
  st.route = null; st.plan = { stops, pts, totalM, start: t0, end: clock }; if (st.tab !== 'peta') openTab('peta');
  S.setRoute(pts); S.select(null); st.sel = null; refreshPins(); S.frameRoute(pts, { sheet: true }); clearStopPins(); stops.forEach((s, i) => { const z = ZMAP[s.id]; mkPin('stop:' + i, `<div class="stoppin">${i + 1}</div>`, [z.pos[0], (PIN_Y[z.id] || 2.4) + 2.2, z.pos[1]]); });
  const dur = clock - t0;
  openSheet(`<div class="sh-head"><div><div class="sh-eyebrow" style="--c:#ff6a2b">${ICO('sparkle', 'sm')}Rencana kunjungan</div><h2>${stops.length} zona dalam ${Math.floor(dur / 60) ? Math.floor(dur / 60) + ' jam ' : ''}${dur % 60 ? (dur % 60) + ' mnt' : ''}</h2></div><button class="sh-close" data-act="close" aria-label="Tutup">${ICO('x', 'sm')}</button></div>
  <div class="rsum"><div><b>${hhmm(t0)}</b><small>mulai</small></div><div><b>${fmtD(totalM).replace(' m', '').replace(' km', '')}</b><small>${totalM < 1000 ? 'meter' : 'km'} jalan</small></div><div><b>${hhmm(clock)}</b><small>selesai</small></div></div>
  <ol class="steps-v"><li><span class="sv start">${ICO('locate')}</span><span class="st"><b>${esc(startName())}</b><small>Mulai ${hhmm(t0)} WIB${wib().min < 480 || wib().min > 900 ? ' (besok, saat buka)' : ''}</small></span></li>
  ${stops.map((s, i) => { const z = ZMAP[s.id]; return `<li><span class="sv stop">${i + 1}</span><span class="st"><b>${esc(z.name)}</b><small>${s.walk} mnt jalan · ±${s.dwell} mnt di sini · ${esc(z.price)}</small></span><span class="tm">${hhmm(s.arrive)}</span></li>`; }).join('')}</ol>
  <label class="toggle" style="margin-top:12px">${ICO('wheelchair')}<span>Ramah kursi roda & stroller</span><input type="checkbox" data-act="access" ${st.avoidStairs ? 'checked' : ''}></label>
  <div class="actions"><button class="btn" data-act="replan">${ICO('refresh')}Ubah rencana</button><button class="btn primary" data-act="open" data-k="z" data-id="${stops[0].id}">${ICO('play')}Mulai dari zona 1</button></div>`, { full: false });
}
function clearStopPins() { Object.keys(pinEls).filter(k => k.startsWith('stop:')).forEach(rmPin); }

// ---------- tabs & panels ----------
const panelBody = $('#panel-body');
$$('.tabbar button').forEach(b => b.addEventListener('click', () => openTab(b.dataset.tab)));
function openTab(t) {
  st.tab = t; $$('.tabbar button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  if (t === 'peta') { app.classList.remove('panel-open'); return; }
  app.classList.add('panel-open'); app.classList.remove('sheet-full');
  if (t === 'rute') renderPlanner(); else if (t === 'kobi') renderKobi(); else if (t === 'jadwal') renderJadwal(); else if (t === 'tiket') renderTiket();
}
function renderPlanner() {
  const p = st.planner;
  panelBody.innerHTML = `<div class="ph"><h2>Rencanakan kunjungan</h2><p>Pilih minat dan waktu. Kobi menyusun urutan zona yang efisien dari posisi Anda.</p></div>
  <div class="pb">
    <div class="card"><h3>Mulai dari</h3><div class="startrow"><span class="dotblue"></span><b>${esc(startName())}</b><button class="btn sm ghost" id="pl-scan">${ICO('qr', 'sm')}Ganti</button></div></div>
    <div class="card"><h3>Minat</h3><div class="opts" id="pl-int">${INTERESTS.map(([k, l, i]) => `<button class="opt" aria-pressed="${p.interests.has(k)}" data-k="${k}">${ICO(i)}${l}</button>`).join('')}</div></div>
    <div class="card"><h3>Waktu tersedia</h3><div class="seg" id="pl-dur">${[[60, '1 jam'], [120, '2 jam'], [180, '3 jam'], [300, '5 jam']].map(([m, l]) => `<button class="opt" aria-pressed="${p.minutes === m}" data-m="${m}">${l}</button>`).join('')}</div></div>
    <label class="toggle">${ICO('wheelchair')}<span>Ramah kursi roda & stroller</span><input type="checkbox" id="pl-acc" ${st.avoidStairs ? 'checked' : ''}></label>
    <button class="btn primary" id="pl-go" style="height:50px">${ICO('sparkle')}Susun rute</button>
    <div class="card"><h3>Rute cepat</h3><div class="near">
      ${[['toilet', 'Toilet terdekat'], ['ibadah', 'Mushola / masjid terdekat'], ['kuliner', 'Tempat makan terdekat']].map(([t, l]) => { const n = nearestOf(t); return n ? `<button class="nrow" data-quick="p:${n.p.id}"><span class="ric" style="--c:${POI_T[t].color}">${ICO(POI_T[t].icon)}</span><span>${l}<br><small>${esc(n.p.name)}</small></span><small>${fmtD(n.u * 5)}</small>${ICO('chev', 'sm')}</button>` : ''; }).join('')}
      <button class="nrow" data-quick="z:${walk(target('z', 'gerbang')).m < walk(target('z', 'selatan')).m ? 'gerbang' : 'selatan'}"><span class="ric" style="--c:var(--water)">${ICO('gate')}</span><span>Pintu keluar terdekat</span>${ICO('chev', 'sm')}</button>
    </div></div>
  </div>`;
  $('#pl-int').onclick = e => { const b = e.target.closest('.opt'); if (!b) return; const k = b.dataset.k; p.interests.has(k) ? p.interests.delete(k) : p.interests.add(k); b.setAttribute('aria-pressed', p.interests.has(k)); };
  $('#pl-dur').onclick = e => { const b = e.target.closest('.opt'); if (!b) return; p.minutes = +b.dataset.m; $$('#pl-dur .opt').forEach(o => o.setAttribute('aria-pressed', o === b)); };
  $('#pl-acc').onchange = e => { st.avoidStairs = e.target.checked; dcache = null; };
  $('#pl-go').onclick = () => runPlan();
  $('#pl-scan').onclick = () => showQR();
  panelBody.querySelectorAll('[data-quick]').forEach(b => b.onclick = () => { const [k, id] = b.dataset.quick.split(':'); showRoute(target(k, id)); });
}
function renderJadwal() {
  const n = wib(); const now = n.min; const open = isOpenNow();
  panelBody.innerHTML = `<div class="ph"><h2>Jadwal hari ini</h2><div class="dayhead" style="margin-top:6px"><span style="color:var(--ink-2);font-weight:600">${DAYS[n.day]}, ${n.date} ${MONTHS[n.month]} · ${hhmm(now)} WIB</span><span class="openstate ${open ? 'open' : 'closed'}">${ICO(open ? 'check' : 'clock', 'sm')}${open ? 'Buka s.d. 16.00' : 'Tutup · buka 08.00'}</span></div></div>
  <div class="pb"><div class="card">${DATA.schedule.map((s, i) => { const t = toMin(s.t), live = now >= t && now < t + s.dur, past = now >= t + s.dur; const z = ZMAP[s.zone]; const inMin = t - now;
    return `<div class="ev ${live ? 'live' : ''} ${past ? 'past' : ''}"><div class="t">${s.t.replace(':', '.')}<small>${s.dur} mnt</small></div><div>${live ? '<span class="badge-live">Sedang berlangsung</span>' : (!past && inMin < 120 && open ? `<span class="pill warn" style="margin-bottom:4px">${ICO('clock')}${inMin} mnt lagi</span>` : '')}<b style="display:block">${esc(s.title)}</b><span class="where">${esc(z.name)} · ${walk(target('z', z.id)).min} mnt jalan</span><span class="note">${esc(s.note)}</span>
      <div class="evact"><button class="btn sm" data-sz="${z.id}">${ICO('route', 'sm')}Rute</button><button class="btn sm ${st.reminders.has(i) ? 'mango' : 'ghost'}" data-rem="${i}">${ICO('bell', 'sm')}${st.reminders.has(i) ? 'Diingatkan' : 'Ingatkan'}</button></div></div></div>`; }).join('')}</div>
  <p class="fine" style="margin:0 4px">Contoh jadwal dari sumber publik. Jadwal resmi diisi dan diperbarui pengelola lewat dasbor.</p></div>`;
  panelBody.querySelectorAll('[data-sz]').forEach(b => b.onclick = () => showRoute(target('z', b.dataset.sz)));
  panelBody.querySelectorAll('[data-rem]').forEach(b => b.onclick = () => { const i = +b.dataset.rem; if (st.reminders.has(i)) st.reminders.delete(i); else { st.reminders.add(i); toast('Kobi akan mengingatkan 10 menit sebelum ' + DATA.schedule[i].title.toLowerCase()); } renderJadwal(); });
}
function renderTiket() {
  const T = DATA.tickets, M = DATA.meta;
  panelBody.innerHTML = `<div class="ph"><h2>Tiket & info</h2><p>${esc(M.hours.open.replace(':', '.'))}–${esc(M.hours.close.replace(':', '.'))} WIB · ${esc(M.hours.note)}</p></div>
  <div class="pb">
    <div class="cashless">${ICO('qr')}<span><b>Non-tunai saja</b>Loket & parkir menerima QRIS dan Brizzi. Siapkan saldo sebelum datang.</span></div>
    <div class="card"><h3>Tiket masuk</h3>${T.entry.map(e => `<div class="prow"><span>${esc(e.label)}${e.note ? `<small>${esc(e.note)}</small>` : ''}</span><b>${esc(e.price)}</b></div>`).join('')}</div>
    <div class="card"><h3>Paket terusan</h3><div class="bundles">${T.bundles.map(b => `<div class="bundle"><span class="code">${b.code}</span><small>${esc(b.items)}</small><b>${esc(b.price)}</b></div>`).join('')}</div></div>
    <div class="card"><h3>Wahana & aktivitas</h3>${T.rides.map(e => `<div class="prow"><span>${esc(e.label)}</span><b>${esc(e.price)}</b></div>`).join('')}</div>
    <div class="card"><h3>Parkir</h3>${T.parking.map(e => `<div class="prow"><span>${esc(e.label)}</span><b>${esc(e.price)}</b></div>`).join('')}</div>
    <div class="card"><h3>Kontak KBS</h3>
      <div class="copyrow">${ICO('phone', 'sm')}<span>${esc(M.contact.phone)}</span><button class="btn sm ghost" data-copy="${esc(M.contact.phone)}">Salin</button></div>
      <div class="copyrow">${ICO('camera', 'sm')}<span>${esc(M.contact.ig)}</span><button class="btn sm ghost" data-copy="${esc(M.contact.ig)}">Salin</button></div>
      <div class="copyrow">${ICO('map', 'sm')}<span>${esc(M.address)}</span></div></div>
    <p class="fine" style="margin:0 4px">${esc(T.asOf)}</p>
  </div>`;
  panelBody.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => { const v = b.dataset.copy; try { navigator.clipboard.writeText(v).then(() => toast('Disalin: ' + v), () => toast(v)); } catch { toast(v); } });
}

// ---------- Kobi (AI guide) ----------
let sampleFn = null, kobiLive = false;
try { if (window.claude && window.claude.use) window.claude.use('sample').then(s => { sampleFn = s; kobiLive = !!s; updateKobiState(); }).catch(() => { }); } catch { }
function updateKobiState() { const el = $('#ai-state'); if (el) { el.classList.toggle('live', kobiLive); el.textContent = kobiLive ? 'AI aktif · menjawab dari data KBS' : 'Mode offline · jawaban dari data lokal'; } }
const SUGS = ['Toilet terdekat di mana?', 'Di mana lihat komodo?', 'Rute 2 jam bersama anak', 'Jam buka & harga tiket?', 'Satwa paling langka apa saja?', 'Mushola terdekat?', 'Ada pertunjukan apa hari ini?'];
function renderKobi() {
  panelBody.innerHTML = `<div class="chat"><div class="chat-h"><span class="av">${KOBI()}</span><span><b>Kobi</b><span class="ai-state" id="ai-state"></span></span></div>
  <div class="msgs" id="msgs" aria-live="polite"></div>
  <div class="sugs" id="sugs">${SUGS.map(s => `<button>${esc(s)}</button>`).join('')}</div>
  <form class="composer" id="composer"><label for="kq" class="sr">Pesan untuk Kobi</label><input id="kq" autocomplete="off" placeholder="Tanya apa saja tentang KBS…"><button class="btn" aria-label="Kirim">${ICO('send')}</button></form></div>`;
  updateKobiState();
  if (!st.chat.length) st.chat.push({ role: 'bot', text: `Halo! Aku Kobi, pemandu KBS. ${st.user ? `Kamu sedang di ${st.user.name}.` : 'Pindai QR di papan informasi supaya aku tahu posisimu.'} Tanya soal satwa, fasilitas terdekat, rute, jadwal, atau tiket ya.` });
  st.chat.forEach(m => appendMsg(m));
  $('#sugs').onclick = e => { const b = e.target.closest('button'); if (b) sendKobi(b.textContent); };
  $('#composer').onsubmit = e => { e.preventDefault(); const v = $('#kq').value.trim(); if (v) { $('#kq').value = ''; sendKobi(v); } };
}
function appendMsg(m) {
  const box = $('#msgs'); if (!box) return null; const d = document.createElement('div'); d.className = 'msg ' + (m.role === 'me' ? 'me' : 'bot') + (m.thinking ? ' thinking' : ''); d.textContent = m.text; if (m.actions) d.append(actionsEl(m.actions));
  if (m.role === 'bot' && !m.thinking && m.text) { const f = document.createElement('div'); f.className = 'mfoot'; f.innerHTML = `<button>${ICO('volume', 'sm')}Dengarkan</button>`; f.firstChild.onclick = () => speak(m.text); d.append(f); }
  box.append(d); box.scrollTop = box.scrollHeight; return d;
}
function actionsEl(actions) {
  const w = document.createElement('div'); w.className = 'acts';
  for (const a of actions) { const b = document.createElement('button'); if (a.type === 'rute') { const t = a.t; const wk = walk(t); b.className = 'rt'; b.innerHTML = `${ICO('route', 'sm')}Rute ke ${esc(t.name)} · ${wk.min} mnt`; b.onclick = () => showRoute(t); } else if (a.type === 'lihat') { b.innerHTML = `${ICO('map', 'sm')}${esc(a.t.name)}`; b.onclick = () => a.t.kind === 'z' ? selectZone(a.t.id) : selectPoi(a.t.id); } else if (a.type === 'plan') { b.className = 'rt'; b.innerHTML = `${ICO('sparkle', 'sm')}Tampilkan rencana di peta`; b.onclick = () => runPlan(); } w.append(b); }
  return w;
}
async function sendKobi(text) {
  if (st.tab !== 'kobi') openTab('kobi'); if (st.kobiBusy) return;
  const me = { role: 'me', text }; st.chat.push(me); appendMsg(me); $('#sugs') && ($('#sugs').hidden = true);
  const thinking = { role: 'bot', text: 'Kobi sedang mencari…', thinking: true }; const el = appendMsg(thinking); st.kobiBusy = true;
  const finish = (body, actions) => { el.remove(); const m = { role: 'bot', text: body, actions }; st.chat.push(m); appendMsg(m); st.kobiBusy = false; };
  if (sampleFn && kobiLive) {
    try {
      const turns = st.chat.filter(m => !m.thinking).slice(-9, -1).map(m => ({ role: m.role === 'me' ? 'user' : 'assistant', content: m.text || '…' }));
      while (turns.length && turns[0].role !== 'user') turns.shift();
      const input = [{ role: 'user', content: KOBI_RULES + '\n\nDATA:\n' + kobiData() }, ...(turns.length ? [{ role: 'assistant', content: 'Siap, aku Kobi.' }, ...turns] : []), { role: 'user', content: text }];
      const merged = []; for (const t of input) { if (merged.length && merged[merged.length - 1].role === t.role) merged[merged.length - 1].content += '\n\n' + t.content; else merged.push({ ...t }); }
      const { text: out } = await sampleFn(merged, { modelTier: 'quick', cache: false, onText: ({ text: tt }) => { el.classList.remove('thinking'); el.textContent = parseActions(tt).body; $('#msgs').scrollTop = 1e6; } });
      const { body, actions } = parseActions(out); finish(body, actions); return;
    } catch (e) {
      if (e && ['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].includes(e.code)) { kobiLive = false; updateKobiState(); }
      else if (e && e.code === 'rate_limited') toast('Kobi sedang sibuk. Jawaban dari data lokal.');
    }
  }
  setTimeout(() => { const r = localKobi(text); finish(r.text, r.actions); }, 450);
}
// ---------- search ----------
const q = $('#q'), results = $('#results');
q.addEventListener('input', () => {
  const items = searchItems(q.value); if (!q.value.trim()) { results.hidden = true; return; }
  results.innerHTML = items.length ? items.map((o, i) => `<button class="rrow" data-i="${i}"><span class="ric" style="--c:${o.c}">${ICO(o.icon)}</span><span><b>${esc(o.name)}</b><small>${esc(o.sub)}</small></span><span class="rmeta">${o.w.min} mnt</span></button>`).join('') : `<div class="rempty">Tidak ditemukan. Coba "komodo", "toilet", atau tanya Kobi.</div>`;
  results.hidden = false; results._items = items;
});
results.addEventListener('click', e => { const b = e.target.closest('.rrow'); if (!b) return; const o = results._items[+b.dataset.i]; results.hidden = true; q.blur(); o.k === 'z' ? selectZone(o.id) : selectPoi(o.id); });
q.addEventListener('keydown', e => { if (e.key === 'Enter') { const o = (results._items || [])[0]; if (o) { results.hidden = true; q.blur(); o.k === 'z' ? selectZone(o.id) : selectPoi(o.id); } else if (q.value.trim()) { sendKobi(q.value.trim()); q.value = ''; results.hidden = true; } } if (e.key === 'Escape') { results.hidden = true; q.blur(); } });

// ---------- fabs ----------
$('#fab-night').onclick = () => setNight(!st.night);
function setNight(on) { st.night = on; S.setNight(on); app.classList.toggle('night', on); $('#fab-night').classList.toggle('on', on); $('#fab-night').innerHTML = ICO(on ? 'sun' : 'moon'); toast(on ? 'Mode malam · suasana Surabaya Night Zoo' : 'Mode siang'); }
$('#fab-mode').onclick = () => { const m = S.mode === '3d' ? '2d' : '3d'; S.setMode(m); $('#fab-mode').textContent = m === '3d' ? '2D' : '3D'; toast(m === '2d' ? 'Tampilan 2D dari atas' : 'Tampilan 3D'); };
$('#fab-compass').onclick = () => S.resetNorth();
$('#fab-locate').onclick = () => { if (st.user) S.flyToPoint(st.user.pos, { dist: 40 }); else showQR(); };
$('#locpill').onclick = () => showQR();
$('#btn-kobi-top').onclick = () => openTab('kobi');
setInterval(() => { const a = S.azimuth(); $('#compass-ico').style.transform = `rotate(${a}rad)`; }, 120);

// ---------- QR onboarding ----------
const qrEl = $('#qr');
$('#qr-list').innerHTML = DATA.qr.map(qq => `<button data-q="${qq.id}">${ICO('qr')}<span><b>${esc(qq.name)}</b><small>${esc(qq.hint)}</small></span></button>`).join('');
$('#qr-list').onclick = e => { const b = e.target.closest('[data-q]'); if (b) scanQR(b.dataset.q); };
$('#qr-skip').onclick = () => { qrEl.classList.add('gone'); S.overview(); };
function showQR() { $('#menu').hidden = true; qrEl.classList.remove('gone', 'scanning'); }
function scanQR(id) {
  const qq = QMAP[id]; if (!qq) return; qrEl.classList.add('scanning');
  setTimeout(() => { qrEl.classList.add('gone'); qrEl.classList.remove('scanning'); setUser(qq); refreshPins(); toast('Lokasi terdeteksi: ' + qq.name); S.flyToPoint(qq.pos, { dist: 64 }); if (st.route) showRoute(st.route.t); if (st.tab === 'rute') renderPlanner(); markDemo('scan'); }, 750);
}

// ---------- menu & overlay ----------
const overlay = $('#overlay');
$('#btn-menu').onclick = () => { $('#menu').hidden = false; };
$('#menu').onclick = e => { const b = e.target.closest('[data-menu]'); if (!b) { if (e.target === $('#menu')) $('#menu').hidden = true; return; } $('#menu').hidden = true; const m = b.dataset.menu; if (m === 'rescan') showQR(); else if (m === 'admin') openAdmin(); else if (m === 'about') openAbout(); };
const desktopMQ = matchMedia('(min-width: 1180px) and (min-height: 720px)');
function placeAdmin() { if (desktopMQ.matches) { $('#admin-dock').append($('#admin')); if (overlay.dataset.kind === 'admin') closeOverlay(); } }
desktopMQ.addEventListener('change', placeAdmin);
function openOverlay(kind, title, node) { overlay.dataset.kind = kind; overlay.innerHTML = `<div class="ov-h"><button class="sh-close" id="ov-x" aria-label="Kembali">${ICO('back', 'sm')}</button><b>${title}</b></div><div class="ov-b"></div>`; $('.ov-b', overlay).append(node); overlay.hidden = false; $('#ov-x').onclick = closeOverlay; }
function closeOverlay() { if (overlay.dataset.kind === 'admin') $('#admin-dock').append($('#admin')); overlay.hidden = true; overlay.innerHTML = ''; overlay.dataset.kind = ''; }
function openAdmin() { if (desktopMQ.matches) { const d = $('#admin-dock'); d.scrollTop = 0; d.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.015)' }, { transform: 'scale(1)' }], { duration: 500 }); toast('Dasbor pengelola ada di panel kanan'); return; } openOverlay('admin', 'Mode pengelola', $('#admin')); }
function openAbout() { const n = document.createElement('div'); n.innerHTML = $('#pitch').innerHTML; openOverlay('about', 'Tentang prototype', n); }

// ---------- admin dashboard ----------
const ADMIN_ITEMS = [
  { k: 'z', id: 'perahu', sub: 'Wahana perahu & dermaga' }, { k: 'e', id: 'jembatan', name: 'Jalur Jembatan Cinta', sub: 'Jalur pejalan kaki' },
  { k: 'z', id: 'aviary', sub: 'Status 2026 belum terkonfirmasi' }, { k: 'p', id: 'wc-plaza', sub: 'Fasilitas umum' },
  { k: 'z', id: 'unta', sub: 'Wahana berbayar' }, { k: 'z', id: 'giz', sub: 'Wahana berbayar' },
];
const spark = [12, 14, 13, 17, 15, 19, 22, 18, 21, 25, 23, 28, 26, 31];
function sparkSvg(arr) { const max = Math.max(...arr), min = Math.min(...arr); const pts = arr.map((v, i) => `${(i / (arr.length - 1) * 100).toFixed(1)},${(26 - (v - min) / (max - min) * 22).toFixed(1)}`); return `<svg viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true"><polyline points="0,28 ${pts.join(' ')} 100,28" fill="color-mix(in srgb, var(--primary) 14%, transparent)" stroke="none"/><polyline points="${pts.join(' ')}" fill="none" stroke="var(--primary)" stroke-width="2" vector-effect="non-scaling-stroke"/><circle cx="100" cy="${pts[pts.length - 1].split(',')[1]}" r="2.6" fill="var(--primary)"/></svg>`; }
function isClosedItem(it) { return it.k === 'z' ? st.closedZones.has(it.id) : it.k === 'p' ? st.closedPois.has(it.id) : st.closedEdges.has(it.id); }
function itemName(it) { return it.name || (it.k === 'z' ? ZMAP[it.id].name : PMAP[it.id].name); }
function renderAdmin() {
  const total = ZONES.length + POIS.length, ver = st.verified.size, pct = Math.round(ver / total * 100);
  const queue = POIS.filter(p => !st.verified.has('p:' + p.id)).slice(0, 5);
  $('#admin').innerHTML = `<div class="adm">
    <div class="adm-h"><span class="logo">${ICO('building', 'lg')}</span><span><b>Dasbor Pengelola</b><small>Perumda KBS · Paket ${DATA.meta.plan.name} (${DATA.meta.plan.price})</small></span></div>
    <div class="kpis">
      <div class="kpi"><small>Akses via QR · 30 hari <span class="demo-tag">DEMO</span></small><b>18,4rb</b>${sparkSvg(spark)}</div>
      <div class="kpi"><small>Kepuasan pengunjung <span class="demo-tag">DEMO</span></small><b>4,6<span style="font-size:15px;color:var(--ink-3)">/5</span></b><span class="adm-note">Survei singkat setelah kunjungan</span></div>
      <div class="kpi"><small>Titik lokasi</small><b>${total}<span style="font-size:15px;color:var(--ink-3)">/${DATA.meta.plan.maxPoints}</span></b><div class="bar"><i style="width:${total}%"></i></div></div>
      <div class="kpi"><small>Data terverifikasi</small><b>${pct}%</b><div class="bar"><i style="width:${pct}%"></i></div></div>
    </div>
    <div class="acard2"><h3>${ICO('alert', 'sm')}Status operasional</h3>${ADMIN_ITEMS.map((it, i) => { const c = isClosedItem(it); return `<div class="srow"><span class="sn"><b>${esc(itemName(it))}</b><small>${esc(it.sub)}</small></span><span class="sw" role="group" aria-label="Status ${esc(itemName(it))}"><button class="${!c ? 'on open' : ''}" data-st="${i}" data-v="0">Buka</button><button class="${c ? 'on shut' : ''}" data-st="${i}" data-v="1">Tutup</button></span></div>`; }).join('')}
      <p class="adm-note" style="margin:8px 0 0">Perubahan langsung tampil di peta pengunjung dan rute dialihkan otomatis.</p></div>
    <div class="acard2"><h3>${ICO('megaphone', 'sm')}Pengumuman ke pengunjung</h3><form class="annc" id="annc"><label for="annc-in" class="sr">Isi pengumuman</label><input id="annc-in" value="Feeding gajah hari ini dimajukan ke 13.30." maxlength="120"><button class="btn sm primary" style="flex:none">Kirim</button></form></div>
    <div class="acard2 vq"><h3>${ICO('shield', 'sm')}Menunggu verifikasi lokasi</h3>${queue.length ? queue.map(p => `<div class="srow"><span class="sn"><b>${esc(p.name)}</b><small>${POI_T[p.type].label} · posisi ilustratif</small></span><button class="btn sm ghost" data-ver="${p.id}">${ICO('check', 'sm')}Verifikasi</button></div>`).join('') : '<p class="adm-note">Semua lokasi sudah diverifikasi.</p>'}</div>
    <div class="acard2"><h3>${ICO('clock', 'sm')}Riwayat perubahan</h3>${st.log.length ? `<ul class="log">${st.log.slice().reverse().map(l => `<li><time>${l.t}</time><span><b>${esc(l.what)}</b> <span class="who">· ${esc(l.who)}</span></span></li>`).join('')}</ul>` : '<p class="adm-note">Belum ada perubahan di sesi ini. Ubah status di atas untuk mencobanya.</p>'}</div>
  </div>`;
  $$('#admin [data-st]').forEach(b => b.onclick = () => setItemClosed(ADMIN_ITEMS[+b.dataset.st], b.dataset.v === '1'));
  $$('#admin [data-ver]').forEach(b => b.onclick = () => { const p = PMAP[b.dataset.ver]; st.verified.add('p:' + p.id); addLog('Lokasi diverifikasi: ' + p.name); renderAdmin(); if (st.sel === 'p:' + p.id) selectPoi(p.id, { noFly: true }); });
  $('#annc').onsubmit = e => { e.preventDefault(); const v = $('#annc-in').value.trim(); if (!v) return; showBanner(v); addLog('Pengumuman dikirim: "' + v + '"'); renderAdmin(); };
}
function addLog(what) { st.log.push({ t: hhmm(wib().min), what, who: 'Admin KBS' }); }
function setItemClosed(it, closed) {
  if (isClosedItem(it) === closed) return; const name = itemName(it);
  if (it.k === 'z') { closed ? st.closedZones.add(it.id) : st.closedZones.delete(it.id); S.setZoneClosed(it.id, closed); }
  else if (it.k === 'p') { closed ? st.closedPois.add(it.id) : st.closedPois.delete(it.id); }
  else { closed ? st.closedEdges.add(it.id) : st.closedEdges.delete(it.id); S.setEdgeClosed(it.id, closed); dcache = null; for (const k in nodeCache) delete nodeCache[k]; }
  addLog(`${name} ${closed ? 'ditutup sementara' : 'dibuka kembali'}`); renderAdmin(); refreshPins();
  showBanner(`${name} ${closed ? 'ditutup sementara. Rute dialihkan otomatis.' : 'sudah dibuka kembali.'}`);
  if (st.route) showRoute(st.route.t); else if (st.plan) runPlan(); else if (st.sel === 'z:' + it.id) selectZone(it.id, { noFly: true }); else if (st.sel === 'p:' + it.id) selectPoi(it.id, { noFly: true });
}
function showBanner(text) { const b = $('#banner'); b.hidden = false; b.innerHTML = `${ICO('megaphone')}<span><b>Info pengelola · ${hhmm(wib().min)}</b>${esc(text)}</span><button aria-label="Tutup info">${ICO('x', 'sm')}</button>`; b.querySelector('button').onclick = () => b.hidden = true; clearTimeout(showBanner.t); showBanner.t = setTimeout(() => b.hidden = true, 9000); }

// ---------- toast ----------
function toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), ms); }

// ---------- demo flow ----------
function markDemo(k) { $$(`[data-demo="${k}"]`).forEach(b => b.classList.add('done')); }
document.addEventListener('click', e => {
  const b = e.target.closest('[data-demo]'); if (!b) return; const k = b.dataset.demo; if (!overlay.hidden) closeOverlay();
  if (k === 'scan') scanQR('qr-gerbang');
  else if (k === 'komodo') { openTab('peta'); selectZone('komodo'); markDemo(k); }
  else if (k === 'toilet') { sendKobi('Toilet terdekat di mana?'); markDemo(k); }
  else if (k === 'plan') { st.planner.interests = new Set(['anak']); st.planner.minutes = 120; runPlan(); markDemo(k); }
  else if (k === 'night') { setNight(!st.night); markDemo(k); }
  else if (k === 'close') { const it = ADMIN_ITEMS[1]; openTab('peta'); if (isClosedItem(it)) setItemClosed(it, false); showRoute(target('z', 'kucing')); setTimeout(() => { setItemClosed(it, true); markDemo(k); }, 1600); }
});

// ---------- boot ----------
// ---------- Flutter bridge ----------
// Flutter (webview_flutter): addJavaScriptChannel('Jelajah', ...) menerima event; runJavaScript("jelajah.selectZone('komodo')") mengendalikan peta.
function postBridge(type, payload) { try { if (window.Jelajah && window.Jelajah.postMessage) window.Jelajah.postMessage(JSON.stringify({ type, ...payload })); } catch { } }
window.jelajah = {
  selectZone: id => selectZone(id), selectPoi: id => selectPoi(id), route: (kind, id) => showRoute(target(kind === 'poi' ? 'p' : 'z', id)),
  plan: (interests, minutes) => { st.planner.interests = new Set(interests || ['anak']); st.planner.minutes = minutes || 120; runPlan(); },
  scanQR: id => scanQR(id), setNight: on => setNight(!!on), setFilter: f => setFilter(f), overview: () => S.overview(),
  setClosed: (kind, id, closed) => setItemClosed({ k: kind, id, name: kind === 'e' ? id : undefined, sub: '' }, !!closed), data: DATA,
};
placeAdmin(); renderAdmin(); refreshPins(); window.__jelajah = { S, st };
const hash = (location.hash || '').slice(1); if (QMAP[hash]) setTimeout(() => scanQR(hash), 600);
