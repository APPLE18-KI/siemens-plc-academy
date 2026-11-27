import type { ExampleCase } from '../../types/content';
import type { TagDef } from '../../types/plc';

export type ProcessTag = '全部' | '电机互锁' | '定时器' | 'PID模拟量' | '顺序分拣';

export const PROCESS_TAGS: ProcessTag[] = [
  '全部',
  '电机互锁',
  '定时器',
  'PID模拟量',
  '顺序分拣',
];

export interface ExampleMetaPack {
  processTags: Exclude<ProcessTag, '全部'>[];
  coreInstructions: string[];
  plcModelShort: string;
  fatFocus: [string, string, string, string, string];
}

export const EXAMPLE_META_MAP: Record<string, ExampleMetaPack> = {
  'ex-motor-jog-seal': {
    processTags: ['电机互锁'],
    coreInstructions: ['SR 启保停', 'NC 故障安全', 'KA/KM 隔离'],
    plcModelShort: 'CPU 1214C DC/DC/DC',
    fatFocus: [
      '确认 1M 公共端接 M(0V) 与 PNP 极性一致，测 L+/M 无短路及电机相间绝缘 ≥5MΩ',
      '逐点触发 SB1(%I0.0)、SB2(%I0.1)、急停(%I0.2)、FR1(%I0.4) 核对 LED 与监控表一致',
      '拍下急停蘑菇头与断开热继 FR1 确认硬件/软件同时断电且故障锁存禁止自动重启',
      '切至点动模式测试按住即转、松手即停；切回连续自锁测试停止优先逻辑',
      '空载转向校验无误后带载试车，核对运行电流与柜门运行/故障指示灯状态',
    ],
  },
  'ex-reversing-limit': {
    processTags: ['电机互锁', '定时器'],
    coreInstructions: ['双互锁', 'TON 300ms死区', 'SQ 双级限位'],
    plcModelShort: 'CPU 1214C + 双可逆接触器',
    fatFocus: [
      '断电测量 KM_FWD 与 KM_REV 主回路相序换相正确，机械联锁块动作顺滑无卡滞',
      '依次手动压合左/右行程开关 SQ1(%I0.4)、SQ2(%I0.5) 与超程保护 SQ3/4(%I0.6)',
      '强制模拟同时按正反转与短接反向测试，验证常闭辅助触点硬互锁与 300ms 灭弧死区',
      '拆除主回路空开仅留控制电，单步运行自动往返确认 5s 装卸料定时与方向切换',
      '送主电低速试跑全行程，校验撞击 SQ1/SQ2 惯性停靠位置与超程急停保护',
    ],
  },
  'ex-star-delta': {
    processTags: ['电机互锁', '定时器'],
    coreInstructions: ['CASE 5步', 'TON_TIME 8s/80ms', 'Y/Δ 硬互锁'],
    plcModelShort: 'CPU 1214C + 3×3RT2',
    fatFocus: [
      '核实电机铭牌为 380V Δ 接法，断电测 U1/V1/W1-U2/V2/W2 绕组及 KM_Star/KM_Delta 互锁',
      '逐点校验启动/停止/急停与 KM_Star_FB(%I0.4)、KM_Delta_FB(%I0.5) 辅助回读信号',
      '验证 KM_Star 与 KM_Delta 辅助常闭硬互锁，确认星形未完全释放时绝不吸合三角形',
      '断开电机主动力电，监控时序：先吸 KM_Star(100ms) → 吸 KM_Main(8s) → 80ms 死区 → 吸 KM_Delta',
      '带风机空载启动，钳形表实测星形启动电流降为约 1/3 且切三角时无二次大冲击',
    ],
  },
  'ex-sorting-line': {
    processTags: ['顺序分拣', '定时器'],
    coreInstructions: ['TON 看门狗', 'R_TRIG + CTU', 'G120 %QW80'],
    plcModelShort: 'CPU 1214C + G120 + 双气缸',
    fatFocus: [
      '核对 24V 电源、变频器进出线与气源压力 0.6MPa，确认光电/电感/相机 PNP 极性一致',
      '对点校验上料光电 %I0.2、金属接近 %I0.3、视觉 NG %I0.4 及气缸双磁开 %I0.5/%I0.6',
      '拔掉气缸伸出磁开模拟卡缸，验证 1.3s 超时看门狗立即停线并触发声光报警塔 %Q0.3',
      '手动点动单步测试 1#、2# 气缸伸缩平滑度及变频皮带 15~50Hz 速度给定 %QW80',
      '连续投入塑料/金属/次品三类标准样件，复核分拣命中率、堵料报警与 R_TRIG 1:1 计数',
    ],
  },
  'ex-constant-pressure-pid': {
    processTags: ['PID模拟量', '定时器'],
    coreInstructions: ['NORM_X/SCALE_X', 'OB30 PID_Compact', '4-20mA 断线'],
    plcModelShort: 'CPU 1214C + SM1231/1232',
    fatFocus: [
      '核对 SM 1231 4-20mA 接线极性与屏蔽层单端接地，验电确认 24V 变送器供电正常',
      '用信号发生器注入 4mA/12mA/20mA，核对 %IW64 对应 0/13824/27648 及工程量标定准确',
      '拔除变送器信号线验证 %IW64<-1728 立即停泵；手提罐顶 HH 浮球 %I0.2 验证硬联锁切泵',
      '手动给定 %QW80=50% 测试 1# 变频泵转向与压力建立，单步验证 2# 副泵接触器吸合',
      '切入 OB30 自动闭环，扰动出水阀开度整定 Kp/Ti，确认 >86% 2s 加泵与 <35% 2s 减泵平稳',
    ],
  },
  'ex-smart-traffic': {
    processTags: ['定时器', '顺序分拣'],
    coreInstructions: ['CASE 9相位', 'Clock_1Hz %M0.5', '绿冲突降级'],
    plcModelShort: 'CPU 1214C + 绿冲突安全继电器',
    fatFocus: [
      '断电检查四向红黄绿灯组配线绝缘，核对独立绿冲突安全监控继电器回读采样回路',
      '启用 CPU 时钟存储器 MB0 并下载硬件配置，监控 %M0.5 稳定 1Hz 翻转及行人按钮 %I0.2',
      '人为制造东西与南北绿灯同亮测试，确认独立安全继电器瞬间硬切绿灯并锁存全向黄闪',
      '单步校验 9 相位流转、1.5s 全红清空保护、夜间黄闪与消防绿波 %I0.3 优先级抢占',
      '连续联调运行 3 个完整配时周期，验证行人上升沿锁存插队与维护钥匙 %I0.4 安全复位',
    ],
  },
};

