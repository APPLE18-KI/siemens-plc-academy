# 西门子 PLC 工程师实训工坊 (Siemens PLC Academy)

面向零基础到进阶工程师的 **西门子 S7-1200 / S7-1500 + TIA Portal（博途）** 项目制交互式学习平台，集成了 **渐进式互动教学、PLC 扫描仿真实验室、2.5D 工业数字孪生建模、微观/宏观工程工作流可视化** 以及 **简历加分毕业大项目（含可导入博途的标准 SCL 源码包与 STAR 简历/面试指南）**。

---

## 在线永久体验链接 (GitHub Pages)

- **在线实训平台（支持电脑端 & 手机端自适应）**：[https://apple18-ki.github.io/siemens-plc-academy/](https://apple18-ki.github.io/siemens-plc-academy/)
- **GitHub 开源仓库与博途 `.scl` 工程包**：[https://github.com/APPLE18-KI/siemens-plc-academy](https://github.com/APPLE18-KI/siemens-plc-academy)

---

## 本地快速启动

```powershell
cd C:\Users\15492\.gemini\antigravity\scratch\siemens-plc-academy
npm run dev
```

启动后在浏览器访问：`http://127.0.0.1:5173`

如需构建离线生产包：

```powershell
npm run build
npm run preview
```

---

## 五大核心模块导览

| 模块 | 路由 | 核心学习与交互能力 |
| :--- | :--- | :--- |
| **1. 渐进式互动课程（5 章 15 讲）** | `/#/learn` | 从 0 基础认识 S7-1200 与 NPN/PNP 24V 接线、扫描周期与双线圈陷阱，到位逻辑、IEC 定时/计数、`FB + Instance DB` 与 `UDT` 结构化编程、SCL 状态机、模拟量 `NORM_X/SCALE_X`、`PID_Compact` 与 PROFINET 报文控制。每讲均内嵌实时仿真/孪生模型、LAD/SCL 双视图、实训打卡与 45 道随堂判分解析题。 |
| **2. S7-1200 交互式仿真实验室** | `/#/sim` | 真实 `PII → OB1 → PIQ` 扫描引擎（支持 RUN / STOP / 单步扫描 / 慢放倍速）、TIA Portal 风格荧光绿能流导通梯形图（LAD）、同步等效 SCL 代码、实时数字示波器（Trace 波形仪），内置 6 大经典预设 + **自定义梯形图自由搭建沙盒**。 |
| **3. 2.5D 工业数字孪生建模中心** | `/#/models` | 4 套高精度可交互设备模型：`S7-1200 CPU 1214C 硬件拆解与 NPN/PNP 端子接线台`、`三工位视觉检测与双气缸分拣传送带`、`双泵恒压供水与热工储液罐 PID 闭环`、`智能十字路口四向防冲突车流模型`。全部支持 PLC 自动 / 手动强制调试切换、参数调节与现场故障注入。 |
| **4. 经典工业实例展示库** | `/#/examples` | 6 套完整非标与过程控制实例（电机启保停点动、行车正反转限位往返、22kW 风机星三角降压启动、三工位视觉分拣线、双泵恒压供水 PID、智能交通信号联锁），含需求规格、标准 I/O 表、LAD/SCL 双代码、内嵌孪生联动、现场踩坑警示与面试高频考点。 |
| **5. 工作流解剖 & 简历毕业大项目** | `/#/workflows` & `/#/capstone` | **工作流**：微观 CPU 扫描周期与双线圈事故实验室、OMAC PackML + GRAFCET 状态机同步高亮、非标自动化项目 URS→EPLAN→博途→FAT/SAT 八步交付流。<br>**毕业项目**：《基于西门子 S7-1215C + PROFINET 的新能源锂电模组柔性视觉分拣、热压恒温固化与立体入库工作站》（含 5 关在线 SCL 闯关评测、WinCC Unified 风格 SCADA 监控大屏、源码浏览器、STAR 简历生成器与 15 题深度面试问答）。 |

---

## 毕业项目 TIA Portal 真实工程文件导入说明

项目目录 [`capstone/tia-portal-project/`](./capstone/tia-portal-project) 下已生成符合西门子博途（TIA Portal V17 / V18 / V19）标准的真实源文件：

- `types/UDT_ModuleRecipeAndStation.scl` — 锂电模组配方、工位状态与立体库仓位自定义数据类型（UDT）
- `blocks/FB_Cylinder2Pos.scl` — 工业标准双磁性开关气缸功能块（含双向互斥与超时看门狗报警）
- `blocks/FB_SinamicsDrive_Tel1.scl` — SINAMICS G120/V90 标准 1 号报文（`047E -> 047F`）驱动块
- `blocks/FB_ThermalPress_PID.scl` — 热压恒温固化 `PID_Compact` 手自动无扰切换与超温联锁功能块
- `blocks/FB_CellSortingStation_Main.scl` — 基于 PackML + CASE 状态机的主工作站控制块（多重背景封装）
- `blocks/OB100_WarmRestart.scl` & `blocks/OB1_MainCycle.scl` — 暖启动初始化、主循环与 `OB30` 循环中断调度
- `tags/PLC_TagTable_S71215C.csv` — 标准 S7-1215C PLC 变量分配表
- `docs/FDS_功能设计说明书.md` — 完整工业功能设计规格书（FDS）
- `docs/RESUME_AND_INTERVIEW_GUIDE.md` — 简历项目经历写法与 15 道技术面试高频追问满分指南

**导入 TIA Portal 步骤**：
1. 在 TIA Portal 中新建 `CPU 1215C DC/DC/DC` 项目；
2. 展开左侧项目树 **外部源文件 (External source files) → 添加新外部文件**，按 `UDT` → 子 `FB` → 主 `FB` → `OB` 顺序导入 `.scl` 文件；
3. 右键点击导入的源文件，选择 **“从源生成块 (Generate blocks from source)”** 即可一键生成完整程序架构。
