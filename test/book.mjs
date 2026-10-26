/* =============================================================
   test/book.mjs · 真浏览器全书回归（Chromium / puppeteer-core）
   覆盖：结构 · 全部章节的 3D 展台与全部模式 · 交互 · 检索 · 表格浮层
   用法：LD_LIBRARY_PATH=/tmp/nssstub node test/book.mjs [章节号]
   ============================================================= */
import fs from 'fs';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

const FILE = 'file:///home/user/mathhighschool/mathbook.html';
const problems = [];
const fail = (msg) => { problems.push(msg); console.log('  ✗ ' + msg); };
const ok = (msg) => console.log('  ✓ ' + msg);
const wait = ms => new Promise(r => setTimeout(r, ms));

const exe = await chromium.executablePath();
const browser = await puppeteer.launch({ args: [...chromium.args, '--force-device-scale-factor=1'], executablePath: exe, headless: true });
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));
page.on('console', m => { if (m.type() === 'error') pageErrors.push('console: ' + m.text()); });
await page.setViewport({ width: 1440, height: 900 });
await page.goto(FILE, { waitUntil: 'load' });
await wait(1200);

/* ---------- 1. 结构 ---------- */
const meta = await page.evaluate(() => {
  const B = window.BOOK;
  const d = B.raw;
  return {
    total: B.pages.length,
    front: window.PAGES_META.front,
    content: d.stats.pages,
    chapters: d.chapters.map(c => ({ no: c.no, title: c.title, count: c.count, first: c.first, sections: c.sections.length })),
    sbChapters: document.querySelectorAll('.sb-ch').length,
    sbSecs: document.querySelectorAll('.sb-sec').length,
    chOptions: document.querySelectorAll('#ch-select option').length,
    words: d.stats.words,
    formulas: window.BOOK_STATS.formulas,
    scenes: Object.keys(window.SCENES).length,
  };
});
console.log(`\n[结构] ${meta.total} 页 = 5 卷首 + ${meta.content} 正文 + 1 后记 · ${meta.chapters.length} 章 · ${meta.words} 字 · ${meta.formulas} 处公式 · ${meta.scenes} 个场景`);
if (meta.total !== meta.front + meta.content + 1) fail(`总页数 ${meta.total} ≠ ${meta.front}+${meta.content}+1`);
else ok('总页数 = 卷首 + 正文 + 后记');
if (meta.chapters.length !== 20) fail(`章节数 ${meta.chapters.length}`);
else ok('20 章齐全');
if (meta.sbChapters !== 20) fail(`侧栏章节 ${meta.sbChapters}`);
else ok('侧栏 20 章');
const secSum = meta.chapters.reduce((a, c) => a + c.sections, 0);
if (meta.sbSecs !== secSum) fail(`侧栏小节 ${meta.sbSecs} ≠ ${secSum}`);
else ok(`侧栏小节 ${secSum} 条`);
if (meta.chOptions !== 21) fail(`章节下拉 ${meta.chOptions}`);
else ok('章节下拉 21 项（含封面）');
if (meta.words < 130000) fail(`正文字数 ${meta.words}`);
else ok(`正文 ${(meta.words / 1000).toFixed(1)} 千字`);

/* ---------- 2. 逐页正文检查 ---------- */
const pageAudit = await page.evaluate(() => {
  const out = [];
  const front = window.PAGES_META.front;
  for (let i = 0; i < window.BOOK.pages.length; i++) {
    window.BOOK_GO(i);
    const pane = document.getElementById('pane');
    if (!pane) continue;
    const txt = pane.textContent.replace(/\s+/g, '');
    out.push({
      i,
      txt: txt.length,
      bad: /\\[a-zA-Z]+|\$|@@M\d|tex-unk|undefined|NaN/.test(pane.textContent),
      overflowX: pane.scrollWidth > pane.clientWidth + 2,
      fill: pane.scrollHeight / Math.max(1, pane.clientHeight),
    });
  }
  return { front, out };
});
const { out: audit } = pageAudit;
const shortPages = audit.filter(p => p.txt < 40);
const badPages = audit.filter(p => p.bad);
const xPages = audit.filter(p => p.overflowX);
const tallPages = audit.filter(p => p.fill > 1.05);
console.log(`\n[正文] 检查 ${audit.length} 页：过短 ${shortPages.length} · 残留标记 ${badPages.length} · 横向溢出 ${xPages.length} · 需纵向滚动 ${tallPages.length}`);
if (shortPages.length) fail(`过短页：${shortPages.map(p => p.i).slice(0, 8).join(',')}`);
else ok('没有空页/占位页');
if (badPages.length) fail(`残留 LaTeX / 占位符：${badPages.map(p => p.i).slice(0, 8).join(',')}`);
else ok('无残留 LaTeX、$、占位符');
if (xPages.length) fail(`横向溢出页：${xPages.map(p => p.i).slice(0, 8).join(',')}`);
else ok('正文无横向溢出');
if (tallPages.length > audit.length * 0.08) fail(`纵向滚动页过多 ${tallPages.length}`);
else ok(`仅 ${tallPages.length} 页需要页内滚动（多为超大表格）`);

