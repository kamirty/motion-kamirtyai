import type { Scene, Theme } from '../../domain/types';
import { easeOutCubic, progress } from './animation';
import { font, type Ctx2D } from './context';
import { drawIcon } from './icons';
import { formatStatValue, parseStatValue } from './numbers';
import { drawLines, fitText } from './textLayout';

/** All scene drawers work in a fixed 1280×720 design space; renderFrame scales to the output size. */
export const DESIGN_W = 1280;
export const DESIGN_H = 720;
const MARGIN = 96;

export interface SceneDrawArgs {
  ctx: Ctx2D;
  scene: Scene;
  theme: Theme;
  /** Frame index relative to the scene start. */
  frame: number;
}

export type SceneDrawer = (args: SceneDrawArgs) => void;

function drawHero({ ctx, scene, theme, frame }: SceneDrawArgs): void {
  // Slowly pulsing rings behind the icon.
  for (let i = 0; i < 3; i++) {
    const phase = ((frame + i * 40) % 120) / 120;
    ctx.save();
    ctx.globalAlpha *= (1 - phase) * 0.35;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(DESIGN_W / 2, 210, 60 + phase * 110, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  const iconIn = easeOutCubic(progress(frame, 0, 30));
  drawIcon(ctx, scene.icon, DESIGN_W / 2, 210, 90 * iconIn, theme.accent);

  const titleIn = easeOutCubic(progress(frame, 15, 30));
  ctx.save();
  ctx.globalAlpha *= titleIn;
  ctx.fillStyle = theme.foreground;
  ctx.textAlign = 'center';
  const title = fitText(ctx, scene.title, { maxWidth: DESIGN_W - MARGIN * 2, maxLines: 2, maxSize: 64, minSize: 36, weight: 700 });
  let y = drawLines(ctx, title, DESIGN_W / 2, 390 + (1 - titleIn) * 30, 700);
  ctx.restore();

  scene.items.slice(0, 2).forEach((item, i) => {
    const t = easeOutCubic(progress(frame, 45 + i * 20, 30));
    ctx.save();
    ctx.globalAlpha *= t * (i === 0 ? 0.9 : 0.6);
    ctx.fillStyle = theme.foreground;
    ctx.textAlign = 'center';
    const fitted = fitText(ctx, item, { maxWidth: DESIGN_W - MARGIN * 3, maxLines: 2, maxSize: i === 0 ? 30 : 22, minSize: 18, weight: 400 });
    y = drawLines(ctx, fitted, DESIGN_W / 2, y + 10, 400);
    ctx.restore();
  });
}

function drawStat({ ctx, scene, theme, frame }: SceneDrawArgs): void {
  ctx.fillStyle = theme.foreground;
  ctx.textAlign = 'right';
  const titleIn = easeOutCubic(progress(frame, 0, 30));
  ctx.save();
  ctx.globalAlpha *= titleIn;
  const title = fitText(ctx, scene.title, { maxWidth: DESIGN_W - MARGIN * 2 - 120, maxLines: 2, maxSize: 44, minSize: 28, weight: 700 });
  drawLines(ctx, title, DESIGN_W - MARGIN, 150, 700);
  ctx.restore();
  drawIcon(ctx, scene.icon, MARGIN + 40, 130, 70 * titleIn, theme.accent);

  const raw = scene.items[0] ?? '';
  const stat = parseStatValue(raw);
  const countT = easeOutCubic(progress(frame, 20, 90));
  const display = stat ? formatStatValue(stat, stat.value * countT) : raw;

  // Big counter on the right, ring gauge on the left (percentages only).
  ctx.save();
  ctx.fillStyle = theme.accent;
  ctx.font = font(700, 150);
  ctx.textAlign = 'right';
  ctx.fillText(display, DESIGN_W - MARGIN, 430);
  ctx.restore();

  const isPercent = !!stat && /[%٪]/.test(stat.suffix) && stat.value <= 100;
  if (isPercent && stat) {
    const cx = MARGIN + 170;
    const cy = 400;
    const r = 130;
    ctx.save();
    ctx.lineWidth = 26;
    ctx.lineCap = 'round';
    ctx.strokeStyle = theme.foreground;
    ctx.globalAlpha *= 0.12;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.lineWidth = 26;
    ctx.lineCap = 'round';
    ctx.strokeStyle = theme.accent;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * stat.value * countT) / 100);
    ctx.stroke();
    ctx.restore();
  }

  const note = scene.items[1];
  if (note) {
    ctx.save();
    ctx.globalAlpha *= easeOutCubic(progress(frame, 110, 30)) * 0.85;
    ctx.fillStyle = theme.foreground;
    ctx.textAlign = 'right';
    const fitted = fitText(ctx, note, { maxWidth: isPercent ? 700 : DESIGN_W - MARGIN * 2, maxLines: 3, maxSize: 28, minSize: 20, weight: 400 });
    drawLines(ctx, fitted, DESIGN_W - MARGIN, 520, 400);
    ctx.restore();
  }
}

