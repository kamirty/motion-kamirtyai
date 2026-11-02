import { describe, expect, it } from 'vitest';
import { FONTS, FONT_GROUPS, fontById } from '../design/fonts';

describe('fonts', () => {
  const imports = Object.values(import.meta.glob('../design/fontImports.ts', { query: '?raw', import: 'default', eager: true }))[0] as string;
  it('offers 20 fonts, each with a unique id and label and a known group', () => {
    expect(FONTS).toHaveLength(20);
    expect(new Set(FONTS.map((f) => f.id)).size).toBe(FONTS.length);
    expect(new Set(FONTS.map((f) => f.label)).size).toBe(FONTS.length);
    for (const f of FONTS) expect(FONT_GROUPS.map((g) => g.id)).toContain(f.group);
    for (const g of FONT_GROUPS) expect(FONTS.some((f) => f.group === g.id)).toBe(true);
    expect(fontById('unknown').id).toBe('cairo');
  });

  it('bundles the regular and title weights of every font', () => {
    for (const f of FONTS) {
      const pkg = f.family.toLowerCase().replace(/ /g, '-');
      expect(imports, f.id).toContain(`@fontsource/${pkg}/400.css`);
      expect(imports, f.id).toContain(`@fontsource/${pkg}/${f.bold}.css`);
    }
  });
});
