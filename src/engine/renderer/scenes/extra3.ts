import { localizeDigits } from '../../../design/digits';
import { alpha, mix, readableOn, textAccent } from '../../../design/presets';
import { bounceOut, clamp, easeInOutCubic, easeOutBack, easeOutCubic, hash01, progress } from '../animation';
import type { Ctx2D } from '../context';
import { font } from '../context';
import { drawIcon } from '../icons';
import { appear, card, drawHeader, iconBadge, itemEnter, roundRect, withAlpha, type Layout, type SceneDrawArgs } from '../kit';
import { drawLines, fitText, type FittedText } from '../textLayout';
import { chartRows, shownItems, valueRow } from '../../sceneModel';
import { CAPSULE, itemReveal } from '../../timing';
import { palette, parts } from './extra2';

/**
 * Thirteen more scene kinds, each with its own signature motion (spotlight, magnifier, magnet,
 * mosaic, liquid, domino, network, balance, gears, conveyor, decision fork, folded panels,
 * capsule). Every motion is a pure function of the scene frame, like the other drawers.
 */

type Box = { x: number; y: number; w: number; h: number };
const centre = (b: Box): [number, number] => [b.x + b.w / 2, b.y + b.h / 2];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInCubic = (t: number) => clamp(t) ** 3;

/** Boxes for n cards in reading order (first at the top right), centred in the free area. */
export function gridBoxes(L: Layout, top: number, n: number, maxH = 230, gap = 22): Box[] {
  const cols = L.portrait ? (n <= 3 ? 1 : 2) : n <= 3 ? n : Math.ceil(n / 2);
  const rows = Math.ceil(n / cols);
  const availH = L.H - top - L.M * 0.6;
  const w = (L.W - L.M * 2 - gap * (cols - 1)) / cols;
  const h = Math.min(maxH, (availH - gap * (rows - 1)) / rows);
  const y0 = top + Math.max(0, (availH - (rows * h + gap * (rows - 1))) / 2);
  return Array.from({ length: n }, (_, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const inRow = row === rows - 1 ? n - row * cols : cols;
    const rowW = inRow * w + (inRow - 1) * gap;
    const right = L.W / 2 + rowW / 2;
    return { x: right - (col + 1) * w - col * gap, y: y0 + row * (h + gap), w, h };
  });
}

/** Head (bold) and optional body of an item fitted to a width. */
export function fitItem(a: SceneDrawArgs, item: string, maxWidth: number, headSize = 28, bodySize = 21, headLines = 2, bodyLines = 3) {
  const { ctx, font: fs } = a;
  const { head, body } = parts(item);
  const hf = fitText(ctx, fs, head || ' ', { maxWidth, maxLines: headLines, maxSize: headSize, minSize: 13, weight: 'bold', lineHeight: 1.3 });
  const bf = body ? fitText(ctx, fs, body, { maxWidth, maxLines: bodyLines, maxSize: bodySize, minSize: 12, weight: 'regular', lineHeight: 1.4 }) : null;
  return { hf, bf, height: hf.height + (bf ? bf.height + 6 : 0) };
}

/** Draws a fitted head/body pair centred on x from `top`; returns the bottom. */
export function drawItem(a: SceneDrawArgs, f: { hf: FittedText; bf: FittedText | null }, x: number, top: number, headColor = a.theme.foreground): number {
  const { ctx, font: fs, theme } = a;
  ctx.textAlign = 'center';
  ctx.fillStyle = headColor;
  let y = drawLines(ctx, fs, f.hf, x, top);
  if (f.bf) {
    ctx.fillStyle = alpha(theme.foreground, 0.78);
    y = drawLines(ctx, fs, f.bf, x, y + 6);
  }
  return y;
}

/** Small numbered disc. */
export function numberDisc(a: SceneDrawArgs, n: number, cx: number, cy: number, r: number, color: string): void {
  const { ctx, font: fs, digits } = a;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = readableOn(color);
  ctx.font = font(fs, 'bold', r * 1.05);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(localizeDigits(String(n), digits), cx, cy + 1);
  ctx.textBaseline = 'alphabetic';
}

/** Index of the last revealed item (−1 before the first). */
export function lastRevealed(a: SceneDrawArgs, n: number): number {
  let k = -1;
  for (let i = 0; i < n; i++) if (a.frame >= itemReveal(a.scene, i, n)) k = i;
  return k;
}

