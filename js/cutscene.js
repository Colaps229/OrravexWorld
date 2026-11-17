// Катсцена посадки: космос → вхід в атмосферу → падіння → вибух → герої виходять з уламків
(function () {
  'use strict';
  const RW = window.RW; const U = RW.U; const C = RW.Cutscene = {};
  const TAU = Math.PI * 2;
  let st = null;

  // ---------- корабель (ніс праворуч), 220×90 ----------
  function shipSprite() {
    const W = 240, H = 100; const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
    x.translate(0, 0);
    // двигуни
    for (const py of [30, 50, 70]) { x.fillStyle = '#2a2f36'; x.beginPath(); x.moveTo(34, py - 8); x.lineTo(18, py - 11); x.lineTo(18, py + 11); x.lineTo(34, py + 8); x.closePath(); x.fill(); x.fillStyle = '#4a525c'; x.fillRect(20, py - 9, 3, 18); }
    // стабілізатори
    x.fillStyle = '#8a2a22'; x.beginPath(); x.moveTo(60, 22); x.lineTo(34, 2); x.lineTo(46, 2); x.lineTo(92, 22); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(60, 78); x.lineTo(34, 98); x.lineTo(46, 98); x.lineTo(92, 78); x.closePath(); x.fill();
    x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(40, 3, 24, 2);
    // корпус
    const g = x.createLinearGradient(0, 14, 0, 86); g.addColorStop(0, '#f0f4f8'); g.addColorStop(0.3, '#c2ccd6'); g.addColorStop(0.65, '#8996a4'); g.addColorStop(1, '#46515e');
    x.fillStyle = g; x.beginPath(); x.moveTo(34, 24); x.quadraticCurveTo(34, 14, 46, 14); x.lineTo(150, 14); x.quadraticCurveTo(214, 18, 236, 50); x.quadraticCurveTo(214, 82, 150, 86); x.lineTo(46, 86); x.quadraticCurveTo(34, 86, 34, 76); x.closePath(); x.fill();
    x.strokeStyle = 'rgba(10,16,24,0.75)'; x.lineWidth = 1.5; x.stroke();
    // смуга
    x.fillStyle = '#b03a2a'; x.fillRect(38, 46, 150, 8); x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(38, 46, 150, 1.5);
    // панелі
    x.strokeStyle = 'rgba(20,28,38,0.6)'; x.lineWidth = 1; for (const px of [64, 96, 128, 160]) { x.beginPath(); x.moveTo(px, 15); x.lineTo(px, 85); x.stroke(); x.strokeStyle = 'rgba(255,255,255,0.3)'; x.beginPath(); x.moveTo(px + 1, 15); x.lineTo(px + 1, 85); x.stroke(); x.strokeStyle = 'rgba(20,28,38,0.6)'; }
    for (let k = 0; k < 26; k++) { x.fillStyle = 'rgba(255,255,255,0.5)'; x.fillRect(40 + k * 5, 17, 1.5, 1.5); x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(40 + k * 5, 82, 1.5, 1.5); }
    // кабіна
    const cg = x.createLinearGradient(0, 24, 0, 42); cg.addColorStop(0, '#9ad8f2'); cg.addColorStop(1, '#2a5a78'); x.fillStyle = cg; x.beginPath(); x.moveTo(168, 38); x.quadraticCurveTo(190, 24, 214, 40); x.lineTo(210, 43); x.lineTo(168, 43); x.closePath(); x.fill(); x.strokeStyle = '#1a2a38'; x.lineWidth = 1.2; x.stroke(); x.fillStyle = 'rgba(255,255,255,0.7)'; x.fillRect(176, 30, 12, 2);
    // ілюмінатори
    for (let k = 0; k < 4; k++) { const px = 62 + k * 28; x.fillStyle = '#1c2832'; x.beginPath(); x.arc(px, 31, 6, 0, TAU); x.fill(); x.fillStyle = '#6cc0e4'; x.beginPath(); x.arc(px, 31, 4.2, 0, TAU); x.fill(); x.fillStyle = 'rgba(255,255,255,0.75)'; x.fillRect(px - 2.5, 28, 2, 2); }
    x.fillStyle = 'rgba(30,40,56,0.9)'; x.font = 'bold 10px sans-serif'; x.fillText('ЗОРЯ-7', 70, 68);
    // люк
    x.fillStyle = '#566270'; x.fillRect(120, 58, 26, 22); x.strokeStyle = '#1c2630'; x.strokeRect(120, 58, 26, 22);
    return cv;
  }
  let SHIP = null;

  function drawFlame(x, len, t, w) {
    for (const py of [30, 50, 70]) {
      const l = len * (0.85 + 0.3 * Math.sin(t * 0.9 + py)); const g = x.createLinearGradient(18, 0, 18 - l, 0);
      g.addColorStop(0, 'rgba(255,255,230,0.95)'); g.addColorStop(0.2, 'rgba(255,200,80,0.9)'); g.addColorStop(0.6, 'rgba(255,100,30,0.55)'); g.addColorStop(1, 'rgba(255,60,20,0)');
      x.fillStyle = g; x.beginPath(); x.moveTo(18, py - 9 * w); x.quadraticCurveTo(18 - l * 0.5, py - 6 * w, 18 - l, py); x.quadraticCurveTo(18 - l * 0.5, py + 6 * w, 18, py + 9 * w); x.closePath(); x.fill();
    }
  }

  function makeStars(n) { const r = U.rng(4242); const a = []; for (let i = 0; i < n; i++) a.push({ x: r(), y: r(), s: 0.4 + r() * 1.6, p: r() * 6, c: r() < 0.15 ? '#ffd9b0' : r() < 0.3 ? '#bcd4ff' : '#ffffff' }); return a; }

  // ---------- DOM ----------
  function mkDom() {
    const d = document.createElement('div'); d.id = 'cutscene';
    d.innerHTML = '<canvas id="cs-cv"></canvas><div class="cs-bar cs-top"></div><div class="cs-bar cs-bot"></div><div id="cs-cap"></div><button id="cs-skip">Пропустити ▸▸</button>';
    document.body.appendChild(d); return d;
  }

  C.active = () => !!st; C.dbg = () => st && ({ phase: st.phase, em: st.emerged, w: st.walkers.map(p => [p.x, p.y, p.csx, p.csy]), n: st.crew.length });

  C.play = function (g, crew, lootList, spots, onDone) {
    if (st) return;
    SHIP = SHIP || shipSprite();
    const dom = mkDom(); const cv = dom.querySelector('#cs-cv'); const cap = dom.querySelector('#cs-cap'); const x = cv.getContext('2d');
    st = { g, crew, lootList, onDone, dom, cv, x, cap, t0: performance.now(), phase: 'space', stars: makeStars(260), W: 0, H: 0, flash: 0, wreck: null, emerged: 0, lastEmerge: 0, fall: null, done: false, capT: '', walkers: [], hatchT: 0, smokeT: 0 };
    const BC = { temperate: ['#3f7d48', '#5b9fd4'], boreal: ['#4a7a6a', '#8fc0d8'], desert: ['#b08a4a', '#d8b878'], arid: ['#a8844a', '#d0a868'], tundra: ['#8aa0a8', '#c8dce8'], jungle: ['#2f7a3a', '#4aa0b0'], tropical: ['#2f7a3a', '#4aa0b0'], ice: ['#a8c4d4', '#e6f2fa'] }; st.pc = BC[g.biome] || BC.temperate; g.planetName = g.planetName || g.cfg && g.cfg.planet;
    // місце розбитого корабля
    const cx = Math.floor(g.home.x), cy = Math.floor(g.home.y); let best = null;
    search: for (let r = 0; r < 14; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const tx = cx + dx - 2, ty = cy + dy - 2; if (okSpot(g.map, tx, ty)) { best = [tx, ty]; break search; } }
    st.spots = spots.filter(s => !(s[0] >= (best ? best[0] : 0) - 1 && s[0] <= (best ? best[0] : 0) + 6 && s[1] >= (best ? best[1] : 0) - 1 && s[1] <= (best ? best[1] : 0) + 5)); if (st.spots.length < 4) st.spots = spots; st.wp = best || [cx - 2, cy - 2];
    clearSpot(g.map, st.wp[0], st.wp[1]);
    // точки виходу екіпажу — перед люком, під кораблем
    st.hx = st.wp[0] + 3.3; st.hy = st.wp[1] + 3.1;
    cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;'; resize();
    window.addEventListener('resize', resize);
    dom.querySelector('#cs-skip').onclick = skip;
    st.keyH = e => { if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); skip(); } };
    window.addEventListener('keydown', st.keyH, true);
    document.getElementById('ui') && document.getElementById('ui').classList.add('hidden');
    caption('Ви довго летіли крізь темряву… Попереду — невідома планета «' + (g.planetName || 'Новий світ') + '».');
    if (RW.A && RW.S.audio.sfx !== 0) { try { RW.A.init(); RW.A.sfx('whoosh'); } catch (e) { } }
    g.speed = 0;
  };

  function okSpot(map, x, y) { if (x < 3 || y < 3 || x + 8 >= map.w || y + 9 >= map.h) return false; for (let dy = -1; dy < 5; dy++) for (let dx = -1; dx < 6; dx++) { const i = (y + dy) * map.w + x + dx; if (map.terrain[i] <= 1 || map.cost[i] === 0 && !map.bld[i]) return false; } return true; }
  function clearSpot(map, x, y) { for (let dy = -1; dy < 5; dy++) for (let dx = -1; dx < 6; dx++) { const i = (y + dy) * map.w + x + dx; const b = map.bld[i]; if (b && map.removeBuilding) { try { map.removeBuilding(b); } catch (e) { } } if (map.plant && map.plant[i]) map.removePlant(i); } }

  function resize() { if (!st) return; const d = window.devicePixelRatio || 1; st.W = innerWidth; st.H = innerHeight; st.cv.width = st.W * d; st.cv.height = st.H * d; st.x.setTransform(d, 0, 0, d, 0, 0); }
  function caption(t) { if (!st) return; st.cap.textContent = t; st.cap.classList.remove('show'); void st.cap.offsetWidth; st.cap.classList.add('show'); }

  // ---------- малювання космосу ----------
  function drawSpace(x, W, H, t, prog) {
    // t — мс від початку космічної фази
    const bg = x.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#02030a'); bg.addColorStop(1, '#0a1226'); x.fillStyle = bg; x.fillRect(0, 0, W, H);
    // туманність
    const ng = x.createRadialGradient(W * 0.2, H * 0.25, 10, W * 0.2, H * 0.25, W * 0.5); ng.addColorStop(0, 'rgba(120,60,160,0.25)'); ng.addColorStop(1, 'rgba(120,60,160,0)'); x.fillStyle = ng; x.fillRect(0, 0, W, H);
    const ng2 = x.createRadialGradient(W * 0.85, H * 0.15, 10, W * 0.85, H * 0.15, W * 0.4); ng2.addColorStop(0, 'rgba(40,110,180,0.2)'); ng2.addColorStop(1, 'rgba(40,110,180,0)'); x.fillStyle = ng2; x.fillRect(0, 0, W, H);
    for (const s of st.stars) { const tw = 0.6 + 0.4 * Math.sin(t * 0.003 + s.p); x.globalAlpha = tw; x.fillStyle = s.c; const sx = ((s.x * W - t * 0.004 * s.s * s.s) % W + W) % W; x.fillRect(sx, s.y * H, s.s, s.s); } x.globalAlpha = 1;
    // планета: великий диск знизу, росте з прогресом
    const R0 = Math.max(W, H) * (0.9 + prog * 0.9); const px = W * 0.62, py = H + R0 * (0.62 - prog * 0.5);
    const c1 = st.pc[0], c2 = st.pc[1];
    // атмосферне сяйво
    const ag = x.createRadialGradient(px, py, R0 * 0.96, px, py, R0 * 1.12); ag.addColorStop(0, 'rgba(120,190,255,0.55)'); ag.addColorStop(0.4, 'rgba(90,150,255,0.18)'); ag.addColorStop(1, 'rgba(90,150,255,0)'); x.fillStyle = ag; x.beginPath(); x.arc(px, py, R0 * 1.12, 0, TAU); x.fill();
    x.save(); x.beginPath(); x.arc(px, py, R0, 0, TAU); x.clip();
    const pg = x.createRadialGradient(px - R0 * 0.35, py - R0 * 0.55, R0 * 0.1, px, py, R0); pg.addColorStop(0, '#b8e0ff'); pg.addColorStop(0.25, c2); pg.addColorStop(0.7, c1); pg.addColorStop(1, '#04060c'); x.fillStyle = pg; x.fillRect(0, 0, W, H);
    // континенти
    const r = U.rng(99); for (let i = 0; i < 26; i++) { const a = r() * TAU, d = r() * R0 * 0.9; const bx = px + Math.cos(a) * d, by = py + Math.sin(a) * d - R0 * 0.35; x.fillStyle = i % 3 ? 'rgba(70,110,60,0.55)' : 'rgba(150,130,80,0.5)'; x.beginPath(); x.ellipse(bx, by, R0 * (0.05 + r() * 0.1), R0 * (0.03 + r() * 0.06), r() * 3, 0, TAU); x.fill(); }
    // хмари
    for (let i = 0; i < 40; i++) { const a = r() * TAU, d = r() * R0 * 0.95; const bx = px + Math.cos(a) * d + t * 0.002 * R0 * 0.01, by = py + Math.sin(a) * d - R0 * 0.3; x.fillStyle = 'rgba(255,255,255,0.28)'; x.beginPath(); x.ellipse(bx, by, R0 * (0.04 + r() * 0.12), R0 * (0.012 + r() * 0.02), r() * 0.8 - 0.4, 0, TAU); x.fill(); }
    // термінатор (тінь)
    const sg = x.createLinearGradient(px - R0, py - R0 * 0.5, px + R0, py + R0 * 0.2); sg.addColorStop(0.45, 'rgba(0,0,10,0)'); sg.addColorStop(1, 'rgba(0,0,10,0.75)'); x.fillStyle = sg; x.fillRect(0, 0, W, H);
    x.restore();
    // яскрава лінія лімба
    x.strokeStyle = 'rgba(190,225,255,0.55)'; x.lineWidth = 2; x.beginPath(); x.arc(px, py, R0, Math.PI * 1.1, Math.PI * 1.8); x.stroke();
    return { px, py, R0 };
  }

  function drawShipAt(x, sx, sy, scale, ang, flame, t) {
    x.save(); x.translate(sx, sy); x.rotate(ang); x.scale(scale, scale); x.translate(-120, -50);
    x.globalCompositeOperation = 'lighter'; drawFlame(x, flame, t, 1); x.globalCompositeOperation = 'source-over';
    x.drawImage(SHIP, 0, 0); x.restore();
  }

  // ---------- оновлення ----------
  C.update = function () {
    if (!st) return; const now = performance.now(); const el = now - st.t0; const W = st.W, H = st.H, x = st.x;
    if (st.phase === 'space' || st.phase === 'entry') {
      x.globalAlpha = 1;
      if (st.phase === 'space') {
        const T = 6000; const p = Math.min(1, el / T);
        drawSpace(x, W, H, el, p * 0.45);
        // корабель пролітає зліва направо-вниз
        const sx = W * (0.08 + 0.52 * easeOut(p)), sy = H * (0.22 + 0.2 * p); const sc = (0.55 + 0.35 * p) * Math.min(1, W / 1100 + 0.35);
        // слід
        x.globalCompositeOperation = 'lighter'; const tg = x.createLinearGradient(sx - 400 * sc, 0, sx, 0); tg.addColorStop(0, 'rgba(120,180,255,0)'); tg.addColorStop(1, 'rgba(160,210,255,0.25)'); x.fillStyle = tg; x.fillRect(sx - 400 * sc, sy - 18 * sc, 400 * sc, 36 * sc); x.globalCompositeOperation = 'source-over';
        drawShipAt(x, sx, sy, sc, 0.18 + p * 0.25, 60 + 40 * p, el * 0.02);
        if (el > 3200 && st.capT !== 'b') { st.capT = 'b'; caption('Двигуни ледь працюють. Паливо закінчується… Гравітація затягує корабель.'); }
        if (el > T) { st.phase = 'entry'; st.t1 = now; caption('ВХІД В АТМОСФЕРУ! Щити не витримують!'); if (RW.A) try { RW.A.sfx('rumble'); } catch (e) { } }
      } else {
        const e2 = now - st.t1; const T = 3600; const p = Math.min(1, e2 / T);
        const info = drawSpace(x, W, H, el, 0.45 + p * 0.55);
        // атмосфера червоніє знизу
        const hg = x.createLinearGradient(0, H * (1 - p * 0.9), 0, H); hg.addColorStop(0, 'rgba(255,120,40,0)'); hg.addColorStop(1, 'rgba(255,150,60,' + (0.25 + p * 0.45) + ')'); x.fillStyle = hg; x.fillRect(0, 0, W, H);
        const sx = W * (0.6 + 0.1 * p) + (Math.random() - 0.5) * 6 * p, sy = H * (0.42 + 0.2 * p) + (Math.random() - 0.5) * 6 * p; const sc = (0.9 + 0.5 * p) * Math.min(1, W / 1100 + 0.35); const ang = 0.5 + p * 0.5;
        // плазма
        x.globalCompositeOperation = 'lighter';
        const pg = x.createRadialGradient(sx + 90 * sc, sy + 20 * sc, 5, sx + 90 * sc, sy + 20 * sc, 190 * sc); pg.addColorStop(0, 'rgba(255,240,200,0.9)'); pg.addColorStop(0.3, 'rgba(255,150,50,0.55)'); pg.addColorStop(1, 'rgba(255,60,10,0)'); x.fillStyle = pg; x.beginPath(); x.arc(sx + 90 * sc, sy + 20 * sc, 190 * sc, 0, TAU); x.fill();
        // смуги вогню
        x.strokeStyle = 'rgba(255,190,90,0.6)'; x.lineWidth = 2; const rr = U.rng((el / 60) | 0); for (let i = 0; i < 26; i++) { const ox = (rr() - 0.5) * 260 * sc, oy = (rr() - 0.5) * 120 * sc; const L = (160 + rr() * 360) * sc; x.beginPath(); x.moveTo(sx + ox, sy + oy); x.lineTo(sx + ox - Math.cos(ang) * L, sy + oy - Math.sin(ang) * L); x.stroke(); }
        x.globalCompositeOperation = 'source-over';
        drawShipAt(x, sx, sy, sc, ang, 130 + 60 * p, el * 0.03);
        // іскри
        x.globalCompositeOperation = 'lighter'; for (let i = 0; i < 40; i++) { x.fillStyle = i % 2 ? '#ffd070' : '#ff7a30'; const a = rr() * 3 + 3.5; const d = rr() * 300 * sc; x.fillRect(sx + Math.cos(ang + Math.PI) * d + (rr() - 0.5) * 80, sy + Math.sin(ang + Math.PI) * d + (rr() - 0.5) * 80, 2.5, 2.5); } x.globalCompositeOperation = 'source-over';
        // дим
        if (e2 > 1500 && st.capT !== 'c') { st.capT = 'c'; caption('Корабель втрачає керування…'); }
        if (p > 0.82) { const f = (p - 0.82) / 0.18; x.fillStyle = 'rgba(255,248,230,' + f + ')'; x.fillRect(0, 0, W, H); }
        if (e2 > T) beginFall();
      }
    } else if (st.phase === 'fall') updateFall(now);
    else if (st.phase === 'crash' || st.phase === 'exit') updateGround(now);
  };

  const easeOut = p => 1 - Math.pow(1 - p, 2);

  // ---------- падіння в ігровому світі ----------
  function beginFall() {
    const g = st.g, R = RW.R; st.phase = 'fall'; st.tf = performance.now(); st.cv.style.transition = 'opacity .9s'; st.cv.style.opacity = '0'; st.dom.querySelector('#cs-skip').style.opacity = '0.85';
    R.cam.x = st.wp[0] + 2.5; R.cam.y = st.wp[1] + 1.6; R.cam.zoom = 1.1;
    st.ix = st.wp[0] + 2.5; st.iy = st.wp[1] + 2; // точка удару
    R.cutDraw = drawFallShip; caption('Земля наближається!');
    setTimeout(() => { if (st && st.phase !== 'done') st.cv.style.display = 'none'; }, 950);
  }
  function updateFall(now) {
    const e = now - st.tf; const T = 2300; const R = RW.R; const p = Math.min(1, e / T);
    st.fp = p; R.shake = Math.max(R.shake, 2 + p * 3);
    // слід диму
    const pos = fallPos(p); if (e % 2 < 1) { R.fx.smoke(pos.x - 0.8, pos.y - 0.6, '#555'); if (Math.random() < 0.7) R.fx.spark(pos.x - 1.2, pos.y - 0.8); }
    if (p >= 1) crash();
  }
  function fallPos(p) { const q = p * p * 0.7 + p * 0.3; return { x: st.ix - 22 * (1 - q), y: st.iy - 30 * (1 - q), s: 3 - 2 * q + (1 - p) * 1.5 }; }
  function drawFallShip(ctx, TS) {
    if (!st || st.phase !== 'fall') return; const p = st.fp || 0; const pos = fallPos(p); const sc = pos.s * (TS / 100) * 1.55;
    ctx.save(); ctx.translate(pos.x * TS, pos.y * TS); ctx.rotate(0.95 + p * 0.25); ctx.scale(sc, sc); ctx.translate(-120, -50);
    ctx.globalCompositeOperation = 'lighter'; drawFlame(ctx, 120 + Math.random() * 30, R_time(), 1.1); ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(SHIP, 0, 0); ctx.restore();
    // тінь на землі
    ctx.fillStyle = 'rgba(0,0,0,' + (0.1 + p * 0.28) + ')'; ctx.beginPath(); ctx.ellipse(st.ix * TS + 10 * (1 - p), st.iy * TS + 20, (60 + 40 * p) * TS / 32, 12 * TS / 32, 0, 0, TAU); ctx.fill();
  }
  function R_time() { return performance.now() * 0.03; }

  function crash() {
    const g = st.g, R = RW.R, map = g.map; st.phase = 'crash'; st.tc = performance.now(); R.cutDraw = null;
    R.shake = 36; R.fx.dust(st.ix, st.iy, 60); R.fx.ring(st.ix, st.iy, 9, '#ffcf80'); R.fx.ring(st.ix, st.iy, 5, '#fff'); 
    for (let k = 0; k < 40; k++) R.fx.spark(st.ix + (Math.random() - 0.5) * 6, st.iy + (Math.random() - 0.5) * 3);
    if (RW.A) try { RW.A.sfx('crash'); setTimeout(() => RW.A.sfx('crash'), 280); } catch (e) { }
    map.decals && map.decals.push({ x: st.ix, y: st.iy, r: 3.8, t: 'scorch', a: 0.55 });
    try { st.wreck = map.addBuilding('ship_wreck', st.wp[0], st.wp[1], 0); } catch (e) { st.wreck = null; }
    g.flash = 12; if (map.allDirty !== undefined) map.allDirty = true;
    caption('Удар! Корабель розбито, але ви вижили…');
    st.fireT = 0;
  }

  function updateGround(now) {
    const g = st.g, R = RW.R; const e = now - st.tc;
    // димлячі уламки
    st.smokeT++; if (st.smokeT % 5 === 0 && e < 22000) { R.fx.smoke(st.wp[0] + 2.2 + Math.random() * 0.8, st.wp[1] + 1.2); if (Math.random() < 0.4) R.fx.smoke(st.wp[0] + 3.6, st.wp[1] + 0.9); }
    if (st.smokeT % 9 === 0 && Math.random() < 0.6) R.fx.spark(st.wp[0] + 2.4 + Math.random() * 0.6, st.wp[1] + 1.4);
    if (st.phase === 'crash' && e > 2600) { st.phase = 'exit'; st.te = now; st.lastEmerge = now - 700; caption('Люк відчиняється… Вибираємося назовні!'); R.fx.steam(st.hx, st.hy - 0.5); R.fx.dust(st.hx, st.hy, 8); }
    if (st.phase === 'exit') {
      if (st.emerged < st.crew.length && now - st.lastEmerge > 1050) {
        const p = st.crew[st.emerged]; const tg = st.spots[st.emerged % st.spots.length] || [st.hx, st.hy + 3]; p.x = st.hx + (st.emerged % 2 ? 0.4 : -0.4); p.y = st.hy - 0.6; p.face = 0; p.csx = tg[0] + 0.5; p.csy = tg[1] + 0.5; p.moving = true; p.phase = p.phase || 0; p.sleeping = false;
        g.pawns.push(p); st.walkers.push(p); st.emerged++; st.lastEmerge = now; R.fx.dust(p.x, p.y, 4);
        const nm = p.name && (p.name.nick || p.name.first || p.name.full || (typeof p.name === 'string' ? p.name : ''));
        if (st.emerged === 1) caption((nm ? nm + ' першим' : 'Перший') + ' вибирається з-під уламків.'); else if (st.emerged === st.crew.length) caption('Усі живі. Це тепер ваш новий дім.');
      }
      for (const p of st.walkers) { if (p.csx == null) continue; const dx = p.csx - p.x, dy = p.csy - p.y, d = Math.hypot(dx, dy); if (d < 0.08) { p.x = p.csx; p.y = p.csy; p.csx = null; p.moving = false; p.addThought && p.addThought('new_world'); continue; } const sp = 0.045; p.x += dx / d * sp; p.y += dy / d * sp; p.phase += sp * 3.2; p.moving = true; if (Math.abs(dx) > Math.abs(dy)) p.face = dx > 0 ? 1 : 3; else p.face = dy > 0 ? 0 : 2; }
      // камера повільно слідує
      R.cam.x += (st.wp[0] + 2.8 - R.cam.x) * 0.03; R.cam.y += (st.wp[1] + 3.2 - R.cam.y) * 0.03; R.cam.zoom += (1.5 - R.cam.zoom) * 0.02;
      if (st.emerged >= st.crew.length && st.walkers.every(p => p.csx == null) && now - st.lastEmerge > 1600) finish(false);
    }
  }

  function finish(skipped) {
    if (!st || st.done) return; st.done = true; const g = st.g, R = RW.R, map = g.map;
    if (skipped) {
      if (!st.wreck && !st.phase.match(/crash|exit/)) { R.cutDraw = null; try { st.wreck = map.addBuilding('ship_wreck', st.wp[0], st.wp[1], 0); } catch (e) { } map.decals && map.decals.push({ x: st.ix || st.wp[0] + 2.5, y: st.iy || st.wp[1] + 2, r: 3.8, t: 'scorch', a: 0.55 }); if (map.allDirty !== undefined) map.allDirty = true; }
      st.crew.forEach((p, i) => { if (!g.pawns.includes(p)) { const tg = st.spots[i % st.spots.length] || [st.hx, st.hy + 3]; p.x = tg[0] + 0.5; p.y = tg[1] + 0.5; p.addThought && p.addThought('new_world'); g.pawns.push(p); } p.csx = null; p.moving = false; });
      R.cam.x = st.wp[0] + 2.8; R.cam.y = st.wp[1] + 3.2; R.cam.zoom = 1.4;
    }
    // вантаж
    let li = 0; for (const k of st.lootList) { const s = st.spots[(li + 3) % st.spots.length]; li++; const sx = s[0] + (li % 2 ? 2 : -2), sy = s[1] + 1; try { map.addItem(k, g.scenario.items[k], sx, sy, { forbid: true }); } catch (e) { } R.fx.dust(sx + 0.5, sy + 0.5, 4); }
    window.removeEventListener('keydown', st.keyH, true); window.removeEventListener('resize', resize);
    const dom = st.dom, cb = st.onDone; R.cutDraw = null; st = null;
    dom.classList.add('out'); setTimeout(() => dom.remove(), 700);
    const ui = document.getElementById('ui'); ui && ui.classList.remove('hidden');
    cb && cb();
  }
  function skip() { finish(true); }
})();
