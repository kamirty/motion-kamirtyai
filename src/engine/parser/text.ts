/** Arabic-aware text helpers used by the storyboard parser. */

import { normalizeArabic } from '../../design/arabic';

export const DIGIT = '[0-9٠-٩]';
const NUMBER = `${DIGIT}+(?:[.,٫،]${DIGIT}+)?`;
const UNITS = 'مليون|مليار|ألف|آلاف|الف|ملايين|مليارات|كم|كيلو(?:متر|غرام|جرام)?|كغ|كجم|لتر|لترات|متر|ساعة|ساعات|دقيقة|دقائق|ثانية|يوم|أيام|سنة|سنوات|عام|أعوام|ريال|دولار|درهم|دينار|جنيه|شخص|طالب|مرة|مرات|سعرة|كوب|أكواب';

/** A number with an optional percent sign or unit word, e.g. "71%", "٢٫٥ مليار", "8 أكواب". */
export const STAT_RE = new RegExp(`(${NUMBER})\\s*(%|٪|(?:${UNITS})(?![\\p{L}]))?`, 'u');

/** Four-digit year 1000–2199 in either digit system. */
export const YEAR_RE = /(?:^|[^0-9٠-٩])((?:1[0-9]|20|21)[0-9]{2}|[١][٠-٩]{3}|[٢][٠١][٠-٩]{2})(?![0-9٠-٩])/;

const LIST_MARKER = /^\s*(?:[-–—•*▪●◦►✓✔✅☐☑☒✗✘×❌]|\+(?=\s)|\(?[0-9٠-٩]{1,2}\s*[.)\-–:]|\(?[أابجده]\s*[.)\-–])\s*/;
/** Check-box, tick and cross marks that may follow a bullet, as in "- ☐ item" or "- ✗ item". */
const MARK = /^[☐☑☒✓✔✅✗✘×❌]\s*/u;

export function isListLine(line: string): boolean {
  return LIST_MARKER.test(line) && !YEAR_LINE.test(line);
}

/** Item text without its bullet, number or letter and without a leading check/cross mark. */
export const stripMarker = (line: string): string => line.replace(LIST_MARKER, '').replace(MARK, '').trim();

/**
 * The symbol that leads a list line: a check/cross mark when there is one ("- ✗ x" → "✗"),
 * otherwise the bullet itself ("+ x" → "+", "- x" → "-"); "" for numbered or lettered lines.
 */
export function leadMark(line: string): string {
  const m = /^\s*([-–—•*▪●◦►+]?)\s*([☐☑☒✓✔✅✗✘×❌])?/u.exec(line);
  const sym = m?.[2] ?? m?.[1] ?? '';
  return /^[–—]$/.test(sym) ? '-' : sym;
}

/** Letter or number that labels an option line ("ب) المشتري" → "ب", "2. x" → "2"), normalised. */
export function optionLabel(line: string): string {
  const m = /^\s*\(?([أابجده]|[0-9٠-٩]{1,2})\s*[.)\-–:]/u.exec(line);
  if (!m) return '';
  return m[1].replace(/أ/g, 'ا').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

/** "1990: event" or "- 2020 - event" */
export const YEAR_LINE = /^\s*(?:[-–—•*]\s*)?((?:1[0-9]|20|21)[0-9]{2}|[١][٠-٩]{3}|[٢][٠١][٠-٩]{2})\s*(?:م|هـ)?\s*[:：\-–—]\s*(.+)$/;

/** A ratio written as "7 من 10", "٣ من كل ١٠" or "50 من أصل 100". */
export const RATIO_RE = new RegExp(`(${NUMBER})\\s+من\\s+(?:(?:كل|أصل|اصل)\\s+)?(${NUMBER})(?![0-9٠-٩])`, 'u');

/** A year's value that is only a number with at most two words ("45 مليون مستخدم", "30%"). */
export const NUMERIC_EVENT = new RegExp(`^${NUMBER}\\s*(?:%|٪)?(?:\\s+[^\\s]+){0,2}$`, 'u');

/** "label: value" where value contains a number, for bar charts. */
export const LABEL_VALUE = new RegExp(`^(.{1,60}?)\\s*[:：\\-–—]\\s*(${NUMBER}\\s*(?:%|٪)?)\\s*(.*)$`, 'u');

/** Splits prose into sentences on Arabic and Latin terminators, keeping the terminator. */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!؟?؛])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.replace(/[.!؟?؛،,\s]/g, '').length > 1);
}

