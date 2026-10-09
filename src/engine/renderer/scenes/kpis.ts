import { suggestIcon } from '../../../design/icons';
import { alpha, contrast, mix, textAccent } from '../../../design/presets';
import { kpiParts } from '../../sceneModel';
import { KPIS, itemReveal, shownItems } from '../../timing';
import { clamp, easeOutBack, easeOutCubic, progress } from '../animation';
import { font, type Ctx2D, type FontSpec } from '../context';
import { drawIcon } from '../icons';
import { card, drawHeader, iconBadge, roundRect, withAlpha, type Layout, type SceneDrawArgs } from '../kit';
import { formatStatValue, parseStatValue, type StatValue } from '../numbers';
import { drawLines, fitText, type FittedText } from '../textLayout';

/**
 * أرقام سريعة — a grid of KPI tiles. Each tile pops in at its cue (itemReveal), its number counts
 * up over KPIS.countLength frames, and its label sits below (tall tiles) or beside it (wide tiles).
 * Numbers keep the source digit system and thousands separator; magnitude words such as «مليار»
 * stay with the number while other unit words lead the label («250» + «لترًا للفرد يوميًا»).
 */

// ───────────────────────── content model ─────────────────────────

interface Tile {
  /** Null for an item without a number: the tile shows its icon and label only. */
  stat: StatValue | null;
  /** Magnitude word drawn smaller with the number (مليار، مليون، ألف…). */
  mag: string;
  label: string;
  /** Thousands separator used by the source ("1,200"), re-applied while counting. */
  sep: string;
  icon: string;
}

const MAGNITUDE = /^(?:ألف|الف|ألفًا|ألفا|آلاف|الاف|مليون|ملايين|مليار|مليارات|بليون|تريليون|ترليون|k|K|M|B|bn|mn)$/u;
const DIGIT_RUN = /[0-9٠-٩]+/u;
const GROUP = /(?<=[0-9٠-٩])(?=(?:[0-9٠-٩]{3})+$)/gu;

function parseTile(item: string, fallbackIcon: string): Tile {
  const { value, label } = kpiParts(item);
  const icon = suggestIcon(item, fallbackIcon);
  const stat = value ? parseStatValue(value) : null;
  if (!stat) return { stat: null, mag: '', label: label || item.trim(), sep: '', icon };
  const suffix = stat.suffix.trim();
  const pct = suffix === '%' || suffix === '٪';
  let mag = '';
  let text = label;
  if (suffix && !pct) {
    if (MAGNITUDE.test(suffix)) mag = suffix;
    else text = `${suffix} ${label}`.trim();
  }
  const sep = /[0-9٠-٩]([,،٬])[0-9٠-٩]{3}/u.exec(value)?.[1] ?? '';
  return { stat: { ...stat, prefix: stat.prefix.trim(), suffix: pct ? suffix : '' }, mag, label: text, sep, icon };
}

/** The tile's number at `v`, in the source's digit system, decimals and grouping. */
function numberText(t: Tile, v: number): string {
  if (!t.stat) return '';
  const s = formatStatValue(t.stat, v);
  return t.sep ? s.replace(DIGIT_RUN, (d) => d.replace(GROUP, t.sep)) : s;
}

// ───────────────────────── layout plan ─────────────────────────

/** Magnitude word beside the number: size and gap relative to the number size. */
const MAG_INLINE = 0.42;
const MAG_GAP = 0.14;
/** Magnitude word as a caption under the number (narrow tiles): size and gap. */
const MAG_BELOW = 0.34;
const MAG_BELOW_GAP = 0.1;

interface Slot {
  x: number;
  y: number;
  w: number;
  h: number;
  /** 0 → accent, 1 → accent2 (checkerboard across the grid). */
  tone: 0 | 1;
  row: number;
}

interface Metrics {
  /** Per tile at 100px: the final number alone, number + inline magnitude word, the caption-size word. */
  num100: number[];
  inline100: number[];
  below100: number[];
  ascR: number;
  descR: number;
  magAscR: number;
  magDescR: number;
  anyMag: boolean;
}

