// ============================================================
//  husbandry.js — скотарство: прирученя, загони, годівниці, вовна/молоко/яйця, тренування
// ============================================================
(function () {
  'use strict';
  const RW = window.RW; const D = RW.D, U = RW.U, AI = RW.AI, C = RW.Combat; const G = () => RW.G; const TAU = Math.PI * 2; const DY = D.DAY, HR = D.HOUR;
  const H = RW.Husbandry = {};
  // ---------- Дані ----------
  D.animals.sheep = { name: 'Вівця', hp: 40, speed: 0.06, flee: true, meat: 32, leather: 6, color: '#efeadc', size: 0.95, herd: true, dmg: 0, livestock: true, tame: 0.55, ico: '🐑', prod: 'wool' };
  D.animals.cow = { name: 'Корова', hp: 85, speed: 0.055, flee: true, meat: 70, leather: 18, color: '#f2eee4', size: 1.2, herd: true, dmg: 4, livestock: true, tame: 0.4, ico: '🐄', prod: 'milk' };
  D.animals.chicken = { name: 'Курка', hp: 12, speed: 0.07, flee: true, meat: 9, leather: 0, color: '#f6f2ea', size: 0.55, herd: true, dmg: 0, livestock: true, tame: 0.7, ico: '🐔', prod: 'egg' };
  D.animals.dog.tame = 0.5; D.animals.dog.ico = '🐕'; D.animals.cat.ico = '🐈'; D.animals.dog.trainable = ['guard', 'therapy']; D.animals.cat.trainable = ['therapy']; D.animals.wolf.tame = 0.12; D.animals.boar.tame = 0.18; D.animals.deer.tame = 0.2;
  for (const k in D.biomes) { const b = D.biomes[k]; if (b.animals) { const w = k === 'arid' ? [1, 0, 2] : k === 'tundra' ? [2, 1, 0] : [4, 4, 5]; b.animals.push(['sheep', w[0]], ['cow', w[1]], ['chicken', w[2]]); } }
  const item = (id, o) => { o.id = id; o.stack = o.stack || 50; o.value = o.value || 1; D.items[id] = o; };
  item('wool', { name: 'Вовна', cat: 'resource', stack: 75, value: 2.2, color: '#efe8d8', flam: 0.8 });
  item('milk', { name: 'Молоко', cat: 'meal', nutr: 0.3, stack: 20, value: 3, color: '#f4f4ec', rot: 3 * DY });
  item('egg', { name: 'Яйця', cat: 'rawfood', kind: 'veg', nutr: 0.1, stack: 40, value: 1.6, color: '#f0e4cc', rot: 8 * DY });
  item('hay', { name: 'Сіно', cat: 'resource', stack: 75, value: 0.6, color: '#c8b050', rot: 40 * DY, flam: 1 });
  D.recipes.hay = { name: 'Сіно', bench: ['workbench'], skill: 'plants', work: 160, ing: [{ item: 'rice', n: 4 }], out: 'hay', n: 10 };
  D.recipes.cloth_wool = { name: 'Тканина з вовни', bench: ['tailor_bench'], skill: 'crafting', work: 200, ing: [{ item: 'wool', n: 5 }], out: 'cloth', n: 6 };
  D.bld.trough = { id: 'trough', cat: 'production', name: 'Годівниця', desc: 'Тварини їдять із неї сіно. Колоністи наповнюють її.', w: 2, h: 1, cost: { wood: 24 }, work: 100, hp: 50, pass: 2, fuel: { item: 'hay', cap: 40, burn: 0 }, flam: 1, color: '#9a7a40', beauty: 0 };
  D.skills.push('animals'); D.skillNames.animals = 'Тварини';
  D.workTypes.splice(2, 0, { id: 'animals', name: 'Тварини', skill: 'animals' });
  D.thoughts.tamed = { l: 'Нова тварина в колонії', v: 3, dur: 1.5 * DY }; D.thoughts.pet_therapy = { l: 'Тваринка підбадьорює', v: 3, dur: 0.4 * DY }; D.thoughts.pet_died = { l: 'Загинула тварина', v: -4, dur: 3 * DY };
  Object.assign(D.thoughtIco, { tamed: '🐾', pet_therapy: '🐕', pet_died: '🥀' });
  const NAMES = ['Мурка', 'Рижик', 'Зірка', 'Білка', 'Пухнастик', 'Борис', 'Зефір', 'Ромашка', 'Жук', 'Лапка', 'Сніжок', 'Бублик', 'Квітка', 'Кузя', 'Мася', 'Глоба'];
  // ---------- Pawn: нова навичка ----------
  const pd = RW.Pawn.deserialize; RW.Pawn.deserialize = function (o) { const p = pd(o); if (!p.skills.animals) p.skills.animals = { lvl: U.ri(0, 4), xp: 0, pas: 0 }; if (p.work.animals == null) p.work.animals = 3; return p; };
  // ---------- Збереження ----------
  const AP = RW.Animal.prototype; const aser = AP.serialize;
  AP.serialize = function () { const o = aser.call(this); o.food = this.food; o.wool = this.wool; o.milk = this.milk; o.trained = this.trained; o.tame = this.tame; o.slaughter = this.slaughter; o.gender = this.gender; o.preg = this.preg; o.young = this.young; o.born = this.born; o.tq = this.tq; o.trainP = this.trainP; o.egg = this.egg; return o; };
  const aprep = a => { if (a.food == null) a.food = 0.7; if (a.gender == null) a.gender = Math.random() < 0.5 ? 'F' : 'M'; return a; };
  // ---------- Приручення ----------
  H.tameChance = (p, a) => U.clamp((a.def.tame || 0.2) * 0.35 + 0.03 * p.skillLvl('animals') + (p.has('kind') ? 0.04 : 0), 0.04, 0.55);
  AI.RUN.tame = function (p, j) {
    const g = G(), map = g.map; const a = j.animal; if (!a || a.dead || a.faction === 'colony' || !a.tame) return 'done';
    a.hold = g.tick + 40; a.flee = 0;
    if (j.stage === 0) { if (Math.hypot(a.x - p.x, a.y - p.y) < 1.4) { j.stage = 1; j.t = 0; j.n = 0; AI.resetMove(p); p.moving = false; return; } const r = AI.moveTo(p, a.tx, a.ty, { adj: true }); if (r === 'fail' || ++j.w > 900) return 'fail'; return; }
    p.moving = false; AI.faceTo(p, a.x, a.y); j.t++; const FX = RW.FX2;
    if (j.t % 24 === 0 && FX) FX.emit('sparkle', (p.x + a.x) / 2, p.y - 0.4, { c: '#ffd8a0' });
    if (j.t % 70 === 0) {
      p.gainXp('animals', 18); j.n++;
      if (Math.random() < H.tameChance(p, a)) { H.makeColony(a, p); return 'done'; }
      if (a.def.dmg > 0 && Math.random() < 0.12 + (a.def.predator ? 0.1 : 0)) { p.takeDamage(a.def.dmg * 0.8, 'bite', a); RW.UI && RW.UI.toast(U.shortName(p) + ': ' + a.def.name.toLowerCase() + ' вкусила(ла) під час приручення', 'bad'); a.tame = false; a.flee = 400; a.target = p; return 'fail'; }
      if (j.n >= 6) { a.tame = false; a.flee = 500; a.target = p; RW.UI && RW.UI.toast('Не вдалося приручити: ' + a.def.name.toLowerCase(), 'bad'); return 'fail'; }
    }
  };
  H.makeColony = function (a, p) {
    a.faction = 'colony'; a.tame = false; a.name = a.name || U.pick(NAMES); a.herd = 0; a.hostile = false; a.manhunt = 0; aprep(a); a.flee = 0; a.state = 'idle'; a.target = null;
    p && p.addThought('tamed'); RW.A && RW.A.sfx('good');
    if (RW.FX2) { RW.FX2.burst('heart', a.x, a.y - 0.4, 7); RW.FX2.burst('sparkle', a.x, a.y, 10, { c: '#ffb0d0' }); }
    RW.UI && RW.UI.letter('Приручено!', (p ? U.fullName(p) : 'Хтось') + ' приручив(ла): ' + a.def.name.toLowerCase() + ' «' + a.name + '».' + (a.def.prod ? ' Тепер вона дає: ' + ({ wool: 'вовну', milk: 'молоко', egg: 'яйця' }[a.def.prod]) + '. Зробіть загін і годівницю.' : ''), 'good', null, { x: a.tx, y: a.ty });
  };
  // ---------- Роботи ----------
  const reach = (p, a) => G().map.reachable(p.tx, p.ty, a.tx, a.ty, true);
  AI.GIVERS.animals = function (p) {
    const g = G();
    for (const a of g.animals) { if (a.dead || a.faction === 'colony' || !a.tame || (a.tameBusy && g.tick < a.tameBusy)) continue; if (!reach(p, a)) continue; a.tameBusy = g.tick + 600; return { type: 'tame', animal: a, stage: 0, t: 0, w: 0 }; }
    for (const a of g.animals) { if (a.dead || a.faction !== 'colony' || !a.def.livestock) continue; if (a.res && a.res !== p.id) continue;
      if (a.slaughter && reach(p, a)) { a.res = p.id; return { type: 'slaughter', animal: a, stage: 0, t: 0, w: 0 }; }
      if ((a.def.prod === 'wool' && a.wool >= 1 || a.def.prod === 'milk' && a.milk >= 1) && a.food > 0.25 && !a.young && reach(p, a)) { a.res = p.id; return { type: 'gather', animal: a, stage: 0, t: 0, w: 0 }; }
    }
    for (const a of g.animals) { if (a.dead || a.faction !== 'colony' || !a.tq || (a.res && a.res !== p.id) || !reach(p, a)) continue; a.res = p.id; return { type: 'train', animal: a, stage: 0, t: 0, w: 0 }; }
    return null;
  };
  const approach = (p, j) => { const a = j.animal; a.hold = G().tick + 40; if (j.stage === 0) { if (Math.hypot(a.x - p.x, a.y - p.y) < 1.3) { j.stage = 1; j.t = 0; AI.resetMove(p); p.moving = false; return false; } const r = AI.moveTo(p, a.tx, a.ty, { adj: true }); if (r === 'fail' || ++j.w > 900) { a.res = null; return 'fail'; } return false; } p.moving = false; AI.faceTo(p, a.x, a.y); return true; };
  AI.RUN.gather = function (p, j) {
    const a = j.animal; if (!a || a.dead) return 'done'; const ap = approach(p, j); if (ap !== true) { return ap || undefined; } j.t += p.workSpeed('animals'); p.gainXp('animals', 0.1);
    if (j.t % 20 === 0 && RW.FX2) RW.FX2.emit('sparkle', a.x, a.y - 0.4, { c: a.def.prod === 'wool' ? '#ffffff' : '#e8f4ff' });
    if (j.t >= (a.def.prod === 'wool' ? 160 : 110)) {
      const map = G().map; const q = 0.7 + 0.03 * p.skillLvl('animals');
      if (a.def.prod === 'wool') { map.addItem('wool', Math.round(8 * q), a.tx, a.ty); a.wool = 0; } else { map.addItem('milk', Math.round(5 * q), a.tx, a.ty); a.milk = 0; }
      a.res = null; if (RW.FX2) RW.FX2.burst(a.def.prod === 'wool' ? 'sparkle' : 'drop', a.x, a.y - 0.3, 6, { c: '#fff' }); return 'done';
    }
  };
  AI.RUN.slaughter = function (p, j) {
    const a = j.animal; if (!a || a.dead) return 'done'; const ap = approach(p, j); if (ap !== true) { return ap || undefined; } j.t += p.workSpeed('animals') * 1.2;
    if (j.t >= 90) { a.slaughter = false; a.res = null; if (RW.R) RW.R.fx.blood(a.x, a.y, 10); a.die(p); RW.UI && RW.UI.log(U.shortName(p) + ' забив(ла): ' + a.def.name.toLowerCase()); return 'done'; }
  };
  AI.RUN.train = function (p, j) {
    const a = j.animal; if (!a || a.dead || !a.tq) return 'done'; const ap = approach(p, j); if (ap !== true) { return ap || undefined; } j.t += p.workSpeed('animals'); p.gainXp('animals', 0.1);
    if (j.t % 30 === 0 && RW.FX2) RW.FX2.emit('star', a.x, a.y - 0.6, { c: '#ffe27a' });
    if (j.t >= 160) { a.trainP = (a.trainP || 0) + 0.18 + 0.025 * p.skillLvl('animals') + (a.def.tame || 0) * 0.1; if (a.trainP >= 1) { a.trained = a.trained || {}; a.trained[a.tq] = true; RW.UI && RW.UI.toast(a.name + ' навчився(лась): ' + H.TRAIN[a.tq].l, 'good'); RW.A && RW.A.sfx('research'); RW.FX2 && RW.FX2.burst('star', a.x, a.y - 0.5, 8); a.tq = null; a.trainP = 0; } a.res = null; return 'done'; }
  };
  H.TRAIN = { guard: { l: 'Охорона', ico: '🛡', d: 'Атакує ворогів, що наближаються до колонії.' }, therapy: { l: 'Терапія', ico: '💞', d: 'Підвищує настрій колоністів поруч.' } };
  const jl = AI.jobLabel; AI.jobLabel = function (p) { const j = p.job; if (j) { if (j.type === 'tame') return 'Приручає ' + (j.animal ? j.animal.def.name.toLowerCase() : ''); if (j.type === 'gather') return j.animal && j.animal.def.prod === 'wool' ? 'Стриже вівцю' : 'Доїть корову'; if (j.type === 'slaughter') return 'Забиває тварину'; if (j.type === 'train') return 'Дресирує тварину'; } return jl(p); };
  // ---------- Поведінка худоби ----------
  const origThink = C.animalThink;
  const penCells = g => { if (g._pens && g._pensT === g.tick - g.tick % 120) return g._pens; const pens = g.map.zones.filter(z => z.type === 'pen'); const arr = []; for (const z of pens) for (const c of z.cells) arr.push(c); g._pens = arr; g._pensT = g.tick - g.tick % 120; return arr; };
  C.animalThink = function (a) {
    const g = G(), map = g.map;
    if (a.faction === 'colony' && !a.dead) { aprep(a); if (a.hold > g.tick) { a.moving = false; a.path = null; return; } }
    if (a.faction === 'colony' && !a.dead && !a.manhunt && !a.hostile) {
      // охорона
      if (a.trained && a.trained.guard && g.tick % 25 === (a.id % 25)) { let best = null, bd = 13; for (const e of g.pawns) { if (e.faction !== 'enemy' || e.dead || e.downed) continue; const d = Math.hypot(e.x - a.x, e.y - a.y); if (d < bd) { bd = d; best = e; } } if (best) { a.state = 'attack'; a.target = best; a.attackStart = g.tick; } }
      if (a.trained && a.trained.therapy && g.tick % 120 === (a.id % 120)) for (const p of g.pawns) if (p.faction === 'colony' && !p.dead && Math.hypot(p.x - a.x, p.y - a.y) < 4) { p.addThought('pet_therapy'); if (RW.FX2 && Math.random() < 0.3) RW.FX2.emit('heart', p.x, p.y - 0.5); }
      if (a.def.livestock && a.state !== 'attack' && !(a.flee > 0)) { livestock(a, g, map); return; }
      if (a.def.pet) petCare(a, g);
    }
    return origThink(a);
  };
  function petCare(a, g) { if (g.tick % 60 === 0) a.food = Math.max(0.3, (a.food == null ? 0.7 : a.food) - 0.0003); }
  function nearTrough(a, map) { let best = null, bd = 28; for (const b of map.buildings) { if (b.dead || b.key !== 'trough' || !(b.fuel > 0.6)) continue; const d = Math.abs(b.x - a.tx) + Math.abs(b.y - a.ty); if (d < bd) { bd = d; best = b; } } return best; }
  function livestock(a, g, map) {
    a.moving = false; const def = a.def; const i = a.ty * map.w + a.tx;
    if (a.pettedT > 0) a.pettedT--; if (a.cool > 0) a.cool--;
    // потреби
    if (g.tick % 10 === 0) a.food -= 0.00022 * (a.young ? 1.3 : 1);
    if (a.food <= 0) { a.food = 0; if (g.tick % 60 === 0) { a.hp -= 1.2; if (a.hp <= 0) { a.die(null); return; } } }
    if (a.food < 0.18 && g.tick - (a.hungryWarn || -9999) > 2 * DY) { a.hungryWarn = g.tick; RW.UI && RW.UI.toast(a.name + ' (' + def.name.toLowerCase() + ') голодує! Потрібно сіно у годівниці або пасовище', 'bad'); }
    // продукти
    if (!a.young && a.food > 0.3) { if (def.prod === 'wool') a.wool = Math.min(1, (a.wool || 0) + 1 / (6 * DY)); else if (def.prod === 'milk' && a.gender === 'F') a.milk = Math.min(1, (a.milk || 0) + 1 / (1.3 * DY)); else if (def.prod === 'egg' && a.gender === 'F') { a.egg = (a.egg || 0) + 1 / (1.1 * DY); if (a.egg >= 1) { a.egg = 0; map.addItem('egg', 1, a.tx, a.ty); if (RW.FX2) RW.FX2.emit('sparkle', a.x, a.y - 0.2, { c: '#fff2c0' }); } } }
    if (a.young) { const age = (g.tick - (a.born || 0)) / (4 * DY); if (age >= 1) { a.young = false; } }
    if (a.preg && g.tick >= a.preg && a.gender === 'F') { a.preg = 0; H.birth(a, g); }
    if (!a.preg && a.gender === 'F' && !a.young && a.food > 0.6 && g.tick % 300 === (a.id % 300) && g.animals.filter(x => x.faction === 'colony' && x.def.livestock).length < 26) {
      const mate = g.animals.find(m => m !== a && m.species === a.species && m.faction === 'colony' && m.gender === 'M' && !m.young && !m.dead && Math.hypot(m.x - a.x, m.y - a.y) < 6);
      if (mate && Math.random() < 0.28) { a.preg = g.tick + 3.5 * DY; if (RW.FX2) RW.FX2.burst('heart', (a.x + mate.x) / 2, a.y - 0.4, 3); }
    }
    // поведінка
    if (a.state === 'graze') { if (--a.t <= 0) { a.state = 'idle'; a.t = U.ri(60, 200); } else { a.food = Math.min(1, a.food + 0.0006); if (g.tick % 50 === 0 && RW.FX2) RW.FX2.emit('sparkle', a.x + (a.face === 3 ? -0.5 : 0.5), a.y + 0.2, { c: '#9ac060' }); } return; }
    if (a.state === 'eat') { const b = a.trough; if (!b || b.dead || b.fuel < 0.2) { a.state = 'idle'; return; } if (--a.t <= 0) { a.state = 'idle'; a.t = 60; return; } if (a.t % 12 === 0) { b.fuel = Math.max(0, b.fuel - 0.15); a.food = Math.min(1, a.food + 0.05); if (RW.FX2 && Math.random() < 0.4) RW.FX2.emit('sparkle', a.x, a.y - 0.2, { c: '#e8d070' }); } return; }
    if (a.path && (a.state === 'wander' || a.state === 'goeat')) {
      if (AI.stepPath(a)) { a.path = null; a.destKey = null; if (a.state === 'goeat' && a.trough && !a.trough.dead) { a.state = 'eat'; a.t = 120; } else a.state = 'idle'; } return;
    }
    if (a.state === 'wander' || a.state === 'goeat') { a.state = 'idle'; }
    if (--a.t > 0) return; a.t = U.ri(90, 320);
    if (a.food < 0.6) { const tr = nearTrough(a, map); if (tr) { const r = AI.moveTo(a, tr.x, tr.y, { adj: true, maxIter: 500 }); if (r !== 'fail') { a.trough = tr; a.state = 'goeat'; return; } } }
    const fert = D.terrain[map.terrain[i]].fert; if (a.food < 0.95 && fert >= 0.3 && g.outTemp > 2 && map.terrain[i] !== 6 && Math.random() < 0.55) { a.state = 'graze'; a.t = U.ri(110, 260); return; }
    // блукання (у загоні, якщо є)
    const pens = penCells(g); let x, y;
    if (pens.length) { const c = pens[U.ri(0, pens.length - 1)]; x = c % map.w; y = (c / map.w) | 0; } else { x = Math.round(g.home.x + U.rr(-10, 10)); y = Math.round(g.home.y + U.rr(-10, 10)); }
    if (map.inb(x, y) && map.cost[y * map.w + x] > 0 && map.terrain[y * map.w + x] > 1) { const r = AI.moveTo(a, x, y, { maxIter: 500 }); if (r !== 'fail') a.state = 'wander'; }
  }
  H.birth = function (a, g) {
    const y = new RW.Animal(a.species, a.x + U.rr(-0.4, 0.4), a.y + U.rr(-0.4, 0.4)); y.faction = 'colony'; y.name = U.pick(NAMES); y.young = true; y.born = g.tick; aprep(y); y.food = 0.7; g.animals.push(y);
    if (RW.FX2) { RW.FX2.burst('heart', a.x, a.y - 0.4, 6); RW.FX2.burst('sparkle', a.x, a.y - 0.2, 8, { c: '#ffd8e8' }); } RW.UI && RW.UI.toast('Народилось: ' + a.def.name.toLowerCase() + ' «' + y.name + '»!', 'good');
  };
  // подія: смерть тварини
  const ad = AP.die; AP.die = function (src) { const was = this.faction === 'colony' && !this.dead; ad.call(this, src); if (was) for (const p of G().pawns) if (p.faction === 'colony' && !p.dead && Math.hypot(p.x - this.x, p.y - this.y) < 12 && !this.slaughtered) p.addThought('pet_died'); };
  // ---------- Малювання ----------
  const origDraw = RW.GFX.drawAnimal;
  RW.GFX.drawAnimal = function (c, a, px, py, s) {
    if (!a.def.livestock) return origDraw.call(this, c, a, px, py, s);
    const d = a.def, sp = a.species; const grow = a.young ? 0.55 + 0.45 * Math.min(1, (G().tick - (a.born || 0)) / (4 * DY)) : 1; const sz = d.size * grow;
    const face = a.face, side = face === 1 || face === 3, dir = face === 3 ? -1 : 1; const ph = a.phase || 0; const leg = a.moving ? Math.sin(ph * 1.8) * 2.6 : 0; const grazing = a.state === 'graze' || a.state === 'eat'; const bob = grazing ? Math.sin(G().tick * 0.12) * 0.6 : 0;
    c.save(); c.translate(px, py); c.scale(s * sz, s * sz); if (a.dead) c.rotate(1.5);
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(1, 6, 10, 4, 0, 0, TAU); c.fill();
    const oval = (x, y, rx, ry, f, st) => { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fillStyle = f; c.fill(); if (st) { c.strokeStyle = st; c.lineWidth = 0.8; c.stroke(); } };
    const OL = 'rgba(30,20,12,.8)';
    if (sp === 'chicken') {
      const fx = side ? 1 : 0; c.fillStyle = '#e8a030'; c.fillRect(-2 + leg * 0.4, 3, 1.1, 4); c.fillRect(1.5 - leg * 0.4, 3, 1.1, 4);
      oval(0, 0, side ? 6.2 : 5, 4.6, '#f8f4ec', 'rgba(60,40,20,.6)'); oval(side ? -1.5 * dir : 0, 0.8, 3.4, 2.4, '#e4dccc'); if (side) { c.fillStyle = '#e4dccc'; c.beginPath(); c.moveTo(-5 * dir, -1); c.lineTo(-9 * dir, -4); c.lineTo(-6 * dir, 2); c.fill(); }
      const hx = side ? 5 * dir : 0, hy = side ? -4.5 + bob * 2 : (face === 0 ? 4.5 : -4.5); oval(hx, hy, 2.6, 2.6, '#faf6ee', 'rgba(60,40,20,.6)'); c.fillStyle = '#d83a30'; c.beginPath(); c.arc(hx, hy - 2.4, 1.3, 0, TAU); c.fill(); c.fillStyle = '#f0b030'; c.beginPath(); c.moveTo(hx + 2.4 * dir, hy); c.lineTo(hx + 4.6 * dir, hy + 0.6 + bob); c.lineTo(hx + 2.4 * dir, hy + 1.4); c.fill(); c.fillStyle = '#111'; c.fillRect(hx + 0.8 * dir, hy - 0.8, 1, 1);
    } else if (sp === 'sheep') {
      c.fillStyle = '#3a3028'; if (side) { for (const lx of [-5, -2, 3, 6]) c.fillRect(lx * dir - 1, 3 + ((lx + 2) % 3 === 0 ? leg : -leg) * 0.6, 2, 5); } else { c.fillRect(-4, 3 + leg * 0.5, 2, 5); c.fillRect(2, 3 - leg * 0.5, 2, 5); }
      const shorn = (a.wool || 0) < 0.3; const wc = shorn ? '#d8b8a0' : '#f4f0e4'; const R = side ? 9 : 7.5;
      if (shorn) { oval(0, 0, side ? 8 : 6, 5.4, wc, 'rgba(70,40,20,.5)'); } else { for (let k = 0; k < 9; k++) { const ang = k / 9 * TAU; oval(Math.cos(ang) * R * 0.62, Math.sin(ang) * 4.2, 4.4, 4, wc, 'rgba(120,110,90,.55)'); } oval(0, 0, R * 0.7, 4.6, '#fffdf4'); }
      const hx = side ? 9.5 * dir : 0, hy = side ? -1.5 + bob * 4 : (face === 0 ? 8 : -8); oval(hx, hy, 3.2, 3, '#3a3028'); oval(hx + 0.6 * dir, hy + 0.8, 1.8, 1.4, '#5a4a40'); c.fillStyle = '#eee'; c.fillRect(hx + 0.5 * dir, hy - 1, 1, 1);
    } else { // cow
      c.fillStyle = '#4a3a30'; if (side) { for (const lx of [-6, -3, 3, 6]) c.fillRect(lx * dir - 1.2, 3 + ((lx + 2) % 3 === 0 ? leg : -leg) * 0.6, 2.4, 6); } else { c.fillRect(-4.5, 3 + leg * 0.5, 2.6, 6); c.fillRect(2, 3 - leg * 0.5, 2.6, 6); }
      oval(0, 0, side ? 11 : 8, side ? 6.4 : 8.5, '#f6f2ea', 'rgba(50,40,30,.7)'); const hs = a.id; for (let k = 0; k < 3; k++) { const px2 = ((hs * 7 + k * 13) % 14) - 7, py2 = ((hs * 3 + k * 5) % 8) - 4; c.fillStyle = '#2a2420'; c.beginPath(); c.ellipse(px2 * (side ? 0.8 : 0.5), py2 * 0.6, 3 + k % 2, 2.4, k, 0, TAU); c.fill(); }
      if (side && a.gender === 'F') oval(-2 * dir, 6, 2.2, 1.6, '#f0b0a8');
      const hx = side ? 11.5 * dir : 0, hy = side ? -2 + bob * 4 : (face === 0 ? 9.5 : -9.5); oval(hx, hy, 4, 3.6, '#f6f2ea', 'rgba(50,40,30,.7)'); oval(hx + 1.6 * dir, hy + 1.2, 2.4, 1.8, '#f0b8a8'); c.fillStyle = '#222'; c.fillRect(hx + 0.4 * dir, hy - 1.4, 1.2, 1.2); c.strokeStyle = '#e8e0c0'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(hx - 1.4, hy - 3); c.quadraticCurveTo(hx - 3, hy - 5.5, hx - 4, hy - 4); c.moveTo(hx + 1.4, hy - 3); c.quadraticCurveTo(hx + 3, hy - 5.5, hx + 4, hy - 4); c.stroke();
      if (side) { c.strokeStyle = '#4a3a30'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-10 * dir, -1); c.quadraticCurveTo(-14 * dir, 3 + Math.sin(ph) * 2, -12 * dir, 6); c.stroke(); }
    }
    c.restore();
  };
  // ---------- Оверлей: готові продукти, голод, мітки ----------
  H.drawOverlay = function (c, TS, t) {
    const g = G(); c.save(); c.font = '11px "Segoe UI Emoji",sans-serif'; c.textAlign = 'center';
    for (const a of g.animals) {
      if (a.dead) continue; const x = a.x * TS, y = a.y * TS - 16 * a.def.size;
      if (a.tame && a.faction !== 'colony') { c.fillStyle = 'rgba(255,150,200,.9)'; c.fillText('💗', x, y - 4 + Math.sin(t * 0.1) * 2); }
      if (a.faction !== 'colony') continue;
      if (a.slaughter) c.fillText('🔪', x, y - 4);
      else if (a.def.prod === 'wool' && a.wool >= 1 && !a.young) { c.fillText('✂', x, y - 2 + Math.sin(t * 0.1 + a.id) * 2); }
      else if (a.def.prod === 'milk' && a.milk >= 1) { c.fillText('🥛', x, y - 2 + Math.sin(t * 0.1 + a.id) * 2); }
      else if (a.food != null && a.food < 0.2 && a.def.livestock) { c.fillText('❗', x, y - 2); }
      else if (a.preg) { c.fillText('🤰', x, y - 2); }
      if (a.tq) { c.fillText('🎓', x + 10, y + 4); }
      if (a.trained && a.trained.guard) c.fillText('🛡', x - 10, y + 6);
      if (a.name && RW.R.cam.zoom > 1.5) { c.font = '9px sans-serif'; c.fillStyle = 'rgba(255,255,255,.85)'; c.fillText(a.name, x, a.y * TS + 16); c.font = '11px "Segoe UI Emoji",sans-serif'; }
    }
    c.restore();
  };
  // ---------- UI ----------
  H.animalExtra = function (a) {
    if (a.faction !== 'colony') return '<div class="ibody"><button class="btn" data-act="animTame">' + (a.tame ? '❌ Скасувати приручення' : '🐾 Приручити') + '</button> <span class="sub">Приручення: ' + Math.round((a.def.tame || 0.2) * 100) + '% складність</span></div>';
    aprep(a); let h = '<div class="ibody">';
    h += '<div class="sub">Ситість</div><div class="zfill"><div class="zf" style="width:' + Math.round(a.food * 100) + '%"></div></div>';
    if (a.def.prod === 'wool') h += '<div class="sub">Вовна: ' + Math.round((a.wool || 0) * 100) + '%</div>'; if (a.def.prod === 'milk') h += '<div class="sub">Молоко: ' + Math.round((a.milk || 0) * 100) + '%' + (a.gender === 'M' ? ' (бик)' : '') + '</div>';
    h += '<div class="sub">' + (a.gender === 'F' ? '♀' : '♂') + (a.young ? ' · малюк' : '') + (a.preg ? ' · вагітна' : '') + '</div>';
    if (a.def.livestock) h += '<button class="btn xs" data-act="animSlaughter">' + (a.slaughter ? '❌ Скасувати забій' : '🔪 Забій') + '</button>';
    if (a.def.trainable) { h += '<div class="sub">Тренування:</div>'; for (const k of a.def.trainable) { const done = a.trained && a.trained[k]; h += '<button class="btn xs" ' + (done ? 'disabled' : '') + ' data-act="animTrain" data-id="' + k + '" title="' + H.TRAIN[k].d + '">' + H.TRAIN[k].ico + ' ' + H.TRAIN[k].l + (done ? ' ✓' : (a.tq === k ? ' (' + Math.round((a.trainP || 0) * 100) + '%)' : '')) + '</button>'; } }
    return h + '</div>';
  };
  H.tabHtml = function () {
    const g = G(); const list = g.animals.filter(a => a.faction === 'colony' && !a.dead); if (!list.length) return '<p class="sub">Тварин у колонії немає. Позначте дикоюо тварину: Архітектор → Накази → Приручити.</p>';
    let h = '<div class="sk-tbl">'; for (const a of list) { aprep(a); const pr = a.def.prod === 'wool' ? a.wool : a.def.prod === 'milk' ? a.milk : null; h += '<div class="arow"><span class="ai2">' + (a.def.ico || '🐾') + '</span><b>' + RW.UI.esc(a.name || a.def.name) + '</b><span class="sub">' + a.def.name + (a.young ? ' (малюк)' : '') + '</span><div class="zfill"><div class="zf" style="width:' + Math.round(a.food * 100) + '%"></div></div>' + (pr != null ? '<span>' + Math.round(pr * 100) + '%</span>' : '<span></span>') + '<span>' + (a.trained && a.trained.guard ? '🛡' : '') + (a.trained && a.trained.therapy ? '💞' : '') + (a.preg ? '🤰' : '') + '</span></div>'; } return h + '</div>';
  };
  H.install = function () {
    const UI = RW.UI; const A = UI.actions;
    A.animTame = () => { const s = G().sel; if (s && s.a) { s.a.tame = !s.a.tame; UI.toast(s.a.tame ? 'Призначено приручення' : 'Скасовано', 'info'); } };
    A.animSlaughter = () => { const s = G().sel; if (s && s.a) { s.a.slaughter = !s.a.slaughter; } };
    A.animTrain = el => { const s = G().sel; if (s && s.a) { s.a.tq = s.a.tq === el.dataset.id ? null : el.dataset.id; } };
  };
  window.addEventListener('load', H.install);
})();
