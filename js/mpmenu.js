'use strict';
// ============================================================
//  mpmenu.js — меню мультиплеєра: підключення кодами, лобі, старт
// ============================================================
(function () {
  const D = RW.D, U = RW.U, M = RW.Menu, A = M.A, Net = RW.Net, $ = M.$, esc = M.esc, show = M.show;
  M.mp = null;

  const copyText = id => { const el = $(id); if (!el) return false; el.focus(); el.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) { } if (!ok && navigator.clipboard) { navigator.clipboard.writeText(el.value).then(() => RW.UI && 0).catch(() => { }); ok = true; } return ok; };
  const colDef = () => U.pick(['Орравекс', 'Нова Надія', 'Зоряна Пристань', 'Тиха Гавань', 'Залізний Брід', 'Сонячний Кут', 'Вогнище', 'Ковчег']);
  const status = (t, cls) => { const e = $('mp-st'); if (e) { e.textContent = t; e.className = 'mp-status ' + (cls || ''); } };
  const ang = (a, b) => Math.acos(U.clamp(Math.sin(a.lat) * Math.sin(b.lat) + Math.cos(a.lat) * Math.cos(b.lat) * Math.cos(b.lon - a.lon), -1, 1));

  // ---------- головний екран ----------
  A.mpHome = () => {
    M.mp = null; M.mpAwaiting = null; Net.reset();
    show(`<h2>🌐 Мультиплеєр</h2>
      <div class="mp-intro"><p>Два гравці, одна планета. У вас однаковий сценарій, але <b>кожен створює власних колоністів, назву колонії й будує свою базу</b>. Колонії — сусіди на карті світу: можна <b>ходити в гості</b>, <b>торгувати караванами</b> і навіть <b>воювати</b>.</p>
      <p class="sub">Зʼєднання peer-to-peer без сервера: ви обмінюєтесь двома короткими кодами (через месенджер). У локальній мережі працює відразу; через інтернет — зазвичай теж (використовується STUN). Якщо не вдається — спробуйте Radmin VPN / ZeroTier / Tailscale.</p></div>
      ${Net.supported() ? '' : '<div class="plwarn">Цей браузер не підтримує WebRTC.</div>'}
      <div class="mlist mp-home"><button class="btn big" data-m="mpHost"><i>🏠</i>Створити кімнату (хост)</button><button class="btn big" data-m="mpJoin"><i>🔗</i>Приєднатись до друга</button></div>
      <div class="btnrow"><button class="btn" data-m="toMain">← Меню</button></div>`, 'menu-mp');
  };

  // ---------- хост ----------
  A.mpHost = () => {
    M.mpRe = !!(RW.G && RW.Game.running && RW.MP.active() && M.fromGame && M.mpReFlag);
    show(`<h2>🏠 Створити кімнату</h2><div class="mp-form">
      ${M.mpRe ? '' : `<label class="srow">🏠 Назва вашої колонії<input type="text" id="mp-col" maxlength="28" value="${esc(colDef())}"></label>
      <label class="srow">📍 Де буде колонія друга?<select id="mp-mode"><option value="near">Сусіди — поруч із вами</option><option value="far">Далеко — будь-де на планеті</option></select></label>`}
      <div class="btnrow"><button class="btn big" data-m="mpMakeOffer">🔑 Створити код запрошення</button></div>
      <div id="mp-step2" class="hidden"><h4>Крок 1. Надішліть цей код другу</h4><textarea id="mp-off" class="mp-code" readonly rows="4"></textarea><div class="btnrow"><button class="btn" data-m="mpCopyOff">📋 Копіювати</button></div>
      <h4>Крок 2. Вставте код-відповідь від друга</h4><textarea id="mp-ans" class="mp-code" rows="4" placeholder="RW1.…"></textarea><div class="btnrow"><button class="btn big" data-m="mpConnect">🔌 Підключити</button></div></div>
      <div id="mp-st" class="mp-status"></div></div>
      <div class="btnrow"><button class="btn" data-m="${M.mpRe ? 'mpCancelRe' : 'mpHome'}">← Назад</button></div>`, 'menu-mp');
  };
  A.mpMakeOffer = async () => {
    if (!M.mpRe) { M.mp = mkMp({ role: 'host', mode: $('mp-mode').value, colony: ($('mp-col').value.trim() || colDef()).slice(0, 28) }); }
    status('Створюємо код… (до 6 секунд)'); try { const code = await Net.host(); $('mp-off').value = code; $('mp-step2').classList.remove('hidden'); status('Код готовий. Надішліть його другу й чекайте відповідь.', 'ok'); M.mpAwaiting = M.mpRe ? 'reconnect' : 'host'; } catch (e) { status('Помилка: ' + e.message, 'bad'); }
  };
  A.mpCopyOff = () => { status(copyText('mp-off') ? 'Скопійовано!' : 'Виділіть код і натисніть Ctrl+C', 'ok'); };
  A.mpConnect = async () => { try { status('Підключаємось…'); await Net.accept($('mp-ans').value); status('Чекаємо зʼєднання…'); } catch (e) { status('Помилка: ' + e.message, 'bad'); } };
  A.mpCancelRe = () => { Net.reset(); M.mpAwaiting = null; M.hide(); M.fromGame = false; };

  // ---------- гість ----------
  A.mpJoin = () => {
    M.mpRe = !!(RW.G && RW.Game.running && RW.MP.active() && M.fromGame && M.mpReFlag);
    show(`<h2>🔗 Приєднатись</h2><div class="mp-form">
      ${M.mpRe ? '' : `<label class="srow">🏠 Назва вашої колонії<input type="text" id="mp-col" maxlength="28" value="${esc(colDef())}"></label>`}
      <h4>Крок 1. Вставте код запрошення від хоста</h4><textarea id="mp-off" class="mp-code" rows="4" placeholder="RW1.…"></textarea><div class="btnrow"><button class="btn big" data-m="mpMakeAnswer">🔑 Створити відповідь</button></div>
      <div id="mp-step2" class="hidden"><h4>Крок 2. Надішліть цей код-відповідь хосту</h4><textarea id="mp-ans" class="mp-code" readonly rows="4"></textarea><div class="btnrow"><button class="btn" data-m="mpCopyAns">📋 Копіювати</button></div></div>
      <div id="mp-st" class="mp-status"></div></div>
      <div class="btnrow"><button class="btn" data-m="${M.mpRe ? 'mpCancelRe' : 'mpHome'}">← Назад</button></div>`, 'menu-mp');
  };
  A.mpMakeAnswer = async () => {
    if (!M.mpRe) { M.mp = mkMp({ role: 'guest', colony: ($('mp-col').value.trim() || colDef()).slice(0, 28) }); }
    status('Створюємо відповідь… (до 6 секунд)'); try { const code = await Net.join($('mp-off').value); $('mp-ans').value = code; $('mp-step2').classList.remove('hidden'); status('Надішліть відповідь хосту. Підключення відбудеться автоматично.', 'ok'); M.mpAwaiting = M.mpRe ? 'reconnect' : 'guest'; } catch (e) { status('Помилка: ' + e.message, 'bad'); }
  };
  A.mpCopyAns = () => { status(copyText('mp-ans') ? 'Скопійовано!' : 'Виділіть код і натисніть Ctrl+C', 'ok'); };

  // ---------- події зʼєднання ----------
  Net.on((k, m) => {
    if (k === 'open' && M.mpAwaiting) {
      const what = M.mpAwaiting; M.mpAwaiting = null; RW.A.sfx && RW.A.sfx('good');
      if (what === 'reconnect') { M.hide(); M.fromGame = false; M.mpReFlag = false; RW.UI.toast('🌐 Зʼєднано!', 'good'); return; }
      if (what === 'host') {
        show(`<h2>✅ Друга підключено!</h2><p>Тепер оберіть сценарій, оповідача, планету й місце посадки — друг чекає і потім обере свою колонію й колоністів за вашим вибором.</p><div class="btnrow"><button class="btn big" data-m="mpHostGo">Далі →</button></div>`, 'menu-mp');
        setTimeout(() => { if (M.mp && M.mp.role === 'host' && M.screen === 'x') A.mpHostGo(); }, 1400);
      } else {
        show(`<h2>✅ Підключено до хоста!</h2><div class="mp-wait"><div class="spin"></div><p>Хост обирає сценарій і планету…</p><p class="sub">Потім ви оберете місце посадки (за режимом «сусіди» — поруч із хостом), створите колоністів і назву колонії.</p></div>`, 'menu-mp');
      }
    } else if (k === 'close' && M.mp && !RW.Game.running) {
      show(`<h2 class="neg">Зʼєднання розірвано</h2><p>Друг вийшов або зʼєднання втрачено.</p><div class="btnrow"><button class="btn big" data-m="mpHome">← Мультиплеєр</button></div>`, 'menu-mp'); M.mp = null; M.mpAwaiting = null;
    } else if (k === 'msg') lobbyMsg(m);
  });
  A.mpHostGo = () => { if (!M.mp || M.mp.role !== 'host') return; M.cfg = M.newCfg(); M.step1(); };

  // ---------- лобі ----------
  const origStep4 = A.step4;
  A.step4 = function () {
    const had = M.cfg && M.cfg.loc; origStep4.apply(this, arguments);
    if (M.mp && M.mp.role === 'host' && had && !M.mp.lobbySent) { M.mp.lobbySent = true; sendLobby(); } else if (M.mp && M.mp.role === 'host' && had) sendLobby();
  };
  const origStep2 = A.step2; A.step2 = function () { if (M.mp && M.mp.role === 'guest') return M.step3(); return origStep2.apply(this, arguments); };
  function sendLobby() {
    const c = M.cfg; Net.send({ t: 'lobby', scenario: c.scenario, difficulty: c.difficulty, storyteller: c.storyteller, planetSeed: c.planetSeed, hostLoc: { lat: c.loc.lat, lon: c.loc.lon }, hostBiome: c.biome, mode: M.mp.mode, hostColony: M.mp.colony });
  }
  function lobbyMsg(m) {
    if (!M.mp) return;
    if (m.t === 'lobby' && M.mp.role === 'guest') {
      const c = M.cfg = M.newCfg(); c.scenario = m.scenario; c.difficulty = m.difficulty; c.storyteller = m.storyteller; c.planetSeed = m.planetSeed; c.loc = null;
      Object.assign(M.mp, { mode: m.mode, hostLoc: m.hostLoc, hostColony: m.hostColony, hostBiome: m.hostBiome });
      M.step3();
      setTimeout(() => {
        const pl = M.planet(); const h = m.hostLoc; for (let k = 0; k < 500; k++) { const r = m.mode === 'near' ? 0.12 + Math.random() * 0.22 : 0.4 + Math.random() * 1.8, a = Math.random() * 6.283; const lat = U.clamp(h.lat + Math.cos(a) * r, -1.2, 1.2), lon = h.lon + Math.sin(a) * r / Math.max(0.35, Math.cos(lat)); const s = RW.Planet.sample(pl, lat, lon); if (!s.ocean && ang(h, { lat, lon }) > 0.07) { M.selectLoc(lat, lon); break; } }
      }, 120);
    } else if (m.t === 'ready' && M.mp.role === 'host') { M.mp.peerReady = m; if (M.mp.myReady) doGo(); }
    else if (m.t === 'go' && M.mp.role === 'guest') startGame({ role: 'guest', myName: M.mp.colony, peerName: m.hostColony, worldSeed: m.worldSeed, worldBiome: m.worldBiome, pos: { me: m.guestPos, peer: m.hostPos }, mode: M.mp.mode, sid: m.sid });
  }
  const mkMp = o => {
    o.checkLoc = (lat, lon) => {
      if (o.role !== 'guest' || !o.hostLoc) return null; const d = ang(o.hostLoc, { lat, lon });
      if (d < 0.07) return '🚫 Надто близько до колонії хоста — відступіть трохи.';
      if (o.mode === 'near' && d > 0.55) return '🚫 У режимі «Сусіди» оберіть місце поближче до синьої мітки хоста.';
      return null;
    };
    o.begin = () => {
      const c = M.cfg; o.myReady = { colony: o.colony, loc: { lat: c.loc.lat, lon: c.loc.lon }, biome: c.biome };
      Net.send({ t: 'ready', colony: o.colony, loc: o.myReady.loc, biome: c.biome });
      show(`<h2>⏳ Очікуємо друга…</h2><div class="mp-wait"><div class="spin"></div><p>Ви готові. Щойно друг завершить налаштування, обидві колонії висадяться.</p></div>`, 'menu-mp');
      if (o.role === 'host' && o.peerReady) doGo();
    };
    return o;
  };

  function computePos(h, g, mode) {
    const d = ang(h, g); const dl = Math.atan2(Math.sin(g.lon - h.lon), Math.cos(g.lon - h.lon)); const bearing = Math.atan2(dl * Math.cos((h.lat + g.lat) / 2), g.lat - h.lat);
    const md = U.clamp(0.17 + d * 0.8, 0.17, 0.52);
    const vx = Math.sin(bearing) * md * 0.95, vy = -Math.cos(bearing) * md * 0.72;
    const cl = (v, a, b) => Math.min(b, Math.max(a, v));
    return { host: [cl(0.5 - vx / 2, 0.12, 0.88), cl(0.5 - vy / 2, 0.15, 0.85)], guest: [cl(0.5 + vx / 2, 0.12, 0.88), cl(0.5 + vy / 2, 0.15, 0.85)] };
  }
  function doGo() {
    const mp = M.mp; if (!mp || mp.sentGo) return; mp.sentGo = true; const pr = mp.peerReady; const c = M.cfg;
    const pos = computePos({ lat: c.loc.lat, lon: c.loc.lon }, pr.loc, mp.mode); const sid = Date.now() + '_' + Math.floor(Math.random() * 1e6);
    Net.send({ t: 'go', worldSeed: c.planetSeed, worldBiome: c.biome, hostPos: pos.host, guestPos: pos.guest, hostColony: mp.colony, guestColony: pr.colony, sid });
    startGame({ role: 'host', myName: mp.colony, peerName: pr.colony, worldSeed: c.planetSeed, worldBiome: c.biome, pos: { me: pos.host, peer: pos.guest }, mode: mp.mode, sid });
  }
  function startGame(mpCfg) {
    const cfg = M.startCfg(); cfg.mp = mpCfg; M.mp = null; M.hide(); M.fromGame = false; RW.A.init(); RW.Game.start(cfg);
  }

  // маркер хоста на глобусі (для гостя)
  M.mpDraw = function (x, gst, GS, gT) {
    const mp = M.mp; if (!mp || mp.role !== 'guest' || !mp.hostLoc) return; const pr = RW.Planet.project(gst, GS, mp.hostLoc.lat, mp.hostLoc.lon); if (!pr.vis) return;
    const t = (gT % 1800) / 1800; x.strokeStyle = 'rgba(110,200,255,' + (1 - t) + ')'; x.lineWidth = 2; x.beginPath(); x.arc(pr.x, pr.y, 5 + t * 18, 0, 6.3); x.stroke();
    x.fillStyle = '#5ab4ff'; x.beginPath(); x.arc(pr.x, pr.y, 5, 0, 6.3); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 1.5; x.stroke();
    x.font = 'bold 12px sans-serif'; x.textAlign = 'center'; x.fillStyle = 'rgba(0,0,0,.7)'; x.fillText('Колонія «' + mp.hostColony + '»', pr.x + 1, pr.y - 11); x.fillStyle = '#bfe4ff'; x.fillText('Колонія «' + mp.hostColony + '»', pr.x, pr.y - 12);
  };

  // повторне підключення з гри
  RW.MP.reconnect = function (hostMode) { M.mpReFlag = true; M.fromGame = true; M.mpAwaiting = null; hostMode ? A.mpHost() : A.mpJoin(); };
})();
