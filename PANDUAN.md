# Panduan Samphone Intelligence

## 1. Menjalankan
1. `npm install` (sekali saja), lalu `npm run dev`.
2. Buka alamat yang muncul (biasanya http://localhost:5173).
3. Tanpa Supabase: klik **Lanjutkan ke mode demo** (data contoh, tersimpan di browser, bukan data pasar).
4. Dengan Supabase: lihat README, bagian "Menjalankan lokal".

## 2. Alur kerja harian
1. **Kumpulkan iklan.** Lihat iklan iPhone di Facebook Marketplace, lalu catat lewat **Tambah Iklan** (manual) atau **Asisten ChatGPT** (salin prompt, tempel hasil JSON).
2. **Cek data.** Pastikan model, penyimpanan, wilayah (iBox/Internasional), harga, dan baterai terisi benar.
3. **Analisis pasar.** Menu **Analisis Pasar**: lihat median dan sebaran harga per model.
4. **Beli.** Menu **Peluang Beli** menunjukkan iklan yang harganya di bawah batas beli Anda.
5. **Jual.** Menu **Harga Jual**: tentukan harga pasang unit yang Anda pegang.
6. **Catat hasil.** Saat unit laku, isi **harga jual aktual** di iklan itu. Semakin banyak, semakin akurat angka tawar.

## 3. Menu Harga Jual
1. Pilih model, penyimpanan, wilayah, dan kunci operator unit Anda.
2. Isi baterai (opsional), harga beli, laba minimum, biaya, dan perkiraan tawar.
3. Baca tiga kartu harga: **Cepat laku** (kuartil bawah), **Harga pasar** (median), **Ambisius** (kuartil atas). Tiap kartu menampilkan harga pasang, perkiraan harga laku setelah tawar, dan laba bersih.
4. Baca **Saran** dan **Batas bawah**. Jangan menerima tawaran di bawah harga laku minimum.
5. Lihat tabel baterai, kecepatan laku, dan tren bulanan.
6. Isi **Teks iklan**, centang hanya yang sudah Anda cek, lalu salin ke Marketplace.

## 4. Aturan praktis
- Sampel kurang dari 3 iklan: belum ada hasil. 3–4: awal. 5–9: sedang. 10+: lebih kuat.
- Harga yang dipakai adalah harga **iklan**, bukan harga transaksi. Karena itu ada faktor tawar.
- Pasang di harga pasar, lalu turunkan bertahap bila 1–2 minggu belum ada tawaran serius. Jangan melewati batas bawah.
- Sebelum membeli, selalu cek IMEI, iCloud, dan kunci operator sendiri.

## 5. Menyambungkan ke Supabase dan akses lewat HP

### A. Supabase
1. Daftar di supabase.com, buat **New project** (catat password database, pilih region terdekat, mis. Singapore).
2. **SQL Editor** > New query > tempel seluruh isi `supabase/migrations/001_samphone_intelligence.sql` > **Run**.
3. **Settings > API Keys**: salin **Project URL** dan **Publishable key** (`sb_publishable_...`). Jika belum ada, klik **Create new API keys**. Jangan pernah memakai secret key / service_role di aplikasi.
4. Salin `.env.example` menjadi `.env.local`, isi:
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
5. **Authentication > Providers**: pastikan Email aktif. Mulai ulang `npm run dev`, klik daftar di aplikasi, lalu login.
6. Setelah akun Anda dibuat, matikan pendaftaran baru: Authentication > Sign In / Providers > matikan "Allow new users to sign up".

### B. Akses lewat HP
- Satu Wi-Fi saja: `npm run dev -- --host`, buka alamat Network yang tampil di HP.
- Dari mana saja: `npm run build`, unggah folder `dist` ke Cloudflare Pages atau Netlify (isi environment variable yang sama di pengaturan hosting, lalu build ulang). Berkas `public/_redirects` dan `vercel.json` sudah menangani alamat halaman.
- Daftarkan alamat situs di Supabase: Authentication > URL Configuration (Site URL dan Redirect URLs).
- Di HP: buka situs, lalu "Tambahkan ke layar utama".
