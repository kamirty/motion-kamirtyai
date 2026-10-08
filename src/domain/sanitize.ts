import { ASPECTS, DEFAULT_STYLE, DURATION_FRAMES, FPS, LIMITS, SCENE_KINDS, type Project, type ProjectStyle, type Scene } from './types';
import { rebalance, validateTimeline } from './timeline';

const COLOR = /^#[0-9A-Fa-f]{6}$/;
const ID = /^[A-Za-z0-9_-]{1,40}$/;

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v : '').replace(/[\u0000-\u0008\u000B-\u001F]/g, '').slice(0, max);
const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);

/**
 * Parses untrusted JSON (imported file or local autosave) into a valid project, or throws with an
 * Arabic message. Unknown fields are dropped, strings clamped, and timing repaired to exactly 120 s.
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
    background: color(theme.background, '#0B1E33'),
    foreground: color(theme.foreground, '#F2F7FC'),
    accent: color(theme.accent, '#2EC4B6'),
    accent2: color(theme.accent2, color(theme.accent, '#4EA8F2')),
    surface: color(theme.surface, '#13304D'),
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
      durationFrames: Number.isFinite(d) && d > 0 ? Math.round(d) : LIMITS.minSceneFrames,
      title: str(s.title, LIMITS.titleChars),
      items: (Array.isArray(s.items) ? s.items : []).slice(0, LIMITS.items).map((it) => str(it, LIMITS.itemChars)),
      icon: str(s.icon, 60) || 'sparkles',
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
    watermark: typeof st.watermark === 'boolean' ? st.watermark : DEFAULT_STYLE.watermark,
  };

  const project: Project = {
    version: 1,
    title: str(o.title, 140) || 'مشروع بدون عنوان',
    locale: 'ar',
    fps: FPS,
    durationFrames: DURATION_FRAMES,
    size: { width, height },
    theme: t,
    scenes: rebalance(scenes),
    style,
  };
  const errors = validateTimeline(project);
  if (errors.length) throw new Error(`تعذر إصلاح توقيت المشروع: ${errors.join('، ')}`);
  return project;
}
