// Pixel art dibuat lewat kode (tanpa berkas gambar) supaya ringan dan mudah diubah.
// Setiap karakter pada grid mewakili satu piksel; '.' = transparan.

export const PX = 2; // skala piksel di layar

function drawGrid(rows, palette, scale) {
  const h = rows.length;
  const w = rows[0].length;
  const canvas = document.createElement('canvas');
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d');
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = rows[y][x];
      if (c === '.' || !palette[c]) continue;
      ctx.fillStyle = palette[c];
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  return canvas;
}

function addCanvas(scene, key, canvas) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
}

// ---------- Pelanggan (12 x 16) ----------
const BODY = [
  '...HHHHHH...',
  '..HHHHHHHH..',
  '..HSSSSSSH..',
  '..SSESSESS..',
  '..SSSSSSSS..',
  '...SSSSSS...',
  '..TTTTTTTT..',
  '.TTTTTTTTTT.',
  '.STTTTTTTTS.',
  '.STTTTTTTTS.',
  '..TTTTTTTT..',
  '..PPPPPPPP..',
];
const LEGS = {
  idle: ['..PPP..PPP..', '..PPP..PPP..', '..BBB..BBB..', '............'],
  walkA: ['..PPP...PP..', '.PPP.....PP.', '.BBB.....BB.', '............'],
  walkB: ['...PP..PPP..', '..PP....PPP.', '..BB....BBB.', '............'],
};

export const HAIRS = ['#2b1d14', '#6b3f1d', '#d4a017', '#1f2937'];
export const SKINS = ['#f1c27d', '#c68642', '#8d5524'];
export const SHIRTS = {
  biasa: '#3b82f6',
  pelit: '#84cc16',
  vip: '#e11d48',
};

export function customerTextureKey(type, hair, skin, frame) {
  return `cust_${type}_${hair}_${skin}_${frame}`;
}

export function buildCustomerTextures(scene) {
  for (const type of Object.keys(SHIRTS)) {
    for (let hi = 0; hi < HAIRS.length; hi++) {
      for (let si = 0; si < SKINS.length; si++) {
        const palette = {
          H: HAIRS[hi], S: SKINS[si], E: '#1b1b1b', T: SHIRTS[type], P: '#374151', B: '#111827',
        };
        for (const frame of Object.keys(LEGS)) {
          const rows = [...BODY, ...LEGS[frame]];
          addCanvas(scene, customerTextureKey(type, hi, si, frame), drawGrid(rows, palette, PX));
        }
      }
    }
  }
  // Pemilik toko (kamu): kemeja oranye + topi
  const owner = ['..CCCCCCCC..', ...BODY.slice(1), ...LEGS.idle];
  addCanvas(scene, 'owner', drawGrid(owner, {
    C: '#f97316', H: '#2b1d14', S: '#f1c27d', E: '#1b1b1b', T: '#f59e0b', P: '#374151', B: '#111827',
  }, PX));
}

