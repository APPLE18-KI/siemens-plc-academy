import { GLOSSARY } from '../../content/glossary';
import { lessons } from '../../content/curriculum';
import { LECTURES } from '../../content/lectures';

export interface Flashcard {
  id: string;
  kind: '术语' | '小结' | '要点';
  front: string;
  back: string;
  /** 卡片背面可跳转的课程 */
  lessonId?: string;
  order: number;
}

const stripLv = (t: string) => t.replace(/\[\[[\w-]+\|([^\]]+)\]\]/g, '$1');

/** 牌组：术语表 + 每讲一句话小结 + 讲课板书里带重点词的关键句（挖空） */
export function buildDeck(): Flashcard[] {
  const order = new Map(lessons.map((l) => [l.id, l.order]));
  const cards: Flashcard[] = [];
  for (const g of GLOSSARY) {
    cards.push({
      id: `g:${g.id}`,
      kind: '术语',
      front: `“${g.term}”是什么？`,
      back: g.short,
      lessonId: g.lessonId,
      order: (g.lessonId ? order.get(g.lessonId) ?? 50 : 50) * 100 + 1,
    });
  }
  for (const l of lessons) {
    if (l.recap) {
      cards.push({
        id: `r:${l.id}`,
        kind: '小结',
        front: `第 ${l.order} 讲「${l.title}」用一句话说是什么？`,
        back: l.recap,
        lessonId: l.id,
        order: l.order * 100 + 50,
      });
    }
    const script = LECTURES[l.id];
    script?.beats.forEach((b, i) => {
      if (b.board?.kind !== 'line' || !b.board.key) return;
      const text = stripLv(b.board.text);
      if (!/\*\*[^*]+\*\*/.test(text)) return;
      cards.push({
        id: `k:${l.id}:${i}`,
        kind: '要点',
        front: text.replace(/\*\*([^*]+)\*\*/g, (_m, w: string) => `【${'＿'.repeat(Math.min(6, Math.max(2, w.length)))}】`),
        back: text,
        lessonId: l.id,
        order: l.order * 100 + 60 + i,
      });
    });
  }
  return cards.sort((a, b) => a.order - b.order);
}
