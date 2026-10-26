# 高中数学笔记 · 3D 互动全书

把 GitHub 开源笔记 [**liuhaopeng543/MathBook**](https://github.com/liuhaopeng543/MathBook)
的全部 **20 章**正文，装进一本会翻页、可旋转的 3D 书：

- **`mathbook.html`** — 新书，单文件 **1.8 MB**，零外部请求，双击即读
- **`index.html`** — 之前那本《立体几何 3D 互动解读》（人教A版必修二第八章，12 页），保留不动

```bash
# 直接打开
open mathbook.html          # macOS
start mathbook.html         # Windows
python3 -m http.server 8000 # 或起个静态服务器 → http://localhost:8000/mathbook.html
```

## 这本书里有什么

| 项 | 数量 |
|---|---|
| 章 | 20（01 方程求解 … 19 应试要求 + 99 高等数学） |
| 页 | 271 = 4 页卷首（封面 / 前言 / 目录×2）+ 266 页正文 + 1 页后记 |
| 节 | 127（按原笔记二、三级标题分节，侧栏可逐节跳转） |
| 正文 | 136.5 千字，与源笔记逐字一致，未删节、未改写 |
| 公式 | 7 740 处，全部在构建期解析成带语义的 HTML（可缩放、可选中、可复制） |
| 3D 场景 | 22 个展台 / 67 个演示模式，覆盖每一章 |

正文按「实测高度」分页：先用无头 Chromium 量出每个 Markdown 块在真实正文栏宽下的高度，
再按 750px 的目标高度贪心装页，页尾不留孤立的小节标题，过短的页自动并回邻页。
因此每页的中位填充率是 89%，只有 4 页需要页内轻微滚动（都是超大表格）。

## 交互

| 操作 | 作用 |
|---|---|
| ← → / PageUp PageDown / 空格 / 页面两侧箭头 | 翻页（CSS 3D 书页翻动动画） |
| 拖动右侧展台 / 滚轮 | 旋转、缩放 3D 演示；双击或「⟲」复位 |
| 芯片按钮 | 切换本章的不同演示（如立体几何 6 种：正方体 / 线面平行 / 线面垂直 / 截面 / 二面角 / 外接球） |
| 透视 `T` | 半透明化实体，看见内部结构与截面 |
| 标注 `L` | 点、线、面名称开关 |
| 配色 | 五套：番茄红 / 芥末黄 / 薄荷绿 / 钴蓝 / 腮红粉 |
| 目录 `M` / 检索 `/` | 章节树 + 全书关键词检索（命中页高亮片段，点击直达） |
| A− / A+ | 正文字号 80%–150%，版面随之重排 |
| ⤢ 放大表格 | 超宽表格在浮层里按窗口宽度重排 |

阅读位置、配色、字号、每章的演示模式与视角都存在 `localStorage`，刷新后回到原处。

## 排版

源笔记用的是自定义 LaTeX 子集（149 个宏命令）。构建期由 `tools/latex.mjs` 解析成
带语义的 HTML，没有转成图片，也没有引入 KaTeX：

- 分式（`\frac \dfrac \tfrac`）、根式（`\sqrt[n]`）、上下标、组合数
- 环境：`cases` `rcases` `aligned` `pmatrix` `bmatrix` `vmatrix` `Vmatrix` `array`
- 行间公式里的 `∑ ∏ ∫ lim max min` 自动把上下标叠成上下限
- 重音与标注：`\bar \vec \hat \tilde \overline \boxed \xcancel \xlongequal \xrightarrow` 等
- 自定义宏：`\red \set \degree \because \therefore \implies \iff \complement \subsetneqq \lang \rang …`

原笔记的 25 张插图托管在外部图床（`cdn.luogu.com.cn`），离线单文件无法引用，
正文保留「原笔记插图」占位卡，并在同一页的三维展台上给出可转动的对应演示
（立体几何一章的 13 张图尤其如此）。

源文件里被 `<!-- -->` 注释掉的段落没有丢：它们以「原笔记中被注释掉的内容」的浅色卡片
原样保留在书里。

## 工程

```
content/            源笔记 20 章 Markdown + LICENSE（原仓库内容，未改动）
tools/latex.mjs     LaTeX 子集 → 语义 HTML
tools/md.mjs        Markdown → 块结构（标题 / 段落 / 列表 / 表格 / 公式 / 代码 / 插图）
tools/md2book.mjs   块 → 页：按实测高度分页、并短页、统计、输出 build/book-data.json
tools/measure-pieces.mjs  用无头 Chromium 量每个块的真实高度 → build/block-heights.json
tools/fill-report.mjs     逐页体检（填充率 / 溢出 / 空白页）
tools/shot-pages.mjs      指定页截图，用于排版目检
build/build-book.mjs      拼装单文件 mathbook.html（内联 CSS/JSON/JS，并自检零外链）
src/engine.js       自研 Canvas 2D 三维引擎（透视投影、画家算法、手绘抖动、球面大圆、拾取）
src/geo.js          几何体与标注库
src2/scenes.js      22 个展台 / 67 个模式（方程、集合、区域、函数、三角、向量、立体、圆锥、数列、导数、统计…）
src2/book.js        书籍控制器（分页渲染、翻页动画、侧栏、检索、大表浮层、状态记忆）
src2/style.css      纸感书页 + 数学排版视觉系统
test/scenes.mjs     69 个场景模式的无头 canvas 渲染回归
test/book.mjs       真浏览器全书回归（结构 / 逐页正文 / 全部 3D 模式 / 交互 / 零外链）
```

```bash
npm run build:book   # md → 数据 → 单文件 mathbook.html
npm run measure      # 重量块高 + 重新分页 + 打包（改了排版样式后跑这个）
npm run test         # 场景渲染 + 全书回归
```

`test/book.mjs` 需要 Chromium：本仓库用 `puppeteer-core` + `@sparticuz/chromium`，
在缺少系统库的沙箱里可以配合自建的 NSS 桩库运行（`LD_LIBRARY_PATH=/tmp/nssstub`）。

## 来源与许可

- 内容：**liuhaopeng543/MathBook**（MIT），`content/` 下保留原文件与 `LICENSE`
- 三维引擎、排版器、书页视觉：本仓库原创
