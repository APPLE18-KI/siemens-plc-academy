import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Code2,
  Columns2,
  Download,
  Factory,
  FileCode2,
  Gauge,
  Info,
  PlaySquare,
  Table2,
  X,
} from 'lucide-react';
import type { ModelId } from '../../types/content';
import type { TagDef, TagValue } from '../../types/plc';
import {
  createSclVmSession,
  SCL_PROJECT_TEMPLATES,
  TWIN_RUNTIME_TAG_SPECS,
  type SclCompileResult,
  type SclProjectTemplate,
  type SclScanSnapshot,
  type SclVmSession,
} from '../../core/scl';
import { haptic } from '../../app/native/platform';
import { showToast } from '../../app/native/useNativeBridge';
import { TiaRibbonBar } from './components/TiaRibbonBar';
import { ProjectTree, type ProjectNodeId } from './components/ProjectTree';
import { SclCodeEditor } from './components/SclCodeEditor';
import { BottomInspector, type InspectorTabId } from './components/BottomInspector';
import { TagTableEditor } from './components/TagTableEditor';
import { WatchForceTable } from './components/WatchForceTable';
import { LivePlantDock, PLANT_OPTIONS, type PlantDockId } from './components/LivePlantDock';
import './tiaIde.css';

type MobilePaneId = 'code' | 'tables' | 'plant';

