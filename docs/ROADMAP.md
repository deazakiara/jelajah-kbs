# Dari prototype ke web app yang layak produksi

Catatan jujur tentang apa yang masih kurang di paket Jelajah KBS, diurutkan dari yang paling mendesak. ✅ = sudah dikerjakan di versi ini.

## Sudah dibereskan di versi ini

- ✅ **Backend sungguhan (Supabase).** Sebelumnya akun, status zona, pengumuman, dan jadwal hanya tersimpan di browser masing-masing. Akibatnya admin menutup jalur, tapi pengunjung lain tidak melihatnya. Sekarang: Supabase Auth, Postgres dengan RLS, perubahan pengelola tampil realtime di semua HP.
- ✅ **Kata sandi tidak lagi di-hash di browser**, dan akun demo tidak lagi tertanam di kode sebagai satu-satunya cara login.
- ✅ **Dasbor pakai data nyata**: pindaian QR dan survei kepuasan tercatat di database, tidak lagi angka DEMO.
- ✅ **Kobi AI lewat server**: API key aman di edge function, ada kuota harian per akun, dan otomatis kembali ke jawaban lokal bila AI tidak tersedia.
- ✅ **Itinerary otomatis** sesuai rombongan (balita, anak, lansia, kursi roda), durasi, satwa favorit, dan jadwal feeding, lewat formulir maupun obrolan Kobi. Lihat `ITINERARY.md`. Batas usia wahana masih perlu diverifikasi pengelola.
- ✅ **Deploy otomatis** (GitHub Actions → CloudPanel) dan **uji asap otomatis** di setiap pull request.
- ✅ **Aset 3D dan sumber masuk repo** (sebelumnya model ada di `dist/` yang diabaikan git, sehingga build di mesin lain gagal).

## P0 · Wajib sebelum dibuka untuk umum

1. **Data lapangan.** Koordinat zona masih dari denah kasar; harga wahana dan jadwal feeding sebagian dari sumber 2017. Perlu survei bersama pengelola KBS (minimal 3 titik GPS untuk kalibrasi) dan verifikasi tiap titik lewat menu *Data lokasi*.
2. **Email & akun.** Pasang SMTP sendiri (email bawaan Supabase sangat dibatasi), buat halaman reset kata sandi yang proper (sekarang memakai jendela `prompt`), dan ganti password akun demo.
3. **Kebijakan privasi & syarat penggunaan.** Form daftar meminta persetujuan, tapi halamannya belum ada. Karena menyimpan email dan riwayat lokasi (QR), ini terkait UU PDP. Tentukan juga berapa lama `qr_scans` disimpan.
4. **Kelola konten dari konsol.** Pengelola baru bisa buka-tutup, verifikasi, jadwal, dan pengumuman. Mengubah nama/harga/deskripsi zona, menambah satwa, atau memindah titik QR masih harus lewat Supabase Table Editor. Zona baru belum bisa muncul di peta 3D karena bentuk dunia masih ditulis di `src/data.js`.
5. **Monitoring & cadangan.** Belum ada pelacak error (mis. Sentry), uptime monitor, atau backup terjadwal. Paket gratis Supabase tidak menyertakan backup harian dan bisa dijeda.
6. **Keamanan header.** Tambahkan Content-Security-Policy dan HSTS di Nginx setelah HTTPS stabil.

## P1 · Kualitas aplikasi

7. **Struktur kode.** Semua kode digabung jadi satu `index.html` ±330 KB tanpa bundler, minify, atau tipe. Pindah ke **Vite + ES modules (+ TypeScript)**: file terpisah per fitur, minify, nama file ber-hash untuk cache, dan hot reload saat develop.
8. **Dua basis kode UI.** `hp/` (prototype aplikasi HP, `ui.js`) dan versi web (`webui.js`) menduplikasi banyak logika. Versi web sudah responsif, jadi `hp/` sebaiknya dipensiunkan atau dijadikan shell aplikasi Flutter saja.
9. **Performa di HP murah.** Peta 3D berat di GPU lemah. Perlu deteksi kemampuan perangkat (turunkan resolusi/bayangan), muat model GLB hanya saat dibuka, ukur dengan Lighthouse, dan **self-host font** (sekarang dari Google Fonts).
10. **PWA & offline.** Sinyal di dalam kebun binatang sering lemah. Tambahkan manifest + service worker supaya peta, data, dan jawaban lokal Kobi tetap jalan offline, dan aplikasi bisa di-"instal" ke layar utama.
11. **Aksesibilitas.** Peta 3D tidak bisa dibaca screen reader. Perlu tampilan daftar sebagai alternatif, navigasi keyboard di peta, dan audit kontras (WCAG AA).
12. **Bahasa Inggris.** Video demo sudah ada versi EN, tetapi UI masih Bahasa Indonesia saja. Wisatawan asing butuh i18n.
13. **Tes.** Baru ada uji asap end-to-end. Tambahkan unit test untuk routing (Dijkstra), perencana kunjungan, dan parser Kobi, serta tes RLS database.
14. **QR palsu.** Siapa pun bisa membuka `#qr-gerbang` tanpa berada di sana, jadi angka akses QR bisa digelembungkan. Untuk metrik yang dipercaya: QR bertanda tangan (ID + token), batasi pencatatan per sesi.

## P2 · Menjadi produk (sesuai model bisnis)

15. **Multi-destinasi (SaaS).** Skema sudah punya `destination_id`, tapi belum ada onboarding destinasi baru, editor peta, domain per destinasi, dan pengaturan paket Basic/Standard/Premium.
16. **Penagihan.** Langganan bulanan (Midtrans/Xendit), batas titik per paket ditegakkan di database.
17. **Kobi lebih pintar.** Ambil data langsung dari database (RAG), cache jawaban umum, moderasi, dan catat pertanyaan yang tidak terjawab untuk perbaikan data.
18. **Notifikasi.** Pengingat jadwal sekarang hanya di memori tab. Bisa diganti Web Push atau notifikasi aplikasi Flutter.
19. **Analitik lanjutan.** Rute terpopuler, waktu kunjungan, zona yang sering dicari, dengan persetujuan pengguna.
