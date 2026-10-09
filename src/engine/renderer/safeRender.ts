import type { Project } from '../../domain/types';
import type { Ctx2D } from './context';
import { renderFrame } from './renderFrame';

/**
 * Preview-only wrapper: a bug in one scene drawer shows a notice on that frame instead of
 * breaking the editor. Export calls renderFrame directly so failures stop the export loudly.
 */
export function renderFrameSafe(project: Project, frame: number, ctx: Ctx2D, outSize = project.size): boolean {
  try {
    renderFrame(project, frame, ctx, outSize);
    return true;
  } catch (err) {
    console.error('renderFrame failed at frame', frame, err);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, outSize.width, outSize.height);
    ctx.fillStyle = '#ffeb3b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';
    ctx.font = `700 ${Math.round(outSize.width / 32)}px Cairo, sans-serif`;
    ctx.fillText('تعذّر رسم هذا المشهد — جرّب تغيير نوعه أو نصوصه', outSize.width / 2, outSize.height / 2);
    return false;
  }
}
