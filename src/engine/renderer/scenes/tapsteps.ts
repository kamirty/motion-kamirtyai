import { alpha, mix, textAccent } from '../../../design/presets';
import { clamp, easeInOutCubic, easeOutBack, progress } from '../animation';
import { drawIcon } from '../icons';
import { appear, card, drawHeader, roundRect, withAlpha, type SceneDrawArgs } from '../kit';
import { drawLines, fitText } from '../textLayout';
import { shownItems } from '../../sceneModel';
import { itemReveal } from '../../timing';
import { palette, parts } from './extra2';
import { gridBoxes, lastRevealed, numberDisc } from './extra3';

/**
 * خطوات بالنقر — the steps wait as cards; a pointer glides to each in turn and taps it: a
 * ripple, a pulsing glow on the active card, its explanation sliding out of it, and progress
 * dots along the bottom. (Motion idea taken from a tutorial video; drawn in the tool's own style.)
 */
export function drawTapSteps(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const top = drawHeader(a);
  const items = shownItems(scene);
  const n = items.length;
  if (!n) return;
  const colors = palette(theme);
  const dotsH = n > 1 ? 50 : 0;
  const boxes = gridBoxes({ ...L, H: L.H - dotsH }, top, n, 240, 22);
  const reveal = (i: number) => itemReveal(scene, i, n);
  const k = lastRevealed(a, n);
  const centre = (i: number): [number, number] => [boxes[i].x + boxes[i].w / 2, boxes[i].y + boxes[i].h * 0.34];
  // Where the pointer taps: the card's lower-left corner, so it never hides the words.
  const tapAt = (i: number): [number, number] => [boxes[i].x + Math.min(46, boxes[i].w * 0.18), boxes[i].y + boxes[i].h - Math.min(34, boxes[i].h * 0.22)];

  // Cards: waiting (dim), active (glowing) or done (check mark).
  items.forEach((it, i) => {
    const b = boxes[i];
    const color = colors[i % colors.length];
    const tapped = progress(frame, reveal(i), 18);
    const active = i === k;
    const show = appear(frame, 4 + i * 4, 18);
    if (show <= 0) return;
    const { head, body } = parts(it);
    withAlpha(ctx, show * (tapped > 0 ? 1 : 0.5), () => {
      if (active) withAlpha(ctx, 0.45 + 0.25 * Math.sin(frame / 7), () => {
        ctx.fillStyle = color;
        roundRect(ctx, b.x - 8, b.y - 8, b.w + 16, b.h + 16, 28);
        ctx.fill();
      });
      card(ctx, theme, b.x, b.y, b.w, b.h, 22, tapped > 0 ? mix(theme.surface, color, active ? 0.2 : 0.1) : theme.surface);
      ctx.strokeStyle = tapped > 0 ? color : alpha(theme.foreground, 0.2);
      ctx.lineWidth = active ? 4 : 2;
      roundRect(ctx, b.x, b.y, b.w, b.h, 22);
      ctx.stroke();
      const [cx] = centre(i);
      const pop = tapped > 0 && tapped < 1 ? 1 + 0.25 * Math.sin(tapped * Math.PI) : 1;
      numberDisc(a, i + 1, b.x + b.w - 30, b.y + 30, 17 * pop, tapped > 0 ? color : alpha(theme.foreground, 0.35));
      if (tapped > 0 && !active) drawIcon(ctx, 'circle-check', b.x + 28, b.y + 28, 26, color, 2.4);
      const hf = fitText(ctx, fs, head, { maxWidth: b.w - 40, maxLines: 2, maxSize: 28, minSize: 14, weight: 'bold', lineHeight: 1.3 });
      ctx.fillStyle = tapped > 0 ? textAccent(theme, color) : theme.foreground;
      ctx.textAlign = 'center';
      const headTop = body ? b.y + Math.max(52, b.h * 0.42 - hf.height / 2) : b.y + b.h / 2 - hf.height / 2 + 10;
      const headBottom = drawLines(ctx, fs, hf, cx, headTop);
      // The explanation slides out of the card once it is tapped.
      if (body) {
        const s = easeOutBack(progress(frame, reveal(i) + 6, 20));
        if (s > 0) {
          const bf = fitText(ctx, fs, body, { maxWidth: b.w - 44, maxLines: 3, maxSize: 20, minSize: 12, weight: 'regular', lineHeight: 1.4 });
          const sh = Math.min(b.y + b.h - headBottom - 14, bf.height + 18);
          if (sh > 12) withAlpha(ctx, clamp(s), () => {
            ctx.save();
            ctx.beginPath();
            ctx.rect(b.x, headBottom + 4, b.w, b.y + b.h - headBottom);
            ctx.clip();
            const y = headBottom + 10 + (1 - s) * 40;
            ctx.fillStyle = alpha(color, 0.16);
            roundRect(ctx, b.x + 14, y, b.w - 28, sh, 12);
            ctx.fill();
            ctx.fillStyle = alpha(theme.foreground, 0.85);
            drawLines(ctx, fs, bf, cx, y + 9);
            ctx.restore();
          });
        }
      }
    });
  });

  // Pointer: glides to the next card just before it is revealed, taps, and fades after the last.
  let px = L.W + 60;
  let py = L.H * 0.9;
  for (let i = 0; i < n; i++) {
    const r = reveal(i);
    const [tx, ty] = tapAt(i);
    const from = i ? tapAt(i - 1) : ([L.W * 0.86, L.H + 40] as [number, number]);
    if (frame < r) {
      const travel = Math.min(22, Math.max(10, r - (i ? reveal(i - 1) : 0) - 8));
      const t = easeInOutCubic(progress(frame, r - travel, travel));
      px = from[0] + (tx - from[0]) * t;
      py = from[1] + (ty - from[1]) * t;
      break;
    }
    [px, py] = [tx, ty];
  }
  const gone = progress(frame, reveal(n - 1) + 36, 16);
  if (gone < 1) {
    for (let w = 0; w < 2; w++) {
      const rp = k >= 0 ? progress(frame, reveal(k) + w * 7, 24) : 0;
      if (rp > 0 && rp < 1) withAlpha(ctx, (1 - rp) * 0.8, () => {
        ctx.strokeStyle = theme.accent;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(px, py, 16 + rp * 44, 0, Math.PI * 2);
        ctx.stroke();
      });
    }
    const press = k >= 0 ? progress(frame, reveal(k), 10) : 0;
    const s = press > 0 && press < 1 ? 1 - 0.25 * Math.sin(press * Math.PI) : 1;
    withAlpha(ctx, (1 - gone) * appear(frame, 6, 14), () => {
      ctx.fillStyle = alpha('#000000', 0.25);
      ctx.beginPath();
      ctx.arc(px + 3, py + 5, 18 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px, py, 18 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 3;
      ctx.stroke();
    });
  }

  // Progress dots: one per step, the first on the right.
  if (n > 1) {
    const y = L.H - L.M * 0.5 - dotsH / 2;
    const gap = Math.min(56, (L.W - L.M * 2) / (n - 1));
    const x0 = L.W / 2 + (gap * (n - 1)) / 2;
    withAlpha(ctx, appear(frame, 6, 18), () => {
      ctx.strokeStyle = alpha(theme.foreground, 0.25);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x0 - gap * (n - 1), y);
      ctx.stroke();
      if (k > 0) {
        ctx.strokeStyle = theme.accent;
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.lineTo(x0 - gap * k, y);
        ctx.stroke();
      }
      for (let i = 0; i < n; i++) {
        const x = x0 - i * gap;
        const on = i <= k;
        ctx.fillStyle = on ? theme.accent : theme.background;
        ctx.strokeStyle = on ? theme.accent : alpha(theme.foreground, 0.4);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, i === k ? 10 + 2 * Math.sin(frame / 8) : 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    });
  }
}
