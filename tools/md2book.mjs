/* =============================================================
   tools/md2book.mjs · 把 MathBook 全部章节 md 编译成一本书的数据
   流程：
     1) 每个 Markdown 块 → 一个 piece（html）
     2) 若有 build/block-heights.json（由 tools/measure-pieces.mjs 用
        真实浏览器量出每块高度），按真实高度分页；否则按字数估算
     3) 输出 build/book-data.json
   ============================================================= */
import fs from 'fs';
import path from 'path';
import { parseMarkdown, toSections, blocksToHtml } from './md.mjs';
import { getUnknown, resetUnknown } from './latex.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, 'content');

const META = {
  '01': { short: '方程求解', motto: '先判断，再变形：方程的解法来自结构。', scene: 'eq' },
  '02': { short: '集合', motto: '把对象装进括号，再用运算拆开。', scene: 'set' },
  '03': { short: '不等式', motto: '不等也是一种秩序：范围、边界与最优。', scene: 'ineq' },
  '04': { short: '函数', motto: '一个输入对应一个输出，图像即性格。', scene: 'func' },
  '05': { short: '基本计算', motto: '对数与复数：所有计算的底层刻度。', scene: 'calc' },
  '06': { short: '三角恒等变换', motto: '圆上的一点，转出全部公式。', scene: 'trig' },
  '07': { short: '平面向量', motto: '把方向变成可加、可乘的数。', scene: 'vec' },
  '08': { short: '立体几何', motto: '在纸面上转动一个真实的空间。', scene: 'solid' },
  '09': { short: '空间向量', motto: '建系之后，几何问题变成方程。', scene: 'vec3' },
  '10': { short: '解析几何', motto: '圆锥一截，三种曲线，一套方程。', scene: 'conic' },
  '11': { short: '数列', motto: '离散的点，连成可预测的节奏。', scene: 'seq' },
  '12': { short: '导数', motto: '切线是函数在一点上的性格切片。', scene: 'deriv' },
  '13': { short: '统计', motto: '用样本的形状，猜测总体的样子。', scene: 'stat' },
  '14': { short: '概率', motto: '把所有可能铺开，再数一数。', scene: 'prob' },
  '15': { short: '组合计数', motto: '数路径，就是数选择。', scene: 'comb' },
  '16': { short: '线性规划', motto: '可行域里找一个最值顶点。', scene: 'lp' },
  '17': { short: '数论', motto: '整数的纹理：同余、素数、整除。', scene: 'numth' },
  '18': { short: '常用三角函数值', motto: '把常用的数排成可以查阅的形状。', scene: 'table' },
  '19': { short: '应试要求', motto: '把踩过的坑写下来，就是提分点。', scene: 'exam' },
  '99': { short: '高等数学', motto: '越过高考边界，看一眼更大的结构。', scene: 'higher' },
};
const ORDER = ['01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','99'];

const TARGET = 780;          // 每页正文的目标高度（px，1440×900 版式下）
const HARD_MAX = 900;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const plain = html => html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

/* 把长列表按 <li> 边界切成多块 */
function splitListHtml(html, limit) {
  const m = /^<(ul|ol)([^>]*)>([\s\S]*)<\/\1>$/.exec(html);
  if (!m) return [html];
  const tag = m[1], attrs = m[2];
  const items = [];
  const re = /<li>[\s\S]*?<\/li>/g;
  let x, last = 0;
  while ((x = re.exec(m[3]))) {
    if (x.index > last) items.push(m[3].slice(last, x.index));
    items.push(x[0]);
    last = x.index + x[0].length;
  }
  if (last < m[3].length) items.push(m[3].slice(last));
  const chunks = [];
  let buf = '', len = 0;
  for (const it of items) {
    if (len && len + it.length > limit) { chunks.push(buf); buf = ''; len = 0; }
    buf += it; len += it.length;
  }
  if (buf) chunks.push(buf);
  return chunks.map(c => `<${tag}${attrs}>${c}</${tag}>`);
}

