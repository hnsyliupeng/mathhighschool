# 验证与截图审查记录

更新日期：2026-10-28。参考源：`weicheng-huang-mechanics/DDG_Tutorial@20d732f3fffdd5137eee720e46175de3a98016c6`。本记录区分 **可运行、数学内核验证、参考结果对照**；它们不是同一个概念。

## 数值检查

本轮 `npm test`：18 个测试文件、177/177 项通过（含研究单元局部测试；不含单独运行的研究性长路径）；`npx tsc --noEmit` 和 `npm run build` 成功，但 Vite 仍提示部分 chunk 超过 500 kB。依赖升级至 KaTeX 0.18.10、Vitest 4.1.12 后，`npm audit` 在 2026-10-29 报告 0 个已知漏洞；此结果不代表代码或未来依赖绝对安全。以下测试和浏览器检查的通过不等同于所有算例的原文对照通过。

- 拉伸和转角弯曲的解析梯度与中心差分比较；新的弯曲解析 Hessian 与梯度中心差分、对称性和平移零模比较；检查平面刚体平移/旋转下的能量不变性。
- 检查单自由度隐式残差、对解析振子的步长收敛、多自由度矩阵对称性与残差。
- 小挠度端部集中载荷下，悬臂梁与 Euler–Bernoulli 解析解比较：20 节点约 8.49% 误差，60 节点约 2.60%；两端固定的前两个节点使有效长度为 `L−Δs`。
- 原脚本弯曲 Jacobian 的兼容实现与 Octave 局部矩阵对照；该矩阵与经梯度差分验证的精确 Hessian 存在可测差异。
- 轴对称线弹性壳的伸长梯度/Hessian、弯曲二阶自动微分梯度/Hessian 与中心差分、对称性和刚体轴向平移零模比较；与独立 Octave 单元矩阵对照，伸长梯度/Hessian 最大差约 `2.49e-14`/`1.82e-12`，弯曲约 `7.96e-13`/`2.01e-10`。盘和球冠分别测试完整 200/1200 步、约束及回看；球冠出现一次静态平衡分支切换。
- 三维柔性网伸长单元的能量梯度、Hessian、对称性及作用–反作用与中心差分核对；检查原网格质量分配、固定点、完整时程、退化步回滚和回看重演。另用对称不定系统和奇异系统测试 MINRES 的真实残差及失败路径，并实测高模量工况的回退。
- Mooney–Rivlin 索与轴对称膜的解析能量梯度和 Hessian 与中心差分、对称性比较；磁势梯度、磁力 Jacobian 和含跨节点项的二次阻力 Jacobian 与差分比较；Neo-Hookean 一维特例导数另做差分检查。Rust 原生单测在 Linux x86-64 的 1.88.0-dev 和 1.92.0-nightly 下均为 3/3，文档测试 0 项；本轮未重编译 WASM。对已有 WASM 的 4 个导出分别用 1000 组确定性输入及退化输入与 JS 交叉比较，并覆盖非函数导出和失败重载后的 JS 回退（超弹性边当前由 TypeScript 实现）。
- 每个算例各自测试初始状态、15 步有限值与运动，以及各自时长内至多 3 秒的有界性和载荷灵敏度；屈曲和跃迁还测试完整加载路径、两端约束、快照回放和跃迁前后符号；另测 0.5、1.5、2 倍加载的准静态正分支与自适应子步。约束近似的这些测试不证明原文物理结果正确。
- 自动取景的正交投影包围测试 4/4，覆盖三个视口宽高比、初始/当前构型、重复更新与无效坐标。
- **二维腱驱抓手（不计入原教程 21 案例）**：12 项专项测试覆盖 Neo-Hookean 导数、可滑动只受拉腱、变形截面接触导数、整体力平衡、罚刚度、无接触对照、卸载和回滚。默认 4 mm 牵引、140 单元：4 个接触、最大穿透 `3.870 μm`、最小 J `0.96278`，外力平衡误差 `7.95e-13 N`。从 140 到 560 单元，端点位移差约 7.98%、张力差约 31.13%，未网格收敛；此二维模型本身不含三维孔面。[完整模型及验证边界](TENDON_GRIPPER.md) · [力学记录](screenshots/gripper-numerical-audit.json) · [独立 NumPy/SciPy 局部复核](screenshots/gripper-independent-audit.json) · [浏览器截图](screenshots/55-gripper-viewport.jpg)。
- **三维实体孔抓手（另一个自定义算例）**：当前 GUI 使用全积分六面体、真实挖空孔壁及完整腱段—三角形多特征接触；标准网格 14.75 mm 驱动时，背梁末段平面转角约 92.29°，指端横移 46.20 mm。该末态 NumPy/SciPy 独立重组及特征距离优化通过，但这不是独立全路径或实验验证。Q1 全域/线性路径增加 Bernstein 浮点下界和相消护栏：[222 条运动的 NumPy 采样、20 个精确奇异反例](screenshots/gripper3d-hex-jacobian-independent.json)通过，仍不是一般形式化证明。制造弯曲解显示薄背梁 Q1 剪切锁定；[不协调模态候选](screenshots/gripper3d-incompatible-patch-research.json)仅为局部研究，未进入生产。网格收敛、极细腱压力测试与连续体内部/曲面 CCD 仍有未通过或未覆盖项，**严格验收尚未通过**。[模型与公式](TENDON_GRIPPER_3D.md) · [逐案例数值报告](screenshots/gripper3d-continuous-audit.json) · [大卷曲独立重组](screenshots/gripper3d-continuous-independent-curl.json) · [GIF](media/tendon-gripper-3d-continuous.gif)。
- 新增空间杆双边局部几何：测试标架正交性、平行运输及其逆、刚体旋转协变性、零长/反向平行奇异、自然曲率零能和转角梯度差分。斜杆、竖直参考轴回退及直杆三个样本与原 Octave 初始化、`bendingForce` 和 `twistingForce` 的材料转角分量对照：标架和曲率最大差 `3.33e-16`、标量能量/扭转差 `5.56e-17`、转角梯度最大差 `1.11e-16`；与中心差分最大差 `8.08e-11`。[局部记录](screenshots/spatial-rod-geometry-audit.json) · [桌面交互图](screenshots/52-spatial-rod-lab.jpg) · [移动交互图](screenshots/53-mobile-spatial-rod-lab.jpg)。这些不覆盖节点力、完整 Hessian、历史参考扭转或任何空间杆算例的时程。

