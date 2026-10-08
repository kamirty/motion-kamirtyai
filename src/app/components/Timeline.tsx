import { useEffect, useRef } from 'react';
import { localizeDigits } from '../../design/digits';
import { styleOf, type Project, type Scene } from '../../domain/types';
import { renderFrame } from '../../engine/renderer/renderFrame';
import { KIND_LABELS } from './kinds';

function Thumb({ project, scene, renderKey }: { project: Project; scene: Scene; renderKey: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const w = project.size.width >= project.size.height ? 160 : 72;
  const h = Math.round((w * project.size.height) / project.size.width);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const ctx = ref.current?.getContext('2d');
      // A frame late in the scene shows its content fully revealed.
      if (ctx) renderFrame(project, scene.startFrame + Math.floor(scene.durationFrames * 0.75), ctx, { width: w, height: h });
    });
    return () => cancelAnimationFrame(id);
  }, [project, scene, w, h, renderKey]);
  return <canvas ref={ref} width={w} height={h} />;
}

interface Props {
  project: Project;
  selected: number;
  currentFrame: number;
  onSelect: (i: number) => void;
  onAdd: () => void;
  renderKey: number;
}

export function Timeline({ project, selected, currentFrame, onSelect, onAdd, renderKey }: Props) {
  const digits = styleOf(project).digits;
  return (
    <section className="timeline" aria-label="المشاهد">
      <div className="timeline-track">
        {project.scenes.map((s, i) => {
          const active = currentFrame >= s.startFrame && currentFrame < s.startFrame + s.durationFrames;
          return (
            <button
              type="button"
              key={s.id}
              className={`scene-card ${i === selected ? 'selected' : ''} ${active ? 'playing' : ''}`}
              style={{ flexGrow: s.durationFrames }}
              onClick={() => onSelect(i)}
              title={s.title}
            >
              <Thumb project={project} scene={s} renderKey={renderKey} />
              <span className="scene-meta">
                <b>{localizeDigits(String(i + 1), digits)}. {KIND_LABELS[s.kind]}</b>
                <span>{localizeDigits(`${Math.round(s.durationFrames / project.fps)} ث`, digits)}</span>
              </span>
            </button>
          );
        })}
        <button type="button" className="scene-add" onClick={onAdd} disabled={project.scenes.length >= 20} title="إضافة مشهد">
          ＋<span>مشهد</span>
        </button>
      </div>
      <div className="timeline-progress" style={{ width: `${((currentFrame + 1) / project.durationFrames) * 100}%` }} />
    </section>
  );
}
