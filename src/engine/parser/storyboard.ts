import { normalizeArabic } from '../../design/arabic';
import { KIND_ICONS, suggestIcon } from '../../design/icons';
import { LIMITS, type SceneKind } from '../../domain/types';
import { toNumber, valueRow } from '../sceneModel';
import {
  LABEL_VALUE, NUMERIC_EVENT, RATIO_RE, STAT_RE, YEAR_LINE, chapterHeading, chunkText, clampWords, extractTopic,
  isListLine, leadMark, optionLabel, splitSentences, stripMarker, trimPunct,
} from './text';

export interface DraftScene {
  kind: SceneKind;
  title: string;
  items: string[];
  icon: string;
  /** Relative screen time; converted to frames by the planner. */
  weight: number;
}

export interface Storyboard {
  title: string;
  scenes: DraftScene[];
  /** True when the description was too thin and guide scenes with placeholder text were added. */
  usedPlaceholders: boolean;
}

interface ListBlock {
  type: 'list';
  items: string[];
  /** The original lines, index-aligned with items, so bullets and ✓/✗ marks can still be read. */
  raw: string[];
  ordered: boolean;
  heading?: string;
  /** Title of the section heading right before a list without its own heading. */
  hint?: string;
}

interface SentenceBlock {
  type: 'sentence';
  text: string;
}

type Block =
  | ListBlock
  | SentenceBlock
  | { type: 'years'; items: string[] }
  | { type: 'bars'; items: string[]; heading?: string; years?: boolean }
  | { type: 'chapter'; title: string };

