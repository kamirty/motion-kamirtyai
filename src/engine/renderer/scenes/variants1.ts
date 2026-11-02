import { localizeDigits } from '../../../design/digits';
import { alpha, mix, readableOn, textAccent } from '../../../design/presets';
import { effectiveItemIcons } from '../../itemIcons';
import { comparisonBars, kpiParts, shownItems, toNumber } from '../../sceneModel';
import { itemReveal } from '../../timing';
import { clamp, easeInOutCubic, easeOutBack, easeOutCubic, progress } from '../animation';
import { font } from '../context';
import { drawIcon } from '../icons';
import { appear, card, drawHeader, iconBadge, itemEnter, roundRect, withAlpha, type SceneDrawArgs } from '../kit';
import { drawLines, fitText } from '../textLayout';
import { palette, parts } from './extra2';
import { drawItem, fitItem, gridBoxes, lastRevealed, numberDisc } from './extra3';

/**
 * Alternative layouts («أشكال») for the most used kinds, so the same kind looks different from
 * one scene or video to the next. Each reads the same content and uses the same reveal times as
 * the kind's main drawer, so sound effects, tap-to-sync and hints stay valid.
 */

const reveal = (a: SceneDrawArgs, i: number, n: number) => itemReveal(a.scene, i, n);

/** Rows of a list: one column, or two when there are many items on a wide frame. */
function listRows(a: SceneDrawArgs, top: number, n: number, maxH = 120, gap = 16) {
  const { layout: L } = a;
  const cols = !L.portrait && n > 3 ? 2 : 1;
  const rows = Math.ceil(n / cols);
  const availH = L.H - top - L.M * 0.6;
  const w = (L.W - L.M * 2 - gap * (cols - 1)) / cols;
  const h = Math.min(maxH, (availH - gap * (rows - 1)) / rows);
  const y0 = top + Math.max(0, (availH - (rows * h + gap * (rows - 1))) / 2);
  return Array.from({ length: n }, (_, i) => {
    const col = cols === 2 ? Math.floor(i / rows) : 0;
    const row = cols === 2 ? i % rows : i;
    return { x: L.W - L.M - (col + 1) * w - col * gap, y: y0 + row * (h + gap), w, h };
  });
}

/** بطاقات — قائمة: rows slide in from the right, each with its icon disc and a growing accent bar. */
export function drawSummaryList(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame } = a;
  const top = drawHeader(a);
  const items = shownItems(scene);
  const n = items.length;
  if (!n) return;
  const icons = effectiveItemIcons(scene);
  const colors = palette(theme);
  listRows(a, top, n).forEach((b, i) => {
    const t = progress(frame, reveal(a, i, n), 22);
    if (t <= 0) return;
    const e = easeOutCubic(t);
    const color = colors[i % colors.length];
    itemEnter(a, t, b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, () => withAlpha(ctx, e, () => {
      ctx.save();
      ctx.translate((1 - e) * 120, 0);
      card(ctx, theme, b.x, b.y, b.w, b.h, b.h / 2);
      ctx.fillStyle = color;
      roundRect(ctx, b.x + 10, b.y + b.h * 0.25, 8, b.h * 0.5 * easeOutCubic(progress(frame, reveal(a, i, n) + 8, 20)), 4);
      ctx.fill();
      const r = Math.min(b.h * 0.34, 34);
      iconBadge(ctx, theme, icons[i] ?? scene.icon, b.x + b.w - b.h / 2, b.y + b.h / 2, r, color);
      const f = fitItem(a, items[i], b.w - b.h - 50, 28, 20, 2, 1);
      ctx.textAlign = 'right';
      ctx.fillStyle = theme.foreground;
      const tx = b.x + b.w - b.h - 6;
      const yy = drawLines(ctx, a.font, f.hf, tx, b.y + b.h / 2 - f.height / 2);
      if (f.bf) {
        ctx.fillStyle = alpha(theme.foreground, 0.75);
        drawLines(ctx, a.font, f.bf, tx, yy + 6);
      }
      ctx.restore();
    }));
  });
}

