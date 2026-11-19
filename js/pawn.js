'use strict';
// ============================================================
//  pawn.js — колоністи, вороги, тварини: генерація, потреби,
//  настрій, здоров'я, поранення, хвороби, соціальні взаємини
// ============================================================
(function () {
  const D = RW.D, U = RW.U;
  const G = () => RW.G;

  const SKILL_NEED = l => 70 + 30 * l;
  const PASSION_MUL = [0.35, 1.0, 1.6];

  class Pawn {
    constructor() {
      this.kind = 'pawn';
      this.id = U.nextId();
      this.faction = 'colony';
      this.x = 0; this.y = 0; this.path = null; this.pi = 0; this.face = 0; this.phase = 0; this.moving = false;
      this.needs = { food: 0.85, rest: 0.9, joy: 0.6 };
      this.tol = {};
      this.thoughts = []; this.sit = []; this.mood = 50; this.moodTimer = 0;
      this.parts = D.bodyParts.map(b => ({ id: b.id, max: b.hp, missing: false }));
      this.injuries = []; this.ill = []; this.blood = 1; this.pain = 0;
      this.cap = { move: 1, manip: 1, cons: 1 };
      this.equip = { weapon: null, apparel: null };
      this.carry = null;
      this.work = {}; D.workTypes.forEach(w => this.work[w.id] = 3);
      this.sched = []; for (let h = 0; h < 24; h++) this.sched.push(h >= 22 || h < 6 ? 'sleep' : 'any');
      this.job = null; this.drafted = false; this.downed = false; this.dead = false; this.sleeping = false;
      this.mental = null; this.opinion = {}; this.rel = {}; this.log = [];
      this.target = null; this.orderPos = null; this.aim = 0; this.cool = 0; this.stun = 0; this.hurtT = 0;
      this.bed = null; this.lastSocial = 0; this.idleT = 0; this.sleepFrom = 0; this.bubble = null; this.tendT = 0;
      this.kills = 0; this.ownerTag = null;
    }
    get name_() { return U.fullName(this); }
    has(t) { return this.traits.indexOf(t) >= 0; }
    tmul(key) { let m = 1; for (const t of this.traits) { const d = TRAITS[t]; if (d && d[key] != null) m *= d[key]; } return m; }
    tadd(key) { let m = 0; for (const t of this.traits) { const d = TRAITS[t]; if (d && d[key] != null) m += d[key]; } return m; }
    get tx() { return Math.floor(this.x); }
    get ty() { return Math.floor(this.y); }
    get isColonist() { return this.faction === 'colony'; }
    get isEnemy() { return this.faction === 'enemy'; }
    get violent() { return !this.noViolence; }

    // ----- Навички -----
    skillLvl(sk) { return this.skills[sk] ? this.skills[sk].lvl : 0; }
    skillFactor(sk) { return 0.45 + 0.07 * this.skillLvl(sk); }
    gainXp(sk, amt) {
      const s = this.skills[sk]; if (!s || s.lvl >= 20) return;
      s.xp += amt * PASSION_MUL[s.pas];
      while (s.lvl < 20 && s.xp >= SKILL_NEED(s.lvl)) { s.xp -= SKILL_NEED(s.lvl); s.lvl++; if (this.isColonist) { RW.UI && RW.UI.toast(U.shortName(this) + ': ' + D.skillNames[sk] + ' → ' + s.lvl, 'good'); this.addLog(D.skillNames[sk] + ' піднялась до рівня ' + s.lvl); } }
    }
    workSpeed(sk) {
      let v = (sk ? this.skillFactor(sk) : 1) * this.cap.manip * this.cap.cons * this.tmul('work');
      if (this.mood < 20) v *= 0.85;
      return Math.max(0.05, v);
    }
    canDo(wt) {
      const def = D.workTypes.find(w => w.id === wt);
      if (this.disabled.indexOf(wt) >= 0) return false;
      if (def && def.violent && this.noViolence) return false;
      return true;
    }
    moveSpeed() {
      let s = 0.056 * this.cap.move * this.tmul('move');
      if (this.carry && this.carry.n > 30) s *= 0.9;
      return s;
    }

    // ----- Думки -----
    addThought(id, mult) {
      const d = D.thoughts[id]; if (!d) return;
      if (d.blood && !this.has('bloodlust')) { if (this.has('psychopath')) { /* ok */ } }
      let v = d.v * (mult || 1);
      if (d.blood && this.has('bloodlust')) v = Math.abs(v) * 1.5;
      if ((id === 'saw_corpse' || id === 'colonist_died' || id === 'friend_died') && this.has('psychopath')) return;
      const stack = d.stack || 1; const same = this.thoughts.filter(t => t.id === id);
      if (same.length >= stack) { same[0].left = d.dur; same[0].v = v; return; }
      this.thoughts.push({ id, l: d.l, v, left: d.dur });
    }
    computeMood() {
      let m = 50; const sit = [];
      const add = (l, v) => { if (v) { sit.push({ l, v }); m += v; } };
      for (const t of this.traits) { const d = TRAITS[t]; if (d && d.mood) add(d.name, d.mood); }
      const n = this.needs;
      if (n.food < 0.02) add('Голодує', -22); else if (n.food < 0.15) add('Дуже голодний', -13); else if (n.food < 0.3) add('Голодний', -6);
      if (n.rest < 0.08) add('Виснажений', -14); else if (n.rest < 0.25) add('Втомлений', -6);
      if (n.joy < 0.1) add('Нудьга', -8); else if (n.joy < 0.25) add('Нудьгує', -3); else if (n.joy > 0.85) add('Розваги в достатку', 6); else if (n.joy > 0.6) add('Гарний настрій від розваг', 2);
      if (this.pain > 0.05) add('Біль', -Math.round(this.pain * 28));
      if (this.env) {
        if (this.env.cold) add('Холодно', -Math.min(15, Math.round(this.env.cold * 0.8)));
        if (this.env.hot) add('Спекотно', -Math.min(15, Math.round(this.env.hot * 0.8)));
        if (this.env.beauty > 0.3) add('Гарне оточення', Math.min(6, Math.round(this.env.beauty * 3)));
        else if (this.env.beauty < -0.3) add('Негарне оточення', Math.max(-6, Math.round(this.env.beauty * 3)));
        if (this.env.wet) add('Мокрий', -2);
      }
      for (const t of this.thoughts) { m += t.v; }
      const gg = G(); if (gg && gg.diff) m += (gg.diff.mood - 1) * 30;
      this.sit = sit; this.mood = U.clamp(m, 0, 100);
      return this.mood;
    }
    breakThresholds() {
      const mod = this.tadd('breakMod');
      return { minor: 18 + mod, major: 10 + mod, extreme: 4 + mod };
    }

    addLog(s) { const gg = G(); this.log.unshift({ t: gg ? gg.tick : 0, s }); if (this.log.length > 40) this.log.pop(); }

    // ================= ЗДОРОВ'Я =================
    part(id) { return this.parts.find(p => p.id === id); }
    partDamage(id) { let s = 0; for (const i of this.injuries) if (i.part === id) s += i.amt; return s; }
    partHp(id) { const p = this.part(id); return p.missing ? 0 : p.max - this.partDamage(id); }
    armorFor(dtype) {
      const ap = this.equip.apparel && D.items[this.equip.apparel] && D.items[this.equip.apparel].ap;
      if (!ap) return 0;
      return (dtype === 'blunt') ? ap.blunt : ap.sharp;
    }
    // Нанесення шкоди. Повертає фактичну шкоду.
    takeDamage(dmg, dtype, src, partId) {
      if (this.dead) return 0;
      const g = G();
      let armor = this.armorFor(dtype);
      if (armor > 0.25 && Math.random() < armor * 0.35) { if (RW.R) RW.R.fx.text(this.x, this.y - 0.7, 'захист', '#9ab'); return 0; }
      dmg *= (1 - armor) * this.tmul('dmg');
      if (this.isColonist && g && g.diff) dmg *= g.diff.harm;
      if (dmg < 0.5) return 0;
      // вибір частини
      let part = partId ? this.part(partId) : null;
      if (!part || part.missing) {
        const live = D.bodyParts.filter(bp => !this.part(bp.id).missing);
        const pick = U.weighted(live, bp => bp.w);
        part = this.part(pick.id);
      }
      const it = D.injuryTypes[dtype === 'fire' ? 'burn' : dtype] || D.injuryTypes.cut;
      const partDef = D.bodyParts.find(b => b.id === part.id);
      const inj = { id: U.nextId(), part: part.id, type: dtype === 'fire' ? 'burn' : dtype, amt: dmg, bleed: dmg * 0.000022 * it.bleed * (part.id === 'torso' ? 1.15 : 1), tended: 0, age: 0 };
      // злиття з існуючою того ж типу на тій же частині
      const same = this.injuries.find(x => x.part === part.id && x.type === inj.type && x.amt < 6);
      if (same && dmg < 5) { same.amt += dmg; same.bleed += inj.bleed; } else this.injuries.push(inj);
      this.hurtT = 30;
      if (RW.R) { RW.R.fx.blood(this.x, this.y, dmg); RW.R.fx.text(this.x, this.y - 0.6, '-' + Math.round(dmg), '#ff7a6a'); }
      if (RW.A) RW.A.sfx(dtype === 'blunt' ? 'thud' : 'hit');
      // знищення частини
      if (this.partDamage(part.id) >= part.max) {
        if (partDef.vital) { this.die('Пошкодження: ' + partDef.name, src); return dmg; }
        part.missing = true;
        this.injuries = this.injuries.filter(x => x.part !== part.id);
        this.injuries.push({ id: U.nextId(), part: part.id, type: 'missing', amt: 0, bleed: 0.0001, tended: 0, age: 0, perm: true });
        this.blood -= 0.12;
        this.addThought('missing_limb');
        this.addLog('Втратив ' + partDef.name.toLowerCase());
        if (this.isColonist && RW.UI) RW.UI.toast(U.shortName(this) + ' втратив ' + partDef.name.toLowerCase() + '!', 'bad');
      }
      this.updateCap();
      if (src && src.faction !== this.faction) { /* реакція */ }
      return dmg;
    }
    addIllness(id, sev) {
      if (this.ill.find(x => x.id === id)) return;
      this.ill.push({ id, sev: sev == null ? 0.05 : sev, imm: 0, tend: 0, tendLeft: 0 });
      const d = D.illnesses[id];
      if (this.isColonist && RW.UI) RW.UI.letter('Хвороба', U.shortName(this) + ' захворів: ' + d.l + '.', 'warn', this);
      this.addLog('Захворів: ' + d.l);
    }
    updateCap() {
      let pain = 0, bleed = 0;
      for (const i of this.injuries) {
        const it = D.injuryTypes[i.type]; if (!it) continue;
        pain += i.amt * it.pain * (1 - i.tended * 0.5);
        bleed += i.bleed;
      }
      for (const il of this.ill) { const d = D.illnesses[il.id]; pain += (d.pain || 0) * il.sev * 40; }
      this.pain = U.clamp(pain / 55, 0, 1.4);
      this.bleedRate = bleed;
      const eff = id => { const p = this.part(id); if (p.missing) return 0; return U.clamp(1 - this.partDamage(id) / p.max * 0.9, 0, 1); };
      let mv = (eff('lleg') + eff('rleg')) / 2;
      if (this.part('lleg').missing && this.part('rleg').missing) mv = 0.12;
      let mp = (eff('larm') + eff('rarm')) / 2;
      let cs = eff('head');
      let illMove = 0, illCons = 0;
      for (const il of this.ill) { const d = D.illnesses[il.id]; illMove += (d.move || 0) * il.sev; illCons += (d.cons || 0) * il.sev; }
      cs = cs * (1 - this.pain * 0.5) * (1 - illCons) * (this.blood < 0.65 ? 0.4 + this.blood * 0.9 : 1);
      if (this.sleeping) cs = Math.min(cs, 0.05);
      mv = mv * (1 - this.pain * 0.35) * (1 - illMove);
      mp = mp * (1 - this.pain * 0.2) * (1 - illCons * 0.5);
      this.cap.move = U.clamp(mv, 0, 1.2); this.cap.manip = U.clamp(mp, 0.05, 1.2); this.cap.cons = U.clamp(cs, 0, 1.2);
      const wasDowned = this.downed;
      const dn = (this.cap.move < 0.14 && !(this.part('lleg').missing && this.part('rleg').missing && false)) || (this.cap.cons < 0.3 && !this.sleeping) || this.pain > 0.82;
      this.downed = dn && !this.dead;
      if (this.downed && !wasDowned) {
        this.job = null; this.path = null; this.drafted = false;
        this.addLog('Збито з ніг'); if (this.isColonist && RW.UI) RW.UI.toast(U.shortName(this) + ' втратив свідомість!', 'bad');
        if (RW.AI) RW.AI.release(this);
      }
      if (!this.downed && wasDowned) { this.addLog('Прийшов до тями'); }
    }
    tickHealth() {
      const g = G(); let changed = false;
      const inBed = this.sleeping || this.inBed || (this.job && this.job.type === 'rest');
      const hosp = this.bedDef && this.bedDef.med;
      // кровотеча та загоєння
      let bleed = 0;
      for (let k = this.injuries.length - 1; k >= 0; k--) {
        const i = this.injuries[k]; i.age++;
        if (i.perm) { bleed += 0; continue; }
        const it = D.injuryTypes[i.type];
        if (i.bleed > 0) { bleed += i.bleed; i.bleed *= (i.tended ? 0.9985 : 0.99985); if (i.bleed < 1e-6) i.bleed = 0; }
        const heal = 0.0009 * it.heal * (1 + i.tended * 1.3) * (inBed ? 1.4 : 1) * (hosp ? 1.15 : 1) * (this.age > 60 ? 0.8 : 1) * (this.needs.food < 0.05 ? 0.3 : 1);
        i.amt -= heal;
        // інфекція
        if (!i.tended && i.amt > 3 && i.type !== 'blunt' && i.age > 600) {
          if (Math.random() < 0.000012 * i.amt * (hosp ? 0.3 : 1)) this.addIllness('infection', 0.08);
        }
        if (i.amt <= 0.05) { this.injuries.splice(k, 1); changed = true; }
      }
      if (bleed > 0) { this.blood -= bleed; changed = true; if (this.blood <= 0) { this.die('Крововтрата', null); return; } }
      else if (this.blood < 1) { this.blood = Math.min(1, this.blood + 0.00006); changed = true; }
      // хвороби
      for (let k = this.ill.length - 1; k >= 0; k--) {
        const il = this.ill[k], d = D.illnesses[il.id];
        if (il.tendLeft > 0) { il.tendLeft--; if (il.tendLeft === 0) il.tend = 0; }
        if (d.env) {
          // середовищні — керуються з environment
          continue;
        }
        il.sev += d.sev * (1 - il.tend * 0.7) * (hosp ? 0.85 : 1);
        il.imm += d.imm * (inBed ? 1.4 : 1) * (1 + il.tend * 0.9) * (hosp ? 1.15 : 1);
        if (il.imm >= 1) {
          this.ill.splice(k, 1); this.addLog('Одужав: ' + d.l); this.addThought('cured');
          if (this.isColonist && RW.UI) RW.UI.toast(U.shortName(this) + ' одужав: ' + d.l, 'good');
          changed = true; continue;
        }
        if (il.sev >= 1) {
          if (d.lethal) { this.die(d.l, null); return; } else il.sev = 0.95;
        }
        changed = true;
      }
      if (changed) this.updateCap();
    }
    die(cause, src) {
      if (this.dead) return;
      this.dead = true; this.downed = false; this.cause = cause;
      const g = G();
      if (RW.AI) RW.AI.release(this);
      this.job = null; this.path = null;
      if (g) {
        const map = g.map;
        map.addItem('corpse', 1, this.tx, this.ty, { data: { who: this.id, name: U.fullName(this), faction: this.faction, look: this.look, born: g.tick, age: this.age, gender: this.gender } });
        const k = g.pawns.indexOf(this); if (k >= 0) g.pawns.splice(k, 1);
        g.deadPawns.push(this);
        if (this.equip.weapon) { map.addItem(this.equip.weapon, 1, this.tx, this.ty); this.equip.weapon = null; }
        if (this.equip.apparel) { map.addItem(this.equip.apparel, 1, this.tx, this.ty); this.equip.apparel = null; }
        if (this.carry) { map.addItem(this.carry.def, this.carry.n, this.tx, this.ty); this.carry = null; }
        if (src && src.kind === 'pawn') { src.kills++; if (src.isColonist && this.isEnemy) src.addThought('killed_enemy'); }
        if (this.isColonist) {
          RW.UI && RW.UI.letter('Смерть', U.fullName(this) + ' помер(ла). Причина: ' + cause + '.', 'bad', null);
          RW.A && RW.A.sfx('alert');
          for (const o of g.pawns) {
            if (!o.isColonist) continue;
            if (RW.Rel) RW.Rel.onDeath(this, o);
            if (o.rel[this.id] === 'friend' || o.rel[this.id] === 'lover' || o.rel[this.id] === 'spouse' || o.rel[this.id] === 'fiance') o.addThought('friend_died');
            else if (o.rel[this.id] === 'rival') o.addThought('rival_died');
            else o.addThought('colonist_died');
            if (o.rel[this.id] === 'lover' || o.rel[this.id] === 'fiance') delete o.rel[this.id];
          }
        } else if (this.isEnemy) {
          g.stats.kills++;
          RW.UI && RW.UI.log('Ворог знищений: ' + U.shortName(this));
        }
        RW.R && RW.R.fx.blood(this.x, this.y, 30);
      }
    }

    // ================= ПОТРЕБИ =================
    tickNeeds(env) {
      const n = this.needs; const g = G();
      let hungerRate = 1 / 16000 * (this.has('gourmand') ? 1.25 : 1) * (this.sleeping ? 0.7 : 1) * (this.hungerMul ? this.hungerMul() : 1);
      n.food = Math.max(0, n.food - hungerRate);
      if (!this.sleeping) n.rest = Math.max(0, n.rest - 1 / 9500 * (this.has('night_owl') ? 0.9 : 1));
      n.joy = Math.max(0, n.joy - 1 / 14000);
      for (const k in this.tol) { this.tol[k] = Math.max(0, this.tol[k] - 0.00004); }
      // виснаження
      const mal = this.ill.find(x => x.id === 'malnutrition');
      if (n.food <= 0) {
        if (!mal) this.addIllness('malnutrition', 0.02);
        else { mal.sev += 0.00004; mal.imm = 0; if (mal.sev >= 1) { this.die('Голод', null); return; } }
      } else if (mal) { mal.sev -= 0.0002; if (mal.sev <= 0) { this.ill = this.ill.filter(x => x !== mal); } }
    }
    // Температурна дія середовища; temp — ефективна температура біля пішака
    tickEnvironment(temp) {
      const ins = this.equip.apparel && D.items[this.equip.apparel] ? D.items[this.equip.apparel].ap.insul : 0;
      const baseIns = this.faction === 'enemy' ? 4 : 0;
      const minC = 14 - ins - baseIns, maxC = 30;
      const minSafe = minC - 14, maxSafe = 42;
      const env = this.env || (this.env = {});
      env.temp = temp; env.cold = temp < minC ? minC - temp : 0; env.hot = temp > maxC ? temp - maxC : 0;
      const hy = this.ill.find(x => x.id === 'hypothermia'), hs = this.ill.find(x => x.id === 'heatstroke');
      if (temp < minSafe) {
        const rate = (minSafe - temp) / 40 * 0.00022;
        if (!hy) this.addIllness('hypothermia', rate * 200); else hy.sev += rate;
      } else if (hy) { hy.sev -= 0.0004; if (hy.sev <= 0) this.ill = this.ill.filter(x => x !== hy); }
      if (temp > maxSafe) {
        const rate = (temp - maxSafe) / 20 * 0.00022;
        if (!hs) this.addIllness('heatstroke', rate * 200); else hs.sev += rate;
      } else if (hs) { hs.sev -= 0.0004; if (hs.sev <= 0) this.ill = this.ill.filter(x => x !== hs); }
      for (const il of [hy, hs]) { if (il && il.sev >= 1) { this.die(D.illnesses[il.id].l, null); return; } }
    }

    // ----- Збереження -----
    serialize() {
      const o = {};
      const keys = ['id', 'faction', 'name', 'gender', 'age', 'bio', 'traits', 'skills', 'look', 'x', 'y', 'needs', 'tol', 'thoughts', 'parts', 'injuries', 'ill', 'blood', 'equip', 'carry', 'work', 'sched', 'drafted', 'downed', 'opinion', 'rel', 'log', 'disabled', 'noViolence', 'kills', 'bedId', 'title', 'aiKind', 'raidId', 'leaveAt', 'face', 'bd', 'gd', 'inspire', 'kinT', 'scars', 'chronic', 'immune', 'prost', 'moodHist', 'proposeCool', 'psy', 'siege', 'bounty', 'thief'];
      for (const k of keys) if (this[k] !== undefined) o[k] = this[k];
      o.bedId = this.bed ? this.bed.id : null;
      return JSON.parse(JSON.stringify(o));
    }
  }

  // Таблиця рис за id
  const TRAITS = {}; D.traits.forEach(t => TRAITS[t.id] = t);
  D.traitById = TRAITS;

  // ---------- Генерація пішака ----------
  Pawn.generate = function (opts) {
    opts = opts || {};
    const p = new Pawn();
    p.faction = opts.faction || 'colony';
    p.gender = opts.gender || (Math.random() < 0.5 ? 'm' : 'f');
    p.name = opts.name || U.randomName(p.gender);
    p.age = opts.age || U.ri(19, 56);
    const bs = D.backstories;
    p.bio = opts.bio || { child: U.pick(bs.child).id, adult: U.pick(bs.adult).id };
    if (opts.tribal) { p.bio.child = 'tribal_kid'; }
    p.look = opts.look || { skin: U.pick(D.skinTones), hair: U.pick(D.hairColors), hairStyle: U.ri(0, 5), body: U.pick(['thin', 'normal', 'normal', 'broad']), shirt: U.pick(D.clothColors), pants: U.pick(['#3a3a4a', '#4a3a2a', '#2a3a3a', '#5a5a4a']) };
    p.traits = opts.traits ? opts.traits.slice() : Pawn.randomTraits(U.ri(1, 3));
    p.rollSkills(opts.skillBias);
    p.recomputeBio();
    p.title = '';
    return p;
  };
  Pawn.randomTraits = function (n) {
    const out = []; const used = new Set(); let guard = 0;
    while (out.length < n && guard++ < 50) {
      const t = U.pick(D.traits);
      if (used.has(t.excl) || out.includes(t.id)) continue;
      used.add(t.excl); out.push(t.id);
    }
    return out;
  };
  Pawn.prototype.rollSkills = function (bias) {
    this.skills = {};
    const c = D.backstories.child.find(b => b.id === this.bio.child), a = D.backstories.adult.find(b => b.id === this.bio.adult);
    for (const sk of D.skills) {
      let l = U.ri(0, 5) + (c.skills[sk] || 0) + (a.skills[sk] || 0) + (bias && bias[sk] || 0);
      this.skills[sk] = { lvl: U.clamp(l, 0, 20), xp: 0, pas: 0 };
    }
    // пристрасті
    const order = U.shuffle(D.skills.slice());
    for (const sk of order) { const r = Math.random(); if (r < 0.1) this.skills[sk].pas = 2; else if (r < 0.34) this.skills[sk].pas = 1; }
    if (!D.skills.some(s => this.skills[s].pas)) this.skills[U.pick(D.skills)].pas = 1;
  };
  Pawn.prototype.recomputeBio = function () {
    const c = D.backstories.child.find(b => b.id === this.bio.child), a = D.backstories.adult.find(b => b.id === this.bio.adult);
    const dis = new Set([].concat(c.disable || [], a.disable || []));
    this.noViolence = dis.has('violent');
    this.disabled = Array.from(dis).filter(x => x !== 'violent');
    if (this.noViolence) this.disabled.push('hunt');
    if (this.faction === 'colony') for (const wt of this.disabled) this.work[wt] = 0;
    this.title = a.title;
  };
  Pawn.makeLook = () => ({ skin: U.pick(D.skinTones), hair: U.pick(D.hairColors), hairStyle: U.ri(0, 5), body: U.pick(['thin', 'normal', 'broad']), shirt: U.pick(D.clothColors), pants: '#3a3a4a' });

  Pawn.deserialize = function (o) {
    const p = new Pawn();
    Object.assign(p, o);
    p.job = null; p.path = null; p.target = null; p.bed = null; p.env = {};
    p.updateCap();
    return p;
  };

  // ======================= ТВАРИНИ =======================
  class Animal {
    constructor(species, x, y) {
      const s = D.animals[species];
      this.kind = 'animal'; this.id = U.nextId(); this.species = species; this.x = x; this.y = y;
      this.hp = s.hp; this.maxhp = s.hp; this.faction = s.pet ? 'colony' : 'wild'; this.hostile = false;
      this.state = 'idle'; this.t = U.ri(10, 200); this.path = null; this.pi = 0; this.face = 0; this.phase = 0; this.dead = false;
      this.herd = 0; this.cool = 0; this.target = null; this.name = null; this.fear = 0; this.bleed = 0; this.moving = false; this.flee = 0; this.hungry = 0; this.manhunt = 0;
      this.sleepT = 0;
    }
    get tx() { return Math.floor(this.x); }
    get ty() { return Math.floor(this.y); }
    get def() { return D.animals[this.species]; }
    takeDamage(dmg, dtype, src) {
      if (this.dead) return 0;
      this.hp -= dmg; this.bleed += dmg * 0.002;
      if (RW.R) { RW.R.fx.blood(this.x, this.y, dmg); RW.R.fx.text(this.x, this.y - 0.5, '-' + Math.round(dmg), '#ffb08a'); }
      if (RW.A) RW.A.sfx('hit');
      if (this.hp <= 0) { this.die(src); return dmg; }
      if (src) { this.target = src; this.flee = this.def.flee ? 260 : 0; if (this.def.defend || this.def.predator || this.def.pet) this.state = 'attack'; }
      return dmg;
    }
    die(src) {
      if (this.dead) return; this.dead = true;
      const g = G(); if (!g) return;
      const k = g.animals.indexOf(this); if (k >= 0) g.animals.splice(k, 1);
      g.map.addItem('corpse_animal', 1, this.tx, this.ty, { data: { species: this.species, born: g.tick } });
      if (src && src.kind === 'pawn') { src.kills++; }
      RW.R && RW.R.fx.blood(this.x, this.y, 20);
      if (this.faction === 'colony') RW.UI && RW.UI.log(this.name + ' (' + this.def.name + ') загинув(ла)');
    }
    serialize() { return { id: this.id, species: this.species, x: this.x, y: this.y, hp: this.hp, faction: this.faction, name: this.name, hostile: this.hostile, manhunt: this.manhunt }; }
  }
  Animal.deserialize = function (o) { const a = new Animal(o.species, o.x, o.y); Object.assign(a, o); return a; };

  RW.Pawn = Pawn; RW.Animal = Animal;

  // ======================= СОЦІАЛЬНА СИСТЕМА =======================
  RW.Social = {
    op(a, b) { return a.opinion[b.id] || 0; },
    change(a, b, d) { a.opinion[b.id] = U.clamp((a.opinion[b.id] || 0) + d, -100, 100); this.updateRel(a, b); },
    updateRel(a, b) {
      const o = a.opinion[b.id] || 0; const cur = a.rel[b.id];
      if (cur === 'lover') { if (o < 20) { delete a.rel[b.id]; a.addThought('heartbreak'); } return; }
      if (o >= 40 && cur !== 'friend') { a.rel[b.id] = 'friend'; a.addLog(U.shortName(b) + ' тепер друг.'); }
      else if (o <= -40 && cur !== 'rival') { a.rel[b.id] = 'rival'; a.addLog(U.shortName(b) + ' тепер ворог.'); }
      else if (cur === 'friend' && o < 15) delete a.rel[b.id];
      else if (cur === 'rival' && o > -15) delete a.rel[b.id];
    },
    interact(a, b) {
      const sa = a.skillFactor('social'), kind = a.has('kind'), abr = a.has('abrasive');
      const r = Math.random();
      const g = G();
      let insultP = 0.07 + (abr ? 0.18 : 0) - (kind ? 0.06 : 0) + (a.mood < 25 ? 0.12 : 0) + (this.op(a, b) < -30 ? 0.2 : 0);
      a.gainXp('social', 8);
      if (r < insultP && !kind) {
        this.change(b, a, -14); b.addThought('insulted'); a.addLog('Образив ' + U.shortName(b));
        if (RW.R) RW.R.fx.text(a.x, a.y - 0.9, '💢', '#f55');
        if (b.mood < 22 && Math.random() < 0.3 && b.isColonist && !b.mental) RW.AI && RW.AI.startBreak(b, 'fight', a);
        return 'insult';
      }
      const deep = Math.random() < 0.18;
      const gain = (deep ? 10 : 5) * (0.7 + sa * 0.5) * (kind ? 1.25 : 1);
      this.change(b, a, gain); this.change(a, b, gain * 0.9);
      b.addThought(deep ? 'deep_talk' : 'chitchat'); a.addThought(deep ? 'deep_talk' : 'chitchat');
      if (RW.R) RW.R.fx.text(a.x, a.y - 0.9, deep ? '💬' : '…', '#cde');
      // романтика
      const oa = this.op(a, b), ob = this.op(b, a);
      if (!a.rel[b.id] || a.rel[b.id] === 'friend') {
        if (oa > 55 && ob > 55 && a.age >= 18 && b.age >= 18 && !Object.values(a.rel).includes('lover') && !Object.values(b.rel).includes('lover') && Math.random() < 0.08) {
          a.rel[b.id] = 'lover'; b.rel[a.id] = 'lover';
          a.addThought('in_love'); b.addThought('in_love');
          a.addLog('Закохався/лась у ' + U.shortName(b)); b.addLog('Закохався/лась у ' + U.shortName(a));
          RW.UI && RW.UI.letter('Романтика', U.fullName(a) + ' та ' + U.fullName(b) + ' закохалися одне в одного.', 'good', a);
        }
      }
      return deep ? 'deep' : 'chat';
    }
  };
})();
