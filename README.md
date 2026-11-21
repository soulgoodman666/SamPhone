# Samphone Intelligence

Aplikasi web privat untuk mencatat iklan iPhone bekas, membandingkan harga penawaran yang dikumpulkan, dan menghitung batas harga beli untuk usaha pribadi di Jawa Timur.

## Fitur

- Dasbor ringkasan, tren jumlah iklan, statistik model/kota.
- Pencatatan, pencarian, filter, edit, status, riwayat harga, serta lampiran gambar iklan.
- Alur ChatGPT manual: buat dan salin prompt, gunakan ChatGPT sendiri, validasi JSON, tinjau/edit, lalu simpan. Aplikasi **tidak** menghubungi ChatGPT/API AI dan tidak mengakses Facebook secara otomatis.
- Analisis harga penawaran dengan median, kuartil, jumlah pembanding, rentang tanggal pengumpulan, dan filter pencilan IQR opsional.
- Peluang beli dengan pemisahan unit iBox/internasional, kapasitas, kelompok kunci operator, risiko perangkat, dan batas harga beli.
- Halaman Harga Jual: tiga harga pasang (cepat laku, pasar, ambisius), perkiraan harga laku setelah tawar, batas bawah, pengaruh baterai, tren bulanan, perkiraan kecepatan laku, dan pembuat teks iklan. Lihat PANDUAN.md.
- Kalkulator laba; harga penawaran penjual, harga beli, serta harga transaksi aktual adalah nilai terpisah.
- Impor JSON/CSV dengan validasi dan laporan baris; ekspor JSON/CSV.
- Mode demo berlabel jelas dengan contoh sintetis yang bukan data pasar aktual.

## Teknologi

React 19, Vite, Tailwind CSS 4, React Router, Supabase JS, Supabase PostgreSQL/Auth/Storage, Recharts, React Hook Form, Zod, date-fns, dan Lucide React.

## Persyaratan

- Node.js yang sesuai dengan Vite 8 (Node.js 20.19+ atau 22.12+).
- Akun/proyek Supabase hanya jika ingin penyimpanan cloud dan autentikasi.

## Menjalankan lokal

1. Jalankan `npm install`.
2. Untuk uji tampilan tanpa Supabase, jalankan `npm run dev`, buka URL lokal Vite, lalu pilih **Lanjutkan ke mode demo**. Data demo disimpan di localStorage browser dan bukan data pasar.
3. Untuk penyimpanan cloud, salin `.env.example` sebagai `.env.local` dan isi `VITE_SUPABASE_URL` serta `VITE_SUPABASE_ANON_KEY` dari proyek Anda. Gunakan anon/public key saja; jangan pernah menaruh service role key di frontend.
4. Di Supabase SQL Editor, jalankan seluruh `supabase/migrations/001_samphone_intelligence.sql`.
5. Aktifkan provider Email di Supabase Authentication. Buat akun pemilik lewat halaman pendaftaran aplikasi atau undang akun melalui Supabase. Sesuaikan pengaturan konfirmasi email sesuai kebijakan akun Anda.
6. Mulai ulang Vite setelah variabel environment berubah, lalu masuk dengan akun Supabase.

Aplikasi hanya dianggap telah tersambung setelah login dan operasi data berhasil. Kredensial atau proyek Supabase tidak disediakan bersama source ini, sehingga status itu perlu diverifikasi oleh pemilik.

## Database dan keamanan

Migrasi membuat tabel `profiles`, `listings`, `listing_specs`, `listing_images`, `price_history`, dan `market_snapshots`, mengaktifkan RLS, dan membuat bucket `listing-images` privat dengan kebijakan folder per user. Jalankan migrasi melalui Supabase SQL Editor sebelum menggunakan database. Jangan menonaktifkan RLS. Semua query browser menggunakan anon key dan dibatasi oleh RLS; service role key tidak boleh berada di aplikasi atau repository.

Facebook URL disimpan sebagai referensi. Tidak ada scraping, login otomatis, CAPTCHA bypass, atau pengambilan cookie. Hilangnya akses ke URL tidak mengubah status listing menjadi terjual.

## Perhitungan

- Analisis pasar menggunakan harga penawaran aktif/negosiasi yang memiliki model, kapasitas, dan wilayah yang sama. Median adalah acuan utama; hasil bukan harga transaksi terkonfirmasi.
- Sampel kurang dari 3 ditandai tidak cukup; 3–4 perkiraan awal; 5–9 sedang; 10+ dasar pembanding lebih kuat. Label ini indikator internal, bukan interval kepercayaan tervalidasi.
- Unit iBox dan internasional, model berbeda termasuk varian Max, kapasitas berbeda, dan kategori kunci berbeda tidak dicampur.
- Maksimum beli = estimasi harga jual − target laba − cadangan risiko − biaya operasional.
- Laba bersih = estimasi harga jual − harga beli negosiasi − cadangan perbaikan/risiko − biaya operasional.

## Build dan test

- `npm run build` membuat build produksi di `dist/`.
- `npm test` menjalankan pengujian fungsi statistik, pembanding, risiko, harga, dan validasi JSON.
- `npm run preview` menjalankan pratinjau build.

## Deployment

Bangun aplikasi dengan `npm run build`, lalu deploy folder `dist/` ke host static yang mendukung single-page app fallback (semua rute diarahkan ke `index.html`). Setel `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` sebagai environment build di platform hosting, kemudian build ulang. Tambahkan URL deployment ke Supabase Authentication > URL Configuration (Site URL dan redirect URLs) dan batasi domain yang diperbolehkan. Pastikan migrasi telah dijalankan dan verifikasi pendaftaran/login, operasi CRUD, upload gambar privat, serta logout di deployment.

## Batasan dan langkah manual

- Pemilik harus mengisi kredensial proyek Supabase, menjalankan migrasi, mengaktifkan email auth, dan menguji akun sendiri.
- Asisten AI memerlukan salin-tempel manual. Gambar untuk ChatGPT harus dilampirkan sendiri di ChatGPT; aplikasi tidak mengirimnya.
- Harga dan spesifikasi berasal dari data yang dikumpulkan/dimasukkan pengguna. Jangan perlakukan klaim penjual sebagai verifikasi perangkat.
