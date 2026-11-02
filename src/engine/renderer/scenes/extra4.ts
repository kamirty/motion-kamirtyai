import { localizeDigits } from '../../../design/digits';
import { alpha, mix, readableOn, textAccent } from '../../../design/presets';
import { shownItems } from '../../sceneModel';
import { itemReveal, typingFrames } from '../../timing';
import { clamp, easeInOutCubic, easeOutBack, easeOutCubic, hash01, progress } from '../animation';
import { font } from '../context';
import { drawIcon } from '../icons';
import { appear, card, drawHeader, itemEnter, roundRect, withAlpha, type SceneDrawArgs } from '../kit';
import { wordTokens } from '../lively';
import { drawLines, fitText } from '../textLayout';
import { palette, parts } from './extra2';
import { fitItem, drawItem, gridBoxes, lastRevealed, numberDisc } from './extra3';

/**
 * Fifth batch of scene kinds: chat, word cloud, map pins, phone notifications, stairs, podium,
 * day clock, traffic light, search bar and target. Each motion is a pure function of the frame.
 */

const reveal = (a: SceneDrawArgs, i: number, n: number) => itemReveal(a.scene, i, n);
const lerp = (x: number, y: number, t: number) => x + (y - x) * t;

/** محادثة — chat bubbles alternate sides, each preceded by typing dots; the thread scrolls up. */
export function drawChat(a: SceneDrawArgs): void {
  const { ctx, theme, frame, layout: L, font: fs } = a;
  const top = drawHeader(a);
  const items = shownItems(a.scene);
  const n = items.length;
  if (!n) return;
  const colors = palette(theme);
  const areaBottom = L.H - L.M * 0.6;
  const maxW = (L.W - L.M * 2) * (L.portrait ? 0.74 : 0.6);
  const avatar = L.portrait ? 22 : 26;
  const gap = 18;
  const rows = items.map((it) => {
    const { head, body } = parts(it);
    const text = body || head;
    const name = body ? head : '';
    const tf = fitText(ctx, fs, text, { maxWidth: maxW - 40, maxLines: 4, maxSize: L.portrait ? 30 : 30, minSize: 16, weight: 'regular', lineHeight: 1.4 });
    const nameH = name ? 30 : 0;
    return { name, tf, h: nameH + tf.height + 30, nameH };
  });
  const ys: number[] = [];
  let y = top + 6;
  for (const r of rows) {
    ys.push(y);
    y += r.h + gap;
  }
  // Scroll so the newest bubble (or its typing dots) stays in view.
  const typingAt = (i: number) => reveal(a, i, n) - 16;
  let k = -1;
  for (let i = 0; i < n; i++) if (frame >= typingAt(i)) k = i;
  const need = (i: number) => (i < 0 ? 0 : Math.max(0, ys[i] + rows[i].h - areaBottom));
  const scroll = k < 0 ? 0 : lerp(need(k - 1), need(k), easeInOutCubic(progress(frame, typingAt(k), 14)));
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, top - 4, L.W, areaBottom - top + 8);
  ctx.clip();
  ctx.translate(0, -scroll);
  items.forEach((_, i) => {
    const r = rows[i];
    const right = i % 2 === 0;
    const color = colors[(i % 2) * 1];
    const bubbleColor = right ? mix(theme.surface, color, 0.22) : theme.surface;
    const ax = right ? L.W - L.M - avatar : L.M + avatar;
    const bx = right ? ax - avatar - 14 : ax + avatar + 14;
    const by = ys[i];
    const t = progress(frame, reveal(a, i, n), 16);
    // Typing dots before the message lands.
    if (t <= 0) {
      const d = progress(frame, typingAt(i), 6);
      if (d <= 0) return;
      withAlpha(ctx, d, () => {
        const w = 96;
        const x = right ? bx - w : bx;
        card(ctx, theme, x, by + r.nameH, w, 48, 24, bubbleColor);
        for (let j = 0; j < 3; j++) {
          const lift = Math.max(0, Math.sin((frame - j * 4) / 3)) * 6;
          ctx.fillStyle = alpha(theme.foreground, 0.55);
          ctx.beginPath();
          ctx.arc(x + w / 2 + (j - 1) * 20, by + r.nameH + 24 - lift, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      return;
    }
    const bw = Math.max(110, r.tf.width + 40);
    const x = right ? bx - bw : bx;
    itemEnter(a, t, x + bw / 2, by + r.h / 2, bw, r.h, () => {
      const s = 0.6 + 0.4 * easeOutBack(t);
      ctx.save();
      ctx.translate(right ? bx : bx, by + r.h);
      ctx.scale(s, s);
      ctx.translate(-(right ? bx : bx), -(by + r.h));
      withAlpha(ctx, clamp(t * 2), () => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(ax, by + r.h - avatar, avatar, 0, Math.PI * 2);
        ctx.fill();
        drawIcon(ctx, 'user', ax, by + r.h - avatar, avatar * 1.1, readableOn(color), 2.2);
        if (r.name) {
          const nf = fitText(ctx, fs, r.name, { maxWidth: maxW, maxLines: 1, maxSize: 21, minSize: 13, weight: 'bold', lineHeight: 1.2 });
          ctx.fillStyle = textAccent(theme, color);
          ctx.textAlign = right ? 'right' : 'left';
          drawLines(ctx, fs, nf, right ? bx - 6 : bx + 6, by);
        }
        const bt = by + r.nameH;
        const bh = r.h - r.nameH;
        card(ctx, theme, x, bt, bw, bh, 22, bubbleColor);
        // A small tail towards the speaker.
        ctx.fillStyle = bubbleColor;
        ctx.beginPath();
        const tx = right ? x + bw : x;
        ctx.moveTo(tx, bt + bh - 26);
        ctx.lineTo(tx + (right ? 14 : -14), bt + bh - 6);
        ctx.lineTo(tx + (right ? -6 : 6), bt + bh - 12);
        ctx.fill();
        ctx.fillStyle = theme.foreground;
        ctx.textAlign = 'center';
        drawLines(ctx, fs, r.tf, x + bw / 2, bt + 15);
      });
      ctx.restore();
    });
  });
  ctx.restore();
}

/** سحابة كلمات — key words pop into a cloud, the first one big in the middle, with a little puff. */
export function drawWordCloud(a: SceneDrawArgs): void {
  const { ctx, theme, frame, layout: L, font: fs } = a;
  const top = drawHeader(a);
  const items = shownItems(a.scene).map((it) => parts(it).head);
  const n = items.length;
  if (!n) return;
  const colors = palette(theme);
  // Rows: the second and fourth word above the first, the third and fifth below, the sixth last.
  const layout = [[1, 3], [0], [2, 4], [5]].map((r) => r.filter((i) => i < n)).filter((r) => r.length);
  const areaH = L.H - top - L.M * 0.6;
  const big = layout.findIndex((r) => r.includes(0));
  const unit = areaH / (layout.length + 0.8);
  let y = top;
  layout.forEach((row, ri) => {
    const rh = ri === big ? unit * 1.8 : unit;
    const cw = (L.W - L.M * 2) / row.length;
    row.forEach((i, ci) => {
      const t = progress(frame, reveal(a, i, n), 18);
      if (t <= 0) return;
      const jitter = (hash01(i, 7) - 0.5) * cw * 0.18;
      const cx = L.W - L.M - cw * (ci + 0.5) + (row.length > 1 ? jitter : 0);
      const cy = y + rh / 2 + (hash01(i, 3) - 0.5) * rh * 0.2;
      const color = colors[i % colors.length];
      const size = i === 0 ? (L.portrait ? 64 : 76) : Math.max(32, 54 - i * 4);
      const f = fitText(ctx, fs, items[i], { maxWidth: cw * 0.9, maxLines: i === 0 ? 2 : 2, maxSize: size, minSize: 16, weight: 'bold', lineHeight: 1.15 });
      // Puff: a ring of dots bursting out as the word lands.
      const p = progress(frame, reveal(a, i, n), 22);
      if (p < 1) withAlpha(ctx, 1 - p, () => {
        ctx.fillStyle = color;
        for (let d = 0; d < 8; d++) {
          const ang = (d / 8) * Math.PI * 2 + i;
          const dist = 20 + easeOutCubic(p) * (f.width / 2 + 30);
          ctx.beginPath();
          ctx.arc(cx + Math.cos(ang) * dist, cy + Math.sin(ang) * dist * 0.6, 5 * (1 - p) + 1, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      itemEnter(a, t, cx, cy, f.width, f.height, () => {
        const s = 0.2 + 0.8 * easeOutBack(t);
        const drift = Math.sin((frame + i * 23) / 40) * 4;
        ctx.save();
        ctx.translate(cx, cy + drift);
        ctx.scale(s, s);
        withAlpha(ctx, clamp(t * 1.6), () => {
          if (i === 0) {
            ctx.fillStyle = alpha(color, 0.14);
            roundRect(ctx, -f.width / 2 - 28, -f.height / 2 - 14, f.width + 56, f.height + 28, 30);
            ctx.fill();
          }
          ctx.fillStyle = textAccent(theme, color);
          ctx.textAlign = 'center';
          drawLines(ctx, fs, f, 0, -f.height / 2);
        });
        ctx.restore();
      });
    });
    y += rh;
  });
}

/** دبابيس — pins drop onto a dotted map one by one, joined by a dashed route, each with its label. */
export function drawPins(a: SceneDrawArgs): void {
  const { ctx, theme, frame, layout: L } = a;
  const top = drawHeader(a);
  const items = shownItems(a.scene);
  const n = items.length;
  if (!n) return;
  const colors = palette(theme);
  const boxes = gridBoxes(L, top, n, L.portrait ? 330 : 260, 26);
  // Dotted "map" (abstract, no real geography).
  withAlpha(ctx, appear(frame, 2, 24) * 0.5, () => {
    ctx.fillStyle = alpha(theme.foreground, 0.18);
    const step = 26;
    for (let yy = top + 10; yy < L.H - L.M * 0.5; yy += step)
      for (let xx = L.M * 0.6; xx < L.W - L.M * 0.6; xx += step) {
        const h = hash01(Math.round(xx / step) * 31 + Math.round(yy / step), 11);
        if (h > 0.55) {
          ctx.beginPath();
          ctx.arc(xx, yy, 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
  });
  const pin = boxes.map((b, i) => [b.x + b.w / 2 + (hash01(i, 5) - 0.5) * b.w * 0.25, b.y + Math.min(70, b.h * 0.34)] as [number, number]);
  // Route: drawn up to the newest pin.
  const k = lastRevealed(a, n);
  ctx.save();
  ctx.setLineDash([10, 12]);
  ctx.lineWidth = 4;
  ctx.strokeStyle = alpha(theme.accent, 0.6);
  for (let i = 1; i <= k; i++) {
    const t = easeInOutCubic(progress(frame, reveal(a, i, n) - 14, 14));
    const [x0, y0] = pin[i - 1];
    const [x1, y1] = pin[i];
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(lerp(x0, x1, t), lerp(y0, y1, t));
    ctx.stroke();
  }
  ctx.restore();
  items.forEach((it, i) => {
    const r = reveal(a, i, n);
    const color = colors[i % colors.length];
    const [px, py] = pin[i];
    const fall = progress(frame, r - 14, 14);
    if (fall <= 0) return;
    const b = boxes[i];
    // Label card under the pin.
    const t = progress(frame, r, 16);
    if (t > 0) {
      const f = fitItem(a, it, b.w - 30, 28, 21, 2, 2);
      const ch = f.height + 26;
      const cy = Math.min(py + 26, b.y + b.h - ch);
      itemEnter(a, t, b.x + b.w / 2, cy + ch / 2, b.w, ch, () => {
        withAlpha(ctx, easeOutCubic(t), () => {
          card(ctx, theme, b.x + 6, cy + (1 - easeOutCubic(t)) * 16, b.w - 12, ch, 18);
          drawItem(a, f, b.x + b.w / 2, cy + 13 + (1 - easeOutCubic(t)) * 16, textAccent(theme, color));
        });
      });
    }
    // Shadow and pin falling with a small bounce.
    const land = fall < 1 ? -(1 - fall * fall) * 260 : -Math.abs(Math.sin(progress(frame, r, 12) * Math.PI)) * 14 * (1 - progress(frame, r, 12));
    const s = 0.5 + 0.5 * fall;
    ctx.fillStyle = alpha('#000000', 0.18 * fall);
    ctx.beginPath();
    ctx.ellipse(px, py, 16 * s, 6 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    const hy = py + land;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(px, hy);
    ctx.bezierCurveTo(px - 26, hy - 30, px - 24, hy - 62, px, hy - 62);
    ctx.bezierCurveTo(px + 24, hy - 62, px + 26, hy - 30, px, hy);
    ctx.fill();
    numberDisc(a, i + 1, px, hy - 42, 13, theme.background);
  });
}

/** إشعارات — notifications slide down onto a phone screen, the newest on top pushing the rest down. */
export function drawNotify(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const top = drawHeader(a);
  const items = shownItems(scene);
  const n = items.length;
  if (!n) return;
  const colors = palette(theme);
  const avail = L.H - top - L.M * 0.5;
  const pw = L.portrait ? L.W - L.M * 2 - 20 : Math.min(L.W * (L.square ? 0.74 : 0.52), 640);
  const px = (L.W - pw) / 2;
  const py = top;
  const ph = avail + 60;
  const show = appear(frame, 2, 20);
  withAlpha(ctx, show, () => {
    ctx.save();
    ctx.translate(0, (1 - show) * 60);
    ctx.fillStyle = mix(theme.foreground, theme.background, 0.15);
    roundRect(ctx, px - 12, py - 12, pw + 24, ph + 24, 46);
    ctx.fill();
    ctx.fillStyle = mix(theme.background, theme.accent, 0.12);
    roundRect(ctx, px, py, pw, ph, 36);
    ctx.fill();
    ctx.fillStyle = mix(theme.foreground, theme.background, 0.15);
    roundRect(ctx, px + pw / 2 - 50, py + 10, 100, 24, 12);
    ctx.fill();
    ctx.restore();
  });
  const x = px + 18;
  const w = pw - 36;
  const icon = Math.min(L.portrait ? 64 : 56, w * 0.14);
  const rows = items.map((it) => {
    const f = fitItem(a, it, w - icon - 50, 30, 22, 2, 2);
    return { f, h: Math.max(icon + 24, f.height + 28) };
  });
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, px, py, pw, ph, 36);
  ctx.clip();
  const y0 = py + 50;
  items.forEach((_, i) => {
    const t = progress(frame, reveal(a, i, n), 16);
    if (t <= 0) return;
    // Pushed down by every newer notification as it arrives.
    let y = y0;
    for (let j = i + 1; j < n; j++) y += (rows[j].h + 14) * easeOutCubic(progress(frame, reveal(a, j, n), 16));
    const e = easeOutBack(t);
    const yy = y - (1 - e) * (rows[i].h + 40);
    const color = colors[i % colors.length];
    itemEnter(a, t, x + w / 2, yy + rows[i].h / 2, w, rows[i].h, () => {
      withAlpha(ctx, clamp(t * 2), () => {
        card(ctx, theme, x, yy, w, rows[i].h, 20);
        const ix = x + w - 14 - icon / 2;
        const iy = yy + rows[i].h / 2;
        ctx.fillStyle = color;
        roundRect(ctx, ix - icon / 2, iy - icon / 2, icon, icon, icon * 0.28);
        ctx.fill();
        drawIcon(ctx, scene.icon || 'smartphone', ix, iy, icon * 0.6, readableOn(color), 2.2);
        ctx.textAlign = 'right';
        ctx.fillStyle = theme.foreground;
        const tx = ix - icon / 2 - 14;
        let ty = yy + (rows[i].h - rows[i].f.height) / 2;
        ty = drawLines(ctx, fs, rows[i].f.hf, tx, ty);
        if (rows[i].f.bf) {
          ctx.fillStyle = alpha(theme.foreground, 0.75);
          drawLines(ctx, fs, rows[i].f.bf, tx, ty + 6);
        }
      });
    });
  });
  ctx.restore();
}

/** درجات الصعود — a staircase from right to left; a ball hops up one step per item. */
export function drawStairs(a: SceneDrawArgs): void {
  const { ctx, theme, frame, layout: L } = a;
  const top = drawHeader(a);
  const items = shownItems(a.scene);
  const n = items.length;
  if (!n) return;
  const colors = palette(theme);
  const base = L.H - L.M * 0.5;
  const avail = base - top;
  const sw = (L.W - L.M * 2) / n;
  const maxBlock = avail * 0.5;
  const minBlock = Math.min(60, maxBlock * 0.3);
  const blockH = (i: number) => (n === 1 ? maxBlock : minBlock + ((maxBlock - minBlock) * i) / (n - 1));
  const sx = (i: number) => L.W - L.M - sw * (i + 1);
  const ballR = Math.min(18, sw * 0.14);
  items.forEach((it, i) => {
    const color = colors[i % colors.length];
    const t = appear(frame, 4 + i * 4, 20);
    const lit = progress(frame, reveal(a, i, n), 14);
    const h = blockH(i) * t;
    const x = sx(i);
    ctx.fillStyle = lit > 0 ? mix(theme.surface, color, 0.25 + 0.35 * lit) : mix(theme.surface, theme.foreground, 0.06);
    roundRect(ctx, x + 3, base - h, sw - 6, h, 10);
    ctx.fill();
    ctx.fillStyle = lit > 0 ? color : alpha(theme.foreground, 0.2);
    roundRect(ctx, x + 3, base - h, sw - 6, Math.min(10, h), 5);
    ctx.fill();
    if (h > 34) numberDisc(a, i + 1, x + sw / 2, base - h + 30, Math.min(16, sw * 0.14), lit > 0 ? color : alpha(theme.foreground, 0.3));
    if (lit <= 0) return;
    const f = fitItem(a, it, sw - 12, L.portrait ? 21 : 26, L.portrait ? 16 : 19, 3, 3);
    const ly = base - blockH(i) - ballR * 2 - 14 - f.height;
    itemEnter(a, lit, x + sw / 2, ly + f.height / 2, sw, f.height, () => {
      withAlpha(ctx, easeOutCubic(lit), () => drawItem(a, f, x + sw / 2, ly + (1 - easeOutCubic(lit)) * 14, textAccent(theme, color)));
    });
  });
  // The ball: arrives from the right, then hops to each step as it is revealed.
  const k = lastRevealed(a, n);
  const spot = (i: number): [number, number] => (i < 0 ? [L.W + 40, base - ballR] : [sx(i) + sw / 2, base - blockH(i) - ballR]);
  let [bx, by] = spot(k);
  const next = k + 1;
  if (next < n) {
    const r = reveal(a, next, n);
    const jt = progress(frame, r - 14, 14);
    if (jt > 0) {
      const [x0, y0] = spot(k);
      const [x1, y1] = spot(next);
      const e = easeInOutCubic(jt);
      bx = lerp(x0, x1, e);
      by = lerp(y0, y1, e) - Math.sin(jt * Math.PI) * (60 + Math.max(0, y0 - y1));
    }
  }
  const squash = k >= 0 ? progress(frame, reveal(a, k, n), 8) : 1;
  const sq = squash < 1 ? 1 - 0.25 * Math.sin(squash * Math.PI) : 1;
  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.ellipse(bx, by + ballR * (1 - sq), ballR * (2 - sq), ballR * sq, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = alpha('#ffffff', 0.5);
  ctx.beginPath();
  ctx.arc(bx + ballR * 0.3, by - ballR * 0.35, ballR * 0.3, 0, Math.PI * 2);
  ctx.fill();
}

/** منصة التتويج — podium blocks rise for third, second and then first place, with medals and confetti. */
export function drawPodium(a: SceneDrawArgs): void {
  const { ctx, theme, frame, layout: L, font: fs } = a;
  const top = drawHeader(a);
  const items = shownItems(a.scene);
  const n = items.length;
  if (!n) return;
  const places = Math.min(3, n);
  const extra = items.slice(3);
  const MEDAL = ['#F6C445', '#C0C7D1', '#D9925B'];
  const stripH = extra.length ? (L.portrait ? 120 : 70) : 0;
  const base = L.H - L.M * 0.5 - stripH;
  const avail = base - top;
  const colW = Math.min(L.portrait ? 200 : 260, (L.W - L.M * 2) / 3);
  // Second on the right, first in the middle, third on the left (reading from the right).
  const slot = [0, -1, 1];
  const heights = [0.46, 0.34, 0.24].map((k) => avail * k);
  for (let p = 0; p < places; p++) {
    const i = p;
    const r = reveal(a, i, n);
    const t = easeOutCubic(progress(frame, r - 10, 18));
    if (t <= 0) continue;
    const cx = L.W / 2 - slot[p] * colW;
    const h = heights[p] * t;
    const x = cx - colW / 2 + 6;
    const color = MEDAL[p];
    ctx.fillStyle = mix(theme.surface, color, 0.35);
    roundRect(ctx, x, base - h, colW - 12, h, 12);
    ctx.fill();
    ctx.fillStyle = color;
    roundRect(ctx, x, base - h, colW - 12, Math.min(12, h), 6);
    ctx.fill();
    if (h > 60) {
      ctx.fillStyle = alpha(readableOn(mix(theme.surface, color, 0.35)), 0.6);
      ctx.font = font(fs, 'bold', Math.min(64, h * 0.5));
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(localizeDigits(String(p + 1), a.digits), cx, base - h / 2 + 8);
      ctx.textBaseline = 'alphabetic';
    }
    // Medal and name on top once the block is up.
    const m = progress(frame, r, 16);
    if (m <= 0) continue;
    const f = fitItem(a, items[i], colW - 16, L.portrait ? 20 : 26, L.portrait ? 15 : 18, 2, 2);
    const mr = Math.min(28, colW * 0.15);
    const my = base - heights[p] - mr - 10;
    itemEnter(a, m, cx, my, colW, mr * 2, () => {
      const s = easeOutBack(m);
      ctx.save();
      ctx.translate(cx, my);
      ctx.scale(s, s);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, mr, 0, Math.PI * 2);
      ctx.fill();
      drawIcon(ctx, p === 0 ? 'trophy' : 'medal', 0, 0, mr * 1.1, readableOn(color), 2.2);
      ctx.restore();
      withAlpha(ctx, clamp(m * 1.5), () => drawItem(a, f, cx, my - mr - 10 - f.height, theme.foreground));
    });
    // Confetti for first place.
    if (p === 0) {
      const c = progress(frame, r, 50);
      if (c > 0 && c < 1) for (let q = 0; q < 26; q++) {
        const ang = -Math.PI / 2 + (hash01(q, 21) - 0.5) * 2.4;
        const sp = 140 + hash01(q, 22) * 220;
        const qx = cx + Math.cos(ang) * sp * c;
        const qy = my + Math.sin(ang) * sp * c + 260 * c * c;
        withAlpha(ctx, 1 - c, () => {
          ctx.fillStyle = palette(theme)[q % 6];
          ctx.save();
          ctx.translate(qx, qy);
          ctx.rotate(q + c * 8);
          ctx.fillRect(-5, -3, 10, 6);
          ctx.restore();
        });
      }
    }
  }
  // Fourth place and beyond: a row of small chips under the podium.
  if (extra.length) {
    const cols = L.portrait ? Math.min(2, extra.length) : extra.length;
    const rowsN = Math.ceil(extra.length / cols);
    const gw = (L.W - L.M * 2 - 14 * (cols - 1)) / cols;
    const gh = (stripH - 14 * rowsN) / rowsN;
    extra.forEach((it, e) => {
      const i = e + 3;
      const t = progress(frame, reveal(a, i, n), 16);
      if (t <= 0) return;
      const x = L.W - L.M - (e % cols + 1) * gw - (e % cols) * 14;
      const y = base + 14 + Math.floor(e / cols) * (gh + 14);
      itemEnter(a, t, x + gw / 2, y + gh / 2, gw, gh, () => withAlpha(ctx, easeOutCubic(t), () => {
        card(ctx, theme, x, y, gw, gh, 14);
        numberDisc(a, i + 1, x + gw - gh / 2, y + gh / 2, Math.min(15, gh * 0.3), alpha(theme.foreground, 0.45));
        const f = fitText(ctx, fs, parts(it).head, { maxWidth: gw - gh - 16, maxLines: 1, maxSize: 20, minSize: 12, weight: 'bold', lineHeight: 1.2 });
        ctx.fillStyle = theme.foreground;
        ctx.textAlign = 'center';
        drawLines(ctx, fs, f, x + (gw - gh) / 2 + 4, y + (gh - f.height) / 2);
      }));
    });
  }
}

/** Leading clock time of an item («7:30 الاستيقاظ», «7 م: العشاء»); null when there is none. */
export function clockParts(item: string): { minutes: number | null; time: string; text: string } {
  const digits = (s: string) => s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  const m = /^\s*([0-9٠-٩]{1,2})(?:\s*[:.]\s*([0-9٠-٩]{2}))?\s*(صباحًا|صباحا|مساءً|مساء|ص|م|am|pm|AM|PM)?(?=[\s:：\-–—]|$)\s*[:：\-–—]?\s*(.*)$/u.exec(item);
  if (!m) return { minutes: null, time: '', text: item.trim() };
  let h = Number(digits(m[1]));
  const min = m[2] ? Number(digits(m[2])) : 0;
  if (h > 24 || min > 59) return { minutes: null, time: '', text: item.trim() };
  const pm = m[3] && /^(م|مساء|pm)/iu.test(m[3]);
  if (pm && h < 12) h += 12;
  const time = item.slice(0, item.length - m[4].length).replace(/[\s:：\-–—]+$/u, '').trim();
  return { minutes: h * 60 + min, time, text: m[4].trim() || time };
}

/** ساعة اليوم — a clock whose hands sweep to each activity's time while the schedule fills in. */
export function drawClock(a: SceneDrawArgs): void {
  const { ctx, theme, frame, layout: L, font: fs } = a;
  const top = drawHeader(a);
  const items = shownItems(a.scene);
  const n = items.length;
  if (!n) return;
  const colors = palette(theme);
  const rows = items.map(clockParts);
  // Times always move forward around the dial; items without a time are spread evenly.
  const T: number[] = [];
  rows.forEach((r, i) => {
    let v = r.minutes ?? 8 * 60 + Math.round((i * 12 * 60) / Math.max(1, n));
    while (i && v <= T[i - 1]) v += 720;
    T.push(v);
  });
  const avail = L.H - top - L.M * 0.5;
  const R = L.portrait ? Math.min(L.W * 0.3, avail * 0.2) : Math.min(avail * 0.44, L.W * 0.18);
  const cx = L.portrait ? L.W / 2 : L.M + R + 10;
  const cy = L.portrait ? top + R + 10 : top + avail / 2;
  const k = lastRevealed(a, n);
  let now = k < 0 ? T[0] - 60 : T[k];
  if (k + 1 < n) {
    const r = reveal(a, k + 1, n);
    const from = k < 0 ? T[0] - 60 : T[k];
    now = lerp(from, T[k + 1], easeInOutCubic(progress(frame, r - 18, 18)));
  }
  const show = appear(frame, 2, 22);
  withAlpha(ctx, show, () => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(0.7 + 0.3 * show, 0.7 + 0.3 * show);
    card(ctx, theme, -R, -R, R * 2, R * 2, R);
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, R - 3, 0, Math.PI * 2);
    ctx.stroke();
    for (let h = 0; h < 12; h++) {
      const ang = (h / 12) * Math.PI * 2 - Math.PI / 2;
      ctx.strokeStyle = alpha(theme.foreground, h % 3 ? 0.3 : 0.7);
      ctx.lineWidth = h % 3 ? 2 : 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * R * 0.86, Math.sin(ang) * R * 0.86);
      ctx.lineTo(Math.cos(ang) * R * 0.76, Math.sin(ang) * R * 0.76);
      ctx.stroke();
      if (h % 3 === 0) {
        ctx.fillStyle = alpha(theme.foreground, 0.8);
        ctx.font = font(fs, 'bold', R * 0.16);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(localizeDigits(String(h || 12), a.digits), Math.cos(ang) * R * 0.6, Math.sin(ang) * R * 0.6);
        ctx.textBaseline = 'alphabetic';
      }
    }
    // Revealed times as coloured dots on the rim.
    for (let i = 0; i <= k; i++) {
      const ang = ((T[i] % 720) / 720) * Math.PI * 2 - Math.PI / 2;
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.arc(Math.cos(ang) * R * 0.93, Math.sin(ang) * R * 0.93, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    const hand = (ang: number, len: number, w: number, c: string) => {
      ctx.strokeStyle = c;
      ctx.lineWidth = w;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(ang) * len, Math.sin(ang) * len);
      ctx.stroke();
    };
    hand(((now % 720) / 720) * Math.PI * 2 - Math.PI / 2, R * 0.5, 9, theme.foreground);
    hand(((now % 60) / 60) * Math.PI * 2 - Math.PI / 2, R * 0.72, 5, theme.accent);
    ctx.fillStyle = theme.accent;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
  // Schedule list.
  const lx0 = L.portrait ? L.M : cx + R + 40;
  const lx1 = L.W - L.M;
  const ly0 = L.portrait ? cy + R + 30 : top;
  const lh = L.H - L.M * 0.5 - ly0;
  const rowH = Math.min(L.portrait ? 110 : 96, (lh - 12 * (n - 1)) / n);
  const y0 = ly0 + (lh - (rowH * n + 12 * (n - 1))) / 2;
  const chipW = Math.min(150, (lx1 - lx0) * 0.3);
  rows.forEach((r, i) => {
    const t = progress(frame, reveal(a, i, n), 16);
    if (t <= 0) return;
    const y = y0 + i * (rowH + 12);
    const color = colors[i % colors.length];
    const w = lx1 - lx0;
    itemEnter(a, t, lx0 + w / 2, y + rowH / 2, w, rowH, () => withAlpha(ctx, easeOutCubic(t), () => {
      const dx = (1 - easeOutCubic(t)) * -40;
      card(ctx, theme, lx0 + dx, y, w, rowH, 18, i === k ? mix(theme.surface, color, 0.18) : theme.surface);
      ctx.fillStyle = color;
      roundRect(ctx, lx1 - chipW - 10 + dx, y + 10, chipW, rowH - 20, 12);
      ctx.fill();
      const time = r.time || '';
      if (time) {
        const tf = fitText(ctx, fs, localizeDigits(time, a.digits), { maxWidth: chipW - 12, maxLines: 1, maxSize: 28, minSize: 12, weight: 'bold', lineHeight: 1.1 });
        ctx.fillStyle = readableOn(color);
        ctx.textAlign = 'center';
        drawLines(ctx, fs, tf, lx1 - chipW / 2 - 10 + dx, y + (rowH - tf.height) / 2);
      } else drawIcon(ctx, 'clock', lx1 - chipW / 2 - 10 + dx, y + rowH / 2, Math.min(34, rowH * 0.5), readableOn(color), 2.4);
      const f = fitItem(a, r.text, w - chipW - 40, 26, 19, 2, 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = theme.foreground;
      let ty = y + (rowH - f.height) / 2;
      const tx = lx1 - chipW - 26 + dx;
      ty = drawLines(ctx, fs, f.hf, tx, ty);
      if (f.bf) {
        ctx.fillStyle = alpha(theme.foreground, 0.75);
        drawLines(ctx, fs, f.bf, tx, ty + 6);
      }
    }));
  });
}

/** Signal colours from stop (red) to go (green) for n lights. */
export function signalColors(n: number): string[] {
  if (n === 3) return ['#E53935', '#FDD835', '#43A047'];
  const stops = ['#E53935', '#FB8C00', '#FDD835', '#7CB342', '#43A047', '#00897B'];
  if (n <= 1) return [stops[0]];
  return Array.from({ length: n }, (_, i) => stops[Math.round((i * (stops.length - 2)) / (n - 1))]);
}

/** إشارة المرور — a signal whose lights switch on one by one, each with its message beside it. */
export function drawTraffic(a: SceneDrawArgs): void {
  const { ctx, theme, frame, layout: L } = a;
  const top = drawHeader(a);
  const items = shownItems(a.scene);
  const n = items.length;
  if (!n) return;
  const lights = signalColors(n);
  const avail = L.H - top - L.M * 0.5;
  const lr = Math.min(L.portrait ? 54 : 46, (avail - 30) / n / 2 - 8);
  const hw = lr * 2 + 36;
  const hh = n * (lr * 2 + 16) + 24;
  const hx = L.W - L.M - hw;
  const hy = top + (avail - hh) / 2;
  const k = lastRevealed(a, n);
  const show = appear(frame, 2, 20);
  withAlpha(ctx, show, () => {
    ctx.fillStyle = mix(theme.foreground, '#000000', 0.55);
    roundRect(ctx, hx + hw / 2 - 8, hy + hh, 16, Math.max(0, L.H - hy - hh), 4);
    ctx.fill();
    ctx.fillStyle = '#20232A';
    roundRect(ctx, hx, hy - (1 - show) * 40, hw, hh, 26);
    ctx.fill();
  });
  items.forEach((it, i) => {
    const cy = hy + 12 + lr + 8 + i * (lr * 2 + 16);
    const cx = hx + hw / 2;
    const on = progress(frame, reveal(a, i, n), 8);
    const active = i === k;
    const lvl = on <= 0 ? 0 : active ? on : 0.35;
    withAlpha(ctx, show, () => {
      if (active && on > 0) withAlpha(ctx, 0.35 + 0.1 * Math.sin(frame / 6), () => {
        const g = ctx.createRadialGradient(cx, cy, lr * 0.5, cx, cy, lr * 2.2);
        g.addColorStop(0, lights[i]);
        g.addColorStop(1, alpha(lights[i], 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, lr * 2.2, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.fillStyle = mix('#3A3F4B', lights[i], lvl);
      ctx.beginPath();
      ctx.arc(cx, cy, lr, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = alpha('#ffffff', 0.12 + 0.2 * lvl);
      ctx.beginPath();
      ctx.arc(cx - lr * 0.3, cy - lr * 0.3, lr * 0.3, 0, Math.PI * 2);
      ctx.fill();
    });
    const t = progress(frame, reveal(a, i, n), 16);
    if (t <= 0) return;
    const x0 = L.M;
    const w = hx - 24 - x0;
    const f = fitItem(a, it, w - 50, L.portrait ? 24 : 28, L.portrait ? 17 : 20, 2, 2);
    const ch = Math.max(lr * 2, f.height + 28);
    itemEnter(a, t, x0 + w / 2, cy, w, ch, () => withAlpha(ctx, easeOutCubic(t) * (active ? 1 : 0.75), () => {
      const dx = (1 - easeOutCubic(t)) * 50;
      card(ctx, theme, x0 + dx, cy - ch / 2, w, ch, 18, active ? mix(theme.surface, lights[i], 0.14) : theme.surface);
      ctx.fillStyle = lights[i];
      roundRect(ctx, x0 + w - 12 + dx, cy - ch / 2 + 10, 6, ch - 20, 3);
      ctx.fill();
      ctx.textAlign = 'right';
      ctx.fillStyle = theme.foreground;
      let ty = cy - f.height / 2;
      ty = drawLines(ctx, a.font, f.hf, x0 + w - 28 + dx, ty);
      if (f.bf) {
        ctx.fillStyle = alpha(theme.foreground, 0.75);
        drawLines(ctx, a.font, f.bf, x0 + w - 28 + dx, ty + 6);
      }
    }));
  });
}

/** شريط البحث — the title is typed word by word into a search bar, then the results drop in. */
export function drawSearch(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const items = shownItems(scene);
  const n = items.length;
  const colors = palette(theme);
  const words = wordTokens(scene.title);
  const first = n ? reveal(a, 0, n) : 40;
  const at = typingFrames(words.length, first);
  const typed = at.filter((f) => frame >= f).length;
  const barX = L.M;
  const barW = L.W - L.M * 2;
  const barY = L.M * (L.portrait ? 1.4 : 0.9);
  const textW = barW - (L.portrait ? 84 : 78) - 60;
  const full = fitText(ctx, fs, scene.title || ' ', { maxWidth: textW, maxLines: 2, maxSize: L.portrait ? 30 : 34, minSize: 16, weight: 'bold', lineHeight: 1.3 });
  const barH = Math.max(L.portrait ? 84 : 78, full.height + 30);
  const show = appear(frame, 0, 16);
  withAlpha(ctx, show, () => {
    card(ctx, theme, barX, barY, barW, barH, Math.min(barH / 2, 42));
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 3;
    roundRect(ctx, barX, barY, barW, barH, Math.min(barH / 2, 42));
    ctx.stroke();
    // The search button pulses once typing is done.
    const press = progress(frame, (at[at.length - 1] ?? 0) + 4, 10);
    const ps = press > 0 && press < 1 ? 1 - 0.15 * Math.sin(press * Math.PI) : 1;
    const br = Math.min(barH, 84) / 2 - 8;
    const bx = barX + br + 14;
    ctx.fillStyle = theme.accent;
    ctx.beginPath();
    ctx.arc(bx, barY + barH / 2, br * ps, 0, Math.PI * 2);
    ctx.fill();
    drawIcon(ctx, 'search', bx, barY + barH / 2, br * 1.1 * ps, readableOn(theme.accent), 2.6);
    // Typed words so far, wrapped like the full query (never reordered).
    const text = words.slice(0, typed).join(' ');
    const tx = barX + barW - 32;
    let cursorX = tx;
    let cursorY = barY + barH / 2;
    if (text) {
      const tf = fitText(ctx, fs, text, { maxWidth: textW, maxLines: 4, maxSize: full.fontSize, minSize: full.fontSize, weight: 'bold', lineHeight: 1.3 });
      ctx.fillStyle = theme.foreground;
      ctx.textAlign = 'right';
      const ty = barY + (barH - full.height) / 2;
      drawLines(ctx, fs, tf, tx, ty);
      const last = tf.lines[tf.lines.length - 1] ?? '';
      cursorX = tx - ctx.measureText(last).width - 8;
      cursorY = ty + tf.lineHeight * (tf.lines.length - 0.5);
    }
    // Blinking cursor after the typed words (to their left in RTL).
    if (Math.floor(frame / 12) % 2 === 0 && frame < first + 30) {
      ctx.fillStyle = theme.accent;
      ctx.fillRect(cursorX, cursorY - full.fontSize * 0.6, 3, full.fontSize * 1.2);
    }
  });
  if (!n) return;
  const top = barY + barH + 30;
  const avail = L.H - top - L.M * 0.5;
  const gap = 14;
  const rh = Math.min(L.portrait ? 160 : 120, (avail - gap * (n - 1)) / n);
  items.forEach((it, i) => {
    const t = progress(frame, reveal(a, i, n), 16);
    if (t <= 0) return;
    const y = top + i * (rh + gap);
    const color = colors[i % colors.length];
    const f = fitItem(a, it, barW - 70, 30, 22, 2, 2);
    itemEnter(a, t, L.W / 2, y + rh / 2, barW, rh, () => withAlpha(ctx, easeOutCubic(t), () => {
      const dy = (1 - easeOutCubic(t)) * -24;
      card(ctx, theme, barX, y + dy, barW, rh, 18);
      ctx.fillStyle = color;
      roundRect(ctx, barX + barW - 10, y + dy + 14, 5, rh - 28, 3);
      ctx.fill();
      ctx.textAlign = 'right';
      ctx.fillStyle = textAccent(theme, color);
      let ty = y + dy + (rh - f.height) / 2;
      ty = drawLines(ctx, fs, f.hf, barX + barW - 30, ty);
      if (f.bf) {
        ctx.fillStyle = alpha(theme.foreground, 0.78);
        drawLines(ctx, fs, f.bf, barX + barW - 30, ty + 6);
      }
    }));
  });
}

/** إصابة الهدف — darts fly into a target board one per item, and each goal pops into the list. */
export function drawTarget(a: SceneDrawArgs): void {
  const { ctx, theme, frame, layout: L, font: fs } = a;
  const top = drawHeader(a);
  const items = shownItems(a.scene);
  const n = items.length;
  if (!n) return;
  const colors = palette(theme);
  const avail = L.H - top - L.M * 0.5;
  const R = L.portrait ? Math.min(L.W * 0.3, avail * 0.2) : Math.min(avail * 0.44, L.W * 0.17);
  const cx = L.portrait ? L.W / 2 : L.M + R + 10;
  const cy = L.portrait ? top + R + 10 : top + avail / 2;
  const k = lastRevealed(a, n);
  // A small shake when a dart lands.
  const hit = k >= 0 ? progress(frame, reveal(a, k, n), 10) : 1;
  const shake = hit < 1 ? Math.sin(hit * Math.PI * 4) * 4 * (1 - hit) : 0;
  const show = appear(frame, 2, 22);
  withAlpha(ctx, show, () => {
    ctx.save();
    ctx.translate(cx + shake, cy);
    ctx.scale(0.6 + 0.4 * show, 0.6 + 0.4 * show);
    const ring = [theme.accent, theme.surface, theme.accent2, theme.surface, theme.accent];
    for (let r = 0; r < 5; r++) {
      ctx.fillStyle = r % 2 ? mix(theme.surface, theme.foreground, 0.05) : ring[r];
      ctx.beginPath();
      ctx.arc(0, 0, R * (1 - r * 0.19), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });
  // Darts: where each one sticks (near the bullseye, never on the same spot).
  const spot = (i: number): [number, number] => {
    const ang = (i / n) * Math.PI * 2 + hash01(i, 41) * 0.8 - Math.PI / 3;
    const d = (0.12 + hash01(i, 42) * 0.3) * R;
    return [cx + Math.cos(ang) * d, cy + Math.sin(ang) * d];
  };
  for (let i = 0; i < n; i++) {
    const r = reveal(a, i, n);
    const fly = progress(frame, r - 10, 10);
    if (fly <= 0) continue;
    const [tx, ty] = spot(i);
    const sx = L.portrait ? L.W + 80 : L.W * 0.6;
    const sy = L.portrait ? cy + R * 1.4 : cy - R * 1.2;
    const e = easeOutCubic(fly);
    const x = lerp(sx, tx, e) + shake;
    const y = lerp(sy, ty, e) - Math.sin(fly * Math.PI) * 30;
    const ang = Math.atan2(ty - sy, tx - sx);
    const color = colors[i % colors.length];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.strokeStyle = mix(theme.foreground, theme.background, 0.2);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-R * 0.55, 0);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-R * 0.55, 0);
    ctx.lineTo(-R * 0.7, -12);
    ctx.lineTo(-R * 0.62, 0);
    ctx.lineTo(-R * 0.7, 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    if (fly >= 1) numberDisc(a, i + 1, tx + shake, ty, 12, color);
  }
  // Goals list.
  const lx0 = L.portrait ? L.M : cx + R + 40;
  const lx1 = L.W - L.M;
  const ly0 = L.portrait ? cy + R + 30 : top;
  const lh = L.H - L.M * 0.5 - ly0;
  const rowH = Math.min(L.portrait ? 110 : 96, (lh - 12 * (n - 1)) / n);
  const y0 = ly0 + (lh - (rowH * n + 12 * (n - 1))) / 2;
  items.forEach((it, i) => {
    const t = progress(frame, reveal(a, i, n), 16);
    if (t <= 0) return;
    const y = y0 + i * (rowH + 12);
    const w = lx1 - lx0;
    const color = colors[i % colors.length];
    const f = fitItem(a, it, w - 90, 26, 19, 2, 2);
    itemEnter(a, t, lx0 + w / 2, y + rowH / 2, w, rowH, () => withAlpha(ctx, easeOutCubic(t), () => {
      const s = 0.8 + 0.2 * easeOutBack(t);
      ctx.save();
      ctx.translate(lx0 + w / 2, y + rowH / 2);
      ctx.scale(s, s);
      ctx.translate(-(lx0 + w / 2), -(y + rowH / 2));
      card(ctx, theme, lx0, y, w, rowH, 18, i === k ? mix(theme.surface, color, 0.16) : theme.surface);
      numberDisc(a, i + 1, lx1 - 36, y + rowH / 2, Math.min(20, rowH * 0.25), color);
      if (frame >= reveal(a, i, n) + 14) drawIcon(ctx, 'circle-check', lx0 + 32, y + rowH / 2, 28, color, 2.4);
      ctx.textAlign = 'right';
      ctx.fillStyle = theme.foreground;
      let ty = y + (rowH - f.height) / 2;
      ty = drawLines(ctx, fs, f.hf, lx1 - 68, ty);
      if (f.bf) {
        ctx.fillStyle = alpha(theme.foreground, 0.75);
        drawLines(ctx, fs, f.bf, lx1 - 68, ty + 6);
      }
      ctx.restore();
    }));
  });
}
