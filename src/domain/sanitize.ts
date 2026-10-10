import { ASPECTS, DEFAULT_IMAGE, ENTRANCES, DEFAULT_STYLE, FPS, LIMITS, SCENE_KINDS, type Project, type ProjectStyle, type Scene, type SceneImage } from './types';
import { rebalance, validateTimeline, withScenes } from './timeline';

const COLOR = /^#[0-9A-Fa-f]{6}$/;
const ID = /^[A-Za-z0-9_-]{1,40}$/;

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v : '').replace(/[\u0000-\u0008\u000B-\u001F]/g, '').slice(0, max);
const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);

const num = (v: unknown, min: number, max: number, fb: number): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fb;
  return Math.min(max, Math.max(min, n));
};

/** Validates a scene picture; returns undefined for anything malformed. */
export function parseImage(v: unknown): SceneImage | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  if (typeof o.assetId !== 'string' || !/^[0-9a-f]{24}$/.test(o.assetId)) return undefined;
  const d = DEFAULT_IMAGE;
  return {
    assetId: o.assetId,
    x: num(o.x, -0.5, 1.5, d.x),
    y: num(o.y, -0.5, 1.5, d.y),
    scale: num(o.scale, 0.05, 1.5, d.scale),
    rotation: num(o.rotation, -180, 180, d.rotation),
    shape: pick(o.shape, ['rect', 'rounded', 'circle'] as const, d.shape),
    border: typeof o.border === 'boolean' ? o.border : d.border,
    shadow: typeof o.shadow === 'boolean' ? o.shadow : d.shadow,
    opacity: num(o.opacity, 0.1, 1, d.opacity),
    entrance: pick(o.entrance, ['fade', 'zoom', 'slide', 'none'] as const, d.entrance),
    layer: pick(o.layer, ['front', 'back'] as const, d.layer),
  };
}

/**
 * Parses untrusted JSON (imported file or local autosave) into a valid project, or throws with an
 * Arabic message. Unknown fields are dropped, strings clamped, and scene lengths clamped (the video
 * length is the sum of the scenes, at most LIMITS.maxTotalFrames).
 */
export function parseProject(input: unknown): Project {
  if (!input || typeof input !== 'object') throw new Error('الملف ليس مشروعًا صالحًا.');
  const o = input as Record<string, unknown>;
  if (o.version !== 1) throw new Error('إصدار المشروع غير مدعوم.');
  const size = o.size as Record<string, unknown> | undefined;
  const sizes = Object.values(ASPECTS).map((a) => `${a.width}x${a.height}`);
  const sizeKey = `${size?.width}x${size?.height}`;
  const [width, height] = (sizes.includes(sizeKey) ? sizeKey : sizes[0]).split('x').map(Number);

  const theme = (o.theme ?? {}) as Record<string, unknown>;
  const color = (v: unknown, fb: string) => (typeof v === 'string' && COLOR.test(v) ? v : fb);
  const t = {
    background: color(theme.background, '#0A0A0A'),
    foreground: color(theme.foreground, '#FFFFFF'),
    accent: color(theme.accent, '#FFEB3B'),
    accent2: color(theme.accent2, color(theme.accent, '#F2F2F2')),
    surface: color(theme.surface, '#1A1A1A'),
  };

  const rawScenes = Array.isArray(o.scenes) ? o.scenes.slice(0, LIMITS.scenes) : [];
  if (!rawScenes.length) throw new Error('المشروع لا يحتوي على مشاهد.');
  const seen = new Set<string>();
  const scenes: Scene[] = rawScenes.map((r, i) => {
    const s = (r ?? {}) as Record<string, unknown>;
    let id = typeof s.id === 'string' && ID.test(s.id) ? s.id : `s${i + 1}`;
    while (seen.has(id)) id = `${id}_`.slice(-40);
    seen.add(id);
    const d = Number(s.durationFrames);
    return {
      id,
      kind: pick(s.kind, SCENE_KINDS, 'summary'),
      startFrame: 0,
      durationFrames: Number.isFinite(d) ? Math.min(LIMITS.maxSceneFrames, Math.max(LIMITS.minSceneFrames, Math.round(d))) : LIMITS.minSceneFrames,
      title: str(s.title, LIMITS.titleChars),
      items: (Array.isArray(s.items) ? s.items : []).slice(0, LIMITS.items).map((it) => str(it, LIMITS.itemChars)),
      icon: str(s.icon, 60) || 'sparkles',
      ...parseImages(s),
      ...parseReveals(s.reveals),
      ...(s.entrance && s.entrance !== 'none' ? { entrance: pick(s.entrance, ENTRANCES, 'none') } : {}),
    };
  });

  const st = (o.style ?? {}) as Record<string, unknown>;
  const style: ProjectStyle = {
    preset: str(st.preset, 40) || DEFAULT_STYLE.preset,
    font: str(st.font, 40) || DEFAULT_STYLE.font,
    digits: pick(st.digits, ['arabic', 'latin'] as const, DEFAULT_STYLE.digits),
    transition: pick(st.transition, ['fade', 'slide', 'zoom', 'wipe'] as const, DEFAULT_STYLE.transition),
    background: pick(st.background, ['gradient', 'dots', 'waves', 'plain'] as const, DEFAULT_STYLE.background),
    music: pick(st.music, ['none', 'calm', 'bright', 'epic'] as const, DEFAULT_STYLE.music),
    sfx: typeof st.sfx === 'boolean' ? st.sfx : DEFAULT_STYLE.sfx,
    pace: pick(st.pace, ['calm', 'balanced', 'fast'] as const, DEFAULT_STYLE.pace),
  };

  const project: Project = {
    version: 1,
    title: str(o.title, 140) || 'مشروع بدون عنوان',
    locale: 'ar',
    fps: FPS,
    durationFrames: 0,
    size: { width, height },
    theme: t,
    scenes: [],
    style,
  };
  // Too long overall: scale every scene down proportionally to the 10-minute limit.
  const sum = scenes.reduce((a, s) => a + s.durationFrames, 0);
  Object.assign(project, withScenes(project, sum > LIMITS.maxTotalFrames ? rebalance(scenes, LIMITS.maxTotalFrames) : scenes));
  const errors = validateTimeline(project);
  if (errors.length) throw new Error(`تعذر إصلاح توقيت المشروع: ${errors.join('، ')}`);
  return project;
}

/** Keeps up to LIMITS.items whole, non-negative frame numbers; anything else drops the field. */
function parseReveals(v: unknown): { reveals?: number[] } {
  if (!Array.isArray(v) || !v.length) return {};
  const out = v.slice(0, LIMITS.items).map((x) => Number(x));
  if (!out.every((x) => Number.isFinite(x) && x >= 0 && x <= 3600)) return {};
  return { reveals: out.map((x) => Math.round(x)) };
}

/** Scene pictures: the `images` list, or a legacy single `image`; malformed entries are dropped. */
function parseImages(s: Record<string, unknown>): { images?: SceneImage[] } {
  const raw = Array.isArray(s.images) ? s.images : s.image ? [s.image] : [];
  const images = raw.slice(0, LIMITS.images).map(parseImage).filter((x): x is SceneImage => !!x);
  return images.length ? { images } : {};
}
