import { formula, key, line, pairs, rung, say, title, type LectureScript } from '../../features/lecture/types';

/** 讲课脚本（第 0 讲 ~ 第 1 章、补充课）。板书 = 骨架；旁白 = 一句一句讲；at = 红色指针目标 */

export const lecture00: LectureScript = {
  lessonId: 'l00-before-you-start',
  tryIt: '正文第 5 节有一个仿真器：按住 SB3 点亮 HL1，再试试 SB1 和 SB2。',
  beats: [
    title('PLC = 读输入 → 按程序判断 → 写输出', '这一讲只想让你记住一件事：PLC 是一台按固定套路干活的“小电脑”。'),
    key('[[in|输入]]：按钮、传感器把 24V 信号送进来', '左边是输入：按钮按下，端子上有 24V，PLC 就读成 1。', 'in'),
    key('[[prog|程序]]：你写的规则，比如“按下就亮灯”', '中间是程序：它决定输入变成什么结果。', 'prog'),
    key('[[out|输出]]：接触器、指示灯、电磁阀', '右边是输出：程序算出 1，对应端子就送出 24V，灯就亮。', 'out'),
    pairs(
      [
        ['[[no|常开 NO]]', '平时断开，按下才接通'],
        ['[[nc|常闭 NC]]', '平时接通，按下反而断开'],
      ],
      '常开和常闭是后面天天要用的两个词。',
    ),
    say('启动按钮一般用常开：不按就没信号，不会误启动。', 'no'),
    say('停止和急停一般用常闭：线断了也等于“按下停止”，更安全。', 'nc'),
    rung(
      'r0',
      {
        net: '程序段：按住点动按钮 SB3，运行灯 HL1 亮（简化）',
        els: [{ id: 'sb3', t: 'NO', tag: 'Jog_PB', addr: '%I0.2' }],
        coil: { id: 'hl1', t: 'COIL', tag: 'Lamp_Running', addr: '%Q0.1' },
      },
      '这是你会遇到的第一段梯形图：一个常开触点，一个线圈。',
    ),
    say('左边那根竖线叫母线，可以想成“电源”。', 'r0'),
    say('现在 SB3 没按，触点断开，线是蓝色虚线：没有能流。', 'sb3'),
    say('按下 SB3：触点闭合，绿色实线一路通到线圈，HL1 亮。', 'sb3', { Jog_PB: true }),
    say('线圈通电，就是让 %Q0.1 输出 1，端子上的运行指示灯 HL1 点亮。', 'hl1'),
    say('松开 SB3，能流断开，灯就灭了。', 'sb3', { Jog_PB: false }),
    key('安全底线：**接线前先断电**，不独自带电操作', '最后一句最重要：任何接线、改线都先断电，并用万用表确认。'),
    say('本站的仿真不会伤人，所有“危险实验”都先在仿真里做。'),
  ],
};

export const lecture01: LectureScript = {
  lessonId: 'l01-what-is-plc',
  tryIt: '正文里的“硬件拆解台”可以点开 CPU 面板，看看端子和指示灯在哪。',
  beats: [
    title('认识 S7-1200：型号怎么读、博途是什么'),
    key('PLC 取代的是一柜子[[relay|继电器接线]]', '以前的控制逻辑靠继电器和导线接出来，改一次要重新接线。'),
    say('PLC 把这些逻辑变成程序，改需求只要改程序。', 'relay'),
    formula('CPU 1214C [[sup|DC]]/[[din|DC]]/[[dout|DC]]', '型号后面的三段，是选型时最容易看错的地方。'),
    say('第一段是 CPU 自己的供电：DC 表示 24V 直流供电。', 'sup'),
    say('第二段是数字量输入类型：DC 输入，接 24V 直流的按钮和传感器。', 'din'),
    say('第三段是数字量输出：DC 是晶体管输出，可以发高速脉冲；RLY 是继电器输出。', 'dout'),
    key('要接伺服、步进发脉冲：选 **DC/DC/DC**，不要选 AC/DC/RLY'),
    pairs(
      [
        ['%I0.0 ~ %I1.5', 'CPU 1214C 本体的 14 个数字量输入'],
        ['%Q0.0 ~ %Q1.1', '本体的 10 个数字量输出'],
        ['%IW64 / %IW66', '本体的 2 路模拟量输入（默认地址）'],
      ],
      '1214C 本体自带 14 入 10 出，地址从 %I0.0 和 %Q0.0 开始。',
    ),
    key('编程软件：**TIA Portal（博途）** + 仿真软件 **S7-PLCSIM**', '写程序用博途，没有硬件就用 PLCSIM 把程序下载到虚拟 PLC。'),
  ],
};

