'use strict';
// ============================================================
//  main.js — налаштування, створення гри, головний цикл
// ============================================================
(function () {
  const D = RW.D, U = RW.U;
  const Game = RW.Game = { running: false, paused: false };

  // ---------- Налаштування ----------
  const DEF = { gfx: { res: 1, lighting: true, fps: false }, audio: { master: 0.8, music: 0.6, sfx: 0.8 }, game: { pauseOnLetter: true, edgeScroll: true, autosave: true } };
  RW.S = JSON.parse(JSON.stringify(DEF));
  try { const s = JSON.parse(localStorage.getItem('rw_settings') || 'null'); if (s) for (const k in DEF) Object.assign(RW.S[k], s[k] || {}); } catch (e) { }
  RW.saveSettings = function () { try { localStorage.setItem('rw_settings', JSON.stringify(RW.S)); } catch (e) { } };

  // ---------- Створення стану ----------
  Game.blankState = function (cfg) {
    const sc = D.scenarios.find(s => s.id === cfg.scenario) || D.scenarios[0];
    const diff = D.difficulties.find(s => s.id === cfg.difficulty) || D.difficulties[2];
    const n = (D.worldSizes.find(w => w.id === cfg.size) || D.worldSizes[1]).n;
    const g = {
      cfg, scenario: sc, diff, storyteller: cfg.storyteller || 'orest', biome: cfg.biome || 'temperate', seed: cfg.seed,
      map: new RW.GameMap(n, n), tick: 7 * D.HOUR + D.DAY * 4 * 0, speed: 1, lastSpeed: 1, pawns: [], animals: [], projectiles: [], letters: [], history: [],
      sel: null, home: { x: n / 2, y: n / 2 }, tileRes: new Map(), mineProg: new Map(), tradeSpot: { x: n / 2 + 6, y: n / 2 }, threats: [], threat: 0, raids: [], herds: {}, deadPawns: [],
      research: { done: new Set(), queue: [], current: null, progress: {} }, stats: { built: 0, crafted: 0, harvested: 0, kills: 0, raids: 0, trades: 0, spoiled: 0 },
      story: { lastRaid: -2, lastTrader: -2, lastWander: -2, lastEvent: -2 }, weather: { type: 'clear', left: 3000, t: 0 }, outTemp: 15, daylight: 1, wealth: { items: 0, bld: 0, pawns: 0, total: 0 }, trader: null, snow: 0, flash: 0,
      tempOffset: null, flareUntil: 0, flare: false, flashLights: []
    };
    return g;
  };

  Game.start = function (cfg) {
    RW.R.reset(); RW.UI.reset();
    const g = Game.blankState(cfg); RW.G = g; U.setIdCounter(1);
    const map = g.map;
    map.generate({ seed: cfg.seed, biome: g.biome, mountain: cfg.mountain, water: cfg.water, trees: cfg.trees });
    RW.GFX.initTerrain(g.biome); RW.UI.clearIcons && RW.UI.clearIcons();
    for (const r of g.scenario.research || []) g.research.done.add(r);
    g.startDay = 7; g.tick = 7 * D.DAY + 7 * D.HOUR; g.story.next = g.tick + 1.3 * D.DAY; g.outTemp = RW.Events.computeOutTemp(); RW.Events.pickWeather(); g.outTemp = RW.Events.computeOutTemp(); g.daylight = RW.Events.daylight(g.tick);
    // дика фауна
    const bio = D.biomes[g.biome]; const rnd = U.rng(cfg.seed + 5);
    const want = Math.round(map.w * map.h / 260);
    for (let k = 0; k < want; k++) {
      const sp = U.weighted(bio.animals, a => a[1])[0]; const x = Math.floor(rnd() * map.w), y = Math.floor(rnd() * map.h);
      if (Math.hypot(x - g.home.x, y - g.home.y) < 18 || map.cost[y * map.w + x] === 0 || map.terrain[y * map.w + x] <= 1) continue;
      const hn = D.animals[sp].herd ? U.ri(2, 5) : 1; const hid = U.nextId();
      for (let q = 0; q < hn; q++) { const a = new RW.Animal(sp, x + 0.5 + U.rr(-1.5, 1.5), y + 0.5 + U.rr(-1.5, 1.5)); if (map.cost[Math.floor(a.y) * map.w + Math.floor(a.x)] === 0) { a.x = x + 0.5; a.y = y + 0.5; } a.herd = hid; g.animals.push(a); }
    }
    map.rebuildRooms(g.outTemp); map.rebuildLights();
    // колоністи
    const cx = Math.floor(g.home.x), cy = Math.floor(g.home.y);
    const spots = []; for (let r = 0; r < 6 && spots.length < 12; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const x = cx + dx * 2, y = cy + dy * 2; if (map.cost[y * map.w + x] > 0) spots.push([x, y]); }
    const crew = cfg.colonists.map(o => Game.makePawn(o, g.scenario));
    crew.forEach((p, i) => { const s = spots[i % spots.length]; p.x = s[0] + 0.5; p.y = s[1] + 0.5; });
    for (const p of crew) for (const o of crew) if (p !== o) p.opinion[o.id] = U.ri(0, 12);
    g.landing = true; g.speed = 0; g.planetName = cfg.planet;
    // катсцена: падіння корабля і висадка екіпажу
    RW.Cutscene.play(g, crew, Object.keys(g.scenario.items), spots, () => { g.landing = false; g.speed = 1; Game.afterLanding(); });
    // тварина
    if (g.scenario.pet) { const a = new RW.Animal(g.scenario.pet, g.home.x + 2.5, g.home.y + 2.5); a.faction = 'colony'; a.name = g.scenario.pet === 'dog' ? U.pick(['Рекс', 'Бім', 'Шарик', 'Лорд']) : U.pick(['Мурка', 'Барсик', 'Сніжок']); g.animals.push(a); }
    RW.R.cam.x = g.home.x; RW.R.cam.y = g.home.y; RW.R.cam.zoom = 1.3;
    Game.run();
  };
  Game.afterLanding = function () {
    const g = RW.G; const sc = g.scenario; if (RW.Rel) RW.Rel.initKin(g);
    RW.UI.letter('Початок', 'Ваші колоністи приземлилися на невідомій планеті (' + D.biomes[g.biome].name.toLowerCase() + '). ' + sc.desc + ' Позначте дерева для рубки (Архітектор → Накази), створіть склад і ліжка. Довідка — F1.', 'info', g.pawns[0], { x: g.home.x, y: g.home.y });
    RW.UI.hint('Усі припаси позначені <b>✖</b> (заборонені). Дозвольте їх: <b>Архітектор → Накази → Дозволити</b> або кнопка ✔ на панелі складу. Далі: Накази → Рубка; Зони → Склад; Меблі → ліжко. Швидкість: 1–4, пауза — Пробіл.');
    if (RW.S.audio.music > 0) RW.A.init();
  };

  Game.makePawn = function (o, sc) {
    const p = RW.Pawn.generate({ faction: 'colony', name: o.name, gender: o.gender, age: o.age, bio: o.bio, look: o.look, traits: o.traits, tribal: sc.tribal });
    if (o.skills) for (const sk of D.skills) { p.skills[sk].lvl = o.skills[sk].lvl; p.skills[sk].pas = o.skills[sk].pas; }
    p.recomputeBio();
    return p;
  };

  // ---------- Головний цикл ----------
  let last = 0, acc = 0, raf = 0, autosaveT = 0;
  const SPEEDS = [0, 1, 2, 4, 8]; // тіків за кадр при 60fps ~ швидкості
  let lagEma = 16, lagT = 0;
  Game.run = function () { RW.World && RW.World.prewarm && RW.World.prewarm(); Game.running = true; Game.paused = false; RW.UI.show(true); RW.Menu.hide(); if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  Game.stop = function () { Game.running = false; };

  Game.tickOnce = tickOnce;
  function tickOnce(g) {
    g.tick++;
    RW.Events.tickWorld();
    if (RW.Life) RW.Life.tick(g);
    if (g.tick % 5 === 0) RW.Combat.updateThreats();
    for (const p of g.pawns.slice()) { if (p.dead) continue; p.tickHealth && p.tickHealth(); p.tickNeeds && p.tickNeeds(); RW.AI.think(p); }
    for (const a of g.animals.slice()) if (!a.dead) RW.Combat.animalThink(a);
    RW.Combat.updateProjectiles(); RW.Combat.updateTurrets();
    if (g.tick % 60 === 0) { RW.Combat.updateHerds(); g.animals = g.animals.filter(a => !a.dead); }
    // видалити мертвих (колоністи залишаються в deadPawns через p.die)
    if (g.tick % 30 === 0) {
      for (let i = g.pawns.length - 1; i >= 0; i--) if (g.pawns[i].dead) g.pawns.splice(i, 1);
      if (g.sel && g.sel.p && !g.pawns.includes(g.sel.p)) g.sel = null;
    }
    if (g.tick % 30 === 0) { const tgt = (g.weather.type === 'snow' || g.outTemp < -3) ? 1 : 0; g.snow += (tgt - g.snow) * (tgt ? 0.02 : 0.01); if (Math.abs(g.snow) < 0.005) g.snow = 0; }
    if (g.tick % 600 === 0) { const s = D.seasonOf(g.tick); if (s !== g.curSeason) { g.curSeason = s; RW.GFX.initSeason(s); RW.R.invalidateAll(); } }
    if (g.tick % 10 === 0) RW.A && RW.A.setAmbient(g.weather.type);
    if (g.tick % 300 === 0) { RW.A && RW.A.setIntensity(g.threat > 0 ? 1 : 0); }
    Game.checkDefeat(g);
  }
  Game.checkDefeat = function (g) {
    if (g.over || g.landing) return; const alive = g.pawns.filter(p => p.faction === 'colony' && !p.dead);
    if (!alive.length && g.tick > g.startDay * D.DAY + 7 * D.HOUR + 600 && !RW.R.podsActive()) { g.over = true; g.speed = 0; RW.Menu.gameOver(); }
  };

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!Game.running) { return; }
    const g = RW.G; if (!g || !g.map) return;
    const dt = Math.min(100, now - last); last = now;
    // авто-оптимізація: якщо кадр стабільно довгий — вмикаємо легкий режим
    if (!RW.R.lite && !Game.paused && Game.running) { lagEma += (Math.min(dt, 200) - lagEma) * 0.03; if (lagEma > 30) { lagT++; if (lagT > 120) { RW.R.lite = true; if (RW.S.gfx.res > 0.8 && (window.devicePixelRatio || 1) > 1.25) { RW.S.gfx.res = 0.75; RW.R.resize(); } RW.UI && RW.UI.toast && RW.UI.toast('Увімкнено полегшену графіку (низький FPS)', 'info'); } } else lagT = 0; }
    if (!Game.paused) {
      acc += dt;
      const step = 1000 / 60; const mult = SPEEDS[g.speed] || 0; let n = 0;
      if (g.landing) { // лише ефекти
        acc = 0; RW.Cutscene.update();
      } else if (mult > 0) {
        const budget = 22; const t0 = performance.now();
        while (acc >= step && n < mult * 2) { acc -= step; for (let k = 0; k < Math.max(1, mult > 1 ? mult / 2 : 1) ; k++) { tickOnce(g); n++; if (performance.now() - t0 > budget) break; } if (performance.now() - t0 > budget) { acc = 0; break; } }
        if (acc > 200) acc = 0;
      } else acc = 0;
      if (RW.S.game.autosave && g.speed > 0) { autosaveT += dt; if (autosaveT > 120000) { autosaveT = 0; RW.Save.auto(); } }
    }
    RW.UI.updateCamera(); RW.R.draw(); RW.UI.update();
  }

  // ---------- Ініціалізація сторінки ----------
  window.addEventListener('load', function () {
    const cv = document.getElementById('game');
    RW.R.init(cv); RW.UI.init(); RW.UI.bindCanvas(cv); RW.Menu.init(); RW.Layers && RW.Layers.install();
    document.addEventListener('pointerdown', function once() { RW.A.init(); document.removeEventListener('pointerdown', once); });
    window.addEventListener('beforeunload', () => { });
    raf = requestAnimationFrame(frame);
  });
})();
