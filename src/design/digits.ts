import type { DigitSystem } from '../domain/types';

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';

/**
 * Converts digits to the chosen system. Only digit glyphs and the percent/decimal signs change;
 * words and their order are never touched.
 */
export function localizeDigits(text: string, system: DigitSystem): string {
  if (system === 'arabic') {
    return text
      .replace(/(\d)\.(\d)/g, '$1٫$2')
      .replace(/\d/g, (d) => ARABIC_INDIC[Number(d)])
      .replace(/%/g, '٪');
  }
  return text
    .replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC.indexOf(d)))
    .replace(/٫/g, '.')
    .replace(/٪/g, '%');
}
