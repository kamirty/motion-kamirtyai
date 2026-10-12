import { alpha } from '../../design/presets';
import { clamp, easeOutCubic, hash01, progress } from './animation';
import type { Ctx2D } from './context';
import type { Layout } from './kit';

/**
 * Ambient motion: small effects that keep a scene alive after its elements have appeared
 * (radar pulses, a travelling spark, an orbiting ring, waving underlines, a light sweep,
 * confetti). Every effect is a pure function of the frame, so preview and export match.
 */

/** Rings expanding and fading behind a focal point, one every `period` frames. */
export function radarPulse(ctx: Ctx2D, cx: number, cy: number, r: number, color: string, frame: number, period = 60): void {
  for (let k = 0; k < 3; k++) {
    const p = ((frame + (k * period) / 3) % period) / period;
    ctx.strokeStyle = alpha(color, 0.35 * (1 - p));
    ctx.lineWidth = 3 + 3 * (1 - p);
    ctx.beginPath();
    ctx.arc(cx, cy, r * (1 + p * 0.9), 0, Math.PI * 2);
    ctx.stroke();
  }
}

/** A glowing spark travelling along a polyline and looping (e.g. along a road or across steps). */
export function travellingSpark(ctx: Ctx2D, pts: [number, number][], frame: number, color: string, period = 150): void {
  if (pts.length < 2) return;
  const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  const total = lens.reduce((a, b) => a + b, 0);
  if (total <= 0) return;
  let d = ((frame % period) / period) * total;
  let i = 0;
  while (i < lens.length - 1 && d > lens[i]) d -= lens[i++];
  const f = lens[i] ? d / lens[i] : 0;
  const x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f;
  const y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f;
  const g = ctx.createRadialGradient(x, y, 0, x, y, 26);
  g.addColorStop(0, alpha('#ffffff', 0.95));
  g.addColorStop(0.35, alpha(color, 0.8));
  g.addColorStop(1, alpha(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, 26, 0, Math.PI * 2);
  ctx.fill();
}

/** A dashed ring turning around an icon badge, with a small satellite dot. */
export function orbitRing(ctx: Ctx2D, cx: number, cy: number, r: number, color: string, frame: number, t = 1): void {
  if (t <= 0) return;
  const rr = r * (1.32 + 0.04 * Math.sin(frame / 20)) * t;
  ctx.save();
  ctx.strokeStyle = alpha(color, 0.55);
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 7]);
  ctx.lineDashOffset = -frame * 0.6;
  ctx.beginPath();
  ctx.arc(cx, cy, rr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  const a = frame * 0.045;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 4.5 * t, 0, Math.PI * 2);
  ctx.fill();
}

/** An underline that grows from the right, then keeps rippling gently. */
export function waveLine(ctx: Ctx2D, xRight: number, y: number, w: number, color: string, frame: number, grow: number): void {
  const len = w * grow;
  if (len <= 1) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let x = 0; x <= len; x += 4) {
    const amp = 3.2 * clamp(x / 30) * grow;
    const yy = y + 3 + Math.sin(x / 16 - frame / 7) * amp;
    if (x === 0) ctx.moveTo(xRight - x, yy);
    else ctx.lineTo(xRight - x, yy);
  }
  ctx.stroke();
  ctx.restore();
}

/** A soft diagonal light band crossing the frame every `period` frames. */
export function lightSweep(ctx: Ctx2D, L: Layout, frame: number, period = 210): void {
  const p = (frame % period) / 60;
  if (p >= 1) return;
  const x = -L.W * 0.3 + p * L.W * 1.6;
  const g = ctx.createLinearGradient(x - 160, 0, x + 160, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.07)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.save();
  ctx.translate(x, L.H / 2);
  ctx.transform(1, 0, -0.35, 1, 0, 0);
  ctx.translate(-x, -L.H / 2);
  ctx.fillStyle = g;
  ctx.fillRect(x - 160, -L.H * 0.2, 320, L.H * 1.4);
  ctx.restore();
}

/** Confetti burst from (cx, cy) starting at local frame 0 (`f` = frames since the burst). */
export function confetti(ctx: Ctx2D, cx: number, cy: number, f: number, colors: string[], seed = 1, count = 46): void {
  if (f < 0 || f > 70) return;
  const fade = 1 - progress(f, 45, 25);
  for (let i = 0; i < count; i++) {
    const a = hash01(i, seed) * Math.PI * 2;
    const speed = 7 + hash01(i, seed + 3) * 9;
    const t = f;
    const x = cx + Math.cos(a) * speed * t * (1 - t / 160);
    const y = cy + Math.sin(a) * speed * t * (1 - t / 160) + 0.16 * t * t;
    ctx.save();
    ctx.globalAlpha *= fade;
    ctx.translate(x, y);
    ctx.rotate(hash01(i, seed + 5) * 6 + t * 0.2 * (i % 2 ? 1 : -1));
    ctx.fillStyle = colors[i % colors.length];
    if (i % 3 === 0) {
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    } else ctx.fillRect(-7, -3.5, 14, 7);
    ctx.restore();
  }
}

/**
 * Typewriter reveal for already-wrapped lines: each line is uncovered in reading order (from its
 * right edge) by a clip, so Arabic letters keep their joined shapes; a caret blinks at the edge.
 * `p` is 0→1 over all lines; `rightOf(i)` gives each line's right edge and `widthOf(i)` its width.
 */
export function typewriter(
  ctx: Ctx2D, p: number, lines: number, lineH: number, top: number,
  rightOf: (i: number) => number, widthOf: (i: number) => number, caret: string, frame: number, draw: () => void,
): void {
  if (p >= 1) return draw();
  const per = 1 / Math.max(1, lines);
  ctx.save();
  ctx.beginPath();
  let edge: [number, number] | null = null;
  for (let i = 0; i < lines; i++) {
    const q = clamp((p - i * per) / per);
    if (q <= 0) break;
    const w = widthOf(i) + 16;
    const r = rightOf(i) + 8;
    ctx.rect(r - w * easeOutCubic(q), top + i * lineH - 4, w * easeOutCubic(q), lineH + 8);
    if (q < 1) edge = [r - w * easeOutCubic(q), top + i * lineH];
  }
  ctx.clip();
  draw();
  ctx.restore();
  if (edge && Math.floor(frame / 8) % 2 === 0) {
    ctx.fillStyle = caret;
    ctx.fillRect(edge[0] - 4, edge[1] + lineH * 0.18, 4, lineH * 0.64);
  }
}
