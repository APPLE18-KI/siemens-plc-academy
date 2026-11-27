import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  Cpu,
  Gauge,
  Info,
  Power,
  RotateCcw,
  ShieldAlert,
  Sliders,
} from 'lucide-react';

interface Stw1BitDef {
  bit: number;
  shortName: string;
  label: string;
  meaningOn: string;
  meaningOff: string;
  critical?: boolean;
}

/** PROFIdrive Standard Telegram 1 — STW1 (%QW256) bit layout */
const STW1_BITS: Stw1BitDef[] = [
  { bit: 15, shortName: 'RES', label: '保留位', meaningOn: '保留', meaningOff: '默认 0' },
  { bit: 14, shortName: 'MOP-', label: '电动电位器减', meaningOn: '降速', meaningOff: '未触发' },
  { bit: 13, shortName: 'MOP+', label: '电动电位器加', meaningOn: '增速', meaningOff: '未触发' },
  { bit: 12, shortName: 'RES', label: '保留位', meaningOn: '保留', meaningOff: '默认 0' },
  { bit: 11, shortName: 'INV', label: '设定值反向', meaningOn: '反转取反', meaningOff: '正向输出' },
  {
    bit: 10,
    shortName: 'PLC',
    label: 'PLC 控制权',
    meaningOn: '由 PLC 主控 (必置 1)',
    meaningOff: '忽略报文控制字',
    critical: true,
  },
  { bit: 9, shortName: 'JOG2', label: '点动 2', meaningOn: '点动 2 有效', meaningOff: '关闭' },
  { bit: 8, shortName: 'JOG1', label: '点动 1', meaningOn: '点动 1 有效', meaningOff: '关闭' },
  {
    bit: 7,
    shortName: 'ACK',
    label: '故障确认',
    meaningOn: '上升沿复位故障 (04FE)',
    meaningOff: '常态 0',
    critical: true,
  },
  { bit: 6, shortName: 'SP_EN', label: '设定值使能', meaningOn: '允许速度给定', meaningOff: '给定强制为 0' },
  { bit: 5, shortName: 'RFG_C', label: '斜坡保持释放', meaningOn: '斜坡继续', meaningOff: '冻结斜坡输出' },
  { bit: 4, shortName: 'RFG_E', label: '斜坡发生器使能', meaningOn: '允许斜坡加减速', meaningOff: '斜坡归零' },
  {
    bit: 3,
    shortName: 'OP_EN',
    label: '使能运行脉冲',
    meaningOn: '逆变脉冲使能',
    meaningOff: '封锁输出脉冲',
    critical: true,
  },
  {
    bit: 2,
    shortName: 'OFF3',
    label: '快速停机 (低有效)',
    meaningOn: '无 OFF3 正常',
    meaningOff: '触发快速停机',
    critical: true,
  },
  {
    bit: 1,
    shortName: 'OFF2',
    label: '自由滑行 (低有效)',
    meaningOn: '无 OFF2 正常',
    meaningOff: '切断脉冲自由滑行',
    critical: true,
  },
  {
    bit: 0,
    shortName: 'OFF1',
    label: 'ON/OFF1 启停',
    meaningOn: '上升沿启动运行 (047F)',
    meaningOff: '准备/斜坡停机 (047E)',
    critical: true,
  },
];

interface Zsw1BitDef {
  bit: number;
  shortName: string;
  label: string;
}

const ZSW1_KEY_BITS: Zsw1BitDef[] = [
  { bit: 0, shortName: 'RDY_ON', label: '准备接通' },
  { bit: 1, shortName: 'RDY_OP', label: '准备运行' },
  { bit: 2, shortName: 'OP_EN', label: '运行使能 (#qRunning)' },
  { bit: 3, shortName: 'FAULT', label: '驱动故障 (#qDriveFault)' },
  { bit: 4, shortName: 'NO_OFF2', label: '无 OFF2 停机' },
  { bit: 5, shortName: 'NO_OFF3', label: '无 OFF3 停机' },
  { bit: 6, shortName: 'SW_INH', label: '接通禁止 (须先发 047E)' },
  { bit: 7, shortName: 'WARN', label: '驱动预警 (#qDriveWarn)' },
  { bit: 9, shortName: 'PLC_REQ', label: '请求 PLC 控制' },
  { bit: 10, shortName: 'F_REACH', label: '到达目标转速' },
];

