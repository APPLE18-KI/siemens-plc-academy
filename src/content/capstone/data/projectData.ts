export interface ProfinetNode {
  id: string;
  ip: string;
  pnName: string;
  label: string;
  model: string;
  orderNumber: string;
  role: string;
  telegram: string;
  ioRange: string;
  x: number;
  y: number;
  accent: string;
  highlights: string[];
}

export interface BomItem {
  no: number;
  category: string;
  name: string;
  orderNumber: string;
  qty: number;
  spec: string;
  unitPriceCny: number;
  rationale: string;
}

export interface StationIoRow {
  symbol: string;
  address: string;
  area: 'I' | 'Q' | 'AI' | 'PN-I' | 'PN-Q';
  dataType: 'Bool' | 'Int' | 'Word';
  module: string;
  comment: string;
}

export interface CodingChallenge {
  id: string;
  level: number;
  title: string;
  fileRef: string;
  difficulty: '基础实战' | '进阶联锁' | '核心算法' | '架构排错';
  scenario: string;
  requirements: string[];
  starterCode: string;
  solutionCode: string;
  hints: string[];
  checks: Array<{
    label: string;
    test: (normalizedCode: string) => boolean;
  }>;
}

export interface InterviewQuestion {
  id: number;
  category: 'PLC架构与FB' | 'PROFINET与伺服' | 'PID温控与中断' | '安全联锁与排错' | '数据保持与交付';
  difficulty: '高频必考' | '深度追问' | '架构压轴';
  question: string;
  intent: string;
  answer: string;
}

export type TargetRole = 'plc-engineer' | 'nonstandard-control' | 'smart-mfg-trainee';
export type MasteryLevel = 'solid' | 'proficient' | 'lead';

export const PROFINET_NODES: ProfinetNode[] = [
  {
    id: 'plc',
    ip: '192.168.0.1',
    pnName: 'plc-s7-1215c',
    label: 'S7-1215C CPU',
    model: 'SIMATIC S7-1215C DC/DC/DC',
    orderNumber: '6ES7 215-1AG40-0XB0',
    role: 'PROFINET IO Controller (双网口内置交换)',
    telegram: '主站控制器 · 更新周期 2ms',
    ioRange: '本体 %I0.0~%I1.5 / %Q0.0~%Q1.1',
    x: 295,
    y: 26,
    accent: '#009999',
    highlights: [
      '集成 2 个 PROFINET 接口，支持 16 个 IO 设备与工艺对象 TO 轴控',
      'OB1 主循环执行 PackML 状态机，OB30 (100ms) 专跑 PID 温控',
      '支持优化数据块单变量 RETAIN 掉电保持，保护 4×3 立体库条码',
    ],
  },
  {
    id: 'hmi',
    ip: '192.168.0.2',
    pnName: 'hmi-tp700-comfort',
    label: 'TP700 Comfort',
    model: 'SIMATIC HMI TP700 Comfort 7"',
    orderNumber: '6AV2 124-0GC01-0AX0',
    role: '人机交互 SCADA 操作屏',
    telegram: 'S7-HMI 符号变量直连 (DB_StationGlobal)',
    ioRange: '关联 DB_StationGlobal.HMI / ActiveRecipe',
    x: 52,
    y: 164,
    accent: '#38bdf8',
    highlights: [
      '实时展示整线动画、热压温控趋势曲线与 4×3 立体库仓位追溯',
      '内置 3 套锂电模组工艺配方与完整分级用户权限管理',
      '支持离散量工业报警横幅、消音确认与历史报警归档导出',
    ],
  },
  {
    id: 'g120',
    ip: '192.168.0.10',
    pnName: 'drv-g120-conveyor',
    label: 'SINAMICS G120',
    model: 'G120 CU240E-2 PN + PM240-2 (0.75kW)',
    orderNumber: '6SL3 244-0BB12-1FA0',
    role: '进料分拣皮带变频调速从站',
    telegram: 'PROFIdrive 标准报文 1 (2 PZD)',
    ioRange: '%IW256~%IW259 / %QW256~%QW259',
    x: 175,
    y: 248,
    accent: '#10b981',
    highlights: [
      '标准报文 1：PZD1 传输控制字 STW1 (16#047E/047F) 与状态字 ZSW1',
      'PZD2 传输转速标幺值（16#4000 = 16384 对应 100% 基准转速）',
      '集成硬件 STO 安全转矩关断接口，直连安全继电器急停输出',
    ],
  },
  {
    id: 'v90x',
    ip: '192.168.0.11',
    pnName: 'drv-v90-axis-x',
    label: 'V90 PN · X轴',
    model: 'SINAMICS V90 PN 0.75kW + 1FL6 伺服',
    orderNumber: '6SL3 210-5FB10-8UF0',
    role: '立体库水平移载 X 轴伺服',
    telegram: '标准报文 3 (TO 工艺对象) / 西门子报文 111',
    ioRange: '%IW272~%IW291 / %QW272~%QW291',
    x: 315,
    y: 248,
    accent: '#14b8a6',
    highlights: [
      '负责热压模腔 (X=250mm) 至 4 列立体库 (480~1440mm) 精准定位',
      '配合绝对值编码器或主动回零 (MC_Home Mode 3) 实现 ±0.05mm 重复定位',
      '软/硬双限位防撞保护，未回零前禁止自动态启动',
    ],
  },
  {
    id: 'v90z',
    ip: '192.168.0.12',
    pnName: 'drv-v90-axis-z',
    label: 'V90 PN · Z轴',
    model: 'SINAMICS V90 PN 0.75kW (带抱闸)',
    orderNumber: '6SL3 210-5FB10-8UF0',
    role: '立体库垂直升降 Z 轴伺服',
    telegram: '标准报文 3 (TO) / 西门子报文 111 + 抱闸控制',
    ioRange: '%IW296~%IW315 / %QW296~%QW315',
    x: 455,
    y: 248,
    accent: '#f59e0b',
    highlights: [
      '垂直重力轴必须选配 24V 失电电磁抱闸，急停或断电瞬间机械锁死防坠落',
      '3 层立库高度坐标：180mm / 420mm / 660mm，在 OB100 中自动映射',
      '与热压下压气缸互锁：Z 轴未撤离干涉区时严禁热压下压',
    ],
  },
  {
    id: 'vision',
    ip: '192.168.0.20',
    pnName: 'cam-vision-st1',
    label: '智能视觉相机',
    model: '工业智能读码与外观/内阻视觉系统',
    orderNumber: 'VISION-PN-5MP-IO',
    role: '电芯模组溯源扫码 + 品质分级 (A/B/NG)',
    telegram: 'PROFINET IO 周期交互 + 3s 触发超时监视',
    ioRange: '%I1.3 Vision_Done / %IW100 分级字',
    x: 580,
    y: 164,
    accent: '#a78bfa',
    highlights: [
      '硬触发 %Q0.5 拍照，180ms 内回传条码字符串与质量等级 (1=A, 2=B, 9=NG)',
      '内置 3s 通信超时看门狗，超期自动切入 PackML Held 并触发 ALM-011',
      '检出 NG 废品立即触发气动剔除分支，不浪费热压与立库节拍',
    ],
  },
  {
    id: 'et200sp',
    ip: '192.168.0.30',
    pnName: 'rio-et200sp-st1',
    label: 'ET 200SP 远程IO',
    model: 'IM 155-6 PN ST + DI16/DO16 + AI 4xRTD',
    orderNumber: '6ES7 155-6AU01-0BN0',
    role: '机台侧分布式现场传感、阀岛与测温站',
    telegram: 'PROFINET IO RT 实时分布站',
    ioRange: 'PT100 %IW96 / 扩展 DI/DO 备留 25% 余量',
    x: 565,
    y: 44,
    accent: '#fb7185',
    highlights: [
      '就近安装于工作站机架下方，将多芯控制电缆缩减 70%，极大降低干扰',
      'AI 4xRTD 模块直连热压腔四线制 PT100，原始值 0.1°C/字，支持硬件断线诊断',
      '预留 25% 备用点位，满足产线后期新增光电或气缸快速扩容',
    ],
  },
];

