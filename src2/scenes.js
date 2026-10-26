/* =============================================================
   scenes.js · 20 章的三维演示场景
   每章一个场景对象：{ name, camera, anim, modes, build }
   build(t, ctx) → { items:[…], fit }
   ctx = { st, mode, params }
   ============================================================= */
(function () {
  'use strict';
  const E = window.Ink3D, G = window.Geo;
  const V = E.V, TAU = E.TAU;

  /* ---------------- 通用工具 ---------------- */
  const CAM2D = { yaw: -0.16, pitch: 0.06, zoom: 1.02, offset: [0, 0.95, 0], dist: 9.4, fov: 5.6 };
  const CAM3D = { yaw: -0.52, pitch: 0.26, zoom: 1.02, offset: [0, 0.95, 0], };
  const ink = st => G.ink(st);
  /* 机器参数读取：c.params 由左侧「实验室」面板写入；缺省时回到原演示 */
  const PV = (c, id, d) => { const v = c.params ? c.params[id] : null; return v == null ? d : (typeof v === 'boolean' ? (v ? 1 : 0) : +v); };
  const F2 = x => { if (!isFinite(x)) return '∞'; const v = Math.round(x * 100) / 100; return (Object.is(v, -0) ? 0 : v).toString(); };
  const Cnk = (n, k) => { if (k < 0 || k > n) return 0; let r = 1; for (let i = 1; i <= k; i++) r = r * (n - i + 1) / i; return Math.round(r); };
  const acc = st => G.accent(st);

  function curve(f, x0, x1, n, o) {
    o = o || {};
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const x = x0 + (x1 - x0) * i / n;
      const y = f(x);
      if (!isFinite(y)) continue;
      pts.push([x, y, o.z || 0]);
    }
    return E.poly(pts, {
      color: o.color || acc(o.st), sw: o.sw || 2.3, alpha: o.alpha == null ? 1 : o.alpha,
      key: o.key, tip: o.tip, dash: o.dash,
    });
  }

  function flatAxes(st, o) {
    o = o || {};
    const items = [];
    const xr = o.xr || 3.1, yu = o.yu || 2.6, yd = o.yd || 0.5;
    items.push(E.line([-xr, 0, 0], [xr, 0, 0], { color: ink(st), sw: 1.15, arrow: true, alpha: .8 }));
    items.push(E.line([0, -yd, 0], [0, yu, 0], { color: ink(st), sw: 1.15, arrow: true, alpha: .8 }));
    items.push(E.label([xr, 0, 0], 'x', { dx: 8, dy: 8, size: 12, align: 'left' }));
    items.push(E.label([0, yu, 0], 'y', { dx: 10, dy: -4, size: 12, align: 'left' }));
    items.push(E.label([0, 0, 0], 'O', { dx: -10, dy: 10, size: 11.5 }));
    return items;
  }

  function grid(st, o) {
    o = o || {};
    const items = [], xr = o.xr || 3, yr = o.yr || 2.4, step = o.step || 1;
    for (let x = -xr; x <= xr + 1e-6; x += step) {
      items.push(E.line([x, -0.2, 0], [x, yr, 0], { color: ink(st), sw: .55, alpha: .13 }));
    }
    for (let y = 0; y <= yr + 1e-6; y += step) {
      items.push(E.line([-xr, y, 0], [xr, y, 0], { color: ink(st), sw: .55, alpha: .13 }));
    }
    return items;
  }

  function frame3(st, o) {
    o = o || {};
    const L = o.len || 2.6, items = [];
    items.push(G.arrow([0, 0, 0], [L, 0, 0], { color: ink(st), sw: 1.5, key: 'ax:x' }));
    items.push(G.arrow([0, 0, 0], [0, L, 0], { color: ink(st), sw: 1.5, key: 'ax:y' }));
    items.push(G.arrow([0, 0, 0], [0, 0, L], { color: ink(st), sw: 1.5, key: 'ax:z' }));
    items.push(E.label([L, 0, 0], 'x', { dx: 9, dy: 6, size: 12, align: 'left' }));
    items.push(E.label([0, L, 0], 'y', { dx: 8, dy: -6, size: 12, align: 'left' }));
    items.push(E.label([0, 0, L], 'z', { dx: 12, dy: 2, size: 12, align: 'left' }));
    return items;
  }

  function bars(st, data, o) {
    o = o || {};
    const items = [];
    const w = o.w || 0.5, gap = o.gap || 0.28;
    const max = Math.max(...data.map(d => d.v)) || 1;
    const H = o.h || 2.1;
    data.forEach((d, i) => {
      const x = (i - (data.length - 1) / 2) * (w + gap);
      const h = Math.max(0.06, d.v / max * H);
      items.push(E.face([[x - w / 2, 0, w / 2], [x + w / 2, 0, w / 2], [x + w / 2, 0, -w / 2], [x - w / 2, 0, -w / 2]], {
        color: E.mix(G.tint(st, .05), '#ffffff', .3), alpha0: .55, edgeColor: 'transparent', sw: 0,
      }));
      const b = G.box({ st, w, h, d: w, cx: x, cy: 0, cz: 0, alpha: o.alpha == null ? 1 : o.alpha, tint: d.color || G.tint(st, .04), key: 'bar' + i });
      items.push(b.items);
      items.push(E.label([x, h + 0.13, 0], d.t, { size: 11, dy: -2, color: d.color || ink(st) }));
      if (o.axisLabel) items.push(E.label([x, -0.16, 0], d.l, { size: 10, dy: 10, color: ink(st) }));
    });
    return items;
  }

  function mark(st, p, text, o) {
    o = o || {};
    return [
      E.point(p, { r: o.r || 3.4, key: o.key, color: o.color }),
      E.label(p, text, { dx: o.dx == null ? 12 : o.dx, dy: o.dy == null ? -10 : o.dy, size: o.size || 11.5, align: o.align, color: o.color, key: o.key }),
    ];
  }

  /* ================= 01 方程求解 ================= */
  const EQ = {
    name: '方程 · 曲线与交点',
    camera: CAM2D,
    modes: [
      { id: 'quad', name: '二次方程', note: '<b>判别式</b> Δ=b²−4ac 决定抛物线与 x 轴的交点个数；交点横坐标就是方程的根。' },
      { id: 'cubic', name: '三次方程', note: '<b>三次方程</b>至少有一个实根：曲线必穿过 x 轴；三次函数的拐点把图象分成两段单调区间。' },
      { id: 'ratio', name: '分式与绝对值', note: '<b>等价变形</b>是解分式、绝对值方程的关键：先去分母、去绝对值，再验根。' },
    ],
    build(t, c) {
      const st = c.st, items = [grid(st, { xr: 3, yr: 2.4 }), ...flatAxes(st, { xr: 3.2, yu: 2.6, yd: 1.6 })];
      const GX = { gauges: null, verdict: null };
      if (c.mode === 'quad') {
        const qa = PV(c, 'a', 1), qb = PV(c, 'b', 0), qc = PV(c, 'c', -4);
        const f = x => 0.42 * (qa * x * x + qb * x + qc);
        items.push(curve(f, -2.75, 2.75, 160, { st }));
        const D = qb * qb - 4 * qa * qc;
        let roots = '无实根';
        if (Math.abs(qa) < 0.051) {
          roots = Math.abs(qb) < 0.051 ? '无解' : F2(-qc / qb);
          items.push(E.label([0, 2.25, 0], 'a≈0 · 抛物线塌成直线', { size: 11.5, color: acc(st), dy: -4 }));
          GX.verdict = { text: '推过头：a→0 后它不再是二次方程，判别式这台机器随之失效——先确认次数，再谈 Δ。', danger: true };
        } else {
          const xv = -qb / (2 * qa), yv = f(xv);
          items.push(E.line([xv, Math.min(0, yv), 0], [xv, Math.max(0, yv), 0], { color: acc(st), sw: 1, dash: [6, 5], alpha: .5 }));
          items.push(E.point([xv, yv, 0], { r: 2.8, color: acc(st) }));
          items.push(E.label([xv, yv, 0], '顶点', { size: 10.5, dx: 12, dy: yv < 0 ? 16 : -12, align: 'left' }));
          if (D > 0.001) {
            const r1 = (-qb - Math.sqrt(D)) / (2 * qa), r2 = (-qb + Math.sqrt(D)) / (2 * qa);
            [r1, r2].forEach(x => { if (Math.abs(x) <= 2.9) items.push(...mark(st, [x, 0, 0], 'x=' + F2(x), { dx: x < 0 ? -26 : 16, dy: -14 })); });
            roots = F2(r1) + ' , ' + F2(r2);
            items.push(E.label([0, -1.3, 0], 'Δ>0 · 两个不等实根', { size: 11.5, color: acc(st), dy: 4 }));
          } else if (D >= -0.001) {
            roots = F2(xv) + '（重根）';
            items.push(E.label([0, -1.3, 0], 'Δ=0 · 相切，只剩一个重根', { size: 11.5, color: acc(st), dy: 4 }));
            GX.verdict = { text: '临界点：Δ=0 时两根合一。把 c 再推过一点点，根就从数轴上消失。', danger: false };
          } else {
            items.push(E.label([0, -1.3, 0], 'Δ<0 · 曲线够不到 x 轴', { size: 11.5, color: acc(st), dy: 4 }));
            GX.verdict = { text: '推过头：Δ<0 不是算错——实根不存在了；它们躲进了复平面（去第 05 章把 z 拖出来看）。', danger: true };
          }
          GX.gauges = [['系数 a·b·c', qa + ' · ' + qb + ' · ' + qc], ['Δ=b²−4ac', F2(D)], ['实根', roots], ['顶点 x₀', F2(xv)]];
        }
        if (!GX.gauges) GX.gauges = [['系数 a·b·c', qa + ' · ' + qb + ' · ' + qc], ['Δ=b²−4ac', F2(D)], ['实根', roots]];
      } else if (c.mode === 'cubic') {
        const f = x => 0.42 * (x * x * x - 3 * x);
        items.push(curve(f, -2.5, 2.5, 160, { st }));
        [-Math.sqrt(3), 0, Math.sqrt(3)].forEach((x, i) => items.push(...mark(st, [x, 0, 0], ['x₁', 'x₂', 'x₃'][i] + '=' + (i === 1 ? '0' : (x < 0 ? '−√3' : '√3')), { dx: i === 1 ? 14 : -26, dy: -14 })));
        items.push(E.label([0, 2.3, 0], '曲线穿过 x 轴三次', { size: 11.5, color: acc(st), dy: 12 }));
      } else {
        const f = x => (x === 1 ? NaN : 1.1 / (x - 1) + 0.5);
        items.push(curve(f, -2.6, 0.86, 80, { st }));
        items.push(curve(f, 1.14, 3.0, 80, { st }));
        items.push(E.line([1, -1.4, 0], [1, 2.5, 0], { color: ink(st), sw: 1, dash: [5, 5], alpha: .5 }));
        items.push(E.label([1, 2.35, 0], 'x=1 渐近线', { size: 10.5, dx: 46, dy: 0, align: 'left' }));
        items.push(...mark(st, [0.1, -0.72, 0], '根', { dx: -14, dy: 4 }));
        items.push(E.label([-2.2, 2.15, 0], '定义域 x≠1', { size: 11, color: acc(st), align: 'left' }));
      }
      return { items, fit: 1, gauges: GX.gauges, verdict: GX.verdict };
    },
  };

  /* ================= 02 集合 ================= */
  const SET = {
    name: '集合 · 交集与覆盖',
    camera: { yaw: -0.5, pitch: 0.22, zoom: 1.0, offset: [0, 0.9, 0] },
    modes: [
      { id: 'venn', name: '三集合', note: '<b>韦恩图</b>：三个集合互相重叠，重叠区域就是交集；把元素写进对应区域，关系一目了然。' },
      { id: 'union', name: '并集 A∪B', note: '<b>并集</b>把两个集合的元素合并去重；<b>交集</b>只保留公共元素。' },
      { id: 'comp', name: '补集 ∁', note: '<b>补集</b>先要明确全集 U：∁<sub>U</sub>A = {x∈U | x∉A}。' },
    ],
    build(t, c) {
      const st = c.st, items = [];
      const GX = { gauges: null, verdict: null };
      const a = PV(c, 'sep', .45), R = 1.02;
      const cols = [G.tint(st, .1), G.tint(st, .2), G.tint(st, .3)];
      const c1 = [-a, 1.05, 0], c2 = [a, 1.05, 0], c3 = [0, 1.05 + a * 0.9, -a * .6];
      items.push(E.ball(c1, R, { color: c.mode === 'union' ? acc(st) : cols[0], alpha: .78, key: 's:A' }));
      items.push(E.ball(c2, R, { color: c.mode === 'union' ? acc(st) : cols[1], alpha: .78, key: 's:B' }));
      items.push(E.ball(c3, R * .95, { color: c.mode === 'comp' ? acc(st) : cols[2], alpha: .72, key: 's:C' }));
      const d = 13;
      items.push(E.label([c1[0] - R * .72, c1[1] + R * .6, c1[2]], 'A', { dx: -d, dy: -d, size: 16, key: 's:A' }));
      items.push(E.label([c2[0] + R * .72, c2[1] + R * .6, c2[2]], 'B', { dx: d, dy: -d, size: 16, key: 's:B' }));
      items.push(E.label([c3[0], c3[1] + R * .82, c3[2]], 'C', { dx: 0, dy: -12, size: 16, key: 's:C' }));
      items.push(E.label([0, 1.05, 0], 'A∩B', { size: 11.5, color: '#ffffff' }));
      /* 12 个固定元素点：落在哪个球里由当前圆心距离说了算，计数与图形同源 */
      const elems = [[-1.15, 1.5], [-0.75, 0.75], [-0.3, 1.35], [0, 1.05], [0.3, 0.8], [0.7, 1.45], [1.15, 0.9], [-0.55, 1.8], [0.55, 1.75], [0, 0.45], [-1.3, 0.6], [1.3, 1.5]];
      let nA = 0, nB = 0, nAB = 0;
      elems.forEach(([x, y]) => {
        const inA = Math.hypot(x - c1[0], y - c1[1]) <= R, inB = Math.hypot(x - c2[0], y - c2[1]) <= R;
        if (inA) nA++; if (inB) nB++; if (inA && inB) nAB++;
        items.push(E.point([x, y, 0.06], { r: inA && inB ? 3.6 : 2.6, color: inA && inB ? acc(st) : (inA || inB ? ink(st) : '#b9ac93') }));
      });
      const txt = c.mode === 'union' ? 'A∪B = {x | x∈A 或 x∈B}' : c.mode === 'comp' ? '∁ᵤA = {x∈U | x∉A}' : 'A∩B∩C ≠ ∅ 表示三者有公共元素';
      items.push(E.label([0, 0.12, 0], txt, { size: 11.5, color: ink(st), dy: 14 }));
      GX.gauges = [['圆心距 2a', F2(2 * a)], ['|A|（点数）', nA], ['|B|（点数）', nB], ['|A∩B|', nAB], ['|A∪B|', nA + nB - nAB]];
      if (nAB === 0) GX.verdict = { text: '推过头：两球分开到没有公共元素，A∩B=∅——交集为空不等于集合不存在。', danger: true };
      return { items, fit: 1.02, gauges: GX.gauges, verdict: GX.verdict };
    },
  };

  /* ================= 03 不等式 ================= */
  const INEQ = {
    name: '不等式 · 区域与均值',
    camera: { yaw: -0.42, pitch: 0.34, zoom: 1.0, offset: [0, 0.75, 0] },
    modes: [
      { id: 'region', name: '平面区域', note: '<b>二元一次不等式</b>对应半平面：边界画实线（含等号）或虚线（不含），再取一个点验算确定哪一侧。' },
      { id: 'amgm', name: '均值不等式', note: '(a+b)² = a²+2ab+b² ≥ 4ab，即 a+b ≥ 2√(ab)：把面积拆成四块就能“看见”均值不等式。' },
      { id: 'cauchy', name: '柯西不等式', note: '柯西不等式 (a₁b₁+a₂b₂)² ≤ (a₁²+a₂²)(b₁²+b₂²)：向量内积不超过模长之积。' },
    ],
    build(t, c) {
      const st = c.st, items = [];
      const GX = { gauges: null, verdict: null };
      if (c.mode === 'region') {
        const P = [[0, 0, 0], [3, 0, 0], [0, 2.2, 0]];
        items.push(E.face(P, { color: G.tint(st, .12), alpha0: .5, edgeColor: acc(st), sw: 2, key: 'in:reg', tip: '满足 x≥0,y≥0,x+y≤3 的区域' }));
        items.push(E.line([-0.4, 0, 0], [3.4, 0, 0], { color: ink(st), sw: 1.3, arrow: true }));
        items.push(E.line([0, -0.4, 0], [0, 2.7, 0], { color: ink(st), sw: 1.3, arrow: true }));
        items.push(E.line([3.2, -0.15, 0], [-0.25, 2.6, 0], { color: acc(st), sw: 1.8, dash: [6, 4] }));
        items.push(E.label([1.5, 1.85, 0], 'x+y=3', { size: 11.5, color: acc(st), dx: 26, dy: -6, align: 'left' }));
        items.push(E.label([0.95, 0.62, 0], '可行域', { size: 12.5, color: ink(st), dx: 4, dy: 4 }));
        items.push(...mark(st, [3, 0, 0], 'x=3', { dx: 10, dy: 10 }));
        items.push(...mark(st, [0, 2.2, 0], 'y=2.2', { dx: -14, dy: -10 }));
      } else if (c.mode === 'amgm') {
        const a = PV(c, 'a', 1.55), b = PV(c, 'b', 0.85);
        const y = .02;
        const quad = (x0, x1, z0, z1, col, txt) => {
          items.push(E.face([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], {
            color: col, alpha0: .52, edgeColor: ink(st), sw: 1.2,
          }));
          items.push(E.label([(x0 + x1) / 2, y, (z0 + z1) / 2], txt, { size: 12, dy: 2 }));
        };
        quad(0, a, 0, a, G.tint(st, .1), 'a²');
        quad(a, a + b, 0, a, G.tint(st, .22), 'ab');
        quad(0, a, a, a + b, G.tint(st, .22), 'ab');
        quad(a, a + b, a, a + b, G.tint(st, .34), 'b²');
        items.push(E.label([(a + b) / 2, 0.02, -0.32], 'a + b', { size: 12, color: acc(st), dy: 8 }));
        items.push(E.label([a + b + 0.28, 0.02, (a + b) / 2], 'a + b', { size: 12, color: acc(st), dx: 14 }));
        items.push(E.label([0, 0.02, a + b + 0.42], '(a+b)² ≥ 4ab  ⟺  a+b ≥ 2√(ab)', { size: 12, color: acc(st), dy: -6 }));
        GX.gauges = [['a + b', F2(a + b)], ['2√(ab)', F2(2 * Math.sqrt(a * b))], ['差 (a+b)−2√ab', F2(a + b - 2 * Math.sqrt(a * b))], ['取等条件', Math.abs(a - b) < 0.051 ? 'a = b ✓' : 'a ≠ b']];
        if (Math.abs(a - b) < 0.051) GX.verdict = { text: '取等点：a=b 时四个小块拼成无缝正方形，均值不等式变成等式。用之前先查取等条件。', danger: false };
      } else {
        const th = PV(c, 'ang', 68) * Math.PI / 180;
        const a = [2.35, 0.85, 0], b = V.mul([Math.cos(th), Math.sin(th), 0], 2.3);
        items.push(G.arrow([0, 0, 0], a, { color: ink(st), sw: 2, key: 'cv:a' }));
        items.push(G.arrow([0, 0, 0], b, { color: acc(st), sw: 2, key: 'cv:b' }));
        items.push(E.label(V.mul(a, .6), 'a', { dx: 12, dy: -6, size: 13 }));
        items.push(E.label(V.mul(b, .62), 'b', { dx: -6, dy: -10, size: 13, color: acc(st) }));
        const proj = V.mul(b, V.dot(a, b) / V.dot(b, b));
        items.push(E.line([a[0], a[1], 0], [proj[0], proj[1], 0], { color: acc(st), sw: 1, dash: [5, 4], alpha: .8 }));
        items.push(E.label(V.mul(V.add(a, proj), .5), 'a·b = |a||b|cosθ', { size: 11.5, color: acc(st), dx: 30, dy: 14, align: 'left' }));
        items.push(E.angle([0, 0, 0], a, b, 'θ', { color: ink(st) }));
        const dt = V.dot(a, b), mx = Math.hypot(a[0], a[1]) * Math.hypot(b[0], b[1]);
        GX.gauges = [['夹角 θ', F2(PV(c, 'ang', 68)) + '°'], ['a·b', F2(dt)], ['|a||b|cosθ', F2(mx * Math.cos(Math.atan2(b[1], b[0]) - Math.atan2(a[1], a[0])))], ['|a·b| ≤ |a||b|', Math.abs(dt) <= mx + 1e-9 ? '成立' : '?!']];
        if (Math.abs(dt) < 0.08) GX.verdict = { text: '临界点：θ=90° 时 a·b=0——柯西不等式在这里给出最紧的“垂直”判据。', danger: false };
      }
      return { items, fit: 1.02, gauges: GX.gauges, verdict: GX.verdict };
    },
  };

  /* ================= 04 函数 ================= */
  const FUNC = {
    name: '函数 · 图象与性质',
    camera: CAM2D,
    modes: [
      { id: 'quad', name: '二次函数', note: '<b>二次函数</b> y=ax²+bx+c：对称轴 x=−b/2a，顶点 (−b/2a, (4ac−b²)/4a)，a 的符号决定开口。' },
      { id: 'exp', name: '指数与对数', note: '<b>指数函数</b>与<b>对数函数</b>互为反函数，图象关于 y=x 对称。' },
      { id: 'tick', name: '对勾函数', note: 'y = x + a/x（a>0）在 (0,√a) 上递减、(√a,+∞) 上递增，最低点 2√a。' },
      { id: 'piece', name: '分段函数', note: '<b>分段函数</b>要在分段点分别求值，注意端点是否取到（实心/空心点）。' },
    ],
    build(t, c) {
      const st = c.st, items = [grid(st, { xr: 3, yr: 2.6 }), ...flatAxes(st, { xr: 3.2, yu: 2.8, yd: 1.4 })];
      const GX = { gauges: null, verdict: null };
      if (c.mode === 'quad') {
        const qa = PV(c, 'a', 1), qb = PV(c, 'b', -1.9), qc = PV(c, 'c', -0.9);
        const f = x => 0.6 * (qa * x * x + qb * x + qc);
        items.push(curve(f, -2.4, 2.4, 140, { st }));
        if (Math.abs(qa) > 0.051) {
          const xv = -qb / (2 * qa);
          items.push(E.line([xv, -1.3, 0], [xv, 2.4, 0], { color: ink(st), sw: 1, dash: [6, 5], alpha: .55 }));
          items.push(E.label([xv, 2.5, 0], 'x = −b/2a', { size: 11, dx: 42, dy: 0, align: 'left' }));
          items.push(...mark(st, [xv, f(xv), 0], '顶点', { dx: 14, dy: 14, color: acc(st) }));
          GX.gauges = [['开口', qa > 0 ? '向上' : '向下'], ['对称轴 x', F2(xv)], ['顶点 y', F2(f(xv) / 0.6)], ['f(0)=c', F2(qc)]];
          if (qa < 0) GX.verdict = { text: '推过头：a<0 整个图象翻面，顶点由最低点变最高点——“开口”先于一切计算。', danger: true };
        }
      } else if (c.mode === 'exp') {
        const bs = PV(c, 'base', 2);
        items.push(curve(x => 0.42 * Math.pow(bs, x), -2.3, 3, 120, { st, key: 'f:exp' }));
        items.push(curve(x => x > 0 ? 0.72 * Math.log(x) / Math.log(bs) : NaN, 0.06, 3, 140, { st, color: acc(st) }));
        GX.gauges = [['底数 a', F2(bs)], ['a²', F2(bs * bs)], ['logₐ(a³)', '3'], ['定义域', bs > 1 ? '指数增 / 对数增' : '0<a<1 · 递减']];
        if (bs < 1) GX.verdict = { text: '推过头：底数掉到 1 以下，两条曲线同时由增变减；a≤0 时这台机器直接不存在。', danger: true };
        items.push(E.line([-2.4, -1.2, 0], [2.4, 2.4, 0], { color: ink(st), sw: 1, dash: [5, 4], alpha: .5 }));
        items.push(E.label([2.3, 2.3, 0], 'y = x', { size: 10.5, dx: 26, dy: -8, align: 'left' }));
        items.push(E.label([1.5, 0.28, 0], 'y = 2ˣ', { size: 11.5, color: acc(st), dx: 8, dy: 14 }));
        items.push(E.label([2.0, 1.0, 0], 'y = log₂x', { size: 11.5, color: acc(st), dx: 20, dy: 10, align: 'left' }));
        items.push(E.point([0, 1, 0], { r: 3.2, color: ink(st) }));
        items.push(E.label([0, 1, 0], '(0,1)', { size: 10, dx: 22, dy: -8, align: 'left' }));
        items.push(E.point([1, 0, 0], { r: 3.2, color: ink(st) }));
        items.push(E.label([1, 0, 0], '(1,0)', { size: 10, dx: 4, dy: 14 }));
      } else if (c.mode === 'tick') {
        const ta = PV(c, 'a', 0.7);
        const f = x => x + ta / x;
        items.push(curve(f, 0.28, 3.0, 120, { st }));
        items.push(curve(f, -3.0, -0.28, 120, { st }));
        const m = Math.sqrt(ta);
        GX.gauges = [['参数 a', F2(ta)], ['最低点 x=√a', F2(m)], ['最小值 2√a', F2(2 * m)], ['渐近线', 'x=0 · y=x']];
        items.push(E.line([m, 0, 0], [m, 2 * m, 0], { color: acc(st), sw: 1, dash: [4, 4] }));
        items.push(...mark(st, [m, 2 * m, 0], '最低点 (√a, 2√a)', { dx: 12, dy: -14, color: acc(st) }));
        items.push(E.line([-3, 0, 0], [-0.2, 0, 0], { color: ink(st), sw: 2, alpha: .3 }));
        items.push(E.label([2.2, 2.3, 0], 'y = x + a/x', { size: 12, color: acc(st), dx: 30, dy: -6, align: 'left' }));
      } else {
        items.push(curve(x => 0.7 * x + 1.1, -2.2, 0, 1, { st }));
        items.push(curve(x => 0.275 * x * x + 0.55, 0, 2.3, 60, { st }));
        items.push(E.point([0, 1.1, 0], { r: 3.4, color: acc(st), ring: true }));
        items.push(E.point([0, 0.55, 0], { r: 3.0, color: ink(st) }));
        items.push(E.line([0, -0.2, 0], [0, 2.2, 0], { color: ink(st), sw: 1, dash: [5, 4], alpha: .5 }));
        items.push(E.label([0, 2.3, 0], '分段点 x=0', { size: 11, dx: 26, dy: 2, align: 'left' }));
        items.push(E.label([-1.55, 1.55, 0], '实心：取到', { size: 10.5, color: acc(st), dx: -6, dy: -10, align: 'right' }));
        items.push(E.label([1.5, 1.0, 0], '空心：不取', { size: 10.5, color: ink(st), dx: 10, dy: 12, align: 'left' }));
      }
      return { items, fit: 1, gauges: GX.gauges, verdict: GX.verdict };
    },
  };

  /* ================= 05 基本计算 ================= */
  const CALC = {
    name: '计算 · 对数与复平面',
    camera: { yaw: -0.2, pitch: 0.1, zoom: 1.02, offset: [0, 0.95, 0], dist: 9.6, fov: 6.0 },
    modes: [
      { id: 'log', name: '对数', note: '<b>对数</b>把乘法变成加法：log(ab)=log a+log b；对数刻度让 1、10、100、1000 等距排列。' },
      { id: 'complex', name: '复平面', note: '<b>复数</b> z=a+bi 对应复平面上的一点，模 |z|=√(a²+b²)，辐角是向量与实轴的夹角。' },
      { id: 'rot', name: '复数乘法', note: '复数相乘：<b>模相乘、辐角相加</b>。乘以 i 就是逆时针转 90°，乘两次回到相反数。' },
    ],
    build(t, c) {
      const st = c.st, items = [];
      const GX = { gauges: null, verdict: null };
      if (c.mode === 'log') {
        items.push(E.line([-2.4, 0, 0], [2.6, 0, 0], { color: ink(st), sw: 1.4, arrow: true }));
        [[-2, '0.01'], [-1, '0.1'], [0, '1'], [1, '10'], [2, '100']].forEach(([x, s2]) => {
          items.push(E.line([x, -0.08, 0], [x, 0.08, 0], { color: ink(st), sw: 1.6 }));
          items.push(E.label([x, -0.2, 0], s2, { size: 11, dy: 10 }));
        });
        items.push(E.label([0, 0.75, 0], '等比 → 等距', { size: 12.5, color: acc(st), dy: -6 }));
        items.push(E.label([0, 0.35, 0], 'log₁₀(ab) = log₁₀a + log₁₀b', { size: 11, dy: 4 }));
        items.push(E.label([0, -0.72, 0], 'aᵐ·aⁿ = aᵐ⁺ⁿ', { size: 11, dy: 8 }));
      } else {
        items.push(E.line([-2.0, 0, 0], [2.4, 0, 0], { color: ink(st), sw: 1.2, arrow: true, alpha: .85 }));
        items.push(E.line([0, -1.9, 0], [0, 2.2, 0], { color: ink(st), sw: 1.2, arrow: true, alpha: .85 }));
        items.push(E.label([2.45, 0, 0], '实轴', { size: 10.5, dx: 22, align: 'left' }));
        items.push(E.label([0, 2.3, 0], '虚轴', { size: 10.5, dx: -22, align: 'right' }));
        const draw = (a, b, col, txt, key) => {
          const P = [a, b, 0];
          items.push(E.line([0, 0, 0], P, { color: col, sw: 2.2, arrow: true, key }));
          items.push(E.point(P, { r: 3.6, color: col, key }));
          items.push(E.label(P, txt, { size: 11.5, dx: 12, dy: -10, align: 'left', color: col }));
          items.push(E.line([a, 0, 0], P, { color: col, sw: .9, dash: [4, 4], alpha: .6 }));
          items.push(E.line([0, b, 0], P, { color: col, sw: .9, dash: [4, 4], alpha: .6 }));
          return P;
        };
        if (c.mode === 'complex') {
          const za = PV(c, 're', 1.25), zb = PV(c, 'im', 1.45);
          const P = draw(za, zb, acc(st), 'z = a + bi', 'cp:z');
          GX.gauges = [['z', F2(za) + (zb < 0 ? ' − ' : ' + ') + F2(Math.abs(zb)) + 'i'], ['|z| = √(a²+b²)', F2(Math.hypot(za, zb))], ['辐角 arg z', F2(Math.atan2(zb, za) * 180 / Math.PI) + '°'], ['z·z̄ = |z|²', F2(za * za + zb * zb)]];
          if (Math.abs(za) < 0.05 && Math.abs(zb) < 0.05) GX.verdict = { text: '推过头：z 拖回原点，辐角失去定义——0 没有方向。', danger: true };
          items.push(E.label([za / 2, -0.18, 0], 'a', { size: 11, dy: 12 }));
          items.push(E.label([-0.22, zb / 2, 0], 'b', { size: 11, dx: -12 }));
          items.push(E.label([0.62, 0.78, 0], '|z|', { size: 11, dx: 14, dy: 2, color: acc(st) }));
          const arc = [];
          for (let i = 0; i <= 30; i++) {
            const a2 = Math.atan2(zb, za) * i / 30;
            arc.push([0.42 * Math.cos(a2), 0.42 * Math.sin(a2), 0]);
          }
          items.push(E.poly(arc, { color: ink(st), sw: 1.1 }));
          items.push(E.label([0.52, 0.2, 0], 'θ', { size: 11, dx: 10, dy: -6 }));
          items.push(E.label([0, -1.35, 0], 'z = r(cosθ + i sinθ)', { size: 11.5, color: acc(st), dy: 6 }));
        } else {
          const kk = Math.round(PV(c, 'k', 1));
          const rotZ = (a, b, k) => { for (let i = 0; i < k; i++) { const na = -b, nb = a; a = na; b = nb; } return [a, b]; };
          const rp = rotZ(1.45, 0.55, kk);
          const z1 = draw(1.45, 0.55, ink(st), 'z₁', 'cp:1');
          const z2 = draw(rp[0], rp[1], acc(st), 'z₂ = i^' + kk + '·z₁', 'cp:2');
          GX.gauges = [['连乘 i 的次数', kk], ['辐角增量', (90 * kk) + '°'], ['|z₂|（模不变）', F2(Math.hypot(rp[0], rp[1]))], ['i⁴', '1（转满一圈）']];
          if (kk === 2) GX.verdict = { text: '临界点：i²=−1——乘两次等于转 180°，这就是“负数”的几何长相。', danger: false };
          items.push(E.line(z1, z2, { color: ink(st), sw: .8, dash: [4, 5], alpha: .5 }));
          items.push(E.label([1.1, 1.45, 0], '模 ×1，辐角 +90°', { size: 11, color: acc(st), dx: 20, dy: -4, align: 'left' }));
          items.push(E.label([0.2, -1.4, 0], 'i² = −1：连乘两次转 180°', { size: 11, dy: 8 }));
        }
      }
      return { items, fit: 1.02, gauges: GX.gauges, verdict: GX.verdict };
    },
  };

  /* ================= 06 三角恒等变换 ================= */
  const TRIG = {
    name: '三角 · 单位圆上的旋转',
    camera: { yaw: -0.14, pitch: 0.05, zoom: 1.04, offset: [0, 0.95, 0], dist: 9.4, fov: 5.9 },
    anim: true,
    modes: [
      { id: 'circle', name: '单位圆', note: '<b>单位圆</b>上点 P 的坐标就是 (cosθ, sinθ)；角每转一周，三角函数值重复一次。' },
      { id: 'sum', name: '和角公式', note: '<b>和角公式</b> sin(α+β)=sinαcosβ+cosαsinβ、cos(α+β)=cosαcosβ−sinαsinβ 可由单位圆上的旋转叠加得到。' },
      { id: 'wave', name: '波形', note: '把单位圆上的纵坐标“摊开”，就得到正弦曲线；振幅、周期、初相决定波形。' },
    ],
    build(t, c) {
      const st = c.st, items = [];
      const GX = { gauges: null, verdict: null };
      if (c.mode === 'wave') {
        items.push(...flatAxes(st, { xr: 3.4, yu: 1.7, yd: 1.7 }));
        const Amp = PV(c, 'A', 1.25), om = PV(c, 'om', 1.8);
        const f = x => Math.sin(x * om) * Amp;
        items.push(curve(f, -Math.PI, Math.PI * 1.35, 200, { st, sw: 2.4 }));
        const th = t * 0.9;
        const x = (th % (TAU / om)) - Math.PI * 0.5;
        items.push(E.point([x, f(x), 0], { r: 4.2, color: acc(st), ring: true }));
        items.push(E.line([x, 0, 0], [x, f(x), 0], { color: acc(st), sw: 1, dash: [4, 3], alpha: .8 }));
        items.push(E.label([0, 1.62, 0], 'y = A sin(ωx + φ)', { size: 12.5, color: acc(st), dy: -6 }));
        [-Amp, Amp].forEach(y => items.push(E.line([-3.2, y, 0], [3.2, y, 0], { color: ink(st), sw: 1, dash: [3, 6], alpha: .35 })));
        items.push(E.label([3.05, Amp - 0.15, 0], 'A', { size: 11, color: ink(st), dx: 8, dy: -10, align: 'left' }));
        GX.gauges = [['振幅 A', F2(Amp)], ['ω', F2(om)], ['周期 T=2π/ω', F2(TAU / om)], ['值域', '[−' + F2(Amp) + ', ' + F2(Amp) + ']']];
      } else {
        items.push(E.poly(circlePts(1.35, 96), { closed: true, color: ink(st), sw: 1.5 }));
        items.push(E.line([-1.75, 0, 0], [1.85, 0, 0], { color: ink(st), sw: 1.1, arrow: true, alpha: .8 }));
        items.push(E.line([0, -1.75, 0], [0, 1.85, 0], { color: ink(st), sw: 1.1, arrow: true, alpha: .8 }));
        items.push(E.label([1.9, 0, 0], 'x', { size: 11, dx: 6, dy: 6, align: 'left' }));
        items.push(E.label([0, 1.9, 0], 'y', { size: 11, dx: 8, dy: -4, align: 'left' }));
        items.push(E.label([-0.12, -0.1, 0], 'O', { size: 11, dx: -6, dy: 10 }));
        const R = 1.35;
        const thDeg = PV(c, 'th', c.mode === 'sum' ? 36 : 42);
        const th = c.mode === 'sum' ? PV(c, 'al', 36) * Math.PI / 180 : thDeg * Math.PI / 180;
        const be = c.mode === 'sum' ? PV(c, 'be', 28) * Math.PI / 180 : 0;
        {
          const td = (c.mode === 'sum' ? PV(c, 'al', 36) + PV(c, 'be', 28) : thDeg);
          const tr = td * Math.PI / 180, tanV = Math.tan(tr);
          GX.gauges = c.mode === 'sum'
            ? [['α', F2(PV(c, 'al', 36)) + '°'], ['β', F2(PV(c, 'be', 28)) + '°'], ['sin(α+β)', F2(Math.sin(tr))], ['sinαcosβ+cosαsinβ', F2(Math.sin(PV(c, 'al', 36) * Math.PI / 180) * Math.cos(PV(c, 'be', 28) * Math.PI / 180) + Math.cos(PV(c, 'al', 36) * Math.PI / 180) * Math.sin(PV(c, 'be', 28) * Math.PI / 180))]]
            : [['θ', F2(thDeg) + '°'], ['sinθ', F2(Math.sin(tr))], ['cosθ', F2(Math.cos(tr))], ['tanθ', Math.abs(Math.cos(tr)) < 0.02 ? '不存在→∞' : F2(tanV)]];
          if (c.mode !== 'sum' && Math.abs(Math.cos(tr)) < 0.09) GX.verdict = { text: '推过头：θ→90° 时点跑到圆顶，tanθ 的分母 cosθ→0，正切冲向无穷——图上那条竖线就是渐近线。', danger: true };
        }
        const P = [R * Math.cos(th), R * Math.sin(th), 0];
        items.push(E.line([0, 0, 0], P, { color: acc(st), sw: 2.2, key: 'tg:r' }));
        items.push(E.point(P, { r: 4, color: acc(st) }));
        items.push(E.label(P, 'P', { dx: 12, dy: -10, size: 12, color: acc(st) }));
        items.push(E.line(P, [P[0], 0, 0], { color: ink(st), sw: 1, dash: [5, 4], alpha: .7 }));
        items.push(E.line(P, [0, P[1], 0], { color: ink(st), sw: 1, dash: [5, 4], alpha: .7 }));
        items.push(E.label([P[0] * 0.52, -0.14, 0], 'cosθ', { size: 11, dy: 15 }));
        items.push(E.label([P[0] * 0.42, P[1] * 0.55, 0], 'sinθ', { size: 11, dx: -6, dy: -2, align: 'right' }));
        // 角的弧
        const arc = [];
        for (let i = 0; i <= 40; i++) {
          const a = th * i / 40;
          arc.push([0.42 * Math.cos(a), 0.42 * Math.sin(a), 0]);
        }
        items.push(E.poly(arc, { color: ink(st), sw: 1.2 }));
        items.push(E.label([0.5 * Math.cos(th / 2), 0.5 * Math.sin(th / 2), 0], 'θ', { size: 12, dx: 10, dy: -10 }));
        if (c.mode === 'sum') {
          const Q = [R * Math.cos(th + be), R * Math.sin(th + be), 0];
          items.push(E.line([0, 0, 0], Q, { color: G.ink(st), sw: 1.6, dash: [5, 4] }));
          items.push(E.point(Q, { r: 3.4 }));
          items.push(E.label(Q, 'Q', { dx: 12, dy: 12, size: 12 }));
          const arc2 = [];
          for (let i = 0; i <= 30; i++) {
            const a = th + be * i / 30;
            arc2.push([0.62 * Math.cos(a), 0.62 * Math.sin(a), 0]);
          }
          items.push(E.poly(arc2, { color: acc(st), sw: 1.2 }));
          items.push(E.label([0.78 * Math.cos(th + be / 2), 0.78 * Math.sin(th + be / 2), 0], 'β', { size: 11, dx: 10, dy: 6 }));
          items.push(E.label([0, -1.72, 0], 'sin(α+β)=sinαcosβ+cosαsinβ', { size: 11.5, color: acc(st), dy: 6 }));
        }
      }
      return { items, fit: 1.02, gauges: GX.gauges, verdict: GX.verdict };
    },
  };

  function circlePts(r, n, cy) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU;
      out.push([r * Math.cos(a), (cy || 0) + r * Math.sin(a), 0]);
    }
    return out;
  }

  /* ================= 07 平面向量 ================= */
  const VEC = {
    name: '向量 · 加法与数量积',
    camera: { yaw: -0.34, pitch: 0.2, zoom: 1.02, offset: [0, 0.7, 0] },
    modes: [
      { id: 'add', name: '平行四边形法则', note: '<b>向量加法</b>遵循平行四边形法则：a+b 是以 a、b 为邻边的平行四边形的对角线。' },
      { id: 'dot', name: '数量积', note: '<b>数量积</b> a·b = |a||b|cosθ = x₁x₂+y₁y₂；a·b=0 ⇔ 两向量垂直。' },
      { id: 'proj', name: '投影', note: '<b>投影向量</b>是把 a 沿 b 方向“压扁”：|a|cosθ 有正负，投影长为负数时方向与 b 相反。' },
    ],
    build(t, c) {
      const st = c.st, items = [];
      const GX = { gauges: null, verdict: null };
      const thv = PV(c, 'ang', 62) * Math.PI / 180;
      const a = [2.1, 0.7, 0], b = V.mul([Math.cos(thv + Math.atan2(0.7, 2.1)), Math.sin(thv + Math.atan2(0.7, 2.1)), 0], 2.05), s = V.add(a, b);
      {
        const dt = V.dot(a, b);
        GX.gauges = [['夹角 θ', F2(PV(c, 'ang', 62)) + '°'], ['a·b', F2(dt)], ['|a|·|b|', F2(Math.hypot(2.1, 0.7) * 2.05)], ['投影长 a·b/|b|', F2(dt / 2.05)]];
        if (Math.abs(dt) < 0.1) GX.verdict = { text: '临界点：θ=90° ⇒ a·b=0。把角度推过 90°，投影立刻反向、数量积变负——符号就是方向。', danger: true };
      }
      items.push(E.line([-0.4, 0, 0], [3.4, 0, 0], { color: ink(st), sw: 1, alpha: .3 }));
      items.push(E.line([0, -0.4, 0], [0, 2.6, 0], { color: ink(st), sw: 1, alpha: .3 }));
      items.push(G.arrow([0, 0, 0], a, { color: ink(st), sw: 2.4, key: 'v:a' }));
      items.push(G.arrow([0, 0, 0], b, { color: acc(st), sw: 2.4, key: 'v:b' }));
      items.push(E.label([a[0] * .55, a[1] * .55, 0], 'a', { dx: 4, dy: 16, size: 14 }));
      items.push(E.label([b[0] * .6, b[1] * .6, 0], 'b', { dx: -14, dy: -6, size: 14, color: acc(st) }));
      if (c.mode === 'add') {
        items.push(E.line(a, s, { color: acc(st), sw: 1.2, dash: [5, 4], alpha: .8 }));
        items.push(E.line(b, s, { color: ink(st), sw: 1.2, dash: [5, 4], alpha: .8 }));
        items.push(G.arrow([0, 0, 0], s, { color: acc(st), sw: 2.6, key: 'v:s' }));
        items.push(E.label(V.mul(s, .58), 'a+b', { dx: 16, dy: -4, size: 13, color: acc(st), align: 'left' }));
        items.push(E.label([1.55, -0.55, 0], 'a + b = (x₁+x₂, y₁+y₂)', { size: 11.5, dy: 12 }));
      } else if (c.mode === 'dot') {
        const proj = V.mul(b, V.dot(a, b) / V.dot(b, b));
        items.push(E.line(a, proj, { color: acc(st), sw: 1.1, dash: [5, 4] }));
        items.push(E.line([0, 0, 0], proj, { color: acc(st), sw: 2, dash: [2, 3] }));
        items.push(E.angle([0, 0, 0], a, b, 'θ', { color: ink(st) }));
        items.push(E.label([0.85, -0.62, 0], 'a·b = |a||b|cosθ', { size: 12, color: acc(st), dy: 14 }));
        items.push(E.label([0.85, -1.0, 0], '= x₁x₂ + y₁y₂', { size: 11.5, dy: 12 }));
        items.push(E.label(proj, '投影向量', { size: 10.5, dx: -16, dy: 22, align: 'right', color: acc(st) }));
      } else {
        const proj = V.mul(b, V.dot(a, b) / V.dot(b, b));
        items.push(E.line(a, proj, { color: acc(st), sw: 1.1, dash: [5, 4] }));
        items.push(E.point([a[0], 0, 0], { r: 3, color: ink(st) }));
        items.push(E.line([a[0], 0, 0], [a[0], a[1], 0], { color: ink(st), sw: .8, dash: [3, 4], alpha: .5 }));
        items.push(E.line([proj[0], proj[1], 0], [a[0], a[1], 0], { color: acc(st), sw: 1.8, key: 'v:perp' }));
        items.push(G.rightAngle(a, proj, V.add(proj, [0, 0, 2]), .16, { color: acc(st) }));
        items.push(E.label(V.mul(V.add(a, proj), .5), '|a|cosθ', { size: 11, dx: 6, dy: -14, color: acc(st) }));
        items.push(E.label([0.9, -0.62, 0], '投影向量 = (a·b/|b|²)·b', { size: 11.5, dy: 14 }));
      }
      return { items, fit: 1.02, gauges: GX.gauges, verdict: GX.verdict };
    },
  };

  /* ================= 08 立体几何 ================= */
  function cubeOf(st, o) {
    o = o || {};
    return G.cube({ st, a: o.a == null ? 2 : o.a, key: 'cube', alpha: o.alpha == null ? 1 : o.alpha });
  }

  const SOLID = {
    name: '立体几何 · 正方体剖析',
    camera: { yaw: -0.54, pitch: 0.28, zoom: 1.0, offset: [0, 1.0, 0] },
    modes: [
      { id: 'cube', name: '正方体', note: '<b>正方体</b>每个面都是全等的正方形；12 条棱、8 个顶点、6 个面，是最基本的多面体。' },
      { id: 'para', name: '线面平行', note: '<b>线面平行判定</b>：平面外一条直线与此平面内的一条直线平行，则该直线与此平面平行。' },
      { id: 'perp', name: '线面垂直', note: '<b>线面垂直判定</b>：一条直线与平面内两条相交直线都垂直，则该直线与此平面垂直。' },
      { id: 'cut', name: '截面', note: '用平面截正方体，截面可以是三角形、矩形、五边形、六边形——最多六边形，因为正方体只有 6 个面。' },
      { id: 'angle', name: '二面角', note: '<b>二面角</b>的平面角：在棱上取一点，分别在两个半平面内作棱的垂线，两垂线的夹角即为二面角的平面角。' },
      { id: 'ball', name: '外接球', note: '正方体的外接球直径等于体对角线：2R = √3a，所以 R = (√3/2)a，表面积 3πa²。' },
    ],
    build(t, c) {
      const st = c.st;
      const GX = { gauges: null, verdict: null };
      const soft = (c.mode === 'cut' || c.mode === 'angle' || c.mode === 'ball') && !st.seeThrough;
      const alpha = st.seeThrough ? 0.34 : (soft ? 0.55 : 0.94);
      const cube = cubeOf(st, { a: 2, alpha });
      const items = [cube.items];
      const v = cube.v;
      const A = v.A, B = v.B, C = v.C, D = v.D, A1 = v['A₁'], B1 = v['B₁'], C1 = v['C₁'], D1 = v['D₁'];
      if (c.mode === 'cube') {
        items.push(E.label([0, 0, 1.03], 'a', { size: 11, dx: -14, dy: 12, color: acc(st) }));
        items.push(E.label([1.03, 0, 0], 'a', { size: 11, dx: 12, dy: 10, color: acc(st) }));
        const O = G.centroid([A, B, C, D, A1, B1, C1, D1]);
        items.push(E.point(O, { r: 3, color: acc(st), key: 'cu:o' }));
        items.push(E.label(O, '体对角线交于一点', { size: 10.5, dx: 30, dy: -8, align: 'left', color: acc(st) }));
        items.push(E.line(A, C1, { color: acc(st), sw: 1.2, dash: [6, 4], alpha: .8 }));
      } else if (c.mode === 'para') {
        items.push(E.face([A, B, B1, A1], { color: acc(st), alpha0: .22, edgeColor: acc(st), sw: 2, key: 'cu:ab' }));
        items.push(E.line(C, D, { color: acc(st), sw: 2.6, key: 'cu:cd' }));
        items.push(E.line([C[0], C[1], C[2]], [D[0], D[1], D[2]], { color: acc(st), sw: 2.6 }));
        items.push(E.label([0, 1.05, -1.02], 'AB A₁B₁ ∥ CD', { size: 11, dx: 0, dy: -14, color: acc(st) }));
        items.push(E.label([-0.9, 0.05, 1.0], '平面 ABB₁A₁', { size: 10.5, dx: -6, dy: 12, align: 'right', color: acc(st) }));
      } else if (c.mode === 'perp') {
        items.push(E.face([A, B, C, D], { color: acc(st), alpha0: .2, edgeColor: acc(st), sw: 1.8 }));
        items.push(E.line(A, A1, { color: acc(st), sw: 2.6, key: 'cu:aa1' }));
        items.push(G.rightAngle(B, A, A1, .22, { color: acc(st) }));
        items.push(G.rightAngle(D, A, A1, .22, { color: acc(st) }));
        items.push(E.label([A[0] + .12, 1.0, A[2]], 'AA₁ ⊥ 平面 ABCD', { size: 10.5, dx: 22, dy: 0, align: 'left', color: acc(st) }));
        items.push(E.label([0, -0.16, 0.4], '底面 ABCD', { size: 10.5, dy: 14 }));
      } else if (c.mode === 'cut') {
        const u = PV(c, 'u', 0.5);
        const h = [G.mid(A, B, u), G.mid(B, C, u), G.mid(C, C1, u), G.mid(C1, D1, u), G.mid(D1, A1, u), G.mid(A1, A, u)];
        {
          let area = 0, per = 0; const O = G.centroid(h);
          for (let i = 0; i < 6; i++) { const p1 = h[i], p2 = h[(i + 1) % 6]; per += Math.hypot(p2[0]-p1[0], p2[1]-p1[1], p2[2]-p1[2]); const cr = V.cross(V.sub(p1, O), V.sub(p2, O)); area += 0.5 * Math.hypot(cr[0], cr[1], cr[2]); }
          GX.gauges = [['分点位置 u', F2(u)], ['截面边数', '6'], ['截面周长', F2(per)], ['截面面积', F2(area)]];
          if (Math.abs(u - 0.5) < 0.03) GX.verdict = { text: '临界点：u=0.5 时六个分点共面成正六边形；u 一偏，截面就“歪”——先证共面再谈形状。', danger: false };
        }
        items.push(E.face(h, { color: acc(st), alpha0: .26, edgeColor: acc(st), sw: 2.1, hatch: true, key: 'cu:sec' }));
        items.push(E.poly(h, { closed: true, color: acc(st), sw: 2.3, layer: 'top', key: 'cu:sec2' }));
        h.forEach(p => items.push(E.point(p, { r: 2.8, color: acc(st) })));
        items.push(E.label(h[2], '正六边形截面', { size: 11, color: acc(st), dx: 24, dy: -8, align: 'left' }));
        items.push(E.label([0, 2.35, 0], '截面随分点 u 滑动 · u=0.5 为正六边形', { size: 10, dy: -4 }));
      } else if (c.mode === 'angle') {
        const O = G.mid(B, D);
        items.push(E.face([A1, B, D], { color: acc(st), alpha0: .26, edgeColor: acc(st), sw: 1.9, key: 'cu:p1' }));
        items.push(E.face([A, B, D], { color: G.tint(st, .2), alpha0: .2, edgeColor: ink(st), sw: 1.5 }));
        items.push(E.line(B, D, { color: ink(st), sw: 2.2, key: 'cu:bd' }));
        items.push(E.line(A, O, { color: acc(st), sw: 1.5, dash: [4, 3] }));
        items.push(E.line(A1, O, { color: acc(st), sw: 1.5, dash: [4, 3] }));
        items.push(G.rightAngle(A, O, B, .2, { color: acc(st) }));
        items.push(E.angle(A, O, A1, 'θ', { color: acc(st) }));
        items.push(E.label([0, 1.2, 0.55], '二面角 A₁-BD-A', { size: 10.8, color: acc(st), dx: 34, dy: -6, align: 'left' }));
        items.push(E.label(O, 'O', { size: 10.5, dx: -12, dy: 10 }));
      } else {
        const O = [0, 1, 0];
        const R = Math.sqrt(3);
        items.push(G.sphere({ c: O, r: R, color: G.tint(st, .12), alpha: .5, key: 'cu:ball' }));
        items.push(E.label(O, 'O', { size: 12, dx: -12, dy: 10, color: acc(st) }));
        items.push(E.line(A, C1, { color: acc(st), sw: 1.8, dash: [6, 4] }));
        items.push(E.label(G.mid(A, C1), '2R = √3a', { size: 11, dx: 26, dy: -6, align: 'left', color: acc(st) }));
      }
      if (c.mode === 'ball') GX.gauges = [['棱长 a', '2'], ['体对角线 √3a', F2(Math.sqrt(3) * 2)], ['外接球 R=√3a/2', F2(Math.sqrt(3))], ['球表面积 4πR²', F2(4 * Math.PI * 3) ]];
      return { items, fit: 0.98, gauges: GX.gauges, verdict: GX.verdict };
    },
  };

  /* ================= 09 空间向量 ================= */
  const VEC3 = {
    name: '空间向量 · 建系与法向量',
    camera: { yaw: -0.56, pitch: 0.26, zoom: 1.0, offset: [0, 1.05, 0], dist: 10.5, fov: 7.6 },
    modes: [
      { id: 'sys', name: '建立坐标系', note: '<b>建系三原则</b>：原点取在垂直关系多的地方，三条坐标轴两两垂直，尽量让点落在坐标轴上。' },
      { id: 'normal', name: '求法向量', note: '<b>法向量</b> n 与平面内两个不共线向量都垂直：n·AB=0，n·AD=0，取一组非零解即可。' },
      { id: 'angle', name: '线面角与二面角', note: 'sinθ = |cos⟨a, n⟩| 求线面角；cos⟨n₁, n₂⟩ 求二面角，注意判断锐钝。' },
    ],
    build(t, c) {
      const st = c.st, items = [];
      const GX = { gauges: null, verdict: null };
      const cube = cubeOf(st, { a: 2, alpha: st.seeThrough ? .42 : .9 });
      const v = cube.v, A = v.A, B = v.B, C = v.C, D = v.D, A1 = v['A₁'], B1 = v['B₁'], D1 = v['D₁'];
      items.push(cube.items);
      if (c.mode === 'sys') {
        const O = A;
        items.push(G.arrow(O, [O[0] + 2.6, O[1], O[2]], { color: acc(st), sw: 1.8, key: 'v3:x' }));
        items.push(G.arrow(O, [O[0], O[1], O[2] - 2.6], { color: acc(st), sw: 1.8, key: 'v3:y' }));
        items.push(G.arrow(O, [O[0], O[1] + 2.6, O[2]], { color: acc(st), sw: 1.8, key: 'v3:z' }));
        items.push(E.label([O[0] + 2.7, O[1], O[2]], 'x', { size: 12, dx: 6, dy: 6, align: 'left', color: acc(st) }));
        items.push(E.label([O[0], O[1], O[2] - 2.7], 'y', { size: 12, dx: -16, dy: 4, color: acc(st) }));
        items.push(E.label([O[0], O[1] + 2.7, O[2]], 'z', { size: 12, dx: 8, dy: -4, align: 'left', color: acc(st) }));
        items.push(E.label([O[0] + 0.2, O[1] + 2.3, O[2] - 1.2], 'A 为原点', { size: 10.5, dx: 26, dy: 0, align: 'left' }));
      } else if (c.mode === 'normal') {
        items.push(E.face([A1, B, D1], { color: acc(st), alpha0: .24, edgeColor: acc(st), sw: 2, hatch: true, key: 'v3:pl' }));
        const O = G.centroid([A1, B, D1]);
        const n = [1, 1, -1];
        const tip = V.add(O, V.mul(n, 0.85 / Math.sqrt(3)));
        items.push(G.arrow(O, tip, { color: ink(st), sw: 2, key: 'v3:n' }));
        items.push(E.label(tip, 'n=(1,1,−1)', { size: 11, dx: 10, dy: -10, align: 'left' }));
        items.push(E.point(O, { r: 3, color: ink(st) }));
        items.push(E.label([0.6, 1.9, 0.2], '平面 A₁BD', { size: 10.5, color: acc(st), dx: 24, dy: -8, align: 'left' }));
        items.push(E.label([0, 1.0, -1.1], 'n·A₁B = 0, n·BD = 0', { size: 10.5, dy: -14 }));
      } else {
        items.push(E.face([A1, B, D1], { color: acc(st), alpha0: .2, edgeColor: acc(st), sw: 1.7 }));
        items.push(E.face([A, B, C, D], { color: G.tint(st, .2), alpha0: .18, edgeColor: ink(st), sw: 1.5 }));
        const O1 = G.centroid([A1, B, D1]);
        const O2 = G.centroid([A, B, C, D]);
        items.push(G.arrow(O2, V.add(O2, [0.32, 1.05, 0.32]), { color: ink(st), sw: 1.6, key: 'v3:n2' }));
        const ph = PV(c, 'phi', 32) * Math.PI / 180;
        const n1d = V.norm([Math.sin(ph), -Math.cos(ph) * 0.9, Math.sin(ph) * 0.8]);
        items.push(G.arrow(O1, V.add(O1, V.mul(n1d, 1.12)), { color: acc(st), sw: 1.6, key: 'v3:n1' }));
        {
          const n2d = V.norm([0.32, 1.05, 0.32]);
          const cs = Math.abs(V.dot(n1d, n2d));
          GX.gauges = [['n₁ 倾角 φ', F2(PV(c, 'phi', 32)) + '°'], ['|cos⟨n₁,n₂⟩|', F2(cs)], ['二面角(锐)', F2(Math.acos(Math.min(1, cs)) * 180 / Math.PI) + '°'], ['判钝', '看图定向']];
          if (cs > 0.97) GX.verdict = { text: '推过头：两法向量几乎平行 ⇒ 两平面几乎平行，二面角趋于 0——公式先报警，图形后证实。', danger: true };
        }
        items.push(E.label(V.add(O2, [0.45, 1.15, 0.45]), 'n₂', { size: 11, dx: 8, dy: -8, align: 'left' }));
        items.push(E.label(V.add(O1, [0.6, -1.0, 0.6]), 'n₁', { size: 11, dx: 8, dy: 6, align: 'left', color: acc(st) }));
        items.push(E.label([0, 0.12, 0.3], 'cos⟨n₁,n₂⟩ 定二面角', { size: 10.5, dy: 14 }));
      }
      return { items, fit: 1.0, gauges: GX.gauges, verdict: GX.verdict };
    },
  };

  /* ================= 10 解析几何 ================= */
  function coneSection(k, P, n, ymax, steps) {
    // 双锥 r = k|y|，平面 n·(X−P)=0，逐角度解出 y(φ)
    const out = [];
    const N = steps || 240;
    const num = n[0] * P[0] + n[1] * P[1] + n[2] * P[2];
    for (const sg of [1, -1]) {
      let cur = [];
      for (let i = 0; i <= N; i++) {
        const a = i / N * TAU;
        const cs = Math.cos(a), sn = Math.sin(a);
        const den = k * sg * (n[0] * cs + n[2] * sn) + n[1];
        const y = num / den;
        const ok = isFinite(y) && Math.abs(den) > 1e-5 && y * sg > 0 && Math.abs(y) <= ymax;
        if (ok) cur.push([k * Math.abs(y) * cs, y, k * Math.abs(y) * sn]);
        else { if (cur.length > 2) out.push(cur); cur = []; }
      }
      if (cur.length > 2) out.push(cur);
    }
    // 合并跨越参数接缝而被切断的同一支
    const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    let changed = true;
    while (changed && out.length > 1) {
      changed = false;
      for (let i = 0; i < out.length && !changed; i++) {
        for (let j = i + 1; j < out.length && !changed; j++) {
          const A = out[i], B = out[j];
          if (d2(A[A.length - 1], B[0]) < 0.55) { out[i] = A.concat(B); out.splice(j, 1); changed = true; }
          else if (d2(B[B.length - 1], A[0]) < 0.55) { out[i] = B.concat(A); out.splice(j, 1); changed = true; }
        }
      }
    }
    return out;
  }

  const CONIC = {
    name: '解析几何 · 圆锥截线',
    camera: { yaw: -0.44, pitch: 0.3, zoom: 0.96, offset: [0, 0.2, 0], dist: 10, fov: 8.2 },
    modes: [
      { id: 'ellipse', name: '椭圆', note: '用<b>倾斜但不过轴</b>的平面去截双锥，得到封闭的椭圆：x²/a² + y²/b² = 1。' },
      { id: 'hyperbola', name: '双曲线', note: '平面<b>比母线更陡</b>时会同时截到上下两个锥面，得到两支双曲线：x²/a² − y²/b² = 1。' },
      { id: 'parabola', name: '抛物线', note: '平面<b>与母线平行</b>时只截到一个锥面，得到抛物线：y² = 2px。' },
      { id: 'cone', name: '圆锥', note: '三种圆锥曲线的统一来源：<b>截面的倾斜程度</b>决定曲线的形状。' },
    ],
    build(t, c) {
      const st = c.st, items = [];
      const k = 0.62, ymax = 2.2;
      const alpha = st.seeThrough ? 0.2 : 0.38;
      items.push(G.revolve([[0, 0], [k * ymax, ymax]], { st, seg: 56, alpha, key: 'co:up', capBottom: false, capTop: true }));
      items.push(G.revolve([[0, 0], [k * ymax, -ymax]], { st, seg: 56, alpha, key: 'co:dn', capBottom: false, capTop: true }));
      items.push(E.line([0, -ymax - .25, 0], [0, ymax + .25, 0], { color: ink(st), sw: 1, dash: [7, 5], alpha: .55 }));
      if (c.mode === 'cone') {
        items.push(E.label([0, ymax + 0.55, 0], '母线 l 与轴成定角 α', { size: 11, dy: -2, color: acc(st) }));
        items.push(E.label([k * ymax * 0.72, ymax * 0.55, k * ymax * 0.72], 'l', { size: 11.5, dx: 12, dy: -4, align: 'left' }));
        items.push(E.label([0, -ymax - 0.55, 0], '平面截双锥 → 三种圆锥曲线', { size: 10.5, dy: 10 }));
        return { items, fit: 0.96 };
      }
      const alphaDeg = Math.atan(k) * 180 / Math.PI;
      const defBeta = { ellipse: 66, hyperbola: 18, parabola: 32 }[c.mode] || 45;
      const betaDeg = PV(c, 'beta', defBeta), beta = betaDeg * Math.PI / 180;
      const ecc = Math.cos(beta) / Math.cos(alphaDeg * Math.PI / 180);
      const cfg = {
        P: ecc < 0.92 ? [0, 0.95, 0] : (ecc > 1.08 ? [0.45, 0, 0] : [0, 0.75, 0.25]),
        n: [Math.cos(beta), Math.sin(beta), 0],
      };
      const n = V.norm(cfg.n);
      const u = V.norm(V.cross(n, [0, 1, 0.001]));
      const vv = V.norm(V.cross(n, u));
      items.push(G.planeQuad(cfg.P, u, vv, 1.75, 1.75, {
        color: acc(st), alpha: .15, edgeColor: acc(st), sw: 1.5, dash: [6, 4], key: 'co:plane',
      }));
      const branches = coneSection(k, cfg.P, n, ymax, 300);
      let drawn = 0;
      branches.forEach((br, i) => {
        if (br.length < 3) return;
        items.push(E.poly(br, { closed: false, color: acc(st), sw: 3.2, layer: 'top', key: 'co:curve' + i }));
        drawn++;
      });
      const typeName = ecc < 0.92 ? '椭圆' : (ecc > 1.08 ? '双曲线' : '抛物线（临界）');
      items.push(E.label([0, -ymax - 0.55, 0], typeName + ' · e=' + F2(ecc), { size: 13, color: acc(st), dy: 8 }));
      items.push(E.label([-1.75, ymax + 0.55, 0], '截得 ' + drawn + ' 段', { size: 9.5, dy: 2 }));
      const GX = { gauges: [['截面倾角 β', F2(betaDeg) + '°'], ['锥半角 α', F2(alphaDeg) + '°'], ['离心率 e=cosβ/cosα', F2(ecc)], ['曲线类型', typeName]], verdict: null };
      if (ecc >= 0.92 && ecc <= 1.08) GX.verdict = { text: '临界点：β=α，截面与母线平行——椭圆被拉成开口的抛物线。再陡一点就裂成双曲线两支。', danger: false };
      else if (ecc > 1.08) GX.verdict = { text: '推过头：β<α，平面同时捅穿上下两只锥——一支变两支，这就是双曲线的出身。', danger: true };
      return { items, fit: 0.94, gauges: GX.gauges, verdict: GX.verdict };
    },
  };

  /* ================= 11 数列 ================= */
  const SEQ = {
    name: '数列 · 离散的点',
    camera: { yaw: -0.3, pitch: 0.14, zoom: 1.0, offset: [0, 1.15, 0], dist: 10, fov: 6.6 },
    modes: [
      { id: 'arith', name: '等差数列', note: '<b>等差数列</b> aₙ = a₁ + (n−1)d：点 (n, aₙ) 在同一条直线上，公差就是斜率。' },
      { id: 'geom', name: '等比数列', note: '<b>等比数列</b> aₙ = a₁qⁿ⁻¹：点 (n, aₙ) 落在指数曲线上，|q|<1 时递减。' },
      { id: 'sum', name: '求和', note: '<b>前 n 项和</b>：等差数列用倒序相加，等比数列用错位相减；几何上就是逐层叠加的柱高。' },
    ],
    build(t, c) {
      const st = c.st, items = [];
      items.push(E.line([0, 0, 0], [7.4, 0, 0], { color: ink(st), sw: 1.2, arrow: true, alpha: .8 }));
      items.push(E.line([0, 0, 0], [0, 4.2, 0], { color: ink(st), sw: 1.2, arrow: true, alpha: .8 }));
      items.push(E.label([7.5, 0, 0], 'n', { size: 11, dx: 6, dy: 8, align: 'left' }));
      items.push(E.label([0, 4.3, 0], 'aₙ', { size: 11, dx: 8, dy: -4, align: 'left' }));
      const N = Math.round(PV(c, 'n', 7));
      const GX = { gauges: null, verdict: null };
      let f, txt;
      if (c.mode === 'arith') { const d = PV(c, 'd', 0.42); f = n => 0.5 + d * (n - 1); txt = 'aₙ = a₁ + (n−1)d'; GX.gauges = [['公差 d', F2(d)], ['a₁', '0.5'], ['第 n 项', 'n=' + N], ['Sₙ', F2(N * (f(1) + f(N)) / 2)]]; if (d < 0) GX.verdict = { text: '推过头：d<0 时点列掉头向下，Sₙ 先增后减——求和最值要盯着变号的那一项。', danger: true }; }
      else if (c.mode === 'geom') { const q = PV(c, 'q', 1.42); f = n => 0.42 * Math.pow(q, n - 1); txt = 'aₙ = a₁qⁿ⁻¹'; GX.gauges = [['公比 q', F2(q)], ['a₁', '0.42'], ['第 n 项', 'n=' + N], ['aₙ', F2(f(N))]]; if (q > 1.6) GX.verdict = { text: '推过头：q 越大尾项爆炸式长大；|q|<1 时则衰减。先判断 |q| 与 1 的关系，再谈求和极限。', danger: true }; }
      else { const q = PV(c, 'q', 0.72); f = n => { let s = 0; for (let i = 1; i <= n; i++) s += 0.42 * Math.pow(q, i - 1); return s; }; txt = 'Sₙ = a₁(1−qⁿ)/(1−q)'; GX.gauges = [['公比 q', F2(q)], ['项数 n', N], ['Sₙ', F2(f(N))], ['极限(q<1)', q < 1 ? F2(0.42 / (1 - q)) : '不存在']]; }
      let last = 0;
      for (let n = 1; n <= N; n++) {
        const y = f(n);
        last = y;
        items.push(E.line([n, 0, 0], [n, y, 0], { color: acc(st), sw: 1, alpha: .45 }));
        items.push(E.point([n, y, 0], { r: 3.6, color: acc(st), key: 'sq:p' + n }));
        if (n <= 3 || n === N) items.push(E.label([n, y, 0], String(n === 1 ? 'a₁' : 'a' + ['₁', '₂', '₃', '₄', '₅', '₆', '₇'][n - 1]), { size: 10, dx: 12, dy: -8, align: 'left' }));
      }
      if (c.mode === 'arith') {
        items.push(E.line([1, f(1), 0], [N, f(N), 0], { color: ink(st), sw: 1.1, dash: [6, 5], alpha: .7 }));
        items.push(E.label([4, f(4) + 0.3, 0], '公差 d = 斜率', { size: 11, dy: -6, color: ink(st) }));
      } else if (c.mode === 'geom') {
        const pts = [];
        for (let x = 1; x <= N; x += 0.1) pts.push([x, f(x), 0]);
        items.push(E.poly(pts, { color: ink(st), sw: 1.1, dash: [5, 5], alpha: .7 }));
        items.push(E.label([4.4, f(4.4) + 0.35, 0], '公比 q = 相邻比', { size: 11, dy: -6 }));
      } else {
        items.push(bars(st, Array.from({ length: N }, (_, i) => ({ v: f(i + 1), t: '', l: String(i + 1) })), { h: 2.4, w: 0.34, alpha: .38, axisLabel: true }));
        items.push(E.label([4, 3.6, 0], '逐项叠加 = 柱高', { size: 11.5, color: acc(st), dy: -4 }));
      }
      items.push(E.label([3.6, -0.62, 0], txt, { size: 12, dy: 10, color: acc(st) }));
      return { items, fit: 1.0, gauges: GX.gauges, verdict: GX.verdict };
    },
  };

  /* ================= 12 导数 ================= */
  const DERIV = {
    name: '导数 · 切线与极值',
    camera: CAM2D,
    modes: [
      { id: 'tan', name: '切线', note: '<b>导数</b> f′(x₀) 就是曲线在 x₀ 处切线的斜率；切线是“局部的一次近似”。' },
      { id: 'ext', name: '极值', note: '<b>极值点</b>处 f′(x)=0（或不存在），且左右两侧导数变号：由正变负为极大，由负变正为极小。' },
      { id: 'mono', name: '单调性', note: '<b>单调性</b>由 f′(x) 的符号决定：f′>0 递增，f′<0 递减。' },
      { id: 'surf', name: '二元函数曲面', note: '二元函数 z=f(x,y) 的图象是曲面；偏导数描述沿坐标轴方向的切线斜率。' },
    ],
    build(t, c) {
      const st = c.st, items = [];
      if (c.mode === 'surf') {
        const f = (x, y) => 0.42 * (x * x - y * y) * .5 + 0.9;
        const N = 9, R = 2.0;
        for (let i = 0; i <= N; i++) {
          const a = -R + 2 * R * i / N;
          const p1 = [], p2 = [];
          for (let j = 0; j <= N; j++) {
            const b = -R + 2 * R * j / N;
            p1.push([a, f(a, b), b]);
            p2.push([b, f(a, b), a]);
          }
          items.push(E.poly(p1, { color: ink(st), sw: 1, alpha: .5 }));
          items.push(E.poly(p2, { color: acc(st), sw: 1, alpha: .45 }));
        }
        items.push(...frame3(st, { len: 2.2 }));
        items.push(E.label([0, 2.95, 0], 'z = f(x, y)', { size: 12, color: acc(st), dy: -2 }));
        items.push(E.label([0, -0.42, 2.25], '马鞍面：偏导为 0 但不是极值', { size: 10.5, dy: 10 }));
        return { items, fit: 1.0 };
      }
      items.push(grid(st, { xr: 3, yr: 2.6 }), ...flatAxes(st, { xr: 3.2, yu: 2.9, yd: 1.2 }));
      const GX = { gauges: null, verdict: null };
      const f = x => 0.32 * x * x * x - 0.95 * x + 0.6;
      const df = x => 0.96 * x * x - 0.95;
      items.push(curve(f, -2.35, 2.35, 180, { st, sw: 2.5 }));
      if (c.mode === 'tan') {
        const x0 = PV(c, 'x0', -1.2);
        GX.gauges = [['x₀', F2(x0)], ['f(x₀)', F2(f(x0))], ["f'(x₀)=切线斜率", F2(df(x0))], ['切线', 'y−' + F2(f(x0)) + '=' + F2(df(x0)) + '(x−' + F2(x0) + ')']];
        if (Math.abs(df(x0)) < 0.1) GX.verdict = { text: '临界点：切线变平 ⇒ f′(x₀)≈0——这正是极值候选点。再往右拖，斜率变号，增减就此翻转。', danger: false };
        const y0 = f(x0), k = df(x0);
        const p1 = [x0 - 1.0, y0 - k * 1.0, 0], p2 = [x0 + 1.0, y0 + k * 1.0, 0];
        items.push(E.line(p1, p2, { color: acc(st), sw: 2, key: 'dv:tan' }));
        items.push(E.point([x0, y0, 0], { r: 4.2, color: acc(st), ring: true }));
        items.push(E.label([x0, y0, 0], 'P', { size: 12, dx: 12, dy: -12, color: acc(st) }));
        items.push(E.line([x0, 0, 0], [x0, y0, 0], { color: ink(st), sw: .9, dash: [3, 4], alpha: .6 }));
        items.push(E.label([x0, 0, 0], 'x₀', { size: 10.5, dy: 14 }));
        items.push(E.label([0.4, 2.55, 0], 'k = f′(x₀) = ' + k.toFixed(2), { size: 12, color: acc(st), dy: -4 }));
      } else if (c.mode === 'ext') {
        const xs = [-2 / Math.sqrt(1.92), 2 / Math.sqrt(1.92)];
        const pts = [[xs[0], f(xs[0])], [xs[1], f(xs[1])]];
        pts.forEach(([x, y], i) => {
          items.push(E.line([x - .45, y, 0], [x + .45, y, 0], { color: acc(st), sw: 1.4, dash: [5, 4] }));
          items.push(E.point([x, y, 0], { r: 4, color: acc(st), ring: true }));
          items.push(E.label([x, y, 0], i === 0 ? '极大值' : '极小值', { size: 11, dx: i === 0 ? -18 : 18, dy: -14, align: i === 0 ? 'right' : 'left', color: acc(st) }));
        });
        items.push(E.label([0, 2.55, 0], "f′(x)=0 且左右变号", { size: 11.5, dy: -4 }));
      } else {
        [-2.1, -1.0, 0.2, 1.0, 2.0].forEach(x => {
          const k = df(x);
          items.push(E.label([x, f(x), 0], (k > 0 ? '↗' : '↘'), { size: 13, dy: -14, bold: true }));
        });
        items.push(E.label([0, 2.55, 0], "f′>0 递增 · f′<0 递减", { size: 11.5, dy: -4 }));
      }
      return { items, fit: 1.0, gauges: GX.gauges, verdict: GX.verdict };
    },
  };

  /* ================= 13 统计 ================= */
  const STAT = {
    name: '统计 · 列联表与回归',
    camera: { yaw: -0.42, pitch: 0.5, zoom: 1.12, offset: [0, 0.35, 0] },
    modes: [
      { id: 'table', name: '列联表', note: '<b>2×2 列联表</b>把两个分类变量交叉计数；χ² 独立性检验用 a、b、c、d 与总数算统计量。' },
      { id: 'reg', name: '线性回归', note: '<b>回归直线</b> ŷ = b̂x + â 经过样本中心 (x̄, ȳ)；相关系数 r 越接近 ±1，线性关系越强。' },
      { id: 'spread', name: '方差', note: '<b>方差</b>是各数据与平均数偏差平方的平均值：偏差线段越长，数据越分散。' },
    ],
    build(t, c) {
      const st = c.st, items = [];
      const GX = { gauges: null, verdict: null };
      if (c.mode === 'table') {
        const cell = (x, z, txt, col) => {
          items.push(E.face([[x - .58, 0, z - .44], [x + .58, 0, z - .44], [x + .58, 0, z + .44], [x - .58, 0, z + .44]], {
            color: col, alpha0: .5, edgeColor: ink(st), sw: 1.3,
          }));
          items.push(E.label([x, 0.02, z], txt, { size: 13 }));
        };
        cell(-0.62, -0.5, 'a', G.tint(st, .08));
        cell(0.62, -0.5, 'b', G.tint(st, .16));
        cell(-0.62, 0.5, 'c', G.tint(st, .16));
        cell(0.62, 0.5, 'd', G.tint(st, .24));
        items.push(E.label([-0.62, 0.02, -0.5], '阳性', { size: 10.5, dx: 4, dy: -30 }));
        items.push(E.label([0.62, 0.02, -0.5], '阴性', { size: 10.5, dx: 4, dy: -30 }));
        items.push(E.label([-0.62, 0.02, -0.5], '甲类', { size: 10.5, dx: -52, dy: 2, align: 'right' }));
        items.push(E.label([-0.62, 0.02, 0.5], '乙类', { size: 10.5, dx: -52, dy: 2, align: 'right' }));
        items.push(E.label([0, 1.35, 0], 'χ² = n(ad−bc)² / ((a+b)(c+d)(a+c)(b+d))', { size: 10.6, color: acc(st), dy: -2 }));
        items.push(E.label([0, 1.02, 0], 'χ² 越大，两变量有关联的证据越强', { size: 10, dy: -2 }));
      } else if (c.mode === 'reg') {
        items.push(E.line([-2.4, 0, 0], [2.4, 0, 0], { color: ink(st), sw: 1.1, arrow: true, alpha: .7 }));
        items.push(E.line([-2.4, 0, 0], [-2.4, 2.6, 0], { color: ink(st), sw: 1.1, arrow: true, alpha: .7 }));
        const rt = PV(c, 'r', 0.85);
        const xs8 = [-2, -1.4, -0.8, -0.2, 0.4, 1.0, 1.6, 2.1], nz8 = [.18, -.28, .12, -.2, .22, -.3, .15, -.05];
        const pts = xs8.map((x, i) => [x, 1.35 + 0.38 * x * rt + nz8[i] * (1.15 * (1 - Math.abs(rt)) + 0.06)]);
        let mx = 0, my = 0; pts.forEach(([x, y]) => { mx += x; my += y; }); mx /= pts.length; my /= pts.length;
        let sxy = 0, sxx = 0, syy = 0; pts.forEach(([x, y]) => { sxy += (x - mx) * (y - my); sxx += (x - mx) * (x - mx); syy += (y - my) * (y - my); });
        const bh = sxy / sxx, ah = my - bh * mx, rr = sxy / Math.sqrt(sxx * syy || 1);
        GX.gauges = [['目标相关', F2(rt)], ['实际 r', F2(rr)], ['b̂ = Σ(x−x̄)(y−ȳ)/Σ(x−x̄)²', F2(bh)], ['â', F2(ah)]];
        if (Math.abs(rr) < 0.25) GX.verdict = { text: '推过头：r 拖到 0 附近，点云散成一团——回归直线还在，但它已经什么都预测不了。', danger: true };
        pts.forEach(([x, y], i) => {
          items.push(E.line([x, y, 0], [x, 0.05, 0], { color: acc(st), sw: .8, alpha: .3 }));
          items.push(E.point([x, y, 0], { r: 3.2, color: ink(st), key: 'st:p' + i }));
        });
        items.push(E.line([-2.2, ah + bh * -2.2, 0], [2.2, ah + bh * 2.2, 0], { color: acc(st), sw: 2.2, key: 'st:line' }));
        items.push(E.label([1.0, 1.25, 0], 'ŷ = b̂x + â', { size: 11.5, color: acc(st), dx: 26, dy: 16, align: 'left' }));
        items.push(E.point([mx, my, 0], { r: 3.8, color: acc(st), ring: true }));
        items.push(E.label([mx, my, 0], '样本中心 (x̄, ȳ)', { size: 10.2, dx: -16, dy: -14, align: 'right', color: acc(st) }));
      } else {
        const raw = [0.9, 1.4, 1.5, 1.8, 2.4, 2.6, 3.1];
        const mean0 = raw.reduce((a, b) => a + b, 0) / raw.length;
        const sc1 = PV(c, 'spread', 1);
        const data = raw.map(v => mean0 + (v - mean0) * sc1);
        const mean = data.reduce((a, b) => a + b, 0) / data.length;
        GX.gauges = [['伸缩倍数', F2(sc1)], ['平均数 x̄', F2(mean)], ['方差 s²', F2(data.reduce((a2, v) => a2 + (v - mean) * (v - mean), 0) / data.length)], ['标准差 s', F2(Math.sqrt(data.reduce((a2, v) => a2 + (v - mean) * (v - mean), 0) / data.length))]];
        if (sc1 > 1.7) GX.verdict = { text: '推过头：数据拉得越开平均数纹丝不动、方差按倍数平方涨——稳定性看方差，不看平均。', danger: true };
        data.forEach((y, i) => {
          const x = (i - (data.length - 1) / 2) * 0.62;
          items.push(E.line([x, 0, 0], [x, y, 0], { color: acc(st), sw: 1, alpha: .4 }));
          items.push(E.point([x, y, 0], { r: 3.4, color: acc(st) }));
          items.push(E.line([x, mean, 0], [x, y, 0], { color: ink(st), sw: 1.6, key: 'st:d' + i }));
        });
        items.push(E.line([-2.1, mean, 0], [2.1, mean, 0], { color: ink(st), sw: 1.4, dash: [6, 4] }));
        items.push(E.label([0, mean, 0], '平均数 x̄', { size: 10.5, dy: -12 }));
        items.push(E.label([0, 3.3, 0], 's² = Σ(xᵢ−x̄)² / n', { size: 12, color: acc(st), dy: -4 }));
      }
      return { items, fit: 1.02, gauges: GX.gauges, verdict: GX.verdict };
    },
  };

  /* ================= 14 概率 ================= */
  const PROB = {
    name: '概率 · 样本空间与分布',
    camera: { yaw: -0.38, pitch: 0.3, zoom: 1.0, offset: [0, 0.85, 0] },
    modes: [
      { id: 'space', name: '古典概型', note: '<b>古典概型</b>：样本空间有限且每个样本点等可能，P(A) = A 包含的样本点数 / 样本点总数。' },
      { id: 'cond', name: '条件概率', note: '<b>条件概率</b> P(B|A) = P(AB)/P(A)：把样本空间缩小到 A 之内再算比例。' },
      { id: 'normal', name: '正态分布', note: '<b>正态分布</b>曲线关于 x=μ 对称：约 68.3% 的数据落在 μ±σ 内，95.4% 落在 μ±2σ 内。' },
      { id: 'walk', name: '随机游走', note: '<b>一维随机游走</b>每一步等可能地 ±1；步数越多，可能的落点越分散（马尔科夫链的最简模型）。' },
    ],
    build(t, c) {
      const st = c.st, items = [];
      const GX = { gauges: null, verdict: null };
      if (c.mode === 'normal') {
        const mu = PV(c, 'mu', 0), sig = PV(c, 'sig', 0.67);
        const f = x => 1.9 * Math.exp(-((x - mu) * (x - mu)) / (2 * sig * sig));
        GX.gauges = [['μ（中心）', F2(mu)], ['σ（胖瘦）', F2(sig)], ['μ±σ', F2(mu - sig) + ' ~ ' + F2(mu + sig)], ['μ±σ 内概率', '68.3%']];
        if (sig > 1.05) GX.verdict = { text: '推过头：σ 拉大，曲线被压扁摊开，总面积仍是 1——概率不会凭空多出来，只是被摊薄。', danger: true };
        items.push(...flatAxes(st, { xr: 3.0, yu: 2.5, yd: 0.4 }));
        const pts = [];
        for (let i = 0; i <= 120; i++) { const x = -2.6 + 5.2 * i / 120; pts.push([x, f(x), 0]); }
        items.push(E.poly(pts, { color: acc(st), sw: 2.4 }));
        const band = [[mu - sig, 0, 0]];
        for (let i = 0; i <= 40; i++) { const x = (mu - sig) + 2 * sig * i / 40; band.push([x, f(x), 0]); }
        band.push([mu + sig, 0, 0]);
        items.push(E.face(band, { color: acc(st), alpha0: .2, edgeColor: 'transparent', sw: 0 }));
        [mu - sig, mu, mu + sig].forEach((x, i) => {
          items.push(E.line([x, 0, 0], [x, f(x), 0], { color: ink(st), sw: 1, dash: [4, 4], alpha: .6 }));
          items.push(E.label([x, 0, 0], ['μ−σ', 'μ', 'μ+σ'][i], { size: 10.5, dy: 14 }));
        });
        items.push(E.label([0, 2.55, 0], 'N(μ, σ²)', { size: 12.5, color: acc(st), dy: -4 }));
        items.push(E.label([0.95, 0.95, 0], '68.3%', { size: 11, dx: 16, dy: -6, align: 'left', color: acc(st) }));
        items.push(E.label([1.45, 0.42, 0], '95.4%', { size: 10.5, dx: 26, dy: 6, align: 'left' }));
        return { items, fit: 1.02, gauges: GX.gauges, verdict: GX.verdict };
      }
      if (c.mode === 'walk') {
        let p = [0, 0.12, 0];
        const pts = [p];
        const nw = Math.round(PV(c, 'steps', 12));
        const seqn = Array.from({ length: nw }, (_, i) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return (v - Math.floor(v)) > 0.5 ? 1 : -1; });
        GX.gauges = [['步数 n', nw], ['终点位置', F2(seqn.reduce((a2, b2) => a2 + b2, 0))], ['理论 E(X)', '0'], ['理论 √D(X)=√n', F2(Math.sqrt(nw))]];
        seqn.forEach((d, i) => {
          p = [p[0] + 0.42, Math.max(0.12, p[1] + d * 0.34), p[2]];
          pts.push(p);
        });
        items.push(E.poly(pts, { color: acc(st), sw: 2.2, layer: 'top', key: 'pb:walk' }));
        pts.forEach((q, i) => items.push(E.point(q, { r: i === pts.length - 1 ? 4 : 2.4, color: i === pts.length - 1 ? acc(st) : ink(st) })));
        items.push(E.line([-0.4, 0.12, 0], [5.4, 0.12, 0], { color: ink(st), sw: 1, dash: [5, 5], alpha: .45 }));
        items.push(E.label([2.4, 2.0, 0], 'n 步后位置 = ±1 之和', { size: 11.5, color: acc(st), dy: -4 }));
        items.push(E.label([2.4, 1.65, 0], 'E(X)=0, D(X)=n', { size: 10.5, dy: -2 }));
        return { items, fit: 1.04, gauges: GX.gauges, verdict: GX.verdict };
      }
      if (c.mode === 'cond') {
        items.push(E.face([[-1.7, 0.02, -1.2], [0.3, 0.02, -1.2], [0.3, 0.02, 1.0], [-1.7, 0.02, 1.0]], { color: acc(st), alpha0: .28, edgeColor: acc(st), sw: 1.8, key: 'pb:A' }));
        items.push(E.label([-1.25, 0.03, -0.55], 'A', { size: 14, color: acc(st) }));
        items.push(E.face([[-0.3, 0.03, -0.6], [1.5, 0.03, -0.6], [1.5, 0.03, 0.9], [-0.3, 0.03, 0.9]], { color: G.tint(st, .16), alpha0: .42, edgeColor: ink(st), sw: 1.6, key: 'pb:B' }));
        items.push(E.label([0.9, 0.04, 0.35], 'B', { size: 14 }));
        items.push(E.label([0, 1.05, 0], 'P(B|A) = P(AB)/P(A)', { size: 12, color: acc(st), dy: -6 }));
        items.push(E.label([0, 0.68, 0], 'A 发生的前提下再看 B', { size: 10.5, dy: -2 }));
        return { items, fit: 1.02, gauges: GX.gauges, verdict: GX.verdict };
      }
      const N = 6, cell = 0.5;
      const sumT = Math.round(PV(c, 'sum', 7)), cnt7 = 6 - Math.abs(7 - sumT);
      GX.gauges = [['目标和', sumT], ['样本点数', cnt7], ['总样本点', '36'], ['P = ' + cnt7 + '/36', F2(cnt7 / 36)]];
      items.push(E.face([[-1.6, 0, -1.6], [1.6, 0, -1.6], [1.6, 0, 1.6], [-1.6, 0, 1.6]], { color: G.tint(st, .1), alpha0: .3, edgeColor: ink(st), sw: 1.2 }));
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          const x = (i - 2.5) * cell, z = (j - 2.5) * cell;
          const diag = (i + 1 + j + 1) === sumT;
          items.push(E.point([x, 0.02, z], { r: diag ? 4 : 2.4, color: diag ? acc(st) : ink(st) }));
        }
      }
      items.push(E.label([0, 0, -1.95], '第一枚骰子 1–6', { size: 10.5, dy: 10 }));
      items.push(E.label([-2.0, 0, 0], '第二枚', { size: 10.5, dx: -20, dy: 6 }));
      items.push(E.label([0, 0.9, 0], '和为 ' + sumT + '：' + cnt7 + ' 个样本点', { size: 12, color: acc(st), dy: -6 }));
      items.push(E.label([0, 0.55, 0], 'P = ' + cnt7 + '/36', { size: 11.5, dy: -2 }));
      return { items, fit: 1.04, gauges: GX.gauges, verdict: GX.verdict };
    },
  };

  /* ================= 15 组合计数 ================= */
  const COMB = {
    name: '计数 · 路径与杨辉三角',
    camera: { yaw: -0.5, pitch: 0.3, zoom: 1.0, offset: [0, 0.95, 0] },
    modes: [
      { id: 'path', name: '格点路径', note: '<b>分步乘法计数</b>：从 (0,0) 走到 (m,n)，每步只能向右或向上，共有 C(m+n, m) 条路径。' },
      { id: 'pascal', name: '杨辉三角', note: '<b>杨辉三角</b> C(n,k) = C(n−1,k−1) + C(n−1,k)，每一层就是 (a+b)ⁿ 展开的系数。' },
      { id: 'incl', name: '容斥原理', note: '<b>容斥原理</b>：|A∪B| = |A|+|B|−|A∩B|；三项时再加回三者的交集，交替加减。' },
    ],
    build(t, c) {
      const st = c.st, items = [];
      const GX = { gauges: null, verdict: null };
      if (c.mode === 'path') {
        const m = Math.round(PV(c, 'm', 4)), n = Math.round(PV(c, 'n', 3)), s = 0.52;
        const ox = -m * s / 2, oz = -n * s / 2;
        for (let i = 0; i <= m; i++) items.push(E.line([ox + i * s, 0, oz], [ox + i * s, 0, oz + n * s], { color: ink(st), sw: .8, alpha: .25 }));
        for (let j = 0; j <= n; j++) items.push(E.line([ox, 0, oz + j * s], [ox + m * s, 0, oz + j * s], { color: ink(st), sw: .8, alpha: .25 }));
        GX.gauges = [['向右 m', m], ['向上 n', n], ['总步数 m+n', m + n], ['路径数 C(m+n,m)', Cnk(m + n, m)]];
        // 一条阶梯路径：左右轮流走，直到走满
        let x = ox, z = oz, rm = m, rn = n;
        let route = ''; while (rm > 0 || rn > 0) { if (rm > 0) { route += 'R'; rm--; } if (rn > 0) { route += 'U'; rn--; } }
        const pts = [[x, 0.02, z]];
        for (const ch of route) {
          if (ch === 'R') x += s; else z += s;
          pts.push([x, 0.02, z]);
        }
        items.push(E.poly(pts, { color: acc(st), sw: 2.6, layer: 'top', key: 'cb:route' }));
        items.push(E.point(pts[0], { r: 3.4, color: ink(st) }));
        items.push(E.point(pts[pts.length - 1], { r: 3.8, color: acc(st), ring: true }));
        items.push(E.label([ox - 0.1, 0.02, oz - 0.05], 'A', { size: 12, dx: -10, dy: 10 }));
        items.push(E.label([ox + m * s + 0.1, 0.02, oz + n * s + 0.12], 'B', { size: 12, dx: 10, dy: 10, color: acc(st) }));
        items.push(E.label([0, 0.75, 0], 'C(' + (m + n) + ',' + m + ') = ' + Cnk(m + n, m) + ' 条路径', { size: 12, color: acc(st), dy: -4 }));
        items.push(E.label([0, 0.42, 0], '右 ' + m + ' 步 + 上 ' + n + ' 步', { size: 10.5, dy: -2 }));
      } else if (c.mode === 'pascal') {
        const NR = Math.round(PV(c, 'rows', 6));
        const rows = Array.from({ length: NR }, (_, i) => i + 1);
        GX.gauges = [['行数', NR], ['第 ' + NR + ' 行和 = 2^' + (NR - 1), Math.pow(2, NR - 1)], ['中间项 C(' + (NR - 1) + ',' + Math.floor((NR - 1) / 2) + ')', Cnk(NR - 1, Math.floor((NR - 1) / 2))]];
        const val = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - i + 1) / i; return Math.round(r); };
        rows.forEach((cnt, ri) => {
          const y = ri * 0.55;
          for (let k = 0; k < cnt; k++) {
            const x = (k - (cnt - 1) / 2) * 0.62;
            items.push(E.point([x, y, 0], { r: 2.4, color: ink(st) }));
            items.push(E.label([x, y - 0.22, 0], String(val(ri, k)), { size: 10.5, dy: 2 }));
            if (ri > 0 && k < cnt - 1) items.push(E.line([x, y, 0], [x + 0.31, y - 0.55, 0], { color: ink(st), sw: .7, alpha: .3 }));
            if (ri > 0 && k > 0) items.push(E.line([x, y, 0], [x - 0.31, y - 0.55, 0], { color: ink(st), sw: .7, alpha: .3 }));
          }
        });
        items.push(E.label([0, 2.55, 0], '(a+b)ⁿ 的系数', { size: 12, color: acc(st), dy: -4 }));
      } else {
        const disc = (cx, cz, r, col) => {
          const pts = [];
          for (let i = 0; i < 56; i++) {
            const a = i / 56 * TAU;
            pts.push([cx + r * Math.cos(a), 0.02, cz + r * Math.sin(a)]);
          }
          items.push(E.face(pts, { color: col, alpha0: .3, edgeColor: ink(st), sw: 1.6 }));
        };
        disc(-0.55, 0, 1.05, G.tint(st, .14));
        disc(0.55, 0, 1.05, G.tint(st, .28));
        items.push(E.label([-1.2, 0.03, -0.7], 'A', { size: 14 }));
        items.push(E.label([1.2, 0.03, -0.7], 'B', { size: 14 }));
        items.push(E.label([0, 0.03, 0.1], 'A∩B', { size: 10.5, dy: 4 }));
        items.push(E.label([0, 0.95, 0], '|A∪B| = |A| + |B| − |A∩B|', { size: 12, color: acc(st), dy: -6 }));
        items.push(E.label([0, 0.6, 0], '容斥原理：先加后减重复部分', { size: 10.5, dy: -2 }));
      }
      return { items, fit: 1.02, gauges: GX.gauges, verdict: GX.verdict };
    },
  };

  /* ================= 16 线性规划 ================= */
  const LP = {
    name: '线性规划 · 可行域与目标函数',
    camera: { yaw: -0.46, pitch: 0.34, zoom: 1.0, offset: [0, 0.8, 0] },
    modes: [
      { id: 'region', name: '可行域', note: '<b>可行域</b>是所有约束条件的交集，通常是凸多边形；“顶点”是可能的最优点。' },
      { id: 'obj', name: '目标函数', note: '<b>目标函数</b> z=ax+by 是一族平行线；平移至可行域的边界顶点即得最值。' },
      { id: 'int', name: '整数解', note: '若变量要求取整数，最优点可能不在顶点，需要<b>整点调整</b>：在顶点附近找可行整点。' },
    ],
    build(t, c) {
      const st = c.st, items = [];
      const GX = { gauges: null, verdict: null };
      const P = [[0, 0, 0], [3.0, 0, 0], [1.6, 2.2, 0], [0, 1.5, 0]];
      items.push(E.face(P, { color: G.tint(st, .12), alpha0: .45, edgeColor: acc(st), sw: 2, key: 'lp:reg', hatch: c.mode !== 'region' }));
      items.push(E.line([-0.3, 0, 0], [3.5, 0, 0], { color: ink(st), sw: 1.2, arrow: true, alpha: .8 }));
      items.push(E.line([0, -0.3, 0], [0, 2.6, 0], { color: ink(st), sw: 1.2, arrow: true, alpha: .8 }));
      P.forEach((p, i) => items.push(E.point(p, { r: 3.2, color: ink(st) })));
      items.push(E.label([1.5, 0, 0], 'A(3,0)', { size: 10.5, dy: 14, dx: 10, align: 'left' }));
      items.push(E.label([1.6, 2.2, 0], 'B(1.6,2.2)', { size: 10.5, dx: 6, dy: -12, align: 'left' }));
      items.push(E.label([0, 1.5, 0], 'C(0,1.5)', { size: 10.5, dx: -10, dy: -8, align: 'right' }));
      if (c.mode === 'region') {
        items.push(E.label([0.9, 0.7, 0], '可行域', { size: 12, color: acc(st) }));
      } else if (c.mode === 'obj') {
        const ca = PV(c, 'ca', 2), cb = PV(c, 'cb', 3);
        const zr = (x, y) => ca * x + cb * y;
        const z = (x, y) => 0.55 * zr(x, y) + 0.1;
        const names4 = ['O(0,0)', 'A(3,0)', 'B(1.6,2.2)', 'C(0,1.5)'];
        const vals = P.map(([x, y]) => zr(x, y));
        const mi = vals.indexOf(Math.max(...vals));
        GX.gauges = [['z=…x+…y', ca + 'x + ' + cb + 'y'], ['各顶点 z', vals.map(v => F2(v)).join(' / ')], ['最大值点', names4[mi]], ['最大值', F2(vals[mi])]];
        { const sorted = vals.slice().sort((a2, b2) => b2 - a2); if (sorted[0] - sorted[1] < 0.05) GX.verdict = { text: '临界点：目标线与某条边平行，整条边上处处最优——不是一个点，是一段解。', danger: false }; }
        const top = P.map(([x, y]) => [x, z(x, y), 0]);
        items.push(E.face(top, { color: acc(st), alpha0: .25, edgeColor: acc(st), sw: 2, key: 'lp:obj' }));
        P.forEach((p, i) => items.push(E.line(p, top[i], { color: acc(st), sw: 1, dash: [4, 4], alpha: .7 })));
        items.push(E.label(top[mi], 'z 最大 @ ' + names4[mi], { size: 11, dx: 8, dy: -10, align: 'left', color: acc(st) }));
        items.push(E.label([0.2, 2.6, 0], '平移目标线至边界', { size: 10.5, dy: -4 }));
      } else {
        for (let x = 0; x <= 3; x++) for (let y = 0; y <= 2.4; y++) {
          const inside = x + y * 1.36 <= 3.05 && y <= 2.2 && (x + y * 0.35 <= 3.0);
          if (inside) items.push(E.point([x, y, 0], { r: 2, color: acc(st) }));
        }
        items.push(E.label([0.3, 2.6, 0], '整点中比较目标值', { size: 10.5, dy: -4 }));
      }
      return { items, fit: 1.04, gauges: GX.gauges, verdict: GX.verdict };
    },
  };

  /* ================= 17 数论 ================= */
  const NUMTH = {
    name: '数论 · 同余与素数',
    camera: { yaw: -0.42, pitch: 0.2, zoom: 1.0, offset: [0, 0.9, 0] },
    modes: [
      { id: 'mod', name: '同余环', note: '<b>同余</b> a≡b (mod n) 表示 a−b 被 n 整除；把 0…n−1 排成一个环，加法就是环上的转动。' },
      { id: 'gcd', name: '最大公因数', note: '<b>辗转相除</b>：gcd(a,b)=gcd(b,a mod b)；两数的公因数与它们差值的因数一致。' },
      { id: 'prime', name: '素数分布', note: '<b>素数</b>是只能被 1 和自身整除的大于 1 的整数；素数的分布没有简单规律，但“越来越稀”。' },
    ],
    build(t, c) {
      const st = c.st, items = [];
      const GX = { gauges: null, verdict: null };
      if (c.mode === 'mod') {
        const n = Math.round(PV(c, 'n', 7)), R = 1.5, mult = Math.round(PV(c, 'mult', 3));
        { let pw = 1 % n; for (let i = 0; i < n - 1; i++) pw = pw * mult % n; let cyc = 1, cur = mult % n; while (cur !== 1 && cyc < 60) { cur = cur * mult % n; cyc++; }
          GX.gauges = [['模 n', n], ['乘子 m', mult], ['m^(n−1) mod n', pw], ['1 的乘法周期', cyc]];
          if (pw !== 1) GX.verdict = { text: '推过头：m 与 n 不互素时 m^(n−1)≠1 (mod n)——费马小定理的前提是 p 为素数且 p∤a，前提破了结论就破。', danger: true }; }
        const pts = [];
        for (let i = 0; i < n; i++) {
          const a = i / n * TAU + Math.PI / 2;
          pts.push([R * Math.cos(a), 1.4 + R * Math.sin(a), 0]);
        }
        pts.forEach((p, i) => {
          items.push(E.point(p, { r: 3.6, color: ink(st), key: 'nt:p' + i }));
          items.push(E.label(p, String(i), { size: 11, dx: 14 * Math.cos(i / n * TAU + Math.PI / 2), dy: -14 * Math.sin(i / n * TAU + Math.PI / 2) }));
        });
        for (let i = 0; i < n; i++) {
          const j = (i * mult) % n;
          if (j !== i) items.push(E.line(pts[i], pts[j], { color: acc(st), sw: 1.4, alpha: .55, key: 'nt:e' + i }));
        }
        items.push(E.label([0, 1.4, 0], '×' + mult + ' (mod ' + n + ')', { size: 11.5, color: acc(st), dy: 4 }));
        items.push(E.label([0, -0.55, 0], '连乘回到起点 ⇔ 乘法周期', { size: 10.5, dy: 8 }));
      } else if (c.mode === 'gcd') {
        const a = Math.round(PV(c, 'ga', 12)), b = Math.round(PV(c, 'gb', 18)), u = 2.1 / Math.max(a, b);
        { let x = a, y = b, steps = 0; while (y) { const r = x % y; x = y; y = r; steps++; }
          GX.gauges = [['a', a], ['b', b], ['gcd(a,b)', x], ['辗转相除步数', steps]];
          if (x === 1) GX.verdict = { text: '临界点：gcd=1，两数互素——它们没有任何公共“格子”，这正是同余里能求逆元的条件。', danger: false }; }
        for (let i = 0; i < a; i++) items.push(E.face([[i * u - 2.2, 0, 0.15], [i * u - 2.2 + u * .85, 0, 0.15], [i * u - 2.2 + u * .85, 0, 0.15 - u * 6], [i * u - 2.2, 0, 0.15 - u * 6]], { color: G.tint(st, .12), alpha0: .55, edgeColor: ink(st), sw: .7 }));
        for (let i = 0; i < b; i++) items.push(E.face([[i * u - 1.6, 0, 0.85], [i * u - 1.6 + u * .85, 0, 0.85], [i * u - 1.6 + u * .85, 0, 0.85 - u * 9], [i * u - 1.6, 0, 0.85 - u * 9]], { color: G.tint(st, .3), alpha0: .55, edgeColor: ink(st), sw: .7 }));
        items.push(E.label([-2.35, 0, 0.1], String(a), { size: 11, dx: -6, align: 'right' }));
        items.push(E.label([-1.85, 0, 0.88], String(b), { size: 11, dx: -6, dy: -4, align: 'right' }));
        items.push(E.label([0.1, 0.75, 0], 'gcd(' + a + ',' + b + ')=' + GX.gauges[2][1], { size: 12, color: acc(st), dy: -6 }));
        items.push(E.label([0.1, 0.4, 0], '公共的 ' + GX.gauges[2][1] + ' 格', { size: 10.5, dy: -2 }));
      } else {
        const isPrime = n => { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
        for (let n = 2; n <= 46; n++) {
          const a = n * 0.62;
          const p = [Math.cos(a) * (0.8 + n * 0.042), 0.1 + n * 0.045, Math.sin(a) * (0.8 + n * 0.042)];
          items.push(E.point(p, { r: isPrime(n) ? 3.4 : 1.8, color: isPrime(n) ? acc(st) : ink(st), alpha: isPrime(n) ? 1 : .4, key: 'nt:n' + n }));
          if (isPrime(n) && n < 20) items.push(E.label(p, String(n), { size: 9.5, dx: 10, dy: -6, align: 'left', color: acc(st) }));
        }
        items.push(E.label([0, 2.55, 0], '红色：素数', { size: 12, color: acc(st), dy: -6 }));
        items.push(E.label([0, 2.2, 0], '2 3 5 7 11 13 …', { size: 10.5, dy: -2 }));
      }
      return { items, fit: 1.02, gauges: GX.gauges, verdict: GX.verdict };
    },
  };

  /* ================= 18 常用数表 ================= */
  const TABLE = {
    name: '数表 · 特殊角与三角值',
    camera: { yaw: -0.18, pitch: 0.08, zoom: 1.04, offset: [0, 0.95, 0], dist: 9.4, fov: 5.9 },
    modes: [
      { id: 'unit', name: '单位圆上的特殊角', note: '15°、30°、45°、60°、75° 的三角函数值都能在<b>单位圆</b>上读出：横坐标是 cos，纵坐标是 sin。' },
      { id: 'tri', name: '两个特殊三角形', note: '45°-45°-90° 与 30°-60°-90° 两个三角形，配合勾股定理即可推出全部特殊角的值。' },
      { id: 'tan', name: '正切线', note: '在单位圆右侧作切线 x=1，射线与它交点的纵坐标就是 <b>tanθ</b>；θ→90° 时正切趋于无穷。' },
    ],
    build(t, c) {
      const st = c.st, items = [];
      const GX = { gauges: null, verdict: null };
      if (c.mode === 'unit') {
        const R = 1.5, cy = 1.2;
        items.push(E.poly(circlePts(R, 84, cy), { closed: true, color: ink(st), sw: 1.4 }));
        items.push(E.line([-R - .3, cy, 0], [R + .5, cy, 0], { color: ink(st), sw: 1, arrow: true, alpha: .6 }));
        items.push(E.line([0, cy - R - .3, 0], [0, cy + R + .45, 0], { color: ink(st), sw: 1, arrow: true, alpha: .6 }));
        [[30, '1/2', '√3/2'], [45, '√2/2', '√2/2'], [60, '√3/2', '1/2']].forEach(([deg, sv, cv]) => {
          const a = deg * Math.PI / 180;
          const P = [R * Math.cos(a), cy + R * Math.sin(a), 0];
          items.push(E.line([0, cy, 0], P, { color: acc(st), sw: 1.6 }));
          items.push(E.point(P, { r: 3.2, color: acc(st) }));
          items.push(E.line(P, [P[0], cy, 0], { color: ink(st), sw: .9, dash: [4, 4], alpha: .6 }));
          items.push(E.label([P[0], cy, 0], cv, { size: 9.5, dy: 13 }));
          items.push(E.label([0, P[1], 0], sv, { size: 9.5, dx: -14, align: 'right' }));
          items.push(E.label([R * 1.1 * Math.cos(a), cy + R * 1.1 * Math.sin(a), 0], deg + '°', { size: 10.5, dx: 6, dy: -8 }));
        });
        items.push(E.label([0, cy + R + 0.55, 0], 'cos 读横轴 · sin 读纵轴', { size: 11, color: acc(st), dy: -2 }));
      } else if (c.mode === 'tri') {
        // 45-45-90
        const P1 = [[-1.9, 0, 0], [0.1, 0, 0], [0.1, 2.0, 0]];
        items.push(E.face(P1, { color: G.tint(st, .14), alpha0: .4, edgeColor: ink(st), sw: 1.5 }));
        items.push(G.rightAngle(P1[0], P1[1], P1[2], .16, { color: acc(st) }));
        items.push(E.label([-0.95, 0.02, 0], '1', { size: 11, dy: 14 }));
        items.push(E.label([0.1, 1.0, 0], '1', { size: 11, dx: 12 }));
        items.push(E.label([-0.9, 1.0, 0], '√2', { size: 11, dx: -12 }));
        items.push(E.label([-0.9, -0.28, 0], '45°-45°-90°', { size: 10.5, dy: 10 }));
        // 30-60-90
        const P2 = [[1.1, 0, 0], [2.9, 0, 0], [2.9, 1.04, 0]];
        items.push(E.face(P2, { color: G.tint(st, .28), alpha0: .4, edgeColor: ink(st), sw: 1.5 }));
        items.push(G.rightAngle(P2[0], P2[1], P2[2], .16, { color: acc(st) }));
        items.push(E.label([2.0, 0.02, 0], '√3', { size: 11, dy: 14 }));
        items.push(E.label([2.9, 0.52, 0], '1', { size: 11, dx: 12 }));
        items.push(E.label([2.0, 0.6, 0], '2', { size: 11, dy: -6 }));
        items.push(E.label([2.0, -0.28, 0], '30°-60°-90°', { size: 10.5, dy: 10 }));
        items.push(E.label([0.5, 2.5, 0], 'sin30°=1/2 · tan45°=1 · sin60°=√3/2', { size: 10.5, color: acc(st), dy: -2 }));
      } else {
        const R = 1.4, cy = 1.15;
        items.push(E.poly(circlePts(R, 80, cy), { closed: true, color: ink(st), sw: 1.3 }));
        items.push(E.line([R, cy - 0.2, 0], [R, cy + 2.2, 0], { color: acc(st), sw: 1.4 }));
        items.push(E.label([R, cy + 2.3, 0], 'x = 1', { size: 10.5, dy: -6, color: acc(st) }));
        [PV(c, 'deg', 50)].forEach(deg => {
          const dr = deg * Math.PI / 180;
          GX.gauges = [['θ', F2(deg) + '°'], ['sinθ', F2(Math.sin(dr))], ['cosθ', F2(Math.cos(dr))], ['tanθ', F2(Math.tan(dr))]];
          if (deg > 80) GX.verdict = { text: '推过头：θ→90°，射线与切线 x=1 越跑越平行，交点逃到无穷远——tan90° 不存在，不是很大。', danger: true };
          const a = deg * Math.PI / 180;
          const P = [R * Math.cos(a), cy + R * Math.sin(a), 0];
          const T2 = [R, cy + R * Math.tan(a), 0];
          items.push(E.line([0, cy, 0], T2, { color: ink(st), sw: 1, alpha: .55, dash: [4, 4] }));
          items.push(E.point(P, { r: 2.8, color: ink(st) }));
          items.push(E.point(T2, { r: 3, color: acc(st) }));
          items.push(E.label(T2, 'tan' + deg + '°', { size: 9.5, dx: 12, dy: -4, align: 'left', color: acc(st) }));
        });
        items.push(E.label([0.1, 0.2, 0], 'tanθ = 对边 / 邻边', { size: 11, dy: 14 }));
      }
      return { items, fit: 1.02, gauges: GX.gauges, verdict: GX.verdict };
    },
  };

  /* ================= 19 应试要求 ================= */
  const EXAM = {
    name: '应试 · 规范与策略',
    camera: { yaw: -0.46, pitch: 0.26, zoom: 1.0, offset: [0, 0.9, 0] },
    modes: [
      { id: 'tree', name: '分类讨论', note: '分类讨论要<b>不重不漏</b>，最后写“综上所述”；分类标准写在最前面，每一类给出结论。' },
      { id: 'stack', name: '答题规范', note: '书写规范本身就是分数：结论、条件、定义域、取等条件、单调区间的连接符，都要写清。' },
      { id: 'radical', name: '嵌套根式', note: '强制开根号：√(a±√b) 可以化成两个根式之差/和，几何上就是“斜边减去一条直角边”。' },
    ],
    build(t, c) {
      const st = c.st, items = [];
      const GX = { gauges: null, verdict: null };
      if (c.mode === 'tree') {
        GX.gauges = [['分类数', Math.round(PV(c, 'cases', 3))], ['原则', '不重不漏'], ['收尾', '综上所述']];
        if (Math.round(PV(c, 'cases', 3)) >= 5) GX.verdict = { text: '推过头：分类数爆炸时多半是分类标准选错了——换标准（比如先看符号、再看大小）通常能砍掉一半情况。', danger: true };
        const trunk = G.box({ st, w: .22, h: 1.5, d: .22, cy: 0, cz: 0, tint: G.tint(st, .2), key: 'ex:tr' });
        items.push(trunk.items);
        const branch = (x, y, h, txt, col) => {
          const b = G.box({ st, w: .16, h, d: .16, cx: x, cy: y, tint: col, key: 'ex:b' + x });
          items.push(b.items);
          items.push(E.label([x, y + h + .12, 0], txt, { size: 10, dy: -2 }));
        };
        { const cn = Math.round(PV(c, 'cases', 3)); for (let i = 0; i < cn; i++) { const x = cn === 1 ? 0 : -1.1 + 2.2 * i / (cn - 1); branch(x, 1.5, .55 + ((i * 37) % 40) / 80, '情况' + ['一', '二', '三', '四', '五'][i], G.tint(st, .1 + i * .06)); } }
        items.push(E.label([0, 2.95, 0], '按参数分类 → 分别求解', { size: 11.5, color: acc(st), dy: -4 }));
        items.push(E.label([0, 2.6, 0], '最后写「综上所述」', { size: 10.5, dy: -2 }));
      } else if (c.mode === 'stack') {
        const steps = ['结论', '条件', '定义域', '取等', '连接符'];
        steps.forEach((txt, i) => {
          const b = G.box({ st, w: 1.9 - i * .14, h: .17, d: .9, cy: i * .3, tint: G.tint(st, .05 + i * .055), key: 'ex:s' + i });
          items.push(b.items);
          items.push(E.label([1.15, i * .3 + .08, 0], txt, { size: 10.5, dx: 20, align: 'left' }));
        });
        items.push(E.label([0, 1.9, 0], '书写规范 = 分数', { size: 12, color: acc(st), dy: -4 }));
      } else {
        items.push(E.line([-2.2, 0, 0], [2.6, 0, 0], { color: ink(st), sw: 1.3, arrow: true }));
        items.push(E.line([0, 0, 0], [0, 1.9, 0], { color: ink(st), sw: 1.1, arrow: true, alpha: .7 }));
        const p = Math.SQRT2;
        items.push(E.line([0, 0, 0], [p, 0, 0], { color: acc(st), sw: 2.6 }));
        items.push(E.line([0, 0, 0], [1, 0, 0], { color: ink(st), sw: 2.6 }));
        items.push(E.label([p / 2, 0.06, 0], '√2', { size: 11, dy: -12, color: acc(st) }));
        items.push(E.label([0.5, -0.06, 0], '1', { size: 11, dy: 12 }));
        items.push(E.point([p, 0, 0], { r: 3.4, color: acc(st) }));
        items.push(E.point([p - 1, 0, 0], { r: 3.8, color: ink(st), ring: true }));
        items.push(E.label([p - 1, 0, 0], '√2−1 ≈ 0.414', { size: 10.5, dy: -16, dx: 10, align: 'left' }));
        items.push(E.label([0.6, 1.55, 0], '√(3−2√2) = √2−1', { size: 11.5, color: acc(st), dy: -4 }));
        items.push(E.label([0.6, 1.2, 0], '先凑完全平方，再开方', { size: 10.5, dy: -2 }));
      }
      return { items, fit: 1.02, gauges: GX.gauges, verdict: GX.verdict };
    },
  };

  /* ================= 99 高等 ================= */
  const HIGHER = {
    name: '高等 · 超立方与级数',
    camera: { yaw: -0.5, pitch: 0.28, zoom: 1.0, offset: [0, 0.9, 0], dist: 10 },
    anim: true,
    modes: [
      { id: 'tesseract', name: '四维超立方', note: '<b>超立方体</b>是四维空间的正方体：16 个顶点、32 条棱；旋转后在三维中的投影会不断“翻面”。' },
      { id: 'series', name: '级数部分和', note: '<b>级数</b>是无穷项求和的极限：1/2+1/4+1/8+… = 1，部分和逐层逼近。' },
      { id: 'integral', name: '积分与面积', note: '把区间切成许多小矩形，矩形面积和趋近于<b>定积分</b>——这就是黎曼和。' },
    ],
    build(t, c) {
      const st = c.st, items = [];
      const GX = { gauges: null, verdict: null };
      if (c.mode === 'tesseract') {
        GX.gauges = [['顶点', '16'], ['棱', '32'], ['胞（立方体）', '8'], ['投影', '4D→3D']];
        const verts = [];
        for (let i = 0; i < 16; i++) verts.push([(i & 1) ? 1 : -1, (i & 2) ? 1 : -1, (i & 4) ? 1 : -1, (i & 8) ? 1 : -1]);
        const a = t * 0.5, b = t * 0.33;
        const rot = v => {
          let [x, y, z, w] = v;
          let x2 = x * Math.cos(a) - w * Math.sin(a), w2 = x * Math.sin(a) + w * Math.cos(a);
          let y2 = y * Math.cos(b) - z * Math.sin(b), z2 = y * Math.sin(b) + z * Math.cos(b);
          return [x2, y2, z2, w2];
        };
        const proj = v => {
          const [x, y, z, w] = rot(v);
          const s = 1.6 / (2.6 - w);
          return [x * s, 0.9 + y * s, z * s];
        };
        const P = verts.map(proj);
        for (let i = 0; i < 16; i++) {
          for (let bit = 1; bit < 16; bit <<= 1) {
            const j = i ^ bit;
            if (j > i) {
              const near = Math.abs(verts[i][3]) < 0 && Math.abs(verts[j][3]) < 0;
              items.push(E.line(P[i], P[j], { color: (verts[i][3] > 0 && verts[j][3] > 0) ? acc(st) : ink(st), sw: 1.2, alpha: .75 }));
            }
          }
        }
        P.forEach(p => items.push(E.point(p, { r: 2.4, color: ink(st) })));
        items.push(E.label([0, 2.5, 0], '16 顶点 · 32 棱 · 8 胞', { size: 11.5, color: acc(st), dy: -4 }));
      } else if (c.mode === 'series') {
        items.push(...flatAxes(st, { xr: 3.2, yu: 2.2, yd: 0.5 }));
        items.push(E.line([-3, 1.8, 0], [3, 1.8, 0], { color: acc(st), sw: 1.2, dash: [6, 4], alpha: .8 }));
        items.push(E.label([2.9, 1.95, 0], 'S = 1', { size: 11, dx: -4, dy: 10, align: 'right', color: acc(st) }));
        const NT = Math.round(PV(c, 'terms', 7));
        GX.gauges = [['项数 n', NT], ['Sₙ = 1−(1/2)ⁿ', F2(1 - Math.pow(0.5, NT))], ['还差 1−Sₙ', F2(Math.pow(0.5, NT))], ['极限', '1']];
        let s = 0;
        for (let n = 1; n <= NT; n++) {
          s += 1.8 / Math.pow(2, n);
          const x = -2.6 + (n - 1) * 0.78;
          items.push(E.line([x, 0, 0], [x, s, 0], { color: ink(st), sw: 1, alpha: .4 }));
          items.push(E.point([x, s, 0], { r: 3.4, color: acc(st), key: 'hi:s' + n }));
          if (n <= 5) items.push(E.label([x, s, 0], 'S' + ['₁', '₂', '₃', '₄', '₅'][n - 1], { size: 10, dx: 12, dy: -8, align: 'left' }));
        }
      } else {
        items.push(...flatAxes(st, { xr: 3.2, yu: 2.4, yd: 0.4 }));
        const f = x => 0.9 + 0.42 * x + 0.12 * x * x;
        items.push(curve(f, -2.4, 2.4, 120, { st }));
        const n = Math.round(PV(c, 'n', 12));
        let rsum = 0; for (let i = 0; i < n; i++) { const xm = -2.4 + 4.8 * (i + 0.5) / n; rsum += f(xm) * (4.8 / n); }
        const exactI = (0.9 * 2.4 + 0.21 * 2.4 * 2.4 + 0.04 * Math.pow(2.4, 3)) - (0.9 * -2.4 + 0.21 * 2.4 * 2.4 + 0.04 * Math.pow(-2.4, 3));
        GX.gauges = [['矩形数 n', n], ['黎曼和', F2(rsum)], ['精确 ∫', F2(exactI)], ['误差', F2(Math.abs(rsum - exactI))]];
        if (n <= 3) GX.verdict = { text: '推过头：只切 2–3 刀，矩形和离真面积还很远；把 n 拉大，看误差怎样被 Δx 压下去——这就是定积分的定义。', danger: true };
        for (let i = 0; i < n; i++) {
          const x0 = -2.4 + 4.8 * i / n, x1 = -2.4 + 4.8 * (i + 1) / n;
          const h = f((x0 + x1) / 2);
          items.push(E.face([[x0, 0, 0], [x1, 0, 0], [x1, h, 0], [x0, h, 0]], {
            color: G.tint(st, .1 + (i % 3) * .06), alpha0: .34, edgeColor: ink(st), sw: .6,
          }));
        }
        items.push(E.label([0, 2.5, 0], '∑ f(ξᵢ)Δx → ∫ f(x)dx', { size: 12, color: acc(st), dy: -4 }));
      }
      return { items, fit: 1.0, gauges: GX.gauges, verdict: GX.verdict };
    },
  };

  /* ================= 封面 ================= */
  const COVER = {
    name: '封面',
    camera: { yaw: -0.55, pitch: 0.24, zoom: 1.0, offset: [0, 0.8, 0] },
    anim: false,
    modes: [],
    build(t, c) {
      const st = c.st, items = [];
      const cube = G.cube({ st, a: 1.35, key: 'cv:cube' });
      items.push(G.shift(cube.items, [-2.05, 0, 0]));
      const cone = G.cone({ st, r: 0.62, h: 1.45, y0: 0, seg: 48, key: 'cv:cone' });
      items.push(G.shift(cone, [-0.55, 0, 0]));
      const pyr = G.polySolid({ st, n: 4, r: 0.9, h: 1.5, kind: 'pyramid', y0: 0, rot: Math.PI * 0.25, key: 'cv:pyr' });
      items.push(G.shift(pyr.items, [0.9, 0, 0]));
      items.push(G.sphere({ c: [2.45, 0.72, -0.15], r: 0.72, color: G.tint(st, .18), alpha: .92, key: 'cv:ball' }));
      items.push(E.label([2.45, 1.62, -0.15], '球', { size: 10.5, dy: -6, color: acc(st) }));
      for (let i = -3; i <= 3; i++) {
        items.push(E.line([i * 0.95, 0, -1.9], [i * 0.95, 0, 1.9], { color: ink(st), sw: .6, alpha: .1 }));
      }
      items.push(E.line([-2.6, 0, 1.55], [2.9, 0, 1.55], { color: ink(st), sw: .7, alpha: .18 }));
      const bs = (typeof window !== 'undefined' && window.BOOK_STATS) || null;
      const stamp = bs
        ? `${bs.chapters} 章 · ${bs.pages} 页 · ${(bs.formulas / 1000).toFixed(1)}k 处公式`
        : '20 章 · 全书 · 公式全部保留';
      items.push(E.label([0, -0.02, 1.95], stamp, { size: 10.5, dy: 12, color: ink(st) }));
      return { items, fit: 0.98 };
    },
  };

  /* ================= 兜底 ================= */
  const FALLBACK = {
    name: '思维展台',
    camera: CAM3D,
    modes: [{ id: 'a', name: '展台', note: '这一章的图形以文字与公式为主，展台作为阅读节律的“留白”。' }],
    build(t, c) {
      const st = c.st, items = [];
      for (let i = 0; i < 3; i++) {
        const b = G.box({ st, w: 1.6 - i * .28, h: .12, d: 1.6 - i * .28, cy: i * .3, key: 'fb' + i, tint: G.tint(st, .06 + i * .08) });
        items.push(b.items);
      }
      items.push(G.sphere({ c: [0, 1.35, 0], r: .42, color: G.tint(st, .2), alpha: .9, key: 'fb:s' }));
      return { items, fit: 1 };
    },
  };

  window.SCENES = {
    eq: EQ, set: SET, ineq: INEQ, func: FUNC, calc: CALC, trig: TRIG, vec: VEC,
    solid: SOLID, vec3: VEC3, conic: CONIC, seq: SEQ, deriv: DERIV, stat: STAT,
    prob: PROB, comb: COMB, lp: LP, numth: NUMTH, table: TABLE, exam: EXAM,
    higher: HIGHER, cover: COVER, fallback: FALLBACK,
  };
})();
