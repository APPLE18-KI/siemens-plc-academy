/**
 * 新手术语表：用大白话解释课程里反复出现的关键词。
 * - term：显示名；aliases：在正文里用 [[别名]] 也能匹配到同一词条
 * - lessonId：首次详细讲解的课程（可选），术语表页会给出跳转
 */
export interface GlossaryTerm {
  id: string;
  term: string;
  en?: string;
  aliases?: string[];
  category: '基础概念' | '电气元件' | '编程指令' | '程序结构' | '通讯与模拟量' | '工程实践';
  short: string;
  detail?: string;
  lessonId?: string;
}

export const GLOSSARY: GlossaryTerm[] = [
  {
    id: 'plc',
    term: 'PLC',
    en: 'Programmable Logic Controller',
    aliases: ['可编程逻辑控制器'],
    category: '基础概念',
    short: '可编程逻辑控制器，工厂设备用的“小电脑”：读入按钮和传感器信号，按程序做判断，再去控制电机、气缸、指示灯。',
    detail: '相比普通电脑，PLC 抗干扰、耐高低温、能长时间连续运行。本课程使用西门子 S7-1200。',
    lessonId: 'l00-before-you-start',
  },
  {
    id: 'cpu',
    term: 'CPU',
    aliases: ['CPU 模块'],
    category: '基础概念',
    short: 'PLC 的主机模块，负责运行程序。S7-1200 的 CPU（如 1214C）本身还自带一些输入输出点。',
    detail: '型号后缀如 DC/DC/DC 依次表示：供电电源 / 数字量输入 / 数字量输出的类型。',
    lessonId: 'l01-what-is-plc',
  },
  {
    id: 'ob1',
    term: 'OB1',
    aliases: ['主程序', 'Main'],
    category: '程序结构',
    short: '主程序块。PLC 运行时会一遍又一遍地循环执行 OB1 里的程序。',
    detail: 'OB 是“组织块”，由操作系统调用。除 OB1 外还有启动时执行一次的 OB100、按固定时间间隔执行的 OB30 等。',
    lessonId: 'l03-scan-cycle-pii-piq',
  },
  {
    id: 'scan-cycle',
    term: '扫描周期',
    aliases: ['扫描'],
    category: '基础概念',
    short: 'PLC 不停重复的一轮工作：读入所有输入 → 执行一遍程序 → 写出所有输出。一轮通常只有几毫秒。',
    lessonId: 'l03-scan-cycle-pii-piq',
  },
  {
    id: 'process-image',
    term: '过程映像（PII / PIQ）',
    aliases: ['PII', 'PIQ', 'PII/PIQ', '过程映像', '过程映像输入', '过程映像输出'],
    category: '基础概念',
    short: 'PLC 每轮扫描开始时把所有输入“拍一张照”存到 PII，程序只读这张照片；算完的输出先写进 PIQ，最后统一送到端子。',
    detail: '所以在同一轮扫描里，输入信号即使变化了，程序看到的也是同一个值。',
    lessonId: 'l03-scan-cycle-pii-piq',
  },
  {
    id: 'no-nc',
    term: '常开/常闭触点',
    en: 'NO / NC',
    aliases: ['常开', '常闭', '常开触点', '常闭触点', 'NO', 'NC'],
    category: '电气元件',
    short: '常开（NO）平时断开、动作时接通；常闭（NC）平时接通、动作时断开。',
    detail: '梯形图里的 -| |- 是程序常开触点，-|/|- 是程序常闭触点。注意：物理按钮的常开常闭和程序里的触点是两回事，“源型/漏型接线”一讲会专门讲急停为什么“物理接常闭、程序用常开”。',
    lessonId: 'l02-wiring-npn-pnp',
  },
  {
    id: 'coil',
    term: '线圈',
    aliases: ['输出线圈'],
    category: '编程指令',
    short: '梯形图一行最右边的输出元件 -( )-：左边条件全部满足（能流通过）时，对应的输出或中间变量就为 1。',
    lessonId: 'l05-seal-in-jog',
  },
  {
    id: 'set-reset',
    term: '置位/复位',
    en: 'S / R',
    aliases: ['置位', '复位', 'S/R'],
    category: '编程指令',
    short: '置位（S）让一个点变为 1 并保持住，直到复位（R）才变回 0。适合“按一下就记住”的场合。',
    lessonId: 'l06-interlock-edge',
  },
  {
    id: 'edge',
    term: '边沿',
    aliases: ['上升沿', '下降沿', 'P_TRIG', 'N_TRIG'],
    category: '编程指令',
    short: '信号从 0 变 1 的那一瞬间叫上升沿，从 1 变 0 叫下降沿。用它可以做到“按一下只算一次”。',
    lessonId: 'l06-interlock-edge',
  },
  {
    id: 'timers',
    term: 'TON / TOF / TP',
    aliases: ['TON', 'TOF', 'TP', '定时器'],
    category: '编程指令',
    short: 'IEC 定时器：TON 接通延时（条件满足一段时间后才输出）；TOF 断开延时（条件消失后再延迟一会儿才断）；TP 脉冲（触发后输出固定时长）。',
    lessonId: 'l07-iec-timers',
  },
  {
    id: 'ctu',
    term: 'CTU',
    aliases: ['计数器', 'CTD', 'CTUD'],
    category: '编程指令',
    short: '加计数器：每来一个上升沿就加 1，到达设定值（PV）后输出 Q 为 1。常用于数产品个数。',
    lessonId: 'l08-iec-counters',
  },
  {
    id: 'db',
    term: 'DB',
    aliases: ['数据块', '背景数据块', 'Instance DB', '全局 DB'],
    category: '程序结构',
    short: '数据块，用来存放数据的“表格”。全局 DB 大家都能读写；背景 DB 专门给某个 FB 存它自己的数据。',
    lessonId: 'l10-fc-fb-instance-db',
  },
  {
    id: 'fb-fc',
    term: 'FB / FC',
    aliases: ['FB', 'FC', '功能块', '函数'],
    category: '程序结构',
    short: '可重复调用的程序块。FC 没有“记忆”，每次调用从零算起；FB 带背景 DB，能记住上一次的状态（比如定时器、步序）。',
    lessonId: 'l10-fc-fb-instance-db',
  },
  {
    id: 'udt',
    term: 'UDT',
    aliases: ['自定义数据类型'],
    category: '程序结构',
    short: '自定义数据类型：把一台设备相关的多个变量（启动、故障、速度……）打包成一个结构，方便批量复用。',
    lessonId: 'l11-udt-global-db',
  },
  {
    id: 'lad',
    term: 'LAD',
    aliases: ['梯形图'],
    category: '编程指令',
    short: '梯形图，最常用的 PLC 图形化编程语言，画法像电气原理图：左边是条件（触点），右边是结果（线圈）。',
    lessonId: 'l01-what-is-plc',
  },
  {
    id: 'scl',
    term: 'SCL',
    aliases: ['结构化控制语言'],
    category: '编程指令',
    short: '西门子的文本编程语言，写法接近 Pascal，适合计算、循环和状态机。赋值用 :=。',
    lessonId: 'l12-scl-state-machine',
  },
  {
    id: 'profinet',
    term: 'PROFINET',
    category: '通讯与模拟量',
    short: '西门子主推的工业以太网通讯。一根网线可以连接电脑、触摸屏、变频器、远程 I/O。',
    lessonId: 'l15-profinet-project-delivery',
  },
  {
    id: 'source-sink',
    term: '源型/漏型',
    en: 'PNP / NPN',
    aliases: ['源型', '漏型', 'NPN', 'PNP', 'NPN/PNP'],
    category: '电气元件',
    short: '描述传感器和 PLC 输入之间电流流向的两种接法。传感器常见 NPN 和 PNP 两种，必须和 PLC 输入公共端的接法匹配，否则信号进不来。',
    lessonId: 'l02-wiring-npn-pnp',
  },
  {
    id: 'pid',
    term: 'PID',
    aliases: ['PID_Compact', 'PID 控制'],
    category: '通讯与模拟量',
    short: '一种自动调节算法：比较“目标值”和“实际值”的差距，自动调整输出（如加热功率、水泵转速），让实际值稳定在目标附近。',
    lessonId: 'l14-pid-compact-process',
  },
  {
    id: '4-20ma',
    term: '4-20mA',
    aliases: ['模拟量', '4~20mA'],
    category: '通讯与模拟量',
    short: '工业上最常用的模拟量信号：用 4mA 到 20mA 的电流表示测量范围（如 0~10bar）。4mA 而不是 0mA 起步，是为了能发现断线。',
    lessonId: 'l13-analog-norm-scale',
  },
  {
    id: 'hmi',
    term: 'HMI',
    aliases: ['触摸屏', '人机界面', 'WinCC'],
    category: '工程实践',
    short: '人机界面，也就是设备上的触摸屏或监控画面，操作工在上面看状态、按按钮、改参数。',
    lessonId: 'l15-profinet-project-delivery',
  },
  {
    id: 'digital-twin',
    term: '数字孪生',
    aliases: ['孪生', '设备模型'],
    category: '工程实践',
    short: '在电脑里做一个会“动”的设备模型，用来代替真实设备测试程序。本站的“设备模型”页就是简化的数字孪生。',
  },
  {
    id: 'double-coil',
    term: '双线圈',
    aliases: ['双线圈问题'],
    category: '工程实践',
    short: '同一个输出在程序里被两个线圈赋值。由于是从上到下执行，后面的会覆盖前面的，导致前面的逻辑“失灵”。新手最常见的错误之一。',
    lessonId: 'l03-scan-cycle-pii-piq',
  },
  {
    id: 'tia-portal',
    term: 'TIA Portal',
    aliases: ['博途', 'TIA'],
    category: '基础概念',
    short: '西门子的自动化工程软件（博途），用来做硬件配置、写 PLC 程序、做触摸屏画面和在线调试。',
    lessonId: 'l00-before-you-start',
  },
  {
    id: 'plcsim',
    term: 'S7-PLCSIM',
    aliases: ['PLCSIM'],
    category: '基础概念',
    short: '西门子官方的 PLC 仿真软件，没有真实硬件时可以把博途里的程序下载到它里面运行和调试。',
    lessonId: 'l00-before-you-start',
  },
  {
    id: 'contactor',
    term: '继电器/接触器',
    aliases: ['继电器', '接触器'],
    category: '电气元件',
    short: '用小电流控制大电流的电动开关：线圈得电后吸合触点。PLC 输出点驱动接触器线圈，接触器再去接通电机。',
    lessonId: 'l00-before-you-start',
  },
  {
    id: 'byte-word',
    term: '字节/字/双字',
    aliases: ['字节', '字', '双字', 'Byte', 'Word', 'DWord'],
    category: '基础概念',
    short: '数据的“盒子大小”：1 字节（B）= 8 位，1 字（W）= 2 字节 = 16 位，1 双字（D）= 4 字节 = 32 位。地址里的字母就表示大小，如 %MB10、%MW10、%MD10。',
    detail: '%MW10 占用 %MB10 和 %MB11，%MD10 占用 %MB10~%MB13，所以字和双字地址之间要留够间隔，否则会互相覆盖（“地址重叠”）。',
    lessonId: 'l03b-data-types',
  },
  {
    id: 'hex',
    term: '十六进制（16#）',
    aliases: ['十六进制', '16#'],
    category: '基础概念',
    short: '西门子用 16# 开头表示十六进制数，如 16#FF = 255。每一位十六进制正好对应 4 个二进制位，看“哪几位是 1”很方便。',
    lessonId: 'l03b-data-types',
  },
  {
    id: 'compile-download',
    term: '编译/下载',
    aliases: ['编译', '下载'],
    category: '工程实践',
    short: '编译：让博途检查程序有没有写错，并翻译成 PLC 能执行的代码；下载：把编译好的程序和配置“装进”PLC（真机或 PLCSIM）。',
    detail: '只改了程序不下载，PLC 里运行的还是旧程序；下载前要先编译通过。',
    lessonId: 'l01b-tia-first-project',
  },
  {
    id: 'online-monitor',
    term: '在线监视',
    aliases: ['监视', '在线'],
    category: '工程实践',
    short: '电脑和 PLC 连上后，在博途里实时看程序运行状态：通电的线显示绿色实线，没通电的是蓝色虚线，变量旁边显示当前值。',
    lessonId: 'l01b-tia-first-project',
  },
  {
    id: 'ip-address',
    term: 'IP 地址/网段',
    aliases: ['IP 地址', 'IP', '网段', '子网掩码'],
    category: '通讯与模拟量',
    short: '网线连接的设备各自的“门牌号”，如 192.168.0.1。电脑和 PLC 要在同一网段（前三段相同，子网掩码 255.255.255.0）才能互相找到。',
    lessonId: 'l06b-troubleshooting-safety',
  },
  {
    id: 'pgpc',
    term: 'PG/PC 接口',
    aliases: ['PG/PC'],
    category: '工程实践',
    short: '博途用电脑上的哪块网卡（或 PLCSIM）去连接 PLC。选错网卡（比如选成了无线网卡）是“搜不到 PLC”最常见的原因。',
    lessonId: 'l06b-troubleshooting-safety',
  },
  {
    id: 'diag-buffer',
    term: '诊断缓冲区',
    aliases: ['诊断'],
    category: '工程实践',
    short: 'CPU 自动记下的“故障日记”：什么时间出了什么错、CPU 为什么停机。ERROR 灯亮时先看它，比猜原因快得多。',
    lessonId: 'l06b-troubleshooting-safety',
  },
  {
    id: 'force',
    term: '强制',
    aliases: ['强制表'],
    category: '工程实践',
    short: '调试时把某个输入/输出点“锁定”在指定值，不管程序怎么算都不变。会绕过程序里的安全逻辑，用完必须取消（在强制表里点“停止强制”）。',
    lessonId: 'l06b-troubleshooting-safety',
  },
];

const INDEX = new Map<string, GlossaryTerm>();
for (const t of GLOSSARY) {
  INDEX.set(t.term.toLowerCase(), t);
  INDEX.set(t.id.toLowerCase(), t);
  for (const a of t.aliases ?? []) INDEX.set(a.toLowerCase(), t);
}

/** 按词条名、id 或别名查找（不区分大小写） */
export function findGlossaryTerm(key: string): GlossaryTerm | undefined {
  return INDEX.get(key.trim().toLowerCase());
}

export const GLOSSARY_CATEGORIES: GlossaryTerm['category'][] = [
  '基础概念',
  '电气元件',
  '编程指令',
  '程序结构',
  '通讯与模拟量',
  '工程实践',
];
