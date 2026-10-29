# 腱驱软体抓手：三维实体、真实孔壁和大卷曲

这是原 DDG 教程 21 个算例之外、尺寸和材料自行假设的准静态示例，不是经过实验标定的器件。入口为侧栏 **「三维实体孔抓手」**或 `/?page=gripper3d`；`/?page=gripper` 是独立的二维等效模型，不能替代这里的三维孔壁接触。

> **尚未通过严格验收，不能用于工程设计。**标准离散算例可以计算出大卷曲，但小残差并不证明网格、腱离散和加载步长收敛，更不证明真实材料或实际夹持安全。下面明确区分已完成的离散检查和仍缺失的连续体/实验验证。

## 1. 几何、参数与观测量

以背梁长轴为 $x$，齿高度为 $y$，厚度为 $z$；数值使用 SI 单位。

| 项目 | 假设与实现 |
|---|---|
| 指体 | 80 × 14 × 8 mm；$y=0$–7 mm 为连续背梁，$x=0$–20、33.333–53.333、66.667–80 mm 的三段凸齿向上延伸 |
| 真实孔 | 每段凸齿实际挖掉 $9.7<y<11.3$、$3.2<z<4.8$ mm 的材料，形成 1.6 × 1.6 mm 矩形贯通孔；齿之间是空隙而非虚拟孔壁 |
| 实体 | 默认 288 节点、136 个八节点全积分六面体；其结构化六面体同时划分为 816 个线性四面体，以三角形表示边界并用于安全审查 |
| 网格细化 | 每个方向 2、3 等分，分别为 1088、3672 个六面体；几何不变，边界仍为平面三角近似 |
| 材料 | 可压缩 Neo-Hookean，$E=250$ kPa、$\nu=0.35$；无粘弹性或损伤 |
| 牵引腱 | 初始中心线 $y=10.5$ mm、$z=4$ mm；默认半径 0.4 mm、23 条线段、$EA=30$ N、有效离散弯曲刚度 $B=2\times10^{-8}$ N·m²，均为假设 |
| 驱动/锚 | 实体 $x=0$ 端固定；腱驱动端自 $x=-12$ mm 沿负 $x$ 位移。腱末端通过 $k_a=10000$ N/m 弹簧连接至孔口四角节点的平均位置 |
| 默认演示 | 牵引 14.75 mm、名义增量 0.25 mm；求解会自动细分难步，计算大卷曲需要较长时间。界面允许至 15 mm，参数改变后不保证收敛 |
| 接触 | 所有完整腱段对所有外边界及孔壁三角形；无摩擦，多特征增广拉格朗日，$k_n=4\times10^6$ N/m² |

**指端转角不是腱位移或视觉角度。**在 $x=80$ mm 和 $x=73.333$ mm，分别取参考坐标 $y=3.5$ mm、$z=3.2,4.8$ mm 两个背梁节点的当前平均位置 $c_1,c_0$，报告 $\theta=\operatorname{atan2}((c_1-c_0)_y,(c_1-c_0)_x)$，单位为度。这是末端约 6.67 mm 背梁弦在 $x$–$y$ 平面的有向转角；它并非整指曲率，也不包括面外扭转。三个网格级别使用相同参考长度。画面直接渲染求得的实体节点坐标，**不放大变形**；接触箭头和标记为可见性放大。「沿孔轴」视角根据当前变形的末端孔口定位和朝向，关闭透视后可观察真实孔口与腱。

## 2. 离散模型与公式

### 2.1 全积分三维超弹性

八节点 Q1 形函数在每个六面体的八个 $2\times2\times2$ 高斯点求值：

$$
F=\sum_{a=1}^{8}x_a\otimes\nabla_XN_a,\quad J=\det F,\quad
W=\frac\mu2(\operatorname{tr}F^TF-3)-\mu\ln J+\frac\lambda2(\ln J)^2,
$$

$$
\mu=\frac{E}{2(1+\nu)},\qquad\lambda=\frac{E\nu}{(1+\nu)(1-2\nu)},\qquad
E_s=\sum_{e,g}w_g W(F_{eg}).
$$

