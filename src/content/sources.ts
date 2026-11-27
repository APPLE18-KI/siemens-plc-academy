/**
 * 出处引用（citation chips）。
 * 每条都从西门子官方文档原文逐字摘录（英文原文 + 中文意译），并给出文档名、章节与页码，
 * 正文里用 [^id] 引用，点开即可看到原文。为尊重版权，只摘短句，不嵌入手册页面图片。
 * 核对方式：下载 PDF 后用 PyMuPDF 抽取文本逐字比对（见 CHANGES.md“资料来源”）。
 */
export interface SourceDoc {
  id: string;
  name: string;
  version: string;
  url: string;
}

export interface Citation {
  id: string;
  doc: SourceDoc['id'];
  section: string;
  page?: string;
  /** 原文（逐字摘录；“…”表示省略） */
  quote: string;
  /** 中文意译（本站翻译） */
  zh: string;
}

export const SOURCE_DOCS: Record<string, SourceDoc> = {
  s71200: {
    id: 's71200',
    name: 'S7-1200 Programmable controller System Manual（S7-1200 可编程控制器系统手册）',
    version: 'V4.7，12/2024，A5E02486680-AQ',
    url: 'https://cache.industry.siemens.com/dl/files/302/109977302/att_1307432/v2/s71200_system_manual_en-US.pdf',
  },
  plcsim: {
    id: 'plcsim',
    name: 'S7-PLCSIM online help（S7-PLCSIM 在线帮助）',
    version: 'Operating Manual V21，11/2025，A5E46238743-AJ',
    url: 'https://cache.industry.siemens.com/dl/files/161/109997161/att_1348284/v1/S7-PLCSIM_Help_en-US.pdf',
  },
  plcsimzh: {
    id: 'plcsimzh',
    name: 'S7-PLCSIM V17 在线帮助（简体中文版）',
    version: '编程和操作手册 V17，05/2021，A5E46238796-AB',
    url: 'https://cache.industry.siemens.com/dl/files/780/109797780/att_1067582/v1/S7-PLCSIMzhCN_zh-CHS.pdf',
  },
  tiastatus: {
    id: 'tiastatus',
    name: 'STEP 7（TIA Portal）在线文档：Program status display for LAD programs',
    version: 'STEP 7 V21，11/2025',
    url: 'https://docs.tia.siemens.cloud/r/en-us/v21/testing-the-user-program/testing-with-program-status/examples-of-program-status-display/program-status-display-for-lad-programs',
  },
  faq61931797: {
    id: 'faq61931797',
    name: '西门子 FAQ 61931797：How do you start S7-PLCSIM in STEP 7 (TIA Portal)?',
    version: '条目日期 03/28/2017（页面需 JavaScript 打开，引文以官网为准）',
    url: 'https://support.industry.siemens.com/cs/document/61931797/',
  },
};