interface Plan {
  style: 'stack' | 'row';
  tiles: Tile[];
  slots: Slot[];
  labels: (FittedText | null)[];
  numSize: number;
  magSize: number;
  magBelow: boolean;
  /** Number baseline → caption baseline, and the caption's extra height (magBelow). */
  magDrop: number;
  magLineH: number;
  /** Ascent of the digits and height of the number line (with inline magnitude word). */
  asc: number;
  numBlock: number;
  /** Small icon radius (0 = no small icons). */
  iconR: number;
  /** Uniform content scale when even the minimum sizes overflow (very long labels). */
  scale: number;
  // stack geometry, offsets from the tile top; content is centred per grid row so numbers align
  iconBlock: number;
  rowTop: number[];
  barAbove: number;
  barBlock: number;
  barW: number;
  // row geometry, offsets from the tile's right edge
  iconRight: number;
  numRight: number;
  numColW: number;
  divider: number;
  labelRight: number;
  innerH: number;
}

/** Tiles per row, top row first; partial rows are centred. */
function rowCounts(n: number, L: Layout): number[] {
  if (n <= 1) return [Math.max(n, 1)];
  if (L.portrait) return [[1, 1], [1, 1, 1], [2, 2], [2, 2, 1], [2, 2, 2]][n - 2];
  if (L.square) return [[2], [2, 1], [2, 2], [3, 2], [3, 3]][n - 2];
  return [[2], [3], [2, 2], [3, 2], [3, 3]][n - 2];
}

function numberMetrics(ctx: Ctx2D, fs: FontSpec, tiles: Tile[]): Metrics {
  const m: Metrics = { num100: [], inline100: [], below100: [], ascR: 0.72, descR: 0.02, magAscR: 0, magDescR: 0, anyMag: false };
  tiles.forEach((t) => {
    if (!t.stat) {
      m.num100.push(0);
      m.inline100.push(0);
      m.below100.push(0);
      return;
    }
    ctx.font = font(fs, 'bold', 100);
    const nm = ctx.measureText(numberText(t, t.stat.value));
    m.ascR = Math.max(m.ascR, (nm.actualBoundingBoxAscent || 72) / 100);
    m.descR = Math.max(m.descR, (nm.actualBoundingBoxDescent || 0) / 100);
    let magW = 0;
    if (t.mag) {
      ctx.font = font(fs, 'bold', 100);
      const mm = ctx.measureText(t.mag);
      magW = mm.width;
      m.magAscR = Math.max(m.magAscR, (mm.actualBoundingBoxAscent || 70) / 100);
      m.magDescR = Math.max(m.magDescR, (mm.actualBoundingBoxDescent || 30) / 100);
      m.anyMag = true;
    }
    m.num100.push(nm.width);
    m.inline100.push(nm.width + (magW ? 100 * MAG_GAP + magW * MAG_INLINE : 0));
    m.below100.push(Math.max(nm.width, magW * MAG_BELOW));
  });
  return m;
}

/** Number-line height and the caption line, both per unit of number size. */
function numberHeights(met: Metrics, below: boolean): { block: number; caption: number } {
  if (below) return { block: met.ascR + met.descR, caption: met.anyMag ? MAG_BELOW_GAP + MAG_BELOW * (met.magAscR + met.magDescR) : 0 };
  return { block: met.ascR + Math.max(met.descR, met.anyMag ? met.magDescR * MAG_INLINE : 0), caption: 0 };
}

function fitLabels(ctx: Ctx2D, fs: FontSpec, tiles: Tile[], maxWidth: number, size: number, maxLines: number): { fits: (FittedText | null)[]; ok: boolean; h: number } {
  let ok = true;
  let h = 0;
  const fits = tiles.map((t) => {
    if (!t.label) return null;
    const f = fitText(ctx, fs, t.label, { maxWidth, maxLines, maxSize: size, minSize: size, weight: 'regular', lineHeight: 1.42 });
    if (f.lines.length > maxLines) ok = false;
    h = Math.max(h, f.height);
    return f;
  });
  return { fits, ok, h };
}

