import React, { useMemo, useState } from 'react';
import { haptic } from '../../app/native/platform';

/* 比较 / 移动 / 数学指令实验台
 * 行为依据 S7-1200 系统手册“数学运算 / 比较 / 移动指令”章节：
 *  - 结果超出数据类型范围：ENO = 0，OUT 存放结果的低位部分（整数会“绕回”）
 *  - 整数除法截掉小数；除以 0：ENO = 0，OUT 返回 0
 *  - EN = 0：指令不执行，OUT 保持原值，ENO = 0
 */

type Op = 'CMP' | 'MOVE' | 'ADD' | 'SUB' | 'MUL' | 'DIV';
type DType = 'Int' | 'DInt' | 'Real';
type CmpOp = '==' | '<>' | '>' | '>=' | '<' | '<=';

const OPS: { id: Op; label: string; desc: string }[] = [
  { id: 'CMP', label: '比较 CMP', desc: '比较两个数，条件成立时能流通过（像一个“会看数字的触点”）。' },
  { id: 'MOVE', label: '移动 MOVE', desc: '把 IN 的值复制到 OUT，IN 本身不变。' },
  { id: 'ADD', label: '加 ADD', desc: 'OUT := IN1 + IN2' },
  { id: 'SUB', label: '减 SUB', desc: 'OUT := IN1 - IN2' },
  { id: 'MUL', label: '乘 MUL', desc: 'OUT := IN1 * IN2' },
  { id: 'DIV', label: '除 DIV', desc: 'OUT := IN1 / IN2（整数除法会截掉小数部分）' },
];

const RANGE: Record<'Int' | 'DInt', [number, number, number]> = {
  Int: [-32768, 32767, 16],
  DInt: [-2147483648, 2147483647, 32],
};

function wrap(v: number, t: 'Int' | 'DInt'): number {
  const bits = RANGE[t][2];
  const mod = 2 ** bits;
  let r = ((v % mod) + mod) % mod;
  if (r >= mod / 2) r -= mod;
  return r;
}

function parseNum(s: string, t: DType): number {
  const n = Number(s);
  if (Number.isNaN(n)) return 0;
  return t === 'Real' ? Math.fround(n) : Math.trunc(n);
}

function fmt(n: number, t: DType): string {
  if (t === 'Real') {
    if (!Number.isFinite(n)) return Number.isNaN(n) ? 'NaN' : n > 0 ? '+INF' : '-INF';
    return Number(n.toPrecision(7)).toString();
  }
  return String(n);
}

