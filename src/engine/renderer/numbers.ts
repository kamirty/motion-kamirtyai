const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';

export interface StatValue {
  value: number;
  decimals: number;
  prefix: string;
  suffix: string;
  arabicIndic: boolean;
}

/** Parses a display value such as "71%", "٧١٪", "1.5 مليار" or "1,200" into a number plus surrounding text. */
export function parseStatValue(raw: string): StatValue | null {
  const western = raw
    .replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC.indexOf(d)))
    .replace(/٫/g, '.')
    .replace(/(\d)[,،](\d{3})(?!\d)/g, '$1$2');
  const match = western.match(/^(\D*?)(\d+(?:\.\d+)?)(.*)$/s);
  if (!match) return null;
  const [, prefix, digits, suffix] = match;
  return {
    value: Number(digits),
    decimals: digits.includes('.') ? digits.split('.')[1].length : 0,
    prefix,
    suffix,
    arabicIndic: /[٠-٩]/.test(raw),
  };
}

/** Formats `value` with the same digit system and affixes as the parsed source. */
export function formatStatValue(stat: StatValue, value: number): string {
  let digits = value.toFixed(stat.decimals);
  if (stat.arabicIndic) digits = digits.replace(/\d/g, (d) => ARABIC_INDIC[Number(d)]).replace('.', '٫');
  return `${stat.prefix}${digits}${stat.suffix}`;
}
