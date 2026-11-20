'use strict';
// ============================================================
//  menu.js — головне меню, новий світ, творець колоністів, налаштування
// ============================================================
(function () {
  const D = RW.D, U = RW.U, GFX = RW.GFX;
  const M = RW.Menu = {};
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let bg, bctx, bgT = 0, bgRaf = 0, stars = [], streaks = [];
  M.cfg = null; M.screen = 'main'; M.ci = 0; M.fromGame = false;

  const newCfg = () => ({ scenario: 'crash', difficulty: 'normal', storyteller: 'orest', seed: (Math.random() * 1e9) | 0, planetSeed: (Math.random() * 1e9) | 0, loc: null, tempBias: 0, biome: 'temperate', size: 'medium', mountain: 0.5, water: 0.45, trees: 0.6, colonists: [] });
  const A = {}; M.A = A;

  M.init = function () {
    bg = $('menubg'); bctx = bg.getContext('2d'); resizeBg(); window.addEventListener('resize', resizeBg);
    for (let i = 0; i < 160; i++) stars.push({ x: Math.random(), y: Math.random() * 0.75, r: Math.random() * 1.4 + 0.3, tw: Math.random() * 6 });
    $('menu').addEventListener('click', e => { const t = e.target.closest('[data-m]'); if (!t) return; RW.A.init(); RW.A.sfx('click'); if (A[t.dataset.m]) A[t.dataset.m](t, e); });
    $('menu').addEventListener('change', e => { const t = e.target.closest('[data-mc]'); if (t && A[t.dataset.mc]) A[t.dataset.mc](t, e); });
    $('menu').addEventListener('input', e => { const t = e.target.closest('[data-mi]'); if (t && A[t.dataset.mi]) A[t.dataset.mi](t, e); });
    M.showMain(); bgLoop();
  };
  function resizeBg() { bg.width = innerWidth; bg.height = innerHeight; }
  function bgLoop() {
    bgRaf = requestAnimationFrame(bgLoop); if ($('menu').classList.contains('hidden')) return;
    bgT++; RW.MenuFX.draw(bctx, bg.width, bg.height, bgT, stars);
  }
  M.hide = function () { $('menu').classList.add('hidden'); };
  function show(html, cls) { M.screen = 'x'; const m = $('menu'); m.classList.remove('hidden'); $('menubox').className = 'panel ' + (cls || ''); $('menubox').innerHTML = html; $('menu').classList.toggle('overlay', M.fromGame); const mb = $('menubox'); mb.classList.remove('mbin'); void mb.offsetWidth; mb.classList.add('mbin'); if (RW.MenuFX && !M.fromGame) RW.MenuFX.kick(); }
  const back = (to, label) => `<button class="btn" data-m="${to}">${label || '← Назад'}</button>`;

  // ------------------------- Головне меню -------------------------
  M.showMain = function () {
    M.fromGame = false; RW.Game.running = false; $('ui').classList.add('hidden'); M.screen = 'main';
    const hasSave = RW.Save.list().length > 0;
    const V = RW.VER; const word = (w, off) => w.split('').map((ch, k) => '<span class="lt" style="--i:' + (k + off) + '">' + ch + '</span>').join('');
    show(`<div class="logo"><div class="emblem"><svg viewBox="0 0 120 120" width="96" height="96"><defs><linearGradient id="eg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0b8"/><stop offset="1" stop-color="#c8801c"/></linearGradient><radialGradient id="pg" cx=".35" cy=".3"><stop offset="0" stop-color="#ffd8a0"/><stop offset=".6" stop-color="#b06030"/><stop offset="1" stop-color="#3a1c14"/></radialGradient></defs><circle class="e-ring r1" cx="60" cy="60" r="54" fill="none" stroke="url(#eg)" stroke-width="2" stroke-dasharray="3 7"/><circle class="e-ring r2" cx="60" cy="60" r="44" fill="none" stroke="url(#eg)" stroke-width="1.4" opacity=".7"/><circle cx="60" cy="60" r="26" fill="url(#pg)"/><ellipse class="e-orbit" cx="60" cy="60" rx="46" ry="14" fill="none" stroke="#ffe7a8" stroke-width="2.4" transform="rotate(-24 60 60)"/><circle class="e-moon" cx="60" cy="60" r="4.5" fill="#fff"/><path d="M60 24 L64 36 L76 36 L66 44 L70 56 L60 49 L50 56 L54 44 L44 36 L56 36Z" fill="url(#eg)" opacity=".9" transform="translate(0 -6) scale(1 .8)"/></svg></div>
      <div class="logo1"><span class="lw">${word('ORRAVEX', 0)}</span></div><div class="logo1 logo1b"><span class="lw">${word('WORLD', 8)}</span></div><div class="logo2">Симулятор виживання на краю галактики</div></div><div class="mlist">
      <button class="btn big mb-i" style="--d:0" data-m="newGame"><i>🌍</i>Нова колонія</button>
      <button class="btn big mb-i" style="--d:1" data-m="loadMenu" ${hasSave ? '' : 'title="Збережень ще немає"'}><i>💾</i>Завантажити</button>
      <button class="btn big mb-i" style="--d:1" data-m="mpHome"><i>🌐</i>Мультиплеєр</button>
      <button class="btn big mb-i" style="--d:2" data-m="settings"><i>⚙</i>Налаштування</button>
      <button class="btn big mb-i" style="--d:3" data-m="help"><i>📖</i>Як грати</button>
      <button class="btn big mb-i" style="--d:4" data-m="versions"><i>🧬</i>Версії та новини</button>
      <button class="btn big mb-i" style="--d:5" data-m="quitGame"><i>⏻</i>Вийти з гри</button></div><div class="ver"><b>${V.name}</b> · v${V.num} ${V.stage} «${V.codename}» · HTML5 Canvas · усі текстури й звуки створюються програмно</div>`, 'menu-main');
  };
  A.versions = () => show(`<h2>🧬 Версії та новини</h2><div class="scroll vlog" style="max-height:62vh">${RW.VER.log.map((e, k) => `<div class="vrow ${k === 0 ? 'cur' : ''}" style="--d:${k}"><div class="vh"><span class="vnum">v${e.v}</span><b>${esc(e.t)}</b><span class="sub">${e.d}</span>${k === 0 ? '<span class="vbadge">поточна</span>' : ''}</div><ul>${e.items.map(x => '<li>' + esc(x) + '</li>').join('')}</ul></div>`).join('')}</div><div class="btnrow">${back('back')}</div>`, 'menu-wide');
  A.back = () => M.fromGame ? M.showPause() : M.showMain();
  A.toMain = () => { if (M.mp) { M.mp = null; RW.Net && RW.Net.close(); } if (M.fromGame && !confirm('Вийти в головне меню? Незбережений прогрес буде втрачено.')) return; M.showMain(); };
  A.help = () => show(`<h2>📖 Як грати</h2><div class="scroll" style="max-height:60vh">${helpText()}</div><div class="btnrow">${back('back')}</div>`, 'menu-wide');
  const helpText = () => `<p><b>Мета:</b> виживіть, збудуйте колонію, дослідіть «Міжзоряний політ» та збудуйте двигун корабля.</p><p><b>Камера:</b> WASD або стрілки, колесо — масштаб, середня кнопка — перетягнути. <b>Час:</b> Пробіл — пауза, 1–4 — швидкість.</p><p><b>Керування:</b> клік — вибір, R — призвати колоніста, ПКМ — наказ. Архітектор (B): накази, зони, будівлі. Вікна: O — Робота, T — Дослідження, H — Розклад, C — Колонія, J — Журнал.</p><p><b>Порада:</b> спершу заготуйте деревину й камінь, створіть склад і ліжка, сад із рису, стіл дослідження та плиту. Готуйтесь до рейдів: стіни, двері, укриття, зброя.</p>`;

  // ------------------------- Пауза -------------------------
  M.showPause = function () {
    M.fromGame = true; RW.G.speedBefore = RW.G.speed; RW.G.speed = 0; RW.Game.paused = true;
    show(`<h2>⏸ Пауза</h2><div class="mlist"><button class="btn big" data-m="resume">▶ Продовжити</button><button class="btn big" data-m="saveMenu">💾 Зберегти гру</button><button class="btn big" data-m="loadMenu">📂 Завантажити</button><button class="btn big" data-m="settings">⚙ Налаштування</button><button class="btn big" data-m="exportSave">📤 Експорт у файл</button><button class="btn big" data-m="toMain">🏠 Головне меню</button><button class="btn big" data-m="quitGame">⏻ Вийти з гри</button></div>`);
  };
  // Вихід: закриває вікно (у лаунчері — повертає до нього); у звичайному браузері вкладку можна закрити лише вручну
  A.showMain = () => M.showMain();
  A.quitGame = () => {
    if (!confirm('Вийти з гри?' + (M.fromGame ? ' Незбережений прогрес буде втрачено.' : ''))) return;
    try { RW.UIExt && RW.UIExt.release(); if (document.fullscreenElement) document.exitFullscreen(); } catch (e) { }
    try { RW.Net && RW.Net.close && RW.Net.close(); } catch (e) { }
    window.close();
    setTimeout(() => { show('<h2>До зустрічі!</h2><p style="text-align:center">Гру зупинено. Тепер можна закрити цю вкладку (Ctrl+W).</p><div class="btnrow"><button class="btn" data-m="showMain">Повернутися в меню</button></div>'); }, 250);
  };
  A.resume = () => { M.hide(); M.fromGame = false; RW.Game.paused = false; RW.G.speed = RW.G.speedBefore || 1; };
  A.exportSave = () => RW.Save.exportFile();
  A.saveMenu = () => {
    let h = '<h2>Зберегти гру</h2><div class="slots">'; const list = RW.Save.list();
    for (let i = 1; i <= 7; i++) { const s = list.find(x => x.slot === i); h += `<div class="slot"><div class="si">${s ? slotInfo(s) : '<i>Порожній слот ' + i + '</i>'}</div><button class="btn" data-m="saveTo" data-s="${i}">${s ? 'Перезаписати' : 'Зберегти'}</button></div>`; }
    show(h + `</div><div class="btnrow">${back('back')}</div>`, 'menu-wide');
  };
  A.saveTo = el => { if (RW.Save.write(+el.dataset.s)) { A.saveMenu(); RW.UI.toast('Збережено', 'good'); } };
  const slotInfo = s => s.meta ? `<b>${s.slot === 'auto' ? 'Автозбереження' : 'Слот ' + s.slot}</b> · день ${s.meta.day} · колоністів ${s.meta.colonists} · ${esc(s.meta.scenario)} · ${esc(s.meta.diff)}<br><small>${new Date(s.time).toLocaleString('uk-UA')}</small>` : 'Слот ' + s.slot;
  A.loadMenu = () => {
    const list = RW.Save.list(); let h = '<h2>Завантажити гру</h2><div class="slots">';
    if (!list.length) h += '<p>Збережень немає.</p>';
    for (const s of list) h += `<div class="slot"><div class="si">${slotInfo(s)}</div><button class="btn" data-m="loadSlot" data-s="${s.slot}">Завантажити</button><button class="btn" data-m="delSlot" data-s="${s.slot}">✕</button></div>`;
    h += `</div><div class="btnrow"><label class="btn">Імпорт з файлу<input type="file" id="impf" accept=".rwsave,.json" style="display:none" data-mc="importFile"></label>${back('back')}</div>`;
    show(h, 'menu-wide');
  };
  A.importFile = el => { const f = el.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { if (RW.Save.importText(r.result)) { M.hide(); } }; r.readAsText(f); };
  A.loadSlot = el => { const s = el.dataset.s; if (RW.Save.loadSlot(s === 'auto' ? 'auto' : +s)) { M.hide(); M.fromGame = false; RW.Game.paused = false; } };
  A.delSlot = el => { if (confirm('Видалити збереження?')) { RW.Save.remove(el.dataset.s === 'auto' ? 'auto' : +el.dataset.s); A.loadMenu(); } };

  // ------------------------- Налаштування -------------------------
  A.settings = () => M.showSettings(M.fromGame);
  M.showSettings = function (fromGame) {
    const S = RW.S; const sl = (id, label, v, mi) => `<label class="srow">${label}<input type="range" min="0" max="1" step="0.05" value="${v}" data-mi="${mi}"><b>${Math.round(v * 100)}%</b></label>`;
    const ck = (label, v, mc) => `<label class="srow"><input type="checkbox" data-mc="${mc}" ${v ? 'checked' : ''}> ${label}</label>`;
    if (fromGame) { M.fromGame = true; $('menu').classList.remove('hidden'); }
    show(`<h2>⚙ Налаштування</h2><div class="grid2"><div><h4>🔊 Звук</h4>${sl('m', 'Загальна гучність', S.audio.master, 'vMaster')}${sl('mu', 'Музика', S.audio.music, 'vMusic')}${sl('s', 'Ефекти та амбієнт', S.audio.sfx, 'vSfx')}</div>
      <div><h4>🖼 Графіка</h4>${ck('Динамічне освітлення і тіні', S.gfx.lighting, 'gLight')}${ck('Показувати FPS', S.gfx.fps, 'gFps')}<label class="srow">Якість зображення<select data-mc="gRes"><option value="1" ${S.gfx.res === 1 ? 'selected' : ''}>Висока</option><option value="0.75" ${S.gfx.res === 0.75 ? 'selected' : ''}>Середня</option><option value="0.5" ${S.gfx.res === 0.5 ? 'selected' : ''}>Низька (швидше)</option></select></label>
      <h4>🎮 Геймплей</h4>${ck('Пауза при поганих подіях', S.game.pauseOnLetter, 'gPause')}${ck('Прокрутка біля краю екрана', S.game.edgeScroll, 'gEdge')}${ck('Автозбереження кожні 2 хв', S.game.autosave, 'gAuto')}</div></div><div class="btnrow">${back('back')}</div>`, 'menu-wide');
  };
  const upd = () => { RW.saveSettings(); RW.A.apply(); };
  A.vMaster = el => { RW.S.audio.master = +el.value; el.nextElementSibling.textContent = Math.round(el.value * 100) + '%'; upd(); };
  A.vMusic = el => { RW.S.audio.music = +el.value; el.nextElementSibling.textContent = Math.round(el.value * 100) + '%'; upd(); if (el.value > 0) { RW.A.init(); RW.A.startMusic(); } };
  A.vSfx = el => { RW.S.audio.sfx = +el.value; el.nextElementSibling.textContent = Math.round(el.value * 100) + '%'; upd(); RW.A.sfx('ui'); };
  A.gLight = el => { RW.S.gfx.lighting = el.checked; upd(); }; A.gFps = el => { RW.S.gfx.fps = el.checked; upd(); };
  A.gRes = el => { RW.S.gfx.res = +el.value; upd(); RW.R.resize(); };
  A.gPause = el => { RW.S.game.pauseOnLetter = el.checked; upd(); }; A.gEdge = el => { RW.S.game.edgeScroll = el.checked; upd(); }; A.gAuto = el => { RW.S.game.autosave = el.checked; upd(); };

  // ------------------------- Новий світ -------------------------
  A.newGame = () => { M.cfg = newCfg(); M.step1(); };
  M.step1 = function () {
    const c = M.cfg; M.screen = 'scen';
    const diffI = { crash: '🚀', tribe: '🔥', rich: '💎', naked: '🍃' };
    show(`<div class="steps"><b>1. Сценарій</b> › 2. Оповідач › 3. Планета › 4. Колоністи</div><h2>Оберіть початок історії</h2><div class="scencards">${D.scenarios.map(s => `<div class="scard ${c.scenario === s.id ? 'on' : ''}" data-m="pickScen" data-id="${s.id}"><canvas class="scimg" width="400" height="230" data-sid="${s.id}"></canvas><div class="scbody"><h3>${esc(s.name)}</h3><p>${esc(s.desc)}</p><div class="sctags"><span>👥 ${s.count}</span><span>${s.tribal ? '🏹 Примітивні технології' : '⚙ Сучасні технології'}</span>${s.pet ? '<span>' + (s.pet === 'dog' ? '🐕' : '🐈') + ' Улюбленець</span>' : ''}</div></div></div>`).join('')}</div><div class="btnrow">${back('toMain', '← Меню')}<button class="btn big" data-m="step2">Далі →</button></div>`, 'menu-wide');
    setTimeout(() => { document.querySelectorAll('canvas.scimg').forEach(cv => RW.Scenes.draw(cv, cv.dataset.sid)); }, 10);
  };
  A.pickScen = el => { M.cfg.scenario = el.dataset.id; el.parentElement.querySelectorAll('[data-m="pickScen"]').forEach(c => c.classList.toggle('on', c === el)); };
  A.step2 = () => M.step2();
  M.step2 = function () {
    const c = M.cfg;
    show(`<div class="steps">1. Сценарій › <b>2. Оповідач і складність</b> › 3. Планета › 4. Колоністи</div><h4>Оповідач — це «режисер» подій вашої колонії</h4><div class="stcards">${D.storytellers.map(s => `<div class="stcard ${c.storyteller === s.id ? 'on' : ''}" data-m="pickStory" data-id="${s.id}"><canvas class="stport" width="160" height="210" data-sid="${s.id}"></canvas><h3>${esc(s.name)}</h3><div class="sttitle">${esc(s.title)}</div><p class="stq">${esc(s.quote)}</p><p>${esc(s.desc)}</p><div>${s.tags.map(t => `<span class="chip">${esc(t)}</span>`).join('')}</div></div>`).join('')}</div>
      <h4>⚔ Складність</h4><div class="diffrow">${D.difficulties.map(s => `<div class="card ${c.difficulty === s.id ? 'on' : ''}" data-m="pickDiff" data-id="${s.id}"><h3>${esc(s.name)}</h3><p>${esc(s.desc)}</p></div>`).join('')}</div><div class="btnrow"><button class="btn" data-m="step1">← Назад</button><button class="btn big" data-m="step3">Далі →</button></div>`, 'menu-wide');
    setTimeout(() => { document.querySelectorAll('canvas.stport').forEach(cv => RW.Portraits.draw(cv, cv.dataset.sid)); }, 10);
  };
  A.pickStory = el => { M.cfg.storyteller = el.dataset.id; el.parentElement.querySelectorAll('[data-m="pickStory"]').forEach(c => c.classList.toggle('on', c === el)); }; A.pickDiff = el => { M.cfg.difficulty = el.dataset.id; el.parentElement.querySelectorAll('[data-m="pickDiff"]').forEach(c => c.classList.toggle('on', c === el)); };
  A.step3 = () => M.step3();

  // ------------------------- Планета -------------------------
  let planet = null, gview = null, gst = { yaw: 0.5, pitch: -0.25, zoom: 1, drag: null, target: null, hover: null }, gStars = [], gT = 0, gRun = false;
  const GS = 820;
  function ensurePlanet() { if (!planet || planet.seed !== M.cfg.planetSeed) { planet = RW.Planet.get(M.cfg.planetSeed); } if (!gview) gview = RW.Planet.makeView(620); if (!gStars.length) { const r = U.rng(5); for (let i = 0; i < 260; i++) gStars.push([r() * GS, r() * GS, r() * 1.5 + 0.3, r() * 6]); } }
  M.step3 = function () {
    const c = M.cfg; ensurePlanet(); M.screen = 'world';
    const sl = (label, key) => `<label class="srow">${label}<input type="range" min="0" max="1" step="0.05" value="${c[key]}" data-mi="world" data-k="${key}"><b>${Math.round(c[key] * 100)}%</b></label>`;
    show(`<div class="steps">1. Сценарій › 2. Оповідач › <b>3. Планета і місце посадки</b> › 4. Колоністи</div>
      <div class="planetwrap"><div class="pl-left"><div class="globebox"><canvas id="globe" width="${GS}" height="${GS}"></canvas></div><div class="pl-hint">Тягніть мишею — обертати, колесо миші або кнопки +/− — наближати й віддаляти. Клацніть по суші, щоб обрати місце посадки.</div><div class="btnrow"><button class="btn" data-m="zoomOut" title="Віддалити">−</button><button class="btn" data-m="zoomIn" title="Наблизити">+</button><button class="btn" data-m="zoomReset" title="Скинути масштаб">⊙</button><button class="btn" data-m="newPlanet">🪐 Нова планета</button><button class="btn" data-m="randSpot">📍 Випадкове місце</button></div></div>
      <div class="pl-right"><div id="plinfo"></div><div id="plctl"><h4>🏞 Налаштування ділянки</h4>${sl('Гори', 'mountain')}${sl('Вода', 'water')}${sl('Ліси', 'trees')}<label class="srow">Розмір карти<select data-mc="size">${D.worldSizes.map(s => `<option value="${s.id}" ${c.size === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}</select></label><canvas id="prev" width="180" height="180"></canvas></div></div></div>
      <div class="btnrow"><button class="btn" data-m="step2">← Назад</button><button class="btn big" data-m="step4">Далі →</button></div>`, 'menu-wide menu-globe');
    M.screen = 'world'; wireGlobe(); updateInfo(); if (c.loc) setTimeout(preview, 30);
    if (!gRun) { gRun = true; requestAnimationFrame(globeLoop); }
  };
  const setZoom = z => { gst.zoom = U.clamp(z, 0.55, 3.2); };
  A.zoomIn = () => setZoom((gst.zoom || 1) * 1.25); A.zoomOut = () => setZoom((gst.zoom || 1) / 1.25); A.zoomReset = () => setZoom(1);
  A.newPlanet = () => { M.cfg.planetSeed = (Math.random() * 1e9) | 0; M.cfg.loc = null; planet = null; M.step3(); };
  A.randSpot = () => { for (let k = 0; k < 400; k++) { const lat = (Math.random() - 0.5) * Math.PI * 0.8, lon = (Math.random() - 0.5) * Math.PI * 2; const s = RW.Planet.sample(planet, lat, lon); if (!s.ocean) { selectLoc(lat, lon); return; } } };
  function selectLoc(lat, lon) {
    if (M.mp && M.mp.checkLoc) { const msg = M.mp.checkLoc(lat, lon); if (msg) { const e = $('plinfo'); if (e) e.innerHTML = '<div class="plwarn">' + msg + '</div>' + infoHtml(); return; } }
    const s = RW.Planet.sample(planet, lat, lon); if (s.ocean) { const e = $('plinfo'); if (e) e.innerHTML = '<div class="plwarn">🌊 Тут океан. Капсула не витримає — оберіть сушу.</div>' + infoHtml(); return; }
    const c = M.cfg; c.loc = { lat, lon, s }; c.biome = s.biome; c.mountain = Math.round(s.mountain * 20) / 20; c.water = Math.round(s.water * 20) / 20; c.trees = Math.round(s.trees * 20) / 20; c.tempBias = s.tempBias;
    c.seed = Math.abs(U.hashStr(planet.seed + ':' + lat.toFixed(3) + ':' + lon.toFixed(3))) % 1000000000;
    gst.target = { yaw: lon, pitch: -lat };
    M.step3Partial();
  }
  M.step3Partial = function () { updateInfo(); const ctl = $('plctl'); if (ctl) { const c = M.cfg; ctl.querySelectorAll('input[data-mi=world]').forEach(inp => { inp.value = c[inp.dataset.k]; inp.nextElementSibling.textContent = Math.round(c[inp.dataset.k] * 100) + '%'; }); } setTimeout(preview, 20); };
  const fmtCoord = (v, pos, neg) => Math.abs(v * 180 / Math.PI).toFixed(1) + '° ' + (v >= 0 ? pos : neg);
  function infoHtml() {
    const c = M.cfg; const pl = planet;
    if (!c.loc) return `<div class="plhead"><h3>🪐 ${esc(pl.name)}</h3><p class="sub">Невідома планета. Сенсори показують придатну для життя атмосферу. Оберіть місце посадки на поверхні.</p></div><div class="legend"><span><i style="background:#2a7ea8"></i>Океан</span><span><i style="background:#5a8a3c"></i>Помірний ліс</span><span><i style="background:#cdaa64"></i>Степ / пустеля</span><span><i style="background:#d8e4e8"></i>Тундра й лід</span><span><i style="background:#1f6a2c"></i>Джунглі</span><span><i style="background:#807a70"></i>Гори</span></div>`;
    const s = c.loc.s; const ds = RW.Planet.describe(s); const bio = D.biomes[s.biome];
    return `<div class="plhead"><h3>📍 ${esc(ds.name)}</h3><p class="sub">${esc(pl.name)} · ${fmtCoord(c.loc.lat, 'пн.ш.', 'пд.ш.')}, ${fmtCoord(c.loc.lon, 'сх.д.', 'зх.д.')}</p><p>${esc(ds.desc)}</p></div>
      <table class="tbl2"><tr><td>🌡 Середня температура</td><td><b>${ds.avg}°C</b></td></tr><tr><td>☀ Літо / ❄ Зима</td><td>${ds.summer}° / ${ds.winter}°</td></tr><tr><td>🌧 Опади</td><td>${ds.rainLbl} (${ds.mm} мм/рік)</td></tr><tr><td>🌱 Вегетація</td><td>${ds.grow} з ${D.YEAR_DAYS} днів</td></tr><tr><td>🌾 Родючість ґрунту</td><td>${ds.fert}%</td></tr><tr><td>⛰ Рельєф</td><td>${ds.relief}</td></tr><tr><td>💧 Вода</td><td>${ds.water}</td></tr><tr><td>🐾 Фауна</td><td>${esc(ds.fauna)}</td></tr><tr><td>⚠ Небезпека звірів</td><td>${ds.danger}</td></tr></table>`;
  }
  function updateInfo() { const e = $('plinfo'); if (e) e.innerHTML = infoHtml(); }
  function wireGlobe() {
    const cv = $('globe'); if (!cv) return; const rect = () => cv.getBoundingClientRect();
    const pos = e => { const r = rect(); return [(e.clientX - r.left) * cv.width / r.width - (cv.width - GS) / 2, (e.clientY - r.top) * GS / r.height]; };
    cv.onmousedown = e => { const [x, y] = pos(e); gst.drag = { x, y, yaw: gst.yaw, pitch: gst.pitch, moved: 0 }; gst.target = null; };
    window.onmousemove = e => {
      if (!$('globe')) return; const [x, y] = pos(e);
      if (gst.drag) { const d = gst.drag; d.moved = Math.max(d.moved, Math.hypot(x - d.x, y - d.y)); gst.yaw = d.yaw - (x - d.x) * 0.0075; gst.pitch = U.clamp(d.pitch - (y - d.y) * 0.0075, -1.25, 1.25); }
      const p = RW.Planet.pick(gst, GS, x, y); gst.hover = p ? { lat: p[0], lon: p[1], x, y } : null; cv.style.cursor = gst.drag ? 'grabbing' : (p ? 'pointer' : 'default');
    };
    window.onmouseup = e => { const d = gst.drag; gst.drag = null; if (d && d.moved < 5 && $('globe')) { const [x, y] = pos(e); const p = RW.Planet.pick(gst, GS, x, y); if (p) { RW.A.sfx('ui'); selectLoc(p[0], p[1]); } } };
    cv.onmouseleave = () => { gst.hover = null; };
    cv.onwheel = e => { e.preventDefault(); setZoom((gst.zoom || 1) * (e.deltaY < 0 ? 1.12 : 1 / 1.12)); };
    cv.ondblclick = e => { e.preventDefault(); };
  }
  function globeLoop(now) {
    const cv = $('globe'); if (M.screen !== 'world' || !cv) { gRun = false; return; }
    requestAnimationFrame(globeLoop); gT = now;
    { const rc = cv.getBoundingClientRect(); const ar = Math.max(0.85, Math.min(2.6, rc.width / Math.max(1, rc.height))); const wn = Math.round(GS * ar); if (cv.width !== wn) cv.width = wn; }
    const CW = cv.width, OX = (CW - GS) / 2;
    if (gst.target) { let dy = gst.target.yaw - gst.yaw; while (dy > Math.PI) dy -= 6.2832; while (dy < -Math.PI) dy += 6.2832; gst.yaw += dy * 0.08; gst.pitch += (gst.target.pitch - gst.pitch) * 0.08; if (Math.abs(dy) < 0.002) gst.target = null; }
    else if (!gst.drag && !M.cfg.loc) gst.yaw += 0.0016;
    const x = cv.getContext('2d');
    // космос
    x.fillStyle = '#02040a'; x.fillRect(0, 0, CW, GS);
    const neb = x.createRadialGradient(CW * 0.2, GS * 0.8, 10, CW * 0.2, GS * 0.8, GS * 0.7); neb.addColorStop(0, 'rgba(90,40,120,0.28)'); neb.addColorStop(1, 'rgba(90,40,120,0)'); x.fillStyle = neb; x.fillRect(0, 0, CW, GS);
    const neb2 = x.createRadialGradient(CW * 0.85, GS * 0.75, 10, CW * 0.85, GS * 0.75, GS * 0.5); neb2.addColorStop(0, 'rgba(30,90,140,0.22)'); neb2.addColorStop(1, 'rgba(30,90,140,0)'); x.fillStyle = neb2; x.fillRect(0, 0, CW, GS);
    for (const s of gStars) { x.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(gT * 0.001 + s[3])); x.fillStyle = '#fff'; x.fillRect(s[0] / GS * CW, s[1], s[2], s[2]); } x.globalAlpha = 1;
    const sun = x.createRadialGradient(GS * 0.04, GS * 0.04, 2, GS * 0.04, GS * 0.04, GS * 0.5); sun.addColorStop(0, 'rgba(255,240,200,0.9)'); sun.addColorStop(0.1, 'rgba(255,210,140,0.35)'); sun.addColorStop(1, 'rgba(255,200,120,0)'); x.fillStyle = sun; x.fillRect(0, 0, CW, GS);
    x.save(); x.translate(OX, 0);
    { const k = M.gScale || (M.gScale = 1); const wide = (gst.zoom || 1) > 1.12; if (wide) { gview.W = Math.max(240, Math.round(Math.min(620, Math.floor(Math.sqrt(520000 * GS / CW))) * k)); gview.WX = Math.round(gview.W * CW / GS); } else { gview.W = Math.max(240, Math.round(620 * k)); gview.WX = gview.W; } }
    // самонастройка: глобус рахується на процесорі — тримаємо ≈12 мс на кадр, щоб не гальмувати
    const tR = performance.now(); x.imageSmoothingEnabled = true;
    RW.Planet.render(gview, planet, gst, gT); { const ms = performance.now() - tR; M.gMs = M.gMs ? M.gMs * 0.8 + ms * 0.2 : ms; if (M.gMs > 14 && M.gScale > 0.39) M.gScale = Math.max(0.38, M.gScale * 0.93); else if (M.gMs < 6 && M.gScale < 1) M.gScale = Math.min(1, M.gScale * 1.02); }
    if (gview.WX > gview.W) x.drawImage(gview.c, -OX, 0, CW, GS); else x.drawImage(gview.c, 0, 0, GS, GS);
    // маркер
    const c = M.cfg; if (c.loc) {
      const pr = RW.Planet.project(gst, GS, c.loc.lat, c.loc.lon);
      if (pr.vis) { const t = (gT % 1400) / 1400; x.strokeStyle = 'rgba(255,224,120,' + (1 - t) + ')'; x.lineWidth = 2; x.beginPath(); x.arc(pr.x, pr.y, 6 + t * 22, 0, 6.3); x.stroke(); x.strokeStyle = '#ffe08a'; x.lineWidth = 2; x.beginPath(); x.moveTo(pr.x, pr.y); x.lineTo(pr.x, pr.y - 24); x.stroke(); x.fillStyle = '#ffd24a'; x.beginPath(); x.arc(pr.x, pr.y - 28, 6, 0, 6.3); x.fill(); x.strokeStyle = '#6a4a10'; x.stroke(); x.fillStyle = '#ff5030'; x.beginPath(); x.arc(pr.x, pr.y, 3, 0, 6.3); x.fill(); x.font = 'bold 12px sans-serif'; x.textAlign = 'center'; x.fillStyle = 'rgba(0,0,0,0.7)'; x.fillText('Місце посадки', pr.x + 1, pr.y - 41); x.fillStyle = '#ffe9a8'; x.fillText('Місце посадки', pr.x, pr.y - 42); }
    }
    if (M.mpDraw) M.mpDraw(x, gst, GS, gT);
    // підказка біля курсора
    const h = gst.hover; if (h && !gst.drag) { const s = RW.Planet.sample(planet, h.lat, h.lon); const txt = s.ocean ? 'Океан' : D.biomes[s.biome].name + ', ' + s.T + '°C'; x.font = '12px sans-serif'; const w = x.measureText(txt).width + 14; let bx = h.x + 14, by = h.y + 14; if (bx + w > GS + OX) bx = h.x - w - 8; x.fillStyle = 'rgba(8,10,14,0.88)'; x.fillRect(bx, by, w, 22); x.strokeStyle = s.ocean ? '#3a6a9a' : '#e0b64a'; x.strokeRect(bx + 0.5, by + 0.5, w - 1, 21); x.fillStyle = '#e8eef2'; x.textAlign = 'left'; x.fillText(txt, bx + 7, by + 15); }
    x.restore();
    // назва
    x.font = 'bold 15px sans-serif'; x.textAlign = 'left'; x.fillStyle = 'rgba(224,182,74,0.95)'; x.fillText(planet.name, 16, GS - 18);
  }
  A.size = el => { M.cfg.size = el.value; };
  A.world = el => { M.cfg[el.dataset.k] = +el.value; el.nextElementSibling.textContent = Math.round(el.value * 100) + '%'; clearTimeout(M.pt); M.pt = setTimeout(preview, 150); };
  function preview() {
    const cv = $('prev'); if (!cv) return; const c = M.cfg; const N = 60; const m = new RW.GameMap(N, N);
    GFX.initTerrain(c.biome);
    try { m.generate({ seed: c.seed, biome: c.biome, mountain: c.mountain, water: c.water, trees: c.trees }); } catch (e) { return; }
    const x = cv.getContext('2d'); const s = cv.width / N; const bio = D.biomes[c.biome];
    const col = { 0: '#2a5a9a', 1: '#4a80b8', 2: bio.ground.gravel[0], 3: bio.ground.rich[0], 4: bio.ground.soil[0], 5: bio.ground.sand[0], 6: bio.ground.snow[0], 7: '#555' };
    for (let yy = 0; yy < N; yy++) for (let xx = 0; xx < N; xx++) { const i = yy * N + xx; x.fillStyle = m.blk[i] ? ['', '#6a6a6a', '#8a7a5a', '#aab', '#d4a83a', '#9a7aff'][m.blk[i]] : col[m.terrain[i]] || '#444'; x.fillRect(xx * s, yy * s, s + 1, s + 1); const pl = m.plant[i]; if (pl && D.plants[pl.def].tree) { x.fillStyle = 'rgba(20,60,20,0.8)'; x.fillRect(xx * s + 1, yy * s + 1, s - 1.5, s - 1.5); } }
    x.strokeStyle = '#ffd070'; x.strokeRect(N / 2 * s - 6, N / 2 * s - 6, 12, 12);
  }

  // ------------------------- Творець колоністів -------------------------
  A.step4 = () => {
    if (!M.cfg.loc) { const e = $('plinfo'); if (e) e.innerHTML = '<div class="plwarn">📍 Спершу оберіть місце посадки на планеті.</div>' + infoHtml(); return; }
    const sc = D.scenarios.find(s => s.id === M.cfg.scenario);
    M.cfg.colonists = []; for (let i = 0; i < sc.count; i++) M.cfg.colonists.push(newPawn(sc, i));
    M.ci = 0; M.step4();
  };
  function newPawn(sc, i) {
    const p = RW.Pawn.generate({ faction: 'colony', tribal: sc.tribal }); p.pool = sc.points; p.base = JSON.parse(JSON.stringify(p.skills)); return p;
  }
  M.step4 = function () {
    const c = M.cfg; const p = c.colonists[M.ci]; const sc = D.scenarios.find(s => s.id === c.scenario);
    const tabs = c.colonists.map((q, i) => `<button class="tab ${i === M.ci ? 'on' : ''}" data-m="selCol" data-i="${i}">${esc(q.name.nick)}</button>`).join('');
    const opt = (arr, cur, f) => arr.map(a => `<option value="${a.id}" ${a.id === cur ? 'selected' : ''}>${f(a)}</option>`).join('');
    const sw = (arr, cur, key) => arr.map(v => `<i class="sw ${v === cur ? 'on' : ''}" style="background:${v}" data-m="look" data-k="${key}" data-v="${v}"></i>`).join('');
    const cb = D.backstories.child.find(b => b.id === p.bio.child), ab = D.backstories.adult.find(b => b.id === p.bio.adult);
    let sk = ''; for (const s of D.skills) { const o = p.skills[s]; sk += `<div class="sk"><span>${D.skillIco[s] || ''} ${D.skillNames[s]}</span><button class="btn xs" data-m="skMinus" data-s="${s}">−</button><div class="nbar"><i style="width:${o.lvl / 20 * 100}%;background:${o.pas ? '#d9a53b' : '#7a8a9a'}"></i></div><b>${o.lvl}</b><button class="btn xs" data-m="skPlus" data-s="${s}">+</button><button class="btn xs ${o.pas ? 'on' : ''}" data-m="pas" data-s="${s}" title="Пристрасть: швидший розвиток навички і бонус настрою">${['○', '🔥', '🔥🔥'][o.pas]}</button></div>`; }
    show(`<div class="steps">1. Сценарій › 2. Оповідач › 3. Планета › <b>4. Колоністи</b></div><div class="tabs">${tabs}<button class="btn xs" data-m="rerollAll">🎲 Усі</button></div>
      <div class="creator"><div class="cl"><canvas id="cport" width="140" height="170"></canvas><div class="btnrow"><button class="btn" data-m="reroll">🎲 Випадково</button></div></div>
      <div class="cm"><label class="srow">Ім'я<input type="text" value="${esc(p.name.first)}" data-mc="nFirst"></label><label class="srow">Позивний<input type="text" value="${esc(p.name.nick)}" data-mc="nNick"></label><label class="srow">Прізвище<input type="text" value="${esc(p.name.last)}" data-mc="nLast"></label>
      <label class="srow">Стать<select data-mc="gender"><option value="m" ${p.gender === 'm' ? 'selected' : ''}>Чоловік</option><option value="f" ${p.gender === 'f' ? 'selected' : ''}>Жінка</option></select></label><label class="srow">Вік<input type="number" min="18" max="70" value="${p.age}" data-mc="age" style="width:70px"></label>
      <div class="srow">Шкіра ${sw(D.skinTones, p.look.skin, 'skin')}</div><div class="srow">Волосся ${sw(D.hairColors, p.look.hair, 'hair')}</div><div class="srow">Одяг ${sw(D.clothColors, p.look.shirt, 'shirt')}</div>
      <label class="srow">Зачіска<select data-mc="hairStyle">${D.hairStyles.map(h => `<option value="${h.id}" ${p.look.hairStyle === h.id ? 'selected' : ''}>${h.name}</option>`).join('')}</select></label><label class="srow">Статура<select data-mc="body">${D.bodyTypes.map(h => `<option value="${h.id}" ${p.look.body === h.id ? 'selected' : ''}>${h.name}</option>`).join('')}</select></label>
      <h4>📜 Біографія</h4><label class="srow">Дитинство<select data-mc="bioChild">${opt(D.backstories.child, p.bio.child, b => esc(b.title))}</select></label><p class="sub">${esc(cb.desc)}</p><label class="srow">Доросле життя<select data-mc="bioAdult">${opt(D.backstories.adult, p.bio.adult, b => esc(b.title))}</select></label><p class="sub">${esc(ab.desc)}</p>
      ${p.disabled.length || p.noViolence ? '<p class="neg">Не вміє: ' + [].concat(p.noViolence ? ['насильство'] : [], p.disabled.map(w => (D.workTypes.find(x => x.id === w) || {}).name)).join(', ') + '</p>' : ''}</div>
      <div class="cr"><h4>🧬 Риси</h4><div>${p.traits.map(t => `<span class="chip" title="${esc(D.traitById[t].desc)}">${esc(D.traitById[t].name)} <a data-m="delTrait" data-t="${t}">✕</a></span>`).join('')}</div>${p.traits.length < 3 ? `<select data-mc="addTrait"><option value="">+ Додати рису…</option>${D.traits.filter(t => !p.traits.includes(t.id) && !p.traits.some(x => D.traitById[x].excl === t.excl)).map(t => `<option value="${t.id}">${esc(t.name)} — ${esc(t.desc)}</option>`).join('')}</select>` : ''}
      <h4>Навички <small>(очки: <b id="pool">${p.pool}</b>)</small></h4>${sk}</div></div>
      ${M.mp ? `<label class="srow">🏠 Назва вашої колонії<input type="text" maxlength="28" value="${esc(M.mp.colony)}" data-mc="colName"></label>` : ''}<div class="btnrow"><button class="btn" data-m="step3">← Назад</button><button class="btn big" data-m="begin">${M.mp ? '🌐 Готово!' : 'Висадитись!'}</button></div>`, 'menu-wide');
    setTimeout(() => { const cv = $('cport'); if (!cv) return; const x = cv.getContext('2d'); x.clearRect(0, 0, 140, 170); x.fillStyle = '#1a2230'; x.fillRect(0, 0, 140, 170); const pc = GFX.portrait(p, 128); x.drawImage(pc, 6, 10); }, 10);
  };
  const cur = () => M.cfg.colonists[M.ci];
  A.selCol = el => { M.ci = +el.dataset.i; M.step4(); };
  A.reroll = () => { const sc = D.scenarios.find(s => s.id === M.cfg.scenario); M.cfg.colonists[M.ci] = newPawn(sc, M.ci); M.step4(); };
  A.rerollAll = () => { const sc = D.scenarios.find(s => s.id === M.cfg.scenario); M.cfg.colonists = M.cfg.colonists.map((q, i) => newPawn(sc, i)); M.step4(); };
  A.look = el => { cur().look[el.dataset.k] = el.dataset.v; M.step4(); };
  A.hairStyle = el => { cur().look.hairStyle = +el.value; M.step4(); }; A.body = el => { cur().look.body = el.value; M.step4(); };
  A.nFirst = el => { cur().name.first = el.value.trim() || 'Безіменний'; }; A.nNick = el => { cur().name.nick = el.value.trim() || cur().name.first; }; A.nLast = el => { cur().name.last = el.value.trim() || '—'; };
  A.gender = el => { cur().gender = el.value; M.step4(); }; A.age = el => { cur().age = U.clamp(+el.value || 25, 18, 70); };
  function rebio(p) { p.recomputeBio(); p.rollSkills(); p.pool = D.scenarios.find(s => s.id === M.cfg.scenario).points; }
  A.bioChild = el => { const p = cur(); p.bio.child = el.value; rebio(p); M.step4(); }; A.bioAdult = el => { const p = cur(); p.bio.adult = el.value; rebio(p); M.step4(); };
  A.delTrait = el => { const p = cur(); p.traits = p.traits.filter(t => t !== el.dataset.t); M.step4(); };
  A.addTrait = el => { if (!el.value) return; const p = cur(); if (p.traits.length < 3) p.traits.push(el.value); M.step4(); };
  A.skPlus = el => { const p = cur(), s = p.skills[el.dataset.s]; if (p.pool > 0 && s.lvl < 20) { s.lvl++; p.pool--; M.step4(); } };
  A.skMinus = el => { const p = cur(), s = p.skills[el.dataset.s]; const base = p.base ? p.base[el.dataset.s].lvl : 0; if (s.lvl > 0 && s.lvl > Math.min(base, 0) && s.lvl > base - 3) { s.lvl--; p.pool++; M.step4(); } };
  A.pas = el => { const p = cur(), s = p.skills[el.dataset.s]; const n = (s.pas + 1) % 3; const cost = (n - s.pas) * 4; if (cost > 0 && p.pool < cost) return; p.pool -= cost; s.pas = n; M.step4(); };
  M.startCfg = () => { const c = M.cfg; return { planet: planet.name, planetSeed: c.planetSeed, loc: { lat: c.loc.lat, lon: c.loc.lon }, tempBias: c.tempBias, scenario: c.scenario, difficulty: c.difficulty, storyteller: c.storyteller, seed: c.seed, biome: c.biome, size: c.size, mountain: c.mountain, water: c.water, trees: c.trees, colonists: c.colonists.map(p => ({ name: p.name, gender: p.gender, age: p.age, bio: p.bio, look: p.look, traits: p.traits, skills: p.skills })) }; };
  A.begin = () => {
    const c = M.cfg; if (!c.colonists.length) return;
    if (M.mp && M.mp.begin) return M.mp.begin();
    $('menu').classList.add('hidden'); M.fromGame = false; RW.A.init();
    RW.Game.start(M.startCfg());
  };
  A.colName = el => { if (M.mp) M.mp.colony = el.value.trim().slice(0, 28) || M.mp.colony; };

  // ------------------------- Кінець гри -------------------------
  M.gameOver = function () {
    M.fromGame = true; const g = RW.G;
    show(`<h2 class="neg">Колонія загинула</h2><p>Усі колоністи мертві. Колонія протрималась ${D.relDay(g.tick) + 1} днів.</p><p>Побудовано: ${g.stats.built} · Знищено ворогів: ${g.stats.kills} · Відбито рейдів: ${g.stats.raids}</p><div class="btnrow"><button class="btn big" data-m="newGame">Нова гра</button><button class="btn big" data-m="loadMenu">Завантажити</button><button class="btn big" data-m="toMainForce">Головне меню</button></div>`);
  };
  A.toMainForce = () => M.showMain();
  M.victory = function () {
    M.fromGame = true; const g = RW.G; g.speed = 0; RW.Game.paused = true;
    show(`<h2 class="pos">Перемога!</h2><p>Двигун корабля запущено. Ваші колоністи залишають планету і прямують додому.</p><p>Тривалість: ${D.relDay(g.tick) + 1} днів · колоністів: ${g.pawns.filter(p => p.faction === 'colony').length} · рейдів відбито: ${g.stats.raids}</p><div class="btnrow"><button class="btn big" data-m="resume">Залишитись і грати далі</button><button class="btn big" data-m="toMainForce">Головне меню</button></div>`);
  };
  M.A = A; M.show = show; M.$ = $; M.esc = esc; M.newCfg = newCfg; M.gst = gst; M.planet = () => planet; M.ensurePlanet = ensurePlanet; M.selectLoc = (la, lo) => selectLoc(la, lo);
})();