const widestOf = (a: number[]): number => Math.max(0, ...a);

function planFor(ctx: Ctx2D, fs: FontSpec, items: string[], icon: string, L: Layout, top: number): Plan {
  const tiles = items.map((it) => parseTile(it, icon));
  const n = tiles.length;
  const counts = rowCounts(n, L);
  const rows = counts.length;
  const cols = Math.max(...counts);
  const gap = L.portrait ? 22 : 26;
  const availW = L.W - L.M * 2;
  const availH = L.H - top - L.M * 0.8;
  let w = (availW - gap * (cols - 1)) / cols;
  if (n === 1) w = Math.min(availW, L.portrait ? availW : 640);
  const hMax = (availH - gap * (rows - 1)) / rows;
  let h = n === 1 ? Math.min(hMax, 420) : Math.min(hMax, w * (L.portrait ? 1.5 : 1.15), L.portrait ? 520 : 460);
  const style: Plan['style'] = w / h >= 1.8 ? 'row' : 'stack';
  if (style === 'row') h = Math.min(hMax, Math.max(w * 0.42, 150), 280);

  // Grid slots: first item top-right, partial rows centred.
  const slots: Slot[] = [];
  const gridH = rows * h + (rows - 1) * gap;
  let y = top + Math.max(0, (availH - gridH) / 2);
  let k = 0;
  counts.forEach((c, r) => {
    const rowW = c * w + (c - 1) * gap;
    const right = (L.W + rowW) / 2;
    for (let j = 0; j < c && k < n; j++, k++) slots.push({ x: right - w - j * (w + gap), y, w, h, tone: ((r + j) % 2) as 0 | 1, row: r });
    y += h + gap;
  });

  const met = numberMetrics(ctx, fs, tiles);
  const anyNum = tiles.some((t) => t.stat);
  const labelMin = 17;
  const plan: Plan = {
    style, tiles, slots, labels: [], numSize: 0, magSize: 0, magBelow: false, magDrop: 0, magLineH: 0, asc: 0, numBlock: 0,
    iconR: 0, scale: 1, iconBlock: 0, rowTop: [], barAbove: 0, barBlock: 0, barW: 0,
    iconRight: 0, numRight: 0, numColW: 0, divider: 0, labelRight: 0, innerH: 0,
  };

  if (style === 'stack') {
    const padX = clamp(w * 0.08, 18, 36);
    const padY = clamp(h * 0.085, 18, 40);
    const innerW = w - padX * 2;
    const innerH = h - padY * 2 - 4;
    const iconR = anyNum && h >= 280 ? clamp(Math.min(w, h) * 0.09, 22, 36) : 0;
    const iconBlock = iconR ? iconR * 2 + clamp(h * 0.05, 12, 24) : 0;
    const barAbove = anyNum ? clamp(h * 0.045, 12, 22) : 0;
    const barBlock = anyNum ? barAbove + 6 + clamp(h * 0.04, 10, 20) : 0;
    const maxLines = h >= 280 ? 3 : 2;
    const labelMax = Math.round(clamp(Math.min(w * 0.11, h * 0.13), 24, 40));
    const numMax = Math.min(160, h * 0.4);

    const attempt = (below: boolean) => {
      const hs = numberHeights(met, below);
      const widest = widestOf(below ? met.below100 : met.inline100);
      const want = Math.min(numMax, widest > 0 ? (100 * innerW) / widest : numMax);
      let pick = fitLabels(ctx, fs, tiles, innerW, labelMin, maxLines);
      let size = 0;
      for (let ls = labelMax; ls >= labelMin; ls -= 2) {
        const f = fitLabels(ctx, fs, tiles, innerW, ls, maxLines);
        pick = f;
        size = Math.min(want, (innerH - iconBlock - barBlock - f.h) / (hs.block + hs.caption));
        if (f.ok && size >= want * 0.82) break;
      }
      return { below, hs, pick, size: Math.max(size, 30) };
    };
    const inline = attempt(false);
    const below = met.anyMag ? attempt(true) : inline;
    const best = below.size > inline.size * 1.12 ? below : inline;

    const contentH = iconBlock + best.size * (best.hs.block + best.hs.caption) + barBlock + best.pick.h;
    plan.scale = Math.min(1, innerH / contentH);
    plan.rowTop = counts.map((_, r) => {
      const inRow = tiles.filter((_, j) => slots[j].row === r);
      const caption = best.below && inRow.some((t) => t.stat && t.mag) ? best.hs.caption : 0;
      const labelH = Math.max(0, ...best.pick.fits.filter((_, j) => slots[j].row === r).map((f) => f?.height ?? 0));
      const rowH = iconBlock + best.size * (best.hs.block + caption) + barBlock + labelH;
      // Centred even when too tall: drawStackTile then scales it about the tile centre to fit.
      return padY + 4 + (innerH - rowH) / 2;
    });
    plan.labels = best.pick.fits;
    plan.numSize = best.size;
    plan.magBelow = best.below;
    plan.numBlock = best.size * best.hs.block;
    plan.magLineH = best.size * best.hs.caption;
    plan.iconR = iconR;
    plan.iconBlock = iconBlock;
    plan.barAbove = barAbove;
    plan.barBlock = barBlock;
    plan.barW = clamp(w * 0.14, 34, 64);
  } else {
    const strip = 8;
    const padX = clamp(w * 0.045, 18, 28);
    const padY = clamp(h * 0.12, 14, 26);
    const innerH = h - padY * 2;
    const iconR = anyNum && w >= 470 ? clamp(h * 0.16, 20, 32) : 0;
    plan.iconR = iconR;
    plan.iconRight = strip + padX + iconR;
    plan.numRight = strip + padX + (iconR ? iconR * 2 + 20 : 0);
    const avail = w - plan.numRight - padX;
    const sizeFor = (below: boolean) => {
      const hs = numberHeights(met, below);
      const widest = widestOf(below ? met.below100 : met.inline100);
      return Math.min(110, h * 0.42, innerH / (hs.block + hs.caption), widest > 0 ? (100 * avail * 0.42) / widest : 110);
    };
    const inlineSize = sizeFor(false);
    const magBelow = met.anyMag && sizeFor(true) > inlineSize * 1.12;
    const numSize = magBelow ? sizeFor(true) : inlineSize;
    const hs = numberHeights(met, magBelow);
    plan.magBelow = magBelow;
    plan.numSize = numSize;
    plan.numBlock = numSize * hs.block;
    plan.magLineH = numSize * hs.caption;
    const bigR = Math.min(innerH * 0.36, 34);
    plan.numColW = Math.max((widestOf(magBelow ? met.below100 : met.inline100) * numSize) / 100, tiles.some((t) => !t.stat) ? bigR * 2 : 0);
    const divGap = clamp(w * 0.035, 16, 26);
    plan.divider = plan.numRight + plan.numColW + divGap;
    plan.labelRight = plan.divider + divGap;
    const labelW = Math.max(80, w - plan.labelRight - padX);
    const maxLines = h >= 200 ? 3 : 2;
    const labelMax = Math.round(clamp(h * 0.15, 24, 36));
    let pick = fitLabels(ctx, fs, tiles, labelW, labelMin, maxLines);
    for (let ls = labelMax; ls >= labelMin; ls -= 2) {
      const f = fitLabels(ctx, fs, tiles, labelW, ls, maxLines);
      pick = f;
      if (f.ok && f.h <= innerH) break;
    }
    plan.labels = pick.fits;
    plan.innerH = innerH;
    plan.scale = Math.min(1, innerH / Math.max(1, pick.h));
  }
  plan.asc = plan.numSize * met.ascR;
  plan.magSize = plan.numSize * (plan.magBelow ? MAG_BELOW : MAG_INLINE);
  plan.magDrop = plan.numSize * (met.descR + MAG_BELOW_GAP + MAG_BELOW * met.magAscR);
  return plan;
}

