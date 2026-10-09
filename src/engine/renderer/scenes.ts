import { alpha, mix, readableOn, textAccent } from '../../design/presets';
import { localizeDigits } from '../../design/digits';
import type { Scene } from '../../domain/types';
import { clamp, easeOutBack, easeOutCubic, hash01, progress, seedOf } from './animation';
import { font } from './context';
import { drawIcon } from './icons';
import { appear, card, drawHeader, iconBadge, roundRect, withAlpha, type SceneDrawArgs, type SceneDrawer } from './kit';
import { formatStatValue, parseStatValue } from './numbers';
import { drawLines, fitText, type FittedText } from './textLayout';
import { HERO, OUTRO, QUOTE, STAT, comparisonBars, itemReveal, revealSpan, shownItems } from '../timing';

import { drawKpis } from './scenes/kpis';
import { drawDonut } from './scenes/donut';
import { drawColumns } from './scenes/columns';
import { drawPictogram } from './scenes/pictogram';
import { drawCycle } from './scenes/cycle';
import { drawPyramid } from './scenes/pyramid';
import { drawProsCons } from './scenes/proscons';
import { drawChecklist } from './scenes/checklist';
import { drawQuiz } from './scenes/quiz';
import { drawDefinition } from './scenes/definition';
import { drawChapter } from './scenes/chapter';
import { drawTip } from './scenes/tip';

export { layoutFor, type Layout, type SceneDrawArgs, type SceneDrawer } from './kit';

// ───────────────────────── hero ─────────────────────────
function drawHero(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const cx = L.W / 2;
  const iconR = L.portrait ? 84 : 70;
  const titleFit = fitText(ctx, fs, scene.title, {
    maxWidth: L.W - L.M * 2, maxLines: L.portrait ? 4 : 3, maxSize: L.portrait ? 64 : 72, minSize: 34, weight: 'bold', lineHeight: 1.35,
  });
  const subs = scene.items.slice(0, 2).map((it, i) =>
    fitText(ctx, fs, it, { maxWidth: L.W - L.M * (L.portrait ? 2 : 4), maxLines: 2, maxSize: i === 0 ? 32 : 24, minSize: 18, weight: 'regular' }),
  );
  const block = iconR * 2 + 48 + titleFit.height + 24 + subs.reduce((s, f) => s + f.height + 8, 0);
  let y = (L.H - block) / 2;
  const iconCy = y + iconR;

  for (let i = 0; i < 3; i++) {
    const phase = ((frame + i * 30) % 90) / 90;
    withAlpha(ctx, (1 - phase) * 0.45 * appear(frame, 0, 20), () => {
      ctx.strokeStyle = i % 2 ? theme.accent2 : theme.accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, iconCy, iconR + phase * iconR * 1.4, 0, Math.PI * 2);
      ctx.stroke();
    });
  }
  iconBadge(ctx, theme, scene.icon, cx, iconCy, iconR * easeOutBack(progress(frame, HERO.icon, 28)));
  y += iconR * 2 + 48;

  const tt = appear(frame, HERO.title, 30);
  withAlpha(ctx, tt, () => {
    ctx.fillStyle = theme.foreground;
    ctx.textAlign = 'center';
    drawLines(ctx, fs, titleFit, cx, y + (1 - tt) * 40);
  });
  y += titleFit.height + 8;
  const lw = Math.min(titleFit.width * 0.5, 260) * appear(frame, 30, 30);
  ctx.fillStyle = theme.accent;
  roundRect(ctx, cx - lw / 2, y, lw, 6, 3);
  ctx.fill();
  y += 24;
  subs.forEach((f, i) => {
    withAlpha(ctx, appear(frame, HERO.subtitle(i), 26) * (i === 0 ? 0.92 : 0.7), () => {
      ctx.fillStyle = i === 0 ? theme.foreground : textAccent(theme, theme.accent2);
      ctx.textAlign = 'center';
      drawLines(ctx, fs, f, cx, y);
    });
    y += f.height + 8;
  });
}

