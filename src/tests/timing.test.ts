import Ajv2020 from 'ajv/dist/2020';
import { describe, expect, it } from 'vitest';
import schema from '../../schemas/project.v1.schema.json';
import { sampleProject } from '../domain/sampleProject';
import { parseProject } from '../domain/sanitize';
import type { Project, Scene } from '../domain/types';
import { planCues } from '../engine/audio/sfx';
import { renderFrame } from '../engine/renderer/renderFrame';
import { autoReveal, hasItemTiming, itemReveal, revealSlots, withReveal } from '../engine/timing';
import { createFakeCtx } from './fakeCtx';

const steps: Scene = {
  id: 's', kind: 'steps', startFrame: 0, durationFrames: 300,
  title: 'خطوات ترشيد الماء في 2025', items: ['أغلق الصنبور', 'استخدم 3 لترات فقط', 'افحص التسريب عبر IoT'], icon: 'droplet',
};

describe('custom reveal timing', () => {
  it('uses custom frames, clamped inside the scene', () => {
    const s = { ...steps, reveals: [5, 400, 90] };
    expect(itemReveal(s, 0, 3)).toBe(5);
    expect(itemReveal(s, 1, 3)).toBe(288);
    expect(itemReveal(s, 2, 3)).toBe(90);
  });

  it('falls back to the automatic time for missing slots', () => {
    const s = { ...steps, reveals: [5] };
    expect(itemReveal(s, 2, 3)).toBe(autoReveal(steps, 2, 3));
  });

  it('withReveal keeps the other slots at their current time', () => {
    expect(withReveal(steps, 1, 77)).toEqual([itemReveal(steps, 0, 3), 77, itemReveal(steps, 2, 3)]);
  });

  it('orders pyramid slots base first', () => {
    const p = { ...steps, kind: 'pyramid' as const };
    expect(revealSlots(p).map((x) => x.index)).toEqual([2, 1, 0]);
    expect(hasItemTiming('hero')).toBe(false);
    expect(revealSlots({ ...steps, kind: 'hero' })).toEqual([]);
  });

  it('sound effects follow the custom times', () => {
    const project: Project = { ...sampleProject, style: { ...sampleProject.style!, sfx: true } } as Project;
    const scenes = project.scenes.map((s) => (s.kind === 'steps' || s.kind === 'summary' ? { ...s, reveals: [33, 44, 55, 66, 77, 88] } : s));
    const target = scenes.find((s) => s.reveals);
    if (!target) return;
    const cues = planCues({ ...project, scenes });
    expect(cues.some((c) => c.frame === target.startFrame + 33)).toBe(true);
  });
});

describe('entrance and validation', () => {
  it('sanitizes reveals and entrance, and the schema accepts them', () => {
    const raw = JSON.parse(JSON.stringify(sampleProject));
    raw.scenes[0].reveals = [10, 20.4];
    raw.scenes[0].entrance = 'zoom';
    raw.scenes[1].reveals = [10, -3];
    raw.scenes[1].entrance = 'explode';
    const p = parseProject(raw);
    expect(p.scenes[0].reveals).toEqual([10, 20]);
    expect(p.scenes[0].entrance).toBe('zoom');
    expect(p.scenes[1].reveals).toBeUndefined();
    expect(p.scenes[1].entrance).toBe('none');
    const validate = new Ajv2020({ allErrors: true }).compile(schema);
    expect(validate(JSON.parse(JSON.stringify(p))), JSON.stringify(validate.errors)).toBe(true);
  });

  it('renders every entrance without throwing and stays deterministic', () => {
    for (const entrance of ['rise', 'drop', 'zoom', 'side', 'spin'] as const) {
      const project = { ...sampleProject, scenes: sampleProject.scenes.map((s) => ({ ...s, entrance })) } as Project;
      const a = createFakeCtx();
      const b = createFakeCtx();
      renderFrame(project, 8, createFakeCtx().ctx); // warm caches
      renderFrame(project, 8, a.ctx);
      renderFrame(project, 8, b.ctx);
      expect(a.ops).toEqual(b.ops);
      expect(a.ops.length).toBeGreaterThan(0);
    }
  });
});
