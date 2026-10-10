import type { Scene } from '../domain/types';
import { quizParts } from './sceneModel';

export { MAX_ITEMS, comparisonBars, shownItems } from './sceneModel';

/**
 * When each element of a scene starts to appear, in frames from the scene start.
 * The renderer animates from these and the sound-effect planner cues from them, so picture and
 * sound stay in sync by construction. Drawers must not invent other reveal times for elements
 * that have a cue.
 */

export const HERO = { icon: 0, title: 12, subtitle: (i: number) => 40 + i * 14 };
export const HEADER = { icon: 0, title: 4 };
export const STAT = { countStart: 16, countLength: 75, description: 60 };
export const QUOTE = { icon: 0, line: (i: number) => 16 + i * 10 };
export const OUTRO = { icon: 0, title: 10, line: (i: number) => 30 + i * 12 };

/** KPI tiles pop in one after another; each counter runs for countLength frames. */
export const KPIS = { countLength: 60 };
/** Pictogram: grid fades in, then units fill one by one over fillLength frames. */
export const PICTOGRAM = { grid: 16, fillStart: 30, fillLength: 60, description: 96 };
/** Definition: term, then the definition text, then examples (items[1..]) in turn. */
export const DEFINITION = { term: 8, body: 40, example: (i: number) => 70 + i * 20 };
export const CHAPTER = { mark: 0, title: 10, subtitle: 28 };
export const TIP = { badge: 4, text: 24, note: 60 };
export const QUIZ_COUNTDOWN = 90; // 3 s countdown before the answer is revealed
/** A scene's picture enters at this frame over this many frames. */
export const IMAGE = { enter: 6, length: 22 };

export type Pace = 'calm' | 'balanced' | 'fast';

/** Share of the scene over which list items are revealed, per motion speed. */
const PACE_SHARE: Record<Pace, number> = { calm: 0.75, balanced: 0.6, fast: 0.4 };

/**
 * Frames between successive item reveals: items share a part of the scene set by the motion
 * speed, so they always arrive one by one (never all at once) and the last stays readable.
 */
export function revealSpan(scene: Scene & { pace?: Pace }, count: number): number {
  const share = PACE_SHARE[scene.pace ?? 'balanced'];
  return Math.max(18, Math.floor((scene.durationFrames * share) / Math.max(1, count)));
}

/** Countdown start for a quiz; the answer is revealed QUIZ_COUNTDOWN frames later. */
export function quizCountdown(scene: Scene & { pace?: Pace }): number {
  const n = quizParts(scene).options.length;
  const wanted = itemReveal(scene, Math.max(0, n - 1), Math.max(1, n)) + 40;
  return Math.max(0, Math.min(wanted, scene.durationFrames - QUIZ_COUNTDOWN - 40));
}

export function itemReveal(scene: Scene & { pace?: Pace }, i: number, count: number): number {
  const span = revealSpan(scene, count);
  switch (scene.kind) {
    case 'pyramid':
      // Built from the base (last item) up to the top (first item).
      return 20 + (count - 1 - i) * span;
    case 'definition':
      return i === 0 ? DEFINITION.body : DEFINITION.body + 30 + (i - 1) * Math.max(20, Math.floor(span / 2));
    case 'steps': case 'cycle': case 'checklist': case 'timeline': case 'summary': case 'comparison':
    case 'kpis': case 'donut': case 'columns': case 'proscons': case 'quiz':
      return 20 + i * span;
    default:
      return 0;
  }
}

