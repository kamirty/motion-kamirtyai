import { describe, expect, it } from 'vitest';
import { KIND_LABELS } from '../app/components/kinds';
import { EXAMPLES } from '../app/examples';
import { IDEA_TEMPLATE_COUNT, suggestIdeas } from '../assistant/ideas';
import { normalizeArabic } from '../design/arabic';
import { ICONS, iconById, suggestIcon } from '../design/icons';
import { validateTimeline } from '../domain/timeline';
import type { Scene, SceneKind } from '../domain/types';
import { generateProject } from '../engine/planner';
import {
  PENDING_FALLBACK, applyPendingFallback, buildStoryboard, buildStoryboardRaw, type DraftScene,
} from '../engine/parser/storyboard';
import {
  chapterHeading, clampWords, extractTopic, isListLine, leadMark, optionLabel, splitSentences, stripMarker,
} from '../engine/parser/text';
import {
  chartRows, comparisonBars, kpiParts, pictogramRatio, prosCons, quizParts, valueRow,
} from '../engine/sceneModel';

const opts = { aspect: 'landscape' as const, style: {} };
const fold = (s: string) => normalizeArabic(s).replace(/[^\p{L}\p{N}%٪]+/gu, '');

/** A description with a title line, as a visitor would type it. */
const doc = (...lines: string[]) => ['عنوان الفيديو', ...lines].join('\n');
/**
 * Content scenes (no hero/outro, no bracketed guide scenes added to thin descriptions) with the
 * kinds the parser detected, before PENDING_FALLBACK.
 */
function content(text: string): DraftScene[] {
  const board = buildStoryboardRaw(text);
  const scenes = board.scenes.slice(1, -1);
  return board.usedPlaceholders ? scenes.filter((s) => !s.items.some((i) => i.startsWith('['))) : scenes;
}
const kindsOf = (text: string): SceneKind[] => content(text).map((s) => s.kind);
/** The single scene of `kind` the description produces. */
function one(text: string, kind: SceneKind): DraftScene {
  const found = content(text).filter((s) => s.kind === kind);
  expect(found, `${kind} in ${JSON.stringify(content(text).map((s) => [s.kind, s.title, s.items]))}`).toHaveLength(1);
  return found[0];
}
const asScene = (d: DraftScene): Scene => ({ id: 's1', kind: d.kind, startFrame: 0, durationFrames: 300, title: d.title, items: d.items, icon: d.icon });

/** Every item of every content scene must be text that appears in the description. */
function expectNoInventedItems(text: string, scenes: DraftScene[] = content(text)): void {
  const source = fold(text);
  for (const s of scenes) {
    for (const item of s.items) {
      const piece = fold(item.replace(/…$/, ''));
      expect(source.includes(piece), `${s.kind}: "${item}" not in source`).toBe(true);
    }
  }
}

/** Visitor-written text for each placeholder, so filled outlines read like real descriptions. */
const SAMPLES: [RegExp, string[]][] = [
  [/وحدة/, ['ساعات']],
  [/الوضع الحالي/, ['يستخدم 60% من سكان العالم هذه التقنية اليوم']],
  [/اقتباس|قول مأثور/, ['العلم نور والجهل ظلام دامس']],
  [/الإجابة الصحيحة/, ['المشتري']],
  [/خيار/, ['المريخ', 'زحل', 'عطارد', 'الزهرة']],
  [/سؤال|اكتب السؤال/, ['ما أكبر كواكب المجموعة الشمسية']],
  [/السنة|الحدث/, ['اختراع أول جهاز من هذا النوع', 'انتشاره في المدارس', 'وصوله إلى الهواتف']],
  [/الفئة/, ['الطلاب', 'المعلمون', 'أولياء الأمور']],
];
const GENERIC = [
  'تحسين جودة الحياة اليومية', 'توفير الوقت والجهد', 'تقوية التركيز في الدراسة', 'حماية البيئة من التلوث',
  'تنظيم الوقت بين الدراسة والراحة', 'مشاركة المعرفة مع الأصدقاء', 'الاستفادة من مصادر موثوقة',
];
const NUMBERS = ['71', '40', '8', '45', '35', '20', '7'];

/** An idea outline with every [placeholder] and 00 replaced, in order, by sample visitor text. */
function fill(outline: string): string {
  const used = new Map<string, number>();
  let g = 0;
  const next = (key: string, pool: string[]) => {
    const n = used.get(key) ?? 0;
    used.set(key, n + 1);
    return pool[n % pool.length];
  };
  let n = 0;
  return outline
    .replace(/\[([^\]]+)\]/g, (_, inner: string) => {
      const hit = SAMPLES.find(([re]) => re.test(inner));
      return hit ? next(hit[0].source, hit[1]) : GENERIC[g++ % GENERIC.length];
    })
    .replace(/(?<![0-9])0{1,2}(?![0-9])/g, () => NUMBERS[n++ % NUMBERS.length]);
}

/** One description that uses every detection rule for the new scene kinds. */
const RICH = doc(
  'هل تعلم أن 60% من جسم الإنسان ماء؟',
  'المصدر: منظمة WHO',
  'نصيحة: اشرب كوبًا عند الاستيقاظ',
  'ما هي الطاقة المتجددة؟',
  'هي طاقة من مصادر لا تنفد، ومن أمثلتها:',
  '- الشمس',
  '- الرياح',
  'تعريف التضخم: ارتفاع عام في الأسعار.',
  'ما أكبر كوكب؟',
  'أ) الأرض',
  'ب) المشتري',
  'الإجابة: ب',
  '## المزايا',
  '- تواصل سريع',
  '✓ لا يحتاج إلى مكتب',
  '## العيوب',
  '- تشتت',
  'قائمة تجهيز الحقيبة:',
  '☐ جواز السفر',
  '☐ الشاحن USB',
  'مراحل دورة الماء:',
  '- التبخر',
  '- التكاثف',
  '- الهطول',
  'هرم ماسلو:',
  '- تحقيق الذات',
  '- التقدير',
  '- الأمان',
  'الجزء الثاني: الأرقام',
  'يستخدم 5.4 مليار شخص الإنترنت.',
  'يقضي المستخدم ٦ ساعات يوميًا.',
  '71% من الشباب يملكون هاتفًا.',
  'توزيع الوقت:',
  '- النوم: 40%',
  '- الدراسة: 35%',
  '- اللعب: 25%',
  '7 من كل 10 طلاب يستخدمون الهاتف قبل النوم.',
  'ظهر الحاسوب ENIAC عام 1946 وكان يزن 27 طنًا.',
  'قال أينشتاين: «الخيال أهم من المعرفة»',
);

