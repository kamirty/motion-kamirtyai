import { normalizeArabic } from '../design/arabic';
import { suggestIdeas } from './ideas';
import { KNOWLEDGE, TOOL_TERMS } from './knowledge';
import type { AssistantContext, AssistantReply } from './types';

/**
 * Rule-based assistant that runs entirely in the browser: answers questions about the tool from
 * a curated knowledge base and proposes video structures. It declines unrelated questions.
 */

export interface AssistantState {
  lastTopic: string | null;
  ideaOffset: number;
}

export const initialAssistantState: AssistantState = { lastTopic: null, ideaOffset: 0 };

export const STARTER_SUGGESTIONS = ['أعطني أفكارًا لدرس عن دورة الماء', 'كيف أكتب وصفًا جيدًا؟', 'كيف أضيف صورة؟', 'كيف أصدّر الفيديو؟'];

const clean = (s: string) => ` ${normalizeArabic(s).replace(/[^\p{L}\p{N}\s%]+/gu, ' ').replace(/\s+/g, ' ').trim()} `;
const normKeys = new Map<string, string>();
const nk = (k: string) => {
  let v = normKeys.get(k);
  if (v === undefined) {
    v = clean(k).trim();
    normKeys.set(k, v);
  }
  return v;
};

const GREETING = /^\s*(?:السلام|سلام|مرحب|اهلا|هلا|هاي|صباح|مساء|hello|hi)(?:\s|$)/;
const THANKS = /(?:شكرا|شكر|مشكور|يعطيك العافيه|جزاك|تسلم|ممتاز|رائع)/;
const MORE_IDEAS = /(?:افكار اخري|غيرها|المزيد|فكره اخري|اقتراحات اخري|غير هذي|غير هذه|بدائل)/;
// Texts are padded with spaces by clean(), so a trailing space marks a word end (\b is ASCII-only).
const IDEA_INTENT = /(?: افكار| فكره| اقترح| اقتراح| ساعدني في | ساعدني ب| سوي لي | ابي فيديو | ابغي فيديو | اريد فيديو | عايز فيديو | بدي فيديو | ودي فيديو | درس عن | فيديو عن | فيديو حول | موضوع عن | موضوع لفيديو | هيكل | سيناريو | خطه فيديو )/;
const HOW_TOOL = /(?:كيف|طريقه|وين|اين|هل يمكن|هل استطيع|اقدر|ممكن)\s+(?:اصدر|احفظ|اضيف|احذف|اغير|ارفع|انزل|اكتب الوصف|اعدل)/;

/** Topic from an idea request like "أعطني أفكارًا لدرس عن دورة الماء لطلاب الابتدائي". */
export function extractIdeaTopic(input: string): string {
  let t = input.replace(/[؟?!.]+$/u, '').trim();
  t = t.replace(
    /^.*?(?:أفكار|افكار|فكرة|فكره|اقترح|اقتراح|ساعدني|سوي لي|أبي|ابي|أبغى|ابغى|أريد|اريد|عايز|بدي|ودي|خطة|هيكل|سيناريو)\S*\s*/u,
    '',
  );
  // Peel leftover pronouns, prepositions and idea words ("اقترح علي أفكار لفيديو عن ...").
  for (let i = 0; i < 4; i++) {
    t = t.replace(/^(?:لي|لنا|علي|عليّ|عن|حول|ل|لـ|في|ب|بـ|أفكار|افكار|أفكارا|أفكارًا|افكارا|فكرة|فكره|فكرةً)(?:\s+|$)/u, '');
  }
  t = t.replace(/^(?:ل?فيديو|ل?درس|ل?مقطع|ل?إنفوجرافيك|ل?انفوجرافيك|ل?موضوع|ل?حصة)\s*/u, '');
  t = t.replace(/^(?:تعليمي|توعوي|قصير)\s*/u, '');
  t = t.replace(/^(?:عن|حول|يشرح|يتحدث عن|بعنوان)\s+/u, '');
  // Drop a trailing audience phrase; it guides the choice but is not part of the topic.
  t = t.replace(/\s+(?:ل|لـ)(?:طلاب|الطلاب|طلبة|أطفال|الأطفال|اطفال|متابعين|المتابعين|جمهور|الصف|المرحلة)\S*(?:\s+\S+){0,3}$/u, '');
  return t.trim().slice(0, 60);
}