// ───────────────────────── stat ─────────────────────────
function drawStat(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const top = drawHeader(a);
  const raw = scene.items[0] ?? '';
  const stat = parseStatValue(raw);
  const countT = easeOutCubic(progress(frame, STAT.countStart, STAT.countLength));
  const display = stat ? formatStatValue(stat, stat.value * countT) : raw;
  const finalText = stat ? formatStatValue(stat, stat.value) : raw;
  const isPercent = !!stat && /[%٪]/.test(stat.suffix) && stat.value <= 100;
  const desc = scene.items.slice(1).join(' ');
  const avail = L.H - top - L.M;

  if (isPercent && stat) {
    const side = !L.portrait && !L.square;
    const R = side ? Math.min(avail * 0.42, 190) : Math.min(avail * 0.26, L.W * 0.3);
    const cx = side ? L.M + R + 30 : L.W / 2;
    const cy = side ? top + avail / 2 : top + R + 20;
    ctx.save();
    ctx.lineWidth = R * 0.2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = alpha(theme.foreground, 0.1);
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();
    const grad = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    grad.addColorStop(0, theme.accent);
    grad.addColorStop(1, theme.accent2);
    ctx.strokeStyle = grad;
    const sweep = (Math.PI * 2 * stat.value * countT) / 100;
    if (sweep > 0.001) {
      ctx.beginPath();
      ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + sweep);
      ctx.stroke();
    }
    ctx.restore();
    const numFit = fitText(ctx, fs, finalText, { maxWidth: R * 1.35, maxLines: 1, maxSize: R * 0.62, minSize: 20, weight: 'bold' });
    ctx.font = font(fs, 'bold', numFit.fontSize);
    ctx.fillStyle = theme.foreground;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(display, cx, cy + numFit.fontSize * 0.05);
    ctx.textBaseline = 'alphabetic';
    if (desc) {
      const dx = side ? L.W - L.M : L.W / 2;
      const maxW = side ? L.W - L.M * 2 - R * 2 - 90 : L.W - L.M * 2;
      const dTop = side ? cy : cy + R + R * 0.2 + 36;
      const f = fitText(ctx, fs, desc, { maxWidth: maxW, maxLines: side ? 5 : 4, maxSize: 34, minSize: 20, weight: 'regular', lineHeight: 1.6 });
      withAlpha(ctx, appear(frame, STAT.description, 30), () => {
        ctx.fillStyle = theme.foreground;
        ctx.textAlign = side ? 'right' : 'center';
        drawLines(ctx, fs, f, dx, side ? dTop - f.height / 2 : dTop);
      });
    }
    return;
  }

  // Plain big number with a glowing underline.
  const numFit = fitText(ctx, fs, finalText, { maxWidth: L.W - L.M * 2, maxLines: 1, maxSize: L.portrait ? 140 : 170, minSize: 40, weight: 'bold' });
  const f = desc ? fitText(ctx, fs, desc, { maxWidth: L.W - L.M * 2.5, maxLines: 4, maxSize: 34, minSize: 20, weight: 'regular', lineHeight: 1.6 }) : null;
  const block = numFit.fontSize * 1.2 + 40 + (f?.height ?? 0);
  let y = top + Math.max(0, (avail - block) / 2);
  const s = 0.85 + 0.15 * easeOutBack(progress(frame, 10, 30));
  ctx.save();
  ctx.translate(L.W / 2, y + numFit.fontSize * 0.6);
  ctx.scale(s, s);
  ctx.font = font(fs, 'bold', numFit.fontSize);
  const c1 = textAccent(theme, theme.accent2);
  const c2 = textAccent(theme, theme.accent);
  const grad = ctx.createLinearGradient(-numFit.width / 2, 0, numFit.width / 2, 0);
  grad.addColorStop(0, c1);
  grad.addColorStop(1, c2);
  ctx.fillStyle = grad;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(display, 0, 0);
  ctx.restore();
  y += numFit.fontSize * 1.2 + 10;
  const lw = Math.min(numFit.width, 320) * appear(frame, 40, 30);
  ctx.fillStyle = theme.accent;
  roundRect(ctx, L.W / 2 - lw / 2, y, lw, 8, 4);
  ctx.fill();
  y += 30;
  if (f) {
    withAlpha(ctx, appear(frame, STAT.description, 30), () => {
      ctx.fillStyle = theme.foreground;
      ctx.textAlign = 'center';
      drawLines(ctx, fs, f, L.W / 2, y);
    });
  }
}

