import { alpha } from '../../../design/presets';
import { easeOutCubic, progress } from '../animation';
import { font } from '../context';
import { drawHeader, withAlpha, type SceneDrawArgs } from '../kit';
import { PICTOGRAM, shownItems } from '../../timing';
import { pictogramRatio } from '../../sceneModel';
import { drawIcon } from '../icons';
import { measure } from './common';
import { drawLines } from '../textLayout';

/** رسم بالأيقونات: "7 من 10" as a row/grid of units filling one by one. */
export function drawPictogram(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const top = drawHeader(a);
  const [ratioText = '', ...rest] = shownItems(scene);
  const desc = rest.join(' ');
  const ratio = pictogramRatio(ratioText);
  const avail = L.H - top - L.M;
  const side = !L.portrait;
  const gridW = side ? (L.W - L.M * 2) * 0.58 : L.W - L.M * 2;
  const textW = side ? L.W - L.M * 2 - gridW - 40 : L.W - L.M * 2;
  // Ratio headline.
  const bigF = measure(ctx, fs, ratioText, { maxWidth: textW, maxLines: 1, maxSize: 96, minSize: 36, weight: 'bold' });
  const descF = desc ? measure(ctx, fs, desc, { maxWidth: textW, maxLines: side ? 5 : 3, maxSize: 30, minSize: 18, lineHeight: 1.55 }) : null;
  const textH = bigF.height + (descF ? descF.height + 16 : 0);
  const gridH = side ? avail : avail - textH - 30;
  if (ratio) {
    const { filled, total } = ratio;
    const cols = total <= 10 ? Math.min(total, 5) : 10;
    const rows = Math.ceil(total / cols);
    const cell = Math.min(gridW / cols, gridH / rows);
    const size = cell * (total > 20 ? 0.7 : 0.78);
    const gx = (side ? L.M : L.M + (gridW - cell * cols) / 2) + (side ? 0 : 0);
    const gy = (side ? top + (avail - cell * rows) / 2 : top + textH + 30 + (gridH - cell * rows) / 2);
    const gridT = easeOutCubic(progress(frame, PICTOGRAM.grid, 20));
    const fillT = progress(frame, PICTOGRAM.fillStart, PICTOGRAM.fillLength);
    const lit = Math.floor(fillT * filled + 1e-6);
    withAlpha(ctx, gridT, () => {
      for (let k = 0; k < total; k++) {
        const col = k % cols;
        const row = Math.floor(k / cols);
        // Reading order: right-to-left, top-to-bottom.
        const x = gx + (cols - 1 - col) * cell + cell / 2;
        const y = gy + row * cell + cell / 2;
        const on = k < lit;
        const pop = on && k === lit - 1 ? 1.15 : 1;
        if (total > 20) {
          ctx.fillStyle = on ? theme.accent : alpha(theme.foreground, 0.14);
          ctx.beginPath();
          ctx.arc(x, y, (size / 2) * pop, 0, Math.PI * 2);
          ctx.fill();
        } else {
          drawIcon(ctx, scene.icon || 'user', x, y, size * pop, on ? theme.accent : alpha(theme.foreground, 0.22), on ? 2.6 : 2);
        }
      }
    });
  }
  const tx = side ? L.W - L.M : L.W / 2;
  const ty = side ? top + (avail - textH) / 2 : top;
  withAlpha(ctx, easeOutCubic(progress(frame, PICTOGRAM.grid, 20)), () => {
    ctx.font = font(fs, 'bold', bigF.fontSize);
    ctx.fillStyle = theme.accent === theme.background ? theme.foreground : theme.accent;
    ctx.textAlign = side ? 'right' : 'center';
    drawLines(ctx, fs, bigF, tx, ty);
  });
  if (descF) {
    withAlpha(ctx, easeOutCubic(progress(frame, PICTOGRAM.description, 24)), () => {
      ctx.fillStyle = theme.foreground;
      ctx.textAlign = side ? 'right' : 'center';
      drawLines(ctx, fs, descF, tx, ty + bigF.height + 16);
    });
  }
}
