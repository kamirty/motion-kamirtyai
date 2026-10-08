/** Self-hosted Arabic fonts (SIL OFL 1.1, bundled via @fontsource). */
export interface FontOption {
  id: string;
  label: string;
  family: string;
  /** Weight used for titles; display faces only ship 400. */
  bold: 400 | 700;
}

export const FONTS: FontOption[] = [
  { id: 'cairo', label: 'القاهرة (Cairo)', family: 'Cairo', bold: 700 },
  { id: 'tajawal', label: 'تجوال (Tajawal)', family: 'Tajawal', bold: 700 },
  { id: 'almarai', label: 'المراعي (Almarai)', family: 'Almarai', bold: 700 },
  { id: 'readex', label: 'ريدكس (Readex Pro)', family: 'Readex Pro', bold: 700 },
  { id: 'kufi', label: 'نوتو كوفي (Noto Kufi)', family: 'Noto Kufi Arabic', bold: 700 },
  { id: 'plex', label: 'آي بي إم بلكس (IBM Plex)', family: 'IBM Plex Sans Arabic', bold: 700 },
  { id: 'messiri', label: 'المسيري (El Messiri)', family: 'El Messiri', bold: 700 },
  { id: 'lalezar', label: 'لاله‌زار (Lalezar)', family: 'Lalezar', bold: 400 },
];

export const fontById = (id: string): FontOption => FONTS.find((f) => f.id === id) ?? FONTS[0];

export const FALLBACK_STACK = '"Segoe UI", Tahoma, sans-serif';

export const cssFamily = (f: FontOption): string => `"${f.family}", ${FALLBACK_STACK}`;

/** Ensures both weights of a font are loaded (with Arabic and Latin glyphs) before frames are drawn. */
export async function ensureFontLoaded(id: string): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const f = fontById(id);
  const sample = 'أبجد هوز ١٢٣ 123 AI';
  await Promise.all([
    document.fonts.load(`400 32px "${f.family}"`, sample),
    document.fonts.load(`${f.bold} 32px "${f.family}"`, sample),
  ]).catch(() => undefined);
}
