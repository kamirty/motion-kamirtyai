import { describe, expect, it } from 'vitest';
import { sampleProject } from '../domain/sampleProject';
import { distributeFrames, frameToSeconds, rebalance, restack, sceneAt, setSceneDuration, validateTimeline } from '../domain/timeline';
import { LIMITS, type Project } from '../domain/types';

const withScenes = (scenes: Project['scenes']): Project => ({ ...sampleProject, scenes });
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('timeline', () => {
  it('sample project covers exactly 3600 frames = 120 s', () => {
    expect(validateTimeline(sampleProject)).toEqual([]);
    expect(sum(sampleProject.scenes.map((s) => s.durationFrames))).toBe(3600);
    expect(frameToSeconds(3600, 30)).toBe(120);
  });

  it('maps every frame to exactly one scene', () => {
    expect(sceneAt(sampleProject, 0)?.id).toBe('intro');
    expect(sceneAt(sampleProject, 1199)?.id).toBe('intro');
    expect(sceneAt(sampleProject, 1200)?.id).toBe('fact');
    expect(sceneAt(sampleProject, 3599)?.id).toBe('steps');
    expect(sceneAt(sampleProject, 3600)).toBeNull();
  });

  it('rejects gaps, overlaps, short timelines and duplicate ids', () => {
    const [a, b, c] = sampleProject.scenes;
    expect(validateTimeline(withScenes([a, { ...b, startFrame: 1210 }, c])).join()).toMatch(/gap|overlaps/);
    expect(validateTimeline(withScenes([a, { ...b, startFrame: 1100 }, c])).join()).toMatch(/overlaps/);
    expect(validateTimeline(withScenes([a, b])).join()).toMatch(/expected 3600/);
    expect(validateTimeline(withScenes([a, { ...b, id: 'intro' }, c])).join()).toMatch(/duplicate/);
    expect(validateTimeline(withScenes([a, { ...b, durationFrames: 1200.5 }, c])).join()).toMatch(/integer/);
  });
});

describe('frame distribution', () => {
  it('always sums exactly to the total with integer frames', () => {
    for (const weights of [[1], [1, 1, 1], [8, 13.7, 9.1, 7, 22.4, 7], [0, 0, 0], [1000, 1, 1, 1], Array(20).fill(3)]) {
      const out = distributeFrames(weights, 3600);
      expect(sum(out)).toBe(3600);
      expect(out.every((x) => Number.isInteger(x) && x >= LIMITS.minSceneFrames)).toBe(true);
    }
  });

  it('keeps already-valid durations unchanged', () => {
    const scenes = restack(sampleProject.scenes.map((s, i) => ({ ...s, durationFrames: [600, 2000, 1000][i] })));
    expect(rebalance(scenes).map((s) => s.durationFrames)).toEqual([600, 2000, 1000]);
  });

  it('setSceneDuration changes only that scene and clamps to the limits', () => {
    const out = setSceneDuration(sampleProject.scenes, 0, 450);
    expect(out.map((s) => s.durationFrames)).toEqual([450, ...sampleProject.scenes.slice(1).map((s) => s.durationFrames)]);
    const greedy = setSceneDuration(sampleProject.scenes, 1, 99999);
    expect(greedy[1].durationFrames).toBe(LIMITS.maxSceneFrames);
    expect(setSceneDuration(sampleProject.scenes, 1, 1)[1].durationFrames).toBe(LIMITS.minSceneFrames);
  });

  it('rebalance repairs deleted/added scenes back to 3600 frames', () => {
    const [a, , c] = sampleProject.scenes;
    expect(validateTimeline(withScenes(rebalance([a, c])))).toEqual([]);
    const added = rebalance([...sampleProject.scenes, { ...c, id: 'extra', durationFrames: 300 }]);
    expect(validateTimeline(withScenes(added))).toEqual([]);
  });
});

describe('video length follows the scenes', () => {
  it('project length is the sum of the scenes, up to 10 minutes', async () => {
    const { withScenes: ws, totalFrames } = await import('../domain/timeline');
    const { parseProject } = await import('../domain/sanitize');
    const shorter = ws(sampleProject, setSceneDuration(sampleProject.scenes, 0, 300));
    expect(shorter.durationFrames).toBe(totalFrames(shorter.scenes));
    expect(shorter.durationFrames).toBeLessThan(3600);
    expect(validateTimeline(shorter)).toEqual([]);
    // Imported projects keep their own length; overly long ones are scaled to the limit.
    expect(parseProject(JSON.parse(JSON.stringify(shorter))).durationFrames).toBe(shorter.durationFrames);
    const huge = { ...sampleProject, scenes: sampleProject.scenes.concat(sampleProject.scenes.map((s, i) => ({ ...s, id: `x${i}` }))).map((s) => ({ ...s, durationFrames: 3600 })) };
    expect(parseProject(JSON.parse(JSON.stringify(huge))).durationFrames).toBe(LIMITS.maxTotalFrames);
  });
});
