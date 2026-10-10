import { DURATION_FRAMES, FPS, LIMITS, type Project, type Scene } from './types';

/** Timestamp in seconds of a frame, derived from the frame index only (never from wall-clock time). */
export const frameToSeconds = (frameIndex: number, fps: number = FPS): number => frameIndex / fps;

/** Returns the index of the scene covering `frameIndex`, or -1 if outside the timeline. */
export function sceneIndexAt(project: Project, frameIndex: number): number {
  return project.scenes.findIndex(
    (s) => frameIndex >= s.startFrame && frameIndex < s.startFrame + s.durationFrames,
  );
}

export function sceneAt(project: Project, frameIndex: number): Scene | null {
  return project.scenes[sceneIndexAt(project, frameIndex)] ?? null;
}

/**
 * Checks what JSON Schema cannot: scenes are ordered, contiguous, non-overlapping
 * and cover exactly [0, durationFrames).
 */
export function validateTimeline(project: Project): string[] {
  const errors: string[] = [];
  if (project.fps !== FPS) errors.push(`fps must be ${FPS}`);
  if (project.durationFrames !== DURATION_FRAMES) errors.push(`durationFrames must be ${DURATION_FRAMES}`);
  if (project.scenes.length === 0) errors.push('at least one scene is required');

  let cursor = 0;
  const ids = new Set<string>();
  for (const scene of project.scenes) {
    if (ids.has(scene.id)) errors.push(`duplicate scene id "${scene.id}"`);
    ids.add(scene.id);
    if (!Number.isInteger(scene.startFrame) || !Number.isInteger(scene.durationFrames)) {
      errors.push(`scene "${scene.id}" must use integer frames`);
    }
    if (scene.durationFrames <= 0) errors.push(`scene "${scene.id}" has no duration`);
    if (scene.startFrame < cursor) errors.push(`scene "${scene.id}" overlaps the previous scene`);
    if (scene.startFrame > cursor) errors.push(`gap before scene "${scene.id}" (frames ${cursor}-${scene.startFrame - 1})`);
    cursor = scene.startFrame + scene.durationFrames;
  }
  if (project.scenes.length > 0 && cursor !== project.durationFrames) {
    errors.push(`scenes end at frame ${cursor}, expected ${project.durationFrames}`);
  }
  return errors;
}

/**
 * Splits `total` frames across `weights` as integers that sum exactly to `total`,
 * each at least `min` frames (largest-remainder rounding).
 */
export function distributeFrames(weights: number[], total: number = DURATION_FRAMES, min: number = LIMITS.minSceneFrames): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const positive = weights.map((w) => Math.max(0, w));
  const sum = positive.reduce((a, w) => a + w, 0);
  const share = positive.map((w) => (sum > 0 ? (w / sum) * total : total / n));
  const floor = Math.min(min, Math.floor(total / n));
  // Pure proportional split when every share already meets the minimum; otherwise reserve the
  // minimum for each scene and split the remainder proportionally.
  const exact = share.every((x) => x >= floor)
    ? share
    : positive.map((w) => floor + (sum > 0 ? (w / sum) * (total - floor * n) : (total - floor * n) / n));
  const out = exact.map((x) => Math.floor(x));
  let rest = total - out.reduce((a, b) => a + b, 0);
  const order = exact.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; rest > 0; k = (k + 1) % n, rest--) out[order[k][1]]++;
  return out;
}

/** Recomputes contiguous startFrames from the scene order and durations. */
export function restack(scenes: Scene[]): Scene[] {
  let cursor = 0;
  return scenes.map((s) => {
    const next = { ...s, startFrame: cursor };
    cursor += s.durationFrames;
    return next;
  });
}

/** Rebalances durations proportionally so the scenes fill exactly the project duration. */
export function rebalance(scenes: Scene[], total: number = DURATION_FRAMES): Scene[] {
  const frames = distributeFrames(scenes.map((s) => s.durationFrames), total);
  return restack(scenes.map((s, i) => ({ ...s, durationFrames: frames[i] })));
}

/**
 * Sets one scene's duration and scales the others to keep the total fixed.
 * The requested duration is clamped so every other scene keeps the minimum length.
 */
export function setSceneDuration(scenes: Scene[], index: number, frames: number, total: number = DURATION_FRAMES): Scene[] {
  if (scenes.length === 1) return restack([{ ...scenes[0], durationFrames: total }]);
  // Every other scene keeps its exact length; only the last scene (or the one before it, when the
  // last is being edited) absorbs the difference so the video stays exactly `total` frames.
  const last = scenes.length - 1;
  const absorber = index === last ? last - 1 : last;
  const fixed = scenes.reduce((sum, s, i) => (i === index || i === absorber ? sum : sum + s.durationFrames), 0);
  const pool = total - fixed;
  const clamped = Math.round(Math.min(pool - LIMITS.minSceneFrames, Math.max(LIMITS.minSceneFrames, frames)));
  return restack(
    scenes.map((s, i) => (i === index ? { ...s, durationFrames: clamped } : i === absorber ? { ...s, durationFrames: pool - clamped } : s)),
  );
}