function toHex16(val: number): string {
  return `16#${(val & 0xffff).toString(16).toUpperCase().padStart(4, '0')}`;
}

function toBin16Grouped(val: number): string {
  const b = (val & 0xffff).toString(2).padStart(16, '0');
  return `${b.slice(0, 4)}_${b.slice(4, 8)}_${b.slice(8, 12)}_${b.slice(12, 16)}`;
}

function getBit(word: number, bit: number): boolean {
  return ((word >> bit) & 1) === 1;
}

const PRESETS: Array<{
  id: string;
  hex: number;
  label: string;
  caption: string;
  tone: 'teal' | 'green' | 'amber' | 'red';
}> = [
  { id: 'ready', hex: 0x047e, label: '16#047E · 待机就绪', caption: 'Bit0=0, Bit1..6=1, Bit10=1', tone: 'teal' },
  { id: 'run', hex: 0x047f, label: '16#047F · 启动运行', caption: 'Bit0 上升沿 0→1', tone: 'green' },
  { id: 'ack', hex: 0x04fe, label: '16#04FE · 故障复位', caption: 'Bit7 上升沿清故障', tone: 'amber' },
  { id: 'estop', hex: 0x0400, label: '16#0400 · 急停切 OFF', caption: '仅保留 Bit10 控制权', tone: 'red' },
  { id: 'nobit10', hex: 0x007f, label: '16#007F · 漏 Bit10 排错', caption: '现场典型无效启动字', tone: 'amber' },
];