export const HARDWARE_BOM: BomItem[] = [
  {
    no: 1,
    category: 'PLC 主控',
    name: 'SIMATIC S7-1215C DC/DC/DC',
    orderNumber: '6ES7 215-1AG40-0XB0',
    qty: 1,
    spec: '14DI/10DO/2AI/2AO, 125KB 工作内存, 双 PROFINET 口',
    unitPriceCny: 4200,
    rationale: '自带双网口省 1 个交换机口，DC 晶体管输出高速可靠，完美胜任中小非标站',
  },
  {
    no: 2,
    category: '人机界面',
    name: 'SIMATIC HMI TP700 Comfort',
    orderNumber: '6AV2 124-0GC01-0AX0',
    qty: 1,
    spec: '7 寸宽屏 TFT, PROFINET, 支持配方/趋势/脚本/报警归档',
    unitPriceCny: 6800,
    rationale: '工业现场高稳定性精智面板，与博途共享变量与 UDT 零重复建点',
  },
  {
    no: 3,
    category: '工业交换机',
    name: 'SCALANCE XB008 非网管交换机',
    orderNumber: '6GK5 008-0BA10-1AB2',
    qty: 1,
    spec: '8 口 RJ45 100Mbps, 24VDC 工业导轨安装',
    unitPriceCny: 1350,
    rationale: '将 PLC/HMI/G120/V90×2/视觉/ET200SP 统一接入星型 PROFINET 网络',
  },
  {
    no: 4,
    category: '变频驱动',
    name: 'SINAMICS G120 CU240E-2 PN + PM240-2',
    orderNumber: '6SL3 244-0BB12-1FA0',
    qty: 1,
    spec: '0.75kW 三相 380V, 内置 PROFINET 与硬件 STO',
    unitPriceCny: 3100,
    rationale: '支持标准报文 1 平滑调速进料，STO 接口直连安全继电器满足 PL d',
  },
  {
    no: 5,
    category: '伺服系统',
    name: 'SINAMICS V90 PN + 1FL6 伺服套装 (X/Z)',
    orderNumber: '6SL3 210-5FB10-8UF0',
    qty: 2,
    spec: '0.75kW 20位绝对值编码器，Z轴选配 24V 断电抱闸',
    unitPriceCny: 4600,
    rationale: '西门子生态性价比首选，报文 3/111 极速对接 S7-1200，Z 轴带抱闸防坠落',
  },
  {
    no: 6,
    category: '分布式 IO',
    name: 'ET 200SP IM155-6 PN + DI16/DO16 + AI 4xRTD',
    orderNumber: '6ES7 155-6AU01-0BN0',
    qty: 1,
    spec: 'PROFINET 接口模块 + 开关量 + 4通道 PT100 测温模块',
    unitPriceCny: 4950,
    rationale: '高密度分布式采集 PT100 与机台气缸磁簧信号，支持通道断线硬件报错',
  },
  {
    no: 7,
    category: '安全回路',
    name: 'SIRIUS 3SK1 安全继电器 + 急停/安全门开关',
    orderNumber: '3SK1111-1AB30',
    qty: 1,
    spec: '双通道检测, 3NO+1NC 安全触点, ISO 13849-1 PL e',
    unitPriceCny: 1650,
    rationale: '硬线切断 G120/V90 的 STO 及加热器主接触器，不依赖 PLC 软件保命',
  },
  {
    no: 8,
    category: '温控执行',
    name: '四线制 PT100 + 40A 过零固态继电器 SSR',
    orderNumber: 'SSR-40DA-Z / PT100-A',
    qty: 1,
    spec: 'A 级精度 PT100 + 24VDC 输入无触点 SSR + 散热铝排',
    unitPriceCny: 480,
    rationale: '配合 OB30 1s PWM 高频通断加热棒，无机械接触器触点烧蚀寿命问题',
  },
  {
    no: 9,
    category: '视觉系统',
    name: '智能读码与外观视觉相机 (带光源)',
    orderNumber: 'VISION-PN-5MP-IO',
    qty: 1,
    spec: '500万像素卷帘/全局快门，原生 PROFINET 协议',
    unitPriceCny: 8500,
    rationale: '一步完成电芯二维码追溯与外观/极耳缺陷分级，直接输出分类字给 PLC',
  },
  {
    no: 10,
    category: '工业电源',
    name: 'SITOP PSU100S 24VDC / 10A (主控+执行分源×2)',
    orderNumber: '6EP1 334-2BA20',
    qty: 2,
    spec: '输入 AC 230V, 输出 24VDC 10A, 带过载保护与 DC OK 触点',
    unitPriceCny: 980,
    rationale: 'PLC/传感器与电磁阀/抱闸严格分源供电，避免感性负载反峰拉垮 CPU',
  },
];

