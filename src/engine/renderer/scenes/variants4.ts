import { localizeDigits } from '../../../design/digits';
import { alpha, mix, readableOn, textAccent } from '../../../design/presets';
import { getBitmap } from '../../../storage/assets';
import { effectiveItemIcons } from '../../itemIcons';
import { chartRows, kpiParts, pictogramRatio, shownItems } from '../../sceneModel';
import { DEFINITION, PICTOGRAM, QUOTE, itemReveal } from '../../timing';
import { clamp, easeInOutCubic, easeOutBack, easeOutCubic, progress } from '../animation';
import { font } from '../context';
import { drawIcon } from '../icons';
import { appear, card, drawHeader, iconBadge, itemEnter, roundRect, withAlpha, type SceneDrawArgs } from '../kit';
import { drawLines, fitText } from '../textLayout';
import { palette, parts } from './extra2';
import { drawItem, fitItem, gridBoxes, lastRevealed, numberDisc } from './extra3';
import { counted } from './variants1';

/**
 * Fourth batch of alternative layouts (gauges, pictogram, flowchart, venn, profile, KPIs,
 * cards, steps, checklist, definition, quote). Same content formats and reveal times.
 */

const reveal = (a: SceneDrawArgs, i: number, n: number) => itemReveal(a.scene, i, n);

/** حلقات تقدّم — أشرطة تحميل: striped loading bars filling to each percentage. */
export function drawGaugesBars(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const top = drawHeader(a);
  const rows = chartRows(scene);
  const n = rows.length;
  if (!n) return;
  const colors = palette(theme);
  const avail = L.H - top - L.M * 0.6;
  const rowH = Math.min(120, avail / n);
  const y0 = top + (avail - rowH * n) / 2;
  const w = L.W - L.M * 2;
  rows.forEach((r, i) => {
    const t = easeOutCubic(progress(frame, reveal(a, i, n), 50));
    if (t <= 0) return;
    const y = y0 + i * rowH;
    const color = colors[i % colors.length];
    const pct = clamp(r.num / 100);
    itemEnter(a, t, L.W / 2, y + rowH / 2, w, rowH, () => {
      const lf = fitText(ctx, fs, r.label, { maxWidth: w - 140, maxLines: 1, maxSize: 26, minSize: 13, weight: 'bold', lineHeight: 1.2 });
      ctx.fillStyle = theme.foreground;
      ctx.textAlign = 'right';
      drawLines(ctx, fs, lf, L.W - L.M, y + 4);
      ctx.fillStyle = textAccent(theme, color);
      ctx.font = font(fs, 'bold', 28);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(localizeDigits(`${Math.round(r.num * t)}%`, a.digits), L.M, y + 2);
      ctx.textBaseline = 'alphabetic';
      const bh = Math.min(30, rowH * 0.3);
      const by = y + rowH * 0.5;
      ctx.fillStyle = alpha(theme.foreground, 0.1);
      roundRect(ctx, L.M, by, w, bh, bh / 2);
      ctx.fill();
      const fw = w * pct * t;
      ctx.save();
      roundRect(ctx, L.W - L.M - fw, by, fw, bh, bh / 2);
      ctx.clip();
      ctx.fillStyle = color;
      ctx.fillRect(L.W - L.M - fw, by, fw, bh);
      // Moving diagonal stripes.
      ctx.fillStyle = alpha('#ffffff', 0.18);
      const off = (frame * 1.5) % 40;
      for (let x = L.W - L.M - fw - 40 + off; x < L.W - L.M + 40; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, by + bh);
        ctx.lineTo(x + 18, by);
        ctx.lineTo(x + 34, by);
        ctx.lineTo(x + 16, by + bh);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    });
  });
}