/** Dots under a one-at-a-time layout; the current one is wider. */
function pagerDots(a: SceneDrawArgs, n: number, k: number, y: number): void {
  const { ctx, theme, layout: L, frame } = a;
  if (n < 2) return;
  const gap = 26;
  const x0 = L.W / 2 + ((n - 1) * gap) / 2;
  withAlpha(ctx, appear(frame, 6, 16), () => {
    for (let i = 0; i < n; i++) {
      const on = i === k;
      ctx.fillStyle = on ? theme.accent : alpha(theme.foreground, i < k ? 0.55 : 0.25);
      roundRect(ctx, x0 - i * gap - (on ? 14 : 5), y - 5, on ? 28 : 10, 10, 5);
      ctx.fill();
    }
  });
}

/** بطاقات — بطاقة تتبدّل: one large card at a time; each new fact slides in as the last leaves. */
export function drawSummaryCarousel(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L } = a;
  const top = drawHeader(a);
  const items = shownItems(scene);
  const n = items.length;
  if (!n) return;
  const icons = effectiveItemIcons(scene);
  const colors = palette(theme);
  const k = lastRevealed(a, n);
  const availH = L.H - top - L.M * 0.6 - 40;
  const w = Math.min(L.W - L.M * 2, L.portrait ? L.W - L.M * 2 : 760);
  const h = Math.min(availH, L.portrait ? 520 : 380);
  const x = L.W / 2 - w / 2;
  const y = top + (availH - h) / 2;
  const slide = (i: number, out: number, inn: number) => {
    const color = colors[i % colors.length];
    // In from the left (next in reading order), out to the right.
    const dx = (1 - easeOutCubic(inn)) * -w * 0.6 + easeInOutCubic(out) * w * 0.6;
    const al = Math.min(easeOutCubic(inn), 1 - out);
    if (al <= 0) return;
    withAlpha(ctx, al, () => {
      ctx.save();
      ctx.translate(dx, 0);
      card(ctx, theme, x, y, w, h, 34, mix(theme.surface, color, 0.12));
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      roundRect(ctx, x, y, w, h, 34);
      ctx.stroke();
      const r = Math.min(h * 0.16, 54);
      iconBadge(ctx, theme, icons[i] ?? scene.icon, L.W / 2, y + r + 34, r, color);
      const f = fitItem(a, items[i], w - 80, L.portrait ? 44 : 46, 26, 3, 3);
      drawItem(a, f, L.W / 2, y + r * 2 + 64 + Math.max(0, (h - r * 2 - 90 - f.height) / 2 - 20), textAccent(theme, color));
      numberDisc(a, i + 1, x + w - 34, y + 34, 16, color);
      ctx.restore();
    });
  };
  if (k >= 0) {
    const inn = progress(frame, reveal(a, k, n), 22);
    if (k > 0 && inn < 1) slide(k - 1, inn, 1);
    slide(k, 0, inn);
  }
  pagerDots(a, n, k, y + h + 30);
}

/** Chevron path pointing left (reading direction) or down. */
function chevron(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, x: number, y: number, w: number, h: number, down: boolean, first: boolean): void {
  const tip = down ? Math.min(28, h * 0.3) : Math.min(30, w * 0.18);
  ctx.beginPath();
  if (down) {
    ctx.moveTo(x, y);
    if (!first) ctx.lineTo(x + w / 2, y + tip);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w / 2, y + h + tip);
    ctx.lineTo(x, y + h);
  } else {
    ctx.moveTo(x + w, y);
    if (!first) ctx.lineTo(x + w - tip, y + h / 2);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + tip, y + h);
    ctx.lineTo(x, y + h / 2);
    ctx.lineTo(x + tip, y);
  }
  ctx.closePath();
}

