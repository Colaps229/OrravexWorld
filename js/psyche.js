'use strict';
// ============================================================
//  psyche.js — «Душа колоністів» (v0.9.0)
//   1) Конфлікти: сварки, дуелі до першої крові, дружні бійки
//   2) Хобі й творчий настрій (порив натхнення / творча криза)
//   3) Спогади й травми, церемонія пам'яті зі свічками
//   4) Особисті цілі з постійними нагородами
//   5) Листи додому: паперовий літачок туди, голуб із відповіддю назад
//  Усі числа — в об'єкті PS, баланс підкручується в одному місці.
// ============================================================
(function () {
  const D = RW.D, U = RW.U, DY = D.DAY; const G = () => RW.G; const AI = RW.AI, C = RW.Combat, P = RW.Pawn.prototype;
  const PS = RW.Psyche = {
    DUEL_OP: -55, QUARREL_OP: -35, DUEL_CH: 0.3, QUARREL_CH: 0.45, BRAWL_CH: 0.05, CONF_COOL_DAYS: 2,
    HOBBY_DAY_CH: 0.2, HOBBY_MOOD: 78, BLOCK_MOOD: 32, BLOCK_CH: 0.3, BLOCK_SLOW: 0.88,
    PERK_MOOD: 2, PERK_WORK: 0.03, PERK_MAX: 4,
    LETTER_MIN: 7, LETTER_MAX: 12, REPLY_MIN: 4, REPLY_MAX: 8
  };
  const SK = { shooting: 'Стрільба', melee: 'Ближній бій', construction: 'Будівництво', mining: 'Видобуток', cooking: 'Кулінарія', plants: 'Рослинництво', medicine: 'Медицина', crafting: 'Ремесло', research: 'Дослідження', social: 'Спілкування' };
  const HOB = { construction: ['build'], mining: ['mine'], plants: ['sow', 'harvest', 'chop'], research: ['research'], crafting: ['bill'], cooking: ['bill'], shooting: ['hunt'], medicine: ['tend', 'surgery'], social: ['chat'], melee: [] };
  const HOB_ICO = { construction: '🔨', mining: '⛏', plants: '🌱', research: '🔬', crafting: '🧵', cooking: '🍲', shooting: '🏹', medicine: '💊', social: '💬', melee: '🥊' };
  PS.SK = SK;
  const dayN = g => D.relDay(g.tick);
  const cols = g => g.pawns.filter(p => p.faction === 'colony' && !p.dead && !p.isChild);
  const ex = g => { const e = (g.ext = g.ext || {}); return (e.psy = e.psy || { duel: null, cool: -99, memorials: [], replies: [] }); };
  const ps = p => (p.psy = p.psy || { hobby: null, goal: null, perks: 0, mem: [], block: 0, next: -1, calm: 0, goals: 0, wrote: 0 });
  const fx2 = (t, x, y, o) => RW.FX2 && RW.FX2.emit(t, x, y, o), burst = (t, x, y, n, o) => RW.FX2 && RW.FX2.burst(t, x, y, n, o);
  const bubble = (p, s, d) => RW.Life && RW.Life.bubble && RW.Life.bubble(p, s, d || 400);
  const free = p => !p.sleeping && !p.downed && !p.drafted && !p.mental && !p.dead && !(p.job && ['tend', 'rescue', 'surgery', 'patient', 'party'].includes(p.job.type));
  const injN = p => p.injuries.reduce((s, i) => s + i.amt, 0);
  const T = (id, l, v, days) => { D.thoughts[id] = { l, v, dur: days * DY }; };
  T('quarrel', 'Посварився(лась)', -6, 2); T('duel_won', 'Переміг(ла) на дуелі', 8, 3); T('duel_lost', 'Програв(ла) дуель', -8, 3); T('duel_draw', 'Дуель закінчилась нічиєю', -1, 1);
  T('brawl_fun', 'Дружня бійка — весело!', 6, 2); T('hobby_joy', 'Займався(лась) улюбленою справою', 5, 1); T('creative_burst', 'Творчий порив!', 10, 1.5);
  T('creative_block', 'Творча криза', -6, 1); T('goal_done', 'Мета досягнута!', 12, 5); T('letter_home', 'Лист від рідних', 7, 3); T('letter_cold', 'Короткий лист з дому', 2, 2);
  T('homesick', 'Сумує за домом', -6, 3); T('memorial_done', 'Попрощався(лась) на церемонії', 8, 4); T('ptsd', 'Тривога: спогади про біду', -4, 0.5);
  T('trauma', 'Згадує, як ледь не загинув(ла)', -5, 6); T('letter_sent', 'Написав(ла) додому', 3, 1);

  // ======================================================================
  //  АНІМАЦІЇ (малюються у світі): літачок, голуб, свічки, сутичка
  // ======================================================================
  const anims = [];
  function envelope(c, x, y, rot, a) {
    c.save(); c.translate(x, y); c.rotate(rot); c.globalAlpha = a;
    c.fillStyle = '#f6f1e2'; c.strokeStyle = '#8a7a5a'; c.lineWidth = 1; c.fillRect(-7, -5, 14, 10); c.strokeRect(-7, -5, 14, 10);
    c.beginPath(); c.moveTo(-7, -5); c.lineTo(0, 1); c.lineTo(7, -5); c.stroke(); c.fillStyle = '#d6504a'; c.beginPath(); c.arc(0, 1, 1.8, 0, 6.3); c.fill(); c.restore();
  }
  function dove(c, x, y, t, a, dir) {
    c.save(); c.translate(x, y); c.scale(dir, 1); c.globalAlpha = a; const w = Math.sin(t * 0.5) * 7;
    c.fillStyle = '#fff'; c.strokeStyle = 'rgba(120,130,150,.8)'; c.lineWidth = 0.8;
    c.beginPath(); c.ellipse(0, 0, 7, 3.6, 0, 0, 6.3); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-1, -1); c.quadraticCurveTo(-5, -10 - w, -10, -3 - w * 0.4); c.quadraticCurveTo(-5, -2, -1, -1); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(1, 0); c.quadraticCurveTo(5, 8 + w * 0.3, 9, 3 + w * 0.3); c.quadraticCurveTo(4, 1, 1, 0); c.fill();
    c.beginPath(); c.arc(7, -1.6, 2, 0, 6.3); c.fill(); c.fillStyle = '#f3a33a'; c.beginPath(); c.moveTo(9, -1.6); c.lineTo(12, -1); c.lineTo(9, -0.6); c.fill();
    c.fillStyle = '#222'; c.fillRect(7.5, -2.3, 1, 1); c.restore();
  }
  function flame(c, x, y, t, k) { const f = 1 + Math.sin(t * 0.3 + k * 2.1) * 0.25; c.fillStyle = 'rgba(255,210,110,.95)'; c.beginPath(); c.ellipse(x, y, 1.8, 3.4 * f, 0, 0, 6.3); c.fill(); c.fillStyle = 'rgba(255,120,40,.9)'; c.beginPath(); c.ellipse(x, y + 1, 1, 2 * f, 0, 0, 6.3); c.fill(); }
  function drawWorld(c, TS, map, x0, y0, x1, y1, time) {
    const g = G(); if (!g) return;
    for (let k = anims.length - 1; k >= 0; k--) {
      const a = anims[k]; a.t++;
      if (a.k === 'send') { // літачок вилітає вгору-вправо
        const u = a.t / a.life; if (u >= 1) { anims.splice(k, 1); continue; }
        const x = (a.x + u * 14) * TS, y = (a.y - 0.6 - Math.sin(u * 3.14) * 1.2 - u * 9) * TS;
        envelope(c, x, y, -0.5 + Math.sin(a.t * 0.15) * 0.2, Math.min(1, (1 - u) * 2.2)); if (a.t % 4 === 0) fx2('sparkle', x / TS, y / TS, { c: '#fff2c0' });
      } else if (a.k === 'dove') { // голуб приносить відповідь
        const p = a.p; if (!p || p.dead) { anims.splice(k, 1); continue; }
        const u = Math.min(1, a.t / a.life); const e = 1 - Math.pow(1 - u, 2.2);
        const x = (a.sx + (p.x - a.sx) * e) * TS, y = (a.sy + (p.y - 0.7 - a.sy) * e - Math.sin(u * 3.14) * 1.4) * TS;
        dove(c, x, y, a.t, 1, p.x > a.sx ? 1 : -1);
        if (u < 1) { if (a.t % 5 === 0) fx2('sparkle', x / TS, y / TS, { c: '#ffffff' }); }
        else { if (a.t === Math.ceil(a.life) + 0 || !a.landed) { a.landed = true; envelope(c, p.x * TS, (p.y - 0.8) * TS, 0, 1); a.hold = 40; } a.hold--; envelope(c, p.x * TS, (p.y - 1.0 - (40 - a.hold) * 0.012) * TS, Math.sin(a.t * 0.1) * 0.2, Math.max(0, a.hold / 40)); dove(c, (p.x + (40 - a.hold) * 0.12) * TS, (p.y - 0.8 - (40 - a.hold) * 0.09) * TS, a.t, Math.max(0, a.hold / 40), 1); if (a.hold <= 0) { burst('heart', p.x, p.y - 0.8, 4); anims.splice(k, 1); a.done && a.done(); } }
      } else if (a.k === 'fight') { // пил і зірочки сутички
        if (a.t > a.life) { anims.splice(k, 1); continue; }
        const u = a.t / a.life; c.save(); c.globalAlpha = 1 - u; c.strokeStyle = '#ffe9a0'; c.lineWidth = 2;
        for (let i = 0; i < 6; i++) { const an = i / 6 * 6.283 + a.t * 0.2, r = (0.3 + u * 0.8) * TS * 0.5; c.beginPath(); c.moveTo(a.x * TS + Math.cos(an) * r * 0.5, a.y * TS + Math.sin(an) * r * 0.5); c.lineTo(a.x * TS + Math.cos(an) * r, a.y * TS + Math.sin(an) * r); c.stroke(); }
        c.restore();
      }
    }
    // свічки церемонії пам'яті
    const pt = g.ext && g.ext.party; if (pt && pt.kind === 'memorial' && !(pt.phase === 'gather' && g.tick < pt.t0 + 60)) {
      const cx = (pt.x + 0.5) * TS, cy = (pt.y + 0.5) * TS + 4; const a = Math.min(1, (g.tick - pt.t0) / 120);
      c.save(); c.globalAlpha = a; const gl = c.createRadialGradient(cx, cy, 4, cx, cy, 70); gl.addColorStop(0, 'rgba(255,200,120,.25)'); gl.addColorStop(1, 'rgba(255,200,120,0)'); c.fillStyle = gl; c.beginPath(); c.arc(cx, cy, 70, 0, 6.3); c.fill();
      for (let k = 0; k < 8; k++) { const an = k / 8 * 6.283, x = cx + Math.cos(an) * 40, y = cy + Math.sin(an) * 21; c.fillStyle = '#f4efe2'; c.fillRect(x - 1.8, y - 1, 3.6, 7); flame(c, x, y - 3.5, time, k); }
      c.fillStyle = '#9aa0a8'; c.fillRect(cx - 7, cy - 12, 14, 14); c.fillStyle = '#c9ced6'; c.fillRect(cx - 7, cy - 12, 14, 3); c.fillStyle = '#e5e8ee'; c.font = '9px sans-serif'; c.textAlign = 'center'; c.fillText('†', cx, cy - 1);
      if (pt.name) { c.font = 'bold 10px sans-serif'; c.fillStyle = 'rgba(0,0,0,.6)'; c.fillText(pt.name, cx + 1, cy - 20); c.fillStyle = '#ffeec8'; c.fillText(pt.name, cx, cy - 21); }
      c.restore();
      if (g.tick % 40 === 0) fx2('sparkle', pt.x + 0.5 + U.rr(-1.2, 1.2), pt.y + U.rr(-0.6, 0.2), { c: '#ffe2a0' });
    }
  }
  RW.R.worldOver.push(drawWorld);

  // ======================================================================
  //  1. КОНФЛІКТИ
  // ======================================================================
  const mt = C.mentalThink;
  C.mentalThink = function (p) {
    if (p.mental && p.mental.type === 'duel') return duelThink(p);
    return mt.apply(this, arguments);
  };
  function startDuel(a, b, friendly) {
    const g = G(), e = ex(g); if (e.duel) return false;
    e.duel = { a: a.id, b: b.id, friendly: !!friendly, t0: g.tick, fin: false };
    for (const [p, o] of [[a, b], [b, a]]) {
      AI.endJob(p); p.sleeping = false; p.drafted = false; p.combatTarget = null; p.moving = false;
      p.mental = { type: 'duel', left: friendly ? 540 : 1900, target: o, n: 0, inj0: injN(p), friendly: !!friendly };
      bubble(p, friendly ? '🤜' : '⚔', 500);
    }
    RW.A && RW.A.sfx('alert');
    RW.UI.letter(friendly ? 'Дружня бійка' : 'Дуель!', friendly ? U.fullName(a) + ' і ' + U.fullName(b) + ' вирішили побитися для забави.' : U.fullName(a) + ' і ' + U.fullName(b) + ' більше не можуть терпіти одне одного — вони б\'ються до першої крові.', friendly ? 'info' : 'warn', a);
    return true;
  }
  function duelThink(p) {
    const g = G(), e = ex(g), d = e.duel, m = p.mental, t = m.target;
    if (!d || d.fin || !t || t.dead || !t.mental || t.mental.type !== 'duel') { p.mental = null; AI.endJob(p); return; }
    m.left--;
    const dist = Math.hypot(p.x - t.x, p.y - t.y);
    if (dist > 1.7) { AI.moveTo(p, t.tx, t.ty, { adj: true }); if (m.left % 90 === 0 && !m.friendly) fx2('anger', p.x, p.y - 0.8); }
    else {
      p.moving = false; AI.faceTo(p, t.x, t.y);
      if (m.friendly) {
        if (g.tick % 22 === (p.id % 22)) { RW.R.fx.swing(p.x, p.y, t.x, t.y); anims.push({ k: 'fight', x: (p.x + t.x) / 2, y: (p.y + t.y) / 2, t: 0, life: 18 }); if (Math.random() < 0.4) fx2('sparkle', (p.x + t.x) / 2, p.y - 0.5, { c: '#ffd37a' }); }
        if (g.tick % 70 === 0) bubble(p, Math.random() < 0.5 ? '😄' : '💪', 120);
      } else {
        const before = injN(t); C.attack(p, t, { unarmed: true });
        if (injN(t) > before) anims.push({ k: 'fight', x: t.x, y: t.y - 0.3, t: 0, life: 22 });
      }
    }
    const a = g.pawns.find(q => q.id === d.a), b = g.pawns.find(q => q.id === d.b);
    if (!a || !b) return finish(d, null);
    if (d.friendly) { if (m.left <= 0) finish(d, null); return; }
    const ha = injN(a) - a.mental.inj0, hb = injN(b) - b.mental.inj0;
    if (ha > 0.01 || hb > 0.01 || a.downed || b.downed || m.left <= 0) finish(d, ha > hb + 0.01 ? b : (hb > ha + 0.01 ? a : null));
  }
  function finish(d, winner) {
    if (d.fin) return; d.fin = true; const g = G(), e = ex(g); e.duel = null; e.cool = dayN(g) + PS.CONF_COOL_DAYS;
    const a = g.pawns.find(q => q.id === d.a), b = g.pawns.find(q => q.id === d.b);
    for (const p of [a, b]) if (p && p.mental && p.mental.type === 'duel') { p.mental = null; AI.endJob(p); p.moving = false; }
    if (!a || !b) return;
    if (d.friendly) {
      for (const p of [a, b]) { p.addThought('brawl_fun'); p.needs.joy = Math.min(1, (p.needs.joy || 0) + 0.25); }
      RW.Social.change(a, b, 10); RW.Social.change(b, a, 10); burst('heart', (a.x + b.x) / 2, a.y - 0.6, 5); bubble(a, '😆', 300); bubble(b, '😆', 300);
      RW.UI.toast('🤜 ' + U.shortName(a) + ' і ' + U.shortName(b) + ' пожартували боротьбою — стали ближчими', 'good'); return;
    }
    if (g.stats) g.stats.duels = (g.stats.duels || 0) + 1;
    if (winner) {
      const lo = winner === a ? b : a; winner.addThought('duel_won'); lo.addThought('duel_lost');
      RW.Social.change(lo, winner, 14); RW.Social.change(winner, lo, 8); // повага до переможця / полегшення
      RW.R.fx.text(winner.x, winner.y - 1, '🏆', '#ffd24a'); RW.R.fx.text(lo.x, lo.y - 1, '🩹', '#ff7a6a'); burst('confetti', winner.x, winner.y - 0.4, 12);
      RW.UI.letter('Дуель завершена', U.fullName(winner) + ' переміг(ла) ' + U.fullName(lo) + '. Першу кров пролито — тепер обидва охололи і ставляться одне до одного краще.', 'info', winner);
    } else {
      a.addThought('duel_draw'); b.addThought('duel_draw'); RW.Social.change(a, b, 8); RW.Social.change(b, a, 8);
      RW.UI.letter('Дуель завершена', 'Сутичка між ' + U.shortName(a) + ' і ' + U.shortName(b) + ' скінчилася нічиєю. Люди втомилися і розійшлися.', 'info', a);
    }
  }
  function conflictsDaily(g) {
    const e = ex(g); if (e.duel || dayN(g) < Math.max(3, e.cool) || g.threat > 0) return;
    const cs = cols(g).filter(free); if (cs.length < 2) return;
    let best = null, bs = 0;
    for (const a of cs) for (const b of cs) {
      if (a.id >= b.id) continue; const o = (RW.Social.op(a, b) + RW.Social.op(b, a)) / 2, m = Math.min(RW.Social.op(a, b), RW.Social.op(b, a));
      const bad = Math.max(-o, -m * 0.8); if (bad > bs && bad >= -PS.QUARREL_OP) { bs = bad; best = [a, b, o, m]; }
    }
    if (best) {
      const [a, b, o, m] = best;
      if (o <= PS.DUEL_OP && Math.random() < PS.DUEL_CH && !a.noViolence && !b.noViolence) return void startDuel(a, b, false);
      if (Math.random() < PS.QUARREL_CH) return void quarrel(a, b);
    }
    // дружня бійка між добрими друзями в гарному настрої
    if (Math.random() < PS.BRAWL_CH) {
      for (const a of cs) for (const b of cs) { if (a.id >= b.id || a.mood < 65 || b.mood < 65) continue; if (RW.Social.op(a, b) > 45 && RW.Social.op(b, a) > 45 && !a.noViolence && !b.noViolence && a.rel[b.id] === 'friend') return void startDuel(a, b, true); }
    }
  }
  function quarrel(a, b) {
    const g = G(); if (g.stats) g.stats.quarrels = (g.stats.quarrels || 0) + 1;
    for (const [p, o] of [[a, b], [b, a]]) { AI.endJob(p); p.moving = false; p.stun = 140; AI.faceTo(p, o.x, o.y); p.addThought('quarrel'); RW.Social.change(p, o, -6); bubble(p, '💢', 260); fx2('anger', p.x, p.y - 0.8); RW.R.fx.text(p.x, p.y - 1.1, Math.random() < 0.5 ? '🗯' : '💢', '#ff8a6a'); }
    RW.UI.toast('🗯 ' + U.shortName(a) + ' і ' + U.shortName(b) + ' голосно посварилися', 'warn');
  }

  // ======================================================================
  //  2. ХОБІ Й ТВОРЧИЙ НАСТРІЙ
  // ======================================================================
  const wsF = P.workSpeed;
  P.workSpeed = function () {
    let r = wsF.apply(this, arguments); const s = this.psy; if (!s) return r;
    if (s.block > 0) r *= PS.BLOCK_SLOW; if (s.perks) r *= 1 + s.perks * PS.PERK_WORK; return r;
  };
  function assignHobby(p) {
    const s = ps(p); if (s.hobby) return; const keys = Object.keys(SK).filter(k => p.skills[k]); const w = keys.map(k => 1 + Math.max(0, p.skillLvl ? p.skillLvl(k) : (p.skills[k].lvl || 0)) * 0.6);
    let r = Math.random() * w.reduce((a, b) => a + b, 0), i = 0; for (; i < w.length - 1; i++) { r -= w[i]; if (r <= 0) break; } s.hobby = keys[i];
  }
  function hobbyTick(g) { // раз на 60 тіків
    for (const p of cols(g)) {
      const s = ps(p); if (!s.hobby || !p.job) continue; const jt = p.job.type; if (!HOB[s.hobby].includes(jt)) continue;
      p.needs.joy = Math.min(1, (p.needs.joy || 0) + 0.0035); if ((g.tick + p.id) % 600 === 0) p.addThought('hobby_joy');
      if ((g.tick + p.id) % 240 === 0) fx2(Math.random() < 0.5 ? 'note' : 'sparkle', p.x, p.y - 0.7, { c: '#ffe27a' });
    }
  }
  function creativeDaily(g) {
    for (const p of cols(g)) {
      const s = ps(p); assignHobby(p); if (s.block > 0) { s.block--; }
      if (p.sleeping || p.downed || p.mental) continue;
      if (!p.inspire && p.mood >= PS.HOBBY_MOOD && Math.random() < PS.HOBBY_DAY_CH) {
        p.inspire = { skill: s.hobby, left: Math.round(1.2 * DY) }; p.addThought('creative_burst'); bubble(p, HOB_ICO[s.hobby] + '✨', 520); burst('sparkle', p.x, p.y - 0.5, 10, { c: '#ffe27a' }); fx2('note', p.x, p.y - 0.8);
        RW.UI.toast(HOB_ICO[s.hobby] + ' ' + U.shortName(p) + ' охоплений(а) творчим поривом: ' + SK[s.hobby] + ' +', 'good'); if (g.stats) g.stats.bursts = (g.stats.bursts || 0) + 1;
      } else if (s.block <= 0 && p.mood < PS.BLOCK_MOOD && Math.random() < PS.BLOCK_CH) {
        s.block = 1; p.addThought('creative_block'); bubble(p, '😖', 400); fx2('anger', p.x, p.y - 0.8); RW.R.fx.text(p.x, p.y - 1, '💭', '#aab');
        RW.UI.toast('😖 ' + U.shortName(p) + ': творча криза, робота йде повільніше', 'warn');
      }
    }
  }

  // ======================================================================
  //  3. СПОГАДИ Й ТРАВМИ + ЦЕРЕМОНІЯ ПАМ'ЯТІ
  // ======================================================================
  function remember(p, txt, tag) { const s = ps(p); s.mem.unshift({ d: dayN(G()), t: txt, k: tag || 'x' }); if (s.mem.length > 8) s.mem.pop(); }
  const od = RW.Rel.onDeath;
  RW.Rel.onDeath = function (dead, o) {
    od.apply(this, arguments); const g = G();
    if (!dead.isColonist || o === dead || o.faction !== 'colony' || o.isChild) return;
    const op = Math.max(RW.Social.op(o, dead), o.rel[dead.id] ? 30 : 0); if (op < 15) return;
    const v = -Math.min(10, 4 + op / 14), nm = U.shortName(dead);
    o.thoughts.push({ id: 'mem', l: 'Сумує за ' + nm, v: Math.round(v), left: 8 * DY, who: dead.id });
    remember(o, 'Втратив(ла) ' + nm, 'death'); bubble(o, '😢', 600); fx2('sparkle', o.x, o.y - 0.7, { c: '#a8c0ff' });
  };
  function onDeathGlobal(g) { // церемонія пропонується один раз, коли хтось із колоністів помер
    const e = ex(g); for (const dp of (g.deadPawns || [])) { if (!dp.isColonist && dp.faction !== 'colony') continue; if (e.memorials.some(m => m.id === dp.id) || (dp.psy && dp.psy.mdone)) continue; if (e.seen && e.seen.includes(dp.id)) continue; (e.seen = e.seen || []).push(dp.id); if (cols(g).length >= 2) e.memorials.push({ id: dp.id, name: U.shortName(dp), at: g.tick + Math.round(DY * 0.5), asked: false }); }
  }
  function memorialCheck(g) {
    const e = ex(g); if (!e.memorials.length) return;
    const m = e.memorials.find(x => !x.asked && g.tick >= x.at); if (!m) return;
    m.asked = true;
    RW.UI.letter('Церемонія пам\'яті', 'Колоністи сумують за ' + m.name + '. Церемонія зі свічками допоможе попрощатися: усі присутні відчують полегшення, а сумні спогади притихнуть.', 'info', null, null, [
      { label: '🕯 Влаштувати церемонію', fn: () => startMemorial(m) }, { label: 'Не зараз', fn: () => { m.asked = false; m.at = G().tick + DY; } }]);
  }
  function startMemorial(m) {
    const g = G(); if (!RW.Rel.startParty('party')) { RW.UI.toast('Зараз триває інше свято — спробуйте пізніше', 'info'); m.asked = false; m.at = g.tick + 600; return; }
    const pt = g.ext.party; pt.kind = 'memorial'; pt.name = m.name; pt.deadId = m.id; ex(g).cur = m;
    const L = g.letters[g.letters.length - 1]; if (L) { L.title = 'Церемонія пам\'яті'; L.text = 'Колоністи збираються, щоб згадати ' + m.name + '.'; }
  }
  function memorialEnd(g) {
    const e = ex(g); const pt = g.ext && g.ext.party;
    if (e.cur && (!pt || pt.kind !== 'memorial')) {
      const m = e.cur; e.cur = null; const spot = e.spot || { x: g.home ? g.home.x : 0, y: g.home ? g.home.y : 0 };
      let n = 0; for (const p of cols(g)) { if (p.mental || Math.hypot(p.x - spot.x, p.y - spot.y) > 10) continue; n++; p.addThought('memorial_done'); p.thoughts = p.thoughts.filter(t => !(t.id === 'mem' && t.who === m.id)); remember(p, 'Попрощався(лась) з ' + m.name, 'memorial'); burst('sparkle', p.x, p.y - 0.6, 4, { c: '#ffe2a0' }); }
      e.memorials = e.memorials.filter(x => x.id !== m.id); const dp = (g.deadPawns || []).find(x => x.id === m.id); if (dp) dp.psy = { mdone: 1 };
      if (n) RW.UI.letter('Церемонія завершена', 'Спогади про ' + m.name + ' стали світлішими. Присутніх: ' + n + '.', 'good');
    } else if (pt && pt.kind === 'memorial') e.spot = { x: pt.x, y: pt.y };
  }
  function traumaTick(g) { // раз на 60 тіків
    for (const p of cols(g)) {
      const s = ps(p);
      if (p.downed && !s.wasDown) { s.wasDown = 1; s.ptsd = 1; p.addThought('trauma'); remember(p, 'Ледь не загинув(ла) у бою', 'trauma'); bubble(p, '😨', 500); }
      else if (!p.downed) s.wasDown = 0;
      if (s.ptsd && g.threat > 0 && (g.tick + p.id) % 600 === 0) { p.addThought('ptsd'); bubble(p, '😰', 240); }
    }
  }

  // ======================================================================
  //  4. ОСОБИСТІ ЦІЛІ
  // ======================================================================
  function friends(p) { let n = 0; for (const k in p.rel) if (p.rel[k] === 'friend' || p.rel[k] === 'lover' || p.rel[k] === 'spouse') n++; return n; }
  function newGoal(p) {
    const s = ps(p), opts = [];
    const sk = s.hobby || 'crafting', cur = p.skillLvl ? Math.round(p.skillLvl(sk)) : (p.skills[sk].lvl || 0);
    if (cur < 18) opts.push({ k: 'skill', sk, to: Math.min(20, cur + 3), t: 'Досягти ' + Math.min(20, cur + 3) + ' рівня: ' + SK[sk] });
    opts.push({ k: 'friends', to: friends(p) + 2, t: 'Мати ' + (friends(p) + 2) + ' друзів у колонії' });
    opts.push({ k: 'calm', to: 6, t: '6 днів поспіль у доброму настрої' });
    opts.push({ k: 'kills', to: (p.kills || 0) + 3, t: 'Здобути ' + ((p.kills || 0) + 3) + ' перемоги в бою' });
    if (!RW.Rel.partnerOf(p) && p.age >= 18) opts.push({ k: 'love', to: 1, t: 'Знайти кохання' });
    const pick = opts.filter(o => !(s.last === o.k)); s.goal = Object.assign({ prog: 0 }, U.pick(pick.length ? pick : opts)); s.last = s.goal.k;
  }
  function goalProg(p, gl) {
    const s = ps(p);
    switch (gl.k) { case 'skill': return p.skillLvl ? p.skillLvl(gl.sk) : 0; case 'friends': return friends(p); case 'calm': return s.calm; case 'kills': return p.kills || 0; case 'love': return RW.Rel.partnerOf(p) ? 1 : 0; }
    return 0;
  }
  function goalsDaily(g) {
    for (const p of cols(g)) {
      const s = ps(p); if (p.mood >= 55) s.calm++; else s.calm = 0;
      if (!s.goal) { if (dayN(g) >= 3) newGoal(p); continue; }
      if (s.goal.wait) { if (g.tick >= s.goal.wait) newGoal(p); continue; }
      const gl = s.goal; gl.prog = goalProg(p, gl);
      if (gl.prog >= gl.to) {
        s.goals++; if (g.stats) g.stats.goals = (g.stats.goals || 0) + 1; remember(p, 'Мета: ' + gl.t, 'goal'); const nm = U.shortName(p);
        p.addThought('goal_done'); burst('confetti', p.x, p.y - 0.4, 22); burst('sparkle', p.x, p.y - 0.8, 8, { c: '#ffe27a' }); bubble(p, '🎯', 600); RW.A && RW.A.sfx('research');
        if (s.perks < PS.PERK_MAX) { s.perks++; const old = p.thoughts.find(t => t.id === 'perk'); if (old) { old.v = PS.PERK_MOOD * s.perks; old.l = 'Гордість за досягнення ×' + s.perks; } else p.thoughts.push({ id: 'perk', l: 'Гордість за досягнення', v: PS.PERK_MOOD, left: 1e9 }); }
        RW.UI.letter('Мета досягнута', nm + ' досяг(ла) мети: «' + gl.t + '». Нагорода: постійне підвищення настрою і швидкості роботи.' + (s.perks >= PS.PERK_MAX ? ' (максимум нагород)' : ''), 'good', p);
        s.goal = { wait: g.tick + 3 * DY, k: 'wait' };
      }
    }
  }
  // відновлення вічної думки після завантаження: left = 1e9 зберігається у JSON як 1000000000 — нічого робити не треба

  // ======================================================================
  //  5. ЛИСТИ ДОДОМУ
  // ======================================================================
  const KIN = ['мама', 'тато', 'сестра', 'брат', 'стара подруга', 'бабуся', 'дядько', 'наставник'];
  function lettersDaily(g) {
    const e = ex(g), dn = dayN(g);
    for (const p of cols(g)) {
      const s = ps(p); if (dn < 4 || !free(p)) continue; if (s.next < 0) s.next = dn + U.ri(PS.LETTER_MIN - 3, PS.LETTER_MAX);
      if (dn >= s.next) {
        s.next = dn + U.ri(PS.LETTER_MIN, PS.LETTER_MAX); anims.push({ k: 'send', x: p.x, y: p.y, t: 0, life: 170 }); p.addThought('letter_sent'); bubble(p, '✉', 420); RW.R.fx.text(p.x, p.y - 1, '✉', '#fff');
        e.replies.push({ pid: p.id, at: g.tick + U.ri(PS.REPLY_MIN, PS.REPLY_MAX) * DY + U.ri(0, 4000), who: U.pick(KIN) }); if (g.stats) g.stats.letters = (g.stats.letters || 0) + 1;
      }
    }
  }
  function repliesTick(g) {
    const e = ex(g); for (let i = e.replies.length - 1; i >= 0; i--) {
      const r = e.replies[i]; if (g.tick < r.at) continue; const p = g.pawns.find(q => q.id === r.pid);
      if (!p || p.dead) { e.replies.splice(i, 1); continue; } if (p.sleeping || p.mental) continue; // дочекаємося, поки прокинеться
      e.replies.splice(i, 1); const roll = Math.random(), nm = U.shortName(p);
      const outcome = roll < 0.42 ? 'good' : roll < 0.67 ? 'neutral' : roll < 0.8 ? 'gift' : 'bad';
      anims.push({ k: 'dove', p, sx: p.x - 18, sy: p.y - 11, t: 0, life: 150, done: () => deliver(g, p, r, outcome) });
    }
  }
  function deliver(g, p, r, o) {
    const nm = U.shortName(p), who = r.who; remember(p, 'Лист від: ' + who, 'letter');
    if (o === 'good') { p.addThought('letter_home'); RW.UI.letter('Лист з дому', nm + ' отримав(ла) теплого листа від ' + who + ' — у них усе добре, вони пишаються і чекають новин.', 'good', p); }
    else if (o === 'neutral') { p.addThought('letter_cold'); RW.UI.toast('✉ ' + nm + ': короткий лист від ' + who, 'info'); }
    else if (o === 'gift') {
      const n = U.ri(40, 120); const sp = { x: Math.floor(p.x), y: Math.floor(p.y) }; try { g.map.addItem('silver', n, sp.x, sp.y); } catch (e) { }
      p.addThought('letter_home'); burst('sparkle', p.x, p.y - 0.5, 10, { c: '#e6e6ee' }); RW.UI.letter('Лист з дому', nm + ' отримав(ла) листа від ' + who + ' і трохи срібла на допомогу колонії (+' + n + ').', 'good', p);
    } else { p.addThought('homesick'); bubble(p, '😞', 500); RW.UI.letter('Лист з дому', nm + ' отримав(ла) тривожний лист від ' + who + ': вдома непросто. Колоніст сумує, але це минеться.', 'warn', p); }
  }

  // ======================================================================
  //  ПІДКЛЮЧЕННЯ ДО ГРИ
  // ======================================================================
  const lt = RW.Life.tick;
  RW.Life.tick = function (g) {
    lt(g);
    try {
      if (g.tick % 60 === 17) { hobbyTick(g); traumaTick(g); }
      if (g.tick % 60 === 41) { repliesTick(g); memorialEnd(g); }
      if (g.tick % 300 === 7) { onDeathGlobal(g); memorialCheck(g); }
      if (g.tick % DY === 1500) creativeDaily(g);
      if (g.tick % DY === 1600) goalsDaily(g);
      if (g.tick % DY === 1700) lettersDaily(g);
      if (g.tick % DY === 2000) conflictsDaily(g);
    } catch (err) { console.error(err); }
  };

  // ---------- вікно «Душа» у вкладках «Люди» ----------
  const esc = s => RW.UI.esc(s);
  function soulTab() {
    const g = G(); let h = '<div class="soul">';
    for (const p of cols(g)) {
      const s = ps(p), gl = s.goal; assignHobby(p);
      h += '<div class="soul-card"><div class="sc-h"><img src="' + RW.UI.portrait(p) + '"><b>' + esc(U.shortName(p)) + '</b><span class="sc-hob">' + HOB_ICO[s.hobby] + ' ' + SK[s.hobby] + (s.block > 0 ? ' · 😖 криза' : '') + (p.inspire ? ' · ✨ натхнення' : '') + '</span>' + (s.perks ? '<span class="sc-perk">' + '★'.repeat(s.perks) + '</span>' : '') + '</div>';
      if (gl && gl.k !== 'wait') { const pr = Math.min(1, goalProg(p, gl) / gl.to); h += '<div class="sc-goal">🎯 ' + esc(gl.t) + '<div class="sc-bar"><i style="width:' + Math.round(pr * 100) + '%"></i></div></div>'; }
      else h += '<div class="sc-goal sub">🎯 Нова мета з\'явиться незабаром</div>';
      h += '<div class="sc-mem">' + (s.mem.length ? s.mem.slice(0, 3).map(m => '<span title="день ' + m.d + '">' + ({ death: '🕯', trauma: '🩹', goal: '🏆', letter: '✉', memorial: '🕊' }[m.k] || '•') + ' ' + esc(m.t) + '</span>').join('') : '<span class="sub">Спогадів поки немає</span>') + '</div></div>';
    }
    return h + '</div>';
  }
  const LU = RW.LifeUI; if (LU) {
    const h0 = LU.html;
    LU.html = function () {
      let h = h0.apply(this, arguments);
      h = h.replace(/(<button class="tab [^"]*" data-act="luTab" data-id="rel">[^<]*<\/button>)/, '$1<button class="tab ' + (LU.tab === 'soul' ? 'on' : '') + '" data-act="luTab" data-id="soul">🧠 Душа</button>');
      if (LU.tab === 'soul') { const i = h.indexOf('</div>'); h = h.slice(0, i + 6) + soulTab(); }
      return h;
    };
    RW.UI.addWin('people', { title: 'Люди', fn: LU.html, cls: 'win-wide' });
  }

  // ---------- мітка бою у списку завдань ----------
  PS._t = { startDuel, quarrel, conflictsDaily, creativeDaily, goalsDaily, lettersDaily, repliesTick, startMemorial, memorialCheck, ex, ps, anims, newGoal, deliver };
})();
