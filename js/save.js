'use strict';
// ============================================================
//  save.js — збереження / завантаження (localStorage + файл)
// ============================================================
(function () {
  const D = RW.D, U = RW.U;
  const Save = RW.Save = {};
  const KEY = n => 'rw_save_' + n;

  function ser() {
    const g = RW.G, m = g.map; const o = { v: 1, time: Date.now() };
    o.meta = { day: D.relDay(g.tick) + 1, colonists: g.pawns.filter(p => p.faction === 'colony').length, scenario: g.scenario.name, biome: g.biome, diff: g.diff.name, seed: g.seed };
    o.ver = RW.VER ? RW.VER.num : 0; o.cfg = g.cfg; o.startDay = g.startDay; o.tick = g.tick; if (RW.Layers) RW.Layers.pack(g); if (RW.Farming) RW.Farming.pack(g); if (RW.Prisoners) RW.Prisoners.pack(g); o.ext = g.ext || {}; o.speed = g.speed; o.idc = U.getIdCounter(); o.home = g.home; o.tradeSpot = g.tradeSpot; o.storyteller = g.storyteller; o.biome = g.biome;
    o.research = { done: Array.from(g.research.done), queue: g.research.queue, current: g.research.current, progress: g.research.progress };
    o.stats = g.stats; o.story = g.story; o.weather = g.weather; o.tempOffset = g.tempOffset; o.flareUntil = g.flareUntil; o.snow = g.snow; o.raids = g.raids; o.herds = g.herds;
    o.history = g.history.slice(0, 120);
    o.w = m.w; o.h = m.h; o.mseed = m.seed;
    o.terrain = U.u8ToB64(m.terrain); o.blk = U.u8ToB64(m.blk); o.floor = U.u8ToB64(m.floor); o.mroof = U.u8ToB64(m.mroof); o.gv = U.u8ToB64(m.groundVar);
    o.plants = []; for (let i = 0; i < m.n; i++) { const p = m.plant[i]; if (p) o.plants.push([p.def, p.x, p.y, +p.growth.toFixed(3), Math.round(p.hp), p.age | 0, p.blight ? 1 : 0, p.v]); }
    o.items = []; for (const arr of m.items.values()) for (const it of arr) o.items.push({ def: it.def, n: it.n, i: it.i, forbid: it.forbid, age: it.age, data: it.data });
    o.blds = m.buildings.map(b => ({ id: b.id, key: b.key, x: b.x, y: b.y, rot: b.rot, hp: b.hp, fuel: b.fuel, owner: b.owner, on: b.on, bills: b.bills, buf: b.buf, charge: b.charge, occupant: b.occupant || null, decon: !!b.decon, age: b.age, own: b.own ? 1 : 0 }));
    o.bps = m.blueprints.map(b => ({ def: b.def, x: b.x, y: b.y, rot: b.rot, have: b.have, work: b.work }));
    o.zones = m.zones.map(z => ({ type: z.type, cells: Array.from(z.cells), filter: z.filter, crop: z.crop, sow: z.sow, priority: z.priority, pv: 2, name: z.name, fert: z.fert, cull: z.cull, corpse: z.corpse, spoiled: z.spoiled }));
    o.desig = Array.from(m.desig.entries());
    o.decals = m.decals.slice(-80);
    o.pawns = g.pawns.map(p => p.serialize());
    o.animals = g.animals.filter(a => !a.dead).map(a => a.serialize());
    o.trader = g.trader ? { ids: g.trader.ids, name: g.trader.name, silver: g.trader.silver, stock: g.trader.stock, leaveAt: g.trader.leaveAt } : null;
    o.cam = { x: RW.R.cam.x, y: RW.R.cam.y, zoom: RW.R.cam.zoom };
    return o;
  }

  Save.list = function () {
    const out = []; for (const slot of [1, 2, 3, 4, 5, 6, 7, 'auto']) { const m = localStorage.getItem(KEY(slot) + '_m'); if (m) { try { const o = JSON.parse(m); out.push({ slot, meta: o.meta, time: o.time }); } catch (e) { } } }
    return out;
  };
  Save.write = function (slot) {
    const g = RW.G; if (!g || !g.map) return false;
    try { const o = ser(); const s = JSON.stringify(o); localStorage.setItem(KEY(slot), s); localStorage.setItem(KEY(slot) + '_m', JSON.stringify({ meta: o.meta, time: o.time })); return true; }
    catch (e) { console.error(e); RW.UI.toast('Не вдалося зберегти: ' + e.message, 'bad'); return false; }
  };
  Save.quick = function () { if (Save.write(1)) RW.UI.toast('Збережено у слот 1', 'good'); };
  Save.auto = function () { if (Save.write('auto')) RW.UI.toast('Автозбереження', 'info'); };
  Save.remove = function (slot) { localStorage.removeItem(KEY(slot)); localStorage.removeItem(KEY(slot) + '_m'); };
  Save.exportFile = function () {
    const s = JSON.stringify(ser()); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([s], { type: 'application/json' })); a.download = 'colony_day' + (D.relDay(RW.G.tick) + 1) + '.rwsave'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  Save.loadSlot = function (slot) { const s = localStorage.getItem(KEY(slot)); if (!s) return false; try { return Save.restore(JSON.parse(s)); } catch (e) { console.error(e); alert('Збереження пошкоджене: ' + e.message); return false; } };
  Save.importText = function (text) { try { return Save.restore(JSON.parse(text)); } catch (e) { alert('Невірний файл збереження'); return false; } };

  Save.restore = function (o) {
    RW.R.reset(); RW.UI.reset();
    RW.GFX.initTerrain(o.biome);
    const g = RW.Game.blankState(o.cfg); RW.G = g; U.setIdCounter(o.idc);
    const m = g.map = new RW.GameMap(o.w, o.h); m.seed = o.mseed; m.biome = o.biome;
    m.terrain.set(U.b64ToU8(o.terrain)); m.blk.set(U.b64ToU8(o.blk)); m.floor.set(U.b64ToU8(o.floor)); m.mroof.set(U.b64ToU8(o.mroof)); m.groundVar.set(U.b64ToU8(o.gv));
    for (let i = 0; i < m.n; i++) if (m.terrain[i] <= 1) { /* берег перераховується нижче */ }
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) { const i = y * m.w + x; if (m.terrain[i] > 1) continue; let near = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (m.inb(xx, yy) && m.terrain[yy * m.w + xx] > 1 && m.blk[yy * m.w + xx] === 0) near = 1; } m.shore[i] = near; }
    g.startDay = o.startDay || 0; g.ext = o.ext || {}; g.tick = o.tick; g.speed = 0; g.lastSpeed = 1; g.home = o.home; g.tradeSpot = o.tradeSpot; g.storyteller = o.storyteller; g.biome = o.biome;
    g.research = { done: new Set(o.research.done), queue: o.research.queue, current: o.research.current, progress: o.research.progress };
    g.stats = o.stats; g.story = o.story; g.weather = o.weather; g.tempOffset = o.tempOffset; g.flareUntil = o.flareUntil; g.snow = o.snow || 0; g.raids = o.raids || []; g.herds = o.herds || {}; g.history = o.history || [];
    for (const p of o.plants) { const pl = { id: U.nextId(), def: p[0], x: p[1], y: p[2], growth: p[3], hp: p[4], age: p[5], v: p[7] }; if (p[6]) pl.blight = true; m.plant[p[2] * m.w + p[1]] = pl; }
    for (let i = 0; i < m.n; i++) m.updateCost(i);
    for (const it of o.items) { const x = { id: U.nextId(), def: it.def, n: it.n, i: it.i, forbid: it.forbid, age: it.age, res: null, data: it.data }; m._putStack(x, it.i); }
    const byId = {};
    for (const bd of o.blds) { const b = m.addBuilding(bd.key, bd.x, bd.y, bd.rot); if (!b) continue; b.id = bd.id; b.hp = bd.hp; b.fuel = bd.fuel; b.owner = bd.owner; b.on = bd.on; b.bills = bd.bills || []; b.buf = bd.buf || {}; b.charge = bd.charge; b.occupant = bd.occupant; b.decon = bd.decon; b.age = bd.age || 0; if (bd.own) b.own = 1; byId[b.id] = b; }
    for (const bp of o.bps) { const b = m.addBlueprint(bp.def, bp.x, bp.y, bp.rot); b.have = bp.have; b.work = bp.work; }
    for (const zd of o.zones) { const z = new RW.Zone(zd.type); z.filter = zd.filter; z.crop = zd.crop; z.sow = zd.sow; z.priority = zd.pv === 2 ? zd.priority : [1, 2, 3][zd.priority == null ? 1 : zd.priority]; z.name = zd.name || ''; z.fert = zd.fert; z.cull = zd.cull; z.corpse = zd.corpse; z.spoiled = zd.spoiled; for (const i of zd.cells) { z.cells.add(i); m.zoneAt[i] = z; } m.zones.push(z); }
    m.desig = new Map(o.desig); m.decals = o.decals || [];
    for (const po of o.pawns) { const p = RW.Pawn.deserialize(po); p.bed = po.bedId != null ? byId[po.bedId] || null : null; if (p.bed) p.bed.owner = p.id; g.pawns.push(p); }
    for (const ao of o.animals) g.animals.push(RW.Animal.deserialize(ao));
    if (o.trader) g.trader = o.trader;
    m.allDirty = true; m.regionDirty = true; m.roomsDirty = true; m.powerDirty = true; m.lightDirty = true;
    g.outTemp = RW.Events.computeOutTemp(); g.daylight = RW.Events.daylight(g.tick);
    m.rebuildRooms(g.outTemp); m.rebuildLights();
    RW.R.cam.x = o.cam.x; RW.R.cam.y = o.cam.y; RW.R.cam.zoom = o.cam.zoom;
    RW.Game.run(); g.speed = 1;
    RW.UI.toast('Гру завантажено', 'good');
    return true;
  };
})();
