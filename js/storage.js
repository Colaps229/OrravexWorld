// ============================================================
//  storage.js — склади: статистика, мітки на карті, пріоритети
// ============================================================
(function () {
  'use strict';
  const RW = window.RW; const D = RW.D, U = RW.U; const G = () => RW.G;
  const S = RW.Storage = {};
  const ICO = { food: '🍖', arms: '⚔', med: '⚕', res: '🪵', all: '📦' };
  const PCOL = ['#8a8a8a', '#7a9ab8', '#d8a040', '#e8782a', '#e0403a'];
  S.stats = function (z) {
    const g = G(); if (z._st && g.tick - z._stT < 20 && z._st.cells === z.cells.size) return z._st; const map = g.map; let n = 0, used = 0;
    for (const c of z.cells) { const arr = map.items.get(c); if (arr && arr.length) { const it = arr[0]; n += it.n; used += Math.min(1, it.n / D.items[it.def].stack); } }
    z._st = { n, cells: z.cells.size, pct: z.cells.size ? Math.round(used / z.cells.size * 100) : 0 }; z._stT = g.tick; return z._st;
  };
  function centre(z, map) {
    if (z._cs === z.cells.size && z._ct) return z._ct; let sx = 0, sy = 0, n = 0, my = 1e9; for (const c of z.cells) { sx += c % map.w; sy += (c / map.w) | 0; n++; my = Math.min(my, (c / map.w) | 0); }
    z._cs = z.cells.size; z._ct = [sx / Math.max(1, n) + 0.5, my]; return z._ct;
  }
  const ZICO = { stock: '📦', grow: '🌾', pen: '🐑' };
  S.title = function (z) {
    if (z.type === 'grow') { const pd = D.plants[z.crop]; return '🌾 Ферма' + (pd ? ': ' + pd.name : ''); }
    if (z.type === 'pen') return '🐑 Загін для тварин';
    return (ICO[z.preset] || '📦') + ' ' + (z.name || 'Склад');
  };
  S.detail = function (z) {
    if (z.type === 'stock') { const st = S.stats(z); return z.cells.size + ' кл. · заповнено ' + st.pct + '%'; }
    if (z.type === 'grow') { let pl = 0, ripe = 0; const m = G().map; for (const c of z.cells) { const p = m.plant[c]; if (p) { pl++; if (p.growth >= 1) ripe++; } } return z.cells.size + ' кл. · рослин ' + pl + (ripe ? ' · готово ' + ripe : ''); }
    return z.cells.size + ' клітин';
  };
  // Зони за замовчуванням не малюються. Контур з'являється при наведенні, виборі або під час роботи з інструментом зон.
  S.draw = function (ctx, TS, map, x0, y0, x1, y1, ZONE_COL, t) {
    const W = map.w, g = G(); const UI = RW.UI; const m = UI && UI.mouse; const tool = UI && UI.tool; const toolZone = tool && (tool.type === 'zone' || tool.type === 'zoneErase');
    const sel = g.sel && g.sel.z; let hov = null;
    if (m && m.overCanvas && (!tool || toolZone)) { const tx = Math.floor(m.fx), ty = Math.floor(m.fy); if (map.inb(tx, ty)) hov = map.zoneAt[ty * W + tx] || null; }
    const outline = (zn, col, a, lw, dash) => {
      const cells = zn.cells; ctx.beginPath();
      for (const i of cells) { const x = i % W, y = (i / W) | 0; if (x < x0 - 1 || x > x1 + 1 || y < y0 - 1 || y > y1 + 1) continue; const X = x * TS, Y = y * TS;
        if (!cells.has(i - W)) { ctx.moveTo(X, Y); ctx.lineTo(X + TS, Y); } if (!cells.has(i + W)) { ctx.moveTo(X, Y + TS); ctx.lineTo(X + TS, Y + TS); }
        if (x === 0 || !cells.has(i - 1)) { ctx.moveTo(X, Y); ctx.lineTo(X, Y + TS); } if (x === W - 1 || !cells.has(i + 1)) { ctx.moveTo(X + TS, Y); ctx.lineTo(X + TS, Y + TS); } }
      ctx.lineCap = 'round'; ctx.setLineDash(dash || []); ctx.lineDashOffset = -(t * 0.2) % 14;
      ctx.strokeStyle = U.rgba(col, a * 0.22); ctx.lineWidth = lw * 3.4; ctx.stroke();   // м'яке сяйво
      ctx.strokeStyle = U.rgba(col, a); ctx.lineWidth = lw; ctx.stroke(); ctx.setLineDash([]);
    };
    const zm = (RW.R && RW.R.cam && RW.R.cam.zoom) || 1; const inv = Math.min(1.25, 1.15 / zm);
    const label = (zn, col) => {
      const [cx, cy] = centre(zn, map); const text = S.title(zn), det = S.detail(zn); ctx.save(); const px = cx * TS, py = cy * TS - 14; ctx.translate(px, py); ctx.scale(inv, inv);
      ctx.font = 'bold 12px "Segoe UI",sans-serif'; const w1 = ctx.measureText(text).width; ctx.font = '10px "Segoe UI",sans-serif'; const w2 = ctx.measureText(det).width; const w = Math.max(w1, w2) + 18;
      ctx.fillStyle = 'rgba(12,16,22,.86)'; ctx.strokeStyle = U.rgba(col, 0.85); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-w / 2, -22, w, 30, 8) : ctx.rect(-w / 2, -22, w, 30); ctx.fill(); ctx.stroke();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.font = 'bold 12px "Segoe UI",sans-serif'; ctx.fillText(text, 0, -12); ctx.fillStyle = '#aab4c0'; ctx.font = '10px "Segoe UI",sans-serif'; ctx.fillText(det, 0, 1); ctx.restore();
    };
    const pulse = 0.75 + 0.2 * Math.sin(t * 0.08);
    if (toolZone) for (const zn of map.zones) { if (zn === sel || zn === hov) continue; outline(zn, ZONE_COL[zn.type], 0.35, 1.2, [6, 6]); }
    for (const zn of map.zones) {
      if (zn !== sel && zn !== hov) continue; const col = zn.type === 'stock' ? PCOL[zn.priority == null ? 2 : zn.priority] : ZONE_COL[zn.type];
      outline(zn, col, zn === sel ? 0.95 : pulse * 0.8, zn === sel ? 2 : 1.6, zn === sel ? null : [8, 5]); if (zn === hov || zn === sel) label(zn, col);
    }
  };
})();