function scoreEntries(text: string) {
  return KNOWLEDGE.map((e) => {
    let score = 0;
    for (const [k, w] of Object.entries(e.keys)) if (text.includes(nk(k))) score += w;
    return { e, score };
  }).sort((a, b) => b.score - a.score);
}

export function respond(input: string, ctx: AssistantContext, state: AssistantState): { reply: AssistantReply; state: AssistantState } {
  const text = clean(input);
  const raw = input.trim();
  if (!raw) return { reply: help(), state };

  if (GREETING.test(text.trim()) && text.trim().split(' ').length <= 4) {
    return {
      reply: { text: 'أهلًا بك! أنا مساعد مولّد الإنفوجرافيك. اسألني عن أي شيء في الأداة، أو اطلب أفكارًا لفيديوك.', suggestions: STARTER_SUGGESTIONS },
      state,
    };
  }
  if (THANKS.test(text) && text.trim().split(' ').length <= 5) {
    return { reply: { text: 'العفو! بالتوفيق في فيديوك 🎬', suggestions: ['أعطني أفكارًا أخرى', 'كيف أصدّر الفيديو؟'] }, state };
  }
  if (MORE_IDEAS.test(text) && state.lastTopic) {
    const offset = state.ideaOffset + 3;
    return { reply: ideasReply(state.lastTopic, offset), state: { lastTopic: state.lastTopic, ideaOffset: offset } };
  }
  if (IDEA_INTENT.test(text) && !HOW_TOOL.test(text)) {
    const topic = extractIdeaTopic(raw);
    if (!topic || topic.length < 2) {
      return {
        reply: { text: 'بكل سرور! عن أي موضوع تريد الفيديو؟ اكتب مثلًا: «أفكار لدرس عن الكسور» أو «فيديو عن ترشيد الماء».', suggestions: ['أفكار لدرس عن دورة الماء', 'فيديو عن التغذية الصحية', 'فيديو عن الأمن الرقمي'] },
        state,
      };
    }
    return { reply: ideasReply(`${topic}`, 0, raw), state: { lastTopic: topic, ideaOffset: 0 } };
  }

  const ranked = scoreEntries(text);
  const best = ranked[0];
  if (best && best.score >= 3) {
    const e = best.e;
    const answer = typeof e.answer === 'function' ? e.answer(ctx) : e.answer;
    const runner = ranked[1];
    const suggestions = e.suggestions ?? (runner && runner.score >= 3 ? [] : STARTER_SUGGESTIONS.slice(1, 3));
    return { reply: { text: answer, buttons: e.buttons, suggestions }, state };
  }
  if (TOOL_TERMS.some((t) => text.includes(t))) {
    return {
      reply: {
        text: 'لم أفهم سؤالك تمامًا، لكن أستطيع مساعدتك في: كتابة الوصف، وأنواع المشاهد، والصور، والألوان والخطوط، والصوت، والتصدير، وأفكار الفيديو. جرّب صياغة أخرى أو اختر من الاقتراحات.',
        suggestions: ['ما أنواع المشاهد؟', 'كيف أضيف موسيقى؟', 'كيف أغير الألوان؟', 'أعطني أفكارًا لفيديو'],
      },
      state,
    };
  }
  return {
    reply: {
      text: 'أنا مساعد مخصص لمولّد الإنفوجرافيك فقط، فلا أستطيع الإجابة عن هذا السؤال. يسعدني مساعدتك في صنع فيديو: اسألني عن الأداة أو اطلب أفكارًا لموضوعك.',
      suggestions: STARTER_SUGGESTIONS,
    },
    state,
  };
}

function help(): AssistantReply {
  return {
    text: `أستطيع مساعدتك في:
• فهم الأداة: الوصف، والمشاهد، والصور، والصوت، والألوان، والتصدير.
• اقتراح أفكار وهياكل جاهزة لفيديوك تملؤها بمعلوماتك.`,
    suggestions: STARTER_SUGGESTIONS,
  };
}

function ideasReply(topic: string, offset: number, raw = ''): AssistantReply {
  const ideas = suggestIdeas(topic, offset, 3, raw);
  return {
    text: `إليك ${ideas.length === 3 ? 'ثلاث أفكار' : 'أفكارًا'} لفيديو عن «${topic}». اختر فكرة لتوضع في خانة الوصف، ثم استبدل ما بين [الأقواس] والأصفار بمعلوماتك الصحيحة واضغط «أنشئ».`,
    ideas,
    suggestions: ['أعطني أفكارًا أخرى', 'كيف أكتب وصفًا جيدًا؟'],
  };
}