// ───────────────────────── steps ─────────────────────────
function drawSteps(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs, digits } = a;
  const top = drawHeader(a);
  const items = shownItems(scene);
  if (!items.length) return;
  const avail = L.H - top - L.M * 0.8;
  const badgeR = L.portrait ? 30 : 28;
  const textW = L.W - L.M * 2 - badgeR * 2 - 60;
  let size = L.portrait ? 38 : 34;
  let fits: FittedText[] = [];
  const gap = 18;
  for (; size >= 18; size -= 2) {
    fits = items.map((it) => fitText(ctx, fs, it, { maxWidth: textW, maxLines: L.portrait ? 3 : 2, maxSize: size, minSize: size, weight: 'regular', lineHeight: 1.45 }));
    const total = fits.reduce((s, f) => s + Math.max(f.height, badgeR * 2) + gap * 2, 0);
    if (total <= avail) break;
  }
  const rowsH = fits.map((f) => Math.max(f.height, badgeR * 2) + gap * (L.portrait ? 2.6 : 2));
  const totalH = rowsH.reduce((s, h) => s + h, 0);
  let y = top + Math.max(0, (avail - totalH) / 2);
  const span = revealSpan(scene, items.length);
  const badgeX = L.W - L.M - badgeR;

  // Connector grows with the reveal.
  const firstCy = y + rowsH[0] / 2;
  const lastCy = y + totalH - rowsH[rowsH.length - 1] / 2;
  const lineT = progress(frame, itemReveal(scene, 0, items.length), span * (items.length - 1) + 1);
  ctx.save();
  ctx.strokeStyle = alpha(theme.accent, 0.45);
  ctx.lineWidth = 4;
  ctx.setLineDash([2, 10]);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(badgeX, firstCy);
  ctx.lineTo(badgeX, firstCy + (lastCy - firstCy) * lineT);
  ctx.stroke();
  ctx.restore();

  items.forEach((_, i) => {
    const t = progress(frame, itemReveal(scene, i, items.length), 22);
    const cy = y + rowsH[i] / 2;
    y += rowsH[i];
    if (t <= 0) return;
    const e = easeOutCubic(t);
    const cardX = L.M;
    const cardW = L.W - L.M * 2 - badgeR * 2 - 20;
    withAlpha(ctx, e, () => {
      card(ctx, theme, cardX - (1 - e) * 40, cy - rowsH[i] / 2 + 6, cardW, rowsH[i] - 12, 18);
      iconBadge(ctx, theme, '', badgeX, cy, badgeR * easeOutBack(t), i % 2 ? theme.accent2 : theme.accent);
      ctx.fillStyle = readableOn(i % 2 ? theme.accent2 : theme.accent);
      ctx.font = font(fs, 'bold', badgeR);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(localizeDigits(String(i + 1), digits), badgeX, cy + 1);
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = theme.foreground;
      ctx.textAlign = 'right';
      drawLines(ctx, fs, fits[i], cardX + cardW - 26 - (1 - e) * 40, cy - fits[i].height / 2);
    });
  });
}

// ───────────────────────── comparison ─────────────────────────
function drawBars(a: SceneDrawArgs, top: number, rows: { label: string; value: string; num: number }[]): void {
  const { ctx, theme, frame, layout: L, font: fs, scene } = a;
  const avail = L.H - top - L.M;
  const rowH = Math.min(L.portrait ? 170 : 96, avail / rows.length);
  const max = Math.max(...rows.map((r) => r.num), 1);
  const allPercent = rows.every((r) => /[%٪]/.test(r.value)) && max <= 100;
  const scale = allPercent ? 100 : max;
  const labelW = L.portrait ? L.W - L.M * 2 : (L.W - L.M * 2) * 0.3;
  const barRight = L.portrait ? L.W - L.M : L.W - L.M - labelW - 24;
  const barMaxW = barRight - L.M - 110;
  let y = top + Math.max(0, (avail - rowH * rows.length) / 2);
  rows.forEach((r, i) => {
    const reveal = itemReveal(scene, i, rows.length);
    const t = progress(frame, reveal + 6, 40);
    const e = easeOutCubic(t);
    const color = i % 2 ? theme.accent2 : theme.accent;
    const labelFit = fitText(ctx, fs, r.label, { maxWidth: labelW, maxLines: L.portrait ? 1 : 2, maxSize: L.portrait ? 36 : 28, minSize: 18, weight: 'bold', lineHeight: 1.3 });
    const barH = Math.min(L.portrait ? 50 : 38, rowH * 0.36);
    const barY = L.portrait ? y + labelFit.height + 8 : y + rowH / 2 - barH / 2;
    withAlpha(ctx, appear(frame, reveal, 20), () => {
      ctx.fillStyle = theme.foreground;
      ctx.textAlign = 'right';
      drawLines(ctx, fs, labelFit, L.W - L.M, L.portrait ? y : y + rowH / 2 - labelFit.height / 2);
      ctx.fillStyle = alpha(theme.foreground, 0.08);
      roundRect(ctx, barRight - barMaxW, barY, barMaxW, barH, barH / 2);
      ctx.fill();
      const w = Math.max(barH, (barMaxW * r.num * e) / scale);
      const grad = ctx.createLinearGradient(barRight, 0, barRight - w, 0);
      grad.addColorStop(0, color);
      grad.addColorStop(1, mix(color, theme.accent2 === color ? theme.accent : theme.accent2, 0.35));
      ctx.fillStyle = grad;
      roundRect(ctx, barRight - w, barY, w, barH, barH / 2);
      ctx.fill();
      const stat = parseStatValue(r.value);
      const shown = stat ? formatStatValue(stat, stat.value * e) : r.value;
      ctx.font = font(fs, 'bold', Math.min(30, barH * 0.9));
      ctx.fillStyle = theme.foreground;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(shown, barRight - w - 14, barY + barH / 2);
      ctx.textBaseline = 'alphabetic';
    });
    y += rowH;
  });
}

