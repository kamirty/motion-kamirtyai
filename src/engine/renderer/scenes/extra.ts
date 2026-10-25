import { localizeDigits } from '../../../design/digits';
import { alpha, mix, readableOn, textAccent } from '../../../design/presets';
import { clamp, easeOutBack, easeOutCubic, progress } from '../animation';
import { font } from '../context';
import { drawIcon } from '../icons';
import { confetti } from '../ambient';
import { effectiveItemIcons } from '../../itemIcons';
import { appear, drawHeader, itemEnter, roundRect, withAlpha, type SceneDrawArgs } from '../kit';
import { drawLines, fitText } from '../textLayout';
import { beforeAfterParts, chartRows, shownItems, trueFalseParts } from '../../sceneModel';
import { BEFORE_AFTER, QUIZ_COUNTDOWN, beforeAfterAt, TRUEFALSE, WARNING, itemReveal, trueFalseCountdown } from '../../timing';
import { formatStatValue, parseStatValue } from '../numbers';

const MEDALS = ['#F5C542', '#C9D1D9', '#D58A4A'];

/** ترتيب — podium for the top three (1st centre, 2nd right, 3rd left), the rest as a list; revealed last → first. */
export function drawRanking(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs, digits } = a;
  const top = drawHeader(a);
  const items = shownItems(scene);
  const n = items.length;
  if (!n) return;
  const rows = chartRows(scene);
  const podium = Math.min(3, n);
  const rest = n - podium;
  const side = !L.portrait && rest > 0;
  const avail = L.H - top - L.M * 0.6;
  const areaW = side ? (L.W - L.M * 2) * 0.62 : L.W - L.M * 2;
  const areaR = L.W - L.M;
  const listH = !side && rest ? Math.min(avail * 0.38, rest * 86) : 0;
  const floor = top + avail - listH - (listH ? 24 : 0);
  const colW = Math.min(240, (areaW - 40) / 3);
  const heights = [1, 0.74, 0.55].map((k) => (floor - top - 150) * k);
  // RTL podium: 1st in the centre, 2nd on the right, 3rd on the left.
  const slotX = (rank: number) => {
    const centre = areaR - areaW / 2;
    return rank === 0 ? centre : rank === 1 ? centre + colW + 16 : centre - colW - 16;
  };
  for (let rank = podium - 1; rank >= 0; rank--) {
    const t = progress(frame, itemReveal(scene, rank, n), 26);
    if (t <= 0) continue;
    const cx = slotX(rank);
    const h = heights[rank] * easeOutCubic(t);
    const color = MEDALS[rank];
    itemEnter(a, t, cx, floor - heights[rank] / 2, colW, heights[rank], () => {
      const g = ctx.createLinearGradient(0, floor - h, 0, floor);
      g.addColorStop(0, mix(theme.surface, color, 0.55));
      g.addColorStop(1, mix(theme.surface, color, 0.2));
      ctx.fillStyle = g;
      roundRect(ctx, cx - colW / 2, floor - h, colW, h + 6, 18);
      ctx.fill();
      // Rank number on the block.
      ctx.fillStyle = alpha(readableOn(mix(theme.surface, color, 0.4)), 0.85);
      ctx.font = font(fs, 'bold', Math.min(90, h * 0.45));
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (h > 60) ctx.fillText(localizeDigits(String(rank + 1), digits), cx, floor - h / 2 + 10);
      ctx.textBaseline = 'alphabetic';
      // Medal and name above the block.
      const mt = easeOutBack(clamp((t - 0.3) * 1.6));
      const my = floor - h - 44;
      if (mt > 0) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx, my, 30 * mt, 0, Math.PI * 2);
        ctx.fill();
        drawIcon(ctx, rank === 0 ? 'crown' : 'medal', cx, my, 34 * mt, '#2A2A2A', 2.2);
      }
      withAlpha(ctx, clamp((t - 0.4) * 2), () => {
        const label = rows[rank].label || items[rank];
        const f = fitText(ctx, fs, label, { maxWidth: colW + 30, maxLines: 2, maxSize: 32, minSize: 16, weight: 'bold', lineHeight: 1.3 });
        ctx.fillStyle = theme.foreground;
        ctx.textAlign = 'center';
        drawLines(ctx, fs, f, cx, my - 40 - f.height);
        if (rows[rank].value) {
          ctx.fillStyle = textAccent(theme, theme.accent);
          ctx.font = font(fs, 'bold', 26);
          ctx.fillText(localizeDigits(rows[rank].value, digits), cx, floor - 14);
        }
      });
    });
  }
  // Confetti when the winner takes first place.
  confetti(ctx, slotX(0), floor - heights[0] - 44, frame - itemReveal(scene, 0, n) - 16, MEDALS.concat(theme.accent), 11);
  // Floor line.
  ctx.fillStyle = alpha(theme.foreground, 0.2);
  ctx.fillRect(areaR - areaW, floor, areaW, 4);

  // Places 4+ as rows (beside the podium in landscape, below it otherwise).
  if (!rest) return;
  const lx = side ? L.M : L.M;
  const lw = side ? L.W - L.M * 2 - areaW - 30 : L.W - L.M * 2;
  const ly0 = side ? top + 20 : floor + 24;
  const rh = side ? Math.min(90, (avail - 40) / rest) : listH / rest;
  for (let k = 0; k < rest; k++) {
    const i = podium + k;
    const t = progress(frame, itemReveal(scene, i, n), 22);
    if (t <= 0) continue;
    const y = ly0 + k * rh;
    itemEnter(a, t, lx + lw / 2, y + rh / 2, lw, rh - 10, () => withAlpha(ctx, clamp(t * 1.6), () => {
      ctx.fillStyle = theme.surface;
      roundRect(ctx, lx, y, lw, rh - 10, 14);
      ctx.fill();
      ctx.fillStyle = theme.accent;
      ctx.font = font(fs, 'bold', 28);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(localizeDigits(`${i + 1}`, digits), lx + lw - 20, y + (rh - 10) / 2);
      ctx.textBaseline = 'alphabetic';
      const f = fitText(ctx, fs, rows[i].label || items[i], { maxWidth: lw - 170, maxLines: 1, maxSize: 26, minSize: 15, weight: 'bold' });
      ctx.fillStyle = theme.foreground;
      drawLines(ctx, fs, f, lx + lw - 64, y + (rh - 10) / 2 - f.height / 2);
      if (rows[i].value) {
        ctx.textAlign = 'left';
        ctx.fillStyle = textAccent(theme, theme.accent2);
        ctx.font = font(fs, 'bold', 24);
        ctx.textBaseline = 'middle';
        ctx.fillText(localizeDigits(rows[i].value, digits), lx + 18, y + (rh - 10) / 2);
        ctx.textBaseline = 'alphabetic';
      }
    }));
  }
}

