import { font, type Ctx2D } from './context';

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
}

/** Shrinks the font from `maxSize` until the text fits in `maxLines` lines of `maxWidth`. */
export function fitText(
  ctx: Ctx2D,
  text: string,
  opts: { maxWidth: number; maxLines: number; maxSize: number; minSize: number; weight: 400 | 700 },
): FittedText {
  let size = opts.maxSize;
  for (;;) {
    ctx.font = font(opts.weight, size);
    const lines = wrapText(ctx, text, opts.maxWidth);
    const widest = Math.max(0, ...lines.map((l) => ctx.measureText(l).width));
    if ((lines.length <= opts.maxLines && widest <= opts.maxWidth) || size <= opts.minSize) {
      return { lines: lines.slice(0, opts.maxLines), fontSize: size, lineHeight: size * 1.6 };
    }
    size = Math.max(opts.minSize, size - 2);
  }
}

/** Draws pre-wrapped lines starting at baseline y; returns the y after the last line. */
export function drawLines(ctx: Ctx2D, fitted: FittedText, x: number, y: number, weight: 400 | 700): number {
  ctx.font = font(weight, fitted.fontSize);
  fitted.lines.forEach((line, i) => ctx.fillText(line, x, y + i * fitted.lineHeight));
  return y + fitted.lines.length * fitted.lineHeight;
}
