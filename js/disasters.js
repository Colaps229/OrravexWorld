// ============================================================
//  disasters.js — стихійні лиха: землетрус, метеорити, токсичний дощ, град
// ============================================================
(function () {
  'use strict';
  const RW = window.RW; const D = RW.D, U = RW.U, E = RW.Events; const G = () => RW.G; const TAU = Math.PI * 2; const DY = D.DAY, HR = D.HOUR;
  const X = RW.Disasters = {};
  D.illnesses.toxic = { l: 'Токсичне отруєння', sev: 0.00005, imm: 0.00004, lethal: false, cons: 0.3, move: 0.25, pain: 0.1 };
  D.thoughts.toxic_air = { l: 'Токсичне повітря', v: -6, dur: 0.3 * DY, stack: 1 }; D.thoughtIco && (D.thoughtIco.toxic_air = '☣');
  D.thoughts.quake_fear = { l: 'Землетрус!', v: -5, dur: 1.5 * DY, stack: 1 }; D.thoughtIco && (D.thoughtIco.quake_fear = '🌋');
  D.thoughts.meteor_awe = { l: 'Падаючі зірки', v: 3, dur: 1 * DY, stack: 1 }; D.thoughtIco && (D.thoughtIco.meteor_awe = '☄');
  const st = g => { g.ext = g.ext || {}; const e = g.ext; e.dis = e.dis || { kind: null, until: 0, decals: [], meteors: [], quake: null }; return e.dis; };
  X.state = st;
  const outdoor = (map, i) => !map.isRoofed(i);
  const letter = (t, s, k, pos) => RW.UI && RW.UI.letter(t, s, k, null, pos);
  const addDecal = (d, o) => { d.decals.push(o); if (d.decals.length > 90) d.decals.shift(); };

  // ---------- Землетрус ----------
  X.earthquake = function () {
    const g = G(), map = g.map, d = st(g); if (d.quake) return false;
    const cx = g.home.x + U.rr(-8, 8), cy = g.home.y + U.rr(-8, 8);
    d.quake = { t: 0, dur: 300, cx, cy, hits: 0 }; RW.A && RW.A.sfx('rumble');
    letter('Землетрус!', 'Земля здригається! Будівлі можуть зазнати пошкоджень, тримайтесь подалі від хиткого.', 'bad', { x: cx, y: cy });
    for (const p of g.pawns) if (p.faction === 'colony') p.addThought('quake_fear'); return true;
  };
  function tickQuake(g, d) {
    const q = d.quake; if (!q) return; q.t++; const map = g.map; const k = Math.sin(q.t / q.dur * Math.PI);
    RW.R.shake = Math.max(RW.R.shake, 3 + 9 * k);
    if (q.t % 30 === 0 && RW.A) RW.A.sfx('rumble');
    if (q.t % 6 === 0 && RW.FX2) { for (let n = 0; n < 2; n++) RW.FX2.emit('dustpuff', q.cx + U.rr(-14, 14), q.cy + U.rr(-10, 10)); }
    if (q.t % 14 === 0) { // тріщини
      const a = U.rr(0, TAU); let x = q.cx + U.rr(-8, 8), y = q.cy + U.rr(-8, 8); const seg = []; for (let s = 0; s < 6; s++) { seg.push([x, y]); const aa = a + U.rr(-0.6, 0.6); x += Math.cos(aa) * U.rr(0.5, 1.1); y += Math.sin(aa) * U.rr(0.5, 1.1); } addDecal(d, { t: 'crack', seg, s: g.tick });
    }
    if (q.t % 30 === 0) {
      const bs = map.buildings.filter(b => !b.dead && !b.def.floor && !b.def.wreck && Math.hypot(b.x - q.cx, b.y - q.cy) < 24);
      for (let n = 0; n < 2 && bs.length; n++) { const b = bs.splice(U.ri(0, bs.length - 1), 1)[0]; RW.Combat.hitBuilding(b, b.def.hp * U.rr(0.12, 0.34), null); if (!b.dead && RW.FX2) RW.FX2.burst('dustpuff', b.x + b.w / 2, b.y + b.h / 2, 5); q.hits++; }
      for (const p of g.pawns) if (!p.dead && Math.hypot(p.x - q.cx, p.y - q.cy) < 12 && Math.random() < 0.07) { p.takeDamage(U.rr(3, 6), 'blunt', null); if (RW.FX2) RW.FX2.emit('star', p.x, p.y - 0.5, { c: '#ffffff' }); }
      if (q.t === 150 && Math.random() < 0.7) { // оголення руди
        for (let n = 0; n < 30; n++) { const x = Math.floor(q.cx + U.rr(-14, 14)), y = Math.floor(q.cy + U.rr(-14, 14)); if (!map.inb(x, y)) continue; const i = y * map.w + x; if (map.blk[i] === 0 && map.cost[i] > 0 && !map.bld[i] && !map.plant[i] && Math.random() < 0.3) { map.addItem(Math.random() < 0.7 ? 'stone_chunk' : 'steel', Math.random() < 0.7 ? 1 : 12, x, y); } }
      }
    }
    if (q.t >= q.dur) { d.quake = null; map.allDirty = true; letter('Землетрус стих', 'Пошкоджено будівель: ' + q.hits + '.', 'warn'); }
  }
  // ---------- Метеорити ----------
  X.meteors = function (n) {
    const g = G(), map = g.map, d = st(g); n = n || U.ri(3, 7);
    for (let k = 0; k < n; k++) { const x = U.rr(6, map.w - 6), y = U.rr(6, map.h - 6); d.meteors.push({ x, y, delay: 20 + k * U.ri(18, 60), t: 0, big: Math.random() < 0.25 }); }
    RW.A && RW.A.sfx('whoosh'); letter('Метеоритний дощ!', 'На карту падають метеорити — деякі вціліють як сталева руда. Небезпечно виходити надвір.', 'warn'); for (const p of g.pawns) if (p.faction === 'colony') p.addThought('meteor_awe'); return true;
  };
  function tickMeteors(g, d) {
    const map = g.map; for (let i = d.meteors.length - 1; i >= 0; i--) {
      const m = d.meteors[i]; m.delay--; if (m.delay > 0) continue; m.t++;
      if (m.t === 1) RW.A && RW.A.sfx('whoosh');
      if (m.t >= 60) { // удар
        const x = m.x, y = m.y, xi = Math.floor(x), yi = Math.floor(y); d.meteors.splice(i, 1); const R = m.big ? 2.4 : 1.4;
        RW.R.fx.ring(x, y, m.big ? 4.5 : 2.6, '#ffb060'); RW.R.fx.ring(x, y, m.big ? 2.5 : 1.4, '#fff'); RW.R.fx.dust(x, y, m.big ? 20 : 10); RW.R.shake = Math.max(RW.R.shake, m.big ? 12 : 6); RW.A && RW.A.sfx('crash');
        if (RW.FX2) { RW.FX2.burst('ember', x, y, 14); RW.FX2.burst('sparkle', x, y, 8, { c: '#ffb060' }); }
        addDecal(d, { t: 'crater', x, y, r: R, s: g.tick });
        for (const b of map.buildings.slice()) if (!b.dead && Math.hypot(b.x + b.w / 2 - x, b.y + b.h / 2 - y) < R + 1) RW.Combat.hitBuilding(b, m.big ? 120 : 50, null);
        for (const p of g.pawns) if (!p.dead && Math.hypot(p.x - x, p.y - y) < R + 1) p.takeDamage(m.big ? 30 : 14, 'blunt', null);
        const i0 = yi * map.w + xi; if (map.inb(xi, yi) && map.cost[i0] > 0) { map.addItem('steel', m.big ? U.ri(40, 90) : U.ri(8, 30), xi, yi); if (!map.isRoofed(i0) && Math.random() < 0.8) E.startFire(i0, 0.6); if (map.plant[i0]) map.removePlant(i0); }
      }
    }
  }
  X.drawMeteors = function (c, TS, t) {
    const g = G(); const d = g.ext && g.ext.dis; if (!d) return;
    for (const dc of d.decals) {
      const age = g.tick - dc.s; const a = Math.max(0.25, 1 - age / (20 * DY));
      if (dc.t === 'crater') { const x = dc.x * TS, y = dc.y * TS, r = dc.r * TS; const gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(20,12,8,' + (0.7 * a).toFixed(2) + ')'); gr.addColorStop(0.6, 'rgba(50,30,18,' + (0.55 * a).toFixed(2) + ')'); gr.addColorStop(1, 'rgba(50,30,18,0)'); c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.strokeStyle = 'rgba(255,170,90,' + (0.35 * Math.max(0, 1 - age / 1500)).toFixed(2) + ')'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, r * 0.55, 0, TAU); c.stroke(); }
      else if (dc.t === 'crack') { c.strokeStyle = 'rgba(15,10,8,' + (0.75 * a).toFixed(2) + ')'; c.lineWidth = 1.6; c.beginPath(); dc.seg.forEach((p, k) => k ? c.lineTo(p[0] * TS, p[1] * TS) : c.moveTo(p[0] * TS, p[1] * TS)); c.stroke(); c.strokeStyle = 'rgba(0,0,0,' + (0.3 * a).toFixed(2) + ')'; c.lineWidth = 3.2; c.stroke(); }
    }
    for (const m of d.meteors) { if (m.delay > 0) continue; const k = m.t / 60; const x = m.x * TS + (1 - k) * 260, y = m.y * TS - (1 - k) * 420; // падіння по діагоналі
      const gr = c.createLinearGradient(x, y, x + 120 * (1 - k) + 20, y - 190 * (1 - k) - 30); gr.addColorStop(0, 'rgba(255,230,160,.9)'); gr.addColorStop(1, 'rgba(255,120,40,0)'); c.strokeStyle = gr; c.lineWidth = m.big ? 7 : 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 120 * (1 - k) + 20, y - 190 * (1 - k) - 30); c.stroke();
      c.fillStyle = '#fff6d0'; c.beginPath(); c.arc(x, y, m.big ? 6 : 4, 0, TAU); c.fill(); c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(255,150,50,.45)'; c.beginPath(); c.arc(x, y, (m.big ? 14 : 9), 0, TAU); c.fill(); c.globalCompositeOperation = 'source-over';
      // тінь, що росте
      c.fillStyle = 'rgba(0,0,0,' + (0.3 * k).toFixed(2) + ')'; c.beginPath(); c.ellipse(m.x * TS, m.y * TS + 2, 14 * k, 6 * k, 0, 0, TAU); c.fill();
    }
  };
  // ---------- Токсичний дощ ----------
  X.toxic = function () {
    const g = G(), d = st(g); if (d.kind) return false; d.kind = 'toxic'; d.until = g.tick + U.rr(2, 3.4) * DY; d.t0 = g.tick;
    RW.A && RW.A.sfx('alert'); letter('Токсичний дощ!', 'З неба сиплеться токсичний попіл. Ховайтесь під дахом! Рослини надворі гинуть, люди отруюються. Триватиме кілька діб.', 'bad'); return true;
  };
  X.hail = function () {
    const g = G(), d = st(g); if (d.kind) return false; d.kind = 'hail'; d.until = g.tick + U.rr(0.25, 0.5) * DY; d.t0 = g.tick;
    RW.A && RW.A.sfx('thunder'); letter('Град!', 'Починається град: він б\'є людей надворі, ламає скляні дахи й нищить посіви. Сховайтесь під міцним дахом.', 'warn'); return true;
  };
  function tickWeatherDis(g, d) {
    if (!d.kind) return; const map = g.map; if (g.tick >= d.until) { letter(d.kind === 'toxic' ? 'Токсичний дощ закінчився' : 'Град закінчився', 'Небо розчищається.', 'good'); d.kind = null; return; }
    if (d.kind === 'toxic') {
      if (g.tick % 30 === 0) {
        for (const p of g.pawns) { if (p.dead || p.isEnemy) continue; const i = p.ty * map.w + p.tx; if (outdoor(map, i)) { p.tox = (p.tox || 0) + 0.12; if (p.isColonist) p.addThought('toxic_air'); if (p.tox > 1) { p.tox = 0.4; if (p.addIllness) p.addIllness('toxic', 0.06); } } else p.tox = Math.max(0, (p.tox || 0) - 0.05); }
      }
      if (g.tick % 90 === 0) for (let n = 0; n < 24; n++) { const x = U.ri(0, map.w - 1), y = U.ri(0, map.h - 1), i = y * map.w + x; const pl = map.plant[i]; if (pl && outdoor(map, i)) { pl.hp -= 4; if (pl.hp <= 0) map.removePlant(i); } }
    } else {
      if (g.tick % 12 === 0) {
        for (const p of g.pawns) { if (p.dead) continue; const i = p.ty * map.w + p.tx; if (outdoor(map, i) && Math.random() < 0.18) { p.takeDamage(U.rr(2, 5), 'blunt', null); if (RW.FX2) RW.FX2.emit('star', p.x, p.y - 0.5, { c: '#e8f4ff' }); } }
        const roof = RW.Layers && RW.Layers.arr(map);
        if (roof) for (let n = 0; n < 12; n++) { const x = U.ri(0, map.w - 1), y = U.ri(0, map.h - 1), i = y * map.w + x; if (roof[i] === 3 && Math.random() < 0.35) { roof[i] = 0; if (RW.FX2) RW.FX2.burst('sparkle', x + 0.5, y + 0.5, 8, { c: '#bfe8ff' }); RW.A && RW.A.sfx('hit'); } }
        for (let n = 0; n < 18; n++) { const x = U.ri(0, map.w - 1), y = U.ri(0, map.h - 1), i = y * map.w + x; const pl = map.plant[i]; if (pl && outdoor(map, i) && D.plants[pl.def].crop) { pl.hp -= 3; if (pl.hp <= 0) map.removePlant(i); } const b = map.bld[i]; if (b && b.def.solar && outdoor(map, i)) RW.Combat.hitBuilding(b, 6, null); }
      }
    }
  }
  const rr = (a, b) => a + Math.random() * (b - a);
  const drops = [];
  X.drawScreen = function (c, W, H) {
    const g = G(); const d = g.ext && g.ext.dis; if (!d || !d.kind) return; const t = g.tick;
    const fade = Math.min(1, (t - d.t0) / 120, (d.until - t) / 120);
    if (d.kind === 'toxic') {
      c.fillStyle = 'rgba(90,120,20,' + (0.28 * fade).toFixed(3) + ')'; c.fillRect(0, 0, W, H);
      const gr = c.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.9); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(60,90,0,' + (0.4 * fade).toFixed(2) + ')'); c.fillStyle = gr; c.fillRect(0, 0, W, H);
      while (drops.length < 140) drops.push({ x: Math.random() * W, y: Math.random() * H, v: 2 + Math.random() * 3, p: Math.random() * 6, s: 1.5 + Math.random() * 2.5 });
      for (const q of drops) { q.y += q.v; q.p += 0.05; q.x += Math.sin(q.p) * 0.9 - 0.3; if (q.y > H) { q.y = -6; q.x = Math.random() * W; } c.fillStyle = 'rgba(170,220,70,' + (0.55 * fade).toFixed(2) + ')'; c.beginPath(); c.arc(q.x, q.y, q.s, 0, TAU); c.fill(); }
      c.fillStyle = 'rgba(190,255,100,' + (0.9 * fade).toFixed(2) + ')'; c.font = 'bold 13px sans-serif'; c.textAlign = 'center'; c.fillText('☣ Токсичний дощ — сховайтесь під дахом', W / 2, 108);
    } else if (d.kind === 'hail') {
      c.fillStyle = 'rgba(30,40,60,' + (0.22 * fade).toFixed(2) + ')'; c.fillRect(0, 0, W, H);
      while (drops.length < 90) drops.push({ x: Math.random() * W, y: Math.random() * H, v: 20 + Math.random() * 10, s: 2 + Math.random() * 3 });
      for (const q of drops) { q.y += q.v; q.x -= q.v * 0.22; if (q.y > H) { q.y = -10; q.x = Math.random() * W + 60; if (Math.random() < 0.5) { c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.arc(q.x - 40, H - Math.random() * H * 0.4, 5, 0, TAU); c.fill(); } } c.fillStyle = 'rgba(235,245,255,.92)'; c.beginPath(); c.arc(q.x, q.y, q.s, 0, TAU); c.fill(); c.strokeStyle = 'rgba(160,190,220,.5)'; c.lineWidth = 1; c.stroke(); }
    }
  };
  X.random = function () { const g = G(); const f = [[X.earthquake, 3], [X.meteors, 2.5], [X.hail, 2.5], [X.toxic, 1]]; const p = U.weighted(f, o => o[1]); return p[0](); };
  X.tick = function (g) { const d = st(g); tickQuake(g, d); tickMeteors(g, d); tickWeatherDis(g, d); };
  const lt = RW.Life.tick; RW.Life.tick = function (g) { lt(g); X.tick(g); };
})();
