/* =============================================================
   stage.js · 真三维书籍舞台
   - 透视相机：yaw / pitch / dk（视距）驱动整本书的 3D 变换
   - 拖动旋转、滚轮推拉、双击复位、转台自转
   - 纸页沿书脊真实翻转（0° ↔ -180°），带纸面明暗与投影
   - 三种视图：立体（3d）/ 正视（print）/ 手机上下叠（phone）
   ============================================================= */
(function () {
  'use strict';

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rad = d => d * Math.PI / 180;

  const CAM = { yaw: -14, pitch: 24, dk: 820 };
  const LIMIT = { pitch: [-6, 78], yaw: [-58, 58], dk: [580, 1250] };

  const S = {
    stage: null, camera: null, book: null, leaf: null,
    mode: '3d', spin: false, spinRaf: 0, dragging: false,
    hud: null, hint: null, lastDrag: 0, onCam: null,
  };

  /* ---------------- 尺寸 ---------------- */
  function layout() {
    if (!S.stage) return;
    const w = S.stage.clientWidth, h = S.stage.clientHeight;
    if (!w || !h) return;
    const phone = S.mode === 'phone';
    if (phone) {
      S.stage.style.setProperty('--pw', (w - 24) + 'px');
      S.stage.style.setProperty('--ph', 'auto');
      return;
    }
    const pad = 0.9;
    let ph = h * (S.mode === 'print' ? 0.86 : 0.9);
    let pw = ph * 0.735;
    if (pw * 2 > w * pad) { pw = w * pad / 2; ph = pw / 0.735; }
    S.stage.style.setProperty('--pw', Math.round(pw) + 'px');
    S.stage.style.setProperty('--ph', Math.round(ph) + 'px');
    S.stage.style.setProperty('--persp', Math.round(Math.max(1400, w * 1.35)) + 'px');
    FIT.scale = 1; FIT.x = 0; FIT.y = 0; applyFit();
    applyCam(true);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      /* 先归 1 再量：否则首帧尺寸未定时量的结果会一路缩下去、再也涨不回来 */
      measureFit('reset');
      FIT.base = Math.min(1, FIT.scale);
      measureFit(true);
    }));
  }

  /* ---------------- 取景：把整本书摆进舞台中央，且不被裁掉 ---------------- */
  const FIT = { scale: 1, x: 0, y: 0, base: 1 };

  function applyFit() {
    if (!S.camera) return;
    S.camera.style.setProperty('--fit', FIT.scale.toFixed(4));
    S.camera.style.setProperty('--offx', FIT.x.toFixed(1) + 'px');
    S.camera.style.setProperty('--offy', FIT.y.toFixed(1) + 'px');
  }

  function rectOf(el) { return el.getBoundingClientRect(); }

  /* doScale: 按需把整本书缩到舞台里；总会把它居中 */
  function measureFit(doScale) {
    if (!S.stage || !S.book || S.mode === 'phone' || !S.book.clientWidth) return;
    S.camera.classList.add('live');            // 关掉过渡，否则量到的是动画中间态
    const savedZoom = S.camera.style.getPropertyValue('--zoom');
    S.camera.style.setProperty('--zoom', '1');  // 取景只看姿态，不看用户缩放
    if (doScale === 'reset') { FIT.scale = 1; FIT.x = 0; FIT.y = 0; applyFit(); }
    for (let pass = 0; pass < 3; pass++) {
      const sr = rectOf(S.stage), br = rectOf(S.book);
      if (!br.width || !br.height) break;
      if (doScale) {
        const k = Math.min((sr.width * 0.96) / br.width, (sr.height * 0.96) / br.height);
        if (k < 1 || FIT.scale < FIT.base) {
          FIT.scale = Math.max(0.22, Math.min(FIT.base, FIT.scale * (k < 1 ? k * 0.995 : Math.min(k, 1.004))));
          applyFit();
        }
      }
      const sr2 = rectOf(S.stage), br2 = rectOf(S.book);
      const dx = (sr2.left + sr2.width / 2) - (br2.left + br2.width / 2);
      const dy = (sr2.top + sr2.height / 2) - (br2.top + br2.height / 2);
      if (Math.abs(dx) > 0.6) FIT.x = Math.max(-260, Math.min(260, FIT.x + dx));
      if (Math.abs(dy) > 0.6) FIT.y = Math.max(-260, Math.min(260, FIT.y + dy));
      applyFit();
    }
    if (savedZoom) S.camera.style.setProperty('--zoom', savedZoom); else S.camera.style.removeProperty('--zoom');
    S.camera.classList.remove('live');
  }

  let fitTimer = 0;
  function scheduleFit(doScale) {
    clearTimeout(fitTimer);
    fitTimer = setTimeout(() => { measureFit(doScale !== false); }, 200);
  }

  /* ---------------- 相机 ---------------- */
  function applyCam(instant) {
    if (!S.stage) return;
    S.stage.style.setProperty('--yaw', CAM.yaw.toFixed(2) + 'deg');
    S.stage.style.setProperty('--pitch', CAM.pitch.toFixed(2) + 'deg');
    S.stage.style.setProperty('--zoom', zoomOf().toFixed(4));
    if (instant && S.camera) {
      S.camera.classList.add('live');
      requestAnimationFrame(() => S.camera && S.camera.classList.remove('live'));
    }
    if (S.hud) {
      S.hud.innerHTML =
        '<b>yaw</b> ' + CAM.yaw.toFixed(1) + '° · <b>pitch</b> ' + CAM.pitch.toFixed(1) +
        '° · <b>dk</b> ' + Math.round(CAM.dk) + ' · <b>' + (S.mode === 'print' ? '正视' : S.mode === 'phone' ? '单页' : '立体') + '</b>';
    }
    if (S.mode !== 'phone') scheduleFit(true);
    if (S.onCam) S.onCam(cameraState());
  }
  function zoomOf() { return 820 / CAM.dk; }
  function cameraState() { return { yaw: CAM.yaw, pitch: CAM.pitch, dk: Math.round(CAM.dk) }; }

  function setCam(next, opts) {
    const instant = !!(opts && opts.instant);
    if (next.yaw !== undefined) CAM.yaw = clamp(next.yaw, LIMIT.yaw[0], LIMIT.yaw[1]);
    if (next.pitch !== undefined) CAM.pitch = clamp(next.pitch, LIMIT.pitch[0], LIMIT.pitch[1]);
    if (next.dk !== undefined) CAM.dk = clamp(next.dk, LIMIT.dk[0], LIMIT.dk[1]);
    applyCam(instant);
  }

  function resetCam(instant) {
    stopSpin();
    setCam({ yaw: -14, pitch: 24, dk: 820 }, { instant: instant !== false });
  }

  function printCam(instant) {
    stopSpin();
    setCam({ yaw: 0, pitch: 0, dk: 715 }, { instant: instant !== false });
  }

  /* ---------------- 模式 ---------------- */
  function setMode(mode, opts) {
    if (!S.stage) return;
    S.mode = mode;
    S.stage.classList.toggle('print', mode === 'print');
    S.stage.classList.toggle('phone', mode === 'phone');
    if (mode === 'print') { if (!(opts && opts.keepCam)) printCam(true); }
    else if (mode === '3d') { /* 保留当前相机 */ }
    else if (mode === 'phone') { CAM.yaw = 0; CAM.pitch = 0; CAM.dk = 760; applyCam(true); }
    layout();
    if (S.hint) S.hint.textContent = mode === 'print'
      ? '正视图 · 滚轮可滚动正文 · 按 V 回到立体'
      : mode === 'phone' ? '单页视图' : '拖动旋转 · 滚轮推拉 · 双击复位 · 按 P 正视';
    if (!(opts && opts.silent) && S.onMode) S.onMode(mode);
  }

  /* ---------------- 拖拽 / 缩放 ---------------- */
  function bindPointer() {
    const stage = S.stage;
    let sx = 0, sy = 0, ox = 0, oy = 0, active = false, moved = false, id = null;

    stage.addEventListener('pointerdown', e => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      if (S.mode !== '3d') return;
      if (e.target.closest('.viz, button, a, input, select, .tb-wrap, .pane table, .turn-leaf')) return;
      active = true; moved = false; id = e.pointerId;
      sx = e.clientX; sy = e.clientY; ox = CAM.yaw; oy = CAM.pitch;
      S.camera.classList.add('live');
      stage.setPointerCapture(e.pointerId);
    });

    stage.addEventListener('pointermove', e => {
      if (!active || e.pointerId !== id) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 5) return;
      if (!moved) {
        moved = true; stage.classList.add('grabbing');
        const sel = window.getSelection && window.getSelection();
        if (sel && sel.removeAllRanges) sel.removeAllRanges();
      }
      setCam({ yaw: ox + dx * 0.3, pitch: oy + dy * 0.26 }, { instant: true });
    });

    const end = e => {
      if (!active) return;
      active = false;
      stage.classList.remove('grabbing');
      S.camera.classList.remove('live');
      S.lastDrag = Date.now();
      if (e && e.pointerId !== undefined && stage.hasPointerCapture && stage.hasPointerCapture(e.pointerId)) {
        stage.releasePointerCapture(e.pointerId);
      }
    };
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);

    stage.addEventListener('wheel', e => {
      if (S.mode === 'print' || S.mode === 'phone') return;    // 正视图里滚轮交给正文
      e.preventDefault();
      setCam({ dk: CAM.dk * (1 + e.deltaY * 0.0013) });
    }, { passive: false });

    stage.addEventListener('dblclick', e => {
      if (e.target.closest('button, a, input, select, .viz')) return;
      resetCam();
    });
  }

  /* ---------------- 转台 ---------------- */
  function startSpin() {
    if (S.spin) return;
    S.spin = true;
    let last = performance.now(), dir = 1;
    const tick = now => {
      if (!S.spin) return;
      const dt = Math.min(48, now - last); last = now;
      let y = CAM.yaw + dt * 0.012 * dir;
      if (y > 46) { y = 46; dir = -1; }
      if (y < -46) { y = -46; dir = 1; }
      CAM.yaw = y; applyCam();
      S.spinRaf = requestAnimationFrame(tick);
    };
    S.spinRaf = requestAnimationFrame(tick);
  }
  function stopSpin() {
    S.spin = false;
    if (S.spinRaf) cancelAnimationFrame(S.spinRaf);
    S.spinRaf = 0;
  }

  /* ---------------- 翻页 ---------------- */
  const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  function turn(dir, faces, done) {
    const leaf = (S.book && S.book.querySelector('#turn-leaf')) || S.leaf;
    if (!leaf) { if (done) done(); return; }
    const front = leaf.querySelector('.tl-front');
    const back = leaf.querySelector('.tl-back');
    front.innerHTML = faces.front;
    back.innerHTML = faces.back;
    // 克隆出来的内容去掉重复 id
    leaf.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
    leaf.hidden = false;
    leaf.style.setProperty('--turn', (dir === 'next' ? 0 : -180) + 'deg');
    const t0 = performance.now();
    const dur = 780;
    const from = dir === 'next' ? 0 : -180;
    const to = dir === 'next' ? -180 : 0;
    const step = () => {
      const t = Math.min(1, (performance.now() - t0) / dur);
      const a = from + (to - from) * easeInOut(t);
      leaf.style.setProperty('--turn', a.toFixed(2) + 'deg');
      const shade = Math.sin(t * Math.PI) * 0.85;
      front.style.setProperty('--shade', dir === 'next' ? shade.toFixed(3) : (1 - t) * 0.4);
      back.style.setProperty('--shade', dir === 'next' ? (1 - t) * 0.4 : shade.toFixed(3));
      // 纸片飞起：中途抬高一点，制造“掀起来”的体积感
      const lift = Math.sin(t * Math.PI) * 16;
      leaf.style.transform = `rotateY(${a.toFixed(2)}deg) translateZ(${lift.toFixed(2)}px)`;
      if (t < 1) return;
      clearInterval(timer);
      leaf.style.transform = '';
      if (done) done();
      setTimeout(() => { leaf.hidden = true; }, 40);
    };
    /* 用定时器推进：无头/后台环境下 rAF 会被节流，翻页必须准点收尾 */
    const timer = setInterval(step, 16);
    step();
  }

  /* ---------------- 装订厚度 ---------------- */
  function update(meta) {
    if (!S.stage || !meta) return;
    const p = Math.max(0, Math.min(1, meta.page / Math.max(1, meta.total - 1)));
    const total = 30;
    S.stage.style.setProperty('--depth-l', Math.round(2 + p * total) + 'px');
    S.stage.style.setProperty('--depth-r', Math.round(2 + (1 - p) * total) + 'px');
  }

  /* ---------------- 初始化 ---------------- */
  function init(opts) {
    S.stage = opts.stage;
    S.camera = opts.camera;
    S.book = opts.book;
    S.leaf = opts.leaf || document.getElementById('turn-leaf');
    S.hud = document.getElementById('stage-hud');
    S.hint = document.getElementById('stage-hint');
    S.onCam = opts.onCam || null;
    S.onMode = opts.onMode || null;
    bindPointer();
    layout();
    window.addEventListener('resize', layout);
  }

  window.STAGE = {
    init, setMode, setCam, resetCam, printCam, layout,
    get fit() { return FIT; },
    refit(reset) { measureFit(reset === false ? true : 'reset'); if (reset !== false) { FIT.base = Math.min(1, FIT.scale); measureFit(true); } },
    turn, update, startSpin, stopSpin, cameraState,
    get state() { return CAM; },
    get mode() { return S.mode; },
    get spinning() { return S.spin; },
    set leaf(el) { S.leaf = el; },
    set onCam(fn) { S.onCam = fn; },
    set onMode(fn) { S.onMode = fn; },
  };
})();
