/* =============================================================
   test/lab-model.mjs · 实验室模型级回归（无头 Canvas）
   每个正文模式 × {默认参数, 推过头参数}：build 不得抛错、
   必须回吐 ≥3 个仪表，且仪表文本不得出现 NaN/undefined。
   用法：node test/lab-model.mjs
   ============================================================= */
import fs from 'node:fs';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
for (const f of ['NotoSansSC-Regular.otf', 'NotoSerifSC-Regular.otf']) {
  try { GlobalFonts.registerFromPath('/home/user/.fonts/' + f); } catch (e) { /* 字体缺失只影响截图 */ }
}

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
load('src2/scenes.js');
load('src2/labs.js');

const PAL = { ink: '#2b2823', inkLight: '#6f675a', paper: '#fbf6e9', tint: '#efdcc6', accent: '#d9503a', accent2: '#38659f' };
const W = 700, H = 620;
function makeStudio(sc) {
  const cv = createCanvas(W, H);
  const ctx = cv.getContext('2d');
  const fake = {
    width: W, height: H, style: {},
    parentElement: { clientWidth: W, clientHeight: H },
    getContext: () => ctx,
    addEventListener() {}, setPointerCapture() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: W, height: H }),
  };
  const studio = new window.Ink3D.Studio(fake, Object.assign({ yaw: -0.5, pitch: 0.24, zoom: 1 }, sc.camera || {}));
  studio.setPalette(PAL);
  studio.showLabels = true;
  studio._resize();
  studio.setScene(() => ({ items: [], fit: 1 }));
  studio.render(); // 先渲一空帧，让相机内部状态就位（浏览器里构造后自动完成）
  return studio;
}
const seed = spec => {
  const o = {};
  (spec.controls || []).forEach(ct => { o[ct.id] = ct.type === 'trigger' ? 1 : ct.val; });
  return o;
};

let fail = 0, runs = 0;
for (const [key, sc] of Object.entries(window.SCENES)) {
  if (key === 'cover' || key === 'fallback') continue;
  const studio = makeStudio(sc);
  for (const m of sc.modes || []) {
    const spec = (window.LABS[key] || {})[m.id];
    if (!spec) { console.log(`✗ ${key}:${m.id} 缺实验室规格`); fail++; continue; }
    if (!spec.controls || !spec.controls.length) { console.log(`✗ ${key}:${m.id} 无控件`); fail++; }
    const variants = [['默认', seed(spec)], ['推过头', Object.assign(seed(spec), spec.brk ? spec.brk.params : {})]];
    for (const [name, params] of variants) {
      runs++;
      try {
        const r = sc.build(0.7, { st: studio, mode: m.id, params });
        if (!r || !r.items || r.items.length < 3) throw new Error('图形元素过少');
        if (!r.gauges || r.gauges.length < 3) throw new Error('仪表不足 3 个：' + (r.gauges ? r.gauges.length : 'null'));
        const bad = r.gauges.find(([k, v]) => v == null || /NaN|undefined|Infinity/.test(String(v)) && !String(k).includes('不存在'));
        if (bad) throw new Error('仪表异常 ' + bad.join('='));
        studio.setScene(t => sc.build(t, { st: studio, mode: m.id, params }));
        studio.render(); // 画一遍，捕捉绘制期错误
      } catch (e) {
        fail++;
        console.log(`✗ ${key}:${m.id}（${name}）${e.message}`);
      }
    }
  }
}
console.log(fail ? `\nLAB MODEL FAILED · ${fail} 个问题 / ${runs} 次构建` : `\nLAB MODEL OK · 67 个模式 × 默认/推过头共 ${runs} 次构建全部回吐仪表`);
process.exit(fail ? 1 : 0);
