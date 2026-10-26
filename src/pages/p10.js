/* =============================================================
   第 10 页 · 距离与角度综合
   知识点：点到平面的距离、直线到平面的距离、两个平行平面间的距离、
           异面直线的公垂线与距离、直线与平面所成的角、二面角的平面角
   交互：拖动滑块改变点 / 面的位置，实时显示距离与角度的数值与公式
   ============================================================= */
(function () {
  'use strict';
  const E = window.Ink3D, G = window.Geo;
  const V = E.V;

  window.PAGES.push({
    id: 'p10',
    short: '距离与角度',
    title: '距离与角度的综合计算',
    running: '立体几何中的度量',
    chapter: '8.6+',
    defaults: { mode: 'point', t: 0.55, angle: 40 },
    vizTools: `
      <button class="chip on" data-viz="d-point">点到面距离</button>
      <button class="chip" data-viz="d-line">线面距离</button>
      <button class="chip" data-viz="d-skew">异面直线距离</button>
      <button class="chip" data-viz="d-angle">线面角</button>
      <button class="chip" data-viz="d-dihedral">二面角</button>
      <div class="slider-chip">位置 <input type="range" data-param="t" min="0.15" max="0.9" step="0.01" value="0.55"><span class="v">0.55</span></div>
      <div class="viz-card" id="p10-note"></div>`,
    camera: { zoom: 1.02, pitch: 0.3, yaw: -0.6, offset: [0, 1.15, 0], dist: 11, fov: 8.4 },

    scene(t, ctx) {
      const st = ctx.studio, p = ctx.params, mode = p.mode;
      const items = [];
      const cube = G.cube({ st, a: 2.3, key: 'c', alpha: 0.85 });
      items.push(cube.items);
      const { A, B, C, D } = cube.v;
      const A1 = cube.v['A₁'], B1 = cube.v['B₁'], C1 = cube.v['C₁'], D1 = cube.v['D₁'];
      const acc = G.accent(st), blue = E.mix(acc, '#38659f', 0.7), ink = G.ink(st);
      const seg = (p1, q1, key, opt) => E.line(p1, q1, Object.assign({ color: acc, sw: 3, key, layer: 'top' }, opt));
      const RA = (a, b, c, key, s) => G.rightAngle(a, b, c, s || 0.15, { color: acc, key });

      if (mode === 'point') {
        // 点 A₁ 到底面 ABCD 的距离 = AA₁；拖动 t 改变点在竖直棱上的位置
        const P = V.lerp(A, A1, p.t);
        const H = V.lerp(A, A, p.t); // 垂足在 A（底面）
        items.push(E.face([A, B, C, D], { color: blue, alpha0: 0.16, edgeColor: blue, sw: 1.6, layer: 'top', key: 'pt:alpha', tip: '平面 α' }));
        items.push(seg(P, A, 'pt:h', { tip: '垂线段 PA，其长度就是点到平面的距离' }));
        items.push(RA(P, A, B, 'pt:h'));
        items.push(E.point(P, { r: 4.4, ring: true, key: 'pt:h' }));
        items.push(E.label(P, 'P', { dx: 16, dy: -10, size: 13, color: acc, key: 'pt:h' }));
        items.push(E.label(A, 'H', { dx: -16, dy: 10, size: 13, color: acc, key: 'pt:h' }));
        items.push(E.label(G.mid(P, A), `d = ${(p.t * 2.3).toFixed(2)}`, { dx: -30, dy: 0, size: 11.5, color: acc, key: 'pt:h', align: 'right' }));
        items.push(E.label([0, 3.05, 0], '点到平面的距离：垂线段的长度，垂足为 H', { size: 11.5, color: acc, key: 'pt:h' }));
      }

      if (mode === 'line') {
        // A₁B₁ ∥ 平面 ABCD，距离 = AA₁
        items.push(E.face([A, B, C, D], { color: blue, alpha0: 0.16, edgeColor: blue, sw: 1.6, layer: 'top', key: 'ln:alpha' }));
        items.push(seg(A1, B1, 'ln:l', { tip: 'l ∥ α' }));
        items.push(seg(A1, A, 'ln:h', { tip: 'l 上任意一点到 α 的距离都相等' }));
        items.push(seg(B1, B, 'ln:h2', { tip: '同样等于 BB₁', color: ink, sw: 1.3, dash: [5, 4], layer: 'top' }));
        items.push(RA(A1, A, B, 'ln:h'));
        items.push(E.point(A1, { r: 3.6, key: 'ln:h' }), E.point(B1, { r: 3.6, key: 'ln:h' }));
        items.push(E.label(G.mid(A1, A), 'd', { dx: -14, size: 12.5, color: acc, key: 'ln:h' }));
        items.push(E.label([0, 3.05, 0], '线面距离 = 直线上任意一点到平面的距离（与点的位置无关）', { size: 11, color: acc, key: 'ln:h' }));
      }

      if (mode === 'skew') {
        // 异面直线 AA₁ 与 BC 的公垂线是 AB（因为 AB ⊥ AA₁ 且 AB ⊥ BC）
        items.push(seg(A, A1, 'sk:a', { tip: '异面直线 a = AA₁' }));
        items.push(seg(B, C, 'sk:b', { tip: '异面直线 b = BC' }));
        items.push(seg(A, B, 'sk:ab', { tip: '公垂线段 AB：既垂直 a 又垂直 b' }));
        items.push(E.line(A1, B1, { color: ink, sw: 1, dash: [4, 4], alpha: 0.45 }));
        items.push(E.line(B, B1, { color: ink, sw: 1, dash: [4, 4], alpha: 0.45 }));
        items.push(RA(A1, A, B, 'sk:ab'));
        items.push(RA(B, A, B1, 'sk:ab'));
        [A, B, A1, C].forEach(q => items.push(E.point(q, { r: 3.4 })));
        items.push(E.label(G.mid(A, B), '公垂线段', { dy: 18, size: 11, color: acc, key: 'sk:ab' }));
        items.push(E.label([0, 3.05, 0], '异面直线的距离 = 公垂线段的长度', { size: 11.5, color: acc, key: 'sk:ab' }));
      }

      if (mode === 'angle') {
        // 线面角：A₁C 与底面 ABCD 所成的角，即 ∠A₁CA
        const th = p.angle * Math.PI / 180;
        // 斜线起点 P 在竖直棱 AA₁ 上，垂足 H 在底面内，HP 为垂线段
        const P = V.lerp(A, A1, p.t);
        const H = [A[0] + Math.cos(th) * 1.55, 0.02, A[2] - Math.sin(th) * 1.55];
        items.push(E.face([A, B, C, D], { color: blue, alpha0: 0.16, edgeColor: blue, sw: 1.6, layer: 'top', key: 'an:alpha' }));
        items.push(seg(P, H, 'an:h', { tip: '斜线段 PH' }));
        items.push(seg(H, A, 'an:proj', { tip: '斜线在平面上的射影 AH', color: ink, sw: 2, layer: 'top' }));
        items.push(seg(P, A, 'an:perp', { tip: '垂线段 PA ⊥ α', color: ink, sw: 1.1, dash: [4, 4], alpha: 0.6, layer: 'top' }));
        items.push(RA(P, A, H, 'an:h'));
        items.push(E.angle(A, H, P, `${p.angle}°`, { key: 'an:h', color: acc }));
        items.push(E.point(P, { r: 3.8, key: 'an:h' }));
        items.push(E.label(P, 'P', { dx: 14, dy: -12, size: 13, color: acc, key: 'an:h' }));
        items.push(E.point(H, { r: 3.4, key: 'an:proj' }));
        items.push(E.label(H, 'H', { dx: 10, dy: 14, size: 12.5, color: acc, key: 'an:proj' }));
        items.push(E.label([0, 3.05, 0], '线面角 ∠PAH：斜线与它在平面内射影所成的锐角', { size: 11, color: acc, key: 'an:h' }));
      }

      if (mode === 'dihedral') {
        // 二面角 A₁-BD-A 的平面角
        const O1 = G.mid(B, D);
        items.push(seg(B, D, 'dh:edge', { tip: '棱 BD' }));
        items.push(seg(O1, A1, 'dh:pa', { tip: 'A₁O ⊥ BD' }));
        items.push(seg(O1, A, 'dh:pb', { tip: 'AO ⊥ BD' }));
        items.push(E.line(A, C, { color: ink, sw: 1, dash: [4, 4], alpha: 0.5 }));
        items.push(RA(A1, O1, B, 'dh:pa'));
        items.push(RA(A, O1, B, 'dh:pb'));
        items.push(E.point(O1, { r: 4, ring: true, key: 'dh:edge' }));
        items.push(E.label(O1, 'O', { dx: 14, dy: 12, size: 12.5, color: acc, key: 'dh:edge' }));
        items.push(E.angle(A1, O1, A, '', { key: 'dh:edge', color: acc }));
        items.push(E.label(G.mid(G.mid(A1, A), O1), 'θ', { dx: 26, dy: 18, size: 14, color: acc, key: 'dh:edge', align: 'left' }));
        items.push(E.label([0, 3.05, 0], '二面角 A₁-BD-A：取棱的垂线得平面角 ∠A₁OA', { size: 11, color: acc, key: 'dh:edge' }));
      }
      return { items, fit: 1.0 };
    },

    onViz(act, el, ctx) {
      if (act.indexOf('d-') === 0) {
        const map = { 'd-point': 'point', 'd-line': 'line', 'd-skew': 'skew', 'd-angle': 'angle', 'd-dihedral': 'dihedral' };
        ctx.params.mode = map[act];
        ctx.root.querySelectorAll('[data-viz^="d-"]').forEach(b => b.classList.toggle('on', b === el));
        updateNote(ctx);
        ctx.studio.focusOn([]);
        ctx.studio.dirty = true;
      }
    },

    onParam(k, v, ctx) { updateNote(ctx); },

    init(ctx) {
      updateNote(ctx);
      const host = ctx.root.querySelector('#p10-steps');
      if (host) window.UI.mountSteps(host, [
        { t: '在正方体 ABCD-A₁B₁C₁D₁ 中，设棱长为 a。要求 A 到平面 A₁BD 的距离。', why: '题设', keys: ['pt:h'] },
        { t: '用<b>等体积法</b>：V<sub>A-A₁BD</sub> = V<sub>A₁-ABD</sub>，即 ⅓·S<sub>△A₁BD</sub>·d = ⅓·S<sub>△ABD</sub>·a。', why: '同一个三棱锥换一个顶点计算体积', keys: ['pt:h'] },
        { t: 'S<sub>△ABD</sub> = ½a²；S<sub>△A₁BD</sub> = (√3/4)(√2a)² = (√3/2)a²。', why: '△A₁BD 是边长为 √2a 的正三角形', keys: ['pt:h'] },
        { t: '代入得 ⅓·(√3/2)a²·d = ⅓·½a²·a，解得 d = a/√3 = (√3/3)a。', why: '解方程', keys: ['pt:h'] },
        { t: '等体积法的要点：同一个三棱锥用两组不同的“底—高”写体积，方程中高就是所求距离。', why: '等体积法（求点面距离的通用方法）', keys: ['pt:h'] },
      ], ctx);
    },

    tip: `立体几何中的“距离”最后都归结为<b>垂线段的长度</b>：点到面、线到面、面到面、异面直线之间，本质都是“作垂线、求长度”。角度则归结为<b>三句话</b>：线线角靠平移，线面角靠射影，二面角靠平面角。`,
    tipMore: `求点面距离的两把钥匙：① <b>等体积法</b>（不需找垂足，最通用）；② <b>作垂线</b>（找垂足后解直角三角形）。求线面角必须“一作（作射影）、二证（证射影）、三算（解直角三角形）”。`,

    tabs: {
      knowledge: `
        <h2 class="sec">距离与角度 <span class="tag">度量问题</span></h2>
        <h3 class="sec-sub">一、三种距离</h3>
        <div class="card">
          <ul>
            <li><b>点到平面的距离</b>：过点作平面的垂线，垂线段的长度。</li>
            <li><b>直线到平面的距离</b>（l ∥ α）：l 上任意一点到 α 的距离，与点的选取无关（教材 8.6 例 5）。</li>
            <li><b>两个平行平面间的距离</b>：一个平面内任意一点到另一个平面的距离，处处相等。</li>
            <li><b>异面直线的距离</b>：两条异面直线的公垂线段的长度（公垂线与两条直线都垂直且相交）。</li>
          </ul>
        </div>
        <h3 class="sec-sub">二、三种角</h3>
        <table class="tb">
          <thead><tr><th>角的名称</th><th>定义</th><th>范围</th></tr></thead>
          <tbody>
            <tr><td>异面直线所成角</td><td>平移到相交后所成的锐角或直角</td><td>(0°, 90°]</td></tr>
            <tr><td>直线与平面所成的角</td><td>斜线与它在平面内的射影所成的锐角；线在面内 0°，线⊥面 90°</td><td>[0°, 90°]</td></tr>
            <tr><td>二面角的平面角</td><td>棱上任一点在两个面内作棱的垂线所成的角</td><td>[0°, 180°]</td></tr>
          </tbody>
        </table>
        <div class="theo">
          <div class="theo-t">最小角定理（教材阅读材料）</div>
          <p>斜线与平面所成的角，是这条斜线与平面内所有直线所成角中最小的角。</p>
          <p>推论：cos θ = cos θ₁ · cos θ₂（θ 为线面角，θ₁ 为斜线与平面内某直线的角，θ₂ 为该直线与射影的角）。</p>
        </div>
        <h3 class="sec-sub">三、等体积法求点面距离</h3>
        <p class="lead">三棱锥 P-ABC 中，用两种“底—高”组合写体积：</p>
        <p class="fml">⅓·S<sub>△ABC</sub>·h<sub>P</sub> = ⅓·S<sub>△PBC</sub>·d<sub>A→PBC</sub></p>
        <p class="lead">其中 d 就是要求的点面距离，方程解出即可，不必先找垂足。</p>
      `,
      example: `
        <h2 class="sec">典型例题 <span class="tag">距离与角</span></h2>
        <div class="card">
          <div class="example-head"><span class="no">例题</span><span class="src">等体积法 · 点面距离</span></div>
          <p>正方体 ABCD-A₁B₁C₁D₁ 的棱长为 a，求点 A 到平面 A₁BD 的距离。</p>
        </div>
        <div id="p10-steps"></div>

        <h3 class="sec-sub">定义法求线面角</h3>
        <div class="card soft">
          <p>正方体棱长为 1，求 A₁C 与底面 ABCD 所成的角。</p>
          <p><b>解：</b>AA₁ ⊥ 平面 ABCD，故 AC 是 A₁C 在底面上的射影，∠A₁CA 即为所求。</p>
          <p>AC = √2，AA₁ = 1，故 tan∠A₁CA = 1/√2 = √2/2，即所求角为 arctan(√2/2) ≈ 35.3°。</p>
          <p>切到左侧“线面角”，拖动滑块可看到射影与角的变化（图中用 ∠PAH 表示）。</p>
        </div>
      `,
      practice: `
        <h2 class="sec">练习 <span class="tag">综合</span></h2>
        <div class="q">
          <div class="q-head"><span class="qn">1</span><span>正方体棱长为 2，求异面直线 AA₁ 与 BC 的距离。</span></div>
          <button class="ans-btn" data-reveal>显示答案与步骤</button>
          <div class="ans">
            <div class="a-line"><b>答案</b>　距离为 2。</div>
            <div class="sol-step" data-n="1">AB ⊥ AA₁（侧面是正方形），AB ⊥ BC（底面是正方形）。</div>
            <div class="sol-step" data-n="2">且 AB 与 AA₁、BC 都相交，故 AB 是两条异面直线的公垂线段。</div>
            <div class="sol-step" data-n="3">所以距离 = AB = 2。</div>
          </div>
        </div>
        <div class="q">
          <div class="q-head"><span class="qn">2</span><span>正方体棱长为 1，求二面角 A₁-BD-A 的平面角的余弦值。</span></div>
          <button class="ans-btn" data-reveal>显示答案与步骤</button>
          <div class="ans">
            <div class="a-line"><b>答案</b>　cos∠A₁OA = √3/3。</div>
            <div class="sol-step" data-n="1">取 BD 中点 O，AO = √2/2，A₁O = √(1² + (√2/2)²) = √6/2。</div>
            <div class="sol-step" data-n="2">AA₁ = 1，在 Rt△A₁AO 中，cos∠A₁OA = AO/A₁O = (√2/2)/(√6/2) = √3/3。</div>
            <div class="sol-step" data-n="3">所求二面角的平面角即为 ∠A₁OA，故余弦值为 √3/3。</div>
          </div>
        </div>
        <div class="q">
          <div class="q-head"><span class="qn">3</span><span>正三棱柱 ABC-A₁B₁C₁ 中，AB = AA₁ = 2，求 AB₁ 与平面 ABC 所成角的正切值。</span></div>
          <button class="ans-btn" data-reveal>显示答案与步骤</button>
          <div class="ans">
            <div class="a-line"><b>答案</b>　tan θ = 2/2 = 1，即 θ = 45°。</div>
            <div class="sol-step" data-n="1">B₁ 在底面上的射影是 B，故 AB 是 AB₁ 的射影，∠B₁AB 即为所求。</div>
            <div class="sol-step" data-n="2">BB₁ ⊥ 平面 ABC，故 BB₁ ⊥ AB，在 Rt△ABB₁ 中 tan∠B₁AB = BB₁/AB = 2/2 = 1。</div>
            <div class="sol-step" data-n="3">所以所求角为 45°。</div>
          </div>
        </div>
        <div class="q">
          <div class="q-head"><span class="qn">4</span><span>（教材 8.6 例 9）已知平面 α ⊥ 平面 β，直线 a ⊥ β，a ⊄ α，判断 a 与 α 的位置关系。</span></div>
          <button class="ans-btn" data-reveal>显示答案与步骤</button>
          <div class="ans">
            <div class="a-line"><b>答案</b>　a ∥ α。</div>
            <div class="sol-step" data-n="1">在 α 内作垂直于 α 与 β 交线的直线 b。</div>
            <div class="sol-step" data-n="2">∵ α ⊥ β，∴ b ⊥ β（面面垂直的性质定理）。</div>
            <div class="sol-step" data-n="3">又 a ⊥ β，∴ a ∥ b（线面垂直的性质定理）。</div>
            <div class="sol-step" data-n="4">∵ a ⊄ α，b ⊂ α，∴ a ∥ α（线面平行判定定理）。</div>
          </div>
        </div>
      `,
    },
  });

  function updateNote(ctx) {
    const n = ctx.root.querySelector('#p10-note');
    if (!n) return;
    const p = ctx.params;
    const map = {
      point: '<b>点到平面的距离</b><br>过点 P 作平面 α 的垂线，垂足为 H，则 d = PH。<br>图中拖动“位置”滑块，d 随点移动而变化。',
      line: '<b>直线到平面的距离</b><br>l ∥ α 时，l 上每一点到 α 的距离都相等（教材 8.6 例 5 的结论）。',
      skew: '<b>异面直线的距离</b><br>公垂线与两条异面直线都垂直且相交，其长度就是两直线的距离。图中 AA₁ 与 BC 的公垂线段是 AB。',
      angle: '<b>直线与平面所成的角</b><br>斜线 AP、射影 AH、垂线段 PH 构成直角三角形，∠PAH 即线面角。<br>tan∠PAH = PH/AH，sin∠PAH = PH/AP。',
      dihedral: '<b>二面角的平面角</b><br>在棱 BD 上取点 O，分别在两个面内作 BD 的垂线 OA、OA₁，∠A₁OA 就是平面角。',
    };
    n.innerHTML = map[p.mode] || map.point;
    n.classList.remove('hide');
  }
})();
