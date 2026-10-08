export const clamp = (v: number, min = 0, max = 1): number => Math.min(max, Math.max(min, v));

/** Linear 0→1 progress of `frame` through the window [start, start + length). */
export const progress = (frame: number, start: number, length: number): number =>
  length <= 0 ? 1 : clamp((frame - start) / length);

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - clamp(t), 3);
export const easeInOutCubic = (t: number): number => {
  const x = clamp(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
export const easeOutBack = (t: number): number => {
  const x = clamp(t);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

/** Frames used for the transition into and out of each scene. */
export const TRANSITION_FRAMES = 18;

/** Deterministic pseudo-random in [0, 1) from integer seeds (no Math.random). */
export function hash01(a: number, b = 0): number {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Stable numeric seed from a string id. */
export function seedOf(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}