export const lecture01b: LectureScript = {
  lessonId: 'l01b-tia-first-project',
  tryIt: '正文有两个“分步操作演示”，跟着高亮一步步点，就像在电脑上操作博途。',
  beats: [
    title('第一个博途项目：从新建到在线监视'),
    pairs(
      [
        ['1 新建项目', '在 Portal 视图点“创建新项目”'],
        ['2 添加设备', '选 CPU 1214C DC/DC/DC，订货号和固件要与实物一致'],
        ['3 设 IP', 'PROFINET 接口，例如 192.168.0.1'],
        ['4 建变量', '在 PLC 变量表里给 %I0.0 起名 "Start"'],
        ['5 写 OB1', '在 Main [OB1] 的程序段 1 里拖触点和线圈'],
      ],
      '整个流程分成八步，前五步是在离线状态下“做工程”。',
    ),
    key('[[sim|项目属性 → 保护 → 勾选“块编译时支持仿真”]]', '想下载到 PLCSIM，有一个很多人卡住的设置。'),
    say('不勾这一项，下载到 PLCSIM 时可能会报“块不能仿真”。', 'sim'),
    pairs(
      [
        ['6 编译', '先编译，错误要清零'],
        ['7 下载', '启动 PLCSIM，把程序下载到虚拟 CPU，切到 RUN'],
        ['8 监视', '点工具栏上的“启用监视”，梯形图出现绿色/蓝色'],
      ],
      '后三步是“上线”：编译、下载、监视。',
    ),
    key('[[green|绿色实线]] = 有能流；[[blue|蓝色虚线]] = 没有能流', '在线监视时，看颜色就知道程序走到了哪。'),
    say('这和本站“博途 + PLCSIM 视图”里的颜色是一样的约定。', 'green'),
    say('PLCSIM 的 SIM 表里勾选 %I0.0，就等于按下了启动按钮。'),
  ],
};

export const lecture02: LectureScript = {
  lessonId: 'l02-wiring-npn-pnp',
  tryIt: '正文的接线实训台可以切换 PNP/NPN 和公共端接法，看看输入灯什么时候亮。',
  beats: [
    title('按钮和传感器怎么接：24V、源型/漏型、急停'),
    key('输入要亮，必须有电流流过输入点和[[com|公共端 1M]]', '输入点能不能读到 1，看的是电流有没有形成回路。'),
    pairs(
      [
        ['[[pnp|PNP 传感器]]', '输出 +24V，公共端 1M 接 0V（源型）'],
        ['[[npn|NPN 传感器]]', '输出 0V，公共端 1M 接 +24V（漏型）'],
      ],
      '最常见的翻车：传感器灯亮了，PLC 输入灯却不亮。',
    ),
    say('原因往往是传感器类型和 1M 的接法不匹配，电流根本没有回路。', 'com'),
    say('欧标设备多用 PNP，1M 接 0V。', 'pnp'),
    key('急停：**物理接常闭**，程序里用**常开触点**检测'),
    rung(
      'r2',
      {
        net: '程序段 1：急停正常才允许运行',
        els: [
          { id: 'es', t: 'NO', tag: 'EStop_OK', addr: '%I0.0' },
          { id: 'st', t: 'NO', tag: 'Start', addr: '%I0.1' },
        ],
        coil: { id: 'run', t: 'COIL', tag: 'Run', addr: '%Q0.0' },
      },
      '看这段程序：急停这个输入，用的是常开触点。',
      { EStop_OK: true },
    ),
    say('急停没拍下时，常闭按钮是接通的，%I0.0 = 1，常开触点闭合。', 'es'),
    say('按下启动，能流通过，输出 1。', 'st', { Start: true }),
    say('拍下急停，或者线被剪断，%I0.0 都变成 0，触点断开，设备停。', 'es', { EStop_OK: false }),
    key('这叫**断线安全**：坏了也是往“停”的方向坏'),
  ],
};

