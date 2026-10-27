/* =============================================================
   tools/latex.mjs · 构建期 LaTeX 子集 → HTML 渲染器
   支持 MathBook 笔记中出现的全部 149 个宏（cases/aligned/pmatrix/
   vmatrix/rcases、frac、sqrt[n]、红字、boxed、向量、极限上下标等）
   ============================================================= */

const SYM = {
  // 希腊字母
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ϵ', varepsilon: 'ε', zeta: 'ζ',
  eta: 'η', theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν',
  xi: 'ξ', omicron: 'ο', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'ϕ',
  varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Upsilon: 'Υ',
  Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  // 运算与关系
  times: '×', div: '÷', cdot: '·', cdotp: '·', ast: '∗', star: '⋆', circ: '∘', bullet: '•',
  pm: '±', mp: '∓', le: '≤', leq: '≤', ge: '≥', geq: '≥', leqslant: '≤', geqslant: '≥',
  neq: '≠', ne: '≠', equiv: '≡', approx: '≈', sim: '∼', simeq: '≃', cong: '≅', propto: '∝',
  ll: '≪', gg: '≫', doteq: '≐', triangleq: '≜',
  in: '∈', notin: '∉', ni: '∋', subset: '⊂', supset: '⊃', subseteq: '⊆', supseteq: '⊇',
  subsetneqq: '⫋', supsetneqq: '⫌', cup: '∪', cap: '∩', bigcup: '⋃', bigcap: '⋂',
  setminus: '∖', emptyset: '∅', varnothing: '∅', complement: '∁', forall: '∀', exist: '∃',
  nexist: '∄', neg: '¬', land: '∧', lor: '∨', lnot: '¬',
  to: '→', rightarrow: '→', leftarrow: '←', leftrightarrow: '↔', Rightarrow: '⇒',
  Leftarrow: '⇐', Leftrightarrow: '⇔', Longleftrightarrow: '⟺', longleftrightarrow: '⟷',
  longrightarrow: '⟶', Longrightarrow: '⟹', implies: '⟹', impliedby: '⟸', iff: '⟺',
  Rarr: '⇒', rArr: '⇒', lArr: '⇐', lrArr: '⟺', Uparrow: '⇑', Downarrow: '⇓',
  uparrow: '↑', downarrow: '↓', rightleftharpoons: '⇌', xrightleftharpoons: '⇌',
  parallel: '∥', nparallel: '∦', perp: '⊥', angle: '∠', measuredangle: '∡', triangle: '△',
  square: '□', bigcirc: '○', because: '∵', therefore: '∴', infty: '∞', partial: '∂', nabla: '∇',
  prime: '′', hbar: 'ℏ', ell: 'ℓ', Re: 'ℜ', Im: 'ℑ', wp: '℘',
  mid: '∣', nmid: '∤', divides: '∣', langle: '⟨', rangle: '⟩', lang: '⟨', rang: '⟩',
  lceil: '⌈', rceil: '⌉', lfloor: '⌊', rfloor: '⌋', lbrace: '{', rbrace: '}',
  circledast: '⊛', circledcirc: '⊚', oplus: '⊕', ominus: '⊖', otimes: '⊗', odot: '⊙',
  degree: '°', dag: '†', ddag: '‡', S: '§', P: '¶',
  cdots: '⋯', dots: '…', ldots: '…', vdots: '⋮', ddots: '⋱', iddots: '⋰',
  sum: '∑', prod: '∏', coprod: '∐', int: '∫', iint: '∬', iiint: '∭', oint: '∮',
  bigoplus: '⨁', bigotimes: '⨂', bigodot: '⨀',
  quad: '\u2003', qquad: '\u2003\u2003', enspace: '\u2002', thinspace: '\u2009',
  colon: ':', vcentcolon: ':', middot: '·', mldr: '…', dotsb: '⋯', dotsc: '…',
  '}': '}', '{': '{', '%': '%', '#': '#', '&': '&', '_': '_', '$': '$',
  backslash: '\\', lbrack: '[', rbrack: ']', vert: '|', Vert: '‖', '|': '‖',
  N: 'ℕ', Z: 'ℤ', R: 'ℝ', Q: 'ℚ', C: 'ℂ',
  copyright: '©', textbullet: '•', textdegree: '°', textbackslash: '\\',
};
// 直立函数名
const OPS = ['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'arcsin', 'arccos', 'arctan',
  'sinh', 'cosh', 'tanh', 'log', 'ln', 'lg', 'lim', 'max', 'min', 'sup', 'inf', 'gcd',
  'arg', 'exp', 'det', 'dim', 'deg', 'ker', 'bmod', 'mod', 'Pr', 'sgn'];
