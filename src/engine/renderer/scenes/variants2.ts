import { localizeDigits } from '../../../design/digits';
import { alpha, mix, readableOn, textAccent } from '../../../design/presets';
import { chartRows, prosCons, shownItems, toNumber } from '../../sceneModel';
import { DEFINITION, STAT, TIP, WARNING, itemReveal } from '../../timing';
import { clamp, easeOutBack, easeOutCubic, progress } from '../animation';
import { font } from '../context';
import { drawIcon } from '../icons';
import { appear, card, drawHeader, iconBadge, itemEnter, roundRect, withAlpha, type SceneDrawArgs } from '../kit';
import { drawLines, fitText } from '../textLayout';
import { palette } from './extra2';
import { drawItem, fitItem, lastRevealed } from './extra3';
import { counted } from './variants1';

/**
 * Second batch of alternative layouts (stat, donut, columns, timeline, definition, tip, warning,
 * cycle, pyramid, pros & cons). Same content format and reveal times as each kind's main layout.
 */

const reveal = (a: SceneDrawArgs, i: number, n: number) => itemReveal(a.scene, i, n);
const countP = (frame: number) => easeOutCubic(progress(frame, STAT.countStart, STAT.countLength));

/** رقم وعدّاد — رقم عملاق: the number fills the frame, with a bar that fills while it counts. */
export function drawStatGiant(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs, digits } = a;
  const top = drawHeader(a);
  const raw = scene.items[0] ?? '';
  const p = countP(frame);
  const avail = L.H - top - L.M * 0.6;
  const shown = localizeDigits(counted(raw, p), digits);
  const nf = fitText(ctx, fs, shown || ' ', { maxWidth: L.W - L.M * 2, maxLines: 1, maxSize: L.portrait ? 200 : 230, minSize: 40, weight: 'bold', lineHeight: 1.05 });
  const t = appear(frame, 8, 20);
  const ny = top + avail * 0.12;
  withAlpha(ctx, t, () => {
    const g = ctx.createLinearGradient(0, ny, 0, ny + nf.height);
    g.addColorStop(0, theme.accent);
    g.addColorStop(1, theme.accent2);
    ctx.fillStyle = g;
    ctx.textAlign = 'center';
    drawLines(ctx, fs, nf, L.W / 2, ny + (1 - t) * 30);
  });
  const num = toNumber(raw);
  const pct = /[%٪]/.test(raw) && num !== null ? Math.min(1, num / 100) : 1;
  const barW = Math.min(L.W - L.M * 2, 900);
  const by = ny + nf.height + 24;
  withAlpha(ctx, t, () => {
    ctx.fillStyle = alpha(theme.foreground, 0.12);
    roundRect(ctx, L.W / 2 - barW / 2, by, barW, 18, 9);
    ctx.fill();
    ctx.fillStyle = theme.accent;
    const w = barW * pct * p;
    roundRect(ctx, L.W / 2 + barW / 2 - w, by, w, 18, 9);
    ctx.fill();
  });
  const desc = scene.items.slice(1).join(' ');
  if (desc) withAlpha(ctx, appear(frame, STAT.description, 24), () => {
    const df = fitText(ctx, fs, desc, { maxWidth: Math.min(L.W - L.M * 2, 900), maxLines: 3, maxSize: 34, minSize: 18, weight: 'bold', lineHeight: 1.45 });
    ctx.fillStyle = theme.foreground;
    ctx.textAlign = 'center';
    drawLines(ctx, fs, df, L.W / 2, by + 50);
  });
}

