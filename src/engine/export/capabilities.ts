import { getFirstEncodableVideoCodec, type VideoCodec } from 'mediabunny';

export type ContainerKind = 'mp4' | 'webm';

export interface ExportPlan {
  container: ContainerKind;
  codec: VideoCodec;
  mimeType: string;
  extension: string;
}

export type CodecProbe = (codecs: VideoCodec[], size: { width: number; height: number }) => Promise<VideoCodec | null>;

/** Containers in preference order; MP4 only with H.264 for the widest playback compatibility. */
export const CANDIDATES: { container: ContainerKind; codecs: VideoCodec[]; mimeType: string; extension: string }[] = [
  { container: 'mp4', codecs: ['avc'], mimeType: 'video/mp4', extension: 'mp4' },
  { container: 'webm', codecs: ['vp9', 'vp8'], mimeType: 'video/webm', extension: 'webm' },
];

export const hasWebCodecs = (): boolean =>
  typeof globalThis.VideoEncoder === 'function' && typeof globalThis.VideoFrame === 'function';

const defaultProbe: CodecProbe = (codecs, size) => getFirstEncodableVideoCodec(codecs, size);

export type DetectResult =
  | { supported: true; plan: ExportPlan }
  | { supported: false; reason: string };

/** Picks the first container/codec pair this browser can actually encode at `size`. */
export async function detectExportPlan(
  size: { width: number; height: number },
  probe: CodecProbe = defaultProbe,
  webCodecsAvailable: boolean = hasWebCodecs(),
): Promise<DetectResult> {
  if (!webCodecsAvailable) {
    return { supported: false, reason: 'هذا المتصفح لا يدعم WebCodecs. استخدم أحدث إصدار من Chrome أو Edge على الكمبيوتر.' };
  }
  for (const candidate of CANDIDATES) {
    let codec: VideoCodec | null = null;
    try {
      codec = await probe(candidate.codecs, size);
    } catch {
      codec = null;
    }
    if (codec) {
      return {
        supported: true,
        plan: { container: candidate.container, codec, mimeType: candidate.mimeType, extension: candidate.extension },
      };
    }
  }
  return { supported: false, reason: `لا يتوفر في هذا المتصفح ترميز فيديو مدعوم بدقة ${size.width}×${size.height} (H.264 أو VP9 أو VP8).` };
}
