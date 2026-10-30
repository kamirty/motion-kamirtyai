import Ajv2020 from 'ajv/dist/2020';
import { describe, expect, it } from 'vitest';
import schema from '../../schemas/project.v1.schema.json';
import { sampleProject } from '../domain/sampleProject';
import { parseProject } from '../domain/sanitize';
import { setSceneDuration, withScenes } from '../domain/timeline';
import { renderSoundtrack, voiceClips, voiceWindows } from '../engine/audio/sfx';
import { projectToJson } from '../storage/projectJson';
import { projectVoiceIds } from '../storage/voices';

const validate = new Ajv2020({ allErrors: true }).compile(schema);
const ID = 'a1b2c3d4e5f60718293a4b5c';

/** Sample project with a recording on scene 1 (index 1) of `frames` frames. */
const withVoice = (frames: number, index = 1) =>
  withScenes(sampleProject, sampleProject.scenes.map((s, i) => (i === index ? { ...s, voice: { assetId: ID, durationFrames: frames } } : s)));

describe('scene narration (recorded voice)', () => {
  it('survives save/open and validates against the schema', () => {
    const p = withVoice(150);
    const round = JSON.parse(projectToJson(p));
    expect(validate(round), JSON.stringify(validate.errors)).toBe(true);
    expect(parseProject(round).scenes[1].voice).toEqual({ assetId: ID, durationFrames: 150 });
    expect(projectVoiceIds(p)).toEqual([ID]);
  });

  it('drops malformed references and clamps the length', () => {
    const bad = (voice: unknown) => parseProject({ ...sampleProject, scenes: [{ ...sampleProject.scenes[0], voice }] }).scenes[0].voice;
    expect(bad({ assetId: '../../etc', durationFrames: 90 })).toBeUndefined();
    expect(bad({ assetId: ID, durationFrames: -5 })).toBeUndefined();
    expect(bad({ assetId: ID, durationFrames: 'x' })).toBeUndefined();
    expect(bad('voice.webm')).toBeUndefined();
    expect(bad({ assetId: ID, durationFrames: 99999 })).toEqual({ assetId: ID, durationFrames: 3600 });
    expect(validate({ ...sampleProject, scenes: [{ ...sampleProject.scenes[0], voice: { assetId: ID, durationFrames: 90, url: 'https://x' } }] })).toBe(false);
  });

  it('plays from the first frame of its scene and is cut at the scene end', () => {
    const p = withVoice(150);
    const s = p.scenes[1];
    expect(voiceClips(p)).toEqual([{ assetId: ID, start: s.startFrame / 30, length: Math.min(150, s.durationFrames) / 30, cut: 150 > s.durationFrames }]);
    // Longer than the scene: cut, and it follows the scene when an earlier scene changes length.
    const long = withVoice(s.durationFrames + 60);
    expect(voiceClips(long)[0]).toMatchObject({ length: s.durationFrames / 30, cut: true });
    const moved = withScenes(long, setSceneDuration(long.scenes, 0, long.scenes[0].durationFrames + 90));
    expect(voiceClips(moved)[0].start).toBeCloseTo(s.startFrame / 30 + 3);
  });

  it('merges nearby narration windows so the music does not pump between them', () => {
    expect(voiceWindows([
      { assetId: ID, start: 10, length: 4, cut: false },
      { assetId: ID, start: 0, length: 5, cut: false },
      { assetId: ID, start: 5.5, length: 2, cut: false },
    ])).toEqual([[0, 7.5], [10, 14]]);
  });

  it('leaves the soundtrack alone when no recording is available', async () => {
    const p = withVoice(150);
    expect(await renderSoundtrack(p, null, { sfx: false, sceneVoices: () => undefined })).toBeNull();
  });
});

describe('own background music', () => {
  it('keeps a custom music reference through save/open and the schema', () => {
    const p = { ...sampleProject, style: { ...sampleProject.style, music: 'custom' as const, musicAsset: ID, musicName: 'نشيد.mp3' } };
    const round = JSON.parse(projectToJson(p));
    expect(validate(round), JSON.stringify(validate.errors)).toBe(true);
    const back = parseProject(round);
    expect(back.style).toMatchObject({ music: 'custom', musicAsset: ID, musicName: 'نشيد.mp3' });
    expect(projectVoiceIds(back)).toContain(ID);
  });

  it('falls back to generated music when the file reference is missing or malformed', () => {
    expect(parseProject({ ...sampleProject, style: { ...sampleProject.style, music: 'custom' } }).style?.music).toBe('calm');
    expect(parseProject({ ...sampleProject, style: { ...sampleProject.style, music: 'custom', musicAsset: '../x' } }).style?.music).toBe('calm');
    // A stored file that is not currently chosen is not embedded or loaded.
    expect(projectVoiceIds({ ...sampleProject, style: { music: 'calm', musicAsset: ID } })).not.toContain(ID);
  });

  it('accepts embedded music files (mp3, m4a) in a saved project', () => {
    const p = { ...sampleProject, style: { ...sampleProject.style, music: 'custom' as const, musicAsset: ID } };
    for (const type of ['audio/mpeg', 'audio/x-m4a', 'audio/wav']) {
      expect(validate({ ...JSON.parse(projectToJson(p)), assets: { [ID]: `data:${type};base64,AAAA` } }), type).toBe(true);
    }
    expect(validate({ ...JSON.parse(projectToJson(p)), assets: { [ID]: 'data:audio/x-evil;base64,AAAA' } })).toBe(false);
  });
});

describe('music level', () => {
  it('defaults to the standard level, keeps a chosen one, and clamps hostile values', () => {
    expect(parseProject(sampleProject).style?.musicVolume).toBe(1);
    const p = { ...sampleProject, style: { ...sampleProject.style, musicVolume: 0.35 } };
    const round = JSON.parse(projectToJson(p));
    expect(validate(round), JSON.stringify(validate.errors)).toBe(true);
    expect(parseProject(round).style?.musicVolume).toBe(0.35);
    expect(parseProject({ ...sampleProject, style: { ...sampleProject.style, musicVolume: 99 } }).style?.musicVolume).toBe(1.5);
    expect(parseProject({ ...sampleProject, style: { ...sampleProject.style, musicVolume: 'loud' } }).style?.musicVolume).toBe(1);
    expect(validate({ ...sampleProject, style: { ...sampleProject.style, musicVolume: 3 } })).toBe(false);
  });
});