const BIGOPS = new Set(['sum', 'prod', 'coprod', 'bigcup', 'bigcap', 'int', 'iint', 'iiint', 'oint']);
const LIMIT_OPS = new Set(['lim', 'sum', 'prod', 'max', 'min', 'sup', 'inf', 'gcd', 'bigcup', 'bigcap', 'int', 'iint', 'oint', 'limsup', 'liminf']);
const NEG = { '=': '≠', '<': '≮', '>': '≯', in: '∉', subset: '⊄', subseteq: '⊈', supseteq: '⊉', equiv: '≢', parallel: '∦', mid: '∤', exists: '∄', sim: '≁' };
const DELIMS = { '(': '(', ')': ')', '[': '[', ']': ']', '|': '|', '.': '', '/': '/', '<': '⟨', '>': '⟩', '\\{': '{', '\\}': '}', '\\|': '‖', '\\langle': '⟨', '\\rangle': '⟩', '\\lfloor': '⌊', '\\rfloor': '⌋', '\\lceil': '⌈', '\\rceil': '⌉' };
const BLACKBOARD = { R: 'ℝ', N: 'ℕ', Z: 'ℤ', Q: 'ℚ', C: 'ℂ', P: 'ℙ', E: '𝔼', F: '𝔽' };

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const CJK = /[\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef\u3000-\u303f]/;

let unknown = new Set();

/* ---------- 工具 ---------- */
function splitTop(str, sepRe) {
  // 在括号深度 0 处按分隔符切分
  const out = [];
  let depth = 0, buf = '', i = 0;
  while (i < str.length) {
    const c = str[i];
    if (c === '\\' && str[i + 1] === '{') { buf += '\\{'; i += 2; continue; }
    if (c === '\\' && str[i + 1] === '}') { buf += '\\}'; i += 2; continue; }
    if (c === '\\' && str[i + 1] === '\\' && sepRe === 'row') {
      if (depth === 0) { out.push(buf); buf = ''; i += 2; continue; }
      buf += '\\\\'; i += 2; continue;
    }
    if (c === '\\' && str[i + 1] === '&' && sepRe === 'col') { buf += '\\&'; i += 2; continue; }
    if (c === '{') depth++;
    if (c === '}') depth--;
    if (c === '\\' && str[i + 1] !== undefined) { buf += c + str[i + 1]; i += 2; continue; }
    if (depth === 0 && sepRe === 'col' && c === '&') { out.push(buf); buf = ''; i += 1; continue; }
    if (depth === 0 && sepRe === 'newline' && c === '\n') { out.push(buf); buf = ''; i += 1; continue; }
    buf += c; i++;
  }
  out.push(buf);
  return out;
}

function letters(buf) {
  // ASCII 字母斜体，其余（数字、汉字、标点）直立
  let out = '', i = 0;
  while (i < buf.length) {
    const c = buf[i];
    if (/[A-Za-z]/.test(c)) {
      let j = i;
      while (j < buf.length && /[A-Za-z]/.test(buf[j])) j++;
      out += '<i>' + esc(buf.slice(i, j)) + '</i>';
      i = j;
    } else if (/\s/.test(c)) {
      out += c === ' ' ? ' ' : c;
      i++;
    } else if (CJK.test(c)) {
      let j = i;
      while (j < buf.length && CJK.test(buf[j])) j++;
      out += '<span class="cn">' + esc(buf.slice(i, j)) + '</span>';
      i = j;
    } else {
      out += esc(c);
      i++;
    }
  }
  return out;
}

