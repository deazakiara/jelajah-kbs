# Jelajah KBS

Peta 3D interaktif + pemandu AI "Kobi" untuk Kebun Binatang Surabaya. Pengunjung memindai QR di papan info, langsung tahu posisinya, mencari satwa dan fasilitas, mendapat rute jalan kaki, bertanya ke Kobi, dan mendapat itinerary otomatis sesuai rombongan (balita, anak, lansia, kursi roda), durasi, dan satwa favorit. Pengelola punya konsol untuk buka-tutup zona & jalur, verifikasi lokasi, jadwal, dan pengumuman yang tampil realtime di HP pengunjung.

Prototype lomba oleh Kelompok Gass poll · 2026.

## Teknologi

- **Frontend**: HTML/CSS/JS tanpa framework, peta 3D dengan Three.js r160 (diorama procedural + 25 model GLB).
- **Backend**: Supabase (Auth, Postgres + Row Level Security, Realtime, Edge Function untuk Kobi).
- **Hosting**: file statis di VPS CloudPanel (Nginx), deploy otomatis lewat GitHub Actions + SSH.
- Tanpa konfigurasi Supabase, website otomatis berjalan dalam **mode demo** (semua data di browser).

## Mulai cepat

```bash
npm install
npm run deploy        # build ke dist/deploy (mode demo bila Supabase belum diisi)
npm run preview       # buka http://localhost:8080
```

Akun demo: `pengunjung@jelajah.id` (pengunjung) dan `admin@kbs.id` (pengelola), kata sandi keduanya `jelajah1916`. Di mode Supabase, kedua akun ini dibuat dulu di project (lihat `docs/SUPABASE.md`).

Hubungkan ke Supabase untuk build lokal: salin `jelajah.config.example.json` menjadi `jelajah.config.json` lalu isi URL dan anon key, atau pakai env `SUPABASE_URL` + `SUPABASE_ANON_KEY`.

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm run deploy` | build website ke `dist/deploy/` (index web, `hp/`, model, vendor, `config.js`) |
| `npm run preview` | server lokal untuk `dist/deploy` |
| `npm test` | uji perencana itinerary + build + uji asap Playwright (mode demo dan mock Supabase) |
| `npm run seed` | buat ulang data awal Supabase dari `src/data.js` |
| `npm run build:web` | satu file HTML mandiri (untuk artifact/demo offline) |

## Struktur

```
src/            kode aplikasi
  data.js         dataset KBS (geometri peta, zona, satwa, fasilitas, QR, jadwal, tiket)
  scene.js        mesin peta 3D
  core.js         logika bersama: routing, Kobi lokal, pencarian
  planner.js      itinerary otomatis (OPTW + Iterated Local Search) & dialog tanya-jawab Kobi
  backend.js      koneksi Supabase (auth, data, realtime, Kobi AI) + fallback mode demo
  webui.js        UI website: landing, login, web app pengunjung, konsol pengelola
  ui.js, body.html, style.css   prototype versi HP (/hp/)
assets/models/  25 model satwa GLB
assets/qr/      kartu QR siap cetak
supabase/       migrasi database, seed, edge function kobi, config CLI
.github/workflows/  deploy website, deploy Supabase, tes, keep-alive
tests/          uji asap + mock supabase-js
tools/          generator seed, server preview, skrip ekspor/validasi
docs/           panduan deploy, Supabase, roadmap, blueprint Flutter
```

## Dokumentasi

- `docs/DEPLOY.md` · online-kan ke CloudPanel (Domainesia) dengan GitHub Actions + SSH
- `docs/SUPABASE.md` · setup backend, akun demo, Kobi AI & biayanya
- `docs/ITINERARY.md` · algoritma itinerary otomatis (kenapa dipilih, cara kerja, data yang perlu diverifikasi)
- `docs/ROADMAP.md` · apa yang masih kurang untuk jadi web app produksi
- `docs/BLUEPRINT.md` · catatan prototype awal, arsitektur Flutter, model data, checklist verifikasi lapangan
