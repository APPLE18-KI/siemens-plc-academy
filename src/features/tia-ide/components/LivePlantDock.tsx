import React from 'react';
import {
  AlertTriangle,
  Boxes,
  Cable,
  Droplets,
  Link2,
  SlidersHorizontal,
  TrafficCone,
} from 'lucide-react';
import type { ModelId } from '../../../types/content';
import type { PlcRuntime, TagDef, TagValue } from '../../../types/plc';
import { TWIN_RUNTIME_TAG_SPECS } from '../../../core/scl/types';
import { modelRegistry } from '../../models';
import { VirtualIoBox } from './VirtualIoBox';
import { haptic } from '../../../app/native/platform';

export type PlantDockId = ModelId | 'virtual-io';

export const PLANT_OPTIONS: Array<{
  id: PlantDockId;
  shortLabel: string;
  fullLabel: string;
  icon: React.ReactNode;
}> = [
  {
    id: 's7-1200-wiring',
    shortLabel: '接线台',
    fullLabel: 'S7-1200 硬件接线台',
    icon: <Cable size={13} />,
  },
  {
    id: 'sorting-conveyor',
    shortLabel: '视觉分拣线',
    fullLabel: '三工位视觉气动分拣线',
    icon: <Boxes size={13} />,
  },
  {
    id: 'tank-pressure-pid',
    shortLabel: 'PID 供水罐',
    fullLabel: '双泵恒压供水 PID 储罐',
    icon: <Droplets size={13} />,
  },
  {
    id: 'traffic-intersection',
    shortLabel: '智能红绿灯',
    fullLabel: '智能十字路口红绿灯',
    icon: <TrafficCone size={13} />,
  },
  {
    id: 'virtual-io',
    shortLabel: '虚拟 I/O + 波形',
    fullLabel: '纯虚拟 I/O 开关箱 + 100 周期波形',
    icon: <SlidersHorizontal size={13} />,
  },
];

export interface LivePlantDockProps {
  activePlant: PlantDockId;
  onSelectPlant: (plant: PlantDockId) => void;
  runtime: PlcRuntime;
  tagDefs: TagDef[];
  liveTags: Record<string, TagValue>;
  cycleCount: number;
  onSyncPlantTags: (modelId: ModelId) => void;
  onSwitchMatchingTemplate?: (modelId: ModelId) => void;
  hasMatchingTemplate?: boolean;
}

export const LivePlantDock: React.FC<LivePlantDockProps> = ({
  activePlant,
  onSelectPlant,
  runtime,
  tagDefs,
  liveTags,
  cycleCount,
  onSyncPlantTags,
  onSwitchMatchingTemplate,
  hasMatchingTemplate = false,
}) => {
  const isModel = activePlant !== 'virtual-io';
  const requiredSpecs = isModel ? TWIN_RUNTIME_TAG_SPECS[activePlant] : [];
  const currentNames = new Set(tagDefs.map((t) => t.name));
  const missingCount = isModel
    ? requiredSpecs.filter((spec) => !currentNames.has(spec.name)).length
    : 0;

  const ActiveModelComponent = isModel ? modelRegistry[activePlant]?.Component : null;

  return (
    <section className="tia-plant-dock" aria-label="实时被控设备联调舱">
      <div className="tia-plant-header">
        <div className="tia-plant-title-row">
          <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <Link2 size={15} color="var(--power-green)" />
            <span>实时被控设备联调舱</span>
          </strong>
          <span
            style={{
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: 'var(--power-green)',
              fontWeight: 700,
            }}
          >
            PROFINET 闭环在线
          </span>
        </div>

        <div className="tia-plant-switcher" role="tablist" aria-label="切换联调设备">
          {PLANT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={activePlant === opt.id}
              className={`tia-plant-pill ${activePlant === opt.id ? 'active' : ''}`}
              onClick={() => {
                haptic('tap');
                onSelectPlant(opt.id);
              }}
              title={opt.fullLabel}
            >
              {opt.icon}
              <span>{opt.shortLabel}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Helpful warning if current project tags don't match the mounted twin */}
      {isModel && missingCount > 0 && (
        <div className="tia-plant-mismatch">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={14} style={{ flexShrink: 0 }} />
            <span>
              当前变量表缺少该设备的 {missingCount} 个标准 I/O 映射变量，SCL 输出可能未对接此设备。
            </span>
          </span>
          <div style={{ display: 'inline-flex', gap: 6 }}>
            <button
              type="button"
              className="tia-btn tia-btn--sm"
              onClick={() => {
                haptic('tap');
                onSyncPlantTags(activePlant);
              }}
            >
              合并该设备变量
            </button>
            {hasMatchingTemplate && onSwitchMatchingTemplate && (
              <button
                type="button"
                className="tia-btn tia-btn--primary tia-btn--sm"
                onClick={() => {
                  haptic('press');
                  onSwitchMatchingTemplate(activePlant);
                }}
              >
                载入配套 SCL 模板
              </button>
            )}
          </div>
        </div>
      )}

      <div className="tia-plant-stage">
        {isModel && ActiveModelComponent ? (
          <ActiveModelComponent key={activePlant} runtime={runtime} embedded />
        ) : (
          <VirtualIoBox
            tagDefs={tagDefs}
            liveTags={liveTags}
            cycleCount={cycleCount}
            onSetTag={(name, val) => runtime.setTag(name, val)}
          />
        )}
      </div>
    </section>
  );
};
