import React, { useMemo, useState } from 'react';
import { haptic } from '../../app/native/platform';

/* 地址与数据类型互动演示：
 * A. %MW / %MD 与 %MB、%M 位的重叠关系（西门子大端序：低地址字节 = 高位字节）
 * B. 常用数据类型的位数与取值范围（依据 S7-1200 系统手册“数据类型”章节）
 */

type Tab = 'overlap' | 'types';

const INT_MIN = -32768;
const INT_MAX = 32767;

function toInt16(bits: number): number {
  const v = bits & 0xffff;
  return v >= 0x8000 ? v - 0x10000 : v;
}

const TYPES = [
  { name: 'Bool', bits: '1 位', range: 'TRUE / FALSE（1 / 0）', example: '%I0.0、%M10.0', use: '按钮、开关、指示灯、标志位' },
  { name: 'Byte', bits: '8 位', range: '16#00 ~ 16#FF', example: '%MB10', use: '8 个开关量打包、通讯数据' },
  { name: 'Int', bits: '16 位', range: '-32 768 ~ 32 767', example: '%MW10、%IW64', use: '计数、模拟量原始值（0~27648）' },
  { name: 'DInt', bits: '32 位', range: '-2 147 483 648 ~ 2 147 483 647', example: '%MD20', use: '产量累计、脉冲数、毫秒数' },
  { name: 'Real', bits: '32 位', range: '约 ±1.18e-38 ~ ±3.40e+38，约 6~7 位有效数字', example: '%MD30', use: '温度、压力、流量等带小数的工程量' },
  { name: 'Time', bits: '32 位', range: 'T#-24d20h31m23s648ms ~ T#+24d20h31m23s647ms', example: 'T#5s', use: '定时器预设值 PT' },
] as const;

