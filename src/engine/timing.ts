import type { Scene } from '../domain/types';

/**
 * When each element of a scene starts to appear, in frames from the scene start.
 * The renderer animates from these and the sound-effect planner cues from them, so picture and
 * sound stay in sync by construction.
 */

export const MAX_ITEMS = 6;

export const HERO = { icon: 0, title: 12, subtitle: (i: number) => 40 + i * 14 };
export const HEADER = { icon: 0, title: 4 };
export const STAT = { countStart: 16, countLength: 75, description: 60 };
export const QUOTE = { icon: 0, line: (i: number) => 16 + i * 10 };
export const OUTRO = { icon: 0, title: 10, line: (i: number) => 30 + i * 12 };

/** Frames between successive item reveals: list items share the first 55% of the scene. */
export function revealSpan(scene: Scene, count: number): number {
  return Math.max(24, Math.floor((scene.durationFrames * 0.55) / Math.max(1, count)));
}

export const shownItems = (scene: Scene): string[] => scene.items.slice(0, MAX_ITEMS);

const LABEL_VALUE = /^(.{1,60}?)\s*[:：\-–—]\s*([0-9٠-٩]+(?:[.,٫][0-9٠-٩]+)?\s*(?:%|٪)?)\s*(.*)$/u;

/** A comparison draws bar charts when every item reads "label: number", otherwise cards. */
export function comparisonBars(scene: Scene): { label: string; value: string }[] | null {
  const items = shownItems(scene);
  const rows = items.map((it) => LABEL_VALUE.exec(it)).filter((m): m is RegExpExecArray => !!m);
  return rows.length >= 2 && rows.length === items.length ? rows.map((m) => ({ label: m[1].trim(), value: m[2].trim() })) : null;
}

/** Frame at which list item `i` of `count` starts to appear, per scene kind. */
export function itemReveal(scene: Scene, i: number, count: number): number {
  const span = revealSpan(scene, count);
  switch (scene.kind) {
    case 'steps':
      return 24 + i * span;
    case 'timeline':
      return 20 + i * span;
    case 'summary':
      return 22 + i * Math.min(span, 36);
    case 'comparison':
      return comparisonBars(scene) ? 14 + i * Math.min(span, 30) : 20 + i * 18;
    default:
      return 0;
  }
}