const plans = new Map<string, Plan>();
const PROBE = 'قياس 0123456789 ٠١٢٣٤٥٦٧٨٩ مليار';

/** Layout depends only on content, aspect and font metrics; the probe width invalidates it when a font finishes loading. */
function cachedPlan(ctx: Ctx2D, fs: FontSpec, items: string[], icon: string, L: Layout, top: number): Plan {
  ctx.font = font(fs, 'bold', 100);
  const probe = ctx.measureText(PROBE).width.toFixed(2);
  const key = `${fs.family}|${fs.bold}|${probe}|${L.W}x${L.H}|${top}|${icon}|${items.join('\u0001')}`;
  let plan = plans.get(key);
  if (!plan) {
    plan = planFor(ctx, fs, items, icon, L, top);
    if (plans.size > 200) plans.clear();
    plans.set(key, plan);
  }
  return plan;
}

// ───────────────────────── drawing ─────────────────────────

/** Number with its magnitude word (beside it or as a caption below), anchored at x. */
function drawNumber(ctx: Ctx2D, fs: FontSpec, plan: Plan, t: Tile, text: string, x: number, baseline: number, align: 'center' | 'right', ink: string, magInk: string): void {
  ctx.textBaseline = 'alphabetic';
  ctx.font = font(fs, 'bold', plan.numSize);
  if (t.mag && !plan.magBelow) {
    // RTL reading order: number first (right), magnitude word to its left.
    const nw = ctx.measureText(text).width;
    const gap = plan.numSize * MAG_GAP;
    ctx.font = font(fs, 'bold', plan.magSize);
    const mw = ctx.measureText(t.mag).width;
    const right = align === 'center' ? x + (nw + gap + mw) / 2 : x;
    ctx.textAlign = 'right';
    ctx.fillStyle = magInk;
    ctx.fillText(t.mag, right - nw - gap, baseline);
    ctx.font = font(fs, 'bold', plan.numSize);
    ctx.fillStyle = ink;
    ctx.fillText(text, right, baseline);
    return;
  }
  ctx.textAlign = align;
  ctx.fillStyle = ink;
  ctx.fillText(text, x, baseline);
  if (t.mag) {
    ctx.font = font(fs, 'bold', plan.magSize);
    ctx.fillStyle = magInk;
    ctx.fillText(t.mag, x, baseline + plan.magDrop);
  }
}

