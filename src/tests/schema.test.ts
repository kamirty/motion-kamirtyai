import Ajv2020 from 'ajv/dist/2020';
import { describe, expect, it } from 'vitest';
import schema from '../../schemas/project.v1.schema.json';
import { sampleProject } from '../domain/sampleProject';
import { projectToJson } from '../storage/projectJson';

const validate = new Ajv2020({ allErrors: true }).compile(schema);

describe('project.v1 schema', () => {
  it('accepts the sample project after a JSON round trip', () => {
    const roundTripped = JSON.parse(projectToJson(sampleProject));
    expect(validate(roundTripped), JSON.stringify(validate.errors)).toBe(true);
    expect(roundTripped).toEqual(sampleProject);
  });

  it('rejects a wrong duration, bad colour and unknown fields', () => {
    expect(validate({ ...sampleProject, durationFrames: 1800 })).toBe(false);
    expect(validate({ ...sampleProject, theme: { ...sampleProject.theme, accent: 'red' } })).toBe(false);
    expect(validate({ ...sampleProject, apiKey: 'x' })).toBe(false);
  });
});
