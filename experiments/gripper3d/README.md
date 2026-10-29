# 研究候选：局部不协调模态六面体

这里的单元 **没有接入生产求解器、GUI 或 Rust/WASM**。它用于研究全积分 Q1 的弯曲锁定，不能用于器件设计，不能作为生产模型或安全保证。

对轴对齐参考砖块，`incompatible-hex.ts` 在节点 Q1 位移之外加入 3 组局部二次位移 `Σ_m (1−ξ_m²) α_m`（每组一个三维向量）。在八个高斯点用原 Neo-Hookean 能量求解局部 `∂E/∂α=0`，并用 `Kqq−Kqα Kαα⁻¹ Kαq` 静态凝聚；局部 Newton/线搜索或矩阵不可逆时抛错。测试包括仿射变形与旋转客观性、能量/梯度/切线差分；独立 SciPy/NumPy 脚本在 20 个轻度畸变单元重组能量、节点梯度及局部残差，从零求驻点并数值检查局部 Hessian 正特征值。

**重要限制**：这些附加位移在其他单元面上一般不为零，独立凝聚后跨单元面不协调。当前接触、可视化及碰撞检查只看 Q1 节点几何，不看增强位移；现有 Q1 全域 Jacobian 下界不适用于增强场。制造解是给定节点位移，不是平衡解；局部检查不证明全局稳定、高载接触、网格收敛、物理实验或全路径无碰撞。因此不应将候选复制进生产求解器。

```bash
npx vitest run experiments/gripper3d/incompatible-hex.test.ts
npx vite-node experiments/gripper3d/probe-patch.ts
npx vite-node experiments/gripper3d/generate-incompatible-cases.ts /tmp/incompatible-hex-cases.json
python3 experiments/gripper3d/audit-incompatible-independent.py /tmp/incompatible-hex-cases.json  # NumPy/SciPy
# 可选：在单独测试进程中替换实体核、保持生产接触代码。运行时间长：
GRIPPER_RESEARCH_CASE=coarse npx vitest run --config experiments/gripper3d/vitest.research.config.ts
GRIPPER_RESEARCH_CASE=fine npx vitest run --config experiments/gripper3d/vitest.research.config.ts
GRIPPER_RESEARCH_CASE=finer npx vitest run --config experiments/gripper3d/vitest.research.config.ts
npx vite-node experiments/gripper3d/combine-paths.ts  # 缺项、过期或差异 ≥5% 会返回非零
```

输出见 `docs/screenshots/gripper3d-incompatible-*-research.json`；结果仅针对报告中列出的给定状态/载荷。`research-paths.research.ts` 通过 Vitest mock 替换材料核，不会改变生产模块，且默认 `npm test` 不运行这些耗时路径。
