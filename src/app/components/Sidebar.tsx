import { localizeDigits } from '../../design/digits';
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
  { id: 'aurora', label: 'شفق' },
  { id: 'bubbles', label: 'فقاعات' },
  { id: 'plain', label: 'سادة' },
];

interface Props {
  description: string;
  onDescription: (v: string) => void;
  onGenerate: () => void;
  onTeacher: () => void;
  project: Project;
  onAspect: (a: AspectId) => void;
  onStyle: (patch: Partial<ProjectStyle>, theme?: Theme) => void;
  onTheme: (patch: Partial<Theme>) => void;
  customAudioName: string | null;
  onAudioFile: (file: File | null) => void;
  /** The visitor's own background music (null removes it). */
  onMusicFile: (file: File | null) => void;
  /** Narration length in seconds, when a narration is loaded. */
  voiceSeconds: number | null;
  onFitToVoice: () => void;
}

export function Sidebar(p: Props) {
  const style = styleOf(p.project);
  const theme = fullTheme(p.project.theme);
  const aspect = aspectOf(p.project.size);
  const lowContrast = contrast(theme.foreground, theme.background) < 4.5;
  const tooLong = p.description.length >= LIMITS.descriptionChars;

  return (
    <aside className="sidebar">
      <section className="box teacher-box">
        <h2>🧭 أنشئ فيديو خطوة بخطوة</h2>
        <p className="muted small">اختر ما تريد: 📚 درس تعليمي، 🎓 عرض مشروع، 🍽 إعلان مطعم أو متجر، 📢 حملة توعية. أجب عن ست خطوات قصيرة فيخرج فيديو كامل جاهز.</p>
        <button type="button" className="primary" onClick={p.onTeacher}>
          ابدأ الآن
        </button>
      </section>

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
            <li>«صح أم خطأ: العبارة» ثم «الإجابة: صح» يصبح مشهد <b>صح أم خطأ</b>، و«قبل: …» ثم «بعد: …» يصبح <b>قبل وبعد</b>، و«تحذير: …» يصبح <b>تنبيهًا</b>.</li>
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

        <label className="label">النمط البصري</label>
        <div className="seg">
          {([['modern', 'عصري', 'تدرجات وظلال ناعمة'], ['minimal', 'بسيط', 'ألوان مسطحة وخلفية هادئة'], ['cartoon', 'كرتوني', 'حدود سميكة وظلال بارزة']] as const).map(([id, label, hint]) => (
            <button type="button" key={id} title={hint} className={style.look === id ? 'active' : ''} aria-pressed={style.look === id} onClick={() => p.onStyle({ look: id })}>
              {label}
            </button>
          ))}
        </div>

        <label className="check">
          <input type="checkbox" checked={style.variety} onChange={(e) => p.onStyle({ variety: e.target.checked })} />
          نوّع حركة دخول المشاهد تلقائيًا (قفزة، مسح، دائرة، تأرجح…)
        </label>

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
          {style.musicAsset && (
            <button type="button" className={style.music === 'custom' ? 'active' : ''} aria-pressed={style.music === 'custom'} onClick={() => p.onStyle({ music: 'custom' })}>
              🎵 موسيقاي
            </button>
          )}
        </div>
        <label className="upload">
          <input type="file" accept="audio/*" onChange={(e) => { p.onMusicFile(e.target.files?.[0] ?? null); e.target.value = ''; }} />
          🎵 {style.musicAsset ? `موسيقاك: ${style.musicName ?? ''} (تغيير)` : 'لم تعجبك؟ أضف موسيقى من جهازك (MP3 / M4A / WAV)'}
        </label>
        {style.musicAsset && (
          <button type="button" className="ghost danger" onClick={() => p.onMusicFile(null)}>
            إزالة موسيقاي
          </button>
        )}
        <p className="muted small">موسيقاك تتكرر حتى نهاية الفيديو وتخفت في آخره، وتبقى على جهازك فقط. استخدم موسيقى تملك حق استخدامها حتى لا يُحذف فيديوك من يوتيوب أو غيره.</p>
        <span className="label">التعليق الصوتي (اختياري)</span>
        <p className="muted small">سجّل صوتك لكل مشهد من لوحة المشهد («🎙 سجّل تعليقًا صوتيًا»)، أو ارفع تسجيلًا واحدًا للفيديو كله:</p>
        <label className="upload">
          <input type="file" accept="audio/*" onChange={(e) => { p.onAudioFile(e.target.files?.[0] ?? null); e.target.value = ''; }} />
          🎙 {p.customAudioName ? `تعليقك: ${p.customAudioName}` : 'ارفع تسجيل صوتك للعرض (MP3 / M4A / WAV)'}
        </label>
        {p.customAudioName && (
          <button type="button" className="danger" onClick={() => p.onAudioFile(null)}>
            حذف التعليق الصوتي
          </button>
        )}
        {p.voiceSeconds !== null && (
          <button type="button" onClick={p.onFitToVoice}>
            ⏱ اجعل مدة الفيديو بطول تسجيلك ({localizeDigits(formatSeconds(p.voiceSeconds), style.digits)})
          </button>
        )}
        <label className="check">
          <input type="checkbox" checked={style.sfx} onChange={(e) => p.onStyle({ sfx: e.target.checked })} />
          مؤثرات صوتية تلقائية عند ظهور العناصر
        </label>
        <p className="muted small">يمكن الجمع بين الموسيقى والتعليق الصوتي؛ تنخفض الموسيقى تلقائيًا تحت صوتك. الموسيقى والمؤثرات مولّدة داخل متصفحك وخالية من حقوق النشر، وتسجيلك لا يُرفع لأي خادم. مدة الفيديو هي مجموع مدد المشاهد (حتى 10 دقائق).</p>
      </section>
    </aside>
  );
}

/** 95 → "1:35". */
function formatSeconds(sec: number): string {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