/** صح أم خطأ — statement card, two choices, a 3-2-1 countdown, then a stamp on the right answer. */
export function drawTrueFalse(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs, digits } = a;
  const { answer, note } = trueFalseParts(scene);
  const c0 = trueFalseCountdown(scene);
  const revealAt = c0 + QUIZ_COUNTDOWN;
  const st = appear(frame, TRUEFALSE.statement, 26);
  const cardW = L.W - L.M * 2;
  const sf = fitText(ctx, fs, scene.title || 'العبارة', { maxWidth: cardW - 120, maxLines: L.portrait ? 6 : 3, maxSize: L.portrait ? 48 : 52, minSize: 24, weight: 'bold', lineHeight: 1.45 });
  const cardH = sf.height + 110;
  const bh = L.portrait ? 150 : 120;
  const gapY = L.portrait ? 90 : 50;
  // Statement, choices and the countdown/note below them, centred as one block.
  const y0 = Math.max(L.M * 0.6, (L.H - (cardH + gapY + bh + 140)) / 2);
  withAlpha(ctx, st, () => {
    ctx.fillStyle = theme.surface;
    roundRect(ctx, L.M, y0 + (1 - st) * 30, cardW, cardH, 28);
    ctx.fill();
    ctx.fillStyle = theme.accent;
    ctx.font = font(fs, 'bold', 30);
    ctx.textAlign = 'center';
    ctx.fillText('صح أم خطأ؟', L.W / 2, y0 + 52 + (1 - st) * 30);
    ctx.fillStyle = theme.foreground;
    drawLines(ctx, fs, sf, L.W / 2, y0 + 80 + (1 - st) * 30);
  });
  // Choices.
  const by = y0 + cardH + gapY;
  const bw = Math.min(330, (cardW - 40) / 2);
  const revealed = answer !== null && frame >= revealAt;
  const rt = easeOutBack(progress(frame, revealAt, 20));
  ([true, false] as const).forEach((val, k) => {
    const t = progress(frame, TRUEFALSE.choices + k * 10, 22);
    if (t <= 0) return;
    const cx = L.W / 2 + (k === 0 ? 1 : -1) * (bw / 2 + 20);
    const cy = by + bh / 2;
    const color = val ? '#2EAD66' : '#E5484D';
    const right = revealed && answer === val;
    const dim = revealed && !right ? 0.35 : 1;
    itemEnter(a, t, cx, cy, bw, bh, () => withAlpha(ctx, clamp(t * 1.6) * dim, () => {
      const s = right ? 1 + 0.06 * rt : 1;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(s, s);
      ctx.fillStyle = right ? color : mix(theme.surface, color, 0.25);
      roundRect(ctx, -bw / 2, -bh / 2, bw, bh, 26);
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = color;
      ctx.stroke();
      drawIcon(ctx, val ? 'check' : 'x', bw / 2 - 52, 0, 52, right ? '#ffffff' : color, 3);
      ctx.fillStyle = right ? '#ffffff' : theme.foreground;
      ctx.font = font(fs, 'bold', 44);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(val ? 'صح' : 'خطأ', -20, 2);
      ctx.textBaseline = 'alphabetic';
      ctx.restore();
    }));
    if (right) confetti(ctx, cx, cy, frame - revealAt, [color, theme.accent, '#FFD166', '#6C63FF'], 7);
  });
  if (answer === null) return;
  // Countdown, then the note under the choices.
  if (frame >= c0 - 10 && frame < revealAt + 12) {
    const fade = frame >= revealAt ? 1 - progress(frame, revealAt, 12) : appear(frame, c0 - 10, 10);
    const sec = Math.max(1, 3 - Math.floor((frame - c0) / 30));
    withAlpha(ctx, fade, () => {
      const cy = by + bh + 70;
      ctx.lineWidth = 8;
      ctx.strokeStyle = alpha(theme.foreground, 0.15);
      ctx.beginPath();
      ctx.arc(L.W / 2, cy, 40, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = theme.accent;
      ctx.beginPath();
      ctx.arc(L.W / 2, cy, 40, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - progress(frame, c0, QUIZ_COUNTDOWN)));
      ctx.stroke();
      ctx.fillStyle = theme.foreground;
      ctx.font = font(fs, 'bold', 44);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(localizeDigits(String(sec), digits), L.W / 2, cy + 3);
      ctx.textBaseline = 'alphabetic';
    });
  }
  if (note) {
    withAlpha(ctx, appear(frame, revealAt + TRUEFALSE.note, 26), () => {
      const f = fitText(ctx, fs, note, { maxWidth: cardW - 60, maxLines: 3, maxSize: 32, minSize: 18, weight: 'regular', lineHeight: 1.5 });
      ctx.fillStyle = theme.foreground;
      ctx.textAlign = 'center';
      drawLines(ctx, fs, f, L.W / 2, by + bh + 40);
    });
  }
}

