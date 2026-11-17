// ============================================================
//  life.js — настрій, думки, психічні зриви, натхнення, навички
// ============================================================
(function () {
  'use strict';
  const RW = window.RW; const D = RW.D, U = RW.U; const AI = RW.AI, C = RW.Combat;
  const Life = RW.Life = {}; const G = () => RW.G; const DY = D.DAY, HR = D.HOUR; const TAU = Math.PI * 2;
  const clamp = U.clamp;

  // ---------- Нові думки ----------
  const IC = D.thoughtIco = {};
  function T(id, l, v, days, ico, stack, extra) { D.thoughts[id] = Object.assign({ l, v, dur: days * DY, stack: stack || 1 }, extra || {}); IC[id] = ico; }
  T('room_impressive', 'Вражаюча кімната', 5, 0.12, '🏛'); T('room_cramped', 'Тісна кімната', -3, 0.12, '📦');
  T('own_bedroom', 'Власна спальня', 3, 0.15, '🛏'); T('shared_bedroom', 'Спальня з іншими', -2, 0.15, '👥');
  T('lonely', 'Самотність', -4, 0.3, '🥀'); T('friend_near', 'Друг поруч', 2, 0.2, '🤝');
  T('passion_work', 'Улюблена справа', 5, 0.25, '🔥'); T('sick_mood', 'Погано почувається', -3, 0.15, '🤒');
  T('fireside', 'Тепло біля вогню', 3, 0.15, '🔥'); T('inspired', 'Натхнення', 8, 1.2, '✨');
  T('comforted', 'Мене заспокоїли', 8, 1.5, '🫂'); T('wedding_guest', 'Чудове весілля', 8, 3, '💒');
  T('party', 'Весела вечірка', 7, 2, '🎉'); T('engaged', 'Заручини', 10, 6, '💍'); T('got_married', 'Одружений(а)', 20, 12, '💑');
  T('spouse_died', 'Втрата чоловіка/дружини', -25, 25, '🖤'); T('rejected', 'Мені відмовили', -8, 4, '💔');
  T('cheated', 'Зрада', -14, 6, '😡'); T('divorced', 'Розлучення', -12, 8, '📄');
  T('bionic_joy', 'Протез як новий', 4, 20, '🦾', 3); T('prosthetic_shame', 'Незграбний протез', -2, 20, '🦿', 2);
  T('scarred', 'Шрами', -1, 40, '🩹', 3); T('kin_died', 'Помер рідний', -10, 10, '🖤', 3);
  T('epidemic_fear', 'Страх епідемії', -3, 0.5, '😷'); T('caravan_visit', 'Приїзд каравану', 3, 1, '🐫');
  T('nice_gift', 'Приємний подарунок', 5, 2, '🎁'); T('proposal_glow', 'Мене кохають', 6, 3, '🌹');
  T('smashed', 'Зірвався і потрощив', -3, 1, '💥'); T('ran_away', 'Повернувся після втечі', -4, 2, '🏃');
  T('surgery_ok', 'Операція пройшла вдало', 3, 4, '⚕'); T('surgery_bad', 'Невдала операція', -8, 5, '🩸');
  T('vaccinated', 'Одужання з імунітетом', 2, 3, '💉');
  Object.assign(IC, { ate_raw: '🥩', ate_simple: '🍲', ate_fine: '🍽', ate_nodesk: '🍞', ate_table: '🍽', slept_ground: '🌍', slept_spot: '🛌', slept_bed: '🛏', slept_hosp: '🏥', slept_cold: '🥶', saw_corpse: '💀', friend_died: '🖤', colonist_died: '🕯', rival_died: '😏', killed_enemy: '⚔', insulted: '💢', chitchat: '💬', deep_talk: '🗨', in_love: '💕', heartbreak: '💔', catharsis: '🌤', played: '🎲', petted: '🐕', wet: '🌧', wounded_fought: '🩹', pod_landing: '🚀', new_world: '🌍', cured: '💚', missing_limb: '🦴', ate_corpse_nope: '🤢', fire_nearby: '🔥' });

  // ---------- Допоміжні ----------
  function ensure(g) { g.ext = g.ext || {}; const e = g.ext; e.away = e.away || []; e.party = e.party || null; e.events = e.events || []; e.partyCool = e.partyCool || 0; return e; }
  Life.ensure = ensure;
  const mfmt = p => U.shortName(p);
  const colonists = g => g.pawns.filter(p => p.faction === 'colony' && !p.dead);
  function bubble(p, ico, ticks) { p.bub = { ico, until: G().tick + (ticks || 240) }; }
  Life.bubble = bubble;
  const SK = D.skills;
  function nearestEdge(p, map) {
    const cand = [[p.tx, 1], [p.tx, map.h - 2], [1, p.ty], [map.w - 2, p.ty]]; cand.sort((a, b) => Math.hypot(a[0] - p.tx, a[1] - p.ty) - Math.hypot(b[0] - p.tx, b[1] - p.ty));
    for (const [x, y] of cand) { for (let k = 0; k < 40; k++) { const xx = clamp(x + (k % 2 ? 1 : -1) * ((k / 2) | 0), 1, map.w - 2), yy = clamp(y + (k % 2 ? 1 : -1) * ((k / 2) | 0), 1, map.h - 2); if (map.cost[yy * map.w + xx] > 0) return [xx, yy]; } }
    return [1, 1];
  }

  // ---------- Повільне оновлення пішака (раз на 30 тіків) ----------
  const origSlow = AI.slowUpdate;
  AI.slowUpdate = function (p) { if (p.faction === 'colony' && !p.dead) { try { Life.slow(p); } catch (e) { console.error(e); } } origSlow(p); };
  Life.slow = function (p) {
    const g = G(), map = g.map; const i = p.ty * map.w + p.tx; const room = map.room[i];
    // кімната
    if (room >= 0 && map.isRoofed(i)) {
      const r = map.rooms[room];
      if (r) {
        if (r.beautyAvg >= 2.4 && r.size >= 8) p.addThought('room_impressive');
        if (r.size < 6 && !p.job) p.addThought('room_cramped');
        if (p.sleeping) {
          let beds = 0; for (const b of map.buildings) if (b.def.bed && !b.def.med && map.room[b.y * map.w + b.x] === room) beds++;
          if (beds === 1 && p.bed) p.addThought('own_bedroom'); else if (beds > 1) p.addThought('shared_bedroom');
        }
      }
    }
    // самотність/друзі
    const others = colonists(g).filter(o => o !== p);
    const bonds = others.filter(o => ['friend', 'lover', 'spouse', 'kin'].includes(p.rel[o.id]));
    const dayNo = D.relDay(g.tick);
    if (dayNo >= 3 && !p.sleeping) {
      const pet = g.animals.some(a => a.faction === 'colony' && !a.dead);
      if (!bonds.length && (others.length || !pet)) p.addThought('lonely');
    }
    if (!p.sleeping && bonds.some(o => !o.downed && Math.hypot(o.x - p.x, o.y - p.y) < 6)) p.addThought('friend_near');
    // вогнище
    if (g.outTemp < 12 && !p.sleeping) for (const b of map.buildings) { if (b.key === 'campfire' && b.fuel > 0 && Math.hypot(b.x + 0.5 - p.x, b.y + 0.5 - p.y) < 3.6) { p.addThought('fireside'); break; } }
    // хвороба
    if (p.ill.some(il => !D.illnesses[il.id].env && il.sev > 0.25)) p.addThought('sick_mood');
    // епідемія поруч
    if (Life.epidemicNear && Life.epidemicNear(p)) p.addThought('epidemic_fear');
    // ризик зриву
    const th = p.breakThresholds(); p.breakLevel = p.mood < th.extreme ? 3 : p.mood < th.major ? 2 : p.mood < th.minor ? 1 : 0;
    p.nearBreak = !p.mental && p.breakLevel === 0 && p.mood < th.minor + 8;
    if (p.nearBreak && g.tick - (p.warnT || -9999) > 1.5 * DY && !p.sleeping) {
      p.warnT = g.tick; RW.UI && RW.UI.toast(mfmt(p) + ' на межі зриву (настрій ' + Math.round(p.mood) + ')', 'bad'); bubble(p, '😟', 360);
      RW.FX2 && RW.FX2.emit('sweat', p.x + 0.3, p.y - 0.6);
    }
  };

  // ---------- Психічні зриви ----------
  const LAB = { wander: 'блукає в розпачі', hide: 'ховається від світу й плаче', binge: 'обжирається', insult: 'ображає всіх навколо', fight: 'шукає бійки', berserk: 'впав у берсерк і нападає на всіх!', fire: 'підпалює все навколо!', tantrum: 'трощить меблі в істериці', runaway: 'збирає речі й тікає з колонії' };
  const ICO = { wander: '😞', hide: '😭', binge: '🍖', insult: '🤬', fight: '👊', berserk: '😡', fire: '🔥', tantrum: '💥', runaway: '🏃' };
  const DUR = { wander: 2600, hide: 2200, binge: 2400, insult: 1800, fight: 1500, berserk: 1900, fire: 1600, tantrum: 1700, runaway: 9000 };
  Life.BREAK_LABEL = LAB; Life.BREAK_ICON = ICO;
  C.startBreak = AI.startBreak = function (p, type, target) {
    const g = G(); AI.endJob(p);
    p.mental = { type, left: DUR[type] || 2000, target: target || null, n: 0, t0: g.tick };
    p.drafted = false; p.combatTarget = null; p.moving = false;
    p.addLog('Психічний зрив: ' + LAB[type]); bubble(p, ICO[type], 600);
    RW.UI && RW.UI.letter('Психічний зрив', U.fullName(p) + ' ' + LAB[type] + '.', (type === 'berserk' || type === 'fire') ? 'bad' : 'warn', p);
    RW.A && RW.A.sfx('alert');
    if (RW.FX2) { RW.FX2.emit('ringpulse', p.x, p.y + 0.3, { c: type === 'berserk' ? '#ff3a2a' : type === 'tantrum' ? '#ffa030' : type === 'hide' ? '#6ab0ff' : '#c070ff', r: 1.4 }); if (type === 'berserk' || type === 'tantrum' || type === 'fight' || type === 'insult') RW.FX2.emit('anger', p.x, p.y - 0.9); }
  };
  C.checkBreak = function (p) {
    const th = p.breakThresholds(); let level = p.mood < th.extreme ? 3 : p.mood < th.major ? 2 : p.mood < th.minor ? 1 : 0; if (!level) return;
    if (Math.random() > [0, 0.3, 0.5, 0.78][level]) return;
    const kind = p.has('kind'), brawl = p.has('brawler'), psy = p.has('psychopath'), pyro = p.has('pyromaniac');
    const pool = [];
    const add = (t, w) => { if (w > 0) pool.push([t, w]); };
    if (level === 1) { add('wander', 3); add('hide', 3); add('binge', 3); add('insult', kind ? 0.5 : 2); }
    else if (level === 2) { add('hide', 1); add('binge', 2); add('insult', kind ? 1 : 3); add('tantrum', 3); add('runaway', 2); add('fight', p.noViolence ? 0 : (brawl ? 4 : 2)); add('fire', pyro ? 3 : 0); }
    else { add('tantrum', 2); add('runaway', 2); add('berserk', p.noViolence ? 0 : (psy ? 5 : 3)); add('fire', pyro ? 5 : 1.5); add('fight', p.noViolence ? 0 : 1); }
    const pick = U.weighted(pool, o => o[1]); C.startBreak(p, pick[0]);
  };
  const origThink = C.mentalThink;
  function endBreak(p, why) { p.mental = null; AI.endJob(p); p.moving = false; p.addThought('catharsis'); p.addLog(why || 'Прийшов до тями.'); bubble(p, '🌤', 300); RW.FX2 && RW.FX2.burst('sparkle', p.x, p.y - 0.4, 6, { c: '#bfe8ff' }); }
  C.mentalThink = function (p) {
    const g = G(), map = g.map; const m = p.mental; if (!m) return;
    const FX = RW.FX2;
    if (m.type === 'hide') { if (g.tick % 22 === 0 && FX) FX.emit('tear', p.x + (Math.random() < 0.5 ? -0.12 : 0.12), p.y - 0.55); }
    else if (m.type === 'binge' && g.tick % 90 === 0) bubble(p, '🍖', 120);
    else if (m.type === 'berserk' && g.tick % 40 === 0 && FX) FX.emit('anger', p.x, p.y - 0.85);
    if (m.type === 'tantrum') return thinkTantrum(p, m);
    if (m.type === 'runaway') return thinkRunaway(p, m);
    if (m.type === 'hide' && --m.left <= 0) { endBreak(p); return; }
    return origThink(p);
  };
  function thinkTantrum(p, m) {
    const g = G(), map = g.map; if (--m.left <= 0) { endBreak(p, 'Вгамувався після істерики.'); p.addThought('smashed'); return; }
    if (!m.tgt || m.tgt.dead) {
      let best = null, bd = 1e9;
      for (const b of map.buildings) { if (b.dead || b.def.wall || b.def.conduit || b.def.door || b.def.floor || b.def.wreck) continue; const d = Math.hypot(b.x - p.tx, b.y - p.ty); if (d < bd && d < 16 && AI.workSpot(p, b.x, b.y, b.w, b.h)) { bd = d; best = b; } }
      if (!best) { m.type = 'wander'; return; } m.tgt = best; m.swing = 0;
    }
    const b = m.tgt; const spot = AI.workSpot(p, b.x, b.y, b.w, b.h); if (!spot) { m.tgt = null; return; }
    if (!m.at) { const r = AI.moveTo(p, spot[0], spot[1]); if (r === 'fail') { m.tgt = null; return; } if (r === 'arrived') { m.at = true; AI.resetMove(p); } return; }
    p.moving = false; AI.faceTo(p, b.x + b.w / 2, b.y + b.h / 2);
    if (++m.swing % 28 === 0) {
      b.hp -= 16; const FX = RW.FX2; const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      if (FX) { FX.burst('ember', cx, cy, 5); FX.emit('anger', p.x, p.y - 0.85); FX.burst('dustpuff', cx, cy + 0.2, 2); }
      RW.R && RW.R.fx.swing(p.x, p.y, cx, cy); RW.A && RW.A.sfx('thud'); RW.R && (RW.R.shake = Math.max(RW.R.shake, 2));
      if (b.hp <= 0) { try { map.removeBuilding(b); } catch (e) { } map.allDirty = true; if (FX) FX.burst('dustpuff', cx, cy, 8); RW.R && RW.R.fx.dust(cx, cy, 10); m.tgt = null; m.at = false; p.addLog('Розтрощив ' + b.def.name.toLowerCase()); }
    }
  }
  function thinkRunaway(p, m) {
    const g = G(), map = g.map; if (!m.exit) { m.exit = nearestEdge(p, map); p.addLog('Вирішив піти з колонії.'); }
    const r = AI.moveTo(p, m.exit[0], m.exit[1]); p.moving = true;
    if (g.tick % 25 === 0 && RW.FX2) RW.FX2.emit('dustpuff', p.x, p.y + 0.3);
    if (r === 'arrived' || r === 'fail') {
      const e = ensure(g); AI.release(p); p.mental = null; p.job = null; const k = g.pawns.indexOf(p); if (k >= 0) g.pawns.splice(k, 1);
      if (g.sel && g.sel.p === p) g.sel = null;
      e.away.push({ po: p.serialize(), back: g.tick + Math.round((1.0 + Math.random() * 1.2) * DY), name: U.fullName(p) });
      RW.UI && RW.UI.letter('Втеча', U.fullName(p) + ' покинув(ла) колонію. Можливо, повернеться, коли охолоне.', 'bad', null);
    }
  }
  const origLabel = AI.jobLabel;
  AI.jobLabel = function (p) {
    if (p.mental && p.mental.type === 'tantrum') return 'Трощить меблі!'; if (p.mental && p.mental.type === 'runaway') return 'Тікає з колонії';
    if (p.mental && p.mental.type === 'hide') return 'Ховається й плаче';
    if (p.job && p.job.type === 'comfort') return 'Заспокоює ' + (p.job.who ? U.shortName(p.job.who) : ''); if (p.job && p.job.type === 'party') return 'На святі';
    if (p.inspire && p.job && p.job.type !== 'sleep') return origLabel(p) + ' ✨';
    return origLabel(p);
  };

  // ---------- Заспокоєння ----------
  AI.RUN.comfort = function (p, j) {
    const t = j.who; if (!t || t.dead || !t.mental || t.mental.type === 'berserk') return 'fail';
    if (j.stage === 0) {
      if (Math.hypot(t.x - p.x, t.y - p.y) < 1.6) { j.stage = 1; j.t = 0; AI.resetMove(p); p.moving = false; return; }
      const r = AI.moveTo(p, t.tx, t.ty, { adj: true }); if (r === 'fail') return 'fail'; if (++j.t > 700) return 'fail'; return;
    }
    p.moving = false; AI.faceTo(p, t.x, t.y); const FX = RW.FX2;
    if (j.t === 0) bubble(p, '💬', 200);
    if (++j.t % 30 === 0 && FX) FX.emit(p.rel[t.id] === 'lover' || p.rel[t.id] === 'spouse' ? 'heart' : 'sparkle', (p.x + t.x) / 2, p.y - 0.7, { c: '#ffd8a0' });
    if (j.t === 140) {
      p.gainXp('social', 30);
      const ch = clamp(0.3 + p.skillLvl('social') * 0.04 + (RW.Social.op(t, p)) / 220 + (p.has('kind') ? 0.2 : 0) - (p.has('abrasive') ? 0.15 : 0), 0.1, 0.92);
      if (Math.random() < ch && t.mental) {
        endBreak(t, 'Його заспокоїв(ла) ' + U.shortName(p) + '.'); t.addThought('comforted'); p.addThought('chitchat'); RW.Social.change(t, p, 10);
        if (FX) FX.burst('heart', t.x, t.y - 0.5, 4); RW.UI && RW.UI.toast(U.shortName(p) + ' заспокоїв(ла) ' + U.shortName(t), 'good'); RW.A && RW.A.sfx('good');
      } else { RW.UI && RW.UI.toast(U.shortName(p) + ' не зміг(ла) заспокоїти ' + U.shortName(t), 'info'); RW.Social.change(t, p, -2); }
      return 'done';
    }
  };
  function comfortScan(g) {
    for (const pt of colonists(g)) {
      if (!pt.mental || ['berserk', 'fire', 'runaway'].includes(pt.mental.type) || pt.comfortBusy && g.tick < pt.comfortBusy) continue;
      let best = null, bs = -1e9;
      for (const h of colonists(g)) {
        if (h === pt || h.mental || h.downed || h.drafted || h.sleeping || h.combatTarget || h.nearBreak) continue;
        if (h.job && !['wander', 'chat', 'stargaze', 'joy', 'pet'].includes(h.job.type)) continue;
        const d = Math.hypot(h.x - pt.x, h.y - pt.y); if (d > 22) continue;
        const sc = h.skillLvl('social') * 2 + RW.Social.op(h, pt) * 0.3 + (h.has('kind') ? 10 : 0) - d * 0.6; if (sc > bs) { bs = sc; best = h; }
      }
      if (best && g.map.reachable(best.tx, best.ty, pt.tx, pt.ty, true)) { AI.setJob(best, { type: 'comfort', who: pt }); pt.comfortBusy = g.tick + 400; }
    }
  }

  // ---------- Навички: ефекти, спад, натхнення ----------
  const P = RW.Pawn.prototype;
  const origGain = P.gainXp, origFactor = P.skillFactor;
  P.gainXp = function (sk, amt) {
    const s = this.skills[sk]; const before = s ? s.lvl : 0; origGain.call(this, sk, amt);
    if (!this.isColonist || !s) return; const g = G(); this.xpT = g.tick; this.xpSk = sk;
    if (s.lvl > before) {
      this.addLog(D.skillNames[sk] + ': новий рівень ' + s.lvl);
      if (RW.FX2) { RW.FX2.burst('star', this.x, this.y - 0.4, 3 + (s.pas ? 2 : 0)); RW.FX2.burst('sparkle', this.x, this.y - 0.4, 8); RW.FX2.emit('ringpulse', this.x, this.y + 0.3, { c: '#ffd84a', r: 1.1 }); }
      RW.A && RW.A.sfx('levelup'); bubble(this, '⭐', 220);
    }
    if (s.pas && g.tick - (this.passT || -9999) > 900) { this.passT = g.tick; this.addThought('passion_work'); }
  };
  P.skillFactor = function (sk) { let v = origFactor.call(this, sk); if (this.inspire && this.inspire.skill === sk) v += 0.4; return v; };
  Life.tryInspire = function (p) {
    const g = G(); if (p.inspire || p.mental || p.downed || p.mood < 68) return false;
    const pas = SK.filter(s => p.skills[s].pas); const sk = (pas.length && Math.random() < 0.65) ? U.pick(pas) : U.pick(SK);
    p.inspire = { skill: sk, left: Math.round(1.2 * DY) }; p.addThought('inspired'); bubble(p, '✨', 500);
    if (RW.FX2) { RW.FX2.burst('star', p.x, p.y - 0.5, 5); RW.FX2.burst('sparkle', p.x, p.y - 0.4, 12); RW.FX2.emit('ringpulse', p.x, p.y + 0.3, { c: '#ffe27a', r: 1.6 }); }
    RW.UI && RW.UI.letter('Натхнення', U.fullName(p) + ' охоплений(а) натхненням: ' + D.skillNames[sk] + ' (+ швидкість і якість на ~добу).', 'good', p); RW.A && RW.A.sfx('good'); return true;
  };
  function hourly(g) {
    for (const p of colonists(g)) { if (!p.inspire && !p.sleeping && Math.random() < 0.0065 * (p.mood > 85 ? 1.6 : 1)) Life.tryInspire(p); }
  }
  function daily(g) {
    for (const p of colonists(g)) {
      for (const sk of SK) {
        const s = p.skills[sk]; if (s.lvl < 8) continue; if (p.xpSk === sk && g.tick - (p.xpT || 0) < DY) continue;
        s.xp -= (s.lvl - 6) * 2.4 * (s.pas ? 0.5 : 1);
        if (s.xp < 0) { if (s.lvl > 0 && !(s.pas === 2 && s.lvl < 14)) { s.lvl--; s.xp = (70 + 30 * s.lvl) * 0.55; p.addLog(D.skillNames[sk] + ' слабшає без практики (' + s.lvl + ')'); } else s.xp = 0; }
      }
    }
  }

  // ---------- Покращений авто-тик ----------
  Life.tick = function (g) {
    const e = ensure(g); const tick = g.tick;
    if (tick % 150 === 0) for (const p of colonists(g)) { (p.moodHist = p.moodHist || []).push(Math.round(p.mood)); if (p.moodHist.length > 64) p.moodHist.shift(); }
    if (tick % 90 === 0) comfortScan(g);
    if (tick % HR === 0) hourly(g);
    if (tick % DY === 0 && tick > 0) daily(g);
    if (tick % 30 === 0) {
      for (const p of g.pawns) {
        if (p.inspire) { p.inspire.left -= 30; if (p.inspire.left <= 0) { p.inspire = null; p.addLog('Натхнення минуло.'); } else if (RW.FX2 && Math.random() < 0.35) RW.FX2.emit('sparkle', p.x + (Math.random() - 0.5) * 0.7, p.y - 0.2 - Math.random() * 0.6); }
      }
    }
    // повернення втікачів
    if (e.away.length && tick % 60 === 0) {
      for (let k = e.away.length - 1; k >= 0; k--) {
        const a = e.away[k]; if (tick < a.back) continue; e.away.splice(k, 1);
        const sp = RW.Events.edgeSpawn(g.map, g.home); const p = RW.Pawn.deserialize(a.po); p.x = sp.x + 0.5; p.y = sp.y + 0.5; p.mental = null; p.drafted = false; p.job = null; p.thoughts = []; p.needs.food = 0.55; p.needs.rest = 0.6; p.id = a.po.id; p.warnT = tick;
        g.pawns.push(p); p.addThought('ran_away'); p.addThought('catharsis'); p.addLog('Повернувся до колонії.');
        RW.UI && RW.UI.letter('Повернення', U.fullName(p) + ' повернувся(лась) до колонії.', 'good', p, { x: sp.x, y: sp.y });
      }
    }
  };
  // ---------- Малювання ----------
  const AURA = { berserk: '255,50,40', tantrum: '255,160,40', fight: '255,90,70', insult: '190,100,255', fire: '255,120,30', hide: '90,160,255', wander: '120,140,200', binge: '230,170,90', runaway: '200,200,200' };
  Life.auraUnder = function (c, p, px, py, t) {
    if (p.faction !== 'colony') return;
    if (p.mental) { const k = AURA[p.mental.type] || '255,80,80'; const a = 0.28 + 0.14 * Math.sin(t * 0.18); const r = 15 + Math.sin(t * 0.18) * 2; const gr = c.createRadialGradient(px, py + 5, 2, px, py + 5, r); gr.addColorStop(0, 'rgba(' + k + ',' + a.toFixed(2) + ')'); gr.addColorStop(1, 'rgba(' + k + ',0)'); c.fillStyle = gr; c.beginPath(); c.ellipse(px, py + 5, r, r * 0.55, 0, 0, TAU); c.fill(); }
    if (p.inspire) { const a = 0.35 + 0.15 * Math.sin(t * 0.12); const gr = c.createRadialGradient(px, py + 4, 1, px, py + 4, 17); gr.addColorStop(0, 'rgba(255,230,120,' + a.toFixed(2) + ')'); gr.addColorStop(1, 'rgba(255,200,60,0)'); c.fillStyle = gr; c.beginPath(); c.ellipse(px, py + 4, 17, 9, 0, 0, TAU); c.fill(); }
    else if (p.nearBreak) { c.strokeStyle = 'rgba(255,210,70,' + (0.3 + 0.2 * Math.sin(t * 0.2)).toFixed(2) + ')'; c.lineWidth = 1.3; c.beginPath(); c.ellipse(px, py + 6, 11, 5, 0, 0, TAU); c.stroke(); }
    if (p.ill && p.ill.some(il => D.illnesses[il.id].cont && il.sev > 0.1)) { c.fillStyle = 'rgba(140,210,60,' + (0.14 + 0.05 * Math.sin(t * 0.15)).toFixed(2) + ')'; c.beginPath(); c.ellipse(px, py + 5, 13, 6, 0, 0, TAU); c.fill(); }
  };
  Life.bubbleOver = function (c, p, px, py, t, zoom) {
    if (zoom < 0.6 || p.dead) return; const g = G(); let ico = null;
    if (p.bub && g.tick < p.bub.until) ico = p.bub.ico;
    else if (p.mental) ico = ICO[p.mental.type];
    if (!ico) return;
    const bob = Math.sin(t * 0.1 + p.id) * 1.5; const y = py - 28 + bob; c.save(); c.fillStyle = 'rgba(14,18,24,0.88)'; c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 1;
    c.beginPath(); c.roundRect ? c.roundRect(px - 10, y - 10, 20, 18, 7) : c.rect(px - 10, y - 10, 20, 18); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(px - 3, y + 8); c.lineTo(px, y + 12); c.lineTo(px + 3, y + 8); c.fillStyle = 'rgba(14,18,24,0.88)'; c.fill();
    c.font = '12px "Segoe UI Emoji","Noto Color Emoji",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(ico, px, y - 0.5); c.restore();
  };
})();