/** A soft diagonal sheen crossing the tile now and then once its counter has finished. */
function sheen(ctx: Ctx2D, s: Slot, frame: number, start: number, light: boolean): void {
  const local = frame - start;
  if (local < 0) return;
  const p = (local % 150) / 42;
  if (p >= 1) return;
  const x = s.x + s.w + s.h * 0.5 - easeOutCubic(p) * (s.w + s.h * 2);
  const grad = ctx.createLinearGradient(x - 70, s.y, x + 70, s.y + s.h * 0.4);
  const peak = (light ? 0.5 : 0.06) * Math.sin(Math.PI * p);
  grad.addColorStop(0, alpha('#FFFFFF', 0));
  grad.addColorStop(0.5, alpha('#FFFFFF', peak));
  grad.addColorStop(1, alpha('#FFFFFF', 0));
  ctx.fillStyle = grad;
  ctx.fillRect(s.x, s.y, s.w, s.h);
}

/** Expanding ring around the icon as the counter lands. */
function landingRing(ctx: Ctx2D, color: string, x: number, y: number, r: number, p: number): void {
  if (p <= 0 || p >= 1) return;
  withAlpha(ctx, (1 - p) * 0.55, () => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r * (1 + p * 0.9), 0, Math.PI * 2);
    ctx.stroke();
  });
}

interface TileCtx {
  a: SceneDrawArgs;
  plan: Plan;
  t: Tile;
  s: Slot;
  i: number;
  rev: number;
  color: string;
  ink: string;
  cx: number;
  cy: number;
}

