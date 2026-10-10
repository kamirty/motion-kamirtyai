/**
 * Shared building blocks for scene drawers: layout spaces, entrance helpers, cards, icon badges
 * and the standard scene header. Every drawer works in the design space of its Layout
 * (1280×720, 720×1280 or 1080×1080); renderFrame scales it to the output size.
 */
import { alpha, mix, readableOn } from '../../design/presets';
import type { DigitSystem, Scene, Theme } from '../../domain/types';
import { HEADER } from '../timing';
import { clamp, easeOutBack, easeOutCubic, progress } from './animation';
import type { Ctx2D, FontSpec } from './context';
import { drawIcon } from './icons';
import { drawLines, fitText } from './textLayout';

export interface Layout {
  W: number;
  H: number;
  /** Safe margin from the frame edges. */
  M: number;
  portrait: boolean;
  square: boolean;
}

/** Design spaces per aspect; renderFrame scales them to the output resolution. */
export function layoutFor(size: { width: number; height: number }): Layout {
  if (size.width === size.height) return { W: 1080, H: 1080, M: 80, portrait: false, square: true };
  if (size.height > size.width) return { W: 720, H: 1280, M: 56, portrait: true, square: false };
  return { W: 1280, H: 720, M: 80, portrait: false, square: false };
}

export interface SceneDrawArgs {
  ctx: Ctx2D;
  scene: Scene;
  theme: Required<Theme>;
  /** Frame index relative to the scene start. */
  frame: number;
  layout: Layout;
  font: FontSpec;
  digits: DigitSystem;
}

export type SceneDrawer = (args: SceneDrawArgs) => void;

export const appear = (frame: number, delay: number, length = 22) => easeOutCubic(progress(frame, delay, length));

export function withAlpha(ctx: Ctx2D, a: number, draw: () => void): void {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha *= clamp(a);
  draw();
  ctx.restore();
}

export function roundRect(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  // Browsers throw on a negative radius (which aborts a whole export), so clamp at 0; a
  // collapsing shape (zero/negative size mid-animation) simply draws nothing visible.
  ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2)) || 0);
}

/**
 * Card with a layered drop shadow. Offset translucent fills instead of shadowBlur keep export
 * fast on machines without GPU canvas acceleration.
 */
export function card(ctx: Ctx2D, theme: Required<Theme>, x: number, y: number, w: number, h: number, r = 22, fill = theme.surface): void {
  ctx.fillStyle = alpha('#000000', 0.07);
  roundRect(ctx, x - 2, y + 4, w + 4, h + 6, r + 2);
  ctx.fill();
  ctx.fillStyle = alpha('#000000', 0.07);
  roundRect(ctx, x, y + 8, w, h, r);
  ctx.fill();
  ctx.fillStyle = fill;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
}

/** Accent disc with the scene icon in a readable colour. */
export function iconBadge(ctx: Ctx2D, theme: Required<Theme>, icon: string, cx: number, cy: number, r: number, color = theme.accent): void {
  if (r <= 0) return;
  const grad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  grad.addColorStop(0, color);
  grad.addColorStop(1, mix(color, theme.accent2, 0.45));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  if (icon) drawIcon(ctx, icon, cx, cy, r * 1.05, readableOn(color), 2);
}

/** Scene title with icon badge; returns the y where content can start. */
export function drawHeader(a: SceneDrawArgs): number {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const t = appear(frame, HEADER.icon, 24);
  const top = L.portrait ? L.M * 2.2 : L.M * 0.9;
  if (L.portrait) {
    const r = 46;
    withAlpha(ctx, t, () => iconBadge(ctx, theme, scene.icon, L.W / 2, top + r, r * easeOutBack(t)));
    const fitted = fitText(ctx, fs, scene.title, { maxWidth: L.W - L.M * 2, maxLines: 3, maxSize: 52, minSize: 30, weight: 'bold', lineHeight: 1.45 });
    withAlpha(ctx, appear(frame, HEADER.title, 24), () => {
      ctx.fillStyle = theme.foreground;
      ctx.textAlign = 'center';
      drawLines(ctx, fs, fitted, L.W / 2, top + r * 2 + 24 + (1 - t) * 20);
    });
    return top + r * 2 + 24 + fitted.height + 40;
  }
  const r = 36;
  const badgeX = L.W - L.M - r;
  withAlpha(ctx, t, () => iconBadge(ctx, theme, scene.icon, badgeX, top + r, r * easeOutBack(t)));
  const fitted = fitText(ctx, fs, scene.title, { maxWidth: L.W - L.M * 2 - r * 2 - 28, maxLines: 2, maxSize: 48, minSize: 28, weight: 'bold', lineHeight: 1.4 });
  const textTop = top + r - Math.max(fitted.height, r * 2) / 2 + Math.max(0, (r * 2 - fitted.height) / 2);
  withAlpha(ctx, appear(frame, HEADER.title, 24), () => {
    ctx.fillStyle = theme.foreground;
    ctx.textAlign = 'right';
    drawLines(ctx, fs, fitted, badgeX - r - 24 + (1 - t) * -30, textTop);
  });
  // Accent underline grows from the right.
  const lineW = Math.min(fitted.width, 220) * appear(frame, 14, 30);
  const lineY = Math.max(top + r * 2, textTop + fitted.height) + 14;
  ctx.fillStyle = theme.accent;
  roundRect(ctx, badgeX - r - 24 - lineW, lineY, lineW, 6, 3);
  ctx.fill();
  return lineY + 44;
}
