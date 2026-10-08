import { font, type Ctx2D, type FontSpec } from './context';

/**
 * Greedy word wrap using real glyph measurements. Words are kept in logical order;
 * the canvas bidi algorithm (ctx.direction = 'rtl') handles visual ordering and shaping.
 * A single word wider than maxWidth stays whole, since splitting it would break Arabic joining.
 */
export function wrapText(ctx: Ctx2D, text: string, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export interface FittedText {
  lines: string[];
  fontSize: number;
  lineHeight: number;
  weight: 'regular' | 'bold';
  width: number;
  height: number;
}

export interface FitOptions {
  maxWidth: number;
  maxLines: number;
  maxSize: number;
  minSize: number;
  weight: 'regular' | 'bold';
  lineHeight?: number;
}

const cache = new Map<string, FittedText>();

/**
 * Shrinks the font from `maxSize` until the text fits in `maxLines` lines of `maxWidth`.
 * At the minimum size, extra lines are kept (never silently dropped) so no text is lost;
 * callers size their boxes from the returned height.
 */
export function fitText(ctx: Ctx2D, spec: FontSpec, text: string, opts: FitOptions): FittedText {
  const key = `${spec.family}|${text}|${opts.maxWidth}|${opts.maxLines}|${opts.maxSize}|${opts.minSize}|${opts.weight}|${opts.lineHeight ?? ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let size = opts.maxSize;
  let lines: string[] = [];
  for (;;) {
    ctx.font = font(spec, opts.weight, size);
    lines = wrapText(ctx, text, opts.maxWidth);
    const widest = Math.max(0, ...lines.map((l) => ctx.measureText(l).width));
    if ((lines.length <= opts.maxLines && widest <= opts.maxWidth) || size <= opts.minSize) break;
    size = Math.max(opts.minSize, size - 2);
  }
  const lineHeight = size * (opts.lineHeight ?? 1.55);
  const width = Math.max(0, ...lines.map((l) => ctx.measureText(l).width));
  const fitted: FittedText = { lines, fontSize: size, lineHeight, weight: opts.weight, width, height: lines.length * lineHeight };
  if (cache.size > 4000) cache.clear();
  cache.set(key, fitted);
  return fitted;
}

/**
 * Draws pre-wrapped lines; `top` is the top of the text box. Returns the y below the last line.
 * Uses a middle baseline per line so Arabic ascenders/descenders stay inside the box.
 */
export function drawLines(ctx: Ctx2D, spec: FontSpec, fitted: FittedText, x: number, top: number): number {
  ctx.font = font(spec, fitted.weight, fitted.fontSize);
  const prev = ctx.textBaseline;
  ctx.textBaseline = 'middle';
  fitted.lines.forEach((line, i) => ctx.fillText(line, x, top + fitted.lineHeight * (i + 0.5)));
  ctx.textBaseline = prev;
  return top + fitted.height;
}

/** Drops cached layouts; call after a font finishes loading since metrics change. */
export const clearTextCache = (): void => cache.clear();
