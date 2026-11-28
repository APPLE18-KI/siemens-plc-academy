import { decodePlcToken } from '../app/layout/plcAddressDecoder';

export interface CodeTokenInfo {
  token: string;
  badge: string;
  title: string;
  summary: string;
  tip?: string;
  linkTo?: string;
  linkLabel?: string;
}

const STATIC_HELP: Record<string, Omit<CodeTokenInfo, 'token'>> = {
  ':=': {
    badge: 'SCL 赋值运算符',
    title: ':= 表示“把右边算出的结果写进左边”',
    summary: '在西门子 SCL 里，赋值必须写冒号加等号 := ；单个等号 = 仅用来在 IF 条件里判断“是否相等”。',
    tip: '新手高频报错：把 #Run := TRUE 错写成 #Run = TRUE 会直接编译报错！',
    linkTo: '/learn/l12-scl-state-machine',
    linkLabel: '看第 12 讲：SCL 语法入门',
  },
  '=>': {
    badge: 'SCL 输出管脚连接符',
    title: '=> 表示“把功能块的输出管脚读到外部变量”',
    summary: '调用 FB / 定时器 / 计数器时，输入管脚用 := 传进去，输出管脚用 => 接出来（例如 Q => #Done）。',
  },
  '<>': {
    badge: '比较运算符',
    title: '<> 表示“不等于”',
    summary: '判断左右两个值是否不相等（相当于 C/Python 里的 !=），例如 IF #Step <> 0 THEN。',
  },
  AND: {
    badge: '逻辑与',
    title: 'AND = 串联条件（所有条件同时为 1 才成立）',
    summary: '对应梯形图里排成一横排的串联触点，只要有一个条件为 0，整条结果就为 0。',
  },
  OR: {
    badge: '逻辑或',
    title: 'OR = 并联条件（任意一个为 1 就成立）',
    summary: '对应梯形图里的上下并联分支（比如“启动按钮 OR 自锁触点”）。建议和 AND 混用时一定加括号 ()！',
  },
  NOT: {
    badge: '逻辑非',
    title: 'NOT = 取反（0 变 1，1 变 0）',
    summary: '对应梯形图里的常闭触点 -|/|-，常用于安全条件判断，如 NOT #Fault（无故障时允许运行）。',
  },
  IF: {
    badge: 'SCL 分支语句',
    title: 'IF ... THEN ... ELSIF ... ELSE ... END_IF',
    summary: '按条件决定执行哪一段代码。每个 IF 必须以 END_IF; 收尾，注意分号不能漏。',
    linkTo: '/learn/l12-scl-state-machine',
    linkLabel: '看 SCL 分支与状态机',
  },
  CASE: {
    badge: 'SCL 状态机核心',
    title: 'CASE #Step OF ... END_CASE（工步状态机）',
    summary: '西门子做顺序控制最干净的写法：根据 #statStep 的数字（0、10、20、30）决定当前只执行哪一步动作。',
    tip: '工程规范：步号按 10、20、30 留间隔，日后现场要插一步“15 吹气检测”不用重写所有步号！',
    linkTo: '/workflows?wf=grafcet-packml',
    linkLabel: '看状态机动态演示',
  },
  FOR: {
    badge: 'SCL 循环语句',
    title: 'FOR #i := 1 TO N DO ... END_FOR',
    summary: '按固定次数遍历数组（例如扫描立体库 1..12 号仓位）。找到目标后常用 EXIT; 提前结束循环减少扫描耗时。',
  },
  EXIT: {
    badge: '循环控制',
    title: 'EXIT; 立即跳出当前 FOR / WHILE 循环',
    summary: '在数组检索中一旦找到首个符合条件的仓位，用 EXIT; 马上跳出，避免被后面空位覆盖并缩短 OB1 扫描时间。',
  },
  REGION: {
    badge: '博途代码折叠区',
    title: 'REGION 标题 ... END_REGION',
    summary: 'TIA Portal 专用的代码分区折叠语法，不影响执行逻辑，但能让上千行 SCL 像目录一样清晰折叠。',
  },
  FUNCTION_BLOCK: {
    badge: '功能块 (FB)',
    title: 'FB = 带“专属记忆本（背景 DB）”的模块化程序块',
    summary: '适合封装需要记忆状态的设备（如气缸超时计时、电机运行状态、PID 积分），拖 10 台气缸只需写 1 个 FB！',
    linkTo: '/learn/l10-fc-fb-instance-db',
    linkLabel: '看第 10 讲：FC 与 FB 区别',
  },
  FUNCTION: {
    badge: '函数 (FC)',
    title: 'FC = 不带背景 DB 的纯计算/工具块',
    summary: '每次调用只做输入到输出的即时运算（如换算公式、校验计算），内部不能靠静态变量跨周期记忆状态。',
    linkTo: '/learn/l10-fc-fb-instance-db',
    linkLabel: '看第 10 讲：FC 与 FB',
  },
  VAR_TEMP: {
    badge: '临时变量区',
    title: 'Temp 临时变量：每次调用结束即释放，严禁用来做自锁！',
    summary: '只用于本周期中间过渡计算，使用前必须先赋值再读取。需要跨周期记住的状态请放进 Static (VAR)！',
    tip: '新手高频坑：把自锁位或上升沿记忆位放进 Temp，结果永远锁不住或乱触发！',
  },
  VAR: {
    badge: '静态变量区 (Static)',
    title: 'Static 静态变量：存在背景 DB 里，跨扫描周期一直记住',
    summary: 'FB 的状态机步号、故障锁存位、多重背景定时器（TON_TIME）全放在这个区。',
  },
  TYPE: {
    badge: '用户自定义数据类型 (UDT)',
    title: 'UDT = 把一台设备的全部信号打包成一个标准模板',
    summary: '如把气缸的伸出、退回、到位传感器、报警打包成一个结构体，一处修改全局同步。',
    linkTo: '/learn/l11-udt-global-db',
    linkLabel: '看第 11 讲：UDT 与全局 DB',
  },
  TON: {
    badge: 'IEC 接通延时定时器',
    title: 'TON：IN 持续为 1 满 PT 时间后，Q 才变成 1',
    summary: 'IN 一旦中途断开变成 0，当前计时 ET 立即清零归零、Q 立刻变 0。最常用于星三角切换、防抖滤波与超时报警。',
    tip: '必须保证 IN 持续接通不中断才能计满！',
    linkTo: '/learn/l07-iec-timers',
    linkLabel: '看第 7 讲：TON/TOF/TP 时序图',
  },
  TON_TIME: {
    badge: 'IEC 定时器背景类型',
    title: 'TON_TIME：在 FB 静态区声明多重背景 TON 定时器',
    summary: '不用为每个定时器单独建一个 DB 块，直接封装在 FB 内部，实现“一拖即用”。',
  },
  TOF: {
    badge: 'IEC 关断延时定时器',
    title: 'TOF：IN 一接通 Q 马上为 1；IN 断开后再延时 PT 才关断',
    summary: '典型应用：主轴停机后冷却风扇继续吹风 30 秒再停、人离开后照明延迟熄灭。',
    linkTo: '/learn/l07-iec-timers',
    linkLabel: '看 TON/TOF/TP 对比',
  },
  TP: {
    badge: 'IEC 脉冲定时器',
    title: 'TP：IN 给一个上升沿，Q 固定输出时长为 PT 的脉冲',
    summary: '即使 IN 提前松开甚至反复抖动，Q 也会稳稳输出完整 PT 时间（常用于气缸吹气脉冲或蜂鸣器定长响）。',
  },
  CTU: {
    badge: 'IEC 加计数器',
    title: 'CTU：CU 每来一次上升沿（0→1），当前值 CV 加 1',
    summary: '当 CV >= 设定值 PV 时，输出 Q 变 1；给 R 管脚 1 则将 CV 清零复位。常用于产线计件与满箱触发。',
    linkTo: '/learn/l08-iec-counters',
    linkLabel: '看第 8 讲：计数器实操',
  },
  R_TRIG: {
    badge: '上升沿检测',
    title: 'R_TRIG / P_TRIG：只在信号由 0 变 1 的那 1 个扫描周期输出 1',
    summary: '防止按住按钮不放时程序每 5ms 重复加 1（把按一次按钮算成几百次！）。',
    linkTo: '/learn/l06-interlock-edge',
    linkLabel: '看第 6 讲：互锁与边沿检测',
  },
  P_TRIG: {
    badge: '上升沿检测',
    title: 'P_TRIG：能流由 0 变 1 的瞬间导通一个扫描周期',
    summary: '需要配一个独立的布尔存储位记住上一周期状态，切勿多个边沿共用同一个记忆位！',
    linkTo: '/learn/l06-interlock-edge',
    linkLabel: '看第 6 讲：上升沿实战',
  },
  F_TRIG: {
    badge: '下降沿检测',
    title: 'F_TRIG / N_TRIG：只在信号由 1 变 0 的瞬间输出 1 个周期',
    summary: '常用于“工件刚刚离开光电开关的瞬间”触发下料动作或计件。',
  },
  NORM_X: {
    badge: '模拟量归一化',
    title: 'NORM_X：把 0..27648 原始整数压成 0.0..1.0 的小数比例',
    summary: '西门子 S7-1200 模拟量换算第一步！公式：OUT = (VALUE - MIN) / (MAX - MIN)。接着把结果送给 SCALE_X。',
    linkTo: '/sim?preset=analog-scale-pid',
    linkLabel: '去模拟量仿真台动手拖滑块',
  },
  SCALE_X: {
    badge: '模拟量工程缩放',
    title: 'SCALE_X：把 0.0..1.0 比例还原成真实物理量（如 0~100°C / 0~1.0MPa）',
    summary: '模拟量换算第二步！公式：OUT = VALUE * (MAX - MIN) + MIN。配合 NORM_X 两步即可完成所有传感器标定。',
    linkTo: '/learn/l13-analog-norm-scale',
    linkLabel: '看第 13 讲：模拟量两步标定',
  },
  PID_COMPACT: {
    badge: '工艺对象 PID',
    title: 'PID_Compact：西门子内置闭环温控/恒压调节器',
    summary: '必须放在固定周期循环中断块 OB30（如每 100ms 执行一次）里调用，严禁直接塞在扫描时间不固定的 OB1 里！',
    linkTo: '/learn/l14-pid-compact-process',
    linkLabel: '看第 14 讲：PID 闭环控制',
  },
  REAL: {
    badge: '32 位浮点数',
    title: 'Real = 带小数点的实数（占 4 字节，如 85.5°C）',
    summary: '模拟量工程值、PID 设定值与百分比计算必须用 Real，注意字面量写成 100.0 避免整数除法截断小数！',
  },
  INT: {
    badge: '16 位有符号整数',
    title: 'Int = -32768 ~ +32767 的整数（占 2 字节）',
    summary: '模拟量通道 %IW64 和变频器转速设定值都是 16 位 Int；注意计数若会超过 32767 要换 DInt 防止溢出变负数！',
  },
  BOOL: {
    badge: '布尔开关量',
    title: 'Bool = 只有 0 (FALSE) 和 1 (TRUE) 两种状态（占 1 位）',
    summary: '按钮、传感器、指示灯、电磁阀、接触器线圈都是 Bool 类型。',
  },
  '| |': {
    badge: 'LAD 常开触点 (NO)',
    title: '-| |- 常开触点：绑定的变量为 1 时导通，为 0 时断开',
    summary: '可以读作“当它有信号时让电通过”。注意：如果外部接的是物理常闭停止按钮，平时输入就是 1，程序里反而要画常开 -| |-！',
    linkTo: '/sim?preset=wiring-basics',
    linkLabel: '去仿真台验证常开 vs 常闭',
  },
  '|/|': {
    badge: 'LAD 常闭触点 (NC)',
    title: '-|/|- 常闭触点：绑定的变量为 0 时导通，为 1 时断开',
    summary: '相当于逻辑取反 NOT！常用于软件互锁（例如正转支路里串联“反转接触器常闭触点”，反转没吸合才允许正转）。',
  },
  '( )': {
    badge: 'LAD 普通输出线圈 (OTE)',
    title: '-( )- 普通线圈：前面有能流就写 1，没能流就写 0',
    summary: '铁律：同一个输出地址在整个程序里只能出现一次普通线圈 -( )-，否则后执行的程序段会把前面的覆盖掉（双线圈陷阱）！',
    linkTo: '/workflows?wf=scan-cycle',
    linkLabel: '看双线圈覆盖动画',
  },
  '(S)': {
    badge: 'LAD 置位线圈 (SET)',
    title: '-(S)- 置位线圈：只要前面导通一瞬间，就把变量锁死为 1',
    summary: '之后即使前面断电它也保持 1，必须等另一个 -(R)- 复位线圈导通才会变回 0。',
  },
  '(R)': {
    badge: 'LAD 复位线圈 (RESET)',
    title: '-(R)- 复位线圈：前面导通时，把对应变量强行清零为 0',
    summary: '与 -(S)- 成对使用；习惯把复位 -(R)- 放在置位 -(S)- 后面，实现“急停/复位优先”。',
  },
};

