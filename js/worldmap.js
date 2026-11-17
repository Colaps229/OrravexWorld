// ============================================================
//  worldmap.js — світова карта: фракції, поселення, каравани, дипломатія
// ============================================================
(function () {
  'use strict';
  const RW = window.RW; const D = RW.D, U = RW.U, E = RW.Events; const G = () => RW.G; const DY = D.DAY;
  const W = RW.World = {}; const TAU = Math.PI * 2; const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const FAC = W.FAC = {
    league: { name: 'Торгова ліга', ico: '⚖', col: '#e0b84a', gw: 25, desc: 'Купці й мандрівні ярмарки. Радо торгують зі всіма, хто платить.', trade: ['bulk', 'exotic'], names: ['Золотий Брід', 'Ярмарок-Пристань', 'Фортеця Монети'] },
    tribe: { name: 'Племена Червоної Скелі', ico: '🏹', col: '#6fbf6a', gw: 8, desc: 'Мисливці й травники. Цінують дари та повагу.', trade: ['medic', 'bulk'], names: ['Стійбище Грому', 'Дубовий Круг', 'Табір Пепла'] },
    corp: { name: 'Корпорація «Аргус»', ico: '🏢', col: '#6ab0e8', gw: 0, desc: 'Технології та бионіка. Холодні, але прагматичні.', trade: ['exotic', 'arms'], names: ['Станція Аргус-7', 'Купол Феніксу', 'Комплекс Дельта'] },
    pirates: { name: 'Піратський альянс', ico: '☠', col: '#e0584a', gw: -60, desc: 'Рейдери та работорговці. Нападають за першої нагоди.', trade: ['arms'], names: ['Кістяний Форт', 'Гніздо Круків', 'Іржаве Лігво'] }
  };
  W.ensure = function (g) {
    const e = RW.Life.ensure(g); if (e.world) return e.world;
    const mpx = e.mp; const S = mpx ? mpx.worldSeed | 0 : (g.seed || 1) | 0; const rnd = U.rng(S + 777); const w = { sel: null, caravans: [], settlements: [], fac: {}, log: [], seed: S };
    for (const k in FAC) w.fac[k] = { gw: FAC[k].gw, truce: 0, gift: 0, trade: 0, aid: 0 };
    const land = (x, y) => W.elev(x, y, S, mpx ? mpx.worldBiome : g.biome);
    const pts = []; const ok = (x, y) => land(x, y) > 0.47 && land(x, y) < 0.78 && pts.every(p => Math.hypot(p.x - x, p.y - y) > 0.14);
    const place = () => { for (let k = 0; k < 400; k++) { const x = 0.08 + rnd() * 0.84, y = 0.1 + rnd() * 0.8; if (ok(x, y)) { const p = { x, y }; pts.push(p); return p; } } const p = { x: rnd(), y: rnd() }; pts.push(p); return p; };
    if (mpx) {
      const a = mpx.pos.me, b = mpx.pos.peer; pts.push({ x: a[0], y: a[1] }, { x: b[0], y: b[1] });
      w.settlements.push({ id: 'me', fac: 'me', name: mpx.myName || 'Ваша колонія', x: a[0], y: a[1], pop: 0 }, { id: 'peer', fac: 'peer', name: mpx.peerName, x: b[0], y: b[1], pop: 0 });
    } else { let me = place(); me.x = Math.min(0.9, Math.max(0.1, me.x)); w.settlements.push({ id: 'me', fac: 'me', name: 'Ваша колонія', x: me.x, y: me.y, pop: 0 }); }
    for (const f of Object.keys(FAC)) for (let k = 0; k < (f === 'pirates' ? 2 : 2); k++) { const p = place(); w.settlements.push({ id: f + k, fac: f, name: FAC[f].names[k], x: p.x, y: p.y, pop: U.ri(20, 120) }); }
    e.world = w; return w;
  };
  // рельєф
  W.elev = function (x, y, S, biome) { const base = U.fbm(x * 3.4 + 4, y * 3.4 + 9, S + 31, 5); const cx = x - 0.5, cy = y - 0.5; const edge = Math.min(1, Math.hypot(cx * 1.15, cy * 1.35) * 1.6); return base * 0.82 + 0.22 - edge * 0.28 + 0.05; };
  const imgCache = {};
  function* imageGen(g) {
    const wd = W.ensure(g); const mpx = g.ext && g.ext.mp; const S = mpx ? mpx.worldSeed | 0 : (g.seed || 1) | 0; const gb = mpx ? mpx.worldBiome : g.biome; const key = S + gb + (mpx ? mpx.pos.me.join() : ''); if (imgCache[key]) return;
    const w = 1200, h = 760; const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d'); const im = c.createImageData(w, h);
    const arid = gb === 'arid', ice = gb === 'tundra' || gb === 'ice' || gb === 'boreal', trop = gb === 'tropical' || gb === 'jungle';
    const rr = U.rng(S + 4242); const SEA = 0.46;
    // висоти + вологість
    const E = new Float32Array(w * h), M = new Float32Array(w * h);
    for (let y = 0; y < h; y++) { if ((y & 15) === 0) yield; for (let x = 0; x < w; x++) { const nx = x / w, ny = y / h; E[y * w + x] = W.elev(nx, ny, S, gb) + (U.vnoise(nx * 40, ny * 40, S + 5) - 0.5) * 0.02; M[y * w + x] = U.fbm(nx * 5 + 40, ny * 5 + 3, S + 77, 4); } }
    const eAt = (x, y) => E[Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x))];
    // відстань до берега (для мілководдя)
    const coast = new Float32Array(w * h);
    for (let y = 0; y < h; y++) { if ((y & 15) === 0) yield; for (let x = 0; x < w; x++) { const i = y * w + x; const sea = E[i] < SEA; let d = 1; if (x % 1 === 0) { for (let r = 1; r <= 7; r += 2) { if ((eAt(x + r, y) < SEA) !== sea || (eAt(x - r, y) < SEA) !== sea || (eAt(x, y + r) < SEA) !== sea || (eAt(x, y - r) < SEA) !== sea) { d = r / 8; break; } } } coast[i] = d; } }
    // територіальна належність (найближче чуже поселення)
    const sets = wd.settlements; const terr = new Int8Array(w * h).fill(-1); const facIdx = Object.keys(FAC);
    for (let y = 0; y < h; y += 2) { if ((y & 31) === 0) yield; for (let x = 0; x < w; x += 2) { let best = 1e9, bi = -1; for (let k = 0; k < sets.length; k++) { const s2 = sets[k]; const dx = (x / w - s2.x) * 1.58, dy = y / h - s2.y; const d = dx * dx + dy * dy; if (d < best) { best = d; bi = k; } } const fi = sets[bi].fac === 'me' ? 9 : sets[bi].fac === 'peer' ? 8 : facIdx.indexOf(sets[bi].fac); terr[y * w + x] = fi; if (x + 1 < w) terr[y * w + x + 1] = fi; if (y + 1 < h) { terr[(y + 1) * w + x] = fi; if (x + 1 < w) terr[(y + 1) * w + x + 1] = fi; } } }
    const tint = facIdx.map(k => U.hexToRgb(FAC[k].col)); tint[9] = [255, 255, 255]; tint[8] = [122, 240, 200];
    for (let y = 0; y < h; y++) { if ((y & 15) === 0) yield; for (let x = 0; x < w; x++) {
      const i = y * w + x, e = E[i], m = M[i]; const nx = x / w, ny = y / h;
      // освітлення: тінь від NW
      const sh = (eAt(x - 2, y - 2) - eAt(x + 2, y + 2)) * 60 * (e < SEA ? 0.15 : 1);
      let r, gg, b;
      if (e < SEA) { const d = Math.min(1, (SEA - e) / 0.3); r = 52 - d * 36; gg = 128 - d * 70; b = 178 - d * 58; const cd = coast[i]; if (cd < 1) { const k = 1 - cd; r += 40 * k; gg += 56 * k; b += 40 * k; } if (ice) { r += 26; gg += 24; b += 14; } const wv = Math.sin((nx * 90 + ny * 30 + U.vnoise(nx * 30, ny * 30, S) * 6)) * 2.2; r += wv * 0.5; gg += wv; b += wv; }
      else if (e < SEA + 0.02) { r = 222; gg = 208; b = 156; if (arid) { r = 226; gg = 198; b = 140; } }
      else if (e > 0.78) { const t = Math.min(1, (e - 0.78) / 0.1); r = 150 + t * 100; gg = 146 + t * 102; b = 144 + t * 104; }
      else if (e > 0.68) { const t = (e - 0.68) / 0.1; r = 116 + t * 34; gg = 108 + t * 38; b = 98 + t * 46; r += (U.vnoise(nx * 90, ny * 90, S + 2) - 0.5) * 22; gg += (U.vnoise(nx * 90, ny * 90, S + 2) - 0.5) * 22; b += (U.vnoise(nx * 90, ny * 90, S + 2) - 0.5) * 22; }
      else {
        const f = m; const det = (U.vnoise(nx * 140, ny * 140, S + 8) - 0.5) * 14;
        if (arid) { r = 208 - f * 46; gg = 172 - f * 44; b = 114 - f * 30; if (f > 0.58) { r -= 40; gg -= 8; b -= 20; } }
        else if (ice) { r = 202 + f * 24; gg = 216 + f * 18; b = 226 + f * 14; if (f > 0.55) { r -= 36; gg -= 18; b -= 14; } }
        else if (trop) { r = 34 + (1 - f) * 40; gg = 112 + f * 34; b = 46 + (1 - f) * 18; if (f > 0.55) { r -= 10; gg -= 24; b -= 10; } }
        else { r = 90 + (1 - f) * 44; gg = 138 + f * 22 - 12; b = 66 + (1 - f) * 22; if (f > 0.58) { r -= 30; gg -= 26; b -= 16; } }
        r += det; gg += det; b += det * 0.7;
      }
      // межі територій (легкий відтінок, лише суша)
      if (e >= SEA + 0.02) { const t = terr[i]; if (t >= 0 && t < 10) { const tc = tint[t]; r = r * 0.88 + tc[0] * 0.12; gg = gg * 0.88 + tc[1] * 0.12; b = b * 0.88 + tc[2] * 0.12; } }
      const k = i * 4; im.data[k] = U.clamp(r + sh, 0, 255); im.data[k + 1] = U.clamp(gg + sh, 0, 255); im.data[k + 2] = U.clamp(b + sh, 0, 255); im.data[k + 3] = 255;
    } }
    c.putImageData(im, 0, 0);
    // кордони
    c.lineWidth = 1.6; c.setLineDash([7, 5]);
    for (let y = 2; y < h - 2; y += 2) for (let x = 2; x < w - 2; x += 2) { const i = y * w + x; if (E[i] < SEA + 0.02) continue; const t = terr[i]; if (t !== terr[i + 2] || t !== terr[i + 2 * w]) { const tc = t >= 0 && t < facIdx.length ? FAC[facIdx[t]].col : (t === 8 ? '#7af0c8' : '#ffffff'); c.fillStyle = tc; c.globalAlpha = 0.5; c.fillRect(x, y, 2, 2); } }
    c.globalAlpha = 1; c.setLineDash([]);
    // річки: стікають від гір до моря
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (let n = 0, made = 0; n < 160 && made < 9; n++) {
      let x = Math.floor(rr() * w), y = Math.floor(rr() * h); if (eAt(x, y) < 0.62 || eAt(x, y) > 0.8) continue;
      const path = [[x, y]]; let ok = false; let px = x, py = y; const seen = new Set();
      for (let st = 0; st < 900; st++) {
        let bx = px, by = py, be = eAt(px, py); for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { if (!dx && !dy) continue; const e2 = eAt(px + dx * 2, py + dy * 2) + (U.vnoise((px + dx) * 0.05, (py + dy) * 0.05, S + st % 7) - 0.5) * 0.004; if (e2 < be) { be = e2; bx = px + dx * 2; by = py + dy * 2; } }
        if (bx === px && by === py) { bx = px + (rr() < 0.5 ? -2 : 2); by = py + (rr() < 0.5 ? -2 : 2); }
        const kk = bx + ',' + by; if (seen.has(kk)) break; seen.add(kk); px = bx; py = by; path.push([px, py]); if (px < 3 || py < 3 || px > w - 4 || py > h - 4) break; if (eAt(px, py) < SEA) { ok = true; break; }
      }
      if (!ok || path.length < 60) continue; made++;
      for (let pass = 0; pass < 2; pass++) { c.strokeStyle = pass ? 'rgba(96,170,230,0.95)' : 'rgba(20,50,90,0.55)'; for (let k = 1; k < path.length; k++) { const wdt = (0.9 + 2.4 * k / path.length) + (pass ? 0 : 1.4); c.lineWidth = wdt; c.beginPath(); c.moveTo(path[k - 1][0], path[k - 1][1]); c.lineTo(path[k][0], path[k][1]); c.stroke(); } }
    }
    // дерева / гори / дюни — гліфи
    const tree = (x, y, s, col) => { c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(x + 1, y + s * 0.9, s * 0.7, s * 0.3, 0, 0, 6.3); c.fill(); c.fillStyle = col; c.beginPath(); c.moveTo(x, y - s * 1.3); c.lineTo(x + s * 0.8, y + s * 0.8); c.lineTo(x - s * 0.8, y + s * 0.8); c.closePath(); c.fill(); c.fillStyle = 'rgba(255,255,255,0.12)'; c.beginPath(); c.moveTo(x, y - s * 1.3); c.lineTo(x - s * 0.8, y + s * 0.8); c.lineTo(x - s * 0.1, y + s * 0.8); c.closePath(); c.fill(); };
    const peak = (x, y, s, snow) => { c.fillStyle = 'rgba(0,0,0,0.28)'; c.beginPath(); c.moveTo(x + s * 0.1, y - s); c.lineTo(x + s * 1.15, y + s * 0.6); c.lineTo(x + s * 0.1, y + s * 0.6); c.closePath(); c.fill(); c.fillStyle = '#8a8478'; c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + s * 1.1, y + s * 0.6); c.lineTo(x - s * 1.1, y + s * 0.6); c.closePath(); c.fill(); c.fillStyle = '#b6b0a2'; c.beginPath(); c.moveTo(x, y - s); c.lineTo(x - s * 1.1, y + s * 0.6); c.lineTo(x - s * 0.1, y + s * 0.6); c.closePath(); c.fill(); if (snow) { c.fillStyle = '#f4f8fb'; c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + s * 0.42, y - s * 0.25); c.lineTo(x + s * 0.1, y - s * 0.4); c.lineTo(x - s * 0.2, y - s * 0.2); c.lineTo(x - s * 0.42, y - s * 0.25); c.closePath(); c.fill(); } };
    const dune = (x, y, s) => { c.strokeStyle = 'rgba(150,100,50,0.5)'; c.lineWidth = 1.4; c.beginPath(); c.arc(x, y + s, s * 1.4, 3.6, 5.8); c.stroke(); };
    const items = [];
    for (let y = 8; y < h - 8; y += 9) for (let x = 8; x < w - 8; x += 9) {
      const jx = x + (rr() - 0.5) * 8, jy = y + (rr() - 0.5) * 8; const ix = jx | 0, iy = jy | 0; const e = eAt(ix, iy), m = M[iy * w + ix];
      if (e < SEA + 0.03) continue;
      if (e > 0.7) { if (rr() < 0.55) items.push([jy, 'p', jx, jy, 5 + (e - 0.7) * 30 + rr() * 3, e > 0.84]); }
      else if (arid) { if (m < 0.5 && rr() < 0.22) items.push([jy, 'd', jx, jy, 3 + rr() * 2]); }
      else if (m > (ice ? 0.5 : 0.46) && rr() < (m - 0.4) * 1.4) items.push([jy, 't', jx, jy, 2.6 + rr() * 1.8, ice ? (rr() < 0.5 ? '#3f6a58' : '#4c7a64') : trop ? (rr() < 0.5 ? '#1c5a2a' : '#26703a') : (rr() < 0.5 ? '#2f6a2c' : '#3a7a34')]);
    }
    items.sort((a, b) => a[0] - b[0]);
    for (const it of items) { if (it[1] === 'p') peak(it[2], it[3], it[4], it[5]); else if (it[1] === 't') tree(it[2], it[3], it[4], it[5]); else dune(it[2], it[3], it[4]); }
    // дороги між поселеннями
    c.strokeStyle = 'rgba(70,44,20,0.7)'; c.lineWidth = 2.2; c.setLineDash([9, 5]);
    const me = sets.find(s2 => s2.id === 'me'); const links = []; const others = sets.filter(s2 => s2.id !== 'me').sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y)); for (let k = 0; k < 3 && k < others.length; k++) links.push([me, others[k]]);
    for (const s2 of others) { let bd = 9, bo = null; for (const o of others) { if (o === s2) continue; const d = Math.hypot(o.x - s2.x, o.y - s2.y); if (d < bd) { bd = d; bo = o; } } if (bo) links.push([s2, bo]); }
    for (const [a, b2] of links) { const ax = a.x * w, ay = a.y * h, bx2 = b2.x * w, by2 = b2.y * h; const mx = (ax + bx2) / 2 + (ay - by2) * 0.12, my = (ay + by2) / 2 + (bx2 - ax) * 0.12; c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo(mx, my, bx2, by2); c.stroke(); }
    c.setLineDash([]);
    // сітка координат
    c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 1; for (let i = 1; i < 12; i++) { c.beginPath(); c.moveTo(i * w / 12, 0); c.lineTo(i * w / 12, h); c.stroke(); } for (let i = 1; i < 8; i++) { c.beginPath(); c.moveTo(0, i * h / 8); c.lineTo(w, i * h / 8); c.stroke(); }
    // віньєтка
    const vg = c.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.66); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.42)'); c.fillStyle = vg; c.fillRect(0, 0, w, h);
    // компас
    const cx = w - 70, cy = h - 70; c.save(); c.translate(cx, cy); c.fillStyle = 'rgba(12,16,22,0.7)'; c.beginPath(); c.arc(0, 0, 48, 0, 6.3); c.fill(); c.strokeStyle = 'rgba(240,200,110,0.8)'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 44, 0, 6.3); c.stroke();
    for (let k = 0; k < 4; k++) { c.rotate(Math.PI / 2); c.fillStyle = k === 0 ? '#e86a4a' : '#f0d890'; c.beginPath(); c.moveTo(0, -38); c.lineTo(7, -8); c.lineTo(-7, -8); c.closePath(); c.fill(); }
    c.rotate(Math.PI / 4); c.fillStyle = 'rgba(240,216,144,0.6)'; for (let k = 0; k < 4; k++) { c.rotate(Math.PI / 2); c.beginPath(); c.moveTo(0, -24); c.lineTo(4, -7); c.lineTo(-4, -7); c.closePath(); c.fill(); } c.restore();
    c.font = 'bold 15px Georgia,serif'; c.textAlign = 'center'; c.fillStyle = '#fff'; c.fillText('Пн', cx, cy - 52);
    // масштаб
    c.fillStyle = 'rgba(12,16,22,0.7)'; c.fillRect(24, h - 44, 190, 26); c.strokeStyle = '#f0d890'; c.lineWidth = 2; c.beginPath(); c.moveTo(34, h - 26); c.lineTo(34, h - 32); c.lineTo(194, h - 32); c.lineTo(194, h - 26); c.stroke(); c.font = '12px sans-serif'; c.textAlign = 'left'; c.fillStyle = '#f0e6c0'; c.fillText('0 — 120 км', 38, h - 36);
    // рамка
    c.strokeStyle = 'rgba(240,200,110,0.65)'; c.lineWidth = 4; c.strokeRect(2, 2, w - 4, h - 4);
    imgCache[key] = cv.toDataURL('image/jpeg', 0.92);
  }
  // Карта світу малюється порціями у фоні (а не 0.6 с одним блоком при першому натисканні M)
  let job = null;
  function keyOf(g) { const wd = W.ensure(g); const mpx = g.ext && g.ext.mp; const S = mpx ? mpx.worldSeed | 0 : (g.seed || 1) | 0; const gb = mpx ? mpx.worldBiome : g.biome; return S + gb + (mpx ? mpx.pos.me.join() : ''); }
  W.image = function (g) {
    const key = keyOf(g); if (imgCache[key]) return imgCache[key];
    if (!job || job.key !== key) job = { key, it: imageGen(g) };
    const j = job; while (!j.it.next().done); if (job === j) job = null;
    return imgCache[key];
  };
  W.prewarm = function () {
    setTimeout(function () {
      const g = RW.G; if (!g || !g.map) return; let key; try { key = keyOf(g); } catch (e) { return; } if (imgCache[key]) return;
      if (!job || job.key !== key) job = { key, it: imageGen(g) };
      const j = job;
      const step = () => {
        if (job !== j) return; if (!RW.Game.running) { setTimeout(step, 500); return; } const t0 = performance.now();
        while (performance.now() - t0 < 5) { if (j.it.next().done) { job = null; return; } }
        setTimeout(step, 40);
      };
      step();
    }, 2500);
  };
  const stOf = (w, id) => w.settlements.find(s => s.id === id);
  const facOf = s => s.fac === 'me' ? null : W.get(s.fac);
  W.get = f => W.ensure(G()).fac[f];
  W.attitude = gw => gw >= 40 ? ['Союзник', '#7ad07a'] : gw >= 10 ? ['Дружні', '#a8d06a'] : gw > -20 ? ['Нейтральні', '#d8c860'] : gw > -50 ? ['Недружні', '#e09040'] : ['Вороги', '#e0584a'];
  const logw = (w, s) => { w.log.unshift({ t: G().tick, s }); if (w.log.length > 14) w.log.pop(); };
  W.change = (f, d) => { const x = W.get(f); x.gw = U.clamp(x.gw + d, -100, 100); };
  W.sendCaravan = function (g, from, to, kind, dur, data) { const w = W.ensure(g); w.caravans.push(Object.assign({ id: U.nextId(), from, to, kind, start: g.tick, dur: dur || DY * 0.9 }, data || {})); };
  const silverHave = () => E.colonyStock().silver || 0;
  const takeSilver = n => { const map = G().map; const s = map.byDef.get('silver'); if (!s) return; let left = n; for (const it of Array.from(s)) { if (left <= 0) break; if (it.forbid || it.res) continue; const t = Math.min(left, it.n); map.takeItem(it, t); left -= t; } };
  // ---- Події на карті ----
  W.arrive = function (g, c) {
    if (c.mp) { if (RW.MP && c.to === 'me') RW.MP.arrive(g, c); return; }
    const w = W.ensure(g); const from = stOf(w, c.from); if (!from || c.to !== 'me') return;
    const F = FAC[from.fac];
    if (c.kind === 'trade') { if (g.trader) { logw(w, F.name + ': торговець чекає (вже є гість).'); return; } E.trader(); const tr = g.trader; if (tr) { const k = U.pick(F.trade); if (k !== tr.kind && RW.Traders) { /* перегенерація під фракцію */ tr.kind = k; const K = RW.Traders.KINDS[k]; tr.stock = {}; for (let n = 0; n < 8; n++) { const o = U.pick(K.pool); const q = U.ri(o[1], o[2]); if (q > 0) tr.stock[o[0]] = (tr.stock[o[0]] || 0) + q; } const tp = g.pawns.find(p => p.id === tr.pawnId); if (tp) { tp.title = K.title; tp.look.shirt = K.col; } } tr.from = from.name; }
      logw(w, 'Прибув торговець з «' + from.name + '».'); }
    else if (c.kind === 'aid') { const sp = g.tradeSpot; const map = g.map; map.addItem('medicine', 4, sp.x, sp.y); map.addItem('components', 5, sp.x + 1, sp.y); map.addItem('meal_fine', 8, sp.x, sp.y + 1); map.addItem('silver', 150, sp.x + 1, sp.y + 1); RW.FX2 && RW.FX2.burst('coin', sp.x + 0.5, sp.y + 0.5, 12);
      RW.UI && RW.UI.letter('Допомога прибула', 'Фракція «' + F.name + '» надіслала допомогу: ліки, компоненти, їжу та срібло. Залиште їх на складі.', 'good', null, { x: sp.x, y: sp.y }); logw(w, 'Допомога від «' + from.name + '» прибула.'); RW.A && RW.A.sfx('good'); }
    else if (c.kind === 'raid') { logw(w, 'Загін з «' + from.name + '» атакує вас!'); const members = E.rawRaid ? E.rawRaid() : E.raid(undefined, true); RW.UI && RW.UI.letter('Рейд із «' + from.name + '»', 'Ворожий загін ' + F.name + ' нападає на вашу колонію!', 'bad', null); RW.A && RW.A.sfx('alert'); }
  };
  // Рейд походить від ворожого поселення
  const origRaid = E.raid; let inRaid = false;
  E.raid = function (pts, silent) {
    const g = G(), w = W.ensure(g);
    if (!inRaid && !silent) {
      const hostile = w.settlements.filter(s => s.fac !== 'me' && s.fac !== 'peer' && W.get(s.fac).gw < -20 && !(W.get(s.fac).truce > g.tick));
      if (!hostile.length) { g.story.lastRaid = D.relDay(g.tick) - 1; logw(w, 'Ворожі фракції дотримуються перемир\'я — рейд скасовано.'); return []; }
      const from = U.pick(hostile); inRaid = true; const m = origRaid(pts, silent); inRaid = false;
      logw(w, 'Рейд із «' + from.name + '» (' + FAC[from.fac].name + ').'); W.sendCaravan(g, from.id, 'me', 'raidvis', 600); return m;
    }
    return origRaid(pts, silent);
  };
  W.tick = function (g) {
    const w = W.ensure(g);
    for (let i = w.caravans.length - 1; i >= 0; i--) { const c = w.caravans[i]; if (g.tick - c.start >= c.dur) { w.caravans.splice(i, 1); try { W.arrive(g, c); } catch (e) { console.error(e); } } }
    if (g.tick % DY === 1500) {
      for (const f in w.fac) { const x = w.fac[f]; const base = FAC[f].gw; if (x.gw > base) x.gw -= 0.5; else if (x.gw < base) x.gw += 0.5; }
      // фоновий рух між чужими поселеннями
      if (Math.random() < 0.7) { const o = w.settlements.filter(s => s.fac !== 'me' && s.fac !== 'peer'); const a = U.pick(o), b = U.pick(o); if (a !== b && a.fac !== 'pirates') W.sendCaravan(g, a.id, b.id, 'amb', DY * U.rr(1, 2.2)); }
    }
    if (g.tick % DY === 1501 && D.relDay(g.tick) > 3) { for (const f in w.fac) { if (w.fac[f].gw >= 15 && f !== 'pirates' && Math.random() < 0.18 && !g.trader && !w.caravans.some(c => c.kind === 'trade')) { const s = U.pick(w.settlements.filter(s => s.fac === f)); W.sendCaravan(g, s.id, 'me', 'trade', DY * 0.7); logw(w, '«' + s.name + '» відправляє торговий караван.'); break; } } }
  };
  const ltick = RW.Life.tick; RW.Life.tick = function (g) { ltick(g); W.tick(g); };
  // ---- Дії гравця ----
  const cool = (x, k, ticks) => G().tick >= (x[k] || 0) ? (x[k] = G().tick + ticks, true) : false;
  const A = {
    wmSel: el => { W.ensure(G()).sel = el.dataset.id; },
    wmGift: el => { const g = G(), w = W.ensure(g); const s = stOf(w, w.sel); if (!s || s.fac === 'me') return; if (silverHave() < 100) return RW.UI.toast('Потрібно 100 срібла', 'bad'); takeSilver(100); const d = s.fac === 'pirates' ? 6 : 10; W.change(s.fac, d); logw(w, 'Подарунок «' + s.name + '»: +' + d + ' до ставлення.'); RW.A.sfx('coin'); RW.UI.toast('Подарунок надіслано (+' + d + ')', 'good'); },
    wmTrade: el => { const g = G(), w = W.ensure(g); const s = stOf(w, w.sel); if (!s || s.fac === 'me') return; const f = W.get(s.fac); if (f.gw < 0) return RW.UI.toast('Вони не хочуть торгувати з вами', 'bad'); if (g.trader || w.caravans.some(c => c.kind === 'trade')) return RW.UI.toast('Торговець уже в дорозі', 'info'); if (!cool(f, 'trade', DY * 3)) return RW.UI.toast('Занадто часто — зачекайте', 'info'); W.sendCaravan(g, s.id, 'me', 'trade', DY * 0.6); logw(w, 'Запрошено торговця з «' + s.name + '».'); },
    wmAid: el => { const g = G(), w = W.ensure(g); const s = stOf(w, w.sel); if (!s || s.fac === 'me') return; const f = W.get(s.fac); if (f.gw < 35) return RW.UI.toast('Потрібне ставлення 35+', 'bad'); if (!cool(f, 'aid', DY * 8)) return RW.UI.toast('Допомогу вже просили нещодавно', 'info'); W.change(s.fac, -12); W.sendCaravan(g, s.id, 'me', 'aid', DY * 0.8); logw(w, 'Попрошено допомогу в «' + s.name + '».'); },
    wmTruce: el => { const g = G(), w = W.ensure(g); const s = stOf(w, w.sel); if (!s || s.fac === 'me') return; const f = W.get(s.fac); if (f.truce > g.tick) return RW.UI.toast('Перемир\'я вже діє', 'info'); if (silverHave() < 250) return RW.UI.toast('Потрібно 250 срібла', 'bad'); takeSilver(250); f.truce = g.tick + 6 * DY; W.change(s.fac, 8); logw(w, 'Перемир\'я з ' + FAC[s.fac].name + ' на 6 діб.'); RW.A.sfx('good'); RW.UI.toast('Перемир\'я укладено на 6 діб', 'good'); }
  };
  W.html = function () {
    const g = G(), w = W.ensure(g); const UI = RW.UI; const sel = stOf(w, w.sel) || null;
    let h = '<div class="wm"><div class="wmap"><img src="' + W.image(g) + '" draggable="false">';
    for (const c of w.caravans) { const a = stOf(w, c.from), b = stOf(w, c.to); if (!a || !b || c.kind === 'raidvis') continue; const t = U.clamp((g.tick - c.start) / c.dur, 0, 1); const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t; const ico = c.ico || (c.kind === 'trade' ? '🐪' : c.kind === 'aid' ? '📦' : c.kind === 'mpgoods' ? '📦' : c.kind === 'mpvisit' ? '🚶' : c.kind === 'mpraid' ? '⚔️' : c.kind === 'mpreturn' ? '🏠' : '🛷'); h += '<svg class="wm-line" viewBox="0 0 100 63" preserveAspectRatio="none"><line x1="' + a.x * 100 + '" y1="' + a.y * 63.3 + '" x2="' + b.x * 100 + '" y2="' + b.y * 63.3 + '" stroke="' + (c.kind === 'amb' ? 'rgba(255,255,255,.28)' : c.mp ? 'rgba(122,240,200,.75)' : 'rgba(255,220,120,.6)') + '" stroke-dasharray="1.2 1.4" stroke-width=".35"/></svg><span class="wm-c" style="left:' + (x * 100).toFixed(2) + '%;top:' + (y * 100).toFixed(2) + '%">' + ico + '</span>'; }
    for (const s of w.settlements) { const mps = g.ext && g.ext.mp; const F = s.fac === 'me' ? { ico: '🏠', col: '#ffffff' } : s.fac === 'peer' ? { ico: '👥', col: '#7af0c8' } : FAC[s.fac]; const hostile = s.fac === 'peer' ? !!(mps && mps.rel === 'war') : s.fac !== 'me' && W.get(s.fac).gw < -20; h += '<button class="wm-s ' + (w.sel === s.id ? 'on' : '') + (hostile ? ' hostile' : '') + '" style="left:' + (s.x * 100).toFixed(2) + '%;top:' + (s.y * 100).toFixed(2) + '%;--c:' + F.col + '" data-act="wmSel" data-id="' + s.id + '" title="' + esc(s.name) + '"><i>' + F.ico + '</i><em>' + esc(s.name) + '</em></button>'; }
    h += '</div><div class="wside">';
    if (sel && sel.fac === 'peer') {
      const mps = g.ext.mp; h += '<div class="wcard" style="--c:#7af0c8"><div class="wh"><span class="wi">👥</span><div><b>' + esc(sel.name) + '</b><div class="sub">Колонія іншого гравця · ' + (RW.MP && RW.MP.online() ? "на звʼязку" : "офлайн") + '</div></div></div><p class="sub">' + (mps && mps.rel === 'war' ? '⚔ Ви у стані війни.' : '🕊 Ви в мирі: можна торгувати, ходити в гості, листуватись.') + '</p><div class="wbtns"><button class="btn xs" data-act="mpOpenWin">🌐 Відкрити мультиплеєр (N)</button></div></div>';
    } else if (sel && sel.fac !== 'me') {
      const F = FAC[sel.fac], f = W.get(sel.fac); const att = W.attitude(f.gw); const truce = f.truce > g.tick;
      h += '<div class="wcard" style="--c:' + F.col + '"><div class="wh"><span class="wi">' + F.ico + '</span><div><b>' + esc(sel.name) + '</b><div class="sub">' + F.name + ' · населення ~' + sel.pop + '</div></div></div><p class="sub">' + F.desc + '</p>';
      h += '<div class="gwbar"><div class="gwf" style="width:' + ((f.gw + 100) / 2).toFixed(0) + '%;background:' + att[1] + '"></div><i></i></div><div class="sub">Ставлення: <b style="color:' + att[1] + '">' + att[0] + ' (' + Math.round(f.gw) + ')</b>' + (truce ? ' · перемир\'я ' + Math.ceil((f.truce - g.tick) / DY) + ' д.' : '') + '</div>';
      h += '<div class="wbtns"><button class="btn xs" data-act="wmGift">🎁 Подарунок (100 ◎)</button><button class="btn xs" data-act="wmTrade">🐪 Запросити торговця</button><button class="btn xs" data-act="wmAid">📦 Попросити допомогу</button>' + (f.gw < -20 ? '<button class="btn xs" data-act="wmTruce">🕊 Перемир\'я (250 ◎)</button>' : '') + '</div></div>';
    } else if (sel) h += '<div class="wcard"><div class="wh"><span class="wi">🏠</span><div><b>Ваша колонія</b><div class="sub">' + g.pawns.filter(p => p.faction === 'colony').length + ' колоністів · день ' + (D.relDay(g.tick) + 1) + '</div></div></div></div>';
    else h += '<div class="wcard"><p class="sub">Оберіть поселення на карті, щоб побачити фракцію й дипломатичні дії.</p></div>';
    h += '<h4>Фракції</h4>'; for (const k in FAC) { const f = w.fac[k]; const att = W.attitude(f.gw); h += '<div class="frow"><span style="color:' + FAC[k].col + '">' + FAC[k].ico + '</span><span class="fn">' + FAC[k].name + '</span><b style="color:' + att[1] + '">' + att[0] + '</b></div>'; }
    h += '<h4>Вісті</h4><div class="wlog">' + (w.log.map(l => '<div class="he"><span class="ht">День ' + (D.relDay(l.t) + 1) + '</span> ' + esc(l.s) + '</div>').join('') || '<span class="sub">Тихо…</span>') + '</div></div></div>';
    return h;
  };
  W.install = function () { const UI = RW.UI; UI.actions.mpOpenWin = () => { UI.closeWin('world'); UI.openWin('mp'); }; UI.addWin('world', { title: 'Світова карта', fn: W.html, cls: 'win-wide' }); Object.assign(UI.actions, A); UI.TABS.splice(UI.TABS.length - 1, 0, { id: 'world', label: 'Світ', key: 'M' }); UI.keyWins.KeyM = 'world'; };
  W.install();
})();