export interface IoBreakdown {
  di: number;
  doCount: number;
  ai: number;
  aq: number;
  mem: number;
  total: number;
}

export function computeIoBreakdown(tags: TagDef[] = []): IoBreakdown {
  let di = 0;
  let doCount = 0;
  let ai = 0;
  let aq = 0;
  let mem = 0;
  for (const t of tags) {
    const addr = (t.address || '').toUpperCase();
    if (addr.startsWith('%IW') || addr.startsWith('%ID')) ai += 1;
    else if (addr.startsWith('%QW') || addr.startsWith('%QD')) aq += 1;
    else if (addr.startsWith('%I')) di += 1;
    else if (addr.startsWith('%Q')) doCount += 1;
    else mem += 1;
  }
  return { di, doCount, ai, aq, mem, total: tags.length };
}

export function buildTiaSclFile(example: ExampleCase): { filename: string; content: string } {
  const safeSlug = example.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const header = [
    '// ============================================================================',
    `// Siemens PLC Academy — TIA Portal External SCL Source (${example.id})`,
    `// 案例名称: ${example.title}`,
    `// 硬件配置: ${example.hardware}`,
    '// 导入方法: TIA Portal -> PLC 项目树 -> 外部源文件 -> 添加新外部文件 -> 右键从源生成块',
    '// ============================================================================',
    '',
  ].join('\r\n');
  return {
    filename: `${safeSlug}.scl`,
    content: header + example.sclCode.replace(/\r?\n/g, '\r\n') + '\r\n',
  };
}

function escapeCsvCell(val: string): string {
  if (/[",\r\n]/.test(val)) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export function buildTiaIoCsvFile(example: ExampleCase): { filename: string; content: string } {
  const safeSlug = example.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const rows: string[][] = [
    ['Name', 'Path', 'Data Type', 'Logical Address', 'Comment', 'Initial Value', 'Unit'],
    ...(example.ioTags || []).map((tag) => [
      tag.name,
      'Default tag table',
      tag.type,
      tag.address,
      tag.comment ?? '',
      tag.init === undefined ? '' : String(tag.init),
      tag.unit ?? '',
    ]),
  ];
  const csvBody = rows.map((r) => r.map(escapeCsvCell).join(',')).join('\r\n');
  // Prepend UTF-8 BOM (\uFEFF) so Microsoft Excel & TIA Portal display Chinese comments cleanly
  return {
    filename: `${safeSlug}_IO_Tags.csv`,
    content: `\uFEFF${csvBody}\r\n`,
  };
}

export function triggerTextDownload(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const FAT_STEP_TITLES = [
  { code: 'STEP 01', name: '断电测绝缘 / 24V 极性校验', safetyCritical: true },
  { code: 'STEP 02', name: 'I/O 点动对点校线', safetyCritical: true },
  { code: 'STEP 03', name: '急停与硬互锁验证', safetyCritical: true },
  { code: 'STEP 04', name: '空载单步顺序调试', safetyCritical: false },
  { code: 'STEP 05', name: '带载联调与参数归档', safetyCritical: false },
] as const;

const FAT_STORAGE_KEY = 'plc_example_fat_v3';

export function loadFatChecklistMap(): Record<string, boolean[]> {
  try {
    const raw = window.localStorage.getItem(FAT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, boolean[]>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveFatChecklistForExample(exampleId: string, checks: boolean[]): void {
  try {
    const all = loadFatChecklistMap();
    all[exampleId] = checks;
    window.localStorage.setItem(FAT_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Ignore storage restriction
  }
}
