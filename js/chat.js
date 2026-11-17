'use strict';
// ============================================================
//  chat.js — швидкий чат у грі: Enter відкриває рядок, Enter надсилає, Esc закриває
// ============================================================
(function () {
  const MP = RW.MP, Net = RW.Net;
  const Ch = RW.Chat = { hooks: [], open: false };
  const $ = id => document.getElementById(id);
  let root, log, inp, shown = 0, hideT = 0;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function build() {
    if (root) return; root = document.createElement('div'); root.id = 'chat'; root.className = 'gchat';
    root.innerHTML = '<div id="chat-log" class="gchat-log"></div><input id="chat-in" class="gchat-in" maxlength="240" autocomplete="off" placeholder="Повідомлення другові… (Enter — надіслати, Esc — закрити)">';
    document.body.appendChild(root); log = $('chat-log'); inp = $('chat-in');
    inp.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); submit(); }
      else if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); }
    }, true);
    inp.addEventListener('keyup', e => e.stopPropagation());
  }
  function running() { return !!(RW.Game && RW.Game.running && RW.G && RW.G.map); }
  function openChat() { if (!running()) return; build(); Ch.open = true; root.classList.add('open'); render(true); inp.value = ''; inp.focus(); }
  function close() { Ch.open = false; if (root) { root.classList.remove('open'); } if (inp) { inp.value = ''; inp.blur(); } hideT = Date.now() + 9000; render(); }
  function submit() {
    const t = inp.value.trim(); inp.value = ''; if (!t) { close(); return; }
    for (const h of Ch.hooks) { try { if (h(t)) { close(); return; } } catch (e) { } }   // службові команди — нікуди не надсилаються й не зберігаються
    if (!MP.active()) { RW.UI.toast('Чат працює лише в мультиплеєрі', 'info'); close(); return; }
    MP.say(t); close();
  }
  function render(force) {
    if (!root) return; const list = (MP.chat || []).filter(m => m.w === 'me' || m.w === 'peer');
    const now = Date.now(); const vis = Ch.open ? list.slice(-14) : list.filter(m => now - m.t < 12000).slice(-6);
    const peer = MP.st ? (MP.st().peerName || 'Друг') : 'Друг'; const me = MP.st ? (MP.st().myName || 'Ви') : 'Ви';
    const h = vis.map(m => '<div class="gm ' + m.w + '"><b>' + esc(m.w === 'me' ? me : peer) + ':</b> ' + esc(m.text) + '</div>').join('');
    if (log.dataset.h !== h || force) { log.dataset.h = h; log.innerHTML = h; log.scrollTop = 1e6; }
    root.style.display = (vis.length || Ch.open) ? '' : 'none';
  }
  setInterval(() => { if (!running() || !MP.chat) return; build(); const n = MP.chat.length; if (n !== shown) { shown = n; hideT = Date.now() + 12000; } render(); }, 300);

  window.addEventListener('keydown', e => {
    if (e.code !== 'Enter' && e.code !== 'NumpadEnter') return; if (e.altKey || e.ctrlKey || e.repeat) return;
    const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (!running()) return; if (document.getElementById('menu') && getComputedStyle($('menu')).display !== 'none' && RW.Menu && RW.Menu.screen && RW.Menu.screen !== 'x') return;
    e.preventDefault(); e.stopImmediatePropagation(); openChat();
  }, true);
})();
