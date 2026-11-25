import type { ModelId } from '../../types/content';
import type { PlcRuntime, TagDataType, TagDef, TagValue } from '../../types/plc';

export interface SclDiagnostic {
  line: number;
  col: number;
  severity: 'error' | 'warning';
  message: string;
  hint?: string;
}

export interface SclCompileResult {
  ok: boolean;
  diagnostics: SclDiagnostic[];
  referencedTags: string[];
  compileTimeMs: number;
}

export type SclBlockKind = 'TON' | 'TOF' | 'TP' | 'CTU' | 'CTD' | 'R_TRIG' | 'F_TRIG';

export interface SclBlockInstanceState {
  name: string;
  kind: SclBlockKind;
  fields: Record<string, TagValue>;
}

export interface SclLineTelemetry {
  line: number;
  executed: boolean;
  values: Array<{
    expr: string;
    value: TagValue;
    formatted: string;
  }>;
}

export interface SclScanSnapshot {
  cycleCount: number;
  scanDurationMs: number;
  cpuMode: 'RUN' | 'STOP';
  onlineMonitoring: boolean;
  lineTelemetry: Record<number, SclLineTelemetry>;
  instances: Record<string, SclBlockInstanceState>;
  forcedTags: Record<string, TagValue>;
  runtimeError?: {
    line: number;
    message: string;
  };
}

export interface SclVmSession {
  readonly runtime: PlcRuntime;
  compile(ob1Code: string, ob100Code?: string): SclCompileResult;
  download(ob1Code: string, ob100Code?: string, runStartupOb100?: boolean): SclCompileResult;
  updateTagDefs(tagDefs: TagDef[]): void;
  setCpuMode(mode: 'RUN' | 'STOP'): void;
  getCpuMode(): 'RUN' | 'STOP';
  stepSingleScan(dtMs?: number): void;
  resetMemory(): void;
  setForcedTag(tagName: string, value: TagValue | null): void;
  clearAllForces(): void;
  getSnapshot(): SclScanSnapshot;
  subscribeSnapshot(listener: (snapshot: SclScanSnapshot) => void): () => void;
}

export interface SclProjectTemplate {
  id: string;
  title: string;
  subtitle: string;
  difficulty: '入门' | '进阶' | '综合';
  linkedModelId?: ModelId;
  tagDefs: TagDef[];
  ob100Code: string;
  ob1Code: string;
  guideSteps: string[];
}

/**
 * 4 大数字孪生设备与博途在线编程 IDE 实时联调的标准 PLC 变量映射表（双方严格按此符号名和地址通信）
 */
