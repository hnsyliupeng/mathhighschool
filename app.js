// 莫比乌斯圆束交互可视化应用
// 启发自 pyddg 几何教程与 Every Joule 物理课堂设计风格

(function () {
  'use strict';

  // --- 数学常数与初始状态 ---
  const H = 0.5; // 直线 L 位于 z = H = 0.5
  const POLAR_H = 1 / H; // 极线 L_perp 位于 z = 1/H = 2.0
  const SQRT3 = Math.sqrt(3);

  const state = {
    t: 1.35,
    branchSign: 1, // +1 或 -1
    s: 0.85,
    isPlaying: false,
    animDirection: 1,
    showPrimary: true,
    showOrthogonal: true,
    showSphere: true,
    showRightAngle: true,
    viewMode: 'split', // 'split' | 'sphere' | 'plane'
    // 3D 视角参数 (球面)
    camera: {
      rotX: 0.45,
      rotY: -0.65,
      dist: 4.2,
      targetDist: 4.2,
      isDragging: false,
      lastMouseX: 0,
      lastMouseY: 0
    },
    // 2D 视角参数 (平面)
    planeView: {
      centerX: 0,
      centerY: 0,
      scale: 55, // 像素 / 单位
      isDragging: false,
      lastMouseX: 0,
      lastMouseY: 0
    }
  };

  // DOM 元素引用
  const el = {
    sphereCanvas: document.getElementById('sphereCanvas'),
    planeCanvas: document.getElementById('planeCanvas'),
    visualGrid: document.getElementById('visualGrid'),
    viewButtons: document.querySelectorAll('.view-button'),
    resetCamera: document.getElementById('resetCamera'),
    tRange: document.getElementById('tRange'),
    tOutput: document.getElementById('tOutput'),
    branchButtons: document.querySelectorAll('.branch-button'),
    pXValue: document.getElementById('pXValue'),
    sRange: document.getElementById('sRange'),
    sOutput: document.getElementById('sOutput'),
    qYValue: document.getElementById('qYValue'),
    playButton: document.getElementById('playButton'),
    playLabel: document.getElementById('playLabel'),
    validityIndicator: document.getElementById('validityIndicator'),
    validityTitle: document.getElementById('validityTitle'),
    validityText: document.getElementById('validityText'),
    showPrimary: document.getElementById('showPrimary'),
    showOrthogonal: document.getElementById('showOrthogonal'),
    showSphere: document.getElementById('showSphere'),
    showRightAngle: document.getElementById('showRightAngle'),
    distanceSquared: document.getElementById('distanceSquared'),
    radiiSquared: document.getElementById('radiiSquared')
  };

  const sphereCtx = el.sphereCanvas.getContext('2d');
  const planeCtx = el.planeCanvas.getContext('2d');

  // --- 几何计算函数 ---

  // 获得点 P(t) = (sign * t, 0, H)
  function getP() {
    const x = state.branchSign * Math.abs(state.t);
    return { x: x, y: 0, z: H };
  }

  // 获得点 Q(s) = (0, s, POLAR_H)
  function getQ() {
    return { x: 0, y: state.s, z: POLAR_H };
  }

  // 计算极平面与单位球相交所得的圆
  // 极平面: P · X = 1
  function getSphericalCircle(pt) {
    const pNormSq = pt.x * pt.x + pt.y * pt.y + pt.z * pt.z;
    if (pNormSq <= 1.0001) return null; // 距离大于1才与球相交
    const pNorm = Math.sqrt(pNormSq);
    const d = 1 / pNorm; // 原点到平面的距离
    if (d >= 1) return null;

    const r = Math.sqrt(1 - d * d); // 球面圆半径
    // 圆心在 3D 中的坐标 M = P / |P|^2
    const center = {
      x: pt.x / pNormSq,
      y: pt.y / pNormSq,
      z: pt.z / pNormSq
    };
    // 法向量
    const normal = {
      x: pt.x / pNorm,
      y: pt.y / pNorm,
      z: pt.z / pNorm
    };

    return { center, normal, radius: r, dist: d };
  }

  // 生成圆周上的采样点 (3D)
  function sampleCircle3D(circle, numPoints = 64) {
    if (!circle) return [];
    const { center, normal, radius } = circle;

    // 寻找垂直于法向量的正交基 (u, v)
    let u = { x: 0, y: 0, z: 0 };
    if (Math.abs(normal.z) < 0.9) {
      u = { x: -normal.y, y: normal.x, z: 0 };
    } else {
      u = { x: 0, y: -normal.z, z: normal.y };
    }
    const uLen = Math.hypot(u.x, u.y, u.z);
    u.x /= uLen; u.y /= uLen; u.z /= uLen;

    // v = normal x u
    const v = {
      x: normal.y * u.z - normal.z * u.y,
      y: normal.z * u.x - normal.x * u.z,
      z: normal.x * u.y - normal.y * u.x
    };

    const pts = [];
    for (let i = 0; i <= numPoints; i++) {
      const theta = (i / numPoints) * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      pts.push({
        x: center.x + radius * (cosT * u.x + sinT * v.x),
        y: center.y + radius * (cosT * u.y + sinT * v.y),
        z: center.z + radius * (cosT * u.z + sinT * v.z)
      });
    }
    return pts;
  }

  // 立体投影: 从北极 (0, 0, 1) 到赤道平面 z = 0
  function stereographicProject(pt) {
    if (Math.abs(1 - pt.z) < 1e-4) return null; // 北极点映到无穷远
    const factor = 1 / (1 - pt.z);
    return {
      u: pt.x * factor,
      v: pt.y * factor
    };
  }

  // 获得平面第一圆束 (蓝色族) 的圆参数: (u - 2t)^2 + v^2 = 4t^2 - 3
  function getPlanarCircle1(t) {
    const tVal = t;
    const rSq = 4 * tVal * tVal - 3;
    if (rSq <= 0) return null;
    return {
      cx: 2 * tVal,
      cy: 0,
      r: Math.sqrt(rSq),
      rSq: rSq
    };
  }

  // 获得平面正交圆束 (橙色族) 的圆参数: u^2 + (v + s)^2 = s^2 + 3
  function getPlanarCircle2(s) {
    const rSq = s * s + 3;
    return {
      cx: 0,
      cy: -s,
      r: Math.sqrt(rSq),
      rSq: rSq
    };
  }

  // 计算两个圆的交点
  function getCirclesIntersection(c1, c2) {
    if (!c1 || !c2) return [];
    const dx = c2.cx - c1.cx;
    const dy = c2.cy - c1.cy;
    const d = Math.hypot(dx, dy);

    if (d > c1.r + c2.r || d < Math.abs(c1.r - c2.r) || d === 0) {
      return [];
    }

    const a = (c1.rSq - c2.rSq + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, c1.rSq - a * a));

    const x2 = c1.cx + (dx * a) / d;
    const y2 = c1.cy + (dy * a) / d;

    return [
      { x: x2 + (h * dy) / d, y: y2 - (h * dx) / d },
      { x: x2 - (h * dy) / d, y: y2 + (h * dx) / d }
    ];
  }

  // --- 3D 投影与渲染 ---

  function project3DTo2D(pt, width, height) {
    // 旋转变换 (Yaw and Pitch)
    const cosY = Math.cos(state.camera.rotY);
    const sinY = Math.sin(state.camera.rotY);
    const cosX = Math.cos(state.camera.rotX);
    const sinX = Math.sin(state.camera.rotX);

    // 绕 Z 轴旋转 (rotY)
    const x1 = pt.x * cosY - pt.y * sinY;
    const y1 = pt.x * sinY + pt.y * cosY;
    const z1 = pt.z;

    // 绕 X 轴旋转 (rotX)
    const x2 = x1;
    const y2 = y1 * cosX - z1 * sinX;
    const z2 = y1 * sinX + z1 * cosX;

    // 透视投影
    const fov = 3.5;
    const zCam = z2 + state.camera.dist;
    const scale = (fov / Math.max(0.1, zCam)) * (Math.min(width, height) / 3.2);

    return {
      x: width / 2 + x2 * scale,
      y: height / 2 - y2 * scale,
      z: z2,
      scale: scale,
      visible: zCam > 0.1
    };
  }

  function renderSphereView() {
    const canvas = el.sphereCanvas;
    const ctx = sphereCtx;
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // 背景微妙径向辉光
    const grad = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, Math.max(w, h) / 1.5);
    grad.addColorStop(0, '#1a1f29');
    grad.addColorStop(1, '#0c0e12');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 绘制赤道/投影平面网格 z = 0
    drawProjectionPlane3D(ctx, w, h);

    // 绘制单位球面 (经纬线与半透明球体)
    if (state.showSphere) {
      drawSphereGrid3D(ctx, w, h);
    }

    // 采样族圆 (背景淡淡显示整个圆族)
    drawSampledPencils3D(ctx, w, h);

    // 绘制直线 L: (t, 0, H)
    drawLineL3D(ctx, w, h);

    // 绘制极线 L_perp: (0, s, POLAR_H)
    drawLineLPerp3D(ctx, w, h);

    // 绘制当前点 P 与极平面、球面圆
    const p = getP();
    const circleP = getSphericalCircle(p);
    if (state.showPrimary && circleP) {
      drawActiveCircleP3D(ctx, w, h, p, circleP);
    }

    // 绘制当前点 Q 与极平面、球面圆
    const q = getQ();
    const circleQ = getSphericalCircle(q);
    if (state.showOrthogonal && circleQ) {
      drawActiveCircleQ3D(ctx, w, h, q, circleQ);
    }

    // 绘制北极点 N 与投影射线
    drawNorthPoleAndRays3D(ctx, w, h, circleP, circleQ);
  }

  function drawSphereGrid3D(ctx, w, h) {
    // 经纬线
    ctx.lineWidth = 1;
    const latSteps = 6;
    const lonSteps = 12;

    // 纬线
    for (let i = 1; i < latSteps; i++) {
      const lat = (i / latSteps - 0.5) * Math.PI;
      const z = Math.sin(lat);
      const r = Math.cos(lat);
      const pts = [];
      for (let j = 0; j <= 40; j++) {
        const lon = (j / 40) * Math.PI * 2;
        pts.push({ x: r * Math.cos(lon), y: r * Math.sin(lon), z: z });
      }
      draw3DPolyline(ctx, pts, w, h, 'rgba(255, 255, 255, 0.08)');
    }

    // 赤道
    const eqPts = [];
    for (let j = 0; j <= 48; j++) {
      const lon = (j / 48) * Math.PI * 2;
      eqPts.push({ x: Math.cos(lon), y: Math.sin(lon), z: 0 });
    }
    draw3DPolyline(ctx, eqPts, w, h, 'rgba(255, 255, 255, 0.22)', 1.2);

    // 经线
    for (let i = 0; i < lonSteps; i++) {
      const lon = (i / lonSteps) * Math.PI * 2;
      const pts = [];
      for (let j = 0; j <= 32; j++) {
        const lat = (j / 32 - 0.5) * Math.PI;
        pts.push({
          x: Math.cos(lat) * Math.cos(lon),
          y: Math.cos(lat) * Math.sin(lon),
          z: Math.sin(lat)
        });
      }
      draw3DPolyline(ctx, pts, w, h, 'rgba(255, 255, 255, 0.06)');
    }

    // 球面发光轮廓 (外光晕)
    const center2D = project3DTo2D({ x: 0, y: 0, z: 0 }, w, h);
    if (center2D.visible) {
      const rad2D = center2D.scale * 1.0;
      ctx.beginPath();
      ctx.arc(center2D.x, center2D.y, rad2D, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(120, 180, 255, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const glowGrad = ctx.createRadialGradient(
        center2D.x, center2D.y, rad2D * 0.7,
        center2D.x, center2D.y, rad2D * 1.02
      );
      glowGrad.addColorStop(0, 'rgba(31, 111, 235, 0)');
      glowGrad.addColorStop(1, 'rgba(31, 111, 235, 0.12)');
      ctx.fillStyle = glowGrad;
      ctx.fill();
    }
  }

  function drawProjectionPlane3D(ctx, w, h) {
    const size = 2.4;
    const gridLines = 8;
    ctx.lineWidth = 1;

    // 平面网格线
    for (let i = -gridLines; i <= gridLines; i++) {
      const val = (i / gridLines) * size;
      const p1 = project3DTo2D({ x: -size, y: val, z: 0 }, w, h);
      const p2 = project3DTo2D({ x: size, y: val, z: 0 }, w, h);
      if (p1.visible && p2.visible) {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = i === 0 ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.04)';
        ctx.stroke();
      }

      const q1 = project3DTo2D({ x: val, y: -size, z: 0 }, w, h);
      const q2 = project3DTo2D({ x: val, y: size, z: 0 }, w, h);
      if (q1.visible && q2.visible) {
        ctx.beginPath();
        ctx.moveTo(q1.x, q1.y);
        ctx.lineTo(q2.x, q2.y);
        ctx.strokeStyle = i === 0 ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.04)';
        ctx.stroke();
      }
    }
  }

  function drawLineL3D(ctx, w, h) {
    const len = 3.2;
    const p1 = project3DTo2D({ x: -len, y: 0, z: H }, w, h);
    const p2 = project3DTo2D({ x: len, y: 0, z: H }, w, h);
    if (p1.visible && p2.visible) {
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = '#2b7fff';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // 标签 L
      ctx.fillStyle = '#79b8ff';
      ctx.font = '12px ' + getComputedStyle(document.body).fontFamily;
      ctx.fillText('直线 L (z = ½)', p2.x + 8, p2.y + 4);
    }
  }

  function drawLineLPerp3D(ctx, w, h) {
    const len = 2.6;
    const p1 = project3DTo2D({ x: 0, y: -len, z: POLAR_H }, w, h);
    const p2 = project3DTo2D({ x: 0, y: len, z: POLAR_H }, w, h);
    if (p1.visible && p2.visible) {
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = '#f08c3a';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // 标签 L_perp
      ctx.fillStyle = '#ffb370';
      ctx.font = '12px ' + getComputedStyle(document.body).fontFamily;
      ctx.fillText('极线 L⊥ (z = 2)', p2.x + 8, p2.y + 4);
    }
  }

  function drawSampledPencils3D(ctx, w, h) {
    // 绘制第一圆束的背景采样圆 (球面)
    if (state.showPrimary) {
      const sampleT = [-1.8, -1.5, -1.2, 1.2, 1.5, 1.8];
      sampleT.forEach((tVal) => {
        const pt = { x: tVal, y: 0, z: H };
        const circ = getSphericalCircle(pt);
        if (circ) {
          const pts = sampleCircle3D(circ, 36);
          draw3DPolyline(ctx, pts, w, h, 'rgba(31, 111, 235, 0.2)', 1.2);
        }
      });
    }

    // 绘制正交圆束的背景采样圆 (球面)
    if (state.showOrthogonal) {
      const sampleS = [-1.4, -0.9, -0.4, 0.4, 0.9, 1.4];
      sampleS.forEach((sVal) => {
        const pt = { x: 0, y: sVal, z: POLAR_H };
        const circ = getSphericalCircle(pt);
        if (circ) {
          const pts = sampleCircle3D(circ, 36);
          draw3DPolyline(ctx, pts, w, h, 'rgba(230, 106, 34, 0.2)', 1.2);
        }
      });
    }
  }

  function drawActiveCircleP3D(ctx, w, h, p, circ) {
    // 绘制点 P
    const p2D = project3DTo2D(p, w, h);
    if (p2D.visible) {
      ctx.beginPath();
      ctx.arc(p2D.x, p2D.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#1f6feb';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px ' + getComputedStyle(document.body).fontFamily;
      ctx.fillText('P', p2D.x + 10, p2D.y - 6);
    }

    // 绘制球面圆 C_P
    const pts = sampleCircle3D(circ, 64);
    draw3DPolyline(ctx, pts, w, h, '#2188ff', 3.0);

    // 绘制极平面的半透明截面示意
    drawPlaneDisk3D(ctx, w, h, circ, 'rgba(31, 111, 235, 0.15)');
  }

  function drawActiveCircleQ3D(ctx, w, h, q, circ) {
    // 绘制点 Q
    const q2D = project3DTo2D(q, w, h);
    if (q2D.visible) {
      ctx.beginPath();
      ctx.arc(q2D.x, q2D.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#e66a22';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px ' + getComputedStyle(document.body).fontFamily;
      ctx.fillText('Q', q2D.x + 10, q2D.y - 6);
    }

    // 绘制球面圆 C_Q
    const pts = sampleCircle3D(circ, 64);
    draw3DPolyline(ctx, pts, w, h, '#f08c3a', 3.0);

    // 绘制极平面的半透明截面示意
    drawPlaneDisk3D(ctx, w, h, circ, 'rgba(230, 106, 34, 0.15)');
  }

  function drawPlaneDisk3D(ctx, w, h, circ, fillStyle) {
    const pts = sampleCircle3D(circ, 48);
    if (pts.length < 3) return;
    const pts2D = pts.map(p => project3DTo2D(p, w, h));
    if (pts2D.some(p => !p.visible)) return;

    ctx.beginPath();
    ctx.moveTo(pts2D[0].x, pts2D[0].y);
    for (let i = 1; i < pts2D.length; i++) {
      ctx.lineTo(pts2D[i].x, pts2D[i].y);
    }
    ctx.closePath();
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }

  function drawNorthPoleAndRays3D(ctx, w, h, circP, circQ) {
    const northPole = { x: 0, y: 0, z: 1 };
    const np2D = project3DTo2D(northPole, w, h);
    if (!np2D.visible) return;

    // 投影射线 (从北极通过球面圆点投向 z=0 平面)
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1;

    if (circP && state.showPrimary) {
      const samplePts = sampleCircle3D(circP, 8);
      samplePts.slice(0, 4).forEach(sp => {
        const proj = stereographicProject(sp);
        if (proj) {
          const planePt = { x: proj.u, y: proj.v, z: 0 };
          const p1 = project3DTo2D(northPole, w, h);
          const p2 = project3DTo2D(planePt, w, h);
          if (p1.visible && p2.visible) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = 'rgba(74, 150, 255, 0.35)';
            ctx.stroke();
          }
        }
      });
    }

    ctx.setLineDash([]);

    // 北极标记
    ctx.beginPath();
    ctx.arc(np2D.x, np2D.y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#121417';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px ' + getComputedStyle(document.body).fontFamily;
    ctx.fillText('N (北极)', np2D.x + 8, np2D.y + 3);
  }

  function draw3DPolyline(ctx, pts, w, h, strokeStyle, lineWidth = 1) {
    if (pts.length < 2) return;
    const pts2D = pts.map(p => project3DTo2D(p, w, h));
    ctx.beginPath();
    let first = true;
    for (let i = 0; i < pts2D.length; i++) {
      if (!pts2D[i].visible) continue;
      if (first) {
        ctx.moveTo(pts2D[i].x, pts2D[i].y);
        first = false;
      } else {
        ctx.lineTo(pts2D[i].x, pts2D[i].y);
      }
    }
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  // --- 2D 平面投影视图渲染 ---

  function toScreenPlane(u, v, w, h) {
    const cx = w / 2 + state.planeView.centerX;
    const cy = h / 2 + state.planeView.centerY;
    return {
      x: cx + u * state.planeView.scale,
      y: cy - v * state.planeView.scale
    };
  }

  function renderPlaneView() {
    const canvas = el.planeCanvas;
    const ctx = planeCtx;
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // 深色底色 + 浅微网格
    ctx.fillStyle = '#0f1217';
    ctx.fillRect(0, 0, w, h);

    // 绘制坐标轴与刻度网格
    drawPlaneGrid(ctx, w, h);

    // 绘制两族采样圆束背景
    drawSampledPencils2D(ctx, w, h);

    // 计算当前活跃圆
    const curP = getP();
    const c1 = getPlanarCircle1(curP.x);
    const c2 = getPlanarCircle2(state.s);

    // 绘制当前第一圆束 (蓝色)
    if (state.showPrimary && c1) {
      drawActiveCircle1(ctx, w, h, c1);
    }

    // 绘制当前正交圆束 (橙色)
    if (state.showOrthogonal && c2) {
      drawActiveCircle2(ctx, w, h, c2);
    }

    // 绘制基点 / 极限点 (±√3, 0)
    drawFocalPoints2D(ctx, w, h);

    // 绘制交点与 90° 正交切线角标记
    if (state.showPrimary && state.showOrthogonal && c1 && c2) {
      drawOrthogonalIntersection(ctx, w, h, c1, c2);
    }
  }

  function drawPlaneGrid(ctx, w, h) {
    const cx = w / 2 + state.planeView.centerX;
    const cy = h / 2 + state.planeView.centerY;
    const scale = state.planeView.scale;

    // 细网格
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    const step = 1; // 1 个数学单位
    const xMin = Math.floor((-cx) / (scale * step)) * step;
    const xMax = Math.ceil((w - cx) / (scale * step)) * step;
    const yMin = Math.floor((cy - h) / (scale * step)) * step;
    const yMax = Math.ceil(cy / (scale * step)) * step;

    for (let x = xMin; x <= xMax; x += step) {
      const scrX = cx + x * scale;
      ctx.beginPath();
      ctx.moveTo(scrX, 0);
      ctx.lineTo(scrX, h);
      ctx.stroke();
    }
    for (let y = yMin; y <= yMax; y += step) {
      const scrY = cy - y * scale;
      ctx.beginPath();
      ctx.moveTo(0, scrY);
      ctx.lineTo(w, scrY);
      ctx.stroke();
    }

    // 主坐标轴
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1.2;
    // X 轴
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(w, cy);
    ctx.stroke();
    // Y 轴
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, h);
    ctx.stroke();

    // 坐标轴标签
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.font = '11px ' + getComputedStyle(document.body).fontFamily;
    ctx.fillText('x', w - 16, cy - 8);
    ctx.fillText('y', cx + 8, 16);
    ctx.fillText('O', cx + 6, cy + 14);
  }

  function drawSampledPencils2D(ctx, w, h) {
    const scale = state.planeView.scale;

    // 蓝色圆族 (第一圆束)
    if (state.showPrimary) {
      const sampleT = [
        -2.4, -2.0, -1.65, -1.35, -1.1, -0.98,
        0.98, 1.1, 1.35, 1.65, 2.0, 2.4
      ];
      sampleT.forEach(tVal => {
        const c = getPlanarCircle1(tVal);
        if (c) {
          const scr = toScreenPlane(c.cx, c.cy, w, h);
          ctx.beginPath();
          ctx.arc(scr.x, scr.y, c.r * scale, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(31, 111, 235, 0.22)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      });
    }

    // 橙色圆族 (正交圆束)
    if (state.showOrthogonal) {
      const sampleS = [
        -2.5, -1.8, -1.2, -0.7, -0.3, 0,
        0.3, 0.7, 1.2, 1.8, 2.5
      ];
      sampleS.forEach(sVal => {
        const c = getPlanarCircle2(sVal);
        if (c) {
          const scr = toScreenPlane(c.cx, c.cy, w, h);
          ctx.beginPath();
          ctx.arc(scr.x, scr.y, c.r * scale, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(230, 106, 34, 0.22)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      });
    }
  }

  function drawActiveCircle1(ctx, w, h, c1) {
    const scale = state.planeView.scale;
    const scr = toScreenPlane(c1.cx, c1.cy, w, h);

    // 活跃蓝色圆
    ctx.beginPath();
    ctx.arc(scr.x, scr.y, c1.r * scale, 0, Math.PI * 2);
    ctx.strokeStyle = '#2b7fff';
    ctx.lineWidth = 2.8;
    ctx.stroke();

    // 微弱蓝色填充发光
    ctx.fillStyle = 'rgba(31, 111, 235, 0.04)';
    ctx.fill();

    // 圆心 C1
    ctx.beginPath();
    ctx.arc(scr.x, scr.y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#2b7fff';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#79b8ff';
    ctx.font = '11px ' + getComputedStyle(document.body).fontFamily;
    ctx.fillText('C₁', scr.x + 8, scr.y + 4);
  }

  function drawActiveCircle2(ctx, w, h, c2) {
    const scale = state.planeView.scale;
    const scr = toScreenPlane(c2.cx, c2.cy, w, h);

    // 活跃橙色圆
    ctx.beginPath();
    ctx.arc(scr.x, scr.y, c2.r * scale, 0, Math.PI * 2);
    ctx.strokeStyle = '#f08c3a';
    ctx.lineWidth = 2.8;
    ctx.stroke();

    // 微弱橙色填充发光
    ctx.fillStyle = 'rgba(230, 106, 34, 0.04)';
    ctx.fill();

    // 圆心 C2
    ctx.beginPath();
    ctx.arc(scr.x, scr.y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#f08c3a';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#ffb370';
    ctx.font = '11px ' + getComputedStyle(document.body).fontFamily;
    ctx.fillText('C₂', scr.x + 8, scr.y + 4);
  }

  function drawFocalPoints2D(ctx, w, h) {
    const p1 = toScreenPlane(SQRT3, 0, w, h);
    const p2 = toScreenPlane(-SQRT3, 0, w, h);

    [p1, p2].forEach((p, idx) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#ff6b6b';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = '10px ' + getComputedStyle(document.body).fontFamily;
      const label = idx === 0 ? '(+√3, 0)' : '(-√3, 0)';
      ctx.fillText(label, p.x - 18, p.y + 14);
    });
  }

  function drawOrthogonalIntersection(ctx, w, h, c1, c2) {
    const intersections = getCirclesIntersection(c1, c2);
    if (intersections.length === 0) return;

    const scale = state.planeView.scale;
    const c1Scr = toScreenPlane(c1.cx, c1.cy, w, h);
    const c2Scr = toScreenPlane(c2.cx, c2.cy, w, h);

    // 绘制连心线
    ctx.beginPath();
    ctx.moveTo(c1Scr.x, c1Scr.y);
    ctx.lineTo(c2Scr.x, c2Scr.y);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.setLineDash([2, 3]);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);

    intersections.forEach((pt, idx) => {
      const scr = toScreenPlane(pt.x, pt.y, w, h);

      // 交点标记
      ctx.beginPath();
      ctx.arc(scr.x, scr.y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#22c55e';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 绘制从两圆心到交点的半径 (彼此垂直)
      ctx.beginPath();
      ctx.moveTo(c1Scr.x, c1Scr.y);
      ctx.lineTo(scr.x, scr.y);
      ctx.strokeStyle = 'rgba(43, 127, 255, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(c2Scr.x, c2Scr.y);
      ctx.lineTo(scr.x, scr.y);
      ctx.strokeStyle = 'rgba(240, 140, 58, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 绘制 90° 直角符号
      if (state.showRightAngle && idx === 0) {
        drawRightAngleMarker(ctx, scr, c1Scr, c2Scr, 12);
      }
    });
  }

  function drawRightAngleMarker(ctx, p, a, b, size = 12) {
    // 向量 p->a and p->b
    const v1 = { x: a.x - p.x, y: a.y - p.y };
    const v2 = { x: b.x - p.x, y: b.y - p.y };
    const len1 = Math.hypot(v1.x, v1.y);
    const len2 = Math.hypot(v2.x, v2.y);
    if (len1 < 1e-3 || len2 < 1e-3) return;

    const u1 = { x: (v1.x / len1) * size, y: (v1.y / len1) * size };
    const u2 = { x: (v2.x / len2) * size, y: (v2.y / len2) * size };

    const corner1 = { x: p.x + u1.x, y: p.y + u1.y };
    const corner2 = { x: p.x + u1.x + u2.x, y: p.y + u1.y + u2.y };
    const corner3 = { x: p.x + u2.x, y: p.y + u2.y };

    ctx.beginPath();
    ctx.moveTo(corner1.x, corner1.y);
    ctx.lineTo(corner2.x, corner2.y);
    ctx.lineTo(corner3.x, corner3.y);
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(corner1.x, corner1.y);
    ctx.lineTo(corner2.x, corner2.y);
    ctx.lineTo(corner3.x, corner3.y);
    ctx.closePath();
    ctx.fill();
  }

  // --- 同步 UI 与数学读数 ---

  function updateMathReadouts() {
    const curP = getP();
    const tVal = curP.x;
    const sVal = state.s;

    // t 输出
    const tSignStr = tVal >= 0 ? '+' + tVal.toFixed(2) : tVal.toFixed(2);
    el.tOutput.textContent = `t = ${tSignStr}`;
    el.pXValue.textContent = tVal.toFixed(2);

    // s 输出
    const sSignStr = sVal >= 0 ? '+' + sVal.toFixed(2) : sVal.toFixed(2);
    el.sOutput.textContent = `s = ${sSignStr}`;
    el.qYValue.textContent = sVal.toFixed(2);

    // 几何有效性判断 (|P| > 1)
    const pNorm = Math.hypot(curP.x, curP.y, curP.z);
    if (pNorm > 1.0) {
      el.validityIndicator.className = 'validity-indicator';
      el.validityTitle.textContent = '极平面截出实圆';
      el.validityText.textContent = `|P| = ${pNorm.toFixed(2)} > 1 · 与单位球相交`;
    } else {
      el.validityIndicator.className = 'validity-indicator validity-warning';
      el.validityTitle.textContent = '极平面不截球';
      el.validityText.textContent = `|P| = ${pNorm.toFixed(2)} ≤ 1 · 无实球面圆`;
    }

    // 正交性数学公式检验: d^2 = |C1 - C2|^2 = 4t^2 + s^2
    const dSq = 4 * tVal * tVal + sVal * sVal;
    const r1Sq = 4 * tVal * tVal - 3;
    const r2Sq = sVal * sVal + 3;
    const rSumSq = r1Sq + r2Sq;

    el.distanceSquared.textContent = dSq.toFixed(2);
    el.radiiSquared.textContent = rSumSq.toFixed(2);
  }

  function resizeCanvases() {
    const dpr = window.devicePixelRatio || 1;
    [el.sphereCanvas, el.planeCanvas].forEach(canvas => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
      }
    });
  }

  function renderAll() {
    renderSphereView();
    renderPlaneView();
  }

  // --- 交互事件监听 ---

  function setupEvents() {
    // t 范围滑动条
    el.tRange.addEventListener('input', (e) => {
      state.t = parseFloat(e.target.value);
      updateMathReadouts();
      renderAll();
    });

    // 正负分支切换
    el.branchButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        el.branchButtons.forEach(b => {
          b.classList.remove('is-active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('is-active');
        btn.setAttribute('aria-pressed', 'true');
        state.branchSign = parseInt(btn.dataset.sign, 10);
        updateMathReadouts();
        renderAll();
      });
    });

    // s 范围滑动条
    el.sRange.addEventListener('input', (e) => {
      state.s = parseFloat(e.target.value);
      updateMathReadouts();
      renderAll();
    });

    // 播放 / 暂停
    el.playButton.addEventListener('click', () => {
      state.isPlaying = !state.isPlaying;
      el.playButton.setAttribute('aria-pressed', state.isPlaying ? 'true' : 'false');
      el.playLabel.textContent = state.isPlaying ? '暂停' : '播放';
    });

    // 视图切换
    el.viewButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        el.viewButtons.forEach(b => {
          b.classList.remove('is-active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('is-active');
        btn.setAttribute('aria-pressed', 'true');
        state.viewMode = btn.dataset.view;
        el.visualGrid.dataset.view = state.viewMode;
        // 等待布局重排后调整画布大小
        setTimeout(() => {
          resizeCanvases();
          renderAll();
        }, 50);
      });
    });

    // 重置 3D 视角
    el.resetCamera.addEventListener('click', () => {
      state.camera.rotX = 0.45;
      state.camera.rotY = -0.65;
      state.camera.dist = 4.2;
      renderAll();
    });

    // 显示复选框
    el.showPrimary.addEventListener('change', (e) => {
      state.showPrimary = e.target.checked;
      renderAll();
    });
    el.showOrthogonal.addEventListener('change', (e) => {
      state.showOrthogonal = e.target.checked;
      renderAll();
    });
    el.showSphere.addEventListener('change', (e) => {
      state.showSphere = e.target.checked;
      renderAll();
    });
    el.showRightAngle.addEventListener('change', (e) => {
      state.showRightAngle = e.target.checked;
      renderAll();
    });

    // 3D 画布拖拽旋转
    setup3DControls();

    // 2D 画布平移缩放
    setup2DControls();

    // 窗口尺寸变化
    window.addEventListener('resize', () => {
      resizeCanvases();
      renderAll();
    });
  }

  function setup3DControls() {
    const canvas = el.sphereCanvas;

    const onPointerDown = (e) => {
      state.camera.isDragging = true;
      state.camera.lastMouseX = e.clientX || (e.touches && e.touches[0].clientX);
      state.camera.lastMouseY = e.clientY || (e.touches && e.touches[0].clientY);
    };

    const onPointerMove = (e) => {
      if (!state.camera.isDragging) return;
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);
      const dx = clientX - state.camera.lastMouseX;
      const dy = clientY - state.camera.lastMouseY;

      state.camera.rotY += dx * 0.008;
      state.camera.rotX += dy * 0.008;
      // 限制俯仰角
      state.camera.rotX = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, state.camera.rotX));

      state.camera.lastMouseX = clientX;
      state.camera.lastMouseY = clientY;
      renderSphereView();
    };

    const onPointerUp = () => {
      state.camera.isDragging = false;
    };

    canvas.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    canvas.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      state.camera.dist += e.deltaY * 0.003;
      state.camera.dist = Math.max(2.5, Math.min(8.0, state.camera.dist));
      renderSphereView();
    }, { passive: false });
  }

  function setup2DControls() {
    const canvas = el.planeCanvas;

    const onPointerDown = (e) => {
      state.planeView.isDragging = true;
      state.planeView.lastMouseX = e.clientX || (e.touches && e.touches[0].clientX);
      state.planeView.lastMouseY = e.clientY || (e.touches && e.touches[0].clientY);
    };

    const onPointerMove = (e) => {
      if (!state.planeView.isDragging) return;
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);
      const dx = clientX - state.planeView.lastMouseX;
      const dy = clientY - state.planeView.lastMouseY;

      state.planeView.centerX += dx;
      state.planeView.centerY += dy;

      state.planeView.lastMouseX = clientX;
      state.planeView.lastMouseY = clientY;
      renderPlaneView();
    };

    const onPointerUp = () => {
      state.planeView.isDragging = false;
    };

    canvas.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    canvas.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      state.planeView.scale = Math.max(20, Math.min(180, state.planeView.scale * zoomFactor));
      renderPlaneView();
    }, { passive: false });
  }

  // --- 动画主循环 ---

  function animationLoop() {
    if (state.isPlaying) {
      let t = state.t + state.animDirection * 0.006;
      if (t > 1.80) {
        t = 1.80;
        state.animDirection = -1;
      } else if (t < 0.95) {
        t = 0.95;
        state.animDirection = 1;
      }
      state.t = t;
      el.tRange.value = t.toFixed(2);
      updateMathReadouts();
      renderAll();
    }

    requestAnimationFrame(animationLoop);
  }

  // --- 初始化启动 ---

  function init() {
    resizeCanvases();
    setupEvents();
    updateMathReadouts();
    renderAll();
    requestAnimationFrame(animationLoop);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