/** الكشاف الذكي — the content sits in the dark; a spotlight travels from card to card and reveals it. */
export function drawSpotlight(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const top = drawHeader(a);
  const items = shownItems(scene);
  const n = items.length;
  if (!n) return;
  const boxes = gridBoxes(L, top, n, 210);
  const colors = palette(theme);
  const reveal = (i: number) => itemReveal(scene, i, n);
  // Spotlight path: from the top-right corner to each card, arriving as that card is revealed.
  let [sx, sy] = [L.W + 80, top - 60];
  for (let i = 0; i < n; i++) {
    const [tx, ty] = centre(boxes[i]);
    const prev = i ? reveal(i - 1) : 0;
    const start = Math.max(prev, reveal(i) - 22);
    if (frame < reveal(i)) {
      const t = easeInOutCubic(progress(frame, start, reveal(i) - start));
      sx = lerp(sx, tx, t);
      sy = lerp(sy, ty, t);
      break;
    }
    [sx, sy] = [tx, ty];
  }
  const R = Math.max(...boxes.map((b) => Math.max(b.w, b.h))) * 0.62;
  // After the last card the lights come up.
  const lightsUp = progress(frame, reveal(n - 1) + 40, 30);

  // Hidden cards: dim silhouettes with a question mark.
  boxes.forEach((b, i) => {
    if (frame >= reveal(i)) return;
    withAlpha(ctx, appear(frame, 4, 20) * 0.5, () => {
      ctx.fillStyle = alpha(theme.foreground, 0.08);
      roundRect(ctx, b.x, b.y, b.w, b.h, 22);
      ctx.fill();
      ctx.fillStyle = alpha(theme.foreground, 0.35);
      ctx.font = font(fs, 'bold', Math.min(64, b.h * 0.4));
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('؟', b.x + b.w / 2, b.y + b.h / 2);
      ctx.textBaseline = 'alphabetic';
    });
  });

  // Darkness with a hole where the light falls.
  withAlpha(ctx, (1 - lightsUp) * appear(frame, 0, 16), () => {
    ctx.fillStyle = alpha('#000000', 0.62);
    // A Path2D keeps the visual looks (outline/shadow) off this full-frame layer.
    if (typeof Path2D !== 'undefined') {
      const p = new Path2D();
      p.rect(0, top - 30, L.W, L.H - top + 30);
      p.arc(sx, sy, R, 0, Math.PI * 2, true);
      ctx.fill(p, 'evenodd');
    } else {
      ctx.beginPath();
      ctx.rect(0, top - 30, L.W, L.H - top + 30);
      ctx.arc(sx, sy, R, 0, Math.PI * 2, true);
      ctx.fill('evenodd');
    }
  });

  // Revealed cards stay lit.
  boxes.forEach((b, i) => {
    const t = progress(frame, reveal(i), 22);
    if (t <= 0) return;
    const [cx, cy] = centre(b);
    const color = colors[i % colors.length];
    itemEnter(a, t, cx, cy, b.w, b.h, () => withAlpha(ctx, easeOutCubic(t), () => {
      card(ctx, theme, b.x, b.y, b.w, b.h, 22);
      ctx.fillStyle = color;
      roundRect(ctx, b.x, b.y, b.w, 8, 4);
      ctx.fill();
      const f = fitItem(a, items[i], b.w - 40, 30, 21, 2, b.h > 170 ? 3 : 2);
      const discR = 19;
      const block = discR * 2 + 12 + f.height;
      const y0 = cy - block / 2;
      numberDisc(a, i + 1, cx, y0 + discR, discR, color);
      drawItem(a, f, cx, y0 + discR * 2 + 12);
    }));
    // A flash as the light lands.
    const flash = 1 - progress(frame, reveal(i), 14);
    if (flash > 0 && flash < 1) withAlpha(ctx, flash * 0.5, () => {
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, b.x, b.y, b.w, b.h, 22);
      ctx.fill();
    });
  });

  // The beam's rim and glow (kept below the title).
  withAlpha(ctx, (1 - lightsUp) * appear(frame, 0, 16), () => {
    ctx.beginPath();
    ctx.rect(0, top - 30, L.W, L.H - top + 30);
    ctx.clip();
    const g = ctx.createRadialGradient(sx, sy, R * 0.2, sx, sy, R);
    g.addColorStop(0, alpha('#ffffff', 0.1));
    g.addColorStop(1, alpha('#ffffff', 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(sx, sy, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = alpha(theme.accent, 0.7);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sx, sy, R, 0, Math.PI * 2);
    ctx.stroke();
  });
}

/** العدسة المكبرة — fine print in a list; a lens glides over each line and the detail panel enlarges it. */
export function drawMagnifier(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const top = drawHeader(a);
  const items = shownItems(scene);
  const n = items.length;
  if (!n) return;
  const colors = palette(theme);
  const reveal = (i: number) => itemReveal(scene, i, n);
  const availH = L.H - top - L.M * 0.6;
  // List area (fine print) and detail panel.
  const side = !L.portrait;
  const listW = side ? (L.W - L.M * 2) * 0.5 : L.W - L.M * 2;
  const listX = L.W - L.M - listW;
  const listH = side ? availH : availH * 0.5;
  const rowH = Math.min(70, listH / n);
  const listY = top + (side ? (availH - rowH * n) / 2 : 0);
  const panel: Box = side
    ? { x: L.M, y: top + 10, w: listX - L.M - 40, h: availH - 20 }
    : { x: L.M, y: listY + rowH * n + 30, w: L.W - L.M * 2, h: availH - rowH * n - 40 };

  const drawList = (focus: number) => {
    items.forEach((it, i) => {
      const y = listY + i * rowH;
      const seen = frame >= reveal(i);
      withAlpha(ctx, appear(frame, 6 + i * 3, 18) * (seen || i === focus ? 1 : 0.55), () => {
        ctx.fillStyle = alpha(theme.foreground, i % 2 ? 0.04 : 0.08);
        roundRect(ctx, listX, y + 4, listW, rowH - 8, 10);
        ctx.fill();
        const f = fitText(ctx, fs, parts(it).head, { maxWidth: listW - 70, maxLines: 1, maxSize: 17, minSize: 11, weight: 'regular', lineHeight: 1.2 });
        ctx.fillStyle = theme.foreground;
        ctx.textAlign = 'right';
        drawLines(ctx, fs, f, listX + listW - 46, y + rowH / 2 - f.height / 2);
        if (seen) numberDisc(a, i + 1, listX + listW - 22, y + rowH / 2, 12, colors[i % colors.length]);
      });
    });
  };
  drawList(-1);

  const k = lastRevealed(a, n);
  // Where each line's words start and end (right-aligned), so the lens scans the words themselves.
  const wordsEnd = listX + listW - 70;
  const wordsStart = items.map((it) => {
    const f = fitText(ctx, fs, parts(it).head, { maxWidth: listW - 70, maxLines: 1, maxSize: 17, minSize: 11, weight: 'regular', lineHeight: 1.2 });
    return Math.min(wordsEnd, Math.max(listX + 40, listX + listW - 46 - f.width + 24));
  });
  let lx = wordsEnd;
  let ly = listY + rowH / 2;
  for (let i = 0; i < n; i++) {
    const r = reveal(i);
    const y = listY + i * rowH + rowH / 2;
    if (frame < r) {
      const from = i ? listY + (i - 1) * rowH + rowH / 2 : listY - 80;
      const t = easeInOutCubic(progress(frame, r - 20, 20));
      ly = lerp(from, y, t);
      lx = lerp(i ? wordsStart[i - 1] : wordsEnd + 40, wordsEnd, t);
      break;
    }
    ly = y;
    const next = i + 1 < n ? reveal(i + 1) - 20 : r + 90;
    lx = lerp(wordsEnd, wordsStart[i], easeInOutCubic(progress(frame, r, Math.max(10, next - r))));
  }
  const lr = Math.min(96, rowH * (side ? 1.45 : 1.05));
  const lensIn = appear(frame, 8, 20);
  withAlpha(ctx, lensIn, () => {
    // Magnified copy of the list inside the lens.
    ctx.save();
    ctx.beginPath();
    ctx.arc(lx, ly, lr, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = mix(theme.surface, theme.foreground, 0.1);
    ctx.fillRect(lx - lr, ly - lr, lr * 2, lr * 2);
    ctx.translate(lx, ly);
    ctx.scale(1.7, 1.7);
    ctx.translate(-lx, -ly);
    drawList(k);
    ctx.restore();
    // Glass, rim and handle.
    const g = ctx.createRadialGradient(lx - lr * 0.4, ly - lr * 0.4, 2, lx, ly, lr);
    g.addColorStop(0, alpha('#ffffff', 0.22));
    g.addColorStop(1, alpha('#ffffff', 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(lx, ly, lr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(lx, ly, lr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineCap = 'round';
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.moveTo(lx - lr * 0.72, ly + lr * 0.72);
    ctx.lineTo(lx - lr * 1.45, ly + lr * 1.45);
    ctx.stroke();
  });

  // Detail panel: the item under the lens, enlarged.
  if (k < 0 || panel.h < 60) return;
  const t = progress(frame, reveal(k), 18);
  const color = colors[k % colors.length];
  withAlpha(ctx, appear(frame, 10, 20), () => {
    card(ctx, theme, panel.x, panel.y, panel.w, panel.h, 26);
    ctx.fillStyle = color;
    roundRect(ctx, panel.x + panel.w - 10, panel.y, 10, panel.h, 5);
    ctx.fill();
  });
  const [cx] = centre(panel);
  itemEnter(a, t, cx, panel.y + panel.h / 2, panel.w, panel.h, () => withAlpha(ctx, easeOutCubic(t), () => {
    const f = fitItem(a, items[k], panel.w - 70, side ? 44 : 38, side ? 28 : 24, 3, side ? 5 : 3);
    const block = 50 + f.height;
    const y0 = panel.y + Math.max(20, (panel.h - block) / 2);
    numberDisc(a, k + 1, cx, y0 + 18, 22, color);
    drawItem(a, f, cx, y0 + 50, textAccent(theme, color));
  }));
}

/** التجميع المغناطيسي — scattered pieces are pulled towards the centre and snap into one bar. */
export function drawMagnet(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L } = a;
  const top = drawHeader(a);
  const items = shownItems(scene);
  const n = items.length;
  if (!n) return;
  const colors = palette(theme);
  const availH = L.H - top - L.M * 0.6;
  const hubR = L.portrait ? 54 : 50;
  const hubY = top + hubR + 10;
  const cx = L.W / 2;
  // Docked pieces form one joined bar (two rows when long) under the magnet.
  const cols = L.portrait ? Math.min(2, n) : n <= 4 ? n : Math.ceil(n / 2);
  const rows = Math.ceil(n / cols);
  const barW = Math.min(L.W - L.M * 2, cols * (L.portrait ? 300 : 260));
  const segW = barW / cols;
  const segH = Math.min(150, (availH - hubR * 2 - 70) / rows);
  const barY = hubY + hubR + 50 + Math.max(0, (availH - hubR * 2 - 70 - rows * segH) / 2);
  const dock = (i: number): Box => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const inRow = row === rows - 1 ? n - row * cols : cols;
    const right = cx + (inRow * segW) / 2;
    return { x: right - (col + 1) * segW, y: barY + row * segH, w: segW, h: segH };
  };
  const seed = scene.id.length + n;
  const assembled = progress(frame, itemReveal(scene, n - 1, n) + 28, 24);

  // Magnet hub with field arcs.
  const hubT = easeOutBack(progress(frame, 2, 24));
  withAlpha(ctx, hubT, () => {
    for (let k = 0; k < 3; k++) {
      const p = ((frame + k * 20) % 60) / 60;
      ctx.strokeStyle = alpha(theme.accent, 0.4 * (1 - p));
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, hubY, hubR * (1.2 + p * 0.9), Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    }
    const pulse = 1 + 0.08 * Math.sin(assembled * Math.PI);
    iconBadge(ctx, theme, scene.icon, cx, hubY, hubR * hubT * pulse);
  });

  items.forEach((it, i) => {
    const d = dock(i);
    const [dx, dy] = centre(d);
    // Scattered start: around the frame edges, floating gently until pulled.
    const ang = hash01(i, seed) * Math.PI * 2;
    const sxp = clamp(0.5 + Math.cos(ang) * 0.42, 0.12, 0.88) * L.W;
    const syp = clamp(top + availH * (0.15 + hash01(i, seed + 7) * 0.8), top, L.H - L.M);
    const r = itemReveal(scene, i, n);
    const pull = easeInCubic(progress(frame, r, 24));
    const snap = progress(frame, r + 20, 14);
    const float = (1 - pull) * 8 * Math.sin(frame / 14 + i);
    const x = lerp(sxp, dx, pull);
    const y = lerp(syp, dy, pull) + float;
    const scale = lerp(0.62, 1, pull) * (snap > 0 && snap < 1 ? 1 + 0.06 * Math.sin(snap * Math.PI) : 1);
    const color = colors[i % colors.length];
    const show = appear(frame, 6 + i * 4, 18);
    if (show <= 0) return;
    // Field line while it is pulled in.
    if (pull > 0 && pull < 1) withAlpha(ctx, 0.6, () => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 8]);
      ctx.lineDashOffset = -frame * 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo((x + cx) / 2, y, cx, hubY + hubR);
      ctx.stroke();
      ctx.setLineDash([]);
    });
    const w = d.w - 8;
    const h = d.h - 8;
    withAlpha(ctx, show, () => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((1 - pull) * (hash01(i, seed + 3) - 0.5) * 0.5);
      ctx.scale(scale, scale);
      ctx.fillStyle = pull >= 1 ? mix(theme.surface, color, 0.3 + 0.2 * assembled) : mix(theme.surface, color, 0.18);
      roundRect(ctx, -w / 2, -h / 2, w, h, 18);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      roundRect(ctx, -w / 2, -h / 2, w, h, 18);
      ctx.stroke();
      const f = fitItem(a, it, w - 30, 26, 19, 2, 2);
      drawItem(a, f, 0, -f.height / 2);
      ctx.restore();
    });
  });

  // Once whole, a frame binds the pieces into one concept.
  if (assembled > 0) withAlpha(ctx, assembled, () => {
    const yTop = barY - 10;
    const hAll = rows * segH + 20;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 5;
    roundRect(ctx, cx - barW / 2 - 10, yTop, barW + 20, hAll, 26);
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx, hubY + hubR);
    ctx.lineTo(cx, yTop);
    ctx.stroke();
  });
}

