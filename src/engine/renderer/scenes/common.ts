import { readableOn, textAccent } from '../../../design/presets';
import type { Theme } from '../../../domain/types';
import { font, type Ctx2D, type FontSpec } from '../context';
import { drawLines, fitText, type FitOptions } from '../textLayout';

/** Fits and draws text in one call; returns the bottom y. */
export function text(
  ctx: Ctx2D,
  fs: FontSpec,
  value: string,
  x: number,
  top: number,
  align: CanvasTextAlign,
  color: string,
  opts: Omit<FitOptions, 'weight'> & { weight?: 'regular' | 'bold' },
): { bottom: number; height: number; width: number } {
  const f = fitText(ctx, fs, value, { weight: 'regular', ...opts });
  ctx.fillStyle = color;
  ctx.textAlign = align;
  drawLines(ctx, fs, f, x, top);
  return { bottom: top + f.height, height: f.height, width: f.width };
}

/** Measures fitted text height without drawing. */
export function measure(ctx: Ctx2D, fs: FontSpec, value: string, opts: Omit<FitOptions, 'weight'> & { weight?: 'regular' | 'bold' }) {
  return fitText(ctx, fs, value, { weight: 'regular', ...opts });
}

/** Single-line centred label inside a filled disc (numbers, letters). */
export function discLabel(ctx: Ctx2D, fs: FontSpec, label: string, cx: number, cy: number, r: number, fill: string): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = readableOn(fill);
  ctx.font = font(fs, 'bold', r * 0.95);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, cy + r * 0.06);
  ctx.textBaseline = 'alphabetic';
}

export const accentText = (theme: Required<Theme>, c: string) => textAccent(theme, c);
