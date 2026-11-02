import { localizeDigits } from '../../../design/digits';
import { alpha, mix, readableOn, textAccent } from '../../../design/presets';
import { beforeAfterParts, chartRows, quizParts, shownItems, trueFalseParts } from '../../sceneModel';
import { BEFORE_AFTER, CHAPTER, HERO, OUTRO, QUIZ_COUNTDOWN, TRUEFALSE, beforeAfterAt, itemReveal, quizCountdown, trueFalseCountdown } from '../../timing';
import { clamp, easeInOutCubic, easeOutBack, easeOutCubic, progress } from '../animation';
import { confetti, radarPulse } from '../ambient';
import { font } from '../context';
import { drawIcon } from '../icons';
import { appear, card, drawHeader, iconBadge, itemEnter, roundRect, withAlpha, type SceneDrawArgs } from '../kit';
import { drawLines, fitText } from '../textLayout';
import { palette, parts } from './extra2';
import { drawItem, fitItem, gridBoxes } from './extra3';
import { counted } from './variants1';

/**
 * Third batch of alternative layouts (hero, outro, chapter, quiz, true/false, ranking, line
 * chart, before/after, mind map, table). Same content formats and reveal times as the main ones.
 */

const reveal = (a: SceneDrawArgs, i: number, n: number) => itemReveal(a.scene, i, n);

/** افتتاحية — كلمات كبيرة: the title stacked in large words with an accent bar and a pill subtitle. */
export function drawHeroStacked(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const w = L.W - L.M * 2;
  const tf = fitText(ctx, fs, scene.title || ' ', { maxWidth: w * (L.portrait ? 1 : 0.75), maxLines: 4, maxSize: L.portrait ? 92 : 104, minSize: 40, weight: 'bold', lineHeight: 1.15 });
  const sub = scene.items[0];
  const total = tf.height + (sub ? 110 : 0);
  const y0 = (L.H - total) / 2;
  const right = L.W - L.M;
  const bar = easeOutCubic(progress(frame, HERO.icon, 26));
  ctx.fillStyle = theme.accent;
  roundRect(ctx, right - 14, y0, 14, tf.height * bar, 7);
  ctx.fill();
  ctx.font = font(fs, tf.weight, tf.fontSize);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  tf.lines.forEach((line, i) => {
    const t = progress(frame, HERO.title + i * 8, 22);
    if (t <= 0) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y0 + i * tf.lineHeight, L.W, tf.lineHeight);
    ctx.clip();
    ctx.fillStyle = i % 2 ? textAccent(theme, theme.accent) : theme.foreground;
    ctx.fillText(line, right - 40, y0 + tf.lineHeight * (i + 0.5) + (1 - easeOutCubic(t)) * tf.lineHeight);
    ctx.restore();
  });
  ctx.textBaseline = 'alphabetic';
  if (sub) withAlpha(ctx, appear(frame, HERO.subtitle(0), 22), () => {
    const sf = fitText(ctx, fs, sub, { maxWidth: w - 60, maxLines: 2, maxSize: 30, minSize: 16, weight: 'bold', lineHeight: 1.35 });
    const pw = sf.width + 60;
    const y = y0 + tf.height + 40;
    ctx.fillStyle = mix(theme.surface, theme.accent, 0.25);
    roundRect(ctx, right - 40 - pw, y, pw, sf.height + 26, (sf.height + 26) / 2);
    ctx.fill();
    ctx.fillStyle = theme.foreground;
    ctx.textAlign = 'center';
    drawLines(ctx, fs, sf, right - 40 - pw / 2, y + 13);
  });
  withAlpha(ctx, appear(frame, HERO.icon + 10, 24), () => iconBadge(ctx, theme, scene.icon, L.portrait ? L.W / 2 : L.M + 110, L.portrait ? y0 - 120 : L.H / 2, L.portrait ? 60 : 90));
}

