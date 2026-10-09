import { alpha, contrast, mix } from '../../../design/presets';
import type { Scene, Theme } from '../../../domain/types';
import { chartRows } from '../../sceneModel';
import { itemReveal } from '../../timing';
import { clamp, easeOutBack, easeOutCubic, progress } from '../animation';
import { font, type Ctx2D, type FontSpec } from '../context';
import { drawIcon } from '../icons';
import { appear, card, drawHeader, roundRect, withAlpha, type Layout, type SceneDrawArgs } from '../kit';
import { formatStatValue, parseStatValue, type StatValue } from '../numbers';
import { drawLines, fitText, type FittedText } from '../textLayout';

/**
 * دائرة نسب — a donut chart with a colour legend. Items read «الاسم: 40%». Segment i sweeps in
 * clockwise from 12 o'clock at its cue (itemReveal) while its legend row slides in; angles are
 * normalised to the total but values are shown exactly as written. Zero or missing values are
 * listed in the legend with a hollow swatch and get no segment. The centre counts up the largest
 * value with its label; once every segment is in, that segment eases outward and its row is
 * outlined. Legend: right of the donut in landscape (reading start), below it in portrait/square.
 */

// ───────────────────────── content ─────────────────────────

interface Seg {
  label: string;
  /** Display value exactly as written ('' when the item has no number). */
  value: string;
  stat: StatValue | null;
  /** Start and share of the circle, both as fractions of the total (share 0 → no segment). */
  start: number;
  frac: number;
}

function segmentsOf(items: string[]): { segs: Seg[]; largest: number } {
  const rows = chartRows({ items } as Scene);
  const total = rows.reduce((s, r) => s + Math.max(0, r.num), 0);
  let acc = 0;
  let largest = -1;
  const segs = rows.map((r, i) => {
    const num = Math.max(0, r.num);
    const frac = total > 0 ? num / total : 0;
    const seg: Seg = { label: r.label, value: r.value, stat: r.value ? parseStatValue(r.value) : null, start: acc, frac };
    acc += frac;
    if (frac > 0 && (largest < 0 || num > Math.max(0, rows[largest].num))) largest = i;
    return seg;
  });
  return { segs, largest };
}

const countText = (s: Seg, t: number): string => (s.stat ? formatStatValue(s.stat, s.stat.value * t) : s.value);

// ───────────────────────── colours ─────────────────────────

const rgb = (c: string): number[] => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));

function lab(c: string): [number, number, number] {
  const [r, g, b] = rgb(c).map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  const fx = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
  const fy = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const fz = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** Perceptual colour distance (CIE76). */
function dE(p: string, q: string): number {
  const [a, b] = [lab(p), lab(q)];
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));
}

const palettes = new Map<string, string[]>();

/**
 * `k` segment colours: accent and accent2 first, then tints/shades of them (mixed with the
 * background or foreground) and neutral mixes, picked by farthest-point sampling so every pair
 * differs, then ordered so neighbours around the ring (cyclically) differ the most.
 */
function paletteFor(theme: Required<Theme>, k: number): string[] {
  if (k <= 0) return [];
  const key = `${theme.background}${theme.foreground}${theme.accent}${theme.accent2}|${k}`;
  const hit = palettes.get(key);
  if (hit) return hit;
  const { background: bg, foreground: fg, accent, accent2 } = theme;
  const pool: string[] = [];
  const add = (c: string, brand = false) => {
    // Derived tints must also clear a luminance floor: pale tints vanish on light cards.
    if (dE(c, bg) >= 24 && (brand || contrast(c, bg) >= 1.35) && pool.every((p) => dE(p, c) >= 10)) pool.push(c);
  };
  add(accent, true);
  add(accent2, true);
  for (const t of [0.3, 0.55]) for (const base of [accent, accent2]) {
    add(mix(base, bg, t));
    add(mix(base, fg, t));
  }
  add(mix(accent, accent2, 0.5));
  add(mix(fg, bg, 0.35));
  add(mix(fg, bg, 0.55));
  if (!pool.length) pool.push(fg);

  const chosen = pool.filter((c) => c === accent || c === accent2).slice(0, k);
  const fixed = Math.max(1, chosen.length);
  const rest = pool.filter((c) => !chosen.includes(c));
  while (chosen.length < k && rest.length) {
    let best = 0;
    let bestD = -1;
    rest.forEach((c, j) => {
      const d = Math.min(...chosen.map((x) => dE(x, c)), chosen.length ? Infinity : 0);
      if (d > bestD) [best, bestD] = [j, d];
    });
    chosen.push(rest.splice(best, 1)[0]);
  }
  for (let j = 0; chosen.length < k; j++) chosen.push(chosen[j]);

  let out = chosen;
  if (k >= 3) {
    const head = chosen.slice(0, Math.min(fixed, k));
    let bestScore = -1;
    for (const p of permutations(chosen.slice(head.length))) {
      const seq = [...head, ...p];
      const score = Math.min(...seq.map((c, i) => dE(c, seq[(i + 1) % k])));
      if (score > bestScore + 0.5) [out, bestScore] = [seq, score];
    }
  }
  if (palettes.size > 100) palettes.clear();
  palettes.set(key, out);
  return out;
}