describe('storyboard parser', () => {
  it('extracts the topic from a request sentence', () => {
    expect(extractTopic('أريد فيديو إنفوجرافيك عن فوائد القراءة')).toBe('فوائد القراءة');
    expect(extractTopic('اعمل لي فيديو تعليمي يشرح دورة الماء في الطبيعة.')).toBe('دورة الماء في الطبيعة');
    expect(extractTopic('صمم انفوجرافيك عن الذكاء الاصطناعي')).toBe('الذكاء الاصطناعي');
  });

  it('splits Arabic sentences on Arabic punctuation', () => {
    expect(splitSentences('هذه جملة. وهذه أخرى؟ وثالثة!')).toHaveLength(3);
  });

  it.each(EXAMPLES.map((e) => [e.label, e.text]))('example %s produces a valid, varied 120 s project', (_, text) => {
    const { project, usedPlaceholders } = generateProject(text, opts);
    expect(usedPlaceholders).toBe(false);
    expect(validateTimeline(project)).toEqual([]);
    expect(project.scenes.length).toBeGreaterThanOrEqual(5);
    expect(project.scenes.length).toBeLessThanOrEqual(20);
    expect(project.scenes[0].kind).toBe('hero');
    expect(project.scenes.at(-1)!.kind).toBe('outro');
    expect(new Set(project.scenes.map((s) => s.kind)).size).toBeGreaterThanOrEqual(4);
    for (const s of project.scenes) expect(iconById(s.icon), `${s.kind}:${s.icon}`).toBeDefined();
  });

  it('does not invent facts: content items come from the description', () => {
    for (const ex of EXAMPLES) expectNoInventedItems(ex.text);
  });

  it('recognises stats, steps, bars, timeline, quote and question scenes', () => {
    const kinds = (t: string) => buildStoryboard(t).scenes.map((s) => s.kind);
    expect(kinds(EXAMPLES[0].text)).toEqual(expect.arrayContaining(['stat', 'steps', 'quote']));
    expect(kinds(EXAMPLES[2].text)).toEqual(expect.arrayContaining(['timeline', 'summary']));
    expect(kinds(EXAMPLES[3].text)).toEqual(expect.arrayContaining(['comparison', 'stat', 'steps']));
    const qa = buildStoryboard('الصحة\nلماذا ننام؟ لأن النوم يجدد الطاقة.');
    expect(qa.scenes[1]).toMatchObject({ kind: 'summary', title: 'لماذا ننام؟' });
    const cmp = buildStoryboard('الطاقة\nالطاقة الشمسية نظيفة ومتجددة بينما الفحم يلوث الهواء.');
    expect(cmp.scenes[1].kind).toBe('comparison');
    expect(cmp.scenes[1].items).toHaveLength(2);
  });

  it('keeps Arabic-Indic digits and mixed Latin terms in stat values', () => {
    const b = buildStoryboard('العنوان\nيستخدم ٨٥٪ من الطلاب تطبيقات AI يوميًا.');
    const stat = b.scenes.find((s) => s.kind === 'stat')!;
    expect(stat.items[0]).toBe('٨٥٪');
    expect(stat.items[1]).toContain('AI');
  });

  it('adds clearly marked guide scenes for a one-line idea', () => {
    const { project, usedPlaceholders } = generateProject('أريد فيديو عن فوائد القراءة', opts);
    expect(usedPlaceholders).toBe(true);
    expect(project.title).toBe('فوائد القراءة');
    expect(validateTimeline(project)).toEqual([]);
    expect(project.scenes.some((s) => s.items.some((i) => i.startsWith('[')))).toBe(true);
  });

  it('handles empty, huge and hostile input without throwing', () => {
    const hostile = [
      '', '   ', '<script>alert(1)</script>', 'أ'.repeat(10000), '1. \n2. \n- ', '٪٪٪ ::: ---',
      'هل تعلم؟', 'نصيحة:', 'ما هو ؟', 'تعريف :', '- ✗\n- ✓\n- *', 'الإجابة: ب', '##\n## \n###', '0 من 0\n1 من 0',
      `x\nهل ${'لماذا '.repeat(60)}؟`, `x\nما هو ${'X'.repeat(300)}؟\n${'تعريف '.repeat(80)}`,
      `x\nسؤال؟\n${Array.from({ length: 12 }, (_, i) => `- خيار ${i} ✓`).join('\n')}`,
      `x\nالمزايا:\n${'- ميزة <b>غامقة</b>\n'.repeat(15)}العيوب:\n${'- عيب\n'.repeat(15)}`,
      `x\n${Array.from({ length: 40 }, (_, i) => `${i + 1}% من الطلاب.`).join('\n')}`,
    ];
    for (const t of hostile) {
      const { project } = generateProject(t, opts);
      expect(validateTimeline(project), t.slice(0, 30)).toEqual([]);
      for (const s of project.scenes) {
        expect(s.title.length).toBeLessThanOrEqual(160);
        s.items.forEach((i) => expect(i.length, `${s.kind}: ${i.slice(0, 30)}`).toBeLessThanOrEqual(160));
      }
      for (const s of buildStoryboardRaw(t).scenes) {
        s.items.forEach((i) => expect(i.length, `${s.kind}: ${i.slice(0, 30)}`).toBeLessThanOrEqual(160));
      }
    }
  });

  it('is deterministic', () => {
    expect(generateProject(EXAMPLES[1].text, opts)).toEqual(generateProject(EXAMPLES[1].text, opts));
  });
});

describe('pending fallback', () => {
  const rich = doc(
    'هل تعلم أن 60% من جسم الإنسان ماء؟',
    'ما هي الطاقة المتجددة؟',
    'هي طاقة من مصادر لا تنفد مثل الشمس.',
    'مراحل دورة الماء:',
    '- التبخر',
    '- التكاثف',
    '- الهطول',
  );

  it('buildStoryboard is buildStoryboardRaw with PENDING_FALLBACK applied', () => {
    for (const t of [rich, ...EXAMPLES.map((e) => e.text)]) {
      expect(buildStoryboard(t)).toEqual(applyPendingFallback(buildStoryboardRaw(t)));
    }
  });

  it('maps only the kinds listed in PENDING_FALLBACK and nothing else', () => {
    const raw = buildStoryboardRaw(rich);
    const before = raw.scenes.map((s) => s.kind);
    expect(before).toEqual(expect.arrayContaining(['tip', 'definition', 'cycle']));
    const after = applyPendingFallback(buildStoryboardRaw(rich)).scenes.map((s) => s.kind);
    before.forEach((k, i) => expect(after[i]).toBe(PENDING_FALLBACK[k] ?? k));
    for (const k of after) expect(PENDING_FALLBACK[k], k).toBeUndefined();
  });
});

describe('text helpers', () => {
  it('reads list markers, marks and option labels', () => {
    for (const l of ['- عنصر', '• عنصر', '* عنصر', '+ ميزة', '1. أول', '٢) ثاني', '(3) ثالث', 'أ) خيار', 'ب- خيار', '✓ تم', '☐ مهمة', '✗ عيب']) {
      expect(isListLine(l), l).toBe(true);
    }
    for (const l of ['1990: حدث', 'الإجابة: ب', 'نص عادي', '+5 درجات', 'أحمد ذهب']) expect(isListLine(l), l).toBe(false);
    expect(stripMarker('- ✗ يشتت الانتباه')).toBe('يشتت الانتباه');
    expect(stripMarker('٣. فعّل 2FA')).toBe('فعّل 2FA');
    expect(leadMark('- ✗ عيب')).toBe('✗');
    expect(leadMark('+ ميزة')).toBe('+');
    expect(leadMark('– عيب')).toBe('-');
    expect(leadMark('☑ تم')).toBe('☑');
    expect(leadMark('1. خطوة')).toBe('');
    expect(optionLabel('أ) الأرض')).toBe('ا');
    expect(optionLabel('ب. المشتري')).toBe('ب');
    expect(optionLabel('٢) زحل')).toBe('2');
    expect(optionLabel('- زحل')).toBe('');
  });

  it('clamps text to the limit, ellipsis included, without cutting words when it can', () => {
    const long = 'كلمة '.repeat(50).trim();
    for (const max of [20, 59, 60, 160]) {
      const out = clampWords(long, max);
      expect(out.length).toBeLessThanOrEqual(max);
      expect(out.endsWith('كلمة…')).toBe(true);
    }
    expect(clampWords('X'.repeat(300), 160)).toHaveLength(160);
    expect(clampWords('قصير', 10)).toBe('قصير');
  });

  it('recognises section headings but not sentences', () => {
    expect(chapterHeading('## الأسباب')).toBe('الأسباب');
    expect(chapterHeading('### مكونات الحاسوب ##')).toBe('مكونات الحاسوب');
    expect(chapterHeading('الجزء الأول: المشكلة')).toBe('الجزء الأول: المشكلة');
    expect(chapterHeading('القسم ٢ - التطبيقات')).toBe('القسم ٢ - التطبيقات');
    expect(chapterHeading('الفصل الثالث')).toBe('الفصل الثالث');
    expect(chapterHeading('أولًا: الأسباب')).toBe('أولًا: الأسباب');
    expect(chapterHeading('ثانياً - الحلول')).toBe('ثانياً - الحلول');
    expect(chapterHeading('الجزء الأول من القصة بدأ في الخمسينيات.')).toBeNull();
    expect(chapterHeading('أولًا: النوم الجيد يحسن التركيز.')).toBeNull();
    expect(chapterHeading('المزايا')).toBeNull();
  });
});

