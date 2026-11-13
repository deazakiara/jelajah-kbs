# Jelajah KBS

Peta 3D interaktif + pemandu AI "Kobi" untuk Kebun Binatang Surabaya. Pengunjung memindai QR di papan info, langsung tahu posisinya, mencari satwa dan fasilitas, mendapat rute jalan kaki, bertanya ke Kobi, dan mendapat itinerary otomatis sesuai rombongan (balita, anak, lansia, kursi roda), durasi, dan satwa favorit. Pengelola punya konsol untuk buka-tutup zona & jalur, verifikasi lokasi, jadwal, dan pengumuman yang tampil realtime di HP pengunjung.

Prototype lomba oleh Kelompok Gass poll · 2026.

## Teknologi

- **Frontend**: HTML/CSS/JS tanpa framework, peta 3D dengan Three.js r160 (diorama procedural + 25 model GLB).
- **Backend**: Supabase (Auth, Postgres + Row Level Security, Realtime, Edge Function untuk Kobi).
- **Hosting**: file statis di VPS CloudPanel (Nginx), deploy otomatis lewat GitHub Actions melalui SCP/SSH.
- Tanpa konfigurasi Supabase, website otomatis berjalan dalam **mode demo** (semua data di browser).

## Progress saat ini

Versi prototype web sudah mencakup:

- Peta 3D dengan 33 zona, 28 fasilitas, data satwa, dan model GLB; posisi awal dapat dibuka dari QR.
- Pencarian satwa/fasilitas, rute jalan kaki, itinerary berdasarkan durasi dan kebutuhan rombongan, serta Kobi dengan jawaban lokal dan opsi AI.
- Akun pengunjung dan konsol pengelola untuk status zona/jalur, verifikasi lokasi, jadwal, pengumuman realtime, dan data ringkasan.
- Mode demo lokal dan integrasi Supabase untuk autentikasi, database, realtime, dan Edge Function Kobi.

### CI/CD

Workflow aktif ada di [`.github/workflows/display.yaml`](.github/workflows/display.yaml):

- Setiap pull request menjalankan tes.
- Push ke `main` menjalankan tes, build produksi, mengemas artifact, lalu deploy ke CloudPanel melalui SCP/SSH.
- Tes mencakup perencana itinerary dan uji asap Playwright dalam mode demo serta mock Supabase.

CI/CD sudah berjalan; [run terakhir yang diverifikasi](https://github.com/deazakiara/jelajah-kbs/actions/runs/43263144435) berhasil pada tahap tes/build dan deploy. Workflow ini **belum** menjalankan migrasi database atau deploy Edge Function Supabase secara otomatis.

Prototype belum berarti siap untuk penggunaan publik: data lokasi/jadwal masih perlu validasi lapangan, dan privasi serta konfigurasi email perlu dituntaskan. Lihat [`docs/ROADMAP.md`](docs/ROADMAP.md).

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
.github/workflows/  CI/CD: test, build, and deploy website
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
