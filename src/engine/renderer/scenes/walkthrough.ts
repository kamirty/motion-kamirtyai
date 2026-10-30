import { localizeDigits } from '../../../design/digits';
import { alpha, mix, readableOn, textAccent } from '../../../design/presets';
import { getBitmap, getImageSize } from '../../../storage/assets';
import { clamp, easeInOutCubic, easeOutBack, easeOutCubic, progress } from '../animation';
import { font, type Ctx2D } from '../context';
import { drawIcon } from '../icons';
import { appear, card, iconBadge, roundRect, withAlpha, type SceneDrawArgs } from '../kit';
import { drawLines, fitText } from '../textLayout';
import { shownItems } from '../../sceneModel';
import { walkBeats } from '../../timing';
import { parts } from './extra2';

/**
 * خطوة شرح — an app/website walkthrough step (after a tutorial video the owner shared): a
 * numbered step badge and title, the scene's first picture shown as a screenshot inside a phone
 * or browser frame, a pointer that glides to the tap point and presses with a ripple, a pulsing
 * highlight and gentle zoom on that point, a callout card sliding in, and a progress tracker of
 * the walkthrough steps at the bottom.
 */

type Rect = { x: number; y: number; w: number; h: number };

/** Draws the screenshot (or a neutral placeholder) into the screen rect, zoomed around (zx, zy). */
function drawScreen(a: SceneDrawArgs, r: Rect, zoom: number, zx: number, zy: number): void {
  const { ctx, scene, theme } = a;
  const img = scene.images?.[0];
  const bmp = img ? getBitmap(img.assetId) : undefined;
  ctx.save();
  roundRect(ctx, r.x, r.y, r.w, r.h, 18);
  ctx.clip();
  ctx.translate(zx, zy);
  ctx.scale(zoom, zoom);
  ctx.translate(-zx, -zy);
  if (bmp) {
    // Width-fit, top-aligned like a real screen.
    const k = r.w / bmp.width;
    ctx.drawImage(bmp, r.x, r.y, r.w, bmp.height * k);
  } else {
    // Placeholder "app" so the scene reads well before a screenshot is added.
    ctx.fillStyle = mix(theme.surface, '#ffffff', 0.08);
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = alpha(theme.accent, 0.85);
    ctx.fillRect(r.x, r.y, r.w, Math.min(56, r.h * 0.12));
    const rows = 6;
    for (let i = 0; i < rows; i++) {
      const y = r.y + r.h * 0.2 + i * (r.h * 0.11);
      ctx.fillStyle = alpha(theme.foreground, i === 1 ? 0.28 : 0.12);
      roundRect(ctx, r.x + r.w * 0.08, y, r.w * 0.84, r.h * 0.07, 8);
      ctx.fill();
    }
    drawIcon(ctx, scene.icon || 'smartphone', r.x + r.w / 2, r.y + r.h * 0.86, Math.min(r.w, r.h) * 0.16, alpha(theme.foreground, 0.45), 2);
  }
  ctx.restore();
}

/** Screenshot aspect (height / width): the picture's own, or a phone/browser default. */
function screenAspect(a: SceneDrawArgs): number {
  const img = a.scene.images?.[0];
  const size = img ? getImageSize(img.assetId) : undefined;
  if (size && size.width > 0) return size.height / size.width;
  return a.layout.portrait ? 2.05 : 0.62;
}

