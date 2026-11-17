// ============================================================
//  quality.js — якість предметів/будівель, різноманітна зброя й броня, типи шкоди
// ============================================================
(function () {
  'use strict';
  const RW = window.RW; const D = RW.D, U = RW.U, AI = RW.AI; const G = () => RW.G; const TAU = Math.PI * 2;
  const Q = RW.Quality = {};
  Q.NAMES = ['Жахлива', 'Погана', 'Звичайна', 'Добра', 'Видатна', 'Чудова', 'Шедевр'];
  Q.COL = ['#9a4a3a', '#b08050', '#b8c0c8', '#6fd06a', '#4ab0ff', '#c070ff', '#ffc040'];
  Q.MUL = [0.6, 0.8, 1, 1.15, 1.3, 1.5, 1.8];
  Q.mult = q => Q.MUL[q == null ? 2 : q];
  Q.name = q => Q.NAMES[q == null ? 2 : q];
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 1.15;
  Q.roll = (p, skill) => { const lvl = p ? p.skillLvl(skill) : 6; const pas = p && p.skills[skill] ? (p.skills[skill].pas || 0) : 0; return U.clamp(Math.round(lvl / 4 + gauss() * 1.1 + pas * 0.25 + (p && p.mood > 70 ? 0.2 : 0)), 0, 6); };
  Q.itemQ = it => it && it.data && it.data.q != null ? it.data.q : null;
  // ---------- Нова зброя / броня ----------
  const item = (id, o) => { o.id = id; o.stack = 1; D.items[id] = o; };
  item('spear', { name: 'Спис', cat: 'weapon', value: 45, color: '#a88a5a', w: { kind: 'melee', dmg: 13, cd: 48, dtype: 'stab', acc: 0.82, pen: 0.1 } });
  item('sword', { name: 'Меч', cat: 'weapon', value: 110, color: '#d0d8e0', w: { kind: 'melee', dmg: 17, cd: 44, dtype: 'cut', acc: 0.86, pen: 0.1 } });
  item('mace', { name: 'Булава', cat: 'weapon', value: 80, color: '#7a8088', w: { kind: 'melee', dmg: 16, cd: 58, dtype: 'blunt', acc: 0.78, pen: 0.25 } });
  item('shotgun', { name: 'Рушниця', cat: 'weapon', value: 150, color: '#6a4a30', w: { kind: 'ranged', dmg: 26, range: 12, warmup: 34, cd: 96, burst: 1, acc: 0.72, proj: 'bullet', dtype: 'bullet', pen: -0.1 } });
  item('sniper', { name: 'Снайперська гвинтівка', cat: 'weapon', value: 320, color: '#3a4046', w: { kind: 'ranged', dmg: 22, range: 44, warmup: 84, cd: 150, burst: 1, acc: 0.95, proj: 'bullet', dtype: 'bullet', pen: 0.3 } });
  item('leather_jacket', { name: 'Шкіряна куртка', cat: 'apparel', value: 70, color: '#7a5030', ap: { insul: 14, sharp: 0.22, blunt: 0.12 } });
  item('plate_armor', { name: 'Пластинчаста броня', cat: 'apparel', value: 380, color: '#8a9098', ap: { insul: 6, sharp: 0.78, blunt: 0.5, slow: 0.14 } });
  item('duster', { name: 'Плащ-пилозахист', cat: 'apparel', value: 100, color: '#a8885a', ap: { insul: 18, sharp: 0.18, blunt: 0.08, heat: 0.3 } });
  const rc = (id, o) => { D.recipes[id] = o; };
  rc('spear', { name: 'Спис', bench: ['workbench'], skill: 'crafting', work: 500, ing: [{ item: 'wood', n: 25 }, { item: 'steel', n: 6 }], out: 'spear', n: 1 });
  rc('sword', { name: 'Меч', bench: ['machining'], skill: 'crafting', work: 1000, ing: [{ item: 'steel', n: 55 }], out: 'sword', n: 1 });
  rc('mace', { name: 'Булава', bench: ['machining'], skill: 'crafting', work: 900, ing: [{ item: 'steel', n: 45 }, { item: 'wood', n: 10 }], out: 'mace', n: 1 });
  rc('shotgun', { name: 'Рушниця', bench: ['machining'], skill: 'crafting', work: 1300, ing: [{ item: 'steel', n: 50 }, { item: 'components', n: 1 }], out: 'shotgun', n: 1, research: 'gunsmithing' });
  rc('sniper', { name: 'Снайперська гвинтівка', bench: ['machining'], skill: 'crafting', work: 2200, ing: [{ item: 'steel', n: 60 }, { item: 'components', n: 3 }], out: 'sniper', n: 1, research: 'rifles' });
  rc('leather_jacket', { name: 'Шкіряна куртка', bench: ['tailor_bench'], skill: 'crafting', work: 700, ing: [{ item: 'leather', n: 22 }], out: 'leather_jacket', n: 1 });
  rc('plate_armor', { name: 'Пластинчаста броня', bench: ['machining'], skill: 'crafting', work: 1800, ing: [{ item: 'steel', n: 130 }], out: 'plate_armor', n: 1, research: 'gunsmithing' });
  rc('duster', { name: 'Плащ-пилозахист', bench: ['tailor_bench'], skill: 'crafting', work: 800, ing: [{ item: 'cloth', n: 20 }, { item: 'leather', n: 8 }], out: 'duster', n: 1 });
  D.itemCats.weapon = 'Зброя'; if (D.itemCats.apparel) D.itemCats.apparel = 'Одяг і броня';
  // ---------- Ефективні характеристики за якістю ----------
  const wCache = {};
  Q.weapon = (def, q, w) => { if (q == null || q === 2) return w; const k = def + q; if (wCache[k]) return wCache[k]; const m = Q.mult(q); const o = Object.assign({}, w); o.dmg = w.dmg * (0.5 + m * 0.5) ; o.acc = Math.min(0.98, w.acc * (0.7 + m * 0.3)); o.q = q; if (o.cd) o.cd = Math.round(w.cd / (0.85 + m * 0.15)); return (wCache[k] = o); };
  Q.armor = (ap, q, dtype) => { const base = dtype === 'blunt' ? ap.blunt : ap.sharp; return Math.min(0.92, base * Q.mult(q)); };
  // combat.js: weaponOf потрібно було підмінити (див. патч), а Pawn.armorFor тут:
  const PP = RW.Pawn.prototype;
  PP.armorFor = function (dtype) {
    const id = this.equip.apparel; const d = id && D.items[id]; const ap = d && d.ap; if (!ap) return 0;
    let a = Q.armor(ap, this.equip.aq, dtype); a = Math.max(0, a - (Q.curPen || 0)); return a;
  };
  const otd = PP.takeDamage; PP.takeDamage = function (dmg, dtype, src, part) {
    let pen = 0; if (src && src.equip && src.equip.weapon) { const wd = D.items[src.equip.weapon]; if (wd && wd.w && wd.w.pen) pen = wd.w.pen; }
    Q.curPen = pen; const r = otd.call(this, dmg, dtype, src, part); Q.curPen = 0; return r;
  };
  const ms = PP.moveSpeed; PP.moveSpeed = function () { let s = ms.call(this); const d = this.equip.apparel && D.items[this.equip.apparel]; if (d && d.ap && d.ap.slow) s *= (1 - d.ap.slow); return s; };
  // ---------- Створення: якість вироблених речей ----------
  const pend = []; Q.pend = pend; // відкладені якості для викинутих речей
  const GM = RW.GameMap.prototype; const addItem = GM.addItem;
  GM.addItem = function (def, n, x, y, opts) {
    const d = D.items[def];
    if (d && (d.cat === 'weapon' || d.cat === 'apparel') && n === 1 && !(opts && opts.data)) {
      let q = null;
      if (Q.ctx) q = Q.ctx.q;
      else { const k = pend.findIndex(e => e.def === def); if (k >= 0) { q = pend[k].q; pend.splice(k, 1); } }
      if (q != null) { opts = Object.assign({}, opts); opts.data = { q }; }
    }
    return addItem.call(this, def, n, x, y, opts);
  };
  const bill = AI.RUN.bill;
  AI.RUN.bill = function (p, j) {
    const r = D.recipes[j.bill && j.bill.recipe]; const o = r && D.items[r.out];
    if (o && (o.cat === 'weapon' || o.cat === 'apparel')) { if (j.q == null) j.q = Q.roll(p, r.skill); Q.ctx = { q: j.q }; Q.maker = p; }
    let res; try { res = bill(p, j); } finally { Q.ctx = null; }
    if (res === 'done' && o && j.q != null && (o.cat === 'weapon' || o.cat === 'apparel')) Q.announce(p, o, j.q, p.tx, p.ty);
    return res;
  };
  Q.announce = (p, d, q, x, y) => {
    if (q >= 5) { RW.UI && RW.UI.toast('★ ' + U.shortName(p) + ' створив(ла): ' + d.name + ' — ' + Q.name(q).toLowerCase() + '!', 'good'); RW.A && RW.A.sfx('research'); }
    else if (q <= 0) RW.UI && RW.UI.toast(U.shortName(p) + ': ' + d.name.toLowerCase() + ' вийшов жахливим…', 'bad');
    if (q >= 4 && RW.FX2) { RW.FX2.burst('star', x + 0.5, y, q >= 6 ? 14 : q >= 5 ? 9 : 5, { c: Q.COL[q] }); }
    if (q >= 6 && RW.UI) RW.UI.letter('Шедевр!', U.fullName(p) + ' створив(ла) шедевр: ' + d.name + '. Такі речі трапляються раз на життя.', 'good', null, { x, y });
    if (q >= 5 && p.addThought) p.addThought('craft_masterpiece');
  };
  // ---------- Екіпірування зберігає якість ----------
  const eq = AI.RUN.equip;
  AI.RUN.equip = function (p, j) {
    const it = j.item; const wasW = p.equip.weapon, wasA = p.equip.apparel, wq = p.equip.wq, aq = p.equip.aq; const iq = it && !it.dead ? Q.itemQ(it) : null; const cat = it && !it.dead ? D.items[it.def].cat : null;
    if (cat && cat === 'weapon' && wasW && wq != null) pend.push({ def: wasW, q: wq }); if (cat === 'apparel' && wasA && aq != null) pend.push({ def: wasA, q: aq });
    const r = eq(p, j);
    if (r === 'done') { if (cat === 'weapon') p.equip.wq = iq; else if (cat === 'apparel') p.equip.aq = iq; if (iq != null && iq >= 3) RW.FX2 && RW.FX2.burst('sparkle', p.x, p.y - 0.4, 6, { c: Q.COL[iq] }); }
    else if (r !== undefined) { pend.length = 0; }
    pend.length = 0; return r;
  };
  const pdie = PP.die; PP.die = function (src) { const e = this.equip; if (e.weapon && e.wq != null) pend.push({ def: e.weapon, q: e.wq }); if (e.apparel && e.aq != null) pend.push({ def: e.apparel, q: e.aq }); pdie.call(this, src); pend.length = 0; };
  const pser = PP.serialize; PP.serialize = function () { const o = pser.call(this); if (o.equip) o.equip = Object.assign({}, o.equip, { wq: this.equip.wq, aq: this.equip.aq }); return o; };
  // ---------- Оцінка для вибору екіпірування ----------
  Q.score = (it, d) => {
    const q = it && it.data && it.data.q != null ? it.data.q : 2;
    if (d.cat === 'weapon') { const w = Q.weapon(d.id, q, d.w); const dps = w.dmg * w.acc / Math.max(20, w.cd || 60) * (w.burst || 1); return dps * 600 + (w.kind === 'ranged' ? 100 + w.range : 0); }
    if (d.cat === 'apparel') { const a = d.ap; return a.insul * 0.5 + (Math.min(0.92, a.sharp * Q.mult(q)) + Math.min(0.92, a.blunt * Q.mult(q))) * 40; }
    return 0;
  };
  // ---------- Будівлі: якість меблів ----------
  Q.FURN = new Set(['production', 'furniture', 'light', 'joy', 'misc']);
  const brun = AI.RUN.build;
  AI.RUN.build = function (p, j) { Q.builder = p; let r; try { r = brun(p, j); } finally { Q.builder = null; } return r; };
  const ab = GM.addBuilding; GM.addBuilding = function (key, x, y, rot, extra) {
    const b = ab.call(this, key, x, y, rot, extra);
    if (b && Q.builder && b.def && b.def.cat === 'furniture') { const q = Q.roll(Q.builder, 'construction'); b.q = q; const m = Q.mult(q); b.maxhp = Math.round(b.maxhp * (0.7 + m * 0.3)); b.hp = b.maxhp; if (q >= 4 && RW.FX2) RW.FX2.burst('star', b.x + b.w / 2, b.y + 0.4, 4, { c: Q.COL[q] }); }
    return b;
  };
  const cb = GM.cellBeauty; GM.cellBeauty = function (i) { let v = cb.call(this, i); const bl = this.bld[i]; if (bl && bl.q != null && bl.def.beauty) v += bl.def.beauty * (Q.mult(bl.q) - 1); return v; };
  // ---------- Малювання: значки якості на предметах ----------
  Q.drawItems = function (c, TS, map, x0, y0, x1, y1, t) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const arr = map.items.get(y * map.w + x); if (!arr) continue;
      for (const it of arr) { const q = Q.itemQ(it); if (q == null || q === 2) continue; const X = x * TS, Y = y * TS;
        c.fillStyle = Q.COL[q]; c.beginPath(); c.arc(X + TS - 6, Y + 6, 3.2, 0, TAU); c.fill(); c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 1; c.stroke();
        if (q >= 4) { const a = 0.35 + 0.3 * Math.sin(t * 0.08 + x * 3 + y); c.fillStyle = 'rgba(255,255,255,' + a + ')'; const sx = X + 6 + ((t * 0.3) % (TS - 12)); c.fillRect(sx, Y + 8 + ((t * 0.2) % 14), 2, 2); c.fillRect(sx - 1, Y + 9 + ((t * 0.2) % 14), 4, 0.8); }
      }
    }
  };
  const drawBldQ = Q.drawBuildings = function (c, TS, map, t) { for (const b of map.buildings) { if (b.q == null || b.q < 4) continue; const X = (b.x + b.w) * TS - 7, Y = b.y * TS + 7; c.fillStyle = Q.COL[b.q]; c.beginPath(); c.arc(X, Y, 3, 0, TAU); c.fill(); } };
  // ---------- Рейдери: випадкова зброя й якість ----------
  const E = RW.Events; const mr = E.makeRaider;
  if (mr) E.makeRaider = function () {
    const p = mr.apply(this, arguments); if (!p || !p.equip) return p; const day = Math.floor(G().tick / D.DAY);
    const kind = p.aiKind; const r = Math.random();
    if (kind === 'tribal') { if (day > 8 && r < 0.25) p.equip.weapon = 'spear'; else if (day > 14 && r < 0.4) p.equip.weapon = 'sword'; if (Math.random() < 0.25) p.equip.apparel = 'leather_jacket'; }
    else { if (day > 10 && r < 0.18) p.equip.weapon = 'shotgun'; else if (day > 20 && r < 0.3) p.equip.weapon = 'sniper'; else if (day > 14 && r < 0.4) p.equip.weapon = 'sword'; if (day > 12 && Math.random() < 0.2) p.equip.apparel = 'plate_armor'; else if (day > 6 && Math.random() < 0.3) p.equip.apparel = 'leather_jacket'; }
    p.equip.wq = U.clamp(Math.round(2 + gauss() * 1.1), 0, 5); p.equip.aq = U.clamp(Math.round(2 + gauss()), 0, 5); return p;
  };
  D.thoughts.craft_masterpiece = { l: 'Створив шедевр', v: 6, dur: 2 * D.DAY }; D.thoughtIco && (D.thoughtIco.craft_masterpiece = '🏆');
  // ---------- UI ----------
  Q.tag = q => q == null ? '' : '<span class="qtag" style="color:' + Q.COL[q] + '">★ ' + Q.NAMES[q] + '</span>';
})();
