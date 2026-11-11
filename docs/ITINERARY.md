# Itinerary otomatis · cara kerja algoritma

Kobi dan menu **Rencana** menyusun urutan kunjungan berdasarkan beberapa pertanyaan: siapa yang ikut (balita, anak, remaja, dewasa, lansia), pakai kursi roda/stroller atau tidak, berapa lama, satwa apa yang ingin dilihat, dan kegiatan lain (wahana, pertunjukan, foto). Kode ada di `src/planner.js`, datanya di `src/data.js` → `planning`.

## Masalah apa ini?

Pengunjung tidak mungkin mendatangi semua 23 zona dalam 2 jam. Jadi pertanyaannya: **zona mana yang dipilih dan dalam urutan apa**, supaya kepuasan (sesuai minat rombongan) paling besar tetapi tetap muat dalam waktu yang tersedia.

Dalam riset operasi ini dikenal sebagai **Orienteering Problem with Time Windows (OPTW)**, varian yang dipakai untuk wisata disebut *Tourist Trip Design Problem*:

- tiap zona punya **nilai** (seberapa cocok dengan rombongan) dan **lama kunjungan**,
- perpindahan antarzona butuh **waktu jalan kaki**,
- sebagian zona punya **jendela waktu** (jadwal feeding/pertunjukan),
- total waktu (jalan + kunjungan + istirahat + ke pintu keluar) **tidak boleh melebihi** durasi yang dipilih dan jam tutup 16.00.

## Kenapa algoritma ini

| Pilihan | Cocok? | Alasan |
|---|---|---|
| Dijkstra / A* saja | Sebagian | Hanya mencari jalur terpendek dua titik. **Tetap dipakai** untuk menghitung waktu jalan antarzona (menghormati jalur ditutup & mode tanpa tangga). |
| TSP (travelling salesman) | Tidak | Wajib mendatangi *semua* titik. Di sini justru harus memilih sebagian. |
| Greedy (versi lama) | Kurang | Cepat, tapi sering terjebak urutan yang boros jalan kaki dan tidak bisa memperbaiki diri. |
| Algoritma genetika / ant colony | Berlebihan | Bisa, tapi lebih lambat, hasil acak tiap dijalankan, dan parameternya sulit dijelaskan. Ukuran masalah kita kecil (±25 zona). |
| Integer Linear Programming (solver eksak) | Berlebihan | Optimal, tapi butuh solver di server dan lambat bila aturan bertambah. |
| LLM (AI) langsung menyusun rute | Tidak | AI bisa "mengarang" jarak/waktu dan tidak menjamin rencana muat waktu. |
| **ILS untuk OPTW** ✅ | **Dipilih** | Standar di literatur untuk itinerary wisata (Vansteenwegen dkk. 2009). Hasilnya mendekati optimal, selesai dalam hitungan milidetik (±50 ms di laptop), **deterministik** (input sama → hasil sama), dan mudah dijelaskan. |

**Peran AI:** di mode online, AI (Gemini/Claude lewat edge function) hanya membantu **memahami kalimat bebas** pengunjung menjadi preferensi terstruktur, misalnya "ajak eyang yang pakai tongkat" → `lansia`, `kursi_roda`. Urutan rute selalu dihitung algoritma. Tanpa AI, pemahaman kalimat memakai aturan kata kunci (`planExtract`).

## Alur

```
pertanyaan / kalimat ──► preferensi ──► saring & beri skor zona ──► waktu tempuh (Dijkstra)
                                           │ aturan usia, akses, tangga
                                           ▼
                         Iterated Local Search (sisip serakah + 2-opt + guncang)
                                           │ jendela waktu jadwal, istirahat, jam tutup
                                           ▼
                     itinerary + alasan per zona + daftar "tidak dimasukkan" + garis rute di peta
```

