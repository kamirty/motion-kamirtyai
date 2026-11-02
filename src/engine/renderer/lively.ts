import { alpha } from '../../design/presets';
import type { Theme } from '../../domain/types';
import { easeInOutCubic, hash01, progress } from './animation';
import type { Ctx2D } from './context';
import type { Layout } from './kit';

/**
 * Lively motion (style.lively), so videos made with the same scene kinds still feel different
 * from scene to scene: a slow camera move that changes with each scene, and soft light orbs
 * drifting behind the content. Pure functions of the scene index and frame.
 */

/** Camera moves, one per scene in rotation: push in, pull out, drift left, drift right. */
export function cameraMove(ctx: Ctx2D, L: Layout, index: number, local: number, duration: number): void {
  const p = easeInOutCubic(progress(local, 0, Math.max(1, duration)));
  const cx = L.W / 2;
  const cy = L.H / 2;
  let k = 1;
  let dx = 0;
  let dy = 0;
  switch (index % 4) {
    case 0: k = 1 + 0.035 * p; break;
    case 1: k = 1.035 - 0.035 * p; break;
    case 2: k = 1.02; dx = (0.5 - p) * 18; break;
    case 3: k = 1.02; dx = (p - 0.5) * 18; dy = (0.5 - p) * 6; break;
  }
  ctx.translate(cx + dx, cy + dy);
  ctx.scale(k, k);
  ctx.translate(-cx, -cy);
}

/**
 * Three soft light orbs drifting slowly behind the scene, placed differently in every scene.
 * Drawn through a Path2D so the visual looks (outline/shadow) leave them alone.
 */
export function drawOrbs(ctx: Ctx2D, L: Layout, theme: Required<Theme>, index: number, local: number): void {
  if (typeof Path2D === 'undefined') return;
  const fade = progress(local, 0, 20);
  for (let k = 0; k < 3; k++) {
    const r = Math.min(L.W, L.H) * (0.22 + 0.12 * hash01(index * 3 + k, 41));
    const x = L.W * (0.1 + 0.8 * hash01(index * 3 + k, 43)) + Math.sin(local / (70 + k * 23) + k) * 40;
    const y = L.H * (0.15 + 0.7 * hash01(index * 3 + k, 47)) + Math.cos(local / (90 + k * 17) + k) * 30;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const c = k % 2 ? theme.accent2 : theme.accent;
    g.addColorStop(0, alpha(c, 0.12 * fade));
    g.addColorStop(1, alpha(c, 0));
    ctx.fillStyle = g;
    const path = new Path2D();
    path.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill(path);
  }
}

/** Gentle float of a revealed element (a few design pixels), offset by its position. */
export const floatY = (frame: number, cx: number, cy: number): number => Math.sin((frame + cx * 0.37 + cy * 0.21) / 26) * 2.4;

/** Header styles a lively video rotates through. */
export type HeaderStyle = 'classic' | 'kinetic' | 'band' | 'center';
const HEADER_ROTATION: HeaderStyle[] = ['classic', 'kinetic', 'band', 'center'];
export const headerStyleOf = (lively: boolean | undefined, index: number | undefined): HeaderStyle =>
  lively && index !== undefined ? HEADER_ROTATION[index % HEADER_ROTATION.length] : 'classic';

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const LATIN = /[A-Za-z]/;

/**
 * Splits a line into word tokens for word-by-word animation, in logical (reading) order. Arabic
 * words are never broken (letters keep their joined forms); consecutive Latin words stay one
 * token so a phrase like "Kamirty Motion" keeps its left-to-right order inside the RTL line.
 */
export function wordTokens(line: string): string[] {
  const words = line.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (const w of words) {
    const prev = out[out.length - 1];
    const latin = !ARABIC.test(w) && LATIN.test(w);
    if (prev !== undefined && latin && !ARABIC.test(prev) && LATIN.test(prev)) out[out.length - 1] = `${prev} ${w}`;
    else out.push(w);
  }
  return out;
}
