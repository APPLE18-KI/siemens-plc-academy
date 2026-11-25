import React from 'react';
import type { DemoId } from '../../types/content';
import { StepWalkthrough } from './StepWalkthrough';
import { HMI_FIRST_SCREEN, TIA_DOWNLOAD_MONITOR, TIA_FIRST_PROJECT } from './walkthroughs';
import { DataTypeExplorer } from './DataTypeExplorer';
import { InstructionLab } from './InstructionLab';
import { TroubleshootGuide } from './TroubleshootGuide';
import { TimerDiagram } from './TimerDiagram';
import './demos.css';

export interface DemoEntry {
  id: DemoId;
  title: string;
  kicker: string;
  Component: React.FC;
}

export const demoRegistry: Record<DemoId, DemoEntry> = {
  'tia-first-project': {
    id: 'tia-first-project',
    title: '分步演示：在博途中新建项目并写出第一段程序',
    kicker: '分步操作演示',
    Component: () => <StepWalkthrough steps={TIA_FIRST_PROJECT} doneText="项目建好了！接下来把它下载到仿真 PLC。" />,
  },
  'tia-download-monitor': {
    id: 'tia-download-monitor',
    title: '分步演示：用 S7-PLCSIM 仿真运行并在线监视',
    kicker: '分步操作演示',
    Component: () => <StepWalkthrough steps={TIA_DOWNLOAD_MONITOR} doneText="你已经走完“编译 → 下载 → 运行 → 监视”的完整流程！" />,
  },
  'hmi-first-screen': {
    id: 'hmi-first-screen',
    title: '分步演示：做第一个触摸屏画面',
    kicker: '分步操作演示',
    Component: () => <StepWalkthrough steps={HMI_FIRST_SCREEN} doneText="第一个 HMI 画面完成！" />,
  },
  'data-type-explorer': {
    id: 'data-type-explorer',
    title: '互动演示：地址重叠与数据类型',
    kicker: '互动演示',
    Component: DataTypeExplorer,
  },
  'instruction-lab': {
    id: 'instruction-lab',
    title: '互动实验台：比较、移动与数学指令',
    kicker: '互动演示',
    Component: InstructionLab,
  },
  'troubleshoot-guide': {
    id: 'troubleshoot-guide',
    title: '互动排错向导',
    kicker: '互动演示',
    Component: TroubleshootGuide,
  },
  'timer-diagram': {
    id: 'timer-diagram',
    title: '互动时序图：TON / TOF / TP 有什么不同',
    kicker: '互动演示',
    Component: TimerDiagram,
  },
};