/** رسم بالأيقونات — شبكة مئوية: a 10×10 grid of squares filling to the share, with the big %. */
export function drawPictogramWaffle(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs, digits } = a;
  const top = drawHeader(a);
  const ratio = pictogramRatio(scene.items[0] ?? '');
  const share = ratio ? ratio.filled / Math.max(1, ratio.total) : 0;
  const cells = Math.round(share * 100);
  const avail = L.H - top - L.M * 0.6;
  const side = !L.portrait;
  const size = side ? Math.min(avail, L.W * 0.42) : Math.min(L.W - L.M * 2, avail * 0.55);
  const gx = side ? L.W - L.M - size : L.W / 2 - size / 2;
  const gy = side ? top + (avail - size) / 2 : top;
  const cell = size / 10;
  const fill = progress(frame, PICTOGRAM.fillStart, PICTOGRAM.fillLength);
  const lit = Math.round(cells * easeInOutCubic(fill));
  for (let k = 0; k < 100; k++) {
    // Snake order from the top right, row by row (reading order).
    const row = Math.floor(k / 10);
    const col = row % 2 ? 9 - (k % 10) : k % 10;
    const x = gx + size - (col + 1) * cell;
    const y = gy + row * cell;
    const on = k < lit;
    const t = appear(frame, PICTOGRAM.grid + row * 2, 14);
    if (t <= 0) continue;
    withAlpha(ctx, t, () => {
      ctx.fillStyle = on ? (k < cells ? theme.accent : theme.accent2) : alpha(theme.foreground, 0.1);
      roundRect(ctx, x + 3, y + 3, cell - 6, cell - 6, cell * 0.2);
      ctx.fill();
    });
  }
  const pct = localizeDigits(`${Math.round(share * 100 * easeInOutCubic(fill))}%`, digits);
  const tx = side ? L.M : L.M;
  const tw = side ? gx - L.M - 40 : L.W - L.M * 2;
  const ty = side ? top + avail * 0.25 : gy + size + 30;
  withAlpha(ctx, appear(frame, PICTOGRAM.fillStart, 20), () => {
    const pf = fitText(ctx, fs, pct, { maxWidth: tw, maxLines: 1, maxSize: 130, minSize: 40, weight: 'bold', lineHeight: 1.05 });
    ctx.fillStyle = textAccent(theme, theme.accent);
    ctx.textAlign = 'center';
    drawLines(ctx, fs, pf, tx + tw / 2, ty);
  });
  const desc = scene.items.slice(1).join(' ');
  if (desc) withAlpha(ctx, appear(frame, PICTOGRAM.description, 20), () => {
    const df = fitText(ctx, fs, desc, { maxWidth: tw, maxLines: 4, maxSize: 32, minSize: 16, weight: 'bold', lineHeight: 1.45 });
    ctx.fillStyle = theme.foreground;
    ctx.textAlign = 'center';
    drawLines(ctx, fs, df, tx + tw / 2, ty + (side ? 150 : 110));
  });
}

/** مخطط تدفق — عمودي: steps stacked down the middle, zigzagging slightly, joined by arrows. */
export function drawFlowchartVertical(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L } = a;
  const top = drawHeader(a);
  const items = shownItems(scene);
  const n = items.length;
  if (!n) return;
  const colors = palette(theme);
  const avail = L.H - top - L.M * 0.6;
  const gap = 34;
  const h = Math.min(L.portrait ? 120 : 76, (avail - gap * (n - 1)) / n);
  const w = Math.min(L.W - L.M * 2 - 80, L.portrait ? 520 : 560);
  const y0 = top + (avail - (h * n + gap * (n - 1))) / 2;
  const shift = L.portrait ? 30 : 90;
  const xOf = (i: number) => L.W / 2 - w / 2 + (i % 2 ? -shift : shift);
  items.forEach((it, i) => {
    const t = progress(frame, reveal(a, i, n), 22);
    if (t <= 0) return;
    const x = xOf(i);
    const y = y0 + i * (h + gap);
    const color = colors[i % colors.length];
    const terminal = i === 0 || i === n - 1;
    if (i > 0) {
      const px = xOf(i - 1) + w / 2;
      const py = y - gap;
      const e = easeOutCubic(clamp(t * 2));
      ctx.strokeStyle = alpha(theme.foreground, 0.5);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + (x + w / 2 - px) * e, py + gap * e);
      ctx.stroke();
      if (e >= 1) {
        ctx.fillStyle = alpha(theme.foreground, 0.5);
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y);
        ctx.lineTo(x + w / 2 - 8, y - 12);
        ctx.lineTo(x + w / 2 + 8, y - 12);
        ctx.closePath();
        ctx.fill();
      }
    }
    itemEnter(a, t, x + w / 2, y + h / 2, w, h, () => withAlpha(ctx, easeOutCubic(t), () => {
      ctx.fillStyle = terminal ? color : mix(theme.surface, color, 0.25);
      roundRect(ctx, x, y, w, h, terminal ? h / 2 : 14);
      ctx.fill();
      const f = fitItem(a, it, w - 50, 26, 18, 2, 1);
      drawItem(a, f, x + w / 2, y + h / 2 - f.height / 2, terminal ? readableOn(color) : theme.foreground);
    }));
  });
}

