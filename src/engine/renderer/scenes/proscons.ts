import { alpha } from '../../../design/presets';
import { easeOutBack, easeOutCubic, progress } from '../animation';
import { card, drawHeader, iconBadge, withAlpha, type SceneDrawArgs } from '../kit';
import { itemReveal, shownItems } from '../../timing';
import { prosCons } from '../../sceneModel';
import { drawIcon } from '../icons';
import { measure } from './common';
import { drawLines } from '../textLayout';

/** مزايا وعيوب: pros on the right with ✓, cons on the left with ✗; rows arrive in order. */
export function drawProsCons(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const top = drawHeader(a);
  const { pros, cons } = prosCons(scene);
  const n = shownItems(scene).length;
  const groups = [
    { list: pros, icon: 'check', color: theme.accent },
    { list: cons, icon: 'x', color: theme.foreground },
  ].filter((g) => g.list.length);
  if (!groups.length) return;
  const stacked = L.portrait && groups.length === 2;
  const gap = 28;
  const colW = stacked || groups.length === 1 ? L.W - L.M * 2 : (L.W - L.M * 2 - gap) / 2;
  const avail = L.H - top - L.M;
  const sectionH = stacked ? (avail - gap) / 2 : avail;
  groups.forEach((g, gi) => {
    const x = stacked || groups.length === 1 ? L.M : L.W - L.M - colW - gi * (colW + gap);
    const yTop = stacked ? top + gi * (sectionH + gap) : top;
    const ht = easeOutBack(progress(frame, 10 + gi * 6, 20));
    iconBadge(ctx, theme, g.icon, x + colW - 30, yTop + 24, 26 * ht, g.color);
    ctx.fillStyle = alpha(g.color, 0.5);
    ctx.fillRect(x, yTop + 22, (colW - 70) * easeOutCubic(progress(frame, 14 + gi * 6, 24)), 4);
    const rowsTop = yTop + 64;
    const rowGap = 12;
    const rowH = Math.min(L.portrait ? 110 : 96, (sectionH - 64 - rowGap * (g.list.length - 1)) / g.list.length);
    g.list.forEach((it, k) => {
      const t = progress(frame, itemReveal(scene, it.index, n), 18);
      if (t <= 0) return;
      const y = rowsTop + k * (rowH + rowGap);
      const e = easeOutCubic(t);
      withAlpha(ctx, e, () => {
        card(ctx, theme, x - (1 - e) * 30, y, colW, rowH, 14);
        drawIcon(ctx, g.icon === 'check' ? 'circle-check' : 'circle-x', x + colW - 34, y + rowH / 2, 34, g.color, 2.4);
        const f = measure(ctx, fs, it.text, { maxWidth: colW - 90, maxLines: 2, maxSize: L.portrait ? 32 : 28, minSize: 16, lineHeight: 1.4 });
        ctx.fillStyle = theme.foreground;
        ctx.textAlign = 'right';
        drawLines(ctx, fs, f, x + colW - 66 - (1 - e) * 30, y + rowH / 2 - f.height / 2);
      });
    });
  });
}
