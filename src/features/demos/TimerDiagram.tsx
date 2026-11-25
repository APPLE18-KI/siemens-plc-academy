import React, { useEffect, useRef, useState } from 'react';
import { haptic } from '../../app/native/platform';
import { LandscapeSvgStage } from '../../components/LandscapeSvgStage';

/* TON / TOF / TP 时序图演示：按住 IN 按钮，实时画出 IN、Q 波形与 ET 计时。
 * 行为按 IEC 61131-3 定时器定义：
 *  TON：IN 持续为 1 达到 PT 后 Q = 1；IN 变 0 立刻复位。
 *  TOF：IN 为 1 时 Q = 1；IN 变 0 后再延时 PT，Q 才变 0。
 *  TP ：IN 上升沿触发，Q 输出固定 PT 长度的脉冲，期间 IN 变化不影响。 */

type TType = 'TON' | 'TOF' | 'TP';
const WINDOW_MS = 10000;
const SAMPLE_MS = 50;

interface Sample {
  t: number;
  inp: boolean;
  q: boolean;
}

const DESC: Record<TType, string> = {
  TON: '接通延时：按住 IN 满 PT 时间，Q 才变 1；中途松手，计时清零。像“长按 3 秒开机”。',
  TOF: '断开延时：IN 一变 1，Q 立刻为 1；松开后 Q 还要再保持 PT 时间才变 0。像“楼道灯，人走后再亮一会儿”。',
  TP: '脉冲：IN 一按下，Q 输出一段固定长度 PT 的脉冲，不管你按多久、中途松不松手。像“自动门开一下”。',
};