export const CITATIONS: Record<string, Citation> = {
  'cycle-order': {
    id: 'cycle-order',
    doc: 's71200',
    section: '6.1.3.2 Program cycle OB',
    page: '67',
    quote: 'During the program cycle, the CPU writes the outputs, reads the inputs and executes program cycle OBs.',
    zh: '在程序循环中，CPU 写输出、读输入，并执行程序循环 OB。',
  },
  'stop-mode': {
    id: 'stop-mode',
    doc: 's71200',
    section: '6.1 Execution of the user program（Operating modes）',
    page: '62',
    quote:
      'In STOP mode, the CPU handles any communication requests (as appropriate) and performs self-diagnostics. The CPU does not execute the user program. Automatic updates of the process image do not occur.',
    zh: '在 STOP 模式下，CPU 处理通信请求并执行自诊断；不执行用户程序，过程映像也不会自动更新。',
  },
  'max-cycle': {
    id: 'max-cycle',
    doc: 's71200',
    section: '6.1.4 Monitoring and configuring the cycle time',
    page: '81–82',
    quote:
      'If a time error interrupt OB has never been downloaded to the CPU, the CPU ignores the first scan timeout condition and remains in RUN mode. If a second scan timeout condition occurs in the same program scan (two times the maximum cycle time value), the CPU generates a diagnostic buffer entry and transitions to STOP mode. … The default is 150 ms.',
    zh: '如果从未下载过时间错误中断 OB，第一次超时会被忽略、CPU 仍在 RUN；同一循环内再次超时（达到 2 倍最大循环时间），CPU 写入诊断缓冲区并转入 STOP。最大循环时间默认 150 ms。',
  },
  'leds': {
    id: 'leds',
    doc: 's71200',
    section: '15.1 Status LEDs',
    page: '1047',
    quote:
      'STOP/RUN – Solid yellow indicates STOP mode – Solid green indicates RUN mode – Flashing (alternating green and yellow) indicates that the CPU is in the STARTUP operating state • ERROR – Flashing red indicates an error, such as an internal error in the CPU, an error with the memory card, or a configuration error (mismatched modules)',
    zh: 'STOP/RUN 灯：黄色常亮 = STOP，绿色常亮 = RUN，黄绿交替闪烁 = 启动（STARTUP）中。ERROR 灯红色闪烁 = 有错误，例如 CPU 内部错误、存储卡错误或组态错误（模块不匹配）。',
  },
  'maint': {
    id: 'maint',
    doc: 's71200',
    section: '15.1 Status LEDs',
    page: '1047',
    quote: 'MAINT (Maintenance) flashes whenever you insert a memory card.',
    zh: '插入存储卡时，MAINT（维护）灯闪烁。',
  },
  'force': {
    id: 'force',
    doc: 's71200',
    section: '15.17.5.2 Operation of the Force function',
    page: '1071',
    quote:
      'In the program, reads of physical inputs are overwritten by the forced value. The program uses the forced value in processing. When the program writes a physical output, the output value is overwritten by the force value.',
    zh: '程序读取物理输入时，读到的是强制值，并用它参与运算；程序写物理输出时，输出值会被强制值覆盖。',
  },
  'watch-vs-force': {
    id: 'watch-vs-force',
    doc: 's71200',
    section: '8.9.1 Monitor and modify data in the CPU（Table 8-4，表格摘录）',
    page: '194',
    quote: 'Editor / Monitor / Modify / Force — Watch table: Yes / Yes / No; Force table: Yes / No / Yes',
    zh: '监控表：可监视、可修改、不能强制；强制表：可监视、不能修改、可强制。',
  },
  'contacts': {
    id: 'contacts',
    doc: 's71200',
    section: '9.1.1 Bit logic instructions',
    page: '197',
    quote:
      'The Normally Open contact is closed (ON) when the assigned bit value is equal to 1. • The Normally Closed contact is closed (ON) when the assigned bit value is equal to 0. • Contacts connected in series create AND logic networks. • Contacts connected in parallel create OR logic networks.',
    zh: '常开触点在位值为 1 时闭合；常闭触点在位值为 0 时闭合。触点串联构成“与”逻辑，并联构成“或”逻辑。',
  },
  'coil': {
    id: 'coil',
    doc: 's71200',
    section: '9.1.1 Output coil and assignment box',
    page: '199',
    quote:
      'The coil output instruction writes a value for an output bit. If the output bit you specify uses memory identifier Q, then the CPU turns the output bit in the process-image register on or off, setting the specified bit equal to power flow status.',
    zh: '线圈指令给一个输出位写值。若输出位是 Q 区地址，CPU 会把过程映像中的这一位置为与能流状态相同的值。',
  },
  'timers': {
    id: 'timers',
    doc: 's71200',
    section: '9.2 Timer operations',
    page: '207',
    quote:
      'The TP timer generates a pulse with a preset width time. … The TON timer sets output Q to ON after a preset time delay. … The TOF timer resets output Q to OFF after a preset time delay.',
    zh: 'TP 产生一个预设宽度的脉冲；TON 在预设延时后把 Q 置为 ON；TOF 在预设延时后把 Q 复位为 OFF。',
  },
  'en-eno': {
    id: 'en-eno',
    doc: 's71200',
    section: '8.5.4 EN and ENO for LAD, FBD and SCL',
    page: '187',
    quote:
      'If the box has power flow at the EN input and the box executes its function without error, then the ENO output passes power flow (ENO = 1) to the next element. If an error is detected in the execution of the box instruction, then power flow is terminated (ENO = 0) at the box instruction that generated the error.',
    zh: '如果方框指令的 EN 有能流且执行无错误，ENO 把能流传给下一个元件（ENO = 1）；如果执行中检测到错误，能流在出错的方框处中断（ENO = 0）。',
  },
  'math-eno': {
    id: 'math-eno',
    doc: 's71200',
    section: '9.5 Math functions（Table 9-46 ENO status）',
    page: '221',
    quote:
      'The Math operation result value would be outside the valid number range of the data type selected. The least significant part of the result that fits in the destination size is returned. … Division by 0 (IN2 = 0): The result is undefined and zero is returned.',
    zh: '（ENO = 0 的情况）运算结果超出所选数据类型的有效范围时，返回能装进目标的低位部分；除以 0 时结果未定义，返回 0。',
  },
  'analog-27648': {
    id: 'analog-27648',
    doc: 's71200',
    section: '6.3 Processing of analog values',
    page: '94',
    quote:
      'The values returned by the modules are integer values where 0 to 27648 represents the rated range for current, and -27648 to 27648 for voltage.',
    zh: '模块返回整数值：电流信号的额定量程对应 0 ~ 27648，电压信号对应 -27648 ~ 27648。',
  },
  'norm-scale': {
    id: 'norm-scale',
    doc: 's71200',
    section: '9.7.5 SCALE_X (Scale) and NORM_X (Normalize)',
    page: '263',
    quote: 'SCALE_X: OUT = VALUE (MAX - MIN) + MIN … NORM_X: OUT = (VALUE - MIN) / (MAX - MIN), where ( 0.0 <= OUT <= 1.0 )',
    zh: 'SCALE_X：OUT = VALUE ×（MAX − MIN）+ MIN；NORM_X：OUT =（VALUE − MIN）/（MAX − MIN），结果在 0.0 ~ 1.0 之间。',
  },
  'mres': {
    id: 'mres',
    doc: 'plcsim',
    section: '5.9 Performing a memory reset (MRES)',
    page: '37',
    quote: 'A memory reset (MRES) clears all working memory areas and copies load memory to working memory.',
    zh: '存储器复位（MRES）会清除所有工作存储区，并把装载存储器的内容复制到工作存储器。',
  },
  'mres-diag': {
    id: 'mres-diag',
    doc: 's71200',
    section: '6.1.1 Operating modes of the CPU',
    page: '64',
    quote: 'A memory reset does not clear the diagnostics buffer or the permanently saved values of the IP address.',
    zh: '存储器复位不会清除诊断缓冲区，也不会清除永久保存的 IP 地址。',
  },
  'plcsim-protect': {
    id: 'plcsim-protect',
    doc: 'plcsim',
    section: '4.7 Differences between a simulated PLC and a physical PLC / 5 Working with simulated PLC instances',
    page: '28、30',
    quote: '1. Right-click the project in STEP 7 and select Properties. 2. From the Protection tab, select "Support simulation during block compilation."',
    zh: '在 STEP 7 中右键项目 → 属性 → “保护”选项卡，勾选“块编译时支持仿真”。',
  },
  'simtable-bits': {
    id: 'simtable-bits',
    doc: 'plcsimzh',
    section: '7.6.3.3 在表格视图中监视和修改值',
    page: '60',
    quote:
      '如果地址为位地址，则会在“位”(Bits) 列显示一个复选框。如果地址为字节地址，则会在“位”(Bits) 列显示八个复选框（一位对应一个复选框）。位的顺序从左到右为：7，6，5，4，3，2，1，0。……默认情况下，只能将值写入到输入中。',
    zh: '（官方中文原文）位地址显示一个复选框，字节地址显示 8 个；默认只能写输入。',
  },
  'lad-status': {
    id: 'lad-status',
    doc: 'tiastatus',
    section: 'Representation of the program status',
    quote: 'Green solid — Satisfied; Blue dashed — Not satisfied; Gray solid — Unknown or not executed; Black — Not interconnected',
    zh: '绿色实线 = 满足；蓝色虚线 = 不满足；灰色实线 = 未知或未执行；黑色 = 未连接。',
  },
  'plcsim-compat': {
    id: 'plcsim-compat',
    doc: 'faq61931797',
    section: 'Instructions for S7-PLCSIM',
    quote:
      'S7-PLCSIM is released for configured S7-1200 controllers with firmware V4 and higher. … The TIA Portal products STEP 7 and S7-PLCSIM must be compatible with each other or have the same version, V17, for example.',
    zh: 'S7-PLCSIM 支持固件 V4 及以上的 S7-1200；STEP 7 与 S7-PLCSIM 的版本必须相互兼容，例如都用 V17。',
  },
};
