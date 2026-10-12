import { describe, expect, it } from 'vitest';
import { sampleProject } from '../domain/sampleProject';
import { parseProject } from '../domain/sanitize';
import { LOOKS, type LookId, type Project } from '../domain/types';
import { renderFrame } from '../engine/renderer/renderFrame';
import { createFakeCtx } from './fakeCtx';

const withLook = (look: LookId): Project => ({ ...sampleProject, style: { ...sampleProject.style!, look } }) as Project;
const ops = (look: LookId, f = 700) => {
  const { ctx, ops } = createFakeCtx();
  renderFrame(withLook(look), f, ctx);
  return ops;
};

describe('visual look (النمط البصري)', () => {
  it('cartoon outlines sizeable shapes and casts hard shadows', () => {
    const o = ops('cartoon');
    expect(o.filter((x) => x === 'stroke()').length).toBeGreaterThan(ops('modern').filter((x) => x === 'stroke()').length);
    expect(o.some((x) => x.startsWith('shadowOffsetX='))).toBe(true);
  });

  it('minimal removes glows (radial gradients become transparent)', () => {
    const o = ops('minimal', 40);
    const radialStops = o.join('\n').split('createRadialGradient').slice(1).map((chunk) => chunk.split('\n').filter((l) => l.startsWith('stop(')).slice(0, 2));
    for (const stops of radialStops) for (const s of stops) expect(s).toContain('rgba(0,0,0,0)');
  });

  it('every look renders deterministically and leaves the context unwrapped', () => {
    for (const look of LOOKS) {
      const a = createFakeCtx();
      const b = createFakeCtx();
      renderFrame(withLook(look), 900, a.ctx);
      renderFrame(withLook(look), 900, b.ctx);
      expect(a.ops).toEqual(b.ops);
    }
    expect(ops('modern')).toEqual(ops('modern'));
  });

  it('is stored, validated and defaults to modern', () => {
    expect(parseProject(JSON.parse(JSON.stringify(withLook('cartoon')))).style?.look).toBe('cartoon');
    const bad = JSON.parse(JSON.stringify(withLook('cartoon')));
    bad.style.look = 'neon';
    expect(parseProject(bad).style?.look).toBe('modern');
  });
});
