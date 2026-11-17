// ============================================================
//  lifeui.js — вікно «Люди»: настрій, думки, навички, граф стосунків
// ============================================================
(function () {
  'use strict';
  const RW = window.RW; const D = RW.D, U = RW.U; const G = () => RW.G; const DY = D.DAY;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LU = RW.LifeUI = { tab: 'mood', sel: null };
  const cols = () => G().pawns.filter(p => p.faction === 'colony' && !p.dead);
  function ring(v, size, label) {
    const r = size / 2 - 5, C = 2 * Math.PI * r, f = U.clamp(v / 100, 0, 1); const col = U.moodColor(v);
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '"><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="5"/><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + col + '" stroke-width="5" stroke-linecap="round" stroke-dasharray="' + (C * f).toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/><text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" fill="' + col + '" font-size="' + size * 0.3 + '" font-weight="700">' + (label != null ? label : Math.round(v)) + '</text></svg>';
  }
  function spark(h, w, ht) {
    if (!h || h.length < 2) return '<div class="sub">Збираємо дані…</div>'; const n = h.length; const pts = h.map((v, i) => (i / (n - 1) * w).toFixed(1) + ',' + (ht - v / 100 * ht).toFixed(1)).join(' ');
    return '<svg class="spark" width="' + w + '" height="' + ht + '" viewBox="0 0 ' + w + ' ' + ht + '"><rect width="' + w + '" height="' + ht + '" fill="rgba(0,0,0,.2)" rx="6"/>' + [18, 10].map(t => '<line x1="0" x2="' + w + '" y1="' + (ht - t / 100 * ht) + '" y2="' + (ht - t / 100 * ht) + '" stroke="rgba(224,88,74,.45)" stroke-dasharray="3 3"/>').join('') + '<polyline fill="none" stroke="#8ad0ff" stroke-width="2" stroke-linejoin="round" points="' + pts + '"/></svg>';
  }
  function moodTab() {
    const cs = cols(); if (!cs.length) return '<p>Немає колоністів.</p>'; let p = cs.find(x => x.id === LU.sel) || cs[0]; LU.sel = p.id;
    let h = '<div class="pl-list">' + cs.map(c => '<button class="plc ' + (c === p ? 'on' : '') + '" data-act="luSel" data-id="' + c.id + '"><img src="' + RW.UI.portrait(c) + '">' + ring(c.mood, 44, '') + '<span>' + esc(U.shortName(c)) + '</span></button>').join('') + '</div>';
    const th = p.breakThresholds(); const lab = p.mood < th.extreme ? ['Екстремальний ризик зриву', '#e0584a'] : p.mood < th.major ? ['Великий ризик зриву', '#e08a3a'] : p.mood < th.minor ? ['Ризик дрібного зриву', '#e0c04a'] : ['Стабільний', '#7ad07a'];
    h += '<div class="pl-main"><div class="pl-head">' + ring(p.mood, 86) + '<div><b>' + esc(U.fullName(p)) + '</b><div class="sub">Пороги зривів: дрібний ' + th.minor + ' · великий ' + th.major + ' · екстрем. ' + th.extreme + '</div><div style="color:' + lab[1] + '"><b>' + (p.mental ? 'ЗРИВ: ' + (RW.Life.BREAK_LABEL[p.mental.type] || '') : lab[0]) + '</b></div>' + (p.inspire ? '<div class="pos">✨ Натхнення: ' + D.skillNames[p.inspire.skill] + '</div>' : '') + '</div></div>';
    h += '<h4>Динаміка настрою</h4>' + spark(p.moodHist, 330, 56);
    const items = [].concat((p.sit || []).map(s => ({ l: s.l, v: s.v, ico: '•' })), p.thoughts.map(t => ({ l: t.l, v: t.v, ico: (D.thoughtIco && D.thoughtIco[t.id]) || '💭', left: t.left })));
    items.sort((a, b) => b.v - a.v);
    h += '<h4>Думки та стан</h4><div class="thl">' + items.map(t => '<div class="th ' + (t.v >= 0 ? 'p' : 'n') + '"><span class="ti">' + t.ico + '</span><span class="tl">' + esc(t.l) + '</span>' + (t.left != null ? '<span class="tt">' + (t.left / DY).toFixed(1) + ' д</span>' : '') + '<b>' + (t.v > 0 ? '+' : '') + Math.round(t.v) + '</b></div>').join('') + '</div></div>';
    return h;
  }
  function skillsTab() {
    const cs = cols(); let h = '<div class="sk-tbl"><div class="sk-r sk-h"><span></span>' + D.skills.map(s => '<span title="' + D.skillNames[s] + '">' + (D.skillIco[s] || D.skillNames[s].slice(0, 3)) + '</span>').join('') + '</div>';
    for (const p of cs) h += '<div class="sk-r"><span class="sk-n"><img src="' + RW.UI.portrait(p) + '">' + esc(U.shortName(p)) + '</span>' + D.skills.map(s => { const k = p.skills[s]; const need = 70 + 30 * k.lvl; const fl = k.pas === 2 ? '🔥🔥' : k.pas === 1 ? '🔥' : ''; return '<span class="sk-c ' + (p.inspire && p.inspire.skill === s ? 'ins' : '') + '" title="' + D.skillNames[s] + ' ' + k.lvl + '"><b>' + k.lvl + '</b><i style="width:' + U.clamp(k.xp / need * 100, 0, 100) + '%"></i><em>' + fl + '</em></span>'; }).join('') + '</div>';
    return h + '</div><p class="sub">🔥 — пристрасть (швидше навчання, радість від роботи). Навички вище 8 слабшають без практики. ✨ — натхнення.</p>';
  }
  function relTab() {
    const cs = cols(); const W = 520, H = 360, cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 38; if (cs.length < 2) return '<p>Потрібно щонайменше двоє колоністів.</p>';
    const pos = {}; cs.forEach((p, i) => { const a = i / cs.length * Math.PI * 2 - Math.PI / 2; pos[p.id] = [cx + Math.cos(a) * R * 1.2, cy + Math.sin(a) * R]; });
    const col = RW.Rel.COLOR; let s = '<svg class="relg" viewBox="0 0 ' + W + ' ' + H + '"><defs><filter id="rgl"><feGaussianBlur stdDeviation="2"/></filter></defs>'; const seen = new Set();
    for (const a of cs) for (const k in a.rel) { const b = cs.find(x => x.id === +k); if (!b) continue; const key = Math.min(a.id, b.id) + '_' + Math.max(a.id, b.id); if (seen.has(key)) continue; seen.add(key); const t = a.rel[k]; const [x1, y1] = pos[a.id], [x2, y2] = pos[b.id]; const w = t === 'spouse' ? 4 : t === 'lover' || t === 'fiance' ? 3 : 2; s += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + col[t] + '" stroke-width="' + w + '" ' + (t === 'ex' || t === 'rival' ? 'stroke-dasharray="5 4"' : '') + ' opacity=".85"/>'; const mx = (x1 + x2) / 2, my = (y1 + y2) / 2; const ic = { spouse: '💍', lover: '❤', fiance: '💞', friend: '🤝', rival: '⚔', kin: '🧬', ex: '💔' }[t]; s += '<circle cx="' + mx + '" cy="' + my + '" r="9" fill="#141a22" stroke="' + col[t] + '"/><text x="' + mx + '" y="' + (my + 0.5) + '" text-anchor="middle" dominant-baseline="middle" font-size="10">' + ic + '</text>'; }
    for (const p of cs) { const [x, y] = pos[p.id]; s += '<circle cx="' + x + '" cy="' + y + '" r="25" fill="none" stroke="' + U.moodColor(p.mood) + '" stroke-width="3"/><clipPath id="cp' + p.id + '"><circle cx="' + x + '" cy="' + y + '" r="22"/></clipPath><image href="' + RW.UI.portrait(p) + '" x="' + (x - 25) + '" y="' + (y - 25) + '" width="50" height="50" clip-path="url(#cp' + p.id + ')"/><text x="' + x + '" y="' + (y + 38) + '" text-anchor="middle" fill="#dfe6ee" font-size="11">' + esc(U.shortName(p)) + '</text>'; }
    s += '</svg><div class="rl-leg">' + Object.keys(RW.Rel.LABEL).map(k => '<span><i style="background:' + col[k] + '"></i>' + RW.Rel.LABEL[k] + '</span>').join('') + '</div>';
    const g = G(); const e = g.ext || {}; if (e.wedding) { const a = cs.find(x => x.id === e.wedding.a), b = cs.find(x => x.id === e.wedding.b); if (a && b) s += '<div class="tkind">💒 Заплановане весілля: ' + esc(U.shortName(a)) + ' і ' + esc(U.shortName(b)) + '</div>'; }
    s += '<div class="btnrow"><button class="btn" data-act="luParty">🎉 Влаштувати свято</button></div>'; return s;
  }
  LU.html = function () {
    const tabs = [['mood', '🙂 Настрій'], ['skills', '⭐ Навички'], ['rel', '💞 Стосунки']];
    return '<div class="tabs">' + tabs.map(t => '<button class="tab ' + (LU.tab === t[0] ? 'on' : '') + '" data-act="luTab" data-id="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>' + (LU.tab === 'mood' ? moodTab() : LU.tab === 'skills' ? skillsTab() : relTab());
  };
  LU.install = function () {
    const UI = RW.UI; UI.addWin('people', { title: 'Люди', fn: LU.html, cls: 'win-wide' });
    Object.assign(UI.actions, {
      luTab: el => { LU.tab = el.dataset.id; }, luSel: el => { LU.sel = +el.dataset.id; },
      luParty: () => { const g = G(); if (!RW.Rel.startParty('party')) UI.toast('Свято вже триває', 'info'); }
    });
    UI.TABS.splice(UI.TABS.length - 1, 0, { id: 'people', label: 'Люди', key: 'P' }); UI.keyWins.KeyP = 'people';
  };
  LU.install();
})();