interface Motion {
  iconT: number;
  bump: number;
  ring: number;
  text: string;
  magInk: string;
  labelT: number;
}

function motionOf(c: TileCtx): Motion {
  const { frame } = c.a;
  const done = c.rev + KPIS.countLength;
  const count = easeOutCubic(progress(frame, c.rev, KPIS.countLength));
  return {
    iconT: progress(frame, c.rev + 4, 22),
    bump: 1 + 0.07 * Math.sin(Math.PI * progress(frame, done - 6, 16)),
    ring: progress(frame, done - 2, 24),
    text: c.t.stat ? numberText(c.t, c.t.stat.value * count) : '',
    magInk: alpha(c.ink, 0.82),
    labelT: easeOutCubic(progress(frame, c.rev + 8, 22)),
  };
}

/** Tall tile: icon, number, accent bar and label stacked and centred; numbers align across tiles. */
function drawStackTile(c: TileCtx): void {
  const { a, plan, t, s, i, cx, cy, color, ink } = c;
  const { ctx, theme, font: fs, frame } = a;
  const m = motionOf(c);
  if (plan.scale < 1) {
    ctx.translate(cx, cy + 2);
    ctx.scale(plan.scale, plan.scale);
    ctx.translate(-cx, -cy - 2);
  }
  const rowTop = s.y + plan.rowTop[s.row];
  const numTop = rowTop + plan.iconBlock;
  const numCy = numTop + plan.numBlock / 2;
  let below = numTop + plan.numBlock;
  if (t.stat) {
    if (plan.iconR) {
      const icy = rowTop + plan.iconR;
      landingRing(ctx, color, cx, icy, plan.iconR, m.ring);
      iconBadge(ctx, theme, t.icon, cx, icy, plan.iconR * easeOutBack(m.iconT), color);
    }
    ctx.save();
    ctx.translate(cx, numCy);
    ctx.scale(m.bump, m.bump);
    ctx.translate(-cx, -numCy);
    drawNumber(ctx, fs, plan, t, m.text, cx, numTop + plan.asc, 'center', ink, m.magInk);
    ctx.restore();
    if (t.mag && plan.magBelow) below += plan.magLineH;
    const bw = plan.barW * easeOutCubic(progress(frame, c.rev + 8, 34));
    ctx.fillStyle = color;
    roundRect(ctx, cx - bw / 2, below + plan.barAbove, bw, 6, 3);
    ctx.fill();
  } else {
    // No number: the item's icon takes the number's place.
    const r = Math.min(plan.numBlock * 0.55, s.w * 0.2);
    iconBadge(ctx, theme, t.icon, cx, numCy, r * easeOutBack(m.iconT), color);
  }
  const f = plan.labels[i];
  if (!f) return;
  withAlpha(ctx, m.labelT, () => {
    ctx.fillStyle = theme.foreground;
    ctx.textAlign = 'center';
    drawLines(ctx, fs, f, cx, below + plan.barBlock + (1 - m.labelT) * 12);
  });
}

