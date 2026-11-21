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
    if (X.isFs()) { want = false; document.exitFullscreen && document.exitFullscreen(); return; }
    const el = document.documentElement;
    (el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : Promise.reject()).then(() => {
      want = true;
      // Esc лишається для ігрового меню (щоб вийти — утримуйте Esc)
      if (navigator.keyboard && navigator.keyboard.lock) navigator.keyboard.lock(['Escape']).catch(() => {});
    }).catch(() => {});
  };
  // Esc (або системний вихід) не повинен виводити з повного екрана: повертаємось і віддаємо Esc грі
  let want = false, pending = false;
  X.release = () => { want = false; pending = false; };
  const reenter = () => { const el = document.documentElement; try { (el.requestFullscreen({ navigationUI: 'hide' }) || Promise.resolve()).then(() => { pending = false; lockEsc(); }).catch(() => { pending = true; }); } catch (e) { pending = true; } };
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && want && !NAT) { const ae = document.activeElement; if (ae && /^(INPUT|TEXTAREA)$/.test(ae.tagName)) return; try { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true })); } catch (e) { } reenter(); }
  });
  const gesture = e => { if (e && e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || '')) return; if (e && e.type === 'keydown') return; if (pending && want && !document.fullscreenElement) { pending = false; reenter(); } };
  document.addEventListener('pointerdown', gesture, true);
  const lockEsc = () => { try { if (navigator.keyboard && navigator.keyboard.lock) navigator.keyboard.lock(['Escape']).catch(() => {}); } catch (e) { } };
  document.addEventListener('fullscreenchange', () => { if (X.isFs()) lockEsc(); const b = document.getElementById('fsbtn'); if (b) b.textContent = X.isFs() ? '🗗' : '⛶'; if (!X.isFs() && navigator.keyboard && navigator.keyboard.unlock) navigator.keyboard.unlock(); });
  window.addEventListener('load', () => {
    const mk = () => { const b = document.createElement('button'); b.id = 'fsbtn'; b.className = 'fsbtn'; b.title = 'Повний екран [F11 / Alt+Enter]'; b.textContent = '⛶'; b.onclick = X.toggle; document.body.appendChild(b); };
    mk();
    window.addEventListener('keydown', e => { if (e.key === 'F11' || (e.altKey && e.key === 'Enter')) { e.preventDefault(); X.toggle(); } }, true);
  });
})();
