// ============================================================
//  farming.js — гідропоніка, лампи для рослин, добрива, шкідники
// ============================================================
(function () {
  'use strict';
  const RW = window.RW; const D = RW.D, U = RW.U, E = RW.Events, AI = RW.AI; const G = () => RW.G; const TAU = Math.PI * 2; const DY = D.DAY;
  const F = RW.Farming = {};
  // ---- дані ----
  D.FLOORS.push('floor_hydro'); const HYDRO = D.FLOORS.indexOf('floor_hydro'); F.HYDRO = HYDRO;
  D.bld.floor_hydro = { id: 'floor_hydro', cat: 'production', name: 'Гідропонний басейн', desc: 'Живильний розчин замість ґрунту: рослини ростуть швидше навіть на камені й піску та менше мерзнуть. Потрібна енергія не потрібна.', w: 1, h: 1, cost: { steel: 5, wood: 3 }, work: 90, hp: 50, pass: 1, floor: true, beauty: 0.2, flam: 0, color: '#3a8a6a' };
  D.bld.grow_lamp = { id: 'grow_lamp', cat: 'light', name: 'Лампа для рослин', desc: 'Фіолетове світло для рослин: вони ростуть уночі й узимку (потребує живлення).', w: 1, h: 1, cost: { steel: 20, components: 1 }, work: 140, hp: 40, pass: 0, power: -90, heat: 0.5, light: { r: 6, c: '#c070ff', a: 1.0 }, research: 'electricity', color: '#a050d0', growlamp: true };
  D.items.fertilizer = { id: 'fertilizer', name: 'Добриво', cat: 'resource', stack: 50, value: 3, color: '#6a4a2a', flam: 0.3 };
  D.recipes.fertilizer = { name: 'Компост (добриво)', bench: ['workbench'], skill: 'plants', work: 220, ing: [{ group: 'rawfood', n: 6 }], out: 'fertilizer', n: 5 };
  D.thoughts.green_thumb = { l: 'Чудовий врожай', v: 3, dur: 1 * DY }; D.thoughtIco.green_thumb = '🌱';
  // ---- текстури ----
  const origInit = RW.GFX.initTerrain;
  RW.GFX.initTerrain = function (b) {
    origInit.call(this, b); const TS = 32; const tex = [];
    for (let v = 0; v < 4; v++) {
      const cv = document.createElement('canvas'); cv.width = cv.height = TS; const x = cv.getContext('2d'); const gr = x.createLinearGradient(0, 0, 0, TS); gr.addColorStop(0, '#2b6c5a'); gr.addColorStop(1, '#1c4a46'); x.fillStyle = gr; x.fillRect(0, 0, TS, TS);
      x.fillStyle = '#9aa6ae'; x.fillRect(0, 0, TS, 3); x.fillRect(0, TS - 3, TS, 3); x.fillRect(0, 0, 3, TS); x.fillRect(TS - 3, 0, 3, TS); x.fillStyle = '#c8d2d8'; x.fillRect(0, 0, TS, 1); x.fillRect(0, 0, 1, TS); x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, TS - 1, TS, 1);
      const r = U.rng(900 + v); for (let k = 0; k < 7; k++) { x.strokeStyle = 'rgba(160,240,210,' + (0.1 + r() * 0.12).toFixed(2) + ')'; x.lineWidth = 1; x.beginPath(); const yy = 5 + r() * 22; x.moveTo(4, yy); x.bezierCurveTo(12, yy - 2, 20, yy + 2, 28, yy); x.stroke(); }
      for (const [px, py] of [[2, 2], [TS - 2, 2], [2, TS - 2], [TS - 2, TS - 2]]) { x.fillStyle = '#56626c'; x.beginPath(); x.arc(px, py, 1.2, 0, TAU); x.fill(); }
      tex.push(cv);
    }
    this.floorTex[HYDRO] = tex;
  };
  // ---- множники росту ----
  F.hydro = (map, i) => map.floor[i] === HYDRO;
  F.mult = function (map, i, pd, t, light) {
    const hy = F.hydro(map, i); const pl = map.plant[i];
    let fert = hy ? 1.9 : Math.max(0.2, 0.3 + 0.7 * D.terrain[map.terrain[i]].fert);
    if (pl && pl.fz) fert *= 1.3; if (pl && pl.pest) fert *= 0.55;
    let lf = light > 0.55 ? 1 : (light > 0.3 ? 0.4 : 0.05); if (hy) lf = Math.max(lf, 0.4);
    return { fert, lf, coldBonus: hy ? 3 : 0 };
  };
  // ---- сівба / вимоги ----
  F.canGrow = (map, i) => F.hydro(map, i) || D.terrain[map.terrain[i]].fert >= 0.2;
  // ---- добриво: використання під час сівби ----
  const origSow = AI.RUN.sow;
  AI.RUN.sow = function (p, j) {
    const g = G(), map = g.map; const r = origSow(p, j); const z = map.zoneAt[j.i];
    if (map.plant[j.i] && !map.plant[j.i].fz && z && z.fert && map.count('fertilizer') > 0) { const s = map.byDef.get('fertilizer'); if (s) { for (const it of s) { if (it.forbid || it.res) continue; map.takeItem(it, 1); const pl = map.plant[j.i]; pl.fz = 1; if (RW.FX2) { RW.FX2.burst('sparkle', j.i % map.w + 0.5, ((j.i / map.w) | 0) + 0.5, 6, { c: '#9aff7a' }); } break; } } }
    return r;
  };
  // ---- шкідники ----
  F.pests = function () {
    const g = G(), map = g.map; const crops = []; for (let i = 0; i < map.n; i++) { const p = map.plant[i]; if (p && D.plants[p.def].crop && !p.pest) crops.push(i); } if (crops.length < 4) return false;
    const i = U.pick(crops); const def = map.plant[i].def; let n = 0; map.plant[i].pest = true; n++;
    RW.UI && RW.UI.letter('Шкідники!', 'На посівах з\'явилися шкідники («' + D.plants[def].name + '»). Вони поширюються на сусідні рослини того ж виду. Змішані посіви стійкіші; хворі рослини автоматично вирубуються, якщо у зоні ввімкнено «Вирубувати хворі».', 'bad', null, { x: i % map.w, y: (i / map.w) | 0 }); return true;
  };
  F.tick = function (g) {
    const map = g.map; if (g.tick % 60 === 0) {
      for (let i = 0; i < map.n; i++) { const p = map.plant[i]; if (!p || !p.pest) continue; const pd = D.plants[p.def]; p.hp -= 0.9;
        if (p.hp <= 0) { map.removePlant(i); continue; }
        for (const nb of [i - 1, i + 1, i - map.w, i + map.w]) { const q = map.plant[nb]; if (q && q.def === p.def && !q.pest && !F.hydro(map, nb) && Math.random() < 0.07) q.pest = true; }
        const z = map.zoneAt[i]; if (z && z.cull !== false && !map.desig.has(i)) map.desig.set(i, 'chop');
      }
    }
    if (g.tick % DY === 3300 && g.tick > 5 * DY && Math.random() < 0.1 && F.hasCrops(map)) F.pests();
    if (g.tick % 240 === 0 && RW.FX2) { for (let i = 0; i < map.n; i += 1) { if (!map.plant[i] || !map.plant[i].fz || map.plant[i].growth >= 1 || Math.random() > 0.02) continue; RW.FX2.emit('sparkle', (i % map.w) + 0.5, ((i / map.w) | 0) + 0.3, { c: '#9aff7a' }); } }
    if (g.ext && g.ext.fzList && !g.ext.fzApplied) { for (const i of g.ext.fzList) if (map.plant[i]) map.plant[i].fz = 1; g.ext.fzApplied = true; }
  };
  F.hasCrops = map => { for (let i = 0; i < map.n; i += 7) if (map.plant[i] && D.plants[map.plant[i].def].crop) return true; return false; };
  F.pack = function (g) { const map = g.map; const fz = [], ps = []; for (let i = 0; i < map.n; i++) { const p = map.plant[i]; if (p && p.fz) fz.push(i); if (p && p.pest) ps.push(i); } g.ext = g.ext || {}; g.ext.fzList = fz; g.ext.pestList = ps; g.ext.fzApplied = false; };
  const lt = RW.Life.tick; RW.Life.tick = function (g) { lt(g); F.tick(g); if (g.ext && g.ext.pestList && !g.ext.pestApplied) { for (const i of g.ext.pestList) if (g.map.plant[i]) g.map.plant[i].pest = true; g.ext.pestApplied = true; } };
  // ---- малювання ----
  F.draw = function (c, TS, map, x0, y0, x1, y1, t) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * map.w + x;
      if (map.floor[i] === HYDRO) { c.strokeStyle = 'rgba(190,255,230,.22)'; c.lineWidth = 1; const ph = t * 0.04 + x * 1.3 + y * 0.9; c.beginPath(); c.moveTo(x * TS + 5, y * TS + 12 + Math.sin(ph) * 2); c.quadraticCurveTo(x * TS + 16, y * TS + 8 + Math.cos(ph) * 2, x * TS + 27, y * TS + 12 + Math.sin(ph + 1) * 2); c.stroke(); }
      const p = map.plant[i]; if (!p) continue;
      if (p.pest) { for (let k = 0; k < 4; k++) { const a = t * 0.07 + k * 1.6 + x; c.fillStyle = k % 2 ? '#2a1a10' : '#6a2a18'; c.beginPath(); c.arc(x * TS + 16 + Math.cos(a * 1.4) * 9, y * TS + 18 + Math.sin(a * 1.9) * 7, 1.6, 0, TAU); c.fill(); } c.fillStyle = 'rgba(160,90,40,.18)'; c.beginPath(); c.arc(x * TS + 16, y * TS + 16, 12, 0, TAU); c.fill(); }
      if (p.fz && p.growth < 1) { c.fillStyle = 'rgba(110,70,30,.5)'; c.fillRect(x * TS + 4, y * TS + 26, 24, 3); }
    }
  };
  // ---- лампи: фіолетове сяйво поверх росту ----
  F.zoneInfo = function (z) {
    const g = G(), map = g.map; let n = 0, ready = 0, pest = 0, fz = 0, hydro = 0, gs = 0;
    for (const i of z.cells) { if (F.hydro(map, i)) hydro++; const p = map.plant[i]; if (!p) continue; n++; gs += p.growth; if (p.growth >= 1) ready++; if (p.pest) pest++; if (p.fz) fz++; }
    return { n, ready, pest, fz, hydro, avg: n ? Math.round(gs / n * 100) : 0, cells: z.cells.size };
  };
})();
