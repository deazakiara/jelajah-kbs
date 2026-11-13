# Jelajah KBS

Peta 3D interaktif + pemandu AI "Kobi" untuk Kebun Binatang Surabaya. Pengunjung memindai QR di papan info, langsung tahu posisinya, mencari satwa dan fasilitas, mendapat rute jalan kaki, bertanya ke Kobi, dan mendapat itinerary otomatis sesuai rombongan (balita, anak, lansia, kursi roda), durasi, dan satwa favorit. Pengelola punya konsol untuk buka-tutup zona & jalur, verifikasi lokasi, jadwal, dan pengumuman yang tampil realtime di HP pengunjung.

Prototype project team 5

- Website: https://kbs.cloudcomp.my.id/
- Tanpa backend tetap bisa dicoba (mode demo): `npm install && npm run deploy && npm run preview`

## Tim

| Nama | NIM | PIC |
|---|---|---|
| Matahari Dea Zakiara | 0706012410034 | _frontend & peta 3D_ |
| Febby Rudhieta Dharmawan | 076012410002 | _backend Supabase & CI/CD_ |
| Chelsea Deanna Husin | 0706012410030 | _UI/UX & Figma_ |

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
| Backend Supabase | Sebagian | Skema, RLS, seed, dan Edge Function Kobi tersedia di repo; status deploy ke project production perlu dikonfirmasi di Supabase |
| CI/CD GitHub Actions | Sebagian | Deploy website otomatis sudah berjalan; deploy migrasi dan Edge Function Supabase belum masuk workflow |
| Pengujian otomatis | Selesai | Tes planner itinerary dan smoke test Playwright dalam mode demo serta mock Supabase |
| Wireframe lo-fi & prototype login (Figma) | Selesai | |
| Skenario usability test | Selesai | Pertanyaan sudah disusun |
| Video demo (Bahasa Inggris) | Selesai | |
| PWA offline, UI Bahasa Inggris, aplikasi Flutter | Belum | Masuk `docs/ROADMAP.md` |

## CI/CD

Per 13 November 2026, repository memiliki **1 file workflow aktif** (`.github/workflows/display.yaml`) dan sudah tercatat **15 workflow run**. Istilah *workflow* adalah definisi pipeline; *run* adalah satu kali pipeline dijalankan. [Run #15 berhasil](https://github.com/deazakiara/jelajah-kbs/actions/runs/43345409499).

| Workflow | Pemicu | Yang dijalankan |
|---|---|---|
| `Jelajah KBS CI/CD Deployment` (`display.yaml`) | Pull request atau push ke `main` | Pull request menjalankan tes. Push ke `main` menjalankan tes, build produksi, membuat artifact, lalu deploy website ke CloudPanel. |

Pipeline menggunakan Node.js 22 dan Chromium untuk tes Playwright. `npm test` menjalankan tes planner itinerary, build, dan smoke test dalam mode demo serta mock Supabase. Deploy website mengirim archive menggunakan SCP, lalu mengekstraknya di server lewat SSH.

**Batas cakupan:** workflow ini hanya men-deploy website. Migrasi database dan Edge Function Kobi belum otomatis dijalankan oleh workflow aktif. Konfigurasi yang dipakai workflow:

- **Secrets:** `SSH_HOST`, `SSH_USER`, `SSH_PASSWORD`; `SSH_PORT` opsional.
- **Variables:** `SITE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`; `DEPLOY_PATH` opsional jika lokasi situs tidak ditemukan otomatis.

Untuk konfigurasi server, lihat [`docs/DEPLOY.md`](docs/DEPLOY.md), tetapi perhatikan panduannya masih memuat nama workflow, domain, serta metode SSH/rsync yang berbeda dari workflow aktif ini.

## Teknologi

- **Frontend**: HTML/CSS/JS tanpa framework, peta 3D dengan Three.js r160 (diorama procedural + 25 model GLB).
- **Backend**: Supabase (Auth, Postgres + Row Level Security, Realtime, Edge Function untuk Kobi).
- **AI**: Kobi lewat Supabase Edge Function (Gemini 2.5 Flash atau Claude Haiku); tanpa API key tetap menjawab dari data lokal.
- **Algoritma**: Dijkstra untuk rute jalan kaki; Orienteering Problem with Time Windows + Iterated Local Search untuk itinerary.
- **Hosting**: file statis di VPS CloudPanel (Nginx), domain `kbs.cloudcomp.my.id` dengan SSL; deploy otomatis lewat GitHub Actions (SCP/SSH).
- **Testing**: tes planner itinerary dan Playwright smoke test (mode demo + mock Supabase). Belum ada tes integrasi otomatis untuk kebijakan RLS database.
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
.github/workflows/  CI/CD website (tes, build, deploy)
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
