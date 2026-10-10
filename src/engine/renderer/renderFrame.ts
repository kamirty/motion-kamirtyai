import { localizeDigits } from '../../design/digits';
import { alpha, fullTheme, mix } from '../../design/presets';
import { sceneIndexAt } from '../../domain/timeline';
import { styleOf, type DigitSystem, type Project, type ProjectStyle, type Scene, type Theme } from '../../domain/types';
import { TRANSITION_FRAMES, easeInOutCubic, hash01, progress } from './animation';
import { fontSpec, type Ctx2D } from './context';
import { drawSceneImage } from './imageLayer';
import { drawScene, layoutFor, type Layout } from './scenes';

const localized = new WeakMap<Scene, Map<string, Scene>>();

/** Scene copy with digits converted to the project's digit system (memoised per scene object). */
function localizeScene(scene: Scene, digits: DigitSystem, pace: string): Scene {
  let byDigits = localized.get(scene);
  if (!byDigits) localized.set(scene, (byDigits = new Map()));
  const key = `${digits}|${pace}`;
  let out = byDigits.get(key);
  if (!out) {
    out = { ...scene, pace, title: localizeDigits(scene.title, digits), items: scene.items.map((i) => localizeDigits(i, digits)) } as Scene;
    byDigits.set(key, out);
  }
  return out;
}

let lowResCache: { canvas: OffscreenCanvas; ctx: OffscreenCanvasRenderingContext2D } | null = null;

/** Shared 1/8-scale scratch canvas for smooth background layers (null outside browsers). */
function lowRes(W: number, H: number) {
  if (typeof OffscreenCanvas === 'undefined') return null;
  const w = Math.ceil(W / 8);
  const h = Math.ceil(H / 8);
  if (!lowResCache || lowResCache.canvas.width !== w || lowResCache.canvas.height !== h) {
    const canvas = new OffscreenCanvas(w, h);
    const c = canvas.getContext('2d');
    if (!c) return null;
    lowResCache = { canvas, ctx: c };
  }
  return lowResCache;
}

const dotLayerCache = new Map<string, OffscreenCanvas>();

/**
 * Pre-drawn dot grid one cell larger than the frame, blitted with an offset each frame
 * (an unscaled copy is far cheaper than hundreds of arcs or a transformed pattern).
 * Returns null outside browsers; callers then draw the dots directly.
 */
function dotLayer(W: number, H: number, gap: number, color: string): OffscreenCanvas | null {
  if (typeof OffscreenCanvas === 'undefined') return null;
  const key = `${W}x${H}|${gap}|${color}`;
  let layer = dotLayerCache.get(key);
  if (!layer) {
    layer = new OffscreenCanvas(W + gap * 2, H + gap * 2);
    const c = layer.getContext('2d');
    if (!c) return null;
    c.fillStyle = color;
    c.beginPath();
    for (let y = gap / 2; y < layer.height; y += gap) {
      for (let x = gap / 2; x < layer.width; x += gap) {
        c.moveTo(x + 2.2, y);
        c.arc(x, y, 2.2, 0, Math.PI * 2);
      }
    }
    c.fill();
    if (dotLayerCache.size > 8) dotLayerCache.clear();
    dotLayerCache.set(key, layer);
  }
  return layer;
}