/** خطوات — أسهم: a ribbon of arrow-shaped steps pointing the way (down on portrait). */
export function drawStepsChevrons(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L } = a;
  const top = drawHeader(a);
  const items = shownItems(scene);
  const n = items.length;
  if (!n) return;
  const colors = palette(theme);
  const down = L.portrait;
  const availH = L.H - top - L.M * 0.6;
  const gap = down ? 20 : 8;
  const w = down ? L.W - L.M * 2 : (L.W - L.M * 2 - gap * (n - 1) - 30) / n;
  const h = down ? Math.min(150, (availH - gap * (n - 1) - 30) / n) : Math.min(availH * 0.7, 300);
  const y0 = down ? top + Math.max(0, (availH - (h + gap) * n) / 2) : top + (availH - h) / 2;
  items.forEach((it, i) => {
    const t = progress(frame, reveal(a, i, n), 20);
    if (t <= 0) return;
    const x = down ? L.M : L.W - L.M - 15 - (i + 1) * w - i * gap;
    const y = down ? y0 + i * (h + gap) : y0;
    const color = colors[i % colors.length];
    const e = easeOutBack(t);
    itemEnter(a, t, x + w / 2, y + h / 2, w, h, () => withAlpha(ctx, clamp(t * 2), () => {
      ctx.save();
      ctx.translate(x + w / 2, y + h / 2);
      if (down) ctx.scale(1, 0.4 + 0.6 * e);
      else ctx.scale(0.4 + 0.6 * e, 1);
      ctx.translate(-(x + w / 2), -(y + h / 2));
      chevron(ctx as CanvasRenderingContext2D, x, y, w, h, down, i === 0);
      ctx.fillStyle = mix(color, theme.surface, 0.35);
      ctx.fill();
      const fg = readableOn(mix(color, theme.surface, 0.35));
      ctx.fillStyle = fg;
      ctx.font = font(a.font, 'bold', Math.min(46, (down ? h : w) * 0.28));
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const numY = down ? y + h / 2 : y + h * 0.24;
      const numX = down ? x + w - 50 : x + w / 2;
      ctx.fillText(localizeDigits(String(i + 1), a.digits), numX, numY);
      ctx.textBaseline = 'alphabetic';
      const f = fitItem(a, it, down ? w - 140 : w - 50, 24, 18, 3, down ? 1 : 3);
      if (down) {
        ctx.textAlign = 'right';
        const yy = drawLines(ctx, a.font, f.hf, x + w - 96, y + h / 2 - f.height / 2);
        if (f.bf) drawLines(ctx, a.font, f.bf, x + w - 96, yy + 6);
      } else drawItem(a, f, x + w / 2, y + h * 0.42, fg);
      ctx.restore();
    }));
  });
}

/** خطوات — أرقام كبيرة: large outlined numbers that fill in, each with its step beside it. */
export function drawStepsBigNumbers(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame } = a;
  const top = drawHeader(a);
  const items = shownItems(scene);
  const n = items.length;
  if (!n) return;
  const colors = palette(theme);
  listRows(a, top, n, 150, 20).forEach((b, i) => {
    const t = progress(frame, reveal(a, i, n), 24);
    if (t <= 0) return;
    const color = colors[i % colors.length];
    const numW = Math.min(b.h * 1.1, 130);
    itemEnter(a, t, b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, () => {
      const size = Math.min(b.h * 0.95, 120);
      ctx.font = font(a.font, 'bold', size);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = localizeDigits(String(i + 1), a.digits);
      const nx = b.x + b.w - numW / 2;
      const ny = b.y + b.h / 2;
      ctx.lineWidth = 3;
      ctx.strokeStyle = alpha(color, easeOutCubic(t));
      ctx.strokeText(label, nx, ny);
      const fill = progress(frame, reveal(a, i, n) + 10, 18);
      if (fill > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(nx - numW / 2, ny + size / 2 - size * fill, numW, size * fill);
        ctx.clip();
        ctx.fillStyle = color;
        ctx.fillText(label, nx, ny);
        ctx.restore();
      }
      ctx.textBaseline = 'alphabetic';
      withAlpha(ctx, easeOutCubic(progress(frame, reveal(a, i, n), 18)), () => {
        const f = fitItem(a, items[i], b.w - numW - 30, 28, 20, 2, 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = theme.foreground;
        const tx = b.x + b.w - numW - 18;
        const yy = drawLines(ctx, a.font, f.hf, tx, ny - f.height / 2);
        if (f.bf) {
          ctx.fillStyle = alpha(theme.foreground, 0.75);
          drawLines(ctx, a.font, f.bf, tx, yy + 6);
        }
        ctx.fillStyle = alpha(color, 0.5);
        ctx.fillRect(b.x, b.y + b.h - 2, (b.w - numW) * easeOutCubic(progress(frame, reveal(a, i, n) + 10, 24)), 2);
      });
    });
  });
}