/** رقم وعدّاد — لوحة جانبية: an accent panel with the number slides in; the text sits beside it. */
export function drawStatPanel(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs, digits } = a;
  const top = drawHeader(a);
  const raw = scene.items[0] ?? '';
  const p = countP(frame);
  const avail = L.H - top - L.M * 0.6;
  const vertical = L.portrait;
  const pw = vertical ? L.W - L.M * 2 : (L.W - L.M * 2) * 0.46;
  const ph = vertical ? avail * 0.46 : avail;
  const px = vertical ? L.M : L.W - L.M - pw;
  const py = top;
  const e = easeOutCubic(progress(frame, 4, 24));
  withAlpha(ctx, e, () => {
    ctx.save();
    ctx.translate((1 - e) * (vertical ? 0 : 160), (1 - e) * (vertical ? -80 : 0));
    const g = ctx.createLinearGradient(px, py, px + pw, py + ph);
    g.addColorStop(0, theme.accent);
    g.addColorStop(1, mix(theme.accent, theme.accent2, 0.6));
    ctx.fillStyle = g;
    roundRect(ctx, px, py, pw, ph, 34);
    ctx.fill();
    drawIcon(ctx, scene.icon, px + 50, py + 50, 44, alpha(readableOn(theme.accent), 0.35), 2);
    const nf = fitText(ctx, fs, localizeDigits(counted(raw, p), digits) || ' ', { maxWidth: pw - 60, maxLines: 1, maxSize: Math.min(ph * 0.5, 170), minSize: 36, weight: 'bold', lineHeight: 1.05 });
    ctx.fillStyle = readableOn(theme.accent);
    ctx.textAlign = 'center';
    drawLines(ctx, fs, nf, px + pw / 2, py + ph / 2 - nf.height / 2);
    ctx.restore();
  });
  const desc = scene.items.slice(1).join(' ');
  if (!desc) return;
  const dx = vertical ? L.M : L.M;
  const dw = vertical ? L.W - L.M * 2 : L.W - L.M * 2 - pw - 40;
  const dy = vertical ? py + ph + 30 : top;
  const dh = vertical ? avail - ph - 30 : avail;
  withAlpha(ctx, appear(frame, STAT.description, 24), () => {
    const df = fitText(ctx, fs, desc, { maxWidth: dw - 20, maxLines: 5, maxSize: 40, minSize: 18, weight: 'bold', lineHeight: 1.45 });
    ctx.fillStyle = theme.foreground;
    ctx.textAlign = vertical ? 'center' : 'right';
    drawLines(ctx, fs, df, vertical ? L.W / 2 : dx + dw, dy + dh / 2 - df.height / 2);
  });
}

/** Legend rows for chart layouts: colour chip, label and value. */
function legend(a: SceneDrawArgs, rows: { label: string; value: string }[], colors: string[], x: number, y: number, w: number, rowH: number, visible: (i: number) => number): void {
  const { ctx, theme, font: fs } = a;
  rows.forEach((r, i) => {
    const t = visible(i);
    if (t <= 0) return;
    withAlpha(ctx, t, () => {
      const yy = y + i * rowH;
      ctx.fillStyle = colors[i % colors.length];
      roundRect(ctx, x + w - 22, yy + rowH / 2 - 9, 18, 18, 5);
      ctx.fill();
      const lf = fitText(ctx, fs, r.label, { maxWidth: w - 140, maxLines: 1, maxSize: 24, minSize: 13, weight: 'bold', lineHeight: 1.2 });
      ctx.fillStyle = theme.foreground;
      ctx.textAlign = 'right';
      drawLines(ctx, fs, lf, x + w - 34, yy + rowH / 2 - lf.height / 2);
      ctx.fillStyle = textAccent(theme, colors[i % colors.length]);
      ctx.font = font(fs, 'bold', 24);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(localizeDigits(r.value, a.digits), x, yy + rowH / 2);
      ctx.textBaseline = 'alphabetic';
    });
  });
}

/** دائرة نسب — نصف دائرة: a half-ring gauge made of the shares, with a legend under it. */
export function drawDonutHalf(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L } = a;
  const top = drawHeader(a);
  const rows = chartRows(scene);
  const n = rows.length;
  if (!n) return;
  const colors = palette(theme);
  const total = rows.reduce((s, r) => s + Math.max(0, r.num), 0) || 1;
  const avail = L.H - top - L.M * 0.6;
  // Wide frames: gauge on the right, legend beside it; tall frames: legend under the gauge.
  const side = !L.portrait;
  const R = side ? Math.min(L.W * 0.2, avail * 0.62) : Math.min(L.W * 0.38, avail * 0.32);
  const cx = side ? L.W - L.M - R - 30 : L.W / 2;
  const cy = side ? top + avail / 2 + R * 0.35 : top + R + 20;
  let start = Math.PI;
  rows.forEach((r, i) => {
    const t = easeOutCubic(progress(frame, reveal(a, i, n), 30));
    const sweep = (Math.PI * Math.max(0, r.num)) / total;
    if (t > 0) {
      ctx.strokeStyle = colors[i % colors.length];
      ctx.lineWidth = R * 0.32;
      ctx.beginPath();
      ctx.arc(cx, cy, R, start, start + sweep * t);
      ctx.stroke();
    }
    start += sweep;
  });
  const rowH = side ? Math.min(60, avail / n) : Math.min(48, (L.H - L.M * 0.6 - (cy + R * 0.25 + 20)) / n);
  const legendTop = side ? top + (avail - rowH * n) / 2 : cy + R * 0.25 + 20;
  const lw = side ? cx - R - 60 - L.M : Math.min(L.W - L.M * 2, 620);
  legend(a, rows, colors, side ? L.M : cx - lw / 2, legendTop, lw, rowH, (i) => appear(frame, reveal(a, i, n) + 6, 16));
}

