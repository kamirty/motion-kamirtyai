import { KIND_ICONS, suggestIcon } from '../design/icons';
import { LIMITS, type Scene, type SceneKind } from '../domain/types';
import { QUIZ_COUNTDOWN } from './timing';

/**
 * Teacher workflow ("مسار المعلم"): a lesson filled in step by step becomes a complete video —
 * opening, objective, concept, key points, a surprising fact, a check-for-understanding quiz and
 * a closing. Pure and deterministic; it only arranges what the teacher typed (never invents).
 */
export interface LessonInput {
  subject: string;
  grade: string;
  title: string;
  objective: string;
  /** Concept name (defaults to the lesson title) and its short definition. */
  concept: string;
  definition: string;
  examples: string[];
  pointsTitle: string;
  points: string[];
  pointsStyle: 'steps' | 'summary' | 'cycle' | 'checklist' | 'timeline' | 'pyramid';
  fact: string;
  question: string;
  options: string[];
  /** Index into `options` of the right answer (-1: none marked). */
  correct: number;
  summary: string;
  closing: string;
}

export const EMPTY_LESSON: LessonInput = {
  subject: '', grade: '', title: '', objective: '', concept: '', definition: '', examples: [],
  pointsTitle: '', points: [], pointsStyle: 'steps', fact: '', question: '', options: [], correct: -1, summary: '', closing: '',
};

export const SAMPLE_LESSON: LessonInput = {
  subject: 'العلوم',
  grade: 'الصف الرابع',
  title: 'دورة الماء في الطبيعة',
  objective: 'أن يصف الطالب مراحل دورة الماء ويشرح أهميتها للحياة.',
  concept: 'دورة الماء',
  definition: 'انتقال الماء المستمر بين الأرض والجو في صورة سائلة وغازية وصلبة.',
  examples: ['المطر', 'السحب', 'الأنهار'],
  pointsTitle: 'مراحل دورة الماء',
  points: ['التبخر', 'التكاثف', 'الهطول', 'الجريان'],
  pointsStyle: 'cycle',
  fact: 'نحو 97% من مياه الأرض مالحة، و3% فقط عذبة.',
  question: 'ماذا نسمي تحوّل بخار الماء إلى قطرات في السحب؟',
  options: ['التبخر', 'التكاثف', 'الهطول'],
  correct: 1,
  summary: 'الماء يدور بلا توقف: يتبخر ثم يتكاثف ثم يهطل ثم يجري.',
  closing: 'واجب: ارسم دورة الماء في دفترك',
};

const clean = (s: string, max: number = LIMITS.itemChars) => s.replace(/\s+/g, ' ').trim().slice(0, max);
const list = (xs: string[], max = LIMITS.items) => xs.map((x) => clean(x)).filter(Boolean).slice(0, max);

/** Seconds → frames at 30 fps. */
const s = (sec: number) => Math.round(sec * 30);

function scene(kind: SceneKind, title: string, items: string[], durationFrames: number, iconText = title): Omit<Scene, 'id' | 'startFrame'> {
  return { kind, title: clean(title, LIMITS.titleChars), items, durationFrames, icon: suggestIcon(iconText, KIND_ICONS[kind] ?? 'sparkles') };
}

/** Scenes in lesson order (ids and start frames are assigned by the caller via withScenes). */
export function lessonScenes(input: LessonInput): Scene[] {
  const out: Omit<Scene, 'id' | 'startFrame'>[] = [];
  const title = clean(input.title, LIMITS.titleChars) || 'درس جديد';
  const meta = [clean(input.subject), clean(input.grade)].filter(Boolean).join(' · ');

  out.push(scene('hero', title, meta ? [meta] : [], s(6), `${input.subject} ${title}`));

  if (clean(input.objective)) out.push({ ...scene('tip', 'هدف الدرس', [clean(input.objective)], s(8)), icon: 'target' });

  if (clean(input.definition)) {
    const examples = list(input.examples, LIMITS.items - 1);
    out.push(scene('definition', clean(input.concept, LIMITS.titleChars) || title, [clean(input.definition), ...examples], s(10 + examples.length * 2)));
  }

  const points = list(input.points);
  if (points.length) {
    const kind: SceneKind = points.length < 3 && (input.pointsStyle === 'cycle' || input.pointsStyle === 'pyramid') ? 'steps' : input.pointsStyle;
    out.push(scene(kind, clean(input.pointsTitle, LIMITS.titleChars) || 'أهم النقاط', points, s(5 + points.length * 4), `${input.pointsTitle} ${title}`));
  }

  if (clean(input.fact)) out.push({ ...scene('tip', 'هل تعلم؟', [clean(input.fact)], s(8)), icon: 'lightbulb' });

  const options = list(input.options);
  if (clean(input.question) && options.length >= 2) {
    const marked = options.map((o, i) => (i === input.correct ? `${o} ✓` : o));
    // Options appear one by one, then a 3-second countdown, then the answer stays readable.
    const frames = s(4) + options.length * s(2.5) + QUIZ_COUNTDOWN + s(4);
    out.push({ ...scene('quiz', clean(input.question, LIMITS.titleChars), marked, frames), icon: 'circle-help' });
  }

  const closing = clean(input.closing);
  out.push(scene('outro', clean(input.summary, LIMITS.titleChars) || 'شكرًا لحسن استماعكم', closing ? [closing] : [], s(7)));

  return out.slice(0, LIMITS.scenes).map((sc, i) => ({ ...sc, id: `s${i + 1}`, startFrame: 0 }));
}

/** Which wizard steps still need something to produce their scene (for the progress hints). */
export function lessonGaps(input: LessonInput): string[] {
  const gaps: string[] = [];
  if (!clean(input.title)) gaps.push('عنوان الدرس');
  if (!list(input.points).length) gaps.push('نقاط الدرس');
  if (clean(input.question) && list(input.options).length < 2) gaps.push('خياران على الأقل للسؤال');
  if (clean(input.question) && input.correct < 0) gaps.push('الإجابة الصحيحة');
  return gaps;
}