## 本轮完整运行与基准复查

| 层次 | 本轮结果 | 范围限制 |
|---|---|---|
| 默认完整时程 | 21/21 到达声明终点；共 18,800 个 UI 前进步、105 个回看重演步逐步检查，五个快照逐个重演误差均为 0 | 每步检查收敛标志、时间、快照与显示数值有限、固定点索引及边面连接关系；没有残差的代理和线性系统不构成独立残差验证；并非物理验证或步长/网格收敛研究。[记录](screenshots/full-duration-audit.json) |
| Chromium 完整终态 | 21/21 到达终点，非空 WebGL、终点控制、有限位移、无页面错误及水平溢出；21 张终态截图及三个总览逐一目视 | 非空像素不等于完整正确的模型或物理；截图仅覆盖捕获时刻。[记录](screenshots/end-cases/audit.json) |
| 生产构建 | Worker 与无 Worker 主线程回退均为 15/15 内核检查、21/21 可运行性检查、10/21 算例独立参考时窗通过；WASM 200 且 MIME 为 `application/wasm` | 数值范围同参考表；不能把兼容回放或条件窗口当作独立严格通过。[记录](screenshots/production-audit.json) |
| 基准源脚本重放 | 12 个已有参考算例、13 项对照（网各有原循环/向量化），已保存的共同样本误差均为 0；轴对称壳单元矩阵重放差 0 | 振子运行原 999 个积分步、重力梁前 50 步，其余仅重跑早期短窗口；网两种装配前 5 步全部节点差 `3.64e-16 m`；充气盘前 5 步有 1 次源迭代上限。**这是基准文件可重放检查，不是应用与原文后续时程的独立验证**。[记录](screenshots/reference-reproduction-audit.json) |
| 应用与原文对照 | 12 个独立参考窗口中 10 通过、2 未通过；球冠条件窗口另未通过 | 9 个教学近似未移植原模型，也无原文定量对照；见下表及限制。 |

