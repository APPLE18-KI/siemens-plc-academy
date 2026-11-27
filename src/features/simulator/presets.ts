import type { SimPresetId } from '../../types/content';
import type { TagDef } from '../../types/plc';
import type { LadderProgram, TraceChannelDef } from '../../core/plc';

export interface FieldInputMeta {
  tag: string;
  label: string;
  /** Physical field wiring type: NO (normally open) or NC (normally closed fail-safe) */
  physicalType: 'NO' | 'NC';
  /** Default button behavior in Momentary mode */
  defaultMomentary?: boolean;
  tone: 'success' | 'danger' | 'info' | 'warn' | 'neutral';
  hint: string;
}

export interface AnalogInputMeta {
  tag: string;
  label: string;
  minRaw: number;
  maxRaw: number;
  unitLabel: string;
  presets: { label: string; raw: number; tone?: 'info' | 'warn' | 'danger' | 'success' }[];
  supportsClosedLoopTank?: boolean;
}

export interface FieldOutputMeta {
  tag: string;
  label: string;
  role: 'motor' | 'motor-fwd' | 'motor-rev' | 'star' | 'delta' | 'cylinder' | 'pump' | 'valve' | 'alarm' | 'lamp-green' | 'lamp-amber';
  description: string;
}

export interface SimPresetDefinition {
  id: SimPresetId;
  title: string;
  shortTitle: string;
  subtitle: string;
  badge: string;
  tags: string[];
  teachingSummary: string;
  trySteps: string[];
  interviewNote: string;
  tagDefs: TagDef[];
  fieldInputs: FieldInputMeta[];
  analogInputs?: AnalogInputMeta[];
  fieldOutputs: FieldOutputMeta[];
  program: LadderProgram;
  sclCode: string;
  traceChannels: TraceChannelDef[];
}

