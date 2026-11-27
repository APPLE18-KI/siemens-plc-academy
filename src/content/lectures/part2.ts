import { formula, key, line, pairs, rung, say, title, type LectureScript } from '../../features/lecture/types';

/** 讲课脚本（第 3~5 章） */

export const lecture08: LectureScript = {
  lessonId: 'l08-iec-counters',
  tryIt: '去仿真实验室选“计数打包”，每按一次传感器按钮看 CV 加 1。',
  beats: [
    title('计数器 CTU：数够了就动作'),
    rung(
      'r8c',
      {
        net: '程序段 1：每 6 个产品打一包',
        els: [{ id: 'ctu', t: 'CTU', tag: 'C1', arg: 'PV=6' }],
        coil: { id: 'pack', t: 'COIL', tag: 'Pack', addr: '%Q0.0' },
      },
      '计数器数的是输入的上升沿：传感器每从 0 变 1 一次，CV 加 1。',
    ),
    pairs(
      [
        ['[[cu|CU]]', '计数输入：上升沿加 1'],
        ['[[r|R]]', '复位输入：为 1 时 CV 清零'],
        ['[[pv|PV]]', '预设值：CV ≥ PV 时 Q = 1'],
      ],
      'CTU 有三个关键引脚。',
    ),
    say('CV 数到 6，Q 变成 1，打包动作。', 'ctu', { 'C1.Q': true }),
    key('计数器**不会自己清零**：一定要给 R 一个明确的复位条件', '打完包要复位，否则 Q 会一直是 1。'),
    say('复位条件常用“打包完成”信号，或者操作员的复位按钮。', 'r', { 'C1.Q': false }),
  ],
};

export const lecture09: LectureScript = {
  lessonId: 'l09-sequence-traffic-sorting',
  tryIt: '正文的红绿灯和分拣线模型可以手动推进每一步。',
  beats: [
    title('顺序控制：一步只做一件事'),
    key('把动作拆成**[[step|步]]**：每一步有“做什么”和“满足什么条件进入下一步”'),
    pairs(
      [
        ['步 1', '东西向绿灯，计时 20 s'],
        ['步 2', '东西向黄灯，计时 3 s'],
        ['步 3', '南北向绿灯，计时 20 s'],
        ['步 4', '南北向黄灯，计时 3 s → 回到步 1'],
      ],
      '红绿灯就是一个典型的顺序控制。',
    ),
    say('任何时刻只有一步是“活”的，输出只由当前步决定。', 'step'),
    key('转移条件**只看当前步**：定时到、传感器到位、按钮按下'),
    key('急停、故障要能从**任何一步**回到安全的初始步'),
    say('后面学 SCL 状态机，就是用一个“步号”变量把这件事写得更清楚。'),
  ],
};

export const lecture10: LectureScript = {
  lessonId: 'l10-fc-fb-instance-db',
  tryIt: '正文有 FB 多次调用的例子：同一个电机 FB 调三次，各用自己的背景 DB。',
  beats: [
    title('FC 和 FB：把程序拆成可复用的块'),
    pairs(
      [
        ['[[fc|FC 函数]]', '没有“记忆”：每次调用用完就忘'],
        ['[[fb|FB 函数块]]', '有“记忆”：状态存在自己的**背景数据块**里'],
      ],
      '两者最大的区别只有一个：有没有自己的记忆。',
    ),
    say('计算类的小功能，比如单位换算，用 FC 就够了。', 'fc'),
    say('电机、气缸这种要记住“运行中”“报警”的设备，用 FB。', 'fb'),
    formula('"Motor_1"([[idb|"Motor_1_DB"]]) / "Motor_2"("Motor_2_DB")', '同一个 FB 可以调用很多次，每次配一个背景 DB。'),
    say('每台电机的状态各存各的，互不干扰。', 'idb'),
    key('**同一种设备写一个 FB，调用多次**：改一处，全部生效'),
  ],
};

export const lecture11: LectureScript = {
  lessonId: 'l11-udt-global-db',
  beats: [
    title('UDT + 全局 DB：把一台设备的数据打包'),
    key('[[udt|UDT]] = 自定义数据类型：把相关变量组成一个“结构”', '设备的数据经常成组出现：命令、状态、参数、报警。'),
    formula('"Recipe".Speed / "Recipe".Temp / "Recipe".Time', '定义一次 UDT，就能像这样用点号访问里面的成员。'),
    key('[[gdb|全局 DB]]：整个程序都能读写，适合放配方和参数'),
    say('背景 DB 属于某一个 FB；全局 DB 是大家共用的。', 'gdb'),
    key('UDT 改了结构，所有用到它的地方**一起更新**'),
  ],
};