/* ---------- 主解析 ---------- */
function seq(s, i, end, ctx) {
  let out = '', buf = '';
  const flush = () => { if (buf) { out += letters(buf); buf = ''; } };
  while (i < end) {
    const c = s[i];
    if (c === '\\') {
      const n = s[i + 1];
      if (n === undefined) { i++; continue; }
      if (n === '\\') {
        flush();
        out += ctx.env ? '</span><span class="mrow">' : '<br>';
        i += 2; continue;
      }
      if ('{}%&#_$'.includes(n)) { buf += n; i += 2; continue; }
      if (',;:! '.includes(n)) { flush(); out += '<span class="msp"></span>'; i += 2; continue; }
      if (/[A-Za-z]/.test(n)) {
        let j = i + 1;
        while (j < end && /[A-Za-z]/.test(s[j])) j++;
        const name = s.slice(i + 1, j);
        flush();
        const r = cmd(name, s, j, end, ctx);
        out += r.html; i = r.i;
        continue;
      }
      // 控制符号（如 \{ \, \\ 已处理）
      const key = '\\' + n;
      if (DELIMS[key] !== undefined) { buf += DELIMS[key]; i += 2; continue; }
      i += 2; continue;
    }
    if (c === '{') {
      flush();
      const r = seq(s, i + 1, end, ctx);
      out += '<span class="grp">' + r.html + '</span>';
      i = r.i + 1; continue;
    }
    if (c === '}') { flush(); return { html: out, i }; }
    if (c === '^' || c === '_') {
      flush();
      const r = arg(s, i + 1, end, ctx);
      if (c === '^') out += '<sup>' + r.html + '</sup>';
      else out += '<sub>' + r.html + '</sub>';
      i = r.i; continue;
    }
    if (c === '&') { flush(); out += '<span class="msp"></span>'; i++; continue; }
    if (c === '~') { flush(); out += '&nbsp;'; i++; continue; }
    if (c === '\n') { flush(); out += ' '; i++; continue; }
    buf += c; i++;
  }
  flush();
  return { html: out, i };
}

function arg(s, i, end, ctx) {
  while (i < end && s[i] === ' ') i++;
  if (i >= end) return { html: '', i };
  if (s[i] === '{') {
    const r = seq(s, i + 1, end, ctx);
    return { html: r.html, i: r.i + 1 };
  }
  if (s[i] === '\\') {
    let j = i + 1;
    while (j < end && /[A-Za-z]/.test(s[j])) j++;
    const name = s.slice(i + 1, j);
    const r = cmd(name, s, j, end, ctx);
    return { html: r.html, i: r.i };
  }
  // 单字符
  const ch = s[i];
  return { html: letters(ch), i: i + 1 };
}

function rawGroup(s, i, end) {
  while (i < end && s[i] === ' ') i++;
  if (s[i] !== '{') return { text: s[i] || '', i: i + 1 };
  let depth = 0, j = i;
  for (; j < end; j++) {
    if (s[j] === '\\' && (s[j + 1] === '{' || s[j + 1] === '}')) { j++; continue; }
    if (s[j] === '{') depth++;
    else if (s[j] === '}') { depth--; if (depth === 0) break; }
  }
  return { text: s.slice(i + 1, j), i: j + 1 };
}

function envBody(s, i, end, name) {
  // 从 \begin{name} 之后开始，找到配对的 \end{name}
  let depth = 1, j = i;
  const open = '\\begin{' + name + '}';
  const close = '\\end{' + name + '}';
  while (j < end) {
    if (s.startsWith(open, j)) { depth++; j += open.length; continue; }
    if (s.startsWith(close, j)) {
      depth--;
      if (depth === 0) return { body: s.slice(i, j), i: j + close.length };
      j += close.length; continue;
    }
    j++;
  }
  return { body: s.slice(i, end), i: end };
}

