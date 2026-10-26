/* =============================================================
   第 9 页 · 8.6 空间直线、平面的垂直
   知识点：8.6.1 线面垂直的定义、判定定理、性质定理；
           8.6.2 二面角与二面角的平面角、面面垂直的定义、
           判定定理、性质定理
   ============================================================= */
(function () {
  'use strict';
  const E = window.Ink3D, G = window.Geo;
  const V = E.V;

  const MODES = {
    define: {
      tag: '线面垂直的定义',
      text: '如果直线 l 与平面 α 内的<b>任意一条</b>直线都垂直，就说 l ⊥ α。定义既是判定（要证所有）也是性质（可得每一条）。<br>符号：<span class="sym">l ⊥ α，a ⊂ α ⟹ l ⊥ a</span>',
    },
    judge: {
      tag: '线面垂直的判定定理',
      text: '如果一条直线与一个平面内的<b>两条相交直线</b>都垂直，那么该直线与该平面垂直。<br><span class="sym">l ⊥ m，l ⊥ n，m ∩ n = P，m、n ⊂ α ⟹ l ⊥ α</span><br>关键词：两条、相交、都在 α 内。',
    },
    prop: {
      tag: '线面垂直的性质定理',
      text: '垂直于同一个平面的两条直线平行。<br><span class="sym">a ⊥ α，b ⊥ α ⟹ a ∥ b</span><br>它揭示了“平行”与“垂直”之间的内在联系，也是作“点到平面距离”的依据。',
    },
    dihedral: {
      tag: '二面角及其平面角',
      text: '从一条直线出发的两个半平面所组成的图形叫二面角。在棱上任取一点 O，分别在两个半平面内作垂直于棱的射线 OP、OQ，则 ∠POQ 叫二面角的平面角，其大小与 O 的位置无关。',
    },
    judge2: {
      tag: '面面垂直的判定定理',
      text: '如果一个平面过另一个平面的垂线，那么这两个平面垂直。<br><span class="sym">a ⊂ α，a ⊥ β ⟹ α ⊥ β</span><br>证面面垂直，先找（作）线面垂直。',
    },
    three: {
      tag: '三垂线定理及其逆定理',
      text: '三垂线定理：平面内的一条直线，如果和这个平面的一条斜线的<b>射影</b>垂直，那么它也和这条<b>斜线</b>垂直。<br>逆定理：平面内的一条直线，如果和这个平面的一条斜线垂直，那么它也和这条斜线的<b>射影</b>垂直。<br>口诀：<b>垂直于射影 ⟺ 垂直于斜线</b>，中间起桥梁作用的是平面内的那条直线与射影所在平面的垂直关系。',
    },
    prop2: {
      tag: '面面垂直的性质定理',
      text: '两个平面垂直，如果一个平面内有一条直线垂直于这两个平面的交线，那么这条直线与另一个平面垂直。<br><span class="sym">α ⊥ β，α ∩ β = l，a ⊂ α，a ⊥ l ⟹ a ⊥ β</span>',
    },
  };

  window.PAGES.push({
    id: 'p9',
    short: '8.6 垂直关系',
    title: '8.6 空间直线、平面的垂直',
    running: '8.6 垂直关系',
    chapter: '8.6',
    defaults: { mode: 'judge' },
    vizTools: `
      <button class="chip" data-viz="v-define">线面垂直·定义</button>
      <button class="chip on" data-viz="v-judge">判定定理</button>
      <button class="chip" data-viz="v-prop">性质定理</button>
      <button class="chip" data-viz="v-dihedral">二面角</button>
      <button class="chip" data-viz="v-judge2">面面垂直·判定</button>
      <button class="chip" data-viz="v-prop2">面面垂直·性质</button>
      <button class="chip ghost" data-viz="v-three">三垂线定理</button>
      <div class="viz-card" id="p9-note"></div>`,
    camera: { zoom: 1.05, pitch: 0.28, yaw: -0.55, offset: [0, 1.0, 0], dist: 11, fov: 8.4 },

    scene(t, ctx) {
      const st = ctx.studio, mode = ctx.params.mode;
      const items = [];
      const cube = G.cube({ st, a: 2.3, key: 'c', alpha: mode === 'dihedral' || mode === 'three' ? 0.55 : 0.9 });
      items.push(cube.items);
      const { A, B, C, D } = cube.v;
      const A1 = cube.v['A₁'], B1 = cube.v['B₁'], C1 = cube.v['C₁'], D1 = cube.v['D₁'];
      const O = [0, 0, 0];
      const acc = G.accent(st), ink = G.ink(st);
      const seg = (p, q, key, opt) => E.line(p, q, Object.assign({ color: acc, sw: 3, key, layer: 'top' }, opt));
      const blue = E.mix(acc, '#38659f', 0.72);
      const plane = (pts, key, tip, alpha, col) => E.face(pts, {
        color: col || acc, alpha0: alpha || 0.2, edgeColor: col || acc, sw: 1.8, layer: 'top', key, tip,
      });
      const RA = (a, b, c, key, s) => G.rightAngle(a, b, c, s || 0.16, { color: acc, key });

      if (mode === 'define') {
        // AA₁ ⊥ 底面：与底面内两条直线 AB、AD 都垂直
        items.push(plane([A, B, C, D], 'v:alpha', '平面 α：底面 ABCD'));
        items.push(seg(A, A1, 'v:l', { tip: 'l = AA₁ ⊥ α' }));
        items.push(seg(A, B, 'v:m', { tip: 'AB ⊂ α，AA₁ ⊥ AB' }));
        items.push(seg(A, D, 'v:n', { tip: 'AD ⊂ α，AA₁ ⊥ AD' }));
        items.push(RA(A1, A, B, 'v:l'));
        items.push(RA(A1, A, D, 'v:l'));
        items.push(E.label(G.mid(A, A1), 'l', { dx: -16, size: 13, color: acc, key: 'v:l' }));
        items.push(E.label([1.52, 0.02, -1.0], 'α', { size: 14, key: 'v:alpha' }));
        items.push(E.label([0, 3.05, 0], 'l ⊥ α ⟺ l 与 α 内任意直线都垂直', { size: 11.5, color: acc, key: 'v:l' }));
      }

      if (mode === 'judge') {
        // AC ⊥ 平面 BB₁D₁D？用 A₁C₁ ⊥ 平面 BB₁D₁D 更标准
        const P1 = G.mid(B1, D1);
        items.push(plane([B, B1, D1, D], 'v:alpha', '平面 α：对角面 BB₁D₁D'));
        items.push(seg(A1, C1, 'v:l', { tip: 'A₁C₁ ⊥ 平面 BB₁D₁D' }));
        items.push(seg(B1, D1, 'v:m', { tip: 'A₁C₁ ⊥ B₁D₁' }));
        items.push(seg(B, B1, 'v:n', { tip: 'A₁C₁ ⊥ BB₁' }));
        items.push(E.point(P1, { r: 4, ring: true, key: 'v:l' }));
        items.push(RA(A1, P1, B1, 'v:l'));
        items.push(E.label(P1, 'P', { dx: 14, dy: 12, size: 12.5, color: acc, key: 'v:l' }));
        items.push(E.label(G.mid(A1, C1), 'l = A₁C₁', { dy: -18, size: 11.5, color: acc, key: 'v:l' }));
        items.push(E.label([1.55, 2.3, -1.0], 'α', { size: 14, key: 'v:alpha' }));
        items.push(E.label([0, 3.05, 0], 'l ⊥ m，l ⊥ n，m ∩ n = P ⟹ l ⊥ α', { size: 11.5, color: acc, key: 'v:l' }));
      }

      if (mode === 'prop') {
        items.push(plane([A, B, C, D], 'v:alpha', '平面 α'));
        items.push(seg(A, A1, 'v:a', { tip: 'AA₁ ⊥ α' }));
        items.push(seg(B, B1, 'v:b', { tip: 'BB₁ ⊥ α，故 AA₁ ∥ BB₁' }));
        items.push(RA(A1, A, B, 'v:a'));
        items.push(RA(B1, B, A, 'v:b'));
        items.push(E.label([1.52, 0.02, -1.0], 'α', { size: 14, key: 'v:alpha' }));
        items.push(E.label([0, 3.05, 0], 'a ⊥ α，b ⊥ α ⟹ a ∥ b', { size: 11.5, color: acc, key: 'v:a' }));
      }

      if (mode === 'dihedral') {
        // 二面角 α-AB-β：α 为底面，β 为过 AB 的竖直半平面
        items.push(plane([A, B, C, D], 'v:alpha', '半平面 α', 0.16, acc));
        items.push(plane([A, B, B1, A1], 'v:beta', '半平面 β', 0.16, blue));
        items.push(seg(A, B, 'v:edge', { tip: '棱 AB' }));
        const O1 = G.mid(A, B);
        const pA = V.add(O1, [0, 0, 1.02]);   // 在 α 内垂直于 AB
        const pB = V.add(O1, [0, 1.05, 0]);    // 在 β 内垂直于 AB
        items.push(seg(O1, pA, 'v:oa', { tip: 'OA ⊥ AB，OA ⊂ α' }));
        items.push(seg(O1, pB, 'v:ob', { tip: 'OB ⊥ AB，OB ⊂ β', color: blue }));
        items.push(E.point(pA, { r: 3.2, key: 'v:oa' }), E.label(pA, 'P', { dx: 16, dy: 4, size: 12, color: acc, key: 'v:oa' }));
        items.push(E.point(pB, { r: 3.2, key: 'v:ob' }), E.label(pB, 'Q', { dx: 18, dy: -2, size: 12, color: blue, key: 'v:ob' }));
        items.push(E.point(O1, { r: 4, ring: true, key: 'v:edge' }));
        items.push(E.label(O1, 'O', { dx: -14, dy: 12, size: 12.5, color: acc, key: 'v:edge' }));
        items.push(E.angle(pA, O1, pB, '', { key: 'v:edge', color: acc }));
        items.push(E.label(G.mid(G.mid(pA, pB), O1), '∠POQ', { dx: 30, dy: 26, size: 11.5, color: acc, key: 'v:edge', align: 'left' }));
        items.push(G.rightAngle(pA, O1, B, 0.15, { color: acc, key: 'v:edge' }));
        items.push(E.label([-1.62, 0.02, 0.4], 'α', { size: 14, key: 'v:alpha' }));
        items.push(E.label([-1.62, 1.35, 0.3], 'β', { size: 14, key: 'v:beta', color: blue }));
        items.push(E.label([0.15, 3.05, 0], '二面角 α-AB-β 的平面角 ∠POQ', { size: 11.5, color: acc, key: 'v:edge' }));
      }

      if (mode === 'judge2') {
        items.push(plane([A, B, B1, A1], 'v:alpha', '平面 α：ABB₁A₁ 过垂线 AA₁', 0.16, blue));
        items.push(plane([A, B, C, D], 'v:beta', '平面 β：底面', 0.16, acc));
        items.push(seg(A, A1, 'v:a', { tip: 'AA₁ ⊥ β，且 AA₁ ⊂ α' }));
        items.push(RA(A1, A, B, 'v:a'));
        items.push(seg(A, B, 'v:edge', { tip: 'α ∩ β = AB' }));
        items.push(E.label([-1.62, 1.35, 0.3], 'α', { size: 14, key: 'v:alpha', color: blue }));
        items.push(E.label([-1.62, 0.02, 0.4], 'β', { size: 14, key: 'v:beta' }));
        items.push(E.label([0, 3.05, 0], 'a ⊂ α，a ⊥ β ⟹ α ⊥ β', { size: 11.5, color: acc, key: 'v:a' }));
      }

      if (mode === 'three') {
        // 三垂线定理：A₁A ⊥ α，斜线 A₁C，射影 AC；l ⊂ α 且 l ⊥ AC ⟹ l ⊥ A₁C
        const M = [0, 0, 0];
        const ldir = V.mul(V.norm([1, 0, 1]), 0.85);
        const L1 = V.add(M, ldir), L2 = V.sub(M, ldir);
        items.push(plane([A, B, C, D], 'v:alpha', '平面 α', 0.14, acc));
        items.push(E.line(A1, A, { color: blue, sw: 2.6, key: 'v:po', layer: 'top', tip: 'A₁A ⊥ α，A 为垂足' }));
        items.push(seg(A, C, { color: blue, sw: 2, dash: [5, 4], key: 'v:proj', tip: 'AC 是 A₁C 在 α 内的射影' }));
        items.push(E.line(A1, C, { color: acc, sw: 3, key: 'v:pa', layer: 'top', tip: '斜线 A₁C' }));
        items.push(E.line(L1, L2, { color: ink, sw: 2.6, key: 'v:l', layer: 'top', tip: 'l ⊂ α，l ⊥ AC ⟹ l ⊥ A₁C' }));
        items.push(G.rightAngle(L1, M, C, 0.15, { color: ink, key: 'v:l' }));
        items.push(G.rightAngle(L2, M, A1, 0.15, { color: acc, key: 'v:pa' }));
        items.push(G.rightAngle(A1, A, B, 0.16, { color: blue, key: 'v:po' }));
        items.push(E.point(A1, { r: 3.6, key: 'v:pa' }), E.label(A1, 'P', { dx: 10, dy: -12, size: 12.5, color: acc, key: 'v:pa' }));
        items.push(E.point(A, { r: 3.6, key: 'v:po' }), E.label(A, 'O', { dx: -14, dy: 12, size: 12.5, color: blue, key: 'v:po' }));
        items.push(E.point(M, { r: 3.8, ring: true, key: 'v:l' }), E.label(M, 'A', { dx: -8, dy: 16, size: 12.5, key: 'v:l' }));
        items.push(E.label(V.lerp(L2, M, 0.55), 'l', { dx: -14, dy: 6, size: 13, key: 'v:l' }));
        items.push(E.label([-1.62, 0.02, 0.4], 'α', { size: 14, key: 'v:alpha' }));
        items.push(E.label([0, 3.05, 0], 'l ⊥ OA（射影）⟹ l ⊥ PA（斜线）', { size: 11.5, color: acc, key: 'v:l' }));
      }

      if (mode === 'prop2') {
        // α ⊥ β，α ∩ β = AB，在 α 内作 AD ⊥ AB，则 AD ⊥ β
        items.push(plane([A, B, B1, A1], 'v:alpha', '平面 α', 0.16, blue));
        items.push(plane([A, B, C, D], 'v:beta', '平面 β', 0.16, acc));
        items.push(seg(A, B, 'v:edge', { tip: '交线 AB' }));
        items.push(seg(A, D, 'v:a', { tip: 'AD ⊂ α，AD ⊥ AB ⟹ AD ⊥ β' }));
        items.push(RA(D, A, B, 'v:a'));
        items.push(E.label([-1.62, 1.35, 0.3], 'α', { size: 14, key: 'v:alpha', color: blue }));
        items.push(E.label([-1.62, 0.02, 0.4], 'β', { size: 14, key: 'v:beta' }));
        items.push(E.label([0, 3.05, 0], 'α ⊥ β，a ⊥ 交线 ⟹ a ⊥ β', { size: 11.5, color: acc, key: 'v:a' }));
      }
      return { items, fit: 0.98 };
    },

    onViz(act, el, ctx) {
      if (act.indexOf('v-') === 0) {
        const map = {
          'v-define': 'define', 'v-judge': 'judge', 'v-prop': 'prop',
          'v-dihedral': 'dihedral', 'v-judge2': 'judge2', 'v-prop2': 'prop2', 'v-three': 'three',
        };
        ctx.params.mode = map[act];
        ctx.root.querySelectorAll('[data-viz^="v-"]').forEach(b => b.classList.toggle('on', b === el));
        const info = MODES[ctx.params.mode];
        const n = ctx.root.querySelector('#p9-note');
        if (n && info) {
          n.innerHTML = `<b>${info.tag}</b><br>${info.text}`;
          n.classList.remove('hide');
        }
        ctx.studio.focusOn([]);
        ctx.studio.dirty = true;
      }
    },

    init(ctx) {
      const n = ctx.root.querySelector('#p9-note');
      if (n) {
        n.innerHTML = `<b>${MODES.judge.tag}</b><br>${MODES.judge.text}`;
        n.classList.remove('hide');
        n.addEventListener('click', () => n.classList.add('hide'));
      }
      const host = ctx.root.querySelector('#p9-steps');
      if (host) window.UI.mountSteps(host, [
        { t: '在正方体中，AC ⊥ BD（正方形对角线互相垂直）。', why: '正方形的性质', keys: ['v:l'] },
        { t: '又 DD₁ ⊥ 平面 ABCD，AC ⊂ 平面 ABCD，所以 DD₁ ⊥ AC。', why: '线面垂直的定义（l ⊥ α ⟹ l ⊥ α 内任一直线）', keys: ['v:a'] },
        { t: 'BD 与 DD₁ 是平面 BB₁D₁D 内的两条相交直线，且都垂直于 AC。', why: '线面垂直的判定定理的条件', keys: ['v:m', 'v:n', 'v:l'] },
        { t: '由线面垂直的判定定理，AC ⊥ 平面 BB₁D₁D。', why: '线面垂直的判定定理', keys: ['v:l'] },
        { t: '又 AC ⊂ 平面 ACC₁A₁，由面面垂直的判定定理得平面 ACC₁A₁ ⊥ 平面 BB₁D₁D。', why: '面面垂直的判定定理（a ⊂ α，a ⊥ β ⟹ α ⊥ β）', keys: ['v:alpha', 'v:l'] },
      ], ctx);
    },

    tip: `垂直关系同样是一条“转化链”：<b>线线垂直 ⟺ 线面垂直 ⟺ 面面垂直</b>。判定向左（由低到高），性质向右（由高到低）。二面角的平面角是度量面面垂直的工具：平面角为 90° 时，两个平面互相垂直。`,
    tipMore: `线面垂直判定的三个要素必须写全：“两条”“相交”“都在平面内”。证明面面垂直的标准两步：① 在一个平面内找一条直线；② 证明它垂直于另一个平面（通常再用线面垂直判定，找两条相交直线）。`,

    tabs: {
      knowledge: `
        <h2 class="sec">8.6 垂直关系 <span class="tag">判定与性质</span></h2>
        <div class="theo">
          <div class="theo-t">直线与平面垂直的定义</div>
          <p>如果直线 l 与平面 α 内的任意一条直线都垂直，就说直线 l 与平面 α 互相垂直，记作 l ⊥ α。直线 l 叫平面 α 的垂线，α 叫直线 l 的垂面，交点叫垂足。</p>
        </div>
        <div class="theo">
          <div class="theo-t">直线与平面垂直的判定定理</div>
          <p>如果一条直线与一个平面内的两条相交直线都垂直，那么该直线与此平面垂直。</p>
          <p><span class="sym">l ⊥ m，l ⊥ n，m ∩ n = P，m、n ⊂ α ⟹ l ⊥ α</span></p>
        </div>
        <div class="theo">
          <div class="theo-t">直线与平面垂直的性质定理</div>
          <p>垂直于同一个平面的两条直线平行。<span class="sym">a ⊥ α，b ⊥ α ⟹ a ∥ b</span></p>
        </div>
        <div class="theo">
          <div class="theo-t">二面角</div>
          <p>从一条直线出发的两个半平面所组成的图形叫二面角，这条直线叫二面角的棱，两个半平面叫二面角的面。</p>
          <p>以棱 l 上任一点 O 为垂足，在两个半平面内分别作垂直于棱的射线 OA、OB，则 ∠AOB 叫二面角的<b>平面角</b>。平面角是直角的二面角叫直二面角，此时两个平面互相垂直。二面角的平面角范围是 0° ≤ α ≤ 180°。</p>
        </div>
        <div class="theo">
          <div class="theo-t">平面与平面垂直的判定 / 性质</div>
          <p>判定：如果一个平面过另一个平面的垂线，那么这两个平面垂直。<span class="sym">a ⊂ α，a ⊥ β ⟹ α ⊥ β</span></p>
          <p>性质：两个平面垂直，如果一个平面内有一条直线垂直于这两个平面的交线，那么这条直线与另一个平面垂直。<span class="sym">α ⊥ β，α ∩ β = l，a ⊂ α，a ⊥ l ⟹ a ⊥ β</span></p>
        </div>
        <div class="theo">
          <div class="theo-t">三垂线定理及其逆定理（重要的垂直判定工具）</div>
          <p>设 PO ⊥ α 于 O，PA 为 α 的斜线，则 OA 是 PA 在 α 内的射影。</p>
          <p>定理：若 l ⊂ α，l ⊥ OA，则 l ⊥ PA。逆定理：若 l ⊂ α，l ⊥ PA，则 l ⊥ OA。</p>
          <p>理解要点：<b>l ⊥ OA 且 l ⊥ PO ⟹ l ⊥ 平面 POA ⟹ l ⊥ PA</b>，本质仍是线面垂直。</p>
        </div>
        <div class="note"><b>常用结论</b>　① 若两条平行线中的一条垂直于一个平面，则另一条也垂直于这个平面；② 过一点有且只有一条直线与已知平面垂直；③ 垂直于同一条直线的两个平面平行。</div>
      `,
      example: `
        <h2 class="sec">典型例题 <span class="tag">线面垂直 → 面面垂直</span></h2>
        <div class="card">
          <div class="example-head"><span class="no">例题</span><span class="src">教材 8.6 例 7 · 正方体中的面面垂直</span></div>
          <p>在正方体 ABCD-A₁B₁C₁D₁ 中，求证：平面 A₁BD ⊥ 平面 ACC₁A₁。</p>
        </div>
        <div id="p9-steps"></div>

        <h3 class="sec-sub">教材 8.6 例 2 · 线线垂直</h3>
        <div class="card soft">
          <p>正方体中，O₁ 为底面 A₁B₁C₁D₁ 的中心，求证 AO₁ ⊥ BD。</p>
          <p><b>思路：</b>BD ⊥ AC，BD ⊥ AA₁ ⟹ BD ⊥ 平面 ACC₁A₁ ⟹ BD ⊥ AO₁（AO₁ ⊂ 平面 ACC₁A₁）。这是“线面垂直 ⟹ 线线垂直”的标准用法。</p>
        </div>

        <h3 class="sec-sub">三垂线定理的用法（教材例 2 的另一种眼光）</h3>
        <div class="card soft">
          <p>在正方体中求证 AO₁ ⊥ BD：BD ⊥ AC（射影），AA₁ ⊥ 平面 ABCD（垂线），由三垂线定理即得 BD ⊥ AO₁（斜线）。</p>
          <p>用三垂线定理证线线垂直，关键是把“斜线—射影—平面内直线”三者的位置关系认清，往往比用线面垂直判定更快。</p>
        </div>

        <h3 class="sec-sub">二面角的求法（三步）</h3>
        <div class="card soft">
          <p><b>① 作</b>：在棱上取点，在两个面内分别作棱的垂线；<b>② 证</b>：说明所作角就是二面角的平面角；<b>③ 算</b>：在三角形中用勾股定理或余弦定理求解。</p>
        </div>
      `,
      practice: `
        <h2 class="sec">练习 <span class="tag">垂直与二面角</span></h2>
        <div class="q">
          <div class="q-head"><span class="qn">1</span><span>（教材习题 8.6 第 2 题）已知直线 a、b 与平面 α、β，能使 α ⊥ β 的充分条件是（　）。</span></div>
          <div class="opts">
            <button class="opt" data-ok="0"><span class="mk">A</span>α ⊥ γ，β ⊥ γ</button>
            <button class="opt" data-ok="0"><span class="mk">B</span>α ∩ β = a，b ⊥ a，b ⊂ β</button>
            <button class="opt" data-ok="0"><span class="mk">C</span>a ∥ β，a ∥ α</button>
            <button class="opt" data-ok="1"><span class="mk">D</span>a ∥ α，a ⊥ β</button>
          </div>
          <button class="ans-btn" data-reveal>显示答案与解析</button>
          <div class="ans">
            <div class="a-line"><b>答案</b>　D</div>
            <div class="sol-step" data-n="1">D：a ∥ α，a ⊥ β ⟹ 在 α 内存在直线 a′ ∥ a，则 a′ ⊥ β，且 a′ ⊂ α，由面面垂直判定得 α ⊥ β。</div>
            <div class="sol-step" data-n="2">A：两个平面都垂直于第三个平面，它们可能平行，不一定垂直。</div>
            <div class="sol-step" data-n="3">B：b ⊂ β 且 b ⊥ a，但 a 是交线，此时 b ⊥ α，推不出 α ⊥ β。</div>
            <div class="sol-step" data-n="4">C：a 与 α、β 都平行，α 与 β 可能平行或相交成任意角。</div>
          </div>
        </div>
        <div class="q">
          <div class="q-head"><span class="qn">2</span><span>在正方体 ABCD-A₁B₁C₁D₁ 中，求二面角 A₁-BD-A 的平面角的正切值。</span></div>
          <button class="ans-btn" data-reveal>显示答案与步骤</button>
          <div class="ans">
            <div class="a-line"><b>答案</b>　tan∠A₁OA = √2（设棱长为 1）。</div>
            <div class="sol-step" data-n="1">设 O 为底面中心，则 AO ⊥ BD，A₁O ⊥ BD（因为 A₁A = A₁C，△A₁BD 是等腰三角形）。</div>
            <div class="sol-step" data-n="2">故 ∠A₁OA 是二面角 A₁-BD-A 的平面角。</div>
            <div class="sol-step" data-n="3">AA₁ = 1，AO = √2/2，故 tan∠A₁OA = 1 ÷ (√2/2) = √2。</div>
          </div>
        </div>
        <div class="q">
          <div class="q-head"><span class="qn">3</span><span>（教材 8.6 例 3）求证：如果两条平行直线中的一条垂直于一个平面，那么另一条也垂直于这个平面。</span></div>
          <button class="ans-btn" data-reveal>显示答案与步骤</button>
          <div class="ans">
            <div class="a-line"><b>已知</b>　a ∥ b，a ⊥ α。<b>求证</b>　b ⊥ α。</div>
            <div class="sol-step" data-n="1">在 α 内取两条相交直线 m、n。</div>
            <div class="sol-step" data-n="2">∵ a ⊥ α，∴ a ⊥ m，a ⊥ n。</div>
            <div class="sol-step" data-n="3">∵ a ∥ b，∴ b ⊥ m，b ⊥ n（等角定理或平行线性质）。</div>
            <div class="sol-step" data-n="4">又 m、n 是 α 内两条相交直线，∴ b ⊥ α（线面垂直判定定理）。</div>
          </div>
        </div>
        <div class="q">
          <div class="q-head"><span class="qn">4</span><span>在正三棱柱 ABC-A₁B₁C₁ 中，D 为 AC 的中点，求证：平面 BDC₁ ⊥ 平面 ACC₁A₁。</span></div>
          <button class="ans-btn" data-reveal>显示答案与步骤</button>
          <div class="ans">
            <div class="a-line"><b>证明</b>　见步骤。</div>
            <div class="sol-step" data-n="1">∵ △ABC 是正三角形，D 是 AC 的中点，∴ BD ⊥ AC。</div>
            <div class="sol-step" data-n="2">∵ 正三棱柱中 CC₁ ⊥ 平面 ABC，BD ⊂ 平面 ABC，∴ BD ⊥ CC₁。</div>
            <div class="sol-step" data-n="3">又 AC ∩ CC₁ = C，AC、CC₁ ⊂ 平面 ACC₁A₁，∴ BD ⊥ 平面 ACC₁A₁。</div>
            <div class="sol-step" data-n="4">∵ BD ⊂ 平面 BDC₁，∴ 平面 BDC₁ ⊥ 平面 ACC₁A₁（面面垂直判定）。</div>
          </div>
        </div>
      `,
    },
  });
})();