export const lecture12: LectureScript = {
  lessonId: 'l12-scl-state-machine',
  beats: [
    title('SCL 与 CASE 状态机'),
    key('SCL 是文本编程：[[assign|:=]] 赋值，IF / CASE / FOR 和高级语言很像'),
    formula('CASE [[st|#State]] OF\n  0: (* 待机 *)\n  10: (* 送料 *)\n  20: (* 加工 *)\nEND_CASE;', '状态机的核心是一个状态变量，再加一个 CASE。'),
    say('每个分支只写这个状态要做的事，以及什么时候跳到下一个状态。', 'st'),
    key('状态号留间隔（0、10、20…），以后插入新步骤不用全改'),
    key('定时器、FB 要在 CASE **外面**每个周期都调用'),
    say('如果定时器只在某个分支里调用，离开这个分支它就不再更新了。'),
  ],
};

export const lecture13: LectureScript = {
  lessonId: 'l13-analog-norm-scale',
  tryIt: '去仿真实验室选“模拟量换算”，拖动液位，看 NORM_X 和 SCALE_X 的输出。',
  beats: [
    title('模拟量：4–20 mA 变成温度、压力'),
    key('S7-1200 模拟量模块：电流量程对应数值 [[raw|0 ~ 27648]]', '西门子手册说：模块返回的整数里，0 到 27648 代表电流的额定量程。'),
    formula('[[norm|NORM_X]]：OUT = (VALUE − MIN) / (MAX − MIN)', '第一步，用 NORM_X 把原始值归一化成 0.0 到 1.0。'),
    formula('[[scale|SCALE_X]]：OUT = VALUE × (MAX − MIN) + MIN', '第二步，用 SCALE_X 把 0~1 换算成工程量。'),
    pairs(
      [
        ['原始值 13824', 'NORM_X → 0.5'],
        ['0.5', 'SCALE_X(0..100 ℃) → 50 ℃'],
      ],
      '举个例子：原始值 13824 正好是一半。',
    ),
    key('先 NORM_X 再 SCALE_X，中间变量用 **Real**'),
  ],
};

export const lecture14: LectureScript = {
  lessonId: 'l14-pid-compact-process',
  tryIt: '正文的恒压供水 / 加热罐模型可以切换手动和自动，观察 PID 怎么追设定值。',
  beats: [
    title('PID：让实际值追着设定值走'),
    pairs(
      [
        ['[[sp|设定值 SP]]', '你想要的值，例如 60 ℃'],
        ['[[pv|实际值 PV]]', '传感器测到的值'],
        ['[[out|输出 OUT]]', 'PID 算出的阀门开度 / 加热功率'],
      ],
      'PID 做的事很简单：比较设定值和实际值，自动调输出。',
    ),
    key('P 管“现在差多少”，I 管“一直差的累计”，D 管“变化有多快”'),
    key('**PID_Compact** 要放在**循环中断 OB**（如 OB30）里固定周期调用'),
    say('先确认测量准确、执行机构动作正常，再去调 PID 参数。', 'pv'),
  ],
};

export const lecture15: LectureScript = {
  lessonId: 'l15-profinet-project-delivery',
  beats: [
    title('PROFINET 与项目交付'),
    key('PROFINET 设备要有两样东西：[[name|设备名称]] 和 [[ip|IP 地址]]', 'PLC 是按名字找到每一个远程站和变频器的。'),
    say('设备名称要和组态里的一致，否则 PLC 找不到它，ERROR 灯会闪。', 'name'),
    pairs(
      [
        ['URS / FDS', '写清楚要做什么、怎么做'],
        ['I/O 表 + 电气图', '每个点接哪、叫什么'],
        ['编程 + 仿真', 'PLCSIM 里先把逻辑跑通'],
        ['FAT / SAT', '出厂验收、现场验收，逐条打勾'],
      ],
      '一个项目从需求到验收，大致是这四段。',
    ),
    key('验收靠**清单**：每一条需求都对应一条可以检查的结果'),
  ],
};
