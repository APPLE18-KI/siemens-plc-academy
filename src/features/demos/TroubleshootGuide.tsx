import React, { useState } from 'react';
import { CheckCircle2, ChevronRight, RotateCcw, Search } from 'lucide-react';
import { haptic } from '../../app/native/platform';

/* 互动排错向导：选症状 → 按顺序逐条检查 → “解决了”或“没用，下一条”。
 * 检查顺序遵循“先简单后复杂、先看诊断再动手”的现场习惯。 */

interface Check {
  look: string;
  why: string;
  fix: string;
}

interface Symptom {
  id: string;
  title: string;
  checks: Check[];
}

const SYMPTOMS: Symptom[] = [
  {
    id: 'cannot-find',
    title: '下载时搜索不到 PLC',
    checks: [
      {
        look: '“扩展下载到设备”里的 PG/PC 接口选对了吗？',
        why: '仿真要选 PLCSIM；真机要选电脑上接网线的那块网卡（不是无线网卡）。选错了接口，等于往错误的路上找人。',
        fix: '仿真：接口选 PLCSIM，并确认 S7-PLCSIM 窗口已打开。真机：选有线网卡，勾选“显示所有兼容的设备”后再搜索。',
      },
      {
        look: '网线和网口指示灯正常吗？',
        why: '物理连接断了，后面一切设置都没用。',
        fix: '看 CPU 网口和电脑网口的灯是否亮/闪；换一根网线或换一个网口试试。',
      },
      {
        look: '电脑 IP 和 PLC 在同一网段吗？',
        why: 'S7-1200 出厂时没有 IP 地址，下载项目后才使用项目里分配的 IP（例如 192.168.0.1）。电脑网卡需要在同一网段（如 192.168.0.100，掩码 255.255.255.0）。',
        fix: '在 Windows 网络设置中给有线网卡设置固定 IP；或在博途“在线访问”里找到设备，用“分配 IP 地址”功能先给 CPU 设置地址。',
      },
      {
        look: '是否被防火墙或其他软件拦截？',
        why: '部分安全软件会拦截工业通讯。',
        fix: '暂时关闭第三方防火墙后再试；若是公司电脑，请联系 IT 同事。',
      },
    ],
  },
  {
    id: 'error-led',
    title: 'CPU 的 ERROR 灯红色闪烁 / CPU 进不了 RUN',
    checks: [
      {
        look: '先看诊断缓冲区，不要急着断电重启',
        why: '诊断缓冲区按时间记录了 CPU 遇到的每个事件，是找原因最直接的入口。断电重启可能把现场线索冲掉。',
        fix: '博途中转至在线 → 在线和诊断 → 诊断缓冲区，读最上面（最新）的几条事件和帮助说明。',
      },
      {
        look: '硬件组态和实物一致吗？',
        why: '项目里组态的 CPU 型号、固件版本或扩展模块和实物不一致，常常导致报错或无法启动。',
        fix: '对照铭牌核对订货号和版本；在“设备组态”中修改后重新编译、下载。',
      },
      {
        look: '有没有模块缺失、模拟量断线或 PROFINET 设备掉站？',
        why: '外围设备异常会触发诊断报警，ERROR 灯会提示。',
        fix: '根据诊断缓冲区提示检查对应模块、接线和网线；排除后确认报警消失。',
      },
      {
        look: 'CPU 是否处于 STOP（RUN/STOP 灯为黄色）？',
        why: 'STOP 状态下不执行程序，输出保持安全状态。',
        fix: '确认原因已排除后，在博途工具栏点“启动 CPU”，或在下载结束时勾选“全部启动”。',
      },
    ],
  },
  {
    id: 'no-output',
    title: '程序看起来对，但外部设备不动作',
    checks: [
      {
        look: '在线监视里，输出线圈真的为 1 吗？',
        why: '先分清是“程序没让它动”还是“程序让动了但现场没动”，这是排错的第一刀。',
        fix: '打开 OB1 的监视（眼镜图标）看线圈状态；同时看 CPU 面板上对应 Q 点的指示灯。',
      },
      {
        look: '同一个输出是否在程序别处又被赋值（双线圈）？',
        why: '程序从上到下执行，后写的会覆盖先写的，前面那段逻辑看起来“失灵”。',
        fix: '右键该变量 → 交叉引用，检查所有写入位置，只保留一个线圈。',
      },
      {
        look: 'Q 指示灯亮了，但设备不动？',
        why: '那就是 PLC 之后的问题：输出回路电源、保险、接触器线圈、接线端子。',
        fix: '断电后用万用表检查输出回路和负载；需要带电测量时请由有资质的人员操作。',
      },
      {
        look: '强制或修改值是否忘记取消？',
        why: '强制值保存在 CPU 里，关掉博途后依然有效，会让程序“看起来不听话”。',
        fix: '打开强制表，选择“停止强制”；确认强制表里不再有生效的强制（F 标记）。',
      },
    ],
  },
  {
    id: 'input-dead',
    title: '按下按钮，PLC 输入没反应',
    checks: [
      {
        look: 'CPU 面板上对应 I 点的灯有没有亮？',
        why: '输入灯亮说明 24V 信号已经到了 PLC 端子；不亮说明问题在 PLC 外面。',
        fix: '不亮：检查按钮、接线和 24V 电源；亮但程序里没变化：检查变量地址是否填错。',
      },
      {
        look: '公共端（1M）接法和传感器类型匹配吗？',
        why: '源型/漏型（PNP/NPN）接反，信号就进不来，这是新手最常见的接线问题。',
        fix: '对照接线图检查 1M 接 0V 还是 24V，与传感器类型匹配（见“漏型/源型接线”一讲）。',
      },
      {
        look: '程序里用的地址和实际接线端子一致吗？',
        why: '接在 I0.1，程序里却写了 I0.0，是很常见的低级错误。',
        fix: '打开变量表核对地址，在线监视时按一下按钮，观察哪个地址在变化。',
      },
    ],
  },
  {
    id: 'sim-error',
    title: '下载到 PLCSIM 时提示“块无法仿真”',
    checks: [
      {
        look: '项目属性里是否勾选了“块编译时支持仿真”？',
        why: '西门子说明：遇到无法仿真的块时，需要在项目属性“保护”页签勾选此项并重新编译。',
        fix: '右键项目 → 属性 → 保护 → 勾选“块编译时支持仿真”→ 确定，然后重新编译再下载。',
      },
      {
        look: '是否用了带专有技术保护的库块？',
        why: '受保护的块需要以支持仿真的方式编译，否则 PLCSIM 无法运行。',
        fix: '使用支持仿真的库版本，或取得密码后按上一条重新编译。',
      },
      {
        look: '博途和 PLCSIM 版本是否匹配？',
        why: '官方要求 STEP 7 与 S7-PLCSIM 版本兼容（通常为相同版本，如都为 V17）。',
        fix: '安装与博途相同版本的 S7-PLCSIM。',
      },
    ],
  },
];

