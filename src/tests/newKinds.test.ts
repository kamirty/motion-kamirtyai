import { describe, expect, it } from 'vitest';
import { buildStoryboard } from '../engine/parser/storyboard';
import { beforeAfterParts, trueFalseParts } from '../engine/sceneModel';
import { itemReveal, trueFalseCountdown, QUIZ_COUNTDOWN } from '../engine/timing';
import { planCues } from '../engine/audio/sfx';
import { sampleProject } from '../domain/sampleProject';
import type { Project, Scene } from '../domain/types';
import { sampleScene } from './fixtures/kindSamples';

describe('new scene kinds', () => {
  it('the parser recognises true/false, before/after and warnings (Arabic + digits + Latin)', () => {
    const board = buildStoryboard(`الماء والحياة
صح أم خطأ: يغلي الماء عند 100 درجة مئوية؟
الإجابة: صح، عند ضغط 1 atm.
قبل: نستهلك 250 لترًا يوميًا.
بعد: نستهلك 150 لترًا فقط بعد الترشيد.
تحذير: لا تترك الصنبور مفتوحًا أثناء تنظيف الأسنان.`);
    const tf = board.scenes.find((s) => s.kind === 'truefalse')!;
    expect(tf.title).toBe('يغلي الماء عند 100 درجة مئوية');
    expect(tf.items[0]).toBe('صح');
    expect(tf.items[1]).toContain('1 atm');
    const ba = board.scenes.find((s) => s.kind === 'beforeafter')!;
    expect(ba.items).toEqual(['قبل: نستهلك 250 لترًا يوميًا', 'بعد: نستهلك 150 لترًا فقط بعد الترشيد']);
    expect(board.scenes.find((s) => s.kind === 'warning')!.title).toBe('لا تترك الصنبور مفتوحًا أثناء تنظيف الأسنان');
  });

  it('reads answers and panels', () => {
    const scene = (items: string[]) => ({ ...sampleScene('truefalse', 0), items }) as Scene;
    expect(trueFalseParts(scene(['خطأ', 'لأن…'])).answer).toBe(false);
    expect(trueFalseParts(scene(['✓'])).answer).toBe(true);
    expect(trueFalseParts(scene(['ربما'])).answer).toBeNull();
    expect(beforeAfterParts({ ...scene(['بعد: ب', 'قبل: أ']), kind: 'beforeafter' })).toEqual({ before: 'أ', after: 'ب' });
  });

  it('ranking reveals from last place to first; the line chart left to right in reading order', () => {
    const r = sampleScene('ranking', 0, 450);
    expect(itemReveal(r, 0, 5)).toBeGreaterThan(itemReveal(r, 4, 5));
    const l = sampleScene('linechart', 0, 450);
    expect(itemReveal(l, 0, 5)).toBeLessThan(itemReveal(l, 4, 5));
  });

  it('true/false counts down with sound and stamps the answer with a ding', () => {
    const s = { ...sampleScene('truefalse', 0, 450), startFrame: 0 };
    const p = { ...sampleProject, durationFrames: 450, scenes: [s], style: { ...sampleProject.style!, sfx: true } } as Project;
    const cues = planCues(p);
    expect(cues.some((c) => c.kind === 'ding' && c.frame === trueFalseCountdown(s) + QUIZ_COUNTDOWN)).toBe(true);
  });
});

describe('batch 5 kinds', () => {
  it('reads clock times in Western and Arabic-Indic digits, with ص/م', async () => {
    const { clockParts } = await import('../engine/renderer/scenes/extra4');
    expect(clockParts('6:30 الاستيقاظ: كوب ماء')).toEqual({ minutes: 390, time: '6:30', text: 'الاستيقاظ: كوب ماء' });
    expect(clockParts('٨:٣٠ بداية الاختبار').minutes).toBe(510);
    expect(clockParts('5 م: رياضة 30 دقيقة')).toMatchObject({ minutes: 17 * 60, time: '5 م', text: 'رياضة 30 دقيقة' });
    expect(clockParts('9:30 PM - النوم').minutes).toBe(21 * 60 + 30);
    expect(clockParts('الإفطار مع العائلة').minutes).toBeNull();
    expect(clockParts('2024 سنة التخرج').minutes).toBeNull();
  });

  it('signal lights go from red to green', async () => {
    const { signalColors } = await import('../engine/renderer/scenes/extra4');
    expect(signalColors(3)).toEqual(['#E53935', '#FDD835', '#43A047']);
    for (const n of [1, 2, 4, 5, 6]) expect(signalColors(n)).toHaveLength(n);
    expect(signalColors(6)[0]).toBe('#E53935');
  });

  it('the search query is fully typed before its first result; the podium reveals third place first', async () => {
    const { typingFrames } = await import('../engine/timing');
    const s = sampleScene('search', 0, 300);
    const first = itemReveal(s, 0, s.items.length);
    const at = typingFrames(s.title.split(/\s+/).length, first);
    expect(at.every((f, i) => f < first && (i === 0 || f > at[i - 1]))).toBe(true);
    const p = sampleScene('podium', 0, 300);
    expect(itemReveal(p, 2, 3)).toBeLessThan(itemReveal(p, 0, 3));
  });
});
