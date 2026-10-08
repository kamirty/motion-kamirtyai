export const FPS = 30;
export const DURATION_FRAMES = 3600; // 120 s at 30 fps

export type SceneKind =
  | 'hero' | 'steps' | 'comparison' | 'stat' | 'timeline' | 'quote' | 'summary' | 'outro';

export interface Theme {
  background: string;
  foreground: string;
  accent: string;
}

export interface Scene {
  id: string;
  kind: SceneKind;
  startFrame: number;
  durationFrames: number;
  title: string;
  items: string[];
  icon: string;
}

export interface Project {
  version: 1;
  title: string;
  locale: 'ar';
  fps: typeof FPS;
  durationFrames: typeof DURATION_FRAMES;
  size: { width: number; height: number };
  theme: Theme;
  scenes: Scene[];
}
