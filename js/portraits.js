'use strict';
// ============================================================
//  portraits.js — намальовані програмно портрети оповідачів
// ============================================================
(function () {
  const U = RW.U;
  const PT = RW.Portraits = {};

  function rg(x, cx, cy, r0, r1, stops) { const g = x.createRadialGradient(cx, cy, r0, cx, cy, r1); stops.forEach(s => g.addColorStop(s[0], s[1])); return g; }
  function lg(x, x0, y0, x1, y1, stops) { const g = x.createLinearGradient(x0, y0, x1, y1); stops.forEach(s => g.addColorStop(s[0], s[1])); return g; }
  function ell(x, cx, cy, rx, ry, fill, rot) { x.fillStyle = fill; x.beginPath(); x.ellipse(cx, cy, rx, ry, rot || 0, 0, 6.2832); x.fill(); }
  function frame(x, W, H, col) { x.strokeStyle = col; x.lineWidth = 3; x.strokeRect(1.5, 1.5, W - 3, H - 3); x.strokeStyle = 'rgba(255,255,255,0.15)'; x.lineWidth = 1; x.strokeRect(5.5, 5.5, W - 11, H - 11); }
  function head(x, cx, cy, rw, rh, skin, shade) {
    // шия
    x.fillStyle = lg(x, cx - 14, 0, cx + 14, 0, [[0, shade], [0.5, skin], [1, shade]]); x.fillRect(cx - 14, cy + rh - 8, 28, 36);
    // вуха
    ell(x, cx - rw + 1, cy + 4, 6, 9, skin); ell(x, cx + rw - 1, cy + 4, 6, 9, skin); ell(x, cx - rw + 2, cy + 4, 3, 5, shade); ell(x, cx + rw - 2, cy + 4, 3, 5, shade);
    // голова
    x.fillStyle = rg(x, cx - 8, cy - 12, 4, rh * 1.25, [[0, U.shade(skin, 0.18)], [0.55, skin], [1, shade]]); x.beginPath(); x.ellipse(cx, cy, rw, rh, 0, 0, 6.2832); x.fill();
    // скули й підборіддя
    x.fillStyle = 'rgba(0,0,0,0.08)'; x.beginPath(); x.ellipse(cx, cy + rh * 0.78, rw * 0.5, rh * 0.22, 0, 0, 6.2832); x.fill();
  }
  function eye(x, ex, ey, w, iris, lid) {
    x.fillStyle = '#f2efe8'; x.beginPath(); x.ellipse(ex, ey, w, w * 0.5, 0, 0, 6.2832); x.fill();
    x.fillStyle = iris; x.beginPath(); x.arc(ex, ey, w * 0.46, 0, 6.2832); x.fill();
    x.fillStyle = '#0a0a0c'; x.beginPath(); x.arc(ex, ey, w * 0.22, 0, 6.2832); x.fill();
    x.fillStyle = 'rgba(255,255,255,0.9)'; x.fillRect(ex - w * 0.22, ey - w * 0.26, w * 0.18, w * 0.18);
    x.strokeStyle = 'rgba(20,12,8,0.85)'; x.lineWidth = 1.6; x.beginPath(); x.ellipse(ex, ey, w, w * 0.5, 0, Math.PI * 1.05, Math.PI * 1.95); x.stroke();
    x.fillStyle = lid || 'rgba(0,0,0,0.1)'; x.beginPath(); x.ellipse(ex, ey - w * 0.2, w * 1.05, w * 0.3, 0, Math.PI, 0); x.fill();
  }
  function brow(x, bx, by, w, tilt, col, th) { x.strokeStyle = col; x.lineWidth = th || 3; x.lineCap = 'round'; x.beginPath(); x.moveTo(bx - w, by + tilt); x.quadraticCurveTo(bx, by - 2, bx + w, by - tilt); x.stroke(); x.lineCap = 'butt'; }
  function nose(x, cx, cy, h, skin) { x.strokeStyle = U.shade(skin, -0.35); x.globalAlpha = 0.6; x.lineWidth = 1.6; x.beginPath(); x.moveTo(cx - 1, cy - h); x.quadraticCurveTo(cx - 5, cy + h * 0.2, cx - 5, cy + h); x.quadraticCurveTo(cx, cy + h + 3, cx + 5, cy + h); x.stroke(); x.globalAlpha = 1; x.fillStyle = 'rgba(255,255,255,0.12)'; x.beginPath(); x.ellipse(cx - 1, cy, 1.8, h * 0.8, 0, 0, 6.2832); x.fill(); }
  function sparkle(x, px, py, r, col) { x.fillStyle = col; x.beginPath(); x.moveTo(px, py - r); x.quadraticCurveTo(px, py, px + r, py); x.quadraticCurveTo(px, py, px, py + r); x.quadraticCurveTo(px, py, px - r, py); x.quadraticCurveTo(px, py, px, py - r); x.fill(); }

  // ---------------- Орест Залізний Ритм ----------------
  function orest(x, W, H) {
    const cx = W / 2;
    x.fillStyle = lg(x, 0, 0, 0, H, [[0, '#06101f'], [0.6, '#14284a'], [1, '#233e66']]); x.fillRect(0, 0, W, H);
    const r = U.rng(11); for (let i = 0; i < 70; i++) { x.fillStyle = 'rgba(255,240,200,' + (0.2 + r() * 0.6) + ')'; x.fillRect(r() * W, r() * H * 0.7, 1.4, 1.4); }
    x.strokeStyle = 'rgba(224,182,74,0.35)'; x.lineWidth = 2; for (let k = 0; k < 3; k++) { x.beginPath(); x.arc(cx, 96, 70 + k * 12, Math.PI * 0.95, Math.PI * 2.05); x.stroke(); }
    x.fillStyle = rg(x, cx, 96, 10, 90, [[0, 'rgba(255,210,120,0.35)'], [1, 'rgba(255,210,120,0)']]); x.fillRect(0, 0, W, H);
    // мундир
    x.fillStyle = lg(x, 0, 150, 0, H, [[0, '#2a4270'], [1, '#101c36']]); x.beginPath(); x.moveTo(8, H); x.quadraticCurveTo(14, 160, 56, 146); x.lineTo(104, 146); x.quadraticCurveTo(146, 160, W - 8, H); x.closePath(); x.fill();
    x.fillStyle = '#e6e2d6'; x.beginPath(); x.moveTo(cx - 22, 138); x.lineTo(cx, 176); x.lineTo(cx + 22, 138); x.closePath(); x.fill();
    x.fillStyle = '#1a2c52'; x.beginPath(); x.moveTo(cx - 24, 138); x.lineTo(cx - 6, 190); x.lineTo(cx - 36, 200); x.lineTo(cx - 56, 150); x.closePath(); x.fill(); x.beginPath(); x.moveTo(cx + 24, 138); x.lineTo(cx + 6, 190); x.lineTo(cx + 36, 200); x.lineTo(cx + 56, 150); x.closePath(); x.fill();
    x.strokeStyle = '#d6b24a'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(cx - 24, 138); x.lineTo(cx - 6, 190); x.moveTo(cx + 24, 138); x.lineTo(cx + 6, 190); x.stroke();
    for (const s of [-1, 1]) { x.fillStyle = lg(x, 0, 140, 0, 158, [[0, '#f0d070'], [1, '#a07a20']]); x.fillRect(cx + s * 62 - 14, 142, 28, 12); for (let k = 0; k < 6; k++) { x.fillStyle = '#d6b24a'; x.fillRect(cx + s * 62 - 13 + k * 4.5, 154, 2, 7); } x.fillStyle = '#6a4a10'; x.fillRect(cx + s * 62 - 10, 145, 20, 1.5); }
    for (let k = 0; k < 4; k++) { ell(x, cx, 182 + k * 8, 2.6, 2.6, '#e8c458'); ell(x, cx - 0.7, 181.3 + k * 8, 0.9, 0.9, '#fff6c0'); }
    head(x, cx, 92, 33, 41, '#c58f68', '#8e5f40');
    // волосся збоку
    x.fillStyle = '#d8d8dc'; x.beginPath(); x.ellipse(cx - 31, 84, 7, 17, 0.1, 0, 6.28); x.fill(); x.beginPath(); x.ellipse(cx + 31, 84, 7, 17, -0.1, 0, 6.28); x.fill();
    // борода
    x.fillStyle = lg(x, 0, 90, 0, 150, [[0, '#f2f2f4'], [1, '#b8bac0']]); x.beginPath(); x.moveTo(cx - 33, 92); x.quadraticCurveTo(cx - 34, 130, cx - 12, 142); x.quadraticCurveTo(cx, 152, cx + 12, 142); x.quadraticCurveTo(cx + 34, 130, cx + 33, 92); x.quadraticCurveTo(cx + 22, 104, cx + 10, 108); x.quadraticCurveTo(cx, 103, cx - 10, 108); x.quadraticCurveTo(cx - 22, 104, cx - 33, 92); x.closePath(); x.fill();
    x.strokeStyle = 'rgba(120,124,132,0.5)'; x.lineWidth = 1; for (let k = 0; k < 14; k++) { const sx = cx - 26 + k * 4; x.beginPath(); x.moveTo(sx, 110 + (k % 3) * 2); x.quadraticCurveTo(sx + (k - 7) * 0.8, 128, sx + (k - 7) * 1.4, 140 - Math.abs(k - 7) * 1.2); x.stroke(); }
    // вуса й рот
    x.fillStyle = '#eeeef0'; x.beginPath(); x.moveTo(cx, 106); x.quadraticCurveTo(cx - 16, 100, cx - 24, 112); x.quadraticCurveTo(cx - 12, 112, cx, 110); x.quadraticCurveTo(cx + 12, 112, cx + 24, 112); x.quadraticCurveTo(cx + 16, 100, cx, 106); x.fill();
    x.strokeStyle = '#6a3a30'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(cx - 6, 114); x.quadraticCurveTo(cx, 116, cx + 6, 114); x.stroke();
    nose(x, cx, 92, 10, '#c58f68');
    eye(x, cx - 14, 80, 6.5, '#5a7a9a', 'rgba(0,0,0,0.14)'); eye(x, cx + 14, 80, 6.5, '#5a7a9a', 'rgba(0,0,0,0.14)');
    brow(x, cx - 14, 70, 9, 2, '#e6e6ea', 3.6); brow(x, cx + 14, 70, 9, 2, '#e6e6ea', 3.6);
    // шрам
    x.strokeStyle = 'rgba(190,70,70,0.85)'; x.lineWidth = 1.8; x.beginPath(); x.moveTo(cx - 21, 66); x.lineTo(cx - 9, 94); x.stroke(); x.strokeStyle = 'rgba(255,210,200,0.5)'; x.lineWidth = 0.8; for (let k = 0; k < 4; k++) { x.beginPath(); x.moveTo(cx - 20 + k * 3.2 - 2, 71 + k * 6); x.lineTo(cx - 17 + k * 3.2 + 2, 70 + k * 6); x.stroke(); }
    // зморшки
    x.strokeStyle = 'rgba(70,40,24,0.35)'; x.lineWidth = 1; for (let k = 0; k < 3; k++) { x.beginPath(); x.moveTo(cx - 24, 54 + k * 3); x.quadraticCurveTo(cx, 50 + k * 3, cx + 24, 54 + k * 3); x.stroke(); }
    // кашкет капітана
    x.fillStyle = lg(x, 0, 36, 0, 64, [[0, '#2a4676'], [1, '#13213f']]); x.beginPath(); x.moveTo(cx - 40, 62); x.quadraticCurveTo(cx - 44, 30, cx - 22, 24); x.quadraticCurveTo(cx, 18, cx + 22, 24); x.quadraticCurveTo(cx + 44, 30, cx + 40, 62); x.quadraticCurveTo(cx, 70, cx - 40, 62); x.fill();
    x.fillStyle = '#f2f0ea'; x.beginPath(); x.moveTo(cx - 40, 62); x.quadraticCurveTo(cx, 71, cx + 40, 62); x.lineTo(cx + 39, 55); x.quadraticCurveTo(cx, 63, cx - 39, 55); x.closePath(); x.fill();
    x.fillStyle = 'rgba(0,0,0,0.35)'; x.beginPath(); x.ellipse(cx, 66, 34, 5, 0, 0, 3.15); x.fill();
    x.strokeStyle = '#d6b24a'; x.lineWidth = 2; x.beginPath(); x.moveTo(cx - 38, 58); x.quadraticCurveTo(cx, 67, cx + 38, 58); x.stroke();
    x.fillStyle = '#e8c458'; x.beginPath(); x.arc(cx, 44, 8, 0, 6.28); x.fill(); x.strokeStyle = '#7a5a14'; x.lineWidth = 1.2; x.stroke(); x.beginPath(); x.moveTo(cx, 38); x.lineTo(cx, 51); x.moveTo(cx - 4, 43); x.lineTo(cx + 4, 43); x.moveTo(cx - 5, 49); x.quadraticCurveTo(cx, 52, cx + 5, 49); x.stroke();
    frame(x, W, H, '#d6b24a');
  }
  // ---------------- Лілея Тихі Ріки ----------------
  function lilea(x, W, H) {
    const cx = W / 2;
    x.fillStyle = lg(x, 0, 0, W, H, [[0, '#0b2a28'], [0.55, '#1a4a3a'], [1, '#2d6a48']]); x.fillRect(0, 0, W, H);
    for (let k = 0; k < 6; k++) { x.fillStyle = rg(x, 20 + k * 26, 30 + (k * 37) % 120, 1, 22, [[0, 'rgba(200,255,170,0.55)'], [1, 'rgba(200,255,170,0)']]); x.fillRect(0, 0, W, H); }
    // лози
    x.strokeStyle = 'rgba(80,160,80,0.7)'; x.lineWidth = 2; x.beginPath(); x.moveTo(6, H); x.bezierCurveTo(-4, 120, 22, 90, 8, 30); x.stroke(); x.beginPath(); x.moveTo(W - 6, H); x.bezierCurveTo(W + 4, 120, W - 22, 80, W - 8, 24); x.stroke();
    for (let k = 0; k < 9; k++) { const yy = 40 + k * 18; x.fillStyle = k % 2 ? '#4aa048' : '#68c060'; x.beginPath(); x.ellipse(k % 2 ? 14 : 10, yy, 7, 3, k, 0, 6.28); x.fill(); x.beginPath(); x.ellipse(W - (k % 2 ? 14 : 10), yy + 6, 7, 3, -k, 0, 6.28); x.fill(); }
    // довге волосся ззаду
    x.fillStyle = lg(x, 0, 60, 0, H, [[0, '#a2482a'], [1, '#5a1e12']]); x.beginPath(); x.moveTo(cx - 46, 70); x.quadraticCurveTo(cx - 62, 150, cx - 52, H); x.lineTo(cx + 52, H); x.quadraticCurveTo(cx + 62, 150, cx + 46, 70); x.quadraticCurveTo(cx, 20, cx - 46, 70); x.fill();
    // плащ
    x.fillStyle = lg(x, 0, 150, 0, H, [[0, '#2e6a3a'], [1, '#143a22']]); x.beginPath(); x.moveTo(10, H); x.quadraticCurveTo(18, 162, 58, 148); x.lineTo(102, 148); x.quadraticCurveTo(142, 162, W - 10, H); x.closePath(); x.fill();
    x.fillStyle = '#e8dcc0'; x.beginPath(); x.moveTo(cx - 20, 140); x.quadraticCurveTo(cx, 170, cx + 20, 140); x.lineTo(cx + 14, 188); x.lineTo(cx - 14, 188); x.closePath(); x.fill();
    x.strokeStyle = 'rgba(0,0,0,0.2)'; x.lineWidth = 1; for (let k = 0; k < 5; k++) { x.beginPath(); x.moveTo(cx - 12 + k * 6, 150); x.lineTo(cx - 10 + k * 5, 188); x.stroke(); }
    // брошка-листок
    x.fillStyle = '#e8c458'; x.beginPath(); x.moveTo(cx + 34, 164); x.quadraticCurveTo(cx + 48, 158, cx + 52, 172); x.quadraticCurveTo(cx + 38, 178, cx + 34, 164); x.fill(); x.strokeStyle = '#7a5a14'; x.lineWidth = 1; x.beginPath(); x.moveTo(cx + 35, 165); x.lineTo(cx + 50, 172); x.stroke(); ell(x, cx + 42, 168, 2.2, 2.2, '#58d890');
    head(x, cx, 94, 30, 38, '#e3bb98', '#b78a68');
    // чубчик/волосся
    x.fillStyle = lg(x, 0, 52, 0, 90, [[0, '#b45230'], [1, '#7a2e18']]); x.beginPath(); x.moveTo(cx - 32, 96); x.quadraticCurveTo(cx - 36, 48, cx, 48); x.quadraticCurveTo(cx + 36, 48, cx + 32, 96); x.quadraticCurveTo(cx + 26, 70, cx + 4, 62); x.quadraticCurveTo(cx - 14, 72, cx - 32, 96); x.fill();
    x.strokeStyle = 'rgba(255,200,150,0.35)'; x.lineWidth = 1; for (let k = 0; k < 7; k++) { x.beginPath(); x.moveTo(cx - 24 + k * 8, 52); x.quadraticCurveTo(cx - 28 + k * 8, 70, cx - 31 + k * 9, 92); x.stroke(); }
    // коси
    for (const s of [-1, 1]) { for (let k = 0; k < 6; k++) { ell(x, cx + s * (38 + k * 1.2), 108 + k * 11, 5.5, 6.5, k % 2 ? '#a24a2a' : '#8e3c20'); } x.fillStyle = '#58b868'; ell(x, cx + s * 40, 172, 3, 3, '#e8c458'); }
    // вінок із квітів
    for (let k = 0; k < 11; k++) { const a = Math.PI * (1.08 + k * 0.084), px = cx + Math.cos(a) * 34, py = 80 + Math.sin(a) * 36; x.fillStyle = '#3f9a44'; ell(x, px, py + 2, 5, 2.5, '#3f9a44', a); const fc = ['#f4a8c4', '#fff2d8', '#f8d860', '#c8a8f0'][k % 4]; for (let q = 0; q < 5; q++) ell(x, px + Math.cos(q * 1.256) * 2.6, py - 2 + Math.sin(q * 1.256) * 2.6, 2.2, 2.2, fc); ell(x, px, py - 2, 1.4, 1.4, '#f2a020'); }
    // обличчя
    eye(x, cx - 12, 92, 6, '#3a8a5a', 'rgba(60,20,10,0.14)'); eye(x, cx + 12, 92, 6, '#3a8a5a', 'rgba(60,20,10,0.14)');
    brow(x, cx - 12, 83, 8, 1.2, '#7a3a20', 2); brow(x, cx + 12, 83, 8, 1.2, '#7a3a20', 2);
    nose(x, cx, 100, 8, '#e3bb98');
    for (const [fx, fy] of [[-14, 104], [-9, 106], [-18, 106], [10, 106], [15, 104], [19, 106]]) ell(x, cx + fx, fy, 1, 1, 'rgba(150,80,40,0.55)');
    x.fillStyle = 'rgba(240,120,120,0.22)'; ell(x, cx - 16, 108, 7, 4, 'rgba(240,120,120,0.22)'); ell(x, cx + 16, 108, 7, 4, 'rgba(240,120,120,0.22)');
    x.fillStyle = '#c2605a'; x.beginPath(); x.moveTo(cx - 8, 119); x.quadraticCurveTo(cx, 126, cx + 8, 119); x.quadraticCurveTo(cx, 121, cx - 8, 119); x.fill(); x.strokeStyle = '#8a3a36'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(cx - 8, 119); x.quadraticCurveTo(cx, 122.5, cx + 8, 119); x.stroke();
    // світлячок-метелик
    x.fillStyle = 'rgba(170,255,200,0.95)'; x.beginPath(); x.ellipse(cx + 56, 60, 6, 3.4, 0.5, 0, 6.28); x.fill(); x.beginPath(); x.ellipse(cx + 51, 56, 5, 3, -0.6, 0, 6.28); x.fill(); x.fillStyle = rg(x, cx + 54, 59, 1, 18, [[0, 'rgba(180,255,200,0.5)'], [1, 'rgba(180,255,200,0)']]); x.fillRect(cx + 30, 36, 50, 50);
    frame(x, W, H, '#7ac47a');
  }
  // ---------------- Вихор Безумний Мандрівник ----------------
  function vykhor(x, W, H) {
    const cx = W / 2;
    x.fillStyle = rg(x, cx, 90, 6, 190, [[0, '#7a1a58'], [0.5, '#3a1048'], [1, '#12061e']]); x.fillRect(0, 0, W, H);
    const r = U.rng(23); for (let k = 0; k < 5; k++) { x.strokeStyle = ['rgba(255,120,60,0.45)', 'rgba(80,220,230,0.4)', 'rgba(255,60,160,0.4)'][k % 3]; x.lineWidth = 2; x.beginPath(); x.arc(cx, 96, 52 + k * 16, r() * 6, r() * 6 + 2.4); x.stroke(); }
    for (let k = 0; k < 40; k++) sparkle(x, r() * W, r() * H * 0.8, 1.5 + r() * 3, ['#ffd070', '#70f0ff', '#ff70c0', '#ffffff'][k % 4]);
    // комір блазня
    const cols = ['#6a2a9a', '#e8b82a', '#1ea8b0', '#c42a6a']; for (let k = 0; k < 7; k++) { const a0 = Math.PI * (0.02 + k * 0.136); x.fillStyle = cols[k % 4]; x.beginPath(); x.moveTo(cx, 146); x.lineTo(cx + Math.cos(a0) * 80, 146 + Math.sin(a0) * 62); x.lineTo(cx + Math.cos(a0 + 0.136 * Math.PI) * 80, 146 + Math.sin(a0 + 0.136 * Math.PI) * 62); x.closePath(); x.fill(); x.fillStyle = '#ffe070'; ell(x, cx + Math.cos(a0 + 0.07 * Math.PI) * 84, 146 + Math.sin(a0 + 0.07 * Math.PI) * 66, 4, 4, '#ffe070'); }
    x.fillStyle = lg(x, 0, 150, 0, H, [[0, '#2a1048'], [1, '#12061e']]); x.beginPath(); x.moveTo(cx - 40, 150); x.quadraticCurveTo(cx, 168, cx + 40, 150); x.lineTo(cx + 34, H); x.lineTo(cx - 34, H); x.closePath(); x.fill();
    head(x, cx, 96, 31, 40, '#eadbcc', '#b8a090');
    // божевільне волосся
    const hc = ['#18c8c8', '#e0309a', '#7a40e0', '#18c8c8', '#f0a020']; x.save(); for (let k = 0; k < 14; k++) { const a = Math.PI * (1.0 + k * 0.077); const bx = cx + Math.cos(a) * 30, by = 82 + Math.sin(a) * 34; const len = 22 + (k % 3) * 10; const tx = cx + Math.cos(a) * (30 + len), ty = 82 + Math.sin(a) * (34 + len) - 6; x.fillStyle = hc[k % hc.length]; x.beginPath(); x.moveTo(bx - 6, by + 2); x.quadraticCurveTo((bx + tx) / 2 - 4, (by + ty) / 2, tx + (k % 2 ? 4 : -4), ty); x.quadraticCurveTo((bx + tx) / 2 + 6, (by + ty) / 2 + 4, bx + 6, by + 2); x.closePath(); x.fill(); } x.restore();
    x.fillStyle = '#e0309a'; x.beginPath(); x.moveTo(cx - 32, 90); x.quadraticCurveTo(cx - 24, 54, cx + 6, 58); x.quadraticCurveTo(cx + 30, 56, cx + 32, 90); x.quadraticCurveTo(cx + 10, 72, cx - 4, 76); x.quadraticCurveTo(cx - 18, 76, cx - 32, 90); x.fill(); x.fillStyle = '#18c8c8'; x.beginPath(); x.moveTo(cx - 32, 90); x.quadraticCurveTo(cx - 30, 62, cx - 8, 60); x.quadraticCurveTo(cx - 22, 72, cx - 32, 90); x.fill();
    // права сторона: червоне око
    eye(x, cx + 13, 90, 7, '#e02818', 'rgba(0,0,0,0.12)'); x.fillStyle = '#0a0004'; x.beginPath(); x.ellipse(cx + 13, 90, 1.4, 4, 0, 0, 6.28); x.fill(); x.fillStyle = rg(x, cx + 13, 90, 1, 16, [[0, 'rgba(255,60,40,0.45)'], [1, 'rgba(255,60,40,0)']]); x.fillRect(cx - 6, 70, 40, 40);
    brow(x, cx + 14, 78, 9, -3, '#4a1068', 3);
    nose(x, cx, 102, 8, '#eadbcc');
    // напівмаска (ліва)
    x.fillStyle = lg(x, cx - 34, 0, cx, 0, [[0, '#f4f2ee'], [1, '#d8d4cc']]); x.beginPath(); x.moveTo(cx - 31, 76); x.quadraticCurveTo(cx - 10, 68, cx + 1, 80); x.lineTo(cx + 1, 118); x.quadraticCurveTo(cx - 18, 124, cx - 29, 104); x.quadraticCurveTo(cx - 34, 90, cx - 31, 76); x.fill();
    x.strokeStyle = '#d6b24a'; x.lineWidth = 2; x.stroke();
    x.fillStyle = '#16101c'; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) { const px = cx - 25 + a * 9 + (b % 2) * 4, py = 100 + b * 7 - 2; x.beginPath(); x.moveTo(px, py - 3.5); x.lineTo(px + 3.5, py); x.lineTo(px, py + 3.5); x.lineTo(px - 3.5, py); x.closePath(); x.fill(); }
    x.fillStyle = '#16101c'; x.beginPath(); x.ellipse(cx - 14, 90, 8, 5.5, -0.2, 0, 6.28); x.fill(); x.fillStyle = '#ffe070'; x.beginPath(); x.arc(cx - 14, 90, 2.2, 0, 6.28); x.fill(); x.fillStyle = '#fff'; x.fillRect(cx - 15, 88.5, 1, 1);
    x.strokeStyle = '#16101c'; x.lineWidth = 3.4; x.lineCap = 'round'; x.beginPath(); x.moveTo(cx - 24, 76); x.quadraticCurveTo(cx - 14, 72, cx - 5, 78); x.stroke(); x.lineCap = 'butt';
    // широка божевільна посмішка
    x.fillStyle = '#4a0a1a'; x.beginPath(); x.moveTo(cx - 24, 118); x.quadraticCurveTo(cx, 146, cx + 24, 114); x.quadraticCurveTo(cx, 126, cx - 24, 118); x.fill();
    x.fillStyle = '#fafafa'; for (let k = 0; k < 9; k++) { const t = k / 8; const px = cx - 22 + t * 44, py = 120 + Math.sin(t * Math.PI) * 9 - t * 3; x.beginPath(); x.moveTo(px - 2.2, py); x.lineTo(px + 2.2, py); x.lineTo(px, py + 4.5); x.closePath(); x.fill(); }
    x.strokeStyle = '#2a0610'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(cx - 24, 118); x.quadraticCurveTo(cx, 146, cx + 24, 114); x.stroke(); x.beginPath(); x.moveTo(cx - 24, 118); x.lineTo(cx - 28, 113); x.moveTo(cx + 24, 114); x.lineTo(cx + 29, 108); x.stroke();
    // карти на плечі
    for (const [px, py, rot] of [[24, 168, -0.3], [W - 26, 172, 0.35]]) { x.save(); x.translate(px, py); x.rotate(rot); x.fillStyle = '#f6f2e8'; x.fillRect(-9, -13, 18, 26); x.strokeStyle = '#2a2030'; x.strokeRect(-9, -13, 18, 26); x.fillStyle = '#d02848'; x.font = 'bold 16px serif'; x.textAlign = 'center'; x.fillText(rot < 0 ? '♥' : '♠', 0, 5); x.restore(); }
    frame(x, W, H, '#e0309a');
  }
  PT.draw = function (cv, id) { const x = cv.getContext('2d'); x.clearRect(0, 0, cv.width, cv.height); if (id === 'orest') orest(x, cv.width, cv.height); else if (id === 'lilea') lilea(x, cv.width, cv.height); else vykhor(x, cv.width, cv.height); };
})();
