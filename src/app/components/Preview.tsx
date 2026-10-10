import type { SceneImage } from '../../domain/types';
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
  /** Waiting for the soundtrack before playback starts. */
  preparing?: boolean;
  ready: boolean;
  onFrame: (f: number) => void;
  onTogglePlay: () => void;
  /** Bumped when fonts or pictures load so the canvas redraws. */
  renderKey: number;
  /** Selected scene index; its picture can be dragged when that scene is on screen. */
  selected: number;
  activeImage: number;
  onImagePick: (k: number) => void;
  onImageMove: (k: number, x: number, y: number) => void;
}

export function Preview({ project, frame, playing, preparing, ready, onFrame, onTogglePlay, renderKey, selected, activeImage, onImagePick, onImageMove }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ k: number; dx: number; dy: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);
  const scene = project.scenes[selected];
  const images = scene?.images ?? [];
  const image = images.length > 0;
  const L = layoutFor(project.size);
  const onSelected = sceneIndexAt(project, frame) === selected;

  /** Pointer position in the renderer's design space. */
  const toDesign = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * L.W, y: ((e.clientY - r.top) / r.height) * L.H };
  };
  /** Topmost picture under the pointer (front layer above back, later above earlier), or -1. */
  const hitImage = (p: { x: number; y: number }) => {
    if (!onSelected) return -1;
    const order = images.map((im, k) => ({ im, k })).sort((a, b) => (a.im.layer === 'back' ? 0 : 1) - (b.im.layer === 'back' ? 0 : 1) || a.k - b.k);
    for (let i = order.length - 1; i >= 0; i--) if (hitOne(order[i].im, p)) return order[i].k;
    return -1;
  };
  const hitOne = (img: SceneImage, p: { x: number; y: number }) => {
    const size = getImageSize(img.assetId) ?? { width: 4, height: 3 };
    const b = imageBox(img, L, size);
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
    if (!ctx || !ready) return;
    renderFrame(project, frame, ctx);
    // Editing aid (never part of the video): dashed outline on the selected picture.
    const img = images[activeImage];
    if (img && !playing && onSelected && images.length > 1) {
      const b = imageBox(img, L, getImageSize(img.assetId) ?? { width: 4, height: 3 });
      const k = project.size.width / L.W;
      ctx.save();
      ctx.setTransform(k, 0, 0, k, 0, 0);
      ctx.translate(b.cx, b.cy);
      ctx.rotate(b.rotation);
      ctx.setLineDash([10, 8]);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#FFEB3B';
      ctx.strokeRect(-b.w / 2 - 6, -b.h / 2 - 6, b.w + 12, b.h + 12);
      ctx.restore();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, frame, ready, renderKey, activeImage, playing]);

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
            const k = playing ? -1 : hitImage(p);
            if (k >= 0) {
              const img = images[k];
              onImagePick(k);
              drag.current = { k, dx: img.x * L.W - p.x, dy: img.y * L.H - p.y, moved: false };
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
            onImageMove(drag.current.k, Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000);
          }}
          onPointerUp={() => {
            const d = drag.current;
            drag.current = null;
            setDragging(false);
            if (!d) onTogglePlay();
          }}
        />
        {!ready && <div className="stage-loading">جارٍ تحميل الخط…</div>}
        {ready && preparing && <div className="stage-loading">جارٍ تجهيز الصوت ليبدأ متزامنًا…</div>}
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