function drawBackground(ctx: Ctx2D, L: Layout, theme: Required<Theme>, style: ProjectStyle, frame: number): void {
  const { W, H } = L;
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, W, H);
  const t = frame / 30;
  if (style.background === 'gradient') {
    const blobs = [
      { x: 0.15, y: 0.2, r: 0.45, c: theme.accent, sx: 0.11, sy: 0.07 },
      { x: 0.85, y: 0.8, r: 0.5, c: theme.accent2, sx: 0.08, sy: 0.13 },
      { x: 0.7, y: 0.15, r: 0.3, c: theme.accent, sx: 0.05, sy: 0.09 },
    ];
    // The whole layer is smooth, so it is drawn at 1/8 resolution and scaled up (much cheaper).
    const low = lowRes(W, H);
    const target: Ctx2D = low?.ctx ?? ctx;
    const k = low ? 1 / 8 : 1;
    const g = target.createLinearGradient(0, 0, W * k, H * k);
    g.addColorStop(0, theme.background);
    g.addColorStop(1, mix(theme.background, theme.accent2, 0.16));
    target.fillStyle = g;
    target.fillRect(0, 0, W * k, H * k);
    for (const b of blobs) {
      const cx = W * (b.x + 0.06 * Math.sin(t * b.sx * 2 * Math.PI)) * k;
      const cy = H * (b.y + 0.06 * Math.cos(t * b.sy * 2 * Math.PI)) * k;
      const r = Math.max(W, H) * b.r * k;
      const rg = target.createRadialGradient(cx, cy, 0, cx, cy, r);
      rg.addColorStop(0, alpha(b.c, 0.16));
      rg.addColorStop(1, alpha(b.c, 0));
      target.fillStyle = rg;
      target.fillRect(0, 0, W * k, H * k);
    }
    if (low) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'low';
      ctx.drawImage(low.canvas, 0, 0, W, H);
    }
  } else if (style.background === 'dots') {
    const gap = 36;
    const off = (frame * 0.4) % gap;
    const layer = dotLayer(W, H, gap, alpha(theme.foreground, 0.07));
    if (layer) {
      ctx.drawImage(layer, off - gap * 1.5, off - gap * 1.5);
    } else {
      ctx.fillStyle = alpha(theme.foreground, 0.07);
      ctx.beginPath();
      for (let y = -gap + off; y < H + gap; y += gap) {
        for (let x = -gap + off; x < W + gap; x += gap) {
          ctx.moveTo(x + 2.2, y);
          ctx.arc(x, y, 2.2, 0, Math.PI * 2);
        }
      }
      ctx.fill();
    }
    // Corner glow, drawn at low resolution like the gradient background.
    const low = lowRes(W, H);
    const target: Ctx2D = low?.ctx ?? ctx;
    const k = low ? 1 / 8 : 1;
    if (low) low.ctx.clearRect(0, 0, low.canvas.width, low.canvas.height);
    const rg = target.createRadialGradient(W * k, 0, 0, W * k, 0, Math.max(W, H) * k);
    rg.addColorStop(0, alpha(theme.accent, 0.1));
    rg.addColorStop(1, alpha(theme.accent, 0));
    target.fillStyle = rg;
    target.fillRect(0, 0, W * k, H * k);
    if (low) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'low';
      ctx.drawImage(low.canvas, 0, 0, W, H);
    }
  } else if (style.background === 'waves') {
    const bands = [
      { c: theme.accent, a: 0.1, amp: 26, len: 1.3, speed: 0.6, base: 0.82 },
      { c: theme.accent2, a: 0.1, amp: 34, len: 0.9, speed: -0.45, base: 0.88 },
      { c: theme.accent, a: 0.07, amp: 20, len: 1.8, speed: 0.3, base: 0.12 },
    ];
    for (const b of bands) {
      ctx.fillStyle = alpha(b.c, b.a);
      ctx.beginPath();
      const top = b.base < 0.5;
      ctx.moveTo(0, top ? 0 : H);
      for (let x = 0; x <= W; x += 16) {
        const y = H * b.base + b.amp * Math.sin((x / W) * Math.PI * 2 * b.len + t * b.speed * Math.PI);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, top ? 0 : H);
      ctx.closePath();
      ctx.fill();
    }
  }
  // A few floating sparkles for depth (deterministic).
  if (style.background !== 'plain') {
    for (let i = 0; i < 14; i++) {
      const x = hash01(i, 7) * W;
      const y = (hash01(i, 13) * H - frame * (0.2 + hash01(i, 3) * 0.5) + H * 10) % H;
      ctx.fillStyle = alpha(i % 2 ? theme.accent : theme.foreground, 0.08 + 0.06 * Math.sin(t * 2 + i));
      ctx.beginPath();
      ctx.arc(x, y, 2 + hash01(i, 21) * 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/**
 * Draws one frame. Pure function of (project, frameIndex): no clocks, randomness or DOM reads,
 * so preview and export produce identical pixels for the same frame. `outSize` defaults to the
 * project size and only changes resolution, never layout.
 */
export function renderFrame(project: Project, frameIndex: number, ctx: Ctx2D, outSize = project.size): void {
  const style = styleOf(project);
  const theme = fullTheme(project.theme);
  const L = layoutFor(project.size);
  const fs = fontSpec(style.font);
  const scale = Math.min(outSize.width / L.W, outSize.height / L.H);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, outSize.width, outSize.height);
  ctx.setTransform(scale, 0, 0, scale, (outSize.width - L.W * scale) / 2, (outSize.height - L.H * scale) / 2);
  ctx.direction = 'rtl';
  ctx.textBaseline = 'alphabetic';

  drawBackground(ctx, L, theme, style, frameIndex);

  const index = sceneIndexAt(project, frameIndex);
  const raw = project.scenes[index];
  if (raw) {
    const scene = localizeScene(raw, style.digits, style.pace);
    const local = frameIndex - scene.startFrame;
    const T = Math.min(TRANSITION_FRAMES, Math.floor(scene.durationFrames / 4));
    // Enter (0→1) over the first T frames; exit (0→1) over the last T frames. First scene fades in only from black-free start.
    const enter = index === 0 ? 1 : easeInOutCubic(progress(local, 0, T));
    const exit = index === project.scenes.length - 1 ? 0 : easeInOutCubic(progress(local, scene.durationFrames - T, T));
    ctx.save();
    let opacity = 1;
    switch (style.transition) {
      case 'fade':
        opacity = Math.min(enter, 1 - exit);
        break;
      case 'slide': {
        // RTL reading: new content arrives from the left, old content leaves to the right.
        const dx = -(1 - enter) * L.W * 0.18 + exit * L.W * 0.18;
        ctx.translate(dx, 0);
        opacity = Math.min(enter, 1 - exit);
        break;
      }
      case 'zoom': {
        const s = (0.86 + 0.14 * enter) * (1 + 0.1 * exit);
        ctx.translate(L.W / 2, L.H / 2);
        ctx.scale(s, s);
        ctx.translate(-L.W / 2, -L.H / 2);
        opacity = Math.min(enter, 1 - exit);
        break;
      }
      case 'wipe':
        break;
    }
    ctx.globalAlpha = opacity;
    if (opacity > 0.001) {
      if (scene.image?.layer === 'back') drawSceneImage(ctx, scene, theme, L, local, scene.durationFrames);
      drawScene({ ctx, scene, theme, frame: local, layout: L, font: fs, digits: style.digits });
      if (scene.image && scene.image.layer !== 'back') drawSceneImage(ctx, scene, theme, L, local, scene.durationFrames);
    }
    ctx.restore();
    if (style.transition === 'wipe') {
      // Accent panel sweeps across at each cut: covers on exit, uncovers on enter.
      const cover = exit > 0 ? exit : 1 - enter;
      if (cover > 0.001) {
        const w = L.W * cover;
        const x = exit > 0 ? 0 : L.W - w;
        const g = ctx.createLinearGradient(x, 0, x + w, 0);
        g.addColorStop(0, theme.accent2);
        g.addColorStop(1, theme.accent);
        ctx.fillStyle = g;
        ctx.fillRect(x, 0, w, L.H);
      }
    }
  }

  // Overall progress bar (fills right→left). No logo or site mark is drawn on the video.
  const p = Math.min(1, (frameIndex + 1) / project.durationFrames);
  ctx.globalAlpha = 1;
  ctx.fillStyle = alpha(theme.foreground, 0.08);
  ctx.fillRect(0, L.H - 6, L.W, 6);
  ctx.fillStyle = theme.accent;
  ctx.fillRect(L.W * (1 - p), L.H - 6, L.W * p, 6);
}
