/* =============================================================
   第 11 页 · 章末复习与综合应用
   内容：组合体（正方体切角 + 内切球 / 外接球）、综合例题、
         10 道精选题库、完整知识网络思维导图（可点击跳页）
   ============================================================= */
(function () {
  'use strict';
  const E = window.Ink3D, G = window.Geo;
  const V = E.V;

  window.PAGES.push({
    id: 'p11',
    short: '章末综合与测试',
    title: '章末复习与综合应用',
    running: '第八章 复习参考题',
    chapter: '章末',
    defaults: { mode: 'combo', ex: 0, sphere: 'both' },
    vizTools: `
      <button class="chip on" data-viz="c-combo">组合体</button>
      <button class="chip" data-viz="c-cut">拆解·切去的角</button>
      <button class="chip" data-viz="c-inner">内切球</button>
      <button class="chip" data-viz="c-outer">外接球</button>
      <div class="slider-chip">拆解 <input type="range" data-param="ex" min="0" max="1" step="0.01" value="0"><span class="v">0.00</span></div>
      <div class="viz-card" id="p11-note"></div>`,
    camera: { zoom: 0.98, pitch: 0.28, yaw: -0.6, offset: [0, 1.1, 0], dist: 11, fov: 8.2 },

    scene(t, ctx) {
      const st = ctx.studio, p = ctx.params, mode = p.mode, ex = p.ex || 0;
      const items = [];
      const a = 2.3, h = a / 2;
      const acc = G.accent(st), ink = G.ink(st);
      const showSphere = (mode === 'inner' || mode === 'outer' || (mode === 'combo' && p.sphere === 'both'));

      // 主体正方体
      const cube = G.cube({ st, a, key: 'cb', alpha: 0.78, tint: G.tint(st, 0.05) });
      items.push(cube.items);
      const { A, B, C, D } = cube.v;
      const A1 = cube.v['A₁'], B1 = cube.v['B₁'], C1 = cube.v['C₁'], D1 = cube.v['D₁'];
      const O = [0, h, 0];

      // 切去的角：三棱锥 A₁-AB₁D₁（顶点 A₁，底面 △AB₁D₁）
      if (mode !== 'inner' && mode !== 'outer') {
        const k = ex;
        const apexOff = V.mul([A1[0], 0, A1[2]], -0.9 * k);  // 拆解时角块外移
        const shiftPt = q => V.add(q, apexOff);
        items.push(E.face([shiftPt(A), shiftPt(B1), shiftPt(D1), shiftPt(A1)], {
          color: acc, alpha0: 0.3, edgeColor: acc, sw: 2.2, layer: 'top', key: 'cut',
          tip: '切去的三棱锥 A₁-AB₁D₁：三条棱两两垂直，长度都是 a',
        }));
        items.push(E.line(shiftPt(A), shiftPt(B1), { color: acc, sw: 1.8, key: 'cut' }));
        items.push(E.line(shiftPt(B1), shiftPt(D1), { color: acc, sw: 1.8, key: 'cut' }));
        items.push(E.line(shiftPt(D1), shiftPt(A), { color: acc, sw: 1.8, key: 'cut' }));
        // 剩余几何体上的截面 △AB₁D₁
        items.push(E.face([A, B1, D1], {
          color: ink, alpha0: k > 0.1 ? 0.1 : 0.3, edgeColor: ink, sw: 2, layer: 'top', key: 'cutface',
          tip: '截面 △AB₁D₁：等边三角形，边长 √2a',
        }));
        items.push(E.label(G.centroid([A, B1, D1]), '截面', { size: 10, dy: 6, alpha: 0.9, key: 'cutface' }));
        if (k > 0.3) {
          items.push(E.label(V.add(G.centroid([A, B1, D1]), [0, 0.55, 0]), '切去的三棱锥', {
            color: acc, size: 10.5, dy: -6, key: 'cut',
          }));
        }
      }

      // 球
      if (showSphere) {
        if (mode !== 'outer') {
          items.push(G.sphere({ c: O, r: h, key: 'sph:inner', color: E.mix(acc, '#ffffff', 0.72), alpha: mode === 'inner' ? 0.95 : 0.55 }));
          items.push(G.circle3(O, [1, 0, 0], [0, 0, 1], h, { color: acc, sw: 1.4, alpha: 0.9, key: 'sph:inner' }));
        }
        if (mode !== 'inner') {
          const R = a * Math.sqrt(3) / 2;
          // 外接球：用虚线大圆 + 半径
          items.push(G.circle3(O, [1, 0, 0], [0, 0, 1], R, { color: ink, sw: 1.3, alpha: 0.62, dash: [5, 4], key: 'sph:outer' }));
          items.push(G.circle3(O, [0, 1, 0], [0, 0, 1], R, { color: ink, sw: 1.0, alpha: 0.4, dash: [5, 4], key: 'sph:outer' }));
          const Rv = [R * Math.cos(0.7), h, R * Math.sin(0.7)];
          items.push(E.line(O, Rv, { color: ink, sw: 1.4, key: 'sph:outer', dash: [4, 3] }));
          items.push(E.label(V.lerp(O, Rv, 0.6), 'R = (√3/2)a', { dx: 26, dy: 8, size: 10.5, key: 'sph:outer' }));
        }
        items.push(E.point(O, { r: 3.6, key: 'sph:O' }));
        items.push(E.label(O, 'O', { dx: 10, dy: 10, size: 12.5, key: 'sph:O' }));
      }

      // 说明文字
      let txt = '正方体切角 + 内切球 / 外接球';
      if (mode === 'inner') txt = '内切球：球心为正方体中心，半径 r = a/2';
      if (mode === 'outer') txt = '外接球：球心为正方体中心，半径 R = (√3/2)a';
      if (mode === 'cut') txt = '切去的三棱锥 A₁-AB₁D₁，V = a³/6';
      items.push(E.label([0, -1.35, 0], txt, { size: 11, color: ink, alpha: 0.85 }));
      return { items, fit: 1.0 };
    },

    onViz(act, el, ctx) {
      const map = { 'c-combo': 'combo', 'c-cut': 'cut', 'c-inner': 'inner', 'c-outer': 'outer' };
      if (map[act]) {
        ctx.params.mode = map[act];
        ctx.root.querySelectorAll('[data-viz^="c-"]').forEach(b => b.classList.toggle('on', b === el));
        note(ctx);
        ctx.studio.dirty = true;
      }
    },

    onParam(k, v, ctx) { note(ctx); },

    init(ctx) {
      note(ctx);
      const host = ctx.root.querySelector('#p11-steps');
      if (host) window.UI.mountSteps(host, [
        { t: '设棱长为 a。切去的三棱锥 A₁-AB₁D₁ 中，AA₁、AB₁、AD₁ 两两垂直，且都等于 a。', why: '正方体的棱与面对角线互相垂直', keys: ['cut', 'cutface'] },
        { t: 'V<sub>三棱锥</sub> = ⅓ × (½a²) × a = a³/6，故剩余部分体积 = a³ − a³/6 = <b>5a³/6</b>。', why: '棱锥体积公式 V = ⅓Sh', keys: ['cut'] },
        { t: '截面 △AB₁D₁ 的三边都是面对角线，长度为 √2a，故为等边三角形，面积 = (√3/4)(√2a)² = (√3/2)a²。', why: '等边三角形面积公式', keys: ['cutface'] },
        { t: 'BD ⊥ AC，BD ⊥ AA₁ ⟹ BD ⊥ 平面 ACC₁A₁ ⟹ BD ⊥ A₁C；同理可证 AB₁ ⊥ 平面 A₁BCD₁ 中的垂直关系。', why: '线面垂直的判定与性质（8.6）', keys: ['cutface'] },
        { t: '外接球球心即正方体中心 O，OA = ½·(√3a) = (√3/2)a；内切球半径 r = a/2。故 R : r = √3 : 1。', why: '正方体的外接球与内切球（8.3 球）', keys: ['sph:outer', 'sph:inner', 'sph:O'] },
        { t: '二面角 A₁-BD-A 的平面角为 ∠A₁OA，tan∠A₁OA = AA₁/AO = a ÷ (√2a/2) = √2。', why: '二面角的平面角（8.6.2）', keys: ['sph:O'] },
      ], ctx);
    },

    tip: `章末复习的主线：<b>结构 → 画图 → 度量 → 推理</b>。结构上抓“柱、锥、台、球”，画图用斜二测，度量靠公式，推理靠“线线 ⟺ 线面 ⟺ 面面”的平行与垂直转化链。`,
    tipMore: `组合体问题的通用策略：<b>“拆”与“补”</b>。拆——把组合体分成几个基本几何体分别求体积再相加；补——把不规则部分补成规则几何体，用“大减小”。球的切接问题则抓住“球心在几何体的对称中心（或对称轴上）”。`,

    tabs: {
      knowledge: `
        <h2 class="sec">章末知识网络 <span class="tag">点击跳转</span></h2>
        <p class="lead">点击下方任一节点，可直接回到对应小节复习。</p>
        <div class="mindmap" id="mindmap">
          <div class="mm-grid">
            <div class="mm-core">第八章　立体几何初步</div>
            <button class="mm-node" data-goto="1"><b>8.1 基本立体图形</b><span>棱柱·棱锥·棱台·圆柱·圆锥·圆台·球</span></button>
            <button class="mm-node" data-goto="2"><b>结构深化</b><span>正棱柱/正棱锥、四个直角三角形</span></button>
            <button class="mm-node" data-goto="3"><b>旋转体</b><span>轴、母线、轴截面、球的截面</span></button>
            <button class="mm-node" data-goto="4"><b>8.2 直观图</b><span>斜二测：45°、横不变、纵减半</span></button>
            <button class="mm-node" data-goto="5"><b>8.3 表面积与体积</b><span>S侧/ S全/ V；柱锥台统一公式</span></button>
            <button class="mm-node" data-goto="6"><b>8.4 基本事实</b><span>事实 1/2/3 与推论 1/2/3</span></button>
            <button class="mm-node" data-goto="7"><b>两条直线</b><span>相交·平行·异面；等角定理</span></button>
            <button class="mm-node" data-goto="8"><b>8.5 平行</b><span>线线 ⟺ 线面 ⟺ 面面</span></button>
            <button class="mm-node" data-goto="9"><b>8.6 垂直</b><span>线面垂直、二面角、面面垂直</span></button>
            <button class="mm-node" data-goto="10"><b>距离与角度</b><span>点面距、异面直线距、线面角</span></button>
            <button class="mm-node" data-goto="11"><b>章末综合</b><span>组合体、球与切接、综合测试</span></button>
          </div>
        </div>
        <h3 class="sec-sub">本章核心公式速查</h3>
        <div class="formula-grid">
          <div class="fc"><div class="fc-t">柱体</div><div class="fc-f">V = Sh；圆柱 S = 2πr(r+l)</div></div>
          <div class="fc"><div class="fc-t">锥体</div><div class="fc-f">V = ⅓Sh；圆锥 S = πr(r+l)</div></div>
          <div class="fc"><div class="fc-t">台体</div><div class="fc-f">V = ⅓h(S′+√(S′S)+S)</div></div>
          <div class="fc"><div class="fc-t">球</div><div class="fc-f">S = 4πR²，V = 4/3πR³</div></div>
        </div>
        <div class="note"><b>正方体的两个球</b>　内切球 r = a/2；棱切球 r = (√2/2)a；外接球 R = (√3/2)a。三者之比 1 : √2 : √3。</div>
      `,
      example: `
        <h2 class="sec">综合例题 <span class="tag">切角与球</span></h2>
        <div class="card">
          <div class="example-head"><span class="no">综合</span><span class="src">正方体切角 + 内切球 / 外接球</span></div>
          <p>正方体 ABCD-A₁B₁C₁D₁ 的棱长为 a，切去三棱锥 A₁-AB₁D₁ 得到一个新几何体。</p>
          <p>(1) 求新几何体的体积；(2) 求截面 △AB₁D₁ 的面积；(3) 求原正方体外接球与内切球的半径之比；(4) 求二面角 A₁-BD-A 的平面角的正切值。</p>
        </div>
        <div id="p11-steps"></div>
        <div class="note">点击左侧“拆解·切去的角”并拖动滑块，可以把切下的三棱锥分离出来观察；点击“内切球 / 外接球”可对比两个球。</div>
      `,
      practice: `
        <h2 class="sec">章末测试 <span class="tag">10 题</span></h2>
        <div class="card soft">
          <p>选择题 4 题、填空题 3 题、解答题 3 题，覆盖 8.1—8.6 全部知识点。每题点击“显示答案与步骤”即可查看分步解析。</p>
        </div>
        ${[
          {
            n: '1', type: '选择',
            q: '下列说法正确的是（　）。',
            opts: ['有两个面平行，其余各面都是平行四边形的几何体是棱柱', '棱台的侧棱延长后必交于一点', '底面是正多边形的棱锥是正棱锥', '球的任意截面都是大圆'],
            ok: 1,
            ans: 'B',
            sol: ['A 错：反例为“两个全等棱锥底面相对拼接”的几何体，侧面是三角形。',
              'B 对：棱台是用平行于底面的平面截棱锥得到的，侧棱延长后交于原棱锥的顶点。',
              'C 错：还要求顶点在底面的射影是底面中心。',
              'D 错：只有过球心的截面才是大圆，其余截面是半径更小的圆。'],
          },
          {
            n: '2', type: '选择',
            q: '用斜二测画法画边长为 2 的正三角形的直观图，其面积为（　）。',
            opts: ['√3/2', '√6/4', '√6/2', '√3'],
            ok: 1,
            ans: 'B',
            sol: ['原正三角形面积 S = (√3/4)×2² = √3。',
              '斜二测直观图面积 S′ = (√2/4)S = (√2/4)×√3 = √6/4。'],
          },
          {
            n: '3', type: '选择',
            q: '设 m、n 是两条不同的直线，α、β 是两个不同的平面，下列命题正确的是（　）。',
            opts: ['若 m ∥ α，n ⊂ α，则 m ∥ n', '若 m ⊥ α，n ∥ α，则 m ⊥ n', '若 m ∥ α，m ∥ β，则 α ∥ β', '若 α ⊥ β，m ⊂ α，则 m ⊥ β'],
            ok: 1,
            ans: 'B',
            sol: ['A 错：m 与 n 可能异面。',
              'B 对：n ∥ α，则存在 n′ ⊂ α，n′ ∥ n；m ⊥ α ⟹ m ⊥ n′ ⟹ m ⊥ n。',
              'C 错：α 与 β 可能相交，只要 m 平行于它们的交线即可。',
              'D 错：只有垂直于交线的直线才垂直于另一个平面。'],
          },
          {
            n: '4', type: '选择',
            q: '正方体的内切球与外接球的表面积之比为（　）。',
            opts: ['1 : 2', '1 : 3', '1 : √3', '1 : 4'],
            ok: 1,
            ans: 'B',
            sol: ['内切球 r = a/2，外接球 R = (√3/2)a，故 r : R = 1 : √3。',
              '表面积之比等于半径平方之比 = 1 : 3。'],
          },
          {
            n: '5', type: '填空',
            q: '圆锥的底面半径为 1，母线长为 3，则其侧面展开图的圆心角为 ______。',
            ans: '2π/3（即 120°）',
            sol: ['设展开图扇形圆心角为 θ，则弧长 = rθ = 2π×1 = 2π（半径取母线 3）。',
              '故 3θ = 2π，θ = 2π/3，即 120°。'],
          },
          {
            n: '6', type: '填空',
            q: '正四棱锥的底面边长为 2，高为 √3，则它的侧棱长为 ______，斜高为 ______。',
            ans: '侧棱 l = √5，斜高 h′ = 2',
            sol: ['底面正方形外接圆半径 R = (√2/2)a = √2，边心距 r = a/2 = 1。',
              '侧棱 l = √(h² + R²) = √(3 + 2) = √5。',
              '斜高 h′ = √(h² + r²) = √(3 + 1) = 2。'],
          },
          {
            n: '7', type: '填空',
            q: '在正方体 ABCD-A₁B₁C₁D₁ 中，异面直线 A₁B 与 B₁C 所成的角为 ______。',
            ans: '60°',
            sol: ['A₁B ∥ D₁C（A₁D₁ ∥ BC 且相等），故所求角等于 ∠B₁CD₁。',
              '△B₁CD₁ 三边都是面对角线，为等边三角形，故 ∠B₁CD₁ = 60°。'],
          },
          {
            n: '8', type: '解答',
            q: '在正方体 ABCD-A₁B₁C₁D₁ 中，求证：平面 AB₁D₁ ∥ 平面 BC₁D。',
            ans: '见步骤',
            sol: ['∵ ABCD-A₁B₁C₁D₁ 为正方体，∴ AB ∥ D₁C₁ 且 AB = D₁C₁，∴ 四边形 ABC₁D₁ 是平行四边形，∴ AB₁ ∥ DC₁。',
              '又 AB₁ ⊄ 平面 BC₁D，DC₁ ⊂ 平面 BC₁D，∴ AB₁ ∥ 平面 BC₁D。',
              '同理 AD₁ ∥ BC₁，得 AD₁ ∥ 平面 BC₁D。',
              '∵ AB₁ ∩ AD₁ = A，AB₁、AD₁ ⊂ 平面 AB₁D₁，∴ 平面 AB₁D₁ ∥ 平面 BC₁D。'],
          },
          {
            n: '9', type: '解答',
            q: '在正方体 ABCD-A₁B₁C₁D₁ 中，棱长为 2。求点 A 到平面 A₁BD 的距离。',
            ans: 'd = 2√3/3',
            sol: ['截面 △A₁BD 是边长为 2√2 的等边三角形，S = (√3/4)(2√2)² = 2√3。',
              'V<sub>A₁-ABD</sub> = ⅓ × ½ × 2 × 2 × 2 = 4/3。',
              '等体积：⅓ × 2√3 × d = 4/3，得 d = 2/√3 = 2√3/3。'],
          },
          {
            n: '10', type: '解答',
            q: '圆锥的底面半径为 3，高为 4，求它的内接圆柱（底面在圆锥底面上、上底面在侧面上）侧面积的最大值。',
            ans: '最大侧面积为 6π',
            sol: ['设圆柱底面半径 r（0 < r < 3），高 h。由相似三角形：(3 − r)/3 = h/4，故 h = 4(3 − r)/3。',
              'S侧 = 2πr·h = 8πr(3 − r)/3。',
              '由二次函数最值，r = 3/2 时 S侧 取最大值 8π/3 × (9/4) = 6π。'],
          },
        ].map((it, i) => `
          <div class="q" data-q="${it.n}">
            <div class="q-head"><span class="qn">${it.n}</span><span><b>［${it.type}］</b>${it.q}</span></div>
            ${it.opts ? `<div class="opts">${it.opts.map((o, j) =>
              `<button class="opt" data-ok="${j === it.ok ? 1 : 0}"><span class="mk">${'ABCD'[j]}</span>${o}</button>`).join('')}</div>` : ''}
            <button class="ans-btn" data-reveal data-open="显示答案与步骤" data-close="收起解析">显示答案与步骤</button>
            <div class="ans">
              <div class="a-line"><b>答案</b>　${it.ans}</div>
              ${it.sol.map((s, k) => `<div class="sol-step" data-n="${k + 1}">${s}</div>`).join('')}
            </div>
          </div>`).join('')}
      `,
    },
  });

  function note(ctx) {
    const n = ctx.root.querySelector('#p11-note');
    if (!n) return;
    const p = ctx.params;
    const map = {
      combo: '<b>组合体</b>　正方体切去三棱锥 A₁-AB₁D₁，并放入内切球（红）与外接球（虚线）。<br>V<sub>剩</sub> = a³ − a³/6 = 5a³/6。',
      cut: '<b>切去的三棱锥</b><br>AA₁、AB₁、AD₁ 两两垂直且都等于 a，V = ⅓ × ½a² × a = a³/6。<br>截面 △AB₁D₁ 为边长 √2a 的等边三角形。',
      inner: '<b>内切球</b><br>球心为正方体中心，与六个面相切，r = a/2。<br>S = 4π(a/2)² = πa²，V = πa³/6。',
      outer: '<b>外接球</b><br>球心为正方体中心，过 8 个顶点，R = (√3/2)a。<br>S = 3πa²，V = (√3/2)πa³。',
    };
    n.innerHTML = map[p.mode] || map.combo;
    n.classList.remove('hide');
  }
})();