/** تقاطع — جسر: two cards apart, and what they share rises as a card between them, linked to both. */
export function drawVennBridge(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const top = drawHeader(a);
  const items = shownItems(scene).slice(0, 3);
  const n = shownItems(scene).length;
  if (!items.length) return;
  const colors = [theme.accent, theme.accent2, mix(theme.accent, theme.accent2, 0.5)];
  const avail = L.H - top - L.M * 0.6;
  const vertical = L.portrait;
  const cw = vertical ? L.W - L.M * 2 : (L.W - L.M * 2) * 0.34;
  const ch = vertical ? avail * 0.27 : avail * 0.7;
  const pos = vertical
    ? [{ x: L.M, y: top }, { x: L.M, y: top + avail - ch }, { x: L.M + cw * 0.12, y: top + avail / 2 - ch * 0.4 }]
    : [{ x: L.W - L.M - cw, y: top + (avail - ch) / 2 }, { x: L.M, y: top + (avail - ch) / 2 }, { x: L.W / 2 - cw * 0.42, y: top + avail / 2 - ch * 0.32 }];
  const sizes = vertical ? [[cw, ch], [cw, ch], [cw * 0.76, ch * 0.8]] : [[cw, ch], [cw, ch], [cw * 0.84, ch * 0.64]];
  items.forEach((it, i) => {
    const t = progress(frame, reveal(a, i, n), 24);
    if (t <= 0) return;
    const { x, y } = pos[i];
    const [w, h] = sizes[i];
    const color = colors[i];
    const shared = i === 2;
    if (shared) {
      // Links from the shared card to both sides.
      ctx.strokeStyle = alpha(color, 0.7);
      ctx.lineWidth = 4;
      ctx.setLineDash([8, 8]);
      ctx.lineDashOffset = -frame;
      for (const k of [0, 1]) {
        const p = pos[k];
        const [pw, ph] = sizes[k];
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y + h / 2);
        ctx.lineTo(p.x + pw / 2, p.y + ph / 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    const { head, body } = parts(it);
    itemEnter(a, t, x + w / 2, y + h / 2, w, h, () => withAlpha(ctx, easeOutCubic(t), () => {
      ctx.save();
      if (shared) {
        ctx.translate(0, (1 - easeOutBack(t)) * 50);
      }
      card(ctx, theme, x, y, w, h, 26, shared ? mix(theme.surface, color, 0.45) : mix(theme.surface, color, 0.18));
      ctx.strokeStyle = color;
      ctx.lineWidth = shared ? 5 : 3;
      roundRect(ctx, x, y, w, h, 26);
      ctx.stroke();
      const hf = fitText(ctx, fs, head, { maxWidth: w - 40, maxLines: 2, maxSize: 32, minSize: 15, weight: 'bold', lineHeight: 1.3 });
      const bf = body ? fitText(ctx, fs, body, { maxWidth: w - 40, maxLines: 4, maxSize: 22, minSize: 12, weight: 'regular', lineHeight: 1.4 }) : null;
      drawItem(a, { hf, bf }, x + w / 2, y + h / 2 - (hf.height + (bf ? bf.height + 6 : 0)) / 2, textAccent(theme, color));
      ctx.restore();
    }));
  });
}

/** بطاقة شخصية — بطاقة هوية: an ID card tilting in, photo (or icon) on the right, facts listed. */
export function drawProfileId(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const items = shownItems(scene);
  const n = items.length;
  const [role = '', ...facts] = items;
  const w = Math.min(L.W - L.M * 2, L.portrait ? 620 : 1000);
  const h = Math.min(L.H - L.M * 2, L.portrait ? 900 : 480);
  const x = L.W / 2 - w / 2;
  const y = L.H / 2 - h / 2;
  const t = progress(frame, 4, 28);
  withAlpha(ctx, easeOutCubic(t), () => {
    ctx.save();
    ctx.translate(L.W / 2, L.H / 2);
    ctx.transform(1, (1 - easeOutBack(t)) * 0.12, 0, 1, 0, 0);
    ctx.scale(0.85 + 0.15 * easeOutCubic(t), 0.85 + 0.15 * easeOutCubic(t));
    ctx.translate(-L.W / 2, -L.H / 2);
    card(ctx, theme, x, y, w, h, 30, mix(theme.surface, '#ffffff', 0.04));
    ctx.fillStyle = theme.accent;
    roundRect(ctx, x, y, w, 64, 30);
    ctx.fill();
    ctx.fillRect(x, y + 34, w, 30);
    ctx.fillStyle = readableOn(theme.accent);
    ctx.font = font(fs, 'bold', 24);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('بطاقة تعريف', x + w - 30, y + 32);
    ctx.textBaseline = 'alphabetic';
    // Photo square or icon.
    const ps = L.portrait ? w * 0.42 : h * 0.52;
    const px = L.portrait ? L.W / 2 - ps / 2 : x + w - ps - 40;
    const py = y + 96;
    const img = scene.images?.[0];
    const bmp = img ? getBitmap(img.assetId) : undefined;
    ctx.save();
    roundRect(ctx, px, py, ps, ps, 20);
    ctx.clip();
    if (bmp) {
      const k = Math.max(ps / bmp.width, ps / bmp.height);
      ctx.drawImage(bmp, px + ps / 2 - (bmp.width * k) / 2, py + ps / 2 - (bmp.height * k) / 2, bmp.width * k, bmp.height * k);
    } else {
      ctx.fillStyle = mix(theme.surface, theme.accent, 0.3);
      ctx.fillRect(px, py, ps, ps);
      drawIcon(ctx, scene.icon || 'user', px + ps / 2, py + ps / 2, ps * 0.5, theme.foreground, 2);
    }
    ctx.restore();
    // Name and role.
    const tx = L.portrait ? L.W / 2 : px - 40;
    const tw = L.portrait ? w - 60 : px - x - 80;
    let ty = L.portrait ? py + ps + 30 : py;
    ctx.textAlign = L.portrait ? 'center' : 'right';
    const nf = fitText(ctx, fs, scene.title || ' ', { maxWidth: tw, maxLines: 2, maxSize: 48, minSize: 22, weight: 'bold', lineHeight: 1.3 });
    ctx.fillStyle = theme.foreground;
    ty = drawLines(ctx, fs, nf, tx, ty);
    if (role) {
      const rf = fitText(ctx, fs, role, { maxWidth: tw, maxLines: 2, maxSize: 26, minSize: 14, weight: 'bold', lineHeight: 1.35 });
      ctx.fillStyle = textAccent(theme, theme.accent);
      ty = drawLines(ctx, fs, rf, tx, ty + 8);
    }
    ctx.fillStyle = alpha(theme.foreground, 0.2);
    ctx.fillRect(L.portrait ? x + 40 : x + 40, ty + 16, L.portrait ? w - 80 : tw, 2);
    facts.forEach((f, k) => {
      const ft = appear(frame, reveal(a, k + 1, n), 18);
      if (ft <= 0) return;
      const yy = ty + 36 + k * 46;
      withAlpha(ctx, ft, () => {
        const ff = fitText(ctx, fs, f, { maxWidth: tw - 40, maxLines: 1, maxSize: 24, minSize: 12, weight: 'regular', lineHeight: 1.3 });
        ctx.fillStyle = theme.foreground;
        ctx.textAlign = L.portrait ? 'center' : 'right';
        drawLines(ctx, fs, ff, L.portrait ? L.W / 2 : tx - 34, yy);
        if (!L.portrait) drawIcon(ctx, 'circle-check', tx - 12, yy + ff.height / 2, 22, theme.accent, 2.4);
      });
    });
    ctx.restore();
  });
}

/** أرقام سريعة — لوحة النتائج: split-flap scoreboard panels flipping to each number. */
export function drawKpisScoreboard(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs, digits } = a;
  const top = drawHeader(a);
  const items = shownItems(scene);
  const n = items.length;
  if (!n) return;
  const colors = palette(theme);
  gridBoxes(L, top, n, 230, 20).forEach((b, i) => {
    const t = progress(frame, reveal(a, i, n), 20);
    if (t <= 0) return;
    const { value, label } = kpiParts(items[i]);
    const color = colors[i % colors.length];
    const p = easeOutCubic(progress(frame, reveal(a, i, n), 45));
    itemEnter(a, t, b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, () => withAlpha(ctx, easeOutCubic(t), () => {
      const ph = b.h * 0.6;
      ctx.fillStyle = '#141414';
      roundRect(ctx, b.x, b.y, b.w, ph, 16);
      ctx.fill();
      // The flap: its top half folds down every few frames while counting.
      const flip = p < 1 ? (frame % 6) / 6 : 1;
      ctx.fillStyle = '#1f1f1f';
      roundRect(ctx, b.x + 6, b.y + 6, b.w - 12, ph / 2 - 8, 10);
      ctx.fill();
      ctx.fillStyle = alpha('#000000', 0.6);
      ctx.fillRect(b.x + 6, b.y + ph / 2 - 1, b.w - 12, 2);
      const shown = localizeDigits(value ? counted(value, p) : '—', digits);
      const vf = fitText(ctx, fs, shown, { maxWidth: b.w - 30, maxLines: 1, maxSize: ph * 0.62, minSize: 18, weight: 'bold', lineHeight: 1.05 });
      ctx.save();
      ctx.translate(b.x + b.w / 2, b.y + ph / 2);
      ctx.scale(1, flip < 1 ? 0.75 + 0.25 * Math.abs(Math.cos(flip * Math.PI)) : 1);
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      drawLines(ctx, fs, vf, 0, -vf.height / 2);
      ctx.restore();
      const lf = fitText(ctx, fs, label || items[i], { maxWidth: b.w - 20, maxLines: 2, maxSize: 24, minSize: 12, weight: 'bold', lineHeight: 1.3 });
      ctx.fillStyle = theme.foreground;
      ctx.textAlign = 'center';
      drawLines(ctx, fs, lf, b.x + b.w / 2, b.y + ph + 14);
    }));
  });
}

/** بطاقات — مروحة: cards slide out of a deck and settle fanned like a hand of playing cards. */
export function drawSummaryFan(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L } = a;
  const top = drawHeader(a);
  const items = shownItems(scene);
  const n = items.length;
  if (!n) return;
  const icons = effectiveItemIcons(scene);
  const colors = palette(theme);
  const avail = L.H - top - L.M * 0.6;
  const w = L.portrait ? Math.min(L.W * 0.56, 380) : Math.min(260, (L.W - L.M * 2) / Math.max(1.6, n * 0.62));
  const h = Math.min(avail * 0.7, w * 1.35);
  // Cards hang from a pivot below them; the fan's lowest corners stay inside the frame.
  const pivotX = L.W / 2;
  const pivotY = top + avail * 0.5 + h * 0.95 + h * 0.15;
  const spread = Math.min(L.portrait ? 0.16 : 0.22, (L.portrait ? 0.7 : 1.05) / Math.max(1, n));
  // The newest card stands upright in front, readable; earlier cards fan out behind it.
  const k = lastRevealed(a, n);
  const drawCard = (i: number, front: number) => {
    const t = progress(frame, reveal(a, i, n), 24);
    if (t <= 0) return;
    const fanAng = ((n - 1) / 2 - i) * spread;
    const ang = fanAng * (1 - front) * easeOutBack(t);
    const color = colors[i % colors.length];
    withAlpha(ctx, clamp(t * 2) * (front > 0 ? 1 : 0.85), () => {
      ctx.save();
      ctx.translate(pivotX, pivotY);
      ctx.rotate(ang);
      ctx.translate(0, -h * 0.95 - front * h * 0.12 + (1 - easeOutCubic(t)) * 80);
      const s = 1 + 0.08 * front;
      ctx.scale(s, s);
      card(ctx, theme, -w / 2, -h / 2, w, h, 22, mix(theme.surface, color, front > 0 ? 0.22 : 0.12));
      ctx.strokeStyle = color;
      ctx.lineWidth = front > 0 ? 4 : 2;
      roundRect(ctx, -w / 2, -h / 2, w, h, 22);
      ctx.stroke();
      iconBadge(ctx, theme, icons[i] ?? scene.icon, 0, -h / 2 + 56, 34, color);
      if (front > 0) withAlpha(ctx, front, () => {
        const f = fitItem(a, items[i], w - 40, 30, 20, 3, 3);
        drawItem(a, f, 0, -h / 2 + 110);
      });
      numberDisc(a, i + 1, -w / 2 + 26, h / 2 - 26, 14, color);
      ctx.restore();
    });
  };
  for (let i = 0; i < n; i++) if (i !== k) drawCard(i, 0);
  if (k >= 0) drawCard(k, easeOutCubic(progress(frame, reveal(a, k, n), 20)));
}

