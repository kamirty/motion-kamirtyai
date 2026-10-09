import { useEffect, useRef, useState } from 'react';
import { sceneIndexAt } from '../../domain/timeline';
import { getImageSize } from '../../storage/assets';
import { imageBox } from '../../engine/renderer/imageLayer';
import { layoutFor } from '../../engine/renderer/scenes';
import { localizeDigits } from '../../design/digits';
import { styleOf, type Project } from '../../domain/types';
import { renderFrameSafe as renderFrame } from '../../engine/renderer/safeRender';

const fmt = (frame: number, fps: number) => {
  const s = Math.floor(frame / fps);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

interface Props {
  project: Project;
  frame: number;
  playing: boolean;
  ready: boolean;
  onFrame: (f: number) => void;
  onTogglePlay: () => void;
  /** Bumped when fonts or pictures load so the canvas redraws. */
  renderKey: number;
  /** Selected scene index; its picture can be dragged when that scene is on screen. */
  selected: number;
  onImageMove: (x: number, y: number) => void;
}

export function Preview({ project, frame, playing, ready, onFrame, onTogglePlay, renderKey, selected, onImageMove }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ dx: number; dy: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);
  const scene = project.scenes[selected];
  const image = scene?.image;
  const L = layoutFor(project.size);
  const onSelected = sceneIndexAt(project, frame) === selected;

  /** Pointer position in the renderer's design space. */
  const toDesign = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * L.W, y: ((e.clientY - r.top) / r.height) * L.H };
  };
  const hitImage = (p: { x: number; y: number }) => {
    if (!image || !onSelected) return false;
    const size = getImageSize(image.assetId) ?? { width: 4, height: 3 };
    const b = imageBox(image, L, size);
    // Undo the rotation, then test against the unrotated box.
    const c = Math.cos(-b.rotation);
    const sn = Math.sin(-b.rotation);
    const lx = (p.x - b.cx) * c - (p.y - b.cy) * sn;
    const ly = (p.x - b.cx) * sn + (p.y - b.cy) * c;
    return Math.abs(lx) <= b.w / 2 && Math.abs(ly) <= b.h / 2;
  };
  const portrait = project.size.height > project.size.width;
  const digits = styleOf(project).digits;

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && ready) renderFrame(project, frame, ctx);
  }, [project, frame, ready, renderKey]);

  return (
    <section className={`preview ${portrait ? 'is-portrait' : ''}`}>
      <div className="stage">
        <canvas
          ref={canvasRef}
          width={project.size.width}
          height={project.size.height}
          aria-label="معاينة الفيديو"
          className={dragging ? 'dragging' : image && onSelected && !playing ? 'draggable' : ''}
          onPointerDown={(e) => {
            const p = toDesign(e);
            if (!playing && image && hitImage(p)) {
              drag.current = { dx: image.x * L.W - p.x, dy: image.y * L.H - p.y, moved: false };
              e.currentTarget.setPointerCapture(e.pointerId);
              setDragging(true);
            }
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            const p = toDesign(e);
            drag.current.moved = true;
            const x = Math.min(1.2, Math.max(-0.2, (p.x + drag.current.dx) / L.W));
            const y = Math.min(1.2, Math.max(-0.2, (p.y + drag.current.dy) / L.H));
            onImageMove(Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000);
          }}
          onPointerUp={() => {
            const d = drag.current;
            drag.current = null;
            setDragging(false);
            if (!d) onTogglePlay();
          }}
        />
        {!ready && <div className="stage-loading">جارٍ تحميل الخط…</div>}
      </div>
      <div className="controls">
        <button type="button" className="play" onClick={onTogglePlay} disabled={!ready} aria-label={playing ? 'إيقاف' : 'تشغيل'}>
          {playing ? '❚❚' : '▶'}
        </button>
        <input
          type="range"
          min={0}
          max={project.durationFrames - 1}
          value={frame}
          onChange={(e) => onFrame(Number(e.target.value))}
          aria-label="موضع المعاينة"
        />
        <span className="time">
          {localizeDigits(`${fmt(frame, project.fps)} / ${fmt(project.durationFrames, project.fps)}`, digits)}
        </span>
      </div>
    </section>
  );
}
