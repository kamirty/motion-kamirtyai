import { styleOf, type Project } from '../../domain/types';
import { hash01 } from '../renderer/animation';
import { CAPSULE, CHAPTER, DEFINITION, HEADER, HERO, KPIS, OUTRO, PICTOGRAM, QUIZ_COUNTDOWN, QUOTE, STAT, TIP, imageEnterAt, imageExitAt, itemReveal, quizCountdown, shownItems, TRUEFALSE, WARNING, trueFalseCountdown, BEFORE_AFTER, beforeAfterAt } from '../timing';
import { trueFalseParts, quizParts } from '../sceneModel';

/**
 * Automatic sound effects cued from the same reveal timings the renderer animates with,
 * synthesised in the browser (no samples, no downloads, no rights to clear).
 */

export type CueKind =
  | 'whoosh' | 'pop' | 'tick' | 'ding' | 'rise'
  /** Elements leaving at the end of a scene. */
  | 'exit'
  /** Motion-specific sounds of the newer kinds. */
  | 'clack' | 'cog' | 'pour' | 'thud' | 'rattle' | 'burst' | 'switch' | 'belt' | 'paper';

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
  const pace = styleOf(project).pace;
  project.scenes.forEach((raw, si) => {
    const scene = { ...raw, pace };
    const s0 = scene.startFrame;
    // Cues landing in the exit transition would play over the next scene's whoosh; drop them.
    const add = (local: number, kind: CueKind, step = 0) => {
      if (local >= 0 && local < scene.durationFrames - 10) cues.push({ frame: s0 + local, kind, step });
    };
    // The whoosh starts just before the cut so its peak lands on it.
    if (si > 0) cues.push({ frame: Math.max(0, s0 - 8), kind: 'whoosh', step: 0 });
    // The scene's elements leave with a soft falling sweep just before the cut (and at the very end).
    const last = si === project.scenes.length - 1;
    if (scene.durationFrames > 40) cues.push({ frame: s0 + scene.durationFrames - (last ? 26 : 18), kind: 'exit', step: 0 });
    (scene.images ?? []).forEach((img, k) => {
      if (img.entrance !== 'none') add(imageEnterAt(img, k, scene.durationFrames), 'pop', 5 + k);
      const exit = imageExitAt(img, k, scene.durationFrames);
      if (exit !== null) add(exit, 'exit', 5 + k);
    });

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
      case 'linechart':
      case 'mindmap':
      case 'venn':
      case 'table':
      case 'gauges':
      case 'flowchart':
      case 'profile':
      case 'magnifier':
      case 'network':
      case 'decision':
      case 'ranking':
      case 'cycle':
      case 'pyramid':
      case 'proscons':
      case 'checklist':
      case 'donut':
      case 'columns': {
        add(HEADER.title, 'tick');
        const n = shownItems(scene).length;
        for (let i = 0; i < n; i++) add(itemReveal(scene, i, n), 'pop', scene.kind === 'pyramid' ? n - 1 - i : i);
        break;
      }
      case 'spotlight':
      case 'magnet':
      case 'mosaic':
      case 'liquid':
      case 'domino':
      case 'balance':
      case 'gears':
      case 'conveyor':
      case 'folded': {
        // Each motion has its own sound, landing where the drawer shows the action.
        add(HEADER.title, 'tick');
        const n = shownItems(scene).length;
        if (scene.kind === 'mosaic') add(6, 'rise');
        for (let i = 0; i < n; i++) {
          const r = itemReveal(scene, i, n);
          switch (scene.kind) {
            case 'spotlight': add(r, 'switch', i); break;
            case 'magnet': add(r + 22, 'clack', i); break;
            case 'mosaic': add(r, 'pop', i); break;
            case 'liquid': add(r + 8, 'pour', i); break;
            case 'domino': add(r + 10, 'clack', i); break;
            case 'balance': if (i < 2) add(r + 10, 'thud', i); else add(r, 'pop', i); break;
            case 'gears': add(r, 'cog', i); break;
            case 'conveyor': {
              const travel = Math.min(30, Math.max(12, r - (i ? itemReveal(scene, i - 1, n) : 0) - 6));
              add(r - travel, 'belt', i);
              add(r, 'pop', i);
              break;
            }
            case 'folded': add(r, 'paper', i); break;
          }
        }
        break;
      }
      case 'tapsteps': {
        // A click as the pointer taps each card, then its pop.
        add(HEADER.title, 'tick');
        const n = shownItems(scene).length;
        for (let i = 0; i < n; i++) {
          add(itemReveal(scene, i, n), 'switch', i);
          add(itemReveal(scene, i, n) + 6, 'pop', i);
        }
        break;
      }
      case 'capsule':
        add(CAPSULE.drop, 'pop', 1);
        add(CAPSULE.shake, 'rattle');
        add(CAPSULE.open, 'burst');
        if (shownItems(scene).length) add(CAPSULE.fact, 'ding');
        if (shownItems(scene).length > 1) add(CAPSULE.note, 'tick', 2);
        break;
      case 'kpis': {
        add(HEADER.title, 'tick');
        const n = shownItems(scene).length;
        for (let i = 0; i < n; i++) add(itemReveal(scene, i, n), 'pop', i);
        if (n) add(itemReveal(scene, n - 1, n) + KPIS.countLength, 'ding');
        break;
      }
      case 'pictogram':
        add(HEADER.title, 'tick');
        for (let k = 0; k < 10; k++) add(PICTOGRAM.fillStart + Math.round((k * PICTOGRAM.fillLength) / 10), 'tick', k);
        add(PICTOGRAM.fillStart + PICTOGRAM.fillLength, 'ding');
        break;
      case 'quiz': {
        add(HEADER.title, 'tick');
        const { options, answer } = quizParts(scene);
        options.forEach((_, i) => add(itemReveal(scene, i, options.length), 'pop', i));
        if (answer >= 0) {
          const c = quizCountdown(scene);
          for (let k = 0; k < 3; k++) add(c + k * 30, 'tick', 3 - k);
          add(c + QUIZ_COUNTDOWN, 'ding');
        }
        break;
      }
      case 'definition': {
        add(DEFINITION.term, 'pop', 0);
        const n = shownItems(scene).length;
        for (let i = 0; i < n; i++) add(itemReveal(scene, i, n), i === 0 ? 'pop' : 'tick', i + 2);
        break;
      }
      case 'chapter':
        add(CHAPTER.mark + 2, 'rise');
        add(CHAPTER.title, 'pop', 4);
        break;
      case 'truefalse': {
        add(TRUEFALSE.statement, 'pop', 0);
        add(TRUEFALSE.choices, 'pop', 1);
        add(TRUEFALSE.choices + 10, 'pop', 2);
        if (trueFalseParts(scene).answer !== null) {
          const c = trueFalseCountdown(scene);
          for (let k = 0; k < 3; k++) add(c + k * 30, 'tick', 3 - k);
          add(c + QUIZ_COUNTDOWN, 'ding');
        }
        break;
      }
      case 'beforeafter':
        add(HEADER.title, 'tick');
        add(BEFORE_AFTER.before, 'pop', 0);
        add(beforeAfterAt(scene), 'whoosh');
        break;
      case 'warning':
        add(WARNING.badge, 'rise');
        add(WARNING.title, 'pop', 2);
        add(WARNING.text, 'tick', 3);
        break;
      case 'tip':
        add(TIP.badge, 'rise');
        add(TIP.text, 'pop', 3);
        break;
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
      g.gain.exponentialRampToValueAtTime(1.1, t + 0.2);
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
      env(g, 0.11, 0.002, 0.04);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.05);
      break;
    }
    case 'ding': {
      for (const [f, v] of [[1046.5, 0.2], [1568, 0.1], [2093, 0.05]] as const) {
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
      g.gain.exponentialRampToValueAtTime(0.17, t + 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.65);
      break;
    }
    case 'exit': {
      // Soft falling sweep, panned left (where RTL content leaves to).
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(880, t);
      o.frequency.exponentialRampToValueAtTime(260, t + 0.32);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.1, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.36);
      const n = ctx.createBufferSource();
      n.buffer = noise;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(2400, t);
      lp.frequency.exponentialRampToValueAtTime(300, t + 0.3);
      const ng = ctx.createGain();
      env(ng, 0.16, 0.03, 0.28);
      const pan = ctx.createStereoPanner();
      pan.pan.setValueAtTime(0, t);
      pan.pan.linearRampToValueAtTime(-0.7, t + 0.35);
      o.connect(g).connect(pan);
      n.connect(lp).connect(ng).connect(pan);
      pan.connect(out);
      o.start(t);
      o.stop(t + 0.4);
      n.start(t, 0.3);
      n.stop(t + 0.4);
      break;
    }
    case 'clack': {
      // Wooden knock: a short resonant noise burst over a low thump.
      const n = ctx.createBufferSource();
      n.buffer = noise;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1500 + (cue.step % 4) * 120;
      bp.Q.value = 6;
      const g = ctx.createGain();
      env(g, 0.5, 0.002, 0.06);
      n.connect(bp).connect(g).connect(out);
      n.start(t, (cue.step * 0.07) % 0.9);
      n.stop(t + 0.08);
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(220, t);
      o.frequency.exponentialRampToValueAtTime(110, t + 0.06);
      const og = ctx.createGain();
      env(og, 0.14, 0.002, 0.07);
      o.connect(og).connect(out);
      o.start(t);
      o.stop(t + 0.1);
      break;
    }
    case 'cog': {
      // A gear catching: three quick metallic ticks.
      for (let k = 0; k < 3; k++) {
        const tt = t + k * 0.07;
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.value = 2600 - k * 200;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 1800;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, tt);
        g.gain.exponentialRampToValueAtTime(0.05, tt + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.03);
        o.connect(hp).connect(g).connect(out);
        o.start(tt);
        o.stop(tt + 0.04);
      }
      break;
    }
    case 'pour': {
      // Liquid: filtered noise rising like a filling glass, then a few bubbles.
      const n = ctx.createBufferSource();
      n.buffer = noise;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 2;
      bp.frequency.setValueAtTime(500, t);
      bp.frequency.exponentialRampToValueAtTime(1600, t + 1.1);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.15);
      g.gain.setValueAtTime(0.12, t + 0.9);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
      n.connect(bp).connect(g).connect(out);
      n.start(t, 0.1);
      n.stop(t + 1.25);
      for (let k = 0; k < 4; k++) {
        const tt = t + 0.2 + k * 0.22 + hash01(k, cue.step) * 0.08;
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(350 + hash01(k, cue.step + 3) * 250, tt);
        o.frequency.exponentialRampToValueAtTime(1100, tt + 0.06);
        const og = ctx.createGain();
        og.gain.setValueAtTime(0.0001, tt);
        og.gain.exponentialRampToValueAtTime(0.07, tt + 0.01);
        og.gain.exponentialRampToValueAtTime(0.0001, tt + 0.07);
        o.connect(og).connect(out);
        o.start(tt);
        o.stop(tt + 0.08);
      }
      break;
    }
    case 'thud': {
      // A weight landing: low body plus a dull knock.
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(55, t + 0.18);
      const g = ctx.createGain();
      env(g, 0.22, 0.004, 0.22);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.26);
      const n = ctx.createBufferSource();
      n.buffer = noise;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 700;
      const ng = ctx.createGain();
      env(ng, 0.2, 0.002, 0.08);
      n.connect(lp).connect(ng).connect(out);
      n.start(t, 0.5);
      n.stop(t + 0.1);
      break;
    }
    case 'rattle': {
      // Capsule shaking: a quickening series of small knocks over ~0.8 s.
      for (let k = 0; k < 9; k++) {
        const tt = t + 0.85 * (1 - Math.pow(1 - k / 9, 1.4));
        const n = ctx.createBufferSource();
        n.buffer = noise;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 2200 + (k % 3) * 400;
        bp.Q.value = 4;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, tt);
        g.gain.exponentialRampToValueAtTime(0.2 + k * 0.03, tt + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.035);
        n.connect(bp).connect(g).connect(out);
        n.start(tt, (k * 0.09) % 0.9);
        n.stop(tt + 0.04);
      }
      break;
    }
    case 'burst': {
      // Capsule snapping open: a bright pop with an airy spray.
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(1400, t);
      o.frequency.exponentialRampToValueAtTime(400, t + 0.08);
      const g = ctx.createGain();
      env(g, 0.25, 0.002, 0.1);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.14);
      const n = ctx.createBufferSource();
      n.buffer = noise;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 3000;
      const ng = ctx.createGain();
      env(ng, 0.18, 0.005, 0.5);
      n.connect(hp).connect(ng).connect(out);
      n.start(t, 0.2);
      n.stop(t + 0.55);
      break;
    }
    case 'switch': {
      // A light switching on: a crisp click and a short warm hum.
      const n = ctx.createBufferSource();
      n.buffer = noise;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 4000;
      const ng = ctx.createGain();
      env(ng, 0.18, 0.001, 0.015);
      n.connect(hp).connect(ng).connect(out);
      n.start(t, (cue.step * 0.11) % 0.9);
      n.stop(t + 0.02);
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = 196 * Math.pow(2, PENTATONIC[cue.step % PENTATONIC.length] / 12);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.06, t + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.55);
      break;
    }
    case 'belt': {
      // Conveyor motor: a low buzzing hum for the length of the ride.
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 85;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 420;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.07, t + 0.1);
      g.gain.setValueAtTime(0.07, t + 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(lp).connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.95);
      break;
    }
    case 'paper': {
      // A panel unfolding: a short papery rustle.
      const n = ctx.createBufferSource();
      n.buffer = noise;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 0.7;
      bp.frequency.setValueAtTime(5000, t);
      bp.frequency.exponentialRampToValueAtTime(2200, t + 0.25);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      n.connect(bp).connect(g).connect(out);
      n.start(t, (cue.step * 0.13) % 0.9);
      n.stop(t + 0.32);
      break;
    }
  }
}

