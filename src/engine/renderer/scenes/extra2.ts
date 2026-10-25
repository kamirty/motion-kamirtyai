import { localizeDigits } from '../../../design/digits';
import { alpha, mix, readableOn, textAccent } from '../../../design/presets';
import { clamp, easeOutBack, easeOutCubic, progress } from '../animation';
import { font } from '../context';
import { drawIcon } from '../icons';
import { appear, drawHeader, iconBadge, itemEnter, roundRect, withAlpha, type SceneDrawArgs } from '../kit';
import { drawLines, fitText } from '../textLayout';
import { chartRows, shownItems } from '../../sceneModel';
import { itemReveal } from '../../timing';
import { effectiveItemIcons } from '../../itemIcons';
import { drawSceneImageAvatar } from '../imageLayer';
import { radarPulse } from '../ambient';

/** "label: detail" → parts (detail optional). */
const parts = (s: string) => {
  const m = /^(.{1,40}?)\s*[:：]\s*(.+)$/u.exec(s);
  return m ? { head: m[1].trim(), body: m[2].trim() } : { head: s.trim(), body: '' };
};
const palette = (theme: SceneDrawArgs['theme']) => [theme.accent, theme.accent2, mix(theme.accent, '#4ECDC4', 0.55), mix(theme.accent2, '#FF6B6B', 0.5), mix(theme.accent, '#6C63FF', 0.5), mix(theme.foreground, theme.accent, 0.35)];

/** خريطة ذهنية — the title in a central bubble, branches curving out to each idea. */
export function drawMindmap(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const items = shownItems(scene);
  const n = items.length;
  const cx = L.W / 2;
  const cy = L.portrait ? L.H * 0.5 : L.H * 0.53;
  const R0 = L.portrait ? 120 : 110;
  const colors = palette(theme);
  // Centre bubble.
  const ct = easeOutBack(progress(frame, 4, 28));
  if (ct > 0) {
    withAlpha(ctx, appear(frame, 40, 30), () => radarPulse(ctx, cx, cy, R0, theme.accent, frame, 90));
    const g = ctx.createRadialGradient(cx - R0 * 0.3, cy - R0 * 0.3, R0 * 0.1, cx, cy, R0);
    g.addColorStop(0, mix(theme.accent, '#ffffff', 0.25));
    g.addColorStop(1, theme.accent);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, R0 * ct, 0, Math.PI * 2);
    ctx.fill();
    const tf = fitText(ctx, fs, scene.title || 'الفكرة', { maxWidth: R0 * 1.6, maxLines: 3, maxSize: 34, minSize: 16, weight: 'bold', lineHeight: 1.3 });
    withAlpha(ctx, clamp((ct - 0.4) * 2), () => {
      ctx.fillStyle = readableOn(theme.accent);
      ctx.textAlign = 'center';
      drawLines(ctx, fs, tf, cx, cy - tf.height / 2);
    });
  }
  const rx = L.portrait ? L.W * 0.34 : L.W * 0.33;
  const ry = L.portrait ? L.H * 0.3 : L.H * 0.31;
  items.forEach((it, i) => {
    const t = progress(frame, itemReveal(scene, i, n), 30);
    if (t <= 0) return;
    // Spread around the centre, starting at the upper right (reading start).
    const ang = -Math.PI / 2 + Math.PI / n + (i * Math.PI * 2) / n;
    const nx = cx + Math.cos(ang) * rx;
    const ny = cy + Math.sin(ang) * ry;
    const color = colors[i % colors.length];
    const { head, body } = parts(it);
    // Curved branch drawn from the centre outwards.
    const e = easeOutCubic(clamp(t * 1.6));
    const c1x = cx + Math.cos(ang) * R0 * 1.4;
    const c1y = cy + Math.sin(ang) * R0 * 0.6;
    ctx.save();
    ctx.strokeStyle = alpha(color, 0.85);
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.setLineDash([2000 * e, 4000]);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * R0 * 0.9, cy + Math.sin(ang) * R0 * 0.9);
    ctx.quadraticCurveTo(c1x, c1y, nx, ny);
    ctx.stroke();
    ctx.restore();
    const nt = clamp((t - 0.35) * 1.6);
    if (nt <= 0) return;
    const hf = fitText(ctx, fs, head, { maxWidth: L.portrait ? 220 : 250, maxLines: 2, maxSize: 28, minSize: 15, weight: 'bold', lineHeight: 1.3 });
    const bf = body ? fitText(ctx, fs, body, { maxWidth: L.portrait ? 220 : 250, maxLines: 2, maxSize: 20, minSize: 13, weight: 'regular', lineHeight: 1.35 }) : null;
    const w = Math.max(hf.width, bf?.width ?? 0) + 44;
    const h = hf.height + (bf ? bf.height + 6 : 0) + 26;
    const bx = Math.max(L.M * 0.4, Math.min(L.W - L.M * 0.4 - w, nx - w / 2));
    const by = Math.max(L.M * 0.4, Math.min(L.H - L.M * 0.6 - h, ny - h / 2));
    itemEnter(a, nt, bx + w / 2, by + h / 2, w, h, () => withAlpha(ctx, nt, () => {
      ctx.fillStyle = mix(theme.surface, color, 0.22);
      roundRect(ctx, bx, by, w, h, 22);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      roundRect(ctx, bx, by, w, h, 22);
      ctx.stroke();
      ctx.fillStyle = theme.foreground;
      ctx.textAlign = 'center';
      let y = drawLines(ctx, fs, hf, bx + w / 2, by + 13);
      if (bf) {
        ctx.fillStyle = alpha(theme.foreground, 0.75);
        drawLines(ctx, fs, bf, bx + w / 2, y + 6);
      }
    }));
  });
}

