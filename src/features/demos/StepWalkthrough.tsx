import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2, MousePointer2, RotateCcw, Target, HelpCircle } from 'lucide-react';
import { haptic } from '../../app/native/platform';

/* ---------------------------------------------------------------------------
 * 分步操作演示（“下一步”式），用手绘风格的示意界面讲解 TIA Portal / WinCC 操作。
 * 界面均为示意图，不是西门子软件截图；菜单文字按中文版界面常见叫法书写，
 * 不同版本可能略有差异。
 * ------------------------------------------------------------------------- */

export interface MockTreeItem {
  label: string;
  indent?: number;
  id?: string;
  icon?: 'folder' | 'cpu' | 'block' | 'table' | 'hmi' | 'screen' | 'project';
}

export interface MockDialog {
  title: string;
  rows?: { label: string; value: string; id?: string }[];
  list?: { label: string; id?: string; indent?: number }[];
  buttons?: { label: string; id?: string; primary?: boolean }[];
  note?: string;
}

export interface MockScreen {
  /** portal：博途启动视图；project：项目视图；plcsim：仿真器窗口；hmi：触摸屏运行画面 */
  layout: 'portal' | 'project' | 'plcsim' | 'hmi';
  title: string;
  menu?: string[];
  toolbar?: { label: string; id?: string }[];
  tree?: MockTreeItem[];
  /** 项目视图主编辑区 */
  editor?: {
    heading: string;
    kind?: 'lines' | 'ladder' | 'table' | 'device' | 'screen';
    lines?: string[];
    table?: { head: string[]; rows: string[][] };
    ladder?: { contacts: string[]; coil: string; energized?: boolean };
  };
  /** portal 视图左侧大按钮与右侧选项 */
  portal?: { left: { label: string; id?: string }[]; right: { label: string; id?: string }[] };
  /** 右侧（属性/指令/工具箱）面板 */
  side?: { heading: string; items: { label: string; id?: string }[] };
  /** plcsim 窗口 */
  plcsim?: { name: string; mode: 'STOP' | 'RUN'; ip: string };
  /** hmi 画面 */
  hmi?: { buttons: { label: string; id?: string }[]; lamp?: { label: string; on: boolean } };
  dialog?: MockDialog;
  /** 需要高亮（“点这里”）的元素 id 列表 */
  highlight?: string[];
}

export interface WalkStep {
  title: string;
  goal: string;
  actions: string[];
  why: string;
  screen: MockScreen;
  pitfall?: string;
}

const Hl: React.FC<{ id?: string; hl?: string[]; className?: string; children: React.ReactNode }> = ({
  id,
  hl,
  className = '',
  children,
}) => {
  const on = Boolean(id && hl?.includes(id));
  return (
    <span className={`mock-el ${className}${on ? ' is-hl' : ''}`}>
      {children}
      {on && (
        <span className="mock-cursor" aria-hidden="true">
          <MousePointer2 size={16} fill="currentColor" />
        </span>
      )}
    </span>
  );
};

const TREE_ICON: Record<string, string> = {
  folder: '▸',
  cpu: '▣',
  block: '▤',
  table: '▦',
  hmi: '▭',
  screen: '▢',
  project: '◆',
};