/** Icon coverage on an n×n grid (cached per icon); null where offscreen canvases are unavailable. */
const masks = new Map<string, boolean[]>();
function iconMask(icon: string, n: number): boolean[] | null {
  const key = `${icon}|${n}`;
  const hit = masks.get(key);
  if (hit) return hit;
  if (typeof OffscreenCanvas === 'undefined') return null;
  try {
    const S = n * 10;
    const c = new OffscreenCanvas(S, S);
    const g = c.getContext('2d', { willReadFrequently: true }) as unknown as Ctx2D | null;
    if (!g) return null;
    drawIcon(g, icon, S / 2, S / 2, S * 0.92, '#000000', 3);
    const data = (g as OffscreenCanvasRenderingContext2D).getImageData(0, 0, S, S).data;
    const out: boolean[] = [];
    for (let r = 0; r < n; r++) {
      for (let q = 0; q < n; q++) {
        let on = 0;
        for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) if (data[((r * 10 + y) * S + q * 10 + x) * 4 + 3] > 60) on++;
        out.push(on > 14);
      }
    }
    if (!out.some(Boolean)) return null;
    if (masks.size > 60) masks.clear();
    masks.set(key, out);
    return out;
  } catch {
    return null;
  }
}

/** الفسيفساء المتشكلة — small tiles fly in and settle into the scene's icon; the points follow. */
export function drawMosaic(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L } = a;
  const top = drawHeader(a);
  const items = shownItems(scene);
  const n = items.length;
  const colors = palette(theme);
  const availH = L.H - top - L.M * 0.6;
  const side = !L.portrait && n > 0;
  const size = n === 0 ? Math.min(availH, L.W * 0.5) : side ? Math.min(availH * 0.92, (L.W - L.M * 2) * 0.42) : Math.min(L.W - L.M * 2.4, availH * 0.42);
  const mx = side ? L.M + size / 2 : L.W / 2;
  const my = side || n === 0 ? top + availH / 2 : top + size / 2;
  const N = 13;
  const mask = iconMask(scene.icon, N);
  const cell = size / N;
  const seed = scene.id.length * 7 + 3;
  let j = 0;
  for (let r = 0; r < N; r++) {
    for (let q = 0; q < N; q++, j++) {
      // Without a mask (no offscreen canvas) the tiles make a rounded square and the icon sits on it.
      const corner = (r < 1 || r > N - 2) && (q < 1 || q > N - 2);
      if (mask ? !mask[j] : corner) continue;
      const delay = 4 + Math.floor(hash01(j, seed) * 36);
      const t = easeOutCubic(progress(frame, delay, 26));
      if (t <= 0) continue;
      const tx = mx - size / 2 + q * cell;
      const ty = my - size / 2 + r * cell;
      const fx = hash01(j, seed + 1) * L.W;
      const fy = hash01(j, seed + 2) * L.H;
      const x = lerp(fx, tx, t);
      const y = lerp(fy, ty, t);
      const c = colors[Math.floor(hash01(j, seed + 4) * 3)];
      const shine = 0.15 * Math.max(0, Math.sin((frame - 70) / 14 - (q + r) * 0.35));
      ctx.save();
      ctx.translate(x + cell / 2, y + cell / 2);
      ctx.rotate((1 - t) * (hash01(j, seed + 5) - 0.5) * 3);
      ctx.fillStyle = mix(c, '#ffffff', shine);
      ctx.globalAlpha *= t;
      ctx.fillRect(-cell / 2 + 1.5, -cell / 2 + 1.5, cell - 3, cell - 3);
      ctx.restore();
    }
  }
  if (!mask) withAlpha(ctx, progress(frame, 50, 20), () => drawIcon(ctx, scene.icon, mx, my, size * 0.6, readableOn(colors[0]), 2.4));

  if (!n) return;
  const listBox: Box = side
    ? { x: mx + size / 2 + 40, y: top, w: L.W - L.M - (mx + size / 2 + 40), h: availH }
    : { x: L.M, y: my + size / 2 + 30, w: L.W - L.M * 2, h: L.H - L.M * 0.6 - (my + size / 2 + 30) };
  const rowH = Math.min(110, (listBox.h - 12 * (n - 1)) / n);
  const y0 = listBox.y + Math.max(0, (listBox.h - (rowH * n + 12 * (n - 1))) / 2);
  items.forEach((it, i) => {
    const t = progress(frame, itemReveal(scene, i, n), 22);
    if (t <= 0) return;
    const y = y0 + i * (rowH + 12);
    const color = colors[i % colors.length];
    itemEnter(a, t, listBox.x + listBox.w / 2, y + rowH / 2, listBox.w, rowH, () => withAlpha(ctx, easeOutCubic(t), () => {
      card(ctx, theme, listBox.x, y, listBox.w, rowH, 18);
      // Mosaic-style corner tiles.
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = alpha(colors[(i + k) % 3], 0.9);
        ctx.fillRect(listBox.x + listBox.w - 18 - k * 12, y + 10, 9, 9);
      }
      const f = fitItem(a, it, listBox.w - 60, 26, 19, 1, 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = textAccent(theme, color);
      const yy = drawLines(ctx, a.font, f.hf, listBox.x + listBox.w - 26, y + rowH / 2 - f.height / 2);
      if (f.bf) {
        ctx.fillStyle = alpha(theme.foreground, 0.78);
        drawLines(ctx, a.font, f.bf, listBox.x + listBox.w - 26, yy + 6);
      }
    }));
  });
}

