import type { Ctx2D } from './context';

/** Draws a simple stroked icon centred at (cx, cy) inside a box of `size`. Unknown names draw a ring. */
export function drawIcon(ctx: Ctx2D, name: string, cx: number, cy: number, size: number, color: string): void {
  const s = size / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.07);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  switch (name) {
    case 'drop':
      ctx.moveTo(0, -s);
      ctx.bezierCurveTo(s * 0.9, -s * 0.1, s * 0.75, s, 0, s);
      ctx.bezierCurveTo(-s * 0.75, s, -s * 0.9, -s * 0.1, 0, -s);
      ctx.stroke();
      break;
    case 'chart':
      for (const [x, h] of [[-0.6, 0.6], [0, 1.2], [0.6, 0.9]] as const) {
        ctx.moveTo(x * s, s * 0.8);
        ctx.lineTo(x * s, s * 0.8 - h * s);
      }
      ctx.moveTo(-s, s * 0.8);
      ctx.lineTo(s, s * 0.8);
      ctx.stroke();
      break;
    case 'steps':
      for (const y of [-0.6, 0, 0.6]) {
        ctx.moveTo(-s * 0.3, y * s);
        ctx.lineTo(s * 0.9, y * s);
        ctx.moveTo(-s * 0.7 + ctx.lineWidth, y * s);
        ctx.arc(-s * 0.7, y * s, ctx.lineWidth, 0, Math.PI * 2);
      }
      ctx.stroke();
      break;
    default:
      ctx.arc(0, 0, s * 0.8, 0, Math.PI * 2);
      ctx.stroke();
  }
  ctx.restore();
}
