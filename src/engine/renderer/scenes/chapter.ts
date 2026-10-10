import { alpha, readableOn } from '../../../design/presets';
import { easeInOutCubic, easeOutBack, easeOutCubic, progress } from '../animation';
import { iconBadge, withAlpha, type SceneDrawArgs } from '../kit';
import { CHAPTER, shownItems } from '../../timing';
import { measure } from './common';
import { drawLines } from '../textLayout';

/** فاصل قسم: a bold band sweeps in from the right with the section title. */
export function drawChapter(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const sweep = easeInOutCubic(progress(frame, CHAPTER.mark, 24));
  const bandH = L.portrait ? L.H * 0.42 : L.H * 0.5;
  const bandY = (L.H - bandH) / 2;
  // Diagonal accent band growing from the right edge.
  ctx.save();
  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  const w = L.W * 1.2 * sweep;
  ctx.moveTo(L.W, bandY - 40);
  ctx.lineTo(L.W - w, bandY);
  ctx.lineTo(L.W - w + 60, bandY + bandH);
  ctx.lineTo(L.W, bandY + bandH + 40);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = alpha(theme.background, 0.12);
  for (let k = 0; k < 6; k++) ctx.fillRect(L.W - w + k * 120 + ((frame * 2) % 120), bandY, 30, bandH);
  ctx.restore();
  const on = readableOn(theme.accent);
  const bt = easeOutBack(progress(frame, CHAPTER.mark + 8, 22));
  const cx = L.W / 2;
  if (bt > 0) iconBadge(ctx, theme, scene.icon || 'flag', cx, bandY + 10, 46 * bt, theme.foreground);
  const tf = measure(ctx, fs, scene.title, { maxWidth: L.W - L.M * 2, maxLines: L.portrait ? 4 : 2, maxSize: L.portrait ? 64 : 78, minSize: 32, weight: 'bold', lineHeight: 1.3 });
  const sub = shownItems(scene)[0];
  const sf = sub ? measure(ctx, fs, sub, { maxWidth: L.W - L.M * 3, maxLines: 2, maxSize: 30, minSize: 18 }) : null;
  const total = tf.height + (sf ? sf.height + 14 : 0);
  const ty = bandY + bandH / 2 - total / 2 + 20;
  const tt = easeOutCubic(progress(frame, CHAPTER.title, 22));
  withAlpha(ctx, tt, () => {
    ctx.fillStyle = on;
    ctx.textAlign = 'center';
    drawLines(ctx, fs, tf, cx + (1 - tt) * -60, ty);
  });
  if (sf) {
    withAlpha(ctx, easeOutCubic(progress(frame, CHAPTER.subtitle, 22)) * 0.85, () => {
      ctx.fillStyle = on;
      ctx.textAlign = 'center';
      drawLines(ctx, fs, sf, cx, ty + tf.height + 14);
    });
  }
}
