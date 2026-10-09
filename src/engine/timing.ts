import type { Scene } from '../domain/types';
import { comparisonBars, quizParts } from './sceneModel';

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

/** Frames between successive item reveals: list items share the first 55% of the scene. */
export function revealSpan(scene: Scene, count: number): number {
  return Math.max(24, Math.floor((scene.durationFrames * 0.55) / Math.max(1, count)));
}

/** Countdown start for a quiz; the answer is revealed QUIZ_COUNTDOWN frames later. */
export function quizCountdown(scene: Scene): number {
  const n = quizParts(scene).options.length;
  const wanted = 20 + n * 12 + 30;
  return Math.max(0, Math.min(wanted, scene.durationFrames - QUIZ_COUNTDOWN - 40));
}

/** Frame at which list item `i` of `count` starts to appear, per scene kind. */
export function itemReveal(scene: Scene, i: number, count: number): number {
  const span = revealSpan(scene, count);
  switch (scene.kind) {
    case 'steps':
    case 'cycle':
    case 'checklist':
      return 24 + i * span;
    case 'timeline':
      return 20 + i * span;
    case 'summary':
      return 22 + i * Math.min(span, 36);
    case 'comparison':
      return comparisonBars(scene) ? 14 + i * Math.min(span, 30) : 20 + i * 18;
    case 'kpis':
      return 20 + i * 16;
    case 'donut':
      return 20 + i * Math.min(span, 30);
    case 'columns':
      return 20 + i * Math.min(span, 24);
    case 'pyramid':
      // Built from the base (last item) up to the top (first item).
      return 20 + (count - 1 - i) * Math.min(span, 30);
    case 'proscons':
      return 24 + i * Math.min(span, 30);
    case 'quiz':
      return 20 + i * 12;
    case 'definition':
      return i === 0 ? DEFINITION.body : DEFINITION.example(i - 1);
    default:
      return 0;
  }
}

