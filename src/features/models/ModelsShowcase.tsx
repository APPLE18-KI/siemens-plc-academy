import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowUpRight,
  Cpu,
  Factory,
  Gauge,
  Layers,
  ListChecks,
  Table2,
  TrafficCone,
} from 'lucide-react';
import type { ModelId } from '../../types/content';
import { S71200WiringTwin } from './S71200WiringTwin';
import { SortingConveyorTwin } from './SortingConveyorTwin';
import { TankPressurePidTwin } from './TankPressurePidTwin';
import { TrafficIntersectionTwin } from './TrafficIntersectionTwin';
import './models.css';

interface SensorSpec {
  name: string;
  model: string;
  note: string;
}

interface PlcVarRow {
  address: string;
  symbol: string;
  type: string;
  role: string;
}

interface ModelShowcaseMeta {
  id: ModelId;
  badge: string;
  title: string;
  subtitle: string;
  tags: string[];
  exampleId: string;
  exampleTitle: string;
  icon: React.ReactNode;
  devices: SensorSpec[];
  variables: PlcVarRow[];
}

const MODEL_META_LIST: ModelShowcaseMeta[] = [
  {
    id: 's7-1200-wiring',
    badge: '模型 01 · 电气硬件',
    title: 'S7-1200 CPU 1214C 硬件拆解与接线实训台',
    subtitle: '24V 电源、断路器、NPN/PNP 双向光耦极性校验、KA 继电器与 KM 电机主回路',
    tags: ['DC/DC/DC', 'PNP vs NPN', '1M 公共端', 'KA/KM 隔离'],
    exampleId: 'ex-motor-jog-seal',
    exampleTitle: '三相异步电机启保停与点动检修双模式控制',
    icon: <Cpu size={20} />,
    devices: [
      {
        name: '西门子 CPU 1214C DC/DC/DC',
        model: '6ES7 214-1AG40-0XB0',
        note: '14 点直流输入（双向光耦，兼容漏/源型）+ 10 点 24V 晶体管源型输出（仅输出 +24V），自带 PROFINET 口与 2 路 0-10V 模拟量输入。',
      },
      {
        name: '三线制漫反射光电传感器 BG1',
        model: 'E3Z-D61 (NPN) / E3Z-D81 (PNP)',
        note: '棕线(BN)接 +24V、蓝线(BU)接 0V、黑线(BK)为信号线。西门子欧标推荐 PNP（高电平输出 + 1M 接 M）；若接 NPN 则必须将同一组 1M 改接 L+。',
      },
      {
        name: 'DC24V 中间继电器 KA1（带续流二极管）',
        model: 'OMRON MY2N-GS / 西门子 LZX',
        note: '晶体管输出最大带载仅 0.5A 且不能直接驱动 AC220V 接触器线圈，必须经 KA 中间继电器实现交直流强弱电隔离与感性负载续流保护。',
      },
      {
        name: '交流接触器 KM1 与热过载继电器 FR1',
        model: '西门子 SIRIUS 3RT2016 + 3RU21',
        note: '主触点通断三相 380V 电机电源；热继电器常闭辅助触点(95-96)既应串入 KM 硬件回路，也应反馈至 PLC %I0.4 用于报警显示与自锁复位。',
      },
    ],
    variables: [
      { address: '%I0.0', symbol: 'Start_PB', type: 'Bool', role: '绿色自复位启动按钮 SB1（常开 NO），按下为 1' },
      { address: '%I0.1', symbol: 'Stop_PB', type: 'Bool', role: '红色停止按钮 SB2（常闭 NC 故障安全接线），常态为 1' },
      { address: '%I0.2', symbol: 'EStop_OK', type: 'Bool', role: '蘑菇头急停按钮（常闭 NC），拍下变 0 立即断电停机' },
      { address: '%I0.3', symbol: 'Photo_BG1', type: 'Bool', role: '三线制漫反射光电传感器信号，用于验证 PNP/NPN 与 1M 极性' },
      { address: '%I0.4', symbol: 'FR1_OK', type: 'Bool', role: '热过载继电器常闭辅助触点，电机过流跳闸时变 0' },
      { address: '%Q0.0', symbol: 'KM1_Motor', type: 'Bool', role: '晶体管源型输出驱动 KA1 → KM1 吸合运行三相电机' },
      { address: '%Q0.1', symbol: 'HL_Run', type: 'Bool', role: '电控柜门绿色运行指示灯' },
      { address: '%Q0.2', symbol: 'HL_Fault', type: 'Bool', role: '电控柜门红色故障报警灯（急停/过载触发）' },
    ],
  },
  {
    id: 'sorting-conveyor',
    badge: '模型 02 · 产线顺控',
    title: '三工位视觉检测与气动分拣传送带',
    subtitle: '一维位移物理仿真 · 对射光电 + 电感接近 + 工业相机 + 双气缸磁性开关超时保护',
    tags: ['电感接近', '视觉分拣', '双磁性开关', '声光报警塔'],
    exampleId: 'ex-sorting-line',
    exampleTitle: '三工位视觉检测与双气缸柔性分拣产线顺序控制',
    icon: <Factory size={20} />,
    devices: [
      {
        name: '电感式金属接近开关',
        model: '西门子 3RG4 / 欧姆龙 E2E-X5MF1',
        note: '利用高频振荡电磁场涡流效应，仅对铁、不锈钢、铝等金属导体感应动作，不受塑料、灰尘与油污干扰，常用于金属分拣工位。',
      },
      {
        name: '工业智能视觉相机 + 环形光源',
        model: '西门子 SIMATIC MV440 / 康耐视 In-Sight',
        note: '通过光电触发拍照或 PROFINET 通信下发检测结果（OK/NG 尺寸超差/二维码批次），PLC 结合移位寄存器或 FIFO 队列跟踪物料到达剔除工位。',
      },
      {
        name: '双作用气缸 + 两位五通电磁阀 + 磁性开关',
        model: 'SMC CDM2B25 + SY5120 + D-M9P',
        note: '气缸前后安装两只磁性开关（缩回到位 %I0.5 / 伸出到位 %I0.6），标准工程 FB 必须配置动作超时看门狗定时器（如 1.3s），防气缸卡死撞料。',
      },
      {
        name: 'SINAMICS G120 变频器',
        model: 'CU240E-2 PN + PM240-2',
        note: '通过 PROFINET 报文 1 或模拟量 %QW80 接收 PLC 频率给定（0~27648 对应 0~50Hz），实现输送带软启停与调速。',
      },
    ],
    variables: [
      { address: '%I0.1', symbol: 'EStop_OK', type: 'Bool', role: '产线急停安全回路状态（NC 常闭，常态 1）' },
      { address: '%I0.2', symbol: 'PE_Infeed', type: 'Bool', role: '上料对射光电，连续遮挡 >3s 触发堵料/粘连报警' },
      { address: '%I0.3', symbol: 'Prox_Metal', type: 'Bool', role: '电感金属接近开关，仅对银色金属工件触发为 1' },
      { address: '%I0.4', symbol: 'Cam_Trig', type: 'Bool', role: '工业视觉相机工位到位触发与 NG 识别信号' },
      { address: '%I0.5', symbol: 'Cyl1_Ret', type: 'Bool', role: '1# 金属分拣气缸缩回原点磁性开关' },
      { address: '%I0.6', symbol: 'Cyl1_Ext', type: 'Bool', role: '1# 气缸伸出到位磁性开关，超时未达触发卡死停线' },
      { address: '%Q0.0', symbol: 'VFD_Run', type: 'Bool', role: '传送带变频器运行使能命令' },
      { address: '%Q0.1 / %Q0.2', symbol: 'Sol_Cyl1 / Cyl2', type: 'Bool', role: '1# 金属分拣 / 2# 次品剔除气缸电磁阀线圈' },
      { address: '%QW80', symbol: 'VFD_FreqRef', type: 'Int', role: '变频器频率给定值（0~27648 映射 0~50Hz）' },
    ],
  },
  {
    id: 'tank-pressure-pid',
    badge: '模型 03 · 过程控制',
    title: '双泵恒压供水与储液罐热工 PID 闭环',
    subtitle: '真实液位/热工微分方程积分 · 4-20mA 断线保护 + 双泵自动加减泵 + 实时三曲线趋势',
    tags: ['4-20mA 断线', 'PID_Compact', '一阶惯性 ODE', '双泵联控'],
    exampleId: 'ex-constant-pressure-pid',
    exampleTitle: '双泵恒压供水模拟量采集、断线保护与 PID 闭环调速',
    icon: <Gauge size={20} />,
    devices: [
      {
        name: '静压式/雷达液位变送器 LT-101',
        model: '西门子 SITRANS P320 (4-20mA)',
        note: '采用“活零点”4-20mA 电流环抗干扰传输：4mA 对应 0%（码值 0），20mA 对应 100%（码值 27648）；若读数掉至 0mA（码值 < -1728）即判定断线！',
      },
      {
        name: '模拟量扩展模块 SM 1231 / SM 1232',
        model: '6ES7 231-4HD32 / 6ES7 232-4HB32',
        note: 'SM 1231 AI4 采集 4-20mA 液位与压力，程序中使用 NORM_X + SCALE_X 工程量标定；SM 1232 AQ2 输出 0-10V/4-20mA 控制 1# 主泵变频调速。',
      },
      {
        name: '主变频泵 P1 + 副工频增压泵 P2',
        model: '一拖二恒压供水泵组',
        note: 'P1 由 PID 闭环无级调速；当用水高峰 P1 持续满频(>86%)超 2s 时自动投入 P2 增压；低谷 P1 频率回落(<35%)后自动切除 P2 节能。',
      },
      {
        name: '高高液位硬件浮球开关 + 电加热管 SSR',
        model: 'LS-HH 常闭浮球 + 固态继电器',
        note: '即便模拟量变送器漂移，独立的 HH 浮球开关仍可在 90% 液位硬切泵组防溢流；加热管联锁要求液位 >20% 防干烧。',
      },
    ],
    variables: [
      { address: '%IW64', symbol: 'AI_TankLevel', type: 'Int', role: '液位 4-20mA 原始通道值（0~27648，<0 为断线故障）' },
      { address: '%IW66', symbol: 'AI_Pressure', type: 'Int', role: '出口管网压力变送器通道值（0~1.0 MPa）' },
      { address: '%I0.2', symbol: 'LS_HighHigh', type: 'Bool', role: '高高液位溢流保护浮球开关（NC 常闭，触发变 0）' },
      { address: '%Q0.0', symbol: 'Pump1_VFD_Run', type: 'Bool', role: '1# 主变频增压水泵启停使能' },
      { address: '%Q0.1', symbol: 'Pump2_Aux_Run', type: 'Bool', role: '2# 副增压水泵接触器（高峰加泵 / P1 故障备泵切换）' },
      { address: '%Q0.2', symbol: 'Heater_SSR', type: 'Bool', role: '储罐热工电加热固态继电器（55°C 迟滞温控 + 防干烧）' },
      { address: '%QW80', symbol: 'AQ_VFD_Out', type: 'Int', role: 'PID 闭环输出至 1# 变频器速度给定（0~27648）' },
    ],
  },
  {
    id: 'traffic-intersection',
    badge: '模型 04 · 状态机联锁',
    title: '智能十字路口四向车流与人行请求联锁',
    subtitle: '2.5D 俯视车流排队仿真 · 多时段状态机 + 行人优先 + 消防绿波 + 绿灯冲突安全继电器',
    tags: ['状态机 CASE', '全红清空', '行人优先', '绿灯冲突检测'],
    exampleId: 'ex-smart-traffic',
    exampleTitle: '城市十字路口多时段信号灯与行人请求联锁系统',
    icon: <TrafficCone size={20} />,
    devices: [
      {
        name: '十字路口 LED 信号灯组与倒计时牌',
        model: 'DC24V / AC220V 隔离驱动',
        note: '东西主干道与南北次干道采用相位状态机切换，并在黄灯结束后插入 1.5s“全红清空时间”，防止路口滞留车辆侧面相撞。',
      },
      {
        name: '绿灯冲突硬件安全监控器（Conflict Monitor）',
        model: '独立安全联锁继电器 / F-CPU',
        note: '交通国标强制要求：绝不能仅依赖普通 PLC 软件逻辑防冲突，必须由独立硬件检测 EW_Green AND NS_Green，一旦冲突立即硬切绿灯降级全向黄闪！',
      },
      {
        name: '路边行人过街请求按钮',
        model: 'IP65 防护带状态回显指示灯按钮',
        note: '上升沿锁存行人过街请求，在不打破当前方向最小安全绿灯时间的前提下缩短倒计时，切入全红 + 斑马线专用放行相位。',
      },
      {
        name: '消防应急优先信号接口',
        model: '干接点 / 联网特勤绿波指令',
        note: '高优先级中断普通日间配时，锁定主干道长绿波通道并封锁交叉方向车流，确保应急救援车辆快速通过。',
      },
    ],
    variables: [
      { address: '%I0.1', symbol: 'Night_Mode', type: 'Bool', role: '夜间低峰黄灯 1Hz 闪烁模式选择开关' },
      { address: '%I0.2', symbol: 'Ped_Request', type: 'Bool', role: '斑马线行人过街请求按钮（边沿触发锁存）' },
      { address: '%I0.3', symbol: 'Emerg_Green', type: 'Bool', role: '紧急消防绿波通道强制优先指令' },
      { address: '%Q0.0 ~ %Q0.2', symbol: 'EW_R / Y / G', type: 'Bool', role: '东西主干道红、黄、绿三色主信号灯输出' },
      { address: '%Q0.3 ~ %Q0.5', symbol: 'NS_R / Y / G', type: 'Bool', role: '南北次干道红、黄、绿三色主信号灯输出' },
      { address: '%Q0.6', symbol: 'Ped_Walk', type: 'Bool', role: '斑马线行人专用通行绿灯（全向车流红灯互锁）' },
    ],
  },
];

