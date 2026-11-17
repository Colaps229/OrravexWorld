'use strict';
// ============================================================
//  util.js — допоміжні функції: RNG, шум, кольори, імена
// ============================================================
window.RW = window.RW || {};
(function () {
  const U = RW.U = {};

  U.clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  U.rr = (a, b) => a + Math.random() * (b - a);
  U.pick = arr => arr[Math.floor(Math.random() * arr.length)];
  U.chance = p => Math.random() < p;
  U.dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  U.sign = v => v < 0 ? -1 : (v > 0 ? 1 : 0);
  U.shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; };
  U.weighted = (items, wf) => {
    let tot = 0; for (const it of items) tot += wf(it);
    if (tot <= 0) return null;
    let r = Math.random() * tot;
    for (const it of items) { r -= wf(it); if (r <= 0) return it; }
    return items[items.length - 1];
  };

  // Детермінований генератор
  U.rng = function (seed) {
    let s = seed >>> 0;
    const f = () => {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.int = (a, b) => a + Math.floor(f() * (b - a + 1));
    f.range = (a, b) => a + f() * (b - a);
    f.pick = arr => arr[Math.floor(f() * arr.length)];
    f.chance = p => f() < p;
    return f;
  };
  U.hashStr = s => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  U.hash2 = (x, y, seed) => {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 982451653)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  // Value noise + fBm
  U.vnoise = (x, y, seed) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    let fx = x - xi, fy = y - yi;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const a = U.hash2(xi, yi, seed), b = U.hash2(xi + 1, yi, seed), c = U.hash2(xi, yi + 1, seed), d = U.hash2(xi + 1, yi + 1, seed);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
  U.fbm = (x, y, seed, oct) => {
    oct = oct || 4; let amp = 0.5, f = 1, sum = 0, norm = 0;
    for (let i = 0; i < oct; i++) { sum += amp * U.vnoise(x * f, y * f, seed + i * 101); norm += amp; amp *= 0.5; f *= 2; }
    return sum / norm;
  };

  // Кольори
  // Колірні утиліти викликаються тисячі разів за кадр з однаковими аргументами — результати кешуються
  const _hex = new Map(), _shade = new Map(), _rgba = new Map(), _mix = new Map();
  const _cap = (m) => { if (m.size > 6000) m.clear(); };
  const hexRaw = h => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  U.hexToRgb = h => { let r = _hex.get(h); if (r === undefined) { _cap(_hex); r = hexRaw(h); _hex.set(h, r); } return r.slice(); };
  U.rgbToHex = (r, g, b) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const shadeRaw = (hex, f) => { const [r, g, b] = U.hexToRgb(hex); if (f >= 0) return U.rgbToHex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f); return U.rgbToHex(r * (1 + f), g * (1 + f), b * (1 + f)); };
  U.shade = (hex, f) => { const k = hex + '|' + f; let r = _shade.get(k); if (r === undefined) { _cap(_shade); r = shadeRaw(hex, f); _shade.set(k, r); } return r; };
  U.mix = (a, b, t) => { const k = a + '|' + b + '|' + t; let r = _mix.get(k); if (r === undefined) { _cap(_mix); const A = U.hexToRgb(a), B = U.hexToRgb(b); r = U.rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); _mix.set(k, r); } return r; };
  U.rgba = (hex, a) => { const k = hex + '|' + a; let r = _rgba.get(k); if (r === undefined) { _cap(_rgba); const [R, G, B] = U.hexToRgb(hex); r = `rgba(${R},${G},${B},${a})`; _rgba.set(k, r); } return r; };
  U.moodColor = m => m >= 60 ? '#6fbf4a' : m >= 35 ? '#d3b53a' : m >= 18 ? '#d4852f' : '#cc3b2e';

  // Унікальні id
  let _id = 1;
  U.nextId = () => _id++;
  U.setIdCounter = v => { _id = Math.max(_id, v); };
  U.getIdCounter = () => _id;

  U.fmt = (n, d) => { d = d == null ? 0 : d; return Number(n).toFixed(d); };
  U.cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  // Імена
  U.names = {
    male: ['Тарас', 'Богдан', 'Остап', 'Данило', 'Ярослав', 'Мирон', 'Левко', 'Захар', 'Орест', 'Назар', 'Святослав', 'Роман', 'Марко', 'Андрій', 'Кирило', 'Максим', 'Олекса', 'Всеволод', 'Ігор', 'Дмитро', 'Олег', 'Влад', 'Артем', 'Єгор', 'Тимур', 'Хорс', 'Джек', 'Рікардо', 'Кай', 'Ніколас'],
    female: ['Олена', 'Соломія', 'Мар\'яна', 'Ярина', 'Оксана', 'Дарина', 'Леся', 'Златослава', 'Ліра', 'Наталка', 'Іванна', 'Мирослава', 'Христя', 'Орися', 'Катерина', 'Ілона', 'Аліна', 'Віра', 'Софія', 'Уляна', 'Зоряна', 'Мілана', 'Єва', 'Нова', 'Іскра', 'Айя', 'Рея', 'Мая', 'Лара', 'Тіна'],
    last: ['Коваль', 'Шевченко', 'Мельник', 'Бондар', 'Ткач', 'Кравець', 'Гончар', 'Литвин', 'Савчук', 'Мороз', 'Лисенко', 'Яременко', 'Вовк', 'Сокіл', 'Орел', 'Зірка', 'Грім', 'Ворон', 'Степовий', 'Чорний', 'Кремінь', 'Залізняк', 'Волошин', 'Тихий', 'Ковалів', 'Дорош', 'Рубан', 'Стрілець', 'Вітер', 'Сірко'],
    nick: ['Іскра', 'Тінь', 'Грім', 'Лис', 'Стріла', 'Рись', 'Дим', 'Кремінь', 'Бусел', 'Яструб', 'Зайчик', 'Шершень', 'Мудрий', 'Швидкий', 'Рудий', 'Сіра', 'Вогник', 'Крук', 'Ведмідь', 'Пташка'],
    animals: ['Бровко', 'Рекс', 'Мурко', 'Сірко', 'Жук', 'Барсик', 'Цезар', 'Лайка', 'Пушок', 'Тузик']
  };
  U.randomName = gender => {
    const first = U.pick(gender === 'f' ? U.names.female : U.names.male);
    return { first, nick: U.chance(0.6) ? first : U.pick(U.names.nick), last: U.pick(U.names.last) };
  };
  U.fullName = p => p.name.nick === p.name.first ? p.name.first + ' ' + p.name.last : p.name.first + ' «' + p.name.nick + '» ' + p.name.last;
  U.shortName = p => p.name.nick;

  // Бінарна купа для A*
  U.Heap = class {
    constructor(f) { this.a = []; this.f = f; }
    get size() { return this.a.length; }
    clear() { this.a.length = 0; }
    push(i) {
      const a = this.a, f = this.f; a.push(i);
      let c = a.length - 1;
      while (c > 0) { const p = (c - 1) >> 1; if (f[a[p]] <= f[a[c]]) break; const t = a[p]; a[p] = a[c]; a[c] = t; c = p; }
    }
    pop() {
      const a = this.a, f = this.f; const top = a[0]; const last = a.pop();
      if (a.length > 0) {
        a[0] = last; let p = 0; const n = a.length;
        for (;;) {
          let l = p * 2 + 1, r = l + 1, m = p;
          if (l < n && f[a[l]] < f[a[m]]) m = l;
          if (r < n && f[a[r]] < f[a[m]]) m = r;
          if (m === p) break;
          const t = a[p]; a[p] = a[m]; a[m] = t; p = m;
        }
      }
      return top;
    }
  };

  // Короткий текстовий формат тривалості
  U.fmtDur = ticks => {
    const D = RW.D; const days = ticks / D.DAY;
    if (days >= 1) return U.fmt(days, 1) + ' дн';
    return U.fmt(ticks / D.HOUR, 1) + ' год';
  };

  // base64 для типізованих масивів
  U.u8ToB64 = arr => { let s = ''; const CH = 8192; for (let i = 0; i < arr.length; i += CH) s += String.fromCharCode.apply(null, arr.subarray(i, i + CH)); return btoa(s); };
  U.b64ToU8 = (b64, len) => { const s = atob(b64); const a = new Uint8Array(len || s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; };
})();
