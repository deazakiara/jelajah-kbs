# Jelajah KBS · Catatan prototype & blueprint Flutter

> Dokumen ini catatan prototype awal (Oktober 2026). Untuk menjalankan dan men-deploy versi sekarang, lihat `README.md`, `docs/DEPLOY.md`, dan `docs/SUPABASE.md`.

Prototype peta 3D interaktif + pemandu AI "Kobi" untuk Kebun Binatang Surabaya (KBS). Dibuat sebagai acuan desain dan bahan demo lomba, mengikuti Lean Canvas Kelompok Gass poll.

## Isi paket

| Path | Isi |
|---|---|
| `src/data.js` | Dataset KBS: geometri peta, 33 zona, 48 satwa, 28 fasilitas, 5 titik QR, graf jalur (38 node, 47 ruas), jadwal, tiket |
| `kbs_data.json` | Dataset yang sama dalam JSON, siap jadi `assets/data/kbs.json` di Flutter |
| `src/scene.js` | Mesin peta 3D diorama (Three.js r160): dunia procedural, hewan beranimasi, air, siang/malam, rute, kamera |
| `src/ui.js` | Lapisan aplikasi: pin, pencarian, bottom sheet, routing Dijkstra, perencana kunjungan, Kobi, jadwal, tiket, dasbor pengelola, JS bridge |
| `src/style.css`, `src/head.html`, `src/body.html` | Desain UI (token warna terang/gelap, ikon SVG, maskot Kobi) |
| `src/core.js` | Logika bersama versi HP & web: konstanta, state, routing Dijkstra, perencana kunjungan, data & aturan Kobi, pencarian |
| `src/web.html`, `src/web.css`, `src/webui.js`, `src/head-web.html` | **Versi website**: landing page khusus pengunjung, satu form masuk/daftar (peran dibaca dari akun), web app pengunjung (layout ala Google Maps), konsol pengelola |
| `src/icons.html` | Sprite ikon SVG + maskot Kobi, dipakai kedua versi |
| `build.mjs` | `node build.mjs` → versi HP `dist/jelajah-kbs.html`; `node build.mjs web` → versi website `dist/jelajah-kbs-web.html` (masing-masing ada `.local.html` yang bisa dibuka langsung di browser) |
| `assets/models/*.glb` | 25 model satwa low-poly hasil ekspor dari mesin procedural, skala meter nyata, sudah di-weld + quantize (total ±600 KB) |
| `tools/` | Skrip validasi tata letak, ekspor GLB, dan uji Playwright |

## Versi website (satu login, peran dari akun)

- **Alur:** landing page (hanya untuk pengunjung, tanpa bagian pengelola) → satu form masuk/daftar → akun pengunjung masuk ke web app, akun pengelola otomatis ke konsol. Deep link `#masuk`, `#daftar`, dan `#qr-<id>` (QR dibaca dulu, lalu diminta masuk, lalu peta langsung di posisi QR). `#pengelola` lama diarahkan ke form masuk.
- **Akun demo:** pengunjung `pengunjung@jelajah.id`, pengelola `admin@kbs.id`, kata sandi keduanya `jelajah1916` (keduanya tampil di kotak akun demo dengan tombol isi otomatis). Pendaftaran publik hanya membuat akun pengunjung, tersimpan di browser (kata sandi di-hash SHA-256). Akun pengelola dibuat oleh tim, tidak lewat form daftar.
- **Kenapa login dipakai:** pengunjung menyimpan favorit, rencana kunjungan, dan paspor satwa; pengelola mendapat konsol (ringkasan, peta & status, data lokasi, jadwal, pengumuman & riwayat).
- **Semua penyimpanan di prototype ini lokal per browser.** Di produksi: Supabase Auth (email/password, Google OAuth, magic link/OTP) + tabel `profiles` dengan kolom `role`, Row Level Security agar hanya pengelola destinasi yang bisa mengubah status/jadwal, dan Supabase Realtime supaya perubahan pengelola langsung sampai ke HP pengunjung.
- Angka akses QR dan kepuasan di konsol adalah **data demo** dan diberi label DEMO.

## Wireframe (Figma)

**Low-fi + wireframe (desktop & mobile web):** https://www.figma.com/design/apoX1hwNmaxzMWLokbfp65 — sudah disesuaikan dengan versi high fidelity.
- "Lo-fi · Pengunjung" (01–11) dan "Lo-fi · Pengelola" (12–16): kerangka kotak + bar abu-abu, label teks hanya di tombol, placeholder X untuk gambar/peta. Tiap layar punya badge bernomor + kartu "Catatan hierarchy" (tujuan, poin bernomor, struktur). Section "Desktop · 1280 px" dan "Mobile web · 390 px" (M01–M16, pola web: navbar + konten berurutan, catatan di kanan layar).
- "Wireframe · Pengunjung" dan "Wireframe · Pengelola": wireframe berteks grayscale (teks asli, ikon 24 px, placeholder X), desktop dan mobile web, diturunkan langsung dari tata letak hi-fi.
- Ikon wireframe ada di halaman "Komponen".