/* 估算高度（没有实测数据时的兜底） */
function estimate(html) {
  const t = plain(html).length;
  const math = (html.match(/<span class="math/g) || []).length;
  const disp = (html.match(/math-block/g) || []).length;
  const rows = (html.match(/<tr>/g) || []).length;
  const li = (html.match(/<li>/g) || []).length;
  const img = (html.match(/md-img/g) || []).length;
  return 10 + t * 0.62 + math * 9 + disp * 26 + rows * 26 + li * 3 + img * 60;
}

function main() {
  resetUnknown();
  const heightFile = path.join(ROOT, 'build/block-heights.json');
  const measured = fs.existsSync(heightFile) ? JSON.parse(fs.readFileSync(heightFile, 'utf8')) : null;
  const pieces = [];

  function addPiece(html, meta) {
    const i = pieces.length;
    pieces.push(Object.assign({ i, html, h: (measured && measured.heights[i]) || estimate(html) }, meta));
    return i;
  }

  const chapters = [];
  const chapterRanges = [];

  for (const no of ORDER) {
    const file = fs.readdirSync(SRC).find(f => f.startsWith(no + '.') && f.endsWith('.md'));
    if (!file) { console.warn('missing chapter', no); continue; }
    const md = fs.readFileSync(path.join(SRC, file), 'utf8');
    const blocks = parseMarkdown(md);
    const h1 = blocks.find(b => b.type === 'heading' && b.level === 1);
    const title = h1 ? (h1.plain || h1.text) : file.replace(/\.md$/, '');
    const meta = META[no] || { short: title, motto: '', scene: 'fallback' };
    const secs = toSections(blocks.filter(b => !(b.type === 'heading' && b.level === 1)), title);

    const seen = new Map();
    secs.forEach(s => {
      const base = s.title || title;
      const n = (seen.get(base) || 0) + 1;
      seen.set(base, n);
      s.title = n === 1 ? base : base + '（续' + (n > 2 ? n - 1 : '') + '）';
    });

    const chPieces = [];
    const push = (html, kind, title2) => {
      const id = addPiece(html, { ch: no, kind, sec: title2 == null ? null : title2 });
      const rec = { id, kind, sec: title2 == null ? null : title2 };
      chPieces.push(rec);
      return rec;
    };

    // 章卷首
    push(`<div class="ch-open"><div class="ch-no">${no}</div><div class="ch-open-t"><h1>${esc(title)}</h1><p class="ch-motto">${esc(meta.motto)}</p></div></div>`, 'chapter-open', title);

    secs.forEach((sec) => {
      const lvl = sec.level || 2;
      if (sec.title !== title && sec.html) push(`<h3 class="sec-h lvl${lvl}"><span class="sec-mark">§</span>${sec.html}</h3>`, 'sec-head', sec.title);
      else if (sec.title !== title) push(`<h3 class="sec-h lvl${lvl}"><span class="sec-mark">§</span>${esc(sec.title)}</h3>`, 'sec-head', sec.title);
      for (const b of sec.blocks) {
        const html = blocksToHtml([b]);
        if (!html.trim()) continue;
        if (html.length > 2200) {
          const parts = splitListHtml(html, 1500);
          parts.forEach(p => push(p, 'block', sec.title));
        } else {
          push(html, 'block', sec.title);
        }
      }
    });
    if (!chPieces.length) continue;
    chapterRanges.push({ no, title, meta, from: chPieces[0].id, to: chPieces[chPieces.length - 1].id });
  }

  // ---- 分页：按实测/估算高度贪心装页 ----
  const pages = [];
  let chapterStart = 0;
  for (const range of chapterRanges) {
    const list = pieces.filter(p => p.ch === range.no);
    let buf = [], h = 0;
    const flush = () => {
      if (!buf.length) return;
      pages.push({ ch: range.no, chTitle: range.title, chShort: range.meta.short, html: buf.map(p => p.html).join('\n'), pieces: buf.slice(), secOf: buf[0].sec });
      buf = []; h = 0;
    };
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (buf.length && h + p.h > TARGET) {
        // 不让“小节标题”落在页尾
        let carry = [];
        while (buf.length && buf[buf.length - 1].kind === 'sec-head') carry.unshift(buf.pop());
        flush();
        carry.forEach(c => { buf.push(c); h += c.h; });
      }
      // 单块本身超高（大表格）时独占一页
      buf.push(p); h += p.h;
      if (h > HARD_MAX) flush();
    }
    flush();
    chapterStart = pages.length;
  }

  // ---- 合并过短的页（切块后留下的尾巴） ----
  const plainLen = h => h.replace(/<[^>]+>/g, '').length;
  pages.forEach(p => { p.words = plainLen(p.html); });
  for (let i = pages.length - 1; i >= 0; i--) {
    const p = pages[i];
    if (p.words >= 45) continue;
    const prev = pages[i - 1], next = pages[i + 1];
    if (prev && prev.ch === p.ch) {
      prev.html += '\n' + p.html; prev.words += p.words; pages.splice(i, 1);
    } else if (next && next.ch === p.ch) {
      next.html = p.html + '\n' + next.html; next.words += p.words; pages.splice(i, 1);
    }
  }

  // 组装章节元信息与页码
  const chMap = {};
  pages.forEach((p, i) => {
    p.abs = i;
    if (!chMap[p.ch]) chMap[p.ch] = { id: p.ch, no: p.ch, title: p.chTitle, short: p.chShort, motto: chapterRanges.find(r => r.no === p.ch).meta.motto, scene: chapterRanges.find(r => r.no === p.ch).meta.scene, sections: [], first: i, last: i, count: 0 };
    const c = chMap[p.ch];
    c.last = i; c.count++;
    if (p.secOf && !c.sections.some(s => s.t === p.secOf)) c.sections.push({ t: p.secOf, page: i });
  });
  const chaptersOut = ORDER.filter(no => chMap[no]).map(no => chMap[no]);

  // 计算每页的 words 与续页标记
  const chPageSeen = {};
  pages.forEach(p => {
    p.words = plain(p.html).length;
    p.kind = 'text';
    const c = chMap[p.ch];
    const idx = p.abs - c.first;
    const prev = pages[p.abs - 1];
    p.cont = !!(prev && prev.ch === p.ch && prev.secOf === p.secOf && idx > 0);
    delete p.pieces;
  });
  chaptersOut.forEach(c => {
    c.sections = c.sections.map(s => ({ t: s.t, page: s.page }));
  });

  const unknown = getUnknown();
  if (unknown.length) console.warn('未识别宏：', unknown.join(', '));

  const total = pages.reduce((a, p) => a + p.words, 0);
  const out = {
    title: '高中数学笔记',
    subtitle: '3D 互动全书',
    author: 'liuhaopeng543',
    source: 'github.com/liuhaopeng543/MathBook',
    license: 'MIT',
    built: new Date().toISOString().slice(0, 10),
    chapters: chaptersOut,
    pages,
    stats: { pages: pages.length, words: total, chapters: chaptersOut.length, pieces: pieces.length },
  };
  fs.mkdirSync(path.join(ROOT, 'build'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'build/book-data.json'), JSON.stringify(out));
  fs.writeFileSync(path.join(ROOT, 'build/pieces.json'), JSON.stringify({
    target: TARGET, width: measured && measured.width, fontSize: measured && measured.fontSize,
    pieces: pieces.map(p => ({ i: p.i, html: p.html })),
  }));
  console.log(`${measured ? '实测分页' : '估算分页'}：${pages.length} 页 · ${chaptersOut.length} 章 · ${pieces.length} 块 · 正文约 ${(total / 1000).toFixed(1)} 千字`);
  console.log('写出 build/book-data.json 与 build/pieces.json');
}

main();
