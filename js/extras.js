'use strict';
// ============================================================
//  extras.js — зброя з нуля, посуха, кристали, досягнення, статистика
// ============================================================
(function () {
  const D = RW.D, U = RW.U; const G = () => RW.G; const DY = D.DAY;
  const X = RW.Extras = {};
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ext = g => { g.ext = g.ext || {}; const e = g.ext; e.stats = e.stats || { days: [] }; e.ach = e.ach || {}; e.rpBank = e.rpBank || 0; return e; };

  // ---------- Знайдена зброя (замість стартової) ----------
  const afterLanding = RW.Game.afterLanding;
  RW.Game.afterLanding = function () {
    afterLanding.apply(this, arguments);
    try {
      const g = G(), map = g.map; const pool = ['club', 'stone_knife', 'spear', 'knife', 'bow']; const found = [];
      let want = 3; if (g.scenario && g.scenario.tribal) want = 2;
      const rnd = U.rng((g.seed || 1) + 991);
      for (let k = 0; k < 300 && found.length < want; k++) {
        const a = rnd() * 6.283, r = 14 + rnd() * 26; const x = Math.floor(g.home.x + Math.cos(a) * r), y = Math.floor(g.home.y + Math.sin(a) * r);
        if (!map.inb(x, y)) continue; const i = y * map.w + x; if (map.cost[i] === 0 || map.blk[i] || map.terrain[i] <= 1) continue;
        let def = pool[Math.floor(rnd() * pool.length)]; if (found.length === 0 && rnd() < 0.35 && !(g.scenario && g.scenario.tribal)) def = 'revolver';
        map.addItem(def, 1, x, y); found.push([def, x, y]);
      }
      g.ext = g.ext || {}; g.ext.foundWeapons = found;
      RW.UI.log && RW.UI.log('Колоністи без зброї б\'ються кулаками (дуже слабо). Змайструйте її на «Місці ремесла» або пошукайте на карті.');
    } catch (e) { console.error(e); }
  };

  // ---------- Посуха (ідея 16) ----------
  const DRY = { dur: 8 * DY, witherAfter: 2 * DY, chancePerDay: 0.3 / D.YEAR_DAYS, growth: 0.5 };
  X.drought = g => (g.ext && g.ext.drought && g.tick < g.ext.drought.until) ? g.ext.drought : null;
  function buildNear(map) {
    const near = new Uint8Array(map.n); const q = []; for (let i = 0; i < map.n; i++) if (map.terrain[i] <= 1) { near[i] = 7; q.push(i); }
    for (let h = 0; h < q.length; h++) { const i = q[h]; if (near[i] <= 1) continue; const x = i % map.w, y = (i / map.w) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (!map.inb(xx, yy)) continue; const j = yy * map.w + xx; if (near[j] < near[i] - 1) { near[j] = near[i] - 1; q.push(j); } } }
    X._near = near;
  }
  function startDrought(g) {
    const e = ext(g); const map = g.map; e.drought = { start: g.tick, until: g.tick + DRY.dur };
    buildNear(map);
    g.weather = { type: 'clear', left: 2 * D.HOUR, t: 0 }; if (map) map.weatherMul = 1;
    RW.UI.letter('Посуха', 'Настав сухий сезон на ' + Math.round(DRY.dur / DY) + ' діб. Рослини ростуть вдвічі повільніше, дощів не буде. Через ' + Math.round(DRY.witherAfter / DY) + ' доби посіви далі ніж за 6 клітинок від води й без даху почнуть в\'янути. Садіть біля води або під дахом (теплиця).', 'warn');
  }
  const pickW = RW.Events.pickWeather;
  RW.Events.pickWeather = function () { pickW.apply(this, arguments); const g = G(); if (g && X.drought(g) && (g.weather.type === 'rain' || g.weather.type === 'storm')) { g.weather.type = 'clear'; if (g.map) g.map.weatherMul = 1; } };
  const tp = RW.Events.tickPlants;
  RW.Events.tickPlants = function (dt) { const g = G(); return tp.call(this, X.drought(g) ? dt * DRY.growth : dt); };
  function droughtTick(g) {
    const e = ext(g); const map = g.map;
    if (g.tick % DY === 2000 && !X.drought(g) && D.relDay(g.tick) > 6 && g.tick - ((e.drought && e.drought.until) || -1e9) > 10 * DY && Math.random() < DRY.chancePerDay) startDrought(g);
    const d = X.drought(g);
    if (d && g.tick % 60 === 0 && g.tick - d.start > DRY.witherAfter) {
      if (!X._near) buildNear(map);
      let lost = 0; for (let i = 0; i < map.n; i++) { const p = map.plant[i]; if (!p || !D.plants[p.def].crop) continue; if (map.isRoofed(i) || (X._near && X._near[i] >= 1)) continue; p.hp -= 0.05; if (p.hp <= 0) { map.removePlant(i); lost++; } }
      if (lost) { e.droughtLost = (e.droughtLost || 0) + lost; }
    }
    if (e.drought && !e.drought.ended && g.tick >= e.drought.until) { e.drought.ended = true; X._near = null; e.droughtsSurvived = (e.droughtsSurvived || 0) + 1; RW.UI.letter('Посуха скінчилась', 'Дощі повертаються. ' + (e.droughtLost ? 'Загинуло посівів: ' + e.droughtLost + '.' : 'Посіви вціліли.'), 'good'); e.droughtLost = 0; }
  }

  // ---------- Кристали (ідея 17): швидкість досліджень ----------
  let arrN = 0, arrT = -1;
  X.researchMul = function () { const g = G(); if (!g) return 1; if (g.tick !== arrT && (g.tick & 63) === 0 || arrT < 0) { arrT = g.tick; arrN = 0; for (const b of g.map.buildings) if (b.key === 'crystal_array' && b.hp > 0) arrN++; } return 1 + 0.15 * Math.min(2, arrN); };

  // ---------- Досягнення (ідея 21) ----------
  const stock = g => RW.Events.colonyStock();
  const cols = g => g.pawns.filter(p => p.faction === 'colony' && !p.dead);
  const ACH = [
    { id: 'week', ico: '📅', name: 'Перший тиждень', desc: 'Протриматись 7 діб', ok: g => D.relDay(g.tick) >= 7 },
    { id: 'month', ico: '🗓', name: 'Ветерани', desc: 'Протриматись 30 діб', ok: g => D.relDay(g.tick) >= 30 },
    { id: 'winter', ico: '❄', name: 'Перша зима', desc: 'Пережити зиму', ok: (g, e) => { if (D.seasonOf(g.tick) === 3) e.sawWinter = true; return e.sawWinter && D.seasonOf(g.tick) !== 3; } },
    { id: 'farm50', ico: '🌾', name: 'Ферма на 50 клітинок', desc: 'Мати 50 посівів одночасно', ok: g => { let n = 0; for (const p of g.map.plant) if (p && D.plants[p.def].crop) n++; return n >= 50; }, prog: g => { let n = 0; for (const p of g.map.plant) if (p && D.plants[p.def].crop) n++; return [n, 50]; } },
    { id: 'armed', ico: '🗡', name: 'Перша зброя', desc: 'Озброїти колоніста', ok: g => cols(g).some(p => p.equip.weapon) },
    { id: 'army', ico: '🛡', name: 'Усі озброєні', desc: 'Кожен колоніст зі зброєю (від 3)', ok: g => cols(g).length >= 3 && cols(g).every(p => p.equip.weapon) },
    { id: 'kills', ico: '⚔', name: 'Захисник', desc: 'Перемогти 10 ворогів', ok: g => g.stats.kills >= 10, prog: g => [g.stats.kills, 10] },
    { id: 'science', ico: '🔬', name: 'Науковці', desc: 'Вивчити 5 технологій', ok: g => g.research.done.size >= 5, prog: g => [g.research.done.size, 5] },
    { id: 'town', ico: '🏘', name: 'Селище', desc: '8 колоністів', ok: g => cols(g).length >= 8, prog: g => [cols(g).length, 8] },
    { id: 'rich', ico: '💰', name: 'Багатії', desc: 'Багатство колонії 10 000', ok: g => g.wealth.total >= 10000, prog: g => [g.wealth.total, 10000] },
    { id: 'drought', ico: '☀', name: 'Пережили посуху', desc: 'Дочекатись кінця сухого сезону', ok: (g, e) => (e.droughtsSurvived || 0) >= 1 },
    { id: 'crystal', ico: '💎', name: 'Кристалічна жила', desc: 'Добути кристал', ok: (g, e) => e.crystalSeen || (stock(g).crystal || 0) > 0 },
    { id: 'mp', ico: '🌐', name: 'Сусіди', desc: 'Обмін караваном або візит у мультиплеєрі', ok: (g, e) => !!(e.mp && e.mp.stats && (e.mp.stats.trades > 0 || e.mp.stats.visits > 0)) }
  ];
  X.ACH = ACH;
  function achTick(g) {
    const e = ext(g); let n = 0;
    for (const a of ACH) { if (e.ach[a.id]) continue; let ok = false; try { ok = a.ok(g, e); } catch (err) { } if (ok) { e.ach[a.id] = g.tick; n++; reward(g, e, a); } }
    if (e.rpBank > 0 && g.research.current) { g.research.progress[g.research.current] = (g.research.progress[g.research.current] || 0) + e.rpBank; e.rpBank = 0; }
  }
  function reward(g, e, a) {
    if (g.research.current) g.research.progress[g.research.current] = (g.research.progress[g.research.current] || 0) + 40; else e.rpBank += 40;
    RW.UI.toast('🏆 Досягнення: ' + a.name + ' (+40 дослідження)', 'good'); RW.A && RW.A.sfx('good');
    RW.UI.log && RW.UI.log('🏆 Досягнення «' + a.name + '»: ' + a.desc + '. +40 очок дослідження.');
  }
  // ---------- Статистика (ідея 23) ----------
  function statTick(g) {
    const e = ext(g); if (g.tick % DY !== 3000) return;
    const cs = cols(g); const st = stock(g); let food = 0; for (const k in st) { const d = D.items[k]; if (d && (d.cat === 'meal' || d.cat === 'rawfood')) food += st[k]; }
    const mood = cs.length ? Math.round(cs.reduce((a, p) => a + (p.mood || 0), 0) / cs.length) : 0;
    e.stats.days.push({ d: D.relDay(g.tick) + 1, food, mood, wealth: g.wealth.total, pop: cs.length, dead: (g.deadPawns || []).length });
    if (e.stats.days.length > 30) e.stats.days.shift();
  }
  const lt = RW.Life.tick;
  RW.Life.tick = function (g) {
    lt(g);
    if (g.tick % 60 === 7) { try { droughtTick(g); } catch (err) { console.error(err); } }
    if (g.tick % 300 === 11) { try { const e = ext(g); if (!e.crystalSeen) { const s = g.map.byDef.get('crystal'); if (s && s.length) e.crystalSeen = true; } achTick(g); } catch (err) { console.error(err); } }
    if (g.tick % DY === 3000) { try { statTick(g); } catch (err) { console.error(err); } }
  };

  // ---------- Вікно «Хроніка» ----------
  let tab = 'ach';
  function chart(title, key, col, days, fmt) {
    const W = 260, H = 84, P = 6; const vals = days.map(d => d[key]); if (!vals.length) return '<div class="stc"><b>' + title + '</b><div class="sub">даних ще немає</div></div>';
    const mx = Math.max(1, ...vals), mn = Math.min(0, ...vals); const n = Math.max(2, vals.length);
    const pts = vals.map((v, i) => (P + i * (W - 2 * P) / (n - 1)).toFixed(1) + ',' + (H - P - (v - mn) / (mx - mn || 1) * (H - 2 * P)).toFixed(1));
    const last = vals[vals.length - 1];
    return `<div class="stc"><b>${title}</b> <span style="color:${col}">${fmt ? fmt(last) : last}</span><svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}"><rect width="${W}" height="${H}" rx="6" fill="rgba(0,0,0,.25)"/>${[0.25, 0.5, 0.75].map(f => `<line x1="0" x2="${W}" y1="${H * f}" y2="${H * f}" stroke="rgba(255,255,255,.07)"/>`).join('')}<polyline fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" points="${pts.join(' ')}"/><polygon fill="${col}" opacity=".12" points="${P},${H - P} ${pts.join(' ')} ${W - P},${H - P}"/></svg><div class="sub">макс ${mx}</div></div>`;
  }
  function html() {
    const g = G(); const e = ext(g); const n = ACH.filter(a => e.ach[a.id]).length;
    let h = `<div class="tabs"><button class="tab ${tab === 'ach' ? 'on' : ''}" data-act="chTab" data-t="ach">🏆 Досягнення (${n}/${ACH.length})</button><button class="tab ${tab === 'stat' ? 'on' : ''}" data-act="chTab" data-t="stat">📈 Статистика</button></div>`;
    if (tab === 'ach') {
      h += '<div class="achg">' + ACH.map(a => { const done = e.ach[a.id]; let pr = ''; if (!done && a.prog) { try { const [v, m] = a.prog(g); pr = `<div class="achp"><i style="width:${Math.min(100, v / m * 100)}%"></i></div><small>${Math.min(v, m)} / ${m}</small>`; } catch (er) { } } return `<div class="ach ${done ? 'on' : ''}"><span class="ai">${done ? a.ico : '🔒'}</span><div><b>${esc(a.name)}</b><div class="sub">${esc(a.desc)}</div>${pr}${done ? '<small class="pos">✔ день ' + (D.relDay(done) + 1) + '</small>' : ''}</div></div>`; }).join('') + '</div><p class="sub">Нагорода за кожне: +40 очок до поточного дослідження.</p>';
    } else {
      const days = e.stats.days;
      const dr = X.drought(g); h += dr ? `<div class="plwarn">☀ Триває посуха: ще ${Math.ceil((dr.until - g.tick) / DY)} д.</div>` : '';
      h += '<div class="stgrid">' + chart('🍖 Їжа', 'food', '#8fd46a', days) + chart('😊 Середній настрій', 'mood', '#f0c850', days, v => v + '%') + chart('💰 Багатство', 'wealth', '#6ab0e8', days) + chart('👥 Колоністи', 'pop', '#c9a0ff', days) + chart('☠ Загиблі (усього)', 'dead', '#e0584a', days) + '</div><p class="sub">Запис раз на добу, останні 30 діб.</p>';
    }
    return h;
  }
  (function install() {
    const UI = RW.UI;
    UI.addWin('chron', { title: 'Хроніка колонії', fn: html, cls: 'win-wide' });
    UI.TABS.splice(UI.TABS.length - 1, 0, { id: 'chron', label: 'Хроніка', key: 'Y' }); UI.keyWins.KeyY = 'chron';
    UI.actions.chTab = el => { tab = el.dataset.t; UI.renderWin('chron', true); };
  })();
})();
