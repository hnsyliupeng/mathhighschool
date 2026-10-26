/* 用真实浏览器量出每个 Markdown 块在正文栏宽度下的渲染高度 */
import fs from 'fs';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

const exe = await chromium.executablePath();
const browser = await puppeteer.launch({ args: chromium.args, executablePath: exe, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto('file:///home/user/mathhighschool/mathbook.html', { waitUntil: 'load' });
await new Promise(r => setTimeout(r, 1200));
await page.evaluate(() => window.BOOK_GO(10));
await new Promise(r => setTimeout(r, 500));

// 读取真实正文栏宽度与字号
const dims = await page.evaluate(() => {
  const pane = document.getElementById('pane');
  const cs = getComputedStyle(pane);
  const w = pane.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  return { width: Math.round(w), fontSize: cs.fontSize, padding: cs.padding };
});
console.log('pane', dims);

const data = JSON.parse(fs.readFileSync('build/pieces.json', 'utf8'));
const css = fs.readFileSync('src2/style.css', 'utf8');
const body = data.pieces.map(p => `<div class="mpiece" data-i="${p.i}">${p.html}</div>`).join('\n');
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style>
<style>
  body { margin: 0; background: #fff; }
  .measure { width: ${dims.width}px; font-size: ${dims.fontSize}; }
  .mpiece { display: flow-root; }
</style></head><body><div class="measure pane" style="overflow:visible;height:auto;padding:0">${body}</div></body></html>`;
fs.writeFileSync('/tmp/measure.html', html);

const m = await browser.newPage();
await m.setViewport({ width: 1440, height: 900 });
await m.goto('file:///tmp/measure.html', { waitUntil: 'load' });
const heights = await m.evaluate(() => {
  const out = {};
  document.querySelectorAll('.mpiece').forEach(el => {
    out[el.getAttribute('data-i')] = Math.round(el.getBoundingClientRect().height);
  });
  return out;
});
await browser.close();
const arr = [];
Object.keys(heights).forEach(k => { arr[+k] = heights[k]; });
fs.writeFileSync('build/block-heights.json', JSON.stringify({ width: dims.width, fontSize: dims.fontSize, at: new Date().toISOString(), heights: arr }));
const vals = arr.filter(v => v > 0);
console.log(`量出 ${vals.length} 块高度 · 中位 ${vals.sort((a, b) => a - b)[Math.floor(vals.length / 2)]}px · 最大 ${Math.max(...vals)}px`);