export const ModelsShowcase: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialId = (searchParams.get('model') as ModelId | null) ?? 's7-1200-wiring';
  const validInitial = MODEL_META_LIST.some((m) => m.id === initialId) ? initialId : 's7-1200-wiring';
  const [activeId, setActiveId] = useState<ModelId>(validInitial);

  useEffect(() => {
    const q = searchParams.get('model') as ModelId | null;
    if (q && MODEL_META_LIST.some((m) => m.id === q) && q !== activeId) {
      setActiveId(q);
    }
  }, [searchParams, activeId]);

  const handleSelectModel = (id: ModelId) => {
    setActiveId(id);
    setSearchParams({ model: id }, { replace: true });
  };

  const activeMeta = MODEL_META_LIST.find((m) => m.id === activeId) ?? MODEL_META_LIST[0];

  const renderActiveTwin = () => {
    switch (activeId) {
      case 's7-1200-wiring':
        return <S71200WiringTwin />;
      case 'sorting-conveyor':
        return <SortingConveyorTwin />;
      case 'tank-pressure-pid':
        return <TankPressurePidTwin />;
      case 'traffic-intersection':
        return <TrafficIntersectionTwin />;
    }
  };

  return (
    <div className="dt-root dt-showcase">
      {/* Page Hero Banner */}
      <section className="dt-hero">
        <div>
          <div className="dt-hero-kicker">
            <Layers size={14} />
            设备模型 · 看程序如何驱动真实设备
          </div>
          <h1 className="dt-hero-title">4 套可操作的设备模型</h1>
          <p className="dt-hero-desc">
            光看梯形图，很难想象现场设备怎么动。这里每套模型都按 S7-1200 的控制逻辑运行：
            你可以让 <strong>PLC 自动运行</strong>，也可以<strong>手动强制</strong>某个输出；
            旁边实时显示输入/输出点（%I、%Q）和模拟量（%IW、%QW）的数值，还能<strong>人为制造故障</strong>来练习排错。
          </p>
        </div>

        <div className="dt-hero-metrics">
          <div className="dt-metric-box">
            <div className="dt-metric-val">4 套</div>
            <div className="dt-metric-lbl">设备模型</div>
          </div>
          <div className="dt-metric-box">
            <div className="dt-metric-val">13 项</div>
            <div className="dt-metric-lbl">可模拟的现场故障</div>
          </div>
          <div className="dt-metric-box">
            <div className="dt-metric-val">%I/%Q</div>
            <div className="dt-metric-lbl">博途标准地址写法</div>
          </div>
        </div>
      </section>

      {/* 4 HD Model Switcher Cards */}
      <section className="dt-cards-grid" aria-label="数字孪生模型切换卡片">
        {MODEL_META_LIST.map((m) => {
          const isActive = m.id === activeId;
          return (
            <button
              key={m.id}
              type="button"
              className={`dt-model-card ${isActive ? 'dt-model-card--active' : ''}`}
              onClick={() => handleSelectModel(m.id)}
            >
              <div className="dt-card-head">
                <div className="dt-card-icon">{m.icon}</div>
                <span className="dt-card-badge">{m.badge}</span>
              </div>
              <h2 className="dt-card-title">{m.title}</h2>
              <p className="dt-card-sub">{m.subtitle}</p>
              <div className="dt-card-tags">
                {m.tags.map((t) => (
                  <span key={t} className="dt-tag">
                    {t}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </section>

      {/* Full-Width Active Digital Twin Interactive Canvas */}
      <section aria-label="数字孪生交互仿真画布">{renderActiveTwin()}</section>

      {/* Supporting Engineering Knowledge: Sensor/Actuator Selection + PLC Variable Mapping */}
      <section className="dt-knowledge-grid">
        <div className="dt-info-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 className="dt-info-title" style={{ margin: 0 }}>
              <ListChecks size={17} color="#00c4c4" />
              配套传感器与执行器工程选型要点
            </h3>
            <Link
              to={`/examples/${activeMeta.exampleId}`}
              className="dt-btn dt-btn--primary"
              style={{ textDecoration: 'none' }}
            >
              看完整 LAD/SCL 实例
              <ArrowUpRight size={14} />
            </Link>
          </div>

          <div className="dt-device-list">
            {activeMeta.devices.map((d) => (
              <div key={d.name} className="dt-device-item">
                <div className="dt-device-top">
                  <span className="dt-device-name">{d.name}</span>
                  <span className="dt-device-spec">{d.model}</span>
                </div>
                <p className="dt-device-note">{d.note}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="dt-info-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 className="dt-info-title" style={{ margin: 0 }}>
              <Table2 size={17} color="#38bdf8" />
              PLC 标准 I/O 变量映射表（TIA Portal 规范）
            </h3>
            <Link to="/sim" className="dt-btn" style={{ textDecoration: 'none' }}>
              去仿真实验室写程序
              <ArrowUpRight size={14} />
            </Link>
          </div>

          <div className="dt-table-wrap">
            <table className="dt-table">
              <thead>
                <tr>
                  <th>绝对地址</th>
                  <th>符号变量名</th>
                  <th>类型</th>
                  <th>工艺与联锁说明</th>
                </tr>
              </thead>
              <tbody>
                {activeMeta.variables.map((v) => (
                  <tr key={v.address}>
                    <td>
                      <span className="dt-code-pill">{v.address}</span>
                    </td>
                    <td style={{ fontFamily: 'var(--dt-mono)', fontWeight: 600 }}>{v.symbol}</td>
                    <td style={{ fontFamily: 'var(--dt-mono)', color: 'var(--dt-text-muted)' }}>{v.type}</td>
                    <td style={{ lineHeight: 1.5 }}>{v.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};
