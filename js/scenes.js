// Ілюстрації сценаріїв для екрану вибору
(function () {
  'use strict';
  const RW = window.RW; const U = RW.U; const SC = RW.Scenes = {}; const TAU = Math.PI * 2;
  function sky(x, W, H, stops) { const g = x.createLinearGradient(0, 0, 0, H); stops.forEach(s => g.addColorStop(s[0], s[1])); x.fillStyle = g; x.fillRect(0, 0, W, H); }
  function stars(x, W, H, n, seed) { const r = U.rng(seed); for (let i = 0; i < n; i++) { x.fillStyle = 'rgba(255,255,255,' + (0.3 + r() * 0.7).toFixed(2) + ')'; const s = r() < 0.12 ? 2 : 1; x.fillRect(r() * W, r() * H * 0.6, s, s); } }
  function ridge(x, W, y0, amp, col, seed, rough) { const r = U.rng(seed); x.fillStyle = col; x.beginPath(); x.moveTo(0, y0 + 200); let y = y0; for (let px = 0; px <= W; px += 8) { y += (r() - 0.5) * (rough || 10); y = Math.max(y0 - amp, Math.min(y0 + amp, y)); x.lineTo(px, y); } x.lineTo(W, y0 + 200); x.closePath(); x.fill(); }
  function pine(x, px, py, h, col, snow) { x.fillStyle = col; for (let t = 0; t < 4; t++) { const w = h * (0.34 - t * 0.065), y = py - h * 0.22 - t * h * 0.2; x.beginPath(); x.moveTo(px, y - h * 0.3); x.lineTo(px + w, y + h * 0.1); x.lineTo(px - w, y + h * 0.1); x.closePath(); x.fill(); } x.fillRect(px - 1, py - h * 0.2, 2, h * 0.2); }
  function glow(x, px, py, r, col) { const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); }
  function person(x, px, py, s, body, skin, hair) { x.fillStyle = 'rgba(0,0,0,0.3)'; x.beginPath(); x.ellipse(px, py + 1, 5 * s, 1.8 * s, 0, 0, TAU); x.fill(); x.fillStyle = body; x.fillRect(px - 3 * s, py - 10 * s, 6 * s, 9 * s); x.fillRect(px - 3 * s, py - 2 * s, 2.4 * s, 3 * s); x.fillRect(px + 0.6 * s, py - 2 * s, 2.4 * s, 3 * s); x.fillStyle = skin; x.beginPath(); x.arc(px, py - 13 * s, 3.4 * s, 0, TAU); x.fill(); x.fillStyle = hair; x.beginPath(); x.arc(px, py - 14 * s, 3.5 * s, Math.PI, 0); x.fill(); }
  function vignette(x, W, H) { const g = x.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)'); x.fillStyle = g; x.fillRect(0, 0, W, H); x.strokeStyle = 'rgba(224,182,74,0.55)'; x.lineWidth = 2; x.strokeRect(1, 1, W - 2, H - 2); }
  function smoke(x, px, py, n, seed, drift) { const r = U.rng(seed); for (let i = 0; i < n; i++) { const t = i / n; x.fillStyle = 'rgba(' + (60 + t * 40 | 0) + ',' + (56 + t * 40 | 0) + ',' + (60 + t * 40 | 0) + ',' + (0.5 - t * 0.42).toFixed(2) + ')'; x.beginPath(); x.arc(px + t * drift + (r() - 0.5) * 8, py - t * 90, 6 + t * 18, 0, TAU); x.fill(); } }

  const scenes = {
    crash(x, W, H) {
      sky(x, W, H, [[0, '#1a1a3e'], [0.45, '#7a3a58'], [0.75, '#e0824a'], [1, '#f6c070']]); stars(x, W, H, 70, 3);
      glow(x, W * 0.78, H * 0.62, 90, 'rgba(255,200,120,0.55)'); x.fillStyle = '#ffe2a8'; x.beginPath(); x.arc(W * 0.78, H * 0.62, 20, 0, TAU); x.fill();
      x.fillStyle = 'rgba(240,210,230,0.75)'; x.beginPath(); x.arc(W * 0.18, H * 0.2, 14, 0, TAU); x.fill(); x.fillStyle = 'rgba(80,50,90,0.35)'; x.beginPath(); x.arc(W * 0.18 + 4, H * 0.2 + 2, 11, 0, TAU); x.fill();
      ridge(x, W, H * 0.66, 18, '#5a3a58', 5, 12); ridge(x, W, H * 0.74, 10, '#3a2a48', 7, 8);
      const r = U.rng(9); for (let i = 0; i < 30; i++) pine(x, r() * W, H * 0.8 + r() * 14, 26 + r() * 28, i % 2 ? '#1c2a30' : '#14202a');
      x.fillStyle = '#1e2a26'; x.fillRect(0, H * 0.84, W, H * 0.2); x.fillStyle = '#2a3a2e'; x.fillRect(0, H * 0.84, W, 3);
      // траса падіння
      const g = x.createLinearGradient(30, 0, W * 0.5, H * 0.78); g.addColorStop(0, 'rgba(255,200,120,0)'); g.addColorStop(1, 'rgba(255,140,60,0.75)'); x.strokeStyle = g; x.lineWidth = 10; x.lineCap = 'round'; x.beginPath(); x.moveTo(20, 6); x.lineTo(W * 0.5, H * 0.76); x.stroke(); x.strokeStyle = 'rgba(255,240,200,0.5)'; x.lineWidth = 3; x.stroke();
      smoke(x, W * 0.5, H * 0.8, 14, 11, -40);
      // корабель
      x.save(); x.translate(W * 0.5, H * 0.8); x.rotate(-0.12); x.fillStyle = 'rgba(0,0,0,0.4)'; x.beginPath(); x.ellipse(0, 12, 70, 8, 0, 0, TAU); x.fill();
      const hg = x.createLinearGradient(0, -22, 0, 14); hg.addColorStop(0, '#d8dee6'); hg.addColorStop(0.5, '#8a96a4'); hg.addColorStop(1, '#3a4450'); x.fillStyle = hg; x.beginPath(); x.moveTo(-62, -6); x.quadraticCurveTo(-62, -20, -48, -20); x.lineTo(14, -20); x.lineTo(8, -2); x.lineTo(14, 12); x.lineTo(-48, 12); x.quadraticCurveTo(-62, 12, -62, -6); x.fill();
      x.save(); x.translate(26, 2); x.rotate(0.14); x.fillStyle = hg; x.beginPath(); x.moveTo(0, -20); x.lineTo(32, -16); x.quadraticCurveTo(64, -6, 66, 4); x.quadraticCurveTo(60, 14, 30, 14); x.lineTo(0, 14); x.closePath(); x.fill(); x.fillStyle = '#6cc0e4'; x.beginPath(); x.arc(40, -4, 5, 0, TAU); x.fill(); x.restore();
      x.fillStyle = '#b03a2a'; x.fillRect(-56, -4, 66, 4); x.fillStyle = '#10080a'; x.beginPath(); x.moveTo(8, -20); x.lineTo(16, -10); x.lineTo(10, 0); x.lineTo(18, 12); x.lineTo(10, 14); x.lineTo(2, 0); x.closePath(); x.fill();
      glow(x, 12, -2, 30, 'rgba(255,150,50,0.9)'); x.restore();
      // вогонь на полі
      for (let i = 0; i < 6; i++) { glow(x, W * 0.5 + 6 + (i - 3) * 5, H * 0.8 + 2, 12, 'rgba(255,170,60,0.55)'); }
      person(x, W * 0.38, H * 0.9, 1.3, '#4a6aa8', '#e0b090', '#4a3020'); person(x, W * 0.44, H * 0.92, 1.3, '#b04a3a', '#c8906a', '#222'); person(x, W * 0.62, H * 0.91, 1.3, '#4a8a5a', '#f0c8a0', '#c8a040');
      vignette(x, W, H);
    },
    tribe(x, W, H) {
      sky(x, W, H, [[0, '#050818'], [0.6, '#10203a'], [1, '#243a48']]); stars(x, W, H, 160, 21);
      glow(x, W * 0.82, H * 0.2, 70, 'rgba(210,225,255,0.35)'); x.fillStyle = '#eef2ff'; x.beginPath(); x.arc(W * 0.82, H * 0.2, 14, 0, TAU); x.fill(); x.fillStyle = 'rgba(180,190,220,0.5)'; x.beginPath(); x.arc(W * 0.82 + 4, H * 0.2 - 2, 4, 0, TAU); x.fill();
      ridge(x, W, H * 0.58, 24, '#16243a', 31, 14); ridge(x, W, H * 0.68, 14, '#101c2c', 33, 10);
      const r = U.rng(17); for (let i = 0; i < 36; i++) pine(x, r() * W, H * 0.76 + r() * 18, 30 + r() * 34, i % 2 ? '#0c1a1e' : '#0a1418');
      x.fillStyle = '#16221c'; x.fillRect(0, H * 0.82, W, H * 0.2);
      glow(x, W * 0.5, H * 0.86, 150, 'rgba(255,140,50,0.42)');
      // намети
      const tent = (px, py, s, col) => { x.fillStyle = col; x.beginPath(); x.moveTo(px, py - 46 * s); x.lineTo(px + 34 * s, py); x.lineTo(px - 34 * s, py); x.closePath(); x.fill(); x.fillStyle = 'rgba(255,150,60,0.25)'; x.beginPath(); x.moveTo(px, py - 46 * s); x.lineTo(px + 34 * s, py); x.lineTo(px + 6 * s, py); x.closePath(); x.fill(); x.fillStyle = '#0a0a0a'; x.beginPath(); x.moveTo(px, py - 24 * s); x.lineTo(px + 9 * s, py); x.lineTo(px - 9 * s, py); x.closePath(); x.fill(); x.strokeStyle = '#3a2a18'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(px, py - 46 * s); x.lineTo(px - 3 * s, py - 56 * s); x.moveTo(px, py - 46 * s); x.lineTo(px + 3 * s, py - 56 * s); x.stroke(); };
      tent(W * 0.2, H * 0.88, 1.2, '#6a4a30'); tent(W * 0.8, H * 0.9, 1.0, '#7a5a38'); tent(W * 0.12, H * 0.95, 0.8, '#5a3e2a');
      // вогнище
      const fx = W * 0.5, fy = H * 0.9; x.fillStyle = '#2a1a0c'; for (let k = 0; k < 5; k++) { x.save(); x.translate(fx, fy); x.rotate(k * 1.25); x.fillRect(-12, -1.5, 24, 3); x.restore(); }
      for (let k = 0; k < 4; k++) { const g = x.createRadialGradient(fx, fy - 8 - k * 3, 0, fx, fy - 8 - k * 3, 14 - k * 2); g.addColorStop(0, k === 3 ? '#fff6c0' : k === 2 ? '#ffd060' : k === 1 ? '#ff9a30' : '#d84a1a'); g.addColorStop(1, 'rgba(255,80,20,0)'); x.fillStyle = g; x.beginPath(); x.moveTo(fx - 10 + k * 2, fy - 2); x.quadraticCurveTo(fx - 6, fy - 22 - k * 4, fx, fy - 34 + k * 5); x.quadraticCurveTo(fx + 6, fy - 22 - k * 4, fx + 10 - k * 2, fy - 2); x.fill(); }
      const rr = U.rng(5); for (let i = 0; i < 24; i++) { x.fillStyle = 'rgba(255,' + (150 + rr() * 90 | 0) + ',60,' + (0.4 + rr() * 0.6).toFixed(2) + ')'; x.fillRect(fx + (rr() - 0.5) * 50, fy - 20 - rr() * 70, 1.6, 1.6); }
      person(x, fx - 40, fy + 4, 1.4, '#7a5a32', '#c89068', '#1a1208'); person(x, fx + 38, fy + 6, 1.4, '#8a4a30', '#a87a58', '#2a1a0c'); person(x, fx - 20, fy + 12, 1.2, '#5a6a48', '#d8a880', '#6a3a1a'); person(x, fx + 18, fy + 14, 1.2, '#6a4a5a', '#b08060', '#222');
      vignette(x, W, H);
    },
    rich(x, W, H) {
      sky(x, W, H, [[0, '#3a82d0'], [0.6, '#8ec8f0'], [1, '#e8f0e0']]);
      glow(x, W * 0.2, H * 0.2, 90, 'rgba(255,250,210,0.9)'); x.fillStyle = '#fffbe0'; x.beginPath(); x.arc(W * 0.2, H * 0.2, 18, 0, TAU); x.fill();
      const rc = U.rng(8); for (let i = 0; i < 6; i++) { const cx = rc() * W, cy = 14 + rc() * 70; x.fillStyle = 'rgba(255,255,255,0.7)'; for (let k = 0; k < 5; k++) { x.beginPath(); x.arc(cx + k * 14, cy + (k % 2) * 4, 11 + (k % 3) * 3, 0, TAU); x.fill(); } }
      ridge(x, W, H * 0.62, 26, '#b89a6a', 41, 16); ridge(x, W, H * 0.7, 12, '#a88a58', 43, 9); ridge(x, W, H * 0.8, 8, '#7a9a4a', 45, 6);
      x.fillStyle = '#6a8a3a'; x.fillRect(0, H * 0.86, W, H * 0.2);
      // посадкова капсула / модуль
      const bx = W * 0.62, by = H * 0.86; x.fillStyle = 'rgba(0,0,0,0.3)'; x.beginPath(); x.ellipse(bx, by + 2, 56, 8, 0, 0, TAU); x.fill();
      const mg = x.createLinearGradient(0, by - 50, 0, by); mg.addColorStop(0, '#f2f6fa'); mg.addColorStop(1, '#8a96a4'); x.fillStyle = mg; x.beginPath(); x.moveTo(bx - 46, by); x.lineTo(bx - 40, by - 34); x.quadraticCurveTo(bx, by - 62, bx + 40, by - 34); x.lineTo(bx + 46, by); x.closePath(); x.fill(); x.strokeStyle = '#4a5460'; x.lineWidth = 1.5; x.stroke();
      x.fillStyle = '#1a3a52'; x.beginPath(); x.ellipse(bx + 4, by - 30, 18, 10, 0, 0, TAU); x.fill(); x.fillStyle = 'rgba(160,220,255,0.6)'; x.beginPath(); x.ellipse(bx - 1, by - 33, 9, 3.5, -0.2, 0, TAU); x.fill();
      x.fillStyle = '#c0422a'; x.fillRect(bx - 44, by - 12, 90, 4);
      // ящики зі скарбами
      for (const [px, py, c] of [[W * 0.36, 0, '#e0b64a'], [W * 0.31, 6, '#c9d6e2'], [W * 0.4, 8, '#9ab0c8']]) { const yy = by + py - 12; x.fillStyle = '#5a4a38'; x.fillRect(px - 12, yy, 24, 14); x.fillStyle = c; x.fillRect(px - 10, yy - 3, 20, 6); x.fillStyle = 'rgba(255,255,255,0.5)'; x.fillRect(px - 8, yy - 3, 8, 1.5); }
      glow(x, W * 0.36, by - 14, 34, 'rgba(255,220,100,0.55)');
      // дрон
      const dx = W * 0.5, dy = H * 0.34; x.fillStyle = '#2a3038'; x.beginPath(); x.ellipse(dx, dy, 12, 5, 0, 0, TAU); x.fill(); x.fillStyle = '#6ac8f0'; x.beginPath(); x.arc(dx, dy + 1, 2.5, 0, TAU); x.fill(); x.strokeStyle = '#2a3038'; x.lineWidth = 2; x.beginPath(); x.moveTo(dx - 20, dy - 5); x.lineTo(dx + 20, dy - 5); x.moveTo(dx, dy - 4); x.lineTo(dx, dy - 5); x.stroke(); x.strokeStyle = 'rgba(255,255,255,0.5)'; x.beginPath(); x.ellipse(dx - 16, dy - 6, 7, 1.5, 0, 0, TAU); x.ellipse(dx + 16, dy - 6, 7, 1.5, 0, 0, TAU); x.stroke();
      person(x, W * 0.5, H * 0.92, 1.9, '#2f4a6a', '#e8c0a0', '#5a3a20'); x.fillStyle = '#c04a2a'; x.fillRect(W * 0.5 - 6, H * 0.92 - 22, 4, 12);
      vignette(x, W, H);
    },
    naked(x, W, H) {
      sky(x, W, H, [[0, '#4a9ae0'], [0.7, '#b0dcf8'], [1, '#f4efd8']]);
      const rc = U.rng(13); for (let i = 0; i < 5; i++) { const cx = rc() * W, cy = 12 + rc() * 70; x.fillStyle = 'rgba(255,255,255,0.8)'; for (let k = 0; k < 4; k++) { x.beginPath(); x.arc(cx + k * 12, cy + (k % 2) * 3, 10 + (k % 3) * 3, 0, TAU); x.fill(); } }
      glow(x, W * 0.82, H * 0.18, 80, 'rgba(255,245,190,0.9)'); x.fillStyle = '#fff8d0'; x.beginPath(); x.arc(W * 0.82, H * 0.18, 16, 0, TAU); x.fill();
      ridge(x, W, H * 0.64, 20, '#9ab070', 51, 12); ridge(x, W, H * 0.74, 10, '#7ea050', 53, 8);
      x.fillStyle = '#6a9a3a'; x.fillRect(0, H * 0.8, W, H * 0.3); const g = U.rng(4); for (let i = 0; i < 220; i++) { x.strokeStyle = i % 2 ? '#4a7a2a' : '#8ab84a'; x.lineWidth = 1; const px = g() * W, py = H * 0.8 + g() * H * 0.22; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (g() - 0.5) * 3, py - 4 - g() * 5); x.stroke(); }
      // кущ
      x.fillStyle = '#2f6a2a'; for (const [px, py, r] of [[W * 0.7, H * 0.84, 18], [W * 0.75, H * 0.82, 14], [W * 0.66, H * 0.86, 12]]) { x.beginPath(); x.arc(px, py, r, 0, TAU); x.fill(); } x.fillStyle = '#c2305a'; for (let i = 0; i < 8; i++) { x.beginPath(); x.arc(W * 0.66 + g() * 50, H * 0.78 + g() * 14, 2, 0, TAU); x.fill(); }
      // герой із листком
      const px = W * 0.36, py = H * 0.9, s = 2.2; x.fillStyle = 'rgba(0,0,0,0.3)'; x.beginPath(); x.ellipse(px, py + 2, 12, 3, 0, 0, TAU); x.fill();
      x.fillStyle = '#e8b890'; x.fillRect(px - 4 * s, py - 10 * s, 8 * s, 9 * s); x.fillRect(px - 4 * s, py - 2 * s, 3 * s, 4 * s); x.fillRect(px + 1 * s, py - 2 * s, 3 * s, 4 * s); x.fillRect(px - 6 * s, py - 9 * s, 2 * s, 7 * s); x.fillRect(px + 4 * s, py - 9 * s, 2 * s, 7 * s);
      x.beginPath(); x.arc(px, py - 13.5 * s, 4 * s, 0, TAU); x.fill(); x.fillStyle = '#6a3a1a'; x.beginPath(); x.arc(px, py - 15 * s, 4.1 * s, Math.PI, 0); x.fill(); x.fillStyle = '#222'; x.fillRect(px - 2 * s, py - 14 * s, 1.2, 1.4); x.fillRect(px + 1 * s, py - 14 * s, 1.2, 1.4);
      x.fillStyle = '#3f9a3a'; x.beginPath(); x.ellipse(px, py - 3.2 * s, 3.4 * s, 2.6 * s, 0, 0, TAU); x.fill(); x.strokeStyle = '#276a24'; x.lineWidth = 1; x.beginPath(); x.moveTo(px, py - 5.5 * s); x.lineTo(px, py - 1 * s); x.stroke();
      // питання
      x.fillStyle = '#fff'; x.font = 'bold 26px Georgia'; x.fillText('?!', px + 30, py - 44);
      vignette(x, W, H);
    }
  };
  SC.draw = function (cv, id) { const x = cv.getContext('2d'); const f = scenes[id] || scenes.crash; x.clearRect(0, 0, cv.width, cv.height); f(x, cv.width, cv.height); };
})();