/** الامتلاء السائل — a glass per value fills with a moving liquid up to its level. */
export function drawLiquid(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs, digits } = a;
  const top = drawHeader(a);
  const rows = chartRows(scene);
  const n = rows.length;
  if (!n) return;
  const colors = palette(theme);
  const percent = rows.some((r) => /[%٪]/.test(r.value));
  const max = Math.max(1, ...rows.map((r) => r.num));
  const cols = L.portrait ? (n <= 2 ? n : n <= 4 ? 2 : 3) : n <= 4 ? n : 3;
  const rowsN = Math.ceil(n / cols);
  const availH = L.H - top - L.M * 0.5;
  const cellW = (L.W - L.M * 2) / cols;
  const cellH = availH / rowsN;
  const gw = Math.min(cellW * 0.5, 170);
  const gh = Math.min(cellH - 120, gw * 1.7, 330);
  rows.forEach((r, i) => {
    const t0 = itemReveal(scene, i, n);
    const show = progress(frame, t0, 20);
    if (show <= 0) return;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const inRow = row === rowsN - 1 ? n - row * cols : cols;
    const cx = L.W / 2 + ((inRow - 1) / 2 - col) * cellW;
    const gy = top + row * cellH + (cellH - gh - 90) / 2 + 44;
    const gx = cx - gw / 2;
    const pct = clamp((percent ? r.num : (r.num / max) * 100) / 100);
    const fill = easeInOutCubic(progress(frame, t0 + 8, 70)) * pct;
    const color = colors[i % colors.length];
    itemEnter(a, show, cx, gy + gh / 2, gw, gh, () => withAlpha(ctx, easeOutCubic(show), () => {
      // Liquid, clipped to the glass.
      ctx.save();
      roundRect(ctx, gx, gy, gw, gh, Math.min(34, gw * 0.25));
      ctx.clip();
      ctx.fillStyle = alpha(theme.foreground, 0.06);
      ctx.fillRect(gx, gy, gw, gh);
      const level = gy + gh * (1 - fill);
      const settle = progress(frame, t0 + 78, 60);
      const amp = (5 + 5 * (1 - settle)) * (fill > 0 ? 1 : 0);
      const g = ctx.createLinearGradient(0, level, 0, gy + gh);
      g.addColorStop(0, mix(color, '#ffffff', 0.15));
      g.addColorStop(1, mix(color, '#000000', 0.25));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(gx, gy + gh);
      for (let x = 0; x <= gw; x += 6) ctx.lineTo(gx + x, level + Math.sin(x / 20 + frame / 8 + i) * amp);
      ctx.lineTo(gx + gw, gy + gh);
      ctx.closePath();
      ctx.fill();
      // Rising bubbles.
      for (let b = 0; b < 6; b++) {
        const p = ((frame * (0.6 + hash01(b, i) * 0.6) + hash01(b, i + 9) * 100) % 100) / 100;
        const by = gy + gh - p * (gy + gh - level);
        if (by <= level + 6) continue;
        ctx.fillStyle = alpha('#ffffff', 0.35 * (1 - p));
        ctx.beginPath();
        ctx.arc(gx + 12 + hash01(b, i + 4) * (gw - 24), by, 3 + hash01(b, i + 2) * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      // Glass outline, scale marks and shine.
      ctx.strokeStyle = alpha(theme.foreground, 0.55);
      ctx.lineWidth = 4;
      roundRect(ctx, gx, gy, gw, gh, Math.min(34, gw * 0.25));
      ctx.stroke();
      ctx.strokeStyle = alpha(theme.foreground, 0.25);
      ctx.lineWidth = 2;
      for (let m = 1; m < 4; m++) {
        const y = gy + (gh * m) / 4;
        ctx.beginPath();
        ctx.moveTo(gx + gw - 18, y);
        ctx.lineTo(gx + gw - 4, y);
        ctx.stroke();
      }
      ctx.fillStyle = alpha('#ffffff', 0.12);
      roundRect(ctx, gx + 10, gy + 14, 8, gh * 0.6, 4);
      ctx.fill();
      // Value above, label below.
      const shown = percent ? `${Math.round(fill * 100)}%` : r.value ? r.value : '';
      ctx.fillStyle = textAccent(theme, color);
      ctx.font = font(fs, 'bold', Math.min(44, gw * 0.32));
      ctx.textAlign = 'center';
      ctx.fillText(localizeDigits(shown, digits), cx, gy - 14);
      const f = fitText(ctx, fs, r.label, { maxWidth: cellW - 24, maxLines: 2, maxSize: 26, minSize: 13, weight: 'bold', lineHeight: 1.3 });
      ctx.fillStyle = theme.foreground;
      drawLines(ctx, fs, f, cx, gy + gh + 14);
    }));
  });
}

/** الدومينو السببي — standing tiles tip over one after another: each cause sets off the next. */
export function drawDomino(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L } = a;
  const top = drawHeader(a);
  const items = shownItems(scene);
  const n = items.length;
  if (!n) return;
  const colors = palette(theme);
  const availH = L.H - top - L.M * 0.5;
  const reveal = (i: number) => itemReveal(scene, i, n);
  // Tiles stand close together (like real dominoes) so each one leans on the next as it falls.
  const th = Math.min(L.portrait ? 170 : 160, availH * 0.36);
  const tw = th * 0.34;
  const spacing = th * 0.62;
  const rowW = spacing * (n - 1) + tw;
  const right = L.W / 2 + rowW / 2 + th * 0.3;
  const baseY = top + th + 16;
  const lean = Math.asin(clamp((spacing - tw + 3) / th, 0, 0.95));
  ctx.fillStyle = alpha(theme.foreground, 0.25);
  ctx.fillRect(right - rowW - th * 1.1, baseY, rowW + th * 1.4, 4);
  const stopX = right - (n - 1) * spacing - tw - (spacing - tw);
  withAlpha(ctx, appear(frame, 4, 16), () => {
    ctx.fillStyle = alpha(theme.foreground, 0.4);
    roundRect(ctx, stopX - 18, baseY - th * 0.4, 18, th * 0.4, 4);
    ctx.fill();
  });
  for (let i = n - 1; i >= 0; i--) {
    const x = right - i * spacing - tw;
    const fall = easeInCubic(progress(frame, reveal(i), 12));
    const color = colors[i % colors.length];
    withAlpha(ctx, appear(frame, 4 + i * 3, 16), () => {
      ctx.save();
      ctx.translate(x, baseY);
      ctx.rotate(-lean * fall);
      card(ctx, theme, 0, -th, tw, th, 8, fall > 0 ? mix(theme.surface, color, 0.55) : theme.surface);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      roundRect(ctx, 0, -th, tw, th, 8);
      ctx.stroke();
      ctx.strokeStyle = alpha(theme.foreground, 0.3);
      ctx.beginPath();
      ctx.moveTo(5, -th / 2);
      ctx.lineTo(tw - 5, -th / 2);
      ctx.stroke();
      numberDisc(a, i + 1, tw / 2, -th * 0.74, Math.min(17, tw * 0.33), color);
      ctx.restore();
    });
    // Impact ring where it lands on the next tile.
    const hit = progress(frame, reveal(i) + 10, 14);
    if (hit > 0 && hit < 1) {
      const px = x - Math.sin(lean) * th;
      const py = baseY - Math.cos(lean) * th;
      withAlpha(ctx, 1 - hit, () => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(px, py, 8 + hit * 26, 0, Math.PI * 2);
        ctx.stroke();
      });
    }
  }
  // What each fall causes, in numbered cards under the row.
  const boxes = gridBoxes(L, baseY + 26, n, 150, 16);
  items.forEach((it, i) => {
    const t = progress(frame, reveal(i) + 6, 20);
    if (t <= 0) return;
    const b = boxes[i];
    const color = colors[i % colors.length];
    const [cx, cy] = centre(b);
    itemEnter(a, t, cx, cy, b.w, b.h, () => withAlpha(ctx, easeOutCubic(t), () => {
      card(ctx, theme, b.x, b.y, b.w, b.h, 16);
      ctx.fillStyle = color;
      roundRect(ctx, b.x + b.w - 8, b.y, 8, b.h, 4);
      ctx.fill();
      numberDisc(a, i + 1, b.x + b.w - 34, cy, 17, color);
      const f = fitItem(a, it, b.w - 84, 26, 19, 2, 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = theme.foreground;
      const yy = drawLines(ctx, a.font, f.hf, b.x + b.w - 62, cy - f.height / 2);
      if (f.bf) {
        ctx.fillStyle = alpha(theme.foreground, 0.78);
        drawLines(ctx, a.font, f.bf, b.x + b.w - 62, yy + 6);
      }
    }));
  });
}

