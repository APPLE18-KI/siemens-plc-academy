import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, HelpCircle, Puzzle, RotateCcw, Sparkles } from 'lucide-react';
import { haptic } from '../../../app/native/platform';

interface SlotSpec {
  id: string;
  label: string;
  placeholder: string;
  choices: Array<{ text: string; hint?: string }>;
}

interface PuzzleSpec {
  intro: string;
  slots: SlotSpec[];
  buildCode: (filled: Record<string, string>) => string;
}

/**
 * Duolingo / Mimo 风格“SCL 词块拼句模式”配置：
 * 覆盖毕业项目全部 5 关，新手/手机端无需切换键盘猛敲分号与 :=，点选词块即可拼出标准博途 SCL 并进入评测。
 */
const SCL_PUZZLE_SPECS: Record<string, PuzzleSpec> = {
  'ch1-cylinder': {
    intro: '点选下方西门子 SCL 词块填入 3 个空位，补全气缸双磁簧 150ms 互斥报警与双阀强切逻辑：',
    slots: [
      {
        id: 's1',
        label: '空位 1 · 双磁簧同时导通条件',
        placeholder: '点选条件填入 IN := ...',
        choices: [
          { text: '(#iSensor_Adv AND #iSensor_Ret)', hint: '两只磁簧同时为 1（逻辑与）' },
          { text: '(#iSensor_Adv OR #iSensor_Ret)', hint: '干扰项：任意一只为 1（正常到位也会触发！）' },
          { text: '(#iSensor_Adv XOR #iSensor_Ret)', hint: '干扰项：异或（刚好只有一只为 1）' },
        ],
      },
      {
        id: 's2',
        label: '空位 2 · 定时器计时到达标志',
        placeholder: '点选定时器到位输出',
        choices: [
          { text: '#instTON_Conflict.Q', hint: 'TON 计时满 150ms 后的布尔输出 Q' },
          { text: '#instTON_Conflict.ET', hint: '干扰项：ET 是已走时间(Time)，不是布尔量' },
          { text: '#instTON_Conflict.IN', hint: '干扰项：IN 是输入条件，还没滤波 150ms' },
        ],
      },
      {
        id: 's3',
        label: '空位 3 · 电磁阀输出前无互斥故障保护',
        placeholder: '点选安全保护条件',
        choices: [
          { text: 'NOT #statFaultConflict', hint: '必须没有互斥锁存故障才允许得电' },
          { text: '#statFaultConflict', hint: '干扰项：反了！变成有故障才驱动电磁阀' },
          { text: 'NOT #iSensor_Adv', hint: '干扰项：未用故障锁存位保护' },
        ],
      },
    ],
    buildCode: (f) => `#instTON_Conflict(
    IN := ${f.s1 || '(* 空位 1 *)'},
    PT := T#150ms
);

IF ${f.s2 || '(* 空位 2 *)'} THEN
    #statFaultConflict := TRUE;
END_IF;

IF #iEnable AND ${f.s3 || '(* 空位 3 *)'} THEN
    #qValve_Adv := #statCmdAdv AND #iInterlock_Adv;
    #qValve_Ret := (NOT #statCmdAdv) AND #iInterlock_Ret;
ELSE
    #qValve_Adv := FALSE;
    #qValve_Ret := FALSE;
END_IF;`,
  },
  'ch2-g120': {
    intro: '点选正确的 PROFIdrive 标准 1 号报文常数，修复实习生写错的速度标定系数与 STW1 控制字：',
    slots: [
      {
        id: 's1',
        label: '空位 1 · SINAMICS 报文 100% 速度满量程',
        placeholder: '点选标准满量程基准',
        choices: [
          { text: '16384.0', hint: 'PROFIdrive 标准 16#4000 = 16384 = 100%' },
          { text: '27648.0', hint: '干扰项：这是模拟量模块 AI/AQ 的满量程！' },
          { text: '32767.0', hint: '干扰项：Int 上限，会导致速度超限 200%' },
        ],
      },
      {
        id: 's2',
        label: '空位 2 · 启动运行控制字 STW1（含 Bit10 PLC 主控）',
        placeholder: '点选启动控制字',
        choices: [
          { text: '16#047F', hint: 'Bit10=1(PLC控制) + OFF1/2/3=1 正常合闸旋转' },
          { text: '16#007F', hint: '干扰项：漏了 Bit10，变频器直接拒收指令' },
          { text: '16#047E', hint: '干扰项：Bit0=0 是准备待机字，电机不转' },
        ],
      },
      {
        id: 's3',
        label: '空位 3 · 急停断开时转速设定值清零',
        placeholder: '点选安全停机语句',
        choices: [
          { text: '#qPZD_NSOLL_A := 0;', hint: '用 := 赋值清零速度设定并带分号' },
          { text: '#qPZD_NSOLL_A = 0;', hint: '干扰项：单等号 = 是比较，不是 SCL 赋值' },
          { text: '#qPZD_NSOLL_A := 16384;', hint: '干扰项：急停时不能给满速！' },
        ],
      },
    ],
    buildCode: (f) => `#tempRawSpeed := REAL_TO_INT((#tempClampedPct / 100.0) * ${f.s1 || '27648.0'});

IF NOT #iSafety_OK THEN
    #tempStw1 := 16#0400;
    ${f.s3 || '#qPZD_NSOLL_A := 0;'}
ELSIF #iRunCmd AND NOT #qDriveFault THEN
    #tempStw1 := ${f.s2 || '16#007F'};
    #qPZD_NSOLL_A := #tempRawSpeed;
ELSE
    #tempStw1 := 16#047E;
    #qPZD_NSOLL_A := 0;
END_IF;`,
  },
  'ch3-pid-overtemp': {
    intro: '点选安全联锁与回差复位词块，杜绝热压腔在 94.9°C 反复自启加热的热失控隐患：',
    slots: [
      {
        id: 's1',
        label: '空位 1 · 人工复位 + 降温 5.0°C 回差 + 无传感器断线',
        placeholder: '点选完整复位条件',
        choices: [
          { text: '#iAlarmReset AND (#qActTemp_C < (#iOverTempLimit_C - 5.0)) AND NOT #qSensorFault', hint: '人工按复位 + 降到限值减 5°C + 探头正常' },
          { text: '#qActTemp_C < #iOverTempLimit_C', hint: '干扰项：无回差且无人为确认，94.9°C 会自动重启！' },
          { text: '#iAlarmReset OR (#qActTemp_C < (#iOverTempLimit_C - 5.0))', hint: '干扰项：用了 OR，超温时硬按复位也能强行解锁' },
        ],
      },
      {
        id: 's2',
        label: '空位 2 · 故障停机时切断 PID 输出占空比',
        placeholder: '点选切断输出语句',
        choices: [
          { text: '#qPID_Out_Pct := 0.0;', hint: '强制把加热占空比归零' },
          { text: '#qPID_Out_Pct := #tempOut;', hint: '干扰项：故障时还继续输出 PID 值！' },
        ],
      },
      {
        id: 's3',
        label: '空位 3 · 清空积分累加器防重启过冲',
        placeholder: '点选清零积分语句',
        choices: [
          { text: '#statIntegral := 0.0;', hint: '防止积分饱和导致恢复后瞬间满功率过冲' },
          { text: '#statIntegral := 100.0;', hint: '干扰项：写 100 会导致恢复后爆温！' },
        ],
      },
    ],
    buildCode: (f) => `IF (#qActTemp_C >= #iOverTempLimit_C) OR #qSensorFault THEN
    #statOverTempLatch := TRUE;
ELSIF ${f.s1 || '(* 空位 1 *)'} THEN
    #statOverTempLatch := FALSE;
END_IF;

IF #iEnable AND #iSafety_OK AND NOT #statOverTempLatch THEN
    #qPID_Out_Pct := #tempOut;
ELSE
    ${f.s2 || '(* 空位 2 *)'}
    ${f.s3 || '(* 空位 3 *)'}
END_IF;`,
  },
  'ch4-asrs-search': {
    intro: '点选词块补全 4×3 立体库空仓位遍历算法（找到首仓立刻退出 + 满仓进 PackML Held 50）：',
    slots: [
      {
        id: 's1',
        label: '空位 1 · 判断仓位“未占用 且 未锁定”',
        placeholder: '点选空仓筛选条件',
        choices: [
          { text: '(NOT #ioSlots[#tempIdx].Occupied) AND (NOT #ioSlots[#tempIdx].Locked)', hint: '既没放电池，也没被人工禁用锁定' },
          { text: 'NOT #ioSlots[#tempIdx].Occupied', hint: '干扰项：漏检 Locked，会把电池塞进检修锁定的仓位' },
          { text: '#ioSlots[#tempIdx].Occupied AND #ioSlots[#tempIdx].Locked', hint: '干扰项：条件正好写反了' },
        ],
      },
      {
        id: 's2',
        label: '空位 2 · 找到首个空仓后立刻跳出 FOR 循环',
        placeholder: '点选跳出循环关键字',
        choices: [
          { text: 'EXIT;', hint: 'SCL 跳出当前 FOR 循环的标准关键字' },
          { text: 'CONTINUE;', hint: '干扰项：只跳过本次迭代，会继续覆盖为最后一个空仓' },
          { text: 'RETURN;', hint: '干扰项：直接退出整个 FB，后面满仓和步序代码都不执行了' },
        ],
      },
      {
        id: 's3',
        label: '空位 3 · 12 仓全满报警并切入 Held (50)',
        placeholder: '点选满仓处理语句',
        choices: [
          { text: '#ioHMI.Alarms.ASRS_WarehouseFull := TRUE;\n    #statPackML := 50;', hint: '报满仓警并切入 PackML Held(50) 等待出库' },
          { text: '#statPackML := 10;', hint: '干扰项：未报警且切回 Idle 会卡死产线' },
        ],
      },
    ],
    buildCode: (f) => `#tempFoundSlot := 0;
FOR #tempIdx := 1 TO 12 DO
    IF ${f.s1 || '(* 空位 1 *)'} THEN
        #tempFoundSlot := #tempIdx;
        ${f.s2 || '(* 空位 2 *)'}
    END_IF;
END_FOR;

IF #tempFoundSlot = 0 THEN
    ${f.s3 || '(* 空位 3 *)'}
ELSE
    #statTargetSlotIdx := #tempFoundSlot;
    #statStep := 30;
END_IF;`,
  },
  'ch5-packml-ob100': {
    intro: '选出符合工业安全架构的修复词块，消除 OB100 误清掉电保持仓位与急停未归零的致命事故：',
    slots: [
      {
        id: 's1',
        label: '空位 1 · OB100 上电循环里应该如何处理 Occupied 与条码？',
        placeholder: '选择正确架构策略',
        choices: [
          { text: '// 严守 RETAIN 掉电保持：绝不清空 Occupied 与 ModuleBarcode！', hint: '只刷新机械坐标，保留断电前的真实仓位库存' },
          { text: '"DB_StationGlobal".WarehouseSlots[#tempIdx].Occupied := FALSE;', hint: '干扰项：重启清空库存会导致再次入库撞毁已存电池！' },
        ],
      },
      {
        id: 's2',
        label: '空位 2 · 急停断开时切入 PackML 状态',
        placeholder: '选择急停状态码',
        choices: [
          { text: '#statPackML := 90;', hint: '90 = Aborted（中止态，急停必须强制中止）' },
          { text: '#statPackML := 50;', hint: '干扰项：50 是普通暂停 Held，不符合急停隔离规范' },
        ],
      },
      {
        id: 's3',
        label: '空位 3 · 急停后同步处理生产工步',
        placeholder: '选择工步清零语句',
        choices: [
          { text: '#statStep := 0;', hint: '强制清零工步，强迫重新复位回零防误续跑' },
          { text: '// 保留原 #statStep 方便松开急停直接续跑', hint: '干扰项：松开急停机械手突然继续动作极其危险！' },
        ],
      },
    ],
    buildCode: (f) => `// === 代码段 A：OB100 上电初始化 ===
FOR #tempIdx := 1 TO 12 DO
    "DB_StationGlobal".WarehouseSlots[#tempIdx].PosX_mm := 480.0 + INT_TO_REAL(((#tempIdx - 1) MOD 4)) * 320.0;
    "DB_StationGlobal".WarehouseSlots[#tempIdx].PosZ_mm := 180.0 + INT_TO_REAL(((#tempIdx - 1) / 4)) * 240.0;
    ${f.s1 || '"DB_StationGlobal".WarehouseSlots[#tempIdx].Occupied := FALSE;'}
END_FOR;

// === 代码段 B：主控块急停捕获 ===
IF NOT #iSafety_EStop_OK THEN
    ${f.s2 || '#statPackML := 50;'}
    ${f.s3 || '(* 空位 3 *)'}
END_IF;`,
  },
};