export const SIM_PRESET_DEFINITIONS: Record<SimPresetId, SimPresetDefinition> = {
  'wiring-basics': {
    id: 'wiring-basics',
    title: '常开/常闭触点与急停回路',
    shortTitle: '常开/常闭与急停',
    subtitle: '物理常闭按钮 vs 程序常闭触点经典误区对比',
    badge: '阶段 01 · 位逻辑入门',
    tags: ['NO/NC', '物理常闭急停', '断线安全', '%I0.0'],
    teachingSummary:
      '工业现场急停按钮与安全门一律采用“物理常闭 (NC)”接线（正常时导通 24V，PLC 读入 1；拍下急停或断线时失电为 0）。因此梯形图中必须使用【程序常开触点 ---| |---】才能实现“正常允许、拍停切断”！',
    trySteps: [
      '观察正常态：%I0.0 急停与 %I0.2 安全门均为 1（24V 接通），按住 %I0.1 启动按钮，观察 NW 1 正确输出 %Q0.0 导通，而 NW 2 错误示范 %Q0.1 反而无法启动。',
      '点击“急停按钮 %I0.0”模拟拍下急停（或切换为拨码保持模式锁死在 0），再按 %I0.1 启动按钮：NW 1 安全切断且 %Q0.2 报警灯点亮，但 NW 2 错误程序竟让设备启动！',
    ],
    interviewNote:
      '高频面试题：“为什么急停按钮物理接常闭，PLC 程序里反而画常开触点？”—— 核心在于断线安全原则（Fail-Safe）：若现场接线松脱或剪断，PLC 输入立即变为 0，程序常开触点断开，设备自动停机报警。',
    tagDefs: [
      { name: 'EStop_NC_Field', address: '%I0.0', type: 'Bool', area: 'I', init: true, comment: '急停蘑菇头（物理常闭 NC，正常=1，拍下=0）' },
      { name: 'Start_NO_PB', address: '%I0.1', type: 'Bool', area: 'I', init: false, comment: '启动按钮（物理常开 NO，按下=1）' },
      { name: 'Safe_Door_NC', address: '%I0.2', type: 'Bool', area: 'I', init: true, comment: '安全门磁开关（物理常闭 NC，关门=1）' },
      { name: 'Fault_Test_Switch', address: '%I0.3', type: 'Bool', area: 'I', init: false, comment: '热过载常开辅助触点（正常=0，故障=1）' },
      { name: 'Coil_Correct_Run', address: '%Q0.0', type: 'Bool', area: 'Q', init: false, comment: '【正确】满足安全联锁的设备输出' },
      { name: 'Coil_Wrong_Demo', address: '%Q0.1', type: 'Bool', area: 'Q', init: false, comment: '【误区反例】急停误用程序常闭触点' },
      { name: 'Alarm_EStop_Lamp', address: '%Q0.2', type: 'Bool', area: 'Q', init: false, comment: '急停/安全门异常报警指示灯' },
    ],
    fieldInputs: [
      {
        tag: 'EStop_NC_Field',
        label: '急停蘑菇头',
        physicalType: 'NC',
        defaultMomentary: false,
        tone: 'danger',
        hint: '物理常闭：正常=1(24V)，拍下/断线=0(0V)',
      },
      {
        tag: 'Start_NO_PB',
        label: '绿色启动按钮',
        physicalType: 'NO',
        defaultMomentary: true,
        tone: 'success',
        hint: '物理常开：按住=1，松开=0',
      },
      {
        tag: 'Safe_Door_NC',
        label: '安全防护门',
        physicalType: 'NC',
        defaultMomentary: false,
        tone: 'warn',
        hint: '物理常闭：闭合=1，打开门=0',
      },
      {
        tag: 'Fault_Test_Switch',
        label: '过载故障触点',
        physicalType: 'NO',
        defaultMomentary: false,
        tone: 'warn',
        hint: '物理常开：正常=0，触发过载=1',
      },
    ],
    fieldOutputs: [
      { tag: 'Coil_Correct_Run', label: '正确运行输出', role: 'motor', description: '安全回路完好且按下启动时导通' },
      { tag: 'Coil_Wrong_Demo', label: '误区反例输出', role: 'lamp-amber', description: '拍下急停反倒允许运行（严重事故！）' },
      { tag: 'Alarm_EStop_Lamp', label: '安全报警灯', role: 'alarm', description: '急停拍下或安全门打开时立即点亮' },
    ],
    program: {
      id: 'wiring-basics',
      name: 'OB1_Wiring_Safety_Compare',
      networks: [
        {
          id: 'wb-nw1',
          number: 1,
          title: '正确示范：物理 NC 急停配程序常开触点 (---| |---)',
          comment: '急停与安全门正常输入为 1，用常开触点检测 24V 存在；过载常开故障正常为 0，用常闭触点互锁。',
          nodes: [
            { kind: 'NO', id: 'wb-1-1', tag: 'EStop_NC_Field' },
            { kind: 'NO', id: 'wb-1-2', tag: 'Safe_Door_NC' },
            { kind: 'NC', id: 'wb-1-3', tag: 'Fault_Test_Switch' },
            { kind: 'NO', id: 'wb-1-4', tag: 'Start_NO_PB' },
            { kind: 'OTE', id: 'wb-1-5', tag: 'Coil_Correct_Run' },
          ],
        },
        {
          id: 'wb-nw2',
          number: 2,
          title: '新手经典误区：物理 NC 急停误用程序常闭 (---|/|---)',
          comment: '对比观察：因为物理急停正常输入为 1，误画常闭触点后反而在正常时断开、拍下急停时闭合！',
          nodes: [
            { kind: 'NC', id: 'wb-2-1', tag: 'EStop_NC_Field' },
            { kind: 'NO', id: 'wb-2-2', tag: 'Start_NO_PB' },
            { kind: 'OTE', id: 'wb-2-3', tag: 'Coil_Wrong_Demo' },
          ],
        },
        {
          id: 'wb-nw3',
          number: 3,
          title: '急停或安全门断开触发报警灯',
          comment: '任一物理常闭安全信号失电（变为 0），对应程序常闭触点闭合，驱动报警灯。',
          nodes: [
            {
              kind: 'BRANCH',
              id: 'wb-3-br',
              branches: [
                [{ kind: 'NC', id: 'wb-3-1', tag: 'EStop_NC_Field' }],
                [{ kind: 'NC', id: 'wb-3-2', tag: 'Safe_Door_NC' }],
              ],
            },
            { kind: 'OTE', id: 'wb-3-3', tag: 'Alarm_EStop_Lamp' },
          ],
        },
      ],
    },
    sclCode: `// S7-1200 OB1 等效 SCL 代码：物理常闭急停与安全联锁
REGION Network_1_Correct_Safety_Logic
    // 物理常闭(NC)急停与安全门在正常工况下输入为 TRUE (24V)
    // 因此程序必须直接取原值(程序常开)，实现“断线安全(Fail-Safe)”
    "Coil_Correct_Run" := "EStop_NC_Field"
                          AND "Safe_Door_NC"
                          AND (NOT "Fault_Test_Switch")
                          AND "Start_NO_PB";
END_REGION

REGION Network_2_Common_Mistake_Demo
    // [反面教材] 误将物理 NC 急停取反(NOT)，导致拍下急停后反而导通！
    "Coil_Wrong_Demo" := (NOT "EStop_NC_Field") AND "Start_NO_PB";
END_REGION

REGION Network_3_Safety_Alarm
    // 急停拍下或安全门打开（输入失电为 FALSE）时点亮报警灯
    "Alarm_EStop_Lamp" := (NOT "EStop_NC_Field") OR (NOT "Safe_Door_NC");
END_REGION`,
    traceChannels: [
      { id: 'ch1', tag: 'EStop_NC_Field', label: '急停(物理NC)', address: '%I0.0', kind: 'bool', color: '#f43f5e' },
      { id: 'ch2', tag: 'Start_NO_PB', label: '启动按钮', address: '%I0.1', kind: 'bool', color: '#38bdf8' },
      { id: 'ch3', tag: 'Coil_Correct_Run', label: '正确输出', address: '%Q0.0', kind: 'bool', color: '#10b981' },
      { id: 'ch4', tag: 'Coil_Wrong_Demo', label: '误区输出', address: '%Q0.1', kind: 'bool', color: '#f59e0b' },
      { id: 'ch5', tag: 'Alarm_EStop_Lamp', label: '急停报警', address: '%Q0.2', kind: 'bool', color: '#ef4444' },
    ],
  },

  'seal-in-motor': {
    id: 'seal-in-motor',
    title: '三相电机起保停自锁 + 点动运行回路',
    shortTitle: '起保停自锁与点动',
    subtitle: '经典并联自锁支路、停止优先原则与点动防自锁设计',
    badge: '阶段 01 · 核心控制回路',
    tags: ['起保停', '自锁 OR 支路', '点动 Jog', '停止优先'],
    teachingSummary:
      '点按绿色启动按钮 %I0.0 后松手，并联在启动触点下方的自锁触点 %M0.0 接管能流持续保持电机运行；按住点动按钮 %I0.2 时，NW 1 中的常闭触点切断自锁，NW 2 直接驱动接触器实现“按转松停”。',
    trySteps: [
      '确保处于“点动按钮模式”，短按一下 %I0.0 启动按钮后松开，观察能流从上方启动支路无缝切换至下方自锁支路 %M0.0，电机 %Q0.0 持续运行。',
      '短按红色 %I0.1 停止按钮（物理常闭被按下断开），自锁回路失电释放。',
      '长按 %I0.2 点动按钮观察电机仅在按住时运转、松开即停；再点击 %I0.3 模拟热继电器过载脱扣。',
    ],
    interviewNote:
      '工业设计黄金准则“停止优先”：停止触点必须串联在自锁并联支路之后。即使启动与停止按钮同时被按下，串联停止触点也会无条件切断线圈，绝不发生误启动。',
    tagDefs: [
      { name: 'Start_PB', address: '%I0.0', type: 'Bool', area: 'I', init: false, comment: '连续启动按钮（NO 点动）' },
      { name: 'Stop_NC_PB', address: '%I0.1', type: 'Bool', area: 'I', init: true, comment: '停止按钮（物理 NC，正常=1）' },
      { name: 'Jog_PB', address: '%I0.2', type: 'Bool', area: 'I', init: false, comment: '点动调试按钮（NO 点动）' },
      { name: 'Thermal_OL_NC', address: '%I0.3', type: 'Bool', area: 'I', init: true, comment: '热继电器 FR 保护（物理 NC，正常=1）' },
      { name: 'M_Seal_Enable', address: '%M0.0', type: 'Bool', area: 'M', init: false, comment: '连续运行自锁中间标志' },
      { name: 'Motor_KM1', address: '%Q0.0', type: 'Bool', area: 'Q', init: false, comment: '三相异步电机主接触器 KM1' },
      { name: 'Lamp_Running', address: '%Q0.1', type: 'Bool', area: 'Q', init: false, comment: '电机运行绿色指示灯' },
      { name: 'Lamp_Fault', address: '%Q0.2', type: 'Bool', area: 'Q', init: false, comment: '热过载红色故障指示灯' },
    ],
    fieldInputs: [
      {
        tag: 'Start_PB',
        label: '启动按钮 SB1',
        physicalType: 'NO',
        defaultMomentary: true,
        tone: 'success',
        hint: '点按接通后松开，由 %M0.0 自锁保持',
      },
      {
        tag: 'Stop_NC_PB',
        label: '停止按钮 SB2',
        physicalType: 'NC',
        defaultMomentary: true,
        tone: 'danger',
        hint: '物理常闭：按下断开(0)立即停机',
      },
      {
        tag: 'Jog_PB',
        label: '点动按钮 SB3',
        physicalType: 'NO',
        defaultMomentary: true,
        tone: 'info',
        hint: '按住运转、松开即停（切断自锁）',
      },
      {
        tag: 'Thermal_OL_NC',
        label: '热继电器 FR',
        physicalType: 'NC',
        defaultMomentary: false,
        tone: 'warn',
        hint: '正常闭合=1；点击模拟过载脱扣=0',
      },
    ],
    fieldOutputs: [
      { tag: 'Motor_KM1', label: '主接触器 KM1', role: 'motor', description: '三相电机主动力电源接触器' },
      { tag: 'Lamp_Running', label: '运行指示灯 HL1', role: 'lamp-green', description: '电机运行中绿灯常亮' },
      { tag: 'Lamp_Fault', label: '过载故障灯 HL2', role: 'alarm', description: '热继电器 FR 动作报警' },
    ],
    program: {
      id: 'seal-in-motor',
      name: 'OB1_Motor_SealIn_Jog',
      networks: [
        {
          id: 'sm-nw1',
          number: 1,
          title: '连续运行自锁回路（停止优先 + 点动互锁）',
          comment: '并联自锁支路维持运行；串联停止按钮与热保护实现安全停机；串联点动常闭防止点动时误锁存。',
          nodes: [
            {
              kind: 'BRANCH',
              id: 'sm-1-br',
              branches: [
                [{ kind: 'NO', id: 'sm-1-1', tag: 'Start_PB' }],
                [{ kind: 'NO', id: 'sm-1-2', tag: 'M_Seal_Enable' }],
              ],
            },
            { kind: 'NO', id: 'sm-1-3', tag: 'Stop_NC_PB' },
            { kind: 'NC', id: 'sm-1-4', tag: 'Jog_PB' },
            { kind: 'NO', id: 'sm-1-5', tag: 'Thermal_OL_NC' },
            { kind: 'OTE', id: 'sm-1-6', tag: 'M_Seal_Enable' },
          ],
        },
        {
          id: 'sm-nw2',
          number: 2,
          title: '主接触器 KM1 综合驱动（自锁连续 OR 点动直驱）',
          comment: '单一出口原则：电机接触器 %Q0.0 仅在本网段统一赋值，避免双线圈覆盖隐患。',
          nodes: [
            {
              kind: 'BRANCH',
              id: 'sm-2-br',
              branches: [
                [{ kind: 'NO', id: 'sm-2-1', tag: 'M_Seal_Enable' }],
                [{ kind: 'NO', id: 'sm-2-2', tag: 'Jog_PB' }],
              ],
            },
            { kind: 'NO', id: 'sm-2-3', tag: 'Stop_NC_PB' },
            { kind: 'NO', id: 'sm-2-4', tag: 'Thermal_OL_NC' },
            {
              kind: 'OUTPUT_BRANCH',
              id: 'sm-2-out',
              outputs: [
                [{ kind: 'OTE', id: 'sm-2-5', tag: 'Motor_KM1' }],
                [{ kind: 'OTE', id: 'sm-2-6', tag: 'Lamp_Running' }],
              ],
            },
          ],
        },
        {
          id: 'sm-nw3',
          number: 3,
          title: '热继电器过载报警输出',
          comment: '当热继电器常闭触点因过流断开（%I0.3=0）时点亮故障红灯。',
          nodes: [
            { kind: 'NC', id: 'sm-3-1', tag: 'Thermal_OL_NC' },
            { kind: 'OTE', id: 'sm-3-2', tag: 'Lamp_Fault' },
          ],
        },
      ],
    },
    sclCode: `// S7-1200 OB1 等效 SCL 代码：三相电机起保停自锁 + 点动切换
REGION Network_1_Seal_In_Latch
    // 停止优先：Stop_NC_PB 与 Thermal_OL_NC 在最外层做 AND 约束
    // 按下 Jog_PB 时 NOT "Jog_PB" 为 FALSE，确保点动不会触发自锁
    "M_Seal_Enable" := ("Start_PB" OR "M_Seal_Enable")
                       AND "Stop_NC_PB"
                       AND (NOT "Jog_PB")
                       AND "Thermal_OL_NC";
END_REGION

REGION Network_2_Motor_Output
    // 单一输出归属：自锁与点动汇总后统一驱动接触器 KM1
    "Motor_KM1" := ("M_Seal_Enable" OR "Jog_PB")
                   AND "Stop_NC_PB"
                   AND "Thermal_OL_NC";
    "Lamp_Running" := "Motor_KM1";
END_REGION

REGION Network_3_Thermal_Fault
    "Lamp_Fault" := NOT "Thermal_OL_NC";
END_REGION`,
    traceChannels: [
      { id: 'ch1', tag: 'Start_PB', label: '启动按钮', address: '%I0.0', kind: 'bool', color: '#38bdf8' },
      { id: 'ch2', tag: 'Stop_NC_PB', label: '停止(NC)', address: '%I0.1', kind: 'bool', color: '#f43f5e' },
      { id: 'ch3', tag: 'Jog_PB', label: '点动按钮', address: '%I0.2', kind: 'bool', color: '#a78bfa' },
      { id: 'ch4', tag: 'M_Seal_Enable', label: '自锁标志', address: '%M0.0', kind: 'bool', color: '#f59e0b' },
      { id: 'ch5', tag: 'Motor_KM1', label: '电机 KM1', address: '%Q0.0', kind: 'bool', color: '#10b981' },
    ],
  },

  'reversing-interlock': {
    id: 'reversing-interlock',
    title: '电机正反转软互锁 + P_TRIG 启停计数保护',
    shortTitle: '正反转互锁与边沿检测',
    subtitle: '防止相间短路的按钮/线圈双重软互锁与上升沿单周期脉冲统计',
    badge: '阶段 02 · 互锁与边沿检测',
    tags: ['双重互锁', 'P_TRIG 上升沿', 'CTU 点检计数', '防相间短路'],
    teachingSummary:
      '三相电机正反转通过调换两相相序实现，若正转接触器 KM_Fwd 与反转接触器 KM_Rev 同时吸合将造成严重相间短路！本程序通过“按钮互锁 + 接触器线圈互锁”防止双通，并用上升沿 P_TRIG 精确捕捉每次起动脉冲统计启停寿命。',
    trySteps: [
      '点击 %I0.0 正转启动，%Q0.0 自锁运行；此时直接点击 %I0.1 反转按钮，观察互锁常闭触点如何阻断反转线圈（安全防冲突）。',
      '切换为“拨码保持模式”，同时闭合 %I0.0 与 %I0.1，验证按钮互锁令两者同时断开，彻底杜绝双吸合！',
      '每次合法起动时观察 NW 3 的 P_TRIG 仅输出 1 个扫描周期窄脉冲（可将扫描周期调至 500ms 慢放或在底部波形图查看），累计满 5 次点亮保养灯 %Q0.2。',
    ],
    interviewNote:
      '工程铁律：PLC 程序里的软互锁绝对不能替代硬件电气互锁！现场必须同时将 KM1/KM2 的辅助常闭触点串入对方接触器线圈供电回路，防止 PLC 输出继电器触点粘连引发主回路短路。',
    tagDefs: [
      { name: 'Fwd_PB', address: '%I0.0', type: 'Bool', area: 'I', init: false, comment: '正转启动按钮（NO）' },
      { name: 'Rev_PB', address: '%I0.1', type: 'Bool', area: 'I', init: false, comment: '反转启动按钮（NO）' },
      { name: 'Stop_NC_PB', address: '%I0.2', type: 'Bool', area: 'I', init: true, comment: '停止按钮（物理 NC）' },
      { name: 'Reset_Cnt_PB', address: '%I0.3', type: 'Bool', area: 'I', init: false, comment: '保养计数清零按钮' },
      { name: 'KM_Fwd', address: '%Q0.0', type: 'Bool', area: 'Q', init: false, comment: '正转接触器 KM1' },
      { name: 'KM_Rev', address: '%Q0.1', type: 'Bool', area: 'Q', init: false, comment: '反转接触器 KM2' },
      { name: 'Lamp_Maint_Due', address: '%Q0.2', type: 'Bool', area: 'Q', init: false, comment: '满 5 次启停点检提示灯' },
      { name: 'M_Start_Pulse', address: '%M0.2', type: 'Bool', area: 'M', init: false, comment: '单周期起动上升沿脉冲' },
      { name: 'Switch_Count', address: '%MW10', type: 'Int', area: 'M', init: 0, comment: '累计正反转起动次数' },
    ],
    fieldInputs: [
      {
        tag: 'Fwd_PB',
        label: '正转启动 FWD',
        physicalType: 'NO',
        defaultMomentary: true,
        tone: 'success',
        hint: '启动正转并受反转信号互锁',
      },
      {
        tag: 'Rev_PB',
        label: '反转启动 REV',
        physicalType: 'NO',
        defaultMomentary: true,
        tone: 'info',
        hint: '启动反转并受正转信号互锁',
      },
      {
        tag: 'Stop_NC_PB',
        label: '停止按钮 STOP',
        physicalType: 'NC',
        defaultMomentary: true,
        tone: 'danger',
        hint: '物理常闭：换向前需先停车',
      },
      {
        tag: 'Reset_Cnt_PB',
        label: '保养计数复位',
        physicalType: 'NO',
        defaultMomentary: true,
        tone: 'neutral',
        hint: '将累计启停次数 %MW10 清零',
      },
    ],
    fieldOutputs: [
      { tag: 'KM_Fwd', label: '正转接触器 KM1', role: 'motor-fwd', description: '正相序驱动电机顺时针旋转' },
      { tag: 'KM_Rev', label: '反转接触器 KM2', role: 'motor-rev', description: '反相序驱动电机逆时针旋转' },
      { tag: 'Lamp_Maint_Due', label: '点检保养灯', role: 'alarm', description: '累计起动达到 5 次触发保养提醒' },
    ],
    program: {
      id: 'reversing-interlock',
      name: 'OB1_Reversing_Interlock',
      networks: [
        {
          id: 'ri-nw1',
          number: 1,
          title: '正转自锁回路（按钮互锁 NC Rev_PB + 线圈互锁 NC KM_Rev）',
          comment: '只有当反转按钮未按且反转接触器未吸合时，才允许正转吸合并自锁。',
          nodes: [
            {
              kind: 'BRANCH',
              id: 'ri-1-br',
              branches: [
                [{ kind: 'NO', id: 'ri-1-1', tag: 'Fwd_PB' }],
                [{ kind: 'NO', id: 'ri-1-2', tag: 'KM_Fwd' }],
              ],
            },
            { kind: 'NC', id: 'ri-1-3', tag: 'Rev_PB' },
            { kind: 'NC', id: 'ri-1-4', tag: 'KM_Rev' },
            { kind: 'NO', id: 'ri-1-5', tag: 'Stop_NC_PB' },
            { kind: 'OTE', id: 'ri-1-6', tag: 'KM_Fwd' },
          ],
        },
        {
          id: 'ri-nw2',
          number: 2,
          title: '反转自锁回路（按钮互锁 NC Fwd_PB + 线圈互锁 NC KM_Fwd）',
          comment: '与 NW 1 构成对称双重软互锁；即使双按钮同按，两者均断开确保零短路风险。',
          nodes: [
            {
              kind: 'BRANCH',
              id: 'ri-2-br',
              branches: [
                [{ kind: 'NO', id: 'ri-2-1', tag: 'Rev_PB' }],
                [{ kind: 'NO', id: 'ri-2-2', tag: 'KM_Rev' }],
              ],
            },
            { kind: 'NC', id: 'ri-2-3', tag: 'Fwd_PB' },
            { kind: 'NC', id: 'ri-2-4', tag: 'KM_Fwd' },
            { kind: 'NO', id: 'ri-2-5', tag: 'Stop_NC_PB' },
            { kind: 'OTE', id: 'ri-2-6', tag: 'KM_Rev' },
          ],
        },
        {
          id: 'ri-nw3',
          number: 3,
          title: '上升沿 P_TRIG 捕获单周期启动脉冲',
          comment: '仅在接触器由 0 跳变为 1 的那个扫描周期输出 1 个周期脉冲，避免持续导通重复计数。',
          nodes: [
            {
              kind: 'BRANCH',
              id: 'ri-3-br',
              branches: [
                [{ kind: 'P_TRIG', id: 'ri-3-1', tag: 'KM_Fwd', memTag: '%M0.0' }],
                [{ kind: 'P_TRIG', id: 'ri-3-2', tag: 'KM_Rev', memTag: '%M0.1' }],
              ],
            },
            { kind: 'OTE', id: 'ri-3-3', tag: 'M_Start_Pulse' },
          ],
        },
        {
          id: 'ri-nw4',
          number: 4,
          title: 'CTU 启停次数累计保护（满 5 次提示接触器点检）',
          comment: '每次正/反转成功启动计数 +1，达到 PV=5 时触发维护指示灯，按下复位清零。',
          nodes: [
            { kind: 'NO', id: 'ri-4-1', tag: 'M_Start_Pulse' },
            {
              kind: 'COUNTER',
              id: 'ri-4-2',
              counterType: 'CTU',
              dbName: 'CTU_Maint_DB',
              pv: 5,
              resetTag: 'Reset_Cnt_PB',
              cvTag: 'Switch_Count',
              qTag: 'Lamp_Maint_Due',
            },
            { kind: 'OTE', id: 'ri-4-3', tag: 'Lamp_Maint_Due' },
          ],
        },
      ],
    },
    sclCode: `// S7-1200 OB1 等效 SCL 代码：正反转双重互锁 + P_TRIG 启停计数
REGION Network_1_Forward_Interlock
    "KM_Fwd" := ("Fwd_PB" OR "KM_Fwd")
                AND (NOT "Rev_PB")
                AND (NOT "KM_Rev")
                AND "Stop_NC_PB";
END_REGION

REGION Network_2_Reverse_Interlock
    "KM_Rev" := ("Rev_PB" OR "KM_Rev")
                AND (NOT "Fwd_PB")
                AND (NOT "KM_Fwd")
                AND "Stop_NC_PB";
END_REGION

REGION Network_3_Edge_Detection
    // IEC 上升沿检测（相当于 LAD 中的 P_TRIG）
    "R_TRIG_Fwd"(CLK := "KM_Fwd");
    "R_TRIG_Rev"(CLK := "KM_Rev");
    "M_Start_Pulse" := "R_TRIG_Fwd".Q OR "R_TRIG_Rev".Q;
END_REGION

REGION Network_4_Maintenance_Counter
    "CTU_Maint_DB"(CU := "M_Start_Pulse",
                   R  := "Reset_Cnt_PB",
                   PV := 5,
                   Q  => "Lamp_Maint_Due",
                   CV => "Switch_Count");
END_REGION`,
    traceChannels: [
      { id: 'ch1', tag: 'KM_Fwd', label: '正转 KM1', address: '%Q0.0', kind: 'bool', color: '#10b981' },
      { id: 'ch2', tag: 'KM_Rev', label: '反转 KM2', address: '%Q0.1', kind: 'bool', color: '#38bdf8' },
      { id: 'ch3', tag: 'M_Start_Pulse', label: 'P_TRIG 脉冲', address: '%M0.2', kind: 'bool', color: '#f59e0b' },
      { id: 'ch4', tag: 'Switch_Count', label: '启停次数 CV', address: '%MW10', kind: 'number', color: '#a78bfa', min: 0, max: 6, unit: '次' },
      { id: 'ch5', tag: 'Lamp_Maint_Due', label: '保养提示', address: '%Q0.2', kind: 'bool', color: '#ef4444' },
    ],
  },

  'ton-star-delta': {
    id: 'ton-star-delta',
    title: 'TON 接通延时实现星三角（Y-Δ）降压启动',
    shortTitle: 'TON 星三角降压启动',
    subtitle: '两级 IEC TON 定时器与 300ms 灭弧死区防短路自动切换',
    badge: '阶段 02 · IEC 定时器实战',
    tags: ['TON 定时器', 'Y-Δ 降压启动', '300ms 死区保护', 'ET 实时进度'],
    teachingSummary:
      '大功率三相电机（≥15kW）直接全压启动冲击电流高达额定电流 6~7 倍。本程序采用标准两级 TON 架构：先吸合主接触器 KM_Main + 星形 KM_Star 降压启动 4.0s，随后断开 KM_Star 并刻意留出 300ms 灭弧死区，最后吸合三角形 KM_Delta 转入全压正常运行！',
    trySteps: [
      '点按 %I0.0 启动按钮：立刻看到 KM_Main (%Q0.0) 与星形 KM_Star (%Q0.1) 吸合，NW 2 中 TON_Star_DB 的 ET 进度条开始向 4000ms 爬升。',
      '紧盯 4.0s 切换瞬间：KM_Star 立即断开，NW 3 的 TON_Dead_DB 开始 300ms 死区倒计时（此时 Y/Δ 均断开灭弧），4.3s 时 KM_Delta (%Q0.2) 平稳吸合！',
      '观察底部 Trace 示波器：可清晰看到 TON_Star_ET 斜坡、KM_Star 下降沿与 KM_Delta 上升沿之间的 300ms 安全空白死区！',
    ],
    interviewNote:
      '面试高频加分点：新手写星三角往往只用 1 个 TON 直接切换 Y 和 Δ，但大电流交流接触器触点机械释放需要 30~80ms、灭弧需要时间，不加 100~300ms 切换死区会导致 Y/Δ 短暂重叠引发母线短路炸机！',
    tagDefs: [
      { name: 'Start_PB', address: '%I0.0', type: 'Bool', area: 'I', init: false, comment: '星三角启动按钮（NO）' },
      { name: 'Stop_NC_PB', address: '%I0.1', type: 'Bool', area: 'I', init: true, comment: '停止按钮（物理 NC）' },
      { name: 'Thermal_OL_NC', address: '%I0.2', type: 'Bool', area: 'I', init: true, comment: '热继电器保护（物理 NC）' },
      { name: 'M_Run_Latch', address: '%M0.0', type: 'Bool', area: 'M', init: false, comment: '主运行自锁标志' },
      { name: 'M_Star_Done', address: '%M0.1', type: 'Bool', area: 'M', init: false, comment: '星形 4s 降压结束标志' },
      { name: 'M_Deadtime_Done', address: '%M0.2', type: 'Bool', area: 'M', init: false, comment: '300ms 灭弧死区结束标志' },
      { name: 'TON_Star_ET', address: 'DB1.DBD4', type: 'Time', area: 'DB', init: 0, comment: '星形启动已计时 ET (ms)', unit: 'ms' },
      { name: 'TON_Dead_ET', address: 'DB2.DBD4', type: 'Time', area: 'DB', init: 0, comment: '切换死区已计时 ET (ms)', unit: 'ms' },
      { name: 'KM_Main', address: '%Q0.0', type: 'Bool', area: 'Q', init: false, comment: '主电源接触器 KM_Main' },
      { name: 'KM_Star', address: '%Q0.1', type: 'Bool', area: 'Q', init: false, comment: '星形降压接触器 KM_Y (0~4.0s)' },
      { name: 'KM_Delta', address: '%Q0.2', type: 'Bool', area: 'Q', init: false, comment: '三角形全压接触器 KM_Δ (≥4.3s)' },
    ],
    fieldInputs: [
      {
        tag: 'Start_PB',
        label: '启动按钮 SB1',
        physicalType: 'NO',
        defaultMomentary: true,
        tone: 'success',
        hint: '启动 Y-Δ 自动降压启动序列',
      },
      {
        tag: 'Stop_NC_PB',
        label: '停止按钮 SB2',
        physicalType: 'NC',
        defaultMomentary: true,
        tone: 'danger',
        hint: '物理常闭：立即停机并复位所有定时器',
      },
      {
        tag: 'Thermal_OL_NC',
        label: '热过载保护 FR',
        physicalType: 'NC',
        defaultMomentary: false,
        tone: 'warn',
        hint: '正常闭合=1，点击模拟过载脱扣=0',
      },
    ],
    fieldOutputs: [
      { tag: 'KM_Main', label: '主接触器 KM_Main', role: 'motor', description: '全过程保持吸合供电' },
      { tag: 'KM_Star', label: '星形接触器 KM_Y', role: 'star', description: '前 4.0s 降压至 1/3 转矩启动' },
      { tag: 'KM_Delta', label: '三角形接触器 KM_Δ', role: 'delta', description: '300ms 灭弧死区后切入全压运行' },
    ],
    program: {
      id: 'ton-star-delta',
      name: 'OB1_TON_Star_Delta',
      networks: [
        {
          id: 'sd-nw1',
          number: 1,
          title: '主接触器 KM_Main 起保停自锁',
          comment: '启动后立即吸合主接触器 KM_Main，并置位主运行标志 M_Run_Latch。',
          nodes: [
            {
              kind: 'BRANCH',
              id: 'sd-1-br',
              branches: [
                [{ kind: 'NO', id: 'sd-1-1', tag: 'Start_PB' }],
                [{ kind: 'NO', id: 'sd-1-2', tag: 'M_Run_Latch' }],
              ],
            },
            { kind: 'NO', id: 'sd-1-3', tag: 'Stop_NC_PB' },
            { kind: 'NO', id: 'sd-1-4', tag: 'Thermal_OL_NC' },
            {
              kind: 'OUTPUT_BRANCH',
              id: 'sd-1-out',
              outputs: [
                [{ kind: 'OTE', id: 'sd-1-5', tag: 'M_Run_Latch' }],
                [{ kind: 'OTE', id: 'sd-1-6', tag: 'KM_Main' }],
              ],
            },
          ],
        },
        {
          id: 'sd-nw2',
          number: 2,
          title: 'TON_Star_DB：星形降压启动定时 (PT = T#4s)',
          comment: '主运行标志导通期间累计计时，达到 4000ms 时输出 M_Star_Done=1 触发星形脱扣。',
          nodes: [
            { kind: 'NO', id: 'sd-2-1', tag: 'M_Run_Latch' },
            {
              kind: 'TIMER',
              id: 'sd-2-2',
              timerType: 'TON',
              dbName: 'TON_Star_DB',
              ptMs: 4000,
              qTag: 'M_Star_Done',
              etTag: 'TON_Star_ET',
            },
            { kind: 'OTE', id: 'sd-2-3', tag: 'M_Star_Done' },
          ],
        },
        {
          id: 'sd-nw3',
          number: 3,
          title: 'TON_Dead_DB：切换灭弧死区定时 (PT = T#300ms)',
          comment: '工程关键保护：等待 KM_Star 物理触点完全释放并熄灭电弧 300ms 后再允许吸合 KM_Delta。',
          nodes: [
            { kind: 'NO', id: 'sd-3-1', tag: 'M_Star_Done' },
            {
              kind: 'TIMER',
              id: 'sd-3-2',
              timerType: 'TON',
              dbName: 'TON_Dead_DB',
              ptMs: 300,
              qTag: 'M_Deadtime_Done',
              etTag: 'TON_Dead_ET',
            },
            { kind: 'OTE', id: 'sd-3-3', tag: 'M_Deadtime_Done' },
          ],
        },
        {
          id: 'sd-nw4',
          number: 4,
          title: '星形接触器 KM_Star 输出（0 ~ 4.0s，与 KM_Delta 互锁）',
          nodes: [
            { kind: 'NO', id: 'sd-4-1', tag: 'M_Run_Latch' },
            { kind: 'NC', id: 'sd-4-2', tag: 'M_Star_Done' },
            { kind: 'NC', id: 'sd-4-3', tag: 'KM_Delta' },
            { kind: 'OTE', id: 'sd-4-4', tag: 'KM_Star' },
          ],
        },
        {
          id: 'sd-nw5',
          number: 5,
          title: '三角形接触器 KM_Delta 输出（死区结束后全压运行，与 KM_Star 互锁）',
          nodes: [
            { kind: 'NO', id: 'sd-5-1', tag: 'M_Run_Latch' },
            { kind: 'NO', id: 'sd-5-2', tag: 'M_Deadtime_Done' },
            { kind: 'NC', id: 'sd-5-3', tag: 'KM_Star' },
            { kind: 'OTE', id: 'sd-5-4', tag: 'KM_Delta' },
          ],
        },
      ],
    },
    sclCode: `// S7-1200 OB1 等效 SCL 代码：星三角(Y-Δ)降压启动（含 300ms 灭弧死区）
REGION Network_1_Main_Contactor
    "M_Run_Latch" := ("Start_PB" OR "M_Run_Latch")
                     AND "Stop_NC_PB"
                     AND "Thermal_OL_NC";
    "KM_Main" := "M_Run_Latch";
END_REGION

REGION Network_2_Star_Stage_Timer
    "TON_Star_DB"(IN := "M_Run_Latch",
                  PT := T#4s,
                  Q  => "M_Star_Done",
                  ET => "TON_Star_ET");
END_REGION

REGION Network_3_Arc_Deadtime_Timer
    // 300ms 切换死区：确保星形接触器完全分断后再吸合三角形
    "TON_Dead_DB"(IN := "M_Star_Done",
                  PT := T#300ms,
                  Q  => "M_Deadtime_Done",
                  ET => "TON_Dead_ET");
END_REGION

REGION Network_4_5_Star_Delta_Outputs
    "KM_Star"  := "M_Run_Latch" AND (NOT "M_Star_Done") AND (NOT "KM_Delta");
    "KM_Delta" := "M_Run_Latch" AND "M_Deadtime_Done"   AND (NOT "KM_Star");
END_REGION`,
    traceChannels: [
      { id: 'ch1', tag: 'KM_Main', label: '主接触器', address: '%Q0.0', kind: 'bool', color: '#38bdf8' },
      { id: 'ch2', tag: 'KM_Star', label: '星形 KM_Y', address: '%Q0.1', kind: 'bool', color: '#f59e0b' },
      { id: 'ch3', tag: 'KM_Delta', label: '三角 KM_Δ', address: '%Q0.2', kind: 'bool', color: '#10b981' },
      { id: 'ch4', tag: 'TON_Star_ET', label: 'TON_Star.ET', address: 'DB1.DBD4', kind: 'number', color: '#a78bfa', min: 0, max: 4000, unit: 'ms' },
      { id: 'ch5', tag: 'M_Deadtime_Done', label: '死区结束', address: '%M0.2', kind: 'bool', color: '#ec4899' },
    ],
  },

  'ctu-batch-pack': {
    id: 'ctu-batch-pack',
    title: '光电上升沿 + CTU 满箱计数自动封箱与复位',
    shortTitle: 'CTU 产线计件与封箱',
    subtitle: '上升沿防重复计数、满 6 件自动暂停传送带并触发 2.5s 封箱气缸',
    badge: '阶段 02 · IEC 计数器实战',
    tags: ['CTU 增计数', 'P_TRIG 防抖', 'TON 保压自动复位', '产线包装'],
    teachingSummary:
      '包装线工件经过光电传感器 %I0.1 时会挡光几十个扫描周期。借助 P_TRIG 上升沿，每件产品严格只触发 1 次 CTU 增计数；计满 PV=6 件后自动停传送带、伸出封箱气缸保压 2.5s，随后自动清零计数恢复下一箱进料！',
    trySteps: [
      '连续点击 %I0.1 光电传感器 6 次（即使长按挡光，观察 CV 也只加 1 次！），观看 CTU_Batch_DB 的实时计件进度条。',
      '第 6 次触发瞬间：传送带 %Q0.0 自动停止进料，封箱气缸 %Q0.1 与满箱灯 %Q0.2 亮起，NW 4 的 TON_Seal_DB 开始 2.5s 保压计时。',
      '2.5s 到达后观察自动闭环：NW 5 产生复位脉冲将 CTU 清零，气缸缩回、传送带恢复运行！也可随时按 %I0.2 手动清零。',
    ],
    interviewNote:
      '产线计件三大避坑：① 必须用上升沿计件防止挡光重复累加；② 满箱执行封箱动作期间要锁闭计件输入防止多计；③ 自动清零脉冲只需维持 1 个扫描周期即可完成 CTU 复位。',
    tagDefs: [
      { name: 'System_Enable', address: '%I0.0', type: 'Bool', area: 'I', init: true, comment: '产线总运行使能开关' },
      { name: 'Photo_Sensor', address: '%I0.1', type: 'Bool', area: 'I', init: false, comment: '光电计件传感器 B1（来料=1）' },
      { name: 'Manual_Reset_PB', address: '%I0.2', type: 'Bool', area: 'I', init: false, comment: '手动清零计数按钮' },
      { name: 'M_Part_Edge', address: '%M0.0', type: 'Bool', area: 'M', init: false, comment: '工件通过上升沿单周期脉冲' },
      { name: 'M_Batch_Full', address: '%M0.1', type: 'Bool', area: 'M', init: false, comment: '满 6 件封箱触发标志 (QU)' },
      { name: 'M_Seal_Done', address: '%M0.2', type: 'Bool', area: 'M', init: false, comment: '封箱保压 2.5s 完成标志' },
      { name: 'M_Reset_All', address: '%M0.3', type: 'Bool', area: 'M', init: false, comment: '计数器清零汇总信号' },
      { name: 'Box_Count_CV', address: 'DB3.DBW2', type: 'Int', area: 'DB', init: 0, comment: '当前箱内件数 CV (0..6)', unit: '件' },
      { name: 'TON_Seal_ET', address: 'DB4.DBD4', type: 'Time', area: 'DB', init: 0, comment: '封箱气缸保压计时 ET (ms)', unit: 'ms' },
      { name: 'Conveyor_Run', address: '%Q0.0', type: 'Bool', area: 'Q', init: false, comment: '进料传送带电机（封箱时暂停）' },
      { name: 'Sealer_Cyl', address: '%Q0.1', type: 'Bool', area: 'Q', init: false, comment: '封箱推杆气缸电磁阀 YV1' },
      { name: 'Box_Full_Lamp', address: '%Q0.2', type: 'Bool', area: 'Q', init: false, comment: '满箱封箱中状态指示灯' },
    ],
    fieldInputs: [
      {
        tag: 'System_Enable',
        label: '产线运行使能',
        physicalType: 'NO',
        defaultMomentary: false,
        tone: 'success',
        hint: '拨码保持：开启=1 传送带允许进料',
      },
      {
        tag: 'Photo_Sensor',
        label: '光电传感器 B1',
        physicalType: 'NO',
        defaultMomentary: true,
        tone: 'info',
        hint: '每点击一次模拟 1 个工件通过光电门',
      },
      {
        tag: 'Manual_Reset_PB',
        label: '手动清零按钮',
        physicalType: 'NO',
        defaultMomentary: true,
        tone: 'warn',
        hint: '立即将当前箱计数 CV 复位为 0',
      },
    ],
    fieldOutputs: [
      { tag: 'Conveyor_Run', label: '进料传送带', role: 'motor', description: '计件期间持续进料，封箱时暂停' },
      { tag: 'Sealer_Cyl', label: '封箱气缸 YV1', role: 'cylinder', description: '满 6 件自动伸出保压 2.5s' },
      { tag: 'Box_Full_Lamp', label: '满箱指示灯', role: 'lamp-amber', description: '正在执行封箱动作时点亮' },
    ],
    program: {
      id: 'ctu-batch-pack',
      name: 'OB1_CTU_Batch_Pack',
      networks: [
        {
          id: 'bp-nw1',
          number: 1,
          title: '光电传感器上升沿 P_TRIG 计件脉冲（封箱期间锁闭）',
          comment: '仅在产线使能且未满箱时捕捉光电门上升沿，防止工件长时间遮挡造成重复计数。',
          nodes: [
            { kind: 'NO', id: 'bp-1-1', tag: 'System_Enable' },
            { kind: 'NC', id: 'bp-1-2', tag: 'M_Batch_Full' },
            { kind: 'P_TRIG', id: 'bp-1-3', tag: 'Photo_Sensor', memTag: '%M0.0' },
            { kind: 'OTE', id: 'bp-1-4', tag: 'M_Part_Edge' },
          ],
        },
        {
          id: 'bp-nw2',
          number: 2,
          title: 'CTU_Batch_DB：满箱计数器（PV = 6 件）',
          comment: '每收到 1 个上升沿脉冲 CV+1；当 CV >= 6 时输出满箱标志 M_Batch_Full=1。',
          nodes: [
            { kind: 'NO', id: 'bp-2-1', tag: 'M_Part_Edge' },
            {
              kind: 'COUNTER',
              id: 'bp-2-2',
              counterType: 'CTU',
              dbName: 'CTU_Batch_DB',
              pv: 6,
              resetTag: 'M_Reset_All',
              cvTag: 'Box_Count_CV',
              qTag: 'M_Batch_Full',
            },
            { kind: 'OTE', id: 'bp-2-3', tag: 'M_Batch_Full' },
          ],
        },
        {
          id: 'bp-nw3',
          number: 3,
          title: '满箱自动驱动封箱气缸 YV1 与指示灯',
          nodes: [
            { kind: 'NO', id: 'bp-3-1', tag: 'M_Batch_Full' },
            {
              kind: 'OUTPUT_BRANCH',
              id: 'bp-3-out',
              outputs: [
                [{ kind: 'OTE', id: 'bp-3-2', tag: 'Sealer_Cyl' }],
                [{ kind: 'OTE', id: 'bp-3-3', tag: 'Box_Full_Lamp' }],
              ],
            },
          ],
        },
        {
          id: 'bp-nw4',
          number: 4,
          title: 'TON_Seal_DB：封箱保压定时 (PT = T#2.5s)',
          comment: '气缸伸出保压 2500ms 后置位 M_Seal_Done，下一扫描周期自动清零计数器。',
          nodes: [
            { kind: 'NO', id: 'bp-4-1', tag: 'M_Batch_Full' },
            {
              kind: 'TIMER',
              id: 'bp-4-2',
              timerType: 'TON',
              dbName: 'TON_Seal_DB',
              ptMs: 2500,
              qTag: 'M_Seal_Done',
              etTag: 'TON_Seal_ET',
            },
            { kind: 'OTE', id: 'bp-4-3', tag: 'M_Seal_Done' },
          ],
        },
        {
          id: 'bp-nw5',
          number: 5,
          title: '手动清零 OR 封箱完成自动复位 + 进料传送带联锁',
          comment: '利用扫描周期顺序，M_Seal_Done 触发 M_Reset_All 后在下一扫描周期初清零 CTU。',
          nodes: [
            {
              kind: 'BRANCH',
              id: 'bp-5-br',
              branches: [
                [{ kind: 'NO', id: 'bp-5-1', tag: 'Manual_Reset_PB' }],
                [{ kind: 'NO', id: 'bp-5-2', tag: 'M_Seal_Done' }],
              ],
            },
            { kind: 'OTE', id: 'bp-5-3', tag: 'M_Reset_All' },
          ],
        },
        {
          id: 'bp-nw6',
          number: 6,
          title: '进料传送带联锁运行（封箱动作期间自动停带）',
          nodes: [
            { kind: 'NO', id: 'bp-6-1', tag: 'System_Enable' },
            { kind: 'NC', id: 'bp-6-2', tag: 'M_Batch_Full' },
            { kind: 'OTE', id: 'bp-6-3', tag: 'Conveyor_Run' },
          ],
        },
      ],
    },
    sclCode: `// S7-1200 OB1 等效 SCL 代码：光电上升沿计件 + CTU 满箱自动封箱
REGION Network_1_Photo_Rising_Edge
    "R_TRIG_Photo"(CLK := "Photo_Sensor");
    "M_Part_Edge" := "System_Enable" AND (NOT "M_Batch_Full") AND "R_TRIG_Photo".Q;
END_REGION

REGION Network_2_Batch_Counter
    "CTU_Batch_DB"(CU := "M_Part_Edge",
                   R  := "M_Reset_All",
                   PV := 6,
                   Q  => "M_Batch_Full",
                   CV => "Box_Count_CV");
END_REGION

REGION Network_3_4_Sealer_And_Timer
    "Sealer_Cyl"    := "M_Batch_Full";
    "Box_Full_Lamp" := "M_Batch_Full";
    "TON_Seal_DB"(IN := "M_Batch_Full",
                  PT := T#2s500ms,
                  Q  => "M_Seal_Done",
                  ET => "TON_Seal_ET");
END_REGION

REGION Network_5_6_Reset_And_Conveyor
    "M_Reset_All"  := "Manual_Reset_PB" OR "M_Seal_Done";
    "Conveyor_Run" := "System_Enable" AND (NOT "M_Batch_Full");
END_REGION`,
    traceChannels: [
      { id: 'ch1', tag: 'Photo_Sensor', label: '光电传感器', address: '%I0.1', kind: 'bool', color: '#38bdf8' },
      { id: 'ch2', tag: 'Box_Count_CV', label: '箱内件数 CV', address: 'DB3.DBW2', kind: 'number', color: '#a78bfa', min: 0, max: 6, unit: '件' },
      { id: 'ch3', tag: 'Conveyor_Run', label: '传送带', address: '%Q0.0', kind: 'bool', color: '#10b981' },
      { id: 'ch4', tag: 'Sealer_Cyl', label: '封箱气缸', address: '%Q0.1', kind: 'bool', color: '#f59e0b' },
      { id: 'ch5', tag: 'TON_Seal_ET', label: '保压 ET', address: 'DB4.DBD4', kind: 'number', color: '#ec4899', min: 0, max: 2500, unit: 'ms' },
    ],
  },

  'analog-scale-pid': {
    id: 'analog-scale-pid',
    title: '模拟量 NORM_X / SCALE_X 换算与储罐液位控制',
    shortTitle: '模拟量缩放与液位控制',
    subtitle: '4~20mA (0..27648) 标准两步换算 + 25%/80% 迟滞补水泵 + ≥90% 高高报警',
    badge: '阶段 03 · 模拟量与过程控制',
    tags: ['%IW64 (0..27648)', 'NORM_X', 'SCALE_X', '迟滞回差', '4~20mA'],
    teachingSummary:
      '西门子 S7-1200 模拟量通道将 4~20mA 变送器信号采样为整数 0 ~ 27648（%IW64）。标准工程做法先经 NORM_X 归一化为 0.0~1.0，再经 SCALE_X 线性映射为 0.0~100.0% 工程液位，并利用迟滞回差（≤25% 启泵、≥80% 停泵）防止水泵在阈值附近频繁抖动启停！',
    trySteps: [
      '拖动右侧 4~20mA 液位滑块 %IW64 至 20%（约 5530 / 7.20mA），观察 NW 1 中 NORM_X 与 SCALE_X 实时换算，NW 2 补水泵 %Q0.0 自动吸合并自锁！',
      '缓慢推高液位到 50%：因为自锁回差，补水泵继续稳定补水不会抖动；当液位达到 ≥80% 时比较块 (<80%) 断开，补水泵优雅停机。',
      '将液位拉到 94% 触发高高液位报警 %Q0.1 与紧急排液阀 %Q0.2；降至正常后点击 %I0.1 报警消音复位。还可打开“储罐物理自动联动”看闭环波动波形！',
    ],
    interviewNote:
      '西门子面试必背数字：S7-1200/1500 模拟量单极性额定满量程为 27648（对应 20mA 或 10V），超量程上限 32511，溢出 32767。选用 4~20mA 而非 0~20mA 是为了利用 0mA (负值/断线) 识别仪表断线故障！',
    tagDefs: [
      { name: 'Auto_Mode', address: '%I0.0', type: 'Bool', area: 'I', init: true, comment: '自动液位控制模式投入' },
      { name: 'Alarm_Ack_PB', address: '%I0.1', type: 'Bool', area: 'I', init: false, comment: '高高报警消音/复位按钮' },
      { name: 'AI_Level_Raw', address: '%IW64', type: 'Int', area: 'I', init: 8294, comment: '4~20mA 液位变送器原始通道值 (0..27648)' },
      { name: 'Norm_Level', address: '%MD20', type: 'Real', area: 'M', init: 0.3, comment: 'NORM_X 归一化中间值 (0.0..1.0)' },
      { name: 'Level_Pct', address: '%MD24', type: 'Real', area: 'M', init: 30.0, comment: 'SCALE_X 储罐工程液位 (0.0..100.0%)', unit: '%' },
      { name: 'Pump_Fill', address: '%Q0.0', type: 'Bool', area: 'Q', init: false, comment: '自动补水泵接触器 (≤25%启 / ≥80%停)' },
      { name: 'Alarm_HH', address: '%Q0.1', type: 'Bool', area: 'Q', init: false, comment: '高高液位 (≥90%) 声光报警自锁' },
      { name: 'Valve_Drain_Safe', address: '%Q0.2', type: 'Bool', area: 'Q', init: false, comment: '超高液位紧急溢流排液电磁阀' },
    ],
    fieldInputs: [
      {
        tag: 'Auto_Mode',
        label: '自动控制投入',
        physicalType: 'NO',
        defaultMomentary: false,
        tone: 'success',
        hint: '开启自动液位迟滞补水逻辑',
      },
      {
        tag: 'Alarm_Ack_PB',
        label: '报警消音复位',
        physicalType: 'NO',
        defaultMomentary: true,
        tone: 'warn',
        hint: '液位回落至 <90% 后按下解除高高报警锁存',
      },
    ],
    analogInputs: [
      {
        tag: 'AI_Level_Raw',
        label: '液位变送器 4~20mA',
        minRaw: 0,
        maxRaw: 27648,
        unitLabel: '% 液位',
        supportsClosedLoopTank: true,
        presets: [
          { label: '15% 低液位', raw: 4147, tone: 'info' },
          { label: '50% 正常', raw: 13824, tone: 'success' },
          { label: '83% 满液位', raw: 22948, tone: 'warn' },
          { label: '94% 高高报警', raw: 25989, tone: 'danger' },
        ],
      },
    ],
    fieldOutputs: [
      { tag: 'Pump_Fill', label: '自动补水泵', role: 'pump', description: '液位 ≤25% 自动启动，达 80% 停止' },
      { tag: 'Alarm_HH', label: '高高液位报警', role: 'alarm', description: '液位 ≥90% 触发并锁存声光报警' },
      { tag: 'Valve_Drain_Safe', label: '紧急溢流阀', role: 'valve', description: '高高报警期间开启防冒罐排液' },
    ],
    program: {
      id: 'analog-scale-pid',
      name: 'OB1_Analog_Level_Control',
      networks: [
        {
          id: 'al-nw1',
          number: 1,
          title: '西门子标准两步模拟量换算：NORM_X (0..27648) → SCALE_X (0..100%)',
          comment: '将 %IW64 原始整形数归一化到 0.0~1.0，再线性映射为工程液位百分比 %MD24。',
          nodes: [
            {
              kind: 'NORM_X',
              id: 'al-1-1',
              blockName: 'NORM_X',
              min: 0,
              max: 27648,
              valueTag: 'AI_Level_Raw',
              outTag: 'Norm_Level',
            },
            {
              kind: 'SCALE_X',
              id: 'al-1-2',
              blockName: 'SCALE_X',
              min: 0,
              max: 100,
              valueTag: 'Norm_Level',
              outTag: 'Level_Pct',
              unit: '%',
            },
          ],
        },
        {
          id: 'al-nw2',
          number: 2,
          title: '高低液位迟滞防抖补水泵（≤25% 启泵，自锁至 80% 停泵）',
          comment: '利用比较器 + 自锁回路构造 25%~80% 回差死区，杜绝液面波动引起水泵频繁启停烧毁接触器。',
          nodes: [
            { kind: 'NO', id: 'al-2-1', tag: 'Auto_Mode' },
            {
              kind: 'BRANCH',
              id: 'al-2-br',
              branches: [
                [{ kind: 'CMP', id: 'al-2-2', op: '<=', leftTag: 'Level_Pct', rightValue: 25, unit: '%' }],
                [{ kind: 'NO', id: 'al-2-3', tag: 'Pump_Fill' }],
              ],
            },
            { kind: 'CMP', id: 'al-2-4', op: '<', leftTag: 'Level_Pct', rightValue: 80, unit: '%' },
            { kind: 'OTE', id: 'al-2-5', tag: 'Pump_Fill' },
          ],
        },
        {
          id: 'al-nw3',
          number: 3,
          title: '高高液位 (≥90%) 声光报警锁存与紧急溢流排液阀',
          comment: '一旦超过 90% 立即锁存报警并开溢流阀；必须等液位回落且操作员按下消音复位 %I0.1 才解除。',
          nodes: [
            {
              kind: 'BRANCH',
              id: 'al-3-br',
              branches: [
                [{ kind: 'CMP', id: 'al-3-1', op: '>=', leftTag: 'Level_Pct', rightValue: 90, unit: '%' }],
                [
                  { kind: 'NO', id: 'al-3-2', tag: 'Alarm_HH' },
                  { kind: 'NC', id: 'al-3-3', tag: 'Alarm_Ack_PB' },
                ],
              ],
            },
            {
              kind: 'OUTPUT_BRANCH',
              id: 'al-3-out',
              outputs: [
                [{ kind: 'OTE', id: 'al-3-4', tag: 'Alarm_HH' }],
                [{ kind: 'OTE', id: 'al-3-5', tag: 'Valve_Drain_Safe' }],
              ],
            },
          ],
        },
      ],
    },
    sclCode: `// S7-1200 OB1 等效 SCL 代码：模拟量 NORM_X / SCALE_X 与迟滞液位控制
REGION Network_1_Analog_Scaling
    // 第一步：将 S7-1200 模拟量通道 0..27648 (4..20mA) 归一化至 0.0..1.0
    "Norm_Level" := NORM_X(MIN := 0, VALUE := "AI_Level_Raw", MAX := 27648);
    // 第二步：缩放至 0.0..100.0% 储罐液位工程值
    "Level_Pct"  := SCALE_X(MIN := 0.0, VALUE := "Norm_Level", MAX := 100.0);
END_REGION

REGION Network_2_Hysteresis_Pump_Control
    // 迟滞回差控制：低于 25% 启动并自锁，高于 80% 停止
    "Pump_Fill" := "Auto_Mode"
                   AND (("Level_Pct" <= 25.0) OR "Pump_Fill")
                   AND ("Level_Pct" < 80.0);
END_REGION

REGION Network_3_HighHigh_Alarm_Latch
    // 超高液位 >= 90% 报警自锁，需液位回落且按消音复位解除
    "Alarm_HH" := ("Level_Pct" >= 90.0) OR ("Alarm_HH" AND (NOT "Alarm_Ack_PB"));
    "Valve_Drain_Safe" := "Alarm_HH";
END_REGION`,
    traceChannels: [
      { id: 'ch1', tag: 'Level_Pct', label: '工程液位 %', address: '%MD24', kind: 'number', color: '#38bdf8', min: 0, max: 100, unit: '%' },
      { id: 'ch2', tag: 'Pump_Fill', label: '补水泵', address: '%Q0.0', kind: 'bool', color: '#10b981' },
      { id: 'ch3', tag: 'Alarm_HH', label: '高高报警', address: '%Q0.1', kind: 'bool', color: '#ef4444' },
      { id: 'ch4', tag: 'Valve_Drain_Safe', label: '紧急溢流阀', address: '%Q0.2', kind: 'bool', color: '#f59e0b' },
    ],
  },
};

export const SIM_PRESET_ORDER: SimPresetId[] = [
  'wiring-basics',
  'seal-in-motor',
  'reversing-interlock',
  'ton-star-delta',
  'ctu-batch-pack',
  'analog-scale-pid',
];
