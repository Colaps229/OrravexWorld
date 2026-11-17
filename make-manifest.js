// Створює files.json (список файлів і версія гри) для лаунчера.
// Запуск: node make-manifest.js   (з папки гри; перед кожним оновленням на GitHub)
const fs = require('fs'), path = require('path');
const root = __dirname, skip = new Set(['.git', '.github', 'node_modules', 'files.json', 'make-manifest.js']);
const out = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (skip.has(e.name) || e.name.endsWith('.bat')) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else out.push(path.relative(root, p).split(path.sep).join('/'));
  }
})(root);
let ver = '0.0.0';
try { ver = /num:\s*'([^']+)'/.exec(fs.readFileSync(path.join(root, 'js', 'version.js'), 'utf8'))[1]; } catch (e) { }
if (!out.includes('index.html')) { console.error('Немає index.html — запускайте з папки гри'); process.exit(1); }
fs.writeFileSync(path.join(root, 'files.json'), JSON.stringify({ version: ver, build: Date.now().toString(36), date: new Date().toISOString(), files: out.sort() }, null, 1));
console.log('files.json готовий: версія ' + ver + ', файлів: ' + out.length);
