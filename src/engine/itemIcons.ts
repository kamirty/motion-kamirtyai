import { iconById, suggestIcon } from '../design/icons';
import type { Scene, SceneKind } from '../domain/types';
import { comparisonBars, shownItems } from './sceneModel';

/**
 * Per-element icons. Some kinds draw one icon per element (cards, text comparison, KPI tiles,
 * before/after); each is picked from the element's words unless the user chose one
 * (Scene.itemIcons[i], '' = automatic). The renderer and the scene panel both read this, so
 * the panel always shows the icon the video will draw.
 */
export const ITEM_ICON_KINDS: readonly SceneKind[] = ['summary', 'comparison', 'kpis', 'beforeafter'];

const SPARE = ['star', 'circle-check', 'target', 'award', 'sparkles', 'zap', 'heart'];
const heading = (text: string) => /^(.{2,40}?)\s*[:：]\s*.+$/u.exec(text)?.[1] ?? text;

/** Distinct icon per text (falls back to generic ones, never repeating). */
export function autoIcons(texts: string[], fallback: string, taken: string[] = []): string[] {
  const used = new Set(taken.filter(Boolean));
  const spare = [fallback, ...SPARE].filter((id) => iconById(id));
  return texts.map((t) => {
    let id = suggestIcon(t, '', used);
    if (!id) id = spare.find((s) => !used.has(s)) ?? fallback;
    used.add(id);
    return id;
  });
}

/** Whether this scene draws an icon per element (text comparisons do; bar comparisons don't). */
export const hasItemIcons = (scene: Scene): boolean =>
  ITEM_ICON_KINDS.includes(scene.kind) && !(scene.kind === 'comparison' && comparisonBars(scene)) && shownItems(scene).length > 0;

/** The icon each element is drawn with: the user's choice, else the automatic one. */
export function effectiveItemIcons(scene: Scene): string[] {
  const items = shownItems(scene);
  const chosen = items.map((_, i) => {
    const id = scene.itemIcons?.[i];
    return id && iconById(id) ? id : '';
  });
  let auto: string[];
  switch (scene.kind) {
    case 'kpis':
      auto = items.map((it) => suggestIcon(it, scene.icon));
      break;
    case 'beforeafter':
      auto = ['circle-x', 'sparkles'];
      break;
    case 'comparison':
      auto = autoIcons(items.map(heading), scene.icon, chosen);
      break;
    default:
      auto = autoIcons(items, scene.icon, chosen);
  }
  return items.map((_, i) => chosen[i] || auto[i] || scene.icon);
}
