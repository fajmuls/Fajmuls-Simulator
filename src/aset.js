// Aset gambar kustom (PNG hasil buatan pengguna) yang dipotong ke dalam atlas.
// File atlas harus ada di folder public/aset/ pada repo. Selama file belum ada, game tetap jalan
// memakai gambar vektor buatan kode (semua fungsi di sini mengembalikan null / false bila aset tidak ada).
export const ASET_BASE = '/aset/';

export const ATLAS = {
  pet: { file: 'atlas_pet.png', w: 1792, h: 1536, frames: { 'pet_cepat':[0,0,256,256],'pet_dagang':[256,0,256,256],'pet_hoki':[512,0,256,256],'pet_kodok':[768,0,256,256],'pet_landak':[1024,0,256,256],'pet_naga':[1280,0,256,256],'pet_panda':[1536,0,256,256],'pet_penguin':[0,256,256,256],'pet_poni':[256,256,256,256],'pet_ramah':[512,256,256,256],'pet_rubah':[768,256,256,256],'pet_setia':[1024,256,256,256],'telur_berlian':[1280,256,256,256],'telur_biasa':[1536,256,256,256],'telur_emas':[0,512,256,256],'pet_hoki_e1':[256,512,256,256],'pet_cepat_e1':[512,512,256,256],'pet_dagang_e1':[768,512,256,256],'pet_ramah_e1':[1024,512,256,256],'pet_setia_e1':[1280,512,256,256],'pet_rubah_e1':[1536,512,256,256],'pet_panda_e1':[0,768,256,256],'pet_naga_e1':[256,768,256,256],'pet_penguin_e1':[512,768,256,256],'pet_poni_e1':[768,768,256,256],'pet_kodok_e1':[1024,768,256,256],'pet_landak_e1':[1280,768,256,256],'pet_hoki_e2':[1536,768,256,256],'pet_cepat_e2':[0,1024,256,256],'pet_dagang_e2':[256,1024,256,256],'pet_ramah_e2':[512,1024,256,256],'pet_setia_e2':[768,1024,256,256],'pet_rubah_e2':[1024,1024,256,256],'pet_panda_e2':[1280,1024,256,256],'pet_naga_e2':[1536,1024,256,256],'pet_penguin_e2':[0,1280,256,256],'pet_poni_e2':[256,1280,256,256],'pet_kodok_e2':[512,1280,256,256],'pet_landak_e2':[768,1280,256,256] } },
  item: { file: 'atlas_item.png', w: 1792, h: 1536, frames: { 'item_boot_kebun':[0,0,256,256],'item_celemek_hemat':[256,0,256,256],'item_jas_formal':[512,0,256,256],'item_jas_toko':[768,0,256,256],'item_jubah_vip':[1024,0,256,256],'item_kalung_bunga':[1280,0,256,256],'item_lonceng_pintu':[1536,0,256,256],'item_mahkota_emas':[0,256,256,256],'item_pantofel':[256,256,256,256],'item_pin_iklan':[512,256,256,256],'item_rompi_gudang':[768,256,256,256],'item_sepatu_lari':[1024,256,256,256],'item_sepatu_sayap':[1280,256,256,256],'item_sneaker_kasir':[1536,256,256,256],'item_syal_ramah':[0,512,256,256],'item_tas_ajaib':[256,512,256,256],'item_tas_belanja':[512,512,256,256],'item_tas_bibit':[768,512,256,256],'item_tas_kulit':[1024,512,256,256],'item_topi_elang':[1280,512,256,256],'item_topi_jerami':[1536,512,256,256],'item_topi_koki':[0,768,256,256],'item_topi_pedagang':[256,768,256,256],'bahan_kain':[512,768,256,256],'bahan_logam':[768,768,256,256],'biskuit_pet':[1024,768,256,256],'jalur_pedagang':[1280,768,256,256],'jalur_pengelola':[1536,768,256,256],'jalur_peternak':[0,1024,256,256],'slot_topi':[256,1024,256,256],'slot_baju':[512,1024,256,256],'slot_sepatu':[768,1024,256,256],'slot_tas':[1024,1024,256,256],'slot_aksesori':[1280,1024,256,256],'warna_merah':[1536,1024,256,256],'warna_biru':[0,1280,256,256],'warna_hijau':[256,1280,256,256],'warna_kuning':[512,1280,256,256],'warna_ungu':[768,1280,256,256],'ikon_upgrade':[1024,1280,256,256],'ikon_gembok':[1280,1280,256,256],'bangunan_butik':[1536,1280,256,256] } },
  musuh: { file: 'atlas_musuh.png', w: 1920, h: 768, frames: { 'musuh_hutan':[0,0,384,384],'musuh_danau':[384,0,384,384],'musuh_rawa':[768,0,384,384],'musuh_gua':[1152,0,384,384],'musuh_menara':[1536,0,384,384],'bos_hutan':[0,384,384,384],'bos_danau':[384,384,384,384],'bos_rawa':[768,384,384,384],'bos_gua':[1152,384,384,384],'bos_menara':[1536,384,384,384] } },
  dunia: { file: 'atlas_dunia.png', w: 2048, h: 896, frames: { 'bangunan_balai':[0,0,512,384],'bangunan_rumah_pet':[512,0,512,384],'bangunan_pasar':[1024,0,512,384],'bangunan_toko':[1536,0,512,384],'dekor_pohon':[0,384,256,256],'dekor_pinus':[256,384,256,256],'dekor_pohon_apel':[512,384,256,256],'dekor_semak':[768,384,256,256],'dekor_batu_besar':[1024,384,256,256],'dekor_batu_kecil':[1280,384,256,256],'dekor_bunga':[1536,384,256,256],'dekor_tunggul':[1792,384,256,256],'pagar_lurus':[0,640,256,256],'pagar_tegak':[256,640,256,256],'pagar_sudut':[512,640,256,256],'gerbang':[768,640,256,256],'papan_nama':[1024,640,256,256],'lampu_taman':[1280,640,256,256],'tong_air':[1536,640,256,256],'jerami':[1792,640,256,256] } },
  zona: { file: 'atlas_zona.png', w: 1536, h: 1056, frames: { 'zona_hutan':[0,0,768,352],'zona_danau':[768,0,768,352],'zona_rawa':[0,352,768,352],'zona_gua':[768,352,768,352],'zona_menara':[0,704,768,352],'zona_padang':[768,704,768,352] } },
  karakter: { file: 'atlas_karakter.png', w: 2048, h: 768, frames: { 'karakter_depan':[0,0,512,768],'karakter_jalan_kanan':[512,0,512,768],'karakter_jalan_kiri':[1024,0,512,768],'karakter_potret':[1536,0,512,768] } },
};

