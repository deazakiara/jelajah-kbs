# Deploy Jelajah KBS ke CloudPanel (Domainesia) dengan GitHub Actions

Alurnya: kamu `git push` ke GitHub → GitHub Actions membangun website (`node deploy.mjs`) → hasilnya dikirim ke server CloudPanel lewat SSH (rsync). Backend (database, login, Kobi) ada di Supabase, jadi server CloudPanel cukup melayani file statis.

```
laptop ──git push──► GitHub ──Actions: build + rsync (SSH)──► VPS CloudPanel (Nginx) ──► https://chelsea.cloudcomp.my.id
                         └──Actions: db push + functions deploy──► Supabase (Auth, Postgres, Realtime, Edge Function)
```

Ganti `chelsea.cloudcomp.my.id` dengan domainmu kalau berbeda.

---

## 1. Arahkan domain ke server (Domainesia)

1. Catat **IP publik VPS** tempat CloudPanel terpasang.
2. Login member area Domainesia → **Domain** → pilih `cloudcomp.my.id` → **DNS Management / Kelola DNS**.
3. Tambah record:

   | Type | Name | Value | TTL |
   |---|---|---|---|
   | A | `chelsea` | IP VPS | 3600 |

   Hapus dulu record lama bernama `chelsea` (A/AAAA/CNAME) kalau ada.
4. Cek dari laptop: `nslookup chelsea.cloudcomp.my.id` harus menunjuk ke IP VPS. Penyebaran DNS bisa beberapa menit sampai beberapa jam.

> Kalau nameserver `cloudcomp.my.id` tidak di Domainesia (misalnya di Cloudflare), buat record A di panel DNS tersebut.

## 2. Buat situs di CloudPanel

1. Buka CloudPanel (`https://IP-VPS:8443`) → **Sites** → **+ Add Site** → **Create a Static HTML Site**.
2. **Domain Name**: `chelsea.cloudcomp.my.id`. Isi **Site User** (misalnya `jelajah`) dan password, lalu **Create**.
3. Buka situsnya → tab **Settings**, catat **Root Directory**. Biasanya `/home/jelajah/htdocs/chelsea.cloudcomp.my.id`. Ini nanti jadi `DEPLOY_PATH`.
4. Tab **SSL/TLS** → **Actions** → **New Let's Encrypt Certificate** → **Create and Install** (DNS dari langkah 1 harus sudah aktif).

### Pengaturan Nginx (tab **Vhost**)

Tambahkan blok berikut di dalam `server { ... }` untuk port 443, di atas blok `location` bawaan yang lain:

```nginx
# file 3D satwa
location ~* \.glb$ {
  types { model/gltf-binary glb; }
  add_header Cache-Control "public, max-age=604800";
}
# library pihak ketiga tidak pernah berubah namanya
location /vendor/ {
  add_header Cache-Control "public, max-age=31536000, immutable";
}
# konfigurasi Supabase harus selalu terbaru
location = /config.js {
  add_header Cache-Control "no-cache";
}
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

Simpan. Pastikan juga akses `http://` dialihkan ke `https://` (template CloudPanel biasanya sudah punya baris redirect di blok port 80).

## 3. Kunci SSH khusus GitHub Actions

Di laptop (Git Bash / terminal):

```bash
ssh-keygen -t ed25519 -C "github-actions-jelajah" -f jelajah_deploy -N ""
```

Hasilnya dua file:

- `jelajah_deploy.pub` → **kunci publik**. Di CloudPanel buka situs → tab **SSH/FTP** → bagian SSH Keys milik site user → tempel isinya → simpan.
- `jelajah_deploy` → **kunci privat**. Nanti ditempel ke GitHub Secret `SSH_PRIVATE_KEY`. Jangan dikirim ke siapa pun dan jangan di-commit.

Uji dari laptop:

```bash
ssh -i jelajah_deploy jelajah@IP-VPS "ls ~/htdocs"
ssh-keyscan -p 22 IP-VPS        # salin hasilnya untuk secret SSH_KNOWN_HOSTS
```

> Pastikan `rsync` ada di server (`rsync --version`). Kalau belum ada, minta admin server menjalankan `apt install rsync`. Port SSH (22) juga harus dibuka di **CloudPanel → Security → Firewall**.

## 4. Repository GitHub