/** دائرة نسب — شريط مكدّس: one 100 % bar built segment by segment, labels above each part. */
export function drawDonutStacked(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L } = a;
  const top = drawHeader(a);
  const rows = chartRows(scene);
  const n = rows.length;
  if (!n) return;
  const colors = palette(theme);
  const total = rows.reduce((s, r) => s + Math.max(0, r.num), 0) || 1;
  const avail = L.H - top - L.M * 0.6;
  const w = L.W - L.M * 2;
  const bh = Math.min(110, avail * 0.22);
  const by = top + avail * 0.18;
  let x = L.W - L.M;
  rows.forEach((r, i) => {
    const sw = (w * Math.max(0, r.num)) / total;
    const t = easeOutCubic(progress(frame, reveal(a, i, n), 24));
    if (t > 0) {
      ctx.fillStyle = colors[i % colors.length];
      roundRect(ctx, x - sw * t, by, sw * t, bh, i === 0 || i === n - 1 ? 18 : 4);
      ctx.fill();
      if (sw > 70) withAlpha(ctx, appear(frame, reveal(a, i, n) + 14, 14), () => {
        ctx.fillStyle = readableOn(colors[i % colors.length]);
        ctx.font = font(a.font, 'bold', Math.min(34, bh * 0.36));
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(localizeDigits(r.value, a.digits), x - sw / 2, by + bh / 2);
        ctx.textBaseline = 'alphabetic';
      });
    }
    x -= sw;
  });
  const legendTop = by + bh + 40;
  const rowH = Math.min(50, (L.H - L.M * 0.6 - legendTop) / n);
  const lw = Math.min(w, 700);
  legend(a, rows, colors, L.W / 2 - lw / 2, legendTop, lw, rowH, (i) => appear(frame, reveal(a, i, n) + 6, 16));
}

/** أعمدة — أشرطة أفقية: bars grow from the right, labels at the start, values at the tips. */
export function drawColumnsHorizontal(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const top = drawHeader(a);
  const rows = chartRows(scene);
  const n = rows.length;
  if (!n) return;
  const colors = palette(theme);
  const max = Math.max(1, ...rows.map((r) => r.num));
  const avail = L.H - top - L.M * 0.6;
  const rowH = Math.min(96, avail / n);
  const y0 = top + (avail - rowH * n) / 2;
  const labelW = L.portrait ? L.W * 0.3 : L.W * 0.22;
  const barMax = L.W - L.M * 2 - labelW - 110;
  rows.forEach((r, i) => {
    const t = easeOutCubic(progress(frame, reveal(a, i, n), 30));
    if (t <= 0) return;
    const y = y0 + i * rowH;
    const color = colors[i % colors.length];
    itemEnter(a, t, L.W / 2, y + rowH / 2, L.W - L.M * 2, rowH, () => {
      const lf = fitText(ctx, fs, r.label, { maxWidth: labelW - 10, maxLines: 2, maxSize: 26, minSize: 13, weight: 'bold', lineHeight: 1.25 });
      ctx.fillStyle = theme.foreground;
      ctx.textAlign = 'right';
      drawLines(ctx, fs, lf, L.W - L.M, y + rowH / 2 - lf.height / 2);
      const bx = L.W - L.M - labelW;
      const bw = (barMax * Math.max(0, r.num) * t) / max;
      const bh = rowH * 0.5;
      ctx.fillStyle = alpha(theme.foreground, 0.08);
      roundRect(ctx, bx - barMax, y + rowH / 2 - bh / 2, barMax, bh, bh / 2);
      ctx.fill();
      const g = ctx.createLinearGradient(bx, 0, bx - bw, 0);
      g.addColorStop(0, color);
      g.addColorStop(1, mix(color, '#ffffff', 0.25));
      ctx.fillStyle = g;
      roundRect(ctx, bx - bw, y + rowH / 2 - bh / 2, bw, bh, bh / 2);
      ctx.fill();
      ctx.fillStyle = textAccent(theme, color);
      ctx.font = font(fs, 'bold', 26);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(localizeDigits(counted(r.value || String(r.num), t), a.digits), bx - bw - 12, y + rowH / 2);
      ctx.textBaseline = 'alphabetic';
    });
  });
}