export const STATION_IO_TABLE: StationIoRow[] = [
  { symbol: '"I_EStop_OK"', address: '%I0.0', area: 'I', dataType: 'Bool', module: 'CPU 本体 DI', comment: '双通道安全继电器急停正常反馈 (NC: 1=正常, 0=拍下)' },
  { symbol: '"I_SafetyDoor_OK"', address: '%I0.1', area: 'I', dataType: 'Bool', module: 'CPU 本体 DI', comment: '防护安全门磁锁闭合反馈 (NC: 1=闭合)' },
  { symbol: '"I_AirPressure_OK"', address: '%I0.2', area: 'I', dataType: 'Bool', module: 'CPU 本体 DI', comment: '气源压力开关正常 (≥0.45MPa = 1)' },
  { symbol: '"I_Infeed_Sensor"', address: '%I0.3', area: 'I', dataType: 'Bool', module: 'CPU 本体 DI', comment: '进料阻挡工位光纤来料检测 (有模组 = 1)' },
  { symbol: '"I_CylClamp_Ret"', address: '%I0.4', area: 'I', dataType: 'Bool', module: 'CPU 本体 DI', comment: '阻挡夹紧气缸退回到位磁簧开关' },
  { symbol: '"I_CylClamp_Adv"', address: '%I0.5', area: 'I', dataType: 'Bool', module: 'CPU 本体 DI', comment: '阻挡夹紧气缸伸出到位磁簧开关' },
  { symbol: '"I_CylPress_Ret"', address: '%I0.6', area: 'I', dataType: 'Bool', module: 'CPU 本体 DI', comment: '热压气缸上限位退回磁簧开关' },
  { symbol: '"I_CylPress_Adv"', address: '%I0.7', area: 'I', dataType: 'Bool', module: 'CPU 本体 DI', comment: '热压气缸下压到位磁簧开关' },
  { symbol: '"I_Vision_Done"', address: '%I1.3', area: 'I', dataType: 'Bool', module: '视觉 PN IO', comment: '智能视觉相机扫码与分级完成标志' },
  { symbol: '"I_V90_AllHomed"', address: '%I1.4', area: 'I', dataType: 'Bool', module: 'V90 状态汇总', comment: 'X/Z 轴 V90 伺服全部完成回零标志' },
  { symbol: '"I_V90_InPos"', address: '%I1.5', area: 'I', dataType: 'Bool', module: 'V90 状态汇总', comment: 'X/Z 轴 V90 伺服定位到达目标窗口标志' },
  { symbol: '"Q_CylClamp_Adv"', address: '%Q0.0', area: 'Q', dataType: 'Bool', module: 'CPU 本体 DO', comment: '阻挡夹紧气缸伸出电磁阀 (24VDC)' },
  { symbol: '"Q_CylClamp_Ret"', address: '%Q0.1', area: 'Q', dataType: 'Bool', module: 'CPU 本体 DO', comment: '阻挡夹紧气缸退回电磁阀 (24VDC)' },
  { symbol: '"Q_CylPress_Adv"', address: '%Q0.2', area: 'Q', dataType: 'Bool', module: 'CPU 本体 DO', comment: '热压下压气缸下压电磁阀 (受伺服防撞互锁)' },
  { symbol: '"Q_CylPress_Ret"', address: '%Q0.3', area: 'Q', dataType: 'Bool', module: 'CPU 本体 DO', comment: '热压下压气缸抬升电磁阀' },
  { symbol: '"Q_Reject_Pusher"', address: '%Q0.4', area: 'Q', dataType: 'Bool', module: 'CPU 本体 DO', comment: 'NG 不良品气动剔除推杆电磁阀' },
  { symbol: '"Q_Vision_Trigger"', address: '%Q0.5', area: 'Q', dataType: 'Bool', module: 'CPU 本体 DO', comment: '智能视觉相机硬触发拍照输出' },
  { symbol: '"Q_Heater_SSR_PWM"', address: '%Q0.6', area: 'Q', dataType: 'Bool', module: 'CPU 本体 DO', comment: '热压腔固态继电器 SSR 加热 PWM (由 OB30 驱动)' },
  { symbol: '"Q_Tower_Green/Amber/Red"', address: '%Q0.7~%Q1.1', area: 'Q', dataType: 'Bool', module: 'CPU 本体 DO', comment: '三色塔灯：绿(运行) / 黄(待机暂停) / 红(急停报警)' },
  { symbol: '"AI_PressTemp_Raw"', address: '%IW96', area: 'AI', dataType: 'Int', module: 'ET200SP RTD', comment: '热压腔 PT100 模拟量通道 (0.1°C/字, 850=85.0°C)' },
  { symbol: '"IW_Vision_Grade"', address: '%IW100', area: 'PN-I', dataType: 'Int', module: '视觉相机 PN', comment: '视觉分级结果码 (1=A级优品, 2=B级良配, 9=NG剔除)' },
  { symbol: '"IW_G120_ZSW1 / NIST_A"', address: '%IW256..258', area: 'PN-I', dataType: 'Word', module: 'G120 报文 1', comment: '变频器状态字 ZSW1 与实际速度反馈 (16#4000=100%)' },
  { symbol: '"QW_G120_STW1 / NSOLL_A"', address: '%QW256..258', area: 'PN-Q', dataType: 'Word', module: 'G120 报文 1', comment: '变频器控制字 STW1 (16#047E/047F) 与速度设定字' },
];