1. Buat repository baru (private boleh), lalu dari folder proyek:

   ```bash
   git init
   git add .
   git commit -m "Jelajah KBS"
   git branch -M main
   git remote add origin https://github.com/USERNAME/jelajah-kbs.git
   git push -u origin main
   ```

2. **Settings → Secrets and variables → Actions**:

   **Secrets** (rahasia)

   | Nama | Isi |
   |---|---|
   | `SSH_HOST` | IP VPS (atau hostname server) |
   | `SSH_USER` | site user CloudPanel, misalnya `jelajah` |
   | `SSH_PRIVATE_KEY` | seluruh isi file `jelajah_deploy` |
   | `DEPLOY_PATH` | Root Directory dari langkah 2, misalnya `/home/jelajah/htdocs/chelsea.cloudcomp.my.id` |
   | `SSH_KNOWN_HOSTS` | hasil `ssh-keyscan` (disarankan) |
   | `SSH_PORT` | hanya kalau SSH bukan port 22 |
   | `SUPABASE_ACCESS_TOKEN` | token dari supabase.com → Account → Access Tokens |
   | `SUPABASE_DB_PASSWORD` | password database project Supabase |
   | `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` | opsional, untuk Kobi AI (lihat `SUPABASE.md`) |

   **Variables** (bukan rahasia)

   | Nama | Isi |
   |---|---|
   | `SITE_URL` | `https://chelsea.cloudcomp.my.id` |
   | `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
   | `SUPABASE_ANON_KEY` | anon / publishable key project |
   | `SUPABASE_PROJECT_REF` | `<project-ref>` |

3. Tab **Actions** → jalankan **Supabase** lalu **Deploy website** (tombol *Run workflow*). Selanjutnya keduanya jalan otomatis setiap push ke `main`.

## 5. Workflow yang tersedia

| File | Kapan jalan | Fungsi |
|---|---|---|
| `deploy-web.yml` | push ke `main` yang mengubah `src/`, `assets/`, dll. | build `dist/deploy` dengan konfigurasi Supabase, rsync ke CloudPanel, cek `config.js` |
| `supabase.yml` | push ke `main` yang mengubah `supabase/` | `supabase db push` (migrasi) + deploy edge function `kobi` + set secret Kobi |
| `test.yml` | setiap pull request | build lalu uji asap di Chromium (mode demo + mock Supabase) |
| `keepalive.yml` | tiap 3 hari | ping Supabase supaya project gratis tidak dijeda |

## 6. Cek setelah online

- [ ] `https://chelsea.cloudcomp.my.id` terbuka dengan gembok HTTPS.
- [ ] `https://chelsea.cloudcomp.my.id/config.js` berisi `supabaseUrl` yang benar (bukan kosong).
- [ ] Daftar akun baru berhasil, lalu masuk dari browser lain: favorit dan rencana tetap ada.
- [ ] Login pengelola → tutup satu wahana → di HP lain (pengunjung) pin langsung berubah dan banner info muncul tanpa refresh.
- [ ] Buka `https://chelsea.cloudcomp.my.id/#qr-plaza` → angka **Akses via QR** di dasbor pengelola bertambah.
- [ ] Tanya Kobi. Label di kepala chat berubah jadi "AI aktif" bila API key sudah dipasang; tanpa key, Kobi tetap menjawab dari data lokal.

## Update sehari-hari

1. Edit file di `src/` (atau `supabase/` untuk database).
2. Coba lokal: `npm run deploy` lalu `npm run preview` → buka `http://localhost:8080`.
3. `git commit` + `git push`. Deploy berjalan otomatis; pantau di tab **Actions**.

Rollback: buka commit lama di GitHub → **Revert**, atau jalankan ulang workflow *Deploy website* dari run sebelumnya.

## Alternatif tanpa GitHub Actions

Jalankan `npm run deploy` di laptop, lalu kirim manual:

```bash
rsync -avz --delete --exclude '.well-known/' -e "ssh -i jelajah_deploy" dist/deploy/ jelajah@IP-VPS:/home/jelajah/htdocs/chelsea.cloudcomp.my.id/
```

Folder `dist/deploy` juga tetap bisa di-upload lewat File Manager CloudPanel atau hosting cPanel (`.htaccess` sudah disertakan untuk Apache).
