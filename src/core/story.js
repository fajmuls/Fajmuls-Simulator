// Cerita bab demi bab. Logika murni: kemajuan dibaca dari state, hadiah dibayar lewat ledger.
import { credit } from './ledger.js';
import { RARITIES, rarityIdx } from './farm.js';

const bookCount = (e) => Object.values(e.state.farm.book).reduce((n, byRar) => n + Object.keys(byRar).length, 0);
const hasCat = (e, cat) => Object.keys(e.state.farm.book).some((id) => e.unlockedItems().some((it) => it.id === id && it.cat === cat));

// need = target angka, cur = kemajuan saat ini
export const CHAPTERS = [
  {
    id: 'bibit', title: 'Bibit Pertama', goal: 'Tanam 1 bibit di Kolam atau Petak',
    lines: ['Halo, Nak! Aku Pak Pasar. Pasar Satwa ini sudah lama sepi.', 'Mulailah dari yang kecil: beli bibit di Pasar, lalu tanam di Kolam atau Petak Umpan.'],
    need: 1, cur: (e) => e.state.stats.planted || 0, reward: { cash: 1500, feeds: { bagus: 2 } },
  },
  {
    id: 'panen', title: 'Panen Perdana', goal: 'Panen 3 hewan',
    lines: ['Bagus! Tunggu sampai tumbuh, lalu ketuk kolamnya untuk panen.', 'Tiap hewan punya ukuran dan kelangkaan sendiri. Siapa tahu kamu dapat yang langka.'],
    need: 3, cur: (e) => e.state.stats.bred || 0, reward: { cash: 2500, bibit: { cacing: 3 } },
  },
  {
    id: 'pelanggan', title: 'Pelanggan Pertama', goal: 'Layani 5 pelanggan',
    lines: ['Sekarang buka tokomu! Ketuk rak untuk mengambil hewan, lalu ketuk pelanggan yang memesannya.', 'Cepat melayani berarti tip lebih besar.'],
    need: 5, cur: (e) => e.state.stats.customers || 0, reward: { cash: 3000, feeds: { bagus: 3 } },
  },
  {
    id: 'pakan', title: 'Pakan Ajaib', goal: 'Panen hewan Rare atau lebih langka',
    lines: ['Pakan murah menghasilkan hewan biasa. Pakan mahal membuka peluang hewan langka.', 'Coba pakan Premium. Ingat, hewan Rare ke atas dibayar mahal oleh Kolektor.'],
    need: 3, cur: (e) => (e.state.stats.bestRar || 0) + 1, reward: { cash: 4000, feeds: { premium: 2 } }, label: (cur) => (cur >= 3 ? 'Sudah dapat Rare+' : 'Belum dapat Rare+'), flag: true,
  },
  {
    id: 'pet', title: 'Sahabat Berbulu', goal: 'Tetaskan 1 telur pet',
    lines: ['Ada satu lagi rahasia pasar ini: telur pet! Pet memberi buff selama kamu berdagang.', 'Kunjungi Rumah Pet dan tetaskan telur.'],
    need: 1, cur: (e) => e.state.stats.hatched || 0, reward: { cash: 5000 },
  },
  {
    id: 'bintang', title: 'Toko Dikenal', goal: 'Capai bintang 2',
    lines: ['Warga mulai membicarakan tokomu. Jaga agar pelanggan puas dan reputasi naik.', 'Bintang 2 membuka karyawan, ramuan, dan bank.'],
    need: 2, cur: (e) => e.state.stars, reward: { cash: 8000, points: 1 },
  },
  {
    id: 'burung', title: 'Kandang Burung', goal: 'Panen 1 burung di Kandang',
    lines: ['Kicau burung selalu menarik pembeli. Naikkan toko ke Lv 2, buka spesies burung, dan bangun kandang.'],
    need: 1, cur: (e) => (hasCat(e, 'burung') ? 1 : 0), reward: { cash: 12000, feeds: { super: 1 } },
  },
  {
    id: 'rival', title: 'Bu Juragan Datang', goal: 'Total omzet Rp 150.000',
    lines: ['Hmm, ada pedagang lain, Bu Juragan, yang mulai mengincar pelangganmu.', 'Jangan gentar! Layani lebih banyak orang dan jual hewan yang langka.'],
    need: 150000, cur: (e) => e.state.stats.revenue, reward: { cash: 15000, points: 1 }, money: true,
  },
  {
    id: 'koleksi', title: 'Buku Koleksi', goal: 'Kumpulkan 12 entri di Buku Koleksi',
    lines: ['Setiap kombinasi spesies dan kelangkaan dicatat di Buku Koleksi.', 'Pelengkap koleksi dihargai tinggi oleh kolektor.'],
    need: 12, cur: (e) => bookCount(e), reward: { cash: 20000, feeds: { dewa: 1 } },
  },
  {
    id: 'epic', title: 'Berkilau Ungu', goal: 'Panen hewan Epic atau lebih langka',
    lines: ['Epic, Legendary, Mythic, dan Secret itu langka sekali.', 'Pakan Super dan Dewa plus pet Hoki akan sangat membantu.'],
    need: 4, cur: (e) => (e.state.stats.bestRar || 0) + 1, reward: { cash: 50000, points: 2 }, flag: true,
  },
  {
    id: 'raja', title: 'Raja Pasar Satwa', goal: 'Capai bintang 5',
    lines: ['Kamu sudah jauh melangkah, Nak. Pasar ini hidup lagi karenamu.', 'Capai bintang 5 dan jadilah Raja Pasar Satwa!'],
    need: 5, cur: (e) => e.state.stars, reward: { cash: 200000, points: 3 },
  },
  // ---------- Musim 2: Pasar Satwa Bangkit (late game) ----------
  {
    id: 'tim1', title: 'Tim Pertama', goal: 'Pekerjakan 3 karyawan',
    lines: ['Tokomu sudah ramai, Nak. Sendirian tak akan sanggup.', 'Pelajari skill Manajemen Tim, lalu rekrut karyawan di menu Karyawan.'],
    need: 3, cur: (e) => e.state.crew.hired.length, reward: { cash: 60000, points: 1 },
  },
  {
    id: 'ratusan', title: 'Antrean Mengular', goal: 'Layani 500 pelanggan',
    lines: ['Orang-orang dari kota sebelah mulai berdatangan.', 'Jaga agar semuanya pulang dengan senang.'],
    need: 500, cur: (e) => e.state.stats.customers || 0, reward: { cash: 100000, feeds: { super: 3 } },
  },
  {
    id: 'koleksi2', title: 'Kolektor Sejati', goal: 'Kumpulkan 30 entri di Buku Koleksi',
    lines: ['Bu Juragan kalah soal koleksi! Tapi Buku Koleksimu belum penuh.', 'Cari kombinasi spesies dan kelangkaan yang belum ada.'],
    need: 30, cur: (e) => bookCount(e), reward: { cash: 150000, feeds: { dewa: 2 } },
  },
  {
    id: 'juta', title: 'Omzet Jutaan', goal: 'Total omzet Rp 2.000.000',
    lines: ['Dua juta rupiah! Bu Juragan mulai menawarkan kerja sama.', 'Jangan mau, Nak. Kita tumbuh sendiri.'],
    need: 2000000, cur: (e) => e.state.stats.revenue, reward: { cash: 250000, points: 2 }, money: true,
  },
  {
    id: 'tim2', title: 'Tim Impian', goal: 'Pekerjakan 6 karyawan',
    lines: ['Kasir, penjaga stok, satpam... pasar ini berjalan hampir sendiri.', 'Tambah slot lewat Manajemen Tim dan Manajer Senior.'],
    need: 6, cur: (e) => e.state.crew.hired.length, reward: { cash: 300000, points: 1 },
  },
  {
    id: 'legend', title: 'Hewan Legendaris', goal: 'Panen hewan Legendary atau lebih langka',
    lines: ['Konon ada hewan yang bersinar emas di kolam terdalam.', 'Pakai Pakan Dewa dan Peramal Pasar untuk memburunya.'],
    need: 5, cur: (e) => (e.state.stats.bestRar || 0) + 1, reward: { cash: 400000, points: 2 }, flag: true,
  },
  {
    id: 'ahli', title: 'Ahli Segala Bidang', goal: 'Pelajari 40 rank skill',
    lines: ['Ilmu itu tak ada habisnya.', 'Buka Pohon Skill dan investasikan poinmu.'],
    need: 40, cur: (e) => Object.values(e.state.skills).reduce((n, v) => n + (v || 0), 0), reward: { cash: 400000, points: 2 },
  },
  {
    id: 'ribuan', title: 'Pasar Seribu Pelanggan', goal: 'Layani 1500 pelanggan',
    lines: ['Pasar Satwa kini jadi buah bibir se-nusantara.'],
    need: 1500, cur: (e) => e.state.stats.customers || 0, reward: { cash: 600000, points: 2 },
  },
  {
    id: 'mythic', title: 'Mitos Itu Nyata', goal: 'Panen hewan Mythic atau lebih langka',
    lines: ['Mythic... Kakekku hanya pernah mendengar ceritanya.', 'Kejar terus, Nak!'],
    need: 6, cur: (e) => (e.state.stats.bestRar || 0) + 1, reward: { cash: 1000000, points: 3 }, flag: true,
  },
  {
    id: 'kaya', title: 'Saudagar Kaya', goal: 'Miliki uang Rp 5.000.000',
    lines: ['Kas tokomu membengkak. Pandai-pandailah berinvestasi.', 'Tapi ingat pajak kekayaan.'],
    need: 5000000, cur: (e) => e.state.ledger.balance, reward: { cash: 1500000, points: 2 }, money: true,
  },
  {
    id: 'nusantara', title: 'Raja Seluruh Nusantara', goal: 'Total omzet Rp 20.000.000',
    lines: ['Sudah kuduga kamu akan sampai di sini.', 'Pasar Satwa kini milik semua orang. Terima kasih, Nak, sudah menghidupkannya kembali.'],
    need: 20000000, cur: (e) => e.state.stats.revenue, reward: { cash: 3000000, points: 5 }, money: true,
  },
];