/** تقاطع (فِن) — two overlapping circles: what is special to each, and what they share. */
export function drawVenn(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const top = drawHeader(a);
  const items = shownItems(scene);
  const n = Math.min(3, items.length);
  if (!n) return;
  const avail = L.H - top - L.M * 0.6;
  const R = Math.min(avail * 0.48, L.portrait ? L.W * 0.4 : L.W * 0.21);
  const cy = top + avail / 2;
  const d = R * 0.62;
  const centres = L.portrait ? [[L.W / 2, cy - d], [L.W / 2, cy + d]] : [[L.W / 2 + d, cy], [L.W / 2 - d, cy]];
  const colors = [theme.accent, theme.accent2];
  for (let k = 0; k < Math.min(2, n); k++) {
    const t = easeOutBack(progress(frame, itemReveal(scene, k, n), 28));
    if (t <= 0) continue;
    const [x, y] = centres[k];
    ctx.fillStyle = alpha(colors[k], 0.3);
    ctx.strokeStyle = colors[k];
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, R * t, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const { head, body } = parts(items[k]);
    withAlpha(ctx, clamp((t - 0.5) * 2), () => {
      // Text sits in the part of the circle away from the overlap.
      const tx = L.portrait ? x : x + (k === 0 ? 1 : -1) * R * 0.42;
      const ty = L.portrait ? y + (k === 0 ? -1 : 1) * R * 0.42 : y;
      const maxW = L.portrait ? R * 1.3 : R * 0.95;
      const hf = fitText(ctx, fs, head, { maxWidth: maxW, maxLines: 2, maxSize: 32, minSize: 16, weight: 'bold', lineHeight: 1.3 });
      const bf = body ? fitText(ctx, fs, body, { maxWidth: maxW, maxLines: 3, maxSize: 22, minSize: 13, weight: 'regular', lineHeight: 1.4 }) : null;
      const hh = hf.height + (bf ? bf.height + 6 : 0);
      ctx.fillStyle = textAccent(theme, colors[k]);
      ctx.textAlign = 'center';
      const yy = drawLines(ctx, fs, hf, tx, ty - hh / 2);
      if (bf) {
        ctx.fillStyle = theme.foreground;
        drawLines(ctx, fs, bf, tx, yy + 6);
      }
    });
  }
  if (n >= 3) {
    const t = easeOutBack(progress(frame, itemReveal(scene, 2, n), 26));
    if (t > 0) {
      const { head, body } = parts(items[2]);
      const maxW = L.portrait ? R * 1.1 : R * 0.6;
      const f = fitText(ctx, fs, body ? `${head}: ${body}` : head, { maxWidth: maxW, maxLines: 4, maxSize: 24, minSize: 13, weight: 'bold', lineHeight: 1.35 });
      ctx.save();
      ctx.translate(L.W / 2, cy);
      ctx.scale(t, t);
      ctx.fillStyle = theme.background;
      roundRect(ctx, -f.width / 2 - 16, -f.height / 2 - 10, f.width + 32, f.height + 20, 16);
      ctx.fill();
      ctx.fillStyle = theme.foreground;
      ctx.textAlign = 'center';
      drawLines(ctx, fs, f, 0, -f.height / 2);
      ctx.restore();
    }
  }
}

