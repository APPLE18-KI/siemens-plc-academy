import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Cpu,
  Terminal,
} from 'lucide-react';
import { formatPlcValue } from '../../../core/scl';
import type {
  SclBlockInstanceState,
  SclCompileResult,
  SclDiagnostic,
  SclScanSnapshot,
} from '../../../core/scl/types';

export type InspectorTabId = 'compile' | 'guide' | 'instances';

export interface BottomInspectorProps {
  activeTab: InspectorTabId;
  onChangeTab: (tab: InspectorTabId) => void;
  compileResult: SclCompileResult | null;
  compileTargetLabel: string;
  runtimeError?: SclScanSnapshot['runtimeError'];
  onJumpToLine: (line: number, block?: 'ob1' | 'ob100') => void;
  guideSteps: string[];
  instances: Record<string, SclBlockInstanceState>;
  lastDownloadInfo: string | null;
}

export const BottomInspector: React.FC<BottomInspectorProps> = ({
  activeTab,
  onChangeTab,
  compileResult,
  compileTargetLabel,
  runtimeError,
  onJumpToLine,
  guideSteps,
  instances,
  lastDownloadInfo,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({});

  const diagnostics: SclDiagnostic[] = compileResult?.diagnostics ?? [];
  const errorCount = diagnostics.filter((d) => d.severity === 'error').length + (runtimeError ? 1 : 0);
  const warnCount = diagnostics.filter((d) => d.severity === 'warning').length;
  const instanceList = Object.values(instances);

  const toggleStep = (stepKey: string) => {
    setCheckedSteps((prev) => ({ ...prev, [stepKey]: !prev[stepKey] }));
  };

  return (
    <section className="tia-inspector" aria-label="TIA 检查窗口与编译输出">
      <div className="tia-inspector-tabs">
        <div className="tia-inspector-tab-list">
          <button
            type="button"
            className={`tia-inspector-tab ${activeTab === 'compile' ? 'active' : ''}`}
            onClick={() => {
              onChangeTab('compile');
              setCollapsed(false);
            }}
          >
            <Terminal size={13} />
            <span>信息 · 编译</span>
            {errorCount > 0 ? (
              <span
                style={{
                  fontSize: 10.5,
                  padding: '0 6px',
                  borderRadius: 99,
                  background: 'var(--fault-red-soft)',
                  color: 'var(--fault-red)',
                  fontWeight: 800,
                }}
              >
                {errorCount} 错
              </span>
            ) : compileResult?.ok ? (
              <CheckCircle2 size={13} color="var(--power-green)" />
            ) : null}
          </button>

          <button
            type="button"
            className={`tia-inspector-tab ${activeTab === 'guide' ? 'active' : ''}`}
            onClick={() => {
              onChangeTab('guide');
              setCollapsed(false);
            }}
          >
            <ClipboardCheck size={13} />
            <span>实训指引 ({guideSteps.length})</span>
          </button>

          <button
            type="button"
            className={`tia-inspector-tab ${activeTab === 'instances' ? 'active' : ''}`}
            onClick={() => {
              onChangeTab('instances');
              setCollapsed(false);
            }}
          >
            <Cpu size={13} />
            <span>背景 FB 实例 ({instanceList.length})</span>
          </button>
        </div>

        <button
          type="button"
          className="tia-tree-collapse-btn"
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? '展开检查窗口' : '折叠检查窗口'}
          aria-label={collapsed ? '展开检查窗口' : '折叠检查窗口'}
        >
          {collapsed ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>

      {!collapsed && (
        <div className="tia-inspector-body">
          {activeTab === 'compile' && (
            <div>
              {lastDownloadInfo && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    color: 'var(--power-green)',
                    marginBottom: 8,
                    fontWeight: 600,
                  }}
                >
                  <CheckCircle2 size={14} />
                  <span>{lastDownloadInfo}</span>
                </div>
              )}

              {runtimeError && (
                <button
                  type="button"
                  className="tia-diag-row error"
                  onClick={() => onJumpToLine(runtimeError.line)}
                >
                  <AlertCircle size={15} color="var(--fault-red)" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span className="tia-diag-line">L{runtimeError.line}</span>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--fault-red)' }}>
                      运行时错误：{runtimeError.message}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-secondary)', marginTop: 2 }}>
                      点击自动定位到对应代码行检查逻辑或防死循环条件。
                    </div>
                  </div>
                </button>
              )}

              {compileResult ? (
                <>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: 10,
                      fontSize: 12,
                      color: 'var(--ink-secondary)',
                      marginBottom: diagnostics.length > 0 ? 8 : 0,
                    }}
                  >
                    <strong style={{ color: compileResult.ok ? 'var(--power-green)' : 'var(--fault-red)' }}>
                      {compileResult.ok ? '✔ 编译完成' : '✖ 编译失败'} ({compileTargetLabel})
                    </strong>
                    <span>
                      错误: {diagnostics.filter((d) => d.severity === 'error').length} · 警告: {warnCount} · 耗时{' '}
                      {compileResult.compileTimeMs.toFixed(1)} ms
                    </span>
                    {compileResult.referencedTags.length > 0 && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-muted)' }}>
                        已绑定 {compileResult.referencedTags.length} 个符号变量
                      </span>
                    )}
                  </div>

                  {diagnostics.map((d, idx) => (
                    <button
                      key={`${d.line}-${d.col}-${idx}`}
                      type="button"
                      className={`tia-diag-row ${d.severity}`}
                      onClick={() =>
                        onJumpToLine(d.line, /OB100/i.test(d.message) ? 'ob100' : 'ob1')
                      }
                    >
                      {d.severity === 'error' ? (
                        <AlertCircle size={15} color="var(--fault-red)" style={{ flexShrink: 0, marginTop: 1 }} />
                      ) : (
                        <AlertTriangle size={15} color="var(--alarm-amber)" style={{ flexShrink: 0, marginTop: 1 }} />
                      )}
                      <span className="tia-diag-line">
                        L{d.line}:{d.col}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: 'var(--ink-primary)' }}>{d.message}</div>
                        {d.hint && (
                          <div style={{ fontSize: 11.5, color: 'var(--ink-secondary)', marginTop: 2 }}>
                            💡 {d.hint}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </>
              ) : (
                <div style={{ color: 'var(--ink-muted)', fontSize: 12 }}>
                  点击上方「编译」或「下载到设备」查看详细语法校验结果；遇到报错可直接点击错误行号自动定位。
                </div>
              )}
            </div>
          )}

          {activeTab === 'guide' && (
            <ul className="tia-guide-list">
              {guideSteps.length === 0 ? (
                <li style={{ color: 'var(--ink-muted)', fontSize: 12 }}>当前项目暂无预设步骤，可自由编写 SCL 并点击「下载到设备」。</li>
              ) : (
                guideSteps.map((step, i) => {
                  const key = `${i}-${step.slice(0, 16)}`;
                  const done = Boolean(checkedSteps[key]);
                  return (
                    <li
                      key={key}
                      className={`tia-guide-item ${done ? 'done' : ''}`}
                      onClick={() => toggleStep(key)}
                    >
                      <input
                        type="checkbox"
                        checked={done}
                        onChange={() => undefined}
                        style={{ marginTop: 2, accentColor: 'var(--power-green)' }}
                      />
                      <span style={{ textDecoration: done ? 'line-through' : 'none' }}>
                        <strong style={{ color: 'var(--siemens-teal-bright)', marginRight: 6 }}>
                          Step {i + 1}.
                        </strong>
                        {step}
                      </span>
                    </li>
                  );
                })
              )}
            </ul>
          )}

          {activeTab === 'instances' && (
            <div>
              {instanceList.length === 0 ? (
                <div style={{ color: 'var(--ink-muted)', fontSize: 12 }}>
                  当前 OB1 中尚未调用定时器/计数器/边沿检测背景实例（如 <code>#ton1(IN := ..., PT := T#3s);</code>）。
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                  {instanceList.map((inst) => {
                    const isTimer = inst.kind === 'TON' || inst.kind === 'TOF' || inst.kind === 'TP';
                    const pt = Number(inst.fields['PT'] ?? 0);
                    const et = Number(inst.fields['ET'] ?? 0);
                    const pct = isTimer && pt > 0 ? Math.min(100, Math.round((et / pt) * 100)) : 0;
                    const qVal = Boolean(inst.fields['Q']);
                    return (
                      <div
                        key={inst.name}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 8,
                          background: 'var(--bg-surface)',
                          border: `1px solid ${qVal ? 'var(--power-green-border)' : 'var(--border-hairline)'}`,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--db-violet)' }}>
                            #{inst.name}
                          </strong>
                          <span className="tia-tree-badge">{inst.kind}</span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                          {Object.entries(inst.fields).map(([k, v]) => (
                            <span key={k} style={{ color: k === 'Q' && v ? 'var(--power-green)' : 'var(--ink-secondary)' }}>
                              {k}={formatPlcValue(v, k === 'ET' || k === 'PT' ? 'Time' : undefined)}
                            </span>
                          ))}
                        </div>
                        {isTimer && pt > 0 && (
                          <div
                            style={{
                              marginTop: 6,
                              height: 5,
                              borderRadius: 99,
                              background: 'var(--bg-surface-3)',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${pct}%`,
                                height: '100%',
                                background: qVal ? 'var(--power-green)' : 'var(--info-cyan)',
                                transition: 'width 80ms linear',
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
