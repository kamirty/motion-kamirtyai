import type { Project } from '../../domain/types';

export interface VerifyReport {
  ok: boolean;
  durationSeconds: number;
  frameCount: number;
  width: number;
  height: number;
  codec: string | null;
  audioCodec: string | null;
  sizeBytes: number;
  problems: string[];
}

type Meta = Omit<VerifyReport, 'ok' | 'problems'>;

/** Duration within one frame (test plan tolerance); frame count and size must match exactly. */
export function checkMetadata(project: Project, meta: Meta, expected: { width: number; height: number } = project.size): string[] {
  const problems: string[] = [];
  const seconds = project.durationFrames / project.fps;
  if (Math.abs(meta.durationSeconds - seconds) > 1 / project.fps) {
    problems.push(`المدة ${meta.durationSeconds.toFixed(3)} ث بدل ${seconds} ث`);
  }
  if (meta.frameCount !== project.durationFrames) {
    problems.push(`عدد الإطارات ${meta.frameCount} بدل ${project.durationFrames}`);
  }
  if (meta.width !== expected.width || meta.height !== expected.height) {
    problems.push(`الأبعاد ${meta.width}×${meta.height} بدل ${expected.width}×${expected.height}`);
  }
  return problems;
}

/** Re-opens the exported file and reads its real metadata instead of trusting the encoder. */
export async function verifyExport(project: Project, blob: Blob, expected: { width: number; height: number }): Promise<VerifyReport> {
  const { ALL_FORMATS, BlobSource, Input } = await import('mediabunny');
  const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryVideoTrack();
    const audioTrack = await input.getPrimaryAudioTrack();
    if (!track) {
      return { ok: false, durationSeconds: 0, frameCount: 0, width: 0, height: 0, codec: null, audioCodec: null, sizeBytes: blob.size, problems: ['لا يوجد مسار فيديو في الملف'] };
    }
    const stats = await track.computePacketStats();
    const meta: Meta = {
      durationSeconds: await track.computeDuration(),
      frameCount: stats.packetCount,
      width: track.displayWidth,
      height: track.displayHeight,
      codec: track.codec,
      audioCodec: audioTrack?.codec ?? null,
      sizeBytes: blob.size,
    };
    const problems = checkMetadata(project, meta, expected);
    return { ok: problems.length === 0, ...meta, problems };
  } finally {
    input.dispose();
  }
}
