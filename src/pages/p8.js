/* =============================================================
   第 8 页 · 8.5 空间直线、平面的平行
   知识点：基本事实 4（平行传递性）；线面平行判定/性质；
           面面平行判定/性质；三种平行的转化路径
   ============================================================= */
(function () {
  'use strict';
  const E = window.Ink3D, G = window.Geo;
  const V = E.V;

  const MODES = {
    judge: {
      tag: '线面平行 · 判定',
      text: '如果平面外一条直线与此平面内的一条直线平行，那么该直线与此平面平行。<br><span class="sym">a ⊄ α，b ⊂ α，a ∥ b ⟹ a ∥ α</span><br>口诀：<b>线线平行 ⟹ 线面平行</b>。三个条件缺一不可，尤其“a ⊄ α”。',
    },
    prop: {
      tag: '线面平行 · 性质',
      text: '一条直线与一个平面平行，如果过该直线的平面与此平面相交，那么该直线与交线平行。<br><span class="sym">a ∥ α，a ⊂ β，α ∩ β = b ⟹ a ∥ b</span><br>口诀：<b>线面平行 ⟹ 线线平行</b>。',
    },
    judge2: {
      tag: '面面平行 · 判定',
      text: '如果一个平面内的两条相交直线与另一个平面平行，那么这两个平面平行。<br><span class="sym">a ⊂ β，b ⊂ β，a ∩ b = P，a ∥ α，b ∥ α ⟹ β ∥ α</span><br>关键在于两条直线必须<b>相交</b>。',
    },
    prop2: {
      tag: '面面平行 · 性质',
      text: '两个平面平行，如果另一个平面与这两个平面相交，那么两条交线平行。<br><span class="sym">α ∥ β，γ ∩ α = a，γ ∩ β = b ⟹ a ∥ b</span><br>这给出了“面面平行 ⟹ 线线平行”的通路。',
    },
    mid: {
      tag: '中点四边形（教材例1）',
      text: '空间四边形 ABCD 中，E、F、G、H 分别是 AB、BC、CD、DA 的中点。连接 BD，由三角形中位线得 EH ∥ BD、FG ∥ BD，再由基本事实 4 得 EH ∥ FG，且 EH = FG = ½BD，故 EFGH 是平行四边形。',
    },
    path: {
      tag: '转化路径',
      text: '线线平行 ⟹ 线面平行 ⟹ 面面平行，反过来又可以用性质定理逐级下降。这张“平行关系转化图”是本章最重要的结构图。',
    },
  };

  window.PAGES.push({
    id: 'p8',
    short: '8.5 平行关系',
    title: '8.5 空间直线、平面的平行',
    running: '8.5 平行关系',
    chapter: '8.5',
    defaults: { mode: 'judge' },
    vizTools: `
      <button class="chip on" data-viz="p-judge">线面平行·判定</button>
      <button class="chip" data-viz="p-prop">线面平行·性质</button>
      <button class="chip" data-viz="p-judge2">面面平行·判定</button>
      <button class="chip" data-viz="p-prop2">面面平行·性质</button>
      <button class="chip ghost" data-viz="p-path">转化路径</button>
      <button class="chip ghost" data-viz="p-mid">中点四边形</button>
      <div class="viz-card" id="p8-note"></div>`,
    camera: { zoom: 1.05, pitch: 0.28, yaw: -0.55, offset: [0, 1.0, 0], dist: 11, fov: 8.4 },

    scene(t, ctx) {
      const st = ctx.studio, mode = ctx.params.mode;
      const items = [];
      const cube = G.cube({ st, a: 2.3, key: 'c', alpha: mode === 'path' ? 0.5 : 0.92 });
      if (mode !== 'path' && mode !== 'mid') items.push(cube.items);
      const { A, B, C, D } = cube.v;
      const A1 = cube.v['A₁'], B1 = cube.v['B₁'], C1 = cube.v['C₁'], D1 = cube.v['D₁'];
      // 空间四边形 ABCD 的中点四边形 EFGH（E∈AB，F∈BC，G∈CD，H∈DA）
      const E0 = G.mid(A, B), F0 = G.mid(B, C), G0 = G.mid(C, D), H0 = G.mid(D, A);
      const seg = (p, q, key, opt) => E.line(p, q, Object.assign({ color: G.accent(st), sw: 3, key, layer: 'top' }, opt));
      const plane = (pts, key, tip) => E.face(pts, {
        color: G.accent(st), alpha0: 0.22, edgeColor: G.accent(st), sw: 1.8, layer: 'top', key, tip, dash: null,
      });

      if (mode === 'mid') {
        // 空间四边形 = 用一顶点与底面三点构造四面体
        const T = [0, 2.45, 0];
        const faces = [[A, B, C], [A, B, T], [B, C, T], [C, A, T]];
        faces.forEach((f, i) => items.push(E.face(f, {
          color: G.tint(st, 0.04 + i * 0.02), key: 'sf' + i, edgeColor: G.ink(st), sw: 1.4,
        })));
        items.push(seg(E0, F0, 'mq:1', { tip: 'EF ∥ BD' }));
        items.push(seg(F0, G0, 'mq:2', { tip: 'FG ∥ BD' }));
        items.push(seg(G0, H0, 'mq:3', { tip: 'GH ∥ BD' }));
        items.push(seg(H0, E0, 'mq:4', { tip: 'HE ∥ BD' }));
        items.push(E.line(B, D, { color: G.ink(st), sw: 1.4, dash: [5, 4], key: 'mq:bd' }));
        items.push(E.line(A, C, { color: G.ink(st), sw: 1, dash: [4, 4], alpha: 0.45 }));
        [E0, F0, G0, H0].forEach((p, i) => items.push(E.point(p, { r: 3.6, key: 'mq:' + 'EFGH'[i] })));
        items.push(E.label(E0, 'E', { dx: -14, dy: 2, size: 12.5, key: 'mq:1' }));
        items.push(E.label(F0, 'F', { dx: 14, dy: 4, size: 12.5, key: 'mq:2' }));
        items.push(E.label(G0, 'G', { dx: 14, dy: 10, size: 12.5, key: 'mq:3' }));
        items.push(E.label(H0, 'H', { dx: -14, dy: 10, size: 12.5, key: 'mq:4' }));
        items.push(E.label(T, 'D', { dx: 6, dy: -14, size: 12.5 }));
        items.push(E.label(A, 'A', { dx: -14, dy: 8, size: 12.5 }));
        items.push(E.label(B, 'B', { dx: 16, dy: 6, size: 12.5 }));
        items.push(E.label(C, 'C', { dx: 10, dy: 12, size: 12.5 }));
        items.push(E.label([0.1, 3.05, 0], 'EH ∥ BD，FG ∥ BD ⟹ EH ∥ FG', { size: 11, color: G.accent(st), key: 'mq:1' }));
        return { items, fit: 1.0 };
      }

      if (mode === 'judge') {
        // a = A₁B₁，平面 α = 底面 ABCD，b = AB
        items.push(plane([A, B, C, D], 'pj:alpha', '平面 α：平面 ABCD'));
        items.push(seg(A1, B1, 'pj:a', { tip: 'a = A₁B₁ ⊄ α' }));
        items.push(seg(A, B, 'pj:b', { tip: 'b = AB ⊂ α' }));
        items.push(E.line(A, A1, { color: G.ink(st), sw: 1, dash: [4, 4], alpha: 0.5 }));
        items.push(E.line(B, B1, { color: G.ink(st), sw: 1, dash: [4, 4], alpha: 0.5 }));
        items.push(E.label([1.52, 0.02, -1.0], 'α', { size: 14, key: 'pj:alpha' }));
        items.push(E.label(G.mid(A1, B1), 'a', { size: 14, color: G.accent(st), dy: -18, key: 'pj:a' }));
        items.push(E.label(G.mid(A, B), 'b', { size: 14, color: G.accent(st), dy: 22, key: 'pj:b' }));
        items.push(E.label([0, 3.05, 0], 'a ⊄ α，b ⊂ α，a ∥ b ⟹ a ∥ α', { size: 11.5, color: G.accent(st), key: 'pj:a' }));
      }

      if (mode === 'prop') {
        // a = A₁B₁ ∥ 平面 ABCD；过 a 的平面 γ = 平面 ABB₁A₁ 与 α 交于 AB
        items.push(plane([A, B, C, D], 'pp:alpha', '平面 α'));
        items.push(plane([A, B, B1, A1], 'pp:gamma', '平面 γ：过 a 的平面'));
        items.push(seg(A1, B1, 'pp:a', { tip: 'a ∥ α' }));
        items.push(seg(A, B, 'pp:b', { tip: 'α ∩ γ = b = AB，且 a ∥ b' }));
        items.push(E.label([-1.18, 1.2, 0.2], 'γ', { size: 14, key: 'pp:gamma' }));
        items.push(E.label([1.52, 0.02, -1.0], 'α', { size: 14, key: 'pp:alpha' }));
        items.push(E.label(G.mid(A1, B1), 'a', { size: 13, color: G.accent(st), dy: -18, key: 'pp:a' }));
        items.push(E.label(G.mid(A, B), 'b', { size: 13, color: G.accent(st), dy: 22, key: 'pp:b' }));
        items.push(E.label([0, 3.05, 0], 'a ∥ α，a ⊂ γ，α ∩ γ = b ⟹ a ∥ b', { size: 11.5, color: G.accent(st), key: 'pp:a' }));
      }

      if (mode === 'judge2') {
        // 平面 β = 平面 A₁B₁C₁D₁ 内两条相交直线 A₁C₁、B₁D₁ 都平行于 α = 平面 ABCD
        items.push(plane([A, B, C, D], 'pj2:alpha', '平面 α：底面'));
        items.push(plane([A1, B1, C1, D1], 'pj2:beta', '平面 β：上底面'));
        items.push(seg(A1, C1, 'pj2:a', { tip: 'A₁C₁ ∥ 平面 α' }));
        items.push(seg(B1, D1, 'pj2:b', { tip: 'B₁D₁ ∥ 平面 α' }));
        items.push(E.point(G.centroid([A1, B1, C1, D1]), { r: 4, ring: true, key: 'pj2:a' }));
        items.push(E.label([0, 2.55, 0], 'A₁C₁ ∩ B₁D₁ ≠ ∅', { size: 10.5, color: G.accent(st), key: 'pj2:a' }));
        items.push(E.label([1.52, 0.02, -1.0], 'α', { size: 14, key: 'pj2:alpha' }));
        items.push(E.label([1.52, 2.32, -1.0], 'β', { size: 14, key: 'pj2:beta' }));
        items.push(E.label([0, 3.05, 0], '两条相交直线都平行于 α ⟹ β ∥ α', { size: 11.5, color: G.accent(st), key: 'pj2:a' }));
      }

      if (mode === 'prop2') {
        // α ∥ β，γ 与它们相交于 a、b
        items.push(plane([A, B, C, D], 'pp2:alpha', '平面 α'));
        items.push(plane([A1, B1, C1, D1], 'pp2:beta', '平面 β ∥ α'));
        items.push(plane([A, B, B1, A1], 'pp2:gamma', '平面 γ 与 α、β 都相交'));
        items.push(seg(A, B, 'pp2:a', { tip: 'γ ∩ α = a = AB' }));
        items.push(seg(A1, B1, 'pp2:b', { tip: 'γ ∩ β = b = A₁B₁，且 a ∥ b' }));
        items.push(E.label([-1.42, 1.15, 0.4], 'γ', { size: 14, key: 'pp2:gamma' }));
        items.push(E.label([1.52, 0.02, -1.0], 'α', { size: 14, key: 'pp2:alpha' }));
        items.push(E.label([1.52, 2.32, -1.0], 'β', { size: 14, key: 'pp2:beta' }));
        items.push(E.label([0, 3.05, 0], 'α ∥ β ⟹ 交线 a ∥ b', { size: 11.5, color: G.accent(st), key: 'pp2:a' }));
      }

      if (mode === 'path') {
        // 三个层次的转化图：线线 → 线面 → 面面
        const lv = [2.35, 0.0, -2.35];
        const boxes = [
          { y: lv[0], t: '线线平行', s: 'a ∥ b' },
          { y: lv[1], t: '线面平行', s: 'a ∥ α' },
          { y: lv[2], t: '面面平行', s: 'α ∥ β' },
        ];
        boxes.forEach((b, i) => {
          const pts = [[-1.5, b.y, -0.55], [1.5, b.y, -0.55], [1.5, b.y + 1.25, -0.55], [-1.5, b.y + 1.25, -0.55]];
          items.push(E.face(pts, {
            color: G.accent(st), alpha0: 0.16 + i * 0.04, edgeColor: G.accent(st), sw: 2, layer: 'top',
            key: 'path' + i, tip: b.t,
          }));
          items.push(E.label([0, b.y + 0.62, -0.55], b.t, { size: 15, color: G.accent(st), key: 'path' + i }));
          items.push(E.label([0, b.y + 0.16, -0.55], b.s, { size: 11, alpha: 0.8, key: 'path' + i }));
        });
        // 下行箭头（判定）
        items.push(G.arrow([-0.55, lv[0], -0.55], [-0.55, lv[1] + 1.3, -0.55], { color: G.ink(st), sw: 1.8 }));
        items.push(G.arrow([-0.55, lv[1], -0.55], [-0.55, lv[2] + 1.3, -0.55], { color: G.ink(st), sw: 1.8 }));
        // 上行箭头（性质）
        items.push(G.arrow([0.75, lv[1] + 1.3, -0.55], [0.75, lv[0], -0.55], { color: G.accent2 ? G.accent(st) : G.accent(st), sw: 1.8, dash: [5, 4] }));
        items.push(G.arrow([0.75, lv[2] + 1.3, -0.55], [0.75, lv[1], -0.55], { color: G.accent(st), sw: 1.8, dash: [5, 4] }));
        items.push(E.label([-1.15, lv[0] - 0.5, -0.55], '判定 ↓', { size: 10, alpha: 0.85 }));
        items.push(E.label([1.5, lv[0] - 0.5, -0.55], '性质 ↑', { size: 10, alpha: 0.9, color: G.accent(st) }));
      }
      return { items, fit: mode === 'path' ? 0.92 : 1.0 };
    },

    onViz(act, el, ctx) {
      if (act.indexOf('p-') === 0) {
        const map = { 'p-judge': 'judge', 'p-prop': 'prop', 'p-judge2': 'judge2', 'p-prop2': 'prop2', 'p-path': 'path', 'p-mid': 'mid' };
        ctx.params.mode = map[act];
        ctx.root.querySelectorAll('[data-viz^="p-"]').forEach(b => b.classList.toggle('on', b === el));
        const info = MODES[ctx.params.mode];
        const n = ctx.root.querySelector('#p8-note');
        if (n && info) {
          n.innerHTML = `<b>${info.tag}</b><br>${info.text}`;
          n.classList.remove('hide');
        }
        ctx.studio.focusOn([]);
        ctx.studio.dirty = true;
      }
    },

    init(ctx) {
      const n = ctx.root.querySelector('#p8-note');
      if (n) {
        n.innerHTML = `<b>${MODES.judge.tag}</b><br>${MODES.judge.text}`;
        n.classList.remove('hide');
        n.addEventListener('click', () => n.classList.add('hide'));
      }
      const host = ctx.root.querySelector('#p8-steps');
      if (host) window.UI.mountSteps(host, [
        { t: '连接 BD。在 △ABD 中，E、H 分别是 AB、DA 的中点，所以 EH ∥ BD 且 EH = ½BD。', why: '三角形中位线定理', keys: ['mq:1', 'mq:4', 'mq:bd'] },
        { t: '在 △CBD 中，F、G 分别是 BC、CD 的中点，所以 FG ∥ BD 且 FG = ½BD。', why: '三角形中位线定理', keys: ['mq:2', 'mq:3', 'mq:bd'] },
        { t: '由基本事实 4（平行传递性）得 EH ∥ FG；又 EH = FG = ½BD。', why: '基本事实 4：平行于同一条直线的两条直线平行', keys: ['mq:1', 'mq:2', 'mq:3', 'mq:4'] },
        { t: '一组对边平行且相等的四边形是平行四边形，故四边形 EFGH 是平行四边形。', why: '平行四边形的判定', keys: ['mq:1', 'mq:2', 'mq:3', 'mq:4'] },
        { t: '本题是“线线平行 ⟹ 线线平行”的典型：借助第三条直线 BD 完成传递，是 8.5 节最基础的证明套路。', why: '8.5 平行关系的核心思想', keys: null },
      ], ctx);
    },

    tip: `平行关系的判定与性质是一对“<b>上行找条件、下行找结论</b>”的定理：判定定理由“线线”推“线面/面面”，性质定理由“面面/线面”推“线面/线线”。记住这条链：<b>线线平行 ⟺ 线面平行 ⟺ 面面平行</b>。`,
    tipMore: `使用判定定理时常见的两个失分点：① 忘记写“a ⊄ α”（线在面外）；② 面面平行判定中两条直线没有“相交”。使用性质定理时，必须先作出（或指出）<b>过已知直线的平面与已知平面的交线</b>——这是“作辅助平面”的功夫。`,

    tabs: {
      knowledge: `
        <h2 class="sec">8.5 平行关系 <span class="tag">判定与性质</span></h2>
        <p class="lead">研究位置关系的一般路径：先定义（充要条件），再找充分条件（判定），最后找必要条件（性质）。</p>
        <div class="theo">
          <div class="theo-t">直线与平面平行的判定定理</div>
          <p>如果平面外一条直线与此平面内的一条直线平行，那么该直线与此平面平行。</p>
          <p><span class="sym">a ⊄ α，b ⊂ α，a ∥ b ⟹ a ∥ α</span></p>
        </div>
        <div class="theo">
          <div class="theo-t">直线与平面平行的性质定理</div>
          <p>一条直线与一个平面平行，如果过该直线的平面与此平面相交，那么该直线与交线平行。</p>
          <p><span class="sym">a ∥ α，a ⊂ β，α ∩ β = b ⟹ a ∥ b</span></p>
        </div>
        <div class="theo">
          <div class="theo-t">平面与平面平行的判定定理</div>
          <p>如果一个平面内的两条相交直线与另一个平面平行，那么这两个平面平行。</p>
          <p><span class="sym">a ⊂ β，b ⊂ β，a ∩ b = P，a ∥ α，b ∥ α ⟹ β ∥ α</span></p>
        </div>
        <div class="theo">
          <div class="theo-t">平面与平面平行的性质定理</div>
          <p>两个平面平行，如果另一个平面与这两个平面相交，那么两条交线平行。</p>
          <p><span class="sym">α ∥ β，γ ∩ α = a，γ ∩ β = b ⟹ a ∥ b</span></p>
        </div>
        <h3 class="sec-sub">平行的其他常用结论</h3>
        <div class="card">
          <ul>
            <li><b>基本事实 4</b>：平行于同一条直线的两条直线平行（传递性）。</li>
            <li>夹在两个平行平面间的平行线段相等（教材 8.5 例 5）。</li>
            <li>两个平面平行，其中一个平面内的任意直线都平行于另一个平面。</li>
            <li>垂直于同一条直线的两个平面互相平行（教材 8.6 习题）。</li>
          </ul>
        </div>
        <div class="note"><b>教材例 4</b>　在正方体 ABCD-A₁B₁C₁D₁ 中，平面 AB₁D₁ ∥ 平面 BC₁D。证法：由 A₁B₁ ∥ DC 且相等得 AB₁ ∥ DC₁ 的类似结构，再对两条相交直线分别用线面平行判定，最后用面面平行判定。</div>
      `,
      example: `
        <h2 class="sec">典型例题 <span class="tag">线线 → 线面</span></h2>
        <div class="card">
          <div class="example-head"><span class="no">例题</span><span class="src">教材 8.5 例 1 · 中点四边形</span></div>
          <p>空间四边形 ABCD 中，E、F、G、H 分别是边 AB、BC、CD、DA 的中点。求证：四边形 EFGH 是平行四边形。</p>
        </div>
        <div id="p8-steps"></div>

        <h3 class="sec-sub">教材例 2 · 线面平行的证明</h3>
        <div class="card soft">
          <p>求证：空间四边形相邻两边中点的连线平行于经过另外两边的平面。</p>
          <p>已知：E、F 分别是 AB、AD 的中点。求证：EF ∥ 平面 BCD。</p>
          <p><b>证明：</b>连接 BD。∵ E、F 分别是 AB、AD 的中点，∴ EF ∥ BD。又 EF ⊄ 平面 BCD，BD ⊂ 平面 BCD，∴ EF ∥ 平面 BCD（线面平行的判定定理）。</p>
        </div>

        <h3 class="sec-sub">标准书写格式（面面平行）</h3>
        <div class="card soft">
          <p>∵ AB₁ ∥ DC₁（或相应平行关系），AB₁ ⊄ 平面 BC₁D，DC₁ ⊂ 平面 BC₁D，</p>
          <p>∴ AB₁ ∥ 平面 BC₁D。同理 AD₁ ∥ 平面 BC₁D。</p>
          <p>又 AB₁ ∩ AD₁ = A，AB₁、AD₁ ⊂ 平面 AB₁D₁，</p>
          <p>∴ 平面 AB₁D₁ ∥ 平面 BC₁D。</p>
        </div>
      `,
      practice: `
        <h2 class="sec">练习 <span class="tag">平行证明</span></h2>
        <div class="q">
          <div class="q-head"><span class="qn">1</span><span>（教材习题 8.5 第 1 题）判断：若直线 l 与平面 α 平行，则 l 与 α 内的任意一条直线都平行。</span></div>
          <div class="opts">
            <button class="opt" data-ok="0"><span class="mk">√</span>正确</button>
            <button class="opt" data-ok="1"><span class="mk">×</span>错误</button>
          </div>
          <button class="ans-btn" data-reveal>显示答案与步骤</button>
          <div class="ans">
            <div class="a-line"><b>答案</b>　错误。</div>
            <div class="sol-step" data-n="1">l ∥ α 只能推出 l 与 α 内的直线“没有公共点”，因此 l 与 α 内的直线可能平行，也可能异面。</div>
            <div class="sol-step" data-n="2">例如正方体中 A₁B₁ ∥ 平面 ABCD，但 A₁B₁ 与底面内的 AC 是异面直线。</div>
          </div>
        </div>
        <div class="q">
          <div class="q-head"><span class="qn">2</span><span>在正方体 ABCD-A₁B₁C₁D₁ 中，求证：BD ∥ 平面 B₁D₁C。</span></div>
          <button class="ans-btn" data-reveal>显示答案与步骤</button>
          <div class="ans">
            <div class="a-line"><b>答案</b>　见证明过程。</div>
            <div class="sol-step" data-n="1">∵ BB₁ ∥ DD₁ 且 BB₁ = DD₁，∴ 四边形 BB₁D₁D 是平行四边形，∴ BD ∥ B₁D₁。</div>
            <div class="sol-step" data-n="2">又 BD ⊄ 平面 B₁D₁C，B₁D₁ ⊂ 平面 B₁D₁C，</div>
            <div class="sol-step" data-n="3">∴ 由线面平行的判定定理得 BD ∥ 平面 B₁D₁C。</div>
          </div>
        </div>
        <div class="q">
          <div class="q-head"><span class="qn">3</span><span>（教材 8.5 例 5）求证：夹在两个平行平面间的平行线段相等。</span></div>
          <button class="ans-btn" data-reveal>显示答案与步骤</button>
          <div class="ans">
            <div class="a-line"><b>答案</b>　AB = CD。</div>
            <div class="sol-step" data-n="1">已知 α ∥ β，AB ∥ CD，A、C ∈ α，B、D ∈ β。</div>
            <div class="sol-step" data-n="2">过平行线 AB、CD 作平面 γ，γ 与 α、β 分别交于 AC、BD。</div>
            <div class="sol-step" data-n="3">由面面平行的性质定理，AC ∥ BD。又 AB ∥ CD，故四边形 ABDC 是平行四边形。</div>
            <div class="sol-step" data-n="4">∴ AB = CD。</div>
          </div>
        </div>
        <div class="q">
          <div class="q-head"><span class="qn">4</span><span>要证“平面 α ∥ 平面 β”，下列条件够用的是（　）。</span></div>
          <div class="opts">
            <button class="opt" data-ok="0"><span class="mk">A</span>α 内有两条直线平行于 β</button>
            <button class="opt" data-ok="1"><span class="mk">B</span>α 内有两条相交直线平行于 β</button>
            <button class="opt" data-ok="0"><span class="mk">C</span>α 内有无数条直线平行于 β</button>
          </div>
          <button class="ans-btn" data-reveal>显示答案</button>
          <div class="ans">
            <div class="a-line"><b>答案</b>　B</div>
            <div class="sol-step" data-n="1">A、C 中的直线可以互相平行（都平行于 β 与 α 的交线方向），此时 α 与 β 可能相交。</div>
            <div class="sol-step" data-n="2">只有“两条相交直线”才能确定平面 α 的“倾斜方向”，从而保证面面平行。</div>
          </div>
        </div>
      `,
    },
  });
})();