export const TroubleshootGuide: React.FC = () => {
  const [symId, setSymId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [solved, setSolved] = useState(false);
  const sym = SYMPTOMS.find((s) => s.id === symId) ?? null;

  const pick = (id: string) => {
    haptic('tap');
    setSymId(id);
    setStep(0);
    setSolved(false);
  };

  return (
    <div className="demo-root">
      {!sym ? (
        <>
          <p className="demo-sub">
            <Search size={14} /> 选一个你遇到的问题，按顺序逐条检查：
          </p>
          <div className="trouble-list">
            {SYMPTOMS.map((s) => (
              <button key={s.id} type="button" className="trouble-symptom" onClick={() => pick(s.id)}>
                <span>{s.title}</span>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="trouble-flow">
          <div className="trouble-head">
            <strong>{sym.title}</strong>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSymId(null)}>
              <RotateCcw size={14} />
              换一个问题
            </button>
          </div>
          <ol className="trouble-steps">
            {sym.checks.map((c, i) => {
              const state = i < step ? 'passed' : i === step ? 'current' : 'todo';
              return (
                <li key={c.look} className={`trouble-step ${state}`}>
                  <div className="trouble-step-head">
                    <span className="trouble-no">{i + 1}</span>
                    <span>{c.look}</span>
                  </div>
                  {state === 'current' && !solved && (
                    <div className="trouble-step-body">
                      <p>
                        <strong>为什么查这个：</strong>
                        {c.why}
                      </p>
                      <p>
                        <strong>怎么做：</strong>
                        {c.fix}
                      </p>
                      <div className="trouble-actions">
                        <button
                          type="button"
                          className="btn btn-success btn-sm"
                          onClick={() => {
                            haptic('success');
                            setSolved(true);
                          }}
                        >
                          <CheckCircle2 size={14} />
                          解决了
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => {
                            haptic('tap');
                            setStep((s) => s + 1);
                          }}
                        >
                          没用，查下一条
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          {solved && (
            <div className="demo-verdict ok" role="status">
              太好了！记下这次的原因，下次遇到同样的现象就能更快定位。
            </div>
          )}
          {!solved && step >= sym.checks.length && (
            <div className="demo-verdict bad" role="status">
              常见原因都排查过了。把诊断缓冲区内容、你的操作步骤和截图整理好，请有经验的同事或老师一起看，会快很多。
            </div>
          )}
        </div>
      )}
    </div>
  );
};
