export interface InterviewScoringPoint {
  point: string;
  keywordHint: string;
}

export interface InterviewQuestion {
  id: number;
  category: 'PLC架构与FB' | 'PROFINET与伺服' | 'PID温控与中断' | '安全联锁与排错' | '数据保持与交付';
  difficulty: '高频必考' | '深度追问' | '架构压轴';
  question: string;
  intent: string;
  scoringPoints: [InterviewScoringPoint, InterviewScoringPoint, InterviewScoringPoint];
  answer: string;
}

export type TargetRole = 'plc-engineer' | 'nonstandard-control' | 'smart-mfg-trainee';
export type MasteryLevel = 'solid' | 'proficient' | 'lead';

export const INTERVIEW_QUESTIONS: InterviewQuestion[] = [
  {
    id: 1,
    category: 'PLC架构与FB',
    difficulty: '高频必考',
    question: '为什么双位气缸控制块 `FB_Cylinder2Pos` 要写成 FB（功能块），而不是 FC（函数）？',
    intent: '考察对 FB 与 FC 内存模型（Static 静态存储区与背景 DB）以及多重背景复用的工程理解。',
    scoringPoints: [
      { point: '点出气缸需要跨扫描周期记忆命令、延时器与故障锁存', keywordHint: 'Static / TON_TIME / #statFaultConflict' },
      { point: '说明 FC 缺少独立背景数据块，挂大量 InOut 难维护', keywordHint: 'FC 无 Static 区 / InOut 耦合' },
      { point: '提到在主控 FB 中用多重背景实例化多只气缸', keywordHint: 'Multi-Instance 多重背景 DB' },
    ],
    answer:
      '气缸控制需要跨扫描周期保存状态，包括目标动作命令、伸出/退回超时检测定时器（`TON_TIME`）以及双磁簧互斥故障锁存位。FC 没有专属静态区，如果硬用 FC，必须把这些状态全做成 `InOut` 参数在外部逐个绑定，现场有十几只气缸时接口会很乱。用 FB 可以把状态留在 `Static` 区和背景 DB 里，在 `FB_CellSortingStation_Main` 中再通过**多重背景（Multi-Instance）**声明阻挡气缸和热压气缸，共用一个主背景 DB，代码只维护一份，项目树也清楚。',
  },
  {
    id: 2,
    category: 'PROFINET与伺服',
    difficulty: '高频必考',
    question: 'S7-1215C 控制 SINAMICS G120 变频器和 V90 伺服分别用什么报文？控制字 `16#047E` 和 `16#047F` 代表什么？',
    intent: '核实是否实际调试过西门子 PROFIdrive 总线驱动，重点看报文选型、控制字位义与转速标定。',
    scoringPoints: [
      { point: '说清 G120 调速选用标准报文 1 及 PZD1/PZD2 字节分工', keywordHint: 'Telegram 1 / STW1 / NSOLL_A (16#4000=16384)' },
      { point: '准确解释 Bit10 PLC 控制权及 047E→047F 上升沿启停、04FE 复位', keywordHint: 'Bit10=1 / 16#047E→16#047F / 16#04FE' },
      { point: '区分 V90 定位报文 3（工艺对象 TO）与报文 111（EPOS）', keywordHint: 'Telegram 3 (MC_*) / Telegram 111 (SINA_POS)' },
    ],
    answer:
      '进料皮带 G120 只做速度控制，选用 **PROFIdrive 标准报文 1（2 PZD）**：PZD1 是控制字 `STW1`（`%QW256`）和状态字 `ZSW1`（`%IW256`），PZD2 是转速设定与反馈（`16#4000 = 16384` 对应 `P2000` 基准转速 100%）。控制字里 `Bit10` 必须为 1，变频器才接受 PLC 报文；因此先发 `16#047E`（`OFF1=0`）解除“接通禁止”并保持待机，再发 `16#047F`（`Bit0` 由 0 变 1 上升沿）启动运行，故障复位则给 `Bit7` 上升沿 `16#04FE`。立体库 X/Z 轴 V90 需要绝对定位，选**标准报文 3**（PLC 建工艺对象 TO，调用 `MC_Power`/`MC_Home`/`MC_MoveAbsolute`）或**西门子报文 111**（驱动器内部 EPOS 定位，配 `SINA_POS`）。',
  },
  {
    id: 3,
    category: 'PID温控与中断',
    difficulty: '高频必考',
    question: '热压温控算法或 `PID_Compact` 为什么要放进 `OB30` 循环中断，而不能放在 `OB1` 主循环里？',
    intent: '考察对西门子组织块调度机制（OB1 与 OB3x 抢占）以及离散 PID 对采样周期 Δt 敏感度的理解。',
    scoringPoints: [
      { point: '指出积分与微分计算依赖恒定采样周期 Δt', keywordHint: 'Ki * e * Δt / Kd * Δe / Δt' },
      { point: '说明 OB1 扫描周期会随条件分支、通信和监控波动', keywordHint: 'OB1 扫描抖动 (2ms~15ms)' },
      { point: '交代 OB30 固定 100ms 硬件中断抢占 + 1.0s SSR PWM 配合', keywordHint: 'OB30 = 100ms / SSR PWM 1.0s' },
    ],
    answer:
      '离散 PID 的积分项 `Ki * e * Δt` 和微分项 `Kd * Δe / Δt` 要求采样周期 `Δt` 恒定。`OB1` 是自由循环扫描，遇到工艺分支、HMI 刷屏或在线监控时周期会从 2ms 抖到十几毫秒，PID 放进 `OB1` 会造成积分增益漂移、温度来回超调。放到 `OB30` 并设为固定 100ms 循环中断后，硬件时钟按时打断 `OB1` 执行温控计算，再配合 1.0s 周期的 SSR 脉宽调制，热压腔稳态温度可以压在 `85.0°C ±0.3°C`。',
  },
  {
    id: 4,
    category: '数据保持与交付',
    difficulty: '高频必考',
    question: '车间拉闸断电重启后，4×3 立体库里已存电芯的仓位状态和条码怎么防丢？`OB100` 里最容易踩什么坑？',
    intent: '考察变量级掉电保持（RETAIN）配置和 `OB100` 暖启动初始化边界。',
    scoringPoints: [
      { point: '在优化 DB 中对仓位数组与当前配方按变量级勾选 RETAIN', keywordHint: 'DB_StationGlobal / RETAIN' },
      { point: 'OB100 仅刷新机械固定坐标并清零瞬态按钮命令', keywordHint: 'OB100 / PosX_mm / PosZ_mm' },
      { point: '明确禁止 OB100 清零 Occupied 和 ModuleBarcode 防止重入撞机', keywordHint: '保留 .Occupied / .ModuleBarcode' },
    ],
    answer:
      '我在启用优化访问的 `DB_StationGlobal` 中，对 `WarehouseSlots[1..12]` 和 `ActiveRecipe` 开启了**变量级 `RETAIN` 掉电保持**，避免零散占用 M 区。在 `OB100` 暖启动块里必须把“配置参数”和“现场状态”拆开处理：上电只清零瞬态启动/复位命令，刷新 12 个仓位固定的 `(PosX_mm, PosZ_mm)` 坐标，**绝不清零 `.Occupied` 和 `.ModuleBarcode`**。如果顺手把整个数组初始化清零，上电后系统会把已放电池的仓位判为空仓，下一次入库就会直接撞毁电芯。',
  },
  {
    id: 5,
    category: '安全联锁与排错',
    difficulty: '高频必考',
    question: '在 OMAC PackML 状态机里，“急停 (`Abort`)”和“工艺暂停 (`Hold`)”是怎么区分处理的？',
    intent: '考察安全级停机与工艺级暂停的分层设计，避免现场一遇异常就全线清零报废半成品。',
    scoringPoints: [
      { point: 'Hold 为工艺受控暂停：减速停止、保留步序记忆与保温', keywordHint: 'PackML 50 (Held) / 保留 #statStep' },
      { point: 'Abort 为安全强制切断：硬线断 STO 与加热、软件瞬跳 90 并清步序', keywordHint: 'PackML 90 (Aborted) / #statStep := 0' },
      { point: '交代两者恢复路径差异：Unhold 续跑 vs Clear→Stopped→Reset 重回零', keywordHint: 'Unhold vs Clear→Reset' },
    ],
    answer:
      '两者对应的安全级别不同。`Hold`（状态码 `50`）处理缺料、满仓或人工暂停：设备有序减速停下，**保留当前 GRAFCET 步序 `#statStep`，热压腔继续保温**，排除原因后按 `Unhold` 原地接着跑，不会浪费模腔里的半成品。`Abort`（状态码 `90`）对应急停拍下或超温 `≥95°C`：硬件安全继电器直接断开伺服/变频器 STO 和加热主接触器，软件无条件跳到 `Aborted (90)` 并强行清零 `#statStep := 0`，必须现场确认安全后走 `Clear → Stopped → Reset` 重新全轴回零。',
  },
  {
    id: 6,
    category: '安全联锁与排错',
    difficulty: '高频必考',
    question: '为什么现场急停按钮、停止按钮和安全门开关在电气接线时必须选用常闭触点（NC）？',
    intent: '考察工业控制系统的故障导向安全（Fail-Safe）接线基本功。',
    scoringPoints: [
      { point: '说出故障导向安全原则及正常待机时 PLC 输入为 1', keywordHint: 'Fail-Safe / %I0.0 = 1 (NC)' },
      { point: '举出断线、端子松脱、24V 掉电时输入立即变 0 触发停机', keywordHint: '断线/失电 → 输入读 0' },
      { point: '对比常开触点（NO）在断线隐患下拍急停失效的风险', keywordHint: 'NO 断线不可检出' },
    ],
    answer:
      '按 **Fail-Safe（故障导向安全）** 原则，安全回路采用常闭触点（NC），正常待机时回路闭合、PLC 输入 `%I0.0` 为 `1`。只要发生导线拉断、端子松脱、24V 控制电消失或触点接触不良，PLC 读入立刻变为 `0`，系统马上判定急停触发并停机。如果错用常开触点（NO），急停线平时断了系统完全察觉不到，真遇险拍急停反而停不下来。',
  },
  {
    id: 7,
    category: 'PLC架构与FB',
    difficulty: '高频必考',
    question: '什么是 PLC 编程里的“双线圈输出”？为什么在线监控看前一段明明导通，现场继电器却不吸合？',
    intent: '考察对 PLC 扫描周期 `PII → OB1 → PIQ` 与后写覆盖机制的掌握。',
    scoringPoints: [
      { point: '讲清扫描周期顺序：先读 PII、再顺序执行 OB1、最后统一刷写 PIQ 到硬件', keywordHint: 'PII → OB1 → PIQ 写回' },
      { point: '说明同一输出地址两次赋值会产生后写覆盖', keywordHint: 'Last-Write-Wins / %Q0.0' },
      { point: '给出工程规范解法：同一 Q 点全程序只写一次，多条件用中间位汇总', keywordHint: '单点唯一输出 / 中间状态位并联' },
    ],
    answer:
      'S7-1200/1500 在执行 `OB1` 期间只改写内存中的输出映像区 `PIQ`，等整个扫描周期结束才把 `PIQ` 一次性写到物理输出模块。如果在前一个网络给 `%Q0.0` 赋值 `1`，后一个网络条件不满足又把它写成 `0`，最终刷给硬件的就是 `0`（后写覆盖），在线看前面网络虽然变绿，外部电磁阀根本收不到电。写程序时同一物理输出 `%Q` 只允许赋值一次，不同工步的驱动条件先写入各自中间位，最后集中并联输出。',
  },
  {
    id: 8,
    category: 'PROFINET与伺服',
    difficulty: '深度追问',
    question: 'V90 垂直 Z 轴伺服为什么必须配电磁抱闸电机？正常使能与急停时抱闸时序怎么处理？',
    intent: '考察垂直重力轴的机电安全选型与驱动器抱闸控制时序。',
    scoringPoints: [
      { point: '说明垂直轴断电失矩后会因重力下坠，必须选 24V 失电制动抱闸', keywordHint: '24V 失电制动抱闸 / 防下坠' },
      { point: '说明抱闸应由 V90 内部时序控制：先建励磁再开闸、先合闸再撤使能', keywordHint: 'V90 内部抱闸时序 (50~100ms)' },
      { point: '急停时安全继电器断 STO 并同步失电锁死抱闸', keywordHint: 'STO 切断 + 抱闸失电锁死' },
    ],
    answer:
      'Z 轴挂着抓手和电芯模组，伺服断电失去保持力矩后会直接砸向热压模腔，因此必须选 **24V 失电制动型抱闸电机**。抱闸不要用 PLC 普通 DO 自己写延时，而是交给 V90 驱动器按内部时序管理：启动时先建立电机励磁力矩，延时 50~100ms 再打开抱闸防止溜车；停机时先闭合抱闸锁紧，再撤销电机使能；拍急停时安全继电器切断 STO，同时抱闸回路失电机械锁死。',
  },
  {
    id: 9,
    category: 'PID温控与中断',
    difficulty: '深度追问',
    question: '热压腔从室温 25°C 加热到 85.0°C 的冷机升温阶段，怎么防止 PID 严重超调？',
    intent: '考察大惯性热工对象的抗积分饱和与整定经验。',
    scoringPoints: [
      { point: '指出大惯性电加热在初期大误差下持续积分会导致积分饱和过冲', keywordHint: '大滞后 / 积分饱和 (Windup)' },
      { point: '说明在 FB_ThermalPress_PID 中输出限幅时冻结积分并钳位上限', keywordHint: 'Anti-Windup / 积分钳位 80%' },
      { point: '补充 PID_Compact 冷机预调节与稳态精确调节步骤', keywordHint: 'Pretuning + Fine Tuning' },
    ],
    answer:
      '铝制热压块热惯性大，25°C 升到 85°C 初期偏差有 60°C，如果普通 PID 一直累加积分项，温度刚到 85°C 时积分早就溢出了，惯性会把腔温顶到 92°C 以上。我在 `FB_ThermalPress_PID` 里做了**抗积分饱和（Anti-Windup）**：当输出达到 100% 满功率且误差仍为正时冻结 `#statIntegral`，并把积分项上限钳在 80%；如果直接用博途 `PID_Compact`，则先做冷机预调节（Pretuning）算出初始参数，再做稳态精确调节（Fine Tuning），可以把超调压在 0.3°C 左右。',
  },
  {
    id: 10,
    category: 'PID温控与中断',
    difficulty: '深度追问',
    question: '热压腔发生超温（≥95°C）停机后，为什么不能等温度降到 94.9°C 就自动恢复加热？',
    intent: '考察热失控风险防护与“锁存 + 迟滞回差 + 人工确认”防呆逻辑。',
    scoringPoints: [
      { point: '指出超温常伴随 SSR 击穿、散热故障或感温脱落，自动重启会反复干烧', keywordHint: 'SSR 击穿 / 热失控风险' },
      { point: '要求故障位必须软件锁存，且同步清零 PID 输出与积分累加器', keywordHint: '#statOverTempLatch / #statIntegral:=0' },
      { point: '恢复必须同时满足降温回差（<Limit-5°C）、无断线且人工按复位', keywordHint: '回差 5.0°C (<90°C) + #iAlarmReset' },
    ],
    answer:
      '现场热压超温很多时候是因为 SSR 固态继电器击穿常通、散热风机卡死或 PT100 探头松脱。如果温度跌到 94.9°C 就自动复热，腔体会在临界点反复通断干烧电芯。因此在代码里把超温做成锁存故障，触发后马上把 `#qPID_Out_Pct` 和 `#statIntegral` 清零；解锁必须同时满足三个条件：温度自然降到回差线下（本案设 5.0°C，即 `< 90.0°C`）、传感器无断线报错、现场人员排查后按下人工复位键。',
  },
  {
    id: 11,
    category: '安全联锁与排错',
    difficulty: '深度追问',
    question: '气缸双磁簧互斥检测为什么要加 150ms 延时定时器，而不是检测到同时为 1 就立刻报警？',
    intent: '考察现场防抖抗干扰处理与安全响应速度的平衡。',
    scoringPoints: [
      { point: '解释短行程高速切换或接触器吸合干扰会产生 10~30ms 瞬态毛刺', keywordHint: '电磁毛刺 / 开关重叠 (10~30ms)' },
      { point: '说明 150ms TON 滤波既避免误停机又不耽误联锁保护', keywordHint: '#instTON_Conflict (PT := T#150ms)' },
      { point: '一旦延时到达立即锁存故障码 103 并同时切断双侧电磁阀', keywordHint: 'FaultCode = 103 / 切双侧阀' },
    ],
    answer:
      '短行程气缸高速动作，或者旁边大功率接触器吸合产生干扰时，两端的磁簧开关可能出现 10~30ms 的信号毛刺重叠。如果不加滤波，产线会动不动误报警停机。加 `T#150ms` 的 `TON` 延时既能过滤瞬态抖动，又比气缸动作和机械手节拍快得多；只要双磁簧持续粘连超过 150ms，立刻锁存 `FaultCode = 103` 并把伸出、退回双侧电磁阀全部断开。',
  },
  {
    id: 12,
    category: 'PROFINET与伺服',
    difficulty: '高频必考',
    question: 'PROFINET 硬件组态下载后，CPU 红灯（ERROR/BF）常闪报“找不到 IO 设备”，你的排查顺序是什么？',
    intent: '考察西门子现场组网排障的实操顺序。',
    scoringPoints: [
      { point: '第一步核对在线分配的 PROFINET 设备名称与组态是否逐字一致', keywordHint: 'Device Name 在线分配' },
      { point: '第二步查看 CPU 在线诊断缓冲区，核对槽位、订货号与 GSDML 版本', keywordHint: 'Diagnostics Buffer / GSDML' },
      { point: '第三步检查交换机 Link 灯、水晶头屏蔽接地及 PRONETA 查 IP 冲突', keywordHint: 'Link/Act / PRONETA 扫描' },
    ],
    answer:
      '现场排查按四步走：第一，先查 **PROFINET 设备名称（Device Name）**，绝大部分初学者只配了 IP 忘了在线分配设备名，或者大小写、短横线对不上；第二，打开博途“在线与诊断 → 诊断缓冲区（Diagnostics Buffer）”，直接看报缺哪个站、哪个模块订货号或 GSDML 固件版本不一致；第三，看 SCALANCE 交换机对应端口 Link/Act 灯，检查网线压接与屏蔽层接地；第四，用 PRONETA 或博途“可访问设备”全网扫描，排除重复 IP 或私接网线。',
  },
  {
    id: 13,
    category: 'PLC架构与FB',
    difficulty: '深度追问',
    question: 'S7-1200/1500 的“优化的块访问”和非优化 DB 有什么区别？什么时候必须取消优化？',
    intent: '考察博途内存管理机制与老设备/第三方通信对接经验。',
    scoringPoints: [
      { point: '优化 DB 由编译器自动对齐内存、访存更快且支持纯符号寻址', keywordHint: 'S7_Optimized_Access := TRUE' },
      { point: '优化 DB 支持按单个变量独立勾选 RETAIN 掉电保持', keywordHint: '单变量级 RETAIN' },
      { point: '对接 PUT/GET、Modbus/OPC 绝对偏移或老版 WinCC 时需取消优化', keywordHint: 'DB1.DBD0 / PUT-GET / 非优化偏移' },
    ],
    answer:
      '优化 DB 由 TIA Portal 编译器按数据类型自动排列内存，CPU 存取更快，增删中间变量不会打乱其他变量的引用，还可以**对单个变量勾选 `RETAIN`**（例如只保持立体库数组，不保持临时报警位）。需要取消优化的场景很明确：当外部系统不支持符号寻址，必须按绝对地址（如 `DB1.DBD0`）读写时，比如 S7-300/400 的 `PUT/GET` 通信、老版 WinCC 或第三方 Modbus/OPC 网关，就要在块属性里关闭优化访问并重新编译出偏移量。',
  },
  {
    id: 14,
    category: '数据保持与交付',
    difficulty: '架构压轴',
    question: '如果机械把立体库从 4×3 改到 5×4（20 仓），或者客户在视觉后加 1 个复检气缸，软件改动量有多大？',
    intent: '考察模块化与数据结构解耦程度，评估后期变更维护成本。',
    scoringPoints: [
      { point: '新增气缸只需在主控 FB Static 区追加一个 FB_Cylinder2Pos 多重背景', keywordHint: 'Static 追加 FB_Cylinder2Pos' },
      { point: '立库扩容只改 WarehouseSlots 数组上限、OB100 列数常量与检索循环边界', keywordHint: 'Array[1..20] / OB100 MOD 5' },
      { point: '核心 PackML 状态机与报警、HMI 配方接口无需重构', keywordHint: 'UDT 解耦 / 状态机零重写' },
    ],
    answer:
      '改动集中在声明和常量层，不用动主控框架。加 1 只复检气缸，只需在主控 FB 的 `Static` 区追加一个 `FB_Cylinder2Pos` 多重背景实例并绑定新 I/O，原有的超时检测、双磁簧互斥和报警输出会直接生效。立库扩到 5×4（20 仓），只需把 `DB_StationGlobal.WarehouseSlots` 上限改成 20，调整 `OB100` 里的列数 `MOD 5` 和空仓检索 `FOR` 循环上限，主状态机和坐标调用逻辑都能原样保留。',
  },
  {
    id: 15,
    category: '数据保持与交付',
    difficulty: '架构压轴',
    question: '新装配好的非标单机第一次通电调试，你按什么步骤推进才能避免撞坏视觉相机和伺服轴？',
    intent: '考察一线电控工程师现场安全上电、打点与联调规范。',
    scoringPoints: [
      { point: '先断电测绝缘通断，再分段上控制电完成全部 DI/DO 极性打点', keywordHint: '冷态查线 → 控制电打点' },
      { point: '降气压（0.2MPa）单动气缸，伺服 10% 低速点动测旋向、限位与 Z 轴抱闸', keywordHint: '0.2MPa 单动 / 10% 限位回零' },
      { point: '20% 降速空跑全自动无干涉后，再提速带料并逐项做 FAT 故障注入', keywordHint: '20% 空跑 → 100% 带料 FAT' },
    ],
    answer:
      '现场第一次送电我按五步推进：第一步断电查线，用万用表核对 24V/0V 及动力主回路对地绝缘，确认无短路；第二步只合控制空开（断开伺服动力和主气源），逐个触发传感器核对 DI 极性与点表一致；第三步把调压阀降到 `0.2MPa` 手动点动电磁阀，确认气缸方向和磁簧编号一一对应；第四步伺服 10% 低速点动，核对电机旋向、软硬限位和 Z 轴抱闸动作后再执行回零；第五步 20% 速度空跑全自动流程确认无机械干涉，最后提速带料并逐项验证急停、超温和断电保持。',
  },
];