一阶 Piola 应力和一致材料切线为

$$
P_{iJ}=\mu F_{iJ}+(\lambda\ln J-\mu)F^{-T}_{iJ},\qquad
\frac{\partial P_{iJ}}{\partial F_{kL}}=\mu\delta_{ik}\delta_{JL}+
(\mu-\lambda\ln J)F^{-T}_{iL}F^{-T}_{kJ}+\lambda F^{-T}_{iJ}F^{-T}_{kL}.
$$

单元梯度和 Hessian 由 $P$、该切线及参考形函数梯度积分装配；$J\le10^{-8}$ 的试探态被拒绝。von Mises 显示是单元 Cauchy 应力的可视化，不是孔壁接触压力。

### 2.2 可滑动腱和锚固

腱节点不绑定孔壁；每段仅受拉，并加入二阶差分弯曲及末端弹簧：

$$
E_t=\sum_i\frac{EA}{2\ell_{0i}}\langle\ell_i-\ell_{0i}\rangle_+^2+
\sum_i\frac{B}{2\bar\ell_i^3}\lVert p_{i-1}-2p_i+p_{i+1}\rVert^2+
\frac{k_a}{2}\left\lVert p_{\rm end}-\frac14\sum_{a\in A}x_a\right\rVert^2.
$$

零应变使用受拉侧广义切线改善初始线性系统，但不产生压缩能或压缩力。GUI 和 CSV 的腱力是**首段轴向力**，并不假定全腱各段张力相同。锚弹簧偏差有独立诊断。

### 2.3 完整线段—三角形的多特征接触

对于腱段 $p(t)=(1-t)p_0+tp_1$ 和实体边界三角形，段与三角面相交时整段距离为零；不相交时，最短距离是以下五个闭集距离的最小值：两个**端点—三角形**、三个**整段—三角形边**。因此要求各特征

$$
g_j=d_j-r\ge0,\qquad j=1,\ldots,5,
$$

并额外用完整段—三角形相交检测拒绝穿面，比用若干固定采样点更强。使用非负乘子 $\lambda_j$，每特征的数值增广尺度取 $k_j=k_n\ell_{0i}/5$：

$$
\lambda_j^+=\max(0,\lambda_j-k_jg_j),\qquad
E_c=\sum_j\frac{(\lambda_j^+)^2}{2k_j},\qquad
\lambda_j\ge0,\quad g_j\ge0,\quad\lambda_jg_j=0.
$$

上式省去当前外迭代中与坐标无关的常数。最近点 $p,z$ 给出 $n=(p-z)/\lVert p-z\rVert$；腱端点按 $1-t,t$、三角形顶点按重心坐标分配相反的接触力。每项分别满足作用—反作用及零合力矩。端点/边/顶点重合时特征约束**冗余**，不是新增物理表面；各非唯一乘子之和才构成合反力，接触项个数和幅值之和不等于接触面积、合力或压强。

每对使用独立乘子可减少“只选最小特征”切换时的线搜索停滞；轴对齐包围盒仅作保守下界剔除，历史乘子也计入剔除条件。与原单最近特征版本相比没有放宽完整段静态审查、互补公差或连续碰撞检查。

### 2.4 平衡、路径审查和回滚

$$
\nabla_{q_{\mathrm{free}}}(E_s+E_t+E_c)=0,\qquad
\lVert r_{\mathrm{free}}\rVert_2<2\times10^{-5}\;\mathrm N.
$$

采用材料一致切线、接触 Gauss–Newton 近似切线、矩阵无关 PCG 和 IC(0) 预条件。IC 的枢轴保护只改变预条件器，不修改所求方程；必要时试对角移位、能量线搜索和增广乘子迭代。每个接受的构型还须通过力/力矩平衡、互补及完整段静态穿透（默认不超过 0.02 μm）、腱轴不进入四面体、表面自交和静态四面体正体积重叠检查。