export const DataTypeExplorer: React.FC = () => {
  const [tab, setTab] = useState<Tab>('overlap');
  const [byteAddr, setByteAddr] = useState(10);
  const [word, setWord] = useState(256); // 0..65535 原始 16 位

  const hi = (word >> 8) & 0xff;
  const lo = word & 0xff;
  const intVal = toInt16(word);

  const bitCells = useMemo(() => {
    const cells: { label: string; on: boolean; bitIndex: number }[] = [];
    for (let b = 7; b >= 0; b--) cells.push({ label: `%M${byteAddr}.${b}`, on: Boolean((hi >> b) & 1), bitIndex: 8 + b });
    for (let b = 7; b >= 0; b--) cells.push({ label: `%M${byteAddr + 1}.${b}`, on: Boolean((lo >> b) & 1), bitIndex: b });
    return cells;
  }, [hi, lo, byteAddr]);

  const toggleBit = (bitIndex: number) => {
    haptic('tap');
    setWord((w) => (w ^ (1 << bitIndex)) & 0xffff);
  };

  const [typeIdx, setTypeIdx] = useState(2);
  const [testValue, setTestValue] = useState('40000');
  const t = TYPES[typeIdx];
  const testNum = Number(testValue);
  const fits = useMemo(() => {
    if (testValue.trim() === '' || Number.isNaN(testNum)) return null;
    switch (t.name) {
      case 'Bool':
        return testNum === 0 || testNum === 1;
      case 'Byte':
        return Number.isInteger(testNum) && testNum >= 0 && testNum <= 255;
      case 'Int':
        return Number.isInteger(testNum) && testNum >= INT_MIN && testNum <= INT_MAX;
      case 'DInt':
        return Number.isInteger(testNum) && testNum >= -2147483648 && testNum <= 2147483647;
      case 'Real':
        return Math.abs(testNum) <= 3.402823e38;
      case 'Time':
        return Number.isInteger(testNum) && Math.abs(testNum) <= 2147483647;
      default:
        return null;
    }
  }, [t.name, testNum, testValue]);
  const realStored = t.name === 'Real' && fits ? Math.fround(testNum) : null;

  return (
    <div className="demo-root">
      <div className="demo-tabs" role="tablist" aria-label="演示内容">
        <button type="button" role="tab" aria-selected={tab === 'overlap'} className={`demo-tab${tab === 'overlap' ? ' active' : ''}`} onClick={() => setTab('overlap')}>
          地址重叠：字 ↔ 字节 ↔ 位
        </button>
        <button type="button" role="tab" aria-selected={tab === 'types'} className={`demo-tab${tab === 'types' ? ' active' : ''}`} onClick={() => setTab('types')}>
          数据类型与取值范围
        </button>
      </div>

      {tab === 'overlap' ? (
        <div className="demo-panel">
          <div className="demo-controls">
            <label className="demo-field">
              <span>字地址 %MW</span>
              <input
                type="number"
                min={0}
                max={8190}
                step={2}
                inputMode="numeric"
                value={byteAddr}
                onChange={(e) => {
                  const n = Math.max(0, Math.min(8190, Math.floor(Number(e.target.value) || 0)));
                  setByteAddr(n);
                }}
              />
            </label>
            <label className="demo-field">
              <span>%MW{byteAddr} 的值（Int）</span>
              <input
                type="number"
                min={INT_MIN}
                max={INT_MAX}
                inputMode="numeric"
                value={intVal}
                onChange={(e) => {
                  const n = Math.max(INT_MIN, Math.min(INT_MAX, Math.round(Number(e.target.value) || 0)));
                  setWord(n & 0xffff);
                }}
              />
            </label>
            <div className="demo-quick" role="group" aria-label="快速填入示例值">
              <span className="demo-quick-label">试试这些值：</span>
              {[0, 1, 255, 256, -1, 32767].map((v) => (
                <button key={v} type="button" className="btn btn-sm" onClick={() => setWord(v & 0xffff)}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="overlap-map" aria-label="内存布局">
            <div className="overlap-row word">
              <span className="overlap-tag">%MW{byteAddr}</span>
              <span className="overlap-val">= {intVal}（16#{word.toString(16).toUpperCase().padStart(4, '0')}）</span>
            </div>
            <div className="overlap-row bytes">
              <span className="overlap-byte">
                <b>%MB{byteAddr}</b>（高字节）= 16#{hi.toString(16).toUpperCase().padStart(2, '0')}
              </span>
              <span className="overlap-byte">
                <b>%MB{byteAddr + 1}</b>（低字节）= 16#{lo.toString(16).toUpperCase().padStart(2, '0')}
              </span>
            </div>
            <div className="overlap-bits" role="group" aria-label="点击位切换 0/1">
              {bitCells.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  className={`bit-cell${c.on ? ' on' : ''}`}
                  aria-pressed={c.on}
                  aria-label={`${c.label} 当前为 ${c.on ? 1 : 0}，点击切换`}
                  onClick={() => toggleBit(c.bitIndex)}
                >
                  <span className="bit-val">{c.on ? 1 : 0}</span>
                  <span className="bit-lbl">{c.label.replace('%M', '')}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="demo-explain">
            <p className="demo-note">
              小知识：<code>16#0100</code> 是西门子的<strong>十六进制</strong>写法（16# 开头），每一位十六进制正好对应 4 个二进制位，方便看出哪几位是 1。下面的方格可以直接点，把某一位在 0 和 1 之间切换。
            </p>
            <p>
              <strong>看懂这张图：</strong>%MW{byteAddr} 占用 %MB{byteAddr} 和 %MB{byteAddr + 1} 两个字节；西门子把<strong>地址小的字节放在高位</strong>。所以把 %MW{byteAddr} 设为 256 时，被点亮的是 <code>%M{byteAddr}.0</code>，而不是 %M{byteAddr + 1}.0。
            </p>
            <p>
              同理，%MD{byteAddr} 会占用 %MB{byteAddr} ~ %MB{byteAddr + 3} 四个字节，与 %MW{byteAddr + 2} 重叠。<strong>规划地址时，字和双字之间要留够间隔</strong>（例如字用 %MW10、%MW12，双字用 %MD20、%MD24）。
            </p>
          </div>
        </div>
      ) : (
        <div className="demo-panel">
          <div className="type-chips" role="radiogroup" aria-label="选择数据类型">
            {TYPES.map((x, i) => (
              <button
                key={x.name}
                type="button"
                role="radio"
                aria-checked={i === typeIdx}
                className={`filter-pill${i === typeIdx ? ' active' : ''}`}
                onClick={() => setTypeIdx(i)}
              >
                {x.name}
              </button>
            ))}
          </div>
          <dl className="type-card">
            <div>
              <dt>长度</dt>
              <dd>{t.bits}</dd>
            </div>
            <div>
              <dt>取值范围</dt>
              <dd>{t.range}</dd>
            </div>
            <div>
              <dt>地址示例</dt>
              <dd>
                <code>{t.example}</code>
              </dd>
            </div>
            <div>
              <dt>常见用途</dt>
              <dd>{t.use}</dd>
            </div>
          </dl>
          <label className="demo-field wide">
            <span>输入一个数，看看能不能放进 {t.name}{t.name === 'Time' ? '（以毫秒计）' : ''}</span>
            <input type="text" inputMode="decimal" value={testValue} onChange={(e) => setTestValue(e.target.value)} />
          </label>
          {fits !== null && (
            <div className={`demo-verdict ${fits ? 'ok' : 'bad'}`} role="status">
              {fits
                ? realStored !== null && realStored !== testNum
                  ? `能放下，但 Real 只有约 7 位有效数字，实际存成 ${realStored}`
                  : `能放进 ${t.name}。`
                : t.name === 'Int' && Number.isInteger(testNum)
                  ? `放不下！Int 最大只有 32767。超出范围的运算结果会出错（ENO = 0），计数、累计产量这类会变大的数请用 DInt。`
                  : `放不下 ${t.name}，请换用更大的类型${Number.isInteger(testNum) ? '' : '（带小数请用 Real）'}。`}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
