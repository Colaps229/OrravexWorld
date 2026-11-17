'use strict';
// ============================================================
//  events.js — час, погода, оповідач, рейди, торгівля, пожежі,
//  ріст рослин, псування предметів, дослідження
// ============================================================
(function () {
  const D = RW.D, U = RW.U;
  const E = RW.Events = {};
  const G = () => RW.G;

  // ---------- Час ----------
  E.hourFrac = tick => (tick % D.DAY) / D.HOUR;
  E.dayOfYear = tick => D.dayNum(tick) % D.YEAR_DAYS;
  E.timeString = tick => {
    const h = Math.floor((tick % D.DAY) / D.HOUR), m = Math.floor(((tick % D.HOUR) / D.HOUR) * 60);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  };
  const smooth = (a, b, x) => { const t = U.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  E.daylight = tick => {
    const h = E.hourFrac(tick);
    return Math.min(smooth(5.0, 7.8, h), 1 - smooth(18.2, 20.8, h));
  };

  E.computeOutTemp = function () {
    const g = G(); const bio = D.biomes[g.biome];
    const doy = E.dayOfYear(g.tick) + E.hourFrac(g.tick) / 24;
    const seasonal = bio.swing * (-Math.cos(2 * Math.PI * (doy - 52.5) / D.YEAR_DAYS));
    const hr = E.hourFrac(g.tick);
    const daily = bio.daily * Math.sin(2 * Math.PI * (hr - 9) / 24);
    let t = bio.temp + seasonal + daily + ((g.cfg && g.cfg.tempBias) || 0);
    const w = g.weather.type;
    if (w === 'rain') t -= 3; else if (w === 'storm') t -= 4; else if (w === 'snow') t -= 2; else if (w === 'cloudy') t -= 1;
    if (g.tempOffset && g.tick < g.tempOffset.until) t += g.tempOffset.v;
    return t;
  };

  // ---------- Погода ----------
  const WMUL = { clear: 1, cloudy: 0.55, rain: 0.25, storm: 0.15, snow: 0.3, fog: 0.5 };
  E.pickWeather = function () {
    const g = G(); const bio = D.biomes[g.biome]; const cold = g.outTemp < 1;
    const season = D.seasonOf(g.tick);
    let w = [['clear', 5], ['cloudy', 2.5]];
    if (cold && (bio.snowy || season === 3)) w.push(['snow', 2.4], ['fog', 0.7]);
    else if (g.outTemp < 36) { w.push(['rain', bio.rainy * 5], ['storm', bio.rainy * 1.3], ['fog', 0.6]); }
    const pick = U.weighted(w, x => x[1]);
    g.weather = { type: pick[0], left: U.ri(1.5, 6) * D.HOUR, t: 0 };
    if (g.map) g.map.weatherMul = WMUL[pick[0]] || 1;
  };
  E.tickWeather = function () {
    const g = G();
    if (--g.weather.left <= 0) { E.pickWeather(); }
    g.weather.t++;
    const wt = g.weather.type;
    if (wt === 'storm' && Math.random() < 0.0012) E.lightning();
    if (wt === 'rain' || wt === 'storm') {
      // дощ гасить пожежі
      for (const f of g.map.fires.values()) { f.int -= 0.0022; }
    }
  };
  E.lightning = function () {
    const g = G(), map = g.map; g.flash = 12;
    if (RW.A) RW.A.sfx('thunder');
    // удар поблизу колонії
    for (let k = 0; k < 12; k++) {
      const x = Math.floor(g.home.x + U.rr(-22, 22)), y = Math.floor(g.home.y + U.rr(-22, 22));
      if (!map.inb(x, y)) continue; const i = y * map.w + x;
      if (map.cost[i] === 0 && !map.plant[i]) continue;
      if (map.terrain[i] <= 1) continue;
      const flam = (map.bld[i] && map.bld[i].def.flam) || (map.plant[i] && D.plants[map.plant[i].def].flam) || 0;
      if (flam > 0 && Math.random() < 0.5) { E.startFire(i, 0.8); RW.R && RW.R.fx.bolt(x + 0.5, y + 0.5); break; }
    }
  };

  // ---------- Пожежі ----------
  E.startFire = function (i, int) {
    const g = G(), map = g.map;
    if (!map.inb(map.X(i), map.Y(i))) return;
    if (map.terrain[i] <= 1 || map.blk[i] > 0) return;
    if (g.weather.type === 'rain' || g.weather.type === 'storm') int *= 0.4;
    const f = map.fires.get(i);
    if (f) { f.int = Math.min(1, f.int + int * 0.5); return; }
    map.fires.set(i, { i, x: map.X(i), y: map.Y(i), int, age: 0 });
    RW.A && RW.A.sfx('fire');
  };
  function flamAt(map, i) {
    let f = 0.03;
    const b = map.bld[i]; if (b && b.def.flam) f = Math.max(f, b.def.flam);
    const p = map.plant[i]; if (p) f = Math.max(f, D.plants[p.def].flam || 0.3);
    const arr = map.items.get(i); if (arr) for (const it of arr) f = Math.max(f, D.items[it.def].flam || 0);
    if (map.terrain[i] === 4 || map.terrain[i] === 5) f = Math.max(f, 0.08);
    if (map.terrain[i] === 6 || map.terrain[i] <= 1 || map.blk[i] > 0 || map.terrain[i] === 7) f = map.terrain[i] === 6 ? 0.01 : 0;
    return f;
  }
  E.tickFires = function () {
    const g = G(), map = g.map; if (!map.fires.size) return;
    const w = map.w; const dead = [];
    for (const f of map.fires.values()) {
      f.age++; const i = f.i;
      let fuel = false;
      const b = map.bld[i];
      if (b && b.def.flam) { b.hp -= f.int * 5; fuel = true; if (b.hp <= 0) { RW.Combat.hitBuilding(b, 9999); } }
      const pl = map.plant[i];
      if (pl && D.plants[pl.def].flam) { pl.hp -= f.int * 8; fuel = true; if (pl.hp <= 0) { map.removePlant(i); map.desig.delete(i); } }
      const arr = map.items.get(i);
      if (arr) for (const it of arr.slice()) { const fl = D.items[it.def].flam; if (fl) { fuel = true; if (Math.random() < 0.04 * fl * f.int) { map.takeItem(it, Math.ceil(it.n * 0.3)); } } }
      for (const p of g.pawns) { if (p.tx === f.x && p.ty === f.y && !p.carriedBy) { p.takeDamage(1.2 * f.int + 0.3, 'fire', null); if (p.isColonist && Math.random() < 0.05) p.addThought('fire_nearby'); } }
      for (const a of g.animals) { if (a.tx === f.x && a.ty === f.y) a.takeDamage(1.5 * f.int, 'fire', null); }
      // розповсюдження
      if (f.int > 0.2) {
        for (const nb of [i - 1, i + 1, i - w, i + w]) {
          if (nb < 0 || nb >= map.n || map.fires.has(nb)) continue;
          if (Math.abs((nb % w) - (i % w)) > 1) continue;
          const fl = flamAt(map, nb);
          if (Math.random() < f.int * 0.012 * fl * (g.weather.type === 'rain' ? 0.2 : 1)) E.startFire(nb, 0.35);
        }
      }
      f.int += fuel ? 0.006 : -0.012; f.int = Math.min(1, f.int);
      if (f.int <= 0) dead.push(i);
    }
    for (const i of dead) map.fires.delete(i);
  };

  // ---------- Рослини, псування ----------
  E.tickPlants = function (dt) {
    const g = G(), map = g.map; const day = g.daylight;
    for (let i = 0; i < map.n; i++) {
      const p = map.plant[i]; if (!p) continue;
      const pd = D.plants[p.def]; if (pd.tree) continue;
      if (p.growth >= 1 && !pd.crop) continue; // дозріла не-культура: нічого рахувати
      const t = map.tempAt(i, g.outTemp);
      if (pd.crop) {
        if (t < -1 && !map.isRoofed(i)) { p.hp -= 0.4 * dt / 60; if (p.hp <= 0) { map.removePlant(i); continue; } }
        if (p.blight) { p.hp -= 0.12 * dt / 60; if (p.hp <= 0) { map.removePlant(i); continue; } }
      }
      if (p.growth >= 1) continue;
      const light = map.lightAt(i % map.w, (i / map.w) | 0, day); const fm = RW.Farming.mult(map, i, pd, t, light); const minT = (pd.minT != null ? pd.minT : 4) - fm.coldBonus;
      if (t < minT || t > 44) continue;
      const lf = fm.lf; const fert = fm.fert;
      const tf = U.clamp((t - minT) / 8, 0.15, 1);
      const rate = pd.crop ? dt / (pd.grow * 0.72) : dt / (pd.regrow || 14000);
      p.growth = Math.min(1, p.growth + rate * lf * fert * tf);
    }
  };
  E.tickItems = function (dt) {
    const g = G(), map = g.map;
    for (const [i, arr] of map.items) {
      const t = map.tempAt(i, g.outTemp);
      for (const it of arr.slice()) {
        const d = D.items[it.def];
        if (t > 0) it.age += dt * (t > 28 ? 1.4 : t < 10 ? 0.4 : 1);
        if (d.cat === 'corpse') {
          if (it.age > 5 * D.DAY) { map.removeItem(it); }
          continue;
        }
        if (d.rot && it.age > d.rot * (map.isRoofed(i) ? 1.15 : 1)) {
          map.removeItem(it);
          g.stats.spoiled = (g.stats.spoiled || 0) + 1;
        }
      }
    }
  };

  // ---------- Дослідження ----------
  E.unlocked = function (def) {
    const g = G(); if (!def.research) return true;
    return g.research.done.has(def.research);
  };
  E.canResearch = function (id) {
    const g = G(); const r = D.research[id]; if (g.research.done.has(id)) return false;
    return r.req.every(q => g.research.done.has(q));
  };
  E.queueResearch = function (id) {
    const g = G(); const rs = g.research;
    if (rs.done.has(id)) return;
    // додаємо залежності
    const add = (k) => { if (rs.done.has(k) || rs.queue.includes(k)) return; D.research[k].req.forEach(add); rs.queue.push(k); };
    add(id); rs.current = rs.queue[0] || null;
  };
  E.setResearchNow = function (id) {
    const rs = G().research; if (!E.canResearch(id)) return false;
    rs.queue = rs.queue.filter(x => x !== id); rs.queue.unshift(id); rs.current = id; return true;
  };
  E.finishResearch = function () {
    const g = G(); const rs = g.research; const id = rs.current; if (!id) return;
    rs.done.add(id); rs.queue = rs.queue.filter(x => x !== id);
    rs.current = rs.queue.find(x => E.canResearch(x)) || null;
    RW.UI && RW.UI.letter('Дослідження завершено', D.research[id].name + ' — ' + D.research[id].desc, 'good');
    RW.A && RW.A.sfx('research');
  };

  // ---------- Багатство ----------
  E.computeWealth = function () {
    const g = G(), map = g.map; let items = 0, bl = 0, pw = 0;
    for (const [i, arr] of map.items) for (const it of arr) { const d = D.items[it.def]; if (d.cat !== 'corpse') items += d.value * it.n; }
    for (const b of map.buildings) { let v = 0; for (const k in b.def.cost) v += (D.items[k] ? D.items[k].value : 1) * b.def.cost[k]; bl += v * 0.6; }
    for (const p of g.pawns) if (p.faction === 'colony') pw += 150 + p.skills.shooting.lvl * 4;
    g.wealth = { items: Math.round(items), bld: Math.round(bl), pawns: Math.round(pw), total: Math.round(items + bl + pw) };
  };

  // ---------- Оповідач ----------
  E.threatPoints = function () {
    const g = G(); const colonists = g.pawns.filter(p => p.faction === 'colony').length;
    const days = D.relDay(g.tick);
    const wealthTerm = Math.min(g.wealth.total / 150, 130);
    const st = D.storytellers.find(s => s.id === g.storyteller) || D.storytellers[0];
    let pts = (colonists * 22 + wealthTerm) * g.diff.threat * st.raid * (1 + days * 0.012);
    pts = Math.min(pts, 55 + days * 28);
    const turrets = g.map.buildings.filter(b => b.def.turret).length;
    return Math.max(25, pts - turrets * 6);
  };
  E.tickStory = function () {
    const g = G(); const s = g.story; const day = D.relDay(g.tick);
    const alive = g.pawns.filter(p => p.faction === 'colony').length; if (!alive) return;
    if (g.tick < s.next) return;
    const st = D.storytellers.find(x => x.id === g.storyteller) || D.storytellers[0];
    const evs = [
      { id: 'raid', w: (g.diff.threat > 0 && day >= g.diff.grace) ? 4.5 * st.raid * (day - s.lastRaid > 2 ? 1.4 : 0.25) : 0, fn: () => E.raid() },
      { id: 'trader', w: (day > 2 && !g.trader && day - s.lastTrader > 5) ? 3 : 0, fn: () => E.trader() },
      { id: 'wanderer', w: (day > 2 && alive < 10 && day - s.lastWander > 7) ? 2 : 0, fn: () => E.wanderer() },
      { id: 'herd', w: 2.2, fn: () => E.herd() },
      { id: 'cargo', w: 1.6, fn: () => E.cargo() },
      { id: 'manhunter', w: (day > 5 && g.diff.threat > 0) ? 1.2 : 0, fn: () => E.manhunter() },
      { id: 'disease', w: day > 14 ? 0.5 : 0, fn: () => E.disease() },
      { id: 'blight', w: (g.map.plant.some(p => p && D.plants[p.def].crop)) ? 0.9 : 0, fn: () => E.blight() },
      { id: 'coldsnap', w: (D.seasonOf(g.tick) !== 1 && day > 8 && !(g.tempOffset && g.tick < g.tempOffset.until)) ? 0.9 : 0, fn: () => E.tempEvent(-1) },
      { id: 'heatwave', w: (D.seasonOf(g.tick) === 1 && day > 8 && !(g.tempOffset && g.tick < g.tempOffset.until)) ? 1.4 : 0, fn: () => E.tempEvent(1) },
      { id: 'disaster', w: day > 5 ? 1.5 : 0, fn: () => RW.Disasters.random() },
      { id: 'flare', w: (day > 6 && g.map.buildings.some(b => b.def.power > 0)) ? 0.9 : 0, fn: () => E.flare() }
    ];
    const pick = U.weighted(evs, e => e.w);
    if (pick) { pick.fn(); }
    s.next = g.tick + U.rr(0.3, 0.9) * D.DAY / st.rate;
  };

  // Спавн по краю карти
  function edgeSpawn(map, home) {
    const rs = map.regionOf(Math.floor(home.y) * map.w + Math.floor(home.x));
    for (let k = 0; k < 80; k++) {
      const side = U.ri(0, 3); let x, y;
      if (side === 0) { x = U.ri(2, map.w - 3); y = 1; } else if (side === 1) { x = U.ri(2, map.w - 3); y = map.h - 2; } else if (side === 2) { x = 1; y = U.ri(2, map.h - 3); } else { x = map.w - 2; y = U.ri(2, map.h - 3); }
      const i = y * map.w + x; if (map.cost[i] > 0 && map.region[i] === rs) return { x, y, side };
    }
    for (let k = 0; k < 200; k++) { const x = U.ri(1, map.w - 2), y = U.ri(1, map.h - 2); const i = y * map.w + x; if (map.cost[i] > 0 && map.region[i] === rs && Math.hypot(x - home.x, y - home.y) > 25) return { x, y, side: 0 }; }
    return { x: 1, y: 1, side: 0 };
  }
  E.edgeSpawn = edgeSpawn;
  const SIDE = ['півночі', 'півдня', 'заходу', 'сходу'];

  E.makeRaider = function (kind, x, y, day) {
    const p = RW.Pawn.generate({ faction: 'enemy', age: U.ri(20, 50) });
    p.x = x + 0.5 + U.rr(-0.4, 0.4); p.y = y + 0.5 + U.rr(-0.4, 0.4);
    p.look.shirt = U.pick(['#5a2a2a', '#3a3a3a', '#4a3a2a', '#6a3a2a', '#2a2a2a']);
    p.look.pants = '#2e2a28';
    for (const k of ['shooting', 'melee']) p.skills[k].lvl = U.clamp(U.ri(3, 9) + Math.floor(day / 12), 0, 14);
    p.work = {}; p.noViolence = false; p.disabled = [];
    let w;
    if (kind === 'tribal') { w = Math.random() < 0.6 ? 'bow' : 'club'; if (Math.random() < 0.5) p.equip.apparel = 'tribal_wear'; }
    else { const r = Math.random(); w = (r < 0.45 ? 'revolver' : (r < 0.7 ? 'knife' : (day > 12 ? 'rifle' : 'revolver'))); if (day > 20 && Math.random() < 0.3) p.equip.apparel = 'flak_vest'; }
    p.equip.weapon = w; p.aiKind = kind;
    p.name = U.randomName(p.gender); p.name.nick = U.pick(['Шрам', 'Гієна', 'Пацюк', 'Іржавий', 'Гак', 'Кабан', 'Скалка', 'Кіготь']) + (Math.random() < 0.4 ? '' : '');
    p.needs.food = 1; p.needs.rest = 1;
    return p;
  };
  const RAID_COST = { spear: 22, stone_knife: 16, bow: 26, club: 20, revolver: 34, knife: 24, rifle: 52 };

  E.raid = function (pointsOverride, silent) {
    const g = G(), map = g.map; const day = D.relDay(g.tick);
    let pts = pointsOverride || E.threatPoints();
    const kind = (g.scenario && g.scenario.tribal && day < 25) || day < 8 ? 'tribal' : (Math.random() < 0.2 ? 'tribal' : 'pirate');
    const sp = edgeSpawn(map, g.home);
    const members = [];
    let guard = 0;
    while ((pts > 0 || members.length === 0) && guard++ < 40 && members.length < 28) {
      const p = E.makeRaider(kind, sp.x + U.ri(-2, 2), sp.y + U.ri(-2, 2), day);
      const cost = RAID_COST[p.equip.weapon] || 30; pts -= cost;
      const i = Math.floor(p.y) * map.w + Math.floor(p.x); if (map.cost[i] === 0) { p.x = sp.x + 0.5; p.y = sp.y + 0.5; }
      g.pawns.push(p); members.push(p.id);
    }
    g.raids.push({ id: U.nextId(), members, start: g.tick, kind });
    g.story.lastRaid = day; g.stats.raids++;
    if (!silent) RW.UI && RW.UI.letter('Рейд!', 'Ворожий загін (' + members.length + ') наближається з ' + SIDE[sp.side] + '. ' + (kind === 'tribal' ? 'Це племена з луками й кийками.' : 'Це пірати зі стрілецькою зброєю.') + ' Призовіть колоністів (R) і займіть оборону!', 'bad', null, { x: sp.x, y: sp.y });
    RW.A && RW.A.sfx('alert');
    return members;
  };

  E.manhunter = function () {
    const g = G(), map = g.map; const sp = edgeSpawn(map, g.home);
    const sp2 = g.biome === 'tundra' || Math.random() < 0.4 ? 'wolf' : 'boar';
    const n = U.ri(3, 5); const hid = U.nextId();
    for (let k = 0; k < n; k++) {
      const a = new RW.Animal(sp2, sp.x + U.rr(-1.5, 1.5) + 0.5, sp.y + U.rr(-1.5, 1.5) + 0.5);
      if (map.cost[Math.floor(a.y) * map.w + Math.floor(a.x)] === 0) { a.x = sp.x + 0.5; a.y = sp.y + 0.5; }
      a.manhunt = 9000; a.herd = hid; g.animals.push(a);
    }
    RW.UI && RW.UI.letter('Дикі тварини збожеволіли', 'Зграя тварин (' + D.animals[sp2].name.toLowerCase() + ') поводиться агресивно й прямує до колонії з ' + SIDE[sp.side] + '.', 'bad', null, { x: sp.x, y: sp.y });
    RW.A && RW.A.sfx('alert');
  };

  E.herd = function () {
    const g = G(), map = g.map; const sp = edgeSpawn(map, g.home);
    const bio = D.biomes[g.biome]; const kinds = bio.animals.filter(a => a[1] > 0 && D.animals[a[0]].herd);
    const k = U.weighted(kinds, a => a[1])[0]; const n = U.ri(5, 10); const hid = U.nextId();
    for (let q = 0; q < n; q++) {
      const a = new RW.Animal(k, sp.x + U.rr(-2, 2) + 0.5, sp.y + U.rr(-2, 2) + 0.5);
      if (map.cost[Math.floor(a.y) * map.w + Math.floor(a.x)] === 0) { a.x = sp.x + 0.5; a.y = sp.y + 0.5; }
      a.herd = hid; g.animals.push(a);
    }
    RW.UI && RW.UI.letter('Стадо тварин', 'Група тварин (' + D.animals[k].name.toLowerCase() + ', ' + n + ') з\'явилась на карті. Гарна нагода для полювання.', 'info', null, { x: sp.x, y: sp.y });
  };

  E.cargo = function () {
    const g = G(), map = g.map;
    const options = [['steel', 70, 130], ['components', 4, 9], ['silver', 250, 600], ['meal_simple', 12, 24], ['wood', 80, 160], ['medicine', 3, 6], ['gold', 8, 20]];
    const o = U.pick(options); const n = U.ri(o[1], o[2]);
    for (let k = 0; k < 20; k++) {
      const x = Math.floor(g.home.x + U.rr(-14, 14)), y = Math.floor(g.home.y + U.rr(-14, 14));
      if (!map.inb(x, y)) continue; const i = y * map.w + x; if (map.cost[i] === 0 || map.isRoofed(i)) continue;
      map.addItem(o[0], n, x, y, { forbid: true });
      RW.R && RW.R.fx.pod(x + 0.5, y + 0.5);
      RW.UI && RW.UI.letter('Падіння вантажу', 'З неба впали ' + n + ' × ' + D.items[o[0]].name.toLowerCase() + '! Вантаж позначено ✖ (заборонено) — щоб колоністи його брали, дозвольте: Архітектор → Накази → Дозволити, або кнопка ✔ на панелі складу.', 'good', null, { x, y });
      return;
    }
  };

  E.disease = function () {
    const g = G(); const cs = g.pawns.filter(p => p.faction === 'colony' && !p.ill.length);
    if (!cs.length) return; const p = U.pick(cs);
    const day = D.relDay(g.tick);
    const r = Math.random(); const id = r < 0.55 ? 'flu' : (r < 0.8 && g.biome === 'tropical' ? 'malaria' : (day > 18 && r > 0.88 ? 'plague' : 'flu'));
    p.addIllness(id, 0.06);
  };
  E.blight = function () {
    const g = G(), map = g.map; const kinds = new Set();
    for (const p of map.plant) if (p && D.plants[p.def].crop) kinds.add(p.def);
    if (!kinds.size) return; const k = U.pick(Array.from(kinds)); let n = 0;
    for (const p of map.plant) if (p && p.def === k && Math.random() < 0.55) { p.blight = true; n++; }
    RW.UI && RW.UI.letter('Хвороба рослин', 'Посіви «' + D.plants[k].name + '» уражені блайтом (' + n + '). Рослини поступово гинуть.', 'bad');
  };
  E.tempEvent = function (sign) {
    const g = G(); const dur = U.ri(2, 4) * D.DAY;
    g.tempOffset = { v: sign * U.ri(16, 24), until: g.tick + dur };
    RW.UI && RW.UI.letter(sign < 0 ? 'Різке похолодання' : 'Спека', sign < 0 ? 'Температура впала приблизно на ' + Math.abs(g.tempOffset.v) + '°C. Подбайте про тепло й одяг.' : 'Температура зросла приблизно на ' + g.tempOffset.v + '°C. Стежте за перегрівом.', sign < 0 ? 'bad' : 'warn');
  };
  E.flare = function () {
    const g = G(); g.flareUntil = g.tick + U.ri(0.7, 1.4) * D.DAY;
    RW.UI && RW.UI.letter('Сонячний спалах', 'Електроніка вийшла з ладу. Живлення вимкнено на деякий час.', 'warn');
  };
  E.wanderer = function () {
    const g = G(), map = g.map;
    const p = RW.Pawn.generate({}); const sp = edgeSpawn(map, g.home);
    p.faction = 'colony'; p.x = sp.x + 0.5; p.y = sp.y + 0.5; p.recomputeBio();
    p.equip.weapon = null;
    g.story.lastWander = D.relDay(g.tick);
    RW.UI && RW.UI.letter('Мандрівник', U.fullName(p) + ' (' + p.title + ', ' + p.age + ') просить прихистку в колонії.', 'good', null, { x: sp.x, y: sp.y }, [
      { label: 'Прийняти', fn: () => { g.pawns.push(p); p.addThought('new_world'); RW.UI.toast(U.shortName(p) + ' приєднався до колонії!', 'good'); initRelations(p); } },
      { label: 'Відмовити', fn: () => { } }
    ]);
  };
  function initRelations(p) { const g = G(); for (const o of g.pawns) { if (o === p || o.faction !== 'colony') continue; p.opinion[o.id] = U.ri(-5, 10); o.opinion[p.id] = U.ri(-5, 10); } }
  E.initRelations = initRelations;

  // ---------- Торгівля ----------
  const TRADE_POOL = [['steel', 60, 140], ['wood', 80, 200], ['components', 2, 7], ['meal_simple', 10, 24], ['meal_fine', 4, 10], ['herbal', 4, 10], ['medicine', 2, 6], ['cloth', 40, 100], ['leather', 20, 60], ['bow', 1, 2], ['club', 1, 2], ['knife', 1, 2], ['revolver', 1, 1], ['rifle', 0, 1], ['parka', 0, 1], ['flak_vest', 0, 1], ['gold', 4, 12], ['rice', 40, 90], ['potato', 30, 70], ['corn', 30, 60], ['stone_block', 40, 100], ['cotton', 40, 90]];
  E.trader = function () {
    const g = G(), map = g.map; const sp = edgeSpawn(map, g.home);
    const ids = [];
    const tp = RW.Pawn.generate({ faction: 'trader' }); tp.isTrader = true; tp.name.nick = tp.name.first; tp.title = 'Торговець'; tp.look.shirt = '#7a5a2a';
    const guards = U.ri(1, 2);
    const mk = (p) => { p.x = sp.x + 0.5 + U.rr(-1, 1); p.y = sp.y + 0.5 + U.rr(-1, 1); if (map.cost[Math.floor(p.y) * map.w + Math.floor(p.x)] === 0) { p.x = sp.x + 0.5; p.y = sp.y + 0.5; } p.leaveAt = g.tick + 1.6 * D.DAY; p.work = {}; g.pawns.push(p); ids.push(p.id); };
    mk(tp);
    for (let k = 0; k < guards; k++) { const gp = RW.Pawn.generate({ faction: 'trader' }); gp.equip.weapon = 'revolver'; gp.look.shirt = '#6a5a3a'; gp.title = 'Охоронець'; mk(gp); }
    const stock = {}; const n = U.ri(8, 13);
    for (let k = 0; k < n; k++) { const o = U.pick(TRADE_POOL); const c = U.ri(o[1], o[2]); if (c > 0) stock[o[0]] = (stock[o[0]] || 0) + c; }
    g.trader = { name: U.fullName(tp), pawnId: tp.id, ids, stock, silver: U.ri(500, 1300), leaveAt: g.tick + 1.6 * D.DAY };
    g.story.lastTrader = D.relDay(g.tick);
    RW.UI && RW.UI.letter('Торговий караван', 'Торговець ' + tp.name.first + ' прибув до колонії й залишиться приблизно на півтори доби. Клацніть по ньому, щоб торгувати.', 'good', tp, { x: sp.x, y: sp.y });
  };
  E.negotiator = function () { let b = 0; for (const p of G().pawns) if (p.faction === 'colony' && !p.downed) b = Math.max(b, p.skillLvl('social')); return b; };
  E.buyPrice = def => D.items[def].value * 1.3 * (1 - Math.min(0.25, E.negotiator() * 0.012));
  E.sellPrice = def => D.items[def].value * 0.5 * (1 + Math.min(0.25, E.negotiator() * 0.012));
  E.colonyStock = function () {
    const g = G(), map = g.map; const out = {};
    for (const [i, arr] of map.items) for (const it of arr) { if (it.forbid || it.res) continue; const d = D.items[it.def]; if (d.cat === 'corpse') continue; out[it.def] = (out[it.def] || 0) + it.n; }
    return out;
  };
  // buy: {def:n}, sell: {def:n}
  E.executeTrade = function (buy, sell) {
    const g = G(), map = g.map; const tr = g.trader; if (!tr) return 'Немає торговця';
    let cost = 0, gain = 0;
    for (const k in buy) { if ((tr.stock[k] || 0) < buy[k]) return 'У торговця немає стільки: ' + D.items[k].name; cost += E.buyPrice(k) * buy[k]; }
    const stock = E.colonyStock();
    for (const k in sell) { if (k === 'silver') continue; if ((stock[k] || 0) < sell[k]) return 'У вас немає стільки: ' + D.items[k].name; gain += E.sellPrice(k) * sell[k]; }
    const net = gain - cost; // + отримуємо срібло
    const silverHave = stock.silver || 0;
    if (net < 0 && silverHave < Math.ceil(-net)) return 'Не вистачає срібла (потрібно ' + Math.ceil(-net) + ')';
    if (net > 0 && tr.silver < Math.floor(net)) return 'У торговця недостатньо срібла (' + Math.floor(tr.silver) + ')';
    // виконання
    const removeFromMap = (def, n) => {
      const s = map.byDef.get(def); if (!s) return; let left = n;
      for (const it of Array.from(s)) { if (left <= 0) break; if (it.forbid || it.res) continue; const take = Math.min(left, it.n); map.takeItem(it, take); left -= take; }
    };
    for (const k in sell) { if (k === 'silver' || sell[k] <= 0) continue; removeFromMap(k, sell[k]); tr.stock[k] = (tr.stock[k] || 0) + sell[k]; }
    const spot = g.tradeSpot;
    for (const k in buy) { if (buy[k] <= 0) continue; tr.stock[k] -= buy[k]; if (tr.stock[k] <= 0) delete tr.stock[k]; map.addItem(k, buy[k], spot.x, spot.y); }
    if (net > 0) { map.addItem('silver', Math.floor(net), spot.x, spot.y); tr.silver -= Math.floor(net); }
    else if (net < 0) { removeFromMap('silver', Math.ceil(-net)); tr.silver += Math.ceil(-net); }
    g.stats.trades++;
    RW.A && RW.A.sfx('coin');
    return null;
  };

  // ---------- Головний цикл світу ----------
  E.tickWorld = function () {
    const g = G(), map = g.map;
    g.daylight = E.daylight(g.tick);
    g.flare = !!(g.flareUntil && g.tick < g.flareUntil);
    map.flare = g.flare;
    if (g.tick % 10 === 0) { g.outTemp = E.computeOutTemp(); }
    E.tickWeather();
    if (g.tick % 10 === 0) E.tickFires();
    if (g.tick % 20 === 0) {
      if (map.roomsDirty) map.rebuildRooms(g.outTemp);
      map.updateTemps(20, g.outTemp);
      map.updatePower(20, g.daylight);
    }
    if (map.lightDirty) map.rebuildLights();
    if (g.tick % 60 === 0) {
      E.tickPlants(60); E.tickItems(60);
      // паливо
      for (const b of map.buildings) { if (b.def.fuel && b.fuel > 0) { b.fuel = Math.max(0, b.fuel - b.def.fuel.burn * 60); if (b.fuel <= 0) b.fuel = 0; } }
      // двері
      for (const b of map.buildings) if (b.door && b.door.open > 0) b.door.open = Math.max(0, b.door.open - 1);
      // відновлення HP будівель
      for (const b of map.buildings) { if (b.hp < b.maxhp && !map.fires.has(b.y * map.w + b.x)) b.hp = Math.min(b.maxhp, b.hp + 0.2); }
    }
    if (g.tick % 600 === 0) E.computeWealth();
    if (g.tick % D.HOUR === 0) E.tickStory();
    // торговець пішов
    if (g.trader && !g.pawns.some(p => g.trader.ids.includes(p.id))) g.trader = null;
    // рейди закінчилися
    if (g.tick % 120 === 0) {
      for (let k = g.raids.length - 1; k >= 0; k--) {
        const r = g.raids[k];
        if (!r.members.some(id => g.pawns.find(p => p.id === id))) { g.raids.splice(k, 1); if (!r.ended) { RW.UI && RW.UI.log('Рейд відбито.'); } }
      }
    }
    // downed raiders: помирають від ран через час або повзуть геть
    if (g.tick % 300 === 0) {
      for (const p of g.pawns.slice()) {
        if (p.faction === 'enemy' && p.downed && !p.mpRaid) { p.downT = (p.downT || 0) + 1; if (p.downT > 8) { p.die('Рани, отримані в бою', null); } }
      }
    }
  };
})();
