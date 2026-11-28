# 西门子 PLC 工程师实训工坊 (Siemens PLC Academy)

面向零基础到进阶工程师的 **西门子 S7-1200 / S7-1500 + TIA Portal（博途）** 项目制交互式学习平台，集成了 **渐进式互动教学、PLC 扫描仿真实验室、2.5D 工业数字孪生建模、微观/宏观工程工作流可视化** 以及 **简历加分毕业大项目（含可导入博途的标准 SCL 源码包与 STAR 简历/面试指南）**。

---

## 在线永久体验链接 (GitHub Pages)

- **在线实训平台（支持电脑端 & 手机端自适应；另有离线 Android App，见下文）**：[https://apple18-ki.github.io/siemens-plc-academy/](https://apple18-ki.github.io/siemens-plc-academy/)
- **GitHub 开源仓库与博途 `.scl` 工程包**：[https://github.com/APPLE18-KI/siemens-plc-academy](https://github.com/APPLE18-KI/siemens-plc-academy)

---

## 本地开发与构建

环境：Node.js 22+（Capacitor CLI 8 要求）、npm。

```bash
npm ci              # 按 package-lock.json 安装依赖
npm run dev         # 开发服务器 http://127.0.0.1:5173
npm run build       # 类型检查 + 生产构建（输出 dist/，分包懒加载，适合部署到网站）
npm run preview     # 本地预览生产构建
```

**离线构建**（Android App 使用，也可直接双击 `dist/index.html` 离线打开）：

```bash
VITE_OFFLINE=1 npm run build
```

离线构建会去掉需要联网的网络字体，并把全部脚本打成单个 JS、单个 CSS（浏览器禁止 `file://` 下加载 ES 模块，所以离线包不使用分包）。部署到网站子路径时可用 `VITE_BASE=/子路径/ npm run build` 覆盖默认的相对路径。

---

## Android App 构建（Capacitor 8）

需要：**JDK 21**（Capacitor 8 / AGP 8.13 要求）、Android SDK（platform 36、build-tools），并在 `android/local.properties` 写入 `sdk.dir=<Android SDK 路径>`（该文件不入库）。

```bash
VITE_OFFLINE=1 npm run build      # 1. 离线网页包
npx cap sync android              # 2. 复制到 android/app/src/main/assets/public 并同步插件
cd android
./gradlew assembleRelease         # 3. 构建发布版 APK（需先配置签名，见下）
# 输出：android/app/build/outputs/apk/release/app-release.apk
```

也可以一步完成：`npm run android:release`（= 离线构建 + cap sync + assembleRelease）。

**发布签名**：

1. 生成密钥库（只需一次，妥善保管，丢失后无法用同一签名发布更新）：
   ```bash
   keytool -genkeypair -v -storetype PKCS12 -keystore plc-academy-release.p12 \
     -alias plcacademy -keyalg RSA -keysize 4096 -validity 10000
   ```
2. 复制 `android/keystore.properties.example` 为 `android/keystore.properties`，填入密钥库路径、密码和别名（该文件已被 `.gitignore` 忽略，切勿提交）。
3. 运行 `./gradlew assembleRelease`，Gradle 会自动读取 `keystore.properties` 签名；没有该文件时生成未签名的 APK。
4. 校验：`apksigner verify --print-certs app-release.apk`，`aapt dump badging app-release.apk`。

App 特性：完全离线（不申请联网权限）、边到边显示与安全区留白、状态栏随深浅主题变色、返回键逐层关闭弹层并在首页“再按一次退出”、测验/仿真按钮/完成课程触感反馈、品牌图标与启动页。详见 `CHANGES.md`。

> ARM64 构建机提示：Google 只提供 x86_64 版 aapt2。可在 `~/.gradle/gradle.properties` 中用 `android.aapt2FromMavenOverride=<路径>/aapt2` 指向一个通过 qemu 用户态模拟运行 x86_64 aapt2 的包装脚本（脚本文件名必须是 `aapt2`）。

---

## 五大核心模块导览

| 模块 | 路由 | 核心学习与交互能力 |
| :--- | :--- | :--- |
| **全局命令与档案中心（v3.0 新增）** | 全局 `Ctrl+K` / `⌘K` | **全站毫秒级速查面板**：离线统一检索 21 讲课程、6 大仿真预设 + 沙盒、4 套数字孪生、6 个工程实例、3 个原理动画、29 条术语（支持搜 `TON`/`NORM_X`/`%IW64`/`27648`/`047F`/`双线圈`）与毕业大项目深链；顶部进度弹窗支持 **本机学习档案 `.json` 一键导出备份与导入恢复**；首页配备 **三路线定制推荐器**（零基础电工转行 / 在职补齐 SCL&PID / 自动化求职冲刺）。 |
| **1. 渐进式互动课程（5 章 21 讲，含第 0 讲与 5 讲补充课）** | `/#/learn` | 从 0 基础认识 S7-1200 与 NPN/PNP 24V 接线、扫描周期与双线圈陷阱，到位逻辑、IEC 定时/计数、`FB + Instance DB` 与 `UDT` 结构化编程、SCL 状态机、模拟量 `NORM_X/SCALE_X`、`PID_Compact` 与 PROFINET 报文控制。v3.0 新增学习诉求与时长筛选、顶部平滑阅读进度条、**每讲本机随堂笔记抽屉**与 **一键复制 Markdown 速查卡**。 |
| **2. S7-1200 交互式仿真实验室（v3.0：交叉引用 F11 + 双线圈体检）** | `/#/sim` | 默认“博途 + PLCSIM 视图”：CPU 操作面板、LAD 在线能流监视、SIM 表、变量表、监控表、强制表、诊断缓冲区，v3.0 新增 **交叉引用表（`F11`）与双线圈/地址静态冲突体检器**（点击直达高亮对应程序段）及键盘快捷键（`Alt+R/S/M`）。**自定义梯形图沙盒**支持一键导出标准博途 `.scl` 源文件与工程 JSON 导入/分享；**Trace 实时示波器**支持双游标 `Δt` 周期测量与 `.csv` 导出。 |
| **v2.0–v3.0 讲课模式 / 四级折叠 / 出处** | `/#/learn/:id` | 21 讲全部有“讲课模式”（板书逐步写出 + 旁白 + 红色指针 + 动态梯形图），v3.0 新增 **自动连播倍速（`0.8x / 1x / 1.4x`，遇检查题自动暂停）** 与 **可点击步骤分段跳转条**；阅读详略“完整 / 精读 / 要点 / 结论”；正文中的“出处”标签可查看西门子手册原文摘录与页码。 |
| **v2.2–v3.0 讲解课问答与收藏** | `/#/learn/:id`、`/#/qa` | 讲课模式关键步骤弹出 42 道检查题（支持键盘 `1–4` 快选）；每讲 6–7 道新手问答（共 130 题）；问答库离线模糊搜索，v3.0 新增 **重点问答星标收藏**（课内与问答库双向同步）。 |
| **v2.0–v3.0 复习中心** | `/#/review` | SM-2 间隔复习卡片（v3.0 支持 `Space` 翻面与 `1/2/3` 快捷键评分）、错题本、费曼自查、连续学习天数，v3.0 新增 **五章掌握度与薄弱环节诊断面板**（一键跳转薄弱章错题或待补课时）。 |
| **3. 2.5D 工业数字孪生建模中心（v3.0：盲测排故工单）** | `/#/models` | 4 套高精度可交互设备模型：`S7-1200 CPU 1214C 硬件拆解与 NPN/PNP 端子接线台`、`三工位视觉检测与双气缸分拣传送带`、`双泵恒压供水与热工储液罐 PID 闭环`、`智能十字路口四向防冲突车流模型`。v3.0 新增 **12 张真实工厂盲测排故实训工单**（含虚拟万用表端子测量、博途监控表查线索、四节点信号链路图与排故 SOP 复盘）。 |
| **4. 经典工业实例展示库（v3.0：工程交付包 + FAT 点检）** | `/#/examples` | 6 套完整非标与过程控制实例，v3.0 新增 **卡片/参数对比矩阵双视图**、**一键下载博途 `.scl` 源文件**、**一键下载带 UTF-8 BOM 标准 `.csv` 变量表** 与交互式 **现场上电五步安全点检表（FAT Checklist）**。 |
| **5. 工作流解剖 & 简历毕业大项目（v3.0：1 号报文实验台 + 模拟面试）** | `/#/workflows` & `/#/capstone` | **工作流**：扫描周期与双线圈事故实验室、OMAC PackML + GRAFCET 状态机、非标项目 URS→FAT/SAT 八步流（支持 `?wf=` 深链分享）。<br>**毕业项目**：《基于西门子 S7-1215C + PROFINET 的新能源锂电模组柔性视觉分拣、热压恒温固化与立体入库工作站》——v3.0 新增 **SINAMICS G120/V90 标准 1 号报文（`047E → 047F` / `16#4000`）位级交互解码台**、**纯前端一键打包下载全套博途 `.zip` 工程包**、**SCADA 报警确认（ACK）归档与实测 CT/良率看板**，以及 **15 题模拟技术面试官自测抽题器** 与 STAR 双格式一键复制。 |

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

---

## 相关文档

- `CHANGES.md`：全部改动说明（v2.0 新功能、新课程、互动演示、术语表、八轮自查、Android App、资料来源与学习功能取舍）
- `REVIEW.md`：十三轮自查评审记录（第 6~8 轮为 v2.0，第 9~11 轮为 v2.1 手机适配，第 12~13 轮为 v2.2 讲解课问答）
- “关于与开源许可”页（`/#/about`）：unfold（MIT）与 TextFold 致谢、依赖许可证、引用文档

当前版本：**v3.2**（全面吸收 Brilliant、Duolingo、Tinkercad Circuits、Scrimba、Shenzhen I/O 与 Python Tutor 六大经典学习软件互动范式：新增 S7-1200 点对点端子拉线闯关与 24V 短路跳闸保护、梯形图沙盒 8 关自动试车判题与波形对比、毕业项目 5 关 SCL 积木拼句模式、全站代码词条即点即译与 `LAD ⇄ SCL` 双栏联动高亮、通电前直觉押注与逐题即时解析、扫描周期逐段微步 X 光与变量跳变 Diff 追踪，以及首页水平自测与复习中心图形微操练习，详见 `CHANGES.md`）。
