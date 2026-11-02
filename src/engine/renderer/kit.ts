/**
 * Shared building blocks for scene drawers: layout spaces, entrance helpers, cards, icon badges
 * and the standard scene header. Every drawer works in the design space of its Layout
 * (1280×720, 720×1280 or 1080×1080); renderFrame scales it to the output size.
 */
import { alpha, mix, readableOn } from '../../design/presets';
import type { DigitSystem, EntranceId, Scene, Theme } from '../../domain/types';
import { HEADER } from '../timing';
import { bounceOut, clamp, easeOutBack, easeOutCubic, progress } from './animation';
import { font, type Ctx2D, type FontSpec } from './context';
import { drawIcon } from './icons';
import { orbitRing, typewriter, waveLine } from './ambient';
import { floatY, headerStyleOf, wordTokens } from './lively';
import { activeLook } from './look';
import { drawLines, fitText, type FittedText } from './textLayout';

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
  /** Entrance motion of this scene, also applied to each element as it appears. */
  motion?: EntranceId;
  /** Lively motion (style.lively): varied headers and gently floating elements. */
  lively?: boolean;
  /** Position of the scene in the video (picks its header style when lively). */
  index?: number;
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
  if (activeLook() !== 'modern') {
    // Minimal and cartoon draw their own edge/shadow (see look.ts).
    ctx.fillStyle = fill;
    roundRect(ctx, x, y, w, h, r);
    ctx.fill();
    return;
  }
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
export function iconBadge(ctx: Ctx2D, theme: Required<Theme>, icon: string, cx: number, cy: number, r: number, color = theme.accent, drawn = 1): void {
  if (r <= 0) return;
  const grad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  grad.addColorStop(0, color);
  grad.addColorStop(1, mix(color, theme.accent2, 0.45));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  if (icon) drawIcon(ctx, icon, cx, cy, r * 1.05, readableOn(color), 2, drawn);
}

/**
 * Title drawn word by word: each word pops up in reading order (Arabic words are never split, so
 * letters keep their joined forms), then a marker sweeps behind the longest word.
 */
function kineticTitle(a: SceneDrawArgs, fitted: FittedText, anchorX: number, align: 'right' | 'center', textTop: number, color: string): void {
  const { ctx, theme, frame, font: fs } = a;
  ctx.font = font(fs, fitted.weight, fitted.fontSize);
  const space = ctx.measureText(' ').width;
  const tokens: { text: string; cx: number; cy: number; w: number }[] = [];
  fitted.lines.forEach((line, li) => {
    const words = wordTokens(line);
    const widths = words.map((w) => ctx.measureText(w).width);
    const lineW = widths.reduce((s, w) => s + w, 0) + space * Math.max(0, words.length - 1);
    let x = align === 'right' ? anchorX : anchorX + lineW / 2;
    words.forEach((w, k) => {
      tokens.push({ text: w, cx: x - widths[k] / 2, cy: textTop + fitted.lineHeight * (li + 0.5), w: widths[k] });
      x -= widths[k] + space;
    });
  });
  const START = HEADER.title;
  const STEP = 4;
  let key = -1;
  tokens.forEach((t, k) => {
    if (/[\u0600-\u06FF]/.test(t.text) && t.text.length >= 3 && (key < 0 || t.w > tokens[key].w)) key = k;
  });
  if (key >= 0) {
    const m = easeOutCubic(progress(frame, START + tokens.length * STEP + 10, 16));
    if (m > 0) {
      const t = tokens[key];
      const w = (t.w + 14) * m;
      ctx.fillStyle = alpha(theme.accent, 0.42);
      roundRect(ctx, t.cx + t.w / 2 + 7 - w, t.cy - fitted.fontSize * 0.08, w, fitted.fontSize * 0.5, 6);
      ctx.fill();
    }
  }
  ctx.font = font(fs, fitted.weight, fitted.fontSize);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  tokens.forEach((t, k) => {
    const p = progress(frame, START + k * STEP, 14);
    if (p <= 0) return;
    const s = 0.6 + 0.4 * easeOutBack(p);
    ctx.save();
    ctx.globalAlpha *= Math.min(1, p * 2);
    ctx.translate(t.cx, t.cy + (1 - easeOutCubic(p)) * 18);
    ctx.scale(s, s);
    ctx.fillText(t.text, 0, 0);
    ctx.restore();
  });
  ctx.textBaseline = 'alphabetic';
}