## 与原脚本的局部对照

参考数据由 MATLAB 源方程在 GNU Octave 7.2.0 WebAssembly 中执行生成；禁用绘图/控制台逐次输出、提高写出精度。柔性网还使用稀疏存储/求解，完整时程使用代数向量化装配（先与保留源单元循环的前五步逐节点核对），不是未经修改的原脚本运行。悬臂梁限制为 50 步；屈曲梁与超弹性索均运行原来的 1000 步，跃迁梁运行原来的 2000 步；跃迁脚本额外记录 5 s 以前的数据。轴对称膜、磁驱梁与游动例分别运行原来的 200、2000、500 步；轴对称充气盘完成原来的 200 步，球冠独立全程任务只完成前 110/1200 步。数值与生成信息位于 `src/data/references/`；球冠另有下文明确标注的、以工作台状态为种子的条件窗口，不能当作独立全程。

| 算例 | 样本与条件 | 最大绝对误差 | 阈值 |
|---|---|---:|---:|
| 单自由度 | 原脚本 999 个积分步中的 101 个样本，驱动时刻对齐 | 约 5.04e-12 m | 1e-8 m |
| 多自由度 | 同上，三个自由质量点 | 约 5.12e-10 m | 1e-8 m |
| 重力悬臂梁 | 0.01–0.50 s，50 个末端位移样本；网页均匀节点与原文四位小数节点略有差别 | 约 4.03e-5 m | 1e-4 m |
| 受压梁屈曲 | 0.01–10.00 s，中点每步及 31 帧全部节点；40 节点与原输入对齐 | 中点 4.18e-7 m；节点 9.65e-6 m | 中点 1e-6 m；节点 2e-5 m |
| 预屈曲梁跃迁 | 0.01–20.00 s，中点每步及 44 帧全部节点（含翻转段） | 中点 6.55e-5 m；采样节点 4.56e-5 m | 均 2e-6 m，**未通过** |
| 轴对称平板充气 | 0.01–2.00 s，中心每步两坐标及 21 帧全部 40 母线节点 | 测点 9.37e-11 m；节点 1.36e-10 m | 1e-6 m，通过 |
| 轴对称球冠翻转 | 0.005–0.55 s，中部每步两坐标及 5 帧全部 40 母线节点；不含翻转 | 测点和节点均约 5.00e-13 m；反力 5.12e-8 N | 位置 1e-6 m、反力 0.05 N，局部通过 |
| 重力柔性网 | 0.01–2.00 s，中心每步三坐标及 11 帧全部 631 节点；Octave 向量化装配 | 中心 4.51e-10 m；采样节点 2.58e-9 m | 均 1e-6 m，通过 |
| 超弹性平面索 | 0.001–1.000 s，中点每步及 17 帧全部节点；40 节点与原输入对齐 | 中点 1.45e-10 m；节点 6.77e-11 m | 均 1e-6 m |
| 超弹性轴对称膜 | 0.01–2.00 s，第一母线节点每步两坐标及 21 帧全部 60 节点 | 测量点 5.49e-12 m；节点 5.34e-12 m | 1e-7 m，通过 |
| 磁场驱动柔性梁 | 0.01–20.00 s，末端每步两坐标及 41 帧全部 40 节点 | 端点 9.84e-6 m；节点 4.68e-6 m | 1e-5 m，通过 |
| 流固耦合软体游动 | 0.01–5.00 s，末端每步两坐标及 11 帧全部 40 节点 | 端点 4.43e-3 m；节点 4.49e-3 m | 1e-4 m，**未通过** |

**范围限制与差异定位：**屈曲原脚本记录 3 次达到最大迭代次数，其退出前记录残差分别为 1.21e-3、3.77e-4、8.98e-5，其中前两次超过原 `1e-4` 容差。跃迁原脚本记录 1 次达到上限，最后更新前残差为 3.23e-5，低于原容差；原程序先执行 Newton 更新，再检测迭代次数，所以该次仍记为达到上限。

