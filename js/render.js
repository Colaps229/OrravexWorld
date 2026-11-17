'use strict';
// ============================================================
//  render.js — камера, чанки, динамічний шар, освітлення, погода, частинки
// ============================================================
(function () {
  const D = RW.D, U = RW.U, GFX = RW.GFX;
  const TS = 32;
  const R = RW.R = {};
  const G = () => RW.G;

  R.cam = { x: 50, y: 50, zoom: 1.2, tx: null };
  R.shake = 0; R.time = 0; R.drawMs = 0;
  const chunks = new Map(); let chunkSeq = 0;
  // Кеш землі для віддаленого масштабу: усі чанки зводяться в один кадр-полотно і далі копіюються 1:1
  let gc = null;
  const parts = [], texts = [], pods = [], rings = [];
  let canvas, ctx, lc, lctx, W = 0, H = 0, dpr = 1;
  R.stats = { fps: 0, frames: 0, last: 0 };

  R.init = function (cv) {
    canvas = cv; ctx = cv.getContext('2d', { alpha: false });
    lc = document.createElement('canvas'); lctx = lc.getContext('2d');
    R.canvas = cv; R.ctx = ctx;
    R.resize();
    window.addEventListener('resize', R.resize);
  };
  R.resize = function () {
    const S = RW.S ? RW.S.gfx : { res: 1 };
    dpr = Math.min(window.devicePixelRatio || 1, 2) * (S.res || 1);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.max(1, Math.round(W * dpr)); canvas.height = Math.max(1, Math.round(H * dpr));
    R.W = W; R.H = H;
  };
  R.reset = function () { gc = null; chunks.clear(); parts.length = 0; texts.length = 0; pods.length = 0; rings.length = 0; };

  R.toScreen = function (tx, ty) { const z = R.cam.zoom * TS; return [W / 2 + (tx - R.cam.x) * z, H / 2 + (ty - R.cam.y) * z]; };
  R.toTile = function (sx, sy) { const z = R.cam.zoom * TS; return [R.cam.x + (sx - W / 2) / z, R.cam.y + (sy - H / 2) / z]; };
  R.clampCam = function () {
    const g = G(); if (!g || !g.map) return; const c = R.cam;
    // не показуємо порожнечу за краєм карти: мінімальний масштаб — коли карта якраз заповнює екран
    const zmin = Math.min(3.2, Math.max(0.45, W / (g.map.w * TS), H / (g.map.h * TS)));
    c.zoom = U.clamp(c.zoom, zmin, 3.2);
    const hx = Math.min(g.map.w / 2, W / (2 * c.zoom * TS)), hy = Math.min(g.map.h / 2, H / (2 * c.zoom * TS));
    c.x = U.clamp(c.x, hx, g.map.w - hx); c.y = U.clamp(c.y, hy, g.map.h - hy);
  };

  // ---------------------------------------------------------------
  //  Чанки (статичний шар землі)
  // ---------------------------------------------------------------
  const RANK = { 0: 0, 1: 1, 2: 2, 3: 3, 7: 3.5, 6: 4, 4: 5, 5: 6 };
  function buildChunk(map, cx, cy) {
    const key = cy * 64 + cx; const S = 16;
    let ch = chunks.get(key);
    if (!ch) { ch = { c: GFX.mk(S * TS, S * TS) }; chunks.set(key, ch); }
    ch.stale = false; ch.v = ++chunkSeq;
    const x = ch.c.getContext('2d'); x.clearRect(0, 0, S * TS, S * TS);
    const w = map.w, h = map.h;
    for (let ty = 0; ty < S; ty++) for (let tx = 0; tx < S; tx++) {
      const mx = cx * S + tx, my = cy * S + ty; if (mx >= w || my >= h) continue;
      const i = my * w + mx; const px = tx * TS, py = ty * TS; const v = map.groundVar[i] & 3;
      const t = map.terrain[i]; const blk = map.blk[i];
      if (blk > 0) { drawRock(x, map, mx, my, i, px, py, v, blk); continue; }
      const tex = GFX.terr[t]; x.drawImage(tex[v % tex.length], px, py);
      // плавні межі
      const rk = RANK[t];
      const nbs = [[0, -1, 0], [1, 0, 1], [0, 1, 2], [-1, 0, 3]];
      for (const [dx, dy, side] of nbs) {
        const nx = mx + dx, ny = my + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx; if (map.blk[ni] > 0) continue; const nt = map.terrain[ni]; if (nt === t) continue;
        if (t <= 1 && nt <= 1) continue;
        if (RANK[nt] > rk && !(t <= 1)) { blobEdge(x, mx, my, px, py, side, nt, v); edgeBlend(x, px, py, side, GFX.terrAvg[nt], 5, 0.3); }
        else if (t <= 1 && nt > 1) { // піна біля берега
          x.fillStyle = t === 0 ? 'rgba(120,170,200,0.32)' : 'rgba(255,255,255,0.28)';
          if (side === 0) x.fillRect(px, py, TS, 3); else if (side === 1) x.fillRect(px + TS - 3, py, 3, TS); else if (side === 2) x.fillRect(px, py + TS - 3, TS, 3); else x.fillRect(px, py, 3, TS);
          edgeBlend(x, px, py, side, GFX.terrAvg[nt], 5, 0.55);
        } else if (t > 1 && nt <= 1) { // мокрий край
          edgeBlend(x, px, py, side, '#3a3a2a', 4, 0.35);
        }
      }
      // підлога
      const f = map.floor[i];
      if (f) { const ft = GFX.floorTex[f]; x.drawImage(ft[v], px, py); x.strokeStyle = 'rgba(0,0,0,0.18)'; x.lineWidth = 1; x.strokeRect(px + 0.5, py + 0.5, TS - 1, TS - 1); }
      // тіні від скель та стін
      shadowFrom(x, map, mx, my, px, py);
      // ландшафтний декор
      if (!map.floor[i] && !map.bld[i]) decorTile(x, map, mx, my, px, py, t);
    }
    macroPass(x, map, cx, cy);
    ch.dirty = false;
  }
  function macroPass(x, map, cx, cy) {
    const S = 16, w = map.w, seed = map.seed | 0; const bio = (G() && G().biome) || 'temperate'; const arid = bio === 'arid';
    for (let gy = -1; gy <= S * 2; gy++) for (let gx = -1; gx <= S * 2; gx++) {
      const px = gx * 16 + 8, py = gy * 16 + 8; const mx = cx * S + Math.floor(gx / 2), my = cy * S + Math.floor(gy / 2); if (mx >= w || my >= map.h || mx < 0 || my < 0) continue;
      const i = my * w + mx; if (map.blk[i] > 0 || map.floor[i]) continue; const t = map.terrain[i]; if (t < 2 || t === 7) continue;
      const wx = cx * S * 2 + gx, wy = cy * S * 2 + gy;
      const n = U.fbm(wx * 0.045 + 3, wy * 0.045 + 9, seed + 303, 4) - 0.5; const m2 = U.fbm(wx * 0.13, wy * 0.13, seed + 707, 2) - 0.5;
      let col = null, a = 0;
      if (t === 4 || t === 5) { if (n > 0.04) { col = arid ? '110,90,40' : '8,60,18'; a = (n - 0.04) * 1.5; } else if (n < -0.05) { col = arid ? '215,185,115' : '205,195,95'; a = (-0.05 - n) * 1.3; } if (m2 > 0.1) { x.fillStyle = 'rgba(255,255,200,' + ((m2 - 0.1) * 0.35).toFixed(3) + ')'; x.beginPath(); x.arc(px, py, 14, 0, 6.3); x.fill(); } }
      else if (t === 2) { if (n > 0) { col = '255,240,200'; a = n * 0.9; } else { col = '150,100,40'; a = -n * 0.7; } }
      else if (t === 6) { if (n > 0) { col = '255,255,255'; a = n * 0.7; } else { col = '140,170,215'; a = -n * 0.7; } }
      else if (t === 3) { col = n > 0 ? '255,255,255' : '0,0,0'; a = Math.abs(n) * 0.35; }
      if (col && a > 0.01) { a = Math.min(a, 0.26); const gr = x.createRadialGradient(px, py, 0, px, py, 19); gr.addColorStop(0, 'rgba(' + col + ',' + a.toFixed(3) + ')'); gr.addColorStop(1, 'rgba(' + col + ',0)'); x.fillStyle = gr; x.fillRect(px - 19, py - 19, 38, 38); }
    }
  }
  function decorTile(x, map, mx, my, px, py, t) {
    const seed = map.seed | 0; const r = U.rng((((mx * 73856093) ^ (my * 19349663) ^ (seed * 83492791)) >>> 0) || 1); const bio = (G() && G().biome) || 'temperate';
    const base = GFX.terrAvg[t] || '#4a7a3a'; const arid = bio === 'arid', tund = bio === 'tundra', trop = bio === 'tropical';
    const n1 = U.fbm(mx * 0.06 + 11, my * 0.06 + 5, seed + 303, 3), n2 = U.fbm(mx * 0.17, my * 0.17, seed + 505, 2);
    if (t === 4 || t === 5) {
      // пучки трави
      const tufts = 1 + ((r() * (n2 > 0.5 ? 3.4 : 2.2)) | 0);
      for (let k = 0; k < tufts; k++) {
        const bx = px + 4 + r() * 24, by = py + 12 + r() * 17, nb = 4 + ((r() * 4) | 0), tone = r();
        x.fillStyle = 'rgba(0,0,0,0.13)'; x.beginPath(); x.ellipse(bx + 1, by + 0.5, 3.2, 1.1, 0, 0, 6.3); x.fill();
        for (let b = 0; b < nb; b++) {
          const hh = 4 + r() * 6, lean = (b - nb / 2) * 0.8 + (r() - 0.5) * 1.6, ox = bx + (b - nb / 2) * 0.9;
          const c1 = U.shade(base, -0.28 + tone * 0.1), c2 = U.shade(base, 0.22 + r() * 0.2 + (arid ? 0.1 : 0));
          const gr = x.createLinearGradient(0, by, 0, by - hh); gr.addColorStop(0, c1); gr.addColorStop(1, c2); x.strokeStyle = gr; x.lineWidth = 1.05;
          x.beginPath(); x.moveTo(ox, by); x.quadraticCurveTo(ox + lean * 0.3, by - hh * 0.6, ox + lean, by - hh); x.stroke();
        }
      }
      // квіти
      if (!arid && !tund && r() < (trop ? 0.1 : 0.075)) {
        const fc = U.pick ? ['#f4e04a', '#ffffff', '#e8798f', '#9fb4f4', '#c88af0', '#ff9a4a'][(r() * 6) | 0] : '#fff'; const fx0 = px + 5 + r() * 20, fy0 = py + 9 + r() * 17;
        for (let k = 0; k < 3 + ((r() * 3) | 0); k++) { const fx = fx0 + (r() - 0.5) * 8, fy = fy0 + (r() - 0.5) * 6; x.strokeStyle = '#2f6a2a'; x.lineWidth = 0.9; x.beginPath(); x.moveTo(fx, fy + 3); x.lineTo(fx, fy); x.stroke(); x.fillStyle = fc; for (let q = 0; q < 5; q++) { const a = q * 1.256; x.beginPath(); x.arc(fx + Math.cos(a) * 1.3, fy + Math.sin(a) * 1.3, 0.9, 0, 6.3); x.fill(); } x.fillStyle = '#e8a020'; x.fillRect(fx - 0.5, fy - 0.5, 1.2, 1.2); }
      }
      // камінці, гриби, опале листя
      if (r() < 0.06) { const sx = px + 4 + r() * 24, sy = py + 8 + r() * 20, sr = 1.4 + r() * 1.8; x.fillStyle = 'rgba(0,0,0,0.3)'; x.beginPath(); x.ellipse(sx + 1, sy + sr * 0.6, sr * 1.2, sr * 0.6, 0, 0, 6.3); x.fill(); x.fillStyle = '#8c8a84'; x.beginPath(); x.ellipse(sx, sy, sr, sr * 0.75, 0, 0, 6.3); x.fill(); x.fillStyle = 'rgba(255,255,255,0.4)'; x.fillRect(sx - sr * 0.5, sy - sr * 0.5, sr * 0.8, 1); }
      if (!arid && r() < 0.012) { const sx = px + 6 + r() * 20, sy = py + 12 + r() * 14; x.fillStyle = '#e8e0d0'; x.fillRect(sx, sy, 1.2, 2.4); x.fillStyle = '#c0392b'; x.beginPath(); x.ellipse(sx + 0.6, sy, 2.4, 1.5, 0, Math.PI, 0); x.fill(); x.fillStyle = '#fff'; x.fillRect(sx - 0.6, sy - 1, 0.8, 0.8); x.fillRect(sx + 1.4, sy - 0.6, 0.8, 0.8); }
      if (r() < 0.05) { x.fillStyle = r() < 0.5 ? 'rgba(190,120,40,0.55)' : 'rgba(150,70,30,0.5)'; x.beginPath(); x.ellipse(px + 4 + r() * 24, py + 4 + r() * 24, 1.8, 0.9, r() * 3, 0, 6.3); x.fill(); }
    } else if (t === 2) { // пісок: хвилі та тіні
      if (r() < 0.55) { const yy = py + 6 + r() * 20; x.strokeStyle = 'rgba(120,80,30,0.2)'; x.lineWidth = 1; x.beginPath(); x.moveTo(px + 2, yy); x.quadraticCurveTo(px + 16, yy - 3 - r() * 3, px + 30, yy + r() * 2); x.stroke(); x.strokeStyle = 'rgba(255,250,220,0.25)'; x.beginPath(); x.moveTo(px + 2, yy + 1.5); x.quadraticCurveTo(px + 16, yy - 1.5, px + 30, yy + 2); x.stroke(); }
      if (r() < 0.05) { const sx = px + 6 + r() * 20, sy = py + 8 + r() * 18; x.fillStyle = '#f3e8d8'; x.beginPath(); x.arc(sx, sy, 1.8, 0, 6.3); x.fill(); x.strokeStyle = '#b89a78'; x.lineWidth = 0.6; x.beginPath(); x.arc(sx, sy, 1.1, 0, 6.3); x.stroke(); }
      if (arid && r() < 0.05) { const sx = px + 8 + r() * 16, sy = py + 12 + r() * 14; x.strokeStyle = '#7a6a38'; x.lineWidth = 1; for (let b = 0; b < 6; b++) { x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + (b - 2.5) * 1.8, sy - 4 - r() * 3); x.stroke(); } }
    } else if (t === 3) { // гравій
      x.fillStyle = n2 > 0.5 ? 'rgba(255,255,255,' + ((n2 - 0.5) * 0.14).toFixed(3) + ')' : 'rgba(0,0,0,' + ((0.5 - n2) * 0.2).toFixed(3) + ')'; x.fillRect(px, py, TS, TS);
      if (r() < 0.4) { const sx = px + 4 + r() * 24, sy = py + 8 + r() * 20, sr = 1.3 + r() * 1.7; x.fillStyle = 'rgba(0,0,0,0.3)'; x.beginPath(); x.ellipse(sx + 1, sy + 1, sr, sr * 0.7, 0, 0, 6.3); x.fill(); x.fillStyle = r() < 0.5 ? '#7a7872' : '#9a948a'; x.beginPath(); x.ellipse(sx, sy, sr, sr * 0.75, 0, 0, 6.3); x.fill(); x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(sx - sr * 0.4, sy - sr * 0.5, sr * 0.7, 0.9); }
      if (r() < 0.18) { const sx = px + 5 + r() * 22, sy = py + 12 + r() * 16; x.strokeStyle = '#5a8a3a'; x.lineWidth = 1; for (let b = 0; b < 3; b++) { x.beginPath(); x.moveTo(sx + b, sy); x.lineTo(sx + b + (b - 1) * 1.2, sy - 3 - r() * 2.5); x.stroke(); } }
    } else if (t === 6) { // сніг: замети
      if (r() < 0.5) { x.fillStyle = 'rgba(150,180,220,0.22)'; x.beginPath(); x.ellipse(px + 8 + r() * 16, py + 10 + r() * 14, 6 + r() * 6, 2 + r() * 2, 0, 0, 6.3); x.fill(); x.fillStyle = 'rgba(255,255,255,0.75)'; x.beginPath(); x.ellipse(px + 8 + r() * 14, py + 8 + r() * 14, 4 + r() * 4, 1.2 + r(), 0, 0, 6.3); x.fill(); }
      if (r() < 0.04) { const sx = px + 8 + r() * 16, sy = py + 10 + r() * 14; x.strokeStyle = '#6a5a48'; x.lineWidth = 1; for (let b = 0; b < 4; b++) { x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + (b - 1.5) * 1.8, sy - 4 - r() * 2); x.stroke(); } }
    }
  }
  // органічний перехід: плями текстури сусіда вздовж краю
  function blobEdge(x, mx, my, px, py, side, nt, v) {
    const rr = U.rng((((mx * 92821) ^ (my * 68917) ^ (side * 4099) ^ (nt * 131)) >>> 0) || 7); const tex = GFX.terr[nt]; const img = tex[(v + side) % tex.length];
    x.save(); x.beginPath(); x.rect(px, py, TS, TS); x.clip(); x.beginPath();
    const n = 8; for (let k = 0; k < n; k++) {
      const u = (k + 0.5) / n * TS + (rr() - 0.5) * 5, depth = 1 + rr() * 8, rad = 6 + rr() * 8; let cx, cy;
      if (side === 0) { cx = px + u; cy = py - 2 + depth; } else if (side === 2) { cx = px + u; cy = py + TS + 2 - depth; } else if (side === 1) { cx = px + TS + 2 - depth; cy = py + u; } else { cx = px - 2 + depth; cy = py + u; }
      x.moveTo(cx + rad, cy); x.arc(cx, cy, rad, 0, 6.3);
    }
    x.clip(); x.drawImage(img, px, py); x.restore();
  }
  function edgeBlend(x, px, py, side, color, size, alpha) {
    let g;
    if (side === 0) g = x.createLinearGradient(0, py, 0, py + size); else if (side === 1) g = x.createLinearGradient(px + TS, 0, px + TS - size, 0);
    else if (side === 2) g = x.createLinearGradient(0, py + TS, 0, py + TS - size); else g = x.createLinearGradient(px, 0, px + size, 0);
    g.addColorStop(0, U.rgba(color, alpha)); g.addColorStop(1, U.rgba(color, 0)); x.fillStyle = g;
    if (side === 0) x.fillRect(px, py, TS, size); else if (side === 1) x.fillRect(px + TS - size, py, size, TS); else if (side === 2) x.fillRect(px, py + TS - size, TS, size); else x.fillRect(px, py, size, TS);
  }
  function shadowFrom(x, map, mx, my, px, py) {
    const w = map.w;
    const solid = (a, b) => { if (a < 0 || b < 0 || a >= map.w || b >= map.h) return false; const j = b * w + a; if (map.blk[j] > 0) return true; const bl = map.bld[j]; return !!(bl && bl.def.wall); };
    // тінь зверху і зліва (світло з пн-зх)
    if (solid(mx, my - 1)) { const g = x.createLinearGradient(0, py, 0, py + 9); g.addColorStop(0, 'rgba(0,0,0,0.42)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(px, py, TS, 9); }
    if (solid(mx - 1, my)) { const g = x.createLinearGradient(px, 0, px + 7, 0); g.addColorStop(0, 'rgba(0,0,0,0.28)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(px, py, 7, TS); }
  }
  function drawRock(x, map, mx, my, i, px, py, v, blk) {
    const w = map.w;
    x.drawImage(GFX.rockTex[v], px, py);
    if (blk > 1) {
      const col = D.blocks[blk].color; const rnd = U.rng(i * 7 + 3);
      for (let k = 0; k < 4; k++) {
        const ox = px + 5 + rnd() * 22, oy = py + 5 + rnd() * 22, r = 2.5 + rnd() * 3.5;
        x.fillStyle = col; x.beginPath(); x.moveTo(ox - r, oy); x.lineTo(ox - r * 0.2, oy - r); x.lineTo(ox + r, oy - r * 0.3); x.lineTo(ox + r * 0.6, oy + r); x.lineTo(ox - r * 0.5, oy + r * 0.8); x.closePath(); x.fill();
        x.fillStyle = 'rgba(255,255,255,0.45)'; x.fillRect(ox - r * 0.3, oy - r * 0.7, 2, 2);
        x.strokeStyle = 'rgba(0,0,0,0.3)'; x.lineWidth = 0.8; x.stroke();
      }
    }
    const open = (a, b) => { if (a < 0 || b < 0 || a >= map.w || b >= map.h) return false; return map.blk[b * w + a] === 0; };
    if (open(mx, my - 1)) { x.fillStyle = 'rgba(255,255,255,0.22)'; x.fillRect(px, py, TS, 3); }
    if (open(mx - 1, my)) { x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(px, py, 2, TS); }
    if (open(mx + 1, my)) { x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(px + TS - 3, py, 3, TS); }
    if (open(mx, my + 1)) { x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(px, py + TS - 7, TS, 7); x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(px, py + TS - 11, TS, 4); }
  }
  // Повна інвалідація (зміна сезону, дахи): видимі чанки лишаються на екрані й оновлюються порціями за кадр, решта видаляється
  R.invalidateAll = function () {
    const v = R.view;
    for (const [key, ch] of Array.from(chunks.entries())) {
      const cy = (key / 64) | 0, cx = key % 64;
      if (v && cx >= v[0] && cx <= v[2] && cy >= v[1] && cy <= v[3]) ch.stale = true; else chunks.delete(key);
    }
  };
  function prefetchChunk(map, cx0, cy0, cx1, cy1) {
    const mx = (map.w - 1) >> 4, my = (map.h - 1) >> 4;
    for (let cy = Math.max(0, cy0 - 1); cy <= Math.min(my, cy1 + 1); cy++) for (let cx = Math.max(0, cx0 - 1); cx <= Math.min(mx, cx1 + 1); cx++) {
      if (cx >= cx0 && cx <= cx1 && cy >= cy0 && cy <= cy1) continue;
      const key = cy * 64 + cx; if (chunks.has(key)) continue;
      buildChunk(map, cx, cy); map.dirtyChunks.delete(key); return;
    }
  }
  // Далекі від камери чанки (по 1 МБ відеопам'яті кожен) вивантажуються — при поверненні перебудовуються
  function evictChunks(cx0, cy0, cx1, cy1) {
    for (const key of Array.from(chunks.keys())) {
      const cy = (key / 64) | 0, cx = key % 64;
      if (cx < cx0 - 2 || cx > cx1 + 2 || cy < cy0 - 2 || cy > cy1 + 2) chunks.delete(key);
    }
  }

  // ---------------------------------------------------------------
  //  Ефекти
  // ---------------------------------------------------------------
  const fx = R.fx = {};
  fx.text = (x, y, txt, color) => { if (texts.length > 80) texts.shift(); texts.push({ x: x + (Math.random() - 0.5) * 0.3, y, txt, color: color || '#fff', t: 0 }); };
  fx.blood = (x, y, dmg) => {
    const g = G(); if (!g) return; const n = Math.min(10, 2 + dmg * 0.3) | 0;
    for (let k = 0; k < n; k++) parts.push({ t: 'blood', x, y, vx: (Math.random() - 0.5) * 0.12, vy: (Math.random() - 0.5) * 0.12, life: 18 + Math.random() * 14, max: 30, s: 1.4 + Math.random() * 1.6, c: '#a01818' });
    if (g.map.decals.length > 260) g.map.decals.shift();
    g.map.decals.push({ x: x + (Math.random() - 0.5) * 0.6, y: y + (Math.random() - 0.5) * 0.6, r: 0.12 + Math.random() * 0.2 + dmg * 0.006, t: 'blood', a: 0.55 });
  };
  fx.spark = (x, y) => { for (let k = 0; k < 4; k++) parts.push({ t: 'spark', x, y, vx: (Math.random() - 0.5) * 0.18, vy: (Math.random() - 0.5) * 0.18 - 0.03, life: 10 + Math.random() * 8, max: 18, s: 1.5, c: '#ffd070' }); };
  fx.dust = (x, y, n) => { n = n || 4; for (let k = 0; k < n; k++) parts.push({ t: 'dust', x: x + (Math.random() - 0.5) * 0.6, y: y + (Math.random() - 0.5) * 0.6, vx: (Math.random() - 0.5) * 0.04, vy: -Math.random() * 0.03, life: 30 + Math.random() * 20, max: 50, s: 4 + Math.random() * 6, c: '#b8a98a' }); };
  fx.steam = (x, y) => { parts.push({ t: 'dust', x, y, vx: 0, vy: -0.03, life: 24, max: 24, s: 5, c: '#dde8ee' }); };
  fx.smoke = (x, y, c) => { parts.push({ t: 'smoke', x: x + (Math.random() - 0.5) * 0.3, y, vx: (Math.random() - 0.3) * 0.02, vy: -0.035 - Math.random() * 0.02, life: 50 + Math.random() * 30, max: 80, s: 6 + Math.random() * 5, c: c || '#444' }); };
  fx.muzzle = (x, y, dx, dy, type) => { parts.push({ t: 'flash', x: x + dx * 0.5, y: y + dy * 0.5, vx: 0, vy: 0, life: 4, max: 4, s: type === 'arrow' ? 0 : 10, c: '#ffe9a0' }); if (type !== 'arrow') { G().flashLights = G().flashLights || []; G().flashLights.push({ x, y, t: 5 }); } };
  fx.swing = (x1, y1, x2, y2) => { parts.push({ t: 'swing', x: (x1 + x2) / 2, y: (y1 + y2) / 2, ang: Math.atan2(y2 - y1, x2 - x1), vx: 0, vy: 0, life: 7, max: 7, s: 1, c: '#fff' }); };
  fx.bolt = (x, y) => { parts.push({ t: 'bolt', x, y, vx: 0, vy: 0, life: 10, max: 10, s: 1, c: '#fff' }); R.shake = Math.max(R.shake, 6); };
  fx.ring = (x, y, r, c) => { rings.push({ x, y, r: 0.3, max: r, t: 0, c: c || '#ffd9a0' }); };
  fx.pod = (x, y) => { pods.push({ x, y, t: 0, dur: 90, cargo: true, wait: 0 }); };
  fx.podFall = (x, y, delay, cb, dur) => { pods.push({ x, y, t: -delay, dur: dur || 110, cb, big: true }); };

  function updateFx() {
    if (RW.FX2) RW.FX2.update();
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life--; p.x += p.vx; p.y += p.vy;
      if (p.t === 'dust' || p.t === 'smoke') { p.s += 0.1; }
      if (p.t === 'spark') p.vy += 0.004;
      if (p.life <= 0) parts.splice(i, 1);
    }
    for (let i = texts.length - 1; i >= 0; i--) { const t = texts[i]; t.t++; t.y -= 0.014; if (t.t > 55) texts.splice(i, 1); }
    for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.t++; r.r += (r.max - r.r) * 0.12; if (r.t > 28) rings.splice(i, 1); }
    for (let i = pods.length - 1; i >= 0; i--) {
      const p = pods[i]; p.t++;
      if (p.t === p.dur) {
        fx.dust(p.x, p.y, p.big ? 22 : 8); fx.ring(p.x, p.y, p.big ? 4.2 : 2); R.shake = Math.max(R.shake, p.big ? 14 : 6);
        if (RW.A) RW.A.sfx('crash');
        const g = G(); if (g && g.map && p.big) { g.map.decals.push({ x: p.x, y: p.y, r: 0.9, t: 'scorch', a: 0.42 }); for (let k = 0; k < 10; k++) parts.push({ t: 'spark', x: p.x, y: p.y, vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3, life: 20, max: 20, s: 2, c: '#ffb050' }); }
        if (p.cb) p.cb();
      }
      if (p.t > p.dur + (p.big ? 140 : 40)) pods.splice(i, 1);
    }
    if (R.shake > 0) R.shake = Math.max(0, R.shake - 0.6);
  }
  R.podsActive = () => pods.some(p => p.t < p.dur);

  // ---------------------------------------------------------------
  //  Основне малювання
  // ---------------------------------------------------------------
  const WSTY = [[], []]; for (let q = 0; q < 8; q++) { const a = (q + 0.5) / 8; WSTY[0].push('rgba(140,200,240,' + (0.05 + a * 0.1).toFixed(3) + ')'); WSTY[1].push('rgba(255,255,255,' + (0.04 + a * 0.08).toFixed(3) + ')'); }
  const ZONE_COL = { stock: '#d8a040', grow: '#4aa84a', pen: '#c88a5a' };
  const ENTS = [], SEEN = new Set();
  R.draw = function () { const t0 = performance.now(); drawFrame(); R.drawMs += (performance.now() - t0 - R.drawMs) * 0.25; };
  // Малює всі вже побудовані чанки навколо екрана (з запасом M) в окреме полотно, початок координат — ціле число пікселів пристрою
  function buildGroundCache(map, cam, cz, ox, oy) {
    const cw0 = canvas.width, ch0 = canvas.height, M = Math.round(Math.max(96, 300 * dpr));
    if (!gc) { gc = { cv: document.createElement('canvas') }; gc.cx = gc.cv.getContext('2d', { alpha: false }); gc.inc = new Map(); }
    if (gc.cv.width !== cw0 + 2 * M || gc.cv.height !== ch0 + 2 * M) { gc.cv.width = cw0 + 2 * M; gc.cv.height = ch0 + 2 * M; }
    const x = gc.cx, zs = cz * dpr, ox0 = Math.round(ox * dpr), oy0 = Math.round(oy * dpr);
    x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#0c1014'; x.fillRect(0, 0, gc.cv.width, gc.cv.height);
    x.setTransform(zs, 0, 0, zs, ox0 + M, oy0 + M); x.imageSmoothingEnabled = cz < 0.9 || cz > 1.6;
    const CS = 16 * TS, wx0 = (-ox0 - M) / zs, wy0 = (-oy0 - M) / zs, wx1 = (gc.cv.width - ox0 - M) / zs, wy1 = (gc.cv.height - oy0 - M) / zs;
    const cx0 = Math.max(0, Math.floor(wx0 / CS)), cy0 = Math.max(0, Math.floor(wy0 / CS)), cx1 = Math.min((map.w - 1) >> 4, Math.floor(wx1 / CS)), cy1 = Math.min((map.h - 1) >> 4, Math.floor(wy1 / CS));
    gc.inc.clear();
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const ch = chunks.get(cy * 64 + cx); if (!ch) continue;
      x.drawImage(ch.c, cx * CS, cy * CS); gc.inc.set(cy * 64 + cx, ch.v);
    }
    gc.zoom = cz; gc.dpr = dpr; gc.cw = cw0; gc.ch = ch0; gc.M = M; gc.ox0 = ox0; gc.oy0 = oy0;
  }
  function drawFrame() {
    const g = G(); if (!ctx) return;
    R.time++;
    const now = performance.now(); R.stats.frames++; if (now - R.stats.last > 1000) { R.stats.fps = R.stats.frames; R.stats.frames = 0; R.stats.last = now; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!g || !g.map) { ctx.fillStyle = '#05080c'; ctx.fillRect(0, 0, W, H); return; }
    updateFx();
    const map = g.map, cam = R.cam, z = cam.zoom * TS; const S = RW.S.gfx;
    ctx.fillStyle = '#0c1014'; ctx.fillRect(0, 0, W, H);
    // тремтіння
    let shx = 0, shy = 0; if (R.shake > 0) { shx = (Math.random() - 0.5) * R.shake * 1.6; shy = (Math.random() - 0.5) * R.shake * 1.6; }
    const ox = W / 2 - cam.x * z + shx, oy = H / 2 - cam.y * z + shy;
    ctx.save(); ctx.translate(ox, oy); ctx.scale(cam.zoom, cam.zoom);
    const x0 = Math.max(0, Math.floor((-ox / z))), y0 = Math.max(0, Math.floor((-oy / z)));
    const x1 = Math.min(map.w - 1, Math.ceil((W - ox) / z)), y1 = Math.min(map.h - 1, Math.ceil((H - oy) / z));
    ctx.imageSmoothingEnabled = cam.zoom < 0.9 || cam.zoom > 1.6 ? true : false;
    // чанки
    const tChunks = performance.now(); let staleBuilt = 0;
    R.view = [x0 >> 4, y0 >> 4, x1 >> 4, y1 >> 4];
    // кеш землі: лише коли віддалено (чанки стискаються) і масштаб стабільний
    const cz = cam.zoom; R.zStable = cz === R.zLast ? (R.zStable || 0) + 1 : 0; R.zLast = cz;
    const useGc = cz < 0.95 && R.zStable > 6 && !R.noGroundCache;
    let gcOk = useGc && gc && gc.zoom === cz && gc.dpr === dpr && gc.cw === canvas.width && gc.ch === canvas.height;
    const ddx = gcOk ? Math.round(ox * dpr - gc.ox0) : 0, ddy = gcOk ? Math.round(oy * dpr - gc.oy0) : 0;
    if (gcOk && (Math.abs(ddx) > gc.M || Math.abs(ddy) > gc.M)) gcOk = false;
    for (let cy = y0 >> 4; cy <= y1 >> 4; cy++) for (let cx = x0 >> 4; cx <= x1 >> 4; cx++) {
      const key = cy * 64 + cx; let ch = chunks.get(key);
      if (!ch || map.dirtyChunks.has(key)) { buildChunk(map, cx, cy); map.dirtyChunks.delete(key); ch = chunks.get(key); }
      else if (ch.stale && (staleBuilt === 0 || performance.now() - tChunks < 5)) { buildChunk(map, cx, cy); staleBuilt++; }
      if (gcOk && gc.inc.get(key) !== ch.v) gcOk = false;
      if (!useGc) ctx.drawImage(ch.c, cx * 16 * TS, cy * 16 * TS);
    }
    if (useGc) {
      if (!gcOk) buildGroundCache(map, cam, cz, ox, oy);
      const g2 = gc; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(g2.cv, (gcOk ? ddx : 0) - g2.M, (gcOk ? ddy : 0) - g2.M); ctx.restore();
    }
    if (map.allDirty) map.allDirty = false;
    // попередня побудова сусідніх чанків (по одному за кадр, лише коли кадр легкий) — прокрутка без підвисань
    if (!staleBuilt && R.drawMs < 9 && (R.time % 3) === 0 && performance.now() - tChunks < 4) prefetchChunk(map, x0 >> 4, y0 >> 4, x1 >> 4, y1 >> 4);
    if (chunks.size > 30 && (R.time & 127) === 0) evictChunks(x0 >> 4, y0 >> 4, x1 >> 4, y1 >> 4);
    ctx.imageSmoothingEnabled = true;
    // вода анімація
    const tm = R.time * 0.04;
    ctx.lineWidth = 1;
    if (!R.lite) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * map.w + x; const t = map.terrain[i];
      if (t <= 1 && map.blk[i] === 0) {
        const a = (Math.sin(tm + x * 1.3 + y * 0.7) + 1) * 0.5; const q = (a * 7.99) | 0;
        ctx.fillStyle = WSTY[t === 0 ? 0 : 1][q];
        ctx.fillRect(x * TS + 4 + Math.sin(tm * 0.6 + y) * 4, y * TS + 8 + a * 8, 16, 2);
        if (!((x + y) & 1)) ctx.fillRect(x * TS + 12 + Math.cos(tm * 0.5 + x) * 5, y * TS + 20 - a * 6, 12, 1.5);
      }
    }
    // сніг
    if (g.snow > 0.02) {
      ctx.fillStyle = 'rgba(240,246,252,' + (g.snow * 0.62).toFixed(3) + ')';
      for (let y = y0; y <= y1; y++) { let rs = -1; for (let x = x0; x <= x1 + 1; x++) {
        let ok = false; if (x <= x1) { const i = y * map.w + x; ok = !(map.blk[i] || map.terrain[i] <= 1 || map.isRoofed(i) || map.floor[i]); }
        if (ok) { if (rs < 0) rs = x; } else if (rs >= 0) { ctx.fillRect(rs * TS, y * TS, (x - rs) * TS, TS); rs = -1; }
      } }
    }
    // декалі
    for (const d of map.decals) {
      if (d.x < x0 - 2 || d.x > x1 + 2 || d.y < y0 - 2 || d.y > y1 + 2) continue;
      if (d.t === 'blood') { ctx.fillStyle = 'rgba(120,16,16,' + d.a.toFixed(2) + ')'; ctx.beginPath(); ctx.ellipse(d.x * TS, d.y * TS, d.r * TS, d.r * TS * 0.75, 0, 0, 6.3); ctx.fill(); d.a -= 0.00004; }
      else { const gr = ctx.createRadialGradient(d.x * TS, d.y * TS, 2, d.x * TS, d.y * TS, d.r * TS); gr.addColorStop(0, 'rgba(20,14,10,' + d.a + ')'); gr.addColorStop(1, 'rgba(20,14,10,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(d.x * TS, d.y * TS, d.r * TS, 0, 6.3); ctx.fill(); }
    }
    if (map.decals.length && map.decals[0].a < 0.02) map.decals.shift();
    // зони
    if (RW.Storage) RW.Storage.draw(ctx, TS, map, x0, y0, x1, y1, ZONE_COL, R.time); else for (const zn of map.zones) {
      const col = ZONE_COL[zn.type]; ctx.fillStyle = U.rgba(col, 0.2); ctx.strokeStyle = U.rgba(col, 0.55); ctx.lineWidth = 1;
      for (const i of zn.cells) { const x = i % map.w, y = (i / map.w) | 0; if (x < x0 || x > x1 || y < y0 || y > y1) continue; ctx.fillRect(x * TS, y * TS, TS, TS); ctx.strokeRect(x * TS + 0.5, y * TS + 0.5, TS - 1, TS - 1); }
    }
    // предмети
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const arr = map.items.get(y * map.w + x); if (!arr) continue;
      for (const it of arr) {
        const ic = GFX.itemIcon(it.def); const n = it.n; const st = D.items[it.def].stack;
        const layers = st > 1 ? Math.min(3, 1 + (n > st * 0.33 ? 1 : 0) + (n > st * 0.7 ? 1 : 0)) : 1;
        const hh = U.hash2(x, y, 41), hh2 = U.hash2(y, x, 42); const IS = 21; for (let l = 0; l < layers; l++) ctx.drawImage(ic, x * TS + 5.5 + (hh - 0.5) * 5 - l * 1.2, y * TS + 5 + (hh2 - 0.5) * 4 - l * 2.2, IS, IS);
        if (it.forbid) { const bx = x * TS + 7, by = y * TS + 7; ctx.fillStyle = 'rgba(20,10,10,.75)'; ctx.beginPath(); ctx.arc(bx, by, 5.2, 0, 6.3); ctx.fill(); ctx.strokeStyle = '#ff5a4a'; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(bx - 2.4, by - 2.4); ctx.lineTo(bx + 2.4, by + 2.4); ctx.moveTo(bx + 2.4, by - 2.4); ctx.lineTo(bx - 2.4, by + 2.4); ctx.stroke(); }
      }
    }
    // будівлі та рослини
    const ents = ENTS; ents.length = 0;
    const seen = SEEN; seen.clear();
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * map.w + x;
      const pl = map.plant[i];
      if (pl) {
        const pd = D.plants[pl.def];
        if (pd.tree) ents.push({ y: y + 0.9, k: 't', pl, x, yy: y });
        else { const sp = GFX.plantSprite(pl.def, pl.growth, pl.hp); ctx.drawImage(sp, x * TS, y * TS); if (pl.blight) { ctx.fillStyle = 'rgba(60,40,20,0.45)'; ctx.fillRect(x * TS, y * TS, TS, TS); } if (map.desig.get(i) === 'harvest') drawDesig(x, y, 'harvest'); }
      }
      const b = map.bld[i];
      if (b && !seen.has(b)) { seen.add(b); if (b.def.wall) drawWall(map, b); else if (b.def.door) drawDoor(map, b); else if (b.def.pass === 0 && b.def.turret || b.def.solar || b.def.wood_gen || b.def.id === 'ship_engine' || b.def.wreck) ents.push({ y: b.y + b.h - 0.2, k: 'b', b }); else drawBuilding(b, g); }
      const bp = map.bp[i];
      if (bp && !seen.has(bp)) { seen.add(bp); drawBlueprint(bp, map); }
    }
    for (const [i, t] of map.desig) { const x = i % map.w, y = (i / map.w) | 0; if (x < x0 || x > x1 || y < y0 || y > y1) continue; if (t === 'chop' && map.plant[i]) { drawDesig(x, y, 'chop'); } else if (t === 'mine') drawDesig(x, y, 'mine'); }
    for (const b of map.buildings) { if (b.decon && b.x >= x0 - 2 && b.x <= x1 + 2 && b.y >= y0 - 2 && b.y <= y1 + 2) drawDesig(b.x, b.y, 'decon'); }
    // істоти
    for (const p of g.pawns) { if (p.x < x0 - 2 || p.x > x1 + 2 || p.y < y0 - 2 || p.y > y1 + 2) continue; ents.push({ y: p.y, k: 'p', p }); }
    for (const a of g.animals) { if (a.x < x0 - 2 || a.x > x1 + 2 || a.y < y0 - 2 || a.y > y1 + 2) continue; ents.push({ y: a.y, k: 'a', a }); }
    ents.sort((a, b) => a.y - b.y);
    for (const e of ents) {
      if (e.k === 't') { const pl = e.pl; const spr = GFX.treeSprites[pl.def][pl.v % 3]; const sz = D.plants[pl.def].size; const wv = Math.sin(tm * 0.7 + pl.x * 0.5 + pl.y) * 0.6; ctx.drawImage(spr, e.x * TS + 16 - 32 * sz + wv * 0.35, e.yy * TS + 30 - 52 * sz, 64 * sz, 72 * sz); if (map.desig.get(pl.y * map.w + pl.x) === 'chop') drawDesig(e.x, e.yy, 'chop'); }
      else if (e.k === 'b') drawBuilding(e.b, g);
      else if (e.k === 'p') drawPawnEnt(e.p, g, ctx);
      else if (e.k === 'a') drawAnimalEnt(e.a, g);
    }
    // вогонь
    for (const f of map.fires.values()) {
      if (f.x < x0 - 1 || f.x > x1 + 1 || f.y < y0 - 1 || f.y > y1 + 1) continue;
      drawFire(f);
      if (Math.random() < 0.18 * f.int) fx.smoke(f.x + 0.5, f.y + 0.3);
    }
    // снаряди
    for (const b of g.projectiles) {
      ctx.save(); ctx.translate(b.x * TS, b.y * TS); ctx.rotate(Math.atan2(b.vy, b.vx));
      if (b.type === 'arrow') { ctx.fillStyle = '#7a5a2a'; ctx.fillRect(-7, -0.7, 12, 1.4); ctx.fillStyle = '#ddd'; ctx.fillRect(5, -1.2, 3, 2.4); ctx.fillStyle = '#c33'; ctx.fillRect(-7, -1.6, 3, 3.2); }
      else { ctx.fillStyle = 'rgba(255,230,140,0.5)'; ctx.fillRect(-12, -0.9, 12, 1.8); ctx.fillStyle = '#fff3b0'; ctx.fillRect(-4, -1.2, 7, 2.4); }
      ctx.restore();
    }
    // частинки
    for (const p of parts) {
      const a = p.life / p.max;
      if (p.t === 'swing') { ctx.save(); ctx.translate(p.x * TS, p.y * TS); ctx.rotate(p.ang); ctx.strokeStyle = 'rgba(255,255,255,' + a.toFixed(2) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 9, -0.9 + (1 - a) * 1.8, -0.2 + (1 - a) * 1.8); ctx.stroke(); ctx.restore(); continue; }
      if (p.t === 'bolt') { ctx.strokeStyle = 'rgba(220,235,255,' + a.toFixed(2) + ')'; ctx.lineWidth = 3; ctx.beginPath(); let bx = p.x * TS + 10, by = p.y * TS - 400; ctx.moveTo(bx, by); while (by < p.y * TS) { by += 30; bx += (Math.random() - 0.5) * 36; ctx.lineTo(bx, by); } ctx.stroke(); continue; }
      ctx.globalAlpha = Math.min(1, a * (p.t === 'smoke' ? 0.55 : p.t === 'dust' ? 0.5 : 1));
      ctx.fillStyle = p.c;
      if (p.t === 'flash') { ctx.beginPath(); ctx.arc(p.x * TS, p.y * TS, p.s * a, 0, 6.3); ctx.fill(); }
      else if (p.t === 'dust' || p.t === 'smoke') { ctx.beginPath(); ctx.arc(p.x * TS, p.y * TS, p.s, 0, 6.3); ctx.fill(); }
      else ctx.fillRect(p.x * TS, p.y * TS, p.s, p.s);
      ctx.globalAlpha = 1;
    }
    for (const r of rings) { ctx.strokeStyle = U.rgba(r.c, 1 - r.t / 28); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(r.x * TS, r.y * TS, r.r * TS, 0, 6.3); ctx.stroke(); }
    if (RW.Farming) RW.Farming.draw(ctx, TS, map, x0, y0, x1, y1, R.time);
    if (RW.Cooking) RW.Cooking.drawItems(ctx, TS, map, x0, y0, x1, y1, R.time);
    if (RW.Quality) { RW.Quality.drawItems(ctx, TS, map, x0, y0, x1, y1, R.time); RW.Quality.drawBuildings(ctx, TS, map, R.time); }
    if (RW.Disasters) RW.Disasters.drawMeteors(ctx, TS, R.time);
    if (RW.Husbandry) RW.Husbandry.drawOverlay(ctx, TS, R.time);
    if (RW.Prisoners) RW.Prisoners.drawOverlay(ctx, TS, R.time);
    if (RW.Layers) RW.Layers.draw(ctx, TS, map, x0, y0, x1, y1, R.time);
    if (RW.Traders) RW.Traders.draw(ctx, TS, R.time);
    if (RW.Rel) RW.Rel.drawParty(ctx, TS, R.time);
    if (RW.FX2) RW.FX2.draw(ctx, TS);
    // капсули
    for (const p of pods) drawPod(p);
    if (R.cutDraw) R.cutDraw(ctx, TS);
    ctx.restore();

    // освітлення
    if (S.lighting) drawLighting(g, map, x0, y0, x1, y1, ox, oy, z);
    // погода
    drawWeather(g);
    if (RW.Disasters) RW.Disasters.drawScreen(ctx, W, H);
    // оверлей UI у світових координатах
    ctx.save(); ctx.translate(ox, oy); ctx.scale(cam.zoom, cam.zoom);
    if (RW.UI && RW.UI.drawWorldOverlay) RW.UI.drawWorldOverlay(ctx);
    // плаваючий текст
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 11px sans-serif';
    for (const t of texts) { const a = 1 - t.t / 55; ctx.globalAlpha = Math.min(1, a * 1.6); ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillText(t.txt, t.x * TS + 1, t.y * TS + 1); ctx.fillStyle = t.color; ctx.fillText(t.txt, t.x * TS, t.y * TS); }
    ctx.globalAlpha = 1;
    ctx.restore();
    // спалах блискавки
    if (g.flash > 0) { ctx.fillStyle = 'rgba(230,240,255,' + (g.flash / 12 * 0.5).toFixed(2) + ')'; ctx.fillRect(0, 0, W, H); g.flash--; }
  }

  // ---------------------------------------------------------------
  //  Окремі елементи
  // ---------------------------------------------------------------
  function drawDesig(x, y, t) {
    const px = x * TS, py = y * TS;
    if (t === 'mine') { ctx.fillStyle = 'rgba(80,200,255,0.28)'; ctx.fillRect(px, py, TS, TS); ctx.strokeStyle = '#6fd4ff'; ctx.lineWidth = 1.5; ctx.strokeRect(px + 2, py + 2, TS - 4, TS - 4); ctx.beginPath(); ctx.moveTo(px + 8, py + 24); ctx.lineTo(px + 24, py + 8); ctx.moveTo(px + 20, py + 6); ctx.lineTo(px + 26, py + 12); ctx.stroke(); }
    else if (t === 'chop') { ctx.strokeStyle = '#ffc46a'; ctx.lineWidth = 1.6; ctx.strokeRect(px + 3, py + 3, TS - 6, TS - 6); ctx.fillStyle = 'rgba(255,196,106,0.15)'; ctx.fillRect(px, py, TS, TS); ctx.beginPath(); ctx.moveTo(px + 9, py + 23); ctx.lineTo(px + 23, py + 9); ctx.moveTo(px + 23, py + 23); ctx.lineTo(px + 9, py + 9); ctx.stroke(); }
    else if (t === 'harvest') { ctx.strokeStyle = '#9aff7a'; ctx.lineWidth = 1.4; ctx.strokeRect(px + 3, py + 3, TS - 6, TS - 6); ctx.beginPath(); ctx.moveTo(px + 10, py + 16); ctx.lineTo(px + 15, py + 22); ctx.lineTo(px + 24, py + 9); ctx.stroke(); }
    else if (t === 'decon') { ctx.strokeStyle = '#ff6a5a'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(px + 8, py + 8); ctx.lineTo(px + 24, py + 24); ctx.moveTo(px + 24, py + 8); ctx.lineTo(px + 8, py + 24); ctx.stroke(); }
  }
  function wallLike(map, x, y) {
    if (!map.inb(x, y)) return true; const i = y * map.w + x; if (map.blk[i] > 0) return true;
    const b = map.bld[i]; return !!(b && (b.def.wall || b.def.door));
  }
  function drawWall(map, b) {
    const x = b.x, y = b.y; let m = 0;
    if (wallLike(map, x, y - 1)) m |= 1; if (wallLike(map, x + 1, y)) m |= 2; if (wallLike(map, x, y + 1)) m |= 4; if (wallLike(map, x - 1, y)) m |= 8;
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(x * TS + 2, y * TS + 5, TS, TS);
    ctx.drawImage(GFX.wallSprite(b.key, m), x * TS, y * TS);
    if (b.hp < b.maxhp * 0.6) { ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x * TS + 6, y * TS + 5); ctx.lineTo(x * TS + 14, y * TS + 14); ctx.lineTo(x * TS + 11, y * TS + 24); ctx.stroke(); }
  }
  function drawDoor(map, b) {
    const x = b.x, y = b.y; const horiz = wallLike(map, x - 1, y) && wallLike(map, x + 1, y);
    const op = b.door ? Math.min(1, b.door.open / 6) : 0;
    ctx.drawImage(GFX.wallSprite(b.key === 'door_steel' ? 'wall_steel' : 'wall_wood', 15), x * TS, y * TS);
    ctx.fillStyle = 'rgba(30,24,16,0.55)'; ctx.fillRect(x * TS + (horiz ? 0 : 7), y * TS + (horiz ? 7 : 0), horiz ? TS : 18, horiz ? 18 : TS);
    const spr = GFX.doorSprite(b.key, horiz);
    const sl = op * 20;
    ctx.save(); ctx.beginPath(); ctx.rect(x * TS, y * TS, TS, TS); ctx.clip();
    if (horiz) ctx.drawImage(spr, x * TS - sl, y * TS); else ctx.drawImage(spr, x * TS, y * TS - sl);
    ctx.restore();
  }
  function drawBuilding(b, g) {
    const spr = GFX.bldSprite(b.key, b.w, b.h); const px = b.x * TS, py = b.y * TS; const d = b.def; const t = R.time;
    ctx.drawImage(spr, px, py);
    const cx = px + b.w * TS / 2, cy = py + b.h * TS / 2; const active = g.map.isActive(b);
    if (d.id === 'campfire' || d.id === 'torch') {
      if (b.fuel > 0) { const fl = 1 + Math.sin(t * 0.4 + b.x) * 0.15; flame(cx, cy + (d.id === 'torch' ? -8 : 0), d.id === 'torch' ? 0.55 : 1, fl, b.x * 7); if (Math.random() < 0.05) fx.smoke(cx / TS, cy / TS - 0.3, '#555'); }
      else if (d.id === 'campfire') { ctx.fillStyle = 'rgba(30,20,10,0.5)'; ctx.beginPath(); ctx.ellipse(cx, cy + 2, 8, 4, 0, 0, 6.3); ctx.fill(); }
    } else if (d.id === 'heater' && active) { ctx.fillStyle = 'rgba(255,90,40,' + (0.35 + Math.sin(t * 0.2) * 0.1).toFixed(2) + ')'; ctx.fillRect(px + 7, py + 8, 18, 16); }
    else if (d.id === 'cooler' && active) { ctx.fillStyle = 'rgba(120,200,255,0.25)'; ctx.fillRect(px + 7, py + 8, 18, 16); }
    else if (d.id === 'tv' && active) { ctx.fillStyle = 'rgba(' + (80 + (t % 30) * 3) + ',140,255,0.35)'; ctx.fillRect(px + 5, py + 7, b.w * TS - 10, b.h * TS - 18); }
    else if (d.id === 'lamp' && active) { ctx.fillStyle = 'rgba(255,240,180,0.35)'; ctx.beginPath(); ctx.arc(px + 16, py + 14, 8, 0, 6.3); ctx.fill(); }
    else if (d.id === 'wood_gen' && b.fuel > 0) { ctx.fillStyle = 'rgba(255,140,40,0.55)'; ctx.fillRect(px + 12, py + b.h * TS - 18, 8, 6); if (Math.random() < 0.08) fx.smoke(px / TS + 0.9, py / TS + 0.2, '#666'); }
    else if (d.id === 'stove' && b.working) { ctx.fillStyle = 'rgba(255,120,30,0.5)'; ctx.beginPath(); ctx.arc(px + 17, py + 13, 5, 0, 6.3); ctx.arc(px + 47, py + 13, 5, 0, 6.3); ctx.fill(); }
    else if (d.id === 'turret') { ctx.save(); ctx.translate(cx, cy); ctx.rotate(b.aimAt || 0); ctx.fillStyle = '#20262c'; ctx.fillRect(-2, -3, 18, 6); ctx.fillStyle = '#4a5560'; ctx.fillRect(-2, -3, 8, 6); if (b.flash > 0) { b.flash--; ctx.fillStyle = '#ffe9a0'; ctx.beginPath(); ctx.arc(19, 0, 6, 0, 6.3); ctx.fill(); } ctx.restore(); if (!b.on) { ctx.fillStyle = 'rgba(200,40,40,0.7)'; ctx.fillRect(cx - 3, cy - 3, 6, 6); } }
    else if (d.id === 'research_bench' && g.research.current && b.res) { ctx.fillStyle = 'rgba(80,255,255,0.3)'; ctx.fillRect(px + 8, py + 8, 26, 14); }
    else if (d.id === 'battery') { const fr = d.battery ? b.charge / d.battery : 0; ctx.fillStyle = '#6f6'; ctx.fillRect(px + 8, py + 24, 16 * fr, 2); }
    else if (d.id === 'conduit') { const w = g.map.w; const nb = (dx, dy) => { const o = g.map.bld[(b.y + dy) * w + b.x + dx]; return o && (o.def.conduit || o.def.power || o.def.battery); }; ctx.fillStyle = '#9a5a1a'; if (nb(1, 0)) ctx.fillRect(px + 16, py + 13, 16, 6); if (nb(-1, 0)) ctx.fillRect(px, py + 13, 16, 6); if (nb(0, 1)) ctx.fillRect(px + 13, py + 16, 6, 16); if (nb(0, -1)) ctx.fillRect(px + 13, py, 6, 16); }
    if (d.bed && b.owner != null) { /* власник показується в UI */ }
    if (b.decon) { /* намальовано окремо */ }
    if (b.hp < b.maxhp * 0.85 && !d.wall) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(px + 2, py + b.h * TS - 5, b.w * TS - 4, 3); ctx.fillStyle = '#e44'; ctx.fillRect(px + 2, py + b.h * TS - 5, (b.w * TS - 4) * b.hp / b.maxhp, 3); }
    if (g.sel && g.sel.b === b) { /* ui */ }
  }
  function flame(cx, cy, s, fl, seed) {
    const t = R.time;
    for (let k = 0; k < 3; k++) {
      const ph = t * 0.35 + seed + k * 2.1; const h = (9 + Math.sin(ph) * 3 + k * 0) * s * fl; const w = (6 - k * 1.6) * s;
      ctx.fillStyle = ['rgba(255,110,20,0.9)', 'rgba(255,170,40,0.9)', 'rgba(255,240,150,0.95)'][k];
      ctx.beginPath(); ctx.moveTo(cx - w, cy + 3); ctx.quadraticCurveTo(cx - w * 0.6 + Math.sin(ph) * 2, cy - h * 0.5, cx + Math.sin(ph * 1.3), cy - h); ctx.quadraticCurveTo(cx + w * 0.6 + Math.sin(ph) * 2, cy - h * 0.5, cx + w, cy + 3); ctx.closePath(); ctx.fill();
    }
  }
  function drawFire(f) {
    const cx = f.x * TS + 16, cy = f.y * TS + 22; const s = 0.7 + f.int * 1.0;
    const gl = ctx.createRadialGradient(cx, cy, 2, cx, cy, 24 * s); gl.addColorStop(0, 'rgba(255,150,40,0.35)'); gl.addColorStop(1, 'rgba(255,150,40,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(cx, cy, 24 * s, 0, 6.3); ctx.fill();
    for (let k = -1; k <= 1; k++) flame(cx + k * 6 * s, cy + Math.abs(k) * 2, s * (k === 0 ? 1.15 : 0.8), 1, f.x * 3 + k + f.y);
  }
  function drawBlueprint(bp, map) {
    const d = D.bld[bp.def]; const px = bp.x * TS, py = bp.y * TS; const prog = bp.total ? bp.work / bp.total : 0;
    ctx.globalAlpha = 0.5;
    if (d.floor) { const ft = GFX.floorTex[D.FLOORS.indexOf(bp.def)]; ctx.drawImage(ft[0], px, py); }
    else if (d.wall) ctx.drawImage(GFX.wallSprite(bp.def, 0), px, py);
    else if (d.door) ctx.drawImage(GFX.doorSprite(bp.def, true), px, py);
    else ctx.drawImage(GFX.bldSprite(bp.def, bp.w, bp.h), px, py);
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(70,150,255,0.22)'; ctx.fillRect(px, py, bp.w * TS, bp.h * TS);
    ctx.strokeStyle = bp.missing ? '#ff7050' : '#6ab0ff'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.strokeRect(px + 1, py + 1, bp.w * TS - 2, bp.h * TS - 2); ctx.setLineDash([]);
    if (prog > 0) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(px + 2, py + bp.h * TS - 6, bp.w * TS - 4, 4); ctx.fillStyle = '#8cf'; ctx.fillRect(px + 2, py + bp.h * TS - 6, (bp.w * TS - 4) * prog, 4); }
    if (bp.missing) { ctx.fillStyle = '#ff9a80'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('нема: ' + D.items[bp.missing].name, px + bp.w * TS / 2, py + 10); }
  }
  function drawPawnEnt(p, g, c) {
    const px = p.x * TS, py = p.y * TS; const sel = g.sel && g.sel.p === p;
    // положення при сні — лежить у ліжку
    if (p.carriedBy) { GFX.drawPawn(c, p, px, py - 4, 1, { time: R.time }); return; }
    if (p.hurtT > 0) p.hurtT--;
    let aim = null;
    const tgt = p.target || p.combatTarget; if (tgt && !tgt.dead && (p.aim > 0 || p.cool > 0 || p.drafted)) aim = Math.atan2(tgt.y - p.y, tgt.x - p.x);
    if (p.drafted && p.isColonist) { c.strokeStyle = 'rgba(255,90,70,0.8)'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(px, py + 6, 11, 5, 0, 0, 6.3); c.stroke(); }
    if (p.faction === 'enemy') { c.strokeStyle = 'rgba(255,40,40,0.55)'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(px, py + 6, 10, 4.5, 0, 0, 6.3); c.stroke(); }
    if (p.hurtT > 0) { c.save(); c.globalAlpha = 0.25; c.fillStyle = '#f33'; c.beginPath(); c.arc(px, py - 2, 11, 0, 6.3); c.fill(); c.restore(); }
    if (RW.Life && p.isColonist) RW.Life.auraUnder(c, p, px, py, R.time);
    GFX.drawPawn(c, p, px, py, 1, { time: R.time, aimAngle: aim });
    if (RW.Health && p.isColonist) RW.Health.bodyOverlay(c, p, px, py);
    if (RW.Life && p.isColonist) RW.Life.bubbleOver(c, p, px, py, R.time, R.cam.zoom);
    // мітки
    const zoom = R.cam.zoom;
    if (p.faction === 'colony' || p.isTrader) {
      if (zoom > 0.65) {
        const nm = p.name.nick; c.font = 'bold 9px sans-serif'; c.textAlign = 'center'; const tw = c.measureText(nm).width + 8;
        c.fillStyle = 'rgba(8,10,14,0.65)'; c.beginPath(); c.roundRect ? c.roundRect(px - tw / 2, py + 11, tw, 12, 5) : c.rect(px - tw / 2, py + 11, tw, 12); c.fill();
        c.fillStyle = p.faction === 'colony' ? (p.drafted ? '#ff9a80' : '#e8eef2') : '#e8c870'; c.textBaseline = 'middle'; c.fillText(nm, px, py + 17.5);
      }
    }
    if (p.downed && !p.dead) { c.fillStyle = '#e44'; c.font = 'bold 10px sans-serif'; c.textAlign = 'center'; c.fillText('✚', px, py - 14); }
    if (p.sleeping) { c.fillStyle = '#9cf'; c.font = 'bold 11px sans-serif'; c.textAlign = 'center'; c.fillText('z' + (R.time % 90 < 45 ? 'Z' : 'z'), px + 8, py - 12 - (R.time % 45) * 0.12); }
    if (p.mental) { c.fillStyle = '#f66'; c.font = 'bold 14px sans-serif'; c.textAlign = 'center'; c.fillText('!', px, py - 18 - Math.sin(R.time * 0.2) * 2); }
    if ((p.injuries.length || p.blood < 1) && p.faction === 'colony' && (zoom > 0.7)) { const f = Math.max(0, 1 - (p.pain || 0) - (1 - p.blood)); c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(px - 9, py - 18, 18, 3); c.fillStyle = f > 0.55 ? '#6c4' : f > 0.3 ? '#ec4' : '#e44'; c.fillRect(px - 9, py - 18, 18 * f, 3); }
    if (p.faction === 'enemy' && (p.blood < 0.95 || p.injuries.length)) { c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(px - 9, py - 18, 18, 3); c.fillStyle = '#e44'; c.fillRect(px - 9, py - 18, 18 * Math.max(0, p.blood), 3); }
  }
  function drawAnimalEnt(a, g) {
    const px = a.x * TS, py = a.y * TS;
    GFX.drawAnimal(ctx, a, px, py, 1);
    if (a.hunt) { ctx.strokeStyle = '#ff9a40'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(px, py, 14, 0, 6.3); ctx.stroke(); ctx.beginPath(); ctx.moveTo(px - 18, py); ctx.lineTo(px - 10, py); ctx.moveTo(px + 10, py); ctx.lineTo(px + 18, py); ctx.stroke(); }
    if (a.hostile || a.manhunt > 0) { ctx.fillStyle = '#f55'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', px, py - 14); }
    if (a.faction === 'colony' && R.cam.zoom > 0.7) { const nm = a.name || ''; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(8,10,14,0.6)'; const tw = ctx.measureText(nm).width + 6; ctx.fillRect(px - tw / 2, py + 9, tw, 10); ctx.fillStyle = '#cfe'; ctx.fillText(nm, px, py + 16); }
    if (a.hp < a.maxhp * 0.98 && !a.dead) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(px - 8, py - 14, 16, 2.5); ctx.fillStyle = '#e66'; ctx.fillRect(px - 8, py - 14, 16 * a.hp / a.maxhp, 2.5); }
  }
  function drawPod(p) {
    if (p.t < 0) return; const px = p.x * TS, py = p.y * TS; const k = U.clamp(p.t / p.dur, 0, 1);
    if (p.t >= p.dur) { // залишок диму
      if (p.t < p.dur + 90 && p.big && Math.random() < 0.3) fx.smoke(p.x, p.y - 0.3, '#333');
      return;
    }
    const e = k * k; const h = (1 - e) * 520;
    const sc = 0.6 + (1 - k) * 0.9;
    ctx.fillStyle = 'rgba(0,0,0,' + (0.15 + k * 0.25).toFixed(2) + ')'; ctx.beginPath(); ctx.ellipse(px, py + 6, 18 * k + 4, 8 * k + 2, 0, 0, 6.3); ctx.fill();
    // полум'яний хвіст
    const gy = py - h; const gr = ctx.createLinearGradient(px, gy - 160, px, gy);
    gr.addColorStop(0, 'rgba(255,200,80,0)'); gr.addColorStop(0.6, 'rgba(255,140,40,0.7)'); gr.addColorStop(1, 'rgba(255,255,220,0.95)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(px - 12 * sc, gy); ctx.lineTo(px - 3, gy - 170 * sc); ctx.lineTo(px + 3, gy - 170 * sc); ctx.lineTo(px + 12 * sc, gy); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.translate(px, gy); ctx.scale(sc, sc);
    if (p.cargo) { ctx.fillStyle = '#6a6a72'; ctx.fillRect(-9, -9, 18, 18); ctx.fillStyle = '#c8a040'; ctx.fillRect(-9, -2, 18, 4); }
    else {
      ctx.fillStyle = '#4a4a52'; ctx.beginPath(); ctx.ellipse(0, 0, 14, 17, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#8a8a94'; ctx.beginPath(); ctx.ellipse(-2, -3, 10, 12, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#ff9a40'; ctx.beginPath(); ctx.ellipse(0, 7, 10, 6, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.ellipse(2, -5, 5, 4, 0.4, 0, 6.3); ctx.fill();
    }
    ctx.restore();
    // іскри
    if (p.t % 2 === 0) parts.push({ t: 'spark', x: p.x + (Math.random() - 0.5) * 0.6, y: p.y - h / TS - 0.5, vx: 0, vy: 0.2, life: 14, max: 14, s: 2, c: '#ffcf70' });
  }

  // ---------------------------------------------------------------
  //  Освітлення
  // ---------------------------------------------------------------
  function drawLighting(g, map, x0, y0, x1, y1, ox, oy, z) {
    const sc = R.lite ? 0.16 : 0.25; const lw = Math.ceil(W * sc), lh = Math.ceil(H * sc);
    if (lc.width !== lw || lc.height !== lh) { lc.width = lw; lc.height = lh; }
    const dl = g.daylight;
    const wt = g.weather.type; const cloud = wt === 'storm' ? 0.14 : (wt === 'rain' ? 0.08 : (wt === 'cloudy' || wt === 'snow' || wt === 'fog' ? 0.04 : 0));
    const nightA = (1 - dl) * 0.7 + cloud * dl;
    // колір сутінок
    const dusk = Math.max(0, 1 - Math.abs(dl - 0.5) * 2) * (dl > 0.02 && dl < 0.98 ? 1 : 0);
    const r = Math.round(10 + dusk * 70), gg = Math.round(14 + dusk * 24), bb = Math.round(40 - dusk * 12);
    lctx.globalCompositeOperation = 'source-over'; lctx.clearRect(0, 0, lw, lh);
    const baseA = Math.min(0.8, nightA).toFixed(3); const baseCol = 'rgba(' + r + ',' + gg + ',' + bb + ',' + baseA + ')';
    lctx.fillStyle = baseCol; lctx.fillRect(0, 0, lw, lh);
    let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9; // межі «цікавої» області: поза нею шар однорідний
    const grow = (a0, b0, a1, b1) => { if (a0 < bx0) bx0 = a0; if (b0 < by0) by0 = b0; if (a1 > bx1) bx1 = a1; if (b1 > by1) by1 = b1; };
    // приміщення темніші вдень
    const tsz = z * sc;
    lctx.fillStyle = 'rgba(8,10,22,' + (0.26 * dl + 0.0).toFixed(3) + ')';
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * map.w + x; if (map.mroof[i] && map.blk[i] === 0) { const rx = (x * z + ox) * sc, ry = (y * z + oy) * sc; lctx.fillRect(rx, ry, tsz + 0.6, tsz + 0.6); grow(rx, ry, rx + tsz + 0.6, ry + tsz + 0.6); } else if (map.blk[i] > 0) { /* скеля — не освітлюємо */ } }
    // джерела світла
    lctx.globalCompositeOperation = 'destination-out';
    const light = (cx, cy, rr, a) => {
      const sx = (cx * z + ox) * sc, sy = (cy * z + oy) * sc, rad = rr * z * sc;
      if (sx + rad < 0 || sy + rad < 0 || sx - rad > lw || sy - rad > lh) return;
      grow(sx - rad, sy - rad, sx + rad, sy + rad);
      const gr = lctx.createRadialGradient(sx, sy, rad * 0.08, sx, sy, rad); gr.addColorStop(0, 'rgba(0,0,0,' + a.toFixed(2) + ')'); gr.addColorStop(0.55, 'rgba(0,0,0,' + (a * 0.55).toFixed(2) + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = gr; lctx.beginPath(); lctx.arc(sx, sy, rad, 0, 6.3); lctx.fill();
    };
    const glow = [];
    for (const L of map.lights) { if (!map.isActive(L.b)) continue; const fl = L.b.def.fuel ? 1 + Math.sin(R.time * 0.3 + L.x) * 0.06 : 1; light(L.x, L.y, L.r * fl, L.a); glow.push([L.x, L.y, L.r, L.c, L.a]); }
    for (const f of map.fires.values()) { light(f.x + 0.5, f.y + 0.5, 3 + f.int * 3, 0.8); glow.push([f.x + 0.5, f.y + 0.5, 4, '#ff8030', 0.6]); }
    if (g.flashLights) { for (let k = g.flashLights.length - 1; k >= 0; k--) { const fl = g.flashLights[k]; light(fl.x, fl.y, 5, 0.6); fl.t--; if (fl.t <= 0) g.flashLights.splice(k, 1); } }
    for (const p of pods) if (p.t >= 0 && p.t < p.dur + 25) { const h = (1 - Math.pow(U.clamp(p.t / p.dur, 0, 1), 2)) * 520 / TS; light(p.x, p.y - h, 8, 0.9); glow.push([p.x, p.y - h, 9, '#ff9a40', 0.8]); }
    // колоністи мають мінімальне світло
    for (const p of g.pawns) if (p.faction === 'colony' && !p.dead) light(p.x, p.y, 2.2, 0.28);
    lctx.globalCompositeOperation = 'source-over';
    // Накладання: поза межами «цікавої» області шар однорідний, тому лише її масштабуємо з lc, решту — заливаємо суцільним кольором
    ctx.save(); ctx.imageSmoothingEnabled = true;
    const covered = bx1 > bx0 ? (Math.min(lw, bx1 + 3) - Math.max(0, bx0 - 3)) * (Math.min(lh, by1 + 3) - Math.max(0, by0 - 3)) / (lw * lh) : 0;
    R.lightCover = covered;
    if (covered > 0.8) ctx.drawImage(lc, 0, 0, lw, lh, 0, 0, W, H);
    else {
      ctx.setTransform(1, 0, 0, 1, 0, 0); const cw = canvas.width, ch = canvas.height, dW = W * dpr, dH = H * dpr;
      let X0 = 0, Y0 = 0, X1 = 0, Y1 = 0;
      if (covered > 0) { X0 = Math.max(0, Math.floor((bx0 - 3) / lw * dW)); Y0 = Math.max(0, Math.floor((by0 - 3) / lh * dH)); X1 = Math.min(cw, Math.ceil((bx1 + 3) / lw * dW)); Y1 = Math.min(ch, Math.ceil((by1 + 3) / lh * dH)); }
      if (Math.min(0.8, nightA) > 0.001) {
        ctx.fillStyle = baseCol;
        if (covered > 0) { ctx.fillRect(0, 0, cw, Y0); ctx.fillRect(0, Y1, cw, ch - Y1); ctx.fillRect(0, Y0, X0, Y1 - Y0); ctx.fillRect(X1, Y0, cw - X1, Y1 - Y0); }
        else ctx.fillRect(0, 0, cw, ch);
      }
      if (covered > 0) ctx.drawImage(lc, X0 / dW * lw, Y0 / dH * lh, (X1 - X0) / dW * lw, (Y1 - Y0) / dH * lh, X0, Y0, X1 - X0, Y1 - Y0);
    }
    ctx.restore();
    // теплий відтінок біля вогнів
    if (nightA > 0.12) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const [cx, cy, rr, c, a] of glow) {
        const sx = cx * z + ox, sy = cy * z + oy, rad = rr * z; if (sx + rad < 0 || sy + rad < 0 || sx - rad > W || sy - rad > H) continue;
        const gr = ctx.createRadialGradient(sx, sy, 0, sx, sy, rad); gr.addColorStop(0, U.rgba(c, 0.26 * a * nightA * 1.4)); gr.addColorStop(1, U.rgba(c, 0));
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(sx, sy, rad, 0, 6.3); ctx.fill();
      }
      ctx.restore();
    }
    // сезонний відтінок
    const s = D.seasonOf(g.tick); const tint = [null, 'rgba(255,225,150,0.05)', 'rgba(255,150,60,0.07)', 'rgba(170,200,255,0.08)'][s];
    if (tint && dl > 0.2) { ctx.fillStyle = tint; ctx.fillRect(0, 0, W, H); }
  }

  // ---------------------------------------------------------------
  //  Погода
  // ---------------------------------------------------------------
  const drops = [];
  function drawWeather(g) {
    const wt = g.weather.type;
    if (wt === 'rain' || wt === 'storm') {
      const n = wt === 'storm' ? 220 : 130;
      while (drops.length < n) drops.push({ x: Math.random() * W, y: Math.random() * H, v: 14 + Math.random() * 10 });
      ctx.strokeStyle = 'rgba(170,200,235,0.45)'; ctx.lineWidth = 1; ctx.beginPath();
      for (const d of drops) { d.y += d.v; d.x -= d.v * 0.18; if (d.y > H) { d.y = -10; d.x = Math.random() * W + 40; } ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + 3, d.y - 12); }
      ctx.stroke();
      ctx.fillStyle = 'rgba(20,30,50,' + (wt === 'storm' ? 0.22 : 0.12) + ')'; ctx.fillRect(0, 0, W, H);
    } else if (wt === 'snow') {
      while (drops.length < 150) drops.push({ x: Math.random() * W, y: Math.random() * H, v: 1.2 + Math.random() * 1.6, p: Math.random() * 6 });
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (const d of drops) { d.y += d.v; d.p += 0.03; d.x += Math.sin(d.p) * 0.6 - 0.2; if (d.y > H) { d.y = -5; d.x = Math.random() * W; } ctx.fillRect(d.x, d.y, 2, 2); }
      ctx.fillStyle = 'rgba(220,230,245,0.08)'; ctx.fillRect(0, 0, W, H);
    } else { drops.length = 0; if (wt === 'fog') { ctx.fillStyle = 'rgba(210,220,230,0.28)'; ctx.fillRect(0, 0, W, H); } }
  }

  // Фокус камери
  R.focus = function (x, y, zoom) { R.cam.x = x; R.cam.y = y; if (zoom) R.cam.zoom = zoom; };
})();
