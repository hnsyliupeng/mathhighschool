/* 视觉抽查：把指定页（或按关键字自动定位）截成 png */
import fs from 'fs';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

const args = process.argv.slice(2);
const exe = await chromium.executablePath();
const browser = await puppeteer.launch({ args: chromium.args, executablePath: exe, headless: true });
const page = await browser.newPage();
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.4 });
await page.goto('file:///home/user/mathhighschool/mathbook.html', { waitUntil: 'load' });
await new Promise(r => setTimeout(r, 1500));
fs.mkdirSync('test/out/pages', { recursive: true });

const auto = await page.evaluate(() => {
  const out = {};
  const find = (fn) => {
    const P = window.BOOK.pages;
    for (let i = 0; i < P.length; i++) {
      window.BOOK_GO(i);
      const pane = document.getElementById('pane');
      if (pane && fn(pane, i)) return i;
    }
    return -1;
  };
  out.comment = find((pane) => pane.querySelector('.md-comment'));
  out.img = find((pane) => pane.querySelector('.md-img'));
  out.table = find((pane) => pane.querySelector('table'));
  out.bigmath = find((pane) => [...pane.querySelectorAll('.math-block')].some(el => el.scrollWidth > el.clientWidth + 2));
  return out;
});
console.log('auto', auto);

const list = args.length ? args.map(Number) : [0, 1, 2, 5, 8];
for (const [k, v] of Object.entries(auto)) if (v > 0) list.push(v);
for (const n of [...new Set(list)]) {
  await page.evaluate(i => window.BOOK_GO(i), n);
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: `test/out/pages/p${String(n).padStart(3, '0')}.png` });
  const info = await page.evaluate(() => {
    const pane = document.getElementById('pane');
    return {
      p: window.BOOK.state.page,
      scroll: pane ? pane.scrollHeight - pane.clientHeight : null,
      w: pane ? pane.clientWidth : null,
      label: document.getElementById('page-label').textContent.trim(),
    };
  });
  console.log(n, JSON.stringify(info));
}
if (errs.length) console.log('ERRORS', [...new Set(errs)].slice(0, 6).join('\n'));
await browser.close();