/** خطوات — طريق متعرّج: a winding road drawn as it goes, a numbered pin dropping at each stop. */
export function drawStepsRoad(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L } = a;
  const top = drawHeader(a);
  const items = shownItems(scene);
  const n = items.length;
  if (!n) return;
  const colors = palette(theme);
  const avail = L.H - top - L.M * 0.6;
  // Points along an S-curve from the top right down to the bottom left.
  const pt = (s: number): [number, number] => {
    if (L.portrait) return [L.W / 2 + Math.sin(s * Math.PI * 2) * L.W * 0.26, top + 30 + s * (avail - 60)];
    return [L.W - L.M - 40 - s * (L.W - L.M * 2 - 80), top + avail / 2 + Math.sin(s * Math.PI * 2) * avail * 0.28];
  };
  const stop = (i: number) => (n === 1 ? 0.5 : i / (n - 1));
  let drawn = 0;
  for (let i = 0; i < n; i++) if (frame >= reveal(a, i, n)) drawn = stop(i);
  const next = items.findIndex((_, i) => frame < reveal(a, i, n));
  if (next > 0) drawn += (stop(next) - stop(next - 1)) * easeInOutCubic(progress(frame, reveal(a, next, n) - 20, 20));
  // Road: thick band with dashed centre line.
  const road = (to: number, width: number, color: string, dash?: number[]) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.setLineDash(dash ?? []);
    ctx.beginPath();
    for (let s = 0; s <= to + 1e-6; s += 0.01) {
      const [x, y] = pt(Math.min(s, to));
      if (s === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  };
  withAlpha(ctx, 0.25, () => road(1, 34, theme.foreground));
  road(drawn, 34, mix(theme.surface, theme.foreground, 0.25));
  road(drawn, 3, theme.accent, [14, 12]);
  items.forEach((it, i) => {
    const t = progress(frame, reveal(a, i, n), 20);
    if (t <= 0) return;
    const [x, y] = pt(stop(i));
    const color = colors[i % colors.length];
    const drop = (1 - easeOutBack(t)) * -60;
    withAlpha(ctx, clamp(t * 2), () => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y - 40 + drop, 22, Math.PI * 0.85, Math.PI * 2.15);
      ctx.lineTo(x, y + drop);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = readableOn(color);
      ctx.font = font(a.font, 'bold', 22);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(localizeDigits(String(i + 1), a.digits), x, y - 42 + drop);
      ctx.textBaseline = 'alphabetic';
      const f = fitItem(a, it, L.portrait ? L.W * 0.36 : Math.min(220, (L.W - L.M * 2) / n), 22, 16, 2, 2);
      const below = L.portrait ? false : i % 2 === 0;
      const lx = L.portrait ? (x > L.W / 2 ? x - 150 : x + 150) : x;
      const ly = L.portrait ? y - 50 - f.height / 2 : below ? y + 30 : y - 80 - f.height;
      ctx.fillStyle = alpha(theme.surface, 0.9);
      const bw = Math.max(f.hf.width, f.bf?.width ?? 0) + 24;
      roundRect(ctx, lx - bw / 2, ly - 8, bw, f.height + 16, 12);
      ctx.fill();
      drawItem(a, f, lx, ly);
    });
  });
}

