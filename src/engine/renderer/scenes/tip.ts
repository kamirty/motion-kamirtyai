import { alpha } from '../../../design/presets';
import { easeOutBack, easeOutCubic, progress } from '../animation';
import { card, iconBadge, withAlpha, type SceneDrawArgs } from '../kit';
import { TIP, shownItems } from '../../timing';
import { measure, text } from './common';
import { drawLines } from '../textLayout';

/** نصيحة / هل تعلم؟: a highlighted card with a glowing badge. */
export function drawTip(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const [body = '', note] = shownItems(scene);
  const w = L.W - L.M * 2;
  const tf = measure(ctx, fs, body, { maxWidth: w - 120, maxLines: L.portrait ? 9 : 5, maxSize: L.portrait ? 44 : 46, minSize: 22, weight: 'bold', lineHeight: 1.55 });
  const hf = measure(ctx, fs, scene.title, { maxWidth: w - 120, maxLines: 1, maxSize: 40, minSize: 24, weight: 'bold' });
  const nh = note ? 50 : 0;
  const h = 150 + hf.height + 24 + tf.height + nh + 40;
  const x = L.M;
  const y = (L.H - h) / 2 + 30;
  const t = easeOutCubic(progress(frame, 0, 20));
  withAlpha(ctx, t, () => {
    card(ctx, theme, x, y, w, h, 20);
    ctx.fillStyle = theme.accent;
    ctx.fillRect(x + w - 10, y, 10, h);
  });
  // Badge with rays.
  const cx = L.W / 2;
  const cy = y;
  const bt = easeOutBack(progress(frame, TIP.badge, 22));
  if (bt > 0) {
    ctx.save();
    ctx.strokeStyle = alpha(theme.accent, 0.6);
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    for (let k = 0; k < 10; k++) {
      const ang = (k / 10) * Math.PI * 2 + frame * 0.01;
      const pulse = 0.5 + 0.5 * Math.sin(frame / 8 + k);
      const r1 = 70 * bt;
      const r2 = r1 + 14 + 10 * pulse;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
      ctx.lineTo(cx + Math.cos(ang) * r2, cy + Math.sin(ang) * r2);
      ctx.stroke();
    }
    ctx.restore();
    iconBadge(ctx, theme, scene.icon || 'lightbulb', cx, cy, 56 * bt);
  }
  let ty = y + 80;
  withAlpha(ctx, easeOutCubic(progress(frame, TIP.badge + 6, 20)), () => {
    ty = text(ctx, fs, scene.title, cx, y + 80, 'center', theme.accent === theme.background ? theme.foreground : theme.foreground, { maxWidth: w - 120, maxLines: 1, maxSize: 40, minSize: 24, weight: 'bold' }).bottom;
  });
  ty = y + 80 + hf.height + 24;
  const tt = easeOutCubic(progress(frame, TIP.text, 26));
  withAlpha(ctx, tt, () => {
    ctx.fillStyle = theme.foreground;
    ctx.textAlign = 'center';
    drawLines(ctx, fs, tf, cx, ty + (1 - tt) * 20);
  });
  if (note) {
    withAlpha(ctx, easeOutCubic(progress(frame, TIP.note, 24)) * 0.75, () => {
      text(ctx, fs, note, cx, ty + tf.height + 18, 'center', theme.foreground, { maxWidth: w - 140, maxLines: 1, maxSize: 24, minSize: 16 });
    });
  }
}
