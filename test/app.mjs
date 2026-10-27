/* DOM 冒烟测试：在 jsdom 中加载单文件 index.html，逐页切换并模拟交互 */
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { createCanvas } from '@napi-rs/canvas';

const html = fs.readFileSync('index.html', 'utf8');
const errors = [];
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'https://example.com/',
  beforeParse(win) {
    win.HTMLCanvasElement.prototype.getContext = function () {
      if (!this.__cv) this.__cv = createCanvas(this.width || 760, this.height || 560);
      return this.__cv.getContext('2d');
    };
    win.requestAnimationFrame = () => 1;
    win.cancelAnimationFrame = () => {};
    win.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
    win.addEventListener('error', e => errors.push('window error: ' + e.message));
    const oc = win.console;
    win.console = Object.assign({}, oc, {
      error: (...a) => { errors.push('console.error: ' + a.map(String).join(' ')); },
      warn: () => {},
    });
  },
});
const { window } = dom;
await new Promise(r => setTimeout(r, 400));

const doc = window.document;
const check = (cond, msg) => { if (!cond) errors.push('FAIL: ' + msg); };
check(window.PAGES.length === 12, '页面数量应为 12，实际 ' + window.PAGES.length);
check(doc.querySelector('.cover'), '封面应渲染');
check(doc.querySelector('#cover-canvas'), '封面画布应存在');
check(doc.querySelectorAll('.cover-toc a').length === 11, '封面目录应有 11 项');

const total = window.PAGES.length;
for (let i = 1; i < total; i++) {
  window.BOOK_GO(i);
  await new Promise(r => setTimeout(r, 60));
  const p = window.PAGES[i];
  check(doc.querySelectorAll('.leaf').length === 2, `第 ${i} 页应有两个书页`);
  check(doc.querySelectorAll('.pane-block').length === 3, `第 ${i} 页应有 3 个内容页签`);
  // 三个页签都有内容
  const panes = [...doc.querySelectorAll('.pane-block')].map(x => x.textContent.trim().length);
  check(panes.every(n => n > 60), `第 ${i} 页各页签内容过少 ${panes}`);
  // 例题步骤
  const steps = doc.querySelectorAll('.step');
  if (p.tabs.example && p.tabs.example.includes('id="p') ) check(steps.length > 0, `第 ${i} 页例题缺少分步`); 
  // 模拟“下一步”
  const next = doc.querySelector('.step-ctl [data-s="next"]');
  if (next) { next.click(); await new Promise(r => setTimeout(r, 10)); }
  const nowStep = doc.querySelectorAll('.step.now').length;
  check(nowStep <= 1, `第 ${i} 页高亮步骤数异常`);
  // 切页签
  const tab = doc.querySelector('.tab[data-tab="practice"]');
  if (tab) {
    tab.click();
    await new Promise(r => setTimeout(r, 10));
    check(doc.querySelector('.pane-block[data-pane="practice"]').classList.contains('on'), `第 ${i} 页练习页签未激活`);
    // 答案展开
    const reveal = doc.querySelector('.ans-btn');
    if (reveal) {
      reveal.click();
      await new Promise(r => setTimeout(r, 10));
      const open = [...doc.querySelectorAll('.ans.open')].length;
      check(open > 0, `第 ${i} 页答案未能展开`);
    }
    // 选项判定
    const opt = doc.querySelector('.opt');
    if (opt) { opt.click(); await new Promise(r => setTimeout(r, 5)); }
  }
  // 工具按钮
  doc.querySelectorAll('[data-viz]').forEach(b => { try { b.click(); } catch (e) { errors.push('viz click error p' + i + ': ' + e.message); } });
  // 参数滑块
  const slider = doc.querySelector('[data-param]');
  if (slider) {
    slider.value = String((parseFloat(slider.min) + parseFloat(slider.max)) / 2);
    slider.dispatchEvent(new window.Event('input', { bubbles: true }));
  }
  await new Promise(r => setTimeout(r, 40));
  check(window.BOOK_APP.studio, `第 ${i} 页 3D 引擎未创建`);
}

// 全局控件
doc.getElementById('btn-see').click();
check(doc.getElementById('btn-see').classList.contains('on'), '透视开关未生效');
doc.getElementById('btn-labels').click();
doc.querySelectorAll('[data-pal]')[3].click();
check(window.getComputedStyle(doc.documentElement).getPropertyValue('--accent').trim() === '#38659f', '配色切换未生效');
doc.getElementById('btn-reset').click();
// 键盘翻页
doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
await new Promise(r => setTimeout(r, 60));
// 目录跳转
window.BOOK_GO(0);
await new Promise(r => setTimeout(r, 60));
doc.querySelector('.cover-toc a[data-goto="5"]').click();
await new Promise(r => setTimeout(r, 80));
check(window.BOOK_APP.state.page === 5, '封面目录跳转失败');

console.log(errors.length ? errors.join('\n') : 'APP SMOKE TEST OK');
process.exit(errors.length ? 1 : 0);
