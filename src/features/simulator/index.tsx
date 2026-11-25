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
              <span>S7-1200 网页仿真</span>
            </div>
            <h1 className="plc-sim-wb-title">PLC 仿真实验室</h1>
            <p className="plc-sim-wb-desc">
              按下按钮（电脑上在右侧，手机上在梯形图上方），看梯形图哪里“通电”（变绿）、哪个输出动作。可以单步执行、放慢速度，也可以在沙盒里自己搭程序。
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

      <details className="sim-vs-tia">
        <summary>这个网页仿真和真实博途（TIA Portal）有什么不同？</summary>
        <ul>
          <li>这是<strong>简化的教学版</strong>：只支持常用指令（触点、线圈、置位/复位、边沿、定时器、计数器、比较和少量模拟量换算）。</li>
          <li>没有硬件组态、编译报错、下载和在线诊断；扫描周期的时间是模拟出来的，不代表真实 CPU 的速度。</li>
          <li>界面颜色参考了博途的在线监视风格，但操作方式不同。</li>
          <li>学会逻辑后，建议在 TIA Portal + S7-PLCSIM 中把同样的程序再做一遍（见课程“动手第一步：在博途中新建项目”）。</li>
        </ul>
      </details>

      {/* Key resets runtime cleanly when switching presets */}
      {activeTab === 'sandbox' ? (
        <LadderSandbox key="sandbox" />
      ) : (
        <PresetSimulator key={activeTab} presetId={activeTab} embedded={false} />
      )}
    </div>
  );
};
