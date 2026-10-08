/** The subset of the 2D canvas API the renderer relies on; both on-screen and offscreen contexts satisfy it. */
export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export const FONT_FAMILY = '"Noto Kufi Arabic", "Segoe UI", Tahoma, sans-serif';

export const font = (weight: 400 | 700, sizePx: number): string =>
  `${weight} ${Math.round(sizePx)}px ${FONT_FAMILY}`;
