import { KIND_ICONS, suggestIcon } from '../../design/icons';
import { LIMITS, type SceneKind } from '../../domain/types';
import {
  LABEL_VALUE, STAT_RE, YEAR_LINE, chunkText, clampWords, extractTopic, isListLine,
  splitSentences, stripMarker, trimPunct,
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

type Block =
  | { type: 'list'; items: string[]; ordered: boolean; heading?: string }
  | { type: 'years'; items: string[] }
  | { type: 'bars'; items: string[]; heading?: string }
  | { type: 'sentence'; text: string };

const MAX_ITEM = LIMITS.itemChars;
const QUOTE_RE = /[«"“]([^«»"“”]{8,})[»"”]\s*(?:[-–—]\s*([^.\n]{2,60}))?/u;
const COMPARE_SPLIT = /\s+(?:بينما|مقابل|في حين|أما|vs\.?|versus)\s+/iu;
const WARNING_RE = /(?:^|\s)(?:تحذير|احذر|احذروا|تجنب|تجنّب|انتبه|خطر|ممنوع|لا\s+ت)/u;
const STEPS_HINT = /(?:خطوات|خطوة|مراحل|طريقة|طرق|كيف|نصائح|إرشادات|ارشادات|قواعد)/u;
const ORDERED_MARKER = /^\s*\(?[0-9٠-٩]{1,2}\s*[.)\-–:]/;

/** Groups the description into list, year, bar and sentence blocks, keeping a list's heading line. */
function toBlocks(body: string): Block[] {
  const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (YEAR_LINE.test(line)) {
      const items: string[] = [];
      while (i < lines.length && YEAR_LINE.test(lines[i])) {
        const m = YEAR_LINE.exec(lines[i])!;
        items.push(`${m[1]}: ${trimPunct(m[2])}`);
        i++;
      }
      blocks.push({ type: 'years', items });
      continue;
    }
    if (isListLine(line)) {
      const raw: string[] = [];
      while (i < lines.length && isListLine(lines[i])) raw.push(lines[i++]);
      const items = raw.map(stripMarker).filter(Boolean);
      const prev = blocks[blocks.length - 1];
      // A short sentence ending with ":" right before the list is its heading.
      let heading: string | undefined;
      if (prev?.type === 'sentence' && /[:：]\s*$/.test(prev.text) && prev.text.length <= 90) {
        heading = trimPunct(prev.text);
        blocks.pop();
      }
      const bars = items.filter((it) => LABEL_VALUE.test(it));
      if (bars.length >= 2 && bars.length === items.length) blocks.push({ type: 'bars', items, heading });
      else blocks.push({ type: 'list', items, ordered: raw.some((r) => ORDERED_MARKER.test(r)), heading });
      continue;
    }
    for (const s of splitSentences(line)) blocks.push({ type: 'sentence', text: s });
    i++;
  }
  return blocks;
}

