import React, { useMemo, useState } from 'react';
import { CheckCircle2, Circle, MessageSquareText, Sparkles } from 'lucide-react';
import { LECTURES } from '../../content/lectures';
import { saveExplain, useStudy } from './studyStore';
import { haptic } from '../../app/native/platform';

const stripLv = (t: string) => t.replace(/\[\[[\w-]+\|([^\]]+)\]\]/g, '$1');

/**
 * PLC 初学者大白话同义词簇：
 * 新手常会用口语（如“读输入”“拉闸停电”“平时通按下断”“松手还亮”）来解释概念，
 * 避免因未命中精确术语而误判为 0 分打击信心。
 */
const SYNONYM_CLUSTERS: string[][] = [
  ['输入', '读输入', '采样', '按钮', '传感器', '开关', '24v', 'pii', '映像输入', '%i', 'i0'],
  ['程序', '算程序', '判断', '逻辑', '规则', '计算', 'ob1', '梯形图', '指令'],
  ['输出', '写输出', '控制', '驱动', '执行', '指示灯', '接触器', '电机', '气缸', '灯', 'piq', '%q', 'q0'],
  ['断电', '停电', '拉闸', '先断电', '不带电', '切电', '电源关', '安全'],
  ['常闭', 'nc', '平时接通', '平时闭合', '正常通', '按下断开', '按断', '断线安全', '停止', '急停'],
  ['常开', 'no', '平时断开', '按下接通', '按通', '启动按钮'],
  ['自锁', '保持', '并联', '松手还亮', '松开继续', '一直亮', '一直转', '起保停', '拉住'],
  ['点动', '按住才', '松手就停', '松开就灭', '不自锁'],
  ['停止优先', '停机优先', 'rs', '复位优先', '卡死', '主干道'],
  ['互锁', '正反转', '不能同时', '防短路', '相间短路', '互斥'],
  ['边沿', '上升沿', '下降沿', 'p_trig', 'n_trig', '只算一次', '单周期', '脉冲'],
  ['扫描', '循环', '周期', '从上到下', '一轮一轮', '周而复始'],
  ['双线圈', '覆盖', '重复写', '重复赋值', '最后一个', '只写一处'],
  ['定时', '延时', 'ton', 'tof', 'tp', '接通延时', '断开延时', '倒计时', 'pt', 'et'],
  ['计数', 'ctu', 'ctd', '次数', 'pv', 'cv', '满件', '清零', '复位'],
  ['pnp', 'npn', '1m', '公共端', '电位差', '源型', '漏型', '光耦'],
  ['地址', '符号', '字节', '字', '双字', '重叠', '%mw', '%mb', '%md', '变量表'],
  ['fc', 'fb', '背景db', '实例', '记忆', '复用', '功能块', '函数'],
  ['udt', '结构体', '全局db', '打包', '配方', '数据类型'],
  ['状态机', 'case', '步', '顺序', '步骤', 'grafcet', 'packml'],
  ['模拟量', 'norm_x', 'scale_x', '归一化', '缩放', '27648', '4-20ma', '工程量', '%iw'],
  ['pid', '闭环', 'ob30', '循环中断', '采样周期', '设定值', '反馈', '无扰切换'],
  ['profinet', '设备名', 'ip', '组态', '通信', '通讯', '报文'],
  ['博途', 'tia', 'plcsim', '仿真', '下载', '监视', '监控表', '强制表', '诊断缓冲区'],
];

const STOP_SEGMENTS = new Set([
  '就是', '不是', '可以', '必须', '应该', '一般', '时候', '用来', '通过', '因为', '所以', '如果', '然后', '或者', '以及',
  '一个', '这个', '那个', '它们', '我们', '自己', '需要', '进行', '表示', '决定', '变成', '以后', '之前', '之后', '里面',
]);

function normalizeText(raw: string): string {
  return raw.replace(/[\s，。、；：！？""''（）()【】[\]—\-·,.!?:;]/g, '').toLowerCase();
}

function expandConceptTerms(words: string[], fullText: string): string[] {
  const expanded = new Set<string>();
  const addWithSynonyms = (term: string) => {
    const n = normalizeText(term);
    if (n.length < 2) return;
    expanded.add(n);
    for (const cluster of SYNONYM_CLUSTERS) {
      if (cluster.some((c) => n.includes(c) || c.includes(n))) {
        for (const c of cluster) expanded.add(c);
      }
    }
  };

  for (const w of words) addWithSynonyms(w);

  // 同时扫一遍整句关键点本身，把命中的核心概念簇也纳入（防止某条要点加粗词极少）
  const normLine = normalizeText(fullText);
  for (const cluster of SYNONYM_CLUSTERS) {
    if (cluster.some((c) => normLine.includes(c))) {
      for (const c of cluster) expanded.add(c);
    }
  }
  return Array.from(expanded);
}

