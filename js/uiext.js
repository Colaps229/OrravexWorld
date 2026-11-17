// ============================================================
//  uiext.js — повноекранний режим (Fullscreen API) та дрібні покращення інтерфейсу
// ============================================================
(function () {
  'use strict';
  const RW = window.RW; const X = RW.UIExt = {};
  // У лаунчері повний екран нативний (Esc з нього не виходить); у браузері — Fullscreen API
  const NAT = window.orravexNative; let natFs = false;
  const setBtn = () => { const b = document.getElementById('fsbtn'); if (b) b.textContent = X.isFs() ? '🗗' : '⛶'; };
  if (NAT) { NAT.onFullscreen(v => { natFs = v; setBtn(); }); NAT.isFullscreen().then(v => { natFs = v; setBtn(); }).catch(() => { }); }
  X.isFs = () => NAT ? natFs : !!document.fullscreenElement;
  X.toggle = function () {
    if (NAT) { NAT.toggleFullscreen().then(v => { natFs = v; setBtn(); }).catch(() => { }); return; }
    if (X.isFs()) { document.exitFullscreen && document.exitFullscreen(); return; }
    const el = document.documentElement;
    (el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : Promise.reject()).then(() => {
      // Esc лишається для ігрового меню (щоб вийти — утримуйте Esc)
      if (navigator.keyboard && navigator.keyboard.lock) navigator.keyboard.lock(['Escape']).catch(() => {});
    }).catch(() => {});
  };
  const lockEsc = () => { try { if (navigator.keyboard && navigator.keyboard.lock) navigator.keyboard.lock(['Escape']).catch(() => {}); } catch (e) { } };
  document.addEventListener('fullscreenchange', () => { if (X.isFs()) lockEsc(); const b = document.getElementById('fsbtn'); if (b) b.textContent = X.isFs() ? '🗗' : '⛶'; if (!X.isFs() && navigator.keyboard && navigator.keyboard.unlock) navigator.keyboard.unlock(); });
  window.addEventListener('load', () => {
    const mk = () => { const b = document.createElement('button'); b.id = 'fsbtn'; b.className = 'fsbtn'; b.title = 'Повний екран [F11 / Alt+Enter]'; b.textContent = '⛶'; b.onclick = X.toggle; document.body.appendChild(b); };
    mk();
    window.addEventListener('keydown', e => { if (e.key === 'F11' || (e.altKey && e.key === 'Enter')) { e.preventDefault(); X.toggle(); } }, true);
  });
})();
