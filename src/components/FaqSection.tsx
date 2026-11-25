import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, HelpCircle } from 'lucide-react';

interface FaqItem {
  q: string;
  a: React.ReactNode;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    q: '需要先买一台 PLC 吗？',
    a: (
      <>
        不需要。本站所有课程都可以用网页里的仿真器完成。想写真实程序时，在电脑上安装 TIA Portal 和
        S7-PLCSIM 就能在虚拟 PLC 上运行；真实硬件建议学完第 2 章、确定要深入时再买。
      </>
    ),
  },
  {
    q: '电脑上要装什么软件？',
    a: (
      <>
        TIA Portal（博途）STEP 7 Basic 或 Professional，加上 S7-PLCSIM，版本建议 V17 或更新。博途只支持
        Windows 64 位系统，建议 16GB 内存和固态硬盘。详见
        <Link to="/learn/l00-before-you-start"> 第 0 讲：开始之前</Link>。
      </>
    ),
  },
  {
    q: '学着学着卡住了怎么办？',
    a: (
      <>
        先打开 <Link to="/glossary">术语表</Link> 查一下看不懂的词；再回到这一讲的仿真器，用“单步扫描”慢慢看每一步哪里变绿；测验做错时，展开解析看原因。仍然想不通，可以先跳到下一讲，很多概念在后面的例子里会更好懂。
      </>
    ),
  },
  {
    q: '我的学习进度为什么没了？',
    a: (
      <>
        进度只保存在当前设备的这个浏览器（或本 App）里，没有云端账号。换浏览器、换设备、清除浏览器缓存或网站数据、使用无痕模式，或者清除 App 数据，都会让进度消失。
      </>
    ),
  },
  {
    q: '网页仿真和真实博途一样吗？',
    a: (
      <>
        不一样。网页仿真是简化的教学版，只支持常用指令，没有硬件组态、下载和在线诊断。它适合理解逻辑，真正的项目请在 TIA Portal 中完成。
      </>
    ),
  },
];

export const FaqSection: React.FC<{ id?: string; compact?: boolean }> = ({ id = 'faq', compact }) => {
  const [openIdx, setOpenIdx] = useState<number | null>(compact ? null : 0);

  return (
    <section className="faq-section" id={id} aria-labelledby={`${id}-title`}>
      <h2 className="section-title faq-title" id={`${id}-title`}>
        <HelpCircle size={20} color="var(--siemens-teal-bright)" />
        常见问题
      </h2>
      <div className="faq-list">
        {FAQ_ITEMS.map((item, idx) => {
          const open = openIdx === idx;
          return (
            <div key={item.q} className={`faq-item${open ? ' open' : ''}`}>
              <button
                type="button"
                className="faq-q"
                aria-expanded={open}
                aria-controls={`${id}-a-${idx}`}
                onClick={() => setOpenIdx(open ? null : idx)}
              >
                <span>{item.q}</span>
                <ChevronDown size={18} className="faq-chevron" aria-hidden="true" />
              </button>
              {open && (
                <div className="faq-a" id={`${id}-a-${idx}`}>
                  {item.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
