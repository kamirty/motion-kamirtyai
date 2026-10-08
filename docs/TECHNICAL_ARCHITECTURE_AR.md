# التصور المعماري — Kamirty Motion

## 1. الطبقات
1) React + TypeScript + Vite UI: إدخال الوصف، تعديل المخطط، قائمة القوالب، شريط زمني ومعاينة.
2) Prompt Parser (محلي، حتمي في MVP): تقسيم جمل، تحديد عناوين، أرقام، تواريخ، ترتيب ونبرة؛ لا يدّعي فهمًا دلاليًا عامًا أو توليد حقائق غير مقدمة.
3) Scene Planner: توزيع المحتوى، اختيار القوالب من مكتبة، اقتراح أيقونات مع مراجعة المستخدم، حفظ كائن Project قابل للتصدير.
4) Timeline Core: توقيت بوحدات الإطارات integers، حساب تجميع المدد، انتقالات وسرعات محكومة.
5) Frame Renderer: `renderFrame(project, frameIndex, canvas2DContext)` نقي حتمي قدر المستطاع؛ يُستخدم للمعاينة والتصدير.
6) Encoder Adapter: feature-detect ثم Mediabunny `CanvasSource`, `Mp4OutputFormat`, `WebMOutputFormat`, tracks; دعم AAC عند إدخال الصوت مستقبلاً؛ فصل التحريك عن صيغة الترميز.
7) Local Persistence: JSON import/export، تخزين نسخة تحرير تلقائية في IndexedDB ضمن حدود المتصفح.

## 2. قاعدة تصميم أساسية
**لا نسختين من محرك الرسم.** ممنوع Preview في HTML/CSS وExport في Canvas منفصل، لأن المشاهد لن تتطابق. الرسم الإطاري الحتمي هو المرجع لكل منهما؛ واجهة التحرير React فقط.

## 3. عقد المشروع
انظر `schemas/project.v1.schema.json`. `durationFrames: 3600`, `fps: 30`، ولكل مشهد `startFrame` و`durationFrames`. التحقق من عدم التداخل ومن ملء كامل الخط الزمني يتم بمدقّق تطبيقي منفصل؛ JSON Schema وحده لا يكفي للتحقق من المجموع.

## 4. نمط رسم العربية
- خطوط محلية تدعم العربية، وتأكّد من اكتمال تحميلها قبل الرندر.
- `ctx.direction = 'rtl'` مع `textAlign` مدروس وقياس النص.
- أسطر بمقاييس حقيقية وحدود آمنة، RTL / LTR مختلط، لا عكس للأحرف يدويًا.
- تجنب emoji كأيقونات أساسية؛ استعمل SVG مرخّصًا ويمكن توحيد أسلوبه.

## 5. استراتيجية الترميز
- فحص H.264 + AAC إن توفر وشرط MP4 (الصوت غير إلزامي في MVP).
- فحص VP8/VP9 مع WebM بديلًا عند الحاجة.
- استخدام timestamps مشتقة من frameIndex / fps، لا ساعة العرض الحية.
- الحد من انتظار Queue في encoder ومن الذاكرة؛ دعم الإلغاء وإزالة الموارد بعد التصدير.
- لا تبدأ بتصدير 4K أو `ffmpeg.wasm`؛ اختبر 720p أولاً.
- حفظ مباشر إلى القرص إن دعم المتصفح ذلك، وإلا تنزيل Blob بعد التصدير وفق حدود الذاكرة.

## 6. البيانات والأمن
- لا إرسال للنصوص أو الملفات إلى API خارجي.
- لا HTML غير معقّم من مدخلات المستخدم ولا `eval`.
- لا استضافة أصول من روابط المستخدم في MVP.
- تقييد الوصف وطول العناوين وعدد المشاهد والملفات المستوردة؛ التحقق من schema/version.
- فصل ملفات ترخيص المكتبات والخطوط والأيقونات في المشروع.

## 7. الاستضافة والنشر
- GitHub مستودع واحد، الفروع لكل مهمة، مراجعة Pull Request قبل الدمج.
- نشر ملفات `/dist` إلى Cloudflare Pages، لا Pages Functions ولا Workers في النسخة الأساسية.
- اختبار pages.dev أولاً ثم ربط CNAME لـ motion.kamirtyai.com عند مزود DNS.
- رابط مباشر في Blogger؛ لا تعديل على استضافة جاوب أو DNS الخاص بها.

## 8. تسلسل المجلدات المقترح
```
src/
  app/                 # navigation and editor shell
  components/          # inputs, timeline, inspector, preview
  domain/              # project types, validators, frame timing
  engine/
    parser/            # deterministic Arabic parser
    planner/           # storyboard creation
    templates/         # reusable layouts
    renderer/          # frame renderer and text layout
    export/            # Mediabunny adapters and feature detection
  storage/             # JSON and optional IndexedDB
  styles/              # Arabic UI and fonts
  tests/               # functional and rendering tests
```

## 9. قرارات مؤجلة ADRs
- رفع رسوم أو استعمال مزود API خارجي: ممنوع دون تغيير صريح في سياسة التكلفة.
- محرك صوت Piper: لاحقًا بعد مراجعة ترخيص النموذج وقدرة تشغيله في المتصفح.
- نماذج Transformers.js المحلية: بعد القياس، كخيار وليس شرطًا للتشغيل.
- Remotion: ليس ضمن النواة؛ راجع طبيعة الترخيص وحالات الاستخدام قبل التفكير بإضافته.
