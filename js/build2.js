'use strict';
// ============================================================
//  build2.js — будівництво й оборона (v0.9.1)
//   6) Призначення кімнат: їдальня, спальня, лазарет, кухня, майстерня, відпочинок, лабораторія, казарма
//      + якість кімнати (убога…розкішна) впливає на настрій і швидкість роботи; шар «Кімнати» (L)
//   8) Підвал (холодне сховище без псування) і Шахта (вилазки вниз: руда, небезпеки)
//   9) Рів (копається як будівля, стає глибокою водою) і Підйомний міст (піднімається/опускається)
//  10) Дзвін тривоги і Сигнальний ліхтар: збір озброєних, укриття для інших, автопідйом мостів
//  Усі числа — в об'єкті B2.
// ============================================================
(function () {
  const D = RW.D, U = RW.U, DY = D.DAY, HR = D.HOUR; const G = () => RW.G; const AI = RW.AI, C = RW.Combat;
  const B2 = RW.Build2 = {
    ROOM_SCAN: 150, TIER: [-3, 0, 3, 6], TIER_N: ['Убога', 'Звичайна', 'Гарна', 'Розкішна'], WORK_LUX: 0.06, WORK_NICE: 0.03,
    CELLAR_CAP: 600, CELLAR_KEEP: 4, DELVE_TICKS: 1100, DELVE_COOL: 2600, SHAFT_RISK: 0.22, BRIDGE_MIN: 1,
    MUSTER_R: 3
  };
  const T = (id, l, v, days) => { D.thoughts[id] = { l, v, dur: days * DY }; };
  const fx2 = (t, x, y, o) => RW.FX2 && RW.FX2.emit(t, x, y, o), burst = (t, x, y, n, o) => RW.FX2 && RW.FX2.burst(t, x, y, n, o);
  const cols = g => g.pawns.filter(p => p.faction === 'colony' && !p.dead);
  const ex = g => { const e = (g.ext = g.ext || {}); return (e.b2 = e.b2 || { moat: [], mode: 'auto', alarm: 0, cellarT: 0 }); };

  // ---------- визначення будівель ----------
  const def = (id, o) => { o.id = id; o.w = o.w || 1; o.h = o.h || 1; o.cost = o.cost || {}; o.work = o.work == null ? 100 : o.work; o.hp = o.hp || 100; if (o.pass == null) o.pass = 1; o.flam = o.flam || 0; o.beauty = o.beauty || 0; D.bld[id] = o; return o; };
  def('moat', { cat: 'security', name: 'Рів', desc: 'Копається як будівля й стає глибокою водою: ніхто не перейде, окрім як мостом. Тягніть мишею, щоб копати лінію. Ворогам доведеться шукати обхід або ламати міст.', cost: {}, work: 110, hp: 1, area: true, color: '#2f6fa8', moat: true, beauty: 0 });
  def('drawbridge', { cat: 'security', name: 'Підйомний міст', desc: 'Кладеться лише на клітини рову. Опущений — проходить будь-хто; піднятий — непрохідна стіна, яку треба ламати. Керування — панель «Оборона» (автоматично підіймається при тривозі).', cost: { wood: 30, steel: 8 }, work: 170, hp: 220, area: true, bridge: true, color: '#8a6a3a', flam: 0.3, beauty: 1 });
  def('cellar', { cat: 'production', name: 'Підвал', desc: 'Люк у прохолодний підвал: колоністи самі зносять надлишок їжі, і вона не псується. Коли на поверхні їжі мало — дістають із підвалу. Місткість 600.', cost: { wood: 40, steel: 20 }, work: 420, hp: 120, cellar: true, color: '#6b5a40', beauty: -1 });
  def('shaft', { cat: 'production', name: 'Шахта', desc: 'Колоністи з Видобутком спускаються вниз: сталь, срібло, золото, компоненти. Є ризик обвалу й підземних тварин. З кожною вилазкою шахта «заглиблюється» й дає більше.', w: 2, h: 2, cost: { steel: 80, wood: 60 }, work: 700, hp: 200, pass: 0, shaft: true, color: '#4a4f58', beauty: -2 });
  def('alarm_bell', { cat: 'security', name: 'Дзвін тривоги', desc: 'При нальоті дзвонить: озброєні колоністи збираються біля дзвона, решта ховається, мости піднімаються.', cost: { steel: 15, wood: 10 }, work: 130, hp: 60, bell: true, pass: 2, color: '#d9b04a', beauty: 0 });
  def('alarm_lantern', { cat: 'security', name: 'Сигнальний ліхтар', desc: 'Червоне миготіння при тривозі, піднімає мости. Дешевий сигнал без збору озброєних.', cost: { steel: 6 }, work: 70, hp: 40, lantern: true, pass: 2, color: '#c94a3a', beauty: 0 });

  // ---------- сумісність: рів — область, міст — лише на рів ----------
  (function () {
    const GM = RW.GameMap.prototype; const cp = GM.canPlace;
    GM.canPlace = function (defKey, x, y, rot, opts) {
      const d = D.bld[defKey];
      if (d && d.bridge) {
        const i = y * this.w + x; if (!this.inb(x, y)) return 'Поза картою'; if (!isMoat(this, i)) return 'Міст кладеться лише на рів';
        if (this.bld[i]) return 'Зайнято будівлею'; if (this.bp[i]) return 'Вже є креслення'; return null;
      }
      return cp.apply(this, arguments);
    };
    const uc = GM.updateCost;
    GM.updateCost = function (i) {
      uc.call(this, i); const b = this.bld[i];
      if (b && b.def.bridge) this.cost[i] = (b.buf && b.buf.up) ? 0 : 1.15;
    };
    const ob = RW.UI && RW.UI; // ui.js: isAreaDef враховує d.area — див. патч у ui.js
  })();
  function isMoat(map, i) { const e = ex(G()); return e.moatSet && e.moatSet.has(i); }
  function rebuildMoatSet(g) { const e = ex(g); e.moatSet = new Set(e.moat); }

  // ---------- спрайти ----------
  const spr = {};
  const cv = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return c; };
  const SPR = {
    moat: () => cv(32, 32, c => { c.fillStyle = '#2f6fa8'; c.fillRect(0, 0, 32, 32); }),
    drawbridge: () => cv(32, 32, c => { c.fillStyle = '#7a5a2e'; c.fillRect(0, 0, 32, 32); c.fillStyle = '#9a7a45'; for (let k = 0; k < 4; k++) c.fillRect(1, 1 + k * 8, 30, 6.4); c.strokeStyle = '#4a361a'; c.lineWidth = 1.2; for (let k = 0; k < 4; k++) c.strokeRect(1.5, 1.5 + k * 8, 29, 5.6); c.fillStyle = '#3a3026'; c.fillRect(0, 0, 3, 32); c.fillRect(29, 0, 3, 32); }),
    cellar: () => cv(32, 32, c => { c.fillStyle = '#4a3f2e'; c.fillRect(1, 1, 30, 30); c.fillStyle = '#6b5a40'; c.fillRect(3, 3, 26, 26); c.strokeStyle = '#2d261b'; c.lineWidth = 1.5; c.strokeRect(3.5, 3.5, 25, 25); c.beginPath(); c.moveTo(16, 3); c.lineTo(16, 29); c.stroke(); c.fillStyle = '#b8a070'; c.fillRect(13, 14, 2, 4); c.fillRect(17, 14, 2, 4); }),
    shaft: () => cv(64, 64, c => { c.fillStyle = '#2b2f36'; c.fillRect(2, 2, 60, 60); c.fillStyle = '#12151a'; c.beginPath(); c.ellipse(32, 34, 21, 19, 0, 0, 6.3); c.fill(); c.strokeStyle = '#6a5030'; c.lineWidth = 4; c.strokeRect(6, 8, 52, 50); c.fillStyle = '#7a5e3a'; c.fillRect(2, 2, 6, 8); c.fillRect(56, 2, 6, 8); c.fillRect(2, 54, 6, 8); c.fillRect(56, 54, 6, 8); c.strokeStyle = '#8a8a90'; c.lineWidth = 2; c.beginPath(); c.moveTo(14, 4); c.lineTo(50, 4); c.stroke(); }),
    alarm_bell: () => cv(32, 32, c => { c.fillStyle = '#5a4a34'; c.fillRect(6, 24, 20, 5); c.fillRect(8, 6, 3, 20); c.fillRect(21, 6, 3, 20); c.fillRect(6, 5, 20, 3); }),
    alarm_lantern: () => cv(32, 32, c => { c.fillStyle = '#4a4440'; c.fillRect(14, 12, 4, 17); c.fillStyle = '#2d2b2b'; c.fillRect(9, 4, 14, 3); c.fillStyle = '#a73a2e'; c.fillRect(10, 7, 12, 10); c.fillStyle = '#e8a090'; c.fillRect(12, 9, 3, 6); c.fillStyle = '#2d2b2b'; c.fillRect(9, 17, 14, 3); })
  };
  const bs = RW.GFX.bldSprite;
  RW.GFX.bldSprite = function (k) { if (SPR[k]) return spr[k] || (spr[k] = SPR[k]()); return bs.apply(this, arguments); };

  // ---------- малювання на будівлях (render.js викликає d.drawX) ----------
  function flameS(c, x, y, s, t) { const f = 1 + Math.sin(t * 0.3) * 0.2; c.fillStyle = 'rgba(255,200,100,.95)'; c.beginPath(); c.ellipse(x, y, 2 * s, 4 * s * f, 0, 0, 6.3); c.fill(); }
  D.bld.drawbridge.drawX = function (c, b, px, py, t, g) {
    const up = b.buf && b.buf.up; b.ang = (b.ang == null ? (up ? 1 : 0) : b.ang); b.ang += ((up ? 1 : 0) - b.ang) * 0.07;
    if (b.ang > 0.02) { // піднятий: темна щілина + дошки під кутом
      const a = b.ang; c.fillStyle = 'rgba(10,30,60,' + (0.85 * a).toFixed(2) + ')'; c.fillRect(px, py, 32, 32);
      c.save(); c.translate(px + 16, py + 3); c.fillStyle = '#8a6a3a'; c.strokeStyle = '#3a2a14'; c.lineWidth = 1.2; c.fillRect(-14, 0, 28, 26 * (1 - a * 0.78)); c.strokeRect(-14, 0, 28, 26 * (1 - a * 0.78)); c.fillStyle = '#c9c9d0'; c.fillRect(-15, -3, 3, 8); c.fillRect(12, -3, 3, 8); c.restore();
      c.strokeStyle = 'rgba(210,210,220,' + (0.6 * a).toFixed(2) + ')'; c.lineWidth = 1; c.beginPath(); c.moveTo(px + 1.5, py + 4); c.lineTo(px + 8, py + 28); c.moveTo(px + 30.5, py + 4); c.lineTo(px + 24, py + 28); c.stroke(); // ланцюги
    }
  };
  D.bld.cellar.drawX = function (c, b, px, py, t, g) {
    const st = b.buf || {}; let n = 0; for (const k in st) if (k !== 'up' && k !== 'depth') n += st[k]; b.open = (b.open || 0) * 0.92; const o = b.open;
    if (o > 0.05) { c.fillStyle = 'rgba(0,0,0,' + (0.55 * Math.min(1, o)).toFixed(2) + ')'; c.fillRect(px + 4, py + 4, 24, 24); c.fillStyle = '#6b5a40'; c.save(); c.translate(px + 4, py + 4); c.rotate(-0.9 * Math.min(1, o)); c.fillRect(0, 0, 12, 24); c.restore(); }
    const fr = Math.min(1, n / B2.CELLAR_CAP); c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(px + 4, py + 27, 24, 3); c.fillStyle = fr > 0.85 ? '#e8a23a' : '#7ad0f0'; c.fillRect(px + 4, py + 27, 24 * fr, 3);
    if (n > 0 && (t % 50) === 0) fx2('sparkle', px / 32 + 0.5, py / 32 + 0.3, { c: '#a8e4ff' });
  };
  D.bld.shaft.drawX = function (c, b, px, py, t, g) {
    const act = b.delver; b.spin = (b.spin || 0) + (act ? 0.15 : 0.01);
    c.save(); c.translate(px + 32, py + 8); c.strokeStyle = '#d0d0d6'; c.lineWidth = 1.4; c.beginPath(); c.arc(0, 0, 5, 0, 6.3); c.stroke(); for (let k = 0; k < 4; k++) { const a = b.spin + k * 1.57; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * 5, Math.sin(a) * 5); c.stroke(); } c.restore();
    if (act) { const y = 26 + Math.sin(t * 0.1) * 8; c.strokeStyle = '#8a8a90'; c.lineWidth = 1; c.beginPath(); c.moveTo(px + 32, py + 13); c.lineTo(px + 32, py + y + 4); c.stroke(); c.fillStyle = '#7a5e3a'; c.fillRect(px + 27, py + y + 4, 10, 7); if (t % 18 === 0) fx2('sparkle', px / 32 + 1, py / 32 + 1, { c: '#ffd37a' }); }
    const dp = (b.buf && b.buf.depth) || 0; c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(px + 4, py + 56, 56, 4); c.fillStyle = '#e8c23a'; c.fillRect(px + 4, py + 56, 56 * Math.min(1, dp / 6), 4);
  };
  D.bld.alarm_bell.drawX = function (c, b, px, py, t, g) {
    b.sw = b.sw || 0; b.swv = (b.swv || 0) * 0.985; const ring = B2.ringing(g); if (ring) b.swv = Math.max(b.swv, 0.5); b.sw += 0.35; const ang = Math.sin(b.sw) * b.swv;
    c.save(); c.translate(px + 16, py + 8); c.rotate(ang); c.fillStyle = '#e0b64a'; c.strokeStyle = '#7a5a1a'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-6, 14); c.quadraticCurveTo(-6, 2, 0, 0); c.quadraticCurveTo(6, 2, 6, 14); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#5a3a14'; c.beginPath(); c.arc(0, 15, 2, 0, 6.3); c.fill(); c.restore();
    if (ring && (t % 24) === 0) b.waves = (b.waves || []).concat([{ t: 0 }]);
    if (b.waves) for (let k = b.waves.length - 1; k >= 0; k--) { const w = b.waves[k]; w.t++; if (w.t > 50) { b.waves.splice(k, 1); continue; } c.strokeStyle = 'rgba(255,225,130,' + (1 - w.t / 50).toFixed(2) + ')'; c.lineWidth = 2; c.beginPath(); c.arc(px + 16, py + 14, 8 + w.t * 1.4, 0, 6.3); c.stroke(); }
  };
  D.bld.alarm_lantern.drawX = function (c, b, px, py, t, g) {
    const ring = B2.ringing(g); const a = ring ? 0.35 + 0.35 * Math.sin(t * 0.35) : 0.08;
    const gr = c.createRadialGradient(px + 16, py + 12, 2, px + 16, py + 12, ring ? 46 : 14); gr.addColorStop(0, 'rgba(255,70,50,' + a.toFixed(2) + ')'); gr.addColorStop(1, 'rgba(255,70,50,0)'); c.fillStyle = gr; c.beginPath(); c.arc(px + 16, py + 12, ring ? 46 : 14, 0, 6.3); c.fill();
    if (ring) { c.save(); c.translate(px + 16, py + 12); c.rotate(t * 0.18); c.fillStyle = 'rgba(255,120,90,.18)'; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 60, -0.35, 0.35); c.closePath(); c.fill(); c.restore(); }
  };

  // ======================================================================
  //  6. ПРИЗНАЧЕННЯ КІМНАТ
  // ======================================================================
  const PUR = {
    bedroom: { n: 'Спальня', i: '🛏', th: 'Моя спальня' }, barracks: { n: 'Казарма', i: '🛏🛏', th: 'Казарма' }, dining: { n: 'Їдальня', i: '🍽', th: 'Їдальня' },
    hospital: { n: 'Лазарет', i: '🏥', th: 'Лазарет' }, kitchen: { n: 'Кухня', i: '🍲', th: 'Кухня' }, workshop: { n: 'Майстерня', i: '🔨', th: 'Майстерня' },
    rec: { n: 'Кімната відпочинку', i: '🎲', th: 'Кімната відпочинку' }, lab: { n: 'Лабораторія', i: '🔬', th: 'Лабораторія' }, plain: { n: 'Кімната', i: '▫', th: '' }
  };
  B2.PUR = PUR; const COL = { bedroom: '#7a9cff', barracks: '#7a7aff', dining: '#ffb347', hospital: '#ff6a7a', kitchen: '#ff8a47', workshop: '#c9a24a', rec: '#7ae07a', lab: '#4adce8', plain: '#888' };
  function classify(map, r) {
    const seen = new Set(); let beds = 0, hosp = 0, tab = 0, ch = 0, stove = 0, prod = 0, joy = 0, lab = 0, furn = 0, beauty = 0;
    for (const c of r.cells) {
      const b = map.bld[c]; if (!b || seen.has(b)) continue; seen.add(b); const d = b.def; beauty += d.beauty || 0;
      if (d.id === 'hospital_bed') hosp++; else if (d.bed && d.id !== 'sleeping_spot') beds++;
      else if (d.id === 'table') tab++; else if (d.id === 'chair') ch++; else if (d.id === 'stove') stove++;
      else if (d.id === 'research_bench') lab++; else if (d.cat === 'joy') joy++; else if (d.cat === 'production' && !d.cellar && !d.shaft && !(d.id.startsWith('floor'))) prod++;
      if (d.cat === 'furniture' || d.cat === 'joy') furn++;
    }
    let p = 'plain';
    if (hosp >= 1) p = 'hospital'; else if (lab >= 1 && lab >= prod - 1) p = 'lab'; else if (beds >= 3) p = 'barracks'; else if (beds >= 1) p = 'bedroom';
    else if (stove >= 1) p = 'kitchen'; else if (tab >= 1 && ch >= 2) p = 'dining'; else if (joy >= 2) p = 'rec'; else if (prod >= 2) p = 'workshop';
    const sc = (r.beautyAvg || 0) * 3.2 + Math.min(r.size, 40) / 9 + furn * 0.45 - (r.size < 6 ? 1.5 : 0);
    let tier = sc < 1.5 ? 0 : sc < 4.5 ? 1 : sc < 9.5 ? 2 : 3;
    if (p === 'hospital' && !r.doors) tier = Math.max(0, tier - 1);
    return { p, tier, sc: +sc.toFixed(1), n: { beds, hosp, tab, ch, stove, prod, joy, lab } };
  }
  function roomScan(g) {
    const map = g.map; if (!map.rooms) return; if (map.roomsDirty) return; const key = map.rooms.length + ':' + g.tick;
    for (const r of map.rooms) { if (!r.cells || !r.cells.length) continue; const k = classify(map, r); r.pur = k.p; r.tier = k.tier; r.score = k.sc; r.cnt = k.n; }
  }
  const wsF = RW.Pawn.prototype.workSpeed;
  RW.Pawn.prototype.workSpeed = function () {
    let r = wsF.apply(this, arguments); const g = G(); if (!g || !g.map || !g.map.room) return r;
    const i = Math.floor(this.y) * g.map.w + Math.floor(this.x); const rm = g.map.room[i] >= 0 && g.map.rooms[g.map.room[i]];
    if (rm && rm.pur && (rm.pur === 'workshop' || rm.pur === 'lab' || rm.pur === 'kitchen')) { if (rm.tier >= 3) r *= 1 + B2.WORK_LUX; else if (rm.tier === 2) r *= 1 + B2.WORK_NICE; else if (rm.tier === 0) r *= 0.97; }
    return r;
  };
  function roomMood(g) { // раз на ~60 тіків: думка про кімнату, у якій стоїть колоніст
    const map = g.map; if (!map.room) return;
    for (const p of cols(g)) {
      if (p.downed || p.mental || p.faction !== 'colony') continue; const i = Math.floor(p.y) * map.w + Math.floor(p.x); const rm = map.room[i] >= 0 && map.rooms[map.room[i]]; if (!rm || !rm.pur || rm.pur === 'plain') continue;
      if (rm.pur === 'bedroom' && !p.sleeping) continue; const pu = PUR[rm.pur], v = B2.TIER[rm.tier]; if (v === 0) continue;
      const id = 'room', old = p.thoughts.find(t => t.id === id); const lab = B2.TIER_N[rm.tier] + ' ' + pu.n.toLowerCase();
      if (old) { old.l = lab; old.v = v; old.left = 0.25 * DY; } else p.thoughts.push({ id, l: lab, v, left: 0.25 * DY });
    }
  }
  // шар «Кімнати» для оверлея
  function drawRooms(c, TS, map, x0, y0, x1, y1, t) {
    if (!RW.Layers || RW.Layers.mode !== 'rooms') return; const g = G();
    for (const r of map.rooms || []) {
      if (!r.cells || !r.cells.length || !r.pur) continue; const col = COL[r.pur] || '#888'; c.fillStyle = col; c.globalAlpha = 0.22 + (r.tier || 0) * 0.04;
      let sx = 0, sy = 0, n = 0, vis = false; for (const i of r.cells) { const x = i % map.w, y = (i / map.w) | 0; if (x < x0 || x > x1 || y < y0 || y > y1) continue; vis = true; c.fillRect(x * TS, y * TS, TS, TS); sx += x; sy += y; n++; }
      c.globalAlpha = 1; if (!vis || r.pur === 'plain' && r.size < 4) continue;
      const cx = sx / n * TS + TS / 2, cy = sy / n * TS + TS / 2, pu = PUR[r.pur], txt = pu.i + ' ' + pu.n, sub = B2.TIER_N[r.tier] + ' · ' + (B2.TIER[r.tier] > 0 ? '+' : '') + B2.TIER[r.tier];
      c.textAlign = 'center'; c.font = 'bold 12px sans-serif'; c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.75)'; c.fillStyle = '#fff'; c.strokeText(txt, cx, cy - 4); c.fillText(txt, cx, cy - 4);
      c.font = '10.5px sans-serif'; c.fillStyle = r.tier >= 2 ? '#a8ff9a' : r.tier === 0 ? '#ff9a8a' : '#ddd'; c.strokeText(sub, cx, cy + 9); c.fillText(sub, cx, cy + 9);
    }
  }
  RW.R.worldOver.push(drawRooms);

  // ======================================================================
  //  8. ПІДВАЛ І ШАХТА
  // ======================================================================
  const FOODCAT = it => { const d = D.items[it.def]; return d && (d.cat === 'rawfood' || d.cat === 'meal' || d.cat === 'food') && d.rot; };
  const cellars = g => g.map.buildings.filter(b => b.def.cellar && b.hp > 0 && !b.decon);
  const stored = b => { let n = 0; for (const k in b.buf) if (k !== 'up' && k !== 'depth') n += b.buf[k]; return n; };
  function groundFood(g) { let n = 0; for (const a of g.map.items.values()) for (const it of a) if (!it.forbid && FOODCAT(it)) n += it.n; return n; }
  AI.RUN.cellar = function (p, j) {
    const g = G(), map = g.map; const b = j.b; if (!b || b.hp <= 0 || !map.buildings.includes(b)) return 'fail';
    if (j.stage === 0) {
      const it = j.item; if (!it || it.dead || it.n <= 0) return 'fail'; const r = AI.moveTo(p, it.i % map.w, (it.i / map.w) | 0); if (r === 'fail') return 'fail';
      if (r === 'arrived') { const cap = Math.min(it.n, 40, B2.CELLAR_CAP - stored(b)); if (cap <= 0) return 'fail'; const got = map.takeItem(it, cap); p.carry = { def: it.def, n: got }; j.stage = 1; AI.resetMove(p); } return;
    }
    const r = AI.moveTo(p, b.x, b.y, { adj: true }); if (r === 'fail') { AI.release && 0; return 'fail'; }
    if (r === 'arrived' || Math.hypot(p.x - b.x - 0.5, p.y - b.y - 0.5) < 1.6) {
      b.open = 1.2; if (p.carry) { b.buf[p.carry.def] = (b.buf[p.carry.def] || 0) + p.carry.n; if (g.stats) g.stats.cellared = (g.stats.cellared || 0) + p.carry.n; fx2('sparkle', b.x + 0.5, b.y + 0.3, { c: '#a8e4ff' }); RW.R.fx.text(b.x + 0.5, b.y - 0.4, '+' + p.carry.n, '#9fe0ff'); p.carry = null; }
      return 'done';
    }
  };
  function cellarTick(g) { // раз на 120 тіків
    const cs = cellars(g); if (!cs.length) return; const n = cols(g).length, have = groundFood(g);
    // дістати, коли на поверхні мало їжі
    if (have < n * B2.CELLAR_KEEP) {
      for (const b of cs) {
        const k = Object.keys(b.buf).filter(k => k !== 'up' && k !== 'depth' && b.buf[k] > 0).sort((a, c) => (D.items[c].nutr || 0) - (D.items[a].nutr || 0))[0]; if (!k) continue;
        const take = Math.min(b.buf[k], 10); b.buf[k] -= take; if (b.buf[k] <= 0) delete b.buf[k]; const tx = Math.max(0, b.x - 1), ty = b.y; b.open = 1.2; try { g.map.addItem(k, take, tx, ty); } catch (e) { g.map.addItem(k, take, b.x, b.y + 1); }
        RW.R.fx.text(b.x + 0.5, b.y - 0.4, '↑' + take, '#ffe0a0'); break;
      }
    }
    // зносити надлишок
    if (have > n * (B2.CELLAR_KEEP + 3)) {
      for (const p of cols(g)) {
        if (p.drafted || p.downed || p.mental || p.sleeping || p.carry) continue; if (p.job && !['wander', 'chat', 'joy', 'stargaze'].includes(p.job.type)) continue;
        const b = cs.find(c => stored(c) < B2.CELLAR_CAP - 10); if (!b) return;
        let best = null, bd = 1e9; for (const a of g.map.items.values()) for (const it of a) { if (it.forbid || it.res || !FOODCAT(it)) continue; const d = Math.hypot((it.i % g.map.w) - p.x, ((it.i / g.map.w) | 0) - p.y); if (d < bd) { bd = d; best = it; } }
        if (best && bd < 40) { AI.reserve(p, best); AI.endJob(p); AI.setJob(p, { type: 'cellar', b, item: best, stage: 0 }); return; }
      }
    }
  }
  // Шахта
  const SHAFT_LOOT = [['steel', 14, 34, 0], ['silver', 25, 70, 0], ['gold', 3, 8, 1], ['components', 1, 3, 2], ['stone_block', 20, 50, 0]];
  AI.RUN.delve = function (p, j) {
    const g = G(), map = g.map; const b = j.b; if (!b || b.hp <= 0 || !map.buildings.includes(b)) { p.hidden = false; return 'fail'; }
    if (!j.stage) {
      const r = AI.moveTo(p, b.x, b.y, { adj: true }); if (r === 'fail') return 'fail';
      if (r === 'arrived' || Math.hypot(p.x - b.x - 1, p.y - b.y - 1) < 2.2) { j.stage = 1; j.t0 = g.tick; j.sx = p.x; j.sy = p.y; p.hidden = true; p.moving = false; b.delver = p; AI.resetMove(p); b.buf.lastT = g.tick; fx2('sparkle', b.x + 1, b.y + 0.8, { c: '#ffd37a' }); RW.R.fx.text(b.x + 1, b.y - 0.3, '⬇', '#ffd37a'); RW.A && RW.A.sfx('build'); }
      return;
    }
    p.moving = false; p.x = b.x + 1; p.y = b.y + 1;
    if (g.tick - j.t0 < B2.DELVE_TICKS) { if ((g.tick - j.t0) % 220 === 0 && Math.random() < 0.7) fx2('smoke', b.x + 1, b.y + 0.9, { c: '#777' }); return; }
    // повернення
    p.hidden = false; b.delver = null; p.x = j.sx; p.y = j.sy; b.buf.delves = (b.buf.delves || 0) + 1;
    resolveDelve(g, p, b); return 'done';
  };
  function resolveDelve(g, p, b) {
    const sk = p.skillLvl ? p.skillLvl('mining') : 5, depth = b.buf.depth || 0, map = g.map; const nm = U.shortName(p);
    p.gainXp && p.gainXp('mining', 60);
    const risk = Math.max(0.05, B2.SHAFT_RISK - sk * 0.012 + depth * 0.012); const r = Math.random();
    let loot = []; const mul = 1 + depth * 0.18 + sk * 0.04;
    if (r < risk * 0.45) { // обвал
      try { p.hurt ? p.hurt(U.ri(6, 14), 'blunt') : p.takeDamage && p.takeDamage(U.ri(6, 14), 'blunt'); } catch (e) { }
      p.addThought('cave_scare'); RW.UI.letter('Обвал у шахті', nm + ' ледь вибрався(лась) з-під завалу, але встиг(ла) захопити трохи породи.', 'warn', p); loot = [['stone_block', U.ri(10, 25)]]; burst('smoke', b.x + 1, b.y + 1, 6);
    } else if (r < risk) { // підземні мешканці
      try { p.hurt ? p.hurt(U.ri(4, 10), 'cut') : p.takeDamage && p.takeDamage(U.ri(4, 10), 'cut'); } catch (e) { }
      p.addThought('cave_scare'); RW.UI.letter('Підземні тварини', nm + ' відбивався(лась) від печерних істот, але повернувся(лась) із здобиччю.', 'warn', p); loot = [['steel', U.ri(6, 16)]];
    } else {
      for (const L of SHAFT_LOOT) { if (L[3] > depth || Math.random() > (L[3] ? 0.5 : 0.85)) continue; loot.push([L[0], Math.max(1, Math.round(U.ri(L[1], L[2]) * mul * (L[0] === 'components' ? 0.7 : 1)))]); }
      if (!loot.length) loot.push(['stone_block', U.ri(20, 40)]); p.addThought('cave_haul');
      if (Math.random() < 0.14 + depth * 0.02) { b.buf.depth = Math.min(6, depth + 1); RW.UI.toast('⛏ Шахта поглибилась: рівень ' + b.buf.depth, 'good'); }
    }
    for (const [k, n] of loot) { if (!D.items[k]) continue; try { map.addItem(k, n, b.x + 1, b.y + 2); } catch (e) { } }
    RW.R.fx.text(b.x + 1, b.y - 0.4, '⬆ ' + loot.map(l => l[1] + ' ' + (D.items[l[0]] ? D.items[l[0]].name : l[0])).join(', '), '#ffe27a'); burst('sparkle', b.x + 1, b.y + 1.5, 10, { c: '#ffe27a' });
    if (g.stats) g.stats.delves = (g.stats.delves || 0) + 1; p.psyDelve = g.tick;
  }
  T('cave_scare', 'Налякався(лась) у шахті', -6, 2); T('cave_haul', 'Вдала вилазка в шахту', 4, 1.5);
  function shaftTick(g) { // раз на 120 тіків
    const sh = g.map.buildings.filter(b => b.def.shaft && b.hp > 0 && !b.delver && !b.decon); if (!sh.length || g.threat > 0) return;
    const hr = D.hour(g.tick); if (hr < 7 || hr > 19) return;
    for (const b of sh) {
      if (g.tick - (b.buf.lastT || -99999) < B2.DELVE_COOL) continue;
      const cand = cols(g).filter(p => !p.isChild && !p.drafted && !p.downed && !p.mental && !p.sleeping && !p.carry && p.canDo && p.canDo('mining') && p.mood > 30 && (!p.job || ['wander', 'chat', 'joy', 'stargaze', 'mine'].includes(p.job.type)) && (!p.psyDelve || g.tick - p.psyDelve > 3000));
      cand.sort((a, c) => (c.skillLvl ? c.skillLvl('mining') : 0) - (a.skillLvl ? a.skillLvl('mining') : 0)); const p = cand[0]; if (!p) continue;
      AI.endJob(p); AI.setJob(p, { type: 'delve', b, stage: 0 }); b.buf.lastT = g.tick;
    }
  }

  // ======================================================================
  //  9. РІВ ТА МІСТ
  // ======================================================================
  function moatTick(g) { // раз на 30 тіків: добудований «рів» перетворюється на глибоку воду
    const map = g.map, e = ex(g); if (!e.moatSet) rebuildMoatSet(g); let ch = false;
    for (const b of map.buildings.slice()) {
      if (!b.def.moat) continue; const i = b.y * map.w + b.x;
      // не топимо, якщо на клітині стоїть істота
      if (g.pawns.concat(g.animals).some(q => !q.dead && Math.floor(q.x) === b.x && Math.floor(q.y) === b.y)) continue;
      map.removeBuilding(b); map.terrain[i] = 0; e.moat.push(i); e.moatSet.add(i); map.markDirty(i); map.touch(i); ch = true;
      burst('sparkle', b.x + 0.5, b.y + 0.5, 6, { c: '#9fd8ff' }); RW.R.fx.text(b.x + 0.5, b.y, '💧', '#9fd8ff'); if (g.stats) g.stats.moat = (g.stats.moat || 0) + 1;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = i + dx + dy * map.w; if (map.inb(b.x + dx, b.y + dy)) map.markDirty(j); }
    }
    if (ch) { map.regionDirty = true; map.roomsDirty = true; map.allDirty = true; }
  }
  B2.bridges = g => g.map.buildings.filter(b => b.def.bridge);
  B2.setBridges = function (g, up, force) {
    let n = 0; for (const b of B2.bridges(g)) {
      if ((b.buf.up ? 1 : 0) === (up ? 1 : 0)) continue;
      if (up && !force && g.pawns.concat(g.animals).some(q => !q.dead && q.faction === 'colony' && Math.hypot(q.x - b.x - 0.5, q.y - b.y - 0.5) < 0.9)) continue; // не піднімати з людьми
      b.buf.up = up ? 1 : 0; g.map.touch(b.y * g.map.w + b.x); n++; fx2('sparkle', b.x + 0.5, b.y + 0.5, { c: '#d8d8e0' }); if (RW.A && n === 1) RW.A.sfx('build');
    }
    if (n) g.map.regionDirty = true; return n;
  };

  // ======================================================================
  //  10. СИГНАЛІЗАЦІЯ
  // ======================================================================
  T('alarm_calm', 'Відбій тривоги', 2, 1); T('alarm_rush', 'Тривога!', -2, 0.3);
  const raiders = g => g.pawns.some(p => p.faction === 'enemy' && !p.dead && !p.gone);
  const sigs = g => g.map.buildings.filter(b => (b.def.bell || b.def.lantern) && b.hp > 0 && !b.decon);
  B2.ringing = g => !!(g && g.ext && g.ext.b2 && g.ext.b2.alarm);
  function alarmTick(g) { // раз на 30 тіків
    const e = ex(g), S = sigs(g), bells = S.filter(b => b.def.bell); const danger = raiders(g);
    if (danger && !e.alarm && (S.length || B2.bridges(g).length && e.mode === 'auto')) {
      e.alarm = g.tick; e.drafted = []; if (S.length) { if (g.stats) g.stats.alarms = (g.stats.alarms || 0) + 1; RW.A && RW.A.sfx('alert'); RW.R.fx.text(S[0].x + 0.5, S[0].y - 0.6, '🔔', '#ffe27a'); RW.UI.toast('🔔 ТРИВОГА! ' + (bells.length ? 'Озброєні збираються біля дзвона' : 'Сигнал піднято'), 'bad'); }
      if (e.mode === 'auto' || e.mode === 'up') B2.setBridges(g, true);
      if (bells.length) { const bl = bells[0]; let k = 0;
        for (const p of cols(g)) {
          if (p.downed || p.mental || p.isChild) continue; const armed = p.equip && p.equip.weapon && !p.noViolence;
          if (armed) { if (!p.drafted) { p.drafted = true; p.alerted = true; AI.endJob(p); e.drafted.push(p.id); } p.orderPos = { x: Math.floor(bl.x) + (k % 3) - 1, y: Math.floor(bl.y) + 1 + ((k / 3) | 0) % 2 }; k++; p.addThought('alarm_rush'); if (RW.Life && RW.Life.bubble) RW.Life.bubble(p, '🛡', 300); }
          else if (!p.drafted && !p.sleeping) { p.addThought('alarm_rush'); if (RW.Life && RW.Life.bubble) RW.Life.bubble(p, '😰', 300); }
        }
      }
    } else if (!danger && e.alarm) {
      e.alarm = 0; for (const id of (e.drafted || [])) { const p = g.pawns.find(q => q.id === id); if (p && p.alerted) { p.drafted = false; p.alerted = false; p.orderPos = null; p.addThought('alarm_calm'); } } e.drafted = [];
      if (e.mode === 'auto') B2.setBridges(g, false);
      RW.UI.toast('✅ Відбій тривоги', 'good');
    } else if (e.alarm && e.mode === 'auto' && g.tick % 120 === 0) B2.setBridges(g, true); // добити ті, що не вдалося підняти
  }

  // ---------- панель «Оборона» ----------
  let ctl = null, lastSig = '';
  function ctlTick() {
    const g = G(); const show = g && g.map && RW.Game.running && !RW.R.viewG && (B2.bridges(g).length || sigs(g).length);
    if (!show) { if (ctl) ctl.style.display = 'none'; return; }
    if (!ctl) { ctl = document.createElement('div'); ctl.id = 'def-ctl'; document.body.appendChild(ctl); ctl.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const g = G(), s = ex(g); if (b.dataset.m) { s.mode = b.dataset.m; if (s.mode === 'up') B2.setBridges(g, true); else if (s.mode === 'down') B2.setBridges(g, false, true); else if (!s.alarm) B2.setBridges(g, false); } if (b.dataset.t) { s.alarm ? (s.alarm = 0) : B2.test(g); } lastSig = ''; }); }
    ctl.style.display = ''; const s = ex(g), br = B2.bridges(g), up = br.filter(b => b.buf.up).length;
    const sig = [s.mode, s.alarm ? 1 : 0, up, br.length, sigs(g).length].join(); if (sig === lastSig) return; lastSig = sig;
    ctl.innerHTML = '<b>🛡 Оборона</b>' + (br.length ? '<span class="dc-row">🌉 ' + up + '/' + br.length + ' піднято ' + [['auto', 'Авто'], ['up', '⬆'], ['down', '⬇']].map(m => '<button data-m="' + m[0] + '" class="' + (s.mode === m[0] ? 'on' : '') + '">' + m[1] + '</button>').join('') + '</span>' : '') + (sigs(g).length ? '<span class="dc-row">🔔 ' + (s.alarm ? '<em>ТРИВОГА</em>' : 'спокій') + ' <button data-t="1">' + (s.alarm ? 'Відбій' : 'Перевірка') + '</button></span>' : '');
  }
  B2.test = function (g) { const e = ex(g); e.alarm = g.tick; e.drafted = []; e.test = true; RW.A && RW.A.sfx('alert'); if (e.mode === 'auto') B2.setBridges(g, true); const s = sigs(g)[0]; if (s) RW.R.fx.text(s.x + 0.5, s.y - 0.6, '🔔', '#ffe27a'); setTimeout(() => { const g2 = G(); if (g2 && ex(g2).test) { ex(g2).alarm = 0; ex(g2).test = false; if (ex(g2).mode === 'auto') B2.setBridges(g2, false); } }, 9000); };
  setInterval(ctlTick, 400);

  // ---------- підключення до гри ----------
  const lt = RW.Life.tick;
  RW.Life.tick = function (g) {
    lt(g);
    try {
      const t = g.tick;
      if (t % B2.ROOM_SCAN === 11) roomScan(g);
      if (t % 60 === 23) roomMood(g);
      if (t % 30 === 5) { moatTick(g); alarmTick(g); }
      if (t % 120 === 29) { cellarTick(g); shaftTick(g); }
      if (t === 1 || (!ex(g).moatSet && t % 30 === 5)) rebuildMoatSet(g);
    } catch (err) { console.error(err); }
  };
  B2._t = { classify, roomScan, cellarTick, shaftTick, moatTick, alarmTick, ex, resolveDelve, rebuildMoatSet };
})();