/** افتتاحية — دائرة تتسع: an accent circle grows from the centre and the title appears on it. */
export function drawHeroCircle(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const cx = L.W / 2;
  const cy = L.H / 2;
  const R = Math.hypot(L.W, L.H) * 0.36;
  const g = easeInOutCubic(progress(frame, 0, 34));
  withAlpha(ctx, appear(frame, 30, 30), () => radarPulse(ctx, cx, cy, R * 0.95, theme.accent2, frame, 90));
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  grad.addColorStop(0, mix(theme.accent, '#ffffff', 0.12));
  grad.addColorStop(1, theme.accent);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, R * g, 0, Math.PI * 2);
  ctx.fill();
  const on = readableOn(theme.accent);
  withAlpha(ctx, appear(frame, HERO.icon + 18, 20), () => drawIcon(ctx, scene.icon, cx, cy - R * 0.45, R * 0.24, on, 2.2, easeOutCubic(progress(frame, 20, 30))));
  const tf = fitText(ctx, fs, scene.title || ' ', { maxWidth: Math.min(R * 1.5, L.W - L.M * 2), maxLines: 3, maxSize: 72, minSize: 28, weight: 'bold', lineHeight: 1.3 });
  const tt = progress(frame, HERO.title + 14, 24);
  withAlpha(ctx, easeOutCubic(tt), () => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(0.8 + 0.2 * easeOutBack(tt), 0.8 + 0.2 * easeOutBack(tt));
    ctx.translate(-cx, -cy);
    ctx.fillStyle = on;
    ctx.textAlign = 'center';
    drawLines(ctx, fs, tf, cx, cy - tf.height / 2);
    ctx.restore();
  });
  const sub = scene.items[0];
  if (sub) withAlpha(ctx, appear(frame, HERO.subtitle(0) + 10, 22), () => {
    const sf = fitText(ctx, fs, sub, { maxWidth: Math.min(R * 1.4, L.W - L.M * 2), maxLines: 2, maxSize: 28, minSize: 15, weight: 'regular', lineHeight: 1.4 });
    ctx.fillStyle = alpha(on, 0.85);
    ctx.textAlign = 'center';
    drawLines(ctx, fs, sf, cx, cy + tf.height / 2 + 24);
  });
}

/** خاتمة — بطاقة شكر: a thank-you card with a beating heart, lines as chips, the last as a button. */
export function drawOutroCard(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const items = shownItems(scene);
  const w = Math.min(L.W - L.M * 2, 820);
  const tf = fitText(ctx, fs, scene.title || ' ', { maxWidth: w - 80, maxLines: 2, maxSize: 58, minSize: 26, weight: 'bold', lineHeight: 1.3 });
  const h = tf.height + 250 + (items.length > 1 ? 70 : 0);
  const x = L.W / 2 - w / 2;
  const y = (L.H - h) / 2;
  const t = progress(frame, OUTRO.icon, 26);
  withAlpha(ctx, easeOutCubic(t), () => {
    ctx.save();
    ctx.translate(0, (1 - easeOutBack(t)) * 60);
    card(ctx, theme, x, y, w, h, 40, mix(theme.surface, theme.accent, 0.1));
    const beat = 1 + 0.08 * Math.max(0, Math.sin(frame / 6)) * appear(frame, 30, 10);
    iconBadge(ctx, theme, scene.icon || 'heart', L.W / 2, y + 70, 46 * beat);
    ctx.restore();
  });
  withAlpha(ctx, appear(frame, OUTRO.title, 22), () => {
    ctx.fillStyle = theme.foreground;
    ctx.textAlign = 'center';
    drawLines(ctx, fs, tf, L.W / 2, y + 140);
  });
  const lines = items.slice(0, Math.max(0, items.length - 1));
  const button = items[items.length - 1];
  let cx = L.W / 2;
  const chipY = y + 150 + tf.height + 20;
  if (lines.length) {
    const fits = lines.map((l) => fitText(ctx, fs, l, { maxWidth: w * 0.45, maxLines: 1, maxSize: 24, minSize: 14, weight: 'bold', lineHeight: 1.2 }));
    const total = fits.reduce((s, f) => s + f.width + 50, 0) - 14;
    cx = L.W / 2 + total / 2;
    fits.forEach((f, i) => {
      withAlpha(ctx, appear(frame, OUTRO.line(i), 18), () => {
        const cw = f.width + 36;
        ctx.fillStyle = alpha(theme.foreground, 0.08);
        roundRect(ctx, cx - cw, chipY, cw, 46, 23);
        ctx.fill();
        ctx.fillStyle = theme.foreground;
        ctx.textAlign = 'center';
        drawLines(ctx, fs, f, cx - cw / 2, chipY + 23 - f.height / 2);
        cx -= cw + 14;
      });
    });
  }
  if (button) {
    const bt = progress(frame, OUTRO.line(lines.length), 22);
    withAlpha(ctx, easeOutCubic(bt), () => {
      const bf = fitText(ctx, fs, button, { maxWidth: w - 120, maxLines: 1, maxSize: 30, minSize: 16, weight: 'bold', lineHeight: 1.2 });
      const bw = bf.width + 80;
      const by = y + h - 90;
      const pulse = 1 + 0.04 * Math.sin(frame / 8) * appear(frame, OUTRO.line(lines.length) + 20, 10);
      ctx.save();
      ctx.translate(L.W / 2, by + 30);
      ctx.scale(pulse * (0.8 + 0.2 * easeOutBack(bt)), pulse * (0.8 + 0.2 * easeOutBack(bt)));
      ctx.translate(-L.W / 2, -(by + 30));
      ctx.fillStyle = theme.accent;
      roundRect(ctx, L.W / 2 - bw / 2, by, bw, 60, 30);
      ctx.fill();
      ctx.fillStyle = readableOn(theme.accent);
      ctx.textAlign = 'center';
      drawLines(ctx, fs, bf, L.W / 2, by + 30 - bf.height / 2);
      ctx.restore();
    });
  }
}