原脚本 `bendingForce.m` 在列向量内积之后发生标量广播，其 Jacobian 和力的精确 Hessian 不同。抽取跃迁第 15.27 s 的一个弯曲单元，兼容 Jacobian 与 Octave 输出误差约 `3.64e-12 N/m`，与精确 Hessian 的最大元素差异约 `2.12e3 N/m`。工作台使用通过有限差分检验的精确 Hessian、`1e-7` 残差容差和线搜索；原脚本使用其 Jacobian、`1e-4` 容差及先更新后检查的顺序。源码兼容回放复现原来的停止/达到上限行为：屈曲与跃迁的中点及采样节点最大误差约 `5e-13 m`，但这**不是**充分收敛或模型正确性的证明。

完整跃迁的工作台轨迹在原来设定的 `2e-6 m` 严格阈值下未通过；离线比较全部 2000 步×40 节点，最大坐标误差约 `8.59e-5 m`，发生在 15.27 s。对相邻 `0.01 s` 中点样本做线性插值，工作台和原脚本的首次翻转过零时刻分别约 `15.146611 s` 和 `15.146634 s`（插值值不表示 23 μs 的实际时间精度）。`npm run reference:compare` 因此有意返回非零，测试则验证这一已知的未通过状态不会被隐藏。

超弹性索全时程原脚本记录 0 次最大迭代退出；离线额外比较全部 1000 步、全部 40 节点，最大坐标误差约 `2.49e-10 m`。

**柔性网参考与迭代：**网格 `node.txt`/`edge.txt` 的 SHA-256 分别为 `19b52253245990c0444ed7e5f006b5e7db4c5e8b342fcc9d071780038742dcc9`、`f58e0aecf98dfaea14c4b1d1a5b1f5f02fe28343052828abc3f2850475c2d92a`。Octave 的原单元循环和代数向量化装配都用稀疏存储和稀疏线性求解，前 5 步的全部节点最大差 `3.64e-16 m`，均未触及源迭代上限。完整 200 步只运行了向量化装配，保留源局部定律、参数和先更新后检查的停止顺序，0 次触及上限；这不是 200 步全都运行未向量化代码的结果。工作台以 `1e-5 N` 非线性残差为准，默认 200 步最大残差 `7.60e-6 N`；逐步仅比较中心三坐标，全节点只比较 11 帧，不代表每步全部节点均已对照。线性切线以矩阵自由 PCG 求解；PCG 遇到不定切线或失败时，使用正对角预处理 MINRES 并显式检查真实线性残差，不满足条件就回滚，不能据此声称所有参数都可解。

**新增模型的源代码细节：**膜的压力按上一构型显式计算，并将每条边完整质量加到两个端点；这不是常见的均分质量。磁驱例原 `getFm.m` 的 Jacobian 返回零，工作台使用经差分检查的完整磁力 Jacobian。游动例的 `getFd.m` 将第二端速度误取为第一端速度，实际阻力和参考回放均保留此行为；原阻力 Jacobian 又只含近似对角项，工作台对该实际力使用完整 Jacobian、`1e-10` 残差容差。膜、磁驱、游动三个原脚本均记录 **0 次达到迭代上限**。兼容回放的最大采样误差分别为 `5.02e-12`、`5.01e-13`、`5.00e-13 m`；游动兼容回放最后更新后的最大残差为 `1.52e-4`，高于原 `1e-4`，因为源码在更新后检查的是更新前残差。兼容回放是对源迭代过程的核对，并不表明工作台的轨迹满足阈值，也不证明原阻力离散的物理正确性。

**轴对称壳和临界窗口：**两例均为准静态，压力按上一构型取方向和面积；球冠受控自由度的反力取两个节点内力之和。充气盘原脚本有 1 次达到最大迭代次数，该次最后更新前残差为 `3.65e-7 N`，低于源容差 `1e-4 N`（源码先更新后检查）。球冠独立参考只到 `0.55 s`，没有覆盖约 `4 s` 的翻转。