/** قائمة تحقق — دفتر: ruled notebook paper; each line gets a hand-drawn tick in red ink. */
export function drawChecklistNotebook(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const items = shownItems(scene);
  const n = items.length;
  const w = Math.min(L.W - L.M * 2, L.portrait ? 640 : 900);
  const lineH = Math.min(L.portrait ? 110 : 80, (L.H - L.M * 2 - 140) / Math.max(1, n));
  const h = 130 + lineH * Math.max(1, n);
  const x = L.W / 2 - w / 2;
  const y = (L.H - h) / 2;
  const paper = '#FBF8EF';
  const ink = '#1f2a44';
  const t = easeOutCubic(progress(frame, 2, 22));
  withAlpha(ctx, t, () => {
    ctx.save();
    ctx.translate(0, (1 - t) * 40);
    ctx.fillStyle = alpha('#000000', 0.2);
    ctx.fillRect(x + 8, y + 10, w, h);
    ctx.fillStyle = paper;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = alpha('#5a8dd6', 0.35);
    ctx.lineWidth = 1.5;
    for (let k = 0; k <= n; k++) {
      const ly = y + 110 + k * lineH;
      ctx.beginPath();
      ctx.moveTo(x, ly);
      ctx.lineTo(x + w, ly);
      ctx.stroke();
    }
    // Red margin on the right (Arabic notebooks).
    ctx.strokeStyle = alpha('#e05555', 0.6);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + w - 80, y);
    ctx.lineTo(x + w - 80, y + h);
    ctx.stroke();
    // Spiral holes.
    for (let k = 0; k < Math.floor(h / 60); k++) {
      ctx.fillStyle = theme.background;
      ctx.beginPath();
      ctx.arc(x + w - 30, y + 30 + k * 60, 9, 0, Math.PI * 2);
      ctx.fill();
    }
    const tf = fitText(ctx, fs, scene.title || ' ', { maxWidth: w - 140, maxLines: 1, maxSize: 40, minSize: 20, weight: 'bold', lineHeight: 1.2 });
    ctx.fillStyle = ink;
    ctx.textAlign = 'right';
    drawLines(ctx, fs, tf, x + w - 100, y + 50 - tf.height / 2);
    ctx.restore();
  });
  items.forEach((it, i) => {
    const r = reveal(a, i, n);
    const tt = appear(frame, r - 8, 16);
    if (tt <= 0) return;
    const ly = y + 110 + i * lineH;
    withAlpha(ctx, tt, () => {
      const f = fitText(ctx, fs, it, { maxWidth: w - 200, maxLines: 1, maxSize: Math.min(32, lineH * 0.45), minSize: 14, weight: 'bold', lineHeight: 1.2 });
      ctx.fillStyle = ink;
      ctx.textAlign = 'right';
      drawLines(ctx, fs, f, x + w - 100, ly + lineH / 2 - f.height / 2);
    });
    // Hand-drawn tick: a short stroke then a long one, in red ink.
    const tk = progress(frame, r, 14);
    if (tk > 0) {
      const cx = x + w - 120 - (w - 220) - 10;
      const cy = ly + lineH / 2;
      ctx.strokeStyle = '#d23c3c';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      const p1 = clamp(tk * 2.5);
      ctx.moveTo(cx - 16, cy);
      ctx.lineTo(cx - 16 + 10 * p1, cy + 10 * p1);
      if (tk > 0.4) {
        const p2 = clamp((tk - 0.4) / 0.6);
        ctx.lineTo(cx - 6 + 26 * p2, cy + 10 - 28 * p2);
      }
      ctx.stroke();
    }
  });
}