/** جدول — the first element is the header row; cells are split by «|» or «،». Rows slide in. */
export function drawTable(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs, digits } = a;
  const top = drawHeader(a);
  const items = shownItems(scene);
  const n = items.length;
  if (!n) return;
  const rows = items.map((r) => r.split(/\s*[|｜؛]\s*|\s*،\s*/u).map((c) => c.trim()).filter((c) => c.length));
  const cols = Math.max(1, Math.min(4, ...rows.map((r) => r.length)));
  const w = L.W - L.M * 1.6;
  const x0 = L.M * 0.8;
  const avail = L.H - top - L.M * 0.6;
  const rh = Math.min(L.portrait ? 120 : 90, avail / n);
  const y0 = top + Math.max(0, (avail - rh * n) / 2);
  const cw = w / cols;
  rows.forEach((cells, i) => {
    const t = progress(frame, itemReveal(scene, i, n), 22);
    if (t <= 0) return;
    const head = i === 0 && n > 1;
    const y = y0 + i * rh;
    itemEnter(a, t, x0 + w / 2, y + rh / 2, w, rh, () => withAlpha(ctx, clamp(t * 1.6), () => {
      ctx.save();
      ctx.translate(-(1 - easeOutCubic(t)) * 40, 0);
      ctx.fillStyle = head ? theme.accent : i % 2 ? mix(theme.surface, theme.foreground, 0.04) : theme.surface;
      roundRect(ctx, x0, y + 3, w, rh - 6, head ? 18 : 12);
      ctx.fill();
      for (let c = 0; c < cols; c++) {
        // RTL: the first cell is the right-most column.
        const cxr = x0 + w - c * cw;
        const text = cells[c] ?? '';
        const f = fitText(ctx, fs, localizeDigits(text, digits), { maxWidth: cw - 28, maxLines: 2, maxSize: head ? 28 : 26, minSize: 13, weight: head || c === 0 ? 'bold' : 'regular', lineHeight: 1.3 });
        ctx.fillStyle = head ? readableOn(theme.accent) : c === 0 ? textAccent(theme, theme.accent) : theme.foreground;
        ctx.textAlign = 'center';
        drawLines(ctx, fs, f, cxr - cw / 2, y + rh / 2 - f.height / 2);
        if (c > 0) {
          ctx.fillStyle = alpha(head ? readableOn(theme.accent) : theme.foreground, 0.12);
          ctx.fillRect(cxr, y + 14, 2, rh - 28);
        }
      }
      ctx.restore();
    }));
  });
}

/** حلقات تقدّم — a gauge ring per element filling to its percentage while the number counts. */
export function drawGauges(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs, digits } = a;
  const top = drawHeader(a);
  const rows = chartRows(scene);
  const n = rows.length;
  if (!n) return;
  const cols = L.portrait ? (n <= 2 ? 1 : 2) : Math.min(n, n === 4 ? 4 : 3);
  const rowsN = Math.ceil(n / cols);
  const avail = L.H - top - L.M * 0.5;
  const cellW = (L.W - L.M * 2) / cols;
  const cellH = avail / rowsN;
  const R = Math.min(cellW * 0.32, cellH * 0.3, 120);
  const colors = palette(theme);
  rows.forEach((r, i) => {
    const t = progress(frame, itemReveal(scene, i, n), 50);
    if (t <= 0) return;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const inRow = row === rowsN - 1 ? n - row * cols : cols;
    const cx = L.W / 2 + ((inRow - 1) / 2 - col) * cellW;
    const cy = top + row * cellH + cellH * 0.42;
    const pct = Math.max(0, Math.min(100, r.num));
    const e = easeOutCubic(t);
    const color = colors[i % colors.length];
    itemEnter(a, clamp(t * 2), cx, cy, R * 2.4, R * 2.4, () => {
      ctx.lineCap = 'round';
      ctx.lineWidth = R * 0.22;
      ctx.strokeStyle = alpha(theme.foreground, 0.1);
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * pct * e) / 100);
      ctx.stroke();
      // Knob at the end of the arc.
      const ang = -Math.PI / 2 + (Math.PI * 2 * pct * e) / 100;
      ctx.fillStyle = theme.background;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R, R * 0.09, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = theme.foreground;
      ctx.font = font(fs, 'bold', R * 0.5);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(localizeDigits(`${Math.round(pct * e)}%`, digits), cx, cy + 2);
      ctx.textBaseline = 'alphabetic';
      const f = fitText(ctx, fs, r.label, { maxWidth: cellW - 30, maxLines: 2, maxSize: 26, minSize: 14, weight: 'bold', lineHeight: 1.3 });
      ctx.fillStyle = theme.foreground;
      drawLines(ctx, fs, f, cx, cy + R + R * 0.25 + 12);
    });
  });
}

