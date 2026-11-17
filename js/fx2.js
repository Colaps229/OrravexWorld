// ============================================================
//  fx2.js — розширені частинки та ауры: серця, чхання, іскри, зірки, конфеті…
// ============================================================
(function () {
  'use strict';
  const RW = window.RW; const U = RW.U; const TAU = Math.PI * 2;
  const FX2 = RW.FX2 = {}; const list = [];
  const CONF = ['#f2c14e', '#e0607e', '#5ab0e8', '#7ad07a', '#c88af0', '#ffffff', '#ff9a4a'];
  const R_ = (a, b) => a + Math.random() * (b - a);

  // x,y — у клітинках; o — додаткові параметри
  FX2.emit = function (type, x, y, o) {
    if (list.length > 700) list.shift(); o = o || {};
    const base = { t: type, x, y, life: 60, max: 60, vx: 0, vy: 0, s: 1, c: '#fff', rot: 0, vr: 0, g: 0, k: Math.random() * 6.28 };
    switch (type) {
      case 'heart': Object.assign(base, { life: 80, max: 80, vx: R_(-0.004, 0.004), vy: -R_(0.012, 0.02), s: R_(0.8, 1.3), c: o.c || '#ff5a8a' }); break;
      case 'cough': Object.assign(base, { life: 46, max: 46, vx: (o.dx || 0) * 0.012 + R_(-0.004, 0.004), vy: -0.006 + R_(-0.004, 0.002), s: R_(2, 4), c: '#9ad45a' }); break;
      case 'spore': Object.assign(base, { life: 70, max: 70, vx: R_(-0.012, 0.012), vy: R_(-0.012, 0.004), s: R_(1.4, 2.4), c: '#b8e060' }); break;
      case 'sparkle': Object.assign(base, { life: 40, max: 40, vx: R_(-0.006, 0.006), vy: -R_(0.004, 0.012), s: R_(2, 4.5), c: o.c || '#ffe27a' }); break;
      case 'star': Object.assign(base, { life: 70, max: 70, vx: R_(-0.01, 0.01), vy: -R_(0.016, 0.03), s: R_(5, 9), c: o.c || '#ffd84a', vr: R_(-0.08, 0.08) }); break;
      case 'confetti': Object.assign(base, { life: 110, max: 110, vx: R_(-0.016, 0.016), vy: -R_(0.02, 0.05), g: 0.0016, s: R_(2.4, 4), c: CONF[(Math.random() * CONF.length) | 0], vr: R_(-0.3, 0.3) }); break;
      case 'tear': Object.assign(base, { life: 34, max: 34, vx: R_(-0.004, 0.004), vy: 0.004, g: 0.0012, s: R_(1.6, 2.4), c: '#7ac8ff' }); break;
      case 'sweat': Object.assign(base, { life: 30, max: 30, vx: R_(-0.01, 0.01), vy: -0.012, g: 0.0014, s: 1.8, c: '#bfe8ff' }); break;
      case 'drop': Object.assign(base, { life: 26, max: 26, vx: R_(-0.003, 0.003), vy: 0.002, g: 0.002, s: R_(1.6, 2.6), c: '#a81818' }); break;
      case 'ember': Object.assign(base, { life: 36, max: 36, vx: R_(-0.02, 0.02), vy: -R_(0.014, 0.04), g: 0.0009, s: R_(1.6, 3), c: Math.random() < 0.5 ? '#ffb040' : '#ff6a20' }); break;
      case 'note': Object.assign(base, { life: 70, max: 70, vx: R_(-0.004, 0.012), vy: -R_(0.01, 0.018), s: R_(1, 1.4), c: o.c || '#ffe9a0' }); break;
      case 'anger': Object.assign(base, { life: 22, max: 22, s: 1, c: '#ff4a3a' }); break;
      case 'ringpulse': Object.assign(base, { life: 36, max: 36, s: o.r || 1, c: o.c || '#ff5a4a' }); break;
      case 'gem': Object.assign(base, { life: 50, max: 50, vx: R_(-0.01, 0.01), vy: -R_(0.02, 0.03), g: 0.0012, s: 3, c: o.c || '#7ae0ff' }); break;
      case 'coin': Object.assign(base, { life: 40, max: 40, vx: R_(-0.01, 0.01), vy: -R_(0.02, 0.035), g: 0.0018, s: 3, c: '#f4c84a' }); break;
      case 'dustpuff': Object.assign(base, { life: 30, max: 30, vx: R_(-0.01, 0.01), vy: -R_(0.002, 0.008), s: R_(2, 4), c: '#c9b890' }); break;
    }
    Object.assign(base, o.over || {}); list.push(base); return base;
  };
  FX2.burst = (type, x, y, n, o) => { for (let i = 0; i < n; i++) FX2.emit(type, x + R_(-0.3, 0.3), y + R_(-0.3, 0.3), o); };
  FX2.update = function () {
    for (let i = list.length - 1; i >= 0; i--) { const p = list[i]; p.life--; p.x += p.vx; p.y += p.vy; p.vy += p.g; p.rot += p.vr; p.k += 0.12; if (p.t === 'heart' || p.t === 'note') p.x += Math.sin(p.k) * 0.003; if (p.life <= 0) list.splice(i, 1); }
  };
  function heart(c, s) { c.beginPath(); c.moveTo(0, s * 0.35); c.bezierCurveTo(-s * 0.9, -s * 0.2, -s * 0.5, -s * 0.9, 0, -s * 0.4); c.bezierCurveTo(s * 0.5, -s * 0.9, s * 0.9, -s * 0.2, 0, s * 0.35); c.closePath(); }
  function star(c, s) { c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? s * 0.42 : s; const a = -Math.PI / 2 + i * Math.PI / 5; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); }
  function four(c, s) { c.beginPath(); c.moveTo(0, -s); c.quadraticCurveTo(s * 0.18, -s * 0.18, s, 0); c.quadraticCurveTo(s * 0.18, s * 0.18, 0, s); c.quadraticCurveTo(-s * 0.18, s * 0.18, -s, 0); c.quadraticCurveTo(-s * 0.18, -s * 0.18, 0, -s); c.closePath(); }
  FX2.draw = function (c, TS) {
    for (const p of list) {
      const a = Math.min(1, p.life / p.max * 1.6); const px = p.x * TS, py = p.y * TS; c.save(); c.translate(px, py); c.globalAlpha = a;
      switch (p.t) {
        case 'heart': { const sc = 5.5 * p.s * (0.7 + 0.3 * Math.min(1, (p.max - p.life) / 10)); heart(c, sc); c.fillStyle = p.c; c.fill(); c.strokeStyle = 'rgba(90,10,30,0.8)'; c.lineWidth = 0.9; c.stroke(); c.fillStyle = 'rgba(255,255,255,0.6)'; c.beginPath(); c.arc(-sc * 0.32, -sc * 0.36, sc * 0.16, 0, TAU); c.fill(); break; }
        case 'cough': case 'dustpuff': { const r = p.s * (1 + (p.max - p.life) * 0.1); const g = c.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, p.t === 'cough' ? 'rgba(170,230,90,0.7)' : 'rgba(210,190,150,0.6)'); g.addColorStop(1, 'rgba(120,190,60,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); break; }
        case 'spore': { c.fillStyle = p.c; c.beginPath(); c.arc(0, 0, p.s, 0, TAU); c.fill(); c.strokeStyle = 'rgba(60,110,10,0.9)'; c.lineWidth = 0.7; c.beginPath(); c.arc(0, 0, p.s * 1.5, 0, TAU); c.stroke(); break; }
        case 'sparkle': { c.globalCompositeOperation = 'lighter'; c.rotate(p.k * 0.3); four(c, p.s * (0.5 + 0.5 * Math.sin(p.k * 2))); c.fillStyle = p.c; c.fill(); break; }
        case 'star': { c.rotate(p.rot); star(c, p.s); c.fillStyle = p.c; c.fill(); c.strokeStyle = 'rgba(120,70,0,0.9)'; c.lineWidth = 0.9; c.stroke(); c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(255,240,160,0.4)'; c.beginPath(); c.arc(0, 0, p.s * 1.5, 0, TAU); c.fill(); break; }
        case 'confetti': { c.rotate(p.rot); c.scale(1, Math.cos(p.k)); c.fillStyle = p.c; c.fillRect(-p.s, -p.s * 0.5, p.s * 2, p.s); break; }
        case 'tear': case 'sweat': case 'drop': { c.fillStyle = p.c; c.beginPath(); c.moveTo(0, -p.s * 1.6); c.quadraticCurveTo(p.s * 1.2, 0, 0, p.s); c.quadraticCurveTo(-p.s * 1.2, 0, 0, -p.s * 1.6); c.fill(); if (p.t !== 'drop') { c.fillStyle = 'rgba(255,255,255,0.7)'; c.fillRect(-p.s * 0.3, -p.s * 0.6, 0.9, 1.2); } break; }
        case 'ember': { c.globalCompositeOperation = 'lighter'; c.fillStyle = p.c; c.beginPath(); c.arc(0, 0, p.s, 0, TAU); c.fill(); break; }
        case 'note': { c.fillStyle = p.c; c.strokeStyle = p.c; c.lineWidth = 1.3; c.beginPath(); c.ellipse(0, 0, 2.6, 1.9, -0.4, 0, TAU); c.fill(); c.beginPath(); c.moveTo(2.2, -0.4); c.lineTo(2.2, -8); c.lineTo(5.5, -6); c.stroke(); break; }
        case 'anger': { const k = 1 - p.life / p.max; c.strokeStyle = p.c; c.lineWidth = 1.6; for (let i = 0; i < 4; i++) { const ang = i * Math.PI / 2 + 0.78; c.beginPath(); c.moveTo(Math.cos(ang) * (5 + k * 4), Math.sin(ang) * (5 + k * 4)); c.lineTo(Math.cos(ang) * (9 + k * 6), Math.sin(ang) * (9 + k * 6)); c.stroke(); } break; }
        case 'ringpulse': { const k = 1 - p.life / p.max; c.strokeStyle = p.c; c.lineWidth = 2 * (1 - k) + 0.5; c.beginPath(); c.ellipse(0, 0, (4 + k * 16) * p.s, (2 + k * 8) * p.s, 0, 0, TAU); c.stroke(); break; }
        case 'gem': { c.rotate(p.k); c.fillStyle = p.c; c.beginPath(); c.moveTo(0, -p.s); c.lineTo(p.s, 0); c.lineTo(0, p.s); c.lineTo(-p.s, 0); c.closePath(); c.fill(); c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 0.6; c.stroke(); break; }
        case 'coin': { c.scale(Math.cos(p.k * 2), 1); c.fillStyle = p.c; c.beginPath(); c.arc(0, 0, p.s, 0, TAU); c.fill(); c.strokeStyle = '#8a6a1a'; c.lineWidth = 0.8; c.stroke(); c.fillStyle = 'rgba(255,255,255,0.6)'; c.fillRect(-1, -1.5, 1, 1.6); break; }
      }
      c.restore();
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  };
  FX2.count = () => list.length;
  FX2.clear = () => { list.length = 0; };
})();
