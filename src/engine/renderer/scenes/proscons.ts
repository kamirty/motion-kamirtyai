import { alpha, mix, readableOn, textAccent } from '../../../design/presets';
import { easeOutBack, easeOutCubic, progress } from '../animation';
import { font } from '../context';
import { drawHeader, roundRect, withAlpha, type SceneDrawArgs } from '../kit';
import { itemReveal, shownItems } from '../../timing';
import { prosCons } from '../../sceneModel';
import { drawIcon } from '../icons';
import { measure } from './common';
import { drawLines } from '../textLayout';

/**
 * مزايا وعيوب — two tinted panels: pros (accent, thumbs-up) on the right and cons (muted,
 * thumbs-down) on the left, each with a labelled header; rows tick in at their cues.
 */
export function drawProsCons(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const top = drawHeader(a);
  const { pros, cons } = prosCons(scene);
  const n = shownItems(scene).length;
  const consColor = mix(theme.foreground, theme.accent2, 0.35);
  const groups = [
    { list: pros, head: 'المزايا', badge: 'thumbs-up', mark: 'check', color: theme.accent },
    { list: cons, head: 'العيوب', badge: 'thumbs-down', mark: 'x', color: consColor },
  ].filter((g) => g.list.length);
  if (!groups.length) return;
  const stacked = L.portrait && groups.length === 2;
  const gap = 24;
  const colW = stacked || groups.length === 1 ? L.W - L.M * 1.4 : (L.W - L.M * 1.4 - gap) / 2;
  const avail = L.H - top - L.M * 0.6;
  const sectionH = stacked ? (avail - gap) / 2 : avail;
  const headH = 74;
  groups.forEach((g, gi) => {
    const x = stacked || groups.length === 1 ? L.M * 0.7 : L.W - L.M * 0.7 - colW - gi * (colW + gap);
    const yTop = (stacked ? top + gi * (sectionH + gap) : top) - 8;
    const pt = easeOutCubic(progress(frame, 8 + gi * 8, 24));
    withAlpha(ctx, pt, () => {
      ctx.fillStyle = mix(theme.surface, g.color, 0.12);
      roundRect(ctx, x, yTop + (1 - pt) * 30, colW, sectionH, 26);
      ctx.fill();
      // Header band.
      ctx.fillStyle = g.color;
      roundRect(ctx, x, yTop + (1 - pt) * 30, colW, headH, 26);
      ctx.fill();
      ctx.fillRect(x, yTop + (1 - pt) * 30 + headH - 26, colW, 26);
      const ink = readableOn(g.color);
      const r = 24 * easeOutBack(progress(frame, 12 + gi * 8, 20));
      const cy = yTop + (1 - pt) * 30 + headH / 2;
      ctx.fillStyle = alpha(ink, 0.15);
      ctx.beginPath();
      ctx.arc(x + colW - 26 - 24, cy, r, 0, Math.PI * 2);
      ctx.fill();
      drawIcon(ctx, g.badge, x + colW - 26 - 24, cy, r * 1.15, ink, 2.4);
      ctx.fillStyle = ink;
      ctx.font = font(fs, 'bold', 34);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(g.head, x + colW - 26 - 48 - 18, cy + 2);
      ctx.textBaseline = 'alphabetic';
    });
    const rowsTop = yTop + headH + 18;
    const rowGap = 8;
    const rowH = Math.min(L.portrait ? 120 : 104, (sectionH - headH - 30 - rowGap * (g.list.length - 1)) / g.list.length);
    g.list.forEach((it, k) => {
      const t = progress(frame, itemReveal(scene, it.index, n), 18);
      if (t <= 0) return;
      const y = rowsTop + k * (rowH + rowGap);
      const e = easeOutCubic(t);
      withAlpha(ctx, e, () => {
        const mx = x + colW - 46;
        const s = easeOutBack(t);
        ctx.fillStyle = alpha(g.color, 0.2);
        ctx.beginPath();
        ctx.arc(mx, y + rowH / 2, 22 * s, 0, Math.PI * 2);
        ctx.fill();
        drawIcon(ctx, g.mark, mx, y + rowH / 2, 26 * s, textAccent(theme, g.color), 3);
        const f = measure(ctx, fs, it.text, { maxWidth: colW - 110, maxLines: 2, maxSize: L.portrait ? 34 : 32, minSize: 16, weight: 'bold', lineHeight: 1.35 });
        ctx.fillStyle = theme.foreground;
        ctx.textAlign = 'right';
        drawLines(ctx, fs, f, mx - 40 - (1 - e) * 30, y + rowH / 2 - f.height / 2);
        if (k < g.list.length - 1) {
          ctx.fillStyle = alpha(theme.foreground, 0.08);
          ctx.fillRect(x + 30, y + rowH + rowGap / 2, colW - 60, 1.5);
        }
      });
    });
  });
}
