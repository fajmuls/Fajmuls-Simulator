# Menerbitkan Pasar Satwa ke Google Play (TWA lewat PWABuilder)

## Syarat teknis (sudah tersedia di repo)
- Manifest lengkap: nama, id, ikon 192/512 + maskable 512, screenshot, kategori, orientasi portrait
- Service worker offline (vite-plugin-pwa)
- Kebijakan privasi: `/privacy.html` (isi URL ini di Play Console)

## Langkah
1. Pastikan situs live dapat dibuka TANPA login. Matikan Vercel Authentication di Project Settings (Deployment Protection), kalau tidak PWABuilder dan Play tidak bisa membaca manifest.
2. Buka pwabuilder.com, masukkan URL situs, lalu "Package for stores" > Android. Isi package id (mis. `app.pasarsatwa`), nama "Pasar Satwa", versi 1.
3. Simpan keystore yang dibuat PWABuilder (jangan sampai hilang) dan catat SHA-256 fingerprint-nya.
4. Letakkan `assetlinks.json` hasil PWABuilder di `public/.well-known/assetlinks.json`, deploy ulang, supaya bilah alamat Chrome hilang (full screen).
5. Play Console: buat aplikasi, unggah `.aab`, isi listing (deskripsi, ikon 512, feature graphic 1024x500, screenshot dari `public/screenshots`), kebijakan privasi, kuesioner rating konten, Data safety (tidak ada data dikumpulkan), target audiens.
6. Akun developer baru wajib uji tertutup: 12 penguji selama 14 hari sebelum produksi.

## Deskripsi singkat (80 karakter)
Kelola pasar hewan doodle: tanam, panen, jual, rekrut tim, dan jadi raja pasar!

## Catatan
- Nama paket dan keystore tidak bisa diganti setelah terbit.
- Naikkan versi di PWABuilder tiap rilis baru.