/** فاصل قسم — شريحة مائلة: a diagonal slab sweeps across with the section title on it. */
export function drawChapterSlab(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const g = easeOutCubic(progress(frame, CHAPTER.mark, 26));
  const h = L.H * 0.42;
  const cy = L.H / 2;
  ctx.save();
  ctx.translate(L.W / 2, cy);
  ctx.rotate(-0.09);
  ctx.translate(-L.W / 2, -cy);
  const w = L.W * 1.4 * g;
  ctx.fillStyle = theme.accent;
  ctx.fillRect(L.W * 1.2 - w, cy - h / 2, w, h);
  ctx.fillStyle = theme.accent2;
  ctx.fillRect(L.W * 1.2 - w * 0.98, cy + h / 2, w * 0.98, 14);
  ctx.restore();
  const on = readableOn(theme.accent);
  const tf = fitText(ctx, fs, scene.title || ' ', { maxWidth: L.W - L.M * 3, maxLines: 2, maxSize: L.portrait ? 64 : 80, minSize: 30, weight: 'bold', lineHeight: 1.25 });
  const tt = progress(frame, CHAPTER.title, 22);
  withAlpha(ctx, easeOutCubic(tt), () => {
    ctx.fillStyle = on;
    ctx.textAlign = 'center';
    drawLines(ctx, fs, tf, L.W / 2 + (1 - easeOutCubic(tt)) * 80, cy - tf.height / 2 - 10);
    drawIcon(ctx, scene.icon, L.W / 2, cy - tf.height / 2 - 50, 40, on, 2.2);
  });
  const sub = scene.items[0];
  if (sub) withAlpha(ctx, appear(frame, CHAPTER.subtitle, 20), () => {
    const sf = fitText(ctx, fs, sub, { maxWidth: L.W - L.M * 3, maxLines: 2, maxSize: 30, minSize: 16, weight: 'regular', lineHeight: 1.35 });
    ctx.fillStyle = alpha(on, 0.85);
    ctx.textAlign = 'center';
    drawLines(ctx, fs, sf, L.W / 2, cy + tf.height / 2);
  });
}

const LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];

