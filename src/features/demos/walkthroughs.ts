import type { MockScreen, MockTreeItem, WalkStep } from './StepWalkthrough';

/* 以 TIA Portal 中文界面常见叫法编写；不同版本菜单位置可能略有差异，以实际软件为准。 */

const MENU = ['项目', '编辑', '视图', '插入', '在线', '选项', '工具', '窗口', '帮助'];

const baseTree = (extra: MockTreeItem[] = []): MockTreeItem[] => [
  { label: '我的第一个项目', icon: 'project', id: 'tree-project' },
  { label: '添加新设备', indent: 1, icon: 'folder', id: 'tree-add-device' },
  { label: '设备和网络', indent: 1, icon: 'folder' },
  ...extra,
];

const plcTree: MockTreeItem[] = [
  { label: 'PLC_1 [CPU 1214C DC/DC/DC]', indent: 1, icon: 'cpu', id: 'tree-plc' },
  { label: '设备组态', indent: 2, icon: 'folder', id: 'tree-devcfg' },
  { label: '在线和诊断', indent: 2, icon: 'folder', id: 'tree-online-diag' },
  { label: '程序块', indent: 2, icon: 'folder', id: 'tree-blocks' },
  { label: 'Main [OB1]', indent: 3, icon: 'block', id: 'tree-ob1' },
  { label: 'PLC 变量', indent: 2, icon: 'folder', id: 'tree-tags' },
  { label: '默认变量表', indent: 3, icon: 'table', id: 'tree-default-tags' },
  { label: '监控与强制表', indent: 2, icon: 'folder', id: 'tree-watch' },
];

const projectScreen = (over: Partial<MockScreen>): MockScreen => ({
  layout: 'project',
  title: 'TIA Portal · 项目视图',
  menu: MENU,
  toolbar: [
    { label: '保存项目', id: 'tb-save' },
    { label: '编译', id: 'tb-compile' },
    { label: '下载到设备', id: 'tb-download' },
    { label: '转至在线', id: 'tb-online' },
    { label: '开始仿真', id: 'tb-sim' },
    { label: '启用/禁用监视', id: 'tb-monitor' },
  ],
  tree: baseTree(plcTree),
  ...over,
});