**Wireframe detail:** https://www.figma.com/design/5aY0r4ARAc2WvIBwdXWViJ — 16 layar yang sama dengan teks asli, catatan hierarchy lengkap, dan komponen di halaman "Komponen low-fi".

**High fidelity (tugas hi-fi, Week 7 DEPD):** https://www.figma.com/design/zWHNXlfYr0kbShNtfdg1lq — lengkap dengan warna, tipografi, gambar asli (render peta 3D + model satwa dari aplikasi), dan prototype yang bisa diklik.
- Halaman: Cover · 01 Arah Visual (kepribadian brand, moodboard, inspirasi UI) · 02 Fondasi (warna 60-30-10 + kontras WCAG, tipografi Figtree, grid & breakpoint, spacing ×8, ikon 24 px, gambar, motion) · 03 Komponen (atom → molekul → organisme, varian & state, token variabel) · 04 Desktop (D01–D16, 1280 px) · 05 Mobile Web (M01–M16, 390 px, tetap pola web: navbar + konten berurutan, bukan UI aplikasi).
- Prototype: alur siap presentasi di 04 Desktop dan 05 Mobile Web — "Pengunjung" (mulai dari Landing), "Peta (langsung)" (mulai dari Beranda peta), "Konsol pengelola". Transisi Smart Animate 300 ms, overlay QR dissolve 200 ms. Tekan Present (▶) lalu pilih alur di panel kiri.
- Sengaja dibuat berbeda dari situs resmi KBS (palet hijau hutan + oranye, maskot Kobi, layout sendiri).


## Online-kan ke domain

`npm run deploy` membuat `dist/deploy/` yang siap di-upload ke hosting statis. Sejak November 2026 deploy memakai VPS CloudPanel + GitHub Actions (SSH/rsync) dengan backend Supabase. Lihat `docs/DEPLOY.md` dan `docs/SUPABASE.md`.

## Arsitektur Flutter yang disarankan

```
QR di papan info ──► https://jelajah.id/kbs#qr-gerbang  (web dulu, tanpa instal)
                         │
           Flutter Web / Android / iOS (satu codebase)
   ┌──────────────────────────┬─────────────────────────────┐
   │ Shell Flutter (Riverpod, │ Peta 3D = HTML Three.js ini │
   │ go_router): search, sheet│ di webview_flutter / Flutter│
   │ Kobi, rute, jadwal, tiket│ Web HtmlElementView         │
   └────────────┬─────────────┴──────────────┬──────────────┘
                │  JS bridge (JSON)           │
         Supabase (Postgres + Auth + Storage) │  model_viewer_plus (GLB + AR)
                │                             │
         Edge function → LLM (Kobi) + data destinasi (RAG)
```

Kenapa QR → web dulu: target pengguna adalah pengunjung yang baru tiba. Membuka URL dari QR jauh lebih cepat daripada instal aplikasi. Tiap QR membawa ID lokasinya (`#qr-plaza`), jadi posisi pengunjung diketahui tanpa GPS. Prototype ini sudah mendukungnya: buka URL artifact dengan akhiran `#qr-plaza`.

Package utama: `webview_flutter` (atau `flutter_inappwebview`), `model_viewer_plus`, `mobile_scanner`, `app_links`, `flutter_riverpod`, `go_router`, `supabase_flutter`, `flutter_tts` (id-ID), `hive` (cache offline data destinasi).

### JS bridge (sudah ada di `ui.js`)

Flutter → peta:

```dart
final c = WebViewController()
  ..setJavaScriptMode(JavaScriptMode.unrestricted)
  ..addJavaScriptChannel('Jelajah', onMessageReceived: (m) {
      final e = jsonDecode(m.message); // {type: 'zone'|'poi'|'route', ...}
      ref.read(selectionProvider.notifier).state = e;
  })
  ..loadFlutterAsset('assets/web/map3d.html');

c.runJavaScript("jelajah.scanQR('qr-gerbang')");
c.runJavaScript("jelajah.selectZone('komodo')");
c.runJavaScript("jelajah.route('zone','aquanoctudio')");
c.runJavaScript("jelajah.plan(['anak','langka'], 120)");
c.runJavaScript("jelajah.setNight(true)");
c.runJavaScript("jelajah.setClosed('e','jembatan',true)");
```

Peta → Flutter: event `zone`, `poi`, `route` (dengan `meters`, `minutes`) dikirim lewat channel `Jelajah`.

Untuk build offline di aplikasi, bundel `three.module.js` + addons secara lokal dan ganti import map di `build.mjs`.

## Model data & koordinat