/** 计算自然语言短语重叠度，给大白话表达兜底 */
function hasPhraseOverlap(userNorm: string, pointNorm: string): boolean {
  if (userNorm.length < 6 || pointNorm.length < 4) return false;
  let hits = 0;
  const seen = new Set<string>();
  for (let i = 0; i <= pointNorm.length - 2; i++) {
    const bg = pointNorm.slice(i, i + 2);
    if (seen.has(bg) || STOP_SEGMENTS.has(bg)) continue;
    if (/^[a-z0-9\u4e00-\u9fa5]{2}$/.test(bg) && userNorm.includes(bg)) {
      seen.add(bg);
      hits += 1;
      if (hits >= 2) return true;
    }
  }
  return false;
}

interface CheckPointItem {
  text: string;
  words: string[];
  expandedTerms: string[];
  normLine: string;
}

/** 关键点 = 讲课板书里的关键句；关键词 = 句中加粗的词 + 同义概念簇 */
function checklist(lessonId: string): CheckPointItem[] {
  const s = LECTURES[lessonId];
  if (!s) return [];
  return s.beats
    .filter((b) => b.board?.kind === 'line' && b.board.key)
    .map((b) => {
      const raw = stripLv((b.board as { text: string }).text);
      const words = [...raw.matchAll(/\*\*([^*]+)\*\*/g)].flatMap((m) =>
        m[1].split(/[，、,\s/]+/).filter((w) => w.length >= 2),
      );
      const text = raw.replace(/\*\*/g, '');
      return {
        text,
        words,
        expandedTerms: expandConceptTerms(words, text),
        normLine: normalizeText(text),
      };
    });
}

/**
 * “用自己的话解释”（费曼自查 v3.2）：
 * 支持大白话同义词识别 + 自然短语匹配 + 一键手动勾选对照。
 */
export const ExplainBack: React.FC<{ lessonId: string; lessonTitle: string; compact?: boolean }> = ({
  lessonId,
  lessonTitle,
  compact,
}) => {
  const st = useStudy();
  const saved = st.explains[lessonId];
  const [text, setText] = useState(saved?.text ?? '');
  const [checking, setChecking] = useState(Boolean(saved));
  const [marks, setMarks] = useState<string[]>(saved?.selfChecked ?? []);
  const items = useMemo(() => checklist(lessonId), [lessonId]);
  if (!items.length) return null;

  const norm = normalizeText(text);
  const hit = (item: CheckPointItem): boolean => {
    if (norm.length < 4) return false;
    if (item.expandedTerms.some((t) => t.length >= 2 && norm.includes(t))) return true;
    return hasPhraseOverlap(norm, item.normLine);
  };
  const autoHits = items.map((it) => hit(it));
  const covered = items.filter((_it, i) => marks.includes(String(i)) || autoHits[i]).length;

  return (
    <section className={`explain-card${compact ? ' is-compact' : ''}`} aria-label="用自己的话解释">
      <header className="explain-head">
        <MessageSquareText size={17} />
        <div>
          <h3>用自己的话讲一遍</h3>
          <p>假装给没学过 PLC 的朋友讲「{lessonTitle}」。不用背标准词，大白话讲明白就行。</p>
        </div>
      </header>
      <textarea
        className="explain-input"
        value={text}
        rows={compact ? 4 : 5}
        placeholder="用大白话写下你记住的要点，例如：PLC先读按钮输入再算程序最后控制灯；接线前一定先断电……"
        onChange={(e) => setText(e.target.value)}
        aria-label="你的解释"
      />
      <div className="explain-actions">
        <span className="explain-count">{text.trim().length} 字</span>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={text.trim().length < 8}
          onClick={() => {
            haptic('tap');
            setChecking(true);
            saveExplain(lessonId, text, marks);
          }}
        >
          <Sparkles size={14} />
          对照关键点检查
        </button>
      </div>
      {checking && (
        <div className="explain-check" role="status">
          <div className="explain-score">
            已覆盖 <b>{covered}</b> / {items.length} 个核心要点
            {covered === items.length
              ? ' — 讲得很完整，理解到位！'
              : covered > 0
                ? ' — 不错的开始！剩下的要点如果用别的说法提到了，可直接点一下自评打勾。'
                : ' — 系统按关键词暂未自动匹配到，请对照下方要点自查；你用大白话讲到了的，直接点一下即可打勾。'}
          </div>
          <ul>
            {items.map((it, i) => {
              const auto = autoHits[i];
              const on = auto || marks.includes(String(i));
              return (
                <li key={i} className={on ? 'on' : ''}>
                  <button
                    type="button"
                    onClick={() => {
                      if (auto) return;
                      haptic('tap');
                      const next = marks.includes(String(i))
                        ? marks.filter((m) => m !== String(i))
                        : [...marks, String(i)];
                      setMarks(next);
                      saveExplain(lessonId, text, next);
                    }}
                    aria-pressed={on}
                    aria-label={`${it.text}${auto ? '（已智能识别讲到）' : '（点一下标记为我已讲到）'}`}
                  >
                    {on ? <CheckCircle2 size={17} /> : <Circle size={17} />}
                    <span>{it.text}</span>
                    {auto ? <em>智能识别已讲到</em> : on ? <em>自评已讲到</em> : null}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="explain-hint">
            支持大白话与同义表达识别；费曼自查没有“扣分”，只要你自己确认讲清楚了，点击条目即可打勾。
          </p>
        </div>
      )}
    </section>
  );
};