export function lookupCodeToken(rawToken: string): CodeTokenInfo | null {
  const cleaned = rawToken.trim();
  if (!cleaned) return null;

  // 1. 先检查 LAD 图形符号（| |、|/|、( )、(S)、(R)）
  const normalizedLad = cleaned.replace(/\s+/g, ' ');
  if (normalizedLad === '| |' || /^\|[\s]*\|$/.test(cleaned)) {
    return { token: '-| |-', ...STATIC_HELP['| |'] };
  }
  if (/^\|\s*\/\s*\|$/.test(cleaned)) {
    return { token: '-|/|-', ...STATIC_HELP['|/|'] };
  }
  if (/^\|\s*P\s*\|$/i.test(cleaned)) {
    return { token: '-|P|-', ...STATIC_HELP['P_TRIG'] };
  }
  if (/^\|\s*N\s*\|$/i.test(cleaned)) {
    return { token: '-|N|-', ...STATIC_HELP['F_TRIG'] };
  }
  if (/^\(\s*\)$/.test(cleaned)) {
    return { token: '-( )-', ...STATIC_HELP['( )'] };
  }
  if (/^\(\s*S\s*\)$/i.test(cleaned)) {
    return { token: '-(S)-', ...STATIC_HELP['(S)'] };
  }
  if (/^\(\s*R\s*\)$/i.test(cleaned)) {
    return { token: '-(R)-', ...STATIC_HELP['(R)'] };
  }

  // 2. 去掉方括号（如 [TON 3s] -> TON）
  const bracketMatch = cleaned.match(/^\[([A-Za-z0-9_]+)/);
  const lookupKey = (bracketMatch ? bracketMatch[1] : cleaned).toUpperCase();

  // 3. 复用 v3.1 西门子任意地址/常数大白话实时拆解器（%I0.0 / %MW10 / %IW64 / T#3s / 16#047F / 27648）
  const decoded = decodePlcToken(cleaned);
  if (decoded) {
    return {
      token: decoded.code,
      badge: decoded.tag,
      title: decoded.headline,
      summary: decoded.plainExplain,
      tip: decoded.pitfall,
      linkTo: decoded.relatedTo?.to,
      linkLabel: decoded.relatedTo?.label,
    };
  }

  // 4. 查内置西门子关键词与 IEC 指令词典
  const hit = STATIC_HELP[lookupKey];
  if (hit) {
    return { token: bracketMatch ? bracketMatch[1] : cleaned, ...hit };
  }

  return null;
}