export function drawWalkthrough(a: SceneDrawArgs): void {
  const { ctx, scene, theme, frame, layout: L, font: fs, digits } = a;
  const items = shownItems(scene);
  const beats = walkBeats(scene);
  const step = a.step ?? { index: 0, count: 1 };

  // Header: step number badge, title and subtitle (right-aligned, reading order).
  const top = L.portrait ? L.M * 1.6 : L.M * 0.8;
  const badgeR = L.portrait ? 32 : 28;
  const bx = L.W - L.M - badgeR;
  const by = top + badgeR;
  const bt = easeOutBack(progress(frame, 2, 22));
  withAlpha(ctx, clamp(bt), () => {
    ctx.fillStyle = theme.accent;
    ctx.beginPath();
    ctx.arc(bx, by, badgeR * bt, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = readableOn(theme.accent);
    ctx.font = font(fs, 'bold', badgeR * 1.1);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(localizeDigits(String(step.index + 1), digits), bx, by + 2);
    ctx.textBaseline = 'alphabetic';
  });
  const textRight = bx - badgeR - 18;
  const tf = fitText(ctx, fs, scene.title || ' ', { maxWidth: textRight - L.M, maxLines: 2, maxSize: L.portrait ? 44 : 42, minSize: 24, weight: 'bold', lineHeight: 1.35 });
  const tt = appear(frame, 6, 20);
  withAlpha(ctx, tt, () => {
    ctx.fillStyle = theme.foreground;
    ctx.textAlign = 'right';
    drawLines(ctx, fs, tf, textRight + (1 - tt) * 30, by - Math.min(tf.height, badgeR * 2) / 2 - (tf.lines.length > 1 ? tf.lineHeight / 2 : 0));
  });
  let headerBottom = Math.max(by + badgeR, by - badgeR + tf.height) + 10;
  const sub = items[0];
  if (sub) {
    const sf = fitText(ctx, fs, sub, { maxWidth: textRight - L.M, maxLines: 2, maxSize: 24, minSize: 14, weight: 'regular', lineHeight: 1.4 });
    withAlpha(ctx, appear(frame, 14, 20), () => {
      ctx.fillStyle = alpha(theme.foreground, 0.75);
      ctx.textAlign = 'right';
      drawLines(ctx, fs, sf, textRight, headerBottom);
    });
    headerBottom += sf.height + 6;
  }

  // Device: phone for tall screenshots, browser window for wide ones.
  const tracker = step.count > 1 ? 90 : 30;
  const availTop = headerBottom + 24;
  const availH = L.H - availTop - tracker - L.M * 0.3;
  const callout = items[1];
  const side = !L.portrait && !!callout;
  const availW = side ? (L.W - L.M * 2) * 0.55 : L.W - L.M * 2;
  const aspect = screenAspect(a);
  const phone = aspect > 1.1;
  const bezel = phone ? 12 : 0;
  const bar = phone ? 0 : 30;
  let sw = availW - bezel * 2;
  let sh = sw * aspect;
  const maxSh = availH - bezel * 2 - bar;
  if (sh > maxSh) {
    sh = maxSh;
    sw = sh / aspect;
  }
  if (phone) sw = Math.min(sw, L.portrait ? L.W * 0.62 : sw);
  sh = Math.min(sh, sw * aspect);
  const devW = sw + bezel * 2;
  const devH = sh + bezel * 2 + bar;
  const devCx = side ? L.M + availW / 2 : L.W / 2;
  const devX = devCx - devW / 2;
  const devY = availTop + Math.max(0, (availH - devH) / 2);
  const screen: Rect = { x: devX + bezel, y: devY + bezel + bar, w: sw, h: sh };
  const tap = scene.tap ?? { x: 0.5, y: 0.45 };
  const tx = screen.x + screen.w * tap.x;
  const ty = screen.y + screen.h * tap.y;

  const dIn = progress(frame, beats.device, 28);
  const zoom = 1 + 0.22 * easeInOutCubic(progress(frame, beats.zoom, 30));
  withAlpha(ctx, easeOutCubic(dIn), () => {
    ctx.save();
    ctx.translate(0, (1 - easeOutBack(dIn)) * 90);
    card(ctx, theme, devX, devY, devW, devH, phone ? 34 : 18, phone ? mix(theme.surface, '#000000', 0.35) : mix(theme.surface, '#ffffff', 0.9));
    if (!phone) {
      // Browser chrome: three dots and an address pill.
      ['#FF5F57', '#FEBC2E', '#28C840'].forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(devX + devW - 20 - i * 18, devY + 15, 5.5, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.fillStyle = alpha('#000000', 0.08);
      roundRect(ctx, devX + 20, devY + 7, devW * 0.55, 16, 8);
      ctx.fill();
    }
    drawScreen(a, screen, zoom, tx, ty);
    if (phone) {
      ctx.fillStyle = alpha('#000000', 0.55);
      roundRect(ctx, devX + devW / 2 - 36, devY + 6, 72, 8, 4);
      ctx.fill();
    }
    ctx.restore();
  });

  // Highlight on the tap point once pressed.
  const hl = progress(frame, beats.tap + 2, 16);
  if (hl > 0) withAlpha(ctx, hl * (0.7 + 0.3 * Math.sin(frame / 7)), () => {
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 4;
    const r = 30 * zoom;
    ctx.beginPath();
    ctx.arc(tx, ty, r + 6 * Math.sin(frame / 7), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = alpha(theme.accent, 0.15);
    ctx.beginPath();
    ctx.arc(tx, ty, r, 0, Math.PI * 2);
    ctx.fill();
  });

  // Pointer: glides in, presses with a ripple, then fades away.
  const pIn = progress(frame, beats.pointer, beats.tap - beats.pointer);
  const pOut = progress(frame, beats.tap + 40, 16);
  if (pIn > 0 && pOut < 1) {
    const e = easeInOutCubic(pIn);
    const px = tx + (1 - e) * L.W * 0.3;
    const py = ty + (1 - e) * L.H * 0.35;
    const press = progress(frame, beats.tap, 10);
    const k = press > 0 && press < 1 ? 1 - 0.22 * Math.sin(press * Math.PI) : 1;
    for (let w = 0; w < 2; w++) {
      const rp = progress(frame, beats.tap + w * 8, 26);
      if (rp > 0 && rp < 1) withAlpha(ctx, (1 - rp) * 0.7, () => {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(px, py, 18 + rp * 46, 0, Math.PI * 2);
        ctx.stroke();
      });
    }
    withAlpha(ctx, (1 - pOut) * clamp(pIn * 3), () => {
      ctx.fillStyle = alpha('#000000', 0.25);
      ctx.beginPath();
      ctx.arc(px + 3, py + 5, 20 * k, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px, py, 20 * k, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = alpha(theme.accent, 0.9);
      ctx.lineWidth = 3;
      ctx.stroke();
    });
  }

  // Callout card: the result of the step.
  if (callout) {
    const ct = progress(frame, beats.callout, 24);
    if (ct > 0) {
      const { head, body } = parts(callout);
      const w = side ? L.W - L.M * 2 - availW - 30 : Math.min(L.W - L.M * 2, 620);
      const iconR = 30;
      const hf = fitText(ctx, fs, head, { maxWidth: w - iconR * 2 - 50, maxLines: 2, maxSize: 30, minSize: 16, weight: 'bold', lineHeight: 1.3 });
      const bf = body ? fitText(ctx, fs, body, { maxWidth: w - iconR * 2 - 50, maxLines: 3, maxSize: 21, minSize: 13, weight: 'regular', lineHeight: 1.4 }) : null;
      const h = Math.max(iconR * 2 + 28, hf.height + (bf ? bf.height + 6 : 0) + 30);
      const x = side ? L.W - L.M - w : L.W / 2 - w / 2;
      const y = side ? devY + devH / 2 - h / 2 : Math.min(devY + devH * 0.72, L.H - tracker - h - 10);
      const e = easeOutBack(ct);
      withAlpha(ctx, clamp(ct * 2), () => {
        ctx.save();
        ctx.translate((1 - e) * (L.W * 0.4), 0);
        card(ctx, theme, x, y, w, h, 22, mix(theme.surface, '#ffffff', 0.92));
        iconBadge(ctx, theme, scene.icon, x + w - 20 - iconR, y + h / 2, iconR);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#161616';
        const textX = x + w - 40 - iconR * 2;
        const hh = hf.height + (bf ? bf.height + 6 : 0);
        let yy = drawLines(ctx, fs, hf, textX, y + h / 2 - hh / 2);
        if (bf) {
          ctx.fillStyle = '#555555';
          yy = drawLines(ctx, fs, bf, textX, yy + 6);
        }
        ctx.restore();
      });
    }
  }

  // Progress tracker of the walkthrough steps.
  if (step.count > 1) drawTracker(ctx, a, step.index, step.count, L.H - tracker / 2 - L.M * 0.25);
}

function drawTracker(ctx: Ctx2D, a: SceneDrawArgs, index: number, count: number, y: number): void {
  const { theme, frame, layout: L, font: fs, digits } = a;
  const t = appear(frame, 4, 20);
  const gap = Math.min(70, (L.W - L.M * 2) / Math.max(1, count - 1));
  const w = gap * (count - 1);
  const xOf = (i: number) => L.W / 2 + w / 2 - i * gap; // first step on the right
  withAlpha(ctx, t, () => {
    ctx.strokeStyle = alpha(theme.foreground, 0.3);
    ctx.lineWidth = 3;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(xOf(0), y);
    ctx.lineTo(xOf(count - 1), y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = theme.accent;
    ctx.beginPath();
    ctx.moveTo(xOf(0), y);
    ctx.lineTo(xOf(index), y);
    ctx.stroke();
    for (let i = 0; i < count; i++) {
      const x = xOf(i);
      const current = i === index;
      const done = i < index;
      ctx.fillStyle = done ? theme.accent : theme.background;
      ctx.strokeStyle = current || done ? theme.accent : alpha(theme.foreground, 0.4);
      ctx.lineWidth = current ? 4 : 3;
      ctx.beginPath();
      ctx.arc(x, y, current ? 11 + 2 * Math.sin(frame / 8) : 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = textAccent(theme, theme.accent);
    ctx.font = font(fs, 'bold', 18);
    ctx.textAlign = 'center';
    ctx.fillText(localizeDigits(`الخطوة ${index + 1} من ${count}`, digits), xOf(index), y + 34);
  });
}