export const InstructionLab: React.FC = () => {
  const [op, setOp] = useState<Op>('ADD');
  const [dtype, setDtype] = useState<DType>('Int');
  const [cmpOp, setCmpOp] = useState<CmpOp>('>=');
  const [en, setEn] = useState(true);
  const [in1, setIn1] = useState('32000');
  const [in2, setIn2] = useState('1000');
  const [lastOut, setLastOut] = useState<number>(0);

  const result = useMemo(() => {
    const a = parseNum(in1, dtype);
    const b = parseNum(in2, dtype);
    if (op === 'CMP') {
      const map: Record<CmpOp, boolean> = {
        '==': a === b,
        '<>': a !== b,
        '>': a > b,
        '>=': a >= b,
        '<': a < b,
        '<=': a <= b,
      };
      const pass = en && map[cmpOp];
      return { kind: 'cmp' as const, pass, a, b };
    }
    if (!en) return { kind: 'math' as const, out: lastOut, eno: false, note: 'EN = 0：指令没有执行，OUT 保持上一次的值。', a, b };
    let raw: number;
    switch (op) {
      case 'MOVE':
        raw = a;
        break;
      case 'ADD':
        raw = a + b;
        break;
      case 'SUB':
        raw = a - b;
        break;
      case 'MUL':
        raw = a * b;
        break;
      case 'DIV':
        if (dtype !== 'Real' && b === 0) return { kind: 'math' as const, out: 0, eno: false, note: '除数为 0：ENO = 0，OUT 返回 0。', a, b };
        raw = dtype === 'Real' ? a / b : Math.trunc(a / b);
        break;
      default:
        raw = a;
    }
    if (dtype === 'Real') {
      const out = Math.fround(raw);
      const bad = !Number.isFinite(out);
      return {
        kind: 'math' as const,
        out,
        eno: !bad,
        note: bad ? '结果不是有效的浮点数（如除以 0 得到无穷大），ENO = 0。' : op === 'DIV' ? 'Real 除法保留小数。' : '',
        a,
        b,
      };
    }
    const [min, max] = RANGE[dtype];
    if (raw < min || raw > max) {
      return {
        kind: 'math' as const,
        out: wrap(raw, dtype),
        eno: false,
        note: `真实结果 ${raw} 超出了 ${dtype} 的范围（${min} ~ ${max}）：ENO = 0，OUT 只剩下低位部分，变成了一个“看起来莫名其妙”的数。`,
        a,
        b,
      };
    }
    return {
      kind: 'math' as const,
      out: raw,
      eno: true,
      note: op === 'DIV' && a % (b || 1) !== 0 ? '整数除法：小数部分被直接截掉（不是四舍五入）。' : '',
      a,
      b,
    };
  }, [op, dtype, cmpOp, en, in1, in2, lastOut]);

  const commit = () => {
    if (result.kind === 'math' && en) setLastOut(result.out);
  };

  const opMeta = OPS.find((o) => o.id === op)!;
  const flowOn = en;
  const outFlow = result.kind === 'cmp' ? result.pass : result.eno;

  const sclText =
    op === 'CMP'
      ? `"Lamp" := "Value_A" ${cmpOp === '==' ? '=' : cmpOp} "Value_B";`
      : op === 'MOVE'
        ? `"Result" := "Value_A";   // MOVE`
        : `"Result" := "Value_A" ${{ ADD: '+', SUB: '-', MUL: '*', DIV: '/' }[op as 'ADD']} "Value_B";`;

  return (
    <div className="demo-root">
      <div className="type-chips" role="radiogroup" aria-label="选择指令">
        {OPS.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={o.id === op}
            className={`filter-pill${o.id === op ? ' active' : ''}`}
            onClick={() => {
              haptic('tap');
              setOp(o.id);
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="demo-sub">{opMeta.desc}</p>

      <div className="demo-controls">
        <label className="demo-field">
          <span>数据类型</span>
          <select value={dtype} onChange={(e) => setDtype(e.target.value as DType)}>
            <option value="Int">Int（16 位）</option>
            <option value="DInt">DInt（32 位）</option>
            <option value="Real">Real（浮点）</option>
          </select>
        </label>
        {op === 'CMP' && (
          <label className="demo-field">
            <span>比较方式</span>
            <select value={cmpOp} onChange={(e) => setCmpOp(e.target.value as CmpOp)}>
              {(['==', '<>', '>', '>=', '<', '<='] as CmpOp[]).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="demo-field">
          <span>{op === 'MOVE' ? 'IN' : 'IN1'}</span>
          <input type="text" value={in1} onChange={(e) => setIn1(e.target.value)} onBlur={commit} />
        </label>
        {op !== 'MOVE' && (
          <label className="demo-field">
            <span>IN2</span>
            <input type="text" value={in2} onChange={(e) => setIn2(e.target.value)} onBlur={commit} />
          </label>
        )}
        <button
          type="button"
          className={`btn en-toggle${en ? ' on' : ''}`}
          aria-pressed={en}
          onClick={() => {
            haptic('press');
            if (result.kind === 'math' && en) setLastOut(result.out);
            setEn((v) => !v);
          }}
        >
          EN = {en ? 1 : 0}（点我切换）
        </button>
      </div>

      <div className="lad-box-stage" aria-label="梯形图示意">
        <span className={`lad-rail${flowOn ? ' on' : ''}`} />
        <span className={`lad-wire${flowOn ? ' on' : ''}`} />
        <div className={`lad-box${outFlow ? ' pass' : ''}`}>
          <div className="lad-box-title">
            {op === 'CMP' ? `CMP ${cmpOp}` : op}
            <small>{dtype}</small>
          </div>
          {op === 'CMP' ? (
            <div className="lad-box-io">
              <span>
                上：{fmt(result.a, dtype)}
              </span>
              <span>
                下：{fmt(result.b, dtype)}
              </span>
            </div>
          ) : (
            <div className="lad-box-io">
              <span>EN {en ? 1 : 0}</span>
              <span>ENO {result.kind === 'math' && result.eno ? 1 : 0}</span>
              <span>IN1 {fmt(result.a, dtype)}</span>
              {op !== 'MOVE' && <span>IN2 {fmt(result.b, dtype)}</span>}
              <span className="lad-out">OUT {result.kind === 'math' ? fmt(result.out, dtype) : ''}</span>
            </div>
          )}
        </div>
        <span className={`lad-wire${outFlow ? ' on' : ''}`} />
        <span className={`lad-coil${outFlow ? ' on' : ''}`}>{op === 'CMP' ? '( Lamp )' : '( OK )'}</span>
      </div>

      <div className={`demo-verdict ${outFlow ? 'ok' : 'bad'}`} role="status" aria-live="polite">
        {result.kind === 'cmp'
          ? !en
            ? '左侧没有能流（EN = 0），比较结果不起作用。'
            : result.pass
              ? `条件成立：${fmt(result.a, dtype)} ${cmpOp} ${fmt(result.b, dtype)}，能流通过，Lamp = 1。`
              : `条件不成立：${fmt(result.a, dtype)} ${cmpOp} ${fmt(result.b, dtype)} 为假，Lamp = 0。`
          : result.eno
            ? `执行成功（ENO = 1）。${result.note}`
            : result.note}
      </div>
      <pre className="demo-scl" aria-label="等效 SCL 写法">
        <code>{sclText}</code>
      </pre>
    </div>
  );
};
