import { ALL_FORMATS, BlobSource, Input } from 'mediabunny';
import type { Project } from '../../domain/types';

export interface VerifyReport {
  ok: boolean;
  durationSeconds: number;
  frameCount: number;
  width: number;
  height: number;
  codec: string | null;
  sizeBytes: number;
  problems: string[];
}

/** Half a frame of tolerance on duration; frame count must match exactly. */
export function checkMetadata(
  project: Project,
  meta: Omit<VerifyReport, 'ok' | 'problems'>,
): string[] {
  const problems: string[] = [];
  const expected = project.durationFrames / project.fps;
  if (Math.abs(meta.durationSeconds - expected) > 0.5 / project.fps) {
    problems.push(`المدة ${meta.durationSeconds.toFixed(3)} ث بدل ${expected} ث`);
  }
  if (meta.frameCount !== project.durationFrames) {
    problems.push(`عدد الإطارات ${meta.frameCount} بدل ${project.durationFrames}`);
  }
  if (meta.width !== project.size.width || meta.height !== project.size.height) {
    problems.push(`الأبعاد ${meta.width}×${meta.height} بدل ${project.size.width}×${project.size.height}`);
  }
  return problems;
}

/** Re-opens the exported file and reads its real metadata instead of trusting the encoder. */
export async function verifyExport(project: Project, blob: Blob): Promise<VerifyReport> {
  const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) {
      return { ok: false, durationSeconds: 0, frameCount: 0, width: 0, height: 0, codec: null, sizeBytes: blob.size, problems: ['لا يوجد مسار فيديو في الملف'] };
    }
    const stats = await track.computePacketStats();
    const meta = {
      durationSeconds: await input.computeDuration(),
      frameCount: stats.packetCount,
      width: track.displayWidth,
      height: track.displayHeight,
      codec: track.codec,
      sizeBytes: blob.size,
    };
    const problems = checkMetadata(project, meta);
    return { ok: problems.length === 0, ...meta, problems };
  } finally {
    input.dispose();
  }
}