/** سؤال — مسابقة: answer tiles with letters, a shrinking timer bar, then the right tile lights up. */
export function drawQuizShow(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const top = drawHeader(a);
  const { options, answer } = quizParts(scene);
  const n = options.length;
  if (!n) return;
  const colors = palette(theme);
  const c0 = quizCountdown(scene);
  const shown = answer >= 0 && frame >= c0 + QUIZ_COUNTDOWN;
  const boxes = gridBoxes({ ...L, H: L.H - 60 }, top, n, 150, 18);
  options.forEach((o, i) => {
    const t = progress(frame, reveal(a, i, n), 20);
    if (t <= 0) return;
    const b = boxes[i];
    const color = colors[i % colors.length];
    const right = shown && i === answer;
    const dim = shown && i !== answer;
    itemEnter(a, t, b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, () => withAlpha(ctx, easeOutCubic(t) * (dim ? 0.35 : 1), () => {
      const pop = right ? 1 + 0.05 * Math.sin(frame / 5) : 1;
      ctx.save();
      ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
      ctx.scale(pop, pop);
      ctx.translate(-(b.x + b.w / 2), -(b.y + b.h / 2));
      ctx.fillStyle = right ? mix('#2ecc71', theme.surface, 0.2) : mix(color, theme.surface, 0.55);
      roundRect(ctx, b.x, b.y, b.w, b.h, 20);
      ctx.fill();
      const r = Math.min(26, b.h * 0.25);
      ctx.fillStyle = right ? '#ffffff' : color;
      ctx.beginPath();
      ctx.arc(b.x + b.w - r - 16, b.y + b.h / 2, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = right ? '#1e8449' : readableOn(color);
      ctx.font = font(fs, 'bold', r * 1.1);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(right ? '✓' : LETTERS[i] ?? String(i + 1), b.x + b.w - r - 16, b.y + b.h / 2 + 2);
      ctx.textBaseline = 'alphabetic';
      const f = fitText(ctx, fs, o, { maxWidth: b.w - r * 2 - 50, maxLines: 2, maxSize: 30, minSize: 14, weight: 'bold', lineHeight: 1.3 });
      ctx.fillStyle = right ? '#ffffff' : readableOn(mix(color, theme.surface, 0.55));
      ctx.textAlign = 'right';
      drawLines(ctx, fs, f, b.x + b.w - r * 2 - 32, b.y + b.h / 2 - f.height / 2);
      ctx.restore();
    }));
  });
  if (answer < 0) return;
  // Timer bar shrinking towards the reveal.
  const tp = progress(frame, c0, QUIZ_COUNTDOWN);
  if (tp > 0 && tp < 1) {
    const bw = L.W - L.M * 2;
    const y = L.H - L.M * 0.6 - 30;
    ctx.fillStyle = alpha(theme.foreground, 0.12);
    roundRect(ctx, L.M, y, bw, 16, 8);
    ctx.fill();
    ctx.fillStyle = tp > 0.66 ? '#e74c3c' : theme.accent;
    roundRect(ctx, L.M, y, bw * (1 - tp), 16, 8);
    ctx.fill();
  }
  if (shown) {
    const b = boxes[answer];
    confetti(ctx, b.x + b.w / 2, b.y + b.h / 2, frame - (c0 + QUIZ_COUNTDOWN), palette(theme), 7);
  }
}

/** صح أم خطأ — زرّان كبيران: two big buttons; the right one grows and glows, the wrong one shakes. */
export function drawTrueFalseButtons(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const { answer, note } = trueFalseParts(scene);
  const top = L.portrait ? L.M * 2 : L.M;
  const sf = fitText(ctx, fs, scene.title || ' ', { maxWidth: L.W - L.M * 2, maxLines: 4, maxSize: L.portrait ? 50 : 52, minSize: 24, weight: 'bold', lineHeight: 1.45 });
  withAlpha(ctx, appear(frame, TRUEFALSE.statement, 22), () => {
    ctx.fillStyle = theme.foreground;
    ctx.textAlign = 'center';
    drawLines(ctx, fs, sf, L.W / 2, top + 20);
  });
  const c0 = trueFalseCountdown(scene);
  const at = c0 + QUIZ_COUNTDOWN;
  const shown = answer !== null && frame >= at;
  const bw = L.portrait ? (L.W - L.M * 2 - 30) / 2 : 300;
  const bh = L.portrait ? 200 : 170;
  const by = top + sf.height + (L.portrait ? 160 : 90);
  const choices: [boolean, string, string][] = [[true, 'صح', '#2ecc71'], [false, 'خطأ', '#e74c3c']];
  choices.forEach(([value, label, color], k) => {
    const t = progress(frame, TRUEFALSE.choices + k * 8, 22);
    if (t <= 0) return;
    const x = L.W / 2 + (k === 0 ? 15 : -15 - bw) + (k === 0 ? 0 : 0);
    const right = shown && answer === value;
    const wrong = shown && answer !== value;
    const shake = wrong ? Math.sin((frame - at) * 1.2) * 10 * (1 - progress(frame, at, 24)) : 0;
    const grow = right ? 1 + 0.12 * easeOutBack(progress(frame, at, 18)) : 1;
    withAlpha(ctx, easeOutCubic(t) * (wrong ? 0.35 : 1), () => {
      ctx.save();
      ctx.translate(x + bw / 2 + shake, by + bh / 2);
      ctx.scale(grow * (0.7 + 0.3 * easeOutBack(t)), grow * (0.7 + 0.3 * easeOutBack(t)));
      ctx.translate(-(x + bw / 2), -(by + bh / 2));
      if (right) withAlpha(ctx, 0.35 + 0.2 * Math.sin(frame / 6), () => {
        ctx.fillStyle = color;
        roundRect(ctx, x - 14, by - 14, bw + 28, bh + 28, 40);
        ctx.fill();
      });
      ctx.fillStyle = color;
      roundRect(ctx, x, by, bw, bh, 32);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = font(fs, 'bold', bh * 0.36);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x + bw / 2, by + bh / 2 + 4);
      ctx.textBaseline = 'alphabetic';
      ctx.restore();
    });
  });
  // Countdown digit between/below the buttons.
  if (answer !== null) {
    const cp = progress(frame, c0, QUIZ_COUNTDOWN);
    if (cp > 0 && cp < 1) {
      const num = 3 - Math.floor(cp * 3);
      ctx.fillStyle = theme.accent;
      ctx.font = font(fs, 'bold', 60);
      ctx.textAlign = 'center';
      ctx.fillText(localizeDigits(String(num), a.digits), L.W / 2, by + bh + 90);
    }
  }
  if (shown && note) withAlpha(ctx, appear(frame, at + TRUEFALSE.note, 22), () => {
    const nf = fitText(ctx, fs, note, { maxWidth: L.W - L.M * 2, maxLines: 3, maxSize: 30, minSize: 16, weight: 'regular', lineHeight: 1.45 });
    ctx.fillStyle = theme.foreground;
    ctx.textAlign = 'center';
    drawLines(ctx, fs, nf, L.W / 2, by + bh + 50);
  });
}

