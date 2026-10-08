import { DURATION_FRAMES, FPS, type Project, type Scene } from './types';

/** Timestamp in seconds of a frame, derived from the frame index only (never from wall-clock time). */
export const frameToSeconds = (frameIndex: number, fps: number = FPS): number => frameIndex / fps;

/** Returns the scene covering `frameIndex`, or null if the index is outside the timeline. */
export function sceneAt(project: Project, frameIndex: number): Scene | null {
  for (const scene of project.scenes) {
    if (frameIndex >= scene.startFrame && frameIndex < scene.startFrame + scene.durationFrames) return scene;
  }
  return null;
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