export const MockScreenView: React.FC<{ screen: MockScreen }> = ({ screen }) => {
  const hl = screen.highlight;
  return (
    <div className={`mock-window layout-${screen.layout}`} role="img" aria-label={`示意界面：${screen.title}`}>
      <div className="mock-titlebar">
        <span className="mock-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="mock-title-text">{screen.title}</span>
        <span className="mock-badge">示意图</span>
      </div>

      {screen.menu && (
        <div className="mock-menubar">
          {screen.menu.map((m) => (
            <Hl key={m} id={m} hl={hl} className="mock-menu-item">
              {m}
            </Hl>
          ))}
        </div>
      )}
      {screen.toolbar && (
        <div className="mock-toolbar">
          {screen.toolbar.map((t) => (
            <Hl key={t.label} id={t.id} hl={hl} className="mock-tool">
              {t.label}
            </Hl>
          ))}
        </div>
      )}

      <div className="mock-body">
        {screen.layout === 'portal' && screen.portal && (
          <div className="mock-portal">
            <div className="mock-portal-left">
              {screen.portal.left.map((b) => (
                <Hl key={b.label} id={b.id} hl={hl} className="mock-portal-btn">
                  {b.label}
                </Hl>
              ))}
            </div>
            <div className="mock-portal-right">
              {screen.portal.right.map((b) => (
                <Hl key={b.label} id={b.id} hl={hl} className="mock-portal-opt">
                  {b.label}
                </Hl>
              ))}
            </div>
          </div>
        )}

        {screen.layout === 'project' && (
          <div className="mock-project">
            <div className="mock-tree" aria-label="项目树">
              <div className="mock-pane-head">项目树</div>
              {(screen.tree ?? []).map((t, i) => (
                <div key={`${t.label}-${i}`} style={{ paddingLeft: 6 + (t.indent ?? 0) * 12 }}>
                  <Hl id={t.id} hl={hl} className="mock-tree-item">
                    <span className="mock-tree-icon">{TREE_ICON[t.icon ?? 'folder']}</span>
                    {t.label}
                  </Hl>
                </div>
              ))}
            </div>
            <div className="mock-editor">
              {screen.editor && (
                <>
                  <div className="mock-pane-head">{screen.editor.heading}</div>
                  {screen.editor.kind === 'ladder' && screen.editor.ladder && (
                    <div className={`mock-ladder${screen.editor.ladder.energized ? ' energized' : ''}`}>
                      <span className="mock-rail" />
                      {screen.editor.ladder.contacts.map((c, i) => (
                        <span key={i} className="mock-contact">
                          <Hl id={`contact-${i}`} hl={hl} className="mock-contact-sym">
                            -| |-
                          </Hl>
                          <small>{c}</small>
                        </span>
                      ))}
                      <span className="mock-wire" />
                      <span className="mock-contact">
                        <Hl id="coil" hl={hl} className="mock-contact-sym coil">
                          -( )-
                        </Hl>
                        <small>{screen.editor.ladder.coil}</small>
                      </span>
                    </div>
                  )}
                  {screen.editor.kind === 'table' && screen.editor.table && (
                    <div className="mock-table-wrap">
                      <table className="mock-table">
                        <thead>
                          <tr>
                            {screen.editor.table.head.map((h) => (
                              <th key={h}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {screen.editor.table.rows.map((r, i) => (
                            <tr key={i}>
                              {r.map((c, j) => (
                                <td key={j}>
                                  <Hl id={`cell-${i}-${j}`} hl={hl}>
                                    {c}
                                  </Hl>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {screen.editor.kind === 'device' && (
                    <div className="mock-device">
                      <Hl id="device-cpu" hl={hl} className="mock-device-cpu">
                        <span className="mock-device-brand">S7-1200</span>
                        <span className="mock-device-leds">
                          <i className="g" />
                          <i />
                          <i />
                        </span>
                        <span className="mock-device-port">
                          <Hl id="device-port" hl={hl} className="mock-port">
                            PN
                          </Hl>
                        </span>
                      </Hl>
                    </div>
                  )}
                  {screen.editor.kind === 'screen' && (
                    <div className="mock-hmi-canvas">
                      <Hl id="canvas-button" hl={hl} className="mock-hmi-btn">
                        启动
                      </Hl>
                      <Hl id="canvas-lamp" hl={hl} className="mock-hmi-lamp">
                        ●
                      </Hl>
                    </div>
                  )}
                  {(screen.editor.kind ?? 'lines') === 'lines' && (
                    <div className="mock-lines">
                      {(screen.editor.lines ?? []).map((l, i) => (
                        <div key={i}>
                          <Hl id={`line-${i}`} hl={hl}>
                            {l}
                          </Hl>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            {screen.side && (
              <div className="mock-side">
                <div className="mock-pane-head">{screen.side.heading}</div>
                {screen.side.items.map((s) => (
                  <div key={s.label}>
                    <Hl id={s.id} hl={hl} className="mock-side-item">
                      {s.label}
                    </Hl>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {screen.layout === 'plcsim' && screen.plcsim && (
          <div className="mock-plcsim">
            <div className="mock-plcsim-card">
              <div className="mock-plcsim-name">{screen.plcsim.name}</div>
              <div className="mock-plcsim-ip">IP：{screen.plcsim.ip}</div>
              <div className="mock-plcsim-leds">
                <span className={`led ${screen.plcsim.mode === 'RUN' ? 'run' : 'stop'}`} />
                <span>{screen.plcsim.mode === 'RUN' ? 'RUN（运行）' : 'STOP（停止）'}</span>
              </div>
              <div className="mock-plcsim-btns">
                <Hl id="sim-run" hl={hl} className="mock-tool">
                  RUN
                </Hl>
                <Hl id="sim-stop" hl={hl} className="mock-tool">
                  STOP
                </Hl>
              </div>
            </div>
          </div>
        )}

        {screen.layout === 'hmi' && screen.hmi && (
          <div className="mock-hmi-runtime">
            <div className="mock-hmi-panel">
              <div className="mock-hmi-head">根画面</div>
              <div className="mock-hmi-row">
                {screen.hmi.buttons.map((b) => (
                  <Hl key={b.label} id={b.id} hl={hl} className="mock-hmi-btn">
                    {b.label}
                  </Hl>
                ))}
                {screen.hmi.lamp && (
                  <span className={`mock-hmi-lamp${screen.hmi.lamp.on ? ' on' : ''}`}>
                    ● <small>{screen.hmi.lamp.label}</small>
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {screen.dialog && (
          <div className="mock-dialog-backdrop">
            <div className="mock-dialog" role="presentation">
              <div className="mock-dialog-title">{screen.dialog.title}</div>
              {screen.dialog.rows && (
                <div className="mock-dialog-rows">
                  {screen.dialog.rows.map((r) => (
                    <div key={r.label} className="mock-dialog-row">
                      <span className="mock-dialog-label">{r.label}</span>
                      <Hl id={r.id} hl={hl} className="mock-input">
                        {r.value}
                      </Hl>
                    </div>
                  ))}
                </div>
              )}
              {screen.dialog.list && (
                <div className="mock-dialog-list">
                  {screen.dialog.list.map((l) => (
                    <div key={l.label} style={{ paddingLeft: (l.indent ?? 0) * 12 }}>
                      <Hl id={l.id} hl={hl} className="mock-tree-item">
                        {l.label}
                      </Hl>
                    </div>
                  ))}
                </div>
              )}
              {screen.dialog.note && <div className="mock-dialog-note">{screen.dialog.note}</div>}
              {screen.dialog.buttons && (
                <div className="mock-dialog-btns">
                  {screen.dialog.buttons.map((b) => (
                    <Hl key={b.label} id={b.id} hl={hl} className={`mock-btn${b.primary ? ' primary' : ''}`}>
                      {b.label}
                    </Hl>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const StepWalkthrough: React.FC<{ steps: WalkStep[]; doneText?: string }> = ({ steps, doneText }) => {
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const total = steps.length;
  const step = steps[idx];

  const go = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(total - 1, next));
      if (clamped !== idx) haptic('tap');
      setIdx(clamped);
    },
    [idx, total]
  );

  const onNext = () => {
    if (idx === total - 1) {
      setDone(true);
      haptic('success');
      return;
    }
    go(idx + 1);
  };

  const firstRender = useRef(true);
  useEffect(() => {
    setDone(false);
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    // 手机上翻页后，若步骤标题已滚出屏幕，就把它带回视野
    const el = rootRef.current;
    if (el && el.getBoundingClientRect().top < 0) {
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    }
  }, [idx]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      onNext();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(idx - 1);
    }
  };

  return (
    <div className="walk-root" ref={rootRef} onKeyDown={onKeyDown}>
      <div className="walk-progress" role="tablist" aria-label="操作步骤">
        {steps.map((s, i) => (
          <button
            key={s.title}
            type="button"
            role="tab"
            aria-selected={i === idx}
            aria-label={`第 ${i + 1} 步：${s.title}`}
            className={`walk-dot${i === idx ? ' active' : ''}${i < idx ? ' passed' : ''}`}
            onClick={() => go(i)}
          >
            <span>{i + 1}</span>
          </button>
        ))}
      </div>

      <div className="walk-grid" aria-live="polite">
        <div className="walk-text">
          <div className="walk-step-no">
            第 {idx + 1} / {total} 步
          </div>
          <h4 className="walk-title">{step.title}</h4>
          <div className="walk-goal">
            <Target size={15} />
            <span>
              <strong>本步目标：</strong>
              {step.goal}
            </span>
          </div>
          <ol className="walk-actions">
            {step.actions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ol>
          <div className="walk-why">
            <HelpCircle size={15} />
            <span>
              <strong>为什么：</strong>
              {step.why}
            </span>
          </div>
          {step.pitfall && (
            <div className="walk-pitfall">
              <strong>容易出错：</strong>
              {step.pitfall}
            </div>
          )}
        </div>
        <div className="walk-visual">
          <MockScreenView screen={step.screen} />
        </div>
      </div>

      <div className="walk-nav">
        <button type="button" className="btn" onClick={() => go(idx - 1)} disabled={idx === 0}>
          <ChevronLeft size={16} />
          上一步
        </button>
        {done ? (
          <span className="walk-done" role="status">
            <CheckCircle2 size={17} />
            {doneText ?? '全部步骤看完了！'}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setIdx(0)}>
              <RotateCcw size={14} />
              从头再看
            </button>
          </span>
        ) : (
          <button type="button" className="btn btn-primary" onClick={onNext}>
            {idx === total - 1 ? '完成' : '下一步'}
            <ChevronRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
};
