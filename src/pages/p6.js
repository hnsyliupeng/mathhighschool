/* =============================================================
   第 6 页 · 8.4 空间点、直线、平面之间的位置关系
   知识点：8.4.1 平面；基本事实 1/2/3；推论 1/2/3；
           8.4.2 直线与直线、直线与平面、平面与平面的位置关系
   ============================================================= */
(function () {
  'use strict';
  const E = window.Ink3D, G = window.Geo;
  const V = E.V;

  const INFO = {
    fact1: {
      title: '基本事实 1',
      text: '过不在一条直线上的三个点，有且只有一个平面。符号：A、B、C 三点不共线 ⟹ 存在唯一的平面 α，使 A、B、C ∈ α。它给出了<b>确定一个平面</b>的依据——“不共线三点定平面”。',
    },
    fact2: {
      title: '基本事实 2',
      text: '如果一条直线上的两个点在一个平面内，那么这条直线在这个平面内。符号：A ∈ l，B ∈ l，且 A ∈ α，B ∈ α ⟹ l ⊂ α。它用直线的“直”刻画平面的“平”，是判断<b>直线在平面内</b>的依据。',
    },
    fact3: {
      title: '基本事实 3',
      text: '如果两个不重合的平面有一个公共点，那么它们有且只有一条过该点的公共直线。符号：P ∈ α，P ∈ β ⟹ α ∩ β = l，且 P ∈ l。它是判断<b>两个平面相交</b>、寻找交线的依据。',
    },
    cor1: { title: '推论 1', text: '经过一条直线和这条直线外一点，有且只有一个平面。' },
    cor2: { title: '推论 2', text: '经过两条相交直线，有且只有一个平面。' },
    cor3: { title: '推论 3', text: '经过两条平行直线，有且只有一个平面。' },
  };

  window.PAGES.push({
    id: 'p6',
    short: '8.4 位置关系与基本事实',
    title: '8.4 点、直线、平面的位置关系',
    running: '8.4 位置关系',
    chapter: '8.4',
    defaults: { mode: 'fact1' },
    vizTools: `
      <button class="chip on" data-viz="f-fact1">基本事实1</button>
      <button class="chip" data-viz="f-fact2">基本事实2</button>
      <button class="chip" data-viz="f-fact3">基本事实3</button>
      <button class="chip" data-viz="f-cor">三个推论</button>
      <button class="chip ghost" data-viz="f-symbol">符号语言</button>
      <div class="viz-card" id="p6-note"></div>`,
    camera: { zoom: 1.02, pitch: 0.3, yaw: -0.55, offset: [0, 1.0, 0], dist: 12, fov: 8.6 },

    scene(t, ctx) {
      const st = ctx.studio, mode = ctx.params.mode;
      const items = [];
      const cube = G.cube({ st, a: 2.2, key: 'c' });
      if (mode !== 'cor') items.push(cube.items);
      const A = cube.v.A, B = cube.v.B, C = cube.v.C, D = cube.v.D;
      const A1 = cube.v['A₁'], B1 = cube.v['B₁'], C1 = cube.v['C₁'], D1 = cube.v['D₁'];
      const O = [0, 0, 0];
      const hl = (pts, key, tip) => E.face(pts, {
        color: G.accent(st), alpha0: 0.26, edgeColor: G.accent(st), sw: 2, layer: 'top', key, tip,
      });

      if (mode === 'fact1') {
        // 不共线三点 B、A₁、D₁ 确定平面 BA₁D₁（截面）
        items.push(hl([B, A1, D1], 'fact1', '不共线的三点 B、A₁、D₁ 确定唯一平面'));
        [B, A1, D1].forEach((p, i) => {
          items.push(E.point(p, { r: 4, ring: true, key: 'fact1' }));
        });
        items.push(E.label(V.add(G.centroid([B, A1, D1]), [0, 0.05, 0]), '平面 BA₁D₁', {
          color: G.accent(st), size: 12, dx: 44, dy: 26, key: 'fact1', align: 'left',
        }));
        items.push(E.label([0, 3.05, 0], '不共线的三点确定一个平面', { size: 11, key: 'fact1' }));
      }

      if (mode === 'fact2') {
        items.push(hl([A, B, C, D], 'fact2', 'A、B ∈ 平面 ABCD，故直线 AB ⊂ 平面 ABCD'));
        items.push(E.line(A, B, { color: G.accent(st), sw: 3, key: 'fact2' }));
        [A, B].forEach(p => items.push(E.point(p, { r: 4, ring: true, key: 'fact2' })));
        items.push(E.label([0.6, 0, 1.16], 'l ⊂ α', { color: G.accent(st), size: 13, dy: 18, key: 'fact2' }));
        items.push(E.label([0, 3.05, 0], '直线上的两点在平面内 ⟹ 直线在平面内', { size: 11, key: 'fact2' }));
      }

      if (mode === 'fact3') {
        // 平面 α（底面所在平面）与平面 β（过 B、C、C₁、B₁ 的侧面）
        items.push(hl([A, B, C, D], 'fact3', '平面 α 与 β 相交于直线 BC'));
        items.push(hl([B, C, C1, B1], 'fact3b', '平面 β：平面 BCC₁B₁'));
        items.push(E.line(B, C, { color: G.accent(st), sw: 3.2, key: 'fact3' }));
        const P = G.mid(B, C);
        items.push(E.point(P, { r: 4.2, ring: true, key: 'fact3' }));
        items.push(E.label(P, 'P', { dx: 14, dy: 14, size: 13, color: G.accent(st), key: 'fact3' }));
        items.push(E.label([0.2, 0.02, 1.35], 'α', { size: 15, dy: 16, key: 'fact3' }));
        items.push(E.label([1.12, 0.5, -1.12], 'β', { size: 15, key: 'fact3b' }));
        items.push(E.label([0, 3.05, 0], 'α ∩ β = l，且 P ∈ l', { size: 11.5, color: G.accent(st), key: 'fact3' }));
      }

      if (mode === 'cor') {
        // 三个推论并排演示
        const corners = [-3.15, 0, 3.15];
        const names = ['推论 1', '推论 2', '推论 3'];
        const subs = ['直线 + 线外一点', '两条相交直线', '两条平行直线'];
        corners.forEach((cx, i) => {
          const b = G.box({ st, w: 1.45, h: 1.45, d: 1.45, cx, cy: 0, key: 'cor' + i, sw: 1.2, tint: G.tint(st, 0.05) });
          items.push(b.items);
          const V1 = b.verts;
          if (i === 0) {
            items.push(E.face([V1.A, V1['A₁'], V1['C₁'], V1.C], {
              color: G.accent(st), alpha0: 0.26, edgeColor: G.accent(st), sw: 1.8, layer: 'top', key: 'cor1',
              tip: '推论 1：一条直线和直线外一点确定一个平面',
            }));
            items.push(E.line(V1.A, V1['A₁'], { color: G.accent(st), sw: 2.6, key: 'cor1' }));
            items.push(E.point(V1.C, { r: 4, ring: true, key: 'cor1' }));
          }
          if (i === 1) {
            items.push(E.face([V1.A, V1.B, V1.C, V1.D], {
              color: G.accent(st), alpha0: 0.26, edgeColor: G.accent(st), sw: 1.8, layer: 'top', key: 'cor2',
              tip: '推论 2：两条相交直线确定一个平面',
            }));
            items.push(E.line(V1.A, V1.B, { color: G.accent(st), sw: 2.4, key: 'cor2' }));
            items.push(E.line(V1.A, V1.D, { color: G.accent(st), sw: 2.4, key: 'cor2' }));
            items.push(E.point(V1.A, { r: 4, ring: true, key: 'cor2' }));
          }
          if (i === 2) {
            items.push(E.face([V1.A, V1.B, V1['B₁'], V1['A₁']], {
              color: G.accent(st), alpha0: 0.26, edgeColor: G.accent(st), sw: 1.8, layer: 'top', key: 'cor3',
              tip: '推论 3：两条平行直线确定一个平面',
            }));
            items.push(E.line(V1.A, V1.B, { color: G.accent(st), sw: 2.4, key: 'cor3' }));
            items.push(E.line(V1['A₁'], V1['B₁'], { color: G.accent(st), sw: 2.4, key: 'cor3' }));
          }
          items.push(E.label([cx, -0.5, 0], names[i], { size: 12, key: 'cor' + (i + 1) }));
          items.push(E.label([cx, -0.86, 0], subs[i], { size: 10, alpha: 0.75, key: 'cor' + (i + 1) }));
        });
      }

      if (mode === 'symbol') {
        // 符号语言总览：α∩β=l、a⊂α、a∩α=A、a∥α
        items.push(hl([A, B, C, D], 'sym', '平面 α：平面 ABCD'));
        const alpha = G.planeQuad([0, 0, 0], [1, 0, 0], [0, 0, 1], 1.9, 1.9, {
          color: G.ink(st), alpha: 0.06, edgeColor: G.ink(st), sw: 1.2, key: 'sym',
        });
        items.push(alpha);
        items.push(E.label([1.9, 0.02, -1.9], 'α', { size: 14, key: 'sym' }));
        items.push(E.line(A, B, { color: G.accent(st), sw: 2.4, key: 'sym' }));
        items.push(E.label([0.4, 0, 1.15], 'AB ⊂ α', { color: G.accent(st), size: 12, dy: 16, key: 'sym' }));
        items.push(E.line(A1, [0.2, 3.0, 1.35], { color: G.accent2 ? G.accent(st) : G.accent(st), sw: 2, key: 'sym2', dash: [5, 4] }));
        items.push(E.point(A1, { r: 4, ring: true, key: 'sym2' }));
        items.push(E.label([0.4, 2.3, 1.2], 'AA₁ ∩ α = A', { color: G.accent(st), size: 12, key: 'sym2' }));
      }

      return { items, fit: mode === 'cor' ? 0.92 : 1.0 };
    },

    onViz(act, el, ctx) {
      if (act.indexOf('f-') === 0) {
        ctx.params.mode = act.slice(2);
        ctx.root.querySelectorAll('[data-viz^="f-"]').forEach(b => b.classList.toggle('on', b === el));
        const key = ctx.params.mode;
        const info = INFO[key];
        const n = ctx.root.querySelector('#p6-note');
        if (n && info) {
          n.innerHTML = `<b>${info.title}</b><br>${info.text}`;
          n.classList.remove('hide');
        }
        ctx.studio.focusOn([]);
        ctx.studio.dirty = true;
      }
    },

    init(ctx) {
      const n = ctx.root.querySelector('#p6-note');
      if (n) {
        n.innerHTML = `<b>${INFO.fact1.title}</b><br>${INFO.fact1.text}`;
        n.classList.remove('hide');
        n.addEventListener('click', () => n.classList.add('hide'));
      }
      const host = ctx.root.querySelector('#p6-steps');
      if (host) window.UI.mountSteps(host, [
        { t: '已知 A ∈ α，B ∈ α，且 A、B 都在直线 l 上。', why: '题设条件', keys: ['fact2'] },
        { t: '由<b>基本事实 2</b>：如果一条直线上的两个点在一个平面内，那么这条直线在这个平面内。', why: '基本事实 2', keys: ['fact2'] },
        { t: '所以直线 l ⊂ α，即 l 上每一点都在平面 α 内。', why: '结论', keys: ['fact2'] },
        { t: '反过来，若 l ⊂ α，则 l 上任意点都在 α 内——这是“点在线、线在面”的传递用法，也是画图时“线落在面内”的依据。', why: '基本事实 2 的逆用（定义）', keys: ['fact2'] },
      ], ctx);
    },

    tip: `三个基本事实是立体几何公理体系的基石：<b>事实 1 定平面，事实 2 判线在面内，事实 3 找交线</b>。加上三个推论，就有了“点 + 线”“相交线”“平行线”三种确定平面的方法。`,
    tipMore: `符号语言要写规范：点属于平面记 <span class="sym">A ∈ α</span>，直线在平面内记 <span class="sym">l ⊂ α</span>（也可写 l ⊆ α），平面与平面相交于直线记 <span class="sym">α ∩ β = l</span>。注意“平面”用希腊字母 α、β、γ 表示，也可用表示平面的平行四边形的四个顶点字母表示。`,

    tabs: {
      knowledge: `
        <h2 class="sec">8.4 空间点、直线、平面 <span class="tag">基本事实</span></h2>
        <p class="lead">平面是“平”的，是“无限延展”的。我们通常用平行四边形表示平面的一部分，但它向四周无限延伸。</p>
        <div class="theo">
          <div class="theo-t">基本事实 1</div>
          <p>过不在一条直线上的三个点，有且只有一个平面。</p>
          <p><span class="sym">A、B、C 不共线 ⟹ 存在唯一的 α，使 A、B、C ∈ α</span></p>
        </div>
        <div class="theo">
          <div class="theo-t">基本事实 2</div>
          <p>如果一条直线上的两个点在一个平面内，那么这条直线在这个平面内。</p>
          <p><span class="sym">A ∈ l，B ∈ l，A ∈ α，B ∈ α ⟹ l ⊂ α</span></p>
        </div>
        <div class="theo">
          <div class="theo-t">基本事实 3</div>
          <p>如果两个不重合的平面有一个公共点，那么它们有且只有一条过该点的公共直线。</p>
          <p><span class="sym">P ∈ α，P ∈ β ⟹ α ∩ β = l，且 P ∈ l</span></p>
        </div>
        <h3 class="sec-sub">三个推论</h3>
        <div class="card">
          <ul>
            <li><b>推论 1</b>：经过一条直线和这条直线外一点，有且只有一个平面。</li>
            <li><b>推论 2</b>：经过两条相交直线，有且只有一个平面。</li>
            <li><b>推论 3</b>：经过两条平行直线，有且只有一个平面。</li>
          </ul>
          <p class="note" style="margin-top:6px">这三个推论都可以由基本事实 1、2 推出，是“作辅助平面”时最常用的依据。</p>
        </div>
        <h3 class="sec-sub">位置关系一览</h3>
        <table class="tb">
          <thead><tr><th>对象</th><th>关系</th><th>符号</th><th>公共点</th></tr></thead>
          <tbody>
            <tr><td rowspan="3">点与直线</td><td>点在直线上</td><td>A ∈ l</td><td>—</td></tr>
            <tr><td>点在直线外</td><td>A ∉ l</td><td>—</td></tr>
            <tr><td>点与平面</td><td>A ∈ α / A ∉ α</td><td>—</td></tr>
            <tr><td rowspan="3">直线与平面</td><td>直线在平面内</td><td>l ⊂ α</td><td>无数个</td></tr>
            <tr><td>直线与平面相交</td><td>l ∩ α = A</td><td>1 个</td></tr>
            <tr><td>直线与平面平行</td><td>l ∥ α</td><td>0 个</td></tr>
            <tr><td rowspan="2">平面与平面</td><td>两平面平行</td><td>α ∥ β</td><td>0 个</td></tr>
            <tr><td>两平面相交</td><td>α ∩ β = l</td><td>一条直线</td></tr>
          </tbody>
        </table>
        <div class="note"><b>思考</b>　“直线 l 上有无数个点不在平面 α 内”能推出 l ∥ α 吗？不能。l 与 α 相交时，交点以外的点也都不在 α 内。</div>
      `,
      example: `
        <h2 class="sec">典型例题 <span class="tag">符号与证明</span></h2>
        <div class="card">
          <div class="example-head"><span class="no">例题</span><span class="src">教材例 1 变式 · 用基本事实证明</span></div>
          <p>已知直线 l 上有两点 A、B 都在平面 α 内。求证：直线 l ⊂ α。</p>
        </div>
        <div id="p6-steps"></div>

        <h3 class="sec-sub">教材例 1 · 用符号表示位置关系</h3>
        <div class="card soft">
          <p>图（1）中：α ∩ β = l，a ∩ α = A，a ∩ β = B；</p>
          <p>图（2）中：α ∩ β = l，a ⊂ α，b ⊂ β，a ∩ l = P，b ∩ l = P，a ∩ b = P。</p>
          <p>点击左侧“符号语言”，可以看到 <span class="sym">AB ⊂ α</span>、<span class="sym">AA₁ ∩ α = A</span> 的图示。</p>
        </div>
      `,
      practice: `
        <h2 class="sec">练习 <span class="tag">位置关系判断</span></h2>
        <div class="q">
          <div class="q-head"><span class="qn">1</span><span>在长方体 ABCD-A′B′C′D′ 中，判断下列位置关系（点击选项）。</span></div>
          <div class="opts">
            <button class="opt" data-ok="0"><span class="mk">①</span>直线 AB 与平面 A′B′C′D′：相交</button>
            <button class="opt" data-ok="1"><span class="mk">②</span>直线 AB 与平面 ABCD：AB ⊂ 平面 ABCD</button>
            <button class="opt" data-ok="0"><span class="mk">③</span>直线 AB 与平面 BCC′B′：平行</button>
          </div>
          <button class="ans-btn" data-reveal>显示答案与解析</button>
          <div class="ans">
            <div class="a-line"><b>答案</b>　① ×（平行）；② √；③ ×（相交于 B）</div>
            <div class="sol-step" data-n="1">① AB ∥ A′B′，且 AB ⊄ 平面 A′B′C′D′，由线面平行判定得 AB ∥ 平面 A′B′C′D′。</div>
            <div class="sol-step" data-n="2">② A、B 都在平面 ABCD 内，由基本事实 2 得 AB ⊂ 平面 ABCD。</div>
            <div class="sol-step" data-n="3">③ 点 B 是直线 AB 与平面 BCC′B′ 的公共点，故二者相交，不是平行。</div>
          </div>
        </div>
        <div class="q">
          <div class="q-head"><span class="qn">2</span><span>（教材习题 8.4）用符号表示：点 A 在平面 α 内，直线 l 经过点 A 且不在 α 内。</span></div>
          <button class="ans-btn" data-reveal>显示答案</button>
          <div class="ans">
            <div class="a-line"><b>答案</b>　<span class="sym">A ∈ α，A ∈ l，l ⊄ α</span></div>
            <div class="sol-step" data-n="1">点与平面、点与直线的位置关系都用“∈”。</div>
            <div class="sol-step" data-n="2">直线不在平面内记 l ⊄ α，此时 l 可能与 α 相交于 A，也可能与 α 平行（若 l 与 α 还有别的公共点，则 l ⊂ α，矛盾）。</div>
          </div>
        </div>
        <div class="q">
          <div class="q-head"><span class="qn">3</span><span>“过空间任意三点，有且只有一个平面”这个说法对吗？为什么？</span></div>
          <button class="ans-btn" data-reveal>显示答案与步骤</button>
          <div class="ans">
            <div class="a-line"><b>答案</b>　不对，缺少“不共线”。</div>
            <div class="sol-step" data-n="1">当三点共线时，过这条直线的平面有无数个，平面不唯一。</div>
            <div class="sol-step" data-n="2">基本事实 1 的完整表述是“过不在一条直线上的三个点，有且只有一个平面”。</div>
          </div>
        </div>
        <div class="q">
          <div class="q-head"><span class="qn">4</span><span>两个平面 α、β 有一个公共点 P，那么它们还有几个公共点？公共点的集合是什么？</span></div>
          <button class="ans-btn" data-reveal>显示答案</button>
          <div class="ans">
            <div class="a-line"><b>答案</b>　还有无数个公共点，公共点的集合是过点 P 的一条直线。</div>
            <div class="sol-step" data-n="1">由基本事实 3，α 与 β 有且只有一条公共直线 l。</div>
            <div class="sol-step" data-n="2">P ∈ α 且 P ∈ β，所以 P ∈ l，l 上所有点都是公共点。</div>
          </div>
        </div>
      `,
    },
  });
})();
