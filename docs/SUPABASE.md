# Backend Supabase · Jelajah KBS

Supabase menangani **login**, **database**, **realtime**, dan **pemandu AI Kobi** (edge function). Website tetap file statis; semua akses data dijaga oleh Row Level Security (RLS) di database.

Tanpa konfigurasi Supabase, website otomatis jalan dalam **mode demo** (data di browser masing-masing), sama seperti prototype awal.

## Isi folder `supabase/`

| Path | Isi |
|---|---|
| `migrations/20261110000000_init.sql` | tabel, fungsi, RLS, realtime |
| `migrations/20261110000100_seed_kbs.sql` | data awal KBS: 33 zona, 28 fasilitas, 48 satwa, 5 titik QR, jadwal. Dibuat oleh `npm run seed` dari `src/data.js` |
| `functions/kobi/index.ts` | edge function Kobi (Gemini atau Claude) |
| `config.toml` | konfigurasi Supabase CLI |

## Tabel utama

| Tabel | Isi | Siapa yang boleh |
|---|---|---|
| `destinations`, `zones`, `pois`, `animals`, `qr_points` | konten destinasi; `zones.plan` berisi atribut itinerary (usia wahana, kategori satwa, akses) | baca: semua · ubah: pengelola destinasi |
| `schedules` | jadwal feeding & pertunjukan | baca: semua · ubah: pengelola |
| `item_status` | buka/tutup zona, fasilitas, jalur + status verifikasi | baca: semua (realtime) · ubah: pengelola |
| `announcements` | info pengelola ke pengunjung | baca: semua (realtime) · kirim: pengelola |
| `change_log` | riwayat perubahan | pengelola |
| `profiles` | nama + role (`pengunjung` / `pengelola`) | milik sendiri; role hanya bisa diubah dari SQL |
| `favorites`, `passport_stamps`, `visit_plans` | data pribadi pengunjung | milik sendiri |
| `qr_scans`, `surveys` | analitik (Key Metric) | siapa pun mencatat · pengelola membaca |
| `kobi_usage` | kuota harian Kobi | hanya edge function |

Fungsi: `is_manager()`, `promote_to_manager(email, dest)`, `replace_schedule(dest, items)`, `dashboard_stats(dest, days)`, `kobi_hit(uid, lim)`.

## Setup project (sekali)

> Kalau connector Supabase sudah dihubungkan di Claude, langkah 1–3 bisa dikerjakan Claude langsung.

1. **Buat project** di supabase.com → *New project*. Region **Southeast Asia (Singapore)** (paling dekat ke Surabaya). Simpan password database.
2. **Terapkan migrasi.** Pilih salah satu:
   - GitHub Actions: isi secret/variable di `docs/DEPLOY.md`, lalu jalankan workflow **Supabase**.
   - Laptop: `npx supabase login` → `npx supabase link --project-ref <ref>` → `npx supabase db push`.
   - Manual: Dashboard → **SQL Editor** → tempel isi `init.sql`, *Run*, lalu `seed_kbs.sql`, *Run*.
3. **Auth** → **URL Configuration**
   - Site URL: `https://chelsea.cloudcomp.my.id`
   - Redirect URLs: `https://chelsea.cloudcomp.my.id/**` (tambahkan `http://localhost:8080/**` untuk uji lokal)
   - **Providers → Email**: biarkan *Confirm email* aktif. Email bawaan Supabase dibatasi sangat ketat (hanya beberapa email per jam). Untuk dipakai banyak orang, pasang SMTP sendiri di **Auth → SMTP Settings** (misalnya Resend, Brevo, atau email domain kampus).
4. **Akun demo**: **Authentication → Users → Add user → Create new user**
   - `pengunjung@jelajah.id` / `jelajah1916` (centang *Auto Confirm User*)
   - `admin@kbs.id` / `jelajah1916` (centang *Auto Confirm User*), lalu di SQL Editor:
     ```sql
     select public.promote_to_manager('admin@kbs.id', 'kbs');
     ```
   Setelah lomba/demo, ganti password kedua akun ini atau set `showDemoAccounts: false`.
5. **Kunci untuk website**: **Project Settings → API Keys**. Salin *Project URL* dan *anon / publishable key* ke GitHub Variables `SUPABASE_URL` dan `SUPABASE_ANON_KEY` (atau ke `jelajah.config.json` untuk build lokal). **Jangan pernah** memakai `service_role` / secret key di website. `deploy.mjs` akan berhenti kalau mendeteksinya.
6. **Edge function Kobi**: deploy lewat workflow **Supabase**, atau `npx supabase functions deploy kobi`.

### Login Google (opsional)

Google Cloud Console → buat OAuth Client (Web) → Authorized redirect URI: `https://<ref>.supabase.co/auth/v1/callback`. Masukkan Client ID & Secret di Supabase **Auth → Providers → Google**. Tombol "Masuk dengan Google" di website langsung berfungsi.

## Kobi AI dan biaya

Kobi selalu bisa menjawab dari **data lokal** (gratis, tanpa AI). Untuk jawaban AI sungguhan, edge function butuh salah satu API key. Key disimpan sebagai *secret* di Supabase, tidak pernah dikirim ke browser.

| Pilihan | Biaya | Catatan |
|---|---|---|
| `GEMINI_API_KEY` (Google AI Studio) | ada **tier gratis** untuk model Flash | batas request per menit/hari; data tier gratis dipakai Google untuk meningkatkan produknya. Cocok untuk demo & lomba |
| `ANTHROPIC_API_KEY` (Claude) | bayar per token, mis. Claude Haiku 5.5: US$0,10 / 1 juta token input, US$0,50 / 1 juta token output | satu pertanyaan Kobi ≈ 6–8 ribu token konteks ≈ ±US$0,001 |

Set secret:

```bash
npx supabase secrets set GEMINI_API_KEY=xxxx ALLOWED_ORIGINS=https://chelsea.cloudcomp.my.id
# opsional: KOBI_MODEL=<nama model>  KOBI_DAILY_LIMIT=30
```

Pengaman biaya yang sudah ada: hanya akun yang login yang bisa memanggil Kobi AI, maksimal 30 pertanyaan per akun per hari (`KOBI_DAILY_LIMIT`), jawaban maks. 400 token, konteks dibatasi. Saat key belum ada, kuota habis, atau penyedia AI error, aplikasi otomatis kembali ke jawaban lokal.

Harga dan nama model berubah dari waktu ke waktu. Cek halaman harga resmi sebelum mengaktifkan, dan pasang batas belanja (spend limit) di akun penyedia AI.

## Batas paket gratis Supabase (cek ulang di supabase.com/pricing)

- Database 500 MB, 50.000 pengguna aktif bulanan, 500.000 pemanggilan edge function, 200 koneksi realtime bersamaan.
- **Project dijeda setelah 7 hari tanpa aktivitas.** Workflow `keepalive.yml` melakukan ping tiap 3 hari. Untuk operasional sungguhan, pakai paket berbayar (ada backup harian).

## Perintah berguna

```bash
npm run seed                      # tulis ulang seed dari src/data.js
npx supabase db push              # terapkan migrasi baru
npx supabase functions deploy kobi
```

Log Kobi ada di Dashboard → **Edge Functions → kobi → Logs**.

Membuat migrasi baru: tambahkan file `supabase/migrations/<tanggal>_<nama>.sql`, jangan mengedit migrasi yang sudah diterapkan.
