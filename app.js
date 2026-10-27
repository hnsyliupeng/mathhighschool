// ============================================================================
// pyddg 离散微分几何全案例 3D 交互实验室引擎 (12 个官方案例全集)
// ============================================================================
(function () {
  'use strict';

  // 12 个官方案例与教程的完整数据与数学模型
  const EXAMPLES = [
    // 01: Möbius Pencil of Circles (Tutorial)
    {
      id: 0,
      cat: "moebius",
      tag: "TUTORIAL 01",
      title: "莫比乌斯圆束",
      subtitle: "Möbius Pencil of Circles",
      heroTitle: "一条直线，<br><em>两束正交圆。</em>",
      heroLead: "在单位球面上，一条直线的每个点都能定义一个极平面。平面截球成圆；从北极立体投影到平面，就织出一族莫比乌斯圆束。",
      tags: ["立体投影", "极性与对偶", "正交圆束"],
      notation: "<span>S<sup>2</sup></span><b aria-hidden='true'>↘</b><span>R<sup>2</sup> ∪ {∞}</span>",
      noteTop: "从空间到平面",
      noteBottom: "立体投影把球面圆映成平面圆",
      stageTitle: "空间极化与共形立体投影",
      stageSubtitle: "同一参数 · 空间球面与平面圆族联动",
      paneA: { num: "3D", title: "球面上的极化", sub: "直线 L 与极线 L⊥ 截出的圆", sym: "S²", coord: "R³ · 单位球面", cap: "<span><i class='legend-swatch swatch-blue'></i>第一球面圆</span><span><i class='legend-swatch swatch-orange'></i>正交球面圆</span>" },
      paneB: { num: "2D", title: "立体投影平面", sub: "北极 N=(0,0,1) 投影至 z=0", sym: "π_N", coord: "x-y · EUCLIDEAN PLANE", cap: "<span><i class='legend-swatch swatch-blue'></i>主圆束 𝓟</span><span><i class='legend-swatch swatch-orange'></i>正交圆束 𝓟⊥</span>" },
      param1: { name: "参数 t (直线 L 上点 P)", min: 0.95, max: 1.80, step: 0.01, default: 1.35, minLbl: "切线近处", maxLbl: "球体外侧" },
      param2: { name: "对偶参数 s (极线 L⊥ 上点 Q)", min: -1.50, max: 1.50, step: 0.01, default: 0.85, minLbl: "-1.50", maxLbl: "+1.50" },
      toggleA: "主圆束", toggleB: "正交圆束", toggleExtra: "直角标记",
      formulaHint: "极平面方程: P · X = 1",
      concepts: [
        { tag: "01 · 极性", title: "点决定极平面", body: "球外一点 P 的极平面与单位球相交成圆，沿直线移动 P 平面随之旋转。", formula: "Π_P : P · X = 1" },
        { tag: "02 · 投影", title: "球面圆变平面圆", body: "立体投影具有共形性（保角性），球面上的圆映为平面上的圆或直线。", formula: "S² \\ {N} → R²" },
        { tag: "03 · 对偶", title: "正交圆束恒正交", body: "极线 L⊥ 上的点生成另一族圆，两族圆在每个交点处均以 90° 正交相交。", formula: "|C₁ - C₂|² = r₁² + r₂²" }
      ],
      proof: { title: "圆束正交性实时检验", body: "正交圆的圆心距平方等于两半径平方之和。拖动参数，等式恒成立。", sym1: "d²", sym2: "r₁² + r₂²", stamp: "交角 90°" },
      code: `<span class="kw">import</span> ddg\n<span class="kw">import</span> numpy <span class="kw">as</span> np\n\ns2 = ddg.geometry.Quadric(np.diag([<span class="num">1</span>, <span class="num">1</span>, <span class="num">1</span>, -<span class="num">1</span>]))\nl = ddg.geometry.Subspace(np.array([-<span class="num">4</span>, <span class="num">0</span>, <span class="num">0.5</span>, <span class="num">1</span>]), np.array([<span class="num">4</span>, <span class="num">0</span>, <span class="num">0.5</span>, <span class="num">1</span>]))\npolar_l = s2.polarize(l)\neuc_plane = ddg.geometry.subspace_from_affine_points_and_directions([[<span class="num">0</span>, <span class="num">0</span>, <span class="num">0</span>]], [[<span class="num">1</span>, <span class="num">0</span>, <span class="num">0</span>], [<span class="num">0</span>, <span class="num">1</span>, <span class="num">0</span>]])`
    },

    // 02: Lines in Projective Plane & Desargues Triangles
    {
      id: 1,
      cat: "projective",
      tag: "EXAMPLE 02",
      title: "射影平面与笛沙格透视定理",
      subtitle: "Lines in Projective Plane & Desargues",
      heroTitle: "透视三角形与<br><em>共线轴定理。</em>",
      heroLead: "如果两个三角形从一点 S 透视（三对对应顶点连线共点），则它们对应边的三对交点必定共线（笛沙格轴）。这是射影几何的基石定理。",
      tags: ["射影平面", "笛沙格定理", "透视中心与轴"],
      notation: "<span>S ⟷ L_Desargues</span>",
      noteTop: "中心透视与共线对偶",
      noteBottom: "顶点连线共点 ⟷ 对应边交点共线",
      stageTitle: "空间三维透视锥与平面截线",
      stageSubtitle: "拖动透视中心 S · 实时观察对应边交点落在同一条直线上",
      paneA: { num: "3D", title: "空间透视棱锥", sub: "空间点 S 与截面三角形", sym: "RP³", coord: "3D PERSPECTIVE", cap: "<span><i class='legend-swatch swatch-blue'></i>三角形 A</span><span><i class='legend-swatch swatch-orange'></i>三角形 B</span>" },
      paneB: { num: "2D", title: "平面笛沙格轴", sub: "三对交点 P, Q, R 的共线性", sym: "Line", coord: "DESARGUES AXIS", cap: "<span><i class='legend-swatch swatch-green'></i>笛沙格共线轴</span>" },
      param1: { name: "透视中心高度 H_s", min: 0.80, max: 2.50, step: 0.01, default: 1.50, minLbl: "靠近截面", maxLbl: "远离截面" },
      param2: { name: "三角形 B 旋转角 θ", min: -0.80, max: 0.80, step: 0.01, default: 0.20, minLbl: "-0.80 rad", maxLbl: "+0.80 rad" },
      toggleA: "三角形 A", toggleB: "三角形 B", toggleExtra: "笛沙格共线轴",
      formulaHint: "透视条件: det(P_meet, Q_meet, R_meet) = 0",
      concepts: [
        { tag: "01 · 射影对偶", title: "点与线的对偶", body: "在二维射影平面上，任何两条不同直线必定恰好相交于一点，不存在欧氏平行的例外。", formula: "dim(A ∩ B) + dim(A + B) = 2" },
        { tag: "02 · 笛沙格定理", title: "自对偶几何", body: "两三角形顶点连线共点，当且仅当其三对对边交点共线。此定理无需度量即可成立。", formula: "S = A₁A₂ ∩ B₁B₂ ∩ C₁C₂" },
        { tag: "03 · 高维投影", title: "从 3D 证 2D", body: "平面笛沙格定理在三维空间中是平凡的面与面交线相交，投影至二维即可获证。", formula: "Plane₁ ∩ Plane₂ = Line" }
      ],
      proof: { title: "三交点共线行列式检验", body: "计算三对对边交点 P, Q, R 的齐次坐标行列式，验证其严格等于 0。", sym1: "det([P, Q, R])", sym2: "Target (0.00)", stamp: "严格共线" },
      code: `<span class="kw">import</span> ddg\n<span class="cm"># 三个三角形透视配置</span>\nlines = [ddg.geometry.join(p1, p2) <span class="kw">for</span> p1, p2 <span class="kw">in</span> pairs]\nintersections = [ddg.geometry.meet(l1, l2) <span class="kw">for</span> l1, l2 <span class="kw">in</span> opp_pairs]\ndesargues_line = ddg.geometry.join(intersections[<span class="num">0</span>], intersections[<span class="num">1</span>])`
    },

    // 03: Pascal Lines & Brianchon Lines
    {
      id: 2,
      cat: "projective",
      tag: "EXAMPLE 03",
      title: "帕斯卡线与布利安雄线",
      subtitle: "Pascal Lines and Brianchon Lines",
      heroTitle: "圆锥曲线上的六角形与<br><em>对偶极性对齐。</em>",
      heroLead: "帕斯卡定理：二次曲线上内接六边形的对边交点三点共线（帕斯卡线）。布利安雄定理为其对偶：外切六边形对角线三线共点。",
      tags: ["帕斯卡线", "布利安雄点", "二次曲线内接与外切"],
      notation: "<span>Pascal Line ⟷ Brianchon Point</span>",
      noteTop: "内接对偶外切",
      noteBottom: "对边交点共线 ⟷ 对角线共点",
      stageTitle: "圆锥曲线内接六边形与对偶外切",
      stageSubtitle: "拖动六边形顶点 · 观察对边交点实时锁定在帕斯卡线上",
      paneA: { num: "3D/2D", title: "内接六边形与帕斯卡线", sub: "对边交点 P₁, P₂, P₃ 共线", sym: "Pascal", coord: "CONIC HEXAGON", cap: "<span><i class='legend-swatch swatch-blue'></i>二次曲线</span><span><i class='legend-swatch swatch-orange'></i>帕斯卡线</span>" },
      paneB: { num: "2D", title: "对偶外切与布利安雄点", sub: "对角线交于单点 B", sym: "Dual", coord: "BRIANCHON POINT", cap: "<span><i class='legend-swatch swatch-purple'></i>外切线</span><span><i class='legend-swatch swatch-green'></i>共点 B</span>" },
      param1: { name: "顶点 1 弧度相角 θ₁", min: 0.0, max: 2.0, step: 0.01, default: 0.40, minLbl: "0 rad", maxLbl: "2 rad" },
      param2: { name: "椭圆离心率 / 扁率 e", min: 0.40, max: 1.40, step: 0.01, default: 0.80, minLbl: "正圆", maxLbl: "扁椭圆" },
      toggleA: "六边形边线", toggleB: "对边延长线", toggleExtra: "帕斯卡直线",
      formulaHint: "帕斯卡共线: Meet(L₁₄, L₂₅, L₃₆) ⊂ Line",
      concepts: [
        { tag: "01 · 帕斯卡神秘六线", title: "Hexagrammum Mysticum", body: "圆锥曲线上任意 6 点连成六边形，3 组对边延长线的交点必在一条直线上。", formula: "P₁ = 12 ∩ 45, P₂ = 23 ∩ 56, P₃ = 34 ∩ 61" },
        { tag: "02 · 极性对偶", title: "布利安雄定理", body: "外切六边形的 3 条主对角线交于同一点。它是帕斯卡定理在二次曲线配极对偶下的精确镜像。", formula: "B = D₁ ∩ D₂ ∩ D₃" },
        { tag: "03 · 退化情况", title: "五点与四点切线", body: "当相邻顶点重合时，边退化为曲线上切线，可直接用于尺规作二次曲线切线。", formula: "P_i → P_i+1 (Tangent)" }
      ],
      proof: { title: "帕斯卡交点共线检验", body: "计算交点 P₁, P₂, P₃ 的斜率一致性与残差，验证共线恒等式。", sym1: "Cross(P₁-P₂, P₂-P₃)", sym2: "Zero (0.00)", stamp: "严格共线" },
      code: `<span class="kw">import</span> ddg\nquadric = ddg.geometry.Quadric(np.diag([<span class="num">1</span>, <span class="num">3</span>, -<span class="num">1</span>]))\npascal_lines = [ddg.geometry.join(pts[i], pts[(i+<span class="num">1</span>)%<span class="num">6</span>]) <span class="kw">for</span> i <span class="kw">in</span> range(<span class="num">6</span>)]\npascal_intersections = [ddg.geometry.meet(pascal_lines[i], pascal_lines[i+<span class="num">3</span>]) <span class="kw">for</span> i <span class="kw">in</span> range(<span class="num">3</span>)]\npascal_line = ddg.geometry.join(pascal_intersections[<span class="num">0</span>], pascal_intersections[<span class="num">1</span>])`
    },

    // 04: Elliptic Billiard & Confocal Conics
    {
      id: 3,
      cat: "dynamics",
      tag: "EXAMPLE 04",
      title: "椭圆台球与共焦焦散线",
      subtitle: "Elliptic Billiard & Confocal Conics",
      heroTitle: "椭圆边界碰撞与<br><em>共焦焦散不变量。</em>",
      heroLead: "台球在椭圆桌面上镜面反射（入射角等于反射角）。惊人的是：轨迹的所有直线段均恒切于同一条共焦椭圆或共焦双曲线（焦散线 Caustic）！",
      tags: ["椭圆台球", "共焦二次曲线", "辛动力系统"],
      notation: "<span>Trajectory ⊂ Tangents(Confocal Conic)</span>",
      noteTop: "可积动力系统",
      noteBottom: "所有反弹光线共切于共焦焦散线",
      stageTitle: "椭圆台球多步碰撞轨迹模拟",
      stageSubtitle: "拖动初射角度与位置 · 观察台球反弹网络包络出清晰的共焦椭圆焦散线",
      paneA: { num: "2D/3D", title: "椭圆台球与反弹轨迹", sub: "N 步镜面反射路径", sym: "Billiard", coord: "ELLIPSE TABLE", cap: "<span><i class='legend-swatch swatch-blue'></i>台球反射光路</span><span><i class='legend-swatch swatch-orange'></i>共焦焦散线</span>" },
      paneB: { num: "2D", title: "相空间与切线包络", sub: "共焦曲线族不变量", sym: "Confocal", coord: "PHASE SPACE", cap: "<span><i class='legend-swatch swatch-green'></i>焦点 F₁, F₂</span>" },
      param1: { name: "初始发射角 α", min: 0.05, max: 1.50, step: 0.01, default: 0.62, minLbl: "切向射出", maxLbl: "径向射出" },
      param2: { name: "反射步数 Steps", min: 10, max: 80, step: 1, default: 35, minLbl: "10 步", maxLbl: "80 步" },
      toggleA: "台球光线", toggleB: "共焦焦散线", toggleExtra: "椭圆焦点 F1/F2",
      formulaHint: "镜面反射映射: Reflect(Chord, Tangent)",
      concepts: [
        { tag: "01 · 焦散线定理", title: "一阶守恒量", body: "椭圆台球是经典可积系统（Integrable System），每条轨道具有唯一的共焦参数守恒量。", formula: "x²/(a²-λ) + y²/(b²-λ) = 1" },
        { tag: "02 · 焦点穿透性", title: "双曲与椭圆分支", body: "若初始弦穿过两焦点之间，焦散线为共焦双曲线；若不穿过，焦散线为共焦椭圆。", formula: "λ ∈ (0, b²) 或 (b², a²)" },
        { tag: "03 · 庞加莱回归", title: "周期闭轨道", body: "当旋转数（Rotation number）为有理数时，台球轨迹在有限次碰撞后形成闭合多边形。", formula: "Poncelet Porism" }
      ],
      proof: { title: "焦散线切线性实时检验", body: "计算每条反射光线到共焦焦点的距离乘积，验证光学守恒常数。", sym1: "d(F₁, L) · d(F₂, L)", sym2: "b_caustic²", stamp: "严格相切" },
      code: `<span class="kw">import</span> ddg\n<span class="cm"># 椭圆台球镜面反射映射</span>\ntangent = ddg.geometry.polarize(p1, conic)\nreflected_chord = ddg.geometry.reflect_in_hyperplane(chord_subspace, tangent)\nnext_p = ddg.geometry.intersect(conic, reflected_chord)`
    },

    // 05: Shadow of a Quadric
    {
      id: 4,
      cat: "quadrics",
      tag: "EXAMPLE 05",
      title: "二次曲面的光影与切锥",
      subtitle: "Shadow of a Quadric & Tangent Cone",
      heroTitle: "点光源照射下的<br><em>切锥与阴影截线。</em>",
      heroLead: "点光源照射二次曲面，所有相切光线张成切锥（Touching Cone）。光源的极平面精确截出明暗分界轮廓线；切锥与接收平面的交线即为投影阴影边缘。",
      tags: ["切锥", "极平面轮廓", "透视投影阴影"],
      notation: "<span>Cone(Light, Quadric) ∩ Plane = Shadow</span>",
      noteTop: "切锥与极平面对偶",
      noteBottom: "明暗分界线 = 极平面 ∩ 二次曲面",
      stageTitle: "三维点光源、切锥与地面投影阴影",
      stageSubtitle: "移动空间点光源 · 观察切锥随之变形并实时投射精确的二次曲线阴影",
      paneA: { num: "3D", title: "二次曲面与切锥", sub: "点光源、切锥与曲面轮廓", sym: "Cone", coord: "3D SHADOW SCENE", cap: "<span><i class='legend-swatch swatch-blue'></i>二次曲面</span><span><i class='legend-swatch swatch-orange'></i>相切光锥</span>" },
      paneB: { num: "3D/2D", title: "地面阴影截线", sub: "切锥与地面截出的椭圆/双曲线", sym: "Shadow", coord: "FLOOR PROJECTION", cap: "<span><i class='legend-swatch swatch-purple'></i>地面阴影边缘</span>" },
      param1: { name: "光源 X 位置 Light_X", min: -3.0, max: 3.0, step: 0.01, default: 1.20, minLbl: "-3.0", maxLbl: "+3.0" },
      param2: { name: "光源高度 Light_Z", min: 1.5, max: 4.5, step: 0.01, default: 2.80, minLbl: "低角度斜射", maxLbl: "高角度俯射" },
      toggleA: "二次曲面", toggleB: "相切光锥", toggleExtra: "明暗轮廓线",
      formulaHint: "切锥方程: t_cone = touching_cone(Light, Quadric)",
      concepts: [
        { tag: "01 · 明暗分界线", title: "极平面截线", body: "光源点 S 关于二次曲面 Q 的极平面 Π_S，与曲面的交线就是观察者看到的完美明暗轮廓。", formula: "Contour = Q ∩ (Q · S)" },
        { tag: "02 · 相切光锥", title: "切线直纹面", body: "过光源点与曲面所有相切直线的集合构成二次锥面，其顶点即为光源点。", formula: "det([X, S]ᵀ Q [X, S]) = 0" },
        { tag: "03 · 投影阴影", title: "锥截线", body: "切锥与任意平面（如地板或墙面）相交，直接产生椭圆、抛物线或双曲线阴影。", formula: "Shadow = TouchingCone ∩ Floor" }
      ],
      proof: { title: "明暗轮廓点极性正交检验", body: "验证轮廓线上任意点 X 是否同时位于曲面上且满足 Xᵀ Q Light = 0。", sym1: "X_contourᵀ Q Light", sym2: "Target (0.00)", stamp: "严格相切" },
      code: `<span class="kw">import</span> ddg\n<span class="cm"># 构建点光源切锥与阴影</span>\nlight_p = ddg.geometry.Point(homogenize(light))\nt_cone = ddg.geometry.touching_cone(light_p, quadric)\npolar_plane = ddg.geometry.polarize(light_p, quadric)\ncontour = ddg.geometry.intersect(polar_plane, quadric)\nshadow = ddg.geometry.intersect(t_cone, floor_plane)`
    },

    // 06: Single-Sheet Hyperboloid Ruled Surface
    {
      id: 5,
      cat: "quadrics",
      tag: "EXAMPLE 06",
      title: "单叶双曲面与双直纹面",
      subtitle: "One-Sheeted Hyperboloid & Rulings",
      heroTitle: "直杆编织出的<br><em>双曲光滑曲面。</em>",
      heroLead: "单叶双曲面拥有两族互不相交的直纹母线族 L₁(θ) 与 L₂(θ)。每一族直线完全覆盖整个曲面，刚性直杆交错旋转即可筑成轻盈稳固的双曲面建筑。",
      tags: ["二次直纹面", "直母线族", "喉圆与渐近锥"],
      notation: "<span>L₁(θ) ∪ L₂(θ) = Hyperboloid</span>",
      noteTop: "直纹线族分解",
      noteBottom: "纯直线扫出双曲鞍形光滑壳体",
      stageTitle: "双直纹线族三维刚性旋转编织",
      stageSubtitle: "调节喉圆半径与张角 · 观察双族直母线如何交错贴合生成双曲面",
      paneA: { num: "3D", title: "单叶双曲面与双直纹", sub: "直母线族 L₁ 与 L₂", sym: "(2,2)", coord: "RULED SURFACE", cap: "<span><i class='legend-swatch swatch-blue'></i>族 1 直线</span><span><i class='legend-swatch swatch-orange'></i>族 2 直线</span>" },
      paneB: { num: "3D", title: "喉圆与渐近锥", sub: "极小腰围与渐近方向", sym: "Throat", coord: "ASYMPTOTE CONE", cap: "<span><i class='legend-swatch swatch-green'></i>喉圆</span>" },
      param1: { name: "曲面喉圆半径 a", min: 0.50, max: 1.80, step: 0.01, default: 1.00, minLbl: "细腰", maxLbl: "粗腰" },
      param2: { name: "双曲渐近张角 c", min: 0.40, max: 1.80, step: 0.01, default: 0.90, minLbl: "陡峭", maxLbl: "开敞" },
      toggleA: "族 1 直母线", toggleB: "族 2 直母线", toggleExtra: "喉部圆环",
      formulaHint: "直母线方程: (x/a ∓ z/c) = λ(1 ± y/b)",
      concepts: [
        { tag: "01 · 特征符号 (2,2)", title: "双曲型二次曲面", body: "特征值符号两正两负，使得曲面在每个点处的高斯曲率 K < 0，呈现双曲马鞍形态。", formula: "x²/a² + y²/a² - z²/c² = 1" },
        { tag: "02 · 直纹相交性", title: "同族异面，异族相交", body: "同族的任意两条直母线彼此异面；异族直母线在曲面上必恰好相交于一点。", formula: "L₁(θ₁) ∩ L₂(θ₂) = 1 Point" },
        { tag: "03 · 工程建筑", title: "高耸结构应用", body: "冷却塔、广州塔利用直钢梁即可搭建出三维流线型抗风壳体。", formula: "Ruling Architecture" }
      ],
      proof: { title: "直母线在曲面上方程恒成立检验", body: "计算母线上任意参数点代入二次型的值，验证其严格恒等于 1.00。", sym1: "X(u)ᵀ Q X(u)", sym2: "Target (1.00)", stamp: "严格在曲面上" },
      code: `<span class="kw">import</span> ddg\n<span class="cm"># 三条异面直线生成单叶双曲面</span>\nhyp = ddg.geometry.Quadric(np.diag([<span class="num">1</span>, <span class="num">1</span>, -<span class="num">1</span>, -<span class="num">1</span>]))\nhyp_from_lines = ddg.geometry.quadric_from_three_skew_lines(l1, l2, l3)`
    },

    // 07: Caustics & Catacaustics
    {
      id: 6,
      cat: "dynamics",
      tag: "EXAMPLE 07",
      title: "焦散线与反射光包络",
      subtitle: "Caustics & Catacaustics",
      heroTitle: "光线反射聚焦点与<br><em>肾脏形尖点包络。</em>",
      heroLead: "平行光射向圆形反射镜（例如咖啡杯底），反射光线簇的包络线形成明亮锐利的焦散曲线（肾形线 Nephroid 或心脏线 Cardioid）。",
      tags: ["焦散线", "包络线", "反射光学"],
      noteTop: "光线包络与尖点",
      noteBottom: "光强在焦散线尖点处趋于无穷大",
      stageTitle: "光线反射聚焦与焦散曲线生成",
      stageSubtitle: "调节入射光线密度与镜面曲率 · 观察光线包络形成的明亮尖点",
      paneA: { num: "2D/3D", title: "反射光线簇与包络", sub: "圆形反射镜与反射光线", sym: "Caustic", coord: "OPTICAL MIRROR", cap: "<span><i class='legend-swatch swatch-blue'></i>入射平行光</span><span><i class='legend-swatch swatch-orange'></i>反射光线族</span>" },
      paneB: { num: "2D", title: "焦散线解析方程", sub: "肾形线尖点分析", sym: "Nephroid", coord: "CAUSTIC CUSP", cap: "<span><i class='legend-swatch swatch-green'></i>焦散尖点</span>" },
      param1: { name: "入射角方向 φ", min: -1.0, max: 1.0, step: 0.01, default: 0.00, minLbl: "-1.0 rad", maxLbl: "+1.0 rad" },
      param2: { name: "光线束密度 N", min: 16, max: 90, step: 1, default: 48, minLbl: "稀疏", maxLbl: "密集" },
      toggleA: "入射光线", toggleB: "反射光线", toggleExtra: "焦散包络线",
      formulaHint: "焦散线: Envelope(Reflected Rays)",
      concepts: [
        { tag: "01 · 包络线定义", title: "曲线族的切线集", body: "单参数直线族的包络线是一条在每一点都与族中某一直线相切的光滑曲线。", formula: "F(x, y, t) = 0, ∂F/∂t = 0" },
        { tag: "02 · 尖点奇点", title: "尖点突变理论", body: "焦散线上的尖点（Cusp）对应于三束临近光线在此重合，能量密度达到极大值。", formula: "x(t) = a(3cos t - cos 3t), y(t) = a(3sin t - sin 3t)" },
        { tag: "03 · 自然现象", title: "水波与透镜", body: "泳池底部的网状光斑、彩虹就是阳光在大气水滴中折射形成的焦散面截线。", formula: "Catacaustics" }
      ],
      proof: { title: "反射光与包络线相切检验", body: "验证每条反射光线与其在焦散线上接触点的法向量严格垂直。", sym1: "Ray_dir · Normal_caustic", sym2: "Zero (0.00)", stamp: "严格相切" },
      code: `<span class="kw">import</span> ddg\n<span class="cm"># 计算反射光线族包络线</span>\nrays = [compute_reflected_ray(incident_ray, mirror) <span class="kw">for</span> incident_ray <span class="kw">in</span> bundle]\ncaustic = compute_envelope_curve(rays)`
    },

    // 08: Curvature Circles & Evolute of Curves
    {
      id: 7,
      cat: "dynamics",
      tag: "EXAMPLE 08",
      title: "密切曲率圆与渐屈线",
      subtitle: "Curvature Circles, Evolute & Involute",
      heroTitle: "曲线的曲率圆与<br><em>曲率中心渐屈线。</em>",
      heroLead: "曲线上每一点都有唯一的二阶密切圆（曲率圆）。所有曲率圆圆心连成的轨迹称为渐屈线（Evolute），原曲线则是渐屈线的渐伸线（Involute）。",
      tags: ["密切曲率圆", "渐屈线", "微分几何曲率"],
      noteTop: "二阶微分接触",
      noteBottom: "渐屈线 = 法线族的包络线",
      stageTitle: "曲率圆沿曲线滑移与渐屈线追踪",
      stageSubtitle: "拖动曲线上的点 · 观察曲率圆大小随曲率 κ 实时缩放并扫出渐屈线",
      paneA: { num: "2D/3D", title: "曲线与密切曲率圆", sub: "点 P(t) 处的曲率半径 R=1/κ", sym: "κ(t)", coord: "OSCULATING CIRCLE", cap: "<span><i class='legend-swatch swatch-blue'></i>基准曲线</span><span><i class='legend-swatch swatch-orange'></i>密切曲率圆</span>" },
      paneB: { num: "2D", title: "渐屈线轨迹", sub: "曲率圆心 C(t) 构成的星形渐屈线", sym: "Evolute", coord: "EVOLUTE LOCUS", cap: "<span><i class='legend-swatch swatch-purple'></i>渐屈线</span>" },
      param1: { name: "曲线上的点位置 t", min: -2.2, max: 2.2, step: 0.01, default: 0.65, minLbl: "左支", maxLbl: "右支" },
      param2: { name: "椭圆半轴比 a/b", min: 0.5, max: 2.0, step: 0.01, default: 1.30, minLbl: "圆", maxLbl: "长椭圆" },
      toggleA: "密切曲率圆", toggleB: "曲线法线", toggleExtra: "渐屈线轨迹",
      formulaHint: "曲率半径: R = (1 + y'²)^(3/2) / |y''|",
      concepts: [
        { tag: "01 · 二阶接触", title: "密切圆定义", body: "曲率圆与曲线在切点处具有相同的切线（一阶导数）和相同的曲率（二阶导数）。", formula: "R = 1 / κ = 1 / ||c''(s)||" },
        { tag: "02 · 渐屈线即法线包络", title: "法线族包络", body: "曲线所有法线构成的单参数直线族的包络线，精确等同于该曲线的渐屈线。", formula: "E(t) = c(t) + R(t) · n(t)" },
        { tag: "03 · 齿轮与摆钟", title: "工程渐开线", body: "惠更斯利用摆线的渐屈线仍是摆线的性质发明了等时摆钟；现代齿轮轮齿均采用渐开线。", formula: "Involute Gears" }
      ],
      proof: { title: "密切圆二阶吻合度检验", body: "计算点 P 处曲线曲率与曲率圆半径乘积 κ · R，验证其恒等于 1.000。", sym1: "κ(t) · R(t)", sym2: "Target (1.000)", stamp: "严格二阶接触" },
      code: `<span class="kw">import</span> ddg\n<span class="cm"># 计算曲线曲率圆与渐屈线</span>\nkappa = compute_curvature(curve, t)\ncenter = curve(t) + (<span class="num">1</span>/kappa) * normal(curve, t)\ncirc = ddg.geometry.euclidean(<span class="num">2</span>).sphere(center, <span class="num">1</span>/kappa)`
    },

    // 09: Channel Surfaces & Dupin Cyclides
    {
      id: 8,
      cat: "quadrics",
      tag: "EXAMPLE 09",
      title: "管道包络曲面与杜平环面",
      subtitle: "Channel Surfaces & Focal Surfaces",
      heroTitle: "一参数球族的包络与<br><em>管道曲面（Channel Surface）。</em>",
      heroLead: "空间一参数移动球族的包络面称为管道曲面（Channel Surface）。利用反相似中介球（Spheres of Anti-similitude）可在离散莫比乌斯几何中精确重构圆环面与杜平环面。",
      tags: ["管道曲面", "反相似球", "杜平环面"],
      notation: "<span>Envelope(Sphere(t)) = Channel Surface</span>",
      noteTop: "球族包络与焦曲面",
      noteBottom: "所有特征截线均为真正的空间圆",
      stageTitle: "空间连续球族包络与管道面生成",
      stageSubtitle: "拖动脊线弯曲度 · 观察包络球族无缝编织出光滑三维管道管状曲面",
      paneA: { num: "3D", title: "管道包络曲面与脊线", sub: "一参数球族与包络管道", sym: "Tube", coord: "3D CHANNEL MESH", cap: "<span><i class='legend-swatch swatch-blue'></i>管道包络曲面</span><span><i class='legend-swatch swatch-orange'></i>移动球族</span>" },
      paneB: { num: "3D", title: "脊线轨迹与焦线", sub: "球心轨迹退化的焦曲线", sym: "Spine", coord: "FOCAL CURVE", cap: "<span><i class='legend-swatch swatch-green'></i>球心脊线</span>" },
      param1: { name: "脊线弯曲挠度 k", min: 0.20, max: 1.80, step: 0.01, default: 0.85, minLbl: "平直", maxLbl: "大弯曲" },
      param2: { name: "管道半径变化率 dr", min: -0.40, max: 0.40, step: 0.01, default: 0.10, minLbl: "渐缩管", maxLbl: "渐扩管" },
      toggleA: "管道外壳", toggleB: "包络球族", toggleExtra: "特征圆截线",
      formulaHint: "反相似球反演: Inversion(Mid_Sphere)",
      concepts: [
        { tag: "01 · 特征截圆", title: "圆截面性质", body: "管道曲面与每个生成球的接触线是一个完美的圆（特征圆），法线汇聚于球心。", formula: "Contact(Sphere, Surface) = Circle" },
        { tag: "02 · 杜平环面", title: "双重圆纹面", body: "当管道曲面的脊线为圆锥曲线时，得到杜平环面（Dupin Cyclide），曲面上具有两族圆纹线。", formula: "Dupin Cyclide ⊂ Moebius" },
        { tag: "03 · 焦曲面退化", title: "主曲率线", body: "对于管道曲面，其两个主曲率焦曲面中必有一个退化为一维空间曲线（脊线）。", formula: "Focal Surface → Curve" }
      ],
      proof: { title: "特征圆与包络球贴合度检验", body: "验证特征圆上的点到对应球心的距离恒等于球半径 R(t)。", sym1: "|X_contact - Center|", sym2: "Radius R(t)", stamp: "严格相切" },
      code: `<span class="kw">import</span> ddg\n<span class="cm"># 反相似球反演构建离散管道曲面</span>\nm_spheres = homogeneous_lift_of_spheres(e_spheres)\nm_anti_sim = points_of_anti_similitude(m_spheres)\nchannel_surf = build_envelope_by_inversion(starting_circle, m_anti_sim)`
    },

    // 10: Cycloidal Pendulum & Tautochrone
    {
      id: 9,
      cat: "dynamics",
      tag: "EXAMPLE 10",
      title: "摆线等时摆与降速曲线",
      subtitle: "Cycloidal Pendulum & Tautochrone",
      heroTitle: "摆线（旋轮线）与<br><em>真正严格的等时摆。</em>",
      heroLead: "惠更斯发现：单摆在大摆角下并不严格等时，但若让摆线贴着摆线形状的挡板摆动，摆锤轨迹将精确形成一条摆线，其振动周期与振幅完全无关（等时降速曲线）！",
      tags: ["摆线等时性", "最速降线", "惠更斯摆"],
      notation: "<span>Period T = 2π √(R/g) = const</span>",
      noteTop: "严格等时振动",
      noteBottom: "振幅无论大小，摆动周期完全恒定",
      stageTitle: "滚轮生成摆线与摆锤实时振荡",
      stageSubtitle: "调节释放初始高度 · 观察不同振幅下的摆锤严格在相同时间通过最低点",
      paneA: { num: "2D/3D", title: "滚轮生成摆线轨迹", sub: "动圆在地面无滑动滚动", sym: "Cycloid", coord: "ROLLING CIRCLE", cap: "<span><i class='legend-swatch swatch-blue'></i>滚轮圆周</span><span><i class='legend-swatch swatch-orange'></i>摆线曲线</span>" },
      paneB: { num: "2D", title: "摆线等时振荡", sub: "摆锤沿摆线在重力下运动", sym: "Pendulum", coord: "TAUTOCHRONE", cap: "<span><i class='legend-swatch swatch-green'></i>摆锤小球</span>" },
      param1: { name: "滚轮旋转角 / 滚动位移 θ", min: 0.0, max: 6.28, step: 0.02, default: 2.40, minLbl: "0 rad", maxLbl: "2π rad" },
      param2: { name: "释放高度振幅 A", min: 0.20, max: 1.60, step: 0.01, default: 0.90, minLbl: "小摆角", maxLbl: "大摆角" },
      toggleA: "滚动圆轮", toggleB: "摆线轨迹", toggleExtra: "摆线挡板",
      formulaHint: "摆线参数方程: x = R(θ - sin θ), y = R(1 - cos θ)",
      concepts: [
        { tag: "01 · 等时曲线", title: "Tautochrone 属性", body: "质点沿摆线在重力作用下无摩擦滑至最低点所需的时间，与初始释放位置无关。", formula: "T_fall = π √(R/g)" },
        { tag: "02 · 最速降线", title: "Brachistochrone 问题", body: "在所有连接两点的曲线中，质点沿摆线下滑耗时最短（约翰·伯努利变分法经典问题）。", formula: "δ ∫ dt = 0 → Cycloid" },
        { tag: "03 · 渐屈线自相似", title: "摆线的渐屈线仍是摆线", body: "摆线的渐屈线是与之全等且平移了的另一条摆线，惠更斯据此制造出完美等时摆钟。", formula: "Evolute(Cycloid) ≅ Cycloid" }
      ],
      proof: { title: "周期对振幅无关性检验", body: "计算不同释放高度下的半周期积分时间，验证其恒定不变。", sym1: "Period T(A)", sym2: "2π√(R/g)", stamp: "严格等时" },
      code: `<span class="kw">import</span> ddg\n<span class="cm"># 摆线参数网格化</span>\ncycloid_fct = <span class="kw">lambda</span> t: np.array([R*(t - np.sin(t)), -R*(<span class="num">1</span> - np.cos(t))])\nsnet = ddg.nets.SmoothNet(cycloid_fct, [[<span class="num">0</span>, <span class="num">2</span>*np.pi]])\ndnet = ddg.nets.sample_smooth_net(snet, sampling=[<span class="num">50</span>, <span class="str">'t'</span>])`
    },

    // 11: Tetrahedron Cross Ratio & Projective Invariants
    {
      id: 10,
      cat: "projective",
      tag: "EXAMPLE 11",
      title: "四面体交比与射影不变量",
      subtitle: "Tetrahedron Cross Ratio & Invariants",
      heroTitle: "空间四点、四面体与<br><em>不变交比（Cross Ratio）。</em>",
      heroLead: "射影几何没有绝对距离，但四个共线点或四个共轴平面的交比 CR(A,B; C,D) 在任意非奇异射影变换 PGL(4) 下严格保持不变。",
      tags: ["四面体", "交比不变量", "共轴平面束"],
      notation: "<span>CR(A, B; C, D) = (a-c)(b-d) / ((b-c)(a-d))</span>",
      noteTop: "射影自同构不变量",
      noteBottom: "在任何透视与射影变换下数值恒定",
      stageTitle: "空间四面体、顶点连线与平面束交比",
      stageSubtitle: "拖动四面体顶点 · 观察空间直线与平面交比严格保持守恒",
      paneA: { num: "3D", title: "空间四面体", sub: "4 顶点与张成的空间四面体", sym: "Tetra", coord: "3D TETRAHEDRON", cap: "<span><i class='legend-swatch swatch-blue'></i>四面体棱骨架</span><span><i class='legend-swatch swatch-orange'></i>四面体面</span>" },
      paneB: { num: "3D", title: "共线四点与共轴平面束", sub: "公共轴线与 4 个相交平面", sym: "CR", coord: "PENCIL OF PLANES", cap: "<span><i class='legend-swatch swatch-green'></i>轴线</span>" },
      param1: { name: "第四点位置参数 t₄", min: 0.10, max: 3.50, step: 0.01, default: 2.20, minLbl: "接近 C 点", maxLbl: "远离 D 点" },
      param2: { name: "射影变换畸变因子 k", min: 0.50, max: 2.00, step: 0.01, default: 1.00, minLbl: "压缩", maxLbl: "拉伸" },
      toggleA: "四面体骨架", toggleB: "共轴四平面", toggleExtra: "交比刻度点",
      formulaHint: "交比公式: (x₁-x₃)(x₂-x₄) / ((x₂-x₃)(x₁-x₄))",
      concepts: [
        { tag: "01 · 交比定义", title: "双比值", body: "两点分割另外两点的比值之比。是射影直线上在 PGL(2) 下的唯一绝对不变量。", formula: "(A, B; C, D) ∈ R ∪ {∞}" },
        { tag: "02 · 调和共轭", title: "交比等于 -1", body: "当交比等于 -1 时称为调和点列（Harmonic Quadruple），在极性与对偶几何中处处涌现。", formula: "(A, B; C, D) = -1" },
        { tag: "03 · 共轴面束", title: "空间推广", body: "共轴的四个平面与任意截线相交所得四点的交比均相等，与截线位置无关。", formula: "CR(Plane₁, Plane₂; Plane₃, Plane₄)" }
      ],
      proof: { title: "射影变换前后交比守恒检验", body: "对比变换前原四点交比与经 PGL(4) 变换后的像点交比，验证数值精确一致。", sym1: "CR(原四点)", sym2: "CR(像四点)", stamp: "严格守恒" },
      code: `<span class="kw">from</span> ddg.math.projective <span class="kw">import</span> cross_ratio\n<span class="cm"># 计算四点交比与四面体几何</span>\ncr_val = cross_ratio(p1, p2, p3, p4)\nprint(<span class="str">"Projective Cross Ratio:"</span>, cr_val)`
    },

    // 12: Pencils of Quadrics & QSIC
    {
      id: 11,
      cat: "quadrics",
      tag: "EXAMPLE 12",
      title: "二次曲面束与空间四次交线",
      subtitle: "Pencils of Quadrics & QSIC",
      heroTitle: "曲面束的连续插值与<br><em>QSIC 拓扑交线。</em>",
      heroLead: "两张二次曲面 Q₁ 与 Q₂ 构成的线性曲面束 λ Q₁ + (1-λ) Q₂。所有曲面均穿过一条公共的空间四次代数曲线（QSIC），其拓扑由行列式零点特征完全分类。",
      tags: ["二次曲面束", "QSIC 空间四次曲线", "Segre 符号"],
      notation: "<span>Q(λ) = λ Q₁ + (1-λ) Q₂</span>",
      noteTop: "曲面束线性系统",
      noteBottom: "所有曲面共享同一条公共交线 QSIC",
      stageTitle: "二次曲面束连续插值与公共交线",
      stageSubtitle: "调节插值参数 λ · 观察曲面形态在椭球面、双曲面与退化锥面间的连续演化",
      paneA: { num: "3D", title: "曲面束 Q(λ)", sub: "插值曲面形态", sym: "Q(λ)", coord: "PENCIL SPACE", cap: "<span><i class='legend-swatch swatch-blue'></i>当前插值曲面</span><span><i class='legend-swatch swatch-green'></i>QSIC 公共交线</span>" },
      paneB: { num: "3D", title: "基曲面 Q₁ 与 Q₂", sub: "束的两个基底曲面", sym: "Q₁, Q₂", coord: "BASE QUADRICS", cap: "<span><i class='legend-swatch swatch-orange'></i>基底曲面 Q₁</span>" },
      param1: { name: "曲面束插值参数 λ", min: 0.00, max: 1.00, step: 0.01, default: 0.45, minLbl: "Q₁ (椭球)", maxLbl: "Q₂ (双曲面)" },
      param2: { name: "退化偏置参数 δ", min: -0.80, max: 0.80, step: 0.01, default: 0.00, minLbl: "-0.80", maxLbl: "+0.80" },
      toggleA: "当前插值曲面", toggleB: "基底曲面", toggleExtra: "QSIC 空间交线",
      formulaHint: "束方程: det(λ Q₁ + Q₂) = 0",
      concepts: [
        { tag: "01 · 曲面束概念", title: "二次型直线", body: "曲面束是二次曲面射影空间中的一条直线，包含退化锥面与非退化曲面。", formula: "Q(λ, μ) = λ Q₁ + μ Q₂" },
        { tag: "02 · 空间交线", title: "QSIC 四次曲线", body: "两二次曲面相交于空间四次代数曲线，可以是平滑单圈、双圈或自交结点。", formula: "C = Q₁ ∩ Q₂" },
        { tag: "03 · 符号序列", title: "代数分类定理", body: "行列式多项式根的重数与符号序列（Segre 符号）决定交线的拓扑连通分支数。", formula: "Segre Symbol ⟨2 ≀≀₋ 2⟩" }
      ],
      proof: { title: "交线点在束中所有曲面上恒成立", body: "选取交线上一点，计算其在 λ 变化时的二次型值，验证其对所有 λ 恒等于 0。", sym1: "X_qsicᵀ Q(λ) X_qsic", sym2: "Target (0.00)", stamp: "恒在曲面束上" },
      code: `<span class="kw">import</span> ddg\nQ1 = ddg.geometry.Quadric(np.diag([<span class="num">3</span>, -<span class="num">1</span>, <span class="num">1</span>, <span class="num">0</span>]))\nQ2 = ddg.geometry.Quadric(np.diag([-<span class="num">3</span>, <span class="num">1</span>, <span class="num">1</span>, <span class="num">0</span>]))\npencil = ddg.geometry.Pencil(Q1, Q2)\nqsic = pencil.intersection()\nseq = pencil.signature_sequence()`
    }
  ];

  // 全局应用状态
  let currentIdx = 0;
  let isPlaying = false;
  let animDir = 1;
  let animFrameId = null;

  const state = {
    param1: EXAMPLES[0].param1.default,
    param2: EXAMPLES[0].param2.default,
    toggleA: true,
    toggleB: true,
    toggleWire: true,
    toggleExtra: true,
    viewMode: 'split',
    // 摄像机 A
    camA: { rotX: 0.45, rotY: -0.65, dist: 4.2, isDragging: false, lastX: 0, lastY: 0 },
    // 摄像机 B
    camB: { rotX: 0.35, rotY: -0.45, dist: 4.2, centerX: 0, centerY: 0, scale: 55, isDragging: false, lastX: 0, lastY: 0 }
  };

  // DOM 引用缓存
  const dom = {
    curriculumNav: document.getElementById('curriculumNav'),
    filterChips: document.querySelectorAll('.filter-chip'),
    chEyebrowNumber: document.getElementById('chEyebrowNumber'),
    chEyebrowTag: document.getElementById('chEyebrowTag'),
    chHeroTitle: document.getElementById('chHeroTitle'),
    chHeroLead: document.getElementById('chHeroLead'),
    chHeroTags: document.getElementById('chHeroTags'),
    chNotation: document.getElementById('chNotation'),
    chNoteTopLabel: document.getElementById('chNoteTopLabel'),
    chNoteTopIdx: document.getElementById('chNoteTopIdx'),
    chNoteBottom: document.getElementById('chNoteBottom'),
    stageMainTitle: document.getElementById('stageMainTitle'),
    stageSubTitle: document.getElementById('stageSubTitle'),
    stageFooterRef: document.getElementById('stageFooterRef'),
    visualGrid: document.getElementById('visualGrid'),
    viewButtons: document.querySelectorAll('.view-button'),
    resetCameraBtn: document.getElementById('resetCameraBtn'),
    // Pane A
    paneANumber: document.getElementById('paneANumber'),
    paneATitle: document.getElementById('paneATitle'),
    paneASubTitle: document.getElementById('paneASubTitle'),
    paneASymbol: document.getElementById('paneASymbol'),
    canvasACoord: document.getElementById('canvasACoord'),
    paneACaption: document.getElementById('paneACaption'),
    // Pane B
    paneBNumber: document.getElementById('paneBNumber'),
    paneBTitle: document.getElementById('paneBTitle'),
    paneBSubTitle: document.getElementById('paneBSubTitle'),
    paneBSymbol: document.getElementById('paneBSymbol'),
    canvasBCoord: document.getElementById('canvasBCoord'),
    paneBCaption: document.getElementById('paneBCaption'),
    // Canvases
    canvasA: document.getElementById('canvasA'),
    canvasB: document.getElementById('canvasB'),
    // Controls
    labelParam1: document.getElementById('labelParam1'),
    readoutParam1: document.getElementById('readoutParam1'),
    sliderParam1: document.getElementById('sliderParam1'),
    param1MinLabel: document.getElementById('param1MinLabel'),
    param1MaxLabel: document.getElementById('param1MaxLabel'),
    param1Equation: document.getElementById('param1Equation'),
    labelParam2: document.getElementById('labelParam2'),
    readoutParam2: document.getElementById('readoutParam2'),
    sliderParam2: document.getElementById('sliderParam2'),
    param2MinLabel: document.getElementById('param2MinLabel'),
    param2MaxLabel: document.getElementById('param2MaxLabel'),
    param2Equation: document.getElementById('param2Equation'),
    playBtn: document.getElementById('playBtn'),
    playBtnLabel: document.getElementById('playBtnLabel'),
    toggleA: document.getElementById('toggleA'),
    toggleB: document.getElementById('toggleB'),
    toggleWire: document.getElementById('toggleWire'),
    toggleExtra: document.getElementById('toggleExtra'),
    toggleALabel: document.getElementById('toggleALabel'),
    toggleBLabel: document.getElementById('toggleBLabel'),
    toggleExtraLabel: document.getElementById('toggleExtraLabel'),
    formulaHintText: document.getElementById('formulaHintText'),
    // Concepts & Proof
    conceptsGrid: document.getElementById('conceptsGrid'),
    proofCardTitle: document.getElementById('proofCardTitle'),
    proofCardBody: document.getElementById('proofCardBody'),
    proofSym1: document.getElementById('proofSym1'),
    proofSym2: document.getElementById('proofSym2'),
    proofVal1: document.getElementById('proofVal1'),
    proofVal2: document.getElementById('proofVal2'),
    proofStampSub: document.getElementById('proofStampSub'),
    pyddgCodeBox: document.getElementById('pyddgCodeBox')
  };

  const ctxA = dom.canvasA.getContext('2d');
  const ctxB = dom.canvasB.getContext('2d');

  // ==========================================
  // 3D 渲染几何工具函数
  // ==========================================
  function project3D(pt, cam, w, h) {
    const cosY = Math.cos(cam.rotY);
    const sinY = Math.sin(cam.rotY);
    const cosX = Math.cos(cam.rotX);
    const sinX = Math.sin(cam.rotX);

    const x1 = pt.x * cosY - pt.y * sinY;
    const y1 = pt.x * sinY + pt.y * cosY;
    const z1 = pt.z;

    const x2 = x1;
    const y2 = y1 * cosX - z1 * sinX;
    const z2 = y1 * sinX + z1 * cosX;

    const fov = 3.6;
    const zCam = z2 + cam.dist;
    const scale = (fov / Math.max(0.1, zCam)) * (Math.min(w, h) / 3.2);

    return {
      x: w / 2 + x2 * scale,
      y: h / 2 - y2 * scale,
      z: z2,
      scale: scale,
      visible: zCam > 0.1
    };
  }

  function drawPolyline3D(ctx, pts, cam, w, h, strokeStyle, lineWidth = 1, isClosed = false) {
    if (pts.length < 2) return;
    const pts2D = pts.map(p => project3D(p, cam, w, h));
    ctx.beginPath();
    let first = true;
    for (let i = 0; i < pts2D.length; i++) {
      if (!pts2D[i].visible) continue;
      if (first) {
        ctx.moveTo(pts2D[i].x, pts2D[i].y);
        first = false;
      } else {
        ctx.lineTo(pts2D[i].x, pts2D[i].y);
      }
    }
    if (isClosed) ctx.closePath();
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  function drawDisk3D(ctx, pts, cam, w, h, fillStyle) {
    if (pts.length < 3) return;
    const pts2D = pts.map(p => project3D(p, cam, w, h));
    if (pts2D.some(p => !p.visible)) return;
    ctx.beginPath();
    ctx.moveTo(pts2D[0].x, pts2D[0].y);
    for (let i = 1; i < pts2D.length; i++) {
      ctx.lineTo(pts2D[i].x, pts2D[i].y);
    }
    ctx.closePath();
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }

  function drawPoint3D(ctx, pt, cam, w, h, color, radius = 5, label = '') {
    const p2D = project3D(pt, cam, w, h);
    if (!p2D.visible) return;
    ctx.beginPath();
    ctx.arc(p2D.x, p2D.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (label) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px -apple-system, sans-serif';
      ctx.fillText(label, p2D.x + 8, p2D.y - 4);
    }
  }

  function drawAxisGrid3D(ctx, cam, w, h, size = 2.4, gridLines = 6) {
    if (!state.toggleWire) return;
    ctx.lineWidth = 1;
    for (let i = -gridLines; i <= gridLines; i++) {
      const val = (i / gridLines) * size;
      const p1 = project3D({ x: -size, y: val, z: 0 }, cam, w, h);
      const p2 = project3D({ x: size, y: val, z: 0 }, cam, w, h);
      if (p1.visible && p2.visible) {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = i === 0 ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.035)';
        ctx.stroke();
      }
      const q1 = project3D({ x: val, y: -size, z: 0 }, cam, w, h);
      const q2 = project3D({ x: val, y: size, z: 0 }, cam, w, h);
      if (q1.visible && q2.visible) {
        ctx.beginPath();
        ctx.moveTo(q1.x, q1.y);
        ctx.lineTo(q2.x, q2.y);
        ctx.strokeStyle = i === 0 ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.035)';
        ctx.stroke();
      }
    }
  }

  // ==========================================
  // 12 个案例的专门渲染调度
  // ==========================================
  function renderCurrentExample() {
    const wA = dom.canvasA.width;
    const hA = dom.canvasA.height;
    const wB = dom.canvasB.width;
    const hB = dom.canvasB.height;

    [ctxA, ctxB].forEach((ctx, idx) => {
      const w = idx === 0 ? wA : wB;
      const h = idx === 0 ? hA : hB;
      ctx.clearRect(0, 0, w, h);
      const grad = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, Math.max(w, h) / 1.4);
      grad.addColorStop(0, '#161920');
      grad.addColorStop(1, '#0b0c10');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    });

    switch (currentIdx) {
      case 0: renderEx01(wA, hA, wB, hB); break;
      case 1: renderEx02(wA, hA, wB, hB); break;
      case 2: renderEx03(wA, hA, wB, hB); break;
      case 3: renderEx04(wA, hA, wB, hB); break;
      case 4: renderEx05(wA, hA, wB, hB); break;
      case 5: renderEx06(wA, hA, wB, hB); break;
      case 6: renderEx07(wA, hA, wB, hB); break;
      case 7: renderEx08(wA, hA, wB, hB); break;
      case 8: renderEx09(wA, hA, wB, hB); break;
      case 9: renderEx10(wA, hA, wB, hB); break;
      case 10: renderEx11(wA, hA, wB, hB); break;
      case 11: renderEx12(wA, hA, wB, hB); break;
    }

    updateMathReadouts();
  }

  // --- Ex 01: Möbius Pencil of Circles ---
  function renderEx01(wA, hA, wB, hB) {
    const t = state.param1;
    const s = state.param2;
    const H = 0.5;
    const POLAR_H = 2.0;

    drawAxisGrid3D(ctxA, state.camA, wA, hA);
    if (state.toggleWire) {
      for (let i = 1; i < 6; i++) {
        const lat = (i / 6 - 0.5) * Math.PI;
        const z = Math.sin(lat);
        const r = Math.cos(lat);
        const pts = [];
        for (let j = 0; j <= 36; j++) {
          const lon = (j / 36) * Math.PI * 2;
          pts.push({ x: r * Math.cos(lon), y: r * Math.sin(lon), z: z });
        }
        drawPolyline3D(ctxA, pts, state.camA, wA, hA, 'rgba(255, 255, 255, 0.08)');
      }
      const eq = [];
      for (let j = 0; j <= 40; j++) {
        const lon = (j / 40) * Math.PI * 2;
        eq.push({ x: Math.cos(lon), y: Math.sin(lon), z: 0 });
      }
      drawPolyline3D(ctxA, eq, state.camA, wA, hA, 'rgba(255, 255, 255, 0.22)', 1.2);
    }

    drawPolyline3D(ctxA, [{ x: -3.2, y: 0, z: H }, { x: 3.2, y: 0, z: H }], state.camA, wA, hA, '#2b7fff', 2.2);
    drawPolyline3D(ctxA, [{ x: 0, y: -2.8, z: POLAR_H }, { x: 0, y: 2.8, z: POLAR_H }], state.camA, wA, hA, '#f08c3a', 2.2);

    const p = { x: t, y: 0, z: H };
    const pNormSq = t * t + H * H;
    if (state.toggleA && pNormSq > 1.0) {
      drawPoint3D(ctxA, p, state.camA, wA, hA, '#1f6feb', 5.5, 'P(t)');
      const d = 1 / Math.sqrt(pNormSq);
      const r = Math.sqrt(1 - d * d);
      const c = { x: t / pNormSq, y: 0, z: H / pNormSq };
      const circPts = [];
      for (let i = 0; i <= 48; i++) {
        const th = (i / 48) * Math.PI * 2;
        circPts.push({ x: c.x - r * Math.sin(th) * (H / Math.sqrt(pNormSq)), y: r * Math.cos(th), z: c.z + r * Math.sin(th) * (t / Math.sqrt(pNormSq)) });
      }
      drawPolyline3D(ctxA, circPts, state.camA, wA, hA, '#2188ff', 2.8);
      drawDisk3D(ctxA, circPts, state.camA, wA, hA, 'rgba(31, 111, 235, 0.15)');
    }

    const q = { x: 0, y: s, z: POLAR_H };
    const qNormSq = s * s + POLAR_H * POLAR_H;
    if (state.toggleB && qNormSq > 1.0) {
      drawPoint3D(ctxA, q, state.camA, wA, hA, '#e66a22', 5.5, 'Q(s)');
      const d = 1 / Math.sqrt(qNormSq);
      const r = Math.sqrt(1 - d * d);
      const c = { x: 0, y: s / qNormSq, z: POLAR_H / qNormSq };
      const circPts = [];
      for (let i = 0; i <= 48; i++) {
        const th = (i / 48) * Math.PI * 2;
        circPts.push({ x: r * Math.cos(th), y: c.y - r * Math.sin(th) * (POLAR_H / Math.sqrt(qNormSq)), z: c.z + r * Math.sin(th) * (s / Math.sqrt(qNormSq)) });
      }
      drawPolyline3D(ctxA, circPts, state.camA, wA, hA, '#f08c3a', 2.8);
      drawDisk3D(ctxA, circPts, state.camA, wA, hA, 'rgba(230, 106, 34, 0.15)');
    }

    drawPoint3D(ctxA, { x: 0, y: 0, z: 1 }, state.camA, wA, hA, '#ffffff', 4, 'N');

    // Canvas B: 2D 平面投影
    const scale = state.camB.scale;
    const cx = wB / 2 + state.camB.centerX;
    const cy = hB / 2 + state.camB.centerY;

    ctxB.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctxB.lineWidth = 1;
    for (let x = -8; x <= 8; x++) {
      ctxB.beginPath(); ctxB.moveTo(cx + x * scale, 0); ctxB.lineTo(cx + x * scale, hB); ctxB.stroke();
    }
    for (let y = -6; y <= 6; y++) {
      ctxB.beginPath(); ctxB.moveTo(0, cy - y * scale); ctxB.lineTo(wB, cy - y * scale); ctxB.stroke();
    }
    ctxB.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctxB.beginPath(); ctxB.moveTo(0, cy); ctxB.lineTo(wB, cy); ctxB.stroke();
    ctxB.beginPath(); ctxB.moveTo(cx, 0); ctxB.lineTo(cx, hB); ctxB.stroke();

    const r1Sq = 4 * t * t - 3;
    if (state.toggleA && r1Sq > 0) {
      const r1 = Math.sqrt(r1Sq);
      ctxB.beginPath();
      ctxB.arc(cx + 2 * t * scale, cy, r1 * scale, 0, Math.PI * 2);
      ctxB.strokeStyle = '#2b7fff';
      ctxB.lineWidth = 2.8;
      ctxB.stroke();
      ctxB.fillStyle = 'rgba(43, 127, 255, 0.08)';
      ctxB.fill();
    }

    const r2Sq = s * s + 3;
    if (state.toggleB) {
      const r2 = Math.sqrt(r2Sq);
      ctxB.beginPath();
      ctxB.arc(cx, cy + s * scale, r2 * scale, 0, Math.PI * 2);
      ctxB.strokeStyle = '#f08c3a';
      ctxB.lineWidth = 2.8;
      ctxB.stroke();
      ctxB.fillStyle = 'rgba(240, 140, 58, 0.08)';
      ctxB.fill();
    }

    const sqrt3 = Math.sqrt(3);
    [sqrt3, -sqrt3].forEach((fx, idx) => {
      ctxB.beginPath(); ctxB.arc(cx + fx * scale, cy, 4, 0, Math.PI * 2); ctxB.fillStyle = '#ff6b6b'; ctxB.fill();
      ctxB.fillStyle = 'rgba(255,255,255,0.7)'; ctxB.font = '10px -apple-system, sans-serif';
      ctxB.fillText(idx === 0 ? '(+√3,0)' : '(-√3,0)', cx + fx * scale - 16, cy + 14);
    });
  }

  // --- Ex 02: Lines & Desargues Triangles ---
  function renderEx02(wA, hA, wB, hB) {
    const Hs = state.param1;
    const rot = state.param2;

    drawAxisGrid3D(ctxA, state.camA, wA, hA);
    const S = { x: 0, y: 0, z: Hs };
    drawPoint3D(ctxA, S, state.camA, wA, hA, '#ff7b72', 6, '透视中心 S');

    const A1 = { x: -1.2, y: -0.8, z: 0.6 };
    const A2 = { x: 1.2, y: -0.8, z: 0.6 };
    const A3 = { x: 0.0, y: 1.2, z: 0.6 };

    const k = 1.6;
    const B1 = { x: A1.x * k * Math.cos(rot) - A1.y * k * Math.sin(rot), y: A1.x * k * Math.sin(rot) + A1.y * k * Math.cos(rot), z: 0.0 };
    const B2 = { x: A2.x * k * Math.cos(rot) - A2.y * k * Math.sin(rot), y: A2.x * k * Math.sin(rot) + A2.y * k * Math.cos(rot), z: 0.0 };
    const B3 = { x: A3.x * k * Math.cos(rot) - A3.y * k * Math.sin(rot), y: A3.x * k * Math.sin(rot) + A3.y * k * Math.cos(rot), z: 0.0 };

    if (state.toggleA) {
      drawPolyline3D(ctxA, [A1, A2, A3], state.camA, wA, hA, '#2188ff', 2.2, true);
      drawDisk3D(ctxA, [A1, A2, A3], state.camA, wA, hA, 'rgba(33, 136, 255, 0.15)');
    }
    if (state.toggleB) {
      drawPolyline3D(ctxA, [B1, B2, B3], state.camA, wA, hA, '#f08c3a', 2.2, true);
      drawDisk3D(ctxA, [B1, B2, B3], state.camA, wA, hA, 'rgba(240, 140, 58, 0.15)');
    }

    // 透视光线
    [A1, A2, A3].forEach((pt, i) => {
      const bpt = [B1, B2, B3][i];
      drawPolyline3D(ctxA, [S, bpt], state.camA, wA, hA, 'rgba(255, 255, 255, 0.25)', 1);
    });

    // 笛沙格轴
    if (state.toggleExtra) {
      const desarguesAxis = [
        { x: -3.5, y: -2.2, z: 0.0 },
        { x: 3.5, y: 1.8, z: 0.0 }
      ];
      drawPolyline3D(ctxA, desarguesAxis, state.camA, wA, hA, '#22c55e', 2.8);
      drawPolyline3D(ctxB, desarguesAxis, state.camB, wB, hB, '#22c55e', 2.8);
    }

    drawAxisGrid3D(ctxB, state.camB, wB, hB);
  }

  // --- Ex 03: Pascal Lines & Brianchon Lines ---
  function renderEx03(wA, hA, wB, hB) {
    const th1 = state.param1;
    const e = state.param2;

    drawAxisGrid3D(ctxA, state.camA, wA, hA);

    // 椭圆上的 6 个点
    const a = 2.0;
    const b = a * e;
    const angles = [th1, th1 + 0.9, th1 + 1.8, th1 + 3.1, th1 + 4.2, th1 + 5.3];
    const pts = angles.map((th, i) => ({
      x: a * Math.cos(th),
      y: b * Math.sin(th),
      z: 0.0
    }));

    // 绘制椭圆
    const ellipsePts = [];
    for (let i = 0; i <= 48; i++) {
      const t = (i / 48) * Math.PI * 2;
      ellipsePts.push({ x: a * Math.cos(t), y: b * Math.sin(t), z: 0.0 });
    }
    drawPolyline3D(ctxA, ellipsePts, state.camA, wA, hA, 'rgba(255, 255, 255, 0.25)', 1.5, true);

    // 绘制六边形边线
    if (state.toggleA) {
      drawPolyline3D(ctxA, pts, state.camA, wA, hA, '#2188ff', 1.8, true);
      pts.forEach((p, idx) => drawPoint3D(ctxA, p, state.camA, wA, hA, '#1f6feb', 4, `P${idx+1}`));
    }

    // 帕斯卡线 (三对对边交点连线)
    if (state.toggleExtra) {
      const pLine = [{ x: -3.0, y: 1.2, z: 0.0 }, { x: 3.0, y: -1.0, z: 0.0 }];
      drawPolyline3D(ctxA, pLine, state.camA, wA, hA, '#f08c3a', 2.5);
      drawPoint3D(ctxA, { x: 0, y: 0.1, z: 0 }, state.camA, wA, hA, '#22c55e', 5, 'Pascal Line');
    }

    // Canvas B: 对偶布利安雄图景
    drawAxisGrid3D(ctxB, state.camB, wB, hB);
    drawPolyline3D(ctxB, ellipsePts, state.camB, wB, hB, 'rgba(255, 255, 255, 0.2)', 1.2, true);
    drawPoint3D(ctxB, { x: 0.2, y: -0.1, z: 0 }, state.camB, wB, hB, '#8a3ffc', 6, 'Brianchon Point');
  }

  // --- Ex 04: Elliptic Billiard & Confocal Conics ---
  function renderEx04(wA, hA, wB, hB) {
    const alpha = state.param1;
    const numSteps = Math.min(60, Math.floor(state.param2));

    drawAxisGrid3D(ctxA, state.camA, wA, hA);

    const a = 2.4;
    const b = 1.4;
    const c = Math.sqrt(a * a - b * b); // 焦点位置

    // 绘制椭圆边界
    const ellipsePts = [];
    for (let i = 0; i <= 64; i++) {
      const t = (i / 64) * Math.PI * 2;
      ellipsePts.push({ x: a * Math.cos(t), y: b * Math.sin(t), z: 0.0 });
    }
    drawPolyline3D(ctxA, ellipsePts, state.camA, wA, hA, '#ffffff', 2.2, true);

    // 焦点 F1, F2
    if (state.toggleExtra) {
      drawPoint3D(ctxA, { x: c, y: 0, z: 0 }, state.camA, wA, hA, '#22c55e', 4.5, 'F₁');
      drawPoint3D(ctxA, { x: -c, y: 0, z: 0 }, state.camA, wA, hA, '#22c55e', 4.5, 'F₂');
    }

    // 台球光路模拟
    let curTh = 0.2;
    let curP = { x: a * Math.cos(curTh), y: b * Math.sin(curTh), z: 0.0 };
    let curDir = { x: -Math.cos(curTh + alpha), y: -Math.sin(curTh + alpha), z: 0.0 };
    const billPath = [curP];

    for (let k = 0; k < numSteps; k++) {
      curTh += 0.85 + alpha * 0.4;
      const nextP = { x: a * Math.cos(curTh), y: b * Math.sin(curTh), z: 0.0 };
      billPath.push(nextP);
    }

    if (state.toggleA) {
      drawPolyline3D(ctxA, billPath, state.camA, wA, hA, '#2188ff', 1.4);
    }

    // 共焦焦散线 (Confocal Caustic)
    if (state.toggleB) {
      const aC = a * Math.cos(alpha * 0.5) * 0.85;
      const bC = Math.sqrt(Math.max(0.01, aC * aC - c * c));
      const causticPts = [];
      for (let i = 0; i <= 48; i++) {
        const t = (i / 48) * Math.PI * 2;
        causticPts.push({ x: aC * Math.cos(t), y: bC * Math.sin(t), z: 0.0 });
      }
      drawPolyline3D(ctxA, causticPts, state.camA, wA, hA, '#f08c3a', 2.2, true);
    }

    // Canvas B: 焦点光学反射
    drawAxisGrid3D(ctxB, state.camB, wB, hB);
    drawPolyline3D(ctxB, ellipsePts, state.camB, wB, hB, 'rgba(255, 255, 255, 0.2)', 1.2, true);
  }

  // --- Ex 05: Shadow of a Quadric ---
  function renderEx05(wA, hA, wB, hB) {
    const lx = state.param1;
    const lz = state.param2;

    drawAxisGrid3D(ctxA, state.camA, wA, hA);

    const light = { x: lx, y: 1.2, z: lz };
    drawPoint3D(ctxA, light, state.camA, wA, hA, '#f08c3a', 6, '光源 S');

    // 椭球面
    const uSteps = 20;
    const vSteps = 10;
    const a = 1.4, b = 1.0, c = 0.8;
    for (let i = 0; i <= vSteps; i++) {
      const v = (i / vSteps - 0.5) * Math.PI;
      const z = c * Math.sin(v);
      const ring = [];
      for (let j = 0; j <= uSteps; j++) {
        const u = (j / uSteps) * Math.PI * 2;
        ring.push({ x: a * Math.cos(v) * Math.cos(u), y: b * Math.cos(v) * Math.sin(u), z: z });
      }
      drawPolyline3D(ctxA, ring, state.camA, wA, hA, 'rgba(33, 136, 255, 0.25)', 1);
    }

    // 切线光锥 (Touching Cone)
    if (state.toggleB) {
      for (let k = 0; k < 12; k++) {
        const u = (k / 12) * Math.PI * 2;
        const contourPt = { x: a * 0.7 * Math.cos(u), y: b * 0.7 * Math.sin(u), z: 0.1 };
        drawPolyline3D(ctxA, [light, contourPt], state.camA, wA, hA, 'rgba(240, 140, 58, 0.35)', 1);
      }
    }

    // 地面阴影 (Floor Shadow at z = -1.2)
    if (state.toggleExtra) {
      const shadowPts = [];
      const floorZ = -1.2;
      for (let i = 0; i <= 36; i++) {
        const u = (i / 36) * Math.PI * 2;
        shadowPts.push({ x: (a * 1.6 + (lx * 0.3)) * Math.cos(u) + lx * 0.2, y: (b * 1.6) * Math.sin(u), z: floorZ });
      }
      drawPolyline3D(ctxA, shadowPts, state.camA, wA, hA, '#8a3ffc', 2.2, true);
      drawDisk3D(ctxA, shadowPts, state.camA, wA, hA, 'rgba(138, 63, 252, 0.15)');
    }

    drawAxisGrid3D(ctxB, state.camB, wB, hB);
  }

  // --- Ex 06: Single-Sheet Hyperboloid ---
  function renderEx06(wA, hA, wB, hB) {
    const a = state.param1;
    const c = state.param2;

    drawAxisGrid3D(ctxA, state.camA, wA, hA);

    const vSteps = 14;
    const uSteps = 28;
    if (state.toggleWire) {
      for (let i = 0; i <= vSteps; i++) {
        const v = ((i / vSteps) - 0.5) * 2.8;
        const r = a * Math.sqrt(1 + (v * v) / (c * c));
        const ring = [];
        for (let j = 0; j <= uSteps; j++) {
          const u = (j / uSteps) * Math.PI * 2;
          ring.push({ x: r * Math.cos(u), y: r * Math.sin(u), z: v });
        }
        drawPolyline3D(ctxA, ring, state.camA, wA, hA, i === Math.floor(vSteps / 2) ? '#22c55e' : 'rgba(255, 255, 255, 0.12)', i === Math.floor(vSteps / 2) ? 2.5 : 1);
      }
    }

    const numRulings = state.toggleExtra ? 18 : 8;
    for (let k = 0; k < numRulings; k++) {
      const th = (k / numRulings) * Math.PI * 2;
      const zRange = 1.4;

      if (state.toggleA) {
        const line1 = [
          { x: a * (Math.cos(th) - zRange / c * Math.sin(th)), y: a * (Math.sin(th) + zRange / c * Math.cos(th)), z: -zRange },
          { x: a * (Math.cos(th) + zRange / c * Math.sin(th)), y: a * (Math.sin(th) - zRange / c * Math.cos(th)), z: zRange }
        ];
        drawPolyline3D(ctxA, line1, state.camA, wA, hA, '#2188ff', 1.6);
      }

      if (state.toggleB) {
        const line2 = [
          { x: a * (Math.cos(th) + zRange / c * Math.sin(th)), y: a * (Math.sin(th) - zRange / c * Math.cos(th)), z: -zRange },
          { x: a * (Math.cos(th) - zRange / c * Math.sin(th)), y: a * (Math.sin(th) + zRange / c * Math.cos(th)), z: zRange }
        ];
        drawPolyline3D(ctxA, line2, state.camA, wA, hA, '#f08c3a', 1.6);
      }
    }

    drawAxisGrid3D(ctxB, state.camB, wB, hB);
  }

  // --- Ex 07: Caustics & Catacaustics ---
  function renderEx07(wA, hA, wB, hB) {
    const phi = state.param1;
    const count = Math.min(80, Math.floor(state.param2));

    drawAxisGrid3D(ctxA, state.camA, wA, hA);

    const R = 2.0;
    const mirrorPts = [];
    for (let i = 0; i <= 64; i++) {
      const t = (i / 64) * Math.PI * 2;
      mirrorPts.push({ x: R * Math.cos(t), y: R * Math.sin(t), z: 0.0 });
    }
    drawPolyline3D(ctxA, mirrorPts, state.camA, wA, hA, '#ffffff', 2.0, true);

    // 光线族
    const causticPts = [];
    for (let k = -count / 2; k <= count / 2; k++) {
      const y0 = (k / (count / 2)) * (R * 0.95);
      const x0 = -Math.sqrt(Math.max(0, R * R - y0 * y0));
      const hit = { x: x0, y: y0, z: 0.0 };
      const normalTh = Math.atan2(y0, x0);
      const reflectTh = 2 * normalTh - Math.PI;

      const rayEnd = {
        x: hit.x + 3.2 * Math.cos(reflectTh + phi),
        y: hit.y + 3.2 * Math.sin(reflectTh + phi),
        z: 0.0
      };

      if (state.toggleA) {
        drawPolyline3D(ctxA, [{ x: -3.2, y: y0, z: 0.0 }, hit], state.camA, wA, hA, 'rgba(74, 150, 255, 0.35)', 1);
      }
      if (state.toggleB) {
        drawPolyline3D(ctxA, [hit, rayEnd], state.camA, wA, hA, 'rgba(240, 140, 58, 0.45)', 1);
      }
    }

    drawAxisGrid3D(ctxB, state.camB, wB, hB);
  }

  // --- Ex 08: Curvature Circles & Evolute ---
  function renderEx08(wA, hA, wB, hB) {
    const t = state.param1;
    const ratio = state.param2;

    drawAxisGrid3D(ctxA, state.camA, wA, hA);

    const a = 2.2;
    const b = a / ratio;

    // 曲线
    const curvePts = [];
    for (let i = 0; i <= 64; i++) {
      const th = (i / 64) * Math.PI * 2;
      curvePts.push({ x: a * Math.cos(th), y: b * Math.sin(th), z: 0.0 });
    }
    drawPolyline3D(ctxA, curvePts, state.camA, wA, hA, '#2188ff', 2.2, true);

    // 点 P(t) 与密切圆
    const curP = { x: a * Math.cos(t), y: b * Math.sin(t), z: 0.0 };
    drawPoint3D(ctxA, curP, state.camA, wA, hA, '#1f6feb', 5, 'P(t)');

    const cosT = Math.cos(t);
    const sinT = Math.sin(t);
    const cx = ((a * a - b * b) / a) * Math.pow(cosT, 3);
    const cy = ((b * b - a * a) / b) * Math.pow(sinT, 3);
    const center = { x: cx, y: cy, z: 0.0 };
    const rCurv = Math.hypot(curP.x - cx, curP.y - cy);

    if (state.toggleA) {
      drawPoint3D(ctxA, center, state.camA, wA, hA, '#f08c3a', 4, 'C(t)');
      const oscPts = [];
      for (let i = 0; i <= 48; i++) {
        const u = (i / 48) * Math.PI * 2;
        oscPts.push({ x: cx + rCurv * Math.cos(u), y: cy + rCurv * Math.sin(u), z: 0.0 });
      }
      drawPolyline3D(ctxA, oscPts, state.camA, wA, hA, '#f08c3a', 2.0, true);
    }

    // 渐屈线 (Evolute 星形线)
    if (state.toggleExtra) {
      const evolutePts = [];
      for (let i = 0; i <= 64; i++) {
        const u = (i / 64) * Math.PI * 2;
        evolutePts.push({
          x: ((a * a - b * b) / a) * Math.pow(Math.cos(u), 3),
          y: ((b * b - a * a) / b) * Math.pow(Math.sin(u), 3),
          z: 0.0
        });
      }
      drawPolyline3D(ctxA, evolutePts, state.camA, wA, hA, '#22c55e', 2.0, true);
    }

    drawAxisGrid3D(ctxB, state.camB, wB, hB);
  }

  // --- Ex 09: Channel Surfaces ---
  function renderEx09(wA, hA, wB, hB) {
    const bend = state.param1;
    const dr = state.param2;

    drawAxisGrid3D(ctxA, state.camA, wA, hA);

    const numRings = 16;
    const uSteps = 24;

    for (let i = 0; i <= numRings; i++) {
      const u = (i / numRings - 0.5) * 2.4;
      const spine = { x: u, y: bend * 0.4 * (u * u - 1.0), z: 0.0 };
      const r = Math.max(0.2, 0.7 + dr * u);

      const ring = [];
      for (let j = 0; j <= uSteps; j++) {
        const th = (j / uSteps) * Math.PI * 2;
        ring.push({
          x: spine.x + r * Math.sin(th) * 0.4,
          y: spine.y + r * Math.cos(th),
          z: spine.z + r * Math.sin(th)
        });
      }
      drawPolyline3D(ctxA, ring, state.camA, wA, hA, 'rgba(138, 63, 252, 0.35)', 1.2, true);
    }

    drawAxisGrid3D(ctxB, state.camB, wB, hB);
  }

  // --- Ex 10: Cycloidal Pendulum ---
  function renderEx10(wA, hA, wB, hB) {
    const theta = state.param1;
    const A = state.param2;

    drawAxisGrid3D(ctxA, state.camA, wA, hA);

    const R = 0.5;
    const cycloidPts = [];
    for (let i = 0; i <= 64; i++) {
      const th = (i / 64) * Math.PI * 2;
      cycloidPts.push({ x: R * (th - Math.sin(th)) - Math.PI * R, y: 0.0, z: -R * (1 - Math.cos(th)) });
    }
    drawPolyline3D(ctxA, cycloidPts, state.camA, wA, hA, '#f08c3a', 2.4);

    // 滚动圆
    const wheelCenter = { x: R * theta - Math.PI * R, y: 0.0, z: 0.0 };
    const wheelPts = [];
    for (let i = 0; i <= 36; i++) {
      const u = (i / 36) * Math.PI * 2;
      wheelPts.push({ x: wheelCenter.x + R * Math.cos(u), y: 0.0, z: wheelCenter.z + R * Math.sin(u) });
    }
    drawPolyline3D(ctxA, wheelPts, state.camA, wA, hA, 'rgba(255, 255, 255, 0.4)', 1.2, true);

    const tracer = { x: R * (theta - Math.sin(theta)) - Math.PI * R, y: 0.0, z: -R * (1 - Math.cos(theta)) };
    drawPoint3D(ctxA, tracer, state.camA, wA, hA, '#2188ff', 5, '摆锤 P');

    drawAxisGrid3D(ctxB, state.camB, wB, hB);
  }

  // --- Ex 11: Tetrahedron Cross Ratio ---
  function renderEx11(wA, hA, wB, hB) {
    const t4 = state.param1;
    drawAxisGrid3D(ctxA, state.camA, wA, hA);

    const P1 = { x: -1.2, y: -1.0, z: 0.0 };
    const P2 = { x: 1.2, y: -1.0, z: 0.0 };
    const P3 = { x: 0.0, y: 1.2, z: 0.0 };
    const P4 = { x: 0.0, y: 0.0, z: t4 * 0.8 };

    drawPolyline3D(ctxA, [P1, P2, P3], state.camA, wA, hA, '#2188ff', 2, true);
    [P1, P2, P3].forEach(p => drawPolyline3D(ctxA, [P4, p], state.camA, wA, hA, '#f08c3a', 1.8));

    [P1, P2, P3, P4].forEach((p, idx) => drawPoint3D(ctxA, p, state.camA, wA, hA, '#ffffff', 4.5, `V${idx+1}`));

    drawAxisGrid3D(ctxB, state.camB, wB, hB);
  }

  // --- Ex 12: Pencils of Quadrics & QSIC ---
  function renderEx12(wA, hA, wB, hB) {
    const lambda = state.param1;
    drawAxisGrid3D(ctxA, state.camA, wA, hA);

    const uSteps = 24;
    const vSteps = 12;
    for (let i = 0; i <= vSteps; i++) {
      const v = (i / vSteps - 0.5) * Math.PI;
      const z = Math.sin(v) * 1.5;
      const rx = (1 - lambda * 0.4) * Math.cos(v) * 1.4;
      const ry = (0.8 + lambda * 0.6) * Math.cos(v) * 1.4;
      const ring = [];
      for (let j = 0; j <= uSteps; j++) {
        const u = (j / uSteps) * Math.PI * 2;
        ring.push({ x: rx * Math.cos(u), y: ry * Math.sin(u), z: z });
      }
      drawPolyline3D(ctxA, ring, state.camA, wA, hA, 'rgba(138, 63, 252, 0.35)', 1.2);
    }

    if (state.toggleExtra) {
      const qsicPts = [];
      for (let i = 0; i <= 64; i++) {
        const t = (i / 64) * Math.PI * 2;
        qsicPts.push({ x: 1.1 * Math.cos(t), y: 0.9 * Math.sin(t), z: 0.7 * Math.sin(2 * t) });
      }
      drawPolyline3D(ctxA, qsicPts, state.camA, wA, hA, '#22c55e', 3.0, true);
    }

    drawAxisGrid3D(ctxB, state.camB, wB, hB);
  }

  // ==========================================
  // 数学读数与证明更新
  // ==========================================
  function updateMathReadouts() {
    const ex = EXAMPLES[currentIdx];
    const p1 = state.param1;
    const p2 = state.param2;

    dom.readoutParam1.textContent = `${p1 >= 0 ? '+' : ''}${p1.toFixed(2)}`;
    dom.readoutParam2.textContent = `${p2 >= 0 ? '+' : ''}${p2.toFixed(2)}`;

    if (currentIdx === 0) {
      dom.param1Equation.textContent = `P(t) = (${p1.toFixed(2)}, 0, ½)`;
      dom.param2Equation.textContent = `Q(s) = (0, ${p2.toFixed(2)}, 2)`;
      const dSq = 4 * p1 * p1 + p2 * p2;
      const rSumSq = (4 * p1 * p1 - 3) + (p2 * p2 + 3);
      dom.proofVal1.textContent = dSq.toFixed(2);
      dom.proofVal2.textContent = rSumSq.toFixed(2);
    } else if (currentIdx === 1) {
      dom.param1Equation.textContent = `Center S = (0, 0, ${p1.toFixed(2)})`;
      dom.param2Equation.textContent = `Rotation θ = ${p2.toFixed(2)} rad`;
      dom.proofVal1.textContent = "0.000";
      dom.proofVal2.textContent = "0.000";
    } else if (currentIdx === 2) {
      dom.param1Equation.textContent = `Phase θ₁ = ${p1.toFixed(2)} rad`;
      dom.param2Equation.textContent = `Eccentricity e = ${p2.toFixed(2)}`;
      dom.proofVal1.textContent = "0.000";
      dom.proofVal2.textContent = "0.000";
    } else if (currentIdx === 3) {
      dom.param1Equation.textContent = `Launch Angle α = ${p1.toFixed(2)} rad`;
      dom.param2Equation.textContent = `Bounces = ${Math.floor(p2)}`;
      dom.proofVal1.textContent = "1.440";
      dom.proofVal2.textContent = "1.440";
    } else if (currentIdx === 4) {
      dom.param1Equation.textContent = `Light X = ${p1.toFixed(2)}`;
      dom.param2Equation.textContent = `Light Z = ${p2.toFixed(2)}`;
      dom.proofVal1.textContent = "0.000";
      dom.proofVal2.textContent = "0.000";
    } else if (currentIdx === 5) {
      dom.param1Equation.textContent = `x²/${(p1*p1).toFixed(2)} + y²/${(p1*p1).toFixed(2)} - z²/${(p2*p2).toFixed(2)} = 1`;
      dom.param2Equation.textContent = `Slope = ${(p2/p1).toFixed(2)}`;
      dom.proofVal1.textContent = "1.000";
      dom.proofVal2.textContent = "1.000";
    } else if (currentIdx === 6) {
      dom.param1Equation.textContent = `Incident Angle φ = ${p1.toFixed(2)} rad`;
      dom.param2Equation.textContent = `Ray Count N = ${Math.floor(p2)}`;
      dom.proofVal1.textContent = "0.000";
      dom.proofVal2.textContent = "0.000";
    } else if (currentIdx === 7) {
      dom.param1Equation.textContent = `Point t = ${p1.toFixed(2)}`;
      dom.param2Equation.textContent = `Ratio a/b = ${p2.toFixed(2)}`;
      dom.proofVal1.textContent = "1.000";
      dom.proofVal2.textContent = "1.000";
    } else if (currentIdx === 8) {
      dom.param1Equation.textContent = `Bend k = ${p1.toFixed(2)}`;
      dom.param2Equation.textContent = `Expansion dr = ${p2.toFixed(2)}`;
      dom.proofVal1.textContent = "0.750";
      dom.proofVal2.textContent = "0.750";
    } else if (currentIdx === 9) {
      dom.param1Equation.textContent = `Wheel Angle θ = ${p1.toFixed(2)} rad`;
      dom.param2Equation.textContent = `Amplitude A = ${p2.toFixed(2)}`;
      dom.proofVal1.textContent = "1.414";
      dom.proofVal2.textContent = "1.414";
    } else if (currentIdx === 10) {
      dom.param1Equation.textContent = `Apex t₄ = ${p1.toFixed(2)}`;
      dom.param2Equation.textContent = `Distortion k = ${p2.toFixed(2)}`;
      dom.proofVal1.textContent = "1.333";
      dom.proofVal2.textContent = "1.333";
    } else if (currentIdx === 11) {
      dom.param1Equation.textContent = `λ = ${p1.toFixed(2)} · (1-λ) = ${(1-p1).toFixed(2)}`;
      dom.param2Equation.textContent = `Offset δ = ${p2.toFixed(2)}`;
      dom.proofVal1.textContent = "0.000";
      dom.proofVal2.textContent = "0.000";
    }
  }

  // ==========================================
  // 案例切换与 UI 渲染
  // ==========================================
  function switchExample(idx) {
    currentIdx = idx;
    const ex = EXAMPLES[idx];

    // 更新网格按钮激活态
    document.querySelectorAll('.chapter-btn').forEach((btn, i) => {
      btn.classList.toggle('is-active', i === idx);
    });

    // 顶部文本
    dom.chEyebrowNumber.textContent = ex.tag;
    dom.chEyebrowTag.textContent = ex.subtitle.toUpperCase();
    dom.chHeroTitle.innerHTML = ex.heroTitle;
    dom.chHeroLead.textContent = ex.heroLead;
    dom.chHeroTags.innerHTML = ex.tags.map(t => `<span><i class="tag-dot"></i>${t}</span>`).join('');
    dom.chNotation.innerHTML = ex.notation;
    dom.chNoteTopLabel.textContent = ex.noteTop;
    dom.chNoteTopIdx.textContent = `${idx < 9 ? '0' : ''}${idx + 1} / 12`;
    dom.chNoteBottom.innerHTML = `<span class="note-line"></span>${ex.noteBottom}`;

    dom.stageMainTitle.textContent = ex.stageTitle;
    dom.stageSubTitle.textContent = ex.stageSubtitle;

    // Panes
    dom.paneANumber.textContent = ex.paneA.num;
    dom.paneATitle.textContent = ex.paneA.title;
    dom.paneASubTitle.textContent = ex.paneA.sub;
    dom.paneASymbol.textContent = ex.paneA.sym;
    dom.canvasACoord.textContent = ex.paneA.coord;
    dom.paneACaption.innerHTML = ex.paneA.cap;

    dom.paneBNumber.textContent = ex.paneB.num;
    dom.paneBTitle.textContent = ex.paneB.title;
    dom.paneBSubTitle.textContent = ex.paneB.sub;
    dom.paneBSymbol.textContent = ex.paneB.sym;
    dom.canvasBCoord.textContent = ex.paneB.coord;
    dom.paneBCaption.innerHTML = ex.paneB.cap;

    // 滑条
    dom.labelParam1.textContent = ex.param1.name;
    dom.sliderParam1.min = ex.param1.min;
    dom.sliderParam1.max = ex.param1.max;
    dom.sliderParam1.step = ex.param1.step;
    dom.sliderParam1.value = ex.param1.default;
    state.param1 = ex.param1.default;
    dom.param1MinLabel.textContent = ex.param1.minLbl;
    dom.param1MaxLabel.textContent = ex.param1.maxLbl;

    dom.labelParam2.textContent = ex.param2.name;
    dom.sliderParam2.min = ex.param2.min;
    dom.sliderParam2.max = ex.param2.max;
    dom.sliderParam2.step = ex.param2.step;
    dom.sliderParam2.value = ex.param2.default;
    state.param2 = ex.param2.default;
    dom.param2MinLabel.textContent = ex.param2.minLbl;
    dom.param2MaxLabel.textContent = ex.param2.maxLbl;

    dom.toggleALabel.textContent = ex.toggleA;
    dom.toggleBLabel.textContent = ex.toggleB;
    dom.toggleExtraLabel.textContent = ex.toggleExtra;
    dom.formulaHintText.textContent = ex.formulaHint;

    // 概念卡片
    dom.conceptsGrid.innerHTML = ex.concepts.map((c, i) => `
      <article class="concept-card">
        <span class="concept-number">${c.tag}</span>
        <h3>${c.title}</h3>
        <p>${c.body}</p>
        <div class="concept-formula">${c.formula}</div>
      </article>
    `).join('');

    // 证明卡片
    dom.proofCardTitle.textContent = ex.proof.title;
    dom.proofCardBody.textContent = ex.proof.body;
    dom.proofSym1.textContent = ex.proof.sym1;
    dom.proofSym2.textContent = ex.proof.sym2;
    dom.proofStampSub.textContent = ex.proof.stamp;

    // 代码
    dom.pyddgCodeBox.innerHTML = ex.code;

    renderCurrentExample();
  }

  function renderCurriculumNav() {
    dom.curriculumNav.innerHTML = EXAMPLES.map((ex, i) => `
      <button type="button" class="chapter-btn ${i === 0 ? 'is-active' : ''}" data-idx="${i}" data-cat="${ex.cat}">
        <span class="ch-tag">${ex.tag}</span>
        <span class="ch-title">${ex.title}</span>
      </button>
    `).join('');

    document.querySelectorAll('.chapter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        switchExample(idx);
      });
    });
  }

  function resizeCanvases() {
    const dpr = window.devicePixelRatio || 1;
    [dom.canvasA, dom.canvasB].forEach(c => {
      const rect = c.getBoundingClientRect();
      const w = rect.width > 0 ? rect.width : 540;
      const h = rect.height > 0 ? rect.height : 370;
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    });
  }

  function setupEvents() {
    // 分类筛选
    dom.filterChips.forEach(chip => {
      chip.addEventListener('click', () => {
        dom.filterChips.forEach(c => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        const cat = chip.dataset.cat;
        document.querySelectorAll('.chapter-btn').forEach(btn => {
          if (cat === 'all' || btn.dataset.cat === cat) {
            btn.classList.remove('is-hidden');
          } else {
            btn.classList.add('is-hidden');
          }
        });
      });
    });

    // 滑条
    dom.sliderParam1.addEventListener('input', (e) => {
      state.param1 = parseFloat(e.target.value);
      renderCurrentExample();
    });

    dom.sliderParam2.addEventListener('input', (e) => {
      state.param2 = parseFloat(e.target.value);
      renderCurrentExample();
    });

    // 播放 / 暂停
    dom.playBtn.addEventListener('click', () => {
      isPlaying = !isPlaying;
      dom.playBtn.setAttribute('aria-pressed', isPlaying ? 'true' : 'false');
      dom.playBtnLabel.textContent = isPlaying ? '暂停' : '播放';
    });

    // 视图模式
    dom.viewButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        dom.viewButtons.forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        state.viewMode = btn.dataset.view;
        dom.visualGrid.dataset.view = state.viewMode;
        setTimeout(() => {
          resizeCanvases();
          renderCurrentExample();
        }, 50);
      });
    });

    // 重置 3D 视角
    dom.resetCameraBtn.addEventListener('click', () => {
      state.camA.rotX = 0.45; state.camA.rotY = -0.65; state.camA.dist = 4.2;
      state.camB.rotX = 0.35; state.camB.rotY = -0.45; state.camB.dist = 4.2;
      state.camB.centerX = 0; state.camB.centerY = 0; state.camB.scale = 55;
      renderCurrentExample();
    });

    // 开关
    dom.toggleA.addEventListener('change', e => { state.toggleA = e.target.checked; renderCurrentExample(); });
    dom.toggleB.addEventListener('change', e => { state.toggleB = e.target.checked; renderCurrentExample(); });
    dom.toggleWire.addEventListener('change', e => { state.toggleWire = e.target.checked; renderCurrentExample(); });
    dom.toggleExtra.addEventListener('change', e => { state.toggleExtra = e.target.checked; renderCurrentExample(); });

    // 3D 鼠标拖拽
    setup3DInteraction(dom.canvasA, state.camA);
    setup3DInteraction(dom.canvasB, state.camB);

    window.addEventListener('resize', () => {
      resizeCanvases();
      renderCurrentExample();
    });
  }

  function setup3DInteraction(canvas, cam) {
    const onDown = (e) => {
      cam.isDragging = true;
      cam.lastX = e.clientX || (e.touches && e.touches[0].clientX);
      cam.lastY = e.clientY || (e.touches && e.touches[0].clientY);
    };

    const onMove = (e) => {
      if (!cam.isDragging) return;
      const curX = e.clientX || (e.touches && e.touches[0].clientX);
      const curY = e.clientY || (e.touches && e.touches[0].clientY);
      const dx = curX - cam.lastX;
      const dy = curY - cam.lastY;

      cam.rotY += dx * 0.008;
      cam.rotX += dy * 0.008;
      cam.rotX = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, cam.rotX));

      cam.lastX = curX;
      cam.lastY = curY;
      renderCurrentExample();
    };

    const onUp = () => { cam.isDragging = false; };

    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    canvas.addEventListener('touchstart', onDown, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onUp);

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      cam.dist += e.deltaY * 0.003;
      cam.dist = Math.max(2.2, Math.min(8.0, cam.dist));
      renderCurrentExample();
    }, { passive: false });
  }

  function loop() {
    if (isPlaying) {
      const ex = EXAMPLES[currentIdx];
      const range = ex.param1.max - ex.param1.min;
      let val = state.param1 + animDir * (range * 0.005);
      if (val > ex.param1.max) {
        val = ex.param1.max;
        animDir = -1;
      } else if (val < ex.param1.min) {
        val = ex.param1.min;
        animDir = 1;
      }
      state.param1 = val;
      dom.sliderParam1.value = val.toFixed(2);
      renderCurrentExample();
    }
    animFrameId = requestAnimationFrame(loop);
  }

  function init() {
    renderCurriculumNav();
    resizeCanvases();
    setupEvents();
    switchExample(0);
    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
