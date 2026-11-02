import Ajv2020 from 'ajv/dist/2020';
import { describe, expect, it } from 'vitest';
import schema from '../../schemas/project.v1.schema.json';
import { KIND_VARIANT_LABELS } from '../app/components/kinds';
import { fullTheme, PRESETS } from '../design/presets';
import { sampleProject } from '../domain/sampleProject';
import { parseProject } from '../domain/sanitize';
import { ASPECTS, LOOKS, SCENE_KINDS, type AspectId, type Project, type Scene } from '../domain/types';
import { renderFrame } from '../engine/renderer/renderFrame';
import { variantDrawerCount } from '../engine/renderer/scenes';
import { KIND_VARIANTS, layoutCount, variantOf } from '../engine/variants';
import { projectToJson } from '../storage/projectJson';
import { sampleScene } from './fixtures/kindSamples';
import { createFakeCtx } from './fakeCtx';

const validate = new Ajv2020({ allErrors: true }).compile(schema);
const LONG = 'نص طويل جدًا عن الذكاء الاصطناعي AI في التعليم عام 2026 يشرح كل شيء بالتفصيل حتى لا يبقى مكان';

describe('alternative layouts', () => {
  it('every declared layout has a drawer and a name', () => {
    for (const k of SCENE_KINDS) {
      expect(variantDrawerCount(k), k).toBe(KIND_VARIANTS[k] ?? 0);
      expect(KIND_VARIANT_LABELS[k]?.length ?? 0, k).toBe(KIND_VARIANTS[k] ?? 0);
    }
  });

  it('picks the chosen layout, an automatic one when lively, else the main one', () => {
    const s = sampleScene('summary', 0);
    expect(variantOf({ ...s, variant: 2 }, 0, false)).toBe(2);
    expect(variantOf({ ...s, variant: 9 }, 0, true)).toBe(layoutCount('summary') - 1);
    expect(variantOf(s, 3, false)).toBe(0);
    const auto = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => variantOf(s, i, true));
    expect(new Set(auto).size).toBeGreaterThan(1);
    expect(auto).toEqual([0, 1, 2, 3, 4, 5, 6, 7].map((i) => variantOf(s, i, true)));
  });

  it('round-trips through save/open and the schema; drops bad values', () => {
    const p = { ...sampleProject, scenes: sampleProject.scenes.map((s, i) => (i === 1 ? { ...s, variant: 1 } : s)) };
    const json = JSON.parse(projectToJson(p));
    expect(validate(json), JSON.stringify(validate.errors)).toBe(true);
    expect(parseProject(json).scenes[1].variant).toBe(1);
    const bad = (variant: unknown) => parseProject({ ...sampleProject, scenes: [{ ...sampleProject.scenes[0], variant }] }).scenes[0].variant;
    expect(bad(-1)).toBeUndefined();
    expect(bad(1.5)).toBeUndefined();
    expect(bad('2')).toBeUndefined();
  });

  describe('render without canvas errors in every aspect and look', () => {
    for (const kind of Object.keys(KIND_VARIANTS) as Scene['kind'][]) {
      for (let v = 1; v <= (KIND_VARIANTS[kind] ?? 0); v++) {
        it(`${kind} layout ${v}`, () => {
          for (const aspect of Object.keys(ASPECTS) as AspectId[]) {
            for (const [li, look] of LOOKS.entries()) {
              for (const scene of [
                sampleScene(kind, 0, 300),
                sampleScene(kind, 1, 300),
                { ...sampleScene(kind, 1, 90), title: LONG, items: sampleScene(kind, 1, 90).items.map((it) => `${it} ${LONG}`) },
                { ...sampleScene(kind, 0, 300), items: [] },
              ]) {
                const project: Project = {
                  version: 1, title: 't', locale: 'ar', fps: 30, durationFrames: scene.durationFrames,
                  size: { width: ASPECTS[aspect].width, height: ASPECTS[aspect].height },
                  theme: fullTheme(PRESETS[li].theme), scenes: [{ ...scene, variant: v }],
                  style: { preset: PRESETS[li].id, font: 'cairo', digits: 'arabic', transition: 'fade', background: 'plain', music: 'none', sfx: false, pace: 'balanced', look, lively: true },
                } as Project;
                for (let f = 0; f < scene.durationFrames; f += 7) {
                  const { ctx } = createFakeCtx();
                  expect(() => renderFrame(project, f, ctx), `${aspect} ${look} f=${f}`).not.toThrow();
                }
              }
            }
          }
        });
      }
    }
  });
});
