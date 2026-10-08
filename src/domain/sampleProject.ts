import type { Project } from './types';

/** Fixed Milestone 0 project: three Arabic scenes of 40 s each (1200 frames). */
export const sampleProject: Project = {
  version: 1,
  title: 'المياه على كوكب الأرض',
  locale: 'ar',
  fps: 30,
  durationFrames: 3600,
  size: { width: 1280, height: 720 },
  theme: { background: '#0F1B2D', foreground: '#F4F7FB', accent: '#2EC4B6' },
  scenes: [
    {
      id: 'intro',
      kind: 'hero',
      startFrame: 0,
      durationFrames: 1200,
      title: 'المياه على كوكب الأرض',
      items: ['إنفوجرافيك تعليمي عن مصادر المياه واستهلاكها في 2026', 'إعداد: منصة KamirtyAI'],
      icon: 'droplet',
    },
    {
      id: 'fact',
      kind: 'stat',
      startFrame: 1200,
      durationFrames: 1200,
      title: 'نسبة سطح الأرض المغطاة بالمياه',
      items: ['71%', 'لكن أقل من 3% منها مياه عذبة صالحة للشرب، وفق تقديرات UN Water'],
      icon: 'chart-column',
    },
    {
      id: 'steps',
      kind: 'steps',
      startFrame: 2400,
      durationFrames: 1200,
      title: 'خمس خطوات لترشيد الاستهلاك',
      items: [
        'أغلق الصنبور أثناء تنظيف الأسنان',
        'أصلح التسريبات فورًا',
        'استخدم الغسالة بحمولة كاملة',
        'اسقِ النباتات صباحًا أو مساءً',
        'أعد استخدام مياه الشطف في الري',
      ],
      icon: 'list-ordered',
    },
  ],
};