/** الشبكة العصبية — nodes in layers, joined by links along which pulses of light keep flowing. */
export function drawNetwork(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L } = a;
  const top = drawHeader(a);
  const items = shownItems(scene);
  const n = items.length;
  if (!n) return;
  const colors = palette(theme);
  const LAYERS: Record<number, number[]> = { 1: [1], 2: [1, 1], 3: [1, 1, 1], 4: [1, 2, 1], 5: [2, 2, 1], 6: [2, 2, 2] };
  const layers = LAYERS[n];
  const availH = L.H - top - L.M * 0.5;
  const R = L.portrait ? 28 : 26;
  // Node positions: layers flow right → left (landscape) or top → bottom (portrait).
  const pos: { x: number; y: number; layer: number; slots: number }[] = [];
  let idx = 0;
  layers.forEach((count, li) => {
    for (let k = 0; k < count; k++, idx++) {
      if (L.portrait) {
        const y = top + 20 + ((li + 0.5) / layers.length) * (availH - 40);
        const x = L.W / 2 + ((count - 1) / 2 - k) * (L.W * 0.44);
        pos.push({ x, y: y - 20, layer: li, slots: count });
      } else {
        const x = L.W - L.M - ((li + 0.5) / layers.length) * (L.W - L.M * 2);
        const y = top + ((k + 0.5) / count) * (availH - 60);
        pos.push({ x, y, layer: li, slots: count });
      }
    }
  });
  const reveal = (i: number) => itemReveal(scene, i, n);
  // Links between consecutive layers, with travelling pulses once both ends are on.
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (pos[j].layer !== pos[i].layer + 1) continue;
      const t = progress(frame, Math.max(reveal(i), reveal(j)), 20);
      if (t <= 0) continue;
      const p = pos[i], q = pos[j];
      const ex = lerp(p.x, q.x, easeOutCubic(t));
      const ey = lerp(p.y, q.y, easeOutCubic(t));
      ctx.strokeStyle = alpha(colors[i % colors.length], 0.55);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      if (t >= 1) {
        const period = 46 + ((i * 7 + j * 3) % 20);
        const u = ((frame + i * 11 + j * 17) % period) / period;
        const x = lerp(p.x, q.x, u), y = lerp(p.y, q.y, u);
        const g = ctx.createRadialGradient(x, y, 0, x, y, 14);
        g.addColorStop(0, alpha('#ffffff', 0.95));
        g.addColorStop(0.4, alpha(theme.accent, 0.8));
        g.addColorStop(1, alpha(theme.accent, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, 14, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // Nodes and their labels.
  items.forEach((it, i) => {
    const t = progress(frame, reveal(i), 22);
    if (t <= 0) return;
    const { x, y, slots } = pos[i];
    const color = colors[i % colors.length];
    const glow = 0.5 + 0.5 * Math.sin(frame / 10 + i);
    const labelW = L.portrait ? (slots > 1 ? L.W * 0.4 : L.W - L.M * 2) : Math.min(260, (L.W - L.M * 2) / layers.length - 20);
    const f = fitItem(a, it, labelW - 24, 24, 18, 2, 2);
    itemEnter(a, t, x, y + R + f.height / 2, labelW, R * 2 + f.height + 20, () => withAlpha(ctx, easeOutCubic(t), () => {
      ctx.fillStyle = alpha(color, 0.18 + 0.12 * glow);
      ctx.beginPath();
      ctx.arc(x, y, R * 1.6, 0, Math.PI * 2);
      ctx.fill();
      numberDisc(a, i + 1, x, y, R * easeOutBack(t), color);
      const boxH = f.height + 16;
      ctx.fillStyle = alpha(theme.surface, 0.92);
      roundRect(ctx, x - labelW / 2, y + R + 12, labelW, boxH, 14);
      ctx.fill();
      drawItem(a, f, x, y + R + 20);
    }));
  });
}

/** الميزان الذكي — two weights drop onto the pans and the beam settles towards the heavier side. */
export function drawBalance(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const top = drawHeader(a);
  const items = shownItems(scene);
  const n = items.length;
  if (!n) return;
  const colors = [theme.accent, theme.accent2];
  const sides = items.slice(0, 2).map((it) => valueRow(it) ?? { label: it.trim(), value: '', num: 1 });
  const w0 = sides[0]?.num ?? 0;
  const w1 = sides[1]?.num ?? 0;
  const reveal = (i: number) => itemReveal(scene, i, n);
  const availH = L.H - top - L.M * 0.5;
  const note = items[2];
  const cx = L.W / 2;
  const pivotY = top + (note ? availH * 0.16 : availH * 0.22);
  const half = Math.min(L.portrait ? (L.W - L.M * 2) / 2 - 30 : 340, L.W * 0.3);
  const strLen = Math.min(L.portrait ? 160 : 120, availH * 0.28);
  // Beam angle (positive: right side down). The first item sits on the right pan (reading start).
  const target = w0 + w1 > 0 ? 0.24 * ((w0 - w1) / Math.max(w0, w1, 1)) : 0;
  const d0 = progress(frame, reveal(0) + 16, 30);
  const after1 = frame - (reveal(1 < n ? 1 : 0) + 16);
  let ang = 0.2 * easeOutCubic(d0);
  if (n > 1 && after1 > 0) ang = target + (0.2 - target) * Math.cos(after1 / 7) * Math.exp(-after1 / 26);

  // Stand.
  withAlpha(ctx, appear(frame, 2, 18), () => {
    ctx.fillStyle = alpha(theme.foreground, 0.5);
    ctx.fillRect(cx - 6, pivotY, 12, strLen + 120);
    ctx.beginPath();
    ctx.moveTo(cx - 90, pivotY + strLen + 140);
    ctx.lineTo(cx + 90, pivotY + strLen + 140);
    ctx.lineTo(cx, pivotY + strLen + 100);
    ctx.closePath();
    ctx.fill();
  });
  const ends = [1, -1].map((s) => [cx + Math.cos(ang) * half * s, pivotY + Math.sin(ang) * half * s] as const);
  withAlpha(ctx, appear(frame, 4, 18), () => {
    ctx.strokeStyle = theme.foreground;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ends[1][0], ends[1][1]);
    ctx.lineTo(ends[0][0], ends[0][1]);
    ctx.stroke();
    ctx.fillStyle = theme.accent;
    ctx.beginPath();
    ctx.arc(cx, pivotY, 16, 0, Math.PI * 2);
    ctx.fill();
  });
  const heavier = n > 1 && after1 > 60 && w0 !== w1 ? (w0 > w1 ? 0 : 1) : -1;
  ends.forEach(([ex, ey], k) => {
    const panY = ey + strLen;
    const panW = Math.min(half * 0.95, 230);
    withAlpha(ctx, appear(frame, 6, 18), () => {
      ctx.strokeStyle = alpha(theme.foreground, 0.6);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - panW / 2, panY);
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex + panW / 2, panY);
      ctx.stroke();
      ctx.fillStyle = mix(theme.surface, colors[k], 0.3);
      ctx.beginPath();
      ctx.ellipse(ex, panY, panW / 2, 16, 0, 0, Math.PI);
      ctx.fill();
    });
    if (k >= sides.length) return;
    // Weight block dropping onto the pan.
    const t = progress(frame, reveal(k), 18);
    if (t <= 0) return;
    const side = sides[k];
    const bw = panW * 0.82;
    const f = fitText(ctx, fs, side.label, { maxWidth: bw - 20, maxLines: 2, maxSize: 26, minSize: 13, weight: 'bold', lineHeight: 1.25 });
    const bh = f.height + (side.value ? 44 : 22);
    const drop = (1 - bounceOut(t)) * 200;
    const by = panY - bh - drop;
    withAlpha(ctx, clamp(t * 3), () => {
      if (heavier === k) withAlpha(ctx, 0.35 + 0.2 * Math.sin(frame / 8), () => {
        ctx.fillStyle = colors[k];
        roundRect(ctx, ex - bw / 2 - 10, by - 10, bw + 20, bh + 20, 20);
        ctx.fill();
      });
      ctx.fillStyle = colors[k];
      roundRect(ctx, ex - bw / 2, by, bw, bh, 14);
      ctx.fill();
      ctx.fillStyle = readableOn(colors[k]);
      ctx.textAlign = 'center';
      let y = drawLines(ctx, fs, f, ex, by + 10);
      if (side.value) {
        ctx.font = font(fs, 'bold', 26);
        ctx.textBaseline = 'middle';
        ctx.fillText(side.value, ex, y + 16);
        ctx.textBaseline = 'alphabetic';
        y += 32;
      }
    });
  });
  if (!note) return;
  const t = progress(frame, reveal(2), 22);
  if (t <= 0) return;
  const w = Math.min(L.W - L.M * 2, 820);
  const f = fitItem(a, note, w - 60, 28, 21, 2, 2);
  const h = f.height + 34;
  const y = L.H - L.M * 0.5 - h;
  itemEnter(a, t, cx, y + h / 2, w, h, () => withAlpha(ctx, easeOutCubic(t), () => {
    card(ctx, theme, cx - w / 2, y, w, h, 20);
    drawItem(a, f, cx, y + 17, textAccent(theme, theme.accent));
  }));
}

