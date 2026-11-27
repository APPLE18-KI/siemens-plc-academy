/**
 * 西门子 S7-1200 / TIA Portal 任意地址与常数“大白话实时拆解器”
 * 面向零基础新手：在 Ctrl+K / 速查框里输入任意地址（如 %I0.3、%MW12、%IW64、16#047F、T#5s、27648、1M），
 * 即时给出每个字母/数字的白话含义与新手最容易踩的地址重叠/接线坑。
 */
export interface DecodedPlcHint {
  code: string;
  tag: string;
  headline: string;
  parts: Array<{ token: string; meaning: string }>;
  plainExplain: string;
  pitfall?: string;
  relatedTo?: { label: string; to: string };
}

export function decodePlcToken(rawInput: string): DecodedPlcHint | null {
  const q = rawInput.trim();
  if (!q) return null;
  const up = q.toUpperCase();

  // 1. 位地址：%I0.0 / I0.0 / %Q1.2 / %M10.5
  const bitMatch = up.match(/^%?([IQM])(\d+)\.([0-7])$/);
  if (bitMatch) {
    const [, area, byteStr, bitStr] = bitMatch;
    const byteNo = Number(byteStr);
    const bitNo = Number(bitStr);
    const canonical = `%${area}${byteNo}.${bitNo}`;

    const areaMeta: Record<string, { name: string; role: string; pitfall: string; to: string; toLabel: string }> = {
      I: {
        name: '数字量输入点 (DI)',
        role: `对应 PLC 上排输入端子（第 ${byteNo} 组第 ${bitNo} 号点），用来接外部按钮、光电/磁性传感器。外部送进 24V 时为 1，没电时为 0。`,
        pitfall: '新手注意：%I 是外部硬件送进来的状态，程序里只能用触点“读”它，千万别拿线圈去“写”它；如果接的是常闭急停按钮，不按时它就是 1！',
        to: '/learn/l02-wiring-npn-pnp',
        toLabel: '看第 2 讲：接线与常开/常闭',
      },
      Q: {
        name: '数字量输出点 (DQ)',
        role: `对应 PLC 下排输出端子（第 ${byteNo} 组第 ${bitNo} 号点），用来点亮指示灯、吸合继电器/接触器或电磁阀。`,
        pitfall: `防坑提醒：同一个 ${canonical} 在整个程序里通常只能放一个普通线圈 -( )-！如果两个程序段都写它，后面那行会覆盖前面（双线圈陷阱）。`,
        to: '/learn/l03-scan-cycle-pii-piq',
        toLabel: '看第 3 讲：双线圈陷阱',
      },
      M: {
        name: '内部辅助标志位 (M 区记忆位)',
        role: `PLC 肚子里的“草稿本开关”（第 ${byteNo} 字节第 ${bitNo} 位），不接任何外部电线，专门用来存中间状态（比如“自动模式运行中”“故障标志”）。`,
        pitfall: `防重叠提醒：它属于字节 %MB${byteNo} 的其中 1 位。如果你在别处用了字 %MW${Math.max(0, byteNo - 1)} 或 %MW${byteNo}，会直接覆盖掉 ${canonical}！做大项目更推荐建全局 DB 块。`,
        to: '/learn/l04-s7-addressing-tags',
        toLabel: '看第 4 讲：地址与变量表',
      },
    };
    const meta = areaMeta[area];
    return {
      code: canonical,
      tag: meta.name,
      headline: `${canonical} = 第 ${byteNo} 字节 · 第 ${bitNo} 位（1 个开关量 Bool）`,
      parts: [
        { token: '%', meaning: '博途绝对地址前缀' },
        { token: area, meaning: area === 'I' ? 'Input 外部输入' : area === 'Q' ? 'Output 外部输出' : 'Memory 内部标志' },
        { token: `${byteNo}`, meaning: `字节编号（从 0 开始数）` },
        { token: `.${bitNo}`, meaning: `位编号（0~7，满 8 位进 1 字节）` },
      ],
      plainExplain: meta.role,
      pitfall: meta.pitfall,
      relatedTo: { label: meta.toLabel, to: meta.to },
    };
  }

  // 2. 字节 / 字 / 双字地址：%IW64 / %QW80 / %MW10 / %MD20 / %MB5
  const wordMatch = up.match(/^%?([IQM])([BWD])(\d+)$/);
  if (wordMatch) {
    const [, area, size, numStr] = wordMatch;
    const startByte = Number(numStr);
    const canonical = `%${area}${size}${startByte}`;
    const byteLen = size === 'B' ? 1 : size === 'W' ? 2 : 4;
    const endByte = startByte + byteLen - 1;
    const sizeLabel =
      size === 'B' ? '字节 Byte（8 位）' : size === 'W' ? '字 Word/Int（16 位，占 2 字节）' : '双字 DWord/Real（32 位，占 4 字节）';

    const isAnalog = (area === 'I' || area === 'Q') && size === 'W' && startByte >= 64;
    const explain = isAnalog
      ? `S7-1200 的模拟量通道默认从 64 号字节开始编号！${canonical} 占用第 ${startByte}、${endByte} 两个字节（下一个通道是 %${area}W${startByte + 2}）。接 0~10V 或 0/4~20mA 传感器时，PLC 读进来的是 0 ~ 27648 的整数，再用 NORM_X + SCALE_X 换算成真实温度/压力。`
      : `${canonical} 从第 ${startByte} 字节开始，连续占用 ${byteLen} 个字节（覆盖 %${area}B${startByte}${byteLen > 1 ? ` ~ %${area}B${endByte}` : ''}）。常用于存放整数（Int/DInt）或小数（Real，需选 MD）。`;

    const pitfall =
      byteLen > 1
        ? `新手头号大坑【地址重叠】：${canonical} 占用了 ${startByte}~${endByte} 号字节，下一个变量必须从 %${area}${size}${startByte + byteLen} 开始建！千万别建 %${area}${size}${startByte + 1}，否则两个数会互相改乱！`
        : startByte % 2 === 1 && isAnalog
          ? '注意：模拟量通道地址通常是偶数（如 %IW64、%IW66），奇数地址请核对硬件组态！'
          : undefined;

    return {
      code: canonical,
      tag: isAnalog ? '模拟量通道 (16位整数)' : `${area} 区 · ${sizeLabel}`,
      headline: `${canonical}：占用第 ${startByte}${byteLen > 1 ? `~${endByte}` : ''} 字节（共 ${byteLen * 8} 位）`,
      parts: [
        { token: `%${area}`, meaning: area === 'I' ? '输入区' : area === 'Q' ? '输出区' : 'M 内部存储区' },
        { token: size, meaning: sizeLabel },
        { token: `${startByte}`, meaning: `起始字节号（下一个同类型地址应为 %${area}${size}${startByte + byteLen}）` },
      ],
      plainExplain: explain,
      pitfall,
      relatedTo: isAnalog
        ? { label: '去模拟量仿真台亲手拖一下 %IW64', to: '/sim?preset=analog-scale-pid' }
        : { label: '玩“地址重叠互动演示”一眼看懂', to: '/learn/l03b-data-types' },
    };
  }

  // 3. 西门子十六进制常数：16#047E / 16#047F / 16#4000 / 047E / 047F
  const hexMatch = up.match(/^(?:16#|0X)([0-9A-F_]{1,8})$/) || (up.match(/^(047E|047F|04FE|4000)$/) ? [up, up] : null);
  if (hexMatch) {
    const cleanHex = hexMatch[1].replace(/_/g, '');
    const val = parseInt(cleanHex, 16);
    if (!Number.isNaN(val)) {
      const bin16 = val <= 0xffff ? val.toString(2).padStart(16, '0').replace(/(.{4})(?=.)/g, '$1_') : val.toString(2);
      let special = '';
      if (cleanHex === '047E') {
        special = '【变频器经典预备字】Bit10(PLC控制权)=1，Bit1/2(不自由/快速停车)=1，Bit0=0（等待上升沿启动）。';
      } else if (cleanHex === '047F') {
        special = '【变频器经典启动字】比 047E 多了最低位 Bit0=1！从 16#047E 切到 16#047F 产生上升沿，G120/V90 立即合闸旋转！';
      } else if (cleanHex === '4000') {
        special = '【西门子驱动 100% 基准值】十进制正好是 16384，在标准 1 号报文里代表 100% 额定转速（发 16#2000 就是 50% 转速）。';
      }
      return {
        code: `16#${cleanHex}`,
        tag: '西门子十六进制常数',
        headline: `16#${cleanHex} = 十进制 ${val}（二进制 2#${bin16}）`,
        parts: [
          { token: '16#', meaning: '博途十六进制前缀（逢 16 进 1，A~F 代表 10~15）' },
          { token: cleanHex, meaning: `每 1 位十六进制精准对应 4 个开关位（Bit）` },
        ],
        plainExplain: `${special ? `${special} ` : ''}在 PLC 报文通讯、状态掩码里常用 16# 写法，因为一眼能看出哪几个 Bit 是 1，比写十进制 ${val} 直观得多。`,
        relatedTo:
          cleanHex === '047E' || cleanHex === '047F' || cleanHex === '4000'
            ? { label: '去 1 号报文交互实验台逐位点按体验', to: '/capstone?tab=arch' }
            : { label: '看数据类型与进制换算课', to: '/learn/l03b-data-types' },
      };
    }
  }

  // 4. IEC 时间常数：T#3S / T#500MS / T#1M30S
  const timeMatch = up.match(/^T#(?:(\d+)M(?!S))?(?:(\d+)S)?(?:(\d+)MS)?$/);
  if (timeMatch && (timeMatch[1] || timeMatch[2] || timeMatch[3])) {
    const mins = Number(timeMatch[1] || 0);
    const secs = Number(timeMatch[2] || 0);
    const ms = Number(timeMatch[3] || 0);
    const totalMs = mins * 60000 + secs * 1000 + ms;
    return {
      code: q.toUpperCase().replace(/MS$/, 'ms').replace(/S$/, 's'),
      tag: 'IEC 定时器时间设定值 (Time)',
      headline: `共 ${(totalMs / 1000).toFixed(ms ? 2 : 0)} 秒（PLC 内部存为 ${totalMs} 毫秒）`,
      parts: [
        { token: 'T#', meaning: '博途时间常数固定开头' },
        { token: `${totalMs}ms`, meaning: 'TON / TOF / TP 定时器的 PT 管脚直接填这个格式' },
      ],
      plainExplain: '在西门子 S7-1200 的 TON（通电延时）指令里，PT 管脚不用自己算脉冲个数，直接写 T#3s 或 T#500ms 即可，干净直观！',
      relatedTo: { label: '看第 7 讲：TON/TOF/TP 定时器', to: '/learn/l07-iec-timers' },
    };
  }

  // 5. 高频魔术数字与端子名：27648 / 1M / L+ / M
  if (up === '27648' || up === '-27648' || up === '-32768') {
    return {
      code: up,
      tag: '西门子模拟量黄金常数',
      headline:
        up === '-32768'
          ? '-32768 = 模拟量断线/下溢报警典型值'
          : '27648 = 西门子模拟量 100% 满量程额定整数值',
      parts: [
        { token: '0 ~ 27648', meaning: '对应 0~10V 或 0/4~20mA 正常量程（0% ~ 100%）' },
        { token: '< 0 或 32767', meaning: '4~20mA 传感器一旦断线跌到 0mA，数值会变成负数（如 -5530 或 -32768），可用来写断线报警！' },
      ],
      plainExplain: '西门子把 10V / 20mA 额定满量程统一规定为整数 27648（留出 27649~32511 作为超量程缓冲）。用 NORM_X(MIN:=0, MAX:=27648) 就能一键把它变成 0.0~1.0 的比例！',
      relatedTo: { label: '去第 13 讲看模拟量换算公式', to: '/learn/l13-analog-norm-scale' },
    };
  }

  if (up === '1M' || up === '2M' || up === 'L+' || up === 'M') {
    return {
      code: up,
      tag: 'S7-1200 硬件接线端子',
      headline:
        up === 'L+'
          ? 'L+ = 24V 直流电源正极 (+24VDC)'
          : up === 'M'
            ? 'M = 24V 直流电源负极 (0V 参考地)'
            : `${up} = 输入/输出组的公共参考端（决定漏型 PNP 还是源型 NPN！）`,
      parts: [
        { token: '1M 接 M (0V)', meaning: '最主流漏型接法：外部按钮/PNP 传感器送 +24V 进 %I0.x 就能点亮输入灯' },
        { token: '1M 接 L+ (+24V)', meaning: '源型接法：专门配合日系 NPN 传感器（传感器输出 0V 低电平触发）' },
      ],
      plainExplain: '新手最容易犯的错就是：现场只把按钮接到 %I0.0，却忘了给旁边的 1M 端子接线！1M 不接，整排输入点没有回路，按烂按钮 PLC 也收不到信号。',
      relatedTo: { label: '去 S7-1200 硬件接线台亲手接一次 1M', to: '/models?model=s7-1200-wiring' },
    };
  }

  return null;
}
