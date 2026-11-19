'use strict';
// ============================================================
//  mp2.js — союз двох колоній (v0.9.6), працює поверх mp.js
//   11) Постійні караванні маршрути (ескорт, засідки, договір скорочує дорогу)
//   26) Спільний проєкт: обидві колонії вкладають ресурси, нагорода обом
//   27) Договори: торговий договір → військовий союз, довіра
//   28) Змагання тижня й таблиця лідерів, трофей
//   29) Віддалена допомога: експрес-посилки та лікар у гості
//   30) Спільний похід на піратську фортецю
//  Усі повідомлення мають тип 'x…'. Вікно «Союз» (клавіша U). Числа — в об'єкті MP2.
// ============================================================
(function () {
  const D = RW.D, U = RW.U, DY = D.DAY, MP = RW.MP, Net = RW.Net, E = RW.Events, W = RW.World; const G = () => RW.G;
  const MP2 = RW.MP2 = {
    TRUST0: 50, PACT_TRUST: 30, ALLY_TRUST: 60, TRAVEL_PACT: 0.75, TRAVEL_ALLY: 0.6, EXPRESS: 0.45, ROUTE_MAX: 3, ROUTE_AMBUSH: 0.12, ROUTE_ESCORT: 0.02, ESCORT_FEE: 40, AMBUSH_LOSS: 0.5,
    CMP_DAYS: 7, MED_MIN: 3, MED_Q: [0.4, 0.04], JOINT_MAX: 3, JOINT_BASE: 40, JOINT_SQRT: 14, JOINT_WIN_DEAD: 0.06, JOINT_LOSE_DEAD: 0.35, JOINT_WOUND: [0.4, 0.6], JOINT_LOOT: [250, 600]
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fx2 = (t, x, y, o) => RW.FX2 && RW.FX2.emit(t, x, y, o), burst = (t, x, y, n, o) => RW.FX2 && RW.FX2.burst(t, x, y, n, o);
  const st = g => g && g.ext && g.ext.mp; const dayN = g => D.relDay(g.tick);
  const ex = g => { const e = g.ext; return (e.mp2 = e.mp2 || { trust: MP2.TRUST0, treaty: 0, tIn: 0, tOut: 0, routes: [], proj: null, projDone: [], cmp: null, cmpPeer: {}, rec: { w: 0, l: 0, t: 0 }, last: null, medic: {}, joint: null, jin: null, stat: { routes: 0, aid: 0, proj: 0, joint: 0 } }); };
  const itName = k => (D.items[k] && D.items[k].name) || k;
  const listTxt = l => Object.keys(l || {}).map(k => l[k] + '× ' + itName(k)).join(', ') || '—';
  const cols = g => g.pawns.filter(p => p.faction === 'colony' && !p.dead);
  const send = o => Net.send(o);
  const T = (id, l, v, days) => { D.thoughts[id] = { l, v, dur: days * DY }; D.thoughtIco && (D.thoughtIco[id] = '🤝'); };
  T('proj_done', 'Спільний проєкт завершено!', 8, 8); T('beacon_glow', 'Маяк дружби світить', 3, 3); T('cmp_win', 'Перемога у змаганні тижня', 6, 4); T('cmp_lose', 'Програли змагання (наступного разу!)', -2, 2); T('joint_win', 'Спільний похід вдався', 5, 4); T('ally_pride', 'Колонії — союзники', 2, 3);
  D.items.trophy = { id: 'trophy', name: 'Кубок змагання', cat: 'misc', stack: 5, value: 250, color: '#e8c44a' };
  const takeItems = list => { const g = G(), map = g.map; const stock = E.colonyStock(); for (const k in list) if ((stock[k] || 0) < list[k]) return false; for (const k in list) { let left = list[k]; for (const it of Array.from(map.byDef.get(k) || [])) { if (left <= 0) break; if (it.forbid || it.res) continue; const t = Math.min(left, it.n); map.takeItem(it, t); left -= t; } } return true; };
  const stockOf = k => E.colonyStock()[k] || 0;
  const carav = (g, from, to, kind, dur, data) => W.sendCaravan(g, from, to, kind, dur, Object.assign({ mp: 1 }, data || {}));
  function packPawn(p) { const g = G(), map = g.map; RW.AI.endJob(p); if (p.carry) { map.addItem(p.carry.def, p.carry.n || 1, p.tx, p.ty); p.carry = null; } p.drafted = false; const o = p.serialize(); const k = g.pawns.indexOf(p); if (k >= 0) g.pawns.splice(k, 1); RW.AI.release(p); if (g.sel && g.sel.p === p) g.sel = null; p.away = true; return JSON.parse(JSON.stringify(o)); }
  const trust = d => { const s2 = ex(G()); s2.trust = U.clamp(s2.trust + d, 0, 100); };
  const toast = (t, k) => RW.UI.toast(t, k || 'info');
  const online = () => MP.active() && MP.online();

  // ---------- договір скорочує дорогу ----------
  const tr0 = MP.travel; MP.travel = function (f) { const g = G(); let v = tr0.apply(this, arguments); if (g && st(g)) { const t = ex(g).treaty; v *= t >= 2 ? MP2.TRAVEL_ALLY : t >= 1 ? MP2.TRAVEL_PACT : 1; } return Math.round(v); };

  // ======================================================================
  //  27. ДОГОВОРИ
  // ======================================================================
  const LV = ['Мир', 'Торговий договір', 'Військовий союз']; MP2.LV = LV;
  MP2.propose = function (lvl) {
    const g = G(), s = st(g), s2 = ex(g); if (!online()) return 'Немає зʼєднання'; if (s.rel === 'war') return 'Під час війни договори неможливі'; if (s2.treaty >= lvl) return 'Цей договір уже діє'; if (lvl !== s2.treaty + 1) return 'Спершу потрібен попередній рівень';
    if (s2.trust < (lvl === 1 ? MP2.PACT_TRUST : MP2.ALLY_TRUST)) return 'Мало довіри (потрібно ' + (lvl === 1 ? MP2.PACT_TRUST : MP2.ALLY_TRUST) + ')'; if (s2.tOut) return 'Пропозиція вже надіслана';
    s2.tOut = lvl; send({ t: 'xT', a: 'prop', lvl }); toast('📜 Пропозицію «' + LV[lvl] + '» надіслано', 'good'); return null;
  };
  MP2.answerTreaty = function (ok) { const g = G(), s2 = ex(g); const lvl = s2.tIn; if (!lvl) return; s2.tIn = 0; send({ t: 'xT', a: ok ? 'ok' : 'no', lvl }); if (ok) setTreaty(lvl); };
  MP2.breakTreaty = function () { const g = G(), s2 = ex(g); if (!s2.treaty) return; send({ t: 'xT', a: 'break' }); doBreak(true); };
  function setTreaty(lvl) { const g = G(), s2 = ex(g); s2.treaty = lvl; s2.tOut = 0; s2.tIn = 0; trust(10); RW.UI.letter('📜 ' + LV[lvl], 'Колонії «' + st(g).myName + '» і «' + st(g).peerName + '» уклали договір: ' + LV[lvl].toLowerCase() + '. ' + (lvl === 1 ? 'Дорога скорочена на 25%, відкриті постійні маршрути.' : 'Дорога скорочена на 40%, відкриті спільні походи.'), 'good'); for (const p of cols(g)) p.addThought('ally_pride'); const sp = g.tradeSpot; burst('confetti', sp.x + 0.5, sp.y + 0.5, 22); RW.A && RW.A.sfx('good'); }
  function doBreak(mine) { const g = G(), s2 = ex(g); s2.treaty = 0; trust(-20); RW.UI.letter('Договір розірвано', (mine ? 'Ви розірвали' : '«' + st(g).peerName + '» розірвав(ла)') + ' договір. Довіра впала.', 'bad'); }

  // ======================================================================
  //  11 + 29. МАРШРУТИ Й ЕКСПЕС-ДОПОМОГА
  // ======================================================================
  const PRESETS = { wood: ['wood', 100], steel: ['steel', 50], food: ['meal_simple', 30], med: ['medicine', 6], silver: ['silver', 200], cloth: ['cloth', 60] };
  MP2.addRoute = function (key) { const g = G(), s2 = ex(g); if (s2.treaty < 1) return 'Потрібен торговий договір'; if (s2.routes.length >= MP2.ROUTE_MAX) return 'Максимум маршрутів: ' + MP2.ROUTE_MAX; const p = PRESETS[key]; if (!p || !D.items[p[0]]) return 'Невідомий вантаж'; s2.routes.push({ id: U.nextId(), def: p[0], n: p[1], every: 4, next: g.tick + DY * 0.3, escort: false, sent: 0 }); return null; };
  function shipment(g, items, f, label, ambush) {
    const s = st(g), eta = MP.travel(f); carav(g, 'me', 'peer', 'mpout', eta, { mp: 'out', ico: f < 0.6 ? '⚡' : '🐪' }); send({ t: 'xR', items, eta, label, from: s.myName, express: f < 0.6, lost: !!ambush });
  }
  function routeTick(g) { // раз на добу
    const s2 = ex(g), s = st(g); if (!online() || s.rel === 'war' || s2.treaty < 1) return;
    for (const r of s2.routes) {
      if (g.tick < r.next) continue; r.next = g.tick + r.every * DY;
      const fee = r.escort ? MP2.ESCORT_FEE : 0; const items = { [r.def]: r.n }; if (!takeItems(items)) { toast('🐪 Маршрут «' + itName(r.def) + '» пропущено: немає вантажу', 'warn'); r.next = g.tick + DY; continue; }
      if (fee && !takeItems({ silver: fee })) { for (const k in items) g.map.addItem(k, items[k], Math.floor(g.tradeSpot.x), Math.floor(g.tradeSpot.y)); toast('Немає срібла на ескорт', 'warn'); r.next = g.tick + DY; continue; }
      const risk = r.escort ? MP2.ROUTE_ESCORT : MP2.ROUTE_AMBUSH * (s2.treaty >= 2 ? 0.6 : 1); const hit = Math.random() < risk; const sendN = hit ? Math.max(1, Math.round(r.n * (1 - MP2.AMBUSH_LOSS))) : r.n;
      shipment(g, { [r.def]: sendN }, 1, 'Маршрут', hit); r.sent++; s2.stat.routes++; trust(1);
      if (hit) { RW.UI.letter('Засідка на маршруті', 'Караван із «' + itName(r.def) + '» потрапив у засідку. Дійшло ' + sendN + ' із ' + r.n + '. Ескорт знижує ризик.', 'warn'); } else toast('🐪 Караван вирушив: ' + r.n + '× ' + itName(r.def), 'good');
    }
  }
  MP2.sendAid = function (kind) {
    const g = G(), s2 = ex(g), s = st(g); if (!online()) return 'Немає зʼєднання'; if (s.rel === 'war') return 'Війна';
    const P = { med: { medicine: 6, herbal: 8 }, food: { meal_simple: 30 }, build: { wood: 100, steel: 40 } }[kind]; if (!P) return 'Невідомо'; if (!takeItems(P)) return 'Не вистачає: ' + listTxt(P);
    shipment(g, P, MP2.EXPRESS * (s2.treaty >= 2 ? 0.8 : 1), 'Експрес-допомога'); s2.stat.aid++; trust(2); toast('⚡ Експрес-посилка вирушила: ' + listTxt(P), 'good'); return null;
  };
  MP2.sendDoctor = function (pid) {
    const g = G(), s = st(g), s2 = ex(g); const p = g.pawns.find(x => x.id === pid); if (!p) return 'Не знайдено'; if (p.skillLvl('medicine') < MP2.MED_MIN) return 'Потрібна медицина ' + MP2.MED_MIN + '+'; if (s2.treaty < 1) return 'Потрібен торговий договір';
    const before = Object.keys(s.away); const err = MP.sendVisit(pid, 2); if (err) return err; const id = Object.keys(s.away).find(k => !before.includes(k)); if (id) send({ t: 'xM', id, skill: p.skillLvl('medicine'), name: U.shortName(p) }); s2.stat.aid++; trust(2); return null;
  };
  function medicTick(g) { // раз на 90 тіків
    const s2 = ex(g); const docs = g.pawns.filter(p => p.mpMedic && !p.dead && !p.gone); if (!docs.length) return;
    const pat = cols(g).filter(p => p.injuries.some(i => i.type !== 'missing' && !(i.tended > 0)) || p.ill.some(il => !(il.tend > 0)));
    for (const d of docs) { const t = pat.shift(); if (!t) break; const q = Math.min(0.95, MP2.MED_Q[0] + MP2.MED_Q[1] * (d.medSkill || 5)); for (const i of t.injuries) if (i.type !== 'missing' && !(i.tended > 0)) { i.tended = q; i.bleed = (i.bleed || 0) * 0.2; } for (const il of t.ill) if (!(il.tend > 0)) { il.tend = q; il.tendLeft = 3600; } t.updateCap && t.updateCap(); s2.beams = s2.beams || []; s2.beams.push({ a: d, b: t, t: 0 }); RW.R.fx.text(t.x, t.y - 1, '⚕', '#9fe08a'); burst('heart', t.x, t.y - 0.5, 3); toast('⚕ ' + U.shortName(d) + ' лікує ' + U.shortName(t), 'good'); }
  }

  // ======================================================================
  //  26. СПІЛЬНИЙ ПРОЄКТ
  // ======================================================================
  const PROJ = MP2.PROJ = {
    beacon: { name: 'Маяк дружби', ico: '🗼', need: { steel: 300, components: 15, silver: 600 }, desc: 'Високий маяк, видимий обом колоніям. Нагорода: +3 до настрою, 400 срібла кожному.' },
    festival: { name: 'Великий ярмарок', ico: '🎪', need: { wood: 300, meal_simple: 60, cloth: 100 }, desc: 'Арена для свят. Нагорода: торговець прибуває негайно, свято для колоністів.' },
    library: { name: 'Спільна бібліотека', ico: '📚', need: { silver: 900, cloth: 80, components: 8 }, desc: 'Знання двох колоній. Нагорода: усі колоністи отримують великий досвід у дослідженнях.' }
  };
  MP2.startProj = function (pid) { const g = G(), s2 = ex(g); if (!online()) return 'Немає зʼєднання'; if (s2.proj) return 'Проєкт уже триває'; if (s2.projDone.includes(pid)) return 'Цей проєкт уже зведено'; if (s2.pOut) return 'Пропозиція вже надіслана'; s2.pOut = pid; send({ t: 'xP', a: 'prop', pid }); toast('🏗 Пропозицію проєкту надіслано', 'good'); return null; };
  function beginProj(pid) { const g = G(), s2 = ex(g); s2.proj = { pid, need: Object.assign({}, PROJ[pid].need), have: {}, me: 0, peer: 0, t0: g.tick }; s2.pOut = null; s2.pIn = null; RW.UI.letter('🏗 ' + PROJ[pid].name, 'Спільний проєкт розпочато. Вносьте ресурси у вікні «Союз» [U] — обидві колонії мають зібрати все.', 'good'); }
  MP2.answerProj = function (ok) { const g = G(), s2 = ex(g); const pid = s2.pIn; if (!pid) return; s2.pIn = null; send({ t: 'xP', a: ok ? 'ok' : 'no', pid }); if (ok) beginProj(pid); };
  MP2.contribute = function (def, n) {
    const g = G(), s2 = ex(g), p = s2.proj; if (!p || !online()) return 'Проєкту немає або немає зв\'язку'; const left = p.need[def] - (p.have[def] || 0); n = Math.min(n, left, stockOf(def)); if (n <= 0) return 'Нема що вносити'; if (!takeItems({ [def]: n })) return 'Не вистачає'; p.have[def] = (p.have[def] || 0) + n; p.me += n * (D.items[def].value || 1);
    send({ t: 'xP', a: 'add', def, n }); const sp = g.tradeSpot; burst('coin', sp.x + 0.5, sp.y + 0.5, 6); trust(0.5); checkProj(g); return null;
  };
  function projDone(p) { return Object.keys(p.need).every(k => (p.have[k] || 0) >= p.need[k]); }
  function checkProj(g) {
    const s2 = ex(g), p = s2.proj; if (!p || !projDone(p)) return; s2.proj = null; s2.projDone.push(p.pid); s2.stat.proj++; trust(8); const P = PROJ[p.pid]; send({ t: 'xP', a: 'done', pid: p.pid });
    for (const c of cols(g)) c.addThought('proj_done'); RW.UI.letter('🏗 ' + P.name + ' завершено!', 'Спільний проєкт завершено! ' + P.desc, 'good'); RW.A && RW.A.sfx('good'); const sp = g.tradeSpot; burst('confetti', sp.x + 0.5, sp.y + 0.5, 30);
    if (p.pid === 'beacon') { try { g.map.addItem('silver', 400, Math.floor(sp.x), Math.floor(sp.y)); } catch (e) { } } else if (p.pid === 'festival') { if (!g.trader) E.trader(); const ps = cols(g); if (RW.Rel && RW.Rel.startParty && ps[0]) try { RW.Rel.startParty('party'); } catch (e) { } } else if (p.pid === 'library') for (const c of cols(g)) c.gainXp('research', 400);
  }
  const mon = (g) => ({ x: g.home.x + 9, y: g.home.y - 7 });
  function drawMon(c, TS, map, x0, y0, x1, y1, t) {
    const g = G(); if (!g || !st(g)) return; const s2 = ex(g); const m = mon(g); const px = m.x * TS, py = m.y * TS; if (m.x < x0 - 4 || m.x > x1 + 4 || m.y < y0 - 6 || m.y > y1 + 4) return;
    const list = s2.projDone.map(k => [k, 1]); if (s2.proj) list.push([s2.proj.pid, Math.min(1, Object.keys(s2.proj.need).reduce((a, k) => a + Math.min(1, (s2.proj.have[k] || 0) / s2.proj.need[k]), 0) / Object.keys(s2.proj.need).length)]);
    list.forEach(([k, pr], idx) => {
      const ox = px + (idx % 2) * 70 - 20, oy = py + Math.floor(idx / 2) * 60; c.save(); c.translate(ox, oy); c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(0, 6, 26, 8, 0, 0, 6.3); c.fill();
      const h = (k === 'beacon' ? 90 : 56) * (0.25 + 0.75 * pr);
      if (k === 'beacon') { c.fillStyle = '#8a8a96'; c.beginPath(); c.moveTo(-12, 4); c.lineTo(-5, -h); c.lineTo(5, -h); c.lineTo(12, 4); c.closePath(); c.fill(); c.strokeStyle = 'rgba(0,0,0,.5)'; c.stroke(); if (pr >= 1) { const a = t * 0.04; c.fillStyle = 'rgba(255,230,140,' + (0.18 + 0.1 * Math.sin(t * 0.1)).toFixed(2) + ')'; c.beginPath(); c.moveTo(0, -h); c.lineTo(Math.cos(a) * 160, -h + Math.sin(a) * 45 - 20); c.lineTo(Math.cos(a) * 160, -h + Math.sin(a) * 45 + 20); c.fill(); c.fillStyle = '#ffe08a'; c.beginPath(); c.arc(0, -h - 3, 5 + Math.sin(t * 0.2), 0, 6.3); c.fill(); } }
      else if (k === 'festival') { c.fillStyle = '#c8473a'; c.fillRect(-22, -h * 0.5, 44, h * 0.5); c.fillStyle = '#e8d8a8'; c.beginPath(); c.moveTo(-26, -h * 0.5); c.lineTo(0, -h); c.lineTo(26, -h * 0.5); c.fill(); if (pr >= 1) for (let i = 0; i < 5; i++) { c.fillStyle = ['#ffd24a', '#e88adf', '#7ad0f0', '#9fe08a', '#ff8a6a'][i]; c.beginPath(); c.moveTo(-20 + i * 10, -h * 0.5); c.lineTo(-15 + i * 10, -h * 0.5 + 10 + Math.sin(t * 0.1 + i) * 2); c.lineTo(-10 + i * 10, -h * 0.5); c.fill(); } }
      else { c.fillStyle = '#b89a6a'; c.fillRect(-24, -h * 0.6, 48, h * 0.6); c.fillStyle = '#8a6a4a'; c.fillRect(-26, -h * 0.6 - 4, 52, 5); if (pr >= 1) { c.fillStyle = '#e8d8a8'; c.beginPath(); c.arc(0, -h * 0.6 - 4, 14, Math.PI, 0); c.fill(); c.fillStyle = '#7ad0f0'; for (const x of [-14, -3, 8]) c.fillRect(x, -h * 0.4, 6, 12); } }
      if (pr < 1) { c.strokeStyle = 'rgba(210,170,90,.9)'; c.lineWidth = 1.2; for (let i = -1; i <= 1; i += 2) { c.beginPath(); c.moveTo(i * 20, 4); c.lineTo(i * 20, -h - 6); c.stroke(); } for (let y = 0; y > -h; y -= 14) { c.beginPath(); c.moveTo(-20, y); c.lineTo(20, y - 10); c.stroke(); } c.fillStyle = '#ffe08a'; c.font = '10px sans-serif'; c.textAlign = 'center'; c.fillText(Math.round(pr * 100) + '%', 0, -h - 10); }
      c.restore();
    });
    // промені лікарів
    for (let i = (s2.beams || []).length - 1; i >= 0; i--) { const b = s2.beams[i]; b.t++; if (b.t > 50 || b.a.dead || b.b.dead) { s2.beams.splice(i, 1); continue; } const u = b.t / 50; c.strokeStyle = 'rgba(160,255,160,' + (0.8 * (1 - u)).toFixed(2) + ')'; c.lineWidth = 2; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(b.a.x * TS, b.a.y * TS - 10); c.lineTo(b.b.x * TS, b.b.y * TS - 10); c.stroke(); c.setLineDash([]); }
    drawJoint(c, TS, g, t);
  }
  RW.R.worldOver.push(drawMon);

  // ======================================================================
  //  28. ЗМАГАННЯ ТИЖНЯ
  // ======================================================================
  const CATS = [['wealth', 'Приріст багатства', g => g.wealth ? g.wealth.total : 0, '◎'], ['harvest', 'Врожай', g => g.stats.harvested, ''], ['kills', 'Знищено ворогів', g => g.stats.kills, ''], ['built', 'Збудовано споруд', g => g.stats.built, ''], ['crafted', 'Виготовлено речей', g => g.stats.crafted, ''], ['fish', 'Спіймано риби', g => g.stats.fish || 0, '']];
  const catOf = (s, w) => CATS[Math.abs(U.hashStr(String(s.sid) + ':' + w)) % CATS.length];
  function startCmp(g) { const s = st(g), s2 = ex(g); const w = (s2.rec.t || 0); const c = catOf(s, w); s2.cmp = { w, cat: c[0], t0: g.tick, base: c[2](g), mine: null }; }
  function cmpDaily(g) {
    const s2 = ex(g), s = st(g); if (!online()) return; if (!s2.cmp) { if (dayN(g) >= 1) startCmp(g); return; }
    const c = s2.cmp; if (c.mine == null && g.tick - c.t0 >= MP2.CMP_DAYS * DY) { const cat = CATS.find(x => x[0] === c.cat); c.mine = Math.max(0, Math.round(cat[2](g) - c.base)); send({ t: 'xC', w: c.w, v: c.mine, cat: c.cat }); toast('🏆 Змагання завершено: ваш результат ' + c.mine, 'info'); }
    resolveCmp(g);
  }
  function resolveCmp(g) {
    const s2 = ex(g), c = s2.cmp; if (!c || c.mine == null || s2.cmpPeer[c.w] == null) return; const pv = s2.cmpPeer[c.w]; const cat = CATS.find(x => x[0] === c.cat); const win = c.mine > pv, tie = c.mine === pv; delete s2.cmpPeer[c.w];
    if (tie) { s2.rec.t++; } else if (win) { s2.rec.w++; s2.rec.t++; } else { s2.rec.l++; s2.rec.t++; }
    s2.last = { cat: cat[1], mine: c.mine, peer: pv, win: tie ? 0 : win ? 1 : -1, day: dayN(g) };
    if (win) { const sp = g.tradeSpot; try { g.map.addItem('trophy', 1, Math.floor(sp.x), Math.floor(sp.y)); } catch (e) { } for (const p of cols(g)) p.addThought('cmp_win'); burst('confetti', sp.x + 0.5, sp.y + 0.5, 26); RW.UI.letter('🏆 Перемога у змаганні!', 'Категорія: ' + cat[1] + '. Ви: ' + c.mine + ', «' + st(g).peerName + '»: ' + pv + '. Кубок лежить біля торгової точки.', 'good'); RW.A && RW.A.sfx('good'); }
    else if (!tie) { for (const p of cols(g)) p.addThought('cmp_lose'); RW.UI.letter('Змагання програно', 'Категорія: ' + cat[1] + '. Ви: ' + c.mine + ', «' + st(g).peerName + '»: ' + pv + '. Наступного тижня реванш!', 'info'); } else RW.UI.letter('Нічия', 'Категорія: ' + cat[1] + '. Результат однаковий: ' + c.mine + '.', 'info');
    startCmp(g);
  }

  // ======================================================================
  //  30. СПІЛЬНИЙ ПОХІД
  // ======================================================================
  const fscore = p => p.skillLvl('shooting') + p.skillLvl('melee') + (p.equip.weapon ? 6 : 0) + (Number.isFinite(p.hp) ? p.hp : 100) / 20 + (p.downed ? -99 : 0);
  const fighters = (g, n) => cols(g).filter(p => !p.isChild && !p.downed && !p.mental && !p.noViolence && !p.hire).sort((a, b) => fscore(b) - fscore(a)).slice(0, Math.min(n, Math.max(0, cols(g).length - 1)));
  MP2.jointSel = [];
  MP2.targets = g => W.ensure(g).settlements.filter(s => s.fac === 'pirates');
  MP2.startJoint = function (sid) {
    const g = G(), s = st(g), s2 = ex(g); if (!online()) return 'Немає зʼєднання'; if (s2.treaty < 2) return 'Потрібен військовий союз'; if (s.rel === 'war') return 'Війна'; if (s2.joint) return 'Похід уже готується'; const tg = MP2.targets(g).find(x => x.id === sid); if (!tg) return 'Невідома ціль';
    const ids = MP2.jointSel.filter(i => g.pawns.some(p => p.id === i)); const ps = (ids.length ? ids.map(i => g.pawns.find(p => p.id === i)) : fighters(g, 2)).filter(p => p && !p.downed && !p.noViolence).slice(0, MP2.JOINT_MAX); if (!ps.length) return 'Немає бійців'; if (ps.length >= cols(g).length) return 'Хтось має залишитись вдома';
    const jid = 'j' + U.nextId() + '_' + Date.now(); const packs = ps.map(p => ({ k: 'A' + p.id, pk: packPawn(p), sc: Math.round(fscore(p)) })); s2.joint = { jid, role: 'A', target: sid, tname: tg.name, mine: packs, st: 'wait', t0: g.tick }; MP2.jointSel = [];
    send({ t: 'xJ', a: 'inv', jid, tname: tg.name, n: packs.length, eta: MP.travel(0.8) }); carav(g, 'me', 'peer', 'mpout', MP.travel(0.4), { mp: 'out', ico: '⚔️' }); toast('⚔ Запрошення на спільний похід надіслано (' + packs.length + ' бійців)', 'good'); return null;
  };
  MP2.answerJoint = function (ok) {
    const g = G(), s2 = ex(g), inv = s2.jin; if (!inv) return; s2.jin = null;
    if (!ok) { send({ t: 'xJ', a: 'no', jid: inv.jid }); return; }
    const ps = fighters(g, 2); if (!ps.length) { send({ t: 'xJ', a: 'no', jid: inv.jid }); return toast('Немає вільних бійців', 'bad'); }
    const packs = ps.map(p => ({ k: 'B' + p.id, pk: packPawn(p), sc: Math.round(fscore(p)) })); s2.joint = { jid: inv.jid, role: 'B', target: inv.tname, tname: inv.tname, mine: packs, st: 'out', t0: g.tick };
    send({ t: 'xJ', a: 'acc', jid: inv.jid, troops: packs.map(x => ({ k: x.k, sc: x.sc })) }); carav(g, 'me', 'peer', 'mpout', MP.travel(0.4), { mp: 'out', ico: '⚔️' }); toast('⚔ Ви приєднались до походу', 'good');
  };
  function jointResolve(g, jt, theirs) { // викликає лише ініціатор (A)
    const all = jt.mine.map(x => ({ k: x.k, sc: x.sc })).concat(theirs); const day = dayN(g); const S = all.reduce((a, x) => a + x.sc, 0); const En = MP2.JOINT_BASE + MP2.JOINT_SQRT * Math.sqrt(day + 1) + U.rr(-8, 12); const win = S * U.rr(0.75, 1.3) > En;
    const dead = [], hurt = []; for (const x of all) { if (Math.random() < (win ? MP2.JOINT_WIN_DEAD : MP2.JOINT_LOSE_DEAD)) dead.push(x.k); else if (Math.random() < MP2.JOINT_WOUND[win ? 0 : 1]) hurt.push(x.k); }
    const loot = win ? { silver: U.ri(MP2.JOINT_LOOT[0], MP2.JOINT_LOOT[1]), steel: U.ri(10, 60), components: U.ri(0, 4) } : {};
    return { win, S: Math.round(S), En: Math.round(En), dead, hurt, loot };
  }
  function applyJoint(g, jt, res, theirsNames) {
    const s2 = ex(g), s = st(g); const back = [], died = [], eta = Math.round(MP.travel(1.4)); for (const x of jt.mine) { if (res.dead.includes(x.k)) { died.push(U.shortName(x.pk)); continue; } if (res.hurt.includes(x.k)) x.pk.injuries = (x.pk.injuries || []).concat([{ id: U.nextId(), part: 'torso', type: 'cut', amt: 7, bleed: 0.0002, tended: 0, age: 0, perm: false }, { id: U.nextId(), part: 'lleg', type: 'cut', amt: 4, bleed: 0.0001, tended: 0, age: 0, perm: false }]); back.push(x.pk); }
    const half = {}; for (const k in res.loot) half[k] = Math.floor(res.loot[k] / 2); carav(g, 'peer', 'me', 'mpreturn', eta, { restore: back, items: half, thought: res.win ? 'joint_win' : null, label: 'Повернення з походу' });
    if (res.win) { W.change('pirates', -8); trust(6); } else trust(1); s2.stat.joint++; s2.joint = null;
    RW.UI.letter(res.win ? '⚔ Похід переможний!' : '⚔ Похід невдалий', 'Ціль: «' + (jt.tname || jt.target) + '». Сила союзу ' + res.S + ' проти ' + res.En + '. ' + (died.length ? 'Загинули: ' + died.join(', ') + '. ' : 'Втрат немає. ') + (res.win ? 'Здобич — ' + listTxt(half) + ' (вашу половину привезуть).' : 'Бійці відступають.') + ' Повернення ~' + MP.hours(eta) + ' год.', res.win ? 'good' : 'warn'); RW.A && RW.A.sfx(res.win ? 'good' : 'alert');
  }
  function jointTick(g) { // раз на 60 тіків: тайм-аути
    const s2 = ex(g), jt = s2.joint; if (!jt) return; const lim = jt.role === 'A' ? 1.2 : 2.2; if (g.tick - jt.t0 > lim * DY && jt.st !== 'done') { carav(g, 'peer', 'me', 'mpreturn', Math.round(DY * 0.25), { restore: jt.mine.map(x => x.pk), label: 'Похід скасовано' }); s2.joint = null; toast('Похід скасовано: друг не відповів', 'warn'); }
  }
  function drawJoint(c, TS, g, t) { const jt = ex(g).joint; if (!jt) return; const h = g.home; c.save(); c.font = '16px sans-serif'; c.textAlign = 'center'; c.globalAlpha = 0.9; c.fillText('⚔', (h.x + 3) * TS, (h.y - 4) * TS + Math.sin(t * 0.1) * 2); c.restore(); }

  // ======================================================================
  //  ПРИЙОМ ПОВІДОМЛЕНЬ
  // ======================================================================
  const om = MP.onMsg;
  MP.onMsg = function (m) {
    if (!m || typeof m.t !== 'string' || m.t[0] !== 'x') return om.apply(this, arguments);
    const g = G(), s = st(g); if (!g || !s) return; const s2 = ex(g);
    try {
      switch (m.t) {
        case 'xR': { if (s.rel === 'war' || s.closed) break; const items = {}; for (const k in m.items || {}) { const n = Math.floor(+m.items[k]); if (n > 0 && D.items[k]) items[k] = Math.min(n, 3000); } carav(g, 'peer', 'me', 'mpgoods', Math.max(60, Math.round(+m.eta) || MP.travel()), { items, label: (m.express ? '⚡ ' : '') + (m.label || 'Маршрут') }); if (m.lost) toast('⚠ Караван «' + s.peerName + '» зазнав засідки — частину вантажу втрачено', 'warn'); trust(1); break; }
        case 'xT': if (m.a === 'prop') { s2.tIn = m.lvl; RW.UI.letter('📜 Пропозиція договору', '«' + s.peerName + '» пропонує: ' + LV[m.lvl] + '.', 'good', null, null, [{ label: '✔ Прийняти', fn: () => MP2.answerTreaty(true) }, { label: 'Відмовити', fn: () => MP2.answerTreaty(false) }]); RW.A && RW.A.sfx('letter'); } else if (m.a === 'ok') setTreaty(m.lvl); else if (m.a === 'no') { s2.tOut = 0; toast('«' + s.peerName + '» відхилив(ла) договір', 'warn'); } else if (m.a === 'break') doBreak(false); break;
        case 'xP': if (m.a === 'prop' && PROJ[m.pid] && !s2.proj) { s2.pIn = m.pid; RW.UI.letter('🏗 Спільний проєкт', '«' + s.peerName + '» пропонує звести: ' + PROJ[m.pid].name + ' (' + listTxt(PROJ[m.pid].need) + ' разом). ' + PROJ[m.pid].desc, 'good', null, null, [{ label: '✔ Прийняти', fn: () => MP2.answerProj(true) }, { label: 'Відмовити', fn: () => MP2.answerProj(false) }]); RW.A && RW.A.sfx('letter'); }
          else if (m.a === 'ok') { if (s2.pOut === m.pid) beginProj(m.pid); } else if (m.a === 'no') { s2.pOut = null; toast('Проєкт відхилено', 'warn'); }
          else if (m.a === 'add' && s2.proj && s2.proj.need[m.def] != null) { const left = s2.proj.need[m.def] - (s2.proj.have[m.def] || 0); const n = Math.min(left, Math.floor(+m.n) || 0); if (n > 0) { s2.proj.have[m.def] = (s2.proj.have[m.def] || 0) + n; s2.proj.peer += n * (D.items[m.def].value || 1); toast('🏗 «' + s.peerName + '» вніс ' + n + '× ' + itName(m.def), 'info'); checkProj(g); } }
          else if (m.a === 'done' && s2.proj && s2.proj.pid === m.pid) { for (const k in s2.proj.need) s2.proj.have[k] = s2.proj.need[k]; checkProj(g); } break;
        case 'xC': s2.cmpPeer[m.w] = +m.v || 0; resolveCmp(g); break;
        case 'xM': s2.medic[m.id] = { skill: +m.skill || 5, name: m.name }; break;
        case 'xJ':
          if (m.a === 'inv') { if (s2.treaty < 2 || s2.joint || s2.jin) { send({ t: 'xJ', a: 'no', jid: m.jid }); break; } s2.jin = { jid: m.jid, tname: m.tname, n: m.n }; RW.UI.letter('⚔ Спільний похід', 'Союзник пропонує спільний похід на «' + m.tname + '» (' + m.n + ' бійців). Ви надішлете 2 найкращих бійців; здобич — навпіл.', 'warn', null, null, [{ label: '⚔ Приєднатись', fn: () => MP2.answerJoint(true) }, { label: 'Відмовити', fn: () => MP2.answerJoint(false) }]); RW.A && RW.A.sfx('alert'); }
          else if (m.a === 'no') { const jt = s2.joint; if (jt && jt.jid === m.jid) { carav(g, 'peer', 'me', 'mpreturn', Math.round(DY * 0.2), { restore: jt.mine.map(x => x.pk), label: 'Похід скасовано' }); s2.joint = null; toast('Друг відмовився від походу', 'warn'); } }
          else if (m.a === 'acc') { const jt = s2.joint; if (!jt || jt.jid !== m.jid || jt.role !== 'A') break; jt.st = 'done'; const res = jointResolve(g, jt, (m.troops || []).map(x => ({ k: String(x.k), sc: +x.sc || 0 }))); send({ t: 'xJ', a: 'res', jid: jt.jid, res, tname: jt.tname }); applyJoint(g, jt, res); }
          else if (m.a === 'res') { const jt = s2.joint; if (!jt || jt.jid !== m.jid || jt.role !== 'B') break; jt.st = 'done'; applyJoint(g, jt, m.res); } break;
      }
    } catch (e) { console.error(e); }
    MP.dirty && (MP.dirty.card = true);
  };
  // прибуття лікаря: позначаємо гостя
  const ma = MP.arrive; MP.arrive = function (g, c) {
    const r = ma.apply(this, arguments);
    try { if (c.kind === 'mpvisit') { const s2 = ex(g); const md = s2.medic[c.mid]; if (md) { const p = g.pawns.find(x => x.mpGuest === c.mid); if (p) { p.mpMedic = true; p.medSkill = md.skill; p.title = 'Лікар з «' + st(g).peerName + '»'; RW.UI.letter('⚕ Лікар у гостях', U.shortName(p) + ' прибув(ла) допомогти: лікуватиме ваших поранених і хворих.', 'good', p); delete s2.medic[c.mid]; } } } } catch (e) { console.error(e); }
    return r;
  };
  const dw = MP.declareWar; MP.declareWar = function () { const r = dw.apply(this, arguments); return r; };

  // ======================================================================
  //  ВІКНО «СОЮЗ»
  // ======================================================================
  MP2.tab = 'pact';
  const A = RW.UI.actions; const wrapA = (k, fn) => { A[k] = el => { const r = fn(el); if (typeof r === 'string') toast(r, 'bad'); }; };
  wrapA('mpTab', el => { MP2.tab = el.dataset.t; });
  wrapA('mpProp', el => MP2.propose(+el.dataset.l)); wrapA('mpBreak', () => MP2.breakTreaty());
  wrapA('mpRoute', el => MP2.addRoute(el.dataset.k)); wrapA('mpRouteDel', el => { const s2 = ex(G()); s2.routes = s2.routes.filter(r => r.id !== +el.dataset.id); });
  wrapA('mpRouteN', el => { const r = ex(G()).routes.find(x => x.id === +el.dataset.id); if (r) r.n = Math.max(5, r.n + +el.dataset.d); });
  wrapA('mpRouteE', el => { const r = ex(G()).routes.find(x => x.id === +el.dataset.id); if (r) r.every = r.every === 2 ? 4 : r.every === 4 ? 7 : 2; });
  wrapA('mpRouteS', el => { const r = ex(G()).routes.find(x => x.id === +el.dataset.id); if (r) r.escort = !r.escort; });
  wrapA('mpAid', el => MP2.sendAid(el.dataset.k)); wrapA('mpDoc', el => MP2.sendDoctor(+el.dataset.id));
  wrapA('mpProj', el => MP2.startProj(el.dataset.k)); wrapA('mpGive', el => MP2.contribute(el.dataset.k, +el.dataset.n));
  wrapA('mpSel', el => { const i = +el.dataset.id; const a = MP2.jointSel; const k = a.indexOf(i); if (k >= 0) a.splice(k, 1); else if (a.length < MP2.JOINT_MAX) a.push(i); });
  wrapA('mpJoint', el => MP2.startJoint(el.dataset.id));
  const bar = (v, col) => '<div class="nat-bar"><i style="width:' + Math.round(v) + '%;background:' + col + '"></i></div>';
  function html() {
    const g = G(); if (!g || !st(g)) return '<p class="sub">Союз доступний лише в мультиплеєрі: почніть гру через «Мультиплеєр» у головному меню.</p>';
    const s = st(g), s2 = ex(g); const on = online(); const tabs = [['pact', '📜 Договір'], ['routes', '🐪 Маршрути'], ['proj', '🏗 Проєкт'], ['help', '⚕ Допомога'], ['joint', '⚔ Похід'], ['board', '🏆 Змагання']];
    let h = '<div class="eco"><div class="eco-tabs">' + tabs.map(t => '<button class="btn xs ' + (MP2.tab === t[0] ? 'on' : '') + '" data-act="mpTab" data-t="' + t[0] + '">' + t[1] + '</button>').join('') + '<span class="eco-sil">' + (on ? '● ' : '○ ') + esc(s.peerName) + '</span></div>';
    if (!on) h += '<div class="plwarn">○ Немає зʼєднання з другом — частина дій недоступна.</div>';
    const T = MP2.tab;
    if (T === 'pact') {
      h += '<div class="eco-card"><span class="eco-ico">' + ['🕊', '📜', '🛡'][s2.treaty] + '</span><div class="eco-ci"><b>' + LV[s2.treaty] + '</b><div class="sub">Довіра: ' + Math.round(s2.trust) + '/100</div>' + bar(s2.trust, s2.trust > 60 ? '#7ad07a' : s2.trust > 30 ? '#e0b84a' : '#e0584a') + '</div></div>';
      for (const l of [1, 2]) { const need = l === 1 ? MP2.PACT_TRUST : MP2.ALLY_TRUST; const have = s2.treaty >= l; h += '<div class="eco-card"><span class="eco-ico">' + (l === 1 ? '📜' : '🛡') + '</span><div class="eco-ci"><b>' + LV[l] + '</b><div class="sub">' + (l === 1 ? 'Дорога коротша на 25%, постійні маршрути, лікар у гості.' : 'Дорога коротша на 40%, спільні походи, менше засідок.') + ' Потрібна довіра ' + need + '.</div></div><div class="eco-rw">' + (have ? '<span class="pos">✔ діє</span>' : s2.tOut === l ? '<span class="sub">очікуємо відповіді…</span>' : '<button class="btn xs" data-act="mpProp" data-l="' + l + '" ' + (!on || s2.treaty !== l - 1 || s2.trust < need ? 'disabled' : '') + '>Запропонувати</button>') + '</div></div>'; }
      if (s2.treaty) h += '<div class="btnrow"><button class="btn xs" data-act="mpBreak">✖ Розірвати договір (−20 довіри)</button></div>';
      h += '<p class="sub">Довіра росте від вантажів, спільних проєктів і допомоги; падає від розриву договору. Війна автоматично скасовує договір.</p>';
    } else if (T === 'routes') {
      if (s2.treaty < 1) h += '<p class="sub">Постійні маршрути відкриваються з торговим договором.</p>';
      else {
        h += '<div class="sub">Каравани вирушають самі кожні кілька діб. Ескорт (' + MP2.ESCORT_FEE + ' ◎ за рейс) майже усуває ризик засідки (' + Math.round(MP2.ROUTE_AMBUSH * 100) + '%).</div>';
        for (const r of s2.routes) h += '<div class="eco-card"><img src="' + RW.UI.itemImg(r.def) + '"><div class="eco-ci"><b>' + r.n + ' × ' + esc(itName(r.def)) + '</b><div class="sub">кожні ' + r.every + ' д · відправлено ' + r.sent + ' · наступний за ' + Math.max(0, (r.next - g.tick) / DY).toFixed(1) + ' д</div></div><div class="eco-rw"><button class="btn xs" data-act="mpRouteN" data-id="' + r.id + '" data-d="-10">−</button> <button class="btn xs" data-act="mpRouteN" data-id="' + r.id + '" data-d="10">+</button> <button class="btn xs" data-act="mpRouteE" data-id="' + r.id + '">⏱</button> <button class="btn xs ' + (r.escort ? 'on' : '') + '" data-act="mpRouteS" data-id="' + r.id + '">🛡</button> <button class="btn xs" data-act="mpRouteDel" data-id="' + r.id + '">✖</button></div></div>';
        h += '<h4>Додати маршрут</h4><div class="eco-tabs">' + Object.keys(PRESETS).map(k => '<button class="btn xs" data-act="mpRoute" data-k="' + k + '">' + PRESETS[k][1] + '× ' + esc(itName(PRESETS[k][0])) + '</button>').join('') + '</div>';
      }
    } else if (T === 'proj') {
      const p = s2.proj;
      if (p) { const P = PROJ[p.pid]; h += '<div class="eco-card"><span class="eco-ico">' + P.ico + '</span><div class="eco-ci"><b>' + P.name + '</b><div class="sub">' + esc(P.desc) + '</div></div></div>'; for (const k in p.need) { const hv = p.have[k] || 0; h += '<div class="eco-card"><img src="' + RW.UI.itemImg(k) + '"><div class="eco-ci"><b>' + esc(itName(k)) + '</b> <span class="sub">' + hv + ' / ' + p.need[k] + ' · на складі ' + stockOf(k) + '</span>' + bar(hv / p.need[k] * 100, '#d9a53b') + '</div><div class="eco-rw"><button class="btn xs" data-act="mpGive" data-k="' + k + '" data-n="25" ' + (stockOf(k) < 1 || hv >= p.need[k] ? 'disabled' : '') + '>+25</button> <button class="btn xs" data-act="mpGive" data-k="' + k + '" data-n="9999">усе</button></div></div>'; } h += '<p class="sub">Внесок у цінності: ви ' + Math.round(p.me) + ' · «' + esc(s.peerName) + '» ' + Math.round(p.peer) + '</p>'; }
      else { if (s2.pIn) h += '<div class="plwarn">Вам надійшла пропозиція проєкту — відповідь у листі.</div>'; for (const k in PROJ) { const P = PROJ[k]; const done = s2.projDone.includes(k); h += '<div class="eco-card"><span class="eco-ico">' + P.ico + '</span><div class="eco-ci"><b>' + P.name + '</b><div class="sub">' + esc(P.desc) + '<br>Потрібно разом: ' + esc(listTxt(P.need)) + '</div></div><div class="eco-rw">' + (done ? '<span class="pos">✔ зведено</span>' : s2.pOut === k ? '<span class="sub">очікуємо…</span>' : '<button class="btn xs" data-act="mpProj" data-k="' + k + '" ' + (on ? '' : 'disabled') + '>Розпочати</button>') + '</div></div>'; } }
    } else if (T === 'help') {
      h += '<h4>⚡ Експрес-допомога</h4><div class="sub">Доставка вдвічі швидша за звичайну. Друг отримує вантаж біля торгової точки.</div><div class="eco-tabs"><button class="btn xs" data-act="mpAid" data-k="med" ' + (on ? '' : 'disabled') + '>🩹 Аптечка (6 ліків + 8 трав)</button><button class="btn xs" data-act="mpAid" data-k="food" ' + (on ? '' : 'disabled') + '>🍲 Їжа (30 обідів)</button><button class="btn xs" data-act="mpAid" data-k="build" ' + (on ? '' : 'disabled') + '>🔨 Будматеріали</button></div>';
      h += '<h4>⚕ Лікар у гості (2 доби)</h4>' + (s2.treaty < 1 ? '<p class="sub">Потрібен торговий договір.</p>' : cols(g).filter(p => p.skillLvl('medicine') >= MP2.MED_MIN).map(p => '<div class="eco-card"><div class="eco-ci"><b>' + esc(U.fullName(p)) + '</b><div class="sub">Медицина ' + p.skillLvl('medicine') + '</div></div><div class="eco-rw"><button class="btn xs" data-act="mpDoc" data-id="' + p.id + '" ' + (on ? '' : 'disabled') + '>⚕ Вислати</button></div></div>').join('') || '<p class="sub">Немає колоністів із медициною ' + MP2.MED_MIN + '+.</p>');
    } else if (T === 'joint') {
      if (s2.treaty < 2) h += '<p class="sub">Спільні походи відкриваються з військовим союзом.</p>';
      else if (s2.joint) h += '<div class="eco-card"><span class="eco-ico">⚔</span><div class="eco-ci"><b>Похід на «' + esc(s2.joint.tname) + '»</b><div class="sub">' + (s2.joint.st === 'wait' ? 'Очікуємо відповіді друга…' : 'Бійці в дорозі.') + ' Бійців: ' + s2.joint.mine.length + '</div></div></div>';
      else { h += '<div class="sub">Оберіть до ' + MP2.JOINT_MAX + ' бійців (інакше підуть найкращі). Здобич ділиться навпіл; піратська фракція погіршить ставлення.</div>'; for (const p of cols(g).filter(p => !p.isChild && !p.noViolence)) h += '<button class="btn xs ' + (MP2.jointSel.includes(p.id) ? 'on' : '') + '" data-act="mpSel" data-id="' + p.id + '">' + esc(U.shortName(p)) + ' · ' + Math.round(fscore(p)) + '</button> '; h += '<h4>Цілі</h4>'; for (const t of MP2.targets(g)) h += '<div class="eco-card"><span class="eco-ico">☠</span><div class="eco-ci"><b>' + esc(t.name) + '</b><div class="sub">Піратська фортеця · населення ~' + t.pop + '</div></div><div class="eco-rw"><button class="btn xs" data-act="mpJoint" data-id="' + t.id + '" ' + (on ? '' : 'disabled') + '>⚔ Запросити</button></div></div>'; }
    } else if (T === 'board') {
      const i = s.peerInfo || {}; const c = s2.cmp; const cat = c && CATS.find(x => x[0] === c.cat);
      h += '<h4>🏆 Змагання тижня</h4>' + (c ? '<div class="eco-card"><span class="eco-ico">🏆</span><div class="eco-ci"><b>' + cat[1] + '</b><div class="sub">Ваш результат: ' + (c.mine != null ? c.mine : Math.max(0, Math.round(cat[2](g) - c.base))) + ' · залишилось ' + Math.max(0, (MP2.CMP_DAYS * DY - (g.tick - c.t0)) / DY).toFixed(1) + ' д' + (c.mine != null ? ' · очікуємо друга' : '') + '</div></div></div>' : '<p class="sub">Змагання почнеться з 2-го дня й зʼєднання.</p>');
      if (s2.last) h += '<div class="sub">Останнє (' + esc(s2.last.cat) + '): ' + s2.last.mine + ' проти ' + s2.last.peer + ' — ' + (s2.last.win > 0 ? '🏆 перемога' : s2.last.win < 0 ? 'поразка' : 'нічия') + '</div>';
      const me = { pop: cols(g).length, day: dayN(g) + 1, wealth: g.wealth ? Math.round(g.wealth.total) : 0, mood: Math.round(cols(g).reduce((a, p) => a + (p.mood || 0), 0) / Math.max(1, cols(g).length)), kills: g.stats.kills || 0 };
      h += '<h4>📊 Таблиця</h4><table class="tbl2"><tr><td></td><td><b>' + esc(s.myName) + '</b></td><td><b>' + esc(s.peerName) + '</b></td></tr>' + [['👥 Колоністи', me.pop, i.pop], ['📅 День', me.day, i.day], ['💰 Багатство', me.wealth, i.wealth], ['😊 Настрій', me.mood + '%', i.mood != null ? i.mood + '%' : '—']].map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td>' + (r[2] != null ? r[2] : '—') + '</td></tr>').join('') + '</table>';
      h += '<div class="sub">Рахунок змагань: ' + s2.rec.w + ' перемог · ' + s2.rec.l + ' поразок · ' + s2.rec.t + ' тижнів. Спільні проєкти: ' + s2.stat.proj + ', караванів: ' + s2.stat.routes + ', походів: ' + s2.stat.joint + '.</div>';
    }
    return h + '</div>';
  }
  RW.UI.addWin('ally', { title: '🤝 Союз колоній', cls: 'win-wide', fn: html });
  RW.UI.TABS.splice(RW.UI.TABS.length - 1, 0, { id: 'ally', label: 'Союз', key: 'U' }); RW.UI.keyWins.KeyU = 'ally';

  // ---------- підключення ----------
  const lt = RW.Life.tick;
  RW.Life.tick = function (g) {
    lt(g); if (!st(g)) return;
    try {
      const t = g.tick, s2 = ex(g); if (t % DY === 600) { routeTick(g); cmpDaily(g); } if (t % 90 === 41) medicTick(g); if (t % 60 === 17) jointTick(g);
      if (t % 200 === 19 && s2.treaty && st(g).rel === 'war') { s2.treaty = 0; trust(-25); RW.UI.letter('Договір скасовано', 'Війна розірвала договір між колоніями.', 'bad'); }
    } catch (e) { console.error(e); }
  };
  MP2._t = { ex, routeTick, cmpDaily, resolveCmp, medicTick, jointResolve, setTreaty, checkProj, beginProj, startCmp };
})();