function splitHeading(text: string): { head: string; body: string } {
  const m = /^(.{2,40}?)\s*[:：]\s*(.+)$/u.exec(text);
  return m ? { head: m[1], body: m[2] } : { head: '', body: text };
}

function drawComparison(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const top = drawHeader(a);
  const items = shownItems(scene);
  const bars = comparisonBars(scene);
  if (bars) {
    drawBars(a, top, bars.map((b) => ({ ...b, num: parseStatValue(b.value)?.value ?? 0 })));
    return;
  }
  if (!items.length) return;
  // Side-by-side cards (stacked on portrait) with a "VS"-style divider for two items.
  const n = items.length;
  const avail = L.H - top - L.M;
  const cols = L.portrait ? 1 : Math.min(n, 3);
  const rowsN = Math.ceil(n / cols);
  const gap = n === 2 && !L.portrait ? 90 : 28;
  const cw = (L.W - L.M * 2 - gap * (cols - 1)) / cols;
  const ch = Math.min((avail - gap * (rowsN - 1)) / rowsN, L.portrait ? 300 : 380);
  const startY = top + Math.max(0, (avail - (ch * rowsN + gap * (rowsN - 1))) / 2);
  items.forEach((it, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = L.W - L.M - cw - col * (cw + gap);
    const y = startY + row * (ch + gap);
    const t = progress(frame, itemReveal(scene, i, n), 26);
    const e = easeOutBack(t);
    const color = i % 2 ? theme.accent2 : theme.accent;
    const { head, body } = splitHeading(it);
    withAlpha(ctx, clamp(t * 1.4), () => {
      ctx.save();
      ctx.translate(x + cw / 2, y + ch / 2);
      ctx.scale(0.9 + 0.1 * e, 0.9 + 0.1 * e);
      ctx.translate(-(x + cw / 2), -(y + ch / 2));
      card(ctx, theme, x, y, cw, ch, 24);
      ctx.fillStyle = color;
      roundRect(ctx, x, y, cw, 10, 5);
      ctx.fill();
      let ty = y + 34;
      if (head) {
        const hf = fitText(ctx, fs, head, { maxWidth: cw - 48, maxLines: 1, maxSize: 34, minSize: 20, weight: 'bold' });
        ctx.fillStyle = textAccent(theme, color);
        ctx.textAlign = 'center';
        ty = drawLines(ctx, fs, hf, x + cw / 2, ty) + 10;
      }
      const bf = fitText(ctx, fs, body, { maxWidth: cw - 48, maxLines: 6, maxSize: 30, minSize: 18, weight: 'regular', lineHeight: 1.55 });
      ctx.fillStyle = theme.foreground;
      ctx.textAlign = 'center';
      drawLines(ctx, fs, bf, x + cw / 2, ty + Math.max(0, (y + ch - 24 - ty - bf.height) / 2));
      ctx.restore();
    });
  });
  if (n === 2 && !L.portrait) {
    const cx = L.W / 2;
    const cy = startY + ch / 2;
    const t = easeOutBack(progress(frame, 44, 24));
    if (t > 0) {
      ctx.fillStyle = theme.foreground;
      ctx.beginPath();
      ctx.arc(cx, cy, 34 * t, 0, Math.PI * 2);
      ctx.fill();
      drawIcon(ctx, 'arrow-left-right', cx, cy, 36 * t, theme.background, 2.4);
    }
  }
}