/** مخطط تدفق — start, process boxes and end joined by arrows, flowing in reading order (snake). */
export function drawFlowchart(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const top = drawHeader(a);
  const items = shownItems(scene);
  const n = items.length;
  if (!n) return;
  const perRow = L.portrait ? 1 : n <= 4 ? n : 3;
  const rowsN = Math.ceil(n / perRow);
  const avail = L.H - top - L.M * 0.6;
  const gapX = 70;
  const gapY = L.portrait ? 46 : 64;
  const bw = L.portrait ? L.W - L.M * 3 : (L.W - L.M * 2 - gapX * (perRow - 1)) / perRow;
  const bh = Math.min(L.portrait ? 120 : 130, (avail - gapY * (rowsN - 1)) / rowsN);
  const y0 = top + Math.max(0, (avail - (bh * rowsN + gapY * (rowsN - 1))) / 2);
  const pos = (i: number) => {
    const row = Math.floor(i / perRow);
    let col = i % perRow;
    if (row % 2 === 1) col = perRow - 1 - col; // snake: odd rows flow back
    const x = L.W - L.M - bw - col * (bw + gapX) - (L.portrait ? L.M * 0.5 : 0);
    return { x, y: y0 + row * (bh + gapY), row };
  };
  items.forEach((it, i) => {
    const t = progress(frame, itemReveal(scene, i, n), 24);
    if (t <= 0) return;
    const { x, y } = pos(i);
    const terminal = (i === 0 || i === n - 1) && n > 2;
    const color = i === 0 ? theme.accent : i === n - 1 ? theme.accent2 : mix(theme.surface, theme.accent, 0.25);
    // Arrow from the previous box.
    if (i > 0) {
      const p = pos(i - 1);
      const at = easeOutCubic(clamp(t * 2));
      const sameRow = p.row === pos(i).row;
      // Same row: join the facing edges (rows alternate direction); next row: drop straight down.
      const [sx, sy, ex, ey] = !sameRow
        ? [p.x + bw / 2, p.y + bh, x + bw / 2, y]
        : x < p.x
          ? [p.x, p.y + bh / 2, x + bw, y + bh / 2]
          : [p.x + bw, p.y + bh / 2, x, y + bh / 2];
      const mx = sx + (ex - sx) * at;
      const my = sy + (ey - sy) * at;
      ctx.strokeStyle = alpha(theme.foreground, 0.55);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(mx, my);
      ctx.stroke();
      if (at > 0.95) {
        const ang = Math.atan2(ey - sy, ex - sx);
        ctx.fillStyle = alpha(theme.foreground, 0.7);
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - Math.cos(ang - 0.45) * 16, ey - Math.sin(ang - 0.45) * 16);
        ctx.lineTo(ex - Math.cos(ang + 0.45) * 16, ey - Math.sin(ang + 0.45) * 16);
        ctx.closePath();
        ctx.fill();
      }
    }
    const bt = clamp((t - 0.25) * 1.5);
    if (bt <= 0) return;
    itemEnter(a, bt, x + bw / 2, y + bh / 2, bw, bh, () => withAlpha(ctx, bt, () => {
      ctx.fillStyle = color;
      roundRect(ctx, x, y, bw, bh, terminal ? bh / 2 : 18);
      ctx.fill();
      const f = fitText(ctx, fs, it, { maxWidth: bw - 44, maxLines: 3, maxSize: 30, minSize: 14, weight: 'bold', lineHeight: 1.3 });
      ctx.fillStyle = readableOn(color);
      ctx.textAlign = 'center';
      drawLines(ctx, fs, f, x + bw / 2, y + bh / 2 - f.height / 2);
    }));
  });
}