describe('tip scenes', () => {
  it('turns "هل تعلم أن …؟" into a tip and keeps a source note', () => {
    const tip = one(doc('هل تعلم أن 60% من جسم الإنسان ماء؟', 'المصدر: منظمة WHO'), 'tip');
    expect(tip.title).toBe('هل تعلم؟');
    expect(tip.items).toEqual(['60% من جسم الإنسان ماء', 'المصدر: منظمة WHO']);
    expect(tip.icon).toBe('lightbulb');
  });

  it('reads the next sentence when "هل تعلم؟" stands alone, in any person', () => {
    expect(one(doc('هل تعلم؟', 'يحتاج الجسم إلى ٨ أكواب يوميًا.'), 'tip').items).toEqual(['يحتاج الجسم إلى ٨ أكواب يوميًا']);
    expect(one(doc('هل تعلمون أن الجمل يشرب 100 لتر في 10 دقائق؟'), 'tip').items).toEqual(['الجمل يشرب 100 لتر في 10 دقائق']);
    expect(one(doc('هل تعلمين بأن الـ DNA يحمل الصفات الوراثية؟'), 'tip').items).toEqual(['الـ DNA يحمل الصفات الوراثية']);
  });

  it('turns "نصيحة: …" and "نصيحة اليوم: …" into tips titled by the user', () => {
    expect(one(doc('نصيحة: لا تؤجل شرب الماء حتى تشعر بالعطش'), 'tip')).toMatchObject({ title: 'نصيحة', items: ['لا تؤجل شرب الماء حتى تشعر بالعطش'] });
    expect(one(doc('نصيحة اليوم: اشرب كوبًا من الماء عند الاستيقاظ.'), 'tip')).toMatchObject({ title: 'نصيحة اليوم', items: ['اشرب كوبًا من الماء عند الاستيقاظ'] });
  });

  it('accepts an emoji before the tip words', () => {
    expect(one(doc('💡 نصيحة: لا ترد على المتنمر واحتفظ بالأدلة.'), 'tip')).toMatchObject({ title: 'نصيحة', items: ['لا ترد على المتنمر واحتفظ بالأدلة'] });
    expect(one(doc('✨هل تعلم أن الشمس أكبر من الأرض 109 مرات؟'), 'tip').items).toEqual(['الشمس أكبر من الأرض 109 مرات']);
  });

  it('does not make tips from other sentences', () => {
    expect(kindsOf(doc('نصيحتي لك أن تشرب الماء'))).not.toContain('tip');
    expect(kindsOf(doc('النصيحة الذهبية هي الاعتدال.'))).not.toContain('tip');
    // "Do you know how …?" asks a question; the next sentence answers it.
    const q = content(doc('هل تعلم كيف تتكون السحب؟ تتكون من بخار الماء المتكثف.'));
    expect(q.map((s) => s.kind)).not.toContain('tip');
    expect(q[0]).toMatchObject({ kind: 'summary', title: 'هل تعلم كيف تتكون السحب؟', items: ['تتكون من بخار الماء المتكثف.'] });
    expect(kindsOf(doc('هل تعلم لماذا ننام 8 ساعات؟', 'لأن الدماغ يحتاج إلى الراحة.'))).not.toContain('tip');
  });

  it('falls back to plain text when the tip is too long for a card', () => {
    const long = `هل تعلم أن ${'الهاتف الذكي اليوم أقوى من حواسيب رحلة Apollo بملايين المرات '.repeat(3)}؟`;
    const scenes = content(doc(long));
    expect(scenes.map((s) => s.kind)).not.toContain('tip');
    for (const s of scenes) s.items.forEach((i) => expect(i.length).toBeLessThanOrEqual(160));
  });
});

describe('definition scenes', () => {
  it('turns "ما هي X؟" + answer into a definition without the leading pronoun', () => {
    const d = one(doc('ما هي الطاقة المتجددة؟', 'هي طاقة تأتي من مصادر لا تنفد مثل الشمس والرياح.'), 'definition');
    expect(d).toMatchObject({ title: 'الطاقة المتجددة', items: ['طاقة تأتي من مصادر لا تنفد مثل الشمس والرياح'] });
  });

  it('accepts Latin terms and "ما معنى / ماذا يعني" questions', () => {
    expect(one(doc('ما هو الـ AI؟', 'هو قدرة الحاسوب على محاكاة التفكير البشري.'), 'definition').title).toBe('الـ AI');
    expect(one(doc('ما معنى كلمة CPU؟', 'وحدة المعالجة المركزية في الحاسوب.'), 'definition').title).toBe('CPU');
    expect(one(doc('ماذا يعني مصطلح التضخم؟', 'ارتفاع عام في أسعار السلع والخدمات بنسبة ٥٪ مثلًا.'), 'definition'))
      .toMatchObject({ title: 'التضخم', items: ['ارتفاع عام في أسعار السلع والخدمات بنسبة ٥٪ مثلًا'] });
  });

  it('reads "تعريف X: …" inline or with the meaning and examples on the next lines', () => {
    expect(one(doc('تعريف التمثيل الضوئي: عملية يصنع بها النبات غذاءه باستخدام ضوء الشمس.'), 'definition'))
      .toMatchObject({ title: 'التمثيل الضوئي', items: ['عملية يصنع بها النبات غذاءه باستخدام ضوء الشمس'] });
    const d = one(doc('تعريف البناء الضوئي:', 'عملية يصنع بها النبات غذاءه.', 'أمثلة:', '- القمح', '- الذرة'), 'definition');
    expect(d.items).toEqual(['عملية يصنع بها النبات غذاءه', 'القمح', 'الذرة']);
  });

  it('takes examples from an answer that introduces a list', () => {
    const text = doc('ما هي الطاقة المتجددة؟', 'هي طاقة من مصادر لا تنفد، ومن أمثلتها:', '- الشمس', '- الرياح', '- المياه');
    expect(one(text, 'definition')).toMatchObject({ title: 'الطاقة المتجددة', items: ['طاقة من مصادر لا تنفد', 'الشمس', 'الرياح', 'المياه'] });
    expect(kindsOf(text)).toEqual(['definition']);
  });

  it('reads "ومن أمثلة فوائده:" and "ومن أشكالها:" as the start of an examples list', () => {
    expect(one(doc('ما هو النوم العميق؟', 'مرحلة من النوم يتباطأ فيها نشاط الدماغ، ومن أمثلة فوائده:', '- إصلاح العضلات', '- تثبيت الذاكرة'), 'definition'))
      .toMatchObject({ title: 'النوم العميق', items: ['مرحلة من النوم يتباطأ فيها نشاط الدماغ', 'إصلاح العضلات', 'تثبيت الذاكرة'] });
    expect(one(doc('ما هي الطاقة المتجددة؟', 'طاقة نظيفة، ومن أشكالها:', '- الشمسية', '- الرياح'), 'definition').items[0]).toBe('طاقة نظيفة');
    // "لها أنواع كثيرة" names no examples list; the meaning is not cut mid-sentence.
    expect(kindsOf(doc('ما هي الطاقة المتجددة؟', 'هي طاقة لها أنواع كثيرة:', '- الشمسية', '- الرياح'))).not.toContain('definition');
  });

  it('does not define lists, amounts or years', () => {
    expect(kindsOf(doc('ما هي فوائد الرياضة؟', 'تقوي القلب وتحسن المزاج.'))).not.toContain('definition');
    expect(kindsOf(doc('ما هي نسبة الأكسجين في الهواء؟', 'حوالي 21% من الهواء.'))).not.toContain('definition');
    expect(kindsOf(doc('ما هو عام 2030؟', 'هو عام رؤية المملكة.'))).not.toContain('definition');
    expect(kindsOf(doc('ما هي الطاقة؟', 'ما مصادرها؟'))).not.toContain('definition');
  });
});