每段被接受的**线性数值试探路径**采用保守连续碰撞检查（CCD），包括腱—全部三角边界和相邻/非相邻表面三角形；相邻面只排除共享拓扑，其余特征仍检查。除四面体和六面体八个高斯点的路径 $J$ 外，还对每个 Q1 六面体的**整个参考域及线性插值路径**执行下述 Bernstein 下界检查。CCD 允许至多 2 μm 的临时压入，最终收敛态仍须满足更严格的 0.02 μm；不可判定的 CCD 或 $J$ 结果视作失败。失败自动细分驱动增量，仍失败则原子回滚坐标、乘子和历史。

对轴对齐参考砖块，令 $(u,v,w,t)\in[0,1]^4$，$t$ 是两个数值构型间的线性插值参数。Q1 映射的三个导数列分别在另两个空间变量及 $t$ 中为多线性，因此其行列式在每个空间变量中次数不超过 2、在时间中次数不超过 3：

$$
J(u,v,w,t)=\sum_{i,j,k=0}^{2}\sum_{\ell=0}^{3}b_{ijk\ell}
 B_i^2(u)B_j^2(v)B_k^2(w)B_\ell^3(t),\qquad \min b_{ijk\ell}\le J\le\max b_{ijk\ell}.
$$

代码将 $3\times3\times3\times4$ 个插值值转换为 Bernstein 系数，若系数下界不够正则以 de Casteljau 细分缩紧；深度或预算耗尽即拒绝。浮点安全余量除样本 $J$ 外还按相对坐标立方尺度与参考体积之比放大，以拒绝大数相消造成的不可靠符号；溢出、NaN、非法间隙或非法几何均不能被当成安全。界面「路径 J 下界」及 CSV 的 `minimum_path_J_lower_bound` 是每个接受步所检查路径的保守数值下界，`min_J` 仍是高斯点值。**该余量是浮点启发式，不是严格区间/精确算术证明；局部正 Jacobian 也不证明全局单射或无体积碰撞。**

卸载按步重新求解。在零牵引、无预应力/摩擦/塑性的假设下，精确参考构型是零能平衡；仅当指向参考态的线性路径 CCD/$J$、静态干涉以及该态残差均通过时才直接恢复，否则继续普通求解。

## 3. 已测结果（并非全模型验收）

标准网格、默认参数、0.25 mm 名义步长加载到 14.75 mm：

| 指标 | 结果 |
|---|---:|
| 指端实际平面转角 | **92.291°** |
| 指端横向位移 | 46.204 mm |
| 首段腱力 | 0.49804 N |
| 活动特征项 | 32 |
| 完整段静态最大穿透 / 互补残差 | 0.00223 / 0.00302 μm |
| 自由残差 / 支座合力误差 | $1.04\times10^{-5}$ / $1.05\times10^{-8}$ N |
| 最小 $J$ | 0.84374 |
| 表面自交、正体积四面体重叠、腱轴侵入 | 均为 0（上述离散审查范围内） |

独立 NumPy/SciPy 重组该末态：重新计算全积分六面体、腱、锚和 32 项接触力，并对保守包围盒内 670 个特征分别求凸最小距离；能量差约 $1.3\times10^{-18}$ J、最大梯度差 $2.1\times10^{-14}$ N、最大特征距离差 $3.1\times10^{-18}$ m，未发现遗漏的活动特征。[独立大卷曲报告](screenshots/gripper3d-continuous-independent-curl.json) / [3 mm 报告](screenshots/gripper3d-continuous-independent-mesh1.json)。这仍是**给定单个状态的独立重组**，不是独立全路径求解或实验。

段—三角形最近距离另以 500 组确定性随机几何同 SciPy 独立凸优化比较，最大绝对差 $2.03\times10^{-7}$（随机坐标单位，阈值 $2\times10^{-6}$），[静态几何审查](screenshots/segment-triangle-independent-audit.json)。它只验证几何例子，不覆盖动态路径或物理收敛。