/** أعمدة — مصاصات: thin sticks topped with value discs, rising from a baseline. */
export function drawColumnsLollipop(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const top = drawHeader(a);
  const rows = chartRows(scene);
  const n = rows.length;
  if (!n) return;
  const colors = palette(theme);
  const max = Math.max(1, ...rows.map((r) => r.num));
  const avail = L.H - top - L.M * 0.6;
  const baseY = top + avail - 70;
  const maxH = avail - 170;
  const slot = (L.W - L.M * 2) / n;
  const R = Math.min(48, slot * 0.36);
  ctx.fillStyle = alpha(theme.foreground, 0.25);
  ctx.fillRect(L.M, baseY, L.W - L.M * 2, 3);
  rows.forEach((r, i) => {
    const t = easeOutBack(progress(frame, reveal(a, i, n), 30));
    if (t <= 0) return;
    const x = L.W - L.M - slot * (i + 0.5);
    const h = (maxH * Math.max(0, r.num) * clamp(t, 0, 1.1)) / max;
    const color = colors[i % colors.length];
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.lineTo(x, baseY - h);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, baseY - h - R + 6, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = readableOn(color);
    const vf = fitText(ctx, fs, localizeDigits(counted(r.value || String(r.num), clamp(t)), a.digits), { maxWidth: R * 1.7, maxLines: 1, maxSize: R * 0.62, minSize: 11, weight: 'bold', lineHeight: 1.1 });
    ctx.textAlign = 'center';
    drawLines(ctx, fs, vf, x, baseY - h - R + 6 - vf.height / 2);
    const lf = fitText(ctx, fs, r.label, { maxWidth: slot - 10, maxLines: 2, maxSize: 22, minSize: 11, weight: 'bold', lineHeight: 1.25 });
    ctx.fillStyle = theme.foreground;
    drawLines(ctx, fs, lf, x, baseY + 14);
  });
}