/* 取从 start（指向 '<tag>'）开始的完整同名标签区块 */
function matchTag(html, start) {
  const m = /^<([a-zA-Z]+)[^>]*>/.exec(html.slice(start));
  if (!m) return { html: '', end: start };
  const tag = m[1];
  const open = new RegExp('<' + tag + '(\\s[^>]*)?>', 'g');
  const close = new RegExp('</' + tag + '>', 'g');
  let depth = 0, pos = start, mid = 0;
  while (pos < html.length) {
    open.lastIndex = pos; close.lastIndex = pos;
    const o = open.exec(html), c = close.exec(html);
    const cands = [];
    if (o) cands.push({ i: o.index, len: o[0].length, d: 1 });
    if (c) cands.push({ i: c.index, len: c[0].length, d: -1 });
    cands.sort((a, b) => a.i - b.i);
    const cur = cands[0];
    if (!cur) break;
    depth += cur.d;
    pos = cur.i + cur.len;
    if (depth === 0) {
      mid = cur.i;
      const inner = html.slice(start, pos).replace(/^<[^>]+>/, '').replace(/<\/[a-zA-Z]+>$/, '');
      return { html: inner, end: pos };
    }
  }
  return { html: '', end: html.length };
}

/* 行间公式里把 ∑/∏/∫/lim/max 的上下标叠成上下限 */
function liftLimits(html) {
  const MARK = '<span class="op big';
  let out = '', i = 0;
  while (i < html.length) {
    const j = html.indexOf(MARK, i);
    if (j < 0) { out += html.slice(i); break; }
    out += html.slice(i, j);
    const op = matchTag(html, j);
    const symHtml = op.html;
    let k = op.end, sup = null, sub = null;
    for (let n = 0; n < 2; n++) {
      const rest = html.slice(k);
      const m = /^<(sup|sub)>/.exec(rest);
      if (!m) break;
      const part = matchTag(html, k);
      if (m[1] === 'sup') sup = part.html; else sub = part.html;
      k = part.end;
    }
    if (sup === null && sub === null) { out += html.slice(j, k); i = k; continue; }
    out += '<span class="bigop">'
      + (sup !== null ? '<span class="bo-sup">' + sup + '</span>' : '')
      + '<span class="bo-sym">' + symHtml + '</span>'
      + (sub !== null ? '<span class="bo-sub">' + sub + '</span>' : '')
      + '</span>';
    i = k;
  }
  return out;
}

function renderMath(str, ctx) {
  const c2 = Object.assign({}, ctx, { env: false });
  const r = seq(String(str), 0, String(str).length, c2);
  return c2.display ? liftLimits(r.html) : r.html;
}

function rowsHtml(body, ctx, kind) {
  const rows = splitTop(body, 'row').map(r => r.trim()).filter((r, idx, arr) => !(r === '' && idx === arr.length - 1));
  const out = rows.map(row => {
    const cells = splitTop(row, 'col').map(c => renderMath(c, ctx));
    return '<span class="mrow">' + cells.map(c => '<span class="mcell">' + c + '</span>').join('') + '</span>';
  }).join('');
  if (kind === 'cases') return '<span class="tex-env cases"><span class="mrows">' + out + '</span></span>';
  if (kind === 'rcases') return '<span class="tex-env cases rcases"><span class="mrows">' + out + '</span></span>';
  if (kind === 'pmatrix') return '<span class="tex-env mat p"><span class="mrows">' + out + '</span></span>';
  if (kind === 'bmatrix') return '<span class="tex-env mat b"><span class="mrows">' + out + '</span></span>';
  if (kind === 'vmatrix') return '<span class="tex-env mat v"><span class="mrows">' + out + '</span></span>';
  if (kind === 'Vmatrix') return '<span class="tex-env mat vv"><span class="mrows">' + out + '</span></span>';
  if (kind === 'matrix') return '<span class="tex-env mat plain"><span class="mrows">' + out + '</span></span>';
  if (kind === 'aligned' || kind === 'align' || kind === 'gathered' || kind === 'array') return '<span class="tex-env rows">' + out + '</span>';
  return '<span class="tex-env rows">' + out + '</span>';
}

