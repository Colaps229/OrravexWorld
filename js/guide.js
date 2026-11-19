'use strict';
// ============================================================
//  guide.js — 💡 підказки новачкам (кожна показується один раз) і 📊 вікно статистики (клавіша V)
// ============================================================
(function () {
  const D = RW.D, U = RW.U; const DY = D.DAY; const G = () => RW.G; const UI = RW.UI; const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const H = RW.Guide = { GAP: 22000, SHOW: 16000, FIRST_DELAY: 900 };

  // ---------- збереження: які підказки вже бачили ----------
  const KEY = 'orravex.hints.v1'; let mem = { off: false, seen: {} };
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.seen) mem = s; } catch (e) { }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { } };

  const cols = g => g.pawns.filter(p => p.faction === 'colony' && !p.dead);
  const HINTS = [
    { id: 'stock', ico: '📦', t: 'Потрібен склад', x: 'Створіть зону складу (Архітектор → Зони → Склад), щоб колоністи зносили туди речі. Ставте пріоритет складу: «Критичний» склад отримує їжу першим, а їжа, що псується, переноситься раніше за решту.', ok: g => D.relDay(g.tick) >= 2 && !g.map.zones.some(z => z.type === 'stock') },
    { id: 'hunger', ico: '🍖', t: 'Колоніст голодний', x: 'Без їжі настрій падає, а за повного голоду — смерть. Поставте кухонну плиту, дозвольте їжу (✖ → ✔) і зберіть ягоди. Їжу краще тримати в окремому складі з високим пріоритетом.', ok: g => cols(g).some(p => !p.isChild && p.needs.food < 0.18) },
    { id: 'night', ico: '🌙', t: 'Настала ніч', x: 'У темряві рослини не ростуть, а ходити надворі небезпечно. Поставте вогнище, смолоскип або лампу — світло збільшує і швидкість роботи, і настрій.', ok: g => g.daylight < 0.15 && D.relDay(g.tick) >= 1 },
    { id: 'cold', ico: '🧥', t: 'Холодає', x: 'Нижче 0°C колоністи мерзнуть і хворіють. Збудуйте кімнату зі стінами й дахом, поставте вогнище чи обігрівач, пошийте парки. Не забудьте запас дров.', ok: g => g.outTemp < 0 && D.relDay(g.tick) >= 1 },
    { id: 'raid', ico: '⚔', t: 'Напад!', x: 'Виділіть колоністів і натисніть R, щоб призвати їх до бою. Мішки з піском і турелі дають укриття. Поранених лікуйте — медик потрібен до наступного нападу.', ok: g => g.stats.raids > 0 || g.threat > 0 },
    { id: 'death', ico: '🕯', t: 'Втрата в колонії', x: 'Смерть колоністів знижує настрій тих, хто їх знав. Поставте могили й проведіть час за розвагами. Не лишайте поранених без лікаря.', ok: g => (g.deadPawns || []).some(p => p.faction === 'colony') },
    { id: 'mood', ico: '😟', t: 'Настрій падає', x: 'Нижче 20% колоніст працює гірше, а далі може зірватись. Дайте гарне ліжко, їжу за столом, розваги й красу в кімнаті — відкрийте вкладку «Люди», щоб побачити причини.', ok: g => cols(g).some(p => !p.isChild && p.mood < 22) },
    { id: 'fire', ico: '🔥', t: 'Пожежа', x: 'Вогонь швидко йде по дереву. Колоністи гасять його самі, але вологий ґрунт, дощ і вільні проміжки між будівлями дуже допомагають.', ok: g => g.map.fires.size > 0 },
    { id: 'trader', ico: '💰', t: 'Прибув торговець', x: 'Відкрийте «Торгівлю» й обміняйте зайве срібло та товари на потрібні. Продавати можна лише те, що лежить у вільних клітинках біля майданчика.', ok: g => !!g.trader },
    { id: 'child', ico: '🧒', t: 'У колонії дитина', x: 'Діти не працюють і не воюють, їдять на 40% більше й повільніші, але ростуть: 1 рік за 15 діб. У 13 вони стають дорослими й отримують навички та рису. Радість дорослих від дітей дає +3 до настрою.', ok: g => cols(g).some(p => p.isChild) },
    { id: 'elder', ico: '🧓', t: 'Літній колоніст', x: 'Після 60 років робота повільніша на 20%, ходьба — на 8%, зате досвід накопичується на 25% швидше. Давайте літнім легку роботу: кулінарію, дослідження, лікування.', ok: g => cols(g).some(p => p.age >= 60) },
    { id: 'flood', ico: '🌊', t: 'Нашестя води', x: 'Повінь затоплює низини біля річок і озер: люди йдуть повільніше, їжа псується швидше. Заздалегідь перенесіть припаси на сухе й зберіть урожай — зате мул удобрить поля.', ok: g => g.ext && g.ext.sea && !!g.ext.sea.flood },
    { id: 'storm', ico: '❄', t: 'Хуртовина', x: 'Надворі робота вдвічі повільніша, а їжі треба на 20% більше. Заведіть людей до теплих кімнат, дозапасіться дровами. Вітрогенератори в бурю дають максимум, сонячні панелі — майже нічого.', ok: g => g.ext && g.ext.sea && !!g.ext.sea.storm },
    { id: 'drought', ico: '☀', t: 'Посуха', x: 'Рослини ростуть вдвічі повільніше й без дощу. Ґрунт біля води тримається краще; гідропоніка й теплиця під дахом від посухи не страждають.', ok: g => !!(RW.Extras && RW.Extras.drought && RW.Extras.drought(g)) },
    { id: 'wind', ico: '💨', t: 'Вітрогенератор', x: 'Крутиться вночі й у негоду: від 3 м/с вмикається, 200 Вт дає при 9 м/с, на 13+ гальмує. Поточний вітер видно значком зліва. Поєднайте з акумулятором, щоб не втрачати надлишок.', ok: g => g.map.buildings.some(b => b.def.wind) },
    { id: 'stove', ico: '🏡', t: 'Теплична піч', x: 'Піч гріє й підсвічує грядки в радіусі 5 клітин, але лише під дахом: зведіть стіни, дах, а грядки заплануйте всередині. Вона їсть лише 0.5 дров на добу.', ok: g => g.map.buildings.some(b => b.def.stove) }
  ];
  H.list = HINTS;

  // ---------- картка підказки ----------
  let card = null, cur = null, lastShow = 0, queue = [];
  function show(h) {
    cur = h; mem.seen[h.id] = 1; save(); lastShow = Date.now();
    card = document.createElement('div'); card.className = 'hint-card';
    card.innerHTML = '<svg class="hc-ring" viewBox="0 0 36 36"><circle cx="18" cy="18" r="15"></circle></svg><div class="hc-ico">' + h.ico + '</div><div class="hc-b"><b>' + esc(h.t) + '</b><p>' + esc(h.x) + '</p><div class="hc-btn"><button data-k="ok">Зрозуміло</button><button data-k="off" class="ghost">Більше не показувати підказки</button></div></div>';
    card.querySelector('.hc-ring circle').style.animationDuration = H.SHOW + 'ms';
    card.onclick = e => { const k = e.target.dataset && e.target.dataset.k; if (k === 'off') { mem.off = true; save(); close(); UI.toast('Підказки вимкнено (їх можна ввімкнути у вікні «Статистика»)', 'info'); } else if (k === 'ok') close(); };
    document.body.appendChild(card); cur.timer = setTimeout(close, H.SHOW);
  }
  function close() { if (!card) return; clearTimeout(cur && cur.timer); const c = card; card = null; cur = null; c.classList.add('out'); setTimeout(() => c.remove(), 450); lastShow = Date.now(); }
  H.reset = () => { mem = { off: false, seen: {} }; save(); };

  setInterval(() => {
    const g = G(); if (!g || !g.map || !RW.Game.running || (RW.R && RW.R.viewG)) { if (card) close(); return; }
    if (mem.off || card || g.tick < H.FIRST_DELAY || Date.now() - lastShow < H.GAP || (RW.Menu && RW.Menu.screen && RW.Menu.screen !== 'x')) return;
    for (const h of HINTS) { if (mem.seen[h.id]) continue; let ok = false; try { ok = h.ok(g); } catch (e) { } if (ok) { show(h); return; } }
  }, 2000);

  // ---------- 📊 вікно статистики ----------
  const stat = (ico, label, val, sub) => `<div class="stat-card"><span class="si">${ico}</span><div><b class="sv">${val}</b><span class="sl">${label}</span>${sub ? '<em>' + sub + '</em>' : ''}</div></div>`;
  function html() {
    const g = G(); if (!g || !g.map) return ''; const S = g.stats, e = g.ext || {};
    const cs = cols(g); const kids = cs.filter(p => p.age < 13).length, old = cs.filter(p => p.age >= 60).length;
    const dead = (g.deadPawns || []).filter(p => p.faction === 'colony').length; const oldest = cs.reduce((m, p) => Math.max(m, p.age), 0);
    const sea = e.sea || { n: {} }; const droughts = e.droughtsSurvived || 0;
    let h = '<div class="stat-top"><label><input type="checkbox" data-chg="hintsOn" ' + (mem.off ? '' : 'checked') + '> 💡 Підказки новачкам</label> <button class="btn xs" data-act="hintsReset">Показати всі підказки знову</button></div>';
    h += '<h4>🏕 Колонія</h4><div class="stat-grid">' + stat('📅', 'Днів у колонії', D.relDay(g.tick) + 1) + stat('👥', 'Колоністів', cs.length, (kids ? kids + ' дітей' : '') + (kids && old ? ' · ' : '') + (old ? old + ' літніх' : '')) + stat('🕯', 'Втрачено колоністів', dead) + stat('🎂', 'Найстарший', oldest + ' р.') + '</div>';
    h += '<h4>⚔ Бої</h4><div class="stat-grid">' + stat('☠', 'Ворогів переможено', S.kills || 0) + stat('🛡', 'Нападів пережито', S.raids || 0) + '</div>';
    h += '<h4>🌾 Господарство</h4><div class="stat-grid">' + stat('🌾', 'Зібрано врожаю', Math.round(S.harvested || 0)) + stat('🛠', 'Виготовлено', S.crafted || 0) + stat('📦', 'Перенесено предметів', Math.round(S.hauled || 0)) + stat('🦠', 'Зіпсувалось', Math.round(S.spoiled || 0)) + stat('💰', 'Торгових угод', S.trades || 0) + '</div>';
    h += '<h4>🌦 Стихії</h4><div class="stat-grid">' + stat('🌊', 'Повеней пережито', S.floods || 0) + stat('❄', 'Хуртовин пережито', S.storms || 0) + stat('☀', 'Посух пережито', droughts) + (RW.Energy ? stat('💨', 'Вітер зараз', RW.Energy.wind.toFixed(1) + ' м/с', Math.round(RW.Energy.windFactor() * 100) + '% потужності') : '') + '</div>';
    const bl = Object.entries(S.bld || {}).sort((a, b) => b[1] - a[1]); const mx = bl.length ? bl[0][1] : 1;
    h += '<h4>🏗 Збудовано: ' + (S.built || 0) + '</h4><div class="stat-bars">' + (bl.length ? bl.slice(0, 10).map(([k, n]) => `<div class="sb"><span>${esc((D.bld[k] && D.bld[k].name) || k)}</span><i><b style="width:${Math.max(4, n / mx * 100)}%"></b></i><em>${n}</em></div>`).join('') : '<p class="sub">Ще нічого не збудовано.</p>') + '</div>';
    return h;
  }
  (function install() {
    UI.addWin('stats', { title: '📊 Статистика колонії', fn: html, cls: 'win-wide' });
    UI.TABS.splice(UI.TABS.length - 1, 0, { id: 'stats', label: 'Статистика', key: 'V' }); UI.keyWins.KeyV = 'stats';
    UI.actions.hintsReset = () => { H.reset(); UI.toast('Підказки покажуться знову', 'info'); UI.renderWin('stats', true); };
    const root = document.body; root.addEventListener('change', e => { if (e.target && e.target.dataset && e.target.dataset.chg === 'hintsOn') { mem.off = !e.target.checked; save(); } }, true);
  })();
})();