export const lecture03: LectureScript = {
  lessonId: 'l03-scan-cycle-pii-piq',
  tryIt: '正文里的“扫描周期显微镜”可以单步慢放，亲眼看到双线圈的后一次赋值覆盖前一次。',
  beats: [
    title('PLC 怎么运行程序：一圈一圈地扫描'),
    pairs(
      [
        ['① [[wq|写输出]]', '把上一圈算好的 Q 映像送到输出端子'],
        ['② [[ri|读输入]]', '把输入端子的状态拍一张“快照”存进 I 映像'],
        ['③ [[ob|执行 OB1]]', '从程序段 1 执行到最后一段'],
      ],
      '西门子手册说：每个循环里，CPU 写输出、读输入、执行程序循环 OB。',
    ),
    say('读输入是“拍快照”：OB1 执行期间，按钮再怎么变，程序看到的都是这张快照。', 'ri'),
    say('OB1 算出来的结果先写进 Q 映像，到下一圈开头才真正送到端子。', 'wq'),
    key('同一个输出只能在**一个地方**赋值，否则会出现[[dc|双线圈]]'),
    rung(
      'ra',
      {
        net: '程序段 1：手动',
        els: [{ id: 'man', t: 'NO', tag: 'Manual', addr: '%I0.0' }],
        coil: { id: 'm1', t: 'COIL', tag: 'Motor', addr: '%Q0.0' },
      },
      '来看一个反面教材：同一个 Motor，写了两次线圈。',
      { Manual: true },
    ),
    rung('rb', {
      net: '程序段 2：自动',
      els: [{ id: 'auto', t: 'NO', tag: 'Auto', addr: '%I0.1' }],
      coil: { id: 'm2', t: 'COIL', tag: 'Motor', addr: '%Q0.0' },
    }),
    say('程序段 1 里手动条件满足，Motor 先被写成 1。', 'm1'),
    say('但程序段 2 的自动条件不满足，又把 Motor 写回 0。', 'm2'),
    say('这一圈结束时，Q 映像里只剩最后一次的结果：0，电机不动。', 'dc'),
    key('解决：把条件**并联**到一个线圈里，或者用中间变量汇总'),
  ],
};

export const lecture03b: LectureScript = {
  lessonId: 'l03b-data-types',
  tryIt: '正文的“数据类型与地址重叠”演示里，把 %MW 设成 256，看看哪一位亮。',
  beats: [
    title('数据类型：给数字选一个大小合适的盒子'),
    pairs(
      [
        ['[[bool|Bool]]', '1 位：0 或 1，按钮、指示灯'],
        ['[[int|Int]]', '16 位：-32768 ~ 32767，计数、毫秒以内的小数值'],
        ['[[dint|DInt]]', '32 位：约 ±21 亿，大的计数、累计量'],
        ['[[real|Real]]', '32 位浮点：带小数，温度、压力、流量'],
      ],
      '数据类型就是盒子的大小，装的东西超过盒子就会出错。',
    ),
    say('最常用的是 Int，但它最大只到 32767。', 'int'),
    formula('[[ov|32767 + 1]] → -32768（Int 溢出）', '32767 再加 1，结果会“绕回”变成负数，这叫溢出。'),
    say('累计产量、累计毫秒这种会越来越大的数，要用 DInt。', 'dint'),
    key('%MW10 = [[b10|%MB10]] + [[b11|%MB11]]：字由两个字节组成', '再看地址：一个字占两个字节。'),
    say('所以 %MW10 和 %MW11 是重叠的，%MW11 会用到 %MB11。', 'b11'),
    key('字地址按 **2** 递增、双字按 **4** 递增，就不会重叠'),
    say('Real 比较时不要用“等于”，因为小数可能有极小的误差。', 'real'),
  ],
};