/* -------------------------------------------------------------------------- */
/* 1. 新建项目 → 添加 CPU → 设置 IP → 建变量 → 写第一段程序 → 编译             */
/* -------------------------------------------------------------------------- */
export const TIA_FIRST_PROJECT: WalkStep[] = [
  {
    title: '打开博途，点“创建新项目”',
    goal: '从博途的起始界面进入“新建项目”。',
    actions: [
      '双击桌面上的 TIA Portal 图标，首先看到的是“Portal 视图”（大按钮界面）。',
      '左侧点“启动”，右侧点“创建新项目”。',
    ],
    why: 'Portal 视图是按任务组织的“向导式”界面，适合新手起步；建好项目后再切换到功能更完整的“项目视图”。',
    screen: {
      layout: 'portal',
      title: 'TIA Portal · Portal 视图',
      portal: {
        left: [{ label: '启动', id: 'p-start' }, { label: '设备与网络' }, { label: 'PLC 编程' }, { label: '在线与诊断' }],
        right: [{ label: '打开现有项目' }, { label: '创建新项目', id: 'p-new' }, { label: '移植项目' }],
      },
      highlight: ['p-start', 'p-new'],
    },
  },
  {
    title: '填写项目名称和路径',
    goal: '得到一个空项目，所有硬件和程序都装在这个项目里。',
    actions: ['填写项目名称（如“我的第一个项目”）和保存路径。', '点“创建”。'],
    why: '项目就像一个文件夹，硬件配置、变量表、程序、触摸屏画面都存在里面。路径不要太深、尽量简单，便于以后拷贝和归档。',
    screen: {
      layout: 'portal',
      title: 'TIA Portal · Portal 视图',
      portal: {
        left: [{ label: '启动' }, { label: '设备与网络' }, { label: 'PLC 编程' }, { label: '在线与诊断' }],
        right: [{ label: '打开现有项目' }, { label: '创建新项目' }, { label: '移植项目' }],
      },
      dialog: {
        title: '创建新项目',
        rows: [
          { label: '项目名称', value: '我的第一个项目', id: 'd-name' },
          { label: '路径', value: 'D:\\PLC\\Projects' },
        ],
        buttons: [{ label: '创建', id: 'd-create', primary: true }],
      },
      highlight: ['d-name', 'd-create'],
    },
  },
  {
    title: '添加 CPU（组态设备）',
    goal: '告诉博途：我用的是哪一款 PLC。',
    actions: [
      '在项目视图的项目树中双击“添加新设备”。',
      '依次展开：控制器 → SIMATIC S7-1200 → CPU → CPU 1214C DC/DC/DC。',
      '选择与实物铭牌一致的订货号和固件版本（没有实物时选列表里较新的版本即可），点“确定”。',
    ],
    why: '不同型号的 CPU 点数、功能和内存都不一样。博途要先知道是哪一款，才能检查你的程序和配置能不能在它上面运行；下载到真机时，型号和固件不匹配会报错。',
    screen: projectScreen({
      tree: baseTree(),
      dialog: {
        title: '添加新设备',
        list: [
          { label: '控制器' },
          { label: 'SIMATIC S7-1200', indent: 1 },
          { label: 'CPU', indent: 2 },
          { label: 'CPU 1214C DC/DC/DC', indent: 3, id: 'dev-1214c' },
          { label: '6ES7 214-1AG40-0XB0（订货号，以铭牌为准）', indent: 4, id: 'dev-order' },
        ],
        buttons: [{ label: '确定', id: 'dev-ok', primary: true }, { label: '取消' }],
      },
      highlight: ['tree-add-device', 'dev-order', 'dev-ok'],
    }),
    pitfall: '不确定订货号时，看 CPU 正面或侧面的铭牌；仿真练习时选错型号不会损坏任何东西，但下载到真机前必须改对。',
  },
  {
    title: '设置 CPU 的 IP 地址',
    goal: '让电脑和 PLC（或仿真 PLC）能通过网线找到彼此。',
    actions: [
      '在“设备组态”里点选 CPU 上的绿色网口（PROFINET 接口）。',
      '在下方“属性 → 常规 → 以太网地址”里填写 IP 地址，例如 192.168.0.1，子网掩码 255.255.255.0。',
    ],
    why: 'IP 地址相当于设备的“门牌号”。S7-1200 出厂时没有预设 IP，要在项目里分配，下载时写进 CPU。电脑网卡要和 PLC 处于同一网段（例如电脑设成 192.168.0.100）才能通讯。',
    screen: projectScreen({
      editor: { heading: '设备组态 · 设备视图', kind: 'device' },
      side: {
        heading: '属性 · 以太网地址',
        items: [
          { label: 'IP 地址：192.168.0.1', id: 'ip' },
          { label: '子网掩码：255.255.255.0', id: 'mask' },
        ],
      },
      highlight: ['tree-devcfg', 'device-port', 'ip'],
    }),
  },
  {
    title: '在变量表里给信号起名字',
    goal: '把 %I0.0、%Q0.0 这样的地址变成“启动按钮”“指示灯”这样看得懂的名字。',
    actions: [
      '项目树中打开 PLC 变量 → 默认变量表。',
      '新建两行：Start_PB（Bool，%I0.0，启动按钮）和 Lamp（Bool，%Q0.0，指示灯）。',
    ],
    why: '程序里写名字比写地址更不容易出错，也方便别人看懂。以后接线改了端子，只需要改变量表里的地址，程序不用动。',
    screen: projectScreen({
      editor: {
        heading: 'PLC 变量 · 默认变量表',
        kind: 'table',
        table: {
          head: ['名称', '数据类型', '地址', '注释'],
          rows: [
            ['Start_PB', 'Bool', '%I0.0', '启动按钮'],
            ['Lamp', 'Bool', '%Q0.0', '指示灯'],
          ],
        },
      },
      highlight: ['tree-default-tags', 'cell-0-0', 'cell-1-0'],
    }),
  },
  {
    title: '在 OB1 里画第一段梯形图',
    goal: '写出“按住按钮，灯就亮”的程序。',
    actions: [
      '双击 程序块 → Main [OB1] 打开程序编辑器。',
      '从右侧“指令 → 基本指令 → 位逻辑运算”中，把“常开触点”拖到程序段 1，再拖一个“线圈”放在右边。',
      '双击触点上方的 <??.?>，输入 Start_PB；线圈上方输入 Lamp。',
    ],
    why: 'OB1 是 PLC 循环执行的主程序。触点代表“条件”，线圈代表“结果”：Start_PB 为 1 时能流从左流到右，Lamp 就为 1。',
    screen: projectScreen({
      editor: {
        heading: 'Main [OB1] · 程序段 1',
        kind: 'ladder',
        ladder: { contacts: ['"Start_PB"'], coil: '"Lamp"' },
      },
      side: {
        heading: '指令 · 位逻辑运算',
        items: [
          { label: '-| |- 常开触点', id: 'ins-no' },
          { label: '-|/|- 常闭触点' },
          { label: '-( )- 线圈', id: 'ins-coil' },
        ],
      },
      highlight: ['tree-ob1', 'ins-no', 'ins-coil'],
    }),
  },
  {
    title: '编译并保存',
    goal: '让博途检查程序有没有错误。',
    actions: [
      '在项目树选中 PLC_1，点工具栏的“编译”。',
      '看下方“信息 → 编译”页签：0 个错误才能下载；警告可以先看一看。',
      '点“保存项目”。',
    ],
    why: '编译相当于“交作业前自查”：地址冲突、数据类型不匹配、没填的参数都会在这里报出来。养成每次改完就编译、保存的习惯。',
    screen: projectScreen({
      editor: {
        heading: '信息 · 编译',
        kind: 'lines',
        lines: ['编译完成（错误：0；警告：0）', 'PLC_1：硬件配置 ✓', 'PLC_1：程序块 Main [OB1] ✓'],
      },
      highlight: ['tb-compile', 'line-0', 'tb-save'],
    }),
  },
];

