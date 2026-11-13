# Jelajah KBS

Peta 3D interaktif + pemandu AI "Kobi" untuk Kebun Binatang Surabaya. Pengunjung memindai QR di papan info, langsung tahu posisinya, mencari satwa dan fasilitas, mendapat rute jalan kaki, bertanya ke Kobi, dan mendapat itinerary otomatis sesuai rombongan (balita, anak, lansia, kursi roda), durasi, dan satwa favorit. Pengelola punya konsol untuk buka-tutup zona & jalur, verifikasi lokasi, jadwal, dan pengumuman yang tampil realtime di HP pengunjung.

Prototype project team 5

- Website: https://chelsea.cloudcomp.my.id
- Tanpa backend pun bisa dicoba (mode demo): `npm install && npm run deploy && npm run preview`

## Tim

| Nama | NIM | Peran |
|---|---|---|
| _isi nama_ | _isi NIM_ | _mis. frontend & peta 3D_ |
| _isi nama_ | _isi NIM_ | _mis. backend Supabase & CI/CD_ |
| _isi nama_ | _isi NIM_ | _mis. UI/UX & Figma_ |
| _isi nama_ | _isi NIM_ | _mis. riset lapangan & data KBS_ |

## Progress fitur (per 12 November 2026)

17 dari 22 item selesai, 3 sebagian, 2 belum.

### Pengunjung

| Fitur | Status | Catatan |
|---|---|---|
| Peta 3D interaktif | Selesai | Three.js, 33 zona, 25 model satwa GLB |
| Scan QR → posisi langsung di peta | Selesai | 5 titik QR, kartu siap cetak di `assets/qr/` |
| Cari satwa & fasilitas | Selesai | 48 satwa, 28 fasilitas |
| Rute jalan kaki | Selesai | Dijkstra, bisa hindari tangga & jalur yang ditutup |
| Pemandu AI Kobi | Selesai | Jawaban lokal + AI (Gemini/Claude) lewat edge function, kuota 30/akun/hari |
| Itinerary otomatis | Selesai | Rombongan, durasi, usia wahana, satwa favorit; OPTW + Iterated Local Search (`docs/ITINERARY.md`) |
| Jadwal feeding & pertunjukan | Selesai | Pengingat selama tab terbuka |
| Akun pengunjung | Selesai | Favorit, paspor stamp, rencana tersimpan, survei kepuasan |
| Daftar, login email, lupa password | Selesai | Supabase Auth |
| Login Google | Sebagian | Kode siap, OAuth Client Google belum dibuat |

### Pengelola KBS

| Fitur | Status | Catatan |
|---|---|---|
| Buka/tutup zona, fasilitas, jalur | Selesai | Realtime ke HP pengunjung |
| Verifikasi titik lokasi | Selesai | |
| Jadwal & pengumuman | Selesai | Pengumuman realtime |
| Dasbor analitik + riwayat perubahan | Selesai | Scan QR per hari, titik terpopuler, rating survei |
| Ubah konten zona/satwa/QR dari konsol | Belum | Sementara lewat Supabase Table Editor |

### Platform, desain & dokumen

| Item | Status | Catatan |
|---|---|---|
| Backend Supabase | Sebagian | Skema, RLS, seed, edge function Kobi selesai & teruji; migrasi ke project production berjalan |
| CI/CD GitHub Actions | Sebagian | 4 workflow siap (lihat bagian CI/CD); tinggal isi Secrets & setup server |
| Pengujian otomatis | Selesai | 33 unit test itinerary, smoke test Playwright 2 mode, uji RLS |
| Wireframe lo-fi & prototype login (Figma) | Selesai | |
| Skenario usability test | Selesai | Pertanyaan sudah disusun |
| Video demo (Bahasa Inggris) | Selesai | |
| PWA offline, UI Bahasa Inggris, aplikasi Flutter | Belum | Masuk `docs/ROADMAP.md` |

## CI/CD

| Workflow | Jalan saat | Isi |
|---|---|---|
| `test.yml` (CI) | setiap push ke `main` & pull request | unit test itinerary → build → smoke test Playwright (mode demo + mock Supabase) |
| `deploy-web.yml` (CD) | push ke `main` yang mengubah `src/`, `assets/`, dll. | unit test → build → rsync lewat SSH ke CloudPanel → cek `config.js` HTTP 200 |
| `supabase.yml` (CD) | push ke `main` yang mengubah `supabase/` | `supabase db push` (migrasi) → set secrets → deploy edge function `kobi` |
| `keepalive.yml` | tiap 3 hari (cron) | ping Supabase supaya project gratis tidak dijeda |

Secrets & variables yang dibutuhkan ada di `docs/DEPLOY.md`.

## Teknologi

- **Frontend**: HTML/CSS/JS tanpa framework, peta 3D dengan Three.js r160 (diorama procedural + 25 model GLB).
- **Backend**: Supabase (Auth, Postgres + Row Level Security, Realtime, Edge Function untuk Kobi).
- **AI**: Kobi lewat Supabase Edge Function (Gemini 2.5 Flash atau Claude Haiku); tanpa API key tetap menjawab dari data lokal.
- **Algoritma**: Dijkstra untuk rute jalan kaki; Orienteering Problem with Time Windows + Iterated Local Search untuk itinerary.
- **Hosting**: file statis di VPS CloudPanel (Nginx), domain Domainesia, SSL Let's Encrypt; deploy otomatis lewat GitHub Actions + SSH.
- **Testing**: Playwright (smoke test), Node test runner (itinerary), PGlite (aturan akses database).
- **Desain**: Figma (wireframe lo-fi, prototype).
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
