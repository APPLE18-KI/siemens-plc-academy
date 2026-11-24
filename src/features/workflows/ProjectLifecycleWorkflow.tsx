import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  FileCode2,
  Milestone,
  Wrench,
} from 'lucide-react';
import './workflows.css';

interface LifecycleStage {
  num: string;
  shortTitle: string;
  title: string;
  phaseTag: string;
  duration: string;
  roleFocus: string;
  responsibilities: string[];
  deliverableTitle: string;
  deliverablePreview: string;
  pitfalls: string[];
  checklist: string[];
}

const LIFECYCLE_STAGES: LifecycleStage[] = [
  {
    num: '01',
    shortTitle: 'URS 需求解读',
    title: '01 · 客户需求规格书 (URS) 解读与节拍拆解',
    phaseTag: '方案立项',
    duration: 'Day 1 ~ 3',
    roleFocus: '拆解工艺节拍 (CT)、安全等级 (PLd/SIL2) 与工厂 MES/上位机通信边界',
    responsibilities: [
      '通读 URS，量化单件节拍 CT（如 ≤ 12.0s/模组）、良率、温控精度（85.0°C ±0.5°C）与 OEE 验收指标。',
      '与机械、视觉、MES 团队拉通工艺流程，输出初步动作时序图（甘特图）与安全回路划分。',
      '明确供电制式（AC 380V/220V）、气源压力监测要求及客户指定的品牌清单（如西门子 S7-1215C + V90）。',
    ],
    deliverableTitle: '交付物预览 · URS 关键技术指标确认单 (节选)',
    deliverablePreview: `项目名称：新能源锂电模组视觉分拣热压入库工作站
设计节拍：CT <= 12.0 s/件 (UPH >= 300)
核心精度：热压温控 85.0°C ± 0.5°C | 视觉定位 ±0.15 mm
安全等级：ISO 13849-1 PL d (双通道急停 + 安全门 + 伺服 STO)
通信协议：PROFINET IO (RT) + Open User TCP (视觉) + Modbus/OPC UA (MES)
验收标准：FAT 连续空跑 2h 零故障 + 带料 500 件良率 >= 99.2%`,
    pitfalls: [
      '爆雷点①：没把客户口头追加的“MES 过站条码防呆”写进 URS 变更单，后期调试无休止加功能导致延期。',
      '爆雷点②：忽略安全门开盖后的“安全低速点动”需求，硬件未预留双通道安全继电器导致返工。',
    ],
    checklist: [
      '已明确单件工艺节拍瓶颈工位与冗余时间裕量（≥15%）',
      '已与客户签字冻结安全联锁清单与通信协议版本',
      '已识别长交期物料（伺服、安全继电器、定制视觉镜头）',
    ],
  },
  {
    num: '02',
    shortTitle: 'BOM 与 EPLAN',
    title: '02 · 硬件选型 BOM 与 EPLAN 电气原理图设计',
    phaseTag: '电气设计',
    duration: 'Day 4 ~ 8',
    roleFocus: 'PLC/IO 点数预留 20% 余量、功率核算、EPLAN 规范出图与柜内布局',
    responsibilities: [
      '统计 DI/DO/AI/AO 与轴控数量，按 20% 裕量选定 CPU 1215C DC/DC/DC、SM1231 RTD 测温模块及 ET200SP。',
      '用 EPLAN 绘制主电路（380V 断路器、滤波、G120/V90 动力）、24VDC 控制回路（传感器与执行器分源供电）及安全急停回路。',
      '输出规范 BOM 采购表、端子排接线表、线号清单与电控柜散热/布局图。',
    ],
    deliverableTitle: '交付物预览 · EPLAN 页结构与线号规范',
    deliverablePreview: `=A1+CAB1/01  主电源进线与三相分配 (L1/L2/L3, QF1, 24V 开关电源)
=A1+CAB1/05  安全继电器急停回路 (ESTOP_CH1/CH2 → K10/K11 强制导向)
=A1+CAB1/10  S7-1215C CPU 电源与本体 DI/DO 接线 (PNP 漏型/源型统一!)
=A1+CAB1/18  PROFINET 工业交换机拓扑与屏蔽层 360° 接地规范
线号规则：   24V+/0V 电源用蓝/白蓝；安全回路用橙色标签；DI 对应 I0.0`,
    pitfalls: [
      '爆雷点①：NPN 与 PNP 传感器混采，导致接进 S7-1200 的 1M 公共端极性冲突，现场加装一堆电平转换模块！',
      '爆雷点②：把高频电磁阀/接触器线圈与 PLC CPU 共用一个 24V 开关电源且未并续流二极管，吸合瞬间拉垮 CPU 复位。',
    ],
    checklist: [
      '全部 DI/DO/AI 点数保留 ≥20% 备用通道，24V 电源功率裕量 ≥30%',
      'PLC 与感性负载分路供电，电磁阀/继电器均配浪涌抑制器',
      '完成强弱电走线槽分离评审与安全回路双通道互检',
    ],
  },
  {
    num: '03',
    shortTitle: '标准 I/O 点表',
    title: '03 · 标准 I/O 地址点表与西门子符号命名规范',
    phaseTag: '接口冻结',
    duration: 'Day 9 ~ 10',
    roleFocus: '建立软件与电气接线唯一真理源 (Single Source of Truth)，支持 CSV 一键导入博途',
    responsibilities: [
      '严格遵循西门子编程风格指南（Programming Styleguide）：符号前缀清晰（i/q/stat/temp 或 I_/Q_）、严禁纯绝对地址编程。',
      '区分本地本体地址（%I0.0~%I1.5, %Q0.0~%Q1.1）与远程 ET200SP/驱动报文起始字节（%IW256/%QW256 以上）。',
      '生成可直接导入 TIA Portal 的标准 `PLC_TagTable.csv`，电气装配与软件编程同步以此表为准。',
    ],
    deliverableTitle: '交付物预览 · TIA Portal 变量表规范 (PLC_TagTable.csv)',
    deliverablePreview: `Name,Path,Data Type,Logical Address,Comment
"I_EStop_OK",Safety,Bool,%I0.0,急停回路正常(常闭触点,1=正常,0=拍下)
"I_Start_PB",Panel,Bool,%I0.1,自动启动绿色按钮(NO)
"I_CylClamp_Ret",Actuators,Bool,%I0.4,阻挡夹紧气缸退回磁性开关
"Q_CylClamp_Adv",Actuators,Bool,%Q0.2,阻挡夹紧气缸伸出电磁阀
"AI_PressTemp_Raw",Process,Int,%IW96,热压腔 PT100 模拟量通道(0.1°C/字)`,
    pitfalls: [
      '爆雷点①：把急停和停止按钮逻辑按常开习惯写反（工业铁律：急停/停止必须用常闭 NC 触点，断线自动触发安全停机！）。',
      '爆雷点②：电气现场改了端子号却没更新共享点表，软件联调时把 2 号气缸误动作撞坏治具。',
    ],
    checklist: [
      '急停、安全门、热继电器故障触点全部采用 Fail-Safe 常闭逻辑',
      '所有变量均已分配清晰中文注释，无地址重叠冲突',
      'CSV 已实测导入 TIA Portal 无警告',
    ],
  },
  {
    num: '04',
    shortTitle: '博途硬件组态',
    title: '04 · TIA Portal 硬件组态、PROFINET 拓扑与报文配置',
    phaseTag: '网络组态',
    duration: 'Day 11 ~ 12',
    roleFocus: '设备名称/IP 规划、GSDML 导入、时钟存储器开启与 SINAMICS 报文绑定',
    responsibilities: [
      '在博途网络视图规划统一子网（`192.168.0.x / 24`）及符合 RFC 标准的 PROFINET 设备名称（全小写+短横线，如 `v90-axis-x`）。',
      '启用 CPU 系统与时钟存储器字节（如 MB0 系统位 `FirstScan` / `AlwaysTRUE`，MB1 时钟脉冲 `Clock_1Hz`）。',
      '为 SINAMICS G120 配置标准报文 1（2 PZD 调速），为 V90 PN 配置报文 3 或 111（EPOS/工艺对象 TO），配置看门狗更新时间。',
    ],
    deliverableTitle: '交付物预览 · PROFINET 节点与报文规划表',
    deliverablePreview: `IP 地址        设备名称 (PN Name)    型号与角色               报文 / I/O 映射
192.168.0.1    plc-s7-1215c         CPU 1215C DC/DC/DC       IO Controller
192.168.0.2    hmi-tp700-comfort    TP700 Comfort 7"         S7 HMI 连接
192.168.0.10   drv-g120-conveyor    SINAMICS G120 CU240E-2   标准报文 1 (%IW256/%QW256)
192.168.0.11   drv-v90-axis-x       SINAMICS V90 PN          西门子报文 3 / 111 (X轴)
192.168.0.12   drv-v90-axis-z       SINAMICS V90 PN          西门子报文 3 / 111 (Z轴)
192.168.0.30   rio-et200sp-st1      IM 155-6 PN ST           分布式 DI16/DO16/RTD`,
    pitfalls: [
      '爆雷点①：只改了 IP 地址却没在线分配 PROFINET 设备名称（Device Name），导致下载后全线红灯报“找不到 IO 设备”！',
      '爆雷点②：在 Openness / 手动组态读取报文地址时混淆 Input 与 Output 起始地址，导致工艺对象 TO 报错。',
    ],
    checklist: [
      '已开启 CPU 系统存储器与时钟存储器，并核对无 M 区重叠',
      '全部从站 GSDML 版本与实物固件号一致，设备名全部合规',
      '硬件编译 0 Error，PROFINET 更新周期核算在 CPU 负载安全范围内',
    ],
  },
  {
    num: '05',
    shortTitle: '模块化软件架构',
    title: '05 · 模块化软件架构 (OB100/OB1/OB30 + UDT + 标准 FB 库)',
    phaseTag: '核心开发',
    duration: 'Day 13 ~ 19',
    roleFocus: '拒绝“面条代码”！遵循 UDT → 标准设备 FB → PackML 主控 FB → OB 分层调度',
    responsibilities: [
      '遵循 TIA 导入与架构铁律：先建 PLC 数据类型（UDT），再建标准化设备块（`FB_Cylinder2Pos`、`FB_SinamicsDrive_Tel1`），再建主控与 OB。',
      '合理划分组织块：`OB100` 冷/暖启动初始化、`OB1` 主循环扫描、`OB30 (100ms)` 恒定周期中断专跑 `PID_Compact` 温控。',
      '所有 FB/DB 开启“优化的块访问”，立体库仓位数组与配方表在 Global DB 中按变量级开启 `Retain`（掉电保持）！',
    ],
    deliverableTitle: '交付物预览 · TIA Portal 块调用架构树',
    deliverablePreview: `PLC_1 [CPU 1215C DC/DC/DC]
├── PLC 数据类型 (TypeGroup)
│   └── UDT_ModuleRecipeAndStation (配方 / 仓位 / 报警结构体)
├── 程序块 (BlockGroup)
│   ├── OB100 [Startup]         → 上电复位安全状态、校验保持型仓位数据
│   ├── OB1   [Main]            → 调用 FC_IO_Map + FB_CellSortingStation_Main
│   ├── OB30  [Cyclic 100ms]    → 调用 FB_ThermalPress_PID (PID_Compact)
│   ├── FB_Cylinder2Pos         → 通用双控气缸(伸出/退回超时 + 互斥报警)
│   ├── FB_SinamicsDrive_Tel1   → G120 控制字 STW1 / 状态字 ZSW1 封装
│   └── DB_StationGlobal [Retain] → HMI 交互与 4×3 立体库掉电保持数据`,
    pitfalls: [
      '爆雷点①：把 `PID_Compact` 放进扫描时间不固定的 `OB1`，导致积分/微分时间常数失真、温度剧烈超调震荡！',
      '爆雷点②：在 FB 内部直接读写全局变量 `%I/%Q`，破坏复用性，无法通过多重背景（Multi-Instance）实例化 10 个气缸。',
    ],
    checklist: [
      '全部控制流程采用 PackML + GRAFCET `CASE` 状态机，无死循环',
      '气缸/电机/变频器均封装为可复用 FB，含完整故障代码与超时保护',
      'HMI 画面按 WinCC 规范分层：总览、手动维护、参数配方、实时报警、IO 诊断',
    ],
  },
  {
    num: '06',
    shortTitle: 'PLCSIM 虚拟联调',
    title: '06 · PLCSIM Advanced + WinCC 虚拟调试 (干跑验证)',
    phaseTag: '虚拟联调',
    duration: 'Day 20 ~ 22',
    roleFocus: '电柜未通电前先在电脑上跑通 80% 逻辑与 HMI 联锁，大幅压缩现场加班时间',
    responsibilities: [
      '使用 PLCSIM / PLCSIM Advanced 加载程序，编写轻量仿真块模拟气缸到位延时与一阶热惯性温控对象。',
      '联合 WinCC RT 进行端到端画面操作测试：验证按钮权限、弹窗确认、趋势曲线与配方掉电读写。',
      '逐条测试异常场景：扫描中途断信号、运行中途拍急停、安全门打开、传感器粘连互斥报警。',
    ],
    deliverableTitle: '交付物预览 · 虚拟调试仿真对象闭环清单',
    deliverablePreview: `仿真验证项                预期结果                                状态
1. 急停任一工步拍下       STO 立即断开，步序清零，HMI 弹出红色未确认报警   [PASS]
2. 气缸伸出 2.5s 未到位   触发 Alarm 102 超时报警，自动切入 Holding        [PASS]
3. 热压腔超温 > 95.0°C    强切加热接触器，屏蔽 PID 输出直至人工复位        [PASS]
4. 立体库 12 仓全满       禁止新料进入并弹窗提示“仓库已满请出库”          [PASS]`,
    pitfalls: [
      '爆雷点①：只测“一切顺利的正常流程 (Happy Path)”，从不测异常中断与恢复，结果一到工厂现场卡死在半路！',
      '爆雷点②：忘记在正式下发产线前屏蔽/移除仿真模拟块（`FB_SimPlant`），导致真机传感器被仿真值覆盖。',
    ],
    checklist: [
      '正常全自动流程连续跑通 ≥20 个完整循环无步序卡滞',
      '手动模式所有单动动作均有防撞互锁（如未抬起禁止水平移动）',
      '仿真块通过编译开关或条件位严格隔离，上线前已确认关闭',
    ],
  },
  {
    num: '07',
    shortTitle: 'FAT 厂内验收',
    title: '07 · FAT 厂内通电点检、带料联调与故障注入验收',
    phaseTag: '厂内验收',
    duration: 'Day 23 ~ 27',
    roleFocus: '先查线后上电、先单动后联动、先低速后全速，带着客户做完破坏性安全验收',
    responsibilities: [
      '上电前万用表通断测试（严防 24V/0V 短路与 380V 相序反），逐点打点核对所有 DI/DO 与模拟量零点/满度。',
      '在博途监控表/Trace 中整定 `PID_Compact` 预调节与精确调节参数，优化伺服加减速曲线达到目标节拍 CT ≤ 12s。',
      '邀请客户执行 FAT 测试表：连续带料生产考核、人为拔掉传感器/触发急停/拉闸断电重启验证数据保持。',
    ],
    deliverableTitle: '交付物预览 · FAT 安全与断电保持验收记录表',
    deliverablePreview: `测试编号  故障注入操作                 现场实测响应                       结论
FAT-S01   高速抓取中拉开源门安全锁     伺服 80ms 内停止，夹爪保持夹紧防掉落   合格
FAT-S02   气缸双磁簧同时给 1 (粘连)    100ms 内报“传感器互斥故障”，停机锁存   合格
FAT-S03   入库 6 件后强断 PLC 24V      重新上电后 6 个仓位条码 100% 保留      合格
FAT-P01   热压腔 25°C 阶跃至 85.0°C    超调 0.3°C，稳态波动 ±0.2°C          合格`,
    pitfalls: [
      '爆雷点①：没查清气缸初始位置和电磁阀得电方向就直接上气源，一通气“砰”一声把视觉相机撞歪！',
      '爆雷点②：急停后没考虑“重力轴/夹爪掉料”风险——Z 轴伺服必须配抱闸，真空吸盘/夹爪掉电需机械自锁或保压阀。',
    ],
    checklist: [
      '100% I/O 打点签字确认，伺服电机旋向与软/硬限位全部标定完成',
      '所有故障注入用例由客户代表现场目击并签字确认',
      '完成博途整机归档备份 (.zap18) 与最新电气红线修改回填 EPLAN',
    ],
  },
  {
    num: '08',
    shortTitle: 'SAT 交付归档',
    title: '08 · SAT 客户现场复装陪产、操作培训与技术归档',
    phaseTag: '终验交付',
    duration: 'Day 28 ~ 32',
    roleFocus: '跨厂区复装复检、MES 产线联网、产线工人/维保培训及可维护文档移交',
    responsibilities: [
      '设备运抵客户车间后复测水平度、机械原点偏移、PROFINET 网线及与上游/下游产线对接握手信号（SMEMA/IO 握手）。',
      '连续 72 小时量产陪产，收集 OEE 停机微故障日志并微调光电防抖延时与视觉曝光阈值。',
      '向客户移交完整竣工资料包（FDS、EPLAN 竣工图、TIA Portal 源码、易损件清单、常见报警排查手册）并签署 SAT 终验单。',
    ],
    deliverableTitle: '交付物预览 · SAT 竣工交付归档包目录',
    deliverablePreview: `2026_BatteryModuleStation_AsBuilt_V1.2/
├── 01_PLC_TIA_V18/       (已编译归档 .zap18 + 外部 .scl 源码 + 变量表 .csv)
├── 02_HMI_WinCC/         (TP700 工程备份 + 配方初始模板)
├── 03_Drive_Backup/      (G120 / V90 参数备份与工艺对象参数)
├── 04_EPLAN_AsBuilt/     (竣工 PDF 原理图 + 端子接线表 + 最终 BOM)
└── 05_Manuals_SignOff/   (FDS 说明书 + 操作维护 SOP + SAT 终验签字扫描件)`,
    pitfalls: [
      '爆雷点①：现场临时改了 PLC 代码却没回传公司 Git/归档服务器，半年后客户叫售后，工程师拿着旧版本去覆盖酿成事故！',
      '爆雷点②：操作培训只讲怎么按“启动”，不讲常见报警怎么看诊断画面与一键回零，导致半夜频繁接电话远程救火。',
    ],
    checklist: [
      '客户产线 MES 对接、上下游握手联锁与连续陪产指标全部达标',
      '操作员与设备维保工程师已通过实操考核（启停/换型/报警排查）',
      '竣工源码、参数备份、EPLAN 图纸与 FDS 文档已完成双备份归档',
    ],
  },
];