// ───────────────────────── layout plan ─────────────────────────

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Legend {
  size: number;
  valueSize: number;
  valueW: number;
  swatch: number;
  padX: number;
  gap: number;
  /** Label column width (labels are right-aligned in it). */
  labelW: number;
  /** Inline share bar between label and value: thickness and length (0 = no room, no bar). */
  bar: number;
  barW: number;
  fits: FittedText[];
  /** Row boxes relative to the legend block's top-left corner. */
  boxes: Box[];
  width: number;
  height: number;
  ok: boolean;
}

interface Center {
  numSize: number;
  numAsc: number;
  numH: number;
  gap: number;
  label: FittedText | null;
}

interface Plan {
  segs: Seg[];
  largest: number;
  cx: number;
  cy: number;
  R: number;
  ri: number;
  disc: number;
  ringPad: number;
  legend: Legend | null;
  legendX: number;
  legendY: number;
  legendScale: number;
  center: Center | null;
}

const LABEL_LH = 1.38;

function fitLegend(ctx: Ctx2D, fs: FontSpec, segs: Seg[], colW: number, cols: number, colGap: number, maxLines: number, s: number): Legend {
  const n = segs.length;
  const valueSize = Math.round(s * 1.3);
  ctx.font = font(fs, 'bold', valueSize);
  const valueW = Math.max(0, ...segs.map((g) => (g.value ? ctx.measureText(g.value).width : 0)));
  const swatch = Math.round(clamp(s * 0.62, 13, 22));
  const padX = Math.round(clamp(s * 0.72, 14, 24));
  const gap = Math.round(clamp(s * 0.55, 10, 18));
  // Room for label + bar: everything between the swatch and the value column.
  const room = colW - padX * 2 - swatch - gap - (valueW ? valueW + gap : 0);
  ctx.font = font(fs, 'regular', s);
  const natural = Math.max(0, ...segs.map((g) => ctx.measureText(g.label).width));
  const anyShare = segs.some((g) => g.frac > 0);
  const barMin = Math.max(80, s * 3);
  // Short labels keep their natural width and the bar takes the rest; long labels wrap in up
  // to 58% of the room so a useful bar remains; otherwise the label gets the whole room.
  let labelW = room;
  let barW = 0;
  if (anyShare && room - natural - gap * 2 >= barMin) {
    labelW = Math.ceil(natural);
    barW = room - labelW - gap * 2;
  } else if (anyShare && room * 0.42 - gap * 2 >= barMin) {
    labelW = Math.floor(room * 0.58);
    barW = room - labelW - gap * 2;
  }
  let ok = room >= 70;
  let fits = segs.map((g) => fitText(ctx, fs, g.label, { maxWidth: Math.max(70, labelW), maxLines, maxSize: s, minSize: s, weight: 'regular', lineHeight: LABEL_LH }));
  if (barW && fits.some((f) => f.lines.length > maxLines)) {
    // The bar would force extra lines: give the label the whole room instead.
    labelW = room;
    barW = 0;
    fits = segs.map((g) => fitText(ctx, fs, g.label, { maxWidth: Math.max(70, labelW), maxLines, maxSize: s, minSize: s, weight: 'regular', lineHeight: LABEL_LH }));
  }
  fits.forEach((f) => {
    if (f.lines.length > maxLines || f.width > Math.max(70, labelW) + 0.5) ok = false;
  });
  const bar = barW ? Math.round(clamp(s * 0.3, 7, 11)) : 0;
  const padY = Math.round(s * 0.4);
  const minH = Math.round(s * 2.15);
  const heights = fits.map((f) => Math.max(minH, Math.max(f.height, valueW ? valueSize * 1.2 : 0, swatch) + padY * 2));
  const perCol = Math.max(1, Math.ceil(n / cols));
  const rowH = new Array<number>(perCol).fill(0);
  heights.forEach((h, i) => (rowH[i % perCol] = Math.max(rowH[i % perCol], h)));
  const rowGap = Math.round(clamp(s * 0.44, 8, 14));
  const ys: number[] = [];
  let y = 0;
  rowH.forEach((h) => {
    ys.push(y);
    y += h + rowGap;
  });
  const width = cols * colW + (cols - 1) * colGap;
  // Column-major, first column on the right (reading start).
  const boxes = segs.map((_, i) => {
    const col = Math.floor(i / perCol);
    const r = i % perCol;
    return { x: width - colW - col * (colW + colGap), y: ys[r], w: colW, h: rowH[r] };
  });
  return { size: s, valueSize, valueW, swatch, padX, gap, labelW, bar, barW, fits, boxes, width, height: Math.max(0, y - rowGap), ok };
}

