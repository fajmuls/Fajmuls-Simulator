// Peta tabrakan berbasis grid + pencari jalur A*. Murni JS, tanpa Phaser, supaya bisa diuji.
export class NavGrid {
  constructor(w, h, cell = 12) {
    this.w = w;
    this.h = h;
    this.cell = cell;
    this.cols = Math.ceil(w / cell);
    this.rows = Math.ceil(h / cell);
    this.blocked = new Uint8Array(this.cols * this.rows);
  }

  idx(cx, cy) { return cy * this.cols + cx; }
  cellOf(x, y) { return [Math.max(0, Math.min(this.cols - 1, Math.floor(x / this.cell))), Math.max(0, Math.min(this.rows - 1, Math.floor(y / this.cell)))]; }
  center(cx, cy) { return { x: (cx + 0.5) * this.cell, y: (cy + 0.5) * this.cell }; }

  _fill(x0, y0, x1, y1, v) {
    const [a, b] = this.cellOf(x0, y0);
    const [c, d] = this.cellOf(x1, y1);
    for (let cy = b; cy <= d; cy++) for (let cx = a; cx <= c; cx++) {
      const p = this.center(cx, cy);
      if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) this.blocked[this.idx(cx, cy)] = v;
    }
  }

  addRect(x, y, w, h, pad = 0) { this._fill(x - pad, y - pad, x + w + pad, y + h + pad, 1); }
  clearRect(x, y, w, h) { this._fill(x, y, x + w, y + h, 0); }

  addCircle(x, y, r) {
    const [a, b] = this.cellOf(x - r, y - r);
    const [c, d] = this.cellOf(x + r, y + r);
    for (let cy = b; cy <= d; cy++) for (let cx = a; cx <= c; cx++) {
      const p = this.center(cx, cy);
      if (Math.hypot(p.x - x, p.y - y) <= r) this.blocked[this.idx(cx, cy)] = 1;
    }
  }

  walkable(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
    const [cx, cy] = this.cellOf(x, y);
    return !this.blocked[this.idx(cx, cy)];
  }

  // Garis lurus bebas hambatan? (sampel tiap setengah sel)
  los(ax, ay, bx, by) {
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) / (this.cell * 0.5));
    for (let i = 0; i <= n; i++) {
      const t = n ? i / n : 0;
      if (!this.walkable(ax + (bx - ax) * t, ay + (by - ay) * t)) return false;
    }
    return true;
  }

  // Sel bebas terdekat dari titik (cincin membesar).
  nearestFree(x, y, maxR = 40) {
    const [cx, cy] = this.cellOf(x, y);
    if (!this.blocked[this.idx(cx, cy)]) return [cx, cy];
    for (let r = 1; r <= maxR; r++) {
      let best = null;
      let bd = Infinity;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows || this.blocked[this.idx(nx, ny)]) continue;
        const d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = [nx, ny]; }
      }
      if (best) return best;
    }
    return null;
  }

  // Jalur dari (sx,sy) ke (tx,ty): daftar titik dunia. Bila tujuan tak terjangkau, menuju titik terjangkau terdekat.
  find(sx, sy, tx, ty) {
    const s = this.nearestFree(sx, sy);
    const g0 = this.nearestFree(tx, ty);
    if (!s || !g0) return [];
    const { cols, rows, blocked } = this;
    const gi = this.idx(g0[0], g0[1]);
    const si = this.idx(s[0], s[1]);
    const gScore = new Float32Array(cols * rows).fill(Infinity);
    const from = new Int32Array(cols * rows).fill(-1);
    const closed = new Uint8Array(cols * rows);
    const hOf = (i) => { const x = i % cols; const y = (i / cols) | 0; const dx = Math.abs(x - g0[0]); const dy = Math.abs(y - g0[1]); return (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy); };
    const heap = [[hOf(si), si]];
    gScore[si] = 0;
    const push = (e) => { heap.push(e); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0]; const last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let l = 2 * i + 1; const r = l + 1; if (l >= heap.length) break; if (r < heap.length && heap[r][0] < heap[l][0]) l = r; if (heap[i][0] <= heap[l][0]) break; [heap[i], heap[l]] = [heap[l], heap[i]]; i = l; } } return top; };
    let best = si;
    let bestH = hOf(si);
    let found = false;
    while (heap.length) {
      const [, cur] = pop();
      if (closed[cur]) continue;
      closed[cur] = 1;
      const h = hOf(cur);
      if (h < bestH) { bestH = h; best = cur; }
      if (cur === gi) { found = true; break; }
      const cx = cur % cols;
      const cy = (cur / cols) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const ni = ny * cols + nx;
        if (blocked[ni] || closed[ni]) continue;
        if (dx && dy && (blocked[cy * cols + nx] || blocked[ny * cols + cx])) continue; // jangan memotong sudut
        const ng = gScore[cur] + (dx && dy ? Math.SQRT2 : 1);
        if (ng < gScore[ni]) { gScore[ni] = ng; from[ni] = cur; push([ng + hOf(ni), ni]); }
      }
    }
    let i = found ? gi : best;
    const cells = [];
    while (i !== -1) { cells.push(i); i = from[i]; }
    cells.reverse();
    const pts = cells.map((c) => this.center(c % cols, (c / cols) | 0));
    // tujuan sebenarnya bila bebas, supaya berhenti tepat di titik ketukan
    if (found && this.walkable(tx, ty)) pts[pts.length - 1] = { x: tx, y: ty };
    // haluskan: lompati titik yang bisa dilihat langsung
    const out = [];
    let a = { x: sx, y: sy };
    let k = 0;
    while (k < pts.length) {
      let far = k;
      for (let j = pts.length - 1; j > k; j--) { if (this.los(a.x, a.y, pts[j].x, pts[j].y)) { far = j; break; } }
      out.push(pts[far]);
      a = pts[far];
      k = far + 1;
    }
    return out;
  }
}
