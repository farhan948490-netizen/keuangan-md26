# KasKita — MD 2026

Aplikasi kas kelas Manajemen Dakwah 2026, UIN Sunan Kalijaga Yogyakarta.

## Isi proyek

- React + TypeScript + Vite
- Supabase Auth dan PostgreSQL
- Hak akses Admin, Bendahara, Anggota
- Dashboard saldo dari seluruh transaksi yang diambil aplikasi
- Data anggota
- Pengajuan pembayaran dan unggah bukti privat
- Verifikasi pembayaran oleh Admin/Bendahara
- Pencatatan pemasukan/pengeluaran
- Grafik arus kas
- Cetak laporan melalui dialog browser (Save as PDF)

## 1. Buat project Supabase

1. Buat project di https://supabase.com/
2. Buka **SQL Editor**.
3. Salin dan jalankan seluruh isi `supabase/schema.sql`.
4. Buka **Project Settings > API** (atau Connect) dan salin Project URL serta publishable/anon key.
5. Jangan pernah menggunakan `service_role` key di frontend.

## 2. Buat akun Admin pertama

1. Jalankan aplikasi dan daftar akun menggunakan email Admin yang kamu kendalikan.
2. Verifikasi email jika diminta.
3. Buka Supabase **SQL Editor** dan jalankan perintah berikut, ganti email sesuai akun Admin:

   ```sql
   update public.profiles p
   set role = 'admin'
   from auth.users u
   where p.id = u.id
     and u.email = 'email-admin-kamu@example.com';
   ```

4. Akun berikutnya otomatis menjadi `anggota`. Admin dapat mengubah role melalui SQL Editor untuk sementara. Fungsi `admin_set_role` tersedia untuk alur admin khusus berikutnya.

**Penting:** jangan membuat Admin dari form pendaftaran. Role pendaftaran selalu `anggota`.

## 3. Jalankan di komputer

Pastikan Node.js versi LTS sudah terpasang.

```bash
npm install
cp .env.example .env
```

Isi `.env`:

```env
VITE_SUPABASE_URL=https://PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

Lalu:

```bash
npm run dev
```

Buka alamat lokal yang ditampilkan Vite.

## 4. Upload ke GitHub

1. Buat repository baru di GitHub, misalnya `kaskita-md26`.
2. Ekstrak ZIP ini.
3. Upload seluruh isi folder proyek ke repository (bukan file ZIP-nya).
4. Pastikan `.env` tidak ikut terunggah. `.gitignore` sudah mengabaikannya.
5. Commit ke branch `main`.

## 5. Deploy ke Vercel

1. Buka https://vercel.com/ dan pilih **Add New > Project**.
2. Import repository GitHub `kaskita-md26`.
3. Framework akan terdeteksi sebagai Vite.
4. Pada **Environment Variables**, tambahkan:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Klik Deploy.
6. Setelah deploy, setiap push ke branch utama akan memicu deployment baru.

## 6. Konfigurasi Supabase setelah deploy

Di Supabase > Authentication > URL Configuration:
- **Site URL**: isi domain Vercel kamu.
- **Redirect URLs**: tambahkan domain Vercel, misalnya `https://nama-app.vercel.app/**`.
- Untuk uji lokal, tambahkan `http://localhost:5173/**`.

## Catatan fitur dan keamanan

- Aplikasi ini merupakan starter awal yang perlu diuji dengan akun berbeda sebelum dipakai mengelola uang sungguhan.
- RLS database membatasi pembacaan/pengubahan berdasarkan role. Jangan menonaktifkan RLS.
- Kunci `service_role` bersifat rahasia; jangan pernah memasukkannya ke variabel `VITE_`, kode frontend, atau GitHub.
- Bukti pembayaran disimpan pada bucket privat. Tautan bukti yang dibuat aplikasi berlaku sementara.
- Saat ini semua anggota login dapat melihat daftar profil dan transaksi, tetapi hanya melihat pembayaran miliknya sendiri.
- Admin/Bendahara dapat meninjau pembayaran. Sebelum operasional, lakukan pengujian hak akses dan skenario penolakan/approval.
- Laporan PDF menggunakan fitur cetak browser. Ini bukan generator PDF khusus.
- Saldo dihitung dari transaksi yang berhasil dimuat aplikasi (maksimal 500 baris pada query saat ini). Untuk kelas dengan data besar, implementasikan agregasi saldo di sisi database.
- Belum ada fitur pengaturan nominal/iuran periode terjadwal, audit log terperinci, atau manajemen role dari UI.
- Perlu pengujian tambahan sebelum produksi: validasi ukuran/jenis file, duplikasi pembayaran per periode, konsistensi status pembayaran dengan transaksi pemasukan, dan pembatasan perubahan status.

## Stack

React, TypeScript, Vite, Supabase, Recharts, Lucide React.
