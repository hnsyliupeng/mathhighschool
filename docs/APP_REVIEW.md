# DDG Lab 全应用审查与优化记录

审查对象为本仓库的生产构建，不仅是新抓取页。这里的“通过”只指下列明确的测试范围，**不代表所有公式、原文复现、抓取物理或全部无障碍场景通过验收**。

## 应用层修正

- 将工作台、算例库、理论、验证和各实验室按页面懒加载；工作台的 KaTeX 也仅在打开“核心公式”时加载。参考对照数据不再包含在默认入口中。公式首次打开时显示加载状态。
- 根据源文件中的静态中文生成一个小型可变字体子集；未包含的输入字符继续使用原有 Noto Sans SC 字体回退，避免为初始界面加载大量完整分片。原字体许可随生产构建放在 `public/licenses/`。
- 浏览器前进/后退现在恢复页面、选中的算例、理论章节及 URL 搜索条件；不再用替换历史的方式吞掉导航记录。页面加载失败有明确提示和重新加载入口。
- 验证过程支持取消；离开页面或取消会终止正在运行的参考 Worker，并防止过期结果更新界面。Worker 不可用时仍采用原有主线程回退，该同步计算开始后不能即时中断。
- 三个早期视口按数据、显示选项、尺寸及相机变化重绘，暂停时不再持续渲染；切换显示仍会立即刷新。减少暂停状态的重复快照和状态克隆。
- 补充跳转主内容、帮助对话框焦点管理与 Escape、移动菜单状态与 Escape、视口命名区域，以及五指表头/单元格的语义；修正大量浅色文字对比度并统一实验页边距。
- 新腱驱动态实验的有限保持指标只接受完整逐步历史，拒绝用稀疏回放自行推断保持；预计算录像与其逐步报告及列出的源码哈希关联。

## 浏览器与截图

- [全应用记录](screenshots/app-wide-audit.json)覆盖 10 个页面，各保存一张 1440×1000 桌面图和一张 390×844 手机图，见 [`screenshots/app-review/`](screenshots/app-review/)。检查默认页面可显示、无页面错误、无整页横向溢出、导航状态以及已启动 Worker 的 HTTP 状态/MIME。
- 桌面默认状态执行 axe 的 `wcag2a`、`wcag2aa`、`wcag21a`、`wcag21aa` 标签规则；10 页未检出违规。**仅为自动规则和默认桌面状态**：不覆盖所有交互状态、屏幕阅读器、所有浏览器、Canvas 内容或人工无障碍测试，不能据此宣称全面符合 WCAG。
- 检查前进/后退、章节历史、帮助对话框焦点循环/恢复、手机菜单 Escape、验证取消、暂停时绘制次数和切换显示重绘。检查工作台公式的按需加载和 CSV 导出。
- [21 个算例浏览器记录](screenshots/audit.json)逐例检查非空 WebGL、早期时间推进、溢出与错误，并检查 8 个公式章节、参数、导出、手机导航，以及 WASM 失败时的诚实回退。截图总览：[01–07](screenshots/review-01.jpg) · [08–14](screenshots/review-02.jpg) · [15–21](screenshots/review-03.jpg)。这些截图不是准确性证明。
- [二维抓手浏览器检查](screenshots/gripper-browser-audit.json)覆盖默认与细网格、接触、参数、导出、无 Worker 回退、手机显示，以及暂停后无持续绘制、力箭头切换重绘。它不能验证三维孔壁接触。
- [三维抓手短路径检查](screenshots/gripper3d-redraw-audit.json)在生产构建上求解 0.5 mm，验证暂停重绘、透视切换、PNG/CSV/GIF 和导出后的场景恢复。仅为交互回归，不覆盖 14.75 mm 大卷曲物理检查。
- [五指固定球浏览器检查](screenshots/bionic-hand-browser-audit.json)重新运行相似尺度 6.75 mm，五指均接触，导出 28 帧 GIF 和 CSV；仅为固定支撑球体的一个路径，不是自由抓取验证。[多物体生产 Worker 检查](screenshots/multi-object-production-audit.json)验证初始化和形状切换，不验证加载路径。
- 独立指垫实验重测了四种对象、CSV/GIF、零摩擦和失败回滚，结果见 [浏览器记录](screenshots/material-grasp-browser-audit.json)；**该模型不是用户要求的实体腱驱手**。
- 腱驱五指动态实验检查四种形状、三种预计算录像 GIF、CSV、短时 Worker 和手机显示，见 [浏览器记录](screenshots/tendon-dynamic-browser-audit.json)。GIF 仅包含 12 个采样帧；不代表全自由度或物理验证。

