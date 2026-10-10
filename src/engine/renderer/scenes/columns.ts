import { alpha, contrast, mix, textAccent } from '../../../design/presets';
import { chartRows, type ValueRow } from '../../sceneModel';
import { itemReveal } from '../../timing';
import { clamp, easeOutCubic, progress } from '../animation';
import { font, type Ctx2D, type FontSpec } from '../context';
import { drawHeader, roundRect, withAlpha, type Layout, type SceneDrawArgs } from '../kit';
import { formatStatValue, parseStatValue, type StatValue } from '../numbers';
import { drawLines, fitText, type FittedText } from '../textLayout';

/**
 * أعمدة رأسية — vertical column chart. Items read "label: value"; the first item is the rightmost
 * column (RTL). Column i grows from the baseline at its cue (itemReveal) while its value counts up
 * above it; labels sit under the baseline. The tallest column is drawn in the accent colour inside
 * a soft highlight lane, the others in accent2.
 */

/** Frames a column takes to grow to its height (the value counts up over the same window). */
const GROW = 30;

/** Growth length for a column cued at `rev`: shortened in very short scenes so it lands before the cut. */
const growFor = (durationFrames: number, rev: number): number => clamp(durationFrames - 8 - rev, 8, GROW);
const DIGIT_RUN = /[0-9٠-٩]+/u;
const GROUP = /(?<=[0-9٠-٩])(?=(?:[0-9٠-٩]{3})+$)/gu;

interface Col {
  row: ValueRow;
  /** Height value: the parsed display value when there is one ("1,250" → 1250). */
  num: number;
  stat: StatValue | null;
  /** Thousands separator used by the source ("1,200"), re-applied while counting. */
  sep: string;
}

interface Plan {
  cols: Col[];
  scale: number;
  tallest: number;
  slotW: number;
  colW: number;
  /** Plot box: the tallest column reaches plotTop, all columns stand on baseY. */
  plotTop: number;
  baseY: number;
  valueSize: number;
  valueGap: number;
  labels: (FittedText | null)[];
  labelTop: number;
  /** Per-label shrink for labels that overflow their block even at the minimum size. */
  labelScales: number[];
  gridLeft: number;
  gridRight: number;
}

function valueText(c: Col, v: number): string {
  if (!c.stat) return c.row.value;
  const s = formatStatValue(c.stat, v);
  return c.sep ? s.replace(DIGIT_RUN, (d) => d.replace(GROUP, c.sep)) : s;
}

function planFor(ctx: Ctx2D, fs: FontSpec, rows: ValueRow[], L: Layout, top: number): Plan {
  const n = rows.length;
  const cols: Col[] = rows.map((row) => {
    const stat = row.value ? parseStatValue(row.value) : null;
    const num = Math.max(0, stat?.value ?? row.num);
    return { row, num: Number.isFinite(num) ? num : 0, stat, sep: /[0-9٠-٩]([,،٬])[0-9٠-٩]{3}/u.exec(row.value)?.[1] ?? '' };
  });
  const max = Math.max(0, ...cols.map((c) => c.num));
  const allPercent = rows.length > 0 && rows.every((r) => /[%٪]/.test(r.value));
  const scale = allPercent && max <= 100 && max >= 40 ? 100 : max > 0 ? max : 1;
  const tallest = max > 0 ? cols.findIndex((c) => c.num === max) : -1;

  const contentW = L.W - L.M * 2;
  const slotW = contentW / Math.max(1, n);
  const colMax = L.portrait ? 120 : L.square ? 150 : 140;
  const colW = Math.min(colMax * (n <= 2 ? 1.25 : 1), slotW * (n >= 5 ? 0.64 : 0.56));
  /** Type scale: the square canvas is larger than the landscape one at the same density. */
  const k = L.square ? 1.14 : 1;
  const bySize = (sizes: number[]) => Math.round(sizes[Math.min(n, 6) - 1] * k);

  // Labels: one shared size so the row under the baseline reads as a single line of type. A label
  // that only fits far below the others (a very long item) shrinks on its own instead of
  // dragging every label down with it.
  const labelW = Math.min(slotW - (n >= 5 ? 10 : 24), L.portrait ? 300 : 340);
  const labelMax = bySize(L.portrait ? [38, 36, 34, 32, 28, 26] : [36, 34, 33, 31, 30, 28]);
  const labelMin = 15;
  const fit = (label: string, maxSize: number, minSize: number, maxLines: number) =>
    fitText(ctx, fs, label, { maxWidth: labelW, maxLines, maxSize, minSize, weight: 'bold', lineHeight: 1.32 });
  const best = cols.map((c) => (c.row.label ? fit(c.row.label, labelMax, labelMin, 2) : null));
  const sizes = best.filter((f): f is FittedText => !!f && f.lines.length <= 2).map((f) => f.fontSize);
  const typical = sizes.filter((v) => v >= labelMax * 0.7);
  const shared = Math.min(labelMax, ...(typical.length ? typical : sizes.length ? sizes : [labelMin]));
  const labels = cols.map((c) => {
    if (!c.row.label) return null;
    const f = fit(c.row.label, shared, labelMin, 2);
    if (f.lines.length <= 2 && f.fontSize >= shared * 0.85) return f;
    // A third line keeps a long label close to the shared size before it shrinks further.
    const three = fit(c.row.label, shared, Math.max(labelMin, Math.round(shared * 0.8)), 3);
    if (three.lines.length <= 3) return three;
    return fit(c.row.label, shared, 14, 4);
  });
  const labelH = Math.max(0, ...labels.map((f) => f?.height ?? 0));

  // Value size from the widest final value, bounded by the slot width.
  const finals = cols.map((c) => valueText(c, c.stat?.value ?? 0));
  ctx.font = font(fs, 'bold', 100);
  const widest = Math.max(1, ...finals.map((t) => ctx.measureText(t).width));
  const valueMax = bySize(L.portrait ? [60, 56, 52, 48, 44, 40] : [60, 56, 52, 46, 40, 36]);
  const valueSize = clamp(Math.min(valueMax, ((slotW - 12) * 100) / widest), 16, valueMax);
  const valueGap = valueSize * 0.45 + 8;

  const bottom = L.H - (L.portrait ? L.M * 1.3 : L.M * 0.7);
  const avail = bottom - top;
  const labelGap = L.portrait ? 22 : 18;
  const labelCap = Math.min(labelH, avail * 0.28);
  const labelScales = labels.map((f) => (f ? Math.min(1, labelCap / Math.max(1, f.height), labelW / Math.max(1, f.width)) : 1));
  const labelBlock = labelGap + labelCap;
  const valueBlock = valueSize * 1.1 + valueGap;
  let plotH = avail - labelBlock - valueBlock;
  const plotMax = L.portrait ? 680 : L.square ? 660 : 440;
  let pad = 0;
  if (plotH > plotMax) {
    pad = (plotH - plotMax) / 2;
    plotH = plotMax;
  }
  const plotTop = top + pad + valueBlock;
  const baseY = plotTop + plotH;
  return {
    cols, scale, tallest, slotW, colW, plotTop, baseY, valueSize, valueGap,
    labels, labelTop: baseY + labelGap, labelScales, gridLeft: L.M, gridRight: L.W - L.M,
  };
}

