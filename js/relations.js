// ============================================================
//  relations.js — родичі, заручини, весілля, вечірки, зрада, розлучення
// ============================================================
(function () {
  'use strict';
  const RW = window.RW; const D = RW.D, U = RW.U, AI = RW.AI; const G = () => RW.G; const DY = D.DAY, HR = D.HOUR;
  const Rel = RW.Rel = {};
  const L = RW.Life;
  const cols = g => g.pawns.filter(p => p.faction === 'colony' && !p.dead);
  const byId = (g, id) => g.pawns.find(p => p.id === id);
  const name = U.shortName;
  const LABEL = { friend: 'Друг', lover: 'Коханий(а)', rival: 'Ворог', spouse: 'Чоловік/дружина', fiance: 'Наречений(а)', kin: 'Родич', ex: 'Колишній(я)' };
  Rel.LABEL = LABEL;
  const COLOR = { friend: '#7ad07a', lover: '#ff6a9a', rival: '#e0584a', spouse: '#ffc84a', fiance: '#ff9ac0', kin: '#8ab8ff', ex: '#9a8a8a' };
  Rel.COLOR = COLOR;

  // ---- Родичі на старті ----
  Rel.initKin = function (g) {
    const cs = cols(g); if (cs.length < 2) return;
    const a = cs[0], b = cs[1];
    if (Math.random() < 0.55) {
      const sib = Math.random() < 0.7; a.rel[b.id] = 'kin'; b.rel[a.id] = 'kin'; a.kinT = a.kinT || {}; b.kinT = b.kinT || {}; a.kinT[b.id] = sib ? 'sib' : 'cousin'; b.kinT[a.id] = a.kinT[b.id];
      a.opinion[b.id] = 35; b.opinion[a.id] = 35; if (sib) { b.name.last = a.name.last; }
    }
  };
  Rel.kinLabel = (p, o) => (p.kinT && p.kinT[o.id] === 'sib' ? (o.gender === 'F' ? 'Сестра' : 'Брат') : 'Двоюрідний(а)');

  const origUpd = RW.Social.updateRel;
  RW.Social.updateRel = function (a, b) {
    const cur = a.rel[b.id];
    if (cur === 'spouse' || cur === 'fiance' || cur === 'kin') { return; }
    if (cur === 'ex') { if ((a.opinion[b.id] || 0) > 30) delete a.rel[b.id]; return; }
    return origUpd.call(this, a, b);
  };
  // ---- Допоміжні ----
  function partnerOf(p) { for (const k in p.rel) if (p.rel[k] === 'lover' || p.rel[k] === 'fiance' || p.rel[k] === 'spouse') return +k; return null; }
  Rel.partnerOf = partnerOf;
  function setRel(a, b, t) { if (t) { a.rel[b.id] = t; b.rel[a.id] = t; } else { delete a.rel[b.id]; delete b.rel[a.id]; } }
  function heartsOn(a, b, n) { if (RW.FX2) RW.FX2.burst('heart', (a.x + b.x) / 2, Math.min(a.y, b.y) - 0.6, n || 3); }

  // ---- Серця при спілкуванні закоханих ----
  const origInter = RW.Social.interact;
  RW.Social.interact = function (a, b) {
    const r = origInter.call(this, a, b);
    if (['lover', 'spouse', 'fiance'].includes(a.rel[b.id]) && (r === 'chat' || r === 'deep')) { heartsOn(a, b, r === 'deep' ? 4 : 2); a.addThought('in_love'); }
    else if (r === 'deep' && RW.FX2) RW.FX2.emit('sparkle', (a.x + b.x) / 2, a.y - 0.7);
    // зрада: у стосунках хтось флірутує з третім
    const g = G(); const pa = partnerOf(a);
    if (pa && pa !== b.id && (r === 'chat' || r === 'deep') && RW.Social.op(a, b) > 50 && RW.Social.op(b, a) > 45 && !partnerOf(b) && Math.random() < 0.05 && a.age >= 18 && b.age >= 18 && a.rel[b.id] !== 'kin') {
      const sp = byId(g, pa);
      if (sp) {
        a.addThought('in_love'); sp.addThought('cheated'); RW.Social.change(sp, a, -35); RW.Social.change(sp, b, -25);
        a.addLog('Закрутив(ла) інтрижку з ' + name(b)); sp.addLog(name(a) + ' зрадив(ла) мене з ' + name(b));
        L.bubble(sp, '💔', 500); RW.FX2 && RW.FX2.emit('anger', sp.x, sp.y - 0.8);
        RW.UI && RW.UI.letter('Зрада', U.fullName(a) + ' зрадив(ла) ' + U.fullName(sp) + ' з ' + U.fullName(b) + '.', 'bad', sp);
        if (a.rel[sp.id] === 'spouse') Rel.divorce(a, sp, true); else { setRel(a, sp, 'ex'); }
        setRel(a, b, 'lover');
      }
    }
    return r;
  };
  Rel.divorce = function (a, b, silent) {
    const was = a.rel[b.id]; setRel(a, b, 'ex'); a.addThought('divorced'); b.addThought('divorced');
    a.opinion[b.id] = Math.min(a.opinion[b.id] || 0, -10); b.opinion[a.id] = Math.min(b.opinion[a.id] || 0, -10);
    if (!silent) RW.UI && RW.UI.letter('Розлучення', U.fullName(a) + ' та ' + U.fullName(b) + ' розлучилися.', 'bad', a);
  };

  // ---- Заручини ----
  Rel.propose = function (a, b) {
    const g = G(); const oa = RW.Social.op(b, a);
    const chance = U.clamp((oa - 40) / 70 + (b.mood > 50 ? 0.15 : -0.1), 0.15, 0.92);
    L.bubble(a, '🌹', 420); L.bubble(b, '💭', 420);
    if (RW.FX2) { RW.FX2.burst('sparkle', a.x, a.y - 0.6, 6); }
    if (Math.random() < chance) {
      setRel(a, b, 'fiance'); a.addThought('engaged'); b.addThought('engaged'); a.addLog('Освідчився(лась) ' + name(b) + ' — «Так!»'); b.addLog('Прийняв(ла) освідчення ' + name(a));
      heartsOn(a, b, 8); RW.A && RW.A.sfx('good');
      RW.UI && RW.UI.letter('Заручини!', U.fullName(a) + ' освідчився(лась) ' + U.fullName(b) + ' — і отримав(ла) згоду. Весілля буде за кілька днів!', 'good', a);
      const e = L.ensure(g); const day = D.relDay(g.tick); e.wedding = { a: a.id, b: b.id, day: day + 2, phase: 'wait' };
    } else {
      a.addThought('rejected'); L.bubble(a, '💔', 420); RW.Social.change(a, b, -8); a.addLog(name(b) + ' відмовив(ла) мені.'); b.addLog('Відмовив(ла) ' + name(a));
      RW.UI && RW.UI.toast(name(b) + ' відмовив(ла) ' + name(a), 'bad'); a.proposeCool = g.tick + 4 * DY;
    }
  };

  // ---- Свято (весілля/вечірка) ----
  function findSpot(g) {
    const map = g.map; const hx = Math.floor(g.home.x), hy = Math.floor(g.home.y);
    for (let r = 2; r < 14; r++) for (let k = 0; k < 20; k++) {
      const x = hx + U.ri(-r, r), y = hy + U.ri(-r, r); if (x < 3 || y < 3 || x >= map.w - 3 || y >= map.h - 3) continue; const i = y * map.w + x;
      if (map.cost[i] > 0 && map.region[i] === map.region[hy * map.w + hx]) return { x, y };
    }
    return { x: hx, y: hy };
  }
  Rel.startParty = function (kind, ids) {
    const g = G(); const e = L.ensure(g); if (e.party) return false;
    const spot = findSpot(g);
    e.party = { kind, x: spot.x, y: spot.y, t0: g.tick, gather: g.tick + 900, end: g.tick + 900 + 1500, ids: ids || [], phase: 'gather', g: 0 };
    RW.UI && RW.UI.letter(kind === 'wedding' ? 'Весілля' : 'Вечірка', kind === 'wedding' ? 'Колоністи збираються на весілля.' : 'Колоністи збираються на вечірку.', 'good', null, { x: spot.x, y: spot.y });
    return true;
  };
  AI.RUN.party = function (p, j) {
    const g = G(); const e = L.ensure(g); const pt = e.party; if (!pt || g.tick > pt.end) return 'done';
    const sx = j.sx, sy = j.sy;
    if (!j.at) {
      const r = AI.moveTo(p, sx, sy, { adj: true }); if (r === 'fail') return 'fail';
      if (r === 'arrived' || Math.hypot(p.x - sx - 0.5, p.y - sy - 0.5) < 1.8) { j.at = true; AI.resetMove(p); } return;
    }
    p.moving = false; const sp = pt.phase === 'wed' ? 0.55 : 1; const cx = sx + 0.5, cy = sy + 0.5; AI.faceTo(p, cx, cy);
    p.needs.joy = Math.min(1, (p.needs.joy || 0) + 0.00018);
    if (g.tick % 70 === (p.id * 7) % 70 && RW.FX2) RW.FX2.emit(Math.random() < 0.5 ? 'note' : 'sparkle', p.x, p.y - 0.6);
  };
  Rel.tickParty = function (g) {
    const e = L.ensure(g); const pt = e.party;
    if (!e.wedding && !pt && g.tick % DY === 3000 && Math.random() < 0.14 && cols(g).length >= 3 && g.tick > 3 * DY) Rel.startParty('party');
    if (e.wedding && e.wedding.phase === 'wait' && !pt && D.relDay(g.tick) >= e.wedding.day && D.hour(g.tick) >= 9) {
      const a = byId(g, e.wedding.a), b = byId(g, e.wedding.b);
      if (!a || !b || a.dead || b.dead) { e.wedding = null; } else { e.wedding.phase = 'go'; Rel.startParty('wedding', [a.id, b.id]); }
    }
    if (!pt) return;
    const guests = cols(g).filter(p => !p.mental && !p.downed && !p.drafted);
    // збір
    if (g.tick % 60 === 0 && pt.phase !== 'done') {
      for (const p of guests) {
        if (p.job && p.job.type === 'party') continue; if (p.sleeping && p.needs.rest < 0.25) continue; if (p.needs.food < 0.12) continue;
        if (p.job && ['tend', 'rescue', 'surgery', 'patient'].includes(p.job.type)) continue;
        const ax = pt.x + U.ri(-2, 2), ay = pt.y + U.ri(-2, 2);
        if (g.map.cost[ay * g.map.w + ax] > 0 && g.map.reachable(p.tx, p.ty, ax, ay, true)) { if (p.sleeping) { p.sleeping = false; } AI.setJob(p, { type: 'party', sx: ax, sy: ay }); }
      }
    }
    // фаза церемонії
    if (g.tick >= pt.gather && pt.phase === 'gather') {
      pt.phase = pt.kind === 'wedding' ? 'wed' : 'fun'; pt.cer = g.tick;
      if (pt.kind === 'wedding') {
        const a = byId(g, pt.ids[0]), b = byId(g, pt.ids[1]);
        if (a && b) { for (const q of [a, b]) { q.job && AI.endJob(q); } const cx = pt.x, cy = pt.y; AI.setJob(a, { type: 'party', sx: cx, sy: cy, at: false }); AI.setJob(b, { type: 'party', sx: cx + 1, sy: cy, at: false }); }
      }
    }
    if (pt.phase === 'wed' && g.tick >= pt.cer + 500) {
      const a = byId(g, pt.ids[0]), b = byId(g, pt.ids[1]);
      if (a && b) {
        setRel(a, b, 'spouse'); a.addThought('got_married'); b.addThought('got_married'); a.addLog('Одружився(лась) з ' + name(b)); b.addLog('Одружився(лась) з ' + name(a));
        RW.Social.change(a, b, 25); RW.Social.change(b, a, 25);
        for (const q of guests) if (q !== a && q !== b) q.addThought('wedding_guest');
        for (let k = 0; k < 3; k++) setTimeout(() => RW.FX2 && RW.FX2.burst('confetti', pt.x + 0.5, pt.y, 26), k * 350);
        RW.FX2 && RW.FX2.burst('heart', pt.x + 0.5, pt.y - 0.4, 10); RW.A && RW.A.sfx('research');
        RW.UI && RW.UI.letter('Весілля!', U.fullName(a) + ' та ' + U.fullName(b) + ' одружилися! Усі в захваті.', 'good', a, { x: pt.x, y: pt.y }); e.wedding = null;
        pt.phase = 'fun';
      }
    }
    if (pt.phase === 'fun' && g.tick % 150 === 0 && RW.FX2) RW.FX2.burst('confetti', pt.x + 0.5, pt.y, 6);
    if (g.tick > pt.end) {
      for (const p of cols(g)) { if (p.job && p.job.type === 'party') AI.endJob(p); if (pt.kind === 'party' && Math.hypot(p.x - pt.x, p.y - pt.y) < 8) p.addThought('party'); }
      e.party = null; e.partyCool = g.tick + 2 * DY;
    }
  };
  Rel.drawParty = function (c, TS, t) {
    const g = G(); const e = g.ext && g.ext.party; if (!e || e.phase === 'gather' && g.tick < e.t0 + 60) return;
    const cx = (e.x + 0.5) * TS, cy = (e.y + 0.5) * TS; c.save();
    // килимок + гірлянда
    c.fillStyle = e.kind === 'wedding' ? 'rgba(200,60,90,0.35)' : 'rgba(240,190,70,0.28)'; c.beginPath(); c.ellipse(cx, cy + 4, 54, 28, 0, 0, 6.3); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.3)'; c.lineWidth = 1.2; c.setLineDash([3, 4]); c.beginPath(); c.ellipse(cx, cy + 4, 56, 30, 0, 0, 6.3); c.stroke(); c.setLineDash([]);
    const cl = ['#f2c14e', '#e0607e', '#5ab0e8', '#7ad07a', '#c88af0'];
    for (let k = 0; k < 14; k++) { const a = k / 14 * 6.283 + t * 0.01; const x = cx + Math.cos(a) * 56, y = cy + 4 + Math.sin(a) * 30; c.fillStyle = cl[k % 5]; c.globalAlpha = 0.7 + 0.3 * Math.sin(t * 0.1 + k); c.beginPath(); c.arc(x, y, 2.4, 0, 6.3); c.fill(); }
    if (e.kind === 'wedding') { // арка
      c.globalAlpha = 1; c.strokeStyle = '#e9e2d0'; c.lineWidth = 3; c.beginPath(); c.moveTo(cx - 18, cy - 4); c.lineTo(cx - 18, cy - 30); c.bezierCurveTo(cx - 18, cy - 48, cx + 18, cy - 48, cx + 18, cy - 30); c.lineTo(cx + 18, cy - 4); c.stroke();
      for (let k = 0; k < 9; k++) { const a = Math.PI + k / 8 * Math.PI; const x = cx + Math.cos(a) * 18, y = cy - 30 + Math.sin(a) * 18; c.fillStyle = k % 2 ? '#ff7aa8' : '#fff'; c.beginPath(); c.arc(x, y, 3, 0, 6.3); c.fill(); }
    }
    c.restore();
  };
  // ---- Щоденні події ----
  Rel.daily = function (g) {
    const cs = cols(g);
    for (const a of cs) {
      if ((a.proposeCool || 0) > g.tick) continue;
      const pid = null; for (const k in a.rel) {
        if (a.rel[k] !== 'lover') continue; const b = byId(g, +k); if (!b || b.rel[a.id] !== 'lover' || a.id > b.id) continue;
        if (RW.Social.op(a, b) > 72 && RW.Social.op(b, a) > 65 && !L.ensure(g).wedding && Math.random() < 0.22 && !a.mental && !b.mental) Rel.propose(a, b);
        else if (RW.Social.op(a, b) < 25 && Math.random() < 0.3) { setRel(a, b, 'ex'); a.addThought('heartbreak'); b.addThought('heartbreak'); }
      }
      for (const k in a.rel) if (a.rel[k] === 'spouse') { const b = byId(g, +k); if (b && RW.Social.op(a, b) < -20 && RW.Social.op(b, a) < -10 && Math.random() < 0.3) Rel.divorce(a, b); }
    }
  };
  Rel.tick = function (g) { if (g.tick % 30 === 0) Rel.tickParty(g); if (g.tick % DY === 600) Rel.daily(g); };
  const lt = L.tick; L.tick = function (g) { lt(g); Rel.tick(g); };
  // смерть чоловіка/дружини
  Rel.onDeath = function (dead, o) { const t = dead.rel[o.id] || o.rel[dead.id]; if (t === 'spouse' || t === 'fiance') o.addThought('spouse_died'); else if (t === 'kin') o.addThought('kin_died'); };
})();
