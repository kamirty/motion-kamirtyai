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
