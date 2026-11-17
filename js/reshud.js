// ============================================================
//  reshud.js — постійна панель складу: які ресурси й скільки їх (клік — повний список)
// ============================================================
(function () {
  'use strict';
  const RW = window.RW; const D = RW.D; const G = () => RW.G;
  const H = RW.ResHud = { open: false, last: '' };
  const KEY = ['steel', 'wood', 'silver', 'components', 'cloth', 'leather', 'gold'];
  const fmt = n => n >= 10000 ? (n / 1000).toFixed(0) + 'k' : n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(Math.floor(n));
  const LOW = { steel: 60, wood: 60, components: 2, silver: 100, cloth: 20, leather: 10 };
  H.html = function () {
    const g = G(); const st = RW.Events.colonyStock(); const UI = RW.UI;
    let food = 0, med = 0, meals = 0; for (const k in st) { const d = D.items[k]; if (!d) continue; if (d.cat === 'meal' || d.cat === 'drink') { meals += st[k]; food += (d.nutr || 0.3) * st[k]; } else if (d.cat === 'rawfood') food += (d.nutr || 0.1) * st[k] * 0.9; if (d.cat === 'medicine') med += st[k]; }
    const cols = g.pawns.filter(p => p.faction === 'colony' && !p.dead).length || 1; const days = food / (cols * 1.6 * 1);
    H.el && H.el.classList.toggle('open', H.open); let h = '<div class="rh-head" data-act="rhToggle" title="Клік — повний склад"><b>📦</b><span class="rh-days ' + (days < 3 ? 'neg' : days < 7 ? 'warn' : 'pos') + '" title="Запас їжі на колонію">🍽 ' + days.toFixed(1) + ' дн.</span><span class="rh-arr">' + (H.open ? '▾' : '▸') + '</span></div>';
    const row = (img, name, n, low) => '<div class="rh-row ' + (low ? 'low' : '') + '" title="' + name + '"><img src="' + img + '"><span class="rh-n">' + fmt(n) + '</span>' + (H.open ? '<span class="rh-nm">' + name + '</span>' : '') + '</div>';
    let fb = 0; for (const arr of g.map.items.values()) for (const it of arr) if (it.forbid && D.items[it.def].cat !== 'corpse') fb++;
    if (fb) h += '<div class="rh-allow" data-act="rhAllow" title="Заборонених стаків: ' + fb + '. Клік — дозволити все">✖ ' + fb + ' <b>✔ Дозволити</b></div>';
    if (!H.open) {
      for (const k of KEY) { const n = st[k] || 0; if (!n && !LOW[k]) continue; h += row(UI.itemImg(k), D.items[k].name, n, LOW[k] && n < LOW[k]); }
      h += row(UI.itemImg('meal_simple'), 'Їжа (страви)', meals, meals < 4); h += row(UI.itemImg('medicine'), 'Ліки', med, med < 2);
    } else {
      const cats = {}; for (const k in st) { const d = D.items[k]; if (!d || d.cat === 'corpse' || !st[k]) continue; (cats[d.cat] = cats[d.cat] || []).push(k); }
      h += '<div class="rh-list">'; for (const c of Object.keys(D.itemCats)) { if (!cats[c]) continue; h += '<div class="rh-cat">' + D.itemCats[c] + '</div>'; for (const k of cats[c].sort()) h += row(UI.itemImg(k), D.items[k].name, st[k], LOW[k] && st[k] < LOW[k]); } h += '</div>';
      if (!Object.keys(cats).length) h += '<div class="sub" style="padding:6px">Склад порожній</div>';
    }
    return h;
  };
  H.install = function () {
    const UI = RW.UI; const root = document.getElementById('ui'); const el = document.createElement('div'); el.id = 'reshud'; el.className = 'panel hidden'; root.appendChild(el); H.el = el;
    UI.actions.rhAllow = () => { let n = 0; for (const arr of G().map.items.values()) for (const it of arr) if (it.forbid) { it.forbid = false; n++; } UI.toast('Дозволено предметів: ' + n, 'good'); H.last = ''; H.refresh(); };
    UI.actions.rhToggle = () => { H.open = !H.open; H.last = ''; H.refresh(); };
    H.refresh = () => { const g = G(); if (!el.isConnected) document.getElementById('ui').appendChild(el); if (!g || !g.map || document.getElementById('ui').classList.contains('hidden')) { el.classList.add('hidden'); return; } el.classList.remove('hidden'); const h = H.html(); if (h !== H.last) { H.last = h; el.innerHTML = h; } };
    setInterval(H.refresh, 500);
  };
  window.addEventListener('load', H.install);
})();
// мітка версії у грі + вікно «Версії»
(function () {
  window.addEventListener('load', function () {
    const RW = window.RW; const UI = RW.UI; const root = document.getElementById('ui');
    const tag = document.createElement('div'); tag.id = 'vertag'; tag.textContent = RW.VER.full(); tag.title = 'Історія версій'; root.appendChild(tag);
    UI.addWin('versions', { title: 'Orravex World — версії', cls: 'win-wide', fn: () => RW.VER.log.map((e, k) => '<div class="vrow ' + (k === 0 ? 'cur' : '') + '" style="--d:' + k + '"><div class="vh"><span class="vnum">v' + e.v + '</span><b>' + UI.esc(e.t) + '</b><span class="sub">' + e.d + '</span>' + (k === 0 ? '<span class="vbadge">поточна</span>' : '') + '</div><ul>' + e.items.map(x => '<li>' + UI.esc(x) + '</li>').join('') + '</ul></div>').join('') });
    tag.onclick = () => UI.toggleWin('versions');
    const G = () => RW.G; setInterval(() => { if (!tag.isConnected) root.appendChild(tag); tag.style.display = (G() && G().map && !root.classList.contains('hidden')) ? '' : 'none'; }, 700);
  });
})();
