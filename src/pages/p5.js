/* =============================================================
   第 5 页 · 8.3 简单几何体的表面积与体积
   知识点：8.3.1 棱柱/棱锥/棱台的表面积与体积；8.3.2 圆柱/圆锥/圆台/球的
           表面积与体积；柱体、锥体、台体公式的统一（S′ = S、S′ = 0）
   交互：正四棱台（斜高/中截面高亮）、漏斗组合体拆解、正方体挖球
   ============================================================= */
(function () {
  'use strict';
  const E = window.Ink3D, G = window.Geo;

  window.PAGES.push({
    id: 'p5',
    short: '8.3 表面积与体积',
    title: '8.3 表面积与体积',
    running: '8.3 表面积与体积',
    chapter: '8.3',
    defaults: { mode: 'frustum', explode: 0, r: 1.2, hh: 2.2 },
    vizTools: `
      <button class="chip on" data-viz="m-frustum">正四棱台</button>
      <button class="chip" data-viz="m-funnel">组合体（拼接）</button>
      <button class="chip" data-viz="m-hollow">组合体（挖空）</button>
      <button class="chip" data-viz="m-cyl">圆柱实时公式</button>
      <div class="slider-chip">拆解 <input type="range" data-param="explode" min="0" max="1" step="0.01" value="0"><span class="v">0.00</span></div>
      <div class="viz-card" id="p5-note"></div>`,
    camera: { zoom: 1.0, pitch: 0.3, yaw: -0.6, offset: [0, 0.95, 0] },

    scene(t, ctx) {
      const st = ctx.studio, p = ctx.params, ex = p.explode;
      const items = [];

      /* ---------- 正四棱台 ---------- */
      if (p.mode === 'frustum') {
        const a1 = 1.2, a2 = 2.4, h = 1.8;   // 上底、下底边长、高
        const R1 = a1 / Math.SQRT2, R2 = a2 / Math.SQRT2;
        const top = G.ringPts(4, R1, h, Math.PI / 4);
        const bot = G.ringPts(4, R2, 0, Math.PI / 4);
        const skin = G.tint(st, 0.03);
        items.push(E.face([bot[3], bot[2], bot[1], bot[0]], { color: skin, key: 'fr:base', edgeColor: G.ink(st), sw: 1.5 }));
        for (let i = 0; i < 4; i++) {
          const j = (i + 1) % 4;
          items.push(E.face([bot[i], bot[j], top[j], top[i]], {
            color: G.tint(st, 0.02 + i * 0.02), key: 'fr:side' + i, edgeColor: G.ink(st), sw: 1.4,
            tip: '侧面是等腰梯形，高即斜高 h′',
          }));
        }
        items.push(E.face(top, { color: G.tint(st, 0.0), key: 'fr:top', edgeColor: G.ink(st), sw: 1.4 }));
        // 斜高：侧面 BCC₁B₁ 的高
        const M2 = G.mid(bot[0], bot[1]), M1 = G.mid(top[0], top[1]);
        items.push(E.line(M2, M1, { color: G.accent(st), sw: 2.2, key: 'fr:hp' }));
        items.push(E.label(G.mid(M2, M1), "h′", { color: G.accent(st), dx: 30, dy: 4, size: 13, key: 'fr:hp' }));
        items.push(G.rightAngle(M1, M2, bot[1], 0.16, { color: G.accent(st), key: 'fr:hp' }));
        // 高
        const O2 = [0, 0, 0], O1 = [0, h, 0];
        items.push(E.line(O2, O1, { color: G.accent(st), sw: 1.6, dash: [6, 4], key: 'fr:h' }));
        items.push(E.label([0, h * 0.86, 0], 'h', { color: G.accent(st), dx: -14, dy: 4, size: 13, key: 'fr:h' }));
        // 中截面：上、下底面中位线所确定的截面（面积 = 平均值）
        const midY = h / 2, midA = (a1 + a2) / 2, midR = midA / Math.SQRT2;
        const mp = G.ringPts(4, midR, midY, Math.PI / 4);
        items.push(E.face(mp, {
          color: G.accent(st), alpha0: 0.28, edgeColor: G.accent(st), sw: 1.8, layer: 'top', key: 'fr:mid',
          tip: '中截面：过高的中点且平行于底面，面积等于上、下底面积的平均值',
        }));
        items.push(E.label([0, midY + 0.02, -(midR + 0.06)], '中截面', { color: G.accent(st), dy: -12, size: 10.5, key: 'fr:mid' }));
        // 标注
        const nmT = ['A₁', 'B₁', 'C₁', 'D₁'], nmB = ['A', 'B', 'C', 'D'];
        const vl = [];
        for (let i = 0; i < 4; i++) {
          items.push(E.point(bot[i], { r: 2.6, key: 'fr:' + nmB[i] }));
          items.push(E.point(top[i], { r: 2.6, key: 'fr:' + nmT[i] }));
          vl.push({ p: bot[i], text: nmB[i], key: 'fr:' + nmB[i] });
          vl.push({ p: top[i], text: nmT[i], key: 'fr:' + nmT[i] });
        }
        G.autoLabels(st, vl, { dist: 14 });
        vl.forEach(v => items.push(E.label(v.p, v.text, { dx: v.dx, dy: v.dy, key: v.key, size: 11.5 })));
        return { items, fit: 0.98 };
      }

      /* ---------- 组合体：漏斗（长方体 + 四棱锥，教材例 2） ---------- */
      if (p.mode === 'funnel') {
        const w = 1.7, hb = 1.15, hp = 1.15;
        // 长方体（上方）
        const boxTop = G.box({ st, w, h: hb, d: w, cy: hp + ex * 0.75, key: 'fn:box', tint: G.tint(st, 0.04), sw: 1.5 });
        items.push(boxTop.items);
        // 四棱锥（下方，顶点朝下）
        const apex = [0, 0, 0];
        const baseY = hp;
        const s = w / 2;
        const quad = [[-s, baseY, s], [s, baseY, s], [s, baseY, -s], [-s, baseY, -s]];
        for (let i = 0; i < 4; i++) {
          const j = (i + 1) % 4;
          items.push(E.face([quad[i], quad[j], apex], {
            color: G.tint(st, 0.03 + i * 0.02), key: 'fn:py' + i, edgeColor: G.ink(st), sw: 1.4,
          }));
        }
        // 公共面 ABCD 高亮
        items.push(E.face(quad, {
          color: G.accent(st), alpha0: 0.26, edgeColor: G.accent(st), sw: 2, layer: 'top', key: 'fn:common',
          tip: '公共面 ABCD：边长为 1 m 的正方形',
        }));
        items.push(E.label([0, baseY, 0], '公共面 ABCD', {
          color: G.accent(st), dx: -76, dy: -6, size: 10.5, key: 'fn:common', align: 'right', leader: true,
        }));
        // 尺寸标注
        items.push(E.label([s, baseY + hb / 2 + ex * 0.75, s], '0.5 m', { dx: 30, dy: 0, size: 10.5, color: G.accent(st) }));
        items.push(E.label([0, hp / 2, 0], '0.5 m', { dx: -30, dy: 2, size: 10.5, color: G.accent(st) }));
        items.push(E.label([0, baseY, s], '1 m', { dy: 20, size: 10.5, color: G.accent(st) }));
        return { items, fit: 0.95 };
      }

      /* ---------- 组合体：正方体挖去内切球 ---------- */
      if (p.mode === 'hollow') {
        const a = 2.2;
        const cube = G.cube({ st, a, key: 'hw:cube', alpha: st.seeThrough ? 0.3 : 1, tint: G.tint(st, 0.05) });
        items.push(cube.items);
        const R = a / 2 * (1 - ex * 0.15);
        items.push(G.sphere({ c: [0, a / 2, 0], r: R, key: 'hw:ball', color: G.accent(st) === '#d9503a' ? '#e9b9a8' : G.tint(st, 0.14), alpha: st.seeThrough ? 0.3 : 1 }));
        items.push(G.circle3([0, a / 2, 0], [1, 0, 0], [0, 0, 1], R, { color: G.accent(st), sw: 1.4, alpha: 0.9, key: 'hw:eq' }));
        items.push(E.label([0, a / 2, R], '内切球 R = a/2', { dy: 16, size: 10.5, color: G.accent(st), key: 'hw:ball' }));
        // 外接球（虚线示意）
        const Rc = a * Math.sqrt(3) / 2;
        items.push(G.circle3([0, a / 2, 0], [1, 0, 0], [0, 0, 1], Rc, { color: G.ink(st), sw: 1.1, alpha: 0.55, dash: [5, 4], key: 'hw:out' }));
        items.push(E.label([0, a / 2, Rc], '外接球 R = (√3/2)a', { dy: -14, size: 10.5, color: G.ink(st), key: 'hw:out' }));
        return { items, fit: 1.02 };
      }

      /* ---------- 圆柱：实时公式 ---------- */
      const r = p.r, hh = p.hh;
      items.push(G.cylinder({ st, r, h: hh, y0: 0, key: 'cy', seg: 64, rings: [[r, 0], [r, hh]] }));
      items.push(E.line([0, 0, 0], [0, hh, 0], { color: G.accent(st), sw: 1.5, dash: [6, 4], key: 'cy:h' }));
      items.push(E.label([0, hh / 2, 0], 'h', { dx: -12, size: 12.5, color: G.accent(st), key: 'cy:h' }));
      items.push(G.seg([0, 0, 0], [r, 0, 0], { color: G.ink(st), sw: 1.3, key: 'cy:r' }));
      items.push(E.label([r / 2, 0, 0], 'r', { dy: 13, size: 12.5, key: 'cy:r' }));
      // 母线
      const c = G.camXZ(st);
      items.push(G.seg([r * c[0], 0, r * c[1]], [r * c[0], hh, r * c[1]], { color: G.accent(st), sw: 1.8, key: 'cy:l' }));
      items.push(E.label([r * c[0], hh * 0.6, r * c[1]], 'l = h', { dx: 26, size: 11, color: G.accent(st), key: 'cy:l' }));
      // 侧面展开（示意矩形贴在前方地面）
      const uw = 2 * Math.PI * r * 0.34;
      const rect = [[-uw, -0.62, 1.9], [uw, -0.62, 1.9], [uw, hh * 0.72 - 0.62, 1.9], [-uw, hh * 0.72 - 0.62, 1.9]];
      items.push(E.face(rect, {
        color: G.accent(st), alpha0: 0.16, edgeColor: G.accent(st), sw: 1.4, dash: [5, 3], layer: 'top', key: 'cy:unfold',
        tip: '侧面展开图：长 2πr、宽 l 的矩形',
      }));
      items.push(E.label([0, hh * 0.36 - 0.62, 1.9], '侧面展开 2πr × l', { size: 10.5, color: G.accent(st), key: 'cy:unfold' }));
      return { items, fit: 0.95 };
    },

    onParam(k, v, ctx) {
      if (k === 'r' || k === 'hh') updateNote(ctx);
    },

    onViz(act, el, ctx) {
      if (act.indexOf('m-') === 0) {
        ctx.params.mode = act.slice(2);
        ctx.root.querySelectorAll('[data-viz^="m-"]').forEach(b => b.classList.toggle('on', b === el));
        ctx.studio.dirty = true;
        updateNote(ctx);
      }
    },

    init(ctx) {
      updateNote(ctx);
      const host = ctx.root.querySelector('#p5-steps');
      if (host) window.UI.mountSteps(host, [
        { t: '正四棱台上底面边长 2、下底面边长 4、高 3。侧面是等腰梯形，梯形的高就是<b>斜高 h′</b>。', why: '棱台的结构特征（8.1.3）', keys: ['fr:side1', 'fr:hp'] },
        { t: '在侧面内作高，得到直角三角形：h′ = √(h² + ((a − a′)/2)²) = √(3² + 1²) = √10。', why: '轴截面 / 侧面内的直角三角形', keys: ['fr:hp', 'fr:h'] },
        { t: 'S<sub>侧</sub> = 4 × ½(a + a′)·h′ = 4 × ½ × 6 × √10 = 12√10。', why: '棱台侧面积 = 各侧面面积之和', keys: ['fr:side1', 'fr:side2'] },
        { t: '上底 S′ = 4，下底 S = 16，中截面面积 = ½(S′ + S) = 10（图中高亮）。', why: '中截面性质', keys: ['fr:mid', 'fr:base', 'fr:top'] },
        { t: 'V = ⅓h(S′ + √(S′S) + S) = ⅓ × 3 × (4 + 8 + 16) = 28。', why: '棱台的体积公式（8.3.1）', keys: ['fr:base', 'fr:top'] },
      ], ctx);
    },

    tip: `表面积 = 围成几何体各个面的面积之和；体积 = 几何体所占空间的大小。柱、锥、台三套公式并不需要死记：<b>台体公式中令 S′ = S 得柱体，令 S′ = 0 得锥体</b>。`,
    tipMore: `棱台侧面积常用“<b>斜高 × 上下底周长之半的和</b>”：S<sub>侧</sub> = ½(C′ + C)h′。中截面面积等于上、下底面积的算术平均。球是唯一“只用一个半径就能确定”的几何体：S = 4πR²，V = 4/3πR³。`,

    tabs: {
      knowledge: `
        <h2 class="sec">8.3 表面积与体积 <span class="tag">公式总表</span></h2>
        <p class="lead">多面体的表面积就是围成它的各个面的面积之和；旋转体的表面积由侧面展开图得到。</p>
        <h3 class="sec-sub">一、多面体</h3>
        <div class="formula-grid">
          <div class="fc"><div class="fc-t">棱柱</div><div class="fc-f">S<sub>侧</sub> = Ch（直棱柱），V = Sh</div></div>
          <div class="fc"><div class="fc-t">棱锥</div><div class="fc-f">S<sub>侧</sub> = ½Ch′，V = ⅓Sh</div></div>
          <div class="fc"><div class="fc-t">棱台</div><div class="fc-f">S<sub>侧</sub> = ½(C + C′)h′</div></div>
          <div class="fc"><div class="fc-t">棱台体积</div><div class="fc-f">V = ⅓h(S′ + √(S′S) + S)</div></div>
        </div>
        <h3 class="sec-sub">二、旋转体</h3>
        <div class="formula-grid">
          <div class="fc"><div class="fc-t">圆柱</div><div class="fc-f">S = 2πr(r + l)，V = πr²h</div></div>
          <div class="fc"><div class="fc-t">圆锥</div><div class="fc-f">S = πr(r + l)，V = ⅓πr²h</div></div>
          <div class="fc"><div class="fc-t">圆台</div><div class="fc-f">S = π(r′² + r² + r′l + rl)</div></div>
          <div class="fc"><div class="fc-t">圆台体积</div><div class="fc-f">V = ⅓πh(r′² + r′r + r²)</div></div>
          <div class="fc"><div class="fc-t">球面</div><div class="fc-f">S = 4πR²</div></div>
          <div class="fc"><div class="fc-t">球体</div><div class="fc-f">V = 4/3·πR³</div></div>
        </div>
        <div class="theo">
          <div class="theo-t">柱体、锥体、台体公式的统一（教材“探究”）</div>
          <p>V<sub>柱</sub> = Sh；V<sub>锥</sub> = ⅓Sh；V<sub>台</sub> = ⅓h(S′ + √(S′S) + S)。</p>
          <p>当 S′ = S 时，台体变为柱体，公式变为 Sh；当 S′ = 0 时，台体变为锥体，公式变为 ⅓Sh。<b>台体是柱体与锥体之间的过渡形态。</b></p>
        </div>
        <div class="note"><b>球的体积推导思路</b>　把球面分成 n 个小网格，与球心连线得到 n 个“小锥体”，每个体积 ≈ ⅓S<sub>i</sub>R，求和得 V = ⅓S<sub>球</sub>R = ⅓·4πR²·R = 4/3πR³。</div>
      `,
      example: `
        <h2 class="sec">典型例题 <span class="tag">8.3</span></h2>
        <div class="card">
          <div class="example-head"><span class="no">例题</span><span class="src">正四棱台 · 侧面积与体积（教材习题 8.3 第 1 题变式）</span></div>
          <p>正四棱台的上、下底面边长分别为 2 和 4，高为 3。求它的侧面积与体积。</p>
        </div>
        <div id="p5-steps"></div>

        <h3 class="sec-sub">教材例 2 · 漏斗的容积</h3>
        <div class="card soft">
          <p>上面部分是长方体，下面部分是四棱锥，两部分的高都是 0.5 m，公共面 ABCD 是边长为 1 m 的正方形。</p>
          <p>V<sub>长方体</sub> = 1 × 1 × 0.5 = 0.5（m³），V<sub>棱锥</sub> = ⅓ × 1 × 1 × 0.5 = 1/6（m³），</p>
          <p>V = 0.5 + 1/6 = 2/3 ≈ <b>0.67 m³</b>。切到左侧“组合体（拼接）”并拖动拆解滑块可看清两部分。</p>
        </div>

        <h3 class="sec-sub">教材例 4 · 球与圆柱的体积比</h3>
        <div class="card soft">
          <p>圆柱的底面直径和高都等于球的直径。设球半径为 R，则 V<sub>球</sub> = 4/3πR³，V<sub>圆柱</sub> = πR²·2R = 2πR³，</p>
          <p class="fml">V<sub>球</sub> : V<sub>圆柱</sub> = <span class="box">2 : 3</span></p>
          <p>这正是阿基米德著名的“球与其外切圆柱”结论。</p>
        </div>
      `,
      practice: `
        <h2 class="sec">练习 <span class="tag">公式应用</span></h2>
        <div class="q">
          <div class="q-head"><span class="qn">1</span><span>球的半径为 3，求它的表面积与体积。</span></div>
          <button class="ans-btn" data-reveal>显示答案与步骤</button>
          <div class="ans">
            <div class="a-line"><b>答案</b>　S = 36π，V = 36π。</div>
            <div class="sol-step" data-n="1">S = 4πR² = 4π × 9 = 36π。</div>
            <div class="sol-step" data-n="2">V = 4/3πR³ = 4/3π × 27 = 36π。</div>
            <div class="sol-step" data-n="3">本题恰有 V 与 S 数值相等，这说明半径满足 R = 3 时两者数值相同（一般地由 4πR² = 4/3πR³ 得 R = 3）。</div>
          </div>
        </div>
        <div class="q">
          <div class="q-head"><span class="qn">2</span><span>（教材习题 8.3 第 3 题）正方体棱长 50 cm，截去八个一样的四面体（各顶点处）得到石凳，求石凳体积。</span></div>
          <button class="ans-btn" data-reveal>显示答案与步骤</button>
          <div class="ans">
            <div class="a-line"><b>答案</b>　V = <span class="hl2">(5/6) × 50³ ≈ 104166.7 cm³</span></div>
            <div class="sol-step" data-n="1">在每个顶点处截去一个四面体，它从该顶点出发的三条棱都是正方体棱长的一半，即 25 cm，且两两垂直。</div>
            <div class="sol-step" data-n="2">一个四面体的体积 V₁ = ⅓ × (½ × 25 × 25) × 25 = 25³/6。</div>
            <div class="sol-step" data-n="3">八个四面体共 8 × 25³/6 = (4/3) × 15625 = 62500/3 ≈ 20833.3 cm³。</div>
            <div class="sol-step" data-n="4">石凳体积 = 50³ − 62500/3 = 125000 − 20833.3 ≈ 104166.7（cm³），恰好是原正方体体积的 5/6。</div>
          </div>
        </div>
        <div class="q">
          <div class="q-head"><span class="qn">3</span><span>圆锥的底面半径为 3，母线长为 5，求它的表面积与体积。</span></div>
          <button class="ans-btn" data-reveal>显示答案与步骤</button>
          <div class="ans">
            <div class="a-line"><b>答案</b>　S = 24π，V = 12π。</div>
            <div class="sol-step" data-n="1">由 l² = r² + h² 得 h = √(25 − 9) = 4。</div>
            <div class="sol-step" data-n="2">S = πr(r + l) = π × 3 × 8 = 24π。</div>
            <div class="sol-step" data-n="3">V = ⅓πr²h = ⅓π × 9 × 4 = 12π。</div>
          </div>
        </div>
        <div class="q">
          <div class="q-head"><span class="qn">4</span><span>把棱长为 6 cm 的正方体铁块磨制成一个球，求可能得到的最大球的体积（教材 8.3 练习第 3 题）。</span></div>
          <button class="ans-btn" data-reveal>显示答案与步骤</button>
          <div class="ans">
            <div class="a-line"><b>答案</b>　V = 36π cm³。</div>
            <div class="sol-step" data-n="1">最大球是正方体的内切球，直径等于棱长，R = 3 cm。</div>
            <div class="sol-step" data-n="2">V = 4/3πR³ = 4/3π × 27 = 36π ≈ 113.1 cm³。</div>
          </div>
        </div>
      `,
    },
  });

  function updateNote(ctx) {
    const n = ctx.root.querySelector('#p5-note');
    if (!n) return;
    const p = ctx.params;
    let html = '';
    if (p.mode === 'frustum') {
      html = '<b>正四棱台</b>　a′ = 2，a = 4，h = 3<br>h′ = √(3² + 1²) = √10 ≈ 3.16<br>S<sub>侧</sub> = 4 × ½(2+4) × √10 = 12√10 ≈ 37.9<br>V = ⅓ × 3 × (4 + 8 + 16) = 28';
    } else if (p.mode === 'funnel') {
      html = '<b>漏斗（拼接体）</b><br>V<sub>长方体</sub> = 1×1×0.5 = 0.5 m³<br>V<sub>棱锥</sub> = ⅓×1×1×0.5 = 1/6 m³<br>V = 2/3 ≈ 0.67 m³（不考虑厚度）';
    } else if (p.mode === 'hollow') {
      html = '<b>正方体挖去内切球</b>　棱长 a<br>V<sub>剩</sub> = a³ − 4/3π(a/2)³ = a³ − πa³/6<br>S<sub>剩</sub> = 6a² − 4π(a/2)² + 4π(a/2)² = 6a²<br>外接球 R = (√3/2)a';
    } else {
      const r = p.r, h = p.hh;
      html = `<b>圆柱实时公式</b>　r = ${r.toFixed(2)}，h = ${h.toFixed(2)}<br>` +
        `S<sub>侧</sub> = 2πrh = ${(2 * Math.PI * r * h).toFixed(2)}<br>` +
        `S<sub>全</sub> = 2πr(r + h) = ${(2 * Math.PI * r * (r + h)).toFixed(2)}<br>` +
        `V = πr²h = ${(Math.PI * r * r * h).toFixed(2)}`;
    }
    n.innerHTML = html;
    n.classList.remove('hide');
  }
})();
