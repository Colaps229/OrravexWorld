// ============================================================
//  menufx.js — анімований фон головного меню «Orravex World»
//  зоряне небо, туманності, планета з кільцем і місяцями, аврора, паралакс-гори, вогнище, кораблі
// ============================================================
(function () {
  'use strict';
  const FX = RW.MenuFX = { trans: 0, born: 0, ships: [], embers: [], dust: [], clouds: [] };
  let inited = false; const TAU = Math.PI * 2; const R = Math.random;
  function init() {
    inited = true; FX.born = performance.now();
    for (let i = 0; i < 40; i++) FX.dust.push({ x: R(), y: R(), r: R() * 1.6 + 0.4, s: R() * 0.0004 + 0.00008, p: R() * 6 });
    for (let i = 0; i < 5; i++) FX.clouds.push({ x: R(), y: 0.1 + R() * 0.3, w: 0.25 + R() * 0.3, s: 0.00004 + R() * 0.00005, a: 0.05 + R() * 0.06 });
  }
  FX.kick = () => { FX.trans = 1; };
  FX.draw = function (c, W, H, t, stars) {
    if (!inited) init(); const age = Math.min(1, (performance.now() - FX.born) / 2600); // плавна поява
    const gr = c.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#03050d'); gr.addColorStop(0.5, '#0c1830'); gr.addColorStop(0.85, '#27324a'); gr.addColorStop(1, '#3a3a48'); c.fillStyle = gr; c.fillRect(0, 0, W, H);
    // туманності
    const neb = [[0.25, 0.25, 0.4, 'rgba(120,60,180,', 0.16], [0.7, 0.18, 0.35, 'rgba(40,120,200,', 0.14], [0.5, 0.45, 0.45, 'rgba(220,100,60,', 0.07]];
    for (const [nx, ny, nr, col, a] of neb) { const x = (nx + Math.sin(t * 0.0016 + nx * 9) * 0.03) * W, y = (ny + Math.cos(t * 0.0013 + ny * 7) * 0.02) * H, r = nr * Math.max(W, H) * 0.6; const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col + a * age + ')'); g.addColorStop(1, col + '0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
    for (const s of stars) { c.globalAlpha = (0.3 + 0.7 * Math.abs(Math.sin(t * 0.02 + s.tw))) * age; c.fillStyle = s.r > 1.2 ? '#cfe4ff' : '#fff'; c.fillRect(s.x * W, s.y * H, s.r, s.r); } c.globalAlpha = 1;
    // аврора
    c.save(); c.globalCompositeOperation = 'lighter'; for (let k = 0; k < 3; k++) { const g = c.createLinearGradient(0, H * 0.1, 0, H * 0.5); const hue = [150, 175, 280][k]; g.addColorStop(0, 'hsla(' + hue + ',90%,60%,0)'); g.addColorStop(0.5, 'hsla(' + hue + ',90%,60%,' + 0.07 * age + ')'); g.addColorStop(1, 'hsla(' + hue + ',90%,60%,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(0, H * 0.5); for (let x = 0; x <= W; x += 24) c.lineTo(x, H * (0.28 + k * 0.05) + Math.sin(x * 0.004 + t * 0.012 + k * 2) * 40 + Math.sin(x * 0.011 - t * 0.02) * 14); c.lineTo(W, H * 0.5); c.closePath(); c.fill(); } c.restore();
    // планета з кільцем
    const px = W * 0.76, py = H * 0.3, pr = Math.min(W, H) * 0.19;
    c.save(); c.translate(px, py); c.rotate(-0.35);
    const ring = (front) => { c.save(); c.beginPath(); if (front) c.rect(-pr * 3, 0, pr * 6, pr * 3); else c.rect(-pr * 3, -pr * 3, pr * 6, pr * 3); c.clip(); for (let i = 0; i < 4; i++) { c.strokeStyle = ['rgba(230,200,150,.55)', 'rgba(190,150,110,.4)', 'rgba(250,230,190,.35)', 'rgba(150,110,80,.3)'][i]; c.lineWidth = pr * (0.12 - i * 0.02); c.beginPath(); c.ellipse(0, 0, pr * (1.55 + i * 0.13), pr * (0.42 + i * 0.035), 0, 0, TAU); c.stroke(); } c.restore(); };
    ring(false);
    const pgr = c.createRadialGradient(-pr * 0.35, -pr * 0.35, pr * 0.1, 0, 0, pr); pgr.addColorStop(0, '#ffd8a0'); pgr.addColorStop(0.5, '#c07840'); pgr.addColorStop(1, '#3a1c14'); c.fillStyle = pgr; c.beginPath(); c.arc(0, 0, pr, 0, TAU); c.fill();
    c.save(); c.beginPath(); c.arc(0, 0, pr, 0, TAU); c.clip(); for (let i = 0; i < 7; i++) { const yy = -pr + (i + 0.5) * pr * 2 / 7 + Math.sin(t * 0.01 + i) * 2; c.fillStyle = i % 2 ? 'rgba(120,60,30,.22)' : 'rgba(255,220,170,.13)'; c.fillRect(-pr + ((t * (0.12 + i * 0.03)) % (pr * 2)) - pr, yy, pr * 4, pr * 0.14); c.fillRect(-pr, yy, pr * 2, pr * 0.1); }
    const sg = c.createRadialGradient(pr * 0.5, pr * 0.4, pr * 0.2, pr * 0.5, pr * 0.4, pr * 1.4); sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,10,.8)'); c.fillStyle = sg; c.fillRect(-pr, -pr, pr * 2, pr * 2); c.restore();
    ring(true); c.restore();
    for (const [rad, sp, sz, col] of [[2.3, 0.004, 5, '#d8d8e0'], [3.1, 0.0026, 3.4, '#a8c8ff']]) { const a = t * sp + rad * 4; const mx = px + Math.cos(a) * pr * rad, my = py + Math.sin(a) * pr * rad * 0.35 - Math.cos(a) * 0; const front = Math.sin(a) > 0; c.fillStyle = col; c.beginPath(); c.arc(mx, my, sz * (front ? 1.15 : 0.8), 0, TAU); c.fill(); }
    // метеори
    if (R() < 0.012) FX.ships.push({ k: 'm', x: R() * W * 1.2, y: -20, vx: -3 - R() * 3, vy: 5 + R() * 4 });
    if (R() < 0.0016 && !FX.ships.some(s => s.k === 's')) FX.ships.push({ k: 's', x: -60, y: H * (0.2 + R() * 0.25), vx: 1.6 + R(), vy: 0.18, ph: 0 });
    for (let i = FX.ships.length - 1; i >= 0; i--) { const s = FX.ships[i]; s.x += s.vx; s.y += s.vy;
      if (s.k === 'm') { const tg = c.createLinearGradient(s.x, s.y, s.x - s.vx * 18, s.y - s.vy * 18); tg.addColorStop(0, 'rgba(255,220,150,.95)'); tg.addColorStop(1, 'rgba(255,120,40,0)'); c.strokeStyle = tg; c.lineWidth = 3; c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x - s.vx * 18, s.y - s.vy * 18); c.stroke(); if (s.y > H) FX.ships.splice(i, 1); }
      else { c.save(); c.translate(s.x, s.y); c.rotate(Math.atan2(s.vy, s.vx)); const fl = 14 + Math.sin(t * 0.6) * 4; const g = c.createLinearGradient(-fl * 3, 0, 0, 0); g.addColorStop(0, 'rgba(100,180,255,0)'); g.addColorStop(1, 'rgba(160,220,255,.9)'); c.fillStyle = g; c.beginPath(); c.moveTo(0, -3); c.lineTo(-fl * 3, 0); c.lineTo(0, 3); c.fill(); c.fillStyle = '#c8d0da'; c.beginPath(); c.moveTo(16, 0); c.lineTo(-8, -6); c.lineTo(-12, -2); c.lineTo(-12, 2); c.lineTo(-8, 6); c.closePath(); c.fill(); c.fillStyle = '#6aa8e0'; c.beginPath(); c.ellipse(5, 0, 4, 2.2, 0, 0, TAU); c.fill(); c.restore(); if (s.x > W + 80) FX.ships.splice(i, 1); } }
    // шари гір (паралакс)
    const layer = (base, amp, col, sp, off, f1, f2) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, H); for (let x = 0; x <= W; x += 16) c.lineTo(x, H * base - Math.sin(x * f1 + off + t * sp) * amp - Math.sin(x * f2 + off * 2) * amp * 0.45 - Math.abs(Math.sin(x * f1 * 2.3 + off)) * amp * 0.5); c.lineTo(W, H); c.fill(); };
    layer(0.78, 42, '#1a2438', 0.0006, 1, 0.0032, 0.009); layer(0.84, 34, '#101826', 0.0011, 4, 0.005, 0.013);
    // туман
    for (const cl of FX.clouds) { cl.x += cl.s; if (cl.x > 1.4) cl.x = -0.4; const g = c.createRadialGradient(cl.x * W, H * 0.82, 0, cl.x * W, H * 0.82, cl.w * W * 0.5); g.addColorStop(0, 'rgba(150,170,200,' + cl.a + ')'); g.addColorStop(1, 'rgba(150,170,200,0)'); c.fillStyle = g; c.fillRect(cl.x * W - cl.w * W, H * 0.7, cl.w * W * 2, H * 0.3); }
    layer(0.91, 24, '#080c14', 0.0016, 9, 0.007, 0.017);
    // вогнище, силуети колоністів
    const fx = W * 0.2, fy = H * 0.935;
    for (const [dx, hh, s] of [[-52, 26, -1], [46, 22, 1], [66, 18, 1]]) { c.fillStyle = '#04060a'; c.beginPath(); c.ellipse(fx + dx, fy - hh * 0.5 + 2, 6, hh * 0.5, 0, 0, TAU); c.fill(); c.beginPath(); c.arc(fx + dx, fy - hh - 2, 5, 0, TAU); c.fill(); }
    for (let k = 0; k < 3; k++) { c.fillStyle = ['#ff6a1a', '#ffb02a', '#fff0a0'][k]; const h = (30 - k * 8) + Math.sin(t * 0.3 + k) * 4; c.beginPath(); c.moveTo(fx - 13 + k * 3, fy); c.quadraticCurveTo(fx, fy - h * 0.7, fx + Math.sin(t * 0.2 + k) * 3, fy - h); c.quadraticCurveTo(fx + 4, fy - h * 0.5, fx + 13 - k * 3, fy); c.fill(); }
    const fg = c.createRadialGradient(fx, fy - 12, 5, fx, fy - 12, 220); fg.addColorStop(0, 'rgba(255,140,50,' + (0.26 + Math.sin(t * 0.4) * 0.03) + ')'); fg.addColorStop(1, 'rgba(255,140,50,0)'); c.fillStyle = fg; c.fillRect(fx - 230, fy - 240, 460, 400);
    if (R() < 0.45) FX.embers.push({ x: fx + (R() - 0.5) * 16, y: fy - 10, vx: (R() - 0.5) * 0.5, vy: -0.6 - R() * 0.9, l: 1, s: 1 + R() * 1.6 });
    for (let i = FX.embers.length - 1; i >= 0; i--) { const e = FX.embers[i]; e.x += e.vx + Math.sin(t * 0.1 + i) * 0.2; e.y += e.vy; e.l -= 0.01; if (e.l <= 0) { FX.embers.splice(i, 1); continue; } c.fillStyle = 'rgba(255,' + (140 + e.l * 100 | 0) + ',60,' + e.l + ')'; c.fillRect(e.x, e.y, e.s, e.s); }
    // пил / світлячки
    for (const d of FX.dust) { d.y -= d.s; d.x += Math.sin(t * 0.01 + d.p) * 0.0004; if (d.y < 0) { d.y = 1; d.x = R(); } c.fillStyle = 'rgba(255,230,170,' + (0.25 + 0.3 * Math.sin(t * 0.05 + d.p)) * age + ')'; c.beginPath(); c.arc(d.x * W, d.y * H, d.r, 0, TAU); c.fill(); }
    // віньєтка
    const vg = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)'); c.fillStyle = vg; c.fillRect(0, 0, W, H);
    // чорне затемнення на старті
    if (age < 1) { c.fillStyle = 'rgba(0,0,0,' + (1 - age) + ')'; c.fillRect(0, 0, W, H); }
    // світлова хвиля переходу між екранами
    if (FX.trans > 0) { const p = 1 - FX.trans; const x = -W * 0.3 + p * W * 1.6; const g = c.createLinearGradient(x - W * 0.25, 0, x + W * 0.25, 0); g.addColorStop(0, 'rgba(255,200,110,0)'); g.addColorStop(0.5, 'rgba(255,214,140,' + 0.22 * Math.sin(p * Math.PI) + ')'); g.addColorStop(1, 'rgba(255,200,110,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H); FX.trans = Math.max(0, FX.trans - 0.03); }
  };
})();
