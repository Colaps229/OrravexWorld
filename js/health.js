// ============================================================
//  health.js — шрами, хронічні хвороби, протези, операції, епідемії, схема тіла
// ============================================================
(function () {
  'use strict';
  const RW = window.RW; const D = RW.D, U = RW.U, AI = RW.AI; const G = () => RW.G; const DY = D.DAY, HR = D.HOUR;
  const H = RW.Health = {}; const P = RW.Pawn.prototype; const L = RW.Life; const TAU = Math.PI * 2;
  const name = U.shortName;
  // ---------- Предмети та рецепти протезів ----------
  const add = (id, o) => { o.id = id; o.stack = 5; o.cat = 'medicine'; D.items[id] = o; };
  add('prost_leg', { name: 'Дерев\'яна нога', value: 40, color: '#8a5a2a', prost: { kind: 'leg', eff: 0.6, bionic: false } });
  add('prost_arm', { name: 'Дерев\'яна рука-гак', value: 40, color: '#8a5a2a', prost: { kind: 'arm', eff: 0.55, bionic: false } });
  add('bionic_leg', { name: 'Бионічна нога', value: 600, color: '#6ad0e8', prost: { kind: 'leg', eff: 1.22, bionic: true } });
  add('bionic_arm', { name: 'Бионічна рука', value: 600, color: '#6ad0e8', prost: { kind: 'arm', eff: 1.22, bionic: true } });
  D.itemCats = D.itemCats || {};
  D.recipes.prost_leg = { name: 'Дерев\'яна нога', bench: ['workbench'], skill: 'crafting', work: 600, ing: [{ item: 'wood', n: 30 }], out: 'prost_leg', n: 1 };
  D.recipes.prost_arm = { name: 'Дерев\'яна рука-гак', bench: ['workbench'], skill: 'crafting', work: 520, ing: [{ item: 'wood', n: 22 }, { item: 'steel', n: 4 }], out: 'prost_arm', n: 1 };
  D.recipes.bionic_leg = { name: 'Бионічна нога', bench: ['machining'], skill: 'crafting', work: 2600, ing: [{ item: 'steel', n: 40 }, { item: 'components', n: 6 }], out: 'bionic_leg', n: 1, research: 'medicine' };
  D.recipes.bionic_arm = { name: 'Бионічна рука', bench: ['machining'], skill: 'crafting', work: 2600, ing: [{ item: 'steel', n: 40 }, { item: 'components', n: 6 }], out: 'bionic_arm', n: 1, research: 'medicine' };
  const KIND = { lleg: 'leg', rleg: 'leg', larm: 'arm', rarm: 'arm' };
  H.partKind = id => KIND[id];

  // ---------- Хронічні ----------
  const CH = H.CHRONIC = {
    bad_back: { l: 'Поганий поперек', ico: '🦴', move: 0.88 }, arthritis: { l: 'Артрит', ico: '🖐', manip: 0.82 },
    cataract: { l: 'Катаракта', ico: '👁', cons: 0.92, shoot: 0.7 }, asthma: { l: 'Астма', ico: '🫁', move: 0.9 },
    hearing: { l: 'Втрата слуху', ico: '👂', social: 0.6 }, chronic_pain: { l: 'Хронічний біль', ico: '⚡', pain: 0.12 }
  };

  // ---------- Обгортка updateCap: протези + хронічні ----------
  const origCap = P.updateCap;
  P.updateCap = function () {
    origCap.call(this);
    const pr = this.prost; const ch = this.chronic;
    if (this.drunk > 0) { this.cap.manip *= 0.72; this.cap.cons *= 0.9; }
    if (!pr && !(ch && ch.length)) return;
    let illMove = 0, illCons = 0; for (const il of this.ill) { const d = D.illnesses[il.id]; illMove += (d.move || 0) * il.sev; illCons += (d.cons || 0) * il.sev; }
    const fM = (1 - this.pain * 0.35) * (1 - illMove), fP = (1 - this.pain * 0.2) * (1 - illCons * 0.5);
    if (pr) {
      const pe = id => { const o = this.part(id); if (!o.missing) return null; const it = pr[id]; return it ? D.items[it].prost.eff : 0; };
      let bl = 0; const ll = pe('lleg'), rl = pe('rleg');
      if (ll != null || rl != null) { if (ll != null && rl != null && ll === 0 && rl === 0) { } else { if (ll === 0 || rl === 0 || ll == null || rl == null) { } } }
      const lm = this.part('lleg').missing, rm = this.part('rleg').missing;
      if (lm || rm) { const bonus = ((lm ? ll : 0) + (rm ? rl : 0)) / 2; const base = (lm && rm) ? -0.12 : 0; this.cap.move = U.clamp(this.cap.move + (bonus + base) * fM, 0, 1.4); }
      const am = this.part('larm').missing, bm = this.part('rarm').missing;
      if (am || bm) { const bonus = ((am ? pe('larm') : 0) + (bm ? pe('rarm') : 0)) / 2; this.cap.manip = U.clamp(this.cap.manip + bonus * fP, 0.05, 1.4); }
    }
    if (ch) for (const c of ch) { const d = CH[c.id]; if (!d) continue; if (d.move) this.cap.move *= d.move; if (d.manip) this.cap.manip *= d.manip; if (d.cons) this.cap.cons *= d.cons; if (d.pain) this.pain = Math.min(1.4, this.pain + d.pain); }
    if (this.downed && !(this.cap.move < 0.14 || (this.cap.cons < 0.3 && !this.sleeping) || this.pain > 0.82) && !this.dead) { this.downed = false; this.addLog('Став на ноги (протез)'); }
  };
  // ---------- Обгортка tickHealth: шрами, імунітет, кашель, краплі ----------
  const origTH = P.tickHealth;
  P.tickHealth = function () {
    const before = this.injuries.length, illBefore = this.ill.length;
    for (const i of this.injuries) if (i.type !== 'missing') i.peak = Math.max(i.peak || 0, i.amt);
    let snapInj = null, snapIll = null;
    if (before) snapInj = this.injuries.slice(); if (illBefore) snapIll = this.ill.map(x => x.id);
    origTH.call(this); if (this.dead) return;
    if (snapInj && this.injuries.length < before) {
      for (const i of snapInj) if (!this.injuries.includes(i) && i.type !== 'missing' && (i.peak || 0) >= 6 && Math.random() < Math.min(0.9, (i.peak || 0) / 16)) H.addScar(this, i);
    }
    if (snapIll && this.ill.length < illBefore) {
      const left = this.ill.map(x => x.id);
      for (const id of snapIll) if (!left.includes(id) && D.illnesses[id] && !D.illnesses[id].env) { this.immune = this.immune || {}; this.immune[id] = G().tick + 14 * DY; if (D.illnesses[id].cont && this.isColonist) this.addThought('vaccinated'); }
    }
    if (this.isColonist) {
      const g = G();
      if (this.bleedRate > 0.00003 && g.tick % 38 === 0 && RW.FX2) RW.FX2.emit('drop', this.x + (Math.random() - 0.5) * 0.3, this.y + 0.2);
      if (this.ill.length && g.tick % 55 === (this.id % 55)) { const c = this.ill.find(il => D.illnesses[il.id].cont && il.sev > 0.12); if (c && RW.FX2) { RW.FX2.emit('cough', this.x, this.y - 0.5, { dx: (Math.random() - 0.5) * 1.6 }); if (Math.random() < 0.35 && RW.A) RW.A.sfx('cough'); } }
    }
  };
  H.addScar = function (p, inj) {
    if (!p.isColonist) return; p.scars = p.scars || []; const bp = D.bodyParts.find(b => b.id === inj.part); if (!bp) return;
    p.scars.push({ part: inj.part, type: inj.type, t: G().tick }); p.addThought('scarred'); p.addLog('Залишився шрам: ' + bp.name.toLowerCase() + ' (' + D.injuryTypes[inj.type].l.toLowerCase() + ')');
    if ((inj.peak || 0) >= 14 && Math.random() < 0.25) H.addChronic(p, inj.part === 'head' ? 'cataract' : (KIND[inj.part] === 'leg' ? 'bad_back' : 'arthritis'));
  };
  H.addChronic = function (p, id) {
    p.chronic = p.chronic || []; if (p.chronic.some(c => c.id === id)) return false; p.chronic.push({ id, t: G().tick });
    p.addLog('Хронічне: ' + CH[id].l); RW.UI && RW.UI.letter('Хронічна недуга', U.fullName(p) + ': ' + CH[id].l + '.', 'warn', p); p.updateCap(); return true;
  };

  // ---------- Операція: встановлення протеза ----------
  H.findProsthesis = function (partId) { const map = G().map; const kind = KIND[partId]; const out = []; for (const id in D.items) { const d = D.items[id]; if (d.prost && d.prost.kind === kind && map.count(id) > 0) out.push(id); } return out; };
  H.bestDoctor = function (g) { let b = null, bs = -1; for (const p of g.pawns) { if (p.faction !== 'colony' || p.dead || p.downed || p.mental || p.disabled && p.disabled.includes && p.disabled.includes('medicine')) continue; const s = p.skillLvl('medicine'); if (s > bs) { bs = s; b = p; } } return b; };
  H.order = function (p, partId, itemId) {
    const g = G(); const doc = H.bestDoctor(g); if (!doc) { RW.UI && RW.UI.toast('Немає лікаря', 'bad'); return; }
    const it = g.map.items.find ? null : null; AI.setJob(doc, { type: 'surgery', who: p, part: partId, item: itemId, stage: 0, t: 0 });
    RW.UI && RW.UI.toast(name(doc) + ' готується до операції для ' + name(p), 'info');
  };
  AI.RUN.surgery = function (p, j) {
    const g = G(), map = g.map; const pt = j.who; if (!pt || pt.dead || !pt.part(j.part).missing) return 'fail';
    if (j.stage === 0) { // знайти предмет
      const m = AI.pickItem ? AI.pickItem(p, [j.item], null, 200) : null; if (!m) { RW.UI && RW.UI.toast('Немає протеза ' + D.items[j.item].name, 'bad'); return 'fail'; }
      j.it = m; AI.reserve && AI.reserve(p, m); j.stage = 1; AI.resetMove(p); return;
    }
    if (j.stage === 1) {
      const m = j.it; if (!m || m.dead) return 'fail'; const r = AI.moveTo(p, m.i % map.w, (m.i / map.w) | 0); if (r === 'fail') return 'fail';
      if (r === 'arrived') { map.takeItem(m, 1); p.carry = { def: j.item, n: 1 }; j.stage = 2; AI.resetMove(p); } return;
    }
    if (j.stage === 2) {
      const r = AI.moveTo(p, pt.tx, pt.ty, { adj: true }); if (r === 'fail') return 'fail';
      if (r === 'arrived') { j.stage = 3; j.t = 0; p.moving = false; pt.opBed = true; } return;
    }
    p.moving = false; AI.faceTo(p, pt.x, pt.y); const d = D.items[j.item];
    j.t += p.workSpeed('medicine') * (pt.bedDef && pt.bedDef.med ? 1.2 : 1); p.gainXp('medicine', 0.25);
    if (g.tick % 18 === 0 && RW.FX2) { RW.FX2.emit('sparkle', pt.x + (Math.random() - 0.5) * 0.6, pt.y - 0.3, { c: '#8affc0' }); }
    if (g.tick % 60 === 0 && RW.R) RW.R.fx.text(pt.x, pt.y - 0.9, '✚', '#7f7');
    if (j.t >= (d.prost.bionic ? 420 : 240)) {
      p.carry = null; const ch = U.clamp(0.5 + 0.045 * p.skillLvl('medicine') - (d.prost.bionic ? 0.12 : 0) + (pt.bedDef && pt.bedDef.med ? 0.08 : 0), 0.2, 0.97);
      if (Math.random() < ch) {
        pt.prost = pt.prost || {}; pt.prost[j.part] = j.item; pt.updateCap(); pt.addThought(d.prost.bionic ? 'bionic_joy' : 'prosthetic_shame'); pt.addThought('surgery_ok');
        pt.addLog('Встановлено: ' + d.name); RW.UI && RW.UI.letter('Операція', name(p) + ' встановив(ла) ' + name(pt) + ' ' + d.name.toLowerCase() + '.', 'good', pt); RW.A && RW.A.sfx('good');
        if (RW.FX2) { RW.FX2.burst('sparkle', pt.x, pt.y - 0.3, 14, { c: d.prost.bionic ? '#7ae0ff' : '#ffe9a0' }); RW.FX2.emit('ringpulse', pt.x, pt.y + 0.3, { c: '#7aff9a', r: 1.5 }); }
      } else {
        pt.addThought('surgery_bad'); pt.injuries.push({ id: U.nextId(), part: 'torso', type: 'cut', amt: 6, bleed: 0.0003, tended: 0, age: 0, perm: false }); pt.updateCap(); pt.addLog('Операція невдала!');
        RW.UI && RW.UI.letter('Невдала операція', name(p) + ' зіпсував(ла) операцію ' + name(pt) + '. Протез втрачено.', 'bad', pt); RW.A && RW.A.sfx('bad');
        if (RW.FX2) RW.FX2.burst('drop', pt.x, pt.y, 8);
      } return 'done';
    }
  };
  // ---------- Малювання протезів, бинтів ----------
  H.bodyOverlay = function (c, p, px, py) {
    if (p.downed || p.sleeping || p.dead) return;
    const pr = p.prost; const front = true;
    c.save(); c.translate(px, py);
    if (pr) {
      const leg = (x, id) => { const bi = D.items[id].prost.bionic; if (bi) { c.fillStyle = '#9fb4c0'; c.fillRect(x, 1.6, 2.8, 5.2); c.fillStyle = '#6ad0e8'; c.fillRect(x + 1.2, 2, 0.5, 4.4); c.fillStyle = '#4a5a64'; c.fillRect(x - 0.2, 6.4, 3.2, 1.4); c.strokeStyle = 'rgba(10,20,30,.8)'; c.lineWidth = 0.6; c.strokeRect(x, 1.6, 2.8, 5.2); } else { c.fillStyle = '#9a6a38'; c.fillRect(x + 0.7, 1.6, 1.5, 5.4); c.fillStyle = '#5a3a1a'; c.fillRect(x + 0.4, 7, 2.1, 0.9); c.fillStyle = '#6a4220'; c.fillRect(x, 1.4, 2.8, 1.2); } };
      if (p.part('lleg').missing) { c.fillStyle = 'rgba(0,0,0,0.0)'; leg(-3.4, pr.lleg || 'prost_leg'); if (!pr.lleg) { c.fillStyle = p.look.pants; c.fillRect(-3.8, 1, 3.4, 2); } }
      if (p.part('rleg').missing) { leg(0.6, pr.rleg || 'prost_leg'); }
      const arm = (x, id) => { const bi = D.items[id].prost.bionic; c.fillStyle = bi ? '#9fb4c0' : '#8a5a2a'; c.fillRect(x, -4.5, 2.2, 5.5); if (bi) { c.fillStyle = '#6ad0e8'; c.fillRect(x + 0.8, -4, 0.5, 4.5); c.fillStyle = '#4a5a64'; c.fillRect(x - 0.2, 0.6, 2.6, 1.3); } else { c.fillStyle = '#5a3a1a'; c.beginPath(); c.arc(x + 1.1, 1.8, 1.2, 0.2, 3); c.stroke(); } };
      if (pr.larm && p.part('larm').missing) arm(-7, pr.larm); if (pr.rarm && p.part('rarm').missing) arm(4.8, pr.rarm);
    }
    // бинти на лікованих ранах
    let k = 0; for (const i of p.injuries) { if (i.type === 'missing' || i.perm) continue; const tended = i.tended > 0;
      const pos = { head: [0, -9, 4, 2], torso: [-3, -3, 6, 2], larm: [-7, -3, 2.4, 2], rarm: [4.6, -3, 2.4, 2], lleg: [-3.6, 2, 3, 2], rleg: [0.6, 2, 3, 2] }[i.part]; if (!pos) continue;
      if (tended) { c.fillStyle = 'rgba(240,240,235,0.95)'; c.fillRect(pos[0], pos[1], pos[2], pos[3]); c.fillStyle = 'rgba(190,40,40,0.8)'; c.fillRect(pos[0] + pos[2] / 2 - 0.5, pos[1] + 0.4, 1, pos[3] - 0.8); }
      else if (i.bleed > 0.00003 || i.amt > 2) { c.fillStyle = 'rgba(170,20,20,0.85)'; c.beginPath(); c.arc(pos[0] + pos[2] / 2, pos[1] + pos[3] / 2, 1.3 + Math.min(1.2, i.amt / 12), 0, TAU); c.fill(); }
    }
    c.restore();
  };
  // ---------- Схема тіла ----------
  const bodyCache = new Map();
  H.bodyImg = function (p) {
    const key = p.id + '|' + p.parts.map(x => x.missing ? 1 : 0).join('') + '|' + D.bodyParts.map(b => Math.round(p.partDamage(b.id) / b.hp * 6)).join('') + '|' + p.injuries.map(i => i.tended > 0 ? 1 : 0).join('') + '|' + JSON.stringify(p.prost || {}) + (p.scars ? p.scars.length : 0);
    let u = bodyCache.get(key); if (u) return u; if (bodyCache.size > 200) bodyCache.clear();
    const cv = document.createElement('canvas'); cv.width = 110; cv.height = 170; const c = cv.getContext('2d');
    const col = id => { const o = p.part(id); const bp = D.bodyParts.find(b => b.id === id); if (o.missing) return null; const f = U.clamp(p.partDamage(id) / o.max, 0, 1); return f < 0.05 ? '#5ea85a' : f < 0.35 ? '#a8c24a' : f < 0.7 ? '#e0a030' : '#d0402e'; };
    const fillP = (id, draw) => { const cc = col(id); c.beginPath(); draw(); if (cc) { const g2 = c.createLinearGradient(0, 0, 110, 0); g2.addColorStop(0, cc); g2.addColorStop(1, cc); c.fillStyle = cc; c.fill(); c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 1.2; c.stroke(); } else if (p.prost && p.prost[id]) { const bi = D.items[p.prost[id]].prost.bionic; c.fillStyle = bi ? '#8fb8c8' : '#a06a34'; c.fill(); c.strokeStyle = bi ? '#3a7a90' : '#5a3a1a'; c.lineWidth = 1.5; c.stroke(); } else { c.setLineDash([3, 3]); c.strokeStyle = '#888'; c.lineWidth = 1; c.stroke(); c.setLineDash([]); } };
    const rr = (x, y, w, h, r) => { c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
    fillP('head', () => c.ellipse(55, 20, 15, 17, 0, 0, TAU)); fillP('torso', () => rr(35, 40, 40, 58, 10));
    fillP('larm', () => rr(15, 42, 16, 62, 7)); fillP('rarm', () => rr(79, 42, 16, 62, 7)); fillP('lleg', () => rr(36, 101, 17, 62, 7)); fillP('rleg', () => rr(57, 101, 17, 62, 7));
    for (const i of p.injuries) { if (i.type === 'missing') continue; const pos = { head: [55, 20], torso: [55, 68], larm: [23, 72], rarm: [87, 72], lleg: [44, 132], rleg: [66, 132] }[i.part]; if (!pos) continue; if (i.tended > 0) { c.fillStyle = '#f4f4ee'; c.fillRect(pos[0] - 9, pos[1] - 3, 18, 6); c.fillStyle = '#c03030'; c.fillRect(pos[0] - 1, pos[1] - 3, 2, 6); } else { c.fillStyle = '#7a0f0f'; c.beginPath(); c.arc(pos[0] + (i.id % 5) - 2, pos[1] + (i.id % 7) - 3, 2.5 + Math.min(3, i.amt / 5), 0, TAU); c.fill(); } }
    if (p.scars) for (const s of p.scars) { const pos = { head: [55, 14], torso: [48, 54], larm: [23, 60], rarm: [87, 60], lleg: [44, 120], rleg: [66, 120] }[s.part]; if (!pos) continue; c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(pos[0] - 4, pos[1] - 3); c.lineTo(pos[0] + 4, pos[1] + 4); c.moveTo(pos[0] - 2, pos[1] + 2); c.lineTo(pos[0] + 2, pos[1] - 2); c.stroke(); }
    u = cv.toDataURL(); bodyCache.set(key, u); return u;
  };
  H.healthExtra = function (p) {
    let h = '<div class="hbody"><img src="' + H.bodyImg(p) + '" width="88" height="136">';
    h += '<div class="hside">';
    if (p.chronic && p.chronic.length) for (const c of p.chronic) h += '<div class="inj neg">' + CH[c.id].ico + ' ' + CH[c.id].l + '</div>';
    if (p.scars && p.scars.length) h += '<div class="inj">🩹 Шрами: ' + p.scars.length + '</div>';
    if (p.prost) for (const k in p.prost) h += '<div class="inj pos">' + (D.items[p.prost[k]].prost.bionic ? '🦾 ' : '🦿 ') + D.items[p.prost[k]].name + '</div>';
    if (p.immune) { const g = G(); const im = Object.keys(p.immune).filter(k => p.immune[k] > g.tick); if (im.length) h += '<div class="inj pos">💉 Імунітет: ' + im.map(k => D.illnesses[k].l).join(', ') + '</div>'; }
    for (const bp of D.bodyParts) { if (!p.part(bp.id).missing || !KIND[bp.id]) continue; const opts = H.findProsthesis(bp.id); const cur = p.prost && p.prost[bp.id];
      if (cur) continue; h += '<div class="inj">' + bp.name + ': ' + (opts.length ? opts.map(o => '<button data-act="prost" data-a="' + bp.id + '" data-b="' + o + '">Встановити: ' + D.items[o].name + '</button>').join(' ') : '<span class="sub">протез не виготовлено (Верстак)</span>') + '</div>'; }
    return h + '</div></div>';
  };

  // ---------- Епідемії ----------
  D.illnesses.flu.cont = 0.55; D.illnesses.plague.cont = 0.3; D.illnesses.cold = { l: 'Застуда', sev: 0.00005, imm: 0.00008, lethal: false, cons: 0.12, move: 0.08, cont: 0.8 };
  D.illnesses.fever = { l: 'Лихоманка', sev: 0.00008, imm: 0.00006, lethal: true, cons: 0.4, move: 0.25, pain: 0.1, cont: 0.45 };
  D.illnesses.flu.l = 'Грип';
  H.canCatch = (p, id) => { const g = G(); return !p.ill.some(i => i.id === id) && !(p.immune && p.immune[id] > g.tick); };
  H.infect = function (p, id, sev) { if (!H.canCatch(p, id)) return false; p.addIllness(id, sev || 0.06); if (RW.FX2) RW.FX2.burst('spore', p.x, p.y - 0.3, 5); return true; };
  H.spread = function (g) {
    const cs = g.pawns.filter(p => !p.dead && (p.faction === 'colony' || p.isTrader)); const sick = cs.filter(p => p.ill.some(il => D.illnesses[il.id].cont && il.sev > 0.1));
    const e = L.ensure(g); const prev = e.epiN || 0; e.epiN = sick.filter(p => p.faction === 'colony').length;
    for (const s of sick) for (const il of s.ill) {
      const d = D.illnesses[il.id]; if (!d.cont || il.sev < 0.1) continue;
      for (const o of cs) { if (o === s || o.ill.some(x => x.id === il.id)) continue; const dist = Math.hypot(o.x - s.x, o.y - s.y); const sameRoom = g.map.room[s.ty * g.map.w + s.tx] >= 0 && g.map.room[s.ty * g.map.w + s.tx] === g.map.room[o.ty * g.map.w + o.tx];
        if (dist > 2.6 && !(sameRoom && dist < 6)) continue; let pr = d.cont * 0.012 * (1 - il.tend * 0.5) * (dist < 1.6 ? 2 : 1); if (o.sleeping && sameRoom) pr *= 1.4; if (Math.random() < pr && H.canCatch(o, il.id)) { H.infect(o, il.id, 0.05); if (o.faction === 'colony') RW.UI && RW.UI.toast(name(o) + ' підхопив(ла) ' + d.l.toLowerCase() + ' від ' + name(s), 'bad'); } }
    }
    if (e.epiN >= 3 && prev < 3) { RW.UI && RW.UI.letter('Епідемія!', 'Хвороба поширюється колонією: хворіє ' + e.epiN + ' колоністів. Ізолюйте хворих у лікарняних ліжках, подбайте про ліки.', 'bad', null); RW.A && RW.A.sfx('alert'); }
    H.updateBadge(g, e);
  };
  H.epidemicNear = function (p) { const g = G(); return (g.ext && g.ext.epiN >= 2) && !p.ill.some(i => D.illnesses[i.id].cont); };
  L.epidemicNear = H.epidemicNear;
  H.outbreak = function (g, forced) {
    const cs = g.pawns.filter(p => p.faction === 'colony' && !p.dead && !p.ill.some(i => D.illnesses[i.id].cont)); if (!cs.length) return false;
    const pool = [['cold', 5], ['flu', 4], ['fever', 1.6], ['plague', 0.6]]; const id = U.weighted(pool, o => o[1])[0]; const p = U.pick(cs.filter(x => H.canCatch(x, id)) .concat([]));
    if (!p) return false; H.infect(p, id, 0.1); RW.UI && RW.UI.letter('Спалах хвороби', U.fullName(p) + ' захворів(ла): ' + D.illnesses[id].l + '. Це заразно — тримайте відстань!', 'warn', p); return true;
  };
  H.updateBadge = function (g, e) {
    let el = document.getElementById('epiBadge'); if (!el) { el = document.createElement('div'); el.id = 'epiBadge'; document.body.appendChild(el); }
    const n = e.epiN || 0; el.style.display = n >= 1 ? 'block' : 'none'; if (n >= 1) { el.className = n >= 3 ? 'epi hot' : 'epi'; el.innerHTML = '🦠 Хворіють: <b>' + n + '</b>' + (n >= 3 ? ' — епідемія!' : ''); }
  };
  H.tick = function (g) {
    if (g.tick % 60 === 0) H.spread(g);
    if (g.tick % DY === 2100 && g.tick > 12 * DY && Math.random() < 0.035) H.outbreak(g);
    if (g.tick % DY === 900) { for (const p of g.pawns) { if (p.faction !== 'colony' || p.dead) continue; if (p.age > 50 && Math.random() < 0.012 * (p.age - 45) / 10) H.addChronic(p, U.pick(['bad_back', 'arthritis', 'cataract', 'hearing', 'asthma'])); } }
  };
  const lt = L.tick; L.tick = function (g) { lt(g); H.tick(g); };
  H.onGameStart = function () { const b = document.getElementById('epiBadge'); if (b) b.style.display = 'none'; };
})();
