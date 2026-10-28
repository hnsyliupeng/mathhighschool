export interface DerivationStep { title: string; text: string; formula?: string; note?: string }
export interface TheoryChapter { id:string; number:string; title:string; english:string; pages:string; intro:string; steps:DerivationStep[]; caveat?:string }

export const theory: TheoryChapter[] = [
  {
    id:'framework', number:'01', title:'从能量到动力学', english:'THE NUMERICAL FRAMEWORK', pages:'论文 pp. 12–19',
    intro:'DDG 先离散几何，再构造能量。对能量求导得到内力，对内力线性化得到 Newton 迭代所需的切线矩阵。',
    steps:[
      {title:'1. 选择自由度并装配能量', text:'将所有节点位置（必要时加上边的转角）排列为广义坐标。单元的能量按连接关系装配到全局。', formula:'\\mathbf q=(\\mathbf x_1,\\ldots,\\mathbf x_N,\\theta_1,\\ldots)^\\mathsf T,\\qquad E(\\mathbf q)=\\sum_e E_e(\\mathbf q_e)'},
      {title:'2. 由变分定义力与刚度', text:'保守内力等于势能的负梯度；能量 Hessian 是切线刚度。注意力 Jacobian 等于刚度的负值。', formula:'\\mathbf f_{\\rm int}=-\\nabla_{\\mathbf q}E,\\qquad \\mathbf K=\\nabla^2_{\\mathbf q}E=-\\frac{\\partial\\mathbf f_{\\rm int}}{\\partial\\mathbf q}'},
      {title:'3. 代入运动方程', text:'M 是集中质量矩阵；论文常用 C = μM。外力可以包含重力、压力、磁力或接触力。', formula:'\\mathbf M\\ddot{\\mathbf q}+\\mathbf C\\dot{\\mathbf q}+\\nabla E(\\mathbf q)-\\mathbf f_{\\rm ext}=\\mathbf 0'},
      {title:'4. 隐式 Euler 离散', text:'在 tₙ₊₁ 评价力，令 vₙ₊₁=(qₙ₊₁−qₙ)/Δt，得到以下关于新位置的非线性残差。', formula:'\\mathbf R(\\mathbf q)=\\frac{\\mathbf M}{\\Delta t^2}(\\mathbf q-\\mathbf q_n-\\Delta t\\mathbf v_n)+\\frac{\\mathbf C}{\\Delta t}(\\mathbf q-\\mathbf q_n)+\\nabla E(\\mathbf q)-\\mathbf f_{n+1}'},
      {title:'5. Newton 迭代与约束', text:'只对自由自由度求解；固定自由度预先赋值。外力若依赖位置，其导数也必须进入 Jacobian。迭代直至残差满足容差。', formula:'\\mathbf J\\Delta\\mathbf q=-\\mathbf R,\\quad \\mathbf q^{k+1}=\\mathbf q^k+\\Delta\\mathbf q,\\quad \\mathbf J=\\frac{\\mathbf M}{\\Delta t^2}+\\frac{\\mathbf C}{\\Delta t}+\\mathbf K-\\frac{\\partial\\mathbf f_{\\rm ext}}{\\partial\\mathbf q}'}
    ], caveat:'单/多自由度、平面梁、重力柔性网、超弹性索和膜、磁驱梁及流体阻力例使用数值求解；受压梁和轴对称线弹性壳采用准静态 Newton。其余可视化明确标为约束近似；数值求解不等于全参数验证。'
  },
  {
    id:'planar', number:'02', title:'平面梁：伸长与弯曲', english:'DISCRETE PLANAR CURVE', pages:'论文 pp. 20–25',
    intro:'相邻节点定义一条边，两条连续边定义一个弯曲单元。这里的上横线表示参考构型。',
    steps:[
      {title:'1. 边与轴向应变', text:'对于边 e = x₂−x₁，长度改变除以参考长度得到工程应变。', formula:'\\mathbf e=\\mathbf x_2-\\mathbf x_1,\\quad \\ell=\\lVert\\mathbf e\\rVert,\\quad \\epsilon=\\frac{\\ell-\\bar\\ell}{\\bar\\ell}'},
      {title:'2. 伸长能与精确梯度', text:'将一维线弹性能密度沿参考边积分；链式法则给出沿切线方向的力。', formula:'E_s=\\frac{EA}{2\\bar\\ell}(\\ell-\\bar\\ell)^2,\\quad \\frac{\\partial E_s}{\\partial\\mathbf x_2}=EA\\left(\\frac{\\ell}{\\bar\\ell}-1\\right)\\frac{\\mathbf e}{\\ell},\\quad \\frac{\\partial E_s}{\\partial\\mathbf x_1}=-\\frac{\\partial E_s}{\\partial\\mathbf x_2}'},
      {title:'3. 离散曲率', text:'相邻切线的有向夹角为 φ，Voronoi 长度取两边长度的平均值。转角趋于零时，2 tan(φ/2)≈φ。', formula:'\\ell_v=\\tfrac12(\\ell_1+\\ell_2),\\quad \\kappa=\\frac{2\\tan(\\phi/2)}{\\ell_v},\\quad \\phi=\\operatorname{atan2}(\\mathbf e_1\\times\\mathbf e_2,\\mathbf e_1\\cdot\\mathbf e_2)'},
      {title:'4. 弯曲能', text:'连续梁的 ½EI(κ−κ̄)² 对参考长度积分。程序中的平面梁使用参考长度和积分转角作为离散变量。', formula:'E_b=\\tfrac12 EI(\\kappa-\\bar\\kappa)^2\\bar\\ell_v,\\qquad E_b^{\\rm code}=\\frac{EI}{2\\bar\\ell_v}(\\beta-\\bar\\beta)^2,\\quad \\beta=2\\tan(\\phi/2)'},
      {title:'5. 链式法则与几何非线性', text:'将 β 对转角和节点位置求导后装配。参考构型长度固定时，此梯度可用中心差分逐分量检验。', formula:'\\nabla_{\\mathbf q}E_b=\\frac{EI}{\\bar\\ell_v}(\\beta-\\bar\\beta)\\left(1+\\frac{\\beta^2}{4}\\right)\\nabla_{\\mathbf q}\\phi'},
      {title:'6. 转角梯度', text:'记 e=x₁−x₀、f=x₂−x₁。由 φ=arg f−arg e 可得到两个局部边向量的导数，再通过边到节点的映射装配。', formula:'\\mathbf g_e=\\frac{(e_y,-e_x)}{\\lVert\\mathbf e\\rVert^2},\\quad \\mathbf g_f=\\frac{(-f_y,f_x)}{\\lVert\\mathbf f\\rVert^2},\\quad \\nabla_{\\mathbf q}\\phi=(-\\mathbf g_e,\\mathbf g_e-\\mathbf g_f,\\mathbf g_f)'},
      {title:'7. 精确弯曲 Hessian', text:'对转角再次求导。令 β′=1+β²/4、β″=(β/2)β′，通过链式法则得到对称切线刚度；实现与梯度差分及平移零模相互检查。', formula:'\\nabla^2 E_b=\\frac{EI}{\\bar\\ell_v}\\left[\\left((\\beta^{\\prime})^2+(\\beta-\\bar\\beta)\\beta^{\\prime\\prime}\\right)\\nabla\\phi\\,\\nabla\\phi^\\mathsf T+(\\beta-\\bar\\beta)\\beta^{\\prime}\\nabla^2\\phi\\right]'},
      {title:'8. 原脚本 Jacobian 与兼容迭代', text:'原 MATLAB 弯曲代码在列向量内积后发生标量广播；所得 Newton 矩阵与力的精确 Hessian 不同。工作台采用精确 Hessian 和线搜索；验证中心另按原矩阵、原迭代顺序回放，且保留达到迭代上限的提示。', formula:'\\mathbf J_{\\rm source}\\neq\\nabla^2E_b,\\qquad \\mathbf J_{\\rm exact}=\\nabla^2E_b'},
      {title:'9. 固支与加载路径', text:'固支的两个节点分别消除位移和转角；将给定位移写入受约束自由度，仅对自由自由度求平衡。屈曲例采用准静态平衡，跃迁例保留惯性。', formula:'\\mathbf q_c=\\widehat{\\mathbf q}_c(t),\\quad \\left[\\nabla E(\\mathbf q)-\\mathbf f_{\\rm ext}\\right]_f=\\mathbf 0'},
      {title:'10. 截面与小挠度极限', text:'圆截面 A 与 I 给出拉伸、弯曲刚度；小载荷下可用 Euler–Bernoulli 悬臂梁解检查离散模型。', formula:'A=\\pi r^2,\\quad I=\\frac{\\pi r^4}{4},\\quad \\delta_{\\rm tip}=\\frac{F L^3}{3EI}\\quad(\\text{end load})'}
    ], caveat:'论文公式 (4.12–4.13) 以当前 Voronoi 长度写曲率；随附 MATLAB 的弯曲单元以参考长度和积分曲率实施。这里注明两种写法，避免把它们在大伸长下视为完全相同。跃迁在严格 2 μm 阈值下与原迭代轨迹不一致；兼容回放用于定位算法差异，不能证明原迭代每步都充分收敛。'
  },
  {
    id:'rod', number:'03', title:'空间杆：标架、弯曲与扭转', english:'DISCRETE ELASTIC RODS', pages:'论文 pp. 26–34',
    intro:'三维杆不仅需要节点坐标，还需要每条边绕切线的材料转角，以表达截面方向与扭转。',
    steps:[
      {title:'1. 参考标架与材料标架', text:'d₃ 与边切线重合，材料标架相对参考标架绕切线旋转 θ。', formula:'\\mathbf m_1=\\mathbf d_1\\cos\\theta+\\mathbf d_2\\sin\\theta,\\quad \\mathbf m_2=\\mathbf d_2\\cos\\theta-\\mathbf d_1\\sin\\theta'},
      {title:'2. 最短旋转与平行运输', text:'先把前边参考标架沿最短球面路径运输到后边切线；叉积矩阵 [v]× 满足 [v]×w=v×w。反向平行时路径不唯一，不能直接使用该式。', formula:'\\mathbf v=\\mathbf t_e\\times\\mathbf t_f,\\quad c=\\mathbf t_e\\cdot\\mathbf t_f,\\quad \\mathbf R=\\mathbf I+[\\mathbf v]_\\times+\\frac{[\\mathbf v]_\\times^2}{1+c},\\quad \\mathbf d_{1f}=\\mathbf R\\mathbf d_{1e}'},
      {title:'3. 曲率副法向', text:'由相邻边的叉积和点积构造积分曲率向量；反向平行边会使分母趋零，应避免退化构型。', formula:'\\boldsymbol\\kappa_b=\\frac{2\\,\\mathbf e\\times\\mathbf f}{\\lVert\\mathbf e\\rVert\\lVert\\mathbf f\\rVert+\\mathbf e\\cdot\\mathbf f}'},
      {title:'4. 材料方向的积分曲率', text:'原始 MATLAB 单元直接把副法向投影到材料标架平均方向，得到积分曲率 K₁、K₂；其自然值来自初始构型。', formula:'K_1=\\tfrac12\\boldsymbol\\kappa_b\\cdot(\\mathbf m_{2e}+\\mathbf m_{2f}),\\quad K_2=-\\tfrac12\\boldsymbol\\kappa_b\\cdot(\\mathbf m_{1e}+\\mathbf m_{1f})'},
      {title:'5. 从积分曲率到曲率密度', text:'若取当前 Voronoi 长度，曲率密度 κₐ=Kₐ/ℓᵥ；与源单元使用参考长度计算能量的写法，在长度变化时不应无条件等同。', formula:'\\ell_v=\\tfrac12(\\lVert\\mathbf e\\rVert+\\lVert\\mathbf f\\rVert),\\quad \\kappa_a=K_a/\\ell_v,\\quad E_b^{\\rm source}=\\frac{EI}{2\\bar\\ell_v}\\lVert\\mathbf K-\\bar{\\mathbf K}\\rVert^2'},
      {title:'6. 材料转角导数', text:'固定节点和参考标架，仅改变一条边的材料转角：∂θm₁=m₂、∂θm₂=−m₁，再用链式法则得到弯曲能对转角的梯度；另一边同理。', formula:'\\frac{\\partial K_1}{\\partial\\theta_e}=-\\tfrac12\\boldsymbol\\kappa_b\\cdot\\mathbf m_{1e},\\quad \\frac{\\partial K_2}{\\partial\\theta_e}=-\\tfrac12\\boldsymbol\\kappa_b\\cdot\\mathbf m_{2e},\\quad \\frac{\\partial E_b}{\\partial\\theta_e}=\\frac{EI}{\\bar\\ell_v}\\sum_a(K_a-\\bar K_a)\\frac{\\partial K_a}{\\partial\\theta_e}'},
      {title:'7. 积分扭转与能量', text:'实际时程中参考扭转需要随历史标架运输更新；源算例的自然扭转取零，示意实验固定参考扭转为零。', formula:'m=\\theta_f-\\theta_e+m_{\\rm ref},\\quad E_t=\\frac{GJ}{2\\bar\\ell_v}m^2,\\quad \\frac{\\partial E_t}{\\partial\\theta_e}=-\\frac{GJ}{\\bar\\ell_v}m,\\quad \\frac{\\partial E_t}{\\partial\\theta_f}=\\frac{GJ}{\\bar\\ell_v}m'}
    ], caveat:'上方局部几何实验及材料转角梯度已与原脚本三个局部样本对照；它不含节点力、完整 Hessian 或历史标架更新。工作台的空间杆仍是约束近似，不是完整空间杆动力学求解器。'
  },
  {
    id:'axis', number:'04', title:'轴对称壳：从母线到曲面', english:'AXISYMMETRIC SHELLS', pages:'论文 pp. 35–41',
    intro:'用平面母线 (r,z) 生成旋转曲面；源脚本的线弹性壳同时包含子午和环向应变、两种曲率及泊松耦合。',
    steps:[
      {title:'1. 参考环带和两个方向的应变', text:'边端半径的平均值为 r，参考环带面积固定为 S̄。子午方向使用边长变化，环向使用半径变化。', formula:'\\bar r=(\\bar r_i+\\bar r_{i+1})/2,\\quad \\bar S=2\\pi\\bar r\\bar\\ell,\\quad \\epsilon_s=\\ell/\\bar\\ell-1,\\quad \\epsilon_\\theta=r/\\bar r-1'},
      {title:'2. 平面应力膜能', text:'E 是杨氏模量，h 是厚度，ν 是泊松比。原代码先将 Eh/(1−ν²) 记为 EA，再与参考环带面积相乘。', formula:'EA=\\frac{Eh}{1-\\nu^2},\\qquad E_s=\\frac{EA\\bar S}{2}(\\epsilon_s^2+2\\nu\\epsilon_s\\epsilon_\\theta+\\epsilon_\\theta^2)'},
      {title:'3. 伸长梯度', text:'令局部节点自由度依次为 (rₐ,zₐ,rᵦ,zᵦ)，t 是当前边单位切线。分别对边长和平均半径求导，再使用链式法则。', formula:'\\mathbf g_s=\\frac{(-t_r,-t_z,t_r,t_z)^\\mathsf T}{\\bar\\ell},\\quad \\mathbf g_\\theta=\\frac{(1,0,1,0)^\\mathsf T}{2\\bar r},\\quad \\nabla E_s=EA\\bar S[(\\epsilon_s+\\nu\\epsilon_\\theta)\\mathbf g_s+(\\epsilon_\\theta+\\nu\\epsilon_s)\\mathbf g_\\theta]'},
      {title:'4. 伸长切线矩阵', text:'环向应变是节点半径的线性函数，因此 Hessian 为零；子午应变的 Hessian 则包含切线变化，即几何刚度。', formula:'\\nabla^2E_s=EA\\bar S[\\mathbf g_s\\mathbf g_s^\\mathsf T+\\mathbf g_\\theta\\mathbf g_\\theta^\\mathsf T+\\nu(\\mathbf g_s\\mathbf g_\\theta^\\mathsf T+\\mathbf g_\\theta\\mathbf g_s^\\mathsf T)+(\\epsilon_s+\\nu\\epsilon_\\theta)\\nabla^2\\epsilon_s]'},
      {title:'5. 两个离散主曲率', text:'相邻母线边的切线为 t₁、t₂；参考 Voronoi 长度为两条参考边长的平均值，t 为切线平均。以下符号与源代码的 (r,z) 次序一致。', formula:'\\mathbf t=(\\mathbf t_1+\\mathbf t_2)/2,\\quad \\kappa_s=\\frac{2(\\mathbf t_1\\times\\mathbf t_2)}{\\bar\\ell_v(1+\\mathbf t_1\\cdot\\mathbf t_2)},\\quad \\kappa_\\theta=\\frac{t_z}{r_i\\lVert\\mathbf t\\rVert}'},
      {title:'6. 自然曲率与弯曲能', text:'在初始母线上计算 κ̄ₛ、κ̄θ，参考曲面可为平板或球冠；弯曲环带半径取初始中间节点半径。', formula:'D=\\frac{Eh^3}{12(1-\\nu^2)},\\quad \\bar S_v=2\\pi\\bar r_i\\bar\\ell_v,\\quad E_b=\\frac{D\\bar S_v}{2}(\\Delta\\kappa_s^2+2\\nu\\Delta\\kappa_s\\Delta\\kappa_\\theta+\\Delta\\kappa_\\theta^2)'},
      {title:'7. 弯曲力与精确 Hessian', text:'令 gᵢ=∇κᵢ、Hᵢ=∇²κᵢ，a₁=Δκₛ+νΔκθ、a₂=Δκθ+νΔκₛ。实现使用二阶前向自动微分计算曲率导数，再按下式装配；并以中心差分检查。', formula:'\\nabla E_b=D\\bar S_v(a_1\\mathbf g_1+a_2\\mathbf g_2),\\quad \\nabla^2E_b=D\\bar S_v[\\mathbf g_1\\mathbf g_1^\\mathsf T+\\mathbf g_2\\mathbf g_2^\\mathsf T+\\nu(\\mathbf g_1\\mathbf g_2^\\mathsf T+\\mathbf g_2\\mathbf g_1^\\mathsf T)+a_1\\mathbf H_1+a_2\\mathbf H_2]'},
      {title:'8. 平板的显式随形压力', text:'每步压力增加 10000Δt Pa；法向、边长和半径取上一构型，所以压力 Jacobian 为零。中心半径在源网格中为 10⁻⁴ m，用来避免极轴除零。', formula:'\\mathbf f_{p,a}=\\mathbf f_{p,b}=\\tfrac12\\pi(r_a^n+r_b^n)P_{n+1}(-\\Delta z^n,\\Delta r^n),\\quad P_{n+1}=P_n+10000\\Delta t'},
      {title:'9. 静态平衡与球冠反力', text:'两例均不含惯性；位移控制先更新前两个节点的 z，再对自由自由度求平衡。球冠反力为这两个受控轴向自由度内力之和。', formula:'[\\nabla(E_s+E_b)-\\mathbf f_p]_f=0,\\quad q_{1z},q_{2z}\\mathrel{-}=0.1\\Delta t,\\quad F_{\\rm react}=-(\\partial_{z_1}E+\\partial_{z_2}E)'},
      {title:'10. 分支与数值验证', text:'球冠在极限点附近可发生静态分支切换；工作台在常规 Newton 失败后搜索下分支，并仅接受残差满足容差的平衡点。参考脚本的未收敛迭代与工作台结果必须分开报告。', formula:'\\mathbf K_{ff}\\Delta\\mathbf q_f=-\\mathbf R_f,\\qquad \\lVert\\mathbf R_f\\rVert<10^{-5}\\ {\\rm N}'}
    ], caveat:'线弹性轴对称壳是准静态模型；分支跳转并非瞬态动力学。默认充气盘末态最大母线工程应变约 41.5%，线性材料在大应变下的适用性需要独立评估。独立球冠参考未覆盖翻转；以工作台状态启动的临界条件窗口与原脚本不一致，且原脚本多次触及迭代上限，不能据此宣称临界力已验证。超弹性环面膜使用不同本构（第 07 章）。'
  },
  {
    id:'surface', number:'05', title:'三角网格与离散壳', english:'TRIANGULATED SURFACES', pages:'论文 pp. 41–48',
    intro:'以三角面片表示曲面，边的伸长与相邻三角形法向的变化分别对应膜变形和弯曲。',
    steps:[
      {title:'1. 网格几何', text:'顶点、边、三角形和相邻面片决定离散壳的拓扑。两面共享的边定义一个弯曲铰链。', formula:'\\mathcal M=(V,E,F),\\qquad \\mathbf n_f=\\frac{(\\mathbf x_j-\\mathbf x_i)\\times(\\mathbf x_k-\\mathbf x_i)}{\\lVert(\\mathbf x_j-\\mathbf x_i)\\times(\\mathbf x_k-\\mathbf x_i)\\rVert}'},
      {title:'2. 边伸长能', text:'论文所用正三角网的边弹簧能以长度变化 Δℓ 表示；系数依赖离散和材料假设。', formula:'E_s=\\frac{\\sqrt3}{4}Eh(\\ell-\\bar\\ell)^2'},
      {title:'3. 铰链弯曲', text:'邻接三角面的单位法向之差度量曲率变化；必须保存参考构型的自然曲率。', formula:'\\kappa_h=\\lVert\\mathbf n_1-\\mathbf n_2\\rVert,\\qquad E_b=\\frac{Eh^3}{12\\sqrt3}(\\kappa_h-\\bar\\kappa_h)^2'},
      {title:'4. 力、边界及收敛', text:'对每个边/铰链的局部能量求导后装配。薄板起皱对网格密度和边界特别敏感，应进行网格和步长收敛。', formula:'\\mathbf f_{\\rm int}=-\\sum_e\\mathbf A_e^\\mathsf T\\nabla E_e,\\quad \\mathbf K=\\sum_e\\mathbf A_e^\\mathsf T\\nabla^2E_e\\,\\mathbf A_e'}
    ], caveat:'当前面片动画采用边与跨边约束近似，未实现上式完整的法向铰链能。'
  },
  {
    id:'network', number:'06', title:'杆网络与接头', english:'ROD NETWORKS', pages:'论文 pp. 48–52',
    intro:'把多条杆的局部自由度映射到共享节点；接头不仅限制位置，也可能耦合方向和扭转。',
    steps:[
      {title:'1. 单杆能量汇总', text:'每条杆具有伸长、弯曲、扭转能；对所有杆求和。', formula:'E_{\\rm network}=\\sum_{r\\in\\mathcal R}(E_s^r+E_b^r+E_t^r)+E_{\\rm joint}'},
      {title:'2. 连接约束', text:'最简单的位置接头要求交点重合；若杆各自持有节点，可用 Lagrange 乘子或罚函数近似。', formula:'\\mathbf c(\\mathbf q)=\\mathbf x_a-\\mathbf x_b=0,\\qquad E_{\\rm joint}=\\tfrac12 k_j\\lVert\\mathbf c(\\mathbf q)\\rVert^2'},
      {title:'3. 找形与平衡', text:'给定边界位移下求解自由节点平衡；接头处的力、力矩与边界反力必须同时核查。', formula:'\\nabla_{\\mathbf q_f}E-\\mathbf f_f=0,\\qquad \\mathbf q_c=\\hat{\\mathbf q}_c'},
      {title:'4. 柔性网的三维伸长单元', text:'柔性网原算例是特例：仅有线性伸长能，不含弯曲或扭转。t 是当前单位切向量；局部 Hessian 的正负块分别装配到边的两个端点。', formula:'\\mathbf t=\\frac{\\mathbf x_b-\\mathbf x_a}{\\ell},\\quad E_e=\\frac{EA}{2\\bar\\ell}(\\ell-\\bar\\ell)^2,\\quad \\mathbf B=EA\\left[\\left(\\frac1{\\bar\\ell}-\\frac1\\ell\\right)\\mathbf I+\\frac{\\mathbf t\\mathbf t^\\mathsf T}{\\ell}\\right],\\quad \\mathbf H_e=\\begin{bmatrix}\\mathbf B&-\\mathbf B\\\\-\\mathbf B&\\mathbf B\\end{bmatrix}'},
      {title:'5. 质量、重力与隐式动力学', text:'每边一半质量分配给两端，六个支点的三个平移自由度不参与求解；对剩余自由度求解速度后向 Euler 的位置残差。', formula:'m_e=\\rho A\\bar\\ell,\\quad m_a\\mathrel{+}=m_e/2,\\quad \\mathbf r=\\mathbf M\\frac{\\mathbf q_{n+1}-\\mathbf q_n-\\Delta t\\mathbf v_n}{\\Delta t^2}+\\mu\\mathbf M\\frac{\\mathbf q_{n+1}-\\mathbf q_n}{\\Delta t}+\\nabla E_s-\\mathbf M\\mathbf g'},
      {title:'6. 稀疏 Newton 方程', text:'全局切线由边块与对角质量组成；工作台以矩阵—向量乘积及对角预处理共轭梯度求解；遇到不定切线则尝试 MINRES 并检查真实线性残差。残差不合格或线性解失败则回滚。', formula:'\\left[\\mathbf M(\\Delta t^{-2}+\\mu\\Delta t^{-1})+\\sum_e\\mathbf A_e^\\mathsf T\\mathbf H_e\\mathbf A_e\\right]\\Delta\\mathbf q=-\\mathbf r'}
    ], caveat:'柔性网原例确实只有伸长：压缩边也有线弹性响应，不能视作松弛索。网壳与格构示意仍未实现完整弯曲、扭转及接头约束；稀疏迭代即使有 MINRES 回退，也不保证所有参数均可收敛。'
  },
  {
    id:'hyper', number:'07', title:'超弹性：大应变本构', english:'HYPERELASTICITY', pages:'论文 pp. 52–58',
    intro:'使用应变能密度而不是常量刚度，便可在相同的能量—力—Jacobian 框架中引入材料非线性。',
    steps:[
      {title:'1. 不可压缩条件', text:'主伸长比的乘积等于体积比；不可压缩时 J=1。单轴拉伸时两个横向伸长相等。', formula:'J=\\lambda_1\\lambda_2\\lambda_3=1,\\qquad \\lambda_2=\\lambda_3=\\lambda^{-1/2},\\quad \\lambda=\\ell/\\bar\\ell'},
      {title:'2. 不变量代入材料能量', text:'把横向伸长代入两个不变量，再乘以参考体积；下面 C₁、C₂ 是每单位参考体积的材料常数。', formula:'W=C_1(I_1-3)+C_2(I_2-3),\\quad I_1=\\lambda^2+2\\lambda^{-1},\\quad I_2=2\\lambda+\\lambda^{-2},\\quad E_s=\\bar V W'},
      {title:'3. 平面索离散能量', text:'原索代码将截面积 A 合并到 cᵢ=A Cᵢ，取 c₁=0.8EA/6、c₂=0.2EA/6；每条边只有伸长能，没有弯曲能。', formula:'E_e=\\bar\\ell\\left[c_1(\\lambda^2+2\\lambda^{-1}-3)+c_2(2\\lambda+\\lambda^{-2}-3)\\right]'},
      {title:'4. 一阶导数与节点力', text:'对当前边长求导，端点的能量梯度方向相反，内力等于负梯度。', formula:'p=\\frac{\\partial E_e}{\\partial\\ell}=2c_1(\\lambda-\\lambda^{-2})+2c_2(1-\\lambda^{-3}),\\quad \\nabla_{\\mathbf x_a}E_e=-p\\mathbf t,\\quad \\mathbf f=-\\nabla E'},
      {title:'5. 二阶导数与 Newton 矩阵', text:'导出材料切线，并利用径向函数的 Hessian 组装四个端点块；该解析 Hessian 与梯度的中心差分逐项比较。', formula:'p^\\prime=\\frac{c_1(2+4\\lambda^{-3})+6c_2\\lambda^{-4}}{\\bar\\ell},\\quad H_{bb}=p^\\prime\\mathbf t\\mathbf t^{\\mathsf T}+\\frac p\\ell(\\mathbf I-\\mathbf t\\mathbf t^{\\mathsf T}),\\quad H_{ab}=-H_{bb}'},
      {title:'6. 逐节点载荷与时间推进', text:'参考脚本的 g 实际直接加入每个节点的力，没有乘以质量；每毫秒更新力并做隐式 Euler/Newton。改变节点数时应用保持自由节点总力，因此仅默认 40 节点对应原离散。', formula:'f_{i,y}^{n+1}=-10\\,t_{n+1}\\;\\mathrm N,\\qquad \\Delta t=10^{-3}\\;\\mathrm s'},
      {title:'7. 轴对称膜的主伸长', text:'母线边的当前长度为 l，两端半径平均为 r；不可压缩条件确定厚度伸长。参考体积为旋转环带面积乘参考厚度。', formula:'\\lambda_s=\\ell/\\bar\\ell,\\quad \\lambda_\\theta=r/\\bar r,\\quad \\lambda_h=(\\lambda_s\\lambda_\\theta)^{-1},\\quad \\bar V=2\\pi\\bar r\\bar\\ell\\bar h'},
      {title:'8. 膜单元的 Mooney–Rivlin 能量', text:'令 u=λₛ²、v=λθ²。原代码取 c₁=0.4 E/[2(1+ν)]、c₂=0.1 E/[2(1+ν)]；参考体积不随构型改变。', formula:'U_e=\\bar V W(u,v),\\quad W=c_1(u+v+(uv)^{-1}-3)+c_2(uv+u^{-1}+v^{-1}-3)'},
      {title:'9. 梯度与切线矩阵', text:'对 u、v 和节点坐标应用两次链式法则，按 4 个局部自由度装配。二阶导包括两个混合项以及 u、v 本身的 Hessian；实现用中心差分检查。', formula:'\\nabla U=\\bar V(W_u\\nabla u+W_v\\nabla v),\\quad \\nabla^2U=\\bar V[W_{uu}\\nabla u\\nabla u^\\mathsf T+W_{vv}\\nabla v\\nabla v^\\mathsf T+W_{uv}(\\nabla u\\nabla v^\\mathsf T+\\nabla v\\nabla u^\\mathsf T)+W_u\\nabla^2u+W_v\\nabla^2v]'},
      {title:'10. 显式随形压力与质量', text:'原压力每步递减 10000Δt；压力法向和环带面积取上一构型，因此不在本步 Jacobian 中线性化。源质量装配将每边环带完整质量分别加给两个端点，本实现为对照而保留，不将其默认为常规集中质量。', formula:'\\mathbf f_{p,1}=\\mathbf f_{p,2}=\\tfrac12\\pi(r_1^n+r_2^n)P_{n+1}(-\\Delta z^n,\\Delta r^n),\\quad m_1,m_2\\mathrel{+}=\\rho\\pi(r_1^0+r_2^0)\\bar\\ell\\bar h'}
    ], caveat:'平面索和轴对称膜分别实现了一维和两主伸长的不可压缩 Mooney–Rivlin 单元。极轴单元和不同网格/时间步仍需单独验证；环面压力与质量严格按源代码的离散约定。'
  },
  {
    id:'interaction', number:'08', title:'磁场、流体与接触', english:'MULTIPHYSICS INTERACTIONS', pages:'论文 pp. 58–65',
    intro:'在平面 DDG 梁的能量与惯性残差上装配磁场和环境作用。磁驱与流固两例按原始离散力实施；接触例仍为教学示意。',
    steps:[
      {title:'1. 边标架与原代码磁势', text:'边 e=x₂−x₁，长度 l=|e|；t=e/l，n=Rt，R 为逆时针旋转 90°。初始标架 t₀,n₀ 上的剩磁投影分别为 b、a。下式的正号按 getFm.m 的节点力反推，不可直接与采用相反磁势符号的材料文献混同。', formula:'b=\\mathbf t_0\\!\\cdot\\!\\mathbf B_r,\\quad a=\\mathbf n_0\\!\\cdot\\!\\mathbf B_r,\\quad U_m=A\\bar\\ell\\,[b\\,(\\mathbf t\\cdot\\mathbf B_a)+a\\,(\\mathbf n\\cdot\\mathbf B_a)]'},
      {title:'2. 磁力的一阶导数', text:'令 h=bBₐ+aRᵀBₐ、C=Aℓ̄；利用 ∂t/∂e=(I−ttᵀ)/l。边两端的磁力大小相等、方向相反，因此不凭空引入净力。', formula:'\\mathbf h=b\\mathbf B_a+aR^{\\mathsf T}\\mathbf B_a,\\quad \\mathbf g_e=\\frac{C}{\\ell}(I-\\mathbf t\\mathbf t^{\\mathsf T})\\mathbf h,\\quad (\\mathbf f_1,\\mathbf f_2)=(\\mathbf g_e,-\\mathbf g_e)'},
      {title:'3. 精确磁力 Jacobian', text:'继续对 e 求导得到能量 Hessian；由 e=x₂−x₁ 将其装配为力 Jacobian 的四个块。原 getFm.m 返回零 Jacobian，验证时仅在兼容回放中复用该近似。', formula:'H_m=\\frac{C}{\\ell^2}\\big[3(\\mathbf t\\cdot\\mathbf h)\\mathbf t\\mathbf t^{\\mathsf T}-(\\mathbf t\\cdot\\mathbf h)I-\\mathbf t\\mathbf h^{\\mathsf T}-\\mathbf h\\mathbf t^{\\mathsf T}\\big],\\quad J_m=\\begin{bmatrix}-H_m&H_m\\\\H_m&-H_m\\end{bmatrix}'},
      {title:'4. 两个磁场加载与时间离散', text:'磁驱梁使用当前待求构型计算磁力，磁场在步首 tₙ 取值；游动例的磁力采用上一时刻构型，剩磁方向沿边变化。40 节点输入坐标按原文件四位小数保留。', formula:'\\mathbf B_a^{(1)}=3(\\cos t_n,\\sin t_n),\\quad \\mathbf B_a^{(2)}=(\\sin20t_n,\\cos20t_n),\\quad \\mathbf B_{r,i}^{(2)}=100(\\cos\\alpha_i,\\sin\\alpha_i),\\quad \\alpha_i=\\frac{2\\pi i}{N-2}'},
      {title:'5. 各向异性二次阻力', text:'速度在切向和法向投影为 vₜ、vₙ。原代码每个端点得到总边阻力的一半，故系数为 1/4；流体密度 1000、直径 2r、系数 Cₜ=0.01、Cₙ=1。', formula:'v_t=\\mathbf t\\cdot\\mathbf v,\\quad v_n=\\mathbf n\\cdot\\mathbf v,\\qquad \\mathbf f_{d,1}=\\mathbf f_{d,2}=-\\tfrac14\\rho_f(2r)\\ell[C_t|v_t|v_t\\mathbf t+C_n|v_n|v_n\\mathbf n]'},
      {title:'6. 阻力的线性化与源码差异', text:'对 l、t、n 及 v=(x₁ⁿ⁺¹−x₁ⁿ)/Δt 同时求导，因第二端也使用第一端速度，完整力 Jacobian 含跨节点块、一般不对称。原代码把两端速度都写成第一端速度，且仅给对角速度导数；工作台保留其力、使用完整导数，回放保留其近似矩阵。', formula:'\\delta\\ell=\\mathbf t\\cdot\\delta\\mathbf e,\\quad \\delta\\mathbf t=\\frac{(I-\\mathbf t\\mathbf t^{\\mathsf T})\\delta\\mathbf e}{\\ell},\\quad \\delta\\mathbf n=R\\delta\\mathbf t,\\quad \\delta(|v|v)=2|v|\\delta v'},
      {title:'7. 隐式 Euler 残差', text:'自由自由度使用惯性、质量阻尼、弹性内力、磁力和阻力；磁驱用精确磁 Jacobian，游动例使用上一构型磁力和完整阻力导数。仅游动体最后节点的 y 被固定，x 可以移动。', formula:'\\mathbf r=\\mathbf M\\frac{\\mathbf q_{n+1}-\\mathbf q_n-\\Delta t\\mathbf v_n}{\\Delta t^2}+\\mu\\mathbf M\\frac{\\mathbf q_{n+1}-\\mathbf q_n}{\\Delta t}+\\nabla E_{s+b}-\\mathbf f_m-\\mathbf f_d=0'},
      {title:'8. 接触势与摩擦（参考理论）', text:'爬行案例的原代码在足端与地面间距 d 小于阈值 d̄ 时使用对数势垒，摩擦使用前一时刻的法向力和正则化切向速度。当前爬行动画尚未实施该势垒或网络拓扑。', formula:'U_c(d)=\\begin{cases}-k(d-\\bar d)^2\\log(d/\\bar d),&0<d<\\bar d,\\\\0,&d\\ge\\bar d,\\end{cases}\\quad f_n=-U_c^\\prime(d),\\quad |f_t|\\le\\mu f_n'},
      {title:'9. 原迭代与收敛检查', text:'原迭代在更新后检查更新前残差，磁力矩阵为零、阻力矩阵为近似。故同一载荷的更严谨收敛解可能与原脚本轨迹不同，需分别展示两者误差、原始迭代上限及参考数据采样范围。', formula:'J=\\frac{M}{\\Delta t^2}+\\frac{\\mu M}{\\Delta t}+\\nabla^2 E_{s+b}-\\frac{\\partial\\mathbf f_m}{\\partial\\mathbf q}-\\frac{\\partial\\mathbf f_d}{\\partial\\mathbf q}'}
    ], caveat:'磁驱梁和流体阻力例复用了平面 DDG 伸长/弯曲单元。流固例没有求解流体速度场，原脚本的两端速度复制及近似 Jacobian 会影响物理解释；爬行例仍是简化投影，未移植原始磁化网络、接触势垒及摩擦。'
  }
]
