# Pasar Satwa

Pasar Satwa by Fajmuls: game simulator toko hewan berbasis PWA (Phaser + Vite). Beli stok di grosir, atur harga, buka toko, lihat pelanggan pixel art 2D memilih barang, antre, lalu membayar.

## Menjalankan
```bash
npm install
npm run dev      # pengembangan
npm test         # tes keuangan, sistem, simpan/muat
npm run build    # build produksi (dist/)
```

## Fitur
- Buku kas bilangan bulat dengan audit (saldo selalu = transaksi), tidak pernah negatif
- 5 kategori (Pakan, Ikan, Burung, Reptil, Satwa Kecil), 5 spesies bertingkat per kategori, dibuka dengan uang
- Level toko (1-5) membuka kategori dan rak, dekor toko ikut berubah
- Reputasi dan bintang (1-5) dengan keuntungan tiap bintang
- Harga: tombol harga pasar, pasar -10%, persen bebas, harga otomatis tiap hari
- Pohon skill (4 cabang), ramuan/buff, 4 jenis karyawan (Penjaga Stok mengisi ulang otomatis)
- Breeding dengan peluang anakan naik kualitas
- Bank (pinjaman bertenor), deposito, saham, properti
- Event harian, pelanggan 3 tipe, laporan keuangan harian
- Simpan otomatis (IndexedDB) + cadangan, ekspor/impor, migrasi dari simpanan versi 1
- v3: notifikasi bertumpuk di kanan atas, jumlah beli diingat + tombol +1/+5/+10/+100/Maks, ikon per spesies
- v3: kecepatan 4x/8x dibuka dengan upgrade Mesin Waktu, pajak progresif, perawatan, hewan sakit, pencurian
- v3: karyawan Satpam dan Badut, Ramuan Obat, Renovasi Toko, statistik terlaris
- v3: efek suara dan musik latar (dibuat dengan WebAudio), animasi loading
- PWA: bisa di-install dan jalan offline (siap PWA Builder)