为了检查临界区，还以 **TypeScript 源迭代在第 780 步（3.90 s）得到的位移和速度作为共同初值**，运行原 Octave 方程 40 步至 4.10 s；数据在 `axis-shell-cap-conditional.json`，可以用 `scripts/make-axis-shell-checkpoint.ts`、`scripts/generate-axis-shell-reference.mjs --checkpoint` 和 `scripts/compare-axis-shell-window.ts` 复现。这是条件窗口，**不是从初始构型得到的独立全程参考**。工作台在第 803 步（4.015 s）选择下平衡分支，40 节点逐步最大差为 `0.246 m`、反力最大差 `1.14e5 N`，不满足位置 `1e-6 m` 和反力 `0.05 N` 条件阈值；至第 802 步前最大差约 `1.21e-12 m`。原脚本在窗口中 7 次达到迭代上限，6 次最后更新前残差超过其 `1e-4 N` 容差。另行比较同一种源次序 TypeScript 回放：Node 22.22.3 中最大坐标差 `0.119 m`、回放 7 次触及上限且 7 步未收敛；Chromium 153 中分别为 `0.154 m`、9 次及 8 步。两环境的严格工作台最大差均为 `0.246 m`。这些是同一条件窗口、同一外部种子的**跨运行时诊断**，不是原脚本独立全程对照；数值结果可随运行环境变化，不能将该临界段的兼容回放称为可靠逐步复现。Node 结果在第 809 步之后重新贴近，但不能据此证明跃迁过程、稳定性或临界载荷。原始记录与重跑脚本见 [shell-runtime-audit.json](screenshots/shell-runtime-audit.json) 和 `scripts/audit-shell-runtime.mjs`。

工作台静态分支启发式只接受残差小于 `1e-5 N` 的平衡，不是瞬态动力学或稳定性分析。独立 12 项参考时窗中，**10 项在各自范围和阈值内通过，2 项严格未通过**；上述球冠条件诊断另行报告为**未通过**。游动例不是 Navier–Stokes 流场求解；采样节点与采样全构型不等于每一步全部自由度都已比较。

**尚未完成：**球冠从初始态经翻转的独立全程对照；悬臂梁后续时程及所有节点的对照；其他网格和参数条件的定量对照；其余 9 个算例的原始模型移植和定量对照；所有理论公式的逐式数值检验；网格/步长/非线性求解容差的全面收敛研究。

## 参数边界、应变与失败路径

除默认充气盘外，额外试跑六组节点数、模量和加载倍率的边界组合；只检查数值有限性、指定自由度与失败回滚，**不是**不同参数下的原脚本对照、网格收敛或材料有效性验证。全部组合约束/回滚检查通过，其中一组未能完成：充气盘 `24` 节点、`E=0.2 MPa`、压力倍率 `2` 在第 56 步（目标 `0.56 s`）未达到工作台 `1e-5 N` 残差要求，停在前一收敛步 `0.55 s`。该步母线最大工程应变幅值约 `4457`、最大轴向坐标约 `1501 m`，已远超合理材料适用性的判断范围；这**不是物理失稳或真实材料行为的证明**。记录见 [shell-parameter-audit.json](screenshots/shell-parameter-audit.json)。

即使是默认充气盘，`2.00 s` 末态最大母线段工程应变幅值也约为 `0.415`（约 41.5%）。工作台现在显示 `maxᵢ |(ℓᵢ−ℓ̄ᵢ)/ℓ̄ᵢ|` 并提示其不是完整二维应变或强度判据；线弹性材料在大应变下的适用性必须另行评估。与原脚本吻合仅证明两个实现的数值一致，不能证明该材料本构在实验中成立。

本轮发现**单步**遇到失败时，回滚后的重复时间会错误进入曲线及 CSV；现与连续播放一致，不记录失败步，但保留失败残差与警告。浏览器在该极端工况检查了时间与构型不前进、CSV 不变、播放/单步锁定、回看及恢复默认参数；还修复了 320/390 px 的警告与图例重叠。[桌面失败提示](screenshots/43-shell-nonconvergence.jpg) · [移动失败提示](screenshots/44-mobile-shell-nonconvergence.jpg) · [极端应变指标](screenshots/45-shell-extreme-strain.jpg) · [交互记录](screenshots/shell-failure-audit.json)。