export const TimerDiagram: React.FC = () => {
  const [type, setType] = useState<TType>('TON');
  const [pt, setPt] = useState(3000);
  const [inp, setInp] = useState(false);
  const [view, setView] = useState({ q: false, et: 0, samples: [] as Sample[] });

  const st = useRef({ inp: false, prevIn: false, q: false, et: 0, running: false, samples: [] as Sample[], start: 0 });
  const cfg = useRef({ type, pt });
  cfg.current = { type, pt };
  st.current.inp = inp;

  useEffect(() => {
    // 切换类型或时间时复位
    st.current = { ...st.current, prevIn: false, q: false, et: 0, running: false, samples: [] };
  }, [type, pt]);

  useEffect(() => {
    st.current.start = performance.now();
    const id = window.setInterval(() => {
      if (document.hidden) return; // 页面在后台时暂停，省电
      const s = st.current;
      const { type: tt, pt: p } = cfg.current;
      const now = performance.now() - s.start;
      const rising = s.inp && !s.prevIn;
      const falling = !s.inp && s.prevIn;
      if (tt === 'TON') {
        if (s.inp) {
          s.et = Math.min(p, s.et + SAMPLE_MS);
          s.q = s.et >= p;
        } else {
          s.et = 0;
          s.q = false;
        }
      } else if (tt === 'TOF') {
        if (s.inp) {
          s.q = true;
          s.et = 0;
          s.running = false;
        } else {
          if (falling) s.running = true;
          if (s.running) {
            s.et = Math.min(p, s.et + SAMPLE_MS);
            if (s.et >= p) {
              s.q = false;
              s.running = false;
            }
          }
        }
      } else {
        if (rising && !s.running && !s.q) {
          s.running = true;
          s.q = true;
          s.et = 0;
        }
        if (s.running) {
          s.et = Math.min(p, s.et + SAMPLE_MS);
          if (s.et >= p) {
            s.q = false;
            s.running = false;
          }
        } else if (!s.inp && s.et >= p) {
          s.et = 0;
        }
      }
      s.prevIn = s.inp;
      s.samples.push({ t: now, inp: s.inp, q: s.q });
      while (s.samples.length && s.samples[0].t < now - WINDOW_MS) s.samples.shift();
      setView({ q: s.q, et: s.et, samples: s.samples.slice() });
    }, SAMPLE_MS);
    return () => window.clearInterval(id);
  }, []);

  const press = (v: boolean) => {
    if (v && !inp) haptic('press');
    setInp(v);
  };

  const W = 600;
  const H = 120;
  const last = view.samples.length ? view.samples[view.samples.length - 1].t : 0;
  const x = (t: number) => W - ((last - t) / WINDOW_MS) * W;
  const path = (key: 'inp' | 'q', y0: number) => {
    if (!view.samples.length) return '';
    let d = '';
    let prev: boolean | null = null;
    for (const s of view.samples) {
      const y = s[key] ? y0 : y0 + 30;
      const xx = x(s.t).toFixed(1);
      if (prev === null) d += `M ${xx} ${y}`;
      else if (prev !== s[key]) d += ` L ${xx} ${prev ? y0 : y0 + 30} L ${xx} ${y}`;
      else d += ` L ${xx} ${y}`;
      prev = s[key];
    }
    return d;
  };

  return (
    <div className="demo-root">
      <div className="type-chips" role="radiogroup" aria-label="选择定时器类型">
        {(['TON', 'TOF', 'TP'] as TType[]).map((t) => (
          <button key={t} type="button" role="radio" aria-checked={t === type} className={`filter-pill${t === type ? ' active' : ''}`} onClick={() => setType(t)}>
            {t}
          </button>
        ))}
        <label className="demo-field inline">
          <span>PT</span>
          <select value={pt} onChange={(e) => setPt(Number(e.target.value))}>
            <option value={2000}>T#2s</option>
            <option value={3000}>T#3s</option>
            <option value={5000}>T#5s</option>
          </select>
        </label>
      </div>
      <p className="demo-sub">{DESC[type]}</p>

      <div className="timer-stage">
        <button
          type="button"
          className={`timer-in-btn${inp ? ' down' : ''}`}
          aria-pressed={inp}
          onPointerDown={(e) => {
            e.preventDefault();
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            press(true);
          }}
          onPointerUp={() => press(false)}
          onPointerCancel={() => press(false)}
          onKeyDown={(e) => {
            if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
              e.preventDefault();
              press(true);
            }
          }}
          onKeyUp={(e) => {
            if (e.key === ' ' || e.key === 'Enter') press(false);
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {inp ? '按住中… IN = 1' : '按住我 · IN'}
        </button>
        <div className="timer-readout">
          <div className="timer-et">
            <span>ET（已计时）</span>
            <strong>{(view.et / 1000).toFixed(2)} s</strong>
            <span className="timer-bar" aria-hidden="true">
              <i style={{ width: `${(view.et / pt) * 100}%` }} />
            </span>
          </div>
          <div className={`timer-q${view.q ? ' on' : ''}`} role="status">
            Q = {view.q ? 1 : 0}
          </div>
        </div>
      </div>

      <LandscapeSvgStage
        title={`IEC 定时器 ${type} 实时时序图 (IN / Q 波形)`}
        subtitle={`PT = T#${pt / 1000}s · ET = ${(view.et / 1000).toFixed(2)}s · Q = ${view.q ? 1 : 0}`}
        scopeClassName="demo-root"
        fitMode="contain"
        compactHud
        inlineMinWidth={480}
        hint="最近 10 秒 IN / Q 时序波形 · 横屏可边按住 IN 边看高清方波"
        landscapeFooterLabel="IN 输入控制"
        controls={
          <>
            {(['TON', 'TOF', 'TP'] as TType[]).map((t) => (
              <button
                key={t}
                type="button"
                className={`lss-ctrl-btn ${t === type ? 'is-primary' : ''}`}
                onClick={() => setType(t)}
              >
                {t}
              </button>
            ))}
            {[2000, 3000, 5000].map((ms) => (
              <button
                key={ms}
                type="button"
                className={`lss-ctrl-btn ${pt === ms ? 'is-success' : ''}`}
                onClick={() => setPt(ms)}
              >
                T#{ms / 1000}s
              </button>
            ))}
          </>
        }
        landscapeFooter={
          <>
            <button
              type="button"
              className={`timer-in-btn${inp ? ' down' : ''}`}
              aria-pressed={inp}
              onPointerDown={(e) => {
                e.preventDefault();
                (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                press(true);
              }}
              onPointerUp={() => press(false)}
              onPointerCancel={() => press(false)}
              onContextMenu={(e) => e.preventDefault()}
            >
              {inp ? '按住中… IN = 1' : '按住我 · IN'}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
                ET: <strong style={{ color: '#f8fafc' }}>{(view.et / 1000).toFixed(2)}s</strong> / {pt / 1000}s
              </span>
              <span className={`timer-q${view.q ? ' on' : ''}`}>Q = {view.q ? 1 : 0}</span>
            </div>
          </>
        }
      >
        <svg className="timer-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="最近 10 秒的 IN 与 Q 波形">
          <text x="4" y="22" className="lbl">IN</text>
          <text x="4" y="82" className="lbl">Q</text>
          <path d={path('inp', 10)} className="wave in" />
          <path d={path('q', 70)} className="wave q" />
        </svg>
      </LandscapeSvgStage>
      <div className="demo-hint">图上是最近 10 秒的波形：上面是 IN，下面是 Q。试着“按 1 秒就松开”和“按住 4 秒”，对比三种定时器的不同。</div>
    </div>
  );
};
