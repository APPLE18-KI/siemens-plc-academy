import type { ModelEntry, ModelId } from '../../types/content';
import { S71200WiringTwin } from './S71200WiringTwin';
import { SortingConveyorTwin } from './SortingConveyorTwin';
import { TankPressurePidTwin } from './TankPressurePidTwin';
import { TrafficIntersectionTwin } from './TrafficIntersectionTwin';
import { ModelsShowcase } from './ModelsShowcase';

export const modelRegistry: Record<ModelId, ModelEntry> = {
  's7-1200-wiring': {
    id: 's7-1200-wiring',
    title: 'S7-1200 CPU 1214C 硬件拆解与外围接线实训台',
    subtitle: '顶底端子排、NPN/PNP 双向光耦校验、KA 继电器与三相电机回路',
    tags: ['DC/DC/DC', 'PNP/NPN', '1M 公共端', '启保停'],
    Component: S71200WiringTwin,
  },
  'sorting-conveyor': {
    id: 'sorting-conveyor',
    title: '三工位视觉检测与气动分拣传送带',
    subtitle: '对射光电 + 电感接近 + 视觉闪光拍照 + 双气缸超时联锁',
    tags: ['视觉分拣', '气缸磁性开关', '变频皮带', '声光报警塔'],
    Component: SortingConveyorTwin,
  },
  'tank-pressure-pid': {
    id: 'tank-pressure-pid',
    title: '双泵恒压供水与储液罐热工 PID 闭环模型',
    subtitle: '一阶液位/热工微分仿真、4-20mA 断线保护与三曲线实时示波器',
    tags: ['4-20mA', 'PID_Compact', '双泵加减泵', '溢流联锁'],
    Component: TankPressurePidTwin,
  },
  'traffic-intersection': {
    id: 'traffic-intersection',
    title: '智能十字路口四向车流与人行请求联锁模型',
    subtitle: '多时段车流排队仿真、行人优先、消防绿波与绿灯冲突硬件保护',
    tags: ['状态机', '全红清空', '绿灯冲突检测', '故障安全'],
    Component: TrafficIntersectionTwin,
  },
};

export {
  ModelsShowcase,
  S71200WiringTwin,
  SortingConveyorTwin,
  TankPressurePidTwin,
  TrafficIntersectionTwin,
};