export const TWIN_RUNTIME_TAG_SPECS: Record<ModelId, TagDef[]> = {
  's7-1200-wiring': [
    { name: 'Start_PB', address: '%I0.0', type: 'Bool', area: 'I', init: false, comment: '绿色启动按钮 SB1 (常开 NO)' },
    { name: 'Stop_PB', address: '%I0.1', type: 'Bool', area: 'I', init: true, comment: '红色停止按钮 SB2 (物理常闭 NC，未按=TRUE)' },
    { name: 'EStop_OK', address: '%I0.2', type: 'Bool', area: 'I', init: true, comment: '急停蘑菇头 (物理常闭 NC，正常=TRUE)' },
    { name: 'Photo_BG1', address: '%I0.3', type: 'Bool', area: 'I', init: false, comment: '漫反射光电传感器 BG1' },
    { name: 'FR1_OK', address: '%I0.4', type: 'Bool', area: 'I', init: true, comment: '热过载继电器常闭触点 (正常=TRUE)' },
    { name: 'KM1_Motor', address: '%Q0.0', type: 'Bool', area: 'Q', init: false, comment: '主接触器 KM1（驱动三相异步电机）' },
    { name: 'HL_Run', address: '%Q0.1', type: 'Bool', area: 'Q', init: false, comment: '电控柜绿色运行指示灯' },
    { name: 'HL_Fault', address: '%Q0.2', type: 'Bool', area: 'Q', init: false, comment: '电控柜红色故障指示灯' },
  ],
  'sorting-conveyor': [
    { name: 'EStop_OK', address: '%I0.1', type: 'Bool', area: 'I', init: true, comment: '产线急停正常信号 (NC)' },
    { name: 'PE_Infeed', address: '%I0.2', type: 'Bool', area: 'I', init: false, comment: '上料工位对射光电传感器' },
    { name: 'Prox_Metal', address: '%I0.3', type: 'Bool', area: 'I', init: false, comment: '电感式金属接近开关（检测到银色金属=TRUE）' },
    { name: 'Cam_Trig', address: '%I0.4', type: 'Bool', area: 'I', init: false, comment: '视觉相机工位到位触发' },
    { name: 'Cam_IsDefect', address: '%I1.0', type: 'Bool', area: 'I', init: false, comment: '视觉检测结果：红色超差次品=TRUE' },
    { name: 'Cyl1_Ret', address: '%I0.5', type: 'Bool', area: 'I', init: true, comment: '1# 金属分拣气缸缩回到位磁性开关' },
    { name: 'Cyl1_Ext', address: '%I0.6', type: 'Bool', area: 'I', init: false, comment: '1# 金属分拣气缸伸出到位磁性开关' },
    { name: 'PE_EndBox', address: '%I0.7', type: 'Bool', area: 'I', init: false, comment: '末端合格品入箱计数光电' },
    { name: 'VFD_Run', address: '%Q0.0', type: 'Bool', area: 'Q', init: true, comment: 'SINAMICS G120 皮带正转运行使能' },
    { name: 'Sol_Cyl1', address: '%Q0.1', type: 'Bool', area: 'Q', init: false, comment: '1# 金属分拣气缸推进电磁阀' },
    { name: 'Sol_Cyl2', address: '%Q0.2', type: 'Bool', area: 'Q', init: false, comment: '2# 次品剔除气缸推进电磁阀' },
    { name: 'HL_Alarm', address: '%Q0.3', type: 'Bool', area: 'Q', init: false, comment: '三色声光报警塔红灯告警' },
    { name: 'VFD_FreqRef', address: '%QW80', type: 'Int', area: 'Q', init: 19354, unit: 'raw', comment: '变频器速度给定 (0~27648 对应 0~50Hz)' },
  ],
  'tank-pressure-pid': [
    { name: 'Pump1_OK', address: '%I0.0', type: 'Bool', area: 'I', init: true, comment: '1# 主变频水泵热继正常 (NC)' },
    { name: 'HH_Switch', address: '%I0.1', type: 'Bool', area: 'I', init: false, comment: '储液罐高高液位溢流开关 (≥90% 触发)' },
    { name: 'AI_Level_Raw', address: '%IW64', type: 'Int', area: 'I', init: 13824, unit: 'raw', comment: '4-20mA 液位变送器原始值 (0~27648 → 0~100%，断线<0)' },
    { name: 'AI_Temp_Raw', address: '%IW66', type: 'Int', area: 'I', init: 7188, unit: 'raw', comment: 'PT100 水温变送器原始值 (0~27648 → 0~100°C)' },
    { name: 'Pump1_Run', address: '%Q0.0', type: 'Bool', area: 'Q', init: true, comment: '1# 主变频泵启动输出' },
    { name: 'Pump2_Aux', address: '%Q0.1', type: 'Bool', area: 'Q', init: false, comment: '2# 工频副增压泵投入输出' },
    { name: 'Heater_SSR', address: '%Q0.2', type: 'Bool', area: 'Q', init: false, comment: '储罐电加热管固态继电器输出' },
    { name: 'AO_Pump1_Spd', address: '%QW80', type: 'Int', area: 'Q', init: 15000, unit: 'raw', comment: '1# 变频泵转速模拟量输出 (0~27648 → 0~100%)' },
  ],
  'traffic-intersection': [
    { name: 'Night_Mode', address: '%I0.1', type: 'Bool', area: 'I', init: false, comment: '夜间黄灯闪烁模式旋钮' },
    { name: 'Ped_Request', address: '%I0.2', type: 'Bool', area: 'I', init: false, comment: '斑马线行人过街请求按钮' },
    { name: 'Emerg_Green', address: '%I0.3', type: 'Bool', area: 'I', init: false, comment: '消防车紧急绿波通道信号' },
    { name: 'EW_Red', address: '%Q0.0', type: 'Bool', area: 'Q', init: false, comment: '东西主干道红灯' },
    { name: 'EW_Yellow', address: '%Q0.1', type: 'Bool', area: 'Q', init: false, comment: '东西主干道黄灯' },
    { name: 'EW_Green', address: '%Q0.2', type: 'Bool', area: 'Q', init: true, comment: '东西主干道绿灯' },
    { name: 'NS_Red', address: '%Q0.3', type: 'Bool', area: 'Q', init: true, comment: '南北次干道红灯' },
    { name: 'NS_Yellow', address: '%Q0.4', type: 'Bool', area: 'Q', init: false, comment: '南北次干道黄灯' },
    { name: 'NS_Green', address: '%Q0.5', type: 'Bool', area: 'Q', init: false, comment: '南北次干道绿灯' },
    { name: 'Ped_Walk', address: '%Q0.6', type: 'Bool', area: 'Q', init: false, comment: '斑马线行人通行绿灯' },
  ],
};

export function formatPlcValueHelper(val: TagValue, type?: TagDataType): string {
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (type === 'Time') {
    const ms = Math.max(0, Math.round(val));
    if (ms < 1000) return `T#${ms}ms`;
    const s = Math.floor(ms / 1000);
    const rem = ms % 1000;
    return rem === 0 ? `T#${s}s` : `T#${s}s${rem}ms`;
  }
  if (type === 'Real' || !Number.isInteger(val)) {
    return Number(val).toFixed(2);
  }
  return String(Math.round(val));
}
