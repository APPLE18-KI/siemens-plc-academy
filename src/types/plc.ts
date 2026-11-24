export type TagValue = boolean | number;

export type TagDataType = 'Bool' | 'Int' | 'Real' | 'Time';

export type TagArea = 'I' | 'Q' | 'M' | 'DB';

export interface TagDef {
  /** 符号名称，如 "Start_PB"、"Motor_Run" */
  name: string;
  /** 西门子标准地址，如 "%I0.0"、"%Q0.0"、"%M0.0"、"%IW64"、"DB1.DBD0" */
  address: string;
  type: TagDataType;
  area?: TagArea;
  comment?: string;
  init?: TagValue;
  unit?: string;
}

export interface ScanMetrics {
  cycleCount: number;
  lastScanMs: number;
  scanIntervalMs: number;
  running: boolean;
}

/**
 * 跨模块标准 PLC 运行时接口（连接仿真内核、数字孪生模型与课程互动块）
 */
export interface PlcRuntime {
  readonly tagDefs: TagDef[];
  tags: Record<string, TagValue>;
  getTag(name: string): TagValue;
  setTag(name: string, value: TagValue): void;
  scan(dtMs: number): void;
  reset(): void;
  setRunning?(running: boolean): void;
  getMetrics?(): ScanMetrics;
  subscribe(listener: (tags: Record<string, TagValue>, metrics?: ScanMetrics) => void): () => void;
}
