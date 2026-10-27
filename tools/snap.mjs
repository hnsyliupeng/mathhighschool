/* 开发期工具：把某一页正文导出成静态 HTML，供 WeasyPrint 做排版快照 */
import fs from 'fs';
const idx = parseInt(process.argv[2] || '0', 10);
const width = parseInt(process.argv[3] || '620', 10);
const data = JSON.parse(fs.readFileSync('build/book-data.json', 'utf8'));
const css = fs.readFileSync('src2/style.css', 'utf8');
const p = data.pages[idx];
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<style>
@font-face { font-family: 'NSerif'; src: url('file:///home/user/.fonts/NotoSerifSC-Regular.otf'); }
@font-face { font-family: 'NSans'; src: url('file:///home/user/.fonts/NotoSansSC-Regular.otf'); }
:root { --serif: 'NSerif', serif; --kai: 'NSerif', serif; --math: 'NSerif', 'NSans', serif; }
</style>
<style>${css}</style>
<style>
  body { margin: 0; background: #efe4cb; }
  .sheetwrap { width: ${width}px; background: #fbf6e9; padding: 16px 8px; }
  .pane { font-size: var(--read); height: auto; overflow: visible; }
</style></head><body>
<div class="sheetwrap"><div class="pane">${p.html}</div></div>
</body></html>`;
fs.writeFileSync('test/out/pages/page-' + idx + '.html', html);
console.log('wrote test/out/pages/page-' + idx + '.html', 'html len', p.html.length, '·', p.ch, p.sec);
