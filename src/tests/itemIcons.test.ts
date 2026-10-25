import { describe, expect, it } from 'vitest';
import { sampleProject } from '../domain/sampleProject';
import { parseProject } from '../domain/sanitize';
import type { Scene } from '../domain/types';
import { effectiveItemIcons, hasItemIcons } from '../engine/itemIcons';
import { sampleScene } from './fixtures/kindSamples';

describe('per-element icons', () => {
  it('uses the user choice where set and keeps automatic, distinct icons elsewhere', () => {
    const s: Scene = { ...sampleScene('summary', 0), itemIcons: ['', 'rocket', '', ''] };
    const icons = effectiveItemIcons(s);
    expect(icons[1]).toBe('rocket');
    expect(new Set(icons).size).toBe(icons.length);
    expect(effectiveItemIcons({ ...s, itemIcons: undefined })[1]).not.toBe('rocket');
  });

  it('applies to cards, text comparisons, KPI tiles and before/after only', () => {
    expect(hasItemIcons(sampleScene('summary'))).toBe(true);
    expect(hasItemIcons(sampleScene('kpis'))).toBe(true);
    expect(hasItemIcons(sampleScene('beforeafter'))).toBe(true);
    expect(hasItemIcons(sampleScene('comparison', 0))).toBe(true);
    expect(hasItemIcons(sampleScene('comparison', 1))).toBe(false); // bar chart: no icons
    expect(hasItemIcons(sampleScene('steps'))).toBe(false);
    expect(effectiveItemIcons({ ...sampleScene('beforeafter'), itemIcons: ['', 'trophy'] })).toEqual(['circle-x', 'trophy']);
  });

  it('is stored and sanitised (unknown icon ids fall back to automatic)', () => {
    const raw = JSON.parse(JSON.stringify(sampleProject));
    raw.scenes[0].itemIcons = ['rocket', 'not-an-icon', 42];
    expect(parseProject(raw).scenes[0].itemIcons).toEqual(['rocket', '', '']);
    raw.scenes[0].itemIcons = ['', 'nope'];
    expect(parseProject(raw).scenes[0].itemIcons).toBeUndefined();
  });
});
