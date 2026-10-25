import { useEffect, useMemo, useRef, useState } from 'react';
import type { Project, Scene, SceneKind } from '../../domain/types';
import { sampleScene } from '../../engine/kindSamples';
import { renderFrameSafe as renderFrame } from '../../engine/renderer/safeRender';
import { KIND_BLURBS, KIND_GROUPS, KIND_LABELS } from './kinds';

/**
 * «معرض أنواع المشاهد»: every scene kind as a live thumbnail drawn by renderFrame with the
 * project's own palette, font, aspect and look, so users pick a design by sight instead of by
 * name. Hovering a card plays that scene; the preview can use sample content or the scene's own.
 */

// Thumbnails are drawn a few per animation frame so opening the gallery never blocks the editor.
const jobs = new Set<() => void>();
let raf = 0;
function pump() {
  raf = 0;
  const t0 = performance.now();
  for (const job of jobs) {
    jobs.delete(job);
    job();
    if (performance.now() - t0 > 12) break;
  }
  if (jobs.size) raf = requestAnimationFrame(pump);
}
function enqueue(job: () => void): () => void {
  jobs.add(job);
  if (!raf) raf = requestAnimationFrame(pump);
  return () => jobs.delete(job);
}

/** A one-scene project showing `scene` with the project's style. */
const single = (project: Project, scene: Scene): Project => ({ ...project, scenes: [{ ...scene, startFrame: 0 }], durationFrames: scene.durationFrames });

function KindThumb({ project, scene, w, h, renderKey }: { project: Project; scene: Scene; w: number; h: number; renderKey: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);
  const mini = useMemo(() => single(project, scene), [project, scene]);
  const dpr = Math.min(2, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);
  const out = useMemo(() => ({ width: Math.round(w * dpr), height: Math.round(h * dpr) }), [w, h, dpr]);
  const draw = (frame: number) => {
    const ctx = ref.current?.getContext('2d');
    if (ctx) renderFrame(mini, frame, ctx, out);
  };

  // Still: a late frame shows the content fully revealed.
  useEffect(() => {
    if (playing) return;
    return enqueue(() => draw(Math.floor(mini.durationFrames * 0.75)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mini, out, renderKey, playing]);

  // Hover: play the scene from its first frame, looping.
  useEffect(() => {
    if (!playing) return;
    let id = 0;
    const start = performance.now();
    const tick = (now: number) => {
      draw(Math.floor(((now - start) / 1000) * mini.fps) % mini.durationFrames);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, mini, out]);

  return (
    <canvas
      ref={ref}
      width={out.width}
      height={out.height}
      style={{ width: w, height: h }}
      onPointerEnter={() => setPlaying(true)}
      onPointerLeave={() => setPlaying(false)}
      aria-hidden="true"
    />
  );
}

interface Props {
  project: Project;
  /** The scene whose kind is being changed; absent when adding a new scene. */
  scene?: Scene;
  renderKey: number;
  onPick: (kind: SceneKind) => void;
  onClose: () => void;
}

export function KindGallery({ project, scene, renderKey, onPick, onClose }: Props) {
  const [group, setGroup] = useState<string>('all');
  const [source, setSource] = useState<'sample' | 'mine'>('sample');
  const portrait = project.size.height > project.size.width;
  const square = project.size.height === project.size.width;
  // Two cards per row even on a phone.
  const narrow = typeof window !== 'undefined' && window.innerWidth < 560;
  const w = Math.round((portrait ? 108 : square ? 150 : 200) * (narrow ? 0.66 : 1));
  const h = Math.round((w * project.size.height) / project.size.width);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Preview scenes per kind, stable across renders so thumbnails are drawn once.
  const previews = useMemo(() => {
    const out = new Map<SceneKind, Scene>();
    for (const g of KIND_GROUPS)
      for (const k of g.kinds)
        out.set(k, source === 'mine' && scene ? { ...scene, kind: k, id: `gallery-${k}` } : { ...sampleScene(k, 0, 300), id: `gallery-${k}` });
    return out;
  }, [source, scene]);

  const groups = group === 'all' ? KIND_GROUPS : KIND_GROUPS.filter((g) => g.label === group);
  const total = KIND_GROUPS.reduce((n, g) => n + g.kinds.length, 0);

  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-labelledby="gallery-title" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal gallery">
        <div className="modal-head">
          <h2 id="gallery-title">{scene ? 'اختر تصميم المشهد' : 'أضف مشهدًا جديدًا'}</h2>
          <button type="button" className="ghost" onClick={onClose} aria-label="إغلاق">✕</button>
        </div>
        <p className="muted small">
          {total} تصميمًا بألوان مشروعك وخطّه. مرّر المؤشر على أي تصميم لتشاهد حركته، ثم اضغطه لاختياره.
        </p>
        <div className="gallery-bar">
          <div className="chips" role="tablist" aria-label="الفئات">
            <button type="button" role="tab" aria-selected={group === 'all'} className={group === 'all' ? 'active' : ''} onClick={() => setGroup('all')}>الكل</button>
            {KIND_GROUPS.map((g) => (
              <button type="button" role="tab" key={g.label} aria-selected={group === g.label} className={group === g.label ? 'active' : ''} onClick={() => setGroup(g.label)}>
                {g.label}
              </button>
            ))}
          </div>
          {scene && (
            <div className="seg small" role="group" aria-label="محتوى المعاينة">
              <button type="button" className={source === 'sample' ? 'active' : ''} aria-pressed={source === 'sample'} onClick={() => setSource('sample')}>مثال توضيحي</button>
              <button type="button" className={source === 'mine' ? 'active' : ''} aria-pressed={source === 'mine'} onClick={() => setSource('mine')}>بنصوص مشهدي</button>
            </div>
          )}
        </div>
        {groups.map((g) => (
          <section key={g.label} className="gallery-group">
            <h3>{g.label}</h3>
            <div className="gallery-grid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${w + 14}px, 1fr))` }}>
              {g.kinds.map((k) => (
                <button type="button" key={k} className={`gallery-card ${scene?.kind === k ? 'active' : ''}`} onClick={() => onPick(k)} aria-pressed={scene ? scene.kind === k : undefined}>
                  <KindThumb project={project} scene={previews.get(k)!} w={w} h={h} renderKey={renderKey} />
                  <b>{KIND_LABELS[k]}{scene?.kind === k ? ' ✓' : ''}</b>
                  <span>{KIND_BLURBS[k]}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