// ───────────────────────── timeline ─────────────────────────
function drawTimeline(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const top = drawHeader(a);
  const items = shownItems(scene).map((it) => {
    const m = /^(.{1,24}?)\s*[:：\-–—]\s*(.+)$/u.exec(it);
    return m ? { when: m[1].trim(), what: m[2].trim() } : { when: '', what: it };
  });
  if (!items.length) return;
  const n = items.length;
  const span = revealSpan(scene, n);
  const avail = L.H - top - L.M;

  if (L.portrait) {
    const lineX = L.W - L.M - 30;
    const rowH = Math.min(avail / n, 220);
    const y0 = top + Math.max(0, (avail - rowH * n) / 2);
    const lt = progress(frame, 16, span * n);
    ctx.fillStyle = alpha(theme.foreground, 0.15);
    ctx.fillRect(lineX - 3, y0, 6, rowH * n);
    ctx.fillStyle = theme.accent;
    ctx.fillRect(lineX - 3, y0, 6, rowH * n * lt);
    items.forEach((it, i) => {
      const t = progress(frame, itemReveal(scene, i, n), 24);
      const cy = y0 + rowH * i + 40;
      if (t <= 0) return;
      const e = easeOutCubic(t);
      withAlpha(ctx, e, () => {
        ctx.fillStyle = i % 2 ? theme.accent2 : theme.accent;
        ctx.beginPath();
        ctx.arc(lineX, cy, 16 * easeOutBack(t), 0, Math.PI * 2);
        ctx.fill();
        ctx.textAlign = 'right';
        ctx.fillStyle = textAccent(theme, i % 2 ? theme.accent2 : theme.accent);
        ctx.font = font(fs, 'bold', 38);
        ctx.textBaseline = 'middle';
        ctx.fillText(it.when, lineX - 40 - (1 - e) * 30, cy);
        ctx.textBaseline = 'alphabetic';
        const f = fitText(ctx, fs, it.what, { maxWidth: L.W - L.M * 2 - 80, maxLines: 3, maxSize: 28, minSize: 18, weight: 'regular', lineHeight: 1.45 });
        ctx.fillStyle = theme.foreground;
        drawLines(ctx, fs, f, lineX - 40 - (1 - e) * 30, cy + 26);
      });
    });
    return;
  }

  // Horizontal, chronological from right to left.
  const lineY = top + avail * 0.42;
  const step = (L.W - L.M * 2) / n;
  const lt = progress(frame, 16, span * n);
  ctx.fillStyle = alpha(theme.foreground, 0.15);
  roundRect(ctx, L.M, lineY - 3, L.W - L.M * 2, 6, 3);
  ctx.fill();
  const w = (L.W - L.M * 2) * lt;
  ctx.fillStyle = theme.accent;
  roundRect(ctx, L.W - L.M - w, lineY - 3, w, 6, 3);
  ctx.fill();
  items.forEach((it, i) => {
    const t = progress(frame, itemReveal(scene, i, n), 24);
    if (t <= 0) return;
    const e = easeOutCubic(t);
    const cx = L.W - L.M - step * (i + 0.5);
    const color = i % 2 ? theme.accent2 : theme.accent;
    withAlpha(ctx, e, () => {
      ctx.fillStyle = theme.background;
      ctx.strokeStyle = color;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(cx, lineY, 18 * easeOutBack(t), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      const yearFit = fitText(ctx, fs, it.when, { maxWidth: step - 16, maxLines: 1, maxSize: L.square ? 36 : 40, minSize: 20, weight: 'bold' });
      ctx.fillStyle = textAccent(theme, color);
      ctx.textAlign = 'center';
      drawLines(ctx, fs, yearFit, cx, lineY - 40 - yearFit.height - (1 - e) * 20);
      const f = fitText(ctx, fs, it.what, { maxWidth: step - 24, maxLines: L.square ? 5 : 4, maxSize: 26, minSize: 16, weight: 'regular', lineHeight: 1.45 });
      ctx.fillStyle = theme.foreground;
      drawLines(ctx, fs, f, cx, lineY + 40 + (1 - e) * 20);
    });
  });
}

// ───────────────────────── quote ─────────────────────────
function drawQuote(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const qf = fitText(ctx, fs, scene.title, {
    maxWidth: L.W - L.M * (L.portrait ? 2 : 3.5), maxLines: L.portrait ? 7 : 4, maxSize: L.portrait ? 48 : 52, minSize: 24, weight: 'bold', lineHeight: 1.6,
  });
  const by = scene.items[0];
  const bf = by ? fitText(ctx, fs, `— ${by}`, { maxWidth: L.W - L.M * 2, maxLines: 1, maxSize: 30, minSize: 18, weight: 'regular' }) : null;
  const block = 120 + qf.height + (bf ? bf.height + 30 : 0);
  let y = (L.H - block) / 2;
  withAlpha(ctx, appear(frame, QUOTE.icon, 24) * 0.9, () => drawIcon(ctx, scene.icon || 'quote', L.W / 2, y + 40, 90 * easeOutBack(progress(frame, QUOTE.icon, 30)), theme.accent, 1.6));
  y += 120;
  // Words fade in progressively along the reading direction, line by line.
  qf.lines.forEach((line, i) => {
    withAlpha(ctx, appear(frame, QUOTE.line(i), 26), () => {
      ctx.font = font(fs, 'bold', qf.fontSize);
      ctx.fillStyle = theme.foreground;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(line, L.W / 2, y + qf.lineHeight * (i + 0.5));
      ctx.textBaseline = 'alphabetic';
    });
  });
  y += qf.height + 30;
  if (bf) {
    withAlpha(ctx, appear(frame, QUOTE.line(qf.lines.length) + 14, 26), () => {
      ctx.fillStyle = textAccent(theme, theme.accent2);
      ctx.textAlign = 'center';
      drawLines(ctx, fs, bf, L.W / 2, y);
    });
  }
}

// ───────────────────────── summary ─────────────────────────
function drawSummary(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const top = drawHeader(a);
  const items = shownItems(scene);
  if (!items.length) return;
  const n = items.length;
  const avail = L.H - top - L.M;
  const cols = L.portrait ? 1 : n === 4 ? 2 : Math.min(n, 3);
  const rowsN = Math.ceil(n / cols);
  const gap = 26;
  const single = n === 1;
  const rowStyle = cols === 1 && !single;
  const cw = single && !L.portrait ? Math.min(L.W - L.M * 2, 820) : (L.W - L.M * 2 - gap * (cols - 1)) / cols;
  const ch = Math.min((avail - gap * (rowsN - 1)) / rowsN, single ? 360 : rowStyle ? (L.portrait ? 260 : 220) : 320);
  const startY = top + Math.max(0, (avail - (ch * rowsN + gap * (rowsN - 1))) / 2);
  items.forEach((it, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = single ? (L.W - cw) / 2 : L.W - L.M - cw - col * (cw + gap);
    const y = startY + row * (ch + gap);
    const t = progress(frame, itemReveal(scene, i, n), 26);
    if (t <= 0) return;
    const e = easeOutBack(t);
    const color = i % 2 ? theme.accent2 : theme.accent;
    withAlpha(ctx, clamp(t * 1.5), () => {
      ctx.save();
      ctx.translate(x + cw / 2, y + ch / 2);
      ctx.scale(0.88 + 0.12 * e, 0.88 + 0.12 * e);
      ctx.translate(-(x + cw / 2), -(y + ch / 2));
      card(ctx, theme, x, y, cw, ch, 22);
      if (rowStyle) {
        // Row card: marker on the right, text to its left.
        ctx.fillStyle = color;
        roundRect(ctx, x + cw - 10, y, 10, ch, 5);
        ctx.fill();
        drawIcon(ctx, 'circle-check', x + cw - 50, y + ch / 2, 40, color, 2.2);
        const f = fitText(ctx, fs, it, { maxWidth: cw - 120, maxLines: 4, maxSize: L.portrait ? 34 : 30, minSize: 18, weight: 'regular', lineHeight: 1.5 });
        ctx.fillStyle = theme.foreground;
        ctx.textAlign = 'right';
        drawLines(ctx, fs, f, x + cw - 90, y + ch / 2 - f.height / 2);
      } else {
        const iconY = y + (single ? 70 : 52);
        ctx.fillStyle = alpha(color, 0.16);
        ctx.beginPath();
        ctx.arc(x + cw / 2, iconY, single ? 44 : 30, 0, Math.PI * 2);
        ctx.fill();
        drawIcon(ctx, single ? scene.icon : 'circle-check', x + cw / 2, iconY, single ? 52 : 36, color, 2.2);
        const f = fitText(ctx, fs, it, { maxWidth: cw - 56, maxLines: 6, maxSize: single ? 36 : 30, minSize: 17, weight: 'regular', lineHeight: 1.5 });
        ctx.fillStyle = theme.foreground;
        ctx.textAlign = 'center';
        const textTop = iconY + (single ? 64 : 44);
        drawLines(ctx, fs, f, x + cw / 2, textTop + Math.max(0, (y + ch - 20 - textTop - f.height) / 2));
      }
      ctx.restore();
    });
  });
}

// ───────────────────────── outro ─────────────────────────
function drawOutro(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  // Deterministic confetti drifting down.
  const seed = seedOf(scene.id);
  for (let i = 0; i < 40; i++) {
    const x = hash01(seed, i) * L.W;
    const speed = 1.2 + hash01(seed, i + 100) * 2.2;
    const y = ((hash01(seed, i + 200) * L.H + frame * speed) % (L.H + 40)) - 20;
    const s = 6 + hash01(seed, i + 300) * 10;
    withAlpha(ctx, 0.55 * appear(frame, 0, 30), () => {
      ctx.fillStyle = i % 3 === 0 ? theme.accent : i % 3 === 1 ? theme.accent2 : theme.foreground;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((frame * 0.03 + i) % (Math.PI * 2));
      ctx.fillRect(-s / 2, -s / 4, s, s / 2);
      ctx.restore();
    });
  }
  const iconR = 64;
  const tf = fitText(ctx, fs, scene.title, { maxWidth: L.W - L.M * 2, maxLines: 2, maxSize: L.portrait ? 64 : 72, minSize: 30, weight: 'bold', lineHeight: 1.35 });
  const subs = scene.items.slice(0, 3).map((it) => fitText(ctx, fs, it, { maxWidth: L.W - L.M * 3, maxLines: 2, maxSize: 30, minSize: 18, weight: 'regular' }));
  const block = iconR * 2 + 40 + tf.height + 20 + subs.reduce((s, f) => s + f.height + 16, 0);
  let y = (L.H - block) / 2;
  const beat = 1 + 0.06 * Math.sin(frame / 6) * appear(frame, 30, 10);
  iconBadge(ctx, theme, scene.icon, L.W / 2, y + iconR, iconR * easeOutBack(progress(frame, OUTRO.icon, 26)) * beat);
  y += iconR * 2 + 40;
  withAlpha(ctx, appear(frame, OUTRO.title, 26), () => {
    ctx.fillStyle = theme.foreground;
    ctx.textAlign = 'center';
    drawLines(ctx, fs, tf, L.W / 2, y);
  });
  y += tf.height + 20;
  subs.forEach((f, i) => {
    withAlpha(ctx, appear(frame, OUTRO.line(i), 24), () => {
      if (i === subs.length - 1 && subs.length > 1) {
        // Last line as a pill (e.g. website or channel).
        const pw = f.width + 60;
        const ph = f.height + 16;
        ctx.fillStyle = theme.accent;
        roundRect(ctx, L.W / 2 - pw / 2, y - 8, pw, ph, ph / 2);
        ctx.fill();
        ctx.fillStyle = readableOn(theme.accent);
      } else ctx.fillStyle = alpha(theme.foreground, 0.85);
      ctx.textAlign = 'center';
      drawLines(ctx, fs, f, L.W / 2, y);
    });
    y += f.height + 16;
  });
}

export const SCENE_DRAWERS: Record<Scene['kind'], SceneDrawer> = {
  hero: drawHero,
  stat: drawStat,
  steps: drawSteps,
  comparison: drawComparison,
  timeline: drawTimeline,
  quote: drawQuote,
  summary: drawSummary,
  outro: drawOutro,
  kpis: drawKpis,
  donut: drawDonut,
  columns: drawColumns,
  pictogram: drawPictogram,
  cycle: drawCycle,
  pyramid: drawPyramid,
  proscons: drawProsCons,
  checklist: drawChecklist,
  quiz: drawQuiz,
  definition: drawDefinition,
  chapter: drawChapter,
  tip: drawTip,
};

export const drawScene: SceneDrawer = (args) => (SCENE_DRAWERS[args.scene.kind] ?? drawHero)(args);
