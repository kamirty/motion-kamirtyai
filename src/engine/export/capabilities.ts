import type { AudioCodec, VideoCodec } from 'mediabunny';

export type ContainerKind = 'mp4' | 'webm';

export interface ExportPlan {
  container: ContainerKind;
  codec: VideoCodec;
  /** null when no audio encoder is available; the video is then exported silent. */
  audioCodec: AudioCodec | null;
  mimeType: string;
  extension: string;
  width: number;
  height: number;
}

type Size = { width: number; height: number };
export type CodecProbe = (codecs: VideoCodec[], size: Size) => Promise<VideoCodec | null>;
export type AudioProbe = (codecs: AudioCodec[]) => Promise<AudioCodec | null>;

/** Containers in preference order; MP4 only with H.264 for the widest playback compatibility. */
export const CANDIDATES: { container: ContainerKind; codecs: VideoCodec[]; audio: AudioCodec[]; mimeType: string; extension: string }[] = [
  { container: 'mp4', codecs: ['avc'], audio: ['aac', 'opus'], mimeType: 'video/mp4', extension: 'mp4' },
  { container: 'webm', codecs: ['vp9', 'vp8'], audio: ['opus'], mimeType: 'video/webm', extension: 'webm' },
];

export const hasWebCodecs = (): boolean =>
  typeof globalThis.VideoEncoder === 'function' && typeof globalThis.VideoFrame === 'function';

const defaultProbe: CodecProbe = async (codecs, size) => (await import('mediabunny')).getFirstEncodableVideoCodec(codecs, size);
const defaultAudioProbe: AudioProbe = async (codecs) =>
  typeof globalThis.AudioEncoder === 'function'
    ? (await import('mediabunny')).getFirstEncodableAudioCodec(codecs, { numberOfChannels: 2, sampleRate: 48000 })
    : null;

export type DetectResult =
  | { supported: true; plan: ExportPlan }
  | { supported: false; reason: string };

/** Picks the first container/codec pair this browser can actually encode at `size`. */
export async function detectExportPlan(
  size: Size,
  probe: CodecProbe = defaultProbe,
  webCodecsAvailable: boolean = hasWebCodecs(),
  audioProbe: AudioProbe = defaultAudioProbe,
): Promise<DetectResult> {
  if (!webCodecsAvailable) {
    return { supported: false, reason: 'متصفحك لا يدعم تصدير الفيديو (WebCodecs). استخدم أحدث إصدار من Chrome أو Edge على الكمبيوتر، أو Chrome على أندرويد.' };
  }
  for (const candidate of CANDIDATES) {
    let codec: VideoCodec | null = null;
    try {
      codec = await probe(candidate.codecs, size);
    } catch {
      codec = null;
    }
    if (!codec) continue;
    let audioCodec: AudioCodec | null = null;
    try {
      audioCodec = await audioProbe(candidate.audio);
    } catch {
      audioCodec = null;
    }
    return {
      supported: true,
      plan: { container: candidate.container, codec, audioCodec, mimeType: candidate.mimeType, extension: candidate.extension, ...size },
    };
  }
  return { supported: false, reason: `لا يتوفر في هذا المتصفح ترميز فيديو مدعوم بدقة ${size.width}×${size.height} (H.264 أو VP9 أو VP8). جرّب دقة أقل أو متصفح Chrome/Edge.` };
}