const statHeadings = ['بالأرقام', 'هل تعلم؟', 'رقم مهم', 'حقيقة لافتة'];
const summaryHeadings = ['نقاط رئيسية', 'معلومات مهمة', 'تعرّف أكثر', 'باختصار'];

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Turns blocks into scene drafts without inventing facts: every visible fact comes from the text. */
function blocksToScenes(blocks: Block[]): DraftScene[] {
  const scenes: DraftScene[] = [];
  const pending: string[] = [];
  let statN = 0;
  let summaryN = 0;

  const flushSentences = () => {
    while (pending.length) {
      const group = pending.splice(0, 3);
      scenes.push({ kind: 'summary', title: summaryHeadings[summaryN++ % summaryHeadings.length], items: group, icon: '', weight: 0 });
    }
  };

  for (let b = 0; b < blocks.length; b++) {
    const block = blocks[b];
    if (block.type === 'sentence') {
      const text = block.text;
      const quote = QUOTE_RE.exec(text);
      if (quote) {
        flushSentences();
        scenes.push({ kind: 'quote', title: trimPunct(quote[1]), items: quote[2] ? [trimPunct(quote[2])] : [], icon: 'quote', weight: 0 });
        continue;
      }
      if (text.endsWith('؟') || text.endsWith('?')) {
        // A question followed by its answer sentences becomes one scene.
        flushSentences();
        const answers: string[] = [];
        while (blocks[b + 1]?.type === 'sentence' && answers.length < 3) {
          const next = blocks[b + 1] as { type: 'sentence'; text: string };
          if (next.text.endsWith('؟') || next.text.endsWith('?')) break;
          answers.push(next.text);
          b++;
        }
        if (answers.length) {
          scenes.push({ kind: 'summary', title: text, items: answers.flatMap((a) => chunkText(a, MAX_ITEM)), icon: '', weight: 0 });
        } else pending.push(text);
        continue;
      }
      const sides = text.split(COMPARE_SPLIT);
      if (sides.length === 2 && sides.every((s) => s.length >= 4)) {
        flushSentences();
        scenes.push({ kind: 'comparison', title: 'مقارنة', items: sides.map((s) => clampWords(trimPunct(s), MAX_ITEM)), icon: '', weight: 0 });
        continue;
      }
      const stat = STAT_RE.exec(text);
      const isYearOnly = stat && !stat[2] && /^[0-9٠-٩]{4}$/.test(stat[1]);
      if (stat && !isYearOnly && (stat[2] || Number(stat[1].replace(/[^\d]/g, '')) >= 10 || /[٠-٩]/.test(stat[1]))) {
        flushSentences();
        const value = `${stat[1]}${stat[2] === '%' || stat[2] === '٪' ? stat[2] : stat[2] ? ` ${stat[2]}` : ''}`;
        const warning = WARNING_RE.test(text);
        scenes.push({
          kind: 'stat',
          title: warning ? 'تنبيه مهم' : statHeadings[statN++ % statHeadings.length],
          items: [value, ...chunkText(trimPunct(text), MAX_ITEM).slice(0, 2)],
          icon: warning ? 'triangle-alert' : '',
          weight: 0,
        });
        continue;
      }
      if (WARNING_RE.test(text)) {
        flushSentences();
        scenes.push({ kind: 'summary', title: 'تنبيه مهم', items: chunkText(text, MAX_ITEM), icon: 'triangle-alert', weight: 0 });
        continue;
      }
      pending.push(...chunkText(text, MAX_ITEM));
      continue;
    }

    flushSentences();
    if (block.type === 'years') {
      for (const part of chunk(block.items, 5)) {
        scenes.push({ kind: 'timeline', title: 'محطات زمنية', items: part.map((s) => clampWords(s, MAX_ITEM)), icon: 'history', weight: 0 });
      }
    } else if (block.type === 'bars') {
      for (const part of chunk(block.items, LIMITS.items)) {
        scenes.push({ kind: 'comparison', title: block.heading ?? 'مقارنة بالأرقام', items: part.map((s) => clampWords(s, MAX_ITEM)), icon: '', weight: 0 });
      }
    } else {
      const heading = block.heading;
      const asSteps = block.ordered || (heading ? STEPS_HINT.test(heading) : false);
      const parts = chunk(block.items.map((s) => clampWords(s, MAX_ITEM)), asSteps ? 5 : 4);
      parts.forEach((part, k) => {
        const title = heading ? (parts.length > 1 ? `${heading} (${k + 1})` : heading) : asSteps ? 'الخطوات' : 'أبرز النقاط';
        scenes.push({ kind: asSteps ? 'steps' : 'summary', title, items: part, icon: '', weight: 0 });
      });
    }
  }
  flushSentences();
  return scenes;
}

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
  const base: Record<SceneKind, number> = { hero: 8, outro: 7, stat: 9, steps: 8, comparison: 9, timeline: 9, quote: 8, summary: 7 };
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
    title = trimPunct(extractTopic(lines[0]));
    body = lines.slice(1).join('\n');
  } else {
    title = clampWords(extractTopic(text), 70);
    const sentences = splitSentences(text);
    // Drop the request sentence itself if it only states the topic.
    body = sentences.length > 1 && sentences[0].length <= 120 ? text.slice(text.indexOf(sentences[1])) : sentences.length > 1 ? text : '';
  }
  title = clampWords(title || 'إنفوجرافيك جديد', LIMITS.titleChars - 10);

  let content = blocksToScenes(toBlocks(body));
  const usedPlaceholders = content.length < 2;
  if (usedPlaceholders) content = [...content, ...placeholderScenes(title)].slice(0, 5);
  content = content.slice(0, LIMITS.scenes - 2);

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