export const ProjectLifecycleWorkflow: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>({
    '01-0': true,
    '01-1': true,
  });

  const stage = LIFECYCLE_STAGES[selectedIdx];

  const toggleCheck = (stageNum: string, itemIdx: number) => {
    const key = `${stageNum}-${itemIdx}`;
    setCheckedMap((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const getStageDoneCount = (s: LifecycleStage) =>
    s.checklist.filter((_, idx) => Boolean(checkedMap[`${s.num}-${idx}`])).length;

  const totalChecklist = LIFECYCLE_STAGES.reduce((acc, s) => acc + s.checklist.length, 0);
  const totalChecked = LIFECYCLE_STAGES.reduce((acc, s) => acc + getStageDoneCount(s), 0);
  const overallPct = Math.round((totalChecked / totalChecklist) * 100);

  const stageDoneCount = getStageDoneCount(stage);
  const stagePct = Math.round((stageDoneCount / stage.checklist.length) * 100);

  return (
    <div className="wf-root">
      <div className={`wf-card ${embedded ? 'embedded' : ''}`}>
        {/* Top Progress Header */}
        <div className="wf-toolbar">
          <div className="wf-toolbar-group">
            <span className="wf-badge teal">
              <Milestone size={13} /> 非标自动化工程交付八步法 (URS → SAT)
            </span>
            <span className="wf-badge green">
              项目交付自检完成度：{totalChecked}/{totalChecklist} ({overallPct}%)
            </span>
          </div>
          <div className="wf-toolbar-group">
            <button
              type="button"
              className="wf-btn"
              disabled={selectedIdx === 0}
              onClick={() => setSelectedIdx((i) => Math.max(0, i - 1))}
            >
              ← 上一阶段
            </button>
            <button
              type="button"
              className="wf-btn wf-btn-primary"
              disabled={selectedIdx === LIFECYCLE_STAGES.length - 1}
              onClick={() => setSelectedIdx((i) => Math.min(LIFECYCLE_STAGES.length - 1, i + 1))}
            >
              下一阶段 →
            </button>
          </div>
        </div>

        {/* 8-Step Interactive Milestone Rail */}
        <div className="wf-life-rail">
          {LIFECYCLE_STAGES.map((s, idx) => {
            const doneCount = getStageDoneCount(s);
            const allDone = doneCount === s.checklist.length;
            return (
              <button
                key={s.num}
                type="button"
                className={`wf-life-step ${selectedIdx === idx ? 'active' : ''} ${allDone ? 'done' : ''}`}
                onClick={() => setSelectedIdx(idx)}
              >
                <div className="wf-life-step-num">
                  <span>STEP {s.num}</span>
                  {allDone ? (
                    <CheckCircle2 size={14} color="#10b981" />
                  ) : (
                    <span style={{ fontSize: 10, color: 'var(--wf-text-muted)' }}>
                      {doneCount}/{s.checklist.length}
                    </span>
                  )}
                </div>
                <div className="wf-life-step-title">{s.shortTitle}</div>
                <div className="wf-life-step-tag">
                  {s.phaseTag} · {s.duration}
                </div>
              </button>
            );
          })}
        </div>

        {/* Detail Inspector */}
        <div className="wf-life-detail">
          {/* Left Column: Responsibilities + Deliverable Preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="wf-subpanel">
              <div className="wf-subpanel-title">
                <span style={{ fontSize: 15 }}>{stage.title}</span>
                <span className="wf-badge teal">{stage.duration}</span>
              </div>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--wf-teal-bright)', fontWeight: 600 }}>
                <Wrench size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />
                核心目标：{stage.roleFocus}
              </p>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7, color: 'var(--wf-text)' }}>
                {stage.responsibilities.map((r, i) => (
                  <li key={i} style={{ marginBottom: 6 }}>
                    {r}
                  </li>
                ))}
              </ul>
            </div>

            <div className="wf-subpanel">
              <div className="wf-subpanel-title">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <FileCode2 size={15} color="#14b8a6" /> {stage.deliverableTitle}
                </span>
                <span className="wf-chip">标准交付模板</span>
              </div>
              <pre className="wf-template-pre">{stage.deliverablePreview}</pre>
            </div>
          </div>

          {/* Right Column: Pitfalls + Interactive Gate Checklist */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="wf-subpanel">
              <div className="wf-subpanel-title">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#f87171' }}>
                  <AlertTriangle size={15} /> 本阶段高频延期爆雷点（老工程师避坑）
                </span>
              </div>
              {stage.pitfalls.map((p, i) => (
                <div key={i} className="wf-pitfall-item">
                  {p}
                </div>
              ))}
            </div>

            <div className="wf-subpanel" style={{ flex: 1 }}>
              <div className="wf-subpanel-title">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <ClipboardCheck size={15} color="#10b981" /> 阶段过关自检 Checklist（点击勾选）
                </span>
                <span className={`wf-badge ${stagePct === 100 ? 'green' : 'amber'}`}>
                  {stageDoneCount}/{stage.checklist.length} ({stagePct}%)
                </span>
              </div>
              <div className="wf-progress-bar" style={{ marginBottom: 12 }}>
                <div className="wf-progress-fill" style={{ width: `${stagePct}%` }} />
              </div>

              {stage.checklist.map((item, idx) => {
                const checked = Boolean(checkedMap[`${stage.num}-${idx}`]);
                return (
                  <div
                    key={idx}
                    role="checkbox"
                    aria-checked={checked}
                    tabIndex={0}
                    className={`wf-checklist-item ${checked ? 'checked' : ''}`}
                    onClick={() => toggleCheck(stage.num, idx)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleCheck(stage.num, idx);
                      }
                    }}
                  >
                    {checked ? (
                      <CheckCircle2 size={17} color="#10b981" style={{ flexShrink: 0, marginTop: 2 }} />
                    ) : (
                      <Circle size={17} color="#64748b" style={{ flexShrink: 0, marginTop: 2 }} />
                    )}
                    <span style={{ textDecoration: checked ? 'line-through' : 'none', opacity: checked ? 0.78 : 1 }}>
                      {item}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