const ok = {}; // kunci atlas -> file berhasil dimuat
export const atlasOk = (k) => !!ok[k];

// Memeriksa file atlas mana yang benar-benar ada di server (dipanggil sekali saat mulai).
export function probeAssets() {
  if (typeof Image === 'undefined') return Promise.resolve(ok);
  return Promise.all(Object.entries(ATLAS).map(([k, a]) => new Promise((res) => {
    const im = new Image();
    im.onload = () => { ok[k] = true; res(); };
    im.onerror = () => { ok[k] = false; res(); };
    im.src = ASET_BASE + a.file;
  }))).then(() => ok);
}

export function frameOf(name) {
  for (const [k, a] of Object.entries(ATLAS)) if (a.frames[name]) return [k, a.frames[name]];
  return null;
}
export const hasAsset = (name) => { const f = frameOf(name); return !!f && !!ok[f[0]]; };

// Elemen DOM berisi satu bingkai atlas (sisi terpanjang = size piksel). null bila aset belum ada.
export function spriteEl(name, size = 48, cls = '') {
  const f = frameOf(name);
  if (!f || !ok[f[0]]) return null;
  const [k, [x, y, w, h]] = f;
  const a = ATLAS[k];
  const s = size / Math.max(w, h);
  const el = document.createElement('div');
  el.className = `sprite ${cls}`.trim();
  el.style.cssText = `display:inline-block;flex:none;width:${(w * s).toFixed(1)}px;height:${(h * s).toFixed(1)}px;background:url(${ASET_BASE}${a.file}) -${(x * s).toFixed(1)}px -${(y * s).toFixed(1)}px/${(a.w * s).toFixed(1)}px ${(a.h * s).toFixed(1)}px no-repeat`;
  return el;
}

// String SVG yang menampilkan satu bingkai atlas (untuk fungsi lama yang menerima string SVG).
export function frameSVG(name, px = 48) {
  const f = frameOf(name);
  if (!f || !ok[f[0]]) return null;
  const [k, [x, y, w, h]] = f;
  const a = ATLAS[k];
  const s = px / Math.max(w, h);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${(w * s).toFixed(0)}" height="${(h * s).toFixed(0)}"><image href="${ASET_BASE}${a.file}" x="0" y="0" width="${a.w}" height="${a.h}"/></svg>`;
}

// Evolusi pet: Lv 10 = tahap 1, Lv 20 = tahap 2.
export const petStage = (p) => ((p && p.lv) >= 20 ? 2 : (p && p.lv) >= 10 ? 1 : 0);
export const petFrameName = (kind, stage = 0) => (stage ? `pet_${kind}_e${stage}` : `pet_${kind}`);
