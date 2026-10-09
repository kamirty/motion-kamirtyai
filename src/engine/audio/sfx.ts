import type { Project } from '../../domain/types';
import { hash01 } from '../renderer/animation';
import { HEADER, HERO, OUTRO, QUOTE, STAT, itemReveal, shownItems } from '../timing';

/**
 * Automatic sound effects cued from the same reveal timings the renderer animates with,
 * synthesised in the browser (no samples, no downloads, no rights to clear).
 */

export type CueKind = 'whoosh' | 'pop' | 'tick' | 'ding' | 'rise';

export interface Cue {
  /** Absolute frame in the 3600-frame timeline. */
  frame: number;
  kind: CueKind;
  /** Position in a sequence (raises the pitch of successive pops). */
  step: number;
}

/** Inverse of easeOutCubic: progress t at which the eased value reaches v. */
const easeOutCubicInverse = (v: number) => 1 - Math.cbrt(1 - v);
const COUNTER_TICKS = 12;

export function planCues(project: Project): Cue[] {
  const cues: Cue[] = [];
  project.scenes.forEach((scene, si) => {
    const s0 = scene.startFrame;
    // Cues landing in the exit transition would play over the next scene's whoosh; drop them.
    const add = (local: number, kind: CueKind, step = 0) => {
      if (local >= 0 && local < scene.durationFrames - 10) cues.push({ frame: s0 + local, kind, step });
    };
    // The whoosh starts just before the cut so its peak lands on it.
    if (si > 0) cues.push({ frame: Math.max(0, s0 - 8), kind: 'whoosh', step: 0 });

    switch (scene.kind) {
      case 'hero':
        add(HERO.icon + 2, 'rise');
        add(HERO.title, 'pop', 2);
        break;
      case 'stat':
        add(HEADER.title, 'tick');
        for (let k = 1; k < COUNTER_TICKS; k++) {
          add(Math.round(STAT.countStart + easeOutCubicInverse(k / COUNTER_TICKS) * STAT.countLength), 'tick', k);
        }
        add(STAT.countStart + STAT.countLength, 'ding');
        break;
      case 'steps':
      case 'summary':
      case 'timeline':
      case 'comparison': {
        add(HEADER.title, 'tick');
        const n = shownItems(scene).length;
        for (let i = 0; i < n; i++) add(itemReveal(scene, i, n), 'pop', i);
        break;
      }
      case 'quote':
        add(QUOTE.line(0), 'rise');
        break;
      case 'outro':
        add(OUTRO.icon + 2, 'ding');
        add(OUTRO.title, 'rise');
        break;
    }
  });
  return cues.sort((a, b) => a.frame - b.frame || a.kind.localeCompare(b.kind));
}

/** Major-pentatonic steps so successive pops form a pleasant rising phrase. */
const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16];

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const len = ctx.sampleRate;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = hash01(i, 97) * 2 - 1;
  return buf;
}

function schedule(ctx: BaseAudioContext, out: AudioNode, noise: AudioBuffer, cue: Cue, t: number): void {
  const env = (g: GainNode, peak: number, attack: number, decay: number) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  };
  switch (cue.kind) {
    case 'whoosh': {
      // Band-passed noise sweeping up, panned right→left to follow the RTL slide.
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 0.9;
      bp.frequency.setValueAtTime(350, t);
      bp.frequency.exponentialRampToValueAtTime(3200, t + 0.38);
      const pan = ctx.createStereoPanner();
      pan.pan.setValueAtTime(0.6, t);
      pan.pan.linearRampToValueAtTime(-0.6, t + 0.4);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.28, t + 0.2);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      src.connect(bp).connect(pan).connect(g).connect(out);
      src.start(t);
      src.stop(t + 0.5);
      break;
    }
    case 'pop': {
      const f = 587.33 * Math.pow(2, PENTATONIC[cue.step % PENTATONIC.length] / 12);
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f * 1.5, t);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
      const g = ctx.createGain();
      env(g, 0.22, 0.006, 0.16);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.2);
      // Soft transient click.
      const n = ctx.createBufferSource();
      n.buffer = noise;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 2500;
      const ng = ctx.createGain();
      env(ng, 0.05, 0.002, 0.02);
      n.connect(hp).connect(ng).connect(out);
      n.start(t, (cue.step * 0.05) % 0.9);
      n.stop(t + 0.03);
      break;
    }
    case 'tick': {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = 1700 + (cue.step % 4) * 60;
      const g = ctx.createGain();
      env(g, 0.07, 0.002, 0.035);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.05);
      break;
    }
    case 'ding': {
      for (const [f, v] of [[1046.5, 0.13], [1568, 0.07], [2093, 0.04]] as const) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f;
        const g = ctx.createGain();
        env(g, v, 0.004, 1.2);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + 1.3);
      }
      break;
    }
    case 'rise': {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(330, t);
      o.frequency.exponentialRampToValueAtTime(990, t + 0.45);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.1, t + 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.65);
      break;
    }
  }
}

/**
 * Mixes the background track (music or the visitor's file, may be null) with sound effects into
 * one 120 s stereo buffer for preview and export.
 */
export async function renderSoundtrack(
  project: Project,
  background: AudioBuffer | null,
  opts: { sfx: boolean; seconds?: number; sampleRate?: number },
): Promise<AudioBuffer | null> {
  if (!opts.sfx) return background;
  if (typeof OfflineAudioContext === 'undefined') return background;
  const seconds = opts.seconds ?? project.durationFrames / project.fps;
  const sampleRate = opts.sampleRate ?? 48000;
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  const master = ctx.createDynamicsCompressor();
  master.threshold.value = -10;
  master.connect(ctx.destination);
  if (background) {
    const src = ctx.createBufferSource();
    src.buffer = background;
    const g = ctx.createGain();
    g.gain.value = 0.85;
    src.connect(g).connect(master);
    src.start(0);
  }
  const sfxBus = ctx.createGain();
  sfxBus.gain.value = 0.9;
  sfxBus.connect(master);
  const noise = noiseBuffer(ctx);
  for (const cue of planCues(project)) schedule(ctx, sfxBus, noise, cue, cue.frame / project.fps);
  return ctx.startRendering();
}

/** Stable identity of the cue list, for caching rendered soundtracks. */
export const cuesKey = (project: Project): string => planCues(project).map((c) => `${c.frame}${c.kind[0]}${c.step}`).join(',');