const plans = new Map<string, Plan>();
const PROBE = 'قياس 0123456789 ٠١٢٣٤٥٦٧٨٩';

/** Layout depends only on content, aspect and font metrics; the probe width invalidates it when a font finishes loading. */
function cachedPlan(ctx: Ctx2D, fs: FontSpec, rows: ValueRow[], L: Layout, top: number): Plan {
  ctx.font = font(fs, 'bold', 100);
  const probe = ctx.measureText(PROBE).width.toFixed(2);
  const key = `${fs.family}|${fs.bold}|${probe}|${L.W}x${L.H}|${top}|${rows.map((r) => `${r.label}\u0002${r.value}`).join('\u0001')}`;
  let plan = plans.get(key);
  if (!plan) {
    plan = planFor(ctx, fs, rows, L, top);
    if (plans.size > 200) plans.clear();
    plans.set(key, plan);
  }
  return plan;
}

/** Column with rounded top corners standing on the baseline. */
function column(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, [rr, rr, 0, 0]);
}

export function drawColumns(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const top = drawHeader(a);
  const rows = chartRows(scene);
  const n = rows.length;
  if (!n) return;
  const p = cachedPlan(ctx, fs, rows, L, top);
  const plotH = p.baseY - p.plotTop;
  const lightBg = contrast(theme.background, '#FFFFFF') < 2;
  const first = itemReveal(scene, 0, n);
  const lastRev = itemReveal(scene, n - 1, n);
  const lastLand = lastRev + growFor(scene.durationFrames, lastRev);
  const centerX = (i: number) => L.W - L.M - p.slotW * (i + 0.5);

  // Gridlines (quarters of the scale) and the baseline sweep in from the right before the first column.
  const gridT = easeOutCubic(progress(frame, Math.max(0, first - 14), 26));
  if (gridT > 0) {
    const span = p.gridRight - p.gridLeft;
    ctx.fillStyle = alpha(theme.foreground, lightBg ? 0.09 : 0.08);
    for (let k = 1; k <= 4; k++) {
      const y = p.baseY - (plotH * k) / 4;
      const w = span * easeOutCubic(progress(frame, Math.max(0, first - 14) + k * 3, 26));
      if (w > 0) ctx.fillRect(p.gridRight - w, y - 1, w, 2);
    }
    // Highlight lane behind the tallest column once every column has landed.
    if (p.tallest >= 0 && n > 1) {
      const laneT = easeOutCubic(progress(frame, lastLand, 24));
      if (laneT > 0) {
        const cx = centerX(p.tallest);
        const lw = Math.min(p.slotW - 6, p.colW + 36);
        const ly = p.plotTop - p.valueGap - p.valueSize * 1.1 - 12;
        const grad = ctx.createLinearGradient(0, ly, 0, p.baseY);
        grad.addColorStop(0, alpha(theme.accent, 0));
        grad.addColorStop(0.35, alpha(theme.accent, 0.1 * laneT));
        grad.addColorStop(1, alpha(theme.accent, 0.16 * laneT));
        ctx.fillStyle = grad;
        roundRect(ctx, cx - lw / 2, ly, lw, p.baseY - ly, 16);
        ctx.fill();
      }
    }
  }

  const radius = clamp(p.colW * 0.16, 6, 16);
  p.cols.forEach((c, i) => {
    const rev = itemReveal(scene, i, n);
    if (frame < rev) return;
    const grow = growFor(scene.durationFrames, rev);
    const t = progress(frame, rev, grow);
    const e = easeOutCubic(t);
    const cx = centerX(i);
    const hi = i === p.tallest;
    const color = hi ? theme.accent : theme.accent2;
    const other = hi ? theme.accent2 : theme.accent;
    const fullH = (plotH * clamp(c.num / p.scale, 0, 1));
    const h = Math.max(fullH * e, 0);
    const x = cx - p.colW / 2;

    // Faint track showing the full scale behind the column.
    withAlpha(ctx, clamp(t * 3), () => {
      ctx.fillStyle = alpha(theme.foreground, lightBg ? 0.045 : 0.05);
      column(ctx, x, p.plotTop, p.colW, plotH, radius);
      ctx.fill();
    });

    // The column itself (a flat stub for a zero/missing value so its slot still reads).
    const drawnH = Math.max(h, 5 * clamp(t * 4));
    if (drawnH > 0) {
      const y = p.baseY - drawnH;
      const grad = ctx.createLinearGradient(0, y, 0, p.baseY);
      grad.addColorStop(0, color);
      grad.addColorStop(1, mix(color, other, 0.3));
      ctx.fillStyle = h > 0 ? grad : alpha(color, 0.6);
      column(ctx, x, y, p.colW, drawnH, radius);
      ctx.fill();
      // Lighter cap along the top edge gives the flat column some depth.
      if (drawnH > radius * 2) {
        ctx.save();
        column(ctx, x, y, p.colW, drawnH, radius);
        ctx.clip();
        ctx.fillStyle = alpha('#FFFFFF', 0.14);
        ctx.fillRect(x, y, p.colW, Math.min(7, drawnH * 0.2));
        // Periodic shimmer rising through the tallest column once everything has landed.
        if (hi) {
          const local = frame - lastLand - 20;
          if (local >= 0) {
            const sp = (local % 140) / 50;
            if (sp < 1) {
              const sy = p.baseY - easeOutCubic(sp) * (drawnH + 80);
              const sg = ctx.createLinearGradient(0, sy - 50, 0, sy + 50);
              const peak = 0.28 * Math.sin(Math.PI * sp);
              sg.addColorStop(0, alpha('#FFFFFF', 0));
              sg.addColorStop(0.5, alpha('#FFFFFF', peak));
              sg.addColorStop(1, alpha('#FFFFFF', 0));
              ctx.fillStyle = sg;
              ctx.fillRect(x, sy - 50, p.colW, 100);
            }
          }
        }
        ctx.restore();
      }
    }

    // Value counting up, riding on the column top; a small pop when it lands.
    if (!c.row.value) {
      // No number in the item: a quiet dash marks the missing value instead of inventing one.
      withAlpha(ctx, clamp(t * 4) * 0.5, () => {
        ctx.font = font(fs, 'bold', p.valueSize * 0.8);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = theme.foreground;
        ctx.fillText('—', cx, p.baseY - 5 - p.valueGap);
      });
    }
    const shown = c.stat ? valueText(c, c.stat.value * e) : c.row.value;
    if (shown) {
      const pop = 1 + 0.12 * Math.sin(Math.PI * progress(frame, rev + grow - 4, 14));
      const vy = p.baseY - h - p.valueGap;
      withAlpha(ctx, clamp(t * 4), () => {
        ctx.translate(cx, vy);
        ctx.scale(pop, pop);
        ctx.font = font(fs, 'bold', p.valueSize);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = hi ? textAccent(theme, theme.accent) : theme.foreground;
        ctx.fillText(shown, 0, 0);
      });
    }

    // Label under the baseline.
    const f = p.labels[i];
    if (f) {
      const lt = easeOutCubic(progress(frame, rev, 20));
      withAlpha(ctx, lt, () => {
        const ly = p.labelTop + (1 - lt) * 14;
        const ls = p.labelScales[i];
        if (ls < 1) {
          ctx.translate(cx, ly);
          ctx.scale(ls, ls);
          ctx.translate(-cx, -ly);
        }
        ctx.fillStyle = hi ? theme.foreground : alpha(theme.foreground, 0.86);
        ctx.textAlign = 'center';
        drawLines(ctx, fs, f, cx, ly);
      });
    }
  });

  // Baseline drawn last so it crisply cuts the column feet.
  if (gridT > 0) {
    const w = (p.gridRight - p.gridLeft) * gridT;
    ctx.fillStyle = alpha(theme.foreground, 0.4);
    roundRect(ctx, p.gridRight - w, p.baseY - 1.5, w, 3, 1.5);
    ctx.fill();
  }
}
