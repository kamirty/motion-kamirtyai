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

/**
 * Normalised text padded with one space on each side. Patterns and keys use a leading or trailing
 * space to mark a word boundary, because \b only knows ASCII letters.
 */
const clean = (s: string) => ` ${normalizeArabic(s).replace(/[^\p{L}\p{N}\s%]+/gu, ' ').replace(/\s+/g, ' ').trim()} `;
const normKeys = new Map<string, string>();
/** A knowledge key normalised like the text; a leading/trailing space (word boundary) is kept. */
const nk = (k: string) => {
  let v = normKeys.get(k);
  if (v === undefined) {
    v = `${k.startsWith(' ') ? ' ' : ''}${clean(k).trim()}${k.endsWith(' ') ? ' ' : ''}`;
    normKeys.set(k, v);
  }
  return v;
};
const TOOL_WORDS = TOOL_TERMS.map(nk);
const wordCount = (text: string) => text.trim().split(' ').filter(Boolean).length;

// All patterns below run on clean() text: normalised (أ→ا, ة→ه, ى→ي, ئ→ي, ؤ→و) and space-padded.
const GREETING =
  /^(?:السلام|سلام|مرحب\S*|اهلا\S*|اهلين|هلا|هلاو|يا هلا|هاي|هلو|هالو|صباح|مساء|كيف حالك|كيف الحال|كيفك|شلونك|شخبارك|وش اخبارك|ايش اخبارك|ازيك|عامل ايه|hello|hi|hey)(?: |$)|^(?:عندي )?(?:سوال|استفسار)$|^(?:ابي|ابغي|بدي|ممكن|اريد) اسالك$/;
/** A bare acknowledgement after an answer. */
const ACK = /^(?:تمام|اوكي|اوك|ok|okay|طيب|حسنا|نعم|اي|ايوه|اكيد|لا|لا شكرا|خلاص|فهمت|وصلت)$/;
/** Thanks at the start of the message, optionally after one word ("الله يعطيك العافية", "طيب شكرا"). */
const THANKS = /^(?:\S+ )?(?:شكر|مشكور|يعطيك العافيه|جزاك|تسلم|يسلمو|ميرسي|ممتاز|رائع|احسنت|برافو|كفو|انت ذكي|انت رائع|thanks|thank you|thx)/;
/** "أفكار أخرى", "فكرة ثانية", or a short "غيرها" / "المزيد" right after an idea reply. */
const MORE_IDEAS =
  /(?:افكار|فكره|اقتراحات)\S* (?:اخري|ثانيه|تانيه|غيرها|غير|جديده|زياده|كمان)|^(?:\S+ )?(?:غيرها|غيرهم|المزيد|كمان|بدائل|غير هذي|غير هذه|غير دول|غير هيك)(?: |$)/;

/** A request for video ideas or a video plan. */
const IDEA_INTENT = new RegExp(
  [
    ' افكار', ' فكره', ' اقترح', ' تقترح', ' اقتراحات', ' ساعدني في ', ' ساعدني ب', ' سوي لي ', ' سويلي ', ' اعمل لي ', ' اعملي ',
    ' (?:ابي|ابغي|ابغا|اريد|عايز|عايزه|بدي|ودي|محتاج|محتاجه|حاب|حابه) (?:\\S+ )?(?:فيديو|فديو|مقطع|انفوجرافيك|درس) ',
    ' (?:اكتب|اعطني|عطني|جهز|حضر) لي (?:وصف|نص|سكربت|سكريبت|سيناريو) ',
    ' (?:ب|ل|و)?(?:فيديو|فديو|مقطع|درس|حصه|انفوجرافيك|انفوغرافيك|موضوع|سيناريو|سكربت|سكريبت|محتوي)(?: \\S+){0,3} (?:عن(?! طريق)|حول|بعنوان|يشرح|تشرح|يتكلم عن|يتحدث عن) ',
    ' موضوع لفيديو ', ' موضوع فيديو ', ' هيكل ', ' سيناريو ', ' سكربت ', ' سكريبت ', ' خطه (?:ل)?فيديو ',
  ].join('|'),
);
/** Words that introduce the topic itself: "فيديو عن ...", "درس حول ...", "مقطع يشرح ...". */
const TOPIC_MARK = / (?:عن(?! طريق)|حول|بعنوان|يشرح|تشرح|يوضح|توضح|يتكلم عن|يتحدث عن|يتناول) /;
/** A bare call for help: answered with what the assistant can do. */
const HELP = /^(?:ساعدني|ساعدوني|مساعده|ابي مساعده|احتاج مساعده|ممكن مساعده|help|المساعده|ما فهمت|مافهمت|ما فهمت عليك|ما فهمتك|لم افهم|مش فاهم)$/;
const HOW_TOOL = /(?:كيف|طريقه|وين|اين|هل يمكن|هل استطيع|اقدر|ممكن)\s+(?:اصدر|احفظ|اضيف|احذف|اغير|ارفع|انزل|اكتب الوصف|اعدل)/;

