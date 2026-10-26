/* =============================================================
   labs.js · 「机器实验室」规格表
   每台机器 = 对象(场景) + 控件(滑杆/触发) + 仪表(由场景模型回吐)
              + 推过头预设 + 一句话大主意
   控件写入 params，场景 build 用同一组参数算几何与仪表，数字与图形同源。
   ============================================================= */
(function () {
  'use strict';
  const R = (id, label, min, max, step, val, unit) => ({ type: 'range', id, label, min, max, step, val, unit: unit || '' });

  window.LABS = {
    eq: { quad: { idea: '因果链：c 上下移动曲线，Δ 的符号决定根的个数——先看图，再背判别式。', controls: [R('a', 'a（开口）', -1, 2, 0.05, 1), R('b', 'b（左右）', -4, 4, 0.1, 0), R('c', 'c（上下）', -5, 2, 0.1, -4)], brk: { label: '推过头：Δ<0', params: { a: 1, b: 0, c: 1 } } } },
    set: {
      venn: { idea: '把两个球拉开或合拢，公共元素的个数就是交集的大小。', controls: [R('sep', '圆心半距', 0, 1.1, 0.05, 0.45)], brk: { label: '推过头：完全分开', params: { sep: 1.05 } } },
      union: { idea: '|A∪B| = |A| + |B| − |A∩B|：数一遍图上的点，公式自己会跳出来。', controls: [R('sep', '圆心半距', 0, 1.1, 0.05, 0.45)], brk: { label: '推过头：完全分开', params: { sep: 1.05 } } },
      comp: { idea: '补集先认全集；两球分开时，A∩B 先空掉，∁A 却还在。', controls: [R('sep', '圆心半距', 0, 1.1, 0.05, 0.45)], brk: { label: '推过头：完全分开', params: { sep: 1.05 } } },
    },
    ineq: {
      amgm: { idea: '四块面积拼成 (a+b)²：a 与 b 越不相等，中间两块 ab 越“浪费”，差就是 (a−b)²。', controls: [R('a', '边 a', 0.3, 2.6, 0.05, 1.55), R('b', '边 b', 0.3, 2.6, 0.05, 0.85)], brk: { label: '取等点：a=b', params: { a: 1.4, b: 1.4 } } },
      cauchy: { idea: '转动 b：a·b 永远追不上 |a||b|，只在共线时取等，垂直时归零。', controls: [R('ang', 'b 的方向角', 0, 180, 1, 68, '°')], brk: { label: '推过头：转到 90°', params: { ang: 90 } } },
    },
    func: {
      quad: { idea: 'a 管开口与胖瘦，b 管左右，c 管上下；顶点永远站在对称轴上。', controls: [R('a', 'a', -2, 2, 0.1, 1), R('b', 'b', -4, 4, 0.1, -1.9), R('c', 'c', -3, 3, 0.1, -0.9)], brk: { label: '推过头：a<0 翻面', params: { a: -1, b: -1.9, c: -0.9 } } },
      exp: { idea: '底数 a 同时管着指数与对数两条互为反函数的曲线；a<1 时两条一起掉头。', controls: [R('base', '底数 a', 0.3, 3, 0.05, 2)], brk: { label: '推过头：a<1', params: { base: 0.5 } } },
      tick: { idea: '对勾函数的谷底永远在 (√a, 2√a)：a 放大几倍，谷底按 √a 倍挪窝。', controls: [R('a', '参数 a', 0.2, 3, 0.05, 0.7)], brk: { label: '推过头：a=3', params: { a: 3 } } },
    },
    calc: {
      complex: { idea: '复数不是“虚构的数”，是平面上的一个点：横是 a，竖是 b，斜边是模，转角是辐角。', controls: [R('re', '实部 a', -2, 2, 0.05, 1.25), R('im', '虚部 b', -2, 2, 0.05, 1.45)], brk: { label: '推过头：拖回原点', params: { re: 0, im: 0 } } },
      rot: { idea: '乘 i = 逆时针转 90°、模不变；连按四次回到原地，所以 i⁴=1。', controls: [{ type: 'trigger', id: 'k', label: '乘一次 i（转 90°）' }], brk: { label: '推过头：连乘两次', params: { k: 2 } } },
    },
    trig: {
      circle: { idea: '单位圆上一个点同时生出三个数：横坐标 cos、纵坐标 sin、斜率 tan。', controls: [R('th', '角度 θ', 0, 360, 1, 42, '°')], brk: { label: '推过头：θ→90°', params: { th: 89 } } },
      sum: { idea: '和角公式不是背出来的：先转 α 再转 β，纵坐标自己叠加出 sinαcosβ+cosαsinβ。', controls: [R('al', '角 α', 5, 80, 1, 36, '°'), R('be', '角 β', 5, 80, 1, 28, '°')], brk: { label: '推过头：α+β→120°', params: { al: 70, be: 50 } } },
      wave: { idea: 'A 管胖瘦（纵向拉伸）、ω 管快慢（横向压缩）：周期 T=2π/ω 当场算给你。', controls: [R('A', '振幅 A', 0.3, 1.8, 0.05, 1.25), R('om', 'ω', 0.5, 3.5, 0.1, 1.8)], brk: { label: '推过头：ω=3.5', params: { A: 1.25, om: 3.5 } } },
    },
    vec: {
      add: { idea: '转动 b：平行四边形跟着变形，对角线 a+b 的长度与方向当场可读。', controls: [R('ang', 'a、b 夹角', 0, 180, 1, 62, '°')], brk: { label: '推过头：夹角 170°', params: { ang: 170 } } },
      dot: { idea: '数量积 = 投影长 × |b|：夹角过 90°，投影反向，数量积变负。', controls: [R('ang', 'a、b 夹角', 0, 180, 1, 62, '°')], brk: { label: '推过头：夹角 120°', params: { ang: 120 } } },
      proj: { idea: '投影是“影子”：光从正上方打下来，a 在 b 方向上还剩多长，影子说了算。', controls: [R('ang', 'a、b 夹角', 0, 180, 1, 62, '°')], brk: { label: '推过头：夹角 120°', params: { ang: 120 } } },
    },
    solid: {
      cut: { idea: '截面不是画出来的，是平面与 6 条棱的交点连出来的；分点 u 滑动，面积当场重算。', controls: [R('u', '分点位置 u', 0.08, 0.92, 0.01, 0.5)], brk: { label: '推过头：u→0.1', params: { u: 0.1 } } },
      ball: { idea: '外接球的直径就是体对角线：R=√3a/2，球面面积只跟 a² 走。', controls: [], brk: null },
    },
    vec3: { angle: { idea: '二面角不用在图里找平面角：转法向量 n₁，cos⟨n₁,n₂⟩ 当场给出锐二面角。', controls: [R('phi', 'n₁ 倾角 φ', 0, 70, 1, 32, '°')], brk: { label: '推过头：n₁∥n₂', params: { phi: 4 } } } },
    conic: {
      ellipse: { idea: '同一只双锥、同一把刀：倾角 β 与锥半角 α 的大小关系，当场决定截线是哪种曲线。', controls: [R('beta', '截面倾角 β', 8, 82, 1, 66, '°')], brk: { label: '推过头：β<α 裂成双曲线', params: { beta: 15 } } },
      hyperbola: { idea: 'β 比锥半角 α 还小，刀同时捅穿上下两只锥——双曲线的两支是这么来的。', controls: [R('beta', '截面倾角 β', 8, 82, 1, 18, '°')], brk: { label: '推过头：β>α 合成椭圆', params: { beta: 70 } } },
      parabola: { idea: 'β=α 是临界点：刀与母线平行，椭圆被拉开成抛物线；偏一度，类型就变。', controls: [R('beta', '截面倾角 β', 8, 82, 1, 32, '°')], brk: { label: '临界点：β=α', params: { beta: 32 } } },
      cone: { idea: '三种圆锥曲线同出一锥，区别只在刀的角度。切到各模式里拖 β 亲自验证。', controls: [], brk: null },
    },
    seq: {
      arith: { idea: '等差 = 把 d 一遍遍加上去：点列必在直线上，d 就是斜率，d 变号点列掉头。', controls: [R('d', '公差 d', -0.4, 0.9, 0.02, 0.42), R('n', '项数 n', 3, 10, 1, 7)], brk: { label: '推过头：d<0', params: { d: -0.3, n: 7 } } },
      geom: { idea: '等比 = 把 q 一遍遍乘上去：|q|>1 爆炸、|q|<1 衰减，先比 |q| 与 1。', controls: [R('q', '公比 q', 0.3, 2, 0.02, 1.42), R('n', '项数 n', 3, 10, 1, 7)], brk: { label: '推过头：q=2', params: { q: 2, n: 7 } } },
      sum: { idea: 'Sₙ 是把每一项叠成柱高：q<1 时柱子有天花板 a₁/(1−q)，q≥1 时没有。', controls: [R('q', '公比 q', 0.3, 1.6, 0.02, 0.72), R('n', '项数 n', 3, 12, 1, 7)], brk: { label: '推过头：q=1.5', params: { q: 1.5, n: 10 } } },
    },
    deriv: { tan: { idea: '拖着点 P 沿曲线走：切线斜率 f′(x₀) 在极值点变号——单调性就是这么“摸”出来的。', controls: [R('x0', '切点 x₀', -2.3, 2.3, 0.02, -1.2)], brk: { label: '临界点：拖到极值', params: { x0: 0.99 } } } },
    stat: {
      reg: { idea: '回归直线永远穿过样本中心 (x̄,ȳ)；把相关拖没，线还在，但预测已失效。', controls: [R('r', '相关程度', -0.95, 0.95, 0.01, 0.85)], brk: { label: '推过头：r=0', params: { r: 0 } } },
      spread: { idea: '以平均数为锚把数据拉开：平均数不动，方差按倍数的平方涨。', controls: [R('spread', '伸缩倍数', 0.2, 2.2, 0.05, 1)], brk: { label: '推过头：拉开 2.2 倍', params: { spread: 2.2 } } },
    },
    prob: {
      space: { idea: '两枚骰子 36 个点一样可能：目标和越靠中间，凑法越多，概率越大。', controls: [R('sum', '目标和', 2, 12, 1, 7)], brk: { label: '推过头：和=2', params: { sum: 2 } } },
      normal: { idea: 'μ 搬家、σ 胖瘦：曲线怎么变，μ±σ 里永远装着 68.3% 的概率。', controls: [R('mu', 'μ', -1, 1, 0.05, 0), R('sig', 'σ', 0.3, 1.3, 0.01, 0.67)], brk: { label: '推过头：σ=1.3 摊平', params: { mu: 0, sig: 1.3 } } },
      walk: { idea: '每步 ±1 公平抛掷：走得越久，离原点典型距离按 √n 涨，不是按 n 涨。', controls: [R('steps', '步数 n', 4, 24, 1, 12)], brk: { label: '推过头：走 24 步', params: { steps: 24 } } },
    },
    comb: {
      path: { idea: '路径数只认 (m,n)：C(m+n, m)——加一步向右，路径数按杨辉三角的方式跳涨。', controls: [R('m', '向右 m', 1, 6, 1, 4), R('n', '向上 n', 1, 5, 1, 3)], brk: { label: '推过头：6×5 网格', params: { m: 6, n: 5 } } },
      pascal: { idea: '每行由上一行相邻两数相加生出来；整行和每层翻倍 2ⁿ。', controls: [R('rows', '行数', 3, 9, 1, 6)], brk: { label: '推过头：9 行', params: { rows: 9 } } },
    },
    lp: { obj: { idea: '最优不在域内试错，只查顶点：转目标函数的系数，最优点在顶点之间跳。', controls: [R('ca', '系数 a（z=ax+by）', 0, 4, 0.1, 2), R('cb', '系数 b', 0, 4, 0.1, 3)], brk: { label: '临界点：与边平行', params: { ca: 3.1, cb: 2 } } } },
    numth: {
      mod: { idea: '模 n 的乘法是环上的连线：m 与 n 互素才绕得回 1（费马小定理的前提）。', controls: [R('n', '模 n', 5, 13, 1, 7), R('mult', '乘子 m', 2, 8, 1, 3)], brk: { label: '推过头：gcd(m,n)>1', params: { n: 9, mult: 3 } } },
      gcd: { idea: '辗转相除就是把长条反复拿短条量：最后量尽的那格就是 gcd。', controls: [R('ga', '数 a', 4, 36, 1, 12), R('gb', '数 b', 4, 36, 1, 18)], brk: { label: '临界点：互素', params: { ga: 17, gb: 36 } } },
    },
    table: { tan: { idea: 'tanθ 是射线撞上切线 x=1 的高度：θ 越贴近 90°，交点跑得越远。', controls: [R('deg', '角度 θ', 5, 89, 1, 50, '°')], brk: { label: '推过头：θ=88°', params: { deg: 88 } } } },
    exam: { tree: { idea: '分类讨论先定标准再开枝：分支超过 4 条，先怀疑标准选错了。', controls: [R('cases', '分类数', 1, 5, 1, 3)], brk: { label: '推过头：5 类', params: { cases: 5 } } } },
    higher: {
      integral: { idea: '定积分不是公式，是极限：矩形数 n 拉大，误差被 Δx 压小，直到看不见。', controls: [R('n', '矩形数 n', 2, 40, 1, 12)], brk: { label: '推过头：只切 2 刀', params: { n: 2 } } },
      series: { idea: '级数和是部分和的极限：每添一项，与极限的距离减半——还差多少，当场可读。', controls: [R('terms', '项数 n', 1, 14, 1, 7)], brk: { label: '推过头：只取 1 项', params: { terms: 1 } } },
    },
  };
})();
