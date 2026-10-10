import { alpha, mix, readableOn } from '../../../design/presets';
import { localizeDigits } from '../../../design/digits';
import { clamp, easeOutBack, easeOutCubic, progress } from '../animation';
import { font } from '../context';
import { drawHeader, roundRect, withAlpha, type SceneDrawArgs } from '../kit';
import { drawLines, fitText, type FittedText } from '../textLayout';
import { itemReveal, shownItems } from '../../timing';

/**
 * خطوات — a rising staircase. Landscape/square: blocks climb from right to left (reading order),
 * each taller and more saturated than the last, rising from the floor at its cue with its number
 * on a medallion. Portrait: rows step diagonally down like a stair seen from the side.
 */
export function drawSteps(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs, digits } = a;
  const top = drawHeader(a);
  const items = shownItems(scene);
  const n = items.length;
  if (!n) return;
  if (L.portrait) return drawStairRows(a, top, items);

  const floor = L.H - L.M * 0.75;
  const gap = n > 4 ? 14 : 20;
  const bw = (L.W - L.M * 2 - gap * (n - 1)) / n;
  const medal = Math.min(34, bw * 0.2);
  const pad = 18;
  // One shared text size, as large as the narrowest/tallest text allows.
  let fits: FittedText[] = [];
  for (let size = L.square ? 34 : 32; size >= 16; size -= 2) {
    fits = items.map((it) => fitText(ctx, fs, it, { maxWidth: bw - pad * 2, maxLines: 5, maxSize: size, minSize: size, weight: 'bold', lineHeight: 1.4 }));
    if (fits.every((f) => f.lines.length <= 4)) break;
  }
  const textH = Math.max(...fits.map((f) => f.height));
  const hMax = floor - top - medal - 34;
  const hMin = Math.min(hMax, textH + medal + pad * 2 + 10);

  // Floor line.
  ctx.fillStyle = alpha(theme.foreground, 0.18);
  roundRect(ctx, L.M - 10, floor, L.W - L.M * 2 + 20, 4, 2);
  ctx.fill();

  items.forEach((_, i) => {
    const t = progress(frame, itemReveal(scene, i, n), 26);
    if (t <= 0) return;
    const k = n === 1 ? 1 : i / (n - 1);
    const h = hMin + (hMax - hMin) * k;
    const grow = easeOutCubic(t);
    const x = L.W - L.M - bw - i * (bw + gap);
    const y = floor - h * grow;
    const fill = mix(theme.surface, theme.accent, 0.25 + 0.75 * k);
    const ink = readableOn(fill);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 4, top - 80, bw + 8, floor - top + 80);
    ctx.clip();
    // Block with a lighter top face for depth.
    const g = ctx.createLinearGradient(0, y, 0, floor);
    g.addColorStop(0, fill);
    g.addColorStop(1, mix(fill, theme.background, 0.35));
    ctx.fillStyle = g;
    roundRect(ctx, x, y, bw, h + 8, 16);
    ctx.fill();
    ctx.fillStyle = alpha('#ffffff', 0.18);
    roundRect(ctx, x, y, bw, 8, 4);
    ctx.fill();
    // Text sits at the top of the block, under the medallion.
    withAlpha(ctx, clamp(t * 1.8), () => {
      ctx.fillStyle = ink;
      ctx.textAlign = 'center';
      drawLines(ctx, fs, fits[i], x + bw / 2, y + medal + pad);
    });
    ctx.restore();
    // Medallion with the step number, astride the top edge.
    const r = medal * easeOutBack(clamp((t - 0.2) * 1.6));
    if (r > 0) {
      ctx.fillStyle = theme.background;
      ctx.beginPath();
      ctx.arc(x + bw / 2, y, r + 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = theme.accent;
      ctx.beginPath();
      ctx.arc(x + bw / 2, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = readableOn(theme.accent);
      ctx.font = font(fs, 'bold', r * 1.05);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(localizeDigits(String(i + 1), digits), x + bw / 2, y + r * 0.08);
      ctx.textBaseline = 'alphabetic';
    }
  });
}

function drawStairRows(a: SceneDrawArgs, top: number, items: string[]): void {
  const { ctx, scene, theme, frame, layout: L, font: fs, digits } = a;
  const n = items.length;
  const avail = L.H - top - L.M;
  const gap = 16;
  const shift = Math.min(36, 160 / Math.max(1, n - 1));
  const badge = 34;
  const rowW = L.W - L.M * 2 - shift * (n - 1);
  let fits: FittedText[] = [];
  let rowH = 0;
  for (let size = 38; size >= 18; size -= 2) {
    fits = items.map((it) => fitText(ctx, fs, it, { maxWidth: rowW - badge * 2 - 60, maxLines: 3, maxSize: size, minSize: size, weight: 'bold', lineHeight: 1.4 }));
    rowH = Math.max(badge * 2 + 24, ...fits.map((f) => f.height + 44));
    if (rowH * n + gap * (n - 1) <= avail) break;
  }
  const y0 = top + Math.max(0, (avail - (rowH * n + gap * (n - 1))) / 2);
  items.forEach((_, i) => {
    const t = progress(frame, itemReveal(scene, i, n), 24);
    if (t <= 0) return;
    const e = easeOutCubic(t);
    const k = n === 1 ? 1 : i / (n - 1);
    const fill = mix(theme.surface, theme.accent, 0.2 + 0.8 * k);
    const x = L.W - L.M - rowW - i * shift;
    const y = y0 + i * (rowH + gap);
    withAlpha(ctx, e, () => {
      ctx.fillStyle = fill;
      roundRect(ctx, x + (1 - e) * 60, y, rowW, rowH, 18);
      ctx.fill();
      const cx = x + rowW - badge - 16 + (1 - e) * 60;
      ctx.fillStyle = theme.background;
      ctx.beginPath();
      ctx.arc(cx, y + rowH / 2, badge, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = theme.accent;
      ctx.font = font(fs, 'bold', badge * 1.1);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(localizeDigits(String(i + 1), digits), cx, y + rowH / 2 + 3);
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = readableOn(fill);
      ctx.textAlign = 'right';
      drawLines(ctx, fs, fits[i], cx - badge - 22, y + rowH / 2 - fits[i].height / 2);
    });
  });
}
