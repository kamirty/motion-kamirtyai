import { describe, expect, it } from 'vitest';
import { sampleProject } from '../domain/sampleProject';
import { detectExportPlan } from '../engine/export/capabilities';
import { checkMetadata } from '../engine/export/verify';

const size = { width: 1280, height: 720 };

describe('export capability detection', () => {
  it('reports unsupported when WebCodecs is missing', async () => {
    const r = await detectExportPlan(size, async () => 'avc', false, async () => null);
    expect(r.supported).toBe(false);
  });

  it('reports unsupported when no codec can encode', async () => {
    const r = await detectExportPlan(size, async () => null, true, async () => null);
    expect(r.supported).toBe(false);
    if (!r.supported) expect(r.reason).toContain('1280×720');
  });

  it('treats a throwing probe as unsupported rather than crashing', async () => {
    const r = await detectExportPlan(size, async () => { throw new Error('boom'); }, true, async () => null);
    expect(r.supported).toBe(false);
  });

  it('prefers MP4/H.264', async () => {
    const r = await detectExportPlan(size, async (codecs) => codecs[0], true, async () => null);
    expect(r).toMatchObject({ supported: true, plan: { container: 'mp4', codec: 'avc' } });
  });

  it('includes the first encodable audio codec, or none', async () => {
    const withAudio = await detectExportPlan(size, async (c) => c[0], true, async (c) => c[0]);
    expect(withAudio).toMatchObject({ supported: true, plan: { audioCodec: 'aac' } });
    const silent = await detectExportPlan(size, async (c) => c[0], true, async () => null);
    expect(silent).toMatchObject({ supported: true, plan: { audioCodec: null } });
  });

  it('falls back to WebM when H.264 is unavailable', async () => {
    const r = await detectExportPlan(size, async (codecs) => (codecs.includes('vp9') ? 'vp9' : null), true, async () => 'opus');
    expect(r).toMatchObject({ supported: true, plan: { container: 'webm', codec: 'vp9', extension: 'webm' } });
  });
});

describe('export verification', () => {
  const good = { durationSeconds: 120, frameCount: 3600, width: 1280, height: 720, codec: 'avc', audioCodec: null, sizeBytes: 1 };

  it('accepts exact metadata', () => {
    expect(checkMetadata(sampleProject, good)).toEqual([]);
  });

  it('flags wrong duration, frame count and size', () => {
    expect(checkMetadata(sampleProject, { ...good, durationSeconds: 119.9 })).toHaveLength(1);
    expect(checkMetadata(sampleProject, { ...good, durationSeconds: 120.02 })).toHaveLength(0);
    expect(checkMetadata(sampleProject, { ...good, frameCount: 3599 })).toHaveLength(1);
    expect(checkMetadata(sampleProject, { ...good, width: 1920 })).toHaveLength(1);
  });
});
