'use strict';
// ============================================================
//  mp.js — мультиплеєр: WebRTC (обмін кодами), візити, каравани, війна, чат
//  Кожен гравець має власну симуляцію своєї колонії. Між колоніями
//  обмінюються повідомленнями: товари, люди (гості / рейдери), чат.
// ============================================================
(function () {
  const D = RW.D, U = RW.U; const G = () => RW.G; const DY = D.DAY;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ================= Транспорт (WebRTC DataChannel, без сервера) =================
  const Net = RW.Net = { state: 'idle', role: null, ping: 0, last: 0, subs: [] };
  let pc = null, dc = null;
  const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };
  const b64 = buf => { const a = new Uint8Array(buf); let s = ''; for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = s => { const bin = atob(s); const a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; };
  async function enc(obj) {
    const s = JSON.stringify(obj);
    try { if (window.CompressionStream) { const cs = new CompressionStream('deflate-raw'); const w = cs.writable.getWriter(); w.write(new TextEncoder().encode(s)); w.close(); return 'RW1.' + b64(await new Response(cs.readable).arrayBuffer()); } } catch (e) { }
    return 'RW0.' + btoa(unescape(encodeURIComponent(s)));
  }
  async function dec(code) {
    code = String(code || '').replace(/\s+/g, '');
    if (code.startsWith('RW1.')) { const ds = new DecompressionStream('deflate-raw'); const w = ds.writable.getWriter(); w.write(unb64(code.slice(4))); w.close(); return JSON.parse(await new Response(ds.readable).text()); }
    if (code.startsWith('RW0.')) return JSON.parse(decodeURIComponent(escape(atob(code.slice(4)))));
    throw new Error('Невірний код');
  }
  const waitIce = p => new Promise(res => { if (p.iceGatheringState === 'complete') return res(); const t = setTimeout(res, 6000); p.addEventListener('icegatheringstatechange', () => { if (p.iceGatheringState === 'complete') { clearTimeout(t); res(); } }); });
  const emit = (k, m) => { for (const f of Net.subs.slice()) { try { f(k, m); } catch (e) { console.error(e); } } };
  Net.on = f => { Net.subs.push(f); };
  function wire(ch) {
    dc = ch;
    ch.onopen = () => { Net.state = 'open'; Net.last = performance.now(); emit('open'); };
    ch.onclose = () => { if (Net.state !== 'closed') { Net.state = 'closed'; emit('close'); } };
    ch.onmessage = e => { Net.last = performance.now(); let m; try { m = JSON.parse(e.data); } catch (_) { return; } if (m.t === 'ping') { Net.send({ t: 'pong', ts: m.ts }); return; } if (m.t === 'pong') { Net.ping = Math.round(performance.now() - m.ts); return; } emit('msg', m); };
  }
  function watch(p) { p.onconnectionstatechange = () => { if ((p.connectionState === 'failed' || p.connectionState === 'closed') && Net.state !== 'closed') { Net.state = 'closed'; emit('close'); } }; }
  Net.reset = () => { try { if (dc) { dc.onclose = null; dc.close(); } if (pc) pc.close(); } catch (e) { } pc = dc = null; Net.state = 'idle'; Net.role = null; };
  Net.supported = () => !!window.RTCPeerConnection;
  Net.host = async () => { Net.reset(); pc = new RTCPeerConnection(ICE); watch(pc); wire(pc.createDataChannel('rw')); await pc.setLocalDescription(await pc.createOffer()); await waitIce(pc); Net.role = 'host'; Net.state = 'waiting'; return enc({ t: 'o', sdp: pc.localDescription.sdp }); };
  Net.accept = async code => { const o = await dec(code); if (o.t !== 'a') throw new Error('Це не відповідь гостя'); await pc.setRemoteDescription({ type: 'answer', sdp: o.sdp }); };
  Net.join = async code => { const o = await dec(code); if (o.t !== 'o') throw new Error('Це не код хоста'); Net.reset(); pc = new RTCPeerConnection(ICE); watch(pc); pc.ondatachannel = e => wire(e.channel); await pc.setRemoteDescription({ type: 'offer', sdp: o.sdp }); await pc.setLocalDescription(await pc.createAnswer()); await waitIce(pc); Net.role = 'guest'; Net.state = 'waiting'; return enc({ t: 'a', sdp: pc.localDescription.sdp }); };
  Net.send = o => { if (dc && dc.readyState === 'open') { try { dc.send(JSON.stringify(o)); return true; } catch (e) { } } return false; };
  Net.buffered = () => (dc ? dc.bufferedAmount : 0);
  Net.close = () => { Net.reset(); Net.state = 'closed'; emit('close'); };
  setInterval(() => { if (Net.state !== 'open') return; Net.send({ t: 'ping', ts: performance.now() }); if (performance.now() - Net.last > 20000) { Net.state = 'closed'; try { dc.close(); } catch (e) { } emit('close'); } }, 3000);

  // ================= Ігрова логіка =================
  const MP = RW.MP = { chat: [], snap: null, tab: 'overview', dirty: { tab: true, log: true, card: true }, rp: {}, peek: false };
  const st = g => g && g.ext && g.ext.mp;
  MP.st = () => st(G()); MP.active = () => !!st(G()); MP.online = () => Net.state === 'open';
  const W = () => RW.World;
  const E = () => RW.Events;
  const myName = () => st(G()).myName; const peerName = () => st(G()).peerName;
  const nm = p => U.shortName(p);
  const itName = d => (D.items[d] && D.items[d].name) || d;
  const listTxt = l => Object.keys(l || {}).map(k => l[k] + '× ' + itName(k)).join(', ') || '—';
  const val = l => { let v = 0; for (const k in l || {}) v += (D.items[k] ? D.items[k].value || 0 : 0) * l[k]; return Math.round(v); };
  const send = o => Net.send(o);

  D.thoughts.mp_guest = { l: 'Гості з іншої колонії', v: 4, dur: 0.8 * DY, stack: 1 }; D.thoughtIco && (D.thoughtIco.mp_guest = '🌐');
  D.thoughts.mp_trip = { l: 'Побував у гостях', v: 6, dur: 1.2 * DY, stack: 1 }; D.thoughtIco && (D.thoughtIco.mp_trip = '🧳');
  D.thoughts.mp_raid_home = { l: 'Повернувся з походу', v: -2, dur: 0.6 * DY, stack: 1 }; D.thoughtIco && (D.thoughtIco.mp_raid_home = '⚔');

  MP.init = function (g, cfg) {
    g.ext = g.ext || {};
    g.ext.mp = { on: true, role: cfg.role, myName: cfg.myName, peerName: cfg.peerName, worldSeed: cfg.worldSeed, worldBiome: cfg.worldBiome, pos: cfg.pos, mode: cfg.mode, sid: cfg.sid, rel: 'peace', relSince: 0, warLock: 0, away: {}, offers: [], out: {}, inRaids: [], guests: {}, recall: {}, stats: { trades: 0, visits: 0, raidsOut: 0, raidsIn: 0, wins: 0, losses: 0 }, raidCool: 0, closed: false, peerInfo: null, peaceReq: false };
    MP.chat = []; MP.snap = null; MP.rp = {}; MP.peek = false; MP.dirty = { tab: true, log: true, card: true };
    if (Net.state === 'open') setTimeout(() => { MP.peek = true; send({ t: 'peek', on: true }); }, 500);
    sysChat('Колонія «' + cfg.peerName + '» тепер ваш сусід. Світ: мир.');
  };

  // ---------- чат ----------
  function addChat(who, text) { MP.chat.push({ w: who, t: Date.now(), text: String(text).slice(0, 300) }); if (MP.chat.length > 120) MP.chat.shift(); MP.dirty.log = true; if (who === 'peer' && !MP.isOpen()) { MP.unread = (MP.unread || 0) + 1; RW.UI && RW.UI.toast('💬 ' + peerName() + ': ' + String(text).slice(0, 60), 'info'); } }
  function sysChat(text) { addChat('sys', text); RW.UI && RW.UI.log && RW.UI.log('🌐 ' + text); }
  MP.say = text => { text = String(text || '').trim(); if (!text) return; if (!MP.online()) { RW.UI.toast('Немає зʼєднання', 'bad'); return; } send({ t: 'chat', text }); addChat('me', text); };
  MP.isOpen = () => !!(RW.UI && RW.UI.win && RW.UI.win.mp);

  // ---------- допоміжні ----------
  function mapDist() { const w = W().ensure(G()); const a = w.settlements.find(s => s.id === 'me'), b = w.settlements.find(s => s.id === 'peer'); if (!a || !b) return 0.4; return Math.hypot((a.x - b.x) * 1.58, a.y - b.y); }
  MP.travel = f => Math.round(DY * (0.22 + mapDist() * 0.9) * (f || 1));
  MP.hours = t => Math.max(1, Math.round(t / D.HOUR));
  function takeItems(list) {
    const g = G(), map = g.map; const stock = E().colonyStock();
    for (const k in list) if ((stock[k] || 0) < list[k]) return false;
    for (const k in list) { let left = list[k]; const s = map.byDef.get(k); for (const it of Array.from(s || [])) { if (left <= 0) break; if (it.forbid || it.res) continue; const t = Math.min(left, it.n); map.takeItem(it, t); left -= t; } }
    return true;
  }
  function dropGoods(list) {
    const g = G(), map = g.map, sp = g.tradeSpot;
    for (const def in list) { const n = list[def]; if (n <= 0) continue; for (let t = 0; t < 80; t++) { const x = Math.floor(sp.x + U.rr(-3, 3)), y = Math.floor(sp.y + U.rr(-3, 3)); if (!map.inb(x, y)) continue; const i = y * map.w + x; if (map.cost[i] === 0 || map.blk[i]) continue; map.addItem(def, n, x, y); break; } }
    RW.R && RW.R.fx.pod(sp.x + 0.5, sp.y + 0.5); RW.A && RW.A.sfx('good');
  }
  function colonists() { return G().pawns.filter(p => p.faction === 'colony' && !p.dead); }
  function packPawn(p) {
    const g = G(), map = g.map; RW.AI.endJob(p); if (p.carry) { map.addItem(p.carry.def, p.carry.n || 1, p.tx, p.ty); p.carry = null; }
    p.drafted = false; const o = p.serialize(); o.vstate = undefined;
    const k = g.pawns.indexOf(p); if (k >= 0) g.pawns.splice(k, 1); RW.AI.release(p); if (g.sel && g.sel.p === p) g.sel = null; p.away = true;
    return JSON.parse(JSON.stringify(o));
  }
  function foreign(packed, faction) {
    const g = G(); const p = RW.Pawn.deserialize(JSON.parse(JSON.stringify(packed)));
    p.mpOrigId = packed.id; p.id = U.nextId(); p.faction = faction; p.rel = {}; p.opinion = {}; p.kinT = {}; p.bed = null; p.job = null; p.mental = null; p.drafted = false; p.work = {};
    const sp = E().edgeSpawn(g.map, g.home); p.x = sp.x + 0.5 + U.rr(-0.5, 0.5); p.y = sp.y + 0.5 + U.rr(-0.5, 0.5); p.needs.food = 1; p.needs.rest = 1; return p;
  }
  function cleanReturn(o) { for (const k of ['vstate', 'leaveAt', 'mpGuest', 'exitTile', 'mpRaid', 'mpOrigId', 'aiKind', 'fleeing', 'breach', 'target', 'combatTarget', 'mpClose', 'away', 'gone', 'title', 'isTrader']) delete o[k]; o.faction = 'colony'; o.drafted = false; o.dead = false; return o; }
  function restorePawns(list, thought) {
    const g = G(), map = g.map; const names = [];
    for (const raw of list) {
      const o = cleanReturn(JSON.parse(JSON.stringify(raw))); const p = RW.Pawn.deserialize(o); p.faction = 'colony'; p.bed = null;
      for (const b of map.buildings) if (b.owner === p.id) { p.bed = b; break; }
      let x = g.home.x, y = g.home.y; for (let t = 0; t < 40; t++) { const xx = Math.floor(g.home.x + U.rr(-5, 5)), yy = Math.floor(g.home.y + U.rr(-5, 5)); if (map.inb(xx, yy) && map.cost[yy * map.w + xx] > 0) { x = xx; y = yy; break; } }
      p.x = x + 0.5; p.y = y + 0.5; g.pawns.push(p); if (thought) p.addThought(thought); names.push(nm(p));
    }
    return names;
  }
  const carav = (g, from, to, kind, dur, data) => W().sendCaravan(g, from, to, kind, dur, Object.assign({ mp: 1 }, data || {}));

  // ---------- торгівля ----------
  MP.sendOffer = function (give, want) {
    const g = G(), s = st(g); if (!MP.online()) return 'Немає зʼєднання';
    if (s.rel === 'war') return 'Під час війни торгівля неможлива';
    give = clean(give); want = clean(want); if (!Object.keys(give).length && !Object.keys(want).length) return 'Порожня пропозиція';
    if (Object.keys(give).length > 12 || Object.keys(want).length > 12) return 'Забагато позицій';
    if (!takeItems(give)) return 'У вас немає стільки ресурсів';
    const id = U.nextId() + '_' + Date.now(); s.out[id] = { give, want, t: g.tick };
    send({ t: 'tradeOffer', id, give, want }); carav(g, 'me', 'peer', 'mpout', MP.travel(0.6), { mp: 'out', ico: '📦' });
    sysChat('Пропозицію надіслано: віддаєте ' + listTxt(give) + (Object.keys(want).length ? ', просите ' + listTxt(want) : ' (подарунок)') + '.'); MP.dirty.tab = true; return null;
  };
  function clean(l) { const o = {}; for (const k in l || {}) { const n = Math.floor(+l[k]); if (n > 0 && D.items[k]) o[k] = Math.min(n, 5000); } return o; }
  MP.accept = function (id) {
    const g = G(), s = st(g); const i = s.offers.findIndex(o => o.id === id); if (i < 0) return; const o = s.offers[i];
    if (Object.keys(o.want).length && !takeItems(o.want)) { RW.UI.toast('У вас немає потрібних ресурсів: ' + listTxt(o.want), 'bad'); return; }
    s.offers.splice(i, 1); const eta = MP.travel(); carav(g, 'peer', 'me', 'mpgoods', eta, { items: o.give, label: 'Угода' }); s.stats.trades++;
    send({ t: 'tradeReply', id, ok: true, goods: o.want, eta }); sysChat('Угоду прийнято: отримаєте ' + listTxt(o.give) + ' за ~' + MP.hours(eta) + ' год.'); MP.dirty.tab = true;
  };
  MP.decline = function (id) { const s = st(G()); const i = s.offers.findIndex(o => o.id === id); if (i < 0) return; s.offers.splice(i, 1); send({ t: 'tradeReply', id, ok: false }); sysChat('Пропозицію відхилено.'); MP.dirty.tab = true; };

  // ---------- візити ----------
  MP.canVisit = p => !p.downed && !p.mental && !p.dead;
  MP.sendVisit = function (pid, stayDays) {
    const g = G(), s = st(g); if (!MP.online()) return 'Немає зʼєднання'; if (s.rel === 'war') return 'Під час війни візити неможливі';
    const p = g.pawns.find(x => x.id === pid); if (!p || p.faction !== 'colony') return 'Колоніст не знайдений';
    if (!MP.canVisit(p)) return 'Колоніст зараз не може йти'; if (colonists().length < 2) return 'Хтось має залишитись у колонії';
    if (Object.values(s.away).filter(a => a.kind === 'visit').length >= 2) return 'Не більше 2 гостей одночасно';
    stayDays = U.clamp(+stayDays || 1, 1, 3); const eta = MP.travel(); const packed = packPawn(p); const id = 'v' + U.nextId() + '_' + Date.now();
    s.away[id] = { kind: 'visit', packeds: [packed], t: g.tick, deadline: g.tick + eta * 2 + stayDays * DY + DY, name: nm(p) };
    send({ t: 'visit', id, pawn: packed, stay: stayDays * DY, eta, from: s.myName }); send({ t: 'peek', on: true }); carav(g, 'me', 'peer', 'mpout', eta, { mp: 'out', ico: '🚶' });
    sysChat(nm(p) + ' вирушає в гості до «' + s.peerName + '» (~' + MP.hours(eta) + ' год дороги, гостює ' + stayDays + ' д.).'); MP.dirty.tab = true; return null;
  };
  MP.recall = function (id) { const s = st(G()); if (!s.away[id] || s.away[id].kind !== 'visit') return; send({ t: 'recall', id }); sysChat('Гостя закликано повернутись.'); };
  MP.sendHome = function (mid) { const s = st(G()); const gu = s.guests[mid]; if (!gu) return; const p = G().pawns.find(x => x.id === gu.pawnId); if (p) p.leaveAt = 0; sysChat('Гостя відпроваджено.'); };

  // ---------- війна / мир / набіги ----------
  MP.declareWar = function () { const g = G(), s = st(g); if (!MP.online()) return 'Немає зʼєднання'; if (s.rel === 'war') return 'Вже війна'; if (g.tick < s.warLock) return 'Нещодавно був мир: зачекайте ' + Math.ceil((s.warLock - g.tick) / DY) + ' д.'; setWar(true); send({ t: 'war' }); return null; };
  function setWar(on, byPeer) {
    const g = G(), s = st(g); s.rel = on ? 'war' : 'peace'; s.relSince = g.tick; s.peaceReq = false; if (!on) s.warLock = g.tick + 2 * DY; MP.dirty.tab = true; MP.dirty.card = true;
    if (on) { for (const k in s.guests) { const p = g.pawns.find(x => x.id === s.guests[k].pawnId); if (p) p.leaveAt = 0; } s.offers = []; RW.UI.letter(byPeer ? 'Війна!' : 'Війну оголошено', byPeer ? 'Колонія «' + s.peerName + '» оголосила вам війну. Торгівля й візити закриті. Перші набіги можливі через 1 добу.' : 'Ви оголосили війну колонії «' + s.peerName + '». Торгівля й візити закриті. Перші набіги можливі через 1 добу.', 'bad'); }
    else RW.UI.letter('Мир', 'Мир із «' + s.peerName + '» укладено. Торгівля й візити знову відкриті.', 'good');
    sysChat(on ? 'ВІЙНА.' : 'МИР.');
  }
  MP.proposePeace = function () { const s = st(G()); if (!MP.online()) return 'Немає зʼєднання'; if (s.rel !== 'war') return 'Зараз мир'; send({ t: 'peaceReq' }); sysChat('Ви запропонували мир.'); return null; };
  MP.answerPeace = function (ok) { const s = st(G()); if (!s.peaceReq) return; send({ t: 'peaceAns', ok }); if (ok) setWar(false); else { s.peaceReq = false; sysChat('Мир відхилено.'); } MP.dirty.tab = true; };
  MP.raidMax = () => Math.max(0, Math.min(8, Math.floor(colonists().length * 0.7), colonists().length - 1));
  MP.canRaid = () => { const g = G(), s = st(g); if (!MP.online()) return 'Немає зʼєднання'; if (s.rel !== 'war') return 'Набіги можливі лише під час війни'; if (g.tick - s.relSince < DY) return 'Ще діє перша доба війни (' + Math.ceil((DY - (g.tick - s.relSince)) / D.HOUR) + ' год)'; if (g.tick < s.raidCool) return 'Загін відпочиває: ' + Math.ceil((s.raidCool - g.tick) / D.HOUR) + ' год'; if (Object.values(s.away).some(a => a.kind === 'raid')) return 'Попередній набіг ще триває'; return null; };
  MP.sendRaid = function (ids) {
    const g = G(), s = st(g); const why = MP.canRaid(); if (why) return why;
    const ps = ids.map(i => g.pawns.find(p => p.id === i)).filter(p => p && p.faction === 'colony' && !p.downed && !p.mental && !p.noViolence);
    if (!ps.length) return 'Оберіть бійців'; if (ps.length > MP.raidMax()) return 'Максимум ' + MP.raidMax() + ' бійців (хтось має лишитись вдома)';
    const eta = Math.round(MP.travel(0.8)); const packeds = ps.map(packPawn); const id = 'r' + U.nextId() + '_' + Date.now();
    s.away[id] = { kind: 'raid', packeds, t: g.tick, deadline: g.tick + eta * 2 + 3 * DY, name: ps.map(nm).join(', ') }; s.raidCool = g.tick + 2.5 * DY; s.stats.raidsOut++;
    send({ t: 'raid', id, pawns: packeds, eta, from: s.myName }); carav(g, 'me', 'peer', 'mpout', eta, { mp: 'out', ico: '⚔️' });
    sysChat('Набіг: ' + ps.map(nm).join(', ') + ' вирушили до «' + s.peerName + '» (~' + MP.hours(eta) + ' год).'); MP.dirty.tab = true; return null;
  };

  // ---------- приймання повідомлень ----------
  MP.onMsg = function (m) {
    const g = G(), s = st(g); if (!g || !s) return;
    switch (m.t) {
      case 'status': s.peerInfo = m.i; MP.dirty.card = true; break;
      case 'chat': addChat('peer', m.text); break;
      case 'arrived': { const nmP = s.peerName; const t = m.k === 'goods' ? '📦 ' + (m.label || 'Караван') + ' доставлено до «' + nmP + '»' : m.k === 'visit' ? '🚶 ' + (m.name || 'Колоніст') + ' прибув(ла) у гості до «' + nmP + '»' : '⚔ Ваш загін (' + (m.n || '?') + ') прибув до «' + nmP + '»'; sysChat(t); RW.UI.toast(t, m.k === 'raid' ? 'bad' : 'good'); MP.dirty.tab = true; break; }
      case 'tradeOffer': {
        if (s.rel === 'war' || s.closed) { send({ t: 'tradeReply', id: m.id, ok: false }); break; }
        s.offers.push({ id: m.id, give: clean(m.give), want: clean(m.want), t: g.tick });
        MP.dirty.tab = true; MP.dirty.card = true; RW.A && RW.A.sfx('letter');
        const gift = !Object.keys(m.want || {}).length; RW.UI.toast('🌐 ' + s.peerName + (gift ? ' надсилає подарунок: ' : ' пропонує угоду: ') + listTxt(m.give), 'good');
        if (gift) MP.accept(m.id); else sysChat('Нова пропозиція: ' + listTxt(m.give) + ' за ' + listTxt(m.want) + '. Відкрийте мультиплеєр (N).');
        break;
      }
      case 'tradeReply': {
        const o = s.out[m.id]; if (!o) break; delete s.out[m.id];
        if (m.ok) { s.stats.trades++; if (m.goods && Object.keys(m.goods).length) carav(g, 'peer', 'me', 'mpgoods', m.eta || MP.travel(), { items: clean(m.goods), label: 'Угода' }); sysChat('«' + s.peerName + '» прийняв угоду' + (m.goods && Object.keys(m.goods).length ? ': ваші ' + listTxt(clean(m.goods)) + ' в дорозі.' : ' (подарунок).')); }
        else { carav(g, 'peer', 'me', 'mpgoods', Math.round(DY * 0.35), { items: o.give, label: 'Повернення' }); sysChat('«' + s.peerName + '» відхилив угоду — товар повертається.'); }
        MP.dirty.tab = true; break;
      }
      case 'visit': {
        if (s.rel === 'war' || s.closed) { send({ t: 'visitEnd', id: m.id, pawn: m.pawn, refused: true }); sysChat('Гостя з «' + s.peerName + '» не прийнято (кордони закриті).'); break; }
        carav(g, 'peer', 'me', 'mpvisit', m.eta, { mid: m.id, packed: m.pawn, stay: m.stay }); sysChat('До вас прямує гість: ' + U.shortName(m.pawn) + ' (~' + MP.hours(m.eta) + ' год).'); break;
      }
      case 'visitEnd': {
        const a = s.away[m.id]; if (!a) break; delete s.away[m.id];
        const merged = Object.assign({}, a.packeds[0], m.pawn, { id: a.packeds[0].id }); const eta = m.refused ? Math.round(MP.travel(0.3)) : MP.travel();
        carav(g, 'peer', 'me', 'mpreturn', eta, { restore: [merged], thought: m.refused ? null : 'mp_trip', label: 'Повернення гостя' }); if (!m.refused) { s.stats.visits++; } sysChat(a.name + (m.refused ? ': гостя не прийняли, повертається.' : ' повертається з гостей (~' + MP.hours(eta) + ' год).')); if (!Object.values(s.away).some(x => x.kind === 'visit')) { send({ t: 'peek', on: false }); MP.snap = null; } MP.dirty.tab = true; break;
      }
      case 'visitDead': { const a = s.away[m.id]; if (!a) break; delete s.away[m.id]; RW.UI.letter('Загибель у гостях', a.name + ' загинув(ла) у колонії «' + s.peerName + '»' + (m.cause ? ': ' + m.cause : '') + '.', 'bad'); sysChat(a.name + ' загинув(ла) у гостях.'); if (!Object.values(s.away).some(x => x.kind === 'visit')) { send({ t: 'peek', on: false }); MP.snap = null; } MP.dirty.tab = true; break; }
      case 'recall': s.recall[m.id] = true; { const gu = s.guests[m.id]; if (gu) { const p = g.pawns.find(x => x.id === gu.pawnId); if (p) p.leaveAt = 0; } } break;
      case 'peek': MP.peek = !!m.on; if (m.on) sendSnap(); break;
      case 'snap': MP.snap = m; MP.dirty.card = true; break;
      case 'war': if (s.rel !== 'war') setWar(true, true); break;
      case 'peaceReq': s.peaceReq = true; MP.dirty.tab = true; MP.dirty.card = true; RW.UI.toast('🕊 «' + s.peerName + '» пропонує мир (мультиплеєр → Війна)', 'good'); RW.A && RW.A.sfx('letter'); break;
      case 'peaceAns': if (m.ok) setWar(false); else sysChat('«' + s.peerName + '» відхилив мир.'); break;
      case 'raid': {
        if (s.rel !== 'war') { send({ t: 'raidResult', id: m.id, refused: true, survivors: m.pawns.map(p => Object.assign({}, p, { mpOrigId: p.id })), dead: [], captured: [], loot: {}, eta: Math.round(MP.travel(0.3)) }); break; }
        s.stats.raidsIn++; carav(g, 'peer', 'me', 'mpraid', m.eta, { mid: m.id, packed: m.pawns });
        RW.UI.letter('⚔ Набіг гравця!', 'Колонія «' + s.peerName + '» посилає на вас загін із ' + m.pawns.length + ' бійців. Прибуття приблизно через ' + MP.hours(m.eta) + ' год. Озброюйтесь і готуйте оборону!', 'bad'); break;
      }
      case 'raidResult': {
        const a = s.away[m.id]; if (!a) break; delete s.away[m.id];
        const orig = {}; for (const o of a.packeds) orig[o.id] = o; const back = [];
        for (const r of m.survivors || []) { const o = orig[r.mpOrigId != null ? r.mpOrigId : r.id]; if (!o) continue; back.push(Object.assign({}, o, r, { id: o.id })); }
        const eta = m.refused ? Math.round(MP.travel(0.3)) : MP.travel(0.8);
        carav(g, 'peer', 'me', 'mpreturn', eta, { restore: back, items: clean(m.loot), thought: 'mp_raid_home', label: 'Повернення загону' });
        const lost = (m.dead || []).length, cap = (m.captured || []).length;
        if (m.refused) sysChat('Набіг скасовано: «' + s.peerName + '» не у стані війни. Загін повертається.');
        else { (back.length ? s.stats.wins++ : s.stats.losses++); RW.UI.letter('Підсумок набігу', 'Повертаються: ' + back.length + (lost ? '. Загинули: ' + m.dead.join(', ') : '') + (cap ? '. У полоні: ' + m.captured.join(', ') : '') + (Object.keys(m.loot || {}).length ? '. Здобич: ' + listTxt(clean(m.loot)) : '. Здобичі немає') + '.', lost || cap ? 'bad' : 'good'); sysChat('Набіг завершено: ' + back.length + ' повертаються, ' + lost + ' загинули, ' + cap + ' у полоні.'); }
        MP.dirty.tab = true; break;
      }
      case 'bye': sysChat('Друг вийшов з гри.'); break;
    }
  };

  // ---------- прибуття каравана ----------
  MP.arrive = function (g, c) {
    const s = st(g); if (!s) return; const sp = g.tradeSpot;
    if (c.kind === 'mpout') return;
    if (c.kind === 'mpgoods') { send({ t: 'arrived', k: 'goods', label: c.label || 'Караван' }); dropGoods(c.items || {}); RW.UI.letter('Караван прибув', (c.label || 'Караван') + ' від «' + s.peerName + '»: ' + listTxt(c.items) + '. Лежить біля торгової точки; дозвольте колоністам його підняти.', 'good', null, { x: sp.x, y: sp.y }); return; }
    if (c.kind === 'mpreturn') { const names = restorePawns(c.restore || [], c.thought); if (c.items && Object.keys(c.items).length) dropGoods(c.items); RW.UI.letter('Вдома', (names.length ? names.join(', ') + ' повернулись додому.' : 'Загін не повернувся.') + (c.items && Object.keys(c.items).length ? ' Здобич: ' + listTxt(c.items) + '.' : ''), 'good'); return; }
    if (c.kind === 'mpvisit') {
      const p = foreign(c.packed, 'guest'); p.mpGuest = c.mid; p.title = 'Гість з «' + s.peerName + '»'; p.leaveAt = s.recall[c.mid] ? 0 : g.tick + (c.stay || DY); p.vstate = 'arrive'; p.isTrader = false; g.pawns.push(p);
      s.guests[c.mid] = { pawnId: p.id, name: nm(p), at: g.tick }; s.stats.visits++; send({ t: 'arrived', k: 'visit', name: nm(p) }); for (const o of colonists()) o.addThought('mp_guest');
      RW.UI.letter('Гість із «' + s.peerName + '»', nm(p) + ' прийшов(ла) у гості. Колонія в доброму настрої.', 'good', p); return;
    }
    if (c.kind === 'mpraid') {
      const sp2 = E().edgeSpawn(g.map, g.home); const mem = []; const refs = [];
      for (const pk of c.packed) { const p = foreign(pk, 'enemy'); p.mpRaid = c.mid; p.aiKind = 'pirate'; p.x = sp2.x + 0.5 + U.rr(-2, 2); p.y = sp2.y + 0.5 + U.rr(-2, 2); if (g.map.cost[Math.floor(p.y) * g.map.w + Math.floor(p.x)] === 0) { p.x = sp2.x + 0.5; p.y = sp2.y + 0.5; } p.look.shirt = '#3a6a9a'; g.pawns.push(p); mem.push(p.id); refs.push(p); }
      send({ t: 'arrived', k: 'raid', n: refs.length });
      g.raids.push({ id: U.nextId(), members: mem, start: g.tick, kind: 'player' }); s.inRaids.push({ id: c.mid, members: mem, start: g.tick, quiet: 0 }); MP.rp[c.mid] = refs;
      RW.UI.letter('Набіг!', 'Загін із ' + refs.length + ' бійців колонії «' + s.peerName + '» вдерся на вашу територію (' + ['півночі', 'півдня', 'заходу', 'сходу'][sp2.side] + ')!', 'bad', null, { x: sp2.x, y: sp2.y }); RW.A && RW.A.sfx('alert');
    }
  };

  // ---------- періодична обробка ----------
  function tick(g) {
    const s = st(g); if (!s) return;
    // повернення «втрачених» мандрівників (немає звʼязку / відповіді)
    for (const id of Object.keys(s.away)) { const a = s.away[id]; if (g.tick > a.deadline) { delete s.away[id]; const n = restorePawns(a.packeds, null); RW.UI.letter('Мандрівники повернулись', n.join(', ') + ' повернулись самі (звʼязку з другом немає).', 'info'); MP.dirty.tab = true; } }
    // гості в моїй колонії
    for (const mid of Object.keys(s.guests)) {
      const gu = s.guests[mid]; const p = MP.rp['g' + mid] || g.pawns.find(x => x.id === gu.pawnId) || MP.rp['g' + mid]; MP.rp['g' + mid] = p;
      if (p && !p.dead) { if (g.tick % 400 < 60) { p.needs.food = Math.max(p.needs.food, 0.7); p.needs.rest = Math.max(p.needs.rest, 0.6); } }
      if (!p) { delete s.guests[mid]; continue; }
      if (p.gone && !p.mpFin) { p.mpFin = 1; send({ t: 'visitEnd', id: mid, pawn: p.serialize() }); delete s.guests[mid]; delete MP.rp['g' + mid]; sysChat('Гість ' + gu.name + ' пішов додому.'); MP.dirty.tab = true; }
      else if (p.dead && !p.gone && !p.mpFin) { p.mpFin = 1; send({ t: 'visitDead', id: mid, cause: p.cause }); delete s.guests[mid]; delete MP.rp['g' + mid]; RW.UI.letter('Гість загинув', 'Гість ' + gu.name + ' загинув у вашій колонії. Друг буде невдоволений.', 'bad'); MP.dirty.tab = true; }
      else if (!MP.online() && !p.dead && p.leaveAt > g.tick) p.leaveAt = 0;
    }
    // набіги гравців на мене
    for (let k = s.inRaids.length - 1; k >= 0; k--) {
      const r = s.inRaids[k]; const refs = MP.rp[r.id]; if (!refs) { s.inRaids.splice(k, 1); continue; }
      let active = 0; for (const p of refs) {
        if (p.dead || p.gone || p.faction !== 'enemy') continue;
        if (p.downed) { p.downT = 0; continue; } active++;
        if (Math.hypot(p.x - g.home.x, p.y - g.home.y) < 14) p.mpClose = (p.mpClose || 0) + 20;
      }
      r.quiet = active ? 0 : (r.quiet || 0) + 1;
      if (r.quiet >= 15) finishRaid(g, s, r, refs, k);
    }
  }
  function finishRaid(g, s, r, refs, k) {
    s.inRaids.splice(k, 1); delete MP.rp[r.id]; const survivors = [], dead = [], captured = []; let thieves = 0;
    for (const p of refs) {
      if (p.faction === 'prisoner' && !p.dead) { captured.push(nm(p)); continue; }
      if (p.dead && !p.gone) { dead.push(nm(p)); continue; }
      if (p.gone || (p.downed && !p.dead)) { if ((p.mpClose || 0) >= 300) thieves++; const o = p.serialize(); o.mpOrigId = p.mpOrigId; survivors.push(o); if (!p.gone) RW.Combat.removePawn(p, 'відступив'); }
    }
    const loot = {}; let budget = thieves * 120; const stock = E().colonyStock();
    for (const d of ['silver', 'gold', 'components', 'crystal', 'steel', 'medicine', 'meal_fine', 'wood']) { if (budget <= 0) break; const v = (D.items[d] && D.items[d].value) || 1; const have = stock[d] || 0; const n = Math.min(have, Math.floor(budget / v)); if (n > 0) { loot[d] = n; budget -= n * v; } }
    if (Object.keys(loot).length) takeItems(loot);
    if (!survivors.length) s.stats.wins++; else if (thieves) s.stats.losses++;
    send({ t: 'raidResult', id: r.id, survivors, dead, captured, loot, eta: MP.travel(0.8) });
    RW.UI.letter(thieves ? 'Набіг відбито, але…' : 'Набіг відбито', 'Загін «' + s.peerName + '»: загинуло ' + dead.length + ', відступило ' + survivors.length + (captured.length ? ', у полоні ' + captured.length : '') + (Object.keys(loot).length ? '. Вони забрали: ' + listTxt(loot) : '. Здобичі в них немає') + '.', thieves && Object.keys(loot).length ? 'bad' : 'good');
    sysChat('Набіг завершено. Загиблих нападників: ' + dead.length + ', втікачів: ' + survivors.length + '.');
  }
  const lt = RW.Life.tick;
  RW.Life.tick = function (g) { lt(g); if (st(g) && g.tick % 20 === 5) { try { tick(g); } catch (e) { console.error(e); } } };

  // ---------- статус, знімок колонії для візитерів ----------
  function sendStatus() {
    const g = G(), s = st(g); if (!g || !s || !MP.online()) return; const cs = colonists(); const mood = cs.length ? Math.round(cs.reduce((a, p) => a + (p.mood || 0), 0) / cs.length) : 0;
    send({ t: 'status', i: { pop: cs.length, day: D.relDay(g.tick) + 1, wealth: g.wealth ? g.wealth.total : 0, mood, away: Object.keys(s.away).length, threat: (g.threat || 0) > 0, closed: !!s.closed, rel: s.rel, armed: cs.filter(p => p.equip.weapon).length } });
  }
  function sendSnap() {
    const g = G(); if (!g || !g.map || !MP.online()) return; const m = g.map; let str = '';
    for (let i = 0; i < m.n; i++) {
      let c = '1'; const t = m.terrain[i];
      if (t <= 1) c = '0'; else if (m.blk[i]) c = m.blk[i] > 1 ? '3' : '2';
      else { const b = m.bld[i]; if (b) c = b.def.wall ? '4' : (b.def.door ? '5' : '6'); else if (m.floor[i]) c = '7'; else { const pl = m.plant[i]; if (pl) c = D.plants[pl.def].tree ? '8' : '9'; } }
      str += c;
    }
    const ps = []; for (const p of g.pawns) { if (p.dead) continue; ps.push([+p.x.toFixed(1), +p.y.toFixed(1), p.faction === 'colony' ? 0 : p.faction === 'enemy' ? 1 : p.mpGuest != null ? 2 : 3]); }
    send({ t: 'snap', w: m.w, h: m.h, c: str, p: ps, name: st(g).myName, day: D.relDay(g.tick) + 1 });
  }
  setInterval(() => { if (!MP.active()) return; sendStatus(); }, 4000);
  setInterval(() => { if (MP.active() && MP.peek && MP.online()) sendSnap(); }, 2500);

  // ---------- зʼєднання ----------
  Net.on((k, m) => {
    if (k === 'msg') { if (MP.active() && RW.Game.running) MP.onMsg(m); else if (MP.lobbyMsg) MP.lobbyMsg(m); }
    else if (k === 'close') {
      if (MP.active() && RW.Game.running) { const s = st(G()); MP.snap = null; MP.peek = false; RW.UI.toast('🌐 Зʼєднання з другом втрачено', 'bad'); sysChat('Зʼєднання втрачено. Гості та рейдери друга зникнуть, ваші мандрівники повернуться самі.');
        for (const k2 of Object.keys(s.guests)) { const p = G().pawns.find(x => x.id === s.guests[k2].pawnId); if (p) p.leaveAt = 0; }
        for (const r of s.inRaids) for (const p of (MP.rp[r.id] || [])) if (!p.dead) p.fleeing = true; MP.dirty.card = true; }
      else if (MP.lobbyClose) MP.lobbyClose();
    } else if (k === 'open') { if (MP.active() && RW.Game.running) { sysChat('Зʼєднання встановлено.'); sendStatus(); send({ t: 'peek', on: true }); MP.dirty.card = true; } else if (MP.lobbyOpen) MP.lobbyOpen(); }
  });
  window.addEventListener('beforeunload', () => { try { Net.send({ t: 'bye' }); } catch (e) { } });

  // ================= Інтерфейс =================
  const FAC_ICO = { 0: '#7ad07a', 1: '#e0584a', 2: '#6ad0e8', 3: '#d8c860' };
  const SNAPCOL = ['#27527f', '#4f7a3a', '#5e5a56', '#8a7a4a', '#8a6a4a', '#a8885a', '#c4a060', '#9a8a6a', '#2f5e2a', '#6aa840'];
  function drawSnap() {
    const cv = document.getElementById('mp-cv'); if (!cv) return; const x = cv.getContext('2d'); const sn = MP.snap;
    x.fillStyle = '#0c1118'; x.fillRect(0, 0, cv.width, cv.height);
    if (!sn) { x.fillStyle = '#7a8694'; x.font = '12px sans-serif'; x.textAlign = 'center'; x.fillText('Очікуємо знімок колонії друга…', cv.width / 2, cv.height / 2 - 6); x.fillText('(мінікарта з’явиться за мить)', cv.width / 2, cv.height / 2 + 12); return; }
    const s = Math.min(cv.width / sn.w, cv.height / sn.h); const ox = (cv.width - sn.w * s) / 2, oy = (cv.height - sn.h * s) / 2;
    for (let i = 0; i < sn.c.length; i++) { const ch = +sn.c[i]; x.fillStyle = SNAPCOL[ch]; x.fillRect(ox + (i % sn.w) * s, oy + ((i / sn.w) | 0) * s, s + 0.6, s + 0.6); }
    for (const p of sn.p) { const px = ox + p[0] * s, py = oy + p[1] * s; x.fillStyle = FAC_ICO[p[2]] || '#fff'; x.beginPath(); x.arc(px, py, p[2] === 2 ? 3.4 : 2.2, 0, 6.3); x.fill(); if (p[2] === 2) { x.strokeStyle = '#fff'; x.lineWidth = 1; x.stroke(); } }
    x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(0, 0, cv.width, 16); x.fillStyle = '#e8eef2'; x.font = '11px sans-serif'; x.textAlign = 'left'; x.fillText('👁 ' + sn.name + ' · день ' + sn.day, 6, 12);
  }
  const SHELL = `<div id="mp-root" class="mpr"><div class="mp-top"><div id="mp-card" class="mp-card"></div><canvas id="mp-cv" width="230" height="230"></canvas></div>
    <div class="mp-main"><div class="mp-tabs"><button data-t="overview">🌐 Огляд</button><button data-t="trade">🤝 Торгівля</button><button data-t="visit">🚶 Візити</button><button data-t="war">⚔ Війна</button></div><div id="mp-tab" class="mp-tab"></div></div>
    <div class="mp-chat"><div id="mp-log" class="mp-log"></div><div class="mp-in"><input id="mp-in" type="text" maxlength="300" placeholder="Повідомлення другу…  (Enter)"><button class="btn xs" data-e="👋">👋</button><button class="btn xs" data-e="🤝">🤝</button><button class="btn xs" data-e="🕊">🕊</button><button class="btn xs" data-e="⚔">⚔</button><button class="btn xs" data-e="🍺">🍺</button><button class="btn" id="mp-send">Надіслати</button></div></div></div>`;
  function cardHtml() {
    const g = G(), s = st(g); const i = s.peerInfo; const on = MP.online(); const war = s.rel === 'war';
    let h = `<div class="mp-h"><b>${esc(s.peerName)}</b><span class="mp-pill ${on ? 'ok' : 'bad'}">${on ? '● на зв\'язку' + (Net.ping ? ' · ' + Net.ping + ' мс' : '') : '○ офлайн'}</span></div>`;
    h += `<div class="mp-rel ${war ? 'war' : 'peace'}">${war ? '⚔ ВІЙНА' : '🕊 Мир'}</div>`;
    if (!on) h += '<div class="btnrow"><button class="btn xs" data-rc="host">🔌 Підключитись (створити код)</button><button class="btn xs" data-rc="join">🔗 Ввести код друга</button></div>';
    if (i) h += `<div class="mp-stats"><span>👥 ${i.pop}</span><span>📅 день ${i.day}</span><span>💰 ${i.wealth}</span><span>😊 ${i.mood}%</span><span>🗡 ${i.armed}/${i.pop}</span>${i.threat ? '<span class="neg">⚠ під загрозою</span>' : ''}${i.closed ? '<span>🚫 кордони закриті</span>' : ''}</div>`; else h += '<div class="sub">Чекаємо на дані…</div>';
    h += `<div class="sub">Відстань: ${MP.hours(MP.travel())} год дороги</div>`;
    if (RW.Spec) h += `<div class="btnrow"><button class="btn xs" data-spec="go" ${on ? '' : 'disabled'}>👁 Дивитись світ друга</button></div><label class="mp-allow"><input type="checkbox" id="mp-allow" ${RW.Spec.allow ? 'checked' : ''}> Друг може дивитись мою колонію</label>${RW.Spec.providing ? '<div class="sub">👁 Друг дивиться вашу колонію зараз</div>' : ''}`;
    return h;
  }
  function tabHtml() {
    const g = G(), s = st(g); const t = MP.tab; const war = s.rel === 'war';
    if (t === 'overview') {
      const stt = s.stats; return `<div class="mp-ov"><p>Ви — сусіди на одній планеті. Кожен будує свою колонію; між вами можна торгувати караванами, ходити в гості й, якщо захочете, воювати.</p>
        <table class="tbl2"><tr><td>🤝 Угод укладено</td><td><b>${stt.trades}</b></td></tr><tr><td>🚶 Візитів</td><td><b>${stt.visits}</b></td></tr><tr><td>⚔ Ваших набігів / на вас</td><td><b>${stt.raidsOut} / ${stt.raidsIn}</b></td></tr><tr><td>🏆 Відбито / програно</td><td><b>${stt.wins} / ${stt.losses}</b></td></tr></table>
        <label class="srow"><input type="checkbox" id="mp-closed" ${s.closed ? 'checked' : ''}> 🚫 Закрити кордони (не приймати гостей і торгові пропозиції)</label>
        <p class="sub">Клавіша <b>N</b> відкриває це вікно. Ігри йдуть окремо: кожен грає у своєму темпі, а пауза вам не заважає.</p></div>`;
    }
    if (t === 'trade') {
      if (war) return '<div class="plwarn">⚔ Під час війни торгівля закрита.</div>';
      const stock = E().colonyStock(); const have = Object.keys(stock).filter(k => D.items[k] && D.items[k].cat !== 'corpse').sort((a, b) => (D.items[b].value || 0) * stock[b] - (D.items[a].value || 0) * stock[a]);
      const wantList = Object.keys(D.items).filter(k => ['resource', 'currency', 'medicine', 'weapon', 'apparel', 'meal', 'rawfood', 'herb'].includes(D.items[k].cat) || k === 'crystal');
      let h = '';
      if (s.offers.length) { h += '<h4>📨 Пропозиції вам</h4>'; for (const o of s.offers) h += `<div class="mp-offer"><div><b>${esc(s.peerName)}</b> віддає <b>${esc(listTxt(o.give))}</b><br>просить <b>${esc(listTxt(o.want))}</b> <small class="sub">(${val(o.give)} ◎ ↔ ${val(o.want)} ◎)</small></div><div><button class="btn xs" data-a="acc" data-id="${o.id}">✔ Прийняти</button><button class="btn xs" data-a="dec" data-id="${o.id}">✖ Відхилити</button></div></div>`; }
      const outs = Object.values(s.out); if (outs.length) h += '<h4>📤 Очікують відповіді</h4>' + outs.map(o => `<div class="mp-offer"><div>Віддали: ${esc(listTxt(o.give))} → хочемо ${esc(listTxt(o.want))}</div></div>`).join('');
      h += '<h4>Нова пропозиція</h4><div class="mp-cols"><div><b>Ви віддаєте</b><div class="mp-list">' + (have.length ? have.map(k => `<label class="mp-row"><span>${esc(itName(k))} <small class="sub">(${stock[k]})</small></span><input type="number" min="0" max="${stock[k]}" value="0" data-g="${k}"></label>`).join('') : '<span class="sub">Склад порожній</span>') + '</div></div><div><b>Ви просите</b><div class="mp-list">' + wantList.map(k => `<label class="mp-row"><span>${esc(itName(k))}</span><input type="number" min="0" max="5000" value="0" data-w="${k}"></label>`).join('') + '</div></div></div>';
      h += '<div class="mp-sum" id="mp-sum">Вартість: ви 0 ◎ · вони 0 ◎</div><div class="btnrow"><button class="btn big" data-a="offer">📦 Надіслати пропозицію</button></div><p class="sub">Порожня колонка «просите» = подарунок. Товар зникає зі складу одразу, а в друга зʼявляється біля торгової точки через ~' + MP.hours(MP.travel()) + ' год. Лише незаборонені речі.</p>';
      return h;
    }
    if (t === 'visit') {
      if (war) return '<div class="plwarn">⚔ Під час війни візити закриті.</div>';
      const cs = colonists(); let h = '<h4>Відправити колоніста в гості</h4><label class="srow">Гостює <select id="mp-stay"><option value="1">1 добу</option><option value="2">2 доби</option><option value="3">3 доби</option></select></label><div class="mp-list tall">';
      for (const p of cs) h += `<div class="mp-row"><span>${esc(U.fullName(p))} <small class="sub">${p.equip.weapon ? '🗡 ' + esc(itName(p.equip.weapon)) : 'без зброї'}</small></span><button class="btn xs" data-a="visit" data-id="${p.id}" ${MP.canVisit(p) && cs.length > 1 ? '' : 'disabled'}>🚶 Відправити</button></div>`;
      h += '</div>';
      const aw = Object.entries(s.away).filter(([, a]) => a.kind === 'visit'); if (aw.length) h += '<h4>Ваші в гостях</h4>' + aw.map(([id, a]) => `<div class="mp-row"><span>🚶 ${esc(a.name)}</span><button class="btn xs" data-a="recall" data-id="${id}">↩ Повернути</button></div>`).join('');
      const gu = Object.entries(s.guests); if (gu.length) h += '<h4>Гості у вас</h4>' + gu.map(([id, a]) => `<div class="mp-row"><span>🌐 ${esc(a.name)}</span><button class="btn xs" data-a="home" data-id="${id}">Відпровадити</button></div>`).join('');
      h += '<p class="sub">Гість стоїть біля торгової точки; у друга +4 до настрою всієї колонії, у гостя +6 після повернення. Поки гість там, ви бачите колонію друга на карті зліва.</p>'; return h;
    }
    if (t === 'war') {
      let h = `<div class="mp-rel big ${war ? 'war' : 'peace'}">${war ? '⚔ ВІЙНА' : '🕊 Мир'}</div>`;
      if (!war) h += '<p>Війна закриває торгівлю й візити та дозволяє набіги. Перша доба — перемир\'я для підготовки. Мир має підтвердити обидві сторони.</p><div class="btnrow"><button class="btn big" data-a="war">⚔ Оголосити війну</button></div>' + (g.tick < s.warLock ? '<p class="sub">Після миру війну можна оголосити через ' + Math.ceil((s.warLock - g.tick) / DY) + ' д.</p>' : '');
      else {
        if (s.peaceReq) h += '<div class="mp-offer"><div><b>' + esc(s.peerName) + '</b> пропонує мир.</div><div><button class="btn xs" data-a="peaceok">✔ Прийняти</button><button class="btn xs" data-a="peaceno">✖ Відхилити</button></div></div>';
        else h += '<div class="btnrow"><button class="btn" data-a="peace">🕊 Запропонувати мир</button></div>';
        const why = MP.canRaid(); h += '<h4>Набіг</h4><p class="sub">Оберіть бійців (до ' + MP.raidMax() + '). Хтось має залишитись вдома. Без зброї колоніст б\'ється кулаками, а зброя помре разом із власником. Перемога — якщо відіб\'єтесь; здобич забирають лише ті, хто дійшов до колонії.</p><div class="mp-list tall">';
        for (const p of colonists()) h += `<label class="mp-row"><span><input type="checkbox" data-r="${p.id}" ${p.noViolence || p.downed ? 'disabled' : ''}> ${esc(U.fullName(p))} <small class="sub">${p.equip.weapon ? '🗡 ' + esc(itName(p.equip.weapon)) : '✊ без зброї'} · ⚔${p.skills.melee ? p.skills.melee.lvl : 0}/🎯${p.skills.shooting ? p.skills.shooting.lvl : 0}</small></span></label>`;
        h += `</div><div class="btnrow"><button class="btn big" data-a="raid" ${why ? 'disabled' : ''}>⚔ Відправити набіг</button></div>${why ? '<p class="sub">' + esc(why) + '</p>' : ''}`;
        const rw = Object.entries(s.away).filter(([, a]) => a.kind === 'raid'); if (rw.length) h += '<h4>Набіг триває</h4>' + rw.map(([id, a]) => `<div class="mp-row"><span>⚔ ${esc(a.name)}</span></div>`).join('');
      }
      return h;
    }
    return '';
  }
  function logHtml() { return MP.chat.slice(-60).map(c => { const tm = new Date(c.t).toTimeString().slice(0, 5); return `<div class="mp-l ${c.w}"><small>${tm}</small> ${c.w === 'sys' ? '<i>' + esc(c.text) + '</i>' : '<b>' + esc(c.w === 'me' ? myName() : peerName()) + ':</b> ' + esc(c.text)}</div>`; }).join(''); }
  function sumUpdate() { const el = document.getElementById('mp-sum'); if (!el) return; let a = 0, b = 0; document.querySelectorAll('#mp-tab [data-g]').forEach(i => { a += (+i.value || 0) * (D.items[i.dataset.g].value || 0); }); document.querySelectorAll('#mp-tab [data-w]').forEach(i => { b += (+i.value || 0) * (D.items[i.dataset.w].value || 0); }); el.textContent = 'Вартість: ви ' + Math.round(a) + ' ◎ · вони ' + Math.round(b) + ' ◎'; el.className = 'mp-sum' + (b > a * 1.4 && b > 30 ? ' bad' : ''); }
  function readList(sel, attr) { const o = {}; document.querySelectorAll(sel).forEach(i => { const n = Math.floor(+i.value || 0); if (n > 0) o[i.dataset[attr]] = n; }); return o; }
  function onTabClick(e) {
    const a = e.target.closest('[data-a]'); if (!a) return; const id = a.dataset.id; let err = null;
    switch (a.dataset.a) {
      case 'acc': MP.accept(id); break; case 'dec': MP.decline(id); break;
      case 'offer': err = MP.sendOffer(readList('#mp-tab [data-g]', 'g'), readList('#mp-tab [data-w]', 'w')); break;
      case 'visit': err = MP.sendVisit(+id, (document.getElementById('mp-stay') || {}).value); break;
      case 'recall': MP.recall(id); break; case 'home': MP.sendHome(id); break;
      case 'war': err = MP.declareWar(); break; case 'peace': err = MP.proposePeace(); break; case 'peaceok': MP.answerPeace(true); break; case 'peaceno': MP.answerPeace(false); break;
      case 'raid': { const ids = []; document.querySelectorAll('#mp-tab [data-r]').forEach(i => { if (i.checked) ids.push(+i.dataset.r); }); err = MP.sendRaid(ids); break; }
    }
    if (err) RW.UI.toast(err, 'bad'); MP.dirty.tab = true;
  }
  function build(root) {
    root.dataset.i = '1';
    root.querySelectorAll('.mp-tabs button').forEach(b => b.onclick = () => { MP.tab = b.dataset.t; MP.dirty.tab = true; });
    root.querySelector('#mp-card').onchange = e => { if (e.target.id === 'mp-allow') RW.Spec.setAllow(e.target.checked); };
    root.querySelector('#mp-card').onclick = e => { if (e.target.closest('[data-spec]')) { RW.UI.closeWin('mp'); RW.Spec.start(); return; } const b = e.target.closest('[data-rc]'); if (b) { RW.UI.closeWin('mp'); RW.MP.reconnect && RW.MP.reconnect(b.dataset.rc === 'host'); } };
    const tab = root.querySelector('#mp-tab'); tab.onclick = onTabClick; tab.oninput = e => { if (e.target.matches('[data-g],[data-w]')) sumUpdate(); }; tab.onchange = e => { if (e.target.id === 'mp-closed') { st(G()).closed = e.target.checked; sysChat(e.target.checked ? 'Кордони закрито.' : 'Кордони відкрито.'); } };
    const inp = root.querySelector('#mp-in'); const go = () => { MP.say(inp.value); inp.value = ''; }; inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') go(); }; inp.onkeyup = e => e.stopPropagation(); root.querySelector('#mp-send').onclick = go;
    root.querySelectorAll('[data-e]').forEach(b => b.onclick = () => MP.say(b.dataset.e));
  }
  MP.refresh = function () {
    const root = document.getElementById('mp-root'); const g = G(); if (!root || !g || !st(g)) return;
    if (!root.dataset.i) build(root);
    if (MP.dirty.card) { MP.dirty.card = false; root.querySelector('#mp-card').innerHTML = cardHtml(); }
    if (MP.dirty.tab) { MP.dirty.tab = false; root.querySelectorAll('.mp-tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === MP.tab)); const keep = document.activeElement && document.activeElement.closest && document.activeElement.closest('#mp-tab'); root.querySelector('#mp-tab').innerHTML = tabHtml(); if (MP.tab === 'trade') sumUpdate(); }
    if (MP.dirty.log) { MP.dirty.log = false; const l = root.querySelector('#mp-log'); l.innerHTML = logHtml(); l.scrollTop = l.scrollHeight; }
    drawSnap(); MP.unread = 0;
  };
  // HUD
  function hud() {
    const root = document.getElementById('ui'); if (!root) return; let el = document.getElementById('mphud');
    const g = G(); if (!g || !st(g) || !RW.Game.running) { if (el) el.style.display = 'none'; return; }
    if (!el) { el = document.createElement('div'); el.id = 'mphud'; el.onclick = () => RW.UI.toggleWin('mp'); }
    if (!el.isConnected) root.appendChild(el); const s = st(g); const on = MP.online(); const war = s.rel === 'war';
    const badge = (s.offers.length ? ' <i class="b">📨' + s.offers.length + '</i>' : '') + (s.peaceReq ? ' <i class="b">🕊</i>' : '') + (MP.unread ? ' <i class="b">💬' + MP.unread + '</i>' : '') + (s.inRaids.length ? ' <i class="b r">⚔</i>' : '') + (s.guests && Object.keys(s.guests).length ? ' <i class="b">🌐' + Object.keys(s.guests).length + '</i>' : '');
    el.style.display = ''; el.className = (on ? 'on' : 'off') + (war ? ' war' : ''); el.title = 'Мультиплеєр [N]';
    const html = '🌐 ' + esc(s.peerName) + ' · ' + (war ? '⚔ війна' : '🕊 мир') + ' · ' + (on ? '●' : '○ офлайн') + badge; if (el.dataset.h !== html) { el.dataset.h = html; el.innerHTML = html; }
  }
  setInterval(() => { try { hud(); if (MP.isOpen()) MP.refresh(); } catch (e) { console.error(e); } }, 400);
  (function install() {
    const UI = RW.UI; UI.addWin('mp', { title: '🌐 Мультиплеєр', fn: () => SHELL, cls: 'win-wide win-mp' });
    UI.TABS.splice(UI.TABS.length - 1, 0, { id: 'mp', label: '🌐', key: 'N' }); UI.keyWins.KeyN = 'mp';
  })();
  const gs0 = RW.Game.start; RW.Game.start = function (cfg) { gs0.apply(this, arguments); if (cfg && cfg.mp) MP.init(RW.G, cfg.mp); };
  const ow = RW.UI.openWin; RW.UI.openWin = function (id) { if (id === 'mp' && !MP.active()) { RW.UI.toast('Мультиплеєр не активний. Почніть гру через «Мультиплеєр» у головному меню.', 'info'); return; } return ow.apply(this, arguments); };
})();
