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

/* 3D 模型舞台：存在、有仪表、画布在自动动 */
await wait(900);
const stage1 = await page.evaluate(() => {
  const cv = document.getElementById('prob-canvas');
  const r = cv.getBoundingClientRect();
  let sig = 0; const d = cv.toDataURL();
  for (let i = 0; i < d.length; i += 97) sig += d.charCodeAt(i);
  return { w: r.width, h: r.height, name: document.getElementById('prob-model-name').textContent, gauges: document.querySelectorAll('#prob-gauges .gauge').length, sig };
});
await wait(800);
const stage2 = await page.evaluate(() => {
  const cv = document.getElementById('prob-canvas');
  let sig = 0; const d = cv.toDataURL();
  for (let i = 0; i < d.length; i += 97) sig += d.charCodeAt(i);
  return { sig, gauges: document.getElementById('prob-gauges').textContent };
});
if (stage1.w < 300 || stage1.h < 180) fail('3D 模型舞台尺寸异常'); else ok(`3D 模型舞台 ${Math.round(stage1.w)}×${Math.round(stage1.h)} · ${stage1.name}`);
if (stage1.gauges < 1) fail('模型无仪表'); else ok('模型仪表已回吐：' + stage2.gauges.slice(0, 44));
if (stage1.sig === stage2.sig) fail('模型画布未自动运动'); else ok('模型画布自动运动中（无需点击）');

/* 全量模型构建：150 道题逐个 describe+build（首步与末步）不得报错、不得空图 */
const modelCheck = await page.evaluate(() => {
  const holder = document.createElement('div');
  holder.style.cssText = 'width:700px;height:500px;position:fixed;left:-9999px;top:0';
  document.body.appendChild(holder);
  const cv = document.createElement('canvas'); holder.appendChild(cv);
  const st = new window.Ink3D.Studio(cv, { yaw: -0.3, pitch: 0.2, zoom: 1 });
  st.setPalette({ ink: '#2b2823', inkLight: '#6f675a', paper: '#fbf6e9', tint: '#efdcc6', accent: '#d9503a', accent2: '#38659f' });
  st.showLabels = true;
  st.setScene(() => ({ items: [], fit: 1 })); st.render();
  const bad = []; let bespoke = 0;
  window.PROBLEMS.forEach(pr => {
    try {
      const m = window.PROBLEM_MODELS.describe(pr);
      if (!m || (m.kind === 'scene' && !m.mode)) { bad.push(pr.id + ':无模型'); return; }
      if (m.kind !== 'scene') bespoke++;
      [0, pr.steps.length].forEach(step => {
        const r = window.PROBLEM_MODELS.build(0.7, { st, prob: pr, model: m, step, total: pr.steps.length });
        if (!r || !r.items || r.items.length < 3) bad.push(pr.id + ':空图');
      });
    } catch (e) { bad.push(pr.id + ':' + e.message); }
  });
  st.destroy(); holder.remove();
  return { bad: bad.slice(0, 8), bespoke };
});
if (modelCheck.bad.length) fail('全量模型构建问题：' + modelCheck.bad.join('；')); else ok(`全量模型构建：${info.n} 道题 × 首/末步全部有几何模型（专属几何模型 ${modelCheck.bespoke} 道）`);

/* 截图同款：左焦点椭圆切线题，必须有 FM·AB 验证 */
await page.evaluate(() => { const i = document.getElementById('prob-filter'); i.value = '左焦点 F 任意做一条直线'; i.dispatchEvent(new Event('input', { bubbles: true })); });
await wait(350);
await page.evaluate(() => { const b = document.querySelector('.prob-item'); if (b) b.click(); });
let conic = { name: '', gauges: '' };
for (let i = 0; i < 12; i++) {
  await wait(500);
  conic = await page.evaluate(() => ({
    name: document.getElementById('prob-model-name').textContent,
    action: document.getElementById('prob-model-action').textContent,
    gauges: document.getElementById('prob-gauges').textContent,
  }));
  if (/FM·AB/.test(conic.gauges)) break;
}
if (!/椭圆/.test(conic.name)) fail('左焦点题未生成椭圆模型：' + conic.name); else ok('左焦点题模型：' + conic.name);
if (!/FM·AB/.test(conic.gauges)) fail('椭圆切线模型缺 FM·AB 验证：' + conic.gauges); else ok('仪表验证 FM·AB：' + conic.gauges.match(/FM·AB[^ ]* ?≈ ?0|FM·AB[^ ]+/)[0]);
await page.evaluate(() => { const i = document.getElementById('prob-filter'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); });
await wait(300);
await page.evaluate(() => { const b = document.querySelector('.prob-item'); if (b) b.click(); });
await wait(900);

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

/* 同步推导：模型字幕步号与公式步号锁死；点哪一步公式，模型跳哪一步 */
const syncA = await page.evaluate(() => ({
  no: document.getElementById('prob-stepno').textContent,
  sync: document.getElementById('prob-sync-text').textContent,
}));
const mNo = /第 (\d+) \//.exec(syncA.no), mSync = /同步推导 (\d+)\//.exec(syncA.sync);
if (!mNo || !mSync || mNo[1] !== mSync[1]) fail(`同步字幕与公式步号不一致：${syncA.no} vs ${syncA.sync}`); else ok(`同步推导锁定：公式第 ${mNo[1]} 步 = 模型字幕第 ${mSync[1]} 步`);
await page.evaluate(() => { const els = document.querySelectorAll('.pstep'); if (els[0]) els[0].click(); });
await wait(450);
const syncB = await page.evaluate(() => ({
  no: document.getElementById('prob-stepno').textContent,
  sync: document.getElementById('prob-sync-text').textContent,
  action: document.getElementById('prob-model-action').textContent,
}));
if (!/第 1 \//.test(syncB.no) || !/同步推导 1\//.test(syncB.sync)) fail('点公式步未同步跳步：' + syncB.no + ' / ' + syncB.sync); else ok('点公式即跳模型：' + syncB.action.slice(0, 26));

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
