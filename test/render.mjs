/* 无头渲染测试：用 @napi-rs/canvas 真实绘制每一页的 3D 场景，导出 PNG 供视觉检查 */
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
for (const f of ['NotoSansSC-Regular.otf', 'NotoSerifSC-Regular.otf']) {
  try { GlobalFonts.registerFromPath('/home/user/.fonts/' + f); } catch (e) { console.warn('font', f, e.message); }
}
globalThis.__FONT_STACK__ = '"Noto Serif SC","Noto Sans SC",serif';

const W = 700, H = 600;
globalThis.window = globalThis;
globalThis.devicePixelRatio = 1;
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
globalThis.PAGES = [];

const load = f => (0, eval)(fs.readFileSync(f, 'utf8'));
load('src/engine.js');
window.Ink3D.setFonts({ kai: '"Noto Serif SC",serif', serif: '"Noto Serif SC",serif' });
load('src/geo.js');
for (const f of fs.readdirSync('src/pages').sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]))) {
  load(path.join('src/pages', f));
}

const outDir = 'test/out';
fs.mkdirSync(outDir, { recursive: true });
const palettes = [
  { id: 'tomato', accent: '#d9503a', tint: '#efdcc6' },
  { id: 'mustard', accent: '#b8860f', tint: '#f0e3b8' },
  { id: 'mint', accent: '#2f9c80', tint: '#dbe9df' },
  { id: 'cobalt', accent: '#38659f', tint: '#dde4f0' },
  { id: 'blush', accent: '#cf7c8c', tint: '#f3dfe1' },
];
const engPal = p => ({ ink: '#2b2823', inkLight: '#6f675a', paper: '#fbf6e9', tint: p.tint, accent: p.accent, accent2: '#38659f' });

const VARIANTS = {
  p3: ['cylinder', 'cone', 'frustum', 'sphere'],
  p5: ['frustum', 'funnel', 'hollow', 'cyl'],
  p6: ['fact1', 'fact2', 'fact3', 'cor', 'symbol'],
  p7: ['cross', 'parallel', 'skew', 'angle', 'move'],
  p8: ['judge', 'prop', 'judge2', 'prop2', 'path', 'mid'],
  p9: ['define', 'judge', 'prop', 'dihedral', 'judge2', 'prop2', 'three'],
  p10: ['point', 'line', 'skew', 'angle', 'dihedral'],
  p11: ['combo', 'cut', 'inner', 'outer'],
};
let fail = 0;
for (let i = 0; i < window.PAGES.length; i++) {
  const page = window.PAGES[i];
  const body = createCanvas(W, H);
  const ctx = body.getContext('2d');
  const canvas = {
    width: W, height: H, style: {},
    parentElement: { clientWidth: W, clientHeight: H },
    getContext: () => ctx,
    addEventListener() {}, setPointerCapture() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: W, height: H }),
  };
  const studio = new window.Ink3D.Studio(canvas, Object.assign({ yaw: -0.6, pitch: 0.34, zoom: 1 }, page.camera || {}));
  studio.setPalette(engPal(palettes[i % palettes.length]));
  studio.offset = (page.camera && page.camera.offset) || [0, 0, 0];
  const params = Object.assign({}, page.defaults || {});
  const ctxObj = { studio, params, root: { querySelector: () => null, querySelectorAll: () => [] }, page, set() {}, get(k) { return params[k]; }, refresh() {}, goto() {} };
  studio.setScene(t => page.scene(t, ctxObj));
  try {
    studio.render();
  } catch (e) {
    fail++;
    console.error('RENDER FAIL', page.id, e);
  }
  // 检查场景数据
  const scene = page.scene(0, ctxObj);
  let n = 0, bad = 0;
  const walk = arr => {
    for (const it of arr || []) {
      if (!it) continue;
      if (Array.isArray(it)) { walk(it); continue; }
      n++;
      const pts = it.pts || (it.a ? [it.a, it.b] : null);
      if (pts) for (const p of pts) {
        if (!Array.isArray(p) || p.some(v => !isFinite(v))) bad++;
      }
      if (it.type === 'ball' && it.c.some(v => !isFinite(v))) bad++;
      if (it.type === 'label' && !it.text) bad++;
    }
  };
  walk(scene.items);
  if (bad) { fail++; console.error('BAD COORDS', page.id, bad); }
  fs.writeFileSync(path.join(outDir, `${String(i).padStart(2, '0')}-${page.id}.png`), await body.encode('png'));
  console.log(`page ${i} ${page.id} · items ${n} · 场景 ${bad ? '异常' : 'OK'}`);
  studio.destroy();

  for (const mode of (VARIANTS[page.id] || [])) {
    const body2 = createCanvas(W, H);
    const c2 = body2.getContext('2d');
    const cv2 = Object.assign({}, canvas, { getContext: () => c2 });
    const st2 = new window.Ink3D.Studio(cv2, Object.assign({ yaw: -0.6, pitch: 0.34, zoom: 1 }, page.camera || {}));
    st2.setPalette(engPal(palettes[i % palettes.length]));
    st2.offset = (page.camera && page.camera.offset) || [0, 0, 0];
    const p2 = Object.assign({}, page.defaults || {}, { mode });
    const ctx2 = { studio: st2, params: p2, root: { querySelector: () => null, querySelectorAll: () => [] }, page, set() {}, get(k) { return p2[k]; }, refresh() {}, goto() {} };
    if (mode === 'cyl') { p2.mode = 'cyl'; }
    st2.setScene(t => page.scene(t, ctx2));
    try { st2.render(); } catch (e) { fail++; console.error('VARIANT FAIL', page.id, mode, e.message); }
    fs.writeFileSync(path.join(outDir, `${String(i).padStart(2, '0')}-${page.id}-${mode}.png`), await body2.encode('png'));
    st2.destroy();
  }
}
console.log(fail ? `FAILED ${fail}` : 'ALL RENDER OK');
process.exit(fail ? 1 : 0);