/** A scene's recorded narration placed on the timeline (seconds). */
export interface VoiceClip {
  assetId: string;
  start: number;
  /** Seconds played: the recording, cut at the scene's end. */
  length: number;
  /** True when the recording is longer than its scene (it fades out at the cut). */
  cut: boolean;
}

/** Fade applied where a recording is cut at its scene's end. */
export const VOICE_CUT_FADE = 0.15;

/** Where each scene's narration plays: from the scene's first frame, never past its last. */
export function voiceClips(project: Project): VoiceClip[] {
  return project.scenes.flatMap((s) => {
    if (!s.voice) return [];
    const frames = Math.min(s.voice.durationFrames, s.durationFrames);
    return [{ assetId: s.voice.assetId, start: s.startFrame / project.fps, length: frames / project.fps, cut: s.voice.durationFrames > s.durationFrames }];
  });
}

/** Time windows (seconds) where narration plays, merged when they touch, for ducking music. */
export function voiceWindows(clips: VoiceClip[]): [number, number][] {
  const out: [number, number][] = [];
  for (const c of [...clips].sort((a, b) => a.start - b.start)) {
    const last = out[out.length - 1];
    // Gaps shorter than the duck release + attack (0.75 s) stay ducked instead of pumping.
    if (last && c.start <= last[1] + 0.8) last[1] = Math.max(last[1], c.start + c.length);
    else out.push([c.start, c.start + c.length]);
  }
  return out;
}

