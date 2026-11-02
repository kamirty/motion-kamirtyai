import { describe, expect, it } from 'vitest';
import { sampleProject } from '../domain/sampleProject';
import { parseProject } from '../domain/sanitize';
import { renderFrame } from '../engine/renderer/renderFrame';
import { headerStyleOf, wordTokens } from '../engine/renderer/lively';
import type { Project } from '../domain/types';
import { createFakeCtx, drawnText } from './fakeCtx';

describe('lively motion', () => {
  it('splits titles into whole words without reversing anything, keeping Latin phrases together', () => {
    expect(wordTokens('مولّد موشن إنفوجرافيك')).toEqual(['مولّد', 'موشن', 'إنفوجرافيك']);
    expect(wordTokens('أداة Kamirty Motion المجانية 2026')).toEqual(['أداة', 'Kamirty Motion', 'المجانية', '2026']);
    expect(wordTokens('الذكاء الاصطناعي AI في التعليم')).toEqual(['الذكاء', 'الاصطناعي', 'AI', 'في', 'التعليم']);
    // Every token appears in the original text exactly as written (no manual reordering).
    const title = 'خطوات «انضم» إلى Zoom في 3 دقائق';
    for (const t of wordTokens(title)) expect(title).toContain(t);
  });

  it('rotates header styles across scenes only when lively motion is on', () => {
    expect([0, 1, 2, 3, 4].map((i) => headerStyleOf(true, i))).toEqual(['classic', 'kinetic', 'band', 'center', 'classic']);
    expect(headerStyleOf(false, 1)).toBe('classic');
  });

  it('is on by default, can be turned off, and draws every title word in each header style', () => {
    expect(parseProject(sampleProject).style?.lively).toBe(true);
    expect(parseProject({ ...sampleProject, style: { ...sampleProject.style, lively: false } }).style?.lively).toBe(false);
    const p: Project = { ...sampleProject, style: { ...sampleProject.style, lively: true } };
    p.scenes.forEach((s, i) => {
      if (!s.title || s.kind === 'hero' || s.kind === 'quote' || s.kind === 'outro' || s.kind === 'chapter') return;
      const { ctx, ops } = createFakeCtx();
      renderFrame(p, s.startFrame + Math.floor(s.durationFrames * 0.6), ctx);
      const text = drawnText(ops).join(' ');
      for (const w of wordTokens(s.title)) expect(text, `scene ${i}`).toContain(w);
    });
  });

  it('keeps preview and export identical (pure function of the frame)', () => {
    const p: Project = { ...sampleProject, style: { ...sampleProject.style, lively: true } };
    for (const f of [10, 400, 1500]) {
      renderFrame(p, f, createFakeCtx().ctx); // warm the layout caches
      const a = createFakeCtx();
      const b = createFakeCtx();
      renderFrame(p, f, a.ctx);
      renderFrame(p, f, b.ctx);
      expect(a.ops).toEqual(b.ops);
    }
  });
});