/* -------------------------------------------------------------------------- */
/* 2. 启用仿真支持 → 启动 PLCSIM → 下载 → RUN → 在线监视 → 监控表修改         */
/* -------------------------------------------------------------------------- */
export const TIA_DOWNLOAD_MONITOR: WalkStep[] = [
  {
    title: '打开“块编译时支持仿真”',
    goal: '确保项目里的程序块能被 S7-PLCSIM 运行。',
    actions: [
      '在项目树最上方右键项目名称“我的第一个项目”→ 属性。',
      '切到“保护”页签，勾选“块编译时支持仿真”，点“确定”。',
      '重新编译一次。',
    ],
    why: '西门子官方说明：如果下载到 PLCSIM 时提示某些块“无法仿真”，需要在项目属性的“保护”页签里勾选这个选项并重新编译。很多版本在第一次点“开始仿真”时也会弹窗询问，点“确定”即可。',
    screen: projectScreen({
      dialog: {
        title: '我的第一个项目 · 属性 · 保护',
        rows: [{ label: '块编译时支持仿真', value: '☑ 已勾选', id: 'chk-sim' }],
        buttons: [{ label: '确定', id: 'prop-ok', primary: true }, { label: '取消' }],
      },
      highlight: ['tree-project', 'chk-sim', 'prop-ok'],
    }),
  },
  {
    title: '启动仿真（打开 S7-PLCSIM）',
    goal: '在电脑里“变”出一台虚拟的 S7-1200。',
    actions: ['在项目树选中 PLC_1。', '点工具栏的“开始仿真”（或菜单 在线 → 仿真 → 启动）。'],
    why: 'S7-PLCSIM 会创建一个仿真 PLC 实例，它和真 CPU 一样有 RUN/STOP 状态，可以接收下载。没有硬件时，这就是你的“练习机”。',
    screen: projectScreen({ highlight: ['tree-plc', 'tb-sim', '在线'] }),
  },
  {
    title: '在“扩展下载到设备”中找到仿真 PLC',
    goal: '把编译好的程序和硬件配置送进仿真 PLC。',
    actions: [
      '弹出的下载对话框里：PG/PC 接口的类型选 PN/IE，PG/PC 接口选 PLCSIM。',
      '点“开始搜索”，列表里出现仿真 CPU 后选中它。',
      '点“下载”。',
    ],
    why: '下载就像“把作业交给 PLC”。PG/PC 接口告诉博途走哪条路：真机一般选电脑的网卡，仿真选 PLCSIM。第一次要把硬件配置和程序一起下载，之后只下载修改过的部分。',
    screen: projectScreen({
      dialog: {
        title: '扩展下载到设备',
        rows: [
          { label: 'PG/PC 接口的类型', value: 'PN/IE' },
          { label: 'PG/PC 接口', value: 'PLCSIM', id: 'if-plcsim' },
          { label: '目标设备', value: 'CPU-1200 Simulation · 192.168.0.1', id: 'target' },
        ],
        buttons: [
          { label: '开始搜索', id: 'search' },
          { label: '下载', id: 'load', primary: true },
        ],
      },
      highlight: ['if-plcsim', 'search', 'load'],
    }),
    pitfall: '搜索不到设备？检查 PLCSIM 窗口是否已打开、接口是否选成了 PLCSIM，而不是电脑网卡。',
  },
  {
    title: '确认下载预览，启动 CPU',
    goal: '完成下载并让仿真 PLC 进入 RUN。',
    actions: [
      '“下载预览”中确认没有红色错误，点“装载”。',
      '“下载结果”中勾选“全部启动”（启动模块），点“完成”。',
      '在 PLCSIM 窗口确认状态灯为绿色 RUN。',
    ],
    why: 'CPU 只有在 RUN 状态下才执行程序。下载前博途可能要求先把 CPU 切到 STOP，这是为了避免设备在程序替换的瞬间乱动。',
    screen: {
      layout: 'plcsim',
      title: 'S7-PLCSIM',
      plcsim: { name: 'PLC_1 · CPU 1214C', mode: 'RUN', ip: '192.168.0.1' },
      dialog: {
        title: '下载结果',
        rows: [{ label: '启动模块', value: '☑ 全部启动', id: 'start-all' }],
        buttons: [{ label: '完成', id: 'finish', primary: true }],
      },
      highlight: ['start-all', 'finish'],
    },
  },
  {
    title: '转至在线，打开监视',
    goal: '实时看到程序里哪条线通电了。',
    actions: [
      '打开 Main [OB1]，点工具栏的“启用/禁用监视”（眼镜图标）。',
      '通电的线和触点显示为绿色实线，没通电的显示为蓝色虚线。',
    ],
    why: '在线监视是调试最常用的手段：不用猜，直接看每个触点的真实状态。和本站网页仿真器里“变绿”是同一个意思。',
    screen: projectScreen({
      editor: {
        heading: 'Main [OB1] · 在线监视中',
        kind: 'ladder',
        ladder: { contacts: ['"Start_PB" = 1'], coil: '"Lamp" = 1', energized: true },
      },
      highlight: ['tb-monitor', 'coil'],
    }),
  },
  {
    title: '给输入赋值，验证程序',
    goal: '没有真实按钮，也能测试“按下按钮灯亮”。',
    actions: [
      '在 S7-PLCSIM 中打开 SIM 表（不同版本可能需要先切换到“项目视图”），添加 %I0.0（Start_PB）。',
      '勾选/置 1 这一位，相当于“按下按钮”；回到博途看 Lamp 变为 TRUE。',
      '在博途 监控与强制表 → 添加新监控表，填入 Start_PB 和 Lamp，点“全部监视”，可以同时看到两个值。',
    ],
    why: '仿真 PLC 没有真实端子，PLCSIM 的 SIM 表就是“虚拟按钮”。监控表主要用来集中观察变量，也可以修改 M、DB 等变量。在真实设备上修改或强制变量会让设备真的动起来，必须先确认安全。',
    screen: projectScreen({
      editor: {
        heading: '监控表_1',
        kind: 'table',
        table: {
          head: ['名称', '地址', '监视值', '修改值'],
          rows: [
            ['"Start_PB"', '%I0.0', 'TRUE', ''],
            ['"Lamp"', '%Q0.0', 'TRUE', ''],
          ],
        },
      },
      highlight: ['tree-watch', 'cell-0-2', 'cell-1-2'],
    }),
    pitfall: '真机上，%I 输入每次扫描都会被实际端子状态覆盖，所以用监控表修改 %I 往往“改不动”；真机调试请改中间变量 M，或者谨慎使用强制表（S7-1200 只能强制带 :P 的外设地址）。',
  },
];