/** Gear outline with z teeth, centred at the origin. */
function gearPath(ctx: Ctx2D, R: number, z: number): void {
  const ri = R * 0.8;
  ctx.beginPath();
  for (let k = 0; k < z; k++) {
    const a0 = (k / z) * Math.PI * 2;
    const step = (Math.PI * 2) / z;
    const pts: [number, number][] = [
      [ri, a0], [R, a0 + step * 0.15], [R, a0 + step * 0.45], [ri, a0 + step * 0.6],
    ];
    pts.forEach(([r, t], m) => (k === 0 && m === 0 ? ctx.moveTo(Math.cos(t) * r, Math.sin(t) * r) : ctx.lineTo(Math.cos(t) * r, Math.sin(t) * r)));
  }
  ctx.closePath();
}

/** سلسلة التروس — meshed gears start turning one after another, passing the motion along. */
export function drawGears(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L } = a;
  const top = drawHeader(a);
  const items = shownItems(scene);
  const n = items.length;
  if (!n) return;
  const colors = palette(theme);
  const availH = L.H - top - L.M * 0.5;
  const reveal = (i: number) => itemReveal(scene, i, n);
  const Z = 12;
  // Chain along the reading direction, alternating sides so neighbours mesh.
  const along = L.portrait ? availH : L.W - L.M * 2;
  const R = Math.min(L.portrait ? 92 : 100, (along / (n * 1.6 + 0.4)) * 1.0, L.portrait ? L.W * 0.16 : availH * 0.24);
  const d = R * 1.86;
  const off = R * 0.7;
  const step = Math.sqrt(Math.max(1, d * d - off * off));
  const span = step * (n - 1);
  const centres = items.map((_, i) => {
    const s = (i % 2 ? 1 : -1) * off * (n > 1 ? 0.5 : 0);
    if (L.portrait) return [L.W * 0.3 + s, top + availH / 2 - span / 2 + i * step] as const;
    return [L.W / 2 + span / 2 - i * step, top + availH * 0.42 + s] as const;
  });
  const spin = (frame - reveal(0)) * 0.035;
  items.forEach((it, i) => {
    const [x, y] = centres[i];
    const on = progress(frame, reveal(i), 20);
    const color = colors[i % colors.length];
    const show = appear(frame, 4 + i * 3, 18);
    withAlpha(ctx, show * (0.3 + 0.7 * on), () => {
      ctx.save();
      ctx.translate(x, y);
      // Neighbours turn the other way, offset half a tooth so the teeth interlock.
      ctx.rotate(on > 0 ? (i % 2 ? -spin : spin) + (i % 2 ? Math.PI / Z : 0) : (i % 2 ? Math.PI / Z : 0));
      gearPath(ctx, R, Z);
      ctx.fillStyle = on > 0 ? color : alpha(theme.foreground, 0.25);
      ctx.fill();
      ctx.fillStyle = theme.background;
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      numberDisc(a, i + 1, x, y, R * 0.36, on > 0 ? mix(color, theme.foreground, 0.15) : alpha(theme.foreground, 0.3));
    });
    const t = progress(frame, reveal(i) + 4, 20);
    if (t <= 0) return;
    // Label on the free side of the gear.
    const f = fitItem(a, it, L.portrait ? L.W * 0.5 - 40 : Math.max(150, step * 1.15), 24, 18, 2, 3);
    if (L.portrait) {
      const lx = L.W * 0.3 + R * 1.25 + (L.W - L.M - L.W * 0.3 - R * 1.25) / 2;
      withAlpha(ctx, easeOutCubic(t), () => drawItem(a, f, lx, y - f.height / 2, textAccent(theme, color)));
      return;
    }
    const below = i % 2 === 1 || n === 1;
    const ly = below ? y + R + 18 : y - R - 18 - f.height;
    withAlpha(ctx, easeOutCubic(t), () => drawItem(a, f, x, ly, textAccent(theme, color)));
  });
}

/** السير الناقل — a parcel rides a belt and stops at each station, which lights up as it arrives. */
export function drawConveyor(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L } = a;
  const top = drawHeader(a);
  const items = shownItems(scene);
  const n = items.length;
  if (!n) return;
  const colors = palette(theme);
  const availH = L.H - top - L.M * 0.5;
  const reveal = (i: number) => itemReveal(scene, i, n);
  const vertical = L.portrait;
  // Belt geometry: start → end in reading direction.
  const beltA = vertical ? top + 10 : L.W - L.M;
  const beltB = vertical ? L.H - L.M * 0.6 : L.M;
  const fixed = vertical ? L.W - L.M - 40 : top + availH * 0.78;
  const pos = (i: number) => lerp(beltA, beltB, (i + 0.75) / (n + 0.5));
  // Parcel position along the belt and whether it is moving.
  let p = lerp(beltA, pos(0), 0);
  let moving = false;
  for (let i = 0; i < n; i++) {
    const r = reveal(i);
    const travel = Math.min(30, Math.max(12, r - (i ? reveal(i - 1) : 0) - 6));
    const from = i ? pos(i - 1) : beltA;
    if (frame < r) {
      const t = progress(frame, r - travel, travel);
      p = lerp(from, pos(i), easeInOutCubic(t));
      moving = t > 0;
      break;
    }
    p = pos(i);
  }
  const beltIn = appear(frame, 2, 20);
  const thick = 26;
  withAlpha(ctx, beltIn, () => {
    ctx.fillStyle = alpha(theme.foreground, 0.18);
    if (vertical) roundRect(ctx, fixed - thick / 2, beltA, thick, beltB - beltA, thick / 2);
    else roundRect(ctx, beltB, fixed - thick / 2, beltA - beltB, thick, thick / 2);
    ctx.fill();
    ctx.strokeStyle = alpha(theme.foreground, 0.45);
    ctx.lineWidth = 3;
    ctx.setLineDash([14, 12]);
    ctx.lineDashOffset = -frame * (moving ? 3 : 0.4);
    ctx.beginPath();
    if (vertical) {
      ctx.moveTo(fixed, beltA + 8);
      ctx.lineTo(fixed, beltB - 8);
    } else {
      ctx.moveTo(beltA - 8, fixed);
      ctx.lineTo(beltB + 8, fixed);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // Rollers.
    const count = Math.max(3, Math.round(Math.abs(beltB - beltA) / 130));
    for (let k = 0; k <= count; k++) {
      const s = lerp(beltA, beltB, k / count);
      const [x, y] = vertical ? [fixed, s] : [s, fixed];
      ctx.fillStyle = theme.surface;
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = alpha(theme.foreground, 0.6);
      ctx.lineWidth = 2;
      const ang = frame * 0.15;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(ang) * 8, y + Math.sin(ang) * 8);
      ctx.lineTo(x - Math.cos(ang) * 8, y - Math.sin(ang) * 8);
      ctx.stroke();
    }
  });
  // Stations.
  const k = lastRevealed(a, n);
  const slot = Math.abs(beltB - beltA) / (n + 0.5);
  items.forEach((it, i) => {
    const s = pos(i);
    const lit = frame >= reveal(i);
    const t = progress(frame, reveal(i), 18);
    const color = colors[i % colors.length];
    const w = vertical ? fixed - 30 - L.M : slot - 14;
    const f = fitItem(a, it, w - 24, vertical ? 26 : 26, 19, 2, vertical ? 2 : 3);
    const h = vertical ? Math.min(slot - 14, f.height + 50) : Math.min(fixed - thick - 50 - top, Math.max(150, f.height + 70));
    const bx = vertical ? L.M : s - w / 2;
    const by = vertical ? s - h / 2 : fixed - thick / 2 - 20 - h;
    withAlpha(ctx, appear(frame, 4 + i * 3, 16) * (lit ? 1 : 0.4), () => {
      card(ctx, theme, bx, by, w, h, 16, lit ? mix(theme.surface, color, 0.22) : theme.surface);
      if (lit) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 3 + 2 * (1 - t);
        roundRect(ctx, bx, by, w, h, 16);
        ctx.stroke();
      }
      numberDisc(a, i + 1, vertical ? bx + w - 24 : bx + w / 2, vertical ? by + h / 2 : by + 24, 15, lit ? color : alpha(theme.foreground, 0.4));
      if (vertical) {
        ctx.textAlign = 'right';
        ctx.fillStyle = theme.foreground;
        const yy = drawLines(ctx, a.font, f.hf, bx + w - 50, by + h / 2 - f.height / 2);
        if (f.bf) {
          ctx.fillStyle = alpha(theme.foreground, 0.78);
          drawLines(ctx, a.font, f.bf, bx + w - 50, yy + 6);
        }
      } else drawItem(a, f, bx + w / 2, by + 48 + Math.max(0, (h - 48 - f.height) / 2 - 6));
      // Chute from the station down to the belt.
      ctx.fillStyle = alpha(color, lit ? 0.7 : 0.3);
      if (vertical) ctx.fillRect(bx + w, s - 4, fixed - thick / 2 - bx - w, 8);
      else ctx.fillRect(s - 4, by + h, 8, fixed - thick / 2 - by - h);
    });
  });
  // Parcel: takes the colour of the last station it passed.
  const pc = k >= 0 ? colors[k % colors.length] : theme.foreground;
  const size = 44;
  const [px, py] = vertical ? [fixed, p] : [p, fixed - thick / 2 - size / 2 - 2];
  withAlpha(ctx, beltIn, () => {
    ctx.fillStyle = mix(pc, '#8B5E34', k >= 0 ? 0.15 : 0.6);
    roundRect(ctx, px - size / 2, py - size / 2, size, size, 8);
    ctx.fill();
    ctx.strokeStyle = alpha('#000000', 0.25);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px - size / 2, py);
    ctx.lineTo(px + size / 2, py);
    ctx.moveTo(px, py - size / 2);
    ctx.lineTo(px, py + size / 2);
    ctx.stroke();
    if (k >= 0) drawIcon(ctx, 'check', px, py, 24, readableOn(pc), 3);
  });
}

