import { describe, expect, it } from 'vitest';
import { KIND_BLURBS, KIND_GROUPS, KIND_HINTS, KIND_LABELS } from '../app/components/kinds';
import { LIMITS, SCENE_KINDS } from '../domain/types';
import { KIND_SAMPLES, KIND_STARTERS } from '../engine/kindSamples';
import { initialAssistantState, respond } from '../assistant/engine';
import type { AssistantContext } from '../assistant/types';

const ctx: AssistantContext = { sceneCount: 6, kinds: ['hero'], aspect: 'landscape', music: 'calm', sfx: true, hasImages: false, exportFormat: 'mp4' };

describe('scene-kind gallery', () => {
  it('lists every kind exactly once, each with a label, blurb, hint, sample and starter', () => {
    const listed = KIND_GROUPS.flatMap((g) => g.kinds);
    expect(new Set(listed).size).toBe(listed.length);
    expect([...listed].sort()).toEqual([...SCENE_KINDS].sort());
    for (const k of SCENE_KINDS) {
      expect(KIND_LABELS[k], k).toBeTruthy();
      expect(KIND_BLURBS[k], k).toBeTruthy();
      expect(KIND_HINTS[k], k).toBeTruthy();
      expect(KIND_SAMPLES[k].length, k).toBeGreaterThan(0);
    }
  });

  it('starter content stays within the editor limits and invents no facts (no sources, no real-world numbers)', () => {
    for (const k of SCENE_KINDS) {
      const s = KIND_STARTERS[k];
      expect(s.title.length, k).toBeLessThanOrEqual(LIMITS.titleChars);
      expect(s.items.length, k).toBeLessThanOrEqual(LIMITS.items);
      for (const it of s.items) expect(it.length, k).toBeLessThanOrEqual(LIMITS.itemChars);
      expect([s.title, ...s.items].join(' '), k).not.toMatch(/المصدر|وفق|مليار|مليون/);
    }
  });

  it('the assistant names all the kinds', () => {
    const reply = respond('ما أنواع المشاهد؟', ctx, initialAssistantState).reply;
    expect(reply.text).toContain(`${SCENE_KINDS.length} نوعًا`);
    for (const k of SCENE_KINDS) expect(reply.text).toContain(KIND_LABELS[k]);
  });
});