/**
 * Mixes the background track (music or the visitor's file, may be null) with sound effects,
 * the narration file and the scenes' recorded narrations into one stereo buffer for preview
 * and export.
 */
export async function renderSoundtrack(
  project: Project,
  background: AudioBuffer | null,
  opts: {
    sfx: boolean;
    voice?: AudioBuffer | null;
    /** Decoded scene recordings by asset id; clips whose audio is missing are skipped. */
    sceneVoices?: (assetId: string) => AudioBuffer | undefined;
    seconds?: number;
    sampleRate?: number;
  },
): Promise<AudioBuffer | null> {
  const voice = opts.voice ?? null;
  const clips = opts.sceneVoices ? voiceClips(project).filter((c) => opts.sceneVoices!(c.assetId)) : [];
  if (!opts.sfx && !voice && !clips.length) return background;
  if (typeof OfflineAudioContext === 'undefined') return background;
  const seconds = opts.seconds ?? project.durationFrames / project.fps;
  const sampleRate = opts.sampleRate ?? 48000;
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  const master = ctx.createDynamicsCompressor();
  master.threshold.value = -10;
  master.connect(ctx.destination);
  const cues = opts.sfx ? planCues(project) : [];
  if (voice) {
    const v = ctx.createBufferSource();
    v.buffer = voice;
    const vg = ctx.createGain();
    vg.gain.value = 1.15;
    v.connect(vg).connect(master);
    v.start(0);
  }
  for (const c of clips) {
    const v = ctx.createBufferSource();
    v.buffer = opts.sceneVoices!(c.assetId)!;
    const vg = ctx.createGain();
    vg.gain.setValueAtTime(1.15, c.start);
    if (c.cut) {
      vg.gain.setValueAtTime(1.15, Math.max(c.start, c.start + c.length - VOICE_CUT_FADE));
      vg.gain.linearRampToValueAtTime(0, c.start + c.length);
    }
    v.connect(vg).connect(master);
    v.start(c.start, 0, c.length);
  }
  if (background) {
    const src = ctx.createBufferSource();
    src.buffer = background;
    const g = ctx.createGain();
    // Duck the bed briefly under each effect so effects read clearly over music or narration.
    // A narration needs the music well under it.
    const BED = voice ? 0.32 : 0.75;
    const DUCK = voice ? 0.2 : 0.42;
    g.gain.setValueAtTime(BED, 0);
    // Merge overlapping duck windows (dense counter ticks) so the bed never pumps between them.
    const RELEASE = 0.2;
    const windows: [number, number][] = [];
    for (const cue of cues) {
      const t = cue.frame / project.fps;
      const hold = cue.kind === 'ding' || cue.kind === 'whoosh' ? 0.45 : 0.18;
      const last = windows[windows.length - 1];
      if (last && t - 0.03 <= last[1] + RELEASE) last[1] = Math.max(last[1], t + hold);
      else windows.push([t - 0.03, t + hold]);
    }
    for (const [a, b] of windows) {
      g.gain.setValueAtTime(BED, Math.max(0, a));
      g.gain.linearRampToValueAtTime(DUCK, a + 0.03);
      g.gain.setValueAtTime(DUCK, b);
      g.gain.linearRampToValueAtTime(BED, b + RELEASE);
    }
    // Scene narrations: the bed dips under each recording and comes back between them.
    const duck = ctx.createGain();
    if (!voice) {
      for (const [a, b] of voiceWindows(clips)) {
        duck.gain.setValueAtTime(1, Math.max(0, a - 0.25));
        duck.gain.linearRampToValueAtTime(0.42, a);
        duck.gain.setValueAtTime(0.42, b);
        duck.gain.linearRampToValueAtTime(1, b + 0.5);
      }
    }
    src.connect(g).connect(duck).connect(master);
    src.start(0);
  }
  const sfxBus = ctx.createGain();
  sfxBus.gain.value = 1.5;
  sfxBus.connect(master);
  const noise = noiseBuffer(ctx);
  for (const cue of cues) schedule(ctx, sfxBus, noise, cue, cue.frame / project.fps);
  return ctx.startRendering();
}

/** Stable identity of the cue list, for caching rendered soundtracks. */
export const cuesKey = (project: Project): string => planCues(project).map((c) => `${c.frame}${c.kind}${c.step}`).join(',');
