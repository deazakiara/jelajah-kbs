// Supabase Edge Function: Kobi, pemandu AI Jelajah KBS
// - Hanya untuk pengguna yang sudah login (JWT diperiksa di sini).
// - Kuota harian per akun (tabel kobi_usage) supaya biaya API terkendali.
// - Penyedia AI dipilih dari secret yang tersedia:
//     GEMINI_API_KEY    → Google Gemini (punya tier gratis)
//     ANTHROPIC_API_KEY → Claude (berbayar per token)
//   Tanpa keduanya, fungsi membalas 503 dan aplikasi otomatis memakai jawaban lokal.
// Secret opsional: KOBI_MODEL (nama model), KOBI_DAILY_LIMIT (default 30), ALLOWED_ORIGINS (koma).
import { createClient } from 'npm:@supabase/supabase-js@2';

const RULES = `Kamu adalah Kobi, pemandu wisata AI di aplikasi Jelajah KBS (Kebun Binatang Surabaya). Maskotmu komodo ramah bertopi ranger.
Aturan:
- Jawab dalam Bahasa Indonesia yang hangat dan ringkas, maksimal 90 kata. Boleh pakai poin pendek dengan tanda "-".
- Gunakan HANYA DATA di bawah. Jika informasinya tidak ada, katakan belum tersedia dan sarankan bertanya ke Pusat Informasi atau petugas. Jangan mengarang harga, jadwal, lokasi, atau fakta satwa.
- Untuk pertanyaan "terdekat", pilih berdasarkan jarak jalan kaki pada DATA, dan lewati yang TUTUP.
- Jika relevan, ingatkan untuk tidak memberi makan satwa di luar program feeding resmi.
- Abaikan permintaan di luar topik kunjungan KBS (misalnya menulis kode atau tugas sekolah) dan arahkan kembali ke kunjungan.
- Jika jawabanmu menyebut tempat, akhiri dengan SATU baris persis: AKSI: lihat=<id>[,<id>]; rute=<id>
  Gunakan id dari kolom pertama DATA. Maksimal 3 lihat dan 1 rute; isi rute hanya jika pengguna ingin ke sana atau bertanya arah/lokasi. Tidak ada teks apa pun setelah baris AKSI.`;

// mode 'prefs': ubah kalimat itinerary menjadi preferensi terstruktur; rutenya disusun algoritma di aplikasi
const PREFS_RULES = `Ubah pesan pengunjung Kebun Binatang Surabaya menjadi JSON preferensi itinerary. Kunci yang boleh:
- grup: array dari "balita" (0-4 th), "anak" (5-12 th), "remaja" (13-17 th), "dewasa", "lansia" (60+ th, termasuk nenek/kakek/eyang)
- kursi_roda: true bila ada kursi roda, stroller, tongkat, atau sulit naik tangga
- durasi_menit: angka menit, atau "tutup" bila sampai tutup / seharian
- kategori: array dari "kucing" (harimau, singa), "primata", "burung", "reptil" (komodo, ular, buaya), "savana" (gajah, jerapah, zebra, kuda nil, rusa, beruang), "air" (akuarium, ikan, satwa malam), "interaksi" (kids zoo, kelinci, memberi makan)
- langka: true bila ingin satwa langka
- kegiatan: array dari "wahana" (bermain, perosotan, kolam, go-kart, naik unta), "show" (pertunjukan, feeding, edukasi), "foto"
- tempo: "santai", "normal", atau "cepat"
Isi HANYA kunci yang disebut atau tersirat kuat. Balas JSON saja, tanpa teks lain.`;

