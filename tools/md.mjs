/* =============================================================
   tools/md.mjs · 构建期 Markdown → 结构化 HTML
   支持标题、嵌套列表、表格、分隔线、图片占位、行内/行间公式
   说明：源笔记的公式常常跨行书写（$...$ 跨 6~10 行），
   因此先全文切分数学片段，再按占位符解析 Markdown 结构。
   ============================================================= */
import { texToHtml } from './latex.mjs';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const stripTags = s => String(s).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const PH = /\u0001(\d+)\u0002/g;

/* ---------- 1. 全文切分数学片段 ---------- */
export function splitMath(src) {
  const store = [];
  let out = '', i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\' && src[i + 1] === '$') { out += '\\$'; i += 2; continue; }
    if (c === '$') {
      const dbl = src[i + 1] === '$';
      const start = i + (dbl ? 2 : 1);
      let j = start, close = -1;
      while (j < src.length) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '$') {
          if (dbl) { if (src[j + 1] === '$') { close = j; break; } j++; continue; }
          close = j; break;
        }
        j++;
      }
      if (close < 0) { out += c; i++; continue; }
      const body = src.slice(start, close);
      const end = close + (dbl ? 2 : 1);
      const multiline = /[\n\r]/.test(body);
      const display = dbl || multiline || body.trim().length > 70;
      store.push({ body, display });
      out += '\u0001' + (store.length - 1) + '\u0002';
      i = end; continue;
    }
    out += c; i++;
  }
  return { text: out, store };
}

/* ---------- 2. 行内解析 ---------- */
function makeInline(store, used) {
  return function inline(text) {
    let s = String(text);
    // 受保护的片段：公式、图片
    const slots = [];
    s = s.replace(PH, (m, k) => {
      const it = store[+k];
      used.add(+k);
      slots.push(it.display
        ? `<div class="math-block">${texToHtml(it.body, { display: true })}</div>`
        : texToHtml(it.body));
      return `\u0003${slots.length - 1}\u0004`;
    });
    // 图片 → 占位图
    s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (m, alt, url) => {
      slots.push(`<span class="md-img" title="${esc(url)}"><span class="md-img-t">原笔记插图</span><span class="md-img-a">${esc(alt || '示意图')}</span></span>`);
      return `\u0003${slots.length - 1}\u0004`;
    });
    s = s.replace(/\u0005\d+\u0006/g, '');
    // 链接 → 纯文字
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
    s = esc(s);
    s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\u0003(\d+)\u0004/g, (m, k) => slots[+k]);
    return s;
  };
}

/* ---------- 表格单元格切分（避开公式占位符内的 | ） ---------- */
function splitRow(line) {
  const cells = [];
  let buf = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '|') { cells.push(buf); buf = ''; continue; }
    buf += c;
  }
  cells.push(buf);
  if (cells.length && cells[0].trim() === '') cells.shift();
  if (cells.length && cells[cells.length - 1].trim() === '') cells.pop();
  return cells.map(c => c.trim());
}
const isTableSep = line => /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(line) && line.includes('-');

/* ---------- 3. 块级解析 ---------- */
export function parseMarkdown(src0) {
  let raw = String(src0).replace(/\r\n?/g, '\n');
  // 原笔记里有 HTML 注释包住的内容（作者注释掉的例题），保留但标注
  const comments = [];
  raw = raw.replace(/<!--([\s\S]*?)-->/g, (m, inner) => {
    comments.push(inner);
    return '\u0005' + (comments.length - 1) + '\u0006';
  });
  const { text, store } = splitMath(raw);
  const used = new Set();
  const inline = makeInline(store, used);
  const blocksToHtmlLocal = blocks => blocksToHtml(blocks, inline);

  const lines = text.split('\n');
  const blocks = [];
  let i = 0;
  const push = b => blocks.push(b);

  /* 段落中的行间公式拆成独立块 */
  function pushParagraph(chunkLines) {
    const joined = chunkLines.map(l => l.trim()).join('\n');
    // 按行间公式占位符切分
    const parts = joined.split(/(\u0001\d+\u0002|\u0005\d+\u0006)/);
    let buf = '';
    const out = [];
    const flushText = () => {
      if (buf.trim()) out.push({ type: 'p', html: `<p>${inline(buf.trim())}</p>` });
      buf = '';
    };
    for (const p of parts) {
      const m = /^\u0001(\d+)\u0002$/.exec(p);
      const cm = /^\u0005(\d+)\u0006$/.exec(p);
      if (m && store[+m[1]].display) { flushText(); out.push({ type: 'math', html: mathBlock(+m[1]) }); }
      else if (cm) { flushText(); out.push({ type: 'comment', html: commentBlock(+cm[1]) }); }
      else buf += p;
    }
    flushText();
    // 丢掉只剩标点的空段落（源笔记里 $$...$$ 后常有孤立的 “.”）
    return out.filter(b => !(b.type === 'p' && /^[.。·、,，;；:：…]+$/.test(stripTags(b.html).trim())));
  }

  function mathBlock(k) {
    used.add(k);
    return `<div class="math-block">${texToHtml(store[k].body, { display: true })}</div>`;
  }

  function commentBlock(k) {
    const inner = parseMarkdown(comments[k]);
    return `<div class="md-comment"><div class="md-comment-t">原笔记中被注释掉的内容</div>${blocksToHtml(inner)}</div>`;
  }

  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();

    if (!t) { i++; continue; }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) { push({ type: 'hr' }); i++; continue; }

    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const rendered = inline(h[2].trim());
      push({ type: 'heading', level: h[1].length, html: rendered, plain: stripTags(rendered), text: h[2].trim() });
      i++; continue;
    }

    // 表格
    if (t.startsWith('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const head = splitRow(lines[i]);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(splitRow(lines[i])); i++; }
      push({
        type: 'table',
        html: '<div class="tb-wrap"><table class="tb"><thead><tr>' +
          head.map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>' +
          rows.map(r => '<tr>' + r.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') +
          '</tbody></table></div>',
      });
      continue;
    }

    // 单独一行图片
    if (/^!\[[^\]]*\]\([^)]+\)$/.test(t)) { push({ type: 'p', html: `<p class="p-img">${inline(t)}</p>` }); i++; continue; }

    // 列表
    if (/^(\s*)([-*+]|\d+[.)])\s+/.test(line)) {
      const r = parseList(lines, i, inline, store);
      push(r.block); i = r.i; continue;
    }

    // 段落
    const buf = [];
    while (i < lines.length) {
      const l = lines[i];
      if (!l.trim()) break;
      if (/^(#{1,6})\s+/.test(l)) break;
      if (/^(\s*)([-*+]|\d+[.)])\s+/.test(l)) break;
      if (l.trim().startsWith('|')) break;
      buf.push(l);
      i++;
    }
    if (!buf.length) { i++; continue; }
    pushParagraph(buf).forEach(push);
  }
  return blocks;
}

