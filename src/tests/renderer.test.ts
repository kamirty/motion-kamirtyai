import { describe, expect, it } from 'vitest';
import { sampleProject } from '../domain/sampleProject';
import { formatStatValue, parseStatValue } from '../engine/renderer/numbers';
import { renderFrame } from '../engine/renderer/renderFrame';
import { wrapText } from '../engine/renderer/textLayout';
import { createFakeCtx } from './fakeCtx';

const render = (frame: number) => {
  const { ctx, ops } = createFakeCtx();
  renderFrame(sampleProject, frame, ctx);
  return ops;
};

describe('renderFrame', () => {
  it('is deterministic for the same frame', () => {
    for (const f of [0, 37, 1200, 1300, 2999, 3599]) expect(render(f)).toEqual(render(f));
  });

  it('differs between frames (animation actually moves)', () => {
    expect(render(20)).not.toEqual(render(60));
  });

  it('sets RTL direction and draws Arabic text without reversing it', () => {
    const ops = render(600);
    expect(ops).toContain('direction="rtl"');
    const drawn = ops.filter((o) => o.startsWith('fillText(')).join('\n');
    expect(drawn).toContain('المياه على كوكب الأرض');
    expect(drawn).not.toContain('ضرلأا');
  });

  it('keeps mixed Arabic, numbers and Latin abbreviations in logical order', () => {
    const drawn = render(1200 + 400).filter((o) => o.startsWith('fillText(')).join('\n');
    expect(drawn).toContain('UN Water');
    expect(drawn).toContain('71%');
  });

  it('renders every scene kind used by the sample without throwing', () => {
    for (let f = 0; f < 3600; f += 97) expect(() => render(f)).not.toThrow();
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

describe('stat numbers', () => {
  it('parses western and Arabic-Indic digits and keeps affixes', () => {
    const w = parseStatValue('71%')!;
    expect(formatStatValue(w, 35.5)).toBe('36%');
    const a = parseStatValue('٧١٪')!;
    expect(a.value).toBe(71);
    expect(formatStatValue(a, 71)).toBe('٧١٪');
    const d = parseStatValue('1.5 مليار')!;
    expect(formatStatValue(d, 0.75)).toBe('0.8 مليار');
    expect(parseStatValue('بدون رقم')).toBeNull();
  });
});
