import type { ExampleCase } from '../../types/content';

export const processAndSystemExamples: ExampleCase[] = [
  // =========================================================================
  // 4. 三工位视觉检测与双气缸柔性分拣产线顺序控制
  // =========================================================================
  {
    id: 'ex-sorting-line',
    title: '三工位视觉检测与双气缸柔性分拣产线顺序控制',
    subtitle: '工业产线多传感器协同：电感金属识别 + 视觉质检 + 气缸双向磁性开关看门狗与声光报警',
    difficulty: '工业综合',
    industry: '3C 电子 / 新能源装配 / 智能物流分拣',
    hardware: 'S7-1200 CPU 1214C + SINAMICS G120 变频器 + 对射光电 + 电感接近开关 + 智能视觉相机 + SMC 双作用气缸 × 2',
    summary:
      '完整还原非标自动化视觉分拣产线的工程级 PLC 控制方案。工件经变频传送带依次通过上料光电、电感式金属接近开关、工业视觉相机拍照工位，PLC 通过标准化气缸控制块（含缩回/伸出双磁性开关到位检测与 1.3s 动作超时看门狗）驱动 1# 金属分拣气缸与 2# 次品剔除气缸，实现精准分拣、合格品装箱计数与堵料/卡缸声光停线联锁。',
    highlights: [
      '工业标准气缸超时看门狗设计：电磁阀发令后 1.3s 未见伸出磁性开关 %I0.6 立即停线报卡缸',
      '上料光电持续遮挡 >3s 自动判定堵料/传感器粘连，防工件连环堆叠挤压',
      '结合变频器模拟量/报文调速 %QW80 与末端高速计数器实现产线 OEE 良率统计',
      '与“三工位视觉分拣数字孪生”模型深度绑定，可在线注入卡缸与遮挡故障实测',
    ],
    linkedModelId: 'sorting-conveyor',
    linkedSimPreset: 'ctu-batch-pack',
    ioTags: [
      { name: 'Start_Line_PB', address: '%I0.0', type: 'Bool', area: 'I', init: false, comment: '产线启动按钮（NO）' },
      { name: 'EStop_OK_NC', address: '%I0.1', type: 'Bool', area: 'I', init: true, comment: '产线急停安全回路（NC 常闭）' },
      { name: 'PE_Infeed', address: '%I0.2', type: 'Bool', area: 'I', init: false, comment: '上料工位对射光电传感器' },
      { name: 'Prox_Metal', address: '%I0.3', type: 'Bool', area: 'I', init: false, comment: '电感式金属接近开关（仅金属件触发）' },
      { name: 'Cam_NG_Result', address: '%I0.4', type: 'Bool', area: 'I', init: false, comment: '工业视觉相机尺寸超差 NG 判定信号' },
      { name: 'Cyl1_Ret_LS', address: '%I0.5', type: 'Bool', area: 'I', init: true, comment: '1# 金属分拣气缸缩回原点磁性开关' },
      { name: 'Cyl1_Ext_LS', address: '%I0.6', type: 'Bool', area: 'I', init: false, comment: '1# 金属分拣气缸伸出到位磁性开关' },
      { name: 'PE_Qualified_Cnt', address: '%I0.7', type: 'Bool', area: 'I', init: false, comment: '末端合格品入箱计数光电' },
      { name: 'VFD_Belt_Run', address: '%Q0.0', type: 'Bool', area: 'Q', init: false, comment: 'SINAMICS G120 传送带变频运行使能' },
      { name: 'Sol_Cyl1_Metal', address: '%Q0.1', type: 'Bool', area: 'Q', init: false, comment: '1# 金属分拣气缸两位五通电磁阀' },
      { name: 'Sol_Cyl2_Reject', address: '%Q0.2', type: 'Bool', area: 'Q', init: false, comment: '2# 次品剔除气缸两位五通电磁阀' },
      { name: 'Andon_Red', address: '%Q0.3', type: 'Bool', area: 'Q', init: false, comment: '三色声光报警塔红灯与蜂鸣器' },
      { name: 'VFD_Speed_QW', address: '%QW80', type: 'Int', area: 'Q', init: 19353, unit: 'raw', comment: '变频器频率给定（0~27648 对应 0~50Hz）' },
    ],
    controlRequirements: [
      '开机自检原点条件：按下启动后，系统必须先确认 1#、2# 气缸均已缩回原点（%I0.5 = 1）且急停正常（%I0.1 = 1），才允许启动变频传送带 %Q0.0。',
      '三类工件精准路由：蓝色塑料合格件全程放行至末端触发 %I0.7 合格计数；银色金属件经 %I0.3 识别后，到达 1# 工位由 %Q0.1 气缸推入金属分拣箱；红色尺寸超差次品经 %I0.4 视觉拍照判定后，到达 2# 工位由 %Q0.2 剔除至次品箱。',
      '气缸卡滞超时保护（核心工业规范）：当 %Q0.1 得电伸出超过 1.3s 仍未检测到伸出到位磁性开关 %I0.6（或缩回时超过 1.3s 未回原点 %I0.5），立即判定“1# 气缸卡死超时”，停止皮带并点亮声光报警塔红灯 %Q0.3。',
      '光电堵料防呆：若上料对射光电 %I0.2 持续被遮挡超过 3.0s，说明前端卡料或光电镜面污损粘连，PLC 立即触发堵料停机报警。',
      '合格品批次装箱计数：末端光电 %I0.7 采用上升沿（R_TRIG）触发加计数器 CTU，每满 12 件触发换箱提示并支持自动/手动清零。',
    ],
    ladDiagramText: `// =========================================================================
// TIA Portal LAD 梯形图：气缸超时看门狗 + 堵料报警 + 上升沿合格计数
// =========================================================================

Network 1: 1# 金属分拣气缸伸出超时看门狗（电磁阀得电 1.3s 未到位 -> 锁存报警）
   "Sol_Cyl1_Metal"   "Cyl1_Ext_LS"             +------------------+
  ----| |-----------------|/|-------------------|  TON_Cyl1Timeout |
                                           PT --| T#1300ms         |--(Q)---( S ) "Alarm_Cyl1Jam"
                                                +------------------+

Network 2: 上料对射光电堵料/粘连监测（持续遮挡 3s -> 堵料停线）
   "VFD_Belt_Run"     "PE_Infeed"               +------------------+
  ----| |-----------------| |-------------------|  TON_InfeedJam   |
                                           PT --| T#3s             |--(Q)---( S ) "Alarm_InfeedJam"
                                                +------------------+

Network 3: 合格品入箱上升沿计数（防止工件停留导致重复累加！）
   "PE_Qualified_Cnt"                           +------------------+
  ----| P |-------------------------------------|  CTU_Qualified   |
     "M_Edge_PE"                           PV --| 12               |--(Q) "Batch_Box_Full"
   "Reset_Count_PB"                        R  --|                  |
                                                +------------------+`,
    sclCode: `FUNCTION_BLOCK "FB_SortingLineController"
{ S7_Optimized_Access := 'TRUE' }
VERSION : 0.1
   VAR_INPUT
      iStartPb       : Bool;         // 产线启动按钮
      iStopPbNc      : Bool;         // 停止按钮 (NC)
      iEStopOkNc     : Bool;         // 急停安全回路 (NC)
      iResetFault    : Bool;         // 报警复位按钮
      iPeInfeed      : Bool;         // 上料对射光电 (%I0.2)
      iProxMetal     : Bool;         // 电感金属接近开关 (%I0.3)
      iVisionNg      : Bool;         // 视觉相机 NG 判定 (%I0.4)
      iCyl1RetLs     : Bool;         // 1#气缸缩回磁性开关 (%I0.5)
      iCyl1ExtLs     : Bool;         // 1#气缸伸出磁性开关 (%I0.6)
      iPeQualified   : Bool;         // 末端合格品计数光电 (%I0.7)
      iTargetFreqHz  : Real := 35.0; // 目标皮带频率 (10.0 ~ 50.0 Hz)
   END_VAR

   VAR_OUTPUT
      qVfdBeltRun    : Bool; // 变频皮带运行 (%Q0.0)
      qSolCyl1Metal  : Bool; // 1# 金属分拣电磁阀 (%Q0.1)
      qSolCyl2Reject : Bool; // 2# 次品剔除电磁阀 (%Q0.2)
      qAndonRed      : Bool; // 声光报警红灯 (%Q0.3)
      qAndonGreen    : Bool; // 正常运行绿灯 (%Q0.4)
      qVfdSpeedRaw   : Int;  // 变频速度模拟量 (%QW80: 0~27648)
      qQualifiedCnt  : DInt; // 合格品累计数量
      qFaultCode     : Word; // 0正常 1急停 2气缸超时 3上料堵料 4双磁开冲突
   END_VAR

   VAR
      statAutoRun    : Bool := FALSE;
      statFaultLatch : Bool := FALSE;
      statCyl1Cmd    : Bool := FALSE;
      statCyl2Cmd    : Bool := FALSE;
      tonCyl1Timeout : TON_TIME; // 1# 气缸动作超时看门狗
      tonCyl1Hold    : TON_TIME; // 1# 气缸推出保持定时
      tonCyl2Hold    : TON_TIME; // 2# 气缸推出保持定时
      tonInfeedJam   : TON_TIME; // 上料堵料超时定时
      rTrigQualified : R_TRIG;   // 末端合格品上升沿检测
      rTrigMetal     : R_TRIG;   // 金属传感器上升沿
      rTrigNg        : R_TRIG;   // 视觉 NG 上升沿
   END_VAR

BEGIN
   // =========================================================================
   // 1. 工业级安全联锁与硬件诊断（最高优先级）
   // =========================================================================
   IF NOT #iEStopOkNc THEN
      #statFaultLatch := TRUE;
      #qFaultCode     := 16#0001; // 急停触发
   ELSIF #iCyl1RetLs AND #iCyl1ExtLs THEN
      // 双向磁性开关同时为 1 属于物理不可能状态 -> 传感器短路或接线错
      #statFaultLatch := TRUE;
      #qFaultCode     := 16#0004;
   ELSIF #tonCyl1Timeout.Q THEN
      #statFaultLatch := TRUE;
      #qFaultCode     := 16#0002; // 1# 气缸伸出卡滞超时
   ELSIF #tonInfeedJam.Q THEN
      #statFaultLatch := TRUE;
      #qFaultCode     := 16#0003; // 上料光电遮挡超 3s 堵料
   ELSIF #iResetFault AND #iEStopOkNc AND NOT (#iCyl1RetLs AND #iCyl1ExtLs) AND NOT #iPeInfeed THEN
      #statFaultLatch := FALSE;
      #qFaultCode     := 16#0000;
   END_IF;

   // =========================================================================
   // 2. 产线启停与自动分拣逻辑
   // =========================================================================
   IF #statFaultLatch OR NOT #iStopPbNc THEN
      #statAutoRun := FALSE;
      #statCyl1Cmd := FALSE;
      #statCyl2Cmd := FALSE;
   ELSIF #iStartPb AND #iCyl1RetLs THEN
      // 原点安全确认：必须 1# 气缸在缩回位才允许开线
      #statAutoRun := TRUE;
   END_IF;

   // 边沿检测触发分拣动作与合格品计数
   #rTrigMetal(CLK := #iProxMetal);
   #rTrigNg(CLK := #iVisionNg);
   #rTrigQualified(CLK := #iPeQualified);

   IF #statAutoRun THEN
      IF #rTrigMetal.Q THEN
         #statCyl1Cmd := TRUE;
      ELSIF #tonCyl1Hold.Q AND #iCyl1ExtLs THEN
         #statCyl1Cmd := FALSE;
      END_IF;

      IF #rTrigNg.Q THEN
         #statCyl2Cmd := TRUE;
      ELSIF #tonCyl2Hold.Q THEN
         #statCyl2Cmd := FALSE;
      END_IF;

      IF #rTrigQualified.Q THEN
         #qQualifiedCnt := #qQualifiedCnt + 1;
      END_IF;
   END_IF;

   // =========================================================================
   // 3. 看门狗与保持定时器统一扫描调用
   // =========================================================================
   #tonCyl1Timeout(IN := #statCyl1Cmd AND NOT #iCyl1ExtLs, PT := T#1300ms);
   #tonCyl1Hold(IN := #statCyl1Cmd AND #iCyl1ExtLs, PT := T#400ms);
   #tonCyl2Hold(IN := #statCyl2Cmd, PT := T#650ms);
   #tonInfeedJam(IN := #statAutoRun AND #iPeInfeed, PT := T#3s);

   // =========================================================================
   // 4. 单点安全输出赋值 + 变频器模拟量线性标定 (0~50Hz -> 0~27648)
   // =========================================================================
   #qVfdBeltRun    := #statAutoRun AND NOT #statFaultLatch;
   #qSolCyl1Metal  := #statCyl1Cmd AND #qVfdBeltRun;
   #qSolCyl2Reject := #statCyl2Cmd AND #qVfdBeltRun;
   #qAndonRed      := #statFaultLatch;
   #qAndonGreen    := #qVfdBeltRun;

   IF #qVfdBeltRun THEN
      #qVfdSpeedRaw := REAL_TO_INT(LIMIT(MN := 0.0, IN := (#iTargetFreqHz / 50.0) * 27648.0, MX := 27648.0));
   ELSE
      #qVfdSpeedRaw := 0;
   END_IF;
END_FUNCTION_BLOCK`,
    pitfalls: [
      '仅靠固定延时推气缸，不接磁性开关做看门狗：一旦产线空压机降压或气缸密封圈卡死，PLC 仍以为推送成功继续高速放料，会导致金属件混入下游合格品甚至把视觉镜头撞碎！',
      '传送带变频调速后，若用“固定延时秒数”跟踪检测点到分拣气缸的物料位置，一改频率就会全部推空！工程高速多料线必须使用编码器脉冲（HSC）移位队列或工位二次确认光电。',
      '合格品计数忘记加 `R_TRIG` 上升沿：光电被工件遮挡持续约 300ms（约 30 个扫描周期），如果不取上升沿，每过 1 个产品计数器会狂加 30！',
      '忽略气缸双磁性开关互斥自检（`Cyl_Ret AND Cyl_Ext`）：现场磁性开关移位或线路短接可能导致缩回和伸出同时为 1，标准气缸 FB 必须将双到位同亮判为硬件故障。',
    ],
    interviewPoints: [
      '在高速多工件同时在线的传送带上，如何精准把检测工位的 OK/NG 结果跟踪到 2 米外的剔除气缸？——不能用单个布尔变量和纯延时！标准做法是皮带主动滚筒加装旋转编码器接入 PLC 高速计数器（HSC），配合 FIFO 环形队列数组记录每个工件入列时的目标脉冲位置，或使用每步位移映射的移位寄存器。',
      '请你手写一个标准工业气缸控制块 `FB_Cylinder2Pos`，需要包含哪些核心报警诊断？——四大必备诊断：① 伸出动作超时（命令出且定时到仍未见伸出位）；② 缩回动作超时；③ 双磁性开关同时为 1（互斥硬件冲突）；④ 运行中到位信号意外丢失（失压漂移）。',
      '电感式接近开关、电容式接近开关和漫反射光电开关在产线选型时如何区分？——电感式只测金属导体（抗灰尘油污最强）；电容式可测金属、塑料、液位等非金属（易受湿度干扰）；光电式检测距离远但需防强光反光与镜头积灰。',
      '为什么工程上推荐用 `FB` 封装气缸和电机，而不用 `FC`？——气缸需要内部静态记忆变量（背景 DB）来保存各自的 `TON` 超时定时器、报警锁存位和命令保持状态，封装成 FB 后在一条有 30 个气缸的产线上只需多重背景实例化 30 次即可复用，维护成本极低。',
    ],
  },

  // =========================================================================
  // 5. 双泵恒压供水模拟量采集、断线保护与 PID 闭环调速
  // =========================================================================
  {
    id: 'ex-constant-pressure-pid',
    title: '双泵恒压供水模拟量采集、断线保护与 PID 闭环调速',
    subtitle: '工业过程控制标杆：NORM_X/SCALE_X 标定、4-20mA 断线防溢流、OB30 循环中断与双泵自动加减泵',
    difficulty: '工业综合',
    industry: '智慧水务 / 化工储罐 / 暖通恒压供水',
    hardware: 'S7-1200 CPU 1214C + SM 1231 AI4 (4-20mA) + SM 1232 AQ2 (0-10V) + SITRANS P320 变送器 + 1# 变频泵 + 2# 副增压泵',
    summary:
      '系统掌握西门子 S7-1200 模拟量采集与闭环过程控制全链路。利用 `NORM_X` 与 `SCALE_X` 将 4-20mA 通道原码 `0~27648` 线性标定为工程液位（0~100%）与管网压力（0~1.0 MPa）；在 `OB30` 循环中断中执行等周期 PID 运算并输出至 `%QW80` 变频调速；内建 4-20mA 活零点断线保护（`< -1728` 立即停泵）、HH 硬件浮球防溢流联锁与高峰自动加泵/低谷休眠逻辑。',
    highlights: [
      '深度理解 4-20mA“活零点”机制：原码掉至 < -1728 立刻判为断线并切泵，严防盲目全速抽水爆管',
      '标准西门子 `NORM_X` + `SCALE_X` 双向工程量换算（输入标定 + 输出反标定至 %QW80）',
      '双泵一拖二智能加减泵：主泵持续高频 >86% 自动投入副泵，低负荷 <35% 自动切除节能',
      '联动“双泵恒压供水与热工储液罐”数字孪生，可直接拖动用水阀门观察 PID 抗扰三曲线',
    ],
    linkedModelId: 'tank-pressure-pid',
    linkedSimPreset: 'analog-scale-pid',
    ioTags: [
      { name: 'AI_TankLevel_Raw', address: '%IW64', type: 'Int', area: 'I', init: 14376, unit: 'raw', comment: '4-20mA 液位变送器原码（0~27648，<0 断线）' },
      { name: 'AI_Pressure_Raw', address: '%IW66', type: 'Int', area: 'I', init: 11059, unit: 'raw', comment: '4-20mA 管网压力原码（0~1.0 MPa）' },
      { name: 'LS_HighHigh_NC', address: '%I0.2', type: 'Bool', area: 'I', init: true, comment: '高高液位硬件浮球开关（NC 常闭，溢流=0）' },
      { name: 'Pump1_VFD_Fault_NC', address: '%I0.3', type: 'Bool', area: 'I', init: true, comment: '1# 变频器故障继电器（NC 常闭，正常=1）' },
      { name: 'Pump1_VFD_Run', address: '%Q0.0', type: 'Bool', area: 'Q', init: false, comment: '1# 主变频水泵运行使能' },
      { name: 'Pump2_Aux_Run', address: '%Q0.1', type: 'Bool', area: 'Q', init: false, comment: '2# 副增压泵工频接触器' },
      { name: 'Heater_SSR', address: '%Q0.2', type: 'Bool', area: 'Q', init: false, comment: '热工防冻/恒温加热管固态继电器' },
      { name: 'AQ_VFD_Speed', address: '%QW80', type: 'Int', area: 'Q', init: 0, unit: 'raw', comment: '1# 变频器 0-10V 模拟量速度给定（0~27648）' },
      { name: 'Level_PV_Pct', address: 'DB10.DBD0', type: 'Real', area: 'DB', init: 52.0, unit: '%', comment: '标定后的实时工程液位反馈 PV' },
      { name: 'Level_SP_Pct', address: 'DB10.DBD4', type: 'Real', area: 'DB', init: 65.0, unit: '%', comment: 'PID 目标液位设定值 SP' },
    ],
    controlRequirements: [
      '标准模拟量标定：将 SM 1231 4-20mA 通道 `%IW64`（0~27648）经 `NORM_X` 归一化为 `0.0~1.0`，再经 `SCALE_X` 缩放为 `0.0~100.0%` 液位工程值。',
      '4-20mA 断线与溢出诊断：当 `%IW64 < -1728`（电流低于 ~3.0mA，信号线断线或变送器失电）或 `%IW64 > 31000`（超量程溢出）时，立即锁存模拟量通道故障，强制停泵并将 `%QW80` 归零！',
      '高高液位硬联锁（HH ≥ 90%）：软件液位 ≥ 90% 或硬件浮球开关 `%I0.2` 断开任一满足，立即无条件切断 1#、2# 水泵防储罐溢流。',
      '定周期 PID 闭环调速：PID 算法必须部署在循环中断组织块 `OB30`（周期 100ms）中运行，保证微分与积分时间步长 `dt` 严格恒定不受 `OB1` 扫描周期波动影响。',
      '高峰自动加减泵与故障备投：当 1# 主变频泵输出持续 >86% 达 2.0s 时自动投入 2# 副泵增压；当主泵回落至 <35% 达 2.0s 时自动切除副泵；若 1# 变频器跳闸，2# 副泵自动顶替维持应急供水。',
    ],
    ladDiagramText: `// =========================================================================
// TIA Portal LAD 梯形图：模拟量 NORM_X / SCALE_X 标定与断线联锁（OB30）
// =========================================================================

Network 1: 4-20mA 液位变送器断线/溢出故障检测 (%IW64 < -1728 或 > 31000)
   +------------+                                       "Fault_AI_WireBreak"
   |   CMP <    |  %IW64 < -1728   ----+-------------------------( )
   +------------+                      |
   +------------+                      |
   |   CMP >    |  %IW64 > 31000   ----+
   +------------+

Network 2: NORM_X (Int -> Real 0.0~1.0) 级联 SCALE_X (Real -> 0.0~100.0%)
   +------------------+         +------------------+
   |     NORM_X       |         |     SCALE_X      |
   | MIN := 0         |  #tNorm | MIN := 0.0       |
   | VAL := %IW64     |-------->| VAL := #tNorm    |---> "Level_PV_Pct" (Real)
   | MAX := 27648     |         | MAX := 100.0     |
   +------------------+         +------------------+

Network 3: PID_Compact 调用与模拟量输出反标定（仅在无断线且非 HH 溢流时使能）
   "Fault_AI_WireBreak"  "LS_HighHigh_NC"        +----------------------+
  ----------|/|-----------------| |--------------|  PID_Compact_DB      |
                                   Setpoint   ---| "Level_SP_Pct"       |
                                   Input      ---| "Level_PV_Pct"       |
                                   Output_PER ---| %QW80 (0..27648)     |
                                                 +----------------------+`,
    sclCode: `FUNCTION_BLOCK "FB_DualPumpPidStation"
{ S7_Optimized_Access := 'TRUE' }
VERSION : 0.1
   // 说明：本 FB 建议在循环中断 OB30（周期 T#100ms）中调用，确保积分/微分时间精确！
   VAR_INPUT
      iAiLevelRaw     : Int;           // 4-20mA 液位原始通道 (%IW64)
      iLsHighHighNc   : Bool;          // 高高液位硬件浮球 (NC: 正常TRUE)
      iPump1OkNc      : Bool;          // 1# 主变频器正常反馈 (NC: 正常TRUE)
      iSetpointPct    : Real := 65.0;  // 目标液位/恒压设定值 SP (20.0~85.0%)
      iKp             : Real := 2.4;   // 比例增益 Kp
      iTiSec          : Real := 8.0;   // 积分时间 Ti (秒)
      iSampleSec      : Real := 0.1;   // OB30 循环中断采样周期 (0.1s)
      iAutoEnable     : Bool := TRUE;  // 系统自动使能
      iResetFault     : Bool;          // 故障复位
   END_VAR

   VAR_OUTPUT
      qLevelPvPct     : Real; // 标定后实时液位 PV (0.0~100.0%)
      qPidOutPct      : Real; // PID 输出百分比 (0.0~100.0%)
      qVfdOutRaw      : Int;  // 变频器模拟量给定 (%QW80: 0~27648)
      qPump1Run       : Bool; // 1# 主变频泵启停 (%Q0.0)
      qPump2AuxRun    : Bool; // 2# 副增压泵启停 (%Q0.1)
      qAlarmWireBreak : Bool; // 4-20mA 断线报警
      qAlarmHighHigh  : Bool; // 高高液位溢流报警
   END_VAR

   VAR
      statIntegral    : Real := 0.0;   // 积分累加项 (带抗饱和限幅)
      statPump2Active : Bool := FALSE; // 2# 副泵投入状态
      tonAddPump2     : TON_TIME;      // 满频加泵防抖延时
      tonDropPump2    : TON_TIME;      // 低频减泵防抖延时
   END_VAR

   VAR_TEMP
      tNorm           : Real;
      tError          : Real;
      tRawOut         : Real;
      tSafetyTrip     : Bool;
   END_VAR

BEGIN
   // =========================================================================
   // 1. 4-20mA 活零点断线诊断 & NORM_X / SCALE_X 工程量标定
   // =========================================================================
   #qAlarmWireBreak := (#iAiLevelRaw < -1728) OR (#iAiLevelRaw > 31000);

   IF #qAlarmWireBreak THEN
      #qLevelPvPct := 0.0;
   ELSE
      // 标准西门子标定算法：0..27648 -> 0.0..1.0 -> 0.0..100.0%
      #tNorm       := NORM_X(MIN := 0, VALUE := #iAiLevelRaw, MAX := 27648);
      #qLevelPvPct := LIMIT(MN := 0.0, IN := SCALE_X(MIN := 0.0, VALUE := #tNorm, MAX := 100.0), MX := 100.0);
   END_IF;

   // 高高液位双重联锁（硬件浮球 OR 软件 90% 阈值）
   #qAlarmHighHigh := (NOT #iLsHighHighNc) OR (#qLevelPvPct >= 90.0);
   #tSafetyTrip    := #qAlarmWireBreak OR #qAlarmHighHigh OR NOT #iAutoEnable;

   // =========================================================================
   // 2. 抗积分饱和 PI 闭环运算 + 双泵加减泵策略
   // =========================================================================
   IF #tSafetyTrip THEN
      #qPidOutPct     := 0.0;
      #statIntegral   := 0.0;
      #statPump2Active := FALSE;
   ELSE
      #tError := #iSetpointPct - #qLevelPvPct;

      // 条件积分抗饱和（Anti-Windup）
      IF #iTiSec > 0.1 THEN
         #statIntegral := LIMIT(
            MN := -20.0,
            IN := #statIntegral + (#iKp / #iTiSec) * #tError * #iSampleSec,
            MX := 85.0
         );
      END_IF;

      #tRawOut    := #iKp * #tError + #statIntegral;
      #qPidOutPct := LIMIT(MN := 0.0, IN := #tRawOut, MX := 100.0);

      // 主泵故障自动备投 OR 高峰加泵 / 低谷减泵
      IF NOT #iPump1OkNc THEN
         #qPidOutPct      := 0.0;
         #statPump2Active := (#qLevelPvPct < #iSetpointPct);
      ELSE
         IF #tonAddPump2.Q THEN
            #statPump2Active := TRUE;
         ELSIF #tonDropPump2.Q THEN
            #statPump2Active := FALSE;
         END_IF;
      END_IF;
   END_IF;

   // 加减泵防抖定时器（必须无条件扫描）
   #tonAddPump2(IN := NOT #tSafetyTrip AND #iPump1OkNc AND (#qPidOutPct > 86.0), PT := T#2s);
   #tonDropPump2(IN := NOT #tSafetyTrip AND #iPump1OkNc AND (#qPidOutPct < 35.0), PT := T#2s);

   // =========================================================================
   // 3. 输出驱动与模拟量反标定（0.0~100.0% -> 0~27648）
   // =========================================================================
   #qPump1Run    := NOT #tSafetyTrip AND #iPump1OkNc AND (#qPidOutPct > 1.0);
   #qPump2AuxRun := NOT #tSafetyTrip AND #statPump2Active;

   IF #qPump1Run THEN
      #qVfdOutRaw := REAL_TO_INT((#qPidOutPct / 100.0) * 27648.0);
   ELSE
      #qVfdOutRaw := 0;
   END_IF;
END_FUNCTION_BLOCK`,
    pitfalls: [
      '未做 4-20mA 断线保护导致“疯狂满频抽水溢流”：若变送器断线，通道值掉到负值，程序若直接限幅成 `0%` 喂给 PID，PID 会误以为罐子空了，立刻输出 100% 满频拼命往里抽水，几分钟就把储罐抽爆！',
      '把 `PID_Compact` 或自写 PID 放在 `OB1` 主循环里执行：OB1 扫描周期随程序分支、通信负荷剧烈波动（例如 2ms~25ms 跳动），导致积分项和微分项计算严重失真甚至剧烈振荡，必须放进定周期循环中断 `OB30`！',
      '忽视 `27648` 标定边界与数据类型溢出：S7-1200 模拟量额定满量程是 `27648`（不是 32767！），`27649~32511` 为过冲区；且 `NORM_X` 输入端若把 `Int` 直接做整数除法会丢掉全部小数位变成 0。',
      '双泵加减泵不加迟滞区间与防抖延时：如果设定 >80% 加泵、<=80% 就减泵，副泵一投入压力立刻上升，1 秒后又切掉，接触器每分钟吸合十几次很快烧毁触点！',
    ],
    interviewPoints: [
      '工业仪表为什么普遍采用 4-20mA 电流信号，而不用 0-20mA 或 0-10V 电压信号？——① 4mA 活零点可以区分“量程为 0（4mA）”与“线路断线/掉电（0mA）”；② 电流环串联传输不受长距离电缆线阻压降影响，抗电磁干扰能力远强于电压信号。',
      '西门子 S7-1200 模拟量额定范围为什么是 `0 ~ 27648`（双极性 `-27648 ~ +27648`）？——因为西门子在 16 位有符号整数上限 32767 之前特意留出了约 18% 的过冲监测区（27649~32511）和溢出诊断区（32767），方便工艺报警和通道硬件诊断。',
      '博途的 `PID_Compact` 工艺对象为什么必须放到 `OB30`（Cyclic Interrupt）里调用？——PID 控制器的积分与微分运算依赖精确恒定的采样周期 `Δt`，只有循环中断 OB 能确保严格按设定周期（如 100ms）准时触发执行。',
      '什么是“积分饱和（Integral Windup）”？现场怎么消除？——当阀门被关死或水泵故障时误差长期无法消除，积分项持续疯狂累加至极大值，一旦恢复正常会产生严重超调；工程上必须做积分限幅或条件积分（输出达到上限且误差仍为正时暂停积分累加）。',
    ],
  },

  // =========================================================================
  // 6. 城市十字路口多时段信号灯与行人请求联锁系统
  // =========================================================================
  {
    id: 'ex-smart-traffic',
    title: '城市十字路口多时段信号灯与行人请求联锁系统',
    subtitle: '工业多步状态机经典范式：全红清空保护 + 夜间黄闪 + 行人优先请求 + 绿灯冲突故障安全降级',
    difficulty: '进阶',
    industry: '智慧交通 / 厂区道闸 / 园区物流调度',
    hardware: 'S7-1200 CPU 1214C DC/DC/DC + 独立绿灯冲突安全继电器 + 四向红黄绿灯组与倒计时牌 + 路边行人按钮',
    summary:
      '超越教科书“纯定时器串联”写法，按真实智能交通控制器规范构建 9 步 `CASE` 状态机：包含东西/南北绿灯、3 秒绿灯闪烁预警、2 秒黄灯、1.5 秒全红清空保护、夜间低峰 1Hz 黄闪、行人过街按钮优先插队与消防应急绿波通道；最核心的是独立“绿灯冲突安全监控逻辑”，一旦检测到东西与南北同时绿灯，立刻硬切绿灯降级为全向黄闪故障安全模式。',
    highlights: [
      '采用标准 `CASE #statPhase OF` 步进状态机替代杂乱定时器串联，逻辑清晰、极易扩展时段',
      '真实交通工程细节：黄灯后强制插入 1.5s“全红清空相位”，防止抢黄灯车辆侧面碰撞',
      '独立绿灯冲突检测器（`EW_G AND NS_G`）：冲突瞬间锁存安全故障并强切全向黄闪',
      '联动“智能十字路口四向车流数字孪生”，可实时测试行人优先、消防绿波与冲突注入',
    ],
    linkedModelId: 'traffic-intersection',
    ioTags: [
      { name: 'Night_Flash_Sw', address: '%I0.1', type: 'Bool', area: 'I', init: false, comment: '夜间低峰黄灯闪烁模式选择开关' },
      { name: 'Ped_Request_PB', address: '%I0.2', type: 'Bool', area: 'I', init: false, comment: '路边斑马线行人过街优先请求按钮（NO）' },
      { name: 'Emerg_Fire_Wave', address: '%I0.3', type: 'Bool', area: 'I', init: false, comment: '消防应急东西向绿波强制通道开关' },
      { name: 'Safety_Reset_PB', address: '%I0.4', type: 'Bool', area: 'I', init: false, comment: '冲突故障安全继电器人工复位钥匙开关' },
      { name: 'EW_Red', address: '%Q0.0', type: 'Bool', area: 'Q', init: false, comment: '东西主干道红灯' },
      { name: 'EW_Yellow', address: '%Q0.1', type: 'Bool', area: 'Q', init: false, comment: '东西主干道黄灯' },
      { name: 'EW_Green', address: '%Q0.2', type: 'Bool', area: 'Q', init: true, comment: '东西主干道绿灯' },
      { name: 'NS_Red', address: '%Q0.3', type: 'Bool', area: 'Q', init: true, comment: '南北次干道红灯' },
      { name: 'NS_Yellow', address: '%Q0.4', type: 'Bool', area: 'Q', init: false, comment: '南北次干道黄灯' },
      { name: 'NS_Green', address: '%Q0.5', type: 'Bool', area: 'Q', init: false, comment: '南北次干道绿灯' },
      { name: 'Ped_Walk_Green', address: '%Q0.6', type: 'Bool', area: 'Q', init: false, comment: '斑马线行人专用通行绿灯' },
      { name: 'Conflict_Fault', address: '%M10.0', type: 'Bool', area: 'M', init: false, comment: '绿灯冲突故障安全锁存位' },
    ],
    controlRequirements: [
      '日间标准 9 相位循环：东西绿灯(10s) → 东西绿闪(3s, 1Hz) → 东西黄灯(2s) → 全红清空(1.5s) → 南北绿灯(7s) → 南北绿闪(3s) → 南北黄灯(2s) → 全红清空(1.5s) → 回到东西绿灯。',
      '行人过街优先插队：路人按下 `%I0.2` 后内部锁存请求标志，当前绿灯若剩余超过 3s 则安全压缩至 3s 结束，随后经黄灯、全红后切入 6.5s“全向红灯 + 斑马线行人绿灯 %Q0.6”专用相位。',
      '夜间黄灯闪烁模式（%I0.1 = 1）：取消红绿灯周期，东西与南北四向黄灯同步 1Hz 闪烁警示车辆减速观察通过。',
      '消防应急绿波通道（%I0.3 = 1）：最高业务优先级，强制东西主干道绿灯放行、南北向全红拦截，保障应急特种车辆无阻塞通过。',
      '绿灯冲突故障安全降级（最高安全底线）：实时监测拟输出的 `EW_Green AND NS_Green`（及外部回读触点），一旦出现双绿灯冲突，立即锁存 `Conflict_Fault` 切断全部绿灯，强制降级全向黄闪，必须经维护钥匙 `%I0.4` 人工复位。',
    ],
    ladDiagramText: `// =========================================================================
// TIA Portal LAD 梯形图：绿灯冲突安全监控与 1Hz 硬件时钟闪烁映射
// 说明：勾选 CPU 硬件属性“启用系统与时钟存储器”即可直接使用 "Clock_1Hz" (%M0.5)
// =========================================================================

Network 1: 行人过街优先请求锁存（上升沿置位，进入行人通行相位后复位）
   "Ped_Request_PB"                                      "M_Ped_Latched"
  ----| P |-----------------------------------------------------( S )

Network 2: 绿灯冲突致命故障安全检测器（EW_Green 与 NS_Green 同时为 1 -> 锁存降级！）
   "Tmp_EW_Green"     "Tmp_NS_Green"                     "Conflict_Fault"
  ----| |-----------------| |-----------------------------------( S )

   "Safety_Reset_PB"  "Tmp_EW_Green"  "Tmp_NS_Green"     "Conflict_Fault"
  ----| |-----------------|/|-------------|/|-------------------( R )

Network 3: 最终安全过滤后的绿灯输出（冲突锁存期间绝对封锁绿灯！）
   "Tmp_EW_Green"     "Conflict_Fault"  "NS_Green"       "EW_Green"
  ----| |-----------------|/|---------------|/|-----------------( )

Network 4: 故障安全/夜间模式 1Hz 全向黄灯闪烁
   "Conflict_Fault"                     "Clock_1Hz"      "EW_Yellow"
  ----| |----+-----------------------------| |------------------( )
             |
   "Night_Flash_Sw"
  ----| |----+`,
    sclCode: `FUNCTION_BLOCK "FB_SmartTrafficController"
{ S7_Optimized_Access := 'TRUE' }
VERSION : 0.1
   VAR_INPUT
      iNightFlash    : Bool;         // 夜间黄闪模式 (%I0.1)
      iPedRequestPb  : Bool;         // 行人过街请求按钮 (%I0.2)
      iEmergGreenEw  : Bool;         // 消防应急东西绿波 (%I0.3)
      iSafetyReset   : Bool;         // 冲突安全锁存复位 (%I0.4)
      iClock1Hz      : Bool;         // CPU 系统时钟脉冲 1Hz (%M0.5)
      iEwGreenTime   : Time := T#10s;// 东西绿灯时长
      iNsGreenTime   : Time := T#7s; // 南北绿灯时长
   END_VAR

   VAR_OUTPUT
      qEwRed         : Bool; // 东西红灯 (%Q0.0)
      qEwYellow      : Bool; // 东西黄灯 (%Q0.1)
      qEwGreen       : Bool; // 东西绿灯 (%Q0.2)
      qNsRed         : Bool; // 南北红灯 (%Q0.3)
      qNsYellow      : Bool; // 南北黄灯 (%Q0.4)
      qNsGreen       : Bool; // 南北绿灯 (%Q0.5)
      qPedWalk       : Bool; // 行人通行绿灯 (%Q0.6)
      qConflictFault : Bool; // 绿灯冲突保护动作标志
      qRemainSec     : Int;  // 当前相位倒计时 (秒)
   END_VAR

   VAR
      statPhase      : Int := 10;
      statPedLatch   : Bool := FALSE;
      statConflict   : Bool := FALSE;
      tonPhase       : TON_TIME;
      rTrigPed       : R_TRIG;
   END_VAR

   VAR_TEMP
      tPhasePt       : Time;
      tRawEwR        : Bool;
      tRawEwY        : Bool;
      tRawEwG        : Bool;
      tRawNsR        : Bool;
      tRawNsY        : Bool;
      tRawNsG        : Bool;
      tRawPedWalk    : Bool;
   END_VAR

   VAR_CONSTANT
      PH_EW_GREEN    : Int := 10;
      PH_EW_GBLINK   : Int := 20;
      PH_EW_YELLOW   : Int := 30;
      PH_ALLRED_NS   : Int := 40;
      PH_PED_CROSS   : Int := 45;
      PH_NS_GREEN    : Int := 50;
      PH_NS_GBLINK   : Int := 60;
      PH_NS_YELLOW   : Int := 70;
      PH_ALLRED_EW   : Int := 80;
   END_VAR

BEGIN
   // 1. 锁存行人过街按钮上升沿请求
   #rTrigPed(CLK := #iPedRequestPb);
   IF #rTrigPed.Q THEN
      #statPedLatch := TRUE;
   END_IF;

   // 2. 确定当前相位定时长度
   CASE #statPhase OF
      #PH_EW_GREEN:  #tPhasePt := #iEwGreenTime;
      #PH_EW_GBLINK: #tPhasePt := T#3s;
      #PH_EW_YELLOW: #tPhasePt := T#2s;
      #PH_ALLRED_NS: #tPhasePt := T#1500ms;
      #PH_PED_CROSS: #tPhasePt := T#6500ms;
      #PH_NS_GREEN:  #tPhasePt := #iNsGreenTime;
      #PH_NS_GBLINK: #tPhasePt := T#3s;
      #PH_NS_YELLOW: #tPhasePt := T#2s;
      #PH_ALLRED_EW: #tPhasePt := T#1500ms;
      ELSE           #tPhasePt := T#2s;
   END_CASE;

   // 3. 运行相位定时器（仅在日间正常模式推进，切换瞬间自动复位）
   #tonPhase(
      IN := (NOT #iNightFlash) AND (NOT #iEmergGreenEw) AND (NOT #statConflict) AND (NOT #tonPhase.Q),
      PT := #tPhasePt
   );

   // 4. 日间标准状态机步进转换
   IF #tonPhase.Q THEN
      CASE #statPhase OF
         #PH_EW_GREEN:  #statPhase := #PH_EW_GBLINK;
         #PH_EW_GBLINK: #statPhase := #PH_EW_YELLOW;
         #PH_EW_YELLOW: #statPhase := #PH_ALLRED_NS;
         #PH_ALLRED_NS:
            IF #statPedLatch THEN
               #statPhase    := #PH_PED_CROSS;
               #statPedLatch := FALSE;
            ELSE
               #statPhase := #PH_NS_GREEN;
            END_IF;
         #PH_PED_CROSS: #statPhase := #PH_NS_GREEN;
         #PH_NS_GREEN:  #statPhase := #PH_NS_GBLINK;
         #PH_NS_GBLINK: #statPhase := #PH_NS_YELLOW;
         #PH_NS_YELLOW: #statPhase := #PH_ALLRED_EW;
         #PH_ALLRED_EW: #statPhase := #PH_EW_GREEN;
         ELSE           #statPhase := #PH_EW_GREEN;
      END_CASE;
   END_IF;

   // 5. 计算拟输出灯态（Raw Outputs）
   #tRawEwR := FALSE; #tRawEwY := FALSE; #tRawEwG := FALSE;
   #tRawNsR := FALSE; #tRawNsY := FALSE; #tRawNsG := FALSE;
   #tRawPedWalk := FALSE;

   IF #iNightFlash THEN
      #tRawEwY := #iClock1Hz;
      #tRawNsY := #iClock1Hz;
   ELSIF #iEmergGreenEw THEN
      #tRawEwG := TRUE;
      #tRawNsR := TRUE;
   ELSE
      CASE #statPhase OF
         #PH_EW_GREEN:  #tRawEwG := TRUE;       #tRawNsR := TRUE;
         #PH_EW_GBLINK: #tRawEwG := #iClock1Hz; #tRawNsR := TRUE;
         #PH_EW_YELLOW: #tRawEwY := TRUE;       #tRawNsR := TRUE;
         #PH_ALLRED_NS,
         #PH_ALLRED_EW: #tRawEwR := TRUE;       #tRawNsR := TRUE;
         #PH_PED_CROSS: #tRawEwR := TRUE;       #tRawNsR := TRUE; #tRawPedWalk := TRUE;
         #PH_NS_GREEN:  #tRawEwR := TRUE;       #tRawNsG := TRUE;
         #PH_NS_GBLINK: #tRawEwR := TRUE;       #tRawNsG := #iClock1Hz;
         #PH_NS_YELLOW: #tRawEwR := TRUE;       #tRawNsY := TRUE;
      END_CASE;
   END_IF;

   // 6. 独立绿灯冲突安全检测器 & 故障安全降级输出（Fail-Safe）
   IF #tRawEwG AND #tRawNsG THEN
      #statConflict := TRUE;
   ELSIF #iSafetyReset AND NOT (#tRawEwG AND #tRawNsG) THEN
      #statConflict := FALSE;
   END_IF;

   IF #statConflict THEN
      // 致命冲突降级：彻底切断红绿灯，强制全向 1Hz 黄闪警示！
      #qEwRed    := FALSE;  #qNsRed    := FALSE;
      #qEwGreen  := FALSE;  #qNsGreen  := FALSE;
      #qPedWalk  := FALSE;
      #qEwYellow := #iClock1Hz;
      #qNsYellow := #iClock1Hz;
   ELSE
      #qEwRed    := #tRawEwR;  #qEwYellow := #tRawEwY;  #qEwGreen := #tRawEwG;
      #qNsRed    := #tRawNsR;  #qNsYellow := #tRawNsY;  #qNsGreen := #tRawNsG;
      #qPedWalk  := #tRawPedWalk;
   END_IF;

   #qConflictFault := #statConflict;
   #qRemainSec     := DINT_TO_INT(TIME_TO_DINT(#tPhasePt - #tonPhase.ET) / 1000);
END_FUNCTION_BLOCK`,
    pitfalls: [
      '用 6~8 个 `TON` 定时器首尾相接写红绿灯（最烂可维护性）：一旦交警要求新增“左转箭头相位”或“行人请求插队”，所有定时器串联时间全部错乱，用单一定时器 + `CASE` 状态机修改只需改一行！',
      '黄灯结束立刻切另一方向绿灯（漏掉“全红清空时间”）：现实路口宽 25 米，末尾压黄灯进入路口的车需要 1.5~2 秒才能驶出交叉口，不设全红保护极易引发侧面撞击事故。',
      '迷信“我程序逻辑没 Bug 就不会双绿灯”：继电器触点粘连、在线修改程序误操作或输出点短路都可能导致双绿灯，实际城市信号机强制配备独立硬件“绿冲突检测板”！',
      '在博途里自己写两个定时器凑 1Hz 闪烁方波：西门子 S7-1200/1500 在 CPU 设备组态中勾选“启用时钟存储器字节”即可免费获得 `0.5Hz / 1Hz / 2Hz / 5Hz / 10Hz` 系统标准脉冲，切勿重复造轮子。',
    ],
    interviewPoints: [
      '请对比“定时器串联法”和“状态机步进法（CASE + 单一定时器）”写顺序控制程序的优劣？——状态机法状态互斥天然不会双输出、新增/插队步骤（如行人优先）零耦合、故障定位只需看一个 `statPhase` 整数步号，是所有中大型非标设备的行业绝对标准。',
      '西门子 S7-1200 的“系统存储器字节”与“时钟存储器字节”有什么工程实用价值？——系统存储器提供 `FirstScan`（首次上电初始化脉冲）、`AlwaysTRUE`、`AlwaysFALSE`；时钟存储器直接提供 8 路不同频率的精准方波脉冲（如 `Clock_1Hz` 用于故障灯闪烁与心跳包）。',
      '为什么交通灯或工业机械手的安全联锁不能只靠普通 PLC 程序完成？——普通标准 PLC 不具备安全冗余与自诊断能力（SIL/PL 等级不足），涉及人身生命安全（急停、安全光幕、绿灯冲突）必须采用安全继电器硬回路或西门子 F-CPU（如 1214FC）故障安全系统。',
      '在状态机里当 `tonPhase.Q` 变 TRUE 切到下一步后，为什么上述 SCL 代码把 `IN` 写成 `... AND NOT #tonPhase.Q`？——确保定时器在到达 `PT` 后下一个扫描周期立即收到 1 个周期的低电平复位，重新从 `0ms` 开始为新相位计时！',
    ],
  },
];