/**
 * Largest legend font that fits `maxLines` and `maxH`; falls back to the minimum size with
 * natural wrapping, which the caller scales down to fit.
 */
function pickLegend(ctx: Ctx2D, fs: FontSpec, segs: Seg[], colW: number, cols: number, colGap: number, sizes: [number, number], maxH: (lg: Legend) => number): Legend {
  for (const maxLines of [2, 3]) {
    for (let s = sizes[0]; s >= sizes[1]; s -= 2) {
      const lg = fitLegend(ctx, fs, segs, colW, cols, colGap, maxLines, s);
      if (lg.ok && lg.height <= maxH(lg)) return lg;
    }
  }
  return fitLegend(ctx, fs, segs, colW, cols, colGap, 99, sizes[1]);
}

function centerFor(ctx: Ctx2D, fs: FontSpec, seg: Seg | undefined, disc: number): Center | null {
  if (!seg || !seg.value) return null;
  const label = seg.label
    ? fitText(ctx, fs, seg.label, { maxWidth: disc * 1.3, maxLines: 2, maxSize: Math.round(clamp(disc * 0.19, 16, 30)), minSize: 14, weight: 'regular', lineHeight: 1.3 })
    : null;
  const gap = label ? disc * 0.07 : 0;
  let size = Math.round(disc * 0.56);
  for (;;) {
    ctx.font = font(fs, 'bold', size);
    const m = ctx.measureText(seg.value);
    const asc = m.actualBoundingBoxAscent || size * 0.74;
    const desc = m.actualBoundingBoxDescent || size * 0.04;
    const numH = asc + desc;
    const block = numH + gap + (label?.height ?? 0);
    if ((m.width <= disc * 1.42 && block <= disc * 1.3) || size <= 18) return { numSize: size, numAsc: asc, numH, gap, label };
    size -= 2;
  }
}