/** The value with its number counted up to `p` (keeps the unit and the digits' style). */
export function counted(value: string, p: number): string {
  const n = toNumber(value);
  if (n === null) return value;
  const m = /[0-9٠-٩]+(?:[.,٫][0-9٠-٩]+)?/u.exec(value);
  if (!m) return value;
  const decimals = (m[0].split(/[.,٫]/)[1] ?? '').length;
  const v = (n * p).toFixed(decimals);
  return value.slice(0, m.index) + v + value.slice(m.index + m[0].length);
}

/** أرقام سريعة — رقم يتبدّل: one big counter at a time with a ring, the next replacing it. */
export function drawKpisSpotlight(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs, digits } = a;
  const top = drawHeader(a);
  const items = shownItems(scene);
  const n = items.length;
  if (!n) return;
  const colors = palette(theme);
  const k = lastRevealed(a, n);
  const availH = L.H - top - L.M * 0.6 - 40;
  const cy = top + availH * 0.46;
  const R = Math.min(availH * 0.36, L.W * 0.3, 190);
  const show = (i: number, out: number, inn: number) => {
    const { value, label } = kpiParts(items[i]);
    const color = colors[i % colors.length];
    const al = Math.min(easeOutCubic(inn), 1 - out);
    if (al <= 0) return;
    withAlpha(ctx, al, () => {
      ctx.save();
      ctx.translate(0, (1 - easeOutCubic(inn)) * 60 - easeInOutCubic(out) * 60);
      const p = easeOutCubic(progress(frame, reveal(a, i, n), 50));
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.strokeStyle = alpha(theme.foreground, 0.1);
      ctx.beginPath();
      ctx.arc(L.W / 2, cy, R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.arc(L.W / 2, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
      ctx.stroke();
      ctx.fillStyle = textAccent(theme, color);
      const shown = localizeDigits(value ? counted(value, p) : '', digits);
      const vf = fitText(ctx, fs, shown || ' ', { maxWidth: R * 1.6, maxLines: 1, maxSize: R * 0.55, minSize: 24, weight: 'bold', lineHeight: 1.1 });
      ctx.textAlign = 'center';
      drawLines(ctx, fs, vf, L.W / 2, cy - vf.height / 2);
      const lf = fitText(ctx, fs, label || items[i], { maxWidth: Math.min(L.W - L.M * 2, 700), maxLines: 2, maxSize: 32, minSize: 16, weight: 'bold', lineHeight: 1.35 });
      ctx.fillStyle = theme.foreground;
      drawLines(ctx, fs, lf, L.W / 2, cy + R + 30);
      ctx.restore();
    });
  };
  if (k >= 0) {
    const inn = progress(frame, reveal(a, k, n), 20);
    if (k > 0 && inn < 1) show(k - 1, inn, 1);
    show(k, 0, inn);
  }
  pagerDots(a, n, k, L.H - L.M * 0.6 - 10);
}

/** أرقام سريعة — فقاعات: numbers in bubbles of different sizes that pop in and drift. */
export function drawKpisBubbles(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs, digits } = a;
  const top = drawHeader(a);
  const items = shownItems(scene);
  const n = items.length;
  if (!n) return;
  const colors = palette(theme);
  const availH = L.H - top - L.M * 0.6;
  const boxes = gridBoxes(L, top, n, availH / Math.ceil(n / (L.portrait ? 2 : 3)), 10);
  boxes.forEach((b, i) => {
    const t = progress(frame, reveal(a, i, n), 24);
    if (t <= 0) return;
    const { value, label } = kpiParts(items[i]);
    const color = colors[i % colors.length];
    const size = [1, 0.82, 0.92, 0.78, 0.88, 0.8][i % 6];
    const R = Math.min(b.w, b.h) * 0.46 * size * easeOutBack(t);
    const cx = b.x + b.w / 2 + Math.sin(frame / 40 + i * 2) * 6;
    const cy = b.y + b.h / 2 + Math.cos(frame / 47 + i) * 6;
    if (R <= 0) return;
    withAlpha(ctx, clamp(t * 2), () => {
      const g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.35, R * 0.1, cx, cy, R);
      g.addColorStop(0, mix(color, '#ffffff', 0.25));
      g.addColorStop(1, mix(color, theme.background, 0.35));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = alpha('#ffffff', 0.18);
      ctx.beginPath();
      ctx.ellipse(cx - R * 0.35, cy - R * 0.45, R * 0.28, R * 0.14, -0.6, 0, Math.PI * 2);
      ctx.fill();
      const fg = readableOn(mix(color, theme.background, 0.2));
      const p = easeOutCubic(progress(frame, reveal(a, i, n), 45));
      const vf = fitText(ctx, fs, localizeDigits(value ? counted(value, p) : '•', digits), { maxWidth: R * 1.5, maxLines: 1, maxSize: R * 0.6, minSize: 14, weight: 'bold', lineHeight: 1.1 });
      const lf = fitText(ctx, fs, label || (value ? ' ' : items[i]), { maxWidth: R * 1.55, maxLines: 2, maxSize: Math.max(15, R * 0.26), minSize: 12, weight: 'bold', lineHeight: 1.3 });
      ctx.fillStyle = fg;
      ctx.textAlign = 'center';
      const hh = vf.height + lf.height + 4;
      const yy = drawLines(ctx, fs, vf, cx, cy - hh / 2);
      drawLines(ctx, fs, lf, cx, yy + 4);
    });
  });
}

