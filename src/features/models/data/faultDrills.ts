import type { ModelId } from '../../../types/content';
import { FAULT_DRILLS_A } from './faultDrillsA';
import { FAULT_DRILLS_B } from './faultDrillsB';
import type { FaultDrillCase } from './faultDrillTypes';

export * from './faultDrillTypes';

export const FAULT_DRILLS: FaultDrillCase[] = [...FAULT_DRILLS_A, ...FAULT_DRILLS_B];

export const FAULT_DRILL_MAP = new Map<string, FaultDrillCase>(
  FAULT_DRILLS.map((item) => [item.id, item])
);

export const MODEL_DRILL_COUNTS: Record<ModelId, number> = {
  's7-1200-wiring': FAULT_DRILLS.filter((d) => d.modelId === 's7-1200-wiring').length,
  'sorting-conveyor': FAULT_DRILLS.filter((d) => d.modelId === 'sorting-conveyor').length,
  'tank-pressure-pid': FAULT_DRILLS.filter((d) => d.modelId === 'tank-pressure-pid').length,
  'traffic-intersection': FAULT_DRILLS.filter((d) => d.modelId === 'traffic-intersection').length,
};
