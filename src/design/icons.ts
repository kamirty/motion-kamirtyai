import { normalizeArabic } from './arabic';
import { ICONS, type IconDef } from './iconSet';

export { ICONS };
export type { IconDef };

const byId = new Map(ICONS.map((i) => [i.id, i]));

export const iconById = (id: string): IconDef | undefined => byId.get(id);

/** Default icon per scene kind when nothing in the text matches. */
export const KIND_ICONS: Record<string, string> = {
  hero: 'sparkles',
  steps: 'list-ordered',
  comparison: 'arrow-left-right',
  stat: 'chart-column',
  timeline: 'history',
  quote: 'quote',
  summary: 'lightbulb',
  outro: 'heart',
  kpis: 'gauge',
  donut: 'chart-pie',
  columns: 'chart-column',
  pictogram: 'users',
  cycle: 'recycle',
  pyramid: 'layers',
  proscons: 'scale',
  checklist: 'list-checks',
  quiz: 'circle-help',
  definition: 'book-open',
  chapter: 'flag',
  tip: 'lightbulb',
};

const shortKeyword = new Map<string, RegExp>();

/**
 * Long keywords match anywhere (Arabic attaches prefixes and suffixes); keywords of three letters
 * or fewer must start a word, optionally after a conjunction/preposition and the article.
 */
function matches(hay: string, kw: string): boolean {
  if (kw.length > 3) return hay.includes(kw);
  let re = shortKeyword.get(kw);
  if (!re) {
    re = new RegExp(`\\s(?:[وفبلك])?(?:ال|لل)?${kw}(?=\\s|[^\\p{L}]|$)`, 'u');
    shortKeyword.set(kw, re);
  }
  return re.test(hay);
}

/**
 * Picks the icon whose keywords appear in `text`. Longer keyword matches win, so
 * "ذكاء اصطناعي" beats a bare "ذكاء"; ties keep catalogue order for determinism.
 */
export function suggestIcon(text: string, fallback: string, exclude: Set<string> = new Set()): string {
  const hay = ` ${normalizeArabic(text)} `;
  let best: { id: string; score: number } | null = null;
  for (const icon of ICONS) {
    if (exclude.has(icon.id)) continue;
    for (const kw of icon.keywords) {
      if (kw.length < 2) continue;
      if (matches(hay, kw) && (!best || kw.length > best.score)) best = { id: icon.id, score: kw.length };
    }
  }
  return best?.id ?? fallback;
}

/** Case-insensitive search over ids and Arabic keywords, for the icon picker. */
export function searchIcons(query: string): IconDef[] {
  const q = normalizeArabic(query.trim());
  if (!q) return ICONS;
  return ICONS.filter((i) => i.id.includes(q) || i.keywords.some((k) => k.includes(q) || q.includes(k)));
}