/** قائمة تحقق — بلاطات: tiles that flip over to their ticked side one by one. */
export function drawChecklistTiles(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L } = a;
  const top = drawHeader(a);
  const items = shownItems(scene);
  const n = items.length;
  if (!n) return;
  const colors = palette(theme);
  gridBoxes(L, top, n, 200).forEach((b, i) => {
    const r = reveal(a, i, n);
    const show = appear(frame, 4 + i * 4, 16);
    if (show <= 0) return;
    const flip = progress(frame, r, 18);
    const ticked = flip >= 0.5;
    const sx = Math.max(0.02, Math.abs(Math.cos(flip * Math.PI)));
    const color = colors[i % colors.length];
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    itemEnter(a, 1, cx, cy, b.w, b.h, () => withAlpha(ctx, show * (ticked || flip > 0 ? 1 : 0.6), () => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(sx, 1);
      ctx.translate(-cx, -cy);
      card(ctx, theme, b.x, b.y, b.w, b.h, 22, ticked ? mix(theme.surface, color, 0.28) : theme.surface);
      if (ticked) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        roundRect(ctx, b.x, b.y, b.w, b.h, 22);
        ctx.stroke();
      }
      const box = 34;
      const bx = b.x + b.w - box - 18;
      const by = b.y + 18;
      ctx.strokeStyle = ticked ? color : alpha(theme.foreground, 0.4);
      ctx.lineWidth = 3;
      roundRect(ctx, bx, by, box, box, 8);
      ctx.stroke();
      if (ticked) {
        ctx.fillStyle = color;
        roundRect(ctx, bx, by, box, box, 8);
        ctx.fill();
        drawIcon(ctx, 'check', bx + box / 2, by + box / 2, 24, readableOn(color), 3, easeOutCubic(progress(frame, r + 9, 12)));
      }
      const f = fitItem(a, items[i], b.w - 40, 26, 19, 3, 2);
      drawItem(a, f, cx, Math.max(by + box + 10, cy - f.height / 2 + 12), ticked ? theme.foreground : alpha(theme.foreground, 0.7));
      ctx.restore();
    }));
  });
}