const MAX_ITEM = LIMITS.itemChars;
const QUOTE_RE = /[«"“]([^«»"“”]{8,})[»"”]\s*(?:[-–—]\s*([^.\n]{2,60}))?/u;
const COMPARE_SPLIT = /\s+(?:بينما|مقابل|في حين|أما|vs\.?|versus)\s+/iu;
const WARNING_RE = /(?:^|\s)(?:تحذير|احذر|احذروا|تجنب|تجنّب|انتبه|خطر|ممنوع|لا\s+ت)/u;
const STEPS_HINT = /(?:خطوات|خطوة|مراحل|طريقة|طرق|كيف|نصائح|إرشادات|ارشادات|قواعد)/u;
const ORDERED_MARKER = /^\s*\(?[0-9٠-٩]{1,2}\s*[.)\-–:]/;
const isQuestion = (t: string) => /[؟?]\s*$/.test(t);

// Tips: "هل تعلم أن …؟" and "نصيحة: …" (also "نصيحة اليوم: …").
const DID_YOU_KNOW = /^هل\s+تعلم(?:ين|ون)?(?![\p{L}])\s*[؟?!:：،,]?\s*/u;
const ADVICE = /^(نصيحة(?:\s+[^\s:：.،؟?!]+){0,2})\s*(?:[:：\-–—]\s*|$)/u;
const SOURCE_NOTE = /^(?:المصدر|مصدر|المرجع|source)\s*[:：]/iu;

// Definitions: "ما هو X؟", "ما معنى X؟", "ما المقصود بـX؟", "تعريف X: …".
const DEF_QUESTION = /^(?:ما|ماذا)\s+(?:هو|هي|هى|معنى|يعني|تعني|المقصود\s+بـ?)\s*(.{2,40}?)\s*[؟?]\s*$/u;
const DEF_COLON = /^تعريف\s+([^:：]{2,40}?)\s*[:：]\s*(.*)$/u;
/** Questions about lists or amounts rather than the meaning of a term. */
const NOT_A_TERM = /^(?:ال)?(?:فوائد|اسباب|انواع|اضرار|مزايا|عيوب|خطوات|طرق|اهم|ابرز|افضل|اكثر|اكبر|اصغر|اقل|عدد|نسبه|كميه|الفرق|علاقه|دور|اهميه|مراحل|مكونات|خصائص)(?![\p{L}])/u;
const EXAMPLES_HEAD = /^(?:و)?(?:من\s+)?(?:ال)?(?:امثل|مثال|مثل|انواع|اشكال|نماذج)/u;
const EXAMPLES_TAIL = /[\s،,]*(?:و)?(?:من\s+)?(?:ال)?(?:[أا]مثل[ةته]\S*|مثال|مثل|منها|[أا]نواع\S*|[أا]شكال\S*)(?:\s+(?:على\s+)?(?:ذلك|عليها|عليه))?\s*$/u;

// Quiz answers: "الإجابة: ب" or "الإجابة الصحيحة: المشتري".
const ANSWER_LINE = /^(?:ال)?(?:اجابه|جواب|حل)(?:\s+(?:ال)?صحيحه)?\s*[:：\-–—]\s*(.+?)[\s.]*$/u;
const QUESTION_HEADING = /(?:[؟?]$|^(?:أي|أيّ|اي|ما|ماذا|كم|من|متى|أين|اين|هل|لماذا|كيف)\s|اختر|اختاري)/u;

// List headings that pick a scene kind (matched on the original text).
const CYCLE_HEAD = /(?:^|[\s(])[وبلف]?(?:ال)?دورة(?!\s+(?:ال)?(?:تدريبية|مياه|دراسية|تعليمية|رياضية|ألعاب))(?=$|[\s:：،,؟?)])/u;
const PYRAMID_HEAD = /(?:^|[\s(])[وبلف]?(?:ال)?(?:هرم(?:ي|ية)?|مستويات|أولويات|اولويات)(?:ه|ها|هم)?(?=$|[\s:：،,؟?)])/u;
// Checklist and pros/cons headings are matched on normalised text (أ→ا, ة→ه, ئ→ي).
const CHECKLIST_HEAD = /قايمه|تحقق|تاكد|تجهيز|(?:^|\s)جهز|check\s*list/iu;
const PRO_HEAD = /(?:^|[\s(])[وف]?(?:ال)?(?:مزايا|ميزات|مميزات|ايجابيات|محاسن|فوايد|افعل)(?:ه|ها|هم)?(?=$|[\s:：،,؟?)])|ما\s+يجب\s+فعله/u;
const CON_HEAD = /(?:^|[\s(])[وف]?(?:ال)?(?:عيوب|سلبيات|مساوي|اضرار|مخاطر)(?:ه|ها|هم)?(?=$|[\s:：،,؟?)])|لا\s+تفعل|ما\s+يجب\s+تجنبه/u;
/** Item starts that sceneModel.prosCons reads as a con. */
const CON_START = /^\s*(?:✗|✘|×|❌|-|−|–|لا\s)/u;

const CHECK_LEADS = new Set(['☐', '☑', '☒', '✓', '✔', '✅']);
const PRO_LEADS = new Set(['✓', '✔', '✅', '+']);
const CON_LEADS = new Set(['✗', '✘', '×', '❌']);
const ANSWER_LEADS = new Set(['✓', '✔', '✅', '*']);
const ANSWER_MARKS = /\s*[✓✔✅*]\s*/gu;

const YEAR_LABEL = /^(?:عام|سنة)?\s*(?:(?:1[0-9]|20|21)[0-9]{2}|[١][٠-٩]{3}|[٢][٠١][٠-٩]{2})\s*(?:م|هـ)?$/u;
const KPI_MAX_CHARS = 70;

const fold = (s: string) => normalizeArabic(s).replace(/[^\p{L}\p{N}%٪]+/gu, '');

/** Groups the description into list, year, bar, chapter and sentence blocks, keeping a list's heading line. */
function toBlocks(body: string): Block[] {
  const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
  const headings = lines.map(chapterHeading);
  const blocks: Block[] = [];
  // A short sentence ending with ":" right before a list is its heading.
  const takeHeading = (): string | undefined => {
    const prev = blocks[blocks.length - 1];
    if (prev?.type === 'sentence' && /[:：]\s*$/.test(prev.text) && prev.text.length <= 90) {
      blocks.pop();
      return trimPunct(prev.text);
    }
    return undefined;
  };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // A lone heading line followed by more content opens a section. Runs of heading-like lines
    // ("أولًا: … / ثانيًا: …") are points, not sections, and stay ordinary text.
    const chapter = headings[i];
    if (chapter && i + 1 < lines.length && !headings[i + 1] && !headings[i - 1]) {
      blocks.push({ type: 'chapter', title: chapter });
      i++;
      continue;
    }
    if (YEAR_LINE.test(line)) {
      const items: string[] = [];
      const events: string[] = [];
      while (i < lines.length && YEAR_LINE.test(lines[i])) {
        const m = YEAR_LINE.exec(lines[i])!;
        events.push(trimPunct(m[2]));
        items.push(`${m[1]}: ${trimPunct(m[2])}`);
        i++;
      }
      // "2020: 45 مليون" lines are a column chart over the years, not a timeline of events.
      if (items.length >= 2 && events.every((e) => NUMERIC_EVENT.test(e))) blocks.push({ type: 'bars', items, heading: takeHeading(), years: true });
      else blocks.push({ type: 'years', items });
      continue;
    }
    if (isListLine(line)) {
      const lineRaw: string[] = [];
      while (i < lines.length && isListLine(lines[i])) lineRaw.push(lines[i++]);
      const kept = lineRaw.map((r) => ({ r, text: stripMarker(r) })).filter((e) => e.text);
      const items = kept.map((e) => e.text);
      const raw = kept.map((e) => e.r);
      const heading = takeHeading();
      const prev = blocks[blocks.length - 1];
      const hint = !heading && prev?.type === 'chapter' ? prev.title : undefined;
      const bars = items.filter((it) => LABEL_VALUE.test(it));
      if (bars.length >= 2 && bars.length === items.length) blocks.push({ type: 'bars', items, heading: heading ?? hint });
      else if (items.length) blocks.push({ type: 'list', items, raw, ordered: raw.some((r) => ORDERED_MARKER.test(r)), heading, hint });
      continue;
    }
    for (const s of splitSentences(line.replace(/^#{1,6}\s+/, ''))) blocks.push({ type: 'sentence', text: s });
    i++;
  }
  return blocks;
}

const statHeadings = ['بالأرقام', 'هل تعلم؟', 'رقم مهم', 'حقيقة لافتة'];
const kpiHeadings = ['بالأرقام', 'أرقام سريعة', 'حقائق بالأرقام'];
const summaryHeadings = ['نقاط رئيسية', 'معلومات مهمة', 'تعرّف أكثر', 'باختصار'];

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Splits `n` items into the fewest groups of at most `max`, as evenly as possible (7 → 4 + 3). */
function balancedGroups<T>(arr: T[], max: number): T[][] {
  const groups = Math.ceil(arr.length / max);
  const out: T[][] = [];
  let start = 0;
  for (let g = 0; g < groups; g++) {
    const size = Math.floor(arr.length / groups) + (g < arr.length % groups ? 1 : 0);
    out.push(arr.slice(start, start + size));
    start += size;
  }
  return out;
}

/** The value a stat scene shows for this sentence, or null when it has no meaningful number. */
function statValue(text: string): string | null {
  const stat = STAT_RE.exec(text);
  if (!stat) return null;
  const isYearOnly = !stat[2] && /^[0-9٠-٩]{4}$/.test(stat[1]);
  if (isYearOnly || !(stat[2] || Number(stat[1].replace(/[^\d]/g, '')) >= 10 || /[٠-٩]/.test(stat[1]))) return null;
  return `${stat[1]}${stat[2] === '%' || stat[2] === '٪' ? stat[2] : stat[2] ? ` ${stat[2]}` : ''}`;
}

/** "7 من كل 10" as written, when it is a small whole-number ratio a pictogram can draw. */
function ratioOf(text: string): string | null {
  const m = RATIO_RE.exec(text);
  if (!m) return null;
  const part = toNumber(m[1]);
  const whole = toNumber(m[2]);
  if (part === null || whole === null || !Number.isInteger(whole)) return null;
  return part >= 1 && whole >= 2 && whole <= 100 && part <= whole ? m[0] : null;
}

type SentenceKind = 'tip' | 'quote' | 'definition' | 'question' | 'comparison' | 'pictogram' | 'stat' | 'warning' | 'plain';

/** What a sentence becomes on its own, before looking at its neighbours. */
function sentenceKind(text: string): SentenceKind {
  if (DID_YOU_KNOW.test(text) || ADVICE.test(text)) return 'tip';
  if (QUOTE_RE.test(text)) return 'quote';
  if (DEF_COLON.test(text)) return 'definition';
  if (isQuestion(text)) return 'question';
  const sides = text.split(COMPARE_SPLIT);
  if (sides.length === 2 && sides.every((s) => s.length >= 4)) return 'comparison';
  if (ratioOf(text)) return 'pictogram';
  if (statValue(text)) return WARNING_RE.test(text) ? 'warning' : 'stat';
  return WARNING_RE.test(text) ? 'warning' : 'plain';
}

/** Short non-warning stat sentences can share one KPI scene. */
const isKpi = (b: Block | undefined): b is SentenceBlock =>
  b?.type === 'sentence' && b.text.length <= KPI_MAX_CHARS && sentenceKind(b.text) === 'stat';

/** Definition body without a leading "هو/هي". */
const definitionBody = (s: string) => trimPunct(s.replace(/^(?:هو|هي|هى)\s+/u, ''));

/** Which side of a pros/cons pair a list heading names. */
function prosSide(heading: string | undefined): 'pro' | 'con' | 'both' | null {
  if (!heading) return null;
  const n = normalizeArabic(heading);
  const pro = PRO_HEAD.test(n);
  const con = CON_HEAD.test(n);
  return pro && con ? 'both' : pro ? 'pro' : con ? 'con' : null;
}

/**
 * Pros and cons of one list, from explicit marks (✓/+ pro, ✗/× con, "-" con when "+" is used)
 * or, under a heading naming both sides, from items starting with "لا". Null when one side is empty.
 */
function splitProsCons(block: ListBlock, byText: boolean): { pros: string[]; cons: string[] } | null {
  const leads = block.raw.map(leadMark);
  const plus = leads.includes('+');
  const explicit = leads.some((l) => CON_LEADS.has(l)) || plus;
  if (!explicit && !byText) return null;
  const pros: string[] = [];
  const cons: string[] = [];
  block.items.forEach((it, i) => {
    const l = leads[i];
    if (CON_LEADS.has(l) || (plus && l === '-')) cons.push(it);
    else if (PRO_LEADS.has(l)) pros.push(it);
    else if (byText && /^لا\s/u.test(it)) cons.push(it);
    else pros.push(it);
  });
  return pros.length && cons.length ? { pros, cons } : null;
}

/** Quiz options with the correct one marked "✓", or null when the list is not a single-answer quiz. */
function quizOptions(list: ListBlock, after: Block | undefined): { items: string[]; usedAnswerLine: boolean } | null {
  const n = list.items.length;
  if (n < 2 || n > LIMITS.items) return null;
  const leads = list.raw.map(leadMark);
  const count = (l: string) => leads.filter((x) => x === l).length;
  // A mark inside the option text, or a ✓/* bullet that only one option has.
  const marked = list.raw
    .map((r, i) => (/[✓✔✅*]/u.test(stripMarker(r)) || (ANSWER_LEADS.has(leads[i]) && count(leads[i]) === 1) ? i : -1))
    .filter((i) => i >= 0);
  let answer = marked.length === 1 ? marked[0] : -1;
  let usedAnswerLine = false;
  if (answer < 0 && marked.length === 0 && after?.type === 'sentence') {
    const m = ANSWER_LINE.exec(normalizeArabic(after.text));
    if (m) {
      const key = m[1].trim();
      const label = optionLabel(`${key.replace(/^\(/, '')}${/^\(?[ابجده0-9٠-٩]{1,2}$/u.test(key) ? ')' : ''}`);
      const labels = list.raw.map(optionLabel);
      if (label && labels.filter((l) => l === label).length === 1) answer = labels.indexOf(label);
      else {
        const k = fold(key);
        const exact = list.items.map((it, i) => (fold(it) === k ? i : -1)).filter((i) => i >= 0);
        const partial = list.items.map((it, i) => (k.length >= 2 && fold(it).includes(k) ? i : -1)).filter((i) => i >= 0);
        answer = exact.length === 1 ? exact[0] : partial.length === 1 ? partial[0] : -1;
      }
      usedAnswerLine = answer >= 0;
    }
  }
  if (answer < 0) return null;
  const items = list.items.map((it, i) => {
    const text = clampWords(it.replace(ANSWER_MARKS, ' ').replace(/\s+/g, ' ').trim(), MAX_ITEM - 2);
    return i === answer ? `${text} ✓` : text;
  });
  return items.every((it) => it.replace(/✓/g, '').trim()) ? { items, usedAnswerLine } : null;
}

/** Turns blocks into scene drafts without inventing facts: every visible fact comes from the text. */
function blocksToScenes(blocks: Block[]): DraftScene[] {
  const scenes: DraftScene[] = [];
  const pending: string[] = [];
  let statN = 0;
  let kpiN = 0;
  let summaryN = 0;

  const push = (kind: SceneKind, title: string, items: string[], icon = '') =>
    scenes.push({ kind, title: clampWords(title, LIMITS.titleChars), items, icon, weight: 0 });

  const flushSentences = () => {
    while (pending.length) {
      const group = pending.splice(0, 3);
      push('summary', summaryHeadings[summaryN++ % summaryHeadings.length], group);
    }
  };

  /** One pros/cons scene (or a few, three of each side per scene, when the lists are long). */
  const pushProsCons = (title: string, pros: string[], cons: string[]) => {
    // Pros that would read as cons ("لا يحتاج…") get an explicit ✓; cons get the ✗ sceneModel reads.
    const p = pros.map((s) => clampWords(CON_START.test(s) ? `✓ ${s}` : s, MAX_ITEM));
    const c = cons.map((s) => clampWords(`✗ ${s}`, MAX_ITEM));
    if (p.length + c.length <= LIMITS.items) {
      push('proscons', title, [...p, ...c]);
      return;
    }
    const parts = Math.max(Math.ceil(p.length / 3), Math.ceil(c.length / 3));
    for (let k = 0; k < parts; k++) {
      push('proscons', parts > 1 ? `${title} (${k + 1})` : title, [...p.slice(k * 3, k * 3 + 3), ...c.slice(k * 3, k * 3 + 3)]);
    }
  };

  /** Pushes a definition scene when `answer` fits; examples come from a following list. */
  const pushDefinition = (term: string, answer: string, examples: string[] = []): boolean => {
    const body = definitionBody(answer);
    const t = trimPunct(term);
    if (!t || body.length < 4 || body.length > MAX_ITEM) return false;
    push('definition', t, [body, ...examples.slice(0, LIMITS.items - 1).map((e) => clampWords(e, MAX_ITEM))]);
    return true;
  };

  /** A list right after a definition, headed "أمثلة:" or similar, supplies its examples. */
  const examplesAt = (k: number): string[] | null => {
    const list = blocks[k];
    if (list?.type !== 'list' || !list.heading || list.items.length > LIMITS.items - 1) return null;
    return EXAMPLES_HEAD.test(normalizeArabic(list.heading)) ? list.items : null;
  };

  for (let b = 0; b < blocks.length; b++) {
    const block = blocks[b];
    const next = blocks[b + 1];

    if (block.type === 'chapter') {
      flushSentences();
      push('chapter', block.title, []);
      continue;
    }

    if (block.type === 'sentence') {
      const text = block.text;
      const kind = sentenceKind(text);

      if (kind === 'tip') {
        const dyk = DID_YOU_KNOW.exec(text);
        const advice = dyk ? null : ADVICE.exec(text);
        const title = dyk ? 'هل تعلم؟' : trimPunct(advice![1]);
        let rest = text.slice((dyk ?? advice)![0].length).replace(/[\s؟?]+$/u, '');
        if (dyk) rest = rest.replace(/^(?:أنّ?|بأنّ?|ان)\s+/u, '');
        rest = trimPunct(rest);
        let used = 0;
        if (!rest && next?.type === 'sentence' && !isQuestion(next.text)) {
          rest = trimPunct(next.text);
          used = 1;
        }
        if (rest && rest.length <= MAX_ITEM) {
          flushSentences();
          const note = blocks[b + 1 + used];
          const items = [rest];
          if (note?.type === 'sentence' && SOURCE_NOTE.test(note.text) && note.text.length <= MAX_ITEM) {
            items.push(trimPunct(note.text));
            used++;
          }
          push('tip', title, items, 'lightbulb');
          b += used;
          continue;
        }
        // Too long for a tip card: fall through and treat it as ordinary text.
      }

      if (kind === 'quote') {
        const quote = QUOTE_RE.exec(text)!;
        flushSentences();
        push('quote', trimPunct(quote[1]), quote[2] ? [trimPunct(quote[2])] : [], 'quote');
        continue;
      }

      if (kind === 'definition') {
        const m = DEF_COLON.exec(text)!;
        let answer = m[2].trim();
        let used = 0;
        if (!answer && next?.type === 'sentence' && !isQuestion(next.text)) {
          answer = next.text;
          used = 1;
        }
        const examples = examplesAt(b + 1 + used);
        if (answer) {
          flushSentences();
          if (pushDefinition(m[1], answer, examples ?? [])) {
            b += used + (examples ? 1 : 0);
            continue;
          }
          scenes.pop(); // never pushed; keep the stack balanced (no-op guard)
        }
      }

      if (kind === 'question' || kind === 'tip') {
        const def = DEF_QUESTION.exec(text);
        const term = def?.[1].replace(/^(?:مصطلح|مفهوم|كلمة)\s+/u, '');
        const isTerm = term && !NOT_A_TERM.test(normalizeArabic(term)) && !/[0-9٠-٩]/.test(term);
        // "ما هو X؟" + answer sentence (+ "أمثلة:" list) → definition.
        if (isTerm && next?.type === 'sentence' && !isQuestion(next.text)) {
          const examples = examplesAt(b + 2);
          if (definitionBody(next.text).length <= MAX_ITEM) {
            flushSentences();
            pushDefinition(term!, next.text, examples ?? []);
            b += 1 + (examples ? 1 : 0);
            continue;
          }
        }
        // "ما هي الطاقة المتجددة؟" + "هي طاقة …، ومن أمثلتها:" + list → definition with examples.
        if (isTerm && next?.type === 'list' && next.heading && next.items.length < LIMITS.items) {
          const tail = EXAMPLES_TAIL.exec(next.heading);
          const answer = tail && tail.index > 0 ? next.heading.slice(0, tail.index) : '';
          if (answer && definitionBody(answer).length >= 4) {
            flushSentences();
            pushDefinition(term!, answer, next.items);
            b += 1;
            continue;
          }
        }
        if (kind === 'question' && next?.type === 'list' && !next.heading) {
          // A question followed by options with exactly one marked answer → quiz.
          const quiz = quizOptions(next, blocks[b + 2]);
          if (quiz) {
            flushSentences();
            push('quiz', text.replace(/^(?:ال)?سؤال\s*[:：\-–—]\s*/u, ''), quiz.items, 'circle-help');
            b += quiz.usedAnswerLine ? 2 : 1;
            continue;
          }
          // Otherwise the question titles the list that answers it.
          if (text.length <= 90) {
            next.heading = trimPunct(text.replace(/[؟?]\s*$/u, '')) + '؟';
            continue;
          }
        }
      }

      if (kind === 'question') {
        // A question followed by its answer sentences becomes one scene.
        flushSentences();
        const answers: string[] = [];
        while (blocks[b + 1]?.type === 'sentence' && answers.length < 3) {
          const n = blocks[b + 1] as SentenceBlock;
          if (isQuestion(n.text)) break;
          answers.push(n.text);
          b++;
        }
        if (answers.length) push('summary', text, answers.flatMap((a) => chunkText(a, MAX_ITEM)));
        else pending.push(text);
        continue;
      }

      if (kind === 'comparison') {
        flushSentences();
        push('comparison', 'مقارنة', text.split(COMPARE_SPLIT).map((s) => clampWords(trimPunct(s), MAX_ITEM)));
        continue;
      }

      if (kind === 'pictogram') {
        flushSentences();
        const warning = WARNING_RE.test(text);
        push('pictogram', warning ? 'تنبيه مهم' : statHeadings[statN++ % statHeadings.length], [ratioOf(text)!, ...chunkText(trimPunct(text), MAX_ITEM).slice(0, 2)]);
        continue;
      }

      if (kind === 'stat' || (kind === 'warning' && statValue(text))) {
        flushSentences();
        // Three or more short stats in a row share one KPI scene instead of a run of stat scenes.
        let run = 0;
        while (isKpi(blocks[b + run])) run++;
        if (run >= 3) {
          const texts = blocks.slice(b, b + run).map((s) => trimPunct((s as SentenceBlock).text));
          for (const group of balancedGroups(texts, 4)) push('kpis', kpiHeadings[kpiN++ % kpiHeadings.length], group);
          b += run - 1;
          continue;
        }
        const warning = kind === 'warning';
        push(
          'stat',
          warning ? 'تنبيه مهم' : statHeadings[statN++ % statHeadings.length],
          [statValue(text)!, ...chunkText(trimPunct(text), MAX_ITEM).slice(0, 2)],
          warning ? 'triangle-alert' : '',
        );
        continue;
      }

      if (kind === 'warning') {
        flushSentences();
        push('summary', 'تنبيه مهم', chunkText(text, MAX_ITEM), 'triangle-alert');
        continue;
      }

      pending.push(...chunkText(text, MAX_ITEM));
      continue;
    }

    flushSentences();
    if (block.type === 'years') {
      for (const part of chunk(block.items, 5)) push('timeline', 'محطات زمنية', part.map((s) => clampWords(s, MAX_ITEM)), 'history');
    } else if (block.type === 'bars') {
      pushBars(block);
    } else if (block.type === 'list') {
      const cue = block.heading ?? block.hint;
      // "المزايا:" + "العيوب:" (or فوائد/أضرار, افعل/لا تفعل) in a row → one pros/cons scene.
      const side = prosSide(block.heading);
      if ((side === 'pro' || side === 'con') && next?.type === 'list' && prosSide(next.heading) === (side === 'pro' ? 'con' : 'pro')) {
        const [pros, cons] = side === 'pro' ? [block, next] : [next, block];
        pushProsCons(`${block.heading} و${next.heading}`, pros.items, cons.items);
        b++;
        continue;
      }
      pushList(block, cue);
    }
  }
  flushSentences();
  return scenes;

  function pushBars(block: { items: string[]; heading?: string; years?: boolean }) {
    const rows = block.items.map(valueRow);
    const n = rows.length;
    const pct = rows.every((r) => r && /[%٪]/.test(r.value));
    const plain = rows.every((r) => r && !/[%٪]/.test(r.value));
    const sum = rows.reduce((a, r) => a + (r?.num ?? 0), 0);
    const years = block.years || rows.every((r) => r && YEAR_LABEL.test(r.label));
    let kind: SceneKind = 'comparison';
    if (pct && n >= 2 && n <= LIMITS.items && sum >= 90 && sum <= 110) kind = 'donut';
    else if (years || (plain && n >= 4)) kind = 'columns';
    const title = block.heading ?? (kind === 'donut' ? 'توزيع النسب' : 'مقارنة بالأرقام');
    for (const part of chunk(block.items, LIMITS.items)) push(kind, title, part.map((s) => clampWords(s, MAX_ITEM)));
  }

  function pushList(block: ListBlock, cue: string | undefined) {
    const n = block.items.length;
    const items = block.items.map((s) => clampWords(s, MAX_ITEM));
    const leads = block.raw.map(leadMark);
    const named = (kind: SceneKind, fallback: string) => push(kind, cue ?? fallback, items);

    // Explicit ☐/☑/✓ boxes on every item → checklist.
    if (n >= 2 && leads.every((l) => CHECK_LEADS.has(l))) {
      chunk(items, 5).forEach((part, k, all) => push('checklist', withPart(cue ?? 'قائمة التحقق', k, all.length), part));
      return;
    }
    const split = splitProsCons(block, prosSide(cue) === 'both');
    if (split) {
      pushProsCons(cue ?? 'المزايا والعيوب', split.pros, split.cons);
      return;
    }
    if (cue && n >= 3 && n <= LIMITS.items && CYCLE_HEAD.test(cue)) return named('cycle', 'الدورة');
    if (cue && n >= 3 && n <= LIMITS.items && PYRAMID_HEAD.test(cue)) return named('pyramid', 'الهرم');
    if (cue && !STEPS_HINT.test(cue) && CHECKLIST_HEAD.test(normalizeArabic(cue))) {
      chunk(items, 5).forEach((part, k, all) => push('checklist', withPart(cue, k, all.length), part));
      return;
    }
    const asSteps = block.ordered || (cue ? STEPS_HINT.test(cue) : false);
    const parts = chunk(items, asSteps ? 5 : 4);
    parts.forEach((part, k) => {
      const title = cue ? withPart(cue, k, parts.length) : asSteps ? 'الخطوات' : 'أبرز النقاط';
      push(asSteps ? 'steps' : 'summary', title, part);
    });
  }
}

const withPart = (title: string, k: number, total: number) => (total > 1 ? `${title} (${k + 1})` : title);

/** Guide scenes for short descriptions; bracketed text tells the user what to write. */
function placeholderScenes(topic: string): DraftScene[] {
  return [
    { kind: 'summary', title: `ما هو ${topic}؟`, items: ['[اكتب تعريفًا مختصرًا هنا]', '[أضف معلومة أساسية ثانية]'], icon: 'circle-help', weight: 0 },
    { kind: 'stat', title: 'بالأرقام', items: ['50%', '[اكتب هنا الحقيقة التي يمثلها هذا الرقم ومصدرها]'], icon: 'chart-column', weight: 0 },
    { kind: 'steps', title: 'خطوات عملية', items: ['[الخطوة الأولى]', '[الخطوة الثانية]', '[الخطوة الثالثة]', '[الخطوة الرابعة]'], icon: 'list-ordered', weight: 0 },
    { kind: 'comparison', title: 'الصواب والخطأ', items: ['[افعل: ممارسة صحيحة]', '[لا تفعل: خطأ شائع]'], icon: 'arrow-left-right', weight: 0 },
  ];
}

/** Screen-time weight: base per kind plus reading time for the text it shows. */
function weightOf(s: DraftScene): number {
  const chars = s.title.length + s.items.reduce((a, it) => a + it.length, 0);
  const base: Record<SceneKind, number> = {
    hero: 8, outro: 7, stat: 9, steps: 8, comparison: 9, timeline: 9, quote: 8, summary: 7,
    kpis: 9, donut: 9, columns: 9, pictogram: 9, cycle: 9, pyramid: 9, proscons: 9, checklist: 8, quiz: 12, definition: 8, chapter: 5, tip: 8,
  };
  return base[s.kind] + Math.min(10, chars / 18) + s.items.length * 0.8;
}

/** Builds a storyboard from a free Arabic description. Deterministic: same text → same scenes. */
export function buildStoryboard(description: string): Storyboard {
  const text = description.replace(/\r/g, '').slice(0, LIMITS.descriptionChars).trim();
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // A short first line followed by more content is treated as the title.
  let title: string;
  let body: string;
  if (lines.length > 1 && lines[0].length <= 80 && !isListLine(lines[0])) {
    title = trimPunct(extractTopic(lines[0].replace(/^#{1,6}\s+/, '')));
    body = lines.slice(1).join('\n');
  } else {
    title = clampWords(extractTopic(text), 70);
    const sentences = splitSentences(text);
    // Drop the request sentence itself if it only states the topic.
    body = sentences.length > 1 && sentences[0].length <= 120 ? text.slice(text.indexOf(sentences[1])) : sentences.length > 1 ? text : '';
  }
  title = clampWords(title || 'إنفوجرافيك جديد', LIMITS.titleChars - 10);

  let content = blocksToScenes(toBlocks(body));
  const usedPlaceholders = content.filter((s) => s.kind !== 'chapter').length < 2;
  if (usedPlaceholders) content = [...content, ...placeholderScenes(title)].slice(0, 5);
  content = content.slice(0, LIMITS.scenes - 2);
  // A section break with nothing after it is dropped.
  while (content.at(-1)?.kind === 'chapter') content.pop();

  const hero: DraftScene = { kind: 'hero', title, items: ['إنفوجرافيك تعليمي'], icon: '', weight: 0 };
  const outro: DraftScene = { kind: 'outro', title: 'شكرًا للمشاهدة', items: ['شارك الفيديو مع من يهمه الأمر'], icon: 'heart', weight: 0 };
  const scenes = [hero, ...content, outro];

  // Icons: keyword match on the scene text, preferring icons not yet used.
  const used = new Set<string>();
  for (const s of scenes) {
    if (!s.icon) {
      // The hero follows the topic; other scenes look at their own content first, then the topic.
      const candidates = s.kind === 'hero' ? [s.title] : [s.items.join(' '), s.title, title];
      s.icon =
        candidates.map((t) => suggestIcon(t, '', used)).find(Boolean) ||
        candidates.map((t) => suggestIcon(t, '')).find(Boolean) ||
        KIND_ICONS[s.kind];
    }
    used.add(s.icon);
    s.weight = weightOf(s);
  }
  return { title, scenes, usedPlaceholders };
}
