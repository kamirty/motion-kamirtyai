import Ajv2020 from 'ajv/dist/2020';
import { describe, expect, it } from 'vitest';
import schema from '../../schemas/project.v1.schema.json';
import { sampleProject } from '../domain/sampleProject';
import { parseImage, parseProject } from '../domain/sanitize';
import { DEFAULT_IMAGE, type Project } from '../domain/types';
import { planCues } from '../engine/audio/sfx';
import { renderFrame } from '../engine/renderer/renderFrame';
import { IMAGE } from '../engine/timing';
import { projectToJson } from '../storage/projectJson';
import { createFakeCtx } from './fakeCtx';

const validate = new Ajv2020({ allErrors: true }).compile(schema);
const assetId = 'a1b2c3d4e5f60718293a4b5c';
const withImage = (patch: object = {}): Project => ({
  ...sampleProject,
  scenes: sampleProject.scenes.map((s, i) => (i === 1 ? { ...s, image: { ...DEFAULT_IMAGE, assetId, ...patch } } : s)),
});

describe('scene pictures', () => {
  it('round-trip through JSON, the schema and the sanitiser', () => {
    const p = withImage({ rotation: -30, shape: 'circle', layer: 'back' });
    const json = JSON.parse(projectToJson(p));
    expect(validate(json), JSON.stringify(validate.errors)).toBe(true);
    expect(parseProject(json).scenes[1].image).toEqual(p.scenes[1].image);
  });

  it('accept embedded image data URLs only', () => {
    const ok = { ...JSON.parse(projectToJson(withImage())), assets: { [assetId]: 'data:image/png;base64,iVBORw0KGgo=' } };
    expect(validate(ok)).toBe(true);
    const bad = { ...ok, assets: { [assetId]: 'data:text/html;base64,PHNjcmlwdD4=' } };
    expect(validate(bad)).toBe(false);
    const badId = { ...ok, assets: { '../evil': 'data:image/png;base64,AAAA' } };
    expect(validate(badId)).toBe(false);
  });

  it('clamp hostile values and drop malformed pictures', () => {
    expect(parseImage({ ...DEFAULT_IMAGE, assetId, scale: 99, rotation: 9999, opacity: -1, shape: 'star' })).toMatchObject({ scale: 1.5, rotation: 180, opacity: 0.1, shape: 'rounded' });
    expect(parseImage({ ...DEFAULT_IMAGE, assetId: 'javascript:alert(1)' })).toBeUndefined();
    expect(parseImage('x')).toBeUndefined();
  });

  it('render (placeholder before the bitmap loads) without throwing, in front of or behind content', () => {
    for (const layer of ['front', 'back'] as const) {
      for (const f of [1200, 1200 + IMAGE.enter, 1300, 2399]) {
        const { ctx, ops } = createFakeCtx();
        expect(() => renderFrame(withImage({ layer }), f, ctx)).not.toThrow();
        if (f > 1200 + IMAGE.enter) expect(ops.some((o) => o.startsWith('clip('))).toBe(true);
      }
    }
  });

  it('pop a sound when the picture enters, unless it has no entrance', () => {
    const at = 1200 + IMAGE.enter;
    expect(planCues(withImage()).some((c) => c.frame === at && c.kind === 'pop')).toBe(true);
    expect(planCues(withImage({ entrance: 'none' })).some((c) => c.frame === at && c.kind === 'pop' && c.step === 5)).toBe(false);
  });
});
