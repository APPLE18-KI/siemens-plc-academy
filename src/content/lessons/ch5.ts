import type { ChapterMeta, Lesson } from '../../types/content';

export const ch5Meta: ChapterMeta = {
  id: 'ch5',
  order: 5,
  title: '第 5 章：模拟量、通信与项目交付',
  subtitle: '读取温度、压力这类连续变化的信号，用 PID 让温度稳在设定值，通过 PROFINET 网线控制变频器，最后了解一个项目从需求到验收的全过程',
  badge: '实战',
};

export const ch5Lessons: Lesson[] = [
  {
    id: 'l13-analog-norm-scale',
    chapterId: 'ch5',
    order: 13,
    title: '模拟量入门：4-20mA 信号换算成温度/压力（NORM_X、SCALE_X）',
    subtitle: '揭秘 0~27648 魔法数字背后的工程意义，掌握断线报警、一阶 RC 滤波与 4-20mA 面试必考三大优势',
    level: '实战',
    minutes: 40,
    tags: ['模拟量', '4-20mA', '27648', 'NORM_X', 'SCALE_X', '断线检测'],
    objectives: [
      '彻底掌握西门子 S7-1200/1500 模拟量通道原始数值标准（额定范围 0~27648、上溢 >32511、下溢/断线 <-4864）',
      '透彻回答高频面试必考题：“工业现场为什么优先选择 4-20mA 电流信号而不是 0-10V 电压信号？”',
      '熟练运用博途标准指令 NORM_X（标准化）+ SCALE_X（缩放）完成压力、温度工程量正反向换算',
      '学会为模拟量增加断线故障诊断与一阶低通数字滤波，并避开 CPU 1214C 本体 AI 仅支持 0-10V 的硬件选型坑',
    ],
    interviewTip:
      '面试 100% 高频必考题：“工业现场为什么优先选用 4-20mA 而不是 0-10V？西门子模拟量怎么换算？”满分三段式答法：① 活零点断线诊断（4mA 对应 0%，断线变 0mA 下溢可直接报断线故障，而 0V 无法区分是真 0 压力还是线断了）；② 长距离无压降（串联电流回路处处相等，走 200 米电缆也不衰减，而电压信号受导线电阻分压衰减）；③ 强抗电磁干扰（电流环低阻抗不易耦合变频器高频噪声）。西门子用 NORM_X(0~27648→0.0~1.0) 串联 SCALE_X(0.0~1.0→工程上下限) 即可精准换算！',
    blocks: [
      {
        kind: 'text',
        title: '1. 从 0/1 开关世界跨入连续物理世界：13824 到底是多少兆帕？',
        md: `前 4 章我们打交道的按钮、接近开关、电磁阀都是非黑即白的开关量（\`Bool\`）。但真实工厂里，水泵管网压力 \`0.0~1.6 MPa\`、锂电池热压腔温度 \`0.0~150.0 °C\`、比例调节阀开度 \`0~100%\` 全都是连续变化的物理量——也就是 **模拟量（Analog）**。

传感器（变送器）先把压力变成 **\`4~20 mA\`** 电流，送到西门子模拟量模块 \`SM1231\`，模块内部的 **A/D 转换芯片** 再把电流数字化成一个 16 位有符号整数存入 \`%IW64\`：
- 当你在线监控 \`%IW64\` 时，看到的不是 \`0.80 MPa\`，而是一个看似神秘的数字 **\`13824\`**！
- 原来西门子全系列 S7-1200/1500/300/400 统一规定了全球著名的标准量程常数：**\`27648\`**！[^analog-27648]`,
      },
      {
        kind: 'text',
        title: '2. 西门子模拟量数值分区表 & 4-20mA 完胜 0-10V 的三大铁律',
        md: `### ① 西门子单极性模拟量（4-20mA / 0-10V）标准码值对照表

| 模拟量通道原始值（\`%IW\` Int） | 对应 4-20mA 电流 | 对应 0-10V 电压 | 工程状态与诊断动作 |
| --- | --- | --- | --- |
| **\`> 32511\`（上溢 \`32767\`）** | \`> 22.81 mA\` | \`> 11.76 V\` | **严重超量程 / 短路故障** → 立即触发传感器超限报警 |
| \`27649 ~ 32511\`（过冲区） | \`20.00 ~ 22.81 mA\` | \`10.00 ~ 11.76 V\` | 轻微超满度（容错裕度区，软件通常限幅在 100%） |
| **\`0 ~ 27648\`（额定工作区）** | **\`4.00 ~ 20.00 mA\`** | **\`0.00 ~ 10.00 V\`** | **标准线性测量区！\`13824\` 恰好就是 50.0% 中点！** |
| \`-4864 ~ -1\`（下冲区） | \`1.185 ~ 3.99 mA\` | — | 零点微漂（正常允许微调，软件限幅归 0.0） |
| **\`< -4864\`（下溢 \`-32768\`）** | **\`< 1.185 mA\`（含 \`0 mA\`）** | — | **🚨 活零点断线报警（Wire-Break）！立刻停机保护！** |

### ② 面试必背：为什么工业现场宁愿多花钱也要首选 4-20mA？
1. **“活零点（Live Zero）”断线自检**：\`4mA\` 代表 0% 零点，一旦叉车压断电缆电流跌到 \`0mA\`，PLC 读到下溢负值立刻报“压力传感器断线”；而 \`0-10V\` 断线时也是 \`0V\`，PLC 会以为水压是 0 从而把水泵开到 100% 满频撑爆管道！
2. **长距离传输零压降**：串联电流回路处处电流相等，走 200 米电缆依然精准 \`12.00mA\`；而 \`0-10V\` 会被导线内阻分压衰减，越远越不准。
3. **极强抗电磁干扰**：电流信号回路阻抗低，即便与变频器动力电缆同桥架敷设（当然规范要求强弱电分槽 + 屏蔽层单端接地），抗共模噪声能力依然远胜电压信号！`,
      },
      {
        kind: 'sim',
        preset: 'analog-scale-pid',
        title: '互动仿真实验室：NORM_X + SCALE_X 线性换算与模拟量断线报警实验',
        instruction:
          '拖动输入模拟量原始码值滑块（观察 0 / 13824 / 27648 对应的工程量实时输出），尝试把数值拖入下溢断线区或高限报警区，观察报警标志与比例阀输出 %QW 的联动响应！',
      },
      {
        kind: 'io-table',
        title: '管网压力采集（AI）+ 比例调节阀输出（AQ）标准变量表',
        tags: [
          {
            name: 'AI_Pressure_Raw',
            address: '%IW96',
            type: 'Int',
            area: 'I',
            init: 0,
            unit: '0~27648',
            comment: 'SM1231 4-20mA 压力变送器原始通道（量程 0.0 ~ 1.6 MPa）',
          },
          {
            name: 'AQ_Valve_Raw',
            address: '%QW96',
            type: 'Int',
            area: 'Q',
            init: 0,
            unit: '0~27648',
            comment: 'SM1232 4-20mA 比例调节阀模拟量输出通道（对应开度 0~100%）',
          },
          {
            name: 'Press_Eng_MPa',
            address: 'DB_Analog.PressMPa',
            type: 'Real',
            area: 'DB',
            init: 0,
            unit: 'MPa',
            comment: '经 NORM_X + SCALE_X 换算并一阶滤波后的工程压力值',
          },
          {
            name: 'Valve_Cmd_Pct',
            address: 'DB_Analog.ValvePct',
            type: 'Real',
            area: 'DB',
            init: 0,
            unit: '%',
            comment: 'PID 或手动给出的阀门目标开度百分比（0.0 ~ 100.0%）',
          },
          {
            name: 'Alarm_WireBreak',
            address: 'DB_Analog.ErrBreak',
            type: 'Bool',
            area: 'DB',
            init: false,
            comment: '4-20mA 断线/超量程硬件故障报警（原始值 <-1000 或 >32511）',
          },
          {
            name: 'Alarm_HighPress',
            address: 'DB_Analog.ErrHigh',
            type: 'Bool',
            area: 'DB',
            init: false,
            comment: '工艺超压联锁报警（实测压力 > 1.40 MPa）',
          },
        ],
      },
      {
        kind: 'dual-code',
        title: '带断线诊断 + 限幅防呆的模拟量输入/输出双工换算（LAD vs SCL FC）',
        caption: '标准两步曲：输入端用 NORM_X(0..27648) → SCALE_X(0.0..1.6)；输出端反过来用 NORM_X(0.0..100.0) → SCALE_X(0..27648)！',
        lad: `// Network 1: 模拟量输入换算（%IW96 0~27648 -> 0.0~1.6 MPa）
              +------------+              +------------+
              |   NORM_X   |              |  SCALE_X   |
              | Int -> Real|              |Real -> Real|
       0 -----|MIN      OUT|---#tempNorm--|VALUE    OUT|--- "Press_Eng_MPa"
"AI_Press" ---|VALUE       |      0.0 ----|MIN         |
   27648 -----|MAX         |      1.6 ----|MAX         |
              +------------+              +------------+

// Network 2: 模拟量输出反换算（阀门开度 0.0~100.0% -> %QW96 0~27648）
              +------------+              +------------+
              |   NORM_X   |              |  SCALE_X   |
              |Real -> Real|              |Real -> Int |
     0.0 -----|MIN      OUT|--#tempOutN---|VALUE    OUT|--- "AQ_Valve_Raw"
"Valve_Pct"---|VALUE       |        0 ----|MIN         |
   100.0 -----|MAX         |    27648 ----|MAX         |
              +------------+              +------------+`,
        scl: `// 通用可复用模拟量输入处理函数 FC_AnalogInScale（无状态，首选 FC！）
FUNCTION "FC_AnalogInScale" : Real
VAR_INPUT
    rawVal      : Int;      // 硬件原始通道值 %IW
    engMin      : Real;     // 传感器量程下限（如 0.0 MPa）
    engMax      : Real;     // 传感器量程上限（如 1.6 MPa）
END_VAR
VAR_OUTPUT
    wireBreak   : Bool;     // 断线或短路溢出报警
END_VAR
VAR_TEMP
    tempNorm    : Real;
    tempScaled  : Real;
END_VAR
BEGIN
    // 1. 硬件断线 / 短路超限诊断（4-20mA 断线常跌至 -4864 以下或 -32768）
    #wireBreak := (#rawVal < -1000) OR (#rawVal > 32511);

    IF #wireBreak THEN
        "FC_AnalogInScale" := #engMin;   // 断线时输出安全兜底值，防止 PID 误算！
        RETURN;
    END_IF;

    // 2. 西门子标准两步曲：NORM_X 归一化(0.0~1.0) -> SCALE_X 工程量缩放
    #tempNorm   := NORM_X(MIN := 0, VALUE := #rawVal, MAX := 27648);
    #tempNorm   := LIMIT(MN := 0.0, IN := #tempNorm, MX := 1.0); // 防止微负漂移变成负压力
    #tempScaled := SCALE_X(MIN := #engMin, VALUE := #tempNorm, MAX := #engMax);

    "FC_AnalogInScale" := #tempScaled;
END_FUNCTION

// --- 附加技能：在 FB 或 OB30 中加入一阶低通滤波平滑高频噪声 ---
// #statFiltered := #statFiltered + 0.15 * (#rawEng - #statFiltered);`,
      },
      {
        kind: 'callout',
        tone: 'warn',
        title: 'S7-1200 本体 AI 选型天坑：CPU 1214C/1215C 自带模拟量口只认 0-10V！',
        md: `这是无数工程新手在 BOM 阶段翻车的大坑：CPU 1214C/1215C 本体上面确实自带 2 路模拟量输入（\`%IW64\`、\`%IW66\`），但西门子手册里白纸黑字写着——**本体 AI 仅支持 \`0-10V\` 电压信号（10 位分辨率），直接接 4-20mA 电流传感器是读不到正确值的！**
- **正规工程解法**：选配 **\`SM1231 AI 4×13bit\`** 扩展模块或 **\`SB1231\`** 信号板，在博途硬件组态中把通道测量类型设为“电流 4..20mA”并勾选“断线诊断”。
- **紧急现场应急招数**：若实在缺模块，可在 \`0-10V\` 端子两端并联一只 **\`500 Ω\`（0.1% 高精度低温漂金属膜）电阻**，依据欧姆定律 \`4~20mA × 500Ω = 2~10V\`，此时 \`4mA\` 对应码值 \`5530\`（\`27648 × 0.2\`），只需把 \`NORM_X\` 的 \`MIN\` 改为 \`5530\` 即可应急救急！`,
      },
      {
        kind: 'practice-task',
        title: '本讲实训打卡：27648 换算心算验收与断线保护实测',
        scenario: '在上方模拟量仿真实验中，验证压力传感器从正常波动到电缆被叉车拉断的全工况表现。',
        steps: [
          '手动拖动滑块依次停在 0、6912（25%）、13824（50%）、27648（100%），心算核对 0~1.6 MPa 换算结果是否精准对应 0.0 / 0.4 / 0.8 / 1.6 MPa。',
          '把模拟量输入拖到高限阈值以上，验证超压报警是否及时触发并执行安全响应。',
          '模拟 4-20mA 断线（负值下溢），确认断线报警标志立即点亮，不会误把断线当成“低压”去盲目加压！',
        ],
        checkPoints: [
          '闭眼能说出西门子模拟量额定满度常数 27648 及 50% 中点 13824',
          '流利背诵 4-20mA 相对 0-10V 的三大工业优势（活零点断线检测、长距无压降、抗干扰）',
          '牢记 CPU 1214C 本体 AI 仅支持 0-10V，测 4-20mA 需配 SM1231/SB1231 或 500Ω 精密电阻',
        ],
      },
      {
        kind: 'quiz',
        title: '随堂闯关测验：模拟量换算与 4-20mA 工程规范',
        items: [
          {
            question: '一台量程为 0.0 ~ 200.0°C 的 4-20mA 温度变送器接入 SM1231 模块的 %IW96，在线监控看到 %IW96 = 13824。此时实际温度与回路电流分别是多少？',
            options: [
              '50.0°C，10 mA',
              '100.0°C，12 mA',
              '100.0°C，10 mA',
              '138.2°C，13.8 mA',
            ],
            answer: 1,
            explain:
              '13824 / 27648 = 0.5（恰好 50% 量程）。对应温度 = 0 + 0.5 × 200.0 = 100.0°C；对应电流 = 4mA + 0.5 × (20 - 4)mA = 12 mA！',
          },
          {
            question: '工业现场温度/压力传感器优先选用 4-20mA 而非 0-10V 的最核心安全优势之一是？',
            options: [
              '4-20mA 不需要接电源就能工作',
              '4-20mA 具备“活零点”，线路断开跌落至 0mA 时 PLC 可立刻识别下溢断线故障，而 0-10V 断线呈现 0V 无法区分是真实零位还是断线',
              '4-20mA 可以直接驱动三相异步电机',
              '西门子 CPU 1214C 本体 AI 默认就是 4-20mA',
            ],
            answer: 1,
            explain:
              '“活零点（Live Zero）”断线检测 + 电流回路长距离无压降 + 强抗电磁干扰，是 4-20mA 统治过程工业的三大基石。',
          },
          {
            question: '在博途 TIA Portal 中，将经过 NORM_X 标准化后的浮点数（0.0 ~ 1.0）转换为实际物理工程量（如 0.0 ~ 1.6 MPa），应紧接着串联调用哪条标准指令？',
            options: ['MOVE', 'SCALE_X', 'ROUND', 'CONV'],
            answer: 1,
            explain:
              'S7-1200/1500 标准模拟量换算组合为 NORM_X（把原始整数归一化到 0.0~1.0）串联 SCALE_X（把 0.0~1.0 线性映射到工程上下限 MIN~MAX）。',
          },
        ],
      },
    ],
  },
  {
    id: 'l14-pid-compact-process',
    chapterId: 'ch5',
    order: 14,
    title: 'PID 闭环控制：让温度稳在设定值（PID_Compact）',
    subtitle: '告别令人头疼的微积分公式！用直觉驾驭 P/I/D 三大参数、恒压供水双泵切泵与 OB30 调用铁律',
    level: '实战',
    minutes: 40,
    tags: ['PID_Compact', 'OB30循环中断', '参数整定', '无扰切换', '恒压供水'],
    objectives: [
      '用纯工程直觉理解比例（P）、积分（I）、微分（D）各自解决什么物理问题，以及调大调小的曲线表现',
      '牢记西门子铁律：PID_Compact 必须放在固定周期循环中断 OB30（如 100ms）中调用，严禁放在 OB1！',
      '掌握 PID_Compact 工艺对象的 5 大工作模式（停用/预调节/精确调节/自动/手动）及手自动无扰切换编程技巧',
      '在双泵恒压供水与热工储罐数字孪生中亲手整定 PID 参数，验证抗干扰恢复能力',
    ],
    interviewTip:
      '中高级过程控制面试必杀两连问：①“博途 PID_Compact 为什么必须放在 OB30 循环中断里而不能放 OB1？”答：PID 离散算法中的积分累加与微分斜率计算严格依赖恒定的采样周期 Δt；OB1 扫描时间会随分支代码执行忽长忽短，放在 OB1 会破坏时基导致系统震荡甚至报采样时间错误，而 OB30 能保证严格等间隔（如 100ms）硬件定时中断执行！②“手自动切换怎么防止设备猛冲（无扰切换）？”答：自动态下实时把当前 PID 输出值回写跟踪到 ManualValue，切手动瞬间输出零跳变！',
    blocks: [
      {
        kind: 'text',
        title: '1. 为什么“低于 85°C 开加热、高于 85°C 关加热”根本控不准温度？',
        md: `新手控制我们毕业项目中的 **锂电模组热压恒温腔（目标 \`85.0°C ± 0.5°C\`）** 时，第一反应往往是写两行开关比较（位式控制）：低于 85°C 全功率加热，超过 85°C 立刻断开加热器。

一上电就傻眼了：电加热板热惯性极大，哪怕 85°C 时切了电源，余热仍会把温度冲到 **\`94°C\`（严重过冲烤坏电芯胶水！）**；降温到 85°C 再通电，温度又继续跌到 **\`78°C\`**，来回剧烈画“过山车”！

想让温度或水压像狙击手一样稳稳咬死在目标线上，必须请出工业界统治百年的闭环控制王者——**PID 控制器**！`,
      },
      {
        kind: 'text',
        title: '2. 零枯燥公式！30 秒用“老司机开车停在红线前”秒懂 P / I / D',
        md: `想象你开车离前方停车红线还有 100 米（误差 \`e = 设定值 SP - 实测值 PV\`），脚下的油门就是 PID 输出（\`0~100%\`）：

| 参数 | 角色比喻 | 物理作用 | 调太小/太弱的表现 | 调太大/太猛的表现 | 工业现场口诀 |
| --- | --- | --- | --- | --- | --- |
| **\`P\`（比例增益 Gain）** | **管“现在”**（看当前离红线多远踩油门） | 误差越大出力越大，决定系统主力响应速度 | 行动慢吞吞、永远爬不到目标线（静差极大） | 猛冲过头、反复来回剧烈震荡发散 | **先调 P**：逐步加大到微幅震荡再退回 60%~70% |
| **\`I\`（积分时间 Ti）** | **管“过去”**（只要还差一点没压线，就越积越急持续补油） | **彻底消除稳态静差（Steady-State Error）**！注意：\`Ti\` 越小，积分作用越强！ | \`Ti\` 太大 = 消除静差极慢 | \`Ti\` 太小 = 积分饱和，引起大幅慢速超调摇摆 | **再加 I**：慢慢减小 \`Ti\`，直到静差稳稳归零 |
| **\`D\`（微分时间 Td）** | **管“未来”**（看车速冲得太快，提前轻点刹车！） | 预测误差变化率，提供**超前阻尼刹车**，抑制大惯性系统过冲 | 对温度等大滞后对象易过冲 | 放大传感器高频毛刺噪声，导致调节阀疯狂抽搐 | **温度加 D，压力/流量设 \`Td=0\`（纯 PI）！** |`,
      },
      {
        kind: 'model',
        id: 'tank-pressure-pid',
        title: '数字孪生闭环实验台：双泵恒压供水 & 热工储罐 PID 实时调参',
        instruction:
          '在下方双泵恒压储罐数字孪生中：① 观察设定压力 SP 与实测压力 PV 的动态趋势曲线；② 实时微调 Kp / Ti / Td 参数，对比纯 P 存在的静差 vs PI 消除静差；③ 突然开大出水阀施加阶跃负载扰动，或切换自动/手动验证无扰交接！',
      },
      {
        kind: 'io-table',
        title: 'OB30 恒压供水 / 热压温控 PID_Compact 核心接口变量表',
        tags: [
          {
            name: 'SP_Target',
            address: 'DB_PID.Setpoint',
            type: 'Real',
            area: 'DB',
            init: 0.5,
            unit: 'MPa',
            comment: '工艺设定值 SP（恒压供水如 0.50 MPa；热压温控如 85.0 °C）',
          },
          {
            name: 'PV_Actual',
            address: 'DB_PID.InputPV',
            type: 'Real',
            area: 'DB',
            init: 0.0,
            unit: 'MPa',
            comment: '经 NORM_X+SCALE_X 换算后的真实反馈值（连到 PID.Input）',
          },
          {
            name: 'PID_AutoMode',
            address: '%I0.0',
            type: 'Bool',
            area: 'I',
            init: true,
            comment: '手自动切换旋钮（TRUE=Mode 3 自动闭环；FALSE=Mode 4 手动开度）',
          },
          {
            name: 'PID_ManualPct',
            address: 'DB_PID.ManualVal',
            type: 'Real',
            area: 'DB',
            init: 0.0,
            unit: '%',
            comment: '手动给定输出（自动运行时实时跟踪 Output 实现无扰切换！）',
          },
          {
            name: 'PID_OutPct',
            address: 'DB_PID.OutputPct',
            type: 'Real',
            area: 'DB',
            init: 0.0,
            unit: '%',
            comment: 'PID 计算输出百分比（0.0 ~ 100.0%，送 HMI 监控）',
          },
          {
            name: 'AQ_VFD_Freq',
            address: '%QW96',
            type: 'Int',
            area: 'Q',
            init: 0,
            unit: '0~27648',
            comment: 'PID.Output_PER 直接输出 0~27648 驱动主泵变频器或固态继电器调功器',
          },
          {
            name: 'Safety_InterlockOK',
            address: '%M10.0',
            type: 'Bool',
            area: 'M',
            init: true,
            comment: '安全联锁（无干抽缺水、无传感器断线、无超温/超压报警）',
          },
          {
            name: 'PID_Mode',
            address: 'DB_PID.Mode',
            type: 'Int',
            area: 'DB',
            init: 3,
            comment: 'PID_Compact 模式码（0=停用 1=预调节 2=精调节 3=自动 4=手动）',
          },
        ],
      },
      {
        kind: 'dual-code',
        title: 'OB30（100ms 循环中断）标准调用 PID_Compact + 无扰切换 + 超限保护（LAD vs SCL）',
        caption: '记住博途 PID_Compact 的三个实战精髓：① 放 OB30；② 切换 Mode 必须给 ModeActivate 一个上升沿脉冲；③ 自动态实时把 Output 追踪回写给 ManualValue！',
        lad: `// 本程序块必须创建在【循环中断组织块 OB30（周期 100ms）】中，严禁放 OB1！
// Network 1: 调用西门子工艺对象 PID_Compact

                               "PID_Compact_Press"
                              +-------------------+
                              |    PID_Compact    |
     "DB_PID".Setpoint -------|Setpoint     Output|--- "DB_PID".OutputPct
      "DB_PID".InputPV -------|Input    Output_PER|--- "AQ_VFD_Freq" (%QW96)
                 0.0 ---------|Input_PER  Output_P|
               FALSE ---------|Disturbance   State|--- "DB_PID".State
   "DB_PID".ManualEn ---------|ManualEnable  Error|--- "DB_PID".Error
  "DB_PID".ManualVal ---------|ManualValue ErrBits|
        "Reset_PB" -----------|Reset              |
       "DB_PID".Mode ---------|Mode               |
  #tempModeActivate ----------|ModeActivate       |
                              +-------------------+`,
        scl: `// =========================================================================
// ORGANIZATION_BLOCK "OB30_CyclicPID" (固定周期循环中断：100ms)
// =========================================================================

// 1. 安全联锁判定（断线 / 超压 / 缺水干抽 / 急停 -> 强制切入 Mode 0 停用归零！）
IF NOT "Safety_InterlockOK" THEN
    "DB_PID".Mode := 0;                 // 0 = Inactive（输出强制归 0.0%）
ELSIF "PID_AutoMode" THEN
    "DB_PID".Mode := 3;                 // 3 = Automatic 自动闭环控制
ELSE
    "DB_PID".Mode := 4;                 // 4 = Manual 手动给定开度
END_IF;

// 2. 自动捕捉 Mode 变化产生单周期上升沿去激活 PID_Compact 模式切换！
#tempModeChanged := ("DB_PID".Mode <> "DB_PID".PrevMode);
"DB_PID".PrevMode := "DB_PID".Mode;

// 3. 手自动【无扰切换】核心技巧：
//    只要处于自动闭环模式，每 100ms 把当前实际输出同步赋值给手动设定值！
//    这样操作工突然把旋钮从“自动”拧到“手动”瞬间，阀门/水泵频率 0% 跳变！
IF "DB_PID".Mode = 3 THEN
    "DB_PID".ManualVal := "DB_PID".OutputPct;
END_IF;

// 4. 在 OB30 内严格等周期调用 PID_Compact 工艺对象
"PID_Compact_Press"(
    Setpoint     := "DB_PID".Setpoint,
    Input        := "DB_PID".InputPV,
    ManualEnable := FALSE,              // 统一由 Mode=4 管理手动，避免管脚冲突
    ManualValue  := "DB_PID".ManualVal,
    Reset        := NOT "Safety_InterlockOK",
    Mode         := "DB_PID".Mode,
    ModeActivate := #tempModeChanged,   // 必须用上升沿激活新模式！
    Output       => "DB_PID".OutputPct,
    Output_PER   => "AQ_VFD_Freq",      // 内部自动完成 0~100% -> 0~27648 换算！
    State        => "DB_PID".State,
    Error        => "DB_PID".Error
);`,
      },
      {
        kind: 'callout',
        tone: 'danger',
        title: '西门子 PID_Compact 三大现场翻车铁律（背下来值回一半面试分！）',
        md: `1. **绝对禁止把 \`PID_Compact\` 放进 \`OB1\`！** 必须右键添加 **循环中断 \`OB30\`**（水压/流量设 \`50~100ms\`，热压/烘箱大惯性温度设 \`200~500ms\`），否则扫描时间波动会让积分微分算错，甚至触发 \`PID_Compact\` 内部采样时间错误报警 \`16#0800\`！
2. **改了 \`Mode\` 却忘了触发 \`ModeActivate\` 上升沿**：很多新手在线把 \`Mode\` 改成 \`3\`（自动），可发现 \`State\` 纹丝不动一直停在 \`0\`——因为博途要求改完 \`Mode\` 必须给 \`ModeActivate\` 一个 \`0 → 1\` 上升沿才会生效！（上文代码已帮你做成全自动检测变化脉冲！）
3. **善用博途自带“自整定（Pretuning / Fine tuning）”**：面对热压温控这种难凭手感猜参数的大滞后对象，先在博途工艺对象调试面板里运行 **预调节（Mode 1）** 和 **精确调节（Mode 2）**，CPU 会自动阶跃测试对象惯性并算出极佳的 \`Kp/Ti/Td\`！`,
      },
      {
        kind: 'practice-task',
        title: '本讲实训打卡：恒压供水 PID 手动整定与抗扰动极限测试',
        scenario: '在上方双泵恒压供水数字孪生中担任过程控制工程师，亲手把振荡的管网调校得丝般顺滑。',
        steps: [
          '先故意把积分作用关弱、仅保留较小比例增益 Kp，观察实测压力 PV 为何始终低于设定值 SP（亲眼看见“纯比例控制必有静差”）。',
          '逐步加大比例增益并引入合适积分作用，观察 PV 精准追平 SP 并稳稳咬死；再尝试把 Kp 调得过大，直观体验系统发散震荡的波形特征。',
          '恢复理想参数后，突然增大出口用水负载（或触发故障注入），观察主泵变频提速与辅助工频切泵响应；最后切换自动↔手动体验无扰交接！',
        ],
        checkPoints: [
          '能用通俗语言讲清 P/I/D 各自的作用与“压力用 PI、温度用 PID”的工程经验',
          '深刻牢记 PID_Compact 必须运行在固定周期中断 OB30 的底层原理',
          '掌握“自动态跟踪 Output -> ManualValue”实现手自动无扰切换的标准代码模式',
        ],
      },
      {
        kind: 'quiz',
        title: '随堂闯关测验：PID 闭环控制与博途 PID_Compact',
        items: [
          {
            question: '在西门子 S7-1200/1500 项目中，为什么必须把 PID_Compact 工艺对象放在循环中断组织块（如 OB30）中调用，而严禁放在主程序 OB1 中？',
            options: [
              'OB1 里无法拖拽放置 PID_Compact 指令框',
              'PID 离散积分/微分运算严格依赖恒定等间隔采样时间 Δt，OB1 扫描周期波动会破坏控制精度甚至引发采样周期错误，OB30 可保证精准周期中断执行',
              '放在 OB1 里运行速度太快，会烧毁温度传感器',
              '只有 OB30 能读写模拟量 %IW/%QW 地址',
            ],
            answer: 1,
            explain:
              'OB1 执行周期受分支代码和通信负载影响时刻在变，而 OB30 是由 CPU 硬件定时器驱动的严格等周期中断（如精准每 100ms 触发一次），保证离散 PID 算式中的 Δt 恒定精确。',
          },
          {
            question: '在恒压供水系统中，发现实际水压始终稳定在 0.46 MPa，就是差一点爬不到目标值 0.50 MPa（存在明显稳态静差），并且管网压力信号略有高频抖动。工程师最合理的整定调整方向是？',
            options: [
              '疯狂加大微分时间 Td',
              '适当增强积分作用（减小积分时间 Ti）以消除静差，同时保持微分 Td = 0 避免放大压力噪声',
              '彻底关闭积分作用，把比例增益降到 0',
              '把 OB30 周期改成 10 秒',
            ],
            answer: 1,
            explain:
              '积分项（I）的核心职责就是消除稳态静差；而快速响应且带噪声的压力/流量回路通常不加微分（Td = 0），防止微分放大毛刺导致变频器频繁震颤。',
          },
          {
            question: '为了实现 PID 控制器从“自动闭环（Mode 3）”切换到“手动模式（Mode 4）”时水泵频率不发生剧烈跳变（无扰切换），最标准的软件实现逻辑是？',
            options: [
              '切换瞬间把水泵频率强制归零，再让工人慢慢加回来',
              '在自动模式运行期间，持续将 PID 当前实时输出值 Output 同步写入 ManualValue，这样切到手动瞬间出力无缝衔接',
              '在手动模式下锁死输出固定为 50%',
              '禁用手动模式',
            ],
            answer: 1,
            explain:
              '自动运行时让 ManualValue 实时跟踪 PID 的 Output，切入手动瞬间输出值与切换前完全一致，彻底杜绝水锤冲击或热压温度剧烈波动。',
          },
        ],
      },
    ],
  },
  {
    id: 'l15-profinet-project-delivery',
    chapterId: 'ch5',
    order: 15,
    title: 'PROFINET 通信与项目从需求到验收的全流程',
    subtitle: '打通从写代码到独立交付整套非标产线的最后一公里！吃透 G120/V90 控制字 047E→047F，直通简历毕业项目',
    level: '实战',
    minutes: 50,
    tags: ['PROFINET', 'G120/V90', '047E→047F', '111号报文', 'URS→SAT', '毕业项目衔接'],
    objectives: [
      '彻底掌握西门子 PROFINET IO 组态核心：设备名称（Device Name）与 IP 地址分配原则、GSDML 第三方设备导入与断站诊断',
      '精通 SINAMICS G120 变频器与 V90 伺服三大标准报文（1 号 / 3 号 / 111 号报文），熟记控制字 16#047E → 16#047F 启动时序与 16#4000(16384) 满速标定',
      '全面建立非标自动化工程师从 URS 需求解读 → 选型画图 → 软件架构 → PLCSIM 联调 → FAT/SAT 现场交付的 8 步全景工程视野',
      '无缝衔接本平台简历加分毕业大项目（锂电模组柔性视觉分拣、热压温控与立体入库工作站）',
    ],
    interviewTip:
      '终极高薪面试定音题：“讲讲你用 S7-1200 通过 PROFINET 控制西门子 G120 变频器或 V90 伺服的完整步骤与关键参数！”满分王炸答法：① 硬件组态拖入驱动器并连上 PROFINET 绿线，最关键一步是“分配 PROFINET 设备名称（Device Name）”确保与物理驱动器完全一致；② 选标准报文——G120 调速用 1 号报文（2 字收发），V90 做 EPOS 基本定位用 111 号报文配合官方 FB284（SINA_POS）；③ 1 号报文控制字 STW1 必须遵循先写 16#047E（上电就绪）再给 Bit0 上升沿写 16#047F（启动运行），故障复位给 Bit7（16#04FE），设定转速按 16#4000（十进制 16384）对应 P2000 基准转速（如 1500rpm）线性换算！',
    blocks: [
      {
        kind: 'text',
        title: '1. 一根绿色网线统治现代工厂：PROFINET IO 通信核心机制',
        md: `在十年前的工厂里，控制 1 台变频器就要接 6 根控制线 + 2 根模拟量线 + 3 根故障反馈线，一条产线 10 台变频器和伺服下来光接线就能累垮电工，而且模拟量还怕干扰。

今天，西门子 **PROFINET（工业实时以太网）** 用一根屏蔽绿色网线把整座车间连成一体：
- **IO 控制器（IO-Controller）**：即我们的主站 CPU（如 \`S7-1215C DC/DC/DC\`，\`192.168.0.1\`）；
- **IO 设备（IO-Device）**：挂载在网线上的各类智能从站——\`ET200SP\` 分布式远程 IO、\`SINAMICS G120\` 变频器、\`SINAMICS V90 PN\` 伺服驱动器、智能视觉相机、工业机器人、气动阀岛；
- **GSDML 描述文件**：如果对接非西门子第三方品牌（如基恩士视觉、费斯托阀岛、发那科机器人），只需找厂家官网下载一份后缀为 \`.xml\` 的 **GSDML 文件**，在博途菜单“选项 -> 管理通用站描述文件”中一键导入，就能像原生西门子模块一样直接拖进网络视图自动映射 \`%I / %Q\` 通信地址！

> 🔑 **PROFINET 通信最核心的两个身份（90% 新手必踩坑！）**：
> 1. **PROFINET 设备名称（Device Name）**：例如 \`g120-conveyor-01\` —— **这才是 PROFINET 实时循环通信认亲的真正身份证！**
> 2. **IP 地址**：例如 \`192.168.0.10\` —— 只要你给从站在线分配好了与博途组态一字不差的**设备名称**，上电时 CPU 甚至会自动把组态好的 IP 地址下发给从站！反之，如果只设了 IP 没分配设备名称，CPU 红灯 \`ERROR\` 会永远疯狂闪烁报“找不到 IO 设备”！`,
      },
      {
        kind: 'text',
        title: '2. 西门子变频器（G120）与伺服（V90 PN）三大黄金标准报文速查',
        md: `把 G120 或 V90 挂上 PROFINET 后，PLC 与驱动器之间不需要写任何复杂的 TCP 拆包代码——只要在硬件属性里选定**标准报文（Standard Telegram）**，博途就会直接把驱动器的控制字、转速设定、状态字、当前转速映射到几个普通的 \`%QW / %IW\` 地址，读写它们就像读写本地变量一样简单！

| 标准报文 | 典型适用驱动与场景 | 收发长度 | 核心控制方式与博途编程工具 |
| --- | --- | --- | --- |
| **1 号报文（Telegram 1）** | **G120 变频器速度控制**（传送带、风机、水泵） | 2 字出 / 2 字入 | 直接读写 \`STW1\`（控制字）+ \`NSOLL_A\`（转速设定）与 \`ZSW1\`（状态字）+ \`NIST_A\`（实际转速） |
| **3 号报文（Telegram 3）** | **V90 PN 伺服工艺对象定位**（PLC 侧做位置环） | 5 字出 / 9 字入 | 配合博途 **TO 工艺对象轴** + PLCopen 指令（\`MC_Power\` / \`MC_Home\` / \`MC_MoveAbsolute\`） |
| **111 号报文（Telegram 111）** | **V90 PN 伺服 EPOS 基本定位**（驱动器内做位置环，省 CPU 算力！） | 12 字出 / 12 字入 | 直接调用西门子官方免费库 **\`SINA_POS\`（FB284）**，填目标位置、速度、模式号即可精准绝对/相对定位与回零！ |

### 必须刻进 DNA 的 1 号报文“魔法十六进制密码”
- **准备上电就绪（OFF1 = 0）**：向控制字 \`STW1\` 写入 **\`16#047E\`**（二进制 Bit10=1 允许 PLC 控制，Bit1/2/3/4/5/6=1 解除急停与惯性停车，仅 Bit0=0 待命）；
- **启动运行（OFF1 = 1 上升沿！）**：向控制字 \`STW1\` 写入 **\`16#047F\`**（Bit0 从 0 变 1，驱动器立即励磁加速运行！）；
- **故障复位确认**：向控制字 \`STW1\` 的 Bit7 置 1（写入 **\`16#04FE\`**）；
- **转速标准化铁律**：西门子驱动器统一规定 **\`16#4000\`（十进制 \`16384\`）= 100.0% 基准转速（驱动器参数 \`P2000\`，默认 \`1500 rpm\` 或 \`50.0 Hz\`）**！所以想让皮带以 750 rpm 运行，只需往 \`NSOLL_A\` 发送 \`8192\`（\`16#2000\`），发负数（如 \`-8192\`）即平滑反转！`,
      },
      {
        kind: 'io-table',
        title: '毕业项目同款：PROFINET G120 变频器 1 号报文过程映像映射表',
        tags: [
          {
            name: 'G120_ZSW1_Status',
            address: '%IW256',
            type: 'Int',
            area: 'I',
            init: 0,
            comment: 'G120 1 号报文状态字 ZSW1（16位Word：Bit2=运行中，Bit3=存在故障，Bit6=禁止合闸）',
          },
          {
            name: 'G120_NIST_ActSpd',
            address: '%IW258',
            type: 'Int',
            area: 'I',
            init: 0,
            unit: '16384=100%',
            comment: 'G120 实际转速反馈值（16384 对应 P2000 基准转速 1500 rpm）',
          },
          {
            name: 'G120_STW1_Ctrl',
            address: '%QW256',
            type: 'Int',
            area: 'Q',
            init: 1150,
            comment: 'G120 1 号报文控制字 STW1（1150=16#047E 就绪停机，1151=16#047F 启动运行，1278=16#04FE 故障复位）',
          },
          {
            name: 'G120_NSOLL_SetSpd',
            address: '%QW258',
            type: 'Int',
            area: 'Q',
            init: 0,
            unit: '16384=100%',
            comment: 'G120 目标转速设定值（正数正转，负数反转，16384=1500 rpm）',
          },
          {
            name: 'Drive_RunCmd',
            address: 'DB_Conv.CmdRun',
            type: 'Bool',
            area: 'DB',
            init: false,
            comment: '上位顺控状态机下发的皮带启动命令',
          },
          {
            name: 'Drive_SetRpm',
            address: 'DB_Conv.SetRpm',
            type: 'Real',
            area: 'DB',
            init: 600.0,
            unit: 'rpm',
            comment: '来自锂电配方 UDT 的工艺目标转速设定（rpm）',
          },
          {
            name: 'Drive_ActRpm',
            address: 'DB_Conv.ActRpm',
            type: 'Real',
            area: 'DB',
            init: 0.0,
            unit: 'rpm',
            comment: '反换算后的实时工程转速（显示在 WinCC 看板）',
          },
          {
            name: 'Drive_Fault',
            address: 'DB_Conv.Fault',
            type: 'Bool',
            area: 'DB',
            init: false,
            comment: '从 ZSW1.%X3 切片解析出的变频器硬件故障报警',
          },
        ],
      },
      {
        kind: 'dual-code',
        title: '生产级 PROFINET 1 号报文标准驱动块 FB_Sinamics_Tel1（LAD 调用 vs 完整 SCL）',
        caption: '将 16#047E → 16#047F 控制字切换、Bit3 故障切片提取与 16384 转速标定全部封装进一个标准 FB，全厂几十台 G120 直接一拖即用！',
        lad: `// 在工位主控块中像积木一样实例化调用 G120 1 号报文驱动块：

                            #instConvDrive
                         ("FB_Sinamics_Tel1")
                    +----------------------------+
                    |EN                       ENO|
     "Safety_OK" ---|enable             actRpmOut|--- "Drive_ActRpm"
  "Drive_RunCmd" ---|cmdRun               running|--- #tempConvRunning
  "Drive_SetRpm" ---|setpointRpm            fault|--- "Drive_Fault"
         1500.0 ----|refMaxRpm           ctrlWord|--- "G120_STW1_Ctrl" (%QW256)
     "Reset_PB" ----|ackFault            speedRaw|--- "G120_NSOLL_SetSpd" (%QW258)
"G120_ZSW1_Status"--|statusWord                  |
"G120_NIST_ActSpd"--|actSpeedRaw                 |
                    +----------------------------+`,
        scl: `FUNCTION_BLOCK "FB_Sinamics_Tel1"
{ S7_Optimized_Access := 'TRUE' }
VAR_INPUT
    enable      : Bool;            // 急停与安全回路使能
    cmdRun      : Bool;            // 启动运行命令
    setpointRpm : Real;            // 工艺目标转速 (rpm，负值反转)
    refMaxRpm   : Real := 1500.0;  // 变频器参数 P2000 基准转速
    ackFault    : Bool;            // 故障复位按钮
    statusWord  : Word;            // 对应硬件输入 %IW256 (ZSW1)
    actSpeedRaw : Int;             // 对应硬件输入 %IW258 (NIST_A)
END_VAR
VAR_OUTPUT
    running     : Bool;            // 变频器运行中反馈 (ZSW1.Bit2)
    fault       : Bool;            // 变频器故障反馈 (ZSW1.Bit3)
    actRpmOut   : Real;            // 实时工程转速 (rpm)
    ctrlWord    : Word;            // 对应硬件输出 %QW256 (STW1)
    speedRaw    : Int;             // 对应硬件输出 %QW258 (NSOLL_A)
END_VAR
VAR_TEMP
    tempRatio   : Real;
END_VAR

BEGIN
    // 1. 使用西门子切片访问解析状态字 ZSW1 关键位
    #running := #statusWord.%X2;   // Bit 2: Operation Enabled（运行中）
    #fault   := #statusWord.%X3;   // Bit 3: Fault Present（变频器故障）

    // 2. 实际转速反标定：16384 (16#4000) 对应 refMaxRpm (P2000)
    #actRpmOut := (INT_TO_REAL(#actSpeedRaw) / 16384.0) * #refMaxRpm;

    // 3. 标准控制字 STW1 状态机（严格遵守 16#047E 就绪 -> 16#047F 启动时序！）
    IF NOT #enable THEN
        #ctrlWord := 16#047E;      // 安全停机（保持就绪待命，OFF1=0）
    ELSIF #fault AND #ackFault THEN
        #ctrlWord := 16#04FE;      // Bit 7 置 1 执行故障复位确认
    ELSIF #cmdRun AND (NOT #fault) AND (NOT #statusWord.%X6) THEN
        // 确认未处于“禁止合闸 Bit6”时，拉高 Bit0 发送 16#047F 启动运行！
        #ctrlWord := 16#047F;
    ELSE
        #ctrlWord := 16#047E;      // 默认保持 047E，确保下次启动能产生 Bit0 上升沿
    END_IF;

    // 4. 目标转速限幅与 16384 标定输出（保护除以零）
    IF #refMaxRpm > 1.0 THEN
        #tempRatio := LIMIT(MN := -1.0, IN := (#setpointRpm / #refMaxRpm), MX := 1.0);
        #speedRaw  := REAL_TO_INT(#tempRatio * 16384.0);
    ELSE
        #speedRaw  := 0;
    END_IF;
END_FUNCTION_BLOCK`,
      },
      {
        kind: 'text',
        title: '3. 蜕变为真正独立交付的工程师：非标项目 URS → SAT 八步闭环',
        md: `会写程序只是成为优秀 PLC 工程师的 30%；真正能独立扛下百万级非标自动化项目、写进简历震撼面试官的核心能力，是完整走通 **工业自动化项目全生命周期 8 大里程碑**：

1. **\`01 URS 需求解读\`**：吃透客户用户需求规格书（节拍 CT、良率 OEE、安全等级、MES 接口），输出 **FDS（功能设计说明书）**；
2. **\`02 硬件选型 BOM & EPLAN 电气原理图\`**：算清点数（预留 **15%~20% 备用 I/O**！）、电源功率、空开断路器、安全继电器与 24V 分配；
3. **\`03 标准 I/O 点表与变量命名契约\`**：联合电工与 HMI 工程师锁定每一根线号、西门子地址与符号名；
4. **\`04 TIA Portal 硬件组态与 PROFINET 拓扑\`**：组态 CPU/SM/HMI/G120/V90/视觉相机、规划网段 IP 与 PROFINET 设备名；
5. **\`05 模块化软件架构开发\`**：按 \`OB100\` 初始化 + \`OB1\` 主调 + \`OB30\` PID 中断 + \`UDT\` 数据模型 + 标准 \`FB\` 库（气缸/变频/状态机）+ \`OB86\` 诊断规范编码；
6. **\`06 PLCSIM 虚拟联调\`**：机台还没装好前，先在电脑用 PLCSIM + WinCC 仿真把 80% 的逻辑 Bug 消灭在出厂前！
7. **\`07 FAT（厂内验收测试）\`**：上电前查短路 → 空载点动查 I/O 方向 → 单机手自动 → 满载拷机跑 1000 模组 + **故意拔网线/拍急停/卡传感器做故障注入测试**！
8. **\`08 SAT（客户现场验收与归档）\`**：现场安装连线、MES 联调、操作维护培训、移交终版归档程序包（\`.zap18\`）、图纸与手册，签字验收收尾款！`,
      },
      {
        kind: 'workflow',
        id: 'project-lifecycle',
        title: '全景工程蓝图：非标自动化项目 URS → SAT 八步交付交互工作流',
        instruction:
          '从 01 到 08 逐个点击工程节点，展开每个阶段的工程师核心交付物模板、最容易延期的爆雷点以及出厂自检 Checklist——这就是你马上在毕业大项目中亲手走一遍的真实流程！',
      },
      {
        kind: 'callout',
        tone: 'danger',
        title: 'PROFINET 现场联调三大血泪坑（95% 的现场通宵都是踩了这三条！）',
        md: `1. **只配了 IP 忘了分配 PROFINET 设备名称**：上电 CPU 红灯狂闪、驱动器通讯灯灭！切记在博途在线访问中右键驱动器执行 **“分配设备名称（Assign device name）”**，且必须与项目组态里一字不差（区分连字符与大小写）！
2. **开机直接送 \`16#047F\` 导致变频器死活不转**：SINAMICS 驱动器内置“防上电自启动安全锁（StatusWord Bit 6 禁止合闸）”！上电直接发 \`047F\` 会被硬件拒绝，**必须先发 \`16#047E\` 让驱动器进入就绪态，再把 Bit0 拉高变 \`16#047F\` 才能运转！**
3. **不写 \`DeviceStates\` 或 \`OB86\` 断站诊断**：网线被叉车挂断了，PLC 程序还以为传送带在正常转，上游机械手继续疯狂往停住的皮带上堆料撞坏模具！正式项目必须调用系统指令 \`DeviceStates\` 实时监控每个 PROFINET 从站在线状态，任一关键站点掉线立刻触发全线安全暂停报警！`,
      },
      {
        kind: 'practice-task',
        title: '本讲结业冲刺打卡：完成交付清单核验，进军简历级毕业大项目！',
        scenario: '恭喜你已完成全部 5 章 15 讲系统课程！现在你已具备开启综合毕业项目《基于 S7-1215C + PROFINET 的新能源锂电模组柔性视觉分拣、热压恒温固化与立体入库工作站》的全部技能拼图。',
        steps: [
          '在上方“URS → SAT 项目全生命周期工作流”中逐一点击 01~08 八个里程碑，重点核对 FAT 厂内验收故障注入清单。',
          '复盘 FB_Sinamics_Tel1 源码：核实当驱动器报警（ZSW1.%X3=1）时控制字如何切换到 16#04FE 复位，以及正常停机为何必须保持 16#047E 而非直接写 16#0000。',
          '完成下方结业综合测验后，立刻点击顶部导航栏【毕业项目 ★】进入 Capstone 工作台，完成 5 关实战编程闯关、联调 SCADA 孪生大屏，并一键生成你的 STAR 法则专属高薪简历文案！',
        ],
        checkPoints: [
          '吃透 PROFINET 设备名称、GSDML 导入与 DeviceStates 断站监控原理',
          '熟记 G120/V90 的 1/3/111 号报文选型及 047E→047F、16384 满速标定铁律',
          '打通 5 大知识模块（硬件接线 → 扫描与位逻辑 → 时序顺控 → FB/UDT/SCL → 模拟量/PID/PROFINET）准备攻克毕业项目！',
        ],
      },
      {
        kind: 'quiz',
        title: '结业综合闯关测验：PROFINET、驱动报文与工程交付',
        items: [
          {
            question: '在 S7-1200 PROFINET 现场调试中，工程师已经给新换的 G120 变频器设好了正确的 IP 地址 192.168.0.10，但 CPU 面板依然亮红色 ERROR 灯并提示找不到 IO 设备。最可能遗漏了哪一步关键操作？',
            options: [
              '忘记把网线插到路由器广域网口',
              '忘记为该变频器在线“分配 PROFINET 设备名称（Device Name）”，导致设备名称与博途硬件组态不匹配',
              '忘记关闭电脑防火墙',
              'G120 只能用 RS485 通信不能用 PROFINET',
            ],
            answer: 1,
            explain:
              'PROFINET IO 实时周期通信是以“设备名称（Device Name）”作为主站寻址标识的！新设备或更换备件后必须在线分配与组态完全一致的 PROFINET 设备名称。',
          },
          {
            question: '使用 PROFINET 标准 1 号报文控制西门子 G120 变频器（基准转速 P2000 = 1500 rpm）正向以 750 rpm 稳定运行时，控制字 STW1 的切换顺序与目标转速设定值 NSOLL_A 分别是？',
            options: [
              'STW1 直接写 16#0001，NSOLL_A 写 750',
              'STW1 先写 16#047E（就绪）再切换为 16#047F（启动），NSOLL_A 写 8192（16#2000，即 16384 的 50%）',
              'STW1 写 16#FFFF，NSOLL_A 写 13824（27648 的 50%）',
              'STW1 先写 16#047F 再切回 16#047E，NSOLL_A 写 50',
            ],
            answer: 1,
            explain:
              'SINAMICS 驱动器 1 号报文铁律：STW1 须先给 16#047E 待命，再经 Bit0 上升沿写 16#047F 启机；速度标定基准是 16#4000（16384）= 100% P2000（注意区别于模拟量模块的 27648！），故 750/1500 = 50% 对应 8192。',
          },
          {
            question: '在非标自动化项目交付规范中，以下哪一项严格符合从设计到验收的正确工程顺序与规范？',
            options: [
              '先写代码再画电气图，最后等设备拉到客户厂里第一次上电测试（SAT）',
              '硬件选型时 I/O 点数刚好卡死 0 余量，省到极致',
              '遵循 URS/FDS → 预留 15%~20% I/O 余量选型与 EPLAN 制图 → IO 表与 UDT 契约 → 模块化编码与 PLCSIM 虚拟联调 → FAT 厂内验收及故障注入 → SAT 现场交付归档',
              '把所有代码全写在一个 3000 行的 OB1 里交给客户方便查看',
            ],
            answer: 2,
            explain:
              '专业的非标自动化交付强调“先定契约与余量、再模块化开发、尽早在 PLCSIM 和 FAT 厂内通过故障注入提前排雷”，从而保证客户现场 SAT 一次丝滑通关！',
          },
        ],
      },
    ],
  },
];