/** خط زمني — أوراق التقويم: calendar pages, one per event, each torn in over the last. */
export function drawTimelineCalendar(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const top = drawHeader(a);
  const items = shownItems(scene).map((it) => {
    const m = /^(.{1,24}?)\s*[:：\-–—]\s*(.+)$/u.exec(it);
    return m ? { when: m[1].trim(), what: m[2].trim() } : { when: '', what: it };
  });
  const n = items.length;
  if (!n) return;
  const colors = palette(theme);
  const k = lastRevealed(a, n);
  const avail = L.H - top - L.M * 0.6;
  const w = Math.min(L.W - L.M * 2, L.portrait ? 560 : 520);
  const h = Math.min(avail - 30, L.portrait ? 640 : 430);
  const x = L.W / 2 - w / 2;
  const y = top + (avail - h) / 2;
  const page = (i: number, lift: number, inn: number) => {
    const color = colors[i % colors.length];
    const e = easeOutCubic(inn);
    if (e <= 0) return;
    withAlpha(ctx, Math.min(e, 1 - lift), () => {
      ctx.save();
      ctx.translate(x + w / 2, y);
      ctx.rotate(-lift * 0.35 + (1 - e) * 0.12);
      ctx.translate(-(x + w / 2), -y - (1 - e) * 60 + lift * -120);
      card(ctx, theme, x, y, w, h, 22, mix(theme.surface, '#ffffff', 0.06));
      ctx.fillStyle = color;
      roundRect(ctx, x, y, w, h * 0.32, 22);
      ctx.fill();
      ctx.fillRect(x, y + h * 0.2, w, h * 0.12);
      // Binding rings.
      for (let r = 0; r < 4; r++) {
        ctx.fillStyle = theme.background;
        ctx.beginPath();
        ctx.arc(x + w * (0.2 + r * 0.2), y + 14, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      const it = items[i];
      const yf = fitText(ctx, fs, localizeDigits(it.when || String(i + 1), a.digits), { maxWidth: w - 40, maxLines: 1, maxSize: h * 0.2, minSize: 22, weight: 'bold', lineHeight: 1.1 });
      ctx.fillStyle = readableOn(color);
      ctx.textAlign = 'center';
      drawLines(ctx, fs, yf, x + w / 2, y + h * 0.16 - yf.height / 2 + 10);
      const wf = fitText(ctx, fs, it.what, { maxWidth: w - 60, maxLines: 4, maxSize: 40, minSize: 18, weight: 'bold', lineHeight: 1.4 });
      ctx.fillStyle = theme.foreground;
      drawLines(ctx, fs, wf, x + w / 2, y + h * 0.32 + (h * 0.68 - wf.height) / 2);
      ctx.restore();
    });
  };
  // Pages still to come peek out underneath.
  for (let i = n - 1; i > k + 1 && i > 0; i--) {
    withAlpha(ctx, 0.25, () => card(ctx, theme, x + (i - k) * 6, y + (i - k) * 6, w, h, 22));
  }
  if (k >= 0) {
    const inn = progress(frame, reveal(a, k, n), 22);
    page(k, 0, inn);
    if (k > 0 && inn < 1) page(k - 1, inn, 1);
  }
}

/** تعريف — مدخل قاموس: the term large with a label, its definition in a card, examples as chips. */
export function drawDefinitionDictionary(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const items = shownItems(scene);
  const top = L.portrait ? L.M * 2 : L.M;
  const w = L.W - L.M * 2;
  const tt = appear(frame, DEFINITION.term, 24);
  const tf = fitText(ctx, fs, scene.title || ' ', { maxWidth: w, maxLines: 2, maxSize: L.portrait ? 76 : 88, minSize: 32, weight: 'bold', lineHeight: 1.25 });
  withAlpha(ctx, tt, () => {
    ctx.fillStyle = theme.accent;
    roundRect(ctx, L.W - L.M - 120, top, 120, 38, 19);
    ctx.fill();
    ctx.fillStyle = readableOn(theme.accent);
    ctx.font = font(fs, 'bold', 20);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('مصطلح', L.W - L.M - 60, top + 20);
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = theme.foreground;
    ctx.textAlign = 'right';
    drawLines(ctx, fs, tf, L.W - L.M, top + 56 + (1 - tt) * 20);
    ctx.fillStyle = alpha(theme.foreground, 0.3);
    ctx.fillRect(L.M, top + 66 + tf.height, w * easeOutCubic(progress(frame, DEFINITION.term + 10, 30)), 2);
  });
  let y = top + 96 + tf.height;
  const def = items[0];
  if (def) {
    const n = items.length;
    const t = progress(frame, reveal(a, 0, n), 24);
    const df = fitText(ctx, fs, def, { maxWidth: w - 70, maxLines: 5, maxSize: 34, minSize: 18, weight: 'regular', lineHeight: 1.6 });
    const h = df.height + 50;
    itemEnter(a, t, L.W / 2, y + h / 2, w, h, () => withAlpha(ctx, easeOutCubic(t), () => {
      card(ctx, theme, L.M, y, w, h, 22);
      ctx.fillStyle = theme.accent;
      roundRect(ctx, L.W - L.M - 10, y, 10, h, 5);
      ctx.fill();
      ctx.fillStyle = theme.foreground;
      ctx.textAlign = 'right';
      drawLines(ctx, fs, df, L.W - L.M - 34, y + 25);
    }));
    y += h + 30;
  }
  // Examples as chips, wrapping right to left.
  const ex = items.slice(1);
  let cx = L.W - L.M;
  let cy = y;
  ex.forEach((e, k) => {
    const i = k + 1;
    const t = progress(frame, reveal(a, i, items.length), 18);
    const f = fitText(ctx, fs, e, { maxWidth: w * 0.6, maxLines: 1, maxSize: 26, minSize: 14, weight: 'bold', lineHeight: 1.2 });
    const cw = f.width + 44;
    if (cx - cw < L.M) {
      cx = L.W - L.M;
      cy += 64;
    }
    const bx = cx - cw;
    if (t > 0) itemEnter(a, t, bx + cw / 2, cy + 25, cw, 50, () => withAlpha(ctx, easeOutCubic(t), () => {
      ctx.fillStyle = mix(theme.surface, theme.accent2, 0.25);
      roundRect(ctx, bx, cy, cw, 50, 25);
      ctx.fill();
      ctx.fillStyle = theme.foreground;
      ctx.textAlign = 'center';
      drawLines(ctx, fs, f, bx + cw / 2, cy + 25 - f.height / 2);
    }));
    cx = bx - 14;
  });
}

/** نصيحة — ورقة لاصقة: a sticky note drops in, pinned, slightly tilted, with the tip on it. */
export function drawTipSticky(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const items = shownItems(scene);
  const w = Math.min(L.W - L.M * 2, L.portrait ? 600 : 640);
  const tip = items[0] ?? '';
  const tf = fitText(ctx, fs, tip || ' ', { maxWidth: w - 90, maxLines: 7, maxSize: 40, minSize: 20, weight: 'bold', lineHeight: 1.55 });
  const head = fitText(ctx, fs, scene.title || ' ', { maxWidth: w - 90, maxLines: 1, maxSize: 34, minSize: 18, weight: 'bold', lineHeight: 1.3 });
  const h = tf.height + head.height + 130;
  const x = L.W / 2 - w / 2;
  const y = (L.H - h) / 2 - (items[1] ? 30 : 0);
  const d = progress(frame, TIP.badge, 26);
  const paper = mix('#FFE97A', theme.accent, 0.25);
  const ink = '#2a2208';
  if (d > 0) {
    ctx.save();
    ctx.translate(L.W / 2, y);
    ctx.rotate(-0.035 + (1 - easeOutBack(d)) * 0.2);
    ctx.translate(-L.W / 2, -y - (1 - easeOutCubic(d)) * 220);
    ctx.fillStyle = alpha('#000000', 0.22);
    ctx.fillRect(x + 10, y + 14, w, h);
    ctx.fillStyle = paper;
    ctx.fillRect(x, y, w, h);
    // Curled corner.
    ctx.fillStyle = mix(paper, '#000000', 0.15);
    ctx.beginPath();
    ctx.moveTo(x, y + h - 46);
    ctx.lineTo(x + 46, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.fill();
    // Pin.
    ctx.fillStyle = mix(theme.accent2, '#ff3b3b', 0.5);
    ctx.beginPath();
    ctx.arc(L.W / 2, y + 16, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    drawLines(ctx, fs, head, L.W / 2, y + 44);
    ctx.fillStyle = alpha(ink, 0.25);
    ctx.fillRect(x + 50, y + 54 + head.height, w - 100, 2);
    withAlpha(ctx, appear(frame, TIP.text, 22), () => {
      ctx.fillStyle = ink;
      drawLines(ctx, fs, tf, L.W / 2, y + 80 + head.height);
    });
    ctx.restore();
  }
  const note = items[1];
  if (note) withAlpha(ctx, appear(frame, TIP.note, 22), () => {
    const nf = fitText(ctx, fs, note, { maxWidth: w, maxLines: 2, maxSize: 24, minSize: 14, weight: 'regular', lineHeight: 1.4 });
    ctx.fillStyle = alpha(theme.foreground, 0.8);
    ctx.textAlign = 'center';
    drawLines(ctx, fs, nf, L.W / 2, y + h + 34);
  });
}

/** تنبيه — لافتة طريق: a diamond road sign swings in on its post; the warning text sits beside it. */
export function drawWarningSign(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const items = shownItems(scene);
  const vertical = L.portrait;
  const S = vertical ? Math.min(L.W * 0.36, 230) : Math.min(L.H * 0.3, 210);
  const cx = vertical ? L.W / 2 : L.W - L.M - S * 0.9;
  const cy = vertical ? L.M * 2 + S * 0.9 : L.H * 0.42;
  const sw = progress(frame, WARNING.badge, 40);
  const swing = sw < 1 ? Math.sin(sw * Math.PI * 3) * (1 - sw) * 0.4 : Math.sin(frame / 25) * 0.02;
  withAlpha(ctx, appear(frame, WARNING.badge, 14), () => {
    ctx.fillStyle = alpha(theme.foreground, 0.5);
    ctx.fillRect(cx - 5, cy, 10, S * 1.6);
    ctx.save();
    ctx.translate(cx, cy - S * 0.75);
    ctx.rotate(swing);
    ctx.translate(0, S * 0.75);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#FFC107';
    roundRect(ctx, -S / 2, -S / 2, S, S, 16);
    ctx.fill();
    ctx.strokeStyle = '#161616';
    ctx.lineWidth = 9;
    roundRect(ctx, -S / 2 + 12, -S / 2 + 12, S - 24, S - 24, 10);
    ctx.stroke();
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = '#161616';
    ctx.font = font(fs, 'bold', S * 0.6);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', 0, 4);
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  });
  const tx = vertical ? L.W / 2 : cx - S * 1.1;
  const tw = vertical ? L.W - L.M * 2 : tx - L.M;
  let y = vertical ? cy + S * 1.6 + 30 : L.H * 0.24;
  const align = vertical ? 'center' : 'right';
  const tf = fitText(ctx, fs, scene.title || ' ', { maxWidth: tw, maxLines: 3, maxSize: 52, minSize: 24, weight: 'bold', lineHeight: 1.35 });
  withAlpha(ctx, appear(frame, WARNING.title, 20), () => {
    ctx.fillStyle = textAccent(theme, '#FFC107');
    ctx.textAlign = align;
    drawLines(ctx, fs, tf, tx, y);
  });
  y += tf.height + 20;
  if (items[0]) withAlpha(ctx, appear(frame, WARNING.text, 20), () => {
    const bf = fitText(ctx, fs, items[0], { maxWidth: tw, maxLines: 4, maxSize: 32, minSize: 16, weight: 'regular', lineHeight: 1.5 });
    ctx.fillStyle = theme.foreground;
    ctx.textAlign = align;
    drawLines(ctx, fs, bf, tx, y);
    y += bf.height + 20;
  });
  if (items[1]) withAlpha(ctx, appear(frame, WARNING.note, 20), () => {
    const nf = fitText(ctx, fs, items[1], { maxWidth: tw, maxLines: 2, maxSize: 24, minSize: 14, weight: 'bold', lineHeight: 1.4 });
    ctx.fillStyle = alpha(theme.foreground, 0.75);
    ctx.textAlign = align;
    drawLines(ctx, fs, nf, tx, y + 10);
  });
}

/** دورة — مدار: the stages orbit slowly around the title on an ellipse, staying upright. */
export function drawCycleOrbit(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L } = a;
  const top = drawHeader(a);
  const items = shownItems(scene);
  const n = items.length;
  if (!n) return;
  const colors = palette(theme);
  const avail = L.H - top - L.M * 0.6;
  const cx = L.W / 2;
  const cy = top + avail / 2;
  const rx = L.portrait ? L.W * 0.32 : Math.min(L.W * 0.32, 420);
  const ry = Math.min(avail * 0.38, rx * 0.6);
  const spin = frame * 0.004;
  withAlpha(ctx, appear(frame, 6, 20), () => {
    ctx.strokeStyle = alpha(theme.accent, 0.35);
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 10]);
    ctx.lineDashOffset = -frame * 0.8;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    iconBadge(ctx, theme, scene.icon, cx, cy, Math.min(ry * 0.5, 62));
  });
  const nodes = items.map((it, i) => {
    const ang = -Math.PI / 2 + (i * Math.PI * 2) / n + spin;
    return { it, i, x: cx + Math.cos(ang) * rx, y: cy + Math.sin(ang) * ry, depth: Math.sin(ang) };
  });
  // Far side first, so nearer pills overlap them.
  nodes.sort((p, q) => p.depth - q.depth).forEach(({ it, i, x, y, depth }) => {
    const t = progress(frame, reveal(a, i, n), 22);
    if (t <= 0) return;
    const color = colors[i % colors.length];
    const s = 0.85 + 0.15 * (depth + 1) / 2;
    const f = fitItem(a, it, L.portrait ? 200 : 240, 28, 18, 2, 1);
    const w = Math.max(f.hf.width, f.bf?.width ?? 0) + 40;
    const h = f.height + 24;
    withAlpha(ctx, easeOutCubic(t), () => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(s * easeOutBack(t), s * easeOutBack(t));
      ctx.fillStyle = mix(theme.surface, color, 0.3);
      roundRect(ctx, -w / 2, -h / 2, w, h, h / 2);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      roundRect(ctx, -w / 2, -h / 2, w, h, h / 2);
      ctx.stroke();
      drawItem(a, f, 0, -f.height / 2);
      ctx.restore();
    });
  });
}