/** ترتيب — سباق الأشرطة: bars race to their length; the top three wear medals. */
export function drawRankingBars(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const top = drawHeader(a);
  const rows = chartRows(scene);
  const n = rows.length;
  if (!n) return;
  const max = Math.max(1, ...rows.map((r) => r.num));
  const hasNums = rows.some((r) => r.num > 0);
  const avail = L.H - top - L.M * 0.6;
  const rowH = Math.min(90, avail / n);
  const y0 = top + (avail - rowH * n) / 2;
  const medals = ['#FFD54F', '#CFD8DC', '#D7A86E'];
  const barMax = L.W - L.M * 2 - 150;
  rows.forEach((r, i) => {
    const t = easeOutCubic(progress(frame, reveal(a, i, n), 34));
    if (t <= 0) return;
    const y = y0 + i * rowH;
    const color = i < 3 ? medals[i] : mix(theme.accent, theme.surface, 0.4);
    const len = hasNums ? (barMax * Math.max(0, r.num)) / max : barMax * (1 - i / (n + 1));
    itemEnter(a, t, L.W / 2, y + rowH / 2, L.W - L.M * 2, rowH, () => {
      const cx = L.W - L.M - 34;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, y + rowH / 2, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = readableOn(color);
      ctx.font = font(fs, 'bold', 26);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(localizeDigits(String(i + 1), a.digits), cx, y + rowH / 2 + 1);
      ctx.textBaseline = 'alphabetic';
      const bx = L.W - L.M - 80;
      const bh = rowH * 0.62;
      const bw = len * t;
      ctx.fillStyle = mix(color, theme.surface, i < 3 ? 0.1 : 0.3);
      roundRect(ctx, bx - bw, y + rowH / 2 - bh / 2, bw, bh, 12);
      ctx.fill();
      const lf = fitText(ctx, fs, r.label, { maxWidth: Math.max(80, bw - 30), maxLines: 1, maxSize: 26, minSize: 12, weight: 'bold', lineHeight: 1.2 });
      ctx.fillStyle = readableOn(mix(color, theme.surface, i < 3 ? 0.1 : 0.3));
      ctx.textAlign = 'right';
      drawLines(ctx, fs, lf, bx - 14, y + rowH / 2 - lf.height / 2);
      if (r.value) {
        ctx.fillStyle = theme.foreground;
        ctx.font = font(fs, 'bold', 24);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(localizeDigits(counted(r.value, t), a.digits), bx - bw - 12, y + rowH / 2);
        ctx.textBaseline = 'alphabetic';
      }
    });
  });
}