function cmd(name, s, i, end, ctx) {
  // ---- 符号表 ----
  if (SYM[name] !== undefined) {
    if (name === 'quad' || name === 'qquad') return { html: SYM[name], i };
    if (BIGOPS.has(name)) return { html: '<span class="op big">' + SYM[name] + '</span>', i };
    return { html: '<span class="sym">' + SYM[name] + '</span>', i };
  }
  // ---- 函数名 ----
  if (OPS.includes(name)) {
    if (LIMIT_OPS.has(name)) {
      // 允许紧跟上下标（行间公式里由 liftLimits 叠成上下限）
      return { html: '<span class="op big lim">' + name + '</span>', i };
    }
    return { html: '<span class="op">' + name + '</span>', i };
  }
  switch (name) {
    case 'frac': case 'dfrac': case 'tfrac': case 'cfrac': {
      const a = arg(s, i, end, ctx);
      const b = arg(s, a.i, end, ctx);
      return { html: `<span class="frac${name === 'dfrac' ? ' dfrac' : ''}"><span class="num">${a.html}</span><span class="den">${b.html}</span></span>`, i: b.i };
    }
    case 'binom': {
      const a = arg(s, i, end, ctx);
      const b = arg(s, a.i, end, ctx);
      return { html: `<span class="binom"><span class="delim">(</span><span class="stack"><span>${a.html}</span><span>${b.html}</span></span><span class="delim">)</span></span>`, i: b.i };
    }
    case 'sqrt': {
      let idx = '';
      let j = i;
      while (s[j] === ' ') j++;
      if (s[j] === '[') {
        const close = s.indexOf(']', j);
        idx = renderMath(s.slice(j + 1, close), ctx);
        j = close + 1;
      }
      const r = arg(s, j, end, ctx);
      return { html: `<span class="sqrt">${idx ? `<span class="idx">${idx}</span>` : ''}<span class="rad">√</span><span class="radicand">${r.html}</span></span>`, i: r.i };
    }
    case 'text': case 'textrm': case 'mbox': case 'textnormal': {
      const r = rawGroup(s, i, end);
      return { html: '<span class="tx">' + esc(r.text) + '</span>', i: r.i };
    }
    case 'mathrm': case 'mathbf': case 'mathit': case 'mathcal': case 'mathsf': case 'mathtt': {
      const r = arg(s, i, end, ctx);
      return { html: `<span class="${name.slice(4)}">${r.html}</span>`, i: r.i };
    }
    case 'mathbb': {
      const r = rawGroup(s, i, end);
      const t = r.text.replace(/\s/g, '');
      const mapped = [...t].map(ch => BLACKBOARD[ch] || ch).join('');
      return { html: '<span class="bb">' + esc(mapped) + '</span>', i: r.i };
    }
    case 'red': { const r = arg(s, i, end, ctx); return { html: '<span class="red">' + r.html + '</span>', i: r.i }; }
    case 'blue': case 'green': { const r = arg(s, i, end, ctx); return { html: `<span class="${name}">` + r.html + '</span>', i: r.i }; }
    case 'boxed': { const r = arg(s, i, end, ctx); return { html: '<span class="boxed">' + r.html + '</span>', i: r.i }; }
    case 'set': { const r = arg(s, i, end, ctx); return { html: '<span class="set">{' + r.html + '}</span>', i: r.i }; }
    case 'overline': case 'bar': { const r = arg(s, i, end, ctx); return { html: '<span class="acc bar">' + r.html + '</span>', i: r.i }; }
    case 'underline': { const r = arg(s, i, end, ctx); return { html: '<span class="acc ul">' + r.html + '</span>', i: r.i }; }
    case 'hat': case 'widehat': { const r = arg(s, i, end, ctx); return { html: '<span class="acc hat">' + r.html + '</span>', i: r.i }; }
    case 'tilde': case 'widetilde': { const r = arg(s, i, end, ctx); return { html: '<span class="acc tilde">' + r.html + '</span>', i: r.i }; }
    case 'vec': case 'overrightarrow': case 'overleftarrow': {
      const r = arg(s, i, end, ctx);
      return { html: '<span class="acc vec">' + r.html + '</span>', i: r.i };
    }
    case 'dot' : { const r=arg(s,i,end,ctx); return { html:'<span class="acc dot">'+r.html+'</span>', i:r.i }; }
    case 'ddot': { const r=arg(s,i,end,ctx); return { html:'<span class="acc ddot">'+r.html+'</span>', i:r.i }; }
    case 'overline2': { const r = arg(s, i, end, ctx); return { html: '<span class="acc bar">' + r.html + '</span>', i: r.i }; }
    case 'overbrace': case 'underbrace': {
      const r = arg(s, i, end, ctx);
      const lab = arg(s, r.i, end, ctx);
      return { html: `<span class="brace-acc ${name}"><span class="inner">${r.html}</span><span class="lab">${lab.html || '&nbsp;'}</span></span>`, i: lab.i };
    }
    case 'xLeftrightarrow': case 'xleftrightarrow': case 'xlongequal': case 'xrightleftharpoons': case 'xRightarrow': case 'xlongrightarrow': {
      const r = arg(s, i, end, ctx);
      const glyph = name === 'xlongequal' ? '=' : (name === 'xRightleftharpoons' || name === 'xrightleftharpoons') ? '⇌' : name.toLowerCase().includes('right') ? '⟹' : '⟷';
      return { html: `<span class="xarrow"><span class="lab">${r.html}</span><span class="bar">${glyph}</span></span>`, i: r.i };
    }
    case 'xcancel': { const r = arg(s, i, end, ctx); return { html: '<span class="xcancel">' + r.html + '</span>', i: r.i }; }
    case 'cancel': { const r = arg(s, i, end, ctx); return { html: '<span class="xcancel">' + r.html + '</span>', i: r.i }; }
    case 'left': case 'right': case 'big': case 'Big': case 'bigg': case 'Bigg':
    case 'bigl': case 'bigr': case 'Bigl': case 'Bigr': case 'biggl': case 'biggr': {
      let j = i;
      while (s[j] === ' ') j++;
      let d = s[j];
      if (d === '\\') {
        if ('{}|'.includes(s[j + 1])) { d = s.slice(j, j + 2); j += 2; }
        else {
          let k = j + 1;
          while (k < end && /[A-Za-z]/.test(s[k])) k++;
          d = s.slice(j, k);
          j = k;
        }
      } else j++;
      const ch = DELIMS[d] !== undefined ? DELIMS[d]
        : (d[0] === '\\' && SYM[d.slice(1)] !== undefined ? SYM[d.slice(1)] : d);
      if (name === 'right' && ch === '') return { html: '', i: j };
      return { html: '<span class="delim ' + (name === 'left' || name === 'right' ? 'grow' : '') + '">' + esc(ch) + '</span>', i: j };
    }
    case 'not': {
      let j = i;
      while (s[j] === ' ') j++;
      if (s[j] === '\\') {
        let k = j + 1;
        while (k < end && /[A-Za-z]/.test(s[k])) k++;
        const nm = s.slice(j + 1, k);
        if (NEG[nm]) return { html: '<span class="sym">' + NEG[nm] + '</span>', i: k };
        return { html: '<span class="sym">' + (SYM[nm] || nm) + '</span>', i: k };
      }
      const ch = s[j];
      if (NEG[ch]) return { html: '<span class="sym">' + NEG[ch] + '</span>', i: j + 1 };
      return { html: '<span class="sym">' + esc(ch) + '</span>', i: j + 1 };
    }
    case 'begin': {
      const nb = rawGroup(s, i, end);
      const envName = nb.text.trim();
      let j = nb.i;
      // array 有对齐参数
      if (envName === 'array' || envName.endsWith('matrix') === false && ['aligned', 'align', 'cases', 'rcases', 'array', 'gathered'].includes(envName) && envName === 'array') {
        const al = rawGroup(s, j, end);
        j = al.i;
      }
      const eb = envBody(s, j, end, envName);
      const map = { cases: 'cases', rcases: 'rcases', pmatrix: 'pmatrix', bmatrix: 'bmatrix', vmatrix: 'vmatrix', Vmatrix: 'Vmatrix', matrix: 'matrix', smallmatrix: 'matrix', aligned: 'aligned', align: 'aligned', alignedat: 'aligned', gathered: 'aligned', array: 'array' };
      const kind = map[envName] || 'aligned';
      return { html: rowsHtml(eb.body, Object.assign({}, ctx, { env: true }), kind), i: eb.i };
    }
    case 'end': {
      const nb = rawGroup(s, i, end);
      return { html: '', i: nb.i };
    }
    case 'displaystyle': ctx.display = true; return { html: '', i };
    case 'textstyle': case 'scriptstyle': case 'scriptscriptstyle':
    case 'normalsize': case 'large': case 'Large': case 'LARGE': case 'huge': case 'Huge':
    case 'small': case 'footnotesize': case 'tiny': case 'limits': case 'nolimits':
    case 'mathstrut': case 'strut': case 'allowbreak': case 'nobreak': case 'relax':
      return { html: '', i };
    case 'hspace': case 'hskip': case 'vspace': case 'kern': case 'mkern': {
      const r = rawGroup(s, i, end);
      return { html: '<span class="msp"></span>', i: r.i };
    }
    case 'sub': { const r = arg(s, i, end, ctx); return { html: '<sub>' + r.html + '</sub>', i: r.i }; }
    case 'sube': { const r = arg(s, i, end, ctx); return { html: '<span class="sym">⊆</span>' + r.html, i: r.i }; }
    case 'sup': { const r = arg(s, i, end, ctx); return { html: '<sup>' + r.html + '</sup>', i: r.i }; }
    case 'pmod': { const r = arg(s, i, end, ctx); return { html: '<span class="msp"></span>(mod ' + r.html + ')', i: r.i }; }
    case 'stackrel': case 'overset': case 'underset': {
      const a = arg(s, i, end, ctx);
      const b = arg(s, a.i, end, ctx);
      const cls = name === 'underset' ? 'under' : 'over';
      return { html: `<span class="stacked ${cls}"><span class="${name === 'underset' ? 'lo' : 'hi'}">${a.html}</span><span class="base">${b.html}</span></span>`, i: b.i };
    }
    case 'operatorname': {
      const r = rawGroup(s, i, end);
      return { html: '<span class="op">' + esc(r.text) + '</span>', i: r.i };
    }
    case 'color': {
      const c = rawGroup(s, i, end);
      const r = arg(s, c.i, end, ctx);
      return { html: `<span style="color:${esc(c.text.replace(/[^a-zA-Z#0-9]/g, ''))}">${r.html}</span>`, i: r.i };
    }
    case 'phantom': case 'vphantom': case 'hphantom': { const r = arg(s, i, end, ctx); return { html: '<span class="phantom">' + r.html + '</span>', i: r.i }; }
    case 'tag': { const r = arg(s, i, end, ctx); return { html: '', i: r.i }; }
    case 'nonumber': case 'notag': return { html: '', i };
    default: {
      unknown.add(name);
      return { html: '<span class="tex-unk">' + esc(name) + '</span>', i };
    }
  }
}

export function texToHtml(src, opts = {}) {
  let body = String(src);
  // {a \over b} → \frac{a}{b}（源笔记仅一处）
  let prev;
  do { prev = body; body = body.replace(/\{([^{}]*?)\\over\s+([^{}]*?)\}/g, '\\frac{$1}{$2}'); } while (body !== prev);
  const html = renderMath(body, { display: !!opts.display });
  return `<span class="math${opts.display ? ' display' : ''}">${html}</span>`;
}
export function getUnknown() { return [...unknown]; }
export function resetUnknown() { unknown = new Set(); }
