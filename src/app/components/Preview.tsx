import { useEffect, useRef } from 'react';
import { localizeDigits } from '../../design/digits';
import { styleOf, type Project } from '../../domain/types';
import { renderFrame } from '../../engine/renderer/renderFrame';

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
  /** Bumped when fonts load so the canvas redraws with real metrics. */
  renderKey: number;
}

export function Preview({ project, frame, playing, ready, onFrame, onTogglePlay, renderKey }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
          onClick={onTogglePlay}
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