- Sistem koordinat: `x` timur(+)/barat(−), `z` selatan(+)/utara(−), 1 unit ≈ 5 m. Posisi mengikuti denah kasar papan peta KBS.
- **Wajib kalibrasi lapangan.** Ambil koordinat GPS dari minimal 3 titik (mis. Pintu Utama, Plaza Tengah, Pintu Selatan), lalu hitung transformasi affine `[lat,lng] ↔ [x,z]`. Setelah itu fitur "Posisi Anda" bisa memakai GPS sebagai pelengkap QR.
- Tabel Supabase yang disarankan: `destinations`, `zones`, `animals`, `pois`, `path_nodes`, `path_edges` (flag `stairs`, `closure_id`), `schedules`, `tickets`, `qr_points`, `status_changes` (riwayat perubahan), `verifications`, `events` (analitik scan QR untuk Key Metric 1), `surveys` (kepuasan, Key Metric 2).
- Field `verified` di data = lokasi cocok dengan denah/sumber publik. Di produksi, ini diisi pengelola lewat dasbor (Key Metric 4: % data terverifikasi).

## Aset 3D

- Semua satwa di peta dibangun procedural (kode), jadi ringan dan konsisten. `models/*.glb` adalah ekspor dari kode yang sama: siap dipakai di `model_viewer_plus` untuk tampilan 360° dan AR (Android Scene Viewer; iOS perlu USDZ, bisa dikonversi dengan Reality Converter / `usdzconvert`).
- Slot model AI: `GLB_SLOTS` di `scene.js`. Isi path GLB untuk mengganti model procedural.
- Saat mencoba Higgsfield, saldo akun 0 kredit. Biaya per model ±38,5 kredit (gambar konsep `gpt_image_2_5` 0,5 + `meshy_v7_image_to_3d` lowpoly bertekstur 38). Prompt gambar konsep yang disarankan:
  > Cute low-poly 3D toy figurine of a [Komodo dragon], full body, 3/4 side view, flat-shaded facets, warm soft studio light, plain white background, single object, diorama miniature style, matte colors
  Lalu image-to-3D: `model_type: lowpoly`, `should_texture: true`, `target_polycount: 4000–8000`. Optimasi: `gltf-transform weld` → `quantize` → `meshopt` (opsional) dan tekstur ≤1024 px WebP.

## Kobi (pemandu AI)

- Di prototype: memakai Claude lewat kapabilitas artifact (`sample`, tier cepat) bila diizinkan penonton. Jika tidak, Kobi memakai mesin jawaban lokal dari data (toilet/mushola/kuliner terdekat, satwa, tiket, jadwal, rencana rute).
- Aturan prompt ada di `KOBI_RULES` (`ui.js`): jawab hanya dari DATA, ringkas, dan akhiri dengan baris aksi `AKSI: lihat=<id>; rute=<id>` yang diubah aplikasi menjadi tombol "Lihat di peta" dan "Rute".
- Produksi: edge function Supabase → LLM, konteks = data destinasi + jarak dari posisi pengunjung. Hemat biaya API (anggaran Rp500.000/bln): cache jawaban umum, tier model cepat, batasi panjang jawaban.

## Checklist verifikasi lapangan

Data berikut belum pasti dari sumber publik dan harus dicek langsung ke KBS:

1. Posisi pintu setelah renovasi plaza depan 2026 (pintu masuk/keluar disatukan, pos polisi dipindah).
2. Status Aviary walk-through (sempat tutup Agustus 2024) dan akses naik Menara Pandang.
3. Harga perahu, kolam renang anak, go-kart, Kereta Safari, Rainbow Park, Bioskop 7D.
4. Jadwal feeding resmi (data publik terakhir 2017) dan jadwal Animal Edutainment / Talk With Us.
5. Lokasi toilet, mushola, P3K, ruang laktasi, ATM, loker, peminjaman kursi roda (di prototype bersifat ilustratif).
6. Lokasi pajang kura-kura Aldabra (tiba Juli 2026) dan status satwa titipan Jepang (panda merah, jerapah).
7. Status operasional Surabaya Night Zoo 2026.

## Sumber utama riset (Okt 2026)

- surabayazoo.co.id (sejarah, kontak, peta Google My Maps)
- Wikipedia: Surabaya Zoo / Kebun Binatang Surabaya
- detik.com (tiket 2025, penghentian tunggang gajah Nov 2025, go-kart)
- metrotvnews.com (tiket Rp15.000 non-tunai Apr 2026, paket A–E, tarif wahana Nov 2025)
- jatim.antaranews.com (GIZ Park, parkir non-tunai Apr 2026, penataan plaza 2026, Aldabra)
- suarasurabaya.net (Perumda 2026, terowongan TIJ, komodo ke Jepang, kelahiran singa 2023)
- The Jakarta Post (koleksi 211 spesies / 2.236+ satwa, Mei 2026)
- ZooChat (deskripsi kandang per zona, kunjungan Agustus 2024)
