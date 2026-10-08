import type { BackgroundId, Theme, TransitionId } from '../domain/types';

export interface StylePreset {
  id: string;
  label: string;
  theme: Required<Theme>;
  transition: TransitionId;
  background: BackgroundId;
  font: string;
}

/** Curated palettes; foreground/background pairs keep WCAG AA contrast for large text. */
export const PRESETS: StylePreset[] = [
  {
    id: 'ocean', label: 'محيط', font: 'cairo', transition: 'slide', background: 'gradient',
    theme: { background: '#0B1E33', surface: '#13304D', foreground: '#F2F7FC', accent: '#2EC4B6', accent2: '#4EA8F2' },
  },
  {
    id: 'sunset', label: 'غروب', font: 'tajawal', transition: 'zoom', background: 'waves',
    theme: { background: '#2B1331', surface: '#3F1D47', foreground: '#FFF4EC', accent: '#FF8A5B', accent2: '#FFC857' },
  },
  {
    id: 'school', label: 'مدرسي', font: 'almarai', transition: 'slide', background: 'dots',
    theme: { background: '#FFF9EE', surface: '#FFFFFF', foreground: '#1F2A44', accent: '#F25C54', accent2: '#3A86FF' },
  },
  {
    id: 'mint', label: 'نعناع', font: 'readex', transition: 'fade', background: 'dots',
    theme: { background: '#ECF8F3', surface: '#FFFFFF', foreground: '#12352B', accent: '#14946B', accent2: '#F2A541' },
  },
  {
    id: 'royal', label: 'ملكي', font: 'messiri', transition: 'wipe', background: 'gradient',
    theme: { background: '#14122B', surface: '#221F45', foreground: '#F6F1E7', accent: '#D4A64A', accent2: '#8E7DFF' },
  },
  {
    id: 'neon', label: 'نيون', font: 'lalezar', transition: 'zoom', background: 'waves',
    theme: { background: '#0A0A12', surface: '#16162A', foreground: '#F5F5FF', accent: '#00F0B5', accent2: '#FF3D8B' },
  },
  {
    id: 'desert', label: 'صحراء', font: 'kufi', transition: 'slide', background: 'waves',
    theme: { background: '#F6EBDD', surface: '#FFF8EF', foreground: '#3B2A1E', accent: '#C2652F', accent2: '#2F7F86' },
  },
  {
    id: 'health', label: 'صحة', font: 'plex', transition: 'fade', background: 'gradient',
    theme: { background: '#F3F8FF', surface: '#FFFFFF', foreground: '#0E2340', accent: '#1E88E5', accent2: '#2BB673' },
  },
];

export const presetById = (id: string): StylePreset => PRESETS.find((p) => p.id === id) ?? PRESETS[0];

/** Fills optional theme colours derived from the required ones. */
export function fullTheme(theme: Theme): Required<Theme> {
  return {
    background: theme.background,
    foreground: theme.foreground,
    accent: theme.accent,
    accent2: theme.accent2 ?? theme.accent,
    surface: theme.surface ?? mix(theme.background, theme.foreground, 0.08),
  };
}

const hex = (c: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) as [number, number, number];
const toHex = (rgb: number[]): string => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** Linear blend of two #RRGGBB colours. */
export const mix = (a: string, b: string, t: number): string => {
  const [x, y] = [hex(a), hex(b)];
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
};

/** #RRGGBB with alpha as an rgba() string. */
export const alpha = (c: string, a: number): string => {
  const [r, g, b] = hex(c);
  return `rgba(${r},${g},${b},${a})`;
};

/** WCAG relative luminance contrast ratio. */
export function contrast(a: string, b: string): number {
  const lum = (c: string) => {
    const [r, g, b] = hex(c).map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Picks whichever of two colours reads better on `bg`. */
export const readableOn = (bg: string, light = '#FFFFFF', dark = '#111111'): string =>
  contrast(bg, light) >= contrast(bg, dark) ? light : dark;
