/* =============================================================
   第 1 页 · 8.1 基本立体图形（多面体与旋转体）
   知识点编号：8.1.1 棱柱 / 8.1.2 棱锥 / 8.1.3 棱台 /
              8.1.4 圆柱 / 8.1.5 圆锥 / 8.1.6 圆台 / 8.1.7 球 / 8.1.8 简单组合体
   ============================================================= */
(function () {
  'use strict';
  const E = window.Ink3D, G = window.Geo;

  const INFO = {
    'sol:prism': {
      title: '棱柱（prism）',
      text: '有两个面互相平行，其余各面都是四边形，并且每相邻两个四边形的公共边都互相平行。两个互相平行的面叫底面，其余各面叫侧面，相邻侧面的公共边叫侧棱。侧棱垂直于底面时为<b>直棱柱</b>；底面是正多边形的直棱柱叫<b>正棱柱</b>。',
    },
    'sol:pyramid': {
      title: '棱锥（pyramid）',
      text: '有一个面是多边形，其余各面都是有一个公共顶点的三角形。多边形面叫底面，有公共顶点的三角形面叫侧面，相邻侧面的公共边叫侧棱，各侧面的公共顶点叫顶点。底面是正多边形，且顶点与底面中心的连线垂直于底面，叫<b>正棱锥</b>。',
    },
    'sol:frustum': {
      title: '棱台（frustum of a pyramid）',
      text: '用一个平行于棱锥底面的平面去截棱锥，底面与截面之间的部分叫棱台。原棱锥的底面和截面分别叫下底面、上底面；侧棱延长后必交于一点。',
    },
    'sol:cylinder': {
      title: '圆柱（circular cylinder）',
      text: '矩形绕它的一条边所在直线旋转一周形成的旋转体。旋转轴叫轴，垂直于轴的边旋转而成的圆面叫底面，平行于轴的边旋转而成的曲面叫侧面，这条边无论转到什么位置都叫<b>母线</b>。',
    },
    'sol:cone': {
      title: '圆锥（circular cone）',
      text: '直角三角形绕它的一条直角边所在直线旋转一周形成的旋转体。斜边旋转形成的曲面叫侧面，斜边叫母线，母线的公共点是顶点。轴截面是等腰三角形。',
    },
    'sol:roundFrustum': {
      title: '圆台（frustum of a cone）',
      text: '用平行于圆锥底面的平面去截圆锥，底面与截面之间的部分叫圆台。也可看作直角梯形绕垂直于底边的腰旋转一周而成。母线延长后交于一点，轴截面是等腰梯形。',
    },
    'sol:sphere': {
      title: '球（sphere）',
      text: '半圆以它的直径所在直线为旋转轴，旋转一周形成的曲面叫球面，球面所围成的旋转体叫球。半圆的圆心叫球心，连接球心与球面上任意一点的线段叫半径。用平面截球，截面总是<b>圆</b>；过球心的截面圆叫大圆。',
    },
  };

  const SOLIDS = [
    { k: 'prism', name: '棱柱', x: -2.34, y: 1.52, r: 0.46, h: 1.02, kind: 'prism', n: 6 },
    { k: 'pyramid', name: '棱锥', x: -0.78, y: 1.52, r: 0.5, h: 1.02, kind: 'pyramid', n: 4 },
    { k: 'frustum', name: '棱台', x: 0.78, y: 1.52, r: 0.54, rTop: 0.28, h: 1.02, kind: 'frustum', n: 4 },
    { k: 'sphere', name: '球', x: 2.3, y: 1.52, r: 0.52 },
    { k: 'cylinder', name: '圆柱', x: -1.56, y: -0.28, r: 0.46, h: 0.96 },
    { k: 'cone', name: '圆锥', x: 0, y: -0.28, r: 0.52, h: 0.96 },
    { k: 'roundFrustum', name: '圆台', x: 1.56, y: -0.28, r1: 0.52, r2: 0.3, h: 0.96 },
  ];

  window.PAGES.push({
    id: 'p1',
    short: '8.1 基本立体图形',
    title: '8.1 基本立体图形',
    running: '8.1 基本立体图形',
    chapter: '8.1',
    defaults: { cut: false },
    vizTools: `
      <button class="chip" data-viz="cut">平行底面截面</button>
      <button class="chip ghost" data-viz="focus-round">只看旋转体</button>
      <button class="chip ghost" data-viz="focus-poly">只看多面体</button>
      <div class="viz-card hide" id="p1-note"></div>`,
    camera: { zoom: 1.18, pitch: 0.28, yaw: -0.5, offset: [0, 1.25, 0] },

    scene(t, ctx) {
      const st = ctx.studio, p = ctx.params;
      const items = [];
      const cutOn = p.cut || st.seeThrough;
      for (const s of SOLIDS) {
        const key = 'sol:' + s.k;
        const local = [];
        if (s.k === 'sphere') {
          local.push(G.sphere({ c: [0, s.r, 0], r: s.r, key, color: G.tint(st, 0.08) }));
          items.push(G.shift(local, [s.x, s.y, 0]));
          if (cutOn) {
            // 球的截面：距球心 d 处的小圆
            const d = s.r * 0.42, rr = Math.sqrt(s.r * s.r - d * d);
            const cc = [s.x, s.y + s.r + d, 0];
            items.push(G.planeQuad(cc, [1, 0, 0], [0, 0, 1], rr + 0.12, rr + 0.12, {
              color: G.accent(st), alpha: 0.14, edgeColor: G.accent(st), dash: [4, 4], sw: 1.2, key: key + ':plane',
            }));
            items.push(G.circle3(cc, [1, 0, 0], [0, 0, 1], rr, {
              color: G.accent(st), sw: 2, alpha: 0.95, key: key + ':circ',
            }));
            items.push(E.label([cc[0] + rr + 0.1, cc[1] + 0.05, cc[2]], '截面圆', {
              color: G.accent(st), size: 11, dx: 16, dy: -6, key: key + ':circ',
            }));
          }
          continue;
        }
        if (s.kind) {
          local.push(G.polySolid({
            st, n: s.n, r: s.r, rTop: s.rTop, h: s.h, y0: 0,
            kind: s.kind, key: key, tint: G.tint(st, 0.035), sw: 1.5,
          }).items);
        } else if (s.k === 'cylinder') {
          local.push(G.cylinder({ st, r: s.r, h: s.h, y0: 0, key, seg: 56 }));
        } else if (s.k === 'cone') {
          local.push(G.cone({ st, r: s.r, h: s.h, y0: 0, key, seg: 56 }));
        } else if (s.k === 'roundFrustum') {
          local.push(G.roundFrustum({ st, r1: s.r1, r2: s.r2, h: s.h, y0: 0, key, seg: 56 }));
        }
        items.push(G.shift(local, [s.x, s.y, 0]));
        // 截面（与底面平行的平面所截得的图形）
        if (cutOn) {
          const yy = s.h * 0.62;
          let pts;
          if (s.k === 'cylinder') pts = G.ringPts(40, s.r, yy, 0).reverse();
          else if (s.k === 'cone') pts = G.ringPts(40, s.r * (1 - 0.62), yy, 0).reverse();
          else if (s.k === 'roundFrustum') pts = G.ringPts(40, s.r1 + (s.r2 - s.r1) * 0.62, yy, 0).reverse();
          else {
            const rr = s.kind === 'pyramid' ? s.r * (1 - 0.62) : (s.kind === 'frustum' ? s.r + (s.rTop - s.r) * 0.62 : s.r);
            pts = G.ringPts(s.n, rr, yy, Math.PI * 0.75);
          }
          items.push(E.face(pts, {
            color: G.accent(st), alpha0: 0.3, edgeColor: G.accent(st), sw: 2,
            layer: 'top', key: key + ':cut', tip: '截面与底面平行，形状与原底面相似',
          }));
          G.shift(items[items.length - 1], [s.x, s.y, 0]);
        }
        // 名称标签
        items.push(E.label([s.x, s.y - 0.32, 0], s.name, {
          color: G.ink(st), size: 12.5, key, dy: 0,
        }));
      }
      return { items, fit: 1.0 };
    },

    init(ctx) {
      const host = ctx.root.querySelector('#p1-steps');
      if (host) window.UI.mountSteps(host, [
        { t: '底面 ABCDEF 是正六边形，上、下底面互相平行且全等，符合棱柱的结构特征。', why: '8.1 棱柱的定义', keys: ['sol:prism'] },
        { t: '侧棱 AA₁、BB₁、…、FF₁ 都垂直于底面，因此它是<b>直棱柱</b>。', why: '直棱柱的定义（侧棱垂直于底面）', keys: ['sol:prism'] },
        { t: '底面又是正多边形，所以这个棱柱是<b>正六棱柱</b>——两个条件缺一不可。', why: '正棱柱的定义（底面为正多边形的直棱柱）', keys: ['sol:prism'] },
        { t: '正棱柱的性质：侧棱长等于高，各侧面是全等的矩形，两底面中心的连线垂直于底面。', why: '正棱柱的性质', keys: ['sol:prism'] },
      ], ctx, {
        onStep: (i) => {
          const n = ctx.root.querySelector('#p1-note');
          if (!n) return;
          if (i >= 0) { n.innerHTML = '<b>正六棱柱</b><br>上下底面为正六边形且平行，侧棱⊥底面；侧面为全等矩形。'; n.classList.remove('hide'); }
        },
      });
      const note = ctx.root.querySelector('#p1-note');
      const show = (k) => {
        const info = INFO[k];
        if (!info || !note) return;
        note.innerHTML = `<b>${info.title}</b><br>${info.text}`;
        note.classList.remove('hide');
      };
      ctx.root.querySelector('#p1-note').addEventListener('click', () => note.classList.add('hide'));
      ctx.showInfo = show;
      ctx.page.onPick = (key) => { if (key) show(key); };
      ctx.studio.onPick = (key) => { if (key) show(key); };
    },

    onViz(act, el, ctx) {
      if (act === 'cut') {
        ctx.params.cut = !ctx.params.cut;
        el.classList.toggle('on', ctx.params.cut);
        ctx.studio.dirty = true;
      }
      if (act === 'focus-round') {
        const on = !el.classList.contains('on');
        ctx.root.querySelectorAll('[data-viz="focus-poly"]').forEach(b => b.classList.remove('on'));
        el.classList.toggle('on', on);
        ctx.studio.focusOn(on ? ['sol:cylinder', 'sol:cone', 'sol:roundFrustum', 'sol:sphere'] : []);
      }
      if (act === 'focus-poly') {
        const on = !el.classList.contains('on');
        ctx.root.querySelectorAll('[data-viz="focus-round"]').forEach(b => b.classList.remove('on'));
        el.classList.toggle('on', on);
        ctx.studio.focusOn(on ? ['sol:prism', 'sol:pyramid', 'sol:frustum'] : []);
      }
    },

    tip: `柱体、锥体、台体、球是七种最基本的几何体。<b>棱柱与圆柱统称柱体，棱锥与圆锥统称锥体，棱台与圆台统称台体</b>；棱柱、棱锥、棱台都是多面体。`,
    tipMore: `当棱台的上底面扩大到与下底面全等时，棱台变为棱柱；当上底面缩成一个点时，棱台变为棱锥。圆台同理。所以 <b>台体是柱体与锥体之间的“中间状态”</b>。`,

    tabs: {
      knowledge: `
        <h2 class="sec">8.1 基本立体图形 <span class="tag">空间几何体</span></h2>
        <p class="lead">如果只考虑物体的形状和大小，而不考虑其他因素，那么由这些物体抽象出来的空间图形叫做<b>空间几何体</b>。本节按“多面体 — 旋转体 — 组合体”的顺序认识它们。</p>

        <h3 class="sec-sub">一、多面体：棱柱、棱锥、棱台</h3>
        <div class="theo">
          <div class="theo-t">棱柱的结构特征</div>
          <p>有两个面互相平行，其余各面都是四边形，并且每相邻两个四边形的公共边都互相平行，由这些面所围成的多面体叫棱柱。</p>
          <p><span class="sym">侧棱 ∥ 且相等</span>　<span class="sym">侧面都是平行四边形</span>　<span class="sym">两底面平行且全等</span></p>
        </div>
        <div class="card">
          <div class="card-t"><span class="badge">辨析</span>直棱柱 · 斜棱柱 · 正棱柱 · 平行六面体</div>
          <ul>
            <li><b>直棱柱</b>：侧棱垂直于底面（教材图 8.1-6（1）（3））。</li>
            <li><b>斜棱柱</b>：侧棱不垂直于底面。</li>
            <li><b>正棱柱</b>：底面是正多边形的<b>直</b>棱柱，缺一不可。</li>
            <li><b>平行六面体</b>：底面是平行四边形的四棱柱。</li>
          </ul>
        </div>
        <div class="theo">
          <div class="theo-t">棱锥与棱台</div>
          <p>有一个面是多边形，其余各面都是有一个公共顶点的三角形，这样的多面体叫<b>棱锥</b>。</p>
          <p>用平行于棱锥底面的平面去截棱锥，底面与截面之间的部分叫<b>棱台</b>。棱台的侧棱延长后交于一点，侧面都是梯形。</p>
        </div>
        <div class="note"><b>易错</b>　棱台必须有“两底面平行且相似”这一结构，直接说“两个面平行、其余面是梯形”并不充分。</div>

        <h3 class="sec-sub">二、旋转体：圆柱、圆锥、圆台、球</h3>
        <div class="formula-grid">
          <div class="fc"><div class="fc-t">圆柱</div><div class="fc-f">矩形绕一边旋转；母线 ∥ 轴</div></div>
          <div class="fc"><div class="fc-t">圆锥</div><div class="fc-f">直角三角形绕直角边旋转</div></div>
          <div class="fc"><div class="fc-t">圆台</div><div class="fc-f">直角梯形绕垂直底边的腰旋转</div></div>
          <div class="fc"><div class="fc-t">球</div><div class="fc-f">半圆绕直径旋转；截面恒为圆</div></div>
        </div>
        <div class="card soft">
          <div class="card-t">教材例 1 · 用 Venn 图表示几何体的关系</div>
          <p>多面体 = 棱柱 ∪ 棱锥 ∪ 棱台；棱柱中的直棱柱、平行六面体、长方体、正方体层层包含，四面体是棱锥的特例。</p>
          <p><b>提示：</b>点击左侧几何体，会浮出它的结构特征文字，可与本段对照记忆。</p>
        </div>

        <h3 class="sec-sub">三、简单组合体</h3>
        <p class="lead">由简单几何体<b>拼接</b>而成，或由简单几何体<b>截去、挖去</b>一部分而成，这样的几何体叫简单组合体（教材图 8.1-14）。</p>
        <div class="note">教材例 2：以直角梯形 ABCD 的下底 AB 所在直线为轴旋转一周，得到的是<b>圆柱 BE 与圆锥 AE 的组合体</b>。判断组合体的关键，是“分层找轴、逐段看轮廓”。</div>
      `,
      example: `
        <h2 class="sec">典型例题 <span class="tag">8.1</span></h2>
        <div class="card soft">
          <div class="example-head"><span class="no">例题</span><span class="src">教材 8.1 结构特征辨析 · 变式</span></div>
          <p>请根据描述，判断它是什么几何体。点击选项即可判定，下列 4 小题逐一完成。</p>
        </div>

        <div class="q">
          <div class="q-head"><span class="qn">(1)</span><span>用一个平行于圆锥底面的平面截圆锥，底面与截面之间的部分是什么？</span></div>
          <div class="opts">
            <button class="opt" data-ok="0"><span class="mk">A</span>圆锥</button>
            <button class="opt" data-ok="1"><span class="mk">B</span>圆台</button>
            <button class="opt" data-ok="0"><span class="mk">C</span>圆柱</button>
            <button class="opt" data-ok="0"><span class="mk">D</span>球</button>
          </div>
        </div>
        <div class="q">
          <div class="q-head"><span class="qn">(2)</span><span>直角梯形绕垂直于两底的腰所在直线旋转一周，得到什么？</span></div>
          <div class="opts">
            <button class="opt" data-ok="1"><span class="mk">A</span>圆台</button>
            <button class="opt" data-ok="0"><span class="mk">B</span>圆柱</button>
            <button class="opt" data-ok="0"><span class="mk">C</span>两个圆锥的组合体</button>
            <button class="opt" data-ok="0"><span class="mk">D</span>球</button>
          </div>
          <div class="note" style="margin-left:26px">注意区分教材例 2：绕<b>下底</b>旋转得到的是圆柱与圆锥的拼接；绕<b>直角腰</b>旋转才是圆台。</div>
        </div>
        <div class="q">
          <div class="q-head"><span class="qn">(3)</span><span>有两个面互相平行，其余各面都是有一个公共顶点的三角形，这样的多面体是？</span></div>
          <div class="opts">
            <button class="opt" data-ok="0"><span class="mk">A</span>棱柱</button>
            <button class="opt" data-ok="0"><span class="mk">B</span>棱台</button>
            <button class="opt" data-ok="1"><span class="mk">C</span>棱锥</button>
            <button class="opt" data-ok="0"><span class="mk">D</span>以上都不是</button>
          </div>
        </div>

        <h3 class="sec-sub">分步解析 · 正六棱柱的结构</h3>
        <p class="lead">题目：判断“底面是正六边形，且侧棱垂直于底面”的棱柱是不是正棱柱，并说明理由。</p>
        <div id="p1-steps"></div>
      `,
      practice: `
        <h2 class="sec">练习 <span class="tag">8.1</span></h2>
        <div class="card soft">
          <div class="card-t">练习 1 · 欧拉公式验证（教材习题 8.1 变式）</div>
          <p>数一数，填一填，再点击“核对答案”检验欧拉公式 <span class="f"><i>V</i> − <i>E</i> + <i>F</i> = 2</span>。</p>
          <table class="tb">
            <thead><tr><th>多面体</th><th>顶点数 <i>V</i></th><th>棱数 <i>E</i></th><th>面数 <i>F</i></th><th><i>V</i>−<i>E</i>+<i>F</i></th></tr></thead>
            <tbody>
              <tr><td>三棱柱</td><td class="blank">6</td><td class="blank">9</td><td class="blank">5</td><td class="blank">2</td></tr>
              <tr><td>四棱锥</td><td class="blank">5</td><td class="blank">8</td><td class="blank">5</td><td class="blank">2</td></tr>
              <tr><td>五棱台</td><td class="blank">10</td><td class="blank">15</td><td class="blank">7</td><td class="blank">2</td></tr>
              <tr><td>正八面体</td><td class="blank">6</td><td class="blank">12</td><td class="blank">8</td><td class="blank">2</td></tr>
            </tbody>
          </table>
          <button class="btn tiny" data-table-reveal>核对答案</button>
        </div>

        <div class="q">
          <div class="q-head"><span class="qn">2</span><span>（教材习题 8.1 第 10 题）下列说法是否正确？若错误，请举出反例。</span></div>
          <div class="opts">
            <button class="opt" data-ok="1"><span class="mk">①</span>棱柱的侧棱都相等，侧面都是平行四边形。</button>
            <button class="opt" data-ok="0"><span class="mk">②</span>棱锥的侧面都是等边三角形。</button>
            <button class="opt" data-ok="0"><span class="mk">③</span>棱台的侧棱长都相等。</button>
          </div>
          <button class="ans-btn" data-reveal data-open="显示答案与步骤" data-close="收起">显示答案与步骤</button>
          <div class="ans">
            <div class="a-line"><b>答案</b>　① 正确；② 错误；③ 错误。</div>
            <div class="sol-step" data-n="1">① 由棱柱的定义，各侧棱互相平行且相等，侧面是平行四边形，故正确。</div>
            <div class="sol-step" data-n="2">② 反例：正四棱锥 S-ABCD 中，侧面是等腰三角形而非等边三角形。</div>
            <div class="sol-step" data-n="3">③ 反例：正四棱台上、下底边长不等时，四条侧棱相等但上、下底对应的“斜棱”不同；一般棱台侧棱可以互不相等。只有<b>正棱台</b>的侧棱才相等。</div>
          </div>
        </div>

        <div class="q">
          <div class="q-head"><span class="qn">3</span><span>教材图 8.1-15：以直角梯形 ABCD 的下底 AB 为轴旋转一周，所得几何体由哪些简单几何体组成？</span></div>
          <button class="ans-btn" data-reveal>显示答案与步骤</button>
          <div class="ans">
            <div class="a-line"><b>答案</b>　圆柱 BE 与圆锥 AE 的组合体。</div>
            <div class="sol-step" data-n="1">作 DE ⊥ AB 于 E，把梯形分成矩形 BCDE 与直角△ADE。</div>
            <div class="sol-step" data-n="2">矩形 BCDE 绕 AB 旋转得到圆柱 BE，底面为 ⊙B 与 ⊙E，母线为 CD。</div>
            <div class="sol-step" data-n="3">直角△ADE 绕 AE 旋转得到圆锥 AE，底面为 ⊙E，母线为 AD。两部分拼接即得该组合体。</div>
          </div>
        </div>
      `,
    },
  });
})();
