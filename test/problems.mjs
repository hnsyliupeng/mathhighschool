/* =============================================================
   test/problems.mjs · 逐题动画解析回归
   断言：题目提取量、每题有解析步、播放器单步/自动播放推进、
   选题跳到原页、本页芯片过滤、控制台无报错。
   用法：LD_LIBRARY_PATH=/tmp/nssstub node test/problems.mjs
   ============================================================= */
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url)) + '/..';
const exe = await chromium.executablePath();
const browser = await puppeteer.launch({
  args: [...chromium.args, '--force-device-scale-factor=1'],
  executablePath: exe, headless: true,
});
const page = await browser.newPage();
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await page.setViewport({ width: 1440, height: 900 });
await page.goto('file://' + root + '/mathbook.html', { waitUntil: 'load' });
const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(1300);

let problems = 0;
const ok = m => console.log('  ✓ ' + m);
const fail = m => { problems++; console.log('  ✗ ' + m); };

const info = await page.evaluate(() => {
  const ps = window.PROBLEMS || [];
  const chs = new Set(ps.map(p => p.ch));
  return {
    n: ps.length, chapters: chs.size,
    noSteps: ps.filter(p => !p.steps.length).length,
    first: ps.length ? { steps: ps[0].steps.length, page: ps[0].page } : null,
  };
});
console.log(`\n[提取] ${info.n} 道题 · 覆盖 ${info.chapters} 章 · 无解析步 ${info.noSteps} 道`);
if (info.n < 100) fail('题目提取不足 100 道'); else ok('≥100 道题被提取');
if (info.noSteps > 0) fail('存在没有解析步的题'); else ok('每道题都有 ≥1 步原文解析');
if (info.chapters < 12) fail('覆盖章节不足'); else ok('覆盖 ≥12 章');

/* 打开播放器并自动播放第一题 */
await page.evaluate(() => document.getElementById('btn-problems').click());
await wait(500);
const opened = await page.evaluate(() => ({
  open: document.getElementById('prob-layer').classList.contains('open'),
  items: document.querySelectorAll('.prob-item').length,
  stmt: document.getElementById('prob-stmt').textContent.length,
}));
if (!opened.open || opened.items < 50) fail('播放器列表未打开'); else ok(`播放器打开，列表 ${opened.items} 项`);
if (opened.stmt < 10) fail('题干未渲染'); else ok('题干已渲染');

/* 单步推进 */
const s0 = await page.evaluate(() => document.getElementById('prob-stepno').textContent);
await page.evaluate(() => document.getElementById('prob-next').click());
await wait(250);
const s1 = await page.evaluate(() => ({
  no: document.getElementById('prob-stepno').textContent,
  cur: document.querySelectorAll('.pstep.cur').length,
  fill: document.getElementById('prob-fill').style.width,
}));
if (s1.no === s0 || !s1.cur) fail('下一步未推进'); else ok(`单步推进：${s0} → ${s1.no}，进度 ${s1.fill}`);

/* 自动播放推进 */
await page.evaluate(() => { document.getElementById('prob-speed').value = '1500'; document.getElementById('prob-replay').click(); });
await wait(3400);
const s2 = await page.evaluate(() => document.getElementById('prob-stepno').textContent);
if (!/第 [2-9]/.test(s2)) fail('自动播放未推进到第 2 步以后：' + s2); else ok('自动播放推进到 ' + s2);
await page.evaluate(() => document.getElementById('prob-play').click()); // 暂停

/* 选一道靠后的题：应跳到其原页 */
const jump = await page.evaluate(() => {
  const items = document.querySelectorAll('.prob-item');
  const b = items[items.length - 1];
  const before = window.BOOK.state.page;
  b.click();
  return { before, after: window.BOOK.state.page, title: document.getElementById('prob-kicker').textContent };
});
await wait(400);
if (jump.after === jump.before && jump.before !== 0) fail('选题未跳页'); else ok(`选题跳页 ${jump.before} → ${jump.after}（${jump.title.slice(0, 18)}）`);

/* 关闭浮层，去一道有题的页点本页芯片 */
await page.evaluate(() => document.getElementById('prob-close').click());
await wait(200);
const chip = await page.evaluate(() => {
  const p = window.PROBLEMS[0];
  window.BOOK_GO(p.page);
  return new Promise(res => setTimeout(() => {
    const c = document.querySelector('[data-probs]');
    if (!c) return res(null);
    c.click();
    setTimeout(() => res({
      meta: document.getElementById('prob-meta').textContent,
      items: document.querySelectorAll('.prob-item').length,
    }), 300);
  }, 600));
});
if (!chip || chip.items < 1) fail('本页芯片过滤失败'); else ok('本页题目芯片：' + chip.meta);

if (errs.length) fail('控制台报错：' + errs.slice(0, 3).join(' | '));
else ok('控制台无报错');

await page.screenshot({ path: root + '/test/out/pages/prob-player.png' });
await browser.close();
console.log(problems ? `\nPROBLEMS TEST FAILED · ${problems} 个问题` : '\nPROBLEMS TEST OK · 逐题动画解析全部通过');
process.exit(problems ? 1 : 0);
