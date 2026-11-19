'use strict';
// ============================================================
//  energy.js — 💨 вітрогенератор і 🔥 теплична піч
//  Вітрогенератор: 200 Вт при вітрі від 9 м/с, від 3 м/с вмикається, понад 13 м/с гальмує (×0.5).
//  Теплична піч: 0.5 дров/добу. У радіусі 5.5 клітин під дахом тримає ≥12°C і світло ≥0.7 для рослин.
// ============================================================
(function () {
  const D = RW.D, U = RW.U; const DY = D.DAY; const G = () => RW.G;
  const EN = RW.Energy = { wind: 4, CUT_IN: 3, RATED: 9, BRAKE: 13, STOVE_R: 5.5, STOVE_T: 12, STOVE_L: 0.7, warm: null, warmMap: null, pass: false };

  // ---------- визначення будівель ----------
  D.bld.wind = { id: 'wind', cat: 'power', name: 'Вітрогенератор', desc: '+200 Вт при вітрі від 9 м/с (від 3 м/с — слабше). Працює вночі й у негоду, але на сильному вітрі (13+) гальмує.', w: 2, h: 2, cost: { steel: 45, components: 2 }, work: 380, hp: 70, pass: 0, power: 200, wind: true, research: 'electricity', flam: 0, beauty: -1, color: '#cfd8dc' };
  D.bld.grow_stove = { id: 'grow_stove', cat: 'light', name: 'Теплична піч', desc: 'Тепла піч для теплиці: у радіусі 5 клітин під дахом рослини отримують тепло (≥12°C) і світло, навіть узимку. Спалює 0.5 дров на добу. Потрібні стіни й дах навколо грядок.', w: 1, h: 1, cost: { steel: 15, wood: 30 }, work: 170, hp: 60, pass: 0, fuel: { item: 'wood', cap: 6, burn: 0.5 / DY }, heat: 2.2, light: { r: 5, c: '#ffb866', a: 0.55 }, stove: true, research: 'agriculture', flam: 0.4, color: '#8a5a2a' };

  // ---------- вітер ----------
  const BASE = { clear: 4, cloudy: 5.5, rain: 7, storm: 12, snow: 5, fog: 1.5 };
  function windTick(g) {
    let tgt = (BASE[g.weather.type] != null ? BASE[g.weather.type] : 4) + 2.2 * Math.sin(g.tick / 2400) + 1.4 * Math.sin(g.tick / 700 + 2);
    if (RW.Seas && RW.Seas.stormOn()) tgt = 11.5 + 1.2 * Math.sin(g.tick / 300);
    EN.wind = U.clamp(EN.wind + (tgt - EN.wind) * 0.04, 0, 16);
  }
  EN.windFactor = () => { const w = EN.wind; if (w < EN.CUT_IN) return 0; let f = Math.min(1, (w - EN.CUT_IN) / (EN.RATED - EN.CUT_IN)); if (w > EN.BRAKE) f *= 0.5; return f; };

  // ---------- тепло теплиці ----------
  function warmTick(g) {
    const map = g.map; if (!EN.warm || EN.warmMap !== map) { EN.warm = new Uint8Array(map.n); EN.warmMap = map; } else EN.warm.fill(0);
    const R = EN.STOVE_R, R2 = R * R;
    for (const b of map.buildings) {
      if (!b.def.stove || !(b.fuel > 0) || b.hp <= 0) continue;
      const cx = b.x + 0.5, cy = b.y + 0.5;
      for (let y = Math.floor(cy - R); y <= cy + R; y++) for (let x = Math.floor(cx - R); x <= cx + R; x++) {
        if (!map.inb(x, y)) continue; const dx = x + 0.5 - cx, dy = y + 0.5 - cy; if (dx * dx + dy * dy > R2) continue;
        const i = y * map.w + x; if (map.blk[i] > 0 || !map.isRoofed(i)) continue; EN.warm[i] = 1;
      }
    }
  }
  const GM = RW.GameMap.prototype, ta = GM.tempAt, la = GM.lightAt;
  GM.tempAt = function (i, o) { const t = ta.call(this, i, o); return (EN.pass && EN.warmMap === this && EN.warm[i] && t < EN.STOVE_T) ? EN.STOVE_T : t; };
  GM.lightAt = function (x, y, d) { const v = la.call(this, x, y, d); if (EN.pass && EN.warmMap === this && v < EN.STOVE_L && EN.warm[Math.floor(y) * this.w + Math.floor(x)]) return EN.STOVE_L; return v; };
  const tp = RW.Events.tickPlants;
  RW.Events.tickPlants = function (dt) { EN.pass = true; try { return tp.call(this, dt); } finally { EN.pass = false; } };

  // ---------- тік ----------
  const lt = RW.Life.tick;
  RW.Life.tick = function (g) {
    lt(g);
    if (g.tick % 30 === 5) windTick(g);
    if (g.tick % 60 === 17) {
      warmTick(g);
      const f = EN.windFactor(); D.bld.wind.desc = '+200 Вт при вітрі від 9 м/с (від 3 м/с — слабше), на вітрі 13+ гальмує. Зараз: вітер ' + EN.wind.toFixed(1) + ' м/с → ' + Math.round(200 * f) + ' Вт.';
    }
  };

  // ---------- значок вітру (лише коли є вітряки) ----------
  RW.Seas.chips.push(g => {
    let n = 0; for (const b of g.map.buildings) if (b.def.wind) n++; if (!n) return [];
    const f = EN.windFactor(); return [{ k: 'wind', ico: '💨', t: 'Вітер ' + EN.wind.toFixed(1) + ' м/с · ' + Math.round(f * 100) + '%', cls: f > 0.05 ? 'wind' : 'calm', pct: f, title: 'Вітрогенератори: ' + n + ' шт., виробіток ' + Math.round(200 * f * n) + ' Вт' }];
  });

  // ---------- спрайти ----------
  const sprites = {};
  function cv(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return c; }
  function windSprite() {
    return cv(64, 64, (x, W, H) => {
      x.fillStyle = 'rgba(0,0,0,0.22)'; x.beginPath(); x.ellipse(36, 40, 22, 17, 0, 0, 6.3); x.fill();
      const g = x.createRadialGradient(30, 28, 3, 32, 32, 24); g.addColorStop(0, '#b9c3c8'); g.addColorStop(1, '#6f7a80'); x.fillStyle = g; x.beginPath(); x.arc(32, 32, 22, 0, 6.3); x.fill();
      x.strokeStyle = '#4a545a'; x.lineWidth = 2; x.stroke(); x.fillStyle = '#e8eef0'; x.beginPath(); x.arc(32, 32, 7.5, 0, 6.3); x.fill(); x.strokeStyle = '#8a959b'; x.lineWidth = 1.5; x.stroke();
      x.fillStyle = '#5a666c'; for (let k = 0; k < 6; k++) { const a = k * 1.047; x.fillRect(32 + Math.cos(a) * 17 - 1.5, 32 + Math.sin(a) * 17 - 1.5, 3, 3); }
    });
  }
  function stoveSprite() {
    return cv(32, 32, (x) => {
      x.fillStyle = 'rgba(0,0,0,0.25)'; x.beginPath(); x.ellipse(17, 26, 11, 4, 0, 0, 6.3); x.fill();
      const g = x.createLinearGradient(0, 6, 0, 26); g.addColorStop(0, '#8d6a4a'); g.addColorStop(1, '#5a3d28'); x.fillStyle = g; x.beginPath(); x.moveTo(6, 25); x.lineTo(7, 12); x.quadraticCurveTo(16, 4, 25, 12); x.lineTo(26, 25); x.closePath(); x.fill();
      x.strokeStyle = '#3a2616'; x.lineWidth = 1.5; x.stroke(); x.fillStyle = '#1e140c'; x.beginPath(); x.moveTo(11, 25); x.lineTo(11, 18); x.quadraticCurveTo(16, 12, 21, 18); x.lineTo(21, 25); x.closePath(); x.fill();
      x.fillStyle = '#555'; x.fillRect(20, 3, 5, 9); x.fillStyle = '#777'; x.fillRect(19, 2, 7, 3);
      x.strokeStyle = 'rgba(120,200,120,0.8)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(8, 14); x.lineTo(5, 10); x.moveTo(24, 14); x.lineTo(27, 10); x.stroke();
    });
  }
  const bs = RW.GFX.bldSprite;
  RW.GFX.bldSprite = function (k, w, h) { if (k === 'wind') return sprites.wind || (sprites.wind = windSprite()); if (k === 'grow_stove') return sprites.stove || (sprites.stove = stoveSprite()); return bs.apply(this, arguments); };

  // ---------- анімації ----------
  EN.drawWind = function (c, b, px, py, t, g) {
    const cx = px + 32, cy = py + 32; const w = EN.wind; const on = g.map.isActive(b) !== false;
    const base = w < EN.CUT_IN ? 0.01 : 0.02 + (Math.min(w, 14) - EN.CUT_IN) * 0.0145; const brake = w > EN.BRAKE ? 0.55 : 1;
    const dt = Math.min(4, t - (b._lt == null ? t : b._lt)); b._lt = t; b._tw = (b._tw == null ? base : b._tw + (base * brake - b._tw) * 0.03); b._a = (b._a || (b.x * 1.3)) + b._tw * dt;
    const spd = b._tw;
    if (spd > 0.09) { c.fillStyle = 'rgba(235,245,250,' + Math.min(0.22, (spd - 0.09) * 1.6).toFixed(3) + ')'; c.beginPath(); c.arc(cx, cy, 27, 0, 6.3); c.fill(); }
    for (let pass = 0; pass < 2; pass++) {
      const ox = pass === 0 ? 3 : 0, oy = pass === 0 ? 4 : 0;
      for (let k = 0; k < 3; k++) {
        const a = b._a + k * 2.0944; c.save(); c.translate(cx + ox, cy + oy); c.rotate(a);
        c.fillStyle = pass === 0 ? 'rgba(0,0,0,0.17)' : '#f1f5f6'; c.beginPath(); c.moveTo(0, -2.2); c.quadraticCurveTo(14, -6.5, 27, -1.5); c.quadraticCurveTo(14, 1.8, 0, 2.2); c.closePath(); c.fill();
        if (pass === 1) { c.strokeStyle = '#9aa5ab'; c.lineWidth = 1; c.stroke(); c.fillStyle = '#d0393b'; c.fillRect(20, -2.6, 6, 2.2); }
        c.restore();
      }
    }
    c.fillStyle = '#cfd8dc'; c.beginPath(); c.arc(cx, cy, 4.2, 0, 6.3); c.fill(); c.strokeStyle = '#6f7a80'; c.lineWidth = 1.3; c.stroke();
    const net = EN.windFactor() > 0.05 && on; c.fillStyle = net ? '#5dff7a' : '#7a7a7a'; c.beginPath(); c.arc(cx, cy, 1.6, 0, 6.3); c.fill();
    if (net && Math.random() < 0.02 * EN.windFactor()) RW.R.fx.text(b.x + 1, b.y + 0.2, '⚡', '#ffe36a');
  };
  EN.drawStove = function (c, b, px, py, t, flame) {
    if (!(b.fuel > 0)) { c.fillStyle = 'rgba(20,12,6,0.45)'; c.beginPath(); c.arc(px + 16, py + 19, 4.5, 0, 6.3); c.fill(); return; }
    const fl = 1 + Math.sin(t * 0.45 + b.x * 3) * 0.18; flame(px + 16, py + 22, 0.62, fl, b.x * 5);
    const g = c.createRadialGradient(px + 16, py + 20, 2, px + 16, py + 20, 34); g.addColorStop(0, 'rgba(255,170,70,' + (0.3 + Math.sin(t * 0.3) * 0.05).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,140,40,0)'); c.fillStyle = g; c.beginPath(); c.arc(px + 16, py + 20, 34, 0, 6.3); c.fill();
    if (Math.random() < 0.05) RW.R.fx.smoke(px / 32 + 0.78, py / 32 + 0.05, '#777');
  };
  // м'яке сяйво теплиці + золоті мерехтливі цятки, що піднімаються над рослинами
  function drawWarm(c, TS, map, x0, y0, x1, y1, time) {
    if (!EN.warm || EN.warmMap !== map) return; const W = map.w; const pulse = 0.5 + 0.5 * Math.sin(time * 0.04);
    let any = false;
    for (let y = Math.max(0, y0); y <= y1 && y < map.h; y++) for (let x = Math.max(0, x0); x <= x1 && x < W; x++) {
      const i = y * W + x; if (!EN.warm[i]) continue; any = true;
      c.fillStyle = 'rgba(255,196,96,' + (0.07 + pulse * 0.04).toFixed(3) + ')'; c.fillRect(x * TS, y * TS, TS, TS);
      const pl = map.plant[i];
      if (pl && D.plants[pl.def].crop && ((i * 11 + (time / 30 | 0)) % 9) === 0) { const ph = (time * 0.03 + i) % 1; c.fillStyle = 'rgba(190,255,150,' + (0.6 * (1 - ph)).toFixed(3) + ')'; c.fillRect(x * TS + 8 + (i % 5) * 3, y * TS + TS * (0.7 - ph * 0.6), 2, 2); }
    }
    if (!any) return;
    for (const b of map.buildings) {
      if (!b.def.stove || !(b.fuel > 0) || b.x < x0 - 6 || b.x > x1 + 6 || b.y < y0 - 6 || b.y > y1 + 6) continue;
      for (let k = 0; k < 9; k++) {
        const ph = (time * 0.006 + k * 0.113 + b.x * 0.07) % 1; const ang = k * 2.4 + b.y; const r = (0.9 + ((k * 37) % 10) / 10 * 4.2) * TS;
        const px = (b.x + 0.5) * TS + Math.cos(ang) * r, py = (b.y + 0.5) * TS + Math.sin(ang) * r - ph * 18;
        c.fillStyle = 'rgba(255,214,120,' + (0.55 * Math.sin(ph * 3.14)).toFixed(3) + ')'; c.beginPath(); c.arc(px, py, 1.4 + (k % 2), 0, 6.3); c.fill();
      }
    }
  }
  RW.R.worldOver.push(drawWarm);
})();
