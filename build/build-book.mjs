/* build-book.mjs · 把模板 + 样式 + 全书数据 + 全部引擎内联为单文件 mathbook.html（零外部依赖） */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url)) + '/..';
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
let html = read('src2/template.html');
html = html.replace('/*__CSS__*/', () => read('src2/style.css'));
html = html.replace('/*__DATA__*/', () => read('build/book-data.json').trim().replace(/<\/script/gi, '<\\/script'));
const jsFiles = [
  'node_modules/three/build/three.min.js',
  'src/engine.js', 'src/geo.js',
  'src2/scenes.js', 'src2/labs.js', 'src2/problem-models.js', 'src2/three-watch.js',
  'src2/stage.js', 'src2/book.js',
];
const js = jsFiles.map(f => '\n/* ===== ' + f + ' ===== */\n' + read(f)).join('\n');
html = html.replace('/*__JS__*/', () => js.replace(/<\/script/gi, '<\\/script'));
const ext = [...html.matchAll(/<(?:script|link|img)[^>]+(?:src|href)\s*=\s*"https?:[^"]*"/g)];
if (ext.length) { console.error('外部依赖检查失败：', ext.length); process.exit(1); }
fs.writeFileSync(path.join(root, 'mathbook.html'), html);
console.log(`built mathbook.html · ${(html.length / 1024).toFixed(0)} KB · 数据 ${(read('build/book-data.json').length / 1048576).toFixed(2)} MB`);
console.log('外部依赖检查：通过（0 个外部请求）');
