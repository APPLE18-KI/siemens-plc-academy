import type { ExampleCase } from '../../types/content';

export const motorControlExamples: ExampleCase[] = [
  // =========================================================================
  // 1. 三相异步电机启保停与点动检修双模式控制
  // =========================================================================
  {
    id: 'ex-motor-jog-seal',
    title: '三相异步电机启保停与点动检修双模式控制',
    subtitle: '工业自动化第一课：故障安全常闭接线、自锁保持、检修点动与单点输出归属架构',
    difficulty: '基础',
    industry: '通用机械 / 输送机 / 风机泵类',
    hardware: 'S7-1200 CPU 1214C DC/DC/DC (6ES7 214-1AG40-0XB0) + DC24V 中间继电器 KA1 + SIRIUS 3RT2 接触器 KM1 + 3RU21 热继电器',
    summary:
      '涵盖工业现场最核心的电机控制规范：停止按钮 SB2、急停蘑菇头与热过载继电器 FR1 均采用常闭（NC）故障安全接线，区分“连续生产自锁模式”与“检修点动模式”，并采用西门子标准 FB 封装实现故障优先判断、报警锁存与统一输出赋值。',
    highlights: [
      '遵循 Fail-Safe 故障安全原则：急停/停止/热保护断线即自动停机',
      '连续自锁与点动检修严格模式隔离，杜绝点动松手后误自锁飞车',
      '严格实践西门子 SCL 规范：先判安全故障 → 再算控制逻辑 → 扫描末单点输出',
      '支持直接与 S7-1200 接线数字孪生台联动验证 NPN/PNP 与 KA/KM 回路',
    ],
    linkedModelId: 's7-1200-wiring',
    linkedSimPreset: 'seal-in-motor',
    ioTags: [
      { name: 'Start_PB', address: '%I0.0', type: 'Bool', area: 'I', init: false, comment: '绿色启动按钮 SB1（常开 NO，按下=1）' },
      { name: 'Stop_PB_NC', address: '%I0.1', type: 'Bool', area: 'I', init: true, comment: '红色停止按钮 SB2（常闭 NC 故障安全，常态=1）' },
      { name: 'EStop_OK_NC', address: '%I0.2', type: 'Bool', area: 'I', init: true, comment: '急停蘑菇头安全回路（常闭 NC，常态=1）' },
      { name: 'Jog_Mode_Sel', address: '%I0.3', type: 'Bool', area: 'I', init: false, comment: '旋钮选择开关：0=连续自锁模式，1=点动检修模式' },
      { name: 'FR1_Overload_NC', address: '%I0.4', type: 'Bool', area: 'I', init: true, comment: '热过载继电器辅助常闭触点（95-96，正常=1）' },
      { name: 'Fault_Reset_PB', address: '%I0.5', type: 'Bool', area: 'I', init: false, comment: '黄色故障复位按钮（常开 NO）' },
      { name: 'KM1_Run_Cmd', address: '%Q0.0', type: 'Bool', area: 'Q', init: false, comment: '驱动 KA1 → KM1 接触器主电机运行输出' },
      { name: 'HL_Run_Green', address: '%Q0.1', type: 'Bool', area: 'Q', init: false, comment: '电控柜门绿色运行指示灯' },
      { name: 'HL_Fault_Red', address: '%Q0.2', type: 'Bool', area: 'Q', init: false, comment: '电控柜门红色故障报警灯' },
      { name: 'Motor_Fault_Latch', address: '%M0.0', type: 'Bool', area: 'M', init: false, comment: '电机故障锁存内部标志位' },
    ],
    controlRequirements: [
      '安全优先级最高：当急停按钮拍下（%I0.2 = 0）或热继电器过载跳闸（%I0.4 = 0）时，立即锁存故障并切断 %Q0.0，点亮红灯 %Q0.2。',
      '复位前提约束：故障排除后（%I0.2 = 1 且 %I0.4 = 1），必须人工按下复位按钮 %I0.5 才能清除故障锁存，禁止故障恢复瞬间电机自动重启伤人！',
      '连续自锁模式（%I0.3 = 0）：无故障且停止按钮 %I0.1 闭合时，点按启动 %I0.0 电机吸合并自锁保持，按下停止 %I0.1 立即停机。',
      '点动检修模式（%I0.3 = 1）：取消自锁保持，仅在持续按住 %I0.0 期间电机运转，松手瞬间立即断电停止，方便机械工程师微调皮带或联轴器。',
      '模式切换防冲击：运行期间若从连续模式切至点动模式，且此时未按住启动按钮，电机立即停止，防止失控保持。',
    ],
    ladDiagramText: `// =========================================================================
// TIA Portal LAD 梯形图（西门子 S7-1200 标准故障安全写法）
// 注意：物理停止按钮 Stop_PB_NC 与急停 EStop_OK_NC 均为外接常闭触点，
//       常态输入为 1，因此梯形图中必须使用【常开触点 ---| |---】！
// =========================================================================

Network 1: 急停与热过载故障锁存及允许复位回路
   "EStop_OK_NC"                                         "Motor_Fault_Latch"
  ----|/|----+--------------------------------------------------( S )
             |
  "FR1_Overload_NC"
  ----|/|----+

   "Fault_Reset_PB"   "EStop_OK_NC"   "FR1_Overload_NC"  "Motor_Fault_Latch"
  ----| |----------------| |---------------| |------------------( R )

Network 2: 启保停自锁与点动检修双模式电机驱动（停止优先）
   "Start_PB"                           "Stop_PB_NC"  "EStop_OK_NC" "Motor_Fault_Latch"   "KM1_Run_Cmd"
  ----| |----+--------------------------| |-----------| |-----------|/|----------------------( )
             |
   "KM1_Run_Cmd"   "Jog_Mode_Sel"
  ----| |---------------|/|----+

Network 3: 柜门状态指示灯输出映射
   "KM1_Run_Cmd"                                         "HL_Run_Green"
  ----| |-------------------------------------------------------( )

   "Motor_Fault_Latch"                                   "HL_Fault_Red"
  ----| |-------------------------------------------------------( )`,
    sclCode: `FUNCTION_BLOCK "FB_MotorJogSealControl"
{ S7_Optimized_Access := 'TRUE' }
VERSION : 0.1
   VAR_INPUT
      iStartPb       : Bool; // 启动按钮 SB1 (NO)
      iStopPbNc      : Bool; // 停止按钮 SB2 (NC 故障安全: 常态TRUE)
      iEStopOkNc     : Bool; // 急停回路正常 (NC: 常态TRUE)
      iOverloadOkNc  : Bool; // 热继电器正常 (NC: 常态TRUE)
      iJogMode       : Bool; // 0=连续自锁模式, 1=点动检修模式
      iResetFault    : Bool; // 故障复位按钮 (NO)
   END_VAR

   VAR_OUTPUT
      qMotorRun      : Bool; // 主接触器 KM1 运行指令 (%Q0.0)
      qLampRun       : Bool; // 运行绿灯 (%Q0.1)
      qLampFault     : Bool; // 故障红灯 (%Q0.2)
      qFaultCode     : Word; // 故障代码: 0=正常, 16#0001=急停, 16#0002=热过载
   END_VAR

   VAR
      statRunLatch   : Bool; // 内部运行保持状态
      statFaultLatch : Bool; // 内部故障锁存状态
   END_VAR

BEGIN
   // =========================================================================
   // 1. 故障与安全联锁优先评估（Fault-First Principle）
   // =========================================================================
   IF NOT #iEStopOkNc THEN
      #statFaultLatch := TRUE;
      #statRunLatch   := FALSE;
      #qFaultCode     := 16#0001; // 急停触发
   ELSIF NOT #iOverloadOkNc THEN
      #statFaultLatch := TRUE;
      #statRunLatch   := FALSE;
      #qFaultCode     := 16#0002; // 电机热过载保护动作
   ELSIF #iResetFault AND #iEStopOkNc AND #iOverloadOkNc THEN
      // 仅当现场安全条件完全恢复后，才允许复位故障锁存（防自动重启）
      #statFaultLatch := FALSE;
      #qFaultCode     := 16#0000;
   END_IF;

   // =========================================================================
   // 2. 连续自锁 vs 点动检修双模式控制逻辑（停止优先）
   // =========================================================================
   IF #statFaultLatch OR NOT #iStopPbNc THEN
      #statRunLatch := FALSE;
   ELSIF #iJogMode THEN
      // 点动检修模式：不自锁，按住即转、松手即停
      #statRunLatch := #iStartPb;
   ELSE
      // 连续自锁模式：启动置位，停止/故障已在上方优先复位
      IF #iStartPb THEN
         #statRunLatch := TRUE;
      END_IF;
   END_IF;

   // =========================================================================
   // 3. 扫描周期末尾单点输出赋值（Single Point of Output Ownership）
   // =========================================================================
   #qMotorRun  := #statRunLatch AND NOT #statFaultLatch AND #iEStopOkNc;
   #qLampRun   := #qMotorRun;
   #qLampFault := #statFaultLatch;
END_FUNCTION_BLOCK`,
    pitfalls: [
      '新手最经典致命误区：外接常闭（NC）停止按钮接入 %I0.1 后，在梯形图中误画成常闭触点 ---|/|---！结果常态输入为 1 时反而不导通，必须记住“外接常闭，程序画常开”。',
      '忘记使用 DC24V 中间继电器 KA 隔离：CPU 1214C DC/DC/DC 输出为 24V 晶体管源型（最大 0.5A），若直接接 AC220V 接触器线圈会瞬间烧毁 PLC 输出点！',
      '热过载继电器自动复位坑：仅在程序里判断 `IF iOverloadOkNc` 而不做故障锁存，会导致热继电器冷却自动复位后电机无人值守突然启动，酿成机械伤害事故！',
      'NPN 传感器混接入欧标 1M→M 输入组：同组 1M 公共端决定了整个 DIa 字节的极性，混接会导致光电信号电位差为 0V 恒不触发。',
    ],
    interviewPoints: [
      '为什么工业现场停止按钮、急停按钮和热保护触点全部要求接成“常闭（NC）”而不是常开？——遵循 Fail-Safe 故障安全原则，一旦控制线松脱、断线或鼠咬，PLC 输入立刻由 1 变 0 触发安全停机，避免断线后“停不了车”的重大事故。',
      '什么是“停止优先”与“启动优先”电路？在梯形图里如何一眼分辨？——停止条件串联在自锁支路之外（总回路上）为停止优先，同时按下启动和停止时输出断开，这是工业安全强制要求。',
      '为什么标准 SCL 工程块要把安全故障判断写在最前面、输出赋值写在最末尾？——保证单点输出归属权（Output Ownership），避免同一个扫描周期内前段赋值被后段覆盖或产生中间毛刺。',
      'S7-1200 CPU 1214C 型号里的三个 “DC/DC/DC” 分别代表什么？——依次代表：供电电源 DC24V、数字量输入 DC24V（支持漏/源型）、数字量输出 DC24V 晶体管（仅支持源型输出）。',
    ],
  },

  // =========================================================================
  // 2. 车间行车正反转双重互锁与自动往返限位控制
  // =========================================================================
  {
    id: 'ex-reversing-limit',
    title: '车间行车正反转双重互锁与自动往返限位控制',
    subtitle: '软硬件双重互锁防相间短路 + 换向死区延时 + 左右终点/超程双级限位保护',
    difficulty: '基础',
    industry: '车间物流 / 起重行车 / 往复滑台',
    hardware: 'S7-1200 CPU 1214C + 双可逆接触器 KM_FWD / KM_REV（带机械联锁块）+ 4 只工业行程开关 SQ1~SQ4',
    summary:
      '针对车间行车、送料小车等三相电机正反转场合，不仅实现了软件互锁与硬件接触器常闭辅助触点双重电气互锁，更加入了 300ms 换向灭弧死区定时器和左/右工艺限位（SQ1/SQ2）+ 极限超程急停限位（SQ3/SQ4）两级防护，支持手动点动与自动装卸料往返循环。',
    highlights: [
      '“软件互锁 + 换向死区 TON + 接触器辅助常闭硬件互锁”三层防相间短路设计',
      '区分正常减速停靠限位（SQ1/SQ2）与机械极限超程限位（SQ3/SQ4）两级保护',
      '接触器反馈粘连检测（Feedback Monitoring）：发指令 0.5s 无反馈或断电粘连立即报警',
      '绑定在线正反转互锁仿真预设，可现场测试同时按正反转与换向延时',
    ],
    linkedSimPreset: 'reversing-interlock',
    ioTags: [
      { name: 'Fwd_PB', address: '%I0.0', type: 'Bool', area: 'I', init: false, comment: '手动正转（右行）按钮' },
      { name: 'Rev_PB', address: '%I0.1', type: 'Bool', area: 'I', init: false, comment: '手动反转（左行）按钮' },
      { name: 'Stop_PB_NC', address: '%I0.2', type: 'Bool', area: 'I', init: true, comment: '总停止按钮（NC 常闭）' },
      { name: 'Auto_Cycle_Sw', address: '%I0.3', type: 'Bool', area: 'I', init: false, comment: '自动往返循环模式开关（1=自动）' },
      { name: 'SQ1_Left_Lim', address: '%I0.4', type: 'Bool', area: 'I', init: true, comment: '左端装料到位行程开关 SQ1' },
      { name: 'SQ2_Right_Lim', address: '%I0.5', type: 'Bool', area: 'I', init: false, comment: '右端卸料到位行程开关 SQ2' },
      { name: 'SQ_OverTravel_NC', address: '%I0.6', type: 'Bool', area: 'I', init: true, comment: '两端极限超程串联保护开关（NC，触发=0）' },
      { name: 'KM_Fwd_Cmd', address: '%Q0.0', type: 'Bool', area: 'Q', init: false, comment: '正转（右行）接触器 KM1 线圈输出' },
      { name: 'KM_Rev_Cmd', address: '%Q0.1', type: 'Bool', area: 'Q', init: false, comment: '反转（左行）接触器 KM2 线圈输出' },
      { name: 'Alarm_Horn', address: '%Q0.2', type: 'Bool', area: 'Q', init: false, comment: '超程/互锁异常声光报警输出' },
    ],
    controlRequirements: [
      '严防相间短路：三相电机调换任意两相即可反转，若 KM_FWD 与 KM_REV 同时吸合将直接造成 380V 相间短路炸柜！必须在 PLC 程序互锁、增加 300ms 换向灭弧延时，并在电控柜硬接线中串入对方接触器的常闭辅助触点与机械联锁块。',
      '手动模式（%I0.3 = 0）：按正转右行直到撞击右限位 SQ2 自动停止；按反转左行直到撞击左限位 SQ1 自动停止；运行中按反向按钮需先断电经 300ms 灭弧延时后再反向吸合。',
      '自动往返模式（%I0.3 = 1）：启动后小车向右行至右限位 SQ2 → 停止并装/卸料定时 5s → 自动反转左行至左限位 SQ1 → 停留 5s 后再次循环，按下停止按钮 %I0.2 立即停机。',
      '极限超程保护：若 SQ1/SQ2 失效导致小车冲过工艺限位撞击两端超程开关（%I0.6 = 0），PLC 立即切断正反转输出并拉响报警 %Q0.2。',
    ],
    ladDiagramText: `// =========================================================================
// TIA Portal LAD 梯形图：正反转软件互锁 + 工艺限位 + 超程保护
// =========================================================================

Network 1: 正转（右行）控制与软件互锁（串入反向输出常闭与右限位）
   "Fwd_PB"         "Stop_PB_NC"  "SQ_OverTravel_NC"  "SQ2_Right_Lim"  "KM_Rev_Cmd"   "KM_Fwd_Cmd"
  ----| |----+---------| |---------------| |-----------------|/|------------|/|-----------( )
             |
   "KM_Fwd_Cmd"
  ----| |----+

Network 2: 反转（左行）控制与软件互锁（串入正向输出常闭与左限位）
   "Rev_PB"         "Stop_PB_NC"  "SQ_OverTravel_NC"  "SQ1_Left_Lim"   "KM_Fwd_Cmd"   "KM_Rev_Cmd"
  ----| |----+---------| |---------------| |-----------------|/|------------|/|-----------( )
             |
   "KM_Rev_Cmd"
  ----| |----+

Network 3: 右端到位卸料 5s 延时（用于自动往返触发反转）
   "Auto_Cycle_Sw"   "SQ2_Right_Lim"               +---------------+
  ----| |----------------| |-----------------------|  TON_RightDly |
                                              PT --| T#5s          |--(Q)-> 自动触发左行
                                                   +---------------+`,
    sclCode: `FUNCTION_BLOCK "FB_CraneReversingAuto"
{ S7_Optimized_Access := 'TRUE' }
VERSION : 0.1
   VAR_INPUT
      iFwdPb          : Bool; // 手动正转(右行)
      iRevPb          : Bool; // 手动反转(左行)
      iStopPbNc       : Bool; // 总停止按钮 (NC: 正常TRUE)
      iAutoCycle      : Bool; // 1=自动往返模式, 0=手动模式
      iSqLeftLim      : Bool; // 左端工艺限位 SQ1
      iSqRightLim     : Bool; // 右端工艺限位 SQ2
      iOverTravelOkNc : Bool; // 极限超程开关串联 (NC: 正常TRUE)
      iResetFault     : Bool; // 故障复位
   END_VAR

   VAR_OUTPUT
      qKmFwd          : Bool; // 正转接触器 KM1 (%Q0.0)
      qKmRev          : Bool; // 反转接触器 KM2 (%Q0.1)
      qAlarm          : Bool; // 故障声光报警 (%Q0.2)
      qState          : Int;  // 状态码: 0停止 10右行 20右停顿 30左行 40左停顿 99故障
   END_VAR

   VAR
      statState       : Int := 0;
      statFault       : Bool := FALSE;
      tonDwell        : TON_TIME; // 左右端装卸料停留定时
      tonDeadTime     : TON_TIME; // 300ms 换向灭弧死区定时
      statLastDir     : Int := 0; // 1=FWD, -1=REV, 0=NONE
   END_VAR

   VAR_CONSTANT
      ST_IDLE         : Int := 0;
      ST_MOVE_FWD     : Int := 10;
      ST_DWELL_RIGHT  : Int := 20;
      ST_MOVE_REV     : Int := 30;
      ST_DWELL_LEFT   : Int := 40;
      ST_DEADTIME     : Int := 50;
      ST_FAULT        : Int := 99;
   END_VAR

BEGIN
   // 1. 极限超程安全保护优先评估
   IF NOT #iOverTravelOkNc THEN
      #statFault := TRUE;
      #statState := #ST_FAULT;
   ELSIF #statFault AND #iResetFault AND #iOverTravelOkNc THEN
      #statFault := FALSE;
      #statState := #ST_IDLE;
   END_IF;

   // 总停止优先
   IF NOT #iStopPbNc AND NOT #statFault THEN
      #statState := #ST_IDLE;
   END_IF;

   // 2. 状态机主转换逻辑
   IF NOT #statFault THEN
      IF NOT #iAutoCycle THEN
         // 手动模式：带互锁保护
         IF #iFwdPb AND NOT #iRevPb AND NOT #iSqRightLim THEN
            #statState := #ST_MOVE_FWD;
         ELSIF #iRevPb AND NOT #iFwdPb AND NOT #iSqLeftLim THEN
            #statState := #ST_MOVE_REV;
         ELSIF (#statState = #ST_MOVE_FWD AND #iSqRightLim) OR
               (#statState = #ST_MOVE_REV AND #iSqLeftLim) THEN
            #statState := #ST_IDLE;
         END_IF;
      ELSE
         // 自动往返循环状态机
         CASE #statState OF
            #ST_IDLE:
               IF #iFwdPb AND NOT #iSqRightLim THEN
                  #statState := #ST_MOVE_FWD;
               ELSIF #iRevPb AND NOT #iSqLeftLim THEN
                  #statState := #ST_MOVE_REV;
               END_IF;

            #ST_MOVE_FWD:
               #statLastDir := 1;
               IF #iSqRightLim THEN
                  #statState := #ST_DWELL_RIGHT;
               END_IF;

            #ST_DWELL_RIGHT:
               IF #tonDwell.Q THEN
                  #statState := #ST_DEADTIME;
               END_IF;

            #ST_MOVE_REV:
               #statLastDir := -1;
               IF #iSqLeftLim THEN
                  #statState := #ST_DWELL_LEFT;
               END_IF;

            #ST_DWELL_LEFT:
               IF #tonDwell.Q THEN
                  #statState := #ST_DEADTIME;
               END_IF;

            #ST_DEADTIME:
               // 换向灭弧死区结束后切往反方向
               IF #tonDeadTime.Q THEN
                  IF #statLastDir = 1 THEN
                     #statState := #ST_MOVE_REV;
                  ELSE
                     #statState := #ST_MOVE_FWD;
                  END_IF;
               END_IF;

            ELSE
               #statState := #ST_IDLE;
         END_CASE;
      END_IF;
   END_IF;

   // 3. IEC 定时器统一驱动（放在 CASE 外避免条件调用导致定时冻结！）
   #tonDwell(
      IN := (#statState = #ST_DWELL_RIGHT) OR (#statState = #ST_DWELL_LEFT),
      PT := T#5s
   );
   #tonDeadTime(
      IN := (#statState = #ST_DEADTIME),
      PT := T#300ms
   );

   // 4. 单点互锁输出赋值（绝对互斥）
   #qKmFwd := (#statState = #ST_MOVE_FWD) AND NOT #statFault AND #iOverTravelOkNc AND NOT #iSqRightLim;
   #qKmRev := (#statState = #ST_MOVE_REV) AND NOT #statFault AND #iOverTravelOkNc AND NOT #iSqLeftLim AND NOT #qKmFwd;
   #qAlarm := #statFault;
   #qState := #statState;
END_FUNCTION_BLOCK`,
    pitfalls: [
      '只做软件互锁不做硬件互锁：PLC 输出继电器触点一旦拉弧粘连，或调试人员在博途监控表里强置了 %Q0.0 和 %Q0.1，仅有软件互锁完全拦不住 380V 接触器同时吸合炸毁空气开关！',
      '忽略接触器机械释放时间（无死区直接换向）：大功率交流接触器断电到灭弧彻底分断需要 20~60ms，若 PLC 在下一个扫描周期（2ms）立刻闭合反向接触器，电弧尚未熄灭仍会发生飞弧短路！',
      '把 IEC 定时器 `TON` 写在 `CASE` 分支或 `IF` 内部：一旦离开该状态分支，定时器不再被调用执行，`IN` 无法收到下降沿复位，导致下次再进入该状态时 `Q` 立刻为 1 瞬间跳过等待！',
      '超程限位误用常开触点：超程保护属于安全底线，必须采用常闭（NC）直接串入安全回路并反馈 PLC。',
    ],
    interviewPoints: [
      '正反转控制为什么一定要做“软硬件双重互锁”？各自防什么风险？——软件互锁防操作员误按和程序逻辑冲突；硬件互锁（接触器常闭辅助触点交叉串联 + 机械联锁块）防 PLC 输出点粘连、强置变量或程序跑飞导致的 380V 主回路相间短路。',
      '为什么在 SCL 编程中严禁把 `TON` 定时器写在 `IF` 或 `CASE` 分支里面调用？——IEC 定时器是边沿和状态敏感型功能块，条件调用会让它在离开分支后丧失复位机会，正确写法是在 `CASE` 外无条件调用，通过 `IN := (#statState = #ST_WAIT)` 驱动。',
      '如果正转接触器已经吸合，突然想直接按反转按钮换向，你的程序怎么设计更安全？——先切断正转输出，进入 200~500ms 换向灭弧死区（重载行车还需等待零速检测或能耗制动完成），再吸合反转接触器。',
      '行程开关 SQ1/SQ2 撞击后小车由于惯性滑行脱开限位怎么办？——必须用状态机锁存到位状态，不能仅凭行程开关实时通断维持逻辑，且重要场合需加装极限超程开关。',
    ],
  },

  // =========================================================================
  // 3. 22kW 风机星三角（Y-Δ）降压启动与接触器切换死区保护
  // =========================================================================
  {
    id: 'ex-star-delta',
    title: '22kW 风机星三角（Y-Δ）降压启动与切换死区保护',
    subtitle: '大型离心风机经典降压启动：先星后主 → 延时加速 → 50~100ms 灭弧死区 → 三角全压运行',
    difficulty: '进阶',
    industry: '暖通空调 / 环保除尘 / 空压机 / 水泵',
    hardware: 'S7-1200 CPU 1214C + 主接触器 KM_Main + 星形接触器 KM_Star + 三角形接触器 KM_Delta + 3RU21 热过载继电器',
    summary:
      '功率 ≥15kW 的三相异步电机直接全压启动时，冲击电流可达额定电流的 5~7 倍，极易拉低厂区电网电压。本案例采用标准工业 5 步状态机实现 Y-Δ 降压启动：先闭合星形接触器（空载无弧闭合）→ 闭合主接触器降压加速 8s → 断开星形接触器并强制插入 80ms 灭弧死区 → 闭合三角形接触器进入全压额定运行，将启动电流压低至 1/3。',
    highlights: [
      '严格遵循“先吸星形 KM_Y、后吸主接触器 KM_M”顺序，极大延长星形接触器触点寿命',
      '核心工业细节：Y 切 Δ 必须插入 50~100ms 死区延时（Deadtime），彻底杜绝飞弧相间短路',
      '完整 IEC 定时器 `TON_TIME` 级联架构 + 接触器辅助触点回读故障诊断',
      '直接绑定仿真台 `ton-star-delta` 预设，可打开 Trace 时序波形亲眼观测死区空白段',
    ],
    linkedSimPreset: 'ton-star-delta',
    ioTags: [
      { name: 'Start_PB', address: '%I0.0', type: 'Bool', area: 'I', init: false, comment: '风机启动按钮（NO）' },
      { name: 'Stop_PB_NC', address: '%I0.1', type: 'Bool', area: 'I', init: true, comment: '风机停止按钮（NC 常闭）' },
      { name: 'EStop_OK_NC', address: '%I0.2', type: 'Bool', area: 'I', init: true, comment: '急停与门限位安全联锁（NC）' },
      { name: 'FR_Overload_NC', address: '%I0.3', type: 'Bool', area: 'I', init: true, comment: '热继电器常闭触点（NC）' },
      { name: 'KM_Star_FB', address: '%I0.4', type: 'Bool', area: 'I', init: false, comment: '星形接触器 KM_Y 辅助常开反馈' },
      { name: 'KM_Delta_FB', address: '%I0.5', type: 'Bool', area: 'I', init: false, comment: '三角形接触器 KM_D 辅助常开反馈' },
      { name: 'KM_Main', address: '%Q0.0', type: 'Bool', area: 'Q', init: false, comment: '主电源接触器 KM1 输出' },
      { name: 'KM_Star', address: '%Q0.1', type: 'Bool', area: 'Q', init: false, comment: '星形封星接触器 KM2 (Y) 输出' },
      { name: 'KM_Delta', address: '%Q0.2', type: 'Bool', area: 'Q', init: false, comment: '三角形全压接触器 KM3 (Δ) 输出' },
      { name: 'HL_FullRun', address: '%Q0.3', type: 'Bool', area: 'Q', init: false, comment: '三角形全压正常运行指示灯' },
    ],
    controlRequirements: [
      '降压启动原理：启动阶段将电机定子绕组接成星形（Y），每相绕组仅承受 220V 电压（正常 380V 的 1/√3），启动电流与启动转矩均降为全压直接启动的 1/3。',
      '精确时序步进：按下启动按钮后，Step 10 先吸合 KM_Star（100ms 后再吸合 KM_Main 实现星形无弧吸合）→ Step 20 保持星形降压加速 8.0s（大型风机按惯量设 6~12s）→ Step 30 断开 KM_Star 并强制进入 80ms 灭弧死区（KM_Main 保持吸合）→ Step 40 确认星形触点已分断后吸合 KM_Delta 进入三角形全压运行！',
      '绝对互斥安全保护：KM_Star（将 U2/V2/W2 短接封星）与 KM_Delta（将 U2/V2/W2 接至三相 380V）严禁同时闭合！除程序互锁与 80ms 死区外，电气图纸必须硬接辅助常闭互锁。',
      '随时安全停机：在启动加速、死区切换或全压运行的任意阶段，只要按下停止 %I0.1、急停 %I0.2 或热过载 %I0.3 断开，立即同时释放全部三个接触器。',
    ],
    ladDiagramText: `// =========================================================================
// TIA Portal LAD 梯形图：22kW 风机星三角降压启动（含 80ms 切换死区）
// =========================================================================

Network 1: 主运行请求自锁（停止优先）
   "Start_PB"        "Stop_PB_NC"  "EStop_OK_NC"  "FR_Overload_NC"    "KM_Main"
  ----| |----+----------| |-------------| |-------------| |--------------( )
             |
   "KM_Main"
  ----| |----+

Network 2: 星形降压加速定时器 TON_Star (8s) 与 切换灭弧死区定时器 TON_Dead (80ms)
   "KM_Main"                        +---------------+
  ----| |---------------------------|  TON_Star     |
                               PT --| T#8s          |--(Q)---+--[ TON_DeadTime (PT:=T#80ms) ]--(Q) "M_DeltaEn"
                                    +---------------+        |
                                                             +--> "M_StarTimeUp"

Network 3: 星形接触器 KM_Star 输出（仅在主接触器吸合、8s 未到且非三角状态时吸合）
   "KM_Main"   "M_StarTimeUp"  "KM_Delta"                             "KM_Star"
  ----| |-----------|/|-----------|/|------------------------------------( )

Network 4: 三角形接触器 KM_Delta 输出（8s + 80ms 死区均到、且星形已断才吸合！）
   "KM_Main"   "M_DeltaEn"     "KM_Star"    "KM_Star_FB"              "KM_Delta"
  ----| |-----------| |-----------|/|-----------|/|----------------------( )`,
    sclCode: `FUNCTION_BLOCK "FB_StarDeltaStarter"
{ S7_Optimized_Access := 'TRUE' }
VERSION : 0.1
   VAR_INPUT
      iStartPb       : Bool;           // 启动按钮 (NO)
      iStopPbNc      : Bool;           // 停止按钮 (NC: 正常TRUE)
      iEStopOkNc     : Bool;           // 急停安全回路 (NC: 正常TRUE)
      iOverloadOkNc  : Bool;           // 热继电器正常 (NC: 正常TRUE)
      iKmStarFb      : Bool;           // 星形接触器辅助反馈 (用于确认彻底分断)
      iStarTime      : Time := T#8s;   // 星形加速时间 (22kW风机典型 6~12s)
      iDeadTime      : Time := T#80ms; // Y->Δ 灭弧切换死区 (推荐 50~100ms)
   END_VAR

   VAR_OUTPUT
      qKmMain        : Bool; // 主接触器 KM1 (%Q0.0)
      qKmStar        : Bool; // 星形接触器 KM2 (%Q0.1)
      qKmDelta       : Bool; // 三角形接触器 KM3 (%Q0.2)
      qFullRunning   : Bool; // 三角全压运行指示灯 (%Q0.3)
      qStep          : Int;  // 当前启动步号
   END_VAR

   VAR
      statStep       : Int := 0;
      tonPreStar     : TON_TIME; // 星形先吸合 100ms 延时（空载无弧闭合）
      tonStarAccel   : TON_TIME; // 星形降压加速定时
      tonDeadZone    : TON_TIME; // 灭弧切换死区定时
   END_VAR

   VAR_CONSTANT
      STEP_STOP      : Int := 0;
      STEP_PRE_STAR  : Int := 10; // 先吸星形 KM_Star
      STEP_STAR_RUN  : Int := 20; // 星形 + 主接触器降压加速
      STEP_DEADTIME  : Int := 30; // 断开 KM_Star，等待灭弧与机械释放
      STEP_DELTA_RUN : Int := 40; // 吸合 KM_Delta 全压额定运行
   END_VAR

BEGIN
   // 1. 停止、急停、热过载最高优先级切断
   IF NOT #iStopPbNc OR NOT #iEStopOkNc OR NOT #iOverloadOkNc THEN
      #statStep := #STEP_STOP;
   ELSE
      // 2. 五步状态机顺序推进
      CASE #statStep OF
         #STEP_STOP:
            IF #iStartPb THEN
               #statStep := #STEP_PRE_STAR;
            END_IF;

         #STEP_PRE_STAR:
            // 等待 100ms 让星形接触器先空载可靠吸合，再合主接触器
            IF #tonPreStar.Q THEN
               #statStep := #STEP_STAR_RUN;
            END_IF;

         #STEP_STAR_RUN:
            IF #tonStarAccel.Q THEN
               #statStep := #STEP_DEADTIME;
            END_IF;

         #STEP_DEADTIME:
            // 必须同时满足：80ms 死区计时结束 AND 星形接触器反馈已彻底断开
            IF #tonDeadZone.Q AND NOT #iKmStarFb THEN
               #statStep := #STEP_DELTA_RUN;
            END_IF;

         #STEP_DELTA_RUN:
            // 维持全压运行，等待停止或保护信号
            ;

         ELSE
            #statStep := #STEP_STOP;
      END_CASE;
   END_IF;

   // 3. 统一在状态机外部调用 IEC 定时器
   #tonPreStar(IN := (#statStep = #STEP_PRE_STAR), PT := T#100ms);
   #tonStarAccel(IN := (#statStep = #STEP_STAR_RUN), PT := #iStarTime);
   #tonDeadZone(IN := (#statStep = #STEP_DEADTIME), PT := #iDeadTime);

   // 4. 单点互锁输出赋值（KM_Star 与 KM_Delta 严格互斥）
   #qKmMain      := (#statStep = #STEP_STAR_RUN) OR (#statStep = #STEP_DEADTIME) OR (#statStep = #STEP_DELTA_RUN);
   #qKmStar      := (#statStep = #STEP_PRE_STAR) OR (#statStep = #STEP_STAR_RUN);
   #qKmDelta     := (#statStep = #STEP_DELTA_RUN) AND NOT #qKmStar;
   #qFullRunning := #qKmDelta AND #qKmMain;
   #qStep        := #statStep;
END_FUNCTION_BLOCK`,
    pitfalls: [
      '省略 50~100ms 切换死区（最常见炸柜事故！）：很多教材只用一个定时器 `Q` 的常闭接星形、常开接三角形，同一扫描周期内断开 Y 立刻吸合 Δ，星形接触器拉弧尚未熄灭时 Δ 就把 380V 灌进去，直接相间短路跳总闸！',
      '星形加速时间设得过短（例如设 2s）：22kW 离心风机转动惯量极大，2s 时转速远未达到额定转速的 80%，过早切入三角形会产生比直接启动还可怕的二次电流冲击！',
      '热继电器安装位置选错导致整定电流错 1.732 倍：若热继电器装在三角形内部相线上，整定电流应设为额定线电流的 1/√3 (0.58 倍)；装在主电源总线上则按 1.0 倍额定电流整定。',
      '只适合空载或轻载启动：Y-Δ 启动转矩同样降为 1/3，如果给满载破碎机或带重负载的皮带机用 Y-Δ 启动，会出现星形根本转不起来“闷车烧电机”！',
    ],
    interviewPoints: [
      '星三角降压启动为什么能降低启动电流？电流和转矩分别降为全压启动的多少？——星形接法下每相绕组电压降为原来的 1/√3，因此相电流降为 1/√3，又因三角形线电流是相电流的 √3 倍，故星形线电流仅为三角形的 1/3；由于电磁转矩与电压平方成正比，启动转矩也降为 1/3。',
      'Y 切 Δ 为什么要加 50~100ms 的死区时间？太长（比如设 2 秒）又会有什么问题？——太短（<30ms）星形接触器电弧未熄灭会相间短路；太长（>0.5s）电机失电滑行转速大幅掉落，切入三角形瞬间又会产生巨大二次冲击电流，通常工程取 50~100ms 最佳。',
      '为什么三个接触器里，星形接触器的额定电流选型可以比主接触器和三角形接触器更小？——KM_Main 和 KM_Delta 串联在相电流回路里承受 0.58 倍额定线电流（约 58%），而 KM_Star 仅在启动几秒内流过 1/3 启动电流，工程上一般按主接触器 0.58 Ie、星形 0.33 Ie 经济选型。',
      '在什么样的电机铭牌上才能使用星三角降压启动？——必须是“额定 380V 三角形接法（380V Δ / 660V Y）”的三相电机！如果铭牌写的是 380V Y 接法，绝对不能接成三角形，否则每相绕组过压 1.732 倍瞬间烧毁。',
    ],
  },
];