/* ---------- 3. 每章 3D 展台 + 全部模式 ---------- */
const chapterPages = await page.evaluate(() =>
  window.BOOK.raw.chapters.map(c => ({
    no: c.no, title: c.title, page: window.PAGES_META.front + c.first, scene: c.scene,
  })));
const only = process.argv[2];
console.log('\n[3D 展台]');
let modeCount = 0;
const blank = [];
for (const ch of chapterPages) {
  if (only && ch.no !== only) continue;
  await page.evaluate(n => window.BOOK_GO(n), ch.page);
  await wait(260);
  const modes = await page.evaluate(() => [...document.querySelectorAll('#viz-tools .chip')].map(b => b.getAttribute('data-mode')));
  let inks = [];
  for (let k = 0; k < modes.length; k++) {
    await page.evaluate(idx => {
      const chips = [...document.querySelectorAll('#viz-tools .chip')];
      if (chips[idx]) chips[idx].click();
    }, k);
    await wait(240);
    const ink = await page.evaluate(() => {
      const cv = document.querySelector('#viz canvas');
      if (!cv || !cv.width) return -1;
      const ctx = cv.getContext('2d');
      const st = cv.width * cv.height > 1e6 ? 2 : 1;   // 抽样步长
      let dark = 0, total = 0;
      const data = ctx.getImageData(0, 0, cv.width, cv.height).data;
      for (let i = 0; i < data.length; i += 4 * st) {
        total++;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        if (r + g + b < 600) dark++;
      }
      return total ? dark / total : -1;
    });
    inks.push(ink);
    modeCount++;
    if (ink < 0.002) blank.push(`${ch.no}/${modes[k]}=${ink.toFixed(4)}`);
  }
  const min = Math.min(...inks);
  const tag = min > 0.002 ? '✓' : '✗';
  console.log(`  ${tag} ${ch.no} ${ch.title} · ${modes.length} 模式 · 最低墨迹 ${min.toFixed(4)}`);
}
if (blank.length) fail(`空白展台：${blank.join(', ')}`);
else ok(`全部 ${modeCount} 个模式都画出了内容`);