/** رسم خطي — مساحة: the line with a soft filled area under it, values floating over the points. */
export function drawLineArea(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const top = drawHeader(a);
  const rows = chartRows(scene);
  const n = rows.length;
  if (n < 2) return;
  const avail = L.H - top - L.M * 0.6;
  const x0 = L.W - L.M - 20;
  const x1 = L.M + 20;
  const yTop = top + 50;
  const yBot = top + avail - 50;
  const max = Math.max(1, ...rows.map((r) => r.num));
  const min = Math.min(0, ...rows.map((r) => r.num));
  const pt = (i: number): [number, number] => [x0 + ((x1 - x0) * i) / (n - 1), yBot - ((rows[i].num - min) / (max - min || 1)) * (yBot - yTop)];
  // How far along the line has drawn: up to the last revealed point, easing to the next.
  let along = 0;
  for (let i = 0; i < n; i++) {
    const p = progress(frame, reveal(a, i, n), 24);
    if (p > 0) along = i === 0 ? p : i - 1 + p;
  }
  if (along <= 0) return;
  const k = Math.floor(along);
  const f = along - k;
  const path: [number, number][] = [];
  for (let i = 0; i <= Math.min(k, n - 1); i++) path.push(pt(i));
  if (k < n - 1 && f > 0) {
    const [ax, ay] = pt(k);
    const [bx, by] = pt(k + 1);
    path.push([ax + (bx - ax) * f, ay + (by - ay) * f]);
  }
  const g = ctx.createLinearGradient(0, yTop, 0, yBot);
  g.addColorStop(0, alpha(theme.accent, 0.45));
  g.addColorStop(1, alpha(theme.accent, 0.02));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(path[0][0], yBot);
  path.forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.lineTo(path[path.length - 1][0], yBot);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 6;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  path.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.fillStyle = alpha(theme.foreground, 0.25);
  ctx.fillRect(x1, yBot, x0 - x1, 2);
  rows.forEach((r, i) => {
    const t = progress(frame, reveal(a, i, n), 20);
    if (t <= 0) return;
    const [x, y] = pt(i);
    ctx.fillStyle = theme.background;
    ctx.beginPath();
    ctx.arc(x, y, 10 * easeOutBack(t), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 4;
    ctx.stroke();
    withAlpha(ctx, easeOutCubic(t), () => {
      ctx.fillStyle = theme.foreground;
      ctx.font = font(fs, 'bold', 24);
      ctx.textAlign = 'center';
      ctx.fillText(localizeDigits(r.value || String(r.num), a.digits), x, y - 22);
      const lf = fitText(ctx, fs, r.label, { maxWidth: Math.abs(x0 - x1) / n, maxLines: 1, maxSize: 20, minSize: 11, weight: 'bold', lineHeight: 1.2 });
      ctx.fillStyle = alpha(theme.foreground, 0.75);
      drawLines(ctx, fs, lf, x, yBot + 12);
    });
  });
}

/** قبل وبعد — منزلق: one frame split by a divider that sweeps across to reveal «بعد». */
export function drawBeforeAfterSlider(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const top = drawHeader(a);
  const { before, after } = beforeAfterParts(scene);
  const avail = L.H - top - L.M * 0.6;
  const x = L.M;
  const w = L.W - L.M * 2;
  const y = top;
  const h = avail;
  const t0 = progress(frame, BEFORE_AFTER.before, 22);
  if (t0 <= 0) return;
  const at = beforeAfterAt(scene);
  // Divider position: starts at the right edge, sweeps to the middle, then over to the left.
  const s = easeInOutCubic(progress(frame, at, 40));
  const split = x + w - w * s;
  const panel = (text: string, label: string, color: string, clipX: number, clipW: number) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(clipX, y, clipW, h);
    ctx.clip();
    ctx.fillStyle = mix(theme.surface, color, 0.25);
    roundRect(ctx, x, y, w, h, 30);
    ctx.fill();
    ctx.fillStyle = color;
    roundRect(ctx, x + w / 2 - 80, y + 26, 160, 46, 23);
    ctx.fill();
    ctx.fillStyle = readableOn(color);
    ctx.font = font(fs, 'bold', 24);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + 50);
    ctx.textBaseline = 'alphabetic';
    const f = fitText(ctx, fs, text || ' ', { maxWidth: w - 120, maxLines: 4, maxSize: 46, minSize: 20, weight: 'bold', lineHeight: 1.45 });
    ctx.fillStyle = theme.foreground;
    drawLines(ctx, fs, f, x + w / 2, y + h / 2 - f.height / 2 + 20);
    ctx.restore();
  };
  withAlpha(ctx, easeOutCubic(t0), () => {
    panel(before, 'قبل', mix(theme.foreground, theme.surface, 0.5), x, split - x);
    if (s > 0) panel(after, 'بعد', theme.accent, split, x + w - split);
    if (s > 0 && s < 1) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(split - 3, y, 6, h);
      ctx.beginPath();
      ctx.arc(split, y + h / 2, 26, 0, Math.PI * 2);
      ctx.fill();
      drawIcon(ctx, 'arrow-left-right', split, y + h / 2, 30, '#161616', 2.4);
    }
  });
}

