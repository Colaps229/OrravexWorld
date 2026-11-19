'use strict';
// ============================================================
//  nature.js — природа (v0.9.5)
//   21) Харчовий ланцюг: вовки полюють на оленів/кролів, міграції стад за сезонами, голодні вовки
//   22) Риболовля й полювання: причал, човен (плавання за рибою), садок, пастка-петля
//   23) Дикі гриби й отруйні ягоди (потрібен досвід, щоб не отруїтись)
//   24) Торнадо (град і посуха вже є в грі)
//   25) Руїни й експедиції по артефакти
//  Вікно «Природа» (клавіша G). Усі числа — в об'єкті NT.
// ============================================================
(function () {
  const D = RW.D, U = RW.U, DY = D.DAY, AI = RW.AI, C = RW.Combat, E = RW.Events; const G = () => RW.G;
  const NT = RW.Nature = {
    PRED_RANGE: 14, PRED_CH: 0.35, PREY_LOW: 6, PREY_MIN: 4, MIG_N: [5, 8], WOLF_MANHUNT: 2600,
    FISH_TICKS: 300, FISH_COOL: 700, SAIL_TICKS: 800, SAIL_COOL: 3200, TRAP_EVERY: 0.6 * DY, SNARE_CH: 0.3, FISH_SEAS: [1.2, 1.0, 1.3, 0.5],
    PLANT_CAP: 14, POISON_SK: 6, POISON_CH: 0.5,
    TOR_CH: 0.035, TOR_FROM: 12, TOR_SPEED: 0.04, TOR_R: 2.3, TOR_DMG_B: 16, TOR_DMG_P: 9,
    RUIN_MAX: 3, RUIN_DIST: [16, 34], EXP_TICKS: 520, EXP_MEN: 2
  };
  const fx2 = (t, x, y, o) => RW.FX2 && RW.FX2.emit(t, x, y, o), burst = (t, x, y, n, o) => RW.FX2 && RW.FX2.burst(t, x, y, n, o);
  const cols = g => g.pawns.filter(p => p.faction === 'colony' && !p.dead);
  const dayN = g => D.relDay(g.tick), seas = g => D.seasonOf(g.tick);
  const ex = g => { const e = (g.ext = g.ext || {}); return (e.nat = e.nat || { ruins: [], tor: null, mig: [], lastSeason: -1, pred: 0, fish: 0, torHist: 0 }); };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const T = (id, l, v, days) => { D.thoughts[id] = { l, v, dur: days * DY }; };
  T('tornado_dread', 'Торнадо!', -6, 1); T('relic_found', 'Знайшли давню реліквію', 5, 3); T('fresh_fish', 'Свіжа риба до обіду', 2, 1.5); T('poisoned_berry', 'Отруївся дикими ягодами', -4, 2);
  const item = (id, o) => { o.id = id; o.stack = o.stack || 50; o.value = o.value || 1; D.items[id] = o; };
  item('fish', { name: 'Риба', cat: 'rawfood', kind: 'meat', nutr: 0.06, stack: 75, value: 2.2, color: '#7aa8c8', rot: 2.5 * DY, flam: 0.1 });
  item('mushroom', { name: 'Лісові гриби', cat: 'rawfood', kind: 'veg', nutr: 0.05, stack: 75, value: 1.6, color: '#c8a888', rot: 6 * DY, flam: 0.2 });
  item('nightshade', { name: 'Темні ягоди', cat: 'herb', stack: 75, value: 9, color: '#3a2a5a', rot: 12 * DY, flam: 0.4 });
  item('relic', { name: 'Давня реліквія', cat: 'misc', stack: 5, value: 420, color: '#d9b04a' });
  item('old_tech', { name: 'Давня техніка', cat: 'misc', stack: 10, value: 150, color: '#7fb0c8' });
  const dd = (id, o) => { D.plants[id] = o; };
  dd('wild_mushroom', { name: 'Лісові гриби', wild: true, item: 'mushroom', n: 4, work: 70, regrow: 3 * DY, hp: 8, flam: 0.3 });
  dd('nightshade', { name: 'Темні ягоди (невідомі)', wild: true, item: 'nightshade', n: 3, work: 80, regrow: 5 * DY, hp: 10, flam: 0.6, poison: true });

  // ---------- будівлі ----------
  const def = (id, o) => { o.id = id; o.w = o.w || 1; o.h = o.h || 1; o.cost = o.cost || {}; o.work = o.work == null ? 100 : o.work; o.hp = o.hp || 80; if (o.pass == null) o.pass = 1; o.flam = o.flam || 0.4; o.beauty = o.beauty || 0; o.shore = !!o.shore; D.bld[id] = o; return o; };
  def('fish_dock', { cat: 'production', name: 'Причал', desc: 'Ставиться на березі. Колоністи ловлять тут рибу вудкою. Взимку клює гірше.', cost: { wood: 25 }, work: 180, color: '#8a6a3a', shore: true, dock: 1 });
  def('boat_dock', { cat: 'production', name: 'Причал з човном', w: 2, desc: 'Колоніст відпливає на глибину на кілька годин і привозить багато риби. Штормова погода небезпечна.', cost: { wood: 60, cloth: 10 }, work: 320, color: '#7a5a30', shore: true, boat: 1 });
  def('fish_trap', { cat: 'production', name: 'Рибний садок', desc: 'Сам ловить рибу біля берега, колоністи лише підбирають улов.', cost: { wood: 18, cloth: 6 }, work: 110, color: '#8a7a4a', shore: true, ftrap: 1 });
  def('snare', { cat: 'production', name: 'Петля на звіра', desc: 'Іноді ловить кролів: м\'ясо й шкура лежать поруч.', cost: { wood: 8 }, work: 60, color: '#6a5a38', snare: 1 });
  const nearWater = (map, x, y, w, h) => { for (let dx = -1; dx <= w; dx++) for (let dy = -1; dy <= h; dy++) { if ((dx >= 0 && dx < w) && (dy >= 0 && dy < h)) continue; const xx = x + dx, yy = y + dy; if (map.inb(xx, yy) && map.terrain[yy * map.w + xx] <= 1) return [Math.sign(dx - (w - 1) / 2) || 0, Math.sign(dy - (h - 1) / 2) || 0, xx, yy]; } return null; };
  (function () {
    const GM = RW.GameMap.prototype; const cp = GM.canPlace;
    GM.canPlace = function (defKey, x, y, rot, opts) { const r = cp.apply(this, arguments); const d = D.bld[defKey]; if (!r && d && d.shore && !nearWater(this, x, y, d.w, d.h)) return 'Потрібен берег: поруч має бути вода'; return r; };
  })();
  const spr = {}; const cv = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d')); return c; };
  const planks = (c, x, y, w, h) => { c.fillStyle = '#7a5a30'; c.fillRect(x, y, w, h); c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1; for (let i = x + 6; i < x + w; i += 7) { c.beginPath(); c.moveTo(i, y); c.lineTo(i, y + h); c.stroke(); } c.strokeRect(x + .5, y + .5, w - 1, h - 1); };
  const SP = {
    fish_dock: () => cv(32, 32, c => { planks(c, 2, 10, 28, 12); c.fillStyle = '#4a3a22'; for (const px of [3, 27]) { c.fillRect(px, 7, 3, 18); } }),
    boat_dock: () => cv(64, 32, c => { planks(c, 2, 8, 60, 6); c.fillStyle = '#4a3a22'; for (const px of [3, 30, 58]) c.fillRect(px, 5, 3, 14); }),
    fish_trap: () => cv(32, 32, c => { c.strokeStyle = '#d8c890'; c.lineWidth = 1.4; for (let i = 0; i < 5; i++) { c.beginPath(); c.ellipse(16, 16, 12 - i, 9, 0, 0, 6.3); c.stroke(); } c.fillStyle = 'rgba(40,70,90,.35)'; c.beginPath(); c.ellipse(16, 16, 11, 8, 0, 0, 6.3); c.fill(); }),
    snare: () => cv(32, 32, c => { c.strokeStyle = '#6a5a38'; c.lineWidth = 2; c.beginPath(); c.arc(16, 18, 9, 0, 6.3); c.stroke(); c.fillStyle = '#4a3a22'; c.fillRect(14, 4, 4, 16); c.strokeStyle = '#c8b888'; c.lineWidth = 1; c.beginPath(); c.moveTo(16, 6); c.lineTo(22, 10); c.stroke(); })
  };
  const bs = RW.GFX.bldSprite; RW.GFX.bldSprite = function (k) { if (SP[k]) return spr[k] || (spr[k] = SP[k]()); return bs.apply(this, arguments); };
  const wd = (map, b) => b.wd || (b.wd = nearWater(map, b.x, b.y, b.def.w, b.def.h) || [0, 1, b.x, b.y + 1]);
  const boatShape = (c, x, y, ang, t) => { c.save(); c.translate(x, y); c.rotate(ang + Math.sin(t * 0.07) * 0.05); c.translate(0, Math.sin(t * 0.09) * 1.2); c.fillStyle = '#6a4222'; c.beginPath(); c.moveTo(-14, -3); c.lineTo(14, -3); c.lineTo(10, 5); c.lineTo(-10, 5); c.closePath(); c.fill(); c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 1; c.stroke(); c.fillStyle = '#d8c8a0'; c.fillRect(-1, -14, 2, 11); c.beginPath(); c.moveTo(1, -14); c.lineTo(10, -6); c.lineTo(1, -4); c.fill(); c.restore(); };
  D.bld.fish_dock.drawX = function (c, b, px, py, t, g) {
    if (b.fisher && !b.fisher.dead) { const w = wd(g.map, b); const bx = px + 16 + w[0] * 22, by = py + 16 + w[1] * 22; c.strokeStyle = 'rgba(240,240,240,.75)'; c.lineWidth = 1; c.beginPath(); c.moveTo(px + 16, py + 12); c.quadraticCurveTo((px + 16 + bx) / 2, py + 4, bx, by); c.stroke(); const bob = Math.sin(t * 0.2) * 2; c.fillStyle = '#ff5a4a'; c.beginPath(); c.arc(bx, by + bob, 2.4, 0, 6.3); c.fill(); c.strokeStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.ellipse(bx, by + bob + 2, 5 + (t % 40) / 8, 2 + (t % 40) / 16, 0, 0, 6.3); c.stroke(); }
  };
  D.bld.boat_dock.drawX = function (c, b, px, py, t, g) {
    const w = wd(g.map, b); const ang = w[0] ? 0 : 0; const away = b.sailT != null ? Math.min(1, (g.tick - b.sailT) / 100) : 0; const back = b.sailT != null && g.tick - b.sailT > NT.SAIL_TICKS - 100 ? Math.min(1, (g.tick - b.sailT - (NT.SAIL_TICKS - 100)) / 100) : 0; const f = away - back;
    const bx = px + 32 + w[0] * (10 + f * 90) + (w[0] ? 0 : Math.sin(t * 0.01) * 12 * f), by = py + 20 + w[1] * (10 + f * 90);
    boatShape(c, bx, by, 0, t); if (f > 0.5) { c.strokeStyle = 'rgba(255,255,255,' + (0.4 * f).toFixed(2) + ')'; c.beginPath(); c.ellipse(bx, by + 6, 14 + (t % 50) / 4, 4, 0, 0, 6.3); c.stroke(); }
  };
  D.bld.fish_trap.drawX = function (c, b, px, py, t, g) { if ((g.tick + b.x * 7) % 90 < 12) { c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.arc(px + 16 + Math.sin(t) * 3, py + 16, 2 + (g.tick % 12) / 6, 0, 6.3); c.fill(); } };

  // ---------- роботи ----------
  const fishYield = (g, p, base) => Math.max(1, Math.round(base * NT.FISH_SEAS[seas(g)] * (1 + p.skillLvl('plants') * 0.05)));
  AI.RUN.fish = function (p, j) {
    const g = G(), map = g.map; const b = j.b; if (!b || !map.buildings.includes(b)) { return 'fail'; }
    if (j.stage === 0) { const r = AI.moveTo(p, b.x, b.y, { adj: true }); if (r === 'fail') { b.fisher = null; return 'fail'; } if (r === 'arrived' || Math.hypot(p.x - b.x - 0.5, p.y - b.y - 0.5) < 1.6) { j.stage = 1; j.t = 0; p.moving = false; b.fisher = p; } return; }
    p.moving = false; const w = wd(map, b); AI.faceTo(p, w[2] + 0.5, w[3] + 0.5); j.t += p.workSpeed('plants'); p.gainXp('plants', 0.04);
    if (j.t % 55 < 1.1) fx2('sparkle', w[2] + 0.5, w[3] + 0.5, { c: '#bfe6ff' });
    if (j.t >= NT.FISH_TICKS) { b.fisher = null; b.fishT = g.tick; const n = fishYield(g, p, U.ri(2, 4)); const sx = Math.floor(b.x), sy = Math.floor(b.y); map.addItem('fish', n, sx, sy + 1 < map.h ? sy + 1 : sy); RW.R.fx.text(p.x, p.y - 1, '🐟 +' + n, '#9fd8ff'); p.addThought('fresh_fish'); ex(g).fish += n; if (g.stats) g.stats.fish = (g.stats.fish || 0) + n; return 'done'; }
  };
  AI.RUN.sail = function (p, j) {
    const g = G(), map = g.map; const b = j.b; if (!b || !map.buildings.includes(b)) { p.hidden = false; return 'fail'; }
    if (j.stage === 0) { const r = AI.moveTo(p, b.x, b.y, { adj: true }); if (r === 'fail') { b.fisher = null; return 'fail'; } if (r === 'arrived' || Math.hypot(p.x - b.x - 1, p.y - b.y - 0.5) < 2) { j.stage = 1; j.t0 = g.tick; j.sx = p.x; j.sy = p.y; p.hidden = true; p.moving = false; AI.resetMove(p); b.sailT = g.tick; b.fisher = p; RW.R.fx.text(b.x + 1, b.y - 0.3, '⛵', '#bfe6ff'); } return; }
    if (g.tick - j.t0 < NT.SAIL_TICKS) return;
    p.hidden = false; p.x = j.sx; p.y = j.sy; b.sailT = null; b.fisher = null; b.fishT = g.tick;
    const storm = g.weather && (g.weather.type === 'storm' || g.weather.type === 'blizzard'); const sk = p.skillLvl('plants');
    if (storm && Math.random() < 0.35 - sk * 0.01) { try { p.takeDamage(U.ri(6, 14), 'blunt'); } catch (e) { } RW.UI.letter('Шторм на воді', U.fullName(p) + ' ледь повернувся(лась) на берег: човен трощило хвилями. Улов втрачено.', 'warn', p); return 'done'; }
    const n = fishYield(g, p, U.ri(6, 10)) + (Math.random() < 0.08 ? 6 : 0); map.addItem('fish', n, Math.floor(b.x), Math.min(map.h - 1, Math.floor(b.y) + 1)); p.addThought('fresh_fish'); p.gainXp('plants', 0.9);
    RW.UI.toast('🐟 ' + U.shortName(p) + ' привіз(ла) з відкритої води ' + n + ' риби', 'good'); burst('coin', b.x + 1, b.y + 1, 6); ex(g).fish += n; if (g.stats) g.stats.fish = (g.stats.fish || 0) + n; return 'done';
  };
  const freeFor = (p, types) => !p.isChild && !p.drafted && !p.downed && !p.mental && !p.sleeping && !p.carry && p.mood > 28 && (!p.job || types.includes(p.job.type));
  function fishTick(g) {
    if (g.threat > 0) return; const hr = D.hour(g.tick); if (hr < 6 || hr > 19) return; const map = g.map; const idle = ['wander', 'chat', 'joy', 'stargaze'];
    for (const b of map.buildings) {
      if (!(b.def.dock || b.def.boat) || b.fisher || b.decon || g.tick - (b.fishT || -1e9) < (b.def.boat ? NT.SAIL_COOL : NT.FISH_COOL)) continue;
      if (b.def.dock && seas(g) === 3 && Math.random() < 0.5) continue;
      const c = cols(g).filter(p => freeFor(p, idle) && p.canDo && p.canDo('plants') && !p.busyFish).sort((a, d) => d.skillLvl('plants') - a.skillLvl('plants'))[0]; if (!c) continue;
      b.fisher = c; AI.endJob(c); AI.setJob(c, { type: b.def.boat ? 'sail' : 'fish', b, stage: 0 }); b.fishT = g.tick;
    }
  }
  function passiveTick(g) { // раз на 150 тіків: садки й петлі
    const map = g.map;
    for (const b of map.buildings) {
      if (b.def.ftrap) { if (g.tick - (b.trapT || 0) >= NT.TRAP_EVERY) { b.trapT = g.tick; const w = wd(map, b); const n = fishYield(g, { skillLvl: () => 0 }, U.ri(1, 3)); map.addItem('fish', n, b.x, Math.min(map.h - 1, b.y + 1)); fx2('sparkle', b.x + 0.5, b.y + 0.5, { c: '#bfe6ff' }); RW.R.fx.text(b.x + 0.5, b.y - 0.4, '🐟', '#9fd8ff'); ex(g).fish += n; if (g.stats) g.stats.fish = (g.stats.fish || 0) + n; } }
      else if (b.def.snare) { if (g.tick - (b.trapT || 0) >= DY * 0.5) { b.trapT = g.tick; if (Math.random() < NT.SNARE_CH + (seas(g) === 2 ? 0.15 : 0)) { map.addItem('meat', U.ri(6, 9), b.x, Math.min(map.h - 1, b.y + 1)); map.addItem('leather', U.ri(1, 3), b.x, Math.min(map.h - 1, b.y + 1)); burst('sparkle', b.x + 0.5, b.y + 0.5, 6, { c: '#e8c888' }); RW.R.fx.text(b.x + 0.5, b.y - 0.4, '🐇', '#e8c888'); } } }
    }
  }

  // ======================================================================
  //  21. ХАРЧОВИЙ ЛАНЦЮГ І МІГРАЦІЇ
  // ======================================================================
  const wild = (g, sp) => g.animals.filter(a => a.species === sp && a.faction === 'wild' && !a.dead);
  function predTick(g) { // раз на 45 тіків
    const wolves = wild(g, 'wolf').filter(a => !a.hostile && !(a.manhunt > 0) && (a.state === 'idle' || a.state === 'wander') && a.cool <= 0); if (!wolves.length) return; const prey = g.animals.filter(a => (a.species === 'deer' || a.species === 'rabbit') && a.faction === 'wild' && !a.dead);
    for (const w of wolves) { if (Math.random() > NT.PRED_CH) continue; let best = null, bd = NT.PRED_RANGE; for (const p of prey) { const d = Math.hypot(p.x - w.x, p.y - w.y); if (d < bd) { bd = d; best = p; } } if (best) { w.state = 'attack'; w.target = best; w.attackStart = g.tick; if (g.tick % 3 === 0) fx2('anger', w.x, w.y - 0.5); } }
  }
  const dmgHook = (() => { const AP = RW.Animal.prototype; const die = AP.die; AP.die = function (src) { const was = this.dead; const x = this.x, y = this.y; die.apply(this, arguments); if (!was && this.dead && src && src.kind === 'animal' && src.species === 'wolf' && G()) { ex(G()).pred++; burst('sparkle', x, y, 6, { c: '#d05a4a' }); } }; return 1; })();
  function floraFaunaDaily(g) {
    const e = ex(g), s = seas(g); const prey = g.animals.filter(a => (a.species === 'deer' || a.species === 'rabbit' || a.species === 'boar') && a.faction === 'wild' && !a.dead).length; const wolves = wild(g, 'wolf').length;
    // зміна сезону → міграція
    const sn = Math.floor(D.dayNum(g.tick) / D.SEASON_DAYS); if (sn !== e.lastSeason) { if (e.lastSeason >= 0 && (s === 0 || s === 2 || s === 3)) migrate(g, s === 2 ? 'boar' : 'deer', s); e.lastSeason = sn; }
    if (prey < NT.PREY_MIN && dayN(g) > 3) migrate(g, 'deer', -1);
    if (prey < NT.PREY_LOW && wolves >= 2 && dayN(g) > 6 && !g.animals.some(a => a.manhunt > 0) && Math.random() < 0.4) { // голодні вовки
      const pack = wild(g, 'wolf').slice(0, 4); for (const w of pack) { w.manhunt = NT.WOLF_MANHUNT; w.herd = w.herd || 9999; } RW.UI.letter('Голодні вовки', 'Дичини майже не лишилось, і зграя вовків (' + pack.length + ') полює на людей. Влаштуйте засідку або пастки.', 'bad', null, { x: pack[0].x, y: pack[0].y }); RW.A && RW.A.sfx('alert');
    }
    if (wolves < 1 && prey > 14 && g.biome !== 'arid' && Math.random() < 0.3) { const sp = E.edgeSpawn(g.map, g.home); const hid = U.nextId(); for (let k = 0; k < 2; k++) { const a = new RW.Animal('wolf', sp.x + 0.5 + U.rr(-1, 1), sp.y + 0.5 + U.rr(-1, 1)); if (g.map.cost[Math.floor(a.y) * g.map.w + Math.floor(a.x)] === 0) { a.x = sp.x + 0.5; a.y = sp.y + 0.5; } a.herd = hid; g.animals.push(a); } RW.UI.toast('🐺 Слідом за стадами з\'явилась зграя вовків', 'warn'); }
    e.mig = e.mig.filter(m => g.tick < m.until);
  }
  function migrate(g, sp, s) {
    const map = g.map, e = ex(g); const from = E.edgeSpawn(map, g.home); const n = U.ri(NT.MIG_N[0], NT.MIG_N[1]); const hid = U.nextId(); const tgt = { x: Math.round(g.home.x + U.rr(-14, 14)), y: Math.round(g.home.y + U.rr(-14, 14)) }; let ok = 0;
    for (let k = 0; k < n; k++) { const a = new RW.Animal(sp, from.x + 0.5 + U.rr(-1.6, 1.6), from.y + 0.5 + U.rr(-1.6, 1.6)); if (map.cost[Math.floor(a.y) * map.w + Math.floor(a.x)] === 0) { a.x = from.x + 0.5; a.y = from.y + 0.5; } a.herd = hid; g.animals.push(a); ok++;
      for (let t = 0; t < 8; t++) { const x = U.clamp(tgt.x + U.ri(-4, 4), 1, map.w - 2), y = U.clamp(tgt.y + U.ri(-4, 4), 1, map.h - 2); if (map.cost[y * map.w + x] > 0 && map.terrain[y * map.w + x] > 1) { const r = AI.moveTo(a, x, y, { maxIter: 3000 }); if (r !== 'fail') { a.state = 'wander'; break; } } } }
    e.mig.push({ x: from.x, y: from.y, hid, until: g.tick + DY * 1.2, sp, tx: tgt.x, ty: tgt.y });
    const nm = D.animals[sp].name.toLowerCase(); RW.UI.letter(s === 2 ? '🍂 Сезон полювання' : '🦌 Міграція стада', 'Зграя: ' + n + ' (' + nm + ') рухається через ваші землі' + (s === 2 ? '. Осінь — час запасатись м\'ясом і шкурами.' : '. Вдала нагода для полювання.') + ' Але де стадо — там і вовки.', 'good', null, { x: from.x, y: from.y });
  }
  NT.migrate = migrate;

  // ======================================================================
  //  23. ДИКІ ГРИБИ Й ОТРУЙНІ ЯГОДИ
  // ======================================================================
  const GS = RW.GFX.plantSprite; const psp = {};
  RW.GFX.plantSprite = function (def, growth, hp) {
    if (def !== 'wild_mushroom' && def !== 'nightshade') return GS.apply(this, arguments);
    const ripe = growth >= 1 ? 1 : 0; const key = def + ripe; if (psp[key]) return psp[key];
    return psp[key] = cv(32, 32, c => {
      if (def === 'wild_mushroom') { if (!ripe) { c.fillStyle = '#5a4a38'; c.fillRect(14, 22, 3, 3); return; } for (const [x, y, r] of [[10, 22, 5], [19, 18, 6.5], [23, 25, 4]]) { c.fillStyle = '#e8dcc8'; c.fillRect(x - 1.2, y, 2.4, 5); c.fillStyle = '#b4623a'; c.beginPath(); c.ellipse(x, y, r, r * 0.7, 0, Math.PI, 0); c.fill(); c.fillStyle = 'rgba(255,240,220,.7)'; c.beginPath(); c.arc(x - r * .3, y - r * .3, 1, 0, 6.3); c.fill(); } }
      else { c.strokeStyle = '#2a4a2a'; c.lineWidth = 1.6; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(16, 26); c.quadraticCurveTo(16 + (i - 2.5) * 4, 16, 16 + (i - 2.5) * 6, 8 + (i % 2) * 4); c.stroke(); } if (ripe) { for (const [x, y] of [[8, 10], [14, 7], [22, 11], [25, 17], [10, 19], [19, 15]]) { c.fillStyle = '#2a1a4a'; c.beginPath(); c.arc(x, y, 2.6, 0, 6.3); c.fill(); c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.arc(x - 0.8, y - 0.8, 0.8, 0, 6.3); c.fill(); } } }
    });
  };
  function plantsDaily(g) {
    const map = g.map, s = seas(g); const cnt = { wild_mushroom: 0, nightshade: 0 }; for (let i = 0; i < map.n; i++) { const p = map.plant[i]; if (p && cnt[p.def] != null) cnt[p.def]++; }
    const spawn = (defn, n, near) => { let made = 0; for (let k = 0; k < 60 && made < n && cnt[defn] < NT.PLANT_CAP; k++) { const x = Math.round(g.home.x + U.rr(-32, 32)), y = Math.round(g.home.y + U.rr(-32, 32)); if (!map.inb(x, y)) continue; const i = y * map.w + x; if (map.terrain[i] < 4 || map.plant[i] || map.bld[i] || map.blk[i] > 0 || map.cost[i] === 0) continue; if (near) { let t = false; for (let dx = -2; dx <= 2 && !t; dx++) for (let dy = -2; dy <= 2; dy++) { const q = map.plant[(y + dy) * map.w + x + dx]; if (q && D.plants[q.def].tree) { t = true; break; } } if (!t) continue; } try { map.addPlant(defn, x, y, 1); cnt[defn]++; made++; } catch (e) { } } return made; };
    let m1 = 0, m2 = 0; if (s === 0 || s === 2) m1 = spawn('wild_mushroom', 3, true); if (s === 1 || s === 2) m2 = spawn('nightshade', 2, false);
    if ((m1 || m2) && Math.random() < 0.5) RW.UI.toast('🍄 У лісі з\'явились дикі гриби й ягоди. Збирайте обережно: деякі ягоди отруйні!', 'info');
  }
  const rh = AI.RUN.harvest;
  AI.RUN.harvest = function (p, j) {
    const map = G().map; const pl = map.plant[j.i]; const wasPoison = pl && pl.def === 'nightshade'; const r = rh.apply(this, arguments);
    if (wasPoison && r === 'done' && p.skillLvl('plants') < NT.POISON_SK && Math.random() < NT.POISON_CH) { try { p.addIllness('food_poison', 0.14); } catch (e) { } p.addThought('poisoned_berry'); RW.R.fx.text(p.x, p.y - 1, '☠', '#b27aff'); RW.UI.toast('☠ ' + U.shortName(p) + ' отруївся(лась), збираючи темні ягоди — потрібен досвід у рослинництві (' + NT.POISON_SK + '+)', 'bad'); }
    return r;
  };

  // ======================================================================
  //  24. ТОРНАДО
  // ======================================================================
  function startTornado(g) {
    const e = ex(g); if (e.tor) return false; const map = g.map; const side = U.ri(0, 3); const o = U.rr(-14, 14); let x, y, dx, dy;
    if (side === 0) { x = 2; y = g.home.y + o; dx = 1; dy = U.rr(-0.25, 0.25); } else if (side === 1) { x = map.w - 3; y = g.home.y + o; dx = -1; dy = U.rr(-0.25, 0.25); } else if (side === 2) { y = 2; x = g.home.x + o; dy = 1; dx = U.rr(-0.25, 0.25); } else { y = map.h - 3; x = g.home.x + o; dy = -1; dx = U.rr(-0.25, 0.25); }
    const L = Math.hypot(dx, dy); e.tor = { x, y, dx: dx / L, dy: dy / L, t0: g.tick, hit: 0, lost: 0, killedPl: 0, deb: [] }; RW.UI.letter('🌪 Торнадо!', 'На горизонті — торнадо. Він рухається через карту й нищить усе на шляху. Сховайтесь під міцними дахами, відведіть колоністів від його траєкторії.', 'bad', null, { x, y }); RW.A && RW.A.sfx('alert'); return true;
  }
  NT.startTornado = startTornado;
  function tornadoTick(g) {
    const e = ex(g), t = e.tor; if (!t) return; const map = g.map; t.x += t.dx * NT.TOR_SPEED * 3 + Math.sin(g.tick * 0.01) * 0.02; t.y += t.dy * NT.TOR_SPEED * 3 + Math.cos(g.tick * 0.012) * 0.02; // викликається раз на 3 тіки
    if (t.x < -4 || t.y < -4 || t.x > map.w + 4 || t.y > map.h + 4) { RW.UI.letter('Торнадо розсіявся', 'Торнадо залишив карту. Зруйновано споруд: ' + t.hit + ', рослин: ' + t.killedPl + '.', t.hit ? 'warn' : 'good'); e.torHist++; e.tor = null; return; }
    if (g.tick % 6 === 0) {
      const r = NT.TOR_R;
      for (const b of map.buildings.slice()) { if (b.def.floor || b.def.moat) continue; if (Math.hypot(b.x + b.w / 2 - t.x, b.y + b.h / 2 - t.y) < r + b.w / 2) { C.hitBuilding(b, NT.TOR_DMG_B, null); t.hit++; } }
      for (const p of g.pawns) { if (p.dead || p.hidden) continue; const d = Math.hypot(p.x - t.x, p.y - t.y); if (d < r) { const roof = map.isRoofed && map.isRoofed(p.ty * map.w + p.tx); p.takeDamage(NT.TOR_DMG_P * (roof ? 0.35 : 1), 'blunt'); p.stun = Math.max(p.stun || 0, 60); if (p.faction === 'colony') p.addThought('tornado_dread'); const a = Math.atan2(p.y - t.y, p.x - t.x); p.x = U.clamp(p.x + Math.cos(a) * 1.2, 1, map.w - 2); p.y = U.clamp(p.y + Math.sin(a) * 1.2, 1, map.h - 2); } }
      for (const a of g.animals) { if (a.dead) continue; if (Math.hypot(a.x - t.x, a.y - t.y) < r) a.takeDamage(10, 'blunt'); }
      const x0 = Math.floor(t.x - r), y0 = Math.floor(t.y - r); for (let x = x0; x <= x0 + 2 * r + 1; x++) for (let y = y0; y <= y0 + 2 * r + 1; y++) { if (!map.inb(x, y) || Math.hypot(x + 0.5 - t.x, y + 0.5 - t.y) > r) continue; const i = y * map.w + x; const pl = map.plant[i]; if (pl && Math.random() < 0.35) { map.removePlant(i); t.killedPl++; } }
    }
  }
  function drawTornado(c, TS, t) {
    const e = ex(G()).tor; if (!e) return; const x = e.x * TS, y = e.y * TS; const g = G();
    c.save(); c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(x, y + 4, 48, 15, 0, 0, 6.3); c.fill();
    for (let k = 0; k < 14; k++) { const u = k / 13; const yy = y - u * 110; const w = 9 + u * 40 + Math.sin(t * 0.2 + k) * 2; const sh = Math.sin(t * 0.09 + k * 0.5) * (6 + u * 12); c.fillStyle = 'rgba(' + (90 + k * 5) + ',' + (95 + k * 4) + ',' + (105 + k * 3) + ',' + (0.55 - u * 0.15).toFixed(2) + ')'; c.beginPath(); c.ellipse(x + sh, yy, w, 5 + u * 5, 0, 0, 6.3); c.fill(); c.strokeStyle = 'rgba(230,235,245,.25)'; c.lineWidth = 1; c.beginPath(); c.ellipse(x + sh, yy, w * 0.8, (5 + u * 5) * 0.8, 0, 0.3 + t * 0.2 % 6, 2.6 + t * 0.2 % 6); c.stroke(); }
    while (e.deb.length < 26) e.deb.push({ a: Math.random() * 6.3, h: Math.random(), r: 8 + Math.random() * 40, s: 0.07 + Math.random() * 0.14, k: Math.random() });
    for (const d of e.deb) { d.a += d.s; const yy = y - d.h * 100, xx = x + Math.cos(d.a) * (d.r * (0.4 + d.h)) + Math.sin(t * 0.09 + d.h * 7) * 8 * d.h; c.fillStyle = d.k < 0.4 ? '#7a5a2a' : d.k < 0.7 ? '#4a7a3a' : '#8a8a8a'; c.fillRect(xx, yy + Math.sin(d.a) * 5, 3, 2); }
    c.restore();
  }

  // ======================================================================
  //  25. РУЇНИ Й ЕКСПЕДИЦІЇ
  // ======================================================================
  function ruinsDaily(g) {
    const e = ex(g), map = g.map; if (dayN(g) < 4) return; e.ruins = e.ruins.filter(r => !(r.st === 'done' && g.tick - r.doneT > DY * 3));
    if (e.ruins.filter(r => r.st === 'new').length >= NT.RUIN_MAX || Math.random() > 0.35) return;
    for (let k = 0; k < 80; k++) { const a = Math.random() * 6.283, d = U.rr(NT.RUIN_DIST[0], NT.RUIN_DIST[1]); const x = Math.round(g.home.x + Math.cos(a) * d), y = Math.round(g.home.y + Math.sin(a) * d); if (!map.inb(x, y) || x < 3 || y < 3 || x > map.w - 4 || y > map.h - 4) continue; const i = y * map.w + x; if (map.terrain[i] < 3 || map.cost[i] === 0 || map.bld[i] || e.ruins.some(r => Math.hypot(r.x - x, r.y - y) < 9)) continue;
      e.ruins.push({ id: U.nextId(), x, y, st: 'new', kind: U.pick(['temple', 'bunker', 'tower', 'camp']), seed: Math.floor(Math.random() * 1e6) }); RW.UI.toast('🏛 Розвідка помітила руїни неподалік — їх можна дослідити (вікно «Природа» [G])', 'info'); return; }
  }
  const KIND = { temple: 'Давній храм', bunker: 'Покинутий бункер', tower: 'Зруйнована вежа', camp: 'Табір мандрівників' };
  NT.expedition = function (id, men) {
    const g = G(), e = ex(g); const r = e.ruins.find(x => x.id === id); if (!r || r.st !== 'new') return;
    const all = cols(g); if (all.length < 3) return RW.UI.toast('Для експедиції потрібно мінімум 3 колоністи (дехто лишається вдома)', 'bad'); if (g.threat > 0) return RW.UI.toast('Зараз небезпечно — вороги на карті', 'bad');
    const sc = p => p.skillLvl('shooting') + p.skillLvl('melee') + p.skillLvl('medicine') * 0.6 + p.hp / 20; const cand = all.filter(p => !p.isChild && !p.drafted && !p.downed && !p.mental && p.mood > 25 && !(p.job && p.job.type === 'explore') && !p.hire).sort((a, b) => sc(b) - sc(a)).slice(0, Math.min(men || NT.EXP_MEN, all.length - 1));
    if (!cand.length) return RW.UI.toast('Немає вільних колоністів', 'bad'); r.st = 'exploring'; r.team = cand.map(p => p.id); r.t0 = null; r.resolved = false;
    for (const p of cand) { AI.endJob(p); AI.setJob(p, { type: 'explore', rid: r.id, stage: 0 }); } RW.UI.toast('🧭 Експедиція вирушила до: ' + KIND[r.kind] + ' (' + cand.map(p => U.shortName(p)).join(', ') + ')', 'good'); RW.A && RW.A.sfx('click');
  };
  RW.UI.actions.ntExp = el => NT.expedition(+el.dataset.id, +el.dataset.n || NT.EXP_MEN);
  AI.RUN.explore = function (p, j) {
    const g = G(), e = ex(g); const r = e.ruins.find(x => x.id === j.rid); if (!r || r.st === 'done') return 'done';
    if (j.stage === 0) { const rs = AI.moveTo(p, r.x, r.y, { adj: true, maxIter: 6000 }); if (rs === 'fail') { if (r.st === 'exploring') r.st = 'new'; return 'fail'; } if (rs === 'arrived' || Math.hypot(p.x - r.x - 0.5, p.y - r.y - 0.5) < 2.2) { j.stage = 1; j.t = 0; p.moving = false; if (!r.t0) r.t0 = g.tick; } return; }
    p.moving = false; AI.faceTo(p, r.x + 0.5, r.y + 0.5); j.t++; p.gainXp('research', 0.01); if (j.t % 40 === 0) fx2('sparkle', r.x + 0.5, r.y + 0.4, { c: '#ffe08a' });
    if (j.t >= NT.EXP_TICKS) { if (!r.resolved) { r.resolved = true; resolveRuin(g, r, p); } return 'done'; }
  };
  function resolveRuin(g, r, p) {
    const map = g.map; const team = (r.team || []).map(id => g.pawns.find(q => q.id === id)).filter(q => q && !q.dead); const tm = team.map(q => U.shortName(q)).join(', '); const roll = Math.random(); const sx = Math.floor(r.x), sy = Math.floor(r.y); r.st = 'done'; r.doneT = g.tick; const give = (def, n) => { map.addItem(def, n, sx, sy); return n + '× ' + (D.items[def] ? D.items[def].name : def); };
    if (roll < 0.52) { const loot = []; if (Math.random() < 0.4) { loot.push(give('relic', 1)); for (const q of team) q.addThought('relic_found'); } if (Math.random() < 0.6) loot.push(give('old_tech', U.ri(1, 2))); loot.push(give('components', U.ri(2, 5))); loot.push(give(U.pick(['steel', 'gold', 'medicine', 'silver']), U.ri(8, 50))); burst('coin', r.x + 0.5, r.y + 0.5, 14); RW.UI.letter('Експедиція повернулась зі здобиччю', tm + ' знайшли в руїнах: ' + loot.join(', ') + '. Все лежить біля руїн — заберіть, перш ніж стемніє.', 'good', null, { x: r.x, y: r.y }); RW.A && RW.A.sfx('good'); }
    else if (roll < 0.68) { for (const q of team) { try { q.takeDamage(U.ri(6, 14), 'blunt'); } catch (e) { } } map.addItem('old_tech', 1, sx, sy); RW.UI.letter('Обвал у руїнах', 'Стеля обвалилась на ' + tm + '. Усі живі, але побиті. Серед уламків — трохи давньої техніки.', 'warn', null, { x: r.x, y: r.y }); RW.R.shake = 6; }
    else if (roll < 0.80) { const members = []; for (let k = 0; k < 3; k++) { const q = E.makeRaider('pirate', r.x + U.ri(-2, 2), r.y + U.ri(-2, 2), dayN(g)); if (map.cost[Math.floor(q.y) * map.w + Math.floor(q.x)] === 0) { q.x = r.x + 0.5; q.y = r.y + 0.5; } g.pawns.push(q); members.push(q.id); } g.raids.push({ id: U.nextId(), members, start: g.tick, kind: 'ambush' }); RW.UI.letter('Засідка!', 'У руїнах ховалась банда — ' + tm + ' у бою!', 'bad', null, { x: r.x, y: r.y }); RW.A && RW.A.sfx('alert'); }
    else if (roll < 0.90) { const hid = U.nextId(); for (let k = 0; k < 2; k++) { const a = new RW.Animal(g.biome === 'tundra' ? 'wolf' : 'boar', r.x + 0.5 + U.rr(-2, 2), r.y + 0.5 + U.rr(-2, 2)); if (map.cost[Math.floor(a.y) * map.w + Math.floor(a.x)] === 0) { a.x = r.x + 0.5; a.y = r.y + 0.5; } a.manhunt = 1800; a.herd = hid; g.animals.push(a); } RW.UI.letter('Лігво звірів', 'У руїнах оселились дикі тварини — і вони налякані!', 'warn', null, { x: r.x, y: r.y }); }
    else { const q = RW.Pawn.generate({ age: U.ri(22, 50) }); q.faction = 'colony'; q.title = 'Вцілілий'; q.x = r.x + 0.5; q.y = r.y + 1.5; RW.UI.letter('Вцілілий у руїнах', 'У глибині руїн сидів виснажений чоловік. Він просить забрати його до колонії.', 'good', null, { x: r.x, y: r.y }, [{ label: '🤝 Прийняти', fn: () => { g.pawns.push(q); E.initRelations && E.initRelations(q); q.addThought('refuge_grateful'); RW.UI.toast(U.shortName(q) + ' приєднався до колонії', 'good'); burst('heart', q.x, q.y - 0.5, 5); } }, { label: 'Залишити', fn: () => { } }]); }
  }
  // малювання: руїни, міграції
  function drawWorld(c, TS, map, x0, y0, x1, y1, t) {
    const g = G(), e = ex(g); drawTornado(c, TS, t);
    for (const r of e.ruins) {
      if (r.x < x0 - 3 || r.x > x1 + 3 || r.y < y0 - 3 || r.y > y1 + 3) continue; const x = r.x * TS + 16, y = r.y * TS + 16; const done = r.st === 'done'; const rn = U.rng(r.seed);
      c.save(); c.globalAlpha = done ? 0.55 : 1; c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(x, y + 8, 40, 14, 0, 0, 6.3); c.fill();
      for (let k = 0; k < 7; k++) { const px = x + (rn() - 0.5) * 70, py = y + (rn() - 0.5) * 26, h = 6 + rn() * 22, w = 5 + rn() * 7; c.fillStyle = k % 2 ? '#8a867c' : '#767268'; c.fillRect(px - w / 2, py - h, w, h); c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(px - w / 2, py - h, 2, h); if (rn() < 0.5) { c.fillStyle = '#6a8a4a'; c.fillRect(px - w / 2, py - h * 0.3, w, 2.5); } c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 1; c.strokeRect(px - w / 2 + 0.5, py - h + 0.5, w - 1, h - 1); }
      if (r.kind === 'camp') { c.fillStyle = '#5a4a32'; c.beginPath(); c.moveTo(x - 14, y + 6); c.lineTo(x, y - 14); c.lineTo(x + 14, y + 6); c.closePath(); c.fill(); }
      c.restore();
      if (!done) { const pul = 0.5 + 0.5 * Math.sin(t * 0.08 + r.id); c.fillStyle = 'rgba(255,224,138,' + (0.25 + pul * 0.25).toFixed(2) + ')'; c.beginPath(); c.arc(x, y - 18, 10 + pul * 5, 0, 6.3); c.fill(); c.font = 'bold 14px sans-serif'; c.textAlign = 'center'; c.fillStyle = r.st === 'exploring' ? '#9fe08a' : '#ffe08a'; c.fillText(r.st === 'exploring' ? '🧭' : '❔', x, y - 14 + Math.sin(t * 0.1) * 2); if (t % 18 === 0) fx2('sparkle', r.x + 0.5 + U.rr(-1, 1), r.y - 0.2, { c: '#ffe08a' }); }
    }
    for (const m of e.mig) { const a = g.animals.filter(q => q.herd === m.hid && !q.dead); if (!a.length) continue; let cx = 0, cy = 0; for (const q of a) { cx += q.x; cy += q.y; } cx /= a.length; cy /= a.length; if (cx < x0 - 2 || cx > x1 + 2 || cy < y0 - 2 || cy > y1 + 2) continue; const fade = Math.min(1, (m.until - g.tick) / 600); c.font = '13px sans-serif'; c.textAlign = 'center'; c.globalAlpha = 0.85 * fade; c.fillText('🦌', cx * TS, cy * TS - 22 + Math.sin(t * 0.1) * 2); c.globalAlpha = 1; }
  }
  RW.R.worldOver.push(drawWorld);
  RW.Seas && RW.Seas.chips.push(g => { const e = ex(g); const out = []; if (e.tor) out.push({ k: 'tor', ico: '🌪', t: 'Торнадо!', cls: 'warn', pct: 1, title: 'Сховайтесь під міцним дахом' }); const ex2 = e.ruins.filter(r => r.st === 'exploring').length; if (ex2) out.push({ k: 'exp', ico: '🧭', t: 'Експедиція', cls: '', pct: 1, title: 'Колоністи досліджують руїни' }); return out; });

  // ======================================================================
  //  ВІКНО «ПРИРОДА»
  // ======================================================================
  RW.UI.addWin('nature', { title: '🌿 Природа', cls: 'win-wide', fn: function () {
    const g = G(), e = ex(g); const cnt = k => g.animals.filter(a => a.species === k && a.faction === 'wild' && !a.dead).length; const deer = cnt('deer'), rab = cnt('rabbit'), boar = cnt('boar'), wolf = cnt('wolf'); const prey = deer + rab + boar; const press = Math.max(0, Math.min(1, wolf / Math.max(1, prey / 3)));
    const SN = ['Весна', 'Літо', 'Осінь', 'Зима']; const mult = NT.FISH_SEAS[seas(g)];
    let h = '<div class="nat"><h4>🐾 Фауна</h4><div class="nat-row"><span>🦌 ' + deer + '</span><span>🐇 ' + rab + '</span><span>🐗 ' + boar + '</span><span>🐺 ' + wolf + '</span><span class="sub">вовки вполювали: ' + e.pred + '</span></div>';
    h += '<div class="sub">Тиск хижаків:</div><div class="nat-bar"><i style="width:' + Math.round(press * 100) + '%;background:' + (press > 0.7 ? '#e0584a' : press > 0.4 ? '#e0b84a' : '#7ad07a') + '"></i></div><p class="sub">Коли дичини мало, голодні вовки йдуть на людей. Міграції приходять на початку сезону (' + SN[seas(g)] + ').</p>';
    h += '<h4>🎣 Риболовля</h4><div class="sub">Сезонний клів: <b>×' + mult + '</b> · спіймано всього: <b>' + e.fish + '</b> · причалів: ' + g.map.buildings.filter(b => b.def.dock || b.def.boat).length + ' · садків: ' + g.map.buildings.filter(b => b.def.ftrap).length + ' · петель: ' + g.map.buildings.filter(b => b.def.snare).length + '</div><p class="sub">Архітектор → Виробництво: причал, причал з човном, рибний садок, петля.</p>';
    h += '<h4>🏛 Руїни й експедиції</h4>';
    if (!e.ruins.length) h += '<p class="sub">Руїн поки не знайдено. Розвідка помічає їх раз на кілька днів.</p>';
    for (const r of e.ruins) { const d = Math.round(Math.hypot(r.x - g.home.x, r.y - g.home.y)); const st = r.st === 'new' ? '<button class="btn xs" data-act="ntExp" data-id="' + r.id + '" data-n="2">🧭 Вислати 2</button> <button class="btn xs" data-act="ntExp" data-id="' + r.id + '" data-n="3">3</button>' : r.st === 'exploring' ? '<span class="pos">🧭 експедиція в дорозі…</span>' : '<span class="sub">✔ досліджено</span>'; h += '<div class="eco-card"><span class="eco-ico">' + (r.kind === 'camp' ? '⛺' : '🏛') + '</span><div class="eco-ci"><b>' + KIND[r.kind] + '</b><div class="sub">за ' + d + ' клітин · ' + ((r.x > g.home.x) ? 'схід' : 'захід') + '/' + ((r.y > g.home.y) ? 'південь' : 'північ') + '</div></div><div class="eco-rw">' + st + '</div></div>'; }
    h += '<h4>🌪 Лиха</h4><div class="sub">Торнадо вже було: ' + e.torHist + '. Град, токсичний дощ, посуха, повінь і землетруси — в основній грі.</div></div>'; return h;
  } });
  RW.UI.TABS.splice(RW.UI.TABS.length - 1, 0, { id: 'nature', label: 'Природа', key: 'G' }); RW.UI.keyWins.KeyG = 'nature';

  // ---------- підключення ----------
  const lt = RW.Life.tick;
  RW.Life.tick = function (g) {
    lt(g);
    try {
      const t = g.tick; if (t % 45 === 9) predTick(g); if (t % 90 === 31) fishTick(g); if (t % 150 === 77) passiveTick(g); if (t % 3 === 2) tornadoTick(g);
      if (t % DY === 1400) { floraFaunaDaily(g); plantsDaily(g); ruinsDaily(g); if (dayN(g) >= NT.TOR_FROM && !ex(g).tor && Math.random() < NT.TOR_CH && g.threat <= 0) startTornado(g); }
    } catch (er) { console.error(er); }
  };
  const jl = AI.jobLabel; AI.jobLabel = function (p) { const t = p.job && p.job.type; if (t === 'fish') return 'Ловить рибу'; if (t === 'sail') return 'Пливе по рибу'; if (t === 'explore') return 'Досліджує руїни'; return jl.apply(this, arguments); };
  NT._t = { predTick, floraFaunaDaily, plantsDaily, ruinsDaily, fishTick, passiveTick, tornadoTick, resolveRuin, ex };
})();
