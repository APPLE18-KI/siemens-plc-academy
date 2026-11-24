import type { ChapterMeta, Lesson } from '../../types/content';

export const ch4Meta: ChapterMeta = {
  id: 'ch4',
  order: 4,
  title: '第 4 章：模块化架构与 SCL——初级与中高级工程师的分水岭',
  subtitle: '告别千行 OB1 面条代码！精通 FB/FC/多重背景、UDT + 优化 DB 配方管理与工业级 SCL 状态机',
  badge: '进阶',
};

export const ch4Lessons: Lesson[] = [
  {
    id: 'l10-fc-fb-instance-db',
    chapterId: 'ch4',
    order: 10,
    title: '告别千行 OB1 面条代码：FC vs FB、背景 DB 与多重背景气缸标准块',
    subtitle: '24 个气缸只写 1 套代码！吃透西门子块架构精髓，亲手打造简历级可复用 FB_Cylinder2Pos 驱动块',
    level: '进阶',
    minutes: 35,
    tags: ['FB函数块', 'FC函数', '背景数据块', '多重背景', 'FB_Cylinder2Pos'],
    objectives: [
      '彻底辨清西门子 OB / FC / FB / DB 四大程序块的职责分工与内存生命周期差异',
      '深刻理解“FB 带静态记忆区（Instance DB），FC 无静态记忆区”的本质区别，精准选型',
      '掌握西门子中高级工程师标配的“多重背景（Multi-Instance）”封装技巧，彻底消灭满屏零散 DB',
      '读懂并复用一套符合西门子编程规范的工业级双位气缸标准块 FB_Cylinder2Pos（含磁簧互斥与超时报警）',
    ],
    interviewTip:
      '中级以上 PLC 工程师面试 100% 必考题：“FC 和 FB 的本质区别是什么？为什么气缸和电机驱动一定要做成 FB 并使用多重背景？”满分答法：FC 没有静态存储区（Static）和背景 DB，适合纯数学换算等无状态逻辑；FB 拥有独立的背景数据块存储 Static 静态变量，能跨扫描周期记住自锁状态、定时器和边沿位，非常适合封装电机/气缸等有状态对象。在工位父级 FB 的 Static 区声明子气缸为多重背景（Multi-Instance），既能复用一套标准代码驱动 24 个气缸，又能把 24 个散乱 DB 合并进 1 个整洁工位 DB 中！',
    blocks: [
      {
        kind: 'text',
        title: '1. 真实职场分水岭：24 个气缸，初级写 1200 行 vs 高级写 50 行！',
        md: `你接手一台新能源电池组装机，整机有 **24 个双作用气缸**（每个气缸都要支持：手动点动、自动命令、伸出磁簧到位检测、缩回原位检测、2.5 秒不到位超时报警、双磁簧同时亮传感器粘连故障、报警复位）。

- **初级工程师做法**：在 \`OB1\` 里先写好 1 号气缸的 10 段梯形图，然后疯狂 **复制粘贴 23 次**，再手动把地址从 \`%I0.0\` 改到 \`%I6.7\`、把 48 个定时器逐一重命名！不仅写了 1,200 行密不透风的“面条代码”，更惨的是现场调试时客户说“所有气缸超时改成 4 秒”，他不得不改 24 个地方，漏改 2 处酿成撞机！
- **中高级工程师做法**：只精心编写并千锤百炼 **1 个标准气缸函数块 \`FB_Cylinder2Pos\`**，然后在工位主控块中像搭乐高一样实例化调用 24 次！改一处逻辑，24 个气缸瞬间全部同步升级！`,
      },
      {
        kind: 'text',
        title: '2. 西门子四大程序块（OB / FC / FB / DB）精准定位表',
        md: `| 块类型 | 全称 | 有无持久记忆（Static） | 核心定位与典型案例 |
| --- | --- | --- | --- |
| **\`OB\`** | 组织块（Organization Block） | 无（由系统事件触发） | **程序入口调度器**：\`OB1\` 主循环、\`OB100\` 开机初始化、\`OB30\` 固定周期中断（放 PID）、\`OB86\` PROFINET 断站诊断 |
| **\`FC\`** | 函数（Function） | **❌ 无 Static 区**（只有临时 \`Temp\`，每周期销毁！） | **无状态纯计算工具**：模拟量工程量换算 \`FC_ScaleAnalog\`、单位转换、数组求和、配方查找 |
| **\`FB\`** | 函数块（Function Block） | **✅ 有 Static 区**（保存在专属背景数据块 Instance DB） | **有状态标准对象**：气缸驱动 \`FB_Cylinder2Pos\`、电机/变频器块 \`FB_Motor\`、\`TON\`/\`CTU\`、工位自动顺控块 |
| **\`DB\`** | 数据块（Data Block） | 专门存放数据 | **全局 DB**（全工程共享配方/参数/状态） & **背景 DB**（系统为 FB 自动生成的私有“记忆大脑”） |

### 什么是“多重背景（Multi-Instance）”？
如果工位里有 10 个气缸和 10 个定时器，每调用一次就生成一个“单背景 DB”，项目树里会瞬间爆炸出 20 个零散 DB，维护噩梦！
西门子官方推荐的 **多重背景** 极其优雅：在父级工位块（如 \`FB_Station1\`）的 **\`Static\` 静态变量区** 里，直接把子块和定时器声明为成员变量（如 \`instCylPush : "FB_Cylinder2Pos"\`、\`instTonWait : TON_TIME\`）。这样所有子气缸与定时器的记忆数据自动嵌套进父级唯一的 \`DB_Station1\` 中，工程树清爽如画！`,
      },
      {
        kind: 'text',
        title: '3. 工业级标准块解剖：`FB_Cylinder2Pos` 接口设计规范',
        md: `严格遵循西门子官方 *Programming Styleguide*（静态变量加 \`stat\` 前缀、多重背景加 \`inst\` 前缀、临时变量加 \`temp\` 前缀），一个能直接拿去交付真实项目的标准双位气缸块接口如下：

| 接口区 | 变量名 | 数据类型 | 方向与职责说明 |
| --- | --- | --- | --- |
| \`VAR_INPUT\` | \`enable\` | \`Bool\` | 安全使能（通常接急停与安全门就绪，为 FALSE 立刻安全断阀） |
| \`VAR_INPUT\` | \`cmdWork\` | \`Bool\` | 伸出到工作位命令（自动或手动逻辑汇总后传入） |
| \`VAR_INPUT\` | \`sensorHome\` | \`Bool\` | 缩回原位磁簧开关物理信号 |
| \`VAR_INPUT\` | \`sensorWork\` | \`Bool\` | 伸出工作位磁簧开关物理信号 |
| \`VAR_INPUT\` | \`timeoutTime\` | \`Time\` | 动作超时判定阈值（默认 \`T#3s\`） |
| \`VAR_INPUT\` | \`ackFault\` | \`Bool\` | 故障复位确认信号 |
| \`VAR_OUTPUT\` | \`valveWork\` | \`Bool\` | 驱动电磁阀线圈输出（单电控电磁阀） |
| \`VAR_OUTPUT\` | \`atHome\` / \`atWork\` | \`Bool\` | 经防抖确认的气缸真正在原位 / 在工作位状态 |
| \`VAR_OUTPUT\` | \`fault\` / \`faultCode\` | \`Bool\` / \`Int\` | 故障锁存标志与精准故障码（\`1=伸出超时 2=缩回超时 3=双磁簧互斥粘连\`） |
| \`VAR\` (Static) | \`instTonWork\` / \`instTonHome\` | \`TON\` | 多重背景 IEC 定时器（监控伸出与缩回超时） |
| \`VAR\` (Static) | \`statFaultLatch\` / \`spareBool\` | \`Bool\` / \`Array\` | 内部故障锁存位 + **预留备用变量（不停机热修神器！）** |`,
      },
      {
        kind: 'io-table',
        title: '工位调用 FB_Cylinder2Pos 实例 1（推料气缸 A）外部实参接线表',
        tags: [
          {
            name: 'Safety_OK',
            address: '%M10.0',
            type: 'Bool',
            area: 'M',
            init: true,
            comment: '传入 FB.enable：急停与安全门全部正常',
          },
          {
            name: 'CylA_Home_Sens',
            address: '%I0.5',
            type: 'Bool',
            area: 'I',
            init: true,
            comment: '传入 FB.sensorHome：推料气缸 A 原位磁簧开关',
          },
          {
            name: 'CylA_Work_Sens',
            address: '%I0.6',
            type: 'Bool',
            area: 'I',
            init: false,
            comment: '传入 FB.sensorWork：推料气缸 A 伸出到位磁簧开关',
          },
          {
            name: 'Alarm_Reset_PB',
            address: '%I0.7',
            type: 'Bool',
            area: 'I',
            init: false,
            comment: '传入 FB.ackFault：操作台故障复位按钮',
          },
          {
            name: 'Valve_CylA_Out',
            address: '%Q0.1',
            type: 'Bool',
            area: 'Q',
            init: false,
            comment: '接出 FB.valveWork：驱动推料气缸 A 电磁阀',
          },
          {
            name: 'CylA_Timeout',
            address: 'DB_Station1.CylA_PT',
            type: 'Time',
            area: 'DB',
            init: 3000,
            unit: 'ms',
            comment: '传入 FB.timeoutTime：伸出/缩回超时报警阈值',
          },
          {
            name: 'CylA_FaultCode',
            address: 'DB_Station1.CylA_Err',
            type: 'Int',
            area: 'DB',
            init: 0,
            comment: '接出 FB.faultCode（0=正常 1=伸出超时 2=缩回超时 3=传感器互斥粘连）',
          },
        ],
      },
      {
        kind: 'dual-code',
        title: '工业级标准气缸块 FB_Cylinder2Pos：多重背景调用（LAD）与完整源码（SCL）',
        caption: '这份 SCL 源码遵循西门子官方编程规范，包含安全使能、超时监控、双磁簧粘连互检与热修改预留变量，可直接导入真实 TIA Portal 工程使用！',
        lad: `// 在父级工位 FB_Station1 的 LAD 网络中，作为多重背景 #instCylPushA 调用：
// 只需把外部传感器与阀号往方框管脚一连，24 个气缸像搭积木一样 10 分钟装配完毕！

                           #instCylPushA
                        ("FB_Cylinder2Pos")
                    +-------------------------+
                    |EN                    ENO|
   "Safety_OK"  ----|enable          valveWork|---- "Valve_CylA_Out" (%Q0.1)
   #statCmdPush ----|cmdWork            atHome|---- #tempCylA_Home
 "CylA_Home_Sens"---|sensorHome         atWork|---- #tempCylA_Work
 "CylA_Work_Sens"---|sensorWork          fault|---- #tempCylA_Fault
       T#3s     ----|timeoutTime     faultCode|---- "CylA_FaultCode"
 "Alarm_Reset_PB"---|ackFault                 |
                    +-------------------------+`,
        scl: `FUNCTION_BLOCK "FB_Cylinder2Pos"
{ S7_Optimized_Access := 'TRUE' }
VAR_INPUT
    enable      : Bool;           // 安全使能（急停/安全门就绪）
    cmdWork     : Bool;           // 伸出工作位命令
    sensorHome  : Bool;           // 原位磁簧开关
    sensorWork  : Bool;           // 工作位磁簧开关
    timeoutTime : Time := T#3s;   // 超时阈值
    ackFault    : Bool;           // 故障复位确认
END_VAR
VAR_OUTPUT
    valveWork   : Bool;           // 单电控电磁阀输出
    atHome      : Bool;           // 确认在原位
    atWork      : Bool;           // 确认在工作位
    fault       : Bool;           // 故障锁存总标志
    faultCode   : Int;            // 0=正常 1=伸出超时 2=缩回超时 3=双传感器同时亮
END_VAR
VAR
    instTonWork    : TON_TIME;           // 多重背景：伸出超时定时器
    instTonHome    : TON_TIME;           // 多重背景：缩回超时定时器
    statFaultLatch : Bool;               // 内部故障锁存状态
    statFaultCode  : Int;                // 内部故障代码记忆
    spareBool      : Array[0..3] of Bool;// 资深工程秘籍：预留备用位，便于现场不停机热修！
END_VAR

BEGIN
    // 1. 故障复位逻辑（需在消除物理卡阻后按下复位）
    IF #ackFault AND NOT (#sensorHome AND #sensorWork) THEN
        #statFaultLatch := FALSE;
        #statFaultCode  := 0;
    END_IF;

    // 2. 双磁簧传感器互斥故障检测（气缸绝不可能同时在原点又在终点！）
    IF #sensorHome AND #sensorWork THEN
        #statFaultLatch := TRUE;
        #statFaultCode  := 3;
    END_IF;

    // 3. 安全条件与命令汇总输出电磁阀
    #valveWork := #enable AND #cmdWork AND (NOT #statFaultLatch);

    // 4. 无条件调用伸出/缩回超时监控定时器
    #instTonWork(IN := #valveWork AND (NOT #sensorWork), PT := #timeoutTime);
    #instTonHome(IN := #enable AND (NOT #valveWork) AND (NOT #sensorHome), PT := #timeoutTime);

    IF #instTonWork.Q THEN
        #statFaultLatch := TRUE;
        #statFaultCode  := 1;   // 报警：气缸伸出卡阻超时！
    ELSIF #instTonHome.Q THEN
        #statFaultLatch := TRUE;
        #statFaultCode  := 2;   // 报警：气缸缩回卡阻超时！
    END_IF;

    // 5. 状态输出映射
    #atHome    := #sensorHome AND (NOT #sensorWork);
    #atWork    := #sensorWork AND (NOT #sensorHome);
    #fault     := #statFaultLatch;
    #faultCode := #statFaultCode;
END_FUNCTION_BLOCK`,
      },
      {
        kind: 'model',
        id: 'sorting-conveyor',
        title: '模块化映射演练：把三工位分拣线的 3 组推料气缸抽象成 3 个 FB 实例',
        instruction:
          '再次运行三工位分拣线数字孪生，这一次用“面向对象架构师”的眼光观察 A/B/C 三组推料气缸：它们背后的底层驱动完全可以用上面同一个 FB_Cylinder2Pos 的 3 个多重背景实例驱动！',
      },
      {
        kind: 'callout',
        tone: 'danger',
        title: '两大毁灭性 FB/FC 反模式：读未初始化的 Temp & 外部直捅背景 DB！',
        md: `1. **读取未先赋值的 \`VAR_TEMP\`**：在 FC 或 FB 中，如果你先判断 \`IF #tempFlag THEN...\` 而忘了在本周期先给 \`#tempFlag\` 赋值，你会读到上一个程序块遗留在临时堆栈里的随机垃圾值，造成彻底无法复现的幽灵故障！**铁律：\`VAR_TEMP\` 变量必须先写后读！**
2. **外部程序直接修改 FB 背景 DB 内部静态变量**（如在 OB1 里直接写 \`"DB_CylA".statFaultLatch := FALSE\`）：这会彻底打破封装边界，后续升级 FB 接口时直接引爆隐式联动崩溃！**规范：外部只通过 FB 的 \`IN / OUT / IN_OUT\` 管脚对话！**
3. **老手秘籍（源自西门子现场经验）**：在核心 FB 的 \`Static\` 区预先留几个 \`spareBool / spareInt\` 备用变量——等产线 7×24 运行后若急需加一个内部标志位补丁，直接借用备用位即可实现**不停机在线下载**，无需重构背景 DB 导致产线重初始化停机！`,
      },
      {
        kind: 'practice-task',
        title: '第 10 讲实训打卡：把面条程序重构为 FB 多重背景架构',
        scenario: '对照上方三工位分拣线与 FB_Cylinder2Pos 源码，完成一次完整的模块化架构评审。',
        steps: [
          '逐行核对 FB_Cylinder2Pos 代码中的 3 种故障码（1=伸出超时、2=缩回超时、3=双传感器互斥），验证为什么即使气压不足气缸推不到位，系统也能在 3 秒后精准停阀并告诉操作工具体坏了哪根气缸。',
          '设想你为三工位分拣线创建父级工位块 FB_SortingStation：在它的 Static 区声明 instCylA、instCylB、instCylC 三个类型为 FB_Cylinder2Pos 的多重背景变量。',
          '检查你的毕业项目思路：一台非标工作站里的电机、气缸、加热温控、视觉通信全部可以按此范式封装为标准 FB 库！',
        ],
        checkPoints: [
          '能一针见血讲清 FC 与 FB 的本质差异以及各自的正确使用边界',
          '理解多重背景（Multi-Instance）如何将数十个零散 DB 聚合进单一父级工位 DB',
          '熟记 VAR_TEMP 必须“先写后读”以及“预留 spare 备用静态变量”两大高级技巧',
        ],
      },
      {
        kind: 'quiz',
        title: '随堂闯关测验：FC、FB、背景 DB 与多重背景',
        items: [
          {
            question: '你需要编写一个通用模块，用来把模拟量原始整型值 0~27648 线性换算成 0.0~100.0°C 工程浮点温度，不需要记忆任何历史状态也不含定时器。最恰当的块类型是？',
            options: [
              'OB（组织块）',
              'FC（函数），因为它无内部状态、无需额外分配背景 DB，调用最轻量高效',
              '必须用 FB 并创建 20 个背景 DB',
              '直接写死在全局 DB 里',
            ],
            answer: 1,
            explain:
              '纯数学计算、查表、单位换算等“当周期给输入即算输出、无跨周期状态”的逻辑，最适合用轻量无背景 DB 的 FC 函数实现。',
          },
          {
            question: '在父级工位块 FB_Station1 的 Static（静态变量）区中，将子块 FB_Cylinder2Pos 声明为成员变量 instCylClamp，这种技术被称为？',
            options: [
              '单背景 DB 调用',
              '多重背景（Multi-Instance），使子块状态自动嵌入父级 DB，避免项目树充斥大量零散 DB',
              '全局 M 区映射',
              '切片访问',
            ],
            answer: 1,
            explain:
              '多重背景（Multi-Instance）是西门子官方主推的模块化架构：子 FB 与 IEC 定时器作为父 FB 的静态成员，共享父级的单个背景 DB，结构极其清晰且易于整站复制复用。',
          },
          {
            question: '按照西门子官方编程指南，下列关于 FB 与背景数据块（Instance DB）的工程实践哪一项是严格禁止的坏习惯？',
            options: [
              '在 FB 内部使用 #stat 前缀命名静态变量，#temp 前缀命名临时变量',
              '在核心 FB 中预留少量 spareBool/spareInt 备用静态变量方便日后不停机打补丁',
              '在 OB1 或其他无关的 FC 中绕开管脚，直接强行读写某 FB 背景 DB 里的内部 Static 变量',
              '将 FB 的超时定时器声明为多重背景 TON_TIME',
            ],
            answer: 2,
            explain:
              '直接从外部捅穿 FB 的背景 DB 读写内部变量会严重破坏高内聚低耦合架构，导致交叉引用混乱与维护灾难；所有外部交互都应通过规范的 IN/OUT/IN_OUT 接口进行。',
          },
        ],
      },
    ],
  },
  {
    id: 'l11-udt-global-db',
    chapterId: 'ch4',
    order: 11,
    title: 'UDT（PLC 数据类型）+ 优化访问全局 DB：管理多工位与锂电配方',
    subtitle: '一条产线一键切换 10 种锂电模组配方！吃透西门子优化块访问机制与 UDT 结构体数据契约',
    level: '进阶',
    minutes: 30,
    tags: ['UDT', '优化访问DB', '配方管理', 'IN_OUT传参', '数组越界保护'],
    objectives: [
      '学会使用西门子 UDT（PLC 数据类型，以 type 前缀命名）定义高度结构化的工艺配方与工位状态蓝图',
      '深刻理解 S7-1200/1500 “优化的块访问（Optimized Block Access）”相比传统标准 DB 的 4 大技术优势及适用边界',
      '掌握使用 VAR_IN_OUT 引用传递大型 UDT 结构体，以及使用 ARRAY[0..9] 实现多品种配方一键切换与防越界保护',
      '理解 UDT 如何充当 PLC 与 WinCC 触摸屏面板（Faceplate）之间的唯一标准化数据契约',
    ],
    interviewTip:
      '面试高频架构题：“S7-1200/1500 的优化访问 DB 和非优化（标准）DB 有什么区别？什么情况下必须关闭优化访问？”满分答法：优化 DB 由编译器自动排布内存以消除字节对齐空洞、执行效率更高，且只允许符号寻址（杜绝地址偏移算错），还能对单个变量独立设置断电保持（Retain），并在增加变量时实现最小影响在线下载。只有在需要和老式不支持符号寻址的第三方 HMI、Modbus TCP 寄存器或 S7 PUT/GET 绝对偏移通信对接时，才单独建一个“非优化通信接口 DB”做中转，内部业务 DB 全部保持优化！',
    blocks: [
      {
        kind: 'text',
        title: '1. 真实产线痛点：一换产品型号，操作工就要手动改 15 个参数？',
        md: `在新能源锂电模组产线上，上午生产 **LFP-280Ah 储能电芯**（热压目标温度 \`85.0°C\`、保压时间 \`12s\`、传送带速度 \`600 rpm\`、允许宽度公差 \`±0.3mm\`），下午切单生产 **NCM-50Ah 动力电芯**（目标温度 \`72.5°C\`、保压 \`8s\`、速度 \`900 rpm\`）。

如果这些参数像散沙一样丢在 \`%MD100\`、\`%MD104\`、\`%MW108\` 里，不仅每次新增一个参数都要核对几十个地址偏移，而且在写“一键切换配方”或给 5 个工位共享数据时代码会丑陋得无法维护。

西门子给出的优雅答案就是 **\`UDT\`（User-Defined Data Type，博途中称“PLC 数据类型”） + 优化访问全局 \`DB\`**！`,
      },
      {
        kind: 'text',
        title: '2. 优化访问 DB vs 非优化（标准）DB 一目了然对比',
        md: `在 S7-1200/1500 中，新建的数据块默认勾选 **“优化的块访问（Optimized block access）”**，这是西门子相比老一代 S7-300/400 最核心的架构跃升之一：

| 对比维度 | 优化的块访问（Optimized DB，默认强烈推荐） | 标准/非优化访问（Standard DB，兼容模式） |
| --- | --- | --- |
| **寻址方式** | **纯符号寻址**（如 \`"DB_Recipe".active.targetTemp\`），无固定字节偏移 | 同时支持符号与绝对偏移（如 \`DB10.DBD4\`） |
| **内存与性能** | CPU 编译器自动按最优字节边界重排，**零对齐浪费、访问速度最快** | 严格按声明顺序排列，易产生字节对齐空洞 |
| **断电保持（Retain）** | **极其灵活**：可精细到对 DB 里的**任意单个变量**单独勾选保持！ | 只能整个 DB 全部保持或全部不保持 |
| **在线修改体验** | 支持“加载不重新初始化（内存预留）”，添加新参数不易打断生产 | 改动前面变量导致后面所有绝对偏移错位，极易引发通信大乱 |
| **何时必须关掉它？** | 新项目内部业务 DB **全部开启优化**！ | 仅在对接老式第三方触摸屏/上位机（需读 \`DB10.DBW0\`）或 S7 \`PUT/GET\` 通信时，**单独建 1 个非优化接口 DB 专门转交数据！** |`,
      },
      {
        kind: 'io-table',
        title: '锂电模组配方全局数据块 DB_Recipe 核心运行接口表',
        tags: [
          {
            name: 'DB_Recipe.selectIdx',
            address: 'DB20.selectIdx',
            type: 'Int',
            area: 'DB',
            init: 0,
            comment: 'HMI 选中的配方索引号（严格校验范围 0 ~ 9，防数组越界停机！）',
          },
          {
            name: 'DB_Recipe.cmdLoad',
            address: 'DB20.cmdLoad',
            type: 'Bool',
            area: 'DB',
            init: false,
            comment: 'HMI 一键加载配方按钮触发脉冲',
          },
          {
            name: 'DB_Recipe.active.targetTemp',
            address: 'DB20.active.temp',
            type: 'Real',
            area: 'DB',
            init: 85.0,
            unit: '°C',
            comment: '当前生效热压恒温目标温度（勾选 Retain 断电保持）',
          },
          {
            name: 'DB_Recipe.active.pressTime',
            address: 'DB20.active.time',
            type: 'Time',
            area: 'DB',
            init: 12000,
            unit: 'ms',
            comment: '当前生效热压保压时长（T#12s）',
          },
          {
            name: 'DB_Recipe.active.beltSpeed',
            address: 'DB20.active.speed',
            type: 'Real',
            area: 'DB',
            init: 600.0,
            unit: 'rpm',
            comment: '当前生效传送带目标转速设定值',
          },
          {
            name: 'DB_Recipe.active.batchSize',
            address: 'DB20.active.batch',
            type: 'Int',
            area: 'DB',
            init: 12,
            unit: 'pcs',
            comment: '每托盘装满模组数量',
          },
          {
            name: 'DB_Recipe.loadError',
            address: 'DB20.loadError',
            type: 'Bool',
            area: 'DB',
            init: false,
            comment: '配方索引越界或参数非法报警标志',
          },
        ],
      },
      {
        kind: 'dual-code',
        title: '锂电模组配方 UDT 定义与防越界一键切换（LAD 思路 vs 完整博途 SCL）',
        caption: '看看 UDT 的魔力：整整一套配方包含 6 个不同类型的工艺参数，但在加载切换时，只需要极其优雅的一行赋值 "DB_Recipe".active := "DB_Recipe".list[#idx]; 即可整体拷贝完成！',
        lad: `// LAD 方式实现带防越界保护的整套配方一键切换：
// Network 1: 用 IN_RANGE 指令校验配方号在 0..9 合法区间，再通过 MOVE 整体拷贝整个 UDT！

  "DB_Recipe".cmdLoad        +------------+           +-------------+
|---------[P]----------------|  IN_RANGE  |-----------|    MOVE     |
                    0 -------|MIN         |           |EN        ENO|
    "DB_Recipe".selectIdx ---|VAL         |           |             |
                    9 -------|MAX         |           |             |
                             +------------+           |             |
                "DB_Recipe".list["DB_Recipe".selectIdx] --|IN  OUT1|-- "DB_Recipe".active
                                                      +-------------+`,
        scl: `// 1. 定义可复用的 PLC 数据类型（UDT，遵循西门子 styleguide 以 type 开头）
TYPE "typeModuleRecipe"
VERSION : 0.1
   STRUCT
      recipeCode    : String[16];     // 型号编码，如 'LFP-280Ah'
      targetTemp    : Real := 85.0;   // 热压目标温度 (°C)
      pressDuration : Time := T#12s;  // 热压保压时长
      beltSpeedRpm  : Real := 600.0;  // 输送线设定转速 (rpm)
      widthTolMm    : Real := 0.3;    // 视觉检测宽度公差 (mm)
      palletQty     : Int  := 12;     // 每托盘满载件数
   END_STRUCT;
END_TYPE

// 2. 优化访问全局数据块（自动存放 10 套配方库 + 当前激活配方，支持单字段 Retain）
DATA_BLOCK "DB_Recipe"
{ S7_Optimized_Access := 'TRUE' }
   VAR RETAIN
      active : "typeModuleRecipe";                 // 当前生效配方（断电保持！）
      list   : Array[0..9] of "typeModuleRecipe";  // 配方仓库（注意西门子数组默认从 0 起！）
   END_VAR
   VAR
      selectIdx : Int;
      cmdLoad   : Bool;
      loadError : Bool;
   END_VAR
BEGIN
END_DATA_BLOCK

// 3. 配方切换函数 FC_LoadRecipe（严格做数组上下界保护 + 参数合法校验！）
FUNCTION "FC_LoadRecipe" : Bool
VAR_INPUT
    idx : Int;
END_VAR
VAR_IN_OUT
    // 大型 UDT 一律通过 IN_OUT 传引用，零拷贝开销且双向可读可写！
    recipeList   : Array[0..9] of "typeModuleRecipe";
    activeRecipe : "typeModuleRecipe";
END_VAR
BEGIN
    // 严防数组越界导致 CPU 报运行时错误或停机！
    IF (#idx >= 0) AND (#idx <= 9) AND (#recipeList[#idx].targetTemp > 20.0) THEN
        #activeRecipe := #recipeList[#idx];  // 整个 UDT 结构体一键原子拷贝！
        "FC_LoadRecipe" := TRUE;
    ELSE
        "FC_LoadRecipe" := FALSE;            // 返回失败，保持原安全配方不变
    END_IF;
END_FUNCTION`,
      },
      {
        kind: 'workflow',
        id: 'project-lifecycle',
        title: '工程视角：看看 UDT 与数据架构如何串联整条项目的软件与 HMI 开发',
        instruction:
          '点击工作流中的“05 模块化软件架构”节点，观察 UDT 数据模型如何在项目早期就打通 PLC 程序块与 WinCC 触摸屏画面（Faceplate 面板）的并行开发。',
      },
      {
        kind: 'callout',
        tone: 'warn',
        title: '西门子数组越界停机警告 & IN_OUT 传参黄金法则！',
        md: `1. **数组默认 0 起始且越界即报警/停机**：\`ARRAY[0..9]\` 的合法下标只有 \`0\` 到 \`9\`（没有 \`10\`！）。如果触摸屏操作员手抖输入了配方号 \`12\` 而程序没做范围校验，访问 \`list[12]\` 会瞬间触发 CPU 区域长度访问错误！**铁律：凡是带动态下标访问数组，必写 \`IF (#idx >= 0) AND (#idx <= 9) THEN\` 校验（或使用 \`LOWER_BOUND\` / \`UPPER_BOUND\` 动态取边界）！**
2. **大型结构体（UDT）传参请用 \`VAR_IN_OUT\`**：把一个 200 字节的 UDT 放到 \`VAR_INPUT\` 会触发整块值拷贝拖慢扫描周期；放进 \`VAR_IN_OUT\` 则是传递指针引用，既省 CPU 时间又让 FB 管脚清清爽爽只剩 1 根线！`,
      },
      {
        kind: 'practice-task',
        title: '第 11 讲实训打卡：设计毕业项目专属锂电配方与工位 UDT',
        scenario: '我们的毕业大项目是“锂电模组柔性视觉分拣、热压温控与立体入库工作站”。现在请你以架构师身份审视其核心数据结构。',
        steps: [
          '通读上方 typeModuleRecipe 源码，确认每一个物理工艺量（温度 Real、时长 Time、速度 Real、托盘件数 Int）的数据类型是否选得最精准。',
          '检查 FC_LoadRecipe 中的双重防呆判断：当操作工误输入 idx = -1 或 idx = 10，或者选中了一个尚未录入温度（targetTemp = 0）的空配方槽位时，系统如何拒绝覆写当前正在生产的配方。',
          '在上方工程交付工作流中点击查看“03 I/O 点表”与“05 模块化软件架构”，体会“先定 UDT 数据契约，再写 FB 逻辑代码”的工程顺序。',
        ],
        checkPoints: [
          '清晰掌握优化访问 DB 的 4 大优势及需要单独建非优化接口 DB 的场景',
          '养成访问数组前必做上下界校验的安全编码条件反射',
          '懂得使用 VAR_IN_OUT 传递 UDT 结构体以实现高内聚低耦合的 FB 接口',
        ],
      },
      {
        kind: 'quiz',
        title: '随堂闯关测验：UDT、优化访问 DB 与防越界规范',
        items: [
          {
            question: '在 S7-1200/1500 中，当你尝试用绝对地址 DB10.DBW4 去读写一个默认创建的“优化访问 DB”时，TIA Portal 会怎样？',
            options: [
              '正常编译通过，运行速度更快',
              '编译器直接报错拒绝！因为优化访问 DB 没有固定绝对字节偏移，必须使用符号寻址',
              '自动把 DB10 转成 M 区地址',
              '编译通过但运行时数值减半',
            ],
            answer: 1,
            explain:
              '优化访问 DB 由系统自动优化排布变量，不再暴露固定偏移地址，强制采用更安全的符号寻址（如 "DB_Recipe".selectIdx）。如需对接老式绝对寻址外部设备，应单独建一个取消勾选优化访问的通信接口 DB。',
          },
          {
            question: '将包含 30 个工艺参数的大型 UDT 结构体传递给一个功能块 FB 进行读写处理，放在哪个接口区效率最高、最符合西门子规范？',
            options: [
              '拆成 30 个独立的 VAR_INPUT 管脚',
              '放入 VAR_IN_OUT（输入输出区），按引用传址，零拷贝开销且界面极简',
              '放入 VAR_TEMP 区',
              '全部改写成全局变量 %MD',
            ],
            answer: 1,
            explain:
              'UDT/结构体和数组放进 VAR_IN_OUT 以引用（指针）方式传递，既避免每周期拷贝大量字节浪费扫描时间，又让调用方框图极其整洁，方便绑定 HMI Faceplate。',
          },
          {
            question: '已知配方数组声明为 list : ARRAY[0..9] OF "typeModuleRecipe"，如果 HMI 误传入索引号 idx = 10，程序不加校验直接执行 list[idx] 会造成什么后果？',
            options: [
              '自动循环回绕访问 list[0]',
              '自动返回全 0 默认值且无任何提示',
              '触发数组下标越界运行时错误（记录进诊断缓冲区甚至导致 CPU 停机），因此必须前置上下界判断！',
              '把数组长度自动扩展到 11',
            ],
            answer: 2,
            explain:
              '数组越界是 SCL 现场停机的头号杀手之一，编程规范要求所有动态数组访问前必须先做合法范围校验（0 <= idx AND idx <= 9）。',
          },
        ],
      },
    ],
  },
  {
    id: 'l12-scl-state-machine',
    chapterId: 'ch4',
    order: 12,
    title: 'SCL 结构化控制语言精讲与工业级 CASE 状态机（GRAFCET & PackML）',
    subtitle: '中高级西门子工程师核心生产力语言！写出带工步超时看门狗与标准 PackML 模式管理的状态机引擎',
    level: '进阶',
    minutes: 35,
    tags: ['SCL', 'CASE状态机', 'PackML', 'GRAFCET', '工步看门狗'],
    objectives: [
      '精通西门子 SCL 核心语法（:= 赋值 vs = 比较、IF/ELSIF、FOR 循环、CASE 状态机、ENO 错误检查）',
      '学会在真实工程中合理混搭 LAD（直观电气联锁）与 SCL（复杂顺控、数组配方与数学算法）',
      '掌握国际包装与产线通用标准 PackML 状态模型（STOPPED / RESETTING / IDLE / EXECUTE / HELD / ABORTED）与 GRAFCET 顺控思想',
      '熟练编写工业级带“工步变更自动清零 + 工步超时看门狗报警”的 CASE #statStep OF 状态机模板',
    ],
    interviewTip:
      '冲击高薪 PLC 工程师的核武器面试题：“说说你在项目里怎么用 SCL 搭主控状态机？如果设备半路卡死在某一步，你怎么让操作工一眼定位故障？”满分答法：采用两层状态机——外层按 ISA-88 PackML 管理设备运行模式（停机/回零/待机/自动运行/暂停/急停中止），内层在 EXECUTE 运行态用 CASE #statStep OF 按 10 递增编排工序，并配一个全局工步看门狗定时器：通过检测 #statStep <> #statPrevStep 在每次切步瞬间重置计时，一旦某一步停留超过工艺上限（如 10 秒），立刻锁存超时报警并把当前卡死的工步号直接推送到 HMI 报警栏！',
    blocks: [
      {
        kind: 'text',
        title: '1. 为什么年薪 20W+ 的西门子工程师都在主力写 SCL？',
        md: `梯形图（LAD）对电工极度友好，做安全联锁、硬件映射和单设备启停一目了然；但只要遇到以下 4 类现代自动化核心任务，纯写梯形图会让你痛不欲生：
1. **15 步以上带分支循环的复杂状态机**（LAD 画几十页还易跳步，SCL 一个 \`CASE\` 清晰如目录）；
2. **立体库 4×3 空仓位遍历检索、数据排序、平均值滤波**（SCL 一个 \`FOR\` 循环 5 行搞定！）；
3. **扫码枪 ASCII 条码解析、视觉相机 TCP/PROFINET 报文拆包**；
4. **复杂工艺配方与数学公式运算**。

西门子博途里的 **SCL（Structured Control Language）** 完全符合 IEC 61131-3 ST 国际标准，并且**同一个 FB/FC 里既可以直接用 SCL 编写，也能在 LAD 块中随时右键“插入 SCL 程序段”**！

### 5 分钟速记 SCL 铁律语法（来自西门子官方 ST 规范）
- **赋值用 \`:=\`，相等比较用 \`=\`，不等用 \`<>\`**（把 \`IF a = 1\` 错写成 \`IF a := 1\` 会编译报错）；
- **每条语句必须以英文分号 \`;\` 结尾**；
- **局部接口变量带 \`#\` 前缀**（如 \`#statStep\`），**全局变量带双引号**（如 \`"DB_Station".mode\`）；
- **检查 \`ENO\` 防静默数学错**：调用 \`SQRT\` 或可能失败的数学指令后，养成用 \`IF ENO THEN...\` 检查运算有效的习惯！`,
      },
      {
        kind: 'text',
        title: '2. 站在工业巨头肩膀上：PackML 模式层 + GRAFCET 工步层',
        md: `大厂（宁德时代、比亚迪、西门子、博世）交付非标产线时，极度反感野路子“满天飞的标志位”，普遍要求采用 **ISA-88 PackML 状态机** 与 **GRAFCET 顺序功能图** 思想：

- **外层 · 设备级模式状态（PackML 精简实战版）**：
  - \`ABORTED（急停中止）\`：安全回路断开，强制断所有危险执行器，必须排除急停并人工复位；
  - \`RESETTING（回零初始化）\`：所有气缸缩回原位、伺服轴执行回零、清空过程标志；
  - \`IDLE（就绪待机）\`：一切安全且在原点，绿灯闪烁等待按下启动；
  - \`EXECUTE（自动执行）\`：唯有进入此状态，内层的 **\`CASE #statStep OF\`** 工艺步序引擎才全速运转！
  - \`HELD（正常暂停）\`：例如料仓缺料或操作工按暂停，**记住当前 \`#statStep\` 不清零**，补料后点击恢复可从断点无缝续跑（区别于急停清空！）。`,
      },
      {
        kind: 'workflow',
        id: 'grafcet-packml',
        title: '交互状态机引擎：GRAFCET / PackML 步进流转与同步 SCL 高亮追踪',
        instruction:
          '在下方交互式工作流中依次触发复位回零、启动自动、模拟传感器到位信号，同时尝试触发“暂停（Hold）”与“急停（Abort）”，观察左侧状态图与右侧同步高亮的 SCL CASE 代码如何严密联动！',
      },
      {
        kind: 'io-table',
        title: '工业级状态机与工步超时看门狗核心接口变量表',
        tags: [
          {
            name: 'EStop_OK',
            address: '%I0.0',
            type: 'Bool',
            area: 'I',
            init: true,
            comment: '安全回路正常（FALSE 立刻切入 ABORTED 急停中止态）',
          },
          {
            name: 'Cmd_Start',
            address: '%I0.1',
            type: 'Bool',
            area: 'I',
            init: false,
            comment: '自动启动命令（IDLE -> EXECUTE，或 HELD -> EXECUTE 断点续跑）',
          },
          {
            name: 'Cmd_Hold',
            address: '%I0.2',
            type: 'Bool',
            area: 'I',
            init: false,
            comment: '暂停命令（保持当前工步号不丢失，安全暂停执行器）',
          },
          {
            name: 'Cmd_Reset',
            address: '%I0.3',
            type: 'Bool',
            area: 'I',
            init: false,
            comment: '故障清除与回零初始化命令',
          },
          {
            name: 'Stat_StepNo',
            address: 'DB_Main.StepNo',
            type: 'Int',
            area: 'DB',
            init: 0,
            comment: '当前执行工艺工步号（0 / 10 / 20 / 30 / 40 / 900故障态）',
          },
          {
            name: 'Step_Watchdog_ET',
            address: 'DB_Main.WatchdogET',
            type: 'Time',
            area: 'DB',
            init: 0,
            unit: 'ms',
            comment: '当前工步已停留时长（切步自动清零，超过 10s 报卡步故障！）',
          },
          {
            name: 'Alarm_StepTimeout',
            address: 'DB_Main.AlarmTimeout',
            type: 'Bool',
            area: 'DB',
            init: false,
            comment: '工步超时看门狗报警标志（同时把卡死步号送 HMI 弹窗）',
          },
          {
            name: 'Fault_StepId',
            address: 'DB_Main.FaultStepId',
            type: 'Int',
            area: 'DB',
            init: 0,
            comment: '锁定记录“究竟卡死在哪一步”的诊断步号',
          },
        ],
      },
      {
        kind: 'dual-code',
        title: '工业级 SCL CASE 状态机 + 工步超时看门狗标准模板（LAD 对比 vs 生产级 SCL）',
        caption: '这套带“切步检测 + 看门狗定时器 + 故障步号锁存”的 SCL 模板，是几乎所有高薪非标自动化项目主程序的核心骨架，建议直接收藏并在毕业项目中实战应用！',
        lad: `// LAD 思路示意：工步切换检测 + 全局看门狗超时报警
// （在复杂 10+ 步工艺中，用右侧 SCL CASE 模板可读性高出 5 倍！）

// Network 1: 只要步号未变且处于自动运行中，就持续给看门狗定时器计时
  #statInAuto    #statStep == #statPrevStep        +-------------+
|-----[ ]-----------------[==]---------------------|     TON     |
                                         T#10s ----|PT          Q|--- #tempWatchdogTrig
                                                   |           ET|--- "Step_Watchdog_ET"
                                                   +-------------+

// Network 2: 超时瞬间锁存报警并记录当前卡死步号，立即切入 900 故障态
  #tempWatchdogTrig                                +-------------+
|--------[ ]---------------------------------------|    MOVE     |
                                    #statStep -----|IN       OUT1|--- "Fault_StepId"
                                                   +-------------+`,
        scl: `// =========================================================================
// 工业级 SCL 状态机标准范式：工步超时看门狗 + CASE 状态转移 + 单一输出映射
// =========================================================================

// 1. 探测“本周期是否刚刚切入新工步”（切步瞬间看门狗 IN 断开 1 周期自动清零！）
#tempStepChanged := (#statStep <> #statPrevStep);
#statPrevStep    := #statStep;

// 2. 全局工步超时看门狗（必须无条件放在 CASE 外部调用！）
#instTonWatchdog(
    IN := (#statStep > 0) AND (#statStep < 900) AND (NOT #tempStepChanged) AND (NOT #cmdHold),
    PT := T#10s,
    ET => "DB_Main".WatchdogET
);

// 3. 急停与超时故障最高优先级拦截
IF NOT "EStop_OK" THEN
    #statStep := 0;                          // 急停直接归零，安全泄压停机
ELSIF #instTonWatchdog.Q THEN
    "DB_Main".AlarmTimeout := TRUE;
    "DB_Main".FaultStepId  := #statStep;     // 精准记下卡死步号，HMI 秒定位！
    #statStep := 900;                        // 切入统一故障处理态
END_IF;

// 4. 自动工艺主状态机（暂停 cmdHold 时冻结当前步号，恢复后断点续跑！）
IF "EStop_OK" AND (NOT #cmdHold) THEN
    CASE #statStep OF
        0:  // IDLE 就绪待机
            IF "Cmd_Start" AND #allCylAtHome THEN
                #statStep := 10;
            END_IF;

        10: // 进料传送带送料至定位光电
            IF #sensorPartArrived THEN
                #statStep := 20;
            END_IF;

        20: // 夹紧气缸伸出固定锂电模组
            IF #instCylClamp.atWork THEN
                #statStep := 30;
            END_IF;

        30: // 视觉扫码与分级判定完成
            IF #visionDone THEN
                #statStep := 40;
            END_IF;

        40: // 夹紧松开退回原位，放行至下一工位
            IF #instCylClamp.atHome THEN
                #statStep := 0;              // 一个节拍闭环完成！
            END_IF;

        900: // FAULT 故障保持态：等待人工排障后按复位清零
            IF "Cmd_Reset" THEN
                "DB_Main".AlarmTimeout := FALSE;
                "DB_Main".FaultStepId  := 0;
                #statStep := 0;
            END_IF;

    ELSE
        // 防御性编程：非法步号兜底
        #statStep := 900;
    END_CASE;
END_IF;

// 5. 物理/子块命令输出映射层（每个执行器全局唯一写入点）
#cmdConveyor := (#statStep = 10) AND (NOT #cmdHold) AND "EStop_OK";
#cmdClamp    := ((#statStep = 20) OR (#statStep = 30)) AND "EStop_OK";
"DB_Main".StepNo := #statStep;`,
      },
      {
        kind: 'callout',
        tone: 'danger',
        title: 'SCL 两大停机杀手：CASE 内部调定时器 & 无保护 WHILE 死循环！',
        md: `1. **严禁把 \`#instTon()\` 写在 \`CASE\` 某个分支内部**！当状态机离开该分支后，定时器失去扫描执行机会，\`Q\` 会永久残留 \`TRUE\` 导致下次进入该步瞬间误触发！所有定时器必须统一放在 \`CASE\` 外面，用 \`IN := (#statStep = 30)\` 驱动！
2. **慎用 \`WHILE\` 循环（优先用定长 \`FOR\`）**：PLC 扫描周期看门狗默认只有 150ms，如果 \`WHILE\` 退出条件因为传感器没来而一直不满足，PLC 立刻在 150ms 后看门狗超时报红灯 **STOP 停机**！用 \`WHILE\` 时务必加安全计数上限（如 \`AND (#safetyCnt < 100)\`），遍历数组一律优先使用有明确上下界的 \`FOR #i := 0 TO 11 DO\`！`,
      },
      {
        kind: 'practice-task',
        title: '第 12 讲实训打卡：PackML/GRAFCET 状态机与看门狗故障推演',
        scenario: '在上方交互式 GRAFCET/PackML 状态机工作流中，模拟正常生产、中途暂停续跑与传感器卡阻超时 3 种真实车间场景。',
        steps: [
          '点击 Reset 完成回零进入 IDLE，再点击 Start 进入 EXECUTE，逐步触发各工位传感器，对照右侧同步高亮的 SCL CASE 代码验证每一步转移。',
          '运行至中间工步时点击 Hold（暂停），确认机器安全暂停且当前工步号完整保留；点击恢复后观察其从断点继续执行，与 Abort（急停清空回零）形成鲜明对比。',
          '故意不触发某一步的到位传感器，等待工步超时看门狗到达上限，观察系统如何切入故障态并精准上报卡死工步编号！',
        ],
        checkPoints: [
          '能不翻书写出 #tempStepChanged 切步清零看门狗的核心两行 SCL 代码',
          '深刻理解普通暂停（Hold 保步断点续跑）与急停（Abort 清零安全断动力）的本质区别',
          '牢记绝不在 CASE 分支内部调用 IEC 定时器，绝不在 OB1 写无界 WHILE 死循环',
        ],
      },
      {
        kind: 'quiz',
        title: '随堂闯关测验：SCL 语法与工业级状态机',
        items: [
          {
            question: '在西门子 SCL 语言中，关于赋值运算与相等判断的符号规范，哪一项完全正确？',
            options: [
              '赋值用 = ，比较相等用 ==',
              '赋值用 := ，比较相等用 = ，且每条语句必须以分号 ; 结尾',
              '赋值和比较都用 = ，靠上下文区分',
              '赋值用 -> ，每行不需要分号',
            ],
            answer: 1,
            explain:
              'IEC 61131-3 ST / 西门子 SCL 严格规定 := 为赋值操作符、= 为相等比较操作符、<> 为不等于，且每条语句末尾必须加英文分号 ;。',
          },
          {
            question: '如果一位工程师把某步的等待定时器 #instTonWait(IN := TRUE, PT := T#2s) 直接写在了 CASE #statStep OF 的 “20:” 分支里面，当状态机第二轮再次进入 Step 20 时会发生什么诡异现象？',
            options: [
              '一切正常，每次都会重新倒计时 2 秒',
              '因为离开 Step 20 后定时器再也没被调用复位，#instTonWait.Q 仍保持上一轮遗留的 TRUE，导致第二轮刚进 Step 20 就 0 秒瞬间跳步！',
              '定时器时间自动翻倍成 4 秒',
              'PLC 编译时会自动帮你挪到 CASE 外面',
            ],
            answer: 1,
            explain:
              '离开分支后定时器不再执行，内部状态永远凝固在 Q=TRUE；必须把所有 IEC 定时器无条件放在 CASE 外面，写成 #instTonWait(IN := (#statStep = 20), PT := T#2s);！',
          },
          {
            question: '在 PackML 规范与非标自动化主控状态机设计中，按下“正常暂停（Hold）”与拍下“急停（E-Stop / Abort）”在软件步号处理上的关键区别是？',
            options: [
              '两者完全一样，都是直接把步号清零',
              '暂停（Hold）保留当前工艺步号以便排障/补料后断点续跑；急停（Abort）则立即切断危险执行器、中止当前流程，解除急停后必须执行受控复位/回零才能重新生产',
              '急停可以保留步号，拍完拔起来机器立刻原地继续狂奔',
              '暂停必须给整台控制柜断电',
            ],
            answer: 1,
            explain:
              '急停拔起后机器“原地突然继续动作”是极其危险的重大安全隐患！必须区分暂停（受控保步续跑）与急停（中止流程 + 人工确认复位回零）。',
          },
        ],
      },
    ],
  },
];