**本轮 Jacobian 审查：**发现一个反例：8 个高斯点最小 $J=0.78546$、6 个四面体最小 $J=0.26677$，但 Q1 角点为 $J=-0.15100$；新增全参考域检查拒绝它。另一个整数仿射单元的矩阵第三行等于前两行之和，精确行列式为零，但直接双精度计算出正数 33,554,432；相消尺度护栏将其判为不确定并拒绝。独立 NumPy 在 222 条运动各采 620 点，并用 Python 整数精确验证其中 20 个奇异仿射例，全部交叉检查通过；109 条安全下界、5 条需细分，[独立报告](screenshots/gripper3d-hex-jacobian-independent.json)。这些样例不构成一般性浮点证明。

[大卷曲 GIF](media/tendon-gripper-3d-continuous.gif) · [桌面截图](screenshots/64-gripper3d-continuous-desktop.jpg) · [三维视图](screenshots/65-gripper3d-continuous-viewport.jpg) · [孔口视图](screenshots/66-gripper3d-continuous-bore.jpg) · [移动端](screenshots/67-gripper3d-continuous-mobile.jpg) · [浏览器交互审查](screenshots/gripper3d-continuous-browser-audit.json)。浏览器审查验证显示与交互，不等同于物理验收。

**审查进度：**当前源码哈希的 20 个严格案例中已有 18 个结果；14.75 mm 的 69 段腱和二级实体网格 2 案仍待完成，因此汇总明确标为缺项而不是通过。3 mm 及 14.75 mm 加载后均已实际逐步卸载至零位移、零张力；14.75 mm 工况的 0.25/0.125 mm 名义步长末态位移和首段张力差均小于 0.001%（均可能自适应细分），下表 3 mm、0.5 mm 的对比也已用当前源码重算。这些末态比较并不证明全路径收敛。

| 比较 | 载荷 | 指端位移变化 | 首段腱力变化 |
|---|---:|---:|---:|
| 标准 → 二级实体网格 | 3 mm | +1.94% | **−20.31%** |
| 二级 → 三级实体网格 | 0.5 mm | −0.59% | **−6.56%** |
| 标准 → 二级实体网格（旧版本，待重算） | 14.75 mm | +0.346% | **−27.13%** |
| 23 → 46 腱段 | 3 mm | +0.063% | −0.065% |
| 46 → 69 腱段 | 3 mm | +0.040% | −0.088% |
| 23 → 46 腱段 | 14.75 mm | +0.164% | **−6.70%** |

严格逐案例结果、失败项、源码哈希和加密对比见[数值审查 JSON](screenshots/gripper3d-continuous-audit.json)。残差、互补和干涉等逐帧检查只统计已接受帧，失败的试探步另作失败记录；表中的收敛比较仅针对所列载荷末态，不是全路径收敛。特别是极细 1 μm 腱的数值压力测试在 0.75 mm 失败并回滚；不能把此工况视为通过。直径、材料和网格在 GUI 中改变后也可能出现不收敛。源码仓库保留的旧采样求解器 `gripper3d.ts` 及旧报告仅用于历史对照，并不是当前 GUI 使用的接触算法。

### 3.1 弯曲锁定诊断与未并入的候选

在相同挖孔参考网格指定小应变纯弯曲制造位移，令 $Y=y-y_0$、$Z=z-z_0$：

$$
u_x=-\kappa xY,\quad u_y=\tfrac\kappa2[x^2+\nu(Y^2-Z^2)],\quad u_z=\nu\kappa YZ,\qquad
E_{\rm exact}=\int_\Omega \tfrac12E\kappa^2Y^2\,dV.
$$

解析剪应变为零。将该位移的节点值插值到 Q1 并对线性应变能积分（$\kappa=0.02\,\mathrm m^{-1}$），标准、二级、三级网格的**整体**能量分别高出解析值 6.758%、1.690%、0.751%；仅统计两齿之间的薄背梁区域时分别高出 **39.315%、9.829%、4.368%**，其中虚假剪切能分别达到精确能量的 34.400%、8.600%、3.822%。这是固定制造位移的锁定诊断，**不是**腱驱动的受载平衡，也不能单独解释全部网格差异。[可复现数据](screenshots/gripper3d-bending-patch-audit.json)。

