import { alpha, contrast } from '../../design/presets';
import type { LookId, Theme } from '../../domain/types';
import type { Ctx2D } from './context';

/**
 * Visual look ("النمط البصري") applied on top of every scene without touching the drawers:
 * while a frame's content is drawn, a few context methods are wrapped so that
 * - cartoon: sizeable filled shapes get a thick outline and a hard offset shadow (sticker/comic);
 * - minimal: gradients become flat, glows disappear, sizeable shapes get a hairline outline;
 * - modern: nothing changes.
 * Deterministic: it only depends on the project's style and the drawing calls themselves.
 */

let current: LookId = 'modern';
/** The look of the frame being drawn (read by kit.card to drop its soft shadow). */
export const activeLook = (): LookId => current;

const isDark = (hex: string) => contrast(hex, '#ffffff') > contrast(hex, '#000000');

/** Shapes smaller than this (design px) stay untouched: dots, particles, tiny markers. */
const MIN_SHAPE = 28;

/** Restore function of the wrapping still installed on a context (if a frame threw mid-way). */
const pending = new WeakMap<object, () => void>();

export function beginLook(ctx: Ctx2D, look: LookId, theme: Required<Theme>): () => void {
  pending.get(ctx)?.();
  current = look;
  if (look === 'modern') return () => undefined;
  const c = ctx as Ctx2D & Record<string, unknown>;
  const saved: [string, unknown][] = [];
  const wrap = (name: string, fn: unknown) => {
    saved.push([name, Object.prototype.hasOwnProperty.call(c, name) ? c[name] : undefined]);
    c[name] = fn;
  };
  const orig = {
    beginPath: ctx.beginPath.bind(ctx),
    roundRect: ctx.roundRect.bind(ctx),
    rect: ctx.rect.bind(ctx),
    arc: ctx.arc.bind(ctx),
    ellipse: ctx.ellipse.bind(ctx),
    fill: ctx.fill.bind(ctx) as (...a: unknown[]) => void,
    createLinearGradient: ctx.createLinearGradient.bind(ctx),
    createRadialGradient: ctx.createRadialGradient.bind(ctx),
  };
  // Size of the current path (smallest side of its largest shape).
  let size = 0;
  wrap('beginPath', () => {
    size = 0;
    orig.beginPath();
  });
  wrap('roundRect', (x: number, y: number, w: number, h: number, r?: number | number[]) => {
    size = Math.max(size, Math.min(Math.abs(w), Math.abs(h)));
    orig.roundRect(x, y, w, h, r as number);
  });
  wrap('rect', (x: number, y: number, w: number, h: number) => {
    size = Math.max(size, Math.min(Math.abs(w), Math.abs(h)));
    orig.rect(x, y, w, h);
  });
  wrap('arc', (x: number, y: number, r: number, a0: number, a1: number, ccw?: boolean) => {
    size = Math.max(size, r * 2);
    orig.arc(x, y, r, a0, a1, ccw);
  });
  wrap('ellipse', (x: number, y: number, rx: number, ry: number, rot: number, a0: number, a1: number, ccw?: boolean) => {
    size = Math.max(size, Math.min(rx, ry) * 2);
    orig.ellipse(x, y, rx, ry, rot, a0, a1, ccw);
  });

  const dark = isDark(theme.background);
  if (look === 'cartoon') {
    const ink = dark ? '#ffffff' : '#161616';
    const shadow = dark ? alpha(theme.accent, 0.85) : '#161616';
    wrap('fill', (...args: unknown[]) => {
      // fill(Path2D) and small shapes: unchanged.
      if (args.length && typeof args[0] === 'object') return orig.fill(...args);
      if (size < MIN_SHAPE || ctx.globalAlpha < 0.15) return orig.fill(...args);
      const m = typeof ctx.getTransform === 'function' ? ctx.getTransform() : null;
      const k = (m && Math.abs(m.a)) || 1;
      ctx.save();
      ctx.shadowColor = shadow;
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 6 * k;
      ctx.shadowOffsetY = 7 * k;
      orig.fill(...args);
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = ink;
      ctx.lineWidth = size > 120 ? 4.5 : 3.5;
      ctx.lineJoin = 'round';
      ctx.setLineDash([]);
      ctx.stroke();
      ctx.restore();
    });
  } else {
    const hair = alpha(dark ? '#ffffff' : '#000000', 0.16);
    wrap('fill', (...args: unknown[]) => {
      orig.fill(...args);
      if (args.length && typeof args[0] === 'object') return;
      if (size < 60 || ctx.globalAlpha < 0.15) return;
      ctx.save();
      ctx.strokeStyle = hair;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.stroke();
      ctx.restore();
    });
    // Flat colour: a linear gradient keeps only its first colour.
    wrap('createLinearGradient', (...a: [number, number, number, number]) => {
      const g = orig.createLinearGradient(...a);
      const add = g.addColorStop.bind(g);
      let first = true;
      g.addColorStop = (_o: number, color: string) => {
        if (!first) return;
        first = false;
        add(0, color);
        add(1, color);
      };
      return g;
    });
    // Glows and halos (radial gradients) vanish.
    wrap('createRadialGradient', (...a: [number, number, number, number, number, number]) => {
      const g = orig.createRadialGradient(...a);
      const add = g.addColorStop.bind(g);
      add(0, 'rgba(0,0,0,0)');
      add(1, 'rgba(0,0,0,0)');
      g.addColorStop = () => undefined;
      return g;
    });
  }

  const restore = () => {
    pending.delete(ctx);
    for (const [name, prev] of saved.reverse()) {
      if (prev === undefined) delete c[name];
      else c[name] = prev;
    }
    current = 'modern';
  };
  pending.set(ctx, restore);
  return restore;
}
