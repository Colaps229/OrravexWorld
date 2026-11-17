'use strict';
// ============================================================
//  tools.js — локальний творчий режим. Лише на цьому комп'ютері:
//  нічого не надсилається другові й не пишеться в чат, журнал чи збереження.
// ============================================================
(function () {
  const D = RW.D, U = RW.U; const Dev = RW.Dev = { on: false, t: {}, amt: 100, q: '', cat: 'all' };
  const G = () => RW.G; const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cols = () => (G() ? G().pawns.filter(p => p.faction === 'colony' && !p.dead) : []);
  const say = (t, k) => RW.UI && RW.UI.toast(t, k || 'info');

  const TOGGLES = [
    ['god', '🛡 Безсмертні колоністи', 'Не вмирають, рани й хвороби зникають'],
    ['food', '🍖 Без голоду', 'Ситість завжди повна'],
    ['rest', '😴 Без втоми', 'Сил завжди повно'],
    ['mood', '😊 Гарний настрій', 'Без зривів і нудьги'],
    ['fast', '⚡ Швидка робота ×3', 'Усі трудові дії втричі швидші'],
    ['build', '🏗 Миттєве будівництво', 'Креслення стають будівлями без матеріалів'],
    ['grow', '🌱 Швидкий ріст', 'Рослини дозрівають за секунди'],
  ];

  // ---------- ефекти ----------
  function heal(p) { p.injuries = []; p.ill = []; p.blood = 1; p.pain = 0; p.downed = false; p.dead = false; try { p.updateCap(); } catch (e) { } }
  const P = RW.Pawn.prototype; const origDie = P.die, origMood = P.computeMood, origWork = P.workSpeed;
  P.die = function (c, s) { if (Dev.on && Dev.t.god && this.faction === 'colony') { heal(this); return; } return origDie.call(this, c, s); };
  P.computeMood = function () { const r = origMood.apply(this, arguments); if (Dev.on && Dev.t.mood && this.faction === 'colony') { this.mood = 100; return 100; } return r; };
  P.workSpeed = function () { const r = origWork.apply(this, arguments); return (Dev.on && Dev.t.fast && this.faction === 'colony') ? r * 3 : r; };

  setInterval(() => {
    const g = G(); if (!Dev.on || !g || !g.map || !RW.Game.running) return;
    for (const p of cols()) {
      if (Dev.t.god && (p.injuries.length || p.ill.length || p.downed || p.blood < 1)) heal(p);
      if (Dev.t.food) p.needs.food = 1; if (Dev.t.rest) p.needs.rest = 1; if (Dev.t.mood) { p.needs.joy = 1; if (p.mental) p.mental = null; }
    }
    if (Dev.t.build) for (const bp of g.map.blueprints.slice()) {
      g.map.removeBlueprint(bp); const b = g.map.addBuilding(bp.def, bp.x, bp.y, bp.rot); if (b) { if (b.def.fuel) b.fuel = 0; if (b.def.battery) b.charge = 0; } g.stats.built++;
    }
    if (Dev.t.grow) { let n = 0; for (let i = 0; i < g.map.n && n < 4000; i++) { const pl = g.map.plant[i]; if (pl && pl.growth < 1) { pl.growth = Math.min(1, pl.growth + 0.2); n++; } } if (n) g.map.allDirty = true; }
  }, 250);

  // ---------- одноразові дії ----------
  const ACT = {
    research() { const g = G(); for (const k in D.research) g.research.done.add(k); g.research.current = null; g.research.queue = []; say('Усі дослідження завершено', 'good'); },
    allow() { const g = G(); let n = 0; for (const a of g.map.items.values()) for (const it of a) if (it.forbid) { it.forbid = false; n++; } say('Дозволено предметів: ' + n); },
    heal() { for (const p of cols()) { heal(p); p.needs.food = 1; p.needs.rest = 1; } say('Усіх вилікувано', 'good'); },
    skills() { for (const p of cols()) for (const k in p.skills) { p.skills[k].lvl = 20; p.skills[k].xp = 0; } say('Навички колоністів — 20', 'good'); },
    morning() { const g = G(); const day = Math.floor(g.tick / D.DAY); let t = day * D.DAY + 7 * D.HOUR; if (t <= g.tick) t += D.DAY; g.tick = t; say('Настав ранок'); },
    colonist() {
      const g = G(); const p = RW.Pawn.generate({}); p.faction = 'colony'; p.x = g.home.x + 0.5 + U.ri(-2, 2); p.y = g.home.y + 0.5 + U.ri(-2, 2); p.recomputeBio(); p.equip.weapon = null;
      g.pawns.push(p); try { const E = RW.Events || RW.E; E && E.initRelations && E.initRelations(p); } catch (e) { } say(U.shortName(p) + ' приєднався до колонії', 'good');
    },
    wealth() { give('silver', 5000); give('steel', 500); give('wood', 500); give('components', 50); },
  };
  function give(def, n) {
    const g = G(), d = D.items[def]; if (!g || !d) return; n = Math.max(1, Math.min(Math.floor(n) || 1, d.stack * 300));
    const last = g.map.addItem(def, n, g.home.x, g.home.y, { forbid: false }); say('+' + n + ' × ' + d.name, 'good'); return last;
  }

  // ---------- панель ----------
  let btn = null, pan = null;
  function itemsList() {
    const q = Dev.q.toLowerCase(); const out = [];
    for (const id in D.items) { const d = D.items[id]; if (d.cat === 'hidden' || d.cat === 'corpse') continue; if (Dev.cat !== 'all' && d.cat !== Dev.cat) continue; if (q && !(d.name || id).toLowerCase().includes(q) && !id.includes(q)) continue; out.push(d); }
    return out;
  }
  function cats() { const s = new Set(); for (const id in D.items) { const c = D.items[id].cat; if (c !== 'hidden' && c !== 'corpse') s.add(c); } return Array.from(s).sort(); }
  function paint() {
    if (!pan) return; const keepQ = document.activeElement && document.activeElement.id === 'dv-q';
    const list = itemsList().slice(0, 80);
    pan.querySelector('#dv-list').innerHTML = list.map(d => '<button class="dv-it" data-give="' + d.id + '"><i style="background:' + (d.color || '#888') + '"></i><span>' + esc(d.name || d.id) + '</span><em>' + (d.cat || '') + '</em></button>').join('') || '<div class="dv-empty">Нічого не знайдено</div>';
  }
  function paintToggles() {
    pan.querySelector('#dv-tg').innerHTML = TOGGLES.map(t => '<label class="dv-tg" title="' + esc(t[2]) + '"><input type="checkbox" data-t="' + t[0] + '" ' + (Dev.t[t[0]] ? 'checked' : '') + '><span>' + t[1] + '</span></label>').join('');
  }
  function buildPanel() {
    pan = document.createElement('div'); pan.id = 'dv-panel'; pan.className = 'dv-panel';
    pan.innerHTML = '<div class="dv-head"><b>🛠 Творчий режим</b><button data-x="1">✕</button></div>' +
      '<div class="dv-sec">Режими</div><div id="dv-tg"></div>' +
      '<div class="dv-sec">Дії</div><div class="dv-acts">' +
      [['research', '🔬 Усі дослідження'], ['allow', '✔ Дозволити все'], ['heal', '❤ Вилікувати всіх'], ['skills', '⭐ Навички на 20'], ['morning', '🌅 До ранку'], ['colonist', '➕ Колоніст'], ['wealth', '💰 Стартовий набір']].map(a => '<button class="dv-b" data-a="' + a[0] + '">' + a[1] + '</button>').join('') + '</div>' +
      '<div class="dv-sec">Предмети</div><div class="dv-row"><input id="dv-q" placeholder="Пошук…" autocomplete="off"><select id="dv-c"></select></div>' +
      '<div class="dv-row"><span>Кількість</span><input id="dv-n" type="number" min="1" value="' + Dev.amt + '"><button class="dv-chip" data-n="1">1</button><button class="dv-chip" data-n="10">10</button><button class="dv-chip" data-n="100">100</button><button class="dv-chip" data-n="1000">1000</button></div>' +
      '<div id="dv-list" class="dv-list"></div><div class="dv-hint">Клік по предмету — видати біля стартового майданчика. Закрити: ✕ або /cheat off</div>';
    document.body.appendChild(pan);
    const c = pan.querySelector('#dv-c'); c.innerHTML = '<option value="all">Усі</option>' + cats().map(x => '<option>' + x + '</option>').join('');
    for (const el of pan.querySelectorAll('input,select')) { el.addEventListener('keydown', e => e.stopPropagation()); el.addEventListener('keyup', e => e.stopPropagation()); }
    pan.oninput = e => { if (e.target.id === 'dv-q') { Dev.q = e.target.value; paint(); } else if (e.target.id === 'dv-n') Dev.amt = Math.max(1, parseInt(e.target.value) || 1); };
    pan.onchange = e => { if (e.target.id === 'dv-c') { Dev.cat = e.target.value; paint(); } else if (e.target.dataset.t) Dev.t[e.target.dataset.t] = e.target.checked; };
    pan.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.x) { pan.classList.remove('open'); } else if (b.dataset.give) give(b.dataset.give, Dev.amt); else if (b.dataset.a) ACT[b.dataset.a](); else if (b.dataset.n) { Dev.amt = +b.dataset.n; pan.querySelector('#dv-n').value = Dev.amt; }
    };
    paintToggles(); paint();
  }
  function mkBtn() {
    btn = document.createElement('button'); btn.id = 'dv-btn'; btn.className = 'dv-btn'; btn.textContent = '🛠'; btn.title = 'Творчий режим';
    btn.onclick = () => { if (!pan) buildPanel(); pan.classList.toggle('open'); };
    document.body.appendChild(btn);
  }
  Dev.set = function (on) {
    Dev.on = !!on;
    if (on) { if (!btn) mkBtn(); btn.style.display = ''; say('Творчий режим: увімкнено'); }
    else { Dev.t = {}; if (btn) btn.style.display = 'none'; if (pan) { pan.remove(); pan = null; } say('Творчий режим: вимкнено'); }
  };

  // команда з чату: перехоплюється повністю локально
  RW.Chat && RW.Chat.hooks.push(t => {
    const m = /^\/cheat\s+(on|off)\s*$/i.exec(t); if (!m) return false; Dev.set(m[1].toLowerCase() === 'on'); return true;
  });
})();