/** Splits text longer than `max` at Arabic/Latin commas or conjunction boundaries, never mid-word. */
export function chunkText(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const parts = text.split(/(?<=[،,؛;:])\s+/);
  const out: string[] = [];
  let cur = '';
  for (const part of parts) {
    if (!cur) cur = part;
    else if ((cur + ' ' + part).length <= max) cur += ' ' + part;
    else {
      out.push(cur);
      cur = part;
    }
  }
  if (cur) out.push(cur);
  // Still too long: wrap on spaces.
  return out.flatMap((p) => {
    if (p.length <= max) return [p];
    const words = p.split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      if (line && (line + ' ' + w).length > max) {
        lines.push(line);
        line = w;
      } else line = line ? `${line} ${w}` : w;
    }
    if (line) lines.push(line);
    return lines;
  });
}

/** Removes trailing sentence punctuation. */
export const trimPunct = (s: string): string => s.trim().replace(/[\s.،,؛:!]+$/u, '').trim();

/** Shortens text to at most `max` characters on a word boundary (no ellipsis invented content). */
export function clampWords(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max + 1);
  const i = cut.lastIndexOf(' ');
  return (i > max * 0.5 ? cut.slice(0, i) : text.slice(0, max)).trim() + '…';
}

const REQUEST_PREFIX = new RegExp(
  '^(?:(?:من فضلك|لو سمحت|رجاء|رجاءً)[،,]?\\s*)?' +
    '(?:(?:أريد|اريد|نريد|أبغى|ابغى|ابغي|ودي|بدي|أحتاج|احتاج)\\s+(?:منك\\s+)?(?:أن\\s+)?)?' +
    '(?:(?:اعمل|إعمل|اصنع|صمم|أنشئ|انشئ|سوّي|سوي|اكتب|جهز|جهّز|حضر|ولد|ولّد|عمل|صنع|تصميم|إنشاء|انشاء)\\s+(?:لي|لنا)?\\s*)?' +
    '(?:(?:فيديو|مقطع|عرض|إنفوجرافيك|انفوجرافيك|انفوغرافيك|إنفوغرافيك|موشن|فيلم)\\s*)*' +
    '(?:(?:إنفوجرافيك|انفوجرافيك|تعليمي|توعوي|تثقيفي|قصير|متحرك|توضيحي|مدته\\s+\\S+\\s+\\S+)\\s*)*' +
    '(?:(?:عن|حول|يشرح|يوضح|يتحدث عن|بعنوان|لشرح|لتوضيح|ل)\\s+)?',
  'u',
);

/** Extracts the topic from a request like "أريد فيديو إنفوجرافيك عن فوائد شرب الماء". */
export function extractTopic(text: string): string {
  const first = splitSentences(text)[0] ?? text;
  const topic = trimPunct(first.replace(REQUEST_PREFIX, ''));
  return topic || trimPunct(first);
}

const ORDINAL_ADVERB = '(?:اولا|ثانيا|ثالثا|رابعا|خامسا|سادسا|سابعا|ثامنا|تاسعا|عاشرا|اخيرا)';
const SECTION_WORD = '(?:الجزء|القسم|المحور|الفصل|الباب|الوحده)';
const ORDINAL_WORD = '(?:ال(?:اول|ثاني|ثالث|رابع|خامس|سادس|سابع|ثامن|تاسع|عاشر|اخير)(?:ه|ي)?|[0-9٠-٩]{1,2})';
const SECTION_RE = new RegExp(`^${SECTION_WORD}\\s+${ORDINAL_WORD}(?:\\s*[:：\\-–—]\\s*\\S.*)?$`, 'u');
const ORDINAL_RE = new RegExp(`^${ORDINAL_ADVERB}\\s*[:：\\-–—]\\s*\\S.*$`, 'u');

/**
 * Title of a section-heading line — "## الأسباب", "الجزء الأول: المشكلة", "أولًا: الأسباب" —
 * or null. Headings are short and never end like a sentence.
 */
export function chapterHeading(line: string): string | null {
  const md = /^#{1,6}\s+(.+)$/u.exec(line);
  if (md) {
    const t = trimPunct(md[1].replace(/\s#+\s*$/, ''));
    return t && t.length <= 80 ? t : null;
  }
  if (line.length > 60 || /[.!؟?؛]\s*$/.test(line)) return null;
  const n = normalizeArabic(line.trim());
  return SECTION_RE.test(n) || ORDINAL_RE.test(n) ? trimPunct(line) : null;
}
