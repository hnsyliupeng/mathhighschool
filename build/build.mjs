/* 构建：把 CSS / JS 全部内联成一个可离线运行的 HTML 文件 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const src = path.join(root, 'src');
const files = [
  'engine.js',
  'geo.js',
  ...fs.readdirSync(path.join(src, 'pages'))
    .filter(f => f.endsWith('.js'))
    .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10))
    .map(f => path.join('pages', f)),
  'app.js',
];

const css = fs.readFileSync(path.join(src, 'style.css'), 'utf8');
const js = files.map(f => {
  const code = fs.readFileSync(path.join(src, f), 'utf8');
  return `\n/* ===== ${f} ===== */\n` + code;
}).join('\n');

let tpl = fs.readFileSync(path.join(src, 'template.html'), 'utf8');
tpl = tpl.replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => js);
fs.writeFileSync(path.join(root, 'index.html'), tpl);
const kb = (Buffer.byteLength(tpl) / 1024).toFixed(0);
console.log(`built index.html · ${files.length} scripts · ${kb} KB`);
