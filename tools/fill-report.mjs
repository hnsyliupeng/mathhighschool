import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
const exe = await chromium.executablePath();
const browser = await puppeteer.launch({ args: chromium.args, executablePath: exe, headless: true });
const page = await browser.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await page.setViewport({ width: 1440, height: 900 });
await page.goto('file:///home/user/mathhighschool/mathbook.html', { waitUntil: 'load' });
await new Promise(r => setTimeout(r, 1200));
const res = await page.evaluate(() => {
  const out = [];
  const total = window.PAGES_META.total;
  for (let i = 1; i < total - 1; i++) {
    window.BOOK_GO(i);
    const pane = document.getElementById('pane');
    if (!pane) continue;
    const wide = [...pane.querySelectorAll('.math, .math-block')].some(el => el.scrollWidth > pane.clientWidth + 4);
    const pr = pane.getBoundingClientRect();
    const kids = [...pane.children];
    const bottom = kids.length ? Math.max(...kids.map(k => k.getBoundingClientRect().bottom)) : pr.top;
    out.push([i, (bottom - pr.top + pane.scrollTop) / pr.height, wide ? 1 : 0]);
  }
  return out;
});
const ratios = res.map(r => r[1]);
ratios.sort((a, b) => a - b);
const q = p => ratios[Math.floor(ratios.length * p)].toFixed(2);
const over = res.filter(r => r[1] > 1.0).length;
const empty = res.filter(r => r[1] < 0.6).length;
const wide = res.filter(r => r[2]).length;
console.log(`pages ${res.length} · 中位填充 ${q(0.5)} · p25 ${q(0.25)} · p75 ${q(0.75)} · p95 ${q(0.95)} · max ${ratios[ratios.length - 1].toFixed(2)}`);
console.log('over pages:', res.filter(r=>r[1]>1.02).map(r=>r[0]+':'+r[1].toFixed(2)).join(','));
console.log(`溢出滚动 ${over} 页 · 内容不足半页 ${empty} 页 · 公式横向溢出 ${wide} 页`);
if (wide) console.log('wide pages:', res.filter(r => r[2]).map(r => r[0]).slice(0, 20).join(','));
if (errs.length) console.log('ERRORS', [...new Set(errs)].slice(0, 5));
await browser.close();
