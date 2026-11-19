'use strict';
// ============================================================
//  planet.js — процедурна планета (глобус) для вибору місця посадки
// ============================================================
(function () {
  const D = RW.D, U = RW.U;
  const P = RW.Planet = {};
  const TW = 1024, TH = 512, K = TW / 512;
  const BIO_NAMES = ['temperate', 'arid', 'tundra', 'tropical'];

  function h3(ix, iy, iz, s) { let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(iz, 1274126177) + Math.imul(s, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967295; }
  function n3(x, y, z, s) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z); let fx = x - xi, fy = y - yi, fz = z - zi;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
    const a = h3(xi, yi, zi, s), b = h3(xi + 1, yi, zi, s), c = h3(xi, yi + 1, zi, s), d = h3(xi + 1, yi + 1, zi, s), e = h3(xi, yi, zi + 1, s), f = h3(xi + 1, yi, zi + 1, s), g = h3(xi, yi + 1, zi + 1, s), h = h3(xi + 1, yi + 1, zi + 1, s);
    return (a * (1 - fx) + b * fx) * (1 - fy) * (1 - fz) + (c * (1 - fx) + d * fx) * fy * (1 - fz) + (e * (1 - fx) + f * fx) * (1 - fy) * fz + (g * (1 - fx) + h * fx) * fy * fz;
  }
  function fbm3(x, y, z, s, o) { let v = 0, a = 0.5, t = 0; for (let i = 0; i < o; i++) { v += n3(x, y, z, s + i * 17) * a; t += a; x *= 2.05; y *= 2.05; z *= 2.05; a *= 0.5; } return v / t; }


  // дрібний шум (тайл 256×256, зациклений) — додає деталізацію берегів і суші при будь-якому наближенні
  const DT = 256;
  function makeDetail(seed) {
    const d = new Float32Array(DT * DT), r = U.rng(seed ^ 0x9e37); let amp = 0.5, tot = 0;
    for (let o = 0; o < 4; o++) {
      const n = 8 << o; const g = new Float32Array(n * n); for (let k = 0; k < g.length; k++) g[k] = r();
      for (let y = 0; y < DT; y++) { const fy = y / DT * n, y0 = Math.floor(fy), ty = fy - y0, sy = ty * ty * (3 - 2 * ty); for (let x = 0; x < DT; x++) {
        const fx = x / DT * n, x0 = Math.floor(fx), tx = fx - x0, sx = tx * tx * (3 - 2 * tx); const x1 = (x0 + 1) % n, y1 = (y0 + 1) % n;
        const v = (g[y0 * n + x0] * (1 - sx) + g[y0 * n + x1] * sx) * (1 - sy) + (g[y1 * n + x0] * (1 - sx) + g[y1 * n + x1] * sx) * sy; d[y * DT + x] += v * amp; } }
      tot += amp; amp *= 0.5;
    }
    for (let k = 0; k < d.length; k++) d[k] = d[k] / tot - 0.5; return d;
  }
  function detAt(det, u, v) { // білінійно, u,v у текселях базової текстури
    const a = u * 0.5 - 0.5, b = v * 0.5 - 0.5; let x0 = Math.floor(a), y0 = Math.floor(b); let fx = a - x0, fy = b - y0; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); x0 = ((x0 % DT) + DT) % DT; let y1 = ((y0 + 1) % DT + DT) % DT; y0 = ((y0 % DT) + DT) % DT; const x1 = (x0 + 1) % DT;
    return (det[y0 * DT + x0] * (1 - fx) + det[y0 * DT + x1] * fx) * (1 - fy) + (det[y1 * DT + x0] * (1 - fx) + det[y1 * DT + x1] * fx) * fy;
  }
  function elevAt(pl, u, v) { // висота з деталізацією (спільна для рендера й вибору місця)
    const uu = u - 0.5, vv = v - 0.5; let u0 = Math.floor(uu), v0 = Math.floor(vv); const fu = uu - u0, fv = vv - v0; const u1 = ((u0 + 1) % TW + TW) % TW; u0 = (u0 % TW + TW) % TW; let v1 = v0 + 1; if (v1 > TH - 1) v1 = TH - 1; if (v1 < 0) v1 = 0; if (v0 < 0) v0 = 0; if (v0 > TH - 1) v0 = TH - 1; const E = pl.elev;
    const e = (E[v0 * TW + u0] * (1 - fu) + E[v0 * TW + u1] * fu) * (1 - fv) + (E[v1 * TW + u0] * (1 - fu) + E[v1 * TW + u1] * fu) * fv;
    return e + detAt(pl.det, u, v) * 0.07;
  }
  P.isOcean = (pl, lat, lon) => { const u = (lon / 6.283185307 + 0.5) * TW, v = (0.5 - lat / Math.PI) * TH; return elevAt(pl, u, v) < pl.sea; };

  const NAMES1 = ['Нова', 'Дика', 'Зоряна', 'Далека', 'Тиха', 'Рубінова', 'Смарагдова', 'Остання', 'Янтарна', 'Сіра'];
  const NAMES2 = ['Гея', 'Терра', 'Аврора', 'Оаза', 'Надія', 'Еос', 'Пристань', 'Мрія', 'Фортуна', 'Ітака'];
  P.nameFor = seed => { const r = U.rng(seed ^ 0x5a5a); return NAMES1[Math.floor(r() * NAMES1.length)] + ' ' + NAMES2[Math.floor(r() * NAMES2.length)] + '-' + (100 + Math.floor(r() * 900)); };

  const cache = {};
  P.get = function (seed) { if (!cache[seed]) { for (const k in cache) delete cache[k]; cache[seed] = P.generate(seed); } return cache[seed]; };
  // Генерація текстур планети
  P.generate = function (seed) {
    const biome = new Uint8Array(TW * TH), temp = new Int8Array(TW * TH), rain = new Uint8Array(TW * TH), elev = new Float32Array(TW * TH), col = new Uint8ClampedArray(TW * TH * 4), cloud = new Uint8Array(TW * TH), lb = new Uint8Array(TW * TH);
    const sea = 0.5 + (U.rng(seed)() - 0.5) * 0.06;
    for (let y = 0; y < TH; y++) {
      const lat = (0.5 - (y + 0.5) / TH) * Math.PI, sl = Math.sin(lat), cl = Math.cos(lat);
      for (let x = 0; x < TW; x++) {
        const lon = ((x + 0.5) / TW - 0.5) * Math.PI * 2; const px = cl * Math.sin(lon), py = sl, pz = cl * Math.cos(lon);
        const i = y * TW + x;
        let e = fbm3(px * 1.9 + 3, py * 1.9 + 7, pz * 1.9 + 1, seed, 7);
        const ridge = 1 - Math.abs(fbm3(px * 4 + 9, py * 4 + 2, pz * 4 + 5, seed + 31, 4) * 2 - 1);
        e = e * 0.82 + ridge * 0.18 * (e > sea ? 1 : 0.2);
        elev[i] = e;
        const mo = fbm3(px * 2.6 + 11, py * 2.6 + 5, pz * 2.6 + 3, seed + 77, 4);
        const aal = Math.abs(lat);
        const hot = (Math.max(0, e - 0.6)) * 45;
        const T = 28 - 50 * Math.pow(Math.abs(sl), 2.4) + (fbm3(px * 3, py * 3, pz * 3, seed + 5, 3) - 0.5) * 9 - hot;
        let r01 = (0.3 + 0.75 * mo) * (0.65 + 0.7 * Math.exp(-(lat / 0.4) * (lat / 0.4))) * (1 - 0.55 * Math.exp(-Math.pow((aal - 0.47) / 0.19, 2)));
        r01 = U.clamp(r01, 0, 1);
        temp[i] = Math.round(T); rain[i] = Math.round(r01 * 255);
        // хмари
        const cn = fbm3(px * 3.3 + 20, py * 3.3 * 1.4 + 4, pz * 3.3 + 8, seed + 123, 5); cloud[i] = U.clamp((cn - 0.52) * 520, 0, 255);
        let r, g, b, bi; const eL = e < sea ? sea + 0.002 : e;
        {
          if (T < 3) bi = 2; else if (T >= 20) bi = r01 < 0.4 ? 1 : (r01 > 0.5 ? 3 : 0); else bi = (r01 < 0.26 && T > 12) ? 1 : 0;
          lb[i] = bi;
          const sh = U.clamp((eL - sea) / 0.35, 0, 1);
          if (bi === 0) { r = 70 + (1 - r01) * 40; g = 118 + r01 * 25; b = 60; r *= 0.85 + sh * 0.3; g *= 0.85 + sh * 0.2; }
          else if (bi === 1) { r = 205 - sh * 40; g = 164 - sh * 30; b = 100 - sh * 10; }
          else if (bi === 2) { const sn = U.clamp((3 - T) / 14, 0, 1); r = 150 + sn * 95; g = 165 + sn * 78; b = 160 + sn * 82; }
          else { r = 28 + (1 - r01) * 25; g = 100 + r01 * 40; b = 40; r *= 0.9 + sh * 0.2; }
          if (eL > 0.7) { const m = U.clamp((eL - 0.7) / 0.12, 0, 1); r = r * (1 - m) + 128 * m; g = g * (1 - m) + 122 * m; b = b * (1 - m) + 114 * m; if (eL > 0.8 || T < -2) { const sn = U.clamp((eL - 0.78) / 0.06 + (T < -2 ? 0.5 : 0), 0, 1); r += (240 - r) * sn; g += (244 - g) * sn; b += (248 - b) * sn; } }
          const sat = 0.9 + (n3(px * 20, py * 20, pz * 20, seed + 9) - 0.5) * 0.3; r *= sat; g *= sat; b *= sat;
                }
        biome[i] = e < sea ? 10 : lb[i];
        col[i * 4] = r; col[i * 4 + 1] = g; col[i * 4 + 2] = b; col[i * 4 + 3] = 255;
      }
    }
    // згладжені градієнти висоти (центральні різниці) — для безступінчастого рельєфу
    const gxA = new Float32Array(TW * TH), gyA = new Float32Array(TW * TH);
    for (let y = 0; y < TH; y++) { const ya = y > 0 ? y - 1 : 0, yb = y < TH - 1 ? y + 1 : TH - 1; for (let x = 0; x < TW; x++) { const xa = (x + TW - 1) % TW, xb = (x + 1) % TW; gxA[y * TW + x] = (elev[y * TW + xb] - elev[y * TW + xa]) * 0.5; gyA[y * TW + x] = (elev[yb * TW + x] - elev[ya * TW + x]) * 0.5; } }
    return { seed, gxA, gyA, name: P.nameFor(seed), biome, lb, temp, rain, elev, col, cloud, sea, det: makeDetail(seed) };
  };

  // Дані про місце (lat, lon у радіанах)
  P.sample = function (pl, lat, lon) {
    const x = Math.floor(((lon / (Math.PI * 2)) + 0.5) * TW) % TW, y = U.clamp(Math.floor((0.5 - lat / Math.PI) * TH), 0, TH - 1); const i = y * TW + ((x + TW) % TW);
    if (P.isOcean(pl, lat, lon)) return { ocean: true, lat, lon };
    let hill = 0, water = 0, n = 0; for (let dy = -4 * K; dy <= 4 * K; dy++) for (let dx = -4 * K; dx <= 4 * K; dx++) { const yy = y + dy, xx = ((x + dx) % TW + TW) % TW; if (yy < 0 || yy >= TH) continue; const j = yy * TW + xx; n++; if (pl.elev[j] > 0.66 && pl.biome[j] !== 10) hill++; if (pl.biome[j] === 10) water++; }
    // кількість води рахуємо у ширшому радіусі
    let w2 = 0, n2 = 0; for (let dy = -9 * K; dy <= 9 * K; dy += 2 * K) for (let dx = -9 * K; dx <= 9 * K; dx += 2 * K) { const yy = y + dy, xx = ((x + dx) % TW + TW) % TW; if (yy < 0 || yy >= TH) continue; n2++; if (pl.biome[yy * TW + xx] === 10) w2++; }
    const bi = pl.lb[i]; const T = pl.temp[i]; const r01 = pl.rain[i] / 255;
    const bk = BIO_NAMES[bi === 0 ? 0 : bi === 1 ? 1 : bi === 2 ? 2 : 3];
    const mountain = U.clamp(0.18 + hill / n * 1.6, 0.15, 0.65), waterP = U.clamp(0.12 + w2 / n2 * 1.1, 0.1, 0.85), trees = bk === 'arid' ? 0.2 + r01 * 0.4 : bk === 'tundra' ? 0.25 + r01 * 0.3 : 0.4 + r01 * 0.55;
    return { ocean: false, lat, lon, biome: bk, T, r01, mm: Math.round(150 + r01 * 2600), elev: pl.elev[i], mountain, water: waterP, trees: U.clamp(trees, 0.1, 0.95), tempBias: U.clamp(T - D.biomes[bk].temp, -9, 9), idx: i };
  };

  // Опис клімату
  P.describe = function (loc) {
    const bio = D.biomes[loc.biome]; const T = loc.T; const sw = bio.swing;
    const rainLbl = loc.r01 < 0.22 ? 'Посушливо' : loc.r01 < 0.42 ? 'Помірні опади' : loc.r01 < 0.65 ? 'Вологий клімат' : 'Дуже волого, зливи';
    let grow = 0; for (let d = 0; d < D.YEAR_DAYS; d++) { const t = bio.temp + (T - bio.temp) + sw * (-Math.cos(2 * Math.PI * (d - 52.5) / D.YEAR_DAYS)); if (t >= 6) grow++; }
    const relief = loc.mountain > 0.55 ? 'Гірський' : loc.mountain > 0.35 ? 'Горбистий' : 'Рівнинний';
    const water = loc.water > 0.55 ? 'Багато води, озера й ріки' : loc.water > 0.3 ? 'Є річки й озера' : 'Мало води';
    const fert = Math.round(bio.fert * (0.6 + loc.r01 * 0.8) * 100);
    const fauna = bio.animals.filter(a => a[1] > 0).map(a => D.animals[a[0]].name.toLowerCase()).join(', ');
    const danger = bio.animals.some(a => a[0] === 'wolf' && a[1] > 0) ? 'Підвищена (вовки)' : 'Помірна';
    return { name: bio.name, desc: bio.desc, avg: Math.round(T + 0), summer: Math.round(T + sw * 0.95 + bio.daily * 0.4), winter: Math.round(T - sw * 0.95 - bio.daily * 0.4), rainLbl, mm: loc.mm, grow, relief, water, fert, fauna, danger };
  };

  // ---------------- Рендер ----------------
  const L = (function () { const x = -0.58, y = -0.38, z = 0.72; const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; })();
  P.makeView = function (W) { const c = document.createElement('canvas'); c.width = W; c.height = W; return { c, x: c.getContext('2d'), img: null, W }; };
  function toPlanet(nx, ny, nz, yaw, pitch) {
    const cp = Math.cos(pitch), sp = Math.sin(pitch), cy = Math.cos(yaw), sy = Math.sin(yaw);
    const y1 = ny * cp + nz * sp, z1 = -ny * sp + nz * cp; const x2 = nx * cy + z1 * sy, z2 = -nx * sy + z1 * cy;
    return [Math.asin(U.clamp(-y1, -1, 1)), Math.atan2(x2, z2)];
  }
  P.pick = function (st, W, mx, my) {
    const R = W * 0.44 * (st.zoom || 1), dx = (mx - W / 2) / R, dy = (my - W / 2) / R, r2 = dx * dx + dy * dy; if (r2 > 1) return null;
    const nz = Math.sqrt(1 - r2); return toPlanet(dx, dy, nz, st.yaw, st.pitch);
  };
  P.project = function (st, W, lat, lon) {
    const R = W * 0.44 * (st.zoom || 1), cl = Math.cos(lat); const x2 = cl * Math.sin(lon), y2 = -Math.sin(lat), z2 = cl * Math.cos(lon);
    const cy = Math.cos(st.yaw), sy = Math.sin(st.yaw), cp = Math.cos(st.pitch), sp = Math.sin(st.pitch);
    const x1 = x2 * cy - z2 * sy, z1 = x2 * sy + z2 * cy; const nz = y2 * sp + z1 * cp, ny = y2 * cp - z1 * sp;
    return { x: W / 2 + x1 * R, y: W / 2 + ny * R, vis: nz > 0.04, nz };
  };
  P.render = function (view, pl, st, time) {
    const W = view.W, WX = view.WX || W, R = W * 0.44 * (st.zoom || 1), cx = W / 2, cxx = WX / 2; const ctx = view.x;
    if (view.c.width !== WX) view.c.width = WX; if (view.c.height !== W) view.c.height = W; if (!view.img || view.img.width !== WX) view.img = ctx.createImageData(WX, W); const d = view.img.data; d.fill(0);
    const cp = Math.cos(st.pitch), sp = Math.sin(st.pitch), cyw = Math.cos(st.yaw), syw = Math.sin(st.yaw);
    const hx = L[0], hy = L[1], hz = L[2] + 1, hl = Math.hypot(hx, hy, hz); const Hx = hx / hl, Hy = hy / hl, Hz = hz / hl;
    const cloudShift = time * 0.00004; const det = pl.det, fine = (st.zoom || 1) > 1.35;
    const Lpy = L[1] * cp + L[2] * sp, Lz1 = -L[1] * sp + L[2] * cp, Lpx = L[0] * cyw + Lz1 * syw, Lpz = -L[0] * syw + Lz1 * cyw;
    for (let py = 0; py < W; py++) {
      const dy = (py - cx) / R;
      for (let px = 0; px < WX; px++) {
        const dx = (px - cxx) / R, r2 = dx * dx + dy * dy; const o = (py * WX + px) * 4;
        if (r2 > 1.14) continue;
        if (r2 > 1) { // атмосфера ззовні
          const r = Math.sqrt(r2); const a = Math.pow(1 - (r - 1) / 0.14, 2.4);
          const lt = U.clamp(0.35 + (-(dx * L[0]) - dy * L[1]) * 0.55, 0.12, 1);
          d[o] = 90 + 40 * lt; d[o + 1] = 150 + 50 * lt; d[o + 2] = 255; d[o + 3] = a * 190 * lt; continue;
        }
        const nz = Math.sqrt(1 - r2);
        const y1 = dy * cp + nz * sp, z1 = -dy * sp + nz * cp; const x2 = dx * cyw + z1 * syw, z2 = -dx * syw + z1 * cyw;
        const lat = Math.asin(-y1 < -1 ? -1 : (-y1 > 1 ? 1 : -y1)), lon = Math.atan2(x2, z2);
        let u = (lon / 6.283185307 + 0.5) * TW, v = (0.5 - lat / Math.PI) * TH; let ui = Math.floor(u) % TW; if (ui < 0) ui += TW; let vi = Math.floor(v); if (vi < 0) vi = 0; else if (vi >= TH) vi = TH - 1;
        const ti = vi * TW + ui;
        const uu = u - 0.5, vv = v - 0.5; let u0 = Math.floor(uu), v0 = Math.floor(vv); const fu = uu - u0, fv = vv - v0; let u1 = ((u0 + 1) % TW + TW) % TW; u0 = (u0 % TW + TW) % TW; let v1 = v0 + 1; if (v1 > TH - 1) v1 = TH - 1; if (v0 < 0) v0 = 0; if (v1 < 0) v1 = 0;
        const i00 = (v0 * TW + u0) * 4, i10 = (v0 * TW + u1) * 4, i01 = (v1 * TW + u0) * 4, i11 = (v1 * TW + u1) * 4; const w00 = (1 - fu) * (1 - fv), w10 = fu * (1 - fv), w01 = (1 - fu) * fv, w11 = fu * fv; const C = pl.col;
        // висота: текстура + дрібний шум → плавний гладкий берег на будь-якому наближенні
        const E = pl.elev; const eb = E[v0 * TW + u0] * w00 + E[v0 * TW + u1] * w10 + E[v1 * TW + u0] * w01 + E[v1 * TW + u1] * w11;
        let dn = detAt(det, u, v); if (fine) dn += detAt(det, u * 2.3 + 91, v * 2.3 + 37) * 0.45;
        const e = eb + dn * 0.07;
        const lm = e - pl.sea; const landA = lm <= -0.0035 ? 0 : (lm >= 0.0035 ? 1 : (lm + 0.0035) / 0.007); // 0 океан … 1 суша
        let r = C[i00] * w00 + C[i10] * w10 + C[i01] * w01 + C[i11] * w11, g = C[i00 + 1] * w00 + C[i10 + 1] * w10 + C[i01 + 1] * w01 + C[i11 + 1] * w11, b = C[i00 + 2] * w00 + C[i10 + 2] * w10 + C[i01 + 2] * w01 + C[i11 + 2] * w11;
        const GX = pl.gxA, GY = pl.gyA; const gx = (GX[v0 * TW + u0] * w00 + GX[v0 * TW + u1] * w10 + GX[v1 * TW + u0] * w01 + GX[v1 * TW + u1] * w11) * 1.0, gy = GY[v0 * TW + u0] * w00 + GY[v0 * TW + u1] * w10 + GY[v1 * TW + u0] * w01 + GY[v1 * TW + u1] * w11;
        const hh = Math.sqrt(x2 * x2 + z2 * z2) + 1e-6; const Le = (Lpx * z2 - Lpz * x2) / hh, Ln = y1 * (x2 * Lpx + z2 * Lpz) / hh - hh * Lpy;
        let rel = 1 - 70 * (gx / hh * Le - gy * Ln) * (fine ? 1.4 : 1); rel = rel < 0.62 ? 0.62 : (rel > 1.4 ? 1.4 : rel); // рельєф: схили проти світла темніші
        const dv = (0.86 + (dn + 0.5) * 0.3 + (e > 0.62 ? (e - 0.62) * 0.5 : 0)) * rel; r *= dv; g *= dv; b *= dv; // фактура й рельєф суші
        const ocean = landA < 0.5;
        if (landA < 1) { // вода: глибина, мілководдя, лід
          const dd = U.clamp((pl.sea - e) / 0.2, 0, 1); const sh1 = U.clamp(1 - (pl.sea - e) / 0.035, 0, 1);
          let wr = 40 - dd * 32 + sh1 * 28, wg = 124 - dd * 82 + sh1 * 52, wb = 170 - dd * 70 + sh1 * 22;
          if (pl.temp[ti] < -10 && e > pl.sea - 0.04) { wr = 215; wg = 232; wb = 240; }
          r = wr * (1 - landA) + r * landA; g = wg * (1 - landA) + g * landA; b = wb * (1 - landA) + b * landA;
        }
        let dif = dx * L[0] + dy * L[1] + nz * L[2]; const sh = dif > 0 ? Math.pow(dif, 0.8) : 0; const term = U.clamp((dif + 0.15) / 0.3, 0, 1);
        // хмари
        const cs = cloudShift * TW; const cA = (((u0 + Math.floor(cs)) % TW) + TW) % TW, cB = (cA + 1) % TW; const CL = pl.cloud; const ca = ((CL[v0 * TW + cA] * (1 - fu) + CL[v0 * TW + cB] * fu) * (1 - fv) + (CL[v1 * TW + cA] * (1 - fu) + CL[v1 * TW + cB] * fu) * fv) / 255 * 0.8;
        r = r * (1 - ca) + 250 * ca; g = g * (1 - ca) + 252 * ca; b = b * (1 - ca) + 255 * ca;
        let amb = 0.07; const li = amb + sh * 0.98;
        r *= li; g *= li; b *= li * 1.05 + 0.04;
        if (ocean) { const nd = dx * Hx + dy * Hy + nz * Hz; const sp2 = nd > 0.95 ? Math.pow(nd, 420) * (1 - ca) * 0.7 : 0; r += sp2 * 255; g += sp2 * 240; b += sp2 * 220; }
        // термінатор: теплий відтінок
        const tw = (1 - Math.abs(dif - 0.08) / 0.2); if (tw > 0) { r += 40 * tw * term; g += 14 * tw * term; }
        // атмосферна крайня підсвітка
        const rim = Math.pow(1 - nz, 2.6) * (0.25 + sh * 0.9); r += 70 * rim; g += 130 * rim; b += 230 * rim;
        d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
      }
    }
    ctx.putImageData(view.img, 0, 0);
  };
})();