柔性网另试跑默认、零重力、两组高重力极端及一组软网/低重力高阻尼，总计五组，均完成 200 步且支点不动、数值有限。高模量/高重力/高阻尼组合的第 2 步出现 PCG 不定切线；增加 MINRES 回退后该步及整程完成，线性/非线性残差仍须达标。这些参数组合未与原脚本定量对照。默认终态最大网边工程应变幅值约 `17.45%`，软网高重力无阻尼终态约 `105.18%`；不是强度判据或材料适用性的证明。记录和重跑脚本见 [net-parameter-audit.json](screenshots/net-parameter-audit.json)、`scripts/audit-net-parameters.ts`。

## 五指仿生手：固定球体原型（未验收）

五根独立腱和五个真实挖孔的超弹性实体分别求解腱—孔壁接触，并以固定球体的无摩擦反力反馈到指体；球体本身受外部支撑，不是自由抓取。五指接受帧之间检测指间离散表面 CCD，失败或不确定时缩步/整体回滚。掌部仅作为固定支撑显示，不参与接触。8 mm 目标在 7.00 mm 请求时遇拇—食指 CCD 不确定并回滚，末个接受点为相似牵引 6.75 mm；该点五指有非零球接触，但拇指力仅约 49 μN。路径及失败详见 [五指路径记录](screenshots/bionic-hand-audit.json)，严格验收仍未通过。

对于相似牵引 6.75 mm，独立 NumPy/SciPy 对五指指定构型重组实体、腱、孔壁与球体接触，五指的球体活动面均有覆盖。误差及独立候选检查见 [五指独立记录](screenshots/bionic-hand-independent-audit.json)；另留有 [3.5 mm 快照记录](screenshots/bionic-hand-independent-3p5mm.json)。[浏览器及导出记录](screenshots/bionic-hand-browser-audit.json) 与[6.75 mm 路径 GIF](media/bionic-hand-3d.gif)只证明该界面工况，不证明自由抓取、所有路径安全或网格收敛；详细推导、尺寸和缺项见 [五指文档](BIONIC_HAND_3D.md)。

## 逐项截图与状态

下面的截图在 Chromium、1440×1000 视口下捕获；浏览器检查非空 WebGL、无求解警告和无水平溢出。**过程截图**通常捕获在约 0.5–1.0 s；**终态截图**逐例播放到声明结束时刻，额外检查终点控制及位移读数。21 幅过程图和 21 幅终态图均通过各自的总览图目视检查；移动端在 390×844 下另行检查。日志见 [过程审查](screenshots/audit.json) 和 [终态审查](screenshots/end-cases/audit.json)。

