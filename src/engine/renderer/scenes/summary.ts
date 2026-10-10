import { iconById, suggestIcon } from '../../../design/icons';
import { alpha, mix, readableOn } from '../../../design/presets';
import { clamp, easeOutBack, progress } from '../animation';
import { drawIcon } from '../icons';
import { drawHeader, roundRect, withAlpha, type SceneDrawArgs } from '../kit';
import { drawLines, fitText, type FittedText } from '../textLayout';
import { itemReveal, shownItems } from '../../timing';

/** Distinct icon per item, matched from its words (falls back to the scene icon). */
export function itemIcons(items: string[], fallback: string): string[] {
  const used = new Set<string>();
  const spare = [fallback, 'star', 'circle-check', 'target', 'award', 'sparkles', 'zap', 'heart'].filter((id) => iconById(id));
  return items.map((it) => {
    let id = suggestIcon(it, '', used);
    if (!id) id = spare.find((s) => !used.has(s)) ?? fallback;
    used.add(id);
    return id;
  });
}

/**
 * بطاقات — icon tiles. Each fact gets its own matched icon in a large coloured medallion that
 * overlaps the top of a soft tile; tiles pop up one by one with a spring.
 */
export function drawSummary(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const top = drawHeader(a);
  const items = shownItems(scene);
  const n = items.length;
  if (!n) return;
  const icons = itemIcons(items, scene.icon);
  const cols = L.portrait ? (n <= 3 ? 1 : 2) : n <= 4 ? n : 3;
  const rows = Math.ceil(n / cols);
  const gapX = 26;
  const gapY = L.portrait ? 64 : 58;
  const avail = L.H - top - L.M * 0.7;
  const tw = (L.W - L.M * 2 - gapX * (cols - 1)) / cols;
  const medal = Math.min(L.portrait && cols === 1 ? 44 : 50, tw * 0.2);
  const th = Math.min((avail - gapY * (rows - 1) - medal) / rows, cols === 1 ? 230 : 300);
  const textTop = medal + 18;
  let fits: FittedText[] = [];
  for (let size = cols <= 2 ? 36 : 32; size >= 16; size -= 2) {
    fits = items.map((it) => fitText(ctx, fs, it, { maxWidth: tw - 36, maxLines: 4, maxSize: size, minSize: size, weight: 'bold', lineHeight: 1.4 }));
    if (fits.every((f) => f.height <= th - textTop - 18)) break;
  }
  const blockH = rows * th + (rows - 1) * gapY + medal;
  const y0 = top + medal + Math.max(0, (avail - blockH) / 2);
  items.forEach((_, i) => {
    const t = progress(frame, itemReveal(scene, i, n), 26);
    if (t <= 0) return;
    const col = i % cols;
    const row = Math.floor(i / cols);
    // Centre a short last row.
    const inRow = row === rows - 1 ? n - row * cols : cols;
    const rowW = inRow * tw + (inRow - 1) * gapX;
    const x = (L.W + rowW) / 2 - tw - col * (tw + gapX);
    const y = y0 + row * (th + gapY);
    const color = [theme.accent, theme.accent2, mix(theme.accent, theme.foreground, 0.35)][i % 3];
    const e = easeOutBack(t);
    withAlpha(ctx, clamp(t * 1.6), () => {
      ctx.save();
      ctx.translate(x + tw / 2, y + th);
      ctx.scale(1, 0.6 + 0.4 * e);
      ctx.translate(-(x + tw / 2), -(y + th));
      const g = ctx.createLinearGradient(0, y, 0, y + th);
      g.addColorStop(0, mix(theme.surface, color, 0.22));
      g.addColorStop(1, theme.surface);
      ctx.fillStyle = g;
      roundRect(ctx, x, y, tw, th, 26);
      ctx.fill();
      ctx.strokeStyle = alpha(color, 0.55);
      ctx.lineWidth = 2;
      roundRect(ctx, x + 1, y + 1, tw - 2, th - 2, 25);
      ctx.stroke();
      ctx.fillStyle = theme.foreground;
      ctx.textAlign = 'center';
      drawLines(ctx, fs, fits[i], x + tw / 2, y + textTop + Math.max(0, (th - textTop - 14 - fits[i].height) / 2));
      ctx.restore();
      // Medallion overlapping the top edge.
      const r = medal * easeOutBack(clamp((t - 0.15) * 1.5));
      if (r > 0) {
        ctx.fillStyle = theme.background;
        ctx.beginPath();
        ctx.arc(x + tw / 2, y, r + 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x + tw / 2, y, r, 0, Math.PI * 2);
        ctx.fill();
        drawIcon(ctx, icons[i], x + tw / 2, y, r * 1.05, readableOn(color), 2.2);
      }
    });
  });
}
