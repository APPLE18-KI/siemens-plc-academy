import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Cpu, Wrench } from 'lucide-react';
import type { SimPresetEntry, SimPresetId } from '../../types/content';
import { SIM_PRESET_DEFINITIONS, SIM_PRESET_ORDER } from './presets';
import { PresetSimulator } from './components/PresetSimulator';
import { LadderSandbox } from './components/LadderSandbox';
import './simulator.css';

function makePresetComponent(presetId: SimPresetId): React.FC<{ embedded?: boolean }> {
  const Component: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => (
    <PresetSimulator presetId={presetId} embedded={embedded} />
  );
  Component.displayName = `SimPreset_${presetId}`;
  return Component;
}

export const simPresets: Record<SimPresetId, SimPresetEntry> = {
  'wiring-basics': {
    id: 'wiring-basics',
    title: SIM_PRESET_DEFINITIONS['wiring-basics'].title,
    subtitle: SIM_PRESET_DEFINITIONS['wiring-basics'].subtitle,
    tags: SIM_PRESET_DEFINITIONS['wiring-basics'].tags,
    Component: makePresetComponent('wiring-basics'),
  },
  'seal-in-motor': {
    id: 'seal-in-motor',
    title: SIM_PRESET_DEFINITIONS['seal-in-motor'].title,
    subtitle: SIM_PRESET_DEFINITIONS['seal-in-motor'].subtitle,
    tags: SIM_PRESET_DEFINITIONS['seal-in-motor'].tags,
    Component: makePresetComponent('seal-in-motor'),
  },
  'reversing-interlock': {
    id: 'reversing-interlock',
    title: SIM_PRESET_DEFINITIONS['reversing-interlock'].title,
    subtitle: SIM_PRESET_DEFINITIONS['reversing-interlock'].subtitle,
    tags: SIM_PRESET_DEFINITIONS['reversing-interlock'].tags,
    Component: makePresetComponent('reversing-interlock'),
  },
  'ton-star-delta': {
    id: 'ton-star-delta',
    title: SIM_PRESET_DEFINITIONS['ton-star-delta'].title,
    subtitle: SIM_PRESET_DEFINITIONS['ton-star-delta'].subtitle,
    tags: SIM_PRESET_DEFINITIONS['ton-star-delta'].tags,
    Component: makePresetComponent('ton-star-delta'),
  },
  'ctu-batch-pack': {
    id: 'ctu-batch-pack',
    title: SIM_PRESET_DEFINITIONS['ctu-batch-pack'].title,
    subtitle: SIM_PRESET_DEFINITIONS['ctu-batch-pack'].subtitle,
    tags: SIM_PRESET_DEFINITIONS['ctu-batch-pack'].tags,
    Component: makePresetComponent('ctu-batch-pack'),
  },
  'analog-scale-pid': {
    id: 'analog-scale-pid',
    title: SIM_PRESET_DEFINITIONS['analog-scale-pid'].title,
    subtitle: SIM_PRESET_DEFINITIONS['analog-scale-pid'].subtitle,
    tags: SIM_PRESET_DEFINITIONS['analog-scale-pid'].tags,
    Component: makePresetComponent('analog-scale-pid'),
  },
};

type WorkbenchTab = SimPresetId | 'sandbox';

function isSimPresetId(value: string | null): value is SimPresetId {
  return value !== null && Object.prototype.hasOwnProperty.call(SIM_PRESET_DEFINITIONS, value);
}

export const SimulatorWorkbench: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const paramPreset = searchParams.get('preset');

  const [activeTab, setActiveTab] = useState<WorkbenchTab>(() => {
    if (paramPreset === 'sandbox') return 'sandbox';
    if (isSimPresetId(paramPreset)) return paramPreset;
    return 'seal-in-motor';
  });

  useEffect(() => {
    if (paramPreset === 'sandbox') {
      setActiveTab('sandbox');
    } else if (isSimPresetId(paramPreset)) {
      setActiveTab(paramPreset);
    }
  }, [paramPreset]);

  const selectTab = (tab: WorkbenchTab) => {
    setActiveTab(tab);
    setSearchParams({ preset: tab }, { replace: true });
  };

  return (
    <div className="plc-sim-workbench">
      <header className="plc-sim-workbench-header">
        <div className="plc-sim-wb-top">
          <div>
            <div className="plc-sim-wb-eyebrow">
              <Cpu size={14} />
              <span>SIEMENS S7-1200 · TIA PORTAL ONLINE LAB</span>
            </div>
            <h1 className="plc-sim-wb-title">西门子 S7-1200 交互式 PLC 仿真实验室</h1>
            <p className="plc-sim-wb-desc">
              真实 PII → OB1 → PIQ 扫描周期内核 · 荧光导通梯形图 (LAD) · 同步 SCL 等效代码 · 实时 Trace 逻辑分析仪 · 自由搭图沙盒
            </p>
          </div>
        </div>

        <nav className="plc-sim-preset-tabs" aria-label="仿真实验预设选择">
          {SIM_PRESET_ORDER.map((id, idx) => {
            const def = SIM_PRESET_DEFINITIONS[id];
            return (
              <button
                key={id}
                type="button"
                className={`plc-sim-preset-tab ${activeTab === id ? 'active' : ''}`}
                onClick={() => selectTab(id)}
              >
                <span className="plc-sim-tab-idx">0{idx + 1}</span>
                <span>{def.shortTitle}</span>
              </button>
            );
          })}

          <button
            type="button"
            className={`plc-sim-preset-tab is-sandbox-tab ${
              activeTab === 'sandbox' ? 'active' : ''
            }`}
            onClick={() => selectTab('sandbox')}
          >
            <Wrench size={13} />
            <span>自定义梯形图沙盒</span>
          </button>
        </nav>
      </header>

      {/* Key resets runtime cleanly when switching presets */}
      {activeTab === 'sandbox' ? (
        <LadderSandbox key="sandbox" />
      ) : (
        <PresetSimulator key={activeTab} presetId={activeTab} embedded={false} />
      )}
    </div>
  );
};