export interface ResumeOptions {
  role: TargetRole;
  level: MasteryLevel;
  includeProfinet: boolean;
  includePid: boolean;
  includePackml: boolean;
  includeRetain: boolean;
  format: 'markdown' | 'plain';
}

export function generateStarResume(opts: ResumeOptions): string {
  const roleMeta: Record<TargetRole, { title: string; roleName: string }> = {
    'plc-engineer': {
      title: 'PLC 电气自动化工程师',
      roleName: 'PLC 控制软件主研',
    },
    'nonstandard-control': {
      title: '非标设备控制工程师',
      roleName: '非标单机控制工程师',
    },
    'smart-mfg-trainee': {
      title: '智能制造 / 产线自动化管培生',
      roleName: '产线自动化与监控开发负责人',
    },
  };

  const levelClause: Record<MasteryLevel, string> = {
    solid: '负责核心控制块开发与仿真联调，完成 S7-1215C 程序编写、变量表整理及可导入 TIA Portal 的外部源文件验证',
    proficient: '独立承担从 URS 节拍拆解、电控 BOM 与 I/O 点表定型、模块化 SCL 编码到 FAT 故障注入验收的整站开发',
    lead: '负责整站控制架构与标准化 FB 库搭建，沉淀气缸、驱动与 PackML 复用模板供同类非标机台直接调用',
  };

  const r = roleMeta[opts.role];
  const actions: string[] = [];

  if (opts.includeProfinet) {
    actions.push(
      '基于 SIMATIC S7-1215C（6ES7 215-1AG40-0XB0）搭建 100Mbps 星型 PROFINET IO 网络，接入 TP700 HMI、ET 200SP 分布式 IO、智能视觉相机、SINAMICS G120 变频器及 2 台 V90 伺服；编写 G120 标准报文 1 控制块（处理 16#047E/047F 启停时序与 16#4000 转速标定）和 V90 X/Z 双轴定位接口（Z 轴配 24V 失电抱闸）。'
    );
  }
  if (opts.includePackml) {
    actions.push(
      '用 SCL 实现 OMAC PackML 外层状态管理（区分工艺暂停 Held 保留步序与急停 Aborted 强清步序）和内层 5 步 GRAFCET 顺控；通过多重背景封装双位气缸块 FB_Cylinder2Pos，内置 T#150ms 双磁簧互斥滤波、超时报警代码与气缸/伺服防撞互锁。'
    );
  }
  if (opts.includePid) {
    actions.push(
      '将热压固化腔闭环温控部署在 OB30（100ms 循环中断）中消除 OB1 扫描周期波动，加入抗积分饱和 PI 控制与 1.0s SSR PWM 调制，并设置“超温锁存（≥95°C）+ 5°C 降温回差（<90°C）+ 人工确认复位”联锁。'
    );
  }
  if (opts.includeRetain) {
    actions.push(
      '建立 UDT 工艺配方与 4×3 立体库仓位结构体，在优化数据块 DB_StationGlobal 中按变量级勾选 RETAIN 掉电保持；在 OB100 中只刷新机械坐标并保留在库占用位与条码，配套 WinCC 监控界面、报警确认归档和仓位追溯面板。'
    );
  }
  if (actions.length === 0) {
    actions.push(
      '完成 S7-1215C 整站 I/O 点表编制、SCL 控制程序编写、气缸与变频器标准功能块封装以及 WinCC 监控画面联调。'
    );
  }

  const resultLine =
    opts.role === 'smart-mfg-trainee'
      ? '支持 3 款锂电模组（LFP-100Ah / NCM-150Ah / CTP-280Ah）配方切换，实测单件节拍 11.2s（折算 UPH > 320），热压腔稳态温控精度 85.0°C ±0.3°C；12 个立库仓位条码与峰值温度断电重启后零丢失，并交付 FDS 功能设计说明书、可导入 TIA Portal 的 SCL 源码包与 FAT 验收记录。'
      : '支持 3 款动力电池模组配方换型，单件节拍稳定在 11.2s（UPH > 320），热压恒温精度达 85.0°C ±0.3°C（冷机超调 < 0.4°C）；通过急停断 STO、双磁簧粘连、95°C 超温锁存与断电重启仓位保持等全部 FAT 故障注入测试，气缸与驱动标准块可直接跨机台复用。';

  if (opts.format === 'plain') {
    return [
      `项目名称：新能源锂电模组柔性视觉分拣、热压固化与立体入库工作站（S7-1215C + PROFINET）`,
      `担任角色：${r.roleName}（目标岗位：${r.title}）`,
      ``,
      `【项目背景与职责】`,
      `针对动力电池模组后段产线多型号换型、热压恒温控制和 4×3 立体库条码追溯需求，${levelClause[opts.level]}。`,
      ``,
      `【核心实施内容】`,
      ...actions.map((a, i) => `${i + 1}. ${a}`),
      ``,
      `【验收结果】`,
      resultLine,
    ].join('\n');
  }

  return [
    `### 新能源锂电模组柔性视觉分拣、热压固化与立体入库工作站（S7-1215C + PROFINET）`,
    `**角色**：${r.roleName} ｜ **技术栈**：\`SIMATIC S7-1215C\` \`TIA Portal (SCL)\` \`PROFINET IO\` \`SINAMICS G120/V90\` \`PackML\` \`OB30 PID\` \`WinCC\``,
    ``,
    `- **项目背景与职责**：针对动力电池模组后段多型号换型、热压恒温控制与 4×3 立库条码追溯需求，${levelClause[opts.level]}。`,
    `- **核心实施内容**：`,
    ...actions.map((a) => `  - ${a}`),
    `- **验收结果**：${resultLine}`,
  ].join('\n');
}
