import { alpha, mix } from '../../../design/presets';
import { easeOutBack, easeOutCubic, progress } from '../animation';
import { localizeDigits } from '../../../design/digits';
import { card, drawHeader, iconBadge, withAlpha, type SceneDrawArgs } from '../kit';
import { itemReveal, shownItems } from '../../timing';
import { discLabel, measure } from './common';
import { drawLines } from '../textLayout';

/** دورة: stages around a ring joined by arrows; a highlight travels once all are shown. */
export function drawCycle(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs, digits } = a;
  const top = drawHeader(a);
  const items = shownItems(scene);
  const n = items.length;
  if (!n) return;
  const avail = L.H - top - L.M;
  const cx = L.W / 2;
  const cy = top + avail / 2;
  const R = Math.min(avail * 0.36, L.W * (L.portrait ? 0.3 : 0.22));
  const labelW = L.portrait ? 220 : L.square ? 260 : 300;
  const angle = (i: number) => -Math.PI / 2 + (i / n) * Math.PI * 2;
  const lastReveal = itemReveal(scene, n - 1, n) + 20;
  // Ring segments with arrowheads, each drawn when its source stage appears.
  items.forEach((_, i) => {
    const t = easeOutCubic(progress(frame, itemReveal(scene, i, n) + 8, 20));
    if (t <= 0 || n < 2) return;
    const a0 = angle(i) + 0.22;
    const a1 = angle(i) + (Math.PI * 2) / n - 0.22;
    const aEnd = a0 + (a1 - a0) * t;
    ctx.strokeStyle = alpha(theme.accent, 0.8);
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, R, a0, aEnd);
    ctx.stroke();
    if (t > 0.95) {
      const hx = cx + Math.cos(aEnd) * R;
      const hy = cy + Math.sin(aEnd) * R;
      const dir = aEnd + Math.PI / 2;
      ctx.fillStyle = theme.accent;
      ctx.beginPath();
      ctx.moveTo(hx + Math.cos(dir) * 14, hy + Math.sin(dir) * 14);
      ctx.lineTo(hx + Math.cos(dir + 2.4) * 14, hy + Math.sin(dir + 2.4) * 14);
      ctx.lineTo(hx + Math.cos(dir - 2.4) * 14, hy + Math.sin(dir - 2.4) * 14);
      ctx.closePath();
      ctx.fill();
    }
  });
  const ct = easeOutBack(progress(frame, 6, 24));
  iconBadge(ctx, theme, scene.icon || 'recycle', cx, cy, Math.min(70, R * 0.38) * ct);
  const active = frame > lastReveal ? Math.floor((frame - lastReveal) / 30) % n : -1;
  items.forEach((it, i) => {
    const t = progress(frame, itemReveal(scene, i, n), 20);
    if (t <= 0) return;
    const ang = angle(i);
    const nx = cx + Math.cos(ang) * R;
    const ny = cy + Math.sin(ang) * R;
    const r = 30 * easeOutBack(t);
    discLabel(ctx, fs, localizeDigits(String(i + 1), digits), nx, ny, Math.max(1, r), i === active ? theme.foreground : mix(theme.accent, theme.accent2, (i % 2) * 0.4));
    // Label card outside the ring.
    const lx = cx + Math.cos(ang) * (R + 40 + labelW / 2 * Math.abs(Math.cos(ang)));
    const ly = cy + Math.sin(ang) * (R + 60);
    const f = measure(ctx, fs, it, { maxWidth: labelW - 24, maxLines: 2, maxSize: L.portrait ? 26 : 26, minSize: 15, weight: 'bold', lineHeight: 1.3 });
    const bw = Math.min(labelW, f.width + 32);
    const bh = f.height + 18;
    const bx = Math.max(L.M * 0.4, Math.min(L.W - L.M * 0.4 - bw, lx - bw / 2));
    const by = Math.max(top - 10, Math.min(L.H - L.M * 0.5 - bh, ly - bh / 2));
    withAlpha(ctx, easeOutCubic(t), () => {
      card(ctx, theme, bx, by, bw, bh, 12, i === active ? alpha(theme.accent, 0.25) : theme.surface);
      ctx.fillStyle = theme.foreground;
      ctx.textAlign = 'center';
      drawLines(ctx, fs, f, bx + bw / 2, by + 9);
    });
  });
}
