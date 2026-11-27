import { CHECKPOINTS } from '../../content/qa/checkpoints';
import type { Checkpoint } from '../../content/qa/types';
import { CheckpointSheet } from './CheckpointSheet';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, HelpCircle, Lock, Pause, Play, RotateCcw, X } from 'lucide-react';
import type { Beat, BoardItem, LectureScript, LvValue, RungEl, RungSpec } from './types';
import { haptic } from '../../app/native/platform';
import { useBackDismiss } from '../../app/native/overlay';
import './lecture.css';

/* ───────────── 梯形图求值（板书用的迷你仿真） ───────────── */

type St = Record<string, LvValue>;

function passEl(el: RungEl, p: boolean, st: St): boolean {
  switch (el.t) {
    case 'NO':
    case 'P':
      return p && Boolean(st[el.tag]);
    case 'NC':
      return p && !st[el.tag];
    case 'COIL':
    case 'SET':
    case 'RESET':
      return p;
    default:
      return p && Boolean(st[`${el.tag}.Q`]);
  }
}

interface RungEval {
  inP: Record<string, boolean>;
  outP: Record<string, boolean>;
  coil: boolean;
}

function evalRung(r: RungSpec, st: St): RungEval {
  const inP: Record<string, boolean> = {};
  const outP: Record<string, boolean> = {};
  const chain = (els: RungEl[], p0: boolean) => {
    let p = p0;
    for (const el of els) {
      inP[el.id] = p;
      p = passEl(el, p, st);
      outP[el.id] = p;
    }
    return p;
  };
  let p = true;
  for (let i = 0; i < r.els.length; i++) {
    if (r.par && i === r.par.from) {
      const pin = p;
      const main = chain(r.els.slice(r.par.from, r.par.to + 1), pin);
      const br = chain(r.par.els, pin);
      p = main || br;
      i = r.par.to;
    } else {
      inP[r.els[i].id] = p;
      p = passEl(r.els[i], p, st);
      outP[r.els[i].id] = p;
    }
  }
  if (r.coil) {
    inP[r.coil.id] = p;
    outP[r.coil.id] = p;
  }
  return { inP, outP, coil: p };
}

function applyCoil(r: RungSpec, st: St) {
  const ev = evalRung(r, st);
  if (!r.coil) return;
  if (r.coil.t === 'COIL') st[r.coil.tag] = ev.coil;
  else if (r.coil.t === 'SET' && ev.coil) st[r.coil.tag] = true;
  else if (r.coil.t === 'RESET' && ev.coil) st[r.coil.tag] = false;
}

/** 回放到第 pos 步：累积 set，再让板上的梯形图各扫描两遍（自锁能稳定下来） */
function stateAt(beats: Beat[], pos: number): St {
  const st: St = {};
  const rungs: RungSpec[] = [];
  for (let k = 0; k < pos && k < beats.length; k++) {
    const b = beats[k];
    if (b.board?.kind === 'rung') rungs.push(b.board.rung);
    if (b.set) Object.assign(st, b.set);
    for (let pass = 0; pass < 2; pass++) rungs.forEach((r) => applyCoil(r, st));
  }
  return st;
}

/* ───────────── 板书渲染 ───────────── */

