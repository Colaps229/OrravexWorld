'use strict';
// ============================================================
//  seasons.js — сезонні події: 🌊 повінь (весна), ❄ хуртовина (холод), ☀ посуха (є в extras.js — тут лише анімація й значок)
//  Кожна подія має ПРОГНОЗ (повінь — за добу, хуртовина — за пів доби), наростання й спад.
//  Усі числа — у таблиці SE нижче.
// ============================================================
(function () {
  const D = RW.D, U = RW.U; const DY = D.DAY, HR = D.HOUR; const G = () => RW.G;
  const SE = RW.Seas = {
    FLOOD: { chance: 0.024, lead: DY, dur: 2 * DY, cool: 14, ramp: 0.25 * DY, maxTiles: 1400, reach: 5, work: 0.7, move: 0.6, cropDmg: 0.03 },
    STORM: { chance: 0.03, lead: 0.5 * DY, dur: 1 * DY, cool: 10, ramp: 0.15 * DY, work: 0.5, move: 0.8, temp: -8 },
    chips: []
  };
  const st = g => { const e = (g.ext = g.ext || {}); return (e.sea = e.sea || { flood: null, storm: null, last: { flood: -99, storm: -99 }, n: { flood: 0, storm: 0 } }); };
  const ramp = (ev, t, R) => { if (!ev || t < ev.start || t > ev.until) return 0; return Math.min(1, (t - ev.start) / R) * Math.min(1, (ev.until - t) / R); };
  const phase = (ev, t) => !ev ? 0 : (t < ev.start ? 1 : (t < ev.until ? 2 : 3)); // 1 прогноз, 2 триває, 3 завершено
  function floodLvl(g) { const e = st(g); return ramp(e.flood, g.tick, SE.FLOOD.ramp); }
  function stormLvl(g) { const e = st(g); return ramp(e.storm, g.tick, SE.STORM.ramp); }
  SE.floodLvl = () => { const g = G(); return g ? floodLvl(g) : 0; };
  SE.stormLvl = () => { const g = G(); return g ? stormLvl(g) : 0; };
  SE.stormOn = () => SE.stormLvl() > 0.05;

  // ---------- затоплені клітинки (детерміновано з seed) ----------
  let fcache = null;
  function floodTiles(g, ev) {
    if (fcache && fcache.seed === ev.seed && fcache.map === g.map) return fcache;
    const map = g.map, W = map.w; const rng = U.rng(ev.seed); const dist = new Int8Array(map.n).fill(-1); const q = [];
    for (let i = 0; i < map.n; i++) if (map.terrain[i] <= 1) { dist[i] = 0; q.push(i); }
    const tiles = new Map(); let cnt = 0;
    for (let h = 0; h < q.length && cnt < SE.FLOOD.maxTiles; h++) {
      const i = q[h], d = dist[i]; if (d >= SE.FLOOD.reach) continue; const x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy; if (!map.inb(xx, yy)) continue; const j = yy * W + xx; if (dist[j] >= 0) continue;
        if (map.terrain[j] <= 1) continue; dist[j] = d + 1;
        if (map.blk[j] > 0) continue;
        if (d + 1 > 2 && rng() > 1 - (d - 1) * 0.3) continue; // далі від води — рідше
        if (map.isRoofed(j)) continue;
        tiles.set(j, 1 - (d) / (SE.FLOOD.reach + 1)); q.push(j); cnt++;
      }
    }
    const arr = Array.from(tiles.keys());
    const edge = new Map(); for (const i of arr) { let m = 0; if (!tiles.has(i - W) && map.terrain[i - W] > 1) m |= 1; if (!tiles.has(i + 1) && map.terrain[i + 1] > 1) m |= 2; if (!tiles.has(i + W) && map.terrain[i + W] > 1) m |= 4; if (!tiles.has(i - 1) && map.terrain[i - 1] > 1) m |= 8; edge.set(i, m); }
    return (fcache = { seed: ev.seed, map: g.map, tiles, arr, edge });
  }
  SE.flooded = i => { const g = G(); if (!g) return 0; const e = st(g); if (!e.flood || phase(e.flood, g.tick) !== 2) return 0; const f = floodTiles(g, e.flood); return f.tiles.has(i) ? floodLvl(g) : 0; };

  // ---------- множники для людей ----------
  const P = RW.Pawn.prototype; const ws = P.workSpeed, ms = P.moveSpeed;
  P.workSpeed = function () {
    let r = ws.apply(this, arguments); const g = G(); if (!g || !g.map) return r;
    const f = floodLvl(g), s = stormLvl(g); if (f < 0.05 && s < 0.05) return r;
    if (g.map.isRoofed(this.ty * g.map.w + this.tx)) return r;
    return r * (1 - (1 - SE.FLOOD.work) * f) * (1 - (1 - SE.STORM.work) * s);
  };
  P.moveSpeed = function () {
    let r = ms.apply(this, arguments); const g = G(); if (!g || !g.map) return r;
    const s = stormLvl(g); const i = this.ty * g.map.w + this.tx;
    if (s > 0.05 && !g.map.isRoofed(i)) r *= (1 - (1 - SE.STORM.move) * s);
    const f = SE.flooded(i); if (f > 0.3) r *= SE.FLOOD.move;
    return r;
  };

  // ---------- погода під подію ----------
  const pw = RW.Events.pickWeather;
  RW.Events.pickWeather = function () {
    pw.apply(this, arguments); const g = G(); if (!g || !g.map) return; const e = st(g);
    if (e.storm && phase(e.storm, g.tick) === 2) { g.weather = { type: 'snow', left: Math.max(60, e.storm.until - g.tick), t: 0 }; g.map.weatherMul = 0.3; }
    else if (e.flood && phase(e.flood, g.tick) !== 3 && g.tick >= e.flood.start - SE.FLOOD.lead * 0.5) { const w = Math.random() < 0.65 ? 'rain' : 'cloudy'; g.weather = { type: w, left: U.ri(2, 5) * HR, t: 0 }; g.map.weatherMul = w === 'rain' ? 0.25 : 0.55; }
  };

  // ---------- планування й хід подій ----------
  const busy = g => { const e = st(g); return (e.flood && phase(e.flood, g.tick) < 3) || (e.storm && phase(e.storm, g.tick) < 3) || (RW.Extras && RW.Extras.drought && RW.Extras.drought(g)) || (g.tempOffset && g.tick < g.tempOffset.until); };
  function waterCount(map) { let n = 0; for (let i = 0; i < map.n; i += 3) if (map.terrain[i] <= 1) n++; return n * 3; }
  function roll(g) {
    const e = st(g), day = D.relDay(g.tick); if (day < 8 || busy(g)) return;
    const season = D.seasonOf(g.tick);
    if (season === 0 && day - e.last.flood >= SE.FLOOD.cool && Math.random() < SE.FLOOD.chance && waterCount(g.map) >= 25) {
      e.flood = { warn: g.tick, start: g.tick + SE.FLOOD.lead, until: g.tick + SE.FLOOD.lead + SE.FLOOD.dur, seed: (Math.random() * 1e9) | 0, done: false, notified: false };
      RW.UI.letter('Прогноз: повінь', 'Талі води й дощі підіймають рівень річок. Приблизно через добу низини біля води затопить на ~2 доби: люди ходитимуть повільніше (−40%), робота надворі піде на 30% повільніше, їжа на землі псуватиметься швидше, а посіви трохи постраждають. Після відходу води мул удобрить поля. Перенесіть припаси з низин!', 'bad');
      fcache = null;
    } else if (g.outTemp < 2 && day - e.last.storm >= SE.STORM.cool && Math.random() < SE.STORM.chance) {
      e.storm = { warn: g.tick, start: g.tick + SE.STORM.lead, until: g.tick + SE.STORM.lead + SE.STORM.dur, done: false, notified: false };
      RW.UI.letter('Прогноз: хуртовина', 'За ~12 годин налетить снігова буря на добу: надворі робота йтиме вдвічі повільніше, ходьба — на 20% повільніше, колоністи їстимуть на 20% більше, вітряки крутитимуться на повну, а сонячні панелі дадуть мало. Заведіть людей усередину й дозапаситесь дровами!', 'bad');
    }
  }
  function step(g) {
    const e = st(g), t = g.tick;
    if (e.flood) {
      const f = e.flood, ph = phase(f, t);
      if (ph === 2 && !f.notified) { f.notified = true; RW.UI.toast('🌊 Вода піднімається!', 'bad'); if (RW.A) RW.A.sfx('alert'); }
      if (ph === 2 && t % 60 === 13) {
        const lv = floodLvl(g), ft = floodTiles(g, f), map = g.map;
        for (const i of ft.arr) {
          const arr = map.items.get(i); if (arr) for (const it of arr) { const d = D.items[it.def]; if (d && d.rot) it.age += 60 * 0.8 * lv; }
          const pl = map.plant[i]; if (pl && lv > 0.4 && D.plants[pl.def].crop && !RW.Farming.hydro(map, i)) pl.hp = Math.max(1, pl.hp - SE.FLOOD.cropDmg * lv);
        }
      }
      if (ph === 3 && !f.done) {
        f.done = true; e.last.flood = D.relDay(t); e.n.flood++; g.stats.floods = (g.stats.floods || 0) + 1;
        const ft = floodTiles(g, f), map = g.map; let silt = 0; for (const i of ft.arr) { const pl = map.plant[i]; if (pl && D.plants[pl.def].crop) { pl.fz = 1; silt++; } }
        RW.UI.letter('Вода відступила', 'Повінь скінчилась.' + (silt ? ' Мул удобрив ' + silt + ' рослин: вони ростимуть і даватимуть урожай на 30% краще.' : ''), 'good'); e.flood = null; fcache = null;
      }
    }
    if (e.storm) {
      const s = e.storm, ph = phase(s, t);
      if (ph === 2 && !s.notified) { s.notified = true; g.tempOffset = { v: SE.STORM.temp, until: s.until }; g.weather = { type: 'snow', left: s.until - t, t: 0 }; g.map.weatherMul = 0.3; RW.UI.toast('❄ Починається хуртовина!', 'bad'); if (RW.A) RW.A.sfx('alert'); }
      if (ph === 3 && !s.done) { s.done = true; e.last.storm = D.relDay(t); e.n.storm++; g.stats.storms = (g.stats.storms || 0) + 1; RW.UI.letter('Хуртовина стихла', 'Буря минула. Колонія вистояла.', 'good'); e.storm = null; }
    }
  }
  const lt = RW.Life.tick;
  RW.Life.tick = function (g) {
    lt(g);
    if (g.tick % 60 === 13) { try { step(g); } catch (err) { console.error(err); } }
    if (g.tick % DY === 2500) { try { roll(g); } catch (err) { console.error(err); } }
  };

  // ---------- значки подій (зліва) ----------
  const fmtT = ticks => { const h = Math.max(1, Math.ceil(ticks / HR)); return h >= 24 ? Math.floor(h / 24) + ' д ' + (h % 24) + ' г' : h + ' г'; };
  SE.chips.push(g => {
    const e = st(g), t = g.tick, out = [];
    if (e.flood) { const ph = phase(e.flood, t); if (ph === 1) out.push({ k: 'flood', ico: '🌊', t: 'Повінь через ' + fmtT(e.flood.start - t), cls: 'warn', pct: 1 - (e.flood.start - t) / SE.FLOOD.lead }); else if (ph === 2) out.push({ k: 'flood', ico: '🌊', t: 'Повінь · ще ' + fmtT(e.flood.until - t), cls: 'on', pct: (e.flood.until - t) / SE.FLOOD.dur }); }
    if (e.storm) { const ph = phase(e.storm, t); if (ph === 1) out.push({ k: 'storm', ico: '❄', t: 'Хуртовина через ' + fmtT(e.storm.start - t), cls: 'warn', pct: 1 - (e.storm.start - t) / SE.STORM.lead }); else if (ph === 2) out.push({ k: 'storm', ico: '❄', t: 'Хуртовина · ще ' + fmtT(e.storm.until - t), cls: 'on', pct: (e.storm.until - t) / SE.STORM.dur }); }
    const dr = RW.Extras && RW.Extras.drought && RW.Extras.drought(g); if (dr) out.push({ k: 'dry', ico: '☀', t: 'Посуха · ще ' + fmtT(dr.until - t), cls: 'on', pct: (dr.until - t) / (dr.until - dr.start) });
    return out;
  });
  let box = null; const chipEls = new Map();
  setInterval(() => {
    const g = G(); if (!g || !g.map || !RW.Game.running || RW.R.viewG) { if (box) box.style.display = 'none'; return; }
    if (!box) { box = document.createElement('div'); box.id = 'sea-box'; document.body.appendChild(box); } box.style.display = '';
    const list = []; for (const f of SE.chips) { try { for (const c of f(g) || []) list.push(c); } catch (e) { } }
    const keep = new Set(list.map(c => c.k));
    for (const [k, el] of chipEls) if (!keep.has(k)) { el.classList.add('out'); setTimeout(() => el.remove(), 400); chipEls.delete(k); }
    for (const c of list) {
      let el = chipEls.get(c.k); if (!el) { el = document.createElement('div'); el.className = 'sea-chip'; el.innerHTML = '<span class="ico"></span><span class="tx"></span><i class="bar"><b></b></i>'; box.appendChild(el); chipEls.set(c.k, el); }
      el.className = 'sea-chip ' + (c.cls || ''); el.querySelector('.ico').textContent = c.ico; el.querySelector('.tx').textContent = c.t; el.querySelector('.bar b').style.width = Math.round(Math.max(0, Math.min(1, c.pct)) * 100) + '%';
      if (c.title) el.title = c.title;
    }
  }, 500);

  // ---------- анімація: вода повені (у світі) ----------
  function drawFlood(c, TS, map, x0, y0, x1, y1, time) {
    const g = G(), e = st(g); if (!e.flood || phase(e.flood, g.tick) !== 2) return; const lv = floodLvl(g); if (lv < 0.02) return;
    const ft = floodTiles(g, e.flood), W = map.w;
    for (const i of ft.arr) {
      const x = i % W, y = (i / W) | 0; if (x < x0 - 1 || x > x1 + 1 || y < y0 - 1 || y > y1 + 1) continue;
      const df = ft.tiles.get(i); const sh = 0.5 + 0.5 * Math.sin(time * 0.04 + x * 0.9 + y * 0.6);
      c.fillStyle = 'rgba(' + (40 + sh * 18 | 0) + ',' + (112 + sh * 22 | 0) + ',' + (176 + sh * 20 | 0) + ',' + ((0.34 + 0.2 * df) * lv).toFixed(3) + ')'; c.fillRect(x * TS, y * TS, TS + 0.5, TS + 0.5);
      // брижі
      if (((i * 7 + (time / 14 | 0)) % 6) === 0) { const ph = (time * 0.05 + i) % 6.3; c.strokeStyle = 'rgba(210,235,255,' + (0.35 * lv * (1 - ph / 6.3)).toFixed(3) + ')'; c.lineWidth = 1.2; c.beginPath(); c.ellipse(x * TS + TS * (0.3 + 0.4 * ((i * 13) % 5) / 5), y * TS + TS * (0.35 + 0.3 * ((i * 17) % 5) / 5), 3 + ph * 1.6, 1.6 + ph * 0.7, 0, 0, 6.3); c.stroke(); }
      // піна на межі
      const m = ft.edge.get(i); if (m) { c.fillStyle = 'rgba(240,250,255,' + ((0.45 + 0.2 * sh) * lv).toFixed(3) + ')'; const px = x * TS, py = y * TS, w = 3; if (m & 1) c.fillRect(px, py, TS, w); if (m & 2) c.fillRect(px + TS - w, py, w, TS); if (m & 4) c.fillRect(px, py + TS - w, TS, w); if (m & 8) c.fillRect(px, py, w, TS); }
    }
  }
  RW.R.worldOver.push(drawFlood);

  // ---------- анімація на екрані: хуртовина, посуха, повінь ----------
  const streaks = []; for (let k = 0; k < 150; k++) streaks.push({ x: Math.random(), y: Math.random(), v: 0.6 + Math.random() * 0.9, l: 18 + Math.random() * 46 });
  const motes = []; for (let k = 0; k < 40; k++) motes.push({ x: Math.random(), y: Math.random(), v: 0.3 + Math.random() * 0.8, p: Math.random() * 6.3 });
  function drawScreen(c, W, H, time) {
    const g = G(); if (!g || !g.map) return; const e = st(g);
    const s = stormLvl(g);
    if (s > 0.01) {
      const gust = 0.65 + 0.35 * Math.sin(time * 0.018) * Math.sin(time * 0.0071 + 1);
      const gr = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.75); gr.addColorStop(0, 'rgba(225,235,248,' + (0.06 * s * gust).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(225,235,248,' + (0.46 * s * gust).toFixed(3) + ')'); c.fillStyle = gr; c.fillRect(0, 0, W, H);
      c.strokeStyle = 'rgba(255,255,255,' + (0.5 * s).toFixed(3) + ')'; c.lineWidth = 1.2; c.beginPath();
      for (const p of streaks) { p.x -= 0.014 * p.v * (0.6 + gust) ; p.y += 0.003 * p.v; if (p.x < -0.1) { p.x = 1.1; p.y = Math.random(); } if (p.y > 1.05) p.y = -0.05; const x = p.x * W, y = p.y * H; c.moveTo(x, y); c.lineTo(x + p.l * gust, y - p.l * 0.12); }
      c.stroke();
    }
    const dr = RW.Extras && RW.Extras.drought && RW.Extras.drought(g);
    if (dr) {
      const lv = Math.min(1, (g.tick - dr.start) / DY) * Math.min(1, (dr.until - g.tick) / (DY * 0.5));
      c.fillStyle = 'rgba(255,168,60,' + (0.085 * lv).toFixed(3) + ')'; c.fillRect(0, 0, W, H);
      const sg = c.createRadialGradient(W * 0.08, H * 0.05, 4, W * 0.08, H * 0.05, Math.max(W, H) * 0.55); sg.addColorStop(0, 'rgba(255,236,170,' + (0.3 * lv).toFixed(3) + ')'); sg.addColorStop(1, 'rgba(255,200,100,0)'); c.fillStyle = sg; c.fillRect(0, 0, W, H);
      for (let k = 0; k < 7; k++) { const y = ((time * 0.45 + k * H / 7) % (H + 40)) - 20; const a = 0.05 * lv * (0.6 + 0.4 * Math.sin(time * 0.02 + k)); c.fillStyle = 'rgba(255,240,210,' + a.toFixed(3) + ')'; c.beginPath(); c.moveTo(0, y); for (let x = 0; x <= W; x += 40) c.lineTo(x, y + Math.sin(x * 0.02 + time * 0.06 + k) * 4); for (let x = W; x >= 0; x -= 40) c.lineTo(x, y + 9 + Math.sin(x * 0.02 + time * 0.06 + k) * 4); c.closePath(); c.fill(); }
      c.fillStyle = 'rgba(230,190,120,' + (0.35 * lv).toFixed(3) + ')'; for (const p of motes) { p.x += 0.0016 * p.v; p.p += 0.02; p.y += Math.sin(p.p) * 0.0007; if (p.x > 1.02) { p.x = -0.02; p.y = Math.random(); } c.fillRect(p.x * W, p.y * H, 2, 2); }
    }
    const f = floodLvl(g); if (f > 0.01) { c.fillStyle = 'rgba(60,110,170,' + (0.06 * f).toFixed(3) + ')'; c.fillRect(0, 0, W, H); }
  }
  RW.R.screenOver.push(drawScreen);
})();