export const lecture04: LectureScript = {
  lessonId: 'l04-s7-addressing-tags',
  tryIt: '正文的“在线符号与位状态实验台”里试试把 %MW10 设为 256。',
  beats: [
    title('地址怎么写：位、字节、字、双字'),
    pairs(
      [
        ['%I0.0', '输入区第 0 字节的第 0 位'],
        ['%MB10', 'M 区第 10 个字节（8 位）'],
        ['%MW10', '从 %MB10 开始的一个字（16 位）'],
        ['%MD10', '从 %MB10 开始的双字（32 位）'],
      ],
      '西门子地址 = 区域 + 大小 + 起始字节号（+ 位号）。',
    ),
    formula('[[mw|%MW10]] = [[hi|%MB10（高字节）]] + [[lo|%MB11（低字节）]]', '最容易踩坑的是字里面两个字节的先后顺序。'),
    say('西门子是“大端”：%MB10 是高字节，%MB11 是低字节。', 'hi'),
    say('所以 %MW10 = 256 时，亮的是 %M10.0，而不是 %M11.0。', 'lo'),
    key('一个变量占的字节**不能被别的变量再用**，否则会“串值”'),
    key('程序里用[[sym|符号名]]，例如 "Motor_Run"，少直接写 %Q0.0', '最后一句：给变量起好名字。'),
    say('符号名让程序像句子一样好读，地址改了程序也不用改。', 'sym'),
  ],
};

export const lecture05: LectureScript = {
  lessonId: 'l05-seal-in-jog',
  tryIt: '正文有两个对比实验：A 没有自锁、B 有自锁，按同样的按钮看看区别。',
  beats: [
    title('起保停：按一下启动，按一下停止', '问题来了：按钮一松手就弹回，电机怎么一直转？'),
    rung(
      'r5',
      {
        net: '程序段 1：电机起保停',
        els: [
          { id: 'sb1', t: 'NO', tag: 'Start', addr: '%I0.0' },
          { id: 'sb2', t: 'NO', tag: 'Stop_NC', addr: '%I0.1' },
        ],
        par: { from: 0, to: 0, els: [{ id: 'self', t: 'NO', tag: 'Motor', addr: '%Q0.0' }] },
        coil: { id: 'km', t: 'COIL', tag: 'Motor', addr: '%Q0.0' },
      },
      '答案在这段程序里：启动触点下面，并了一个 Motor 自己的触点。',
      { Stop_NC: true },
    ),
    say('停止按钮物理接常闭，平时 %I0.1 = 1，所以程序里用常开触点，平时是通的。', 'sb2'),
    say('按下启动 SB1：能流从上面这条路通过，线圈 Motor 得电。', 'sb1', { Start: true }),
    say('Motor 得电后，下面它自己的触点也闭合了。', 'self'),
    say('现在松开 SB1：上面断了，但电流从下面 Motor 自己的触点“绕过去”。', 'self', { Start: false }),
    key('这个并联的自身触点叫**[[sl|自锁]]**：自己把自己“保持”住', '这就是“保”：线圈靠自己的触点保持通电。'),
    say('按下停止：%I0.1 变成 0，串联的触点断开，自锁也跟着断开。', 'sb2', { Stop_NC: false }),
    say('再松开停止，电机也不会自己启动，因为自锁已经断了。', 'km', { Stop_NC: true }),
    key('**停止优先**：停止触点串在最外面，任何时候都能断开'),
    key('点动 = 按住转、松手停，**点动不能触发自锁**'),
  ],
};

export const lecture06: LectureScript = {
  lessonId: 'l06-interlock-edge',
  tryIt: '去仿真实验室选“正反转互锁”，试试同时按正转和反转会发生什么。',
  beats: [
    title('正反转互锁 + “按一下只算一次”'),
    key('正转和反转接触器同时吸合 = **相间短路**', '电机正反转靠调换两根相线，如果两个接触器同时吸合，就短路了。'),
    rung(
      'r6',
      {
        net: '程序段 1：正转（带互锁）',
        els: [
          { id: 'fw', t: 'NO', tag: 'Fwd_PB', addr: '%I0.1' },
          { id: 'ilk', t: 'NC', tag: 'KM_Rev', addr: '%Q0.1' },
        ],
        coil: { id: 'kf', t: 'COIL', tag: 'KM_Fwd', addr: '%Q0.0' },
      },
      '正转线圈前面，串了一个反转接触器的常闭触点。',
    ),
    say('反转没吸合时，KM_Rev = 0，常闭触点是通的。', 'ilk'),
    say('按下正转，KM_Fwd 吸合。', 'fw', { Fwd_PB: true }),
    say('如果反转已经吸合，这个常闭触点就会断开，正转根本启动不了。', 'ilk', { KM_Rev: true }),
    key('软件互锁之外，还要在接触器上做**硬件互锁**（辅助常闭串在对方线圈回路）'),
    say('因为程序只管 Q 输出，接触器触点熔焊时，只有硬件互锁能挡住。'),
    title('边沿检测：只在“按下那一下”有效'),
    rung(
      'r6b',
      {
        net: '程序段 2：按一下计一次',
        els: [{ id: 'p', t: 'P', tag: 'Count_PB', addr: '%I0.3' }],
        coil: { id: 'pulse', t: 'COIL', tag: 'One_Shot', addr: '%M10.0' },
      },
      '带 P 的触点叫上升沿检测：信号从 0 变 1 的那一个周期，它才导通一次。',
    ),
    say('按住不放时，后面每个周期它都不再导通，所以“按一下只算一次”。', 'p'),
  ],
};

