'use strict';
// ============================================================
//  combat2.js — бої й загрози (v0.9.2)
//   16) Облога: табір з мортирами обстрілює колонію кілька діб; можна зробити вилазку
//   17) Пастки з комбінаціями: шипи, вогонь, вибухівка, сітка; сусідні спрацьовують ланцюгом
//   18) Бойові тварини: тренування «Бойовий» (міцніші, охороняють здалеку, бойове розмальовування)
//   20) Особливі вороги: мисливець за головами, злодій, утікач із погонею
//  (19 «Поранення по частинах тіла» у грі вже є: протези та бионіка — нічого додавати не довелося.)
//  Усі числа — в об'єкті C2.
// ============================================================
(function () {
  const D = RW.D, U = RW.U, DY = D.DAY, HR = D.HOUR; const G = () => RW.G; const AI = RW.AI, C = RW.Combat, E = RW.Events;
  const C2 = RW.Combat2 = {
    SIEGE_CH: 0.16, SIEGE_DAYS: 3, SIEGE_DIST: 26, SHELL_EVERY: 1500, SHELL_BLD: 46, SHELL_PAWN: 24, SHELL_R: 2.1, SHELL_WARN: 95,
    TRAP_CHAIN_R: 3, TRAP_REARM: 150, SPIKE: 16, FIRE: 11, BOOM: 36, BOOM_R: 2.3, NET_STUN: 260,
    WAR_HP: 1.35, WAR_DMG: 1.4, WAR_ARMOR: 0.6, WAR_RANGE: 20,
    SPECIAL_CH: { bounty: 0.03, thief: 0.05, escapee: 0.035 }, SPECIAL_COOL: 6, SPECIAL_FROM: 12
  };
  const fx2 = (t, x, y, o) => RW.FX2 && RW.FX2.emit(t, x, y, o), burst = (t, x, y, n, o) => RW.FX2 && RW.FX2.burst(t, x, y, n, o);
  const cols = g => g.pawns.filter(p => p.faction === 'colony' && !p.dead);
  const dayN = g => D.relDay(g.tick);
  const ex = g => { const e = (g.ext = g.ext || {}); return (e.c2 = e.c2 || { siege: null, special: -99, shells: [] }); };
  const T = (id, l, v, days) => { D.thoughts[id] = { l, v, dur: days * DY }; };
  T('betrayed', 'Колонія видала людину ворогам', -9, 6); T('hunter_slain', 'Мисливця за головами знищено', 6, 3); T('refuge_grateful', 'Знайшов(ла) прихисток', 8, 6); T('siege_dread', 'Обстріл! Страшно', -5, 0.6);
  T('siege_won', 'Облогу знято!', 8, 3); T('thief_caught', 'Злодія спіймано', 3, 2); T('trap_joy', 'Пастка спрацювала!', 2, 1);

  // ---------- спільні ефекти ----------
  const anims = [];
  function boom(g, x, y, r, dmgB, dmgP, o) {
    o = o || {}; const map = g.map; RW.R.shake = Math.max(RW.R.shake || 0, o.shake || 6);
    anims.push({ k: 'boom', x, y, r, t: 0, life: 34 }); burst('sparkle', x, y, 10, { c: '#ffb04a' }); for (let k = 0; k < 6; k++) RW.R.fx.smoke(x + U.rr(-0.5, 0.5), y + U.rr(-0.5, 0.5), '#555');
    for (const b of map.buildings.slice()) { const d = Math.hypot(b.x + b.w / 2 - x, b.y + b.h / 2 - y); if (d < r + b.w / 2 && !b.def.trap && !b.def.moat) C.hitBuilding(b, dmgB * (1 - Math.min(0.85, d / (r + 1))), null); }
    for (const q of g.pawns.concat(g.animals)) {
      if (q.dead || q.hidden) continue; if (o.only && !o.only(q)) continue; const d = Math.hypot(q.x - x, q.y - y); if (d > r) continue;
      q.takeDamage(dmgP * (1 - d / (r + 0.6)) + 2, 'blunt'); if (q.faction === 'colony' && q.isColonist) { q.addThought('siege_dread'); q.stun = Math.max(q.stun || 0, 40); }
    }
    if (o.fire && E.startFire) for (let k = 0; k < (o.fire | 0); k++) { const fx = Math.floor(x + U.rr(-r, r)), fy = Math.floor(y + U.rr(-r, r)); if (map.inb(fx, fy)) E.startFire(fy * map.w + fx, 0.7); }
    if (map.decals) map.decals.push({ x, y, t: 'scorch', r: r * 0.55, a: 0.5 });
    RW.A && RW.A.sfx('alert');
  }
  C2.boom = boom;
  function walkNear(map, x, y, rad) { for (let r = 0; r <= (rad || 10); r++) for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) { const xx = Math.round(x) + dx, yy = Math.round(y) + dy; if (map.inb(xx, yy) && map.cost[yy * map.w + xx] > 0 && !map.bld[yy * map.w + xx]) return { x: xx, y: yy }; } return { x: Math.round(x), y: Math.round(y) }; }

  // ======================================================================
  //  16. ОБЛОГА
  // ======================================================================
  const siegeOn = g => { const s = ex(g).siege; return s && s.phase === 'siege'; };
  C2.startSiege = function (pts) {
    const g = G(), map = g.map, e = ex(g); if (e.siege) return false;
    const day = dayN(g), sp = E.edgeSpawn(map, g.home); let dx = sp.x - g.home.x, dy = sp.y - g.home.y; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    let cx = g.home.x + dx * C2.SIEGE_DIST, cy = g.home.y + dy * C2.SIEGE_DIST; cx = U.clamp(cx, 7, map.w - 8); cy = U.clamp(cy, 7, map.h - 8); const camp = walkNear(map, cx, cy, 10);
    pts = pts || E.threatPoints() * 0.9; const members = []; let guard = 0;
    while ((pts > 0 || members.length < 4) && guard++ < 30 && members.length < 14) { const p = E.makeRaider('pirate', camp.x + U.ri(-2, 2), camp.y + U.ri(-2, 2), day); const c = 28; pts -= c; const i = Math.floor(p.y) * map.w + Math.floor(p.x); if (map.cost[i] === 0) { p.x = camp.x + 0.5; p.y = camp.y + 0.5; } p.siege = { x: camp.x + 0.5, y: camp.y + 0.5 }; g.pawns.push(p); members.push(p.id); }
    const mort = U.clamp(Math.floor(members.length / 4), 1, 3);
    g.raids.push({ id: U.nextId(), members, start: g.tick, kind: 'siege' }); g.stats.raids++;
    e.siege = { x: camp.x + 0.5, y: camp.y + 0.5, start: g.tick, until: g.tick + C2.SIEGE_DAYS * DY, phase: 'siege', mort, next: g.tick + 1100, members, side: dx > 0.4 ? 'сходу' : dx < -0.4 ? 'заходу' : dy > 0 ? 'півдня' : 'півночі', dir: [dx, dy] };
    RW.UI.letter('Облога!', 'Ворожий загін (' + members.length + ') не пішов у наступ, а розбив табір за ~' + C2.SIEGE_DIST + ' клітин ' + e.siege.side + ' від колонії. У них ' + mort + ' мортир' + (mort > 1 ? 'и' : 'а') + ': вони обстрілюватимуть вас ~' + C2.SIEGE_DAYS + ' доби. Зробіть вилазку й виженіть їх — або чекайте штурму.', 'bad', null, { x: camp.x, y: camp.y });
    RW.A && RW.A.sfx('alert'); return true;
  };
  function siegeTick(g) { // кожні 5 тіків
    const e = ex(g), s = e.siege; if (!s) return;
    const crew = s.members.map(id => g.pawns.find(p => p.id === id)).filter(p => p && !p.dead && !p.downed && !p.fleeing && !p.gone);
    if (s.phase === 'siege') {
      if (!crew.length) return endSiege(g, true);
      if (g.tick >= s.until) { // штурм
        s.phase = 'assault'; for (const p of crew) p.siege = null; RW.UI.letter('Штурм!', 'Облога затягнулась — вороги йдуть у наступ з табору!', 'bad', null, { x: s.x, y: s.y }); RW.A && RW.A.sfx('alert'); return;
      }
      if (g.tick >= s.next) {
        const n = Math.min(s.mort, Math.max(1, Math.ceil(crew.length / 3))); s.next = g.tick + Math.round(C2.SHELL_EVERY / (0.8 + n * 0.5)) + U.ri(0, 300);
        const cs = cols(g); const bl = g.map.buildings.filter(b => !b.def.floor && !b.def.moat && Math.hypot(b.x - g.home.x, b.y - g.home.y) < 18);
        let tx, ty; if (cs.length && Math.random() < 0.28) { const p = U.pick(cs); tx = p.x + U.rr(-2, 2); ty = p.y + U.rr(-2, 2); } else if (bl.length) { const w = bl.map(b => b.def.turret ? 3 : b.def.bed ? 1.6 : 1); let r = Math.random() * w.reduce((a, c) => a + c, 0), i = 0; for (; i < bl.length - 1; i++) { r -= w[i]; if (r <= 0) break; } tx = bl[i].x + 0.5 + U.rr(-1.2, 1.2); ty = bl[i].y + 0.5 + U.rr(-1.2, 1.2); } else { tx = g.home.x + U.rr(-8, 8); ty = g.home.y + U.rr(-8, 8); }
        e.shells.push({ x: tx, y: ty, t0: g.tick, hit: g.tick + C2.SHELL_WARN, fromX: s.x, fromY: s.y, fired: false }); if (!s.warned) { s.warned = 1; RW.UI.toast('💣 Мортири відкрили вогонь! Червоні кола — місця падіння', 'bad'); }
      }
    }
    for (let k = e.shells.length - 1; k >= 0; k--) {
      const sh = e.shells[k]; if (!sh.fired && g.tick >= sh.t0 + 6) { sh.fired = true; anims.push({ k: 'muzzle', x: sh.fromX, y: sh.fromY, t: 0, life: 20 }); RW.A && RW.A.sfx('alert'); }
      if (g.tick >= sh.hit) { e.shells.splice(k, 1); boom(g, sh.x, sh.y, C2.SHELL_R, C2.SHELL_BLD, C2.SHELL_PAWN, { fire: 2, shake: 8 }); if (g.stats) g.stats.shells = (g.stats.shells || 0) + 1; }
    }
  }
  function endSiege(g, won) {
    const e = ex(g), s = e.siege; if (!s) return; s.phase = 'done'; e.siege = null; e.shells.length = 0;
    if (won) {
      const map = g.map, sp = walkNear(map, s.x, s.y, 5); try { map.addItem('steel', U.ri(60, 120), sp.x, sp.y); map.addItem('components', U.ri(3, 7), sp.x + 1, sp.y); map.addItem('silver', U.ri(140, 300), sp.x, sp.y + 1); } catch (er) { }
      for (const p of cols(g)) p.addThought('siege_won'); if (g.stats) g.stats.sieges = (g.stats.sieges || 0) + 1;
      RW.UI.letter('Облогу знято!', 'Табір розбито. У покинутому таборі знайшли сталь, компоненти й срібло.', 'good', null, { x: s.x, y: s.y }); burst('confetti', s.x, s.y, 20);
    }
  }
  // вороги облоги не йдуть у наступ, поки поруч нема колоністів
  const rt = C.raiderThink;
  C.raiderThink = function (p) {
    const g = G();
    if (p.siege && siegeOn(g)) {
      let near = null, bd = 11; for (const o of g.pawns) { if (o.faction !== 'colony' || o.dead || o.hidden || o.downed) continue; const d = Math.hypot(o.x - p.x, o.y - p.y); if (d < bd) { bd = d; near = o; } }
      if (!near) { const d = Math.hypot(p.x - p.siege.x, p.y - p.siege.y); if (d > 3.5) { const r = AI.moveTo(p, Math.floor(p.siege.x), Math.floor(p.siege.y), { adj: true }); if (r === 'fail') p.siege = null; } else { p.moving = false; if (g.tick % 200 === p.id % 200) { const r = U.rr(-2, 2); AI.moveTo(p, Math.floor(p.siege.x + r), Math.floor(p.siege.y + U.rr(-2, 2))); } } return; }
    }
    if (p.bounty != null && bountyThink(p)) return;
    if (p.thief && thiefThink(p)) return;
    return rt.apply(this, arguments);
  };
  // малювання табору, снарядів і ефектів
  function drawCamp(c, TS, s, t) {
    const cx = s.x * TS, cy = s.y * TS; c.save();
    c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(cx, cy + 6, 70, 36, 0, 0, 6.3); c.fill();
    for (const [ox, oy, col] of [[-48, -10, '#6a5a3a'], [44, -14, '#5a4a32'], [-6, -34, '#7a6a44']]) { c.fillStyle = col; c.beginPath(); c.moveTo(cx + ox - 22, cy + oy + 16); c.lineTo(cx + ox, cy + oy - 16); c.lineTo(cx + ox + 22, cy + oy + 16); c.closePath(); c.fill(); c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1.2; c.stroke(); c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.moveTo(cx + ox - 5, cy + oy + 16); c.lineTo(cx + ox, cy + oy - 2); c.lineTo(cx + ox + 5, cy + oy + 16); c.fill(); }
    c.fillStyle = '#3a2a1a'; c.fillRect(cx - 2, cy - 4, 4, 5); const f = 1 + Math.sin(t * 0.35) * 0.22; c.fillStyle = 'rgba(255,190,80,.95)'; c.beginPath(); c.ellipse(cx, cy - 8, 3, 6 * f, 0, 0, 6.3); c.fill(); c.fillStyle = 'rgba(255,100,40,.9)'; c.beginPath(); c.ellipse(cx, cy - 6, 1.8, 3.4 * f, 0, 0, 6.3); c.fill();
    if (t % 14 === 0) fx2('smoke', s.x, s.y - 0.6, { c: '#666' });
    const dir = s.dir || [1, 0]; const ang = Math.atan2(-dir[1], -dir[0]);
    for (let k = 0; k < s.mort; k++) { const mx = cx - 30 + k * 30, my = cy + 20; c.save(); c.translate(mx, my); c.fillStyle = '#3a3e44'; c.fillRect(-9, 2, 18, 5); c.rotate(ang * 0.4 - 0.9); c.fillStyle = '#2a2d32'; c.fillRect(-3, -17, 7, 20); c.fillStyle = '#555a62'; c.fillRect(-4, -18, 9, 3); c.restore(); }
    c.fillStyle = '#7a1e1e'; c.fillRect(cx + 62, cy - 44, 2.5, 38); c.fillStyle = '#c43030'; c.beginPath(); c.moveTo(cx + 64.5, cy - 44); c.lineTo(cx + 84 + Math.sin(t * 0.12) * 3, cy - 38); c.lineTo(cx + 64.5, cy - 30); c.fill();
    for (let k = 0; k < 4; k++) { c.fillStyle = k % 2 ? '#5a4a30' : '#6a5838'; c.fillRect(cx + 28 + (k % 2) * 10, cy + 14 + ((k / 2) | 0) * 8, 12, 8); }
    c.restore();
  }
  function drawFx(c, TS, map, x0, y0, x1, y1, t) {
    const g = G(), e = ex(g);
    if (e.siege && e.siege.phase === 'siege') drawCamp(c, TS, e.siege, t);
    for (const sh of e.shells) { // червоне коло-попередження
      const u = (g.tick - sh.t0) / (sh.hit - sh.t0); if (u < 0 || u > 1) continue; const r = C2.SHELL_R * TS, a = 0.35 + 0.25 * Math.sin(t * 0.5);
      c.strokeStyle = 'rgba(255,60,40,' + a.toFixed(2) + ')'; c.lineWidth = 2; c.setLineDash([5, 4]); c.beginPath(); c.arc(sh.x * TS, sh.y * TS, r, 0, 6.3); c.stroke(); c.setLineDash([]); c.fillStyle = 'rgba(255,60,40,' + (0.08 + u * 0.18).toFixed(2) + ')'; c.fill();
      c.strokeStyle = 'rgba(255,230,160,.8)'; c.lineWidth = 1.5; c.beginPath(); c.arc(sh.x * TS, sh.y * TS, r * (1 - u), 0, 6.3); c.stroke();
      if (u > 0.08 && u < 0.85) { const q = (u - 0.08) / 0.77; const px = sh.fromX + (sh.x - sh.fromX) * q, py = sh.fromY + (sh.y - sh.fromY) * q - Math.sin(q * 3.14) * 9; c.fillStyle = '#2a2a2a'; c.beginPath(); c.arc(px * TS, py * TS, 3.2, 0, 6.3); c.fill(); c.fillStyle = 'rgba(255,220,120,.7)'; c.beginPath(); c.arc(px * TS, py * TS - 2, 1.6, 0, 6.3); c.fill(); }
    }
    for (let k = anims.length - 1; k >= 0; k--) {
      const a = anims[k]; a.t++; if (a.t > a.life) { anims.splice(k, 1); continue; } const u = a.t / a.life;
      if (a.k === 'boom') { const r = a.r * TS * (0.4 + u * 1.2); const gr = c.createRadialGradient(a.x * TS, a.y * TS, 2, a.x * TS, a.y * TS, r); gr.addColorStop(0, 'rgba(255,240,170,' + (1 - u).toFixed(2) + ')'); gr.addColorStop(0.5, 'rgba(255,130,40,' + ((1 - u) * 0.7).toFixed(2) + ')'); gr.addColorStop(1, 'rgba(120,40,10,0)'); c.fillStyle = gr; c.beginPath(); c.arc(a.x * TS, a.y * TS, r, 0, 6.3); c.fill(); c.strokeStyle = 'rgba(255,230,180,' + (0.8 * (1 - u)).toFixed(2) + ')'; c.lineWidth = 3 * (1 - u) + 1; c.beginPath(); c.arc(a.x * TS, a.y * TS, r * 1.15, 0, 6.3); c.stroke(); }
      else if (a.k === 'muzzle') { c.fillStyle = 'rgba(255,220,130,' + (1 - u).toFixed(2) + ')'; c.beginPath(); c.arc(a.x * TS, a.y * TS - 12, 10 * (1 - u) + 2, 0, 6.3); c.fill(); }
      else if (a.k === 'zap') { c.strokeStyle = 'rgba(255,255,255,' + (1 - u).toFixed(2) + ')'; c.lineWidth = 2; for (let i = 0; i < 5; i++) { const an = i / 5 * 6.283 + a.t * 0.4; c.beginPath(); c.moveTo(a.x * TS, a.y * TS); c.lineTo(a.x * TS + Math.cos(an) * 14 * (1 + u), a.y * TS + Math.sin(an) * 14 * (1 + u)); c.stroke(); } }
    }
    // бойові тварини: червоне розмальовування під лапами
    for (const an of g.animals) { if (an.dead || !an.trained || !an.trained.war) continue; if (an.x < x0 - 1 || an.x > x1 + 1 || an.y < y0 - 1 || an.y > y1 + 1) continue; c.strokeStyle = 'rgba(220,60,50,' + (0.55 + 0.2 * Math.sin(t * 0.12 + an.id)).toFixed(2) + ')'; c.lineWidth = 2; c.beginPath(); c.ellipse(an.x * TS, an.y * TS + 6, 11, 5, 0, 0, 6.3); c.stroke(); c.fillStyle = '#c43030'; c.beginPath(); c.moveTo(an.x * TS - 3, an.y * TS - 10); c.lineTo(an.x * TS + 3, an.y * TS - 10); c.lineTo(an.x * TS, an.y * TS - 4); c.fill(); }
  }
  RW.R.worldOver.push(drawFx);
  RW.Seas && RW.Seas.chips.push(g => { const s = ex(g).siege; if (!s || s.phase === 'done') return []; const alive = s.members.filter(id => g.pawns.some(p => p.id === id && !p.dead)).length; const left = Math.max(0, s.until - g.tick); return [{ k: 'siege', ico: '🏰', t: s.phase === 'siege' ? 'Облога · ворогів ' + alive + ' · ще ' + (left / DY).toFixed(1) + ' д' : 'Штурм!', cls: 'warn', pct: s.phase === 'siege' ? left / (C2.SIEGE_DAYS * DY) : 1, title: 'Знищте табір — вилазка надійніша за очікування' }]; });
  // перехоплення рейдів: іноді замість наступу — облога
  const raid0 = E.raid;
  E.raid = function (pts, silent) { const g = G(); if (!silent && !pts && dayN(g) >= 18 && !ex(g).siege && g.raids.every(r => !r.members.some(id => g.pawns.some(p => p.id === id && !p.dead))) && Math.random() < C2.SIEGE_CH) { if (C2.startSiege()) return []; } return raid0.apply(this, arguments); };

  // ======================================================================
  //  17. ПАСТКИ З КОМБІНАЦІЯМИ
  // ======================================================================
  const def = (id, o) => { o.id = id; o.w = 1; o.h = 1; o.cost = o.cost || {}; o.hp = o.hp || 40; o.pass = 1; o.flam = 0; o.beauty = -1; o.trap = true; o.cat = 'security'; D.bld[id] = o; };
  def('trap_spike', { name: 'Пастка з шипами', desc: 'Колить ворога, що наступив. Знову заряджається вручну. Поруч із вогняною — «палаючі шипи».', cost: { steel: 8 }, work: 120, color: '#9a9aa4', kind: 'spike' });
  def('trap_fire', { name: 'Вогняна пастка', desc: 'Спалахує при наступанні й підпалює клітини навколо. Пекельна у парі з шипами чи вибухівкою.', cost: { steel: 6, wood: 8 }, work: 110, color: '#e8742a', kind: 'fire' });
  def('trap_boom', { name: 'Вибухова пастка', desc: 'Потужний вибух по площі. Шкодить і вам, якщо ваші поруч!', cost: { steel: 14, components: 1 }, work: 220, color: '#c43030', kind: 'boom' });
  def('trap_net', { name: 'Сітчаста пастка', desc: 'Скувує ворога на кілька секунд. Разом з іншими пастками завдає на 40% більше шкоди.', cost: { cloth: 10, wood: 6 }, work: 100, color: '#b8b090', kind: 'net' });
  const spr = {}; const cv = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d')); return c; };
  const TS_ = {
    trap_spike: () => cv(32, 32, c => { c.fillStyle = 'rgba(60,60,66,.8)'; c.fillRect(3, 3, 26, 26); c.fillStyle = '#c8c8d2'; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { const x = 6 + i * 9, y = 6 + j * 9; c.beginPath(); c.moveTo(x, y + 7); c.lineTo(x + 3.5, y); c.lineTo(x + 7, y + 7); c.fill(); } }),
    trap_fire: () => cv(32, 32, c => { c.fillStyle = 'rgba(70,40,24,.85)'; c.fillRect(3, 3, 26, 26); c.fillStyle = '#e8742a'; c.beginPath(); c.arc(16, 16, 8, 0, 6.3); c.fill(); c.fillStyle = '#ffd37a'; c.beginPath(); c.arc(16, 16, 4, 0, 6.3); c.fill(); c.strokeStyle = '#2a1a10'; c.lineWidth = 1.5; c.strokeRect(3.5, 3.5, 25, 25); }),
    trap_boom: () => cv(32, 32, c => { c.fillStyle = 'rgba(60,24,24,.85)'; c.fillRect(3, 3, 26, 26); c.fillStyle = '#2a2a30'; c.beginPath(); c.arc(16, 18, 8, 0, 6.3); c.fill(); c.strokeStyle = '#d0a040'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(16, 10); c.quadraticCurveTo(20, 4, 24, 6); c.stroke(); c.fillStyle = '#ff6a3a'; c.fillRect(23, 4, 3, 3); }),
    trap_net: () => cv(32, 32, c => { c.fillStyle = 'rgba(70,68,50,.6)'; c.fillRect(3, 3, 26, 26); c.strokeStyle = '#d8d0a8'; c.lineWidth = 1.2; for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(4 + i * 6, 4); c.lineTo(4 + i * 6, 28); c.moveTo(4, 4 + i * 6); c.lineTo(28, 4 + i * 6); c.stroke(); } })
  };
  const bs = RW.GFX.bldSprite; RW.GFX.bldSprite = function (k) { if (TS_[k]) return spr[k] || (spr[k] = TS_[k]()); return bs.apply(this, arguments); };
  for (const k in TS_) D.bld[k].drawX = function (c, b, px, py, t) {
    if (b.buf && b.buf.used) { c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(px + 3, py + 3, 26, 26); c.strokeStyle = '#ff8a5a'; c.lineWidth = 1.2; c.setLineDash([2, 2]); c.strokeRect(px + 4, py + 4, 24, 24); c.setLineDash([]); c.fillStyle = '#ffb08a'; c.font = '10px sans-serif'; c.textAlign = 'center'; c.fillText('⟳', px + 16, py + 20); }
    else if (b.armedFlash > 0) { b.armedFlash--; c.fillStyle = 'rgba(160,255,160,' + (b.armedFlash / 18).toFixed(2) + ')'; c.fillRect(px + 3, py + 3, 26, 26); }
  };
  const trapsAt = (g, i) => { const b = g.map.bld[i]; return b && b.def.trap && !(b.buf && b.buf.used) ? b : null; };
  function cluster(g, b) { const out = [b], seen = new Set([b]); for (let q = 0; q < out.length; q++) { const a = out[q]; for (const o of g.map.buildings) { if (!o.def.trap || seen.has(o) || (o.buf && o.buf.used)) continue; if (Math.max(Math.abs(o.x - a.x), Math.abs(o.y - a.y)) <= C2.TRAP_CHAIN_R) { seen.add(o); out.push(o); } } } return out; }
  function fireTrap(g, b, victim, kinds, delay) {
    b.buf = b.buf || {}; b.buf.used = 1; const x = b.x + 0.5, y = b.y + 0.5, k = b.def.kind; const has = n => kinds.has(n), net = has('net');
    const mulNet = net && k !== 'net' ? 1.4 : 1;
    const run = () => {
      anims.push({ k: 'zap', x, y, t: 0, life: 16 }); const near = g.pawns.concat(g.animals).filter(q => !q.dead && (q.faction === 'enemy' || q.manhunt || q.hostile) && Math.hypot(q.x - x, q.y - y) < (k === 'boom' ? C2.BOOM_R : 1.1));
      if (k === 'spike') { for (const q of near.length ? near : (victim ? [victim] : [])) { q.takeDamage(C2.SPIKE * mulNet * (has('fire') ? 1.5 : 1), 'cut'); if (has('fire')) q.takeDamage(6, 'fire'); } RW.R.fx.text(x, y - 0.4, '🗡', '#dde'); burst('sparkle', x, y, 6, { c: '#e8e8f0' }); }
      else if (k === 'fire') { for (const q of near.length ? near : (victim ? [victim] : [])) q.takeDamage(C2.FIRE * mulNet, 'fire'); if (E.startFire) for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = b.x + dx, yy = b.y + dy; if (g.map.inb(xx, yy) && (dx === 0 || Math.random() < 0.65)) E.startFire(yy * g.map.w + xx, 0.75); } RW.R.fx.text(x, y - 0.4, '🔥', '#fa6'); }
      else if (k === 'boom') { boom(g, x, y, C2.BOOM_R + (has('fire') ? 0.8 : 0), 26, C2.BOOM * mulNet, { fire: has('fire') ? 4 : 0, shake: 7, only: q => !(q.faction === 'colony' && !q.hostile) || Math.hypot(q.x - x, q.y - y) < 1.2 }); }
      else if (k === 'net') { for (const q of near.length ? near : (victim ? [victim] : [])) { q.stun = Math.max(q.stun || 0, C2.NET_STUN); fx2('sparkle', q.x, q.y - 0.4, { c: '#e8e0b0' }); } RW.R.fx.text(x, y - 0.4, '🕸', '#eed'); }
      g.map.touch(b.y * g.map.w + b.x); if (g.stats) g.stats.traps = (g.stats.traps || 0) + 1;
    };
    if (delay > 0) setTimeout(run, delay); else run();
  }
  function trapTick(g) { // кожні 6 тіків
    const map = g.map; if (!map.buildings.some(b => b.def.trap)) return;
    for (const q of g.pawns.concat(g.animals)) {
      if (q.dead || q.hidden) continue; const foe = q.faction === 'enemy' || q.manhunt || q.hostile; if (!foe) continue;
      const b = trapsAt(g, Math.floor(q.y) * map.w + Math.floor(q.x)); if (!b) continue;
      const cl = cluster(g, b), kinds = new Set(cl.map(o => o.def.kind));
      cl.forEach((o, n) => fireTrap(g, o, q, kinds, n === 0 ? 0 : 140 * n));
      if (cl.length >= 3) { RW.UI.toast('💥 Ланцюгова реакція: ' + cl.length + ' пасток!', 'good'); if (g.stats) g.stats.chains = (g.stats.chains || 0) + 1; }
      else if (kinds.size > 1) RW.UI.toast('⚡ Комбо пасток: ' + [...kinds].map(k => ({ spike: 'шипи', fire: 'вогонь', boom: 'вибух', net: 'сітка' }[k])).join(' + '), 'good');
      for (const p of cols(g)) if (Math.hypot(p.x - b.x, p.y - b.y) < 10) p.addThought('trap_joy');
      break;
    }
  }
  AI.RUN.rearm = function (p, j) {
    const g = G(), map = g.map; const b = j.b; if (!b || !map.buildings.includes(b) || !(b.buf && b.buf.used)) return 'done';
    const r = AI.moveTo(p, b.x, b.y, { adj: true }); if (r === 'fail') return 'fail';
    if (r === 'arrived' || Math.hypot(p.x - b.x - 0.5, p.y - b.y - 0.5) < 1.7) {
      p.moving = false; AI.faceTo(p, b.x + 0.5, b.y + 0.5); j.t = (j.t || 0) + p.workSpeed('construction'); p.gainXp('construction', 0.07); if (j.t % 30 < 1.2) fx2('sparkle', b.x + 0.5, b.y + 0.4, { c: '#9fe08a' });
      if (j.t >= C2.TRAP_REARM) { b.buf.used = 0; b.armedFlash = 18; RW.R.fx.text(b.x + 0.5, b.y - 0.4, '✔', '#9fe08a'); return 'done'; }
    }
  };
  function rearmTick(g) { // кожні 120 тіків
    const used = g.map.buildings.filter(b => b.def.trap && b.buf && b.buf.used && !b.rearmRes); if (!used.length || g.threat > 0) return;
    for (const p of cols(g)) { if (p.isChild || p.drafted || p.downed || p.mental || p.sleeping || (p.job && !['wander', 'chat', 'joy', 'stargaze'].includes(p.job.type)) || !p.canDo('construction')) continue; const b = used.find(u => !u.rearmRes); if (!b) return; b.rearmRes = p.id; setTimeout(() => { b.rearmRes = 0; }, 8000); AI.endJob(p); AI.setJob(p, { type: 'rearm', b }); return; }
  }

  // ======================================================================
  //  18. БОЙОВІ ТВАРИНИ
  // ======================================================================
  const H = RW.Husbandry;
  if (H && H.TRAIN) {
    H.TRAIN.war = { l: 'Бойовий', ico: '⚔', d: 'Міцніший (+35% здоров\'я), кусає на 40% сильніше, втричі менше шкоди від ударів у відповідь, охороняє здалеку й першим кидається на ворога.' };
    for (const k of ['dog', 'wolf', 'boar']) { const a = D.animals[k]; if (!a) continue; a.trainable = (a.trainable || []).slice(); if (!a.trainable.includes('guard')) a.trainable.push('guard'); if (!a.trainable.includes('war')) a.trainable.push('war'); }
  }
  const AP = RW.Animal && RW.Animal.prototype;
  function applyWar(a) {
    if (a.warApplied) return; a.warApplied = true; a.maxhp = Math.round(a.maxhp * C2.WAR_HP); a.hp = Math.min(a.maxhp, a.hp + a.maxhp * 0.3);
    Object.defineProperty(a, 'def', { value: Object.assign({}, a.def, { dmg: (a.def.dmg || 3) * C2.WAR_DMG }), configurable: true, writable: true }); burst('sparkle', a.x, a.y - 0.4, 8, { c: '#ff6a5a' }); RW.R.fx.text(a.x, a.y - 1, '⚔', '#ff6a5a');
  }
  if (AP) { const td = AP.takeDamage; AP.takeDamage = function (d, t, src) { if (this.trained && this.trained.war) d *= C2.WAR_ARMOR; return td.call(this, d, t, src); }; }
  function warTick(g) { // кожні 25 тіків
    for (const a of g.animals) {
      if (a.dead || a.faction !== 'colony' || !a.trained || !a.trained.war) continue; applyWar(a);
      if (a.hostile || a.manhunt) continue; if (a.state === 'attack' && a.target && !a.target.dead) continue;
      let best = null, bd = C2.WAR_RANGE; for (const e of g.pawns) { if (e.faction !== 'enemy' || e.dead || e.downed || e.hidden) continue; const d = Math.hypot(e.x - a.x, e.y - a.y); if (d < bd) { bd = d; best = e; } }
      if (best) { a.state = 'attack'; a.target = best; a.attackStart = g.tick; if (!a.roar || g.tick - a.roar > 900) { a.roar = g.tick; RW.R.fx.text(a.x, a.y - 1, '🗯 ГАВ!', '#ff8a6a'); fx2('anger', a.x, a.y - 0.6); } }
    }
  }

  // ======================================================================
  //  20. ОСОБЛИВІ ВОРОГИ
  // ======================================================================
  const exitFor = p => { p.fleeing = true; p.exitTile = null; };
  // ---- мисливець за головами ----
  function spawnBounty(g) {
    const cs = cols(g).filter(p => !p.isChild); if (cs.length < 2) return false; const map = g.map, sp = E.edgeSpawn(map, g.home);
    const score = p => Object.values(p.skills || {}).reduce((a, s) => a + (s.lvl || 0), 0); const tgt = cs.sort((a, b) => score(b) - score(a))[0];
    const h = E.makeRaider('pirate', sp.x, sp.y, dayN(g) + 8); h.equip.weapon = 'rifle'; h.equip.apparel = 'flak_vest'; h.name.nick = 'Мисливець'; for (const k of ['shooting', 'melee']) h.skills[k].lvl = U.clamp(h.skills[k].lvl + 5, 0, 18);
    h.bounty = tgt.id; h.maxhp = (h.maxhp || 100); g.pawns.push(h); g.raids.push({ id: U.nextId(), members: [h.id], start: g.tick, kind: 'bounty' });
    const rew = U.ri(220, 420);
    RW.UI.letter('Мисливець за головами', 'До колонії наближається найманець ' + U.fullName(h) + '. Він шукає ' + U.fullName(tgt) + ': за нього призначена нагорода. Можна віддати колоніста (отримаєте ' + rew + ' срібла, але всі це запам\'ятають) або дати бій.', 'bad', tgt, null, [
      { label: '⚔ Битися', fn: () => { } },
      { label: '💰 Видати колоніста', fn: () => { const t = g.pawns.find(p => p.id === tgt.id); if (!t || t.dead) return; try { g.map.addItem('silver', rew, Math.floor(g.home.x), Math.floor(g.home.y)); } catch (e) { } for (const p of cols(g)) if (p !== t) p.addThought('betrayed'); C.removePawn(t, 'вислано'); const hh = g.pawns.find(p => p.id === h.id); if (hh) { hh.bounty = null; exitFor(hh); } RW.UI.toast('Колоніста видано', 'bad'); } }
    ]);
    RW.A && RW.A.sfx('alert'); return true;
  }
  function bountyThink(p) {
    const g = G(); const t = g.pawns.find(q => q.id === p.bounty && !q.dead);
    if (!t) { p.bounty = null; exitFor(p); return false; }
    if (t.downed) { const d = Math.hypot(p.x - t.x, p.y - t.y); if (d > 1.8) { AI.moveTo(p, t.tx, t.ty, { adj: true }); return true; } RW.UI.letter('Нагороду отримано', U.fullName(p) + ' забрав(ла) пораненого ' + U.fullName(t) + ' і зник(ла).', 'bad', null); for (const q of cols(g)) if (q !== t) q.addThought('betrayed', 0.6); C.removePawn(t, 'забрано'); p.bounty = null; exitFor(p); return true; }
    if (p.fleeing) return false;
    if (!p.target || p.target.dead || p.target.id !== t.id) p.target = t;
    const r = C.attack(p, t, {}); if (r === 'fail') { p.target = null; } return true;
  }
  // ---- злодій ----
  function spawnThief(g) {
    const map = g.map, sp = E.edgeSpawn(map, g.home); let best = null, bv = 0;
    for (const a of map.items.values()) for (const it of a) { if (it.forbid || it.res) continue; const d = D.items[it.def]; if (!d) continue; const v = (d.value || 1) * Math.min(it.n, 200); if (v > bv && Math.hypot((it.i % map.w) - g.home.x, ((it.i / map.w) | 0) - g.home.y) < 40) { bv = v; best = it; } }
    if (!best || bv < 60) return false;
    const t = E.makeRaider('pirate', sp.x, sp.y, dayN(g)); t.equip.weapon = 'knife'; t.equip.apparel = null; t.name.nick = 'Злодій'; t.look.shirt = '#1c1c22'; t.look.pants = '#16161a'; t.thief = { state: 'sneak', item: best.id, spotted: false }; t.speedMul = 1.1;
    g.pawns.push(t); g.raids.push({ id: U.nextId(), members: [t.id], start: g.tick, kind: 'thief' }); return true;
  }
  function thiefThink(p) {
    const g = G(), map = g.map, th = p.thief; if (p.fleeing) { return false; }
    let near = null, nd = 99; for (const o of g.pawns) { if (o.faction !== 'colony' || o.dead || o.downed || o.hidden) continue; const d = Math.hypot(o.x - p.x, o.y - p.y); if (d < nd) { nd = d; near = o; } }
    if (near && nd < 7 && !th.spotted) { th.spotted = true; RW.UI.letter('Чужинець!', 'Хтось у темному крадеться до вашого складу — це злодій!', 'warn', near, { x: p.x, y: p.y }); RW.A && RW.A.sfx('alert'); if (RW.Life && RW.Life.bubble) RW.Life.bubble(near, '❗', 400); }
    if (th.state === 'sneak') {
      let it = null; for (const a of map.items.values()) for (const x of a) if (x.id === th.item) it = x;
      if (!it || it.n <= 0) { // шукаємо інше
        let bv = 0; for (const a of map.items.values()) for (const x of a) { if (x.forbid) continue; const d = D.items[x.def]; const v = (d.value || 1) * Math.min(x.n, 200); if (v > bv && Math.hypot((x.i % map.w) - g.home.x, ((x.i / map.w) | 0) - g.home.y) < 40) { bv = v; it = x; th.item = x.id; } } if (!it) { exitFor(p); return false; }
      }
      const tx = it.i % map.w, ty = (it.i / map.w) | 0; const r = AI.moveTo(p, tx, ty);
      if (r === 'fail') { exitFor(p); return false; }
      if (r === 'arrived' || Math.hypot(p.x - tx - 0.5, p.y - ty - 0.5) < 0.9) { const got = map.takeItem(it, Math.min(it.n, 200)); p.carry = { def: it.def, n: got }; th.state = 'run'; th.loot = { def: it.def, n: got }; RW.R.fx.text(p.x, p.y - 1, '🥷 +' + got, '#ddd'); if (!th.spotted) { th.spotted = true; } RW.UI.toast('🥷 Злодій вкрав ' + got + ' × ' + (D.items[it.def] ? D.items[it.def].name : it.def) + '! Наздоженіть!', 'bad'); exitFor(p); }
      return true;
    }
    return false;
  }
  function thiefCleanup(g) { // повернути вкрадене, якщо злодія вбито/спіймано
    for (const p of g.pawns) { if (!p.thief || !p.thief.loot || p.thief.done) continue; if ((p.dead || p.downed) && p.carry) { p.thief.done = 1; try { g.map.addItem(p.carry.def, p.carry.n, Math.floor(p.x), Math.floor(p.y)); } catch (e) { } p.carry = null; for (const q of cols(g)) q.addThought('thief_caught'); RW.UI.toast('✅ Вкрадене повернуто', 'good'); } }
  }
  // ---- утікач ----
  function spawnEscapee(g) {
    const cs = cols(g); if (cs.length < 2) return false; const nm = U.randomName(Math.random() < 0.5 ? 'f' : 'm');
    RW.UI.letter('Утікач', 'До воріт прибіг змучений незнайомець і просить прихистку: за ним женеться банда. «Я вмію працювати, тільки сховайте мене». Якщо прийняти, погоня прийде по нього за 1–3 доби.', 'info', null, null, [
      { label: '🤝 Прийняти', fn: () => acceptEscapee(g) }, { label: 'Відмовити', fn: () => { RW.UI.toast('Утікач пішов своєю дорогою', 'info'); } }]);
    return true;
  }
  function acceptEscapee(g) {
    const map = g.map, sp = E.edgeSpawn(map, g.home); const p = RW.Pawn.generate({ age: U.ri(24, 45) }); p.faction = 'colony'; p.title = 'Утікач'; p.equip.weapon = null;
    for (const k of Object.keys(p.skills)) p.skills[k].lvl = U.clamp(p.skills[k].lvl + U.ri(1, 4), 0, 16); p.x = sp.x + 0.5; p.y = sp.y + 0.5;
    g.pawns.push(p); p.addThought('refuge_grateful'); RW.Events.initRelations && RW.Events.initRelations(p); p.injuries.push({ id: U.nextId(), part: 'torso', type: 'cut', amt: 4, bleed: 0.0002, tended: 0, age: 0, perm: false });
    ex(g).pursuit = { at: g.tick + U.ri(1.2 * DY, 3 * DY), id: p.id }; RW.UI.toast('🤝 ' + U.fullName(p) + ' тепер у колонії', 'good'); burst('heart', p.x, p.y - 0.5, 5);
  }
  function pursuitTick(g) {
    const e = ex(g), pu = e.pursuit; if (!pu || g.tick < pu.at) return; e.pursuit = null; const tgt = g.pawns.find(p => p.id === pu.id && !p.dead); if (!tgt) return;
    const members = E.raid(Math.max(120, E.threatPoints() * 0.7), true); if (!members || !members.length) return;
    RW.UI.letter('Погоня', 'Банда, що ганялася за ' + U.fullName(tgt) + ', дісталась колонії. Вони вимагають видати втікача — і тоді відійдуть без бою.', 'bad', tgt, null, [
      { label: '⚔ Битися', fn: () => { } },
      { label: '🚪 Видати втікача', fn: () => { const t = g.pawns.find(p => p.id === tgt.id); if (!t || t.dead) return; for (const p of cols(g)) if (p !== t) p.addThought('betrayed', 0.7); C.removePawn(t, 'видано'); for (const id of members) { const r = g.pawns.find(p => p.id === id); if (r) exitFor(r); } RW.UI.toast('Банда пішла', 'info'); } }
    ]); RW.A && RW.A.sfx('alert');
  }
  function specialDaily(g) {
    const e = ex(g), day = dayN(g); if (day < C2.SPECIAL_FROM || day - e.special < C2.SPECIAL_COOL || g.threat > 0 || e.siege) return;
    const act = g.pawns.some(p => p.faction === 'enemy' && !p.dead); if (act) return;
    for (const k of ['thief', 'bounty', 'escapee']) { if (Math.random() < C2.SPECIAL_CH[k]) { const ok = k === 'thief' ? spawnThief(g) : k === 'bounty' ? spawnBounty(g) : spawnEscapee(g); if (ok) { e.special = day; return; } } }
  }
  C2.spawn = { bounty: spawnBounty, thief: spawnThief, escapee: spawnEscapee };

  const jl = AI.jobLabel; AI.jobLabel = function (p) { const t = p.job && p.job.type; if (t === 'cellar') return 'Носить їжу в підвал'; if (t === 'delve') return 'Спускається в шахту'; if (t === 'rearm') return 'Заряджає пастку'; if (p.thief) return 'Крадеться'; if (p.bounty != null) return 'Полює на колоніста'; if (p.siege) return 'Облога'; return jl.apply(this, arguments); };
  // ---------- підключення ----------
  const lt = RW.Life.tick;
  RW.Life.tick = function (g) {
    lt(g);
    try {
      const t = g.tick;
      if (t % 5 === 3) siegeTick(g);
      if (t % 6 === 1) trapTick(g);
      if (t % 25 === 7) warTick(g);
      if (t % 30 === 11) { thiefCleanup(g); pursuitTick(g); }
      if (t % 120 === 53) rearmTick(g);
      if (t % DY === 3300) specialDaily(g);
      const e = ex(g); if (e.siege && e.siege.phase === 'assault' && t % 120 === 0 && !e.siege.members.some(id => g.pawns.some(p => p.id === id && !p.dead))) endSiege(g, true);
    } catch (err) { console.error(err); }
  };
  C2._t = { siegeTick, trapTick, warTick, specialDaily, ex, anims, endSiege };
})();