/**
 * Scene title with icon badge; returns the y where content can start. With lively motion the
 * header style changes from scene to scene (classic typewriter, word-by-word with a marker,
 * colour band, centred with brackets) while the layout (and so the content below) stays put.
 */
export function drawHeader(a: SceneDrawArgs): number {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const variant = headerStyleOf(a.lively, a.index);
  const t = appear(frame, HEADER.icon, 24);
  // The icon traces itself in, then a dashed ring keeps turning around it.
  const drawn = easeOutCubic(progress(frame, HEADER.icon + 6, 34));
  const typed = progress(frame, HEADER.title, 30);
  const top = L.portrait ? L.M * 2.2 : L.M * 0.9;
  const typeLines = (fitted: FittedText, right: (w: number) => number, textTop: number, color = theme.foreground) => {
    ctx.font = font(fs, fitted.weight, fitted.fontSize);
    const widths = fitted.lines.map((l) => ctx.measureText(l).width);
    typewriter(ctx, typed, fitted.lines.length, fitted.lineHeight, textTop, (i) => right(widths[i]), (i) => widths[i], theme.accent, frame, () => {
      ctx.fillStyle = color;
      drawLines(ctx, fs, fitted, ctx.textAlign === 'center' ? L.W / 2 : right(0), textTop);
    });
  };
  // Colour band growing from the right edge behind the title.
  const band = (y: number, h: number) => {
    const g = easeOutCubic(progress(frame, 0, 22));
    if (g <= 0) return;
    const w = (L.W - L.M * 0.5) * g;
    ctx.fillStyle = theme.accent;
    ctx.beginPath();
    ctx.moveTo(L.W, y);
    ctx.lineTo(L.W - w, y);
    ctx.lineTo(L.W - w + 18, y + h);
    ctx.lineTo(L.W, y + h);
    ctx.closePath();
    ctx.fill();
  };
  const onBand = readableOn(theme.accent);
  if (L.portrait) {
    const r = 46;
    const fitted = fitText(ctx, fs, scene.title, { maxWidth: L.W - L.M * 2, maxLines: 3, maxSize: 52, minSize: 30, weight: 'bold', lineHeight: 1.45 });
    const textTop = top + r * 2 + 24;
    if (variant === 'band') band(textTop - 14, fitted.height + 28);
    orbitRing(ctx, L.W / 2, top + r, r, theme.accent, frame, t);
    withAlpha(ctx, t, () => iconBadge(ctx, theme, scene.icon, L.W / 2, top + r, r * easeOutBack(t), theme.accent, drawn));
    ctx.textAlign = 'center';
    if (variant === 'kinetic') kineticTitle(a, fitted, L.W / 2, 'center', textTop, theme.foreground);
    else typeLines(fitted, (w) => L.W / 2 + w / 2, textTop, variant === 'band' ? onBand : theme.foreground);
    return top + r * 2 + 24 + fitted.height + 40;
  }
  const r = 36;
  const badgeX = L.W - L.M - r;
  const centred = variant === 'center';
  const fitted = fitText(ctx, fs, scene.title, { maxWidth: centred ? L.W - L.M * 2 - 120 : L.W - L.M * 2 - r * 2 - 40, maxLines: 2, maxSize: 48, minSize: 28, weight: 'bold', lineHeight: 1.4 });
  const textTop = top + r - Math.max(fitted.height, r * 2) / 2 + Math.max(0, (r * 2 - fitted.height) / 2);
  const lineY = Math.max(top + r * 2, textTop + fitted.height) + 14;
  if (centred) {
    // Centred title between two accent brackets that grow outwards.
    const g = easeOutCubic(progress(frame, 4, 26));
    const half = Math.min(fitted.width, L.W - L.M * 2 - 120) / 2 + 24;
    const midY = textTop + fitted.height / 2;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    for (const s of [1, -1]) {
      ctx.beginPath();
      ctx.moveTo(L.W / 2 + s * half, midY);
      ctx.lineTo(L.W / 2 + s * (half + 46 * g), midY);
      ctx.stroke();
    }
    withAlpha(ctx, t, () => iconBadge(ctx, theme, scene.icon, L.W / 2, lineY + 2, 14 * easeOutBack(t), theme.accent, drawn));
    ctx.textAlign = 'center';
    typeLines(fitted, (w) => L.W / 2 + w / 2, textTop);
    return lineY + 44;
  }
  if (variant === 'band') band(textTop - 12, Math.max(fitted.height, r * 2) + 12);
  orbitRing(ctx, badgeX, top + r, r, theme.accent, frame, t);
  withAlpha(ctx, t, () => iconBadge(ctx, theme, scene.icon, badgeX, top + r, r * easeOutBack(t), variant === 'band' ? theme.background : theme.accent, drawn));
  ctx.textAlign = 'right';
  if (variant === 'kinetic') kineticTitle(a, fitted, badgeX - r - 30, 'right', textTop, theme.foreground);
  else typeLines(fitted, () => badgeX - r - 30, textTop, variant === 'band' ? onBand : theme.foreground);
  // Accent underline grows from the right, then ripples.
  if (variant === 'classic') waveLine(ctx, badgeX - r - 30, lineY, Math.min(fitted.width, 220), theme.accent, frame, appear(frame, 14, 30));
  return lineY + 44;
}

