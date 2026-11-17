'use strict';
// ============================================================
//  spectate.js — наживо дивитись колонію друга (лише перегляд)
//  Друг надсилає статичну карту (раз на зміну) і 4 рази на секунду — позиції істот.
//  Глядач збирає «примарну» гру й малює її тим самим рендером; керувати нею не можна.
// ============================================================
(function () {
  const D = RW.D, U = RW.U; const Net = RW.Net, MP = RW.MP, R = RW.R;
  const Sp = RW.Spec = { viewing: false, providing: false, allow: true, loading: false, ghost: null, name: '' };
  const $ = id => document.getElementById(id);
  const send = o => Net.send(o);
  const CH = 40000;

  // ---------- передача великих повідомлень частинами ----------
  let sid = 0;
  function sendBig(kind, obj) {
    const s = JSON.stringify(obj); const id = ++sid; const n = Math.max(1, Math.ceil(s.length / CH));
    for (let i = 0; i < n; i++) if (!send({ t: 'specPart', k: kind, id, i, n, d: s.slice(i * CH, (i + 1) * CH) })) return false;
    return true;
  }
  const parts = {};
  function onPart(m) {
    const a = parts[m.id] || (parts[m.id] = { k: m.k, n: m.n, d: [] }); a.d[m.i] = m.d;
    for (let i = 0; i < a.n; i++) if (a.d[i] == null) return null;
    delete parts[m.id]; for (const k in parts) if (+k < m.id - 4) delete parts[k];
    return { k: a.k, o: JSON.parse(a.d.join('')) };
  }

  // ================= Сторона друга (віддає картинку) =================
  const sent = new Set(), sentA = new Set(); let lastSig = '', lastFull = 0;
  const cfgMin = g => ({ scenario: g.cfg.scenario, difficulty: g.cfg.difficulty, size: g.cfg.size, storyteller: g.cfg.storyteller, biome: g.biome, seed: g.cfg.seed, colonists: [] });
  function packStatic() {
    const g = RW.G, m = g.map; const roof = RW.Layers ? RW.Layers.arr(m) : null;
    const o = { w: m.w, h: m.h, biome: g.biome, cfg: cfgMin(g), home: g.home, name: MP.st().myName,
      terrain: U.u8ToB64(m.terrain), blk: U.u8ToB64(m.blk), floor: U.u8ToB64(m.floor), mroof: U.u8ToB64(m.mroof), gv: U.u8ToB64(m.groundVar), roof: roof ? U.u8ToB64(roof) : '' };
    o.plants = []; for (let i = 0; i < m.n; i++) { const p = m.plant[i]; if (p) o.plants.push([p.def, p.x, p.y, +p.growth.toFixed(2), Math.round(p.hp), 0, p.blight ? 1 : 0, p.v]); }
    o.items = []; let c = 0; for (const arr of m.items.values()) for (const it of arr) { if (c++ > 3000) break; o.items.push([it.def, it.n, it.i, it.forbid ? 1 : 0]); }
    o.blds = m.buildings.map(b => [b.key, b.x, b.y, b.rot, Math.round(b.hp), b.on === false ? 0 : 1, b.decon ? 1 : 0, b.fuel == null ? -1 : +(+b.fuel).toFixed(1)]);
    o.bps = m.blueprints.map(b => [b.def, b.x, b.y, b.rot]);
    return o;
  }
  function signature() {
    const g = RW.G, m = g.map; let pl = 0, bk = 0, fl = 0, rf = 0; const roof = RW.Layers ? RW.Layers.arr(m) : null;
    for (let i = 0; i < m.n; i++) { if (m.plant[i]) pl++; if (m.blk[i]) bk++; if (m.floor[i]) fl++; if (roof && roof[i]) rf++; }
    let it = 0; for (const a of m.items.values()) it += a.length;
    return [m.buildings.length, m.blueprints.length, pl, bk, fl, rf, it, g.pawns.length].join('|');
  }
  function sendInit() { const g = RW.G; if (!g || !g.map || Net.state !== 'open') return; lastSig = signature(); sendBig('init', packStatic()); }
  function packTick() {
    const g = RW.G; const ps = [], np = [], as = [], na = [];
    for (const p of g.pawns) {
      if (p.away || p.gone) continue;
      const f = (p.sleeping ? 1 : 0) | (p.downed ? 2 : 0) | (p.dead ? 4 : 0) | (p.drafted ? 8 : 0);
      ps.push([p.id, +p.x.toFixed(2), +p.y.toFixed(2), p.face | 0, p.moving ? 1 : 0, +(p.phase || 0).toFixed(2), f, p.faction === 'colony' ? 0 : p.faction === 'enemy' ? 1 : p.mpGuest != null ? 2 : 3]);
      if (!sent.has(p.id)) { sent.add(p.id); try { np.push(JSON.parse(JSON.stringify(p.serialize()))); } catch (e) { } }
    }
    for (const a of g.animals) {
      if (a.dead && !a.corpse) { /* труп лишаємо */ }
      as.push([a.id, +a.x.toFixed(2), +a.y.toFixed(2), a.face | 0, a.moving ? 1 : 0, +(a.phase || 0).toFixed(2), a.state || '', a.dead ? 1 : 0]);
      if (!sentA.has(a.id)) { sentA.add(a.id); na.push(Object.assign(a.serialize(), { young: !!a.young, born: a.born || 0 })); }
    }
    const fires = []; for (const f of g.map.fires.values()) fires.push([f.x, f.y, +f.int.toFixed(2)]);
    return { t: 'specT', k: g.tick, dl: +g.daylight.toFixed(3), wx: g.weather.type, sn: +(g.snow || 0).toFixed(2), ps, np, as, na, fi: fires };
  }
  setInterval(() => {
    if (!Sp.providing || Net.state !== 'open' || !RW.G || !RW.G.map || !MP.active()) return;
    const now = performance.now();
    if (now - lastFull > 15000) { lastFull = now; sent.clear(); sentA.clear(); }
    send(packTick());
  }, 250);
  setInterval(() => { if (Sp.providing && Net.state === 'open' && RW.G && RW.G.map && MP.active()) { const s = signature(); if (s !== lastSig) sendInit(); } }, 3000);

  function onReq(on) {
    if (!on) { Sp.providing = false; MP.dirty && (MP.dirty.card = true); return; }
    if (!Sp.allow) { send({ t: 'specNo' }); return; }
    Sp.providing = true; sent.clear(); sentA.clear(); lastFull = performance.now(); sendInit();
    RW.UI.toast('👁 ' + MP.st().peerName + ' дивиться вашу колонію (лише перегляд)', 'info'); MP.dirty && (MP.dirty.card = true);
  }

  // ================= Сторона глядача =================
  let ghost = null, gPawns = new Map(), gAnimals = new Map(), saveCam = null, raf = 0, lastT = 0, hud = null, startLetters = 0;

  function buildGhost(o) {
    const g = RW.Game.blankState(o.cfg); const m = g.map = new RW.GameMap(o.w, o.h); m.biome = o.biome;
    m.terrain.set(U.b64ToU8(o.terrain, m.n)); m.blk.set(U.b64ToU8(o.blk, m.n)); m.floor.set(U.b64ToU8(o.floor, m.n)); m.mroof.set(U.b64ToU8(o.mroof, m.n)); m.groundVar.set(U.b64ToU8(o.gv, m.n));
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) { const i = y * m.w + x; if (m.terrain[i] > 1) continue; let near = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (m.inb(xx, yy) && m.terrain[yy * m.w + xx] > 1 && m.blk[yy * m.w + xx] === 0) near = 1; } m.shore[i] = near; }
    for (const p of o.plants) { const pl = { id: U.nextId(), def: p[0], x: p[1], y: p[2], growth: p[3], hp: p[4], age: p[5], v: p[7] }; if (p[6]) pl.blight = true; m.plant[p[2] * m.w + p[1]] = pl; }
    for (let i = 0; i < m.n; i++) m.updateCost(i);
    for (const it of o.items) { m._putStack({ id: U.nextId(), def: it[0], n: it[1], i: it[2], forbid: !!it[3], age: 0, res: null }, it[2]); }
    for (const bd of o.blds) { if (!D.bld[bd[0]]) continue; const b = m.addBuilding(bd[0], bd[1], bd[2], bd[3]); if (!b) continue; b.hp = bd[4]; b.on = !!bd[5]; b.decon = !!bd[6]; b.fuel = bd[7] < 0 ? null : bd[7]; }
    for (const bp of o.bps) { if (D.bld[bp[0]]) m.addBlueprint(bp[0], bp[1], bp[2], bp[3]); }
    if (o.roof) m.roof = U.b64ToU8(o.roof, m.n);
    g.home = o.home; g.name = o.name; g.tradeSpot = { x: o.home.x + 6, y: o.home.y };
    g.outTemp = 15; g.daylight = 1; g.speed = 0;
    m.isActive = function (b) { return b.on !== false && (!b.def.fuel || (b.fuel || 0) > 0 || b.fuel == null); };
    m.allDirty = true; m.regionDirty = true; m.roomsDirty = true; m.lightDirty = true;
    try { m.rebuildRooms(15); } catch (e) { console.warn('ghost rooms', e); }
    try { m.rebuildLights(); } catch (e) { console.warn('ghost lights', e); }
    return g;
  }

  function applyInit(o) {
    const first = !ghost; const old = ghost;
    const g = buildGhost(o);
    if (old) { g.pawns = old.pawns; g.animals = old.animals; g.tick = old.tick; g.daylight = old.daylight; g.weather = old.weather; g.snow = old.snow; }
    ghost = g; Sp.ghost = g; R.viewG = g; R.reset(); if (first) enter(o);
    Sp.loading = false;
  }

  function mkPawn(o, keepPos) {
    const p = RW.Pawn.deserialize(o); const prev = gPawns.get(o.id);
    p.vx = p.x; p.vy = p.y; p.sleeping = !!o.sleeping; p.job = null;
    if (prev && keepPos) { p.x = prev.x; p.y = prev.y; p.vx = prev.vx; p.vy = prev.vy; p.face = prev.face; p.moving = prev.moving; p.phase = prev.phase; }
    return p;
  }
  function onTick(m) {
    if (!ghost) return;
    const g = ghost; g.tick = m.k; g.daylight = m.dl; g.snow = m.sn;
    if (!g.weather || g.weather.type !== m.wx) g.weather = { type: m.wx, left: 3000, t: 0 };
    for (const o of m.np || []) { const p = mkPawn(o, true); gPawns.set(o.id, p); }
    for (const o of m.na || []) {
      const a = RW.Animal.deserialize(o); a.vx = a.x; a.vy = a.y; const prev = gAnimals.get(o.id); if (prev) { a.x = prev.x; a.y = prev.y; a.vx = prev.vx; a.vy = prev.vy; }
      gAnimals.set(o.id, a);
    }
    const seenP = new Set(); for (const q of m.ps) {
      const p = gPawns.get(q[0]); if (!p) continue; seenP.add(q[0]); p.vx = q[1]; p.vy = q[2]; p.face = q[3]; p.moving = !!q[4]; p.phase = q[5];
      p.sleeping = !!(q[6] & 1); p.downed = !!(q[6] & 2); p.dead = !!(q[6] & 4); p.drafted = !!(q[6] & 8);
      p.faction = q[7] === 0 ? 'colony' : q[7] === 1 ? 'enemy' : q[7] === 2 ? 'guest' : (p.faction === 'colony' || p.faction === 'enemy' ? 'wanderer' : p.faction);
    }
    for (const id of Array.from(gPawns.keys())) if (!seenP.has(id)) gPawns.delete(id);
    const seenA = new Set(); for (const q of m.as) { const a = gAnimals.get(q[0]); if (!a) continue; seenA.add(q[0]); a.vx = q[1]; a.vy = q[2]; a.face = q[3]; a.moving = !!q[4]; a.phase = q[5]; a.state = q[6]; a.dead = !!q[7]; }
    for (const id of Array.from(gAnimals.keys())) if (!seenA.has(id)) gAnimals.delete(id);
    g.map.fires = new Map(); for (const f of m.fi || []) g.map.fires.set(f[1] * g.map.w + f[0], { i: 0, x: f[0], y: f[1], int: f[2], age: 0 });
    g.pawns = Array.from(gPawns.values()); g.animals = Array.from(gAnimals.values());
    if (!Sp.viewing) return; paintHud();
  }
  // плавне наближення до позицій з мережі
  function frame(t) {
    raf = requestAnimationFrame(frame); if (!ghost) return; const dt = Math.min(0.1, (t - lastT) / 1000 || 0.016); lastT = t; const k = 1 - Math.pow(0.0008, dt);
    for (const p of gPawns.values()) { p.x += (p.vx - p.x) * k; p.y += (p.vy - p.y) * k; }
    for (const a of gAnimals.values()) { a.x += (a.vx - a.x) * k; a.y += (a.vy - a.y) * k; }
    if (ghost.weather) ghost.weather.t++;
  }

  // ---------- вхід / вихід ----------
  function hudHtml() {
    const g = ghost; if (!g) return ''; const day = Math.floor(g.tick / D.DAY) - (g.startDay || 0) + 1; const hr = Math.floor((g.tick % D.DAY) / D.HOUR);
    const warn = RW.G && RW.G.letters && RW.G.letters.length > startLetters ? '<span class="spec-warn">⚠ у вашій колонії сталась подія</span>' : '';
    return '<b>👁 Колонія «' + (Sp.name || '') + '»</b><span>лише перегляд</span><span>' + String(hr).padStart(2, '0') + ':00</span><span>' + g.pawns.filter(p => p.faction === 'colony' && !p.dead).length + ' колоністів</span>' + warn + '<button id="spec-exit">Вийти (Esc)</button>';
  }
  function paintHud() { if (!hud) return; const h = hudHtml(); if (hud.dataset.h !== h) { hud.dataset.h = h; hud.innerHTML = h; const b = $('spec-exit'); if (b) b.onclick = Sp.stop; } }
  function enter(o) {
    Sp.viewing = true; Sp.name = o.name; saveCam = { x: R.cam.x, y: R.cam.y, zoom: R.cam.zoom }; startLetters = (RW.G && RW.G.letters) ? RW.G.letters.length : 0;
    R.cam.x = o.home.x; R.cam.y = o.home.y; R.cam.zoom = Math.min(R.cam.zoom, 1.2); R.clampCam();
    try { RW.UI.closeAllWin ? RW.UI.closeAllWin() : (RW.UI.win && Object.keys(RW.UI.win).forEach(w => RW.UI.win[w] && RW.UI.closeWin(w))); } catch (e) { }
    if (RW.UI) { RW.UI.tool = null; RW.UI.cat = null; }
    const ui = $('ui'); if (ui) ui.classList.add('hidden');
    hud = document.createElement('div'); hud.id = 'spec-hud'; hud.className = 'spec-hud'; document.body.appendChild(hud); paintHud();
    lastT = performance.now(); raf = requestAnimationFrame(frame);
    window.addEventListener('keydown', blockKeys, true); window.addEventListener('mousedown', blockMouse, true); window.addEventListener('mouseup', blockMouse, true);
    window.addEventListener('contextmenu', blockMouse, true); window.addEventListener('dblclick', blockMouse, true); window.addEventListener('click', blockMouse, true);
    MP.dirty && (MP.dirty.card = true);
  }
  const CAMK = /^(KeyW|KeyA|KeyS|KeyD|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|ShiftLeft|ShiftRight|Equal|Minus|NumpadAdd|NumpadSubtract)$/;
  function blockKeys(e) {
    if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); Sp.stop(); return; }
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (!CAMK.test(e.code)) { e.stopImmediatePropagation(); e.preventDefault(); }
  }
  function blockMouse(e) {
    const cv = R.canvas; if (!cv || e.target !== cv) return; if (e.button === 1) return; // середня кнопка — перетягування камери
    e.stopImmediatePropagation(); e.preventDefault();
  }
  Sp.stop = function (silent) {
    if (!Sp.viewing && !Sp.loading) return; const was = Sp.viewing; Sp.viewing = false; Sp.loading = false;
    cancelAnimationFrame(raf); window.removeEventListener('keydown', blockKeys, true); window.removeEventListener('mousedown', blockMouse, true); window.removeEventListener('mouseup', blockMouse, true);
    window.removeEventListener('contextmenu', blockMouse, true); window.removeEventListener('dblclick', blockMouse, true); window.removeEventListener('click', blockMouse, true);
    if (hud) { hud.remove(); hud = null; } const ui = $('ui'); if (ui) ui.classList.remove('hidden');
    ghost = null; Sp.ghost = null; R.viewG = null; gPawns.clear(); gAnimals.clear(); R.reset();
    if (saveCam) { R.cam.x = saveCam.x; R.cam.y = saveCam.y; R.cam.zoom = saveCam.zoom; R.clampCam(); saveCam = null; }
    if (RW.G && RW.G.map) RW.G.map.allDirty = true;
    if (Net.state === 'open') send({ t: 'specReq', on: false });
    if (was && !silent) RW.UI.toast('Ви повернулись у свою колонію', 'info');
    MP.dirty && (MP.dirty.card = true);
  };
  Sp.start = function () {
    if (Sp.viewing || Sp.loading) return; if (!MP.active() || !MP.online()) { RW.UI.toast('Немає зʼєднання з другом', 'bad'); return; }
    Sp.loading = true; send({ t: 'specReq', on: true }); RW.UI.toast('👁 Завантажуємо колонію друга…', 'info');
    setTimeout(() => { if (Sp.loading) { Sp.loading = false; RW.UI.toast('Друг не відповів (перевірте зʼєднання)', 'bad'); } }, 12000);
  };
  Sp.setAllow = v => { Sp.allow = !!v; if (!v && Sp.providing) { Sp.providing = false; send({ t: 'specNo' }); } };

  // ---------- повідомлення ----------
  Net.on((k, m) => {
    if (k === 'close') { if (Sp.viewing || Sp.loading) { Sp.stop(true); RW.UI && RW.UI.toast('Зʼєднання втрачено — повернулись у свою колонію', 'bad'); } Sp.providing = false; return; }
    if (k !== 'msg') return;
    switch (m.t) {
      case 'specReq': onReq(!!m.on); break;
      case 'specNo': if (Sp.viewing || Sp.loading) { Sp.stop(true); RW.UI.toast('Друг не дозволяє дивитись його колонію', 'bad'); } break;
      case 'specPart': { const r = onPart(m); if (r && r.k === 'init' && (Sp.viewing || Sp.loading)) { try { applyInit(r.o); } catch (e) { console.error(e); Sp.stop(true); RW.UI.toast('Не вдалося показати колонію друга', 'bad'); } } break; }
      case 'specT': if (Sp.viewing) onTick(m); break;
    }
  });
  window.addEventListener('beforeunload', () => { try { if (Sp.viewing) send({ t: 'specReq', on: false }); } catch (e) { } });
})();
