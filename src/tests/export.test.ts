import { describe, expect, it } from 'vitest';
import { sampleProject } from '../domain/sampleProject';
import { detectExportPlan } from '../engine/export/capabilities';
import { checkMetadata } from '../engine/export/verify';

const size = { width: 1280, height: 720 };

describe('export capability detection', () => {
  it('reports unsupported when WebCodecs is missing', async () => {
    const r = await detectExportPlan(size, async () => 'avc', false);
    expect(r.supported).toBe(false);
  });

  it('reports unsupported when no codec can encode', async () => {
    const r = await detectExportPlan(size, async () => null, true);
    expect(r.supported).toBe(false);
    if (!r.supported) expect(r.reason).toContain('1280×720');
  });

  it('treats a throwing probe as unsupported rather than crashing', async () => {
    const r = await detectExportPlan(size, async () => { throw new Error('boom'); }, true);
    expect(r.supported).toBe(false);
  });

  it('prefers MP4/H.264', async () => {
    const r = await detectExportPlan(size, async (codecs) => codecs[0], true);
    expect(r).toMatchObject({ supported: true, plan: { container: 'mp4', codec: 'avc' } });
  });

  it('falls back to WebM when H.264 is unavailable', async () => {
    const r = await detectExportPlan(size, async (codecs) => (codecs.includes('vp9') ? 'vp9' : null), true);
    expect(r).toMatchObject({ supported: true, plan: { container: 'webm', codec: 'vp9', extension: 'webm' } });
  });
});

describe('export verification', () => {
  const good = { durationSeconds: 120, frameCount: 3600, width: 1280, height: 720, codec: 'avc', sizeBytes: 1 };

  it('accepts exact metadata', () => {
    expect(checkMetadata(sampleProject, good)).toEqual([]);
  });

  it('flags wrong duration, frame count and size', () => {
    expect(checkMetadata(sampleProject, { ...good, durationSeconds: 119.5 })).toHaveLength(1);
    expect(checkMetadata(sampleProject, { ...good, frameCount: 3599 })).toHaveLength(1);
    expect(checkMetadata(sampleProject, { ...good, width: 1920 })).toHaveLength(1);
  });
});