describe('quiz scenes', () => {
  /** The quiz drawer's view of the single quiz scene. */
  const quiz = (text: string) => {
    const s = one(text, 'quiz');
    return { title: s.title, ...quizParts(asScene(s)) };
  };

  it('reads lettered options with a "الإجابة: ب" line', () => {
    const text = doc('ما أكبر كوكب في المجموعة الشمسية؟', 'أ) الأرض', 'ب) المشتري', 'ج) المريخ', 'الإجابة: ب');
    expect(quiz(text)).toEqual({ title: 'ما أكبر كوكب في المجموعة الشمسية؟', options: ['الأرض', 'المشتري', 'المريخ'], answer: 1 });
    // The answer line is consumed, not shown as its own card.
    expect(kindsOf(text)).toEqual(['quiz']);
  });

  it('reads ✓ and * marks inside an option, in either digit system', () => {
    expect(quiz(doc('ما أكبر كوكب؟', '- الأرض', '- المشتري ✓', '- المريخ'))).toMatchObject({ options: ['الأرض', 'المشتري', 'المريخ'], answer: 1 });
    expect(quiz(doc('كم عدد كواكب المجموعة الشمسية؟', '١. ٧', '٢. ٨ *', '٣. ٩'))).toMatchObject({ options: ['٧', '٨', '٩'], answer: 1 });
    expect(quiz(doc('ما أكبر كوكب؟', '- الأرض', '✓ المشتري', '- زحل')).answer).toBe(1);
  });

  it('matches the answer line by number or by option text', () => {
    expect(quiz(doc('ما أكبر كوكب؟', '1) الأرض', '2) المشتري', '3) زحل', 'الإجابة: 2')).answer).toBe(1);
    expect(quiz(doc('ما أكبر كوكب؟', 'أ- الأرض', 'ب- المشتري', 'الجواب: المشتري')).answer).toBe(1);
    expect(quiz(doc('أي مما يلي يعد كوكبًا غازيًا:', '- عطارد', '- زحل', '- المريخ', 'الإجابة الصحيحة: زحل')))
      .toEqual({ title: 'أي مما يلي يعد كوكبًا غازيًا', options: ['عطارد', 'زحل', 'المريخ'], answer: 1 });
  });

  it('accepts question headings and strips a "السؤال:" prefix', () => {
    expect(quiz(doc('اختر الإجابة الصحيحة:', '- الشمس نجم ✓', '- القمر نجم'))).toMatchObject({ title: 'اختر الإجابة الصحيحة', answer: 0 });
    expect(quiz(doc('السؤال: ما هو أقرب كوكب للشمس؟', '- عطارد ✓', '- الزهرة')).title).toBe('ما هو أقرب كوكب للشمس؟');
  });

  it('marks exactly one answer with ✓ for the drawer', () => {
    const s = one(doc('ما وحدة قياس سرعة الإنترنت؟', '- GB', '- Mbps *', '- KM'), 'quiz');
    expect(s.items).toEqual(['GB', 'Mbps ✓', 'KM']);
    expect(s.items.filter((i) => i.includes('✓'))).toHaveLength(1);
  });

  it('needs exactly one marked answer', () => {
    // No mark: the question titles the list instead.
    expect(one(doc('ما أهم كواكب المجموعة الشمسية؟', '- الأرض', '- المشتري', '- زحل'), 'summary').title).toBe('ما أهم كواكب المجموعة الشمسية؟');
    // "*" used as every bullet is not an answer mark.
    expect(kindsOf(doc('ما أكبر كوكب؟', '* الأرض', '* المشتري', '* زحل'))).not.toContain('quiz');
    // Two marked answers.
    expect(kindsOf(doc('ما أكبر كوكب؟', '- الأرض ✓', '- المشتري ✓', '- زحل'))).not.toContain('quiz');
    // An answer line that matches no option.
    expect(kindsOf(doc('ما أكبر كوكب؟', '- الأرض', '- المشتري', 'الإجابة: نبتون'))).not.toContain('quiz');
  });
});

