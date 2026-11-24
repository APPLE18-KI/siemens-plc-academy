export interface CapstoneSourceFile {
  id: string;
  folder: 'types' | 'blocks' | 'tags' | 'docs';
  fileName: string;
  diskPath: string;
  lang: 'scl' | 'csv' | 'md';
  importOrder: string;
  summary: string;
  content: string;
}

export const CAPSTONE_SOURCE_FILES: CapstoneSourceFile[] = [
  {
    id: 'udt',
    folder: 'types',
    fileName: 'UDT_ModuleRecipeAndStation.scl',
    diskPath: 'capstone/tia-portal-project/types/UDT_ModuleRecipeAndStation.scl',
    lang: 'scl',
    importOrder: '第 1 步导入 (UDT & Global DB)',
    summary: '定义锂电配方、4×3 立体库仓位、标准化报警字与启用变量级 RETAIN 掉电保持的 DB_StationGlobal。',
    content: `// ============================================================================
// 文件名: UDT_ModuleRecipeAndStation.scl
// 工程名: 新能源锂电模组柔性视觉分拣、热压恒温固化与立体入库工作站
// 目标CPU: SIMATIC S7-1215C DC/DC/DC (6ES7 215-1AG40-0XB0, TIA Portal V18/V19)
// 导入顺序: 第 1 步 (须在所有 FB/OB 之前通过“外部源文件 → 从源生成块”导入!)
// ============================================================================

TYPE "UDT_ModuleRecipe"
VERSION : 0.1
   STRUCT
      RecipeID : Int := 1;                     // 配方编号 (1=LFP-100Ah, 2=NCM-150Ah, 3=CTP-280Ah)
      RecipeName : String[24] := 'LFP-100Ah';  // 模组型号名称
      TargetTemp_C : Real := 85.0;             // 热压腔目标温度 (°C)
      TempTolerance_C : Real := 0.5;           // 恒温允许偏差 (±°C)
      OverTempLimit_C : Real := 95.0;          // 硬件/软件联锁超温急停阈值 (°C)
      PressHoldTime : Time := T#5s;            // 热压恒温保压时间
      ConveyorSpeed_Pct : Real := 65.0;        // G120 进料皮带设定转速 (%)
      MaxInternalRes_mOhm : Real := 0.45;      // 视觉/测厚与内阻判定上限 (mΩ)
      BatchTargetQty : DInt := 12;             // 单批立体库目标入库件数
   END_STRUCT;
END_TYPE

TYPE "UDT_WarehouseSlot"
VERSION : 0.1
   STRUCT
      Occupied : Bool := FALSE;                // 仓位占用标志 (TRUE=有托盘, FALSE=空仓)
      Locked : Bool := FALSE;                  // 人工维护禁用标志
      ModuleBarcode : String[20] := '';        // 锂电模组唯一追溯条码
      QualityGrade : Int := 0;                 // 视觉分级 (1=A级优品, 2=B级良配, 9=NG废品)
      PressPeakTemp_C : Real := 0.0;           // 本件热压实测峰值温度 (°C)
      RowIndex : Int := 1;                     // 层号 Z (1..3)
      ColIndex : Int := 1;                     // 列号 X (1..4)
      PosX_mm : Real := 0.0;                   // V90 X轴绝对定位目标坐标 (mm)
      PosZ_mm : Real := 0.0;                   // V90 Z轴绝对定位目标坐标 (mm)
      EntryTimestamp : String[20] := '';       // 入库时间戳字符串
   END_STRUCT;
END_TYPE

TYPE "UDT_StationAlarmWord"
VERSION : 0.1
   STRUCT
      EStopPressed : Bool;                     // [ALM-001] 急停回路断开
      SafetyDoorOpen : Bool;                   // [ALM-002] 防护安全门在自动态被打开
      AirPressureLow : Bool;                   // [ALM-003] 压缩空气气源压力低于 0.45MPa
      CylClamp_Timeout : Bool;                 // [ALM-004] 阻挡夹紧气缸动作超时
      CylClamp_SensorConflict : Bool;          // [ALM-005] 阻挡夹紧气缸双磁簧互斥故障
      CylPress_Timeout : Bool;                 // [ALM-006] 热压下压气缸动作超时
      G120_DriveFault : Bool;                  // [ALM-007] SINAMICS G120 变频器报警
      V90_AxisNotHomed : Bool;                 // [ALM-008] V90 立体库 X/Z 伺服未回零
      Thermal_OverTemp : Bool;                 // [ALM-009] 热压腔超温联锁停机 (>95°C)
      Thermal_SensorBroken : Bool;             // [ALM-010] PT100 温度传感器断线/溢出
      Vision_CommTimeout : Bool;               // [ALM-011] 智能视觉相机触发超时
      ASRS_WarehouseFull : Bool;               // [ALM-012] 4×3 立体库无可用空仓位
   END_STRUCT;
END_TYPE

TYPE "UDT_StationHMI"
VERSION : 0.1
   STRUCT
      Cmd_AutoMode : Bool;
      Cmd_Reset : Bool;
      Cmd_Start : Bool;
      Cmd_Hold : Bool;
      Cmd_Unhold : Bool;
      Cmd_Stop : Bool;
      Cmd_AlarmAck : Bool;
      Cmd_ClearWarehouse : Bool;
      PackML_State : Int;
      Grafcet_Step : Int;
      ActTemp_C : Real;
      PID_Output_Pct : Real;
      TotalProduced : DInt;
      GoodCount : DInt;
      RejectCount : DInt;
      CycleTime_Sec : Real;
      ActiveBarcode : String[20];
      Alarms : "UDT_StationAlarmWord";
   END_STRUCT;
END_TYPE

DATA_BLOCK "DB_StationGlobal"
{ S7_Optimized_Access := 'TRUE' }
VERSION : 0.1
NON_RETAIN
   VAR
      ActiveRecipe RETAIN : "UDT_ModuleRecipe";
      WarehouseSlots RETAIN : Array[1..12] of "UDT_WarehouseSlot";
      HMI : "UDT_StationHMI";
      SysFirstScanDone : Bool := FALSE;
   END_VAR
BEGIN
END_DATA_BLOCK`,
  },
  {
    id: 'fb-cyl',
    folder: 'blocks',
    fileName: 'FB_Cylinder2Pos.scl',
    diskPath: 'capstone/tia-portal-project/blocks/FB_Cylinder2Pos.scl',
    lang: 'scl',
    importOrder: '第 2 步导入 (基础设备 FB)',
    summary: '支持多重背景的标准化双位气缸功能块：含手自动切换、伸出/退回超时报警及 150ms 双磁簧互斥粘连保护。',
    content: `FUNCTION_BLOCK "FB_Cylinder2Pos"
{ S7_Optimized_Access := 'TRUE' }
VERSION : 0.1
   VAR_INPUT
      iEnable : Bool := TRUE;
      iAutoMode : Bool := FALSE;
      iAutoCmd_Adv : Bool := FALSE;
      iAutoCmd_Ret : Bool := FALSE;
      iManCmd_Adv : Bool := FALSE;
      iManCmd_Ret : Bool := FALSE;
      iInterlock_Adv : Bool := TRUE;
      iInterlock_Ret : Bool := TRUE;
      iSensor_Adv : Bool := FALSE;
      iSensor_Ret : Bool := FALSE;
      iAlarmReset : Bool := FALSE;
      iTimeout_Adv : Time := T#3s;
      iTimeout_Ret : Time := T#3s;
   END_VAR
   VAR_OUTPUT
      qValve_Adv : Bool;
      qValve_Ret : Bool;
      qIsAtAdv : Bool;
      qIsAtRet : Bool;
      qFault : Bool;
      qFaultCode : Int; // 0=正常, 101=伸出超时, 102=退回超时, 103=双传感器互斥粘连
   END_VAR
   VAR
      statCmdAdv : Bool := FALSE;
      statFaultAdvTimeout : Bool := FALSE;
      statFaultRetTimeout : Bool := FALSE;
      statFaultConflict : Bool := FALSE;
      instTON_Adv { InstructionName := 'TON_TIME'; LibVersion := '1.0' } : TON_TIME;
      instTON_Ret { InstructionName := 'TON_TIME'; LibVersion := '1.0' } : TON_TIME;
      instTON_Conflict { InstructionName := 'TON_TIME'; LibVersion := '1.0' } : TON_TIME;
   END_VAR
   VAR_TEMP
      tempReqAdv : Bool;
      tempReqRet : Bool;
   END_VAR
BEGIN
   IF #iAlarmReset THEN
       #statFaultAdvTimeout := FALSE;
       #statFaultRetTimeout := FALSE;
       #statFaultConflict := FALSE;
   END_IF;

   // 双磁簧传感器同时导通防呆检测 (滤波 150ms 抗抖动)
   #instTON_Conflict(IN := (#iSensor_Adv AND #iSensor_Ret), PT := T#150ms);
   IF #instTON_Conflict.Q THEN
       #statFaultConflict := TRUE;
   END_IF;

   IF #iAutoMode THEN
       #tempReqAdv := #iAutoCmd_Adv AND NOT #iAutoCmd_Ret;
       #tempReqRet := #iAutoCmd_Ret;
   ELSE
       #tempReqAdv := #iManCmd_Adv AND NOT #iManCmd_Ret;
       #tempReqRet := #iManCmd_Ret;
   END_IF;

   IF #iEnable AND NOT #qFault THEN
       IF #tempReqAdv AND #iInterlock_Adv THEN
           #statCmdAdv := TRUE;
       ELSIF #tempReqRet AND #iInterlock_Ret THEN
           #statCmdAdv := FALSE;
       END_IF;
   END_IF;

   IF #iEnable AND NOT #statFaultConflict THEN
       #qValve_Adv := #statCmdAdv AND #iInterlock_Adv;
       #qValve_Ret := (NOT #statCmdAdv) AND #iInterlock_Ret;
   ELSE
       #qValve_Adv := FALSE;
       #qValve_Ret := FALSE;
   END_IF;

   #instTON_Adv(IN := (#qValve_Adv AND NOT #iSensor_Adv), PT := #iTimeout_Adv);
   IF #instTON_Adv.Q THEN #statFaultAdvTimeout := TRUE; END_IF;

   #instTON_Ret(IN := (#qValve_Ret AND NOT #iSensor_Ret), PT := #iTimeout_Ret);
   IF #instTON_Ret.Q THEN #statFaultRetTimeout := TRUE; END_IF;

   #qIsAtAdv := #iSensor_Adv AND NOT #iSensor_Ret AND NOT #statFaultConflict;
   #qIsAtRet := #iSensor_Ret AND NOT #iSensor_Adv AND NOT #statFaultConflict;

   IF #statFaultConflict THEN
       #qFault := TRUE; #qFaultCode := 103;
   ELSIF #statFaultAdvTimeout THEN
       #qFault := TRUE; #qFaultCode := 101;
   ELSIF #statFaultRetTimeout THEN
       #qFault := TRUE; #qFaultCode := 102;
   ELSE
       #qFault := FALSE; #qFaultCode := 0;
   END_IF;
END_FUNCTION_BLOCK`,
  },
  {
    id: 'fb-drive',
    folder: 'blocks',
    fileName: 'FB_SinamicsDrive_Tel1.scl',
    diskPath: 'capstone/tia-portal-project/blocks/FB_SinamicsDrive_Tel1.scl',
    lang: 'scl',
    importOrder: '第 2 步导入 (基础设备 FB)',
    summary: 'SINAMICS G120 PROFINET 标准报文 1 (2 PZD) 驱动封装块：STW1/ZSW1 解析与 16#4000 满量程速度标定。',
    content: `FUNCTION_BLOCK "FB_SinamicsDrive_Tel1"
{ S7_Optimized_Access := 'TRUE' }
VERSION : 0.1
   VAR_INPUT
      iSafety_OK : Bool := FALSE;
      iRunCmd : Bool := FALSE;
      iReverse : Bool := FALSE;
      iFaultAck : Bool := FALSE;
      iSpeedSetpoint_Pct : Real := 0.0;
      iPZD_ZSW1 : Word := 16#0000;
      iPZD_NIST_A : Int := 0;
   END_VAR
   VAR_OUTPUT
      qPZD_STW1 : Word;
      qPZD_NSOLL_A : Int;
      qReady : Bool;
      qRunning : Bool;
      qDriveFault : Bool;
      qDriveWarn : Bool;
      qActSpeed_Pct : Real;
   END_VAR
   VAR_TEMP
      tempClampedPct : Real;
      tempRawSpeed : Int;
      tempStw1 : Word;
   END_VAR
BEGIN
   #qReady := #iPZD_ZSW1.%X0 AND #iPZD_ZSW1.%X1;
   #qRunning := #iPZD_ZSW1.%X2;
   #qDriveFault := #iPZD_ZSW1.%X3;
   #qDriveWarn := #iPZD_ZSW1.%X7;
   #qActSpeed_Pct := (INT_TO_REAL(#iPZD_NIST_A) / 16384.0) * 100.0;

   #tempClampedPct := #iSpeedSetpoint_Pct;
   IF #tempClampedPct > 100.0 THEN #tempClampedPct := 100.0;
   ELSIF #tempClampedPct < 0.0 THEN #tempClampedPct := 0.0; END_IF;

   #tempRawSpeed := REAL_TO_INT((#tempClampedPct / 100.0) * 16384.0);
   IF #iReverse THEN #tempRawSpeed := -#tempRawSpeed; END_IF;

   IF NOT #iSafety_OK THEN
       #tempStw1 := 16#0400;
       #qPZD_NSOLL_A := 0;
   ELSIF #iFaultAck AND #qDriveFault THEN
       #tempStw1 := 16#04FE;
       #qPZD_NSOLL_A := 0;
   ELSIF #iRunCmd AND NOT #qDriveFault THEN
       #tempStw1 := 16#047F;
       #qPZD_NSOLL_A := #tempRawSpeed;
   ELSE
       #tempStw1 := 16#047E;
       #qPZD_NSOLL_A := 0;
   END_IF;

   #qPZD_STW1 := #tempStw1;
END_FUNCTION_BLOCK`,
  },
  {
    id: 'fb-pid',
    folder: 'blocks',
    fileName: 'FB_ThermalPress_PID.scl',
    diskPath: 'capstone/tia-portal-project/blocks/FB_ThermalPress_PID.scl',
    lang: 'scl',
    importOrder: '第 2 步导入 (OB30 温控 FB)',
    summary: '热压恒温固化腔闭环温控块：PT100 断线检测、抗积分饱和 PI、1.0s SSR PWM 调制及 5°C 回差超温锁存。',
    content: `FUNCTION_BLOCK "FB_ThermalPress_PID"
{ S7_Optimized_Access := 'TRUE' }
VERSION : 0.1
   VAR_INPUT
      iEnable : Bool := FALSE;
      iSafety_OK : Bool := FALSE;
      iRawPT100 : Int := 250;                  // %IW96, 单位 0.1°C
      iSetpoint_C : Real := 85.0;
      iTolerance_C : Real := 0.5;
      iOverTempLimit_C : Real := 95.0;
      iAlarmReset : Bool := FALSE;
      iKp : Real := 6.5;
      iKi : Real := 0.35;
      iSampleTime_s : Real := 0.1;             // OB30 固定周期 100ms
   END_VAR
   VAR_OUTPUT
      qActTemp_C : Real;
      qPID_Out_Pct : Real;
      qHeaterPWM_Out : Bool;
      qTempReady : Bool;
      qOverTempFault : Bool;
      qSensorFault : Bool;
   END_VAR
   VAR
      statFilteredTemp : Real := 25.0;
      statIntegral : Real := 0.0;
      statOverTempLatch : Bool := FALSE;
      statPwmAccum_s : Real := 0.0;
      instTON_TempStable { InstructionName := 'TON_TIME'; LibVersion := '1.0' } : TON_TIME;
   END_VAR
   VAR_TEMP
      tempRawC : Real;
      tempError : Real;
      tempOut : Real;
   END_VAR
BEGIN
   IF (#iRawPT100 >= 32760) OR (#iRawPT100 <= -32760) THEN
       #qSensorFault := TRUE;
   ELSE
       #qSensorFault := FALSE;
       #tempRawC := INT_TO_REAL(#iRawPT100) / 10.0;
       #statFilteredTemp := #statFilteredTemp + 0.25 * (#tempRawC - #statFilteredTemp);
   END_IF;
   #qActTemp_C := #statFilteredTemp;

   // 超温安全联锁锁存 + 5.0°C 降温回差人工复位
   IF (#qActTemp_C >= #iOverTempLimit_C) OR #qSensorFault THEN
       #statOverTempLatch := TRUE;
   ELSIF #iAlarmReset AND (#qActTemp_C < (#iOverTempLimit_C - 5.0)) AND NOT #qSensorFault THEN
       #statOverTempLatch := FALSE;
   END_IF;
   #qOverTempFault := #statOverTempLatch;

   IF #iEnable AND #iSafety_OK AND NOT #statOverTempLatch AND NOT #qSensorFault THEN
       #tempError := #iSetpoint_C - #qActTemp_C;
       #tempOut := (#iKp * #tempError) + #statIntegral;
       IF (#tempOut > 0.0 AND #tempOut < 100.0) OR
          (#tempOut >= 100.0 AND #tempError < 0.0) OR
          (#tempOut <= 0.0 AND #tempError > 0.0) THEN
           #statIntegral := #statIntegral + (#iKi * #tempError * #iSampleTime_s);
       END_IF;
       IF #statIntegral > 80.0 THEN #statIntegral := 80.0; END_IF;
       IF #statIntegral < 0.0 THEN #statIntegral := 0.0; END_IF;

       #tempOut := (#iKp * #tempError) + #statIntegral;
       IF #tempOut > 100.0 THEN #tempOut := 100.0;
       ELSIF #tempOut < 0.0 THEN #tempOut := 0.0; END_IF;
       #qPID_Out_Pct := #tempOut;
   ELSE
       #qPID_Out_Pct := 0.0;
       #statIntegral := 0.0;
   END_IF;

   #statPwmAccum_s := #statPwmAccum_s + #iSampleTime_s;
   IF #statPwmAccum_s >= 1.0 THEN #statPwmAccum_s := 0.0; END_IF;
   #qHeaterPWM_Out := (#qPID_Out_Pct > 0.5) AND (#statPwmAccum_s < (#qPID_Out_Pct / 100.0));

   #instTON_TempStable(
       IN := (#iEnable AND NOT #statOverTempLatch AND (ABS(#iSetpoint_C - #qActTemp_C) <= #iTolerance_C)),
       PT := T#2s
   );
   #qTempReady := #instTON_TempStable.Q;
END_FUNCTION_BLOCK`,
  },
  {
    id: 'fb-main',
    folder: 'blocks',
    fileName: 'FB_CellSortingStation_Main.scl',
    diskPath: 'capstone/tia-portal-project/blocks/FB_CellSortingStation_Main.scl',
    lang: 'scl',
    importOrder: '第 3 步导入 (整线主控 FB)',
    summary: '外层 OMAC PackML + 内层 GRAFCET 5 步顺控 + 多重背景气缸/G120 调用 + 4×3 立体库空仓位最优检索。',
    content: `FUNCTION_BLOCK "FB_CellSortingStation_Main"
{ S7_Optimized_Access := 'TRUE' }
VERSION : 0.1
   VAR_INPUT
      iSafety_EStop_OK : Bool;
      iSafety_Door_OK : Bool;
      iAirPressure_OK : Bool;
      iInfeed_Sensor : Bool;
      iCylClamp_Ret : Bool;
      iCylClamp_Adv : Bool;
      iCylPress_Ret : Bool;
      iCylPress_Adv : Bool;
      iVision_Done : Bool;
      iVision_Grade : Int;
      iVision_Barcode : String[20];
      iServo_Homed : Bool;
      iServo_InPos : Bool;
      iThermal_TempReady : Bool;
      iThermal_OverTemp : Bool;
      iThermal_ActTemp : Real;
      iG120_ZSW1 : Word;
      iG120_NIST_A : Int;
   END_VAR
   VAR_OUTPUT
      qCylClamp_Adv : Bool;
      qCylClamp_Ret : Bool;
      qCylPress_Adv : Bool;
      qCylPress_Ret : Bool;
      qRejectPusher : Bool;
      qVision_Trigger : Bool;
      qHeater_Enable : Bool;
      qServo_MoveCmd : Bool;
      qServo_TargetX_mm : Real;
      qServo_TargetZ_mm : Real;
      qG120_STW1 : Word;
      qG120_NSOLL_A : Int;
      qTower_Green : Bool;
      qTower_Amber : Bool;
      qTower_Red : Bool;
   END_VAR
   VAR_IN_OUT
      ioRecipe : "UDT_ModuleRecipe";
      ioSlots : Array[1..12] of "UDT_WarehouseSlot";
      ioHMI : "UDT_StationHMI";
   END_VAR
   VAR
      statPackML : Int := 0;
      statStep : Int := 0;
      statTargetSlotIdx : Int := 0;
      instCylClamp : "FB_Cylinder2Pos";
      instCylPress : "FB_Cylinder2Pos";
      instG120 : "FB_SinamicsDrive_Tel1";
      instTON_PressHold { InstructionName := 'TON_TIME'; LibVersion := '1.0' } : TON_TIME;
      instTON_VisionTimeout { InstructionName := 'TON_TIME'; LibVersion := '1.0' } : TON_TIME;
   END_VAR
   VAR_TEMP
      tempSafetyChainOK : Bool;
      tempAutoClampAdv : Bool;
      tempAutoPressAdv : Bool;
      tempConveyorRun : Bool;
      tempIdx : Int;
      tempFoundSlot : Int;
   END_VAR
BEGIN
   #tempSafetyChainOK := #iSafety_EStop_OK AND #iSafety_Door_OK AND #iAirPressure_OK;
   IF (NOT #iSafety_EStop_OK) OR #iThermal_OverTemp THEN
       #statPackML := 90;
       #statStep := 0;
   END_IF;

   #tempAutoClampAdv := FALSE; #tempAutoPressAdv := FALSE; #tempConveyorRun := FALSE;
   #qVision_Trigger := FALSE; #qRejectPusher := FALSE; #qServo_MoveCmd := FALSE; #qHeater_Enable := FALSE;

   CASE #statPackML OF
       0:  // Stopped
           #statStep := 0;
           IF #ioHMI.Cmd_Reset AND #tempSafetyChainOK THEN #statPackML := 10; END_IF;
       10: // Resetting
           IF #instCylClamp.qIsAtRet AND #instCylPress.qIsAtRet AND #iServo_Homed THEN
               #statStep := 10; #statPackML := 20;
           END_IF;
       20: // Idle
           #qHeater_Enable := TRUE;
           IF #ioHMI.Cmd_Start AND #ioHMI.Cmd_AutoMode AND #tempSafetyChainOK THEN #statPackML := 30; END_IF;
       30: // Starting
           #qHeater_Enable := TRUE;
           IF #instG120.qReady AND NOT #instG120.qDriveFault THEN #statPackML := 40; END_IF;
       40: // Execute -> GRAFCET 10..50
           #qHeater_Enable := TRUE;
           IF #ioHMI.Cmd_Hold OR NOT #iSafety_Door_OK THEN
               #statPackML := 50;
           ELSE
               CASE #statStep OF
                   10: #tempConveyorRun := TRUE;
                       IF #iInfeed_Sensor THEN #tempConveyorRun := FALSE; #tempAutoClampAdv := TRUE;
                           IF #instCylClamp.qIsAtAdv THEN #statStep := 20; END_IF;
                       END_IF;
                   20: #tempAutoClampAdv := TRUE; #qVision_Trigger := TRUE;
                       #instTON_VisionTimeout(IN := NOT #iVision_Done, PT := T#3s);
                       IF #instTON_VisionTimeout.Q THEN
                           #ioHMI.Alarms.Vision_CommTimeout := TRUE; #statPackML := 50;
                       ELSIF #iVision_Done THEN
                           IF #iVision_Grade = 9 THEN
                               #qRejectPusher := TRUE; #ioHMI.RejectCount := #ioHMI.RejectCount + 1; #statStep := 10;
                           ELSE
                               #tempFoundSlot := 0;
                               FOR #tempIdx := 1 TO 12 DO
                                   IF (NOT #ioSlots[#tempIdx].Occupied) AND (NOT #ioSlots[#tempIdx].Locked) THEN
                                       #tempFoundSlot := #tempIdx; EXIT;
                                   END_IF;
                               END_FOR;
                               IF #tempFoundSlot = 0 THEN
                                   #ioHMI.Alarms.ASRS_WarehouseFull := TRUE; #statPackML := 50;
                               ELSE
                                   #statTargetSlotIdx := #tempFoundSlot; #statStep := 30;
                               END_IF;
                           END_IF;
                       END_IF;
                   30: #qServo_TargetX_mm := 250.0; #qServo_TargetZ_mm := 120.0; #qServo_MoveCmd := TRUE;
                       IF #iServo_InPos AND #iThermal_TempReady THEN #statStep := 40; END_IF;
                   40: #tempAutoPressAdv := TRUE;
                       #instTON_PressHold(IN := (#instCylPress.qIsAtAdv AND #iThermal_TempReady), PT := #ioRecipe.PressHoldTime);
                       IF #instTON_PressHold.Q THEN #statStep := 50; END_IF;
                   50: IF #instCylPress.qIsAtRet AND (#statTargetSlotIdx >= 1) AND (#statTargetSlotIdx <= 12) THEN
                           #qServo_TargetX_mm := #ioSlots[#statTargetSlotIdx].PosX_mm;
                           #qServo_TargetZ_mm := #ioSlots[#statTargetSlotIdx].PosZ_mm;
                           #qServo_MoveCmd := TRUE;
                           IF #iServo_InPos THEN
                               #ioSlots[#statTargetSlotIdx].Occupied := TRUE;
                               #ioSlots[#statTargetSlotIdx].ModuleBarcode := #iVision_Barcode;
                               #ioSlots[#statTargetSlotIdx].QualityGrade := #iVision_Grade;
                               #ioSlots[#statTargetSlotIdx].PressPeakTemp_C := #iThermal_ActTemp;
                               #ioHMI.GoodCount := #ioHMI.GoodCount + 1;
                               #ioHMI.TotalProduced := #ioHMI.TotalProduced + 1;
                               #statStep := 10;
                           END_IF;
                       END_IF;
               END_CASE;
           END_IF;
       50: // Held (保持 #statStep 不丢失)
           #qHeater_Enable := TRUE;
           IF #ioHMI.Cmd_Unhold AND #tempSafetyChainOK THEN #statPackML := 40; END_IF;
       90: // Aborted
           IF #ioHMI.Cmd_AlarmAck AND #iSafety_EStop_OK AND NOT #iThermal_OverTemp THEN #statPackML := 0; END_IF;
   END_CASE;
END_FUNCTION_BLOCK`,
  },
  {
    id: 'ob100',
    folder: 'blocks',
    fileName: 'OB100_WarmRestart.scl',
    diskPath: 'capstone/tia-portal-project/blocks/OB100_WarmRestart.scl',
    lang: 'scl',
    importOrder: '第 4 步导入 (Startup OB)',
    summary: '暖启动初始化组织块：清零瞬态按钮、计算 12 仓位机械坐标并严格保护掉电保持在库电芯数据。',
    content: `ORGANIZATION_BLOCK "OB100_WarmRestart"
{ S7_Optimized_Access := 'TRUE' }
VERSION : 0.1
   VAR_TEMP
      tempIdx : Int;
      tempRow : Int;
      tempCol : Int;
   END_VAR
BEGIN
   // 1. 清零瞬态 HMI 按钮防止误启动
   "DB_StationGlobal".HMI.Cmd_Start := FALSE;
   "DB_StationGlobal".HMI.Cmd_Reset := FALSE;
   "DB_StationGlobal".HMI.PackML_State := 0;
   "DB_StationGlobal".HMI.Grafcet_Step := 0;

   // 2. 仅刷新固定物理坐标，严禁覆盖 RETAIN 保持的 Occupied / ModuleBarcode！
   FOR #tempIdx := 1 TO 12 DO
       #tempRow := ((#tempIdx - 1) / 4) + 1;
       #tempCol := ((#tempIdx - 1) MOD 4) + 1;
       "DB_StationGlobal".WarehouseSlots[#tempIdx].RowIndex := #tempRow;
       "DB_StationGlobal".WarehouseSlots[#tempIdx].ColIndex := #tempCol;
       "DB_StationGlobal".WarehouseSlots[#tempIdx].PosX_mm := 480.0 + INT_TO_REAL(#tempCol - 1) * 320.0;
       "DB_StationGlobal".WarehouseSlots[#tempIdx].PosZ_mm := 180.0 + INT_TO_REAL(#tempRow - 1) * 240.0;
   END_FOR;

   // 3. 首次空卡上电配方安全兜底
   IF ("DB_StationGlobal".ActiveRecipe.TargetTemp_C < 40.0) OR
      ("DB_StationGlobal".ActiveRecipe.TargetTemp_C > 120.0) THEN
       "DB_StationGlobal".ActiveRecipe.RecipeID := 1;
       "DB_StationGlobal".ActiveRecipe.RecipeName := 'LFP-100Ah';
       "DB_StationGlobal".ActiveRecipe.TargetTemp_C := 85.0;
       "DB_StationGlobal".ActiveRecipe.TempTolerance_C := 0.5;
       "DB_StationGlobal".ActiveRecipe.OverTempLimit_C := 95.0;
       "DB_StationGlobal".ActiveRecipe.PressHoldTime := T#5s;
       "DB_StationGlobal".ActiveRecipe.ConveyorSpeed_Pct := 65.0;
   END_IF;
   "DB_StationGlobal".SysFirstScanDone := TRUE;
END_ORGANIZATION_BLOCK`,
  },
  {
    id: 'ob1',
    folder: 'blocks',
    fileName: 'OB1_MainCycle.scl',
    diskPath: 'capstone/tia-portal-project/blocks/OB1_MainCycle.scl',
    lang: 'scl',
    importOrder: '第 4 步导入 (OB1 + OB30 + IDB)',
    summary: '包含主循环 OB1、恒定 100ms 中断 OB30 及对应背景数据块 IDB，展示主循环与 PID 中断解耦范式。',
    content: `DATA_BLOCK "IDB_StationMain"
{ S7_Optimized_Access := 'TRUE' }
VERSION : 0.1
NON_RETAIN
"FB_CellSortingStation_Main"
BEGIN
END_DATA_BLOCK

DATA_BLOCK "IDB_ThermalPress_PID"
{ S7_Optimized_Access := 'TRUE' }
VERSION : 0.1
NON_RETAIN
"FB_ThermalPress_PID"
BEGIN
END_DATA_BLOCK

ORGANIZATION_BLOCK "OB1_MainCycle"
{ S7_Optimized_Access := 'TRUE' }
VERSION : 0.1
   VAR_TEMP
      tempIdx : Int;
   END_VAR
BEGIN
   IF "DB_StationGlobal".HMI.Cmd_ClearWarehouse AND
      ("DB_StationGlobal".HMI.PackML_State = 0 OR "DB_StationGlobal".HMI.PackML_State = 20) THEN
       FOR #tempIdx := 1 TO 12 DO
           "DB_StationGlobal".WarehouseSlots[#tempIdx].Occupied := FALSE;
           "DB_StationGlobal".WarehouseSlots[#tempIdx].ModuleBarcode := '';
           "DB_StationGlobal".WarehouseSlots[#tempIdx].QualityGrade := 0;
       END_FOR;
       "DB_StationGlobal".HMI.Alarms.ASRS_WarehouseFull := FALSE;
       "DB_StationGlobal".HMI.Cmd_ClearWarehouse := FALSE;
   END_IF;

   "IDB_StationMain"(
       iSafety_EStop_OK   := "I_EStop_OK",
       iSafety_Door_OK    := "I_SafetyDoor_OK",
       iAirPressure_OK    := "I_AirPressure_OK",
       iInfeed_Sensor     := "I_Infeed_Sensor",
       iCylClamp_Ret      := "I_CylClamp_Ret",
       iCylClamp_Adv      := "I_CylClamp_Adv",
       iCylPress_Ret      := "I_CylPress_Ret",
       iCylPress_Adv      := "I_CylPress_Adv",
       iVision_Done       := "I_Vision_Done",
       iVision_Grade      := "IW_Vision_Grade",
       iVision_Barcode    := "DB_StationGlobal".HMI.ActiveBarcode,
       iServo_Homed       := "I_V90_AllHomed",
       iServo_InPos       := "I_V90_InPos",
       iThermal_TempReady := "IDB_ThermalPress_PID".qTempReady,
       iThermal_OverTemp  := "IDB_ThermalPress_PID".qOverTempFault,
       iThermal_ActTemp   := "IDB_ThermalPress_PID".qActTemp_C,
       iG120_ZSW1         := "IW_G120_ZSW1",
       iG120_NIST_A       := "IW_G120_NIST_A",
       qCylClamp_Adv      => "Q_CylClamp_Adv",
       qCylClamp_Ret      => "Q_CylClamp_Ret",
       qCylPress_Adv      => "Q_CylPress_Adv",
       qCylPress_Ret      => "Q_CylPress_Ret",
       qRejectPusher      => "Q_Reject_Pusher",
       qVision_Trigger    => "Q_Vision_Trigger",
       qG120_STW1         => "QW_G120_STW1",
       qG120_NSOLL_A      => "QW_G120_NSOLL_A",
       qTower_Green       => "Q_Tower_Green",
       qTower_Amber       => "Q_Tower_Amber",
       qTower_Red         => "Q_Tower_Red",
       ioRecipe           := "DB_StationGlobal".ActiveRecipe,
       ioSlots            := "DB_StationGlobal".WarehouseSlots,
       ioHMI              := "DB_StationGlobal".HMI
   );

   "DB_StationGlobal".HMI.ActTemp_C := "IDB_ThermalPress_PID".qActTemp_C;
   "DB_StationGlobal".HMI.PID_Output_Pct := "IDB_ThermalPress_PID".qPID_Out_Pct;
END_ORGANIZATION_BLOCK

ORGANIZATION_BLOCK "OB30_CyclicPID_100ms"
{ S7_Optimized_Access := 'TRUE' }
VERSION : 0.1
BEGIN
   "IDB_ThermalPress_PID"(
       iEnable          := "IDB_StationMain".qHeater_Enable,
       iSafety_OK       := "I_EStop_OK",
       iRawPT100        := "AI_PressTemp_Raw",
       iSetpoint_C      := "DB_StationGlobal".ActiveRecipe.TargetTemp_C,
       iTolerance_C     := "DB_StationGlobal".ActiveRecipe.TempTolerance_C,
       iOverTempLimit_C := "DB_StationGlobal".ActiveRecipe.OverTempLimit_C,
       iAlarmReset      := "DB_StationGlobal".HMI.Cmd_AlarmAck,
       iKp              := 6.5,
       iKi              := 0.35,
       iSampleTime_s    := 0.1,
       qHeaterPWM_Out   => "Q_Heater_SSR_PWM"
   );
END_ORGANIZATION_BLOCK`,
  },
  {
    id: 'tags-csv',
    folder: 'tags',
    fileName: 'PLC_TagTable_S71215C.csv',
    diskPath: 'capstone/tia-portal-project/tags/PLC_TagTable_S71215C.csv',
    lang: 'csv',
    importOrder: '第 0 步导入 (PLC 变量表)',
    summary: '西门子 TIA Portal 标准 CSV 变量导入表，包含全站 DI/DO、PT100 模拟量及 G120/V90 报文 I/O 地址。',
    content: `Name,Path,Data Type,Logical Address,Comment,Hmi Visible,Hmi Accessible,Hmi Writeable
"I_EStop_OK",01_Safety,Bool,%I0.0,双通道安全继电器急停正常反馈(NC:1=正常/0=拍下),True,True,False
"I_SafetyDoor_OK",01_Safety,Bool,%I0.1,机台防护安全门磁锁闭合反馈(NC:1=闭合),True,True,False
"I_AirPressure_OK",01_Safety,Bool,%I0.2,压缩空气压力开关正常(>=0.45MPa为1),True,True,False
"I_Infeed_Sensor",02_Sensors,Bool,%I0.3,进料皮带阻挡工位光纤传感器(来料=1),True,True,False
"I_CylClamp_Ret",02_Sensors,Bool,%I0.4,阻挡夹紧气缸退回到位磁簧开关,True,True,False
"I_CylClamp_Adv",02_Sensors,Bool,%I0.5,阻挡夹紧气缸伸出到位磁簧开关,True,True,False
"I_CylPress_Ret",02_Sensors,Bool,%I0.6,热压气缸上限位退回磁簧开关,True,True,False
"I_CylPress_Adv",02_Sensors,Bool,%I0.7,热压气缸下压到位磁簧开关,True,True,False
"I_Vision_Done",04_CommsIO,Bool,%I1.3,智能视觉相机拍照与内阻分级完成信号,True,True,False
"I_V90_AllHomed",04_CommsIO,Bool,%I1.4,V90 X/Z轴伺服均已完成原点回归标志,True,True,False
"I_V90_InPos",04_CommsIO,Bool,%I1.5,V90 X/Z轴立体库伺服定位到位信号,True,True,False
"Q_CylClamp_Adv",05_Actuators,Bool,%Q0.0,阻挡夹紧气缸伸出电磁阀(24VDC),True,True,False
"Q_CylClamp_Ret",05_Actuators,Bool,%Q0.1,阻挡夹紧气缸退回电磁阀(24VDC),True,True,False
"Q_CylPress_Adv",05_Actuators,Bool,%Q0.2,热压下压气缸伸出电磁阀(24VDC),True,True,False
"Q_CylPress_Ret",05_Actuators,Bool,%Q0.3,热压下压气缸抬升电磁阀(24VDC),True,True,False
"Q_Reject_Pusher",05_Actuators,Bool,%Q0.4,NG不良品气动剔除推杆电磁阀,True,True,False
"Q_Vision_Trigger",05_Actuators,Bool,%Q0.5,智能视觉相机硬触发拍照输出,True,True,False
"Q_Heater_SSR_PWM",06_Thermal,Bool,%Q0.6,热压腔固态继电器SSR脉宽调制输出(OB30驱动),True,True,False
"Q_Tower_Green",07_Signals,Bool,%Q0.7,三色警示灯-绿灯(Execute运行中),True,True,False
"Q_Tower_Amber",07_Signals,Bool,%Q1.0,三色警示灯-黄灯(Idle待机/Held暂停),True,True,False
"Q_Tower_Red",07_Signals,Bool,%Q1.1,三色警示灯-红灯(Aborted急停/设备报警),True,True,False
"AI_PressTemp_Raw",06_Thermal,Int,%IW96,ET200SP PT100热压腔温度通道(0.1°C/字),True,True,False
"IW_Vision_Grade",04_CommsIO,Int,%IW100,智能视觉相机PROFINET输入分级码(1=A/2=B/9=NG),True,True,False
"IW_G120_ZSW1",08_Drives,Word,%IW256,SINAMICS G120 标准报文1状态字ZSW1,True,True,False
"IW_G120_NIST_A",08_Drives,Int,%IW258,SINAMICS G120 标准报文1实际转速NIST_A,True,True,False
"QW_G120_STW1",08_Drives,Word,%QW256,SINAMICS G120 标准报文1控制字STW1,True,True,False
"QW_G120_NSOLL_A",08_Drives,Int,%QW258,SINAMICS G120 标准报文1设定转速NSOLL_A,True,True,False`,
  },
  {
    id: 'fds-doc',
    folder: 'docs',
    fileName: 'FDS_功能设计说明书.md',
    diskPath: 'capstone/tia-portal-project/docs/FDS_功能设计说明书.md',
    lang: 'md',
    importOrder: '工程交付文档',
    summary: '完整的工业级功能设计说明书（FDS），含指标表、PROFINET 拓扑、TIA 导入顺序与安全联锁矩阵。',
    content: `# 功能设计说明书（FDS）
## 项目名称：基于西门子 S7-1215C + PROFINET 的新能源锂电模组柔性视觉分拣、热压恒温固化与立体入库工作站

- **控制核心**：SIMATIC S7-1215C DC/DC/DC (6ES7 215-1AG40-0XB0) + TIA Portal V18/V19
- **工业总线**：PROFINET IO (RT) 100Mbps 星型交换机拓扑
- **核心指标**：CT <= 12.0 s/件 | 恒温 85.0°C ±0.5°C | 4×3 立体库 RETAIN 掉电保持

### TIA Portal 外部源文件标准导入顺序
1. 先导入 PLC 变量表 tags/PLC_TagTable_S71215C.csv
2. 导入 types/UDT_ModuleRecipeAndStation.scl → 右键“从源生成块”
3. 导入基础设备块 FB_Cylinder2Pos.scl / FB_SinamicsDrive_Tel1.scl / FB_ThermalPress_PID.scl
4. 导入主控块 FB_CellSortingStation_Main.scl 与组织块 OB100_WarmRestart.scl / OB1_MainCycle.scl
5. 点击设备级编译（硬件+软件），0 Error 后下载至 S7-1215C 或 PLCSIM Advanced！`,
  },
  {
    id: 'resume-doc',
    folder: 'docs',
    fileName: 'RESUME_AND_INTERVIEW_GUIDE.md',
    diskPath: 'capstone/tia-portal-project/docs/RESUME_AND_INTERVIEW_GUIDE.md',
    lang: 'md',
    importOrder: '求职面试手册',
    summary: '离线版 STAR 简历模板与 15 道面试高频灵魂追问满分话术，可直接随项目打包放进求职作品集。',
    content: `# 简历项目包装文案与 15 道面试高频灵魂拷问通关指南

- STAR 法则简历三段式模板（PLC 工程师 / 非标控制 / 智能制造管培生）
- 15 道面试官高频追问完整话术（已在网页端 Tab 5 交互式呈现，并已同步写入本地磁盘文件）
- 磁盘完整路径：capstone/tia-portal-project/docs/RESUME_AND_INTERVIEW_GUIDE.md`,
  },
];