function renderText(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\[\[([\w-]+)\|([^\]]+)\]\]|\*\*((?:[^*]|\*(?!\*))+)\*\*|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) {
      out.push(
        <span key={i++} id={`lv-${m[1]}`} className="lv-term">
          {renderText(m[2])}
        </span>,
      );
    } else if (m[3]) {
      out.push(<strong key={i++}>{renderText(m[3])}</strong>);
    } else if (m[4]) {
      out.push(
        <code key={i++} className="lv-code">
          {m[4]}
        </code>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const CELL = 124;
const RY = 46;

const RungSvg: React.FC<{ r: RungSpec; st: St }> = ({ r, st }) => {
  const ev = evalRung(r, st);
  const hasPar = Boolean(r.par);
  const cols = r.els.length + (r.coil ? 1 : 0);
  const width = 18 + cols * CELL + 14;
  const height = hasPar ? RY + 92 : RY + 34;
  const cls = (on: boolean | undefined) => (on ? 'lvw on' : 'lvw no');

  const drawEl = (el: RungEl, x: number, y: number, key: string) => {
    const pin = ev.inP[el.id];
    const pout = ev.outP[el.id];
    const mid = x + CELL / 2;
    const isCoil = el.t === 'COIL' || el.t === 'SET' || el.t === 'RESET';
    const isBox = !isCoil && !['NO', 'NC', 'P'].includes(el.t);
    const sym = isCoil ? (pin ? 'on' : 'no') : pout ? 'on' : 'no';
    return (
      <g key={key} id={`lv-${el.id}`} className="lv-el">
        <line x1={x} y1={y} x2={mid - (isBox ? 22 : isCoil ? 11 : 8)} y2={y} className={cls(pin)} />
        {!isCoil && <line x1={mid + (isBox ? 22 : 8)} y1={y} x2={x + CELL} y2={y} className={cls(pout)} />}
        {isBox ? (
          <>
            <rect x={mid - 22} y={y - 14} width={44} height={30} rx={3} className={`lvs ${sym}`} />
            <text x={mid} y={y + 1} textAnchor="middle" className="lv-boxt">
              {el.t === 'BOX' ? el.arg : el.t}
            </text>
            {el.t !== 'BOX' && el.arg && (
              <text x={mid} y={y + 12} textAnchor="middle" className="lv-arg">
                {el.arg}
              </text>
            )}
          </>
        ) : isCoil ? (
          <>
            <path d={`M ${mid - 5} ${y - 12} Q ${mid - 13} ${y} ${mid - 5} ${y + 12}`} className={`lvs ${sym}`} />
            <path d={`M ${mid + 5} ${y - 12} Q ${mid + 13} ${y} ${mid + 5} ${y + 12}`} className={`lvs ${sym}`} />
            {el.t !== 'COIL' && (
              <text x={mid} y={y + 4} textAnchor="middle" className={`lv-pn ${sym}`}>
                {el.t === 'SET' ? 'S' : 'R'}
              </text>
            )}
          </>
        ) : (
          <>
            <line x1={mid - 8} y1={y - 12} x2={mid - 8} y2={y + 12} className={`lvs ${sym}`} />
            <line x1={mid + 8} y1={y - 12} x2={mid + 8} y2={y + 12} className={`lvs ${sym}`} />
            {el.t === 'NC' && <line x1={mid - 12} y1={y + 12} x2={mid + 12} y2={y - 12} className={`lvs ${sym}`} />}
            {el.t === 'P' && (
              <text x={mid} y={y + 4} textAnchor="middle" className={`lv-pn ${sym}`}>
                P
              </text>
            )}
          </>
        )}
        {el.addr && (
          <text x={mid} y={y - 30} textAnchor="middle" className="lv-addr">
            {el.addr}
          </text>
        )}
        <text x={mid} y={y - 18} textAnchor="middle" className="lv-tag">
          "{el.tag.length > 16 ? `${el.tag.slice(0, 15)}…` : el.tag}"
        </text>
      </g>
    );
  };

  const nodes: React.ReactNode[] = [];
  r.els.forEach((el, i) => nodes.push(drawEl(el, 18 + i * CELL, RY, `m${i}`)));
  if (r.par) {
    const x0 = 18 + r.par.from * CELL;
    const x1 = 18 + (r.par.to + 1) * CELL;
    const y2 = RY + 56;
    const pin = ev.inP[r.par.els[0]?.id];
    const pout = ev.outP[r.par.els[r.par.els.length - 1]?.id];
    nodes.push(<line key="pv0" x1={x0} y1={RY} x2={x0} y2={y2} className={cls(pin)} />);
    nodes.push(<line key="pv1" x1={x1} y1={RY} x2={x1} y2={y2} className={cls(pout)} />);
    const span = (x1 - x0) / Math.max(1, r.par.els.length);
    r.par.els.forEach((el, j) => {
      const ex = x0 + j * span + (span - CELL) / 2;
      nodes.push(<line key={`pf${j}`} x1={x0 + j * span} y1={y2} x2={ex} y2={y2} className={cls(ev.inP[el.id])} />);
      nodes.push(drawEl(el, ex, y2, `p${j}`));
      nodes.push(<line key={`pt${j}`} x1={ex + CELL} y1={y2} x2={x0 + (j + 1) * span} y2={y2} className={cls(ev.outP[el.id])} />);
    });
  }
  if (r.coil) nodes.push(drawEl(r.coil, 18 + r.els.length * CELL, RY, 'coil'));

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="lv-rung-svg" role="img" aria-label={r.net}>
      <line x1={18} y1={4} x2={18} y2={height - 4} className="lvw on rail" />
      {nodes}
    </svg>
  );
};

const BoardView: React.FC<{ item: BoardItem; st: St; fresh: boolean }> = ({ item, st, fresh }) => {
  const c = `lv-item${fresh ? ' is-fresh' : ''}`;
  switch (item.kind) {
    case 'title':
      return <h2 className={`${c} lv-title`}>{renderText(item.text)}</h2>;
    case 'line':
      return <p className={`${c} lv-line${item.key ? ' is-key' : ''}`}>{renderText(item.text)}</p>;
    case 'formula':
      return <p className={`${c} lv-formula`}>{renderText(item.text)}</p>;
    case 'pairs':
      return (
        <dl className={`${c} lv-pairs`}>
          {item.rows.map(([a, b], i) => (
            <div key={i}>
              <dt>{renderText(a)}</dt>
              <dd>{renderText(b)}</dd>
            </div>
          ))}
        </dl>
      );
    case 'rung':
      return (
        <figure className={`${c} lv-rung`} id={`lv-${item.id}`}>
          <figcaption>{item.rung.net}</figcaption>
          <div className="lv-rung-scroll">
            <RungSvg r={item.rung} st={st} />
          </div>
        </figure>
      );
    default:
      return null;
  }
};

/* ───────────── 播放器 ───────────── */

interface Props {
  script: LectureScript;
  lessonTitle: string;
  onClose: (goTo?: 'read' | 'try') => void;
}

const STORE = (id: string) => `plc-lecture-pos:${id}`;
const STORE_MAX = (id: string) => `plc-lecture-max:${id}`;
const STORE_CP = (id: string) => `plc-lecture-cp:${id}`;
const SPEED_KEY = 'plc-lecture-speed';

type SpeedRate = 0.8 | 1 | 1.4;
const SPEEDS: { rate: SpeedRate; label: string; short: string }[] = [
  { rate: 0.8, label: '慢 0.8x', short: '0.8x' },
  { rate: 1, label: '标准 1x', short: '1x' },
  { rate: 1.4, label: '快 1.4x', short: '1.4x' },
];

const stripMarkup = (text: string) =>
  text
    .replace(/\[\[[\w-]+\|([^\]]+)\]\]/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .trim();

function beatLabel(beat: Beat, stepNum: number): string {
  if (beat.board) {
    if (beat.board.kind === 'title') return stripMarkup(beat.board.text);
    if (beat.board.kind === 'rung') return beat.board.rung.net;
    if (beat.board.kind === 'line' || beat.board.kind === 'formula') {
      const clean = stripMarkup(beat.board.text);
      return clean.length > 22 ? `${clean.slice(0, 22)}…` : clean;
    }
    if (beat.board.kind === 'pairs') return `对照表（${beat.board.rows.length} 项）`;
  }
  if (beat.say) {
    const clean = stripMarkup(beat.say);
    return clean.length > 22 ? `${clean.slice(0, 22)}…` : clean;
  }
  return `第 ${stepNum} 步`;
}

function calcBeatDurationMs(beat: Beat | undefined, rate: SpeedRate): number {
  if (!beat) return 3000;
  const plain = beat.say ? stripMarkup(beat.say) : '';
  const hasRichBoard =
    beat.board?.kind === 'rung' || beat.board?.kind === 'pairs' || beat.board?.kind === 'formula';
  const baseMs = plain.length > 0 ? 1500 + plain.length * 155 + (hasRichBoard ? 700 : 0) : 2300;
  return Math.round(Math.min(9500, Math.max(2200, baseMs)) / rate);
}

export const LecturePlayer: React.FC<Props> = ({ script, lessonTitle, onClose }) => {
  const beats = script.beats;
  const total = beats.length;
  const cps = useMemo(() => CHECKPOINTS[script.lessonId] ?? [], [script.lessonId]);

  const [pos, setPos] = useState(() => {
    try {
      const v = Number(localStorage.getItem(STORE(script.lessonId)));
      return v > 0 && v < total ? v : 1;
    } catch {
      return 1;
    }
  });
  const [maxReached, setMaxReached] = useState(() => {
    try {
      const savedPos = Number(localStorage.getItem(STORE(script.lessonId))) || 1;
      const savedMax = Number(localStorage.getItem(STORE_MAX(script.lessonId))) || 1;
      const base = Math.max(savedPos > 0 && savedPos <= total ? savedPos : 1, savedMax);
      return Math.min(total, Math.max(1, base));
    } catch {
      return 1;
    }
  });
  const [cleared, setCleared] = useState<number[]>(() => {
    try {
      const raw = localStorage.getItem(STORE_CP(script.lessonId));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.filter((n): n is number => typeof n === 'number');
      }
      const savedPos = Number(localStorage.getItem(STORE(script.lessonId))) || 1;
      return cps.filter((cp) => Math.min(cp.after, total) < savedPos).map((cp) => cp.after);
    } catch {
      return [];
    }
  });
  const [speed, setSpeedState] = useState<SpeedRate>(() => {
    try {
      const raw = Number(localStorage.getItem(SPEED_KEY));
      return raw === 0.8 || raw === 1 || raw === 1.4 ? raw : 1;
    } catch {
      return 1;
    }
  });
  const [autoPlay, setAutoPlay] = useState(false);
  const [resumeAutoAfterCp, setResumeAutoAfterCp] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [guide, setGuide] = useState(() => {
    try {
      return !localStorage.getItem('plc-lecture-guide');
    } catch {
      return false;
    }
  });
  const [cpOpen, setCpOpen] = useState<Checkpoint | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const inkRef = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number; t: number } | null>(null);
  const done = pos > total;

  useBackDismiss(true, () => onClose());

  const setSpeed = useCallback((rate: SpeedRate) => {
    haptic('tap');
    setSpeedState(rate);
    const label = SPEEDS.find((s) => s.rate === rate)?.label ?? `${rate}x`;
    setStatusMsg(`语速已切换为 ${label}`);
    try {
      localStorage.setItem(SPEED_KEY, String(rate));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const clampedPos = Math.min(pos, total);
    if (clampedPos > maxReached) setMaxReached(clampedPos);
    try {
      localStorage.setItem(STORE(script.lessonId), String(clampedPos));
    } catch {
      /* ignore */
    }
  }, [pos, script.lessonId, total, maxReached]);

  useEffect(() => {
    try {
      localStorage.setItem(STORE_MAX(script.lessonId), String(maxReached));
      localStorage.setItem(STORE_CP(script.lessonId), JSON.stringify(cleared));
    } catch {
      /* ignore */
    }
  }, [maxReached, cleared, script.lessonId]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const st = useMemo(() => stateAt(beats, Math.min(pos, total)), [beats, pos, total]);
  const shown = useMemo(() => {
    const items: { item: BoardItem; idx: number }[] = [];
    beats.slice(0, Math.min(pos, total)).forEach((b, idx) => b.board && items.push({ item: b.board, idx }));
    return items;
  }, [beats, pos, total]);
  const cur = !done ? beats[pos - 1] : undefined;
  const narration = cur?.say;

  const nextGate = useMemo(() => {
    const pending = cps
      .filter((cp) => !cleared.includes(cp.after))
      .map((cp) => Math.min(cp.after, total))
      .sort((a, b) => a - b);
    return pending[0] ?? total;
  }, [cps, cleared, total]);

  const unlockedUpTo = Math.min(Math.max(maxReached, Math.min(pos, total)), nextGate);
  const cpByStep = useMemo(() => {
    const map = new Map<number, Checkpoint>();
    cps.forEach((cp) => map.set(Math.min(cp.after, total), cp));
    return map;
  }, [cps, total]);

  const cpRef = useRef<{ pos: number; cleared: number[]; open: boolean; autoPlay: boolean }>({
    pos,
    cleared,
    open: false,
    autoPlay,
  });
  cpRef.current = { pos, cleared, open: !!cpOpen, autoPlay };

  const advance = useCallback(
    (fromAuto = false) => {
      const c = cpRef.current;
      if (c.open) return;
      const cp = cps.find((x) => Math.min(x.after, total) === c.pos && !c.cleared.includes(x.after));
      if (cp && c.pos <= total) {
        haptic('press');
        if (c.autoPlay || fromAuto) {
          setAutoPlay(false);
          setResumeAutoAfterCp(true);
          setStatusMsg('遇到检查题，自动连播已暂停，答完后继续。');
        } else {
          setResumeAutoAfterCp(false);
        }
        setCpOpen(cp);
        return;
      }
      setGuide(false);
      try {
        localStorage.setItem('plc-lecture-guide', '1');
      } catch {
        /* ignore */
      }
      setPos((p) => {
        if (p > total) return p;
        const finishing = p === total;
        if (finishing) {
          setAutoPlay(false);
          if (fromAuto) setStatusMsg('这一讲的板书已播完。');
        }
        haptic(finishing ? 'success' : 'tap');
        return p + 1;
      });
    },
    [total, cps],
  );

  const next = useCallback(() => advance(false), [advance]);

  const prev = useCallback(() => {
    if (cpRef.current.open) return;
    setAutoPlay(false);
    setPos((p) => {
      if (p <= 1) return p;
      haptic('tap');
      return p - 1;
    });
  }, []);

  const toggleAutoPlay = useCallback(() => {
    if (cpRef.current.open || done) return;
    haptic('tap');
    setGuide(false);
    setAutoPlay((playing) => {
      const nextPlaying = !playing;
      if (!nextPlaying) setResumeAutoAfterCp(false);
      const label = SPEEDS.find((s) => s.rate === speed)?.label ?? `${speed}x`;
      setStatusMsg(nextPlaying ? `开始自动连播（${label}）` : '已暂停自动连播');
      return nextPlaying;
    });
  }, [done, speed]);

  const jumpToStep = useCallback(
    (stepNum: number) => {
      if (cpRef.current.open) return;
      if (stepNum > nextGate) {
        haptic('error');
        setStatusMsg(`先答完第 ${nextGate} 步的检查题，才能看后面的步骤。`);
        return;
      }
      if (stepNum > unlockedUpTo) {
        haptic('tap');
        setStatusMsg(`第 ${stepNum} 步还没讲到，继续往后听就会解锁。`);
        return;
      }
      haptic('tap');
      setAutoPlay(false);
      setResumeAutoAfterCp(false);
      setPos(stepNum);
      setStatusMsg(`已跳到第 ${stepNum} 步（共 ${total} 步）`);
    },
    [nextGate, unlockedUpTo, total],
  );

  const beatDurationMs = useMemo(() => calcBeatDurationMs(cur, speed), [cur, speed]);

  useEffect(() => {
    if (!autoPlay || done || cpOpen || guide) return;
    const timer = window.setTimeout(() => advance(true), beatDurationMs);
    return () => window.clearTimeout(timer);
  }, [autoPlay, done, cpOpen, guide, pos, beatDurationMs, advance]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return;
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (cpRef.current.open) return;
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        prev();
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        toggleAutoPlay();
      } else if (e.key === '[') {
        e.preventDefault();
        const idx = SPEEDS.findIndex((s) => s.rate === speed);
        if (idx > 0) setSpeed(SPEEDS[idx - 1].rate);
      } else if (e.key === ']') {
        e.preventDefault();
        const idx = SPEEDS.findIndex((s) => s.rate === speed);
        if (idx < SPEEDS.length - 1) setSpeed(SPEEDS[idx + 1].rate);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, onClose, toggleAutoPlay, speed, setSpeed]);

  /* 指针：移动到目标；新写的板书滚到可见 */
  useLayoutEffect(() => {
    const board = boardRef.current;
    const ink = inkRef.current;
    if (!board || !ink) return;
    const place = () => {
      const targetId = cur?.at;
      const lastFresh = board.querySelector('.lv-item.is-fresh');
      const target = targetId ? (board.querySelector(`#lv-${CSS.escape(targetId)}`) as HTMLElement | SVGElement | null) : null;
      const focusEl = (target as Element | null) ?? lastFresh;
      if (focusEl) {
        const br = board.getBoundingClientRect();
        const r = focusEl.getBoundingClientRect();
        if (r.bottom > br.bottom - 8 || r.top < br.top + 8) {
          board.scrollTo({ top: board.scrollTop + (r.top - br.top) - br.height * 0.35, behavior: 'smooth' });
        }
        // 横向：梯形图元件滚入视野
        const sc = (focusEl as Element).closest('.lv-rung-scroll') as HTMLElement | null;
        if (sc) {
          const sr = sc.getBoundingClientRect();
          if (r.right > sr.right || r.left < sr.left) sc.scrollTo({ left: sc.scrollLeft + (r.left - sr.left) - 40, behavior: 'smooth' });
        }
      }
      if (!target) {
        ink.style.opacity = '0';
        return;
      }
      window.setTimeout(() => {
        const br = board.getBoundingClientRect();
        const r = target.getBoundingClientRect();
        const mode = cur?.ink ?? (target.closest('svg') ? 'box' : 'line');
        ink.dataset.mode = mode;
        ink.style.opacity = '1';
        const pad = mode === 'box' ? 5 : 0;
        ink.style.transform = `translate(${r.left - br.left + board.scrollLeft - pad}px, ${r.top - br.top + board.scrollTop - pad}px)`;
        ink.style.width = `${r.width + pad * 2}px`;
        ink.style.height = `${r.height + pad * 2}px`;
      }, 380);
    };
    place();
    const ro = new ResizeObserver(() => place());
    ro.observe(board);
    return () => ro.disconnect();
  }, [pos, cur]);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current;
    touch.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      if (dx < 0) next();
      else prev();
    }
  };
  const onBoardClick = (e: React.MouseEvent) => {
    // 在梯形图横向滚动区内拖动时不翻页
    if ((e.target as Element).closest('.lv-rung-scroll') && window.getSelection()?.toString()) return;
    next();
  };

  return (
    <div className="lv-overlay" role="dialog" aria-modal="true" aria-label={`讲课模式：${lessonTitle}`}>
      <header className="lv-head">
        <button type="button" className="lv-icon" onClick={() => onClose()} aria-label="退出讲课模式">
          <X size={20} />
        </button>
        <div className="lv-head-title">
          <span className="lv-head-tag">讲课模式</span>
          <span className="lv-head-name">{lessonTitle}</span>
        </div>
        <button
          type="button"
          className="lv-icon"
          onClick={() => {
            setAutoPlay(false);
            setGuide((g) => !g);
          }}
          aria-label="操作说明"
          aria-expanded={guide}
        >
          <HelpCircle size={19} />
        </button>
      </header>
      <nav className="lv-scrubber" aria-label="板书步骤进度条">
        <div className="lv-scrubber-track">
          {beats.map((beat, idx) => {
            const stepNum = idx + 1;
            const isCurrent = !done && stepNum === pos;
            const isPassed = done || stepNum < pos;
            const isUnlocked = stepNum <= unlockedUpTo;
            const isGated = stepNum > nextGate;
            const cp = cpByStep.get(stepNum);
            const cpCleared = cp ? cleared.includes(cp.after) : false;
            const preview = beatLabel(beat, stepNum);

            let segCls = 'lv-seg';
            if (isCurrent) segCls += ' is-current';
            else if (isPassed) segCls += ' is-passed';
            else if (isUnlocked) segCls += ' is-unlocked';
            else if (isGated) segCls += ' is-gated';
            else segCls += ' is-locked';
            if (cp) segCls += cpCleared ? ' has-cp is-cp-done' : ' has-cp';
            if (beat.board?.kind === 'title') segCls += ' is-title';

            const stateDesc = isGated
              ? `未解锁，需先完成第 ${nextGate} 步检查题`
              : isUnlocked
                ? '可点击回看'
                : '尚未讲到';

            return (
              <button
                key={idx}
                type="button"
                className={segCls}
                onClick={() => jumpToStep(stepNum)}
                aria-current={isCurrent ? 'step' : undefined}
                aria-disabled={!isUnlocked}
                aria-label={`第 ${stepNum} 步：${preview}（${stateDesc}）`}
                title={`第 ${stepNum}/${total} 步 · ${preview}`}
              >
                <span className="lv-seg-bar">
                  {isCurrent && autoPlay && !cpOpen && !guide && (
                    <span
                      key={`${pos}-${speed}-${autoPlay}`}
                      className="lv-seg-autofill"
                      style={{ animationDuration: `${beatDurationMs}ms` }}
                    />
                  )}
                </span>
                {cp && <span className="lv-seg-dot" aria-hidden />}
              </button>
            );
          })}
        </div>
        <div className="lv-scrubber-meta">
          <span className="lv-scrubber-caption">
            {done ? '已讲完，点任意已看节点可回看' : `第 ${pos} 步：${beatLabel(beats[pos - 1], pos)}`}
          </span>
          {nextGate < total && (
            <span className="lv-scrubber-lock">
              <Lock size={11} aria-hidden />
              第 {nextGate} 步检查题后解锁后续
            </span>
          )}
        </div>
      </nav>
      <div className="lv-sr-only" role="status" aria-live="polite" aria-atomic="true">
        {statusMsg}
      </div>

      {!done ? (
        <>
          <div
            className="lv-board"
            ref={boardRef}
            onClick={onBoardClick}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            aria-live="polite"
          >
            <div className="lv-board-inner">
              {shown.map(({ item, idx }) => (
                <BoardView key={idx} item={item} st={st} fresh={idx === pos - 1} />
              ))}
            </div>
            <div className="lv-ink" ref={inkRef} aria-hidden />
          </div>
          <div className="lv-say" aria-live="polite">
            {narration ? (
              <p key={pos}>{renderText(narration)}</p>
            ) : (
              <p key={pos} className="lv-say-muted">
                （看板书）
              </p>
            )}
          </div>
          {guide && (
            <div className="lv-guide" role="note">
              <b>讲课操作说明</b>
              <span>
                点板书、点“下一步”或按空格往下讲，左滑前进、右滑回退。打开“自动讲”会按旁白字数自动翻页，遇到检查题自动暂停；顶部进度条点已看过的步骤就能回看。检查题里按数字键 1–4 选答案，按 P 切换自动连播。
              </span>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setGuide(false)}>
                知道了
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="lv-end">
          <h2>这一讲的骨架讲完了</h2>
          <p>板书上的每一行都标成了正文里的“要点”。接下来读正文，细节、例子和测验都在里面。</p>
          {script.tryIt && <p className="lv-end-try">{script.tryIt}</p>}
          <div className="lv-end-btns">
            <button type="button" className="btn btn-primary" onClick={() => onClose('read')}>
              进入正文（精读）
            </button>
            {script.tryIt && (
              <button type="button" className="btn" onClick={() => onClose('try')}>
                去动手试一试
              </button>
            )}
            <button
              type="button"
              className="btn"
              onClick={() => {
                haptic('tap');
                setAutoPlay(false);
                setResumeAutoAfterCp(false);
                setCleared([]);
                setMaxReached(1);
                setPos(1);
                setStatusMsg('已回到第 1 步重新播放');
              }}
            >
              <RotateCcw size={15} /> 重播
            </button>
          </div>
        </div>
      )}

      {cpOpen && (
        <CheckpointSheet
          cp={cpOpen}
          index={cps.indexOf(cpOpen) + 1}
          count={cps.length}
          willResumeAuto={resumeAutoAfterCp}
          onDone={() => {
            const shouldResume = resumeAutoAfterCp;
            setCleared((c) => (c.includes(cpOpen.after) ? c : [...c, cpOpen.after]));
            setCpOpen(null);
            setResumeAutoAfterCp(false);
            setPos((p) => {
              const finishing = p === total;
              haptic(finishing ? 'success' : 'tap');
              if (shouldResume && !finishing) {
                setAutoPlay(true);
                setStatusMsg('检查题已通过，继续自动连播。');
              }
              return p + 1;
            });
          }}
        />
      )}

      <footer className="lv-deck">
        <div className="lv-playbar">
          <button
            type="button"
            className={`lv-auto-btn press${autoPlay ? ' is-playing' : ''}`}
            onClick={toggleAutoPlay}
            disabled={done || !!cpOpen}
            aria-pressed={autoPlay}
            aria-keyshortcuts="p"
          >
            {autoPlay ? <Pause size={15} aria-hidden /> : <Play size={15} aria-hidden />}
            <span>{autoPlay ? '暂停连播' : '自动讲'}</span>
          </button>

          <div className="lv-speed-group" role="group" aria-label="自动连播语速">
            {SPEEDS.map((s) => (
              <button
                key={s.rate}
                type="button"
                className={`lv-speed-btn press${speed === s.rate ? ' is-active' : ''}`}
                aria-pressed={speed === s.rate}
                onClick={() => setSpeed(s.rate)}
              >
                <span className="lv-speed-full">{s.label}</span>
                <span className="lv-speed-short" aria-hidden>
                  {s.short}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="lv-ctl">
          <button type="button" className="lv-nav" onClick={prev} disabled={pos <= 1 || !!cpOpen} aria-label="上一步">
            <ChevronLeft size={22} />
          </button>
          <span className="lv-count">
            {Math.min(pos, total)} / {total}
          </span>
          <button type="button" className="lv-next" onClick={next} disabled={done || !!cpOpen}>
            {pos >= total ? (done ? '已讲完' : '讲完') : '下一步'}
            <ChevronRight size={20} />
          </button>
        </div>
      </footer>
    </div>
  );
};
