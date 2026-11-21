'use strict';
// ============================================================
//  ui.js — HUD, архітектор, інспектор, вікна, ввід
// ============================================================
(function () {
  const D = RW.D, U = RW.U, GFX = RW.GFX;
  const UI = RW.UI = {};
  const G = () => RW.G;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  UI.esc = esc;

  UI.tool = null; UI.cat = null; UI.win = {}; UI.tab = 'bio'; UI.keys = {}; UI.mouse = { x: 0, y: 0, tx: 0, ty: 0, down: false, drag: null };
  UI.schedBrush = 'sleep'; UI.trade = { buy: {}, sell: {}, msg: '' }; UI.workHelp = false; UI.stockTab = 'all';
  const cache = {};
  const icoCache = {}; const portraitCache = new Map();
  const dataUrl = (key, fn) => { if (!icoCache[key]) { const c = fn(); icoCache[key] = c.toDataURL(); } return icoCache[key]; };
  UI.clearIcons = () => { for (const k in icoCache) delete icoCache[k]; portraitCache.clear(); };
  UI.itemImg = def => dataUrl('i' + def, () => GFX.itemIcon(def));
  UI.bldImg = def => dataUrl('b' + def, () => {
    const d = D.bld[def];
    if (d.wall) return GFX.wallSprite(def, 0); if (d.door) return GFX.doorSprite(def, true);
    if (d.floor) return GFX.floorTex[D.FLOORS.indexOf(def)][0];
    return GFX.bldSprite(def, d.w, d.h);
  });
    UI.portrait = p => { const k = p.id + ':' + (p.equip.apparel || '') + p.look.shirt; let u = portraitCache.get(k); if (!u) { u = GFX.portrait(p, 44).toDataURL(); portraitCache.set(k, u); } return u; };

  // ============================ Побудова каркасу ============================
  UI.init = function () {
    const root = $('ui');
    root.innerHTML = `
      <div id="topright">
        <div id="timecard"></div>
        <div id="speedbar"></div>
        <div id="alerts"></div>
      </div>
      <div id="colbar"></div>
      <div id="toasts"></div>
      <div id="letters"></div>
      <div id="archbar"></div>
      <div id="inspect" class="panel hidden"></div>
      <div id="bottombar"></div>
      <div id="windows"></div>
      <div id="tooltip" class="hidden"></div>
      <div id="ctxmenu" class="hidden"></div>
      <div id="toolhint" class="hidden"></div>
      <div id="fps" class="hidden"></div>`;
    root.addEventListener('click', onClick);
    root.addEventListener('contextmenu', onCtx);
    root.addEventListener('change', onChange);
    root.addEventListener('input', onInput);
    root.addEventListener('mousedown', onDown);
    root.addEventListener('mouseover', onOver);
    window.addEventListener('mouseup', () => { UI.painting = false; });
    buildBottomBar(); buildSpeedBar();
  };

  UI.show = function (on) { $('ui').classList.toggle('hidden', !on); };

  // ============================ Нижня панель ============================
  const TABS = [
    { id: 'arch', label: 'Архітектор', key: 'B' }, { id: 'work', label: 'Робота', key: 'O' }, { id: 'research', label: 'Дослідження', key: 'T' }, { id: 'sched', label: 'Розклад', key: 'H' },
    { id: 'colony', label: 'Колонія', key: 'C' }, { id: 'history', label: 'Журнал', key: 'J' }, { id: 'help', label: 'Довідка', key: 'F1' }, { id: 'menu', label: 'Меню', key: 'Esc' }
  ];
  function buildBottomBar() {
    $('bottombar').innerHTML = TABS.map(t => `<button class="tabbtn" data-act="tab" data-id="${t.id}" title="${t.label} [${t.key}]">${t.label}</button>`).join('');
  }
  function buildSpeedBar() {
    $('speedbar').innerHTML = [['0', '❚❚', 'Пауза [Пробіл]'], ['1', '▶', 'Звичайна [1]'], ['2', '▶▶', 'Швидка [2]'], ['3', '▶▶▶', 'Дуже швидка [3]'], ['4', '▶▶▶▶', 'Надшвидка [4]']].map(s => `<button class="spd" data-act="speed" data-v="${s[0]}" title="${s[2]}">${s[1]}</button>`).join('');
  }

  // ============================ Обробники подій ============================
  const A = UI.actions = {};
  function onClick(e) {
    const t = e.target.closest('[data-act]'); if (!t) { const dc = e.target.closest('#ctxmenu'); if (!dc) hideCtx(); return; }
    const act = t.dataset.act; if (A[act]) { RW.A && RW.A.init(); RW.A.sfx('click'); A[act](t, e); UI.dirty = true; }
  }
  function onCtx(e) { const t = e.target.closest('[data-ctx]'); if (t && A[t.dataset.ctx]) { e.preventDefault(); A[t.dataset.ctx](t, e); UI.dirty = true; } }
  function onChange(e) { const t = e.target.closest('[data-chg]'); if (t && A[t.dataset.chg]) { A[t.dataset.chg](t, e); UI.dirty = true; } }
  function onInput(e) { const t = e.target.closest('[data-inp]'); if (t && A[t.dataset.inp]) { A[t.dataset.inp](t, e); } }
  function onDown(e) { const t = e.target.closest('[data-down]'); if (t && A[t.dataset.down]) { UI.painting = true; A[t.dataset.down](t, e); UI.dirty = true; } }
  function onOver(e) { if (!UI.painting) return; const t = e.target.closest('[data-over]'); if (t && A[t.dataset.over]) { A[t.dataset.over](t, e); UI.dirty = true; } }

  // ============================ Дії ============================
  A.speed = el => { const g = G(); const v = +el.dataset.v; g.speed = v; };
  A.tab = el => {
    const id = el.dataset.id;
    if (id === 'arch') { UI.cat = UI.cat ? null : 'orders'; UI.tool = null; closeAllWin(); }
    else if (id === 'menu') RW.Menu.showPause();
    else { UI.cat = null; UI.toggleWin(id); }
  };
  A.cat = el => { UI.cat = el.dataset.id; UI.tool = null; };
  A.pickBuild = el => { const def = el.dataset.id; const d = D.bld[def]; if (!RW.Events.unlocked(d)) return; UI.tool = { type: 'build', def, rot: UI.tool && UI.tool.def === def ? UI.tool.rot : 0 }; };
  A.pickDesig = el => { UI.tool = { type: 'desig', kind: el.dataset.kind }; };
  A.pickZone = el => { UI.tool = { type: 'zone', kind: el.dataset.kind }; };
  A.pickZoneErase = el => { UI.tool = { type: 'zoneErase' }; };
  A.closeWin = el => UI.closeWin(el.dataset.id);
  A.selPawn = el => { const p = G().pawns.find(x => x.id === +el.dataset.id); if (p) { UI.select({ p }); R().focus(p.x, p.y); } };
  A.focusPawn = el => { const p = G().pawns.find(x => x.id === +el.dataset.id); if (p) { UI.select({ p }); R().focus(p.x, p.y, Math.max(R().cam.zoom, 1.5)); } };
  const R = () => RW.R;
  A.itab = el => { UI.tab = el.dataset.id; };
  A.draft = el => { const p = UI.selPawn(); if (p) UI.toggleDraft(p); };
  A.dropWeapon = () => { const p = UI.selPawn(); if (p && p.equip.weapon) { G().map.addItem(p.equip.weapon, 1, p.tx, p.ty); p.equip.weapon = null; } };
  A.prost = el => { const p = UI.selPawn(); if (p && RW.Health) RW.Health.order(p, el.dataset.a, el.dataset.b); };
  A.dropApparel = () => { const p = UI.selPawn(); if (p && p.equip.apparel) { G().map.addItem(p.equip.apparel, 1, p.tx, p.ty); p.equip.apparel = null; } };
  A.pawnWork = el => { const p = G().pawns.find(x => x.id === +el.dataset.p); if (!p || !p.canDo(el.dataset.w)) return; p.work[el.dataset.w] = ((p.work[el.dataset.w] || 0) + 1) % 5; };
  A.pawnWorkDec = el => { const p = G().pawns.find(x => x.id === +el.dataset.p); if (!p || !p.canDo(el.dataset.w)) return; p.work[el.dataset.w] = ((p.work[el.dataset.w] || 0) + 4) % 5; };
  A.schedBrush = el => { UI.schedBrush = el.dataset.v; };
  A.schedPaint = el => { const p = G().pawns.find(x => x.id === +el.dataset.p); if (p) p.sched[+el.dataset.h] = UI.schedBrush; };
  A.schedAll = el => { const p = G().pawns.find(x => x.id === +el.dataset.p); if (p) for (let h = 0; h < 24; h++) p.sched[h] = UI.schedBrush; };
  A.schedCopy = el => { const g = G(); const src = g.pawns.find(x => x.id === +el.dataset.p); if (src) for (const p of g.pawns) if (p.faction === 'colony') p.sched = src.sched.slice(); UI.toast('Розклад скопійовано всім колоністам', 'good'); };
  A.researchNow = el => { if (RW.Events.setResearchNow(el.dataset.id)) { RW.A.sfx('ui'); } else UI.toast('Спершу потрібні попередні дослідження', 'bad'); };
  A.researchQueue = el => { RW.Events.queueResearch(el.dataset.id); };
  A.researchCancel = el => { const rs = G().research; rs.queue = rs.queue.filter(x => x !== el.dataset.id); rs.current = rs.queue[0] || null; };
  A.addBill = el => { const b = UI.selBld(); if (!b || !el.value) return; b.bills.push({ recipe: el.value, mode: 'count', left: 1, n: 5, paused: false, done: 0 }); el.value = ''; };
  A.billMode = el => { const b = UI.selBld(); const bill = b && b.bills[+el.dataset.i]; if (!bill) return; bill.mode = bill.mode === 'count' ? 'forever' : bill.mode === 'forever' ? 'until' : 'count'; if (bill.mode === 'count') bill.left = Math.max(1, bill.left || 1); };
  A.billAdj = el => { const b = UI.selBld(); const bill = b && b.bills[+el.dataset.i]; if (!bill) return; const d = +el.dataset.d; if (bill.mode === 'count') bill.left = Math.max(0, bill.left + d); else if (bill.mode === 'until') bill.n = Math.max(0, bill.n + d); };
  A.billPause = el => { const b = UI.selBld(); const bill = b && b.bills[+el.dataset.i]; if (bill) bill.paused = !bill.paused; };
  A.billDel = el => { const b = UI.selBld(); if (b) b.bills.splice(+el.dataset.i, 1); };
  A.billUp = el => { const b = UI.selBld(); const i = +el.dataset.i; if (b && i > 0) { const t = b.bills[i]; b.bills[i] = b.bills[i - 1]; b.bills[i - 1] = t; } };
  A.deconBld = () => { const b = UI.selBld(); if (b) { b.decon = !b.decon; if (!b.decon) b.dprog = 0; } };
  A.cancelBp = () => { const s = G().sel; if (s && s.bp) { const bp = s.bp; for (const k in bp.have) G().map.addItem(k, bp.have[k], bp.x, bp.y); G().map.removeBlueprint(bp); UI.select(null); } };
  A.assignBed = el => { const b = UI.selBld(); if (!b) return; const id = el.value === '' ? null : +el.value; const g = G(); if (b.owner != null) { const o = g.pawns.find(p => p.id === b.owner); if (o && o.bed === b) o.bed = null; } b.owner = id; if (id != null) { const p = g.pawns.find(x => x.id === id); if (p) { if (p.bed && p.bed !== b) p.bed.owner = null; p.bed = b; } } };
  A.refuelNote = () => UI.toast('Колоністи заправлять автоматично, якщо є деревина.', 'info');
  A.forbid = () => { const s = G().sel; if (s && s.item) s.item.forbid = !s.item.forbid; };
  A.huntAnimal = () => { const s = G().sel; if (s && s.a) { s.a.hunt = !s.a.hunt; UI.toast(s.a.hunt ? 'Призначено полювання' : 'Полювання скасовано', 'info'); } };
  A.desigPlant = el => { const s = G().sel; if (s && s.pl) { const i = s.pl.y * G().map.w + s.pl.x; const m = G().map; if (m.desig.get(i) === el.dataset.kind) m.desig.delete(i); else m.desig.set(i, el.dataset.kind); } };
  A.zoneCrop = el => { const z = UI.selZone(); if (z) z.crop = el.value; };
  A.zoneFert = el => { const z = UI.selZone(); if (z) z.fert = el.checked; };
  A.zoneCull = el => { const z = UI.selZone(); if (z) z.cull = el.checked; };
  A.zoneSow = el => { const z = UI.selZone(); if (z) z.sow = el.checked; };
  A.zonePrio = el => { const z = UI.selZone(); if (z) z.priority = +el.value || +el.dataset.v || 0; };
  A.zoneName = el => { const z = UI.selZone(); if (z) z.name = el.value.slice(0, 24); };
  const PRESETS = { food: ['rawfood', 'meal', 'herb'], arms: ['weapon', 'apparel'], med: ['medicine', 'herb'], res: ['resource', 'chunk', 'currency'] };
  A.zonePreset = el => { const z = UI.selZone(); if (!z) return; const p = el.dataset.id; for (const k in D.items) { if (D.items[k].cat === 'corpse') continue; z.filter[k] = p === 'all' ? true : PRESETS[p].includes(D.items[k].cat); } z.preset = p; };
  A.zoneDel = () => { const z = UI.selZone(); if (!z) return; const m = G().map; for (const i of z.cells) m.zoneAt[i] = null; m.zones.splice(m.zones.indexOf(z), 1); UI.select(null); };
  A.zoneFilterCat = el => { const z = UI.selZone(); if (!z) return; const cat = el.dataset.cat; const on = el.checked; for (const k in D.items) if (D.items[k].cat === cat) z.filter[k] = on; };
  A.zoneFilterItem = el => { const z = UI.selZone(); if (z) z.filter[el.dataset.id] = el.checked; };
  A.zoneFilterAll = el => { const z = UI.selZone(); if (!z) return; const on = el.dataset.v === '1'; for (const k in D.items) if (D.items[k].cat !== 'corpse') z.filter[k] = on; };
  A.launchShip = () => { const b = UI.selBld(); if (!b || !b.def.ship) return; if (confirm('Запустити двигун і залишити планету? Гру буде завершено перемогою.')) { RW.Menu.victory(); } };
  A.tradeOpen = el => { UI.trade = { buy: {}, sell: {}, msg: '' }; UI.openWin('trade'); };
  A.tradeAdj = el => {
    const side = el.dataset.side, def = el.dataset.def, d = +el.dataset.d; const T = UI.trade[side]; const g = G();
    const max = side === 'buy' ? (g.trader.stock[def] || 0) : (RW.Events.colonyStock()[def] || 0);
    T[def] = U.clamp((T[def] || 0) + d, 0, max); if (!T[def]) delete T[def];
  };
  A.tradeDo = () => { const r = RW.Events.executeTrade(UI.trade.buy, UI.trade.sell); if (r) { UI.trade.msg = r; UI.toast(r, 'bad'); } else { UI.trade = { buy: {}, sell: {}, msg: 'Угоду укладено!' }; UI.toast('Угоду укладено', 'good'); } };
  A.tradeClear = () => { UI.trade = { buy: {}, sell: {}, msg: '' }; };
  A.letterOpen = el => { const g = G(); const i = +el.dataset.i; const L = g.letters[i]; if (L) UI.showLetter(L, i); };
  A.letterClose = el => { const g = G(); const i = +el.dataset.i; g.letters.splice(i, 1); UI.closeWin('letter'); };
  A.letterGo = el => { const g = G(); const i = +el.dataset.i; const L = g.letters[i]; if (L) { if (L.pawn && g.pawns.includes(L.pawn)) { UI.select({ p: L.pawn }); R().focus(L.pawn.x, L.pawn.y, 1.4); } else if (L.pos) R().focus(L.pos.x, L.pos.y, 1.2); } };
  A.letterAct = el => { const g = G(); const i = +el.dataset.i; const L = g.letters[i]; if (L && L.actions && L.actions[+el.dataset.a]) { L.actions[+el.dataset.a].fn(); } g.letters.splice(i, 1); UI.closeWin('letter'); };
  A.alertGo = el => { const g = G(); const a = UI.alerts[+el.dataset.i]; if (!a) return; if (a.p && g.pawns.includes(a.p)) { UI.select({ p: a.p }); R().focus(a.p.x, a.p.y, 1.4); } else if (a.pos) R().focus(a.pos.x, a.pos.y, 1.3); };
  A.ctxDo = el => { const f = UI.ctxFns[+el.dataset.i]; hideCtx(); if (f) f(); };
  A.hint = el => { el.parentElement.remove(); };
  A.openSettings = () => RW.Menu.showSettings(true);
  A.colonyTab = el => { UI.colonyTab = el.dataset.id; };
  A.locate = el => { const g = G(); const def = el.dataset.def; const it = g.map.findItem(def, g.home.x, g.home.y, null, 9999); if (it) R().focus(it.i % g.map.w, (it.i / g.map.w) | 0, 1.6); };
  A.selBld2 = el => { const b = G().map.buildings.find(x => x.id === +el.dataset.id); if (b) { UI.select({ b }); R().focus(b.x + b.w / 2, b.y + b.h / 2); } };
  A.timeTable = () => { };

  // ============================ Допоміжні ============================
  UI.selPawn = () => { const s = G() && G().sel; return s && s.p && G().pawns.includes(s.p) ? s.p : null; };
  UI.selBld = () => { const s = G() && G().sel; return s && s.b && !s.b.dead ? s.b : null; };
  UI.selZone = () => { const s = G() && G().sel; return s && s.z && G().map.zones.includes(s.z) ? s.z : null; };
  UI.select = function (o) { const g = G(); g.sel = o; UI.dirty = true; UI.tab = o && o.p ? (UI.tab === 'bio' || true ? UI.tab : 'bio') : UI.tab; if (o && o.p && !['bio', 'needs', 'health', 'gear', 'social', 'log'].includes(UI.tab)) UI.tab = 'needs'; };
  UI.toggleDraft = function (p) {
    if (p.faction !== 'colony' || p.downed) return;
    if (p.noViolence) { UI.toast(U.shortName(p) + ' не може воювати', 'bad'); return; }
    p.drafted = !p.drafted; if (p.drafted) { RW.AI.endJob(p); p.orderPos = null; RW.A.sfx('ui'); } else { p.orderPos = null; p.target = null; }
  };

  UI.toast = function (text, kind) {
    const g = G(); const box = $('toasts'); if (!box) return;
    const d = document.createElement('div'); d.className = 'toast ' + (kind || 'info'); d.textContent = text; box.appendChild(d);
    while (box.children.length > 6) box.removeChild(box.firstChild);
    setTimeout(() => { d.classList.add('fade'); setTimeout(() => d.remove(), 800); }, 4800);
  };
  UI.log = function (text) {
    const g = G(); if (g) { g.history.unshift({ t: g.tick, s: text, k: 'info' }); if (g.history.length > 300) g.history.pop(); }
    UI.toast(text, 'info');
  };
  UI.letter = function (title, text, kind, pawn, pos, actions) {
    const g = G(); if (!g) return;
    const L = { title, text, kind: kind || 'info', pawn: pawn || null, pos: pos || null, actions: actions || null, t: g.tick };
    g.letters.push(L); if (g.letters.length > 12) g.letters.shift();
    g.history.unshift({ t: g.tick, s: title + ': ' + text, k: kind || 'info' }); if (g.history.length > 300) g.history.pop();
    RW.A && RW.A.sfx(kind === 'bad' ? 'bad' : (kind === 'good' ? 'good' : 'letter'));
    if (RW.S.game.pauseOnLetter && (kind === 'bad' || actions)) { g.speed = 0; }
    if (kind === 'bad' && RW.A) RW.A.tension(true);
  };
  UI.showLetter = function (L, i) {
    const acts = (L.actions || []).map((a, k) => `<button class="btn" data-act="letterAct" data-i="${i}" data-a="${k}">▶ ${esc(a.label)}</button>`).join('');
    const go = (L.pawn || L.pos) ? `<button class="btn" data-act="letterGo" data-i="${i}">📍 Показати</button>` : '';
    UI.openWinHtml('letter', RW.ICO.letter(L) + ' ' + L.title, `<div class="letter-body ${L.kind}"><div class="lt-ico">${RW.ICO.letter(L)}</div><p>${esc(L.text)}</p><div class="btnrow">${acts}${go}<button class="btn" data-act="letterClose" data-i="${i}">${L.actions ? '⏳ Пізніше' : '✖ Закрити'}</button></div></div>`, 'win-small');
  };

  // ============================ Вікна ============================
  const WINS = {
    work: { title: 'Робота', fn: workHtml, cls: 'win-wide' }, research: { title: 'Дослідження', fn: researchHtml, cls: 'win-wide' }, sched: { title: 'Розклад дня', fn: schedHtml, cls: 'win-wide' },
    colony: { title: 'Колонія', fn: colonyHtml, cls: 'win-wide' }, history: { title: 'Журнал подій', fn: historyHtml, cls: '' }, help: { title: 'Довідка', fn: helpHtml, cls: 'win-wide' }, trade: { title: 'Торгівля', fn: tradeHtml, cls: 'win-wide' }
  };
  UI.addWin = (id, o) => { WINS[id] = o; }; UI.TABS = TABS; UI.keyWins = {}; UI.esc = esc;
  UI.openWin = function (id) { if (!WINS[id]) return; if (id === 'trade' && !G().trader) return; closeAllWin(id); UI.win[id] = true; UI.renderWin(id, true); };
  UI.toggleWin = function (id) { if (UI.win[id]) UI.closeWin(id); else UI.openWin(id); };
  function closeAllWin(except) { for (const k of Object.keys(UI.win)) if (k !== except) UI.closeWin(k); }
  UI.closeWin = function (id) { UI.win[id] = false; const e = $('win-' + id); if (e) e.remove(); delete cache['win-' + id]; };
  UI.openWinHtml = function (id, title, html, cls) {
    UI.win[id] = true; let e = $('win-' + id);
    if (!e) { e = document.createElement('div'); e.id = 'win-' + id; $('windows').appendChild(e); }
    e.className = 'win panel ' + (cls || ''); e.innerHTML = `<div class="wintitle">${esc(title)}<button class="x" data-act="closeWin" data-id="${id}">✕</button></div><div class="winbody">${html}</div>`;
  };
  UI.renderWin = function (id, force) {
    const w = WINS[id]; if (!w) return; let e = $('win-' + id);
    let html; try { html = w.fn(); } catch (err) { html = '<p>Помилка: ' + esc(err.message) + '</p>'; console.error(err); }
    if (!e) { e = document.createElement('div'); e.id = 'win-' + id; e.className = 'win panel ' + w.cls; e.innerHTML = `<div class="wintitle">${(RW.ICO.win[id] || '') + ' '}${esc(w.title)}<button class="x" data-act="closeWin" data-id="${id}">✕</button></div><div class="winbody" id="wb-${id}"></div>`; $('windows').appendChild(e); }
    const body = $('wb-' + id); if (!body) return;
    if (cache['win-' + id] !== html) { const sc = body.scrollTop; body.innerHTML = html; body.scrollTop = sc; cache['win-' + id] = html; }
  };

  function pawnsC() { return G().pawns.filter(p => p.faction === 'colony'); }
  function workHtml() {
    const ps = pawnsC();
    let h = '<p class="hint">Клік — збільшити пріоритет (1 — найвищий, «—» — вимкнено), правий клік — зменшити. Колоністи беруться за роботи з найменшим числом першими.</p><table class="tbl"><tr><th>Колоніст</th>' + D.workTypes.map(w => `<th>${w.name}</th>`).join('') + '</tr>';
    for (const p of ps) {
      h += `<tr><td class="nm" data-act="selPawn" data-id="${p.id}">${esc(U.shortName(p))}</td>`;
      for (const w of D.workTypes) {
        const ok = p.canDo(w.id); const v = p.work[w.id] || 0; const sk = w.skill ? p.skillLvl(w.skill) : '';
        h += ok ? `<td><div class="wcell p${v}" data-act="pawnWork" data-ctx="pawnWorkDec" data-p="${p.id}" data-w="${w.id}" title="${w.name} — 1 = найвищий пріоритет, 4 = найнижчий, — = вимкнено${sk !== '' ? ' (рівень ' + sk + ')' : ''}">${v || '—'}${sk !== '' ? '<small>' + sk + '</small>' : ''}</div></td>` : '<td><div class="wcell dis" title="Заборонено біографією">✕</div></td>';
      }
      h += '</tr>';
    }
    return h + '</table>';
  }
  function researchHtml() {
    const g = G(), rs = g.research; let h = '';
    const hasBench = g.map.buildings.some(b => b.def.research_bench);
    h += `<p class="hint">${hasBench ? '' : '⚠ Збудуйте дослідницький стіл (Архітектор → Виробництво). '}Дослідники працюють, коли дослідження обрано, а пріоритет «Дослідження» ввімкнено.</p>`;
    h += '<div class="rgrid">';
    for (const id of Object.keys(D.research)) {
      const r = D.research[id]; const done = rs.done.has(id), can = RW.Events.canResearch(id), cur = rs.current === id; const pr = (rs.progress[id] || 0);
      const q = rs.queue.indexOf(id);
      h += `<div class="rcard ${done ? 'done' : ''} ${cur ? 'cur' : ''} ${!can && !done ? 'locked' : ''}"><div class="rt">${esc(r.name)}${done ? ' ✔' : ''}</div><div class="rd">${esc(r.desc)}</div>`;
      if (r.req.length) h += `<div class="rr">Потрібно: ${r.req.map(x => (rs.done.has(x) ? '✔ ' : '✖ ') + esc(D.research[x].name)).join(', ')}</div>`;
      if (!done) {
        h += `<div class="bar"><i style="width:${Math.min(100, pr / r.cost * 100).toFixed(1)}%"></i><span>${Math.floor(pr)} / ${r.cost}</span></div>`;
        h += `<div class="btnrow">` + (cur ? `<button class="btn sm" data-act="researchCancel" data-id="${id}">Скасувати</button>` : `<button class="btn sm" data-act="researchNow" data-id="${id}" ${can ? '' : 'disabled'}>Досліджувати</button><button class="btn sm" data-act="researchQueue" data-id="${id}">${q >= 0 ? 'У черзі №' + (q + 1) : 'У чергу'}</button>`) + '</div>';
      }
      h += '</div>';
    }
    return h + '</div>';
  }
  function schedHtml() {
    const ps = pawnsC(); const B = { sleep: ['Сон', '#3a4a8a'], work: ['Робота', '#4a8a4a'], any: ['Будь-що', '#6a6a6a'], joy: ['Розваги', '#a8884a'] };
    let h = '<div class="btnrow">Пензель: ' + Object.keys(B).map(k => `<button class="btn sm ${UI.schedBrush === k ? 'on' : ''}" data-act="schedBrush" data-v="${k}" style="border-left:6px solid ${B[k][1]}">${B[k][0]}</button>`).join('') + '</div>';
    h += '<table class="tbl sched"><tr><th></th>' + [...Array(24).keys()].map(i => `<th>${i}</th>`).join('') + '<th></th></tr>';
    const hr = D.hour(G().tick);
    for (const p of ps) {
      h += `<tr><td class="nm" data-act="selPawn" data-id="${p.id}">${esc(U.shortName(p))}</td>`;
      for (let i = 0; i < 24; i++) h += `<td><div class="sc ${i === hr ? 'now' : ''}" data-down="schedPaint" data-over="schedPaint" data-p="${p.id}" data-h="${i}" style="background:${B[p.sched[i]][1]}" title="${B[p.sched[i]][0]}"></div></td>`;
      h += `<td><button class="btn xs" data-act="schedAll" data-p="${p.id}" title="Весь день цим пензлем">∀</button><button class="btn xs" data-act="schedCopy" data-p="${p.id}" title="Копіювати цей розклад усім">⇉</button></td></tr>`;
    }
    return h + '</table><p class="hint">Тягніть мишею, щоб малювати. У годину «Сон» колоністи йдуть спати, в «Розваги» — відпочивають, у «Будь-що» — працюють за потреби.</p>';
  }
  function colonyHtml() {
    const g = G(); const tab = UI.colonyTab || 'overview'; const w = g.wealth || { items: 0, bld: 0, pawns: 0, total: 0 };
    let h = '<div class="tabs">' + [['overview', 'Огляд'], ['inv', 'Інвентар'], ['pawns', 'Колоністи']].map(t => `<button class="tab ${tab === t[0] ? 'on' : ''}" data-act="colonyTab" data-id="${t[0]}">${t[1]}</button>`).join('') + '</div>';
    if (tab === 'overview') {
      const day = D.relDay(g.tick) + 1; const cols = pawnsC();
      h += `<div class="grid2"><div><h4>Багатство колонії</h4><table class="tbl2"><tr><td>Предмети</td><td>${w.items}</td></tr><tr><td>Будівлі</td><td>${w.bld}</td></tr><tr><td>Колоністи</td><td>${w.pawns}</td></tr><tr class="tot"><td>Усього</td><td>${w.total}</td></tr></table>
        <h4>Статистика</h4><table class="tbl2"><tr><td>День</td><td>${day}</td></tr><tr><td>Колоністів</td><td>${cols.length}</td></tr><tr><td>Побудовано</td><td>${g.stats.built}</td></tr><tr><td>Виготовлено</td><td>${g.stats.crafted}</td></tr><tr><td>Зібрано врожаю</td><td>${g.stats.harvested}</td></tr><tr><td>Знищено ворогів</td><td>${g.stats.kills}</td></tr><tr><td>Відбито рейдів</td><td>${g.stats.raids}</td></tr><tr><td>Угод з торговцями</td><td>${g.stats.trades}</td></tr></table></div>
        <div>${RW.Cooking ? RW.Cooking.panel() : ''}<h4>Умови</h4><table class="tbl2"><tr><td>Сценарій</td><td>${esc(g.scenario.name)}</td></tr><tr><td>Складність</td><td>${esc(g.diff.name)}</td></tr><tr><td>Оповідач</td><td>${esc((D.storytellers.find(s => s.id === g.storyteller) || {}).name)}</td></tr><tr><td>Біом</td><td>${esc(D.biomes[g.biome].name)}</td></tr><tr><td>Зовнішня температура</td><td>${U.fmt(g.outTemp, 1)}°C</td></tr><tr><td>Погода</td><td>${weatherName(g.weather.type)}</td></tr>
        <tr><td>Енергомережа</td><td>${powerText(g)}</td></tr><tr><td>Дослідження</td><td>${g.research.done.size} / ${Object.keys(D.research).length}</td></tr></table></div></div>`;
    } else if (tab === 'inv') {
      const stock = RW.Events.colonyStock(); const cats = {};
      for (const k in stock) { const c = D.items[k].cat; (cats[c] = cats[c] || []).push(k); }
      h += '<div class="invgrid">';
      for (const c of Object.keys(D.itemCats)) { if (!cats[c]) continue; h += `<div class="invcat"><h4>${D.itemCats[c]}</h4>` + cats[c].map(k => `<div class="invrow" data-act="locate" data-def="${k}" title="Показати на карті"><img src="${UI.itemImg(k)}"><span>${D.items[k].name}</span><b>${stock[k]}</b></div>`).join('') + '</div>'; }
      if (!Object.keys(stock).length) h += '<p>Колонія поки що порожня.</p>';
      h += '</div>';
    } else {
      h += '<table class="tbl"><tr><th>Колоніст</th><th>Вік</th><th>Настрій</th><th>Здоров\'я</th><th>Заняття</th><th>Спорядження</th></tr>';
      for (const p of pawnsC()) h += `<tr><td class="nm" data-act="focusPawn" data-id="${p.id}">${esc(U.fullName(p))}</td><td>${p.age}</td><td><div class="minibar"><i style="width:${p.mood}%;background:${U.moodColor(p.mood)}"></i></div></td><td>${Math.round(p.blood * 100 * (1 - Math.min(0.9, p.pain * 0.5)))}%</td><td>${esc(RW.AI.jobLabel(p))}</td><td>${p.equip.weapon ? D.items[p.equip.weapon].name : '—'}${p.equip.apparel ? ' / ' + D.items[p.equip.apparel].name : ''}</td></tr>`;
      h += '</table>';
    }
    return h;
  }
  const weatherName = t => ({ clear: 'Ясно', cloudy: 'Хмарно', rain: 'Дощ', storm: 'Гроза', snow: 'Сніг', fog: 'Туман' }[t] || t);
  function powerText(g) { const nets = g.map.networks; if (!nets.length) return 'немає'; let prod = 0, cons = 0, st = 0; for (const n of nets) { prod += n.prod; cons += n.cons; st += n.stored; } return `+${Math.round(prod)} / −${Math.round(cons)} Вт, батареї ${Math.round(st)}`; }
  function historyHtml() {
    const g = G(); let h = '<div class="hist">';
    for (const e of g.history.slice(0, 120)) h += `<div class="he ${e.k}"><span class="ht">День ${D.relDay(e.t) + 1}, ${RW.Events.timeString(e.t)}</span> ${esc(e.s)}</div>`;
    return h + (g.history.length ? '' : '<p>Подій ще не було.</p>') + '</div>';
  }
  function helpHtml() {
    return `<div class="help">
      <h4>Керування камерою</h4><p><b>WASD / стрілки</b> — рух, <b>колесо миші</b> — масштаб, <b>середня кнопка</b> — перетягнути, край екрана — прокрутка.</p>
      <h4>Час</h4><p><b>Пробіл</b> — пауза. <b>1–4</b> — швидкість. Гра ставиться на паузу при поганих подіях (можна вимкнути в налаштуваннях).</p>
      <h4>Колоністи</h4><p><b>Клік</b> — вибір. <b>R</b> — призвати/відпустити. Призваного колоніста наказуємо <b>правою кнопкою</b>: ідти чи атакувати. Непризваних правий клік відкриває меню дій.</p>
      <h4>Початок гри</h4><ol><li>Накази → <b>Рубка</b>: позначте дерева для деревини, <b>Видобуток</b>: скелі для каменю й руди.</li><li>Зони → <b>Склад</b>: накрийте площу поруч — колоністи складуватимуть туди все.</li><li>Зони → <b>Вирощування</b> на родючому ґрунті; оберіть культуру.</li><li>Структури: стіни, двері, підлога. Меблі: ліжка, стіл. Виробництво: стіл дослідження, плита (додайте завдання «Простий обід»).</li><li>Вогнище та смолоскипи треба заправляти деревиною.</li><li>Стежте за настроєм: їжа, сон, розваги, краса, температура.</li><li>Готуйтесь до рейдів: стіни, укриття (мішки з піском), зброя, турелі.</li></ol>
      <h4>Мета</h4><p>Виживіть, розвивайтесь і дослідіть «Міжзоряний політ». Збудуйте <b>двигун корабля</b> й запустіть його, щоб залишити планету.</p>
      <h4>Гарячі клавіші</h4><p>B Архітектор · W Робота · T Дослідження · H Розклад · C Колонія · J Журнал · Q/E поворот будівлі · F заборонити предмет · Del скасувати вибір · Ctrl+S швидке збереження · Esc меню</p></div>`;
  }
  function tradeHtml() {
    const g = G(); const tr = g.trader; if (!tr) return '<p>Торговець пішов.</p>';
    const stock = RW.Events.colonyStock(); const T = UI.trade; const E = RW.Events;
    let cost = 0, gain = 0; for (const k in T.buy) cost += E.buyPrice(k) * T.buy[k]; for (const k in T.sell) gain += E.sellPrice(k) * T.sell[k];
    const net = gain - cost;
    const row = (k, side, have) => {
      const sel = (side === 'buy' ? T.buy[k] : T.sell[k]) || 0; const price = side === 'buy' ? E.buyPrice(k) : E.sellPrice(k);
      return `<div class="trow ${sel ? 'sel' : ''}"><img src="${UI.itemImg(k)}"><span class="tn">${D.items[k].name}</span><span class="tc">${have}</span><span class="tp">${price.toFixed(1)}</span>
        <button class="btn xs" data-act="tradeAdj" data-side="${side}" data-def="${k}" data-d="-10">−10</button><button class="btn xs" data-act="tradeAdj" data-side="${side}" data-def="${k}" data-d="-1">−</button><b class="tsel">${sel}</b><button class="btn xs" data-act="tradeAdj" data-side="${side}" data-def="${k}" data-d="1">+</button><button class="btn xs" data-act="tradeAdj" data-side="${side}" data-def="${k}" data-d="10">+10</button></div>`;
    };
    let h = (RW.Traders ? RW.Traders.header(tr) : '') + `<p>Торговець: <b>${esc(tr.name)}</b> · срібла у нього: <b>${Math.floor(tr.silver)}</b> · ваше срібло: <b>${stock.silver || 0}</b> · переговорник (Спілкування): ${E.negotiator()}</p><div class="grid2"><div><h4>Колонія продає</h4><div class="tlist">`;
    for (const k of Object.keys(stock).filter(k => k !== 'silver').sort()) h += row(k, 'sell', stock[k]);
    h += `</div></div><div><h4>Колонія купує</h4><div class="tlist">`;
    for (const k of Object.keys(tr.stock).sort()) h += row(k, 'buy', tr.stock[k]);
    h += `</div></div></div><div class="tfoot"><span>Витрати: <b>${cost.toFixed(0)}</b> · Виручка: <b>${gain.toFixed(0)}</b> · Баланс: <b class="${net >= 0 ? 'pos' : 'neg'}">${net >= 0 ? '+' : ''}${net.toFixed(0)} срібла</b></span><button class="btn" data-act="tradeDo" ${Object.keys(T.buy).length + Object.keys(T.sell).length ? '' : 'disabled'}>Підтвердити угоду</button><button class="btn" data-act="tradeClear">Скинути</button><span class="neg">${esc(T.msg || '')}</span></div>`;
    return h;
  }

  // ============================ Верхня панель ============================
  function timeCard() {
    const g = G(); const day = D.relDay(g.tick) + 1; const s = D.seasonOf(g.tick); const dd = (D.dayNum(g.tick) % D.SEASON_DAYS) + 1;
    const wI = { clear: '☀', cloudy: '☁', rain: '🌧', storm: '⛈', snow: '❄', fog: '🌫' }[g.weather.type];
    const tt = g.outTemp; const col = tt < 0 ? '#8fc4ff' : tt > 32 ? '#ff9a70' : '#e8eef2';
    return `<div class="tc1"><b>${RW.Events.timeString(g.tick)}</b> · ${D.SEASONS[s]}, ${dd}-й день · день ${day}</div><div class="tc2"><span style="color:${col}">${U.fmt(tt, 0)}°C</span> ${wI} ${weatherName(g.weather.type)}${g.tempOffset && g.tick < g.tempOffset.until ? (g.tempOffset.v < 0 ? ' · <span style="color:#8fc4ff">холоди</span>' : ' · <span style="color:#ff9a70">спека</span>') : ''}${g.flare ? ' · <span style="color:#ff9">спалах</span>' : ''}</div>`;
  }
  function colbarHtml() {
    const g = G(); let h = '';
    for (const p of pawnsC()) {
      const sel = g.sel && g.sel.p === p; const m = Math.round(p.mood);
      const st = p.mental ? 'mental' : p.downed ? 'downed' : p.drafted ? 'drafted' : p.sleeping ? 'sleep' : '';
      h += `<div class="col ${sel ? 'sel' : ''} ${st}" data-act="focusPawn" data-id="${p.id}" title="${esc(U.fullName(p))} — ${esc(RW.AI.jobLabel(p))}, настрій ${m}%"><img src="${UI.portrait(p)}"><div class="mb"><i style="width:${m}%;background:${U.moodColor(m)}"></i></div><div class="cn">${esc(U.shortName(p))}</div></div>`;
    }
    return h;
  }

  // ============================ Алерти ============================
  UI.alerts = [];
  function computeAlerts() {
    const g = G(), map = g.map; const out = []; const cols = pawnsC();
    const hungry = cols.filter(p => p.needs.food < 0.2);
    if (hungry.length) out.push({ t: 'Голодні колоністи: ' + hungry.map(p => U.shortName(p)).join(', '), c: 'bad', p: hungry[0] });
    const food = map.count('meal_simple') + map.count('meal_fine') + ['rice', 'potato', 'corn', 'berries', 'meat'].reduce((a, k) => a + map.count(k), 0);
    if (cols.length && food < cols.length * 3) out.push({ t: 'Мало їжі (' + food + ')', c: 'warn' });
    const idle = cols.filter(p => !p.job && !p.downed && !p.drafted && !p.mental && p.idleT > 200 && !p.combatTarget);
    if (idle.length) out.push({ t: 'Бездіяльні колоністи: ' + idle.length, c: 'info', p: idle[0] });
    const hurt = cols.filter(p => AI().patientNeeds(p) != null);
    if (hurt.length) out.push({ t: 'Потребують лікування: ' + hurt.map(p => U.shortName(p)).join(', '), c: 'bad', p: hurt[0] });
    const beds = map.buildings.filter(b => b.def.bed && !b.def.bed.med).length;
    if (cols.length > beds) out.push({ t: 'Бракує ліжок: ' + (cols.length - beds), c: 'warn' });
    const miss = map.blueprints.find(b => b.missing);
    if (miss) out.push({ t: 'Бракує матеріалів: ' + D.items[miss.missing].name, c: 'warn', pos: { x: miss.x, y: miss.y } });
    if (!g.research.current && g.map.buildings.some(b => b.def.research_bench) && g.research.done.size < Object.keys(D.research).length) out.push({ t: 'Не обрано дослідження', c: 'info' });
    const low = map.buildings.find(b => b.def.fuel && b.fuel < 1 && b.def.id !== 'wood_gen');
    if (low) out.push({ t: 'Без палива: ' + low.def.name, c: 'warn', pos: { x: low.x, y: low.y } });
    const cold = cols.filter(p => p.env && p.env.cold > 12); if (cold.length) out.push({ t: 'Колоністам холодно', c: 'warn', p: cold[0] });
    const hot = cols.filter(p => p.env && p.env.hot > 12); if (hot.length) out.push({ t: 'Колоністам спекотно', c: 'warn', p: hot[0] });
    if (g.flare) out.push({ t: 'Живлення вимкнено (спалах)', c: 'warn' });
    const mental = cols.find(p => p.mental); if (mental) out.push({ t: 'Психічний зрив: ' + U.shortName(mental), c: 'bad', p: mental });
    if (g.threats && g.threats.length) out.push({ t: 'Ворогів на карті: ' + g.threats.length, c: 'bad', pos: { x: g.threats[0].x, y: g.threats[0].y } });
    UI.alerts = out;
    $('alerts').innerHTML = out.slice(0, 8).map((a, i) => `<div class="alert ${a.c}" data-act="alertGo" data-i="${i}">${esc(a.t)}</div>`).join('');
  }
  const AI = () => RW.AI;

  // ============================ Архітектор ============================
  function archHtml() {
    const g = G(); if (!UI.cat) return '';
    const cats = [{ id: 'orders', name: 'Накази' }, { id: 'zones', name: 'Зони' }, { id: 'roof', name: 'Дахи' }].concat(D.buildCats);
    let h = '<div class="archcats">' + cats.map(c => `<button class="tab ${UI.cat === c.id ? 'on' : ''}" data-act="cat" data-id="${c.id}">${c.name}</button>`).join('') + '</div><div class="architems">';
    const tt = UI.tool;
    if (UI.cat === 'orders') {
      const O = [['mine', 'Видобуток', 'Позначте скелі й руду для видобутку', '⛏'], ['chop', 'Рубка дерев', 'Позначте дерева', '🪓'], ['harvest', 'Збір рослин', 'Позначте дикі рослини чи врожай для збору', '🌿'], ['hunt', 'Полювання', 'Позначте тварин. Потрібна зброя дальнього бою.', '🏹'], ['decon', 'Розібрати', 'Розібрати будівлю, повернути половину ресурсів', '🔨'], ['allow', 'Дозволити', 'Дозволяє колоністам брати предмети (хрестик зникає)', '✅'], ['forbid', 'Заборонити/дозволити', 'Перемикає заборону на предмети', '⛔'], ['cancel', 'Скасувати накази', 'Знімає позначки та креслення', '✖']];
      for (const o of O) h += `<div class="acard ${tt && tt.kind === o[0] ? 'on' : ''}" data-act="pickDesig" data-kind="${o[0]}" title="${o[2]}"><div class="ai">${o[3]}</div><div class="an">${o[1]}</div></div>`;
    } else if (UI.cat === 'roof') {
      h += RW.Layers.cards(tt);
    } else if (UI.cat === 'zones') {
      h += `<div class="acard ${tt && tt.kind === 'stock' ? 'on' : ''}" data-act="pickZone" data-kind="stock" title="Зона зберігання предметів"><div class="ai">📦</div><div class="an">Склад</div></div>`;
      h += `<div class="acard ${tt && tt.kind === 'grow' ? 'on' : ''}" data-act="pickZone" data-kind="grow" title="Ферма: оберіть культуру — садівники самі сіють і збирають"><div class="ai">🌾</div><div class="an">Ферма</div></div>`;
      h += `<div class="acard ${tt && tt.kind === 'dump' ? 'on' : ''}" data-act="pickZone" data-kind="dump" title="Смітник: сюди зносять трупи, зіпсовану їжу та вибрані предмети"><div class="ai">🗑</div><div class="an">Смітник</div></div>`;
      h += `<div class="acard ${tt && tt.kind === 'pen' ? 'on' : ''}" data-act="pickZone" data-kind="pen" title="Загін: тварини-худоба тримаються тут"><div class="ai">🐑</div><div class="an">Загін</div></div>`;
      h += `<div class="acard ${tt && tt.type === 'zoneErase' ? 'on' : ''}" data-act="pickZoneErase" title="Видалити клітини зон"><div class="ai">✖</div><div class="an">Видалити клітини</div></div>`;
    } else {
      const stock = RW.Events.colonyStock();
      for (const k of Object.keys(D.bld)) {
        const d = D.bld[k]; if (d.cat !== UI.cat) continue;
        const ok = RW.Events.unlocked(d);
        const cost = Object.keys(d.cost).map(c => `<span class="${(stock[c] || 0) >= d.cost[c] ? '' : 'lack'}">${d.cost[c]} ${D.items[c].name}</span>`).join(', ') || 'безкоштовно';
        h += `<div class="acard ${tt && tt.def === k ? 'on' : ''} ${ok ? '' : 'locked'}" data-act="pickBuild" data-id="${k}" title="${esc(d.name)}: ${esc(d.desc)}${ok ? '' : ' — потрібне дослідження: ' + D.research[d.research].name}"><img src="${UI.bldImg(k)}"><div class="an">${esc(d.name)}</div><div class="ac">${ok ? cost : '🔒 ' + esc(D.research[d.research].name)}</div></div>`;
      }
    }
    return h + '</div>';
  }

  // ============================ Інспектор ============================
  const NEEDLE = '<i class="th"></i>';
  function bar(label, v, color, extra) { return `<div class="nrow"><span>${label}</span><div class="nbar"><i style="width:${Math.round(U.clamp(v, 0, 1) * 100)}%;background:${color}"></i>${extra || ''}</div><b>${Math.round(v * 100)}%</b></div>`; }
  function inspectHtml() {
    const g = G(); const s = g.sel; if (!s) return '';
    if (s.p && g.pawns.includes(s.p)) return pawnPanel(s.p);
    if (s.a && !s.a.dead) return animalPanel(s.a);
    if (s.b && !s.b.dead) return bldPanel(s.b);
    if (s.bp && !s.bp.dead) return bpPanel(s.bp);
    if (s.item && !s.item.dead) return itemPanel(s.item);
    if (s.pl && g.map.plant[s.pl.y * g.map.w + s.pl.x] === s.pl) return plantPanel(s.pl);
    if (s.z && g.map.zones.includes(s.z)) return zonePanel(s.z);
    if (s.tile != null) return tilePanel(s.tile);
    return '';
  }
  function pawnPanel(p) {
    const tabs = [['needs', 'Потреби'], ['bio', 'Біо'], ['health', 'Здоров\'я'], ['gear', 'Спорядження'], ['social', 'Стосунки'], ['log', 'Журнал']];
    const own = p.faction === 'colony';
    let h = `<div class="ihead"><img src="${UI.portrait(p)}" class="ip"><div class="it"><b>${esc(U.fullName(p))}</b><div class="sub">${esc(p.title || '')}, ${p.age} р., ${p.gender === 'f' ? 'жін.' : 'чол.'} · ${esc(RW.AI.jobLabel(p))}</div></div>`;
    if (own) h += `<button class="btn ${p.drafted ? 'on' : ''}" data-act="draft" title="[R]">${p.drafted ? 'Відпустити' : 'Призвати'}</button>`;
    if (p.isTrader) h += `<button class="btn" data-act="tradeOpen">Торгувати</button>`;
    if (RW.Prisoners) h += RW.Prisoners.pawnBtns(p);
    h += '</div>';
    if (!own && !p.isTrader) return h + `<div class="ibody"><p>${p.faction === 'enemy' ? '<b class="neg">Ворог</b>' : 'Охоронець торговця'}. Зброя: ${p.equip.weapon ? D.items[p.equip.weapon].name : 'кулаки'}.</p>${healthTab(p)}</div>`;
    if (p.isTrader) return h + `<div class="ibody"><p>Торговець перебуває у колонії. Натисніть «Торгувати».</p></div>`;
    h += '<div class="tabs">' + tabs.map(t => `<button class="tab ${UI.tab === t[0] ? 'on' : ''}" data-act="itab" data-id="${t[0]}">${t[1]}</button>`).join('') + '</div><div class="ibody">';
    if (UI.tab === 'bio') h += bioTab(p); else if (UI.tab === 'needs') h += needsTab(p); else if (UI.tab === 'health') h += healthTab(p); else if (UI.tab === 'gear') h += gearTab(p); else if (UI.tab === 'social') h += socialTab(p); else h += logTab(p);
    return h + '</div>';
  }
  function bioTab(p) {
    const c = D.backstories.child.find(b => b.id === p.bio.child), a = D.backstories.adult.find(b => b.id === p.bio.adult);
    let h = `<div class="bio"><p><b>Дитинство:</b> ${esc(c.title)} — <i>${esc(c.desc)}</i></p><p><b>Дорослість:</b> ${esc(a.title)} — <i>${esc(a.desc)}</i></p>`;
    h += '<p><b>Риси:</b> ' + (p.traits.length ? p.traits.map(t => `<span class="chip" title="${esc(D.traitById[t].desc)}">${esc(D.traitById[t].name)}</span>`).join('') : 'немає') + '</p>';
    if (p.disabled.length || p.noViolence) h += '<p class="neg"><b>Не вміє:</b> ' + [].concat(p.noViolence ? ['насильство'] : [], p.disabled.map(w => (D.workTypes.find(x => x.id === w) || {}).name)).join(', ') + '</p>';
    h += '<div class="skills">';
    for (const sk of D.skills) { const s = p.skills[sk]; const f = ['', '🔥', '🔥🔥'][s.pas]; h += `<div class="sk"><span>${(D.skillIco[sk]||'')} ${D.skillNames[sk]} ${f}</span><div class="nbar"><i style="width:${s.lvl / 20 * 100}%;background:${s.pas ? '#d9a53b' : '#7a8a9a'}"></i></div><b>${s.lvl}</b><small>${Math.floor(s.xp)}/${70 + 30 * s.lvl}</small></div>`; }
    return h + '</div></div>';
  }
  function needsTab(p) {
    const n = p.needs; const th = p.breakThresholds();
    let h = bar('🙂 Настрій', p.mood / 100, U.moodColor(p.mood), `<i class="mk" style="left:${th.minor}%"></i><i class="mk" style="left:${th.major}%"></i><i class="mk" style="left:${th.extreme}%"></i>`);
    h += bar('🍖 Ситість', n.food, n.food < 0.3 ? '#cc5a3a' : '#9ac04a') + bar('😴 Відпочинок', n.rest, n.rest < 0.25 ? '#cc5a3a' : '#5a9ad4') + bar('🎭 Розваги', n.joy, n.joy < 0.25 ? '#cc5a3a' : '#c58ad4');
    const env = p.env || {};
    h += `<p class="sub">Температура навколо: ${U.fmt(env.temp || 0, 0)}°C · ${p.mood < th.minor ? '<b class="neg">Ризик зриву!</b>' : 'Зривів поки немає'}</p>`;
    h += '<div class="thoughts">' + p.sit.concat(p.thoughts).sort((a, b) => b.v - a.v).map(t => `<div class="th ${t.v >= 0 ? 'pos' : 'neg'}"><span>${esc(t.l)}</span><b>${t.v > 0 ? '+' : ''}${Math.round(t.v)}</b></div>`).join('') + '</div>';
    return h;
  }
  function healthTab(p) {
    const cap = p.cap; let h = (RW.Health && p.parts ? RW.Health.healthExtra(p) : '') + `<div class="hgrid"><div>${bar('🩸 Кров', p.blood, '#c0392b')}${bar('⚡ Біль', Math.min(1, p.pain), '#d4852f')}${bar('Рух', cap.move, '#8ab')}${bar('Маніпуляції', Math.min(1, cap.manip), '#8ab')}${bar('Свідомість', Math.min(1, cap.cons), '#8ab')}</div><div class="hl">`;
    const lines = [];
    for (const bp of D.bodyParts) {
      const part = p.part(bp.id); if (part.missing) { lines.push(`<div class="inj neg">${bp.name}: <b>відсутня</b></div>`); continue; }
      for (const i of p.injuries) if (i.part === bp.id && i.type !== 'missing') lines.push(`<div class="inj">${bp.name}: ${D.injuryTypes[i.type].l} <b>${Math.round(i.amt)}</b>${i.bleed > 0.00002 ? ' <span class="neg">кровоточить</span>' : ''}${i.tended ? ' <span class="pos">перев\'язано ' + Math.round(i.tended * 100) + '%</span>' : ''}</div>`);
    }
    for (const il of p.ill) { const d = D.illnesses[il.id]; lines.push(`<div class="inj ${d.lethal ? 'neg' : ''}">${d.l}: тяжкість <b>${Math.round(il.sev * 100)}%</b>${d.env ? '' : ', імунітет ' + Math.round(il.imm * 100) + '%'}${il.tendLeft > 0 ? ' <span class="pos">лікується</span>' : ''}</div>`); }
    if (!lines.length) lines.push('<div class="inj pos">Здоровий</div>');
    return h + lines.join('') + '</div></div>';
  }
  function gearTab(p) {
    const w = p.equip.weapon, a = p.equip.apparel; const wd = w ? D.items[w] : null;
    let h = `<div class="gear"><div class="grow"><b>Зброя:</b> ${wd ? `<img src="${UI.itemImg(w)}"> ${wd.name} (${wd.w.kind === 'ranged' ? 'дальній, дальність ' + wd.w.range : 'ближній'}, шкода ${wd.w.dmg})` : 'кулаки'} ${w ? '<button class="btn xs" data-act="dropWeapon">Скинути</button>' : ''}</div>`;
    h += `<div class="grow"><b>Одяг:</b> ${a ? `<img src="${UI.itemImg(a)}"> ${D.items[a].name} (тепло +${D.items[a].ap.insul}°, захист ${Math.round(D.items[a].ap.sharp * 100)}%)` : 'звичайний'} ${a ? '<button class="btn xs" data-act="dropApparel">Скинути</button>' : ''}</div>`;
    h += `<div class="grow"><b>Несе:</b> ${p.carry ? D.items[p.carry.def].name + ' ×' + p.carry.n : 'нічого'}</div>`;
    h += `<div class="grow"><b>Ліжко:</b> ${p.bed && !p.bed.dead ? D.bld[p.bed.key].name : 'не призначено'}</div><p class="sub">Колоністи самі підбирають кращу зброю й одяг зі складу, коли вільні.</p></div>`;
    return h;
  }
  function socialTab(p) {
    const g = G(); let h = '<div class="soc">';
    const others = g.pawns.filter(o => o !== p && o.faction === 'colony');
    if (!others.length) h += '<p>Більше нікого немає.</p>';
    for (const o of others) { const op = p.opinion[o.id] || 0; const rel = p.rel[o.id]; h += `<div class="srow"><span>${esc(U.shortName(o))}</span><span class="chip ${rel || ''}">${rel === 'lover' ? '❤ коханий(а)' : rel === 'friend' ? 'друг' : rel === 'rival' ? 'ворог' : '—'}</span><div class="nbar"><i style="width:${(op + 100) / 2}%;background:${op >= 0 ? '#6fbf4a' : '#cc3b2e'}"></i><i class="mk" style="left:50%"></i></div><b>${op > 0 ? '+' : ''}${Math.round(op)}</b></div>`; }
    return h + '</div>';
  }
  function logTab(p) { return '<div class="hist">' + (p.log.map(e => `<div class="he"><span class="ht">День ${D.relDay(e.t) + 1}, ${RW.Events.timeString(e.t)}</span> ${esc(e.s)}</div>`).join('') || 'Порожньо') + '</div>'; }
  function animalPanel(a) {
    return `<div class="ihead"><div class="it"><b>${esc(a.name || a.def.name)}</b><div class="sub">${a.def.name}${a.faction === 'colony' ? ' — ваша тварина' : ' — дика'} · стан: ${a.manhunt > 0 || a.hostile ? '<b class="neg">агресивний</b>' : a.state}</div></div>${a.faction !== 'colony' ? `<button class="btn ${a.hunt ? 'on' : ''}" data-act="huntAnimal">${a.hunt ? 'Скасувати полювання' : 'Полювати'}</button>` : ''}</div><div class="ibody">${bar('❤️ Здоров\'я', a.hp / a.maxhp, '#c0392b')}<p class="sub">М'ясо: ~${a.def.meat}, шкіра: ~${a.def.leather}. Для полювання колоніст має мати лук чи вогнепальну зброю й дозволене «Полювання».</p></div>${RW.Husbandry ? RW.Husbandry.animalExtra(a) : ''}`;
  }
  function itemPanel(it) {
    const d = D.items[it.def]; return `<div class="ihead"><img src="${UI.itemImg(it.def)}" class="ip"><div class="it"><b>${d.name}</b> ×${it.n} ${RW.Quality ? RW.Quality.tag(RW.Quality.itemQ(it)) : ''}<div class="sub">${D.itemCats[d.cat]} · вартість ${U.fmt(d.value * it.n, 0)}${d.nutr ? ' · живлення ' + Math.round(d.nutr * 100) + '%' : ''}${d.rot ? ' · псується ' + Math.max(0, Math.round((d.rot - it.age) / D.DAY)) + ' дн' : ''}${it.data && it.data.name ? ' · ' + esc(it.data.name) : ''}</div></div><button class="btn ${it.forbid ? 'on' : ''}" data-act="forbid">${it.forbid ? 'Дозволити' : 'Заборонити'}</button></div>`;
  }
  function plantPanel(pl) {
    const pd = D.plants[pl.def]; const i = pl.y * G().map.w + pl.x; const dz = G().map.desig.get(i);
    return `<div class="ihead"><div class="it"><b>${pd.name}</b><div class="sub">${pd.tree ? 'Дерево' : 'Ріст: ' + Math.round(pl.growth * 100) + '%'}${pd.crop || pd.wild ? ' · здоров\'я ' + Math.round(pl.hp / pd.hp * 100) + '%' : ''}${pl.blight ? ' · <b class="neg">блайт</b>' : ''}</div></div>${pd.tree ? `<button class="btn ${dz === 'chop' ? 'on' : ''}" data-act="desigPlant" data-kind="chop">Зрубати</button>` : `<button class="btn ${dz === 'harvest' ? 'on' : ''}" data-act="desigPlant" data-kind="harvest">Зібрати</button><button class="btn ${dz === 'chop' ? 'on' : ''}" data-act="desigPlant" data-kind="chop">Прибрати</button>`}</div>`;
  }
  function tilePanel(i) {
    const g = G(), m = g.map; const t = D.terrain[m.terrain[i]]; const tp = m.tempAt(i, g.outTemp); const r = m.room[i];
    return `<div class="ihead"><div class="it"><b>${t.name}</b><div class="sub">Родючість ${Math.round(t.fert * 100)}% · ${U.fmt(tp, 1)}°C · ${r >= 0 ? 'Кімната ' + m.rooms[r].size + ' клітин, краса ' + U.fmt(m.rooms[r].beautyAvg, 1) : (m.mroof[i] ? 'Під скелею' : 'Просто неба')}${m.floor[i] ? ' · ' + D.bld[D.FLOORS[m.floor[i]]].name : ''}</div></div></div>`;
  }
  function bpPanel(bp) {
    const d = D.bld[bp.def]; const need = Object.keys(bp.need).map(k => `${D.items[k].name}: ${bp.have[k] || 0}/${bp.need[k]}`).join(', ') || 'без матеріалів';
    return `<div class="ihead"><img src="${UI.bldImg(bp.def)}" class="ip"><div class="it"><b>Креслення: ${esc(d.name)}</b><div class="sub">${need} · робота ${Math.round(bp.work / bp.total * 100)}%${bp.missing ? ' · <b class="neg">нема ' + D.items[bp.missing].name + '</b>' : ''}</div></div><button class="btn" data-act="cancelBp">Скасувати</button></div>`;
  }
  function bldPanel(b) {
    const g = G(), d = b.def; let h = `<div class="ihead"><img src="${UI.bldImg(b.key)}" class="ip"><div class="it"><b>${esc(d.name)}</b><div class="sub">${esc(d.desc)} · міцність ${Math.round(b.hp)}/${b.maxhp}</div></div><button class="btn ${b.decon ? 'on' : ''}" data-act="deconBld">${b.decon ? 'Скасувати розбирання' : 'Розібрати'}</button></div><div class="ibody">`;
    const extra = [];
    if (d.fuel) extra.push(bar('⛽ Паливо (' + D.items[d.fuel.item].name + ')', b.fuel / d.fuel.cap, '#e08a2a') + `<p class="sub">Колоністи дозаправляють автоматично (робота «Перенесення»).</p>`);
    if (d.power) extra.push(`<p class="sub">Енергія: ${d.power > 0 ? '+' : ''}${d.power} Вт · ${b.net ? 'підключено' : '<b class="neg">не підключено до мережі</b>'} · ${b.on ? 'працює' : '<b class="neg">вимкнено</b>'}</p>`);
    if (d.battery) extra.push(bar('🔋 Заряд', b.charge / d.battery, '#6fd46f'));
    if (d.bed) {
      const owner = b.owner != null ? g.pawns.find(p => p.id === b.owner) : null;
      extra.push(`<p>Власник: <select data-chg="assignBed"><option value="">— ніхто —</option>${pawnsC().map(p => `<option value="${p.id}" ${owner === p ? 'selected' : ''}>${esc(U.shortName(p))}</option>`).join('')}</select> <span class="sub">Якість сну: ${Math.round(d.bed.rest * 100)}%</span></p>`);
    }
    if (d.grave) extra.push(`<p>${b.occupant ? 'Похований: ' + esc(b.occupant) : 'Порожня могила. Колоністи ховатимуть тіла автоматично.'}</p>`);
    if (d.ship) extra.push(`<p>Двигун готовий. <button class="btn" data-act="launchShip">Запустити корабель і залишити планету</button></p>`);
    if (d.bench) extra.push(billsHtml(b));
    if (d.bed && RW.Prisoners) extra.push(RW.Prisoners.bedBtn(b));
    if (d.research_bench) extra.push(`<p>${g.research.current ? 'Зараз: <b>' + esc(D.research[g.research.current].name) + '</b> — ' + Math.floor(g.research.progress[g.research.current] || 0) + ' / ' + D.research[g.research.current].cost : 'Дослідження не обрано (вікно «Дослідження»).'}</p>`);
    if (d.door) extra.push(`<p class="sub">Двері відчиняються автоматично. Кімнати за дверима тримають власну температуру.</p>`);
    if (d.joy) extra.push(`<p class="sub">Розвага: ${d.joy.kind}. Колоністи використовують у вільний час.</p>`);
    const r = g.map.room[b.y * g.map.w + b.x]; if (r >= 0) extra.push(`<p class="sub">Кімната: ${g.map.rooms[r].size} клітин · ${U.fmt(g.map.rooms[r].temp, 1)}°C · краса ${U.fmt(g.map.rooms[r].beautyAvg, 1)}</p>`);
    return h + extra.join('') + '</div>';
  }
  function billsHtml(b) {
    const g = G(); const recs = Object.keys(D.recipes).filter(k => D.recipes[k].bench.includes(b.key));
    let h = '<div class="bills"><b>Завдання (рецепти):</b>';
    b.bills.forEach((bill, i) => {
      const r = D.recipes[bill.recipe]; const locked = r.research && !g.research.done.has(r.research);
      const ing = r.ing.map(s => (s.item ? D.items[s.item].name : (s.group === 'rawfood' ? 'будь-яка сира їжа' : s.group === 'meat' ? "м'ясо" : 'овочі')) + ' ×' + s.n).join(' + ');
      h += `<div class="bill ${bill.paused ? 'paused' : ''}"><div class="bn"><b>${esc(r.name)}</b> <small>${ing} → ${D.items[r.out].name} ×${r.n}</small>${locked ? ' <b class="neg">потрібне дослідження</b>' : ''}</div><div class="bc">
        <button class="btn xs" data-act="billMode" data-i="${i}">${bill.mode === 'count' ? 'Зробити' : bill.mode === 'forever' ? 'Постійно' : 'Тримати запас'}</button>
        ${bill.mode !== 'forever' ? `<button class="btn xs" data-act="billAdj" data-i="${i}" data-d="-1">−</button><b>${bill.mode === 'count' ? bill.left : bill.n}</b><button class="btn xs" data-act="billAdj" data-i="${i}" data-d="1">+</button><button class="btn xs" data-act="billAdj" data-i="${i}" data-d="10">+10</button>` : ''}
        <button class="btn xs" data-act="billPause" data-i="${i}">${bill.paused ? '▶' : '❚❚'}</button><button class="btn xs" data-act="billUp" data-i="${i}">↑</button><button class="btn xs" data-act="billDel" data-i="${i}">✕</button></div></div>`;
    });
    h += `<select data-chg="addBill"><option value="">+ Додати завдання…</option>${recs.map(k => { const r = D.recipes[k]; const lk = r.research && !g.research.done.has(r.research); return `<option value="${k}" ${lk ? 'disabled' : ''}>${esc(r.name)}${lk ? ' (🔒)' : ''}</option>`; }).join('')}</select>`;
    if (b.buf && Object.keys(b.buf).length) h += `<p class="sub">На верстаку: ${Object.keys(b.buf).map(k => D.items[k].name + ' ×' + b.buf[k]).join(', ')}</p>`;
    return h + '</div>';
  }
  function zonePanel(z) {
    let h = `<div class="ihead"><div class="it"><b>${z.type === 'stock' ? 'Склад' : z.type === 'dump' ? 'Смітник' : z.type === 'pen' ? 'Загін для тварин' : 'Ферма'}</b><div class="sub">${z.cells.size} клітин</div></div><button class="btn" data-act="zoneDel">Видалити зону</button></div><div class="ibody">`;
    if (z.type === 'grow') {
      const g = G(); const crops = Object.keys(D.plants).filter(k => D.plants[k].crop);
      h += `<p>Культура: <select data-chg="zoneCrop">${crops.map(k => { const pd = D.plants[k]; const lk = pd.research && !g.research.done.has(pd.research); return `<option value="${k}" ${z.crop === k ? 'selected' : ''} ${lk ? 'disabled' : ''}>${pd.name}${lk ? ' (🔒)' : ''}</option>`; }).join('')}</select> <label><input type="checkbox" data-chg="zoneSow" ${z.sow ? 'checked' : ''}> Сіяти</label></p>`;
      { const fi = RW.Farming.zoneInfo(z); h += `<p><label><input type="checkbox" data-chg="zoneFert" ${z.fert ? 'checked' : ''}> 🌱 Удобрювати (з запасів: ${g.map.count('fertilizer')})</label> <label><input type="checkbox" data-chg="zoneCull" ${z.cull !== false ? 'checked' : ''}> Вирубувати хворі</label></p><div class="zfill"><div class="zf" style="width:${fi.avg}%"></div></div><div class="sub">Рослин: ${fi.n}/${fi.cells} · середній ріст ${fi.avg}% · готово ${fi.ready}${fi.hydro ? ' · гідропоніка ' + fi.hydro : ''}${fi.fz ? ' · удобрено ' + fi.fz : ''}${fi.pest ? ' · <b class="neg">шкідники ' + fi.pest + '</b>' : ''}</div>`; }
      const cell = z.cells.values().next().value; if (cell != null) { const t = g.map.tempAt(cell, g.outTemp); h += `<p class="sub">Температура: ${U.fmt(t, 0)}°C · ґрунт: ${D.terrain[g.map.terrain[cell]].name} (${Math.round(D.terrain[g.map.terrain[cell]].fert * 100)}%). ${z.crop && D.plants[z.crop].minT > t ? '<b class="neg">Надто холодно для росту</b>' : ''}</p>`; }
    } else if (z.type === 'dump') {
      h += UI.dumpPanel(z);
    } else if (z.type === 'pen') {
      h += `<p class="sub">Худоба (вівці, корови, кури) тримається у загоні. Поставте <b>Годівницю</b> (Архітектор → Виробництво) і носіть туди сіно (рецепт на верстаті з рису).</p>`;
    } else {
      const PN = ['Мінімальний', 'Низький', 'Звичайний', 'Високий', 'Критичний']; const st = RW.Storage ? RW.Storage.stats(z) : null;
      h += `<p><input class="zname" data-chg="zoneName" value="${esc(z.name || '')}" placeholder="Назва складу…" maxlength="24"></p>`;
      if (st) h += `<div class="zfill"><div class="zf" style="width:${st.pct}%"></div></div><div class="sub">Заповнено ${st.pct}% · ${st.n} предм. · ${st.cells} клітин</div>`;
      h += `<div class="prio">${PN.map((n, k) => `<button class="pbtn p${k} ${z.priority === k ? 'on' : ''}" data-act="zonePrio" data-v="${k}">${n}</button>`).join('')}</div>`;
      h += `<div class="presets"><span class="sub">Швидкий фільтр:</span> <button class="btn xs" data-act="zonePreset" data-id="food">🍖 Їжа</button><button class="btn xs" data-act="zonePreset" data-id="arms">⚔ Зброя/одяг</button><button class="btn xs" data-act="zonePreset" data-id="med">⚕ Ліки</button><button class="btn xs" data-act="zonePreset" data-id="res">🪵 Ресурси</button><button class="btn xs" data-act="zonePreset" data-id="all">Усе</button> <button class="btn xs" data-act="zoneFilterAll" data-v="0">Нічого</button></div><div class="filters">`;
      for (const cat of Object.keys(D.itemCats)) {
        if (cat === 'corpse') continue; const items = Object.keys(D.items).filter(k => D.items[k].cat === cat); const all = items.every(k => z.filter[k] !== false);
        h += `<div class="fcat"><label><input type="checkbox" data-chg="zoneFilterCat" data-cat="${cat}" ${all ? 'checked' : ''}> <b>${D.itemCats[cat]}</b></label><div>${items.map(k => `<label class="fit"><input type="checkbox" data-chg="zoneFilterItem" data-id="${k}" ${z.filter[k] !== false ? 'checked' : ''}> ${D.items[k].name}</label>`).join('')}</div></div>`;
      }
      h += '</div>';
    }
    return h + '</div>';
  }

  // ============================ Контекстне меню ============================
  UI.ctxFns = [];
  function showCtx(x, y, items) {
    UI.ctxFns = items.map(i => i.fn); const m = $('ctxmenu');
    m.innerHTML = items.map((i, k) => `<div class="cm" data-act="ctxDo" data-i="${k}">${esc(i.label)}</div>`).join(''); m.style.left = Math.min(x, innerWidth - 220) + 'px'; m.style.top = Math.min(y, innerHeight - items.length * 28 - 10) + 'px'; m.classList.remove('hidden');
  }
  function hideCtx() { $('ctxmenu').classList.add('hidden'); }

  // ============================ Оновлення UI кожен кадр ============================
  let frame = 0;
  UI.update = function () {
    const g = G(); if (!g || !g.map) return; frame++;
    if (frame % 6 === 0 || UI.dirty) {
      UI.dirty = false;
      setHtml('timecard', timeCard()); setHtml('colbar', colbarHtml());
      const sp = g.speed; document.querySelectorAll('#speedbar .spd').forEach(b => b.classList.toggle('on', +b.dataset.v === sp));
      document.querySelectorAll('#bottombar .tabbtn').forEach(b => { const id = b.dataset.id; b.classList.toggle('on', id === 'arch' ? !!UI.cat : !!UI.win[id]); });
      setHtml('archbar', archHtml()); $('archbar').classList.toggle('hidden', !UI.cat);
      const ih = inspectHtml(); const ip = $('inspect'); ip.classList.toggle('hidden', !ih);
      if (cache.inspect !== ih) { const keepSel = document.activeElement && ip.contains(document.activeElement) && document.activeElement.tagName === 'SELECT'; if (!keepSel) { const sc = ip.querySelector('.ibody') ? ip.querySelector('.ibody').scrollTop : 0; ip.innerHTML = ih; const b = ip.querySelector('.ibody'); if (b) b.scrollTop = sc; cache.inspect = ih; } }
      // вікна
      for (const id of Object.keys(UI.win)) if (UI.win[id] && WINS[id]) { const ae = document.activeElement; if (!(ae && ae.tagName === 'SELECT' && $('win-' + id) && $('win-' + id).contains(ae))) UI.renderWin(id); }
      if (UI.win.trade && !g.trader) UI.closeWin('trade');
      // листи
      const lh = g.letters.map((L, i) => `<div class="letter ${L.kind}" data-act="letterOpen" data-i="${i}" title="${esc(L.title)}">${RW.ICO.letter(L)}</div>`).join('');
      setHtml('letters', lh);
      // підказка інструменту
      const th = $('toolhint'); if (UI.tool) { th.classList.remove('hidden'); th.innerHTML = toolHintText(); } else th.classList.add('hidden');
    }
    if (frame % 90 === 0) computeAlerts();
    const f = $('fps'); if (RW.S.gfx.fps) { f.classList.remove('hidden'); f.textContent = R().stats.fps + ' FPS'; } else f.classList.add('hidden');
    updateHover();
  };
  function setHtml(id, html) { if (cache[id] !== html) { $(id).innerHTML = html; cache[id] = html; } }
  function toolHintText() {
    const t = UI.tool;
    if (t.type === 'build') { const d = D.bld[t.def]; return `Будівництво: <b>${esc(d.name)}</b> — ЛКМ розмістити${(d.wall || d.floor || d.conduit || d.cover) ? ' (тягніть для лінії/області)' : ''}, Q/E поворот, ПКМ чи Esc — скасувати`; }
    if (t.type === 'desig') return `Наказ: <b>${{ mine: 'Видобуток', chop: 'Рубка', harvest: 'Збір', hunt: 'Полювання', decon: 'Розібрати', forbid: 'Заборона', allow: 'Дозвіл', cancel: 'Скасувати' }[t.kind]}</b> — тягніть прямокутник, ПКМ чи Esc — скасувати`;
    if (t.type === 'zone') return `Зона: <b>${t.kind === 'stock' ? 'Склад' : t.kind === 'dump' ? 'Смітник' : 'Вирощування'}</b> — тягніть прямокутник, ПКМ чи Esc — скасувати`;
    return 'Видалення клітин зон — тягніть прямокутник';
  }

  // ============================ Підказка при наведенні ============================
  function updateHover() {
    const g = G(); const tip = $('tooltip'); const m = UI.mouse;
    if (!m.overCanvas || UI.tool || m.drag) { tip.classList.add('hidden'); return; }
    const o = pickAt(m.fx, m.fy, true); let html = '';
    if (o && o.p) html = `<b>${esc(U.fullName(o.p))}</b><br>${esc(RW.AI.jobLabel(o.p))}${o.p.faction === 'colony' ? '<br>Настрій ' + Math.round(o.p.mood) + '%' : ''}`;
    else if (o && o.a) html = `<b>${esc(o.a.name || o.a.def.name)}</b><br>${o.a.def.name} ${Math.round(o.a.hp)}/${o.a.maxhp}`;
    else if (o && o.b) html = `<b>${esc(o.b.def.name)}</b> ${Math.round(o.b.hp)}/${o.b.maxhp}`;
    else if (o && o.item) html = `<b>${D.items[o.item.def].name}</b> ×${o.item.n}`;
    else if (o && o.pl) html = `<b>${D.plants[o.pl.def].name}</b>${D.plants[o.pl.def].tree ? '' : ' ' + Math.round(o.pl.growth * 100) + '%'}`;
    else if (o && o.bp) html = `<b>Креслення: ${esc(D.bld[o.bp.def].name)}</b>`;
    if (!html && o === null) { const tz = G().map.zoneAt[Math.floor(m.fy) * G().map.w + Math.floor(m.fx)]; /* назву зони показує контур на карті */ }
    if (!html) { tip.classList.add('hidden'); return; }
    tip.innerHTML = html; tip.classList.remove('hidden'); tip.style.left = Math.min(m.x + 16, innerWidth - 220) + 'px'; tip.style.top = (m.y + 16) + 'px';
  }

  // ============================ Вибір об'єктів ============================
  function pickAt(fx, fy, hover) {
    const g = G(), map = g.map; const tx = Math.floor(fx), ty = Math.floor(fy); if (!map.inb(tx, ty)) return null;
    let best = null, bd = 0.85;
    for (const p of g.pawns) { const d = Math.hypot(p.x - fx, p.y - fy - 0.1); if (d < bd) { bd = d; best = { p }; } }
    for (const a of g.animals) { const d = Math.hypot(a.x - fx, a.y - fy); if (d < bd) { bd = d; best = { a }; } }
    if (best) return best;
    const i = ty * map.w + tx; const b = map.bld[i]; if (b) return { b };
    const bp = map.bp[i]; if (bp) return { bp };
    const items = map.items.get(i); if (items && items.length) return { item: items[items.length - 1] };
    const pl = map.plant[i]; if (pl) return { pl };
    if (hover) return null;
    const z = map.zoneAt[i]; if (z) return { z };
    return { tile: i };
  }

  // ============================ Світовий оверлей ============================
  UI.drawWorldOverlay = function (ctx) {
    const g = G(), map = g.map, TS = 32; const m = UI.mouse;
    // виділення
    const s = g.sel;
    ctx.lineWidth = 1.6; ctx.strokeStyle = '#ffe08a';
    const brackets = (x, y, w, h) => { const l = 7; ctx.beginPath(); for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) { ctx.moveTo(cx + dx * l, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + dy * l); } ctx.stroke(); };
    if (s) {
      if (s.p && g.pawns.includes(s.p)) { ctx.strokeStyle = '#ffffff'; if (s.p.orderPos) { ctx.strokeStyle = '#7fe08a'; ctx.beginPath(); ctx.arc((s.p.orderPos.x + 0.5) * TS, (s.p.orderPos.y + 0.5) * TS, 7, 0, 6.3); ctx.stroke(); } if (s.p.target && s.p.drafted && !s.p.target.dead) { ctx.strokeStyle = 'rgba(255,90,70,0.8)'; ctx.beginPath(); ctx.moveTo(s.p.x * TS, s.p.y * TS); ctx.lineTo(s.p.target.x * TS, s.p.target.y * TS); ctx.stroke(); } }
      else if (s.a && !s.a.dead) brackets(s.a.x * TS - 12, s.a.y * TS - 12, 24, 24);
      else if (s.b && !s.b.dead) brackets(s.b.x * TS, s.b.y * TS, s.b.w * TS, s.b.h * TS);
      else if (s.bp && !s.bp.dead) brackets(s.bp.x * TS, s.bp.y * TS, s.bp.w * TS, s.bp.h * TS);
      else if (s.item && !s.item.dead) brackets((s.item.i % map.w) * TS, ((s.item.i / map.w) | 0) * TS, TS, TS);
      else if (s.pl) brackets(s.pl.x * TS, s.pl.y * TS, TS, TS);
      else if (s.z) { /* контур вибраної зони малює Storage.draw */ }
    }
    // дальність зброї обраного призваного
    if (s && s.p && s.p.drafted) { const w = RW.Combat.weaponOf(s.p); if (w.kind === 'ranged') { ctx.strokeStyle = 'rgba(255,200,120,0.25)'; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.arc(s.p.x * TS, s.p.y * TS, w.range * TS, 0, 6.3); ctx.stroke(); ctx.setLineDash([]); } }
    // рамка виділення мишкою
    if (m.boxSel && m.boxSel.moved) { const b = boxRect(); ctx.save(); ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.2; ctx.setLineDash([6, 4]); const x0 = b.x0 * TS, y0 = b.y0 * TS, w = (b.x1 - b.x0 + 1) * TS, h = (b.y1 - b.y0 + 1) * TS; ctx.fillRect(x0, y0, w, h); ctx.strokeRect(x0, y0, w, h); ctx.restore(); }
    // інструменти
    const t = UI.tool; if (!t || !m.overCanvas) return;
    const tx = Math.floor(m.fx), ty = Math.floor(m.fy);
    if (m.drag) {
      const r = dragRect(); const col = t.type === 'build' ? '#7ab8ff' : t.type === 'zone' ? '#6fd46f' : t.type === 'zoneErase' ? '#ff7a6a' : '#ffd070';
      if (t.type === 'build' && !isAreaDef(D.bld[t.def])) { /* одинарне */ }
      ctx.fillStyle = U.rgba(col, 0.2); ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.fillRect(r.x0 * TS, r.y0 * TS, (r.x1 - r.x0 + 1) * TS, (r.y1 - r.y0 + 1) * TS); ctx.strokeRect(r.x0 * TS, r.y0 * TS, (r.x1 - r.x0 + 1) * TS, (r.y1 - r.y0 + 1) * TS);
      if (t.type === 'build' && isAreaDef(D.bld[t.def])) { for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) { const ok = !map.canPlace(t.def, x, y, 0, { clear: true }); ctx.fillStyle = ok ? 'rgba(80,200,120,0.28)' : 'rgba(220,60,50,0.4)'; ctx.fillRect(x * TS + 1, y * TS + 1, TS - 2, TS - 2); } }
      ctx.fillStyle = '#fff'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left'; ctx.fillText((r.x1 - r.x0 + 1) + '×' + (r.y1 - r.y0 + 1), r.x1 * TS + TS + 4, r.y0 * TS + 10);
      return;
    }
    if (t.type === 'build') {
      const d = D.bld[t.def]; const f = map.footprint(t.def, tx, ty, t.rot); const err = map.canPlace(t.def, tx, ty, t.rot, { clear: true });
      ctx.globalAlpha = 0.65;
      if (d.wall) ctx.drawImage(GFX.wallSprite(t.def, 0), tx * TS, ty * TS); else if (d.floor) ctx.drawImage(GFX.floorTex[D.FLOORS.indexOf(t.def)][0], tx * TS, ty * TS); else if (d.door) ctx.drawImage(GFX.doorSprite(t.def, true), tx * TS, ty * TS); else ctx.drawImage(GFX.bldSprite(t.def, f.w, f.h), tx * TS, ty * TS);
      ctx.globalAlpha = 1; ctx.fillStyle = err ? 'rgba(230,60,50,0.38)' : 'rgba(70,200,110,0.28)'; ctx.fillRect(tx * TS, ty * TS, f.w * TS, f.h * TS);
      ctx.strokeStyle = err ? '#ff5a4a' : '#6fe08a'; ctx.lineWidth = 1.5; ctx.strokeRect(tx * TS + 0.5, ty * TS + 0.5, f.w * TS - 1, f.h * TS - 1);
      if (d.light) { ctx.strokeStyle = 'rgba(255,230,150,0.35)'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc((tx + f.w / 2) * TS, (ty + f.h / 2) * TS, d.light.r * TS, 0, 6.3); ctx.stroke(); ctx.setLineDash([]); }
      if (err) { ctx.fillStyle = '#ffb0a0'; ctx.font = '10px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(err, tx * TS + f.w * TS + 4, ty * TS + 10); }
    } else if (t.type !== 'zone' && t.type !== 'zoneErase') { ctx.strokeStyle = '#ffd070'; ctx.lineWidth = 1.5; ctx.strokeRect(tx * TS + 1, ty * TS + 1, TS - 2, TS - 2); }
  };
  function boxRect() { const m = UI.mouse, b = m.boxSel; return { x0: Math.min(b.tx, Math.floor(m.fx)), x1: Math.max(b.tx, Math.floor(m.fx)), y0: Math.min(b.ty, Math.floor(m.fy)), y1: Math.max(b.ty, Math.floor(m.fy)) }; }
  function hideBox() { const e = document.getElementById('boxbar'); if (e) e.remove(); }
  function boxMenu(r, sx, sy) {
    hideBox(); const g = G(), map = g.map; const c = { chop: 0, mine: 0, harvest: 0, hunt: 0, forbid: 0, cancel: 0, decon: 0 };
    for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) { if (!map.inb(x, y)) continue; const i = y * map.w + x; const pl = map.plant[i];
      if (map.desig.has(i)) c.cancel++;
      else { if (pl && D.plants[pl.def].tree) c.chop++; else if (pl && (D.plants[pl.def].wild || D.plants[pl.def].crop)) c.harvest++; if (map.blk[i] > 0 && !map.bld[i] && map.terrain[i] > 1 && !pl) c.mine++; }
      const b = map.bld[i]; if (b && b.def.wreck && !b.decon && b.x === x && b.y === y) c.decon++; const it = map.items.get(i); if (it && it.length) c.forbid += it.length; }
    for (const a of g.animals) if (a.faction !== 'colony' && !a.hunt && !a.dead && a.x >= r.x0 && a.x < r.x1 + 1 && a.y >= r.y0 && a.y < r.y1 + 1) c.hunt++;
    const cols = g.pawns.filter(p => p.faction === 'colony' && !p.dead && p.x >= r.x0 && p.x < r.x1 + 1 && p.y >= r.y0 && p.y < r.y1 + 1);
    const defs = [['chop', '🪓', 'Рубати дерева'], ['mine', '⛏', 'Видобувати'], ['harvest', '🌿', 'Збирати рослини'], ['hunt', '🏹', 'Полювати'], ['decon', '🔧', 'Розібрати'], ['forbid', '🚫', 'Заборонити/дозволити'], ['cancel', '✖', 'Скасувати накази']];
    const el = document.createElement('div'); el.id = 'boxbar'; let h = '<div class="bb-t">Виділено ' + (r.x1 - r.x0 + 1) + '×' + (r.y1 - r.y0 + 1) + '</div>'; let any = false;
    for (const [k, ic, nm] of defs) if (c[k]) { any = true; h += '<button data-k="' + k + '"><span class="bb-i">' + ic + '</span>' + nm + '<b>' + c[k] + '</b></button>'; }
    if (cols.length) { any = true; h += '<button data-k="pawn"><span class="bb-i">👤</span>Вибрати колоніста<b>' + cols.length + '</b></button>'; }
    if (!any) return;
    el.innerHTML = h; document.body.appendChild(el); const w = el.offsetWidth, hh = el.offsetHeight; el.style.left = Math.min(innerWidth - w - 8, Math.max(8, sx + 10)) + 'px'; el.style.top = Math.min(innerHeight - hh - 60, Math.max(8, sy + 10)) + 'px';
    el.onmousedown = e => e.stopPropagation();
    el.onclick = e => { const b = e.target.closest('button'); if (!b) return; const k = b.dataset.k; if (k === 'pawn') UI.select({ p: cols[0] }); else { const old = UI.tool; UI.tool = { type: 'desig', kind: k }; applyTool(r); UI.tool = old; } hideBox(); UI.dirty = true; };
  }
  const isAreaDef = d => d && (d.wall || d.floor || d.conduit || d.cover || d.area);
  function dragRect() {
    const m = UI.mouse; const d = m.drag; let x0 = Math.min(d.tx, Math.floor(m.fx)), x1 = Math.max(d.tx, Math.floor(m.fx)), y0 = Math.min(d.ty, Math.floor(m.fy)), y1 = Math.max(d.ty, Math.floor(m.fy));
    const t = UI.tool; if (t && t.type === 'build') { if (!isAreaDef(D.bld[t.def])) { x1 = x0; y1 = y0; } else if (D.bld[t.def].wall || D.bld[t.def].conduit) { // лінія
      if (x1 - x0 >= y1 - y0) { y0 = y1 = d.ty; } else { x0 = x1 = d.tx; } } }
    return { x0, y0, x1, y1 };
  }

  // ============================ Застосування інструментів ============================
  function applyTool(r) {
    const g = G(), map = g.map, t = UI.tool; let n = 0;
    const cells = []; for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) if (map.inb(x, y)) cells.push([x, y]);
    if (t.type === 'build') {
      const d = D.bld[t.def];
      for (const [x, y] of cells) { const err = map.canPlace(t.def, x, y, t.rot, { clear: true }); if (!err) { const bp = map.addBlueprint(t.def, x, y, t.rot); n++; for (let yy = bp.y; yy < bp.y + bp.h; yy++) for (let xx = bp.x; xx < bp.x + bp.w; xx++) { const ii = yy * map.w + xx; if (map.blk[ii] > 0 && !map.desig.has(ii)) map.desig.set(ii, 'mine'); else if (map.plant[ii] && D.plants[map.plant[ii].def].tree && !map.desig.has(ii)) map.desig.set(ii, 'chop'); } } else if (cells.length === 1) UI.toast(err, 'bad'); }
      if (n) RW.A.sfx('ui');
    } else if (t.type === 'desig') {
      const k = t.kind;
      for (const [x, y] of cells) {
        const i = y * map.w + x;
        if (k === 'mine') { if (map.blk[i] > 0 && !map.desig.has(i)) { map.desig.set(i, 'mine'); n++; } }
        else if (k === 'chop') { const pl = map.plant[i]; if (pl && !map.desig.has(i)) { map.desig.set(i, 'chop'); n++; } }
        else if (k === 'harvest') { const pl = map.plant[i]; if (pl && !D.plants[pl.def].tree && (D.plants[pl.def].wild || D.plants[pl.def].crop)) { map.desig.set(i, 'harvest'); n++; } }
        else if (k === 'hunt') { for (const a of g.animals) if (a.faction !== 'colony' && Math.floor(a.x) === x && Math.floor(a.y) === y && !a.hunt) { a.hunt = true; n++; } }
        else if (k === 'decon') { const b = map.bld[i]; if (b && !b.decon && !b.def.wreck || b && b.def.wreck && !b.decon) { b.decon = true; n++; } }
        else if (k === 'forbid') { const arr = map.items.get(i); if (arr) for (const it of arr) { it.forbid = !it.forbid; n++; } }
        else if (k === 'allow') { const arr = map.items.get(i); if (arr) for (const it of arr) { if (it.forbid) { it.forbid = false; n++; } } }
        else if (k === 'cancel') {
          if (map.desig.delete(i)) n++;
          const bp = map.bp[i]; if (bp) { for (const kk in bp.have) map.addItem(kk, bp.have[kk], bp.x, bp.y); map.removeBlueprint(bp); n++; }
          const b = map.bld[i]; if (b && b.decon) { b.decon = false; n++; }
          for (const a of g.animals) if (a.hunt && Math.floor(a.x) === x && Math.floor(a.y) === y) { a.hunt = false; n++; }
        }
      }
      if (n) RW.A.sfx('ui'); else if (k === 'mine') UI.toast('Тут немає чого видобувати', 'info');
    } else if (t.type === 'zone') {
      let z = null;
      for (const [x, y] of cells) { const i = y * map.w + x; if (map.cost[i] === 0 || map.zoneAt[i] || map.terrain[i] <= 1) continue; if (t.kind === 'grow' && (map.bld[i] || (D.terrain[map.terrain[i]].fert <= 0 && !RW.Farming.hydro(map, i)))) continue; if (!z) { z = new RW.Zone(t.kind); z.crop = 'rice'; map.zones.push(z); } z.cells.add(i); map.zoneAt[i] = z; n++; }
      if (z) { UI.select({ z }); RW.A.sfx('ui'); }
    } else if (t.type === 'roof') {
      RW.Layers.apply(t, cells);
    } else if (t.type === 'zoneErase') {
      for (const [x, y] of cells) { const i = y * map.w + x; const z = map.zoneAt[i]; if (z) { z.cells.delete(i); map.zoneAt[i] = null; if (!z.cells.size) map.zones.splice(map.zones.indexOf(z), 1); n++; } }
    }
  }

  // ============================ Ввід миші/клавіатури ============================
  UI.bindCanvas = function (cv) {
    cv.addEventListener('mousemove', e => {
      const m = UI.mouse; const r = cv.getBoundingClientRect(); m.x = e.clientX; m.y = e.clientY; m.overCanvas = true; if (m.boxSel && !m.boxSel.moved && Math.hypot(e.clientX - m.boxSel.sx, e.clientY - m.boxSel.sy) > 8) { m.boxSel.moved = true; UI.select(null); }
      const [fx, fy] = R().toTile(e.clientX - r.left, e.clientY - r.top); m.fx = fx; m.fy = fy;
      if (m.pan) { R().cam.x = m.pan.cx - (e.clientX - m.pan.x) / (R().cam.zoom * 32); R().cam.y = m.pan.cy - (e.clientY - m.pan.y) / (R().cam.zoom * 32); R().clampCam(); }
    });
    cv.addEventListener('mouseleave', () => { UI.mouse.overCanvas = false; });
    cv.addEventListener('mousedown', e => {
      RW.A.init(); hideCtx(); const m = UI.mouse; const g = G(); if (!g || !g.map) return;
      if (e.button === 1) { m.pan = { x: e.clientX, y: e.clientY, cx: R().cam.x, cy: R().cam.y }; e.preventDefault(); return; }
      if (e.button === 0) {
        if (UI.tool) { m.drag = { tx: Math.floor(m.fx), ty: Math.floor(m.fy) }; return; }
        hideBox(); m.boxSel = { tx: Math.floor(m.fx), ty: Math.floor(m.fy), sx: e.clientX, sy: e.clientY, moved: false };
        const o = pickAt(m.fx, m.fy);
        if (o && o.p && o.p.faction !== 'colony' && g.sel && g.sel.p && g.sel.p.drafted) { /* ліва кнопка лише вибір */ }
        UI.select(o); if (o && o.p && o.p.isTrader) { /* відкриваємо через панель */ }
      } else if (e.button === 2) {
        if (UI.tool) { UI.tool = null; UI.dirty = true; return; }
        rightClick(m);
      }
    });
    window.addEventListener('mouseup', e => {
      const m = UI.mouse; if (e.button === 1) m.pan = null;
      if (e.button === 0 && m.drag && UI.tool) {
        const r = dragRect(); m.drag = null; applyTool(r); UI.dirty = true;
      } else m.drag = null;
      if (e.button === 0 && m.boxSel) { const bs = m.boxSel; m.boxSel = null; if (bs.moved && !UI.tool) { const br = { x0: Math.min(bs.tx, Math.floor(m.fx)), x1: Math.max(bs.tx, Math.floor(m.fx)), y0: Math.min(bs.ty, Math.floor(m.fy)), y1: Math.max(bs.ty, Math.floor(m.fy)) }; if (!(RW.Group && RW.Group.box(br))) boxMenu(br, e.clientX, e.clientY); } }
    });
    cv.addEventListener('wheel', e => {
      e.preventDefault(); const c = R().cam; const r = cv.getBoundingClientRect(); const sx = e.clientX - r.left, sy = e.clientY - r.top;
      const before = R().toTile(sx, sy); c.zoom *= e.deltaY < 0 ? 1.12 : 1 / 1.12; R().clampCam(); const after = R().toTile(sx, sy); c.x += before[0] - after[0]; c.y += before[1] - after[1]; R().clampCam();
    }, { passive: false });
    cv.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', e => { UI.keys[e.code] = false; });
    window.addEventListener('blur', () => { UI.keys = {}; });
  };
  UI.pickAt = (fx, fy) => pickAt(fx, fy);
  function rightClick(m) {
    if (RW.Group && RW.Group.order(m)) return;
    const g = G(), map = g.map; const p = UI.selPawn(); if (!p || p.faction !== 'colony') return;
    const tx = Math.floor(m.fx), ty = Math.floor(m.fy); if (!map.inb(tx, ty)) return;
    const o = pickAt(m.fx, m.fy);
    if (p.drafted) {
      if (o && (o.p && o.p.faction === 'enemy' || o.a && (o.a.hostile || o.a.manhunt > 0))) { p.target = o.p || o.a; p.orderPos = null; UI.toast('Ціль призначено', 'info'); return; }
      if (map.cost[ty * map.w + tx] > 0 && map.reachable(p.tx, p.ty, tx, ty, false)) { p.orderPos = { x: tx, y: ty }; RW.AI.resetMove(p); RW.R.fx.ring(tx + 0.5, ty + 0.5, 0.8, '#7fe08a'); } return;
    }
    const items = [];
    if (map.cost[ty * map.w + tx] > 0 && map.reachable(p.tx, p.ty, tx, ty, false)) items.push({ label: 'Піти сюди', fn: () => { RW.AI.endJob(p); RW.AI.setJob(p, { type: 'wander', x: tx, y: ty, wait: 90 }); } });
    if (o && o.item) { const d = D.items[o.item.def]; if (d.cat === 'weapon' || d.cat === 'apparel') items.push({ label: 'Екіпірувати: ' + d.name, fn: () => { RW.AI.endJob(p); RW.AI.reserve(p, o.item); RW.AI.setJob(p, { type: 'equip', item: o.item }); } }); items.push({ label: o.item.forbid ? 'Дозволити' : 'Заборонити', fn: () => { o.item.forbid = !o.item.forbid; } }); }
    if (o && o.b && o.b.def.bed) items.push({ label: 'Призначити це ліжко ' + U.shortName(p), fn: () => { const b = o.b; if (b.owner != null) { const ow = g.pawns.find(x => x.id === b.owner); if (ow) ow.bed = null; } if (p.bed) p.bed.owner = null; b.owner = p.id; p.bed = b; UI.toast('Ліжко призначено', 'good'); } });
    if (o && o.a && o.a.faction !== 'colony') items.push({ label: o.a.hunt ? 'Скасувати полювання' : 'Полювати на ' + o.a.def.name.toLowerCase(), fn: () => { o.a.hunt = !o.a.hunt; } });
    if (o && o.b && o.b.def.research_bench) items.push({ label: 'Досліджувати тут', fn: () => { RW.AI.endJob(p); RW.AI.setJob(p, { type: 'research', b: o.b }); } });
    if (o && o.p && o.p.faction === 'enemy') items.push({ label: 'Атакувати ворога', fn: () => { UI.toggleDraft(p); p.target = o.p; } });
    if (items.length) showCtx(m.x, m.y, items);
  }
  function onKey(e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const g = G(); UI.keys[e.code] = true;
    if (!g || !g.map || !RW.Game.running) return;
    const k = e.code;
    if (k === 'Space') { g.speed = g.speed === 0 ? (g.lastSpeed || 1) : (g.lastSpeed = g.speed, 0); e.preventDefault(); }
    else if (k === 'Digit1') g.speed = 1; else if (k === 'Digit2') g.speed = 2; else if (k === 'Digit3') g.speed = 3; else if (k === 'Digit4') g.speed = 4;
    else if (k === 'Escape') { if (UI.tool) UI.tool = null; else if (UI.cat) UI.cat = null; else if (Object.keys(UI.win).some(w => UI.win[w])) closeAllWin(); else if (g.sel) UI.select(null); else RW.Menu.showPause(); }
    else if (k === 'KeyR') { const p = UI.selPawn(); if (p) UI.toggleDraft(p); }
    else if (k === 'KeyB') { UI.cat = UI.cat ? null : 'orders'; UI.tool = null; }
    else if (k === 'KeyO') { UI.cat = null; UI.toggleWin('work'); } else if (k === 'KeyT') { UI.cat = null; UI.toggleWin('research'); } else if (k === 'KeyH') { UI.cat = null; UI.toggleWin('sched'); }
    else if (UI.keyWins[k]) { UI.cat = null; UI.toggleWin(UI.keyWins[k]); e.preventDefault(); }
    else if (k === 'KeyC') { UI.cat = null; UI.toggleWin('colony'); } else if (k === 'KeyJ') { UI.cat = null; UI.toggleWin('history'); } else if (k === 'F1') { UI.toggleWin('help'); e.preventDefault(); }
    else if (k === 'KeyQ' && UI.tool && UI.tool.type === 'build') UI.tool.rot = (UI.tool.rot + 1) % 2; else if (k === 'KeyE' && UI.tool && UI.tool.type === 'build') UI.tool.rot = (UI.tool.rot + 1) % 2;
    else if (k === 'KeyF') { const s = g.sel; if (s && s.item) s.item.forbid = !s.item.forbid; }
    else if (k === 'Delete') { if (UI.tool) UI.tool = null; }
    else if (k === 'KeyS' && e.ctrlKey) { e.preventDefault(); RW.Save.quick(); }
    else if (k === 'Tab') { e.preventDefault(); const cols = pawnsC(); if (cols.length) { const cur = UI.selPawn(); const i = cols.indexOf(cur); const n = cols[(i + 1) % cols.length]; UI.select({ p: n }); R().focus(n.x, n.y); } }
    UI.dirty = true;
  }

  // Рух камери (щокадру)
  UI.updateCamera = function () {
    const c = R().cam, k = UI.keys, m = UI.mouse; let dx = 0, dy = 0; const sp = 0.28 / c.zoom * (k.ShiftLeft ? 2 : 1);
    if (k.KeyA || k.ArrowLeft) dx -= sp; if (k.KeyD || k.ArrowRight) dx += sp; if ((k.KeyW && false) || k.ArrowUp) dy -= sp; if (k.ArrowDown) dy += sp;
    if (k.KeyS && !k.ControlLeft) dy += sp; if (k.KeyW) dy -= sp;
    if (RW.S.game.edgeScroll && m.overCanvas && !m.pan && !m.drag) { const mg = 6; if (m.x < mg) dx -= sp; else if (m.x > innerWidth - mg) dx += sp; if (m.y < mg) dy -= sp; else if (m.y > innerHeight - mg) dy += sp; }
    if (dx || dy) { c.x += dx; c.y += dy; R().clampCam(); }
  };

  UI.reset = function () { for (const k of Object.keys(cache)) delete cache[k]; UI.tool = null; UI.cat = null; UI.win = {}; $('windows').innerHTML = ''; $('toasts').innerHTML = ''; UI.dirty = true; };
  UI.hint = function (text) { const e = document.createElement('div'); e.className = 'hintcard'; e.innerHTML = `<div>${text}</div><button class="btn xs" data-act="hint">Зрозуміло</button>`; $('toasts').appendChild(e); };
})();
