'use strict';
// ============================================================
//  economy.js — світ і гроші (v0.9.4)
//   12) Ринок: ціни коливаються (сезон, попит і пропозиція, дефіцит/надлишок)
//   13) Замовлення від поселень: зробіть і відправте речі за нагороду
//   14) Найманці: контракт, щоденна платня, продовження
//   15) Події на карті світу: чума, голод, свято, війна — і ваша допомога
//  Вікно «Економіка» (клавіша I). Усі числа — в об'єкті EC.
// ============================================================
(function () {
  const D = RW.D, U = RW.U, DY = D.DAY, E = RW.Events, W = RW.World; const G = () => RW.G;
  const EC = RW.Eco = {
    M_MIN: 0.55, M_MAX: 1.9, RELAX: 0.12, NOISE: 0.05, SELL_STEP: 0.012, BUY_STEP: 0.012, TRADE_CAP: 0.35, HIST: 18,
    EV_CH: 0.14, EV_DAYS: [3, 6],
    ORD_MAX: 3, ORD_CH: 0.5, ORD_FROM: 3, ORD_DAYS: [6, 10], ORD_MARGIN: [1.35, 1.85], ORD_GW: 4, ORD_FAIL_GW: -5,
    HIRE_MAX: 3, HIRE_DAYS: 10, HIRE_REFRESH: 4, HIRE_FROM: 2,
    WE_CH: 0.28, WE_MAX: 3, WE_DAYS: [4, 7], AID_GW: 14
  };
  const esc = U.esc || (s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])));
  const fx2 = (t, x, y, o) => RW.FX2 && RW.FX2.emit(t, x, y, o), burst = (t, x, y, n, o) => RW.FX2 && RW.FX2.burst(t, x, y, n, o);
  const ex = g => { const e = (g.ext = g.ext || {}); return (e.eco = e.eco || { m: {}, hist: {}, ev: [], orders: [], hire: { cands: [], next: 0 }, we: [], paid: 0 }); };
  const dayN = g => D.relDay(g.tick);
  const itName = k => (D.items[k] && D.items[k].name) || k;
  const silverOf = () => E.colonyStock().silver || 0;
  const takeItem = (def, n) => { const map = G().map; const s = map.byDef.get(def); if (!s) return 0; let left = n; for (const it of Array.from(s)) { if (left <= 0) break; if (it.forbid || it.res) continue; const t = Math.min(left, it.n); map.takeItem(it, t); left -= t; } return n - left; };
  const stockOf = def => E.colonyStock()[def] || 0;
  const trade = def => { const d = D.items[def]; return d && d.value > 0 && !['hidden', 'corpse', 'currency', 'chunk'].includes(d.cat); };
  const keys = () => Object.keys(D.items).filter(trade);
  const cols = g => g.pawns.filter(p => p.faction === 'colony' && !p.dead);
  const spot = g => g.tradeSpot || { x: g.home.x + 6, y: g.home.y };
  const wlog = (s) => { try { const w = W.ensure(G()); w.log.unshift({ t: G().tick, s }); if (w.log.length > 14) w.log.pop(); } catch (e) { } };
  D.thoughts.hired_ok = { l: 'Найманець добре виконує роботу', v: 1, dur: DY };
  D.thoughts.fair_deal = { l: 'Вигідна угода для колонії', v: 2, dur: DY * 1.5 };

  // ======================================================================
  //  12. РИНОК
  // ======================================================================
  const SEAS_T = (def, s) => { const d = D.items[def]; const c = d.cat; let t = 1; if (s === 3) { if (c === 'rawfood' || c === 'meal') t *= 1.25; if (def === 'wood') t *= 1.15; if (c === 'apparel') t *= 1.15; } else if (s === 1) { if (c === 'apparel') t *= 0.92; if (c === 'rawfood') t *= 0.88; } else if (s === 2) { if (c === 'rawfood') t *= 0.85; } else if (s === 0) { if (c === 'medicine') t *= 1.08; } return t; };
  const evMul = (g, def) => { let m = 1; for (const e of ex(g).ev) if (g.tick < e.until && (e.def === def || (e.cat && D.items[def] && D.items[def].cat === e.cat))) m *= e.mult; return m; };
  const mult = def => { const g = G(); if (!g) return 1; const m = ex(g).m[def]; return (m == null ? 1 : m) * evMul(g, def); };
  EC.mult = mult;
  const bp = E.buyPrice, sp = E.sellPrice;
  E.buyPrice = def => bp(def) * mult(def); E.sellPrice = def => sp(def) * mult(def);
  const ext = E.executeTrade;
  E.executeTrade = function (buy, sell) {
    const g = G(); const bsnap = Object.assign({}, buy), ssnap = Object.assign({}, sell); const r = ext.apply(this, arguments);
    if (!r) {
      const e = ex(g);
      for (const k in ssnap) if (ssnap[k] > 0) e.m[k] = U.clamp((e.m[k] == null ? 1 : e.m[k]) * (1 - Math.min(EC.TRADE_CAP, EC.SELL_STEP * ssnap[k])), EC.M_MIN, EC.M_MAX);
      for (const k in bsnap) if (bsnap[k] > 0) e.m[k] = U.clamp((e.m[k] == null ? 1 : e.m[k]) * (1 + Math.min(EC.TRADE_CAP, EC.BUY_STEP * bsnap[k])), EC.M_MIN, EC.M_MAX);
      const tot = Object.values(ssnap).reduce((a, c) => a + c, 0); if (tot >= 20) RW.UI.toast('📉 Ви збили ціни на ринку великим продажем', 'info');
    }
    return r;
  };
  function marketDaily(g) {
    const e = ex(g), s = D.seasonOf(g.tick);
    for (const k of keys()) {
      const t = SEAS_T(k, s); let m = e.m[k] == null ? 1 : e.m[k]; m += (t - m) * EC.RELAX + U.rr(-EC.NOISE, EC.NOISE); m = U.clamp(m, EC.M_MIN, EC.M_MAX); e.m[k] = m;
      const h = (e.hist[k] = e.hist[k] || []); h.push(+(m * evMul(g, k)).toFixed(3)); if (h.length > EC.HIST) h.shift();
    }
    e.ev = e.ev.filter(v => g.tick < v.until);
    if (Math.random() < EC.EV_CH && e.ev.length < 3) {
      const shortage = Math.random() < 0.55; const cats = ['rawfood', 'meal', 'medicine', 'weapon', 'apparel', 'resource']; const cat = U.pick(cats); const nm = (D.itemCats && D.itemCats[cat]) || cat;
      const days = U.ri(EC.EV_DAYS[0], EC.EV_DAYS[1]); const ev = { id: U.nextId(), cat, mult: shortage ? U.rr(1.4, 1.8) : U.rr(0.55, 0.75), until: g.tick + days * DY, text: shortage ? 'Дефіцит: ' + nm.toLowerCase() : 'Надлишок: ' + nm.toLowerCase(), ico: shortage ? '📈' : '📉' }; e.ev.push(ev);
      RW.UI.toast(ev.ico + ' Ринок: ' + ev.text + ' (' + (shortage ? 'ціни зростуть' : 'ціни впадуть') + ' на ' + days + ' д.)', shortage ? 'warn' : 'info'); wlog(ev.text + '.');
    }
  }

  // ======================================================================
  //  13. ЗАМОВЛЕННЯ ВІД ПОСЕЛЕНЬ
  // ======================================================================
  const CRAFT = [['bow', 1, 3], ['club', 1, 3], ['knife', 2, 4], ['revolver', 1, 2], ['rifle', 1, 1], ['meal_simple', 12, 28], ['meal_fine', 6, 14], ['medicine', 3, 8], ['herbal', 8, 18], ['cloth', 30, 70], ['parka', 1, 2], ['flak_vest', 1, 2], ['steel', 50, 120], ['wood', 80, 200], ['leather', 20, 50]];
  function newOrder(g) {
    const w = W.ensure(g); const e = ex(g); const cand = w.settlements.filter(s => s.fac !== 'me' && s.fac !== 'peer' && s.fac !== 'pirates' && W.get(s.fac).gw > -20 && !e.orders.some(o => o.sid === s.id) && !e.we.some(v => v.sid === s.id && v.type === 'plague'));
    if (!cand.length) return false; const s = U.pick(cand); const c = U.pick(CRAFT.filter(o => D.items[o[0]])); const n = U.ri(c[1], c[2]); const val = (D.items[c[0]].value || 1) * n;
    const rew = Math.round(val * U.rr(EC.ORD_MARGIN[0], EC.ORD_MARGIN[1]) / 5) * 5 + 30; const days = U.ri(EC.ORD_DAYS[0], EC.ORD_DAYS[1]);
    e.orders.push({ id: U.nextId(), sid: s.id, def: c[0], n, rew, until: g.tick + days * DY, st: 'open' });
    RW.UI.letter('📜 Замовлення', '«' + s.name + '» просить доставити: ' + n + ' × ' + itName(c[0]) + '. Нагорода — ' + rew + ' срібла та повага фракції. Термін: ' + days + ' діб. Відкрийте вікно «Економіка» [I].', 'info', null, null, [{ label: 'Відкрити', fn: () => { EC.tab = 'orders'; RW.UI.openWin('eco'); } }]); wlog('«' + s.name + '» розмістило замовлення.'); return true;
  }
  function ordersDaily(g) {
    const e = ex(g);
    for (const o of e.orders.slice()) {
      if (o.st === 'open' && g.tick > o.until) { o.st = 'failed'; const s = W.ensure(g).settlements.find(x => x.id === o.sid); if (s) W.change(s.fac, EC.ORD_FAIL_GW); RW.UI.toast('⌛ Замовлення «' + itName(o.def) + '» прострочено (' + EC.ORD_FAIL_GW + ' до ставлення)', 'bad'); }
    }
    e.orders = e.orders.filter(o => o.st === 'open' || o.st === 'sent' || (g.tick - (o.done || o.until) < DY * 2));
    if (dayN(g) >= EC.ORD_FROM && e.orders.filter(o => o.st === 'open').length < EC.ORD_MAX && Math.random() < EC.ORD_CH) newOrder(g);
  }
  const A = RW.UI.actions;
  A.ecOrder = el => {
    const g = G(), e = ex(g); const o = e.orders.find(x => x.id === +el.dataset.id); if (!o || o.st !== 'open') return;
    if (stockOf(o.def) < o.n) return RW.UI.toast('Не вистачає: ' + itName(o.def) + ' (' + stockOf(o.def) + '/' + o.n + ')', 'bad');
    takeItem(o.def, o.n); o.st = 'sent'; const sp = spot(g); burst('dustpuff', sp.x + 0.5, sp.y + 0.5, 8); fx2('sparkle', sp.x + 0.5, sp.y, { c: '#ffe08a' });
    W.sendCaravan(g, 'me', o.sid, 'orderout', DY * 0.8, { oid: o.id, ico: '📦' }); RW.A && RW.A.sfx('coin'); RW.UI.toast('📦 Караван з замовленням вирушив', 'good');
  };
  // ======================================================================
  //  14. НАЙМАНЦІ
  // ======================================================================
  const SPEC = [['construction', 'Будівельник'], ['crafting', 'Майстер'], ['medicine', 'Лікар'], ['shooting', 'Стрілець'], ['melee', 'Боєць'], ['plants', 'Фермер'], ['cooking', 'Кухар'], ['mining', 'Шахтар']];
  function newCand(g) {
    const sp = U.pick(SPEC.filter(s => D.skills.includes(s[0]))); const p = RW.Pawn.generate({ faction: 'colony', age: U.ri(22, 48) }); const l = U.ri(9, 15); p.skills[sp[0]].lvl = l; p.skills[sp[0]].pas = 1; p.title = 'Найманець';
    for (const k of D.skills) if (k !== sp[0]) p.skills[k].lvl = Math.min(p.skills[k].lvl, U.ri(2, 8));
    const sum = D.skills.reduce((a, k) => a + p.skills[k].lvl, 0); const wage = Math.round((22 + l * 3.2) / 5) * 5; const fee = Math.round((90 + sum * 4) / 10) * 10;
    return { p, spec: sp[1], sk: sp[0], wage, fee };
  }
  function hireDaily(g) {
    const e = ex(g), h = e.hire; if (dayN(g) < EC.HIRE_FROM) return;
    if (g.tick >= h.next || !h.cands.length) { h.cands = []; for (let k = 0; k < 3; k++) h.cands.push(newCand(g)); h.next = g.tick + EC.HIRE_REFRESH * DY; if (dayN(g) > EC.HIRE_FROM) RW.UI.toast('🪖 У таверні нові найманці — вікно «Економіка» [I]', 'info'); }
  }
  const hired = g => g.pawns.filter(p => p.faction === 'colony' && !p.dead && p.hire);
  A.ecHire = el => {
    const g = G(), h = ex(g).hire; const i = +el.dataset.i; const c = h.cands[i]; if (!c) return; if (!(c.p instanceof RW.Pawn)) { h.cands = []; return RW.UI.toast('Кандидати розійшлись після завантаження — зачекайте на нових', 'info'); } if (hired(g).length >= EC.HIRE_MAX) return RW.UI.toast('Забагато найманців (макс. ' + EC.HIRE_MAX + ')', 'bad');
    if (silverOf() < c.fee) return RW.UI.toast('Потрібно ' + c.fee + ' срібла', 'bad'); takeItem('silver', c.fee);
    const p = c.p; h.cands.splice(i, 1); const sp = E.edgeSpawn(g.map, g.home); p.x = sp.x + 0.5; p.y = sp.y + 0.5; p.faction = 'colony'; p.title = 'Найманець'; p.hire = { until: g.tick + EC.HIRE_DAYS * DY, wage: c.wage, unpaid: 0, spec: c.spec };
    g.pawns.push(p); E.initRelations && E.initRelations(p); burst('sparkle', p.x, p.y - 0.4, 8, { c: '#ffe08a' }); RW.UI.toast('🪖 ' + U.fullName(p) + ' найнятий на ' + EC.HIRE_DAYS + ' діб (' + c.wage + ' ◎/день)', 'good'); RW.A && RW.A.sfx('coin');
  };
  function leave(g, p, why) { if (p.dead) return; RW.R.fx && RW.R.fx.text(p.x, p.y - 1, '👋', '#ffe08a'); burst('dustpuff', p.x, p.y, 6); RW.Combat.removePawn(p); RW.UI.letter('Найманець пішов', U.fullName(p) + ' ' + why, 'info'); }
  function payrollDaily(g) {
    for (const p of hired(g)) {
      const hh = p.hire; if (g.tick >= hh.until) {
        const fee = Math.round(hh.wage * 5);
        RW.UI.letter('Контракт закінчується', U.fullName(p) + ' (' + hh.spec + ') відпрацював(ла) контракт. Продовжити ще на ' + EC.HIRE_DAYS + ' діб за ' + fee + ' срібла?', 'info', p, null, [
          { label: '✍ Продовжити (' + fee + ' ◎)', fn: () => { if (p.dead || !p.hire) return; if (silverOf() < fee) return RW.UI.toast('Не вистачає срібла', 'bad'); takeItem('silver', fee); p.hire.until = G().tick + EC.HIRE_DAYS * DY; RW.UI.toast('Контракт продовжено', 'good'); } }, { label: 'Відпустити', fn: () => leave(G(), p, 'залишає колонію за завершеним контрактом.') }]);
        hh.until = g.tick + DY * 1.5; hh.ask = 1; continue;
      }
      if (silverOf() >= hh.wage) { takeItem('silver', hh.wage); hh.unpaid = 0; const sp = p; fx2('coin', sp.x, sp.y - 0.6); p.addThought('hired_ok'); }
      else { hh.unpaid++; RW.UI.toast('💸 Нема чим платити ' + U.shortName(p) + '!', 'bad'); if (hh.unpaid >= 2) leave(g, p, 'пішов(ла), не діставши платню.'); }
    }
  }
  RW.Seas && RW.Seas.chips.push(g => { const h = hired(g); if (!h.length) return []; const left = Math.min(...h.map(p => p.hire.until - g.tick)); return [{ k: 'hire', ico: '🪖', t: 'Найманців: ' + h.length + ' · ' + Math.max(0, left / DY).toFixed(1) + ' д', cls: '', pct: Math.max(0, Math.min(1, left / (EC.HIRE_DAYS * DY))), title: 'Щоденна платня ' + h.reduce((a, p) => a + p.hire.wage, 0) + ' ◎' }]; });

  // ======================================================================
  //  15. ПОДІЇ НА КАРТІ СВІТУ
  // ======================================================================
  const WE = {
    plague: { ico: '☣', name: 'Чума', col: '#7ad07a', need: ['medicine', 4], msg: s => 'У «' + s + '» спалахнула чума. Торгівля з ними зупинилась. Можна відправити 4 ліків — це врятує багатьох.' },
    famine: { ico: '🌾', name: 'Голод', col: '#e0b84a', need: ['meal_simple', 20], msg: s => '«' + s + '» голодує. Відправте 20 простих обідів, і вони запам\'ятають це.' },
    festival: { ico: '🎉', name: 'Свято', col: '#e88adf', msg: s => 'У «' + s + '» триває свято — товарів більше, ціни нижчі.' },
    war: { ico: '⚔', name: 'Війна', col: '#e0584a', msg: (s, s2) => '«' + s + '» воює з «' + s2 + '». Зброя й броня дорожчають.' }
  };
  function newWE(g) {
    const e = ex(g), w = W.ensure(g); if (e.we.filter(v => g.tick < v.until).length >= EC.WE_MAX) return; const os = w.settlements.filter(s => s.fac !== 'me' && s.fac !== 'peer');
    const type = U.pick(['plague', 'famine', 'festival', 'war', 'festival']); const a = U.pick(os); let b = null; if (type === 'war') { b = U.pick(os.filter(s => s.fac !== a.fac)); if (!b) return; }
    const days = U.ri(EC.WE_DAYS[0], EC.WE_DAYS[1]); const v = { id: U.nextId(), type, sid: a.id, sid2: b && b.id, start: g.tick, until: g.tick + days * DY, helped: 0 }; e.we.push(v);
    if (type === 'plague') e.ev.push({ id: U.nextId(), cat: 'medicine', mult: 1.5, until: v.until, text: 'Чума: ліки дорогі', ico: '☣' });
    if (type === 'famine') e.ev.push({ id: U.nextId(), cat: 'meal', mult: 1.45, until: v.until, text: 'Голод: їжа дорога', ico: '🌾' });
    if (type === 'festival') e.ev.push({ id: U.nextId(), cat: 'joy', mult: 0.7, until: v.until, text: 'Свято: розваги дешеві', ico: '🎉' });
    if (type === 'war') { e.ev.push({ id: U.nextId(), cat: 'weapon', mult: 1.4, until: v.until, text: 'Війна: зброя дорога', ico: '⚔' }); W.change(a.fac, -3); W.change(b.fac, -3); }
    const T = WE[type]; wlog(T.name + ': «' + a.name + '»' + (b ? ' ↔ «' + b.name + '»' : '') + '.');
    const acts = T.need ? [{ label: '📦 Допомогти (' + T.need[1] + '× ' + itName(T.need[0]) + ')', fn: () => helpWE(v.id) }] : [];
    RW.UI.letter(T.ico + ' ' + T.name + ' на карті світу', T.msg(a.name, b && b.name) + ' (≈' + days + ' діб)', type === 'festival' ? 'good' : 'warn', null, null, acts);
  }
  function helpWE(id) {
    const g = G(), e = ex(g); const v = e.we.find(x => x.id === id); if (!v || g.tick >= v.until || v.helped) return RW.UI.toast('Допомога вже не потрібна', 'info'); const T = WE[v.type]; if (!T.need) return;
    if (stockOf(T.need[0]) < T.need[1]) return RW.UI.toast('Не вистачає: ' + itName(T.need[0]) + ' (' + stockOf(T.need[0]) + '/' + T.need[1] + ')', 'bad');
    takeItem(T.need[0], T.need[1]); v.helped = 1; W.sendCaravan(g, 'me', v.sid, 'weaid', DY * 0.7, { vid: v.id, ico: '🎁' }); RW.UI.toast('🎁 Допомога вирушила', 'good'); RW.A && RW.A.sfx('coin');
  }
  A.ecHelp = el => helpWE(+el.dataset.id);
  function weDaily(g) { const e = ex(g); e.we = e.we.filter(v => g.tick < v.until + DY); if (dayN(g) >= 4 && Math.random() < EC.WE_CH) newWE(g); }
  // прибуття наших караванів
  const arrive0 = W.arrive;
  W.arrive = function (g, c) {
    const e = ex(g);
    if (c.kind === 'orderout') { const o = e.orders.find(x => x.id === c.oid); if (o) { const s = W.ensure(g).settlements.find(x => x.id === o.sid); o.st = 'paid'; o.done = g.tick; if (s) { W.change(s.fac, EC.ORD_GW); wlog('«' + s.name + '» отримало замовлення.'); } W.sendCaravan(g, o.sid, 'me', 'orderback', DY * 0.7, { oid: o.id, rew: o.rew, ico: '💰' }); } return; }
    if (c.kind === 'orderback') { const sp = spot(g); try { g.map.addItem('silver', c.rew, Math.floor(sp.x), Math.floor(sp.y)); } catch (er) { } burst('coin', sp.x + 0.5, sp.y + 0.5, 14); RW.UI.letter('Нагороду доставлено', 'Каравани повернулися з ' + c.rew + ' срібла за виконане замовлення.', 'good', null, { x: sp.x, y: sp.y }); RW.A && RW.A.sfx('coin'); for (const p of cols(g)) p.addThought('fair_deal'); if (g.stats) g.stats.orders = (g.stats.orders || 0) + 1; return; }
    if (c.kind === 'weaid') { const v = e.we.find(x => x.id === c.vid); const s = v && W.ensure(g).settlements.find(x => x.id === v.sid); if (s) { W.change(s.fac, EC.AID_GW); wlog('Допомога дісталась «' + s.name + '»: +' + EC.AID_GW + ' до ставлення.'); RW.UI.toast('💛 «' + s.name + '» вдячне за допомогу (+' + EC.AID_GW + ')', 'good'); } return; }
    return arrive0.apply(this, arguments);
  };
  // чума блокує торгівлю з поселенням
  const wmTrade = A.wmTrade; if (wmTrade) A.wmTrade = function (el) { const g = G(), w = W.ensure(g), e = ex(g); const sid = w.sel; if (e.we.some(v => v.type === 'plague' && v.sid === sid && g.tick < v.until)) return RW.UI.toast('☣ У цьому поселенні чума — торгівля зупинена', 'bad'); return wmTrade.apply(this, arguments); };
  // значки подій і анімована лінія війни на карті
  const html0 = W.html;
  W.html = function () {
    let h = html0.apply(this, arguments); const g = G(), e = ex(g), w = W.ensure(g); let add = '';
    for (const v of e.we) { if (g.tick >= v.until) continue; const a = w.settlements.find(s => s.id === v.sid); if (!a) continue; const T = WE[v.type];
      if (v.type === 'war') { const b = w.settlements.find(s => s.id === v.sid2); if (b) add += '<svg class="wm-line" viewBox="0 0 100 63" preserveAspectRatio="none"><line x1="' + (a.x * 100).toFixed(2) + '" y1="' + (a.y * 63).toFixed(2) + '" x2="' + (b.x * 100).toFixed(2) + '" y2="' + (b.y * 63).toFixed(2) + '" stroke="#e0584a" stroke-width="0.7" stroke-dasharray="1.6 1.2" class="eco-wline"/></svg><span class="eco-badge" style="left:' + (((a.x + b.x) / 2) * 100).toFixed(2) + '%;top:' + (((a.y + b.y) / 2) * 100).toFixed(2) + '%">⚔</span>'; }
      add += '<span class="eco-badge" style="left:' + (a.x * 100 + 2.6).toFixed(2) + '%;top:' + (a.y * 100 - 5).toFixed(2) + '%;--c:' + T.col + '" title="' + T.name + '">' + T.ico + '</span>'; }
    for (const o of e.orders) { if (o.st !== 'open') continue; const a = w.settlements.find(s => s.id === o.sid); if (a) add += '<span class="eco-badge ord" style="left:' + (a.x * 100 - 2.6).toFixed(2) + '%;top:' + (a.y * 100 - 5).toFixed(2) + '%" title="Замовлення">📜</span>'; }
    if (add) h = h.replace('</div><div class="wside">', add + '</div><div class="wside">'); return h;
  };
  RW.UI.addWin('world', { title: 'Світова карта', fn: W.html, cls: 'win-wide' });

  // ======================================================================
  //  ВІКНО «ЕКОНОМІКА»
  // ======================================================================
  EC.tab = 'market';
  A.ecTab = el => { EC.tab = el.dataset.t; };
  const spark = (arr, up) => { if (!arr || arr.length < 2) return ''; const mn = Math.min(...arr), mx = Math.max(...arr), r = Math.max(0.04, mx - mn); const pts = arr.map((v, i) => (i / (arr.length - 1) * 60).toFixed(1) + ',' + (16 - (v - mn) / r * 14).toFixed(1)).join(' '); return '<svg class="eco-sp" viewBox="0 0 60 18"><polyline fill="none" stroke="' + (up ? '#e0584a' : '#7ad07a') + '" stroke-width="1.6" points="' + pts + '"/></svg>'; };
  function htmlMarket(g) {
    const e = ex(g), st = E.colonyStock(); const rows = keys().map(k => { const m = mult(k), h = e.hist[k] || []; const prev = h.length > 1 ? h[h.length - 2] : 1; return { k, m, ch: m - prev, own: st[k] || 0 }; }).filter(r => Math.abs(r.m - 1) > 0.04 || r.own > 0).sort((a, b) => Math.abs(b.m - 1) * (b.own ? 1.4 : 1) - Math.abs(a.m - 1) * (a.own ? 1.4 : 1)).slice(0, 26);
    let h = '<div class="eco-ev">' + (e.ev.filter(v => g.tick < v.until).map(v => '<span class="eco-chip ' + (v.mult > 1 ? 'up' : 'dn') + '">' + v.ico + ' ' + esc(v.text) + ' · ' + Math.ceil((v.until - g.tick) / DY) + ' д</span>').join('') || '<span class="sub">Ринок спокійний. Ціни коливаються за сезоном; великі продажі збивають ціну.</span>') + '</div>';
    h += '<div class="eco-tbl">'; for (const r of rows) { const d = D.items[r.k]; const pc = Math.round((r.m - 1) * 100); h += '<div class="eco-r"><img src="' + RW.UI.itemImg(r.k) + '"><span class="eco-n">' + esc(d.name) + (r.own ? ' <small>(' + r.own + ')</small>' : '') + '</span>' + spark(e.hist[r.k], r.m > 1) + '<b class="' + (pc > 0 ? 'neg' : pc < 0 ? 'pos' : '') + '">' + (pc > 0 ? '▲ +' : pc < 0 ? '▼ ' : '') + pc + '%</b><span class="eco-p">продаж ' + E.sellPrice(r.k).toFixed(1) + ' · купівля ' + E.buyPrice(r.k).toFixed(1) + '</span></div>'; }
    return h + '</div>';
  }
  function htmlOrders(g) {
    const e = ex(g), w = W.ensure(g); const os = e.orders; if (!os.length) return '<p class="sub">Замовлень поки немає. З 3-го дня поселення самі пропонують роботу.</p>';
    return os.map(o => { const s = w.settlements.find(x => x.id === o.sid); const have = stockOf(o.def); const left = Math.max(0, (o.until - g.tick) / DY); const F = s && W.FAC[s.fac];
      const st = o.st === 'open' ? '<button class="btn xs" data-act="ecOrder" data-id="' + o.id + '" ' + (have < o.n ? 'disabled' : '') + '>📦 Відправити</button>' : o.st === 'sent' ? '<span class="sub">📦 у дорозі…</span>' : o.st === 'paid' ? '<span class="pos">✔ виконано</span>' : '<span class="neg">✖ прострочено</span>';
      return '<div class="eco-card"><img src="' + RW.UI.itemImg(o.def) + '"><div class="eco-ci"><b>' + o.n + ' × ' + esc(itName(o.def)) + '</b><div class="sub">' + (F ? F.ico + ' ' : '') + esc(s ? s.name : '?') + ' · на складі ' + have + '/' + o.n + (o.st === 'open' ? ' · ще ' + left.toFixed(1) + ' д' : '') + '</div></div><div class="eco-rw">💰 ' + o.rew + '<br>' + st + '</div></div>'; }).join('');
  }
  function htmlHire(g) {
    const h = ex(g).hire, hs = hired(g); let o = '';
    if (hs.length) { o += '<h4>Ваші найманці</h4>' + hs.map(p => '<div class="eco-card"><div class="eco-ci"><b>' + esc(U.fullName(p)) + '</b><div class="sub">' + esc(p.hire.spec) + ' · платня ' + p.hire.wage + ' ◎/день · ще ' + Math.max(0, (p.hire.until - g.tick) / DY).toFixed(1) + ' д</div></div></div>').join(''); }
    if (dayN(g) < EC.HIRE_FROM) return o + '<p class="sub">Найманці з\'являться з 3-го дня.</p>';
    o += '<h4>Шукають роботу <small>(оновлення через ' + Math.max(0, (h.next - g.tick) / DY).toFixed(1) + ' д)</small></h4>';
    o += h.cands.map((c, i) => { const p = c.p; const top = D.skills.slice().sort((a, b) => p.skills[b].lvl - p.skills[a].lvl).slice(0, 3).map(k => (D.skillIco[k] || '') + ' ' + D.skillNames[k] + ' ' + p.skills[k].lvl).join(' · '); return '<div class="eco-card"><div class="eco-ci"><b>' + esc(U.fullName(p)) + '</b> <span class="eco-chip">' + esc(c.spec) + '</span><div class="sub">' + top + '</div><div class="sub">' + p.traits.map(t => (D.traitById[t] || {}).name).join(', ') + ' · ' + p.age + ' р.</div></div><div class="eco-rw">' + c.fee + ' ◎ + ' + c.wage + '/д<br><button class="btn xs" data-act="ecHire" data-i="' + i + '">🪖 Найняти</button></div></div>'; }).join('') || '<p class="sub">Нікого немає…</p>';
    return o;
  }
  function htmlWorld(g) {
    const e = ex(g), w = W.ensure(g); const list = e.we.filter(v => g.tick < v.until); if (!list.length) return '<p class="sub">На карті світу тихо. Події (чума, голод, свято, війна) з\'являються час від часу.</p>';
    return list.map(v => { const T = WE[v.type]; const a = w.settlements.find(s => s.id === v.sid), b = v.sid2 && w.settlements.find(s => s.id === v.sid2); return '<div class="eco-card" style="--c:' + T.col + '"><span class="eco-ico">' + T.ico + '</span><div class="eco-ci"><b>' + T.name + ': ' + esc(a ? a.name : '?') + (b ? ' ↔ ' + esc(b.name) : '') + '</b><div class="sub">' + esc(T.msg(a ? a.name : '?', b && b.name)) + ' · ще ' + Math.ceil((v.until - g.tick) / DY) + ' д</div></div><div class="eco-rw">' + (T.need && !v.helped ? '<button class="btn xs" data-act="ecHelp" data-id="' + v.id + '" ' + (stockOf(T.need[0]) < T.need[1] ? 'disabled' : '') + '>🎁 ' + T.need[1] + '× ' + esc(itName(T.need[0])) + '</button>' : v.helped ? '<span class="pos">✔ допомога надіслана</span>' : '') + '</div></div>'; }).join('');
  }
  RW.UI.addWin('eco', { title: '💼 Економіка', cls: 'win-wide', fn: function () {
    const g = G(); const tabs = [['market', '📈 Ринок'], ['orders', '📜 Замовлення'], ['hire', '🪖 Найм'], ['world', '🌍 Події']];
    return '<div class="eco"><div class="eco-tabs">' + tabs.map(t => '<button class="btn xs ' + (EC.tab === t[0] ? 'on' : '') + '" data-act="ecTab" data-t="' + t[0] + '">' + t[1] + (t[0] === 'orders' && ex(g).orders.some(o => o.st === 'open') ? ' •' : '') + '</button>').join('') + '<span class="eco-sil">◎ ' + Math.floor(silverOf()) + '</span></div>' + ({ market: htmlMarket, orders: htmlOrders, hire: htmlHire, world: htmlWorld }[EC.tab] || htmlMarket)(g) + '</div>';
  } });
  RW.UI.TABS.splice(RW.UI.TABS.length - 1, 0, { id: 'eco', label: 'Економіка', key: 'I' }); RW.UI.keyWins.KeyI = 'eco';

  // ---------- підключення ----------
  const lt = RW.Life.tick;
  RW.Life.tick = function (g) {
    lt(g);
    try { const t = g.tick; if (t % DY === 900) marketDaily(g); if (t % DY === 1000) ordersDaily(g); if (t % DY === 1100) hireDaily(g); if (t % DY === 1200) payrollDaily(g); if (t % DY === 1300) weDaily(g); } catch (er) { console.error(er); }
  };
  EC._t = { marketDaily, ordersDaily, hireDaily, payrollDaily, weDaily, newOrder, newWE, newCand, ex, hired };
})();
