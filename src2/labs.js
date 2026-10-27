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
    eq: {
      quad: { idea: '因果链：c 上下移动曲线，Δ 的符号决定根的个数——先看图，再背判别式。', controls: [R('a', 'a（开口）', -1, 2, 0.05, 1), R('b', 'b（左右）', -4, 4, 0.1, 0), R('c', 'c（上下）', -5, 2, 0.1, -4)], brk: { label: '推过头：Δ<0', params: { a: 1, b: 0, c: 1 } } },
      cubic: { idea: '三次曲线 y=x³−3px：p 管极值与实根个数，p 一变号，三根变一根。', controls: [R('p', '参数 p', -1, 2, 0.05, 1)], brk: { label: '推过头：p<0', params: { p: -0.6 } } },
      ratio: { idea: '分式函数的骨架是两条渐近线：竖直的管定义域，水平的管值域，根在水平线与曲线的交点处。', controls: [R('aa', '竖直渐近线 a', -1, 2, 0.05, 1), R('hh', '水平渐近线 h', -0.5, 1, 0.05, 0.5)], brk: { label: '推过头：h→0 根逃逸', params: { aa: 1, hh: 0.02 } } },
    },
    set: {
      venn: { idea: '把两个球拉开或合拢，公共元素的个数就是交集的大小。', controls: [R('sep', '圆心半距', 0, 1.1, 0.05, 0.45)], brk: { label: '推过头：完全分开', params: { sep: 1.05 } } },
      union: { idea: '|A∪B| = |A| + |B| − |A∩B|：数一遍图上的点，公式自己会跳出来。', controls: [R('sep', '圆心半距', 0, 1.1, 0.05, 0.45)], brk: { label: '推过头：完全分开', params: { sep: 1.05 } } },
      comp: { idea: '补集先认全集；两球分开时，A∩B 先空掉，∁A 却还在。', controls: [R('sep', '圆心半距', 0, 1.1, 0.05, 0.45)], brk: { label: '推过头：完全分开', params: { sep: 1.05 } } },
    },
    ineq: {
      region: { idea: '不等式区域不用背：拖边界 s 改可行域大小，再拖检验点，x+y 与 s 当场判定进出。', controls: [R('s', '边界 s（x+y≤s）', 1.2, 2.5, 0.05, 2.2), R('tx', '检验点 x', 0, 3, 0.05, 0.8), R('ty', '检验点 y', 0, 2.5, 0.05, 0.7)], brk: { label: '推过头：点越界', params: { s: 2.2, tx: 2.3, ty: 0.8 } } },
      amgm: { idea: '四块面积拼成 (a+b)²：a 与 b 越不相等，中间两块 ab 越“浪费”，差就是 (a−b)²。', controls: [R('a', '边 a', 0.3, 2.6, 0.05, 1.55), R('b', '边 b', 0.3, 2.6, 0.05, 0.85)], brk: { label: '取等点：a=b', params: { a: 1.4, b: 1.4 } } },
      cauchy: { idea: '转动 b：a·b 永远追不上 |a||b|，只在共线时取等，垂直时归零。', controls: [R('ang', 'b 的方向角', 0, 180, 1, 68, '°')], brk: { label: '推过头：转到 90°', params: { ang: 90 } } },
    },
    func: {
      quad: { idea: 'a 管开口与胖瘦，b 管左右，c 管上下；顶点永远站在对称轴上。', controls: [R('a', 'a', -2, 2, 0.1, 1), R('b', 'b', -4, 4, 0.1, -1.9), R('c', 'c', -3, 3, 0.1, -0.9)], brk: { label: '推过头：a<0 翻面', params: { a: -1, b: -1.9, c: -0.9 } } },
      exp: { idea: '底数 a 同时管着指数与对数两条互为反函数的曲线；a<1 时两条一起掉头。', controls: [R('base', '底数 a', 0.3, 3, 0.05, 2)], brk: { label: '推过头：a<1', params: { base: 0.5 } } },
      tick: { idea: '对勾函数的谷底永远在 (√a, 2√a)：a 放大几倍，谷底按 √a 倍挪窝。', controls: [R('a', '参数 a', 0.2, 3, 0.05, 0.7)], brk: { label: '推过头：a=3', params: { a: 3 } } },
      piece: { idea: '分段函数先看分段点：拖动 b，左极限、f(b) 与跳跃量同时重算；再拖探针读任意点的函数值。', controls: [R('bp', '分段点 b', -1, 1, 0.01, 0), R('px', '探针 x', -2, 2.3, 0.05, 1.2)], brk: { label: '临界点：左右接上', params: { bp: -0.63, px: 1.2 } } },
    },
    calc: {
      log: { idea: '对数轴把乘法变位移：探针每右移一格，真数就乘以 10；左移则除以 10。', controls: [R('ex', '指数位置', -2, 2, 0.1, 1)], brk: { label: '推过头：真数 0.01', params: { ex: -2 } } },
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
      cube: { idea: '棱长 a 一变，体积按 a³、表面积按 a²、体对角线按 a 同步缩放——先分清一次、二次、三次增长。', controls: [R('edge', '棱长 a', 1.2, 2.6, 0.05, 2)], brk: { label: '推过头：a=2.6', params: { edge: 2.6 } } },
      para: { idea: '把平行于 AB 的直线向平面滑：距离缩小但仍平行，直到它落进平面，判定前提才失效。', controls: [R('sh', '直线滑移', 0, 2, 0.02, 0)], brk: { label: '推过头：滑进平面', params: { sh: 2 } } },
      perp: { idea: '线面垂直要同时垂直两条相交直线：把竖线倾斜一点，与 AB 的点积立刻不为 0。', controls: [R('tilt', '倾角 θ', -45, 45, 1, 0, '°')], brk: { label: '推过头：倾斜 35°', params: { tilt: 35 } } },
      cut: { idea: '截面不是画出来的，是平面与 6 条棱的交点连出来的；分点 u 滑动，面积当场重算。', controls: [R('u', '分点位置 u', 0.08, 0.92, 0.01, 0.5)], brk: { label: '推过头：u→0.1', params: { u: 0.1 } } },
      angle: { idea: '二面角的平面角由上点高度 h 决定：tanθ=h/AO，h 压到 0，两半平面就合拢。', controls: [R('hh', '上点高度 h', 0.1, 2, 0.02, 2)], brk: { label: '推过头：h→0.15', params: { hh: 0.15 } } },
      ball: { idea: '外接球的直径就是体对角线：棱长 a 放大，R=√3a/2 与球面面积同步放大。', controls: [R('edge', '棱长 a', 1.2, 2.6, 0.05, 2)], brk: { label: '推过头：a=2.6', params: { edge: 2.6 } } },
    },
    vec3: {
      sys: { idea: '坐标不是背出来的：沿棱上的目标点 Q 滑动，它的 (x,y,z) 按建系方向逐项读出。', controls: [R('u', 'Q 在 A₁B₁ 的位置', 0, 1, 0.01, 0.5)], brk: { label: '临界点：Q 到 B₁', params: { u: 1 } } },
      normal: { idea: '法向量靠试探：改第三个分量 k，两个点积同时显示——只当它们同时为 0，n 才成立。', controls: [R('kk', 'n 的第三分量 k', -2, 2, 0.05, -1)], brk: { label: '推过头：k=0.5', params: { kk: 0.5 } } },
      angle: { idea: '二面角不用在图里找平面角：转法向量 n₁，cos⟨n₁,n₂⟩ 当场给出锐二面角。', controls: [R('phi', 'n₁ 倾角 φ', 0, 70, 1, 32, '°')], brk: { label: '推过头：n₁∥n₂', params: { phi: 4 } } } },
    conic: {
      ellipse: { idea: '同一只双锥、同一把刀：倾角 β 与锥半角 α 的大小关系，当场决定截线是哪种曲线。', controls: [R('beta', '截面倾角 β', 8, 82, 1, 66, '°')], brk: { label: '推过头：β<α 裂成双曲线', params: { beta: 15 } } },
      hyperbola: { idea: 'β 比锥半角 α 还小，刀同时捅穿上下两只锥——双曲线的两支是这么来的。', controls: [R('beta', '截面倾角 β', 8, 82, 1, 18, '°')], brk: { label: '推过头：β>α 合成椭圆', params: { beta: 70 } } },
      parabola: { idea: 'β=α 是临界点：刀与母线平行，椭圆被拉开成抛物线；偏一度，类型就变。', controls: [R('beta', '截面倾角 β', 8, 82, 1, 32, '°')], brk: { label: '临界点：β=α', params: { beta: 32 } } },
      cone: { idea: '总览也能预演：先拖 β 看将截得哪种曲线，再切到对应模式验证。', controls: [R('beta', '截面倾角 β', 8, 82, 1, 45, '°')], brk: { label: '推过头：β=15°', params: { beta: 15 } } },
    },
    seq: {
      arith: { idea: '等差 = 把 d 一遍遍加上去：点列必在直线上，d 就是斜率，d 变号点列掉头。', controls: [R('d', '公差 d', -0.4, 0.9, 0.02, 0.42), R('n', '项数 n', 3, 10, 1, 7)], brk: { label: '推过头：d<0', params: { d: -0.3, n: 7 } } },
      geom: { idea: '等比 = 把 q 一遍遍乘上去：|q|>1 爆炸、|q|<1 衰减，先比 |q| 与 1。', controls: [R('q', '公比 q', 0.3, 2, 0.02, 1.42), R('n', '项数 n', 3, 10, 1, 7)], brk: { label: '推过头：q=2', params: { q: 2, n: 7 } } },
      sum: { idea: 'Sₙ 是把每一项叠成柱高：q<1 时柱子有天花板 a₁/(1−q)，q≥1 时没有。', controls: [R('q', '公比 q', 0.3, 1.6, 0.02, 0.72), R('n', '项数 n', 3, 12, 1, 7)], brk: { label: '推过头：q=1.5', params: { q: 1.5, n: 10 } } },
    },
    deriv: {
      tan: { idea: '拖着点 P 沿曲线走：切线斜率 f′(x₀) 在极值点变号——单调性就是这么“摸”出来的。', controls: [R('x0', '切点 x₀', -2.3, 2.3, 0.02, -1.2)], brk: { label: '临界点：拖到极值', params: { x0: 0.99 } } },
      ext: { idea: '极值不是图自己长出来的：改导数一次项 d，极值点 ±√(d/0.96) 出现、移动或消失。', controls: [R('dc', '一次项 d', -0.6, 1.6, 0.02, 0.95)], brk: { label: '推过头：d<0 无极值', params: { dc: -0.3 } } },
      mono: { idea: '单调性探针：把点拖过 ±0.99 两道门槛，f′ 的符号和增减箭头当场翻转。', controls: [R('px', '探针 x', -2.3, 2.3, 0.02, 0.2)], brk: { label: '临界点：探针到极值', params: { px: 0.99 } } },
      surf: { idea: '曲面类型由 y² 系数 k 定：k<0 是马鞍，k>0 合拢成碗；再拖 P 点读两个偏导。', controls: [R('kk', 'y² 系数 k', -1, 1,  0.01, -1), R('px', 'P 的 x', -1.5, 1.5, 0.05, 0.8), R('py', 'P 的 y', -1.5, 1.5, 0.05, 0.4)], brk: { label: '推过头：k=1 成碗', params: { kk: 1, px: 0.8, py: 0.4 } } },
    },
    stat: {
      table: { idea: '列联表不是看某格大小：四格一起决定 ad−bc 与 χ²，越过 3.841 才算有关联证据。', controls: [R('ca', 'a 格', 5, 60, 1, 35), R('cb', 'b 格', 5, 60, 1, 15), R('cc', 'c 格', 5, 60, 1, 15), R('cd', 'd 格', 5, 60, 1, 35)], brk: { label: '推过头：四格独立', params: { ca: 25, cb: 25, cc: 25, cd: 25 } } },
      reg: { idea: '回归直线永远穿过样本中心 (x̄,ȳ)；把相关拖没，线还在，但预测已失效。', controls: [R('r', '相关程度', -0.95, 0.95, 0.01, 0.85)], brk: { label: '推过头：r=0', params: { r: 0 } } },
      spread: { idea: '以平均数为锚把数据拉开：平均数不动，方差按倍数的平方涨。', controls: [R('spread', '伸缩倍数', 0.2, 2.2, 0.05, 1)], brk: { label: '推过头：拉开 2.2 倍', params: { spread: 2.2 } } },
    },
    prob: {
      cond: { idea: '条件概率是“缩小样本空间”：把 B 滑开，交叠面积变，P(B|A) 与 P(A|B) 分开重算。', controls: [R('bx', 'B 的位置', -1.2, 0.8, 0.02, -0.3)], brk: { label: '推过头：B 与 A 错开', params: { bx: 0.8 } } },
      space: { idea: '两枚骰子 36 个点一样可能：目标和越靠中间，凑法越多，概率越大。', controls: [R('sum', '目标和', 2, 12, 1, 7)], brk: { label: '推过头：和=2', params: { sum: 2 } } },
      normal: { idea: 'μ 搬家、σ 胖瘦：曲线怎么变，μ±σ 里永远装着 68.3% 的概率。', controls: [R('mu', 'μ', -1, 1, 0.05, 0), R('sig', 'σ', 0.3, 1.3, 0.01, 0.67)], brk: { label: '推过头：σ=1.3 摊平', params: { mu: 0, sig: 1.3 } } },
      walk: { idea: '每步 ±1 公平抛掷：走得越久，离原点典型距离按 √n 涨，不是按 n 涨。', controls: [R('steps', '步数 n', 4, 24, 1, 12)], brk: { label: '推过头：走 24 步', params: { steps: 24 } } },
    },
    comb: {
      incl: { idea: '容斥的关键是交叠：把两圆拉开，交叠面积减少，并集面积按“两圆和−交叠”同步变。', controls: [R('sep', '圆心半距', 0.2, 1.1, 0.01, 0.55)], brk: { label: '推过头：两圆分开', params: { sep: 1.08 } } },
      path: { idea: '路径数只认 (m,n)：C(m+n, m)——加一步向右，路径数按杨辉三角的方式跳涨。', controls: [R('m', '向右 m', 1, 6, 1, 4), R('n', '向上 n', 1, 5, 1, 3)], brk: { label: '推过头：6×5 网格', params: { m: 6, n: 5 } } },
      pascal: { idea: '每行由上一行相邻两数相加生出来；整行和每层翻倍 2ⁿ。', controls: [R('rows', '行数', 3, 9, 1, 6)], brk: { label: '推过头：9 行', params: { rows: 9 } } },
    },
    lp: {
      region: { idea: '可行域先判进出：拖检验点越过边界，z 再大也不是可行解。', controls: [R('tx', '检验点 x', -0.2, 3.2, 0.05, 1), R('ty', '检验点 y', 0, 2.4, 0.05, 0.8)], brk: { label: '推过头：点出域', params: { tx: 2.8, ty: 2.2 } } },
      int: { idea: '整数最优不是连续最优的四舍五入：改目标系数，最佳整点会在格点之间跳，差距当场显示。', controls: [R('ca', '系数 a（z=ax+by）', 0, 4, 0.1, 2), R('cb', '系数 b', 0, 4, 0.1, 3)], brk: { label: '推过头：偏向 x 轴', params: { ca: 4, cb: 0.5 } } },
      obj: { idea: '最优不在域内试错，只查顶点：转目标函数的系数，最优点在顶点之间跳。', controls: [R('ca', '系数 a（z=ax+by）', 0, 4, 0.1, 2), R('cb', '系数 b', 0, 4, 0.1, 3)], brk: { label: '临界点：与边平行', params: { ca: 3.1, cb: 2 } } } },
    numth: {
      prime: { idea: '素数分布靠计数：把范围 N 拉大，π(N)、最大素数与占比一起变，“越来越稀”被数出来。', controls: [R('up', '范围 N', 10, 60, 1, 46)], brk: { label: '推过头：N=60', params: { up: 60 } } },
      mod: { idea: '模 n 的乘法是环上的连线：m 与 n 互素才绕得回 1（费马小定理的前提）。', controls: [R('n', '模 n', 5, 13, 1, 7), R('mult', '乘子 m', 2, 8, 1, 3)], brk: { label: '推过头：gcd(m,n)>1', params: { n: 9, mult: 3 } } },
      gcd: { idea: '辗转相除就是把长条反复拿短条量：最后量尽的那格就是 gcd。', controls: [R('ga', '数 a', 4, 36, 1, 12), R('gb', '数 b', 4, 36, 1, 18)], brk: { label: '临界点：互素', params: { ga: 17, gb: 36 } } },
    },
    table: {
      unit: { idea: '特殊角靠探针读：转到任意角，横坐标是 cos、纵坐标是 sin，90° 时 tan 的失效也会出现。', controls: [R('deg', '探针角 θ', 0, 90, 5, 45, '°')], brk: { label: '推过头：θ=90°', params: { deg: 90 } } },
      tri: { idea: '三角函数只认角度不认尺度：放大两个特殊三角形，边长变了，sin45° 等比值纹丝不动。', controls: [R('leg', '45°三角形腿', 0.8, 2.4, 0.05, 2), R('short', '30°三角形短边', 0.5, 1.2, 0.02, 1.04)], brk: { label: '尺度实验：缩小一半', params: { leg: 1.2, short: 0.7 } } },
      tan: { idea: 'tanθ 是射线撞上切线 x=1 的高度：θ 越贴近 90°，交点跑得越远。', controls: [R('deg', '角度 θ', 5, 89, 1, 50, '°')], brk: { label: '推过头：θ=88°', params: { deg: 88 } } } },
    exam: {
      stack: { idea: '答题规范可以量化：逐项撤掉“结论、条件、定义域、取等、连接符”，完整度与缺失风险立刻显示。', controls: [R('done', '已写项目数', 0, 5, 1, 5)], brk: { label: '推过头：只写 2 项', params: { done: 2 } } },
      radical: { idea: '嵌套根式靠凑完全平方：改 m，√m−1 这段长度与平方验算同步变，m=4 时直接塌成整数。', controls: [R('m', '参数 m', 2, 4, 0.1, 2)], brk: { label: '临界点：m=4', params: { m: 4 } } },
      tree: { idea: '分类讨论先定标准再开枝：分支超过 4 条，先怀疑标准选错了。', controls: [R('cases', '分类数', 1, 5, 1, 3)], brk: { label: '推过头：5 类', params: { cases: 5 } } } },
    higher: {
      tesseract: { idea: '四维旋转只能看投影：分别转 XW 与 YZ 两个平面，观察内外立方体怎样交换位置感。', controls: [R('wa', 'XW 转角', 0, 360, 2, 0, '°'), R('wz', 'YZ 转角', 0, 360, 2, 0, '°')], brk: { label: '临界视角：XW 90°', params: { wa: 90, wz: 0 } } },
      integral: { idea: '定积分不是公式，是极限：矩形数 n 拉大，误差被 Δx 压小，直到看不见。', controls: [R('n', '矩形数 n', 2, 40, 1, 12)], brk: { label: '推过头：只切 2 刀', params: { n: 2 } } },
      series: { idea: '级数和是部分和的极限：每添一项，与极限的距离减半——还差多少，当场可读。', controls: [R('terms', '项数 n', 1, 14, 1, 7)], brk: { label: '推过头：只取 1 项', params: { terms: 1 } } },
    },
  };
})();
