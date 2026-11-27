import type { ModelId } from '../../../types/content';

export type FaultSeverity = 'critical' | 'high' | 'medium';

export interface MeterProbe {
  id: string;
  point: string;
  mode: string;
  reading: string;
  abnormal: boolean;
  hint: string;
}

export interface WatchProbe {
  id: string;
  address: string;
  symbol: string;
  value: string;
  abnormal: boolean;
  note: string;
}

export interface ChainNode {
  label: string;
  sub: string;
  status: 'ok' | 'fault' | 'warn';
}

export interface FaultDrillCase {
  id: string;
  ticketNo: string;
  modelId: ModelId;
  modelName: string;
  title: string;
  severity: FaultSeverity;
  category: string;
  symptom: string;
  chainNodes: [ChainNode, ChainNode, ChainNode, ChainNode];
  chainEdges: [string, string, string];
  meterProbes: MeterProbe[];
  watchProbes: WatchProbe[];
  options: Array<{ id: string; text: string }>;
  correctOptionId: string;
  rootCause: string;
  repairSteps: string[];
  preventionTip: string;
}

export interface FaultDrillProgress {
  solvedIds: string[];
  firstTryIds: string[];
  attempts: Record<string, number>;
}

const STORAGE_KEY = 'plc_twin_fault_drills_v3';

export function loadDrillProgress(): FaultDrillProgress {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { solvedIds: [], firstTryIds: [], attempts: {} };
    const parsed = JSON.parse(raw) as Partial<FaultDrillProgress>;
    return {
      solvedIds: Array.isArray(parsed.solvedIds) ? parsed.solvedIds : [],
      firstTryIds: Array.isArray(parsed.firstTryIds) ? parsed.firstTryIds : [],
      attempts: parsed.attempts && typeof parsed.attempts === 'object' ? parsed.attempts : {},
    };
  } catch {
    return { solvedIds: [], firstTryIds: [], attempts: {} };
  }
}

export function saveDrillProgress(next: FaultDrillProgress): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota or private-mode restrictions
  }
}
