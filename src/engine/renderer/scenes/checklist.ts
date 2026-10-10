import { localizeDigits } from '../../../design/digits';
import { alpha } from '../../../design/presets';
import { easeOutCubic, progress } from '../animation';
import { font } from '../context';
import { card, drawHeader, roundRect, withAlpha, type SceneDrawArgs } from '../kit';
import { itemReveal, shownItems } from '../../timing';
import { measure } from './common';
import { drawLines } from '../textLayout';

/** قائمة تحقق: rows slide in one by one, then their box ticks itself. */
export function drawChecklist(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs, digits } = a;
  const top = drawHeader(a);
  const items = shownItems(scene);
  const n = items.length;
  if (!n) return;
  const cols = !L.portrait && n >= 5 ? 2 : 1;
  const rows = Math.ceil(n / cols);
  const gap = 16;
  const avail = L.H - top - L.M - 40;
  const colW = (L.W - L.M * 2 - gap * (cols - 1)) / cols;
  const rowH = Math.min(L.portrait ? 150 : 110, (avail - gap * (rows - 1)) / rows);
  const box = Math.min(46, rowH * 0.5);
  const y0 = top + Math.max(0, (avail - (rowH * rows + gap * (rows - 1))) / 2);
  let checked = 0;
  items.forEach((it, i) => {
    const reveal = itemReveal(scene, i, n);
    const t = easeOutCubic(progress(frame, reveal, 18));
    if (t <= 0) return;
    const tick = progress(frame, reveal + 10, 12);
    if (tick >= 1) checked++;
    const col = Math.floor(i / rows);
    const row = i % rows;
    const x = L.W - L.M - colW - col * (colW + gap);
    const y = y0 + row * (rowH + gap);
    withAlpha(ctx, t, () => {
      ctx.save();
      ctx.translate(-(1 - t) * 40, 0);
      card(ctx, theme, x, y, colW, rowH, 12, tick >= 1 ? alpha(theme.accent, 0.12) : theme.surface);
      const bx = x + colW - 24 - box;
      const by = y + rowH / 2 - box / 2;
      ctx.lineWidth = 4;
      ctx.strokeStyle = theme.accent;
      roundRect(ctx, bx, by, box, box, 8);
      if (tick > 0) {
        ctx.save();
        ctx.fillStyle = theme.accent;
        ctx.globalAlpha *= Math.min(1, tick * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.stroke();
      if (tick > 0) {
        // Check mark drawn along its path.
        const p1 = [bx + box * 0.22, by + box * 0.52];
        const p2 = [bx + box * 0.43, by + box * 0.72];
        const p3 = [bx + box * 0.8, by + box * 0.3];
        ctx.strokeStyle = theme.background;
        ctx.lineWidth = Math.max(4, box * 0.12);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(p1[0], p1[1]);
        const a1 = Math.min(1, tick / 0.4);
        ctx.lineTo(p1[0] + (p2[0] - p1[0]) * a1, p1[1] + (p2[1] - p1[1]) * a1);
        if (tick > 0.4) {
          const a2 = (tick - 0.4) / 0.6;
          ctx.lineTo(p2[0] + (p3[0] - p2[0]) * a2, p2[1] + (p3[1] - p2[1]) * a2);
        }
        ctx.stroke();
      }
      const f = measure(ctx, fs, it, { maxWidth: colW - box - 70, maxLines: 2, maxSize: L.portrait ? 34 : cols === 2 ? 26 : 30, minSize: 16, lineHeight: 1.4 });
      ctx.fillStyle = theme.foreground;
      ctx.textAlign = 'right';
      drawLines(ctx, fs, f, bx - 20, y + rowH / 2 - f.height / 2);
      ctx.restore();
    });
  });
  // Progress counter.
  const label = localizeDigits(`${checked}/${n}`, digits);
  ctx.font = font(fs, 'bold', 26);
  ctx.fillStyle = alpha(theme.foreground, 0.7);
  ctx.textAlign = 'left';
  ctx.fillText(label, L.M, L.H - L.M * 0.5);
}