export const lecture06b: LectureScript = {
  lessonId: 'l06b-troubleshooting-safety',
  tryIt: '去仿真实验室的“博途 + PLCSIM 视图”，点 STOP、试试强制表，再看诊断缓冲区。',
  beats: [
    title('排错三件套：看指示灯、查连接、读诊断'),
    pairs(
      [
        ['[[run|RUN/STOP]]', '绿色常亮 = RUN；黄色常亮 = STOP；黄绿交替闪 = 启动中'],
        ['[[err|ERROR]]', '红色闪烁 = 有错误（如组态不匹配、存储卡错误）'],
        ['[[mt|MAINT]]', '插入存储卡等需要维护时闪烁'],
      ],
      '先看 CPU 正面的三个指示灯，这是最快的诊断。',
    ),
    say('黄灯常亮说明 CPU 在 STOP，程序根本没执行。', 'run'),
    say('红灯在闪，先打开诊断缓冲区，看最近一条记录说了什么。', 'err'),
    key('搜不到 PLC：**接口 → 网线 → IP 网段 → 再下载**', '下载时搜不到 PLC，按这个顺序查。'),
    say('电脑和 PLC 要在同一个网段，例如都是 192.168.0.x。'),
    pairs(
      [
        ['[[mod|监控表“修改”]]', '只写一次；程序下一次写这个地址时就被覆盖'],
        ['[[frc|强制表“强制”]]', '一直生效，直到停止强制；只能强制 I/Q 的物理地址（:P）'],
      ],
      '调试时最容易混的两个功能：修改和强制。',
    ),
    say('强制会让程序读到的输入、送到端子的输出变成你指定的值。', 'frc'),
    key('**急停必须硬接线**，不能只靠程序；复位后**不允许自动启动**'),
  ],
};

export const lecture07: LectureScript = {
  lessonId: 'l07-iec-timers',
  tryIt: '正文的“定时器时序图”演示：按住 IN，看 Q 和 ET 怎么变化。',
  beats: [
    title('定时器 TON / TOF / TP'),
    pairs(
      [
        ['[[ton|TON]] 接通延时', 'IN 接通并保持 PT 时间后，Q 才变 1'],
        ['[[tof|TOF]] 断开延时', 'IN 断开后，Q 再保持 PT 时间才变 0'],
        ['[[tp|TP]] 脉冲', 'IN 一来，Q 输出固定宽度 PT 的脉冲'],
      ],
      '西门子手册对它们的描述很短：TON 延时置位，TOF 延时复位，TP 产生固定宽度脉冲。',
    ),
    rung(
      'r7',
      {
        net: '程序段 1：按住 5 秒后报警灯亮',
        els: [
          { id: 'in', t: 'NO', tag: 'Hold_PB', addr: '%I0.0' },
          { id: 'tmr', t: 'TON', tag: 'T1', arg: 'T#5s' },
        ],
        coil: { id: 'lamp', t: 'COIL', tag: 'Lamp', addr: '%Q0.0' },
      },
      '来看 TON：触点接通定时器的 IN，PT 设成 5 秒。',
    ),
    say('按下按钮，IN = 1，定时器开始计时，ET 从 0 往上涨，但 Q 还是 0。', 'tmr', { Hold_PB: true }),
    say('按住满 5 秒，Q 变成 1，后面的灯亮。', 'lamp', { 'T1.Q': true }),
    say('中途松手，IN = 0，ET 清零、Q 回到 0，下次要重新计时。', 'in', { Hold_PB: false, 'T1.Q': false }),
    key('TON 的 Q = 1 需要两个条件：**IN 一直为 1** 且 **ET ≥ PT**'),
    key('每个定时器要有自己的**背景数据块**（如 "IEC_Timer_0_DB"）'),
    say('SCL 里调用定时器，要保证每个周期都执行到，不能放在只偶尔执行的 IF 里。'),
  ],
};

