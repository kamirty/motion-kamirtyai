import { cssFamily, fontById } from '../../design/fonts';

/** The subset of the 2D canvas API the renderer relies on; both on-screen and offscreen contexts satisfy it. */
export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export interface FontSpec {
  family: string;
  bold: 400 | 700;
}

export const fontSpec = (fontId: string): FontSpec => {
  const f = fontById(fontId);
  return { family: cssFamily(f), bold: f.bold };
};

export const font = (spec: FontSpec, weight: 'regular' | 'bold', sizePx: number): string =>
  `${weight === 'bold' ? spec.bold : 400} ${Math.round(sizePx)}px ${spec.family}`;