/** مفترق القرارات — a path splits into options that light up one after another with their outcome. */
export function drawDecision(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L } = a;
  const top = drawHeader(a);
  const items = shownItems(scene);
  const n = items.length;
  if (!n) return;
  const colors = palette(theme);
  const availH = L.H - top - L.M * 0.5;
  const reveal = (i: number) => itemReveal(scene, i, n);
  const k = lastRevealed(a, n);
  // Start point, fork and option cards. Portrait: a trunk runs down the right side and each
  // option branches off it, so no branch crosses a card.
  const trunkX = L.W - L.M - 26;
  const start: [number, number] = L.portrait ? [trunkX, top + 20] : [L.W - L.M - 30, top + availH / 2];
  const cards: Box[] = L.portrait
    ? (() => {
        const h = Math.min(170, (availH - 80 - 16 * (n - 1)) / n);
        const y0 = top + 80;
        return items.map((_, i) => ({ x: L.M, y: y0 + i * (h + 16), w: L.W - L.M * 2 - 90, h }));
      })()
    : (() => {
        const w = L.W * 0.46 - L.M;
        const h = Math.min(130, (availH - 16 * (n - 1)) / n);
        const y0 = top + (availH - (h * n + 16 * (n - 1))) / 2;
        return items.map((_, i) => ({ x: L.M, y: y0 + i * (h + 16), w, h }));
      })();
  const fork: [number, number] = L.portrait ? [trunkX, cards[n - 1].y + cards[n - 1].h / 2 - 30] : [L.W * 0.66, top + availH / 2];
  const trunk = easeOutCubic(progress(frame, 6, 24));
  withAlpha(ctx, appear(frame, 2, 16), () => {
    ctx.strokeStyle = theme.foreground;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(start[0], start[1]);
    ctx.lineTo(lerp(start[0], fork[0], trunk), lerp(start[1], fork[1], trunk));
    ctx.stroke();
    iconBadge(ctx, theme, scene.icon, start[0], start[1], 30);
    if (trunk >= 1 && !L.portrait) {
      ctx.fillStyle = theme.accent;
      ctx.beginPath();
      ctx.arc(fork[0], fork[1], 12, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  items.forEach((it, i) => {
    const t = progress(frame, reveal(i), 24);
    if (t <= 0) return;
    const b = cards[i];
    const color = colors[i % colors.length];
    const end: [number, number] = [b.x + b.w, b.y + b.h / 2];
    // Portrait branches leave the trunk just above their card.
    const from: [number, number] = L.portrait ? [trunkX, end[1] - 30] : fork;
    const c1: [number, number] = L.portrait ? [trunkX, end[1]] : [lerp(fork[0], end[0], 0.45), fork[1]];
    const c2: [number, number] = L.portrait ? [lerp(trunkX, end[0], 0.5), end[1]] : [lerp(fork[0], end[0], 0.55), end[1]];
    const current = i === k;
    const e = easeOutCubic(clamp(t * 1.4));
    ctx.save();
    ctx.strokeStyle = alpha(color, current ? 1 : 0.55);
    ctx.lineWidth = current ? 7 : 5;
    ctx.lineCap = 'round';
    ctx.setLineDash([2400 * e, 4000]);
    ctx.beginPath();
    ctx.moveTo(from[0], from[1]);
    ctx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], end[0], end[1]);
    ctx.stroke();
    ctx.restore();
    const ct = clamp((t - 0.45) * 1.8);
    if (ct <= 0) return;
    itemEnter(a, ct, b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, () => withAlpha(ctx, ct * (current || k === n - 1 ? 1 : 0.75), () => {
      card(ctx, theme, b.x, b.y, b.w, b.h, 18, current ? mix(theme.surface, color, 0.2) : theme.surface);
      ctx.strokeStyle = color;
      ctx.lineWidth = current ? 4 : 2;
      roundRect(ctx, b.x, b.y, b.w, b.h, 18);
      ctx.stroke();
      const { head, body } = parts(it);
      const f = fitItem(a, body ? `${head}: ${body}` : head, b.w - 40, 26, 20, 2, 2);
      if (body) {
        // Option, then its outcome after an arrow.
        const hf = fitText(ctx, a.font, head, { maxWidth: b.w - 40, maxLines: 1, maxSize: 26, minSize: 13, weight: 'bold', lineHeight: 1.3 });
        const bf = fitText(ctx, a.font, `← ${body}`, { maxWidth: b.w - 40, maxLines: 2, maxSize: 20, minSize: 12, weight: 'regular', lineHeight: 1.4 });
        const hh = hf.height + bf.height + 6;
        drawItem(a, { hf, bf }, b.x + b.w / 2, b.y + b.h / 2 - hh / 2, textAccent(theme, color));
      } else drawItem(a, f, b.x + b.w / 2, b.y + b.h / 2 - f.height / 2, textAccent(theme, color));
    }));
  });
}

/** الأوراق المطوية — panels unfold on their hinges, one after another, like a brochure. */
export function drawFolded(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L } = a;
  const top = drawHeader(a);
  const items = shownItems(scene);
  const n = items.length;
  if (!n) return;
  const colors = palette(theme);
  const availH = L.H - top - L.M * 0.5;
  const reveal = (i: number) => itemReveal(scene, i, n);
  const vertical = L.portrait;
  const total = vertical ? availH : L.W - L.M * 2;
  const pw = vertical ? L.W - L.M * 2 : total / n;
  const ph = vertical ? total / n : Math.min(availH, 420);
  const y0 = vertical ? top : top + (availH - ph) / 2;
  items.forEach((it, i) => {
    const t = easeOutCubic(progress(frame, reveal(i), 26));
    if (t <= 0) return;
    const color = colors[i % colors.length];
    const x = vertical ? L.M : L.W - L.M - (i + 1) * pw;
    const y = vertical ? y0 + i * ph : y0;
    // Hinge: right edge (landscape, unfolding leftwards) or top edge (portrait, unfolding down).
    const hx = vertical ? x : x + pw;
    const hy = vertical ? y : y + ph / 2;
    const tone = i % 2 ? mix(theme.surface, '#000000', 0.12) : theme.surface;
    ctx.save();
    ctx.translate(hx, hy);
    if (vertical) ctx.transform(1, 0, (1 - t) * 0.25, Math.max(0.02, t), 0, 0);
    else ctx.transform(Math.max(0.02, t), (1 - t) * (i % 2 ? 0.3 : -0.3), 0, 1, 0, 0);
    ctx.translate(-hx, -hy);
    ctx.fillStyle = tone;
    ctx.fillRect(x, y, pw, ph);
    // Fold shading: darker while folded, a soft crease gradient once open.
    const g = vertical ? ctx.createLinearGradient(0, y, 0, y + ph) : ctx.createLinearGradient(x + pw, 0, x, 0);
    g.addColorStop(0, alpha('#000000', 0.18 + (1 - t) * 0.4));
    g.addColorStop(0.25, alpha('#000000', (1 - t) * 0.3));
    g.addColorStop(1, alpha('#000000', 0.05 + (1 - t) * 0.3));
    ctx.fillStyle = g;
    ctx.fillRect(x, y, pw, ph);
    ctx.fillStyle = color;
    if (vertical) ctx.fillRect(x + pw - 10, y, 10, ph);
    else ctx.fillRect(x, y, pw, 10);
    withAlpha(ctx, clamp((t - 0.5) * 2), () => {
      if (vertical) {
        numberDisc(a, i + 1, x + pw - 46, y + ph / 2, 22, color);
        const f = fitItem(a, it, pw - 120, 28, 20, 1, ph > 160 ? 3 : 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = textAccent(theme, color);
        const yy = drawLines(ctx, a.font, f.hf, x + pw - 84, y + ph / 2 - f.height / 2);
        if (f.bf) {
          ctx.fillStyle = alpha(theme.foreground, 0.8);
          drawLines(ctx, a.font, f.bf, x + pw - 84, yy + 6);
        }
      } else {
        const f = fitItem(a, it, pw - 34, 32, 23, 3, 6);
        const block = 52 + 22 + f.height;
        const by = y + Math.max(30, (ph - block) / 2);
        numberDisc(a, i + 1, x + pw / 2, by + 26, 26, color);
        drawItem(a, f, x + pw / 2, by + 74, textAccent(theme, color));
      }
    });
    ctx.restore();
    // Crease between panels.
    ctx.strokeStyle = alpha('#000000', 0.25);
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (vertical) {
      ctx.moveTo(x, y);
      ctx.lineTo(x + pw, y);
    } else {
      ctx.moveTo(x + pw, y);
      ctx.lineTo(x + pw, y + ph);
    }
    ctx.stroke();
  });
}

/** الكبسولة المعرفية — a capsule shakes, snaps open with a burst of symbols, and releases one fact. */
export function drawCapsule(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs } = a;
  const items = shownItems(scene);
  const cx = L.W / 2;
  const cy = L.portrait ? L.H * 0.36 : L.H * 0.4;
  const cw = L.portrait ? 300 : 280;
  const ch = cw * 0.42;
  const drop = easeOutBack(progress(frame, CAPSULE.drop, 22));
  const shakeT = progress(frame, CAPSULE.shake, CAPSULE.open - CAPSULE.shake);
  const open = easeOutCubic(progress(frame, CAPSULE.open, 22));
  const wobble = shakeT > 0 && open <= 0 ? Math.sin(frame * 1.6) * 0.09 * shakeT : 0;
  const halves = [theme.accent, theme.accent2];
  // Two halves: they part sideways and tilt as the capsule opens.
  [1, -1].forEach((s, k) => {
    withAlpha(ctx, drop * (1 - 0.55 * open), () => {
      ctx.save();
      ctx.translate(cx + s * open * (L.portrait ? 220 : 330), cy - (L.portrait ? 0 : 0) + open * 40);
      ctx.rotate(wobble + s * open * 0.5);
      ctx.scale(drop, drop);
      ctx.fillStyle = halves[k];
      ctx.beginPath();
      if (s > 0) {
        ctx.moveTo(0, -ch / 2);
        ctx.lineTo(cw / 2 - ch / 2, -ch / 2);
        ctx.arc(cw / 2 - ch / 2, 0, ch / 2, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(0, ch / 2);
      } else {
        ctx.moveTo(0, -ch / 2);
        ctx.lineTo(-cw / 2 + ch / 2, -ch / 2);
        ctx.arc(-cw / 2 + ch / 2, 0, ch / 2, -Math.PI / 2, Math.PI / 2, true);
        ctx.lineTo(0, ch / 2);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = alpha('#ffffff', 0.25);
      roundRect(ctx, s > 0 ? 10 : -cw / 2 + ch / 2, -ch / 2 + 10, cw / 2 - ch / 2 - 10, 10, 5);
      ctx.fill();
      ctx.restore();
    });
  });
  // Burst of symbols.
  const burst = frame - CAPSULE.open;
  if (burst >= 0 && burst < 70) {
    const icons = ['sparkles', 'lightbulb', 'star', scene.icon || 'sparkles'];
    for (let i = 0; i < 14; i++) {
      const ang = hash01(i, 11) * Math.PI * 2;
      const dist = (120 + hash01(i, 5) * 240) * easeOutCubic(burst / 50);
      const x = cx + Math.cos(ang) * dist;
      const y = cy + Math.sin(ang) * dist * 0.75;
      withAlpha(ctx, 1 - progress(burst, 35, 35), () => drawIcon(ctx, icons[i % icons.length], x, y, 26 + hash01(i, 3) * 18, i % 2 ? theme.accent : theme.accent2, 2.2));
    }
  }
  // The fact (first item) grows out of the capsule; the title labels it, the note follows.
  const factT = progress(frame, CAPSULE.fact, 24);
  const fact = items[0] ?? '';
  const titleT = appear(frame, CAPSULE.fact - 6, 20);
  if (scene.title && titleT > 0) withAlpha(ctx, titleT, () => {
    const f = fitText(ctx, fs, scene.title, { maxWidth: L.W - L.M * 2, maxLines: 2, maxSize: 40, minSize: 22, weight: 'bold', lineHeight: 1.35 });
    ctx.fillStyle = textAccent(theme, theme.accent);
    ctx.textAlign = 'center';
    drawLines(ctx, fs, f, cx, (L.portrait ? L.M * 2 : L.M * 0.9) + (1 - titleT) * 20);
  });
  if (fact && factT > 0) {
    const w = Math.min(L.W - L.M * 2, 900);
    const f = fitText(ctx, fs, fact, { maxWidth: w - 70, maxLines: 4, maxSize: L.portrait ? 40 : 42, minSize: 20, weight: 'bold', lineHeight: 1.45 });
    const h = f.height + 60;
    const y = cy - h / 2;
    const k = easeOutBack(factT);
    withAlpha(ctx, clamp(factT * 2), () => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(k, k);
      ctx.translate(-cx, -cy);
      card(ctx, theme, cx - w / 2, y, w, h, 28, mix(theme.surface, theme.accent, 0.12));
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 3;
      roundRect(ctx, cx - w / 2, y, w, h, 28);
      ctx.stroke();
      ctx.fillStyle = theme.foreground;
      ctx.textAlign = 'center';
      drawLines(ctx, fs, f, cx, y + 30);
      ctx.restore();
    });
    const note = items[1];
    const nt = appear(frame, CAPSULE.note, 22);
    if (note && nt > 0) withAlpha(ctx, nt, () => {
      const nf = fitText(ctx, fs, note, { maxWidth: w - 40, maxLines: 2, maxSize: 26, minSize: 14, weight: 'regular', lineHeight: 1.4 });
      ctx.fillStyle = alpha(theme.foreground, 0.8);
      ctx.textAlign = 'center';
      drawLines(ctx, fs, nf, cx, y + h + 30 + (1 - nt) * 16);
    });
  }
}