export const CODING_CHALLENGES: CodingChallenge[] = [
  {
    id: 'ch1-cylinder',
    level: 1,
    title: '关卡 1 · 补全气缸双磁簧互斥报警 (`FB_Cylinder2Pos`)',
    fileRef: 'blocks/FB_Cylinder2Pos.scl',
    difficulty: '基础实战',
    scenario:
      '现场气缸伸出和退回两端的磁簧开关若因进水或损坏发生“同时为 1”粘连，程序会误判到位导致机械手直接撞毁夹具！请补全 150ms 滤波互斥检测与故障锁存逻辑。',
    requirements: [
      '给定时器 #instTON_Conflict 的 IN 端口传入双磁簧同时导通条件 (#iSensor_Adv AND #iSensor_Ret)，PT 设为 T#150ms',
      '当 #instTON_Conflict.Q 为真时，锁存 #statFaultConflict := TRUE',
      '在安全输出段增加互斥保护：存在 #statFaultConflict 时强切电磁阀输出',
    ],
    starterCode: `// 请补全 TODO 处的西门子 SCL 逻辑：
#instTON_Conflict(
    IN := (* TODO: 伸出到位与退回到位同时导通 *),
    PT := T#150ms
);

IF (* TODO: 定时器延时到达 *) THEN
    #statFaultConflict := TRUE;
END_IF;

// 物理电磁阀输出保护：仅当总使能有效且无互斥故障时才允许驱动
IF #iEnable AND (* TODO: 无互斥故障 *) THEN
    #qValve_Adv := #statCmdAdv AND #iInterlock_Adv;
    #qValve_Ret := (NOT #statCmdAdv) AND #iInterlock_Ret;
ELSE
    #qValve_Adv := FALSE;
    #qValve_Ret := FALSE;
END_IF;`,
    solutionCode: `#instTON_Conflict(
    IN := (#iSensor_Adv AND #iSensor_Ret),
    PT := T#150ms
);

IF #instTON_Conflict.Q THEN
    #statFaultConflict := TRUE;
END_IF;

IF #iEnable AND NOT #statFaultConflict THEN
    #qValve_Adv := #statCmdAdv AND #iInterlock_Adv;
    #qValve_Ret := (NOT #statCmdAdv) AND #iInterlock_Ret;
ELSE
    #qValve_Adv := FALSE;
    #qValve_Ret := FALSE;
END_IF;`,
    hints: [
      '双磁簧同时导通在 SCL 中用逻辑与运算符 AND：#iSensor_Adv AND #iSensor_Ret',
      'IEC 定时器 TON_TIME 的输出到位标志是 .Q，即 #instTON_Conflict.Q',
      '“无互斥故障”写作 NOT #statFaultConflict',
    ],
    checks: [
      {
        label: '检测 #iSensor_Adv 与 #iSensor_Ret 同时导通 (AND)',
        test: (c) =>
          /in\s*:=\s*\(?\s*#isensor_adv\s+and\s+#isensor_ret|#isensor_ret\s+and\s+#isensor_adv/.test(c),
      },
      {
        label: '读取 #instTON_Conflict.Q 置位锁存 #statFaultConflict := TRUE',
        test: (c) =>
          /#instton_conflict\.q/.test(c) && /#statfaultconflict\s*:=\s*true/.test(c),
      },
      {
        label: '电磁阀驱动前检查 NOT #statFaultConflict 切断双侧阀',
        test: (c) => /not\s+#statfaultconflict/.test(c),
      },
    ],
  },
  {
    id: 'ch2-g120',
    level: 2,
    title: '关卡 2 · 修复 SINAMICS G120 报文 1 控制字与转速标定',
    fileRef: 'blocks/FB_SinamicsDrive_Tel1.scl',
    difficulty: '进阶联锁',
    scenario:
      '新来的实习生写的 G120 控制块下载后皮带死活不转！排查发现：① 速度标定误用 27648（模拟量满量程）而不是 PROFIdrive 标准的 16384 (16#4000)；② 启动控制字漏了 Bit10 PLC 控制权导致写了 16#007F 而非 16#047F！请立即修复。',
    requirements: [
      '将速度标定系数修改为 PROFIdrive 报文标准满量程 16384.0 (对应 16#4000 = 100%)',
      '将启动运行控制字修复为 16#047F（含 Bit10=1 PLC 控制使能），待机停机字设为 16#047E',
      '急停断开 (NOT #iSafety_OK) 时将速度设定 #qPZD_NSOLL_A 清零',
    ],
    starterCode: `// 以下代码存在 2 处典型西门子变频器报文 Bug，请修复！
#tempRawSpeed := REAL_TO_INT((#tempClampedPct / 100.0) * 27648.0); // BUG 1: 标定基准错!

IF NOT #iSafety_OK THEN
    #tempStw1 := 16#0400;
    #qPZD_NSOLL_A := 0;
ELSIF #iRunCmd AND NOT #qDriveFault THEN
    #tempStw1 := 16#007F; // BUG 2: 缺少 Bit10 PLC 主控位!
    #qPZD_NSOLL_A := #tempRawSpeed;
ELSE
    #tempStw1 := 16#047E;
    #qPZD_NSOLL_A := 0;
END_IF;`,
    solutionCode: `#tempRawSpeed := REAL_TO_INT((#tempClampedPct / 100.0) * 16384.0);

IF NOT #iSafety_OK THEN
    #tempStw1 := 16#0400;
    #qPZD_NSOLL_A := 0;
ELSIF #iRunCmd AND NOT #qDriveFault THEN
    #tempStw1 := 16#047F;
    #qPZD_NSOLL_A := #tempRawSpeed;
ELSE
    #tempStw1 := 16#047E;
    #qPZD_NSOLL_A := 0;
END_IF;`,
    hints: [
      '西门子模拟量模块满量程是 27648，但 SINAMICS 报文转速满量程永远是 16#4000 = 16384！',
      'PROFIdrive 规定 STW1 的 Bit10（十六进制 16#0400）必须为 1，变频器才接受 PLC 发来的控制字，故启动字 = 16#047F。',
    ],
    checks: [
      {
        label: '使用 PROFIdrive 100% 速度标定基准 16384 (移除 27648)',
        test: (c) => /16384/.test(c) && !/27648/.test(c),
      },
      {
        label: '启动控制字修复为 16#047F 且保留待机字 16#047E',
        test: (c) => /16#047f/.test(c) && /16#047e/.test(c) && !/16#007f/.test(c),
      },
      {
        label: '急停断开时发送安全字 16#0400 并将速度设定归零',
        test: (c) => /16#0400/.test(c) && /#qpzd_nsoll_a\s*:=\s*0/.test(c),
      },
    ],
  },
  {
    id: 'ch3-pid-overtemp',
    level: 3,
    title: '关卡 3 · 修复 OB30 热压腔超温安全联锁与回差复位',
    fileRef: 'blocks/FB_ThermalPress_PID.scl',
    difficulty: '进阶联锁',
    scenario:
      '原温控程序在温度超过 95.0°C 时没有锁存故障，导致温度一降到 94.9°C 就自动重启加热，锂电模组存在热失控起火风险！请重构为“超温立即锁存 → 切断 PID 输出与积分 → 必须降至 Limit - 5.0°C 且人工按复位键才可解锁”。',
    requirements: [
      '当 #qActTemp_C >= #iOverTempLimit_C 或 #qSensorFault 为真时，锁存 #statOverTempLatch := TRUE',
      'ELSIF 分支中：仅当 #iAlarmReset 且温度低于 (#iOverTempLimit_C - 5.0) 且无传感器故障时才允许清除锁存',
      '当发生超温锁存或安全失能时，强制把 #qPID_Out_Pct := 0.0 与 #statIntegral := 0.0',
    ],
    starterCode: `// 请修复下方缺乏锁存与回差的危险温控联锁！
IF (#qActTemp_C >= #iOverTempLimit_C) OR #qSensorFault THEN
    #statOverTempLatch := TRUE;
ELSIF (* TODO: 人工复位 AND 温度低于限值减 5.0 度 AND 无断线故障 *) THEN
    #statOverTempLatch := FALSE;
END_IF;

IF #iEnable AND #iSafety_OK AND NOT #statOverTempLatch THEN
    #qPID_Out_Pct := #tempOut;
ELSE
    (* TODO: 安全切断加热占空比并清空积分累加器 #statIntegral *)
END_IF;`,
    solutionCode: `IF (#qActTemp_C >= #iOverTempLimit_C) OR #qSensorFault THEN
    #statOverTempLatch := TRUE;
ELSIF #iAlarmReset AND (#qActTemp_C < (#iOverTempLimit_C - 5.0)) AND NOT #qSensorFault THEN
    #statOverTempLatch := FALSE;
END_IF;

IF #iEnable AND #iSafety_OK AND NOT #statOverTempLatch THEN
    #qPID_Out_Pct := #tempOut;
ELSE
    #qPID_Out_Pct := 0.0;
    #statIntegral := 0.0;
END_IF;`,
    hints: [
      '复位分支必须同时判断 3 个条件：#iAlarmReset、#qActTemp_C < (#iOverTempLimit_C - 5.0) 和 NOT #qSensorFault',
      '安全切断分支中两句赋值缺一不可：#qPID_Out_Pct := 0.0; 以及 #statIntegral := 0.0;',
    ],
    checks: [
      {
        label: '超温或断线时置位锁存 #statOverTempLatch := TRUE',
        test: (c) => /#qacttemp_c\s*>=\s*#iovertemplimit_c/.test(c) && /#statovertemplatch\s*:=\s*true/.test(c),
      },
      {
        label: '复位分支包含人工复位 #iAlarmReset 与 5.0°C 降温回差校验',
        test: (c) =>
          /#ialarmreset/.test(c) &&
          /#iovertemplimit_c\s*-\s*5(\.0)?/.test(c) &&
          /not\s+#qsensorfault/.test(c),
      },
      {
        label: '失能或超温时强置 #qPID_Out_Pct := 0.0 且清空 #statIntegral := 0.0',
        test: (c) => /#qpid_out_pct\s*:=\s*0(\.0)?/.test(c) && /#statintegral\s*:=\s*0(\.0)?/.test(c),
      },
    ],
  },
  {
    id: 'ch4-asrs-search',
    level: 4,
    title: '关卡 4 · 补全 4×3 立体库空仓位检索与满仓保护算法',
    fileRef: 'blocks/FB_CellSortingStation_Main.scl',
    difficulty: '核心算法',
    scenario:
      '视觉检验出合格电芯后，需要从 `Array[1..12] of UDT_WarehouseSlot` 中自下而上找到第 1 个“未占用且未被人工禁用锁定”的空仓位并退出循环；若 12 仓全满，则置位满仓报警并将状态机切入暂停态 `50 (Held)`。',
    requirements: [
      '编写 FOR #tempIdx := 1 TO 12 DO 循环遍历 #ioSlots[#tempIdx]',
      '判断 (NOT #ioSlots[#tempIdx].Occupied) AND (NOT #ioSlots[#tempIdx].Locked)，找到后记录 #tempFoundSlot := #tempIdx 并用 EXIT 跳出循环',
      '循环结束后若 #tempFoundSlot = 0，置位 #ioHMI.Alarms.ASRS_WarehouseFull := TRUE 且 #statPackML := 50',
    ],
    starterCode: `#tempFoundSlot := 0;
FOR #tempIdx := 1 TO 12 DO
    IF (* TODO: 当前仓位未占用 AND 未禁用锁定 *) THEN
        #tempFoundSlot := #tempIdx;
        (* TODO: 找到首个空仓即提前跳出循环 *)
    END_IF;
END_FOR;

IF #tempFoundSlot = 0 THEN
    (* TODO: 触发立体库满仓报警，并切入 PackML Held(50) 等待出库 *)
ELSE
    #statTargetSlotIdx := #tempFoundSlot;
    #statStep := 30;
END_IF;`,
    solutionCode: `#tempFoundSlot := 0;
FOR #tempIdx := 1 TO 12 DO
    IF (NOT #ioSlots[#tempIdx].Occupied) AND (NOT #ioSlots[#tempIdx].Locked) THEN
        #tempFoundSlot := #tempIdx;
        EXIT;
    END_IF;
END_FOR;

IF #tempFoundSlot = 0 THEN
    #ioHMI.Alarms.ASRS_WarehouseFull := TRUE;
    #statPackML := 50;
ELSE
    #statTargetSlotIdx := #tempFoundSlot;
    #statStep := 30;
END_IF;`,
    hints: [
      'SCL 中立即跳出 FOR 循环的关键字是 EXIT;',
      '检查未占用且未锁定：(NOT #ioSlots[#tempIdx].Occupied) AND (NOT #ioSlots[#tempIdx].Locked)',
      '满仓处理：#ioHMI.Alarms.ASRS_WarehouseFull := TRUE; #statPackML := 50;',
    ],
    checks: [
      {
        label: '同时判断 NOT Occupied 与 NOT Locked 条件',
        test: (c) =>
          /not\s+#ioslots\[#tempidx\]\.occupied/.test(c) &&
          /not\s+#ioslots\[#tempidx\]\.locked/.test(c),
      },
      {
        label: '找到首个可用仓位后使用 EXIT 提前终止循环',
        test: (c) => /#tempfoundslot\s*:=\s*#tempidx/.test(c) && /\bexit\s*;/.test(c),
      },
      {
        label: '满仓时触发 ASRS_WarehouseFull 报警并切入 #statPackML := 50',
        test: (c) =>
          /#iohmi\.alarms\.asrs_warehousefull\s*:=\s*true/.test(c) &&
          /#statpackml\s*:=\s*50/.test(c),
      },
    ],
  },
  {
    id: 'ch5-packml-ob100',
    level: 5,
    title: '关卡 5 · 排错：急停状态隔离与 OB100 断电数据防误清',
    fileRef: 'blocks/OB100_WarmRestart.scl',
    difficulty: '架构排错',
    scenario:
      'FAT 断电重启测试中爆发 2 个重大事故：① 断电重启后 OB100 竟然把 12 个立体库掉电保持仓位的 Occupied 和条码全清空了，导致再次入库直接撞碎已放好的电池！② 急停拍下时代码只跳了 50 (Held) 而没有跳 90 (Aborted) 清零步序。请修复这 2 处致命架构 Bug！',
    requirements: [
      '在 OB100 循环中删除清空 Occupied 和 ModuleBarcode 的错误赋值语句，仅保留坐标 PosX_mm / PosZ_mm 初始化',
      '急停断开 (NOT #iSafety_EStop_OK) 时强制跳入 #statPackML := 90 (Aborted) 并将 #statStep := 0',
    ],
    starterCode: `// === 事故代码段 A：OB100 上电初始化 ===
FOR #tempIdx := 1 TO 12 DO
    "DB_StationGlobal".WarehouseSlots[#tempIdx].PosX_mm := 480.0 + INT_TO_REAL(((#tempIdx - 1) MOD 4)) * 320.0;
    "DB_StationGlobal".WarehouseSlots[#tempIdx].PosZ_mm := 180.0 + INT_TO_REAL(((#tempIdx - 1) / 4)) * 240.0;
    "DB_StationGlobal".WarehouseSlots[#tempIdx].Occupied := FALSE;      // 致命BUG! 毁掉掉电保持!
    "DB_StationGlobal".WarehouseSlots[#tempIdx].ModuleBarcode := '';    // 致命BUG! 丢失追溯条码!
END_FOR;

// === 事故代码段 B：主控块急停捕获 ===
IF NOT #iSafety_EStop_OK THEN
    #statPackML := 50; // 致命BUG! 急停不能只进暂停 Held，必须进 Aborted(90) 且步序清零!
END_IF;`,
    solutionCode: `// === 修复后代码段 A：OB100 仅刷新机械坐标，严守 RETAIN 掉电保持数据 ===
FOR #tempIdx := 1 TO 12 DO
    "DB_StationGlobal".WarehouseSlots[#tempIdx].PosX_mm := 480.0 + INT_TO_REAL(((#tempIdx - 1) MOD 4)) * 320.0;
    "DB_StationGlobal".WarehouseSlots[#tempIdx].PosZ_mm := 180.0 + INT_TO_REAL(((#tempIdx - 1) / 4)) * 240.0;
END_FOR;

// === 修复后代码段 B：急停无条件瞬跳 Aborted(90) 并强制清零工步 ===
IF NOT #iSafety_EStop_OK THEN
    #statPackML := 90;
    #statStep := 0;
END_IF;`,
    hints: [
      '删掉 OB100 中给 .Occupied := FALSE 和 .ModuleBarcode := \'\' 赋值的两行！',
      '在急停判断体内改为 #statPackML := 90; 并补上 #statStep := 0; 强迫重新回零。',
    ],
    checks: [
      {
        label: 'OB100 保留 PosX_mm/PosZ_mm 坐标计算，且彻底移除清空 Occupied/Barcode 的语句',
        test: (c) =>
          /posx_mm/.test(c) &&
          !/occupied\s*:=\s*false/.test(c) &&
          !/modulebarcode\s*:=\s*''/.test(c),
      },
      {
        label: '急停断开时强制切入 Aborted (#statPackML := 90)',
        test: (c) => /#statpackml\s*:=\s*90/.test(c) && !/#statpackml\s*:=\s*50/.test(c),
      },
      {
        label: '急停断开时清零生产步序 (#statStep := 0) 防止误续跑',
        test: (c) => /#statstep\s*:=\s*0/.test(c),
      },
    ],
  },
];

export const INTERVIEW_QUESTIONS: InterviewQuestion[] = [
  {
    id: 1,
    category: 'PLC架构与FB',
    difficulty: '高频必考',
    question: '为什么你的双位气缸块 `FB_Cylinder2Pos` 要写成 FB（功能块）而不是 FC（函数）？',
    intent: '考察是否真正理解 FB 与 FC 的核心差异（静态内存 Static / 背景 DB），以及多重背景（Multi-Instance）的工程模块化意识。',
    answer:
      '气缸控制需要跨扫描周期记忆状态：包括目标命令锁存位、伸出/退回超时检测的 IEC 定时器（`TON_TIME`）以及双磁簧互斥故障锁存位。FC 没有专属静态存储区，若用 FC 必须把一大堆 InOut 外部变量挂在接口上，极其难维护；而 FB 拥有 `Static` 区与背景 DB，更关键的是可以在 `FB_CellSortingStation_Main` 中通过**多重背景（Multi-Instance）**把阻挡气缸、热压气缸实例化进同一个主背景 DB，代码 100% 复用且项目树极度整洁。',
  },
  {
    id: 2,
    category: 'PROFINET与伺服',
    difficulty: '高频必考',
    question: 'S7-1215C 控制 SINAMICS G120 变频器和 V90 伺服分别走的是什么报文？控制字 `16#047E` 和 `16#047F` 是什么意思？',
    intent: '验证你是否真正做过西门子驱动总线控制，而不是只停留在“画画梯形图起保停”的纸面阶段。',
    answer:
      '本项目里 G120 进料皮带只需调速，选用 **PROFIdrive 标准报文 1（2 PZD）**：PZD1 是控制字 `STW1` / 状态字 `ZSW1`，PZD2 是转速设定与反馈（`16#4000 = 16384` 代表 100% 基准转速）。控制字里 Bit10 必须为 1 声明由 PLC 接管控制，所以 `16#047E` 代表准备就绪/OFF1 斜坡停机，发 `16#047F`（Bit0 置 1）启动运行，故障复位发 `16#04FE`（Bit7 脉冲）。V90 立体库 X/Z 轴做绝对定位，可选**标准报文 3**（PLC 建工艺对象 TO，用 `MC_Power/MC_Home/MC_MoveAbsolute` 闭环）或**西门子报文 111**（驱动器内部 EPOS 定位，配标准库 `SINA_POS`）。',
  },
  {
    id: 3,
    category: 'PID温控与中断',
    difficulty: '高频必考',
    question: '热压温控 `PID_Compact` / 温控算法为什么要放在 `OB30` 循环中断里，而不能放在 `OB1` 主循环里？',
    intent: '考察对西门子组织块调度机制（OB1 vs OB3x）及离散控制采样周期 Δt 敏感性的理解。',
    answer:
      'PID 离散计算中的积分项 `Ki * e * Δt` 和微分项 `Kd * Δe / Δt` 强依赖严格恒定的时间间隔 `Δt`。`OB1` 是自由循环扫描，其周期会随着条件分支、通信负载或 HMI 监控波动（例如从 2ms 抖动到 15ms），把 PID 放进 `OB1` 会造成积分速度漂移、热压腔温度超调震荡。放到 `OB30` 并设定固定 100ms 硬件循环中断，无论主程序怎么忙，`OB30` 都能准时抢占执行，配合 1.0s SSR 脉宽调制把热压腔稳定在 85.0°C ±0.3°C。',
  },
  {
    id: 4,
    category: '数据保持与交付',
    difficulty: '高频必考',
    question: '工厂突然拉闸断电重启后，4×3 立体库里已存电芯的仓位占用状态和条码怎么防止丢失？`OB100` 里要注意什么大坑？',
    intent: '实战区分度极高的问题！考察掉电保持（RETAIN）机制与 `OB100` 启动初始化边界意识。',
    answer:
      '我在启用“优化的块访问”的 `DB_StationGlobal` 中，对 `WarehouseSlots[1..12]` 数组与 `ActiveRecipe` 按**变量级勾选了 `RETAIN`（掉电保持）**，避免占用零散的 M 存储区。同时在 `OB100` 上电初始化中，我做了严格区分：**只清零按钮瞬态指令并刷新 12 个仓位的固定机械坐标 `(PosX, PosZ)`，绝对禁止清零 `.Occupied` 和 `.ModuleBarcode`**——否则断电重启后会把已放满的仓位当成空仓再次入库导致撞机！',
  },
  {
    id: 5,
    category: '安全联锁与排错',
    difficulty: '高频必考',
    question: '在你的 OMAC PackML 状态机里，“急停拍下 (`Abort`)”和“普通暂停 (`Hold`)”是怎么区分处理的？',
    intent: '考察工业设备安全分级理念与状态机工程规范，区分新手“一刀切全复位”与老手“安全/工艺分层”。',
    answer:
      '两者属于完全不同的安全级别：`Hold` 是工艺受控暂停（如缺料、满仓、人工按暂停），设备有序减速停止，**保留当前 GRAFCET 步序 `#statStep` 记忆且热压腔维持保温**，排除异常后点击 `Unhold` 可从断点原地续跑，不报废半成品。而 `Abort`（拍急停或触发 ≥95°C 超温）是安全级强制响应：硬件安全继电器直接断开伺服/变频器 STO 和加热接触器，软件无论在哪个状态都**无条件瞬跳 `Aborted (90)` 并强清 `#statStep := 0`**，必须确认现场安全后依次执行 `Clear → Stopped → Reset` 重新全轴回零才能恢复生产。',
  },
  {
    id: 6,
    category: '安全联锁与排错',
    difficulty: '高频必考',
    question: '为什么现场急停按钮、停止按钮和安全门开关在电气接线时必须选用常闭触点（NC）？',
    intent: '考察工业电气安全底线思维（Fail-Safe 故障导向安全）。',
    answer:
      '核心原则是 **Fail-Safe（故障导向安全）**。常闭触点在正常待机时回路导通、PLC 输入为 `1`；一旦现场发生控制线被鼠咬断、端子松脱、24V 电源掉电或触点氧化接触不良，PLC 读入立刻变为 `0`，系统第一时间判定为急停/安全门断开并安全停机。如果错误地用常开触点（NO），万一急停线断了平时毫无察觉，真出人身事故拍急停根本停不下来！',
  },
  {
    id: 7,
    category: 'PLC架构与FB',
    difficulty: '高频必考',
    question: '什么是 PLC 编程里的“双线圈输出”事故？为什么在线监控看第一段明明绿了，现场电机却不转？',
    intent: '考察对 PLC 扫描周期 `PII → OB1 → PIQ` 底层原理的吃透程度。',
    answer:
      '因为西门子 PLC 在执行 `OB1` 期间只改写 CPU 内存中的输出过程映像区 `PIQ`，直到整个扫描周期末尾才把 `PIQ` 最终值一次性刷到物理硬件端子。如果在 Network 1 和 Network 2 对同一个地址（如 `%Q0.0`）写了两次线圈赋值，即便 Network 1 条件满足把 `PIQ[%Q0.0]` 置成 1，紧接着 Network 2 条件不满足又会把它覆写回 0（Last-Write-Wins），硬件继电器永远收不到高电平。工程规范严禁双线圈，同一物理输出全程序只允许赋值一次，多条件必须通过并联或中间标志位汇总。',
  },
  {
    id: 8,
    category: 'PROFINET与伺服',
    difficulty: '深度追问',
    question: 'V90 垂直 Z 轴伺服为什么必须选配带电磁抱闸的电机？急停和正常使能时抱闸时序怎么处理？',
    intent: '考察垂直重力轴机械电气协同安全经验。',
    answer:
      'Z 轴承载抓手与锂电模组，断电失去保持力矩后会因重力自由坠落砸坏热压模具甚至伤人，因此必须选配 **24V 失电制动型抱闸电机**。抱闸切忌由 PLC 普通 DO 瞎控制，而应交由 V90 驱动器按内部时序自动管理：启动时先建励磁力矩再延迟 50~100ms 打开抱闸防止溜车；停机时先让抱闸合闸锁紧再撤销电机励磁；急停时安全继电器切断 STO 同步失电锁死抱闸。',
  },
  {
    id: 9,
    category: 'PID温控与中断',
    difficulty: '深度追问',
    question: '热压腔从室温 25°C 加热到 85.0°C 过程中，你怎么防止 PID 出现严重温度过冲（Overshoot）？',
    intent: '考察 PID 实战整定功底，特别是大滞后温控对象的抗积分饱和经验。',
    answer:
      '电加热属于典型大惯性纯滞后对象，升温初期误差高达 60°C，如果普通 PID 一直狂加积分项，温度到达 85°C 时积分已经爆表，就会猛冲到 92°C 以上。我在 `FB_ThermalPress_PID` 中引入了**抗积分饱和（Anti-Windup）**：当 PID 输出达到 100% 限幅且误差仍为正时，冻结积分累加器不再上涨，并对积分上限做 80% 钳位；若使用博途内置 `PID_Compact`，则先执行冷机预调节（Pretuning）再做稳态精确调节（Fine Tuning），将实测超调压在 0.3°C 以内。',
  },
  {
    id: 10,
    category: 'PID温控与中断',
    difficulty: '深度追问',
    question: '热压腔发生超温（≥95°C）后，为什么不能等温度自然降到 94.9°C 就自动恢复加热？',
    intent: '考察安全锁存与滞环回差（Hysteresis）工程防呆意识。',
    answer:
      '第一，超温往往意味着 SSR 固态继电器击穿常通、散热风机停转或热电偶松脱等实质隐患，如果不锁存而自动恢复，设备会在 95°C 临界点反复震荡干烧电池引发热失控起火；第二，必须同时具备**超温故障锁存 + 降温回差（本案设 5°C，需降至 90.0°C 以下）+ 人工现场排查确认复位**三重条件，才允许解除超温保护。',
  },
  {
    id: 11,
    category: '安全联锁与排错',
    difficulty: '深度追问',
    question: '气缸双磁簧开关互斥检测为什么加了 150ms 延时定时器，而不是检测到同时为 1 就立刻报警？',
    intent: '考察现场抗干扰与防抖实战细节。',
    answer:
      '极短行程气缸或高灵敏度磁簧开关在高速切换瞬间、或周围大功率接触器吸合电磁干扰下，可能出现 10~30ms 的信号重叠毛刺；如果不加防抖会造成产线频繁误停机影响 OEE。加 150ms `TON` 滤波既能过滤瞬态干扰，又远快于气缸动作与机械手联锁周期，确保一旦磁簧真粘连或线路短接，立刻锁存 `FaultCode = 103` 并切断双侧电磁阀。',
  },
  {
    id: 12,
    category: 'PROFINET与伺服',
    difficulty: '高频必考',
    question: '现场 PROFINET 组网刚下载完程序，CPU 狂闪红色 ERROR/BF 灯报“找不到 IO 设备”，你的排查顺序是什么？',
    intent: '考察现场真实排障能力，几乎是西门子岗位必问题。',
    answer:
      '我按“从软到硬、先名后网”四步定位：① **优先查 PROFINET 设备名称（Device Name）**——80% 的故障是因为只改了 IP 忘了在线分配设备名，或大小写/短横线不一致；② 打开博途“在线诊断缓冲区（Diagnostics Buffer）”看具体缺哪个槽位、是 GSDML 固件不匹配还是模块订货号选错；③ 查工业交换机网口 Link/Act 灯与网线压线/屏蔽层接地；④ 用 PRONETA 或博途“可访问设备”扫描验证有无 IP 冲突。',
  },
  {
    id: 13,
    category: 'PLC架构与FB',
    difficulty: '深度追问',
    question: '西门子 S7-1200/1500 的“优化的块访问（Optimized Block Access）”和非优化 DB 有什么区别？什么时候必须关闭优化？',
    intent: '考察对博途新版平台底层内存管理的掌握。',
    answer:
      '优化 DB 由 TIA Portal 编译器按数据类型自动最优对齐排布内存，CPU 访存更快、支持**符号寻址**（增删中间变量不影响原有偏移）且能**按单个变量独立勾选 RETAIN**（比如我只保持立体库数组而不保持临时报警位）。只有在必须与不支持符号访问的旧系统交互时——例如通过绝对地址 `DB1.DBD0` 对接老版 WinCC、第三方 Modbus/OPC 网关或 S7-300/400 `PUT/GET` 通信时，才在块属性里取消勾选优化访问。',
  },
  {
    id: 14,
    category: '数据保持与交付',
    difficulty: '架构压轴',
    question: '如果机械团队把立体库从 4×3 扩容成 5×4（20 个仓位），或者客户要在视觉后新增 1 个扫码复核气缸，你的软件改造成本有多大？',
    intent: '考察软件可扩展性、解耦设计与工业工程复盘能力。',
    answer:
      '改动量非常小且风险可控：因为所有执行器与数据模型都已经 UDT/FB 解耦。新增 1 个气缸只需在主控 FB 的 `Static` 区追加 1 个 `FB_Cylinder2Pos` 多重背景实例并绑定新 I/O，超时/互斥/报警框架自动生效；立体库扩到 5×4 只需将 `DB_StationGlobal.WarehouseSlots` 上限改为 20，修改 `OB100` 的列数常量 `5` 与检索循环上限，完全无需重写核心状态机和坐标解算架构。',
  },
  {
    id: 15,
    category: '数据保持与交付',
    difficulty: '架构压轴',
    question: '新装配好的非标设备第一次通电调试，你怎么保证绝不把几十万的视觉相机和伺服轴撞毁？',
    intent: '考察一线工程安全习惯与成熟度（老工程师与纯小白的分水岭）。',
    answer:
      '我严格执行“五步安全上电法”：① **断电冷态查线**：万用表测 24V/0V 及主回路对地绝缘防短路；② **分段上电与 I/O 打点**：先仅通控制电源（断开动力和气源），逐点触发传感器核对 DI 极性与地址表一致；③ **低压单动气缸**：调压阀降到 0.2MPa 手动点动每个电磁阀，确认伸出/退回方向与磁簧一一对应；④ **伺服低速点动与限位验证**：10% 速度试转确认旋向、软/硬限位及 Z 轴抱闸动作正常后回零；⑤ **降速空跑与 FAT 故障注入**：20% 速度空跑全自动，确认无干涉后再提速带料并逐项完成急停、断电保持和超温验收。',
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
  const roleMeta: Record<TargetRole, { title: string; roleName: string; focus: string }> = {
    'plc-engineer': {
      title: 'PLC 电气自动化工程师',
      roleName: 'PLC 控制软件主研 / 独立电气开发',
      focus: '侧重博途模块化编程、PROFINET 驱动报文、OB30 PID 闭环与现场 FAT/SAT 联调能力',
    },
    'nonstandard-control': {
      title: '非标自动化设备控制工程师',
      roleName: '非标单机与产线集成控制工程师',
      focus: '侧重 URS 节拍拆解、PackML 标准化框架、多重背景复用、安全联锁与快速换型交付',
    },
    'smart-mfg-trainee': {
      title: '智能制造 / 产线自动化管培生',
      roleName: '产线自动化系统研发与数字孪生实训负责人',
      focus: '侧重 OT/IT 数据追溯、WinCC SCADA 监控看板、OEE 分析与工业标准工程文档输出',
    },
  };

  const levelVerb: Record<MasteryLevel, { lead: string; depth: string }> = {
    solid: {
      lead: '独立完成核心模块开发与联调',
      depth: '完整搭建并仿真验证了整套 S7-1215C 控制系统与可导入 TIA Portal 工程源码',
    },
    proficient: {
      lead: '主导整站 PLC 架构设计、编码实现与虚拟联调',
      depth: '从 URS 需求拆解、硬件 BOM/IO 点表冻结到模块化 SCL 编码与 FAT 故障注入全流程独立交付',
    },
    lead: {
      lead: '统筹电气控制系统全生命周期架构设计与标准化落地',
      depth: '建立可复用的西门子标准设备 FB 库与 PackML 产线模板，显著压缩多机型非标交付周期',
    },
  };

  const r = roleMeta[opts.role];
  const l = levelVerb[opts.level];

  const actions: string[] = [];
  if (opts.includeProfinet) {
    actions.push(
      '基于 SIMATIC S7-1215C 规划星型 PROFINET IO 实时网络（联接 TP700 HMI、ET200SP 分布式 IO、智能视觉相机及 SINAMICS G120/V90 驱动器），编写 G120 标准报文 1（STW1/ZSW1 及 16#4000 转速标定）控制封装块与 V90 X/Z 双轴绝对定位控制接口；'
    );
  }
  if (opts.includePackml) {
    actions.push(
      '摒弃传统面条式梯形图，采用 OMAC PackML（外层安全与模式管理）+ GRAFCET（内层 5 步工艺顺控）双层 SCL 状态机架构，并通过多重背景（Multi-Instance）封装标准化双位气缸块 FB_Cylinder2Pos（内置 150ms 双磁簧互斥粘连检测、动作超时报警与安全防撞互锁）；'
    );
  }
  if (opts.includePid) {
    actions.push(
      '将热压固化腔闭环温控部署于 OB30（100ms 恒定循环中断）中消除 OB1 扫描抖动影响，引入抗积分饱和 PI 控制 + 1.0s SSR PWM 调制，并设计“超温锁存（≥95°C）+ 5°C 降温回差 + 人工确认复位”双重安全联锁；'
    );
  }
  if (opts.includeRetain) {
    actions.push(
      '设计 UDT 配方与 4×3 立体库仓位数据模型，在优化数据块 DB_StationGlobal 中按变量级开启 RETAIN 掉电保持，并在 OB100 上电初始化中严格分离机械坐标刷新与在库条码保护，配套 WinCC Unified 风格 SCADA 监控看板与标准化报警管理。'
    );
  }
  if (actions.length === 0) {
    actions.push('完成 S7-1215C 整站 I/O 点表设计、模块化 SCL 控制程序编写、气缸/变频器标准块封装与人机监控画面开发。');
  }

  const resultLine =
    opts.role === 'smart-mfg-trainee'
      ? '支持 3 款动力电池模组一键配方柔性切换，单件生产节拍稳定在 11.2s（UPH > 320），热压恒温精度达 85.0°C ±0.3°C；实现 12 仓位电芯条码与热压峰值温度 100% 掉电留痕可追溯，并输出完整 FDS 说明书、TIA Portal 可导入 SCL 工程包与 FAT 故障注入验收报告。'
      : '实现 3 款锂电模组一键配方换型，单件节拍优化至 11.2s（UPH > 320），热压腔恒温控温精度稳定在 85.0°C ±0.3°C（超调 < 0.4°C）；通过急停瞬断 STO、双磁簧互斥粘连、超温锁存及断电重启仓位零丢失全套 FAT 故障注入测试，同类气缸与驱动模块复用率提升至 85% 以上。';

  if (opts.format === 'plain') {
    return [
      `项目名称：基于西门子 S7-1215C + PROFINET 的新能源锂电模组柔性视觉分拣、热压固化与立体入库工作站`,
      `担任角色：${r.roleName}（适配岗位：${r.title}）`,
      ``,
      `【项目背景与目标 (S/T)】`,
      `面向动力电池模组后段产线多型号换型慢、热压温控易超调及立体库人工溯源易错位等痛点，${l.lead}，${l.depth}。`,
      ``,
      `【核心技术架构与实施动作 (A)】`,
      ...actions.map((a, i) => `${i + 1}. ${a}`),
      ``,
      `【量化工程成果 (R)】`,
      resultLine,
    ].join('\n');
  }

  return [
    `### 基于西门子 S7-1215C + PROFINET 的新能源锂电模组柔性视觉分拣、热压固化与立体入库工作站`,
    `**角色定位**：${r.roleName} | **技术栈**：\`SIMATIC S7-1215C\` \`TIA Portal V18 (SCL/LAD)\` \`PROFINET IO\` \`SINAMICS G120/V90\` \`PackML\` \`OB30 PID\` \`WinCC HMI\``,
    ``,
    `- **项目背景与目标 (S/T)**：针对新能源锂电模组段多品种柔性换型、高精度恒温热压及立体入库溯源需求，${l.lead}，${l.depth}。`,
    `- **核心技术架构与动作 (A)**：`,
    ...actions.map((a) => `  - ${a}`),
    `- **量化工程成果 (R)**：${resultLine}`,
  ].join('\n');
}
