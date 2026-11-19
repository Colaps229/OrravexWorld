'use strict';
// ============================================================
//  start.js — v0.9.3
//   • швидше будівництво (RW.D.BUILD_MUL)
//   • редактор стартових предметів у створенні світу (крок «Колоністи»)
//   • детальніша трава (перемальовує текстури місцевості)
// ============================================================
(function () {
  const D = RW.D, U = RW.U, M = RW.Menu, A = M.A, $ = id => document.getElementById(id);
  D.BUILD_MUL = 2.6; // множник швидкості будівництва і розбирання
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const CAT = { resource: 'Ресурси', rawfood: 'Сира їжа', meal: 'Їжа', medicine: 'Медицина', apparel: 'Одяг', weapon: 'Зброя', production: 'Виробництво', power: 'Енергія', light: 'Світло', furniture: 'Меблі', structure: 'Конструкції', security: 'Безпека', joy: 'Розваги', herb: 'Трави', misc: 'Різне', currency: 'Гроші' };
  const HIDE = new Set(['corpse', 'hidden', 'chunk']);
  const base = () => Object.assign({}, D.scenarios.find(s => s.id === M.cfg.scenario).items);
  function ensure() { const c = M.cfg; if (!c.items || c.itemsFor !== c.scenario) { c.items = base(); c.itemsFor = c.scenario; } return c.items; }
  let fcat = 'all', fq = '';
  function screen() {
    const it = ensure(); const ids = Object.keys(D.items).filter(k => !HIDE.has(D.items[k].cat));
    const list = ids.filter(k => (fcat === 'all' || D.items[k].cat === fcat) && (!fq || D.items[k].name.toLowerCase().includes(fq.toLowerCase()))).sort((a, b) => (it[b] ? 1 : 0) - (it[a] ? 1 : 0) || D.items[a].name.localeCompare(D.items[b].name));
    const cats = [...new Set(ids.map(k => D.items[k].cat))];
    const tot = Object.keys(it).filter(k => it[k] > 0).length;
    const rows = list.map(k => { const d = D.items[k], n = it[k] || 0, st = Math.max(1, Math.min(d.stack || 10, 25)); return `<div class="si-row ${n ? 'on' : ''}"><span class="si-n"><img src="${RW.UI.itemImg(k)}" alt="">${esc(d.name)}</span><button class="btn xs" data-m="siAdd" data-id="${k}" data-d="${-st * 5}">−${st * 5}</button><button class="btn xs" data-m="siAdd" data-id="${k}" data-d="${-st}">−${st}</button><input type="number" min="0" max="9999" value="${n}" data-mc="siSet" data-id="${k}"><button class="btn xs" data-m="siAdd" data-id="${k}" data-d="${st}">+${st}</button><button class="btn xs" data-m="siAdd" data-id="${k}" data-d="${st * 5}">+${st * 5}</button></div>`; }).join('');
    const mb = $('menubox'); const sc = mb.querySelector('.si-list'); const keep = sc ? sc.scrollTop : 0;
    mb.className = 'panel menu-wide'; mb.innerHTML = `<h2>🎒 Стартові предмети</h2><p class="sub">Усе, що колоністи візьмуть із собою на планету. Додавайте й прибирайте будь-що. Зараз видів: <b>${tot}</b></p>
      <div class="si-bar"><select data-mc="siCat"><option value="all">Усі категорії</option>${cats.map(c => `<option value="${c}" ${c === fcat ? 'selected' : ''}>${CAT[c] || c}</option>`).join('')}</select><input type="text" id="si-q" placeholder="🔍 Пошук…" value="${esc(fq)}" data-mc="siQ"><button class="btn xs" data-m="siReset">↺ Як у сценарії</button><button class="btn xs" data-m="siClear">🗑 Прибрати все</button></div>
      <div class="si-list">${rows || '<p class="sub">Нічого не знайдено</p>'}</div><div class="btnrow"><button class="btn big" data-m="siDone">✔ Готово</button></div>`;
    const l = mb.querySelector('.si-list'); if (l) l.scrollTop = keep;
  }
  A.siOpen = () => { fcat = 'all'; fq = ''; screen(); };
  A.siDone = () => M.step4();
  A.siAdd = el => { const it = ensure(), k = el.dataset.id; it[k] = Math.max(0, Math.min(9999, (it[k] || 0) + +el.dataset.d)); if (!it[k]) delete it[k]; screen(); };
  A.siSet = el => { const it = ensure(), k = el.dataset.id, v = Math.max(0, Math.min(9999, Math.round(+el.value) || 0)); if (v) it[k] = v; else delete it[k]; screen(); };
  A.siCat = el => { fcat = el.value; screen(); };
  A.siQ = el => { fq = el.value; screen(); const q = $('si-q'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } };
  A.siReset = () => { M.cfg.items = base(); screen(); };
  A.siClear = () => { M.cfg.items = {}; screen(); };
  // кнопка на кроці «Колоністи»
  const s4 = M.step4;
  M.step4 = function () {
    s4.apply(this, arguments); const row = document.querySelector('#menubox .btnrow:last-of-type'); if (!row || row.querySelector('[data-m=siOpen]')) return;
    const b = document.createElement('button'); b.className = 'btn'; b.dataset.m = 'siOpen'; b.textContent = '🎒 Стартові предмети'; row.insertBefore(b, row.lastElementChild);
  };
  // нові налаштування сценарію скидають список
  const ps = A.pickScen; A.pickScen = function (el) { M.cfg.items = null; return ps.apply(this, arguments); };
  const sc0 = M.startCfg; M.startCfg = function () { const o = sc0.apply(this, arguments), c = M.cfg; if (c.items && c.itemsFor === c.scenario) { o.items = Object.assign({}, c.items); o.itemsFor = c.scenario; } return o; };
  // застосування під час старту
  const G0 = RW.Game, bs = G0.blankState;
  G0.blankState = function (cfg) {
    const g = bs.apply(this, arguments);
    if (cfg && cfg.items && cfg.itemsFor === cfg.scenario) { const it = {}; for (const k in cfg.items) if (cfg.items[k] > 0 && D.items[k]) it[k] = cfg.items[k]; g.scenario = Object.assign({}, g.scenario, { items: it }); }
    return g;
  };
})();