/** خريطة ذهنية — فقاعات: the idea in a big bubble, branches as smaller bubbles floating around it. */
export function drawMindmapBubbles(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const items = shownItems(scene);
  const n = items.length;
  const colors = palette(theme);
  const cx = L.W / 2;
  const cy = L.H / 2;
  const R0 = L.portrait ? 130 : 120;
  const t0 = easeOutBack(progress(frame, 4, 26));
  const rx = L.portrait ? L.W * 0.3 : L.W * 0.34;
  const ry = L.portrait ? L.H * 0.3 : L.H * 0.33;
  items.forEach((it, i) => {
    const t = progress(frame, reveal(a, i, n), 24);
    if (t <= 0) return;
    const ang = -Math.PI / 2 + (i * Math.PI * 2) / n;
    const x = cx + Math.cos(ang) * rx + Math.sin(frame / 37 + i) * 8;
    const y = cy + Math.sin(ang) * ry + Math.cos(frame / 43 + i) * 8;
    const color = colors[i % colors.length];
    const { head, body } = parts(it);
    const r = (L.portrait ? 92 : 88) * easeOutBack(t);
    ctx.strokeStyle = alpha(color, 0.5);
    ctx.lineWidth = 3;
    ctx.setLineDash([4, 8]);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + (x - cx) * easeOutCubic(t), cy + (y - cy) * easeOutCubic(t));
    ctx.stroke();
    ctx.setLineDash([]);
    if (r <= 0) return;
    withAlpha(ctx, clamp(t * 2), () => {
      ctx.fillStyle = mix(theme.surface, color, 0.4);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.stroke();
      const f = fitItem(a, body ? `${head}: ${body}` : head, r * 1.5, 24, 16, 2, 2);
      drawItem(a, f, x, y - f.height / 2);
    });
  });
  if (t0 > 0) {
    const g = ctx.createRadialGradient(cx - R0 * 0.3, cy - R0 * 0.3, 10, cx, cy, R0);
    g.addColorStop(0, mix(theme.accent, '#ffffff', 0.3));
    g.addColorStop(1, theme.accent);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, R0 * t0, 0, Math.PI * 2);
    ctx.fill();
    withAlpha(ctx, clamp(t0), () => {
      const tf = fitText(ctx, fs, scene.title || ' ', { maxWidth: R0 * 1.6, maxLines: 3, maxSize: 38, minSize: 16, weight: 'bold', lineHeight: 1.3 });
      ctx.fillStyle = readableOn(theme.accent);
      ctx.textAlign = 'center';
      drawLines(ctx, fs, tf, cx, cy - tf.height / 2);
    });
  }
}