| # | 算例 | 过程截图 | 终态截图 | 模型/对照状态 |
|---:|---|---|---|---|
| 01 | 单自由度弹簧振子 | [查看](screenshots/01-mass-single.jpg) | [终态](screenshots/end-cases/01-mass-single.jpg) | 隐式数值；对齐驱动的局部参考对照 |
| 02 | 多自由度弹簧系统 | [查看](screenshots/02-mass-multi.jpg) | [终态](screenshots/end-cases/02-mass-multi.jpg) | 隐式数值；对齐驱动的局部参考对照 |
| 03 | 重力下的悬臂梁 | [查看](screenshots/03-beam-gravity.jpg) | [终态](screenshots/end-cases/03-beam-gravity.jpg) | 平面 DDG；前 0.5 s 末端参考对照 |
| 04 | 受压梁的屈曲 | [初始](screenshots/04-beam-buckling.jpg) · [加载](screenshots/27-buckling-loaded.jpg) | [终态](screenshots/end-cases/04-beam-buckling.jpg) | 准静态 Newton；全 10 s 的中点和采样构型对照（原脚本有最大迭代退出） |
| 05 | 预屈曲梁的跃迁 | [初始](screenshots/05-beam-snap.jpg) · [跃迁前](screenshots/28-snap-before.jpg) · [跃迁后](screenshots/29-snap-after.jpg) | [终态](screenshots/end-cases/05-beam-snap.jpg) | 隐式动力学；全 20 s 已对照，精确 Hessian 轨迹未通过 2 μm 严格阈值；兼容回放另列 |
| 06 | 重力下的空间螺旋杆 | [查看](screenshots/06-rod-helix.jpg) | [终态](screenshots/end-cases/06-rod-helix.jpg) | 约束近似；原文对照待完成 |
| 07 | 预屈曲带的分叉 | [查看](screenshots/07-rod-bifurcation.jpg) | [终态](screenshots/end-cases/07-rod-bifurcation.jpg) | 约束近似；原文对照待完成 |
| 08 | 环形带的生长 | [查看](screenshots/08-rod-growth.jpg) | [终态](screenshots/end-cases/08-rod-growth.jpg) | 约束近似；原文对照待完成 |
| 09 | 轴对称平板充气 | [初始](screenshots/09-axis-inflate.jpg) · [加载及压力曲线](screenshots/37-axis-inflation-loaded.jpg) | [终态](screenshots/end-cases/09-axis-inflate.jpg) | 线弹性母线与准静态 Newton；全 2 s 测点和采样构型对照通过 |
| 10 | 轴对称球冠翻转 | [初始](screenshots/10-axis-snap.jpg) · [切换前](screenshots/38-axis-cap-before.jpg) · [切换后及反力曲线](screenshots/39-axis-cap-after.jpg) | [终态](screenshots/end-cases/10-axis-snap.jpg) | 静态分支切换；独立参考前 0.55 s，通过但不含翻转；临界条件窗口不一致 |
| 11 | 重力下的薄板挠曲 | [查看](screenshots/11-plate-gravity.jpg) | [终态](screenshots/end-cases/11-plate-gravity.jpg) | 约束近似；原文对照待完成 |
| 12 | 薄板的重力褶皱 | [查看](screenshots/12-plate-wrinkle.jpg) | [终态](screenshots/end-cases/12-plate-wrinkle.jpg) | 初始扰动示意；原文对照待完成 |
| 13 | 圆柱壳的局部压痕 | [查看](screenshots/13-shell-indent.jpg) | [终态](screenshots/end-cases/13-shell-indent.jpg) | 局部节点力近似；原文对照待完成 |
| 14 | 重力下的柔性网 | [过程](screenshots/14-net-gravity.jpg) · [终态](screenshots/47-net-loaded.jpg) · [移动端](screenshots/48-mobile-net.jpg) | [终态](screenshots/end-cases/14-net-gravity.jpg) | 原始 631 节点/720 边的伸长网络；全 2 s 中心与采样全节点对照通过，完整参考采用经前五步比对的向量化装配 |
| 15 | 网壳的形态生成 | [查看](screenshots/15-net-form.jpg) | [终态](screenshots/end-cases/15-net-form.jpg) | 初始拱形近似；原文对照待完成 |
| 16 | 重力下的空间格构 | [查看](screenshots/16-lattice-gravity.jpg) | [终态](screenshots/end-cases/16-lattice-gravity.jpg) | 约束近似；原文对照待完成 |
| 17 | 超弹性平面索 | [初始/过程](screenshots/17-hyper-cable.jpg) · [完整加载](screenshots/30-hyper-cable-loaded.jpg) | [终态](screenshots/end-cases/17-hyper-cable.jpg) | Mooney–Rivlin 索；全 1 s 中点和采样构型对照；无弯曲或仅受拉截断 |
| 18 | 超弹性轴对称膜 | [初始](screenshots/18-hyper-membrane.jpg) · [加载](screenshots/31-membrane-inflation.jpg) | [终态](screenshots/end-cases/18-hyper-membrane.jpg) | 轴对称 Mooney–Rivlin 母线；全 2 s 测量点和采样构型对照 |
| 19 | 磁场驱动柔性梁 | [初始](screenshots/19-robot-magnetic.jpg) · [加载](screenshots/32-magnetic-field.jpg) | [终态](screenshots/end-cases/19-robot-magnetic.jpg) | 原磁势与平面梁；全 20 s 测量点和采样构型对照 |
| 20 | 流固耦合软体游动 | [初始](screenshots/20-robot-swim.jpg) · [运动](screenshots/33-swimmer-propulsion.jpg) | [终态](screenshots/end-cases/20-robot-swim.jpg) | 源码磁力和二次阻力；全 5 s 严格对照未通过、兼容回放通过 |
| 21 | 摩擦接触软体爬行 | [查看](screenshots/21-robot-crawl.jpg) | [终态](screenshots/end-cases/21-robot-crawl.jpg) | 地面投影近似；原文对照待完成 |