describe('pros and cons scenes', () => {
  const sides = (s: DraftScene) => {
    const pc = prosCons(asScene(s));
    return { pros: pc.pros.map((p) => p.text), cons: pc.cons.map((c) => c.text) };
  };

  it('pairs a pros list with a cons list and marks cons with ✗', () => {
    const s = one(doc('المزايا:', '- تواصل سريع مع العائلة', '- تعلم عبر تطبيقات مثل Duolingo', 'العيوب:', '- يشتت الانتباه', '- لا يناسب الأطفال قبل ٦ سنوات'), 'proscons');
    expect(s.title).toBe('المزايا والعيوب');
    expect(s.items).toEqual(['تواصل سريع مع العائلة', 'تعلم عبر تطبيقات مثل Duolingo', '✗ يشتت الانتباه', '✗ لا يناسب الأطفال قبل ٦ سنوات']);
    expect(sides(s)).toEqual({ pros: ['تواصل سريع مع العائلة', 'تعلم عبر تطبيقات مثل Duolingo'], cons: ['يشتت الانتباه', 'لا يناسب الأطفال قبل ٦ سنوات'] });
  });

  it('pairs other side names in either order', () => {
    expect(sides(one(doc('فوائد الرياضة:', '- تقوي القلب', '- تحسن النوم', 'أضرار الخمول:', '- السمنة', '- ضعف العضلات'), 'proscons')))
      .toEqual({ pros: ['تقوي القلب', 'تحسن النوم'], cons: ['السمنة', 'ضعف العضلات'] });
    expect(sides(one(doc('افعل:', '- اشرب الماء', '- نم مبكرًا', 'لا تفعل:', '- السهر', '- الإفراط في السكر'), 'proscons')))
      .toEqual({ pros: ['اشرب الماء', 'نم مبكرًا'], cons: ['السهر', 'الإفراط في السكر'] });
    expect(sides(one(doc('الإيجابيات:', '- مرونة', 'السلبيات:', '- عزلة'), 'proscons'))).toEqual({ pros: ['مرونة'], cons: ['عزلة'] });
    expect(sides(one(doc('العيوب:', '- يشتت الانتباه', '- يسبب الأرق', 'المزايا:', '- تواصل سريع'), 'proscons')))
      .toEqual({ pros: ['تواصل سريع'], cons: ['يشتت الانتباه', 'يسبب الأرق'] });
  });

  it('pairs markdown "## المزايا" and "## العيوب" headings', () => {
    const text = doc('## المزايا', '- تواصل سريع', '- تعلم ذاتي', '## العيوب', '- تشتت', '- أرق');
    expect(kindsOf(text)).toEqual(['proscons']);
    expect(sides(one(text, 'proscons'))).toEqual({ pros: ['تواصل سريع', 'تعلم ذاتي'], cons: ['تشتت', 'أرق'] });
  });

  it('splits one list by "لا" under a heading that names both sides', () => {
    const s = one(doc('مزايا وعيوب العمل عن بعد:', '- توفير وقت التنقل', '- مرونة في المواعيد', '- لا يوجد تواصل مباشر مع الزملاء'), 'proscons');
    expect(s.title).toBe('مزايا وعيوب العمل عن بعد');
    expect(sides(s)).toEqual({ pros: ['توفير وقت التنقل', 'مرونة في المواعيد'], cons: ['لا يوجد تواصل مباشر مع الزملاء'] });
  });

  it('reads +/- and ✓/✗ bullets, keeping a "لا …" pro on the pro side', () => {
    expect(sides(one(doc('العمل عن بعد:', '+ توفير وقت التنقل', '+ مرونة في المواعيد', '- عزلة اجتماعية'), 'proscons')))
      .toEqual({ pros: ['توفير وقت التنقل', 'مرونة في المواعيد'], cons: ['عزلة اجتماعية'] });
    const s = one(doc('العمل عن بعد:', '✓ توفير 2 ساعة يوميًا', '✓ لا يحتاج إلى مكتب', '✗ عزلة اجتماعية'), 'proscons');
    expect(s.items).toEqual(['توفير 2 ساعة يوميًا', '✓ لا يحتاج إلى مكتب', '✗ عزلة اجتماعية']);
    expect(sides(s)).toEqual({ pros: ['توفير 2 ساعة يوميًا', 'لا يحتاج إلى مكتب'], cons: ['عزلة اجتماعية'] });
  });

  it('splits long lists evenly, keeping both sides in every scene', () => {
    const text = doc('المزايا:', '- أ1', '- ب2', '- ج3', '- د4', 'العيوب:', '- هـ5', '- و6', '- ز7', '- ح8');
    const scenes = content(text);
    expect(scenes.map((s) => s.kind)).toEqual(['proscons', 'proscons']);
    expect(scenes.map((s) => s.title)).toEqual(['المزايا والعيوب (1)', 'المزايا والعيوب (2)']);
    expect(sides(scenes[0])).toEqual({ pros: ['أ1', 'ب2'], cons: ['هـ5', 'و6'] });
    expect(sides(scenes[1])).toEqual({ pros: ['ج3', 'د4'], cons: ['ز7', 'ح8'] });
    const uneven = content(doc('المزايا:', '- ميزة 1', '- ميزة 2', '- ميزة 3', '- ميزة 4', '- ميزة 5', 'العيوب:', '- عيب 1', '- عيب 2'));
    expect(uneven.map((s) => sides(s))).toEqual([
      { pros: ['ميزة 1', 'ميزة 2', 'ميزة 3'], cons: ['عيب 1'] },
      { pros: ['ميزة 4', 'ميزة 5'], cons: ['عيب 2'] },
    ]);
  });

  it('moves the extra items of a much longer side to a follow-up scene instead of dropping them', () => {
    const scenes = content(doc('المزايا:', ...Array.from({ length: 8 }, (_, i) => `- ميزة رقم ${i + 1}`), 'العيوب:', '- عيب واحد فقط'));
    expect(scenes.map((s) => [s.kind, s.title])).toEqual([['proscons', 'المزايا والعيوب'], ['summary', 'المزايا والعيوب (تتمة)']]);
    expect(sides(scenes[0])).toEqual({ pros: ['ميزة رقم 1', 'ميزة رقم 2', 'ميزة رقم 3', 'ميزة رقم 4', 'ميزة رقم 5'], cons: ['عيب واحد فقط'] });
    expect(scenes[1].items).toEqual(['ميزة رقم 6', 'ميزة رقم 7', 'ميزة رقم 8']);
    const cons = content(doc('المزايا:', '- ميزة واحدة', 'العيوب:', ...Array.from({ length: 7 }, (_, i) => `- عيب رقم ${i + 1}`)));
    expect(sides(cons[0]).pros).toEqual(['ميزة واحدة']);
    expect(sides(cons[0]).cons).toHaveLength(5);
    expect(cons[1].items).toEqual(['✗ عيب رقم 6', '✗ عيب رقم 7']);
  });

  it('never invents a side', () => {
    expect(kindsOf(doc('فوائد الشاي الأخضر:', '- غني بمضادات الأكسدة', '- لا يحتوي على سعرات', '- ينشط الذهن'))).toEqual(['summary']);
    expect(kindsOf(doc('المزايا:', '- مرونة', '- سرعة'))).toEqual(['summary']);
  });
});

describe('checklist scenes', () => {
  it('uses checklist headings', () => {
    expect(one(doc('قائمة تجهيز الحقيبة:', '- جواز السفر', '- الشاحن USB', '- الأدوية'), 'checklist'))
      .toMatchObject({ title: 'قائمة تجهيز الحقيبة', items: ['جواز السفر', 'الشاحن USB', 'الأدوية'] });
    expect(one(doc('قبل أن تبدأ تأكد من:', '- إغلاق النوافذ', '- فصل الكهرباء'), 'checklist').title).toBe('قبل أن تبدأ تأكد من');
    expect(one(doc('Checklist السفر:', '- التذاكر', '- الجواز'), 'checklist').items).toEqual(['التذاكر', 'الجواز']);
  });

  it('uses check boxes on every item', () => {
    expect(one(doc('☐ جواز السفر', '☐ الشاحن', '☑ التذاكر'), 'checklist').items).toEqual(['جواز السفر', 'الشاحن', 'التذاكر']);
    expect(one(doc('- ✓ جواز السفر', '- ✓ الشاحن', '- ✓ التذاكر'), 'checklist').title).toBe('قائمة التحقق');
  });

  it('keeps steps and mixed lists out of checklists', () => {
    expect(kindsOf(doc('خطوات التحقق من الحساب:', '1. افتح الإعدادات', '2. اختر الأمان', '3. فعّل المصادقة الثنائية 2FA'))).toEqual(['steps']);
    expect(kindsOf(doc('☐ جواز السفر', '- الشاحن', '- التذاكر'))).not.toContain('checklist');
  });

  it('splits long checklists evenly', () => {
    const items = ['الجواز', 'التذاكر', 'الشاحن', 'الأدوية', 'النقود', 'المظلة', 'الكتاب'];
    const scenes = content(doc('قائمة السفر:', ...items.map((i) => `- ${i}`)));
    expect(scenes.map((s) => [s.kind, s.items.length])).toEqual([['checklist', 4], ['checklist', 3]]);
  });
});

