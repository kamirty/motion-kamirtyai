import { describe, expect, it } from 'vitest';
import { sampleProject } from '../domain/sampleProject';
import { frameToSeconds, sceneAt, validateTimeline } from '../domain/timeline';
import type { Project } from '../domain/types';

const withScenes = (scenes: Project['scenes']): Project => ({ ...sampleProject, scenes });

describe('timeline', () => {
  it('sample project covers exactly 3600 frames = 120 s', () => {
    expect(validateTimeline(sampleProject)).toEqual([]);
    const total = sampleProject.scenes.reduce((sum, s) => sum + s.durationFrames, 0);
    expect(total).toBe(3600);
    expect(frameToSeconds(3600, 30)).toBe(120);
  });

  it('maps every frame to exactly one scene', () => {
    expect(sceneAt(sampleProject, 0)?.id).toBe('intro');
    expect(sceneAt(sampleProject, 1199)?.id).toBe('intro');
    expect(sceneAt(sampleProject, 1200)?.id).toBe('fact');
    expect(sceneAt(sampleProject, 3599)?.id).toBe('steps');
    expect(sceneAt(sampleProject, 3600)).toBeNull();
  });

  it('derives timestamps from frame index only', () => {
    expect(frameToSeconds(0)).toBe(0);
    expect(frameToSeconds(45)).toBe(1.5);
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
