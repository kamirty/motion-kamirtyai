export const clamp = (v: number, min = 0, max = 1): number => Math.min(max, Math.max(min, v));

/** Linear 0→1 progress of `frame` through the window [start, start + length). */
export const progress = (frame: number, start: number, length: number): number =>
  length <= 0 ? 1 : clamp((frame - start) / length);

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - clamp(t), 3);
export const easeInOutCubic = (t: number): number => {
  const x = clamp(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

/** Frames used to fade a scene in and out. */
export const TRANSITION_FRAMES = 15;

/** Scene opacity: fades in over the first frames and out over the last ones. */
export function sceneOpacity(localFrame: number, durationFrames: number): number {
  const fadeIn = progress(localFrame, 0, TRANSITION_FRAMES);
  const fadeOut = 1 - progress(localFrame, durationFrames - TRANSITION_FRAMES, TRANSITION_FRAMES);
  return easeInOutCubic(Math.min(fadeIn, fadeOut));
}