/** هرم — قمع: an inverted pyramid (funnel), wide at the top, narrowing to the result. */
export function drawPyramidFunnel(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L } = a;
  const top = drawHeader(a);
  const items = shownItems(scene);
  const n = items.length;
  if (!n) return;
  const colors = palette(theme);
  const avail = L.H - top - L.M * 0.6;
  const gap = 10;
  const lh = Math.min(120, (avail - gap * (n - 1)) / n);
  const y0 = top + (avail - (lh + gap) * n + gap) / 2;
  const wTop = L.W - L.M * 2;
  const wBot = wTop * 0.32;
  items.forEach((it, i) => {
    const t = progress(frame, reveal(a, i, n), 22);
    if (t <= 0) return;
    const y = y0 + i * (lh + gap);
    const w1 = wTop - ((wTop - wBot) * i) / n;
    const w2 = wTop - ((wTop - wBot) * (i + 1)) / n;
    const color = colors[i % colors.length];
    itemEnter(a, t, L.W / 2, y + lh / 2, w1, lh, () => withAlpha(ctx, easeOutCubic(t), () => {
      ctx.save();
      ctx.translate(0, (1 - easeOutCubic(t)) * -40);
      ctx.fillStyle = mix(color, theme.surface, 0.25);
      ctx.beginPath();
      ctx.moveTo(L.W / 2 - w1 / 2, y);
      ctx.lineTo(L.W / 2 + w1 / 2, y);
      ctx.lineTo(L.W / 2 + w2 / 2, y + lh);
      ctx.lineTo(L.W / 2 - w2 / 2, y + lh);
      ctx.closePath();
      ctx.fill();
      const f = fitItem(a, it, w2 - 40, 28, 18, 1, 1);
      drawItem(a, f, L.W / 2, y + lh / 2 - f.height / 2, readableOn(mix(color, theme.surface, 0.25)));
      ctx.restore();
    }));
  });
}