function planFor(ctx: Ctx2D, fs: FontSpec, items: string[], L: Layout, top: number): Plan {
  const { segs, largest } = segmentsOf(items);
  const n = segs.length;
  const side = !L.portrait && !L.square;
  const bottom = L.H - L.M * (L.portrait ? 1 : 0.8);
  const availH = bottom - top;
  const contentW = L.W - L.M * 2;
  const ringPad = 18;
  let R: number;
  let cx: number;
  let cy: number;
  let legend: Legend | null = null;
  let legendX = 0;
  let legendY = 0;
  let legendScale = 1;

  if (!n) {
    R = Math.max(80, Math.min(side ? 200 : 230, availH / 2 - ringPad));
    cx = L.W / 2;
    cy = top + availH / 2;
  } else if (side) {
    R = Math.max(90, Math.min(215, availH / 2 - ringPad));
    cx = L.M + ringPad + R - 6;
    cy = top + availH / 2;
    const left = cx + R + ringPad + 52;
    const colW = L.W - L.M - left;
    legend = pickLegend(ctx, fs, segs, colW, 1, 0, [n <= 3 ? 34 : 30, 18], () => availH);
    legendScale = Math.min(1, availH / Math.max(1, legend.height));
    legendX = left;
    legendY = cy - (legend.height * legendScale) / 2;
  } else {
    const cols = L.square && n >= 4 ? 2 : 1;
    const colGap = 22;
    const colW = cols === 2 ? (contentW - colGap) / 2 : L.square ? Math.min(contentW, 760) : contentW;
    const gapY = L.portrait ? 44 : 40;
    const rMax = L.portrait ? 236 : 226;
    const rPref = L.portrait ? (n <= 3 ? 190 : n === 4 ? 170 : 150) : 170;
    const room = (h: number) => (availH - h - gapY) / 2 - ringPad;
    legend = pickLegend(ctx, fs, segs, colW, cols, colGap, [L.portrait ? 38 : 34, 18], () => availH - gapY - 2 * (rPref + ringPad));
    R = Math.min(rMax, room(legend.height));
    if (R < 125) {
      // Extreme content (very long labels): keep a readable donut and scale the legend to fit.
      R = 125;
      legendScale = clamp((availH - gapY - 2 * (R + ringPad)) / Math.max(1, legend.height), 0.1, 1);
    }
    const block = 2 * (R + ringPad) + gapY + legend.height * legendScale;
    const y0 = top + Math.max(0, (availH - block) / 2);
    cx = L.W / 2;
    cy = y0 + ringPad + R;
    legendX = (L.W - legend.width * legendScale) / 2;
    legendY = y0 + 2 * (R + ringPad) + gapY;
  }
  const ri = R * 0.68;
  const disc = ri - Math.max(7, R * 0.045);
  const center = centerFor(ctx, fs, segs[largest], disc);
  return { segs, largest, cx, cy, R, ri, disc, ringPad, legend, legendX, legendY, legendScale, center };
}

const plans = new Map<string, Plan>();
const PROBE = 'قياس 0123456789 ٠١٢٣٤٥٦٧٨٩ %٪';

/** Layout depends only on content, aspect and font metrics; the probe width invalidates it when a font finishes loading. */
function cachedPlan(ctx: Ctx2D, fs: FontSpec, items: string[], L: Layout, top: number): Plan {
  ctx.font = font(fs, 'bold', 100);
  const probe = ctx.measureText(PROBE).width.toFixed(2);
  const key = `${fs.family}|${fs.bold}|${probe}|${L.W}x${L.H}|${top}|${items.join('\u0001')}`;
  let plan = plans.get(key);
  if (!plan) {
    plan = planFor(ctx, fs, items, L, top);
    if (plans.size > 200) plans.clear();
    plans.set(key, plan);
  }
  return plan;
}

// ───────────────────────── drawing ─────────────────────────

/** Annular sector from a0 to a1 (clockwise) with a parallel-edged gap of `gap` px at both ends. */
function sector(ctx: Ctx2D, cx: number, cy: number, r0: number, r1: number, a0: number, a1: number, gap: number): void {
  const span = a1 - a0;
  if (span <= 0.0005) return;
  const g = Math.min(gap, span * r0 * 0.45);
  const go = g / 2 / r1;
  const gi = g / 2 / r0;
  if (span - 2 * go <= 0.0005) return;
  let i0 = a0 + gi;
  let i1 = a1 - gi;
  if (i1 < i0) i0 = i1 = (a0 + a1) / 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r1, a0 + go, a1 - go);
  ctx.arc(cx, cy, r0, i1, i0, true);
  ctx.closePath();
  ctx.fill();
}

function annulus(ctx: Ctx2D, cx: number, cy: number, r0: number, r1: number): void {
  ctx.beginPath();
  ctx.arc(cx, cy, r1, 0, Math.PI * 2);
  ctx.arc(cx, cy, r0, Math.PI * 2, 0, true);
  ctx.closePath();
  ctx.fill();
}

interface Timing {
  revs: number[];
  sweep: number;
  /** 0→1 (with a slight overshoot) as the largest segment eases out once all are in. */
  pop: number;
  popStart: number;
}

const TOP = -Math.PI / 2;
const TAU = Math.PI * 2;

