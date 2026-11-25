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
- v7: layout Toko dirapikan (rak di dinding belakang, pintu bebas, kasir kanan, antrean di depan, gelembung pesanan ringkas), karakter berjalan sungguhan di dalam Toko dengan kecepatan dari skill, kamera terkunci per layar. Panel kembali scroll vertikal dengan tab geser horizontal. Rak bertumpuk per spesies dan rarity (bisa dilipat). Inventori pet: pet tidak hilang saat dilepas dari slot, bisa dijual, Buku Koleksi pet permanen. 26 skill dalam 6 cabang (rank 5-10, termasuk Langkah Cepat) dengan poin lebih mudah (tiap 3 hari, tiap 3 misi, bintang, level toko, cerita). Event baru: Pasar Malam, Lomba Hewan, Hari Libur, Musim Subur. Tombol suara dan notifikasi dipindah ke Pengaturan. Save v6 dimigrasi otomatis ke v7.
- v8: ekonomi disetel lebih lambat (bibit 55% harga jual, sewa dan gaji naik, biaya upgrade/level toko/spesies x2,2), hadiah misi lebih besar dengan peti bonus saat semua misi harian/mingguan selesai, poin skill tiap 5 hari + 1 poin per 3 hari misi harian penuh + 1 poin per minggu misi mingguan penuh. Lahan (kolam, petak, kandang) kini punya level 1-3 (muat 2/4/6 ekor), ditekan untuk membuka daftar penghuni dengan spesies, pakan, dan timer sendiri-sendiri; bisa di-upgrade berbayar. Save v7 dimigrasi ke v8.
- v9 (tahap 1): satu peta besar dengan kamera mengikuti karakter; ketuk tempat/lahan/rak/pelanggan lalu karakter berjalan sungguhan (jalur A* menghindari dinding, lewat pintu toko dan gerbang kebun), boleh pindah saat toko buka. Pencuri mendatangi kolam dan satpam yang berjaga di kolam bisa mengusirnya. Pasar bertab (Hewan/Pakan/Lisensi), pilihan lahan berupa grid kompak. Pakan dibuka per level toko, lisensi tier 2 murah lagi. Tanah digambar sekali ke satu tekstur, DPR dibatasi 1,5, FPS otomatis dibatasi 30 bila lambat, plus Mode hemat baterai di Pengaturan.
- v9 (tahap 2): sistem karyawan penuh. Slot mulai 0 dan dibuka lewat skill Manajemen Tim; karyawan terbuka lewat lisensi atau misi (jenis rahasia hanya lewat misi). Tiap jenis punya satu buff/pekerjaan dengan jumlah maksimal, level 1-5 dan upgrade berbayar, kecepatan kerja naik lewat skill Tim Sigap. Karyawan berjalan di peta: kasir melayani antrean, Penjaga Stok memanen/menanam sesuai aturan (tanam bila stok < N, pakan opsional), satpam menjaga kolam, sisanya berkeliling. Menu Karyawan bertab Tim/Rekrut/Penjaga Stok. Save lama dimigrasi (lisensi + slot bonus).
- v10 (tahap 1): Penjaga Stok bisa diatur massal (isi ke semua, simpan semua sekaligus, draft tidak hilang), nama jadi "Pasar Satwa" tanpa embel-embel pembuat, ikon doodle baru (SVG + PNG termasuk maskable), chip melayang di peta dirapikan jadi kolom kecil.
- v10 (tahap 2): batas pelanggan harian tidak lagi mentok 40; naik dengan level toko, bintang, renovasi dan skill Toko Ramai. Karyawan baru: Promotor Toko (tip), Pedagang Senior (harga jual), Saudagar Misterius (rahasia, harga jual). Skill baru: Penjual Ulung, Pelanggan Setia, Iklan Besar, Toko Ramai, Manajer Senior (+slot), Pagar Kuat (pencuri lebih jarang).
- v10 (tahap 3): campaign Musim 2 "Pasar Satwa Bangkit" (bab 12-22: tim, koleksi, omzet jutaan, hewan Legendary/Mythic, raja nusantara; pemain yang sudah tamat bab 11 lanjut otomatis). Paket Play Store: manifest lengkap + screenshot, kebijakan privasi (`/privacy.html`), panduan di `docs/PLAY_STORE.md`.
- v11-A (state v10): kandang pet bisa diperluas (+20 slot per perluasan, maks 10x), tab Aturan pet (jual otomatis hasil gacha per kelangkaan sampai Legendary, konfirmasi sebelum jual), menu Aturan Jual per kelangkaan (Normal/Obral/Langsung ke pengepul/Tahan; kasir ikut aturan), gudang hewan kecil di awal (20) dan naik bertahap.
- v11-B (state v11): skill dirombak. Skill tree (15 simpul, maks 3 rank, tingkat 1-4, biaya poin naik tiap rank dan tingkat), Perk terpisah (20 perk berjenjang yang butuh level atribut), 4 atribut (Dagang, Karisma, Ketangkasan, Hoki) dengan poin dari bintang, level toko, dan bab cerita. Simpanan lama dimigrasi: rank direset, poin kembali penuh, slot karyawan dipertahankan. Kandang pet bisa diperluas lewat skill Rumah Pet Luas.
- v11-C: peta dirapikan: pagar digambar ulang tanpa tumpang tindih, halaman Pasar dan Pet tidak lagi menabrak jalan, jalan terlihat masuk halaman, alun-alun dan air mancur tidak menyentuh pagar, pohon/semak/batu diberi jarak dan dijauhkan dari bangunan, jajaran semak bawah menggantikan deretan pohon yang menutupi toko, lahan kolam digeser dari chip HUD.
- PWA: bisa di-install dan jalan offline (siap PWA Builder)

- v12 Tahap 1: gudang hewan naik bertahap (+40 level toko, +30 Rak, +10 perk Gudang Rapi, maks 440), tombol Back Android, simpan otomatis saat app ditutup, dialog konfirmasi dalam game, tombol 44px, stepper −/+, tutorial baru.