/**
 * Requests this assistant must decline even when they contain a tool word ("ما حكم الموسيقى؟",
 * "كم مدة الحمل؟"): homework, coding, politics, religious rulings, medical advice, jokes and other
 * services. Each stem starts a word, optionally after و/ف/ب/ل/ك and ال.
 */
const OFF_TOPIC_STEMS = [
  // Homework, essays and translation.
  'حل (?:لي|هذا|هذه|هذي|هالمساله|المساله|المسائل|التمرين|التمارين|الواجب|المعادله|السوال|سوال)', 'حلي ', 'احسب', 'اعرب', 'واجب',
  'معادله', 'لخص', 'اشرح لي (?!كيف|طريقه)', 'اكتب لي (?!وصف|نص|سكربت|سكريبت|سيناريو|افكار|فكره)', 'مقال', 'قصيده', 'شعر ',
  'ترجم (?:لي|هذ|ال)',
  'تعبير ',
  // Programming.
  'كود', 'برمج', 'python', 'javascript', 'java ', 'html', 'css', 'sql', 'بايثون', 'جافا', 'خوارزم',
  // Politics.
  'انتخاب', 'رييس(?:ه)? ', 'حزب', 'حرب ', 'حروب', 'حكومه', 'برلمان', 'سياسي',
  // Religious rulings.
  'حكم ', 'حلال', 'حرام', 'يجوز', 'فتوي', 'مفتي', 'شرعا ',
  // Medical advice.
  'علاج', 'دواء', 'دوا ', 'ادويه', 'اعراض', 'صداع', 'حبوب', 'جرعه', 'مضاد حيوي', 'وجع', 'كحه', 'سعال', 'زكام',
  'انفلونزا', 'حمل ', 'حامل', 'ضغط الدم', 'سكري',
  // Growing an account, generating pictures.
  'اربح', 'ربح من', 'ارباح', 'متابعيني', 'زياده المتابعين', 'ازيد متابع', 'ارسم لي (?!رسم|مخطط|دايره|اعمده)',
  // Jokes, news, money, cooking.
  'نكته', 'نكت ', 'ضحكني', 'اضحكني', 'فزوره', 'طقس', 'مباراه', 'دوري ', 'كاس العالم', 'سعر الذهب', 'بيتكوين', 'بورصه', 'سعر الدولار',
  'وصفه ', 'اطبخ', 'طبخ',
];
const wordStart = (stems: string[]) => new RegExp(` (?:و|ف|ب|ل|ك)?(?:ال|لل)?(?:${stems.join('|')})`);
const OFF_TOPIC = wordStart(OFF_TOPIC_STEMS);
/**
 * General-knowledge question shapes ("من هو …", "ما معنى …", "… في العالم"). Declined only when no
 * tool answer matches, since "من هو صاحب الموقع؟" and "ما معنى WebM؟" are fair questions.
 */
const GENERAL_QUESTION = wordStart([
  'عاصمه', 'عدد سكان', 'من هو ', 'من هي ', 'من فاز', 'في العالم ', 'ما معني ', 'شو يعني ', 'وش يعني ', 'ايش يعني ', 'يعني ايه ',
  'متي (?:تاسس|تاسست|ولد|توفي|مات|بدات|بدا|انتهت|انتهي|اكتشف|اخترع|حدث|حدثت|وقعت|كانت|كان|فتحت|فتح|استقلت|استقل)',
]);
/** Words that tie a message to video making, so an off-topic word inside it is part of a topic. */
const TOOL_ANCHOR = /فيديو|فديو|مقطع|انفوجرافيك|انفوغرافيك|مشهد|مشاهد|تصدير|الاداه|المولد|افكار|فكره|سيناريو|سكربت|موشن/;

/** Harakat, superscript alef and tatweel: the marks normalizeArabic drops (not the digits ٠-٩). */
const TASHKEEL = /[\u064B-\u065F\u0670\u0640]/g;
/** Words that make a following "عن ..." the topic of a video request. */
const REQUEST_WORD = /فيديو|فديو|مقطع|درس|حصه|موضوع|افكار|فكره|انفوجرافيك|انفوغرافيك|سيناريو|سكربت|سكريبت|هيكل|خطه|محتوي|اقترح/;
/**
 * A trailing audience ("لطلاب الصف الرابع", "للأطفال", "مناسب للمراهقين"), matched on normalised
 * text. Only plural groups and school years: a singular ("اليوم العالمي للمعلم") is part of the topic.
 */
