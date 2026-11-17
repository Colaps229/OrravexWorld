// ============================================================
//  animals_gfx.js — детальні спрайти тварин (вид збоку та зверху), анімація ходьби/дихання/хвоста
// ============================================================
(function () {
  'use strict';
  const RW = window.RW; const U = RW.U, D = RW.D, GFX = RW.GFX; const TAU = Math.PI * 2; const sh = U.shade;
  const OUT = 'rgba(32,22,14,.62)';
  function smooth(c, pts) { const n = pts.length; const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; c.beginPath(); const m0 = mid(pts[n - 1], pts[0]); c.moveTo(m0[0], m0[1]); for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n], m = mid(p, q); c.quadraticCurveTo(p[0], p[1], m[0], m[1]); } c.closePath(); }
  function poly(c, pts, fill, stroke, lw) { smooth(c, pts); c.fillStyle = fill; c.fill(); if (stroke !== false) { c.strokeStyle = stroke || OUT; c.lineWidth = lw || 0.8; c.stroke(); } }
  function ell(c, x, y, rx, ry, fill, stroke, rot) { c.beginPath(); c.ellipse(x, y, rx, ry, rot || 0, 0, TAU); c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke === true ? OUT : stroke; c.lineWidth = 0.8; c.stroke(); } }
  function lg(c, y0, y1, a, b) { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; }
  function lgx(c, x0, x1, a, b, m) { const g = c.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, a); g.addColorStop(0.5, m || a); g.addColorStop(1, b); return g; }
  function line(c, pts, col, w) { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.stroke(); }
  function leg(c, x, y, len, sw, w, col, hoof) { const kx = x + sw * 0.3 - 0.4, ky = y + len * 0.5, fx = x + sw, fy = y + len - Math.abs(sw) * 0.18; c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = OUT; c.lineWidth = w + 1; c.beginPath(); c.moveTo(x, y); c.lineTo(kx, ky); c.lineTo(fx, fy); c.stroke(); c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x, y); c.lineTo(kx, ky); c.lineWidth = w * 0.8; c.lineTo(fx, fy); c.stroke(); if (hoof) { c.fillStyle = hoof; c.beginPath(); c.ellipse(fx + 0.5, fy + 0.5, w * 0.62, w * 0.45, 0, 0, TAU); c.fill(); } }
  function eye(c, x, y, r, col) { c.fillStyle = col || '#16100c'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.arc(x - r * 0.3, y - r * 0.35, r * 0.38, 0, TAU); c.fill(); }
  const fur = (c, x, y, n, len, col, ang) => { c.strokeStyle = col; c.lineWidth = 0.6; c.beginPath(); for (let i = 0; i < n; i++) { const fx = x + ((i * 7) % 13) - 6, fy = y + ((i * 5) % 7) - 3; c.moveTo(fx, fy); c.lineTo(fx + Math.cos(ang) * len, fy + Math.sin(ang) * len); } c.stroke(); };

  // ======================= ВИД ЗБОКУ (дивиться вправо) =======================
  const SIDE = {};
  SIDE.deer = (c, o) => {
    const { col, dk, lt, g1, g2, t } = o; const wag = Math.sin(t * 0.07) * 0.6;
    leg(c, 5.5, 1, 10, -g1, 1.5, sh(col, -0.3), '#2a1e14'); leg(c, -6.5, 1, 10, -g2, 1.5, sh(col, -0.3), '#2a1e14');
    poly(c, [[-11, -2.5], [-9, -6], [-3, -7], [4, -6.5], [8, -5], [9, -1], [6, 3], [-1, 4.2], [-8, 3.6], [-11, 1]], lg(c, -7, 4, sh(col, 0.08), sh(col, -0.1)));
    ell(c, 0, 2.4, 8, 1.7, lt); ell(c, -4, -3, 5, 2, sh(col, 0.12));
    c.fillStyle = 'rgba(255,248,230,.75)'; for (const [x, y] of [[-6, -4.4], [-2, -5.2], [2, -4.8], [5, -3.6], [-4, -1.6], [0, -2]]) { c.beginPath(); c.arc(x, y, 0.8, 0, TAU); c.fill(); }
    poly(c, [[5, -6], [8, -14], [12, -14.5], [10.5, -5]], col); fur(c, 8, -9, 6, 1.4, dk, 1.9);
    ell(c, -11.2, -2.6, 1.6, 2.6, '#f4f0e6', true, 0.3 + wag * 0.3);
    leg(c, 6.5, 1.5, 10, g1, 1.7, col, '#2a1e14'); leg(c, -5.5, 1.5, 10, g2, 1.7, col, '#2a1e14');
    // голова
    ell(c, 13, -14.6, 3.5, 2.3, col, true, 0.35); ell(c, 16, -13.4, 2, 1.4, lt, true, 0.35); ell(c, 17.4, -13.1, 0.7, 0.55, '#1a1210');
    poly(c, [[10.4, -15.4], [9.4, -19.4], [12, -17]], sh(col, -0.15)); eye(c, 14, -15.4, 0.7);
    line(c, [[11.8, -16.6], [10.6, -21.4], [8.6, -23.4]], '#6b4a2a', 1.2); line(c, [[10.6, -21.4], [12.8, -23]], '#6b4a2a', 1); line(c, [[10.9, -19], [8.4, -19.8]], '#6b4a2a', 1);
  };
  SIDE.rabbit = (c, o) => {
    const { col, dk, lt, g1, g2, t } = o; const tw = Math.sin(t * 0.09) * 0.4;
    ell(c, -6, 2.5, 3.2, 4.6, sh(col, -0.12), true, 0.3); leg(c, 5, 3, 5, g1 * 0.6, 1.4, sh(col, -0.25), null);
    poly(c, [[-9, 0], [-7, -6], [0, -8], [6, -6], [9, -2], [6, 3], [-2, 5], [-8, 4]], lg(c, -8, 5, sh(col, 0.08), sh(col, -0.12)));
    ell(c, 1, 3, 6, 1.8, lt); ell(c, -7, 1.5, 3.4, 4.2, col, true, 0.3); ell(c, -7.4, 3.6, 3.2, 1, sh(col, -0.2), false);
    leg(c, 6, 3, 5, g2 * 0.7, 1.5, col, null); ell(c, -10.5, -0.6, 2.4, 2.2, '#fbfaf4', true);
    ell(c, 8.6, -5, 3.3, 2.8, col, true); ell(c, 11.6, -4.2, 1.6, 1.3, lt, true); ell(c, 12.8, -4.6, 0.6, 0.5, '#d86a7a'); eye(c, 9.6, -5.8, 0.8);
    poly(c, [[7, -6.5], [6.4, -14], [8.6, -14.6], [9, -6.2]], col); poly(c, [[7.6, -7.4], [7.4, -13], [8.2, -13.4], [8.4, -7]], '#e8a0a0', false);
    poly(c, [[9, -6.6], [11, -13 + tw], [12.4, -12.4 + tw], [10.6, -6]], sh(col, -0.1));
  };
  SIDE.boar = (c, o) => {
    const { col, dk, lt, g1, g2, t, a } = o;
    leg(c, 5, 2, 6, -g1, 2, sh(col, -0.35), '#1c1410'); leg(c, -6, 2, 6, -g2, 2, sh(col, -0.35), '#1c1410');
    poly(c, [[-11, -1], [-9, -6], [-2, -8.5], [4, -8], [10, -5], [11, 0], [8, 4.5], [0, 5.5], [-8, 5], [-11, 2]], lg(c, -8.5, 5.5, sh(col, 0.05), sh(col, -0.22)));
    poly(c, [[-6, -6.5], [-2, -9.5], [2, -9.4], [6, -7], [2, -6.2], [-3, -6.2]], '#2b2018', false);
    for (let i = 0; i < 9; i++) { line(c, [[-7 + i * 1.9, -7], [-7.6 + i * 1.9, -10.6 - (i % 2)]], '#1c1410', 0.9); }
    ell(c, 1, 3.6, 8, 1.8, sh(col, 0.15)); fur(c, 0, -1, 14, 1.8, sh(col, -0.3), 2.4);
    line(c, [[-11, -0.5], [-14, -3], [-12.4, -5], [-13.6, -6.4]], sh(col, -0.3), 1.1);
    leg(c, 6, 2, 6, g1, 2, col, '#1c1410'); leg(c, -5, 2, 6, g2, 2, col, '#1c1410');
    poly(c, [[9, -6], [13, -6.4], [17, -3], [17.4, 0.4], [13, 2], [9, 0.4]], col); ell(c, 17, -1, 2.2, 2.4, '#caa090', true); ell(c, 17.8, -1.6, 0.5, 0.5, '#2a1a16'); ell(c, 17.8, -0.2, 0.5, 0.5, '#2a1a16');
    poly(c, [[15, 0.4], [17.6, -0.6], [18.4, -3.6], [16.6, -1.2]], '#f4efe0', false); poly(c, [[10, -6], [9, -10], [12.4, -7]], sh(col, -0.3)); eye(c, 13.4, -3.6, 0.8, '#3a1a0a');
  };
  const canine = (c, o, dog) => {
    const { col, dk, lt, g1, g2, t, a } = o; const wag = Math.sin(t * (a.moving ? 0.35 : 0.12)) * (dog ? 3 : 1.2);
    leg(c, 5.5, 1, 8, -g1, 1.9, sh(col, -0.3), '#1e1814'); leg(c, -6.5, 1, 8, -g2, 1.9, sh(col, -0.3), '#1e1814');
    line(c, [[-10, -3], [-14, dog ? -8 + wag * 0.3 : -2], [-17 + wag * 0.3, dog ? -11 : 3 + wag * 0.3]], sh(col, -0.1), dog ? 2.6 : 3.8); if (!dog) line(c, [[-15, 0], [-17, 3 + wag * 0.3]], sh(col, -0.35), 3.4);
    poly(c, [[-11, -2], [-9, -6], [-3, -6.6], [4, -6.2], [8, -4.6], [9, -0.4], [6, 3.4], [-1, 4.2], [-8, 3.8], [-11, 1.4]], lg(c, -6.6, 4.2, sh(col, 0.05), sh(col, -0.1)));
    if (!dog) poly(c, [[-9, -4.6], [-3, -6.8], [4, -6.4], [7, -4.4], [2, -3.2], [-5, -3]], sh(col, -0.35), false); ell(c, 0, 2.6, 7.5, 1.6, lt); fur(c, -3, -4, 10, 1.6, sh(col, -0.28), 2.6);
    poly(c, [[5, -5.5], [9, -8], [11, -6.5], [9, -2.5]], col);
    leg(c, 6.5, 1.5, 8, g1, 2, col, '#1e1814'); leg(c, -5.5, 1.5, 8, g2, 2, col, '#1e1814');
    ell(c, 11.6, -6.6, 3.4, 2.9, col, true, 0.15); poly(c, [[12, -6], [16.6, -5.4], [16.8, -3.6], [12.6, -3.2]], lt); ell(c, 17, -5.2, 0.9, 0.8, '#17110f'); eye(c, 12.6, -7.4, 0.75, dog ? '#2a1a0a' : '#d8a020');
    if (dog) { poly(c, [[10, -8], [8, -4.6], [10.2, -4.2], [11.6, -7]], sh(col, -0.35)); if (a.faction === 'colony') { line(c, [[8.6, -4.4], [11.2, -3.6]], '#c83a30', 1.3); ell(c, 10, -3.4, 0.8, 0.8, '#f0d060'); } }
    else { poly(c, [[10.4, -8.2], [10.8, -11.6], [13, -8.4]], sh(col, -0.2)); poly(c, [[10.4, -8], [8.6, -10.6], [11, -7.4]], sh(col, -0.3)); }
    if (a.state === 'attack' && !dog || a.hostile || a.manhunt > 0) { c.fillStyle = '#fff'; c.fillRect(15, -3.7, 0.9, 1.1); c.fillRect(13.6, -3.5, 0.9, 1); }
  };
  SIDE.wolf = (c, o) => canine(c, o, false); SIDE.dog = (c, o) => canine(c, o, true);
  SIDE.cat = (c, o) => {
    const { col, dk, lt, g1, g2, t, a } = o; const sw = Math.sin(t * 0.05) * 1.5;
    line(c, [[-9, -1], [-14, -2], [-16, -7 + sw * 0.4], [-14, -11 + sw * 0.6]], sh(col, -0.08), 2.2);
    leg(c, 4.5, 1, 6, -g1, 1.5, sh(col, -0.3), null); leg(c, -5.5, 1, 6, -g2, 1.5, sh(col, -0.3), null);
    poly(c, [[-10, -0.5], [-8, -4.6], [-2, -5.4], [4, -5], [7, -3.4], [8, 0], [5, 3], [-1, 3.6], [-7, 3], [-10, 1.5]], lg(c, -5.4, 3.6, sh(col, 0.06), sh(col, -0.1)));
    line(c, [[-6, -4.4], [-5.4, -1]], dk, 1); line(c, [[-2.6, -5], [-2, -1.2]], dk, 1); line(c, [[1, -4.8], [1.4, -1.4]], dk, 1); ell(c, 0, 2, 6.4, 1.3, lt);
    leg(c, 5.5, 1.5, 6, g1, 1.6, col, lt); leg(c, -4.5, 1.5, 6, g2, 1.6, col, lt);
    ell(c, 9.6, -4.6, 3.1, 2.7, col, true); poly(c, [[7.8, -6.4], [7.8, -9.8], [10.4, -7]], col); poly(c, [[10.6, -7], [12.4, -9.4], [12.4, -5.8]], col); poly(c, [[8.4, -7], [8.4, -8.8], [9.6, -7.4]], '#e8a0a0', false);
    ell(c, 11.8, -3.6, 1.4, 1, lt); ell(c, 12.8, -4, 0.5, 0.4, '#d86a7a'); eye(c, 10.6, -5.2, 0.85, '#4a9a30'); line(c, [[12, -3.4], [15, -3.8]], 'rgba(255,255,255,.7)', 0.4); line(c, [[12, -3.1], [15, -2.6]], 'rgba(255,255,255,.7)', 0.4);
  };
  SIDE.sheep = (c, o) => {
    const { g1, g2, t, a } = o; const shorn = (a.wool || 0) < 0.3; const wc = shorn ? '#e0c4ac' : '#f6f2e6';
    leg(c, 5, 3, 7, -g1, 1.8, '#2a2220', '#161010'); leg(c, -6, 3, 7, -g2, 1.8, '#2a2220', '#161010');
    if (shorn) { poly(c, [[-9, -1], [-6, -5], [0, -6], [6, -5], [9, -1], [6, 3.5], [0, 4.5], [-7, 3.6]], '#e2c8b0'); ell(c, 0, 2, 7, 1.6, '#f0dcc8'); }
    else { const puffs = [[-8, -1, 4.2], [-5, -4.4, 4.2], [0, -5.4, 4.6], [5, -4.6, 4.2], [8, -1, 4], [6, 2.6, 4], [0, 3.6, 4.4], [-6, 2.6, 4], [-1, -1, 5.4]]; for (const [x, y, r] of puffs) { ell(c, x, y, r, r * 0.92, wc, 'rgba(120,108,88,.55)'); } for (const [x, y, r] of puffs) { c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 0.7; c.beginPath(); c.arc(x - 0.8, y - 0.9, r * 0.55, 3.4, 4.9); c.stroke(); } }
    leg(c, 6, 3, 7, g1, 1.8, '#3a302c', '#161010'); leg(c, -5, 3, 7, g2, 1.8, '#3a302c', '#161010');
    ell(c, -9.6, 0, 2.4, 2.2, wc, 'rgba(120,108,88,.5)'); const hb = o.bob;
    poly(c, [[7, -3], [10.4, -6 + hb], [11.6, -2 + hb], [8.6, 0]], '#3a302c', false); ell(c, 12.4, -3 + hb, 3.2, 2.7, '#40342f', true, 0.25); ell(c, 14.6, -2 + hb, 1.8, 1.4, '#5a4a42'); ell(c, 15.8, -2.2 + hb, 0.5, 0.4, '#1a1010');
    ell(c, 10, -5 + hb, 2.2, 1.2, '#3a302c', true, 0.7); ell(c, 14.6, -5.6 + hb, 2.2, 1.1, '#3a302c', true, -0.4); eye(c, 13.2, -3.8 + hb, 0.75, '#e0d8b0'); ell(c, 11.6, -5.8 + hb, 2, 1.3, wc, 'rgba(120,108,88,.5)');
  };
  SIDE.cow = (c, o) => {
    const { g1, g2, t, a } = o; const wag = Math.sin(t * 0.06) * 2; const hb = o.bob;
    leg(c, 6, 2, 8, -g1, 2.3, '#cfc8bc', '#2a2018'); leg(c, -7, 2, 8, -g2, 2.3, '#cfc8bc', '#2a2018');
    line(c, [[-11, -4], [-14, -1 + wag * 0.3], [-14.4 + wag * 0.4, 5]], '#3a2a20', 1.4); ell(c, -14.4 + wag * 0.4, 6, 1.2, 2, '#2a1c14');
    poly(c, [[-12, -2], [-11, -7], [-3, -8.4], [5, -8], [11, -6.4], [12, -1], [9, 4.4], [0, 5.6], [-9, 5.2], [-12, 2.4]], lg(c, -8.4, 5.6, '#faf6ee', '#d8d0c2'));
    c.save(); smooth(c, [[-12, -2], [-11, -7], [-3, -8.4], [5, -8], [11, -6.4], [12, -1], [9, 4.4], [0, 5.6], [-9, 5.2], [-12, 2.4]]); c.clip();
    const hs = a.id; for (let k = 0; k < 4; k++) { const px = -8 + ((hs * 7 + k * 17) % 18), py = -6 + ((hs * 3 + k * 5) % 9); c.fillStyle = k % 2 ? '#2c2420' : '#4a342a'; poly(c, [[px - 3, py], [px - 1, py - 2.6], [px + 2.4, py - 2], [px + 3.4, py + 0.6], [px + 0.4, py + 3], [px - 2.4, py + 2]], c.fillStyle, false); } c.restore();
    if (a.gender === 'F') { ell(c, -4, 5.4, 2.6, 1.8, '#f0b4aa', true); ell(c, -3.8, 7, 0.6, 0.9, '#e89a90'); }
    poly(c, [[-12, -2], [-11, -7], [-3, -8.4], [5, -8], [11, -6.4], [12, -1], [9, 4.4], [0, 5.6], [-9, 5.2], [-12, 2.4]], 'rgba(0,0,0,0)', OUT, 1);
    leg(c, 7, 2, 8, g1, 2.4, '#f4efe4', '#2a2018'); leg(c, -6, 2, 8, g2, 2.4, '#f4efe4', '#2a2018');
    poly(c, [[9, -7], [13, -8.4 + hb], [15, -3.4 + hb], [11, -1]], '#f2ede2'); ell(c, 15, -4.2 + hb, 4.2, 3.4, '#f6f2ea', true, 0.2); ell(c, 18, -2.6 + hb, 2.4, 2, '#f0b8a8', true); ell(c, 18.8, -3 + hb, 0.5, 0.5, '#8a4a40'); ell(c, 18.8, -2 + hb, 0.5, 0.5, '#8a4a40');
    ell(c, 15.6, -7 + hb, 1.8, 1, '#2c2420', true, 0.6); ell(c, 12.2, -6.8 + hb, 2.2, 1.1, '#f6f2ea', true, 0.8); eye(c, 15.2, -5 + hb, 0.8);
    line(c, [[13.8, -7.6 + hb], [13.4, -10.4 + hb], [15, -11.4 + hb]], '#f0e8c8', 1.4); ell(c, 15.4, -5 + hb, 1.2, 1.2, 'rgba(44,36,32,.5)');
  };
  SIDE.chicken = (c, o) => {
    const { g1, g2, t, a } = o; const hb = o.bob; const bk = Math.abs(Math.sin(t * 0.1)) * (a.state === 'graze' ? 1 : 0);
    c.strokeStyle = '#d89a28'; c.lineWidth = 1.1; for (const [x, s] of [[-1, g1], [2, g2]]) { c.beginPath(); c.moveTo(x, 3); c.lineTo(x + s * 0.4, 8); c.moveTo(x + s * 0.4, 8); c.lineTo(x + s * 0.4 + 1.6, 8.2); c.moveTo(x + s * 0.4, 8); c.lineTo(x + s * 0.4 - 1, 8.4); c.stroke(); }
    for (const [dx, dy, cl] of [[0, 0, '#fff'], [1.4, -1.6, '#e8dcc8'], [2.4, 0.4, '#f0e4d0']]) poly(c, [[-5, -1 + dy], [-9 + dx, -6 + dy], [-11 + dx, -9 + dy], [-7, -3]], cl);
    poly(c, [[-6, 0], [-4, -4], [1, -5.4], [5, -4], [6.4, 0.4], [3, 4.2], [-2, 4.6], [-5, 3]], lg(c, -5, 5, '#fffdf6', '#e8dfcc')); poly(c, [[-4, -1], [-1, -3.4], [3, -2], [1, 1.4], [-3, 1.6]], '#e8dac2'); line(c, [[-3, -0.6], [1, -1.6]], '#cdb99a', 0.6);
    poly(c, [[4, -3], [6, -8 + hb], [8.6, -8 + hb], [7.4, -2]], '#fcf8ee', false); ell(c, 8, -9 + hb, 2.6, 2.4, '#fffcf4', true); eye(c, 8.8, -9.4 + hb, 0.7);
    poly(c, [[10, -9 + hb], [13, -8.4 + hb + bk], [10, -7.6 + hb]], '#f0b030'); ell(c, 8, -12 + hb, 1.2, 1.4, '#d8392e', true); ell(c, 7, -11.2 + hb, 0.9, 1, '#d8392e'); ell(c, 9.6, -6.6 + hb, 0.8, 1.2, '#d8392e');
  };

  // ======================= ВИД ЗВЕРХУ / СПЕРЕДУ-ЗЗАДУ =======================
  const TOP = {
    deer: { bw: 5.6, bl: 8, hr: 3.4, ear: 'leaf', anl: 1, tail: 'tuft', snout: 1 }, rabbit: { bw: 4.6, bl: 6.4, hr: 3, ear: 'long', tail: 'cotton', snout: 1 }, boar: { bw: 6.8, bl: 8.4, hr: 4, ear: 'tri', tail: 'curl', tusk: 1, snout: 1, mane: 1 },
    wolf: { bw: 5, bl: 8.6, hr: 3.4, ear: 'tri', tail: 'bushy', snout: 1, saddle: 1 }, dog: { bw: 5, bl: 8.2, hr: 3.4, ear: 'flop', tail: 'wag', snout: 1 }, cat: { bw: 3.8, bl: 6.6, hr: 3, ear: 'tri', tail: 'wag', snout: 1, stripes: 1 },
    sheep: { bw: 6.8, bl: 8, hr: 3, ear: 'flop', tail: 'short', wool: 1, snout: 1 }, cow: { bw: 7.4, bl: 9.6, hr: 4, ear: 'flop', tail: 'tuft', horn: 1, snout: 1, patch: 1 }, chicken: { bw: 4.4, bl: 5.6, hr: 2.4, ear: 'none', tail: 'fan', comb: 1, wing: 1 }
  };
  function vert(c, a, o, face) {
    const sp = TOP[a.species] || TOP.deer; const dy = face === 0 ? 1 : -1; const { col, dk, lt, t } = o; const wag = Math.sin(t * (a.moving ? 0.3 : 0.1)) * 2;
    c.save(); c.scale(1, dy);   // дзеркалимо: голова завжди вниз у локальних координатах
    const bw = sp.bw, bl = sp.bl; const bodyCol = a.species === 'cow' ? '#f6f2ea' : a.species === 'sheep' ? '#f6f2e6' : a.species === 'chicken' ? '#fffcf4' : col;
    // ноги (виступають збоку)
    const sw = a.moving ? Math.sin(a.phase * 1.8) * 2.4 : 0; c.fillStyle = a.species === 'sheep' ? '#2a2220' : sh(col, -0.35);
    if (a.species === 'chicken') { c.strokeStyle = '#d89a28'; c.lineWidth = 1.1; for (const x of [-1.6, 1.6]) { c.beginPath(); c.moveTo(x, 1 + (x > 0 ? sw : -sw) * 0.4); c.lineTo(x * 1.3, 5 + (x > 0 ? sw : -sw) * 0.6); c.stroke(); } }
    else for (const [x, y, k] of [[-1, 3.4, 1], [1, 3.4, -1], [-1, -3.8, -1], [1, -3.8, 1]]) { ell(c, x * (bw - 0.4), y + sw * k * 0.7, 1.5, 2.1, c.fillStyle); }
    // хвіст
    const ty = -bl; if (sp.tail === 'fan') { for (let i = -2; i <= 2; i++) poly(c, [[0, ty + 2], [i * 2.4, ty - 4 + Math.abs(i)], [i * 2.4 + 1.4, ty - 4.4 + Math.abs(i)]], i % 2 ? '#fff' : '#e8dcc8'); }
    else if (sp.tail === 'bushy') { poly(c, [[-1.6, ty + 1], [-2.4, ty - 4], [0 + wag * 0.3, ty - 8], [2.4, ty - 4], [1.6, ty + 1]], sh(col, -0.08)); ell(c, wag * 0.3, ty - 7, 1.6, 2, sh(col, -0.35)); }
    else if (sp.tail === 'wag') line(c, [[0, ty + 1], [wag * 0.7, ty - 3], [wag * 1.4, ty - 6]], sh(col, -0.1), 2); else if (sp.tail === 'cotton') ell(c, 0, ty + 0.6, 1.8, 1.8, '#fbfaf4', true); else if (sp.tail === 'tuft') { line(c, [[0, ty + 1], [wag * 0.3, ty - 4]], a.species === 'cow' ? '#3a2a20' : '#f4f0e6', 1.3); ell(c, wag * 0.3, ty - 4.4, 1.2, 1.6, a.species === 'cow' ? '#2a1c14' : '#fff'); }
    else if (sp.tail === 'curl') line(c, [[0, ty + 1], [1.6, ty - 2], [0.4, ty - 3.4]], sh(col, -0.3), 1.2); else ell(c, 0, ty + 0.4, 1.6, 1.4, sh(bodyCol, -0.05), true);
    // тулуб
    if (sp.wool && (a.wool || 0) >= 0.3) { for (let i = 0; i < 12; i++) { const an = i / 12 * TAU, x = Math.cos(an) * bw * 0.72, y = Math.sin(an) * bl * 0.7; ell(c, x, y, 3.6, 3.5, '#f6f2e6', 'rgba(120,108,88,.5)'); } ell(c, 0, 0, bw * 0.7, bl * 0.6, '#fffdf4'); }
    else { poly(c, [[0, -bl], [bw * 0.7, -bl * 0.7], [bw, -2], [bw * 0.86, bl * 0.5], [bw * 0.5, bl], [-bw * 0.5, bl], [-bw * 0.86, bl * 0.5], [-bw, -2], [-bw * 0.7, -bl * 0.7]], lgx(c, -bw, bw, sh(bodyCol, -0.18), sh(bodyCol, -0.18), sh(bodyCol, 0.1)));
      c.save(); smooth(c, [[0, -bl], [bw * 0.7, -bl * 0.7], [bw, -2], [bw * 0.86, bl * 0.5], [bw * 0.5, bl], [-bw * 0.5, bl], [-bw * 0.86, bl * 0.5], [-bw, -2], [-bw * 0.7, -bl * 0.7]]); c.clip();
      if (sp.patch) { for (let k = 0; k < 4; k++) { const px = ((a.id * 7 + k * 13) % 10) - 5, py = ((a.id * 3 + k * 5) % 14) - 7; ell(c, px, py, 3.2 + k % 2, 2.6, k % 2 ? '#2c2420' : '#4a342a', false, k); } }
      if (sp.saddle) poly(c, [[0, -bl * 0.8], [bw * 0.7, -bl * 0.1], [0, bl * 0.7], [-bw * 0.7, -bl * 0.1]], sh(col, -0.3), false); if (sp.stripes) for (let k = -2; k <= 2; k++) line(c, [[-bw, k * 2.4], [bw, k * 2.4 + 0.6]], sh(col, -0.3), 0.9); if (sp.mane) for (let k = -bl * 0.7; k < bl * 0.3; k += 1.6) line(c, [[0, k], [0.6, k + 1.4]], '#1c1410', 1.2);
      if (sp.wing) { poly(c, [[-bw * 0.9, -2], [-bw * 0.5, -bl * 0.6], [-bw * 0.2, 2], [-bw * 0.6, bl * 0.4]], '#e8dac2'); poly(c, [[bw * 0.9, -2], [bw * 0.5, -bl * 0.6], [bw * 0.2, 2], [bw * 0.6, bl * 0.4]], '#e8dac2'); }
      if (a.species === 'deer') { c.fillStyle = 'rgba(255,248,230,.75)'; for (const [x, y] of [[-2.4, -3], [2.2, -1], [-1.4, 2.4], [2.6, 3.6], [0, -6]]) { c.beginPath(); c.arc(x, y, 0.8, 0, TAU); c.fill(); } }
      line(c, [[0, -bl * 0.7], [0, bl * 0.6]], sh(bodyCol, -0.25), 0.7); c.restore(); }
    if (a.species === 'cow' && a.gender === 'F' && face === 0) ell(c, 0, bl * 0.2, 2.6, 1.8, '#f0b4aa', true);
    // голова
    const hr = sp.hr, hy = bl + hr - 1.6 + o.bob * 0.7; const hc = a.species === 'sheep' ? '#40342f' : bodyCol;
    if (sp.ear === 'long') { for (const s of [-1, 1]) poly(c, [[s * 1.4, hy - 1], [s * 1.9, hy - 8], [s * 3.4, hy - 7.6], [s * 3, hy - 1]], col), poly(c, [[s * 1.9, hy - 2], [s * 2.2, hy - 6.6], [s * 2.8, hy - 6.4], [s * 2.6, hy - 2]], '#e8a0a0', false); }
    if (sp.anl) for (const s of [-1, 1]) { line(c, [[s * 1.8, hy - 2], [s * 3.4, hy - 6], [s * 3.2, hy - 9.4]], '#6b4a2a', 1.2); line(c, [[s * 3.4, hy - 6], [s * 6, hy - 7]], '#6b4a2a', 1); line(c, [[s * 3.3, hy - 8], [s * 5.4, hy - 10]], '#6b4a2a', 1); }
    if (sp.horn) for (const s of [-1, 1]) line(c, [[s * 2.4, hy - 2.4], [s * 4.6, hy - 3.2], [s * 5.4, hy - 5.4]], '#f0e8c8', 1.5);
    ell(c, 0, hy, hr * 1.02, hr, hc, true);
    if (sp.ear === 'tri') for (const s of [-1, 1]) poly(c, [[s * 1.4, hy - 1.6], [s * 2.6, hy - 5.8], [s * 3.8, hy - 1.6]], sh(col, -0.2)); if (sp.ear === 'leaf') for (const s of [-1, 1]) poly(c, [[s * 2.4, hy - 1.6], [s * 5.4, hy - 3.6], [s * 4, hy - 0.4]], sh(col, -0.15)); if (sp.ear === 'flop') for (const s of [-1, 1]) ell(c, s * (hr + 0.6), hy - 0.6, 1.2, 2.6, sh(hc, -0.2), true, s * 0.3);
    if (face === 0) { const sn = a.species === 'cow' ? '#f0b8a8' : a.species === 'sheep' ? '#5a4a42' : a.species === 'boar' ? '#caa090' : lt; ell(c, 0, hy + hr * 0.45, hr * 0.62, hr * 0.5, sn, true); ell(c, -hr * 0.2, hy + hr * 0.5, 0.4, 0.4, '#1a1010'); ell(c, hr * 0.2, hy + hr * 0.5, 0.4, 0.4, '#1a1010'); eye(c, -hr * 0.5, hy - hr * 0.1, 0.8, a.species === 'wolf' ? '#d8a020' : undefined); eye(c, hr * 0.5, hy - hr * 0.1, 0.8, a.species === 'wolf' ? '#d8a020' : undefined);
      if (sp.tusk) { c.fillStyle = '#f4efe0'; c.fillRect(-hr * 0.7, hy + hr * 0.3, 0.9, 2.4); c.fillRect(hr * 0.7 - 0.9, hy + hr * 0.3, 0.9, 2.4); }
      if (sp.comb) { ell(c, 0, hy - hr * 0.9, 1.1, 1.3, '#d8392e', true); poly(c, [[-0.8, hy + hr * 0.5], [0.8, hy + hr * 0.5], [0, hy + hr * 1.1 + 1]], '#f0b030'); ell(c, 0, hy + hr + 1.4, 0.8, 1.1, '#d8392e'); } }
    else if (sp.comb) ell(c, 0, hy - hr * 0.3, 1.2, 1.5, '#d8392e', true);
    c.restore();
  }
  function drawSide(c, a, o) {
    const fn = SIDE[a.species] || SIDE.deer; fn(c, o);
  }
  const PAL = { deer: ['#b0793f', '#7a4e26', '#ecdcba'], rabbit: ['#a89478', '#6c5a44', '#f0e8d8'], boar: ['#5e4636', '#2e2018', '#9a8070'], wolf: ['#7d8288', '#4a4e54', '#d4d8dc'], dog: ['#b08450', '#6a4a28', '#ecd8b0'], cat: ['#c8a064', '#7a5a30', '#f0e4cc'] };
  GFX.drawAnimal = function (c, a, px, py, s) {
    const d = a.def; const g = RW.G; const t = g ? g.tick : 0; const sp = a.species;
    const grow = a.young ? 0.55 + 0.45 * Math.min(1, ((g ? g.tick : 0) - (a.born || 0)) / (4 * D.DAY)) : 1; const sz = d.size * grow;
    const face = a.face, side = face === 1 || face === 3, dir = face === 3 ? -1 : 1; const ph = a.phase || 0; const mv = a.moving;
    const pal = PAL[sp] || [d.color, sh(d.color, -0.3), sh(d.color, 0.3)]; const col = (sp === 'deer' || sp === 'rabbit' || sp === 'boar' || sp === 'wolf' || sp === 'dog' || sp === 'cat') ? (d.color || pal[0]) : pal[0];
    const base = PAL[sp] ? pal[0] : col; const grazing = a.state === 'graze' || a.state === 'eat' || a.state === 'goeat';
    const breathe = 1 + Math.sin(t * 0.06 + (a.id || 0)) * 0.012; const bob = grazing ? 1.6 + Math.sin(t * 0.14) * 1.4 : Math.sin(t * 0.05 + (a.id || 0)) * 0.3;
    const g1 = mv ? Math.sin(ph * 1.8) * 3.2 : 0, g2 = mv ? -Math.sin(ph * 1.8) * 3.2 : 0;
    const o = { col: base, dk: pal[1], lt: pal[2], g1, g2, t, a, bob };
    c.save(); c.translate(px, py); c.scale(s * sz, s * sz); if (a.dead) { c.rotate(1.5); }
    // тінь
    c.fillStyle = 'rgba(0,0,0,.24)'; c.beginPath(); c.ellipse(0, 8.4, sp === 'cow' ? 13 : sp === 'chicken' ? 6 : 10, 3.2, 0, 0, TAU); c.fill();
    const bounce = mv ? -Math.abs(Math.sin(ph * 1.8)) * 0.9 : 0; c.translate(0, bounce);
    if (side) { c.scale(dir * 1, 1); c.scale(1, breathe); drawSide(c, a, o); }
    else vert(c, a, o, face);
    c.restore();
  };
  GFX.drawAnimalIcon = function (sp, size) { const cv = document.createElement('canvas'); cv.width = cv.height = size; const x = cv.getContext('2d'); const d = D.animals[sp]; const fake = { species: sp, def: d, face: 1, phase: 0, moving: false, state: 'idle', id: 3, faction: 'wild', gender: 'F', wool: 1 }; GFX.drawAnimal(x, fake, size / 2, size * 0.58, size / 34); return cv; };
})();
