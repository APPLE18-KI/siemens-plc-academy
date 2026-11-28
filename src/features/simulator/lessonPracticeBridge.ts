import type { SimPresetId } from '../../types/content';
import type { TagValue } from '../../types/plc';

export interface SimTelemetryEvent {
  presetId: SimPresetId;
  running: boolean;
  fieldInputs: Record<string, TagValue>;
  fieldOutputs: Record<string, TagValue>;
  tags: Record<string, TagValue>;
}

type TelemetryListener = (ev: SimTelemetryEvent) => void;
const listeners = new Set<TelemetryListener>();

export function emitSimTelemetry(ev: SimTelemetryEvent): void {
  listeners.forEach((fn) => fn(ev));
}

export function subscribeSimTelemetry(fn: TelemetryListener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export interface PracticeAutoRule {
  presetId: SimPresetId;
  /** 对应 practice-task.steps 的 0-based 索引 */
  stepIndex: number;
  /** 自动验收通过时弹出的正向反馈 */
  toast: string;
  /** 返回 true 表示本步骤已由学员在仿真器里亲手触发验证 */
  evaluate: (ev: SimTelemetryEvent, mem: Record<string, boolean>) => boolean;
}

/**
 * 课程动手练习与内嵌仿真器的自动感应规则表：
 * 学员在课程内嵌仿真器里实际操作出对应工况时，下方清单自动亮绿勾并弹出即时肯定。
 */
export const LESSON_PRACTICE_AUTO_RULES: Record<string, PracticeAutoRule[]> = {
  'l00-before-you-start': [
    {
      presetId: 'seal-in-motor',
      stepIndex: 2,
      toast: '你亲手按住 SB3 点亮了运行指示灯 HL1！这就是“输入 → 程序 → 输出”。',
      evaluate: (ev) =>
        ev.running && Boolean(ev.fieldInputs['Jog_PB']) && Boolean(ev.fieldOutputs['Lamp_Running']),
    },
    {
      presetId: 'seal-in-motor',
      stepIndex: 3,
      toast: '漂亮！你刚刚完成了 SB1 自锁保持 + SB2 停止关灯的全流程。',
      evaluate: (ev, mem) => {
        if (!ev.running) return false;
        if (Boolean(ev.fieldInputs['Start_PB']) && Boolean(ev.fieldOutputs['Lamp_Running'])) {
          mem['l00_started'] = true;
        }
        if (
          mem['l00_started'] &&
          !Boolean(ev.fieldInputs['Start_PB']) &&
          Boolean(ev.fieldOutputs['Lamp_Running'])
        ) {
          mem['l00_latched'] = true;
        }
        if (
          mem['l00_latched'] &&
          !Boolean(ev.fieldInputs['Stop_NC_PB']) &&
          !Boolean(ev.fieldOutputs['Lamp_Running'])
        ) {
          return true;
        }
        return false;
      },
    },
  ],
  'l02-wiring-npn-pnp': [
    {
      presetId: 'wiring-basics',
      stepIndex: 0,
      toast: '已自动检测到急停拍下：安全回路立刻切断输出并点亮急停报警灯！',
      evaluate: (ev) =>
        ev.running &&
        !Boolean(ev.fieldInputs['EStop_NC_Field']) &&
        Boolean(ev.fieldOutputs['Alarm_EStop_Lamp']),
    },
    {
      presetId: 'wiring-basics',
      stepIndex: 1,
      toast: '已自动检测到安全条件满足下的正常启动输出！',
      evaluate: (ev) =>
        ev.running &&
        Boolean(ev.fieldInputs['Start_NO_PB']) &&
        Boolean(ev.fieldOutputs['Coil_Correct_Run']),
    },
  ],
  'l05-seal-in-jog': [
    {
      presetId: 'seal-in-motor',
      stepIndex: 0,
      toast: '自锁验证通过！松开启动按钮后，%Q0.0 靠并联自锁触点稳稳“拉住”了自己。',
      evaluate: (ev, mem) => {
        if (!ev.running) return false;
        if (Boolean(ev.fieldInputs['Start_PB']) && Boolean(ev.fieldOutputs['Motor_KM1'])) {
          mem['l05_start_pressed'] = true;
        }
        return (
          Boolean(mem['l05_start_pressed']) &&
          !Boolean(ev.fieldInputs['Start_PB']) &&
          !Boolean(ev.fieldInputs['Jog_PB']) &&
          Boolean(ev.fieldOutputs['Motor_KM1'])
        );
      },
    },
    {
      presetId: 'seal-in-motor',
      stepIndex: 1,
      toast: '停止优先验证通过！即使启动按钮按住不放，拍停止也能立刻切断电机。',
      evaluate: (ev) =>
        ev.running &&
        Boolean(ev.fieldInputs['Start_PB']) &&
        !Boolean(ev.fieldInputs['Stop_NC_PB']) &&
        !Boolean(ev.fieldOutputs['Motor_KM1']),
    },
    {
      presetId: 'seal-in-motor',
      stepIndex: 2,
      toast: '热过载跳闸验证通过！FR 常闭断开后电机立即停机，故障灯亮起。',
      evaluate: (ev, mem) => {
        if (!ev.running) return false;
        if (Boolean(ev.fieldOutputs['Motor_KM1'])) mem['l05_was_running'] = true;
        if (
          mem['l05_was_running'] &&
          !Boolean(ev.fieldInputs['Thermal_OL_NC']) &&
          !Boolean(ev.fieldOutputs['Motor_KM1']) &&
          Boolean(ev.fieldOutputs['Lamp_Fault'])
        ) {
          mem['l05_tripped'] = true;
          return true;
        }
        return false;
      },
    },
    {
      presetId: 'seal-in-motor',
      stepIndex: 3,
      toast: '安全防自启验证通过！热继电器复位后电机保持静止，必须人工重新点启动。',
      evaluate: (ev, mem) =>
        ev.running &&
        Boolean(mem['l05_tripped']) &&
        Boolean(ev.fieldInputs['Thermal_OL_NC']) &&
        !Boolean(ev.fieldOutputs['Motor_KM1']) &&
        !Boolean(ev.fieldOutputs['Lamp_Fault']),
    },
  ],
  'l06-interlock-edge': [
    {
      presetId: 'reversing-interlock',
      stepIndex: 0,
      toast: '已验证正转吸合时按反转被软件互锁拦截，避免了主回路相间短路！',
      evaluate: (ev) =>
        ev.running &&
        Boolean(ev.fieldOutputs['KM_Fwd']) &&
        Boolean(ev.fieldInputs['Rev_PB']) &&
        !Boolean(ev.fieldOutputs['KM_Rev']),
    },
    {
      presetId: 'reversing-interlock',
      stepIndex: 1,
      toast: '已验证先停机再切换反转的安全顺序！',
      evaluate: (ev, mem) => {
        if (!ev.running) return false;
        if (Boolean(ev.fieldOutputs['KM_Fwd'])) mem['l06_fwd'] = true;
        return Boolean(mem['l06_fwd']) && Boolean(ev.fieldOutputs['KM_Rev']) && !Boolean(ev.fieldOutputs['KM_Fwd']);
      },
    },
  ],
  'l07-iec-timers': [
    {
      presetId: 'ton-star-delta',
      stepIndex: 0,
      toast: '已捕捉到星形降压启动阶段（KM_Main + KM_Star 吸合）！',
      evaluate: (ev, mem) => {
        if (ev.running && Boolean(ev.fieldOutputs['KM_Main']) && Boolean(ev.fieldOutputs['KM_Star'])) {
          mem['l07_star'] = true;
          return true;
        }
        return false;
      },
    },
    {
      presetId: 'ton-star-delta',
      stepIndex: 1,
      toast: '已自动观测到 TON 计时结束并经灭弧死区平稳切换到三角形运行（KM_Delta）！',
      evaluate: (ev, mem) =>
        ev.running &&
        Boolean(mem['l07_star']) &&
        Boolean(ev.fieldOutputs['KM_Main']) &&
        Boolean(ev.fieldOutputs['KM_Delta']) &&
        !Boolean(ev.fieldOutputs['KM_Star']),
    },
  ],
  'l08-iec-counters': [
    {
      presetId: 'ctu-batch-pack',
      stepIndex: 0,
      toast: '已自动感应到光电触发信号让 CTU 计数器累加计数！',
      evaluate: (ev) => ev.running && Number(ev.tags['Batch_CV'] ?? 0) >= 1,
    },
  ],
  'l13-analog-norm-scale': [
    {
      presetId: 'analog-scale-pid',
      stepIndex: 0,
      toast: '已自动感应到模拟量通道变化并驱动执行机构联动！',
      evaluate: (ev, mem) => {
        const raw = Number(ev.fieldInputs['AI_Level_Raw'] ?? 0);
        if (raw < 4000) mem['l13_low'] = true;
        if (raw > 20000) mem['l13_high'] = true;
        return Boolean(mem['l13_low'] || mem['l13_high']);
      },
    },
  ],
};

export function getAutoStepIndices(lessonId?: string): Set<number> {
  if (!lessonId) return new Set();
  const rules = LESSON_PRACTICE_AUTO_RULES[lessonId];
  if (!rules) return new Set();
  return new Set(rules.map((r) => r.stepIndex));
}
