import type { Scene } from '../domain/types';

/**
 * How each scene kind reads its title and items. Shared by the renderer, the sound-effect
 * planner and the editor hints so all three agree on what a scene shows.
 */

export const MAX_ITEMS = 6;

export const shownItems = (scene: Scene): string[] => scene.items.slice(0, MAX_ITEMS);

const NUM = '[0-9٠-٩]+(?:[.,٫][0-9٠-٩]+)?';
const LABEL_VALUE = new RegExp(`^(.{1,60}?)\\s*[:：\\-–—]\\s*(${NUM}\\s*(?:%|٪)?)\\s*(.*)$`, 'u');
const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';

/** Parses a number written with either digit system and either decimal mark. */
export function toNumber(raw: string): number | null {
  const m = new RegExp(NUM, 'u').exec(raw);
  if (!m) return null;
  const v = Number(m[0].replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC.indexOf(d))).replace(/[,٫]/, '.'));
  return Number.isFinite(v) ? v : null;
}

export interface ValueRow {
  label: string;
  /** Display value exactly as written (digits localised later by the renderer's input). */
  value: string;
  num: number;
}

/** "label: 40%" → row; null when the item has no number after a separator. */
export function valueRow(item: string): ValueRow | null {
  const m = LABEL_VALUE.exec(item);
  if (!m) return null;
  return { label: m[1].trim(), value: m[2].trim(), num: toNumber(m[2]) ?? 0 };
}

/** A comparison draws bar charts when every item reads "label: number", otherwise cards. */
export function comparisonBars(scene: Scene): ValueRow[] | null {
  const items = shownItems(scene);
  const rows = items.map(valueRow).filter((r): r is ValueRow => !!r);
  return rows.length >= 2 && rows.length === items.length ? rows : null;
}

/** Rows for donut and column charts; items without a number get value 0 and are still listed. */
export const chartRows = (scene: Scene): ValueRow[] =>
  shownItems(scene).map((it) => valueRow(it) ?? { label: it.trim(), value: '', num: 0 });

/** KPI tile: the first number (with % or unit word) is the value, the rest is its label. */
export function kpiParts(item: string): { value: string; label: string } {
  const m = new RegExp(`(${NUM})\\s*(%|٪|[^\\s:：،,]{0,12})?`, 'u').exec(item);
  if (!m) return { value: '', label: item.trim() };
  const unit = m[2] ?? '';
  const value = unit === '%' || unit === '٪' ? `${m[1]}${unit}` : unit ? `${m[1]} ${unit}` : m[1];
  const label = (item.slice(0, m.index) + ' ' + item.slice(m.index + m[0].length)).replace(/\s*[:：\-–—،,]\s*/g, ' ').replace(/\s+/g, ' ').trim();
  return { value, label };
}

/**
 * Pictogram ratio from "7 من 10", "٧ من كل ١٠", "3/5" or "70%". Totals above 20 are drawn as a
 * 10×10 grid (scaled to 100).
 */
export function pictogramRatio(item: string): { filled: number; total: number } | null {
  const ofMatch = new RegExp(`(${NUM})\\s*(?:من(?:\\s+كل)?|/|out of)\\s*(${NUM})`, 'u').exec(item);
  let filled: number | null = null;
  let total: number | null = null;
  if (ofMatch) {
    filled = toNumber(ofMatch[1]);
    total = toNumber(ofMatch[2]);
  } else if (/[%٪]/.test(item)) {
    filled = toNumber(item);
    total = 100;
  }
  if (filled === null || total === null || total <= 0) return null;
  if (total > 20) {
    filled = Math.round((filled / total) * 100);
    total = 100;
  }
  return { filled: Math.max(0, Math.min(total, Math.round(filled))), total: Math.round(total) };
}

const CON_MARK = /^\s*(?:✗|✘|×|❌|-|−|–|لا\s)/u;
const PRO_MARK = /^\s*(?:✓|✔|✅|\+)\s*/u;

/** Pros/cons: items starting with ✗ × - or "لا " are cons; markers are stripped for display. */
export function prosCons(scene: Scene): { pros: { text: string; index: number }[]; cons: { text: string; index: number }[] } {
  const pros: { text: string; index: number }[] = [];
  const cons: { text: string; index: number }[] = [];
  shownItems(scene).forEach((it, index) => {
    if (CON_MARK.test(it)) cons.push({ text: it.replace(/^\s*(?:✗|✘|×|❌|-|−|–)\s*/u, '').trim(), index });
    else pros.push({ text: it.replace(PRO_MARK, '').trim(), index });
  });
  return { pros, cons };
}

const ANSWER_MARK = /\s*(?:✓|✔|✅|\*)\s*/gu;

/** Quiz: options are the items; the one marked with ✓ or * is correct (-1 when none is marked). */
export function quizParts(scene: Scene): { options: string[]; answer: number } {
  const items = shownItems(scene);
  const answer = items.findIndex((it) => /(?:✓|✔|✅|\*)/u.test(it));
  return { options: items.map((it) => it.replace(ANSWER_MARK, ' ').trim()), answer };
}
