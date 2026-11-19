'use strict';
// ============================================================
//  perf.js — діагностика продуктивності
//   F3  — показати/сховати ЛИШЕ лічильник FPS
//   F4  — панель діагностики: графік кадрів, розбивка часу, лічильники, експерименти,
//         запис 30 с, профіль функцій, звіт (копіювати / зберегти файл)
//  Завантажується ПЕРШИМ після util.js, щоб відстежувати таймери всіх модулів.
// ============================================================
(function () {
  const PF = RW.Perf = { on: false, rec: null, off: {}, t0: performance.now(), frames: 0, tk: 0 };
  const now = () => performance.now();
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- мітки часу всередині кадру (дорогі лише коли PF.on) ----------
  let last = 0, marks = {};
  const emaM = {}, maxM = {}, sumM = {}, cntM = {};
  PF.s = () => { if (PF.on) last = now(); };
  PF.m = label => { if (!PF.on) return; const t = now(); marks[label] = (marks[label] || 0) + (t - last); last = t; };

  PF.mm = (label, ms) => { if (PF.on) marks[label] = (marks[label] || 0) + ms; };

  // ---------- кільцевий буфер кадрів (завжди; майже безкоштовно) ----------
  const N = 1200; const R_dt = new Float32Array(N), R_sim = new Float32Array(N), R_draw = new Float32Array(N), R_ui = new Float32Array(N), R_tk = new Uint8Array(N); let ri = 0, rn = 0;
  const spikes = []; let heapNow = 0;
  const longTasks = [];
  PF.frame = function (dt, sim, draw, ui, ticks, g) {
    PF.frames++; R_dt[ri] = dt; R_sim[ri] = sim; R_draw[ri] = draw; R_ui[ri] = ui; R_tk[ri] = ticks; ri = (ri + 1) % N; if (rn < N) rn++;
    if (dt > 45 && PF.frames > 150 && spikes.length < 60) spikes.push({ at: ((now() - PF.t0) / 1000) | 0, dt: +dt.toFixed(1), sim: +sim.toFixed(1), draw: +draw.toFixed(1), ui: +ui.toFixed(1), ticks, speed: g ? g.speed : 0, zoom: +(RW.R.cam.zoom).toFixed(2), heap: heapNow, other: +(dt - sim - draw - ui).toFixed(1) });
    if (PF.on) {
      for (const k in marks) { const v = marks[k]; emaM[k] = (emaM[k] == null ? v : emaM[k] + (v - emaM[k]) * 0.1); if (v > (maxM[k] || 0)) maxM[k] = v; }
      for (const k in emaM) if (!(k in marks)) emaM[k] *= 0.9;
      if (PF.rec) { PF.rec.n++; for (const k in marks) { sumM[k] = (sumM[k] || 0) + marks[k]; cntM[k] = (cntM[k] || 0); } PF.rec.frames.push([dt, sim, draw, ui, ticks]); }
      marks = {};
    }
  };

  // ---------- таймери (setInterval / setTimeout) ----------
  const timers = new Map();
  const origSI = window.setInterval.bind(window), origST = window.setTimeout.bind(window);
  function where() { try { const s = new Error().stack.split('\n').slice(3, 7).join(' | '); const m = s.match(/([\w\-.]+\.js:\d+)/); return m ? m[1] : s.slice(0, 60); } catch (e) { return '?'; } }
  function wrapTimer(cb, label, ms, kind) {
    if (typeof cb !== 'function') return cb;
    let r = timers.get(label); if (!r) { r = { label, kind, ms, n: 0, total: 0, max: 0 }; timers.set(label, r); }
    return function () { const t = now(); try { return cb.apply(this, arguments); } finally { const d = now() - t; r.n++; r.total += d; if (d > r.max) r.max = d; } };
  }
  window.setInterval = function (cb, ms) { const a = Array.prototype.slice.call(arguments, 2); return origSI(wrapTimer(cb, 'interval ' + ms + 'мс @ ' + where(), ms, 'i'), ms, ...a); };
  window.setTimeout = function (cb, ms) { if (typeof cb !== 'function') return origST(cb, ms); const a = Array.prototype.slice.call(arguments, 2); return origST(wrapTimer(cb, 'timeout @ ' + where(), ms, 't'), ms, ...a); };

  // ---------- довгі задачі ----------
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) { if (longTasks.length < 40) longTasks.push({ at: ((e.startTime - PF.t0) / 1000) | 0, ms: Math.round(e.duration) }); } }).observe({ entryTypes: ['longtask'] }); } catch (e) { }

  // ---------- пам'ять: розмір купи, GC, алокації ----------
  const heapS = []; let allocBytes = 0, gcDrops = 0, heapT = 0, heapPrev = 0;
  origSI(() => {
    const pm = performance.memory; if (!pm) return; const u = pm.usedJSHeapSize; heapNow = Math.round(u / 1048576); heapS.push(heapNow); if (heapS.length > 120) heapS.shift();
    if (heapPrev) { if (u >= heapPrev) allocBytes += u - heapPrev; else if (heapPrev - u > 1500000) gcDrops++; } heapPrev = u; heapT += 1;
  }, 1000);

  // ---------- профіль функцій (глибокий; тимчасово обгортає методи RW.*) ----------
  const prof = { on: false, rec: new Map(), wrapped: [], stack: [], t0: 0 };
  const SKIP = new Set(['U', 'D', 'Perf', 'S', 'G', 'VER', 'ICO', 'Net']);
  function wrapFn(obj, key, label) {
    const orig = obj[key]; if (typeof orig !== 'function' || orig.__pf) return; const d = Object.getOwnPropertyDescriptor(obj, key); if (d && (d.get || d.set || !d.writable)) return;
    let rec = prof.rec.get(label); if (!rec) { rec = { label, n: 0, total: 0, self: 0, max: 0 }; prof.rec.set(label, rec); }
    const w = function () { const t0 = now(); const st = prof.stack; st.push(0); try { return orig.apply(this, arguments); } finally { const dt = now() - t0; const ch = st.pop(); if (st.length) st[st.length - 1] += dt; rec.n++; rec.total += dt; rec.self += dt - ch; if (dt > rec.max) rec.max = dt; } };
    w.__pf = orig; try { obj[key] = w; prof.wrapped.push([obj, key, orig]); } catch (e) { }
  }
  function wrapObj(o, name, depth) {
    for (const k of Object.getOwnPropertyNames(o)) { if (k === 'constructor' || k === 'prototype' || k === 'length' || k === 'name') continue; let v; try { v = o[k]; } catch (e) { continue; } if (typeof v === 'function') { if (/^[A-Z][A-Za-z]+$/.test(k) && v.prototype && Object.getOwnPropertyNames(v.prototype).length > 1) { wrapObj(v.prototype, name + '.' + k, 0); wrapObj(v, name + '.' + k + '(static)', 0); } else wrapFn(o, k, name + '.' + k); } else if (depth > 0 && v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Map) && !(v instanceof Set) && v.constructor === Object) wrapObj(v, name + '.' + k, depth - 1); }
  }
  PF.profStart = function (sec) {
    if (prof.on) return; prof.rec.clear(); prof.stack.length = 0; prof.on = true; prof.t0 = now();
    for (const k of Object.keys(RW)) { if (SKIP.has(k)) continue; const v = RW[k]; if (typeof v === 'function') { if (v.prototype) wrapObj(v.prototype, k, 0); wrapObj(v, k + '(static)', 0); } else if (v && typeof v === 'object') wrapObj(v, k, 1); }
    PF.profInfo = 'Профіль: обгорнуто ' + prof.wrapped.length + ' функцій, ' + sec + ' с';
    PF.toast('🔬 Профіль функцій: ' + sec + ' с (гра тимчасово гальмуватиме — це нормально)');
    setTimeout(PF.profStop, sec * 1000);
  };
  PF.profStop = function () {
    if (!prof.on) return; prof.on = false; PF.profDur = (now() - prof.t0) / 1000;
    for (const [o, k, orig] of prof.wrapped) { try { o[k] = orig; } catch (e) { } } prof.wrapped.length = 0;
    PF.profRes = Array.from(prof.rec.values()).filter(r => r.n > 0).sort((a, b) => b.self - a.self).slice(0, 30);
    PF.toast('🔬 Профіль готовий — дивіться «Звіт»'); paint(true);
  };

  // ---------- експерименти: вимкнути підсистему й подивитись на FPS ----------
  const EXP = [
    ['sim', '⏸ Симуляція (лише малювання)'], ['ui', '🧩 Оновлення інтерфейсу'], ['lighting', '💡 Освітлення'], ['weather', '🌧 Погода'], ['hooks', '✨ Ефекти модулів (вода, святкування…)'],
    ['pawns', '🧍 Люди'], ['animals', '🐾 Тварини'], ['items', '📦 Предмети'], ['bld', '🏠 Будівлі і рослини'], ['fx', '💥 Частинки'], ['gcache', '🗺 Кеш землі (вимкнути й порівняти)']
  ];
  PF.exp = EXP;
  PF.setOff = (k, v) => { PF.off[k] = !!v; if (k === 'gcache' && RW.R) { RW.R.noGroundCache = !!v; } };
  PF.setRes = r => { RW.S.gfx.res = r; RW.saveSettings && RW.saveSettings(); RW.R.resize && RW.R.resize(); };

  PF.bench = function () {
    const c = document.createElement('canvas'); c.width = 1920; c.height = 1080; const x = c.getContext('2d'); const s = document.createElement('canvas'); s.width = s.height = 512; s.getContext('2d').fillStyle = '#6a8'; s.getContext('2d').fillRect(0, 0, 512, 512);
    const t = now(); for (let i = 0; i < 40; i++) { x.globalAlpha = 0.5; x.drawImage(s, i * 20, i * 10); x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(0, 0, 1920, 1080); } x.getImageData(0, 0, 1, 1); const d = now() - t;
    PF.benchMs = d; return d;
  };
  // ---------- збір відомостей ----------
  function gpuInfo() {
    try { const c = document.createElement('canvas'); const gl = c.getContext('webgl') || c.getContext('experimental-webgl'); if (!gl) return { renderer: 'WebGL недоступний (імовірно вимкнене апаратне прискорення)', soft: true }; const e = gl.getExtension('WEBGL_debug_renderer_info'); const r = e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); const v = e ? gl.getParameter(e.UNMASKED_VENDOR_WEBGL) : ''; return { renderer: r + (v ? ' / ' + v : ''), soft: /swiftshader|llvmpipe|software|basic render|microsoft basic/i.test(r) }; } catch (e) { return { renderer: '?', soft: false }; }
  }
  const gpu = gpuInfo();
  function counts() {
    const g = RW.G; if (!g || !g.map) return {}; const m = g.map; let items = 0, stacks = 0; for (const a of m.items.values()) { stacks += a.length; for (const it of a) items += it.n || 1; }
    let plants = 0, trees = 0, crops = 0; for (let i = 0; i < m.n; i++) { const p = m.plant[i]; if (p) { plants++; const d = RW.D.plants[p.def]; if (d && d.tree) trees++; else if (d && d.crop) crops++; } }
    const R = RW.R; const dbg = R.dbgInfo ? R.dbgInfo() : {};
    return Object.assign({ pawns: g.pawns.length, animals: g.animals.length, buildings: m.buildings.length, blueprints: m.blueprints.length, itemStacks: stacks, items, plants, trees, crops, fires: m.fires.size, projectiles: g.projectiles.length, zones: m.zones.length, desig: m.desig.size, raids: (g.raids || []).length, letters: g.letters.length, mapW: m.w, mapH: m.h, tick: g.tick, speed: g.speed, rooms: (m.rooms && m.rooms.length) || 0, domNodes: document.getElementsByTagName('*').length, timers: timers.size }, dbg);
  }
  function stats() {
    const n = rn; if (!n) return null; const a = []; let s = 0, ss = 0, sd = 0, su = 0, tk = 0;
    for (let i = 0; i < n; i++) { const k = (ri - 1 - i + N) % N; a.push(R_dt[k]); s += R_dt[k]; ss += R_sim[k]; sd += R_draw[k]; su += R_ui[k]; tk += R_tk[k]; }
    const so = a.slice().sort((x, y) => x - y); const q = p => so[Math.min(n - 1, Math.floor(p * n))];
    const avg = s / n; return { n, avg, fps: 1000 / avg, p50: q(0.5), p95: q(0.95), p99: q(0.99), max: so[n - 1], low1: 1000 / q(0.99), sim: ss / n, draw: sd / n, ui: su / n, other: Math.max(0, avg - ss / n - sd / n - su / n), ticks: tk / n, over33: a.filter(x => x > 33.4).length / n * 100, over50: a.filter(x => x > 50).length / n * 100 };
  }
  PF.stats = stats; PF.counts = counts;

  // ---------- висновки (евристики) ----------
  function findings() {
    const out = [], st = stats(), c = counts(), g = RW.G; if (!st) return ['Недостатньо даних.'];
    if (gpu.soft) out.push('🔴 ПРОГРАМНИЙ РЕНДЕР: відеокарта не використовується (' + gpu.renderer + '). Це майже напевно головна причина низького FPS. Перевірте, що в Windows/Electron увімкнене апаратне прискорення і драйвери відеокарти актуальні.');
    if (PF.benchMs > 250) out.push('🔴 Тест canvas дуже повільний (' + PF.benchMs.toFixed(0) + ' мс): 2D-графіка рахується на процесорі, без відеокарти.');
    if (st.fps < 30) out.push('🔴 Середній FPS ' + st.fps.toFixed(0) + ' (< 30).');
    if (st.sim > st.draw * 1.3 && st.sim > 6) out.push('🟠 Симуляція важча за малювання (' + st.sim.toFixed(1) + ' мс проти ' + st.draw.toFixed(1) + ' мс на кадр): дивіться «Профіль функцій» і розділ sim:* — вузьке місце в логіці гри (AI, події, шляхи).');
    if (st.draw > 12) out.push('🟠 Малювання займає ' + st.draw.toFixed(1) + ' мс на кадр: дивіться розбивку draw:* і спробуйте експерименти (освітлення, погода, люди, будівлі) — що дає найбільший приріст.');
    if (st.ui > 3) out.push('🟡 Оновлення інтерфейсу ' + st.ui.toFixed(1) + ' мс на кадр — багато для DOM.');
    if (st.other > 6 && st.avg > 20) out.push('🟡 ' + st.other.toFixed(1) + ' мс на кадр поза грою (браузер/відеокарта/композитор, довгі задачі). Якщо «малювання» маленьке, а FPS низький — GPU або композитинг не справляється (великий екран, високий DPI, повноекранний режим).');
    const dpr = window.devicePixelRatio || 1; const px = screen.width * screen.height * dpr * dpr; if (px > 6e6 && (RW.S.gfx.res || 1) >= 1) out.push('🟡 Дуже велика роздільна здатність (' + Math.round(screen.width * dpr) + '×' + Math.round(screen.height * dpr) + '). Спробуйте «Масштаб 75%» у панелі або в налаштуваннях графіки.');
    if (RW.R.lite) out.push('ℹ Увімкнено автоматичний «легкий режим» графіки (гра сама визнала FPS низьким).');
    if (c.pawns + c.animals > 120) out.push('🟡 Багато істот: ' + (c.pawns + c.animals) + '.');
    if (c.itemStacks > 1500) out.push('🟡 Дуже багато стосів предметів: ' + c.itemStacks + ' — це навантажує малювання і пошук.');
    if (c.trees > 4000) out.push('ℹ Дерев на карті: ' + c.trees + '.');
    if (allocBytes / Math.max(1, heapT) > 8e6) out.push('🟡 Велике сміття в пам\'яті: ~' + (allocBytes / Math.max(1, heapT) / 1048576).toFixed(1) + ' МБ/с, збирань сміття: ' + gcDrops + ' — звідси ривки.');
    const tt = Array.from(timers.values()).filter(t => t.n > 0).sort((a, b) => b.total - a.total)[0]; if (tt && tt.total / ((now() - PF.t0) / 1000) > 15) out.push('🟡 Найважчий таймер: ' + tt.label + ' — ' + (tt.total / ((now() - PF.t0) / 1000)).toFixed(0) + ' мс на секунду.');
    if (spikes.length > 8) out.push('🟡 Зафіксовано ' + spikes.length + ' стрибків кадру > 45 мс (див. «Стрибки»): якщо вони повторюються рівно раз на N секунд — це автозбереження, подія або GC.');
    if (st.over33 > 20) out.push('🟡 ' + st.over33.toFixed(0) + '% кадрів повільніші за 33 мс.');
    if (!out.length) out.push('🟢 Явних проблем не знайдено: ' + st.fps.toFixed(0) + ' FPS, симуляція ' + st.sim.toFixed(1) + ' мс, малювання ' + st.draw.toFixed(1) + ' мс.');
    return out;
  }

  // ---------- звіт ----------
  const f1 = x => (x == null || isNaN(x)) ? '-' : (+x).toFixed(1);
  PF.report = function () {
    const st = stats(), c = counts(), g = RW.G, R = RW.R; const L = [];
    L.push('# Звіт продуктивності Orravex World ' + (RW.VER ? RW.VER.num : '?'), 'Час: ' + new Date().toLocaleString('uk-UA') + ' · у грі ' + ((now() - PF.t0) / 60000).toFixed(1) + ' хв (від завантаження сторінки)', '');
    L.push('## Висновки', ...findings().map(x => '- ' + x), '');
    L.push('## Середовище', '- Браузер: ' + navigator.userAgent, '- Платформа: ' + navigator.platform + ', ядер CPU: ' + (navigator.hardwareConcurrency || '?') + ', пам\'ять пристрою: ' + (navigator.deviceMemory || '?') + ' ГБ', '- GPU: ' + gpu.renderer + (gpu.soft ? '  ⚠ ПРОГРАМНИЙ' : ''), '- Екран: ' + screen.width + '×' + screen.height + ', DPR ' + (window.devicePixelRatio || 1) + ', вікно ' + innerWidth + '×' + innerHeight + ', повний екран: ' + (!!document.fullscreenElement || !!(window.orravexNative)), '- Запущено у лаунчері (Electron): ' + (/Electron/i.test(navigator.userAgent) || !!window.orravexNative), '- Налаштування: res=' + RW.S.gfx.res + ', освітлення=' + RW.S.gfx.lighting + ', легкий режим=' + !!R.lite + ', timeScale=' + (RW.S.game.timeScale || 0.4), '');
    if (st) {
      L.push('## Кадри (останні ' + st.n + ')', '- FPS середній: ' + f1(st.fps) + ', 1% найгірших: ' + f1(st.low1), '- Час кадру, мс: середній ' + f1(st.avg) + ' · p50 ' + f1(st.p50) + ' · p95 ' + f1(st.p95) + ' · p99 ' + f1(st.p99) + ' · макс ' + f1(st.max), '- Розподіл часу кадру, мс: симуляція ' + f1(st.sim) + ' (тіків/кадр ' + f1(st.ticks) + ') · малювання ' + f1(st.draw) + ' · інтерфейс ' + f1(st.ui) + ' · решта (очікування 60 Гц/браузер/GPU) ' + f1(st.other), '- Кадрів повільніше 33 мс: ' + f1(st.over33) + '% · повільніше 50 мс: ' + f1(st.over50) + '%', '');
    }
    const keys = Object.keys(emaM).sort((a, b) => emaM[b] - emaM[a]);
    if (keys.length) { L.push('## Розбивка за розділами (мс на кадр: середнє / максимум)'); for (const k of keys) L.push('- ' + k + ': ' + emaM[k].toFixed(2) + ' / ' + (maxM[k] || 0).toFixed(1)); L.push(''); }
    if (PF.benchMs != null) L.push('## Тест canvas', '- 40 повноекранних накладань 1920×1080 з прозорістю: ' + PF.benchMs.toFixed(0) + ' мс (норма з відеокартою: < 60 мс; програмний рендер: сотні мс)', '');
    L.push('## Лічильники', '- ' + Object.entries(c).map(([k, v]) => k + '=' + v).join(', '), '');
    L.push('## Пам\'ять', '- Купа JS: ' + (heapNow || '?') + ' МБ' + (performance.memory ? ' (ліміт ' + Math.round(performance.memory.jsHeapSizeLimit / 1048576) + ' МБ)' : '') + ', алокації ≈ ' + (allocBytes / Math.max(1, heapT) / 1048576).toFixed(1) + ' МБ/с, збирань сміття: ' + gcDrops, '');
    const tm = Array.from(timers.values()).filter(t => t.n > 0).sort((a, b) => b.total - a.total).slice(0, 12); const secs = (now() - PF.t0) / 1000;
    L.push('## Таймери (setInterval/setTimeout), топ за часом', ...tm.map(t => '- ' + t.label + ': ' + t.n + ' викликів, ' + (t.total / secs).toFixed(1) + ' мс/с, макс ' + t.max.toFixed(1) + ' мс'), '');
    if (PF.profRes) { L.push('## Профіль функцій (' + f1(PF.profDur) + ' с, власний час; з уповільненням від профайлера)', ...PF.profRes.map(r => '- ' + r.label + ': власний ' + r.self.toFixed(1) + ' мс, разом ' + r.total.toFixed(1) + ' мс, ' + r.n + ' викл., макс ' + r.max.toFixed(2) + ' мс'), ''); }
    if (spikes.length) { L.push('## Стрибки кадру > 45 мс (до 40 останніх)', ...spikes.slice(-40).map(s => '- t=' + s.at + 'с: кадр ' + s.dt + ' мс (сим ' + s.sim + ', мал ' + s.draw + ', інт ' + s.ui + ', решта ' + s.other + '), тіків ' + s.ticks + ', швидкість ' + s.speed + ', zoom ' + s.zoom + ', купа ' + s.heap + ' МБ'), ''); }
    if (longTasks.length) L.push('## Довгі задачі (>50 мс)', '- ' + longTasks.map(t => t.at + 'с:' + t.ms + 'мс').join(', '), '');
    if (PF.recSummary) L.push('## Запис', PF.recSummary, '');
    const off = Object.keys(PF.off).filter(k => PF.off[k]); if (off.length) L.push('⚠ Під час збору були вимкнені підсистеми: ' + off.join(', '), '');
    return L.join('\n');
  };
  async function copyText(t) { try { await navigator.clipboard.writeText(t); return true; } catch (e) { try { const ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;left:-999px'; document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok; } catch (e2) { return false; } } }
  function download(t) { const d = new Date(), p = n => String(n).padStart(2, '0'); const name = 'orravex-perf-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + '.txt'; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([t], { type: 'text/plain;charset=utf-8' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800); return name; }

  // ---------- запис 30 с ----------
  PF.record = function (sec) {
    if (PF.rec) return; PF.on = true; for (const k in emaM) { delete emaM[k]; delete maxM[k]; } for (const k in sumM) delete sumM[k];
    PF.rec = { n: 0, frames: [], t0: now(), sec }; PF.toast('⏺ Запис ' + sec + ' с… грайте як зазвичай, можна рухати камеру');
    setTimeout(() => {
      const r = PF.rec; PF.rec = null; const fr = r.frames; if (fr.length) { const dts = fr.map(x => x[0]).sort((a, b) => a - b); const avg = dts.reduce((a, b) => a + b, 0) / dts.length; PF.recSummary = '- ' + sec + ' с, ' + fr.length + ' кадрів: середній ' + avg.toFixed(1) + ' мс (' + (1000 / avg).toFixed(0) + ' FPS), p95 ' + dts[Math.floor(dts.length * 0.95)].toFixed(1) + ' мс, p99 ' + dts[Math.floor(dts.length * 0.99)].toFixed(1) + ' мс, макс ' + dts[dts.length - 1].toFixed(1) + ' мс'; }
      PF.on = !!(panel && panel.classList.contains('open')); const t = PF.report(); copyText(t).then(ok => { PF.toast('✅ Запис завершено. Звіт ' + (ok ? 'скопійовано в буфер — вставте його в чат' : 'готовий — натисніть «Копіювати» або «Зберегти файл»')); }); lastReport = t; paint(true);
    }, sec * 1000);
  };

  // ---------- тости ----------
  PF.toast = t => { if (RW.UI && RW.UI.toast) RW.UI.toast(t, 'info'); };

  // ---------- інтерфейс ----------
  let panel = null, cv = null, lastReport = '', timerUI = 0;
  function build() {
    panel = document.createElement('div'); panel.id = 'perf-panel'; panel.className = 'perf-panel';
    panel.innerHTML = '<div class="pf-head"><b>🩺 Діагностика продуктивності</b><span class="pf-hint">F4 — закрити · F3 — лише FPS</span><button data-a="close">✕</button></div>' +
      '<div class="pf-big" id="pf-big"></div><canvas id="pf-graph" width="440" height="96"></canvas><div id="pf-legend" class="pf-legend"><i style="background:#4da3ff"></i>симуляція <i style="background:#ff9a3c"></i>малювання <i style="background:#b277ff"></i>інтерфейс <i style="background:#5a6572"></i>решта (очікування кадру/браузер/GPU) · лінії: 60 і 30 FPS</div>' +
      '<div class="pf-sec">Дії</div><div class="pf-btns"><button data-a="rec">⏺ Запис 30 с</button><button data-a="prof">🔬 Профіль функцій 10 с</button><button data-a="copy">📋 Копіювати звіт</button><button data-a="save">💾 Зберегти файл</button><button data-a="bench">⚡ Тест canvas</button><button data-a="clear">🧹 Скинути</button></div>' +
      '<div class="pf-sec">Експерименти: вимкніть частину й дивіться, як зростає FPS</div><div id="pf-exp" class="pf-exp"></div><div class="pf-btns"><span>Масштаб картинки:</span><button data-res="1">100%</button><button data-res="0.75">75%</button><button data-res="0.5">50%</button></div>' +
      '<div class="pf-sec">Розбивка кадру (мс, середнє)</div><div id="pf-marks"></div><div class="pf-sec">Лічильники</div><div id="pf-counts" class="pf-counts"></div>' +
      '<div class="pf-sec">Висновки</div><div id="pf-find"></div><div class="pf-sec">Звіт</div><textarea id="pf-text" readonly placeholder="Натисніть «Копіювати звіт» — текст з’явиться тут і піде в буфер обміну"></textarea>';
    document.body.appendChild(panel); cv = panel.querySelector('#pf-graph');
    panel.addEventListener('keydown', e => e.stopPropagation()); panel.addEventListener('keyup', e => e.stopPropagation());
    panel.onclick = async e => {
      const b = e.target.closest('button'); if (!b) return; const a = b.dataset.a;
      if (b.dataset.res) { PF.setRes(+b.dataset.res); paint(true); return; }
      if (a === 'close') PF.toggle(false);
      else if (a === 'rec') PF.record(30);
      else if (a === 'prof') PF.profStart(10);
      else if (a === 'bench') { const d = PF.bench(); PF.toast('⚡ Тест canvas: ' + d.toFixed(0) + ' мс (норма < 60 мс)'); }
      else if (a === 'clear') { spikes.length = 0; longTasks.length = 0; PF.profRes = null; PF.recSummary = ''; for (const k in emaM) { delete emaM[k]; delete maxM[k]; } timers.forEach(t => { t.n = 0; t.total = 0; t.max = 0; }); allocBytes = 0; gcDrops = 0; heapT = 0; PF.t0 = now(); PF.toast('Лічильники скинуто'); }
      else if (a === 'copy' || a === 'save') { const t = lastReport = PF.report(); panel.querySelector('#pf-text').value = t; if (a === 'copy') { const ok = await copyText(t); PF.toast(ok ? '📋 Звіт скопійовано — вставте його в чат' : 'Не вдалося скопіювати — виділіть текст нижче вручну'); } else { PF.toast('💾 Збережено файл ' + download(t)); } }
      paint(true);
    };
    panel.onchange = e => { const k = e.target.dataset && e.target.dataset.x; if (k) PF.setOff(k, e.target.checked); };
  }
  function graph() {
    const x = cv.getContext('2d'), W = cv.width, H = cv.height; x.clearRect(0, 0, W, H); x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, 0, W, H);
    const MAX = 50, n = Math.min(rn, 220), bw = W / 220; const sc = H / MAX;
    for (let i = 0; i < n; i++) { const k = (ri - n + i + N * 2) % N; const xx = W - (n - i) * bw; let y = H; const seg = (v, c) => { const h = Math.min(H, v * sc); x.fillStyle = c; x.fillRect(xx, y - h, Math.max(1, bw - 0.4), h); y -= h; }; seg(R_sim[k], '#4da3ff'); seg(R_draw[k], '#ff9a3c'); seg(R_ui[k], '#b277ff'); seg(Math.max(0, R_dt[k] - R_sim[k] - R_draw[k] - R_ui[k]), R_dt[k] > 33 ? '#e0524a' : '#5a6572'); }
    x.strokeStyle = 'rgba(120,255,140,.6)'; x.beginPath(); x.moveTo(0, H - 16.7 * sc); x.lineTo(W, H - 16.7 * sc); x.stroke(); x.strokeStyle = 'rgba(255,200,80,.6)'; x.beginPath(); x.moveTo(0, H - 33.3 * sc); x.lineTo(W, H - 33.3 * sc); x.stroke();
  }
  function paint(force) {
    if (!panel || !panel.classList.contains('open')) return; const st = stats(); const big = panel.querySelector('#pf-big');
    if (st) { const col = st.fps >= 55 ? '#7dff8a' : st.fps >= 30 ? '#ffd23f' : '#ff6a5a'; big.innerHTML = '<b style="color:' + col + '">' + st.fps.toFixed(0) + '</b> FPS <span>1% низ.: ' + st.low1.toFixed(0) + ' · кадр ' + st.avg.toFixed(1) + ' мс (p95 ' + st.p95.toFixed(0) + ', макс ' + st.max.toFixed(0) + ')</span><div class="pf-split">сим <b>' + st.sim.toFixed(1) + '</b> · мал <b>' + st.draw.toFixed(1) + '</b> · інт <b>' + st.ui.toFixed(1) + '</b> · решта <b>' + st.other.toFixed(1) + '</b> мс · тіків/кадр ' + st.ticks.toFixed(1) + '</div>'; }
    graph();
    const ex = panel.querySelector('#pf-exp'); if (force || !ex.firstChild) ex.innerHTML = EXP.map(e => '<label><input type="checkbox" data-x="' + e[0] + '" ' + (PF.off[e[0]] ? 'checked' : '') + '> ' + e[1] + '</label>').join('');
    const keys = Object.keys(emaM).sort((a, b) => emaM[b] - emaM[a]); const mx = keys.length ? emaM[keys[0]] : 1;
    panel.querySelector('#pf-marks').innerHTML = keys.length ? keys.map(k => '<div class="pf-row"><span>' + esc(k) + '</span><i><b style="width:' + Math.max(2, emaM[k] / mx * 100) + '%;background:' + (k.startsWith('sim') ? '#4da3ff' : '#ff9a3c') + '"></b></i><em>' + emaM[k].toFixed(2) + '</em></div>').join('') : '<p class="sub">Збираю…</p>';
    const c = counts(); panel.querySelector('#pf-counts').innerHTML = Object.entries(c).map(([k, v]) => '<span><em>' + k + '</em> ' + v + '</span>').join('');
    if (force || (PF.frames % 20 === 0)) panel.querySelector('#pf-find').innerHTML = findings().map(t => '<p>' + esc(t) + '</p>').join('');
  }
  PF.toggle = function (v) {
    if (!panel) build(); const open = v == null ? !panel.classList.contains('open') : v; panel.classList.toggle('open', open); PF.on = open || !!PF.rec;
    clearInterval(timerUI); if (open) { paint(true); timerUI = origSI(() => paint(), 250); }
  };

  // ---------- F3 / F4 ----------
  window.addEventListener('keydown', e => {
    if (e.code !== 'F3' && e.code !== 'F4') return; e.preventDefault(); e.stopPropagation(); if (e.repeat) return;
    if (e.code === 'F3') { if (!RW.S) return; RW.S.gfx.fps = !RW.S.gfx.fps; RW.saveSettings && RW.saveSettings(); }
    else PF.toggle();
  }, true);

  // автопідказка: довго низький FPS
  let lowT = 0, hinted = 0;
  origSI(() => { const st = stats(); if (!st || !RW.Game || !RW.Game.running) { lowT = 0; return; } if (st.fps < 28 && rn > 120) lowT++; else lowT = 0; if (lowT >= 6 && now() - hinted > 300000) { hinted = now(); PF.toast('🐢 Низький FPS. Натисніть F4 → «Запис 30 с» і надішліть мені звіт — я знайду причину'); } }, 2500);
})();
