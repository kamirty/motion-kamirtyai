import { iconById } from '../../design/icons';
import type { Ctx2D } from './context';

type Attrs = Record<string, string | number | undefined>;
const num = (v: string | number | undefined): number => Number(v ?? 0);

const pathCache = new Map<string, Path2D>();
function path2d(d: string): Path2D | null {
  if (typeof Path2D === 'undefined') return null;
  let p = pathCache.get(d);
  if (!p) {
    p = new Path2D(d);
    pathCache.set(d, p);
  }
  return p;
}

/**
 * Frame clock for the icons' idle motion, set by renderFrame for each frame it draws (so the
 * motion is a pure function of the frame, identical in preview and export).
 */
let clock = 0;
let lively = true;
export function setIconClock(frame: number, enabled = true): void {
  clock = frame;
  lively = enabled;
}

/**
 * Idle motion of an icon at (cx, cy): a gentle bob, a slow tilt, a soft pulse and, every four
 * seconds, a short playful wiggle. Each icon gets its own phase from its position so a row of
 * icons never moves in lockstep. Small icons (markers, pictogram units) stay still.
 */
function idle(cx: number, cy: number, size: number): { dy: number; rot: number; scale: number } {
  if (!lively || size < 26) return { dy: 0, rot: 0, scale: 1 };
  const phase = (((Math.round(cx) * 73856093) ^ (Math.round(cy) * 19349663)) >>> 0) % 997;
  const f = clock + phase;
  let rot = Math.sin(f / 27) * 0.05;
  const w = (f * 1.0) % 120;
  if (w < 18) rot += Math.sin((w / 18) * Math.PI * 3) * 0.2 * (1 - w / 18);
  return { dy: Math.sin(f / 16) * size * 0.03, rot, scale: 1 + 0.035 * Math.sin(f / 11) };
}

/**
 * Draws a 24×24 Lucide icon centred at (cx, cy) scaled to `size`, stroked like the SVG original
 * (2px round strokes, no fill). Unknown ids draw a ring so a scene never fails to render.
 */
/** `drawn` < 1 draws the strokes partially, as if a pen were still tracing the icon. */
export function drawIcon(ctx: Ctx2D, id: string, cx: number, cy: number, size: number, color: string, strokeWidth = 2, drawn = 1): void {
  if (size <= 0) return;
  const icon = iconById(id);
  const k = size / 24;
  const m = idle(cx, cy, size);
  ctx.save();
  ctx.translate(cx, cy + m.dy);
  if (m.rot) ctx.rotate(m.rot);
  if (m.scale !== 1) ctx.scale(m.scale, m.scale);
  ctx.translate(-size / 2, -size / 2);
  ctx.scale(k, k);
  ctx.strokeStyle = color;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (drawn < 1) ctx.setLineDash([Math.max(0.01, drawn) * 90, 200]);
  if (!icon) {
    ctx.beginPath();
    ctx.arc(12, 12, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }
  for (const [tag, raw] of icon.node) {
    const a = raw as Attrs;
    switch (tag) {
      case 'path': {
        const p = path2d(String(a.d));
        if (p) ctx.stroke(p);
        break;
      }
      case 'circle':
        ctx.beginPath();
        ctx.arc(num(a.cx), num(a.cy), num(a.r), 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'ellipse':
        ctx.beginPath();
        ctx.ellipse(num(a.cx), num(a.cy), num(a.rx), num(a.ry), 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'rect': {
        const r = num(a.rx ?? a.ry);
        ctx.beginPath();
        if (r > 0) ctx.roundRect(num(a.x), num(a.y), num(a.width), num(a.height), r);
        else ctx.rect(num(a.x), num(a.y), num(a.width), num(a.height));
        ctx.stroke();
        break;
      }
      case 'line':
        ctx.beginPath();
        ctx.moveTo(num(a.x1), num(a.y1));
        ctx.lineTo(num(a.x2), num(a.y2));
        ctx.stroke();
        break;
      case 'polyline':
      case 'polygon': {
        const pts = String(a.points).trim().split(/[\s,]+/).map(Number);
        ctx.beginPath();
        for (let i = 0; i + 1 < pts.length; i += 2) {
          if (i === 0) ctx.moveTo(pts[i], pts[i + 1]);
          else ctx.lineTo(pts[i], pts[i + 1]);
        }
        if (tag === 'polygon') ctx.closePath();
        ctx.stroke();
        break;
      }
    }
  }
  ctx.restore();
}
