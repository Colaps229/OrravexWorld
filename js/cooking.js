// ============================================================
//  cooking.js — нова їжа, пиво й залежність, відчуття свіжості, різноманіття раціону
// ============================================================
(function () {
  'use strict';
  const RW = window.RW; const D = RW.D, U = RW.U, AI = RW.AI; const G = () => RW.G; const DY = D.DAY, HR = D.HOUR; const TAU = Math.PI * 2;
  const K = RW.Cooking = {};
  const item = (id, o) => { o.id = id; o.stack = o.stack || 25; o.value = o.value || 0; D.items[id] = o; };
  item('pemmican', { name: 'Пемікан', cat: 'meal', nutr: 0.5, stack: 20, value: 9, color: '#8a4a2a', rot: 70 * DY, flam: 0.3 });
  item('meal_sausage', { name: 'Ковбаса', cat: 'meal', nutr: 0.5, stack: 15, value: 8, color: '#b0523a', rot: 9 * DY });
  item('meal_soup', { name: 'Овочевий суп', cat: 'meal', nutr: 0.45, stack: 10, value: 8, color: '#c8a040', rot: 4 * DY });
  item('meal_roast', { name: 'Печеня з овочами', cat: 'meal', nutr: 0.7, stack: 10, value: 16, color: '#a86a30', rot: 5 * DY });
  item('beer', { name: 'Пиво', cat: 'drink', nutr: 0.02, stack: 25, value: 6, color: '#e0a830', rot: 40 * DY, flam: 0.3, drink: true });
  D.itemCats.drink = 'Напої';
  D.thoughts.ate_pemmican = { l: 'Їв пемікан', v: 0, dur: 0.5 * DY }; D.thoughts.ate_roast = { l: 'Їв смачну печеню', v: 5, dur: 0.8 * DY };
  D.thoughts.ate_variety = { l: 'Різноманітний раціон', v: 4, dur: 1.5 * DY }; D.thoughts.ate_monotony = { l: 'Одноманітна їжа', v: -5, dur: 1.5 * DY };
  D.thoughts.ate_spoiled = { l: 'Їв несвіжу їжу', v: -6, dur: 1.5 * DY }; D.thoughts.drank = { l: 'Випив пива', v: 5, dur: 0.7 * DY };
  D.thoughts.hangover = { l: 'Похмілля', v: -8, dur: 0.8 * DY }; D.thoughts.withdrawal = { l: 'Ломка без пива', v: -14, dur: 0.5 * DY };
  Object.assign(D.thoughtIco, { ate_pemmican: '🥓', ate_roast: '🍖', ate_variety: '🍱', ate_monotony: '😐', ate_spoiled: '🤢', drank: '🍺', hangover: '🤕', withdrawal: '🥴' });
  D.recipes.pemmican = { name: 'Пемікан', bench: ['stove'], skill: 'cooking', work: 380, ing: [{ group: 'meat', n: 3 }, { group: 'veg', n: 3 }], out: 'pemmican', n: 4 };
  D.recipes.sausage = { name: 'Ковбаса', bench: ['stove'], skill: 'cooking', work: 280, ing: [{ group: 'meat', n: 3 }], out: 'meal_sausage', n: 3 };
  D.recipes.soup = { name: 'Овочевий суп', bench: ['stove'], skill: 'cooking', work: 240, ing: [{ group: 'veg', n: 5 }], out: 'meal_soup', n: 2 };
  D.recipes.roast = { name: 'Печеня з овочами', bench: ['stove'], skill: 'cooking', work: 520, ing: [{ group: 'meat', n: 3 }, { group: 'veg', n: 3 }], out: 'meal_roast', n: 1, research: null };
  D.recipes.brew = { name: 'Варити пиво', bench: ['brewery'], skill: 'cooking', work: 700, ing: [{ item: 'corn', n: 8 }], out: 'beer', n: 6 };
  D.recipes.brew_rice = { name: 'Пиво з рису', bench: ['brewery'], skill: 'cooking', work: 700, ing: [{ item: 'rice', n: 14 }], out: 'beer', n: 6 };
  // пивоварня
  D.bld.brewery = { id: 'brewery', cat: 'production', name: 'Пивоварня', desc: 'Варить пиво з кукурудзи чи рису. Веселить, але може викликати залежність.', w: 2, h: 1, cost: { wood: 50, steel: 20 }, work: 240, hp: 90, pass: 2, bench: true, flam: 0.6, color: '#8a6a30', beauty: 0.3 };
  // хронічне
  if (RW.Health) RW.Health.CHRONIC.alcoholism = { l: 'Алкозалежність', ico: '🍺' };

  // ---------- Подія «з'їв» ----------
  K.onEat = function (p, def, age, n) {
    const d = D.items[def]; if (!d) return; const rot = d.rot || 0;
    if (def === 'pemmican') p.addThought('ate_pemmican'); if (def === 'meal_roast') p.addThought('ate_roast', p.has('gourmand') ? 1.6 : 1);
    if (def === 'meal_sausage' || def === 'meal_soup') p.addThought('ate_simple');
    if (rot && age > rot * 0.65 && d.cat !== 'corpse') { p.addThought('ate_spoiled'); if (Math.random() < 0.28 && p.addIllness) { p.addIllness('food_poison', 0.12); if (RW.FX2) RW.FX2.burst('spore', p.x, p.y - 0.4, 6); } }
    if (d.cat === 'meal') { p.ate = p.ate || []; p.ate.push(def); if (p.ate.length > 6) p.ate.shift(); const uniq = new Set(p.ate).size; if (p.ate.length >= 5 && uniq >= 4) p.addThought('ate_variety'); else if (p.ate.length >= 5 && uniq === 1) p.addThought('ate_monotony'); }
  };
  // ---------- Рух запасів/зіпсовані предмети на карті ----------
  K.rotFrac = (it) => { const d = D.items[it.def]; return d && d.rot ? (it.age || 0) / d.rot : 0; };
  K.drawItems = function (c, TS, map, x0, y0, x1, y1, t) {
    const g = G();
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * map.w + x; const arr = map.items.get(i); if (!arr) continue; const tmp = map.tempAt(i, g.outTemp);
      for (const it of arr) {
        const d = D.items[it.def]; if (!d || !d.rot) continue; const f = K.rotFrac(it); const X = x * TS, Y = y * TS;
        if (tmp < 0 && d.cat !== 'corpse') { c.fillStyle = 'rgba(190,225,255,.28)'; c.fillRect(X + 3, Y + 3, TS - 6, TS - 6); c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 1; c.beginPath(); c.moveTo(X + 6, Y + 6); c.lineTo(X + 10, Y + 10); c.moveTo(X + 10, Y + 6); c.lineTo(X + 6, Y + 10); c.stroke(); }
        if (f > 0.65) { const a = Math.min(1, (f - 0.65) / 0.35); c.fillStyle = 'rgba(110,150,30,' + (0.3 * a).toFixed(2) + ')'; c.beginPath(); c.arc(X + 16, Y + 16, 12, 0, TAU); c.fill(); for (let k = 0; k < 2 + (a > 0.6 ? 2 : 0); k++) { const ang = t * 0.12 + k * 1.7 + x; c.fillStyle = '#222'; c.fillRect(X + 16 + Math.cos(ang * 1.3) * 9, Y + 12 + Math.sin(ang * 1.9) * 7, 1.6, 1.6); } }
      }
    }
  };
  // ---------- Пиво: пиття та залежність ----------
  AI.RUN.drink = function (p, j) {
    const g = G(), map = g.map;
    if (j.stage === 0) { const it = j.item; if (!it || it.dead || it.n <= 0) return 'fail'; const r = AI.moveTo(p, it.i % map.w, (it.i / map.w) | 0); if (r === 'fail') return 'fail'; if (r === 'arrived') { map.takeItem(it, 1); p.carry = { def: 'beer', n: 1 }; j.stage = 1; AI.resetMove(p); j.spot = K.drinkSpot(p); } return; }
    if (j.stage === 1) { if (j.spot) { const r = AI.moveTo(p, j.spot[0], j.spot[1]); if (r === 'arrived' || r === 'fail') { j.stage = 2; j.t = 0; p.moving = false; } } else { j.stage = 2; j.t = 0; } return; }
    p.moving = false; j.t++; const FX = RW.FX2;
    if (j.t === 1) RW.Life.bubble(p, '🍺', 220);
    if (j.t % 24 === 0 && FX) FX.emit('sparkle', p.x + 0.25, p.y - 0.35, { c: '#ffd860' });
    if (j.t % 40 === 0 && FX) FX.emit('note', p.x, p.y - 0.6);
    if (j.t >= 130) {
      p.carry = null; p.needs.joy = Math.min(1, (p.needs.joy || 0) + 0.32); p.addThought('drank'); p.lastDrink = g.tick; p.alc = (p.alc || 0) + 1; p.drinkLog = (p.drinkLog || []); p.drinkLog.push(g.tick); p.drinkLog = p.drinkLog.filter(t => g.tick - t < 10 * DY);
      if (p.alc > 3) { p.drunk = 1500; RW.Life.bubble(p, '🥴', 500); }
      if (p.drinkLog.length >= 9 && !(p.chronic && p.chronic.some(c => c.id === 'alcoholism')) && Math.random() < 0.3 && RW.Health) RW.Health.addChronic(p, 'alcoholism');
      for (const o of g.pawns) if (o !== p && o.faction === 'colony' && !o.dead && Math.hypot(o.x - p.x, o.y - p.y) < 3) { RW.Social.change(o, p, 3); RW.Social.change(p, o, 3); }
      if (FX) FX.burst('sparkle', p.x, p.y - 0.4, 6, { c: '#ffd860' }); return 'done';
    }
  };
  K.drinkSpot = function (p) { const map = G().map; for (const b of map.buildings) { if ((b.def.table || b.def.social) && Math.abs(b.x - p.tx) + Math.abs(b.y - p.ty) < 25) { const s = AI.workSpot(p, b.x, b.y, b.w, b.h); if (s) return s; } } return null; };
  K.tick = function (g) {
    if (g.tick % 120 === 0) {
      const beer = g.map.byDef.get('beer'); const have = beer ? Array.from(beer).find(it => !it.forbid && !it.res && it.n > 0) : null;
      for (const p of g.pawns) {
        if (p.faction !== 'colony' || p.dead || p.downed || p.mental || p.sleeping || p.drafted) continue;
        if (p.alc > 0 && g.tick % (HR) === 0) p.alc = Math.max(0, p.alc - 0.5); if (p.drunk > 0) p.drunk -= 120; if (p.drunk > 0 && RW.FX2 && Math.random() < 0.5) RW.FX2.emit('star', p.x, p.y - 0.8, { c: '#ffe27a' });
        if (p.drunk <= 0 && p.drunkWas) { p.drunkWas = false; p.addThought('hangover'); }
        if (p.drunk > 0) p.drunkWas = true;
        const alcoholic = p.chronic && p.chronic.some(c => c.id === 'alcoholism');
        if (alcoholic && g.tick - (p.lastDrink || 0) > 2.5 * DY) p.addThought('withdrawal');
        if (!have || (p.job && !['wander', 'stargaze', 'chat'].includes(p.job.type))) continue;
        const want = (alcoholic ? 0.6 : 0) + (p.mood < 55 ? 0.12 : 0) + (p.needs.joy < 0.4 ? 0.15 : 0.02) + (p.has('drunkard') ? 0.3 : 0); if (p.alc > 2) continue;
        if (Math.random() < want && g.map.reachable(p.tx, p.ty, have.i % g.map.w, (have.i / g.map.w) | 0, true)) AI.setJob(p, { type: 'drink', item: have, stage: 0, t: 0 });
      }
    }
  };
  const lt = RW.Life.tick; RW.Life.tick = function (g) { lt(g); K.tick(g); };
  const ol = AI.jobLabel; AI.jobLabel = function (p) { if (p.job && p.job.type === 'drink') return 'П\'є пиво'; return ol(p); };
  // ---------- Панель продовольства ----------
  K.panel = function () {
    const g = G(); const map = g.map; const cols = g.pawns.filter(p => p.faction === 'colony' && !p.dead).length || 1; let nutr = 0; const rows = [];
    for (const k in D.items) { const d = D.items[k]; if (!(d.cat === 'meal' || d.cat === 'rawfood' || d.cat === 'drink')) continue; const c = map.count(k); if (!c) continue; if (d.nutr) nutr += d.nutr * c * (d.cat === 'rawfood' ? 0.9 : 1); let worst = 0; const s = map.byDef.get(k); if (s && d.rot) for (const it of s) worst = Math.max(worst, K.rotFrac(it)); rows.push({ k, c, worst, d }); }
    const days = nutr / (cols * 1.6); const col = days < 3 ? '#e0584a' : days < 7 ? '#e0c040' : '#7ad07a';
    let h = '<h4>Продовольство</h4><div class="foodbar"><div style="width:' + Math.min(100, days / 20 * 100).toFixed(0) + '%;background:' + col + '"></div></div><div class="sub">Запасів на <b style="color:' + col + '">' + days.toFixed(1) + '</b> діб для ' + cols + ' колоністів</div><div class="foodl">';
    for (const r of rows.sort((a, b) => b.worst - a.worst).slice(0, 8)) h += '<div class="fr"><img src="' + RW.UI.itemImg(r.k) + '"><span>' + r.d.name + '</span><b>' + r.c + '</b>' + (r.d.rot ? '<i class="' + (r.worst > 0.65 ? 'bad' : r.worst > 0.35 ? 'mid' : 'ok') + '" title="Свіжість">' + (r.worst > 0.65 ? 'псується' : r.worst > 0.35 ? 'старіє' : 'свіже') + '</i>' : '') + '</div>';
    return h + '</div>';
  };
})();
