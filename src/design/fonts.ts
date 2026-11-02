/** Self-hosted Arabic fonts (SIL OFL 1.1, bundled via @fontsource). */
export interface FontOption {
  id: string;
  label: string;
  family: string;
  /** Weight used for titles; display faces only ship 400. */
  bold: 400 | 700;
  /** Group shown in the font menu. */
  group: FontGroup;
}

export type FontGroup = 'modern' | 'kufi' | 'naskh' | 'display';

export const FONT_GROUPS: { id: FontGroup; label: string }[] = [
  { id: 'modern', label: 'عصرية' },
  { id: 'kufi', label: 'كوفية' },
  { id: 'naskh', label: 'نسخ وتقليدية' },
  { id: 'display', label: 'يدوية وزخرفية' },
];

export const FONTS: FontOption[] = [
  { id: 'cairo', label: 'القاهرة (Cairo)', family: 'Cairo', bold: 700, group: 'modern' },
  { id: 'tajawal', label: 'تجوال (Tajawal)', family: 'Tajawal', bold: 700, group: 'modern' },
  { id: 'almarai', label: 'المراعي (Almarai)', family: 'Almarai', bold: 700, group: 'modern' },
  { id: 'readex', label: 'ريدكس (Readex Pro)', family: 'Readex Pro', bold: 700, group: 'modern' },
  { id: 'kufi', label: 'نوتو كوفي (Noto Kufi)', family: 'Noto Kufi Arabic', bold: 700, group: 'kufi' },
  { id: 'plex', label: 'آي بي إم بلكس (IBM Plex)', family: 'IBM Plex Sans Arabic', bold: 700, group: 'modern' },
  { id: 'messiri', label: 'المسيري (El Messiri)', family: 'El Messiri', bold: 700, group: 'naskh' },
  { id: 'lalezar', label: 'لاله‌زار (Lalezar)', family: 'Lalezar', bold: 400, group: 'display' },
  { id: 'alexandria', label: 'الإسكندرية (Alexandria)', family: 'Alexandria', bold: 700, group: 'modern' },
  { id: 'mada', label: 'مدى (Mada)', family: 'Mada', bold: 700, group: 'modern' },
  { id: 'changa', label: 'تشانغا (Changa)', family: 'Changa', bold: 700, group: 'modern' },
  { id: 'reemkufi', label: 'ريم كوفي (Reem Kufi)', family: 'Reem Kufi', bold: 700, group: 'kufi' },
  { id: 'kufam', label: 'كوفام (Kufam)', family: 'Kufam', bold: 700, group: 'kufi' },
  { id: 'amiri', label: 'أميري (Amiri)', family: 'Amiri', bold: 700, group: 'naskh' },
  { id: 'naskh', label: 'نوتو نسخ (Noto Naskh)', family: 'Noto Naskh Arabic', bold: 700, group: 'naskh' },
  { id: 'ruqaa', label: 'عارف رقعة (Aref Ruqaa)', family: 'Aref Ruqaa', bold: 700, group: 'display' },
  { id: 'marhey', label: 'مرحي (Marhey)', family: 'Marhey', bold: 700, group: 'display' },
  { id: 'lemonada', label: 'ليمونادة (Lemonada)', family: 'Lemonada', bold: 700, group: 'display' },
  { id: 'baloo', label: 'بالو بهيجان (Baloo Bhaijaan)', family: 'Baloo Bhaijaan 2', bold: 700, group: 'display' },
  { id: 'rakkas', label: 'رقّاص (Rakkas)', family: 'Rakkas', bold: 400, group: 'display' },
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