## 性能、构建与安全

- 生产入口 JavaScript 为约 270 kB（gzip 约 87 kB），优化前单一入口约 1,596 kB；这仅是入口文件比较，**不是**整个首屏传输量。工作台冷启动的资源实测及字体、CSS 列表见 `app-wide-audit.json` 的 `workspaceLoad`；数值与压缩、字体缓存及浏览器有关，且该统计不包括 HTML 导航和 Worker 请求。
- 字体子集与按需公式加载后，同一 Chromium/预览环境中的工作台冷启动资源从约 1.42 MB 降到约 0.62 MB（压缩后资源体积，不含 HTML/Worker）；其中约 225 kB 是中文子集。字符不在子集中时会按需加载原字体分片；该结果不是其他设备或网络环境的承诺。
- 默认工作台未请求 KaTeX/参考数据 chunk；打开公式后按需加载。Three.js 及参考数据仍有超过 500 kB 的未压缩 chunk，构建警告尚未消除。
- 当前测试为 24 个测试文件、210 项通过；`npm run build` 成功，`npm audit --audit-level=low` 报告 0 个已知漏洞。这不是渗透测试，也不保证未来依赖没有漏洞。

## 数值验收边界

验证中心的 15 项局部数值检查、21 项可运行性检查与参考对照是不同指标。12 个已有独立参考时窗中，10 个达到各自严格阈值；另外 9 个算例仍是教学近似。球冠翻转条件窗口未通过，不能因局部通过而视为完整翻转验证。详见 [README](../README.md) 和 [验证记录](VALIDATION.md)。

新腱驱动态模型的指面直接接触不同尺寸、形状、刚度的自由物体，但每根指体只沿 Q1 自由参考流形运动，**不是五指、腱与物体的全自由度联立**。鸡蛋前 0.6 s 的 1/240 与 1/480 s 中指接触力最大差为峰值的 97.5%，布片基线未满足保持条件；单指的网格腱力也未达收敛要求。夹具、摩擦、物体自碰撞、材料标定和长期保持仍有限制。**用户要求的严格物理总体验证尚未通过。** 详细结果、失败项和重跑命令见 [TENDON_DYNAMIC_GRASP.md](TENDON_DYNAMIC_GRASP.md)。

## 复现应用层审查

需先安装项目依赖并准备独立的 Playwright、axe-core 和可运行的 Chromium。生产预览在单独终端运行：

```bash
npm ci
npm test
npm run build
npm audit --audit-level=low
npm run preview -- --port 5175
```

然后从仓库根目录运行（Linux 缺少 Chromium 动态库时，可按本机环境配置 `LD_LIBRARY_PATH`）：

```bash
mkdir -p /tmp/ddg-audit && cd /tmp/ddg-audit
npm init -y && npm install playwright-core axe-core
cd /path/to/mathhighschool
AUDIT_MODULE_ROOT=/tmp/ddg-audit CHROME_BIN=/path/to/chromium \
  AUDIT_BASE_URL=http://127.0.0.1:5175 node scripts/audit-app-wide.mjs
AUDIT_MODULE_ROOT=/tmp/ddg-audit CHROME_BIN=/path/to/chromium \
  AUDIT_BASE_URL=http://127.0.0.1:5175 node scripts/audit-browser.mjs
```

全应用脚本在开始和结束时对 `src`、构建配置、依赖锁文件、WASM 和脚本计算哈希；运行中这些文件发生变化会使审查失败。性能统计需要浏览器提供同源资源计时；若浏览器隐私设置屏蔽字节数，脚本会报错而不是把零值当结果。