/* ---------- 4. 交互 ---------- */
console.log('\n[交互]');
const inter = await page.evaluate(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const res = {};
  const go = window.BOOK_GO;
  go(73); await sleep(200);
  // 透视 / 标注
  document.getElementById('btn-see').click(); await sleep(120);
  res.see = document.body.classList.contains('see-through') || window.BOOK.state.seeThrough === true;
  document.getElementById('btn-labels').click(); await sleep(120);
  res.labels = window.BOOK.state.labels === false;
  // 配色
  const sw = [...document.querySelectorAll('.swatch')];
  sw[2].click(); await sleep(150);
  res.palette = window.BOOK.state.palette;
  res.accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  // 字号
  const before = window.BOOK.state.fontScale;
  document.querySelector('[data-font="1"]').click(); await sleep(100);
  res.font = window.BOOK.state.fontScale > before;
  // 检索
  document.getElementById('btn-search').click(); await sleep(120);
  const input = document.getElementById('search-input');
  input.value = '二面角';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(400);
  res.hits = document.querySelectorAll('#search-list .sr').length;
  const hit = document.querySelector('#search-list .sr');
  if (hit) hit.click();
  await sleep(300);
  res.jumped = window.BOOK.state.page;
  res.searchClosed = !document.getElementById('search-layer').classList.contains('open');
  // 目录跳转
  const sb = document.querySelector('.sb-ch[data-ch="12"]');
  sb.click(); await sleep(260);
  res.sidebarJump = window.BOOK.state.page;
  // 大表浮层
  let bigPage = -1;
  for (let i = 0; i < window.BOOK.pages.length; i++) {
    go(i);
    if (document.querySelector('.tb-wide .zoom-chip')) { bigPage = i; break; }
  }
  res.bigPage = bigPage;
  if (bigPage >= 0) {
    document.querySelector('.tb-wide .zoom-chip').click(); await sleep(200);
    res.bigOpen = document.getElementById('bigtable-layer').classList.contains('on');
    res.bigRows = document.querySelectorAll('#bigtable-panel table tr').length;
    document.getElementById('bigtable-layer').click();
    res.bigClosed = !document.getElementById('bigtable-layer').classList.contains('on');
  }
  // 键盘
  go(20); await sleep(150);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await sleep(200);
  res.keyNext = window.BOOK.state.page;
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  await sleep(200);
  res.keyBack = window.BOOK.state.page;
  // 刷新后记忆
  res.saved = JSON.parse(localStorage.getItem('mb3d') || '{}').page;
  return res;
});
if (inter.see) ok('透视开关生效'); else fail('透视开关无效');
if (inter.labels) ok('标注开关生效'); else fail('标注开关无效');
if (inter.palette === 2) ok(`配色切换生效（accent ${inter.accent || '—'}）`); else fail('配色切换无效');
if (inter.font) ok('字号 A+ 生效'); else fail('字号无效');
if (inter.hits > 0) ok(`检索“二面角”命中 ${inter.hits} 处`); else fail('检索无结果');
if (inter.jumped > 60) ok(`点击结果跳到第 ${inter.jumped + 1} 页`); else fail('检索结果跳转失败');
if (inter.searchClosed) ok('跳转后检索面板自动关闭'); else fail('检索面板未关闭');
if (inter.sidebarJump > 0) ok(`侧栏跳转第 12 章 → 第 ${inter.sidebarJump + 1} 页`); else fail('侧栏跳转失败');
if (inter.bigPage >= 0 && inter.bigOpen && inter.bigRows > 2) ok(`大表浮层打开（${inter.bigRows} 行）`);
else fail(`大表浮层异常 ${JSON.stringify(inter).slice(0, 120)}`);
if (inter.bigClosed) ok('大表浮层可关闭'); else fail('大表浮层关不掉');
if (inter.keyNext === 21 && inter.keyBack === 20) ok('方向键翻页正常'); else fail(`方向键异常 ${inter.keyNext}/${inter.keyBack}`);
if (typeof inter.saved === 'number') ok('localStorage 记忆页位'); else fail('未写入记忆');

/* ---------- 5. 零外部依赖 ---------- */
const html = fs.readFileSync('/home/user/mathhighschool/mathbook.html', 'utf8');
const ext = [];
if (/<script[^>]+src=/i.test(html)) ext.push('script src');
if (/<link[^>]+href=/i.test(html)) ext.push('link href');
if (/url\(\s*['"]?https?:/i.test(html)) ext.push('css url');
if (/@import/i.test(html)) ext.push('@import');
if (/<script[^>]*\ssrc=["']?https?:/i.test(html)) ext.push('remote script');
if (/<img[^>]*\ssrc=["']?https?:/i.test(html)) ext.push('remote img');
console.log('\n[单文件]');
if (ext.length) fail(`存在外部依赖：${ext.join(', ')}`); else ok(`零外部请求 · ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB`);

if (pageErrors.length) fail(`页面报错：${[...new Set(pageErrors)].slice(0, 5).join(' | ')}`);
else ok('控制台无报错');

await browser.close();
console.log('');
if (problems.length) {
  console.log(`BOOK TEST FAILED · ${problems.length} 个问题`);
  process.exit(1);
}
console.log(`BOOK TEST OK · ${meta.total} 页 · ${meta.chapters.length} 章 · ${secSum} 节 · ${modeCount} 个 3D 模式`);
