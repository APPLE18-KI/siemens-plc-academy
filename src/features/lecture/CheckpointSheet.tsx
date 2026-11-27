import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, CircleHelp, PauseCircle, XCircle } from 'lucide-react';
import type { Checkpoint } from '../../content/qa/types';
import { haptic } from '../../app/native/platform';
import { renderInline } from '../../components/MarkdownRenderer';

/**
 * 讲课中的“停一停”检查题（底部弹层）。
 * 规则：必须选对，或点“看解析”，才能继续往下讲。答错先给一句提示（不直接给答案），可以再选。
 * v3.0：支持数字键 1–4 快速选答案，答完后按 Enter/Space 继续；若触发前处于自动连播，答完后自动恢复。
 */
export const CheckpointSheet: React.FC<{
  cp: Checkpoint;
  index: number;
  count: number;
  willResumeAuto?: boolean;
  onDone: () => void;
}> = ({ cp, index, count, willResumeAuto = false, onDone }) => {
  // 选项顺序按题目做固定打乱，让正确答案不总在同一个位置（learn-quiz：vary the position）
  const order = React.useMemo(() => {
    let h = 0;
    for (const ch of cp.q) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const n = cp.options.length;
    const r = h % n;
    return cp.options.map((_, i) => (i + r) % n);
  }, [cp]);
  const ansPos = order.indexOf(cp.answer);
  const [wrong, setWrong] = useState<number[]>([]);
  const [solved, setSolved] = useState<'right' | 'revealed' | null>(null);
  const headRef = useRef<HTMLHeadingElement>(null);
  const contRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    headRef.current?.focus();
  }, []);
  useEffect(() => {
    if (solved) contRef.current?.focus({ preventScroll: true });
  }, [solved]);

  const pick = useCallback(
    (i: number) => {
      if (solved) return;
      if (i === cp.answer) {
        haptic('success');
        setSolved('right');
      } else {
        haptic('error');
        setWrong((w) => (w.includes(i) ? w : [...w, i]));
      }
    },
    [cp.answer, solved],
  );

  // 键盘快捷键：1–4（或 A–D）直接选答案，通过后按 Enter/Space 继续
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (!solved) {
        let pos = -1;
        if (e.key >= '1' && e.key <= '4') {
          pos = Number(e.key) - 1;
        } else if (/^[a-dA-D]$/.test(e.key)) {
          pos = e.key.toUpperCase().charCodeAt(0) - 65;
        }
        if (pos >= 0 && pos < order.length) {
          const optIdx = order[pos];
          if (!wrong.includes(optIdx)) {
            e.preventDefault();
            e.stopPropagation();
            pick(optIdx);
          }
        }
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        onDone();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [order, wrong, solved, pick, onDone]);

  return (
    <div className="cp-scrim" onClick={(e) => e.stopPropagation()}>
      <section className="cp-sheet" role="dialog" aria-modal="true" aria-labelledby="cp-q">
        <div className="cp-grip" aria-hidden />
        <div className="cp-kicker">
          <CircleHelp size={15} aria-hidden />
          <span>
            停一停，考考你（{index}/{count}）
          </span>
          {willResumeAuto && (
            <span className="cp-auto-pill">
              <PauseCircle size={13} aria-hidden />
              自动连播已暂停
            </span>
          )}
        </div>
        <h3 id="cp-q" ref={headRef} tabIndex={-1}>
          {cp.q}
        </h3>
        <div className="cp-opts" role="group" aria-label="选项">
          {order.map((i, pos) => {
            const o = cp.options[i];
            const isAns = i === cp.answer;
            const cls = solved && isAns ? ' is-right' : wrong.includes(i) ? ' is-wrong' : '';
            return (
              <button
                key={i}
                type="button"
                className={`cp-opt press${cls}`}
                onClick={() => pick(i)}
                disabled={!!solved || wrong.includes(i)}
                aria-describedby={wrong.includes(i) || (solved && isAns) ? 'cp-fb' : undefined}
                aria-keyshortcuts={String(pos + 1)}
              >
                <span className="cp-opt-key" aria-hidden>
                  {String.fromCharCode(65 + pos)}
                </span>
                <span>{o}</span>
                {!solved && !wrong.includes(i) && (
                  <kbd className="cp-kbd" aria-hidden>
                    {pos + 1}
                  </kbd>
                )}
                {solved && isAns && <CheckCircle2 size={18} className="cp-opt-ic" aria-label="正确答案" />}
                {wrong.includes(i) && <XCircle size={18} className="cp-opt-ic" aria-label="不对" />}
              </button>
            );
          })}
        </div>

        <div id="cp-fb" className="cp-fb" aria-live="polite">
          {solved === 'right' && (
            <p className="cp-ok">
              <b>答对了。</b>
              {renderInline(cp.why, 'cpw')}
            </p>
          )}
          {solved === 'revealed' && (
            <p className="cp-reveal">
              <b>解析：正确答案是 {String.fromCharCode(65 + ansPos)}。</b>
              {renderInline(cp.why, 'cpr')}
            </p>
          )}
          {!solved && wrong.length > 0 && (
            <p className="cp-nudge">
              <b>再想想：</b>
              {cp.nudge ?? '回看一下板书上刚写的那一行，再选一次。'}
            </p>
          )}
        </div>

        <div className="cp-actions">
          {!solved ? (
            <>
              <span className="cp-tip">
                点选项或按数字键 1–{order.length} 作答
                {willResumeAuto ? '，答完自动继续连播' : '，也可以看解析后继续'}
              </span>
              <button
                type="button"
                className="btn btn-sm press"
                onClick={() => {
                  haptic('tap');
                  setSolved('revealed');
                }}
              >
                看解析
              </button>
            </>
          ) : (
            <button ref={contRef} type="button" className="btn btn-primary cp-continue press" onClick={onDone}>
              {willResumeAuto ? '继续连播' : '继续讲'}
            </button>
          )}
        </div>
      </section>
    </div>
  );
};