const AUDIENCE =
  /(?:^|\s+)(?:(?:مناسب|موجه|مخصص)\S*\s+)?(?:لل|ل|الي|مع)\s*(?:طلاب|طالبات|طلبه|اطفال|صغار|متابعين|متابعيني|جمهور|صف|مرحله|معلمين|معلمات|موظفين|موظفات|موظفي|مراهقين|شباب|كبار|اهالي|اولياء|امهات|مرضي|عملاء)(?=\s|$)(?:\s+\S+){0,3}$/;
/** A second clause that is the request itself: "عن البراكين وأبي فيديو", "عن الماء، اعطني أفكار". */
const FOLLOW_UP = /\s+و?(?:ابي|ابغي|ابغا|اريد|بدي|ودي|عايز|عايزه|اعطني|عطني|محتاج|اقترح|ساعدني)(?:\s|$)/;
const GENERIC_TOPIC = /^(?:ال)?(?:فيديو|مقطع|مشهد|موضوع|اداه|انفوجرافيك|هذا|هذه|هذي|ذلك|شي|حاجه)?$/;
const POLITE_TAIL = /\s+(?:لو سمحت|من فضلك|رجاء|please|بليز|يا مساعد)$/;

/** `text` with the first match of `re` (run on its normalised form) cut off. Needs text without tashkeel. */
function cutTail(text: string, re: RegExp): string {
  const m = re.exec(normalizeArabic(text));
  return m ? text.slice(0, m.index) : text;
}

/** Topic from an idea request like "أعطني أفكارًا لدرس عن دورة الماء لطلاب الابتدائي". */
export function extractIdeaTopic(input: string): string {
  // Without tashkeel, normalizeArabic keeps every index, so matches on the normalised copy map back.
  const s = input.replace(TASHKEEL, '').replace(/\s+/g, ' ').trim();
  const n = normalizeArabic(s);
  let t: string | null = null;
  // "… فيديو/درس/أفكار … عن X": X is the topic. A leading "ابحث لي عن …" is skipped.
  const marks = new RegExp(TOPIC_MARK.source, 'g');
  for (let m = marks.exec(n); m; m = marks.exec(n)) {
    if (REQUEST_WORD.test(n.slice(0, m.index))) {
      t = s.slice(m.index + m[0].length);
      break;
    }
  }
  if (t === null) t = peelRequest(s);
  // The topic ends at the first punctuation ("الكسور، أعطني أفكارًا").
  t = t.split(/[،,؛;.!؟?\n]/)[0].trim();
  t = cutTail(cutTail(cutTail(t, FOLLOW_UP), POLITE_TAIL), AUDIENCE).trim();
  // "فيديو لعيد الأم" / "لليوم الوطني": an occasion keeps its own name, not the preposition.
  t = t.replace(/^ل(?=(?:عيد|يوم|مناسب|حفل|احتفال|موسم))/u, '').replace(/^لل(?=(?:عيد|يوم))/u, 'ال');
  // "ساعدني في الفيديو" names no topic.
  if (GENERIC_TOPIC.test(normalizeArabic(t))) return '';
  return t.slice(0, 60);
}

