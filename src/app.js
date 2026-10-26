/* =============================================================
   app.js · 书的控制器：翻页 / 全局控件 / 分步例题 / 习题交互
   ============================================================= */
(function () {
  'use strict';
  const E = window.Ink3D;
  window.PAGES = window.PAGES || [];

  /* ---------------- 五套配色（番茄红 / 芥末黄 / 薄荷绿 / 钴蓝 / 腮红粉） ---------------- */
  const PALETTES = [
    { id: 'tomato', name: '番茄红', accent: '#d9503a', tint: '#efdcc6', soft: 'rgba(217,80,58,.12)' },
    { id: 'mustard', name: '芥末黄', accent: '#b8860f', tint: '#f0e3b8', soft: 'rgba(184,134,15,.14)' },
    { id: 'mint', name: '薄荷绿', accent: '#2f9c80', tint: '#dbe9df', soft: 'rgba(47,156,128,.13)' },
    { id: 'cobalt', name: '钴蓝', accent: '#38659f', tint: '#dde4f0', soft: 'rgba(56,101,159,.13)' },
    { id: 'blush', name: '腮红粉', accent: '#cf7c8c', tint: '#f3dfe1', soft: 'rgba(207,124,140,.15)' },
  ];

  const state = {
    page: 0,
    palette: 0,
    seeThrough: false,
    labels: true,
  };

  const app = {
    el: {},
    studio: null,
    current: null,
    ui: {},
  };
  window.BOOK_APP = app;

  /* ---------------- 引擎配色映射 ---------------- */
  function enginePalette(p) {
    return {
      ink: '#2b2823',
      inkLight: '#6f675a',
      paper: '#fbf6e9',
      tint: p.tint,
      accent: p.accent,
      accent2: p.id === 'cobalt' ? '#b8860f' : '#38659f',
    };
  }
  function applyCssPalette(p) {
    document.documentElement.style.setProperty('--accent', p.accent);
    document.documentElement.style.setProperty('--accent-soft', p.soft);
    document.documentElement.style.setProperty('--tint', p.tint);
  }

  /* =============================================================
     分步例题：点击“下一步”逐步高亮，并同步 3D 图元
     ============================================================= */
  function mountSteps(host, steps, ctx, opts) {
    opts = opts || {};
    let idx = -1;
    host.innerHTML = steps.map((s, i) => `
      <div class="step" data-i="${i}">
        <div class="sn">${i + 1}</div>
        <div class="sc">${s.t}${s.why ? `<span class="why">${s.why}</span>` : ''}</div>
      </div>`).join('') + `
      <div class="step-ctl">
        <button class="btn tiny" data-s="prev">上一步</button>
        <button class="btn tiny primary" data-s="next">下一步 ▸</button>
        <button class="btn tiny" data-s="all">全部展开</button>
        <button class="btn tiny" data-s="reset">重播</button>
      </div>`;
    const nodes = [...host.querySelectorAll('.step')];
    const btns = {
      prev: host.querySelector('[data-s="prev"]'),
      next: host.querySelector('[data-s="next"]'),
      all: host.querySelector('[data-s="all"]'),
      reset: host.querySelector('[data-s="reset"]'),
    };

    function paint() {
      nodes.forEach((n, i) => {
        n.classList.toggle('show', i <= idx);
        n.classList.toggle('now', i === idx);
      });
      btns.prev.disabled = idx <= 0;
      btns.next.disabled = idx >= steps.length - 1;
      const cur = idx >= 0 ? steps[idx] : null;
      if (ctx.studio) {
        if (cur && cur.keys) ctx.studio.focusOn(cur.keys);
        else if (cur && cur.keys === null) ctx.studio.clearFocus();
      }
      if (opts.onStep) opts.onStep(idx, cur);
      if (cur && !opts.noScroll) {
        const n = nodes[idx];
        if (n && n.scrollIntoView) n.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
    function next() { if (idx < steps.length - 1) { idx++; paint(); } }
    function prev() { if (idx > 0) { idx--; paint(); } }
    host.addEventListener('click', e => {
      const b = e.target.closest('[data-s]');
      if (!b) return;
      const a = b.getAttribute('data-s');
      if (a === 'next') next();
      else if (a === 'prev') prev();
      else if (a === 'all') { idx = steps.length - 1; paint(); }
      else if (a === 'reset') { idx = 0; paint(); }
    });
    idx = 0;
    paint();
    return { next, prev, goto: i => { idx = i; paint(); }, get index() { return idx; } };
  }

  /* =============================================================
     渲染整本书
     ============================================================= */
  function pageTotal() { return window.PAGES.length; }

  function renderBook(animateDir) {
    const p = window.PAGES[state.page];
    app.current = p;
    if (app.studio) { app.studio.destroy(); app.studio = null; }
    const book = app.el.book;
    book.innerHTML = '';
    book.classList.toggle('cover-mode', p.kind === 'cover');

    if (p.kind === 'cover') {
      book.innerHTML = coverHTML(p);
      afterMount(p, book);
      bindCover(book);
      return;
    }

    book.innerHTML = spreadHTML(p, state.page);

    // 翻页动画层
    const layer = document.createElement('div');
    layer.className = 'flip-layer';
    layer.innerHTML = '<div class="flip-page"></div>';
    book.appendChild(layer);
    if (animateDir) {
      layer.classList.add('run', animateDir === 'next' ? 'next' : 'prev');
      setTimeout(() => layer.classList.remove('run', 'next', 'prev'), 660);
    }

    afterMount(p, book);
  }

  function coverHTML(p) {
    return `
      <div class="cover">
        <div class="cover-book"></div>
        <div class="cover-left">
          <div class="cover-kicker">人教 A 版 · 必修 第二册 · 第八章</div>
          <h1><span class="big">立体几何</span><span class="big accentword">3D 互动解读</span></h1>
          <div class="sub">第八章　立体几何初步</div>
          <p class="desc">
            一本会转动的数学书。<b>拖动</b>图形可 360° 观察，打开<b>透视</b>看见内部截面，
            点击<b>标注</b>读出每一条棱、每一个面。<br>
            从基本立体图形到平行与垂直，把 8.1—8.6 的每一节，变成可以亲手拆开的模型。
          </p>
          <div class="cover-toc">
            ${window.PAGES.filter(x => x.kind !== 'cover').map((x, i) => `
              <a data-goto="${i + 1}"><span>${String(i + 1).padStart(2, '0')}</span>${x.short || x.title}</a>`).join('')}
          </div>
          <div class="cover-cta">
            <button class="btn-open" data-goto="1">翻开课本 ▸</button>
            <span class="hint">← → 键亦可翻页</span>
          </div>
        </div>
        <div class="cover-right">
          <div class="cover-stage"><canvas id="cover-canvas"></canvas></div>
          <div class="cover-stamp">手绘墨线 · 可转可视<br>3D INTERACTIVE</div>
        </div>
      </div>`;
  }

  function spreadHTML(p, idx) {
    const total = pageTotal();
    return `
      <section class="leaf leaf-viz">
        <div class="page-edges"></div>
        <div class="runhead"><span>第八章 · 立体几何初步</span><span class="rule"></span><b>${p.running || p.title}</b></div>
        <div class="viz">
          <canvas></canvas>
          <div class="viz-tools">${p.vizTools || ''}</div>
          <div class="viz-corner">
            <button class="mini-btn" data-viz="zoom-in" title="放大">＋</button>
            <button class="mini-btn" data-viz="zoom-out" title="缩小">－</button>
            <button class="mini-btn" data-viz="reset" title="复位视角">⟲</button>
          </div>
          <div class="viz-hint">拖动 360° 旋转 · 滚轮缩放 · 双击复位</div>
        </div>
        <div class="tipbar">
          <span class="tip-label">讲解</span>
          <div>
            <p>${p.tip}</p>
            ${p.tipMore ? `<div class="tip-more">${p.tipMore}</div>` : ''}
          </div>
          ${p.tipMore ? '<button class="tip-key" data-tip>关键提示</button>' : ''}
        </div>
        <div class="pagenum">P.${String(idx + 1).padStart(2, '0')} / ${total}</div>
        <button class="turn-zone left" data-turn="prev" title="上一页"><span>‹</span></button>
        <button class="turn-zone right" data-turn="next" title="下一页"><span>›</span></button>
      </section>
      <section class="leaf leaf-text">
        <div class="page-edges"></div>
        <div class="runhead"><span>${p.running || p.title}</span><span class="rule"></span><b>人教A版 · 必修二</b></div>
        <div class="tabs">
          <button class="tab on" data-tab="knowledge"><span class="num">01</span>知识点</button>
          <button class="tab" data-tab="example"><span class="num">02</span>典型例题</button>
          <button class="tab" data-tab="practice"><span class="num">03</span>练习</button>
        </div>
        <div class="pane">
          <div class="pane-block on" data-pane="knowledge">${p.tabs.knowledge || ''}</div>
          <div class="pane-block" data-pane="example">${p.tabs.example || ''}</div>
          <div class="pane-block" data-pane="practice">${p.tabs.practice || ''}</div>
        </div>
        <div class="pagenum">${String(idx + 1).padStart(2, '0')}</div>
        <button class="turn-zone right" data-turn="next" title="下一页"><span>›</span></button>
      </section>`;
  }

  function afterMount(p, root) {
    // 标签页
    root.querySelectorAll('.tab').forEach(t => {
      t.addEventListener('click', () => {
        root.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === t));
        const k = t.getAttribute('data-tab');
        root.querySelectorAll('.pane-block').forEach(b => b.classList.toggle('on', b.getAttribute('data-pane') === k));
        if (p.onTab) p.onTab(k, app.studio);
      });
    });
    // 提示条
    const tipBtn = root.querySelector('[data-tip]');
    if (tipBtn) tipBtn.addEventListener('click', () => {
      const m = root.querySelector('.tip-more');
      if (m) m.classList.toggle('open');
    });
    // 翻页
    root.querySelectorAll('[data-turn]').forEach(b => {
      b.addEventListener('click', e => {
        e.stopPropagation();
        go(state.page + (b.getAttribute('data-turn') === 'next' ? 1 : -1));
      });
    });
    // 画布
    const canvas = root.querySelector('.viz canvas');
    if (!canvas) return;
    const pidx = state.page;
    const studio = new E.Studio(canvas, Object.assign({ yaw: -0.6, pitch: 0.34, zoom: 1 }, p.camera || {}));
    app.studio = studio;
    studio.setPalette(enginePalette(PALETTES[state.palette]));
    studio.seeThrough = state.seeThrough;
    studio.showLabels = state.labels;
    studio.onPick = (key, tip) => { if (p.onPick) p.onPick(key, tip, ctxObj(studio, root, p)); };
    studio.autoSpin = p.autoSpin || 0;
    const ctx = ctxObj(studio, root, p);
    if (p.scene) studio.setScene((t) => p.scene(t, ctx));
    // 工具条
    root.querySelectorAll('[data-viz]').forEach(b => {
      b.addEventListener('click', () => {
        const act = b.getAttribute('data-viz');
        if (act === 'zoom-in') studio.zoom = Math.min(3.2, studio.zoom * 1.12);
        else if (act === 'zoom-out') studio.zoom = Math.max(0.45, studio.zoom / 1.12);
        else if (act === 'reset') { studio.reset(); if (p.resetView) p.resetView(ctx); }
        else if (p.onViz) p.onViz(act, b, ctx);
        studio.dirty = true;
      });
    });
    // 参数滑块（高度、拆解程度等）
    root.querySelectorAll('[data-param]').forEach(inp => {
      const k = inp.getAttribute('data-param');
      if (ctx.params[k] == null) ctx.params[k] = parseFloat(inp.value);
      inp.value = ctx.params[k];
      const out = inp.parentElement.querySelector('.v');
      const sync = () => {
        const v = parseFloat(inp.value);
        ctx.params[k] = v;
        if (out) out.textContent = inp.getAttribute('data-unit') ? v.toFixed(2) + inp.getAttribute('data-unit') : v.toFixed(2);
        if (out) out.textContent = v.toFixed(2);
        studio.dirty = true;
        if (p.onParam) p.onParam(k, v, ctx);
      };
      inp.addEventListener('input', sync);
      sync();
    });
    if (p.init) p.init(ctx);
    studio.dirty = true;
  }

  function ctxObj(studio, root, p) {
    const ctx = {
      studio, root, page: p, params: Object.assign({}, p.defaults || {}),
      set(k, v) { ctx.params[k] = v; studio.dirty = true; },
      get(k) { return ctx.params[k]; },
      refresh() { studio.dirty = true; },
      activeTab() { const t = root.querySelector('.tab.on'); return t ? t.getAttribute('data-tab') : 'knowledge'; },
      goto: go,
    };
    return ctx;
  }

  function bindCover(root) {
    const canvas = root.querySelector('#cover-canvas');
    if (!canvas) return;
    const p = window.PAGES[0];
    const studio = new E.Studio(canvas, Object.assign({ yaw: -0.55, pitch: 0.3, zoom: 1.02 }, p.camera || {}));
    app.studio = studio;
    studio.setPalette(enginePalette(PALETTES[state.palette]));
    studio.seeThrough = state.seeThrough;
    studio.showLabels = state.labels;
    studio.autoSpin = 0.09;
    const ctx = ctxObj(studio, root, p);
    studio.setScene((t) => p.scene(t, ctx));
    // 参数滑块（高度、拆解程度等）
    root.querySelectorAll('[data-param]').forEach(inp => {
      const k = inp.getAttribute('data-param');
      if (ctx.params[k] == null) ctx.params[k] = parseFloat(inp.value);
      inp.value = ctx.params[k];
      const out = inp.parentElement.querySelector('.v');
      const sync = () => {
        const v = parseFloat(inp.value);
        ctx.params[k] = v;
        if (out) out.textContent = inp.getAttribute('data-unit') ? v.toFixed(2) + inp.getAttribute('data-unit') : v.toFixed(2);
        if (out) out.textContent = v.toFixed(2);
        studio.dirty = true;
        if (p.onParam) p.onParam(k, v, ctx);
      };
      inp.addEventListener('input', sync);
      sync();
    });
    if (p.init) p.init(ctx);
    root.querySelectorAll('[data-goto]').forEach(a => {
      a.addEventListener('click', e => { e.preventDefault(); go(parseInt(a.getAttribute('data-goto'), 10)); });
    });
  }

  /* =============================================================
     导航
     ============================================================= */
  function go(n, animate) {
    const total = pageTotal();
    if (n < 0 || n >= total) return;
    const dir = animate === false ? null : (n > state.page ? 'next' : 'prev');
    state.page = n;
    renderBook(dir);
    updateNav();
    try { history.replaceState(null, '', '#' + n); } catch (e) {}
  }
  window.BOOK_GO = go;

  function updateNav() {
    const total = pageTotal();
    const p = window.PAGES[state.page];
    app.el.prev.disabled = state.page <= 0;
    app.el.next.disabled = state.page >= total - 1;
    app.el.fill.style.width = ((state.page + 1) / total * 100).toFixed(1) + '%';
    app.el.label.textContent = p.kind === 'cover' ? '封面' : `${state.page} / ${total - 1} · ${p.chapter || ''}`;
    app.el.dots.innerHTML = window.PAGES.map((x, i) =>
      `<button data-dot="${i}" class="${i === state.page ? 'on' : ''}" title="${x.short || x.title}"></button>`).join('');
  }

  /* =============================================================
     全局控件
     ============================================================= */
  function bindGlobal() {
    app.el.see.addEventListener('click', () => {
      state.seeThrough = !state.seeThrough;
      app.el.see.classList.toggle('on', state.seeThrough);
      if (app.studio) { app.studio.seeThrough = state.seeThrough; app.studio.dirty = true; }
    });
    app.el.labels.addEventListener('click', () => {
      state.labels = !state.labels;
      app.el.labels.classList.toggle('on', state.labels);
      if (app.studio) { app.studio.showLabels = state.labels; app.studio.dirty = true; }
    });
    app.el.swatches.innerHTML = PALETTES.map((p, i) =>
      `<button class="swatch ${i === 0 ? 'on' : ''}" data-pal="${i}" title="${p.name}" style="background:${p.accent}"></button>`).join('');
    app.el.swatches.addEventListener('click', e => {
      const b = e.target.closest('[data-pal]');
      if (!b) return;
      state.palette = parseInt(b.getAttribute('data-pal'), 10);
      app.el.swatches.querySelectorAll('.swatch').forEach((s, i) => s.classList.toggle('on', i === state.palette));
      applyCssPalette(PALETTES[state.palette]);
      if (app.studio) app.studio.setPalette(enginePalette(PALETTES[state.palette]));
    });
    app.el.reset.addEventListener('click', () => {
      if (app.studio) app.studio.reset();
      if (app.current && app.current.resetParams) app.current.resetParams(app.studio);
    });
    app.el.prev.addEventListener('click', () => go(state.page - 1));
    app.el.next.addEventListener('click', () => go(state.page + 1));
    document.querySelector('.dots').addEventListener('click', e => {
      const b = e.target.closest('[data-dot]');
      if (b) go(parseInt(b.getAttribute('data-dot'), 10));
    });
    document.addEventListener('keydown', e => {
      const t = e.target;
      if (t && t.matches && t.matches('input, textarea')) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { go(state.page + 1); e.preventDefault(); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { go(state.page - 1); e.preventDefault(); }
      if (e.key === 't' || e.key === 'T') app.el.see.click();
      if (e.key === 'l' || e.key === 'L') app.el.labels.click();
    });
  }

  /* =============================================================
     习题交互（答案展开、选项判定、表格揭示、跳页）
     ============================================================= */
  function bindPractice() {
    document.addEventListener('click', e => {
      const rev = e.target.closest('[data-reveal]');
      if (rev) {
        const sel = rev.getAttribute('data-reveal');
        let box = sel ? document.getElementById(sel) : null;
        if (!box) {
          let n = rev.nextElementSibling;
          while (n && !n.classList.contains('ans')) n = n.nextElementSibling;
          box = n;
        }
        if (box) {
          const open = !box.classList.contains('open');
          box.classList.toggle('open', open);
          rev.textContent = open ? (rev.getAttribute('data-close') || '收起答案') : (rev.getAttribute('data-open') || '显示答案与步骤');
          if (open) {
            [...box.querySelectorAll('.sol-step')].forEach((s, i) => {
              s.style.animationDelay = (i * 80) + 'ms';
            });
            const st = box.getAttribute('data-focus');
            if (st && app.studio) app.studio.focusOn(st.split(','));
          } else if (app.studio) app.studio.clearFocus();
        }
        return;
      }
      const opt = e.target.closest('.opt');
      if (opt) {
        const group = opt.parentElement;
        const ok = opt.getAttribute('data-ok') === '1';
        opt.classList.add(ok ? 'right' : 'wrong');
        if (ok) {
          group.querySelectorAll('.opt').forEach(o => { if (o !== opt) o.classList.add('dim'); });
        } else {
          const right = group.querySelector('.opt[data-ok="1"]');
          if (right) right.classList.add('right');
        }
        return;
      }
      const tr = e.target.closest('[data-table-reveal]');
      if (tr) {
        const tb = tr.closest('.card, .q, section') || document;
        const table = tb.querySelector('table.tb') || tr.parentElement.querySelector('table.tb');
        if (table) {
          const open = !table.classList.contains('reveal');
          table.classList.toggle('reveal', open);
          tr.textContent = open ? '隐藏答案' : '核对答案';
        }
        return;
      }
      const j = e.target.closest('[data-goto]');
      if (j) { e.preventDefault(); go(parseInt(j.getAttribute('data-goto'), 10)); }
    });
  }

  /* =============================================================
     启动
     ============================================================= */
  function boot() {
    app.state = state;
    app.el.book = document.getElementById('book');
    app.el.prev = document.getElementById('nav-prev');
    app.el.next = document.getElementById('nav-next');
    app.el.fill = document.getElementById('prog-fill');
    app.el.label = document.getElementById('page-label');
    app.el.dots = document.querySelector('.dots');
    app.el.see = document.getElementById('btn-see');
    app.el.labels = document.getElementById('btn-labels');
    app.el.swatches = document.getElementById('swatches');
    app.el.reset = document.getElementById('btn-reset');

    applyCssPalette(PALETTES[0]);
    bindGlobal();
    bindPractice();

    let start = 0;
    const h = parseInt((location.hash || '').replace('#', ''), 10);
    if (!isNaN(h) && h >= 0 && h < window.PAGES.length) start = h;
    state.page = start;
    renderBook(null);
    updateNav();
  }

  window.UI = { mountSteps, go, state, PALETTES };
  document.addEventListener('DOMContentLoaded', boot);
})();
