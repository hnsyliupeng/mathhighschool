/* =============================================================
   book.js · 书的控制器
   数据驱动：415 页正文 + 卷首/目录/后记；每章一台 3D 展台
   ============================================================= */
(function () {
  'use strict';
  const E = window.Ink3D;
  const S = window.SCENES;
  const SCENE_COUNT = Object.keys(S).length;

  /* ---------------- 配色 ---------------- */
  const PALETTES = [
    { id: 'tomato', name: '番茄红', accent: '#d9503a', tint: '#efdcc6', soft: 'rgba(217,80,58,.12)' },
    { id: 'mustard', name: '芥末黄', accent: '#a9760b', tint: '#f0e3b8', soft: 'rgba(169,118,11,.14)' },
    { id: 'mint', name: '薄荷绿', accent: '#2f8f76', tint: '#dbe9df', soft: 'rgba(47,143,118,.13)' },
    { id: 'cobalt', name: '钴蓝', accent: '#38659f', tint: '#dde4f0', soft: 'rgba(56,101,159,.13)' },
    { id: 'blush', name: '腮红粉', accent: '#c46f80', tint: '#f3dfe1', soft: 'rgba(196,111,128,.15)' },
  ];

  /* ---------------- 数据 ---------------- */
  const RAW = JSON.parse(document.getElementById('book-data').textContent);
  const CH = {};
  RAW.chapters.forEach(c => { CH[c.id] = c; });
  const FORMULAS = RAW.pages.reduce((a, p) => a + ((p.html.match(/class="math/g) || []).length), 0);
  /* 供 3D 场景读取的统计数字（封面铭牌等） */
  window.BOOK_STATS = {
    chapters: RAW.chapters.length, pages: RAW.stats.pages,
    words: RAW.stats.words, formulas: FORMULAS,
  };

  const FRONT = 1 + 1 + 2;            // 封面 + 前言 + 目录 2 页
  const PAGES = [];

  PAGES.push({ kind: 'cover' });
  PAGES.push({ kind: 'intro' });
  const tocGroups = [RAW.chapters.slice(0, 10), RAW.chapters.slice(10)];
  tocGroups.forEach((g, i) => PAGES.push({ kind: 'toc', group: g, part: i + 1 }));

  RAW.pages.forEach((p, i) => {
    PAGES.push(Object.assign({}, p, { kind: 'text', src: i }));
  });
  PAGES.push({ kind: 'colophon' });
  PAGES.forEach((p, i) => { p.abs = i; });

  const FIRST_TEXT = FRONT;
  const LAST_TEXT = FIRST_TEXT + RAW.pages.length - 1;

  /* ---------------- 状态 ---------------- */
  const store = (() => {
    try { return JSON.parse(localStorage.getItem('mb3d') || '{}') || {}; } catch (e) { return {}; }
  })();
  const state = {
    page: 0,
    palette: store.palette || 0,
    seeThrough: !!store.seeThrough,
    labels: store.labels !== false,
    fontScale: store.fontScale || 1,
    modes: store.modes || {},              // 每章的演示模式
    yaw: {},                              // 每章的视角
  };
  function save() {
    try {
      localStorage.setItem('mb3d', JSON.stringify({
        palette: state.palette, seeThrough: state.seeThrough, labels: state.labels,
        fontScale: state.fontScale, modes: state.modes, yaw: state.yaw, page: state.page,
      }));
    } catch (e) {}
  }

  const app = { el: {}, studio: null, page: null, ctx: null };
  window.BOOK = app;

  /* ---------------- 工具 ---------------- */
  const pad = (n, w) => String(n).padStart(w || 2, '0');
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  function enginePalette(p) {
    return {
      ink: '#2b2823', inkLight: '#6f675a', paper: '#fbf6e9',
      tint: p.tint, accent: p.accent,
      accent2: p.id === 'cobalt' ? '#a9760b' : '#38659f',
    };
  }
  function applyCssPalette(p) {
    const root = document.documentElement.style;
    root.setProperty('--accent', p.accent);
    root.setProperty('--accent-soft', p.soft);
    root.setProperty('--tint', p.tint);
  }
  function applyFont() {
    document.documentElement.style.setProperty('--read', (13.6 * state.fontScale).toFixed(2) + 'px');
    app.el.fontVal.textContent = Math.round(state.fontScale * 100) + '%';
  }

  /* ---------------- 页面元信息 ---------------- */
  function pageInfo(p) {
    if (p.kind === 'cover') return { chId: null, chNo: '', title: '封面', sceneKey: 'cover', sec: '' };
    if (p.kind === 'intro') return { chId: null, chNo: '', title: '前言', sceneKey: 'cover', sec: '关于这本 3D 书' };
    if (p.kind === 'toc') return { chId: null, chNo: '', title: '目录', sceneKey: 'cover', sec: '全书目录' };
    if (p.kind === 'colophon') return { chId: null, chNo: '', title: '后记', sceneKey: 'cover', sec: '来源与许可' };
    const ch = CH[p.ch] || {};
    return {
      chId: p.ch, chNo: p.chNo, chTitle: p.chTitle, chShort: p.chShort,
      title: p.chTitle, sec: p.sec || '', sceneKey: ch.scene || 'fallback',
      cont: p.cont, idxInCh: p.src - ch.first + 1, totalInCh: ch.count,
    };
  }

  /* ---------------- 渲染：整页 ---------------- */
  function render(dir) {
    const p = PAGES[state.page];
    app.page = p;
    const info = pageInfo(p);
    const book = app.el.book;
    if (app.studio) { app.studio.destroy(); app.studio = null; }
    book.innerHTML = '';
    book.classList.toggle('cover-mode', p.kind === 'cover');
    document.body.classList.toggle('is-cover', p.kind === 'cover');

    if (p.kind === 'cover') {
      book.innerHTML = coverHTML();
      bindCover();
    } else {
      book.innerHTML = spreadHTML(p, info);
      addFlip(dir);
      bindViz(info);
      bindText();
    }
    updateNav(info);
    updateSidebar(info);
    try { history.replaceState(null, '', '#p' + (state.page + 1)); } catch (e) {}
    save();
  }

  function coverHTML() {
    const st = RAW.stats;
    return `
      <div class="cover">
        <div class="cover-book"></div>
        <div class="cover-left">
          <div class="cover-kicker">MATHBOOK · 3D INTERACTIVE EDITION</div>
          <h1><span class="big">高中数学笔记</span><span class="big accentword">3D 互动全书</span></h1>
          <div class="sub">20 章 · ${st.pages} 页 · 单文件离线可读</div>
          <p class="desc">
            这是一本会转动的数学书。全书内容取自开源笔记
            <b>liuhaopeng543/MathBook</b>：从方程求解、集合、不等式，到立体几何、
            解析几何、导数、概率统计，再到数论、组合与高等数学的先声。
            <br>每一章都配一台可拖动旋转的三维展台（共 ${SCENE_COUNT} 个场景），公式按 $\TeX$ 排版，正文一个字都没有删。
          </p>
          <div class="cover-stats">
            <div><b>${RAW.chapters.length}</b><span>章</span></div>
            <div><b>${st.pages}</b><span>页正文</span></div>
            <div><b>${(st.words / 1000).toFixed(0)}k</b><span>字</span></div>
            <div><b>${(FORMULAS / 1000).toFixed(1)}k</b><span>处公式</span></div>
          </div>
          <div class="cover-toc">
            ${RAW.chapters.map(c => `<a data-goto="${FRONT + c.first}"><span>${c.no}</span>${esc(c.title)}</a>`).join('')}
          </div>
          <div class="cover-cta">
            <button class="btn-open" data-goto="1">翻开这本书 ▸</button>
            <span class="hint">← → 翻页 · M 目录 · / 检索</span>
          </div>
        </div>
        <div class="cover-right">
          <div class="cover-stage"><canvas id="cover-canvas"></canvas></div>
          <div class="cover-stamp">手绘墨线 · 可转可视<br>3D INTERACTIVE</div>
        </div>
      </div>`;
  }

  function spreadHTML(p, info) {
    const isText = p.kind === 'text';
    const body = isText ? `<div class="pane" id="pane">${p.html}</div>`
      : `<div class="pane" id="pane">${sheetHTML(p)}</div>`;
    return `
      <section class="leaf leaf-viz">
        <div class="page-edges"></div>
        <div class="runhead">
          <span>${info.chNo ? '第 ' + info.chNo + ' 章 · ' + esc(info.chShort || info.chTitle || '') : 'MathBook · 3D'}</span>
          <span class="rule"></span>
          <b id="rh-scene">${esc(sceneOf(info).name)}</b>
        </div>
        <div class="viz" id="viz">
          <canvas></canvas>
          <div class="viz-tools" id="viz-tools"></div>
          <div class="viz-corner">
            <button class="mini-btn" data-viz="zoom-in" title="放大">＋</button>
            <button class="mini-btn" data-viz="zoom-out" title="缩小">－</button>
            <button class="mini-btn" data-viz="reset" title="复位视角">⟲</button>
          </div>
          <div class="viz-hint">拖动旋转 · 滚轮缩放 · 双击复位</div>
        </div>
        <div class="scene-note"><span class="lbl">读图</span><span id="scene-note"></span></div>
        <div class="pagenum">${info.chNo ? 'P.' + pad(p.abs + 1, 3) : 'MathBook 3D'}</div>
      </section>
      <section class="leaf leaf-text">
        <div class="page-edges"></div>
        <div class="runhead">
          <span>${info.chNo ? esc(info.chTitle) : '高中数学笔记 · 3D 互动全书'}</span>
          <span class="rule"></span>
          <span class="rh-r">${isText && info.idxInCh ? info.idxInCh + ' / ' + info.totalInCh : esc(info.sec || '')}</span>
        </div>
        ${body}
        <div class="pagenum">${p.abs + 1} — ${PAGES.length}</div>
        <button class="turn-zone left" data-turn="prev" title="上一页"><span>‹</span></button>
        <button class="turn-zone right" data-turn="next" title="下一页"><span>›</span></button>
      </section>`;
  }

  function sceneOf(info) { return S[info.sceneKey] || S.fallback; }

  /* ---------------- 前言 / 目录 / 后记 ---------------- */
  function sheetHTML(p) {
    if (p.kind === 'intro') {
      return `
        <div class="sheet">
          <h2>关于这本 3D 书</h2>
          <div class="sheet-sub">PREFACE · 一本把 20 章笔记装订起来的三维书</div>
          <div class="intro-cols">
            <p>这本书的全部正文来自 GitHub 上的开源笔记
              <b>liuhaopeng543/MathBook</b>（MIT 许可）。原仓库是 20 个 Markdown 文件：
              01 方程求解、02 集合、03 不等式、04 函数、05 基本计算、06 三角恒等变换、
              07 平面向量、08 立体几何、09 空间向量、10 解析几何、11 数列、12 导数、
              13 统计、14 概率、15 组合计数、16 线性规划、17 数论、18 常用三角函数值、
              19 应试要求、99 高等数学。</p>
            <h3>编排方式</h3>
            <p>每章按原笔记的二级、三级标题分节；某一节过长时，在句群与列表项之间断页，
              续页的标题后标“（续）”。标题里的公式也照原样排版，没有改写成图片。</p>
            <h3>怎么读</h3>
            <p>左右方向键或页面两侧箭头翻页；顶部“目录”打开章节树，“检索”可在全书范围内
              搜索词句（例如“二面角”“裂项”“洛必达”）。右侧（手机为上方）的三维展台可以
              拖动旋转、滚轮缩放，芯片按钮切换本章的不同演示。</p>
            <h3>公式</h3>
            <p>源笔记使用了 149 个 LaTeX 宏，包括 cases、aligned、pmatrix、vmatrix、
              红字标注与自定义的集合、向量记号。书里的每一个公式都在构建阶段被解析成
              带语义的 HTML，因此可以随字号缩放、可以选中复制，也不需要联网加载任何字体或脚本。</p>
            <h3>关于插图</h3>
            <p>原笔记有 25 张插图托管在外部图床。离线单文件无法引用外链图片，
              因此正文中的图位保留为“原笔记插图”占位卡，并在旁边给出对应的三维演示——
              尤其立体几何一章的 13 张图，都换成了可以转动的正方体截面、二面角与外接球。</p>
            <h3>技术</h3>
            <p>三维部分是自己写的 Canvas 2D 引擎：透视投影、画家算法、手绘抖动墨线、
              球面大圆、拾取高亮。它不依赖 three.js，也不加载任何外部资源。
              书页部分是 CSS 3D 的翻页动画，配色有五套，可随时切换。</p>
          </div>
          <div class="intro-note">
            <b>一句话使用说明</b>：先用「目录」找到章节，再用「检索」定位具体结论；
            遇到空间想象的部分，就拖一下右边的图。<br>
            快捷键：<b>← →</b> 翻页 · <b>M</b> 目录 · <b>/</b> 检索 · <b>T</b> 透视 · <b>L</b> 标注 · <b>Home/End</b> 首末页。
          </div>
        </div>`;
    }
    if (p.kind === 'toc') {
      return `
        <div class="sheet">
          <h2>全书目录</h2>
          <div class="sheet-sub">CONTENTS · 第 ${p.part} 部分 / 共 2 部分 · 20 章 ${RAW.stats.pages} 页</div>
          <div class="toc-grid">
            ${p.group.map(c => `
              <button class="toc-item" data-goto="${FRONT + c.first}">
                <span class="no">${c.no}</span>
                <span class="t">
                  <b>${esc(c.title)}</b>
                  <span>${c.sections.slice(0, 6).map(s => esc(s.t)).join(' · ')}${c.sections.length > 6 ? ' …' : ''}</span>
                </span>
                <span class="cnt">${c.sections.length} 节</span>
                <span class="pg">P.${FRONT + c.first + 1}</span>
              </button>`).join('')}
          </div>
          <div class="intro-note" style="margin-top:14px">
            点击任意条目直接跳转；也可以在顶部「检索」里输入关键词，全书 ${RAW.stats.pages} 页会同时被搜索。
          </div>
        </div>`;
    }
    return `
      <div class="sheet">
        <h2>后记 · 来源与许可</h2>
        <div class="sheet-sub">COLOPHON</div>
        <dl class="kv">
          <dt>内容来源</dt><dd>GitHub · liuhaopeng543/MathBook（20 个 Markdown 章节）</dd>
          <dt>许可</dt><dd>MIT License © 2025 liuhaopeng543</dd>
          <dt>收录范围</dt><dd>01–19 章与 99 章全部正文，按原顺序与层级编排，未作删节</dd>
          <dt>未收录</dt><dd>原仓库另有《数学笔记old.md》（旧版）与合并版《数学笔记全.md》、PDF 一份；本书以分章文件为准，已覆盖合并版的全部章节</dd>
          <dt>页数</dt><dd>正文 ${RAW.stats.pages} 页 · 约 ${(RAW.stats.words / 1000).toFixed(1)} 千字 · 构建于 ${RAW.built}</dd>
          <dt>排版</dt><dd>自研 LaTeX 子集渲染器（149 个宏）· 自研 Canvas 2D 三维引擎 · 五套配色</dd>
          <dt>离线</dt><dd>单文件 HTML，不含任何外部脚本、样式、字体或图片请求</dd>
        </dl>
        <div class="intro-note" style="margin-top:16px">
          <b>给读者</b>：笔记是别人的学习痕迹，错误与个人风格都在其中；遇到可疑的结论，
          请回到教材与定义自己推一遍——这也是这本 3D 书把图形交给你旋转的原因。
        </div>
      </div>`;
  }

  /* ---------------- 三维展台 ---------------- */
  function modeList(info) {
    const sc = sceneOf(info);
    return sc.modes && sc.modes.length ? sc.modes : [];
  }
  function currentMode(info) {
    const modes = modeList(info);
    if (!modes.length) return null;
    const key = info.chId || 'front';
    let m = state.modes[key];
    if (!modes.some(x => x.id === m)) { m = modes[0].id; state.modes[key] = m; }
    return m;
  }

  function bindViz(info) {
    app.el.viz = document.getElementById('viz');
    if (!app.el.viz) return;
    const canvas = app.el.viz.querySelector('canvas');
    if (!canvas) return;
    const sc = sceneOf(info);
    const key = info.chId || 'front';
    const saved = state.yaw[key] || {};
    const studio = new E.Studio(canvas, Object.assign({ yaw: -0.5, pitch: 0.24, zoom: 1 }, sc.camera || {}, saved));
    app.studio = studio;
    studio.setPalette(enginePalette(PALETTES[state.palette]));
    studio.seeThrough = state.seeThrough;
    studio.showLabels = state.labels;
    studio._anim = !!sc.anim;
    studio.autoSpin = 0;
    studio.onPick = null;

    const modes = modeList(info);
    const tools = document.getElementById('viz-tools');
    tools.innerHTML = modes.map(m => `<button class="chip${m.id === currentMode(info) ? ' on' : ''}" data-mode="${m.id}">${esc(m.name)}</button>`).join('');
    tools.addEventListener('click', e => {
      const b = e.target.closest('[data-mode]');
      if (!b) return;
      state.modes[key] = b.getAttribute('data-mode');
      tools.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === b));
      paintScene();
      save();
    });

    function paintScene() {
      const mode = currentMode(info);
      studio.setScene((t) => sc.build(t, { st: studio, mode, params: {} }));
      const m = modes.find(x => x.id === mode);
      const note = document.getElementById('scene-note');
      if (note) note.innerHTML = m ? m.note : '拖动图形，从不同角度体会这一章的结构。';
      const rh = document.getElementById('rh-scene');
      if (rh) rh.textContent = sc.name + (m ? ' · ' + m.name : '');
      studio.dirty = true;
    }
    paintScene();

    // 保存视角
    const keepView = () => { state.yaw[key] = { yaw: studio.yaw, pitch: studio.pitch, zoom: studio.zoom }; };
    canvas.addEventListener('pointerup', keepView);
    canvas.addEventListener('wheel', keepView, { passive: true });

    app.el.viz.querySelectorAll('[data-viz]').forEach(b => {
      b.addEventListener('click', () => {
        const act = b.getAttribute('data-viz');
        if (act === 'zoom-in') studio.zoom = Math.min(3.2, studio.zoom * 1.12);
        else if (act === 'zoom-out') studio.zoom = Math.max(0.45, studio.zoom / 1.12);
        else if (act === 'reset') {
          studio.yaw = (sc.camera && sc.camera.yaw) || -0.5;
          studio.pitch = (sc.camera && sc.camera.pitch) || 0.24;
          studio.zoom = (sc.camera && sc.camera.zoom) || 1;
          delete state.yaw[key];
        }
        studio.dirty = true;
        keepView();
      });
    });
  }

  function bindCover() {
    const canvas = document.getElementById('cover-canvas');
    if (!canvas) return;
    const sc = S.cover;
    const studio = new E.Studio(canvas, Object.assign({ yaw: -0.55, pitch: 0.24, zoom: 1 }, sc.camera || {}));
    app.studio = studio;
    studio.setPalette(enginePalette(PALETTES[state.palette]));
    studio.seeThrough = state.seeThrough;
    studio.showLabels = state.labels;
    studio.autoSpin = 0.075;
    studio._anim = true;
    studio.setScene((t) => sc.build(t, { st: studio, mode: 'cover', params: {} }));
    document.querySelectorAll('[data-goto]').forEach(a => {
      a.addEventListener('click', e => { e.preventDefault(); go(parseInt(a.getAttribute('data-goto'), 10)); });
    });
  }

  /* ---------------- 正文交互 ---------------- */
  function bindText() {
    const pane = document.getElementById('pane');
    if (pane) {
      pane.scrollTop = 0;
      fitMath(pane);
    }
    closeBigTable();
    document.querySelectorAll('[data-turn]').forEach(b => {
      b.addEventListener('click', e => {
        e.stopPropagation();
        go(state.page + (b.getAttribute('data-turn') === 'next' ? 1 : -1));
      });
    });
    document.querySelectorAll('[data-goto]').forEach(a => {
      a.addEventListener('click', e => { e.preventDefault(); go(parseInt(a.getAttribute('data-goto'), 10)); });
    });
    // 双击展台复位
    const cv = app.el.viz.querySelector('canvas');
    if (cv) cv.addEventListener('dblclick', () => {
      if (app.studio) { app.studio.reset(); app.studio.dirty = true; }
    });
  }

  /* 宽表格：包一层容器 + 「放大」按钮，浮层里按 94vw 重新排版 */
  function wrapWideTables(pane) {
    pane.querySelectorAll('.tb-wrap').forEach(wrap => {
      const t = wrap.querySelector('table');
      if (!t) return;
      const wide = t.scrollWidth > wrap.clientWidth + 2 || wrap.scrollHeight > 540;
      if (!wide) return;
      const box = document.createElement('div');
      box.className = 'tb-wide';
      wrap.parentNode.insertBefore(box, wrap);
      box.appendChild(wrap);
      const btn = document.createElement('button');
      btn.className = 'zoom-chip';
      btn.type = 'button';
      btn.textContent = '⤢ 放大表格';
      btn.addEventListener('click', e => {
        e.stopPropagation();
        openBigTable(t);
      });
      box.appendChild(btn);
    });
  }

  function openBigTable(table) {
    const layer = document.getElementById('bigtable-layer');
    const panel = document.getElementById('bigtable-panel');
    if (!layer || !panel) return;
    const info = pageInfo(app.page);
    panel.innerHTML = '<div class="bigtable-head"><b>' +
      esc((info.chTitle || '表格')) + ' · 表格放大</b><span>点击空白处或按 Esc 关闭</span></div>' + table.outerHTML;
    layer.classList.add('on');
  }

  function closeBigTable() {
    const layer = document.getElementById('bigtable-layer');
    if (layer) layer.classList.remove('on');
  }
  document.addEventListener('click', e => {
    const layer = document.getElementById('bigtable-layer');
    if (!layer) return;
    if (e.target === layer || (e.target.closest && e.target.closest('.bigtable-head'))) closeBigTable();
  });

  /* 过宽的公式逐级缩排，实在放不下就允许横向滚动 */
  function fitMath(pane) {
    pane.querySelectorAll('.math-block').forEach(el => {
      let guard = 0;
      while (el.scrollWidth > el.clientWidth + 1 && guard < 3) {
        guard++;
        if (guard === 1) el.classList.add('fit-s');
        else if (guard === 2) el.classList.add('fit-xs');
        else el.classList.add('fit-scroll');
      }
    });
    wrapWideTables(pane);
  }

  function addFlip(dir) {
    if (!dir) return;
    const layer = document.createElement('div');
    layer.className = 'flip-layer';
    layer.innerHTML = '<div class="flip-page"></div>';
    app.el.book.appendChild(layer);
    layer.classList.add('run', dir === 'next' ? 'next' : 'prev');
    setTimeout(() => layer.remove(), 640);
  }

  /* ---------------- 导航 ---------------- */
  function go(n, animate) {
    n = Math.max(0, Math.min(PAGES.length - 1, n));
    if (n === state.page) return;
    const dir = animate === false ? null : (n > state.page ? 'next' : 'prev');
    state.page = n;
    render(dir);
  }
  window.BOOK_GO = go;

  function updateNav(info) {
    app.el.prev.disabled = state.page <= 0;
    app.el.next.disabled = state.page >= PAGES.length - 1;
    app.el.fill.style.width = ((state.page + 1) / PAGES.length * 100).toFixed(2) + '%';
    const label = info.chNo
      ? `第 ${pad(state.page + 1, 3)} 页 / ${PAGES.length} · ${info.chNo} ${info.chShort || info.chTitle}`
      : `${pad(state.page + 1, 3)} / ${PAGES.length} · ${info.title}`;
    app.el.label.textContent = label;
    app.el.chSel.value = info.chId || '';
  }

  /* ---------------- 侧栏 ---------------- */
  function buildSidebar() {
    const body = app.el.sbBody;
    body.innerHTML = RAW.chapters.map(c => `
      <button class="sb-ch" data-ch="${c.id}" data-goto="${FRONT + c.first}">
        <span class="no">${c.no}</span><span class="nm">${esc(c.title)}</span><span class="pg">${c.count}p</span>
      </button>
      <div class="sb-secs" data-secs="${c.id}">
        ${c.sections.map(s => `<button class="sb-sec" data-goto="${FRONT + s.page}"><span>${esc(s.t)}</span><span class="pg">${FRONT + s.page + 1}</span></button>`).join('')}
      </div>`).join('');
    body.addEventListener('click', e => {
      const b = e.target.closest('[data-goto]');
      if (b) {
        e.preventDefault();
        go(parseInt(b.getAttribute('data-goto'), 10));
        if (window.innerWidth <= 980) app.el.sidebar.classList.add('hide');
        return;
      }
    });
    app.el.stats.textContent = `${RAW.chapters.length} 章 · ${RAW.stats.pages} 页`;
  }

  function updateSidebar(info) {
    const body = app.el.sbBody;
    body.querySelectorAll('.sb-ch').forEach(b => b.classList.toggle('on', b.getAttribute('data-ch') === info.chId));
    body.querySelectorAll('.sb-secs').forEach(d => d.classList.toggle('open', d.getAttribute('data-secs') === info.chId));
    body.querySelectorAll('.sb-sec').forEach(b => {
      const target = parseInt(b.getAttribute('data-goto'), 10);
      b.classList.toggle('on', target === state.page);
    });
    if (info.chId) {
      const on = body.querySelector('.sb-ch.on');
      if (on && on.scrollIntoView) {
        const r = body.getBoundingClientRect(), br = on.getBoundingClientRect();
        if (br.top < r.top + 8 || br.bottom > r.bottom - 8) on.scrollIntoView({ block: 'nearest' });
      }
    }
  }

  /* ---------------- 检索 ---------------- */
  let INDEX = null;
  function buildIndex() {
    const out = [];
    RAW.pages.forEach((p, i) => {
      const txt = String(p.html).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ').trim();
      out.push({ i, ch: p.ch, chTitle: p.chTitle, sec: p.sec, txt });
    });
    INDEX = out;
  }
  function search(q) {
    if (!INDEX) buildIndex();
    const kw = q.trim();
    if (!kw) return [];
    const res = [];
    for (const it of INDEX) {
      const at = it.txt.indexOf(kw);
      if (at < 0) continue;
      const s0 = Math.max(0, at - 42), s1 = Math.min(it.txt.length, at + kw.length + 60);
      res.push({
        abs: FRONT + it.i, ch: it.ch, chTitle: it.chTitle, sec: it.sec,
        before: it.txt.slice(s0, at), kw, after: it.txt.slice(at + kw.length, s1),
        count: (it.txt.match(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length,
      });
      if (res.length >= 200) break;
    }
    return res;
  }
  function renderSearch(q) {
    const list = app.el.searchList, meta = app.el.searchMeta;
    if (!q.trim()) { list.innerHTML = '<div class="sr-empty">输入关键词开始检索，例如：二面角 / 裂项 / 洛必达 / 韦达定理</div>'; meta.textContent = ''; return; }
    const res = search(q);
    meta.textContent = `命中 ${res.length} 页${res.length >= 200 ? '（只显示前 200 条）' : ''}`;
    if (!res.length) { list.innerHTML = '<div class="sr-empty">没有找到包含该词句的页面，试试更短的关键词。</div>'; return; }
    list.innerHTML = res.map(r => `
      <button class="sr" data-abs="${r.abs}">
        <div class="sr-h">${r.ch} ${esc(r.chTitle)} · ${esc(r.sec || '')} · 第 ${r.abs + 1} 页</div>
        <div class="sr-t">${esc(r.kw)}${r.count > 1 ? `（本页 ${r.count} 处）` : ''}</div>
        <div class="sr-s">…${esc(r.before)}<mark>${esc(r.kw)}</mark>${esc(r.after)}…</div>
      </button>`).join('');
  }

  /* ---------------- 全局控件 ---------------- */
  function bindGlobal() {
    app.el.see.addEventListener('click', () => {
      state.seeThrough = !state.seeThrough;
      app.el.see.classList.toggle('on', state.seeThrough);
      if (app.studio) { app.studio.seeThrough = state.seeThrough; app.studio.dirty = true; }
      save();
    });
    app.el.labels.addEventListener('click', () => {
      state.labels = !state.labels;
      app.el.labels.classList.toggle('on', state.labels);
      if (app.studio) { app.studio.showLabels = state.labels; app.studio.dirty = true; }
      save();
    });
    app.el.swatches.innerHTML = PALETTES.map((p, i) =>
      `<button class="swatch${i === state.palette ? ' on' : ''}" data-pal="${i}" title="${p.name}" style="background:${p.accent}"></button>`).join('');
    app.el.swatches.addEventListener('click', e => {
      const b = e.target.closest('[data-pal]');
      if (!b) return;
      state.palette = parseInt(b.getAttribute('data-pal'), 10);
      app.el.swatches.querySelectorAll('.swatch').forEach((s, i) => s.classList.toggle('on', i === state.palette));
      applyCssPalette(PALETTES[state.palette]);
      if (app.studio) app.studio.setPalette(enginePalette(PALETTES[state.palette]));
      save();
    });
    app.el.reset.addEventListener('click', () => {
      if (app.studio) { app.studio.reset(); app.studio.dirty = true; }
      const info = pageInfo(app.page);
      const k = info.chId || 'front';
      delete state.yaw[k];
      if (info.chId) { state.modes[info.chId] = null; render(null); }
      else if (app.page.kind === 'cover') render(null);
    });
    app.el.prev.addEventListener('click', () => go(state.page - 1));
    app.el.next.addEventListener('click', () => go(state.page + 1));
    app.el.chSel.addEventListener('change', e => {
      const c = CH[e.target.value];
      if (c) go(FRONT + c.first);
    });
    app.el.toc.addEventListener('click', () => {
      app.el.sidebar.classList.toggle('hide');
      if (!app.el.sidebar.classList.contains('hide')) app.el.sbBody.scrollTop = 0;
    });
    app.el.menu.addEventListener('click', () => app.el.sidebar.classList.toggle('hide'));

    app.el.fontMinus.addEventListener('click', () => setFont(state.fontScale - 0.08));
    app.el.fontPlus.addEventListener('click', () => setFont(state.fontScale + 0.08));

    // 检索
    app.el.search.addEventListener('click', openSearch);
    app.el.searchClose.addEventListener('click', closeSearch);
    app.el.searchLayer.addEventListener('click', e => { if (e.target === app.el.searchLayer) closeSearch(); });
    let timer = null;
    app.el.searchInput.addEventListener('input', e => {
      clearTimeout(timer);
      const v = e.target.value;
      timer = setTimeout(() => renderSearch(v), 120);
    });
    app.el.searchList.addEventListener('click', e => {
      const b = e.target.closest('[data-abs]');
      if (!b) return;
      go(parseInt(b.getAttribute('data-abs'), 10));
      closeSearch();
    });

    document.addEventListener('keydown', e => {
      const bt = document.getElementById('bigtable-layer');
      if (bt && bt.classList.contains('on')) {
        if (e.key === 'Escape') { closeBigTable(); e.preventDefault(); }
        return;
      }
      const t = e.target;
      if (t && t.matches && t.matches('input, textarea, select')) {
        if (e.key === 'Escape') { closeSearch(); t.blur(); }
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { go(state.page + 1); e.preventDefault(); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { go(state.page - 1); e.preventDefault(); }
      else if (e.key === 'Home') { go(0); e.preventDefault(); }
      else if (e.key === 'End') { go(PAGES.length - 1); e.preventDefault(); }
      else if (e.key === 't' || e.key === 'T') app.el.see.click();
      else if (e.key === 'l' || e.key === 'L') app.el.labels.click();
      else if (e.key === 'm' || e.key === 'M') app.el.toc.click();
      else if (e.key === '/') { openSearch(); e.preventDefault(); }
      else if (e.key === 'Escape') closeSearch();
    });
  }

  function setFont(v) {
    state.fontScale = Math.max(0.8, Math.min(1.5, Math.round(v * 100) / 100));
    applyFont();
    save();
  }

  function openSearch() {
    app.el.searchLayer.classList.add('open');
    app.el.searchInput.focus();
    renderSearch(app.el.searchInput.value);
  }
  function closeSearch() {
    app.el.searchLayer.classList.remove('open');
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    app.state = state;
    app.el.book = document.getElementById('book');
    app.el.prev = document.getElementById('nav-prev');
    app.el.next = document.getElementById('nav-next');
    app.el.fill = document.getElementById('prog-fill');
    app.el.label = document.getElementById('page-label');
    app.el.chSel = document.getElementById('ch-select');
    app.el.see = document.getElementById('btn-see');
    app.el.labels = document.getElementById('btn-labels');
    app.el.swatches = document.getElementById('swatches');
    app.el.reset = document.getElementById('btn-reset');
    app.el.toc = document.getElementById('btn-toc');
    app.el.menu = document.getElementById('btn-menu');
    app.el.sidebar = document.getElementById('sidebar');
    app.el.sbBody = document.getElementById('sb-body');
    app.el.stats = document.getElementById('sb-stats');
    app.el.fontMinus = document.querySelector('[data-font="-1"]');
    app.el.fontPlus = document.querySelector('[data-font="1"]');
    app.el.fontVal = document.getElementById('font-val');
    app.el.search = document.getElementById('btn-search');
    app.el.searchLayer = document.getElementById('search-layer');
    app.el.searchInput = document.getElementById('search-input');
    app.el.searchList = document.getElementById('search-list');
    app.el.searchMeta = document.getElementById('search-meta');
    app.el.searchClose = document.getElementById('search-close');
    app.el.brandSub = document.getElementById('brand-sub');
    app.el.brandSub.textContent = `${RAW.chapters.length} 章 · ${RAW.stats.pages} 页 · ${RAW.author}`;

    app.el.chSel.innerHTML = '<option value="">跳转章节</option>' + RAW.chapters.map(c =>
      `<option value="${c.id}">${c.no} ${esc(c.title)}</option>`).join('');

    applyCssPalette(PALETTES[state.palette]);
    applyFont();
    app.el.see.classList.toggle('on', state.seeThrough);
    app.el.labels.classList.toggle('on', state.labels);
    buildSidebar();
    bindGlobal();

    let start = 0;
    const h = /#p(\d+)/.exec(location.hash || '');
    if (h) start = Math.max(0, Math.min(PAGES.length - 1, parseInt(h[1], 10) - 1));
    else if (typeof store.page === 'number') start = Math.max(0, Math.min(PAGES.length - 1, store.page));
    state.page = start;
    render(null);
  }

  app.pages = PAGES;
  app.raw = RAW;
  window.PAGES_META = { total: PAGES.length, front: FRONT, chapters: RAW.chapters };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