/** تعريف — بطاقة تُقلب: a flash card shows the term, then flips to its definition and examples. */
export function drawDefinitionFlash(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const items = shownItems(scene);
  const w = Math.min(L.W - L.M * 2, L.portrait ? 620 : 860);
  const h = Math.min(L.H - L.M * 2.5, L.portrait ? 760 : 440);
  const x = L.W / 2 - w / 2;
  const y = L.H / 2 - h / 2;
  const t = easeOutBack(progress(frame, DEFINITION.term, 24));
  const flip = progress(frame, DEFINITION.body - 12, 18);
  const back = flip >= 0.5;
  const sx = Math.max(0.02, Math.abs(Math.cos(flip * Math.PI)));
  if (t <= 0) return;
  ctx.save();
  ctx.translate(L.W / 2, L.H / 2);
  ctx.scale(sx * clamp(t, 0, 1.2), clamp(t, 0, 1.2));
  ctx.translate(-L.W / 2, -L.H / 2);
  card(ctx, theme, x, y, w, h, 30, back ? mix(theme.surface, theme.accent2, 0.15) : theme.accent);
  if (!back) {
    const tf = fitText(ctx, fs, scene.title || ' ', { maxWidth: w - 80, maxLines: 3, maxSize: 76, minSize: 30, weight: 'bold', lineHeight: 1.3 });
    ctx.fillStyle = readableOn(theme.accent);
    ctx.textAlign = 'center';
    drawLines(ctx, fs, tf, L.W / 2, L.H / 2 - tf.height / 2);
    drawIcon(ctx, 'circle-help', L.W / 2, y + 60, 40, alpha(readableOn(theme.accent), 0.5), 2);
  } else {
    const tf = fitText(ctx, fs, scene.title || ' ', { maxWidth: w - 80, maxLines: 1, maxSize: 36, minSize: 18, weight: 'bold', lineHeight: 1.3 });
    ctx.fillStyle = textAccent(theme, theme.accent);
    ctx.textAlign = 'center';
    let yy = drawLines(ctx, fs, tf, L.W / 2, y + 34);
    const def = items[0];
    if (def) {
      const df = fitText(ctx, fs, def, { maxWidth: w - 80, maxLines: 6, maxSize: 34, minSize: 16, weight: 'regular', lineHeight: 1.55 });
      ctx.fillStyle = theme.foreground;
      yy = drawLines(ctx, fs, df, L.W / 2, yy + 20);
    }
    const ex = items.slice(1);
    ex.forEach((e, k) => {
      const et = appear(frame, reveal(a, k + 1, items.length), 18);
      if (et <= 0) return;
      withAlpha(ctx, et, () => {
        const ef = fitText(ctx, fs, `• ${e}`, { maxWidth: w - 100, maxLines: 1, maxSize: 26, minSize: 13, weight: 'bold', lineHeight: 1.3 });
        ctx.fillStyle = textAccent(theme, theme.accent2);
        drawLines(ctx, fs, ef, L.W / 2, yy + 20 + k * 40);
      });
    });
  }
  ctx.restore();
}

