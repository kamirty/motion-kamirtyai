import type { Scene, SceneKind } from '../../domain/types';

/**
 * Representative Arabic content per scene kind (with numerals and Latin abbreviations) used by
 * tests and by the visual review harness. `long` variants stress wrapping and limits.
 */
export const KIND_SAMPLES: Partial<Record<SceneKind, { title: string; items: string[]; icon: string }[]>> = {
  kpis: [
    { title: 'أرقام سريعة عن الماء', items: ['71% من سطح الأرض', '3% مياه عذبة', '250 لترًا للفرد يوميًا', '2.2 مليار بلا مياه آمنة'], icon: 'droplet' },
    { title: 'إحصاءات AI في التعليم 2026', items: ['60% من الطلاب', '٤٥٪ من المعلمين', '1,200 مدرسة', '٣ ساعات أسبوعيًا', '8 تطبيقات', '90% رضا'], icon: 'brain-circuit' },
  ],
  donut: [
    { title: 'توزيع مياه الأرض', items: ['مياه مالحة: 97%', 'جليد وأنهار جليدية: 2%', 'مياه عذبة متاحة: 1%'], icon: 'droplet' },
    { title: 'كيف يقضي الطالب يومه؟', items: ['النوم: 33%', 'الدراسة: 25%', 'الهاتف والشاشات: 20%', 'الرياضة: 7%', 'الأسرة: 10%', 'أخرى: 5%'], icon: 'clock' },
  ],
  columns: [
    { title: 'استهلاك الفرد من الماء يوميًا (لتر)', items: ['الرياض: 263', 'دبي: 550', 'القاهرة: 180', 'مسقط: 220'], icon: 'chart-column' },
    { title: 'مستخدمو الإنترنت بالمليون', items: ['2016: 135', '2018: 164', '2020: 190', '2022: 220', '2024: 245', '2026: 270'], icon: 'wifi' },
  ],
  pictogram: [
    { title: 'من كل 10 طلاب', items: ['7 من 10', 'يستخدمون الهاتف أثناء المذاكرة'], icon: 'user' },
    { title: 'نسبة المياه العذبة', items: ['٣٪', 'فقط من مياه الكوكب صالحة للشرب، وفق UN Water'], icon: 'droplet' },
  ],
  cycle: [
    { title: 'دورة الماء في الطبيعة', items: ['التبخر', 'التكاثف', 'الهطول', 'الجريان'], icon: 'cloud-rain' },
    { title: 'دورة التعلم الفعّال', items: ['خطط لهدفك', 'تعلّم بتركيز 25 دقيقة', 'طبّق ما تعلمته عمليًا', 'راجع وقيّم تقدمك', 'شارك معرفتك مع غيرك', 'كافئ نفسك'], icon: 'recycle' },
  ],
  pyramid: [
    { title: 'هرم الغذاء الصحي', items: ['السكريات والدهون: قليلًا', 'البروتين والألبان', 'الخضار والفواكه', 'الحبوب الكاملة'], icon: 'salad' },
    { title: 'هرم ماسلو للاحتياجات', items: ['تحقيق الذات', 'التقدير', 'الانتماء والحب', 'الأمان', 'الاحتياجات الفسيولوجية: الطعام والماء والنوم'], icon: 'layers' },
  ],
  proscons: [
    { title: 'التعلم عن بُعد', items: ['مرونة في الوقت والمكان', 'توفير تكاليف التنقل', '✗ ضعف التفاعل المباشر', '✗ يحتاج انضباطًا ذاتيًا'], icon: 'laptop' },
    { title: 'استخدام AI في الواجبات', items: ['✓ شرح فوري للمفاهيم الصعبة', '✓ تدريب على أسئلة متنوعة', '✓ ترجمة المصادر', 'لا تنسخ الإجابات دون فهم', '- قد يعطي معلومات خاطئة', '× يضعف مهارة الكتابة'], icon: 'brain-circuit' },
  ],
  checklist: [
    { title: 'قبل الاختبار تأكد من', items: ['النوم 8 ساعات', 'تجهيز الأدوات والقلم', 'مراجعة الملخص', 'تناول فطور صحي'], icon: 'list-checks' },
    { title: 'قائمة السلامة الرقمية', items: ['كلمة مرور قوية من 12 حرفًا', 'تفعيل التحقق بخطوتين 2FA', 'تحديث التطبيقات باستمرار', 'عدم فتح الروابط المجهولة', 'نسخة احتياطية أسبوعية', 'مراجعة أذونات التطبيقات'], icon: 'shield-check' },
  ],
  quiz: [
    { title: 'كم نسبة المياه العذبة على الأرض؟', items: ['أ) 30%', 'ب) 3% ✓', 'ج) 50%'], icon: 'circle-help' },
    { title: 'أيّ مما يلي ليس من مصادر الطاقة المتجددة؟', items: ['الطاقة الشمسية', 'طاقة الرياح', 'الفحم الحجري *', 'الطاقة الحرارية الجوفية'], icon: 'zap' },
  ],
  definition: [
    { title: 'الذكاء الاصطناعي', items: ['قدرة الأنظمة الحاسوبية على أداء مهام تحتاج عادةً إلى ذكاء بشري كالفهم والتعلم واتخاذ القرار.', 'المساعدات الذكية', 'الترجمة الآلية', 'التعرف على الصور'], icon: 'brain-circuit' },
    { title: 'البصمة المائية', items: ['كمية المياه العذبة المستخدمة لإنتاج سلعة أو خدمة.'], icon: 'droplet' },
  ],
  chapter: [
    { title: 'الجزء الأول: المشكلة', items: ['لماذا نهدر الماء؟'], icon: 'flag' },
    { title: 'الحلول العملية', items: [], icon: 'lightbulb' },
  ],
  tip: [
    { title: 'هل تعلم؟', items: ['ترك الصنبور مفتوحًا أثناء تنظيف الأسنان يهدر حتى 12 لترًا في الدقيقة.', 'المصدر: UN Water 2026'], icon: 'lightbulb' },
    { title: 'نصيحة اليوم', items: ['استخدم تقنية بومودورو: 25 دقيقة تركيز ثم 5 دقائق راحة.'], icon: 'timer' },
  ],
};

/** Builds a scene from a sample for tests and the review harness. */
export function sampleScene(kind: SceneKind, variant = 0, durationFrames = 450): Scene {
  const s = KIND_SAMPLES[kind]?.[variant] ?? { title: 'عنوان', items: ['عنصر'], icon: 'sparkles' };
  return { id: `${kind}${variant}`, kind, startFrame: 0, durationFrames, title: s.title, items: [...s.items], icon: s.icon };
}
