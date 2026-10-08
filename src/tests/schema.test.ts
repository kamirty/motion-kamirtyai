import Ajv2020 from 'ajv/dist/2020';
import { describe, expect, it } from 'vitest';
import schema from '../../schemas/project.v1.schema.json';
import { EXAMPLES } from '../app/examples';
import { sampleProject } from '../domain/sampleProject';
import { parseProject } from '../domain/sanitize';
import { validateTimeline } from '../domain/timeline';
import { ASPECTS, type AspectId } from '../domain/types';
import { generateProject } from '../engine/planner';
import { projectToJson } from '../storage/projectJson';

const validate = new Ajv2020({ allErrors: true }).compile(schema);

describe('project.v1 schema', () => {
  it('accepts the sample and every generated project after a JSON round trip', () => {
    const projects = [sampleProject, ...EXAMPLES.flatMap((e) => (Object.keys(ASPECTS) as AspectId[]).map((aspect) => generateProject(e.text, { aspect, style: {} }).project))];
    for (const p of projects) {
      const round = JSON.parse(projectToJson(p));
      expect(validate(round), JSON.stringify(validate.errors)).toBe(true);
      expect(parseProject(round)).toEqual({ ...p, theme: parseProject(round).theme, style: parseProject(round).style });
    }
  });

  it('rejects a wrong duration, bad colour and unknown fields', () => {
    expect(validate({ ...sampleProject, durationFrames: 1800 })).toBe(false);
    expect(validate({ ...sampleProject, theme: { ...sampleProject.theme, accent: 'red' } })).toBe(false);
    expect(validate({ ...sampleProject, apiKey: 'x' })).toBe(false);
  });
});

describe('import sanitiser', () => {
  it('round-trips a generated project exactly', () => {
    const p = generateProject(EXAMPLES[0].text, { aspect: 'portrait', style: { digits: 'latin', music: 'epic' } }).project;
    expect(parseProject(JSON.parse(projectToJson(p)))).toEqual(p);
  });

  it('repairs timing, clamps strings and drops unknown fields', () => {
    const dirty = {
      ...sampleProject,
      evil: '<img onerror=alert(1)>',
      scenes: sampleProject.scenes.map((s, i) => ({ ...s, durationFrames: 100 * (i + 1), title: 'ع'.repeat(500), extra: 1 })),
      style: { digits: 'roman', transition: 'zoom' },
    };
    const p = parseProject(dirty);
    expect(validateTimeline(p)).toEqual([]);
    expect(p.scenes[0].title.length).toBe(160);
    expect('evil' in p).toBe(false);
    expect(p.style?.digits).toBe('arabic');
    expect(p.style?.transition).toBe('zoom');
    expect(validate(JSON.parse(projectToJson(p)))).toBe(true);
  });

  it('rejects non-projects with Arabic messages', () => {
    expect(() => parseProject(null)).toThrow(/صالح/);
    expect(() => parseProject({ version: 2 })).toThrow(/إصدار/);
    expect(() => parseProject({ version: 1, scenes: [] })).toThrow(/مشاهد/);
  });
});