`experiments/gripper3d/` 另保留研究性不协调模态候选：在 Q1 位移中加入 $\sum_{m=1}^3(1-\xi_m^2)\alpha_m$，对内部自由度局部求极小并用 Schur 补凝聚切线。该候选在更小曲率 $0.002\,\mathrm m^{-1}$ 的制造位移试验中，三级网格的薄梁能量与线性解析值差均小于 0.001%；20 个轻度畸变单元的独立 NumPy 重组及 SciPy 局部驻点求解也通过，局部 Hessian 最小特征值均为正。[制造解报告](screenshots/gripper3d-incompatible-patch-research.json) · [独立局部报告](screenshots/gripper3d-incompatible-independent-research.json)。有限变形能与线性解析能并非完全相同，因此这些差值只是诊断。通过测试替换实体核、其余接触及安全代码不变的研究性耦合算例，0.5 mm 时首段腱力的标准→二级变化为 **−6.015%**、二级→三级为 −3.188%；3 mm 时标准→二级为 **−6.602%**，仍不满足 5% 的网格标准。[研究性路径对比](screenshots/gripper3d-incompatible-path-research.json)仅包含所列载荷，不能推广到高载全路径。**内部模态跨单元面不协调，真实增强位移未用于接触几何或安全审查；网格、接触和大变形验证不足，候选没有进入生产 GUI，也不能声称修复。**

## 4. 明确的验证边界

- 未完成独立逐对**内部体积**的路径 CCD；静态四面体重叠检查和表面 CCD 不能证明路径中整个连续体不相交。六面体双线性曲面以平面三角形表示；全域 $J$ 检查使用浮点余量而非严格区间运算，且正 $J$ 不能保证全局无自交。
- 自碰撞仅拒绝，不产生实体自接触反力；未实现被抓物接触、腱—腱/腱自碰撞、摩擦、粘弹性、惯性、破坏或物体抓取。
- 三维几何和参数为假设，未和实验、商业 FEM 或独立全程求解进行标定。网格/腱/步长及接触尺度的收敛应逐工况检验，不能由动画外观或某一末态残差代替。
- GIF 是按牵引排列的收敛准静态构型，**不是动力学时间序列**。腱和接触箭头透视叠加以便观察；转角和位移均由未放大的实体节点计算。

## 5. 复现

```bash
npm ci
npm run dev                            # /?page=gripper3d
npm test && npm run build
npx vite-node scripts/audit-gripper3d-continuous.ts --case curl
npx vite-node scripts/snapshot-gripper3d-continuous.ts curl
python3 scripts/audit-gripper3d-continuous-independent.py  # 需 numpy、scipy
npx vite-node scripts/generate-segment-triangle-cases.ts /tmp/segments.json
python3 scripts/audit-segment-triangle-independent.py /tmp/segments.json
npx vite-node scripts/generate-hex-jacobian-cases.ts /tmp/hex-jac-cases.json
python3 scripts/audit-hex-jacobian-independent.py /tmp/hex-jac-cases.json
npx vite-node scripts/audit-gripper3d-bending-patch.ts
# 仅研究：不协调模态局部与制造解复核
npx vitest run experiments/gripper3d/incompatible-hex.test.ts
npx vite-node experiments/gripper3d/probe-patch.ts
npx vite-node experiments/gripper3d/generate-incompatible-cases.ts /tmp/incompatible-hex-cases.json
python3 experiments/gripper3d/audit-incompatible-independent.py /tmp/incompatible-hex-cases.json
# 各案例单独运行，名称见脚本（包括 curlCable3）；全部运行后：
npx vite-node scripts/audit-gripper3d-continuous.ts --combine
# combine 对缺失、过期源码或任一失败项返回非零；并不把限制标成通过
```

源码：`src/engine/continuous-gripper3d.ts`、`hexahedron.ts`、`hex-jacobian-bound.ts`、`segment-triangle.ts`、`continuous-collision.ts`、`gripper3d-safety.ts`；GUI 为 `Gripper3DLab.tsx` 和 `Gripper3DViewport.tsx`，实际计算在 TypeScript Worker 中，Worker 不可用时回退主线程。该三维算例**不调用 Rust/WASM 求解器**。
