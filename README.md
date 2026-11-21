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
- v4: misi harian/mingguan, 20 pencapaian, 12 pelanggan langganan (Buku Langganan, tip, hadiah level), tutorial 8 langkah, riwayat notifikasi, isi stok ke target, huruf besar dan kontras tinggi, tombol pasang aplikasi
- v5 (rombak total): tanpa otomatis. Beli bibit/anak ikan di Pasar, tanam di Kolam, tunggu tumbuh, panen hewan dengan ukuran dan rarity (common sampai secret). Pakan lebih mahal = peluang rarity lebih tinggi. Gacha telur pet dengan buff. Layani pelanggan langsung (tap rak, serahkan hewan). Pengepul beli sisa 35%. Ilustrasi SVG, karyawan terlihat di toko.
- v6 (rombak UI dan dunia): peta besar yang bisa digeser dan di-zoom dengan hub Kolam, Kandang, Pasar, Toko, Rumah Pet dan Alun-alun. Ketuk tujuan, karakter berjalan seperti Hay Day. Lahan terlihat di peta (kolam, petak umpan, kandang), racik tanam langsung di lahan. Gaya doodle vektor tajam (tanpa pixelated), loading baru, karakter dan pelanggan unik (36 tampang plus langganan bertanda). Cerita 11 bab bersama Pak Pasar, event harian baru (Malam Bintang, Angin Segar), misi panen/tanam. Semua panel muat layar tanpa scroll (halaman otomatis dengan tombol dan geser). Save v5 dimigrasi otomatis ke v6.
- PWA: bisa di-install dan jalan offline (siap PWA Builder)
