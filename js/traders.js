// ============================================================
//  traders.js — тематичні торговці, ятка каравану, привіти й хвороби
// ============================================================
(function () {
  'use strict';
  const RW = window.RW; const D = RW.D, U = RW.U, E = RW.Events; const G = () => RW.G; const TAU = Math.PI * 2;
  const T = RW.Traders = {};
  const KINDS = T.KINDS = {
    bulk: { name: 'Оптовий торговець', ico: '📦', title: 'Оптовик', col: '#7a5a2a', awn: ['#c8a050', '#e8d8a8'], want: ['resource'], pool: [['wood', 120, 320], ['steel', 100, 220], ['cloth', 60, 140], ['leather', 40, 90], ['stone_block', 60, 140], ['cotton', 60, 120], ['rice', 60, 120], ['potato', 40, 90]], silver: [600, 1400], msg: 'Багато сировини за добру ціну.' },
    exotic: { name: 'Екзотичний торговець', ico: '💎', title: 'Колекціонер', col: '#5a3a7a', awn: ['#9a5ac8', '#e8d0ff'], want: ['currency', 'chunk'], pool: [['gold', 8, 22], ['components', 4, 10], ['bionic_leg', 0, 1], ['bionic_arm', 0, 1], ['medicine', 2, 6], ['meal_fine', 6, 14]], silver: [900, 2000], msg: 'Рідкісні речі: золото, деталі, бионіка.' },
    arms: { name: 'Торговець зброєю', ico: '⚔', title: 'Зброяр', col: '#6a3a2a', awn: ['#a8442e', '#f0cfc0'], want: ['weapon'], pool: [['bow', 1, 3], ['club', 1, 3], ['knife', 1, 3], ['revolver', 1, 2], ['rifle', 1, 2], ['flak_vest', 0, 2], ['parka', 0, 2], ['steel', 40, 100]], silver: [500, 1200], msg: 'Зброя та захисне спорядження.' },
    medic: { name: 'Торговець ліками', ico: '⚕', title: 'Лікар-мандрівник', col: '#2a6a5a', awn: ['#3a9a7a', '#d8f4ea'], want: ['medicine', 'herb'], pool: [['medicine', 6, 14], ['herbal', 10, 24], ['prost_leg', 1, 2], ['prost_arm', 1, 2], ['bionic_leg', 0, 1], ['meal_simple', 10, 20], ['cloth', 30, 70]], silver: [500, 1200], msg: 'Ліки, трави та протези.' }
  };
  const origTrader = E.trader;
  E.trader = function () {
    origTrader(); const g = G(); const tr = g.trader; if (!tr) return;
    const kind = U.pick(Object.keys(KINDS)); const K = KINDS[kind]; tr.kind = kind;
    tr.stock = {}; const n = U.ri(7, 11); for (let k = 0; k < n; k++) { const o = U.pick(K.pool); const c = U.ri(o[1], o[2]); if (c > 0) tr.stock[o[0]] = (tr.stock[o[0]] || 0) + c; }
    tr.stock.meal_simple = tr.stock.meal_simple || 0; if (!tr.stock.meal_simple) delete tr.stock.meal_simple;
    tr.silver = U.ri(K.silver[0], K.silver[1]);
    const tp = g.pawns.find(p => p.id === tr.pawnId); if (tp) { tp.title = K.title; tp.look.shirt = K.col; }
    tr.ids.length || g.pawns.filter(p => p.faction === 'trader').forEach(p => tr.ids.push(p.id));
    // торговець може принести хворобу
    if (tp && Math.random() < 0.14 && RW.Health) { RW.Health.infect(tp, U.pick(['cold', 'flu']), 0.2); tr.sick = true; }
    for (const p of g.pawns) if (p.faction === 'colony' && !p.dead) p.addThought('caravan_visit');
    RW.UI && RW.UI.letter(K.ico + ' ' + K.name, 'Прибув ' + K.name.toLowerCase() + ' ' + U.fullName(tp || { name: { first: '?', nick: '?', last: '' } }) + '. ' + K.msg + (tr.sick ? ' (Здається, він кашляє…)' : '') + ' Клацніть по ньому, щоб торгувати.', 'good', tp);
    tr.born = g.tick; if (RW.FX2) { const s = g.tradeSpot; RW.FX2.burst('dustpuff', s.x + 0.5, s.y + 0.5, 10); }
  };
  const bp = E.buyPrice, sp = E.sellPrice;
  const catOf = def => D.items[def].cat;
  E.buyPrice = def => { const tr = G().trader; let v = bp(def); if (tr && tr.kind && KINDS[tr.kind].pool.some(o => o[0] === def)) v *= 0.88; return v; };
  E.sellPrice = def => { const tr = G().trader; let v = sp(def); if (tr && tr.kind && KINDS[tr.kind].want.includes(catOf(def))) v *= 1.3; return v; };
  const ex = E.executeTrade;
  E.executeTrade = function (buy, sell) { const r = ex(buy, sell); if (!r && RW.FX2) { const s = G().tradeSpot; RW.FX2.burst('coin', s.x + 0.5, s.y + 0.3, 8); } return r; };
  // ---- ятка ----
  T.draw = function (c, TS, t) {
    const g = G(); const tr = g.trader; if (!tr || !tr.kind) return; const K = KINDS[tr.kind]; const s = g.tradeSpot; const x = (s.x + 0.5) * TS, y = (s.y + 0.5) * TS;
    const prog = U.clamp((g.tick - (tr.born || 0)) / 90, 0, 1); const left = U.clamp((tr.leaveAt - g.tick) / 60, 0, 1); const a = Math.min(prog, left); if (a <= 0) return;
    c.save(); c.globalAlpha = a; c.translate(x, y);
    c.fillStyle = 'rgba(0,0,0,0.28)'; c.beginPath(); c.ellipse(0, 12, 30, 8, 0, 0, TAU); c.fill();
    // килим
    c.fillStyle = K.awn[0]; c.globalAlpha = a * 0.35; c.beginPath(); c.ellipse(0, 10, 34, 12, 0, 0, TAU); c.fill(); c.globalAlpha = a;
    // прилавок
    c.fillStyle = '#6a4a28'; c.fillRect(-22, 0, 44, 11); c.fillStyle = '#8a6438'; c.fillRect(-22, 0, 44, 3); c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 1; c.strokeRect(-22, 0, 44, 11);
    // товари
    const gd = ['#d9b04a', '#c8d6de', '#7ac060', '#d0603a', '#8ab0e0']; for (let k = 0; k < 6; k++) { c.fillStyle = gd[(k + tr.kind.length) % gd.length]; c.fillRect(-19 + k * 7, -3 - (k % 2) * 2, 5, 4 + (k % 2) * 2); }
    // стійки і тент зі стрічками
    c.fillStyle = '#4a3a22'; c.fillRect(-24, -22, 2.5, 33); c.fillRect(21.5, -22, 2.5, 33);
    const w = Math.sin(t * 0.06) * 1.3; for (let k = 0; k < 8; k++) { c.fillStyle = k % 2 ? K.awn[1] : K.awn[0]; c.beginPath(); c.moveTo(-26 + k * 6.5, -24); c.lineTo(-19.5 + k * 6.5, -24); c.lineTo(-19.5 + k * 6.5 + w * (k % 2 ? 1 : -1) * 0.5, -14 + (k % 2) * 0); c.lineTo(-22.7 + k * 6.5, -11 + w * 0.4); c.lineTo(-26 + k * 6.5 + w * 0.3, -14); c.closePath(); c.fill(); }
    c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 0.8; c.strokeRect(-26, -24, 52, 10);
    c.font = '11px "Segoe UI Emoji","Noto Color Emoji",sans-serif'; c.textAlign = 'center'; c.fillText(K.ico, 0, -29 + Math.sin(t * 0.08) * 1.2);
    c.restore();
  };
  // ---- плашка у вікні торгівлі ----
  T.header = function (tr) { const K = KINDS[tr.kind]; if (!K) return ''; return '<div class="tkind"><span class="tk-i">' + K.ico + '</span><div><b>' + K.name + '</b><div class="sub">' + K.msg + ' Купує дорожче: ' + K.want.map(w => D.itemCats[w] || w).join(', ') + '.</div></div></div>'; };
})();
