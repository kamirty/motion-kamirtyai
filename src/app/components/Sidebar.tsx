import { FONTS, cssFamily } from '../../design/fonts';
import { PRESETS, contrast, fullTheme } from '../../design/presets';
import { MUSIC_OPTIONS } from '../../engine/audio/music';
import {
  ASPECTS, LIMITS, aspectOf, styleOf, type AspectId, type BackgroundId, type Project, type ProjectStyle, type Theme, type TransitionId,
} from '../../domain/types';

const TRANSITIONS: { id: TransitionId; label: string }[] = [
  { id: 'slide', label: 'انزلاق' },
  { id: 'fade', label: 'تلاشي' },
  { id: 'zoom', label: 'تكبير' },
  { id: 'wipe', label: 'مسح ملوّن' },
];
const BACKGROUNDS: { id: BackgroundId; label: string }[] = [
  { id: 'gradient', label: 'تدرّج' },
  { id: 'waves', label: 'أمواج' },
  { id: 'dots', label: 'نقاط' },
  { id: 'plain', label: 'سادة' },
];

interface Props {
  description: string;
  onDescription: (v: string) => void;
  onGenerate: () => void;
  project: Project;
  onAspect: (a: AspectId) => void;
  onStyle: (patch: Partial<ProjectStyle>, theme?: Theme) => void;
  onTheme: (patch: Partial<Theme>) => void;
  customAudioName: string | null;
  onAudioFile: (file: File | null) => void;
}

