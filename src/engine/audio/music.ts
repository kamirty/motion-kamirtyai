import type { MusicId } from '../../domain/types';
import { hash01 } from '../renderer/animation';

/**
 * Royalty-free background music synthesised in the browser with an OfflineAudioContext.
 * Fully deterministic: the same style always renders the same track, and nothing is downloaded.
 */

interface Recipe {
  bpm: number;
  /** Chord roots (MIDI) with quality, one chord per bar of 4 beats. */
  chords: [number, 'maj' | 'min'][];
  pad: OscillatorType;
  arp: boolean;
  kick: boolean;
  padGain: number;
  cutoff: number;
}

const RECIPES: Record<Exclude<MusicId, 'none'>, Recipe> = {
  // Am – F – C – G, slow and airy.
  calm: { bpm: 72, chords: [[57, 'min'], [53, 'maj'], [48, 'maj'], [55, 'maj']], pad: 'triangle', arp: true, kick: false, padGain: 0.09, cutoff: 1400 },
  // C – G – Am – F, light and positive.
  bright: { bpm: 104, chords: [[48, 'maj'], [55, 'maj'], [57, 'min'], [53, 'maj']], pad: 'triangle', arp: true, kick: true, padGain: 0.07, cutoff: 2600 },
  // Dm – Bb – F – C, wide and cinematic.
  epic: { bpm: 84, chords: [[50, 'min'], [46, 'maj'], [53, 'maj'], [48, 'maj']], pad: 'sawtooth', arp: false, kick: true, padGain: 0.05, cutoff: 1100 },
};

export const MUSIC_OPTIONS: { id: MusicId; label: string }[] = [
  { id: 'calm', label: 'هادئة' },
  { id: 'bright', label: 'مبهجة' },
  { id: 'epic', label: 'حماسية' },
  { id: 'none', label: 'بدون موسيقى' },
];

const freq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
const triad = (root: number, q: 'maj' | 'min') => [root, root + (q === 'maj' ? 4 : 3), root + 7];

/** Short synthetic room reverb built from deterministic noise. */
function impulse(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) data[i] = (hash01(i, ch + 11) * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  return buf;
}

export async function renderMusic(id: MusicId, seconds = 120, sampleRate = 48000): Promise<AudioBuffer | null> {
  if (id === 'none' || typeof OfflineAudioContext === 'undefined') return null;
  const r = RECIPES[id];
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);

  const master = ctx.createGain();
  master.gain.setValueAtTime(0, 0);
  master.gain.linearRampToValueAtTime(0.8, 2.5);
  master.gain.setValueAtTime(0.8, seconds - 4);
  master.gain.linearRampToValueAtTime(0, seconds - 0.05);
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp).connect(ctx.destination);

  const reverb = ctx.createConvolver();
  reverb.buffer = impulse(ctx, 2.8);
  const wet = ctx.createGain();
  wet.gain.value = 0.35;
  reverb.connect(wet).connect(master);

  const bus = ctx.createGain();
  bus.connect(master);
  bus.connect(reverb);

  const beat = 60 / r.bpm;
  const bar = beat * 4;
  const bars = Math.ceil(seconds / bar);

  for (let b = 0; b < bars; b++) {
    const t0 = b * bar;
    const [root, q] = r.chords[b % r.chords.length];
    const notes = triad(root, q);

    // Pad: two detuned oscillators per note through a lowpass filter, slow attack/release.
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = r.cutoff;
    padFilter.connect(bus);
    for (const n of notes) {
      for (const detune of [-7, 7]) {
        const o = ctx.createOscillator();
        o.type = r.pad;
        o.frequency.value = freq(n);
        o.detune.value = detune;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(r.padGain, t0 + bar * 0.3);
        g.gain.setValueAtTime(r.padGain, t0 + bar * 0.8);
        g.gain.linearRampToValueAtTime(0, t0 + bar * 1.05);
        o.connect(g).connect(padFilter);
        o.start(t0);
        o.stop(t0 + bar * 1.1);
      }
    }

    // Bass on beats 1 and 3.
    for (const beatN of [0, 2]) {
      const t = t0 + beatN * beat;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq(root - 12);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.22, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + beat * 1.8);
      o.connect(g).connect(bus);
      o.start(t);
      o.stop(t + beat * 2);
    }

    // Arpeggio in eighth notes, an octave up, skipping a note now and then for a human feel.
    if (r.arp) {
      const pattern = [0, 1, 2, 1, 0, 2, 1, 2];
      for (let k = 0; k < 8; k++) {
        if (hash01(b, k) < 0.15) continue;
        const t = t0 + k * (beat / 2);
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = freq(notes[pattern[k]] + 12);
        const g = ctx.createGain();
        const v = 0.05 + hash01(k, b) * 0.025;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(v, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0008, t + beat * 0.9);
        o.connect(g).connect(bus);
        o.start(t);
        o.stop(t + beat);
      }
    }

    // Soft kick on each beat (from the second bar so the intro breathes).
    if (r.kick && b > 0 && b < bars - 1) {
      for (let k = 0; k < 4; k++) {
        const t = t0 + k * beat;
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(110, t);
        o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.3, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        o.connect(g).connect(master);
        o.start(t);
        o.stop(t + 0.3);
      }
    }
  }
  return ctx.startRendering();
}

/**
 * Fits user audio to exactly `seconds`: loops if shorter, trims if longer, with a short fade-out.
 */
export async function fitAudio(source: AudioBuffer, seconds = 120, sampleRate = 48000, loop = true): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  const node = ctx.createBufferSource();
  node.buffer = source;
  node.loop = loop && source.duration < seconds;
  const g = ctx.createGain();
  g.gain.setValueAtTime(1, 0);
  g.gain.setValueAtTime(1, seconds - 3);
  g.gain.linearRampToValueAtTime(0, seconds - 0.05);
  node.connect(g).connect(ctx.destination);
  node.start(0);
  return ctx.startRendering();
}

/** Decodes a user-selected audio file locally (nothing is uploaded). */
export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, 48000, 48000);
  return ctx.decodeAudioData(await file.arrayBuffer());
}
