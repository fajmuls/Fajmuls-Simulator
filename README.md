# Fajmuls Simulator

Game simulator toko berbasis PWA (Phaser 4 + Vite). Beli stok di grosir, atur harga, buka toko, dan lihat pelanggan pixel art 2D berjalan, memilih barang, antre, lalu membayar.

## Menjalankan
```bash
npm install
npm run dev      # pengembangan
npm test         # tes keuangan, stok, simpan/muat
npm run build    # build produksi (dist/)
```

## Fitur MVP
- Buku kas bilangan bulat dengan audit (saldo selalu = transaksi), tidak pernah negatif
- Grosir dengan harga harian berubah, 5 tingkat kualitas, stok bermodal rata-rata
- Pelanggan 3 tipe (Biasa, Si Pelit, VIP) dengan animasi jalan, antrean kasir
- Siklus hari, laporan keuangan, sewa harian dan tunggakan
- Upgrade toko (rak, dekorasi, kontrak supplier)
- Simpan otomatis (IndexedDB) + cadangan, ekspor/impor berkas
- PWA: bisa di-install dan jalan offline (siap PWA Builder)

## Rencana berikutnya
Pohon skill, ramuan dan buff, breeding ikan dan kebun cacing, investasi, utang, event acak.