function parseList(lines, start, inline, store) {
  const baseIndent = lines[start].match(/^(\s*)/)[1].replace(/\t/g, '    ').length;
  const ordered = /^\s*\d+[.)]\s+/.test(lines[start]);
  const items = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j++;
      if (j >= lines.length) break;
      const ind = (lines[j].match(/^(\s*)/)[1] || '').replace(/\t/g, '    ').length;
      const isItem = /^(\s*)([-*+]|\d+[.)])\s+/.test(lines[j]);
      if (ind < baseIndent || (ind <= baseIndent && !isItem)) break;
      i = j; continue;
    }
    const m = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line);
    const ind = (line.match(/^(\s*)/)[1] || '').replace(/\t/g, '    ').length;
    if (!m) {
      if (ind <= baseIndent) break;
      if (!items.length) break;
      items[items.length - 1].lines.push(line);
      i++; continue;
    }
    if (ind < baseIndent) break;
    if (ind > baseIndent + 1) {
      if (!items.length) break;
      items[items.length - 1].lines.push(line);
      i++; continue;
    }
    items.push({ lines: [m[3]] });
    i++;
  }
  const html = items.map(it => {
    const first = it.lines[0];
    const rest = it.lines.slice(1);
    let inner = inline(first.trim());
    if (rest.some(l => l.trim())) {
      // 把父级数学占位符还原为 $...$，交给子解析器（共享语义）
      const src = rest.join('\n').replace(PH, (m, k) => {
        const it = store[+k];
        return '$' + it.body + '$';
      });
      const sub = parseMarkdown(src);
      inner += blocksToHtml(sub);
    }
    return `<li>${inner}</li>`;
  }).join('');
  const tag = ordered ? 'ol' : 'ul';
  return { block: { type: 'list', html: `<${tag} class="md-list">${html}</${tag}>` }, i };
}

/* 嵌套 Markdown（列表续行）需要独立的 inline 环境 */
function inlineTop(text) {
  const { text: t, store } = splitMath(text);
  const inline = makeInline(store, new Set());
  return inline(t);
}

export { inlineTop };

export function blocksToHtml(blocks, inline) {
  const out = [];
  const inl = inline || inlineTop;
  for (const b of blocks) {
    if (b.type === 'heading') {
      const lv = Math.min(Math.max(b.level, 2), 5);
      out.push(`<h${lv} class="md-h md-h${b.level}">${b.html}</h${lv}>`);
    } else if (b.type === 'p') out.push(b.html);
    else if (b.type === 'list') out.push(b.html);
    else if (b.type === 'table') out.push(b.html);
    else if (b.type === 'math') out.push(b.html);
    else if (b.type === 'comment') out.push(b.html);
    else if (b.type === 'hr') out.push('<hr class="md-hr">');
  }
  return out.join('\n');
}

/* 拆分章节：h2/h3 作为小节边界 */
export function toSections(blocks, fallbackTitle) {
  const sections = [];
  let cur = { title: fallbackTitle, plain: fallbackTitle, level: 1, html: '', blocks: [] };
  for (const b of blocks) {
    if (b.type === 'heading' && (b.level === 2 || b.level === 3) && b.text) {
      if (cur.blocks.length || cur.title !== fallbackTitle) sections.push(cur);
      cur = { title: b.plain || b.text, html: b.html, level: b.level, blocks: [] };
      continue;
    }
    cur.blocks.push(b);
  }
  if (cur.blocks.length || !sections.length) sections.push(cur);
  return sections;
}
