'use strict';
// ============================================================
//  group.js — групове виділення, біле коло виділення, бойова готовність (v0.9.7)
//  Рамка мишкою навколо колоністів або Shift+клік — виділяє групу.
//  Кнопка «⚔ Бойова готовність» (або R) призиває всю групу; ПКМ — іти / атакувати.
// ============================================================
(function () {
  const RW = window.RW, U = RW.U, UI = RW.UI; const G = () => RW.G;
  const Gp = RW.Group = { ids: new Set(), _keep: false };
  Gp.list = function () {
    const g = G(); if (!g || !g.pawns) return []; const out = [];
    for (const id of Gp.ids) { const p = g.pawns.find(x => x.id === id); if (p && !p.dead && p.faction === 'colony') out.push(p); }
    return out;
  };
  Gp.all = function () { // група + одиночно виділений колоніст
    const l = Gp.list(); const s = UI.selPawn && UI.selPawn(); if (s && s.faction === 'colony' && !l.includes(s)) l.push(s); return l;
  };
  const os = UI.select;
  UI.select = function (o) {
    const shift = UI.keys && (UI.keys.ShiftLeft || UI.keys.ShiftRight);
    if (shift && o && o.p && o.p.faction === 'colony') {
      const cur = UI.selPawn && UI.selPawn(); if (cur && cur.faction === 'colony') Gp.ids.add(cur.id);
      Gp.ids.add(o.p.id); return os.call(this, o);
    }
    if (!Gp._keep) Gp.ids.clear();
    return os.call(this, o);
  };
  Gp.box = function (r) {
    const g = G(); const l = g.pawns.filter(p => p.faction === 'colony' && !p.dead && !p.hidden && !p.carriedBy && Math.floor(p.x) >= r.x0 && Math.floor(p.x) <= r.x1 && Math.floor(p.y) >= r.y0 && Math.floor(p.y) <= r.y1);
    if (!l.length) return false;
    Gp._keep = true; Gp.ids.clear(); for (const p of l) Gp.ids.add(p.id); os.call(UI, { p: l[0] }); Gp._keep = false;
    if (l.length > 1) UI.toast('Виділено колоністів: ' + l.length, 'info');
    return true;
  };
  Gp.toggleDraft = function () {
    const l = Gp.all(); if (!l.length) return;
    const on = l.some(p => !p.drafted && !p.downed && !p.noViolence);
    for (const p of l) if (!!p.drafted !== on) UI.toggleDraft(p);
    UI.dirty = true;
    if (l.length > 1) UI.toast(on ? '⚔ Бойова готовність: ' + l.length : 'Відбій: ' + l.length, on ? 'warn' : 'info');
  };
  // ПКМ: наказ усій призваній групі
  Gp.order = function (m) {
    const g = G(), map = g.map; const l = Gp.all().filter(p => p.drafted && !p.downed); if (l.length < 2) return false;
    const tx = Math.floor(m.fx), ty = Math.floor(m.fy); if (!map.inb(tx, ty)) return true;
    const o = UI.pickAt ? UI.pickAt(m.fx, m.fy) : null;
    if (o && (o.p && o.p.faction === 'enemy' || o.a && (o.a.hostile || o.a.manhunt > 0))) { for (const p of l) { p.target = o.p || o.a; p.orderPos = null; } UI.toast('Група атакує', 'info'); return true; }
    const used = new Set(); let n = 0;
    const offs = []; for (let r = 0; r <= 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r) offs.push([dx, dy]);
    for (const p of l) {
      for (const [dx, dy] of offs) {
        const x = tx + dx, y = ty + dy; if (!map.inb(x, y)) continue; const k = y * map.w + x; if (used.has(k) || map.cost[k] <= 0) continue;
        if (!map.reachable(p.tx, p.ty, x, y, false)) continue;
        used.add(k); p.orderPos = { x, y }; p.target = null; RW.AI.resetMove(p); RW.R.fx.ring(x + 0.5, y + 0.5, 0.7, '#7fe08a'); n++; break;
      }
    }
    if (!n) UI.toast('Туди не пройти', 'bad'); return true;
  };
  // R — для групи
  window.addEventListener('keydown', e => {
    if (e.code !== 'KeyR' || (e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) return;
    if (!RW.Game || !RW.Game.running) return; if (Gp.all().length > 1) { e.stopImmediatePropagation(); Gp.toggleDraft(); }
  }, true);
  // кнопка
  let btn = null;
  function ensureBtn() {
    if (btn) return btn; btn = document.createElement('button');
    btn.id = 'grp-draft'; btn.style.cssText = 'position:fixed;left:50%;bottom:118px;transform:translateX(-50%);z-index:30;display:none;padding:8px 16px;font:600 14px sans-serif;border-radius:8px;border:1px solid #8a8a8a;background:rgba(30,32,38,0.92);color:#fff;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.5)';
    btn.addEventListener('mousedown', e => e.stopPropagation());
    btn.addEventListener('click', e => { e.stopPropagation(); Gp.toggleDraft(); });
    document.body.appendChild(btn); return btn;
  }
  setInterval(() => {
    const g = G(); const b = ensureBtn();
    if (!g || !g.map || !RW.Game || !RW.Game.running) { b.style.display = 'none'; return; }
    for (const id of [...Gp.ids]) if (!g.pawns.find(x => x.id === id && !x.dead)) Gp.ids.delete(id);
    const l = Gp.all(); if (!l.length) { b.style.display = 'none'; return; }
    const on = l.every(p => p.drafted); b.style.display = '';
    b.textContent = (on ? '🛡 Відбій' : '⚔ Бойова готовність') + (l.length > 1 ? ' (' + l.length + ')' : '') + '  [R]';
    b.style.background = on ? 'rgba(150,40,30,0.95)' : 'rgba(30,32,38,0.92)'; b.style.borderColor = on ? '#ff8a70' : '#8a8a8a';
  }, 150);
  // білі кола виділення
  RW.R.worldOver.push(function (c, TS, map) {
    const g = G(); if (!g || !g.sel && !Gp.ids.size) return; const t = (RW.R.time || 0);
    c.save(); c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,0.95)'; c.shadowColor = 'rgba(0,0,0,0.7)'; c.shadowBlur = 3;
    const ring = (x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, 6.3); c.stroke(); };
    const pulse = 1 + Math.sin(t / 12) * 0.04;
    const seen = new Set();
    for (const p of Gp.all()) { if (p.hidden || p.carriedBy) continue; seen.add(p); ring(p.x * TS, p.y * TS + 1, 16 * pulse); }
    const s = g.sel;
    if (s) {
      if (s.p && !seen.has(s.p) && g.pawns.includes(s.p) && !s.p.hidden) ring(s.p.x * TS, s.p.y * TS + 1, 16 * pulse);
      else if (s.a && !s.a.dead) ring(s.a.x * TS, s.a.y * TS, 15 * pulse);
      else if (s.item && !s.item.dead) ring(((s.item.i % map.w) + 0.5) * TS, (((s.item.i / map.w) | 0) + 0.5) * TS, 15 * pulse);
      else if (s.b && !s.b.dead) ring((s.b.x + s.b.w / 2) * TS, (s.b.y + s.b.h / 2) * TS, Math.max(s.b.w, s.b.h) * TS / 2 + 4);
      else if (s.pl) ring((s.pl.x + 0.5) * TS, (s.pl.y + 0.5) * TS, 15 * pulse);
    }
    c.restore();
  });
})();
