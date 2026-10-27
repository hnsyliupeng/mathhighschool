/* =============================================================
   three-watch.js · 真 3D 推演引擎（Three.js / WebGL）
   参考 every-joule 的 Watch 演示机制重构全书自动演示：
   每个课题 = 一组镜头(shots)，每镜 = 相机球面移动 + 模型参数插值
   + 同步字幕(caption)。翻到页/打开题即自动开播，空格暂停、
   Esc 停止并还原，进度圆点与公式步号共用同一节拍。
   模型按「族」构建：curve(函数板) vec2(向量板) venn region
   solid(立体) vec3(空间向量) conic(圆锥曲线) cone(圆锥截面)
   surf(曲面) bars(条形/点阵)。参数与实验室 LABS 同源(labs.js)。
   对外 API：
     TW3.available
     TW3.Watch(canvas, {onShot(i,caption), onProgress(q), onGauges(g), onEnd()})
       .load(spec) .play() .pause() .toggle() .seek(i) .setDur(ms) .stop()
     TW3.specForMode(sceneKey, mode, captions?) -> spec
     TW3.specForProblem(prob) -> spec
   spec = { family, sceneKey, mode, kind, def:{}, brk:{}, shots:[{caption,dur?}], title }
   ============================================================= */
(function () {
  'use strict';
  const T = window.THREE;
  if (!T) { window.TW3 = { available: false }; return; }

  const INK = 0x2b2823, PAPER = 0xfbf6e9, TINT = 0xefdcc6, ACC = 0xd9503a, ACC2 = 0x38659f, ACC3 = 0x2e7d52, GOLD = 0xc8961e;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const F2 = x => { if (!isFinite(x)) return '∞'; const v = Math.round(x * 100) / 100; return (Object.is(v, -0) ? 0 : v).toString(); };
  const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  /* ---------- 基础件 ---------- */
  function mat(color, op) {
    return new T.MeshStandardMaterial({ color, roughness: .85, metalness: 0, transparent: op != null && op < 1, opacity: op == null ? 1 : op, side: T.DoubleSide });
  }
  function inkEdges(mesh, op) {
    const e = new T.LineSegments(new T.EdgesGeometry(mesh.geometry, 24),
      new T.LineBasicMaterial({ color: INK, transparent: true, opacity: op == null ? .8 : op }));
    mesh.add(e); return mesh;
  }
  function box(w, h, d, color, op) { return inkEdges(new T.Mesh(new T.BoxGeometry(w, h, d), mat(color, op))); }
  function ball(r, color) { return new T.Mesh(new T.SphereGeometry(r, 20, 14), mat(color)); }
  function tube(points, color, r, closed) {
    if (points.length < 2) return new T.Group();
    const curve = new T.CatmullRomCurve3(points, !!closed, 'catmullrom', .08);
    return new T.Mesh(new T.TubeGeometry(curve, Math.max(16, points.length * 2), r || .028, 7, !!closed), mat(color));
  }
  function line(points, color, op) {
    const g = new T.BufferGeometry().setFromPoints(points);
    return new T.Line(g, new T.LineBasicMaterial({ color, transparent: true, opacity: op == null ? .9 : op }));
  }
  function dashed(points, color) {
    const l = line(points, color, .75); l.computeLineDistances();
    l.material = new T.LineDashedMaterial({ color, dashSize: .14, gapSize: .09, transparent: true, opacity: .8 });
    l.computeLineDistances(); return l;
  }
  function arrow(color) {
    const g = new T.Group();
    const shaft = new T.Mesh(new T.CylinderGeometry(.032, .032, 1, 8), mat(color));
    const head = new T.Mesh(new T.ConeGeometry(.1, .3, 12), mat(color));
    g.add(shaft, head); g.userData = { shaft, head };
    g.setArrow = (a, b) => {
      const d = new T.Vector3().subVectors(b, a), len = Math.max(d.length(), .001);
      g.position.copy(a);
      g.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.clone().normalize());
      shaft.scale.set(1, Math.max(len - .28, .01), 1); shaft.position.y = (len - .28) / 2;
      head.position.y = len - .15;
      g.visible = len > .02;
    };
    return g;
  }
  function label(text, color, scale) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const x = c.getContext('2d');
    x.font = '600 56px "Kaiti SC","STKaiti",serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.shadowColor = 'rgba(251,246,233,.95)'; x.shadowBlur = 10;
    x.fillStyle = color || '#2b2823'; x.fillText(text, 128, 64);
    const sp = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), transparent: true, depthTest: false }));
    sp.scale.set(1.15 * (scale || 1), .58 * (scale || 1), 1); sp.renderOrder = 5;
    return sp;
  }
  const V3 = (x, y, z) => new T.Vector3(x, y, z);

  /* 画板（立起来的纸面，带厚度）——2D 族共用 */
  function makeBoard() {
    const g = new T.Group();
    const b = box(7.8, 5.4, .16, PAPER); b.position.set(0, 2.7, -.35); g.add(b);
    const grid = new T.Group();
    for (let i = -3; i <= 3; i++) grid.add(line([V3(i, .25, -.25), V3(i, 5.15, -.25)], 0xd8c9a8, .5));
    for (let i = 0; i <= 5; i++) grid.add(line([V3(-3.7, i + .2, -.25), V3(3.7, i + .2, -.25)], 0xd8c9a8, .5));
    g.add(grid);
    g.userData.map = (x, y) => V3(x, y + 2.7, -.18);
    return g;
  }
  function ground() {
    const g = new T.Group();
    const p = box(8.2, .16, 6.2, TINT); p.position.y = -.08; g.add(p);
    for (let i = -4; i <= 4; i++) {
      g.add(line([V3(i, .01, -3), V3(i, .01, 3)], 0xcbb488, .45));
      g.add(line([V3(-4, .01, i * .75), V3(4, .01, i * .75)], 0xcbb488, .45));
    }
    return g;
  }
  function axes3(len) {
    const g = new T.Group();
    [['x', V3(len, 0, 0), ACC], ['y', V3(0, len, 0), ACC3], ['z', V3(0, 0, len), ACC2]].forEach(([n, to, c]) => {
      const a = arrow(c); a.setArrow(V3(0, 0, 0), to); g.add(a);
      const l = label(n, '#' + new T.Color(c).getHexString()); l.position.copy(to).multiplyScalar(1.12); g.add(l);
    });
    return g;
  }

  /* ---------- 族 1：函数板 curve ---------- */
  const CURVE_FN = {
    'eq.quad': p => x => p.a * x * x + p.b * x + p.c,
    'func.quad': p => x => p.a * x * x + p.b * x + p.c,
    'eq.cubic': p => x => x * x * x - 3 * p.p * x,
    'eq.ratio': p => x => 1 / (x - p.aa) + p.hh,
    'func.exp': p => x => Math.pow(p.base, x),
    'func.tick': p => x => x + p.a / x,
    'func.piece': p => x => x < p.bp ? x * x - 1 : .6 * x + .4,
    'calc.log': p => x => Math.pow(10, x - 1),
    'trig.wave': p => x => p.A * Math.sin(p.om * x),
    'deriv.tan': p => x => x * x * x / 3 - x,
    'deriv.ext': p => x => x * x * x / 3 - p.dc * x,
    'deriv.mono': p => x => x * x * x / 3 - x,
    'higher.integral': p => x => Math.sin(x) + 1.2,
    'higher.series': p => x => Math.sin(x) / Math.max(Math.abs(x), .3) * 1.4 + 1.2,
    'prob.normal': p => x => Math.exp(-((x - p.mu) ** 2) / (2 * p.sig * p.sig)) * 2.2,
    'deriv.surf': p => x => x,
  };
  function buildCurve(ctx) {
    const g = new T.Group(); const board = makeBoard(); g.add(board);
    const M = board.userData.map;
    const key = ctx.sceneKey + '.' + ctx.mode;
    const holder = new T.Group(); g.add(holder);
    const probe = ball(.085, ACC); g.add(probe);
    const tanA = arrow(ACC); g.add(tanA);
    const barsG = new T.Group(); g.add(barsG);
    const ptA = ball(.07, ACC2), ptB = ball(.07, ACC2); g.add(ptA, ptB);
    const lb = label('y=f(x)', '#38659f'); lb.position.copy(M(2.2, 1.9)); g.add(lb);
    let sig = '';
    function rebuild(p, t) {
      const fn = (CURVE_FN[key] || (pp => x => pp.a * x * x + pp.b * x + pp.c))(p);
      const s2 = key + '|' + Object.values(p).map(v => (+v).toFixed(3)).join(',');
      if (s2 !== sig) {
        sig = s2;
        while (holder.children.length) { const c = holder.children.pop(); c.geometry && c.geometry.dispose(); holder.remove(c); }
        const pts = [];
        for (let x = -3.2; x <= 3.2; x += .08) { const y = fn(x); if (isFinite(y) && Math.abs(y) < 12) pts.push(M(x * .95, clamp(y * .8, -2.2, 2.2))); else if (pts.length > 1) { holder.add(tube(pts, ACC2, .032)); pts.length = 0; } }
        if (pts.length > 1) holder.add(tube(pts, ACC2, .032));
        barsG.clear();
        if (ctx.mode === 'integral' || ctx.mode === 'series' || key === 'higher.integral' || key === 'higher.series') {
          const n = Math.max(1, Math.round(p.n || p.terms || 8));
          for (let i = 0; i < n; i++) {
            const x = -2.6 + i * (5.2 / n), h = clamp(fn(x / .95) * .8, -.1, 2.2);
            const bMesh = box(.34, Math.max(h, .02), .3, i % 2 ? GOLD : ACC3, .55);
            const pos = M(x, 0); bMesh.position.set(pos.x, .25 + Math.max(h, .02) / 2 + 2.45 - 2.7 + .25, .05); bMesh.position.y = .3 + Math.max(h, .02) / 2; bMesh.position.z = -.05;
            barsG.add(bMesh);
          }
        }
      }
      return fn;
    }
    return {
      group: g,
      update(p, t) {
        const fn = rebuild(p, t);
        let x0 = p.x0 != null ? p.x0 : (p.px != null ? p.px : (p.ex != null ? p.ex : Math.sin(t * .5) * 1.6));
        if (ctx.autoplay) x0 = clamp(Math.sin(t * .55) * 2.2, -2.6, 2.6);
        const y0 = fn(x0), pos = M(x0 * .95, clamp(y0 * .8, -2.2, 2.2));
        probe.position.copy(pos);
        const h = .01, sl = (fn(x0 + h) - fn(x0 - h)) / (2 * h);
        const dx = .8, dy = clamp(sl * dx * .8, -1.6, 1.6);
        tanA.setArrow(M(x0 * .95 - dx * .95, clamp((y0 - sl * dx) * .8, -2.3, 2.3)), M(x0 * .95 + dx * .95, clamp((y0 + sl * dx) * .8, -2.3, 2.3)));
        ptA.visible = ptB.visible = false;
        if (key === 'eq.quad' || key === 'func.quad') {
          const D = p.b * p.b - 4 * p.a * p.c;
          if (D >= 0 && p.a !== 0) {
            const r1 = (-p.b - Math.sqrt(D)) / (2 * p.a), r2 = (-p.b + Math.sqrt(D)) / (2 * p.a);
            ptA.visible = ptB.visible = true;
            ptA.position.copy(M(r1 * .95, 0)); ptB.position.copy(M(r2 * .95, 0));
          }
        }
        this._fn = fn; this._x0 = x0;
      },
      gauges(p) {
        const fn = this._fn || (CURVE_FN[key] || (() => x => 0))(p), x0 = this._x0 || 0;
        const h = .01, d = (fn(x0 + h) - fn(x0 - h)) / (2 * h);
        const out = [['探针 x', F2(x0)], ['f(x)', F2(fn(x0))], ['斜率 f′(x)', F2(d)]];
        if (key === 'eq.quad' || key === 'func.quad') out.push(['Δ=b²−4ac', F2(p.b * p.b - 4 * p.a * p.c)]);
        if (key === 'func.exp') out.push(['底数 a', F2(p.base)]);
        if (key === 'trig.wave') out.push(['周期 2π/ω', F2(2 * Math.PI / p.om)]);
        if (key === 'prob.normal') out.push(['μ', F2(p.mu)], ['σ', F2(p.sig)]);
        return out;
      },
    };
  }

  /* ---------- 族 2：向量板 vec2（平面向量/复数/单位圆/三角） ---------- */
  function buildVec2(ctx) {
    const g = new T.Group(); const board = makeBoard(); g.add(board);
    const M = board.userData.map;
    const circle = tube(Array.from({ length: 65 }, (_, i) => { const a = i / 64 * Math.PI * 2; return M(Math.cos(a) * 1.5, Math.sin(a) * 1.5); }), INK, .02, true);
    const showCircle = ['circle', 'sum', 'unit', 'rot', 'complex'].includes(ctx.mode) || ctx.sceneKey === 'table';
    if (showCircle) g.add(circle);
    const aA = arrow(ACC), bA = arrow(ACC2), sA = arrow(ACC3), pA = arrow(GOLD);
    g.add(aA, bA, sA, pA);
    const dot = ball(.09, INK); g.add(dot);
    const lA = label('a', '#d9503a'), lB = label('b', '#38659f'), lS = label('a+b', '#2e7d52');
    g.add(lA, lB, lS);
    const tri = ctx.sceneKey === 'table';
    return {
      group: g,
      update(p, t) {
        const ang = (p.ang != null ? p.ang : (p.deg != null ? p.deg : 62)) * Math.PI / 180;
        const th = p.th != null ? p.th * Math.PI / 180 : ang;
        const A = V3(0, 0, 0);
        let va, vb;
        if (ctx.mode === 'complex' || ctx.mode === 'rot') {
          const k = ctx.mode === 'rot' ? (p.k || 0) + (ctx.autoplay ? Math.floor(t / 1.4) % 4 : 0) : 0;
          const re = p.re != null ? p.re : 1.25, im = p.im != null ? p.im : 1.45;
          const rot = k * Math.PI / 2, cr = Math.cos(rot), sr = Math.sin(rot);
          va = { x: 1.6, y: 0 }; vb = { x: (re * cr - im * sr) * .9, y: (re * sr + im * cr) * .9 };
        } else if (showCircle && ctx.mode !== 'sum') {
          va = { x: Math.cos(th) * 1.5, y: Math.sin(th) * 1.5 }; vb = { x: va.x, y: 0 };
        } else if (ctx.mode === 'sum') {
          const al = (p.al || 36) * Math.PI / 180, be = (p.be || 28) * Math.PI / 180;
          va = { x: Math.cos(al) * 1.7, y: Math.sin(al) * 1.7 }; vb = { x: Math.cos(al + be) * 1.7, y: Math.sin(al + be) * 1.7 };
        } else if (tri) {
          const leg = p.leg || 2, sh = p.short || 1.04;
          va = { x: leg * .8, y: 0 }; vb = { x: leg * .8, y: sh * 1.1 };
        } else { va = { x: 1.9, y: .3 }; vb = { x: Math.cos(ang) * 1.7, y: Math.sin(ang) * 1.7 }; }
        const O = M(-1.4, -.9);
        const eA = V3(O.x + va.x, O.y + va.y, O.z), eB = V3(O.x + vb.x, O.y + vb.y, O.z);
        aA.setArrow(O, eA);
        if (ctx.mode === 'complex' || ctx.mode === 'rot' || showCircle) { bA.setArrow(O, eB); sA.visible = false; }
        else {
          bA.setArrow(O, eB);
          sA.setArrow(O, V3(eA.x + vb.x, eA.y + vb.y, O.z));
          pA.setArrow(eA, V3(eA.x + vb.x, eA.y + vb.y, O.z)); pA.visible = ctx.mode === 'add';
        }
        if (showCircle) { dot.position.copy(eA); dot.visible = true; } else dot.visible = false;
        lA.position.copy(eA).add(V3(.25, .2, 0)); lB.position.copy(eB).add(V3(.25, .2, 0));
        lS.visible = sA.visible; if (sA.visible) lS.position.set(eA.x + vb.x + .3, eA.y + vb.y + .2, O.z);
        this._va = va; this._vb = vb;
      },
      gauges(p) {
        const { x: ax, y: ay } = this._va || { x: 0, y: 0 }, { x: bx, y: by } = this._vb || { x: 0, y: 0 };
        const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by), dotv = ax * bx + ay * by;
        if (ctx.mode === 'complex' || ctx.mode === 'rot') return [['实部 a', F2(p.re != null ? p.re : 1.25)], ['虚部 b', F2(p.im != null ? p.im : 1.45)], ['模 |z|', F2(Math.hypot(p.re || 0, p.im || 0))]];
        if (showCircle) return [['θ', F2((p.th != null ? p.th : (p.deg || 45))) + '°'], ['cos θ', F2(Math.cos((p.th || p.deg || 45) * Math.PI / 180))], ['sin θ', F2(Math.sin((p.th || p.deg || 45) * Math.PI / 180))]];
        return [['|a|', F2(la)], ['|b|', F2(lb)], ['a·b', F2(dotv)], ['夹角', F2(Math.acos(clamp(dotv / Math.max(la * lb, 1e-9), -1, 1)) * 180 / Math.PI) + '°']];
      },
    };
  }

  /* ---------- 族 3：集合板 venn ---------- */
  function buildVenn(ctx) {
    const g = new T.Group(); const board = makeBoard(); g.add(board);
    const M = board.userData.map;
    const ring = (color) => tube(Array.from({ length: 49 }, (_, i) => { const a = i / 48 * Math.PI * 2; return V3(Math.cos(a) * 1.35, Math.sin(a) * 1.35, 0); }), color, .035, true);
    const cA = ring(ACC), cB = ring(ACC2); g.add(cA, cB);
    const dots = new T.Group(); g.add(dots);
    for (let i = 0; i < 14; i++) { const d = ball(.055, i < 5 ? ACC3 : INK); d.userData.i = i; dots.add(d); }
    const lA = label('A', '#d9503a'), lB = label('B', '#38659f'); g.add(lA, lB);
    return {
      group: g,
      update(p) {
        const sep = p.sep != null ? p.sep : .45, cy = 2.7;
        cA.position.set(-sep, cy, -.15); cB.position.set(sep, cy, -.15);
        lA.position.set(-sep - 1.2, cy + 1.2, 0); lB.position.set(sep + 1.2, cy + 1.2, 0);
        dots.children.forEach((d, i) => {
          const common = Math.max(0, 1.35 - sep);
          if (i < 5) d.position.set((i - 2) * common * .3, cy + (i % 2 ? .3 : -.25), 0);
          else d.position.set((i % 2 ? -1 : 1) * (sep + .5) + (i - 7) * .12, cy + ((i * 7) % 5 - 2) * .28, 0);
        });
        this._sep = sep;
      },
      gauges(p) { const sep = this._sep || .45; return [['圆心半距', F2(sep)], ['交集元素', sep >= 1.35 ? '0（已分开）' : '≈5 个'], ['关系', sep >= 1.35 ? 'A∩B=∅' : 'A∩B≠∅']]; },
    };
  }

  /* ---------- 族 4：区域板 region（不等式/线性规划/AM-GM/样本空间） ---------- */
  function buildRegion(ctx) {
    const g = new T.Group(); const board = makeBoard(); g.add(board);
    const M = board.userData.map;
    const holder = new T.Group(); g.add(holder);
    const tp = ball(.1, ACC); g.add(tp);
    const lT = label('检验点', '#d9503a', .8); g.add(lT);
    let sig = '';
    return {
      group: g,
      update(p, t) {
        const s2 = Object.values(p).map(v => (+v).toFixed(2)).join(',');
        if (s2 !== sig) {
          sig = s2; holder.clear();
          if (ctx.mode === 'amgm') {
            const a = p.a, b = p.b, u = .85;
            const mk = (x, y, w, h, c) => { const m = box(w * u, h * u, .22, c, .6); const pos = M(x, y); m.position.set(pos.x, pos.y, .02); holder.add(m); };
            mk(-1.4, -.9, a, a, ACC); mk(-1.4 + a * u / 1, -.9, b, a, ACC2); mk(-1.4, -.9 + a * u, a, b, ACC3); mk(-1.4 + a * u, -.9 + a * u, b, b, GOLD);
          } else {
            const s = p.s != null ? p.s : 2.2;
            const poly = [M(-2.6, -1.6), M(-2.6 + s * 1.15, -1.6), M(-2.6, -1.6 + s * 1.15)];
            const shape = new T.Shape([new T.Vector2(poly[0].x, poly[0].y), new T.Vector2(poly[1].x, poly[1].y), new T.Vector2(poly[2].x, poly[2].y)]);
            const fill = new T.Mesh(new T.ShapeGeometry(shape), mat(ACC3, .3)); fill.position.z = -.12; holder.add(fill);
            holder.add(tube([...poly, poly[0]], ACC, .03));
            if (ctx.sceneKey === 'lp') {
              const ca = p.ca || 2, cb = p.cb || 3, k = 2.4 / Math.max(ca + cb, .1);
              holder.add(dashed([M(-2.6, -1.6 + ca * k * 2), M(-2.6 + cb * k * 2, -1.6)], GOLD));
            }
          }
        }
        const tx = p.tx != null ? p.tx : 1, ty = p.ty != null ? p.ty : .8;
        tp.position.copy(M(-2.6 + tx * 1.15, -1.6 + ty * 1.15)); tp.position.z = .1;
        lT.position.copy(tp.position).add(V3(.3, .3, 0));
        this._in = ctx.mode === 'amgm' ? (Math.abs(p.a - p.b) < .05) : (tx + ty <= (p.s || 2.2));
      },
      gauges(p) {
        if (ctx.mode === 'amgm') return [['a', F2(p.a)], ['b', F2(p.b)], ['(a+b)²/4', F2((p.a + p.b) ** 2 / 4)], ['ab', F2(p.a * p.b)], ['取等', Math.abs(p.a - p.b) < .05 ? 'a=b 取等' : 'a≠b']];
        return [['检验点', `(${F2(p.tx || 0)}, ${F2(p.ty || 0)})`], ['x+y', F2((p.tx || 0) + (p.ty || 0))], ['判定', this._in ? '在区域内' : '越界']];
      },
    };
  }

  /* ---------- 族 5：立体 solid ---------- */
  function cubeGroup(edge, color) {
    const c = box(edge, edge, edge, color || PAPER, .92);
    const g = new T.Group(); g.add(c);
    const h = edge / 2;
    const diag = line([V3(-h, -h, -h), V3(h, h, h)], ACC); g.add(diag);
    return g;
  }
  function buildSolid(ctx) {
    const g = new T.Group(); g.add(ground());
    const holder = new T.Group(); g.add(holder);
    const lA = label('A', '#2b2823', .8), lB = label('B', '#2b2823', .8); g.add(lA, lB);
    let sig = '';
    return {
      group: g,
      update(p, t) {
        const s2 = ctx.mode + '|' + Object.values(p).map(v => (+v).toFixed(2)).join(',');
        if (s2 === sig) { holder.rotation.y = Math.sin(t * .3) * .12; return; }
        sig = s2; holder.clear(); holder.rotation.y = 0;
        const edge = p.edge || 2, h = edge / 2;
        if (ctx.mode === 'ball') {
          const c = cubeGroup(edge); c.position.y = h; holder.add(c);
          const sOut = ball(edge * Math.sqrt(3) / 2, ACC2); sOut.material.opacity = .16; sOut.material.transparent = true; sOut.position.y = h; holder.add(sOut);
          const sIn = ball(edge / 2, ACC); sIn.material.opacity = .35; sIn.material.transparent = true; sIn.position.y = h;
          const sc = .75 + .25 * Math.sin(Math.min(edge, 2.6)); sIn.scale.setScalar(1); holder.add(sIn);
        } else if (ctx.mode === 'para' || ctx.mode === 'perp') {
          const c = cubeGroup(edge); c.position.y = h; holder.add(c);
          const tilt = ctx.mode === 'perp' ? (p.tilt || 0) * Math.PI / 180 : 0;
          const sh = ctx.mode === 'para' ? (p.sh || 0) : 0;
          const y = 2.6 - sh * .8;
          const dir = V3(Math.sin(tilt), Math.cos(tilt), 0);
          const a = arrow(ctx.mode === 'perp' ? ACC : ACC2);
          a.setArrow(V3(-1.6, y, .9), V3(-1.6 + dir.x * 2.6, y + dir.y * 2.6 - 2.6 + 1.3, .9)); holder.add(a);
        } else if (ctx.mode === 'cut') {
          const c = cubeGroup(edge); c.position.y = h; holder.add(c);
          const u = p.u != null ? p.u : .5, y = .3 + u * (edge - .6);
          const plane = box(edge * 1.15, .04, edge * 1.15, ACC, .3); plane.position.y = y; holder.add(plane);
          const sec = box(edge * .8, .05, edge * .8, ACC3, .8); sec.position.y = y + .03; holder.add(sec);
        } else if (ctx.mode === 'angle') {
          const hh = p.hh || 2;
          const p1 = box(3, .05, 2.2, PAPER); p1.position.set(-.7, .4, 0); p1.rotation.z = .5; holder.add(p1);
          const p2 = box(3, .05, 2.2, TINT); p2.position.set(-.7 + Math.cos(.5) * 0, .4 + hh * .8, 0); p2.rotation.z = -.35; holder.add(p2);
          const spine = line([V3(-2.2, .4, -1.4), V3(-2.2, .4, 1.4)], ACC); holder.add(spine);
        } else if (ctx.sceneKey === 'higher') {
          const i1 = cubeGroup(1.6), i2 = cubeGroup(3.2);
          i1.position.y = 1.6; i2.position.y = 1.6; i2.children.forEach(c => { if (c.material) c.material = mat(ACC2, .14); });
          holder.add(i1, i2);
          holder.rotation.y = (p.wa || 0) * Math.PI / 180 + Math.sin(t * .4) * .3;
        } else {
          const c = cubeGroup(edge); c.position.y = h; holder.add(c);
          lA.position.set(-h - .3, 0, h + .3); lB.position.set(h + .3, 0, h + .3);
        }
        this._edge = edge;
      },
      gauges(p) {
        const e = this._edge || p.edge || 2;
        if (ctx.mode === 'ball') return [['棱长 a', F2(e)], ['外接球 R=√3a/2', F2(e * Math.sqrt(3) / 2)], ['内切球 r=a/2', F2(e / 2)]];
        if (ctx.mode === 'cut') return [['截面高度 u', F2(p.u || 0)], ['截面', '与底面平行的正方形']];
        if (ctx.mode === 'para') return [['滑移', F2(p.sh || 0)], ['状态', (p.sh || 0) >= 2 ? '直线已落入平面' : '线面平行']];
        if (ctx.mode === 'perp') return [['倾角', F2(p.tilt || 0) + '°'], ['状态', (p.tilt || 0) === 0 ? '线面垂直' : '已倾斜']];
        return [['棱长 a', F2(e)], ['体积 a³', F2(e ** 3)], ['表面积 6a²', F2(6 * e * e)], ['体对角线 √3a', F2(Math.sqrt(3) * e)]];
      },
    };
  }

  /* ---------- 族 6：空间向量 vec3 ---------- */
  function buildVec3(ctx) {
    const g = new T.Group(); g.add(ground()); g.add(axes3(3.4));
    const plane = new T.Mesh(new T.PlaneGeometry(3.6, 3), mat(ACC2, .22));
    plane.rotation.x = -Math.PI / 2; plane.position.set(.8, 1.1, .4); g.add(plane);
    const nA = arrow(ACC), uA = arrow(ACC3), vA = arrow(GOLD);
    g.add(nA, uA, vA);
    const cube = cubeGroup(2); cube.position.set(.6, 1, .4); cube.children.forEach(c => { if (c.material && c.geometry && c.geometry.type === 'BoxGeometry') c.material = mat(PAPER, .35); });
    g.add(cube);
    const lN = label('n', '#d9503a'); g.add(lN);
    return {
      group: g,
      update(p, t) {
        const kk = p.kk != null ? p.kk : (p.k != null ? p.k : -1);
        const phi = (p.phi != null ? p.phi : 32) * Math.PI / 180;
        const n = V3(.4, 1.6, .2).add(V3(kk * .5, 0, kk * .3)).normalize().multiplyScalar(1.9);
        nA.setArrow(V3(.8, 1.1, .4), V3(.8, 1.1, .4).add(n));
        lN.position.copy(V3(.8, 1.1, .4).add(n)).add(V3(.2, .25, 0));
        const th = ctx.autoplay ? t * .5 : phi;
        uA.setArrow(V3(-2.6, .2, -1.6), V3(-2.6 + Math.cos(phi) * 2.2, .2 + Math.sin(phi) * .8, -1.6 + .8));
        vA.setArrow(V3(-2.6, .2, 1.8), V3(-.6, .9, 1.8));
        this._kk = kk;
      },
      gauges(p) {
        const kk = this._kk != null ? this._kk : -1;
        const good = Math.abs(kk + 1) < .01;
        return [['n', `(1, 1, ${F2(kk)})`], ['n·AB', '0'], ['n·BD', F2(-3 * (kk + 1) / 2)], ['判定', good ? 'n⊥平面（法向量）' : '尚未垂直']];
      },
    };
  }

  /* ---------- 族 7：圆锥曲线 conic（板上真曲线+焦点弦+双切线） ---------- */
  function buildConic(ctx) {
    const g = new T.Group(); const board = makeBoard(); g.add(board);
    const M = board.userData.map;
    const holder = new T.Group(); g.add(holder);
    const type = ctx.kind === 'conic-parabola' || ctx.mode === 'parabola' ? 'parabola'
      : ctx.kind === 'conic-circle' ? 'circle'
      : (ctx.mode === 'hyperbola' || /双曲/.test(ctx.title || '')) ? 'hyperbola' : 'ellipse';
    let sig = '';
    function conicPoint(theta) {
      if (type === 'ellipse') { const a = 2.7, b = 1.75; return { x: a * Math.cos(theta), y: b * Math.sin(theta) }; }
      if (type === 'hyperbola') { const a = 1.7, b = 1.35, s = Math.cosh(theta), c = Math.sinh(theta); return { x: a * s, y: b * c }; }
      if (type === 'parabola') { const pp = 1.1, tt = theta; return { x: tt * tt / (2 * pp) - 1.2, y: tt }; }
      return { x: 1.9 * Math.cos(theta), y: 1.9 * Math.sin(theta) };
    }
    return {
      group: g,
      update(p, t) {
        const beta = clamp((p.beta != null ? p.beta : 66) + (ctx.autoplay ? Math.sin(t * .45) * 10 : 0), 4, 176) * Math.PI / 180;
        const s2 = type + beta.toFixed(3);
        if (s2 === sig) return; sig = s2; holder.clear();
        const pts = [];
        if (type === 'hyperbola') {
          [-1, 1].forEach(sgn => { const pp = []; for (let u = -1.5; u <= 1.5; u += .06) { const q = conicPoint(u); pp.push(M(q.x * sgn * .8, q.y * .85)); } holder.add(tube(pp, ACC2, .032)); });
        } else if (type === 'parabola') {
          const pp = []; for (let u = -2.1; u <= 2.1; u += .07) { const q = conicPoint(u); pp.push(M(q.x * .8, q.y * .85)); } holder.add(tube(pp, ACC2, .032));
        } else {
          const pp = []; for (let i = 0; i <= 72; i++) { const q = conicPoint(i / 72 * Math.PI * 2); pp.push(M(q.x * .85, q.y * .85)); } holder.add(tube(pp, ACC2, .032, true));
        }
        /* 焦点与焦点弦 */
        let F, c;
        if (type === 'ellipse') { c = Math.sqrt(2.7 ** 2 - 1.75 ** 2); F = { x: -c, y: 0 }; }
        else if (type === 'hyperbola') { c = Math.sqrt(1.7 ** 2 + 1.35 ** 2); F = { x: -c * .8, y: 0 }; }
        else if (type === 'parabola') { F = { x: -1.2 + 1.1 / 2, y: 0 }; c = .55; }
        else { F = { x: 0, y: 0 }; c = 0; }
        const fM = ball(.09, ACC); fM.position.copy(M(F.x * .85, F.y * .85)); holder.add(fM);
        const lF = label('F', '#d9503a', .85); lF.position.copy(fM.position).add(V3(-.28, -.3, 0)); holder.add(lF);
        /* 弦 AB：过焦点、方向角 beta，与曲线求交（数值采样求交） */
        const dir = { x: Math.cos(beta), y: Math.sin(beta) };
        const ends = [];
        if (type === 'ellipse' || type === 'circle') {
          const a = type === 'circle' ? 1.9 : 2.7, b = type === 'circle' ? 1.9 : 1.75;
          const Aq = (dir.x / (a * .85)) ** 2 + (dir.y / (b * .85)) ** 2;
          const Bq = 2 * (F.x * .85 * dir.x / (a * .85) ** 2 + F.y * dir.y / (b * .85) ** 2);
          const Cq = (F.x / a) ** 2 + (F.y / b) ** 2 - 1;
          const disc = Bq * Bq - 4 * Aq * Cq;
          if (disc > 0) [-1, 1].forEach(sgn => { const tt = (-Bq + sgn * Math.sqrt(disc)) / (2 * Aq); ends.push({ x: F.x + dir.x * tt / .85, y: F.y + dir.y * tt / .85 }); });
        } else if (type === 'parabola') {
          for (let s = -4; s <= 4; s += .02) { const x = F.x + dir.x * s, y = F.y + dir.y * s; const yy = (x + 1.2) * 2 * 1.1; if (Math.abs(y * y - yy) < .09 && Math.abs(y) < 2.2) ends.push({ x, y }); }
          if (ends.length > 2) { ends.sort((m, n) => m.x - n.x); const e1 = ends[0], e2 = ends[ends.length - 1]; ends.length = 0; ends.push(e1, e2); }
        } else { /* hyperbola 近似取两交点 */
          for (let s = .2; s <= 4; s += .02) [-1, 1].forEach(sgn => { const x = F.x + dir.x * s * sgn, y = F.y + dir.y * s * sgn; if (Math.abs((x / 1.7) ** 2 - (y / 1.35) ** 2 - 1) < .06) ends.push({ x, y }); });
          if (ends.length > 2) { ends.sort((m, n) => m.x - n.x); const e1 = ends[0], e2 = ends[ends.length - 1]; ends.length = 0; ends.push(e1, e2); }
        }
        let dotFM = null;
        if (ends.length === 2) {
          const [A, B] = ends;
          holder.add(tube([M(A.x * .85, A.y * .85), M(B.x * .85, B.y * .85)], ACC, .03));
          [A, B].forEach((P, i) => { const d = ball(.075, ACC); d.position.copy(M(P.x * .85, P.y * .85)); holder.add(d); const l = label(i ? 'B' : 'A', '#d9503a', .8); l.position.copy(d.position).add(V3(.22, .22, 0)); holder.add(l); });
          /* 两端切线交点 M（椭圆/抛物线用解析切线，数值求交） */
          const tangent = P => {
            if (type === 'ellipse') return { a: P.x / (2.7 ** 2), b: P.y / (1.75 ** 2), c: 1 };
            if (type === 'parabola') return { a: -1 / (2 * 1.1) * 1, b: P.y / (2 * 1.1) / 1.1 * 1.1, c: 0 }; /* 下方数值法替代 */
            return null;
          };
          let Mx = null;
          if (type === 'ellipse') {
            const t1 = tangent(A), t2 = tangent(B);
            const det = t1.a * t2.b - t2.a * t1.b;
            if (Math.abs(det) > 1e-6) Mx = { x: (t1.c * t2.b - t2.c * t1.b) / det, y: (t1.a * t2.c - t2.a * t1.c) / det };
          } else if (type === 'parabola') {
            /* 抛物线 y²=2px 切线: y0·y = p(x+x0)，坐标平移 x'=x+1.2 */
            const pp = 1.1, t1 = { a: pp, b: A.y, c: pp * ((A.x + 1.2)) }, t2 = { a: pp, b: B.y, c: pp * ((B.x + 1.2)) };
            const det = t1.a * t2.b - t2.a * t1.b;
            if (Math.abs(det) > 1e-6) { const xx = (t1.c * t2.b - t2.c * t1.b) / det, yy = (t1.a * t2.c - t2.a * t1.c) / det; Mx = { x: xx - 1.2, y: yy }; }
          }
          if (Mx && Math.abs(Mx.x) < 6 && Math.abs(Mx.y) < 4) {
            const mM = ball(.08, GOLD); mM.position.copy(M(Mx.x * .85, Mx.y * .85)); holder.add(mM);
            const lM = label('M', '#c8961e', .85); lM.position.copy(mM.position).add(V3(.25, .25, 0)); holder.add(lM);
            holder.add(dashed([M(A.x * .85, A.y * .85), mM.position], GOLD)); holder.add(dashed([M(B.x * .85, B.y * .85), mM.position], GOLD));
            const vx = Mx.x - F.x, vy = Mx.y - F.y, wx = B.x - A.x, wy = B.y - A.y;
            const nl = Math.hypot(vx, vy) * Math.hypot(wx, wy);
            dotFM = nl > 0 ? (vx * wx + vy * wy) / nl : 0;
            holder.add(tube([fM.position, mM.position], GOLD, .024));
          }
          if (type === 'ellipse') {
            const mid = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
            this._sum = Math.hypot(A.x - F.x, A.y - F.y) + Math.hypot(A.x + c, A.y) + 0; /* PF1+PF2 近似用 A 点 */
            this._pf = Math.hypot(A.x - F.x, A.y - F.y) + Math.hypot(A.x + 2 * c * 0 + c, A.y - F.y);
          }
        }
        this._dotFM = dotFM; this._beta = beta * 180 / Math.PI;
        this._type = type;
      },
      gauges(p) {
        const out = [['类型', { ellipse: '椭圆', hyperbola: '双曲线', parabola: '抛物线', circle: '圆' }[this._type || 'ellipse']], ['弦转角 β', F2(this._beta || 0) + '°']];
        if (this._dotFM != null) out.push(['FM·AB', '≈ ' + F2(this._dotFM)]);
        if (this._type === 'ellipse') out.push(['2a', '5.40'], ['2c', F2(2 * Math.sqrt(2.7 ** 2 - 1.75 ** 2))]);
        if (this._type === 'parabola') out.push(['焦点 F', '(−0.65, 0)'], ['准线', 'x=−1.75']);
        return out;
      },
    };
  }

  /* ---------- 族 8：圆锥截面 cone ---------- */
  function buildCone(ctx) {
    const g = new T.Group(); g.add(ground());
    const H = 3.4, R = 2.2, half = Math.atan2(R, H);
    const coneGeo = new T.CylinderGeometry(0, R, H, 48, 1, true);
    const cone = new T.Mesh(coneGeo, mat(ACC2, .3)); cone.position.y = H / 2; g.add(cone);
    inkEdges(cone, .35);
    const holder = new T.Group(); g.add(holder);
    const planeMesh = new T.Mesh(new T.PlaneGeometry(4.6, 3.6), mat(ACC, .2));
    g.add(planeMesh);
    let sig = '';
    return {
      group: g,
      update(p, t) {
        const beta = ((p.beta != null ? p.beta : 45) + (ctx.autoplay ? Math.sin(t * .4) * 10 : 0));
        const s2 = beta.toFixed(2);
        planeMesh.rotation.x = -Math.PI / 2 + (90 - beta) * Math.PI / 180 * .9;
        planeMesh.position.set(0, 1.8, 0);
        if (s2 === sig) return; sig = s2; holder.clear();
        const br = beta * Math.PI / 180;
        const n = V3(0, Math.cos(br), Math.sin(br) * .6).normalize();
        const P0 = V3(0, 1.8, 0), pts = [];
        for (let phi = 0; phi <= Math.PI * 2 + .01; phi += .12) {
          /* 锥面点 (k·y·cosφ, y, k·y·sinφ)，解平面方程 */
          const k = R / H, cx = k * Math.cos(phi), cz = k * Math.sin(phi);
          const den = n.x * cx + n.y + n.z * cz, num = n.dot(P0);
          if (Math.abs(den) < 1e-4) continue;
          const y = num / den;
          if (y > .15 && y < H * .98) pts.push(V3(cx * y, y, cz * y));
        }
        if (pts.length > 6) holder.add(tube(pts, ACC, .035, true));
        this._beta = beta;
        this._kind = beta < 90 - Math.atan2(R, H) * 180 / Math.PI - 2 ? '椭圆' : (Math.abs(beta - (90 - Math.atan2(R, H) * 180 / Math.PI)) < 4 ? '抛物线' : '双曲线');
      },
      gauges(p) { return [['截平面角 β', F2(this._beta || 45) + '°'], ['母线半角', F2(Math.atan2(2.2, 3.4) * 180 / Math.PI) + '°'], ['截线', this._kind || '椭圆']]; },
    };
  }

  /* ---------- 族 9：曲面 surf ---------- */
  function buildSurf(ctx) {
    const g = new T.Group(); g.add(ground()); g.add(axes3(3.2));
    const seg = 26, geo = new T.PlaneGeometry(4, 4, seg, seg);
    const surf = new T.Mesh(geo, mat(ACC2, .4)); surf.rotation.x = -Math.PI / 2; surf.position.y = 1.6; g.add(surf);
    const probe = ball(.1, ACC); g.add(probe);
    const tanPlane = new T.Mesh(new T.PlaneGeometry(1.6, 1.6), mat(ACC, .35)); g.add(tanPlane);
    const pos = geo.attributes.position;
    return {
      group: g,
      update(p, t) {
        const kk = p.kk != null ? p.kk : -1;
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i), y = pos.getY(i);
          pos.setZ(i, (x * x - y * y) * .22 * kk + .0);
        }
        pos.needsUpdate = true; geo.computeVertexNormals();
        const px = p.px != null ? p.px : .8, py = p.py != null ? p.py : .4;
        const z = (px * px - py * py) * .22 * kk;
        probe.position.set(px, 1.6 + z, -py);
        tanPlane.position.copy(probe.position);
        tanPlane.rotation.set(-Math.PI / 2 + Math.atan(2 * py * .22 * kk), 0, Math.atan(-2 * px * .22 * kk));
        this._z = z;
      },
      gauges(p) { return [['z=x²−y²', ''], ['探针', `(${F2(p.px || 0)}, ${F2(p.py || 0)})`], ['z', F2(this._z || 0)], ['鞍点', '在原点']]; },
    };
  }

  /* ---------- 族 10：条形/点阵 bars（统计/概率/数列/组合/数论/应试） ---------- */
  function buildBars(ctx) {
    const g = new T.Group(); g.add(ground());
    const holder = new T.Group(); g.add(holder);
    const mover = ball(.11, ACC); g.add(mover);
    let sig = '';
    const heights = p => {
      switch (ctx.sceneKey + '.' + ctx.mode) {
        case 'stat.table': return [p.ca, p.cb, p.cc, p.cd].map(v => (v || 0) / 18);
        case 'stat.reg': { const r = p.r; return Array.from({ length: 7 }, (_, i) => 0.5 + i * .32 * (0.4 + r)); }
        case 'stat.spread': return [-2, -1, 0, 1, 2].map(k => 1.6 * Math.exp(-(k * k) / (2 * (p.spread || 1) ** 2)) + .15);
        case 'seq.arith': return Array.from({ length: Math.round(p.n || 7) }, (_, i) => 1 + i * (p.d || .4));
        case 'seq.geom': return Array.from({ length: Math.round(p.n || 7) }, (_, i) => Math.pow(p.q || 1.4, i) * .6);
        case 'seq.sum': return Array.from({ length: Math.round(p.n || 7) }, (_, i) => Array.from({ length: i + 1 }, (_, j) => Math.pow(p.q || .7, j)).reduce((a, b) => a + b, 0) * .55);
        case 'prob.cond': return [.5, .5 + (p.bx || 0), .9, 1.3];
        case 'prob.walk': return null;
        case 'comb.pascal': return null;
        case 'numth.prime': return null;
        case 'higher.series': return Array.from({ length: Math.round(p.terms || 7) }, (_, i) => 1.8 / (i + 1));
        default: return [0.8, 1.3, 1.0, 1.7, 1.2];
      }
    };
    return {
      group: g,
      update(p, t) {
        const s2 = ctx.sceneKey + '.' + ctx.mode + '|' + Object.values(p).map(v => (+v).toFixed(2)).join(',');
        const hs = heights(p);
        if (s2 !== sig) {
          sig = s2; holder.clear();
          if (ctx.mode === 'pascal') {
            const rows = Math.round(p.rows || 6);
            for (let r = 0; r < rows; r++) for (let k = 0; k <= r; k++) {
              let c = 1; for (let i = 0; i < k; i++) c = c * (r - i) / (i + 1);
              const b = ball(.09 + Math.min(c * .012, .12), k === 0 || k === r ? ACC2 : GOLD);
              b.position.set((k - r / 2) * .55, .3 + r * .42, (r - rows / 2) * .3); holder.add(b);
            }
          } else if (ctx.mode === 'prime') {
            const up = Math.round(p.up || 46);
            const isP = n => { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
            for (let n = 2; n <= up; n++) {
              const pr = isP(n);
              const b = box(.16, pr ? 1.5 : .4, .16, pr ? ACC : 0xb9ac93);
              b.position.set(-3.4 + ((n - 2) % 16) * .45, (pr ? 1.5 : .4) / 2, -1.6 + Math.floor((n - 2) / 16) * .8); holder.add(b);
            }
            this._pc = Array.from({ length: up - 1 }, (_, i) => i + 2).filter(isP).length;
          } else if (ctx.mode === 'walk') {
            let x = -3, y = .2, seed = 7; const pts = [V3(x, y, 0)];
            const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
            const steps = Math.round(p.steps || 12);
            for (let i = 0; i < steps; i++) { x += .45; y = Math.max(.15, y + (rnd() - .42) * .8); pts.push(V3(x, y, Math.sin(i * 1.7) * .5)); }
            holder.add(tube(pts, ACC2, .04)); this._end = pts[pts.length - 1];
          } else if (ctx.mode === 'path') {
            const m = Math.round(p.m || 4), n = Math.round(p.n || 3);
            for (let i = 0; i <= m; i++) for (let j = 0; j <= n; j++) { const d = ball(.05, INK); d.position.set(-2.4 + i * .8, .15, -1.6 + j * .8); holder.add(d); }
            const pts = []; let x = 0, y = 0; pts.push(V3(-2.4, .3, -1.6));
            for (let i = 0; i < m + n; i++) { if (i % 2 === 0 && x < m) x++; else if (y < n) y++; else x++; pts.push(V3(-2.4 + x * .8, .3, -1.6 + y * .8)); }
            holder.add(tube(pts, ACC, .045));
            let c = 1; for (let i = 0; i < n; i++) c = c * (m + n - i) / (i + 1); this._paths = c;
          } else if (ctx.mode === 'mod') {
            const n = Math.round(p.n || 7), mult = p.mult || 3;
            const ringPts = [];
            for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; ringPts.push(V3(Math.cos(a) * 2.2, .4 + Math.sin(a) * .0, Math.sin(a) * 2.2)); const d = ball(.08, GOLD); d.position.copy(ringPts[i]).y = .5; d.position.y = .5; holder.add(d); }
            for (let i = 0; i < n; i++) { const j = (i * mult) % n; holder.add(line([ringPts[i].clone().setY(.5), ringPts[j].clone().setY(.5)], ACC2, .6)); }
          } else if (hs) {
            hs.forEach((h, i) => {
              const b = box(.52, Math.max(h, .04), .52, i % 3 === 0 ? ACC : (i % 3 === 1 ? ACC2 : ACC3), .88);
              b.position.set(-2.9 + i * .95, Math.max(h, .04) / 2, 0); holder.add(b);
            });
          }
          if (ctx.mode === 'gcd') {
            holder.clear();
            const ga = Math.round(p.ga || 12), gb = Math.round(p.gb || 18);
            const w = 4.6 / Math.max(ga, gb);
            const rect = box(ga * w, .1, gb * w, GOLD, .35); rect.position.set(0, .4, 0); holder.add(rect);
            let a = ga, b = gb; while (b) { const r = a % b; a = b; b = r; }
            const s = a * w; const sq = box(s, .3, s, ACC, .8); sq.position.set(-ga * w / 2 + s / 2, .5, -gb * w / 2 + s / 2); holder.add(sq);
            this._gcd = a;
          }
          if (ctx.mode === 'space') {
            holder.clear();
            const sum = Math.round(p.sum || 7); let cnt = 0;
            for (let i = 1; i <= 6; i++) for (let j = 1; j <= 6; j++) {
              const hit = i + j === sum; if (hit) cnt++;
              const d = ball(hit ? .11 : .055, hit ? ACC : 0xb9ac93);
              d.position.set(-2.5 + (i - 1) * 1.0, .3, -2 + (j - 1) * .8); holder.add(d);
            }
            this._cnt = cnt;
          }
          if (ctx.sceneKey === 'exam') {
            holder.clear();
            const n = Math.round(p.done || p.m || p.cases || 4);
            for (let i = 0; i < n; i++) { const b = box(3.4 - i * .3, .34, 2.2 - i * .2, i % 2 ? ACC2 : ACC3, .8); b.position.set(0, .2 + i * .4, 0); holder.add(b); }
          }
        }
        const tm = (t * .7) % 6;
        mover.position.set(-2.9 + tm, 2.6 + Math.sin(t * 2) * .12, 1.2);
        mover.visible = !!hs;
      },
      gauges(p) {
        const out = [];
        if (ctx.mode === 'pascal') out.push(['行数', F2(p.rows || 6)], ['中间项', 'C(n,k) 最大']);
        else if (ctx.mode === 'prime') out.push(['范围', '≤' + Math.round(p.up || 46)], ['素数个数 π', F2(this._pc || 0)]);
        else if (ctx.mode === 'gcd') out.push(['a, b', `${Math.round(p.ga || 12)}, ${Math.round(p.gb || 18)}`], ['gcd', F2(this._gcd || 0)]);
        else if (ctx.mode === 'path') out.push(['格点', `${Math.round(p.m || 4)}×${Math.round(p.n || 3)}`], ['路径数 C', F2(this._paths || 0)]);
        else if (ctx.mode === 'space') out.push(['点数和', F2(p.sum || 7)], ['有利点', F2(this._cnt || 0)], ['概率', F2((this._cnt || 0) / 36)]);
        else if (ctx.mode === 'walk') out.push(['步数', F2(p.steps || 12)], ['终点高', F2(this._end ? this._end.y : 0)]);
        else if (ctx.mode === 'reg') out.push(['相关系数 r', F2(p.r)], ['趋势', (p.r || 0) > .3 ? '正相关' : '弱相关']);
        else if (ctx.mode === 'table' && ctx.sceneKey === 'stat') out.push(['四格', [p.ca, p.cb, p.cc, p.cd].map(v => Math.round(v || 0)).join('·')], ['χ² 倾向', Math.abs((p.ca || 0) - (p.cd || 0)) < 3 ? '接近独立' : '有关联']);
        else out.push(['参数', Object.entries(p).slice(0, 2).map(([k, v]) => k + '=' + F2(v)).join(' ')]);
        return out;
      },
    };
  }

  /* ---------- 族映射 ---------- */
  const FAMILY = {
    eq: 'curve', func: 'curve', deriv: 'curve', higher: 'curve',
    vec: 'vec2', calc: 'curve', trig: 'vec2',
    set: 'venn', comb: 'bars', ineq: 'region', lp: 'region',
    solid: 'solid', vec3: 'vec3', conic: 'conic', seq: 'bars',
    stat: 'bars', prob: 'bars', numth: 'bars', table: 'vec2', exam: 'bars',
  };
  const FAMILY_OVERRIDE = {
    'calc.complex': 'vec2', 'calc.rot': 'vec2', 'calc.log': 'curve',
    'trig.circle': 'vec2', 'trig.sum': 'vec2', 'trig.wave': 'curve',
    'deriv.surf': 'surf', 'deriv.tan': 'curve', 'deriv.ext': 'curve', 'deriv.mono': 'curve',
    'conic.cone': 'cone', 'higher.tesseract': 'solid', 'higher.integral': 'curve', 'higher.series': 'curve',
    'prob.normal': 'curve', 'comb.incl': 'venn',
  };
  const BUILDERS = { curve: buildCurve, vec2: buildVec2, venn: buildVenn, region: buildRegion, solid: buildSolid, vec3: buildVec3, conic: buildConic, cone: buildCone, surf: buildSurf, bars: buildBars };
  function familyOf(sceneKey, mode, kind) {
    if (kind && kind.indexOf('conic-') === 0) return 'conic';
    return FAMILY_OVERRIDE[sceneKey + '.' + mode] || FAMILY[sceneKey] || 'curve';
  }

  /* ---------- Watch 播放器（参考 every-joule 的 shots 机制） ---------- */
  const CAMS = [
    { yaw: -.62, pitch: .5, dist: 10.6 }, { yaw: .35, pitch: .34, dist: 9.4 },
    { yaw: -.15, pitch: .95, dist: 11.4 }, { yaw: .85, pitch: .42, dist: 8.8 },
  ];
  function Watch(canvas, hooks) {
    this.canvas = canvas; this.hooks = hooks || {};
    this.spec = null; this.builder = null;
    this.playing = false; this.i = -1; this.t = 0; this.dur = 2600;
    this.userYaw = 0; this.userPitch = 0; this.distMul = 1;
    this.cam = { yaw: -.62, pitch: .5, dist: 10.6 };
    this.params = {};
    this.labelsOn = true;
    this._last = 0; this._gaugeAt = 0;
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.setClearColor(0xf8efdb, 1); /* 纸色清屏：真 3D 舞台完全盖住下层，杜绝双影 */
    this.renderer = renderer;
    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(40, 1, .1, 100);
    this.scene.add(new T.HemisphereLight(0xfff6e0, 0x8a7a5c, .95));
    const dl = new T.DirectionalLight(0xffffff, .55); dl.position.set(4, 8, 5); this.scene.add(dl);
    this.holder = new T.Group(); this.scene.add(this.holder);
    this._bindPointer();
    this._loop = this._loop.bind(this);
    this._raf = requestAnimationFrame(this._loop);
  }
  Watch.prototype._bindPointer = function () {
    const cv = this.canvas; let drag = null;
    cv.style.touchAction = 'none';
    cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', e => {
      if (!drag) return;
      this.userYaw += (e.clientX - drag.x) * .008; this.userPitch = clamp(this.userPitch + (e.clientY - drag.y) * .006, -.5, .9);
      drag = { x: e.clientX, y: e.clientY };
    });
    cv.addEventListener('pointerup', () => { drag = null; });
    cv.addEventListener('wheel', e => { e.preventDefault(); this.distMul = clamp(this.distMul * (e.deltaY > 0 ? 1.1 : .9), .5, 2.2); }, { passive: false });
  };
  Watch.prototype.resize = function () {
    const r = this.canvas.getBoundingClientRect();
    const w = Math.max(50, r.width), h = Math.max(50, r.height);
    if (this.canvas.width !== Math.round(w * this.renderer.getPixelRatio())) this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  };
  Watch.prototype.load = function (spec) {
    this.spec = spec; this.i = -1; this.t = 0;
    while (this.holder.children.length) this.holder.remove(this.holder.children[0]);
    const ctx = { sceneKey: spec.sceneKey, mode: spec.mode, kind: spec.kind, title: spec.title, autoplay: true };
    this.ctx = ctx;
    this.builder = (BUILDERS[spec.family] || buildCurve)(ctx);
    this.holder.add(this.builder.group);
    this.frameY = ['curve', 'vec2', 'venn', 'region', 'conic'].includes(spec.family) ? 2.5 : 1.2;
    this.params = Object.assign({}, spec.brk);
    this.builder.update(this.params, 0);
    this._applyCam(CAMS[0], 1);
    if (this.hooks.onShot) this.hooks.onShot(-1, spec.shots.length, '');
  };
  Watch.prototype._applyCam = function (c, k) {
    this.cam.yaw = lerp(this.cam.yaw, c.yaw, k); this.cam.pitch = lerp(this.cam.pitch, c.pitch, k); this.cam.dist = lerp(this.cam.dist, c.dist, k);
  };
  Watch.prototype.play = function () { if (this.spec) { this.playing = true; if (this.i < 0) this._shot(0); } };
  Watch.prototype.pause = function () { this.playing = false; };
  Watch.prototype.toggle = function () { this.playing ? this.pause() : this.play(); };
  Watch.prototype.stop = function () { this.pause(); this.seek(0); };
  Watch.prototype.setDur = function (ms) { this.dur = Math.max(700, ms || 2600); };
  Watch.prototype.dispose = function () {
    this._dead = true; this.playing = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this.renderer) { this.renderer.dispose(); if (this.renderer.forceContextLoss) this.renderer.forceContextLoss(); }
  };
  Watch.prototype.seek = function (i) {
    if (!this.spec) return;
    this._shot(clamp(i, 0, this.spec.shots.length - 1));
    this._updateParams(1);
  };
  Watch.prototype._shot = function (i) {
    this.i = i; this.t = 0;
    const s = this.spec.shots[i];
    if (this.hooks.onShot) this.hooks.onShot(i, this.spec.shots.length, s ? s.caption : '');
  };
  Watch.prototype._updateParams = function () {
    const spec = this.spec, N = Math.max(1, spec.shots.length - 1);
    const prog = N ? clamp((this.i + clamp(this.t / this.dur, 0, 1)) / N, 0, 1) : 1;
    const e = ease(prog), out = {};
    const keys = new Set([...Object.keys(spec.def || {}), ...Object.keys(spec.brk || {})]);
    keys.forEach(k => {
      const a = spec.brk && spec.brk[k] != null ? spec.brk[k] : spec.def[k];
      const b = spec.def && spec.def[k] != null ? spec.def[k] : a;
      out[k] = typeof a === 'number' && typeof b === 'number' ? lerp(a, b, e) : b;
    });
    this.params = out;
    return prog;
  };
  Watch.prototype._loop = function (now) {
    if (this._dead) return;
    this._raf = requestAnimationFrame(this._loop);
    if (!this.spec || !this.builder) return;
    const dt = Math.min(1, this._last ? (now - this._last) / 1000 : .016); this._last = now; /* 节拍=墙钟：低帧率只跳帧不拖慢推导 */
    this.resize();
    if (this.playing) {
      this.t += dt * 1000;
      if (this.t >= this.dur) {
        if (this.i >= this.spec.shots.length - 1) {
          this.playing = false;
          if (this.hooks.onEnd) this.hooks.onEnd();
          this._shot(this.i); /* 停在末镜并同步字幕 */
        } else this._shot(this.i + 1);
      }
    }
    const prog = this._updateParams();
    const target = CAMS[Math.max(0, this.i) % CAMS.length];
    this._applyCam(target, 1 - Math.pow(.002, dt));
    const cy = this.cam.yaw + this.userYaw + Math.sin(now * .00016) * .05;
    const cp = clamp(this.cam.pitch + this.userPitch, .08, 1.35);
    const d = this.cam.dist * this.distMul;
    const tgt = V3(0, this.frameY || 1.55, 0);
    this.camera.position.set(
      tgt.x + d * Math.cos(cp) * Math.sin(cy),
      tgt.y + d * Math.sin(cp),
      tgt.z + d * Math.cos(cp) * Math.cos(cy));
    this.camera.lookAt(tgt);
    this.builder.update(this.params, now / 1000);
    if (this.hooks.onProgress) this.hooks.onProgress(clamp(this.t / this.dur, 0, 1), prog);
    if (this.hooks.onGauges && now - this._gaugeAt > 180) {
      this._gaugeAt = now;
      try { this.hooks.onGauges(this.builder.gauges(this.params)); } catch (e) { /* 仪表失败不阻断渲染 */ }
    }
    this.renderer.render(this.scene, this.camera);
  };

  /* ---------- spec 工厂 ---------- */
  function labSpec(sceneKey, mode) { return (((window.LABS || {})[sceneKey] || {})[mode]) || null; }
  function defParams(sceneKey, mode) {
    const s = labSpec(sceneKey, mode), out = {};
    (s ? s.controls : []).forEach(c => { if (c.type === 'range') out[c.id] = c.val; });
    return out;
  }
  function brkParams(sceneKey, mode) {
    const s = labSpec(sceneKey, mode);
    return Object.assign(defParams(sceneKey, mode), (s && s.brk && s.brk.params) || {});
  }
  function specForMode(sceneKey, mode, captions) {
    const s = labSpec(sceneKey, mode);
    const def = defParams(sceneKey, mode), brk = brkParams(sceneKey, mode);
    let shots;
    if (captions && captions.length) shots = captions.map(c => ({ caption: c }));
    else {
      const idea = (s && s.idea) || '观察模型随参数的变化。';
      const brkLab = (s && s.brk && s.brk.label) || '推到临界状态';
      const ctrls = (s ? s.controls : []).filter(c => c.type === 'range').map(c => c.label).join('、');
      shots = [
        { caption: '提出问题：' + idea },
        { caption: '先看临界：' + brkLab + '，注意模型哪里先失效。' },
        { caption: '推导推进：参数从临界状态逐步回到教材构型，盯住关键量怎样随之变化。' },
        { caption: '中途检验：' + (ctrls ? '对照控件 ' + ctrls + ' 的读数，' : '') + '公式里的量与图上同步增减。' },
        { caption: '结论：回到教材默认构型——图、公式、结论三者一致。' },
      ];
    }
    return { family: familyOf(sceneKey, mode), sceneKey, mode, kind: 'scene', def, brk, shots, title: mode };
  }
  function specForProblem(prob) {
    const M = window.PROBLEM_MODELS;
    const d = M ? M.describe(prob) : { sceneKey: prob.scene || 'func', mode: null, kind: 'scene', title: '' };
    const sceneKey = d.sceneKey && window.LABS && window.LABS[d.sceneKey] ? d.sceneKey : (prob.scene || 'func');
    const mode = d.mode || (window.LABS[sceneKey] ? Object.keys(window.LABS[sceneKey])[0] : null);
    const def = defParams(sceneKey, mode), brk = brkParams(sceneKey, mode);
    const steps = (prob.stepTexts && prob.stepTexts.length ? prob.stepTexts : ['观察模型']);
    const shots = [{ caption: '题干：' + (prob.text || '').slice(0, 60) }]
      .concat(steps.map((s, i) => ({ caption: `第 ${i + 1}/${steps.length} 步：` + s })));
    return { family: familyOf(sceneKey, mode, d.kind), sceneKey, mode, kind: d.kind, def, brk, shots, title: d.title || '' };
  }

  window.TW3 = { available: true, Watch, specForMode, specForProblem, familyOf, BUILDERS };
})();