1. **Saring (aturan keras).** Zona dikeluarkan bila: ditutup pengelola; tidak ramah kursi roda/stroller (`access:false`); banyak tangga untuk rombongan dengan lansia (`effort:2`); wahana dengan syarat usia (`ride`) padahal tidak ada anggota rombongan di rentang itu; atau tidak terjangkau tanpa jembatan bertangga. Alasannya ditampilkan ke pengguna.
2. **Skor (aturan lunak).**

   | Faktor | Pengaruh |
   |---|---|
   | dasar | +1, satwa unggulan +1,5 |
   | kategori satwa yang dipilih | +4 (balita tanpa pilihan: satwa interaktif +2) |
   | satwa langka (bila dipilih) | +2 |
   | kegiatan dipilih: wahana / pertunjukan / foto | +3 / +2 / +1,5 |
   | ada anak/balita × daya tarik anak (`kids` 0–2) | +1,8 per poin |
   | zona khusus anak (`ages`) | +3 bila cocok, ×0,3 bila rombongan tanpa anak |
   | lansia & zona naik-turun (`effort:1`) | −1 |
   | status buka perlu dicek | −2 |
   | dipilih wajib (`must`) | +15 |
   | tiba saat feeding/pertunjukan | +1,5 (atau +4 bila memilih pertunjukan; boleh menunggu ≤ 20 menit) |
   | zona teduh siang hari (11.00–14.00) untuk lansia/balita | +1 |

3. **Waktu.** Kecepatan jalan dewasa ±66 m/menit; rombongan mengikuti anggota paling lambat (balita ×0,75, lansia ×0,7). Tempo santai/cepat mengubah kecepatan dan lama kunjungan. Anak di wahana +30% waktu.
4. **Istirahat.** 15 menit setiap 60 menit aktivitas untuk balita/lansia, 90 menit untuk anak, 150 menit untuk dewasa, di tempat makan terdekat (toilet terdekat ikut ditampilkan).
5. **Iterated Local Search.**
   - *Sisip serakah:* coba setiap zona di setiap posisi, pilih rasio (tambahan skor)² / tambahan waktu terbesar yang masih muat. Ulangi sampai tidak ada yang muat.
   - *2-opt:* balik potongan urutan bila membuat jalan kaki lebih pendek, supaya ada waktu untuk zona lain.
   - *Guncang:* buang R zona berurutan mulai posisi S, lalu sisip ulang. Simpan solusi terbaik; maksimal 120 iterasi atau 30 iterasi tanpa perbaikan.

## Pertanyaan Kobi

Kobi hanya menanyakan yang belum disebut. Contoh "rute 2 jam bawa anak" langsung melewati pertanyaan rombongan dan durasi.

1. Siapa saja yang ikut? (dewasa saja · balita · anak · lansia · kursi roda/stroller)
2. Berapa lama? (1–4 jam · sampai tutup)
3. Satwa apa yang paling ingin dilihat? (harimau & singa · primata · burung · komodo & reptil · gajah & savana · akuarium · langka · semua)
4. Kegiatan lain? (wahana · pertunjukan & feeding · foto · satwa saja). Hanya ditanyakan bila ada anak/remaja atau rombongan belum jelas.

Setelah itinerary jadi: "Lebih santai", "Tambah 1 jam", "Kurangi 1 jam", "Ulang dari awal".

## Data yang WAJIB diverifikasi

Batas usia wahana, tingkat kelelahan, dan akses kursi roda di `planning.zones` masih **asumsi tim**, contohnya:

| Zona | Asumsi |
|---|---|
| Tunggang Unta | penumpang 3–12 th |
| Go-Kart | 6–15 th |
| Kolam Renang Anak | 2–12 th |
| Playland Rumah Jamur | 3–12 th |
| GIZ Park | 3–15 th |
| Perosotan Rainbow | 3 th ke atas |
| Menara Pandang | banyak tangga (tidak untuk lansia/kursi roda) |
| Perahu | tidak ramah kursi roda |

Cek ke pengelola KBS lalu perbarui `src/data.js` (mode demo) dan kolom `zones.plan` di Supabase (mode online, bisa lewat Table Editor tanpa deploy ulang).

## Mengubah perilaku

- Bobot skor: `planScoreZone()` di `src/planner.js`.
- Kecepatan, jeda istirahat, kelompok usia, kategori: `DATA.planning` di `src/data.js`.
- Pertanyaan & pilihan cepat Kobi: `PLAN_Q`; kata kunci pemahaman kalimat: `PLAN_NLU` dan `planExtract()`.
- Uji: `node tests/planner.test.mjs` (33 kasus: aturan usia, lansia, kursi roda, jendela waktu, determinisme, dialog Kobi).

## Referensi

- P. Vansteenwegen, W. Souffriau, G. Vanden Berghe, D. Van Oudheusden (2009). *Iterated local search for the team orienteering problem with time windows.* Computers & Operations Research 36(12).
- D. Gavalas, C. Konstantopoulos, K. Mastakas, G. Pantziou (2014). *A survey on algorithmic approaches for solving tourist trip design problems.* Journal of Heuristics 20(3).