/** رسم خطي — a line drawn point by point, each point popping at its cue with its value. */
export function drawLineChart(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs, digits } = a;
  const top = drawHeader(a);
  const rows = chartRows(scene);
  const n = rows.length;
  if (!n) return;
  const left = L.M + 20;
  const right = L.W - L.M - 20;
  const bottom = L.H - L.M - 50;
  const ceil = top + 60;
  const nums = rows.map((r) => r.num);
  const max = Math.max(...nums);
  const min = Math.min(0, ...nums);
  const span = max - min || 1;
  // RTL: first point on the right.
  const px = (i: number) => (n === 1 ? (left + right) / 2 : right - ((right - left) * i) / (n - 1));
  const py = (v: number) => bottom - ((v - min) / span) * (bottom - ceil);
  // Grid.
  ctx.strokeStyle = alpha(theme.foreground, 0.1);
  ctx.lineWidth = 2;
  for (let g = 0; g <= 4; g++) {
    const y = bottom - ((bottom - ceil) * g) / 4;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
  }
  // Area and line up to the latest revealed point (with the segment in progress).
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = progress(frame, itemReveal(scene, i, n), 24);
    if (t <= 0) break;
    const x = px(i);
    const y = py(rows[i].num);
    if (i > 0 && t < 1) {
      const [x0, y0] = pts[pts.length - 1];
      const e = easeOutCubic(t);
      pts.push([x0 + (x - x0) * e, y0 + (y - y0) * e]);
      break;
    }
    pts.push([x, y]);
  }
  if (pts.length) {
    const g = ctx.createLinearGradient(0, ceil, 0, bottom);
    g.addColorStop(0, alpha(theme.accent, 0.35));
    g.addColorStop(1, alpha(theme.accent, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], bottom);
    pts.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.lineTo(pts[pts.length - 1][0], bottom);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  }
  rows.forEach((r, i) => {
    const t = progress(frame, itemReveal(scene, i, n), 24);
    const x = px(i);
    // Axis label.
    withAlpha(ctx, appear(frame, 10, 20), () => {
      const f = fitText(ctx, fs, r.label, { maxWidth: Math.max(60, (right - left) / Math.max(1, n - 1) - 8), maxLines: 1, maxSize: 24, minSize: 13, weight: 'bold' });
      ctx.fillStyle = alpha(theme.foreground, 0.75);
      ctx.textAlign = 'center';
      drawLines(ctx, fs, f, x, bottom + 14);
    });
    const pt = easeOutBack(clamp((t - 0.6) * 2.5));
    if (pt <= 0) return;
    const y = py(r.num);
    ctx.fillStyle = theme.background;
    ctx.beginPath();
    ctx.arc(x, y, 13 * pt, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = theme.accent;
    ctx.beginPath();
    ctx.arc(x, y, 9 * pt, 0, Math.PI * 2);
    ctx.fill();
    const stat = parseStatValue(r.value);
    const label = stat ? formatStatValue(stat, stat.value) : r.value;
    if (label) {
      ctx.font = font(fs, 'bold', 26);
      const w = ctx.measureText(localizeDigits(label, digits)).width + 24;
      ctx.fillStyle = theme.accent2;
      roundRect(ctx, x - w / 2, y - 62 * pt, w, 40, 20);
      ctx.fill();
      ctx.fillStyle = readableOn(theme.accent2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(localizeDigits(label, digits), x, y - 62 * pt + 21);
      ctx.textBaseline = 'alphabetic';
    }
  });
}

/** قبل وبعد — the 'before' panel (muted), then the 'after' panel sweeps over from the right. */
export function drawBeforeAfter(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const top = drawHeader(a);
  const { before, after } = beforeAfterParts(scene);
  const vertical = L.portrait;
  const gap = vertical ? 120 : 70;
  const area = { x: L.M * 0.7, y: top, w: L.W - L.M * 1.4, h: L.H - top - L.M * 0.7 };
  const pw = vertical ? area.w : (area.w - gap) / 2;
  const ph = vertical ? (area.h - gap) / 2 : area.h;
  const afterAt = beforeAfterAt(scene);
  const panel = (label: string, text: string, x: number, y: number, color: string, icon: string, t: number) => {
    itemEnter(a, t, x + pw / 2, y + ph / 2, pw, ph, () => withAlpha(ctx, clamp(t * 1.6), () => {
      ctx.fillStyle = mix(theme.surface, color, 0.18);
      roundRect(ctx, x, y, pw, ph, 28);
      ctx.fill();
      ctx.fillStyle = color;
      roundRect(ctx, x + pw / 2 - 90, y - 26, 180, 52, 26);
      ctx.fill();
      ctx.fillStyle = readableOn(color);
      ctx.font = font(fs, 'bold', 30);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x + pw / 2, y + 2);
      ctx.textBaseline = 'alphabetic';
      drawIcon(ctx, icon, x + pw / 2, y + 90, 64, textAccent(theme, color), 2);
      const f = fitText(ctx, fs, text || '—', { maxWidth: pw - 70, maxLines: vertical ? 3 : 5, maxSize: 38, minSize: 18, weight: 'bold', lineHeight: 1.45 });
      ctx.fillStyle = theme.foreground;
      drawLines(ctx, fs, f, x + pw / 2, y + 140 + Math.max(0, (ph - 170 - f.height) / 2));
    }));
  };
  const bx = vertical ? area.x : area.x;
  const by = vertical ? area.y + 30 : area.y + 30;
  const ax = vertical ? area.x : area.x + pw + gap;
  const ay = vertical ? area.y + ph + gap + 30 : area.y + 30;
  // RTL: «قبل» on the right / top, «بعد» on the left / bottom.
  const icons = effectiveItemIcons(scene);
  panel('قبل', before, vertical ? bx : ax, by, mix(theme.foreground, theme.surface, 0.45), icons[0] ?? 'circle-x', progress(frame, BEFORE_AFTER.before, 26));
  panel('بعد', after, vertical ? ax : bx, ay, theme.accent, icons[1] ?? 'sparkles', progress(frame, afterAt, 30));
  // Arrow between them.
  const at = easeOutBack(progress(frame, afterAt - 12, 20));
  if (at > 0) {
    const cx = vertical ? L.W / 2 : area.x + pw + gap / 2;
    const cy = vertical ? area.y + ph + gap / 2 + 18 : area.y + 30 + (ph - 30) / 2;
    ctx.fillStyle = theme.accent;
    ctx.beginPath();
    ctx.arc(cx, cy, 30 * at, 0, Math.PI * 2);
    ctx.fill();
    drawIcon(ctx, vertical ? 'arrow-down' : 'arrow-left', cx, cy, 34 * at, readableOn(theme.accent), 3);
  }
}

