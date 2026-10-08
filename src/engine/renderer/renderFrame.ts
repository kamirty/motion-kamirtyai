import { sceneAt } from '../../domain/timeline';
import type { Project } from '../../domain/types';
import { sceneOpacity } from './animation';
import type { Ctx2D } from './context';
import { DESIGN_H, DESIGN_W, drawScene } from './scenes';

/**
 * Draws one frame. Pure function of (project, frameIndex): no clocks, randomness or DOM reads,
 * so preview and export produce identical pixels for the same frame.
 */
export function renderFrame(project: Project, frameIndex: number, ctx: Ctx2D): void {
  const { width, height } = project.size;
  const { theme } = project;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, width, height);

  // Scale the 1280×720 design space to the output, letterboxing if the aspect differs.
  const scale = Math.min(width / DESIGN_W, height / DESIGN_H);
  ctx.setTransform(scale, 0, 0, scale, (width - DESIGN_W * scale) / 2, (height - DESIGN_H * scale) / 2);
  ctx.direction = 'rtl';
  ctx.textBaseline = 'alphabetic';

  const scene = sceneAt(project, frameIndex);
  if (scene) {
    const local = frameIndex - scene.startFrame;
    ctx.save();
    ctx.globalAlpha = sceneOpacity(local, scene.durationFrames);
    drawScene({ ctx, scene, theme, frame: local });
    ctx.restore();
  }

  // Overall progress bar along the bottom edge.
  const p = Math.min(1, (frameIndex + 1) / project.durationFrames);
  ctx.fillStyle = theme.accent;
  ctx.globalAlpha = 0.8;
  ctx.fillRect(DESIGN_W * (1 - p), DESIGN_H - 6, DESIGN_W * p, 6);
  ctx.globalAlpha = 1;
}
