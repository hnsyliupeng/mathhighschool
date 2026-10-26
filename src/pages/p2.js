/* =============================================================
   第 2 页 · 棱柱、棱锥、棱台深度（结构元素与四个直角三角形）
   知识点：8.1.1—8.1.3 结构特征；正棱柱、正棱锥的定义；
           正棱锥中的四个直角三角形（高 h、斜高 h′、侧棱 l、
           底面外接圆半径 R、边心距 r、底面边长 a 的关系）
   ============================================================= */
(function () {
  'use strict';
  const E = window.Ink3D, G = window.Geo;
  const LAB = G.LETTERS;

  function sqVerts(a, rot) {
    const R = a / Math.SQRT2;
    return G.ringPts(4, R, 0, Math.PI / 4).map(p => [p[0], 0, p[2]]);
  }

  window.PAGES.push({
    id: 'p2',
    short: '棱柱·棱锥·棱台',
    title: '棱柱 · 棱锥 · 棱台',
    running: '8.1 结构特征深化',
    chapter: '8.1',
    defaults: { mode: 'pyramid', h: 1.9, a: 1.7, explode: 0 },
    vizTools: `
      <button class="chip on" data-viz="mode-pyramid">正四棱锥</button>
      <button class="chip" data-viz="mode-prism">正四棱柱</button>
      <div class="slider-chip">高 <input type="range" data-param="h" min="0.9" max="3" step="0.05" value="1.9"><span class="v">1.90</span></div>
      <div class="slider-chip">底面边长 <input type="range" data-param="a" min="1" max="2.3" step="0.05" value="1.7"><span class="v">1.70</span></div>
      <div class="slider-chip">拆解 <input type="range" data-param="explode" min="0" max="1" step="0.01" value="0"><span class="v">0.00</span></div>
      <div class="viz-card hide" id="p2-note"></div>`,
    camera: { zoom: 1.02, pitch: 0.3, yaw: -0.62, offset: [0, 1.0, 0] },

    scene(t, ctx) {
      const st = ctx.studio, p = ctx.params;
      const items = [];
      const a = p.a, h = p.h, R = a / Math.SQRT2, ap = a / 2; // 外接圆半径、边心距
      const base = sqVerts(a);
      const O = [0, 0, 0], A = base[0], B = base[1], C = base[2], D = base[3];
      const M = [(B[0] + C[0]) / 2, 0, (B[2] + C[2]) / 2];
      const P = [0, h, 0];
      const skin = G.tint(st, 0.03);

      if (p.mode === 'prism') {
        /* ---------- 正四棱柱：四侧面可拆解 ---------- */
        const ex = p.explode || 0;
        const T = [A, B, C, D].map(v => [v[0], h, v[2]]);
        // 底面
        items.push(E.face([D, C, B, A], { color: G.tint(st, 0.06), key: 'elem:base', edgeColor: G.ink(st), sw: 1.5 }));
        // 四侧面（外移拆解）
        for (let i = 0; i < 4; i++) {
          const j = (i + 1) % 4;
          const cen = [(base[i][0] + base[j][0]) / 2, 0, (base[i][2] + base[j][2]) / 2];
          const nrm = [cen[0] / (Math.hypot(cen[0], cen[2]) || 1), 0, cen[2] / (Math.hypot(cen[0], cen[2]) || 1)];
          const off = ex * 0.85;
          const sx = nrm[0] * off, sz = nrm[2] * off;
          const q = [base[i], base[j], T[j], T[i]].map(v => [v[0] + sx, v[1] + ex * 0.12, v[2] + sz]);
          items.push(E.face(q, {
            color: G.tint(st, 0.02 + i * 0.025), key: 'elem:side' + i,
            edgeColor: G.ink(st), sw: 1.5, alpha: 1, layer: ex > 0.02 ? 'top' : 'normal',
            tip: '侧面是全等的矩形',
          }));
        }
        // 顶面
        const tq = T.map(v => [v[0], v[1] + ex * 0.95, v[2]]);
        items.push(E.face(tq, { color: G.tint(st, 0.0), key: 'elem:top', edgeColor: G.ink(st), sw: 1.5, layer: 'top' }));
        // 侧棱（虚线在拆解时）
        for (let i = 0; i < 4; i++) {
          items.push(E.line([base[i][0], base[i][1], base[i][2]], ex > 0.02 ? [base[i][0], h + ex * 0.7, base[i][2]] : T[i], {
            color: G.ink(st), sw: 1.2, alpha: ex > 0.02 ? 0.45 : 1, dash: ex > 0.02 ? [5, 4] : null, key: 'elem:sideEdge',
          }));
        }
        // 元素标注
        items.push(E.point(O, { key: 'elem:O', r: 3 }), E.label(O, 'O', { dx: -10, dy: 10, key: 'elem:O' }));
        const vlist = [];
        for (let i = 0; i < 4; i++) {
          items.push(E.point(base[i], { key: 'elem:' + LAB[i], r: 3 }));
          vlist.push({ p: base[i], text: LAB[i], key: 'elem:' + LAB[i] });
          items.push(E.point(T[i], { key: 'elem:' + LAB[i] + '₁', r: 3 }));
          vlist.push({ p: tq[i], text: LAB[i] + '₁', key: 'elem:' + LAB[i] + '₁' });
        }
        G.autoLabels(st, vlist);
        vlist.forEach(v => items.push(E.label(v.p, v.text, { dx: v.dx, dy: v.dy, key: v.key })));
        // 高（上下底面之间的距离）
        items.push(E.line([-R - 0.55, 0, 0], [-R - 0.55, h, 0], { color: G.accent(st), sw: 1.7, key: 'elem:h', dash: [6, 4] }));
        items.push(E.label([-R - 0.55, h / 2, 0], `h = ${h.toFixed(2)}`, { color: G.accent(st), dx: -26, dy: 0, key: 'elem:h', size: 12 }));
        // 底面边长 a
        items.push(E.label([(A[0] + B[0]) / 2, 0, (A[2] + B[2]) / 2], `a = ${a.toFixed(2)}`, {
          color: G.accent(st), dx: 22, dy: 16, key: 'elem:a', size: 12,
        }));
        return { items };
      }

      /* ---------- 正四棱锥 ---------- */
      const ex = p.explode || 0;
      const apex = [0, h + ex * 0.55, 0];
      // 侧面
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        items.push(E.face([base[i], base[j], apex], {
          color: G.tint(st, 0.02 + i * 0.022), key: 'elem:side' + i,
          edgeColor: G.ink(st), sw: 1.4, tip: '侧面是等腰三角形',
        }));
      }
      items.push(E.face([D, C, B, A], { color: G.tint(st, 0.07), key: 'elem:base', edgeColor: G.ink(st), sw: 1.5 }));
      // 顶点
      const vl = [];
      for (let i = 0; i < 4; i++) {
        items.push(E.point(base[i], { r: 3, key: 'elem:' + LAB[i] }));
        vl.push({ p: base[i], text: LAB[i], key: 'elem:' + LAB[i] });
      }
      items.push(E.point(apex, { r: 3, key: 'elem:P' }));
      vl.push({ p: apex, text: 'P', key: 'elem:P' });
      G.autoLabels(st, vl, { dist: 17 });
      vl.forEach(v => items.push(E.label(v.p, v.text, { dx: v.dx, dy: v.dy, key: v.key })));

      /* 六个元素：高 PO、斜高 PM、侧棱 PB、外接半径 OB、边心距 OM、半边长 MB */
      const tri = (pts, key, op) => E.face(pts, {
        color: G.accent(st), alpha0: 0.17, edgeColor: G.accent(st), sw: 1.4,
        key, layer: 'top', tip: op,
      });
      items.push(E.line(O, apex, { color: G.accent(st), sw: 1.8, dash: [6, 4], key: 'el:h' }));
      items.push(E.label([0, h * 0.46 + ex * 0.28, 0], 'h', { color: G.accent(st), dx: -14, dy: 0, size: 13, key: 'el:h', align: 'right' }));
      items.push(E.line(M, apex, { color: G.accent(st), sw: 1.8, key: 'el:hp' }));
      items.push(E.label([(M[0] + apex[0]) / 2, (M[1] + apex[1]) / 2, (M[2] + apex[2]) / 2],
        'h′', { color: G.accent(st), dx: 26, dy: -8, size: 13, key: 'el:hp', align: 'left' }));
      items.push(E.line(B, apex, { color: G.accent2 && G.accent(st), sw: 1.2, key: 'el:l', dash: null }));
      items.push(E.label([(B[0] + apex[0]) / 2, (B[1] + apex[1]) / 2, (B[2] + apex[2]) / 2],
        'l', { color: G.accent(st), dx: 40, dy: 16, size: 13, key: 'el:l', align: 'left' }));
      items.push(E.line(O, M, { color: G.ink(st), sw: 1.2, key: 'el:om' }));
      items.push(E.label([M[0] / 2, 0, M[2] / 2], 'r', { dx: 0, dy: 12, size: 12, key: 'el:om' }));
      items.push(E.line(O, B, { color: G.ink(st), sw: 1.1, dash: [4, 3], key: 'el:ob' }));
      items.push(E.label([B[0] / 2, 0.05, B[2] / 2], 'R', { dx: 4, dy: 12, size: 12, key: 'el:ob' }));
      items.push(E.line(O, A, { color: G.ink(st), sw: 1.1, dash: [4, 3], alpha: 0.5 }));
      items.push(E.point(O, { r: 3, key: 'el:PO' }));
      items.push(E.label(O, 'O', { dx: -11, dy: 9, key: 'el:PO' }));
      items.push(E.point(M, { r: 3, key: 'el:PM' }));
      items.push(E.label(M, 'M', { dx: 12, dy: 8, key: 'el:PM' }));
      items.push(G.rightAngle(apex, O, B, 0.16, { color: G.accent(st), key: 'el:h' }));
      items.push(G.rightAngle(O, M, B, 0.13, { color: G.ink(st), key: 'el:om' }));
      // 四个直角三角形（拆解时更清晰）
      if (ctx.params.tri !== false) {
        items.push(tri([apex, O, M], 'tri:pom', 'Rt△POM：h² + r² = h′²'));
        items.push(tri([apex, O, B], 'tri:pob', 'Rt△POB：h² + R² = l²'));
        items.push(tri([apex, M, C], 'tri:pmc', 'Rt△PMC：h′² + (a/2)² = l²'));
        items.push(tri([O, M, B], 'tri:omb', 'Rt△OMB：r² + (a/2)² = R²'));
      }
      return { items };
    },

    onViz(act, el, ctx) {
      if (act === 'mode-pyramid' || act === 'mode-prism') {
        const mode = act === 'mode-prism' ? 'prism' : 'pyramid';
        ctx.params.mode = mode;
        ctx.root.querySelectorAll('[data-viz^="mode-"]').forEach(b => {
          b.classList.toggle('on', b.getAttribute('data-viz') === act);
        });
        ctx.studio.focusOn([]);
        ctx.studio.dirty = true;
        const n = ctx.root.querySelector('#p2-note');
        if (n) {
          n.innerHTML = mode === 'prism'
            ? '<b>正四棱柱</b><br>侧棱 ⊥ 底面，底面为正方形。拖动“拆解”可把四个侧面分离，看到棱柱由两个全等底面 + 四个全等矩形侧面围成。'
            : '<b>正四棱锥</b><br>底面正方形，顶点 P 在底面的射影是中心 O。高 h=PO，斜高 h′=PM，侧棱 l=PB。';
          n.classList.remove('hide');
        }
      }
    },

    init(ctx) {
      const n = ctx.root.querySelector('#p2-note');
      if (n) {
        n.innerHTML = '<b>正四棱锥</b><br>底面正方形，顶点 P 在底面的射影是中心 O。高 h = PO，斜高 h′ = PM（M 为 BC 中点），侧棱 l = PB。';
        n.classList.remove('hide');
        n.addEventListener('click', () => n.classList.add('hide'));
      }
      const host = ctx.root.querySelector('#p2-steps');
      if (!host) return;
      window.UI.mountSteps(host, [
        { t: '正棱锥中，高 PO ⊥ 底面，所以 PO ⊥ OM、PO ⊥ OB，得到两个直角三角形 <b>Rt△POM</b> 与 <b>Rt△POB</b>。', why: '线面垂直的定义', keys: ['tri:pom', 'tri:pob', 'el:h'] },
        { t: 'M 是 BC 的中点，等腰△PBC 中 PM ⊥ BC，故 <b>Rt△PMC</b> 中 PM² + MC² = PC²。', why: '等腰三角形“三线合一”', keys: ['tri:pmc', 'el:hp'] },
        { t: '底面正方形中 OM ⊥ BC，且 OM = MB = a/2，<b>Rt△OMB</b> 中 r² + (a/2)² = R²。', why: '正方形的性质', keys: ['tri:omb', 'el:om', 'el:ob'] },
        { t: '于是六个元素两两构成四个直角三角形：h² + r² = h′²，h² + R² = l²，h′² + (a/2)² = l²，R = √2·r。', why: '勾股定理；正棱锥元素关系', keys: ['tri:pom', 'tri:pob', 'tri:pmc', 'tri:omb'] },
        { t: '本题取 a = 1.7，h = 1.9：r = 0.85，h′ = √(1.9² + 0.85²) ≈ 2.08，l = √(1.9² + R²) ≈ 2.37（R = a/√2 ≈ 1.20）。', why: '代入计算', keys: ['el:hp', 'el:l'] },
      ], ctx);
    },

    tip: `正棱锥的六个元素——高 <b>h</b>、斜高 <b>h′</b>、侧棱 <b>l</b>、底面外接圆半径 <b>R</b>、边心距 <b>r</b>、半边长 <b>a/2</b>——恰好组成四个直角三角形，这是计算棱锥问题的“万能钥匙”。`,
    tipMore: `记忆口诀：<b>高、斜高、边心距一组；高、侧棱、外接半径一组；斜高、半边长、侧棱一组；边心距、半边长、外接半径一组。</b>拖动“高”滑块，观察 h′ 与 l 同步变化。`,

    tabs: {
      knowledge: `
        <h2 class="sec">棱柱 · 棱锥 · 棱台 <span class="tag">结构深化</span></h2>
        <p class="lead">三个几何体的区别，本质上是“上底面”的变化：<b>两个全等底面</b>是棱柱，<b>缩成一个点</b>是棱锥，<b>缩成一个相似小底面</b>是棱台。</p>
        <div class="theo">
          <div class="theo-t">正棱柱</div>
          <p>侧棱垂直于底面，且底面是正多边形的棱柱。两个条件缺一不可：斜棱柱即使底面是正多边形，也不是正棱柱。</p>
        </div>
        <div class="theo">
          <div class="theo-t">正棱锥</div>
          <p>底面是正多边形，并且顶点与底面中心的连线垂直于底面的棱锥。其性质：各侧棱相等，各侧面是全等的等腰三角形，各等腰三角形底边上的高（<b>斜高</b>）相等。</p>
        </div>
        <table class="tb">
          <thead><tr><th>几何体</th><th>底面</th><th>侧面形状</th><th>侧棱</th></tr></thead>
          <tbody>
            <tr><td>棱柱</td><td>两个全等多边形</td><td>平行四边形</td><td>平行且相等</td></tr>
            <tr><td>正棱柱</td><td>两个全等正多边形</td><td>全等矩形</td><td>相等且 ⊥ 底面</td></tr>
            <tr><td>棱锥</td><td>一个多边形</td><td>共顶点的三角形</td><td>交于顶点</td></tr>
            <tr><td>正棱锥</td><td>正多边形</td><td>全等等腰三角形</td><td>相等</td></tr>
            <tr><td>棱台</td><td>两个相似多边形</td><td>梯形</td><td>延长后交于一点</td></tr>
          </tbody>
        </table>
        <h3 class="sec-sub">正棱锥中的四个直角三角形</h3>
        <div class="formula-grid">
          <div class="fc"><div class="fc-t">Rt△POM</div><div class="fc-f">h² + r² = h′²</div></div>
          <div class="fc"><div class="fc-t">Rt△POB</div><div class="fc-f">h² + R² = l²</div></div>
          <div class="fc"><div class="fc-t">Rt△PMC</div><div class="fc-f">h′² + (a/2)² = l²</div></div>
          <div class="fc"><div class="fc-t">Rt△OMB</div><div class="fc-f">r² + (a/2)² = R²</div></div>
        </div>
        <div class="note"><b>为什么 M 处是直角？</b>　因为 △PBC 是等腰三角形，M 是底边 BC 的中点，所以 PM ⊥ BC；又 OM ⊥ BC（正方形对边中点连线），故 BC ⊥ 平面 POM，当然 BC ⊥ PM、BC ⊥ OM。</div>
        <div class="card soft">
          <div class="card-t">棱台的两条常用性质</div>
          <ul>
            <li>棱台的侧棱延长后必交于一点（交点是原棱锥的顶点）。</li>
            <li>棱台的上、下底面相似，侧棱、斜高、高与上、下底面的对应元素成比例。</li>
          </ul>
        </div>
      `,
      example: `
        <h2 class="sec">典型例题 <span class="tag">正棱锥</span></h2>
        <div class="card">
          <div class="example-head"><span class="no">例题</span><span class="src">教材 8.1 · 正棱锥元素计算（变式）</span></div>
          <p>已知正四棱锥 P-ABCD 的底面边长为 <span class="f">a = 4</span>，高 <span class="f">h = 3</span>，O 为底面中心，M 为 BC 的中点。</p>
          <p>(1) 求斜高 h′；(2) 求侧棱长 l；(3) 指出图中所有的直角三角形。</p>
        </div>
        <div id="p2-steps"></div>
        <div class="card soft" style="margin-top:12px">
          <div class="card-t">参考结论（a = 4，h = 3）</div>
          <p>R = 2√2，r = 2；斜高 <b>h′ = √(3² + 2²) = √13</b>；侧棱 <b>l = √(3² + (2√2)²) = √17</b>。</p>
          <p>四个直角三角形：Rt△POM（h²+r²=h′²）、Rt△POB（h²+R²=l²）、Rt△PMC（h′²+2²=l²）、Rt△OMB（r²+2²=R²）。</p>
        </div>
        <div class="note">左侧图中 <b>h、h′、l、R、r</b> 的数值会随滑块实时变化；把“高”拖成 3、底面边长拖成 4 后放大 2 倍观察，可直接与本题对照。</div>

        <h3 class="sec-sub">回头看：为什么正棱柱要求“侧棱垂直于底面”</h3>
        <div class="card soft">
          <p>若只有“底面是正多边形”，斜棱柱的侧棱不垂直于底面，高小于侧棱长，体积公式 <span class="f">V = Sh</span> 中的 h 就不再等于侧棱长。教材因此把“侧棱 ⊥ 底面”写进正棱柱定义。</p>
        </div>
      `,
      practice: `
        <h2 class="sec">练习 <span class="tag">辨析与计算</span></h2>
        <div class="q">
          <div class="q-head"><span class="qn">1</span><span>判断下列命题是否正确（点击选项查看判定）。</span></div>
          <div class="opts">
            <button class="opt" data-ok="0"><span class="mk">①</span>底面是正多边形的棱柱是正棱柱。</button>
            <button class="opt" data-ok="1"><span class="mk">②</span>正棱锥的各侧棱相等，各侧面是全等的等腰三角形。</button>
            <button class="opt" data-ok="0"><span class="mk">③</span>各侧面都是全等等腰三角形的棱锥是正棱锥。</button>
            <button class="opt" data-ok="0"><span class="mk">④</span>棱台的侧棱一定相等。</button>
          </div>
          <button class="ans-btn" data-reveal>显示答案与错因</button>
          <div class="ans">
            <div class="a-line"><b>答案</b>　① ×　② √　③ ×　④ ×</div>
            <div class="sol-step" data-n="1">① 错。还缺少“侧棱垂直于底面”。斜棱柱的底面可以是正多边形，但它不是正棱柱。</div>
            <div class="sol-step" data-n="2">② 对。由正棱锥的定义与对称性，侧棱都等于 √(h²+R²)，斜高都等于 √(h²+r²)。</div>
            <div class="sol-step" data-n="3">错。反例：把正四棱锥的顶点沿平行底面的方向平移，侧面仍可保持全等等腰三角形，但顶点射影不在底面中心。</div>
            <div class="sol-step" data-n="4">错。只有<b>正棱台</b>的侧棱才相等；一般棱台的侧棱长可以互不相等。</div>
          </div>
        </div>
        <div class="q">
          <div class="q-head"><span class="qn">2</span><span>正六棱锥的底面边长为 2，侧棱长为 √13，求它的高与斜高。</span></div>
          <button class="ans-btn" data-reveal>显示答案与步骤</button>
          <div class="ans">
            <div class="a-line"><b>答案</b>　高 h = 3，斜高 h′ = 2√3。</div>
            <div class="sol-step" data-n="1">正六边形外接圆半径 R = 边长 = 2，边心距 r = (√3/2)×2 = √3。</div>
            <div class="sol-step" data-n="2">由 h² + R² = l² 得 h² = 13 − 4 = 9，h = 3。</div>
            <div class="sol-step" data-n="3">由 h² + r² = h′² 得 h′² = 9 + 3 = 12，h′ = 2√3。</div>
          </div>
        </div>
        <div class="q">
          <div class="q-head"><span class="qn">3</span><span>（教材习题 8.1 第 3 题）棱台的两底面面积分别为 S′、S，高为 h，写出棱台体积公式并说明它与棱柱、棱锥的关系。</span></div>
          <button class="ans-btn" data-reveal>显示答案</button>
          <div class="ans">
            <div class="a-line"><b>答案</b>　<span class="f">V = <span class="frac"><span class="num">1</span><span class="den">3</span></span>h(S′ + √(S′S) + S)</span></div>
            <div class="sol-step" data-n="1">当 S′ = S 时，V = Sh，退化为棱柱的体积公式。</div>
            <div class="sol-step" data-n="2">当 S′ = 0 时，V = (1/3)Sh，退化为棱锥的体积公式。</div>
            <div class="sol-step" data-n="3">这说明台体公式是柱体与锥体公式的“统一形式”，教材用两个棱锥体积之差给出了推导。</div>
          </div>
        </div>
      `,
    },
  });
})();