/** Wide tile: icon and number on the right (reading start), a divider, the label to the left. */
function drawRowTile(c: TileCtx): void {
  const { a, plan, t, s, i, cy, color, ink } = c;
  const { ctx, theme, font: fs, frame } = a;
  const m = motionOf(c);
  const right = s.x + s.w;
  if (t.stat) {
    if (plan.iconR) {
      const icx = right - plan.iconRight;
      landingRing(ctx, color, icx, cy, plan.iconR, m.ring);
      iconBadge(ctx, theme, t.icon, icx, cy, plan.iconR * easeOutBack(m.iconT), color);
    }
    const nx = right - plan.numRight;
    const blockH = plan.numBlock + (t.mag && plan.magBelow ? plan.magLineH : 0);
    ctx.save();
    ctx.translate(nx, cy);
    ctx.scale(m.bump, m.bump);
    ctx.translate(-nx, -cy);
    drawNumber(ctx, fs, plan, t, m.text, nx, cy - blockH / 2 + plan.asc, 'right', ink, m.magInk);
    ctx.restore();
  } else {
    const r = Math.min(plan.numColW / 2, plan.innerH * 0.36, 34);
    iconBadge(ctx, theme, t.icon, right - plan.numRight - plan.numColW / 2, cy, r * easeOutBack(m.iconT), color);
  }
  const dh = plan.innerH * 0.72 * easeOutCubic(progress(frame, c.rev + 6, 30));
  ctx.fillStyle = alpha(theme.foreground, 0.14);
  roundRect(ctx, right - plan.divider - 1.5, cy - dh / 2, 3, dh, 1.5);
  ctx.fill();
  const f = plan.labels[i];
  if (!f) return;
  withAlpha(ctx, m.labelT, () => {
    const lx = right - plan.labelRight;
    if (plan.scale < 1) {
      ctx.translate(lx, cy);
      ctx.scale(plan.scale, plan.scale);
      ctx.translate(-lx, -cy);
    }
    ctx.fillStyle = theme.foreground;
    ctx.textAlign = 'right';
    drawLines(ctx, fs, f, lx - (1 - m.labelT) * 16, cy - f.height / 2);
  });
}

export function drawKpis(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const top = drawHeader(a);
  const items = shownItems(scene);
  const n = items.length;
  if (!n) return;
  const plan = cachedPlan(ctx, fs, items, scene.icon, L, top);
  const lightSurface = contrast(theme.surface, '#FFFFFF') < 1.6;
  const radius = plan.style === 'row' ? 20 : 24;

  plan.tiles.forEach((t, i) => {
    const s = plan.slots[i];
    const rev = itemReveal(scene, i, n);
    const tp = progress(frame, rev, 24);
    if (tp <= 0) return;
    const sc = 0.78 + 0.22 * easeOutBack(tp);
    const color = s.tone ? theme.accent2 : theme.accent;
    const other = s.tone ? theme.accent : theme.accent2;
    const c: TileCtx = { a, plan, t, s, i, rev, color, ink: textAccent(theme, color), cx: s.x + s.w / 2, cy: s.y + s.h / 2 };

    withAlpha(ctx, clamp(tp * 1.8), () => {
      ctx.translate(c.cx, c.cy + (1 - easeOutCubic(tp)) * 26);
      ctx.scale(sc, sc);
      ctx.translate(-c.cx, -c.cy);
      card(ctx, theme, s.x, s.y, s.w, s.h, radius);

      // Decorations clipped to the card: watermark icon, accent strip, sheen.
      ctx.save();
      roundRect(ctx, s.x, s.y, s.w, s.h, radius);
      ctx.clip();
      const wm = alpha(c.ink, lightSurface ? 0.05 : 0.06);
      if (plan.style === 'stack') {
        const sz = Math.min(s.w, s.h) * 0.62;
        drawIcon(ctx, t.icon, s.x + sz * 0.3, s.y + s.h - sz * 0.28, sz, wm, 1.6);
      } else drawIcon(ctx, t.icon, s.x + s.h * 0.32, s.y + s.h * 0.62, s.h * 0.95, wm, 1.6);
      const grad = plan.style === 'stack' ? ctx.createLinearGradient(s.x + s.w, 0, s.x, 0) : ctx.createLinearGradient(0, s.y, 0, s.y + s.h);
      grad.addColorStop(0, color);
      grad.addColorStop(1, mix(color, other, 0.35));
      ctx.fillStyle = grad;
      if (plan.style === 'stack') ctx.fillRect(s.x, s.y, s.w, 8);
      else ctx.fillRect(s.x + s.w - 8, s.y, 8, s.h);
      sheen(ctx, s, frame, rev + KPIS.countLength + 10 + i * 9, lightSurface);
      ctx.restore();

      if (plan.style === 'stack') drawStackTile(c);
      else drawRowTile(c);
    });
  });
}