describe('cycle, pyramid and steps lists', () => {
  const list = (heading: string, n = 4) => doc(`${heading}:`, ...['التبخر', 'التكاثف', 'الهطول', 'الجريان', 'التسرب', 'النتح', 'الذوبان'].slice(0, n).map((i) => `- ${i}`));

  it('draws cycles from cycle headings with 3 to 6 stages', () => {
    expect(one(list('مراحل دورة الماء'), 'cycle').items).toEqual(['التبخر', 'التكاثف', 'الهطول', 'الجريان']);
    expect(kindsOf(doc('دورة حياة الفراشة:', '1. البيضة', '2. اليرقة', '3. الشرنقة', '4. الفراشة'))).toEqual(['cycle']);
    expect(kindsOf(list('كيف تعمل دورة الماء', 3))).toEqual(['cycle']);
    expect(kindsOf(list('الدورة الزراعية', 6))).toEqual(['cycle']);
    expect(kindsOf(list('دورة حياة الفراشة', 2))).toEqual(['summary']);
    expect(kindsOf(list('مراحل دورة الماء', 7))).not.toContain('cycle');
  });

  it('does not take courses or step lists for cycles', () => {
    expect(kindsOf(list('الدورة التدريبية تشمل', 3))).toEqual(['summary']);
    expect(kindsOf(list('دورة المياه', 3))).toEqual(['summary']);
    expect(kindsOf(doc('خطوات التسجيل في الدورة التدريبية:', '1. افتح الموقع', '2. املأ النموذج', '3. ادفع الرسوم'))).toEqual(['steps']);
    // A topic word later in the heading does not override what the heading lists.
    expect(kindsOf(doc('خطوات فهم دورة الماء:', '1. التبخر', '2. التكاثف', '3. الهطول'))).toEqual(['steps']);
    expect(kindsOf(list('نصائح لحماية دورة الماء', 3))).toEqual(['steps']);
  });

  it('draws pyramids from hierarchy and priority headings', () => {
    expect(one(doc('هرم ماسلو للاحتياجات:', '- تحقيق الذات', '- التقدير', '- الانتماء', '- الأمان', '- الحاجات الفسيولوجية'), 'pyramid').items).toHaveLength(5);
    expect(kindsOf(list('الهرم الغذائي'))).toEqual(['pyramid']);
    expect(kindsOf(list('مستويات الطاقة في السلسلة الغذائية'))).toEqual(['pyramid']);
    expect(kindsOf(list('أولويات المذاكرة', 3))).toEqual(['pyramid']);
    expect(kindsOf(list('أولويات دورة الماء'))).toEqual(['pyramid']);
  });

  it('does not take pyramids for other lists', () => {
    expect(kindsOf(list('الأهرامات في مصر', 3))).toEqual(['summary']);
    expect(kindsOf(list('خطوات رفع مستويات الطاقة', 3))).toEqual(['steps']);
    expect(kindsOf(list('الهرم الغذائي', 2))).toEqual(['summary']);
  });

  it('makes steps from numbered lists and step headings, split evenly', () => {
    expect(one(doc('مراحل نمو النبات:', '- البذرة', '- الإنبات', '- النمو'), 'steps').title).toBe('مراحل نمو النبات');
    expect(one(doc('نصائح للمذاكرة:', '- نم 8 ساعات', '- خطط ليومك'), 'steps').items).toEqual(['نم 8 ساعات', 'خطط ليومك']);
    const six = content(doc('1. افتح', '2. اكتب', '3. احفظ', '4. أرسل', '5. راجع', '6. انشر'));
    expect(six.map((s) => [s.kind, s.title, s.items.length])).toEqual([['steps', 'الخطوات (1)', 3], ['steps', 'الخطوات (2)', 3]]);
    const five = content(doc('فوائد المشي:', '- يقوي القلب', '- يحسن المزاج', '- يحرق السعرات', '- يقلل التوتر', '- يحسن النوم'));
    expect(five.map((s) => [s.kind, s.title, s.items.length])).toEqual([['summary', 'فوائد المشي (1)', 3], ['summary', 'فوائد المشي (2)', 2]]);
  });
});

describe('number scenes', () => {
  it('draws shares of a whole as a donut the drawer can read', () => {
    const s = one(doc('مصادر الطاقة في العالم:', '- النفط: 31%', '- الفحم: 27%', '- الغاز: 23%', '- المتجددة: 19%'), 'donut');
    expect(s.title).toBe('مصادر الطاقة في العالم');
    expect(chartRows(asScene(s)).map((r) => [r.label, r.num])).toEqual([['النفط', 31], ['الفحم', 27], ['الغاز', 23], ['المتجددة', 19]]);
    const indic = one(doc('توزيع وقت الطالب:', '- النوم: ٤٠٪', '- الدراسة: ٣٥٪', '- الهاتف: ٢٥٪'), 'donut');
    expect(indic.items.map((i) => valueRow(i)?.num)).toEqual([40, 35, 25]);
  });

  it('keeps percentages that are not shares of one whole as bars', () => {
    const s = one(doc('نسبة رضا العملاء:', '- المتجر أ: 80%', '- المتجر ب: 65%'), 'comparison');
    expect(comparisonBars(asScene(s))!.map((r) => r.value)).toEqual(['80%', '65%']);
    expect(kindsOf(EXAMPLES[3].text)).toContain('comparison');
    const speed = one(doc('سرعة الإنترنت:', '- 4G: 20 ميغابت', '- 5G: 300 ميغابت'), 'comparison');
    expect(comparisonBars(asScene(speed))!.map((r) => [r.label, r.num])).toEqual([['4G', 20], ['5G', 300]]);
  });

  it('draws series over years and many plain amounts as columns', () => {
    expect(chartRows(asScene(one(doc('عدد المستخدمين بالمليون:', '- 2019: 45', '- 2020: 60', '- 2021: 82'), 'columns'))).map((r) => r.num)).toEqual([45, 60, 82]);
    const years = one(doc('2019: 45 مليون', '2020: 60 مليون', '٢٠٢١: ٨٢ مليون'), 'columns');
    expect(years.items).toEqual(['2019: 45 مليون', '2020: 60 مليون', '٢٠٢١: ٨٢ مليون']);
    expect(chartRows(asScene(years)).map((r) => r.num)).toEqual([45, 60, 82]);
    expect(kindsOf(doc('المبيعات حسب الفرع:', '- الرياض: 120', '- جدة: 95', '- الدمام: 70', '- مكة: 55'))).toEqual(['columns']);
    expect(kindsOf(doc('المبيعات حسب الفرع:', '- الرياض: 120', '- جدة: 95', '- الدمام: 70'))).toEqual(['comparison']);
  });

  it('draws small whole-number ratios as pictograms', () => {
    const s = one(doc('7 من كل 10 طلاب يستخدمون الهاتف قبل النوم.'), 'pictogram');
    expect(s.items).toEqual(['7 من كل 10', '7 من كل 10 طلاب يستخدمون الهاتف قبل النوم']);
    expect(pictogramRatio(s.items[0])).toEqual({ filled: 7, total: 10 });
    expect(pictogramRatio(one(doc('٣ من ١٠ أطفال يعانون من قصر النظر.'), 'pictogram').items[0])).toEqual({ filled: 3, total: 10 });
    expect(pictogramRatio(one(doc('يمارس 25 من كل 50 موظفًا الرياضة.'), 'pictogram').items[0])).toEqual({ filled: 50, total: 100 });
    // "من أصل" becomes a pictogram only when the drawer can read it; otherwise the number stays a stat.
    const ofTotal = kindsOf(doc('يمارس 25 من أصل 50 موظفًا الرياضة.'));
    expect(ofTotal).toEqual([pictogramRatio('25 من أصل 50') ? 'pictogram' : 'stat']);
    expect(one(doc('احذر: 3 من 5 حوادث سببها الهاتف.'), 'pictogram').title).toBe('تنبيه مهم');
  });

  it('does not draw impossible or huge ratios as pictograms', () => {
    expect(kindsOf(doc('حصل الطالب على 15 من 10.'))).not.toContain('pictogram');
    expect(kindsOf(doc('يعيش 8 من أصل 1000 شخص في الجزر.'))).not.toContain('pictogram');
    expect(kindsOf(doc('سجل 0 من 10 طلاب غيابًا اليوم.'))).not.toContain('pictogram');
  });

  it('groups three or more short stats into KPI tiles the drawer can split', () => {
    const text = doc('يستخدم 5.4 مليار شخص الإنترنت.', 'يقضي المستخدم ٦ ساعات يوميًا على الشاشات.', '71% من الشباب يملكون هاتفًا ذكيًا.');
    const s = one(text, 'kpis');
    expect(kindsOf(text)).toEqual(['kpis']);
    expect(s.items.map((i) => kpiParts(i).value)).toEqual(['5.4 مليار', '٦ ساعات', '71%']);
    for (const i of s.items) expect(kpiParts(i).label.length).toBeGreaterThan(3);
  });

  it('balances long KPI runs and keeps strong warnings separate', () => {
    const five = content(doc('يستخدم 5.4 مليار شخص الإنترنت.', 'يقضي المستخدم ٦ ساعات يوميًا.', '71% من الشباب يملكون هاتفًا.', 'يتصفح 60% الإنترنت من الهاتف.', 'يرسل العالم 300 مليار رسالة يوميًا.'));
    expect(five.map((s) => [s.kind, s.items.length])).toEqual([['kpis', 3], ['kpis', 2]]);
    const broken = kindsOf(doc('يستخدم 5.4 مليار شخص الإنترنت.', 'احذر من مشاركة كلمة المرور، فـ 80% من الاختراقات سببها كلمات مرور ضعيفة.', '71% من الشباب يملكون هاتفًا.'));
    expect(broken).toEqual(['stat', 'stat', 'stat']);
    expect(kindsOf(doc('يستخدم 5.4 مليار شخص الإنترنت.', '71% من الشباب يملكون هاتفًا.'))).toEqual(['stat', 'stat']);
  });

  it('finds the headline number past years and Latin model names', () => {
    expect(one(doc('ظهر أول حاسوب إلكتروني ENIAC عام 1946 وكان يزن 27 طنًا.'), 'stat').items[0]).toBe('27 طن');
    expect(one(doc('شبكات 5G أسرع من 4G بنحو 10 مرات.'), 'stat').items[0]).toBe('10 مرات');
    expect(one(doc('3 وجبات متوازنة تكفي الطالب يوميًا.'), 'stat').items[0]).toBe('3');
    // A count that announces a list is not a statistic.
    expect(kindsOf(doc('3 نصائح للنوم الجيد', '- نم مبكرًا', '- أطفئ الشاشات'))).not.toContain('stat');
    expect(kindsOf(doc('ولد العالم ابن سينا عام 980 ميلادية.', 'وألّف كتبًا كثيرة.'))).not.toContain('stat');
    expect(kindsOf(doc('يعيش 8 من أصل 1000 شخص في الجزر.'))).not.toContain('stat');
  });
});

