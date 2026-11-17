'use strict';
// ============================================================
//  world.js — карта: генерація, предмети, будівлі, A*, кімнати,
//  температура, живлення, зони
// ============================================================
(function () {
  const D = RW.D, U = RW.U;
  const FLOORS = ['', 'floor_wood', 'floor_stone', 'floor_steel'];
  D.FLOORS = FLOORS;

  // Проста черга з пріоритетами (лінива, з дублікатами)
  class PQ {
    constructor() { this.k = []; this.v = []; }
    clear() { this.k.length = 0; this.v.length = 0; }
    get size() { return this.k.length; }
    push(key, val) {
      const k = this.k, v = this.v; let c = k.length; k.push(key); v.push(val);
      while (c > 0) { const p = (c - 1) >> 1; if (k[p] <= k[c]) break; const tk = k[p], tv = v[p]; k[p] = k[c]; v[p] = v[c]; k[c] = tk; v[c] = tv; c = p; }
    }
    pop() {
      const k = this.k, v = this.v; const top = v[0]; const lk = k.pop(), lv = v.pop();
      if (k.length > 0) {
        k[0] = lk; v[0] = lv; let p = 0; const n = k.length;
        for (;;) {
          const l = p * 2 + 1, r = l + 1; let m = p;
          if (l < n && k[l] < k[m]) m = l;
          if (r < n && k[r] < k[m]) m = r;
          if (m === p) break;
          const tk = k[p], tv = v[p]; k[p] = k[m]; v[p] = v[m]; k[m] = tk; v[m] = tv; p = m;
        }
      }
      return top;
    }
  }

  class Zone {
    constructor(type, id) {
      this.id = id || U.nextId(); this.type = type; this.cells = new Set(); this.name = '';
      this.filter = {}; this.crop = 'rice'; this.priority = 2; this.sow = true;
      for (const k in D.items) this.filter[k] = D.items[k].cat !== 'corpse' && k !== 'silver' ? true : (k === 'silver');
    }
    accepts(def) { return this.filter[def] !== false && D.items[def].cat !== 'corpse'; }
  }

  class GameMap {
    constructor(w, h) {
      this.w = w; this.h = h; const n = this.n = w * h;
      this.terrain = new Uint8Array(n);
      this.blk = new Uint8Array(n);
      this.floor = new Uint8Array(n);
      this.mroof = new Uint8Array(n);
      this.bld = new Array(n).fill(null);
      this.bp = new Array(n).fill(null);
      this.plant = new Array(n).fill(null);
      this.items = new Map();
      this.byDef = new Map();
      this.cost = new Float32Array(n);
      this.room = new Int16Array(n).fill(-1);
      this.rooms = [];
      this.zoneAt = new Array(n).fill(null);
      this.zones = [];
      this.desig = new Map();
      this.fires = new Map();
      this.buildings = [];
      this.blueprints = [];
      this.region = new Int32Array(n);
      this.regionDirty = true; this.roomsDirty = true; this.powerDirty = true; this.lightDirty = true;
      this.dirtyChunks = new Set();
      this.allDirty = true;
      this.lights = [];
      this.networks = [];
      this.groundVar = new Uint8Array(n);
      this._g = new Float32Array(n); this._par = new Int32Array(n); this._seen = new Int32Array(n); this._cl = new Int32Array(n); this._st = 0;
      this._pq = new PQ();
      this.seed = 0; this.biome = 'temperate';
      this.shore = new Uint8Array(n);
      this.decals = [];
    }
    idx(x, y) { return y * this.w + x; }
    inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
    X(i) { return i % this.w; }
    Y(i) { return (i / this.w) | 0; }
    chunkOf(i) { return ((this.Y(i) >> 4) * 16) + (this.X(i) >> 4); }
    markDirty(i) {
      const x = i % this.w, y = (i / this.w) | 0;
      const cx = x >> 4, cy = y >> 4;
      this.dirtyChunks.add(cy * 64 + cx);
      // сусідні чанки для тіней/країв
      if ((x & 15) === 0 && cx > 0) this.dirtyChunks.add(cy * 64 + cx - 1);
      if ((x & 15) === 15) this.dirtyChunks.add(cy * 64 + cx + 1);
      if ((y & 15) === 0 && cy > 0) this.dirtyChunks.add((cy - 1) * 64 + cx);
      if ((y & 15) === 15) this.dirtyChunks.add((cy + 1) * 64 + cx);
    }

    // ---------------- Генерація ----------------
    generate(p) {
      const w = this.w, h = this.h, seed = p.seed | 0;
      this.seed = seed; this.biome = p.biome;
      const bio = D.biomes[p.biome];
      const rnd = U.rng(seed ^ 0x9e3779b1);
      const cx = w / 2, cy = h / 2;
      const mtThr = 0.52 + (1 - p.mountain) * 0.30;
      const waterThr = 0.05 + p.water * 0.20;
      const riverW = p.water > 0.2 ? 0.006 + p.water * 0.016 : 0;
      const elev = new Float32Array(this.n);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x, nx = x / w, ny = y / h;
          const dc = Math.hypot(x - cx, y - cy);
          const fall = U.clamp(1 - (dc - 9) / 18, 0, 1);
          let e = U.fbm(nx * 4.2, ny * 4.2, seed, 5) - fall * 0.55;
          const edge = Math.min(x, y, w - 1 - x, h - 1 - y) / 12;
          e += (1 - U.clamp(edge, 0, 1)) * 0.12;
          elev[i] = e;
          const m = U.fbm(nx * 5 + 17, ny * 5 + 31, seed + 7, 4);
          let wv = U.fbm(nx * 3.4 + 50, ny * 3.4 + 9, seed + 13, 4) + fall * 0.6;
          const rv = Math.abs(ny - (0.3 + 0.4 * U.fbm(nx * 1.8, 0.5, seed + 99, 2) + 0.07 * Math.sin(nx * 9 + seed)));
          let t = 4;
          const g = U.fbm(nx * 9 + 3, ny * 9 + 8, seed + 33, 3);
          const r2 = U.fbm(nx * 7 + 40, ny * 7 + 11, seed + 55, 3);
          if (p.biome === 'arid') { t = m < 0.62 ? 2 : 4; if (g > 0.62) t = 3; if (r2 > 0.7 && m > 0.6) t = 5; }
          else if (p.biome === 'tundra') { t = r2 > 0.43 ? 6 : 4; if (g > 0.64) t = 3; if (m > 0.66 && r2 < 0.43) t = 5; }
          else { t = 4; if (g > 0.73) t = 3; if (m > 0.62 && r2 > 0.48) t = 5; if (m < 0.2) t = 3; }
          if (wv < waterThr) t = wv < waterThr - 0.045 ? 0 : 1;
          if (riverW && fall < 0.3) { if (rv < riverW * 0.45) t = 0; else if (rv < riverW) t = 1; }
          this.terrain[i] = t;
          this.groundVar[i] = (U.hash2(x, y, seed) * 256) | 0;
        }
      }
      // гори
      let mtn = 0;
      for (let i = 0; i < this.n; i++) {
        if (elev[i] > mtThr && this.terrain[i] > 1) { this.blk[i] = 1; this.terrain[i] = 7; this.mroof[i] = 1; mtn++; }
      }
      if (mtn < 60) { // гарантуємо хоча б невеликий масив
        const bx = rnd() < 0.5 ? 8 : w - 9, by = rnd() < 0.5 ? 8 : h - 9;
        for (let y = -7; y <= 7; y++) for (let x = -7; x <= 7; x++) {
          const xx = bx + x, yy = by + y; if (!this.inb(xx, yy)) continue;
          if (Math.hypot(x, y) + rnd() * 2 < 7) { const i = yy * w + xx; this.blk[i] = 1; this.terrain[i] = 7; this.mroof[i] = 1; }
        }
      }
      // руда
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x; if (this.blk[i] !== 1) continue;
        const s = U.fbm(x * 0.22, y * 0.22, seed + 21, 3), si = U.fbm(x * 0.28 + 9, y * 0.28, seed + 29, 3), go = U.fbm(x * 0.3 + 5, y * 0.3 + 5, seed + 37, 3);
        if (go > 0.74) this.blk[i] = 4; else if (si > 0.69) this.blk[i] = 3; else if (s > 0.62) this.blk[i] = 2; else if (U.hash2(x, y, seed + 55) < 0.022) this.blk[i] = 5;
      }
      // берег
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x; if (this.terrain[i] > 1) continue;
        let near = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (this.inb(xx, yy) && this.terrain[yy * w + xx] > 1 && this.blk[yy * w + xx] === 0) near = 1; }
        this.shore[i] = near;
      }
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x; if (this.terrain[i] < 2 || this.terrain[i] === 7) continue;
        let nw = 0;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; if (this.inb(xx, yy) && this.terrain[yy * w + xx] <= 1) nw = 1; }
        if (nw && p.biome !== 'tundra' && U.hash2(x, y, seed + 5) < 0.85) this.terrain[i] = 2;
      }
      // розчистка стартової ділянки
      for (let y = -7; y <= 7; y++) for (let x = -7; x <= 7; x++) {
        const xx = Math.floor(cx) + x, yy = Math.floor(cy) + y; if (!this.inb(xx, yy)) continue;
        if (Math.hypot(x, y) > 7.5) continue;
        const i = yy * w + xx;
        if (this.blk[i] > 0 || this.terrain[i] <= 1 || this.terrain[i] === 7) { this.blk[i] = 0; this.mroof[i] = 0; this.terrain[i] = 4; }
      }
      // рослини
      const tdens = bio.treeDens * p.trees * 1.5;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (this.blk[i] > 0 || this.terrain[i] <= 1 || this.terrain[i] === 7) continue;
        const dc = Math.hypot(x - cx, y - cy);
        if (dc < 6) continue;
        const nz = U.fbm(x * 0.12, y * 0.12, seed + 5, 3);
        let pr = tdens * (nz > 0.5 ? 2.2 : 0.35) * (this.terrain[i] === 2 && p.biome !== 'arid' ? 0.15 : 1);
        if (this.terrain[i] === 6) pr *= 0.5;
        const r = rnd();
        if (r < pr) this.addPlant(U.rng(seed + i)() < 0.5 ? bio.trees[0] : bio.trees[Math.floor(rnd() * bio.trees.length)], x, y, 1);
        else if (r < pr + bio.bushes * (nz > 0.45 ? 2 : 0.6) && this.terrain[i] !== 2) this.addPlant('bush_berry', x, y, 1);
        else if (r > 0.9985 && this.terrain[i] >= 4) this.addPlant('wild_healroot', x, y, 1);
      }
      for (let i = 0; i < this.n; i++) this.updateCost(i);
      this.allDirty = true;
    }

    // ---------------- Вартість проходу ----------------
    updateCost(i) {
      const t = D.terrain[this.terrain[i]];
      if (t.walk === 0 || this.blk[i]) { this.cost[i] = 0; return; }
      let c = t.walk;
      const b = this.bld[i];
      if (b) { if (b.def.pass === 0) { this.cost[i] = 0; return; } if (b.def.pass === 2) c += 1.6; if (b.def.door) c += 0.3; }
      const p = this.plant[i];
      if (p) { const pd = D.plants[p.def]; if (pd.tree) { this.cost[i] = 0; return; } c += pd.crop ? 0.4 : 0.8; }
      this.cost[i] = c;
    }
    touch(i) { this.updateCost(i); this.markDirty(i); this.regionDirty = true; this.roomsDirty = true; }
    isBlockLos(i) { if (this.blk[i] > 0) return true; const b = this.bld[i]; return !!(b && (b.def.wall || b.def.door)); }

    // ---------------- Регіони й A* ----------------
    rebuildRegions() {
      const w = this.w, n = this.n, reg = this.region; reg.fill(0);
      let id = 0; const q = this._rq || (this._rq = new Int32Array(n));
      for (let s = 0; s < n; s++) {
        if (reg[s] || this.cost[s] === 0) continue;
        id++; let qh = 0, qt = 0; q[qt++] = s; reg[s] = id;
        while (qh < qt) {
          const c = q[qh++], x = c % w;
          if (x > 0 && !reg[c - 1] && this.cost[c - 1] > 0) { reg[c - 1] = id; q[qt++] = c - 1; }
          if (x < w - 1 && !reg[c + 1] && this.cost[c + 1] > 0) { reg[c + 1] = id; q[qt++] = c + 1; }
          if (c >= w && !reg[c - w] && this.cost[c - w] > 0) { reg[c - w] = id; q[qt++] = c - w; }
          if (c < n - w && !reg[c + w] && this.cost[c + w] > 0) { reg[c + w] = id; q[qt++] = c + w; }
        }
      }
      this.regionDirty = false;
    }
    regionOf(i) {
      if (this.regionDirty) this.rebuildRegions();
      if (this.region[i]) return this.region[i];
      const w = this.w, x = i % w;
      if (x > 0 && this.region[i - 1]) return this.region[i - 1];
      if (x < w - 1 && this.region[i + 1]) return this.region[i + 1];
      if (i >= w && this.region[i - w]) return this.region[i - w];
      if (i < this.n - w && this.region[i + w]) return this.region[i + w];
      return 0;
    }
    reachable(sx, sy, tx, ty, adj) {
      const s = this.regionOf(sy * this.w + sx); if (!s) return false;
      if (!adj) return this.regionOf(ty * this.w + tx) === s && this.cost[ty * this.w + tx] > 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x = tx + dx, y = ty + dy; if (!this.inb(x, y)) continue;
        const i = y * this.w + x; if (this.cost[i] > 0 && this.region[i] === s) return true;
      }
      return false;
    }
    // повертає масив індексів тайлів (без стартового) або null
    path(sx, sy, tx, ty, opt) {
      opt = opt || {};
      if (this.regionDirty) this.rebuildRegions();
      const w = this.w, h = this.h;
      sx = U.clamp(Math.floor(sx), 0, w - 1); sy = U.clamp(Math.floor(sy), 0, h - 1);
      const s = sy * w + sx, goal = ty * w + tx;
      const adj = !!opt.adj, breach = !!opt.breach, range = opt.range || 0;
      if (!breach) {
        const rs = this.regionOf(s); if (!rs) return null;
        let ok = false;
        if (adj || range) {
          const r = Math.max(1, Math.ceil(range));
          for (let dy = -r; dy <= r && !ok; dy++) for (let dx = -r; dx <= r; dx++) { const x = tx + dx, y = ty + dy; if (!this.inb(x, y)) continue; const i = y * w + x; if (this.cost[i] > 0 && this.region[i] === rs) { ok = true; break; } }
        } else ok = this.cost[goal] > 0 && this.region[goal] === rs;
        if (!ok) return null;
      }
      const cost = this.cost, g = this._g, par = this._par, seen = this._seen, cl = this._cl, pq = this._pq;
      const st = ++this._st; pq.clear();
      const bw = opt.breachCost || 20;
      const brk = (i) => { const b = this.bld[i]; return breach && this.blk[i] === 0 && b && (b.def.wall || b.def.door || b.def.pass === 0) && !b.def.wreck; };
      const isGoal = (c) => {
        if (adj) { const x = c % w, y = (c / w) | 0; return Math.abs(x - tx) <= 1 && Math.abs(y - ty) <= 1 && (cost[c] > 0 || c === s) && c !== goal; }
        if (range) { const x = c % w, y = (c / w) | 0; return Math.hypot(x - tx, y - ty) <= range && cost[c] > 0 && (!opt.los || this.los(x, y, tx, ty)); }
        return c === goal;
      };
      if (isGoal(s)) return [];
      const hf = (i) => { const dx = Math.abs((i % w) - tx), dy = Math.abs(((i / w) | 0) - ty); return (dx + dy) + (1.414 - 2) * Math.min(dx, dy); };
      g[s] = 0; par[s] = -1; seen[s] = st; pq.push(hf(s), s);
      let found = -1, iter = 0; const maxIter = opt.maxIter || 30000;
      const DX = [1, -1, 0, 0, 1, 1, -1, -1], DY = [0, 0, 1, -1, 1, -1, 1, -1];
      while (pq.size) {
        const c = pq.pop();
        if (cl[c] === st) continue;
        cl[c] = st;
        if (isGoal(c)) { found = c; break; }
        if (++iter > maxIter) break;
        const cx = c % w, cy = (c / w) | 0;
        for (let d = 0; d < 8; d++) {
          const nx = cx + DX[d], ny = cy + DY[d];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = ny * w + nx; if (cl[ni] === st) continue;
          let cst = cost[ni];
          if (cst === 0) { if (brk(ni)) cst = bw; else continue; }
          if (d >= 4) {
            const a = cy * w + nx, b2 = ny * w + cx;
            if ((cost[a] === 0 && !brk(a)) || (cost[b2] === 0 && !brk(b2))) continue;
            cst *= 1.414;
          }
          const ng = g[c] + cst;
          if (seen[ni] !== st || ng < g[ni]) { seen[ni] = st; g[ni] = ng; par[ni] = c; pq.push(ng + hf(ni), ni); }
        }
      }
      if (found < 0) return null;
      const out = []; let c = found;
      while (c !== s && c >= 0) { out.push(c); c = par[c]; }
      out.reverse(); return out;
    }
    los(x0, y0, x1, y1) {
      x0 = Math.floor(x0); y0 = Math.floor(y0); x1 = Math.floor(x1); y1 = Math.floor(y1);
      let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx - dy;
      let x = x0, y = y0, n = 0;
      while (n++ < 200) {
        if ((x !== x0 || y !== y0) && (x !== x1 || y !== y1)) { if (this.isBlockLos(y * this.w + x)) return false; }
        if (x === x1 && y === y1) return true;
        const e2 = err * 2;
        if (e2 > -dy) { err -= dy; x += sx; }
        if (e2 < dx) { err += dx; y += sy; }
      }
      return true;
    }
    // клітини навколо прямокутника (по 4 сторонах), тільки прохідні
    adjTiles(x, y, w, h) {
      const out = [];
      for (let dx = 0; dx < w; dx++) { out.push([x + dx, y - 1]); out.push([x + dx, y + h]); }
      for (let dy = 0; dy < h; dy++) { out.push([x - 1, y + dy]); out.push([x + w, y + dy]); }
      return out.filter(t => this.inb(t[0], t[1]) && this.cost[t[1] * this.w + t[0]] > 0);
    }

    // ---------------- Рослини ----------------
    addPlant(def, x, y, growth) {
      const i = y * this.w + x; if (this.plant[i]) return null;
      const pd = D.plants[def];
      const p = { id: U.nextId(), def, x, y, growth: growth == null ? 0 : growth, hp: pd.hp || 20, age: 0, v: (U.hash2(x, y, 7) * 1000) | 0 };
      this.plant[i] = p; this.touch(i); return p;
    }
    removePlant(i) { if (!this.plant[i]) return; this.plant[i] = null; this.touch(i); }

    // ---------------- Предмети ----------------
    itemsAt(i) { return this.items.get(i) || null; }
    _register(it) { let s = this.byDef.get(it.def); if (!s) { s = new Set(); this.byDef.set(it.def, s); } s.add(it); }
    _unregister(it) { const s = this.byDef.get(it.def); if (s) s.delete(it); }
    _putStack(it, i) {
      it.i = i; let arr = this.items.get(i); if (!arr) { arr = []; this.items.set(i, arr); }
      arr.push(it); this._register(it); this.markDirtyItem(i);
    }
    markDirtyItem(i) { this.itemsDirty = true; }
    tileAcceptsItem(i, def) {
      if (this.cost[i] === 0 && !(this.bld[i] && this.bld[i].def.pass !== 0)) return false;
      if (this.terrain[i] <= 1) return false;
      const arr = this.items.get(i);
      if (!arr || arr.length === 0) return true;
      // дозволяємо лише однакові предмети в клітині
      const stack = D.items[def].stack;
      for (const it of arr) { if (it.def !== def || it.n >= stack) return false; }
      return true;
    }
    // Додає предмет біля (x,y), повертає останній створений об'єкт
    addItem(def, n, x, y, opts) {
      opts = opts || {}; const d = D.items[def]; if (!d || n <= 0) return null;
      x = Math.floor(x); y = Math.floor(y);
      let last = null, left = n;
      // спіральний пошук
      const tryTile = (i) => {
        if (left <= 0) return;
        if (!this.tileAcceptsItem(i, def)) return;
        const arr = this.items.get(i);
        if (arr && arr.length) {
          for (const it of arr) { const room = d.stack - it.n; if (room > 0) { const add = Math.min(room, left); it.n += add; left -= add; last = it; if (left <= 0) return; } }
        }
        while (left > 0 && (!this.items.get(i) || this.items.get(i).length === 0 || (this.items.get(i)[0].def === def && this.items.get(i)[0].n >= d.stack && false))) {
          const add = Math.min(d.stack, left);
          const it = { id: U.nextId(), def, n: add, i, forbid: !!opts.forbid, age: opts.age || 0, res: null, data: opts.data || null };
          this._putStack(it, i); last = it; left -= add; break;
        }
      };
      for (let r = 0; r < 14 && left > 0; r++) {
        for (let dy = -r; dy <= r && left > 0; dy++) for (let dx = -r; dx <= r && left > 0; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const xx = x + dx, yy = y + dy; if (!this.inb(xx, yy)) continue;
          tryTile(yy * this.w + xx);
        }
      }
      if (left > 0) { const i = y * this.w + x; const it = { id: U.nextId(), def, n: left, i, forbid: false, age: 0, res: null, data: opts.data || null }; this._putStack(it, i); last = it; }
      return last;
    }
    // Забирає count з предмета (повертає реально взяте)
    takeItem(it, count) {
      count = Math.min(count, it.n); if (count <= 0) return 0;
      it.n -= count;
      if (it.n <= 0) this.removeItem(it);
      return count;
    }
    removeItem(it) {
      const arr = this.items.get(it.i);
      if (arr) { const k = arr.indexOf(it); if (k >= 0) arr.splice(k, 1); if (arr.length === 0) this.items.delete(it.i); }
      this._unregister(it); it.dead = true; it.n = 0;
    }
    count(def, includeForbid) {
      const s = this.byDef.get(def); if (!s) return 0; let c = 0;
      for (const it of s) if (includeForbid || !it.forbid) c += it.n;
      return c;
    }
    // Найближчий предмет, що відповідає pred
    findItem(defs, x, y, pred, maxD) {
      let best = null, bd = maxD || 1e9; const w = this.w;
      const list = Array.isArray(defs) ? defs : [defs];
      for (const d of list) {
        const s = this.byDef.get(d); if (!s) continue;
        for (const it of s) {
          if (it.forbid || it.res || it.dead) continue;
          if (pred && !pred(it)) continue;
          const dd = Math.abs((it.i % w) - x) + Math.abs(((it.i / w) | 0) - y);
          if (dd < bd) { bd = dd; best = it; }
        }
      }
      return best;
    }

    // ---------------- Будівлі ----------------
    footprint(defKey, x, y, rot) {
      const d = D.bld[defKey]; let w = d.w, h = d.h; if (rot) { const t = w; w = h; h = t; }
      return { w, h };
    }
    canPlace(defKey, x, y, rot, opts) {
      opts = opts || {};
      const d = D.bld[defKey]; const f = this.footprint(defKey, x, y, rot);
      for (let dy = 0; dy < f.h; dy++) for (let dx = 0; dx < f.w; dx++) {
        const xx = x + dx, yy = y + dy;
        if (!this.inb(xx, yy)) return 'Поза картою';
        const i = yy * this.w + xx;
        const t = D.terrain[this.terrain[i]];
        if (!t.build) return 'Не можна будувати на воді';
        if (this.blk[i] > 0) return 'Зайнято скелею';
        const pl = this.plant[i]; if (pl && D.plants[pl.def].tree) return 'Зайнято деревом';
        if (this.bp[i] && !opts.ignoreBp) return 'Вже є креслення';
        if (d.floor) { const b = this.bld[i]; if (b && b.def.floor) return 'Вже підлога'; if (this.floor[i] === FLOORS.indexOf(defKey)) return 'Така підлога вже є'; }
        else {
          if (this.bld[i]) return 'Зайнято будівлею';
          if (d.door || d.wall) { /* можна на підлозі */ }
        }
        if (d.door && !d.floor) {
          // двері лише між двома стінами по осі
          const wl = this.bld[i - 1] && this.bld[i - 1].def.wall, wr = this.bld[i + 1] && this.bld[i + 1].def.wall;
          const wu = this.bld[i - this.w] && this.bld[i - this.w].def.wall, wd = this.bld[i + this.w] && this.bld[i + this.w].def.wall;
          const bl = (this.bp[i - 1] && this.bp[i - 1].def.startsWith('wall')), br = (this.bp[i + 1] && this.bp[i + 1].def.startsWith('wall'));
          const bu = (this.bp[i - this.w] && this.bp[i - this.w].def.startsWith('wall')), bd = (this.bp[i + this.w] && this.bp[i + this.w].def.startsWith('wall'));
          const solid = j => (this.blk[j] > 0);
          const hor = ((wl || bl || solid(i - 1)) && (wr || br || solid(i + 1)));
          const ver = ((wu || bu || solid(i - this.w)) && (wd || bd || solid(i + this.w)));
          if (!hor && !ver) return 'Двері — між двома стінами';
        }
        if (defKey === 'solar' || d.fuel === undefined) { /* ok */ }
      }
      return null;
    }
    addBlueprint(defKey, x, y, rot) {
      const d = D.bld[defKey]; const f = this.footprint(defKey, x, y, rot);
      const need = {}; for (const k in d.cost) if (d.cost[k] > 0) need[k] = d.cost[k];
      const bp = { id: U.nextId(), isBp: true, def: defKey, x, y, w: f.w, h: f.h, rot: rot || 0, need, have: {}, work: 0, total: d.work, hp: 1 };
      for (let dy = 0; dy < f.h; dy++) for (let dx = 0; dx < f.w; dx++) { const i = (y + dy) * this.w + x + dx; this.bp[i] = bp; this.markDirty(i); }
      this.blueprints.push(bp); return bp;
    }
    removeBlueprint(bp) {
      for (let dy = 0; dy < bp.h; dy++) for (let dx = 0; dx < bp.w; dx++) { const i = (bp.y + dy) * this.w + bp.x + dx; if (this.bp[i] === bp) { this.bp[i] = null; this.markDirty(i); } }
      const k = this.blueprints.indexOf(bp); if (k >= 0) this.blueprints.splice(k, 1);
      bp.dead = true;
    }
    addBuilding(defKey, x, y, rot, extra) {
      const d = D.bld[defKey]; const f = this.footprint(defKey, x, y, rot);
      const b = { id: U.nextId(), def: d, key: defKey, x, y, w: f.w, h: f.h, rot: rot || 0, hp: d.hp, maxhp: d.hp, bills: [], fuel: d.fuel ? 0 : null, buf: {}, owner: null, on: true, door: d.door ? { open: 0 } : null, charge: 0, res: null, age: 0 };
      if (extra) Object.assign(b, extra);
      if (d.floor) {
        const fi = FLOORS.indexOf(defKey);
        for (let dy = 0; dy < f.h; dy++) for (let dx = 0; dx < f.w; dx++) { const i = (y + dy) * this.w + x + dx; this.floor[i] = fi; this.markDirty(i); }
        this.roomsDirty = true; return b;
      }
      for (let dy = 0; dy < f.h; dy++) for (let dx = 0; dx < f.w; dx++) { const i = (y + dy) * this.w + x + dx; this.bld[i] = b; const pl = this.plant[i]; if (pl && !D.plants[pl.def].tree) this.plant[i] = null; this.touch(i); }
      this.buildings.push(b); this.powerDirty = true; this.lightDirty = true;
      return b;
    }
    removeBuilding(b) {
      for (let dy = 0; dy < b.h; dy++) for (let dx = 0; dx < b.w; dx++) { const i = (b.y + dy) * this.w + b.x + dx; if (this.bld[i] === b) { this.bld[i] = null; this.touch(i); } }
      const k = this.buildings.indexOf(b); if (k >= 0) this.buildings.splice(k, 1);
      b.dead = true; this.powerDirty = true; this.lightDirty = true; this.roomsDirty = true;
    }
    buildingsOf(key) { return this.buildings.filter(b => b.key === key); }

    // ---------------- Кімнати та температура ----------------
    rebuildRooms(outT) {
      const w = this.w, h = this.h, n = this.n;
      const oldRoom = this.room, oldRooms = this.rooms;
      const nr = new Int16Array(n).fill(-1); const rooms = [];
      const vis = this._rv || (this._rv = new Uint8Array(n)); vis.fill(0); const q = this._rq || (this._rq = new Int32Array(n));
      const isB = i => this.blk[i] > 0 || (this.bld[i] && (this.bld[i].def.wall || this.bld[i].def.door));
      for (let s = 0; s < n; s++) {
        if (vis[s] || isB(s)) continue;
        let qh = 0, qt = 0; q[qt++] = s; vis[s] = 1; let edge = false;
        while (qh < qt) {
          const c = q[qh++], x = c % w, y = (c / w) | 0;
          if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge = true;
          if (x > 0 && !vis[c - 1] && !isB(c - 1)) { vis[c - 1] = 1; q[qt++] = c - 1; }
          if (x < w - 1 && !vis[c + 1] && !isB(c + 1)) { vis[c + 1] = 1; q[qt++] = c + 1; }
          if (y > 0 && !vis[c - w] && !isB(c - w)) { vis[c - w] = 1; q[qt++] = c - w; }
          if (y < h - 1 && !vis[c + w] && !isB(c + w)) { vis[c + w] = 1; q[qt++] = c + w; }
        }
        if (!edge && qt <= 350) {
          const cells = Array.from(q.subarray(0, qt)); const id = rooms.length;
          let tsum = 0, beauty = 0; const doors = new Set();
          for (const c of cells) {
            nr[c] = id;
            const orm = oldRoom[c]; tsum += orm >= 0 && oldRooms[orm] ? oldRooms[orm].temp : outT;
            beauty += this.cellBeauty(c);
            const x = c % w, y = (c / w) | 0;
            for (const nb of [c - 1, c + 1, c - w, c + w]) { if (nb >= 0 && nb < n) { const bb = this.bld[nb]; if (bb && bb.def.door) doors.add(bb.id); } }
          }
          rooms.push({ id, cells, size: cells.length, temp: tsum / cells.length, beauty, doors: doors.size, heat: 0 });
        }
      }
      this.room = nr; this.rooms = rooms; this.roomsDirty = false;
      for (const r of rooms) r.beautyAvg = r.beauty / r.size;
    }
    cellBeauty(i) {
      let b = 0.0;
      const bl = this.bld[i]; if (bl) b += bl.def.beauty || 0;
      const fl = this.floor[i]; if (fl) b += D.bld[FLOORS[fl]].beauty;
      else if (this.terrain[i] === 7) b -= 0.3;
      if (this.plant[i] && D.plants[this.plant[i].def].tree) b += 0.5;
      return b;
    }
    isRoofed(i) { return this.room[i] >= 0 || this.mroof[i] === 1; }
    tempAt(i, outT) {
      const r = this.room[i];
      if (r >= 0 && this.rooms[r]) return this.rooms[r].temp;
      const b = this.bld[i];
      if (b && b.def.door) {
        const w = this.w; let s = 0, c = 0;
        for (const nb of [i - 1, i + 1, i - w, i + w]) { const rr = this.room[nb]; if (rr >= 0 && this.rooms[rr]) { s += this.rooms[rr].temp; c++; } }
        if (c) return (s + outT) / (c + 1);
        return outT;
      }
      if (this.mroof[i]) return 0.35 * outT + 0.65 * 14;
      return outT;
    }
    isActive(b) {
      const d = b.def;
      if (d.fuel && !(b.fuel > 0)) return false;
      if (d.power && d.power < 0 && !b.on) return false;
      if (d.power && d.power > 0 && d.fuel && !(b.fuel > 0)) return false;
      return true;
    }
    updateTemps(dt, outT) {
      const w = this.w;
      for (const r of this.rooms) r.heat = 0;
      for (const b of this.buildings) {
        if (!b.def.heat) continue;
        const i = b.y * w + b.x; const r = this.room[i];
        if (r >= 0 && this.isActive(b)) this.rooms[r].heat += b.def.heat * 0.4;
      }
      for (const r of this.rooms) {
        const leak = 0.0009 * (1 + r.doors * 0.3);
        r.temp += ((outT - r.temp) * leak + r.heat / r.size) * dt;
        r.temp = U.clamp(r.temp, -60, 80);
      }
    }
    warmAt(x, y) { // локальне тепло від багать
      let wm = 0;
      for (const b of this.buildings) {
        if (!b.def.warm || !(b.fuel > 0)) continue;
        const d = Math.hypot(b.x - x, b.y - y);
        if (d < 5) wm = Math.max(wm, b.def.warm * (1 - d / 5));
      }
      return wm;
    }

    // ---------------- Світло ----------------
    rebuildLights() {
      this.lights = [];
      for (const b of this.buildings) {
        const l = b.def.light; if (!l) continue;
        this.lights.push({ b, x: b.x + b.w / 2, y: b.y + b.h / 2, r: l.r, c: l.c, a: l.a });
      }
      this.lightDirty = false;
    }
    // активні джерела світла кешуються на один тік (раніше кожен виклик перебирав усі лампи)
    activeLights() {
      const g = RW.G, t = g ? g.tick : -1;
      if (this._alT !== t || this._alSrc !== this.lights) {
        const out = []; for (const L of this.lights) if (this.isActive(L.b)) out.push(L);
        this._alC = out; this._alT = t; this._alSrc = this.lights;
      }
      return this._alC;
    }
    lightAt(x, y, daylight) {
      const i = Math.floor(y) * this.w + Math.floor(x);
      let v = this.isRoofed(i) ? 0.15 * daylight : daylight;
      const px = x + 0.5, py = y + 0.5;
      for (const L of this.activeLights()) {
        const dx = L.x - px, dy = L.y - py;
        if (dx >= L.r || dx <= -L.r || dy >= L.r || dy <= -L.r) continue;
        const d = Math.hypot(dx, dy);
        if (d < L.r) v += L.a * (1 - d / L.r);
      }
      return Math.min(1, v);
    }

    // ---------------- Енергомережа ----------------
    rebuildPower() {
      const nodes = this.buildings.filter(b => b.def.conduit || b.def.power || b.def.battery);
      const id = new Map(); nodes.forEach((b, k) => id.set(b, k));
      const parent = nodes.map((_, k) => k);
      const find = a => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
      const uni = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[a] = b; };
      const w = this.w;
      for (const b of nodes) {
        // сусіди по периметру
        const nbs = new Set();
        for (let dx = 0; dx < b.w; dx++) { nbs.add((b.y - 1) * w + b.x + dx); nbs.add((b.y + b.h) * w + b.x + dx); }
        for (let dy = 0; dy < b.h; dy++) { nbs.add((b.y + dy) * w + b.x - 1); nbs.add((b.y + dy) * w + b.x + b.w); }
        for (const t of nbs) {
          if (t < 0 || t >= this.n) continue; const o = this.bld[t]; if (!o || o === b || !id.has(o)) continue;
          if (b.def.conduit || o.def.conduit) uni(id.get(b), id.get(o));
        }
      }
      const groups = new Map();
      for (const b of nodes) { const r = find(id.get(b)); if (!groups.has(r)) groups.set(r, { members: [], stored: 0, sat: 0, prod: 0, cons: 0, cap: 0 }); groups.get(r).members.push(b); b.net = groups.get(r); }
      // зберігаємо заряд батарей
      this.networks = Array.from(groups.values());
      for (const g of this.networks) { for (const b of g.members) g.stored += b.charge || 0; }
      this.powerDirty = false;
    }
    updatePower(dt, daylight) {
      if (this.powerDirty) this.rebuildPower();
      for (const g of this.networks) {
        if (this.flare) { g.prod = 0; g.sat = 0; for (const b of g.members) if (b.def.power < 0) b.on = false; continue; }
        let prod = 0, cons = 0, cap = 0;
        for (const b of g.members) {
          const d = b.def;
          if (d.battery) cap += d.battery;
          if (d.power > 0) {
            if (d.solar) prod += d.power * Math.max(0, daylight) * (this.weatherMul || 1);
            else if (d.fuel) { if (b.fuel > 0) prod += d.power; }
            else prod += d.power;
          } else if (d.power < 0) {
            if (d.id === 'machining' && !b.working) continue;
            cons += -d.power;
          }
        }
        g.prod = prod; g.cons = cons; g.cap = cap;
        let avail = prod;
        const net = (prod - cons) * dt / 60;
        if (net >= 0) { g.stored = Math.min(cap, g.stored + net); g.sat = 1; }
        else if (cons > 0) {
          const need = -net;
          if (g.stored >= need) { g.stored -= need; g.sat = 1; }
          else { avail = prod + g.stored * 60 / dt; g.stored = 0; g.sat = U.clamp(avail / cons, 0, 1); }
        } else g.sat = 1;
        for (const b of g.members) { if (b.def.power < 0) b.on = g.sat >= 0.45; b.charge = cap ? g.stored * (b.def.battery || 0) / cap : 0; }
      }
      for (const b of this.buildings) { if (b.def.power < 0 && !b.net) b.on = false; }
    }
  }

  GameMap.Zone = Zone;
  RW.GameMap = GameMap;
  RW.Zone = Zone;
})();