export const lecture08b: LectureScript = {
  lessonId: 'l08b-compare-move-math',
  tryIt: '正文的“指令实验台”：默认演示 32000 + 1000 溢出，试试把 EN 关掉。',
  beats: [
    title('比较、移动、数学：让 PLC 会“看数字”'),
    key('[[cmp|比较指令 CMP]]：条件成立时**导通**，像一个会看数字的触点'),
    rung(
      'r8',
      {
        net: '程序段 1：液位 ≥ 90% 报警',
        els: [{ id: 'c90', t: 'CMP', tag: 'LevelHigh', arg: '>= 90.0' }],
        coil: { id: 'alm', t: 'COIL', tag: 'Alarm_HH', addr: '%Q0.1' },
      },
      '比较指令放在梯形图里，就像一个触点：液位不到 90%，它是断开的。',
    ),
    say('液位升到 90% 以上，比较成立，能流通过，报警输出。', 'c90', { 'LevelHigh.Q': true }),
    key('[[mv|MOVE]]：把一个值**复制**到另一个地方，源数据不变'),
    pairs(
      [
        ['[[en|EN]]', '“开工”信号：有能流才执行'],
        ['[[eno|ENO]]', '“完工且没出错”：执行出错时 ENO = 0'],
      ],
      '数学和移动指令都是带 EN/ENO 的方框。',
    ),
    say('西门子手册说：如果执行出错，能流在 ENO 处中断。', 'eno'),
    formula('Int：[[ovf|32000 + 1000 = 33000 → 超出范围，ENO = 0]]', '比如 Int 加法超过 32767，就是一个错误。'),
    key('整数除法会**截掉小数**：7 / 2 = 3；要小数就用 Real'),
  ],
};

export const lecture14b: LectureScript = {
  lessonId: 'l14b-hmi-basics',
  tryIt: '正文的分步演示带你在博途里做第一个触摸屏画面。',
  beats: [
    title('HMI 入门：触摸屏上的按钮写的是 M 位'),
    key('HMI 和 PLC 通过 **PROFINET** 连接，两者要在同一网段'),
    key('触摸屏按钮写 [[m|%M 位]]，**不要写 %I**', '最重要的一条规矩：触摸屏按钮写 M 位，不写 I 位。'),
    say('因为每个周期一开始，CPU 都会用端子的实际状态覆盖 I 映像。', 'm'),
    say('触摸屏写进 %I 的值，下一圈读输入时就被冲掉了。'),
    rung(
      'r14',
      {
        net: '程序段 1：现场按钮或触摸屏按钮都能启动',
        els: [
          { id: 'hw', t: 'NO', tag: 'Start_PB', addr: '%I0.0' },
          { id: 'stop', t: 'NO', tag: 'Stop_NC', addr: '%I0.1' },
        ],
        par: { from: 0, to: 0, els: [{ id: 'hmi', t: 'NO', tag: 'HMI_Start', addr: '%M20.0' }] },
        coil: { id: 'run14', t: 'COIL', tag: 'Motor', addr: '%Q0.0' },
      },
      '做法是把 HMI 的 M 位，和现场按钮并联在一起。',
      { Stop_NC: true },
    ),
    say('在触摸屏上按下按钮，%M20.0 变成 1，电机启动。', 'hmi', { HMI_Start: true }),
    key('按钮事件：**按下时置位，释放时复位**（SetBitWhileKeyPressed）', '触摸屏按钮要设置成“按下置位、松开复位”。'),
    say('这样松手后 M 位回到 0；这段没有自锁，所以电机也停——真实程序里还要再配上自锁。', 'hmi', { HMI_Start: false }),
  ],
};
