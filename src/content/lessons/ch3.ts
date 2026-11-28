import type { ChapterMeta, Lesson } from '../../types/content';

export const ch3Meta: ChapterMeta = {
  id: 'ch3',
  order: 3,
  title: '第 3 章：定时、计数与顺序动作',
  subtitle: '用定时器做“延时启动/延时停止”，用计数器数产品个数，再把多个动作按先后顺序串起来（如红绿灯、分拣线）',
  badge: '基础→进阶',
};

export const ch3Lessons: Lesson[] = [
  {
    id: 'l07-iec-timers',
    chapterId: 'ch3',
    order: 7,
    title: '定时器 TON/TOF/TP：延时启动、延时停止与星三角启动',
    subtitle: '告别老式 S5 定时器，用 IEC 定时器搞定光电防抖滤波、风机延时散热与大功率电机星三角无弧切换',
    level: '基础',
    minutes: 35,
    tags: ['TON', 'TOF', 'TP', '信号防抖', '星三角启动', 'IEC定时器'],
    objectives: [
      '彻底区分西门子三大 IEC 定时器（TON 接通延时 / TOF 断开延时 / TP 脉冲）的时序波形与适用场景',
      '学会用 TON 为现场反光抖动的光电传感器设计 150ms 工业级软件防抖滤波',
      '独立编写大功率异步电机星三角（Y-Δ）降压启动程序，并加入关键的“50~100ms 灭弧切换死区”',
      '避开 SCL 中把 IEC 定时器藏进 IF 分支导致冻结不复位的经典深坑',
    ],
    interviewTip:
      '面试高频题：“在 SCL 里调用 TON 定时器最大的坑是什么？星三角切换为什么要加 50~100ms 死区？”满分答法：① IEC 定时器是功能块，必须在每个扫描周期无条件调用（不能包在 IF 里），否则条件变假后定时器不再刷新，Q 会永远锁死在 TRUE；② 接触器物理分断需要 20~40ms，若星形刚断开同周期立刻吸合三角形，拉弧未灭会直接引发 380V 相间短路，因此必须留出 50~100ms 灭弧死区且软硬互锁！',
    blocks: [
      {
        kind: 'text',
        title: '1. 车间两大真实痛点：45kW 电机合闸跳总闸 & 铝壳反光误触发',
        md: `当你从点亮指示灯跨入真实产线，时间（Time）立刻成为控制系统的命脉：
- **痛点 A（大功率电机直接启动炸闸）**：一台 45kW 风机或空压机如果全压直接启动，启动电流高达额定电流的 **5~7 倍**，瞬间把整条车间变压器拉降压跳闸！工业标准做法是 **星三角（Y-Δ）降压启动**：前 5 秒先接成星形（电压降为 1/√3，启动电流骤降至 1/3），等转速拉起来后再无缝切回三角形全压运行！
- **痛点 B（光电传感器信号抖动）**：铝壳锂电池模组在滚筒上微微晃动，经过漫反射光电传感器时反光闪烁，100ms 内输出 \`0-1-0-1-0-1\` 抖动 3 次，导致下游机械手狂拍 3 下把电芯砸坏！用一颗 **\`TON(PT := T#150ms)\`** 过滤掉所有短于 150ms 的毛刺，信号瞬间稳如磐石！`,
      },
      {
        kind: 'text',
        title: '2. 西门子 IEC 定时器三剑客完全对照表',
        md: `按照西门子官方 S7-1200/1500 编程规范（*Siemens Programming Guideline*），**新项目必须一律使用 IEC 定时器（\`TON\` / \`TOF\` / \`TP\` / \`TONR\`）**，严禁再沿用老式 S7-300 时代的 S5 定时器（S_ODT 等）。IEC 定时器本质是系统内置的 **函数块（FB）**，需要配一个背景数据块（或 FB 内的多重背景 \`IEC_TIMER\`），支持精确到毫秒、长达 **24 天** 的 \`TIME\` 类型（如 \`T#150ms\`、\`T#5s\`、\`T#2m30s\`）：

| 定时器指令 | 中文名 | 触发规则与输出 \`Q\` 时序行为 | 最典型的工业应用场景 |
| --- | --- | --- | --- |
| **\`TON\`** | **接通延时**（用得最多，占 80%） | \`IN\` 持续为 \`1\` 满预设时间 \`PT\` 后，\`Q\` 变 \`1\`；\`IN\` 一旦变 \`0\`，\`Q\` 与 \`ET\` **立刻清零** | 光电传感器防抖滤波、星三角切换延时、气缸到位超时报警、顺序步等待 [^timers] |
| **\`TOF\`** | **断开延时** | \`IN\` 变 \`1\` 时 \`Q\` **立刻变 \`1\`**；\`IN\` 变 \`0\` 后 \`Q\` 仍保持 \`1\` 延时 \`PT\` 时间才断开 | 主轴/电加热停机后冷却风扇继续吹风 60s 散热、传送带清料延时停机 |
| **\`TP\`** | **脉冲定时器** | \`IN\` 出现上升沿瞬间 \`Q\` 变 \`1\`，并**雷打不动持续输出恰好 \`PT\` 时长**（即使 \`IN\` 提前变 \`0\` 也不打断！） | 气动吹气嘴定点喷气 300ms 剔除次品、报警蜂鸣器定长鸣响 |

- **四个标准管脚**：\`IN\`（\`Bool\` 启动条件）、\`PT\`（\`Time\` 预设时间，如 \`T#5s\`）、\`Q\`（\`Bool\` 定时输出）、\`ET\`（\`Time\` 当前已经走过的时间，可送到 HMI 显示倒计时！）。`,
      },
      {
        kind: 'predict',
        title: '先猜一猜：TON 定时器设 4 秒，按住 2.5 秒时中途松手，下次再按从哪开始算？',
        scenario: '你在程序里用了一个最常用的接通延时定时器 TON（PT = T#4s）。按住启动按钮到 ET = 2.5s 时突然松手，1 秒后重新按下。',
        question: '重新按下启动按钮后，TON 需要再按住多久才会输出 Q = 1？',
        options: ['只需再按 1.5 秒（接着 2.5s 继续累计）', '重新从 0 秒开始，必须重新按满 4 秒', '立刻输出 Q = 1'],
        answer: 1,
        explain:
          '普通接通延时 TON 只要输入 IN 断开，当前计时 ET 会立刻清零复位！想“断电记忆累计时间”需要用保持型接通延时 TONR。这个特性正好用来做传感器防抖滤波。',
        simHint: '在下方波形演示器里选 TON，先按 1 秒松手再按满 4 秒，亲眼观察 ET 归零曲线！',
      },
      {
        kind: 'demo',
        id: 'timer-diagram',
        instruction: '分别选 TON、TOF、TP，按住“IN”按钮 1 秒后松开，再按住 4 秒后松开，对比下方波形。',
      },
      {
        kind: 'sim',
        preset: 'ton-star-delta',
        title: '互动仿真实验室：星三角降压启动（Y-Δ）时序与 Trace 波形追踪',
        instruction:
          '点击启动按钮，盯紧梯形图里 TON 定时器的当前计时 ET 与底部波形图：观察 KM_Main 与 KM_Star 如何先吸合，5 秒倒计时结束瞬间 KM_Star 断开，经灭弧切换后 KM_Delta 稳稳接管运行！',
      },
      {
        kind: 'io-table',
        title: '星三角降压启动 + 传感器防抖滤波标准变量表',
        tags: [
          {
            name: 'Start_PB',
            address: '%I0.0',
            type: 'Bool',
            area: 'I',
            init: false,
            comment: '电机启动按钮（NO）',
          },
          {
            name: 'Stop_PB_NC',
            address: '%I0.1',
            type: 'Bool',
            area: 'I',
            init: true,
            comment: '电机停止按钮（外部常闭 NC）',
          },
          {
            name: 'Overload_NC',
            address: '%I0.2',
            type: 'Bool',
            area: 'I',
            init: true,
            comment: '热继电器保护常闭触点',
          },
          {
            name: 'Sensor_Raw',
            address: '%I0.3',
            type: 'Bool',
            area: 'I',
            init: false,
            comment: '现场易抖动的光电传感器原始输入信号',
          },
          {
            name: 'Sensor_Filtered',
            address: '%M12.0',
            type: 'Bool',
            area: 'M',
            init: false,
            comment: '经 150ms TON 滤波防抖后的稳定工件到位信号',
          },
          {
            name: 'KM_Main',
            address: '%Q0.0',
            type: 'Bool',
            area: 'Q',
            init: false,
            comment: '主电源接触器（星形与三角形阶段均保持吸合）',
          },
          {
            name: 'KM_Star',
            address: '%Q0.1',
            type: 'Bool',
            area: 'Q',
            init: false,
            comment: '星形降压接触器（启动前 5s 吸合，与 KM_Delta 软硬互锁）',
          },
          {
            name: 'KM_Delta',
            address: '%Q0.2',
            type: 'Bool',
            area: 'Q',
            init: false,
            comment: '三角形全压接触器（星形断开并等待 100ms 灭弧后吸合）',
          },
          {
            name: 'Star_ElapsedTime',
            address: 'DB_Motor.StarET',
            type: 'Time',
            area: 'DB',
            init: 0,
            unit: 'ms',
            comment: '星形阶段已运行时间（供 HMI 显示启动倒计时）',
          },
        ],
      },
      {
        kind: 'dual-code',
        title: '带 100ms 灭弧死区的星三角启动 + 150ms 光电防抖（LAD vs SCL）',
        caption: '工业级细节：星形 5s 到时后先断 KM_Star，再用第二颗 100ms 死区定时器确认彻底灭弧后再合 KM_Delta，零拉弧短路风险！',
        lad: `// Network 1: 主接触器自锁（停止优先 + 过载保护）
     "Start_PB"      "Stop_PB_NC"   "Overload_NC"          "KM_Main"
|---+----[ ]----+--------[ ]-------------[ ]-----------------( )------|
    |           |
    | "KM_Main" |
    +----[ ]----+

// Network 2: 星形延时 5s（TON 背景 DB: "IEC_Timer_Star"）
     "KM_Main"                     +-------------+
|-------[ ]------------------------|     TON     |
                         T#5s -----|PT          Q|--- "Star_Done"
                                   |           ET|--- "Star_ElapsedTime"
                                   +-------------+

// Network 3: 100ms 灭弧死区延时（防止星/角接触器拉弧相间短路）
    "Star_Done"                    +-------------+
|-------[ ]------------------------|     TON     |
                        T#100ms ---|PT          Q|--- "DeadTime_Done"
                                   +-------------+

// Network 4 & 5: 星形与三角形输出（双重软互锁）
     "KM_Main"      "Star_Done"       "KM_Delta"            "KM_Star"
|-------[ ]-------------[/]--------------[/]-----------------( )------|

     "KM_Main"    "DeadTime_Done"      "KM_Star"            "KM_Delta"
|-------[ ]-------------[ ]--------------[/]-----------------( )------|`,
        scl: `// 1. 光电传感器 150ms 软件防抖滤波（无条件调用 IEC 定时器！）
#instTonDebounce(
    IN := "Sensor_Raw",
    PT := T#150ms,
    Q  => "Sensor_Filtered"
);

// 2. 主接触器起保停
"KM_Main" := ("Start_PB" OR "KM_Main") AND "Stop_PB_NC" AND "Overload_NC";

// 3. 星形 5s 定时 + 100ms 灭弧死区定时（严禁藏进 IF 语句内部！）
#instTonStar(
    IN := "KM_Main",
    PT := T#5s,
    ET => "Star_ElapsedTime"
);

#instTonDeadTime(
    IN := "KM_Main" AND #instTonStar.Q,
    PT := T#100ms
);

// 4. 星/角互锁输出（先断 KM_Star -> 空窗 100ms 灭弧 -> 合 KM_Delta）
"KM_Star"  := "KM_Main" AND (NOT #instTonStar.Q) AND (NOT "KM_Delta");
"KM_Delta" := "KM_Main" AND #instTonDeadTime.Q   AND (NOT "KM_Star");`,
      },
      {
        kind: 'callout',
        tone: 'warn',
        title: '西门子 SCL 写 IEC 定时器第一大深坑：千万别把 TON 写进 IF 分支里！',
        md: `新手在 SCL 里经常这样写：
\`\`\`
// ❌ 致命错误写法！
IF "KM_Main" THEN
    #instTonStar(IN := TRUE, PT := T#5s);
END_IF;
\`\`\`
**后果**：一旦 \`"KM_Main"\` 变 \`FALSE\`，程序直接跳过 \`IF\` 块，\`#instTonStar\` 根本没机会执行 \`IN := FALSE\` 来复位自己！于是 \`#instTonStar.Q\` 永远卡死在 \`TRUE\`，下次开机一毫秒就直接切三角形全压启动把总闸炸了！
**黄金规范**：**永远在 \`IF\` / \`CASE\` 外面无条件调用每个 IEC 定时器**，把触发条件直接连到它的 \`IN :=\` 管脚上！`,
      },
      {
        kind: 'practice-task',
        title: '本讲实训打卡：星三角降压启动全流程波形验收',
        scenario: '在上方星三角仿真实验室中，对一台 45kW 车间空压机执行启动、正常切换与中途急停三项测试。',
        steps: [
          '点击启动按钮，紧盯底部数字时序图（Trace）：确认 KM_Main 与 KM_Star 同步变高，KM_Delta 保持低电平。',
          '等待 TON 计时达到设定时间 PT，观察 KM_Star 率先断开、KM_Delta 随即接通，全过程二者绝对没有出现重叠高电平。',
          '按停止按钮停机后再次启动，并在计时刚走到一半（如 2 秒）时突然按下停止按钮，确认 TON 的 ET 立刻清零归位，下次启动重新从 0 秒开始计时。',
        ],
        checkPoints: [
          '能用一句话讲清 TON、TOF、TP 三种定时器的行为差异与典型场景',
          '牢记星三角接触器除了软件互锁和 100ms 灭弧死区外，电气柜里同样必须接硬件互锁',
          '养成“所有 IEC 定时器都在条件语句外无条件调用”的 SCL 铁律',
        ],
      },
      {
        kind: 'quiz',
        title: '随堂闯关测验：IEC 定时器与星三角启动',
        items: [
          {
            question: '热压机加热系统停机后，要求散热风机必须继续运转 60 秒吹散余热后再自动停止。以下哪种 IEC 定时器最直接契合此工艺？',
            options: [
              'TON（接通延时定时器）',
              'TOF（断开延时定时器）',
              'TP（脉冲定时器）',
              'CTU（加计数器）',
            ],
            answer: 1,
            explain:
              'TOF（断开延时）在输入 IN=1 时输出 Q 立刻为 1（加热时风机同步运行）；当输入 IN 变 0（加热停机）时，Q 保持为 1 继续延时 PT=60s 后自动关闭，完全契合延时散热场景。',
          },
          {
            question: '视觉相机检测到不良品后只发来一个 20ms 的窄脉冲，需要驱动喷气电磁阀精准吹气 300ms 把次品吹进废料箱，最适合选用哪颗定时器？',
            options: [
              'TON（接通延时，PT := T#300ms）',
              'TP（脉冲定时器，PT := T#300ms）',
              '普通自锁回路',
              '时钟位 Clock_1Hz',
            ],
            answer: 1,
            explain:
              'TP（脉冲定时器）只要捕捉到 IN 的上升沿，不管 IN 20ms 后是否提前消失，输出 Q 都会雷打不动保持恰好 PT=300ms 的定长脉冲，正是气动吹料剔除的标准方案。',
          },
          {
            question: '在 SCL 中编写 IEC 定时器时，以下哪种写法完全符合西门子工程规范且不会引发复位异常？',
            options: [
              'IF RunCmd THEN #instTon(IN := TRUE, PT := T#5s); END_IF;',
              'CASE Step OF 10: #instTon(IN := TRUE, PT := T#5s); END_CASE;',
              '在所有 IF/CASE 外部无条件调用：#instTon(IN := (Step = 10), PT := T#5s);',
              '把 #instTon 声明在 VAR_TEMP 临时区里以节省 DB 空间',
            ],
            answer: 2,
            explain:
              'IEC 定时器是带内部状态的函数块，必须声明在 Static/全局 DB 中并在每周期无条件调用，通过给 IN 传入布尔表达式来控制启停和自动复位！',
          },
        ],
      },
    ],
  },
  {
    id: 'l08-iec-counters',
    chapterId: 'ch3',
    order: 8,
    title: '计数器 CTU/CTD：数产品个数，满箱自动打包',
    subtitle: '掌握自动化包装线核心“计件→满箱推料→自动清零→班产累计”闭环，避开 Int 溢出与断电丢数坑',
    level: '基础',
    minutes: 35,
    tags: ['CTU', 'CTD', 'CTUD', '满箱打包', 'DInt断电保持', 'HSC高速计数'],
    objectives: [
      '掌握西门子三大 IEC 计数器（CTU 加计数 / CTD 减计数 / CTUD 双向加减计数）的引脚机制与内置边沿特性',
      '能够将“传感器防抖 TON + 批量计数 CTU + 推箱脉冲 TP + 班产累计”串成完整自动打包控制链',
      '理解为什么总产量必须使用 DInt + 断电保持（Retain），彻底避开 Int 达到 32767 翻转成负数的事故',
      '分清普通 OB1 扫描计数（CTU）与硬件高速计数器（HSC）的频率边界',
    ],
    interviewTip:
      '面试高频实战题：“你们产线的日产量计数器为什么用 DInt 而不是 Int？如果电机编码器每秒发 10,000 个脉冲，能直接用 CTU 计数吗？”满分答法：① Int 最大值仅 32,767，高速产线一班就溢出变成 -32,768，所以总产量必须用 DInt（上限 21 亿）并在 DB 中勾选 Retain 断电保持；② 普通 CTU 受扫描周期限制，最多可靠计数几十 Hz，10kHz 编码器脉冲必须启用 S7-1200 硬件高速计数器（HSC，最高 100kHz）！',
    blocks: [
      {
        kind: 'text',
        title: '1. 真实包装线需求：每 6 件装满一箱，自动推箱并累计总箱数',
        md: `在饮料、医药或锂电池模组自动装箱工位上，传送带源源不断送来合格工件。客户提出的自动化工艺要求非常具体：
1. 入口光电传感器每检测到 1 个合格工件（经防抖确认），当前箱内计数 \`Batch_CV\` 自动 **+1**；
2. 当计数满 **6 件**（\`CV >= PV\`）时，停止进料传送带，点亮“满箱”灯并伸出气动推箱气缸 **保持 1.5 秒** 将整箱推入封箱机；
3. 推箱动作完成后：**自动把当前箱计数清零**、把**今日总完成箱数 \`Total_Boxes\` 加 1**，并无缝恢复传送带进入下一箱循环！
4. 操作工可随时按“手动清零”复位本箱计数，且**车间突然拉闸断电后，今日总箱数绝对不能归零！**`,
      },
      {
        kind: 'text',
        title: '2. 西门子 IEC 计数器三兄弟解析',
        md: `与定时器类似，S7-1200/1500 的 IEC 计数器也是系统内置函数块（需配背景 DB 或多重背景 \`IEC_COUNTER\`），并且 **\`CU\` / \`CD\` 计数端内部自带上升沿检测**（传感器一直挡着不会连续乱加，但仍建议上游加 \`TON\` 防抖滤除反光抖动！）：

| 计数器指令 | 中文名 | 核心触发管脚 | 输出 \`Q\` 变 TRUE 条件 | 典型场景 |
| --- | --- | --- | --- | --- |
| **\`CTU\`** | **加计数器** | \`CU\` 上升沿 \`CV+1\`；\`R\` 为 1 时 \`CV:=0\` | \`CV >= PV\` | 自动装箱计件、故障重试次数上限判定 |
| **\`CTD\`** | **减计数器** | \`CD\` 上升沿 \`CV-1\`；\`LD\` 为 1 时 \`CV:=PV\` | \`CV <= 0\` | 剩余订单倒计数、设备保养剩余次倒计时 |
| **\`CTUD\`** | **加减双向计数器** | \`CU\` 加 1，\`CD\` 减 1，\`R\` 清零，\`LD\` 装载 \`PV\` | \`QU\` (\`CV >= PV\`) 满仓；\`QD\` (\`CV <= 0\`) 空仓 | 立体库/缓存线进出料实时库存统计、停车场剩余车位统计 |`,
      },
      {
        kind: 'sim',
        preset: 'ctu-batch-pack',
        title: '互动仿真实验室：产线自动计件与满箱自动打包机',
        instruction:
          '点击启动自动运行，连续触发 6 次工件传感器，观察 CTU 当前值 CV 从 0 递增至 6，触发展示满箱打包输出并自动清零复位、总箱数累计的完整闭环！',
      },
      {
        kind: 'io-table',
        title: '自动计件满箱打包工位标准 I/O 与 DB 变量表',
        tags: [
          {
            name: 'Auto_Run',
            address: '%I0.0',
            type: 'Bool',
            area: 'I',
            init: true,
            comment: '自动运行旋钮（1=自动生产）',
          },
          {
            name: 'Part_Sensor',
            address: '%I0.1',
            type: 'Bool',
            area: 'I',
            init: false,
            comment: '入口光电计件传感器（PNP）',
          },
          {
            name: 'Reset_Batch_PB',
            address: '%I0.2',
            type: 'Bool',
            area: 'I',
            init: false,
            comment: '手动清零当前箱计数按钮',
          },
          {
            name: 'Conveyor_Run',
            address: '%Q0.0',
            type: 'Bool',
            area: 'Q',
            init: false,
            comment: '进料传送带电机（满箱推料期间自动暂停）',
          },
          {
            name: 'Pack_Pusher',
            address: '%Q0.1',
            type: 'Bool',
            area: 'Q',
            init: false,
            comment: '满箱气动推箱电磁阀（保持推料 1.5s）',
          },
          {
            name: 'Batch_Full_Lamp',
            address: '%Q0.2',
            type: 'Bool',
            area: 'Q',
            init: false,
            comment: '满箱指示灯',
          },
          {
            name: 'Batch_Target',
            address: 'DB_Pack.Target',
            type: 'Int',
            area: 'DB',
            init: 6,
            unit: '件/箱',
            comment: '每箱设定目标数量 PV（可由 HMI 配方修改）',
          },
          {
            name: 'Batch_CV',
            address: 'DB_Pack.CurrentCV',
            type: 'Int',
            area: 'DB',
            init: 0,
            unit: '件',
            comment: '当前箱已计入数量 CV',
          },
          {
            name: 'Total_Boxes',
            address: 'DB_Pack.TotalBoxes',
            type: 'Int',
            area: 'DB',
            init: 0,
            unit: '箱',
            comment: '班次累计总完成箱数（实际博途工程设为 DInt 并勾选 Retain 断电保持！）',
          },
        ],
      },
      {
        kind: 'dual-code',
        title: '防抖计件 → 满箱推料 → 自动清零 & 班产累计（LAD vs SCL）',
        caption: '注意复位时序：一定要在推箱定时器结束的下降沿/完成脉冲瞬间先给 Total_Boxes + 1，再触发 CTU 的 R 端自动清零，绝不能一满 6 件当周期就清零导致推箱信号一闪而逝！',
        lad: `// Network 1: 工件传感器 80ms 防抖滤波（防反光多计数）
    "Part_Sensor"                 +-------------+
|-------[ ]-----------------------|     TON     |
                       T#80ms ----|PT          Q|--- #tempPartOK
                                  +-------------+

// Network 2: CTU 批量计数器（满 6 件 Q 输出满箱标志）
    #tempPartOK                   +-------------+
|-------[ ]-----------------------|CU   CTU    Q|--- "Batch_Full_Lamp"
  "Reset_Batch_PB"                |             |
|---+---[ ]---+-------------------|R          CV|--- "Batch_CV"
    |         |    "Batch_Target"-|PV           |
    |#PackDone|                   +-------------+
    +---[ ]---+

// Network 3: 满箱时启动 1.5s 推箱定时，时间到产生 #PackDone 脉冲清零并累加总箱数
  "Batch_Full_Lamp"               +-------------+
|-------[ ]-----------------------|     TON     |
                      T#1.5s -----|PT          Q|--- #PackDone
                                  +-------------+
// Network 4: 进料传送带（自动运行 且 非满箱推料期间运行）
    "Auto_Run"    "Batch_Full_Lamp"                 "Conveyor_Run"
|-------[ ]-------------[/]-------------------------------( )-------|`,
        scl: `// 1. 传感器防抖滤波（80ms）
#instTonSensor(IN := "Part_Sensor" AND "Auto_Run", PT := T#80ms);

// 2. 满箱推箱动作定时（1.5s 推完后产生 #tempPackDone 触发下周期清零）
#instTonPush(IN := #instCtuBatch.Q, PT := T#1500ms);
#tempPackDone := #instTonPush.Q;

// 3. 满箱完成瞬间累加总箱数（仅 1 个扫描周期生效，因下步立刻复位 CTU）
IF #tempPackDone THEN
    "DB_Pack".TotalBoxes := "DB_Pack".TotalBoxes + 1;  // 工程中设为 DInt + Retain
END_IF;

// 4. IEC 加计数器 CTU（CU 内置上升沿，R 支持手动清零或推箱完毕自动清零）
#instCtuBatch(
    CU := #instTonSensor.Q,
    R  := "Reset_Batch_PB" OR #tempPackDone,
    PV := "DB_Pack".Target,
    CV => "DB_Pack".CurrentCV
);

// 5. 物理输出映射（单一输出所有权）
"Batch_Full_Lamp" := #instCtuBatch.Q;
"Pack_Pusher"     := #instCtuBatch.Q AND (NOT #tempPackDone);
"Conveyor_Run"    := "Auto_Run" AND (NOT #instCtuBatch.Q);`,
      },
      {
        kind: 'callout',
        tone: 'warn',
        title: '产线统计两大真实事故：32,767 负数溢出 & 断电清零！',
        md: `1. **\`Int\` 溢出成负数惨案**：有位工程师把每日产量声明为 16 位有符号 \`Int\`（最大 32,767）。高速贴标机一天跑 5 万件，跑到第 32,768 件时，HMI 屏幕上的产量突然跳成了 **\`-32,768\`**，工厂 MES 报表瞬间崩溃！**规范：累计产量、运行小时数一律使用 32 位 \`DInt\`（上限 21.4 亿）或 \`UDInt\`！**
2. **断电丢失班产数据**：默认 DB 变量在 PLC 断电重启后会恢复初始值 \`0\`。凡是总产量、配方参数、立体库当前仓位占用表，必须在博途 DB 中勾选 **\`Retain\`（保持性）**！
3. **高速脉冲边界**：普通 \`CTU\` 受 OB1 扫描周期限制（假设扫描 5ms，Nyquist 理论极限 <100Hz），凡是接**旋转编码器**或高速流量计脉冲，必须启用 CPU 硬件 **HSC（高速计数器）**！`,
      },
      {
        kind: 'practice-task',
        title: '本讲实训打卡：满箱打包循环与异常处理验证',
        scenario: '在上方“满箱自动打包”仿真器中，完整运行两箱生产周期并模拟人工介入清零。',
        steps: [
          '打开自动运行开关，确认传送带开始运行；连续点击触发工件传感器 5 次，观察 CV 升至 5 且此时推箱气缸尚未动作。',
          '触发第 6 个工件：观察满箱灯点亮、传送带自动停顿防撞料、推箱气缸动作并在设定时长后自动复位 CV 归 0，总箱数顺利 +1！',
          '在下一箱计到 3 件时点击“手动复位”，验证 CV 立刻清零且总箱数不会误增加。',
        ],
        checkPoints: [
          '理解为什么 CTU 的自动复位信号必须来自“推箱完成定时”，而非直接把 Q 接回 R',
          '牢记生产总计必须使用 DInt + DB Retain（断电保持）',
          '知道 50Hz 以上编码器高速脉冲必须改用硬件 HSC 而非软件 CTU',
        ],
      },
      {
        kind: 'quiz',
        title: '随堂闯关测验：IEC 计数器与产线计件工程实践',
        items: [
          {
            question: '在一条全自动产线上，一个缓存工位入口有进料传感器，出口有出料传感器，需要实时计算当前缓存线里还滞留着多少个工件（超过 10 个暂停上游供料，等于 0 时暂停下游抓取），最合适的计数器是？',
            options: ['CTU（加计数器）', 'CTD（减计数器）', 'CTUD（加减双向计数器）', 'TP（脉冲定时器）'],
            answer: 2,
            explain:
              'CTUD 同时具备加计数端 CU（进料 +1）与减计数端 CD（出料 -1），并同时提供满仓输出 QU（CV>=10）与空仓输出 QD（CV<=0），天生就是为产线缓存库与车位统计设计的！',
          },
          {
            question: '如果误将一条日产 8 万件的产线累计计数器定义为 16 位 Int（而非 DInt），当产量从 32,767 再加 1 时会发生什么？',
            options: [
              '数值停在 32,767 不再变化',
              '发生有符号整数上溢，数值直接翻转为 -32,768',
              'PLC 自动将其扩容升级为 DInt',
              '自动归零并触发蜂鸣器报警',
            ],
            answer: 1,
            explain:
              '16 位有符号整数 Int 的表示范围是 -32,768 ~ +32,767，加 1 溢出后会按二进制补码直接回绕到 -32,768。因此产线累计变量必须使用 32 位 DInt。',
          },
          {
            question: 'S7-1200 CPU 1214C 扫描周期为 4ms，现有一只安装在电机轴上的旋转编码器，满速运转时输出频率高达 20,000 Hz（20kHz）。该如何正确计数？',
            options: [
              '把编码器接到 %I0.0，在 OB1 里直接调用 CTU 指令即可',
              '加一颗 10ms 的 TON 防抖滤波器再进 CTU',
              '在硬件组态中启用 CPU 内置的硬件高速计数器（HSC），配合 CTRL_HSC 指令读取位置值',
              'S7-1200 无法采集 20kHz 脉冲，必须更换工控机',
            ],
            answer: 2,
            explain:
              '4ms 扫描周期理论上连 125Hz 都会漏脉冲；CPU 1214C 本体自带高达 100kHz 的硬件高速计数器（HSC），独立于 OB1 扫描周期由底层硬件精准计数。',
          },
        ],
      },
    ],
  },
  {
    id: 'l09-sequence-traffic-sorting',
    chapterId: 'ch3',
    order: 9,
    title: '按步骤动作的顺序控制：红绿灯与分拣线',
    subtitle: '从单台电机跨入整机工艺编排！掌握“工步转移层 + 输出映射层”解耦架构，彻底告别面条联锁',
    level: '进阶',
    minutes: 50,
    tags: ['顺序控制', '工步编号', '防跳步', '十字路口联锁', '三工位分拣'],
    objectives: [
      '掌握工业标准“工步号法（Step 0 / 10 / 20 / 30）”将复杂多工位工艺拆解为清晰互斥的状态流程',
      '学会严格分离“步转移逻辑（Transition）”与“物理输出映射（Output Mapping）”，彻底消灭多工步双线圈',
      '能够识破并彻底解决多步顺控中的“同周期连跳多步（Step Skipping）”经典 Bug',
      '通过十字路口防冲突与三工位气动分拣双数字孪生演练，形成整机联锁控制思维',
    ],
    interviewTip:
      '面试官最爱看你的顺序控制代码结构：“做 10 步以上的顺序工艺，你怎么写程序才不乱、不双线圈、后期好加步骤？”满分答法：采用整数工步号法（Step 按 10 递增：0、10、20、30…方便后期在中间插步 15），并且采用两段式架构——上半区只负责根据传感器/定时器条件做工步转移（使用 CASE 或单周期防跳步保护），下半区集中做输出映射，所有气缸/红绿灯只在下半区唯一写入一次，再加互锁兜底！',
    blocks: [
      {
        kind: 'text',
        title: '1. 为什么单靠一堆自锁与定时器写不好一台多工位自动化设备？',
        md: `当你面对一条**三工位视觉/金属自动分拣线**（上料检测 → 金属/非金属鉴别 → 高度视觉分级 → 气缸 A/B/C 精准推料 → 退回原点迎接下一料）或一个**智能十字路口**（南北绿灯 → 南北绿闪 → 南北黄灯 → 全红清空 1 秒防抢行 → 东西绿灯…）时，如果还试图用 20 个中间继电器互相串并联：
- 改一个延时，牵一发而动全身，全线卡死；
- 同一个气缸在步骤 20 和步骤 50 都要伸出，一不小心就写出双线圈；
- 机器半夜停在半路，维修电工对着 50 个闪来闪去的 \`%M\` 位完全不知道卡在了哪一步！

解决复杂工艺的工业标准武器，就是 **工步顺序控制（Sequential Control）**：让整台机器在任何时刻**严格只处于某一个确定的工步号 \`StepNo\`**！`,
      },
      {
        kind: 'text',
        title: '2. 工业顺控两大黄金设计法则',
        md: `### 法则一：步转移与输出映射彻底分离（两层架构）
1. **上层 · 工步转移层（管“何时切到下一步”）**：只判断当前 \`StepNo\` 与到位传感器/定时器，条件满足时把下一步编号写进 \`StepNo\`。**绝不在这里直接操作 \`%Q\` 物理输出！**
2. **下层 · 输出映射层（管“哪几步要动作哪个执行器”）**：统一写 \`Conveyor_Run := (StepNo = 10) OR (StepNo = 20);\`。哪怕一台电机在 5 个不同步骤都要运转，它在全工程中也依然只被写入 **1 次**！

### 法则二：工步编号按 10 递增（0, 10, 20, 30…）
永远不要编成 \`0, 1, 2, 3, 4\`！工业现场客户随时可能提新需求：“师傅，推料前能不能加个吹气清洁步骤？”如果步号按 10 递增，你只需优雅地插入一个 **\`Step 15\`**，原有步号注释和 HMI 报警代码全都纹丝不动！`,
      },
      {
        kind: 'model',
        id: 'traffic-intersection',
        title: '数字孪生实战 A：智能十字路口防冲突红绿灯时序联锁',
        instruction:
          '运行十字路口数字孪生模型，观察南北与东西方向“绿灯 → 绿闪 → 黄灯 → 全红清空缓冲”的严格互斥流转，重点验证南北绿灯与东西绿灯在任何瞬间绝不会同时点亮！',
      },
      {
        kind: 'model',
        id: 'sorting-conveyor',
        title: '数字孪生实战 B：三工位光电+金属检测气动分拣传送线',
        instruction:
          '启动三工位分拣线，投入不同材质/规格的工件，实时追踪工件经过入口光电、金属电感传感器与分拣推料气缸 A/B/C 的多工步顺序联动过程！',
      },
      {
        kind: 'io-table',
        title: '三工位气动分拣线核心 I/O 分配表',
        tags: [
          {
            name: 'Auto_Start',
            address: '%I0.0',
            type: 'Bool',
            area: 'I',
            init: false,
            comment: '产线一键启动按钮',
          },
          {
            name: 'EStop_NC',
            address: '%I0.1',
            type: 'Bool',
            area: 'I',
            init: true,
            comment: '急停按钮（常闭 NC）',
          },
          {
            name: 'S_Infeed',
            address: '%I0.2',
            type: 'Bool',
            area: 'I',
            init: false,
            comment: '入口来料光电传感器',
          },
          {
            name: 'S_Metal',
            address: '%I0.3',
            type: 'Bool',
            area: 'I',
            init: false,
            comment: '工位 1 电感式金属接近开关（金属件=TRUE）',
          },
          {
            name: 'S_VisionOK',
            address: '%I0.4',
            type: 'Bool',
            area: 'I',
            init: false,
            comment: '工位 2 视觉相机合格判定输出（合格=TRUE）',
          },
          {
            name: 'CylA_Home',
            address: '%I0.5',
            type: 'Bool',
            area: 'I',
            init: true,
            comment: '分拣气缸 A 缩回原位磁簧开关',
          },
          {
            name: 'CylA_Work',
            address: '%I0.6',
            type: 'Bool',
            area: 'I',
            init: false,
            comment: '分拣气缸 A 伸出到位磁簧开关',
          },
          {
            name: 'Conveyor_Run',
            address: '%Q0.0',
            type: 'Bool',
            area: 'Q',
            init: false,
            comment: '主分拣传送带变频器运行命令',
          },
          {
            name: 'Valve_CylA',
            address: '%Q0.1',
            type: 'Bool',
            area: 'Q',
            init: false,
            comment: '金属件分拣气缸 A 推料电磁阀',
          },
          {
            name: 'Valve_CylB',
            address: '%Q0.2',
            type: 'Bool',
            area: 'Q',
            init: false,
            comment: '非金属合格件气缸 B 推料电磁阀',
          },
          {
            name: 'StepNo',
            address: 'DB_Sort.StepNo',
            type: 'Int',
            area: 'DB',
            init: 0,
            comment: '当前顺控工步号（0=待机 10=进料检测 20=金属推料 30=气缸复位 40=合格放行）',
          },
        ],
      },
      {
        kind: 'dual-code',
        title: '工步号顺控法：步转移与输出映射彻底分离（LAD 思路 vs SCL CASE 预览）',
        caption: '对比一下就会发现：用整数工步号配合 SCL 的 CASE 语句，天然具备“每个扫描周期最多只执行一个分支”的特性，彻底根治跳步与双线圈！',
        lad: `// === 上半区：工步转移逻辑（用比较器 == 与 MOVE 切换步号） ===
// Network 1: Step 0 (待机) -> Step 10 (来料启动进料)
   "StepNo" == 0      "Auto_Start"    "CylA_Home"          +----------+
|-------[==]--------------[ ]-------------[ ]--------------|   MOVE   |
                                                      10 --|IN    OUT1|-- "StepNo"
                                                           +----------+

// Network 2: Step 10 (进料检测) -> 检测到金属切 Step 20
   "StepNo" == 10      "S_Metal"                           +----------+
|-------[==]--------------[ ]------------------------------|   MOVE   |
                                                      20 --|IN    OUT1|-- "StepNo"
                                                           +----------+

// === 下半区：输出映射层（每个物理 %Q 只写入一次！） ===
// Network 10: 传送带仅在 Step 10 或 Step 40 且气缸缩回原点时允许运行
   "StepNo" == 10                "CylA_Home"   "EStop_NC"   "Conveyor_Run"
|---+---[==]---+--------------------[ ]-----------[ ]-----------( )-------|
    |"StepNo"==40
    +---[==]---+

// Network 11: 气缸 A 仅在 Step 20 伸出推料
   "StepNo" == 20                "EStop_NC"                 "Valve_CylA"
|-------[==]------------------------[ ]-------------------------( )-------|`,
        scl: `// === 上半区：工业级工步转移（CASE 天然防同周期连续跳步！） ===
IF NOT "EStop_NC" THEN
    "DB_Sort".StepNo := 0;    // 急停立刻归零安全待机
ELSE
    CASE "DB_Sort".StepNo OF
        0:  // 待机：确认气缸在原位且收到启动与来料信号
            IF "Auto_Start" AND "S_Infeed" AND "CylA_Home" THEN
                "DB_Sort".StepNo := 10;
            END_IF;

        10: // 进料分选识别
            IF "S_Metal" THEN
                "DB_Sort".StepNo := 20;   // 分支 A：金属件推入 A 槽
            ELSIF "S_VisionOK" THEN
                "DB_Sort".StepNo := 40;   // 分支 B：合格非金属件进入 B 槽
            END_IF;

        20: // 金属件气缸 A 伸出推料，等待伸出磁簧开关到位
            IF "CylA_Work" THEN
                "DB_Sort".StepNo := 30;
            END_IF;

        30: // 气缸 A 断电缩回，确认完全退回原位才允许传送带重启！
            IF "CylA_Home" THEN
                "DB_Sort".StepNo := 0;
            END_IF;

        40: // 合格件进入 B 工位推料并延时完成
            IF #instTonStep40.Q THEN
                "DB_Sort".StepNo := 0;
            END_IF;
    END_CASE;
END_IF;

// 定时器无条件放在 CASE 外部调用！
#instTonStep40(IN := ("DB_Sort".StepNo = 40), PT := T#1200ms);

// === 下半区：输出映射层（单一输出所有权 + 硬件安全互锁） ===
"Conveyor_Run" := (("DB_Sort".StepNo = 10) OR ("DB_Sort".StepNo = 40))
                  AND "CylA_Home" AND "EStop_NC";
"Valve_CylA"   := ("DB_Sort".StepNo = 20) AND "EStop_NC";
"Valve_CylB"   := ("DB_Sort".StepNo = 40) AND "EStop_NC";`,
      },
      {
        kind: 'callout',
        tone: 'danger',
        title: '梯形图写顺序控制最隐蔽的陷阱——“同周期连环跳步（Step Skipping）”！',
        md: `如果你在 LAD 里从上往下顺序写：
- Network 1：\`Step == 10 AND Next_PB\` → \`MOVE 20 -> Step\`
- Network 2：\`Step == 20 AND Next_PB\` → \`MOVE 30 -> Step\`

灾难发生了！因为按钮 \`Next_PB\` 至少按住 200ms，Network 1 在第 1 毫秒刚把 \`Step\` 改成了 \`20\`，紧接着 0.01 毫秒后扫描到 Network 2——此时 \`Step\` 已经是 \`20\` 且 \`Next_PB\` 依然为 \`1\`，程序瞬间又跳到了 \`30\`，整整跳过了一整道工序！
**根治方案（三选一）**：
1. 强烈推荐用 SCL 的 **\`CASE #statStep OF\`**（一个扫描周期只进一个分支，天然绝不跳步！）；
2. LAD 中把相邻步共用触发信号改成 **上升沿脉冲**；
3. 或采用中间变量 \`NextStep\`，在所有转移段末尾统一执行一次 \`Step := NextStep\`！`,
      },
      {
        kind: 'practice-task',
        title: '本讲实训打卡：双数字孪生顺控联锁与故障安全检验',
        scenario: '在上方十字路口与三工位分拣线两个数字孪生模型中，以验收工程师视角验证顺序流转的严谨性。',
        steps: [
          '在十字路口模型中，开启自动模式完整观察一个周期，重点确认“南北黄灯结束 → 全红清场缓冲 → 东西绿灯”之间没有绿灯重叠冲突。',
          '切换到三工位分拣线模型，连续投放金属件与不同规格工件，核对气缸伸出推料期间传送带是否遵循互锁策略、气缸退回原位后才恢复节拍。',
          '在纸上或脑中为三工位分拣线新增一个“Step 15：称重复检停顿 0.5 秒”的步骤，体会步号按 10 递增带来的丝滑扩展性。',
        ],
        checkPoints: [
          '清晰区分“步转移逻辑”与“输出映射层”的职责边界',
          '能讲清楚为什么 LAD 按顺序写 MOVE 会引发同周期跳步，以及如何用 CASE 或 NextStep 解决',
          '养成所有工步按 10 递增（0, 10, 20, 30...）的职业编码规范',
        ],
      },
      {
        kind: 'quiz',
        title: '随堂闯关测验：多步顺序控制与防冲突架构',
        items: [
          {
            question: '在采用“整数工步号法”编写顺序控制程序时，工程老手普遍把步号设为 0, 10, 20, 30 而不是 0, 1, 2, 3，最核心的目的是？',
            options: [
              'PLC 处理 10 的倍数运算速度更快',
              '为了在后期调试或客户变更工艺时，能在任意两步之间直接插入新工步（如 Step 15）而不必重排后续所有步号',
              '西门子 TIA Portal 语法强制要求步号必须是 10 的倍数',
              '为了防止 Int 溢出',
            ],
            answer: 1,
            explain:
              '预留步号间隔（10, 20, 30...）是全球自动化行业通行的最佳实践，现场工艺变更增加过渡步时可直接插入 15、25，极大降低改错代码和破坏 HMI 步号文本列表的风险。',
          },
          {
            question: '在 LAD 顺序控制中，Network 1 满足条件后把 Step 从 10 改写为 20，同一扫描周期紧跟着的 Network 2 又检测 Step == 20 且共用同一个持续为 1 的按钮信号，导致直接跳过 Step 20 变成 Step 30。这种故障被称为？',
            options: [
              '双线圈冲突',
              '同周期跳步（Step Skipping）',
              '字节大端序重叠',
              '模拟量断线溢出',
            ],
            answer: 1,
            explain:
              '由于 LAD 从上到下串行执行，本周期刚写入的新步号立刻被下一网络命中，导致跳过中间工序；使用 SCL 的 CASE 语句或采用 NextStep 缓存变量在末尾统一更新即可彻底杜绝。',
          },
          {
            question: '为什么在工业顺序控制中强烈强调将“步转移逻辑”与“物理输出映射（%Q）”拆成两个独立区域？',
            options: [
              '因为一个区域写不下那么多代码',
              '确保每个物理输出 %Q 在整个程序中只被统一赋值一次（单一输出所有权），避免不同工步重复写线圈造成覆盖，且方便统一串入急停联锁',
              '只有拆分后才能下载到 S7-1200',
              '可以省去急停按钮硬件接线',
            ],
            answer: 1,
            explain:
              '把“哪个工步要打开传送带”汇总到输出映射层的唯一一行赋值中（如 Conveyor := (Step=10) OR (Step=40)），从结构上彻底消除双线圈，且排查输出不动作时只需看这一行！',
          },
        ],
      },
    ],
  },
];
