'use strict';
// ============================================================
//  autobuild.js — розумне будівництво кімнат (v0.9.8)
//  • двері можна ставити на план стіни (замінюють креслення) і на готову стіну
//    (колоністи самі розбирають стіну, тоді ставиться креслення дверей)
//  • коли кімната замкнена, колоністи вирубують дерева/кущі всередині
//    й самі будують дах (соломʼяний; потрібне дерево)
// ============================================================
(function () {
  const RW = window.RW, D = RW.D, U = RW.U; const G = () => RW.G; const GM = RW.GameMap.prototype;
  const A = RW.Auto = { roof: true, clear: true, roofKind: 1 };
  const isWallBld = b => b && b.def && b.def.wall && !b.def.door;
  const isWallBp = b => b && b.def && String(b.def).startsWith('wall');
  const pend = () => { const g = G(); if (!g) return []; g.ext = g.ext || {}; return (g.ext.doorPlan = g.ext.doorPlan || []); };

  const cp = GM.canPlace;
  GM.canPlace = function (defKey, x, y, rot, opts) {
    const d = D.bld[defKey];
    if (d && d.door && !d.floor && this.inb(x, y)) {
      const i = y * this.w + x; const wb = this.bld[i], wp = this.bp[i];
      if (pend().some(q => q.x === x && q.y === y)) return 'Двері вже заплановано';
      if (isWallBld(wb) || isWallBp(wp)) {
        const sb = this.bld[i], sp = this.bp[i]; this.bld[i] = null; this.bp[i] = null;
        let r; try { r = cp.call(this, defKey, x, y, rot, opts); } finally { this.bld[i] = sb; this.bp[i] = sp; }
        return r;
      }
    }
    return cp.apply(this, arguments);
  };
  const ab = GM.addBlueprint;
  GM.addBlueprint = function (defKey, x, y, rot) {
    const d = D.bld[defKey];
    if (d && d.door && !d.floor && this.inb(x, y)) {
      const i = y * this.w + x; const wp = this.bp[i], wb = this.bld[i];
      if (isWallBp(wp)) { // замінюємо креслення стіни
        for (const k in wp.have) if (wp.have[k] > 0) this.addItem(k, wp.have[k], x, y);
        this.removeBlueprint(wp); this.updateCost && this.updateCost(i);
      } else if (isWallBld(wb)) { // готова стіна → розібрати й поставити двері
        wb.decon = true; pend().push({ x, y, def: defKey, rot: rot || 0 }); this.markDirty(i);
        if (RW.UI) RW.UI.toast('Стіну буде розібрано, на її місці — двері', 'info');
        return { x, y, w: 1, h: 1, def: defKey, isBp: false, fake: true };
      }
    }
    return ab.apply(this, arguments);
  };

  // ---- тік ----
  function tick(g) {
    const map = g.map; if (!map) return;
    if (g.tick % 20 === 0) {
      const L = pend();
      for (let k = L.length - 1; k >= 0; k--) {
        const q = L[k], i = q.y * map.w + q.x, b = map.bld[i];
        if (b && isWallBld(b)) { if (!b.decon) L.splice(k, 1); continue; } // скасовано гравцем
        if (b) { L.splice(k, 1); continue; }
        L.splice(k, 1);
        if (!map.canPlace(q.def, q.x, q.y, q.rot, { clear: true })) { map.addBlueprint(q.def, q.x, q.y, q.rot); }
      }
    }
    if (g.tick % 60 === 7) rooms(g);
  }
  let lastRooms = null, lastDoneTick = -999;
  function rooms(g) {
    const map = g.map; if (!map.rooms || !map.rooms.length) return;
    if (!A.roof && !A.clear) return;
    const Ly = RW.Layers; const roof = Ly && Ly.arr(map); const bps = Ly && Ly.bps(map);
    let chop = 0, rf = 0;
    for (const r of map.rooms) {
      let own = false; for (const c of r.cells) { for (const nb of [c - 1, c + 1, c - map.w, c + map.w]) { const bb = map.bld[nb]; if (bb && bb.own && (bb.def.wall || bb.def.door)) { own = true; break; } } if (own) break; } if (!own) continue;
      let mt = 0; for (const c of r.cells) if (map.mroof[c]) mt++; if (mt === r.size) continue; // печера в горі
      for (const c of r.cells) {
        if (A.clear) { const pl = map.plant[c]; if (pl && !map.desig.has(c)) { const pd = D.plants[pl.def]; if (pd && !pd.crop) { map.desig.set(c, 'chop'); chop++; } } }
        if (A.roof && roof && !map.mroof[c] && roof[c] === 0 && !bps.has(c) && !map.blk[c]) { bps.set(c, { kind: A.roofKind, prog: 0, res: null }); rf++; }
      }
    }
    if ((chop || rf) && g.tick - lastDoneTick > 600) { lastDoneTick = g.tick; RW.UI.toast('Кімната замкнена: ' + (chop ? 'прибираю рослини' : '') + (chop && rf ? ', ' : '') + (rf ? 'плануємо дах (' + rf + ')' : ''), 'info'); }
  }
  const lt = RW.Life.tick; RW.Life.tick = function (g) { const r = lt.apply(this, arguments); try { tick(g); } catch (e) { console.error('autobuild', e); } return r; };

  // позначка запланованих дверей
  RW.R.worldOver.push(function (c, TS) {
    const g = G(); if (!g || !g.ext || !g.ext.doorPlan) return;
    c.save(); c.strokeStyle = 'rgba(255,220,140,0.95)'; c.fillStyle = 'rgba(255,220,140,0.25)'; c.lineWidth = 2; c.setLineDash([4, 3]);
    for (const q of g.ext.doorPlan) { c.fillRect(q.x * TS + 3, q.y * TS + 3, TS - 6, TS - 6); c.strokeRect(q.x * TS + 3, q.y * TS + 3, TS - 6, TS - 6); }
    c.restore();
  });
})();