/** تنبيه — hazard stripes, a shaking warning triangle, the headline and the text. */
export function drawWarning(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const red = '#E5484D';
  const amber = '#FFB224';
  // Hazard stripes sliding in at the top and bottom.
  const st = easeOutCubic(progress(frame, 0, 24));
  for (const y of [0, L.H - 34]) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y, L.W * st, 34);
    ctx.clip();
    ctx.fillStyle = amber;
    ctx.fillRect(0, y, L.W, 34);
    ctx.fillStyle = '#1A1A1A';
    for (let x = -60 + ((frame * 1.5) % 60); x < L.W + 60; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 30, y);
      ctx.lineTo(x + 10, y + 34);
      ctx.lineTo(x - 20, y + 34);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  const items = shownItems(scene);
  const tf = fitText(ctx, fs, scene.title || 'تنبيه', { maxWidth: L.W - L.M * 2, maxLines: 2, maxSize: L.portrait ? 60 : 64, minSize: 30, weight: 'bold', lineHeight: 1.3 });
  const bf = items[0] ? fitText(ctx, fs, items[0], { maxWidth: L.W - L.M * 2.4, maxLines: L.portrait ? 6 : 3, maxSize: 38, minSize: 20, weight: 'regular', lineHeight: 1.55 }) : null;
  const nf = items[1] ? fitText(ctx, fs, items[1], { maxWidth: L.W - L.M * 2.4, maxLines: 2, maxSize: 28, minSize: 16, weight: 'bold', lineHeight: 1.4 }) : null;
  const tri = L.portrait ? 120 : 100;
  const block = tri + 40 + tf.height + (bf ? bf.height + 26 : 0) + (nf ? nf.height + 22 : 0);
  let y = (L.H - block) / 2;
  // Triangle: pops in, then shakes briefly every two seconds.
  const pt = easeOutBack(progress(frame, WARNING.badge, 24));
  const w = frame % 60;
  const shake = w < 14 ? Math.sin(w * 1.8) * 0.12 * (1 - w / 14) : 0;
  if (pt > 0) {
    ctx.save();
    ctx.translate(L.W / 2, y + tri * 0.55);
    ctx.rotate(shake);
    ctx.scale(pt, pt);
    ctx.fillStyle = red;
    ctx.beginPath();
    ctx.moveTo(0, -tri * 0.55);
    ctx.lineTo(tri * 0.62, tri * 0.45);
    ctx.lineTo(-tri * 0.62, tri * 0.45);
    ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.lineWidth = 16;
    ctx.strokeStyle = red;
    ctx.stroke();
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    roundRect(ctx, -7, -tri * 0.22, 14, tri * 0.38, 7);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, tri * 0.29, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  y += tri + 40;
  withAlpha(ctx, appear(frame, WARNING.title, 24), () => {
    ctx.fillStyle = textAccent(theme, red);
    ctx.textAlign = 'center';
    drawLines(ctx, fs, tf, L.W / 2, y);
  });
  y += tf.height + 26;
  if (bf) {
    withAlpha(ctx, appear(frame, WARNING.text, 26), () => {
      ctx.fillStyle = theme.foreground;
      ctx.textAlign = 'center';
      drawLines(ctx, fs, bf, L.W / 2, y);
    });
    y += bf.height + 22;
  }
  if (nf) {
    withAlpha(ctx, appear(frame, WARNING.note, 26), () => {
      ctx.fillStyle = alpha(amber, 0.2);
      roundRect(ctx, L.W / 2 - nf.width / 2 - 24, y - 8, nf.width + 48, nf.height + 16, 14);
      ctx.fill();
      ctx.fillStyle = textAccent(theme, amber);
      ctx.textAlign = 'center';
      drawLines(ctx, fs, nf, L.W / 2, y);
    });
  }
}
