/* =============================================================
   第 3 页 · 圆柱、圆锥、圆台、球（旋转体的生成）
   知识点：8.1.4 圆柱 / 8.1.5 圆锥 / 8.1.6 圆台 / 8.1.7 球
   交互：矩形 / 直角三角形 / 直角梯形 / 半圆 绕轴旋转动画（可暂停）
        透视：轴截面、平行于底面的截面
   ============================================================= */
(function () {
  'use strict';
  const E = window.Ink3D, G = window.Geo;

  const MODES = {
    cylinder: { name: '圆柱', r: 1.0, h: 2.3, gen: '矩形绕一边旋转' },
    cone: { name: '圆锥', r: 1.15, h: 2.3, gen: '直角三角形绕直角边旋转' },
    frustum: { name: '圆台', r: 1.1, r2: 0.55, h: 2.1, gen: '直角梯形绕直角腰旋转' },
    sphere: { name: '球', r: 1.2, gen: '半圆绕直径旋转' },
  };

  window.PAGES.push({
    id: 'p3',
    short: '圆柱·圆锥·圆台·球',
    title: '圆柱 · 圆锥 · 圆台 · 球',
    running: '8.1 旋转体',
    chapter: '8.1',
    defaults: { mode: 'cylinder', spin: 1, phase: 0.56 },
    vizTools: `
      <button class="chip on" data-viz="m-cylinder">圆柱</button>
      <button class="chip" data-viz="m-cone">圆锥</button>
      <button class="chip" data-viz="m-frustum">圆台</button>
      <button class="chip" data-viz="m-sphere">球</button>
      <button class="chip" data-viz="pause">暂停旋转</button>
      <div class="viz-card hide" id="p3-note"></div>`,
    camera: { zoom: 0.98, pitch: 0.26, yaw: -0.55, offset: [0, 1.15, 0] },

    init(ctx) {
      ctx.studio._anim = true;
      const note = ctx.root.querySelector('#p3-note');
      const texts = {
        cylinder: '<b>圆柱</b><br>矩形绕一边所在直线旋转一周。轴 ⊥ 底面，母线 ∥ 轴且都相等；轴截面是矩形，平行于底面的截面是与底面全等的圆。',
        cone: '<b>圆锥</b><br>直角三角形绕一条直角边旋转一周。斜边为母线，母线交于顶点；轴截面是等腰三角形，平行于底面的截面是与底面相似的圆。',
        frustum: '<b>圆台</b><br>直角梯形绕垂直于底边的腰旋转一周（或用平行于底面的平面截圆锥）。母线延长后交于一点，轴截面是等腰梯形。',
        sphere: '<b>球</b><br>半圆绕直径旋转一周。任一平面截球所得截面都是圆；过球心的截面圆最大，叫大圆（半径 R）。',
      };
      const show = m => { if (note) { note.innerHTML = texts[m]; note.classList.remove('hide'); } };
      ctx.showInfo = show;
      show('cylinder');
      note.addEventListener('click', () => note.classList.add('hide'));
      ctx.studio.onPick = (key) => {
        if (!key) return;
        if (key.indexOf('gen') >= 0 || key.indexOf('r:') === 0) show(ctx.params.mode);
      };
      const host = ctx.root.querySelector('#p3-steps');
      if (host) window.UI.mountSteps(host, [
        { t: '矩形 ABCD 绕边 AB 所在直线旋转一周，边 CD 扫过的曲面就是圆柱的<b>侧面</b>，CD 叫母线。', why: '圆柱的定义（旋转体）', keys: ['r:gen', 'r:axis'] },
        { t: 'AD、BC 扫过两个圆面，分别是下、上底面，它们平行且全等。', why: '圆柱的结构特征', keys: ['r:capBottom', 'r:capTop'] },
        { t: '用垂直于轴的平面去截，截面是与底面全等的圆；用<b>过轴</b>的平面去截，截面是矩形（轴截面）。', why: '圆柱的截面性质', keys: ['r:cutP', 'r:cutA'] },
        { t: '若底面半径 r、母线长 l，则侧面积 2πrl，全面积 2πr(r+l)，体积 πr²h（这里 l = h）。', why: '8.3 圆柱的表面积与体积', keys: ['r:gen'] },
      ], ctx);
    },

    onViz(act, el, ctx) {
      if (act.indexOf('m-') === 0) {
        ctx.params.mode = act.slice(2);
        ctx.root.querySelectorAll('[data-viz^="m-"]').forEach(b => b.classList.toggle('on', b === el));
        if (ctx.showInfo) ctx.showInfo(ctx.params.mode);
        ctx.studio.dirty = true;
      }
      if (act === 'pause') {
        ctx.params.spin = ctx.params.spin ? 0 : 1;
        el.classList.toggle('on', !ctx.params.spin);
        el.textContent = ctx.params.spin ? '暂停旋转' : '继续旋转';
        ctx.studio.dirty = true;
      }
    },

    scene(t, ctx) {
      const st = ctx.studio, p = ctx.params;
      const m = p.mode;
      const cfg = MODES[m];
      const items = [];
      const th = p.spin ? p.phase + t * 1.25 : p.phase;
      const alpha = st.seeThrough ? 0.34 : 1;

      const axisTop = m === 'sphere' ? cfg.r * 1.45 : cfg.h + 0.42;
      // 旋转轴
      items.push(E.line([0, -0.42, 0], [0, axisTop, 0], { color: G.ink(st), sw: 1.1, dash: [7, 5], alpha: 0.75, key: 'r:axis' }));
      items.push(E.label([0, axisTop + 0.18, 0], '轴', { dx: 0, dy: -10, size: 12, color: G.ink(st), key: 'r:axis' }));

      if (m === 'sphere') {
        const R = cfg.r;
        items.push(G.sphere({ c: [0, R, 0], r: R, key: 'r:ball', color: G.tint(st, 0.08), alpha }));
        // 半圆（母线）在角度 th 处
        const u = [Math.cos(th), 0, Math.sin(th)];
        const pts = [];
        for (let i = 0; i <= 48; i++) {
          const a = Math.PI * i / 48;
          pts.push([R * Math.sin(a) * u[0], R - R * Math.cos(a), R * Math.sin(a) * u[2]]);
        }
        items.push(E.face(pts, { color: G.accent(st), alpha0: 0.28, edgeColor: G.accent(st), sw: 1.9, layer: 'top', key: 'r:gen', tip: '半圆绕直径旋转生成球面', hatch: true }));
        items.push(E.label(pts[24], '半圆', { dx: 18, dy: -8, size: 11.5, color: G.accent(st), key: 'r:gen' }));
        items.push(E.point([0, R, 0], { r: 3, key: 'r:O' }), E.label([0, R, 0], 'O', { dx: -12, dy: 8, key: 'r:O' }));
        items.push(G.seg([0, R, 0], [R * u[0], R, R * u[2]], { color: G.accent(st), sw: 1.5, key: 'r:rad' }));
        items.push(E.label([R * u[0] * 0.6, R, R * u[2] * 0.6], 'R', { dx: 6, dy: -10, size: 12, color: G.accent(st), key: 'r:rad' }));
        if (st.seeThrough) {
          const d = R * 0.45, rr = Math.sqrt(R * R - d * d);
          const cy = R + d;
          items.push(G.circle3([0, cy, 0], [1, 0, 0], [0, 0, 1], rr, { color: G.accent(st), sw: 1.8, alpha: 0.95, key: 'r:cutP' }));
          items.push(G.planeQuad([0, cy, 0], [1, 0, 0], [0, 0, 1], rr + 0.1, rr + 0.1, {
            color: G.accent(st), alpha: 0.13, edgeColor: G.accent(st), sw: 1, dash: [4, 4], key: 'r:cutP2',
          }));
          items.push(G.circle3([0, R, 0], [1, 0, 0], [0, 0, 1], R, { color: G.ink(st), sw: 1.3, alpha: 0.8, key: 'r:cutA' }));
          items.push(E.label([0, cy + rr + 0.05, 0], '小圆截面', { dx: 34, dy: -6, size: 11, color: G.accent(st), key: 'r:cutP' }));
        }
        return { items, fit: 0.98 };
      }

      /* 旋转体本体 */
      if (m === 'cylinder') items.push(G.cylinder({ st, r: cfg.r, h: cfg.h, y0: 0, key: 'r:body', seg: 64, alpha, rings: [[cfg.r, 0], [cfg.r, cfg.h]] }));
      if (m === 'cone') items.push(G.cone({ st, r: cfg.r, h: cfg.h, y0: 0, key: 'r:body', seg: 64, alpha, rings: [[cfg.r, 0]] }));
      if (m === 'frustum') items.push(G.roundFrustum({ st, r1: cfg.r, r2: cfg.r2, h: cfg.h, y0: 0, key: 'r:body', seg: 64, alpha, rings: [[cfg.r, 0], [cfg.r2, cfg.h]] }));

      /* 旋转的母面 */
      const u = [Math.cos(th), 0, Math.sin(th)];
      let prof;
      if (m === 'cylinder') prof = [[0, 0], [cfg.r, 0], [cfg.r, cfg.h], [0, cfg.h]];
      if (m === 'cone') prof = [[0, 0], [cfg.r, 0], [0, cfg.h]];
      if (m === 'frustum') prof = [[0, 0], [cfg.r, 0], [cfg.r2, cfg.h], [0, cfg.h]];
      const genPts = prof.map(([r, y]) => [r * u[0], y, r * u[2]]);
      items.push(E.face(genPts, {
        color: G.accent(st), alpha0: 0.3, edgeColor: G.accent(st), sw: 2.1, hatch: true,
        layer: 'top', key: 'r:gen', tip: '平面图形绕轴旋转一周，扫过整个旋转体',
      }));
      // 母线标签
      const mid = genPts[genPts.length - 2] || genPts[1];
      items.push(E.label(mid, '母线 l', { dx: 30, dy: 4, size: 11.5, color: G.accent(st), key: 'r:gen', align: 'left' }));
      // 底面半径
      items.push(G.seg([0, 0, 0], [cfg.r * u[0], 0, cfg.r * u[2]], { color: G.ink(st), sw: 1.2, key: 'r:rad' }));
      items.push(E.label([cfg.r * u[0] * 0.62, 0, cfg.r * u[2] * 0.62], 'r', { dx: 2, dy: 12, size: 12, key: 'r:rad' }));
      items.push(G.dot3([0, 0, 0], { key: 'r:O' }), E.label([0, 0, 0], 'O', { dx: -12, dy: 10, key: 'r:O' }));
      // 高
      items.push(E.line([0, 0, 0], [0, cfg.h, 0], { color: G.accent(st), sw: 1.6, key: 'r:h', dash: null }));
      items.push(E.label([0, cfg.h * 0.55, 0], 'h', { dx: -12, dy: 0, size: 12, color: G.accent(st), key: 'r:h' }));

      /* 透视：轴截面 */
      if (st.seeThrough) {
        const c = G.camXZ(st);
        const v = [Math.cos(st.yaw + Math.PI / 2), 0, Math.sin(st.yaw + Math.PI / 2)];
        let quad;
        if (m === 'cylinder') quad = [[cfg.r * v[0], 0, cfg.r * v[2]], [-cfg.r * v[0], 0, -cfg.r * v[2]], [-cfg.r * v[0], cfg.h, -cfg.r * v[2]], [cfg.r * v[0], cfg.h, cfg.r * v[2]]];
        if (m === 'cone') quad = [[cfg.r * v[0], 0, cfg.r * v[2]], [-cfg.r * v[0], 0, -cfg.r * v[2]], [0, cfg.h, 0]];
        if (m === 'frustum') quad = [[cfg.r * v[0], 0, cfg.r * v[2]], [-cfg.r * v[0], 0, -cfg.r * v[2]], [-cfg.r2 * v[0], cfg.h, -cfg.r2 * v[2]], [cfg.r2 * v[0], cfg.h, cfg.r2 * v[2]]];
        items.push(E.face(quad, { color: G.accent(st), alpha0: 0.22, edgeColor: G.accent(st), sw: 2, layer: 'top', key: 'r:cutA', tip: '轴截面：过轴的平面截旋转体所得的平面图形' }));
        // 平行底面的截面
        const yy = cfg.h * 0.55;
        let rr = cfg.r;
        if (m === 'cone') rr = cfg.r * (1 - 0.55);
        if (m === 'frustum') rr = cfg.r + (cfg.r2 - cfg.r) * 0.55;
        items.push(G.circle3([0, yy, 0], [1, 0, 0], [0, 0, 1], rr, { color: G.accent(st), sw: 1.8, key: 'r:cutP' }));
        items.push(G.planeQuad([0, yy, 0], [1, 0, 0], [0, 0, 1], rr + 0.08, rr + 0.08, {
          color: G.accent(st), alpha: 0.12, edgeColor: G.accent(st), sw: 1, dash: [4, 4], key: 'r:cutP2',
        }));
        items.push(E.label([0, yy + 0.02, rr + 0.06], '平行底面的截面是圆', { dx: 40, dy: -4, size: 10.5, color: G.accent(st), key: 'r:cutP' }));
      }
      return { items, fit: 0.98 };
    },

    tip: `旋转体的三个关键词：<b>轴</b>（旋转所绕的直线）、<b>母线</b>（旋转成侧面的那条线）、<b>底面</b>（垂直于轴的边旋转成的圆面）。圆柱母线 ∥ 轴，圆锥母线交于顶点，圆台母线延长后交于一点。`,
    tipMore: `点击“暂停旋转”可定格母面的位置。打开右上角“透视”，会同时显示<b>轴截面</b>和<b>平行于底面的截面</b>：前者是矩形 / 等腰三角形 / 等腰梯形，后者都是圆。`,

    tabs: {
      knowledge: `
        <h2 class="sec">旋转体的生成 <span class="tag">8.1.4—8.1.7</span></h2>
        <p class="lead">旋转体都是“平面图形绕一条直线旋转一周”形成的。抓住<b>旋转轴</b>与<b>母线</b>，四种旋转体的结构就一目了然。</p>
        <table class="tb">
          <thead><tr><th>名称</th><th>生成的平面图形</th><th>母线</th><th>轴截面</th></tr></thead>
          <tbody>
            <tr><td>圆柱</td><td>矩形绕一边</td><td>∥ 轴，都相等</td><td>矩形</td></tr>
            <tr><td>圆锥</td><td>直角三角形绕直角边</td><td>交于顶点</td><td>等腰三角形</td></tr>
            <tr><td>圆台</td><td>直角梯形绕直角腰</td><td>延长后交于一点</td><td>等腰梯形</td></tr>
            <tr><td>球</td><td>半圆绕直径</td><td>—（半圆弧）</td><td>大圆</td></tr>
          </tbody>
        </table>
        <div class="theo">
          <div class="theo-t">球的截面性质（教材 8.1.7）</div>
          <p>用平面 α 截球 O，若球心到平面的距离为 d，截面圆半径为 r，球半径为 R，则</p>
          <p class="fml"><span class="box">r = √(R² − d²)</span></p>
          <p>当 d = 0 时截面过球心，r = R，此时截面圆叫<b>大圆</b>，是最大的截面圆。</p>
        </div>
        <div class="note"><b>易错</b>　“球的直径”是线段，“球面”是曲面，“球”是球面围成的几何体。教材中“球 O”指球心为 O 的球。</div>
        <h3 class="sec-sub">圆柱、圆锥、圆台的展开图（8.3 预习）</h3>
        <div class="formula-grid">
          <div class="fc"><div class="fc-t">圆柱侧面展开</div><div class="fc-f">矩形，长 2πr，宽 l</div></div>
          <div class="fc"><div class="fc-t">圆锥侧面展开</div><div class="fc-f">扇形，半径 l，弧长 2πr</div></div>
          <div class="fc"><div class="fc-t">圆台侧面展开</div><div class="fc-f">扇环</div></div>
          <div class="fc"><div class="fc-t">球面</div><div class="fc-f">不可展平；S = 4πR²</div></div>
        </div>
      `,
      example: `
        <h2 class="sec">典型例题 <span class="tag">球的截面</span></h2>
        <div class="card">
          <div class="example-head"><span class="no">例题</span><span class="src">教材 8.1 球截面 · 变式</span></div>
          <p>已知球 O 的半径为 10，平面 α 截球所得截面圆的半径为 6。求球心 O 到平面 α 的距离 d，并说明截面圆与球心位置关系。</p>
        </div>
        <div id="p3-steps"></div>
        <div class="note">把左侧切到 <b>球</b> 并打开“透视”，可以看见截面圆、球心 O 与半径 R 构成的直角三角形。</div>

        <h3 class="sec-sub">对比：三种旋转体的“轴截面”</h3>
        <div class="card soft">
          <p>圆柱的轴截面是矩形（长 2r、宽 h）；圆锥的轴截面是等腰三角形（底 2r、高 h、腰 l）；圆台的轴截面是等腰梯形（上底 2r′、下底 2r、高 h）。这三者正是“柱—锥—台”在平面上的投影。</p>
        </div>
      `,
      practice: `
        <h2 class="sec">练习 <span class="tag">母线 · 轴截面</span></h2>
        <div class="q">
          <div class="q-head"><span class="qn">1</span><span>圆锥的底面半径为 3，高为 4，求母线长与轴截面面积。</span></div>
          <button class="ans-btn" data-reveal>显示答案与步骤</button>
          <div class="ans">
            <div class="a-line"><b>答案</b>　母线 l = 5，轴截面面积 S = 12。</div>
            <div class="sol-step" data-n="1">母线 l = √(r² + h²) = √(3² + 4²) = 5。</div>
            <div class="sol-step" data-n="2">轴截面是等腰三角形，底为直径 2r = 6，高为 h = 4。</div>
            <div class="sol-step" data-n="3">S = <span class="frac"><span class="num">1</span><span class="den">2</span></span> × 6 × 4 = 12。</div>
          </div>
        </div>
        <div class="q">
          <div class="q-head"><span class="qn">2</span><span>圆台的上、下底面半径分别为 2 和 6，高为 3，求母线长。</span></div>
          <button class="ans-btn" data-reveal>显示答案与步骤</button>
          <div class="ans">
            <div class="a-line"><b>答案</b>　l = 5。</div>
            <div class="sol-step" data-n="1">轴截面为等腰梯形，上底 4、下底 12、高 3。</div>
            <div class="sol-step" data-n="2">作高把梯形分成矩形与两个直角三角形，直角三角形的水平直角边为 (12 − 4)/2 = 4。</div>
            <div class="sol-step" data-n="3">母线 l = √(3² + 4²) = 5。</div>
          </div>
        </div>
        <div class="q">
          <div class="q-head"><span class="qn">3</span><span>（教材 8.3 练习变式）圆柱的底面半径为 1，母线长为 3，求它的轴截面面积与侧面积。</span></div>
          <button class="ans-btn" data-reveal>显示答案与步骤</button>
          <div class="ans">
            <div class="a-line"><b>答案</b>　轴截面面积 6，侧面积 6π。</div>
            <div class="sol-step" data-n="1">轴截面是矩形，长 2r = 2，宽 l = 3，面积 2 × 3 = 6。</div>
            <div class="sol-step" data-n="2">侧面展开是长 2πr = 2π、宽 l = 3 的矩形。</div>
            <div class="sol-step" data-n="3">侧面积 S<sub>侧</sub> = 2πrl = 2π × 1 × 3 = 6π。</div>
          </div>
        </div>
        <div class="q">
          <div class="q-head"><span class="qn">4</span><span>判断：球的任意两个大圆都相交于两点；球的任一截面都是圆。</span></div>
          <button class="ans-btn" data-reveal>显示答案</button>
          <div class="ans">
            <div class="a-line"><b>答案</b>　两句话都正确。</div>
            <div class="sol-step" data-n="1">大圆所在平面都过球心，任意两个过球心的平面必相交于过球心的一条直线。</div>
            <div class="sol-step" data-n="2">该直线与球面交于两点（直径的两个端点），故两个大圆交于两点。</div>
            <div class="sol-step" data-n="3">由 r = √(R² − d²) 知，任一平面截球所得都是圆（d = R 时退化为一个点）。</div>
          </div>
        </div>
      `,
    },
  });
})();
