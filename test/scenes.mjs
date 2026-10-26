/* 场景渲染测试：用真实 Canvas 绘制 21 个场景的每一种模式，导出 PNG 并统计墨迹覆盖率 */
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
for (const f of ['NotoSansSC-Regular.otf', 'NotoSerifSC-Regular.otf']) {
  try { GlobalFonts.registerFromPath('/home/user/.fonts/' + f); } catch (e) { console.warn('font', f, e.message); }
}

const W = 700, H = 620;
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

const PAL = { ink: '#2b2823', inkLight: '#6f675a', paper: '#fbf6e9', tint: '#efdcc6', accent: '#d9503a', accent2: '#38659f' };
const outDir = 'test/out/scenes';
fs.mkdirSync(outDir, { recursive: true });

const only = process.argv[2];
let fail = 0, count = 0;
const report = [];

for (const [key, sc] of Object.entries(window.SCENES)) {
  if (only && key !== only) continue;
  const modes = sc.modes && sc.modes.length ? sc.modes : ['default'];
  for (const m of (sc.modes && sc.modes.length ? sc.modes : [{ id: 'default' }])) {
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
    studio.setScene(t => sc.build(t, { st: studio, mode: m.id, params: {} }));
    studio._resize();
    studio.render();
    // 把透明背景合成到纸色上，便于人眼检查
    const paper = createCanvas(W, H);
    const pctx = paper.getContext('2d');
    pctx.fillStyle = '#fbf6e9';
    pctx.fillRect(0, 0, W, H);
    pctx.drawImage(cv, 0, 0);
    const img = pctx.getImageData(0, 0, W, H);
    let ink = 0;
    for (let i = 0; i < img.data.length; i += 4) {
      const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
      if (Math.abs(r - 251) + Math.abs(g - 246) + Math.abs(b - 233) > 26) ink++;
    }
    const cover = ink / (W * H);
    const file = path.join(outDir, `${key}-${m.id}.png`);
    fs.writeFileSync(file, paper.encodeSync('png'));
    count++;
    const ok = cover > 0.006;
    if (!ok) fail++;
    report.push(`${ok ? '✓' : '✗'} ${key.padEnd(9)} ${String(m.id).padEnd(12)} ink ${(cover * 100).toFixed(2)}%  ${file}`);
  }
}

console.log(report.join('\n'));
console.log(`\n${count} 个场景模式，${fail ? fail + ' 个异常（画面过空）' : '全部有内容'}`);
if (fail) process.exit(1);
