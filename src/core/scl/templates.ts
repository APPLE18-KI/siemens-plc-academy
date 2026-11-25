import { TWIN_RUNTIME_TAG_SPECS, type SclProjectTemplate } from './types';

export const SCL_PROJECT_TEMPLATES: SclProjectTemplate[] = [
  // ─── 1. S7-1200 接线台：启保停自锁 + 光电触发 + 故障报警 ───────────────────────
  {
    id: 'tpl-wiring-seal',
    title: '启保停自锁与故障报警',
    subtitle: '联调 S7-1200 硬件接线台 · 启保停自锁 / 光电触发 / 热继急停红灯',
    difficulty: '入门',
    linkedModelId: 's7-1200-wiring',
    tagDefs: TWIN_RUNTIME_TAG_SPECS['s7-1200-wiring'],
    ob100Code: `// Startup [OB100] - CPU 暖启动初始化
"KM1_Motor" := FALSE;
"HL_Run" := FALSE;
"HL_Fault" := FALSE;
#safetyOK := TRUE;`,
    ob1Code: `REGION 1. 安全回路诊断（急停与热继均为物理常闭 NC，正常=TRUE）
    #safetyOK := "EStop_OK" AND "FR1_OK";
    "HL_Fault" := NOT #safetyOK;
END_REGION

REGION 2. 漫反射光电传感器 BG1 防抖延时触发
    #tonPhoto(IN := "Photo_BG1", PT := T#300ms);
END_REGION

REGION 3. 三相异步电机经典启保停自锁逻辑
    // 启动按钮 SB1 或光电稳定触发启动，KM1 辅助触点实现自锁
    // 停止按钮 SB2 (NC)、急停 (NC) 与热继 (NC) 任意断开立即停机
    "KM1_Motor" := ("Start_PB" OR #tonPhoto.Q OR "KM1_Motor")
                   AND "Stop_PB"
                   AND #safetyOK;

    // 绿色运行指示灯同步反映主接触器 KM1 吸合状态
    "HL_Run" := "KM1_Motor";
END_REGION`,
    guideSteps: [
      '点击工具栏「⬇️ 下载到设备」将 OB1 与 OB100 载入虚拟 S7-1214C CPU，并点亮「👓 监控眼镜」。',
      '在右侧 S7-1200 硬件接线台点击绿色启动按钮 SB1，观察 "KM1_Motor" 吸合自锁、"HL_Run" 亮绿灯。',
      '遮挡漫反射光电传感器 BG1 持续 300ms 以上，观察 #tonPhoto.ET 计时到达后自动启动电机。',
      '拍下红色急停蘑菇头或触发热过载 FR1，验证电机立刻断电停转且 "HL_Fault" 红灯报警点亮。',
    ],
  },

  // ─── 2. 三工位柔性分拣线：G120 调速 + 金属分拣 + 视觉剔除 + CTU 计数 ──────────
  {
    id: 'tpl-sorting-line',
    title: '三工位视觉气动分拣线',
    subtitle: '联调三工位分拣产线 · G120 调速 / 金属延时跟踪 / 视觉次品剔除 / CTU 计数',
    difficulty: '进阶',
    linkedModelId: 'sorting-conveyor',
    tagDefs: TWIN_RUNTIME_TAG_SPECS['sorting-conveyor'],
    ob100Code: `// Startup [OB100] - 分拣线开机初始化
"VFD_Run" := TRUE;
"VFD_FreqRef" := 19354;   // 35.0 Hz 对应 19354 / 27648
"Sol_Cyl1" := FALSE;
"Sol_Cyl2" := FALSE;
"HL_Alarm" := FALSE;
#metalTrack := FALSE;
#defectTrack := FALSE;
#goodCount := 0;`,
    ob1Code: `REGION 1. 急停联锁与 SINAMICS G120 皮带调速控制
    IF NOT "EStop_OK" THEN
        "VFD_Run" := FALSE;
        "VFD_FreqRef" := 0;
        "Sol_Cyl1" := FALSE;
        "Sol_Cyl2" := FALSE;
        "HL_Alarm" := TRUE;
        #metalTrack := FALSE;
        #defectTrack := FALSE;
        RETURN;
    END_IF;

    "VFD_Run" := TRUE;
    "VFD_FreqRef" := 19354;   // 给定 35.0 Hz (0..27648 -> 0..50Hz)
END_REGION

REGION 2. 1# 金属分拣工位（上升沿锁存 + 2.55s 行程延时 + 650ms 气缸脉冲）
    #rTrigMetal(CLK := "Prox_Metal");
    IF #rTrigMetal.Q THEN
        #metalTrack := TRUE;
    END_IF;

    #tonMetalDelay(IN := #metalTrack AND "VFD_Run", PT := T#2550ms);
    #tpCyl1(IN := #tonMetalDelay.Q, PT := T#650ms);

    IF #tonMetalDelay.Q THEN
        #metalTrack := FALSE;
    END_IF;

    "Sol_Cyl1" := #tpCyl1.Q AND "EStop_OK";
END_REGION

REGION 3. 2# 视觉次品剔除工位（次品标志锁存 + 2.50s 延时 + 650ms 气缸脉冲）
    #rTrigDefect(CLK := "Cam_IsDefect");
    IF #rTrigDefect.Q THEN
        #defectTrack := TRUE;
    END_IF;

    #tonDefectDelay(IN := #defectTrack AND "VFD_Run", PT := T#2500ms);
    #tpCyl2(IN := #tonDefectDelay.Q, PT := T#650ms);

    IF #tonDefectDelay.Q THEN
        #defectTrack := FALSE;
    END_IF;

    "Sol_Cyl2" := #tpCyl2.Q AND "EStop_OK";
END_REGION

REGION 4. 气缸卡阻/堵料看门狗报警与合格品 CTU 计数
    #tonCyl1Jam(IN := "Sol_Cyl1" AND NOT "Cyl1_Ext", PT := T#1200ms);
    #tonInfeedJam(IN := "PE_Infeed" AND "VFD_Run", PT := T#3000ms);
    "HL_Alarm" := (NOT "EStop_OK") OR #tonCyl1Jam.Q OR #tonInfeedJam.Q;

    // 末端合格品入箱光电上升沿增计数（批次目标 100 件）
    #ctuGood(CU := "PE_EndBox", R := NOT "EStop_OK", PV := 100);
    #goodCount := #ctuGood.CV;
END_REGION`,
    guideSteps: [
      '点击「⬇️ 下载到设备」启动分拣程序，右侧产线皮带将按 35.0 Hz ("VFD_FreqRef"=19354) 匀速运转。',
      '观察银色金属件经过电感接近开关 "Prox_Metal" 后，#tonMetalDelay 精准跟踪 2.55s 触发 1# 气缸推出。',
      '观察红色次品件经过视觉相机 "Cam_IsDefect" 后，#tonDefectDelay 跟踪 2.50s 触发 2# 气缸剔除；塑料合格品直达末端使 #ctuGood.CV 加 1。',
      '尝试在右侧注入「急停」或「1# 气缸卡阻」故障，或修改 "VFD_FreqRef" 观察皮带速度与跟踪节拍变化。',
    ],
  },

  // ─── 3. 双泵恒压供水 PID 储罐：断线保护 + NORM_X/SCALE_X + PI 闭环 + 副泵投切 ─
  {
    id: 'tpl-tank-pi',
    title: '双泵恒压供水 PI 闭环控制',
    subtitle: '联调双泵 PID 储罐 · 4-20mA 断线诊断 / NORM_X / SCALE_X / PI 抗饱和 / 副泵投切',
    difficulty: '综合',
    linkedModelId: 'tank-pressure-pid',
    tagDefs: TWIN_RUNTIME_TAG_SPECS['tank-pressure-pid'],
    ob100Code: `// Startup [OB100] - PI 控制器与工艺设定值初始化
#spLevel := 65.0;       // 目标液位设定值 65.0%
#kp := 2.6;             // 比例增益 Kp
#ki := 0.55;            // 积分系数 Ki
#integral := 40.0;      // 积分初值，缩短开机爬坡时间
#auxLatched := FALSE;
"Pump1_Run" := TRUE;
"Pump2_Aux" := FALSE;
"Heater_SSR" := FALSE;
"AO_Pump1_Spd" := 13824;`,
    ob1Code: `REGION 1. 4-20mA 模拟量断线检测与工程量标定 (NORM_X + SCALE_X)
    // 西门子 S7-1200 4-20mA 变送器断线时原始值 < 0（典型 -32768 或 -3456）
    #wireBreak := "AI_Level_Raw" < 0;

    #normLevel := NORM_X(MIN := 0, VALUE := "AI_Level_Raw", MAX := 27648);
    #levelPct := SCALE_X(MIN := 0.0, VALUE := #normLevel, MAX := 100.0);

    #normTemp := NORM_X(MIN := 0, VALUE := "AI_Temp_Raw", MAX := 27648);
    #tempC := SCALE_X(MIN := 0.0, VALUE := #normTemp, MAX := 100.0);
END_REGION

REGION 2. 安全最高优先级：断线或高高液位溢流联锁切泵
    IF #wireBreak OR "HH_Switch" THEN
        "Pump1_Run" := FALSE;
        "Pump2_Aux" := FALSE;
        "Heater_SSR" := FALSE;
        "AO_Pump1_Spd" := 0;
        #auxLatched := FALSE;
        RETURN;
    END_IF;
END_REGION

REGION 3. PI 比例积分闭环计算 1# 主变频水泵转速给定 (50ms 周期)
    #err := #spLevel - #levelPct;
    #integral := LIMIT(MN := 0.0, IN := #integral + #err * #ki * 0.05, MX := 75.0);
    #pidOut := LIMIT(MN := 0.0, IN := #kp * #err + #integral, MX := 100.0);

    IF "Pump1_OK" THEN
        "Pump1_Run" := TRUE;
        "AO_Pump1_Spd" := REAL_TO_INT(SCALE_X(MIN := 0.0, VALUE := #pidOut / 100.0, MAX := 27648.0));
    ELSE
        // 1# 主泵热过载跳闸：切停主泵，交由 2# 副泵应急供水
        "Pump1_Run" := FALSE;
        "AO_Pump1_Spd" := 0;
    END_IF;
END_REGION

REGION 4. 低液位/高负荷自动投切 2# 副泵 + 防干烧水温滞环控制
    #tonAuxOn(IN := (#levelPct < 45.0) OR (#pidOut > 85.0), PT := T#1500ms);
    #tonAuxOff(IN := (#levelPct > 62.0) AND (#pidOut < 40.0), PT := T#1500ms);

    IF #tonAuxOn.Q THEN
        #auxLatched := TRUE;
    END_IF;
    IF #tonAuxOff.Q THEN
        #auxLatched := FALSE;
    END_IF;

    IF NOT "Pump1_OK" THEN
        "Pump2_Aux" := #levelPct < (#spLevel + 2.0);
    ELSE
        "Pump2_Aux" := #auxLatched;
    END_IF;

    // 储罐电加热防干烧保护（液位 > 20%）与 55°C ±1.5°C 滞环控温
    IF #levelPct <= 20.0 THEN
        "Heater_SSR" := FALSE;
    ELSIF #tempC < 53.5 THEN
        "Heater_SSR" := TRUE;
    ELSIF #tempC > 56.5 THEN
        "Heater_SSR" := FALSE;
    END_IF;
END_REGION`,
    guideSteps: [
      '下载程序并开启监控眼镜，观察 #levelPct 通过 PI 闭环平滑收敛到设定值 #spLevel (65.0%)。',
      '调大右侧「出水负荷阀门开度」至 80% 以上，观察 #pidOut 攀升并延时 1.5s 自动投入 2# 副泵 "Pump2_Aux"。',
      '点击右侧注入「4-20mA 液位传感器断线」故障，观察 #wireBreak=TRUE 立刻触发 RETURN 急停双泵与加热管。',
      '尝试修改 OB100 中的 #spLevel（如 75.0）或 #kp，重新下载并勾选「执行 OB100 暖启动」观察响应曲线变化。',
    ],
  },

  // ─── 4. 智能十字路口红绿灯：CASE 状态机 + 全红清空 + 行人优先 + 夜间 + 消防 ──
  {
    id: 'tpl-traffic-fsm',
    title: '智能十字路口红绿灯状态机',
    subtitle: '联调十字路口孪生 · CASE #step 状态机 / 1.5s 全红清空 / 行人优先 / 黄闪 / 消防绿波',
    difficulty: '综合',
    linkedModelId: 'traffic-intersection',
    tagDefs: TWIN_RUNTIME_TAG_SPECS['traffic-intersection'],
    ob100Code: `// Startup [OB100] - 交通灯状态机初始化
#step := 0;
#prevStep := -1;
#phaseTime := T#7s;
#pedLatched := FALSE;
#blinkState := FALSE;`,
    ob1Code: `REGION 1. 公共 1Hz 闪烁发生器与斑马线行人请求锁存
    #tonBlink(IN := NOT #tonBlink.Q, PT := T#500ms);
    IF #tonBlink.Q THEN
        #blinkState := NOT #blinkState;
    END_IF;

    IF "Ped_Request" THEN
        #pedLatched := TRUE;
    END_IF;
END_REGION

REGION 2. 特殊工况高优先级接管：消防绿波 > 夜间黄闪
    IF "Emerg_Green" THEN
        // 消防车东西向紧急绿波通行，南北强制红灯
        "EW_Red" := FALSE;  "EW_Yellow" := FALSE;  "EW_Green" := TRUE;
        "NS_Red" := TRUE;   "NS_Yellow" := FALSE;  "NS_Green" := FALSE;
        "Ped_Walk" := FALSE;
        RETURN;
    END_IF;

    IF "Night_Mode" THEN
        // 夜间低流量双黄灯警示闪烁
        "EW_Red" := FALSE;  "EW_Yellow" := #blinkState;  "EW_Green" := FALSE;
        "NS_Red" := FALSE;  "NS_Yellow" := #blinkState;  "NS_Green" := FALSE;
        "Ped_Walk" := FALSE;
        RETURN;
    END_IF;
END_REGION

REGION 3. 相位步序定时器（切步单周期自动清零，防越步连跳）
    #stepChanged := #step <> #prevStep;
    #prevStep := #step;
    #tonPhase(IN := NOT #stepChanged, PT := #phaseTime);
END_REGION

REGION 4. CASE #step 四向相位状态机（严格互锁 + 1.5s 全红清空）
    // 每周期先复位全部灯输出，再由当前激活步序唯一点亮，杜绝双绿冲突
    "EW_Red" := FALSE;  "EW_Yellow" := FALSE;  "EW_Green" := FALSE;
    "NS_Red" := FALSE;  "NS_Yellow" := FALSE;  "NS_Green" := FALSE;
    "Ped_Walk" := FALSE;

    CASE #step OF
        0:  // 东西主干道绿灯放行 7s
            "EW_Green" := TRUE;
            "NS_Red" := TRUE;
            #phaseTime := T#7s;
            IF #tonPhase.Q THEN #step := 10; END_IF;

        10: // 东西绿灯闪烁清尾 2s
            "EW_Green" := #blinkState;
            "NS_Red" := TRUE;
            #phaseTime := T#2s;
            IF #tonPhase.Q THEN #step := 20; END_IF;

        20: // 东西黄灯 2s
            "EW_Yellow" := TRUE;
            "NS_Red" := TRUE;
            #phaseTime := T#2s;
            IF #tonPhase.Q THEN #step := 30; END_IF;

        30: // 1.5s 全红清空保护区（消除抢黄灯碰撞风险）
            "EW_Red" := TRUE;
            "NS_Red" := TRUE;
            #phaseTime := T#1s500ms;
            IF #tonPhase.Q THEN
                IF #pedLatched THEN
                    #step := 80;
                ELSE
                    #step := 40;
                END_IF;
            END_IF;

        40: // 南北次干道绿灯放行 5s
            "EW_Red" := TRUE;
            "NS_Green" := TRUE;
            #phaseTime := T#5s;
            IF #tonPhase.Q THEN #step := 50; END_IF;

        50: // 南北绿灯闪烁清尾 2s
            "EW_Red" := TRUE;
            "NS_Green" := #blinkState;
            #phaseTime := T#2s;
            IF #tonPhase.Q THEN #step := 60; END_IF;

        60: // 南北黄灯 2s
            "EW_Red" := TRUE;
            "NS_Yellow" := TRUE;
            #phaseTime := T#2s;
            IF #tonPhase.Q THEN #step := 70; END_IF;

        70: // 1.5s 全红清空保护区
            "EW_Red" := TRUE;
            "NS_Red" := TRUE;
            #phaseTime := T#1s500ms;
            IF #tonPhase.Q THEN
                IF #pedLatched THEN
                    #step := 80;
                ELSE
                    #step := 0;
                END_IF;
            END_IF;

        80: // 行人过街专享绿灯 5s，四向机动车全红
            "EW_Red" := TRUE;
            "NS_Red" := TRUE;
            "Ped_Walk" := TRUE;
            #phaseTime := T#5s;
            IF #tonPhase.Q THEN
                #pedLatched := FALSE;
                #step := 0;
            END_IF;

        ELSE
            #step := 0;
    END_CASE;
END_REGION`,
    guideSteps: [
      '下载程序并开启监控眼镜，观察 CASE #step 依次按 0→10→20→30→40→50→60→70 循环，仅当前分支亮起绿条。',
      '点击右侧「行人过街请求」，观察 #pedLatched 锁存，在最近一次 1.5s 全红清空后自动插入步序 80 点亮 "Ped_Walk"。',
      '切换「夜间黄闪」或「消防绿波」，验证 REGION 2 高优先级接管立即生效。',
      '【安全实验】试着在步序 0 中故意把 "NS_Green" 也改成 TRUE 再下载，体验右侧硬件绿灯冲突安全继电器如何强行降级保护！',
    ],
  },

  // ─── 5. 纯虚拟 I/O 台：电机星三角 Y-Δ 降压启动（含 100ms 换相灭弧死区） ────────
  {
    id: 'tpl-star-delta',
    title: '电机星三角 (Y-Δ) 降压启动',
    subtitle: '虚拟 I/O 开关台 · 4s 星形降压 + 100ms 换相灭弧死区 + 接触器互锁',
    difficulty: '进阶',
    tagDefs: [
      { name: 'Start_PB', address: '%I0.0', type: 'Bool', area: 'I', init: false, comment: '启动按钮 SB1 (NO)' },
      { name: 'Stop_PB', address: '%I0.1', type: 'Bool', area: 'I', init: true, comment: '停止按钮 SB2 (常闭 NC，正常=TRUE)' },
      { name: 'FR_OK', address: '%I0.2', type: 'Bool', area: 'I', init: true, comment: '热过载继电器常闭触点 (正常=TRUE)' },
      { name: 'KM_Main', address: '%Q0.0', type: 'Bool', area: 'Q', init: false, comment: '主电源接触器 KM1' },
      { name: 'KM_Star', address: '%Q0.1', type: 'Bool', area: 'Q', init: false, comment: '星形 (Y) 启动接触器 KM2' },
      { name: 'KM_Delta', address: '%Q0.2', type: 'Bool', area: 'Q', init: false, comment: '三角形 (Δ) 全压运行接触器 KM3' },
      { name: 'HL_DeltaRun', address: '%Q0.3', type: 'Bool', area: 'Q', init: false, comment: '全压三角运行绿灯' },
      { name: 'HL_Fault', address: '%Q0.4', type: 'Bool', area: 'Q', init: false, comment: '热过载故障红灯' },
      { name: 'Step_Code', address: '%MW10', type: 'Int', area: 'M', init: 0, comment: '状态步码 (0待机/10星启/20灭弧/30三角)' },
    ],
    ob100Code: `// Startup [OB100] - 上电安全复位全部接触器
#step := 0;
#prevStep := -1;
#phaseTime := T#4s;
"KM_Main" := FALSE;
"KM_Star" := FALSE;
"KM_Delta" := FALSE;
"HL_DeltaRun" := FALSE;
"HL_Fault" := FALSE;
"Step_Code" := 0;`,
    ob1Code: `REGION 1. 停止按钮与热过载保护（任意断开立即回 0 步停机）
    "HL_Fault" := NOT "FR_OK";
    IF (NOT "Stop_PB") OR (NOT "FR_OK") THEN
        #step := 0;
    END_IF;
END_REGION

REGION 2. 步序切换定时器
    #stepChanged := #step <> #prevStep;
    #prevStep := #step;
    #tonStep(IN := NOT #stepChanged, PT := #phaseTime);
END_REGION

REGION 3. Y-Δ 降压启动四步状态机（含 100ms 换相灭弧死区）
    "KM_Main" := FALSE;
    "KM_Star" := FALSE;
    "KM_Delta" := FALSE;
    "HL_DeltaRun" := FALSE;

    CASE #step OF
        0:  // 待机停止态
            IF "Start_PB" AND "Stop_PB" AND "FR_OK" THEN
                #step := 10;
            END_IF;

        10: // 星形 (Y) 降压启动 4s（启动电流降至全压的 1/3）
            "KM_Main" := TRUE;
            "KM_Star" := TRUE;
            #phaseTime := T#4s;
            IF #tonStep.Q THEN
                #step := 20;
            END_IF;

        20: // 100ms 换相灭弧死区：先断开 KM_Star 熄弧，严禁与 KM_Delta 同时吸合！
            "KM_Main" := TRUE;
            #phaseTime := T#100ms;
            IF #tonStep.Q THEN
                #step := 30;
            END_IF;

        30: // 三角形 (Δ) 全压正常运行
            "KM_Main" := TRUE;
            "KM_Delta" := TRUE;
            "HL_DeltaRun" := TRUE;

        ELSE
            #step := 0;
    END_CASE;

    // 软件双接触器绝对互锁兜底
    IF "KM_Star" AND "KM_Delta" THEN
        "KM_Star" := FALSE;
        "KM_Delta" := FALSE;
    END_IF;

    "Step_Code" := #step;
END_REGION`,
    guideSteps: [
      '下载程序并在右侧「虚拟 I/O 拨码箱」保持 Stop_PB=TRUE、FR_OK=TRUE，点按 Start_PB (%I0.0)。',
      '观察波形图与状态灯：KM_Main 与 KM_Star 先吸合 4 秒 (Step_Code=10)。',
      '4 秒后进入 100ms 灭弧死区 (Step_Code=20，KM_Star 先断开)，随后 KM_Delta 吸合并点亮 HL_DeltaRun (Step_Code=30)。',
      '断开 Stop_PB 或 FR_OK，验证所有接触器立即释放且过载时点亮 HL_Fault 红灯。',
    ],
  },

  // ─── 6. 空白自由实训项目 ──────────────────────────────────────────────────────
  {
    id: 'tpl-blank-custom',
    title: '空白自由 SCL 实训工程',
    subtitle: '自定义 PLC 变量表 · 手写任意西门子 TIA Portal SCL 算法与仿真验证',
    difficulty: '入门',
    tagDefs: [
      { name: 'DI_0', address: '%I0.0', type: 'Bool', area: 'I', init: false, comment: '数字量输入 0（启动/测试开关）' },
      { name: 'DI_1', address: '%I0.1', type: 'Bool', area: 'I', init: false, comment: '数字量输入 1（复位/条件开关）' },
      { name: 'AI_0', address: '%IW64', type: 'Int', area: 'I', init: 13824, unit: 'raw', comment: '模拟量输入 0 (0~27648)' },
      { name: 'DO_0', address: '%Q0.0', type: 'Bool', area: 'Q', init: false, comment: '数字量输出 0（指示灯/线圈）' },
      { name: 'DO_1', address: '%Q0.1', type: 'Bool', area: 'Q', init: false, comment: '数字量输出 1（延时输出）' },
      { name: 'AO_0', address: '%QW80', type: 'Int', area: 'Q', init: 0, unit: 'raw', comment: '模拟量输出 0 (0~27648)' },
      { name: 'MW_Percent', address: '%MW10', type: 'Int', area: 'M', init: 0, unit: '%', comment: '模拟量标定百分比结果 (0~100%)' },
    ],
    ob100Code: `// Startup [OB100] - 在此编写上电初始化代码
"DO_0" := FALSE;
"DO_1" := FALSE;
"AO_0" := 0;
"MW_Percent" := 0;`,
    ob1Code: `REGION 自由实验区（可清空后编写任意西门子 SCL 代码）
    // 1. 直接开关控制与 2 秒接通延时示例
    "DO_0" := "DI_0" AND NOT "DI_1";
    #tonDemo(IN := "DI_0", PT := T#2s);
    "DO_1" := #tonDemo.Q;

    // 2. 模拟量 0..27648 线性标定为 0..100%
    #normVal := NORM_X(MIN := 0, VALUE := "AI_0", MAX := 27648);
    #pctVal := SCALE_X(MIN := 0.0, VALUE := #normVal, MAX := 100.0);
    "MW_Percent" := REAL_TO_INT(#pctVal);
    "AO_0" := LIMIT(MN := 0, IN := "AI_0", MX := 27648);
END_REGION`,
    guideSteps: [
      '在左侧「PLC 变量表」中自由新增自己的 %I / %Q / %M / %MW 变量。',
      '使用编辑器上方快捷指令栏快速编写 IF / CASE / FOR / TON / CTU / R_TRIG / NORM_X 等 SCL 代码。',
      '点击「🔨 编译」检查语法，点击「⬇️ 下载到设备」并在右侧虚拟 I/O 箱实时拨动开关与滑块验证结果！',
    ],
  },
];
