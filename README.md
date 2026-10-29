# DDG Lab · 离散几何实验室

一个中文 HTML 交互教学应用：从离散几何、能量到动力学求解，结合 Three.js 可视化、TypeScript/JavaScript 数值逻辑以及 Rust/WASM 小型数值内核。内容参照用户提供的 Huang 等人教程及其 [MATLAB 算例仓库](https://github.com/weicheng-huang-mechanics/DDG_Tutorial)、[DDG 教程网站](http://www.ddgflexsim.com/)。

> **范围说明：本项目不是 21 个原始 MATLAB 模型的完整移植，也不是工程设计软件。** 单/多自由度振子、三个平面梁、两例轴对称线弹性壳、重力柔性网、超弹性索与膜、磁驱梁及流体阻力例共 12 项已有数值求解和限定范围的参考对照；独立参考时窗中，梁跃迁和流体阻力例未满足严格阈值。柔性网完整参考使用经前五步比对的稀疏向量化装配。球冠独立参考仅至 0.55 s，未覆盖约 4 s 的翻转；额外条件窗口在翻转附近也未通过。另有 9 项是位置/距离约束的交互教学近似。全部算例的原文定量复现、全部公式的数值验证尚未完成。

## 运行

需要 Node.js 20 或更新版本及支持 WebGL 的浏览器：

```bash
npm install
npm run dev
```

打开 Vite 输出的地址。也可 `npm run build && npm run preview` 预览生产构建；请使用 HTTP 服务打开，**不要直接双击 `index.html`**，因为 ES 模块与 WASM 需要正确的 URL 和 MIME 类型。无需后端或网络请求即可执行仿真（原论文和参考代码链接除外）。

### 使用方式

- **算例工作台**：选择算例，调整参数并点击「应用并重新运行」。可播放/暂停、单步、回看已记录时间、切换节点和初始构型、旋转缩放、下载 PNG 与 CSV。螺旋杆和两例薄板会自动适配当前与可见初始构型；手动操作后停止自动取景，点击重置视角恢复。
- **算例库**：21 个条目按原教程分类；每个条目有边界、载荷、观察量、核心公式、局限与原始代码/官方动画链接。
- **多物体五指接触**（`/?page=objects3d`）：可切换六个预设（三种尺寸球体、胶囊棒、圆角盒和双球哑铃），调整尺寸并重新求解真实几何接触，比较五指反力和路径指标，导出 CSV/PNG/GIF。物体固定支撑、无摩擦；这不是自由抓取或力闭合验证，**总体严格验收未通过**。模型与逐项结果见[多物体推导与审查](docs/MULTI_OBJECT_GRASP_3D.md)。
- **三维五指仿生手**（`/?page=hand3d`）：五个独立腱驱中空实体指体，与外部固定支撑的球体进行无摩擦接触并将反力反馈给指体；可调五根腱、回看并导出 CSV/PNG/GIF。**研究原型，总体严格验收未通过；球体不自由运动，不能视为已验证抓取。** 见[模型、假设与验证边界](docs/BIONIC_HAND_3D.md)及[五指接触动画](docs/media/bionic-hand-3d.gif)。
- **三维实体孔抓手**（`/?page=gripper3d`）：三维全积分六面体指体、真实挖空的矩形孔和有限半径可滑动腱；完整腱段—三角形多特征接触、离散路径 CCD、安全回滚及 CSV/PNG/GIF。默认 14.75 mm 牵引下，标准网格末段背梁实际转角约 **92.29°**，并非视觉放大；计算较慢。**严格验收尚未通过，不可用于工程设计**；见[推导与限制](docs/TENDON_GRIPPER_3D.md)和[大卷曲 GIF](docs/media/tendon-gripper-3d-continuous.gif)。
- **二维等效抓手**（`/?page=gripper`）：平面应变超弹性指体、只受拉腱和四处变形导向截面的双向罚接触。它没有在网格中挖出真实孔洞，与三维实体孔模型是不同的降阶实验；详见[二维模型与验证](docs/TENDON_GRIPPER.md)。
- **公式推导**：8 个主题覆盖通用框架、平面梁、空间杆、轴对称壳、离散壳、杆网络、超弹性和多物理场。平面曲率及空间杆材料标架各有可调、可播放的几何示意。
- **验证中心**：在浏览器本地运行 15 项数值检查、21 个可运行性检查和 12 项独立参考时窗对照；球冠的额外条件窗口单独标示，不计作独立全程。对照在 Web Worker 中执行（不可用时回退至主线程）。

## 数值实现及其边界

| 范围 | 实现 | 对照情况 |
|---|---|---|
| 单自由度振子 | 隐式 Euler；周期驱动；Rust/WASM 或等价 JS 标量内核 | 对齐原脚本驱动时刻后，与原脚本 101 个采样点比较 |
| 多自由度振子 | 装配 3 个自由质量点的 M、C、K 并直接求解隐式线性系统 | 对齐原脚本驱动时刻后，比较 3 个质量点、101 个采样点 |
| 重力悬臂梁 | 平面伸长、积分转角弯曲能，解析梯度和解析 Hessian，隐式 Euler + Newton | 原脚本前 0.5 s 的 50 个末端位移样本；不是全时程/全节点验证 |
| 受压梁屈曲 | 双端各固定两个节点；上向微扰、右端位移驱动；准静态 Newton | 全 10 s 的中点及 31 帧全部 40 节点对照；原脚本 3 次达到最大迭代次数 |
| 预屈曲梁跃迁 | 双端压缩、解除微扰、转动左端；隐式 Euler + Newton，20 s | 全 20 s 及跃迁已对照；精确 Hessian 轨迹**未达到**严格 2 μm 阈值，原脚本兼容回放另列 |
| 轴对称平板充气 | 40 母线节点、子午/环向伸长和双曲率弯曲，显式随形压力，准静态 Newton | 默认全 2 s 每步中心节点及 21 帧全部节点；源脚本 1 次触及迭代上限 |
| 轴对称球冠翻转 | 40 母线节点与位移约束；静态残差收敛后选择平衡分支，记录约束反力 | 独立参考仅前 0.55 s 通过；3.90–4.10 s 外部种子条件窗口**不一致**，非独立全程验证 |
| 重力柔性网 | 原始 631 节点、720 条三维线弹性伸长边及 6 个固定点；隐式 Euler + Newton | 默认 2 s 逐步中心与 11 帧全节点通过；Octave 完整时程使用经过前五步比对的稀疏向量化装配 |
| 超弹性平面索 | 不可压缩 Mooney–Rivlin 能量及解析梯度/Hessian；1 ms 隐式 Euler | 全 1 s 的 1000 个中点样本与 17 帧全部节点；原脚本 0 次达到最大迭代次数 |
| 超弹性轴对称膜 | 不可压缩 Mooney–Rivlin 母线单元、显式随形压力、隐式动力学；旋转网格仅用于展示 | 全 2 s 的逐步测量节点与 21 帧全部 60 母线节点对照 |
| 磁驱柔性梁 | 原始剩磁/旋转磁场数值，精确磁力梯度与 Jacobian；隐式动力学 | 全 20 s 端点每步与 41 帧全部节点对照；严格阈值通过 |
| 流体阻力游动 | 磁驱、切向/法向二次阻力及完整实际载荷 Jacobian；保留源代码两端速度复制 | 全 5 s 已对照；工作台严格阈值**未通过**，原迭代兼容回放通过 |
| 其余 9 个算例 | 位置积分、边/跨边距离约束投影及简化载荷，参数与输出为相对量 | 仅验证初始化、时间推进、有限性、载荷灵敏度和截图；**未与原模型定量对照** |

原始振子脚本以 `linspace(0,10,1000)` 计算驱动力时刻，但积分步长为 `0.01`；工作台则使用实际积分时间 `t=nΔt`。参考对照单独将驱动力时刻对齐，不能把它误认为两个时间序列完全相同。原悬臂梁输入坐标四舍五入到四位小数，而网页使用均匀节点；因此比较使用明确的误差阈值。

空间杆的材料标架/扭转、三维壳体铰链能和爬行网络的接触摩擦等**尚未在教学近似算例中实现**；游动例使用阻力近似而不是求解完整流体场。理论页另有两边空间杆的局部标架实验：包含平行运输、积分曲率、弯曲/扭转能和两个材料转角的能量梯度，并与原脚本三个局部样本及中心差分核对；它**没有**完整节点力、Hessian、历史参考扭转或整杆时间积分，未改变空间杆算例的近似性质。理论公式不表示近似动画已求解相同方程，不能用于推断原文的临界载荷、波长、接触力、推进速度或工程安全性。

平面梁默认的 40 节点（屈曲和跃迁）直接按原文输入四位小数取坐标；更改节点数、材料和加载倍率后不再处于参考对照条件。加载倍率改变速度、微扰和端部转速，压缩上限保持参考值。屈曲案例采用自适应子步与正分支跟踪，是含微扰的准静态路径而非独立临界分叉求解；跃迁案例的翻转时刻对步长、容差和扰动敏感。

**轴对称壳：**默认模型有 39 个伸长边和 38 个弯曲单元；伸长导数解析计算，弯曲曲率的梯度和 Hessian 用二阶前向自动微分计算。压力方向与面积按上一构型取值；球冠反力是前两个受控轴向自由度的内力和。画面用导轨区分充气盘中心半径约束与球冠边缘仅轴向固定、可径向滑动；导轨仅为可视化，不参与数值求解。响应面板显示当前最大母线工程应变幅值（不是完整应变或强度判据）；默认充气盘末态约 41.5%，线弹性材料在大应变下的适用性仍需独立评估。极端参数审查发现一组充气盘在 0.56 s 不收敛；失败步现不会写入曲线或 CSV。两个案例都是准静态路径，显示的时间是加载参数而不是惯性动力学。球冠原分支失效后，工作台以一个下分支启发式初值寻找残差小于 `1e-5 N` 的平衡；这并不证明稳定性，也不是瞬态翻转求解。只对照默认参数，改变节点数/参数不在参考范围内。

**原脚本 Jacobian 差异：**上游 `bendingForce.m` 对列向量使用内积后发生标量广播，其 Newton 矩阵与力的精确 Hessian 不完全一致。工作台采用经有限差分检验的精确 Hessian；验证中心另以原矩阵和原停止顺序回放原脚本，用于定位差异，而不把回放误称为更严格的收敛结果。跃迁全时程工作台轨迹的最大误差超过原先设定的 `2e-6 m` 严格阈值；兼容回放与采样参考最大误差约 `5e-13 m`。

平面索的原脚本变量 `g` **直接作为每个节点的力**，并没有乘以节点质量；应用保留该行为。更改节点数时应用保持自由节点总力，故与原始离散不再相同。该模型没有弯曲能或仅受拉截断，边在压缩时仍有材料响应。

**重力柔性网：**原算例仅含三维线弹性伸长，压缩边也有响应，没有弯曲、扭转或松弛索截断；每条边质量均分到两端。使用矩阵自由 PCG；切线不定或 PCG 失败时尝试 MINRES，显式检查线性残差，失败步回滚。默认终态最大边工程应变幅值约 17.4%；边界工况可超过 100%，该指标不是强度判据，线性材料的适用性需另行评估。

膜例按原代码把每条边的完整质量分别加到两个端点，压力方向和面积取上一构型；这种质量装配并非常见的边质量各分一半。两项均为原脚本对照而保留。游动例原 `getFd.m` 的两个端点均使用第一端速度，且给出的阻力 Jacobian 忽略部分依赖；工作台忠实保留该力但对其完整求导。原脚本磁力 Jacobian 为零，游动例磁力按上一构型评价。与使用原停止顺序/近似 Jacobian 的兼容回放不同，工作台求更严格的残差，其游动轨迹与原脚本差异为毫米量级，**不把回放通过当成工作台通过**。

## 验证和截图

```bash
npm test                     # 数值内核、二维/三维抓手、五指模型及其他回归
npx vite-node scripts/audit-multi-object.ts --id rounded-box --target 6.75  # 固定物体路径；不足五指接触或其他检查不通过时非零
npx vite-node scripts/sample-rounded-object-cases.ts && python3 scripts/audit-rounded-object-independent.py  # 几何独立 QP 检查；需 NumPy
npx vite-node scripts/audit-bionic-hand.ts  # 8 mm 五指固定球体路径；未通过则非零
npx vite-node scripts/snapshot-bionic-hand.ts 27  # 保存 6.75 mm 的五个指定末态
python3 scripts/audit-bionic-hand-independent.py  # 需 numpy/scipy
npm run build                # 生产构建成功；仍有大于 500 kB 的 chunk 警告
npx vite-node scripts/audit-all-durations.ts  # 21 例默认完整时程及逐步回看重演
npx vite-node scripts/audit-spatial-rod-geometry.ts  # 3 个局部空间标架和转角梯度
npx vite-node scripts/audit-gripper.ts --snapshot /tmp/gripper-snapshot.json  # 二维接触、网格和卸载审查
python3 scripts/audit-gripper-independent.py /tmp/gripper-snapshot.json  # 可选，需 numpy/scipy
npx vite-node scripts/audit-gripper3d-continuous.ts --case curl  # 三维大卷曲及离散接触审查
npx vite-node scripts/snapshot-gripper3d-continuous.ts curl
python3 scripts/audit-gripper3d-continuous-independent.py  # 可选，需 numpy、scipy
npm audit                    # 本轮修复后 0 个已报告漏洞（仅表示当前数据库的扫描结果）
npm run reference:compare    # 12 项独立时窗 + 1 项球冠条件诊断；有未通过项，故返回非零
cargo test --manifest-path core-rs/Cargo.toml  # 需安装 Rust；本轮原生单测 3/3
```

本轮在 Linux x86-64 的 Rust 1.88.0-dev 和 1.92.0-nightly 下分别重跑原生单测，均为 3/3，文档测试 0 项；**未从当前源码重编译 WASM**。对已有 `public/ddg_core.wasm` 的四个导出，单测分别用 1000 组确定性输入与 JS 对照并覆盖退化输入，也检查无效导出与加载失败后的 JS 回退。Rust 内核并非完整仿真求解器。

三维实体孔模型当前使用全积分六面体、完整线段—三角形多特征增广接触和离散路径 CCD。默认 14.75 mm 工况在标准网格得到背梁末段平面转角 **92.29°**、指端横移 46.20 mm；单一末态的独立 NumPy/SciPy 重组通过。现在还对线性数值路径的 Q1 整个参考域检查浮点 Bernstein $J$ 下界，拒绝角点反转、严重相消及不可判定情形；这不是形式化证明或全局无碰撞证明。制造弯曲解暴露了全积分 Q1 的剪切锁定；抗锁定候选仍仅供研究、没有用于 GUI。严格验收仍未通过：网格收敛、极细腱压力测试及连续体内部/曲面 CCD 等不能仅凭该结果认定通过。详见[三维推导及限制](docs/TENDON_GRIPPER_3D.md)与[逐项审查](docs/screenshots/gripper3d-continuous-audit.json)。

原二维抓手采用实心指体与可变间隙的嵌入式导向截面，不含三维孔面；标准→加密网格时指端位移变化约 8%、张力变化约 31%，同样尚未网格收敛。[二维详细推导与数值记录](docs/TENDON_GRIPPER.md)。

新增的空间杆局部测试覆盖斜杆、竖直参考轴退化回退和直杆三种构型：对比原 Octave 标架及积分曲率最大差 `3.33e-16`、材料转角能量梯度最大差 `1.11e-16`；梯度与中心差分最大差 `8.08e-11`。详见 [局部记录](docs/screenshots/spatial-rod-geometry-audit.json) 和[交互截图](docs/screenshots/52-spatial-rod-lab.jpg)。

完整时程审查在默认参数及 UI 步长下，累计检查 21 例、18,800 个前进步和 105 个回看重演步：每步检查时间、收敛标志、显示及快照数值有限性、连接关系和固定点索引，五个回放快照逐个比较均一致。未提供残差的教学近似及线性系统，其收敛标志**不等于独立残差验证**。结果见 [full-duration-audit.json](docs/screenshots/full-duration-audit.json)；此项也不等于原文对照、物理有效性或网格/步长收敛研究。

在 Chromium 中逐例播放至声明终点，检查终点按钮、非空 WebGL、位移读数、溢出和页面错误，重新截取并目视复核 21 个终态：[终态总览 01–07](docs/screenshots/end-cases/review-01.jpg) · [08–14](docs/screenshots/end-cases/review-02.jpg) · [15–21](docs/screenshots/end-cases/review-03.jpg) · [浏览器记录](docs/screenshots/end-cases/audit.json)。截图可审查显示，不能证明计算正确。

生产构建另用 Chromium 检查 WASM MIME 和加载，并分别在 Worker 与禁用 Worker 的主线程回退下运行验证，得到 15/15 内核检查、21/21 可运行性检查、10/21 算例满足独立参考时窗阈值；完整记录见 [production-audit.json](docs/screenshots/production-audit.json)。参考比较中未通过的两例和球冠额外条件窗口并未隐藏。

本次对照使用参考仓库提交 `20d732f3fffdd5137eee720e46175de3a98016c6`，在 GNU Octave 7.2.0 中运行源方程，移除绘图与逐次日志，悬臂梁限制为 50 步，屈曲使用原来的 1000 步、跃迁使用原来的 2000 步、超弹性索使用原来的 1000 步；膜、磁驱、游动分别使用原来的 200、2000、500 步；充气盘使用原来的 200 步，球冠独立参考只完成前 110/1200 步。柔性网完整 200 步使用稀疏向量化装配，其前五步与保留原单元循环、仅改稀疏存储的版本逐节点核对。均以 12 位有效数字输出：

| 对照 | 最大绝对位置误差 | 范围与条件 |
|---|---:|---|
| 单自由度 | 约 `5.04e-12 m` | 对齐驱动时刻，101 个采样点 |
| 多自由度 | 约 `5.12e-10 m` | 对齐驱动时刻，3 个质量点、101 个采样点 |
| 悬臂梁 | 约 `4.03e-5 m` | 前 0.5 s、50 个末端样本；节点坐标存在上述差异 |
| 受压梁屈曲 | 中点约 `4.18e-7 m`；构型约 `9.65e-6 m` | 全 10 s，1000 个中点样本及 31 帧全部节点；原脚本有 3 次最大迭代退出 |
| 预屈曲梁跃迁 | 中点约 `6.55e-5 m`；采样构型约 `4.56e-5 m` | 全 20 s，2000 个中点样本及 44 帧全部节点；**严格 2e-6 m 阈值未通过** |
| 轴对称平板充气 | 中心 `9.37e-11 m`；构型 `1.36e-10 m` | 全 2 s，200 个中心样本及 21 帧全部 40 节点；阈值 `1e-6 m`，通过；源 1 次触及上限 |
| 轴对称球冠翻转（独立前段） | 测点与构型均约 `5.00e-13 m`；反力 `5.12e-8 N` | 前 0.55 s、110 个测点及 5 帧全节点；**尚未覆盖翻转** |
| 重力柔性网 | 中心 `4.51e-10 m`；构型 `2.58e-9 m` | 全 2 s、200 个中心三坐标样本及 11 帧全部 631 节点；阈值 `1e-6 m`，通过；Octave 向量化装配，0 次触及上限 |
| 超弹性平面索 | 中点约 `1.45e-10 m`；构型约 `6.77e-11 m` | 全 1 s，1000 个中点样本及 17 帧全部节点；原脚本 0 次最大迭代退出 |
| 超弹性轴对称膜 | 测量节点 `5.49e-12 m`；构型 `5.34e-12 m` | 全 2 s、逐步测量节点与 21 帧全部 60 节点；阈值 `1e-7 m`，通过 |
| 磁驱柔性梁 | 端点 `9.84e-6 m`；构型 `4.68e-6 m` | 全 20 s、逐步端点与 41 帧全部 40 节点；阈值 `1e-5 m`，通过 |
| 流体阻力游动 | 末端 `4.43e-3 m`；构型 `4.49e-3 m` | 全 5 s、逐步末端与 11 帧全部 40 节点；阈值 `1e-4 m`，**未通过**；原迭代回放最大差 `5.00e-13 m` |

独立球冠参考前 0.55 s 的通过不代表翻转通过。为诊断临界区，另从 **TypeScript 源迭代得到的 3.90 s 状态**启动原 Octave 脚本，运行至 4.10 s；这是**条件窗口，不是独立全程**。逐步全部节点的最大差为 `0.246 m`，反力最大差 `1.14e5 N`；原脚本 7 次触及迭代上限，其中 6 次更新前残差超过 `1e-4 N`。源次序回放在这一窗口的最大差在 Node 22.22.3 中为 `0.119 m`，在 Chromium 153 中为 `0.154 m`；两者的未收敛步数也不同。局部非收敛和跨运行时差异使它不能验证翻转动力学或临界载荷。工作台的 6 s 路径仅表示静态残差已满足容差，不代表已和原脚本全程一致。

参考数据、生成条件和版本保存在 `src/data/references/`；`axis-shell-1-reference.json` 和 `axis-shell-2-reference.json` 是独立时窗，`axis-shell-cap-conditional.json` 包含明确标注的外部种子及条件窗口，`axis-shell-element-reference.json` 保存原 Octave 单元矩阵。比较实现在 `src/engine/reference.ts` 和 `axis-shell-window.ts`。屈曲原脚本记录 3 次达到最大迭代次数，其中 2 次在最后更新前的残差仍超过其容差；跃迁原脚本记录 1 次达到最大迭代次数，最后更新前残差为 `3.23e-5`，低于原 `1e-4` 容差（原程序先做更新再检查迭代上限）。因此不能简单声称原脚本每一步都充分收敛。有本地 Octave 与参考仓库时，可使用 `python3 scripts/generate_reference.py /path/to/DDG_Tutorial` 重新生成首版振子及重力梁样本；请先确认参考仓库处于上述提交。本次生成使用的是 Octave WebAssembly 运行器，提供的原生 Octave 重生成脚本尚未在原生 Octave 环境中实测。更多验证边界和每个算例的状态见 [验证与截图审查记录](docs/VALIDATION.md)。

已生成 21 个算例独立截图、算例库/推导/验证页和移动端截图，位于 [`docs/screenshots/`](docs/screenshots/)。其中 `review-01.jpg` 至 `review-03.jpg` 是 21 个视图的审查总览，`audit.json` 是浏览器运行记录。另外有[屈曲加载截图](docs/screenshots/27-buckling-loaded.jpg)及[跃迁前](docs/screenshots/28-snap-before.jpg)、[跃迁后](docs/screenshots/29-snap-after.jpg)的截图和交互记录，以及[超弹性索](docs/screenshots/30-hyper-cable-loaded.jpg)、[轴对称膜](docs/screenshots/31-membrane-inflation.jpg)、[磁驱梁](docs/screenshots/32-magnetic-field.jpg)与[游动例](docs/screenshots/33-swimmer-propulsion.jpg)的加载截图；本轮新增[平板充气](docs/screenshots/37-axis-inflation-loaded.jpg)、[球冠翻转前](docs/screenshots/38-axis-cap-before.jpg)、[翻转后及反力曲线](docs/screenshots/39-axis-cap-after.jpg)、[壳公式推导](docs/screenshots/40-axis-theory.jpg)、[移动端球冠](docs/screenshots/41-mobile-axis-cap.jpg)、[临界诊断截图](docs/screenshots/42-cap-diagnostic.jpg)与[极端工况应变](docs/screenshots/45-shell-extreme-strain.jpg)。本轮新增[柔性网终态](docs/screenshots/47-net-loaded.jpg)、[移动端](docs/screenshots/48-mobile-net.jpg)、[网络公式](docs/screenshots/49-net-theory.jpg)和[参考对照](docs/screenshots/46-net-validation.jpg)。截图和可运行性检查不等于物理正确性或原文定量验证。

### 重跑浏览器审查

先启动 `npm run dev`，准备 `playwright-core` 和可运行的 Chromium，再执行：

```bash
# 可将可选测试依赖放到独立目录，避免加入产品依赖
mkdir -p /tmp/ddg-audit && cd /tmp/ddg-audit
npm init -y && npm install playwright-core
cd /path/to/this/repo
AUDIT_MODULE_ROOT=/tmp/ddg-audit CHROME_BIN=/path/to/chromium node scripts/audit-browser.mjs
AUDIT_MODULE_ROOT=/tmp/ddg-audit CHROME_BIN=/path/to/chromium node scripts/audit-reference-fallback.mjs
AUDIT_MODULE_ROOT=/tmp/ddg-audit CHROME_BIN=/path/to/chromium node scripts/audit-planar.mjs
AUDIT_MODULE_ROOT=/tmp/ddg-audit CHROME_BIN=/path/to/chromium node scripts/audit-hyper.mjs
AUDIT_MODULE_ROOT=/tmp/ddg-audit CHROME_BIN=/path/to/chromium node scripts/audit-multiphysics.mjs
AUDIT_MODULE_ROOT=/tmp/ddg-audit CHROME_BIN=/path/to/chromium node scripts/audit-axis-shell.mjs
AUDIT_MODULE_ROOT=/tmp/ddg-audit CHROME_BIN=/path/to/chromium node scripts/audit-shell-runtime.mjs
AUDIT_MODULE_ROOT=/tmp/ddg-audit CHROME_BIN=/path/to/chromium node scripts/audit-shell-failure.mjs
AUDIT_MODULE_ROOT=/tmp/ddg-audit CHROME_BIN=/path/to/chromium node scripts/audit-net.mjs
npx vite-node scripts/audit-shell-parameters.ts
npx vite-node scripts/audit-net-parameters.ts
# 以下两项完整播放至终点，耗时较长；自动取景审查会重写对应三个终态截图
AUDIT_MODULE_ROOT=/tmp/ddg-audit CHROME_BIN=/path/to/chromium node scripts/audit-full-duration-browser.mjs
AUDIT_MODULE_ROOT=/tmp/ddg-audit CHROME_BIN=/path/to/chromium node scripts/audit-camera-fit.mjs
# 可选：安装 Pillow 后，从截图裁剪图重新生成三张总览
python3 scripts/create-contact-sheets.py
python3 scripts/create-contact-sheets.py --crops /tmp/ddg-end-crops --output docs/screenshots/end-cases
```

脚本截图并检查导航、参数应用、暂停/单步、曲率演示、公式渲染、导出、移动端、WASM 失败时的 JS 后备，以及验证结果。也可以使用独立安装的 `@sparticuz/chromium` 替代 `CHROME_BIN`；某些精简 Linux 环境还需要设置 `CHROMIUM_LIB_DIR` 指向其共享库目录。建议顺序执行，避免并行数值计算导致浏览器等待超时。

生产构建验证需要另一个终端先启动 `npm run build && npm run preview -- --port 4173`，再运行：

```bash
AUDIT_MODULE_ROOT=/tmp/ddg-audit CHROME_BIN=/path/to/chromium node scripts/audit-production.mjs
```


### 重生成原脚本参考样本

除原仓库外，还需要单独安装可选依赖 `playwright-core`、`@liudonghua123/octave-wasm` 和 Chromium。下面命令在隔离目录运行原脚本，不将参考源码或 Octave 运行时打包进应用；完整计算可能耗时较长：

```bash
# 在与浏览器审查相同的可选依赖目录中安装 Octave WASM
cd /tmp/ddg-audit && npm install @liudonghua123/octave-wasm
cd /path/to/this/repo
# 检查固定且干净的上游提交；振子/重力梁重跑已存窗口，其余仅重跑早期短窗口
AUDIT_MODULE_ROOT=/tmp/ddg-audit CHROME_BIN=/path/to/chromium \
  node scripts/audit-reference-reproduction.mjs /path/to/DDG_Tutorial
# 也可单独重跑振子 999 步及重力梁 50 步
AUDIT_MODULE_ROOT=/tmp/ddg-audit CHROME_BIN=/path/to/chromium \
  node scripts/generate-small-reference-wasm.mjs /path/to/DDG_Tutorial /tmp/small-reference.json
# 单独重跑三组空间杆局部标架和材料转角梯度样本
AUDIT_MODULE_ROOT=/tmp/ddg-audit CHROME_BIN=/path/to/chromium \
  node scripts/generate-spatial-geometry-reference.mjs /path/to/DDG_Tutorial /tmp/spatial-geometry.json
AUDIT_MODULE_ROOT=/tmp/ddg-audit CHROME_BIN=/path/to/chromium \
  node scripts/generate-planar-reference.mjs /path/to/DDG_Tutorial \
  --buckling-steps 1000 --snap-steps 2000 --output /tmp/planar-reference.json
AUDIT_MODULE_ROOT=/tmp/ddg-audit CHROME_BIN=/path/to/chromium \
  node scripts/generate-hyper-reference.mjs /path/to/DDG_Tutorial \
  --steps 1000 --output /tmp/hyper-reference.json
AUDIT_MODULE_ROOT=/tmp/ddg-audit CHROME_BIN=/path/to/chromium \
  node scripts/generate-membrane-reference.mjs /path/to/DDG_Tutorial \
  --steps 200 --output /tmp/membrane-reference.json
AUDIT_MODULE_ROOT=/tmp/ddg-audit CHROME_BIN=/path/to/chromium \
  node scripts/generate-soft-reference.mjs /path/to/DDG_Tutorial \
  --case 1 --steps 2000 --output /tmp/soft-1-reference.json
AUDIT_MODULE_ROOT=/tmp/ddg-audit CHROME_BIN=/path/to/chromium \
  node scripts/generate-soft-reference.mjs /path/to/DDG_Tutorial \
  --case 2 --steps 500 --output /tmp/soft-2-reference.json
# 柔性网：先比较保留源单元循环与向量化装配的前五步全节点
AUDIT_MODULE_ROOT=/tmp/ddg-audit CHROME_BIN=/path/to/chromium \
  node scripts/generate-net-reference.mjs /path/to/DDG_Tutorial \
  --steps 5 --frame-every 1 --output /tmp/net-original-5.json
AUDIT_MODULE_ROOT=/tmp/ddg-audit CHROME_BIN=/path/to/chromium \
  node scripts/generate-net-reference.mjs /path/to/DDG_Tutorial \
  --steps 5 --frame-every 1 --fast-assembly --output /tmp/net-vectorized-5.json
# 完整 200 步使用验证过前五步的向量化装配
AUDIT_MODULE_ROOT=/tmp/ddg-audit CHROME_BIN=/path/to/chromium \
  node scripts/generate-net-reference.mjs /path/to/DDG_Tutorial \
  --steps 200 --frame-every 20 --fast-assembly --output /tmp/net-reference.json
# 两例轴对称线弹性壳；球冠完整 1200 步非常耗时
AUDIT_MODULE_ROOT=/tmp/ddg-audit CHROME_BIN=/path/to/chromium \
  node scripts/generate-axis-shell-reference.mjs /path/to/DDG_Tutorial \
  --case 1 --steps 200 --output /tmp/axis-shell-1.json
AUDIT_MODULE_ROOT=/tmp/ddg-audit CHROME_BIN=/path/to/chromium \
  node scripts/generate-axis-shell-reference.mjs /path/to/DDG_Tutorial \
  --case 2 --steps 110 --output /tmp/axis-shell-2.json
AUDIT_MODULE_ROOT=/tmp/ddg-audit CHROME_BIN=/path/to/chromium \
  node scripts/generate-axis-shell-element-reference.mjs /path/to/DDG_Tutorial /tmp/axis-shell-element.json
# 条件窗口：初值来自工作台，不是独立全程；输出必须单独保存
npx vite-node scripts/make-axis-shell-checkpoint.ts 780 /tmp/axis-cap-seed.json
AUDIT_MODULE_ROOT=/tmp/ddg-audit CHROME_BIN=/path/to/chromium \
  node scripts/generate-axis-shell-reference.mjs /path/to/DDG_Tutorial \
  --case 2 --steps 40 --batch 5 --checkpoint /tmp/axis-cap-seed.json --output /tmp/axis-cap-window.json
npx vite-node scripts/compare-axis-shell-window.ts /tmp/axis-cap-window.json
```

本轮参考重放结果见 [reference-reproduction-audit.json](docs/screenshots/reference-reproduction-audit.json)：对已有参考的 12 个算例重跑原脚本的全部振子步、重力梁 50 步及其余模型的早期短窗口，保存样本在本环境中与仓库数据一致；柔性网原循环/向量化各重跑前 5 步，全部节点最大差约 `3.64e-16 m`。充气盘前 5 步中源代码有 1 次触及迭代上限。**这检查基准数据可重放，不是应用与原文后续时程的一致性证明**。

重生成器会额外记录原脚本的最大迭代次数退出信息。不同求解器容差和极不稳定的跃迁段可能导致数值差异；应先检查实际误差，而不是把截图视为对照通过。

## 项目结构

```text
src/data/cases.ts              21 个算例的描述、参考路径、限制
src/data/theory.ts             8 个理论主题与逐步公式
src/engine/planar.ts           平面梁/超弹性索能量、解析梯度/Hessian、Newton/隐式 Euler
src/engine/planar-cases.ts     屈曲与跃迁的分阶段边界和载荷
src/engine/linear.ts           单/多自由度线性系统
src/engine/axisymmetric-membrane.ts  轴对称膜能量、梯度/Hessian、压力与隐式求解
src/engine/axisymmetric-shell.ts     轴对称线弹性壳单元、准静态求解与分支启发式
src/engine/axis-shell-window.ts       球冠临界条件窗口对照及残差诊断
src/engine/soft-robot.ts        磁力、各向异性二次阻力及原迭代回放
src/engine/gripper.ts           自定义二维超弹性指体、腱和变形导向截面接触
src/engine/gripper3d.ts         三维挖空网格及旧采样求解器（历史对照）
src/engine/continuous-gripper3d.ts  三维全积分实体、完整腱段—孔壁接触及安全回滚
src/components/Gripper3DLab.tsx 三维参数、诊断、回放与 GIF/CSV 导出
src/engine/spatial-rod-geometry.ts   双边标架/积分曲率和材料转角梯度（非整杆求解器）
src/engine/net-gravity.ts       原始柔性网伸长单元、隐式求解及应变监测
src/engine/minres.ts            对称不定矩阵的矩阵自由迭代回退
src/engine/simulation.ts       算例状态与其他 9 个约束近似
src/engine/reference.ts        原脚本参考数据比较
src/components/ThreeViewport.tsx  Three.js 渲染与相机交互
core-rs/                       无第三方依赖的 Rust 数值内核
public/ddg_core.wasm           已构建的浏览器 WASM 产物
scripts/                       参考数据生成、比较与截图审查
```

Rust 后端只包含伸长能/导数、平面转角曲率和单自由度隐式步进，**并非整个 DDG 求解器**。浏览器尝试加载 `public/ddg_core.wasm`，失败时自动使用同契约的 JS 后备；验证中心会将 Rust/JS 交叉检查标为未验证，而不会与自身比较后宣称通过。重新构建需要安装 Rust 的 `wasm32-unknown-unknown` 目标：

```bash
rustup target add wasm32-unknown-unknown
npm run wasm
```

## 参考资料

- W. Huang 等，*A tutorial on simulating nonlinear behaviors of flexible structures with the discrete differential geometry (DDG) method*, [arXiv:2504.11417](https://arxiv.org/abs/2504.11417)。页面及章节编号对应用户提供的论文版本。
- [DDG_Tutorial 原始 MATLAB 仓库](https://github.com/weicheng-huang-mechanics/DDG_Tutorial)，参考提交 `20d732f3fffdd5137eee720e46175de3a98016c6`。官方 GIF 通过链接访问，没有复制进本项目；对照数据来自运行其脚本。该提交未发现明确的许可文件，后续分发或商业复用相关内容前应自行核实授权。
- [DDG FlexSim 教程网站](http://www.ddgflexsim.com/)。