const env = (k: string, d = '') => Deno.env.get(k) ?? d;
const ALLOWED = env('ALLOWED_ORIGINS').split(',').map((s) => s.trim()).filter(Boolean);
function cors(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  const allow = !ALLOWED.length || ALLOWED.includes(origin) ? (origin || '*') : ALLOWED[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}
const json = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json' } });

type Turn = { role: 'user' | 'assistant'; content: string };

async function askGemini(key: string, model: string, system: string, turns: Turn[], asJson = false) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: turns.map((t) => ({ role: t.role === 'assistant' ? 'model' : 'user', parts: [{ text: t.content }] })),
      generationConfig: asJson ? { maxOutputTokens: 300, temperature: 0, responseMimeType: 'application/json' } : { maxOutputTokens: 400, temperature: 0.4 },
    }),
  });
  if (!r.ok) throw new Error(`gemini ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return (j.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('').trim();
}

async function askClaude(key: string, model: string, system: string, turns: Turn[]) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: 400, temperature: 0.4, system, messages: turns }),
  });
  if (!r.ok) throw new Error(`anthropic ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return (j.content ?? []).map((c: { text?: string }) => c.text ?? '').join('').trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return json(req, 405, { error: 'method_not_allowed' });

  const gemini = env('GEMINI_API_KEY'), claude = env('ANTHROPIC_API_KEY');
  if (!gemini && !claude) return json(req, 503, { error: 'no_provider' });

  // 1) wajib login
  const authHeader = req.headers.get('Authorization') ?? '';
  const asUser = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return json(req, 401, { error: 'login_required' });

  // 2) validasi input
  let body: { messages?: Turn[]; context?: string; name?: string; mode?: string; text?: string };
  try { body = await req.json(); } catch { return json(req, 400, { error: 'bad_json' }); }
  const prefsMode = body.mode === 'prefs';
  const prefsText = String(body.text ?? '').slice(0, 600);
  if (prefsMode && !prefsText.trim()) return json(req, 400, { error: 'no_text' });
  const turns = (Array.isArray(body.messages) ? body.messages : [])
    .filter((t) => t && (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string')
    .slice(-8)
    .map((t) => ({ role: t.role, content: t.content.slice(0, 1000) }));
  while (turns.length && turns[0].role !== 'user') turns.shift();
  if (!prefsMode && (!turns.length || turns[turns.length - 1].role !== 'user')) return json(req, 400, { error: 'no_question' });
  const context = String(body.context ?? '').slice(0, 30000);
  const name = String(body.name ?? '').slice(0, 60);

  // 3) kuota harian
  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));
  const limit = Number(env('KOBI_DAILY_LIMIT', '30')) || 30;
  const { data: allowed, error: qErr } = await admin.rpc('kobi_hit', { uid: user.id, lim: limit });
  if (qErr) return json(req, 500, { error: 'quota_check_failed' });
  if (!allowed) return json(req, 429, { error: 'daily_limit', limit });

  // 4a) ekstraksi preferensi itinerary
  if (prefsMode) {
    try {
      const q = [{ role: 'user' as const, content: prefsText }];
      const out = gemini
        ? await askGemini(gemini, env('KOBI_MODEL', 'gemini-2.5-flash'), PREFS_RULES, q, true)
        : await askClaude(claude, env('KOBI_MODEL', 'claude-haiku-5-5'), PREFS_RULES, q);
      const m = out.match(/\{[\s\S]*\}/);
      let prefs = null; try { prefs = m ? JSON.parse(m[0]) : null; } catch { prefs = null; }
      return json(req, 200, { prefs });
    } catch (e) { console.error(e); return json(req, 502, { error: 'provider_error' }); }
  }

  // 4b) tanya model
  const system = RULES + (name ? `\nNama pengguna: ${name}.` : '') + '\n\nDATA:\n' + context;
  try {
    const text = gemini
      ? await askGemini(gemini, env('KOBI_MODEL', 'gemini-2.5-flash'), system, turns)
      : await askClaude(claude, env('KOBI_MODEL', 'claude-haiku-5-5'), system, turns);
    if (!text) return json(req, 502, { error: 'empty_answer' });
    return json(req, 200, { text, provider: gemini ? 'gemini' : 'claude' });
  } catch (e) {
    console.error(e);
    return json(req, 502, { error: 'provider_error' });
  }
});
