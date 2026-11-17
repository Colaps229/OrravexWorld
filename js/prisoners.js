// ============================================================
//  prisoners.js — полон, в'язничні ліжка, нагляд, вербування, продаж, втеча
// ============================================================
(function () {
  'use strict';
  const RW = window.RW; const D = RW.D, U = RW.U, AI = RW.AI, C = RW.Combat; const G = () => RW.G; const TAU = Math.PI * 2; const DY = D.DAY;
  const P = RW.Prisoners = {};
  const MODES = { recruit: ['🤝', 'Схилити до себе'], hold: ['⛓', 'Утримувати'], sell: ['💰', 'Продати торговцю'], release: ['🕊', 'Відпустити'] };
  P.MODES = MODES;
  // ---------- Дані ----------
  D.workTypes.splice(3, 0, { id: 'warden', name: 'Нагляд', skill: 'social' });
  D.thoughts.prisoner_exec = { l: 'Страту в\'язня бачив(ла)', v: -5, dur: 2 * DY }; D.thoughts.prisoner_joined = { l: 'Новий товариш (колишній в\'язень)', v: 2, dur: 1.5 * DY };
  D.thoughts.prisoner_escape = { l: 'Втеча в\'язня налякала', v: -3, dur: 1 * DY }; D.thoughtIco && Object.assign(D.thoughtIco, { prisoner_exec: '⚰', prisoner_joined: '🤝', prisoner_escape: '🚨' });
  D.thoughts.recruited_here = { l: 'Мене взяли до колонії', v: 4, dur: 3 * DY }; D.thoughtIco && (D.thoughtIco.recruited_here = '🏠');
  const pd = RW.Pawn.deserialize; RW.Pawn.deserialize = function (o) { const p = pd(o); if (p.work.warden == null) p.work.warden = 2; return p; };
  const PP = RW.Pawn.prototype; const pser = PP.serialize;
  PP.serialize = function () { const o = pser.call(this); if (this.capture) o.capture = true; return o; };
  const st = p => p.prisoner;
  const prisoners = () => G().pawns.filter(p => p.faction === 'prisoner' && !p.dead);
  P.prisonBeds = () => G().map.buildings.filter(b => b.prison && !b.dead && b.def.bed);
  P.freeBed = (forWho) => { const used = new Set(prisoners().map(p => st(p) && st(p).bed).filter(Boolean)); for (const b of P.prisonBeds()) { if (used.has(b)) continue; if (b.res && forWho && b.res !== forWho.id) continue; return b; } return null; };
  if (!G) return;
  // ---------- Ліжка: колоністи не займають в'язничні ----------
  // (патч у ai.js: findBed пропускає b.prison)
  // ---------- Захоплення ----------
  P.capture = (e, bed) => {
    const g = G(); e.faction = 'prisoner'; e.capture = false; e.fleeing = false; e.target = null; e.combatTarget = null;
    e.prisoner = { mode: 'recruit', res: U.clamp(0.45 + Math.random() * 0.55 + (e.has && e.has('kind') ? -0.1 : 0) , 0.3, 1.1), unrest: 0.1, cd: g.tick + 300, since: g.tick, bed: bed, hold: 0 };
    for (const r of g.raids) { const k = r.members.indexOf(e.id); if (k >= 0) r.members.splice(k, 1); }
    // роззброєння
    const eq = e.equip; if (eq.weapon) { if (RW.Quality && eq.wq != null) RW.Quality.pend.push({ def: eq.weapon, q: eq.wq }); g.map.addItem(eq.weapon, 1, bed ? bed.x + 1 : e.tx, bed ? bed.y : e.ty); eq.weapon = null; eq.wq = null; RW.Quality && (RW.Quality.pend.length = 0); }
    e.drafted = false; e.job = null; e.work = {}; e.disabled = [];
    RW.UI && RW.UI.letter('Ворога схоплено', U.fullName(e) + ' тепер ваш в\'язень. Утримуйте його в ліжку для в\'язнів, годуйте й розмовляйте — можливо, він приєднається до колонії. Налаштування: вкладка «В\'язні» (J).', 'info', e);
    RW.FX2 && RW.FX2.burst('sparkle', e.x, e.y - 0.3, 10, { c: '#ffb050' }); RW.A && RW.A.sfx('click');
  };
  P.recruit = (p, by) => {
    const g = G(); p.faction = 'colony'; p.prisoner = null; p.fleeing = false; p.escaped = false; p.work = {}; D.workTypes.forEach(w => p.work[w.id] = 3); if (p.disabled) for (const wt of p.disabled) p.work[wt] = 0;
    p.title = 'Колоніст'; p.thoughts = []; p.addThought('recruited_here'); p.noViolence = false; p.needs.food = Math.max(p.needs.food, 0.6);
    for (const o of g.pawns) if (o.faction === 'colony' && o !== p && !o.dead && o.addThought) o.addThought('prisoner_joined');
    RW.UI && RW.UI.letter('Новий колоніст!', U.fullName(p) + ' більше не в\'язень — ' + (by ? U.shortName(by) + ' переконав(ла) його приєднатися.' : 'він приєднався до вас.'), 'good', p);
    RW.FX2 && (RW.FX2.burst('confetti', p.x, p.y - 0.5, 18), RW.FX2.burst('heart', p.x, p.y - 0.5, 4)); RW.A && RW.A.sfx('good');
  };
  // ---------- Поведінка в'язня ----------
  const roomCells = (bed) => { const m = G().map; const r = m.room[bed.y * m.w + bed.x]; const out = []; if (r < 0) { for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) { const x = bed.x + dx, y = bed.y + dy; if (m.inb(x, y) && m.cost[y * m.w + x] > 0) out.push([x, y]); } return out; } for (let dy = -12; dy <= 12; dy++) for (let dx = -12; dx <= 12; dx++) { const x = bed.x + dx, y = bed.y + dy; if (m.inb(x, y) && m.room[y * m.w + x] === r && m.cost[y * m.w + x] > 0) out.push([x, y]); } return out; };
  P.think = function (p) {
    const g = G(), map = g.map; const s = st(p); p.moving = false;
    if (!s) { p.faction = 'enemy'; return; }
    if (p.carriedBy) { p.x = p.carriedBy.x; p.y = p.carriedBy.y; return; }
    p.moodTimer = (p.moodTimer || 0) + 1; if (p.moodTimer >= 30) { p.moodTimer = 0; AI.slowUpdate(p); if (p.dead) return; P.slow(p, g, s); if (p.faction !== 'prisoner') return; }
    if (p.downed) return; if (p.stun > 0) { p.stun--; return; }
    if (s.leaving) { if (!s.exit) { const e = [[Math.floor(p.x), 0], [Math.floor(p.x), map.h - 1], [0, Math.floor(p.y)], [map.w - 1, Math.floor(p.y)]]; e.sort((a, b) => Math.hypot(a[0] - p.x, a[1] - p.y) - Math.hypot(b[0] - p.x, b[1] - p.y)); s.exit = e[0]; }
      const r = AI.moveTo(p, s.exit[0], s.exit[1]); if (r === 'arrived' || r === 'fail') { if (s.sold) { } C.removePawn(p, 'пішов'); RW.UI && RW.UI.log((s.sold ? 'Продано в\'язня ' : 'Відпущено в\'язня ') + U.shortName(p)); } return; }
    if (s.hold > g.tick) { p.moving = false; return; }
    if (s.bed && (s.bed.dead || !s.bed.prison)) s.bed = null; if (!s.bed) { s.bed = P.freeBed(); }
    const hr = D.hour(g.tick); const night = hr >= 22 || hr < 6;
    if (p.sleeping) {
      if (s.bed) { p.x = s.bed.x + 0.5; p.y = s.bed.y + 0.5; } p.needs.rest = Math.min(1, p.needs.rest + 0.0003 * (s.bed ? s.bed.def.bed.rest : 0.65));
      if (p.needs.rest >= 0.98 || (!night && p.needs.rest > 0.6) || p.needs.food < 0.05) { p.sleeping = false; p.updateCap(); } return;
    }
    if (p.needs.rest < 0.25 || (night && p.needs.rest < 0.85)) {
      if (s.bed) { const r = AI.moveTo(p, s.bed.x, s.bed.y); if (r === 'arrived') { p.sleeping = true; p.updateCap(); p.moving = false; } else if (r === 'fail') s.bed = null; return; }
      if (p.needs.rest < 0.12 && !p.sleeping) { p.sleeping = true; p.updateCap(); } return;
    }
    // блукає в камері
    if (--s.wt > 0 || !s.bed) { if (p.path) AI.stepPath(p); return; }
    s.wt = U.ri(120, 420); const cells = roomCells(s.bed); if (!cells.length) return; const c = U.pick(cells); AI.moveTo(p, c[0], c[1], { maxIter: 300 });
  };
  const hungerSev = p => p.needs.food;
  P.slow = function (p, g, s) {
    if (s.wt == null) s.wt = 60;
    // неспокій
    let du = 0.0026; if (p.needs.food < 0.3) du += 0.006; if (p.needs.rest < 0.2) du += 0.003; if (!s.bed) du += 0.004; else { du -= 0.0008; const bq = s.bed.q != null && RW.Quality ? RW.Quality.mult(s.bed.q) - 1 : 0; du -= bq * 0.001; }
    if (p.pain > 0.3) du += 0.002; if (s.mode === 'recruit') du -= 0.0008;
    s.unrest = U.clamp(s.unrest + du, 0, 1.4);
    if (s.leaving) return;
    if (s.unrest >= 1 && !p.downed) { P.escape(p, g); return; }
    // голодна смерть не заважає — але ранений в'язень лежить
    if (s.res < 0) s.res = 0;
  };
  P.escape = function (p, g) {
    p.faction = 'enemy'; p.prisoner = null; p.fleeing = true; p.exitTile = null; p.escaped = true; p.sleeping = false; p.updateCap();
    RW.UI && RW.UI.letter('Втеча!', U.fullName(p) + ' втікає! В\'язень більше не міг терпіти умови утримання.', 'bad', p);
    for (const o of g.pawns) if (o.faction === 'colony' && !o.dead && o.addThought && Math.hypot(o.x - p.x, o.y - p.y) < 14) o.addThought('prisoner_escape');
    RW.FX2 && RW.FX2.burst('anger', p.x, p.y - 0.6, 3); RW.A && RW.A.sfx('alert');
  };
  const thinkOrig = AI.think;
  AI.think = function (p) { if (p.faction === 'prisoner') return P.think(p); return thinkOrig(p); };
  // ---------- Робота наглядача ----------
  const reach = (p, e) => G().map.reachable(p.tx, p.ty, e.tx, e.ty, true);
  AI.GIVERS.warden = function (p) {
    const g = G(); const auto = g.ext.prison ? g.ext.prison.auto !== false : true;
    // захоплення
    const bed = P.freeBed();
    if (bed) for (const e of g.pawns) { if (e.faction !== 'enemy' || !e.downed || e.dead || e.carriedBy || (e.res && e.res !== p.id) || !(e.capture || (auto && !e.escaped))) continue; if (!reach(p, e)) continue; if (e.blood < 0.2 && !e.capture) continue; AI.reserve(p, e); return { type: 'capture', who: e, bed, stage: 0 }; }
    for (const pr of prisoners()) {
      const s = st(pr); if (!s || s.leaving || (pr.res && pr.res !== p.id) || !reach(p, pr)) continue;
      if (pr.injuries.some(i => i.type !== 'missing' && !i.tended && i.amt > 1) && pr.downed) { AI.reserve(p, pr); return { type: 'tend', who: pr, stage: 0 }; }
      if (pr.needs.food < 0.42) { const it = AI.pickItem(p, Object.keys(D.items).filter(k => D.items[k].cat === 'meal' && D.items[k].nutr >= 0.25), null); if (it) { AI.reserve(p, pr); AI.reserve(p, it); return { type: 'feedp', who: pr, item: it, stage: 0 }; } }
      if (!pr.downed && s.cd <= g.tick && (s.mode === 'recruit' || s.unrest > 0.45)) { AI.reserve(p, pr); return { type: 'talkp', who: pr, stage: 0, t: 0 }; }
    }
    return null;
  };
  AI.RUN.capture = function (p, j) {
    const g = G(), map = g.map; const e = j.who, bed = j.bed; if (!e || e.dead || e.faction !== 'enemy' || !bed || bed.dead || !bed.prison) { if (e) e.res = null; return 'fail'; }
    if (j.stage === 0) { const r = AI.moveTo(p, e.tx, e.ty, { adj: true }); if (r === 'fail') { e.res = null; return 'fail'; } if (r === 'arrived') { p.carrying = e; e.carriedBy = p; j.stage = 1; AI.resetMove(p); p.moving = false; RW.FX2 && RW.FX2.burst('sparkle', e.x, e.y, 6, { c: '#ffb050' }); } return; }
    const r = AI.moveTo(p, bed.x, bed.y); if (r === 'fail') { e.carriedBy = null; p.carrying = null; e.res = null; return 'fail'; }
    if (e.carriedBy === p) { e.x = p.x; e.y = p.y; }
    if (r === 'arrived') { e.carriedBy = null; p.carrying = null; e.x = bed.x + 0.5; e.y = bed.y + 0.5; e.inBed = true; e.bedDef = bed.def.bed; e.bedRef = bed; e.res = null; P.capture(e, bed); p.gainXp('social', 15); return 'done'; }
  };
  AI.RUN.feedp = function (p, j) {
    const g = G(), map = g.map; const pr = j.who; if (!pr || pr.dead || pr.faction !== 'prisoner') return 'fail';
    if (j.stage === 0) { const it = j.item; if (!it || it.dead) return 'fail'; const r = AI.moveTo(p, it.i % map.w, (it.i / map.w) | 0); if (r === 'fail') return 'fail'; if (r === 'arrived') { const def = it.def; map.takeItem(it, 1); p.carry = { def, n: 1 }; j.stage = 1; AI.resetMove(p); } return; }
    if (j.stage === 1) { const r = AI.moveTo(p, pr.tx, pr.ty, { adj: true }); if (r === 'fail') { return 'fail'; } if (r === 'arrived') { j.stage = 2; j.t = 0; p.moving = false; } return; }
    p.moving = false; AI.faceTo(p, pr.x, pr.y); st(pr).hold = G().tick + 5; j.t++;
    if (j.t === 30) { const d = D.items[p.carry.def]; pr.needs.food = Math.min(1, pr.needs.food + (d.nutr || 0.5)); p.carry = null; RW.FX2 && RW.FX2.burst('sparkle', pr.x, pr.y - 0.4, 5, { c: '#ffd890' }); pr.res = null; st(pr).unrest = Math.max(0, st(pr).unrest - 0.04); p.gainXp('social', 3); return 'done'; }
  };
  AI.RUN.talkp = function (p, j) {
    const g = G(); const pr = j.who; if (!pr || pr.dead || pr.faction !== 'prisoner' || pr.downed) return 'done'; const s = st(pr);
    if (j.stage === 0) { const r = AI.moveTo(p, pr.tx, pr.ty, { adj: true }); if (r === 'fail') { pr.res = null; return 'fail'; } if (r === 'arrived') { j.stage = 1; j.t = 0; p.moving = false; } return; }
    p.moving = false; AI.faceTo(p, pr.x, pr.y); s.hold = g.tick + 5; j.t++; p.gainXp('social', 0.12);
    if (j.t % 40 === 0 && RW.FX2) RW.FX2.emit(s.mode === 'recruit' ? 'note' : 'heart', (p.x + pr.x) / 2, p.y - 0.6, { c: s.mode === 'recruit' ? '#9ad0ff' : '#ff9aba' });
    if (j.t >= 200) {
      pr.res = null; s.cd = g.tick + 1200 + U.ri(0, 600); const sl = p.skillLvl('social'); const sm = 0.6 + sl * 0.07 + (p.has('kind') ? 0.1 : 0) - (p.has('abrasive') ? 0.15 : 0);
      s.unrest = Math.max(0, s.unrest - 0.22);
      if (s.mode === 'recruit') { s.res -= 0.11 * sm; RW.UI && RW.UI.toast(U.shortName(pr) + ': опір ' + Math.round(Math.max(0, s.res) * 100) + '%', 'info'); if (s.res <= 0) { P.recruit(pr, p); return 'done'; } }
      return 'done';
    }
  };
  const jl = AI.jobLabel; AI.jobLabel = function (p) { const j = p.job; if (j) { if (j.type === 'capture') return 'Веде в\'язня'; if (j.type === 'feedp') return 'Годує в\'язня'; if (j.type === 'talkp') return 'Розмовляє з в\'язнем'; } return jl(p); };
  // ---------- Продаж / страта / вихід ----------
  P.hasTrader = () => G().pawns.some(p => p.isTrader && !p.dead);
  P.sell = pr => { const g = G(); if (!P.hasTrader()) { RW.UI.toast('Немає торговця на карті', 'bad'); return; } const price = Math.round(140 + 40 * (pr.skills.shooting.lvl + pr.skills.melee.lvl) / 2 + U.ri(0, 120)); const sp = g.tradeSpot || g.home; g.map.addItem('silver', price, sp.x, sp.y); st(pr).leaving = true; st(pr).sold = true; RW.UI.letter('Продано', 'Торговець купив в\'язня ' + U.shortName(pr) + ' за ' + price + ' срібла.', 'good', null, { x: sp.x, y: sp.y }); RW.A.sfx('good'); };
  P.execute = pr => { const g = G(); for (const o of g.pawns) if (o.faction === 'colony' && !o.dead && Math.hypot(o.x - pr.x, o.y - pr.y) < 12 && o.addThought) o.addThought('prisoner_exec'); RW.R && RW.R.fx.blood(pr.x, pr.y, 18); pr.die(null); RW.UI.log('Страчено в\'язня ' + U.shortName(pr)); };
  // ---------- Тік: ініціалізація зі збереження ----------
  P.pack = function (g) {
    const e = g.ext = g.ext || {}; const old = e.prison || {};
    e.prison = { auto: old.auto !== false, beds: g.map.buildings.filter(b => b.prison).map(b => b.x + ',' + b.y), p: {} };
    for (const p of g.pawns) if (p.faction === 'prisoner' && st(p)) { const s = st(p); e.prison.p[p.id] = { mode: s.mode, res: s.res, unrest: s.unrest, cd: s.cd, since: s.since, bed: s.bed ? s.bed.x + ',' + s.bed.y : null, leaving: !!s.leaving, sold: !!s.sold }; }
  };
  P.tick = function (g) {
    if (g._prisonInit !== g.map) {
      g._prisonInit = g.map; const e = (g.ext && g.ext.prison) || null;
      if (e) { for (const k of e.beds || []) { const [x, y] = k.split(',').map(Number); const b = g.map.bld[y * g.map.w + x]; if (b) b.prison = true; }
        for (const p of g.pawns) if (p.faction === 'prisoner') { const d = e.p && e.p[p.id]; if (d) { const bb = d.bed ? g.map.bld[+d.bed.split(',')[1] * g.map.w + +d.bed.split(',')[0]] : null; p.prisoner = { mode: d.mode, res: d.res, unrest: d.unrest, cd: d.cd, since: d.since, bed: bb, hold: 0, wt: 60, leaving: d.leaving, sold: d.sold }; } else p.faction = 'enemy'; } }
      else for (const p of g.pawns) if (p.faction === 'prisoner' && !p.prisoner) p.faction = 'enemy';
    }
  };
  const lt = RW.Life && RW.Life.tick; if (lt) RW.Life.tick = function (g) { lt(g); P.tick(g); };
  // ---------- Оверлей ----------
  P.drawOverlay = function (c, TS, t) {
    const g = G(); c.save(); c.textAlign = 'center'; c.font = '12px "Segoe UI Emoji",sans-serif';
    for (const b of g.map.buildings) { if (!b.prison || b.dead) continue; const X = b.x * TS, Y = b.y * TS; c.strokeStyle = 'rgba(255,150,40,' + (0.55 + 0.25 * Math.sin(t * 0.06)) + ')'; c.lineWidth = 2; c.strokeRect(X + 1, Y + 1, b.w * TS - 2, b.h * TS - 2); c.fillText('🔒', X + b.w * TS - 8, Y + 11); }
    for (const p of g.pawns) {
      if (p.dead) continue; const x = p.x * TS, y = p.y * TS - 26;
      if (p.faction === 'enemy' && p.downed && p.capture) { c.fillText('⛓', x, y); continue; }
      if (p.faction !== 'prisoner' || !p.prisoner) continue; const s = p.prisoner;
      c.fillText('⛓', x - 9, y); const u = U.clamp(s.unrest, 0, 1); c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(x - 11, y + 4, 22, 4); c.fillStyle = u > 0.7 ? '#ff4a3a' : u > 0.4 ? '#ffb040' : '#6fd06a'; c.fillRect(x - 10, y + 5, 20 * u, 2);
      if (u > 0.8) { c.fillText('❗', x + 9, y - 1 + Math.sin(t * 0.3) * 2); }
    }
    c.restore();
  };
  // ---------- UI ----------
  P.pawnBtns = function (p) {
    if (p.faction === 'enemy' && p.downed && !p.dead) return `<button class="btn ${p.capture ? 'on' : ''}" data-act="prCapture" data-id="${p.id}">⛓ ${p.capture ? 'Скасувати полон' : 'Взяти в полон'}</button>`;
    if (p.faction === 'prisoner' && st(p)) { const s = st(p); return `<div class="sub">В'язень · опір ${Math.round(Math.max(0, s.res) * 100)}% · неспокій ${Math.round(Math.min(1, s.unrest) * 100)}%</div>`; }
    return '';
  };
  P.bedBtn = b => `<p><button class="btn ${b.prison ? 'on' : ''}" data-act="prBed">${b.prison ? '🔒 Ліжко для в\'язнів' : '🛏 Зробити ліжком для в\'язнів'}</button> <span class="sub">${b.prison ? 'Колоністи сюди не лягають.' : 'Сюди поселяють полонених.'}</span></p>`;
  P.html = function () {
    const g = G(); const e = g.ext.prison || {}; const list = prisoners(); const beds = P.prisonBeds();
    let h = '<div class="sub">Ліжок для в\'язнів: <b>' + beds.length + '</b> · в\'язнів: <b>' + list.length + '</b></div>';
    h += '<label class="sub"><input type="checkbox" data-chg="prAuto" ' + (e.auto !== false ? 'checked' : '') + '> Автоматично брати в полон усіх збитих ворогів (потрібне вільне ліжко та дозвіл «Нагляд»)</label>';
    if (!beds.length) h += '<p class="sub">Виберіть ліжко (клік) і натисніть «Зробити ліжком для в\'язнів». Огородіть кімнату стінами та дверима — в\'язні втікають, якщо їх погано тримати.</p>';
    if (!list.length) return h + '<p class="sub">В\'язнів немає. Збийте ворога (не вбивайте) — наглядач віднесе його в камеру.</p>';
    h += '<div class="prlist">';
    for (const p of list) { const s = st(p); if (!s) continue; h += '<div class="prrow"><img src="' + RW.UI.portrait(p) + '" class="ip"><div class="prinfo"><b>' + RW.UI.esc(U.fullName(p)) + '</b><div class="sub">' + (p.downed ? 'поранений · ' : '') + 'їжа ' + Math.round(p.needs.food * 100) + '% · опір ' + Math.round(Math.max(0, s.res) * 100) + '%</div>';
      h += '<div class="zfill" title="Неспокій"><div class="zf" style="width:' + Math.round(Math.min(1, s.unrest) * 100) + '%;background:' + (s.unrest > 0.7 ? '#e04a3a' : s.unrest > 0.4 ? '#e0a030' : '#5ab060') + '"></div></div></div><div class="prmodes">';
      for (const m of ['recruit', 'hold']) h += '<button class="btn xs ' + (s.mode === m ? 'on' : '') + '" data-act="prMode" data-id="' + p.id + '" data-m="' + m + '" title="' + MODES[m][1] + '">' + MODES[m][0] + '</button>';
      h += '<button class="btn xs" data-act="prSell" data-id="' + p.id + '" ' + (P.hasTrader() ? '' : 'disabled') + ' title="Продати (потрібен торговець)">💰</button><button class="btn xs" data-act="prRelease" data-id="' + p.id + '" title="Відпустити">🕊</button><button class="btn xs" data-act="prExec" data-id="' + p.id + '" title="Стратити (колоністи засмутяться)">⚰</button></div></div>'; }
    return h + '</div>';
  };
  P.install = function () {
    const UI = RW.UI; const A = UI.actions; UI.addWin('prison', { title: 'В\'язні', fn: P.html, cls: '' });
    UI.TABS.splice(UI.TABS.length - 1, 0, { id: 'prison', label: 'В\'язні', key: 'K' }); UI.keyWins.KeyK = 'prison';
    const byId = el => G().pawns.find(x => x.id === +el.dataset.id);
    Object.assign(A, {
      prCapture: el => { const p = byId(el); if (p) p.capture = !p.capture; },
      prBed: () => { const b = UI.selBld(); if (b) { b.prison = !b.prison; if (!b.prison) for (const p of prisoners()) if (st(p) && st(p).bed === b) st(p).bed = null; } },
      prMode: el => { const p = byId(el); if (p && st(p)) st(p).mode = el.dataset.m; },
      prSell: el => { const p = byId(el); if (p && st(p)) P.sell(p); },
      prRelease: el => { const p = byId(el); if (p && st(p)) { st(p).leaving = true; UI.toast('В\'язня буде відпущено', 'info'); } },
      prExec: el => { const p = byId(el); if (p && st(p)) P.execute(p); },
      prAuto: el => { const g = G(); g.ext.prison = g.ext.prison || {}; g.ext.prison.auto = !!el.checked; }
    });
  };
  window.addEventListener('load', P.install);
})();
