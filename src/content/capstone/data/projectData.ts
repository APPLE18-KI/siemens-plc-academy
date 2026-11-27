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

export {
  INTERVIEW_QUESTIONS,
  generateStarResume,
  type InterviewQuestion,
  type InterviewScoringPoint,
  type MasteryLevel,
  type ResumeOptions,
  type TargetRole,
} from './interviewAndResume';

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