function drawChart(a: SceneDrawArgs, plan: Plan, colors: (string | null)[], tm: Timing): void {
  const { ctx, theme, frame, scene } = a;
  const { cx, cy, R, ri, disc, segs, largest } = plan;
  const intro = appear(frame, 2, 26);
  if (intro <= 0) return;
  const k = colors.filter(Boolean).length;
  ctx.save();
  const sc = 0.86 + 0.14 * easeOutBack(intro);
  ctx.translate(cx, cy);
  ctx.scale(sc, sc);
  ctx.translate(-cx, -cy);

  withAlpha(ctx, intro, () => {
    // Track and the centre disc.
    ctx.fillStyle = alpha(theme.foreground, 0.07);
    annulus(ctx, cx, cy, ri, R);
    ctx.fillStyle = theme.surface;
    ctx.beginPath();
    ctx.arc(cx, cy, disc, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = alpha(theme.foreground, 0.08);
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  // Slowly orbiting dotted ring: gentle life that never distracts.
  withAlpha(ctx, appear(frame, 10, 30) * 0.9, () => {
    ctx.strokeStyle = alpha(theme.foreground, 0.22);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.setLineDash([0.01, 12]);
    ctx.lineDashOffset = -frame * 0.4;
    ctx.beginPath();
    ctx.arc(cx, cy, R + plan.ringPad - 4, 0, TAU);
    ctx.stroke();
  });

  const gap = k >= 2 ? clamp(R * 0.024, 3, 6) : 0;
  segs.forEach((s, i) => {
    const color = colors[i];
    if (!color || s.frac <= 0) return;
    const t = progress(frame, tm.revs[i], tm.sweep);
    if (t <= 0) return;
    const e = easeOutCubic(t);
    const a0 = TOP + s.start * TAU;
    const full = s.frac * TAU;
    let x = cx;
    let y = cy;
    let r1 = ri + (R - ri) * (0.55 + 0.45 * easeOutBack(t));
    if (i === largest && k >= 2 && tm.pop > 0) {
      const mid = a0 + full / 2;
      // A dominant segment pushed sideways reads as a misaligned ring: it only thickens.
      const off = R * 0.045 * tm.pop * clamp((0.7 - s.frac) / 0.2);
      x += Math.cos(mid) * off;
      y += Math.sin(mid) * off;
      r1 += R * 0.02 * tm.pop;
    }
    ctx.fillStyle = color;
    if (k === 1 && e >= 1) annulus(ctx, x, y, ri, r1);
    else sector(ctx, x, y, ri, r1, a0, a0 + full * Math.min(e, 0.99999), gap);
  });
  ctx.restore();

  // Centre: the scene icon until the largest segment arrives, then its value and label.
  const c = plan.center;
  const ct = c ? progress(frame, tm.revs[largest], 22) : 0;
  const iconA = (1 - clamp(ct * 3)) * appear(frame, 6, 24);
  if (iconA > 0) {
    const ink = c ? alpha(theme.foreground, 0.3) : textInk(theme, theme.accent, theme.surface);
    withAlpha(ctx, iconA, () => drawIcon(ctx, scene.icon, cx, cy, disc * (c ? 0.7 : 0.9) * (0.8 + 0.2 * easeOutBack(intro)), ink, 2));
  }
  if (!c || ct <= 0) return;
  const seg = segs[largest];
  const color = colors[largest] ?? theme.accent;
  const count = easeOutCubic(progress(frame, tm.revs[largest], tm.sweep + 6));
  const top = cy - (c.numH + c.gap + (c.label?.height ?? 0)) / 2;
  withAlpha(ctx, clamp(ct * 1.6 - 0.25), () => {
    const s = 0.7 + 0.3 * easeOutBack(ct);
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.translate(-cx, -cy);
    ctx.font = font(a.font, 'bold', c.numSize);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = textInk(theme, color, theme.surface);
    ctx.fillText(countText(seg, count), cx, top + c.numAsc);
    if (c.label) {
      const lt = easeOutCubic(progress(frame, tm.revs[largest] + 8, 22));
      withAlpha(ctx, lt, () => {
        ctx.fillStyle = alpha(theme.foreground, 0.78);
        ctx.textAlign = 'center';
        drawLines(ctx, a.font, c.label as FittedText, cx, top + c.numH + c.gap + (1 - lt) * 8);
      });
    }
  });
}

/** A segment colour as text on `bg`: itself when it reads at 3:1, otherwise the foreground. */
const textInk = (theme: Required<Theme>, color: string, bg: string): string => (contrast(color, bg) >= 3 ? color : theme.foreground);

function drawLegend(a: SceneDrawArgs, plan: Plan, colors: (string | null)[], tm: Timing): void {
  const { ctx, theme, frame, font: fs } = a;
  const lg = plan.legend;
  if (!lg) return;
  ctx.save();
  ctx.translate(plan.legendX, plan.legendY);
  if (plan.legendScale < 1) ctx.scale(plan.legendScale, plan.legendScale);
  plan.segs.forEach((s, i) => {
    const t = progress(frame, tm.revs[i], 20);
    if (t <= 0) return;
    const e = easeOutCubic(t);
    const b = lg.boxes[i];
    const color = colors[i];
    const hl = i === plan.largest && colors.filter(Boolean).length >= 2 ? clamp(tm.pop) : 0;
    const r = Math.min(18, b.h / 2.6);
    withAlpha(ctx, clamp(t * 1.7), () => {
      ctx.translate((1 - e) * 30, 0);
      card(ctx, theme, b.x, b.y, b.w, b.h, r, hl > 0 && color ? mix(theme.surface, color, 0.1 * hl) : theme.surface);
      if (hl > 0 && color) {
        withAlpha(ctx, hl, () => {
          ctx.strokeStyle = color;
          ctx.lineWidth = 2.5;
          roundRect(ctx, b.x + 1.25, b.y + 1.25, b.w - 2.5, b.h - 2.5, r - 1);
          ctx.stroke();
        });
      }
      const midY = b.y + b.h / 2;
      const sx = b.x + b.w - lg.padX - lg.swatch / 2;
      const f = lg.fits[i];
      const swY = f.lines.length > 1 ? midY - f.height / 2 + f.lineHeight / 2 : midY;
      const ss = lg.swatch * easeOutBack(progress(frame, tm.revs[i] + 2, 18));
      if (ss > 0) {
        if (color) {
          ctx.fillStyle = color;
          roundRect(ctx, sx - ss / 2, swY - ss / 2, ss, ss, ss * 0.3);
          ctx.fill();
        } else {
          ctx.strokeStyle = alpha(theme.foreground, 0.4);
          ctx.lineWidth = 2;
          roundRect(ctx, sx - ss / 2 + 1, swY - ss / 2 + 1, ss - 2, ss - 2, ss * 0.3);
          ctx.stroke();
        }
      }
      const labelRight = sx - lg.swatch / 2 - lg.gap;
      if (f.lines.length) {
        ctx.fillStyle = theme.foreground;
        ctx.textAlign = 'right';
        drawLines(ctx, fs, f, labelRight, midY - f.height / 2);
      }
      const grow = easeOutCubic(progress(frame, tm.revs[i], tm.sweep + 6));
      if (lg.barW) {
        // Share of the whole (normalised like the angles), growing from the right with the segment.
        const right = labelRight - lg.labelW - lg.gap;
        const by = midY - lg.bar / 2;
        ctx.fillStyle = alpha(theme.foreground, 0.13);
        roundRect(ctx, right - lg.barW, by, lg.barW, lg.bar, lg.bar / 2);
        ctx.fill();
        const w = lg.barW * s.frac * grow;
        if (color && w > 0.5) {
          ctx.fillStyle = color;
          roundRect(ctx, right - Math.max(w, lg.bar), by, Math.max(w, lg.bar), lg.bar, lg.bar / 2);
          ctx.fill();
        }
      }
      if (s.value) {
        ctx.font = font(fs, 'bold', lg.valueSize);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = s.frac > 0 ? theme.foreground : alpha(theme.foreground, 0.55);
        ctx.fillText(countText(s, grow), b.x + lg.padX, midY + lg.valueSize * 0.04);
        ctx.textBaseline = 'alphabetic';
      }
    });
  });
  ctx.restore();
}

export function drawDonut(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const top = drawHeader(a);
  const plan = cachedPlan(ctx, fs, scene.items.slice(0, 6), L, top);
  const n = plan.segs.length;
  const revs = plan.segs.map((_, i) => itemReveal(scene, i, n));
  const last = n ? revs[n - 1] : 0;
  // ~24-frame sweeps; compressed only when the last cue sits near the end of a short scene.
  const sweep = Math.round(clamp(scene.durationFrames - 10 - last, 10, 24));
  const popStart = last + sweep + 6;
  const tm: Timing = { revs, sweep, popStart, pop: easeOutBack(progress(frame, popStart, 22)) };
  const palette = paletteFor(theme, plan.segs.filter((s) => s.frac > 0).length);
  let j = 0;
  const colors = plan.segs.map((s) => (s.frac > 0 ? palette[j++] : null));
  drawChart(a, plan, colors, tm);
  drawLegend(a, plan, colors, tm);
}
