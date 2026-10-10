import { alpha } from '../../../design/presets';
import { easeOutBack, easeOutCubic, progress } from '../animation';
import { font } from '../context';
import { iconBadge, roundRect, withAlpha, type SceneDrawArgs } from '../kit';
import { DEFINITION, itemReveal, shownItems } from '../../timing';
import { measure } from './common';
import { drawLines } from '../textLayout';

/** تعريف: dictionary-style term, definition paragraph and example chips. */
export function drawDefinition(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const items = shownItems(scene);
  const n = items.length;
  const [body, ...examples] = items;
  const w = L.W - L.M * 2;
  const right = L.W - L.M;
  const r = L.portrait ? 50 : 44;
  const termF = measure(ctx, fs, scene.title, { maxWidth: w - r * 2 - 30, maxLines: 2, maxSize: L.portrait ? 66 : 72, minSize: 30, weight: 'bold', lineHeight: 1.3 });
  const bodyF = body ? measure(ctx, fs, body, { maxWidth: w, maxLines: L.portrait ? 8 : 5, maxSize: L.portrait ? 36 : 34, minSize: 18, lineHeight: 1.65 }) : null;
  const chipH = 52;
  const blockH = Math.max(termF.height, r * 2) + 40 + (bodyF ? bodyF.height + 36 : 0) + (examples.length ? chipH * (L.portrait ? Math.ceil(examples.length / 2) : 1) + 20 : 0);
  let y = Math.max(L.M, (L.H - blockH) / 2);
  const tt = progress(frame, DEFINITION.term, 24);
  iconBadge(ctx, theme, scene.icon || 'book-open', right - r, y + Math.max(termF.height, r * 2) / 2, r * easeOutBack(tt));
  withAlpha(ctx, easeOutCubic(tt), () => {
    ctx.fillStyle = theme.foreground;
    ctx.textAlign = 'right';
    drawLines(ctx, fs, termF, right - r * 2 - 24 + (1 - easeOutCubic(tt)) * -30, y + Math.max(0, (r * 2 - termF.height) / 2));
  });
  y += Math.max(termF.height, r * 2) + 16;
  const lw = w * easeOutCubic(progress(frame, DEFINITION.term + 10, 30));
  ctx.fillStyle = theme.accent;
  ctx.fillRect(right - lw, y, lw, 6);
  y += 30;
  if (bodyF) {
    const bt = easeOutCubic(progress(frame, itemReveal(scene, 0, n), 26));
    withAlpha(ctx, bt, () => {
      ctx.fillStyle = theme.foreground;
      ctx.textAlign = 'right';
      drawLines(ctx, fs, bodyF, right, y + (1 - bt) * 16);
    });
    y += bodyF.height + 36;
  }
  // Example chips flowing right-to-left, wrapping.
  let x = right;
  examples.forEach((ex, k) => {
    const t = easeOutBack(progress(frame, itemReveal(scene, k + 1, n), 20));
    if (t <= 0) return;
    ctx.font = font(fs, 'bold', 26);
    const tw = Math.min(ctx.measureText(ex).width, w - 60);
    const cw = tw + 56;
    if (x - cw < L.M) {
      x = right;
      y += chipH + 12;
    }
    withAlpha(ctx, Math.min(1, t), () => {
      ctx.fillStyle = alpha(theme.accent, 0.18);
      roundRect(ctx, x - cw, y, cw, chipH, chipH / 2);
      ctx.fill();
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = theme.foreground;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ex, x - cw / 2, y + chipH / 2 + 1, tw);
      ctx.textBaseline = 'alphabetic';
    });
    x -= cw + 12;
  });
}