/** مقارنة — شاشة مقسومة: full-height panels, one per side, with a VS badge between them. */
export function drawComparisonSplit(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L } = a;
  const top = drawHeader(a);
  const items = shownItems(scene).slice(0, 3);
  const n = items.length;
  if (!n) return;
  const colors = [theme.accent, theme.accent2, mix(theme.accent, theme.foreground, 0.4)];
  const icons = effectiveItemIcons(scene);
  const vertical = L.portrait;
  const availH = L.H - top - L.M * 0.4;
  const gap = 14;
  const pw = vertical ? L.W - L.M : (L.W - L.M - gap * (n - 1)) / n;
  const ph = vertical ? (availH - gap * (n - 1)) / n : availH;
  items.forEach((it, i) => {
    const t = progress(frame, reveal(a, i, n), 24);
    if (t <= 0) return;
    const x = vertical ? L.M / 2 : L.W - L.M / 2 - (i + 1) * pw - i * gap;
    const y = vertical ? top + i * (ph + gap) : top;
    const color = colors[i];
    const e = easeOutCubic(t);
    const { head, body } = parts(it);
    itemEnter(a, t, x + pw / 2, y + ph / 2, pw, ph, () => withAlpha(ctx, e, () => {
      ctx.save();
      ctx.translate(0, (1 - e) * (i % 2 ? -1 : 1) * 80);
      const g = ctx.createLinearGradient(0, y, 0, y + ph);
      g.addColorStop(0, mix(theme.surface, color, 0.38));
      g.addColorStop(1, mix(theme.surface, color, 0.08));
      ctx.fillStyle = g;
      roundRect(ctx, x, y, pw, ph, 28);
      ctx.fill();
      const r = Math.min(46, ph * 0.16, pw * 0.14);
      iconBadge(ctx, theme, icons[i] ?? scene.icon, x + pw / 2, y + r + 26, r, color);
      const hf = fitText(ctx, a.font, head, { maxWidth: pw - 50, maxLines: 2, maxSize: 40, minSize: 18, weight: 'bold', lineHeight: 1.3 });
      const bf = body ? fitText(ctx, a.font, body, { maxWidth: pw - 60, maxLines: vertical ? 2 : 5, maxSize: 30, minSize: 16, weight: 'regular', lineHeight: 1.45 }) : null;
      drawItem(a, { hf, bf }, x + pw / 2, y + r * 2 + 44, textAccent(theme, color));
      ctx.restore();
    }));
  });
  // VS badge(s) between the panels.
  const vt = easeOutBack(progress(frame, reveal(a, Math.min(1, n - 1), n) + 8, 20));
  if (n > 1 && vt > 0) {
    for (let i = 0; i < n - 1; i++) {
      const cx = vertical ? L.W / 2 : L.W - L.M / 2 - (i + 1) * pw - i * gap - gap / 2;
      const cy = vertical ? top + (i + 1) * ph + i * gap + gap / 2 : top + availH / 2;
      ctx.fillStyle = theme.foreground;
      ctx.beginPath();
      ctx.arc(cx, cy, 30 * vt, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = theme.background;
      ctx.font = font(a.font, 'bold', 22 * vt);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('VS', cx, cy + 1);
      ctx.textBaseline = 'alphabetic';
    }
  }
}
export const comparisonSplitApplies = (scene: SceneDrawArgs['scene']) => !comparisonBars(scene);

/** خط زمني — بطاقات السنوات: a card per event with its year large on top, linked by a path. */
export function drawTimelineCards(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const top = drawHeader(a);
  const items = shownItems(scene).map((it) => {
    const m = /^(.{1,24}?)\s*[:：\-–—]\s*(.+)$/u.exec(it);
    return m ? { when: m[1].trim(), what: m[2].trim() } : { when: '', what: it };
  });
  const n = items.length;
  if (!n) return;
  const colors = palette(theme);
  const boxes = gridBoxes(L, top + 20, n, 240, 26);
  // Path through the card tops, drawn as the cards arrive.
  const last = lastRevealed(a, n);
  if (last > 0) {
    ctx.strokeStyle = alpha(theme.accent, 0.6);
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 10]);
    ctx.lineDashOffset = -frame;
    ctx.beginPath();
    boxes.slice(0, last + 1).forEach((b, i) => (i ? ctx.lineTo(b.x + b.w / 2, b.y) : ctx.moveTo(b.x + b.w / 2, b.y)));
    ctx.stroke();
    ctx.setLineDash([]);
  }
  items.forEach((it, i) => {
    const t = progress(frame, reveal(a, i, n), 24);
    if (t <= 0) return;
    const b = boxes[i];
    const color = colors[i % colors.length];
    itemEnter(a, t, b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, () => withAlpha(ctx, easeOutCubic(t), () => {
      card(ctx, theme, b.x, b.y, b.w, b.h, 22);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(b.x + b.w / 2, b.y, 12 * easeOutBack(t), 0, Math.PI * 2);
      ctx.fill();
      const yf = fitText(ctx, fs, localizeDigits(it.when || String(i + 1), a.digits), { maxWidth: b.w - 30, maxLines: 1, maxSize: 52, minSize: 20, weight: 'bold', lineHeight: 1.15 });
      ctx.fillStyle = textAccent(theme, color);
      ctx.textAlign = 'center';
      const yy = drawLines(ctx, fs, yf, b.x + b.w / 2, b.y + 22);
      const wf = fitText(ctx, fs, it.what, { maxWidth: b.w - 34, maxLines: 4, maxSize: 24, minSize: 13, weight: 'bold', lineHeight: 1.4 });
      ctx.fillStyle = theme.foreground;
      drawLines(ctx, fs, wf, b.x + b.w / 2, yy + 10);
    }));
  });
}