interface SclBlockBuilderProps {
  challengeId: string;
  onCodeChange: (assembledCode: string) => void;
}

export const SclBlockBuilder: React.FC<SclBlockBuilderProps> = ({
  challengeId,
  onCodeChange,
}) => {
  const spec = SCL_PUZZLE_SPECS[challengeId];
  const [filled, setFilled] = useState<Record<string, string>>({});
  const [activeSlotId, setActiveSlotId] = useState<string>(() => spec?.slots[0]?.id ?? 's1');

  useEffect(() => {
    setFilled({});
    setActiveSlotId(SCL_PUZZLE_SPECS[challengeId]?.slots[0]?.id ?? 's1');
  }, [challengeId]);

  const previewCode = useMemo(() => {
    if (!spec) return '';
    return spec.buildCode(filled);
  }, [spec, filled]);

  if (!spec) return null;

  const activeSlot = spec.slots.find((s) => s.id === activeSlotId) ?? spec.slots[0];
  const filledCount = spec.slots.filter((s) => Boolean(filled[s.id])).length;

  const handlePickChoice = (slotId: string, text: string) => {
    haptic('tap');
    const next = { ...filled, [slotId]: text };
    setFilled(next);
    onCodeChange(spec.buildCode(next));

    // 自动跳到下一个还没填的空位，像多邻国一样顺滑
    const nextEmpty = spec.slots.find((s) => !next[s.id]);
    if (nextEmpty) {
      setActiveSlotId(nextEmpty.id);
    }
  };

  const handleReset = () => {
    haptic('tap');
    setFilled({});
    setActiveSlotId(spec.slots[0].id);
    onCodeChange(spec.buildCode({}));
  };

  return (
    <div className="v32-scl-builder" aria-label="SCL 词块拼句练习器">
      <div className="v32-scl-builder-head">
        <div className="v32-scl-builder-title">
          <Puzzle size={15} />
          <span>{spec.intro}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="cap-badge teal">
            已拼 {filledCount} / {spec.slots.length}
          </span>
          {filledCount > 0 && (
            <button type="button" className="cap-btn" onClick={handleReset} style={{ padding: '4px 9px', fontSize: 12 }}>
              <RotateCcw size={12} /> 重拼
            </button>
          )}
        </div>
      </div>

      {/* 步骤空位切换条 */}
      <div className="v32-scl-slot-bar" role="tablist" aria-label="选择要填入的代码空位">
        {spec.slots.map((slot) => {
          const val = filled[slot.id];
          const isActive = slot.id === activeSlot.id;
          return (
            <button
              key={slot.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`v32-scl-slot-btn${isActive ? ' active' : ''}${val ? ' is-filled' : ''}`}
              onClick={() => setActiveSlotId(slot.id)}
            >
              <span className="v32-scl-slot-lbl">
                {val ? <CheckCircle2 size={13} /> : <HelpCircle size={13} />}
                {slot.label}
              </span>
              <code className="v32-scl-slot-val">{val ? val.split('\n')[0] : slot.placeholder}</code>
            </button>
          );
        })}
      </div>

      {/* 当前空位的候选词块区 */}
      <div className="v32-scl-choices-box">
        <div className="v32-scl-choices-head">
          <Sparkles size={13} />
          点击最符合工业规范的词块，自动填入「{activeSlot.label}」：
        </div>
        <div className="v32-scl-choices">
          {activeSlot.choices.map((ch) => {
            const picked = filled[activeSlot.id] === ch.text;
            return (
              <button
                key={ch.text}
                type="button"
                className={`v32-scl-chip${picked ? ' is-picked' : ''}`}
                onClick={() => handlePickChoice(activeSlot.id, ch.text)}
              >
                <code>{ch.text}</code>
                {ch.hint && <small>{ch.hint}</small>}
              </button>
            );
          })}
        </div>
      </div>

      {/* 实时拼出的完整 SCL 代码预览 */}
      <div className="v32-scl-preview-wrap">
        <div className="v32-scl-preview-bar">
          <span>实时生成的 TIA Portal SCL 源码（拼完直接点下方“运行规则编译与评测”！）</span>
        </div>
        <pre className="v32-scl-preview">
          <code>{previewCode}</code>
        </pre>
      </div>
    </div>
  );
};