describe('chapters, timelines, quotes and comparisons', () => {
  it('opens sections from markdown, numbered-part and ordinal headings', () => {
    const md = content(doc('## البدايات', 'ظهر الحاسوب ENIAC عام 1946.', '## العصر الحديث', 'يحمل كل شخص حاسوبًا في جيبه.'));
    expect(md.filter((s) => s.kind === 'chapter').map((s) => s.title)).toEqual(['البدايات', 'العصر الحديث']);
    expect(md.filter((s) => s.kind === 'chapter').every((s) => s.items.length === 0)).toBe(true);
    expect(kindsOf(doc('الجزء الأول: المشكلة', 'تهدر الأسر 30% من طعامها.', 'الجزء الثاني: الحل', 'خطط لمشترياتك قبل التسوق.')))
      .toEqual(['chapter', 'stat', 'chapter', 'summary']);
    expect(kindsOf(doc('أولًا: الأسباب', 'الإسراف في الشراء.', 'ثانيًا: الحلول', 'التخطيط المسبق.'))[0]).toBe('chapter');
  });

  it('keeps runs of ordinal points and headings inside sentences as text', () => {
    expect(kindsOf(doc('أولًا: النوم الجيد يحسن التركيز', 'ثانيًا: الرياضة تقوي الذاكرة', 'ثالثًا: الماء يحافظ على النشاط'))).not.toContain('chapter');
    expect(kindsOf(doc('الجزء الأول من القصة بدأ في الخمسينيات.', 'تطور الحاسوب سريعًا.'))).not.toContain('chapter');
  });

  it('uses a section title to shape the list right under it', () => {
    expect(kindsOf(doc('## دورة الماء', '- التبخر', '- التكاثف', '- الهطول'))).toEqual(['chapter', 'cycle']);
    expect(kindsOf(doc('الجزء الثاني: هرم الغذاء', '- الدهون', '- البروتين', '- الحبوب'))).toEqual(['chapter', 'pyramid']);
  });

  it('does not count section breaks as content', () => {
    const b = buildStoryboardRaw(doc('## مقدمة', 'الماء أساس الحياة.'));
    expect(b.usedPlaceholders).toBe(true);
    expect(b.scenes.at(-2)!.kind).not.toBe('chapter');
  });

  it('builds timelines from year lines in either digit system, split evenly', () => {
    const t = one(doc('1990: اختراع الويب على يد Tim Berners-Lee', '٢٠٠٤: إطلاق Facebook', '2007: إطلاق iPhone'), 'timeline');
    expect(t.items).toEqual(['1990: اختراع الويب على يد Tim Berners-Lee', '٢٠٠٤: إطلاق Facebook', '2007: إطلاق iPhone']);
    const six = content(doc(...[1990, 1995, 2000, 2005, 2010, 2015].map((y) => `${y}: حدث مهم في عام ${y}`)));
    expect(six.map((s) => [s.kind, s.items.length])).toEqual([['timeline', 3], ['timeline', 3]]);
  });

  it('reads quotes with the speaker before or after', () => {
    expect(one(doc('"العقل السليم في الجسم السليم" - مثل عربي'), 'quote')).toMatchObject({ title: 'العقل السليم في الجسم السليم', items: ['مثل عربي'] });
    expect(one(doc('قال أينشتاين: «الخيال أهم من المعرفة»'), 'quote')).toMatchObject({ title: 'الخيال أهم من المعرفة', items: ['أينشتاين'] });
    expect(one(doc('«العلم نور والجهل ظلام»'), 'quote').items).toEqual([]);
    expect(kindsOf(doc('«لا»', 'كلمة قصيرة.'))).not.toContain('quote');
  });

  it('splits comparisons on بينما, مقابل and vs', () => {
    expect(one(doc('الهاتف الذكي سريع ومتعدد الاستخدامات بينما الحاسوب أقوى في المهام الثقيلة.'), 'comparison').items)
      .toEqual(['الهاتف الذكي سريع ومتعدد الاستخدامات', 'الحاسوب أقوى في المهام الثقيلة']);
    expect(one(doc('الألياف الضوئية vs الأقمار الصناعية'), 'comparison').items).toEqual(['الألياف الضوئية', 'الأقمار الصناعية']);
    expect(one(doc('سرعة 5G تصل إلى 10 Gbps مقابل 100 Mbps في شبكات 4G.'), 'comparison').items).toEqual(['سرعة 5G تصل إلى 10 Gbps', '100 Mbps في شبكات 4G']);
  });

  it('flags warnings with an alert scene', () => {
    expect(one(doc('انتبه من الروابط المجهولة في البريد.'), 'summary')).toMatchObject({ title: 'تنبيه مهم', icon: 'triangle-alert' });
  });

  it('does not invent facts in any of the new scene kinds', () => {
    const kinds = new Set(kindsOf(RICH));
    for (const k of ['tip', 'definition', 'quiz', 'proscons', 'checklist', 'cycle', 'pyramid', 'chapter', 'kpis', 'donut', 'pictogram', 'stat', 'quote'] as SceneKind[]) {
      expect(kinds.has(k), k).toBe(true);
    }
    expectNoInventedItems(RICH);
  });
});