export const Telegram1Workbench: React.FC = () => {
  // Start in 16#047E (Ready to switch on, switching-on-inhibited cleared)
  const [stw1, setStw1] = useState<number>(0x047e);
  const [switchingOnInhibited, setSwitchingOnInhibited] = useState<boolean>(false);
  const [driveFault, setDriveFault] = useState<boolean>(false);
  const [driveFaultCode, setDriveFaultCode] = useState<string>('');
  const [speedPct, setSpeedPct] = useState<number>(65);
  const [refRpm, setRefRpm] = useState<number>(1500);
  const [selectedBit, setSelectedBit] = useState<number>(0);
  const [lastTransitionNote, setLastTransitionNote] = useState<string>(
    '当前已发送 16#047E，驱动器解除“接通禁止”并处于就绪态；现在点击 Bit0 或「16#047F · 启动运行」即可产生 OFF1 上升沿启动。'
  );

  // Apply a new STW1 word through authentic PROFIdrive state transitions
  const applyStw1 = (nextWord: number, sourceNote?: string) => {
    const prevBit0 = getBit(stw1, 0);
    const prevBit7 = getBit(stw1, 7);

    const nextBit0 = getBit(nextWord, 0);
    const nextBit1 = getBit(nextWord, 1);
    const nextBit2 = getBit(nextWord, 2);
    const nextBit7 = getBit(nextWord, 7);
    const nextBit10 = getBit(nextWord, 10);

    let nextInhibited = switchingOnInhibited;
    let nextFault = driveFault;
    let nextFaultCode = driveFaultCode;
    let note = sourceNote ?? `STW1 已更新为 ${toHex16(nextWord)}。`;

    if (!nextBit10) {
      note =
        'Bit10 (PLC 控制权) = 0：SINAMICS 拒绝接收该报文，维持原有驱动内部状态。这就是写 16#007F 电机完全不转的根本原因。';
      setStw1(nextWord);
      setLastTransitionNote(note);
      return;
    }

    // Rising edge on Bit7 clears fault
    if (nextFault && !prevBit7 && nextBit7) {
      nextFault = false;
      nextFaultCode = '';
      // After fault clear, PROFIdrive enters Switching On Inhibited if Bit0 is still 1
      nextInhibited = nextBit0;
      note = nextBit0
        ? 'Bit7 上升沿已清除故障码，但 Bit0 仍为 1，驱动进入“接通禁止 (ZSW1.Bit6=1)”，必须先发 16#047E 再发 16#047F。'
        : 'Bit7 上升沿已清除故障码，且 OFF1=0，驱动回到准备就绪态 (Ready)。';
    }

    // OFF2 = 0 or OFF3 = 0 immediately inhibits switching on
    if (!nextBit1 || !nextBit2) {
      nextInhibited = true;
      note = !nextBit1
        ? 'Bit1 (OFF2) = 0：逆变脉冲立刻封锁，电机自由滑行并置位“接通禁止 (ZSW1.Bit6=1)”。恢复前须先置 OFF2/OFF3=1 且 OFF1=0 (16#047E)。'
        : 'Bit2 (OFF3) = 0：触发快速斜坡停机并置位“接通禁止 (ZSW1.Bit6=1)”。恢复前须先发 16#047E。';
    } else if (!nextFault) {
      if (!nextBit0) {
        // OFF1=0 while OFF2=1 & OFF3=1 clears switching on inhibited -> Ready to switch on
        if (nextInhibited) {
          note = '检测到 16#047E 条件 (OFF1=0, OFF2=1, OFF3=1, Bit10=1)：已解除“接通禁止”，现在可发 16#047F 上升沿启动。';
        }
        nextInhibited = false;
      } else if (nextInhibited) {
        // Trying to start directly while inhibited!
        note =
          '启动被拦截！驱动正处于“接通禁止 (ZSW1.Bit6=1)”态，直接发 16#047F 无法产生 Bit0 上升沿；必须先发 16#047E 将 Bit0 清零！';
      } else if (!prevBit0 && nextBit0) {
        const allEnableBits =
          getBit(nextWord, 3) && getBit(nextWord, 4) && getBit(nextWord, 5) && getBit(nextWord, 6);
        note = allEnableBits
          ? '捕获到 Bit0 (OFF1) 0→1 上升沿且 Bit3..6 全使能：SINAMICS 正式进入运行使能态 (ZSW1.Bit2=1)，开始按 NSOLL_A 输出转速！'
          : 'Bit0 已置 1 接通主回路，但 Bit3(脉冲)/Bit4..6(斜坡与设定值) 未全置 1，驱动器尚不能输出转矩。';
      }
    }

    setStw1(nextWord);
    setSwitchingOnInhibited(nextInhibited);
    setDriveFault(nextFault);
    setDriveFaultCode(nextFaultCode);
    setLastTransitionNote(note);
  };

  const toggleBit = (bit: number) => {
    setSelectedBit(bit);
    const nextWord = stw1 ^ (1 << bit);
    applyStw1(nextWord);
  };

  const injectDriveFault = () => {
    setDriveFault(true);
    setDriveFaultCode('F07900 · 电机堵转/过载保护');
    setSwitchingOnInhibited(true);
    setLastTransitionNote(
      '驱动器触发硬件故障 F07900：ZSW1.Bit3 置 1 并封锁脉冲。请点击「16#04FE · 故障复位」产生 Bit7 上升沿，再切 16#047E → 16#047F 重启。'
    );
  };

  const testInhibitDemo = () => {
    // Jump directly from E-stop (inhibited) to 047F to demonstrate why 047E is mandatory
    setDriveFault(false);
    setDriveFaultCode('');
    setSwitchingOnInhibited(true);
    setStw1(0x047f);
    setSelectedBit(0);
    setLastTransitionNote(
      '复现现场经典故障：上电或急停恢复后，如果 PLC 未先发 16#047E 而直接给 16#047F，驱动器会锁定 ZSW1.Bit6 (接通禁止) 拒绝运行！请点击 Bit0 或「16#047E」解除后再发「16#047F」。'
    );
  };

  // Compute normalized speed & ZSW1 feedback
  const computed = useMemo(() => {
    const plcMaster = getBit(stw1, 10);
    const off1 = getBit(stw1, 0);
    const off2 = getBit(stw1, 1);
    const off3 = getBit(stw1, 2);
    const opEn = getBit(stw1, 3);
    const rfgEn = getBit(stw1, 4) && getBit(stw1, 5) && getBit(stw1, 6);
    const invertSp = getBit(stw1, 11);

    const effectivePct = invertSp ? -speedPct : speedPct;
    const rawNsollInt = Math.round((effectivePct / 100) * 16384);
    const rawNsollWord = rawNsollInt & 0xffff;

    const readyToSwitchOn = plcMaster && !driveFault && !switchingOnInhibited && off2 && off3;
    const readyToOperate = readyToSwitchOn && off1;
    const running = readyToOperate && opEn && rfgEn;

    const actualPct = running ? effectivePct : 0;
    const rawNistInt = running ? rawNsollInt : 0;
    const rawNistWord = rawNistInt & 0xffff;
    const targetRpm = Math.round((effectivePct / 100) * refRpm);
    const actualRpm = running ? targetRpm : 0;
    const targetHz = ((effectivePct / 100) * 50).toFixed(1);
    const actualHz = running ? targetHz : '0.0';

    // Assemble ZSW1 (%IW256)
    let zsw1 = 0;
    if (readyToSwitchOn) zsw1 |= 1 << 0; // Bit0 Ready to switch on
    if (readyToOperate) zsw1 |= 1 << 1; // Bit1 Ready to operate
    if (running) zsw1 |= 1 << 2; // Bit2 Operation enabled
    if (driveFault) zsw1 |= 1 << 3; // Bit3 Fault present
    if (off2) zsw1 |= 1 << 4; // Bit4 No coast stop
    if (off3) zsw1 |= 1 << 5; // Bit5 No quick stop
    if (switchingOnInhibited || !off2 || !off3 || driveFault) zsw1 |= 1 << 6; // Bit6 Switching on inhibited
    if (Math.abs(effectivePct) >= 92 && running) zsw1 |= 1 << 7; // Bit7 High load warning demo
    if (running) zsw1 |= 1 << 8; // Bit8 Speed within tolerance
    if (plcMaster) zsw1 |= 1 << 9; // Bit9 Control requested by PLC
    if (running) zsw1 |= 1 << 10; // Bit10 f/n reached

    let driveStateLabel = 'S2 · 准备就绪 (可接收 047F)';
    let driveStateTone: 'teal' | 'green' | 'amber' | 'red' = 'teal';
    if (!plcMaster) {
      driveStateLabel = 'PLC 未接管控制权 (Bit10=0)';
      driveStateTone = 'amber';
    } else if (driveFault) {
      driveStateLabel = `故障停机 (${driveFaultCode || 'FAULT'})`;
      driveStateTone = 'red';
    } else if (switchingOnInhibited || !off2 || !off3) {
      driveStateLabel = 'S1 · 接通禁止 (须先发 16#047E)';
      driveStateTone = 'amber';
    } else if (running) {
      driveStateLabel = 'S4 · 运行使能中 (Operation Enabled)';
      driveStateTone = 'green';
    } else if (readyToOperate) {
      driveStateLabel = 'S3 · 已接通待使能脉冲 (查 Bit3..6)';
      driveStateTone = 'amber';
    }

    return {
      plcMaster,
      effectivePct,
      rawNsollInt,
      rawNsollWord,
      rawNistInt,
      rawNistWord,
      readyToSwitchOn,
      readyToOperate,
      running,
      actualPct,
      targetRpm,
      actualRpm,
      targetHz,
      actualHz,
      zsw1,
      driveStateLabel,
      driveStateTone,
    };
  }, [stw1, speedPct, refRpm, driveFault, driveFaultCode, switchingOnInhibited]);

  const activeBitDef = STW1_BITS.find((b) => b.bit === selectedBit) ?? STW1_BITS[STW1_BITS.length - 1];

  return (
    <section className="cap-panel">
      <div className="cap-panel-head">
        <h2 className="cap-panel-title">
          <ArrowLeftRight size={18} color="#14b8a6" /> SINAMICS G120 / V90 标准报文 1（STW1 / ZSW1 + NSOLL_A）交互式位级实验台
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <span className="cap-badge teal">PROFIdrive Telegram 1 (2 PZD)</span>
          <span className="cap-badge blue">%QW256..259 ↔ %IW256..259</span>
        </div>
      </div>

      {/* Bidirectional PZD Data-Flow Schematic Strip (diagram-design clean 1px border hierarchy) */}
      <div className="cap-tel-flow-grid">
        <div className="cap-tel-node">
          <div className="cap-tel-node-tag">PLC 输出过程映像 · S7-1215C</div>
          <div className="cap-tel-pzd-pair">
            <div className="cap-tel-pzd-cell focal">
              <span className="cap-tel-pzd-addr">PZD1 · STW1 (%QW256)</span>
              <strong className="cap-mono cap-tel-hex">{toHex16(stw1)}</strong>
              <span className="cap-mono cap-tel-bin">{toBin16Grouped(stw1)}</span>
            </div>
            <div className="cap-tel-pzd-cell">
              <span className="cap-tel-pzd-addr">PZD2 · NSOLL_A (%QW258)</span>
              <strong className="cap-mono cap-tel-hex">{toHex16(computed.rawNsollWord)}</strong>
              <span className="cap-mono cap-tel-bin">
                INT: {computed.rawNsollInt} ({computed.effectivePct > 0 ? '+' : ''}
                {computed.effectivePct}%)
              </span>
            </div>
          </div>
        </div>

        <div className="cap-tel-drive-core">
          <div className="cap-tel-node-tag">SINAMICS G120 状态机</div>
          <div style={{ margin: '6px 0 8px' }}>
            <span className={`cap-badge ${computed.driveStateTone}`}>{computed.driveStateLabel}</span>
          </div>
          <div className="cap-tel-motor-readout cap-mono">
            <span>实际转速: {computed.actualRpm} rpm</span>
            <span>输出频率: {computed.actualHz} Hz</span>
          </div>
          <div className="cap-tel-fb-pins cap-mono">
            <span className={computed.readyToSwitchOn ? 'pin-on' : 'pin-off'}>
              qReady={computed.readyToSwitchOn ? '1' : '0'}
            </span>
            <span className={computed.running ? 'pin-on' : 'pin-off'}>
              qRunning={computed.running ? '1' : '0'}
            </span>
            <span className={driveFault ? 'pin-err' : 'pin-off'}>
              qFault={driveFault ? '1' : '0'}
            </span>
          </div>
        </div>

        <div className="cap-tel-node">
          <div className="cap-tel-node-tag">PLC 输入过程映像 · 驱动反馈</div>
          <div className="cap-tel-pzd-pair">
            <div className="cap-tel-pzd-cell">
              <span className="cap-tel-pzd-addr">PZD1 · ZSW1 (%IW256)</span>
              <strong className="cap-mono cap-tel-hex">{toHex16(computed.zsw1)}</strong>
              <span className="cap-mono cap-tel-bin">{toBin16Grouped(computed.zsw1)}</span>
            </div>
            <div className="cap-tel-pzd-cell">
              <span className="cap-tel-pzd-addr">PZD2 · NIST_A (%IW258)</span>
              <strong className="cap-mono cap-tel-hex">{toHex16(computed.rawNistWord)}</strong>
              <span className="cap-mono cap-tel-bin">
                INT: {computed.rawNistInt} ({computed.actualPct}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Scenario Presets & Fault Drill Controls */}
      <div className="cap-tel-presets">
        {PRESETS.map((p) => {
          const isCurrent = stw1 === p.hex;
          return (
            <button
              key={p.id}
              type="button"
              className={`cap-btn cap-tel-preset-btn ${isCurrent ? 'primary' : ''}`}
              onClick={() => applyStw1(p.hex)}
            >
              <span className="cap-mono" style={{ fontWeight: 700 }}>
                {p.label}
              </span>
              <span className="cap-tel-preset-cap">{p.caption}</span>
            </button>
          );
        })}
        <button type="button" className="cap-btn warn" onClick={testInhibitDemo}>
          <Power size={14} /> 演示直发 047F 被拒
        </button>
        <button type="button" className="cap-btn danger" onClick={injectDriveFault}>
          <ShieldAlert size={14} /> 注入故障 F07900
        </button>
        <button
          type="button"
          className="cap-btn"
          onClick={() => {
            setDriveFault(false);
            setDriveFaultCode('');
            setSwitchingOnInhibited(false);
            setStw1(0x047e);
            setSpeedPct(65);
            setLastTransitionNote('已复位到初始待机态 16#047E，驱动准备就绪。');
          }}
        >
          <RotateCcw size={14} /> 复位实验台
        </button>
      </div>

      {/* Live Engineering Diagnostic Strip */}
      <div
        className={`cap-tel-diag ${
          driveFault
            ? 'diag-red'
            : switchingOnInhibited || !computed.plcMaster
              ? 'diag-amber'
              : computed.running
                ? 'diag-green'
                : 'diag-teal'
        }`}
      >
        {driveFault ? (
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
        ) : computed.running ? (
          <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 2 }} />
        ) : (
          <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
        )}
        <div>
          <strong>时序诊断与位状态解析：</strong>
          <span>{lastTransitionNote}</span>
        </div>
      </div>

      {/* Interactive 16-Bit STW1 Toggle Matrix */}
      <div className="cap-tel-section-label">
        <span>
          <Cpu size={14} /> 点击切换控制字 STW1 各位（高位 Bit15 → 低位 Bit0，带边框标识为启停关键位）
        </span>
        <span className="cap-mono" style={{ fontSize: 12, color: 'var(--cap-teal-bright)' }}>
          STW1 = {toHex16(stw1)} · DEC {stw1}
        </span>
      </div>

      <div className="cap-bit-scroll">
        <div className="cap-bit-grid" role="group" aria-label="STW1 控制字 16 位开关矩阵">
          {STW1_BITS.map((b) => {
            const on = getBit(stw1, b.bit);
            const isSel = selectedBit === b.bit;
            return (
              <button
                key={b.bit}
                type="button"
                className={`cap-bit-cell ${on ? 'is-on' : 'is-off'} ${b.critical ? 'is-critical' : ''} ${
                  isSel ? 'is-selected' : ''
                }`}
                onClick={() => toggleBit(b.bit)}
                onMouseEnter={() => setSelectedBit(b.bit)}
                aria-pressed={on}
                title={`Bit ${b.bit} (${b.shortName}): ${b.label}`}
              >
                <span className="cap-bit-idx">B{b.bit}</span>
                <span className="cap-bit-val">{on ? '1' : '0'}</span>
                <span className="cap-bit-name">{b.shortName}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Bit Inspector */}
      <div className="cap-bit-inspector">
        <span className="cap-badge teal">
          STW1.Bit{activeBitDef.bit} ({activeBitDef.shortName})
        </span>
        <strong>{activeBitDef.label}</strong>
        <span style={{ color: 'var(--cap-text-muted)' }}>
          1 = {activeBitDef.meaningOn} ｜ 0 = {activeBitDef.meaningOff}
        </span>
      </div>

      {/* Bottom 2-Column Area: Speed Normalization Lab + ZSW1 Live Status Decoder */}
      <div className="cap-tel-bottom-grid">
        {/* Speed Normalization NSOLL_A Converter */}
        <div className="cap-tel-subcard">
          <div className="cap-tel-subhead">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
              <Sliders size={15} color="#14b8a6" /> 目标转速规格化换算（NSOLL_A · %QW258）
            </span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 11.5, color: 'var(--cap-text-muted)' }}>基准 P2000:</span>
              {[1500, 3000].map((rpm) => (
                <button
                  key={rpm}
                  type="button"
                  className={`cap-btn ${refRpm === rpm ? 'primary' : ''}`}
                  style={{ padding: '4px 9px', fontSize: 11.5 }}
                  onClick={() => setRefRpm(rpm)}
                >
                  {rpm} rpm
                </button>
              ))}
            </div>
          </div>

          <div className="cap-tel-slider-row">
            <label htmlFor="tel1-speed-slider" className="cap-mono" style={{ fontSize: 12.5, fontWeight: 700 }}>
              设定转速百分比: {speedPct > 0 ? '+' : ''}
              {speedPct}%
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[-50, 0, 50, 65, 100].map((presetPct) => (
                <button
                  key={presetPct}
                  type="button"
                  className={`cap-btn ${speedPct === presetPct ? 'primary' : ''}`}
                  style={{ padding: '4px 8px', fontSize: 11.5 }}
                  onClick={() => setSpeedPct(presetPct)}
                >
                  {presetPct}%
                </button>
              ))}
            </div>
          </div>

          <input
            id="tel1-speed-slider"
            type="range"
            min={-100}
            max={100}
            step={5}
            value={speedPct}
            onChange={(e) => setSpeedPct(Number(e.target.value))}
            className="cap-tel-range"
          />

          <div className="cap-tel-formula-grid cap-mono">
            <div className="cap-tel-metric">
              <span className="cap-tel-metric-lbl">十进制标幺值 (INT)</span>
              <strong>{computed.rawNsollInt}</strong>
            </div>
            <div className="cap-tel-metric">
              <span className="cap-tel-metric-lbl">报文十六进制 (WORD)</span>
              <strong style={{ color: 'var(--cap-blue)' }}>{toHex16(computed.rawNsollWord)}</strong>
            </div>
            <div className="cap-tel-metric">
              <span className="cap-tel-metric-lbl">对应物理转速</span>
              <strong>{computed.targetRpm} rpm</strong>
            </div>
            <div className="cap-tel-metric">
              <span className="cap-tel-metric-lbl">基准满量程常量</span>
              <strong style={{ color: 'var(--cap-teal-bright)' }}>16#4000 = 16384</strong>
            </div>
          </div>

          <div className="cap-tel-note">
            换算公式：<code>NSOLL_A = REAL_TO_INT((Pct / 100.0) * 16384.0)</code>。负数用 16 位二进制补码传输（如 -100% =
            <code>16#C000</code>）。注意不要与模拟量模块满量程 <code>27648</code> 混淆。
          </div>
        </div>

        {/* ZSW1 Status Word Live Decoder */}
        <div className="cap-tel-subcard">
          <div className="cap-tel-subhead">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
              <Gauge size={15} color="#14b8a6" /> 驱动器状态字实时反馈（ZSW1 · %IW256）
            </span>
            <span className="cap-badge blue">{toHex16(computed.zsw1)}</span>
          </div>

          <div className="cap-zsw-grid">
            {ZSW1_KEY_BITS.map((zb) => {
              const active = getBit(computed.zsw1, zb.bit);
              const isDanger = (zb.bit === 3 || zb.bit === 6) && active;
              const isWarn = zb.bit === 7 && active;
              return (
                <div
                  key={zb.bit}
                  className={`cap-zsw-item ${
                    isDanger ? 'zsw-red' : isWarn ? 'zsw-amber' : active ? 'zsw-on' : 'zsw-off'
                  }`}
                >
                  <span className="cap-mono cap-zsw-bit">
                    B{zb.bit} · {active ? '1' : '0'}
                  </span>
                  <span className="cap-zsw-label">{zb.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
