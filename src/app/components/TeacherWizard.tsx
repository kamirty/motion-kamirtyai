import { useEffect, useMemo, useState } from 'react';
import { localizeDigits } from '../../design/digits';
import { LIMITS, type DigitSystem, type Scene } from '../../domain/types';
import { EMPTY_LESSON, SAMPLE_LESSON, lessonGaps, lessonScenes, type LessonInput } from '../../engine/lesson';
import { KIND_LABELS } from './kinds';

interface Props {
  digits: DigitSystem;
  onCreate: (scenes: Scene[], title: string) => void;
  onClose: () => void;
}

const DRAFT_KEY = 'kamirty-motion:lesson-draft';
const loadDraft = (): LessonInput => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? { ...EMPTY_LESSON, ...(JSON.parse(raw) as Partial<LessonInput>) } : EMPTY_LESSON;
  } catch {
    return EMPTY_LESSON;
  }
};

const STEPS = ['الدرس', 'الفكرة', 'النقاط', 'معلومة', 'التقويم', 'الخاتمة'] as const;
const POINT_STYLES: [LessonInput['pointsStyle'], string][] = [
  ['steps', 'خطوات (درج)'], ['summary', 'بطاقات'], ['cycle', 'دورة'], ['checklist', 'قائمة تحقق'], ['timeline', 'خط زمني'], ['pyramid', 'هرم'],
];

/** Editable list of short lines (examples, points, quiz options). */
function Lines({ values, max, placeholder, onChange, correct, onCorrect }: {
  values: string[]; max: number; placeholder: (i: number) => string; onChange: (v: string[]) => void;
  correct?: number; onCorrect?: (i: number) => void;
}) {
  const rows = values.length ? values : [''];
  return (
    <div className="lines">
      {rows.map((v, i) => (
        <div className="item-row" key={i}>
          {onCorrect && (
            <label className="check" title="الإجابة الصحيحة">
              <input type="radio" name="correct" checked={correct === i} onChange={() => onCorrect(i)} /> ✓
            </label>
          )}
          <input value={v} maxLength={LIMITS.itemChars} placeholder={placeholder(i)} onChange={(e) => onChange(rows.map((x, j) => (j === i ? e.target.value : x)))} />
          {rows.length > 1 && (
            <button type="button" className="ghost" aria-label="حذف" onClick={() => onChange(rows.filter((_, j) => j !== i))}>✕</button>
          )}
        </div>
      ))}
      {rows.length < max && (
        <button type="button" className="ghost add" onClick={() => onChange([...rows, ''])}>＋ أضف سطرًا</button>
      )}
    </div>
  );
}