/** Topic of a request without "عن": strips the request words ("ابي افكار لفيديو التغذية" → "التغذية"). */
function peelRequest(input: string): string {
  let t = input.replace(/[؟?!.]+$/u, '').trim();
  t = t.replace(
    /^.*?(?:أفكار|افكار|فكرة|فكره|اقترح|اقتراحات|ساعدني|سوي لي|سويلي|اعمل لي|أبي|ابي|أبغى|ابغى|أريد|اريد|عايز|بدي|ودي|محتاج|خطة|هيكل|سيناريو|سكربت)\S*\s*/u,
    '',
  );
  // Peel leftover pronouns, prepositions, verbs and idea words ("اقترح علي أفكار لفيديو ...").
  for (let i = 0; i < 5; i++) {
    t = t.replace(
      /^(?:لي|لنا|علي|عليّ|عن|حول|ل|لـ|في|ب|بـ|أسوي|اسوي|أعمل|اعمل|أصنع|اصنع|أنشئ|انشئ|أفكار|افكار|أفكارا|افكارا|فكرة|فكره)(?:\s+|$)/u,
      '',
    );
  }
  t = t.replace(/^(?:ل?فيديو|ل?درس|ل?مقطع|ل?إنفوجرافيك|ل?انفوجرافيك|ل?موضوع|ل?حصة)\s*/u, '');
  t = t.replace(/^(?:تعليمي|توعوي|قصير)\s*/u, '');
  t = t.replace(/^(?:عن|حول|يشرح|يتحدث عن|بعنوان)\s+/u, '');
  return t;
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
  if (!raw || HELP.test(text.trim())) return { reply: help(), state };
  const words = wordCount(text);
  const ranked = scoreEntries(text);
  const best = ranked[0];
  const ideaIntent = IDEA_INTENT.test(text) && !HOW_TOOL.test(text);
  // A greeting or thanks that also asks something ("هلا، كيف أصدر؟") is answered as the question.
  const smallTalk = best.score < 3 && !ideaIntent;

  if (smallTalk && GREETING.test(text.trim()) && words <= 6) {
    return {
      reply: { text: 'أهلًا بك! أنا مساعد مولّد الإنفوجرافيك. اسألني عن أي شيء في الأداة، أو اطلب أفكارًا لفيديوك.', suggestions: STARTER_SUGGESTIONS },
      state,
    };
  }
  if (smallTalk && THANKS.test(text.trim()) && words <= 5) {
    return { reply: { text: 'العفو! بالتوفيق في فيديوك 🎬', suggestions: ['أعطني أفكارًا أخرى', 'كيف أصدّر الفيديو؟'] }, state };
  }
  if (state.lastTopic && MORE_IDEAS.test(text.trim()) && words <= 6) {
    const offset = state.ideaOffset + 3;
    return { reply: ideasReply(state.lastTopic, offset), state: { lastTopic: state.lastTopic, ideaOffset: offset } };
  }
  if (smallTalk && ACK.test(text.trim())) {
    return { reply: { text: 'حسنًا! اسألني متى شئت، أو اطلب أفكارًا لفيديو جديد.', suggestions: STARTER_SUGGESTIONS }, state };
  }
  if (!TOOL_ANCHOR.test(text) && (OFF_TOPIC.test(text) || (GENERAL_QUESTION.test(text) && best.score < 3))) return { reply: decline(), state };

  // "ابي فيديو عمودي" asks about the tool; "ابي فيديو عن الصور" asks for ideas about pictures.
  if (ideaIntent && (TOPIC_MARK.test(text) || best.score < 3)) {
    const topic = extractIdeaTopic(raw);
    if (!topic || topic.length < 2) {
      return {
        reply: { text: 'بكل سرور! عن أي موضوع تريد الفيديو؟ اكتب مثلًا: «أفكار لدرس عن الكسور» أو «فيديو عن ترشيد الماء».', suggestions: ['أفكار لدرس عن دورة الماء', 'فيديو عن التغذية الصحية', 'فيديو عن الأمن الرقمي'] },
        state,
      };
    }
    return { reply: ideasReply(topic, 0, raw), state: { lastTopic: topic, ideaOffset: 0 } };
  }

  if (best.score >= 3) {
    const e = best.e;
    const answer = typeof e.answer === 'function' ? e.answer(ctx) : e.answer;
    const runner = ranked[1];
    const suggestions = e.suggestions ?? (runner && runner.score >= 3 ? [] : STARTER_SUGGESTIONS.slice(1, 3));
    return { reply: { text: answer, buttons: e.buttons, suggestions }, state };
  }
  // A tool word, or a short message with a weak clue ("كيف احفظ؟"), is a tool question we did not catch.
  if (TOOL_WORDS.some((t) => text.includes(t)) || (best.score >= 2 && words <= 3)) {
    return {
      reply: {
        text: 'لم أفهم سؤالك تمامًا، لكن أستطيع مساعدتك في: كتابة الوصف، وأنواع المشاهد، والصور، والألوان والخطوط، والصوت، والتصدير، وأفكار الفيديو. جرّب صياغة أخرى أو اختر من الاقتراحات.',
        suggestions: ['ما أنواع المشاهد؟', 'كيف أضيف موسيقى؟', 'كيف أغير الألوان؟', 'أعطني أفكارًا لفيديو'],
      },
      state,
    };
  }
  return { reply: decline(), state };
}

function decline(): AssistantReply {
  return {
    text: 'أنا مساعد مخصص لمولّد الإنفوجرافيك فقط، فلا أستطيع الإجابة عن هذا السؤال. يسعدني مساعدتك في صنع فيديو: اسألني عن الأداة أو اطلب أفكارًا لموضوعك.',
    suggestions: STARTER_SUGGESTIONS,
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
