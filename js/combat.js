'use strict';
// ============================================================
//  combat.js — бій, снаряди, рейдери, тварини, зриви, турелі
// ============================================================
(function () {
  const D = RW.D, U = RW.U, AI = RW.AI;
  const C = RW.Combat = {};
  const G = () => RW.G;
  const UNARMED = { kind: 'melee', dmg: 3, cd: 56, dtype: 'blunt', acc: 0.62 };
  const weaponOf = p => { const d = p.equip && p.equip.weapon ? D.items[p.equip.weapon] : null; return d ? (p.equip.wq != null && RW.Quality ? RW.Quality.weapon(d.id, p.equip.wq, d.w) : d.w) : UNARMED; };
  C.weaponOf = weaponOf;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  // ------------------------------------------------------------
  //  Загрози
  // ------------------------------------------------------------
  C.updateThreats = function () {
    const g = G(); const th = [];
    for (const p of g.pawns) if (p.faction === 'enemy' && !p.downed && !p.dead) th.push(p);
    for (const a of g.animals) if ((a.hostile || a.manhunt > 0) && !a.dead) th.push(a);
    g.threats = th; g.threat = th.length;
    for (const p of g.pawns) {
      if (p.faction !== 'colony' || p.drafted || p.mental) { if (p.faction === 'colony') p.combatTarget = null; continue; }
      if (!th.length) { p.combatTarget = null; continue; }
      const w = weaponOf(p); const reach = p.noViolence ? 16 : (w.kind === 'ranged' ? w.range + 2 : 10);
      let best = null, bd = reach;
      for (const t of th) { const d = dist(p, t); if (d < bd && (d < 9 || g.map.los(p.x, p.y, t.x, t.y))) { bd = d; best = t; } }
      if (best !== p.combatTarget && best) { if (p.job && !p.noViolence) { AI.endJob(p); } }
      p.combatTarget = best;
    }
  };

  // ------------------------------------------------------------
  //  Атака
  // ------------------------------------------------------------
  const PROJ = { bullet: 0.95, arrow: 0.6, turret: 1.0 };
  function spawnProjectile(src, t, w, extra) {
    const g = G(); const d = dist(src, t);
    let acc = w.acc;
    if (src.kind === 'pawn') acc = acc * (0.55 + 0.045 * src.skillLvl('shooting')) * src.tmul('shoot') + src.tadd('acc');
    acc = U.clamp(acc - d * 0.011 - (src.cap ? (1 - src.cap.manip) * 0.2 : 0), 0.1, 0.96);
    let ax = t.x, ay = t.y;
    if (Math.random() > acc) { const off = (Math.random() - 0.5) * (1.4 + d * 0.09); const nx = -(t.y - src.y) / (d || 1), ny = (t.x - src.x) / (d || 1); ax += nx * off * 1.4; ay += ny * off * 1.4; }
    const dx = ax - src.x, dy = ay - src.y, dd = Math.hypot(dx, dy) || 1;
    const sp = PROJ[w.proj] || 0.9;
    g.projectiles.push({ x: src.x, y: src.y, vx: dx / dd * sp, vy: dy / dd * sp, dmg: w.dmg * (extra && extra.dmgMul || 1), dtype: w.dtype, src, fac: src.faction, type: w.proj, life: Math.ceil((w.range + 6) / sp), target: t, sx: Math.floor(src.x), sy: Math.floor(src.y), tx: Math.floor(t.x), ty: Math.floor(t.y), bld: extra && extra.bld });
    if (RW.A) RW.A.sfx(w.proj === 'arrow' ? 'arrow' : 'shot');
    if (RW.R) RW.R.fx.muzzle(src.x, src.y, dx / dd, dy / dd, w.proj);
  }
  C.spawnProjectile = spawnProjectile;

  function hostileTo(fac, e) {
    if (e.dead) return false;
    if (e.kind === 'pawn') return (fac === 'enemy' && (e.faction === 'colony')) || (fac === 'colony' && e.faction === 'enemy') || (fac === 'wild' && e.faction === 'colony');
    if (e.kind === 'animal') return (fac === 'enemy' && e.faction === 'colony') || (fac === 'colony' && (e.hostile || e.manhunt > 0)) || (fac === 'enemy' && false);
    return false;
  }
  C.hostileTo = hostileTo;

  C.updateProjectiles = function () {
    const g = G(), map = g.map; const list = g.projectiles;
    for (let k = list.length - 1; k >= 0; k--) {
      const b = list[k];
      b.life--; const steps = 2; let dead = b.life <= 0;
      for (let s = 0; s < steps && !dead; s++) {
        b.x += b.vx / steps; b.y += b.vy / steps;
        const xi = Math.floor(b.x), yi = Math.floor(b.y);
        if (!map.inb(xi, yi)) { dead = true; break; }
        const i = yi * map.w + xi;
        if (!(xi === b.sx && yi === b.sy)) {
          if (map.blk[i] > 0) { dead = true; RW.R && RW.R.fx.spark(b.x, b.y); break; }
          const bl = map.bld[i];
          if (bl && (bl.def.wall || bl.def.door || bl.def.cover || bl.def.pass === 0)) {
            const isCover = !!bl.def.cover;
            if (!isCover || (Math.random() < bl.def.cover && !(xi === b.tx && yi === b.ty && b.target && b.target.kind === 'pawn' && false))) {
              if (b.fac !== 'colony' || b.bld) C.hitBuilding(bl, b.dmg * 0.6, b.src); else if (!isCover) { C.hitBuilding(bl, b.dmg * 0.15, b.src); }
              dead = true; RW.R && RW.R.fx.spark(b.x, b.y); break;
            }
          }
        }
        // зіткнення з істотами
        const ents = [];
        for (const p of g.pawns) if (Math.abs(p.x - b.x) < 0.5 && Math.abs(p.y - b.y) < 0.5) ents.push(p);
        for (const a of g.animals) if (Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5) ents.push(a);
        for (const e of ents) {
          if (e === b.src || e.dead) continue;
          if (!hostileTo(b.fac, e) && e !== b.target) continue;
          if (e.kind === 'pawn' && e.downed && e !== b.target && Math.random() < 0.7) continue;
          // ухилення
          const dodge = e.kind === 'pawn' ? e.tadd('dodge') * 0.5 : 0;
          if (Math.random() < 0.08 + dodge) { RW.R && RW.R.fx.text(e.x, e.y - 0.7, 'промах', '#aab'); continue; }
          e.takeDamage(b.dmg * (0.85 + Math.random() * 0.3), b.dtype, b.src);
          if (e.kind === 'pawn' && b.src && b.src.kind === 'pawn' && b.src.isColonist) b.src.gainXp('shooting', 6);
          dead = true; break;
        }
      }
      if (dead) list.splice(k, 1);
    }
  };

  C.hitBuilding = function (b, dmg, src) {
    if (!b || b.dead) return;
    b.hp -= dmg;
    if (b.hp <= 0) {
      const g = G(), map = g.map;
      for (const k in b.def.cost) { const n = Math.floor(b.def.cost[k] * 0.3); if (n > 0) map.addItem(k, n, b.x, b.y); }
      map.removeBuilding(b);
      RW.R && RW.R.fx.dust(b.x + b.w / 2, b.y + b.h / 2, 10);
      if (RW.A) RW.A.sfx('crash');
      if (b.def.flam && Math.random() < 0.3 && RW.Events) RW.Events.startFire(b.y * map.w + b.x, 0.6);
    }
  };

  // Загальна функція атаки. opts.hold — не рухатись
  C.attack = function (p, t, opts) {
    opts = opts || {}; const g = G(), map = g.map;
    const w = opts.unarmed ? UNARMED : weaponOf(p);
    const d = dist(p, t);
    if (p.cool > 0) p.cool--;
    if (p.burstLeft > 0) {
      if (--p.burstT <= 0 && !t.dead) { spawnProjectile(p, t, w); p.burstLeft--; p.burstT = 5; }
      p.moving = false; return 'busy';
    }
    if (w.kind === 'ranged') {
      const los = map.los(p.x, p.y, t.x, t.y);
      if (d > w.range || !los) {
        p.aim = 0;
        if (opts.hold) return 'far';
        const r = AI.moveTo(p, Math.floor(t.x), Math.floor(t.y), { range: Math.max(3, w.range * 0.8), los: true, maxIter: 5000 });
        if (r === 'fail') return 'fail';
        if (r === 'arrived') { AI.resetMove(p); }
        return 'moving';
      }
      p.moving = false; AI.faceTo(p, t.x, t.y);
      if (p.cool > 0) return 'cool';
      p.aim++;
      const need = w.warmup * p.tmul('warmup');
      if (p.aim >= need) {
        spawnProjectile(p, t, w); p.aim = 0; p.cool = w.cd * p.tmul('cd');
        if (w.burst > 1) { p.burstLeft = w.burst - 1; p.burstT = 6; }
      }
      return 'aim';
    }
    // ближній бій
    if (d > 1.45) {
      if (opts.hold) return 'far';
      const r = AI.moveTo(p, Math.floor(t.x), Math.floor(t.y), { adj: true, maxIter: 5000, breach: p.breach });
      if (r === 'fail') return 'fail';
      return 'moving';
    }
    p.moving = false; AI.faceTo(p, t.x, t.y);
    if (p.cool > 0) return 'cool';
    const skill = p.kind === 'pawn' ? p.skillLvl('melee') : 4;
    const tskill = t.kind === 'pawn' ? t.skillLvl('melee') : 3;
    const dodge = t.kind === 'pawn' ? t.tadd('dodge') : 0.08;
    const hit = U.clamp(0.64 + 0.03 * (skill - tskill) + (w.acc - 0.75) - dodge, 0.2, 0.95);
    p.cool = w.cd * (p.kind === 'pawn' ? 1 / U.clamp(p.cap.manip, 0.3, 1.2) : 1);
    if (RW.R) RW.R.fx.swing(p.x, p.y, t.x, t.y);
    if (Math.random() < hit) {
      let dm = w.dmg * (0.75 + 0.035 * skill) * (p.kind === 'pawn' ? p.tmul('melee') : 1) * (0.85 + Math.random() * 0.3);
      t.takeDamage(dm, w.dtype, p);
      if (p.kind === 'pawn') p.gainXp('melee', 8);
      if (t.kind === 'pawn' && !t.dead && t.faction === 'colony') t.addThought('wounded_fought');
    } else if (RW.R) RW.R.fx.text(t.x, t.y - 0.7, 'промах', '#aab');
    return 'hit';
  };

  // ------------------------------------------------------------
  //  Призвані та автоматичні бійці
  // ------------------------------------------------------------
  function nearestThreat(p, maxD, needLos) {
    const g = G(); let best = null, bd = maxD;
    for (const t of g.threats) { if (t.dead || t.downed) continue; const d = dist(p, t); if (d < bd && (!needLos || g.map.los(p.x, p.y, t.x, t.y))) { bd = d; best = t; } }
    return best;
  }
  C.draftThink = function (p) {
    const g = G(); const w = weaponOf(p);
    p.sleeping = false;
    if (p.orderPos) {
      const r = AI.moveTo(p, p.orderPos.x, p.orderPos.y);
      if (r === 'arrived' || r === 'fail') { p.orderPos = null; AI.resetMove(p); }
      else return;
    }
    const t = nearestThreat(p, w.kind === 'ranged' ? w.range : 14, false);
    p.target = t;
    if (t) { C.attack(p, t, { hold: w.kind === 'ranged' && dist(p, t) > w.range * 1.0 }); }
    else { p.aim = 0; p.moving = false; if (p.cool > 0) p.cool--; }
  };
  C.autoFight = function (p) {
    const t = p.combatTarget; if (!t || t.dead) { p.combatTarget = null; return; }
    const r = C.attack(p, t, {});
    if (r === 'fail') p.combatTarget = null;
  };

  RW.AI.RUN = RW.AI.RUN || {};
  // Полювання
  C.huntJob = function (p, j) {
    const a = j.target; if (!a || a.dead) return 'done';
    j.t = (j.t || 0) + 1; if (j.t > 2400) return 'fail';
    const w = weaponOf(p);
    if (w.kind !== 'ranged') return 'fail';
    const r = C.attack(p, a, {});
    if (r === 'fail') return 'fail';
  };

  // ------------------------------------------------------------
  //  Рейдери
  // ------------------------------------------------------------
  C.raiderThink = function (p) {
    const g = G(), map = g.map;
    if (p.cool > 0 && p.faction === 'enemy') { /* охолодження зменшується в attack */ }
    p.breach = true;
    // втеча
    if (p.fleeing) {
      if (!p.exitTile) { p.exitTile = nearestEdge(p); }
      const r = AI.moveTo(p, p.exitTile[0], p.exitTile[1]);
      if (r === 'arrived' || r === 'fail') { C.removePawn(p, 'залишив карту'); }
      return;
    }
    if (g.tick % 40 === (p.id % 40)) {
      const raid = g.raids.find(r => r.members.includes(p.id));
      if (raid) {
        const alive = raid.members.filter(id => g.pawns.find(x => x.id === id && !x.downed)).length;
        if (alive <= Math.ceil(raid.members.length * 0.34) && raid.members.length > 2 || (g.tick - raid.start > D.DAY * 2.5)) { p.fleeing = true; p.exitTile = null; return; }
      }
      if (p.blood < 0.45 && Math.random() < 0.5) { p.fleeing = true; return; }
    }
    // блокування стіною
    if (p.blockedBy) {
      const b = p.blockedBy;
      if (b.dead) { p.blockedBy = null; }
      else { C.bashBuilding(p, b); return; }
    }
    // вибір цілі
    if (!p.target || p.target.dead || (p.target.kind === 'pawn' && p.target.downed && Math.random() < 0.02) || (g.tick + p.id) % 90 === 0) {
      p.target = pickRaiderTarget(p);
    }
    const t = p.target;
    if (!t) { // нікого — до центру
      AI.moveTo(p, Math.floor(g.home.x), Math.floor(g.home.y), { breach: true, adj: true }); return;
    }
    if (t.kind === 'pawn' || t.kind === 'animal') {
      const r = C.attack(p, t, {});
      if (r === 'fail') { p.target = null; p.blockedBy = null; }
    } else {
      // будівля
      const w = weaponOf(p); const d = Math.hypot(p.x - (t.x + t.w / 2), p.y - (t.y + t.h / 2));
      if (w.kind === 'ranged' && d < w.range * 0.8 && map.los(p.x, p.y, t.x + t.w / 2, t.y + t.h / 2)) {
        p.moving = false; AI.faceTo(p, t.x + 0.5, t.y + 0.5);
        if (--p.aim < -w.cd) { p.aim = 0; spawnProjectile(p, { x: t.x + t.w / 2, y: t.y + t.h / 2 }, w, { bld: true }); }
        p.aim = (p.aim || 0) + 2;
        if (p.aim > w.warmup) { spawnProjectile(p, { x: t.x + t.w / 2, y: t.y + t.h / 2, kind: 'b' }, w, { bld: true, dmgMul: 0.8 }); p.aim = -w.cd; }
      } else if (d < 1.9) C.bashBuilding(p, t);
      else { const r = AI.moveTo(p, t.x, t.y, { adj: true, breach: true, maxIter: 6000 }); if (r === 'fail') p.target = null; }
    }
  };
  function pickRaiderTarget(p) {
    const g = G(); let best = null, bd = 1e9;
    for (const o of g.pawns) { if (o.faction !== 'colony' || o.dead) continue; let d = dist(p, o); if (o.downed) d += 6; if (d < bd) { bd = d; best = o; } }
    for (const a of g.animals) { if (a.faction !== 'colony' || a.dead) continue; const d = dist(p, a) + 4; if (d < bd) { bd = d; best = a; } }
    if (best && bd < 60) return best;
    // турелі/будівлі
    for (const b of g.map.buildings) { if (!(b.def.turret || b.def.bed || b.def.bench)) continue; const d = Math.hypot(p.x - b.x, p.y - b.y) + 3; if (d < bd) { bd = d; best = b; } }
    return best;
  }
  C.bashBuilding = function (p, b) {
    p.moving = false; AI.faceTo(p, b.x + 0.5, b.y + 0.5);
    p.cool = (p.cool || 0) - 1;
    if (p.cool <= 0) { p.cool = 50; C.hitBuilding(b, Math.max(7, weaponOf(p).dmg * 1.1), p); RW.R && RW.R.fx.swing(p.x, p.y, b.x + 0.5, b.y + 0.5); }
  };
  function nearestEdge(p) {
    const map = G().map; const cands = [[Math.floor(p.x), 0], [Math.floor(p.x), map.h - 1], [0, Math.floor(p.y)], [map.w - 1, Math.floor(p.y)]];
    let best = cands[0], bd = 1e9;
    for (const c of cands) { const d = Math.hypot(c[0] - p.x, c[1] - p.y); if (d < bd) { bd = d; best = c; } }
    // знайти прохідну клітину поблизу
    for (let r = 0; r < 12; r++) for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) { const x = best[0] + dx, y = best[1] + dy; if (map.inb(x, y) && map.cost[y * map.w + x] > 0) return [x, y]; }
    return best;
  }
  C.removePawn = function (p, why) {
    const g = G(); const k = g.pawns.indexOf(p); if (k >= 0) g.pawns.splice(k, 1);
    AI.release(p); p.dead = true; p.gone = true;
    if (p.faction === 'enemy' && why) RW.UI && RW.UI.log('Ворог ' + why + '.');
  };

  // Відвідувачі (торговці)
  C.visitorThink = function (p) {
    const g = G(), map = g.map;
    if (p.vstate == null) p.vstate = 'arrive';
    if (p.vstate === 'arrive') {
      const spot = g.tradeSpot;
      const r = AI.moveTo(p, spot.x + ((p.id % 5) - 2), spot.y + ((p.id % 3) - 1), { adj: true });
      if (r === 'arrived' || r === 'fail') { p.vstate = 'stay'; AI.resetMove(p); }
      return;
    }
    if (p.vstate === 'stay') {
      p.moving = false;
      if (g.tick > p.leaveAt) { p.vstate = 'leave'; p.exitTile = nearestEdge(p); if (p.isTrader) RW.UI && RW.UI.log('Торговці йдуть геть.'); }
      return;
    }
    const r = AI.moveTo(p, p.exitTile[0], p.exitTile[1]);
    if (r === 'arrived' || r === 'fail') C.removePawn(p);
  };

  // ------------------------------------------------------------
  //  Психічні зриви
  // ------------------------------------------------------------
  C.checkBreak = function (p) {
    const th = p.breakThresholds(); let level = 0;
    if (p.mood < th.extreme) level = 3; else if (p.mood < th.major) level = 2; else if (p.mood < th.minor) level = 1;
    if (!level) return;
    const chance = [0, 0.35, 0.55, 0.8][level];
    if (Math.random() > chance) return;
    const opts = [['wander', 1], ['hide', 1], ['binge', 1], ['insult', 2], ['fight', 2], ['berserk', 3], ['fire', 3]];
    const pool = opts.filter(o => o[1] <= level && !(o[0] === 'fire' && !p.has('pyromaniac') && level < 3) && !(o[0] === 'berserk' && p.noViolence));
    const pick = U.pick(pool.filter(o => o[1] === level || Math.random() < 0.3) .concat(pool.length ? [] : [['wander', 1]]));
    C.startBreak(p, (pick || pool[0] || ['wander'])[0]);
  };
  C.startBreak = function (p, type, target) {
    const g = G();
    AI.endJob(p);
    const dur = { wander: 2600, hide: 2200, binge: 2400, insult: 1800, fight: 1500, berserk: 1900, fire: 1600 }[type] || 2000;
    p.mental = { type, left: dur, target: target || null, n: 0 };
    p.drafted = false; p.combatTarget = null;
    const L = { wander: 'блукає в розпачі', hide: 'ховається від світу', binge: 'обжирається', insult: 'ображає всіх навколо', fight: 'шукає бійки', berserk: 'впав у шаленство!', fire: 'збирається підпалювати!' };
    p.addLog('Психічний зрив: ' + L[type]);
    RW.UI && RW.UI.letter('Психічний зрив', U.fullName(p) + ' ' + L[type] + '.', type === 'berserk' || type === 'fire' ? 'bad' : 'warn', p);
    RW.A && RW.A.sfx('alert');
  };
  C.mentalThink = function (p) {
    const g = G(), map = g.map; const m = p.mental;
    if (--m.left <= 0 || (m.type === 'fight' && m.target && m.target.downed) || (m.type === 'berserk' && !nearestAnyColonist(p))) {
      p.mental = null; AI.endJob(p); p.addThought('catharsis'); p.addLog('Прийшов до тями.'); p.moving = false; return;
    }
    switch (m.type) {
      case 'wander': {
        if (!p.job) { const x = Math.round(p.x + U.rr(-10, 10)), y = Math.round(p.y + U.rr(-10, 10)); if (map.inb(x, y) && map.cost[y * map.w + x] > 0) AI.setJob(p, { type: 'wander', x, y, wait: 20 }); }
        else AI.runJob(p); break;
      }
      case 'hide': p.moving = false; break;
      case 'binge': {
        if (p.job) { AI.runJob(p); break; }
        const f = AI.findFood(p, true); if (f) { AI.reserve(p, f); AI.setJob(p, { type: 'eat', item: f }); p.needs.food = Math.min(p.needs.food, 0.6); } else p.moving = false;
        break;
      }
      case 'insult': {
        if (!m.target || m.target.dead) { m.target = nearestAnyColonist(p); }
        const t = m.target; if (!t) break;
        if (dist(p, t) > 1.8) AI.moveTo(p, t.tx, t.ty, { adj: true });
        else { p.moving = false; AI.faceTo(p, t.x, t.y); if (g.tick % 90 === 0) { RW.Social.change(t, p, -12); t.addThought('insulted'); RW.R && RW.R.fx.text(p.x, p.y - 0.9, '💢', '#f55'); if (Math.random() < 0.25) m.target = nearestAnyColonist(p); } }
        break;
      }
      case 'fight': case 'berserk': {
        if (!m.target || m.target.dead || m.target.downed) m.target = nearestAnyColonist(p);
        const t = m.target; if (!t) break;
        C.attack(p, t, { unarmed: m.type === 'fight' });
        break;
      }
      case 'fire': {
        if (!p.job || p.job.type !== 'wander') {
          let best = null, bd = 25;
          for (const b of map.buildings) { if (!b.def.flam) continue; const d = Math.hypot(b.x - p.x, b.y - p.y); if (d < bd && Math.random() < 0.3) { bd = d; best = b; } }
          if (best) AI.setJob(p, { type: 'wander', x: best.x, y: best.y, wait: 1, firebld: best });
          else m.left -= 20;
        } else {
          AI.runJob(p);
          if (!p.job && m.n < 4) { RW.Events.startFire(Math.floor(p.y) * map.w + Math.floor(p.x), 0.8); m.n++; if (RW.R) RW.R.fx.text(p.x, p.y - 0.9, '🔥', '#fa4'); }
        }
        break;
      }
    }
  };
  function nearestAnyColonist(p) {
    const g = G(); let best = null, bd = 40;
    for (const o of g.pawns) { if (o === p || o.faction !== 'colony' || o.dead || o.downed) continue; const d = dist(p, o); if (d < bd) { bd = d; best = o; } }
    return best;
  }

  // ------------------------------------------------------------
  //  Турелі
  // ------------------------------------------------------------
  C.updateTurrets = function () {
    const g = G(), map = g.map;
    for (const b of map.buildings) {
      if (!b.def.turret) continue;
      if (!b.on) continue;
      b.cool = (b.cool || 0) - 1; if (b.cool > 0) continue;
      const cx = b.x + 0.5, cy = b.y + 0.5; let best = null, bd = 24;
      for (const t of g.threats) { if (t.dead || t.downed) continue; const d = Math.hypot(t.x - cx, t.y - cy); if (d < bd && map.los(cx, cy, t.x, t.y)) { bd = d; best = t; } }
      if (best) {
        b.aimAt = Math.atan2(best.y - cy, best.x - cx);
        spawnProjectile({ x: cx, y: cy, faction: 'colony', kind: 'turret', skillLvl: () => 8, tmul: () => 1, tadd: () => 0, cap: { manip: 1 } }, best, { kind: 'ranged', dmg: 10, range: 24, acc: 0.8, proj: 'bullet', dtype: 'bullet' });
        b.cool = 34; b.flash = 4;
      }
    }
  };

  // ------------------------------------------------------------
  //  Тварини
  // ------------------------------------------------------------
  RW.Animal.prototype.moveSpeed = function () {
    let s = this.def.speed;
    if (this.flee > 0 || this.state === 'attack' || this.manhunt > 0) s *= 1.55; else if (this.state === 'wander') s *= 0.55;
    return s;
  };
  RW.Animal.prototype.cap = { move: 1, manip: 1, cons: 1 };

  C.animalThink = function (a) {
    const g = G(), map = g.map; const def = a.def;
    a.moving = false;
    if (a.cool > 0) a.cool--;
    if (a.pettedT > 0) a.pettedT--;
    if (a.bleed > 0) { a.hp -= a.bleed * 0.02; a.bleed *= 0.998; if (a.hp <= 0) { a.die(null); return; } }
    if (a.hp < a.maxhp && g.tick % 60 === 0) a.hp = Math.min(a.maxhp, a.hp + 0.4);
    // агресія (мисливці/зв'язані)
    if (a.manhunt > 0 || a.hostile) {
      a.manhunt = Math.max(0, a.manhunt - 1); if (a.manhunt === 0 && !a.hostile) { a.state = 'idle'; return; }
      if (!a.target || a.target.dead || g.tick % 60 === 0) a.target = nearestPrey(a);
      if (a.target) { animalAttack(a, a.target); return; }
    }
    if (a.state === 'attack' && a.target && !a.target.dead) {
      a.flee = Math.max(0, a.flee - 1);
      if (dist(a, a.target) > 18 || g.tick - (a.attackStart || 0) > 900) { a.state = 'idle'; a.target = null; }
      else { animalAttack(a, a.target); return; }
    } else if (a.state === 'attack') { a.state = 'idle'; a.target = null; }
    // втеча
    if (a.flee > 0) {
      a.flee--;
      if (!a.path || a.pi >= a.path.length) {
        const src = a.target && !a.target.dead ? a.target : null;
        if (src) {
          const dx = a.x - src.x, dy = a.y - src.y, dd = Math.hypot(dx, dy) || 1;
          const x = Math.round(a.x + dx / dd * 10 + U.rr(-3, 3)), y = Math.round(a.y + dy / dd * 10 + U.rr(-3, 3));
          if (map.inb(x, y) && map.cost[y * map.w + x] > 0) AI.moveTo(a, x, y, { maxIter: 500 }); else a.flee = 0;
        }
      } else AI.stepPath(a);
      return;
    }
    // боязливі: втеча від колоністів-мисливців поруч
    if (def.flee && g.tick % 20 === (a.id % 20)) {
      for (const p of g.pawns) { if (p.faction === 'colony' && Math.hypot(p.x - a.x, p.y - a.y) < 4.2 && a.hp < a.maxhp) { a.flee = 120; a.target = p; break; } }
    }
    // домашні улюбленці
    if (def.pet) {
      let owner = null, od = 1e9;
      for (const p of g.pawns) { if (p.faction !== 'colony' || p.dead) continue; const d = dist(a, p); if (d < od) { od = d; owner = p; } }
      if (owner && od > 3.5) { if (!a.path || g.tick % 25 === 0) AI.moveTo(a, owner.tx, owner.ty, { adj: true, maxIter: 800 }); AI.stepPath(a); a.state = 'follow'; return; }
      a.state = 'idle'; a.moving = false;
      if (a.path) { a.path = null; a.destKey = null; }
      if (--a.t <= 0) { a.t = U.ri(60, 260); const x = Math.round(a.x + U.rr(-3, 3)), y = Math.round(a.y + U.rr(-3, 3)); if (map.inb(x, y) && map.cost[y * map.w + x] > 0) AI.moveTo(a, x, y, { maxIter: 200 }); }
      if (a.path) AI.stepPath(a);
      return;
    }
    // блукання
    if (a.state === 'idle') {
      if (--a.t <= 0) {
        let cx = a.x, cy = a.y;
        const h = g.herds && g.herds[a.herd];
        if (h && Math.hypot(h.x - a.x, h.y - a.y) > 6) { cx = h.x; cy = h.y; }
        const x = Math.round(cx + U.rr(-6, 6)), y = Math.round(cy + U.rr(-6, 6));
        if (map.inb(x, y) && map.cost[y * map.w + x] > 0 && map.terrain[y * map.w + x] > 1) {
          const r = AI.moveTo(a, x, y, { maxIter: 400 }); if (r !== 'fail') a.state = 'wander';
        }
        a.t = U.ri(90, 400);
      }
    } else if (a.state === 'wander') {
      if (!a.path) { a.state = 'idle'; return; }
      if (AI.stepPath(a)) { a.state = 'idle'; a.path = null; a.destKey = null; }
    }
  };
  function nearestPrey(a) {
    const g = G(); let best = null, bd = 30;
    for (const p of g.pawns) { if (p.faction !== 'colony' || p.dead) continue; const d = dist(a, p) + (p.downed ? 4 : 0); if (d < bd) { bd = d; best = p; } }
    for (const o of g.animals) { if (o === a || o.faction !== 'colony' || o.dead) continue; const d = dist(a, o) + 3; if (d < bd) { bd = d; best = o; } }
    return best;
  }
  function animalAttack(a, t) {
    const d = dist(a, t);
    if (d > 1.3) {
      if (!a.path || a.pi >= a.path.length || RW.G.tick % 15 === 0) { const r = AI.moveTo(a, Math.floor(t.x), Math.floor(t.y), { adj: true, maxIter: 1500 }); if (r === 'fail') { a.target = null; a.state = 'idle'; return; } }
      if (a.path) AI.stepPath(a); return;
    }
    a.moving = false; AI.faceTo(a, t.x, t.y);
    if (a.cool <= 0) {
      a.cool = 55; const dm = a.def.dmg * (0.8 + Math.random() * 0.4);
      t.takeDamage(dm, 'bite', a);
      RW.R && RW.R.fx.swing(a.x, a.y, t.x, t.y);
    }
  }

  // Центри стад
  C.updateHerds = function () {
    const g = G(); const h = {};
    for (const a of g.animals) { if (!a.herd) continue; const s = h[a.herd] || (h[a.herd] = { x: 0, y: 0, n: 0 }); s.x += a.x; s.y += a.y; s.n++; }
    for (const k in h) { h[k].x /= h[k].n; h[k].y /= h[k].n; }
    g.herds = h;
  };
})();
