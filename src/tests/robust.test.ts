import { describe, expect, it } from 'vitest';
import { fullTheme, PRESETS } from '../design/presets';
import { ASPECTS, LOOKS, SCENE_KINDS, type AspectId, type Project, type Scene } from '../domain/types';
import { renderFrame } from '../engine/renderer/renderFrame';
import { sampleScene } from './fixtures/kindSamples';
import { KIND_STARTERS } from '../engine/kindSamples';
import { createFakeCtx } from './fakeCtx';

const LONG = 'عنوان طويل جدًا جدًا عن الذكاء الاصطناعي AI في التعليم عام 2026 يشرح كل شيء بالتفصيل الممل حتى لا يبقى مكان للمحتوى في المشهد أبدًا';
const variants = (kind: Scene['kind'], d: number): Scene[] => [
  sampleScene(kind, 0, d),
  sampleScene(kind, 1, d),
  { ...sampleScene(kind, 1, d), title: LONG, items: sampleScene(kind, 1, d).items.map((it) => `${it} ${LONG}`) },
  { ...sampleScene(kind, 0, d), title: '', items: [] },
  { ...sampleScene(kind, 0, d), title: 'س', items: ['1'] },
  // Neutral content a scene added from the gallery starts with.
  { ...sampleScene(kind, 0, d), title: KIND_STARTERS[kind].title, items: [...KIND_STARTERS[kind].items] },
];

describe('every scene renders without canvas errors (negative radii abort exports)', () => {
  for (const aspect of Object.keys(ASPECTS) as AspectId[]) {
    for (const [ki, kind] of SCENE_KINDS.entries()) {
      const look = LOOKS[ki % LOOKS.length];
      it(`${kind} · ${aspect} · ${look}`, () => {
        for (const d of [90, 450]) {
          for (const scene of variants(kind, d)) {
            const project: Project = {
              version: 1, title: 't', locale: 'ar', fps: 30, durationFrames: d,
              size: { width: ASPECTS[aspect].width, height: ASPECTS[aspect].height },
              theme: fullTheme(PRESETS[0].theme), scenes: [scene],
              style: { preset: PRESETS[0].id, font: 'cairo', digits: 'arabic', transition: 'fade', background: 'plain', music: 'none', sfx: false, pace: 'balanced', look },
            } as Project;
            for (let f = 0; f < d; f += 3) {
              const { ctx } = createFakeCtx();
              expect(() => renderFrame(project, f, ctx), `${kind} ${aspect} d=${d} f=${f} "${scene.title.slice(0, 12)}"`).not.toThrow();
            }
          }
        }
      });
    }
  }
});