过程总览：[01–07](screenshots/review-01.jpg) · [08–14](screenshots/review-02.jpg) · [15–21](screenshots/review-03.jpg)；终态总览：[01–07](screenshots/end-cases/review-01.jpg) · [08–14](screenshots/end-cases/review-02.jpg) · [15–21](screenshots/end-cases/review-03.jpg)。屈曲与跃迁的分阶段加载、回看及翻转截图日志见 [planar-audit.json](screenshots/planar-audit.json)；超弹性索加载、回放与节点数切换见 [hyper-audit.json](screenshots/hyper-audit.json)；三个多物理模型的加载、回看和画布检查见 [multiphysics-audit.json](screenshots/multiphysics-audit.json)；轴对称壳的完整充气、翻转前后、回看重演、参数/曲线/CSV 与移动端检查见 [axis-shell-audit.json](screenshots/axis-shell-audit.json)；柔性网完整时程、回看、零重力、导出及移动端检查见 [net-audit.json](screenshots/net-audit.json)。其他页面：[算例库](screenshots/22-library.jpg) · [平面梁推导与曲率交互](screenshots/23-theory.jpg) · [轴对称壳推导](screenshots/40-axis-theory.jpg) · [柔性网推导](screenshots/49-net-theory.jpg) · [柔性网参考结果](screenshots/46-net-validation.jpg) · [超弹性推导](screenshots/35-theory-hyperelasticity.jpg) · [磁场与阻力推导](screenshots/36-theory-multiphysics.jpg) · [验证中心](screenshots/24-validation.jpg) · [球冠临界诊断细节](screenshots/42-cap-diagnostic.jpg) · [移动算例库](screenshots/25-mobile-library.jpg) · [移动工作台](screenshots/26-mobile-workspace.jpg) · [移动导航](screenshots/34-mobile-navigation.jpg) · [移动球冠](screenshots/41-mobile-axis-cap.jpg)。

审查过程中发现默认悬臂梁视图截断、暂停时读数短暂不同步，以及移动端导航图标在桌面误显示，均已修正并重新截图。本次又发现游动体在平移后因 Three.js 实例网格包围球未更新而被错误裁剪，已关闭动态实例和曲面的视锥剔除，并在运动后及回看状态重新检查非空画布。本轮还发现播放结束前后的按钮状态可能短暂滞后、导致仿真越过终点；已在播放和单步路径限制最大时长，并重审充气盘 2.00 s 终态。继续审查时发现球冠的部分约束此前只有文字说明，没有对应的边界标记；现以径向滑动导轨表示边缘仅固定轴向，并以竖向导轨表示充气盘中心的径向约束，导轨不参与求解。终态复审还发现螺旋杆和两类薄板长时程形状被裁切；已增加包含当前及可见初始构型的正交自动取景，用户交互后关闭，重置视角重新开启。对螺旋杆 10 s 终态实测缩放后像素平均差 `0.429`、重置后差 0，并检查 390 px 视图；[移动终态](screenshots/50-mobile-helix-end.jpg) · [取景记录](screenshots/camera-fit-audit.json)。已检查 320/390 px 移动宽度、回看残差及临界诊断截图。截图审查仅覆盖所捕获时刻，不是完整运动轨迹或计算准确性的证明。