/** «مسار المعلم»: a lesson filled in six short steps becomes a complete video. */
export function TeacherWizard({ digits, onCreate, onClose }: Props) {
  const [lesson, setLesson] = useState<LessonInput>(loadDraft);
  const [step, setStep] = useState(0);
  const set = (patch: Partial<LessonInput>) => setLesson((l) => ({ ...l, ...patch }));
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(lesson));
    } catch {
      /* private mode: the draft simply is not kept */
    }
  }, [lesson]);

  const scenes = useMemo(() => lessonScenes(lesson), [lesson]);
  const gaps = lessonGaps(lesson);
  const seconds = Math.round(scenes.reduce((a, s) => a + s.durationFrames, 0) / 30);
  const n = (v: number) => localizeDigits(String(v), digits);
  const last = step === STEPS.length - 1;

  const field = (label: string, key: keyof LessonInput, placeholder: string, multiline = false) => (
    <label className="field">
      <span className="label">{label}</span>
      {multiline ? (
        <textarea rows={3} maxLength={LIMITS.itemChars} value={lesson[key] as string} placeholder={placeholder} onChange={(e) => set({ [key]: e.target.value })} />
      ) : (
        <input maxLength={LIMITS.titleChars} value={lesson[key] as string} placeholder={placeholder} onChange={(e) => set({ [key]: e.target.value })} />
      )}
    </label>
  );

  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-labelledby="wizard-title" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal wizard">
        <div className="modal-head">
          <h2 id="wizard-title">🎓 مسار المعلم: درس كامل خطوة بخطوة</h2>
          <button type="button" className="ghost" onClick={onClose} aria-label="إغلاق">✕</button>
        </div>

        <ol className="wizard-steps">
          {STEPS.map((label, i) => (
            <li key={label}>
              <button type="button" className={i === step ? 'active' : i < step ? 'done' : ''} onClick={() => setStep(i)} aria-current={i === step ? 'step' : undefined}>
                <b>{n(i + 1)}</b> {label}
              </button>
            </li>
          ))}
        </ol>

        <div className="wizard-body">
          {step === 0 && (
            <>
              {field('عنوان الدرس *', 'title', 'مثال: دورة الماء في الطبيعة')}
              <div className="row">
                {field('المادة', 'subject', 'العلوم')}
                {field('الصف', 'grade', 'الصف الرابع')}
              </div>
              {field('هدف الدرس (اختياري)', 'objective', 'أن يصف الطالب مراحل دورة الماء…', true)}
            </>
          )}
          {step === 1 && (
            <>
              {field('المفهوم', 'concept', 'اتركه فارغًا ليكون عنوان الدرس')}
              {field('تعريف مختصر', 'definition', 'جملة واحدة واضحة تشرح المفهوم', true)}
              <span className="label">أمثلة (اختياري)</span>
              <Lines values={lesson.examples} max={LIMITS.items - 1} placeholder={(i) => `مثال ${n(i + 1)}`} onChange={(examples) => set({ examples })} />
            </>
          )}
          {step === 2 && (
            <>
              {field('عنوان النقاط', 'pointsTitle', 'مثال: مراحل دورة الماء')}
              <span className="label">شكل العرض</span>
              <div className="seg">
                {POINT_STYLES.map(([id, label]) => (
                  <button type="button" key={id} className={lesson.pointsStyle === id ? 'active' : ''} onClick={() => set({ pointsStyle: id })}>{label}</button>
                ))}
              </div>
              <span className="label">النقاط * (حتى {n(LIMITS.items)})</span>
              <Lines values={lesson.points} max={LIMITS.items} placeholder={(i) => (lesson.pointsStyle === 'timeline' ? `${n(2000 + i * 10)}: حدث` : `النقطة ${n(i + 1)}`)} onChange={(points) => set({ points })} />
            </>
          )}
          {step === 3 && field('هل تعلم؟ معلومة مدهشة أو رقم (اختياري)', 'fact', 'مثال: 97% من مياه الأرض مالحة', true)}
          {step === 4 && (
            <>
              {field('سؤال لاختبار الفهم (اختياري)', 'question', 'مثال: ماذا نسمي تحوّل بخار الماء إلى قطرات؟')}
              <span className="label">الخيارات (اختر الصحيحة بـ ✓)</span>
              <Lines values={lesson.options} max={4} placeholder={(i) => `الخيار ${n(i + 1)}`} onChange={(options) => set({ options })} correct={lesson.correct} onCorrect={(correct) => set({ correct })} />
            </>
          )}
          {step === 5 && (
            <>
              {field('خلاصة الدرس', 'summary', 'جملة تلخّص أهم ما تعلّمه الطالب', true)}
              {field('سطر الختام (اختياري)', 'closing', 'مثال: واجب: ارسم دورة الماء في دفترك')}
              <div className="wizard-summary">
                <b>سيتكون الفيديو من {n(scenes.length)} مشاهد (نحو {n(seconds)} ثانية):</b>
                <p className="muted small">{scenes.map((s) => KIND_LABELS[s.kind]).join(' ← ')}</p>
                {gaps.length > 0 && <p className="warn small">ينقص: {gaps.join('، ')}</p>}
              </div>
            </>
          )}
        </div>

        <div className="row wizard-nav">
          <button type="button" className="ghost" onClick={() => (step ? setStep(step - 1) : setLesson(SAMPLE_LESSON))}>
            {step ? '→ السابق' : '📄 املأ بمثال جاهز'}
          </button>
          {last ? (
            <button type="button" className="primary" disabled={!lesson.title.trim() || gaps.includes('عنوان الدرس')} onClick={() => onCreate(scenes, lesson.title.trim())}>
              🎬 أنشئ فيديو الدرس
            </button>
          ) : (
            <button type="button" className="primary" onClick={() => setStep(step + 1)}>التالي ←</button>
          )}
        </div>
        <p className="muted small">كل خطوة اختيارية ما عدا العنوان والنقاط، وتستطيع تعديل كل مشهد بعد الإنشاء. يُحفظ ما تكتبه في متصفحك.</p>
      </div>
    </div>
  );
}
