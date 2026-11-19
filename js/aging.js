'use strict';
// ============================================================
//  aging.js — вік колоністів: діти (до 13), дорослі, літні (60+)
//  Дитина: не працює, їсть на 40% більше, росте вдвічі швидше за звичайне старіння
//  (1 рік за 15 діб = 1 сезон) і в 13 стає дорослою.
//  Літній: роботи −20%, ходьба −8%, зате +25% досвіду; сивіє.
//  Усі числа в одному місці (AG) — легко підкрутити баланс.
// ============================================================
(function () {
  const D = RW.D, U = RW.U; const DY = D.DAY; const G = () => RW.G;
  const AG = RW.Aging = { CHILD: 13, ELDER: 60, KID_YEAR_DAYS: 15, KID_FOOD: 1.4, KID_MOVE: 0.85, ELD_WORK: 0.8, ELD_MOVE: 0.92, ELD_XP: 1.25, ORPHAN_CHANCE: 0.07, ORPHAN_COOLDOWN: 18, MAX_KIDS: 2 };
  const P = RW.Pawn.prototype;
  const kid = p => p.faction === 'colony' && p.age < AG.CHILD;
  const elder = p => p.age >= AG.ELDER;
  AG.isKid = kid; AG.isElder = elder;
  Object.defineProperty(P, 'isChild', { get() { return kid(this); } });

  // ---------- множники ----------
  const cd = P.canDo, ws = P.workSpeed, ms = P.moveSpeed, gx = P.gainXp;
  P.canDo = function (wt) { if (kid(this)) return false; return cd.call(this, wt); };
  P.workSpeed = function () { const r = ws.apply(this, arguments); return elder(this) ? r * AG.ELD_WORK : r; };
  P.moveSpeed = function () { const r = ms.apply(this, arguments); return kid(this) ? r * AG.KID_MOVE : (elder(this) ? r * AG.ELD_MOVE : r); };
  P.gainXp = function (sk, amt) { return gx.call(this, sk, elder(this) ? amt * AG.ELD_XP : amt); };
  P.hungerMul = function () { let m = kid(this) ? AG.KID_FOOD : 1; if (RW.Seas && RW.Seas.stormOn()) m *= 1.2; return m; };

  D.thoughts.birthday = { l: 'День народження', v: 7, dur: 2 * DY };
  D.thoughts.coming_of_age = { l: 'Став(ла) дорослим', v: 10, dur: 4 * DY };
  D.thoughts.orphan_home = { l: 'Знайшов(ла) новий дім', v: 6, dur: 5 * DY };
  D.thoughts.kid_around = { l: 'Діти в колонії', v: 3, dur: 1.5 * DY, stack: 1 };

  // ---------- конфеті та святкування (малюється у світі) ----------
  const confetti = [], glows = [];
  const COL = ['#ff5a5a', '#ffd23f', '#5ad1ff', '#7dff7a', '#d28bff', '#ffa94d'];
  function party(p, big) {
    const n = big ? 46 : 26;
    for (let k = 0; k < n; k++) confetti.push({ x: p.x, y: p.y - 0.4, vx: (Math.random() - 0.5) * 0.09, vy: -0.05 - Math.random() * 0.09, a: Math.random() * 6.3, va: (Math.random() - 0.5) * 0.4, c: COL[k % COL.length], t: 0, life: 90 + Math.random() * 60 });
    glows.push({ x: p.x, y: p.y, t: 0, big });
    if (RW.R) RW.R.fx.text(p.x, p.y - 0.9, big ? '🎓' : '🎂', '#fff');
  }
  function drawParty(c, TS, map, x0, y0, x1, y1, time) {
    for (let k = glows.length - 1; k >= 0; k--) {
      const g = glows[k]; g.t++; const a = 1 - g.t / 70; if (a <= 0) { glows.splice(k, 1); continue; }
      const r = (0.6 + g.t / 70 * (g.big ? 2.6 : 1.6)) * TS; c.strokeStyle = 'rgba(255,225,120,' + (a * 0.8).toFixed(2) + ')'; c.lineWidth = 3 * a + 1; c.beginPath(); c.arc(g.x * TS, g.y * TS, r, 0, 6.3); c.stroke();
    }
    for (let k = confetti.length - 1; k >= 0; k--) {
      const f = confetti[k]; f.t++; if (f.t > f.life) { confetti.splice(k, 1); continue; }
      f.vy += 0.0035; f.vx *= 0.985; f.x += f.vx + Math.sin(f.t * 0.2 + f.a) * 0.004; f.y += f.vy; f.a += f.va;
      c.save(); c.translate(f.x * TS, f.y * TS); c.rotate(f.a); c.globalAlpha = Math.min(1, (f.life - f.t) / 25); c.fillStyle = f.c; c.fillRect(-2.5, -1.5 * Math.abs(Math.sin(f.a * 2)) - 0.5, 5, 3); c.restore();
    }
    c.globalAlpha = 1;
  }
  RW.R.worldOver.push(drawParty);

  // ---------- день народження / дорослішання ----------
  const FEW = ['plants', 'cooking', 'crafting', 'construction', 'social', 'medicine', 'shooting', 'melee', 'mining'];
  function grownUp(p) {
    const sk = Object.keys(p.skills || {}); for (let k = 0; k < 2 && sk.length; k++) { const s = p.skills[U.pick(sk)]; if (s) s.lvl = Math.min(20, s.lvl + U.ri(1, 3)); }
    if (p.traits && p.traits.length < 3) { try { const t = RW.Pawn.randomTraits(1)[0]; if (t && p.traits.indexOf(t) < 0) p.traits.push(t); } catch (e) { } }
    p.noViolence = false; p.title = p.title === 'Сирота' ? 'Колоніст' : p.title;
    p.addThought('coming_of_age'); for (const o of G().pawns) if (o !== p && o.faction === 'colony' && !o.isChild) o.addThought('birthday', 0.5);
    party(p, true);
    RW.UI.letter('Подорослішав(ла)', U.fullName(p) + ' виріс(ла) і став(ла) повноцінним колоністом: тепер може працювати. Навички підросли' + (p.traits.length ? ', зʼявилась риса характеру.' : '.'), 'good', p);
  }
  function birthday(p) {
    p.addThought('birthday'); party(p, false);
    RW.UI.toast('🎂 ' + U.shortName(p) + ': ' + p.age + ' ' + (p.age % 10 === 1 && p.age !== 11 ? 'рік' : (p.age % 10 >= 2 && p.age % 10 <= 4 && (p.age < 12 || p.age > 14) ? 'роки' : 'років')), 'good');
    if (p.age === AG.ELDER) { if (p.look) p.look.hair = '#cfcfd6'; p.addThought('birthday', 0.5); RW.UI.letter('Сивина', U.fullName(p) + ' відсвяткував(ла) 60 років. Тепер робота йде повільніше (−20%), зате навички зростають швидше (+25% досвіду).', 'info', p); }
    if (p.age >= 13 && p.age - 1 < AG.CHILD) return;
  }
  function dailyAging(g) {
    const dn = D.dayNum(g.tick);
    for (const p of g.pawns.slice()) {
      if (p.faction !== 'colony' || p.dead) continue;
      if (p.bd == null) p.bd = U.ri(0, D.YEAR_DAYS - 1);
      if (p.age < AG.CHILD) {
        p.gd = (p.gd || 0) + 1;
        if (p.gd >= AG.KID_YEAR_DAYS) {
          p.gd = 0; p.age++;
          if (p.age >= AG.CHILD) grownUp(p); else { RW.UI.toast('🎂 ' + U.shortName(p) + ' підріс(ла): ' + p.age + ' р.', 'good'); party(p, false); const sk = Object.keys(p.skills || {}); const s = p.skills[U.pick(sk)]; if (s && s.lvl < 4) s.lvl++; }
        }
        p.noViolence = true;
      } else if ((dn % D.YEAR_DAYS) === p.bd && g.tick > D.DAY * 2) { p.age++; birthday(p); }
    }
    // діти тішать усіх (раз на добу)
    const kids = g.pawns.filter(kid).length; if (kids) for (const o of g.pawns) if (o.faction === 'colony' && !o.isChild) o.addThought('kid_around');
  }

  // ---------- подія: сирота просить прихистку ----------
  function orphanEvent(g) {
    const e = (g.ext = g.ext || {}); const a = (e.aging = e.aging || { last: -99 });
    const day = D.relDay(g.tick); const adults = g.pawns.filter(p => p.faction === 'colony' && !p.isChild && !p.dead).length;
    const kids = g.pawns.filter(kid).length;
    if (day < 10 || adults < 3 || kids >= AG.MAX_KIDS || day - a.last < AG.ORPHAN_COOLDOWN || Math.random() > AG.ORPHAN_CHANCE) return;
    if (g.threat > 0) return;
    a.last = day;
    const p = RW.Pawn.generate({ age: U.ri(6, 12) }); p.faction = 'colony';
    for (const k in p.skills) { p.skills[k].lvl = Math.min(p.skills[k].lvl, 3); p.skills[k].xp = 0; }
    p.traits = p.traits.slice(0, 1); p.noViolence = true; p.gd = U.ri(0, 8); p.bd = U.ri(0, D.YEAR_DAYS - 1); p.title = 'Сирота'; p.equip.weapon = null;
    const sp = RW.Events.edgeSpawn(g.map, g.home); p.x = sp.x + 0.5; p.y = sp.y + 0.5;
    RW.UI.letter('Сирота', 'До колонії прийшла дитина — ' + U.fullName(p) + ', ' + p.age + ' р. Вона голодна й самотня. Дитина не може працювати, їсть на 40% більше й вирісте за ~' + ((AG.CHILD - p.age) * AG.KID_YEAR_DAYS) + ' діб.', 'good', null, { x: sp.x, y: sp.y }, [
      { label: 'Прийняти', fn: () => { g.pawns.push(p); p.addThought('orphan_home'); RW.Events.initRelations && RW.Events.initRelations(p); party(p, false); RW.UI.toast(U.shortName(p) + ' тепер живе в колонії', 'good'); } },
      { label: 'Відмовити', fn: () => { } }
    ]);
  }

  // ---------- вікові рамки: діти не воюють ----------
  const td = RW.UI.toggleDraft;
  RW.UI.toggleDraft = function (p) { if (p && kid(p)) { RW.UI.toast(U.shortName(p) + ' ще дитина — не може воювати', 'bad'); return; } return td.apply(this, arguments); };

  const lt = RW.Life.tick;
  RW.Life.tick = function (g) {
    lt(g);
    if (g.tick % DY === 1234) { try { dailyAging(g); orphanEvent(g); } catch (e) { console.error(e); } }
  };
})();
