'use strict';
// ============================================================
//  dump.js — зона «Смітник» (v0.9.22)
//  Колоністи зносять сюди трупи, зіпсовану їжу та предмети, які ви
//  позначили у фільтрі зони. Самі в зону не ходять (дорога вартість
//  шляху). Також: страховка перенесення на склад.
// ============================================================
(function () {
  const RW = window.RW, D = RW.D, U = RW.U, AI = RW.AI; const G = () => RW.G;
  const Z0 = RW.Zone;
  class DZ extends Z0 {
    constructor(t, id) {
      super(t, id);
      if (t === 'dump') { for (const k in this.filter) this.filter[k] = false; this.corpse = true; this.spoiled = true; this.name = ''; }
    }
    accepts(def) { if (this.type !== 'dump') return super.accepts(def); return this.filter[def] === true && D.items[def].cat !== 'corpse'; }
  }
  RW.Zone = DZ;

  const isSpoiled = it => { const d = D.items[it.def]; return !!(d && d.rot && d.cat !== 'corpse' && it.age > d.rot * 0.65); };
  const wants = (z, it) => { const d = D.items[it.def]; if (!d) return false; if (d.cat === 'corpse') return z.corpse !== false; if (z.spoiled !== false && isSpoiled(it)) return true; return z.filter[it.def] === true; };

  // дорожчий шлях по смітнику — колоністи його оминають
  const uc = RW.GameMap.prototype.updateCost;
  RW.GameMap.prototype.updateCost = function (i) {
    uc.call(this, i); const z = this.zoneAt && this.zoneAt[i]; if (z && z.type === 'dump' && this.cost[i] > 0) this.cost[i] += 6;
  };
  function syncCost(g) {
    const m = g.map; for (const z of m.zones) {
      if (z.type !== 'dump') continue; const seen = z._seen || (z._seen = new Set());
      for (const c of z.cells) if (!seen.has(c)) { seen.add(c); m.touch(c); }
      for (const c of Array.from(seen)) if (!z.cells.has(c)) { seen.delete(c); m.touch(c); }
    }
  }
  const dumps = m => m.zones.filter(z => z.type === 'dump' && z.cells.size);
  function findDumpCell(p, it, zs) {
    const map = G().map; let best = null, bd = 1e9; const d0 = D.items[it.def]; const corpse = d0.cat === 'corpse';
    for (const z of zs) for (const c of z.cells) {
      const r = G().tileRes.get(c); if (r != null && r !== p.id) continue; if (map.cost[c] === 0) continue;
      const arr = map.items.get(c); if (arr && arr.length) { if (corpse || !(arr[0].def === it.def && arr[0].n < d0.stack && arr[0] !== it)) continue; }
      const x = c % map.w, y = (c / map.w) | 0; const d = Math.abs(p.tx - x) + Math.abs(p.ty - y);
      if (d < bd && map.regionOf(c) === map.regionOf(p.ty * map.w + p.tx)) { bd = d; best = c; }
    }
    return best;
  }
  function dumpJob(p, withCorpses) {
    const g = G(), map = g.map, zs = dumps(map); if (!zs.length) return null;
    let best = null, bd = 1e9, dest = null;
    for (const [i, arr] of map.items) {
      const inD = map.zoneAt[i] && map.zoneAt[i].type === 'dump'; if (inD) continue;
      for (const it of arr) {
        if (it.forbid || it.res || it.dead || (it.bad || 0) > g.tick) continue;
        const d0 = D.items[it.def]; if (!d0) continue; if (d0.cat === 'corpse' && !withCorpses) continue;
        if (!zs.some(z => wants(z, it))) continue;
        const x = i % map.w, y = (i / map.w) | 0; const d = Math.abs(p.tx - x) + Math.abs(p.ty - y); if (d >= bd) continue;
        if (!(map.regionOf(i) && map.regionOf(i) === map.regionOf(p.ty * map.w + p.tx))) continue;
        const dc = findDumpCell(p, it, zs.filter(z => wants(z, it))); if (dc == null) continue;
        bd = d; best = it; dest = dc;
      }
    }
    if (!best) return null;
    best.res = p.id; (p.resList || (p.resList = [])).push(best); g.tileRes.set(dest, p.id); (p.resTiles || (p.resTiles = [])).push(dest);
    return { type: 'dump', item: best, dest };
  }
  AI.RUN.dump = function (p, j) {
    const g = G(), map = g.map, it = j.item;
    if (j.stage === 0) {
      if (!it || it.dead) return 'fail';
      const r = AI.moveTo(p, it.i % map.w, (it.i / map.w) | 0); if (r === 'fail') { it.bad = g.tick + 900; return 'fail'; }
      if (r === 'arrived') { j.def = it.def; j.data = it.data; j.age = it.age; const got = map.takeItem(it, Math.min(it.n, 60)); p.carry = { def: j.def, n: got }; j.stage = 1; AI.resetMove && AI.resetMove(p); }
      return;
    }
    const dx = j.dest % map.w, dy = (j.dest / map.w) | 0; const r = AI.moveTo(p, dx, dy); if (r === 'fail') return 'fail';
    if (r === 'arrived') { const c = p.carry; p.carry = null; if (c) map.addItem(c.def, c.n, dx, dy, { data: j.data, age: j.age }); return 'done'; }
  };

  const gh = AI.GIVERS.haul;
  AI.GIVERS.haul = function (p) {
    const j0 = dumpJob(p, false); if (j0) return j0;
    const j = gh.apply(this, arguments); if (j) return j;
    return dumpJob(p, true);
  };
  const lt = RW.Life.tick; RW.Life.tick = function (g) { const r = lt.apply(this, arguments); try { if ((g.tick % 90) === 11) syncCost(g); } catch (e) { console.error('dump', e); } return r; };

  // ---- інтерфейс ----
  RW.ZONE_EXTRA = { dump: '#9a8a7a' };
  if (RW.Storage) {
    const st = RW.Storage.title, sd = RW.Storage.detail;
    RW.Storage.title = z => z.type === 'dump' ? '🗑 ' + (z.name || 'Смітник') : st(z);
    RW.Storage.detail = z => z.type === 'dump' ? z.cells.size + ' клітин' : sd(z);
  }
  const UI = RW.UI;
  UI.dumpPanel = function (z) {
    const esc = UI.esc;
    let h = `<p><input class="zname" data-chg="zoneName" value="${esc(z.name || '')}" placeholder="Назва…" maxlength="24"></p>`;
    h += `<p class="sub">Колоністи зносять сюди відмічене нижче й без потреби не заходять у цю зону.</p>`;
    h += `<p><label><input type="checkbox" data-chg="dumpCorpse" ${z.corpse !== false ? 'checked' : ''}> 💀 Трупи (якщо немає вільної могили)</label></p>`;
    h += `<p><label><input type="checkbox" data-chg="dumpSpoiled" ${z.spoiled !== false ? 'checked' : ''}> 🤢 Зіпсована їжа</label></p>`;
    h += `<div class="presets"><span class="sub">Інші предмети, які зносити сюди:</span></div>`;
    for (const cat of Object.keys(D.itemCats)) {
      if (cat === 'corpse') continue; const items = Object.keys(D.items).filter(k => D.items[k].cat === cat); if (!items.length) continue;
      h += `<div class="fcat"><b>${D.itemCats[cat]}</b><div>${items.map(k => `<label class="fit"><input type="checkbox" data-chg="zoneFilterItem" data-id="${k}" ${z.filter[k] === true ? 'checked' : ''}> ${D.items[k].name}</label>`).join('')}</div></div>`;
    }
    return h;
  };
  const A = UI.actions;
  A.dumpCorpse = el => { const z = UI.selZone(); if (z) z.corpse = el.checked; };
  A.dumpSpoiled = el => { const z = UI.selZone(); if (z) z.spoiled = el.checked; };
})();