/* -------------------------------------------------------------------------- */
/* 3. HMI 入门：添加 KTP700 Basic → 连接 → 画按钮和指示灯 → 仿真               */
/* -------------------------------------------------------------------------- */
const hmiTree: MockTreeItem[] = [
  ...plcTree.slice(0, 1),
  { label: 'HMI_1 [KTP700 Basic PN]', indent: 1, icon: 'hmi', id: 'tree-hmi' },
  { label: '画面', indent: 2, icon: 'folder' },
  { label: '根画面', indent: 3, icon: 'screen', id: 'tree-root-screen' },
  { label: 'HMI 变量', indent: 2, icon: 'folder', id: 'tree-hmi-tags' },
  { label: '连接', indent: 2, icon: 'folder', id: 'tree-conn' },
];

export const HMI_FIRST_SCREEN: WalkStep[] = [
  {
    title: '在 PLC 里准备给触摸屏用的变量',
    goal: '先在 PLC 程序里留好“触摸屏按钮”和“指示灯”两个信号。',
    actions: [
      '在默认变量表新建 HMI_Start（Bool，%M10.0）和 HMI_Stop（Bool，%M10.1）。',
      '在 OB1 写自锁程序：HMI_Start 启动、HMI_Stop 停止，驱动 Lamp（%Q0.0）。',
    ],
    why: '触摸屏按钮要写到 M 区或 DB 里，不要直接写 %I 输入：I 区每次扫描开始都会被真实端子的状态覆盖，触摸屏写进去的值会马上被冲掉。',
    screen: projectScreen({
      tree: baseTree(plcTree),
      editor: {
        heading: 'PLC 变量 · 默认变量表',
        kind: 'table',
        table: {
          head: ['名称', '数据类型', '地址', '注释'],
          rows: [
            ['HMI_Start', 'Bool', '%M10.0', '触摸屏启动按钮'],
            ['HMI_Stop', 'Bool', '%M10.1', '触摸屏停止按钮'],
            ['Lamp', 'Bool', '%Q0.0', '运行指示灯'],
          ],
        },
      },
      highlight: ['cell-0-2', 'cell-1-2'],
    }),
  },
  {
    title: '添加触摸屏设备',
    goal: '在项目里加入一块 7 寸精简面板。',
    actions: [
      '双击“添加新设备”，选 HMI → SIMATIC 精简系列面板 → 7" 显示屏 → KTP700 Basic。',
      '勾选/在向导中选择连接到 PLC_1，其余页面可以先用默认设置，点“完成”。',
    ],
    why: '精简系列面板（Basic Panel）在博途里用 WinCC Basic 组态，和 S7-1200 搭配最常见。连接到 PLC 后，触摸屏才能读写 PLC 里的变量。',
    screen: projectScreen({
      tree: baseTree(plcTree.slice(0, 1)),
      dialog: {
        title: '添加新设备',
        list: [
          { label: 'HMI' },
          { label: 'SIMATIC 精简系列面板', indent: 1 },
          { label: '7" 显示屏', indent: 2 },
          { label: 'KTP700 Basic', indent: 3, id: 'ktp700' },
        ],
        buttons: [{ label: '确定', id: 'hmi-ok', primary: true }],
      },
      highlight: ['ktp700', 'hmi-ok'],
    }),
  },
  {
    title: '检查网络连接',
    goal: '确认 PLC 和触摸屏在同一个网段、已建立 HMI 连接。',
    actions: [
      '打开“设备和网络”，确认 PLC_1 和 HMI_1 的网口之间有一条连线（PN/IE）。',
      '触摸屏 IP 设为同网段地址，例如 192.168.0.2，子网掩码 255.255.255.0。',
    ],
    why: '触摸屏和 PLC 通过以太网通讯，就像两台电脑联网：IP 要在同一网段，而且彼此不能重复。',
    screen: projectScreen({
      tree: baseTree(hmiTree),
      editor: {
        heading: '设备和网络 · 网络视图',
        kind: 'lines',
        lines: ['PLC_1  192.168.0.1  ━━━ PN/IE_1 ━━━  HMI_1  192.168.0.2', 'HMI 连接：HMI_连接_1（PLC_1 ↔ HMI_1）'],
      },
      highlight: ['line-0', 'line-1', 'tree-conn'],
    }),
  },
  {
    title: '在根画面放一个按钮',
    goal: '做出触摸屏上的“启动”按钮。',
    actions: [
      '打开 画面 → 根画面，从右侧“工具箱 → 元素”拖一个“按钮”到画面上，文字改成“启动”。',
      '选中按钮 → 属性 → 事件 → “按下”，添加函数 编辑位 → 置位位，变量选 HMI_Start。',
      '同一按钮的“释放”事件，添加 复位位，变量同样选 HMI_Start。',
    ],
    why: '“按下置位、释放复位”让触摸屏按钮表现得像一个真实的点动按钮：手指按住为 1，松开为 0。PLC 程序里的自锁负责“按一下就保持”。',
    screen: projectScreen({
      tree: baseTree(hmiTree),
      editor: { heading: '根画面', kind: 'screen' },
      side: {
        heading: '属性 · 事件',
        items: [
          { label: '按下 → 置位位 HMI_Start', id: 'ev-press' },
          { label: '释放 → 复位位 HMI_Start', id: 'ev-release' },
        ],
      },
      highlight: ['tree-root-screen', 'canvas-button', 'ev-press', 'ev-release'],
    }),
    pitfall: '只配了“按下 → 置位位”却忘了“释放 → 复位位”，HMI_Start 会一直为 1，停止按钮就失效了。',
  },
  {
    title: '放一个会变色的指示灯',
    goal: '让画面上的圆在 Lamp = 1 时变绿。',
    actions: [
      '从“工具箱 → 基本对象”拖一个“圆”到按钮旁边。',
      '属性 → 动画 → 显示 → 添加“外观”动画，变量选 Lamp。',
      '设置：值 0 → 灰色，值 1 → 绿色。',
    ],
    why: '画面上的元素本身不“知道”PLC 状态，要靠“动画”绑定变量：变量值变了，颜色跟着变。这就是 HMI 显示设备状态的基本方法。',
    screen: projectScreen({
      tree: baseTree(hmiTree),
      editor: { heading: '根画面', kind: 'screen' },
      side: {
        heading: '属性 · 动画 · 外观',
        items: [
          { label: '变量：Lamp', id: 'anim-tag' },
          { label: '0 → 灰色', id: 'anim-0' },
          { label: '1 → 绿色', id: 'anim-1' },
        ],
      },
      highlight: ['canvas-lamp', 'anim-tag', 'anim-1'],
    }),
  },
  {
    title: '和 PLCSIM 一起仿真运行',
    goal: '在电脑上点触摸屏按钮，看到灯变绿。',
    actions: [
      '先按“博途上手”一讲的方法启动 PLCSIM 并下载 PLC 程序，保持 RUN。',
      '在项目树选中 HMI_1，点“开始仿真”，会弹出触摸屏运行画面。',
      '用鼠标按住“启动”，指示灯变绿；PLC 自锁后松开仍保持。',
    ],
    why: 'WinCC 的运行系统仿真可以和 PLCSIM 联动，相当于电脑上同时有一台 PLC 和一块触摸屏，不用任何硬件就能把整套流程走通。',
    screen: {
      layout: 'hmi',
      title: 'WinCC Runtime 仿真 · KTP700 Basic',
      hmi: {
        buttons: [{ label: '启动', id: 'rt-start' }, { label: '停止' }],
        lamp: { label: '运行中', on: true },
      },
      highlight: ['rt-start'],
    },
  },
];
