// ============================================================
//  layers.js — шари будівництва: дахи (солом'яний/металевий/скляний), зняття даху,
//              оверлеї: дахи, енергомережа, температура, краса
// ============================================================
(function () {
  'use strict';
  const RW = window.RW; const D = RW.D, U = RW.U; const G = () => RW.G; const TAU = Math.PI * 2;
  const Ly = RW.Layers = { mode: null };
  const ROOF = Ly.ROOF = {
    1: { name: 'Солом\'яний дах', ico: '🌾', cost: { wood: 1 }, col: '#b8964a', desc: 'Дешево. Тримає дощ і тепло, пропускає лише трохи світла.' },
    2: { name: 'Металевий дах', ico: '🔩', cost: { steel: 2 }, col: '#8a96a4', desc: 'Міцний. Повністю затуляє світло й добре тримає тепло.' },
    3: { name: 'Скляний дах', ico: '🪟', cost: { steel: 1, components: 1 }, col: '#8ad0f0', desc: 'Пропускає сонячне світло — ідеальний для теплиць і їдалень.' }
  };
  Ly.arr = function (map) {
    if (map.roof) return map.roof; map.roof = new Uint8Array(map.n || map.w * map.h);
    const e = G() && G().ext; if (e && e.roofData) { try { const s = atob(e.roofData); for (let i = 0; i < s.length && i < map.roof.length; i++) map.roof[i] = s.charCodeAt(i); } catch (err) { } }
    return map.roof;
  };
  Ly.bps = function (map) { if (map.roofBP) return map.roofBP; map.roofBP = new Map(); const e = G() && G().ext; if (e && e.roofBP) for (const [i, k, pr] of e.roofBP) map.roofBP.set(i, { kind: k, prog: pr || 0, res: null }); return map.roofBP; };
  Ly.pack = function (g) {
    if (g.map.roofBP) { g.ext = g.ext || {}; g.ext.roofBP = Array.from(g.map.roofBP, ([i, b]) => [i, b.kind, b.prog]); }
    const r = g.map.roof; g.ext = g.ext || {}; if (!r) return; let any = false; for (let i = 0; i < r.length; i++) if (r[i]) { any = true; break; } if (!any) { delete g.ext.roofData; return; }
    let s = ''; for (let i = 0; i < r.length; i += 8192) s += String.fromCharCode.apply(null, r.subarray(i, i + 8192)); g.ext.roofData = btoa(s);
  };
  // ---- патчі світу ----
  const GM = RW.GameMap.prototype;
  const origRoofed = GM.isRoofed, origTemp = GM.tempAt, origLight = GM.lightAt;
  GM.isRoofed = function (i) { const r = this.roof && this.roof[i]; if (r === 255) return false; if (r > 0) return true; return origRoofed.call(this, i); };
  GM.tempAt = function (i, outT) {
    const r = this.roof && this.roof[i];
    if (r === 255) return outT * 0.92 + (this.room[i] >= 0 && this.rooms[this.room[i]] ? this.rooms[this.room[i]].temp * 0.08 : 0);
    if (r > 0 && this.room[i] < 0 && !this.mroof[i]) return outT * (r === 3 ? 0.78 : 0.7) + 14 * (r === 3 ? 0.22 : 0.3) + (r === 3 ? 1 : 0);
    return origTemp.call(this, i, outT);
  };
  GM.lightAt = function (x, y, daylight) {
    let v = origLight.call(this, x, y, daylight); const i = Math.floor(y) * this.w + Math.floor(x); const r = this.roof && this.roof[i];
    if (r === 3) v = Math.max(v, daylight * 0.88); else if (r === 255) v = Math.max(v, daylight); else if (r === 1) v = Math.max(v, daylight * 0.35);
    return v;
  };
  // ---- застосування інструмента ----
  Ly.apply = function (t, cells) {
    const g = G(), map = g.map; const roof = Ly.arr(map); let n = 0, lack = false; const stock = RW.Events.colonyStock(); const need = {};
    const take = (def, k) => { const s = map.byDef.get(def); if (!s) return; let left = k; for (const it of Array.from(s)) { if (left <= 0) break; if (it.forbid || it.res) continue; const q = Math.min(left, it.n); map.takeItem(it, q); left -= q; } };
    for (const [x, y] of cells) {
      const i = y * map.w + x; if (x < 0 || y < 0 || x >= map.w || y >= map.h) continue; if (map.blk[i] > 0 || map.terrain[i] <= 1 && !map.bld[i]) continue;
      if (t.kind === 'remove' && Ly.bps(map).delete(i)) { n++; continue; }
      if (t.kind === 'remove') { if (map.mroof[i]) continue; if (roof[i] > 0 && roof[i] !== 255) { const R = ROOF[roof[i]]; roof[i] = 0; for (const c in R.cost) map.addItem(c, Math.floor(R.cost[c] / 2), x, y); n++; } else if (map.room[i] >= 0 && roof[i] !== 255) { roof[i] = 255; n++; } continue; }
      if (t.kind === 'restore') { if (roof[i] === 255) { roof[i] = 0; n++; } continue; }
      const R = ROOF[t.kind]; if (roof[i] === +t.kind) continue; const bp = Ly.bps(map); const ex = bp.get(i); if (ex && ex.kind === +t.kind) continue;
      bp.set(i, { kind: +t.kind, prog: 0, res: null }); n++;
    }
    const plan = t.kind !== 'remove' && t.kind !== 'restore';
    if (n && plan) { RW.A && RW.A.sfx('click'); RW.UI && RW.UI.toast('Заплановано дах: ' + n + ' кл. — колоністи побудують (робота «Будівництво»)', 'info'); }
    if (n && !plan) { RW.A && RW.A.sfx('hammer'); map.allDirty = true; if (map.roomsDirty !== undefined) map.roomsDirty = true; RW.R && RW.R.invalidateAll && RW.R.invalidateAll(); }
    return n;
  };
  // ---- малювання ----
  function roofTile(c, x, y, kind, a, t) {
    const X = x * 32, Y = y * 32; c.globalAlpha = a;
    if (kind === 1) { c.fillStyle = '#b8964a'; c.fillRect(X, Y, 32, 32); c.fillStyle = 'rgba(70,45,10,.35)'; for (let k = 0; k < 6; k++) c.fillRect(X, Y + k * 5.4 + 2, 32, 1.2); c.fillStyle = 'rgba(255,230,150,.35)'; for (let k = 0; k < 9; k++) c.fillRect(X + ((k * 7 + y * 5) % 30), Y + ((k * 11 + x * 3) % 28), 2, 4); }
    else if (kind === 2) { const g = c.createLinearGradient(X, Y, X + 32, Y + 32); g.addColorStop(0, '#9aa6b4'); g.addColorStop(1, '#6a7684'); c.fillStyle = g; c.fillRect(X, Y, 32, 32); c.fillStyle = 'rgba(0,0,0,.25)'; for (let k = 0; k < 4; k++) c.fillRect(X + k * 8, Y, 1.2, 32); c.fillStyle = 'rgba(255,255,255,.3)'; for (let k = 0; k < 4; k++) c.fillRect(X + k * 8 + 1.4, Y, 1, 32); }
    else if (kind === 3) { c.fillStyle = 'rgba(150,215,245,.55)'; c.fillRect(X, Y, 32, 32); c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1; c.strokeRect(X + 0.5, Y + 0.5, 31, 31); const sh = ((t * 0.02 + x * 0.6 + y * 0.3) % 3); c.fillStyle = 'rgba(255,255,255,' + (0.25 * Math.max(0, 1 - Math.abs(sh - 1) * 1.4)).toFixed(2) + ')'; c.beginPath(); c.moveTo(X + 4, Y + 30); c.lineTo(X + 14, Y + 2); c.lineTo(X + 20, Y + 2); c.lineTo(X + 10, Y + 30); c.fill(); }
    c.globalAlpha = 1;
  }
  const tcol = tt => { const k = U.clamp((tt + 15) / 55, 0, 1); const r = k < 0.45 ? 60 + k * 100 : 90 + (k - 0.45) * 400, b = k < 0.45 ? 255 - k * 300 : 120 - (k - 0.45) * 220; const gg = k < 0.5 ? 120 + k * 200 : 220 - (k - 0.5) * 340; return 'rgb(' + U.clamp(r | 0, 0, 255) + ',' + U.clamp(gg | 0, 0, 255) + ',' + U.clamp(b | 0, 0, 255) + ')'; };
  Ly.draw = function (c, TS, map, x0, y0, x1, y1, t) {
    const g = G(); const roof = Ly.arr(map); const mode = Ly.mode; const tool = RW.UI && RW.UI.tool; const showRoof = mode === 'roof' || (tool && tool.type === 'roof');
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(map.w - 1, x1); y1 = Math.min(map.h - 1, y1);
    // заплановані дахи (креслення): пунктир + прогрес
    const bps = Ly.bps(map); if (bps.size) { c.save(); c.lineWidth = 1.4; c.setLineDash([5, 4]); c.lineDashOffset = -(t * 0.25) % 9; for (const [i, b] of bps) { const x = i % map.w, y = (i / map.w) | 0; if (x < x0 || x > x1 || y < y0 || y > y1) continue; const R = ROOF[b.kind]; c.fillStyle = R.col; c.globalAlpha = 0.14 + b.prog * 0.3; c.fillRect(x * TS, y * TS, TS, TS); c.globalAlpha = 0.85; c.strokeStyle = b.res ? '#ffd070' : '#7ab8ff'; c.strokeRect(x * TS + 2, y * TS + 2, TS - 4, TS - 4); if (b.prog > 0) { c.setLineDash([]); c.fillStyle = '#ffd070'; c.fillRect(x * TS + 3, y * TS + TS - 6, (TS - 6) * b.prog, 3); c.setLineDash([5, 4]); } } c.restore(); }
    // видимі дахи над відкритими ділянками (навіси)
    const sel = g.sel && g.sel.p; const near = (x, y) => { for (const p of g.pawns) if (p.faction === 'colony' && Math.abs(p.tx - x) < 2 && Math.abs(p.ty - y) < 2) return true; return false; };
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * map.w + x; const r = roof[i]; if (!r) continue;
      if (r === 255) { if (showRoof) { c.strokeStyle = 'rgba(255,90,70,.8)'; c.setLineDash([4, 3]); c.lineWidth = 1.4; c.strokeRect(x * TS + 3, y * TS + 3, TS - 6, TS - 6); c.setLineDash([]); c.fillStyle = 'rgba(255,90,70,.12)'; c.fillRect(x * TS, y * TS, TS, TS); } continue; }
      if (map.room[i] >= 0 && !showRoof) continue;
      if (!showRoof) continue; roofTile(c, x, y, r, 0.6, t);
    }
    if (!mode || mode === 'roof') { if (mode === 'roof') { c.fillStyle = 'rgba(80,140,255,.12)'; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * map.w + x; if (!roof[i] && map.isRoofed(i) && !map.mroof[i]) c.fillRect(x * TS, y * TS, TS, TS); else if (!roof[i] && map.mroof[i] && !map.blk[i]) { c.fillStyle = 'rgba(150,120,90,.18)'; c.fillRect(x * TS, y * TS, TS, TS); c.fillStyle = 'rgba(80,140,255,.12)'; } } } return; }
    if (mode === 'power') {
      c.fillStyle = 'rgba(8,12,24,.45)'; c.fillRect(x0 * TS, y0 * TS, (x1 - x0 + 1) * TS, (y1 - y0 + 1) * TS);
      for (const net of map.networks) {
        const ok = net.sat >= 0.99 || net.prod >= net.cons; const col = ok ? '60,255,150' : '255,90,60';
        for (const b of net.members) {
          const cx = (b.x + b.w / 2) * TS, cy = (b.y + b.h / 2) * TS; if (b.x < x0 - 1 || b.x > x1 + 1 || b.y < y0 - 1 || b.y > y1 + 1) continue;
          if (b.def.conduit) { c.fillStyle = 'rgba(' + col + ',.55)'; c.fillRect(cx - 4, cy - 4, 8, 8); const ph = (t * 0.06 + b.x * 0.7 + b.y * 0.7) % 1; const gr = c.createRadialGradient(cx, cy, 0, cx, cy, 14); gr.addColorStop(0, 'rgba(' + col + ',' + (0.5 * (0.5 + 0.5 * Math.sin(ph * TAU))).toFixed(2) + ')'); gr.addColorStop(1, 'rgba(' + col + ',0)'); c.fillStyle = gr; c.fillRect(cx - 14, cy - 14, 28, 28); }
          else { const prod = b.def.power > 0; c.strokeStyle = prod ? 'rgba(255,230,90,.95)' : b.def.battery ? 'rgba(120,200,255,.95)' : 'rgba(' + col + ',.9)'; c.lineWidth = 2; c.strokeRect(b.x * TS + 1, b.y * TS + 1, b.w * TS - 2, b.h * TS - 2); c.font = '12px "Segoe UI Emoji",sans-serif'; c.textAlign = 'center'; c.fillStyle = '#fff'; c.fillText(prod ? '⚡' : b.def.battery ? '🔋' : (b.on === false ? '⛔' : '🔌'), cx, b.y * TS - 3); }
        }
      }
    } else if (mode === 'temp') {
      c.globalAlpha = 0.42; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * map.w + x; if (map.blk[i] > 0 && !map.mroof[i]) continue; c.fillStyle = tcol(map.tempAt(i, g.outTemp)); c.fillRect(x * TS, y * TS, TS, TS); } c.globalAlpha = 1;
      c.font = 'bold 11px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#fff'; c.strokeStyle = 'rgba(0,0,0,.7)'; c.lineWidth = 3;
      (map.rooms || []).forEach((r, k) => { if (!r.cx && r.cx !== 0) { return; } });
      for (const r of map.rooms || []) { if (!r.cells || !r.cells.length) continue; const cell = r.cells[(r.cells.length / 2) | 0]; const cx = (cell % map.w) * TS + 16, cy = ((cell / map.w) | 0) * TS + 18; if (cx < x0 * TS || cx > x1 * TS || cy < y0 * TS || cy > y1 * TS) continue; const tx = Math.round(r.temp) + '°'; c.strokeText(tx, cx, cy); c.fillText(tx, cx, cy); }
    } else if (mode === 'beauty') {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * map.w + x; if (map.blk[i] > 0) continue; const b = map.cellBeauty(i); if (Math.abs(b) < 0.05) continue; c.fillStyle = b > 0 ? 'rgba(120,230,140,' + Math.min(0.55, b * 0.22).toFixed(2) + ')' : 'rgba(230,90,80,' + Math.min(0.55, -b * 0.3).toFixed(2) + ')'; c.fillRect(x * TS, y * TS, TS, TS); }
    }
  };
  // ---- панель шарів ----
  Ly.bar = function () {
    let el = document.getElementById('layerbar'); if (el) return; el = document.createElement('div'); el.id = 'layerbar';
    const M = [[null, '🗺', 'Звичайний вигляд'], ['roof', '🏠', 'Дахи'], ['power', '⚡', 'Енергомережа'], ['temp', '🌡', 'Температура'], ['beauty', '✨', 'Краса']];
    el.innerHTML = M.map(m => '<button data-m="' + (m[0] || '') + '" title="' + m[2] + '">' + m[1] + '</button>').join('');
    el.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; Ly.mode = b.dataset.m || null; Ly.sync(); });
    document.body.appendChild(el); Ly.sync();
  };
  Ly.sync = function () { const el = document.getElementById('layerbar'); if (!el) return; el.querySelectorAll('button').forEach(b => b.classList.toggle('on', (b.dataset.m || null) === (Ly.mode || null))); };
  Ly.install = function () {
    const UI = RW.UI; Ly.bar();
    UI.actions.pickRoof = el => { UI.tool = { type: 'roof', kind: el.dataset.kind }; Ly.mode = 'roof'; Ly.sync(); };
    window.addEventListener('keydown', e => { if (e.code === 'KeyL' && !e.ctrlKey && !/INPUT|TEXTAREA/.test((e.target || {}).tagName || '')) { const o = [null, 'roof', 'power', 'temp', 'beauty']; Ly.mode = o[(o.indexOf(Ly.mode) + 1) % o.length]; Ly.sync(); } });
  };
  Ly.cards = function (tt) {
    let h = ''; for (const k in ROOF) { const R = ROOF[k]; h += '<div class="acard ' + (tt && tt.type === 'roof' && tt.kind === k ? 'on' : '') + '" data-act="pickRoof" data-kind="' + k + '" title="' + R.name + ': ' + R.desc + '"><div class="ai">' + R.ico + '</div><div class="an">' + R.name + '</div><div class="ac">' + Object.keys(R.cost).map(c => R.cost[c] + ' ' + D.items[c].name).join(', ') + '</div></div>'; }
    h += '<div class="acard ' + (tt && tt.type === 'roof' && tt.kind === 'remove' ? 'on' : '') + '" data-act="pickRoof" data-kind="remove" title="Зняти дах (відкрити приміщення небу — для теплиць)"><div class="ai">🔨</div><div class="an">Зняти дах</div></div>';
    h += '<div class="acard ' + (tt && tt.type === 'roof' && tt.kind === 'restore' ? 'on' : '') + '" data-act="pickRoof" data-kind="restore" title="Повернути природний дах приміщення"><div class="ai">↩</div><div class="an">Повернути дах</div></div>';
    return h;
  };

  // ---- будівництво даху колоністами ----
  const AI = RW.AI; const WORK = { 1: 70, 2: 120, 3: 160 };
  const costOK = (kind, stock) => { for (const c in ROOF[kind].cost) if ((stock[c] || 0) < ROOF[kind].cost[c]) return false; return true; };
  const takeMats = (map, kind) => { for (const c in ROOF[kind].cost) { const st = map.byDef.get(c); let left = ROOF[kind].cost[c]; if (!st) continue; for (const it of Array.from(st)) { if (left <= 0) break; if (it.forbid || it.res) continue; const q = Math.min(left, it.n); map.takeItem(it, q); left -= q; } } };
  function roofJob(p) {
    const g = G(), map = g.map; const bps = Ly.bps(map); if (!bps.size) return null; const stock = RW.Events.colonyStock(); let best = null, bd = 1e9, lack = false;
    for (const [i, b] of bps) { if (b.res && b.res !== p.id) continue; if (!costOK(b.kind, stock)) { lack = true; continue; } const x = i % map.w, y = (i / map.w) | 0; const d = Math.abs(x - p.tx) + Math.abs(y - p.ty); if (d >= bd) continue; if (!map.reachable(p.tx, p.ty, x, y, true)) continue; bd = d; best = i; }
    if (best == null) { if (lack && g.tick - (Ly.lackT || -9999) > 3000) { Ly.lackT = g.tick; RW.UI && RW.UI.toast('Не вистачає матеріалів для даху', 'bad'); } return null; }
    const bp = bps.get(best); AI.reserve(p, bp); return { type: 'roofbuild', i: best, stage: 0, t: 0 };
  }
  const gc = AI.GIVERS.construct; AI.GIVERS.construct = function (p) { return gc(p) || roofJob(p); };
  AI.RUN.roofbuild = function (p, j) {
    const g = G(), map = g.map; const bps = Ly.bps(map); const bp = bps.get(j.i); if (!bp) return 'done'; const x = j.i % map.w, y = (j.i / map.w) | 0;
    if (j.stage === 0) { const r = AI.moveTo(p, x, y); if (r === 'fail') { bp.res = null; return 'fail'; } if (r === 'arrived') { j.stage = 1; p.moving = false; } return; }
    p.moving = false; j.t += p.workSpeed('construction'); p.gainXp('construction', 0.05); const need = WORK[bp.kind] || 100; bp.prog = Math.min(1, j.t / need);
    if ((g.tick & 15) === 0 && RW.R) RW.R.fx.spark(x + 0.5, y + 0.3); if ((g.tick & 31) === 0 && RW.A) RW.A.sfx('hammer');
    if (j.t >= need) {
      if (!costOK(bp.kind, RW.Events.colonyStock())) { bp.res = null; bp.prog = 0; return 'fail'; }
      const roof = Ly.arr(map); const old = roof[j.i]; if (old > 0 && old !== 255) { const O = ROOF[old]; for (const c in O.cost) map.addItem(c, Math.floor(O.cost[c] / 2), x, y); }
      takeMats(map, bp.kind); roof[j.i] = bp.kind; bps.delete(j.i); g.stats.built++;
      map.allDirty = true; if (map.roomsDirty !== undefined) map.roomsDirty = true; RW.R && RW.R.invalidateAll && RW.R.invalidateAll();
      if (RW.FX2) { RW.FX2.burst('sparkle', x + 0.5, y + 0.5, 6, { c: ROOF[bp.kind].col }); } if (RW.R) RW.R.fx.dust(x + 0.5, y + 0.5, 4);
      return 'done';
    }
  };
  const jl = AI.jobLabel; AI.jobLabel = function (p) { if (p.job && p.job.type === 'roofbuild') return 'Будує дах'; return jl(p); };
})();