// ---------- Ikon barang (8 x 8) ----------
const ICONS = {
  worm: {
    rows: ['........', '..pp....', '.p..p...', '....pp..', '..pp..p.', '.p...pp.', '..pppp..', '........'],
    pal: { p: '#f472b6' },
  },
  cricket: {
    rows: ['.g....g.', '..g..g..', '..gggg..', '.gggggg.', 'ggEggEgg', '.gggggg.', '.g.gg.g.', 'g..gg..g'],
    pal: { g: '#65a30d', E: '#1b1b1b' },
  },
  pellet: {
    rows: ['..bbbb..', '.bbbbbb.', 'bbyyyybb', 'bbyyyybb', 'bbbbbbbb', 'bbbbbbbb', '.bbbbbb.', '........'],
    pal: { b: '#92400e', y: '#fde68a' },
  },
  catfish: {
    rows: ['........', 'a.....a.', '.aaaaaa.', 'aEaaaaaa', '.aaaaaaa', '.a.aa..a', '........', '........'],
    pal: { a: '#6b7280', E: '#f9fafb' },
  },
  goldfish: {
    rows: ['........', '..oo..o.', '.oooooo.', 'oEoooooo', '.oooooo.', '..oo..o.', '........', '........'],
    pal: { o: '#f97316', E: '#1b1b1b' },
  },
  koi: {
    rows: ['........', '..rw..r.', '.rwwrww.', 'wEwwrwww', '.wrwwrw.', '..ww..w.', '........', '........'],
    pal: { r: '#dc2626', w: '#f9fafb', E: '#1b1b1b' },
  },
  coin: {
    rows: ['..yyyy..', '.yYYYYy.', 'yYyyyyYy', 'yYyYYyYy', 'yYyYYyYy', 'yYyyyyYy', '.yYYYYy.', '..yyyy..'],
    pal: { y: '#facc15', Y: '#ca8a04' },
  },
  plant: {
    rows: ['..g..g..', '.ggggggg', '..gggg..', '...gg...', '..bbbb..', '..bbbb..', '...bb...', '........'],
    pal: { g: '#22c55e', b: '#92400e' },
  },
};

export function buildIconTextures(scene) {
  for (const [name, def] of Object.entries(ICONS)) {
    addCanvas(scene, `icon_${name}`, drawGrid(def.rows, def.pal, 3));
  }
}

// ---------- Latar toko ----------
export function buildShopBackground(scene, width, height) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const g = c.getContext('2d');

  // dinding
  g.fillStyle = '#d6b88c';
  g.fillRect(0, 0, width, 120);
  g.fillStyle = '#c49d6c';
  for (let y = 0; y < 120; y += 12) {
    for (let x = (y / 12) % 2 ? 0 : 12; x < width; x += 24) g.fillRect(x, y, 22, 1);
    g.fillRect(0, y + 11, width, 1);
  }
  g.fillStyle = '#7c4a21';
  g.fillRect(0, 116, width, 6);

  // lantai kotak-kotak
  for (let y = 122; y < height; y += 20) {
    for (let x = 0; x < width; x += 20) {
      g.fillStyle = ((x + y) / 20) % 2 === 0 ? '#f3e5c8' : '#e8d3a8';
      g.fillRect(x, y, 20, 20);
    }
  }

  // karpet pintu
  g.fillStyle = '#b91c1c';
  g.fillRect(0, height - 70, 60, 56);
  g.fillStyle = '#fecaca';
  g.fillRect(4, height - 66, 52, 2);
  g.fillRect(4, height - 20, 52, 2);

  // meja kasir
  g.fillStyle = '#7c4a21';
  g.fillRect(236, 270, 116, 44);
  g.fillStyle = '#a16207';
  g.fillRect(236, 270, 116, 8);
  g.fillStyle = '#5b3317';
  g.fillRect(236, 308, 116, 6);
  // mesin kasir
  g.fillStyle = '#374151';
  g.fillRect(300, 248, 36, 24);
  g.fillStyle = '#86efac';
  g.fillRect(304, 252, 28, 8);
  g.fillStyle = '#9ca3af';
  g.fillRect(304, 264, 28, 6);

  return c;
}

export function buildShelfTexture(scene, key, width) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#7c4a21';
  g.fillRect(0, 0, width, 6);
  g.fillStyle = '#a16207';
  g.fillRect(0, 0, width, 2);
  g.fillStyle = '#5b3317';
  g.fillRect(0, 56, width, 8);
  g.fillStyle = '#6b3f1d';
  g.fillRect(2, 6, 4, 50);
  g.fillRect(width - 6, 6, 4, 50);
  g.fillStyle = 'rgba(0,0,0,0.08)';
  g.fillRect(6, 6, width - 12, 50);
  addCanvas(scene, key, c);
}

export function addBackground(scene, key, canvas) {
  addCanvas(scene, key, canvas);
}
