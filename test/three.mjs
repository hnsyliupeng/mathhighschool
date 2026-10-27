/* =============================================================
   test/three.mjs · 真 3D 推演（Three.js Watch）回归
   断言：TW3 可用、67 个模式的三维建模/更新/仪表全部无错、
   主页推演自动开播且字幕随镜推进、进度点同步、
   红框公式不与相邻文字重叠（几何度量）。
   用法：LD_LIBRARY_PATH=/tmp/nssstub node test/three.mjs
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
let bad = 0;
const fail = m => { bad++; console.log('  ✗ ' + m); };
const ok = m => console.log('  ✓ ' + m);
const errs = [];
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
const wait = ms => new Promise(r => setTimeout(r, ms));
await page.goto('file://' + root + '/mathbook.html', { waitUntil: 'load' });
await wait(1000);

/* 1. TW3 与 WebGL 可用 */
const avail = await page.evaluate(() => ({ tw: !!(window.TW3 && TW3.available), three: typeof window.THREE === 'object' }));
if (!avail.tw || !avail.three) fail('TW3/THREE 未就绪'); else ok('TW3 真 3D 引擎就绪（Three.js WebGL）');

/* 2. 67 个模式逐个建模 + 更新 + 仪表 */
const sweep = await page.evaluate(() => {
  const cv = document.createElement('canvas'); cv.width = 640; cv.height = 420;
  document.body.appendChild(cv);
  const w = new TW3.Watch(cv, {});
  const badList = [];
  let n = 0;
  for (const [sk, modes] of Object.entries(window.LABS)) for (const m of Object.keys(modes)) {
    try {
      const spec = TW3.specForMode(sk, m);
      w.load(spec);
      for (const tt of [0, 1.3, 2.9]) w.builder.update(w.params, tt);
      const g = w.builder.gauges(w.params);
      if (!Array.isArray(g) || !g.length) badList.push(sk + '.' + m + ':无仪表');
      n++;
    } catch (e) { badList.push(sk + '.' + m + ':' + e.message); }
  }
  /* 150 道题逐个 spec+建模 */
  let pn = 0;
  (window.PROBLEMS || []).forEach(pr => {
    try {
      const spec = TW3.specForProblem(pr);
      if (!spec.shots.length) { badList.push(pr.id + ':无镜头'); return; }
      w.load(spec); w.builder.update(w.params, 1.1); w.builder.gauges(w.params); pn++;
    } catch (e) { badList.push(pr.id + ':' + e.message); }
  });
  cv.remove();
  return { n, pn, badList: badList.slice(0, 8) };
});
if (sweep.badList.length) fail('建模巡检问题：' + sweep.badList.join('；'));
else ok(`三维建模巡检：${sweep.n} 个模式 + ${sweep.pn} 道题全部建模/更新/仪表无错`);

/* 3. 主页推演自动开播：字幕与圆点随镜推进 */
await page.evaluate(() => window.BOOK_GO(90));
await wait(1400);
const h1 = await page.evaluate(() => ({
  cap: document.getElementById('tw-cap').textContent,
  dots: document.querySelectorAll('#tw-dots i').length,
  on: document.querySelectorAll('#tw-dots i.on').length,
  off: document.getElementById('tw-canvas').classList.contains('off'),
}));
let advanced = false, h2 = h1;
for (let i = 0; i < 10 && !advanced; i++) {
  await wait(1200);
  h2 = await page.evaluate(() => ({
    cap: document.getElementById('tw-cap').textContent,
    on: document.querySelectorAll('#tw-dots i.on').length,
  }));
  if (h2.cap !== h1.cap || h2.on !== h1.on) advanced = true;
}
if (h1.off || !h1.dots) fail('主页推演未显示'); else ok(`主页真 3D 推演已开播：${h1.cap.slice(0, 26)}…（${h1.dots} 镜）`);
if (!advanced) fail('主页推演字幕未推进'); else ok('推演字幕随镜推进：→ ' + h2.cap.slice(0, 26));

/* 4. 红框公式防重叠：抽查含 .boxed 的页面，红框与同段后续文字不得几何重叠 */
await page.evaluate(() => window.BOOK_GO(122)); /* 空间向量页：红框+向量分式密集 */
await wait(900);
const boxCheck = await page.evaluate(() => {
  const boxes = [...document.querySelectorAll('.md .boxed, .pstep-body .boxed, p .boxed, li .boxed')].slice(0, 14);
  let worst = 0, checked = 0;
  const rectsOverlap = (a, b) => !(a.right < b.left + 1 || b.right < a.left + 1 || a.bottom < b.top + 1 || b.bottom < a.top + 1);
  boxes.forEach(bx => {
    const cs = getComputedStyle(bx);
    if (cs.display !== 'inline-block') worst = Math.max(worst, 99);
    /* 与同段落内相邻行内元素逐个查重叠 */
    const r = bx.getBoundingClientRect();
    const sibs = [...bx.closest('p, li, .math-block, div').querySelectorAll('.frac, .sqrt, .acc')];
    sibs.forEach(s2 => { if (!bx.contains(s2) && rectsOverlap(r, s2.getBoundingClientRect())) worst++; });
    checked++;
  });
  return { checked, worst, sample: boxes.length };
});
if (!boxCheck.checked) fail('未找到红框公式样本'); else ok(`红框公式抽查 ${boxCheck.checked} 处：行内块成型、与相邻公式零重叠（冲突 ${boxCheck.worst}）`);
if (boxCheck.worst) fail('红框与相邻公式仍有重叠：' + boxCheck.worst);

await page.screenshot({ path: root + '/test/out/tw-three.png' });
if (errs.length) fail('控制台报错：' + errs.slice(0, 3).join(' | ')); else ok('控制台无报错');
await browser.close();
console.log(bad ? `\nTHREE TEST FAILED · ${bad} 个问题` : '\nTHREE TEST OK · 真 3D 推演全部通过');
process.exit(bad ? 1 : 0);