/** بطاقة شخصية — the person's picture (or icon) in a ring, name, role and key facts. */
export function drawProfile(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const items = shownItems(scene);
  const [role = '', ...facts] = items;
  const side = !L.portrait;
  const R = side ? 150 : 130;
  const ax = side ? L.W - L.M - R - 40 : L.W / 2;
  const ay = side ? L.H / 2 : L.M * 2 + R;
  const at = easeOutBack(progress(frame, 4, 30));
  if (at > 0) {
    // Rotating ring of dashes around the portrait.
    ctx.save();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 5;
    ctx.setLineDash([18, 12]);
    ctx.lineDashOffset = -frame * 0.8;
    ctx.beginPath();
    ctx.arc(ax, ay, (R + 18) * at, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    if (!drawSceneImageAvatar(ctx, scene, ax, ay, R * at)) iconBadge(ctx, theme, scene.icon || 'user', ax, ay, R * at, theme.accent2);
  }
  const textR = side ? ax - R - 70 : L.W / 2;
  const textW = side ? textR - L.M : L.W - L.M * 2;
  const align: CanvasTextAlign = side ? 'right' : 'center';
  let y = side ? L.H / 2 - 150 : ay + R + 50;
  const nf = fitText(ctx, fs, scene.title || 'الاسم', { maxWidth: textW, maxLines: 2, maxSize: 64, minSize: 28, weight: 'bold', lineHeight: 1.25 });
  if (side) y = Math.max(L.M, L.H / 2 - (nf.height + 70 + facts.length * 52) / 2);
  withAlpha(ctx, appear(frame, 16, 26), () => {
    ctx.fillStyle = theme.foreground;
    ctx.textAlign = align;
    drawLines(ctx, fs, nf, textR, y);
  });
  y += nf.height + 12;
  if (role) {
    const rf = fitText(ctx, fs, role, { maxWidth: textW - 40, maxLines: 1, maxSize: 30, minSize: 16, weight: 'bold' });
    withAlpha(ctx, appear(frame, 30, 24), () => {
      const pw = rf.width + 40;
      const px = side ? textR - pw : textR - pw / 2;
      ctx.fillStyle = theme.accent;
      roundRect(ctx, px, y, pw, rf.height + 16, (rf.height + 16) / 2);
      ctx.fill();
      ctx.fillStyle = readableOn(theme.accent);
      ctx.textAlign = 'center';
      drawLines(ctx, fs, rf, px + pw / 2, y + 8);
    });
    y += rf.height + 40;
  }
  const icons = effectiveItemIcons({ ...scene, kind: 'summary', items: facts });
  facts.forEach((fact, k) => {
    const t = progress(frame, itemReveal(scene, k + 1, items.length), 22);
    if (t <= 0) return;
    const f = fitText(ctx, fs, fact, { maxWidth: textW - 60, maxLines: 2, maxSize: 28, minSize: 15, weight: 'regular', lineHeight: 1.35 });
    const rowY = y;
    y += Math.max(44, f.height) + 12;
    itemEnter(a, t, side ? textR - textW / 2 : L.W / 2, rowY + f.height / 2, textW, f.height, () => withAlpha(ctx, clamp(t * 1.6), () => {
      const ix = side ? textR - 20 : L.W / 2 - f.width / 2 - 34 + f.width + 44;
      ctx.fillStyle = alpha(theme.accent, 0.2);
      ctx.beginPath();
      ctx.arc(ix, rowY + Math.min(f.height, 44) / 2, 20, 0, Math.PI * 2);
      ctx.fill();
      drawIcon(ctx, icons[k] ?? 'star', ix, rowY + Math.min(f.height, 44) / 2, 24, textAccent(theme, theme.accent), 2.2);
      ctx.fillStyle = theme.foreground;
      ctx.textAlign = side ? 'right' : 'center';
      drawLines(ctx, fs, f, side ? textR - 54 : L.W / 2 - 22, rowY + Math.max(0, (44 - f.height) / 2));
    }));
  });
}
