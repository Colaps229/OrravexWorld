'use strict';
// ============================================================
//  gfx.js — процедурна графіка: текстури, спрайти, колоністи, тварини
// ============================================================
(function () {
  const D = RW.D, U = RW.U;
  const GFX = RW.GFX = {};
  const TS = 32;
  GFX.TS = TS;

  function mk(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); if (fn) fn(x, w, h); return c; }
  GFX.mk = mk;
  const R = U.rng(1337);

  // ---------------------------------------------------------------
  //  Текстури ґрунту
  // ---------------------------------------------------------------
  GFX.terr = {}; GFX.terrAvg = {};
  // ---------- допоміжне: тайлові шуми, фінішна обробка ----------
  function tnoise(seed, size, cells, oct) {
    const out = new Float32Array(size * size); let amp = 1, tot = 0;
    for (let o = 0; o < oct; o++) {
      const f = cells << o; const rnd = U.rng(seed * 131 + o * 977 + 5); const lat = new Float32Array(f * f); for (let i = 0; i < lat.length; i++) lat[i] = rnd();
      for (let y = 0; y < size; y++) {
        const fy = y / size * f; const y0 = Math.floor(fy), ty = fy - y0, sy = ty * ty * (3 - 2 * ty); const ya = y0 % f, yb = (y0 + 1) % f;
        for (let x = 0; x < size; x++) {
          const fx = x / size * f; const x0 = Math.floor(fx), tx = fx - x0, sx = tx * tx * (3 - 2 * tx); const xa = x0 % f, xb = (x0 + 1) % f;
          out[y * size + x] += (lat[ya * f + xa] * (1 - sx) * (1 - sy) + lat[ya * f + xb] * sx * (1 - sy) + lat[yb * f + xa] * (1 - sx) * sy + lat[yb * f + xb] * sx * sy) * amp;
        }
      }
      tot += amp; amp *= 0.5;
    }
    for (let i = 0; i < out.length; i++) out[i] /= tot; return out;
  }
  GFX.tnoise = tnoise;
  // тайл із багатошаровим шумом; opt: low/mid/fine/warm амплітуди, contour {thr,amt}
  function groundTile(base, opt, seed) {
    const c = mk(TS, TS), x = c.getContext('2d'); const img = x.createImageData(TS, TS); const [r, g, b] = U.hexToRgb(base);
    const n1 = tnoise(seed, TS, 2, 3), n2 = tnoise(seed + 11, TS, 8, 2), n3 = tnoise(seed + 23, TS, 4, 2); const rnd = U.rng(seed * 7 + 1);
    for (let i = 0; i < TS * TS; i++) {
      let a = (n1[i] - 0.5) * opt.low + (n2[i] - 0.5) * opt.mid + (rnd() - 0.5) * opt.fine; const wm = (n3[i] - 0.5) * (opt.warm || 0);
      if (opt.contour) { const d = Math.abs(n1[i] - 0.5); if (d < opt.contour.thr) a += opt.contour.amt * (1 - d / opt.contour.thr); }
      img.data[i * 4] = r + a + wm; img.data[i * 4 + 1] = g + a - wm * 0.3; img.data[i * 4 + 2] = b + a - wm; img.data[i * 4 + 3] = 255;
    }
    x.putImageData(img, 0, 0); return c;
  }
  GFX.groundTile = groundTile;
  // малює елемент із «загортанням» через краї тайла
  function wrapDraw(px, py, m, fn) { const xs = [0], ys = [0]; if (px < m) xs.push(TS); if (px > TS - m) xs.push(-TS); if (py < m) ys.push(TS); if (py > TS - m) ys.push(-TS); for (const ox of xs) for (const oy of ys) fn(px + ox, py + oy); }
  function pebble(x, px, py, r, base, rnd) {
    wrapDraw(px, py, r + 2, (X, Y) => {
      x.fillStyle = 'rgba(0,0,0,0.28)'; x.beginPath(); x.ellipse(X + 0.8, Y + 1, r * 1.1, r * 0.8, 0, 0, 6.3); x.fill();
      x.fillStyle = U.shade(base, (rnd() - 0.5) * 0.3); x.beginPath(); x.ellipse(X, Y, r, r * 0.78, rnd() * 3, 0, 6.3); x.fill();
      x.fillStyle = 'rgba(255,255,255,0.28)'; x.beginPath(); x.ellipse(X - r * 0.3, Y - r * 0.3, r * 0.45, r * 0.3, 0, 0, 6.3); x.fill();
    });
  }
  // фінішна обробка спрайта: освітлення, зерно, обведення
  let grainPat = null;
  function finish(c, o) {
    o = o || {}; const w = c.width, h = c.height, x = c.getContext('2d');
    if (!grainPat) { const gc = mk(64, 64); const gx = gc.getContext('2d'); const n = tnoise(91, 64, 8, 3); const im = gx.createImageData(64, 64); const rr = U.rng(5); for (let i = 0; i < 4096; i++) { const v = (n[i] - 0.5) * 70 + (rr() - 0.5) * 30; const l = v > 0; im.data[i * 4] = l ? 255 : 0; im.data[i * 4 + 1] = l ? 255 : 0; im.data[i * 4 + 2] = l ? 235 : 10; im.data[i * 4 + 3] = Math.min(255, Math.abs(v) * 2.2); } gx.putImageData(im, 0, 0); grainPat = gc; }
    x.globalCompositeOperation = 'source-atop';
    if (!o.noGrain) { x.globalAlpha = o.grain || 0.3; const pat = x.createPattern(grainPat, 'repeat'); x.fillStyle = pat; x.fillRect(0, 0, w, h); x.globalAlpha = 1; }
    const g = x.createLinearGradient(0, 0, w * 0.55, h); g.addColorStop(0, 'rgba(255,250,225,' + (o.light == null ? 0.16 : o.light) + ')'); g.addColorStop(0.45, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,30,' + (o.dark == null ? 0.22 : o.dark) + ')');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    if (!o.noOutline) {
      const t = mk(w, h); const tx = t.getContext('2d'); tx.drawImage(c, 0, 0); tx.globalCompositeOperation = 'source-in'; tx.fillStyle = 'rgba(14,10,8,0.85)'; tx.fillRect(0, 0, w, h);
      x.globalCompositeOperation = 'destination-over'; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) x.drawImage(t, dx, dy);
    }
    x.globalCompositeOperation = 'source-over'; return c;
  }
  GFX.finish = finish;

  GFX.initTerrain = function (biomeKey) {
    const bio = D.biomes[biomeKey]; const P = bio.ground; const rnd = U.rng(U.hashStr(biomeKey));
    GFX.terr = {}; GFX.terrAvg = {}; const seedBase = U.hashStr(biomeKey) % 1000;
    const make = (id, arr, opt, deco) => {
      GFX.terr[id] = [];
      for (let v = 0; v < 4; v++) {
        const base = (id >= 2 && id <= 6) ? arr[0] : arr[v % arr.length]; const c = groundTile(base, opt, seedBase + id * 53 + v * 17); const x = c.getContext('2d');
        deco && deco(x, base, rnd, v); GFX.terr[id].push(c);
      }
      GFX.terrAvg[id] = arr[0];
    };
    const flowerCols = biomeKey === 'tropical' ? ['#f06a8a', '#f5d24a', '#ffffff', '#c06af0'] : ['#f1e46a', '#f5f5f5', '#e8879b', '#a9b8f0'];
    const grass = (x, base, rnd, v) => {
      // дрібний ґрунт між травою
      for (let k = 0; k < 10; k++) { x.fillStyle = 'rgba(40,28,14,0.12)'; wrapDraw(rnd() * TS, rnd() * TS, 3, (X, Y) => { x.beginPath(); x.ellipse(X, Y, 1 + rnd() * 2, 0.8 + rnd(), 0, 0, 6.3); x.fill(); }); }
      // плями світлішої й темнішої трави (м'яка варіація кольору)
      for (let k = 0; k < 7; k++) { const dark = rnd() < 0.5; x.fillStyle = dark ? 'rgba(10,30,6,0.13)' : 'rgba(210,240,130,0.10)'; wrapDraw(rnd() * TS, rnd() * TS, 9, (X, Y) => { x.beginPath(); x.ellipse(X, Y, 3 + rnd() * 5, 2 + rnd() * 3.5, rnd() * 3, 0, 6.3); x.fill(); }); }
      // нижній ярус: короткі темні стебла (глибина)
      for (let k = 0; k < 46; k++) { const px = rnd() * TS, py = rnd() * TS, l = 1.8 + rnd() * 2.4; wrapDraw(px, py, 4, (X, Y) => { x.strokeStyle = U.shade(base, -0.38); x.globalAlpha = 0.55; x.lineWidth = 1; x.beginPath(); x.moveTo(X, Y); x.lineTo(X + (rnd() - 0.5) * 1.6, Y - l); x.stroke(); }); }
      // основні жмути: стебла з градієнтом від темного кореня до світлого кінчика
      for (let k = 0; k < 58; k++) {
        const px = rnd() * TS, py = rnd() * TS, n = 3 + ((rnd() * 4) | 0), tone = rnd(), tall = rnd() < 0.18 ? 1.7 : 1;
        for (let b = 0; b < n; b++) {
          const l = (3 + rnd() * 5) * tall, lean = (rnd() - 0.5) * 3.4 + (b - n / 2) * 0.55, ox0 = px + (b - n / 2) * 1.05;
          wrapDraw(ox0, py, 7, (X, Y) => {
            const mid = tone < 0.3 ? U.shade(base, -0.12) : tone < 0.7 ? U.shade(base, 0.12) : U.shade(base, 0.26), tip = tone < 0.3 ? U.shade(base, 0.08) : tone < 0.7 ? U.shade(base, 0.32) : U.shade(base, 0.5);
            x.globalAlpha = 0.92; x.lineWidth = 1.1; x.strokeStyle = U.shade(base, -0.34); x.beginPath(); x.moveTo(X, Y); x.lineTo(X + lean * 0.12, Y - l * 0.35); x.stroke();
            x.strokeStyle = mid; x.beginPath(); x.moveTo(X + lean * 0.12, Y - l * 0.35); x.quadraticCurveTo(X + lean * 0.35, Y - l * 0.7, X + lean * 0.7, Y - l * 0.82); x.stroke();
            x.lineWidth = 0.9; x.strokeStyle = tip; x.beginPath(); x.moveTo(X + lean * 0.7, Y - l * 0.82); x.lineTo(X + lean, Y - l); x.stroke();
          });
        }
        if (rnd() < 0.06 && biomeKey !== 'tundra') wrapDraw(px, py - 6, 3, (X, Y) => { x.globalAlpha = 0.9; x.fillStyle = '#d8c98a'; x.beginPath(); x.ellipse(X, Y, 1, 1.9, 0, 0, 6.3); x.fill(); }); // колоски
      }
      // світлі відблиски на кінчиках
      for (let k = 0; k < 26; k++) { x.globalAlpha = 0.55; x.fillStyle = 'rgba(235,255,170,0.9)'; x.fillRect(rnd() * TS, rnd() * TS, 1, 1); }
      x.globalAlpha = 1;
      if (biomeKey !== 'arid' && biomeKey !== 'tundra') {
        for (let k = 0; k < 2; k++) if (rnd() < 0.5) { // конюшина
          const px = rnd() * TS, py = rnd() * TS; wrapDraw(px, py, 5, (X, Y) => { x.fillStyle = U.shade(base, 0.22); for (let q = 0; q < 3; q++) { x.beginPath(); x.arc(X + Math.cos(q * 2.1) * 1.8, Y + Math.sin(q * 2.1) * 1.8, 1.5, 0, 6.3); x.fill(); } });
        }
        if (rnd() < 0.3) { const fx = rnd() * 28 + 2, fy = rnd() * 28 + 2, fc = U.pick(flowerCols); x.fillStyle = '#3a6a2a'; x.fillRect(fx + 0.5, fy + 1, 1, 3); x.fillStyle = fc; x.beginPath(); x.arc(fx + 1, fy, 1.7, 0, 6.3); x.fill(); x.fillStyle = '#f6e27a'; x.fillRect(fx + 0.5, fy - 0.5, 1, 1); }
      }
      if (rnd() < 0.35) pebble(x, rnd() * TS, rnd() * TS, 1.4 + rnd(), '#8a8780', rnd);
    };
    make(2, P.sand, { low: 9, mid: 9, fine: 9, warm: 4, contour: { thr: 0.03, amt: -13 } }, (x, base, rnd) => {
      for (let k = 0; k < 40; k++) { x.fillStyle = rnd() < 0.5 ? 'rgba(255,255,230,0.25)' : 'rgba(90,60,20,0.22)'; x.fillRect(rnd() * TS, rnd() * TS, 1, 1); }
      for (let k = 0; k < 3; k++) if (rnd() < 0.6) pebble(x, rnd() * TS, rnd() * TS, 1 + rnd() * 1.4, U.shade(base, -0.18), rnd);
      if (rnd() < 0.15) { const px = rnd() * 26 + 3, py = rnd() * 26 + 3; x.fillStyle = '#efe0cc'; x.beginPath(); x.arc(px, py, 2, 0, 6.3); x.fill(); x.strokeStyle = '#b99a78'; x.lineWidth = 0.7; x.beginPath(); x.moveTo(px, py + 2); x.lineTo(px, py - 2); x.moveTo(px - 1.4, py + 1.5); x.lineTo(px - 1.4, py - 1); x.moveTo(px + 1.4, py + 1.5); x.lineTo(px + 1.4, py - 1); x.stroke(); }
    });
    make(3, P.gravel, { low: 9, mid: 12, fine: 14, warm: 3 }, (x, base, rnd) => {
      for (let k = 0; k < 24; k++) pebble(x, rnd() * TS, rnd() * TS, 1 + rnd() * 2.4, base, rnd);
      for (let k = 0; k < 20; k++) { x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(rnd() * TS, rnd() * TS, 1, 1); }
      if (rnd() < 0.5) { x.strokeStyle = 'rgba(60,110,40,0.5)'; x.lineWidth = 1; const px = rnd() * TS, py = rnd() * TS; for (let b = 0; b < 3; b++) { x.beginPath(); x.moveTo(px + b, py); x.lineTo(px + b + (b - 1) * 1.5, py - 3); x.stroke(); } }
    });
    make(4, P.soil, { low: 9, mid: 13, fine: 11, warm: 4 }, grass);
    make(5, P.rich, { low: 9, mid: 13, fine: 10, warm: 4 }, (x, base, rnd, v) => { grass(x, base, rnd, v); x.fillStyle = 'rgba(20,12,4,0.22)'; for (let k = 0; k < 14; k++) x.fillRect(rnd() * TS, rnd() * TS, 1.5, 1); });
    make(6, P.snow, { low: 12, mid: 9, fine: 4, warm: 8 }, (x, base, rnd) => {
      for (let k = 0; k < 6; k++) { const px = rnd() * TS, py = rnd() * TS; wrapDraw(px, py, 8, (X, Y) => { x.fillStyle = 'rgba(140,168,205,0.22)'; x.beginPath(); x.ellipse(X, Y, 3 + rnd() * 5, 1.4 + rnd() * 2, rnd() * 3, 0, 6.3); x.fill(); x.fillStyle = 'rgba(255,255,255,0.55)'; x.beginPath(); x.ellipse(X - 1, Y - 1.5, 2 + rnd() * 3, 0.8 + rnd(), rnd() * 3, 0, 6.3); x.fill(); }); }
      for (let k = 0; k < 16; k++) { x.fillStyle = 'rgba(255,255,255,0.95)'; x.fillRect(rnd() * TS, rnd() * TS, 1, 1); }
      for (let k = 0; k < 5; k++) { x.fillStyle = 'rgba(120,150,190,0.35)'; x.fillRect(rnd() * TS, rnd() * TS, 1, 1); }
    });
    make(7, P.rock.map(c => U.shade(c, -0.22)), { low: 24, mid: 16, fine: 9, warm: 4 }, (x, base, rnd) => {
      x.strokeStyle = 'rgba(0,0,0,0.22)'; x.lineWidth = 1; x.strokeRect(0.5, 0.5, TS - 1, TS - 1); x.strokeStyle = 'rgba(255,255,255,0.1)'; x.strokeRect(1.5, 1.5, TS - 3, TS - 3);
      for (let k = 0; k < 2; k++) { x.strokeStyle = 'rgba(0,0,0,0.25)'; x.beginPath(); let px = rnd() * TS, py = rnd() * TS; x.moveTo(px, py); for (let s = 0; s < 3; s++) { px += (rnd() - 0.5) * 10; py += (rnd() - 0.5) * 10; x.lineTo(px, py); } x.stroke(); }
    });
    // вода: контури каустики
    GFX.terr[0] = [0, 1].map(v => groundTile('#1b3d5d', { low: 16, mid: 10, fine: 3, warm: 6, contour: { thr: 0.045, amt: 16 } }, seedBase + 900 + v));
    GFX.terr[1] = [0, 1].map(v => groundTile('#3f8aa4', { low: 20, mid: 12, fine: 4, warm: 10, contour: { thr: 0.05, amt: 24 } }, seedBase + 950 + v));
    for (const k of [0, 1]) for (const c of GFX.terr[k]) { const x = c.getContext('2d'); if (k === 1) { for (let q = 0; q < 12; q++) { x.fillStyle = 'rgba(214,194,140,0.22)'; x.beginPath(); x.arc(rnd() * TS, rnd() * TS, 1 + rnd() * 2, 0, 6.3); x.fill(); } } for (let q = 0; q < 6; q++) { x.fillStyle = 'rgba(255,255,255,0.1)'; x.fillRect(rnd() * TS, rnd() * TS, 3 + rnd() * 4, 1); } }
    GFX.terrAvg[0] = '#1b3d5d'; GFX.terrAvg[1] = '#3f8aa4';
    // скеля: шари, тріщини, вкраплення
    GFX.rockTex = [];
    for (let v = 0; v < 4; v++) {
      const base = P.rock[0]; const c = groundTile(base, { low: 34, mid: 26, fine: 14, warm: 6 }, seedBase + 300 + v * 13); const x = c.getContext('2d');
      for (let k = 0; k < 6; k++) { const y0 = rnd() * TS * 1.4 - 6, sl = 0.25 + rnd() * 0.3, th = 1.5 + rnd() * 3.5; const dark = rnd() < 0.5; x.fillStyle = dark ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.08)'; wrapDraw(0, 0, 0, () => { }); x.beginPath(); x.moveTo(0, y0); x.lineTo(TS, y0 + TS * sl); x.lineTo(TS, y0 + TS * sl + th); x.lineTo(0, y0 + th); x.closePath(); x.fill(); }
      for (let k = 0; k < 3; k++) {
        let px = rnd() * TS, py = rnd() * TS; const pts = [[px, py]]; for (let s = 0; s < 4; s++) { px += (rnd() - 0.5) * 13; py += (rnd() - 0.5) * 13; pts.push([px, py]); }
        x.strokeStyle = 'rgba(0,0,0,0.42)'; x.lineWidth = 1; x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (const p of pts) x.lineTo(p[0], p[1]); x.stroke();
        x.strokeStyle = 'rgba(255,255,255,0.16)'; x.beginPath(); x.moveTo(pts[0][0] + 1, pts[0][1] + 1); for (const p of pts) x.lineTo(p[0] + 1, p[1] + 1); x.stroke();
      }
      for (let k = 0; k < 7; k++) { const px = rnd() * TS, py = rnd() * TS; wrapDraw(px, py, 3, (X, Y) => { x.fillStyle = 'rgba(0,0,0,0.3)'; x.beginPath(); x.ellipse(X, Y, 1.4, 1, 0, 0, 6.3); x.fill(); x.fillStyle = 'rgba(255,255,255,0.22)'; x.fillRect(X - 1, Y + 0.6, 2, 0.8); }); }
      for (let k = 0; k < 16; k++) { x.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'; x.fillRect(rnd() * TS, rnd() * TS, 1, 1); }
      if (rnd() < 0.6) { x.fillStyle = U.pick(['rgba(70,90,50,0.4)', 'rgba(150,140,60,0.35)']); const px = rnd() * 26, py = rnd() * 26; for (let q = 0; q < 5; q++) { x.beginPath(); x.arc(px + rnd() * 6, py + rnd() * 6, 1 + rnd() * 1.4, 0, 6.3); x.fill(); } } // лишайник
      GFX.rockTex.push(c);
    }
    GFX.rockColor = P.rock[0];
    GFX.floorTex = {};
    // дерев'яна підлога: дошки з прожилками, цвяхи
    GFX.floorTex[1] = [0, 1, 2, 3].map(v => mk(TS, TS, (x) => {
      const n = tnoise(400 + v, TS, 2, 3); const img = x.createImageData(TS, TS);
      for (let yy = 0; yy < TS; yy++) { const plank = (yy / 8) | 0; const pj = (U.hash2(plank, v, 3) - 0.5) * 34; for (let xx = 0; xx < TS; xx++) { const i = yy * TS + xx; const grain = Math.sin(xx * 0.55 + n[i] * 9 + plank * 2) * 7; const val = (n[i] - 0.5) * 40 + pj + grain + (U.hash2(xx, yy, v) - 0.5) * 10; img.data[i * 4] = 170 + val; img.data[i * 4 + 1] = 120 + val * 0.85; img.data[i * 4 + 2] = 72 + val * 0.6; img.data[i * 4 + 3] = 255; } }
      x.putImageData(img, 0, 0);
      for (let k = 0; k < 4; k++) { x.fillStyle = 'rgba(40,22,8,0.6)'; x.fillRect(0, k * 8, TS, 1); x.fillStyle = 'rgba(255,230,180,0.18)'; x.fillRect(0, k * 8 + 1, TS, 1); const sx = ((k * 11 + v * 7) % 26) + 3; x.fillStyle = 'rgba(40,22,8,0.55)'; x.fillRect(sx, k * 8 + 1, 1, 7); x.fillStyle = 'rgba(30,20,10,0.7)'; x.fillRect(sx + 2, k * 8 + 3, 1, 1); x.fillRect(sx - 3, k * 8 + 5, 1, 1); }
      if (v % 2) { x.fillStyle = 'rgba(70,40,15,0.55)'; x.beginPath(); x.ellipse(9 + v * 4, 12, 2.2, 1.4, 0, 0, 6.3); x.fill(); x.strokeStyle = 'rgba(70,40,15,0.4)'; x.beginPath(); x.ellipse(9 + v * 4, 12, 3.6, 2.4, 0, 0, 6.3); x.stroke(); }
    }));
    // кам'яна плитка з фасками
    GFX.floorTex[2] = [0, 1, 2, 3].map(v => mk(TS, TS, (x) => {
      const c0 = groundTile('#8d8e92', { low: 20, mid: 14, fine: 10, warm: 4 }, 500 + v); x.drawImage(c0, 0, 0);
      x.fillStyle = 'rgba(20,20,24,0.65)'; x.fillRect(0, 0, TS, 1.5); x.fillRect(0, 15, TS, 1.5); x.fillRect(0, 0, 1.5, TS); x.fillRect(15, 0, 1.5, TS);
      for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) { const X = a * 16 + 1.5, Y = b * 16 + 1.5; const sh = (U.hash2(a + v, b, 8) - 0.5) * 0.14; x.fillStyle = U.rgba(sh > 0 ? '#ffffff' : '#000000', Math.abs(sh)); x.fillRect(X, Y, 14, 14); x.fillStyle = 'rgba(255,255,255,0.3)'; x.fillRect(X, Y, 14, 1); x.fillRect(X, Y, 1, 14); x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(X, Y + 13, 14, 1); x.fillRect(X + 13, Y, 1, 14); }
      x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 0.7; const r2 = U.rng(500 + v); x.beginPath(); const px = r2() * 24 + 2, py = r2() * 24 + 2; x.moveTo(px, py); x.lineTo(px + 4, py + 3); x.lineTo(px + 6, py + 2); x.stroke();
    }));
    // сталева підлога: щітка, заклепки, подряпини
    GFX.floorTex[3] = [0, 1, 2, 3].map(v => mk(TS, TS, (x) => {
      const c0 = groundTile('#6f7c88', { low: 12, mid: 8, fine: 12, warm: 0 }, 600 + v); x.drawImage(c0, 0, 0);
      const r2 = U.rng(600 + v); for (let k = 0; k < 22; k++) { x.fillStyle = r2() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'; x.fillRect(r2() * TS, 0, 1, TS); }
      x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 1; x.strokeRect(0.5, 0.5, TS - 1, TS - 1); x.strokeStyle = 'rgba(255,255,255,0.22)'; x.strokeRect(1.5, 1.5, TS - 3, TS - 3);
      for (const [px, py] of [[4, 4], [27, 4], [4, 27], [27, 27]]) { x.fillStyle = '#39424b'; x.beginPath(); x.arc(px, py, 1.8, 0, 6.3); x.fill(); x.fillStyle = 'rgba(255,255,255,0.5)'; x.fillRect(px - 1, py - 1, 1, 1); }
      x.strokeStyle = 'rgba(255,255,255,0.14)'; x.lineWidth = 1; x.beginPath(); x.moveTo(5, 14); x.lineTo(27, 14); x.moveTo(5, 18); x.lineTo(27, 18); x.stroke();
      for (let k = 0; k < 3; k++) { x.strokeStyle = 'rgba(255,255,255,0.18)'; x.beginPath(); const px = r2() * 22 + 4, py = r2() * 22 + 4; x.moveTo(px, py); x.lineTo(px + 5 + r2() * 4, py + (r2() - 0.5) * 4); x.stroke(); }
    }));
    GFX.initSeason(0);
  };

  // ---------------------------------------------------------------
  //  Дерева та рослини (по сезонах)
  // ---------------------------------------------------------------
  GFX.treeSprites = {}; GFX.plantSprites = {};
  const SEASON_LEAF = [['#4f8c3a', '#5fa044', '#3f7a30'], ['#3f7d34', '#4c8f3c', '#336a2a'], ['#c0782a', '#d09a32', '#a85a26'], ['#6a7f5a', '#7d9070', '#58694c']];
  GFX.initSeason = function (s) {
    GFX.season = s; GFX.treeSprites = {};
    for (const k of Object.keys(D.plants)) if (D.plants[k].tree) {
      GFX.treeSprites[k] = [0, 1, 2].map(v => treeSprite(k, s, v));
    }
  };
  function circ(x, px, py, r) { x.beginPath(); x.arc(px, py, r, 0, 6.3); x.fill(); }
  function leaf(x, px, py, ang, len, col) { x.fillStyle = col; x.beginPath(); x.ellipse(px, py, len, len * 0.42, ang, 0, 6.3); x.fill(); }
  function crown(x, cx, cy, rx, ry, L, n, rnd, dens) {
    // м'яка тінь крони на землі
    x.fillStyle = U.shade(L[2], -0.5); x.globalAlpha = 0.55; x.beginPath(); x.ellipse(cx + 1.5, cy + 4, rx + 1.5, ry * 0.92, 0, 0, 6.3); x.fill(); x.globalAlpha = 1;
    const blobs = [];
    for (let k = 0; k < n; k++) { const a = rnd() * 6.28, d = Math.sqrt(rnd()); blobs.push({ bx: cx + Math.cos(a) * d * rx * 0.84, by: cy + Math.sin(a) * d * ry * 0.84, r: 3.4 + rnd() * 3.8 }); }
    blobs.sort((a, b) => a.by - b.by);
    for (const b of blobs) {
      const h = 1 - (b.by - (cy - ry)) / (2 * ry);
      x.fillStyle = U.shade(L[2], -0.42); circle(x, b.bx + 0.8, b.by + 1.6, b.r);
      x.fillStyle = h > 0.62 ? L[1] : h > 0.3 ? L[0] : L[2]; circle(x, b.bx, b.by, b.r);
      const gg = x.createRadialGradient(b.bx - b.r * 0.35, b.by - b.r * 0.4, 0.5, b.bx, b.by, b.r); gg.addColorStop(0, 'rgba(255,255,200,' + (0.12 + h * 0.28).toFixed(2) + ')'); gg.addColorStop(1, 'rgba(0,20,0,0.18)'); x.fillStyle = gg; circle(x, b.bx, b.by, b.r);
    }
    // окремі листки: темні всередині, світлі зверху
    const cnt = (dens || n * 3) * 2;
    for (let k = 0; k < cnt; k++) {
      const a = rnd() * 6.28, d = Math.sqrt(rnd()); const px = cx + Math.cos(a) * d * rx * 0.97, py = cy + Math.sin(a) * d * ry * 0.97; const h = 1 - (py - (cy - ry)) / (2 * ry); const t = rnd();
      const col = t < 0.28 ? U.shade(L[2], -0.2) : t < 0.6 ? U.shade(L[0], h * 0.12) : U.shade(L[1], 0.1 + h * 0.2);
      leaf(x, px, py, rnd() * 3.1, 1.5 + rnd() * 1.6, col);
      if (t > 0.9) { x.fillStyle = 'rgba(255,255,170,0.55)'; x.fillRect(px - 0.5, py - 0.5, 1.2, 1.2); }
    }
    // сонячні плями й нижня тінь
    x.save(); x.globalCompositeOperation = 'source-atop'; const og = x.createLinearGradient(0, cy - ry, 0, cy + ry); og.addColorStop(0, 'rgba(255,255,190,0.12)'); og.addColorStop(0.5, 'rgba(0,0,0,0)'); og.addColorStop(1, 'rgba(0,12,10,0.32)'); x.fillStyle = og; x.fillRect(cx - rx - 4, cy - ry - 4, rx * 2 + 8, ry * 2 + 8); x.restore();
    // просвіти між листям
    for (let k = 0; k < n * 0.4; k++) { const a = rnd() * 6.28, d = Math.sqrt(rnd()) * 0.8; x.fillStyle = 'rgba(8,24,10,0.45)'; circle(x, cx + Math.cos(a) * d * rx, cy + 3 + Math.sin(a) * d * ry * 0.8, 0.9 + rnd() * 0.9); }
  }
  function circle(x, px, py, r) { x.beginPath(); x.arc(px, py, r, 0, 6.3); x.fill(); }
  function bark(x, X, Y, w, h, base, rnd) {
    const g = x.createLinearGradient(X, 0, X + w, 0); g.addColorStop(0, U.shade(base, 0.22)); g.addColorStop(0.5, base); g.addColorStop(1, U.shade(base, -0.38)); x.fillStyle = g; x.fillRect(X, Y, w, h);
    for (let k = 0; k < h / 2.5; k++) { x.fillStyle = 'rgba(0,0,0,' + (0.12 + rnd() * 0.18).toFixed(2) + ')'; x.fillRect(X + rnd() * (w - 1), Y + k * 2.5 + rnd() * 2, 1, 2 + rnd() * 3); }
    x.fillStyle = 'rgba(255,255,255,0.14)'; x.fillRect(X + 1, Y, 1, h);
    x.fillStyle = 'rgba(70,100,40,0.35)'; for (let k = 0; k < h / 5; k++) x.fillRect(X + (rnd() < 0.5 ? 0 : w - 2), Y + h - 3 - rnd() * h * 0.5, 2, 2 + rnd() * 2);
    if (w > 4) { x.fillStyle = 'rgba(20,10,4,0.55)'; x.beginPath(); x.ellipse(X + w * 0.5, Y + h * 0.45, 1.2, 1.7, 0, 0, 6.3); x.fill(); }
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(X, Y + h - 2, w, 2);
  }
  function treeSprite(kind, season, v) {
    const rnd = U.rng(kind.length * 31 + v * 17 + season * 5 + 3);
    return finish(mk(64, 72, (x) => {
      const cx = 32; const L = SEASON_LEAF[season]; const winter = season === 3; const bare = winter && kind !== 'tree_pine';
      x.fillStyle = 'rgba(0,0,0,0.28)'; x.beginPath(); x.ellipse(cx + 5, 60, 18, 6, 0, 0, 6.3); x.fill();
      if (kind === 'tree_pine') {
        bark(x, cx - 2, 44, 5, 17, '#4e3524', rnd);
        const g = winter ? ['#2f4a3a', '#3a5a46', '#4a7660'] : ['#1f4a28', '#2c6334', '#3d7d44'];
        for (let t = 0; t < 5; t++) {
          const w = 21 - t * 3.7, y = 50 - t * 8.5, top = y - 13;
          x.fillStyle = U.shade(g[0], -0.2); x.beginPath(); x.moveTo(cx, top); x.lineTo(cx + w + 1, y + 5); x.lineTo(cx - w - 1, y + 5); x.closePath(); x.fill();
          x.fillStyle = g[t % 3]; x.beginPath(); x.moveTo(cx, top); x.lineTo(cx + w, y + 3); x.lineTo(cx - w, y + 3); x.closePath(); x.fill();
          // голки
          for (let k = 0; k < 16; k++) { const yy = top + 3 + rnd() * (y - top), half = (yy - top) / (y + 3 - top) * w; const xx = cx + (rnd() * 2 - 1) * half; x.strokeStyle = rnd() < 0.5 ? g[2] : U.shade(g[0], -0.1); x.lineWidth = 1; x.beginPath(); x.moveTo(xx, yy); x.lineTo(xx + (xx > cx ? 2.4 : -2.4), yy + 2.4); x.stroke(); }
          x.fillStyle = 'rgba(0,0,0,0.22)'; x.beginPath(); x.moveTo(cx, top); x.lineTo(cx + w, y + 3); x.lineTo(cx + w * 0.15, y + 3); x.closePath(); x.fill();
          x.fillStyle = 'rgba(210,255,200,0.12)'; x.beginPath(); x.moveTo(cx, top); x.lineTo(cx - w * 0.9, y + 2); x.lineTo(cx - w * 0.3, y + 3); x.closePath(); x.fill();
          if (winter) { x.fillStyle = 'rgba(255,255,255,0.85)'; x.beginPath(); x.moveTo(cx, top); x.lineTo(cx + w * 0.6, y - 2); x.quadraticCurveTo(cx, y - 5, cx - w * 0.6, y - 2); x.closePath(); x.fill(); }
        }
        x.fillStyle = '#7a4a28'; for (let k = 0; k < 3; k++) { x.beginPath(); x.ellipse(cx - 6 + k * 6, 40 + k * 3, 1.5, 2.4, 0, 0, 6.3); x.fill(); }
      } else if (kind === 'tree_palm') {
        const sway = 5 + v * 2;
        // стовбур з кільцями
        x.strokeStyle = '#7a5a30'; x.lineWidth = 5; x.beginPath(); x.moveTo(cx, 58); x.quadraticCurveTo(cx + sway, 40, cx + 2, 24); x.stroke();
        x.strokeStyle = '#a07a44'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(cx - 1, 58); x.quadraticCurveTo(cx + sway - 1, 40, cx + 1, 24); x.stroke();
        for (let k = 0; k < 9; k++) { const t = k / 9; const px = (1 - t) * (1 - t) * cx + 2 * (1 - t) * t * (cx + sway) + t * t * (cx + 2), py = (1 - t) * (1 - t) * 58 + 2 * (1 - t) * t * 40 + t * t * 24; x.strokeStyle = 'rgba(40,24,8,0.5)'; x.lineWidth = 1; x.beginPath(); x.moveTo(px - 2.5, py); x.lineTo(px + 2.5, py + 0.5); x.stroke(); }
        for (let k = 0; k < 9; k++) {
          const a = k / 9 * 6.28 + v * 0.7, ex = cx + 2 + Math.cos(a) * 24, ey = 25 + Math.sin(a) * 11 + 6; const mx = cx + 2 + Math.cos(a) * 12, my = 12 + Math.sin(a) * 5;
          x.strokeStyle = '#3a7a34'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(cx + 2, 24); x.quadraticCurveTo(mx, my, ex, ey); x.stroke();
          for (let s = 1; s < 8; s++) { const t = s / 8; const px = (1 - t) * (1 - t) * (cx + 2) + 2 * (1 - t) * t * mx + t * t * ex, py = (1 - t) * (1 - t) * 24 + 2 * (1 - t) * t * my + t * t * ey; const nx = -(ey - 24) , ny = (ex - cx - 2); const nl = Math.hypot(nx, ny) || 1; const ll = 5 * (1 - t * 0.5); x.strokeStyle = s % 2 ? '#4fa046' : '#3f8a3c'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(px, py); x.lineTo(px + nx / nl * ll, py + ny / nl * ll + 2); x.moveTo(px, py); x.lineTo(px - nx / nl * ll, py - ny / nl * ll + 2); x.stroke(); }
        }
        x.fillStyle = '#5a3a18'; for (let k = 0; k < 3; k++) circle(x, cx - 1 + k * 3, 27 + (k % 2), 2.3); x.fillStyle = 'rgba(255,255,255,0.3)'; for (let k = 0; k < 3; k++) x.fillRect(cx - 2 + k * 3, 26 + (k % 2), 1, 1);
      } else {
        const birch = kind === 'tree_birch';
        if (birch) {
          bark(x, cx - 2, 38, 5, 23, '#e2ded2', rnd); x.fillStyle = '#242220'; for (let k = 0; k < 7; k++) x.fillRect(cx - 2 + (k % 2), 40 + k * 3, 2 + (k % 3), 1);
          x.fillStyle = '#d4d0c4'; x.fillRect(cx - 3, 58, 7, 3);
          if (bare) { x.strokeStyle = '#cfcabd'; x.lineWidth = 1.6; for (let k = 0; k < 7; k++) { const a = -2.9 + k * 0.45; x.beginPath(); x.moveTo(cx, 42); x.quadraticCurveTo(cx + Math.cos(a) * 7, 32, cx + Math.cos(a) * 13, 17 + Math.abs(Math.sin(a)) * 7); x.stroke(); } }
          else crown(x, cx, 28, 15, 16, L.map(c => U.shade(c, 0.1)), 26, rnd);
        } else {
          // дуб: коріння, стовбур, гілки
          bark(x, cx - 4, 38, 8, 22, '#5a3d28', rnd);
          x.fillStyle = '#4a3220'; x.beginPath(); x.moveTo(cx - 4, 58); x.lineTo(cx - 9, 62); x.lineTo(cx - 2, 60); x.closePath(); x.fill(); x.beginPath(); x.moveTo(cx + 4, 58); x.lineTo(cx + 9, 62); x.lineTo(cx + 2, 60); x.closePath(); x.fill();
          x.strokeStyle = '#4e3524'; x.lineWidth = 3; x.beginPath(); x.moveTo(cx - 2, 42); x.lineTo(cx - 10, 32); x.moveTo(cx + 2, 42); x.lineTo(cx + 10, 33); x.stroke();
          if (bare) { x.strokeStyle = '#4a3626'; x.lineWidth = 2.4; for (let k = 0; k < 7; k++) { const a = -2.8 + k * 0.45; x.beginPath(); x.moveTo(cx, 40); x.quadraticCurveTo(cx + Math.cos(a) * 9, 30, cx + Math.cos(a) * 18, 16 + Math.abs(Math.sin(a)) * 8); x.stroke(); } x.fillStyle = 'rgba(255,255,255,0.75)'; x.fillRect(cx - 5, 38, 10, 2); }
          else crown(x, cx, 27, 22, 17, L, 40, rnd);
        }
      }
    }), { grain: 0.18, light: 0.1, dark: 0.18 });
  }
  GFX.plantSprite = function (def, growth, hp) {
    const stage = growth >= 1 ? 3 : growth > 0.66 ? 2 : growth > 0.25 ? 1 : 0;
    const key = def + stage; if (GFX.plantSprites[key]) return GFX.plantSprites[key];
    const pd = D.plants[def]; const rnd = U.rng(U.hashStr(key));
    const c = mk(TS, TS, (x) => {
      const blade = (px, py, h, lean, col, w) => { x.strokeStyle = col; x.lineWidth = w || 1.4; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + lean * 0.3, py - h * 0.6, px + lean, py - h); x.stroke(); };
      if (def === 'bush_berry') {
        x.fillStyle = 'rgba(0,0,0,0.25)'; x.beginPath(); x.ellipse(17, 26, 12, 4, 0, 0, 6.3); x.fill();
        const s = stage === 0 ? 0.55 : stage === 1 ? 0.8 : 1; const L = ['#2f6a28', '#3f7c34', '#559046'];
        crown(x, 16, 19, 11 * s, 8 * s, L, 14, rnd, 24);
        if (stage === 3) for (let k = 0; k < 11; k++) { const bx = 8 + rnd() * 16, by = 11 + rnd() * 11; x.fillStyle = '#7a1230'; circle(x, bx + 0.4, by + 0.5, 2); x.fillStyle = '#d23a68'; circle(x, bx, by, 1.8); x.fillStyle = 'rgba(255,255,255,0.7)'; x.fillRect(bx - 0.8, by - 0.8, 0.9, 0.9); }
      } else if (def === 'wild_healroot' || def === 'healroot') {
        x.fillStyle = 'rgba(0,0,0,0.18)'; x.beginPath(); x.ellipse(16, 25, 7, 2.5, 0, 0, 6.3); x.fill();
        for (let k = 0; k < 6 + stage * 2; k++) { const a = -1.9 + k * 0.34; const h = 6 + stage * 2 + rnd() * 3; blade(16, 25, h, Math.cos(a) * 7, ['#3a8a36', '#4fa046', '#62b856'][k % 3], 2.2); x.fillStyle = ['#3a8a36', '#4fa046', '#62b856'][k % 3]; x.beginPath(); x.ellipse(16 + Math.cos(a) * 7, 25 - h, 2.2, 1.2, a, 0, 6.3); x.fill(); }
        if (stage === 3) { for (let k = 0; k < 3; k++) { x.fillStyle = '#f2a2bc'; circle(x, 12 + k * 4, 14 + (k % 2) * 2, 2.1); x.fillStyle = '#fff2a0'; circle(x, 12 + k * 4, 14 + (k % 2) * 2, 0.8); } }
      } else {
        // борозни ґрунту
        for (let k = 0; k < 3; k++) { const fy = 7 + k * 9; x.fillStyle = 'rgba(40,24,10,0.38)'; x.fillRect(0, fy + 3, TS, 3); x.fillStyle = 'rgba(255,230,180,0.12)'; x.fillRect(0, fy + 2, TS, 1); }
        const cols = def === 'potato' ? ['#3d7a34', '#4f9040', '#2f6a2c'] : def === 'corn' ? ['#4f9a3c', '#62ae4a', '#3c8434'] : def === 'cotton' ? ['#4a8a3a', '#5c9c48', '#3c7a30'] : ['#6aa84a', '#5a9a40', '#82bc58'];
        const sz = [3, 5, 8, 10][stage];
        for (let rx = 0; rx < 3; rx++) for (let ry = 0; ry < 3; ry++) {
          const px = 6 + rx * 10 + (rnd() - 0.5) * 3, py = 12 + ry * 9 + (rnd() - 0.5) * 2;
          x.fillStyle = 'rgba(0,0,0,0.18)'; x.beginPath(); x.ellipse(px + 1, py + 1, 3.5, 1.4, 0, 0, 6.3); x.fill();
          if (def === 'corn') {
            const h = sz + stage * 3; blade(px, py, h, (rnd() - 0.5) * 2, cols[0], 1.8);
            for (let b = 0; b < 2 + stage; b++) blade(px, py - h * (0.3 + b * 0.18), 4 + stage, (b % 2 ? 1 : -1) * (3 + stage), cols[1 + b % 2], 1.3);
            if (stage === 3) { x.fillStyle = '#e8c23a'; x.beginPath(); x.ellipse(px + 2, py - h * 0.55, 1.6, 3.2, 0.2, 0, 6.3); x.fill(); x.fillStyle = '#fff0a0'; x.fillRect(px + 1.5, py - h * 0.55 - 2, 1, 2); x.fillStyle = '#d8b030'; x.fillRect(px - 0.5, py - h, 3, 1.5); }
          } else if (def === 'cotton') {
            for (let b = 0; b < 4; b++) blade(px, py, sz * 0.7, (b - 1.5) * 2.2, cols[b % 3], 1.3);
            if (stage >= 2) for (let b = 0; b < 3; b++) { x.fillStyle = stage === 3 ? '#fcfcfc' : '#a8c890'; circle(x, px + (b - 1) * 2.8, py - sz * 0.55 - (b % 2) * 2, stage === 3 ? 2.3 : 1.2); if (stage === 3) { x.fillStyle = 'rgba(180,190,200,0.6)'; circle(x, px + (b - 1) * 2.8 + 0.6, py - sz * 0.55 - (b % 2) * 2 + 0.7, 1); } }
          } else if (def === 'potato') {
            for (let b = 0; b < 5; b++) { const a = -2.6 + b * 0.55; x.fillStyle = cols[b % 3]; x.beginPath(); x.ellipse(px + Math.cos(a) * 3, py - 2 - sz * 0.4 + Math.sin(a) * 2, 2.8, 1.7, a * 0.5, 0, 6.3); x.fill(); }
            if (stage === 3) { x.fillStyle = '#f6f2f8'; circle(x, px, py - sz * 0.7, 1.4); circle(x, px + 3, py - sz * 0.5, 1.2); x.fillStyle = '#b48c50'; circle(x, px - 3, py + 1.5, 1.8); }
          } else {
            for (let b = 0; b < 5; b++) blade(px, py, sz + rnd() * 2, (b - 2) * (1 + stage * 0.6), cols[b % 3], 1.2);
            if (stage === 3) { for (let b = 0; b < 3; b++) { const hx = px + (b - 1) * 2.4; x.strokeStyle = '#d8c868'; x.lineWidth = 1; x.beginPath(); x.moveTo(hx, py - sz); x.quadraticCurveTo(hx + 2, py - sz - 3, hx + 3, py - sz + 1); x.stroke(); x.fillStyle = '#efe08a'; for (let q = 0; q < 3; q++) x.fillRect(hx + q * 0.8, py - sz - 2 + q, 1, 1.4); } }
          }
        }
      }
    });
    GFX.plantSprites[key] = finish(c, { noOutline: true, grain: 0.12, light: 0.08, dark: 0.1 }); return GFX.plantSprites[key];
  };

  // ---------------------------------------------------------------
  //  Стіни, двері
  // ---------------------------------------------------------------
  GFX.wallCache = {};
  GFX.wallSprite = function (defKey, mask) {
    const key = defKey + mask; if (GFX.wallCache[key]) return GFX.wallCache[key];
    const d = D.bld[defKey]; const base = d.color; const rnd = U.rng(U.hashStr(defKey));
    const c = mk(TS, TS, (x) => {
      const t0 = groundTile(base, { low: 22, mid: 16, fine: 12, warm: 4 }, U.hashStr(defKey) % 997); x.drawImage(t0, 0, 0);
      if (defKey === 'wall_wood') {
        for (let k = 0; k < 4; k++) {
          x.fillStyle = U.rgba((rnd() < 0.5 ? '#ffffff' : '#000000'), 0.07); x.fillRect(0, k * 8, TS, 7);
          x.strokeStyle = 'rgba(30,16,6,0.28)'; x.lineWidth = 0.8; for (let g = 0; g < 3; g++) { const gy = k * 8 + 1.5 + g * 2; x.beginPath(); x.moveTo(0, gy); x.bezierCurveTo(10, gy + (rnd() - 0.5) * 2, 22, gy + (rnd() - 0.5) * 2, TS, gy); x.stroke(); }
          x.fillStyle = 'rgba(25,12,4,0.65)'; x.fillRect(0, k * 8 + 7, TS, 1); x.fillStyle = 'rgba(255,230,180,0.18)'; x.fillRect(0, k * 8, TS, 1);
          const kx = 4 + rnd() * 24; if (rnd() < 0.5) { x.fillStyle = 'rgba(40,20,6,0.6)'; x.beginPath(); x.ellipse(kx, k * 8 + 3.5, 1.8, 1.2, 0, 0, 6.3); x.fill(); }
          x.fillStyle = 'rgba(20,12,6,0.7)'; x.fillRect(3, k * 8 + 3, 1, 1); x.fillRect(28, k * 8 + 3, 1, 1);
        }
      } else if (defKey === 'wall_stone') {
        for (let r = 0; r < 4; r++) { const off = r % 2 ? 8 : 0; for (let q = -1; q < 3; q++) { const X = q * 16 - off + 1, Y = r * 8 + 1, w = 15, h = 7; const sh = (rnd() - 0.5) * 0.28; x.fillStyle = U.rgba(sh > 0 ? '#ffffff' : '#000000', Math.abs(sh)); x.fillRect(X, Y, w, h); x.fillStyle = 'rgba(255,255,255,0.28)'; x.fillRect(X, Y, w, 1); x.fillRect(X, Y, 1, h); x.fillStyle = 'rgba(0,0,0,0.28)'; x.fillRect(X, Y + h - 1, w, 1); x.fillRect(X + w - 1, Y, 1, h); for (let k = 0; k < 4; k++) { x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(X + 1 + rnd() * (w - 3), Y + 1 + rnd() * (h - 3), 1, 1); } } }
        x.fillStyle = 'rgba(30,26,22,0.55)'; for (let r = 0; r < 4; r++) x.fillRect(0, r * 8, TS, 1);
      } else {
        x.fillStyle = U.shade(base, 0.1); x.fillRect(2, 2, TS - 4, TS - 4);
        const r2 = U.rng(3); for (let k = 0; k < 26; k++) { x.fillStyle = r2() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'; x.fillRect(r2() * TS, 2, 1, TS - 4); }
        x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 1; x.strokeRect(2.5, 2.5, TS - 5, TS - 5); x.strokeStyle = 'rgba(255,255,255,0.22)'; x.strokeRect(3.5, 3.5, TS - 7, TS - 7);
        for (const [px, py] of [[6, 6], [25, 6], [6, 25], [25, 25]]) { x.fillStyle = '#2a3036'; circle(x, px + 0.5, py + 0.5, 2); x.fillStyle = '#9aa6b0'; circle(x, px, py, 1.6); x.fillStyle = 'rgba(255,255,255,0.8)'; x.fillRect(px - 1, py - 1, 1, 1); }
        x.strokeStyle = 'rgba(0,0,0,0.3)'; x.beginPath(); x.moveTo(5, 16); x.lineTo(27, 16); x.stroke(); x.strokeStyle = 'rgba(255,255,255,0.2)'; x.beginPath(); x.moveTo(5, 17); x.lineTo(27, 17); x.stroke();
      }
      if (!(mask & 1)) { x.fillStyle = 'rgba(255,255,255,0.3)'; x.fillRect(0, 0, TS, 3); x.fillStyle = 'rgba(255,255,255,0.15)'; x.fillRect(0, 3, TS, 1); }
      if (!(mask & 2)) { x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(TS - 3, 0, 3, TS); }
      if (!(mask & 4)) { const g = x.createLinearGradient(0, TS - 8, 0, TS); g.addColorStop(0, 'rgba(0,0,0,0.1)'); g.addColorStop(1, 'rgba(0,0,0,0.62)'); x.fillStyle = g; x.fillRect(0, TS - 8, TS, 8); }
      if (!(mask & 8)) { x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(0, 0, 3, TS); }
    });
    GFX.wallCache[key] = c; return c;
  };

  // ---------------------------------------------------------------
  //  Спрайти будівель
  // ---------------------------------------------------------------
  GFX.bldCache = {};
  GFX.bldSprite = function (defKey, w, h) {
    const key = defKey + w + 'x' + h; if (GFX.bldCache[key]) return GFX.bldCache[key];
    const d = D.bld[defKey]; const W = w * TS, H = h * TS;
    const c = finish(mk(W, H, (x) => drawBld(x, d, defKey, W, H, w, h)), { grain: d.floor ? 0.1 : 0.3 });
    GFX.bldCache[key] = c; return c;
  };
  function rg0(x, cx, cy, r0, r1, stops) { const g = x.createRadialGradient(cx, cy, r0, cx, cy, r1); stops.forEach(s => g.addColorStop(s[0], s[1])); return g; }
  function drawBld(x, d, key, W, H, w, h) {
    const col = d.color; const rr = (X, Y, ww, hh, r) => { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + ww, Y, X + ww, Y + hh, r); x.arcTo(X + ww, Y + hh, X, Y + hh, r); x.arcTo(X, Y + hh, X, Y, r); x.arcTo(X, Y, X + ww, Y, r); x.closePath(); };
    const shadow = (px, py, pw, ph) => { x.fillStyle = 'rgba(0,0,0,0.22)'; rr(px + 2, py + 3, pw, ph, 3); x.fill(); };
    switch (key) {
      case 'bed': case 'hospital_bed': case 'sleeping_spot': {
        if (key === 'sleeping_spot') { x.fillStyle = 'rgba(0,0,0,0.18)'; rr(4, 4, W - 8, H - 8, 5); x.fill(); x.fillStyle = '#9a8a60'; rr(5, 5, W - 10, H - 10, 5); x.fill(); x.fillStyle = '#b8a878'; x.fillRect(8, 8, W - 16, 5); break; }
        const vertical = H > W; shadow(2, 2, W - 4, H - 4);
        x.fillStyle = key === 'bed' ? '#6a4a2c' : '#8a9aa6'; rr(2, 2, W - 4, H - 4, 4); x.fill();
        const mat = key === 'bed' ? '#c9b690' : '#e8eef2'; x.fillStyle = mat; rr(5, 5, W - 10, H - 10, 3); x.fill();
        x.fillStyle = key === 'bed' ? '#7e3a3a' : '#5a8aa8';
        if (vertical) { rr(5, 22, W - 10, H - 27, 3); x.fill(); x.fillStyle = '#f2f2ee'; rr(8, 7, W - 16, 12, 4); x.fill(); } else { rr(22, 5, W - 27, H - 10, 3); x.fill(); x.fillStyle = '#f2f2ee'; rr(7, 8, 12, H - 16, 4); x.fill(); }
        if (key === 'hospital_bed') { x.fillStyle = '#d33'; x.fillRect(vertical ? W / 2 - 1 : W / 2, vertical ? H - 16 : H / 2 - 4, vertical ? 2 : 2, 8); x.fillRect(vertical ? W / 2 - 4 : W / 2 - 3, vertical ? H - 13 : H / 2 - 1, 8, 2); }
        break;
      }
      case 'table': {
        shadow(2, 4, W - 4, H - 6); x.fillStyle = '#6a4424'; rr(2, 3, W - 4, H - 6, 3); x.fill(); x.fillStyle = '#9a6a3a'; rr(3, 3, W - 6, H - 9, 3); x.fill();
        x.strokeStyle = 'rgba(0,0,0,0.15)'; for (let k = 0; k < 4; k++) { x.beginPath(); x.moveTo(5, 8 + k * 4); x.lineTo(W - 5, 8 + k * 4); x.stroke(); }
        x.fillStyle = '#e8d8b8'; x.beginPath(); x.arc(W * 0.3, H * 0.45, 4, 0, 6.3); x.fill(); x.beginPath(); x.arc(W * 0.7, H * 0.45, 4, 0, 6.3); x.fill(); break;
      }
      case 'chair': { shadow(7, 7, 18, 18); x.fillStyle = '#6a4424'; rr(7, 6, 18, 18, 3); x.fill(); x.fillStyle = '#8a5a30'; rr(9, 8, 14, 14, 2); x.fill(); x.fillStyle = '#4a2e18'; x.fillRect(7, 4, 18, 4); break; }
      case 'workbench': {
        shadow(2, 4, W - 4, H - 6); x.fillStyle = '#5a3d22'; rr(2, 3, W - 4, H - 6, 2); x.fill(); x.fillStyle = '#8a6a44'; rr(3, 3, W - 6, H - 10, 2); x.fill();
        x.fillStyle = '#9aa'; x.fillRect(8, 8, 14, 3); x.fillStyle = '#6a4a28'; x.fillRect(8, 8, 5, 3); x.fillStyle = '#b44'; x.fillRect(38, 7, 6, 8); x.fillStyle = '#555'; x.fillRect(48, 9, 10, 4); break;
      }
      case 'stove': {
        shadow(2, 4, W - 4, H - 6); x.fillStyle = '#4a4a4e'; rr(2, 3, W - 4, H - 6, 3); x.fill(); x.fillStyle = '#2e2e32'; rr(4, 5, W - 8, H - 12, 2); x.fill();
        for (const bx of [W * 0.27, W * 0.73]) { x.strokeStyle = '#777'; x.lineWidth = 2; x.beginPath(); x.arc(bx, H * 0.42, 6, 0, 6.3); x.stroke(); x.beginPath(); x.arc(bx, H * 0.42, 3, 0, 6.3); x.stroke(); }
        x.fillStyle = '#9a9a9e'; x.fillRect(4, H - 10, W - 8, 3); break;
      }
      case 'brewery': { shadow(2, 4, W - 4, H - 6); x.fillStyle = '#4a3418'; rr(2, 3, W - 4, H - 6, 3); x.fill(); x.fillStyle = '#9a6a30'; rr(4, 5, W - 8, H - 12, 2); x.fill(); for (const bx of [W * 0.3, W * 0.7]) { x.fillStyle = '#6a4220'; x.beginPath(); x.ellipse(bx, H * 0.45, 9, 10, 0, 0, 6.3); x.fill(); x.strokeStyle = '#c8a050'; x.lineWidth = 1.6; for (const yy of [-5, 0, 5]) { x.beginPath(); x.ellipse(bx, H * 0.45 + yy, 9, 2, 0, 0, 6.3); x.stroke(); } x.fillStyle = '#e8b030'; x.fillRect(bx - 1.5, H * 0.45 + 6, 3, 4); } break; }
      case 'stonecutter': { shadow(2, 4, W - 4, H - 6); x.fillStyle = '#6a6a6a'; rr(2, 3, W - 4, H - 6, 2); x.fill(); x.fillStyle = '#9a9a98'; rr(4, 5, W - 8, H - 12, 2); x.fill(); x.fillStyle = '#c8c8c8'; x.beginPath(); x.arc(W * 0.35, H * 0.45, 8, 0, 6.3); x.fill(); x.strokeStyle = '#555'; x.lineWidth = 1; x.stroke(); x.fillStyle = '#7a7a7a'; x.fillRect(W * 0.55, H * 0.3, 14, 10); break; }
      case 'tailor_bench': { shadow(2, 4, W - 4, H - 6); x.fillStyle = '#6a3a4a'; rr(2, 3, W - 4, H - 6, 2); x.fill(); x.fillStyle = '#c8a8b4'; rr(4, 5, W - 8, H - 12, 2); x.fill(); x.fillStyle = '#e6e6e6'; x.fillRect(10, 10, 14, 9); x.fillStyle = '#d44'; x.beginPath(); x.arc(44, 14, 5, 0, 6.3); x.fill(); x.fillStyle = '#4a8'; x.fillRect(34, 18, 12, 4); break; }
      case 'machining': { shadow(2, 4, W - 4, H - 6); x.fillStyle = '#3e4a56'; rr(2, 3, W - 4, H - 6, 3); x.fill(); x.fillStyle = '#6a7a88'; rr(4, 5, W - 8, H - 12, 2); x.fill(); x.fillStyle = '#c80'; x.fillRect(8, 8, 18, 6); x.strokeStyle = '#222'; x.lineWidth = 2; x.beginPath(); x.arc(44, 15, 7, 0, 6.3); x.stroke(); for (let k = 0; k < 6; k++) { x.beginPath(); x.moveTo(44, 15); x.lineTo(44 + Math.cos(k) * 10, 15 + Math.sin(k) * 10); x.stroke(); } x.fillStyle = '#3df'; x.fillRect(30, H - 12, 6, 3); break; }
      case 'research_bench': { shadow(2, 4, W - 4, H - 6); x.fillStyle = '#34485c'; rr(2, 3, W - 4, H - 6, 3); x.fill(); x.fillStyle = '#5a7a96'; rr(4, 5, W - 8, H - 12, 2); x.fill(); x.fillStyle = '#0c2236'; x.fillRect(8, 8, 26, 14); x.fillStyle = '#4ff'; for (let k = 0; k < 4; k++) x.fillRect(10, 10 + k * 3, 6 + (k * 7) % 14, 1); x.fillStyle = '#ddd'; x.fillRect(40, 10, 16, 10); x.strokeStyle = '#444'; x.strokeRect(40.5, 10.5, 15, 9); break; }
      case 'heater': { shadow(4, 4, 24, 24); x.fillStyle = '#4a4a4e'; rr(4, 4, 24, 24, 3); x.fill(); x.fillStyle = '#c3422a'; for (let k = 0; k < 4; k++) x.fillRect(7, 8 + k * 5, 18, 2.5); break; }
      case 'cooler': { shadow(4, 4, 24, 24); x.fillStyle = '#4a5560'; rr(4, 4, 24, 24, 3); x.fill(); x.fillStyle = '#8ac'; x.beginPath(); x.arc(16, 16, 8, 0, 6.3); x.fill(); x.strokeStyle = '#246'; x.lineWidth = 2; for (let k = 0; k < 3; k++) { x.beginPath(); x.moveTo(16, 16); x.lineTo(16 + Math.cos(k * 2.1) * 8, 16 + Math.sin(k * 2.1) * 8); x.stroke(); } break; }
      case 'lamp': { x.fillStyle = 'rgba(0,0,0,0.25)'; x.beginPath(); x.ellipse(18, 24, 6, 3, 0, 0, 6.3); x.fill(); x.fillStyle = '#555'; x.beginPath(); x.arc(16, 16, 4, 0, 6.3); x.fill(); x.fillStyle = '#f4e4a8'; x.beginPath(); x.arc(16, 14, 6, 0, 6.3); x.fill(); x.fillStyle = '#fff6d0'; x.beginPath(); x.arc(15, 12, 2.5, 0, 6.3); x.fill(); break; }
      case 'torch': { x.fillStyle = 'rgba(0,0,0,0.25)'; x.beginPath(); x.ellipse(18, 26, 5, 2.5, 0, 0, 6.3); x.fill(); x.fillStyle = '#6a4a2a'; x.fillRect(14, 12, 4, 14); x.fillStyle = '#2a2a2a'; x.fillRect(12, 8, 8, 6); break; }
      case 'campfire': { x.fillStyle = 'rgba(0,0,0,0.25)'; x.beginPath(); x.ellipse(17, 24, 11, 4, 0, 0, 6.3); x.fill(); x.fillStyle = '#777'; for (let k = 0; k < 9; k++) { x.beginPath(); x.arc(16 + Math.cos(k * 0.7) * 11, 19 + Math.sin(k * 0.7) * 6, 2.4, 0, 6.3); x.fill(); } x.strokeStyle = '#4a3020'; x.lineWidth = 3; x.beginPath(); x.moveTo(9, 22); x.lineTo(23, 17); x.moveTo(9, 17); x.lineTo(23, 22); x.stroke(); break; }
      case 'conduit': { x.fillStyle = '#7a4a1a'; x.fillRect(13, 13, 6, 6); break; }
      case 'solar': { shadow(2, 2, W - 4, H - 4); x.fillStyle = '#2a2e38'; rr(2, 2, W - 4, H - 4, 3); x.fill(); for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) { const g = x.createLinearGradient(0, 0, W, H); x.fillStyle = (a + b) % 2 ? '#2c5da8' : '#3a70c0'; x.fillRect(4 + a * (W - 8) / 4 + 1, 4 + b * (H - 8) / 4 + 1, (W - 8) / 4 - 2, (H - 8) / 4 - 2); } x.fillStyle = 'rgba(255,255,255,0.18)'; x.beginPath(); x.moveTo(4, 4); x.lineTo(W * 0.7, 4); x.lineTo(4, H * 0.7); x.fill(); break; }
      case 'wood_gen': { shadow(2, 2, W - 4, H - 4); x.fillStyle = '#4a4e54'; rr(2, 2, W - 4, H - 4, 4); x.fill(); x.fillStyle = '#6a7078'; rr(5, 5, W - 10, 24, 3); x.fill(); x.fillStyle = '#222'; x.fillRect(W / 2 - 6, H - 22, 12, 12); x.fillStyle = '#8a8'; x.beginPath(); x.arc(W / 2, 17, 6, 0, 6.3); x.fill(); x.fillStyle = '#3a3a3a'; x.fillRect(W - 12, 6, 6, 16); break; }
      case 'battery': { shadow(4, 4, 24, 24); x.fillStyle = '#334'; rr(4, 4, 24, 24, 3); x.fill(); x.fillStyle = '#4c4'; x.fillRect(8, 8, 16, 5); x.fillStyle = '#4c4'; x.fillRect(8, 15, 16, 5); x.fillStyle = '#ccc'; x.fillRect(13, 2, 6, 3); break; }
      case 'sandbag': { for (let r = 0; r < 2; r++) for (let q = 0; q < 3; q++) { x.fillStyle = r ? '#a89060' : '#b8a070'; rr(3 + q * 9 + r * 4, 6 + r * 9, 11, 10, 4); x.fill(); x.strokeStyle = 'rgba(0,0,0,0.3)'; x.lineWidth = 1; x.stroke(); } break; }
      case 'turret': { shadow(3, 3, 26, 26); x.fillStyle = '#3d4650'; x.beginPath(); x.arc(16, 16, 12, 0, 6.3); x.fill(); x.fillStyle = '#5a6672'; x.beginPath(); x.arc(16, 16, 9, 0, 6.3); x.fill(); x.fillStyle = '#2a3036'; x.beginPath(); x.arc(16, 16, 4, 0, 6.3); x.fill(); break; }
      case 'horseshoes': { x.fillStyle = '#5a4a38'; x.fillRect(4, 6, 24, 20); x.fillStyle = '#8a7a5a'; x.fillRect(5, 7, 22, 18); x.fillStyle = '#888'; x.fillRect(9, 15, 2, 6); x.fillRect(21, 11, 2, 6); x.strokeStyle = '#aaa'; x.lineWidth = 1.5; x.beginPath(); x.arc(15, 12, 3, 0.4, 5.6); x.stroke(); break; }
      case 'chess': { shadow(3, 3, 26, 26); x.fillStyle = '#3a2a1a'; rr(3, 3, 26, 26, 2); x.fill(); for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) { x.fillStyle = (a + b) % 2 ? '#c8b080' : '#5a4028'; x.fillRect(5 + a * 3.7, 5 + b * 3.7, 3.7, 3.7); } x.fillStyle = '#eee'; x.beginPath(); x.arc(12, 12, 2, 0, 6.3); x.fill(); x.fillStyle = '#111'; x.beginPath(); x.arc(21, 20, 2, 0, 6.3); x.fill(); break; }
      case 'tv': { shadow(2, 4, W - 4, H - 8); x.fillStyle = '#16191d'; rr(2, 4, W - 4, H - 12, 3); x.fill(); x.fillStyle = '#2a4a6a'; rr(5, 7, W - 10, H - 18, 2); x.fill(); x.fillStyle = 'rgba(255,255,255,0.15)'; x.fillRect(7, 9, 14, 3); break; }
      case 'grave': { x.fillStyle = '#5a4630'; rr(5, 3, W - 10, H - 6, 6); x.fill(); x.fillStyle = '#6a5a40'; rr(7, 6, W - 14, H - 14, 5); x.fill(); x.fillStyle = '#9a9a98'; rr(10, H - 22, 12, 14, 4); x.fill(); x.fillStyle = '#6a6a68'; x.fillRect(15, H - 20, 2, 10); x.fillRect(12, H - 17, 8, 2); break; }
      case 'ship_wreck': {
        const rnd = U.rng(77);
        // випалена земля
        x.save(); x.translate(80, 52); x.scale(1, 0.62); x.fillStyle = rg0(x, 0, 0, 6, 78, [[0, 'rgba(14,10,8,0.8)'], [0.6, 'rgba(24,18,12,0.4)'], [1, 'rgba(24,18,12,0)']]); x.fillRect(-80, -80, 160, 160); x.restore();
        // відвали ґрунту
        for (let k = 0; k < 9; k++) { x.fillStyle = k % 2 ? '#5a4630' : '#6a5238'; x.beginPath(); x.ellipse(8 + k * 4, 40 + (k % 3) * 9, 9 - k * 0.4, 6, 0.3, 0, 6.3); x.fill(); x.fillStyle = 'rgba(255,230,190,0.15)'; x.fillRect(4 + k * 4, 34 + (k % 3) * 9, 5, 1); }
        // тінь корпусу
        x.fillStyle = 'rgba(0,0,0,0.38)'; x.beginPath(); x.ellipse(86, 66, 70, 10, 0, 0, 6.3); x.fill();
        const hull = (x0, x1, y0, y1, noseR) => {
          const g = x.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, '#d8dee6'); g.addColorStop(0.25, '#aab4c0'); g.addColorStop(0.6, '#7a8794'); g.addColorStop(1, '#3a4450'); x.fillStyle = g;
          x.beginPath(); x.moveTo(x0, y0 + 6); x.quadraticCurveTo(x0, y0, x0 + 6, y0); x.lineTo(x1 - (noseR || 0), y0); if (noseR) { x.quadraticCurveTo(x1 + 4, y0 + 2, x1 + 6, (y0 + y1) / 2); x.quadraticCurveTo(x1 + 4, y1 - 2, x1 - noseR, y1); } else { x.lineTo(x1, y0 + 2); x.lineTo(x1 - 3, (y0 + y1) / 2); x.lineTo(x1, y1 - 3); } x.lineTo(x0 + 6, y1); x.quadraticCurveTo(x0, y1, x0, y1 - 6); x.closePath(); x.fill();
        };
        // задня частина
        hull(22, 78, 18, 68, 0);
        // носова частина (нахилена)
        x.save(); x.translate(104, 46); x.rotate(0.07); x.translate(-104, -46); hull(96, 150, 20, 70, 26); x.restore();
        // червона смуга і панелі
        x.fillStyle = '#b03a2a'; x.fillRect(30, 32, 48, 6); x.save(); x.translate(104, 46); x.rotate(0.07); x.translate(-104, -46); x.fillRect(96, 34, 44, 6); x.restore();
        x.strokeStyle = 'rgba(20,26,34,0.65)'; x.lineWidth = 1; for (const px of [38, 52, 66]) { x.beginPath(); x.moveTo(px, 19); x.lineTo(px, 67); x.stroke(); x.strokeStyle = 'rgba(255,255,255,0.25)'; x.beginPath(); x.moveTo(px + 1, 19); x.lineTo(px + 1, 67); x.stroke(); x.strokeStyle = 'rgba(20,26,34,0.65)'; }
        for (let k = 0; k < 14; k++) { x.fillStyle = 'rgba(255,255,255,0.45)'; x.fillRect(26 + k * 3.6, 21, 1.4, 1.4); x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(26 + k * 3.6, 65, 1.4, 1.4); }
        // ілюмінатори
        for (const [px, py, cr] of [[44, 26, 0], [58, 26, 1], [114, 28, 0], [130, 30, 1]]) { x.fillStyle = '#20303c'; x.beginPath(); x.arc(px, py, 5, 0, 6.3); x.fill(); x.fillStyle = cr ? '#1a2630' : '#5fb0d8'; x.beginPath(); x.arc(px, py, 3.6, 0, 6.3); x.fill(); x.fillStyle = 'rgba(255,255,255,0.7)'; x.fillRect(px - 2, py - 2, 1.5, 1.5); if (cr) { x.strokeStyle = 'rgba(220,240,255,0.8)'; x.lineWidth = 0.8; x.beginPath(); x.moveTo(px - 3, py - 3); x.lineTo(px + 3, py + 3); x.moveTo(px + 1, py - 3); x.lineTo(px - 2, py + 3); x.stroke(); } }
        // напис
        x.fillStyle = 'rgba(30,40,56,0.85)'; x.font = 'bold 8px sans-serif'; x.fillText('ЗОРЯ-7', 30, 54);
        // розрив: інтер'єр
        x.fillStyle = '#10080a'; x.beginPath(); x.moveTo(76, 16); x.lineTo(84, 24); x.lineTo(80, 32); x.lineTo(88, 40); x.lineTo(82, 50); x.lineTo(90, 60); x.lineTo(84, 72); x.lineTo(104, 74); x.lineTo(100, 62); x.lineTo(108, 50); x.lineTo(100, 38); x.lineTo(106, 26); x.lineTo(98, 18); x.closePath(); x.fill();
        x.fillStyle = rg0(x, 92, 54, 2, 22, [[0, 'rgba(255,170,60,0.65)'], [1, 'rgba(255,100,20,0)']]); x.fillRect(70, 20, 40, 56);
        x.strokeStyle = '#d6a020'; x.lineWidth = 1.2; for (let k = 0; k < 4; k++) { x.beginPath(); x.moveTo(80 + k * 6, 24 + k * 4); x.quadraticCurveTo(90, 40 + k * 5, 86 + k * 4, 62); x.stroke(); } x.strokeStyle = '#c03a2a'; x.beginPath(); x.moveTo(84, 30); x.quadraticCurveTo(94, 44, 88, 58); x.stroke();
        // зламаний трап
        x.fillStyle = '#7a8490'; x.beginPath(); x.moveTo(82, 66); x.lineTo(104, 66); x.lineTo(112, 92); x.lineTo(74, 94); x.closePath(); x.fill(); x.fillStyle = 'rgba(255,255,255,0.22)'; x.beginPath(); x.moveTo(82, 66); x.lineTo(104, 66); x.lineTo(104, 70); x.lineTo(82, 70); x.closePath(); x.fill(); x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 1; for (let k = 0; k < 5; k++) { x.beginPath(); x.moveTo(81 - k * 1.5, 72 + k * 4.5); x.lineTo(105 + k * 1.5, 72 + k * 4.5); x.stroke(); }
        x.fillStyle = 'rgba(40,30,20,0.5)'; x.beginPath(); x.moveTo(74, 94); x.lineTo(112, 92); x.lineTo(114, 96); x.lineTo(72, 96); x.closePath(); x.fill();
        // двигуни
        for (const py of [26, 40, 54]) { x.fillStyle = '#20252b'; x.beginPath(); x.moveTo(22, py - 6); x.lineTo(10, py - 9); x.lineTo(10, py + 9); x.lineTo(22, py + 6); x.closePath(); x.fill(); x.fillStyle = '#4a3a30'; x.beginPath(); x.ellipse(10, py, 2.5, 9, 0, 0, 6.3); x.fill(); x.fillStyle = 'rgba(255,120,30,0.5)'; x.beginPath(); x.ellipse(11, py, 1.5, 5, 0, 0, 6.3); x.fill(); }
        // зім'ятий стабілізатор
        x.fillStyle = '#8a2a22'; x.beginPath(); x.moveTo(40, 18); x.lineTo(30, 6); x.lineTo(34, 3); x.lineTo(54, 16); x.closePath(); x.fill(); x.strokeStyle = 'rgba(0,0,0,0.5)'; x.stroke(); x.fillStyle = '#5a1a14'; x.beginPath(); x.moveTo(120, 70); x.lineTo(136, 82); x.lineTo(130, 86); x.lineTo(112, 72); x.closePath(); x.fill();
        // сажа
        x.fillStyle = rg0(x, 90, 46, 4, 42, [[0, 'rgba(0,0,0,0.5)'], [1, 'rgba(0,0,0,0)']]); x.fillRect(0, 0, W, H); x.fillStyle = rg0(x, 134, 46, 3, 22, [[0, 'rgba(0,0,0,0.5)'], [1, 'rgba(0,0,0,0)']]); x.fillRect(0, 0, W, H);
        // уламки та жарини
        for (let k = 0; k < 14; k++) { const px = 8 + rnd() * 144, py = 6 + rnd() * 84; if (px > 22 && px < 150 && py > 18 && py < 68) continue; x.fillStyle = k % 3 ? '#6a7480' : '#9aa4ae'; x.beginPath(); x.moveTo(px, py); x.lineTo(px + 2 + rnd() * 5, py + rnd() * 3); x.lineTo(px + rnd() * 4, py + 3 + rnd() * 3); x.closePath(); x.fill(); x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 0.6; x.stroke(); }
        for (let k = 0; k < 18; k++) { x.fillStyle = k % 2 ? 'rgba(255,140,40,0.9)' : 'rgba(255,200,80,0.9)'; x.fillRect(rnd() * 150 + 4, rnd() * 90 + 3, 1.4, 1.4); }
        break;
      }
      case 'pod_wreck': { x.fillStyle = 'rgba(0,0,0,0.3)'; x.beginPath(); x.ellipse(17, 20, 14, 10, 0, 0, 6.3); x.fill(); x.fillStyle = '#4a4a50'; x.beginPath(); x.arc(16, 15, 12, 0, 6.3); x.fill(); x.fillStyle = '#6a6a72'; x.beginPath(); x.arc(14, 13, 8, 0, 6.3); x.fill(); x.fillStyle = '#222'; x.beginPath(); x.ellipse(18, 18, 6, 4, 0.5, 0, 6.3); x.fill(); x.strokeStyle = '#1a1a1a'; x.lineWidth = 1; x.beginPath(); x.moveTo(5, 12); x.lineTo(14, 16); x.lineTo(24, 8); x.stroke(); break; }
      case 'ship_engine': { shadow(2, 2, W - 4, H - 4); x.fillStyle = '#4a5460'; rr(2, 2, W - 4, H - 4, 6); x.fill(); x.fillStyle = '#7a8a9a'; rr(6, 6, W - 12, H - 12, 5); x.fill(); x.fillStyle = '#1a2a3a'; x.beginPath(); x.arc(W / 2, H / 2, 18, 0, 6.3); x.fill(); x.fillStyle = '#3df'; x.beginPath(); x.arc(W / 2, H / 2, 10, 0, 6.3); x.fill(); x.fillStyle = '#cff'; x.beginPath(); x.arc(W / 2, H / 2, 4, 0, 6.3); x.fill(); break; }
      default: { shadow(3, 3, W - 6, H - 6); x.fillStyle = col; rr(3, 3, W - 6, H - 6, 3); x.fill(); }
    }
  }
  GFX.doorSprite = function (defKey, horiz) {
    const key = 'door' + defKey + horiz; if (GFX.bldCache[key]) return GFX.bldCache[key];
    const base = D.bld[defKey].color;
    const c = mk(TS, TS, (x) => {
      x.fillStyle = U.shade(base, -0.35); x.fillRect(0, 0, TS, TS);
      x.fillStyle = base; if (horiz) x.fillRect(2, 8, TS - 4, 16); else x.fillRect(8, 2, 16, TS - 4);
      x.fillStyle = 'rgba(255,255,255,0.15)'; if (horiz) x.fillRect(2, 8, TS - 4, 2); else x.fillRect(8, 2, 2, TS - 4);
      x.strokeStyle = 'rgba(0,0,0,0.4)'; x.lineWidth = 1; if (horiz) x.strokeRect(2.5, 8.5, TS - 5, 15); else x.strokeRect(8.5, 2.5, 15, TS - 5);
      x.fillStyle = '#d4c060'; x.beginPath(); x.arc(horiz ? 24 : 16, horiz ? 16 : 24, 1.8, 0, 6.3); x.fill();
    });
    finish(c, { noOutline: true, grain: 0.3 }); GFX.bldCache[key] = c; return c;
  };

  // ---------------------------------------------------------------
  //  Іконки предметів
  // ---------------------------------------------------------------
  GFX.itemIcons = {};
  GFX.itemIcon = function (def) {
    if (GFX.itemIcons[def]) return GFX.itemIcons[def];
    const d = D.items[def]; const col = d.color; const rnd = U.rng(U.hashStr(def));
    const c = mk(64, 64, (x) => {
      x.scale(2, 2);
      const sg = x.createRadialGradient(16, 22, 1, 16, 22, 11); sg.addColorStop(0, 'rgba(0,0,0,0.42)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = sg; x.beginPath(); x.ellipse(16, 22.5, 11, 4.6, 0, 0, 6.3); x.fill();
      const rr = (X, Y, w, h, r) => { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); };
      switch (def) {
        case 'wood': for (let k = 0; k < 3; k++) { x.fillStyle = '#7a5226'; rr(6, 8 + k * 5, 20, 5, 2); x.fill(); x.fillStyle = '#b88850'; x.beginPath(); x.ellipse(24, 10.5 + k * 5, 2, 2.4, 0, 0, 6.3); x.fill(); } break;
        case 'stone_chunk': x.fillStyle = '#8e8e8e'; x.beginPath(); x.moveTo(7, 20); x.lineTo(10, 10); x.lineTo(19, 8); x.lineTo(25, 15); x.lineTo(22, 22); x.closePath(); x.fill(); x.fillStyle = 'rgba(255,255,255,0.25)'; x.beginPath(); x.moveTo(10, 10); x.lineTo(19, 8); x.lineTo(16, 15); x.fill(); break;
        case 'stone_block': for (const [a, b] of [[6, 14], [15, 14], [10, 7]]) { x.fillStyle = '#a2a2a2'; rr(a, b, 11, 8, 1); x.fill(); x.fillStyle = 'rgba(255,255,255,0.3)'; x.fillRect(a, b, 11, 2); } break;
        case 'steel': for (let k = 0; k < 3; k++) { x.fillStyle = '#a5b8cc'; x.fillRect(6 + k * 2, 9 + k * 4, 18, 4); x.fillStyle = '#d4e2f0'; x.fillRect(6 + k * 2, 9 + k * 4, 18, 1); } break;
        case 'silver': for (let k = 0; k < 6; k++) { x.fillStyle = '#d6d6e0'; x.beginPath(); x.arc(10 + (k % 3) * 6, 12 + Math.floor(k / 3) * 6, 3.4, 0, 6.3); x.fill(); x.strokeStyle = '#8a8a96'; x.lineWidth = 1; x.stroke(); } break;
        case 'gold': for (let k = 0; k < 4; k++) { x.fillStyle = '#f0c43a'; x.beginPath(); x.arc(10 + (k % 2) * 8, 12 + Math.floor(k / 2) * 7, 4, 0, 6.3); x.fill(); x.fillStyle = '#fff2a0'; x.fillRect(8 + (k % 2) * 8, 10 + Math.floor(k / 2) * 7, 2, 2); } break;
        case 'components': x.fillStyle = '#2a5a3a'; rr(6, 8, 20, 15, 2); x.fill(); x.fillStyle = '#c9923a'; for (let k = 0; k < 5; k++) x.fillRect(8 + k * 4, 10, 2, 4); x.fillStyle = '#222'; x.fillRect(12, 16, 8, 5); break;
        case 'cloth': x.fillStyle = '#d9d2c0'; rr(6, 9, 20, 12, 3); x.fill(); x.fillStyle = '#b8b09a'; x.fillRect(8, 12, 16, 1); x.fillRect(8, 16, 16, 1); break;
        case 'leather': x.fillStyle = '#a86f3f'; x.beginPath(); x.moveTo(6, 10); x.quadraticCurveTo(16, 6, 26, 10); x.lineTo(24, 22); x.quadraticCurveTo(16, 25, 8, 22); x.closePath(); x.fill(); x.fillStyle = 'rgba(0,0,0,0.15)'; x.fillRect(10, 14, 12, 2); break;
        case 'cotton': for (let k = 0; k < 4; k++) { x.fillStyle = '#f8f8f8'; x.beginPath(); x.arc(11 + (k % 2) * 9, 13 + Math.floor(k / 2) * 6, 5, 0, 6.3); x.fill(); } break;
        case 'berries': for (let k = 0; k < 9; k++) { x.fillStyle = '#c2305a'; x.beginPath(); x.arc(8 + rnd() * 16, 10 + rnd() * 10, 2.8, 0, 6.3); x.fill(); x.fillStyle = 'rgba(255,255,255,0.5)'; x.fillRect(8 + rnd() * 14, 10 + rnd() * 9, 1, 1); } break;
        case 'rice': for (let k = 0; k < 16; k++) { x.fillStyle = '#efe6bc'; x.fillRect(7 + rnd() * 17, 9 + rnd() * 11, 3, 1.5); } break;
        case 'potato': for (let k = 0; k < 3; k++) { x.fillStyle = '#b48c50'; x.beginPath(); x.ellipse(10 + k * 6, 14 + (k % 2) * 4, 5, 4, 0.3, 0, 6.3); x.fill(); x.fillStyle = '#8a6a38'; x.fillRect(9 + k * 6, 14 + (k % 2) * 4, 1.5, 1.5); } break;
        case 'corn': for (let k = 0; k < 2; k++) { x.fillStyle = '#e8c23a'; x.beginPath(); x.ellipse(12 + k * 8, 15, 3.4, 8, 0.25, 0, 6.3); x.fill(); x.fillStyle = '#5a9a3a'; x.beginPath(); x.moveTo(12 + k * 8, 22); x.lineTo(9 + k * 8, 14); x.lineTo(15 + k * 8, 14); x.fill(); } break;
        case 'meat': x.fillStyle = '#b33a3a'; rr(7, 9, 18, 12, 5); x.fill(); x.fillStyle = '#e8c8b8'; x.fillRect(11, 11, 8, 3); x.fillStyle = 'rgba(255,255,255,0.2)'; x.fillRect(9, 10, 6, 2); break;
        case 'meal_simple': case 'meal_fine': x.fillStyle = '#e9e9e9'; x.beginPath(); x.arc(16, 16, 9, 0, 6.3); x.fill(); x.strokeStyle = '#9a9a9a'; x.lineWidth = 1; x.stroke(); x.fillStyle = col; x.beginPath(); x.arc(16, 16, 6, 0, 6.3); x.fill(); if (def === 'meal_fine') { x.fillStyle = '#5ab04a'; x.fillRect(13, 13, 3, 3); x.fillStyle = '#e8d26a'; x.fillRect(17, 17, 3, 3); } break;
        case 'healroot': x.strokeStyle = '#6ab45a'; x.lineWidth = 2; for (let k = 0; k < 4; k++) { x.beginPath(); x.moveTo(16, 22); x.quadraticCurveTo(16 + (k - 1.5) * 3, 14, 16 + (k - 1.5) * 5, 8); x.stroke(); } x.fillStyle = '#e48aa0'; x.beginPath(); x.arc(16, 22, 3, 0, 6.3); x.fill(); break;
        case 'prost_leg': x.fillStyle = '#7a4a22'; x.fillRect(13, 6, 6, 5); x.fillStyle = '#a06a34'; x.fillRect(14, 11, 4, 14); x.fillStyle = '#4a2a10'; x.fillRect(12, 25, 8, 3); x.fillStyle = '#c28a50'; x.fillRect(14, 11, 1.5, 14); break;
        case 'prost_arm': x.fillStyle = '#a06a34'; x.fillRect(9, 9, 5, 15); x.strokeStyle = '#6a6a72'; x.lineWidth = 2.5; x.beginPath(); x.arc(16, 23, 6, 3.3, 5.6); x.stroke(); x.fillStyle = '#4a2a10'; x.fillRect(8, 7, 7, 3); break;
        case 'bionic_leg': x.fillStyle = '#9fb4c0'; rr(11, 5, 10, 8, 3); x.fill(); x.fillStyle = '#7a8e9a'; x.fillRect(13, 13, 6, 12); x.fillStyle = '#6ad0e8'; x.fillRect(15.5, 8, 1.5, 15); x.fillStyle = '#4a5a64'; rr(10, 24, 12, 4, 1); x.fill(); break;
        case 'bionic_arm': x.fillStyle = '#9fb4c0'; rr(9, 6, 7, 18, 3); x.fill(); x.fillStyle = '#6ad0e8'; x.fillRect(12, 8, 1.5, 14); x.fillStyle = '#4a5a64'; rr(8, 22, 10, 6, 2); x.fill(); x.fillStyle = '#c8d6de'; x.fillRect(19, 12, 3, 8); break;
        case 'pemmican': x.fillStyle = '#6a3018'; rr(7, 12, 18, 9, 3); x.fill(); x.fillStyle = '#a05a30'; rr(8, 12, 16, 5, 2); x.fill(); x.strokeStyle = '#d8b878'; x.lineWidth = 1.2; for (let k = 0; k < 3; k++) { x.beginPath(); x.moveTo(11 + k * 5, 12); x.lineTo(11 + k * 5, 21); x.stroke(); } break;
        case 'meal_sausage': x.fillStyle = '#d8c8a0'; x.beginPath(); x.ellipse(16, 20, 12, 4, 0, 0, 6.3); x.fill(); x.strokeStyle = '#7a2a1a'; x.lineWidth = 5; x.lineCap = 'round'; x.beginPath(); x.moveTo(8, 18); x.quadraticCurveTo(16, 11, 24, 17); x.stroke(); x.strokeStyle = '#c0583a'; x.lineWidth = 3; x.beginPath(); x.moveTo(8, 18); x.quadraticCurveTo(16, 11, 24, 17); x.stroke(); break;
        case 'meal_soup': x.fillStyle = '#e8dcc0'; x.beginPath(); x.ellipse(16, 20, 12, 5, 0, 0, 6.3); x.fill(); x.fillStyle = '#8a5a2a'; x.beginPath(); x.ellipse(16, 18, 9, 4, 0, 0, 6.3); x.fill(); x.fillStyle = '#d8a838'; x.beginPath(); x.ellipse(16, 17.5, 8, 3, 0, 0, 6.3); x.fill(); x.fillStyle = '#7ab050'; x.fillRect(12, 16, 2, 2); x.fillStyle = '#d0603a'; x.fillRect(18, 17, 2, 2); x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 1; x.beginPath(); x.moveTo(13, 11); x.quadraticCurveTo(15, 8, 13, 5); x.moveTo(19, 11); x.quadraticCurveTo(21, 8, 19, 5); x.stroke(); break;
        case 'meal_roast': x.fillStyle = '#e8dcc0'; x.beginPath(); x.ellipse(16, 20, 13, 6, 0, 0, 6.3); x.fill(); x.fillStyle = '#8a4a1a'; x.beginPath(); x.ellipse(15, 17, 7, 5, 0, 0, 6.3); x.fill(); x.fillStyle = '#b06a30'; x.beginPath(); x.ellipse(14, 16, 5, 3, 0, 0, 6.3); x.fill(); x.fillStyle = '#6aa050'; x.beginPath(); x.arc(24, 18, 2.5, 0, 6.3); x.fill(); x.fillStyle = '#e08a30'; x.beginPath(); x.arc(8, 19, 2.2, 0, 6.3); x.fill(); break;
        case 'beer': x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.ellipse(16, 26, 8, 2.5, 0, 0, 6.3); x.fill(); x.fillStyle = '#e8b030'; rr(9, 9, 12, 16, 2); x.fill(); x.fillStyle = '#fff6d8'; rr(9, 7, 12, 5, 2); x.fill(); x.strokeStyle = '#d8d8d8'; x.lineWidth = 2; x.beginPath(); x.moveTo(21, 12); x.quadraticCurveTo(26, 12, 26, 17); x.quadraticCurveTo(26, 22, 21, 22); x.stroke(); x.fillStyle = 'rgba(255,255,255,.4)'; x.fillRect(11, 13, 2, 9); break;
        case 'herbal': x.fillStyle = '#c9a77a'; rr(9, 11, 14, 12, 3); x.fill(); x.fillStyle = '#6fc060'; x.fillRect(12, 8, 8, 4); x.fillStyle = '#3a8a38'; x.fillRect(14, 14, 4, 6); break;
        case 'medicine': x.fillStyle = '#f2f2f2'; rr(8, 10, 16, 12, 2); x.fill(); x.fillStyle = '#d33'; x.fillRect(15, 12, 2, 8); x.fillRect(12, 15, 8, 2); break;
        case 'bow': x.strokeStyle = '#8a5a2a'; x.lineWidth = 2.5; x.beginPath(); x.arc(13, 16, 11, -1.2, 1.2); x.stroke(); x.strokeStyle = '#ddd'; x.lineWidth = 1; x.beginPath(); x.moveTo(18, 6); x.lineTo(18, 26); x.stroke(); break;
        case 'revolver': x.fillStyle = '#4a4e54'; rr(6, 12, 16, 5, 1); x.fill(); x.fillRect(8, 16, 5, 8); x.fillStyle = '#6a3a1a'; x.fillRect(8, 17, 4, 7); x.fillStyle = '#777'; x.fillRect(18, 10, 4, 3); break;
        case 'rifle': x.fillStyle = '#3a3e44'; x.fillRect(3, 13, 24, 4); x.fillStyle = '#5a3a1a'; rr(3, 13, 8, 7, 1); x.fill(); x.fillStyle = '#222'; x.fillRect(12, 17, 4, 6); x.fillStyle = '#555'; x.fillRect(22, 11, 6, 3); break;
        case 'knife': x.fillStyle = '#cdd6de'; x.beginPath(); x.moveTo(16, 6); x.lineTo(21, 18); x.lineTo(16, 20); x.closePath(); x.fill(); x.fillStyle = '#5a3a1a'; x.fillRect(14, 19, 5, 7); break;
        case 'spear': x.strokeStyle = '#8a6a3a'; x.lineWidth = 2.4; x.beginPath(); x.moveTo(8, 26); x.lineTo(22, 8); x.stroke(); x.fillStyle = '#cfd5da'; x.beginPath(); x.moveTo(24, 5); x.lineTo(26, 12); x.lineTo(19, 10); x.closePath(); x.fill(); break;
        case 'stone_knife': x.fillStyle = '#9a9a90'; x.beginPath(); x.moveTo(17, 6); x.lineTo(22, 17); x.lineTo(15, 19); x.closePath(); x.fill(); x.fillStyle = '#6a4a2a'; x.fillRect(14, 18, 5, 8); x.strokeStyle = '#c9b48a'; x.lineWidth = 1; x.beginPath(); x.moveTo(14, 20); x.lineTo(19, 20); x.moveTo(14, 23); x.lineTo(19, 23); x.stroke(); break;
        case 'crystal': x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.ellipse(16, 25, 9, 2.5, 0, 0, 6.3); x.fill(); x.fillStyle = '#7a56e8'; x.beginPath(); x.moveTo(16, 4); x.lineTo(23, 13); x.lineTo(19, 25); x.lineTo(11, 25); x.lineTo(8, 13); x.closePath(); x.fill(); x.fillStyle = '#b79cff'; x.beginPath(); x.moveTo(16, 4); x.lineTo(8, 13); x.lineTo(11, 25); x.lineTo(16, 20); x.closePath(); x.fill(); x.fillStyle = 'rgba(255,255,255,.55)'; x.fillRect(14, 8, 2, 5); break;
        case 'club': x.fillStyle = '#7a5230'; x.beginPath(); x.moveTo(12, 24); x.lineTo(16, 8); x.lineTo(21, 9); x.lineTo(16, 24); x.closePath(); x.fill(); x.fillStyle = '#9a6a3a'; x.beginPath(); x.ellipse(18, 9, 4, 3, 0.3, 0, 6.3); x.fill(); break;
        case 'parka': x.fillStyle = '#4a6aa8'; rr(8, 7, 16, 16, 3); x.fill(); x.fillStyle = '#3a5088'; x.fillRect(4, 8, 5, 11); x.fillRect(23, 8, 5, 11); x.fillStyle = '#d8d8d8'; x.fillRect(12, 6, 8, 3); x.fillStyle = '#2a3a5a'; x.fillRect(15, 9, 2, 13); break;
        case 'flak_vest': x.fillStyle = '#5a6a4a'; rr(8, 7, 16, 16, 2); x.fill(); x.fillStyle = '#3e4a34'; x.fillRect(10, 11, 12, 3); x.fillRect(10, 16, 12, 3); x.fillStyle = '#222'; x.fillRect(15, 7, 2, 16); break;
        case 'tribal_wear': x.fillStyle = '#8a6a3a'; rr(8, 7, 16, 16, 3); x.fill(); x.fillStyle = '#6a4a22'; x.fillRect(8, 15, 16, 2); x.fillRect(12, 19, 8, 2); break;
        case 'corpse': x.fillStyle = '#7a5a4a'; rr(5, 12, 22, 9, 4); x.fill(); x.fillStyle = '#dcb497'; x.beginPath(); x.arc(24, 16.5, 4.2, 0, 6.3); x.fill(); x.fillStyle = '#a02a2a'; x.beginPath(); x.ellipse(12, 17, 5, 3, 0, 0, 6.3); x.fill(); break;
        case 'corpse_animal': x.fillStyle = '#7a5a3a'; x.beginPath(); x.ellipse(15, 17, 10, 5, 0, 0, 6.3); x.fill(); x.fillStyle = '#6a4a2a'; x.beginPath(); x.ellipse(25, 16, 4, 3, 0, 0, 6.3); x.fill(); x.fillStyle = '#a02a2a'; x.beginPath(); x.ellipse(12, 18, 4, 2, 0, 0, 6.3); x.fill(); break;
        default: x.fillStyle = col; rr(8, 8, 16, 14, 3); x.fill();
      }
    });
    // загальна об'ємність: верхній відблиск і нижня тінь, дрібні блиски
    { const x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-atop'; const lg = x.createLinearGradient(0, 8, 0, 52); lg.addColorStop(0, 'rgba(255,255,240,0.22)'); lg.addColorStop(0.5, 'rgba(255,255,255,0)'); lg.addColorStop(1, 'rgba(0,0,20,0.28)'); x.fillStyle = lg; x.fillRect(0, 0, 64, 64);
      x.fillStyle = 'rgba(255,255,255,0.5)'; for (let k = 0; k < 4; k++) x.fillRect(14 + rnd() * 34, 14 + rnd() * 26, 2, 1); x.globalCompositeOperation = 'source-over'; }
    finish(c, { grain: 0.2, light: 0.1, dark: 0.12 }); GFX.itemIcons[def] = c; return c;
  };

  // ---------------------------------------------------------------
  //  Колоністи
  // ---------------------------------------------------------------
  function hair(x, style, color, face) {
    x.fillStyle = color;
    if (style === 0) return;
    const front = face === 2;
    if (style === 1) { x.beginPath(); x.arc(0, -7.2, 5.6, Math.PI * 1.02, Math.PI * 1.98); x.lineTo(5.4, -7); x.lineTo(-5.4, -7); x.fill(); if (face === 2) { x.beginPath(); x.arc(0, -7.2, 5.6, 0, 6.3); x.fill(); } }
    else if (style === 2) { x.beginPath(); x.arc(0, -7.4, 6, 0, 6.3); x.fill(); x.fillRect(-6, -7.2, 12, 11); if (face !== 2) { x.fillStyle = 'rgba(0,0,0,0)'; } }
    else if (style === 3) { x.fillRect(-1.6, -13.4, 3.2, 8.5); x.beginPath(); x.arc(0, -7.2, 5.6, Math.PI * 1.05, Math.PI * 1.95); x.lineTo(0, -7); x.fill(); }
    else if (style === 4) { x.beginPath(); x.arc(0, -7.2, 5.7, Math.PI * 1.02, Math.PI * 1.98); x.lineTo(5.4, -7); x.lineTo(-5.4, -7); x.fill(); if (face === 2) { x.beginPath(); x.arc(0, -7.2, 5.7, 0, 6.3); x.fill(); } x.beginPath(); x.ellipse(0, -2.5 + (face === 0 ? -3 : 0), 2.2, 5, 0, 0, 6.3); if (face !== 0) x.fill(); }
    else if (style === 5) { x.beginPath(); x.arc(0, -7.2, 5.6, Math.PI * 1.02, Math.PI * 1.98); x.lineTo(5.4, -7); x.lineTo(-5.4, -7); x.fill(); if (face === 2) { x.beginPath(); x.arc(0, -7.2, 5.6, 0, 6.3); x.fill(); } x.beginPath(); x.arc(0, -13.4, 3, 0, 6.3); x.fill(); }
  }
  // Малює пішака у координатах 32px з центром у (0,0); s — масштаб
  GFX.drawPawn = function (ctx, p, px, py, s, o) {
    o = o || {}; const look = p.look; const t = o.time || 0;
    ctx.save(); ctx.translate(px, py); ctx.scale(s, s);
    const face = p.face || 0; const moving = p.moving && !p.downed && !p.sleeping; const ph = p.phase || 0;
    const bw = (D.bodyTypes.find(b => b.id === look.body) || D.bodyTypes[1]).w;
    const lying = p.downed || p.sleeping || p.dead;
    // тінь
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(1.5, 6.5, lying ? 11 : 8 * bw, lying ? 5 : 3.6, 0, 0, 6.3); ctx.fill();
    if (lying) {
      const onBed = !p.dead && (p.sleeping || p.inBed);
      ctx.rotate(p.bedRot != null && p.sleeping ? p.bedRot : onBed ? -Math.PI / 2 : Math.PI / 2 * (p.id % 2 ? 1 : -1));
      ctx.translate(0, onBed ? 1.5 : -2);
    }
    const bob = moving ? Math.sin(ph * 2) * 0.9 : 0;
    const swing = moving ? Math.sin(ph * 2) * 3.6 : 0;
    const side = face === 1 || face === 3; const dir = face === 3 ? -1 : 1;
    const OL = 'rgba(14,9,6,0.88)';
    const oval = (cx, cy, rx, ry, fill, lw) => { ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 6.3); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = lw || 0.75; ctx.stroke(); };
    const box = (x0, y0, w0, h0, fill, lw) => { ctx.fillStyle = fill; ctx.fillRect(x0, y0, w0, h0); ctx.strokeStyle = OL; ctx.lineWidth = lw || 0.7; ctx.strokeRect(x0, y0, w0, h0); };
    const lin = (x0, y0, x1, y1, c0, c1) => { const gr = ctx.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, c0); gr.addColorStop(1, c1); return gr; };
    // ноги та взуття
    const pants = look.pants, boot = '#2a211c';
    const leg = (lx, ly, lw, lh) => { box(lx, ly, lw, lh, lin(lx, ly, lx + lw, ly, U.shade(pants, 0.14), U.shade(pants, -0.22))); ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(lx, ly + lh * 0.45, lw, 0.7); };
    const shoe = (sx, sy, sw) => { box(sx, sy, sw, 2, boot, 0.6); ctx.fillStyle = '#6a5a4c'; ctx.fillRect(sx, sy + 1.5, sw, 0.5); ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(sx + 0.4, sy + 0.2, sw * 0.4, 0.5); };
    if (side) { const l1 = -2.4 + swing * dir, l2 = 0.2 - swing * dir; leg(l2, 1, 2.6, 5.4); shoe(l2 - (dir > 0 ? 0 : 0.6), 6.1, 3.2); leg(l1, 1, 2.6, 5.4); shoe(l1 - (dir > 0 ? 0 : 0.6), 6.1, 3.2); }
    else { const f = face === 0 ? 1 : -1; const y1 = 1 + swing * 0.5 * f, y2 = 1 - swing * 0.5 * f; leg(-3.6, y1, 3, 5.4); shoe(-3.9, y1 + 5.1, 3.6); leg(0.6, y2, 3, 5.4); shoe(0.3, y2 + 5.1, 3.6); }
    ctx.translate(0, bob);
    // тулуб
    const ap = p.equip && p.equip.apparel;
    let shirt = look.shirt;
    if (ap === 'parka') shirt = '#4a6aa8'; else if (ap === 'tribal_wear') shirt = '#8a6a3a';
    if (p.faction === 'enemy' && !ap) shirt = look.shirt;
    const trx = (side ? 4.4 : 6.2) * bw;
    // руки-рукави (ззаду тулуба при фронтальному вигляді)
    const w = p.equip && p.equip.weapon ? D.items[p.equip.weapon] : null;
    const aiming = (p.aim > 0 || p.drafted && p.target || p.combatTarget || p.faction === 'enemy') && w && w.w.kind === 'ranged';
    if (!side) {
      for (const sg of [-1, 1]) { const ax = sg * 6.4 * bw, ay = -2.4 + swing * 0.35 * -sg; oval(ax, ay, 2.1, 3, lin(ax - 2, ay, ax + 2, ay, U.shade(shirt, sg < 0 ? 0.12 : -0.12), U.shade(shirt, sg < 0 ? -0.15 : 0.1))); oval(sg * 6.9 * bw, ay + 3.3, 1.7, 1.7, look.skin, 0.6); }
    }
    ctx.beginPath(); ctx.ellipse(0, -1, trx, 5.4, 0, 0, 6.3); ctx.fillStyle = lin(-trx, -6, trx, 4, U.shade(shirt, 0.2), U.shade(shirt, -0.26)); ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.ellipse(-trx * 0.35, -3, trx * 0.3, 1.8, -0.3, 0, 6.3); ctx.fill();
    if (!side) { ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(0, -3.4); ctx.lineTo(0, 3.6); ctx.stroke(); ctx.fillStyle = 'rgba(0,0,0,0.3)'; if (face === 0) { ctx.fillRect(-0.3, -1.6, 0.7, 0.7); ctx.fillRect(-0.3, 0.6, 0.7, 0.7); } }
    // пояс
    ctx.fillStyle = '#3a2a1c'; ctx.fillRect(-trx * 0.78, 2.2, trx * 1.56, 1.3); if (!side && face === 0) { ctx.fillStyle = '#d6b050'; ctx.fillRect(-0.8, 2.2, 1.6, 1.3); }
    if (ap === 'flak_vest') { ctx.fillStyle = '#5a6a4a'; ctx.fillRect(-4 * bw, -5, 8 * bw, 8); ctx.strokeStyle = OL; ctx.lineWidth = 0.6; ctx.strokeRect(-4 * bw, -5, 8 * bw, 8); ctx.fillStyle = '#3e4a34'; ctx.fillRect(-3 * bw, -2, 6 * bw, 1.5); ctx.fillRect(-3 * bw, 0.4, 6 * bw, 1.5); }
    if (ap === 'parka') { ctx.fillStyle = '#e8e8e8'; ctx.fillRect(-4.5, -5.6, 9, 1.6); ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(-0.3, -4, 0.7, 7); }
    if (ap === 'tribal_wear') { ctx.fillStyle = '#5a3e1a'; for (let k = 0; k < 3; k++) ctx.fillRect(-3 + k * 2.6, 1, 1.2, 2.6); }
    // комір
    if (face === 0) { ctx.fillStyle = look.skin; ctx.beginPath(); ctx.moveTo(-1.9, -5.3); ctx.lineTo(0, -2.9); ctx.lineTo(1.9, -5.3); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.5; ctx.stroke(); }
    // руки збоку
    ctx.fillStyle = look.skin;
    if (side) { const hx2 = 1.5 * dir - swing * 0.4 * dir; oval(hx2 * 0.8, -1.4, 1.7, 2.8, lin(hx2 - 1, -3, hx2 + 1, 1, U.shade(shirt, 0.1), U.shade(shirt, -0.2)), 0.7); oval(hx2, 1.2, 1.7, 1.7, look.skin, 0.6); }
    // голова
    const hx = face === 1 ? 1.2 : face === 3 ? -1.2 : 0;
    ctx.save(); ctx.translate(hx, 0);
    ctx.fillStyle = U.shade(look.skin, -0.22); ctx.fillRect(-1.7, -4.4, 3.4, 2.2);
    if (face !== 2) { oval(-5.1, -6.9, 1.2, 1.7, U.shade(look.skin, -0.06), 0.6); oval(5.1, -6.9, 1.2, 1.7, U.shade(look.skin, -0.1), 0.6); }
    ctx.beginPath(); ctx.arc(0, -7.4, 5.4, 0, 6.3); const hg = ctx.createRadialGradient(-1.8, -9.6, 0.6, 0, -7.4, 6); hg.addColorStop(0, U.shade(look.skin, 0.2)); hg.addColorStop(0.6, look.skin); hg.addColorStop(1, U.shade(look.skin, -0.2)); ctx.fillStyle = hg; ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 0.8; ctx.stroke();
    hair(ctx, look.hairStyle, look.hair, face);
    if (look.hairStyle) { ctx.strokeStyle = U.shade(look.hair, 0.32); ctx.globalAlpha = 0.7; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.arc(-0.6, -7.4, 4.6, Math.PI * 1.15, Math.PI * 1.6); ctx.stroke(); ctx.strokeStyle = U.shade(look.hair, -0.3); ctx.beginPath(); ctx.arc(0.4, -7.4, 5.2, Math.PI * 1.7, Math.PI * 1.95); ctx.stroke(); ctx.globalAlpha = 1; }
    // обличчя
    if (face !== 2) {
      const eyes = face === 0 ? [-2.2, 2.2] : face === 1 ? [2.4] : [-2.4]; const ey = -7.1; const ic = look.eye || '#3a2a1c';
      for (const ex of eyes) {
        if (p.sleeping || p.dead) { ctx.strokeStyle = '#1a1210'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(ex - 1.1, ey); ctx.lineTo(ex + 1.1, ey); ctx.stroke(); }
        else { ctx.fillStyle = '#f4f2ec'; ctx.beginPath(); ctx.ellipse(ex, ey, 1.25, 1.05, 0, 0, 6.3); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.35; ctx.stroke(); const ox = face === 1 ? 0.3 : face === 3 ? -0.3 : 0; ctx.fillStyle = ic; ctx.beginPath(); ctx.arc(ex + ox, ey + 0.05, 0.72, 0, 6.3); ctx.fill(); ctx.fillStyle = '#0a0806'; ctx.beginPath(); ctx.arc(ex + ox, ey + 0.05, 0.38, 0, 6.3); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(ex + ox - 0.5, ey - 0.45, 0.45, 0.45); }
        ctx.strokeStyle = U.shade(look.hair, -0.1); ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(ex - 1.3, ey - 1.5); ctx.lineTo(ex + 1.2, ey - 1.7); ctx.stroke();
      }
      ctx.fillStyle = U.shade(look.skin, -0.22); if (face === 0) { ctx.beginPath(); ctx.moveTo(0, -6.1); ctx.lineTo(0.9, -4.7); ctx.lineTo(-0.9, -4.7); ctx.closePath(); ctx.fill(); } else { ctx.beginPath(); ctx.moveTo(dir * 5.2, -6.2); ctx.lineTo(dir * 6.5, -5.2); ctx.lineTo(dir * 5, -4.8); ctx.closePath(); ctx.fill(); }
      ctx.strokeStyle = 'rgba(110,40,36,0.85)'; ctx.lineWidth = 0.6; ctx.beginPath(); const my = -3.7; if (face === 0) { ctx.moveTo(-1.3, my); ctx.quadraticCurveTo(0, my + (p.mood != null && p.mood < 30 ? -0.4 : 0.7), 1.3, my); } else { ctx.moveTo(dir * 2.2, my); ctx.lineTo(dir * 3.8, my + 0.1); } ctx.stroke();
      ctx.fillStyle = 'rgba(255,110,110,0.14)'; if (face === 0) { ctx.beginPath(); ctx.arc(-3.2, -5, 1.2, 0, 6.3); ctx.arc(3.2, -5, 1.2, 0, 6.3); ctx.fill(); }
    }
    if (ap === 'parka' && face !== 2) { ctx.fillStyle = '#e0e0e0'; ctx.beginPath(); ctx.arc(0, -7.6, 5.7, Math.PI * 0.95, Math.PI * 2.05); ctx.lineWidth = 1.6; ctx.strokeStyle = '#e0e0e0'; ctx.stroke(); }
    ctx.restore();
    // зброя
    if (w && !lying && !(o.hideWeapon)) {
      const ang = o.aimAngle != null ? o.aimAngle : (face === 0 ? Math.PI / 2 : face === 1 ? 0 : face === 2 ? -Math.PI / 2 : Math.PI);
      ctx.save(); ctx.translate(side ? 2.5 * dir : 5.5 * bw, 1.5);
      ctx.rotate(aiming ? ang : (face === 3 ? Math.PI * 0.85 : Math.PI * 0.15));
      const id = p.equip.weapon;
      if (id === 'bow') { ctx.strokeStyle = '#8a5a2a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(2, 0, 6.5, -1.2, 1.2); ctx.stroke(); ctx.strokeStyle = '#eee'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(4.2, -5.6); ctx.lineTo(4.2, 5.6); ctx.stroke(); }
      else if (id === 'revolver') { ctx.fillStyle = '#3a3e44'; ctx.fillRect(0, -1, 6, 2); ctx.fillStyle = '#5a3a1a'; ctx.fillRect(-1, 0, 2.5, 3); }
      else if (id === 'rifle') { ctx.fillStyle = '#2e3238'; ctx.fillRect(-2, -1.2, 11, 2.4); ctx.fillStyle = '#5a3a1a'; ctx.fillRect(-2, -1.4, 4, 3); }
      else if (id === 'knife') { ctx.fillStyle = '#cdd6de'; ctx.fillRect(0, -0.6, 5, 1.2); ctx.fillStyle = '#4a2a10'; ctx.fillRect(-2, -0.8, 2.4, 1.6); }
      else if (id === 'spear') { ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(10, 0); ctx.stroke(); ctx.fillStyle = '#d6dce0'; ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(9, -1.6); ctx.lineTo(9, 1.6); ctx.closePath(); ctx.fill(); }
      else if (id === 'stone_knife') { ctx.fillStyle = '#9a9a90'; ctx.fillRect(0, -0.8, 4.5, 1.6); ctx.fillStyle = '#5a3a1a'; ctx.fillRect(-2, -0.8, 2.4, 1.6); }
      else if (id === 'club') { ctx.fillStyle = '#7a5230'; ctx.fillRect(0, -1.2, 7, 2.4); ctx.beginPath(); ctx.arc(7.5, 0, 2.3, 0, 6.3); ctx.fill(); }
      ctx.restore();
    }
    if (p.carry && !lying) { const ic = GFX.itemIcon(p.carry.def); ctx.drawImage(ic, -7, -3, 15, 15); }
    ctx.restore();
  };

  GFX.drawBubble = function (ctx, px, py, s, icon, color) {
    ctx.save(); ctx.translate(px, py - 24 * s); ctx.fillStyle = 'rgba(15,18,22,0.85)'; ctx.strokeStyle = color; ctx.lineWidth = 1.2;
    const r = 8 * s; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = color; ctx.font = (9 * s) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(icon, 0, 0.5); ctx.restore();
  };

  // ---------------------------------------------------------------
  //  Тварини
  // ---------------------------------------------------------------
  GFX.drawAnimal = function (ctx, a, px, py, s) {
    const d = a.def; const sz = d.size; const face = a.face; const dir = face === 3 ? -1 : 1; const side = face === 1 || face === 3;
    const ph = a.phase || 0; const moving = a.moving; const leg = moving ? Math.sin(ph * 1.8) * 3 : 0;
    ctx.save(); ctx.translate(px, py); ctx.scale(s * sz, s * sz);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(1, 6, 10, 4, 0, 0, 6.3); ctx.fill();
    if (a.dead) { ctx.rotate(1.5); }
    const body = d.color, dark = U.shade(d.color, -0.28), light = U.shade(d.color, 0.25);
    const sp = a.species;
    const vertical = !side;
    ctx.fillStyle = dark;
    if (vertical) { for (const lx of [-4, 4]) { ctx.fillRect(lx - 1, -4 + (lx > 0 ? leg : -leg) * 0.5, 2.4, 9); } }
    else { for (const lx of [-6, -2, 3, 7]) ctx.fillRect(lx * dir - 1.2, 2 + ((lx + 2) % 3 === 0 ? leg : -leg) * 0.6, 2.4, 6); }
    ctx.fillStyle = body;
    if (vertical) {
      ctx.beginPath(); ctx.ellipse(0, 0, 6.8, 9, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(1.5, 1, 4, 6, 0, 0, 6.3); ctx.globalAlpha = 0.25; ctx.fill(); ctx.globalAlpha = 1;
      // голова
      const hy = face === 0 ? 9 : -9; ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, hy, 4.4, 4.6, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = light; ctx.beginPath(); ctx.ellipse(0, hy + (face === 0 ? 2 : -2), 2.4, 2.6, 0, 0, 6.3); ctx.fill();
      if (face === 0) { ctx.fillStyle = '#111'; ctx.fillRect(-2.6, hy - 1, 1.3, 1.3); ctx.fillRect(1.3, hy - 1, 1.3, 1.3); }
      if (sp === 'deer') { ctx.strokeStyle = '#5a4630'; ctx.lineWidth = 1.2; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * 2.4, hy - 2); ctx.lineTo(sx * 5, hy - 7); ctx.moveTo(sx * 3.6, hy - 5); ctx.lineTo(sx * 6, hy - 5.6); ctx.stroke(); } }
      if (sp === 'rabbit') { ctx.fillStyle = body; ctx.fillRect(-2.8, hy - 8, 1.8, 6); ctx.fillRect(1, hy - 8, 1.8, 6); }
      if (sp === 'boar') { ctx.fillStyle = '#eee'; ctx.fillRect(-3.4, hy + 1, 1.2, 2.6); ctx.fillRect(2.2, hy + 1, 1.2, 2.6); }
      if (sp === 'wolf' || sp === 'dog' || sp === 'cat') { ctx.fillStyle = dark; ctx.fillRect(-4, hy - 4, 2.4, 3.4); ctx.fillRect(1.6, hy - 4, 2.4, 3.4); }
    } else {
      ctx.beginPath(); ctx.ellipse(0, 0, 10, 6, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = light; ctx.beginPath(); ctx.ellipse(-1 * dir, 2.5, 7, 2.6, 0, 0, 6.3); ctx.globalAlpha = 0.35; ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(10 * dir, -2, 4.6, 3.8, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = light; ctx.beginPath(); ctx.ellipse(13 * dir, -1, 2.6, 2, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#111'; ctx.fillRect(10.5 * dir, -4, 1.4, 1.4);
      ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(8.5 * dir, -5); ctx.lineTo(10 * dir, -8); ctx.lineTo(11.4 * dir, -5); ctx.fill();
      // хвіст
      ctx.strokeStyle = sp === 'deer' ? '#f0f0f0' : dark; ctx.lineWidth = sp === 'wolf' || sp === 'dog' ? 2.4 : 2; ctx.beginPath(); ctx.moveTo(-9 * dir, -1); ctx.quadraticCurveTo(-13 * dir, -3 + (moving ? Math.sin(ph * 3) * 2 : 0), -14 * dir, -7); ctx.stroke();
      if (sp === 'deer') { ctx.strokeStyle = '#5a4630'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(9.5 * dir, -5); ctx.lineTo(8 * dir, -11); ctx.moveTo(9 * dir, -8); ctx.lineTo(12 * dir, -10); ctx.stroke(); }
      if (sp === 'boar') { ctx.fillStyle = '#eee'; ctx.fillRect(13.4 * dir, 0.4, 2, 1); }
      if (sp === 'rabbit') { ctx.fillStyle = body; ctx.fillRect(8.4 * dir, -9, 1.6, 5); }
    }
    ctx.restore();
  };

  // Портрет для UI
  GFX.portrait = function (p, size) {
    size = size || 48;
    return mk(size, size, (x) => {
      const g = x.createLinearGradient(0, 0, 0, size); g.addColorStop(0, '#2c3a46'); g.addColorStop(1, '#161c22'); x.fillStyle = g; x.fillRect(0, 0, size, size);
      const fake = { look: p.look, face: 0, phase: 0, moving: false, equip: { apparel: p.equip && p.equip.apparel, weapon: null }, downed: false, sleeping: false, id: p.id };
      const sc = size / 20; x.save(); x.beginPath(); x.rect(0, 0, size, size); x.clip();
      // збільшений бюст
      GFX.drawPawn(x, fake, size / 2, size * 0.78, sc * 1.25, { hideWeapon: true }); x.restore();
    });
  };
})();
