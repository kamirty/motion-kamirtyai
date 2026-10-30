import { hashBlob, idb } from './assets';

/**
 * Narrations recorded in the browser, one per scene. The recorded file (WebM/Opus or MP4/AAC,
 * whatever MediaRecorder produces) is kept in IndexedDB under its content hash, never uploaded;
 * decoded AudioBuffers are cached in memory for the soundtrack mix.
 */

const buffers = new Map<string, AudioBuffer>();
const blobs = new Map<string, Blob>();

export const getVoiceBuffer = (id: string): AudioBuffer | undefined => buffers.get(id);
export const getVoiceBlob = (id: string): Blob | undefined => blobs.get(id);

async function decode(blob: Blob): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(1, 48000, 48000);
  return ctx.decodeAudioData(await blob.arrayBuffer());
}

/** Stores a recording and returns its asset id with the decoded audio. */
export async function addVoiceBlob(blob: Blob): Promise<{ id: string; buffer: AudioBuffer }> {
  const buffer = await decode(blob);
  const id = await hashBlob(blob);
  buffers.set(id, buffer);
  blobs.set(id, blob);
  await idb('readwrite', (s) => s.put(blob, id));
  return { id, buffer };
}

/** Loads the given recordings from IndexedDB; returns ids that could not be found or decoded. */
export async function loadVoices(ids: string[]): Promise<string[]> {
  const missing: string[] = [];
  await Promise.all(
    [...new Set(ids)].filter((id) => !buffers.has(id)).map(async (id) => {
      const blob = await idb<Blob>('readonly', (s) => s.get(id) as IDBRequest<Blob>);
      try {
        if (!blob) throw new Error('missing');
        buffers.set(id, await decode(blob));
        blobs.set(id, blob);
      } catch {
        missing.push(id);
      }
    }),
  );
  return missing;
}

/** Audio asset ids referenced by a project: scene recordings and the visitor's own music. */
export const projectVoiceIds = (project: { scenes: { voice?: { assetId: string } }[]; style?: { music?: string; musicAsset?: string } }): string[] => [
  ...new Set([
    ...project.scenes.flatMap((s) => (s.voice ? [s.voice.assetId] : [])),
    ...(project.style?.music === 'custom' && project.style.musicAsset ? [project.style.musicAsset] : []),
  ]),
];

/** Whether this browser can record from the microphone (secure context + MediaRecorder). */
export const canRecordVoice = (): boolean =>
  typeof window !== 'undefined' && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';

/** First recording format the browser supports (Chrome/Edge: WebM/Opus; Safari: MP4/AAC). */
export function recorderMime(): string | undefined {
  for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']) {
    if (MediaRecorder.isTypeSupported?.(m)) return m;
  }
  return undefined;
}
