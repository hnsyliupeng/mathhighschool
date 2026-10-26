/* =============================================================
   第 4 页 · 8.2 立体图形的直观图（斜二测画法）
   知识点：8.2 斜二测画法三步骤：45°、平行性不变、
           x 轴（z 轴）方向长度不变、y 轴方向长度减半
   交互：原图 → 直观图 实时转换；坐标轴角度可调；正六边形 / 长方体
   ============================================================= */
(function () {
  'use strict';
  const E = window.Ink3D, G = window.Geo;
  const C45 = Math.cos(Math.PI / 4), S45 = Math.sin(Math.PI / 4);

  const SHAPES = {
    hex: {
      name: '正六边形',
      pts: [[-1.4, 0], [-0.7, 1.212], [0.7, 1.212], [1.4, 0], [0.7, -1.212], [-0.7, -1.212]],
      closing: true,
    },
    square: { name: '正方形', pts: [[-1, -1], [1, -1], [1, 1], [-1, 1]] },
    triangle: { name: '正三角形', pts: [[0, 1.4], [1.212, -0.7], [-1.212, -0.7]] },
  };

  window.PAGES.push({
    id: 'p4',
    short: '8.2 直观图',
    title: '8.2 立体图形的直观图',
    running: '8.2 斜二测画法',
    chapter: '8.2',
    defaults: { mode: 'hex', t: 1, angle: 45 },
    vizTools: `
      <button class="chip on" data-viz="s-hex">正六边形</button>
      <button class="chip" data-viz="s-square">正方形</button>
      <button class="chip" data-viz="s-triangle">正三角形</button>
      <button class="chip" data-viz="s-cuboid">长方体</button>
      <div class="slider-chip">转换 <input type="range" data-param="t" min="0" max="1" step="0.01" value="0.6"><span class="v">0.60</span></div>
      <div class="slider-chip">∠x′O′y′ <input type="range" data-param="angle" min="15" max="75" step="1" value="45"><span class="v">45.00</span></div>
      <div class="viz-card hide" id="p4-note"></div>`,
    camera: { zoom: 0.95, pitch: 0.62, yaw: -0.9, offset: [0, 0.1, 0] },

    scene(t, ctx) {
      const st = ctx.studio, p = ctx.params;
      const items = [];
      const th = p.angle * Math.PI / 180;
      const c = Math.cos(th), s = Math.sin(th);
      const morph = p.t;

      /* 坐标轴：x′ 水平，y′ 与 x′ 成 th，z 竖直 */
      items.push(E.line([-1.25, 0, 0], [2.35, 0, 0], { color: G.ink(st), sw: 1.2, key: 'ax:x' }));
      items.push(E.label([2.5, 0, 0], 'x′', { dx: 8, dy: -12, size: 12, key: 'ax:x' }));
      items.push(E.line([0, 0, 0], [1.9 * c, 0, -1.9 * s], { color: G.ink(st), sw: 1.2, dashed: true, key: 'ax:y' }));
      items.push(E.label([2.02 * c, 0, -2.02 * s], 'y′', { dx: 10, dy: -4, size: 12, key: 'ax:y' }));
      items.push(G.dot3([0, 0, 0], { key: 'ax:O' }));
      items.push(E.label([0, 0, 0], 'O′', { dx: -17, dy: 17, size: 12, key: 'ax:O' }));
      items.push(E.angle([0, 0, -1.4], [0, 0, 0], [1.4, 0, 0], `${p.angle}°`, {
        key: 'ax:ang', color: G.accent(st),
      }));
      items.push(E.line([0, 0, 0], [0, 1.6, 0], { color: G.ink(st), sw: 1.1, dash: [4, 4], alpha: 0.6, key: 'ax:z' }));
      items.push(E.label([0, 1.72, 0], 'z′', { size: 11.5, key: 'ax:z' }));

      if (p.mode === 'cuboid') {
        /* 长方体直观图：长 3、宽 2、高 1.5，y 方向取一半并成 th 角 */
        const L = 3, W = 2, H = 1.5;
        const m = 0.66;      // 横向缩放，适配画面
        const X = x => x * m, Hh = y => y * m;
        const P = (x, y, z) => [X(x) + (W / 2) * 0 + (y / 2) * c * m, Hh(z), -(y / 2) * s * m];
        const B = [P(-1.5, 0, 0), P(1.5, 0, 0), P(1.5, W, 0), P(-1.5, W, 0)];
        const T = B.map(q => [q[0], q[1] + Hh(H), q[2]]);
        const ox = -0.55;
        const shift1 = arr => arr.map(q => [q[0] + ox, q[1], q[2]]);
        const Bs = shift1(B), Ts = shift1(T);
        const skin = G.tint(st, 0.03);
        // 底面
        items.push(E.face([Bs[3], Bs[2], Bs[1], Bs[0]], { color: skin, key: 'cb:base', edgeColor: G.ink(st), sw: 1.5 }));
        for (let i = 0; i < 4; i++) {
          const j = (i + 1) % 4;
          items.push(E.face([Bs[i], Bs[j], Ts[j], Ts[i]], {
            color: G.tint(st, 0.02 + i * 0.02), key: 'cb:side' + i, edgeColor: G.ink(st), sw: 1.4,
          }));
        }
        items.push(E.face(Ts, { color: G.tint(st, 0.0), key: 'cb:top', edgeColor: G.ink(st), sw: 1.4 }));
        const nm = ['A', 'B', 'C', 'D'];
        const vl = [];
        for (let i = 0; i < 4; i++) {
          items.push(E.point(Bs[i], { r: 3, key: 'cb:' + nm[i] }));
          vl.push({ p: Bs[i], text: nm[i], key: 'cb:' + nm[i] });
          items.push(E.point(Ts[i], { r: 3, key: 'cb:' + nm[i] + '₁' }));
          vl.push({ p: Ts[i], text: nm[i] + '₁', key: 'cb:' + nm[i] + '₁' });
        }
        G.autoLabels(st, vl, { dist: 15 });
        vl.forEach(v => items.push(E.label(v.p, v.text, { dx: v.dx, dy: v.dy, key: v.key })));
        // 长宽高标注
        items.push(E.label([(Bs[0][0] + Bs[1][0]) / 2, 0, 0], '长 3 cm', { dy: 20, size: 11.5, color: G.accent(st), key: 'cb:L' }));
        items.push(E.label([(Bs[1][0] + Bs[2][0]) / 2, 0, (Bs[1][2] + Bs[2][2]) / 2], '宽 2 cm', { dx: 26, dy: 8, size: 11.5, color: G.accent(st), key: 'cb:W' }));
        items.push(E.label([Bs[1][0], 0.75, Bs[1][2]], '高 1.5 cm', { dx: 34, dy: -4, size: 11.5, color: G.accent(st), key: 'cb:H' }));
        return { items, fit: 0.95 };
      }

      /* 平面图形：原图 → 直观图 */
      const sh = SHAPES[p.mode] || SHAPES.hex;
      const src = sh.pts;
      const toTarget = ([x, y]) => [x + (y / 2) * c, 0, -(y / 2) * s];
      const toOrigin = ([x, y]) => [x, 0, -y];
      const cur = src.map(q => {
        const a = toOrigin(q), b = toTarget(q);
        return [a[0] + (b[0] - a[0]) * morph, 0, a[2] + (b[2] - a[2]) * morph];
      });
      // 左后方为原图，右前方为直观图
      const off = [0.15, 0.02, 0.9];
      const origOff = [-1.95, 0.02, -1.35];
      const k0 = 0.55;
      const curS = cur.map(q => [q[0] + off[0], off[1], q[2] + off[2]]);
      const origS = src.map(q => [q[0] * k0 + origOff[0], origOff[1], -q[1] * k0 + origOff[2]]);

      // 原图（淡墨虚线，提示“变换前”）
      items.push(E.poly(origS.concat([origS[0]]), { color: G.ink(st), sw: 1.2, dash: [5, 5], alpha: 0.5, key: 'tr:orig' }));
      items.push(E.label([origOff[0], 0.02, origOff[2] - 0.8], '原图（水平放置）', { size: 10.5, alpha: 0.6, dy: 6 }));
      // 直观图（当前形态）
      items.push(E.face(curS, {
        color: G.accent(st) === '#d9503a' ? G.tint(st, 0.05) : G.tint(st, 0.05),
        alpha0: 0.72, edgeColor: G.accent(st), sw: 2.1, key: 'tr:now', tip: '斜二测直观图：x 方向长度不变，y 方向长度减半',
        texture: false,
      }));
      // 顶点对应连线（变换轨迹）
      if (morph > 0.02 && morph < 0.98) {
        src.forEach((q, i) => {
          items.push(E.line(origS[i], curS[i], { color: G.ink(st), sw: 0.8, dash: [2, 4], alpha: 0.3 }));
        });
      }

      // 顶点标注
      if (p.mode === 'hex') {
        const nm = ['A', 'B', 'C', 'D', 'E', 'F'];
        const vl = curS.map((q, i) => ({ p: q, text: nm[i] + (morph > 0.5 ? '′' : ''), key: 'tr:' + nm[i] }));
        G.autoLabels(st, vl, { dist: 16 });
        vl.forEach(v => items.push(E.label(v.p, v.text, { dx: v.dx, dy: v.dy, size: 12, key: v.key })));
      }
      // 长度关系提示
      items.push(E.label([0.0, 0.02, 2.35], 'x 方向长度不变 · y 方向长度减半 · 夹角 45°', {
        size: 10.5, color: G.ink(st), alpha: 0.75,
      }));
      // 变换箭头
      items.push(G.arrow([-1.72, 0.02, 0.62], [-1.05, 0.02, 0.62], { color: G.accent(st), sw: 1.6, key: 'tr:arrow' }));
      items.push(E.label([-1.38, 0.02, 0.62], '斜二测画法', { dx: 0, dy: 16, size: 10.5, color: G.accent(st), key: 'tr:arrow' }));
      return { items, fit: 0.92 };
    },

    onViz(act, el, ctx) {
      if (act.indexOf('s-') === 0) {
        ctx.params.mode = act.slice(2);
        ctx.root.querySelectorAll('[data-viz^="s-"]').forEach(b => b.classList.toggle('on', b === el));
        const n = ctx.root.querySelector('#p4-note');
        if (n) {
          const map = {
            hex: '<b>正六边形（教材例 1）</b><br>取 AD 所在直线为 x 轴、AD 的垂直平分线 MN 为 y 轴；画 x′、y′ 使 ∠x′O′y′ = 45°；x 方向长度不变，y 方向长度减半。',
            square: '<b>正方形</b><br>横向 AB = A′B′，纵向 AD 变成 A′D′ = ½AD，且 ∠D′A′B′ = 45°。',
            triangle: '<b>正三角形</b><br>先画 x′ 轴，按“横向不变、纵向减半、45°”确定三个顶点，再连线。',
            cuboid: '<b>长方体（教材例 2）</b><br>取过顶点 A 的三条棱所在直线为 x、y、z 轴；x、z 方向长度不变，y 方向长度为原来的一半且与 x 成 45°。',
          };
          n.innerHTML = map[ctx.params.mode];
          n.classList.remove('hide');
        }
        ctx.studio.dirty = true;
      }
    },

    init(ctx) {
      const n = ctx.root.querySelector('#p4-note');
      if (n) {
        n.innerHTML = '<b>斜二测画法 · 三步骤</b><br>① 画轴：∠x′O′y′ = 45°（或 135°）；② 平行性不变：原图中平行于 x、y 的线段，在直观图中仍分别平行于 x′、y′；③ 长度规则：x 方向不变，y 方向减半。';
        n.classList.remove('hide');
        n.addEventListener('click', () => n.classList.add('hide'));
      }
      const host = ctx.root.querySelector('#p4-steps');
      if (host) window.UI.mountSteps(host, [
        { t: '在原图中取 AD 所在直线为 x 轴，AD 的垂直平分线 MN 为 y 轴，两轴交于 O。', why: '斜二测第（1）步：建立坐标系', keys: ['ax:x', 'ax:y'] },
        { t: '画对应的 x′ 轴与 y′ 轴，交于 O′，使 <b>∠x′O′y′ = 45°</b>（或 135°），它们确定的平面表示水平面。', why: '斜二测第（1）步：画轴', keys: ['ax:ang'] },
        { t: '在 x′ 轴上取 A′D′ = AD；在 y′ 轴上取 M′N′ = ½MN。', why: '斜二测第（3）步：横向不变、纵向减半', keys: ['tr:now', 'tr:A'] },
        { t: '以 N′ 为中点画 B′C′ ∥ x′ 轴且 B′C′ = BC；以 M′ 为中点画 F′E′ ∥ x′ 轴且 F′E′ = FE。', why: '斜二测第（2）步：平行性不变', keys: ['tr:B', 'tr:C', 'tr:E', 'tr:F'] },
        { t: '连接 A′B′、C′D′、D′E′、F′A′，擦去辅助线，得到正六边形水平放置的直观图。', why: '斜二测第（3）步：连线成图', keys: ['tr:now'] },
      ], ctx);
    },

    tip: `斜二测画法口诀：<b>“横不变、纵减半、斜 45°”</b>。所有平行于 x 轴、z 轴的线段长度不变；平行于 y 轴的线段长度变为原来的一半。`,
    tipMore: `拖动“转换”滑块，可以看到原图如何一步步“压扁、倾斜”成直观图；拖动“∠x′O′y′”滑块，可以对比 45° 与 135° 两种画法。注意：<b>斜二测只改变图形的位置与形状，不改变原图各边的真实长度</b>——直观图上的长度不能直接当作真实长度使用。`,

    tabs: {
      knowledge: `
        <h2 class="sec">8.2 立体图形的直观图 <span class="tag">斜二测画法</span></h2>
        <p class="lead">把空间图形画在平面内，既要画得有立体感，又要画得准确，常用<b>斜二测画法</b>。它画出的图叫空间图形的直观图。</p>
        <div class="theo">
          <div class="theo-t">斜二测画法的规则（教材 8.2）</div>
          <p>（1）在已知图形中取互相垂直的 x 轴和 y 轴，画直观图时，画成对应的 x′ 轴与 y′ 轴，两轴交于 O′，且使 <b>∠x′O′y′ = 45°（或 135°）</b>，它们确定的平面表示水平面。</p>
          <p>（2）已知图形中平行于 x 轴或 y 轴的线段，在直观图中分别画成平行于 x′ 轴或 y′ 轴的线段。</p>
          <p>（3）已知图形中平行于 x 轴的线段，在直观图中<b>保持原长度不变</b>；平行于 y 轴的线段，长度为<b>原来的一半</b>。</p>
        </div>
        <div class="note"><b>补充</b>　画立体图形（如棱柱）时，还要取 z 轴，z 轴与 x 轴垂直，<b>z 轴方向的长度不变</b>。所以完整口诀是：x、z 方向不变，y 方向减半。</div>
        <h3 class="sec-sub">教材例 1 · 水平放置的正六边形</h3>
        <ol>
          <li>在原图中取 AD 为 x 轴、MN 为 y 轴；</li>
          <li>画 x′、y′ 成 45°，取 A′D′ = AD，M′N′ = ½MN；</li>
          <li>以 N′、M′ 为中点画平行于 x′ 轴的 B′C′、F′E′；</li>
          <li>连线并擦去辅助线。</li>
        </ol>
        <h3 class="sec-sub">教材例 2 · 长方体（长 3、宽 2、高 1.5）</h3>
        <p class="lead">取过顶点 A 的三条棱所在直线为 x、y、z 轴。底面 ABCD 用斜二测画成平行四边形，再向上取高 1.5 cm 画上底面，最后连接侧棱。</p>
        <div class="formula-grid">
          <div class="fc"><div class="fc-t">x 方向</div><div class="fc-f">长度不变（长 3 cm）</div></div>
          <div class="fc"><div class="fc-t">y 方向</div><div class="fc-f">长度减半（宽 2 cm → 图上 1 cm）</div></div>
          <div class="fc"><div class="fc-t">z 方向</div><div class="fc-f">长度不变（高 1.5 cm）</div></div>
          <div class="fc"><div class="fc-t">圆</div><div class="fc-f">直观图一般画成椭圆</div></div>
        </div>
      `,
      example: `
        <h2 class="sec">典型例题 <span class="tag">斜二测</span></h2>
        <div class="card">
          <div class="example-head"><span class="no">例题</span><span class="src">教材 8.2 例 1 · 正六边形直观图</span></div>
          <p>用斜二测画法画水平放置的正六边形 ABCDEF 的直观图。</p>
        </div>
        <div id="p4-steps"></div>
        <div class="note">把左侧切到“正六边形”，拖动“转换”滑块，可以对着步骤逐步观察。</div>

        <h3 class="sec-sub">教材例 2 · 长方体的直观图</h3>
        <div class="card soft">
          <p>已知长方体的长、宽、高分别是 3 cm，2 cm，1.5 cm，用斜二测画法画出它的直观图。</p>
          <p><b>画法：</b>（1）画 x 轴、y 轴、z 轴，交于 O（A），使 ∠xOy = 45°，∠xOz = 90°；（2）在 x 轴上取 AB = 3 cm，在 y 轴上取 AD = 1 cm（宽的一半），在 z 轴上取 AA′ = 1.5 cm；（3）过 B、D 分别作平行线得底面 ABCD；（4）过 A′、B′、C′、D′ 画上底面；（5）连接侧棱，擦去辅助线。</p>
        </div>
      `,
      practice: `
        <h2 class="sec">练习 <span class="tag">还原与计算</span></h2>
        <div class="q">
          <div class="q-head"><span class="qn">1</span><span>边长为 2 的正方形，其斜二测直观图的面积是多少？</span></div>
          <button class="ans-btn" data-reveal>显示答案与步骤</button>
          <div class="ans">
            <div class="a-line"><b>答案</b>　面积 = √2。</div>
            <div class="sol-step" data-n="1">直观图是平行四边形，底边（x 方向）仍为 2。</div>
            <div class="sol-step" data-n="2">另一组对边原长 2，直观图中长为 2 × ½ = 1，且与底边成 45°。</div>
            <div class="sol-step" data-n="3">该边在底边方向上的高为 1 × sin45° = √2/2，故面积 S = 2 × √2/2 = √2。</div>
            <div class="sol-step" data-n="4">一般结论：<span class="hl2">S<sub>直观图</sub> = (√2/4)·S<sub>原图</sub></span>。这里 4 × √2/4 = √2，一致。</div>
          </div>
        </div>
        <div class="q">
          <div class="q-head"><span class="qn">2</span><span>某水平放置的平面图形的直观图是边长为 1 的正三角形，求原图形的面积。</span></div>
          <button class="ans-btn" data-reveal>显示答案与步骤</button>
          <div class="ans">
            <div class="a-line"><b>答案</b>　原图面积 = √6 / 2 ≈ 1.225。</div>
            <div class="sol-step" data-n="1">直观图面积 S′ = √3/4 × 1² = √3/4。</div>
            <div class="sol-step" data-n="2">由 S′ = (√2/4)S 得 S = (4/√2)S′ = 2√2 × √3/4 = √6/2。</div>
          </div>
        </div>
        <div class="q">
          <div class="q-head"><span class="qn">3</span><span>判断：直观图中，原图中长度为 4 且平行于 y 轴的线段，在直观图中的长度为 4。</span></div>
          <div class="opts">
            <button class="opt" data-ok="0"><span class="mk">A</span>正确</button>
            <button class="opt" data-ok="1"><span class="mk">B</span>错误，应为 2</button>
          </div>
          <div class="note" style="margin-left:26px">平行于 y 轴的线段在直观图中长度减半，4 → 2，方向与 x′ 轴成 45°。</div>
        </div>
        <div class="q">
          <div class="q-head"><span class="qn">4</span><span>（教材习题 8.2 第 1 题变式）用斜二测画法画水平放置的正三角形的直观图，若原正三角形边长为 a，求直观图中最长边的长度。</span></div>
          <button class="ans-btn" data-reveal>显示答案与步骤</button>
          <div class="ans">
            <div class="a-line"><b>答案</b>　最长边长为 a。</div>
            <div class="sol-step" data-n="1">取底边所在直线为 x 轴，底边在直观图中长度不变，仍为 a。</div>
            <div class="sol-step" data-n="2">另外两边原长 a，方向倾斜，画成直观图后长度变为 √((a/2)² + (√3a/4)²)= √(a²/4 + 3a²/16) = √(7a²/16) = (√7/4)a ≈ 0.66a。</div>
            <div class="sol-step" data-n="3">比较可知最长边就是底边，长度为 a。</div>
          </div>
        </div>
      `,
    },
  });
})();
