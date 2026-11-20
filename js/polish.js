'use strict';
// ============================================================
//  polish.js (v0.9.14)
//  • тонкі стіни (16 px) з окремою деталізованою текстурою; двері під їхній розмір
//  • деталізовані двері; відкриваються заздалегідь і самі закриваються
//  • торгова ятка не з'являється на спорудах колоністів
// ============================================================
(function () {
  const RW = window.RW, D = RW.D, U = RW.U, GFX = RW.GFX; const G = () => RW.G; const TS = RW.TS || 32;
  const A = 8, B = 24; // товщина стіни 16
  GFX.wallShape = function (m) {
    const r = [[A, A, B - A, B - A]];
    if (m & 1) r.push([A, 0, B - A, A]); if (m & 2) r.push([B, A, TS - B, B - A]); if (m & 4) r.push([A, B, B - A, TS - B]); if (m & 8) r.push([0, A, A, B - A]);
    return r;
  };
  const mkc = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const shapeCanvas = (rects, fill) => { const c = mkc(TS, TS), x = c.getContext('2d'); x.fillStyle = fill || '#fff'; for (const r of rects) x.fillRect(r[0], r[1], r[2], r[3]); return c; };
  // край фігури, звернений в бік (dx,dy): фігура мінус фігура, зсунута проти напрямку
  const edge = (rects, dx, dy, col) => { const c = shapeCanvas(rects), x = c.getContext('2d'); x.globalCompositeOperation = 'destination-out'; x.drawImage(shapeCanvas(rects), dx, dy); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, TS, TS); return c; };
  const ow = GFX.wallSprite; GFX.thinCache = {};
  GFX.wallSprite = function (defKey, mask) {
    const key = defKey + ':' + mask; if (GFX.thinCache[key]) return GFX.thinCache[key];
    const full = ow(defKey, 15); const rects = GFX.wallShape(mask);
    const c = mkc(TS, TS), x = c.getContext('2d');
    x.save(); x.beginPath(); for (const r of rects) x.rect(r[0], r[1], r[2], r[3]); x.clip(); x.drawImage(full, 0, 0); x.restore();
    // дрібні деталі: тіні від країв і відблиски
    x.drawImage(edge(rects, 0, 2, 'rgba(255,255,255,0.34)'), 0, 0); // верхні грані
    x.drawImage(edge(rects, -2, 0, 'rgba(255,255,255,0.14)'), 0, 0); // ліві
    x.drawImage(edge(rects, 0, -3, 'rgba(0,0,0,0.5)'), 0, 0); // нижні
    x.drawImage(edge(rects, 2, 0, 'rgba(0,0,0,0.32)'), 0, 0); // праві
    // обведення
    const ol = shapeCanvas(rects, 'rgba(14,10,8,0.9)'); x.globalCompositeOperation = 'destination-over'; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) x.drawImage(ol, dx, dy);
    x.globalCompositeOperation = 'source-over';
    GFX.thinCache[key] = c; return c;
  };
  // ---- двері: лише полотно (рамку малює render.js) ----
  GFX.doorCache2 = {};
  GFX.doorSprite = function (defKey, horiz) {
    const key = defKey + horiz; if (GFX.doorCache2[key]) return GFX.doorCache2[key];
    const steel = defKey === 'door_steel'; const base = D.bld[defKey] ? D.bld[defKey].color : '#8a6a3a'; const rnd = U.rng(U.hashStr(defKey) + 5);
    const c = mkc(TS, TS), x = c.getContext('2d');
    x.save(); if (!horiz) { x.translate(TS / 2, TS / 2); x.rotate(Math.PI / 2); x.translate(-TS / 2, -TS / 2); }
    const y0 = A, h = B - A; // 16 px
    // основа
    const tex = GFX.groundTile ? GFX.groundTile(base, { low: 10, mid: 8, fine: 8, warm: 2 }, steel ? 71 : 29) : null;
    x.save(); x.beginPath(); x.rect(1, y0, TS - 2, h); x.clip(); if (tex) x.drawImage(tex, 0, 0); else { x.fillStyle = base; x.fillRect(0, 0, TS, TS); } x.restore();
    if (!steel) {
      // дошки вздовж полотна
      for (let k = 0; k < 4; k++) { const yy = y0 + k * 4; x.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'; x.fillRect(1, yy, TS - 2, 4); x.fillStyle = 'rgba(25,12,4,0.55)'; x.fillRect(1, yy + 3, TS - 2, 1); x.fillStyle = 'rgba(255,230,180,0.18)'; x.fillRect(1, yy, TS - 2, 1);
        x.strokeStyle = 'rgba(30,16,6,0.3)'; x.lineWidth = 0.6; x.beginPath(); x.moveTo(1, yy + 1.6); x.bezierCurveTo(10, yy + 1.2 + rnd(), 22, yy + 2.2 - rnd(), TS - 1, yy + 1.6); x.stroke(); }
      // поперечні бруски
      for (const bx of [3, 14, 25]) { x.fillStyle = U.shade(base, -0.28); x.fillRect(bx, y0, 4, h); x.fillStyle = 'rgba(255,255,255,0.14)'; x.fillRect(bx, y0, 1, h); x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(bx + 3, y0, 1, h); x.fillStyle = '#b8b2a0'; for (const ny of [y0 + 3, y0 + h - 4]) { x.fillRect(bx + 1.4, ny, 1.2, 1.2); } }
      // ручка
      x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(20.5, y0 + 5.5, 4.5, 3); x.fillStyle = '#d4b860'; x.fillRect(20, y0 + 5, 4.5, 2.6); x.fillStyle = '#fff3b0'; x.fillRect(20, y0 + 5, 4.5, 0.8);
    } else {
      // сталева панель із ребрами
      x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(1, y0, TS - 2, 3); x.fillStyle = 'rgba(0,0,0,0.2)'; x.fillRect(1, y0 + h - 3, TS - 2, 3);
      x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 1; x.beginPath(); x.moveTo(TS / 2, y0); x.lineTo(TS / 2, y0 + h); x.stroke(); x.strokeStyle = 'rgba(255,255,255,0.25)'; x.beginPath(); x.moveTo(TS / 2 + 1, y0); x.lineTo(TS / 2 + 1, y0 + h); x.stroke();
      for (const [px, py] of [[4, y0 + 3], [4, y0 + h - 3], [TS - 5, y0 + 3], [TS - 5, y0 + h - 3], [TS / 2 - 3, y0 + 3], [TS / 2 + 4, y0 + h - 3]]) { x.fillStyle = '#20262c'; x.beginPath(); x.arc(px + 0.4, py + 0.5, 1.4, 0, 6.3); x.fill(); x.fillStyle = '#b4c0ca'; x.beginPath(); x.arc(px, py, 1.1, 0, 6.3); x.fill(); }
      // попереджувальні смуги й індикатор
      x.save(); x.beginPath(); x.rect(5, y0 + 6, 8, 4); x.clip(); x.fillStyle = '#d8b020'; x.fillRect(5, y0 + 6, 8, 4); x.fillStyle = '#20202a'; for (let k = -2; k < 5; k++) { x.beginPath(); x.moveTo(5 + k * 3, y0 + 10); x.lineTo(7 + k * 3, y0 + 10); x.lineTo(11 + k * 3, y0 + 6); x.lineTo(9 + k * 3, y0 + 6); x.closePath(); x.fill(); } x.restore();
      x.fillStyle = '#103018'; x.fillRect(TS / 2 + 5, y0 + 6, 3, 4); x.fillStyle = '#5af08a'; x.fillRect(TS / 2 + 5.5, y0 + 6.5, 2, 3); x.fillStyle = 'rgba(120,255,160,0.35)'; x.fillRect(TS / 2 + 4.5, y0 + 5.5, 4, 5);
      x.fillStyle = '#2a3036'; x.fillRect(TS / 2 + 10, y0 + 6, 5, 3); x.fillStyle = '#c4ced6'; x.fillRect(TS / 2 + 10, y0 + 6, 5, 1);
    }
    // рамка полотна, обведення
    x.strokeStyle = 'rgba(14,10,8,0.9)'; x.lineWidth = 1; x.strokeRect(1.5, y0 + 0.5, TS - 3, h - 1);
    x.strokeStyle = 'rgba(255,255,255,0.28)'; x.beginPath(); x.moveTo(2, y0 + 1.5); x.lineTo(TS - 2, y0 + 1.5); x.stroke();
    x.restore();
    GFX.doorCache2[key] = c; return c;
  };

  // ---- двері: відкриваються заздалегідь, самі закриваються ----
  RW.Life_doors = true;
  function doorTick(g) {
    const map = g.map; if (!map) return;
    if (g.tick % 3) return;
    const mv = []; for (const p of g.pawns) if (!p.dead && !p.hidden && !p.carriedBy) mv.push(p); if (g.animals) for (const a of g.animals) if (!a.dead) mv.push(a);
    for (const b of map.buildings) {
      if (!b.door) continue; const cx = b.x + 0.5, cy = b.y + 0.5; let near = false;
      for (const p of mv) { const dx = p.x - cx, dy = p.y - cy; if (dx * dx + dy * dy < 1.9 && (p.moving || Math.abs(dx) < 0.6 && Math.abs(dy) < 0.6)) { near = true; break; } }
      if (near) b.door.open = Math.max(b.door.open || 0, 24);
    }
  }
  const lt = RW.Life.tick; RW.Life.tick = function (g) { const r = lt.apply(this, arguments); try { doorTick(g); relocate(g); } catch (e) { console.error('polish', e); } return r; };

  // ---- торгова ятка ----
  const free = (map, x, y) => { if (!map.inb(x, y)) return false; const i = y * map.w + x; return !map.blk[i] && !map.bld[i] && !map.bp[i] && map.cost[i] > 0 && map.room[i] < 0 && (!map.zone || true); };
  const areaFree = (map, sx, sy) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) if (!free(map, sx + dx, sy + dy)) return false; return true; };
  function relocate(g) {
    if (g.tick % 90 !== 11 || !g.trader) return; const map = g.map; const sp = g.tradeSpot; if (!sp) return;
    const sx = Math.floor(sp.x), sy = Math.floor(sp.y); if (areaFree(map, sx, sy)) return;
    let best = null;
    for (let r = 1; r < 40 && !best; r++) for (let a = -r; a <= r && !best; a++) for (let b = -r; b <= r; b++) { if (Math.max(Math.abs(a), Math.abs(b)) !== r) continue; if (areaFree(map, sx + a, sy + b)) { best = [sx + a, sy + b]; break; } }
    if (best) { sp.x = best[0] + 0.5; sp.y = best[1] + 0.5; if (RW.UI) RW.UI.toast('Торгова ятка переїхала на вільне місце', 'info'); }
  }
  const et = RW.Events && RW.Events.trader; if (et) RW.Events.trader = function () { const r = et.apply(this, arguments); try { const g = G(); g.tick = g.tick - (g.tick % 90) + 11; relocate(g); } catch (e) { } return r; };
  RW.Polish = { relocate, areaFree };
})();
