import { alpha, mix, readableOn, textAccent } from '../../design/presets';
import type { Scene } from '../../domain/types';
import { easeOutBack, easeOutCubic, hash01, progress, seedOf } from './animation';
import { font } from './context';
import { drawIcon } from './icons';
import { appear, drawHeader, iconBadge, roundRect, withAlpha, type SceneDrawArgs, type SceneDrawer } from './kit';
import { formatStatValue, parseStatValue } from './numbers';
import { drawLines, fitText } from './textLayout';
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
import { drawSteps } from './scenes/steps';
import { drawSummary, itemIcons } from './scenes/summary';

export { layoutFor, type Layout, type SceneDrawArgs, type SceneDrawer } from './kit';

// ───────────────────────── hero ─────────────────────────
/** Rings with dots orbiting an icon disc (deterministic: driven by the frame only). */
function orbitIcon(a: SceneDrawArgs, cx: number, cy: number, r: number): void {
  const { ctx, scene, theme, frame } = a;
  const t = easeOutBack(progress(frame, HERO.icon, 28));
  withAlpha(ctx, appear(frame, 0, 24), () => {
    [1.45, 1.85].forEach((k, i) => {
      ctx.strokeStyle = alpha(i ? theme.accent2 : theme.accent, 0.35);
      ctx.lineWidth = 2;
      ctx.setLineDash(i ? [4, 10] : []);
      ctx.beginPath();
      ctx.arc(cx, cy, r * k * t, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      const ang = frame * (i ? -0.012 : 0.018) + i * 2;
      for (let d = 0; d < 3; d++) {
        const aa = ang + (d * Math.PI * 2) / 3;
        ctx.fillStyle = d % 2 ? theme.accent2 : theme.accent;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(aa) * r * k * t, cy + Math.sin(aa) * r * k * t, (i ? 6 : 9) * t, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  });
  // Soft glow, then the badge.
  const g = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 1.4);
  g.addColorStop(0, alpha(theme.accent, 0.25));
  g.addColorStop(1, alpha(theme.accent, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.4, 0, Math.PI * 2);
  ctx.fill();
  iconBadge(ctx, theme, scene.icon, cx, cy, r * t);
}

function drawHero(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  if (!L.portrait && !L.square) return drawHeroSplit(a);
  const cx = L.W / 2;
  const iconR = L.portrait ? 80 : 64;
  const titleFit = fitText(ctx, fs, scene.title, {
    maxWidth: L.W - L.M * 2, maxLines: L.portrait ? 4 : 3, maxSize: L.portrait ? 64 : 72, minSize: 34, weight: 'bold', lineHeight: 1.35,
  });
  const subs = scene.items.slice(0, 2).map((it, i) =>
    fitText(ctx, fs, it, { maxWidth: L.W - L.M * (L.portrait ? 2 : 4), maxLines: 2, maxSize: i === 0 ? 32 : 24, minSize: 18, weight: 'regular' }),
  );
  const block = iconR * 3.7 + 48 + titleFit.height + 24 + subs.reduce((s, f) => s + f.height + 8, 0);
  let y = (L.H - block) / 2;
  const iconCy = y + iconR * 1.85;

  orbitIcon(a, cx, iconCy, iconR);
  y += iconR * 3.7 + 48;

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

/** Landscape opening: title block on the right (reading start), orbiting icon on the left. */
function drawHeroSplit(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const r = 110;
  const iconCx = L.M + r * 1.9;
  const textR = L.W - L.M;
  const textW = textR - (iconCx + r * 1.9 + 40);
  const titleFit = fitText(ctx, fs, scene.title, { maxWidth: textW, maxLines: 3, maxSize: 82, minSize: 36, weight: 'bold', lineHeight: 1.3 });
  const subs = scene.items.slice(0, 2).map((it, i) =>
    fitText(ctx, fs, it, { maxWidth: textW, maxLines: 2, maxSize: i === 0 ? 36 : 26, minSize: 18, weight: i === 0 ? 'regular' : 'bold' }),
  );
  const block = titleFit.height + 40 + subs.reduce((s, f) => s + f.height + 14, 0);
  let y = (L.H - block) / 2;
  orbitIcon(a, iconCx, L.H / 2, r);
  // Accent bar beside the title.
  const bt = easeOutCubic(progress(frame, HERO.title - 4, 30));
  ctx.fillStyle = theme.accent;
  roundRect(ctx, textR + 22, y + 8, 10, (titleFit.height - 10) * bt, 5);
  ctx.fill();
  const tt = appear(frame, HERO.title, 30);
  withAlpha(ctx, tt, () => {
    ctx.fillStyle = theme.foreground;
    ctx.textAlign = 'right';
    drawLines(ctx, fs, titleFit, textR - (1 - tt) * 50, y);
  });
  y += titleFit.height + 24;
  subs.forEach((f, i) => {
    const st = appear(frame, HERO.subtitle(i), 26);
    withAlpha(ctx, st, () => {
      if (i === 0) {
        ctx.fillStyle = alpha(theme.foreground, 0.85);
        ctx.textAlign = 'right';
        drawLines(ctx, fs, f, textR - (1 - st) * 30, y);
      } else {
        // Second line as an accent pill.
        ctx.fillStyle = theme.accent2;
        roundRect(ctx, textR - f.width - 36, y - 6, f.width + 36, f.height + 12, (f.height + 12) / 2);
        ctx.fill();
        ctx.fillStyle = readableOn(theme.accent2);
        ctx.textAlign = 'right';
        drawLines(ctx, fs, f, textR - 18, y);
      }
    });
    y += f.height + 20;
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
    const R = side ? Math.min(avail * 0.36, 170) : Math.min(avail * 0.22, L.W * 0.27);
    const cx = side ? L.M + R * 1.3 + 20 : L.W / 2;
    const cy = side ? top + avail / 2 : top + R * 1.3 + 20;
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
    // Dial ticks outside the ring; the ones already covered light up.
    const ticks = 60;
    for (let k = 0; k < ticks; k++) {
      const ang = -Math.PI / 2 + (k / ticks) * Math.PI * 2;
      const on = k / ticks < (stat.value * countT) / 100;
      const r1 = R + R * 0.17;
      const r2 = r1 + (k % 5 === 0 ? R * 0.1 : R * 0.05);
      ctx.strokeStyle = on ? theme.accent : alpha(theme.foreground, 0.18);
      ctx.lineWidth = k % 5 === 0 ? 4 : 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
      ctx.lineTo(cx + Math.cos(ang) * r2, cy + Math.sin(ang) * r2);
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
      const maxW = side ? L.W - L.M * 2 - R * 2.6 - 90 : L.W - L.M * 2;
      const dTop = side ? cy : cy + R * 1.3 + 40;
      const f = fitText(ctx, fs, desc, { maxWidth: maxW, maxLines: side ? 5 : 4, maxSize: 42, minSize: 20, weight: 'bold', lineHeight: 1.5 });
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
  const f = desc ? fitText(ctx, fs, desc, { maxWidth: L.W - L.M * 2.5, maxLines: 4, maxSize: 40, minSize: 20, weight: 'bold', lineHeight: 1.5 }) : null;
  const block = numFit.fontSize * 1.2 + 40 + (f?.height ?? 0);
  let y = top + Math.max(0, (avail - block) / 2);
  const s = 0.85 + 0.15 * easeOutBack(progress(frame, 10, 30));
  // Slowly turning light rays behind the number.
  const rays = 18;
  const rr = Math.min(Math.max(numFit.width * 0.62, numFit.fontSize * 1.2), avail * 0.62);
  const rcx = L.W / 2;
  const rcy = y + numFit.fontSize * 0.6;
  withAlpha(ctx, appear(frame, 6, 30) * 0.5, () => {
    const rg = ctx.createRadialGradient(rcx, rcy, 0, rcx, rcy, rr);
    rg.addColorStop(0, alpha(theme.accent, 0.35));
    rg.addColorStop(1, alpha(theme.accent, 0));
    ctx.fillStyle = rg;
    for (let k = 0; k < rays; k++) {
      const a0 = (k / rays) * Math.PI * 2 + frame * 0.003;
      ctx.beginPath();
      ctx.moveTo(rcx, rcy);
      ctx.arc(rcx, rcy, rr, a0, a0 + Math.PI / rays);
      ctx.closePath();
      ctx.fill();
    }
  });
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
  const { scene } = a;
  const top = drawHeader(a);
  const items = shownItems(scene);
  const bars = comparisonBars(scene);
  if (bars) {
    drawBars(a, top, bars.map((b) => ({ ...b, num: parseStatValue(b.value)?.value ?? 0 })));
    return;
  }
  if (!items.length) return;
  drawVersus(a, top, items);
}

/**
 * Text comparison as a split screen: each side is a full-height tinted panel with its own matched
 * icon, a big heading and the explanation; a "مقابل" medallion sits on the seam. Panels slide in
 * from their own side at their cue.
 */
function drawVersus(a: SceneDrawArgs, top: number, items: string[]): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const n = items.length;
  const icons = itemIcons(items.map((it) => splitHeading(it).head || it), scene.icon);
  const vertical = L.portrait;
  const gap = 18;
  const area = { x: L.M * 0.6, y: top - 6, w: L.W - L.M * 1.2, h: L.H - top - L.M * 0.6 };
  const pw = vertical ? area.w : (area.w - gap * (n - 1)) / n;
  const ph = vertical ? (area.h - gap * (n - 1)) / n : area.h;
  const colors = [theme.accent, theme.accent2, mix(theme.accent, theme.foreground, 0.4)];
  items.forEach((it, i) => {
    const t = progress(frame, itemReveal(scene, i, n), 28);
    if (t <= 0) return;
    const e = easeOutCubic(t);
    const color = colors[i % 3];
    const x = vertical ? area.x : area.x + area.w - pw - i * (pw + gap);
    const y = vertical ? area.y + i * (ph + gap) : area.y;
    const dir = vertical ? 0 : i === 0 ? 1 : -1;
    const { head, body } = splitHeading(it);
    withAlpha(ctx, e, () => {
      ctx.save();
      ctx.translate(dir * (1 - e) * 80, vertical ? (1 - e) * 40 : 0);
      const g = ctx.createLinearGradient(0, y, 0, y + ph);
      g.addColorStop(0, mix(theme.surface, color, 0.3));
      g.addColorStop(1, mix(theme.surface, color, 0.08));
      ctx.fillStyle = g;
      roundRect(ctx, x, y, pw, ph, 28);
      ctx.fill();
      ctx.strokeStyle = alpha(color, 0.5);
      ctx.lineWidth = 2;
      roundRect(ctx, x + 1, y + 1, pw - 2, ph - 2, 27);
      ctx.stroke();
      // Large faint icon as a watermark, plus a crisp one in a disc.
      ctx.globalAlpha *= 0.08;
      drawIcon(ctx, icons[i], x + pw / 2, y + ph * 0.62, Math.min(pw, ph) * 0.62, color, 1.5);
      ctx.globalAlpha /= 0.08;
      const r = vertical ? 34 : 42;
      const cy = y + (vertical ? ph / 2 : r + 34);
      const cx = vertical ? x + pw - r - 28 : x + pw / 2;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      drawIcon(ctx, icons[i], cx, cy, r * 1.05, readableOn(color), 2.2);
      const tw = vertical ? pw - r * 2 - 80 : pw - 56;
      const hf = head ? fitText(ctx, fs, head, { maxWidth: tw, maxLines: 2, maxSize: vertical ? 40 : 46, minSize: 22, weight: 'bold', lineHeight: 1.3 }) : null;
      const bf = fitText(ctx, fs, body, { maxWidth: tw, maxLines: vertical ? 3 : 5, maxSize: vertical ? 30 : 32, minSize: 18, weight: 'regular', lineHeight: 1.5 });
      const blockH = (hf ? hf.height + 14 : 0) + bf.height;
      const tx = vertical ? cx - r - 26 : x + pw / 2;
      const ty = vertical ? y + (ph - blockH) / 2 : cy + r + 26 + Math.max(0, (y + ph - 30 - (cy + r + 26) - blockH) / 2);
      ctx.textAlign = vertical ? 'right' : 'center';
      let yy = ty;
      if (hf) {
        ctx.fillStyle = textAccent(theme, color);
        yy = drawLines(ctx, fs, hf, tx, yy) + 14;
      }
      ctx.fillStyle = theme.foreground;
      drawLines(ctx, fs, bf, tx, yy);
      ctx.restore();
    });
  });
  // Seam medallion(s).
  for (let i = 0; i < n - 1; i++) {
    const t = easeOutBack(progress(frame, itemReveal(scene, i + 1, n) + 10, 22));
    if (t <= 0) continue;
    const cx = vertical ? area.x + area.w / 2 : area.x + area.w - (i + 1) * (pw + gap) + gap / 2;
    const cy = vertical ? area.y + (i + 1) * (ph + gap) - gap / 2 : area.y + area.h / 2;
    const r = (vertical ? 38 : 46) * t;
    ctx.fillStyle = theme.background;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = theme.foreground;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = theme.background;
    ctx.font = font(fs, 'bold', r * 0.5);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('مقابل', cx, cy + 2);
    ctx.textBaseline = 'alphabetic';
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

  // Horizontal road, chronological from right to left. Year pills sit on the road; events
  // alternate above and below it, so each can use almost two slots of width.
  const roadY = top + avail * 0.5;
  const step = (L.W - L.M * 2) / n;
  const roadH = 22;
  const lt = progress(frame, 12, span * n);
  ctx.fillStyle = alpha(theme.foreground, 0.1);
  roundRect(ctx, L.M - 20, roadY - roadH / 2, L.W - L.M * 2 + 40, roadH, roadH / 2);
  ctx.fill();
  const w = (L.W - L.M * 2 + 40) * lt;
  const rg = ctx.createLinearGradient(L.W - L.M + 20, 0, L.M - 20, 0);
  rg.addColorStop(0, theme.accent);
  rg.addColorStop(1, theme.accent2);
  ctx.fillStyle = rg;
  roundRect(ctx, L.W - L.M + 20 - w, roadY - roadH / 2, w, roadH, roadH / 2);
  ctx.fill();
  // Dashed centre marking.
  ctx.save();
  ctx.strokeStyle = alpha(theme.background, 0.55);
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 12]);
  ctx.beginPath();
  ctx.moveTo(L.W - L.M + 10, roadY);
  ctx.lineTo(L.W - L.M + 10 - Math.max(0, w - 20), roadY);
  ctx.stroke();
  ctx.restore();
  const textW = Math.min(step * 1.75, 420) - 20;
  items.forEach((it, i) => {
    const t = progress(frame, itemReveal(scene, i, n), 24);
    if (t <= 0) return;
    const e = easeOutCubic(t);
    const cx = L.W - L.M - step * (i + 0.5);
    const up = i % 2 === 0;
    const color = i % 2 ? theme.accent2 : theme.accent;
    withAlpha(ctx, e, () => {
      // Stem from the road to the event.
      const stem = (avail * 0.5 - 70) * 0.35 * e;
      ctx.strokeStyle = alpha(color, 0.8);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, roadY + (up ? -roadH : roadH));
      ctx.lineTo(cx, roadY + (up ? -roadH - stem : roadH + stem));
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, roadY + (up ? -roadH - stem : roadH + stem), 6, 0, Math.PI * 2);
      ctx.fill();
      // Year pill on the road.
      const yf = fitText(ctx, fs, it.when || String(i + 1), { maxWidth: step - 16, maxLines: 1, maxSize: L.square ? 30 : 32, minSize: 16, weight: 'bold' });
      const pw = yf.width + 32;
      const ph = yf.height + 12;
      const s = easeOutBack(t);
      ctx.save();
      ctx.translate(cx, roadY);
      ctx.scale(s, s);
      ctx.fillStyle = theme.background;
      roundRect(ctx, -pw / 2 - 5, -ph / 2 - 5, pw + 10, ph + 10, (ph + 10) / 2);
      ctx.fill();
      ctx.fillStyle = color;
      roundRect(ctx, -pw / 2, -ph / 2, pw, ph, ph / 2);
      ctx.fill();
      ctx.fillStyle = readableOn(color);
      ctx.textAlign = 'center';
      drawLines(ctx, fs, yf, 0, -yf.height / 2);
      ctx.restore();
      // Event text.
      const f = fitText(ctx, fs, it.what, { maxWidth: textW, maxLines: 3, maxSize: L.square ? 30 : 30, minSize: 16, weight: 'bold', lineHeight: 1.4 });
      const tipY = roadY + (up ? -roadH - stem - 14 : roadH + stem + 14);
      const tx = Math.min(L.W - L.M / 2 - textW / 2, Math.max(L.M / 2 + textW / 2, cx));
      ctx.fillStyle = theme.foreground;
      ctx.textAlign = 'center';
      drawLines(ctx, fs, f, tx, up ? tipY - f.height + (1 - e) * 16 : tipY - (1 - e) * 16);
    });
  });
}

// ───────────────────────── quote ─────────────────────────
function drawQuote(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const pad = L.portrait ? L.M : L.M * 1.6;
  const barX = L.W - pad;
  const textW = L.W - pad * 2 - 40;
  const qf = fitText(ctx, fs, scene.title, {
    maxWidth: textW, maxLines: L.portrait ? 7 : 4, maxSize: L.portrait ? 62 : 66, minSize: 26, weight: 'bold', lineHeight: 1.5,
  });
  const by = scene.items[0];
  const bf = by ? fitText(ctx, fs, by, { maxWidth: textW - 80, maxLines: 1, maxSize: 30, minSize: 18, weight: 'bold' }) : null;
  const block = qf.height + (bf ? bf.height + 70 : 0) + 90;
  const y0 = (L.H - block) / 2 + 90;
  // Big accent quotation mark above the text, popping in first.
  const mt = easeOutBack(progress(frame, QUOTE.icon, 26));
  if (mt > 0) {
    ctx.save();
    ctx.translate(barX + 6, y0 - 112);
    ctx.scale(mt, mt);
    ctx.font = font(fs, 'bold', 220);
    ctx.fillStyle = theme.accent;
    ctx.textAlign = 'right';
    ctx.fillText('”', 0, 150);
    ctx.restore();
  }
  // Accent bar grows down along the quote.
  const barH = (qf.height + 10) * easeOutCubic(progress(frame, QUOTE.icon + 4, 30));
  ctx.fillStyle = theme.accent;
  roundRect(ctx, barX - 8, y0, 8, barH, 4);
  ctx.fill();
  const tx = barX - 36;
  qf.lines.forEach((line, i) => {
    const t = appear(frame, QUOTE.line(i), 26);
    withAlpha(ctx, t, () => {
      ctx.font = font(fs, 'bold', qf.fontSize);
      ctx.fillStyle = theme.foreground;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(line, tx - (1 - t) * 24, y0 + qf.lineHeight * (i + 0.5));
      ctx.textBaseline = 'alphabetic';
    });
  });
  if (bf) {
    const t = appear(frame, QUOTE.line(qf.lines.length) + 14, 26);
    withAlpha(ctx, t, () => {
      const py = y0 + qf.height + 40;
      const r = bf.height / 2 + 14;
      // Author pill: icon disc + name.
      ctx.fillStyle = mix(theme.surface, theme.accent2, 0.18);
      roundRect(ctx, tx - bf.width - r * 2 - 40, py, bf.width + r * 2 + 40, r * 2, r);
      ctx.fill();
      ctx.fillStyle = theme.accent2;
      ctx.beginPath();
      ctx.arc(tx - r, py + r, r - 6, 0, Math.PI * 2);
      ctx.fill();
      drawIcon(ctx, 'user', tx - r, py + r, (r - 6) * 1.1, readableOn(theme.accent2), 2.2);
      ctx.fillStyle = textAccent(theme, theme.accent2);
      ctx.textAlign = 'right';
      drawLines(ctx, fs, bf, tx - r * 2 - 14, py + r - bf.height / 2);
    });
  }
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