export function Sidebar(p: Props) {
  const style = styleOf(p.project);
  const theme = fullTheme(p.project.theme);
  const aspect = aspectOf(p.project.size);
  const lowContrast = contrast(theme.foreground, theme.background) < 4.5;
  const tooLong = p.description.length >= LIMITS.descriptionChars;

  return (
    <aside className="sidebar">
      <section className="box">
        <h2>
          <span className="step">١</span> اكتب فكرتك
        </h2>
        <textarea
          value={p.description}
          onChange={(e) => p.onDescription(e.target.value)}
          maxLength={LIMITS.descriptionChars}
          rows={9}
          placeholder={'مثال:\nفوائد القراءة\nتزيد القراءة المفردات بنسبة 50%.\nخطوات لبناء عادة القراءة:\n1. ابدأ بعشر دقائق يوميًا\n2. اختر كتبًا تحبها'}
        />
        <div className="hint-row">
          <span className={tooLong ? 'warn' : 'muted'}>
            {p.description.length.toLocaleString('ar-EG')} / {LIMITS.descriptionChars.toLocaleString('ar-EG')}
          </span>
          <span className="muted">سطر أول قصير = العنوان</span>
        </div>
        <details className="tips" open>
          <summary>كيف أكتب وصفًا يعطي أفضل فيديو؟</summary>
          <ul>
            <li>اكتب <b>عنوانًا</b> في السطر الأول، وسطرًا مثل «الجزء الأول: …» لصنع <b>فاصل قسم</b>.</li>
            <li>جملة فيها <b>رقم أو نسبة</b> تصبح عدّادًا متحركًا، وثلاث جمل قصيرة بأرقام متتالية تصبح <b>أرقامًا سريعة</b>، و«7 من 10» تصبح <b>رسمًا بالأيقونات</b>.</li>
            <li>القوائم المرقّمة (1. 2. 3.) تصبح <b>خطوات</b>، والقوائم بالشرطة (-) تصبح <b>بطاقات</b>.</li>
            <li>قائمة «الاسم: 40%» تصبح <b>أعمدة</b>، وإذا كان مجموع النسب 100% تصبح <b>دائرة نسب</b>.</li>
            <li>«2020: حدث» في كل سطر يصنع <b>خطًا زمنيًا</b>.</li>
            <li>قائمة تحت عنوان فيه «دورة» تصبح <b>دورة</b>، وفيه «هرم» أو «مستويات» تصبح <b>هرمًا</b>، وفيه «تأكد» أو «قائمة» تصبح <b>قائمة تحقق</b>.</li>
            <li>«المزايا:» ثم قائمة، و«العيوب:» ثم قائمة، تصبحان مشهد <b>مزايا وعيوب</b>.</li>
            <li>سؤال تتبعه خيارات بالشرطة، مع ✓ بجانب الصحيحة، يصبح <b>سؤال اختيارات</b> بعدّ تنازلي.</li>
            <li>«ما هو …؟» ثم الإجابة يصبح <b>تعريفًا</b>، وسطر يبدأ بـ «هل تعلم» أو «نصيحة:» يصبح <b>بطاقة نصيحة</b>.</li>
            <li>جملة فيها «بينما» أو «مقابل» تصبح <b>مقارنة</b>، والنص بين علامتي تنصيص يصبح <b>اقتباسًا</b>.</li>
          </ul>
        </details>
        <button type="button" className="primary big" onClick={p.onGenerate} disabled={!p.description.trim()}>
          ✨ أنشئ الفيديو من الوصف
        </button>
      </section>

      <section className="box">
        <h2>
          <span className="step">٢</span> المقاس والنمط
        </h2>
        <div className="seg">
          {(Object.keys(ASPECTS) as AspectId[]).map((a) => (
            <button type="button" key={a} className={a === aspect ? 'active' : ''} onClick={() => p.onAspect(a)} title={ASPECTS[a].label}>
              <span className={`ratio ratio-${a}`} />
              {ASPECTS[a].label.split(' ')[0]}
            </button>
          ))}
        </div>
        <label className="label">القالب اللوني</label>
        <div className="presets">
          {PRESETS.map((pr) => (
            <button
              type="button"
              key={pr.id}
              className={`preset ${pr.id === style.preset ? 'active' : ''}`}
              style={{ background: pr.theme.background, color: pr.theme.foreground, fontFamily: cssFamily(FONTS.find((f) => f.id === pr.font)!) }}
              onClick={() => p.onStyle({ preset: pr.id, font: pr.font, transition: pr.transition, background: pr.background }, pr.theme)}
            >
              <span className="sw" style={{ background: pr.theme.accent }} />
              <span className="sw" style={{ background: pr.theme.accent2 }} />
              {pr.label}
            </button>
          ))}
        </div>
        <label className="label">ألوان الهوية</label>
        <div className="colors">
          {([
            ['background', 'الخلفية'],
            ['surface', 'البطاقات'],
            ['foreground', 'النص'],
            ['accent', 'أساسي'],
            ['accent2', 'ثانوي'],
          ] as const).map(([k, label]) => (
            <label key={k} className="color">
              <input type="color" value={theme[k]} onChange={(e) => p.onTheme({ [k]: e.target.value.toUpperCase() })} />
              <span>{label}</span>
            </label>
          ))}
        </div>
        {lowContrast && <p className="warn">⚠️ تباين النص مع الخلفية منخفض وقد يصعب قراءته.</p>}

        <label className="label">الخط</label>
        <div className="fonts">
          {FONTS.map((f) => (
            <button type="button" key={f.id} className={f.id === style.font ? 'active' : ''} style={{ fontFamily: cssFamily(f) }} onClick={() => p.onStyle({ font: f.id })}>
              {f.label.split(' (')[0]}
            </button>
          ))}
        </div>

        <label className="label">الأرقام</label>
        <div className="seg">
          <button type="button" className={style.digits === 'arabic' ? 'active' : ''} onClick={() => p.onStyle({ digits: 'arabic' })}>
            هندية ١٢٣
          </button>
          <button type="button" className={style.digits === 'latin' ? 'active' : ''} onClick={() => p.onStyle({ digits: 'latin' })}>
            عربية 123
          </button>
        </div>

        <label className="label">سرعة الحركة</label>
        <div className="seg">
          {([['calm', 'هادئة'], ['balanced', 'متوازنة'], ['fast', 'سريعة']] as const).map(([id, label]) => (
            <button type="button" key={id} className={style.pace === id ? 'active' : ''} onClick={() => p.onStyle({ pace: id })}>
              {label}
            </button>
          ))}
        </div>

        <label className="label">الانتقال بين المشاهد</label>
        <div className="seg">
          {TRANSITIONS.map((t) => (
            <button type="button" key={t.id} className={style.transition === t.id ? 'active' : ''} onClick={() => p.onStyle({ transition: t.id })}>
              {t.label}
            </button>
          ))}
        </div>

        <label className="label">الخلفية المتحركة</label>
        <div className="seg">
          {BACKGROUNDS.map((b) => (
            <button type="button" key={b.id} className={style.background === b.id ? 'active' : ''} onClick={() => p.onStyle({ background: b.id })}>
              {b.label}
            </button>
          ))}
        </div>
      </section>

      <section className="box">
        <h2>
          <span className="step">٣</span> الصوت
        </h2>
        <div className="seg">
          {MUSIC_OPTIONS.map((m) => (
            <button
              type="button"
              key={m.id}
              className={style.music === m.id ? 'active' : ''}
              onClick={() => p.onStyle({ music: m.id })}
            >
              {m.label}
            </button>
          ))}
        </div>
        <span className="label">التعليق الصوتي (اختياري)</span>
        <label className="upload">
          <input type="file" accept="audio/*" onChange={(e) => { p.onAudioFile(e.target.files?.[0] ?? null); e.target.value = ''; }} />
          🎙 {p.customAudioName ? `تعليقك: ${p.customAudioName}` : 'ارفع تسجيل صوتك للعرض (MP3 / M4A / WAV)'}
        </label>
        {p.customAudioName && (
          <button type="button" className="danger" onClick={() => p.onAudioFile(null)}>
            حذف التعليق الصوتي
          </button>
        )}
        <label className="check">
          <input type="checkbox" checked={style.sfx} onChange={(e) => p.onStyle({ sfx: e.target.checked })} />
          مؤثرات صوتية تلقائية عند ظهور العناصر
        </label>
        <p className="muted small">يمكن الجمع بين الموسيقى والتعليق الصوتي؛ تنخفض الموسيقى تلقائيًا تحت صوتك. الموسيقى والمؤثرات مولّدة داخل متصفحك وخالية من حقوق النشر، وتسجيلك لا يُرفع لأي خادم (يُقص إذا زاد عن دقيقتين).</p>
      </section>
    </aside>
  );
}