/** جدول — بطاقات الصفوف: each row becomes a card listing the header's labels with its values. */
export function drawTableCards(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs, digits } = a;
  const top = drawHeader(a);
  const items = shownItems(scene);
  const n = items.length;
  if (n < 2) return;
  const rows = items.map((r) => r.split(/\s*[|｜؛]\s*|\s*،\s*/u).map((c) => c.trim()).filter((c) => c.length));
  const header = rows[0];
  const body = rows.slice(1);
  const colors = palette(theme);
  // The header row becomes a strip of column names (it is the first revealed element).
  const ht = progress(frame, reveal(a, 0, n), 20);
  if (ht > 0) withAlpha(ctx, easeOutCubic(ht), () => {
    const label = header.map((h) => localizeDigits(h, digits)).join('  •  ');
    const f = fitText(ctx, fs, label, { maxWidth: L.W - L.M * 2 - 40, maxLines: 1, maxSize: 24, minSize: 13, weight: 'bold', lineHeight: 1.2 });
    const w = f.width + 50;
    ctx.fillStyle = mix(theme.surface, theme.accent, 0.3);
    roundRect(ctx, L.W / 2 - w / 2, top, w, 44, 22);
    ctx.fill();
    ctx.fillStyle = theme.foreground;
    ctx.textAlign = 'center';
    drawLines(ctx, fs, f, L.W / 2, top + 22 - f.height / 2);
  });
  const boxes = gridBoxes(L, top + 64, body.length, 260, 20);
  body.forEach((cells, k) => {
    const i = k + 1;
    const t = progress(frame, reveal(a, i, n), 22);
    if (t <= 0) return;
    const b = boxes[k];
    const color = colors[k % colors.length];
    itemEnter(a, t, b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, () => withAlpha(ctx, easeOutCubic(t), () => {
      card(ctx, theme, b.x, b.y, b.w, b.h, 20);
      ctx.fillStyle = color;
      roundRect(ctx, b.x, b.y, b.w, 52, 20);
      ctx.fill();
      ctx.fillRect(b.x, b.y + 30, b.w, 22);
      const hf = fitText(ctx, fs, localizeDigits(cells[0] ?? '', digits), { maxWidth: b.w - 30, maxLines: 1, maxSize: 26, minSize: 13, weight: 'bold', lineHeight: 1.2 });
      ctx.fillStyle = readableOn(color);
      ctx.textAlign = 'center';
      drawLines(ctx, fs, hf, b.x + b.w / 2, b.y + 26 - hf.height / 2);
      const lines = cells.slice(1).map((v, c) => ({ label: header[c + 1] ?? '', value: v }));
      const lh = Math.min(44, (b.h - 70) / Math.max(1, lines.length));
      lines.forEach((ln, j) => {
        const y = b.y + 64 + j * lh;
        ctx.fillStyle = alpha(theme.foreground, 0.65);
        ctx.font = font(fs, 'regular', Math.min(20, lh * 0.5));
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(localizeDigits(ln.label, digits), b.x + b.w - 18, y + lh / 2);
        ctx.fillStyle = theme.foreground;
        ctx.font = font(fs, 'bold', Math.min(22, lh * 0.55));
        ctx.textAlign = 'left';
        ctx.fillText(localizeDigits(ln.value, digits), b.x + 18, y + lh / 2);
        ctx.textBaseline = 'alphabetic';
      });
    }));
  });
}
