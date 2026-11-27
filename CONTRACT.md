# 西门子 PLC 工程师实训工坊 (Siemens PLC Academy) — 5 子代理协作契约

项目根路径：`C:\Users\15492\.gemini\antigravity\scratch\siemens-plc-academy`

## 1. 核心目标与四大展示支柱 + 简历毕业项目
面向零基础学员，以**从真实工业项目中边做边学**为主线，系统掌握西门子 **S7-1200/1500 + TIA Portal (博途)**，并完成一个可直接写进简历与作品集的毕业大项目。
1. **互动式教学 (`/learn`, `/learn/:lessonId`)**：5 大阶段 15 节循序渐进精品课，内嵌实时 PLC 仿真器、硬件接线/产线数字孪生模型、工作流动画、LAD/SCL 双视图代码、随堂闯关测验与进度持久化。
2. **交互式 PLC 仿真实验室 (`/sim`)**：真实扫描周期引擎（PII → OB1 → PIQ），支持常开/常闭/自锁/互锁/置位复位/上升下降沿、`TON/TOF/TP` IEC 定时器、`CTU/CTD` 计数器、`NORM_X/SCALE_X` 模拟量转换，梯形图（LAD）能流荧光绿导通监控 + 在线交互改图/预设切换 + I/O 调试台 + 数字时序波形图（Trace）。
3. **建模展示 & 实例展示 (`/models`, `/examples`, `/examples/:id`)**：4 套高精度 SVG 2.5D 工业数字孪生模型（S7-1200 CPU 1214C 硬件拆解与 NPN/PNP 接线台、三工位视觉分拣传送带、双泵恒压供水与热工储罐、智能十字路口防冲突车流），支持物理规律动态仿真、手动/PLC 联动模式、故障注入；配 6 个完整工业实例（需求 + IO 表 + LAD/SCL 双代码 + 在线数字孪生 + 调试踩坑与面试考点）。
4. **工作流展示 & 毕业大项目 (`/workflows`, `/capstone`, `capstone/**`)**：
   - 3 大交互式工作流：PLC 微观扫描周期解剖与双线圈事故实验、GRAFCET/PackML 工业状态机步进工作流、非标自动化项目全生命周期工程交付工作流（URS → EPLAN → IO 表 → TIA Portal 架构 → PLCSIM 虚拟调试 → FAT/SAT）。
   - 简历加分毕业项目：**《基于 S7-1215C + PROFINET 的锂电模组柔性视觉分拣、热压温控与立体入库工作站》**（含分阶段闯关实训台、WinCC Unified 风格 SCADA 联调监控台、一键定制 STAR 法则简历项目描述生成器 + 15 道高频面试追问满分话术，以及落地在 `capstone/tia-portal-project/` 下的真实可导入 `.scl` 工程源码与 FDS 设计文档）。

## 2. 技术栈与铁律（严格遵守）
- **技术栈**：Vite 6 + React 18 + TypeScript + `react-router-dom` (**HashRouter**) + `lucide-react` + 原生模块化 CSS (`src/styles/` 或各模块内 `.css`) + 高精度交互式 SVG。
- **依赖锁定**：`node_modules` 已安装完毕，**禁止修改 `package.json`、`tsconfig.json`、`vite.config.ts`、`src/types/**`**（如需调整先在 board 上 @coordinator）。
- **语言规范**：所有界面 UI、提示、注释、文档使用专业地道的**简体中文**（保留必要的工业标准英文缩写如 `OB1`、`FB`、`UDT`、`PROFINET`、`TON`、`PII/PIQ`、`NPN/PNP`）。
- **真实西门子规范**：严禁混用三菱/欧姆龙语法（如 X0/Y0）！统一使用西门子博途 S7-1200/1500 标准语法：`%I0.0`、`%Q0.0`、`%M0.0`、`%IW64`、`%QW80`、符号寻址 `"Tag_Name"`、IEC 定时器 `TON_DB(IN := ..., PT := T#3s)`、SCL 赋值 `:=`、函数块 `FB` + 背景数据块 `Instance DB`。

## 3. 五大子代理严格文件所有权（严禁跨目录修改他人文件！）

| 子代理名 | 独占负责目录与入口文件 | 必须保持导出的签名 |
|---|---|---|
| `platform-arch` | `index.html`, `src/main.tsx`, `src/registry.ts`, `src/styles/**`, `src/app/**`, `src/components/**` | 应用主壳、导航、首页、课程阅读器（渲染全部 `LessonBlock`）、实例列表与详情页壳、学习进度 Store |
| `plc-sim-engine` | `src/core/plc/**`, `src/features/simulator/**` | `src/core/plc/index.ts` 导出 `createPlcRuntime`, `usePlcRuntime`；`src/features/simulator/index.tsx` 导出 `simPresets: Record<SimPresetId, SimPresetEntry>` 与 `SimulatorWorkbench: React.FC` |
| `curriculum-tutor` | `src/content/curriculum.ts`, `src/content/lessons/**` | `src/content/curriculum.ts` 导出 `chapters: ChapterMeta[]` 与 `lessons: Lesson[]`（5 章 15 课完整内容） |
| `twin-modeling` | `src/features/models/**`, `src/content/examples/**` | `src/features/models/index.tsx` 导出 `modelRegistry: Record<ModelId, ModelEntry>` 与 `ModelsShowcase: React.FC`；`src/content/examples/index.ts` 导出 `examples: ExampleCase[]` |
| `workflow-capstone` | `src/features/workflows/**`, `src/content/capstone/**`, `capstone/**` | `src/features/workflows/index.tsx` 导出 `workflowRegistry: Record<WorkflowId, WorkflowEntry>` 与 `WorkflowsShowcase: React.FC`；`src/content/capstone/index.tsx` 导出 `CapstoneStudio: React.FC` |

## 4. 标准预设 ID 枚举（已在 `src/types/content.ts` 强类型锁定）
- `SimPresetId`: `'wiring-basics' | 'seal-in-motor' | 'reversing-interlock' | 'ton-star-delta' | 'ctu-batch-pack' | 'analog-scale-pid'`
- `ModelId`: `'s7-1200-wiring' | 'sorting-conveyor' | 'tank-pressure-pid' | 'traffic-intersection'`
- `WorkflowId`: `'scan-cycle' | 'grafcet-packml' | 'project-lifecycle'`

## 5. 自检要求
每个子代理完成自己的模块后，在项目根目录运行 `npx tsc --noEmit` 确认自己负责的文件 **0 类型错误**（注意：并发编辑期间若看到其他子代理正在写的文件临时报错，只修复自己目录下的报错即可），完成后在消息板汇报交付清单。
