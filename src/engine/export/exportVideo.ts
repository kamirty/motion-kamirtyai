import type { Project } from '../../domain/types';
import { frameToSeconds } from '../../domain/timeline';
import { renderFrame } from '../renderer/renderFrame';
import type { ExportPlan } from './capabilities';

export interface ExportProgress {
  frame: number;
  totalFrames: number;
}

export class ExportCancelledError extends Error {
  constructor() {
    super('export cancelled');
  }
}

/**
 * Renders every frame with renderFrame and encodes it. Timestamps come from the frame index,
 * and awaiting `source.add` applies encoder backpressure so frames never pile up in memory.
 */
export async function exportVideo(
  project: Project,
  plan: ExportPlan,
  opts: { signal?: AbortSignal; onProgress?: (p: ExportProgress) => void; audio?: AudioBuffer | null } = {},
): Promise<Blob> {
  const mb = await import('mediabunny');
  const { width, height } = plan;
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('2D canvas context unavailable');

  const target = new mb.BufferTarget();
  const output = new mb.Output({
    format: plan.container === 'mp4' ? new mb.Mp4OutputFormat({ fastStart: 'in-memory' }) : new mb.WebMOutputFormat(),
    target,
  });
  const quality = width * height > 1280 * 720 ? mb.QUALITY_HIGH : mb.QUALITY_VERY_HIGH;
  const video = new mb.CanvasSource(canvas, { codec: plan.codec, quality, keyFrameInterval: 2 });
  output.addVideoTrack(video, { frameRate: project.fps });
  const audio = opts.audio && plan.audioCodec ? new mb.AudioBufferSource({ codec: plan.audioCodec, quality: mb.QUALITY_HIGH }) : null;
  if (audio) output.addAudioTrack(audio);
  await output.start();

  const frameDuration = 1 / project.fps;
  const size = { width, height };
  try {
    if (audio && opts.audio) {
      await audio.add(opts.audio);
      audio.close();
    }
    for (let frame = 0; frame < project.durationFrames; frame++) {
      if (opts.signal?.aborted) throw new ExportCancelledError();
      renderFrame(project, frame, ctx, size);
      await video.add(frameToSeconds(frame, project.fps), frameDuration);
      if (frame % 10 === 0 || frame === project.durationFrames - 1) {
        opts.onProgress?.({ frame: frame + 1, totalFrames: project.durationFrames });
        // Yield so the progress bar and cancel button stay responsive.
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    video.close();
    await output.finalize();
  } catch (err) {
    await output.cancel().catch(() => undefined);
    throw err;
  }
  if (!target.buffer) throw new Error('encoder produced no data');
  return new Blob([target.buffer], { type: plan.mimeType });
}
