/* =============================================================
   几何库 geo.js：多面体 / 旋转体 / 球 / 截面 / 平面 / 辅助标注
   所有函数返回可被 Ink3D.Studio 渲染的 items 数组
   教材编号对应：8.1 基本立体图形、8.3 表面积体积、8.2 直观图
   ============================================================= */
(function (global) {
  'use strict';
  const { V, TAU, mix } = global.Ink3D;
  const E = global.Ink3D;

  const SUB = ['', '₁', '₂', '₃', '₄', '₅', '₆'];
  const LETTERS = 'ABCDEFGH'.split('');

  function pal(st) { return st.palette || E.palette; }
  function tint(st, k) {
    const p = pal(st);
    return mix(p.tint, p.ink, k == null ? 0.04 : k);
  }
  function accent(st) { return pal(st).accent; }
  function ink(st) { return pal(st).ink; }

  /* ---------- 圆周采样（水平圆） ---------- */
  function ringPts(n, r, y, rot, dir) {
    dir = dir == null ? -1 : dir;
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = rot + dir * i * TAU / n;
      out.push([r * Math.cos(a), y, r * Math.sin(a)]);
    }
    return out;
  }

  /* ---------- 多面体：棱柱 / 棱锥 / 棱台 ----------
     opts: {n, r, rTop, h, y0, rot, kind:'prism'|'pyramid'|'frustum',
            labels:'ABCD'|false, sub:true, tint, alpha, sw, edges:true, st} */
  function polySolid(o) {
    const st = o.st;
    const n = o.n || 4;
    const y0 = o.y0 || 0;
    const h = o.h == null ? 1.6 : o.h;
    const rot = o.rot == null ? Math.PI * 0.75 : o.rot;
    const lower = ringPts(n, o.r, y0, rot);
    const kind = o.kind || 'prism';
    const items = [];
    const skin = o.tint || tint(st, o.shade == null ? 0.03 : o.shade);
    const edgeC = o.edgeColor || ink(st);
    const sw = o.sw || 1.5;
    const alpha = o.alpha == null ? 1 : o.alpha;
    let upper = null, apex = null;

    if (kind === 'prism' || kind === 'frustum') {
      const rTop = kind === 'prism' ? o.r : o.rTop;
      upper = ringPts(n, rTop, y0 + h, rot);
    } else if (kind === 'pyramid') {
      apex = [0, y0 + h, 0];
    }

    const P = lower.length;
    // 底面
    items.push(E.face(lower.slice().reverse(), {
      color: mix(skin, pal(st).ink, 0.06), key: (o.key || 'poly') + ':base', alpha: alpha,
      edgeColor: edgeC, sw, tip: o.tipBase,
    }));
    // 侧面
    for (let i = 0; i < P; i++) {
      const j = (i + 1) % P;
      const sh = 0.02 + 0.07 * ((i * 5 % P) / P);
      if (kind === 'pyramid') {
        items.push(E.face([lower[i], lower[j], apex], {
          color: mix(skin, pal(st).ink, sh), key: (o.key || 'poly') + ':f' + i,
          edgeColor: 'transparent', sw: 0, alpha: alpha,
        }));
      } else {
        items.push(E.face([lower[i], lower[j], upper[j], upper[i]], {
          color: mix(skin, pal(st).ink, sh), key: (o.key || 'poly') + ':f' + i,
          edgeColor: 'transparent', sw: 0, alpha: alpha,
        }));
      }
    }
    if (upper) {
      items.push(E.face(upper, {
        color: mix(skin, '#ffffff', 0.25), key: (o.key || 'poly') + ':top', alpha: alpha,
        edgeColor: edgeC, sw, tip: o.tipTop,
      }));
    }
    // 棱（整体描线，确保线宽一致）
    if (o.edges !== false) {
      for (let i = 0; i < P; i++) {
        const j = (i + 1) % P;
        items.push(E.line(lower[i], lower[j], { color: edgeC, sw, alpha, key: (o.key || 'poly') + ':e' }));
        if (upper) {
          items.push(E.line(upper[i], upper[j], { color: edgeC, sw, alpha, key: (o.key || 'poly') + ':e' }));
          items.push(E.line(lower[i], upper[i], { color: edgeC, sw, alpha, key: (o.key || 'poly') + ':e' }));
        } else if (apex) {
          items.push(E.line(lower[i], apex, { color: edgeC, sw, alpha, key: (o.key || 'poly') + ':e' }));
        }
      }
    }
    // 顶点与字母
    const labels = o.labels || null;
    const sub = o.sub !== false;
    const verts = {};
    if (labels) {
      for (let i = 0; i < P; i++) {
        const nm = LETTERS[i] || ('P' + i);
        verts[nm] = lower[i];
        if (sub && (kind === 'prism' || kind === 'frustum')) {
          const nm2 = nm + '₁';
          verts[nm2] = upper[i];
        }
      }
      if (kind === 'pyramid') verts[o.apexName || 'P'] = apex;
    }
    return { items, lower, upper, apex, verts, n, h, y0, rot, kind, skin };
  }

  /* 顶点字母标注 */
  function vertexLabels(sol, st, o) {
    o = o || {};
    const out = [];
    const push = (p, nm, dx, dy) => out.push(E.label(p, nm, {
      dx: dx == null ? 0 : dx, dy: dy == null ? 0 : dy,
      color: o.color || ink(st), size: o.size || 13, key: o.key ? o.key + ':' + nm : null,
    }));
    for (const k in sol.verts) {
      const p = sol.verts[k];
      let dx = 0, dy = -12;
      const [x, y, z] = p;
      if (sol.apex && x === 0 && z === 0) { dx = 4; dy = -16; }
      else {
        if (x < -0.01) dx -= 12; else if (x > 0.01) dx += 12;
        if (z > 0.01) dy += 6; else dy -= 14;
      }
      push(p, k, dx, dy);
    }
    return out;
  }

  /* ---------- 长方体 / 正方体 ---------- */
  function box(o) {
    const st = o.st;
    const w = o.w == null ? 2 : o.w, h = o.h == null ? 2 : o.h, d = o.d == null ? 2 : o.d;
    const cx = o.cx || 0, cy = o.cy || 0, cz = o.cz || 0;
    const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy, y1 = cy + h, z0 = cz - d / 2, z1 = cz + d / 2;
    // 教材方位：A 前左下、B 前右下、C 后右下、D 后左下
    const b = [[x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0]];
    const t = [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]];
    const skin = o.tint || tint(st, 0.03);
    const ec = o.edgeColor || ink(st);
    const sw = o.sw || 1.55, alpha = o.alpha == null ? 1 : o.alpha;
    const items = [];
    const key = o.key || 'box';
    // 面：底、顶、四侧
    const faces = [
      { pts: [b[3], b[2], b[1], b[0]], shade: 0.02 },   // 下底
      { pts: [t[0], t[1], t[2], t[3]], shade: 0.0 },    // 上底
      { pts: [b[0], b[1], t[1], t[0]], shade: 0.05 },   // 前 ABB1A1
      { pts: [b[1], b[2], t[2], t[1]], shade: 0.09 },   // 右
      { pts: [b[2], b[3], t[3], t[2]], shade: 0.04 },   // 后
      { pts: [b[3], b[0], t[0], t[3]], shade: 0.07 },   // 左
    ];
    faces.forEach((f, i) => {
      items.push(E.face(f.pts, {
        color: mix(skin, pal(st).ink, f.shade), key: key + ':f' + i, alpha,
        edgeColor: 'transparent', sw: 0,
      }));
    });
    const edges = [
      [b[0], b[1]], [b[1], b[2]], [b[2], b[3]], [b[3], b[0]],
      [t[0], t[1]], [t[1], t[2]], [t[2], t[3]], [t[3], t[0]],
      [b[0], t[0]], [b[1], t[1]], [b[2], t[2]], [b[3], t[3]],
    ];
    edges.forEach(e => items.push(E.line(e[0], e[1], { color: ec, sw, alpha, key: key + ':e' })));
    const verts = {};
    ['A', 'B', 'C', 'D'].forEach((nm, i) => { verts[nm] = b[i]; verts[nm + '₁'] = t[i]; });
    return { items, verts, b, t, w, h, d, x0, x1, y0, y1, z0, z1 };
  }

  /* ---------- 旋转体：轮廓旋转 ---------- */
  function circlePts(c, u, v, r, n, a0, a1) {
    const out = [];
    a0 = a0 == null ? 0 : a0;
    a1 = a1 == null ? TAU : a1;
    n = n || 64;
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * i / n;
      out.push(V.add(c, V.add(V.mul(u, r * Math.cos(a)), V.mul(v, r * Math.sin(a)))));
    }
    return out;
  }

  function camXZ(st) {
    const sy = Math.sin(st.yaw), cy = Math.cos(st.yaw);
    const l = Math.hypot(sy, cy) || 1;
    return [sy / l, cy / l];
  }

  /* 旋转体：profile = [[r,y],...] 自下而上
     opts: {seg, st, tint, alpha, key, edgeColor, capTop, capBottom, shade} */
  function revolve(profile, o) {
    const st = o.st, seg = o.seg || 56;
    const skin = o.tint || tint(st, 0.02);
    const ec = o.edgeColor || ink(st);
    const A = o.alpha == null ? 1 : o.alpha;
    const items = [];
    const key = o.key || 'rev';
    const cam = camXZ(st);
    const sil = Math.atan2(cam[1], cam[0]) + Math.PI / 2; // 轮廓母线角度
    const isFront = (x, z) => (x * cam[0] + z * cam[1]) > 0;

    // 侧面：按段生成条带
    for (let i = 0; i < profile.length - 1; i++) {
      const [r0, y0] = profile[i], [r1, y1] = profile[i + 1];
      const shade = 0.02 + 0.055 * (i % 3);
      for (let s = 0; s < seg; s++) {
        const a0 = s / seg * TAU, a1 = (s + 1) / seg * TAU + 0.02;
        const p = [
          [r0 * Math.cos(a0), y0, r0 * Math.sin(a0)],
          [r1 * Math.cos(a0), y1, r1 * Math.sin(a0)],
          [r1 * Math.cos(a1), y1, r1 * Math.sin(a1)],
          [r0 * Math.cos(a1), y0, r0 * Math.sin(a1)],
        ];
        const mid = (a0 + a1) / 2;
        const lit = 0.5 + 0.5 * Math.cos(mid - Math.atan2(-cam[1], -cam[0]));
        items.push(E.face(p, {
          color: mix(skin, pal(st).ink, shade + 0.08 * (1 - lit)),
          key: key + ':sf' + i + '_' + s, alpha: A, edgeColor: 'transparent', sw: 0,
        }));
      }
    }
    // 轮廓母线（两侧）
    for (let k = 0; k < 2; k++) {
      const a = sil + k * Math.PI;
      const pts = profile.map(([r, y]) => [r * Math.cos(a), y, r * Math.sin(a)]);
      if (pts.length > 1) items.push(E.poly(pts, { color: ec, sw: o.sw || 1.5, alpha: A, layer: 'top', key: key + ':gen' + k }));
    }
    // 圆环：前半实线 / 后半虚线
    const rings = o.rings || [];
    for (const rg of rings) {
      const c = [0, rg[1], 0], r = rg[0];
      const front = [], back = [];
      for (let s = 0; s <= seg; s++) {
        const a = s / seg * TAU;
        const x = r * Math.cos(a), z = r * Math.sin(a);
        (isFront(x, z) ? front : back).push([x, c[1], z]);
      }
      if (front.length > 1) items.push(E.poly(front, { color: ec, sw: o.sw || 1.5, alpha: A, key: key + ':ringF' }));
      if (back.length > 1) items.push(E.poly(back, {
        color: ec, sw: Math.max(1, (o.sw || 1.5) - 0.35), alpha: A * (o.backAlpha || 0.55),
        dash: [4.5, 4.5], key: key + ':ringB',
      }));
    }
    // 上下底面
    const cap = (y, r, up) => {
      if (r <= 0.001) return;
      const pts = [];
      for (let s = 0; s < seg; s++) {
        const a = s / seg * TAU;
        pts.push([r * Math.cos(a), y, r * Math.sin(a)]);
      }
      const vis = up ? (st.pitch > -0.02) : (st.pitch < 0.02);
      items.push(E.face(pts, {
        color: mix(skin, '#ffffff', up ? 0.22 : 0.05), key: key + ':cap' + y, alpha: A,
        edgeColor: 'transparent', sw: 0,
      }));
      const cpts = pts.concat([pts[0]]);
      items.push(E.poly(cpts, {
        color: ec, sw: o.sw || 1.5, alpha: A * (vis ? 0.95 : 0.5),
        dash: vis ? null : [5, 4], key: key + ':capEdge' + y,
      }));
    };
    if (profile.length) {
      if (profile[0][0] > 0.001 && o.capBottom !== false) cap(profile[0][1], profile[0][0], false);
      if (profile[profile.length - 1][0] > 0.001 && o.capTop !== false) cap(profile[profile.length - 1][1], profile[profile.length - 1][0], true);
    }
    return items;
  }

  function cylinder(o) {
    const st = o.st, r = o.r, h = o.h, y0 = o.y0 || 0;
    return revolve([[r, y0], [r, y0 + h]], {
      st, seg: o.seg || 64, tint: o.tint, alpha: o.alpha, key: o.key,
      rings: [[r, y0], [r, y0 + h]], sw: o.sw, capTop: true, capBottom: true, backAlpha: o.backAlpha,
    });
  }
  function cone(o) {
    const st = o.st, r = o.r, h = o.h, y0 = o.y0 || 0;
    return revolve([[r, y0], [0, y0 + h]], {
      st, seg: o.seg || 64, tint: o.tint, alpha: o.alpha, key: o.key,
      rings: [[r, y0]], sw: o.sw, capTop: false, capBottom: true, backAlpha: o.backAlpha,
    });
  }
  function roundFrustum(o) {
    const st = o.st;
    return revolve([[o.r1, o.y0 || 0], [o.r2, (o.y0 || 0) + o.h]], {
      st, seg: o.seg || 64, tint: o.tint, alpha: o.alpha, key: o.key,
      rings: [[o.r1, o.y0 || 0], [o.r2, (o.y0 || 0) + o.h]], sw: o.sw, backAlpha: o.backAlpha,
    });
  }

  /* ---------- 球（大圆 + 径向渐变） ---------- */
  function sphere(o) {
    return [E.ball(o.c || [0, 0, 0], o.r || 1, {
      color: o.color, alpha: o.alpha, key: o.key, tip: o.tip,
    })];
  }

  /* ---------- 平面片（用于 α、β 与截面） ---------- */
  function planeQuad(c, u, v, su, sv, o) {
    const pts = [
      V.add(c, V.add(V.mul(u, su), V.mul(v, sv))),
      V.add(c, V.add(V.mul(u, -su), V.mul(v, sv))),
      V.add(c, V.add(V.mul(u, -su), V.mul(v, -sv))),
      V.add(c, V.add(V.mul(u, su), V.mul(v, -sv))),
    ];
    return E.face(pts, {
      color: o.color, alpha0: o.alpha != null ? o.alpha : 0.22,
      edgeColor: o.edgeColor || o.color, sw: o.sw || 1.6,
      dash: o.dash, layer: o.layer || 'top', key: o.key, hatch: o.hatch, tip: o.tip,
    });
  }

  /* ---------- 辅助：多边形、折线、直角标记 ---------- */
  function poly(pts, o) { return E.poly(pts, Object.assign({ closed: false }, o)); }
  function seg(a, b, o) { return E.line(a, b, o); }
  function rightAngle(a, b, c, size, o) {
    // 在顶点 b 处，沿 ba、bc 方向画小正方形
    const u = V.norm(V.sub(a, b)), v = V.norm(V.sub(c, b));
    const s = size || 0.18;
    const p1 = V.add(b, V.mul(u, s)), p2 = V.add(b, V.add(V.mul(u, s), V.mul(v, s))), p3 = V.add(b, V.mul(v, s));
    return E.poly([p1, p2, p3], Object.assign({ color: o && o.color, sw: 1.3, layer: 'top', key: o && o.key }, o));
  }
  function arrow(a, b, o) { return E.line(a, b, Object.assign({ arrow: true, layer: 'top' }, o)); }
  function dot3(p, o) { return E.point(p, Object.assign({ r: 3.4 }, o)); }
  function label3(p, text, o) { return E.label(p, text, o); }

  /* 平面上的圆（用于球截面、圆锥截面） */
  function circle3(c, u, v, r, o) {
    const pts = circlePts(c, V.norm(u), V.norm(v), r, (o && o.seg) || 64);
    return E.poly(pts, Object.assign({ closed: true }, o));
  }

  /* ---------- 自动摆放顶点字母（按屏幕方向背离形心） ---------- */
  function autoLabels(st, list, opt) {
    opt = opt || {};
    const dist = opt.dist == null ? 15 : opt.dist;
    const proj = [];
    let cx = 0, cy = 0;
    for (const it of list) {
      const q = st.project(it.p);
      if (!q) { proj.push(null); continue; }
      proj.push(q); cx += q.x; cy += q.y;
    }
    cx /= list.length; cy /= list.length;
    list.forEach((it, i) => {
      const q = proj[i];
      if (!q) return;
      let dx = q.x - cx, dy = q.y - cy;
      const L = Math.hypot(dx, dy) || 1;
      dx = dx / L * dist; dy = dy / L * dist;
      if (Math.abs(dy) < 2.5) dy = -dist * 0.7;
      it.dx = (it.dx || 0) + dx;
      it.dy = (it.dy || 0) + dy;
    });
    return list;
  }

  /* ---------- 平移一组图元（用于把几何体摆到版面位置） ---------- */
  function shift(items, d) {
    const [dx, dy, dz] = d;
    const mv = p => (Array.isArray(p) && p.length === 3 && typeof p[0] === 'number' ? [p[0] + dx, p[1] + dy, p[2] + dz] : p);
    const walk = arr => {
      for (const it of arr) {
        if (!it || typeof it !== 'object') continue;
        if (Array.isArray(it)) { walk(it); continue; }
        if (it.pts) it.pts = it.pts.map(mv);
        if (it.a) it.a = mv(it.a);
        if (it.b) it.b = mv(it.b);
        if (it.c) it.c = mv(it.c);
        if (it.p) it.p = mv(it.p);
        if (it.type === 'angle') { it.a = mv(it.a); it.b = mv(it.b); it.c = mv(it.c); }
      }
    };
    walk(Array.isArray(items) ? items : [items]);
    return items;
  }

  /* ---------- 教材标准正方体 / 长方体（带字母标注） ----------
     opts: {st, a, h, key, labels, alpha, tint, edges} */
  function cube(o) {
    const st = o.st, a = o.a == null ? 2 : o.a, h = o.h == null ? a : o.h;
    const b = box({ st, w: a, h, d: a, cy: 0, key: o.key || 'cube', tint: o.tint, alpha: o.alpha, sw: o.sw });
    const items = b.items;
    const vl = [];
    const names = ['A', 'B', 'C', 'D'];
    for (let i = 0; i < 4; i++) {
      items.push(E.point(b.b[i], { r: 2.9, key: 'v:' + names[i] }));
      items.push(E.point(b.t[i], { r: 2.9, key: 'v:' + names[i] + '₁' }));
      vl.push({ p: b.b[i], text: names[i], key: 'v:' + names[i] });
      vl.push({ p: b.t[i], text: names[i] + '₁', key: 'v:' + names[i] + '₁' });
    }
    autoLabels(st, vl, { dist: 15 });
    vl.forEach(v => items.push(E.label(v.p, v.text, { dx: v.dx, dy: v.dy, key: v.key, size: 12.5 })));
    return { items, v: b.verts, b: b.b, t: b.t, a, h };
  }

  /* 中点 / 分点工具 */
  function mid(p, q, t) { return V.lerp(p, q, t == null ? 0.5 : t); }
  function centroid(pts) {
    let s = [0, 0, 0];
    for (const p of pts) s = V.add(s, p);
    return V.mul(s, 1 / pts.length);
  }

  global.Geo = {
    cube, mid, centroid,
    shift, autoLabels,
    polySolid, box, revolve, cylinder, cone, roundFrustum, sphere,
    planeQuad, poly, seg, rightAngle, arrow, dot3, label3, circle3, circlePts,
    vertexLabels, ringPts, tint, accent, ink, pal, camXZ,
    SUB, LETTERS,
  };
})(window);
