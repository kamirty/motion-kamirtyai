import { describe, expect, it } from 'vitest';
import { extractIdeaTopic, initialAssistantState, respond } from '../assistant/engine';
import { KNOWLEDGE } from '../assistant/knowledge';
import type { AssistantContext } from '../assistant/types';

const ctx: AssistantContext = { sceneCount: 8, kinds: ['hero'], aspect: 'landscape', music: 'calm', sfx: true, hasImages: false, exportFormat: 'webm' };
const ask = (q: string) => respond(q, ctx, initialAssistantState).reply;
const answerOf = (id: string) => {
  const e = KNOWLEDGE.find((k) => k.id === id)!;
  return typeof e.answer === 'function' ? e.answer(ctx) : e.answer;
};

describe('assistant routing', () => {
  it.each([
    ['كيف أصدر الفيديو؟', 'export'],
    ['ابي انزل الفيديو mp4', 'export'],
    ['ليش ما يصدر الفيديو عندي في الايفون', 'export-problems'],
    ['كيف اضيف صورة للمشهد؟', 'images'],
    ['ابغى ارفع صوره وادورها', 'images'],
    ['هل الأداة مجانية؟', 'free'],
    ['بكم الاشتراك', 'free'],
    ['هل ترفعون بياناتي على السيرفر؟', 'privacy'],
    ['كيف اغير الخط', 'font'],
    ['ابي ارقام هندية', 'digits'],
    ['كيف اسوي فيديو عمودي للريلز', 'aspect'],
    ['كيف أضيف موسيقى', 'music'],
    ['اقدر اضيف تعليق صوتي بصوتي؟', 'voice'],
    ['كيف اطفي المؤثرات', 'sfx'],
    ['هل الفيديو فيه علامة مائية؟', 'watermark'],
    ['كيف أحفظ المشروع وأفتحه في جهاز اخر', 'save'],
    ['كيف اسوي سؤال اختيار من متعدد للطلاب', 'quiz'],
    ['كيف ارسم دائرة نسب', 'charts'],
    ['كم مدة الفيديو؟ ابي اطول', 'duration'],
    ['ما أنواع المشاهد', 'kinds'],
    ['كيف احذف مشهد', 'scenes-manage'],
    ['الوضع الليلي', 'dark'],
    ['من انت؟', 'ai'],
  ])('%s → %s', (q, id) => {
    expect(ask(q).text).toBe(answerOf(id));
  });

  it('declines unrelated questions', () => {
    for (const q of ['ما عاصمة فرنسا؟', 'اكتب لي قصيدة عن الحب', 'كم سعر الذهب اليوم', 'من فاز بكأس العالم']) {
      const r = ask(q);
      expect(r.text, q).toMatch(/مخصص لمولّد الإنفوجرافيك فقط/);
    }
  });

  it('greets and thanks briefly', () => {
    expect(ask('السلام عليكم').text).toMatch(/أهلًا/);
    expect(ask('شكرا جزيلا').text).toMatch(/العفو/);
  });
});

describe('assistant ideas', () => {
  it('extracts the topic from idea requests in several dialects', () => {
    expect(extractIdeaTopic('أعطني أفكارًا لدرس عن دورة الماء لطلاب الابتدائي')).toBe('دورة الماء');
    expect(extractIdeaTopic('ابي فيديو عن التغذية الصحية')).toBe('التغذية الصحية');
    expect(extractIdeaTopic('اقترح فيديو توعوي عن التنمر')).toBe('التنمر');
    expect(extractIdeaTopic('عايز فيديو عن الذكاء الاصطناعي')).toBe('الذكاء الاصطناعي');
  });

  it('returns three fitting idea outlines with placeholders, never facts', () => {
    const r = ask('أعطني أفكارًا لدرس عن دورة الماء لطلاب الابتدائي');
    expect(r.ideas).toHaveLength(3);
    expect(r.ideas![0].title).toContain('دورة الماء');
    for (const idea of r.ideas!) expect(idea.title + idea.outline).not.toMatch(/دورة دورة|هرم هرم|قصة قصة|تحدي تحدي/);
    for (const idea of r.ideas!) {
      expect(idea.outline).toContain('[');
      expect(idea.outline).toContain('دورة الماء');
    }
  });

  it('pages through more ideas for the same topic', () => {
    const first = respond('أفكار لفيديو عن النوم', ctx, initialAssistantState);
    const more = respond('أعطني أفكارًا أخرى', ctx, first.state);
    expect(more.reply.ideas!.map((i) => i.title)).not.toEqual(first.reply.ideas!.map((i) => i.title));
  });

  it('asks for a topic when none is given', () => {
    expect(ask('اقترح علي أفكار').text).toMatch(/عن أي موضوع/);
  });
});