function formatNowTime(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export const TiaPortalIdeWorkbench: React.FC = () => {
  const [searchParams] = useSearchParams();
  const templates = SCL_PROJECT_TEMPLATES;

  const initialTemplate: SclProjectTemplate = useMemo(() => {
    const queryTpl = searchParams.get('template');
    if (queryTpl) {
      const found = templates.find((t) => t.id === queryTpl);
      if (found) return found;
    }
    return templates[0];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Single long-lived SCL VM session; cleanly stopped on unmount
  const sessionRef = useRef<SclVmSession | null>(null);
  if (!sessionRef.current) {
    sessionRef.current = createSclVmSession(
      initialTemplate.tagDefs,
      initialTemplate.ob1Code,
      initialTemplate.ob100Code
    );
  }
  const session = sessionRef.current;

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(initialTemplate.id);
  const [tagDefs, setTagDefs] = useState<TagDef[]>(() => [...initialTemplate.tagDefs]);
  const [ob1Code, setOb1Code] = useState<string>(initialTemplate.ob1Code);
  const [ob100Code, setOb100Code] = useState<string>(initialTemplate.ob100Code);
  const [downloadedOb1, setDownloadedOb1] = useState<string>(initialTemplate.ob1Code);
  const [downloadedOb100, setDownloadedOb100] = useState<string>(initialTemplate.ob100Code);

  const [activeNode, setActiveNode] = useState<ProjectNodeId>('ob1');
  const [treeCollapsed, setTreeCollapsed] = useState<boolean>(false);
  const [inspectorTab, setInspectorTab] = useState<InspectorTabId>('compile');
  const [monitoring, setMonitoring] = useState<boolean>(true);
  const [runOb100OnDownload, setRunOb100OnDownload] = useState<boolean>(true);
  const [activePlant, setActivePlant] = useState<PlantDockId>(
    initialTemplate.linkedModelId ?? 'virtual-io'
  );

  // Mobile responsive view switcher
  const [mobilePane, setMobilePane] = useState<MobilePaneId>('code');
  const [mobileSplit, setMobileSplit] = useState<boolean>(false);

  // Compile / Download / Import feedback
  const [compileResult, setCompileResult] = useState<SclCompileResult | null>(null);
  const [lastDownloadInfo, setLastDownloadInfo] = useState<string | null>(
    `初始模板「${initialTemplate.title}」已加载至虚拟 CPU 1214C`
  );
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [jumpRequest, setJumpRequest] = useState<{ line: number; seq: number } | null>(null);

  // Live VM snapshot + runtime tag mirror (throttled cleanly for smooth mobile FPS)
  const [snapshot, setSnapshot] = useState<SclScanSnapshot>(() => session.getSnapshot());
  const [liveTags, setLiveTags] = useState<Record<string, TagValue>>(() => ({
    ...session.runtime.tags,
  }));
  const [cpuMode, setCpuModeState] = useState<'RUN' | 'STOP'>(() => session.getCpuMode());

  const activeTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) ?? templates[0],
    [templates, selectedTemplateId]
  );

  const syncImmediate = useCallback(() => {
    const snap = session.getSnapshot();
    setSnapshot(snap);
    setCpuModeState(snap.cpuMode);
    setLiveTags({ ...session.runtime.tags });
  }, [session]);

  // Subscribe to VM scan snapshots & runtime tag mutations with ~80ms throttle
  useEffect(() => {
    let lastFlush = 0;
    let pendingTimer: number | null = null;

    const flush = () => {
      pendingTimer = null;
      lastFlush = performance.now();
      const snap = session.getSnapshot();
      setSnapshot(snap);
      setCpuModeState(snap.cpuMode);
      setLiveTags({ ...session.runtime.tags });
    };

    const scheduleFlush = () => {
      const elapsed = performance.now() - lastFlush;
      if (elapsed >= 80) {
        flush();
      } else if (pendingTimer === null) {
        pendingTimer = window.setTimeout(flush, Math.max(16, 80 - elapsed));
      }
    };

    const unsubSnap = session.subscribeSnapshot(() => scheduleFlush());
    const unsubTags = session.runtime.subscribe(() => scheduleFlush());

    // Initial compile & download to ensure VM AST is synchronized on mount
    const initRes = session.download(initialTemplate.ob1Code, initialTemplate.ob100Code, true);
    setCompileResult(initRes);
    flush();

    return () => {
      unsubSnap();
      unsubTags();
      if (pendingTimer !== null) window.clearTimeout(pendingTimer);
      session.setCpuMode('STOP');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const applyTemplate = useCallback(
    (tpl: SclProjectTemplate, silent = false) => {
      setSelectedTemplateId(tpl.id);
      const nextTags = [...tpl.tagDefs];
      setTagDefs(nextTags);
      setOb1Code(tpl.ob1Code);
      setOb100Code(tpl.ob100Code);
      setDownloadedOb1(tpl.ob1Code);
      setDownloadedOb100(tpl.ob100Code);
      setActivePlant(tpl.linkedModelId ?? 'virtual-io');
      setImportNotice(null);

      session.clearAllForces();
      session.updateTagDefs(nextTags);
      session.resetMemory();
      const res = session.download(tpl.ob1Code, tpl.ob100Code, true);
      setCompileResult(res);
      setLastDownloadInfo(`已切换模板「${tpl.title}」并自动下载运行 (${formatNowTime()})`);
      syncImmediate();
      if (!silent) {
        showToast(`已载入工程模板：${tpl.title}`);
      }
    },
    [session, syncImmediate]
  );

  // Handle URL ?template=... and external code import from sessionStorage / localStorage
  useEffect(() => {
    const queryTplId = searchParams.get('template');
    if (queryTplId && queryTplId !== selectedTemplateId) {
      const found = templates.find((t) => t.id === queryTplId);
      if (found) {
        applyTemplate(found, true);
      }
    }

    let importedCode: string | null = null;
    let importedName: string | null = null;
    try {
      const sessCode = sessionStorage.getItem('plc_ide_import_code');
      if (sessCode) {
        importedCode = sessCode;
        importedName = sessionStorage.getItem('plc_ide_import_name') ?? '毕业项目外部源码.scl';
        sessionStorage.removeItem('plc_ide_import_code');
        sessionStorage.removeItem('plc_ide_import_name');
      } else {
        const localCode =
          localStorage.getItem('plc_ide_custom_code') ??
          localStorage.getItem('plc_ide_import_code');
        if (localCode) {
          importedCode = localCode;
          importedName = localStorage.getItem('plc_ide_import_name') ?? '外部送入 SCL 程序';
          localStorage.removeItem('plc_ide_custom_code');
          localStorage.removeItem('plc_ide_import_code');
          localStorage.removeItem('plc_ide_import_name');
        }
      }
    } catch {
      // Ignore storage restrictions
    }

    if (importedCode) {
      setOb1Code(importedCode);
      setActiveNode('ob1');
      setMobilePane('code');
      setActivePlant('virtual-io');
      setImportNotice(
        `已导入「${importedName}」到 Main [OB1] 离线编辑器。注：若源码包含完整 TIA 工程级 TYPE/FUNCTION_BLOCK 声明，可参考阅读或提取核心控制语句后点击「下载到设备」运行。`
      );
      showToast(`已载入 ${importedName}`, 2400);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const isDirtyOb1 = ob1Code !== downloadedOb1;
  const isDirtyOb100 = ob100Code !== downloadedOb100;
  const isDirty = isDirtyOb1 || isDirtyOb100;

  const handleCompile = useCallback(() => {
    const res = session.compile(ob1Code, ob100Code);
    setCompileResult(res);
    setInspectorTab('compile');
    if (res.ok) {
      haptic('success');
      showToast(`编译通过 (0 错误 · ${res.compileTimeMs.toFixed(1)}ms)`);
    } else {
      haptic('error');
      const firstErr = res.diagnostics.find((d) => d.severity === 'error');
      if (firstErr) {
        setJumpRequest({ line: firstErr.line, seq: Date.now() });
      }
      showToast(`编译失败：发现 ${res.diagnostics.filter((d) => d.severity === 'error').length} 处错误`, 2400);
    }
  }, [session, ob1Code, ob100Code]);

  const handleDownload = useCallback(() => {
    const res = session.download(ob1Code, ob100Code, runOb100OnDownload);
    setCompileResult(res);
    if (res.ok) {
      setDownloadedOb1(ob1Code);
      setDownloadedOb100(ob100Code);
      setLastDownloadInfo(
        `已热下载至虚拟 CPU 1214C (${formatNowTime()})${runOb100OnDownload ? ' · 已执行 OB100 暖启动' : ''}`
      );
      haptic('success');
      showToast('下载成功！右侧被控设备已受新 SCL 程序控制', 2200);
      syncImmediate();
    } else {
      setInspectorTab('compile');
      const firstErr = res.diagnostics.find((d) => d.severity === 'error');
      if (firstErr) {
        setActiveNode('ob1');
        setMobilePane('code');
        setJumpRequest({ line: firstErr.line, seq: Date.now() });
      }
      haptic('error');
      showToast('下载中止：请先修正下方编译报错行', 2500);
    }
  }, [session, ob1Code, ob100Code, runOb100OnDownload, syncImmediate]);

  const handleSetCpuMode = useCallback(
    (mode: 'RUN' | 'STOP') => {
      session.setCpuMode(mode);
      setCpuModeState(mode);
      syncImmediate();
      showToast(mode === 'RUN' ? 'CPU 已切换至 RUN 自动循环扫描' : 'CPU 已切换至 STOP 停机模式');
    },
    [session, syncImmediate]
  );

  const handleStepScan = useCallback(() => {
    session.stepSingleScan(50);
    syncImmediate();
    showToast(`已单步执行 1 个扫描周期 (Cycle #${session.getSnapshot().cycleCount})`);
  }, [session, syncImmediate]);

  const handleResetMemory = useCallback(() => {
    session.clearAllForces();
    session.resetMemory();
    if (runOb100OnDownload) {
      session.download(downloadedOb1, downloadedOb100, true);
    }
    syncImmediate();
    showToast('MRES 完成：已复位存储区、背景数据与强制表');
  }, [session, runOb100OnDownload, downloadedOb1, downloadedOb100, syncImmediate]);

  const handleUpdateTagDefs = useCallback(
    (next: TagDef[]) => {
      setTagDefs(next);
      session.updateTagDefs(next);
      syncImmediate();
    },
    [session, syncImmediate]
  );

  const handleSyncPlantTags = useCallback(
    (modelId: ModelId) => {
      const specs = TWIN_RUNTIME_TAG_SPECS[modelId] ?? [];
      const existingNames = new Set(tagDefs.map((t) => t.name));
      const merged = [...tagDefs, ...specs.filter((s) => !existingNames.has(s.name))];
      handleUpdateTagDefs(merged);
      showToast(`已合并该设备的标准 I/O 变量表（共 ${merged.length} 项）`);
    },
    [tagDefs, handleUpdateTagDefs]
  );

  const handleSwitchMatchingTemplate = useCallback(
    (modelId: ModelId) => {
      const matched = templates.find((t) => t.linkedModelId === modelId);
      if (matched) {
        applyTemplate(matched);
      }
    },
    [templates, applyTemplate]
  );

  const handleJumpToLine = useCallback((line: number, block: 'ob1' | 'ob100' = 'ob1') => {
    setActiveNode(block);
    setMobilePane('code');
    setJumpRequest({ line, seq: Date.now() });
  }, []);

  const handleSelectTreeNode = useCallback((node: ProjectNodeId) => {
    haptic('tap');
    setActiveNode(node);
    if (node === 'ob1' || node === 'ob100') {
      setMobilePane('code');
    } else {
      setMobilePane('tables');
    }
  }, []);

  const activeForceCount = Object.keys(snapshot.forcedTags).length;
  const linkedPlantLabel =
    PLANT_OPTIONS.find((p) => p.id === activePlant)?.fullLabel ?? '实时联调设备';
  const hasMatchingTemplateForPlant =
    activePlant !== 'virtual-io' &&
    templates.some((t) => t.linkedModelId === activePlant && t.id !== selectedTemplateId);

  const showCenterOnMobile = mobileSplit || mobilePane === 'code' || mobilePane === 'tables';
  const showPlantOnMobile = mobileSplit || mobilePane === 'plant';

  return (
    <div className="tia-root">
      {/* Main TIA Portal Workbench Frame */}
      <div className={`tia-workbench-frame ${monitoring ? 'is-online' : ''}`}>
        {/* Signature TIA Portal Online Orange Top Accent Strip */}
        <div className="tia-online-strip" />

        {/* Top Engineering Ribbon Bar */}
        <TiaRibbonBar
          templates={templates}
          selectedTemplateId={selectedTemplateId}
          onSelectTemplate={(id) => {
            const found = templates.find((t) => t.id === id);
            if (found) applyTemplate(found);
          }}
          isDirty={isDirty}
          monitoring={monitoring}
          onToggleMonitor={() => {
            setMonitoring((prev) => {
              const next = !prev;
              showToast(next ? '已转至在线监控：开启逐行能流与变量值小眼镜' : '已关闭在线监控');
              return next;
            });
          }}
          runOb100OnDownload={runOb100OnDownload}
          onToggleRunOb100={setRunOb100OnDownload}
          onCompile={handleCompile}
          onDownload={handleDownload}
          cpuMode={cpuMode}
          onSetCpuMode={handleSetCpuMode}
          onStepScan={handleStepScan}
          onResetMemory={handleResetMemory}
          cycleCount={snapshot.cycleCount}
          scanDurationMs={snapshot.scanDurationMs}
          activeForceCount={activeForceCount}
          onJumpToForceTable={() => handleSelectTreeNode('watch')}
        />

        {/* Offline Code Modified Dirty Warning Bar */}
        {isDirty && (
          <div className="tia-dirty-banner" role="alert">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <AlertTriangle size={15} style={{ flexShrink: 0 }} />
              <span>⚠️ 离线代码已改动，请点击「下载到设备」生效</span>
            </span>
            <button
              type="button"
              className="tia-btn tia-btn--dirty tia-btn--sm"
              onClick={() => {
                haptic('press');
                handleDownload();
              }}
            >
              <Download size={13} />
              <span>立即下载生效</span>
            </button>
          </div>
        )}

        {/* External Import Info Banner (e.g., from Capstone SourceBrowserTab) */}
        {importNotice && (
          <div className="tia-import-banner">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <Info size={15} style={{ flexShrink: 0 }} />
              <span>{importNotice}</span>
            </span>
            <button
              type="button"
              className="tia-tree-collapse-btn"
              onClick={() => setImportNotice(null)}
              aria-label="关闭提示"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Mobile 3-Pane Tab Switcher + Split Co-Sim Toggle */}
        <div className="tia-mobile-tabs" role="tablist" aria-label="手机工作台视图切换">
          <button
            type="button"
            role="tab"
            aria-selected={!mobileSplit && mobilePane === 'code'}
            className={`tia-mobile-tab ${!mobileSplit && mobilePane === 'code' ? 'active' : ''}`}
            onClick={() => {
              haptic('tap');
              setMobileSplit(false);
              setMobilePane('code');
              if (activeNode !== 'ob1' && activeNode !== 'ob100') setActiveNode('ob1');
            }}
          >
            <Code2 size={14} />
            <span>代码编写</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={!mobileSplit && mobilePane === 'tables'}
            className={`tia-mobile-tab ${!mobileSplit && mobilePane === 'tables' ? 'active' : ''}`}
            onClick={() => {
              haptic('tap');
              setMobileSplit(false);
              setMobilePane('tables');
              if (activeNode !== 'tags' && activeNode !== 'watch') setActiveNode('watch');
            }}
          >
            <Table2 size={14} />
            <span>变量/强制{activeForceCount > 0 ? `(${activeForceCount})` : ''}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={!mobileSplit && mobilePane === 'plant'}
            className={`tia-mobile-tab ${!mobileSplit && mobilePane === 'plant' ? 'active' : ''}`}
            onClick={() => {
              haptic('tap');
              setMobileSplit(false);
              setMobilePane('plant');
            }}
          >
            <Factory size={14} />
            <span>设备联调</span>
          </button>

          <button
            type="button"
            className={`tia-mobile-tab ${mobileSplit ? 'active' : ''}`}
            style={{ flex: '0 0 auto', padding: '8px 10px' }}
            onClick={() => {
              haptic('tap');
              setMobileSplit((v) => !v);
            }}
            title="上下分屏联调：同时查看代码与右侧设备"
          >
            <Columns2 size={14} />
            <span>分屏</span>
          </button>
        </div>

        {/* Main 3-Pane Grid */}
        <div className={`tia-workspace-grid ${treeCollapsed ? 'tree-collapsed' : ''}`}>
          {/* Left Pane: Collapsible Project Tree (Desktop) */}
          <ProjectTree
            activeNode={activeNode}
            onSelectNode={handleSelectTreeNode}
            collapsed={treeCollapsed}
            onToggleCollapse={() => setTreeCollapsed((v) => !v)}
            isDirtyOb1={isDirtyOb1}
            isDirtyOb100={isDirtyOb100}
            tagCount={tagDefs.length}
            forceCount={activeForceCount}
            linkedPlantLabel={linkedPlantLabel}
          />

          {/* Center Pane: Code Editor OR Tag Table OR Watch/Force Table */}
          <main
            className={`tia-center-pane ${!showCenterOnMobile ? 'tia-pane-hidden-mobile' : ''}`}
          >
            {/* Mobile Compact Project Sub-tabs */}
            <div className="tia-compact-subtabs" aria-label="程序块与表格快捷切换">
              <button
                type="button"
                className={`tia-subtab ${activeNode === 'ob1' ? 'active' : ''}`}
                onClick={() => handleSelectTreeNode('ob1')}
              >
                <FileCode2 size={13} color="#2dd4bf" />
                <span>Main [OB1]</span>
              </button>
              <button
                type="button"
                className={`tia-subtab ${activeNode === 'ob100' ? 'active' : ''}`}
                onClick={() => handleSelectTreeNode('ob100')}
              >
                <PlaySquare size={13} color="#38bdf8" />
                <span>Startup [OB100]</span>
              </button>
              <button
                type="button"
                className={`tia-subtab ${activeNode === 'tags' ? 'active' : ''}`}
                onClick={() => handleSelectTreeNode('tags')}
              >
                <Table2 size={13} color="#fbbf24" />
                <span>PLC 变量表 ({tagDefs.length})</span>
              </button>
              <button
                type="button"
                className={`tia-subtab ${activeNode === 'watch' ? 'active' : ''}`}
                onClick={() => handleSelectTreeNode('watch')}
              >
                <Gauge size={13} color="#10b981" />
                <span>监控与强制表{activeForceCount > 0 ? ` [F:${activeForceCount}]` : ''}</span>
              </button>
            </div>

            {activeNode === 'ob1' || activeNode === 'ob100' ? (
              <>
                <SclCodeEditor
                  activeBlock={activeNode}
                  onSwitchBlock={(b) => setActiveNode(b)}
                  code={activeNode === 'ob1' ? ob1Code : ob100Code}
                  onChangeCode={(next) => {
                    if (activeNode === 'ob1') setOb1Code(next);
                    else setOb100Code(next);
                  }}
                  isDirtyOb1={isDirtyOb1}
                  isDirtyOb100={isDirtyOb100}
                  monitoring={monitoring && cpuMode === 'RUN'}
                  lineTelemetry={snapshot.lineTelemetry}
                  diagnostics={activeNode === 'ob1' ? (compileResult?.diagnostics ?? []) : []}
                  runtimeErrorLine={activeNode === 'ob1' ? snapshot.runtimeError?.line : undefined}
                  jumpRequest={jumpRequest}
                  tagDefs={tagDefs}
                  onCompile={handleCompile}
                  onDownload={handleDownload}
                  onRestoreDefault={() => {
                    if (activeNode === 'ob1') setOb1Code(activeTemplate.ob1Code);
                    else setOb100Code(activeTemplate.ob100Code);
                    showToast('已恢复模板初始代码（点击「下载到设备」生效）');
                  }}
                />

                <BottomInspector
                  activeTab={inspectorTab}
                  onChangeTab={setInspectorTab}
                  compileResult={compileResult}
                  compileTargetLabel={`${activeTemplate.title} · OB1/OB100`}
                  runtimeError={snapshot.runtimeError}
                  onJumpToLine={handleJumpToLine}
                  guideSteps={activeTemplate.guideSteps}
                  instances={snapshot.instances}
                  lastDownloadInfo={lastDownloadInfo}
                />
              </>
            ) : activeNode === 'tags' ? (
              <TagTableEditor
                tagDefs={tagDefs}
                liveTags={liveTags}
                monitoring={monitoring}
                onUpdateTagDefs={handleUpdateTagDefs}
                onResetDefaultTags={() => {
                  handleUpdateTagDefs([...activeTemplate.tagDefs]);
                  showToast('已恢复当前模板标准变量表');
                }}
              />
            ) : (
              <WatchForceTable
                tagDefs={tagDefs}
                liveTags={liveTags}
                forcedTags={snapshot.forcedTags}
                instances={snapshot.instances}
                onModifyTag={(name, value) => {
                  session.runtime.setTag(name, value);
                  syncImmediate();
                }}
                onSetForcedTag={(name, value) => {
                  session.setForcedTag(name, value);
                  syncImmediate();
                }}
                onClearAllForces={() => {
                  session.clearAllForces();
                  syncImmediate();
                }}
              />
            )}
          </main>

          {/* Right Pane: Live Plant & Virtual I/O Dock */}
          <div
            className={!showPlantOnMobile ? 'tia-pane-hidden-mobile' : ''}
            style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}
          >
            <LivePlantDock
              activePlant={activePlant}
              onSelectPlant={setActivePlant}
              runtime={session.runtime}
              tagDefs={tagDefs}
              liveTags={liveTags}
              cycleCount={snapshot.cycleCount}
              onSyncPlantTags={handleSyncPlantTags}
              onSwitchMatchingTemplate={handleSwitchMatchingTemplate}
              hasMatchingTemplate={hasMatchingTemplateForPlant}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TiaPortalIdeWorkbench;
