import { alpha } from '../../design/presets';
import type { Scene, SceneImage, Theme } from '../../domain/types';
import { getBitmap } from '../../storage/assets';
import { IMAGE, imageEnterAt, imageExitAt } from '../timing';
import { easeOutBack, easeOutCubic, progress } from './animation';
import type { Ctx2D } from './context';
import type { Layout } from './kit';

/** Box of a placed picture in design-space coordinates (centre, size, rotation). */
export function imageBox(img: SceneImage, L: Layout, natural: { width: number; height: number }) {
  const w = L.W * img.scale;
  const h = (w * natural.height) / Math.max(1, natural.width);
  return { cx: L.W * img.x, cy: L.H * img.y, w, h, rotation: (img.rotation * Math.PI) / 180 };
}

function shapePath(ctx: Ctx2D, img: SceneImage, w: number, h: number): void {
  ctx.beginPath();
  if (img.shape === 'circle') {
    ctx.ellipse(0, 0, Math.min(w, h) / 2, Math.min(w, h) / 2, 0, 0, Math.PI * 2);
  } else if (img.shape === 'rounded') {
    ctx.roundRect(-w / 2, -h / 2, w, h, Math.max(0, Math.min(w, h) * 0.08) || 0);
  } else {
    ctx.rect(-w / 2, -h / 2, w, h);
  }
}

/**
 * Draws a scene's picture with its transform, mask, frame and entrance. A picture whose bitmap
 * is not loaded yet draws a neutral placeholder so layout stays stable (export waits for all
 * pictures before starting, so placeholders never reach a video).
 */
export function drawSceneImage(ctx: Ctx2D, img: SceneImage, k: number, theme: Required<Theme>, L: Layout, frame: number, durationFrames: number): void {
  const bmp = getBitmap(img.assetId);
  const natural = bmp ? { width: bmp.width, height: bmp.height } : { width: 4, height: 3 };
  const box = imageBox(img, L, natural);
  // Entering, then (when it has an exit time) leaving the same way it came in.
  const exit = imageExitAt(img, k, durationFrames);
  const out = exit === null ? 0 : progress(frame, exit, IMAGE.length);
  if (out >= 1 || (img.entrance === 'none' && out > 0)) return;
  const t = Math.min(progress(frame, imageEnterAt(img, k, durationFrames), IMAGE.length), 1 - out);
  let a = img.opacity;
  let s = 1;
  let dx = 0;
  switch (img.entrance) {
    case 'fade':
      a *= easeOutCubic(t);
      break;
    case 'zoom':
      a *= easeOutCubic(t);
      s = 0.6 + 0.4 * easeOutBack(t);
      break;
    case 'slide':
      a *= easeOutCubic(t);
      dx = -(1 - easeOutCubic(t)) * L.W * 0.25;
      break;
    case 'none':
      break;
  }
  // Gentle Ken Burns drift keeps still pictures alive.
  const drift = 1 + 0.03 * progress(frame, 0, durationFrames);
  if (a <= 0.001) return;

  const circle = img.shape === 'circle';
  const w = circle ? Math.min(box.w, box.h) : box.w;
  const h = circle ? Math.min(box.w, box.h) : box.h;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.translate(box.cx + dx, box.cy);
  ctx.rotate(box.rotation);
  ctx.scale(s, s);
  if (img.shadow) {
    ctx.fillStyle = alpha('#000000', 0.18);
    ctx.save();
    ctx.translate(6, 12);
    shapePath(ctx, img, w, h);
    ctx.fill();
    ctx.restore();
  }
  ctx.save();
  shapePath(ctx, img, w, h);
  ctx.clip();
  if (bmp) {
    // Cover-fit inside the mask, slightly zoomed for the drift.
    const k = Math.max(w / bmp.width, h / bmp.height) * drift;
    ctx.drawImage(bmp, (-bmp.width * k) / 2, (-bmp.height * k) / 2, bmp.width * k, bmp.height * k);
  } else {
    ctx.fillStyle = theme.surface;
    ctx.fillRect(-w / 2, -h / 2, w, h);
  }
  ctx.restore();
  if (img.border) {
    ctx.lineWidth = Math.max(4, Math.min(w, h) * 0.025);
    ctx.strokeStyle = theme.accent;
    shapePath(ctx, img, w, h);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Draws the scene's first picture as a round portrait (profile cards). Returns false when the
 * scene has no picture or its pixels are not loaded yet, so the caller can draw an icon instead.
 */
export function drawSceneImageAvatar(ctx: Ctx2D, scene: Scene, cx: number, cy: number, r: number): boolean {
  const img = scene.images?.[0];
  const bmp = img ? getBitmap(img.assetId) : null;
  if (!bmp || r <= 0) return false;
  const k = Math.max((r * 2) / bmp.width, (r * 2) / bmp.height);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(bmp, cx - (bmp.width * k) / 2, cy - (bmp.height * k) / 2, bmp.width * k, bmp.height * k);
  ctx.restore();
  return true;
}
