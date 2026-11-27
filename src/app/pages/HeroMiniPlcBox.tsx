import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, RotateCcw, Sparkles } from 'lucide-react';
import { haptic } from '../native/platform';

type CoachStage = 'init' | 'latched' | 'jogging' | 'stopped';

/**
 * 首页首屏“30 秒真交互微电柜”：
 * 让零基础新手不用跳页、不用读长文，第一眼就能亲手按按钮点亮第一盏 PLC 指示灯，直观秒懂“常开、常闭、自锁、点动”。
 */
export const HeroMiniPlcBox: React.FC = () => {
  const [sb1Pressed, setSb1Pressed] = useState(false); // %I0.0 常开启动
  const [sb2Pressed, setSb2Pressed] = useState(false); // %I0.1 物理常闭停止（不按=1，按下=0）
  const [sb3Pressed, setSb3Pressed] = useState(false); // %I0.2 常开点动
  const [q00, setQ00] = useState(false); // %Q0.0 运行输出（自锁）
  const [stage, setStage] = useState<CoachStage>('init');
  const [triedSet, setTriedSet] = useState<{ start?: boolean; stop?: boolean; jog?: boolean }>({});
  const sb1TimerRef = useRef<number | undefined>(undefined);
  const sb2TimerRef = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(sb1TimerRef.current);
      window.clearTimeout(sb2TimerRef.current);
    },
    [],
  );

  // 物理输入端信号：SB2 为常闭按钮，平时送入 24V (=1)，按下断开 (=0)
  const i00 = sb1Pressed;
  const i01 = !sb2Pressed;
  const i02 = sb3Pressed;

  // 实时模拟 OB1 扫描求值：( (%I0.0 OR %Q0.0) AND %I0.1 ) OR (%I0.2 AND %I0.1)
  const sealPathOn = (i00 || q00) && i01;
  const jogPathOn = i02 && i01;
  const nextQ = sealPathOn || jogPathOn;

  useEffect(() => {
    // 只有走自锁支路（按过 SB1 且未按停止）才保持记忆；纯点动 SB3 松手即灭
    if (!i01) {
      setQ00(false);
    } else if (i00) {
      setQ00(true);
    }
  }, [i00, i01]);

  const lampOn = (q00 && i01) || jogPathOn;

  const handleTapStart = () => {
    haptic('success');
    window.clearTimeout(sb1TimerRef.current);
    setSb2Pressed(false);
    setSb1Pressed(true);
    setQ00(true);
    setTriedSet((p) => ({ ...p, start: true }));
    sb1TimerRef.current = window.setTimeout(() => {
      setSb1Pressed(false);
      setStage('latched');
    }, 360);
  };

  const handleTapStop = () => {
    haptic('tap');
    window.clearTimeout(sb2TimerRef.current);
    setSb1Pressed(false);
    setSb3Pressed(false);
    setSb2Pressed(true);
    setQ00(false);
    setStage('stopped');
    setTriedSet((p) => ({ ...p, stop: true }));
    sb2TimerRef.current = window.setTimeout(() => {
      setSb2Pressed(false);
    }, 420);
  };

  const startJog = () => {
    haptic('tap');
    setSb2Pressed(false);
    setSb3Pressed(true);
    setStage('jogging');
    setTriedSet((p) => ({ ...p, jog: true }));
  };

  const endJog = () => {
    setSb3Pressed(false);
  };

  const handleResetDemo = () => {
    haptic('tap');
    setSb1Pressed(false);
    setSb2Pressed(false);
    setSb3Pressed(false);
    setQ00(false);
    setStage('init');
    setTriedSet({});
  };

  const doneSteps = Number(Boolean(triedSet.start)) + Number(Boolean(triedSet.stop)) + Number(Boolean(triedSet.jog));

  let coachText = '先点一下绿色的「启动 SB1」按钮，看看松手之后右边的指示灯会不会灭？';
  if (sb1Pressed) {
    coachText = '正在按下 SB1：%I0.0 收到 24V 变成 1，电流一路绿到底，电机灯亮起！即将松开手指……';
  } else if (stage === 'jogging' && sb3Pressed) {
    coachText = '正在按住「点动 SB3」：它绕开了自锁支路，按住就转、一松手立刻停——车间调机对刀全靠它！';
  } else if (stage === 'jogging' && !sb3Pressed && !q00) {
    coachText = '看！松开「点动 SB3」灯马上就灭了，因为它没有并联自锁触点。再点「启动 SB1」对比一下！';
  } else if (stage === 'latched' && lampOn) {
    coachText = '神奇吧！你已经松开 SB1 了，灯居然还亮着——看梯形图左下角绿色的「%Q0.0 自锁支路」正在替按钮继续供电！现在点红色「停止 SB2」关掉它。';
  } else if (stage === 'stopped') {
    coachText = '灯灭了！注意红色停止按钮平时是接通的（=1），按下去才断开（=0），万一现场断线设备也会自动停机保安全。你已经看懂 PLC 最经典的「起保停」啦！';
  }

  const wireGreen = '#10b981';
  const wireIdle = '#4a607a';

  return (
    <div className="mini-plc-card" aria-label="30秒新手互动微电柜">
      <div className="mini-plc-topbar">
        <div className="mini-plc-title">
          <Sparkles size={14} />
          <span>30 秒亲手试一试：按按钮，看梯形图怎么“通电”</span>
        </div>
        <div className="mini-plc-status">
          <span className="mini-plc-progress">体验 {doneSteps}/3</span>
          {doneSteps > 0 && (
            <button type="button" className="mini-plc-reset" onClick={handleResetDemo} title="重置微实验">
              <RotateCcw size={12} />
              重置
            </button>
          )}
        </div>
      </div>

      {/* 1. 现场真实按钮与指示灯排 */}
      <div className="mini-plc-io-bar">
        <div className="mini-plc-btns" role="group" aria-label="电柜操作按钮">
          <button
            type="button"
            className={`mini-io-btn is-start${sb1Pressed ? ' is-pressed' : ''}${ stage === 'init' ? ' pulse-guide' : ''}`}
            onClick={handleTapStart}
          >
            <span className="mini-io-dot green" />
            <span>
              <strong>点一下 · 启动 SB1</strong>
              <small>%I0.0 常开 ({i00 ? '1 通' : '0 断'})</small>
            </span>
          </button>

          <button
            type="button"
            className={`mini-io-btn is-stop${sb2Pressed ? ' is-pressed' : ''}`}
            onClick={handleTapStop}
          >
            <span className="mini-io-dot red" />
            <span>
              <strong>点一下 · 停止 SB2</strong>
              <small>%I0.1 常闭 ({i01 ? '1 通' : '0 断'})</small>
            </span>
          </button>

          <button
            type="button"
            className={`mini-io-btn is-jog${sb3Pressed ? ' is-pressed' : ''}`}
            onPointerDown={startJog}
            onPointerUp={endJog}
            onPointerLeave={endJog}
            onPointerCancel={endJog}
            onKeyDown={(e) => {
              if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
                e.preventDefault();
                startJog();
              }
            }}
            onKeyUp={(e) => {
              if (e.key === ' ' || e.key === 'Enter') endJog();
            }}
          >
            <span className="mini-io-dot blue" />
            <span>
              <strong>按住不放 · 点动 SB3</strong>
              <small>%I0.2 点动 ({i02 ? '1 通' : '0 断'})</small>
            </span>
          </button>
        </div>

        <div className={`mini-plc-lamp${lampOn ? ' is-on' : ''}`} role="status" aria-live="polite">
          <span className="mini-lamp-bulb" aria-hidden="true" />
          <div>
            <div className="mini-lamp-title">{lampOn ? '电机运行灯 HL1：亮 (1)' : '电机运行灯 HL1：灭 (0)'}</div>
            <div className="mini-lamp-sub">输出端子 %Q0.0 {nextQ || lampOn ? '有电输出' : '无输出'}</div>
          </div>
        </div>
      </div>

      {/* 2. 实时通电变绿的迷你梯形图 SVG */}
      <div className="mini-plc-rung-wrap">
        <div className="mini-plc-rung-legend">
          <span>PLC 内部梯形图实时透视：</span>
          <span className="legend-on">━━ 绿色实线 = 有电导通</span>
          <span className="legend-off">╌╌ 虚线 = 断开没电</span>
        </div>
        <svg
          viewBox="0 0 500 132"
          width="100%"
          style={{ height: 'auto', display: 'block' }}
          role="img"
          aria-label="起保停与点动梯形图实时能流图"
        >
          {/* 左母线 */}
          <line x1="18" y1="12" x2="18" y2="120" stroke={wireGreen} strokeWidth="3.5" strokeLinecap="round" />
          {/* 右母线 */}
          <line x1="482" y1="12" x2="482" y2="120" stroke="#3b5168" strokeWidth="3" strokeLinecap="round" />

          {/* 主路左段 -> SB1 %I0.0 */}
          <line x1="18" y1="36" x2="78" y2="36" stroke={wireGreen} strokeWidth="2.5" />
          {/* SB1 触点 */}
          <rect
            x="78"
            y="22"
            width="54"
            height="28"
            rx="5"
            fill={i00 ? 'rgba(16,185,129,0.2)' : 'rgba(30,41,59,0.55)'}
            stroke={i00 ? wireGreen : wireIdle}
            strokeWidth="1.6"
          />
          <text x="105" y="34" textAnchor="middle" fill={i00 ? '#34d399' : '#cbd5e1'} fontSize="11" fontWeight="700">
            | | SB1
          </text>
          <text x="105" y="46" textAnchor="middle" fill="#94a3b8" fontSize="9.5">
            %I0.0
          </text>
          <line
            x1="132"
            y1="36"
            x2="176"
            y2="36"
            stroke={i00 ? wireGreen : wireIdle}
            strokeWidth="2.4"
            strokeDasharray={i00 ? undefined : '5 4'}
          />

          {/* 并联支路 1：%Q0.0 自锁触点 */}
          <line x1="46" y1="36" x2="46" y2="76" stroke={wireGreen} strokeWidth="2.2" />
          <line x1="46" y1="76" x2="78" y2="76" stroke={wireGreen} strokeWidth="2.2" />
          <rect
            x="78"
            y="62"
            width="54"
            height="28"
            rx="5"
            fill={q00 ? 'rgba(16,185,129,0.22)' : 'rgba(30,41,59,0.55)'}
            stroke={q00 ? wireGreen : wireIdle}
            strokeWidth="1.6"
          />
          <text x="105" y="74" textAnchor="middle" fill={q00 ? '#34d399' : '#cbd5e1'} fontSize="11" fontWeight="700">
            | | 自锁
          </text>
          <text x="105" y="86" textAnchor="middle" fill="#94a3b8" fontSize="9.5">
            %Q0.0
          </text>
          <path
            d="M 132 76 L 164 76 L 164 36"
            fill="none"
            stroke={q00 ? wireGreen : wireIdle}
            strokeWidth="2.2"
            strokeDasharray={q00 ? undefined : '5 4'}
          />

          {/* 并联支路 2：SB3 %I0.2 点动（绕过自锁记忆，但仍受停止按钮保护） */}
          <line x1="46" y1="76" x2="46" y2="112" stroke={wireGreen} strokeWidth="2.2" />
          <line x1="46" y1="112" x2="78" y2="112" stroke={wireGreen} strokeWidth="2.2" />
          <rect
            x="78"
            y="98"
            width="54"
            height="26"
            rx="5"
            fill={i02 ? 'rgba(56,189,248,0.22)' : 'rgba(30,41,59,0.55)'}
            stroke={i02 ? wireGreen : wireIdle}
            strokeWidth="1.6"
          />
          <text x="105" y="110" textAnchor="middle" fill={i02 ? '#34d399' : '#cbd5e1'} fontSize="10.5" fontWeight="700">
            | | SB3 点动
          </text>
          <text x="105" y="121" textAnchor="middle" fill="#94a3b8" fontSize="9">
            %I0.2
          </text>
          <path
            d="M 132 112 L 176 112 L 176 36"
            fill="none"
            stroke={i02 ? wireGreen : wireIdle}
            strokeWidth="2.2"
            strokeDasharray={i02 ? undefined : '5 4'}
          />

          {/* 汇合后经过停止按钮 SB2 (%I0.1) */}
          <line
            x1="176"
            y1="36"
            x2="236"
            y2="36"
            stroke={i00 || q00 || i02 ? wireGreen : wireIdle}
            strokeWidth="2.5"
            strokeDasharray={i00 || q00 || i02 ? undefined : '5 4'}
          />
          <rect
            x="236"
            y="22"
            width="74"
            height="28"
            rx="5"
            fill={i01 ? 'rgba(16,185,129,0.16)' : 'rgba(239,68,68,0.22)'}
            stroke={i01 ? wireGreen : '#ef4444'}
            strokeWidth="1.6"
          />
          <text x="273" y="34" textAnchor="middle" fill={i01 ? '#34d399' : '#fca5a5'} fontSize="11" fontWeight="700">
            | | 停止 SB2
          </text>
          <text x="273" y="46" textAnchor="middle" fill="#94a3b8" fontSize="9.5">
            %I0.1 (平时=1)
          </text>

          {/* 停止按钮后到输出线圈 (%Q0.0) */}
          <line
            x1="310"
            y1="36"
            x2="386"
            y2="36"
            stroke={lampOn ? wireGreen : wireIdle}
            strokeWidth="2.6"
            strokeDasharray={lampOn ? undefined : '5 4'}
          />
          <rect
            x="386"
            y="20"
            width="74"
            height="32"
            rx="16"
            fill={lampOn ? 'rgba(16,185,129,0.25)' : 'rgba(30,41,59,0.6)'}
            stroke={lampOn ? '#10b981' : wireIdle}
            strokeWidth="2"
          />
          <text x="423" y="34" textAnchor="middle" fill={lampOn ? '#6ee7b7' : '#cbd5e1'} fontSize="11.5" fontWeight="800">
            ( ) 电机 HL1
          </text>
          <text x="423" y="46" textAnchor="middle" fill="#94a3b8" fontSize="9.5">
            %Q0.0
          </text>
          <line x1="460" y1="36" x2="482" y2="36" stroke="#3b5168" strokeWidth="2.2" />
        </svg>
      </div>

      {/* 3. 一句话大白话实时解说 */}
      <div className={`mini-plc-coach${doneSteps >= 2 ? ' is-success' : ''}`} role="status" aria-live="polite">
        <div className="mini-plc-coach-text">
          {doneSteps >= 3 && <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 2, color: 'var(--power-green)' }} />}
          <span>{coachText}</span>
        </div>
        <Link to="/sim?preset=seal-in-motor" className="mini-plc-full-link">
          去完整仿真台玩更多
          <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
};