describe('assistant idea outlines', () => {
  const LABEL_TO_KIND = new Map(Object.entries(KIND_LABELS).map(([kind, label]) => [label, kind as SceneKind]));
  /** "تنبيه" is a warning: a summary scene titled «تنبيه مهم». Others are the inspector's kind labels. */
  const advertised = (label: string) => (label === 'تنبيه' ? 'warning' : LABEL_TO_KIND.get(label));
  const shown = (scenes: DraftScene[]) => new Set<string>([
    ...scenes.map((s) => s.kind),
    ...scenes.filter((s) => s.title === 'تنبيه مهم').map(() => 'warning'),
  ]);

  const TOPICS = ['دورة الماء', 'الطاقة الشمسية', 'الذكاء الاصطناعي AI', 'هرم الغذاء', 'أولويات المذاكرة'];
  const ideas = (topic: string) => suggestIdeas(topic, 0, IDEA_TEMPLATE_COUNT);

  it('advertises only kinds the editor knows', () => {
    for (const idea of ideas('الماء')) {
      for (const label of idea.kinds) expect(advertised(label), `${idea.title}: ${label}`).toBeDefined();
    }
    expect(ideas('الماء')).toHaveLength(IDEA_TEMPLATE_COUNT);
  });

  it.each(TOPICS)('every filled outline about "%s" yields the kinds it advertises', (topic) => {
    for (const idea of ideas(topic)) {
      const text = fill(idea.outline);
      expect(text, idea.title).not.toMatch(/[[\]]/);
      const board = buildStoryboardRaw(text);
      expect(board.usedPlaceholders, idea.title).toBe(false);
      const got = shown(board.scenes);
      for (const label of idea.kinds) {
        expect(got.has(advertised(label)!), `${idea.title} → ${label}: ${board.scenes.map((s) => s.kind).join(', ')}`).toBe(true);
      }
      expectNoInventedItems(text, board.scenes.slice(1, -1));
    }
  });

  it('keeps structural kinds even before the visitor fills the placeholders', () => {
    for (const topic of TOPICS) {
      for (const idea of ideas(topic)) {
        const board = buildStoryboardRaw(idea.outline);
        expect(board.usedPlaceholders, idea.title).toBe(false);
        const got = shown(board.scenes);
        // Charts need real numbers; every other advertised kind comes from the outline's structure.
        for (const label of idea.kinds.filter((l) => !['أرقام سريعة', 'دائرة نسب', 'رسم بالأيقونات'].includes(l))) {
          expect(got.has(advertised(label)!), `${idea.title} → ${label}`).toBe(true);
        }
        expectNoInventedItems(idea.outline, board.scenes.slice(1, -1));
      }
    }
  });

  it('hands the drawers data in the format they read', () => {
    const byTitle = (topic: string, re: RegExp) => ideas(topic).find((i) => re.test(i.title))!;
    const scenesOf = (topic: string, re: RegExp) => buildStoryboardRaw(fill(byTitle(topic, re).outline)).scenes;

    const pc = scenesOf('الهاتف', /المزايا والعيوب/).find((s) => s.kind === 'proscons')!;
    const sides = prosCons(asScene(pc));
    expect([sides.pros.length, sides.cons.length]).toEqual([3, 2]);
    expect(pc.items.filter((i) => i.startsWith('✗ '))).toHaveLength(2);

    const quizzes = scenesOf('الفضاء', /^تحدي/).filter((s) => s.kind === 'quiz');
    expect(quizzes.map((q) => quizParts(asScene(q)).answer)).toEqual([1, 0, 2]);
    for (const q of quizzes) expect(quizParts(asScene(q)).options).toEqual(expect.arrayContaining(['المشتري']));

    const numbers = scenesOf('الماء', /بالأرقام$/);
    const donut = numbers.find((s) => s.kind === 'donut')!;
    expect(chartRows(asScene(donut)).map((r) => r.num)).toEqual([45, 35, 20]);
    const kpis = numbers.find((s) => s.kind === 'kpis')!;
    expect(kpis.items.map((i) => kpiParts(i).value)).toEqual(['71%', '40 مليون', '8 ساعات']);
    expect(pictogramRatio(numbers.find((s) => s.kind === 'pictogram')!.items[0])).toEqual({ filled: 7, total: 10 });

    const lesson = scenesOf('الجاذبية', /^درس/);
    expect(lesson.find((s) => s.kind === 'definition')!.title).toBe('الجاذبية');
    expect(lesson.find((s) => s.kind === 'steps')!.items).toHaveLength(3);

    const pyramid = scenesOf('الغذاء', /^هرم/).find((s) => s.kind === 'pyramid')!;
    expect(pyramid.items).toHaveLength(4);
  });
});

describe('drawer contract', () => {
  const corpus = [
    RICH,
    ...EXAMPLES.map((e) => e.text),
    ...['الماء', 'دورة الماء', 'هرم الغذاء', 'الذكاء الاصطناعي AI'].flatMap((t) => suggestIdeas(t, 0, IDEA_TEMPLATE_COUNT).map((i) => fill(i.outline))),
    doc('المزايا:', ...Array.from({ length: 8 }, (_, i) => `- ميزة رقم ${i + 1}`), 'العيوب:', '- عيب واحد'),
    doc('في عام 2023 بلغ عدد المستخدمين 5 مليارات.', 'يقضي المستخدم ٦ ساعات يوميًا.', '71% من الشباب يملكون هاتفًا.', 'يرسل العالم 300 مليار رسالة.'),
    doc(...Array.from({ length: 9 }, (_, i) => `- الفرع ${i + 1}: ${(i + 1) * 10}`)),
  ];

  it('emits every scene in the shape its drawer reads', () => {
    for (const text of corpus) {
      for (const d of buildStoryboardRaw(text).scenes) {
        const s = asScene(d);
        const where = `${d.kind} «${d.title}» ${JSON.stringify(d.items)}`;
        expect(d.items.length, where).toBeLessThanOrEqual(6);
        switch (d.kind) {
          case 'kpis':
            expect(d.items.length, where).toBeGreaterThanOrEqual(2);
            for (const i of d.items) expect(kpiParts(i).value, where).toMatch(/[0-9٠-٩]/);
            break;
          case 'donut':
          case 'columns':
            for (const i of d.items) expect(valueRow(i), where).not.toBeNull();
            break;
          case 'pictogram':
            expect(pictogramRatio(d.items[0]), where).not.toBeNull();
            break;
          case 'quiz': {
            const q = quizParts(s);
            expect(q.answer, where).toBeGreaterThanOrEqual(0);
            expect(d.items.filter((i) => /[✓✔✅*]/u.test(i)), where).toHaveLength(1);
            expect(q.options.every((o) => o.length > 0), where).toBe(true);
            break;
          }
          case 'proscons': {
            const pc = prosCons(s);
            expect(pc.pros.length * pc.cons.length, where).toBeGreaterThan(0);
            expect(pc.pros.length + pc.cons.length, where).toBe(d.items.length);
            break;
          }
          case 'cycle':
          case 'pyramid':
            expect(d.items.length, where).toBeGreaterThanOrEqual(3);
            break;
          case 'definition':
          case 'tip':
            expect(d.items.length, where).toBeGreaterThanOrEqual(1);
            break;
          case 'chapter':
            expect(d.items, where).toEqual([]);
            break;
          case 'stat':
            expect(d.items[0], where).toMatch(/[0-9٠-٩]/);
            break;
          case 'timeline':
            for (const i of d.items) expect(i, where).toMatch(/^[0-9٠-٩]{4}: \S/);
            break;
          default:
            break;
        }
      }
    }
  });

  it('leaves a KPI out of a tile row when a year comes before its number', () => {
    const text = doc('في عام 2023 بلغ عدد المستخدمين 5 مليارات.', 'يقضي المستخدم ٦ ساعات يوميًا.', '71% من الشباب يملكون هاتفًا.', 'يرسل العالم 300 مليار رسالة.');
    const scenes = content(text);
    expect(scenes.map((s) => s.kind)).toEqual(['stat', 'kpis']);
    expect(scenes[0].items[0]).toBe('5 مليارات');
  });

  it('splits long bar lists evenly', () => {
    const scenes = content(doc(...Array.from({ length: 9 }, (_, i) => `- الفرع ${i + 1}: ${(i + 1) * 10}`)));
    expect(scenes.map((s) => [s.kind, s.items.length])).toEqual([['columns', 5], ['columns', 4]]);
    expect(scenes.map((s) => s.title)).toEqual(['مقارنة بالأرقام (1)', 'مقارنة بالأرقام (2)']);
  });
});

describe('icons', () => {
  it('has unique ids', () => {
    expect(new Set(ICONS.map((i) => i.id)).size).toBe(ICONS.length);
  });

  it('suggests icons from Arabic keywords', () => {
    expect(suggestIcon('فوائد شرب الماء', 'x')).toBe('droplet');
    expect(suggestIcon('التغذية الصحية', 'x')).toBe('salad');
    expect(suggestIcon('الذكاء الاصطناعي في التعليم', 'x')).toBe('brain-circuit');
    expect(suggestIcon('كلام عام', 'sparkles')).toBe('sparkles');
  });
});
