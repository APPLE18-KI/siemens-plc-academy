# 功能设计说明书（FDS）
## 项目名称：基于西门子 S7-1215C + PROFINET 的新能源锂电模组柔性视觉分拣、热压恒温固化与立体入库工作站

- **文档版本**：V1.0（As-Built 毕业交付版）
- **控制核心**：SIMATIC S7-1215C DC/DC/DC (`6ES7 215-1AG40-0XB0`) + TIA Portal V18/V19
- **工业总线**：PROFINET IO (RT) 100Mbps 星型交换机拓扑
- **适用规范**：IEC 61131-3 (SCL) / OMAC PackML (ISA-TR88) / ISO 13849-1 (PL d)

---

## 1. 系统总体工艺与技术指标

本工作站面向动力电池 Pack 产线后段，实现锂电模组（支持 LFP-100Ah / NCM-150Ah / CTP-280Ah 多配方柔性切换）的自动进料、扫码视觉分级、恒温热压整形固化与 4×3 立体暂存库自动入库：

| 指标项 | 设计要求 | 实现方案 |
|---|---|---|
| 单件节拍 (CT) | ≤ 12.0 s/件（UPH ≥ 300） | G120 调速进料 + V90 双轴联动 + 待机预热保温 |
| 热压恒温精度 | 85.0°C ± 0.5°C，超调 ≤ 0.5°C | OB30 (100ms) 恒定中断 + PI 抗积分饱和 + 1s SSR PWM |
| 立体库规模 | 4 列 × 3 层（12 仓位），掉电防丢失 | `DB_StationGlobal.WarehouseSlots` 变量级 `RETAIN` 保持 |
| 异常防护 | 急停瞬断、双磁簧互斥报警、超温锁存 | 双通道安全继电器 + STO + 标准化故障代码 `101~103` |

---

## 2. PROFINET 网络拓扑与硬件 BOM

子网掩码统一为 `255.255.255.0`，通过 SCALANCE XB008 工业交换机组成星型实时以太网：

| IP 地址 | PROFINET 设备名 | 设备型号 / 订货号 | 功能与报文 |
|---|---|---|---|
| `192.168.0.1` | `plc-s7-1215c` | CPU 1215C DC/DC/DC (`6ES7 215-1AG40-0XB0`) | PROFINET IO Controller，主控与温控 |
| `192.168.0.2` | `hmi-tp700-comfort` | SIMATIC HMI TP700 Comfort (`6AV2 124-0GC01-0AX0`) | SCADA 监控、配方管理与报警记录 |
| `192.168.0.10` | `drv-g120-conveyor` | SINAMICS G120 CU240E-2 PN (`6SL3 244-0BB12-1FA0`) | 进料皮带变频调速，**标准报文 1 (2 PZD)** |
| `192.168.0.11` | `drv-v90-axis-x` | SINAMICS V90 PN 0.75kW (`6SL3 210-5FB10-8UF0`) | 立体库水平 X 轴伺服，**报文 3 / 111** |
| `192.168.0.12` | `drv-v90-axis-z` | SINAMICS V90 PN 0.75kW 带抱闸 (`6SL3 210-5FB10-8UF0`) | 立体库垂直 Z 轴伺服，**报文 3 / 111 + 断电抱闸** |
| `192.168.0.20` | `cam-vision-st1` | 智能工业读码/视觉相机（PROFINET IO） | 读条码、内阻/外观分级（A/B/NG） |
| `192.168.0.30` | `rio-et200sp-st1` | ET 200SP IM 155-6 PN ST + DI16/DO16 + AI 4xRTD | 现场分布式传感器、气缸阀岛与 PT100 采温 |

---

## 3. 软件分层架构与 TIA Portal 导入顺序

严格遵循西门子官方依赖导入次序，避免编译期“未解析的数据类型 (Unresolved type reference)”报错：

1. **导入 PLC 变量表**：导入 `tags/PLC_TagTable_S71215C.csv` 至默认变量表或对应分组。
2. **导入 PLC 数据类型 (UDT & Global DB)**：添加外部源文件 `types/UDT_ModuleRecipeAndStation.scl` → 右键“从源生成块”。
3. **导入底层设备标准功能块 (FB)**：
   - `blocks/FB_Cylinder2Pos.scl`（支持多重背景的双控气缸块）
   - `blocks/FB_SinamicsDrive_Tel1.scl`（G120 PROFIdrive 标准报文 1 封装块）
   - `blocks/FB_ThermalPress_PID.scl`（恒温 PID + 超温安全联锁块）
4. **导入主控状态机与组织块 (OB)**：
   - `blocks/FB_CellSortingStation_Main.scl`（外层 PackML + 内层 GRAFCET + 空仓检索）
   - `blocks/OB100_WarmRestart.scl`（启动组织块：安全初始化 + 保护掉电保持仓位）
   - `blocks/OB1_MainCycle.scl`（包含 `OB1_MainCycle`、`OB30_CyclicPID_100ms` 及背景 DB）

---

## 4. 安全联锁与故障处理矩阵

| 故障编号 | 触发条件 | 系统响应动作 | 恢复条件 |
|---|---|---|---|
| `ALM-001` | 急停按钮拍下（`%I0.0 = 0`） | 无条件瞬跳 PackML `Aborted (90)`，切 STO 与加热，步序清零 | 旋起急停 → 拍安全复位 → HMI `Clear` → `Reset` 重新回零 |
| `ALM-005` | 气缸伸出/退回磁簧同时为 1 超 150ms | 报代码 `103`，立即切断该气缸双侧电磁阀并暂停自动线 | 现场排查磁簧粘连/短线后点击报警复位 |
| `ALM-009` | 热压腔温度 ≥ `95.0°C` 或 PT100 断线 | 锁存超温位，强制 PID 输出归零、关闭 SSR 加热，进入 `Aborted` | 腔体自然降温至 `90.0°C` 以下（5°C 回差）后人工复位 |
| `ALM-012` | 4×3 立体库 12 个仓位全部占用 | 禁止新料进入并切入 `Held (50)`，HMI 亮黄灯提示人工/AGV 出库 | 执行出库或点击一键清空后点击 `Unhold` 恢复 |
