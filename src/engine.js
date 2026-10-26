/* =============================================================
   CT-INK 3D · 自研手绘墨线三维引擎（Canvas 2D，无任何外部依赖）
   功能：透视投影 / 360° 拖拽旋转 / 画家算法 / 手绘抖动墨线 /
         透视(See-through) / 标注开关 / 高亮聚焦 / 拾取 / 球与大圆 / 缩放
   ============================================================= */
(function (global) {
  'use strict';

  global.PAGES = global.PAGES || [];   // 页面注册表（各页脚本 push 进来）
  const TAU = Math.PI * 2;
  // 画布内文字字体栈（可由测试环境替换为已注册字体）
  const FONTS = {
    kai: '"Kaiti SC","KaiTi","STKaiti","Noto Serif SC","Songti SC",serif',
    serif: '"Songti SC","Noto Serif SC",serif',
  };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  /* ---------- 稳定伪随机（保证抖动不闪烁） ---------- */
  function hashStr(s) {
    let h = 2166136261;
    s = String(s);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0);
  }
  function noise(seed, i) {
    let x = Math.imul((seed ^ (i * 374761393)) >>> 0, 668265263);
    x = (x ^ (x >>> 13)) >>> 0;
    x = Math.imul(x, 1274126177) >>> 0;
    return ((x ^ (x >>> 16)) >>> 0) / 2147483648 - 1; // [-1,1)
  }

  /* ---------- 向量工具 ---------- */
  const V = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    len: a => Math.hypot(a[0], a[1], a[2]),
    norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
    lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
  };

  /* ---------- 颜色工具 ---------- */
  function hex2rgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function rgba(h, a) {
    if (h && h.indexOf('rgba') === 0) return h;
    const c = hex2rgb(h);
    return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  }
  function mix(h1, h2, t) {
    const a = hex2rgb(h1), b = hex2rgb(h2);
    const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
    return `#${c.map(v => v.toString(16).padStart(2, '0')).join('')}`;
  }

  /* =============================================================
     Studio：一块画布 = 一个可旋转的三维展台
     ============================================================= */
  class Studio {
    constructor(canvas, opts) {
      opts = opts || {};
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.yaw = opts.yaw != null ? opts.yaw : -0.62;
      this.pitch = opts.pitch != null ? opts.pitch : 0.34;
      this.zoom = opts.zoom != null ? opts.zoom : 1;
      this.dist = opts.dist != null ? opts.dist : 9;
      this.fov = opts.fov != null ? opts.fov : 6.4;
      this.offset = opts.offset || [0, 0, 0];
      this.autoSpin = opts.autoSpin || 0;      // rad/s
      this.seeThrough = false;
      this.showLabels = true;
      this.palette = null;                      // 由外部注入 {ink, accent, tint, ...}
      this.focus = new Set();
      this.sceneFn = () => ({ items: [] });
      this.time = 0;
      this.active = true;
      this.dirty = true;
      this.pickables = [];
      this.onPick = null;
      this.hover = null;
      this._raf = null;
      this._last = 0;
      this._drag = null;
      this._pointers = new Map();
      this._bind();
      this._resize();
      if (window.ResizeObserver) {
        this._ro = new ResizeObserver(() => { this._resize(); this.dirty = true; });
        this._ro.observe(canvas.parentElement || canvas);
      }
      this._loop = this._loop.bind(this);
      this._raf = requestAnimationFrame(this._loop);
    }

    setScene(fn) { this.sceneFn = fn; this.dirty = true; }
    setPalette(p) { this.palette = p; this.dirty = true; }
    focusOn(keys) {
      this.focus = new Set(Array.isArray(keys) ? keys : keys ? [keys] : []);
      this.dirty = true;
    }
    clearFocus() { this.focus.clear(); this.dirty = true; }
    reset() {
      this.yaw = -0.62; this.pitch = 0.34; this.zoom = 1;
      this.dirty = true;
    }
    setActive(v) { this.active = v; this.dirty = true; }

    destroy() {
      if (this._raf) cancelAnimationFrame(this._raf);
      if (this._ro) this._ro.disconnect();
    }

    /* ---------------- 交互 ---------------- */
    _bind() {
      const c = this.canvas;
      c.style.touchAction = 'none';
      c.addEventListener('pointerdown', e => {
        c.setPointerCapture(e.pointerId);
        this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (this._pointers.size === 1) {
          this._drag = { x: e.clientX, y: e.clientY, moved: 0 };
        } else if (this._pointers.size === 2) {
          const pts = [...this._pointers.values()];
          this._pinch = { d: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), zoom: this.zoom };
        }
      });
      c.addEventListener('pointermove', e => {
        if (!this._pointers.has(e.pointerId)) {
          this._hoverAt(e);
          return;
        }
        this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (this._pointers.size === 2 && this._pinch) {
          const pts = [...this._pointers.values()];
          const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
          this.zoom = clamp(this._pinch.zoom * d / (this._pinch.d || 1), 0.45, 3.2);
          this.dirty = true;
          return;
        }
        if (this._drag) {
          const dx = e.clientX - this._drag.x, dy = e.clientY - this._drag.y;
          this._drag.moved += Math.abs(dx) + Math.abs(dy);
          this.yaw += dx * 0.011;
          this.pitch = clamp(this.pitch + dy * 0.009, -1.35, 1.35);
          this._drag.x = e.clientX; this._drag.y = e.clientY;
          this.dirty = true;
        }
      });
      const up = e => {
        const wasDrag = this._drag;
        this._pointers.delete(e.pointerId);
        if (this._pointers.size < 2) this._pinch = null;
        if (wasDrag && wasDrag.moved < 6) {
          const r = this.canvas.getBoundingClientRect();
          this._pick(e.clientX - r.left, e.clientY - r.top);
        }
        if (this._pointers.size === 0) this._drag = null;
      };
      c.addEventListener('pointerup', up);
      c.addEventListener('pointercancel', e => { this._pointers.delete(e.pointerId); this._drag = null; });
      c.addEventListener('pointerleave', e => { this._pointers.delete(e.pointerId); });
      c.addEventListener('wheel', e => {
        e.preventDefault();
        this.zoom = clamp(this.zoom * (e.deltaY > 0 ? 0.93 : 1.07), 0.45, 3.2);
        this.dirty = true;
      }, { passive: false });
      c.addEventListener('dblclick', () => this.reset());
    }

    _resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const host = this.canvas.parentElement;
      const w = (host ? host.clientWidth : this.canvas.clientWidth) || 480;
      const h = (host ? host.clientHeight : this.canvas.clientHeight) || 400;
      this.w = w; this.h = h; this.dpr = dpr;
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this.canvas.style.width = w + 'px';
      this.canvas.style.height = h + 'px';
      this.dirty = true;
    }

    /* ---------------- 相机 ---------------- */
    _cam() {
      const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
      const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
      const d = this.dist;
      // 相机世界坐标（先绕 Y 后绕 X）
      const camPos = [
        d * sy * cp + this.offset[0],
        -d * sp + this.offset[1],
        d * cy * cp + this.offset[2],
      ];
      return { cy, sy, cp, sp, d, camPos };
    }

    project(p) {
      const { cy, sy, cp, sp, d } = this._c;
      const x = p[0] - this.offset[0], y = p[1] - this.offset[1], z = p[2] - this.offset[2];
      const x1 = x * cy - z * sy;
      const z1 = x * sy + z * cy;
      const y2 = y * cp - z1 * sp;
      const z2 = y * sp + z1 * cp;
      const depth = d - z2;
      if (depth < 0.2) return null;
      const k = (this._k * d) / depth;
      return {
        x: this.w / 2 + x1 * k,
        y: this.h / 2 - y2 * k,
        d: depth,
        k,
      };
    }

    /* ---------------- 主循环 ---------------- */
    _loop(ts) {
      this._raf = requestAnimationFrame(this._loop);
      if (!this.active) return;
      const dt = this._last ? Math.min((ts - this._last) / 1000, 0.05) : 0;
      this._last = ts;
      if (this.autoSpin && !this._drag) { this.yaw += this.autoSpin * dt; this.dirty = true; }
      if (this._anim) { this.time += dt; this.dirty = true; }
      if (!this.dirty) return;
      this.render();
      this.dirty = false;
    }

    render() {
      const ctx = this.ctx;
      if (!ctx) return;
      const pal = this.palette || DEFAULT_PALETTE;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.w, this.h);
      this._c = this._cam();
      this._k = (Math.min(this.w, this.h) / this.fov) * this.zoom;
      let scene;
      try { scene = this.sceneFn(this.time) || { items: [] }; }
      catch (err) { console.error('scene error', err); scene = { items: [] }; }
      const items = flatten(scene.items || []);
      this._pal = pal;
      const size = Math.min(this.w, this.h);
      this._strokeBase = clamp(size / 460, 0.72, 1.5);

      // 自动取景：根据 scene.fit 计算整体缩放
      if (scene.fit) {
        const k0 = this._k;
        this._k = k0 * scene.fit;
      }

      const normal = [], top = [], labels = [], balls = [], points = [];
      for (const it of items) {
        if (!it) continue;
        if (it.type === 'label') { labels.push(it); continue; }
        if (it.type === 'point') { points.push(it); continue; }
        if (it.type === 'ball') { balls.push(it); continue; }
        if (it.layer === 'top') { top.push(it); continue; }
        normal.push(it);
      }
      // 画家算法：远 → 近
      normal.forEach(it => { it._depth = itemDepth(this, it); });
      normal.sort((a, b) => {
        if (Math.abs(b._depth - a._depth) < 1e-6) return (a.type === 'face' ? -1 : 1);
        return b._depth - a._depth;
      });
      this._pickables = [];

      for (const it of normal) this._drawNormal(it, pal);
      // 透视模式下先铺半透明“前脸之后的体”再画顶层面
      balls.forEach(b => this._drawBall(b, pal));
      for (const it of top) this._drawTop(it, pal);
      for (const it of points) this._drawPoint(it, pal);
      if (this.showLabels) for (const it of labels) this._drawLabel(it, pal);
      if (this.hover && this.showLabels) this._drawHoverTip(pal);
    }

    /* ---------------- 绘制：基础风格 ---------------- */
    _alpha(it, base) {
      let a = base;
      if (it.alpha != null) a *= it.alpha;
      if (this.focus.size && it.key) {
        const hit = [...this.focus].some(k => it.key === k || it.key.indexOf(k + ':') === 0 || k.indexOf(it.key + ':') === 0);
        if (!hit) a *= 0.13;
      }
      return a;
    }

    _color(it, pal, kind) {
      if (it.color) return it.color;
      if (this.focus.size && it.key) {
        const hit = [...this.focus].some(k => it.key === k || it.key.indexOf(k + ':') === 0 || k.indexOf(it.key + ':') === 0);
        if (hit) return pal.accent;
      }
      if (kind === 'fill') return it.tint || pal.tint;
      return pal.ink;
    }

    _inkPath(pts, seed, amp, closed) {
      const ctx = this.ctx;
      ctx.beginPath();
      const n = pts.length;
      if (!n) return;
      const jitter = [];
      for (let i = 0; i < n; i++) {
        jitter.push([
          pts[i][0] + noise(seed, i * 2) * amp,
          pts[i][1] + noise(seed, i * 2 + 1) * amp,
        ]);
      }
      ctx.moveTo(jitter[0][0], jitter[0][1]);
      for (let i = 1; i < n; i++) {
        const p = jitter[i], q = jitter[i - 1];
        // 轻微中点偏移，模拟手绘
        const mx = (p[0] + q[0]) / 2 + noise(seed + 7, i) * amp * 0.9;
        const my = (p[1] + q[1]) / 2 + noise(seed + 11, i) * amp * 0.9;
        ctx.quadraticCurveTo(mx, my, p[0], p[1]);
      }
      if (closed) ctx.closePath();
    }

    _strokeInk(pts, seed, opt) {
      const ctx = this.ctx;
      const amp = (opt.amp != null ? opt.amp : 0.55) * this._strokeBase;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (opt.dash) ctx.setLineDash(opt.dash);
      // 主墨线
      ctx.strokeStyle = opt.color;
      ctx.globalAlpha = opt.alpha;
      ctx.lineWidth = opt.width * this._strokeBase;
      this._inkPath(pts, seed, amp, opt.closed);
      ctx.stroke();
      // 复描一笔，产生“手绘毛边”
      if (!opt.dash && opt.width > 0.9) {
        ctx.globalAlpha = opt.alpha * 0.45;
        ctx.lineWidth = opt.width * this._strokeBase * 0.6;
        this._inkPath(pts.map(p => [p[0] + 0.7, p[1] - 0.5]), seed + 97, amp * 1.5, opt.closed);
        ctx.stroke();
      }
      ctx.restore();
    }

    _projPts(pts) {
      const out = [];
      for (const p of pts) {
        const q = this.project(p);
        if (!q) return null;
        out.push(q);
      }
      return out;
    }

    _drawNormal(it, pal) {
      const ctx = this.ctx;
      if (it.type === 'face') {
        const pp = this._projPts(it.pts);
        if (!pp || pp.length < 3) return;
        const seed = hashStr(it.key || 'f' + (it.seed || 0) + pp.length);
        const alpha = this._alpha(it, this.seeThrough ? 0.16 : (it.alpha0 != null ? it.alpha0 : 0.96));
        ctx.save();
        const fill = this._color(it, pal, 'fill');
        ctx.fillStyle = rgba(fill, alpha);
        this._inkPath(pp.map(p => [p.x, p.y]), seed, 1.1, true);
        ctx.fill();
        if (it.texture !== false) {
          // 铅笔排线：极淡的斜线，制造手绘纸面质感（仅对较大的面）
          let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
          for (const p of pp) { minx = Math.min(minx, p.x); miny = Math.min(miny, p.y); maxx = Math.max(maxx, p.x); maxy = Math.max(maxy, p.y); }
          if ((maxx - minx) * (maxy - miny) > 1300) {
            ctx.save();
            ctx.clip();
            ctx.globalAlpha = 0.07;
            ctx.strokeStyle = pal.ink;
            ctx.lineWidth = 0.7;
            const step = 11;
            const seed0 = (seed % 7) - 3;
            for (let x = minx - (maxy - miny); x < maxx + 4; x += step) {
              ctx.beginPath();
              ctx.moveTo(x + seed0, maxy + 3);
              ctx.lineTo(x + (maxy - miny) + seed0, miny - 3);
              ctx.stroke();
            }
            ctx.restore();
          }
        }
        if (it.hatch) {
          ctx.save();
          ctx.clip();
          ctx.globalAlpha = 0.35;
          ctx.strokeStyle = pal.inkLight || pal.ink;
          ctx.lineWidth = 0.7;
          const bb = pp.reduce((o, p) => [Math.min(o[0], p.x), Math.min(o[1], p.y), Math.max(o[2], p.x), Math.max(o[3], p.y)], [1e9, 1e9, -1e9, -1e9]);
          for (let x = bb[0] - 40; x < bb[2] + 40; x += 9) {
            ctx.beginPath(); ctx.moveTo(x, bb[1] - 10); ctx.lineTo(x + 30, bb[3] + 10); ctx.stroke();
          }
          ctx.restore();
        }
        ctx.restore();
        if (it.edge !== false) {
          this._strokeInk(pp.map(p => [p.x, p.y]), seed + 3, {
            color: it.edgeColor || this._color(it, pal, 'stroke'),
            width: it.sw || 1.5,
            alpha: this._alpha(it, this.seeThrough ? 0.55 : 0.95),
            closed: true,
          });
        }
        if (it.key) this._pickables.push({ key: it.key, poly: pp, depth: it._depth, tip: it.tip });
        return;
      }
      if (it.type === 'line' || it.type === 'poly') {
        const raw = it.type === 'line' ? [it.a, it.b] : it.pts;
        const pp = this._projPts(raw);
        if (!pp || pp.length < 2) return;
        const seed = hashStr(it.key || 'l' + (it.seed || 0) + raw.length);
        this._strokeInk(pp.map(p => [p.x, p.y]), seed, {
          color: this._color(it, pal, 'stroke'),
          width: it.sw || (it.key ? 2 : 1.25),
          alpha: this._alpha(it, it.alpha0 != null ? it.alpha0 : 1),
          dash: it.dash,
          closed: it.type === 'poly' && it.closed,
          amp: it.amp,
        });
        if (it.key && it.type === 'line') this._pickables.push({ key: it.key, seg: pp, depth: it._depth });
        return;
      }
    }

    _drawTop(it, pal) {
      const ctx = this.ctx;
      if (it.type === 'face') {
        const pp = this._projPts(it.pts);
        if (!pp) return;
        ctx.save();
        ctx.fillStyle = rgba(this._color(it, pal, 'fill'), this._alpha(it, it.alpha0 != null ? it.alpha0 : 0.5));
        this._inkPath(pp.map(p => [p.x, p.y]), hashStr(it.key || 'tf') + 5, 0.8, true);
        ctx.fill();
        ctx.restore();
        this._strokeInk(pp.map(p => [p.x, p.y]), hashStr(it.key || 'tf') + 9, {
          color: this._color(it, pal, 'stroke'), width: it.sw || 1.7,
          alpha: this._alpha(it, 0.95), dash: it.dash, closed: true,
        });
        if (it.key) this._pickables.push({ key: it.key, poly: pp, depth: -1, tip: it.tip });
        return;
      }
      if (it.type === 'line' || it.type === 'poly') {
        const raw = it.type === 'line' ? [it.a, it.b] : it.pts;
        const pp = this._projPts(raw);
        if (!pp) return;
        this._strokeInk(pp.map(p => [p.x, p.y]), hashStr(it.key || 'tl') + 2, {
          color: this._color(it, pal, 'stroke'),
          width: it.sw || 2,
          alpha: this._alpha(it, it.alpha0 != null ? it.alpha0 : 1),
          dash: it.dash, closed: it.closed,
        });
        if (it.arrow) this._arrow(pp[pp.length - 2], pp[pp.length - 1], this._color(it, pal, 'stroke'));
        return;
      }
      if (it.type === 'angle') {
        const a = this.project(it.a), b = this.project(it.b), c = this.project(it.c);
        if (!a || !b || !c) return;
        const r = 26 * this._strokeBase;
        const a1 = Math.atan2(a.y - b.y, a.x - b.x), a2 = Math.atan2(c.y - b.y, c.x - b.x);
        ctx.save();
        ctx.strokeStyle = this._color(it, pal, 'stroke');
        ctx.globalAlpha = this._alpha(it, 0.95);
        ctx.lineWidth = 1.6 * this._strokeBase;
        ctx.beginPath();
        let d = a2 - a1;
        while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
        ctx.arc(b.x, b.y, r, a1, a1 + d, d < 0);
        ctx.stroke();
        if (it.text) {
          const mid = a1 + d / 2;
          ctx.globalAlpha = this._alpha(it, 1);
          ctx.fillStyle = this._color(it, pal, 'stroke');
          ctx.font = `600 ${11.5 * this._strokeBase}px ${FONTS.kai}`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          this._haloText(it.text, b.x + Math.cos(mid) * (r + 13), b.y + Math.sin(mid) * (r + 13));
        }
        ctx.restore();
        return;
      }
    }

    _arrow(a, b, color) {
      const ctx = this.ctx;
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const s = 9 * this._strokeBase;
      ctx.save();
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - s * Math.cos(ang - 0.4), b.y - s * Math.sin(ang - 0.4));
      ctx.lineTo(b.x - s * Math.cos(ang + 0.4), b.y - s * Math.sin(ang + 0.4));
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    _drawPoint(it, pal) {
      const ctx = this.ctx;
      const q = this.project(it.p);
      if (!q) return;
      const color = this._color(it, pal, 'stroke');
      const alpha = this._alpha(it, 1);
      const r = (it.r || 3.6) * this._strokeBase;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, TAU); ctx.fill();
      if (it.ring) {
        ctx.globalAlpha = alpha * 0.35;
        ctx.beginPath(); ctx.arc(q.x, q.y, r + 4.5, 0, TAU); ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.stroke();
      }
      ctx.restore();
      if (it.key) this._pickables.push({ key: it.key, p: q, depth: -2 });
    }

    _drawLabel(it, pal) {
      const q = this.project(it.p);
      if (!q) return;
      const color = this._color(it, pal, 'stroke');
      const alpha = this._alpha(it, 1);
      const size = (it.size || 13.5) * this._strokeBase;
      const ctx = this.ctx;
      const dx = it.dx || 0, dy = it.dy || 0;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `${it.bold === false ? 500 : 700} ${size}px ${FONTS.kai}`;
      ctx.textAlign = it.align || 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = color;
      if (it.leader) {
        ctx.globalAlpha = alpha * 0.5;
        ctx.strokeStyle = color; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x + dx, q.y + dy); ctx.stroke();
        ctx.globalAlpha = alpha;
      }
      this._haloText(it.text, q.x + dx, q.y + dy);
      if (it.key) this._pickables.push({ key: it.key, p: { x: q.x + dx, y: q.y + dy }, depth: -3 });
      ctx.restore();
    }

    _haloText(text, x, y) {
      const ctx = this.ctx;
      ctx.save();
      ctx.lineWidth = 4.5;
      ctx.strokeStyle = (this._pal && this._pal.paper) || '#faf5e9';
      ctx.lineJoin = 'round';
      ctx.strokeText(text, x, y);
      ctx.fillText(text, x, y);
      ctx.restore();
    }

    _drawBall(it, pal) {
      const ctx = this.ctx;
      const c = this.project(it.c);
      if (!c) return;
      const R = it.r * c.k;
      if (R < 1) return;
      const alpha = this._alpha(it, 1);
      const base = it.color || pal.tint;
      const lit = mix(base, '#ffffff', 0.55);
      const deep = mix(base, pal.ink, 0.25);
      ctx.save();
      ctx.globalAlpha = alpha;
      const g = ctx.createRadialGradient(c.x - R * 0.35, c.y - R * 0.4, R * 0.1, c.x, c.y, R * 1.15);
      g.addColorStop(0, rgba(lit, this.seeThrough ? 0.34 : 0.98));
      g.addColorStop(0.65, rgba(base, this.seeThrough ? 0.26 : 0.92));
      g.addColorStop(1, rgba(deep, this.seeThrough ? 0.2 : 0.9));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, TAU); ctx.fill();
      ctx.restore();
      // 轮廓
      const circle = [];
      for (let i = 0; i <= 40; i++) {
        const a = i / 40 * TAU;
        circle.push([c.x + Math.cos(a) * R, c.y + Math.sin(a) * R]);
      }
      this._strokeInk(circle, hashStr('ball' + (it.key || '')), {
        color: this._color(it, pal, 'stroke'), width: 1.7,
        alpha: alpha * (this.seeThrough ? 0.7 : 0.95), closed: true,
      });
      // 大圆（赤道 + 两条经线），背面用虚线
      const camPos = this._c.camPos, ctr = it.c;
      const planes = [
        { u: [1, 0, 0], v: [0, 0, 1] },
        { u: [0, 1, 0], v: [0, 0, 1] },
        { u: [1, 0, 0], v: [0, 1, 0] },
      ];
      planes.forEach((pl, idx) => {
        const front = [], back = [];
        for (let i = 0; i <= 72; i++) {
          const a = i / 72 * TAU;
          const p = V.add(ctr, V.add(V.mul(pl.u, it.r * Math.cos(a)), V.mul(pl.v, it.r * Math.sin(a))));
          const q = this.project(p);
          if (!q) continue;
          const vis = V.dot(V.sub(p, ctr), V.sub(camPos, ctr)) >= 0;
          (vis ? front : back).push([q.x, q.y]);
        }
        if (back.length > 1) this._strokeInk(back, hashStr('bb' + idx), {
          color: this._color(it, pal, 'stroke'), width: 1,
          alpha: alpha * (this.seeThrough ? 0.55 : 0.28), dash: [4, 4],
        });
        if (front.length > 1) this._strokeInk(front, hashStr('bf' + idx), {
          color: this._color(it, pal, 'stroke'), width: 1.15, alpha: alpha * 0.72,
        });
      });
      if (it.key) this._pickables.push({ key: it.key, p: c, depth: -4 });
    }

    /* ---------------- 拾取 ---------------- */
    _pick(x, y) {
      let best = null;
      const sorted = this._pickables.slice().sort((a, b) => (a.depth || 0) - (b.depth || 0));
      for (const p of sorted) {
        if (p.poly && pointInPoly(x, y, p.poly)) best = p;
        else if (p.p && Math.hypot(p.p.x - x, p.p.y - y) < 15) best = p;
        else if (p.seg && distToSeg(x, y, p.seg[0], p.seg[1]) < 6) best = p;
        if (best) break;
      }
      if (best && this.onPick) this.onPick(best.key, best.tip);
      else if (!best && this.onPick) this.onPick(null);
    }

    _hoverAt(e) {
      if (!this.showLabels) return;
      const r = this.canvas.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      let hit = null;
      for (const p of this._pickables) {
        if (p.p && Math.hypot(p.p.x - x, p.p.y - y) < 16) hit = p;
      }
      const key = hit ? hit.key : null;
      if (key !== this.hover) { this.hover = key; this.canvas.style.cursor = key ? 'pointer' : 'grab'; }
    }

    _drawHoverTip(pal) {
      // 悬停时轻微强化：不额外绘制，保持画面干净
    }
  }

  function itemDepth(st, it) {
    let pts;
    if (it.type === 'line') pts = [it.a, it.b];
    else if (it.pts) pts = it.pts;
    else return 0;
    let sum = 0, n = 0;
    for (const p of pts) {
      const q = st.project(p);
      if (q) { sum += q.d; n++; }
    }
    return n ? sum / n : 0;
  }

  function flatten(arr) {
    const out = [];
    for (const it of arr) {
      if (!it) continue;
      if (Array.isArray(it)) out.push(...flatten(it));
      else out.push(it);
    }
    return out;
  }

  function pointInPoly(x, y, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  function distToSeg(px, py, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const L = dx * dx + dy * dy || 1;
    let t = ((px - a.x) * dx + (py - a.y) * dy) / L;
    t = clamp(t, 0, 1);
    return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
  }

  const DEFAULT_PALETTE = {
    ink: '#2b2823', inkLight: '#6f675a', paper: '#fbf6e9',
    tint: '#f0e3c8', accent: '#e4573d', accent2: '#3a6eb5',
  };

  global.Ink3D = {
    Studio, V, TAU, clamp, mix, rgba, hashStr, noise,
    palette: DEFAULT_PALETTE,
    FONTS,
    setFonts(f) { Object.assign(FONTS, f || {}); },
    // 场景元素工厂
    face(pts, o) { return Object.assign({ type: 'face', pts }, o); },
    line(a, b, o) { return Object.assign({ type: 'line', a, b }, o); },
    poly(pts, o) { return Object.assign({ type: 'poly', pts }, o); },
    point(p, o) { return Object.assign({ type: 'point', p }, o); },
    label(p, text, o) { return Object.assign({ type: 'label', p, text }, o); },
    ball(c, r, o) { return Object.assign({ type: 'ball', c, r }, o); },
    angle(a, b, c, text, o) { return Object.assign({ type: 'angle', a, b, c, text, layer: 'top' }, o); },
  };
})(window);
