import { describe, expect, it } from 'vitest';
import { EXAMPLES } from '../app/examples';
import { localizeDigits } from '../design/digits';
import { PRESETS, contrast } from '../design/presets';
import { sampleProject } from '../domain/sampleProject';
import { ASPECTS, SCENE_KINDS, type AspectId, type Project } from '../domain/types';
import { generateProject } from '../engine/planner';
import { formatStatValue, parseStatValue } from '../engine/renderer/numbers';
import { renderFrame } from '../engine/renderer/renderFrame';
import { wrapText } from '../engine/renderer/textLayout';
import { createFakeCtx, drawnText } from './fakeCtx';

const render = (project: Project, frame: number) => {
  const { ctx, ops } = createFakeCtx();
  renderFrame(project, frame, ctx);
  return ops;
};

describe('renderFrame', () => {
  it('is deterministic for the same frame', () => {
    // Warm the layout cache first: cached layouts skip measuring calls but draw identically.
    for (const f of [0, 37, 1200, 1300, 2999, 3599]) {
      render(sampleProject, f);
      expect(render(sampleProject, f)).toEqual(render(sampleProject, f));
    }
  });

  it('differs between frames (animation actually moves)', () => {
    expect(render(sampleProject, 20)).not.toEqual(render(sampleProject, 60));
  });

  it('sets RTL direction and draws Arabic text without reversing it', () => {
    const ops = render({ ...sampleProject, style: { digits: 'latin' } }, 600);
    expect(ops).toContain('direction="rtl"');
    const text = drawnText(ops).join(' ');
    expect(text).toContain('المياه على كوكب الأرض');
    expect(text).not.toContain('ضرلأا');
  });

  it('localises digits to Arabic-Indic and keeps Latin terms', () => {
    const text = drawnText(render({ ...sampleProject, style: { digits: 'arabic' } }, 1600)).join(' ');
    expect(text).toContain('٧١٪');
    expect(text).toContain('UN Water');
    expect(text).not.toMatch(/\b71%/);
  });

  it('renders every scene kind in every aspect, style and transition without throwing', () => {
    const base = generateProject(EXAMPLES[3].text, { aspect: 'landscape', style: {} }).project;
    const kinds = SCENE_KINDS.map((kind, i) => ({ ...base.scenes[i % base.scenes.length], kind, id: `k${i}` }));
    for (const aspect of Object.keys(ASPECTS) as AspectId[]) {
      for (const transition of ['fade', 'slide', 'zoom', 'wipe'] as const) {
        const p: Project = {
          ...base,
          size: { width: ASPECTS[aspect].width, height: ASPECTS[aspect].height },
          scenes: kinds.map((s, i) => ({ ...s, startFrame: i * 450, durationFrames: 450 })),
          style: { transition, background: (['gradient', 'dots', 'waves', 'plain'] as const)[kinds.length % 4] },
        };
        for (let f = 0; f < 3600; f += 61) expect(() => render(p, f)).not.toThrow();
      }
    }
  });

  it('renders at HD output size with the same draw calls (scaled)', () => {
    const { ctx, ops } = createFakeCtx();
    renderFrame(sampleProject, 500, ctx, { width: 1920, height: 1080 });
    expect(drawnText(ops)).toEqual(drawnText(render(sampleProject, 500)));
  });
});

describe('text layout', () => {
  it('wraps on word boundaries and never splits or reverses words', () => {
    const { ctx } = createFakeCtx();
    ctx.font = '400 20px x';
    const text = 'أغلق الصنبور أثناء تنظيف الأسنان باستخدام كوب ماء صغير';
    const lines = wrapText(ctx, text, 150);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(' ')).toBe(text);
  });
});

describe('digits and numbers', () => {
  it('parses western and Arabic-Indic digits and keeps affixes', () => {
    expect(formatStatValue(parseStatValue('71%')!, 35.5)).toBe('36%');
    const a = parseStatValue('٧١٪')!;
    expect(a.value).toBe(71);
    expect(formatStatValue(a, 71)).toBe('٧١٪');
    expect(formatStatValue(parseStatValue('1.5 مليار')!, 0.75)).toBe('0.8 مليار');
    expect(parseStatValue('1,200 طالب')!.value).toBe(1200);
    expect(parseStatValue('بدون رقم')).toBeNull();
  });

  it('converts between digit systems without touching words', () => {
    expect(localizeDigits('عام 2026 بنسبة 12.5% AI', 'arabic')).toBe('عام ٢٠٢٦ بنسبة ١٢٫٥٪ AI');
    expect(localizeDigits('عام ٢٠٢٦ بنسبة ١٢٫٥٪', 'latin')).toBe('عام 2026 بنسبة 12.5%');
  });
});

describe('presets', () => {
  it('keep readable contrast', () => {
    for (const p of PRESETS) {
      expect(contrast(p.theme.foreground, p.theme.background), p.id).toBeGreaterThanOrEqual(7);
      expect(contrast(p.theme.foreground, p.theme.surface), p.id).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.theme.accent, p.theme.background), p.id).toBeGreaterThanOrEqual(2.4);
    }
  });
});