/** اقتباس — فقاعة كلام: the quote in a speech bubble pointing at the speaker's avatar. */
export function drawQuoteBubble(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const w = Math.min(L.W - L.M * 2, L.portrait ? L.W - L.M * 2 : 900);
  const qf = fitText(ctx, fs, scene.title || ' ', { maxWidth: w - 90, maxLines: L.portrait ? 7 : 4, maxSize: L.portrait ? 48 : 50, minSize: 22, weight: 'bold', lineHeight: 1.5 });
  const h = qf.height + 90;
  const by = scene.items[0];
  const x = L.W / 2 - w / 2;
  const y = (L.H - h - 150) / 2;
  const t = easeOutBack(progress(frame, QUOTE.icon, 26));
  if (t <= 0) return;
  ctx.save();
  ctx.translate(x + w - 120, y + h);
  ctx.scale(clamp(t, 0, 1.2), clamp(t, 0, 1.2));
  ctx.translate(-(x + w - 120), -(y + h));
  ctx.fillStyle = mix(theme.surface, theme.accent, 0.15);
  roundRect(ctx, x, y, w, h, 40);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + w - 160, y + h - 2);
  ctx.lineTo(x + w - 100, y + h + 50);
  ctx.lineTo(x + w - 90, y + h - 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.font = font(fs, qf.weight, qf.fontSize);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  qf.lines.forEach((line, i) => {
    const lt = progress(frame, QUOTE.line(i) + 6, 18);
    if (lt <= 0) return;
    withAlpha(ctx, easeOutCubic(lt), () => {
      ctx.fillStyle = theme.foreground;
      ctx.fillText(line, L.W / 2, y + 45 + qf.lineHeight * (i + 0.5));
    });
  });
  ctx.textBaseline = 'alphabetic';
  if (by) {
    const at = appear(frame, QUOTE.line(qf.lines.length) + 10, 22);
    withAlpha(ctx, at, () => {
      const ax = x + w - 90;
      const ay = y + h + 100;
      iconBadge(ctx, theme, 'user', ax, ay, 38);
      const bf = fitText(ctx, fs, by, { maxWidth: w - 200, maxLines: 1, maxSize: 30, minSize: 16, weight: 'bold', lineHeight: 1.2 });
      ctx.fillStyle = textAccent(theme, theme.accent);
      ctx.textAlign = 'right';
      drawLines(ctx, fs, bf, ax - 56, ay - bf.height / 2);
    });
  }
}
