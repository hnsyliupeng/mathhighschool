/* =============================================================
   第 7 页 · 空间两条直线的位置关系
   知识点：8.4.2 相交 / 平行 / 异面；异面直线的画法；
           等角定理（8.5）；基本事实 4（平行传递性）
   ============================================================= */
(function () {
  'use strict';
  const E = window.Ink3D, G = window.Geo;
  const V = E.V;

  const MODES = {
    cross: {
      title: '相交直线',
      text: '在同一平面内，有且只有一个公共点。图中 AB 与 AD 都在平面 ABCD 内，交于点 A。',
    },
    parallel: {
      title: '平行直线',
      text: '在同一平面内，没有公共点。图中 AB ∥ A₁B₁。基本事实 4：平行于同一条直线的两条直线平行（平行线的传递性）。',
    },
    skew: {
      title: '异面直线',
      text: '不同在任何一个平面内的两条直线。图中 AB 与 CC₁ 既不平行也不相交。注意：异面直线没有公共点，但“没有公共点”并不一定是异面（还可能平行）。',
    },
    angle: {
      title: '等角定理',
      text: '如果空间中两个角的两条边分别对应平行，那么这两个角相等或互补。图中 ∠BAC 与 ∠B₁A₁C₁ 的两边分别平行，故相等。',
    },
  };

  window.PAGES.push({
    id: 'p7',
    short: '两条直线的位置关系',
    title: '空间两条直线的位置关系',
    running: '8.4 异面直线',
    chapter: '8.4',
    defaults: { mode: 'skew' },
    vizTools: `
      <button class="chip" data-viz="l-cross">相交</button>
      <button class="chip" data-viz="l-parallel">平行</button>
      <button class="chip on" data-viz="l-skew">异面</button>
      <button class="chip ghost" data-viz="l-angle">等角定理</button>
      <button class="chip ghost" data-viz="l-move">平移法求角</button>
      <div class="viz-card" id="p7-note"></div>`,
    camera: { zoom: 1.0, pitch: 0.3, yaw: -0.6, offset: [0, 1.05, 0] },

    scene(t, ctx) {
      const st = ctx.studio, mode = ctx.params.mode;
      const items = [];
      const cube = G.cube({ st, a: 2.3, key: 'c', alpha: mode === 'skew' || mode === 'parallel' ? 0.42 : 0.95 });
      items.push(cube.items);
      const { A, B, C, D } = cube.v;
      const A1 = cube.v['A₁'], B1 = cube.v['B₁'], C1 = cube.v['C₁'], D1 = cube.v['D₁'];
      const line = (p, q, key, opt) => E.line(p, q, Object.assign({ color: G.accent(st), sw: 3.4, key, layer: 'top' }, opt));
      const tip = (pts, key, text) => E.label([0, 3.05, 0], text, {
        color: G.accent(st), size: 11.5, key,
      });

      if (mode === 'cross') {
        items.push(line(A, B, 'x', { tip: 'AB 与 AD 相交于点 A' }));
        items.push(line(A, D, 'x', { tip: 'AB 与 AD 相交于点 A' }));
        items.push(E.point(A, { r: 4.4, ring: true, key: 'x' }));
        items.push(E.label(A, 'A', { dx: -14, dy: 12, size: 13, color: G.accent(st), key: 'x' }));
        items.push(tip([A, B, D], 'x', '相交：只有一个公共点 A'));
      }
      if (mode === 'parallel') {
        items.push(line(A, B, 'pa', { tip: 'AB ∥ A₁B₁' }));
        items.push(line(A1, B1, 'pa', { tip: 'AB ∥ A₁B₁' }));
        items.push(E.line(A, A1, { color: G.ink(st), sw: 1, dash: [4, 4], alpha: 0.4 }));
        items.push(E.line(B, B1, { color: G.ink(st), sw: 1, dash: [4, 4], alpha: 0.4 }));
        items.push(tip([G.mid(A, B), G.mid(A1, B1)], 'pa', 'AB ∥ A₁B₁：共面且无公共点'));
      }
      if (mode === 'skew') {
        items.push(line(A, B, 'sk', { tip: 'AB ∥ A₁B₁、AB ∥ CD，但与 CC₁ 不共面' }));
        items.push(line(C, C1, 'sk', { tip: '与 AB 异面的直线' }));
        items.push(E.point(A, { r: 3.4 }), E.point(B, { r: 3.4 }));
        items.push(E.point(C, { r: 3.4 }), E.point(C1, { r: 3.4 }));
        items.push(tip([G.mid(A, B), G.mid(C, C1)], 'sk', 'AB 与 CC₁：异面直线'));
        // 辅助：过 B 作 CC₁ 的平行线 BB₁，说明“不共面”
        items.push(E.line(B, B1, { color: G.ink(st), sw: 1.2, dash: [5, 4], alpha: 0.6 }));
        items.push(E.label(G.mid(B, B1), 'BB₁ ∥ CC₁', { dx: 26, dy: 0, size: 10.5, key: 'sk' }));
      }
      if (mode === 'angle') {
        items.push(line(A, B, 'an', { tip: '∠BAC 与 ∠B₁A₁C₁ 的两边分别平行' }));
        items.push(line(A, C, 'an'));
        items.push(line(A1, B1, 'an'));
        items.push(line(A1, C1, 'an'));
        items.push(E.angle(B, A, C, '∠BAC', { key: 'an', color: G.accent(st) }));
        items.push(E.angle(B1, A1, C1, '∠B₁A₁C₁', { key: 'an', color: G.accent(st) }));
        items.push(E.point(A, { r: 3.2, key: 'an' }), E.point(A1, { r: 3.2, key: 'an' }));
        items.push(tip([A, A1], 'an', '等角定理：两边分别平行 ⟹ 相等或互补'));
      }
      if (mode === 'move') {
        const P = [A[0] + 0.9, 0, A[2] - 0.9];   // 在底面作与 AB 平行的线？改为平移 AB 到过 C1
        items.push(line(A, B, 'mv', { tip: 'AB' }));
        items.push(line(D1, C1, 'mv', { tip: 'D₁C₁ ∥ AB（平移后）' }));
        items.push(line(C1, C, 'mv', { tip: 'CC₁' }));
        items.push(E.point(C1, { r: 4, ring: true, key: 'mv' }));
        items.push(E.angle(D1, C1, C, '90°', { key: 'mv', color: G.accent(st) }));
        items.push(E.label(G.mid(D1, C1), '平移 AB 到 D₁C₁', { dy: -20, size: 10.5, key: 'mv' }));
        items.push(tip([D1, C, C1], 'mv', '异面直线所成角 = ∠D₁C₁C = 90°'));
      }
      return { items, fit: 1.0 };
    },

    onViz(act, el, ctx) {
      if (act.indexOf('l-') === 0) {
        const map = { 'l-cross': 'cross', 'l-parallel': 'parallel', 'l-skew': 'skew', 'l-angle': 'angle', 'l-move': 'move' };
        ctx.params.mode = map[act];
        ctx.root.querySelectorAll('[data-viz^="l-"]').forEach(b => b.classList.toggle('on', b === el));
        const info = MODES[ctx.params.mode];
        const n = ctx.root.querySelector('#p7-note');
        if (n) {
          n.innerHTML = info
            ? `<b>${info.title}</b><br>${info.text}`
            : '<b>平移法求异面直线所成角</b><br>把其中一条直线平移，使两条直线相交，所得锐角（或直角）就是异面直线所成的角。图中把 AB 平移到 D₁C₁，∠D₁C₁C = 90°。';
          n.classList.remove('hide');
        }
        ctx.studio.focusOn([]);
        ctx.studio.dirty = true;
      }
    },

    init(ctx) {
      const n = ctx.root.querySelector('#p7-note');
      if (n) {
        n.innerHTML = `<b>${MODES.skew.title}</b><br>${MODES.skew.text}`;
        n.classList.remove('hide');
        n.addEventListener('click', () => n.classList.add('hide'));
      }
      const host = ctx.root.querySelector('#p7-steps');
      if (host) window.UI.mountSteps(host, [
        { t: '已知 AB ∩ α = B，A ∉ α，a ⊂ α，B ∉ a。要判断直线 AB 与 a 的位置关系。', why: '题设（教材 8.4 例 2）', keys: ['sk'] },
        { t: '假设 AB 与 a 不是异面直线，则它们相交或平行。', why: '反证法：否定结论', keys: ['sk'] },
        { t: '若 AB 与 a 相交或平行，则它们确定一个平面 β，于是 B ∈ β，a ⊂ β。', why: '推论 1 / 推论 3', keys: ['sk'] },
        { t: '而经过点 B 与直线 a 的平面有且只有一个，即 α，故 β 与 α 重合，从而 AB ⊂ α，A ∈ α。', why: '基本事实 1 与推论（唯一性）', keys: ['sk'] },
        { t: '这与 A ∉ α 矛盾，所以假设不成立，AB 与 a 是异面直线。', why: '反证法：得出矛盾，原结论成立', keys: ['sk'] },
      ], ctx);
    },

    tip: `空间两条直线的位置关系只有三种：<b>相交、平行、异面</b>。前两者统称共面直线，异面直线是“不同在任何一个平面内”的两条直线。判断异面的常用方法：与一个平面相交的直线，和这个平面内不经过交点的直线是异面直线。`,
    tipMore: `求异面直线所成角的标准三步：<b>① 平移（找平行线，常借中位线、平行四边形）；② 证明（说明所作角即为所求）；③ 计算（放在三角形中用余弦定理）。</b>异面直线所成角的范围是 (0°, 90°]。`,

    tabs: {
      knowledge: `
        <h2 class="sec">空间两条直线 <span class="tag">8.4.2</span></h2>
        <p class="lead">把两条直线放到空间中来，除了“相交”“平行”，还多出一种全新的关系——<b>异面</b>。</p>
        <table class="tb">
          <thead><tr><th>位置关系</th><th>公共点个数</th><th>是否共面</th><th>符号</th></tr></thead>
          <tbody>
            <tr><td>相交</td><td>1 个</td><td>共面</td><td>a ∩ b = P</td></tr>
            <tr><td>平行</td><td>0 个</td><td>共面</td><td>a ∥ b</td></tr>
            <tr><td>异面</td><td>0 个</td><td>不共面</td><td>—</td></tr>
          </tbody>
        </table>
        <div class="theo">
          <div class="theo-t">异面直线的判定（教材例 2）</div>
          <p>与一个平面相交的直线，和这个平面内不经过交点的直线是异面直线。</p>
          <p>符号：<span class="sym">AB ∩ α = B，A ∉ α，a ⊂ α，B ∉ a ⟹ AB 与 a 异面</span></p>
        </div>
        <div class="theo">
          <div class="theo-t">等角定理（8.5）</div>
          <p>如果空间中两个角的两条边分别对应平行，那么这两个角相等或互补。</p>
          <p>它是“平移法求异面直线所成角”的理论依据：平移不改变角的大小。</p>
        </div>
        <div class="theo">
          <div class="theo-t">基本事实 4（平行公理）</div>
          <p>平行于同一条直线的两条直线平行。符号：<span class="sym">a ∥ c，b ∥ c ⟹ a ∥ b</span>。</p>
          <p>这条性质叫平行线的<b>传递性</b>，是证明线线平行的基本工具（8.5 节例 1 证明中点四边形是平行四边形就用到它）。</p>
        </div>
        <div class="note"><b>常见误区</b>　① “没有公共点的两条直线平行”——错，还可能是异面；② “分别位于两个平面内的两条直线异面”——错，它们可能平行或相交；③ 异面直线所成角不可能是 0°，范围是 (0°, 90°]。</div>
      `,
      example: `
        <h2 class="sec">典型例题 <span class="tag">异面判定</span></h2>
        <div class="card">
          <div class="example-head"><span class="no">例题</span><span class="src">教材 8.4 例 2 · 反证法</span></div>
          <p>如图，AB ∩ α = B，A ∉ α，a ⊂ α，B ∉ a。直线 AB 与 a 具有怎样的位置关系？为什么？</p>
        </div>
        <div id="p7-steps"></div>

        <h3 class="sec-sub">正方体中的异面直线（高频结论）</h3>
        <div class="card soft">
          <p>在正方体 ABCD-A₁B₁C₁D₁ 中，与棱 AB 异面的棱有 4 条：<b>CC₁、DD₁、B₁C₁、A₁D₁</b>。</p>
          <p>与面对角线 AC 异面的棱有 6 条：BB₁、DD₁、A₁B₁、B₁C₁、C₁D₁、D₁A₁。</p>
          <p>结论：AB 与 A₁B₁ 平行、与 CD 平行、与 C₁D₁ 平行，这三条与 AB 共面，其余 4 条与 AB 异面。</p>
        </div>
      `,
      practice: `
        <h2 class="sec">练习 <span class="tag">异面与所成角</span></h2>
        <div class="q">
          <div class="q-head"><span class="qn">1</span><span>（教材习题 8.4 第 1 题）如果两条直线 a 与 b 没有公共点，那么 a 与 b（　）。</span></div>
          <div class="opts">
            <button class="opt" data-ok="0"><span class="mk">A</span>共面</button>
            <button class="opt" data-ok="0"><span class="mk">B</span>平行</button>
            <button class="opt" data-ok="0"><span class="mk">C</span>是异面直线</button>
            <button class="opt" data-ok="1"><span class="mk">D</span>可能平行，也可能是异面直线</button>
          </div>
          <button class="ans-btn" data-reveal>显示解析</button>
          <div class="ans">
            <div class="a-line"><b>答案</b>　D</div>
            <div class="sol-step" data-n="1">没有公共点只排除了“相交”，剩下的平行与异面都满足。</div>
            <div class="sol-step" data-n="2">要区分二者，还需判断是否共面。</div>
          </div>
        </div>
        <div class="q">
          <div class="q-head"><span class="qn">2</span><span>在正方体 ABCD-A₁B₁C₁D₁ 中，与棱 AB 异面的棱共有几条？分别写出。</span></div>
          <button class="ans-btn" data-reveal>显示答案与步骤</button>
          <div class="ans">
            <div class="a-line"><b>答案</b>　4 条：CC₁、DD₁、B₁C₁、A₁D₁。</div>
            <div class="sol-step" data-n="1">与 AB 共面的棱：AB ∥ CD，AB ∥ A₁B₁，AB ∥ C₁D₁（分别在底面、前面、上面内）。</div>
            <div class="sol-step" data-n="2">AB 与 AA₁、BB₁ 相交于 A、B，也不是异面。</div>
            <div class="sol-step" data-n="3">剩下 CC₁、DD₁、B₁C₁、A₁D₁ 既不平行也不相交，且不共面，故为异面。</div>
          </div>
        </div>
        <div class="q">
          <div class="q-head"><span class="qn">3</span><span>在正方体 ABCD-A₁B₁C₁D₁ 中，求异面直线 A₁B 与 B₁C 所成的角。</span></div>
          <button class="ans-btn" data-reveal>显示答案与步骤</button>
          <div class="ans">
            <div class="a-line"><b>答案</b>　60°。</div>
            <div class="sol-step" data-n="1">平移：A₁B ∥ D₁C（因为 A₁D₁ ∥ BC 且相等，故 A₁BCD₁ 是平行四边形）。</div>
            <div class="sol-step" data-n="2">于是所求角等于 ∠B₁CD₁（或其补角）。</div>
            <div class="sol-step" data-n="3">连接 B₁D₁，△B₁CD₁ 的三边都是正方体的面对角线，长度相等，故为等边三角形。</div>
            <div class="sol-step" data-n="4">所以 ∠B₁CD₁ = 60°，即异面直线 A₁B 与 B₁C 所成的角为 60°。</div>
          </div>
        </div>
        <div class="q">
          <div class="q-head"><span class="qn">4</span><span>判断（教材习题 8.4 第 3 题）：“若直线 l 上有无数个点不在平面 α 内，则 l ∥ α。”是否正确？</span></div>
          <div class="opts">
            <button class="opt" data-ok="0"><span class="mk">√</span>正确</button>
            <button class="opt" data-ok="1"><span class="mk">×</span>错误</button>
          </div>
          <div class="ans-block"></div>
          <button class="ans-btn" data-reveal>显示答案与步骤</button>
          <div class="ans">
            <div class="a-line"><b>答案</b>　错误。</div>
            <div class="sol-step" data-n="1">反例：直线 l 与平面 α 相交于点 P。此时 l 上除 P 外的点都在 α 外，有无数个点不在 α 内，但 l 与 α 相交。</div>
            <div class="sol-step" data-n="2">l ∥ α 需要“l 与 α 没有公共点”。</div>
          </div>
        </div>
      `,
    },
  });
})();