/**
 * Draws one element with the scene's entrance motion while it appears (`t` = its own reveal
 * progress 0→1), centred on its box (cx, cy, w, h). Once revealed, or with no motion, it draws
 * unchanged — the drawer's own animation still runs inside.
 */
export function itemEnter(a: SceneDrawArgs, t: number, cx: number, cy: number, w: number, h: number, inner: () => void): void {
  const m = a.motion;
  // Lively motion: revealed elements float gently, each on its own rhythm.
  const draw = a.lively
    ? () => {
        a.ctx.save();
        a.ctx.translate(0, floatY(a.frame, cx, cy));
        inner();
        a.ctx.restore();
      }
    : inner;
  if (!m || m === 'none' || t >= 1) return draw();
  if (t <= 0) return;
  const { ctx } = a;
  const e = easeOutCubic(t);
  ctx.save();
  switch (m) {
    case 'rise': ctx.translate(0, (1 - e) * 50); break;
    case 'drop': ctx.translate(0, -(1 - e) * 50); break;
    case 'side': ctx.translate(-(1 - e) * 80, 0); break;
    case 'zoom': ctx.translate(cx, cy); ctx.scale(1.35 - 0.35 * e, 1.35 - 0.35 * e); ctx.translate(-cx, -cy); break;
    case 'spin': ctx.translate(cx, cy); ctx.rotate((1 - e) * 0.8); ctx.scale(0.4 + 0.6 * e, 0.4 + 0.6 * e); ctx.translate(-cx, -cy); break;
    case 'pop': {
      const k = 0.3 + 0.7 * easeOutBack(t);
      ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-cx, -cy);
      break;
    }
    case 'bounce': ctx.translate(0, -(1 - bounceOut(t)) * (h + 60)); break;
    case 'flip': ctx.translate(cx, cy); ctx.scale(Math.max(0.02, e), 1); ctx.translate(-cx, -cy); break;
    case 'wipe':
      ctx.beginPath();
      ctx.rect(cx + w / 2 + 40 - (w + 80) * e, cy - h / 2 - 60, (w + 80) * e, h + 120);
      ctx.clip();
      break;
    case 'iris':
      ctx.beginPath();
      ctx.arc(cx, cy, (Math.hypot(w, h) / 2 + 40) * e, 0, Math.PI * 2);
      ctx.clip();
      break;
    case 'swing': ctx.translate(cx + w / 2, cy - h / 2); ctx.rotate((1 - e) * 0.6); ctx.translate(-(cx + w / 2), -(cy - h / 2)); break;
  }
  draw();
  ctx.restore();
}
