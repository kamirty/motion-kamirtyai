import { describe, expect, it } from 'vitest';
import { EXAMPLES } from '../app/examples';
import { generateProject } from '../engine/planner';
import { planCues, cuesKey } from '../engine/audio/sfx';
import { renderFrame } from '../engine/renderer/renderFrame';
import { itemReveal, shownItems } from '../engine/timing';
import type { Project } from '../domain/types';
import { withScenes } from '../domain/timeline';
import { sampleScene } from './fixtures/kindSamples';
import { createFakeCtx, drawnText } from './fakeCtx';

const projects = EXAMPLES.map((e) => generateProject(e.text, { aspect: 'landscape', style: { digits: 'latin' } }).project);
const render = (p: Project, frame: number) => {
  const { ctx, ops } = createFakeCtx();
  renderFrame(p, frame, ctx);
  return ops;
};
const drawnAt = (p: Project, frame: number) => drawnText(render(p, frame)).join('\n');

describe('sound-effect cues', () => {
  it('are deterministic, sorted and inside the 120 s timeline', () => {
    for (const p of projects) {
      const cues = planCues(p);
      expect(cues).toEqual(planCues(p));
      expect(cues.length).toBeGreaterThan(5);
      cues.forEach((c, i) => {
        expect(c.frame).toBeGreaterThanOrEqual(0);
        expect(c.frame).toBeLessThan(p.durationFrames);
        if (i) expect(c.frame).toBeGreaterThanOrEqual(cues[i - 1].frame);
      });
    }
  });

  it('whooshes once per cut and pops once per revealed list item', () => {
    for (const p of projects) {
      const cues = planCues(p);
      expect(cues.filter((c) => c.kind === 'whoosh')).toHaveLength(p.scenes.length - 1);
      const listItems = p.scenes
        .filter((s) => ['steps', 'summary', 'timeline', 'comparison'].includes(s.kind))
        .reduce((n, s) => n + shownItems(s).filter((_, i, all) => itemReveal(s, i, all.length) < s.durationFrames - 10).length, 0);
      expect(cues.filter((c) => c.kind === 'pop' && c.step >= 0).length).toBeGreaterThanOrEqual(listItems);
    }
  });

  it('each item pop lands on the frame its item starts to appear on screen', () => {
    let checked = 0;
    for (const p of projects) {
      const pops = new Set(planCues(p).filter((c) => c.kind === 'pop').map((c) => c.frame));
      for (const scene of p.scenes) {
        if (!['steps', 'summary', 'timeline', 'comparison'].includes(scene.kind)) continue;
        const items = shownItems(scene);
        items.forEach((item, i) => {
          const local = itemReveal(scene, i, items.length);
          if (local >= scene.durationFrames - 10) return;
          expect(pops.has(scene.startFrame + local), `${scene.id} item ${i} has a pop`).toBe(true);
          // On the cue frame the item is still hidden; a few frames later its words are drawn.
          const before = drawnText(render(p, scene.startFrame + local));
          const after = drawnText(render(p, scene.startFrame + local + 4));
          expect(after.length, `${scene.id}:${i}`).toBeGreaterThan(before.length);
          // Numbers count up from zero as they appear, so only words are compared.
          const words = item.split(/[\s:：]+/).filter((w) => w.length > 2 && !/[0-9٠-٩]/.test(w));
          const shown = after.join(' ');
          for (const w of words) expect(shown, `${scene.id}:${i} "${w}"`).toContain(w);
          checked++;
        });
      }
    }
    expect(checked).toBeGreaterThan(8);
  });

  it('cue key ignores wording but follows timing changes', () => {
    const p = projects[0];
    const reworded = { ...p, scenes: p.scenes.map((s) => ({ ...s, title: `${s.title}!` })) };
    expect(cuesKey(reworded)).toBe(cuesKey(p));
    const retimed = { ...p, scenes: p.scenes.map((s, i) => ({ ...s, durationFrames: i === 0 ? s.durationFrames - 30 : i === 1 ? s.durationFrames + 30 : s.durationFrames, startFrame: i === 1 ? s.startFrame - 30 : s.startFrame })) };
    expect(cuesKey(retimed)).not.toBe(cuesKey(p));
  });
});

describe('video carries no site mark', () => {
  it('never draws the site address or logo text', () => {
    for (const f of [0, 300, 1800, 3599]) {
      const text = drawnAt(projects[0], f);
      expect(text).not.toMatch(/kamirtyai|motion\./i);
    }
  });
});

describe('motion-specific sounds and exits', () => {
  const one = (kind: Project['scenes'][number]['kind']): Project =>
    withScenes({ ...projects[0], style: { ...projects[0].style, sfx: true } }, [sampleScene(kind, 0, 300), sampleScene('summary', 0, 300)]);
  it('gives the newer motions their own sound', () => {
    const expected: [Project['scenes'][number]['kind'], string][] = [
      ['domino', 'clack'], ['gears', 'cog'], ['liquid', 'pour'], ['balance', 'thud'], ['spotlight', 'switch'],
      ['conveyor', 'belt'], ['folded', 'paper'], ['magnet', 'clack'], ['capsule', 'rattle'], ['capsule', 'burst'],
    ];
    for (const [kind, sound] of expected) {
      const p = one(kind);
      const inScene = planCues(p).filter((c) => c.frame < p.scenes[0].durationFrames);
      expect(inScene.map((c) => c.kind), kind).toContain(sound);
    }
  });

  it('plays one leaving sound per scene, before the next whoosh', () => {
    const p = one('domino');
    const cues = planCues(p);
    const exits = cues.filter((c) => c.kind === 'exit');
    expect(exits).toHaveLength(2);
    const whoosh = cues.find((c) => c.kind === 'whoosh')!;
    expect(exits[0].frame).toBeLessThan(whoosh.frame);
    expect(exits[1].frame).toBeLessThan(p.durationFrames);
  });
});
