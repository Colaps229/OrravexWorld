'use strict';
// ============================================================
//  ai.js — поведінка колоністів: рух, роботи, потреби, лікування
// ============================================================
(function () {
  const D = RW.D, U = RW.U;
  const AI = RW.AI = {};
  const G = () => RW.G;

  // ------------------------------------------------------------
  //  Резервування та допоміжні функції
  // ------------------------------------------------------------
  function reserve(p, thing) { thing.res = p.id; (p.resList || (p.resList = [])).push(thing); }
  function reserveTile(p, i) { const g = G(); g.tileRes.set(i, p.id); (p.resTiles || (p.resTiles = [])).push(i); }
  function tileFree(p, i) { const r = G().tileRes.get(i); return r == null || r === p.id; }
  AI.release = function (p) {
    if (p.resList) { for (const t of p.resList) if (t.res === p.id) t.res = null; p.resList.length = 0; }
    if (p.resTiles) { const g = G(); for (const i of p.resTiles) if (g.tileRes.get(i) === p.id) g.tileRes.delete(i); p.resTiles.length = 0; }
    if (p.carry) { const g = G(); if (g && g.map) g.map.addItem(p.carry.def, p.carry.n, p.tx, p.ty); p.carry = null; }
    if (p.carrying) { const o = p.carrying; o.carriedBy = null; o.x = p.x; o.y = p.y; p.carrying = null; }
    p.destKey = null; p.arrived = false; p.path = null;
    if (p.sleeping) { p.sleeping = false; p.updateCap && p.updateCap(); }
    if (p.workBench) { p.workBench.working = false; p.workBench = null; }
  };
  function endJob(p) { AI.release(p); p.job = null; p.idleT = 0; }
  function setJob(p, job) { if (p.job) AI.release(p); job.stage = job.stage || 0; job.t = 0; p.job = job; p.idleT = 0; return job; }
  const tc = (i, w) => ({ x: (i % w) + 0.5, y: ((i / w) | 0) + 0.5 });
  const manh = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);
  AI.manh = manh;

  function stepPath(p) {
    const map = G().map, w = map.w;
    if (!p.path || p.pi >= p.path.length) return true;
    const ni = p.path[p.pi];
    if (map.cost[ni] === 0) { if (p.breach && map.bld[ni]) { p.blockedBy = map.bld[ni]; return false; } p.path = null; p.destKey = null; return false; }
    const tx = (ni % w) + 0.5, ty = ((ni / w) | 0) + 0.5;
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
    let sp = p.moveSpeed();
    const c = map.cost[ni] || 1; if (c > 1.3) sp /= Math.max(1, c * 0.62);
    if (d <= sp) { p.x = tx; p.y = ty; p.pi++; p.phase += sp * 3.2; p.moving = true; if (p.pi >= p.path.length) return true; return false; }
    p.x += dx / d * sp; p.y += dy / d * sp;
    if (Math.abs(dx) > Math.abs(dy)) p.face = dx > 0 ? 1 : 3; else p.face = dy > 0 ? 0 : 2;
    p.phase += sp * 3.2; p.moving = true;
    const bl = map.bld[Math.floor(p.y) * w + Math.floor(p.x)]; if (bl && bl.door) bl.door.open = 14;
    return false;
  }
  // 'arrived' | 'moving' | 'fail'
  function moveTo(p, tx, ty, opt) {
    const map = G().map; opt = opt || {};
    const key = tx + ',' + ty + (opt.adj ? 'a' : '') + (opt.range ? 'r' + opt.range : '');
    if (p.destKey !== key) {
      p.destKey = key; p.arrived = false;
      const path = map.path(p.x, p.y, tx, ty, opt);
      if (!path) { p.destKey = null; return 'fail'; }
      p.path = path; p.pi = 0;
      if (path.length === 0) { p.arrived = true; return 'arrived'; }
    }
    if (p.arrived) return 'arrived';
    if (!p.path) { p.destKey = null; return 'moving'; }
    if (stepPath(p)) { p.arrived = true; p.moving = false; return 'arrived'; }
    return 'moving';
  }
  AI.moveTo = moveTo; AI.stepPath = stepPath;
  function resetMove(p) { p.destKey = null; p.arrived = false; p.path = null; }
  function faceTo(p, x, y) { const dx = x - p.x, dy = y - p.y; if (Math.abs(dx) > Math.abs(dy)) p.face = dx > 0 ? 1 : 3; else p.face = dy > 0 ? 0 : 2; }
  AI.faceTo = faceTo;
  function nearDist(p, x, y) { return Math.hypot(p.x - x, p.y - y); }

  // Місце, з якого пішак працює біля об'єкта (прямокутник)
  function workSpot(p, x, y, w, h) {
    const map = G().map; const tiles = map.adjTiles(x, y, w, h);
    let best = null, bd = 1e9;
    for (const t of tiles) { const d = Math.abs(t[0] + 0.5 - p.x) + Math.abs(t[1] + 0.5 - p.y); if (d < bd && map.regionOf(t[1] * map.w + t[0]) === map.regionOf(p.ty * map.w + p.tx)) { bd = d; best = t; } }
    return best;
  }
  function canReachRect(p, x, y, w, h) { return !!workSpot(p, x, y, w, h); }
  function reachTile(p, i) { const map = G().map; return map.regionOf(p.ty * map.w + p.tx) && map.regionOf(i) === map.regionOf(p.ty * map.w + p.tx); }

  // Предмет, який можна підібрати і донести
  function pickItem(p, defs, pred, maxD) {
    const map = G().map; const w = map.w;
    return map.findItem(defs, p.tx, p.ty, it => { if (!reachTile(p, it.i)) return false; return pred ? pred(it) : true; }, maxD);
  }
  function giveCarry(p, def, n) { p.carry = { def, n }; }
  function dropCarry(p, x, y) { if (!p.carry) return; const g = G(); g.map.addItem(p.carry.def, p.carry.n, x == null ? p.tx : x, y == null ? p.ty : y); p.carry = null; }

  // ------------------------------------------------------------
  //  Пошук ліжка
  // ------------------------------------------------------------
  function isBedBuilding(b) { return b && b.def.bed && !b.dead; }
  function findBed(p, patient) {
    const g = G(), map = g.map;
    if (!patient && p.bed && !p.bed.dead && (p.bed.res == null || p.bed.res === p.id) && !(p.bed.def.bed.med && false)) return p.bed;
    let best = null, bs = -1e9;
    for (const b of map.buildings) {
      if (!isBedBuilding(b) || b.prison) continue;
      if (b.res != null && b.res !== p.id) continue;
      if (b.owner != null && b.owner !== p.id && !patient) continue;
      if (b.def.bed.med && !patient) continue;
      if (!reachTile(p, b.y * map.w + b.x)) continue;
      let sc = -manh(p.tx, p.ty, b.x, b.y) * 0.5 + b.def.bed.q * 10;
      if (patient && b.def.bed.med) sc += 30;
      if (b.owner === p.id) sc += 100;
      if (sc > bs) { bs = sc; best = b; }
    }
    return best;
  }
  function bedWanted(p) { return p.ill.some(i => !D.illnesses[i.id].env && i.sev > 0.22) || p.pain > 0.3 || p.blood < 0.72 || p.injuries.some(i => i.amt > 10 && i.type !== 'missing'); }

  // ------------------------------------------------------------
  //  Їжа
  // ------------------------------------------------------------
  const MEAL_ORDER = ['meal_fine', 'meal_simple'];
  function findFood(p, forceRaw) {
    const g = G(), map = g.map;
    let it = pickItem(p, MEAL_ORDER, null);
    if (it) { // найкращий найближчий
      const a = map.findItem('meal_fine', p.tx, p.ty, i => reachTile(p, i.i));
      const b = map.findItem('meal_simple', p.tx, p.ty, i => reachTile(p, i.i));
      if (a && b) return manh(p.tx, p.ty, a.i % map.w, (a.i / map.w) | 0) <= manh(p.tx, p.ty, b.i % map.w, (b.i / map.w) | 0) + 12 ? a : b;
      return a || b;
    }
    // без обідів — сира їжа (вже голодний)
    if (forceRaw || p.needs.food < 0.28) {
      return pickItem(p, ['rice', 'potato', 'corn', 'berries', 'meat'], null);
    }
    return null;
  }
  function eatSpot(p) {
    const map = G().map; let best = null, bd = 1e9;
    for (const b of map.buildings) {
      if (!b.def.table) continue;
      const d = manh(p.tx, p.ty, b.x, b.y); if (d > 22 || d >= bd) continue;
      const t = workSpot(p, b.x, b.y, b.w, b.h); if (t) { bd = d; best = t; }
    }
    return best;
  }

  // ------------------------------------------------------------
  //  Работи (WorkGivers)
  // ------------------------------------------------------------
  const GIVERS = {};

  GIVERS.firefight = function (p) {
    const g = G(); let best = null, bd = 18;
    for (const f of g.map.fires.values()) {
      if (f.res && f.res !== p.id) continue;
      const d = manh(p.tx, p.ty, f.x, f.y); if (d < bd && g.map.reachable(p.tx, p.ty, f.x, f.y, true)) { bd = d; best = f; }
    }
    if (!best) return null; reserve(p, best);
    return { type: 'fire', fire: best };
  };

  function patientNeeds(pt) {
    if (pt.dead) return null;
    let sev = 0;
    for (const i of pt.injuries) { if (i.type === 'missing') continue; if (!i.tended && (i.bleed > 0.00004 || i.amt > 5)) sev = Math.max(sev, 0.5 + Math.min(0.5, i.bleed * 4000)); }
    for (const il of pt.ill) { const d = D.illnesses[il.id]; if (d.env) continue; if (il.tendLeft <= 0 && il.sev > 0.18) sev = Math.max(sev, 0.4 + il.sev * 0.6); }
    return sev > 0 ? sev : null;
  }
  GIVERS.doctor = function (p) {
    const g = G(); let best = null, bs = -1;
    for (const pt of g.pawns) {
      if (pt === p || !pt.isColonist || pt.res && pt.res !== p.id) continue;
      if (pt.faction !== 'colony') continue;
      const sev = patientNeeds(pt); if (sev == null) continue;
      if (!reachTile(p, pt.ty * g.map.w + pt.tx) && !g.map.reachable(p.tx, p.ty, pt.tx, pt.ty, true)) continue;
      const sc = sev * 20 - manh(p.tx, p.ty, pt.tx, pt.ty) * 0.2; if (sc > bs) { bs = sc; best = pt; }
    }
    if (best) {
      // Якщо без свідомості і не в ліжку — спершу відносимо
      if (best.downed && !best.inBed && !best.carriedBy) {
        const bed = findBed(best, true);
        if (bed) { reserve(p, best); reserve(p, bed); return { type: 'rescue', who: best, bed }; }
      }
      reserve(p, best);
      return { type: 'tend', who: best };
    }
    // Відносимо поранених, що лежать без ліжка
    for (const pt of g.pawns) {
      if (pt === p || pt.faction !== 'colony' || !pt.downed || pt.inBed || pt.carriedBy || pt.res) continue;
      const bed = findBed(pt, true); if (!bed) continue;
      reserve(p, pt); reserve(p, bed); return { type: 'rescue', who: pt, bed };
    }
    return null;
  };

  GIVERS.hunt = function (p) {
    const g = G();
    const w = p.equip.weapon && D.items[p.equip.weapon].w;
    if (!w || w.kind !== 'ranged') return null;
    let best = null, bd = 60;
    for (const a of g.animals) {
      if (!a.hunt || a.dead || (a.res && a.res !== p.id)) continue;
      const d = manh(p.tx, p.ty, a.tx, a.ty); if (d < bd) { bd = d; best = a; }
    }
    if (!best) return null; reserve(p, best);
    return { type: 'hunt', target: best };
  };

  GIVERS.construct = function (p) {
    const g = G(), map = g.map;
    // розбирання
    for (const b of map.buildings) {
      if (!b.decon || (b.res && b.res !== p.id)) continue;
      if (!canReachRect(p, b.x, b.y, b.w, b.h)) continue;
      reserve(p, b); return { type: 'decon', b };
    }
    let best = null, bd = 1e9, clearI = -1;
    for (const bp of map.blueprints) {
      if (bp.res && bp.res !== p.id) continue;
      // перешкоди (дерево, скеля) в межах креслення: будівельник спершу прибирає їх
      let bi = -1; for (let yy = bp.y; yy < bp.y + bp.h && bi < 0; yy++) for (let xx = bp.x; xx < bp.x + bp.w; xx++) { const ii = yy * map.w + xx; const pl = map.plant[ii]; if (map.blk[ii] > 0 || (pl && D.plants[pl.def].tree)) { bi = ii; break; } }
      if (bi >= 0) {
        if (!tileFree(p, bi)) continue; const bx = bi % map.w, by = (bi / map.w) | 0;
        if (!map.reachable(p.tx, p.ty, bx, by, true)) continue;
        const d = manh(p.tx, p.ty, bx, by) - 1000; if (d < bd) { bd = d; best = bp; clearI = bi; } continue;
      }
      if (!canReachRect(p, bp.x, bp.y, bp.w, bp.h) && !map.reachable(p.tx, p.ty, bp.x, bp.y, true)) continue;
      // чи вистачає матеріалів
      let ok = true;
      for (const k in bp.need) { const miss = bp.need[k] - (bp.have[k] || 0); if (miss > 0 && map.count(k) < Math.min(miss, 1)) { ok = false; bp.missing = k; break; } }
      if (!ok) continue; bp.missing = null;
      const d = manh(p.tx, p.ty, bp.x, bp.y); if (d < bd) { bd = d; best = bp; }
    }
    if (!best) return null;
    if (clearI >= 0) { reserveTile(p, clearI); if (map.blk[clearI] > 0) { map.desig.set(clearI, 'mine'); return { type: 'mine', i: clearI }; } map.desig.set(clearI, 'chop'); return { type: 'chop', i: clearI }; }
    reserve(p, best);
    return { type: 'build', bp: best };
  };

  GIVERS.mine = function (p) {
    const g = G(), map = g.map; let best = null, bd = 1e9;
    for (const [i, t] of map.desig) {
      if (t !== 'mine' || !map.blk[i] || !tileFree(p, i)) continue;
      const x = i % map.w, y = (i / map.w) | 0;
      const d = manh(p.tx, p.ty, x, y); if (d >= bd) continue;
      if (!map.reachable(p.tx, p.ty, x, y, true)) continue;
      bd = d; best = i;
    }
    if (best == null) return null; reserveTile(p, best);
    return { type: 'mine', i: best };
  };

  GIVERS.grow = function (p) {
    const g = G(), map = g.map; let best = null, bd = 1e9, kind = null;
    // збір врожаю
    for (const z of map.zones) {
      if (z.type !== 'grow') continue;
      for (const i of z.cells) {
        const pl = map.plant[i]; if (!pl || pl.growth < 1 || !tileFree(p, i)) continue;
        const pd = D.plants[pl.def]; if (!pd.crop) continue;
        const x = i % map.w, y = (i / map.w) | 0; const d = manh(p.tx, p.ty, x, y);
        if (d < bd && reachTile(p, i)) { bd = d; best = i; kind = 'harvest'; }
      }
    }
    if (best == null) {
      for (const [i, t] of map.desig) {
        if ((t !== 'chop' && t !== 'harvest') || !tileFree(p, i)) continue;
        const pl = map.plant[i]; if (!pl) { map.desig.delete(i); continue; }
        const pd = D.plants[pl.def];
        if (t === 'harvest' && pl.growth < 1) continue;
        const x = i % map.w, y = (i / map.w) | 0; const d = manh(p.tx, p.ty, x, y);
        if (d < bd && map.reachable(p.tx, p.ty, x, y, true)) { bd = d; best = i; kind = t; }
      }
    }
    if (best == null) {
      for (const z of map.zones) {
        if (z.type !== 'grow' || !z.sow) continue;
        const crop = D.plants[z.crop]; if (!crop) continue;
        if (crop.research && !g.research.done.has(crop.research)) continue;
        if (g.outTemp < crop.minT + 1) continue;
        for (const i of z.cells) {
          if (map.plant[i] || !tileFree(p, i) || map.cost[i] === 0) continue;
          if (map.bld[i]) continue;
          if (!RW.Farming.canGrow(map, i)) continue;
          const x = i % map.w, y = (i / map.w) | 0; const d = manh(p.tx, p.ty, x, y);
          if (d < bd && reachTile(p, i)) { bd = d; best = i; kind = 'sow'; job = z; }
        }
      }
    }
    if (best == null) return null; reserveTile(p, best);
    if (kind === 'sow') { const z = map.zoneAt[best]; return { type: 'sow', i: best, crop: z ? z.crop : 'rice' }; }
    return { type: kind === 'chop' ? 'chop' : 'harvest', i: best };
  };
  let job; // (затичка для змінної в GIVERS.grow)

  GIVERS.cook = function (p) {
    const g = G(), map = g.map;
    // розбір туш
    const it = pickItem(p, ['corpse_animal'], i => true);
    if (it) { reserve(p, it); return { type: 'butcher', item: it }; }
    return billJob(p, 'cooking');
  };
  GIVERS.craft = function (p) { return billJob(p, 'crafting'); };

  function matchesGroup(def, group) {
    const d = D.items[def]; if (!d) return false;
    if (group === 'rawfood') return d.cat === 'rawfood';
    if (group === 'meat') return d.kind === 'meat';
    if (group === 'veg') return d.kind === 'veg';
    return false;
  }
  function bufCount(b, spec) {
    if (spec.item) return b.buf[spec.item] || 0;
    let c = 0; for (const k in b.buf) if (matchesGroup(k, spec.group)) c += b.buf[k]; return c;
  }
  function availableCount(b, spec, map) {
    let c = bufCount(b, spec);
    if (spec.item) return c + map.count(spec.item);
    for (const k in D.items) if (matchesGroup(k, spec.group)) c += map.count(k);
    return c;
  }
  function billActive(b, bill, g) {
    const r = D.recipes[bill.recipe]; if (!r || bill.paused) return false;
    if (r.research && !g.research.done.has(r.research)) return false;
    if (bill.mode === 'count') return bill.left > 0;
    if (bill.mode === 'until') return g.map.count(r.out) < bill.n;
    return true;
  }
  function billJob(p, skill) {
    const g = G(), map = g.map;
    let best = null, bd = 1e9;
    for (const b of map.buildings) {
      if (!b.def.bench || !b.bills.length || (b.res && b.res !== p.id)) continue;
      if (b.def.power < 0 && !b.on) continue;
      for (const bill of b.bills) {
        const r = D.recipes[bill.recipe]; if (!r || r.skill !== skill) continue;
        if (!billActive(b, bill, g)) continue;
        if (!r.ing.every(s => availableCount(b, s, map) >= s.n)) continue;
        if (!canReachRect(p, b.x, b.y, b.w, b.h)) continue;
        const d = manh(p.tx, p.ty, b.x, b.y); if (d < bd) { bd = d; best = { b, bill }; }
        break;
      }
    }
    if (!best) return null; reserve(p, best.b);
    return { type: 'bill', b: best.b, bill: best.bill };
  }

  GIVERS.research = function (p) {
    const g = G(), map = g.map;
    if (!g.research.current) return null;
    let best = null, bd = 1e9;
    for (const b of map.buildings) {
      if (!b.def.research_bench || (b.res && b.res !== p.id)) continue;
      if (!canReachRect(p, b.x, b.y, b.w, b.h)) continue;
      const d = manh(p.tx, p.ty, b.x, b.y); if (d < bd) { bd = d; best = b; }
    }
    if (!best) return null; reserve(p, best);
    return { type: 'research', b: best };
  };

  GIVERS.haul = function (p) {
    const g = G(), map = g.map;
    // дозаправка
    for (const b of map.buildings) {
      if (!b.def.fuel || (b.res && b.res !== p.id)) continue;
      if (b.fuel > b.def.fuel.cap * 0.45) continue;
      if (b.def.power > 0 && !g.map.networks.length) { /* генератор все одно заправляємо */ }
      if (!canReachRect(p, b.x, b.y, b.w, b.h)) continue;
      const wd = pickItem(p, [b.def.fuel.item], null); if (!wd) continue;
      reserve(p, b); return { type: 'refuel', b };
    }
    // годування лежачих
    for (const pt of g.pawns) {
      if (pt === p || pt.faction !== 'colony' || !(pt.downed || pt.inBed) || pt.needs.food > 0.33 || (pt.feedRes && pt.feedRes !== p.id)) continue;
      const food = findFood(p, true); if (!food) break;
      if (!g.map.reachable(p.tx, p.ty, pt.tx, pt.ty, true)) continue;
      reserve(p, food); pt.feedRes = p.id; return { type: 'feed', who: pt, item: food };
    }
    // перенесення в склад
    const zones = map.zones.filter(z => z.type === 'stock' && z.cells.size);
    let best = null, bd = 1e9, dest = null;
    if (zones.length) {
      for (const [i, arr] of map.items) {
        if (!arr || !arr.length) continue;
        for (const it of arr) {
          if (it.forbid || it.res || it.dead) continue;
          const d0 = D.items[it.def];
          if (d0.cat === 'corpse') continue;
          const z0 = map.zoneAt[i];
          let pz = zones; if (z0 && z0.type === 'stock' && z0.accepts(it.def)) { pz = zones.filter(z => (z.priority || 0) > (z0.priority || 0)); if (!pz.length) continue; }
          if (map.bp[i] && false) continue;
          const x = i % map.w, y = (i / map.w) | 0; const d = manh(p.tx, p.ty, x, y);
          if (d >= bd || d > 80) continue;
          if (!reachTile(p, i)) continue;
          const dc = findStockCell(p, it, pz); if (dc == null) continue;
          bd = d; best = it; dest = dc;
        }
      }
    }
    if (best) { reserve(p, best); reserveTile(p, dest); return { type: 'haul', item: best, dest }; }
    // трупи → могили
    for (const [i, arr] of map.items) {
      for (const it of arr) {
        if (it.def !== 'corpse' || it.res || it.dead || it.data && it.data.buried) continue;
        const grave = findGrave(p);
        if (!grave) break;
        if (!reachTile(p, i)) continue;
        reserve(p, it); reserve(p, grave); return { type: 'bury', item: it, grave };
      }
    }
    return null;
  };
  function findGrave(p) {
    const map = G().map;
    for (const b of map.buildings) {
      if (!b.def.grave || b.res || b.occupant) continue;
      if (canReachRect(p, b.x, b.y, b.w, b.h)) return b;
    }
    return null;
  }
  function findStockCell(p, it, zones) {
    const map = G().map; const stack = D.items[it.def].stack; let best = null, bd = 1e9;
    for (const z of zones) {
      if (!z.accepts(it.def)) continue;
      for (const c of z.cells) {
        const r = G().tileRes.get(c); if (r != null && r !== p.id) continue;
        if (map.cost[c] === 0) continue;
        const arr = map.items.get(c);
        if (arr && arr.length) { if (!(arr[0].def === it.def && arr[0].n < stack && arr[0] !== it)) continue; }
        const x = c % map.w, y = (c / map.w) | 0; const d = manh(p.tx, p.ty, x, y) - (arr && arr.length ? 6 : 0) - (z.priority == null ? 2 : z.priority) * 9;
        if (d < bd && reachTile(p, c)) { bd = d; best = c; }
      }
    }
    return best;
  }

  AI.GIVERS = GIVERS;

  function findWork(p) {
    const order = D.workTypes.map((w, idx) => ({ w, idx, pr: p.work[w.id] || 0 })).filter(o => o.pr > 0 && p.canDo(o.w.id));
    order.sort((a, b) => a.pr - b.pr || a.idx - b.idx);
    for (const o of order) {
      const gv = GIVERS[o.w.id]; if (!gv) continue;
      const j = gv(p); if (j) { j.wt = o.w.id; return j; }
    }
    return null;
  }

  // ------------------------------------------------------------
  //  Вибір завдання
  // ------------------------------------------------------------
  function chooseJob(p) {
    const g = G(), map = g.map; const hr = D.hour(g.tick); const sched = p.sched[hr];
    // 1. постільний режим
    if (bedWanted(p)) { const bed = findBed(p, true); if (bed) { reserve(p, bed); return { type: 'rest', bed, patient: true }; } }
    // 2. їжа
    if (p.needs.food < 0.3) { const f = findFood(p); if (f) { reserve(p, f); return { type: 'eat', item: f }; } }
    // 3. сон
    if (p.needs.rest < 0.18 || (sched === 'sleep' && p.needs.rest < 0.85)) { return sleepJob(p); }
    // 4. виробничі роботи
    if (sched !== 'joy' || p.needs.joy > 0.9) {
      const j = (sched === 'sleep' && p.needs.rest >= 0.85 && false) ? null : findWork(p);
      if (j) return j;
    }
    // 5. їжа (необов'язкова)
    if (p.needs.food < 0.4) { const f = findFood(p); if (f) { reserve(p, f); return { type: 'eat', item: f }; } }
    // 6. екіпірування
    const eq = equipJob(p); if (eq) return eq;
    // 7. розваги
    if (p.needs.joy < 0.55 || sched === 'joy') { const j = joyJob(p); if (j) return j; }
    // 8. спілкування/блукання
    return idleJob(p);
  }
  function sleepJob(p) {
    const bed = findBed(p, false);
    if (bed) { reserve(p, bed); return { type: 'sleep', bed }; }
    return { type: 'sleep', ground: true };
  }
  function equipJob(p) {
    if (p.noViolence && p.equip.weapon) return null;
    const g = G(), map = g.map;
    const want = (it) => {
      const d = D.items[it.def];
      if (d.cat === 'weapon') {
        if (p.noViolence) return false;
        const cur = p.equip.weapon && D.items[p.equip.weapon].w; const w = d.w;
        if (RW.Quality) { const cd = p.equip.weapon ? D.items[p.equip.weapon] : null; const cs = cd ? RW.Quality.score({ data: { q: p.equip.wq } }, cd) : 0; return RW.Quality.score(it, d) > cs + 8; }
        const score = x => x ? (x.kind === 'ranged' ? 100 + x.dmg * 2 + x.range : x.dmg * 3) : 0;
        return score(w) > score(cur) + 5;
      }
      if (d.cat === 'apparel') {
        const cur = p.equip.apparel && D.items[p.equip.apparel].ap; const a = d.ap;
        if (RW.Quality) { const cd = p.equip.apparel ? D.items[p.equip.apparel] : null; const cs = cd ? RW.Quality.score({ data: { q: p.equip.aq } }, cd) : 0; return RW.Quality.score(it, d) > cs + 3; }
        const score = x => x ? x.insul * 0.5 + (x.sharp + x.blunt) * 40 : 0;
        return score(a) > score(cur) + 3;
      }
      return false;
    };
    const it = pickItem(p, ['rifle', 'revolver', 'bow', 'club', 'knife', 'flak_vest', 'parka', 'tribal_wear', 'spear', 'sword', 'mace', 'shotgun', 'sniper', 'leather_jacket', 'plate_armor', 'duster'], i => want(i), 60);
    if (!it) return null; reserve(p, it);
    return { type: 'equip', item: it };
  }
  function joyJob(p) {
    const g = G(), map = g.map; let best = null, bs = -1e9;
    for (const b of map.buildings) {
      const jd = b.def.joy; if (!jd && !b.def.social) continue;
      if (b.res && b.res !== p.id) continue;
      if (b.def.power < 0 && !b.on) continue;
      if (b.def.fuel && !(b.fuel > 0)) continue;
      if (!canReachRect(p, b.x, b.y, b.w, b.h)) continue;
      const kind = jd ? jd.kind : 'fire';
      let sc = -manh(p.tx, p.ty, b.x, b.y) * 0.3 + (1 - (p.tol[kind] || 0)) * 15;
      if (sc > bs) { bs = sc; best = b; }
    }
    // тварини
    let pet = null, pd = 14;
    for (const a of g.animals) { if (a.faction !== 'colony' || a.dead) continue; const d = manh(p.tx, p.ty, a.tx, a.ty); if (d < pd) { pd = d; pet = a; } }
    if (pet && (!best || Math.random() < 0.3)) return { type: 'pet', pet };
    if (best) { reserve(p, best); return { type: 'joy', b: best }; }
    return { type: 'stargaze' };
  }
  function idleJob(p) {
    const g = G(), map = g.map;
    // розмова
    if (g.tick - p.lastSocial > 500 && Math.random() < 0.6) {
      let best = null, bd = 9;
      for (const o of g.pawns) {
        if (o === p || o.faction !== 'colony' || o.downed || o.sleeping || o.mental) continue;
        const d = Math.hypot(o.x - p.x, o.y - p.y); if (d < bd && (!o.job || ['wander', 'chat', 'stargaze'].includes(o.job.type) || Math.random() < 0.3) && map.reachable(p.tx, p.ty, o.tx, o.ty, true)) { bd = d; best = o; }
      }
      if (best) return { type: 'chat', who: best };
    }
    // блукання біля дому
    const cx = g.home.x, cy = g.home.y;
    for (let k = 0; k < 6; k++) {
      const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 7;
      const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r);
      if (!map.inb(x, y) || map.cost[y * map.w + x] === 0) continue;
      if (!map.reachable(p.tx, p.ty, x, y, false)) continue;
      return { type: 'wander', x, y, wait: U.ri(40, 200) };
    }
    return { type: 'wander', x: p.tx, y: p.ty, wait: 60 };
  }

  // ------------------------------------------------------------
  //  Виконання завдань
  // ------------------------------------------------------------
  const RUN = {};
  const FAIL = 'fail', DONE = 'done';

  RUN.wander = function (p, j) {
    if (j.stage === 0) { const r = moveTo(p, j.x, j.y); if (r === 'fail') return FAIL; if (r === 'arrived') { j.stage = 1; j.t = j.wait; p.moving = false; } return; }
    p.moving = false; if (--j.t <= 0) return DONE;
  };
  RUN.stargaze = function (p, j) { p.moving = false; p.needs.joy = Math.min(1, p.needs.joy + 0.0009); if (++j.t > 400 + U.hashStr(p.id) % 200) return DONE; };
  RUN.chat = function (p, j) {
    const o = j.who; if (!o || o.dead || o.downed) return FAIL;
    if (j.stage === 0) {
      if (Math.hypot(o.x - p.x, o.y - p.y) < 1.7) { j.stage = 1; j.t = 0; resetMove(p); p.moving = false; faceTo(p, o.x, o.y); return; }
      const r = moveTo(p, o.tx, o.ty, { adj: true }); if (r === 'fail') return FAIL; if (r === 'arrived') { if (Math.hypot(o.x - p.x, o.y - p.y) > 2.2) { resetMove(p); } else j.stage = 1; }
      if (++j.t > 600) return FAIL; return;
    }
    p.moving = false; faceTo(p, o.x, o.y);
    if (++j.t === 80) { RW.Social.interact(p, o); p.lastSocial = G().tick; o.lastSocial = G().tick; }
    if (j.t > 130) return DONE;
  };
  RUN.pet = function (p, j) {
    const a = j.pet; if (!a || a.dead) return FAIL;
    if (j.stage === 0) { const r = moveTo(p, a.tx, a.ty, { adj: true }); if (r === 'fail') return FAIL; if (r === 'arrived') { j.stage = 1; j.t = 0; p.moving = false; } if (++j.t > 500) return FAIL; return; }
    p.moving = false; faceTo(p, a.x, a.y); p.needs.joy = Math.min(1, p.needs.joy + 0.0022); a.fear = 0; a.pettedT = 20;
    if (++j.t === 120) p.addThought('petted');
    if (j.t > 260) return DONE;
  };
  RUN.joy = function (p, j) {
    const b = j.b; if (!b || b.dead) return FAIL;
    if (j.stage === 0) {
      const spot = workSpot(p, b.x, b.y, b.w, b.h); if (!spot) return FAIL;
      const r = moveTo(p, spot[0], spot[1]); if (r === 'fail') return FAIL; if (r === 'arrived') { j.stage = 1; j.t = 0; p.moving = false; faceTo(p, b.x + b.w / 2, b.y + b.h / 2); } return;
    }
    p.moving = false; faceTo(p, b.x + b.w / 2, b.y + b.h / 2);
    const jd = b.def.joy; const kind = jd ? jd.kind : 'fire'; const tol = p.tol[kind] || 0;
    const rate = (jd ? jd.rate : 0.0024) * (1 - 0.75 * Math.min(1, tol));
    p.needs.joy = Math.min(1, p.needs.joy + rate); p.tol[kind] = Math.min(1, tol + 0.00012);
    if (b.def.power < 0 && !b.on) return DONE;
    if (b.def.fuel && !(b.fuel > 0)) return DONE;
    if (++j.t > 900 || p.needs.joy > 0.97) { p.addThought('played'); return DONE; }
  };
  RUN.rest = function (p, j) {
    const bed = j.bed; if (!bed || bed.dead) return FAIL;
    if (j.stage === 0) {
      const r = moveTo(p, bed.x, bed.y); if (r === 'fail') return FAIL;
      if (r === 'arrived') { j.stage = 1; p.sleeping = false; p.inBed = true; p.bed = p.bed || bed; p.bedDef = bed.def.bed; p.moving = false; if (bed.owner == null && !bed.def.bed.med) { bed.owner = p.id; p.bed = bed; } }
      return;
    }
    p.x = bed.x + 0.5; p.y = bed.y + 0.5; p.moving = false;
    p.needs.rest = Math.min(1, p.needs.rest + 0.0002);
    if (!bedWanted(p) || ++j.t > 20000) { p.inBed = false; p.bedDef = null; return DONE; }
  };
  RUN.sleep = function (p, j) {
    const g = G();
    if (j.stage === 0) {
      if (j.ground) { j.stage = 1; j.t = 0; j.q = 0.65; return; }
      const bed = j.bed; if (!bed || bed.dead) return FAIL;
      const r = moveTo(p, bed.x, bed.y); if (r === 'fail') return FAIL;
      if (r === 'arrived') { j.stage = 1; j.t = 0; j.q = bed.def.bed.rest; p.bedDef = bed.def.bed; if (bed.owner == null && !bed.def.bed.med) { bed.owner = p.id; p.bed = bed; } }
      return;
    }
    if (!p.sleeping) { p.sleeping = true; p.updateCap(); p.moving = false; }
    if (j.bed) { p.x = j.bed.x + 0.5; p.y = j.bed.y + 0.5; }
    p.needs.rest = Math.min(1, p.needs.rest + 0.0003 * j.q);
    j.t++;
    const hr = D.hour(g.tick);
    const wake = p.needs.rest >= 0.98 || (p.sched[hr] !== 'sleep' && p.needs.rest > 0.6 && j.t > 600) || p.needs.food < 0.04;
    if (wake || g.threat > 0 && j.t > 30) {
      p.sleeping = false; p.updateCap();
      const t = p.env ? p.env.temp : 15;
      if (j.ground) p.addThought(t < 0 ? 'slept_cold' : 'slept_ground');
      else if (j.bed.def.bed.med) p.addThought('slept_hosp'); else if (j.bed.key === 'sleeping_spot') p.addThought('slept_spot'); else p.addThought('slept_bed');
      p.bedDef = null;
      return DONE;
    }
  };
  RUN.stunned = function (p, j) { p.moving = false; if (++j.t > j.dur) return DONE; };

  RUN.eat = function (p, j) {
    const g = G(), map = g.map; const it = j.item;
    if (j.stage === 0) {
      if (!it || it.dead || it.n <= 0) return FAIL;
      const x = it.i % map.w, y = (it.i / map.w) | 0;
      const r = moveTo(p, x, y); if (r === 'fail') return FAIL;
      if (r === 'arrived') {
        const d = D.items[it.def]; let n = 1;
        if (d.cat === 'rawfood') n = Math.min(it.n, Math.max(1, Math.ceil((1 - p.needs.food) * 0.85 / d.nutr)));
        else n = (1 - p.needs.food > 0.9 && it.n > 1 && p.has('gourmand')) ? 2 : 1;
        const def = it.def; j.age = it.age || 0; const got = map.takeItem(it, n); giveCarry(p, def, got); j.def = def; j.n = got; j.stage = 1; resetMove(p);
        j.spot = eatSpot(p);
      }
      return;
    }
    if (j.stage === 1) {
      if (j.spot) { const r = moveTo(p, j.spot[0], j.spot[1]); if (r === 'arrived' || r === 'fail') { j.stage = 2; j.t = 0; p.moving = false; } }
      else { j.stage = 2; j.t = 0; }
      return;
    }
    p.moving = false; j.t++;
    if (j.t === 1) { const b = map.bld[p.ty * map.w + p.tx]; }
    const need = 50 + j.n * 9;
    if (j.t >= need) {
      const d = D.items[j.def]; p.carry = null;
      p.needs.food = Math.min(1, p.needs.food + d.nutr * j.n);
      if (d.cat === 'meal') p.addThought(j.def === 'meal_fine' ? 'ate_fine' : 'ate_simple', (j.def === 'meal_fine' && p.has('gourmand')) ? 1.8 : 1);
      else p.addThought('ate_raw', j.def === 'berries' ? 0.3 : 1);
      if (j.def === 'meat' && Math.random() < 0.05) p.addIllness('food_poison', 0.1);
      if (RW.Cooking) RW.Cooking.onEat(p, j.def, j.age || 0, j.n);
      const nearTable = map.buildings.some(b => b.def.table && Math.abs(b.x + b.w / 2 - p.x) < 2.6 && Math.abs(b.y + b.h / 2 - p.y) < 2.6);
      if (d.cat === 'meal') p.addThought(nearTable ? 'ate_table' : 'ate_nodesk');
      return DONE;
    }
  };
  RUN.feed = function (p, j) {
    const g = G(), map = g.map; const it = j.item, pt = j.who;
    if (!pt || pt.dead || !it || it.dead) { if (pt) pt.feedRes = null; return FAIL; }
    if (j.stage === 0) {
      const r = moveTo(p, it.i % map.w, (it.i / map.w) | 0); if (r === 'fail') { pt.feedRes = null; return FAIL; }
      if (r === 'arrived') { const def = it.def; const n = D.items[def].cat === 'meal' ? 1 : Math.min(it.n, 6); const got = map.takeItem(it, n); giveCarry(p, def, got); j.stage = 1; resetMove(p); }
      return;
    }
    if (j.stage === 1) {
      const r = moveTo(p, pt.tx, pt.ty, { adj: true }); if (r === 'fail') { pt.feedRes = null; return FAIL; }
      if (r === 'arrived') { j.stage = 2; j.t = 0; p.moving = false; faceTo(p, pt.x, pt.y); } return;
    }
    p.moving = false; if (++j.t > 60) {
      const d = D.items[p.carry.def]; pt.needs.food = Math.min(1, pt.needs.food + d.nutr * p.carry.n); p.carry = null; pt.feedRes = null;
      return DONE;
    }
  };
  RUN.equip = function (p, j) {
    const g = G(), map = g.map; const it = j.item; if (!it || it.dead) return FAIL;
    const r = moveTo(p, it.i % map.w, (it.i / map.w) | 0); if (r === 'fail') return FAIL;
    if (r === 'arrived') {
      const d = D.items[it.def]; const def = it.def; map.takeItem(it, 1);
      if (d.cat === 'weapon') { if (p.equip.weapon) map.addItem(p.equip.weapon, 1, p.tx, p.ty); p.equip.weapon = def; }
      else { if (p.equip.apparel) map.addItem(p.equip.apparel, 1, p.tx, p.ty); p.equip.apparel = def; }
      p.addLog('Екіпірувався: ' + d.name); return DONE;
    }
  };

  RUN.haul = function (p, j) {
    const g = G(), map = g.map; const it = j.item;
    if (j.stage === 0) {
      if (!it || it.dead) return FAIL;
      const r = moveTo(p, it.i % map.w, (it.i / map.w) | 0); if (r === 'fail') return FAIL;
      if (r === 'arrived') {
        const cap = D.items[it.def].stack >= 50 ? 60 : D.items[it.def].stack; const def = it.def; const got = map.takeItem(it, Math.min(it.n, cap));
        giveCarry(p, def, got); j.stage = 1; resetMove(p);
      }
      return;
    }
    const dx = j.dest % map.w, dy = (j.dest / map.w) | 0;
    const r = moveTo(p, dx, dy); if (r === 'fail') return FAIL;
    if (r === 'arrived') {
      const def = p.carry.def, n = p.carry.n; p.carry = null;
      const left = map.addItem(def, n, dx, dy);
      return DONE;
    }
  };
  RUN.bury = function (p, j) {
    const g = G(), map = g.map; const it = j.item, gr = j.grave;
    if (!it || it.dead || !gr || gr.dead) return FAIL;
    if (j.stage === 0) {
      const r = moveTo(p, it.i % map.w, (it.i / map.w) | 0); if (r === 'fail') return FAIL;
      if (r === 'arrived') { j.data = it.data; map.takeItem(it, 1); giveCarry(p, 'corpse', 1); j.stage = 1; resetMove(p); }
      return;
    }
    if (j.stage === 1) {
      const spot = workSpot(p, gr.x, gr.y, gr.w, gr.h); if (!spot) return FAIL;
      const r = moveTo(p, spot[0], spot[1]); if (r === 'fail') return FAIL;
      if (r === 'arrived') { j.stage = 2; j.t = 0; p.moving = false; p.carry = null; }
      return;
    }
    p.moving = false;
    if (++j.t > 90) { gr.occupant = j.data ? j.data.name : 'невідомий'; gr.buried = true; return DONE; }
  };
  RUN.refuel = function (p, j) {
    const g = G(), map = g.map; const b = j.b; if (!b || b.dead) return FAIL;
    if (j.stage === 0) {
      const it = pickItem(p, [b.def.fuel.item], null); if (!it) return FAIL; reserve(p, it);
      const r = moveTo(p, it.i % map.w, (it.i / map.w) | 0); if (r === 'fail') return FAIL;
      if (r === 'arrived') { const need = Math.ceil(b.def.fuel.cap - b.fuel); const def = it.def; const got = map.takeItem(it, Math.min(need, it.n)); giveCarry(p, def, got); j.stage = 1; resetMove(p); }
      return;
    }
    if (j.stage === 1) {
      const spot = workSpot(p, b.x, b.y, b.w, b.h); if (!spot) return FAIL;
      const r = moveTo(p, spot[0], spot[1]); if (r === 'fail') return FAIL;
      if (r === 'arrived') { j.stage = 2; j.t = 0; p.moving = false; } return;
    }
    p.moving = false; if (++j.t > 25) { b.fuel = Math.min(b.def.fuel.cap, b.fuel + p.carry.n); p.carry = null; return DONE; }
  };

  // --- Будівництво ---
  RUN.build = function (p, j) {
    const g = G(), map = g.map; const bp = j.bp; if (!bp || bp.dead) return FAIL;
    const d = D.bld[bp.def];
    if (j.stage === 0) { // планування матеріалів
      let miss = null;
      for (const k in bp.need) { const m = bp.need[k] - (bp.have[k] || 0); if (m > 0) { miss = { def: k, n: m }; break; } }
      if (!miss) { j.stage = 3; resetMove(p); return; }
      const it = pickItem(p, [miss.def], null); if (!it) { bp.missing = miss.def; return FAIL; }
      reserve(p, it); j.item = it; j.miss = miss; j.stage = 1; resetMove(p); return;
    }
    if (j.stage === 1) {
      const it = j.item; if (!it || it.dead) { j.stage = 0; return; }
      const r = moveTo(p, it.i % map.w, (it.i / map.w) | 0); if (r === 'fail') return FAIL;
      if (r === 'arrived') { const def = it.def; const cap = Math.min(j.miss.n, 75); const got = map.takeItem(it, cap); giveCarry(p, def, got); j.stage = 2; resetMove(p); }
      return;
    }
    if (j.stage === 2) {
      const spot = workSpot(p, bp.x, bp.y, bp.w, bp.h); if (!spot) return FAIL;
      const r = moveTo(p, spot[0], spot[1]); if (r === 'fail') return FAIL;
      if (r === 'arrived') { bp.have[p.carry.def] = (bp.have[p.carry.def] || 0) + p.carry.n; p.carry = null; j.stage = 0; resetMove(p); }
      return;
    }
    // робота
    const spot = workSpot(p, bp.x, bp.y, bp.w, bp.h); if (!spot) return FAIL;
    if (j.stage === 3) { const r = moveTo(p, spot[0], spot[1]); if (r === 'fail') return FAIL; if (r === 'arrived') { j.stage = 4; p.moving = false; } return; }
    p.moving = false; faceTo(p, bp.x + bp.w / 2, bp.y + bp.h / 2);
    const rate = p.workSpeed('construction');
    bp.work += rate; p.gainXp('construction', 0.09);
    if ((G().tick & 15) === 0 && RW.R) RW.R.fx.spark(bp.x + bp.w / 2, bp.y + bp.h / 2);
    if ((G().tick & 31) === 0 && RW.A) RW.A.sfx('hammer');
    if (bp.work >= bp.total) {
      map.removeBlueprint(bp);
      const b = map.addBuilding(bp.def, bp.x, bp.y, bp.rot);
      if (b.def.fuel) b.fuel = 0;
      if (b.def.battery) b.charge = 0;
      g.stats.built++;
      if (RW.R) RW.R.fx.dust(bp.x + bp.w / 2, bp.y + bp.h / 2, 6);
      return DONE;
    }
  };
  RUN.decon = function (p, j) {
    const g = G(), map = g.map; const b = j.b; if (!b || b.dead || !b.decon) return FAIL;
    const spot = workSpot(p, b.x, b.y, b.w, b.h); if (!spot) return FAIL;
    if (j.stage === 0) { const r = moveTo(p, spot[0], spot[1]); if (r === 'fail') return FAIL; if (r === 'arrived') { j.stage = 1; p.moving = false; } return; }
    p.moving = false; faceTo(p, b.x + b.w / 2, b.y + b.h / 2);
    b.dprog = (b.dprog || 0) + p.workSpeed('construction'); p.gainXp('construction', 0.05);
    if ((g.tick & 31) === 0 && RW.A) RW.A.sfx('hammer');
    if (b.dprog >= Math.max(40, b.def.work * 0.5)) {
      const refund = b.def.refund || b.def.cost;
      for (const k in refund) { const n = Math.floor(refund[k] * 0.5); if (n > 0) map.addItem(k, n, b.x, b.y); }
      map.removeBuilding(b); return DONE;
    }
  };

  // --- Видобуток / рослини ---
  RUN.mine = function (p, j) {
    const g = G(), map = g.map; const i = j.i;
    if (!map.blk[i] || map.desig.get(i) !== 'mine') return DONE;
    const x = i % map.w, y = (i / map.w) | 0;
    if (j.stage === 0) { const r = moveTo(p, x, y, { adj: true }); if (r === 'fail') { map.desig.delete(i); return FAIL; } if (r === 'arrived') { j.stage = 1; p.moving = false; } return; }
    p.moving = false; faceTo(p, x + 0.5, y + 0.5);
    const blkId = map.blk[i]; const bd = D.blocks[blkId];
    const prog = (g.mineProg.get(i) || 0) + 2 * p.workSpeed('mining'); g.mineProg.set(i, prog); p.gainXp('mining', 0.1);
    if ((g.tick & 15) === 0) { RW.R && RW.R.fx.dust(x + 0.5, y + 0.5, 2); }
    if ((g.tick & 23) === 0 && RW.A) RW.A.sfx('pick');
    if (prog >= bd.hp) {
      g.mineProg.delete(i); map.blk[i] = 0; map.desig.delete(i);
      if (bd.drop) map.addItem(bd.drop, Math.round(bd.n * (0.85 + Math.random() * 0.3)), x, y);
      if (Math.random() < 0.75 || !bd.drop) map.addItem('stone_chunk', 1, x, y);
      map.touch(i);
      // сусідні тайли — оновлення країв
      for (const nb of [i - 1, i + 1, i - map.w, i + map.w]) if (nb >= 0 && nb < map.n) map.markDirty(nb);
      RW.R && RW.R.fx.dust(x + 0.5, y + 0.5, 10);
      return DONE;
    }
  };
  RUN.chop = function (p, j) {
    const g = G(), map = g.map; const i = j.i; const pl = map.plant[i];
    if (!pl) { map.desig.delete(i); return DONE; }
    const x = i % map.w, y = (i / map.w) | 0; const pd = D.plants[pl.def];
    if (j.stage === 0) { const r = moveTo(p, x, y, { adj: true }); if (r === 'fail') { map.desig.delete(i); return FAIL; } if (r === 'arrived') { j.stage = 1; j.t = 0; p.moving = false; } return; }
    p.moving = false; faceTo(p, x + 0.5, y + 0.5);
    j.t += p.workSpeed('plants'); p.gainXp('plants', 0.07);
    if ((g.tick & 23) === 0 && RW.A) RW.A.sfx('chop');
    if (j.t >= (pd.work || 150)) {
      map.desig.delete(i); map.removePlant(i);
      if (pd.wood) map.addItem('wood', Math.round(pd.wood * (0.9 + Math.random() * 0.2)), x, y);
      RW.R && RW.R.fx.dust(x + 0.5, y + 0.5, 6); return DONE;
    }
  };
  RUN.harvest = function (p, j) {
    const g = G(), map = g.map; const i = j.i; const pl = map.plant[i];
    if (!pl || pl.growth < 1) { map.desig.delete(i); return DONE; }
    const x = i % map.w, y = (i / map.w) | 0; const pd = D.plants[pl.def];
    if (j.stage === 0) { const r = moveTo(p, x, y, { adj: true }); if (r === 'fail') return FAIL; if (r === 'arrived') { j.stage = 1; j.t = 0; p.moving = false; } return; }
    p.moving = false; faceTo(p, x + 0.5, y + 0.5);
    j.t += p.workSpeed('plants'); p.gainXp('plants', 0.08);
    if (j.t >= (pd.work || 100)) {
      const n = Math.max(1, Math.round(pd.n * (0.55 + 0.03 * p.skillLvl('plants')) * (pl.hp / (pd.hp || 1) > 0.5 ? 1 : 0.7) * (pl.fz ? 1.25 : 1) * (RW.Farming.hydro(map, i) ? 1.15 : 1)));
      if (pl.fz && Math.random() < 0.15) p.addThought('green_thumb'); if (RW.FX2) RW.FX2.burst('sparkle', x + 0.5, y + 0.4, 5, { c: '#ffe27a' });
      map.addItem(pd.item, n, x, y); map.desig.delete(i);
      if (pd.wild) pl.growth = 0; else map.removePlant(i);
      g.stats.harvested += n;
      return DONE;
    }
  };
  RUN.sow = function (p, j) {
    const g = G(), map = g.map; const i = j.i;
    if (map.plant[i]) return DONE;
    const x = i % map.w, y = (i / map.w) | 0;
    if (j.stage === 0) { const r = moveTo(p, x, y); if (r === 'fail') return FAIL; if (r === 'arrived') { j.stage = 1; j.t = 0; p.moving = false; } return; }
    p.moving = false; j.t += p.workSpeed('plants'); p.gainXp('plants', 0.06);
    if (j.t >= 80) { map.addPlant(j.crop, x, y, 0); return DONE; }
  };
  RUN.butcher = function (p, j) {
    const g = G(), map = g.map; const it = j.item; if (!it || it.dead) return FAIL;
    const x = it.i % map.w, y = (it.i / map.w) | 0;
    if (j.stage === 0) { const r = moveTo(p, x, y); if (r === 'fail') return FAIL; if (r === 'arrived') { j.stage = 1; j.t = 0; p.moving = false; } return; }
    p.moving = false; j.t += p.workSpeed('cooking'); p.gainXp('cooking', 0.08);
    if (j.t >= 170) {
      const sp = D.animals[it.data && it.data.species] || D.animals.deer;
      map.takeItem(it, 1);
      map.addItem('meat', Math.round(sp.meat * (0.7 + 0.015 * p.skillLvl('cooking'))), x, y);
      map.addItem('leather', Math.round(sp.leather * (0.7 + 0.015 * p.skillLvl('cooking'))), x, y);
      return DONE;
    }
  };

  // --- Верстаки ---
  RUN.bill = function (p, j) {
    const g = G(), map = g.map; const b = j.b, bill = j.bill; if (!b || b.dead || !bill) return FAIL;
    const r = D.recipes[bill.recipe];
    if (bill.paused || (b.def.power < 0 && !b.on)) return FAIL;
    if (j.stage === 0) {
      // чого не вистачає?
      let miss = null;
      for (const s of r.ing) { const have = bufCount(b, s); if (have < s.n) { miss = { s, n: s.n - have }; break; } }
      if (!miss) { j.stage = 3; resetMove(p); return; }
      let defs;
      if (miss.s.item) defs = [miss.s.item]; else defs = Object.keys(D.items).filter(k => matchesGroup(k, miss.s.group));
      const it = pickItem(p, defs, null); if (!it) return FAIL;
      reserve(p, it); j.item = it; j.need = miss.n; j.stage = 1; resetMove(p); return;
    }
    if (j.stage === 1) {
      const it = j.item; if (!it || it.dead) { j.stage = 0; return; }
      const rr = moveTo(p, it.i % map.w, (it.i / map.w) | 0); if (rr === 'fail') return FAIL;
      if (rr === 'arrived') { const def = it.def; const got = map.takeItem(it, Math.min(j.need, it.n)); giveCarry(p, def, got); j.stage = 2; resetMove(p); }
      return;
    }
    if (j.stage === 2) {
      const spot = workSpot(p, b.x, b.y, b.w, b.h); if (!spot) return FAIL;
      const rr = moveTo(p, spot[0], spot[1]); if (rr === 'fail') return FAIL;
      if (rr === 'arrived') { b.buf[p.carry.def] = (b.buf[p.carry.def] || 0) + p.carry.n; p.carry = null; j.stage = 0; resetMove(p); }
      return;
    }
    const spot = workSpot(p, b.x, b.y, b.w, b.h); if (!spot) return FAIL;
    if (j.stage === 3) { const rr = moveTo(p, spot[0], spot[1]); if (rr === 'fail') return FAIL; if (rr === 'arrived') { j.stage = 4; j.prog = 0; p.moving = false; } return; }
    p.moving = false; faceTo(p, b.x + b.w / 2, b.y + b.h / 2);
    b.working = true; p.workBench = b;
    j.prog += p.workSpeed(r.skill); p.gainXp(r.skill, 0.08);
    if ((g.tick & 31) === 0 && RW.A && r.skill === 'crafting') RW.A.sfx('craft');
    if (j.prog >= r.work) {
      // споживання
      for (const s of r.ing) {
        let left = s.n;
        if (s.item) { b.buf[s.item] -= left; }
        else for (const k in b.buf) { if (left <= 0) break; if (!matchesGroup(k, s.group)) continue; const take = Math.min(left, b.buf[k]); b.buf[k] -= take; left -= take; }
      }
      for (const k in b.buf) if (b.buf[k] <= 0) delete b.buf[k];
      const spotOut = workSpot(p, b.x, b.y, b.w, b.h) || [p.tx, p.ty];
      const out = r.out; let n = r.n;
      map.addItem(out, n, spotOut[0], spotOut[1]);
      if (bill.mode === 'count') bill.left--;
      bill.done = (bill.done || 0) + 1; g.stats.crafted++;
      b.working = false; p.workBench = null;
      return DONE;
    }
  };

  RUN.research = function (p, j) {
    const g = G(), map = g.map; const b = j.b; const rs = g.research;
    if (!b || b.dead || !rs.current) return DONE;
    const spot = workSpot(p, b.x, b.y, b.w, b.h); if (!spot) return FAIL;
    if (j.stage === 0) { const r = moveTo(p, spot[0], spot[1]); if (r === 'fail') return FAIL; if (r === 'arrived') { j.stage = 1; p.moving = false; } return; }
    p.moving = false; faceTo(p, b.x + b.w / 2, b.y + b.h / 2);
    const rate = 0.03 * (RW.Extras ? RW.Extras.researchMul() : 1) * p.workSpeed('research') * (b.def.power < 0 && !b.on ? 0 : 1);
    rs.progress[rs.current] = (rs.progress[rs.current] || 0) + rate; p.gainXp('research', 0.1);
    if (RW.R && (g.tick & 63) === 0) RW.R.fx.text(b.x + 1, b.y - 0.3, '✦', '#7bd');
    if (rs.progress[rs.current] >= D.research[rs.current].cost) { RW.Events.finishResearch(); return DONE; }
    if (++j.t > 3000) return DONE;
  };

  // --- Медицина ---
  RUN.rescue = function (p, j) {
    const g = G(), map = g.map; const pt = j.who, bed = j.bed;
    if (!pt || pt.dead || !bed || bed.dead) return FAIL;
    if (j.stage === 0) {
      const r = moveTo(p, pt.tx, pt.ty, { adj: true }); if (r === 'fail') return FAIL;
      if (r === 'arrived') { p.carrying = pt; pt.carriedBy = p; j.stage = 1; resetMove(p); p.moving = false; }
      return;
    }
    const r = moveTo(p, bed.x, bed.y); if (r === 'fail') return FAIL;
    if (pt.carriedBy === p) { pt.x = p.x; pt.y = p.y; }
    if (r === 'arrived') {
      pt.carriedBy = null; p.carrying = null; pt.x = bed.x + 0.5; pt.y = bed.y + 0.5; pt.inBed = true; pt.bedDef = bed.def.bed; pt.bedRef = bed;
      return DONE;
    }
  };
  RUN.tend = function (p, j) {
    const g = G(), map = g.map; const pt = j.who; if (!pt || pt.dead) return FAIL;
    const sev = patientNeeds(pt); if (sev == null && j.stage < 2) return DONE;
    if (j.stage === 0) {
      // шукаємо ліки
      if (sev > 0.5) { const m = pickItem(p, ['medicine', 'herbal'], null, 40); if (m) { reserve(p, m); j.item = m; j.stage = 1; resetMove(p); return; } }
      j.stage = 2; return;
    }
    if (j.stage === 1) {
      const m = j.item; if (!m || m.dead) { j.stage = 2; return; }
      const r = moveTo(p, m.i % map.w, (m.i / map.w) | 0); if (r === 'fail') { j.stage = 2; return; }
      if (r === 'arrived') { const def = m.def; map.takeItem(m, 1); giveCarry(p, def, 1); j.stage = 2; resetMove(p); }
      return;
    }
    if (j.stage === 2) {
      const r = moveTo(p, pt.tx, pt.ty, { adj: true }); if (r === 'fail') return FAIL;
      if (r === 'arrived') { j.stage = 3; j.t = 0; p.moving = false; faceTo(p, pt.x, pt.y); } return;
    }
    p.moving = false; faceTo(p, pt.x, pt.y);
    j.t += p.workSpeed('medicine'); p.gainXp('medicine', 0.12);
    if (j.t >= 140) {
      const pot = p.carry ? D.items[p.carry.def].potency : 0.35; p.carry = null;
      const q = U.clamp((0.25 + 0.065 * p.skillLvl('medicine')) * (0.4 + pot * 0.8) + (pt.bedDef && pt.bedDef.med ? 0.1 : 0), 0.05, 1);
      for (const i of pt.injuries) { if (i.type === 'missing' || i.tended > 0) continue; i.tended = q; i.bleed *= (1 - 0.88 * q); }
      for (const il of pt.ill) { const d = D.illnesses[il.id]; if (d.env) continue; il.tend = q; il.tendLeft = 7000; }
      pt.updateCap(); pt.addLog('Отримав лікування від ' + U.shortName(p) + ' (якість ' + Math.round(q * 100) + '%)');
      if (RW.R) RW.R.fx.text(pt.x, pt.y - 0.9, '✚', '#7f7');
      return DONE;
    }
  };

  RUN.fire = function (p, j) {
    const g = G(), map = g.map; const f = j.fire; if (!f || !map.fires.has(f.i)) return DONE;
    const r = moveTo(p, f.x, f.y, { adj: true }); if (r === 'fail') return FAIL;
    if (r === 'arrived') {
      p.moving = false; faceTo(p, f.x + 0.5, f.y + 0.5);
      f.int -= 0.012 * p.cap.manip * (1 + p.skillLvl('construction') * 0.02);
      if (RW.R && (g.tick & 7) === 0) RW.R.fx.steam(f.x + 0.5, f.y + 0.5);
      if (f.int <= 0) { map.fires.delete(f.i); return DONE; }
    }
  };

  RUN.flee = function (p, j) {
    const g = G(), map = g.map;
    if (j.stage === 0) {
      let best = null, bs = -1;
      for (let k = 0; k < 14; k++) {
        const a = Math.random() * 6.283, r = 8 + Math.random() * 10; const x = Math.round(p.x + Math.cos(a) * r), y = Math.round(p.y + Math.sin(a) * r);
        if (!map.inb(x, y) || map.cost[y * map.w + x] === 0) continue;
        let md = 1e9; for (const t of g.threats) md = Math.min(md, Math.hypot(t.x - x, t.y - y));
        if (md > bs && map.reachable(p.tx, p.ty, x, y, false)) { bs = md; best = [x, y]; }
      }
      if (!best) return DONE; j.dest = best; j.stage = 1; return;
    }
    const r = moveTo(p, j.dest[0], j.dest[1]); if (r === 'fail' || r === 'arrived') return DONE;
    if (++j.t > 400 || g.threats.length === 0) return DONE;
  };

  // ------------------------------------------------------------
  //  Головна функція мислення колоніста
  // ------------------------------------------------------------
  AI.runJob = function (p) {
    const j = p.job; if (!j) return;
    const fn = RUN[j.type]; if (!fn) { endJob(p); return; }
    const r = fn(p, j);
    if (r === DONE) { endJob(p); }
    else if (r === FAIL) {
      // Забороняємо повторення негайно
      p.failT = G().tick; endJob(p);
    }
  };

  AI.jobLabel = function (p) {
    if (p.dead) return 'Мертвий';
    if (p.mental) return ({ wander: 'Блукає в розпачі', binge: 'Обжирається', hide: 'Ховається', insult: 'Ображає всіх', fight: 'Б\'ється', berserk: 'Берсерк!', fire: 'Підпалює' })[p.mental.type] || 'Зрив';
    if (p.downed) return p.inBed ? 'Лежить у ліжку' : 'Без свідомості';
    if (p.drafted) return 'Призваний до бою';
    if (p.combatTarget) return 'Б\'ється';
    const j = p.job; if (!j) return 'Нічого не робить';
    const L = {
      wander: 'Прогулюється', stargaze: 'Дивиться на зірки', chat: 'Спілкується', pet: 'Гладить тварину', joy: 'Розважається', rest: 'Лікується в ліжку', sleep: 'Спить',
      eat: 'Їсть', feed: 'Годує пацієнта', equip: 'Екіпірується', haul: 'Переносить ' + (p.carry ? D.items[p.carry.def].name : ''), bury: 'Ховає тіло', refuel: 'Заправляє',
      build: j.bp ? 'Будує: ' + D.bld[j.bp.def].name : 'Будує', decon: 'Розбирає', mine: 'Видобуває', chop: 'Рубає дерево', harvest: 'Збирає врожай', sow: 'Сіє', butcher: 'Розбирає тушу',
      bill: j.bill ? 'Виготовляє: ' + D.recipes[j.bill.recipe].name : 'Працює', research: 'Досліджує', rescue: 'Рятує', tend: 'Лікує', fire: 'Гасить пожежу', flee: 'Тікає', hunt: 'Полює', stunned: 'Оговтується'
    };
    return L[j.type] || j.type;
  };

  AI.think = function (p) {
    const g = G(); const map = g.map;
    p.moving = false;
    if (p.inBed && !p.downed && !(p.job && p.job.type === 'rest')) { p.inBed = false; p.bedDef = null; }
    if (p.carriedBy) { p.x = p.carriedBy.x; p.y = p.carriedBy.y; return; }
    if (p.downed) { return; }
    if (p.stun > 0) { p.stun--; return; }
    // таймер оновлення
    p.moodTimer++;
    if (p.moodTimer >= 30) { p.moodTimer = 0; AI.slowUpdate(p); }
    if (p.faction === 'enemy') return RW.Combat.raiderThink(p);
    if (p.faction !== 'colony') return RW.Combat.visitorThink(p);
    // психічний зрив
    if (p.mental) return RW.Combat.mentalThink(p);
    if (p.drafted) return RW.Combat.draftThink(p);
    // загроза
    if (p.combatTarget && !p.combatTarget.dead) {
      if (p.noViolence) { if (!p.job || p.job.type !== 'flee') { setJob(p, { type: 'flee' }); } }
      else return RW.Combat.autoFight(p);
    } else p.combatTarget = null;
    // виконання завдання
    if (p.job) {
      if (p.job.type === 'sleep' || p.job.type === 'rest' || p.job.type === 'stunned') { /* не переривати */ }
      else if ((g.tick + p.id) % 60 === 0) {
        // термінові потреби
        if (p.needs.food < 0.1 && p.job.type !== 'eat' && p.job.type !== 'feed') { const f = findFood(p, true); if (f) { endJob(p); reserve(p, f); setJob(p, { type: 'eat', item: f }); } }
        else if (p.needs.rest < 0.06 && p.job.type !== 'sleep') { endJob(p); const sj = sleepJob(p); setJob(p, sj); }
        else if (p.job.type === 'wander' || p.job.type === 'stargaze' || p.job.type === 'chat') {
          const hr = D.hour(g.tick);
          if (p.needs.food < 0.3 || (p.sched[hr] === 'sleep' && p.needs.rest < 0.85) || bedWanted(p)) { endJob(p); }
        }
      }
      if (p.job) AI.runJob(p);
      return;
    }
    // нове завдання
    p.idleT++;
    if (p.idleT < (p.failT && g.tick - p.failT < 40 ? 40 : 6)) return;
    const j = chooseJob(p);
    if (j) { setJob(p, j); }
    else p.idleT = 0;
  };

  // Повільне оновлення (раз на 30 тіків)
  AI.slowUpdate = function (p) {
    const g = G(), map = g.map; const i = p.ty * map.w + p.tx;
    // думки
    for (let k = p.thoughts.length - 1; k >= 0; k--) { p.thoughts[k].left -= 30; if (p.thoughts[k].left <= 0) p.thoughts.splice(k, 1); }
    // середовище
    let t = map.tempAt(i, g.outTemp) + map.warmAt(p.x, p.y);
    p.tickEnvironment(t); if (p.dead) return;
    const env = p.env;
    if (!env.beauty && env.beauty !== 0) env.beauty = 0;
    // краса навколо
    let bsum = 0, bc = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const x = p.tx + dx, y = p.ty + dy; if (!map.inb(x, y)) continue; const ii = y * map.w + x; bsum += map.cellBeauty(ii) + (map.terrain[ii] === 1 ? 0.4 : 0); bc++; }
    // трупи поблизу
    let corpse = false;
    for (let dy = -4; dy <= 4 && !corpse; dy++) for (let dx = -4; dx <= 4; dx++) { const x = p.tx + dx, y = p.ty + dy; if (!map.inb(x, y)) continue; const arr = map.items.get(y * map.w + x); if (arr && arr.some(it => it.def === 'corpse')) { corpse = true; break; } }
    if (corpse && !p.has('psychopath')) p.addThought('saw_corpse');
    env.beauty = bsum / bc * 1.0 + (map.room[i] >= 0 ? (map.rooms[map.room[i]].beautyAvg || 0) * 0.5 : 0);
    env.wet = g.weather.type === 'rain' && !map.isRoofed(i);
    if (g.fires && map.fires.size && !p.job) { /* нічого */ }
    p.computeMood();
    // зриви
    if (!p.mental && p.faction === 'colony' && g.tick % D.HOUR < 30) RW.Combat.checkBreak(p);
    p.tickHealthSlow && p.tickHealthSlow();
  };

  RUN.hunt = function (p, j) { const r = RW.Combat.huntJob(p, j); return r === 'done' ? DONE : (r === 'fail' ? FAIL : undefined); };
  AI.RUN = RUN;
  AI.pickItem = pickItem; AI.findWork = findWork; AI.findBed = findBed; AI.setJob = setJob; AI.endJob = endJob; AI.moveTo = moveTo; AI.workSpot = workSpot; AI.reserve = reserve; AI.findFood = findFood; AI.bedWanted = bedWanted; AI.resetMove = resetMove; AI.patientNeeds = patientNeeds;
})();
