/* =============================================================
   build/build-book.mjs · 把数据 + 引擎 + 场景 + 控制器拼成单文件
   输出：mathbook.html（零外部依赖）
   ============================================================= */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

const tpl = read('src2/template.html');
const css = read('src2/style.css');
const data = read('build/book-data.json');
const js = [
  '/* ---- engine.js ---- */',
  read('src/engine.js'),
  '/* ---- geo.js ---- */',
  read('src/geo.js'),
  '/* ---- scenes.js ---- */',
  read('src2/scenes.js'),
  '/* ---- book.js ---- */',
  read('src2/book.js'),
].join('\n');

// JSON 内联安全化
const safeData = data.replace(/<\//g, '<\\/');

const html = tpl
  .replace('/*__CSS__*/', () => css)
  .replace('/*__DATA__*/', () => safeData)
  .replace('/*__JS__*/', () => js);

const out = path.join(ROOT, 'mathbook.html');
fs.writeFileSync(out, html);
const kb = (Buffer.byteLength(html) / 1024).toFixed(0);

// 自检：不允许任何外部资源引用
const externals = [
  [/<script[^>]+src=/gi, 'script src'],
  [/<link[^>]+href=/gi, 'link href'],
  [/url\(\s*['"]?https?:/gi, 'css url(http)'],
  [/@import/gi, '@import'],
];
const bad = [];
for (const [re, name] of externals) if (re.test(html)) bad.push(name);

console.log(`built mathbook.html · ${kb} KB · 数据 ${(Buffer.byteLength(data) / 1024 / 1024).toFixed(2)} MB`);
if (bad.length) { console.error('外部依赖：', bad.join(', ')); process.exit(1); }
console.log('外部依赖检查：通过（0 个外部请求）');
