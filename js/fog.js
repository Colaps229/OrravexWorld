'use strict';
// ============================================================
//  fog.js — «туман» руди в скелях (v0.9.7)
//  Руда видна лише поруч із відкритим простором: впритул до краю гори
//  (1 клітина) або біля прокопаних вами тунелів (2 клітини). Глибше —
//  звичайна скеля: копайте, щоб відкривати жили.
// ============================================================
(function () {
  const RW = window.RW, D = RW.D, U = RW.U; const G = () => RW.G;
  const F = RW.Fog = { RIM: 1, DUG: 2, on: true };
  F.seen = function (map, i) {
    if (!F.on) return true; const w = map.w, h = map.h, x = i % w, y = (i / w) | 0; const R = F.DUG;
    for (let dy = -R; dy <= R; dy++) { const yy = y + dy; if (yy < 0 || yy >= h) continue; for (let dx = -R; dx <= R; dx++) { if (!dx && !dy) continue; const xx = x + dx; if (xx < 0 || xx >= w) continue; const k = yy * w + xx; if (map.blk[k] !== 0) continue; if (Math.abs(dx) <= F.RIM && Math.abs(dy) <= F.RIM) return true; if (map.terrain[k] === 7) return true; } }
    return false;
  };
  // перед/після копання клітини i: відкриті жили підсвічуємо
  F.before = function (map, i) {
    const out = []; const w = map.w, x = i % w, y = (i / w) | 0; for (let dy = -F.DUG; dy <= F.DUG; dy++) for (let dx = -F.DUG; dx <= F.DUG; dx++) { const xx = x + dx, yy = y + dy; if (!map.inb(xx, yy)) continue; const k = yy * w + xx; if (k !== i && map.blk[k] > 1 && !F.seen(map, k)) out.push(k); } return out;
  };
  F.after = function (map, i, list) {
    const w = map.w; const x = i % w, y = (i / w) | 0; for (let dy = -F.DUG; dy <= F.DUG; dy++) for (let dx = -F.DUG; dx <= F.DUG; dx++) { const xx = x + dx, yy = y + dy; if (map.inb(xx, yy)) map.markDirty(yy * w + xx); }
    let found = {}; for (const k of list || []) { if (map.blk[k] > 1 && F.seen(map, k)) { const b = D.blocks[map.blk[k]]; found[b.name] = (found[b.name] || 0) + 1; const kx = k % w + 0.5, ky = ((k / w) | 0) + 0.5; if (RW.FX2) RW.FX2.burst('sparkle', kx, ky, 8, { c: b.color }); if (RW.R && RW.R.fx.ring) RW.R.fx.ring(kx, ky, 1.2, b.color); } }
    const names = Object.keys(found); if (names.length) { RW.UI.toast('⛏ Виявлено: ' + names.map(n => n.toLowerCase() + (found[n] > 1 ? ' ×' + found[n] : '')).join(', '), 'good'); if (RW.A) RW.A.sfx('good'); const e = (G().ext = G().ext || {}); e.fogFound = (e.fogFound || 0) + list.length; }
  };
})();
