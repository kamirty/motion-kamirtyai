/** Arabic-aware text helpers used by the storyboard parser. */

export const DIGIT = '[0-9٠-٩]';
const NUMBER = `${DIGIT}+(?:[.,٫،]${DIGIT}+)?`;
const UNITS = 'مليون|مليار|ألف|آلاف|الف|ملايين|مليارات|كم|كيلو(?:متر|غرام|جرام)?|كغ|كجم|لتر|لترات|متر|ساعة|ساعات|دقيقة|دقائق|ثانية|يوم|أيام|سنة|سنوات|عام|أعوام|ريال|دولار|درهم|دينار|جنيه|شخص|طالب|مرة|مرات|سعرة|كوب|أكواب';

/** A number with an optional percent sign or unit word, e.g. "71%", "٢٫٥ مليار", "8 أكواب". */
export const STAT_RE = new RegExp(`(${NUMBER})\\s*(%|٪|(?:${UNITS})(?![\\p{L}]))?`, 'u');

/** Four-digit year 1000–2199 in either digit system. */
export const YEAR_RE = /(?:^|[^0-9٠-٩])((?:1[0-9]|20|21)[0-9]{2}|[١][٠-٩]{3}|[٢][٠١][٠-٩]{2})(?![0-9٠-٩])/;

const LIST_MARKER = /^\s*(?:[-–—•*▪●◦►✓✔]|\(?[0-9٠-٩]{1,2}\s*[.)\-–:]|\(?[أابجده]\s*[.)\-–])\s*/;

export function isListLine(line: string): boolean {
  return LIST_MARKER.test(line) && !YEAR_LINE.test(line);
}

export const stripMarker = (line: string): string => line.replace(LIST_MARKER, '').trim();

/** "1990: event" or "- 2020 - event" */
export const YEAR_LINE = /^\s*(?:[-–—•*]\s*)?((?:1[0-9]|20|21)[0-9]{2}|[١][٠-٩]{3}|[٢][٠١][٠-٩]{2})\s*(?:م|هـ)?\s*[:：\-–—]\s*(.+)$/;

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