/** اقتباس — في المنتصف: the quote centred in a framed card between two large marks. */
export function drawQuoteCentered(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const w = Math.min(L.W - L.M * 2, 920);
  const qf = fitText(ctx, fs, scene.title || ' ', { maxWidth: w - 120, maxLines: L.portrait ? 7 : 4, maxSize: L.portrait ? 52 : 54, minSize: 24, weight: 'bold', lineHeight: 1.5 });
  const by = scene.items[0];
  const h = qf.height + 140 + (by ? 50 : 0);
  const x = L.W / 2 - w / 2;
  const y = L.H / 2 - h / 2;
  const t = easeOutCubic(progress(frame, 4, 26));
  withAlpha(ctx, t, () => {
    ctx.save();
    ctx.translate(L.W / 2, L.H / 2);
    ctx.scale(0.92 + 0.08 * t, 0.92 + 0.08 * t);
    ctx.translate(-L.W / 2, -L.H / 2);
    card(ctx, theme, x, y, w, h, 36, mix(theme.surface, theme.accent, 0.08));
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, theme.accent);
    g.addColorStop(1, theme.accent2);
    ctx.strokeStyle = g;
    ctx.lineWidth = 4;
    roundRect(ctx, x, y, w, h, 36);
    ctx.stroke();
    ctx.restore();
  });
  // Big marks at the opening (right) and closing (left) corners.
  const mk = easeOutBack(progress(frame, 12, 22));
  if (mk > 0) {
    ctx.font = font(fs, 'bold', 170 * mk);
    ctx.fillStyle = alpha(theme.accent, 0.85);
    ctx.textAlign = 'center';
    ctx.fillText('”', x + w - 30, y + 80);
    ctx.fillText('“', x + 30, y + h + 70);
  }
  // Lines rise in one after another.
  ctx.font = font(fs, qf.weight, qf.fontSize);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  qf.lines.forEach((line, i) => {
    const lt = progress(frame, 18 + i * 10, 20);
    if (lt <= 0) return;
    withAlpha(ctx, easeOutCubic(lt), () => {
      ctx.fillStyle = theme.foreground;
      ctx.fillText(line, L.W / 2, y + 70 + qf.lineHeight * (i + 0.5) + (1 - easeOutCubic(lt)) * 20);
    });
  });
  ctx.textBaseline = 'alphabetic';
  if (by) {
    const bt = appear(frame, 26 + qf.lines.length * 10, 22);
    withAlpha(ctx, bt, () => {
      const bf = fitText(ctx, fs, by, { maxWidth: w - 200, maxLines: 1, maxSize: 28, minSize: 16, weight: 'bold', lineHeight: 1.2 });
      const yy = y + 70 + qf.height + 34;
      ctx.fillStyle = textAccent(theme, theme.accent);
      ctx.textAlign = 'center';
      drawLines(ctx, fs, bf, L.W / 2, yy);
      ctx.fillStyle = theme.accent;
      const lw = 50 * bt;
      ctx.fillRect(L.W / 2 + bf.width / 2 + 16, yy + bf.height / 2 - 1.5, lw, 3);
      ctx.fillRect(L.W / 2 - bf.width / 2 - 16 - lw, yy + bf.height / 2 - 1.5, lw, 3);
    });
  }
}
