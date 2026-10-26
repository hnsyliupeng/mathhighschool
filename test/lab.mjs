/* =============================================================
   test/lab.mjs · 「机器实验室」回归
   验证：每台有规格的机器——拖动控件后，仪表读数按同一模型变化；
   推过头预设触发裁决；触发按钮真的改变模型状态；透视开关有效。
   用法：LD_LIBRARY_PATH=/tmp/nssstub node test/lab.mjs
   ============================================================= */
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

const FILE = 'file:///home/user/mathhighschool/mathbook.html';
const problems = [];
const fail = m => { problems.push(m); console.log('  ✗ ' + m); };
const ok = m => console.log('  ✓ ' + m);
const wait = ms => new Promise(r => setTimeout(r, ms));

const exe = await chromium.executablePath();
const browser = await puppeteer.launch({ args: [...chromium.args, '--force-device-scale-factor=1'], executablePath: exe, headless: true });
const page = await browser.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await page.setViewport({ width: 1440, height: 900 });
await page.goto(FILE, { waitUntil: 'load' });
await wait(1000);

async function gauges() {
  return page.evaluate(() => {
    const g = {};
    document.querySelectorAll('#lab-gauges .gauge').forEach(el => {
      const k = el.querySelector('i').textContent, v = el.querySelector('b').textContent;
      g[k] = v;
    });
    const vd = document.getElementById('lab-verdict');
    return { g, verdict: vd && !vd.hidden ? vd.textContent : null, danger: vd ? vd.classList.contains('danger') : false, labHidden: document.getElementById('lab').hidden };
  });
}
async function setRange(id, val) {
  await page.evaluate(([id, val]) => {
    const inp = document.querySelector(`[data-param="${id}"]`);
    inp.value = val;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  }, [id, val]);
  await wait(500);
}

/* 1. 实验室覆盖：逐章进首个有规格的模式 */
const cover = await page.evaluate(() => {
  const labs = window.LABS || {};
  let specs = 0, modes = 0;
  Object.values(labs).forEach(sc => { modes += Object.keys(sc).length; specs += Object.values(sc).filter(m => m.controls && m.controls.length).length; });
  return { sceneSpecs: Object.keys(labs).length, modes, withControls: specs };
});
console.log(`\n[覆盖] ${cover.sceneSpecs} 个场景 · ${cover.modes} 台机器 · ${cover.withControls} 台带控件`);
if (cover.sceneSpecs < 18) fail('实验室场景覆盖不足'); else ok('≥18 章有实验室');
if (cover.withControls < 30) fail('带控件机器不足 30'); else ok('≥30 台带控件机器');

/* 2. 方程：改 c，Δ 与根同步变；推过头 Δ<0 */
await page.evaluate(() => window.BOOK_GO(5)); // 第 1 章首页
await wait(900);
let a = await gauges();
if (a.labHidden) fail('方程页实验室未显示'); else ok('方程实验室已挂载');
const d0 = a.g['Δ=b²−4ac'];
await setRange('c', 1);
let b = await gauges();
if (b.g['Δ=b²−4ac'] === d0) fail('改 c 后 Δ 未变'); else ok(`拖 c：Δ ${d0} → ${b.g['Δ=b²−4ac']}，根=${b.g['实根']}`);
if (!b.verdict || !b.danger) fail('c=1（Δ<0）未触发推过头裁决'); else ok('推过头裁决触发：' + b.verdict.slice(0, 24) + '…');
await page.evaluate(() => { document.querySelector('[data-brk]').click(); });
await wait(300);
let c2 = await gauges();
if (!c2.verdict) fail('推过头按钮后无裁决'); else ok('推过头按钮有效');

/* 3. 圆锥曲线：β 跨过 α，类型翻转 */
await page.evaluate(() => { const ch = window.BOOK.raw.chapters.find(x => x.scene === 'conic'); window.BOOK_GO(4 + ch.first); });
await wait(900);
let e0 = await gauges();
await setRange('beta', 15);
let e1 = await gauges();
if (!e0.g['曲线类型'] || !e1.g['曲线类型']) fail('圆锥曲线仪表缺失');
else if (e0.g['曲线类型'] === e1.g['曲线类型']) fail(`β 66→15 类型未变（${e0.g['曲线类型']}）`);
else ok(`拖 β：${e0.g['曲线类型']} → ${e1.g['曲线类型']}（e ${e0.g['离心率 e=cosβ/cosα']}→${e1.g['离心率 e=cosβ/cosα']}）`);

/* 4. 导数：拖 x0，斜率变号 */
await page.evaluate(() => { const ch = window.BOOK.raw.chapters.find(x => x.scene === 'deriv'); window.BOOK_GO(4 + ch.first); });
await wait(900);
await setRange('x0', -0.5);
let d1 = await gauges();
await setRange('x0', 2);
let d2 = await gauges();
const k1 = parseFloat(d1.g["f'(x₀)=切线斜率"]), k2 = parseFloat(d2.g["f'(x₀)=切线斜率"]);
if (!(k1 < 0 && k2 > 0)) fail(`导数斜率未变号（${k1} → ${k2}）`); else ok(`拖 x₀：f′ ${k1} → ${k2}（变号即单调翻转）`);

/* 5. 复数乘法触发按钮 */
await page.evaluate(() => { const ch = window.BOOK.raw.chapters.find(x => x.scene === 'calc'); window.BOOK_GO(4 + ch.first); });
await wait(700);
await page.evaluate(() => { document.querySelector('[data-mode="rot"]').click(); });
await wait(700);
let r0 = await gauges();
await page.evaluate(() => { document.querySelector('[data-trig="k"]').click(); });
await wait(300);
let r1 = await gauges();
if (r0.g['辐角增量'] === r1.g['辐角增量']) fail('乘 i 触发后辐角未变'); else ok(`触发 ×i：辐角增量 ${r0.g['辐角增量']} → ${r1.g['辐角增量']}`);

/* 6. 透视内部开关 */
const xr = await page.evaluate(() => {
  const cb = document.querySelector('[data-xray]');
  cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true }));
  return window.BOOK.studio.seeThrough;
});
if (!xr) fail('透视开关未生效'); else ok('透视内部开关生效');

/* 7. 抽查每章实验室不报错地拖一遍首控件 */
const sweep = await page.evaluate(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const bad = [];
  for (const ch of window.BOOK.raw.chapters) {
    window.BOOK_GO(4 + ch.first);
    await wait(320);
    const lab = document.getElementById('lab');
    if (!lab || lab.hidden) continue;
    const inp = document.querySelector('[data-param]');
    if (inp) {
      const mid = (parseFloat(inp.min) + parseFloat(inp.max)) / 2;
      inp.value = mid; inp.dispatchEvent(new Event('input', { bubbles: true }));
      await wait(240);
      const gv = document.querySelectorAll('#lab-gauges .gauge b');
      if (!gv.length) bad.push(ch.scene + ':无仪表');
    }
  }
  return bad;
});
if (sweep.length) fail('逐章抽查问题：' + sweep.join('；')); else ok('逐章拖控件：仪表均有读数');

if (errs.length) fail('控制台报错：' + errs.slice(0, 3).join(' | '));
else ok('控制台无报错');

await browser.close();
console.log(problems.length ? `\nLAB TEST FAILED · ${problems.length} 个问题` : '\nLAB TEST OK · 机器实验室全部通过');
process.exit(problems.length ? 1 : 0);
