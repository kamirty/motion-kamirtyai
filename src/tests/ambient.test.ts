import { describe, expect, it } from 'vitest';
import { sampleProject } from '../domain/sampleProject';
import type { BackgroundId, Project } from '../domain/types';
import { renderFrame } from '../engine/renderer/renderFrame';
import { quizCountdown, QUIZ_COUNTDOWN } from '../engine/timing';
import { sampleScene } from './fixtures/kindSamples';
import { createFakeCtx } from './fakeCtx';

const only = (kind: Parameters<typeof sampleScene>[0], bg: BackgroundId = 'plain'): Project =>
  ({ ...sampleProject, durationFrames: 450, scenes: [{ ...sampleScene(kind, 0, 450), startFrame: 0 }], style: { ...sampleProject.style!, background: bg } }) as Project;
const ops = (p: Project, f: number) => {
  const { ctx, ops } = createFakeCtx();
  renderFrame(p, f, ctx);
  return ops;
};

describe('ambient motion', () => {
  it('every effect is deterministic and keeps moving over time', () => {
    for (const bg of ['bubbles', 'aurora'] as BackgroundId[]) {
      const p = only('summary', bg);
      ops(p, 300); // warm text and icon caches
      expect(ops(p, 300)).toEqual(ops(p, 300));
      expect(ops(p, 300)).not.toEqual(ops(p, 330));
    }
  });

  it('the header types its title in (a clip that widens) and its icon traces itself', () => {
    const p = only('summary');
    const clipsAt = (f: number) => ops(p, f).filter((o) => o.startsWith('rect(')).length;
    expect(clipsAt(14)).toBeGreaterThan(0);
    expect(ops(p, 14).some((o) => o.startsWith('setLineDash(['))).toBe(true);
  });

  it('confetti bursts when the quiz answer is revealed', () => {
    const p = only('quiz');
    const at = quizCountdown(p.scenes[0]) + QUIZ_COUNTDOWN;
    const rects = (f: number) => ops(p, f).filter((o) => o.startsWith('fillRect(-7.00,-3.50')).length;
    expect(rects(at + 12)).toBeGreaterThan(10);
    expect(rects(at - 5)).toBe(0);
  });
});
