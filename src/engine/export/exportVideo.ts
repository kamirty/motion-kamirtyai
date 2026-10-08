import { BufferTarget, CanvasSource, Mp4OutputFormat, Output, QUALITY_HIGH, WebMOutputFormat } from 'mediabunny';
import { frameToSeconds } from '../../domain/timeline';
import type { Project } from '../../domain/types';
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
  opts: { signal?: AbortSignal; onProgress?: (p: ExportProgress) => void } = {},
): Promise<Blob> {
  const { width, height } = project.size;
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('2D canvas context unavailable');

  const target = new BufferTarget();
  const output = new Output({
    format: plan.container === 'mp4' ? new Mp4OutputFormat({ fastStart: 'in-memory' }) : new WebMOutputFormat(),
    target,
  });
  const source = new CanvasSource(canvas, { codec: plan.codec, quality: QUALITY_HIGH, keyFrameInterval: 2 });
  output.addVideoTrack(source, { frameRate: project.fps });
  await output.start();

  const frameDuration = 1 / project.fps;
  try {
    for (let frame = 0; frame < project.durationFrames; frame++) {
      if (opts.signal?.aborted) throw new ExportCancelledError();
      renderFrame(project, frame, ctx);
      await source.add(frameToSeconds(frame, project.fps), frameDuration);
      if (frame % 10 === 0 || frame === project.durationFrames - 1) {
        opts.onProgress?.({ frame: frame + 1, totalFrames: project.durationFrames });
      }
    }
    source.close();
    await output.finalize();
  } catch (err) {
    await output.cancel().catch(() => undefined);
    throw err;
  }
  if (!target.buffer) throw new Error('encoder produced no data');
  return new Blob([target.buffer], { type: plan.mimeType });
}
