import { fullTheme, presetById } from '../design/presets';
import { distributeFrames, restack } from '../domain/timeline';
import {
  ASPECTS, DEFAULT_STYLE, DURATION_FRAMES, FPS, type AspectId, type Project, type ProjectStyle, type Scene,
} from '../domain/types';
import { buildStoryboard, type Storyboard } from './parser/storyboard';

export interface GenerateOptions {
  aspect: AspectId;
  style: Partial<ProjectStyle>;
}

/** Converts a storyboard into a valid 120-second project. */
export function storyboardToProject(board: Storyboard, opts: GenerateOptions): Project {
  const style: ProjectStyle = { ...DEFAULT_STYLE, ...opts.style };
  const preset = presetById(style.preset);
  const frames = distributeFrames(board.scenes.map((s) => s.weight), DURATION_FRAMES);
  const scenes: Scene[] = board.scenes.map((s, i) => ({
    id: `s${i + 1}`,
    kind: s.kind,
    startFrame: 0,
    durationFrames: frames[i],
    title: s.title,
    items: s.items.slice(0, 6),
    icon: s.icon,
  }));
  const { width, height } = ASPECTS[opts.aspect];
  return {
    version: 1,
    title: board.title,
    locale: 'ar',
    fps: FPS,
    durationFrames: DURATION_FRAMES,
    size: { width, height },
    theme: fullTheme(preset.theme),
    scenes: restack(scenes),
    style,
  };
}

export function generateProject(description: string, opts: GenerateOptions): { project: Project; usedPlaceholders: boolean } {
  const board = buildStoryboard(description);
  return { project: storyboardToProject(board, opts), usedPlaceholders: board.usedPlaceholders };
}

/** Next free scene id like "s7". */
export function nextSceneId(scenes: Scene[]): string {
  const used = new Set(scenes.map((s) => s.id));
  for (let i = scenes.length + 1; ; i++) if (!used.has(`s${i}`)) return `s${i}`;
}
