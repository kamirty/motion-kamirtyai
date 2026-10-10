import { mix, readableOn } from '../../../design/presets';
import { easeOutCubic, progress } from '../animation';
import { drawHeader, withAlpha, type SceneDrawArgs } from '../kit';
import { itemReveal, shownItems } from '../../timing';
import { measure } from './common';
import { drawLines } from '../textLayout';

/** هرم: trapezoid layers built from the base up; first item is the top. */
export function drawPyramid(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const top = drawHeader(a);
  const items = shownItems(scene);
  const n = items.length;
  if (!n) return;
  const avail = L.H - top - L.M;
  const gap = 8;
  const layerH = Math.min(L.portrait ? 150 : 100, (avail - gap * (n - 1)) / n);
  const totalH = layerH * n + gap * (n - 1);
  const baseW = L.W - L.M * 2;
  const topW = baseW * 0.28;
  const cx = L.W / 2;
  const y0 = top + (avail - totalH) / 2;
  items.forEach((it, i) => {
    const t = progress(frame, itemReveal(scene, i, n), 20);
    if (t <= 0) return;
    const e = easeOutCubic(t);
    const yA = y0 + i * (layerH + gap);
    const wTop = topW + ((baseW - topW) * i) / n;
    const wBot = topW + ((baseW - topW) * (i + 1)) / n;
    const fill = mix(theme.accent, theme.accent2 === theme.accent ? theme.foreground : theme.accent2, n > 1 ? (i / (n - 1)) * 0.55 : 0);
    withAlpha(ctx, e, () => {
      ctx.save();
      ctx.translate(0, (1 - e) * 40);
      ctx.fillStyle = fill;
      ctx.beginPath();
      if (i === 0) {
        // Apex triangle-ish cap.
        ctx.moveTo(cx, yA - layerH * 0.25);
        ctx.lineTo(cx + wBot / 2, yA + layerH);
        ctx.lineTo(cx - wBot / 2, yA + layerH);
      } else {
        ctx.moveTo(cx - wTop / 2, yA);
        ctx.lineTo(cx + wTop / 2, yA);
        ctx.lineTo(cx + wBot / 2, yA + layerH);
        ctx.lineTo(cx - wBot / 2, yA + layerH);
      }
      ctx.closePath();
      ctx.fill();
      const inner = (i === 0 ? wBot * 0.55 : (wTop + wBot) / 2) - 40;
      const f = measure(ctx, fs, it, { maxWidth: Math.max(80, inner), maxLines: 2, maxSize: L.portrait ? 32 : 28, minSize: 15, weight: 'bold', lineHeight: 1.3 });
      ctx.fillStyle = readableOn(fill);
      ctx.textAlign = 'center';
      drawLines(ctx, fs, f, cx, yA + (i === 0 ? layerH * 0.6 : layerH / 2) - f.height / 2);
      ctx.restore();
    });
  });
}
