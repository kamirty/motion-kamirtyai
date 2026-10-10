export const FPS = 30;
/** Default length for a newly generated video (120 s at 30 fps); the real length is the sum of its scenes. */
export const DURATION_FRAMES = 3600;

export const SCENE_KINDS = [
  'hero', 'steps', 'comparison', 'stat', 'timeline', 'quote', 'summary', 'outro',
  'kpis', 'donut', 'columns', 'pictogram', 'cycle', 'pyramid', 'proscons', 'checklist', 'quiz', 'definition', 'chapter', 'tip',
] as const;
export type SceneKind = (typeof SCENE_KINDS)[number];

export interface Theme {
  background: string;
  foreground: string;
  accent: string;
  /** Secondary accent for gradients, charts and highlights. */
  accent2?: string;
  /** Card / panel colour drawn on top of the background. */
  surface?: string;
}

export type ImageShape = 'rect' | 'rounded' | 'circle';
export type ImageEntrance = 'fade' | 'zoom' | 'slide' | 'none';

/** A picture the visitor added to a scene. The pixels live in the browser's asset store. */
export interface SceneImage {
  /** Content hash of the stored image (see src/storage/assets.ts). */
  assetId: string;
  /** Centre position as a fraction of the frame width/height (0–1). */
  x: number;
  y: number;
  /** Width as a fraction of the frame width (0.05–1.5); height follows the picture's aspect. */
  scale: number;
  /** Rotation in degrees (−180–180). */
  rotation: number;
  shape: ImageShape;
  border: boolean;
  shadow: boolean;
  /** 0.1–1 */
  opacity: number;
  entrance: ImageEntrance;
  /** Draw over the scene content, or behind it (as a backdrop). */
  layer: 'front' | 'back';
}

export interface Scene {
  id: string;
  kind: SceneKind;
  startFrame: number;
  durationFrames: number;
  title: string;
  items: string[];
  icon: string;
  image?: SceneImage;
  /** Custom reveal frame (from scene start) per item, set by tap-to-sync or the timing editor. */
  reveals?: number[];
  /** How the scene's content enters, on top of the project transition. */
  entrance?: EntranceId;
}

export type EntranceId = 'none' | 'rise' | 'drop' | 'zoom' | 'side' | 'spin';
export const ENTRANCES: readonly EntranceId[] = ['none', 'rise', 'drop', 'zoom', 'side', 'spin'];

export type DigitSystem = 'arabic' | 'latin';
export type TransitionId = 'fade' | 'slide' | 'zoom' | 'wipe';
export type MusicId = 'none' | 'calm' | 'bright' | 'epic';
export type BackgroundId = 'gradient' | 'dots' | 'waves' | 'plain';

export interface ProjectStyle {
  preset: string;
  font: string;
  digits: DigitSystem;
  transition: TransitionId;
  background: BackgroundId;
  music: MusicId;
  /** Automatic sound effects when elements appear. */
  sfx: boolean;
  /** Motion speed: how spread out element reveals are. */
  pace: 'calm' | 'balanced' | 'fast';
}

export interface Project {
  version: 1;
  title: string;
  locale: 'ar';
  fps: typeof FPS;
  /** Always the sum of the scene durations. */
  durationFrames: number;
  size: { width: number; height: number };
  theme: Theme;
  scenes: Scene[];
  style?: Partial<ProjectStyle>;
}

export const DEFAULT_STYLE: ProjectStyle = {
  preset: 'kamirty',
  font: 'cairo',
  digits: 'arabic',
  transition: 'wipe',
  background: 'dots',
  music: 'calm',
  sfx: true,
  pace: 'balanced',
};

export const styleOf = (project: Project): ProjectStyle => ({ ...DEFAULT_STYLE, ...project.style });

export type AspectId = 'landscape' | 'portrait' | 'square';

/** Base (720p-class) sizes per aspect; export may scale these up. */
export const ASPECTS: Record<AspectId, { label: string; width: number; height: number; hd: { width: number; height: number } }> = {
  landscape: { label: 'أفقي 16:9 (يوتيوب)', width: 1280, height: 720, hd: { width: 1920, height: 1080 } },
  portrait: { label: 'عمودي 9:16 (ريلز وتيك توك)', width: 720, height: 1280, hd: { width: 1080, height: 1920 } },
  square: { label: 'مربع 1:1 (إنستغرام)', width: 1080, height: 1080, hd: { width: 1080, height: 1080 } },
};

export function aspectOf(size: { width: number; height: number }): AspectId {
  if (size.width === size.height) return 'square';
  return size.width > size.height ? 'landscape' : 'portrait';
}

export const DEFAULT_IMAGE: Omit<SceneImage, 'assetId'> = {
  x: 0.27,
  y: 0.58,
  scale: 0.36,
  rotation: 0,
  shape: 'rounded',
  border: true,
  shadow: true,
  opacity: 1,
  entrance: 'zoom',
  layer: 'front',
};

/** Limits enforced on user input. */
export const LIMITS = {
  descriptionChars: 3000,
  titleChars: 160,
  itemChars: 160,
  items: 6,
  scenes: 20,
  minSceneFrames: 3 * FPS,
  maxSceneFrames: 120 * FPS,
  /** Longest video: 10 minutes. */
  maxTotalFrames: 600 * FPS,
};