function drawSteps({ ctx, scene, theme, frame }: SceneDrawArgs): void {
  ctx.save();
  ctx.fillStyle = theme.foreground;
  ctx.textAlign = 'right';
  ctx.globalAlpha *= easeOutCubic(progress(frame, 0, 30));
  const title = fitText(ctx, scene.title, { maxWidth: DESIGN_W - MARGIN * 2, maxLines: 1, maxSize: 44, minSize: 28, weight: 700 });
  drawLines(ctx, title, DESIGN_W - MARGIN, 130, 700);
  ctx.restore();

  const items = scene.items.slice(0, 6);
  const top = 200;
  const rowH = Math.min(95, (DESIGN_H - top - 50) / Math.max(1, items.length));
  // Reveal steps evenly over the first 60% of the scene so the last one stays on screen.
  const revealSpan = Math.max(30, Math.floor((scene.durationFrames * 0.6) / Math.max(1, items.length)));
  const badgeX = DESIGN_W - MARGIN - 30;

  // Connector line growing as steps appear.
  const lineT = progress(frame, 30, revealSpan * items.length);
  ctx.save();
  ctx.strokeStyle = theme.accent;
  ctx.globalAlpha *= 0.4;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(badgeX, top + rowH / 2);
  ctx.lineTo(badgeX, top + rowH / 2 + (items.length - 1) * rowH * lineT);
  ctx.stroke();
  ctx.restore();

  items.forEach((item, i) => {
    const t = easeOutCubic(progress(frame, 30 + i * revealSpan, 25));
    if (t <= 0) return;
    const cy = top + rowH / 2 + i * rowH;
    ctx.save();
    ctx.globalAlpha *= t;
    ctx.fillStyle = theme.accent;
    ctx.beginPath();
    ctx.arc(badgeX, cy, 26 * t, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = theme.background;
    ctx.font = font(700, 26);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1), badgeX, cy + 2);
    ctx.fillStyle = theme.foreground;
    ctx.textAlign = 'right';
    const fitted = fitText(ctx, item, { maxWidth: DESIGN_W - MARGIN * 2 - 90, maxLines: 1, maxSize: 32, minSize: 20, weight: 400 });
    ctx.font = font(400, fitted.fontSize);
    ctx.fillText(fitted.lines[0] ?? '', badgeX - 60 - (1 - t) * 40, cy);
    ctx.restore();
  });
}

/** A scene kind without a dedicated drawer yet falls back to the hero layout. */
export const SCENE_DRAWERS: Partial<Record<Scene['kind'], SceneDrawer>> = {
  hero: drawHero,
  stat: drawStat,
  steps: drawSteps,
};

export const drawScene: SceneDrawer = (args) => (SCENE_DRAWERS[args.scene.kind] ?? drawHero)(args);