export const NPC = { id: 'pak', name: 'Pak Pasar' };

export function storyNow(e) {
  const st = e.state.story;
  if (st.ch >= CHAPTERS.length) return { done: true, total: CHAPTERS.length };
  const c = CHAPTERS[st.ch];
  const cur = Math.min(c.need, c.cur(e));
  return { done: false, index: st.ch, total: CHAPTERS.length, chapter: c, cur, need: c.need, ready: cur >= c.need, introSeen: st.intro === st.ch };
}

export function markIntro(e) {
  e.state.story.intro = e.state.story.ch;
}

export function claimStory(e) {
  const n = storyNow(e);
  if (n.done) throw new Error('Cerita sudah tamat');
  if (!n.ready) throw new Error('Tantangan bab ini belum selesai');
  const r = n.chapter.reward;
  const s = e.state;
  if (r.cash) credit(s.ledger, s.day, 'reward', r.cash, `Hadiah cerita: ${n.chapter.title}`);
  if (r.points) s.bonusPoints += r.points;
  for (const [id, q] of Object.entries(r.feeds || {})) s.farm.feeds[id] = (s.farm.feeds[id] || 0) + q;
  for (const [id, q] of Object.entries(r.bibit || {})) s.farm.bibit[id] = (s.farm.bibit[id] || 0) + q;
  s.story.ch += 1;
  if (s.story.ch >= CHAPTERS.length) s.story.done = true;
  return r;
}

export const rewardText = (r) => [
  r.cash ? `Rp ${r.cash.toLocaleString('id-ID')}` : null,
  r.points ? `${r.points} poin skill` : null,
  ...Object.entries(r.feeds || {}).map(([id, q]) => `${q}× pakan ${id}`),
  ...Object.entries(r.bibit || {}).map(([id, q]) => `${q}× bibit ${id}`),
].filter(Boolean).join(' · ');

export { RARITIES, rarityIdx };
