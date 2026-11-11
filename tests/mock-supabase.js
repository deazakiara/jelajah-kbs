// Mock kecil supabase-js untuk uji otomatis tanpa server (dipakai tests/smoke.mjs --mock).
(function () {
  const now = () => new Date().toISOString();
  const db = window.__mockdb = {
    seq: 100, calls: [], session: null, listeners: [], channels: [],
    users: [
      { id: 'u-visitor', email: 'pengunjung@jelajah.id', password: 'jelajah1916', name: 'Pengunjung Demo' },
      { id: 'u-admin', email: 'admin@kbs.id', password: 'jelajah1916', name: 'Admin KBS' },
    ],
    tables: {
      destinations: [{ id: 'kbs', name: 'Kebun Binatang Surabaya', data_as_of: 'Nov 2026', tickets: {}, max_points: 100 }],
      profiles: [{ id: 'u-visitor', name: 'Pengunjung Demo', role: 'pengunjung', destination_id: null }, { id: 'u-admin', name: 'Admin KBS', role: 'pengelola', destination_id: 'kbs' }],
      zones: [{ destination_id: 'kbs', id: 'komodo', name: 'Kompleks Komodo (dari server)', short_name: 'Komodo', price: 'Gratis', status: 'buka', dwell: 15, tags: ['reptil'], description: 'Deskripsi dari server', tips: '', verified: true }],
      pois: [], animals: [], qr_points: [],
      item_status: [{ destination_id: 'kbs', key: 'p:wc-plaza', closed: true, verified: null }],
      announcements: [{ id: 1, destination_id: 'kbs', text: 'Pengumuman lama dari server', level: 'info', auto: false, created_at: now() }],
      change_log: [{ id: 1, destination_id: 'kbs', what: 'Log lama dari server', who_name: 'Admin KBS', created_at: now() }],
      schedules: [{ destination_id: 'kbs', t: '09:15:00', dur: 20, title: 'Feeding komodo (server)', zone_id: 'komodo', note: '' }],
      favorites: [], passport_stamps: [], visit_plans: [], qr_scans: [], surveys: [],
    },
  };
  const USER_TABLES = ['favorites', 'passport_stamps', 'visit_plans'];
  class Q {
    constructor(t) { Object.assign(this, { t, op: 'select', f: [], payload: null, opts: {}, sel: false, one: false, maybe: false, ord: null, lim: null }); }
    select() { if (this.op !== 'select') this.sel = true; return this; }
    insert(p) { this.op = 'insert'; this.payload = p; return this; }
    upsert(p, o) { this.op = 'upsert'; this.payload = p; this.opts = o || {}; return this; }
    delete() { this.op = 'delete'; return this; }
    eq(c, v) { this.f.push(r => r[c] === v); return this; }
    in(c, vs) { this.f.push(r => vs.includes(r[c])); return this; }
    gte(c, v) { this.f.push(r => r[c] >= v); return this; }
    order(c, o) { this.ord = [c, o && o.ascending === false ? -1 : 1]; return this; }
    limit(n) { this.lim = n; return this; }
    single() { this.one = true; return this; }
    maybeSingle() { this.maybe = true; return this; }
    then(res, rej) { return Promise.resolve().then(() => this.exec()).then(res, rej); }
    exec() {
      const T = db.tables[this.t] = db.tables[this.t] || []; const uid = db.session && db.session.user.id;
      db.calls.push({ t: this.t, op: this.op, payload: this.payload ? JSON.parse(JSON.stringify(this.payload)) : null });
      const mine = r => !USER_TABLES.includes(this.t) || r.user_id === uid;
      if (USER_TABLES.includes(this.t) && this.op !== 'select' && !uid) return { data: null, error: { message: 'new row violates row-level security policy' } };
      if (this.op === 'select') {
        let rows = T.filter(r => mine(r) && this.f.every(f => f(r)));
        if (this.t === 'profiles') rows = rows.filter(r => r.id === uid);
        if (this.ord) { const [c, d] = this.ord; rows = rows.slice().sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * d); }
        if (this.lim) rows = rows.slice(0, this.lim);
        if (this.maybe) return { data: rows[0] || null, error: null };
        return { data: rows, error: null };
      }
      if (this.op === 'delete') { const keep = T.filter(r => !(mine(r) && this.f.every(f => f(r)))); db.tables[this.t] = keep; return { data: null, error: null }; }
      const rows = [].concat(this.payload).map(r => ({ id: ++db.seq, created_at: now(), user_id: uid, ...r }));
      for (const r of rows) {
        const keys = this.op === 'upsert' && this.opts.onConflict ? this.opts.onConflict.split(',') : null;
        const i = keys ? T.findIndex(x => keys.every(k => x[k] === r[k])) : -1;
        if (i >= 0) { if (!this.opts.ignoreDuplicates) T[i] = { ...T[i], ...r }; } else T.push(r);
      }
      if (this.sel) return { data: this.one ? rows[0] : rows, error: null };
      return { data: null, error: null };
    }
  }
  const client = {
    auth: {
      getSession: async () => ({ data: { session: db.session } }),
      signInWithPassword: async ({ email, password }) => {
        const u = db.users.find(x => x.email === email && x.password === password);
        if (!u) return { data: {}, error: { message: 'Invalid login credentials' } };
        db.session = { user: { id: u.id, email: u.email, user_metadata: { name: u.name } } };
        return { data: { user: db.session.user, session: db.session }, error: null };
      },
      signUp: async ({ email, password, options }) => {
        if (db.users.some(u => u.email === email)) return { data: { user: { identities: [] } }, error: null };
        const u = { id: 'u-' + (++db.seq), email, password, name: options.data.name }; db.users.push(u); db.tables.profiles.push({ id: u.id, name: u.name, role: 'pengunjung' });
        db.session = { user: { id: u.id, email, user_metadata: { name: u.name } } };
        return { data: { user: { ...db.session.user, identities: [{}] }, session: db.session }, error: null };
      },
      signOut: async () => { db.session = null; return { error: null }; },
      resetPasswordForEmail: async email => { db.calls.push({ auth: 'reset', email }); return { error: null }; },
      signInWithOAuth: async () => ({ error: { message: 'Unsupported provider: provider is not enabled' } }),
      updateUser: async () => ({ error: null }),
      onAuthStateChange: cb => { db.listeners.push(cb); return { data: { subscription: { unsubscribe() { } } } }; },
    },
    from: t => new Q(t),
    rpc: async (name, args) => {
      db.calls.push({ rpc: name, args });
      if (name === 'dashboard_stats') { const daily = []; for (let i = 29; i >= 0; i--) { const d = new Date(Date.now() - i * 864e5); daily.push({ d: d.toISOString().slice(0, 10), v: i % 7 === 0 ? 40 : 12 }); } return { data: { daily, top: [{ qr: 'qr-gerbang', v: 210 }, { qr: 'qr-plaza', v: 95 }], survey: { avg: 4.5, n: 2 } }, error: null }; }
      if (name === 'replace_schedule') { db.tables.schedules = args.items.map(i => ({ destination_id: args.dest, t: i.t + ':00', dur: i.dur, title: i.title, zone_id: i.zone, note: i.note })); return { data: null, error: null }; }
      return { data: null, error: { message: 'unknown rpc' } };
    },
    functions: { invoke: async (name, { body }) => { db.calls.push({ fn: name, body }); if (body.mode === 'prefs') return { data: { prefs: { grup: ['anak', 'lansia'], durasi_menit: 180, kategori: ['kucing'] } }, error: null }; return { data: { text: 'Halo dari Kobi server! Toilet terdekat: Toilet Gerbang Utama.\nAKSI: lihat=wc-gerbang; rute=wc-gerbang', provider: 'gemini' }, error: null }; } },
    channel: () => { const ch = { handlers: [], on(ev, filter, cb) { this.handlers.push({ filter, cb }); return this; }, subscribe() { db.channels.push(this); return this; } }; return ch; },
  };
  window.supabase = { createClient: () => client };
  window.__mockEmit = (table, event, row) => db.channels.forEach(ch => ch.handlers.filter(h => h.filter.table === table && (h.filter.event === '*' || h.filter.event === event)).forEach(h => h.cb({ eventType: event, new: row })));
})();
