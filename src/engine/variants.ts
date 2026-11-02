import type { Scene, SceneKind } from '../domain/types';

/**
 * Alternative layouts per kind («أشكال العرض»), beyond each kind's main layout. A scene can pick
 * one (scene.variant); otherwise, with lively motion, one is chosen from the scene's own text and
 * position, so the same kind looks different from scene to scene and video to video.
 */
export const KIND_VARIANTS: Partial<Record<SceneKind, number>> = {
  summary: 2,
  steps: 2,
  kpis: 2,
  checklist: 1,
  comparison: 1,
  timeline: 2,
  quote: 1,
  stat: 2,
  donut: 2,
  columns: 2,
  definition: 1,
  tip: 1,
  warning: 1,
  cycle: 1,
  pyramid: 1,
  proscons: 1,
};

/** Number of layouts of a kind, the main one included. */
export const layoutCount = (kind: SceneKind): number => 1 + (KIND_VARIANTS[kind] ?? 0);

/** Small stable hash of a string (FNV-1a). */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}

/** The layout a scene is drawn with: its own choice, an automatic one when lively, else the main. */
export function variantOf(scene: Pick<Scene, 'kind' | 'variant' | 'title'>, index: number, lively: boolean | undefined): number {
  const count = layoutCount(scene.kind);
  if (scene.variant !== undefined) return Math.max(0, Math.min(count - 1, scene.variant));
  if (!lively || count === 1) return 0;
  return hash(`${scene.title}|${index}`) % count;
}
