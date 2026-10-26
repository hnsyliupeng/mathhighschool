/* =============================================================
   problem-models.js · 逐题 3D 几何模型生成器
   每道题不再只播放文字：根据题干关键词生成可旋转、可自动运动的
   几何模型；解析步数决定模型搭到哪一层，时间 t 让关键点动起来。

   API:
     describe(prob) -> { sceneKey, mode, kind, title, camera }
     build(t, { st, prob, step, total }) -> { items, fit, gauges }
     action(prob, model, step, total) -> 当前步的模型动作说明
   ============================================================= */
(function () {
  'use strict';
  const E = window.Ink3D, G = window.Geo, S = window.SCENES, V = E.V;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const F2 = x => { if (!isFinite(x)) return '∞'; const v = Math.round(x * 100) / 100; return (Object.is(v, -0) ? 0 : v).toString(); };
  const ink = st => G.ink(st), acc = st => G.accent(st);
  const plain = prob => [prob.text || ''].concat(prob.stepTexts || []).join(' ');
  const strip = h => String(h || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

  /* ---------- 模式选择：题干关键词命中哪个演示模式 ---------- */
  const KEYWORDS = [
    [/截面|截得|平面截/, 'cut'], [/二面角|平面角/, 'angle'], [/外接球|内切球/, 'ball'],
    [/线面垂直|垂直于平面/, 'perp'], [/线面平行|平行于平面/, 'para'], [/正方体|长方体|棱长/, 'cube'],
    [/法向量/, 'normal'], [/坐标系|建系/, 'sys'], [/椭圆/, 'ellipse'], [/双曲线/, 'hyperbola'],
    [/抛物线/, 'parabola'], [/圆锥|截线/, 'cone'], [/切线|切点/, 'tan'], [/极值|最值/, 'ext'],
    [/单调|增减/, 'mono'], [/曲面|偏导|二元/, 'surf'], [/列联|卡方|χ/, 'table'], [/回归/, 'reg'],
    [/方差|标准差|离散/, 'spread'], [/条件概率/, 'cond'], [/正态/, 'normal'], [/随机游走/, 'walk'],
    [/容斥|交集.*并集/, 'incl'], [/杨辉|二项式/, 'pascal'], [/路径|网格/, 'path'], [/整数.*最优|整点/, 'int'],
    [/可行域|约束/, 'region'], [/目标函数/, 'obj'], [/素数/, 'prime'], [/辗转|最大公约/, 'gcd'], [/同余|模/, 'mod'],
    [/单位圆/, 'unit'], [/特殊角|三角函数值/, 'tri'], [/等差/, 'arith'], [/等比/, 'geom'], [/求和|前 n 项|前n项/, 'sum'],
    [/分段/, 'piece'], [/对勾|双勾/, 'tick'], [/指数|对数函数/, 'exp'], [/二次函数|抛物线.*函数/, 'quad'],
    [/基本不等式|均值/, 'amgm'], [/柯西/, 'cauchy'], [/复数|辐角/, 'complex'], [/乘 i|乘i/, 'rot'], [/对数/, 'log'],
    [/投影/, 'proj'], [/数量积|点积/, 'dot'], [/向量加法|平行四边形/, 'add'], [/并集/, 'union'], [/补集/, 'comp'],
    [/集合|文氏|韦恩/, 'venn'], [/三次/, 'cubic'], [/分式|绝对值/, 'ratio'], [/积分|黎曼/, 'integral'],
    [/级数|无穷.*和/, 'series'], [/四维|超立方|正八胞体/, 'tesseract'], [/分类讨论/, 'tree'], [/嵌套根式|根式/, 'radical'],
    [/答题|规范|步骤分/, 'stack'],
  ];
  function chooseMode(prob, sceneKey) {
    const sc = S[sceneKey];
    if (!sc || !sc.modes || !sc.modes.length) return null;
    const txt = plain(prob);
    let best = sc.modes[0], score = -1;
    sc.modes.forEach(m => {
      let s = 0;
      if (txt.indexOf(m.name) >= 0) s += 6;
      KEYWORDS.forEach(([re, id]) => { if (id === m.id && re.test(txt)) s += 5; });
      if (s > score) { score = s; best = m; }
    });
    return best.id;
  }
  function specOf(sceneKey, mode) {
    return (((window.LABS || {})[sceneKey] || {})[mode]) || null;
  }
  function describe(prob) {
    const sceneKey = prob.scene && S[prob.scene] ? prob.scene : 'fallback';
    const sc = S[sceneKey] || S.fallback;
    const mode = chooseMode(prob, sceneKey) || (sc.modes && sc.modes[0] && sc.modes[0].id) || null;
    const txt = plain(prob);
    let kind = 'scene';
    if (sceneKey === 'conic') {
      if (/抛物线/.test(txt)) kind = 'conic-parabola';
      else if (/双曲线/.test(txt)) kind = 'scene';
      else if (/圆/.test(txt) && /切线|切点/.test(txt) && !/椭圆/.test(txt)) kind = 'conic-circle';
      else kind = 'conic-ellipse';
    }
    const titles = {
      'conic-ellipse': /切线|切点/.test(txt) ? '椭圆 · 焦点弦与两切线交点模型' : '椭圆 · 动态弦模型',
      'conic-parabola': /切线|切点/.test(txt) ? '抛物线 · 焦点弦与切线模型' : '抛物线 · 动态焦点弦模型',
      'conic-circle': '圆 · 外点切线与切点弦模型',
    };
    const modeName = (sc.modes || []).filter(m => m.id === mode).map(m => m.name)[0] || '';
    return {
      sceneKey, mode, kind,
      title: titles[kind] || ((sc.name || '题目模型') + (modeName ? ' · ' + modeName : '')),
      camera: kind.indexOf('conic-') === 0
        ? { yaw: -0.24, pitch: 0.2, zoom: 1.04, offset: [0, 0.02, 0], dist: 9.4, fov: 6.6 }
        : (sc.camera || { yaw: -0.5, pitch: 0.24, zoom: 1 }),
    };
  }

  /* ---------- 通用小件 ---------- */
  function axes(items, st, xr, yr) {
    items.push(E.line([-xr, 0, 0], [xr, 0, 0], { color: ink(st), sw: 1.1, arrow: true, alpha: .75 }));
    items.push(E.line([0, -yr * .55, 0], [0, yr, 0], { color: ink(st), sw: 1.1, arrow: true, alpha: .75 }));
    items.push(E.label([xr, 0, 0], 'x', { dx: 8, dy: 9, size: 12, align: 'left' }));
    items.push(E.label([0, yr, 0], 'y', { dx: 9, dy: -4, size: 12, align: 'left' }));
    items.push(E.label([0, 0, 0], 'O', { dx: -11, dy: 12, size: 11 }));
  }
  function mark(items, st, p, name, color, dx, dy) {
    items.push(E.point([p[0], p[1], 0], { r: 4, color: color || acc(st), ring: true, key: 'pm:' + name }));
    items.push(E.label([p[0], p[1], 0], name, { dx: dx == null ? 10 : dx, dy: dy == null ? -10 : dy, size: 12, color: color || acc(st), align: 'left' }));
  }
  function seg(items, a, b, o) { items.push(E.line([a[0], a[1], 0], [b[0], b[1], 0], o || {})); }
  function reveal(step, total, layer) {
    if (total <= 1) return true;
    if (step <= 0) return layer === 0;
    const cut1 = Math.max(1, Math.round(total * 0.34)), cut2 = Math.max(2, Math.round(total * 0.67));
    return layer === 0 || (layer === 1 && step >= 1) || (layer === 2 && step >= cut1) || (layer === 3 && step >= cut2);
  }

  /* ---------- 解析几何专属：椭圆/抛物线焦点弦 + 切线 ---------- */
  function conicFocal(t, ctx, isPara) {
    const st = ctx.st, prob = ctx.prob, step = ctx.step, total = ctx.total;
    const txt = plain(prob), items = [];
    axes(items, st, 3.25, 2.35);
    const withTan = /切线|切点|FM|F M/.test(txt);
    const withMid = /中点|轨迹|定点|弦/.test(txt);
    const phase = t * 0.45 + step * 0.1;
    const ang = (isPara ? 0.95 : 1.02) + 0.34 * Math.sin(phase);
    const u = [Math.cos(ang), Math.sin(ang)];
    let A, B, F, gauges = [];
    if (!isPara) {
      const a = 2.35, b = 1.38, c = Math.sqrt(a * a - b * b);
      F = /右焦点|F\(1|F（1/.test(txt) ? [c, 0] : [-c, 0];
      const dx = F[0] < 0 ? -a * a / c : a * a / c;
      const curve = [];
      for (let i = 0; i <= 96; i++) { const q = i / 96 * Math.PI * 2; curve.push([a * Math.cos(q), b * Math.sin(q), 0]); }
      items.push(E.face(curve.slice(0, 97).map(p => p), { color: acc(st), alpha0: .07, edgeColor: 'transparent', sw: 0 }));
      items.push(E.poly(curve, { closed: true, color: ink(st), sw: 2.3, key: 'pm:ellipse' }));
      seg(items, [dx, -2.05], [dx, 2.05], { color: acc(st), sw: 1.2, dash: [6, 5], alpha: .8 });
      items.push(E.label([dx, 2.05, 0], F[0] < 0 ? '左准线 x=−a²/c' : '右准线 x=a²/c', { dx: F[0] < 0 ? -8 : 8, dy: -6, size: 10.5, color: acc(st), align: F[0] < 0 ? 'right' : 'left' }));
      mark(items, st, F, 'F', acc(st));
      mark(items, st, [-F[0], 0], F[0] < 0 ? 'F₂' : 'F₁', ink(st), -18, -8);
      const Aq = (u[0] * u[0]) / (a * a) + (u[1] * u[1]) / (b * b);
      const Bq = 2 * (F[0] * u[0] / (a * a) + F[1] * u[1] / (b * b));
      const Cq = (F[0] * F[0]) / (a * a) - 1;
      const disc = Math.sqrt(Math.max(0, Bq * Bq - 4 * Aq * Cq));
      const s1 = (-Bq - disc) / (2 * Aq), s2 = (-Bq + disc) / (2 * Aq);
      A = [F[0] + s1 * u[0], F[1] + s1 * u[1]]; B = [F[0] + s2 * u[0], F[1] + s2 * u[1]];
      gauges = [['曲线', '椭圆 a=' + F2(a) + ', b=' + F2(b)], ['焦点 F', '(' + F2(F[0]) + ',0)'], ['AB 方向角', F2(ang * 180 / Math.PI) + '°']];
      if (reveal(step, total, 1)) {
        seg(items, A, B, { color: acc(st), sw: 2.6, layer: 'top', key: 'pm:AB' });
        mark(items, st, A, 'A'); mark(items, st, B, 'B');
        if (withMid) {
          const M0 = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
          mark(items, st, M0, 'M₀', ink(st), 8, 12);
          gauges.push(['弦中点 M₀', '(' + F2(M0[0]) + ',' + F2(M0[1]) + ')']);
        }
      }
      if (withTan && reveal(step, total, 2)) {
        const tanSeg = P => {
          const g = [P[0] / (a * a), P[1] / (b * b)], L = Math.hypot(g[0], g[1]) || 1;
          const d = [-g[1] / L, g[0] / L];
          return [[P[0] - d[0] * 1.65, P[1] - d[1] * 1.65], [P[0] + d[0] * 1.65, P[1] + d[1] * 1.65]];
        };
        const ta = tanSeg(A), tb = tanSeg(B);
        seg(items, ta[0], ta[1], { color: ink(st), sw: 1.7, layer: 'top' });
        seg(items, tb[0], tb[1], { color: ink(st), sw: 1.7, layer: 'top' });
        if (reveal(step, total, 3)) {
          const gA = [A[0] / (a * a), A[1] / (b * b)], gB = [B[0] / (a * a), B[1] / (b * b)];
          const det = gA[0] * gB[1] - gA[1] * gB[0];
          if (Math.abs(det) > 1e-6) {
            const M = [(gB[1] - gA[1]) / det, (gA[0] - gB[0]) / det];
            mark(items, st, M, 'M', acc(st), 10, -12);
            seg(items, F, M, { color: acc(st), sw: 2.2, dash: [5, 4], layer: 'top' });
            const dot = (M[0] - F[0]) * u[0] + (M[1] - F[1]) * u[1];
            gauges.push(['M', '(' + F2(M[0]) + ',' + F2(M[1]) + ')'], ['准线 x', F2(dx)], ['FM·AB', F2(dot) + ' ≈ 0']);
          }
        }
      }
    } else {
      F = [-0.1, 0];
      const curve = [];
      for (let i = 0; i <= 80; i++) { const y = -2.15 + 4.3 * i / 80; curve.push([y * y / 4 - 1.1, y, 0]); }
      items.push(E.poly(curve, { color: ink(st), sw: 2.3, key: 'pm:parabola' }));
      seg(items, [-2.1, -2.05], [-2.1, 2.05], { color: acc(st), sw: 1.2, dash: [6, 5], alpha: .8 });
      items.push(E.label([-2.1, 2.05, 0], '准线 x=−2.1', { dx: -8, dy: -6, size: 10.5, color: acc(st), align: 'right' }));
      mark(items, st, F, 'F', acc(st));
      const Aq = u[1] * u[1] / 4, Bq = -u[0], Cq = F[0] + 1.1;
      const disc = Math.sqrt(Math.max(0, Bq * Bq - 4 * Aq * Cq));
      const s1 = (-Bq - disc) / (2 * Aq), s2 = (-Bq + disc) / (2 * Aq);
      A = [F[0] + s1 * u[0], s1 * u[1]]; B = [F[0] + s2 * u[0], s2 * u[1]];
      gauges = [['曲线', 'y²=4(x+1.1)'], ['焦点 F', '(-0.1,0)'], ['AB 方向角', F2(ang * 180 / Math.PI) + '°']];
      if (reveal(step, total, 1)) {
        seg(items, A, B, { color: acc(st), sw: 2.6, layer: 'top' });
        mark(items, st, A, 'A'); mark(items, st, B, 'B');
      }
      if (withTan && reveal(step, total, 2)) {
        const tanSeg = P => {
          const d0 = [P[1] / 2, 1], L = Math.hypot(d0[0], d0[1]) || 1, d = [d0[0] / L, d0[1] / L];
          return [[P[0] - d[0] * 1.5, P[1] - d[1] * 1.5], [P[0] + d[0] * 1.5, P[1] + d[1] * 1.5]];
        };
        const ta = tanSeg(A), tb = tanSeg(B);
        seg(items, ta[0], ta[1], { color: ink(st), sw: 1.7, layer: 'top' });
        seg(items, tb[0], tb[1], { color: ink(st), sw: 1.7, layer: 'top' });
        if (reveal(step, total, 3)) {
          const line = (P, Q) => [Q[1] - P[1], P[0] - Q[0], Q[0] * P[1] - P[0] * Q[1]];
          const l1 = line(ta[0], ta[1]), l2 = line(tb[0], tb[1]), det = l1[0] * l2[1] - l1[1] * l2[0];
          if (Math.abs(det) > 1e-6) {
            const M = [(l1[1] * l2[2] - l1[2] * l2[1]) / det, (l1[2] * l2[0] - l1[0] * l2[2]) / det];
            mark(items, st, M, 'M', acc(st), 10, -12);
            seg(items, F, M, { color: acc(st), sw: 2.2, dash: [5, 4], layer: 'top' });
            gauges.push(['M', '(' + F2(M[0]) + ',' + F2(M[1]) + ')'], ['FM·AB', F2((M[0] - F[0]) * u[0] + (M[1] - F[1]) * u[1]) + ' ≈ 0']);
          }
        }
      }
    }
    items.push(E.label([0, -2.48, 0], withTan ? '焦点弦两端切线的交点始终落在准线上' : '动弦端点与中点随直线转动', { size: 11, dy: 12, color: acc(st) }));
    return { items, fit: 1.0, gauges };
  }

  /* ---------- 圆的外点切线模型 ---------- */
  function conicCircle(t, ctx) {
    const st = ctx.st, step = ctx.step, total = ctx.total, items = [];
    axes(items, st, 3.3, 2.3);
    const r = 1.62, pts = [];
    for (let i = 0; i <= 96; i++) { const q = i / 96 * Math.PI * 2; pts.push([r * Math.cos(q), r * Math.sin(q), 0]); }
    items.push(E.poly(pts, { closed: true, color: ink(st), sw: 2.3 }));
    mark(items, st, [0, 0], 'O', ink(st), -16, 14);
    const P = [3.05, 0.62 + 0.34 * Math.sin(t * 0.5 + step * 0.12)];
    mark(items, st, P, 'P', acc(st), 10, -10);
    const d2 = P[0] * P[0] + P[1] * P[1], base = r * r / d2;
    const h = r * Math.sqrt(Math.max(0, d2 - r * r)) / d2;
    const perp = [-P[1], P[0]];
    const A = [base * P[0] + h * perp[0], base * P[1] + h * perp[1]];
    const B = [base * P[0] - h * perp[0], base * P[1] - h * perp[1]];
    if (reveal(step, total, 1)) { mark(items, st, A, 'A'); mark(items, st, B, 'B'); seg(items, [0, 0], A, { color: ink(st), sw: 1.2, dash: [4, 4] }); seg(items, [0, 0], B, { color: ink(st), sw: 1.2, dash: [4, 4] }); }
    if (reveal(step, total, 2)) { seg(items, P, A, { color: acc(st), sw: 2.4, layer: 'top' }); seg(items, P, B, { color: acc(st), sw: 2.4, layer: 'top' }); }
    if (reveal(step, total, 3)) seg(items, A, B, { color: acc(st), sw: 1.8, dash: [5, 4], layer: 'top' });
    const tl = Math.sqrt(Math.max(0, d2 - r * r));
    return { items, fit: 1.0, gauges: [['半径 r', F2(r)], ['|OP|', F2(Math.sqrt(d2))], ['切线长', F2(tl)], ['切点弦 AB', reveal(step, total, 3) ? '已作出' : '待作']] };
  }

  /* ---------- 通用模型：调用本章场景，按解析进度插值参数 ---------- */
  function paramsFor(model, step, total, t) {
    const spec = specOf(model.sceneKey, model.mode);
    const out = {};
    if (!spec) return out;
    const p = total > 0 ? clamp(step / total, 0, 1) : 1;
    (spec.controls || []).forEach((ct, idx) => {
      if (ct.type === 'trigger') { out[ct.id] = Math.max(0, Math.min(4, step)); return; }
      let v = ct.val;
      if (spec.brk && spec.brk.params && typeof spec.brk.params[ct.id] === 'number') v = ct.val + (spec.brk.params[ct.id] - ct.val) * p;
      if (idx === 0) v += Math.sin(t * 0.65) * (ct.max - ct.min) * 0.035;
      out[ct.id] = clamp(Math.round(v / ct.step) * ct.step, ct.min, ct.max);
    });
    return out;
  }
  function build(t, ctx) {
    const model = ctx.model || describe(ctx.prob);
    if (model.kind === 'conic-ellipse') return conicFocal(t, ctx, false);
    if (model.kind === 'conic-parabola') return conicFocal(t, ctx, true);
    if (model.kind === 'conic-circle') return conicCircle(t, ctx);
    const sc = S[model.sceneKey] || S.fallback;
    const r = sc.build(t, { st: ctx.st, mode: model.mode, params: paramsFor(model, ctx.step, ctx.total, t) });
    return r || { items: [], gauges: [] };
  }
  function action(prob, model, step, total) {
    if (!model) return '';
    if (model.kind.indexOf('conic-') === 0) {
      if (total <= 1) return '完整模型：动弦、切线、交点与验证仪表同时呈现，模型持续转动';
      if (step <= 0) return '第 1 层：把题放进坐标系——画曲线、焦点与准线';
      if (step >= total && total > 1) return '最后一层：连线验证——交点位置与点积由模型实时算出';
      if (reveal(step, total, 3) && step > 1) return '第 4 层：作交点 M，连 FM，读仪表验证结论';
      if (reveal(step, total, 2) && step > 1) return '第 3 层：在 A、B 两点作切线 / 切点弦';
      return '第 2 层：过焦点的动直线交曲线于 A、B，直线持续转动';
    }
    const sc = S[model.sceneKey] || {};
    const m = (sc.modes || []).find(x => x.id === model.mode);
    const note = m ? strip(m.note) : '';
    if (step <= 0) return '第 1 层：先摆出本题的几何模型' + (note ? '——' + note : '');
    if (step >= total && total > 1) return '最后一层：参数推到目标/临界状态，对照仪表读结论';
    return '模型随解析推进：关键参数从初始值连续变到目标状态，图形与仪表同步重算';
  }

  window.PROBLEM_MODELS = { describe, build, action, chooseMode };
})();
