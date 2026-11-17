'use strict';
// ============================================================
//  audio.js — процедурний звук і музика (WebAudio, без файлів)
// ============================================================
(function () {
  const A = RW.A = {};
  let ac = null, master, musicG, sfxG, ambG, noiseBuf, delay, started = false, musicTimer = null, step = 0, last = {};
  A.intensity = 0; A.mode = 'calm';
  const vol = () => RW.S.audio;

  A.init = function () {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ac.createGain(); musicG = ac.createGain(); sfxG = ac.createGain(); ambG = ac.createGain();
    musicG.connect(master); sfxG.connect(master); ambG.connect(master); master.connect(ac.destination);
    // шум
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // ехо для музики
    delay = ac.createDelay(1.5); delay.delayTime.value = 0.46; const fb = ac.createGain(); fb.gain.value = 0.38; const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(musicG);
    A.apply();
    // амбієнт: вітер/дощ
    A.wind = ac.createBufferSource(); A.wind.buffer = noiseBuf; A.wind.loop = true; A.windF = ac.createBiquadFilter(); A.windF.type = 'lowpass'; A.windF.frequency.value = 500; A.windG = ac.createGain(); A.windG.gain.value = 0;
    A.wind.connect(A.windF); A.windF.connect(A.windG); A.windG.connect(ambG); A.wind.start();
    A.rain = ac.createBufferSource(); A.rain.buffer = noiseBuf; A.rain.loop = true; A.rainF = ac.createBiquadFilter(); A.rainF.type = 'highpass'; A.rainF.frequency.value = 2500; A.rainG = ac.createGain(); A.rainG.gain.value = 0;
    A.rain.connect(A.rainF); A.rainF.connect(A.rainG); A.rainG.connect(ambG); A.rain.start();
    started = true;
    A.startMusic();
  };
  A.apply = function () {
    if (!ac) return; const v = vol();
    master.gain.value = v.master; musicG.gain.value = v.music * 0.55; sfxG.gain.value = v.sfx; ambG.gain.value = v.master * 0.9 * (v.sfx > 0 ? 1 : 0);
  };
  A.setAmbient = function (wt, windy) {
    if (!ac) return; const t = ac.currentTime;
    A.rainG.gain.setTargetAtTime(wt === 'rain' ? 0.12 : wt === 'storm' ? 0.2 : 0, t, 1.5);
    A.windG.gain.setTargetAtTime((wt === 'storm' ? 0.12 : wt === 'snow' ? 0.07 : 0.025) + (windy || 0), t, 2);
  };

  function tone(freq, dur, type, g0, dest, when, glide) {
    const t = ac.currentTime + (when || 0); const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t); if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(20, glide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(g0, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || sfxG); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, g0, f, type, dest, when, q) {
    const t = ac.currentTime + (when || 0); const s = ac.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 0.7 + Math.random() * 0.6;
    const fl = ac.createBiquadFilter(); fl.type = type || 'bandpass'; fl.frequency.value = f; fl.Q.value = q || 1; const g = ac.createGain();
    g.gain.setValueAtTime(g0, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(dest || sfxG); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  const SFX = {
    click: () => tone(880, 0.05, 'triangle', 0.12), ui: () => { tone(620, 0.06, 'triangle', 0.1); tone(930, 0.07, 'triangle', 0.08, null, 0.04); },
    hammer: () => { noise(0.07, 0.35, 1800, 'bandpass'); tone(190, 0.1, 'square', 0.12, null, 0, 90); },
    pick: () => { noise(0.08, 0.4, 3200, 'bandpass', null, 0, 4); tone(420, 0.06, 'square', 0.07, null, 0, 200); },
    chop: () => { noise(0.1, 0.4, 900, 'bandpass'); tone(130, 0.12, 'sine', 0.2, null, 0, 70); },
    craft: () => { noise(0.05, 0.2, 2800, 'highpass'); tone(520, 0.05, 'triangle', 0.08); },
    shot: () => { noise(0.2, 0.55, 1400, 'lowpass'); tone(140, 0.18, 'sawtooth', 0.22, null, 0, 40); },
    arrow: () => { noise(0.14, 0.2, 4200, 'highpass'); tone(300, 0.1, 'sine', 0.06, null, 0, 700); },
    hit: () => { noise(0.1, 0.35, 700, 'lowpass'); tone(110, 0.09, 'square', 0.14, null, 0, 55); },
    thud: () => { noise(0.1, 0.4, 300, 'lowpass'); tone(80, 0.12, 'sine', 0.3, null, 0, 40); },
    crash: () => { noise(0.9, 0.7, 400, 'lowpass'); tone(70, 0.9, 'sawtooth', 0.25, null, 0, 25); noise(0.5, 0.3, 2000, 'bandpass', null, 0.05); },
    alert: () => { tone(540, 0.18, 'square', 0.1); tone(430, 0.22, 'square', 0.1, null, 0.2); },
    coin: () => { tone(1320, 0.08, 'triangle', 0.1); tone(1760, 0.14, 'triangle', 0.09, null, 0.07); },
    research: () => { [523, 659, 784, 1047].forEach((f, k) => tone(f, 0.3, 'triangle', 0.1, null, k * 0.1)); },
    fire: () => noise(0.5, 0.1, 600, 'lowpass'),
    thunder: () => { noise(1.8, 0.7, 250, 'lowpass', null, 0.1); tone(55, 1.4, 'sawtooth', 0.2, null, 0.1, 30); },
    whoosh: () => { const t = ac.currentTime; const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.8; f.frequency.setValueAtTime(5200, t); f.frequency.exponentialRampToValueAtTime(260, t + 3.6); const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.55, t + 2.4); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.8); s.connect(f); f.connect(g); g.connect(sfxG); s.start(t); s.stop(t + 4); tone(90, 3.4, 'sawtooth', 0.12, null, 0, 40); },
    rumble: () => { noise(2.2, 0.5, 120, 'lowpass', null, 0, 1); tone(48, 2, 'sine', 0.3, null, 0, 30); },
    letter: () => { tone(660, 0.12, 'sine', 0.12); tone(880, 0.2, 'sine', 0.1, null, 0.09); },
    cough: () => { noise(0.12, 0.25, 900, 'bandpass'); tone(180, 0.1, 'sawtooth', 0.05, null, 0, 120); },
    levelup: () => { [784, 988, 1175, 1568].forEach((f, k) => tone(f, 0.22, 'triangle', 0.09, null, k * 0.07)); },
    good: () => { tone(660, 0.12, 'triangle', 0.1); tone(990, 0.18, 'triangle', 0.1, null, 0.08); },
    bad: () => { tone(300, 0.2, 'sawtooth', 0.1); tone(220, 0.3, 'sawtooth', 0.1, null, 0.12); }
  };
  const MIN = { shot: 90, arrow: 90, hit: 60, thud: 60, hammer: 150, pick: 150, chop: 150, craft: 200, fire: 800, click: 30 };
  A.sfx = function (name) {
    if (!ac || !started || vol().sfx <= 0) return;
    const now = performance.now(); if (last[name] && now - last[name] < (MIN[name] || 50)) return; last[name] = now;
    try { if (SFX[name]) SFX[name](); } catch (e) { }
  };

  // ---- Музика ----
  const SCALE = [0, 3, 5, 7, 10]; // мінорна пентатоніка
  const PROG = [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]]; // Am F G Em
  const mf = n => 440 * Math.pow(2, (n - 69) / 12);
  function pad(notes, dur) {
    for (const n of notes) {
      const t = ac.currentTime; const o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
      o.type = 'sawtooth'; o2.type = 'triangle'; o.frequency.value = mf(n - 12); o2.frequency.value = mf(n - 12) * 1.004; f.type = 'lowpass'; f.frequency.value = 700; f.Q.value = 0.6;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.055, t + dur * 0.4); g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(f); o2.connect(f); f.connect(g); g.connect(musicG); o.start(t); o2.start(t); o.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
    }
  }
  function pluck(n, when) {
    const t = ac.currentTime + (when || 0); const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'triangle'; o.frequency.value = mf(n); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    o.connect(g); g.connect(musicG); g.connect(delay); o.start(t); o.stop(t + 1.3);
  }
  function drum(when) { const t = ac.currentTime + when; const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.2); g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); o.connect(g); g.connect(musicG); o.start(t); o.stop(t + 0.35); }
  A.startMusic = function () {
    if (musicTimer) return;
    const bar = () => {
      if (!ac || vol().music <= 0) return;
      const tense = A.intensity > 0.5;
      const chord = PROG[Math.floor(step / (tense ? 1 : 2)) % 4]; const dur = tense ? 3.2 : 5.2;
      pad(chord, dur + 1.2);
      const root = chord[0];
      const nn = tense ? 8 : 5;
      for (let k = 0; k < nn; k++) { if (Math.random() < (tense ? 0.85 : 0.55)) pluck(root + 12 + SCALE[Math.floor(Math.random() * 5)] + (Math.random() < 0.3 ? 12 : 0), k * dur / nn); }
      if (tense) for (let k = 0; k < 4; k++) drum(k * dur / 4);
      step++;
    };
    bar(); musicTimer = setInterval(bar, 5200);
    A.musicInterval = true;
  };
  A.setIntensity = function (v) { A.intensity = v; };
  A.tension = function (on) { A.intensity = on ? 1 : 0; };
})();