/** مزايا وعيوب — ميزان القوى: a tug bar shows pros against cons, items appear under each side. */
export function drawProsConsTug(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const top = drawHeader(a);
  const { pros, cons } = prosCons(scene);
  const n = shownItems(scene).length;
  if (!n) return;
  const good = mix(theme.accent, '#2ecc71', 0.55);
  const bad = mix(theme.accent2, '#e74c3c', 0.55);
  const seenPros = pros.filter((p) => frame >= reveal(a, p.index, n)).length;
  const seenCons = cons.filter((c) => frame >= reveal(a, c.index, n)).length;
  const share = seenPros + seenCons ? seenPros / (seenPros + seenCons) : 0.5;
  const barW = L.W - L.M * 2;
  const by = top + 10;
  withAlpha(ctx, appear(frame, 6, 18), () => {
    const split = L.W - L.M - barW * share;
    ctx.fillStyle = good;
    roundRect(ctx, split, by, L.W - L.M - split, 26, 13);
    ctx.fill();
    ctx.fillStyle = bad;
    roundRect(ctx, L.M, by, split - L.M, 26, 13);
    ctx.fill();
    ctx.fillStyle = theme.foreground;
    ctx.beginPath();
    ctx.arc(split, by + 13, 18, 0, Math.PI * 2);
    ctx.fill();
    drawIcon(ctx, 'thumbs-up', L.W - L.M - 30, by + 64, 34, good, 2.4);
    drawIcon(ctx, 'thumbs-down', L.M + 30, by + 64, 34, bad, 2.4);
  });
  const colW = (L.W - L.M * 2 - 30) / 2;
  const listTop = by + 100;
  const rowH = Math.min(100, (L.H - L.M * 0.6 - listTop) / Math.max(1, pros.length, cons.length) - 12);
  const side = (list: { text: string; index: number }[], x: number, color: string) =>
    list.forEach((p, k) => {
      const t = progress(frame, reveal(a, p.index, n), 20);
      if (t <= 0) return;
      const y = listTop + k * (rowH + 12);
      itemEnter(a, t, x + colW / 2, y + rowH / 2, colW, rowH, () => withAlpha(ctx, easeOutCubic(t), () => {
        ctx.fillStyle = mix(theme.surface, color, 0.2);
        roundRect(ctx, x, y, colW, rowH, rowH / 2.4);
        ctx.fill();
        const f = fitText(ctx, fs, p.text, { maxWidth: colW - 40, maxLines: 2, maxSize: 24, minSize: 13, weight: 'bold', lineHeight: 1.3 });
        ctx.fillStyle = theme.foreground;
        ctx.textAlign = 'center';
        drawLines(ctx, fs, f, x + colW / 2, y + rowH / 2 - f.height / 2);
      }));
    });
  side(pros, L.W - L.M - colW, good);
  side(cons, L.M, bad);
}
