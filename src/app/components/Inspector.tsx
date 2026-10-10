import { localizeDigits } from '../../design/digits';
import { LIMITS, styleOf, type Project, type Scene, type SceneImage } from '../../domain/types';
import { maxSceneFrames } from '../../domain/timeline';
import { IconPicker } from './IconPicker';
import { ImageControls } from './ImageControls';
import { TimingControls } from './TimingControls';
import { KIND_GROUPS, KIND_HINTS, KIND_LABELS } from './kinds';

interface Props {
  project: Project;
  index: number;
  onChange: (patch: Partial<Scene>) => void;
  onDuration: (seconds: number) => void;
  onMove: (delta: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onImageFile: (file: File, mode: 'add' | 'replace') => void;
  onImage: (patch: Partial<SceneImage> | null) => void;
  activeImage: number;
  onImagePick: (k: number) => void;
  onImageOrder: (delta: -1 | 1) => void;
  syncNext: number | null;
  onStartSync: () => void;
  onTap: () => void;
  onStopSync: () => void;
}

export function Inspector({ project, index, onChange, onDuration, onMove, onDuplicate, onDelete, onImageFile, onImage, activeImage, onImagePick, onImageOrder, syncNext, onStartSync, onTap, onStopSync }: Props) {
  const scene = project.scenes[index];
  if (!scene) return null;
  const digits = styleOf(project).digits;
  const seconds = Math.round(scene.durationFrames / project.fps);
  const maxSeconds = Math.floor(maxSceneFrames(project.scenes, index) / project.fps);
  const totalSeconds = Math.round(project.durationFrames / project.fps);
  const setItem = (k: number, v: string) => onChange({ items: scene.items.map((it, j) => (j === k ? v : it)) });

  return (
    <aside className="inspector">
      <div className="inspector-head">
        <h2>{localizeDigits(`المشهد ${index + 1}`, digits)}</h2>
        <div className="tools">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} title="تقديم المشهد">⬆</button>
          <button type="button" onClick={() => onMove(1)} disabled={index === project.scenes.length - 1} title="تأخير المشهد">⬇</button>
          <button type="button" onClick={onDuplicate} disabled={project.scenes.length >= LIMITS.scenes} title="نسخ المشهد">⧉</button>
          <button type="button" className="danger" onClick={onDelete} disabled={project.scenes.length <= 1} title="حذف المشهد">🗑</button>
        </div>
      </div>

      <label className="label">نوع المشهد</label>
      <div className="kind-groups">
        {KIND_GROUPS.map((g) => (
          <div key={g.label} className="kind-group">
            <span className="kind-group-label">{g.label}</span>
            <div className="kinds">
              {g.kinds.map((k) => (
                <button type="button" key={k} className={k === scene.kind ? 'active' : ''} onClick={() => onChange({ kind: k })} aria-pressed={k === scene.kind}>
                  {KIND_LABELS[k]}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="muted small">{KIND_HINTS[scene.kind]}</p>

      <label className="label" htmlFor="scene-title">
        {scene.kind === 'quote' ? 'نص الاقتباس' : 'العنوان'}
      </label>
      <textarea
        id="scene-title"
        rows={2}
        value={scene.title}
        maxLength={LIMITS.titleChars}
        onChange={(e) => onChange({ title: e.target.value.replace(/\n/g, ' ') })}
      />

      <label className="label">العناصر</label>
      <div className="items">
        {scene.items.map((it, k) => (
          <div className="item-row" key={k}>
            <span className="item-n">{localizeDigits(String(k + 1), digits)}</span>
            <input value={it} maxLength={LIMITS.itemChars} onChange={(e) => setItem(k, e.target.value)} />
            <button type="button" className="ghost" onClick={() => onChange({ items: scene.items.filter((_, j) => j !== k) })} title="حذف العنصر">
              ✕
            </button>
          </div>
        ))}
        {scene.items.length < LIMITS.items && (
          <button type="button" className="ghost add" onClick={() => onChange({ items: [...scene.items, ''] })}>
            ＋ إضافة عنصر
          </button>
        )}
      </div>

      <label className="label">الأيقونة</label>
      <IconPicker value={scene.icon} onChange={(icon) => onChange({ icon })} />

      <TimingControls
        scene={scene}
        pace={styleOf(project).pace}
        fps={project.fps}
        digits={digits}
        syncNext={syncNext}
        onChange={onChange}
        onStartSync={onStartSync}
        onTap={onTap}
        onStopSync={onStopSync}
      />

      <label className="label">الصور (حتى ٤ في المشهد)</label>
      <ImageControls images={scene.images ?? []} active={activeImage} portrait={project.size.height > project.size.width} digits={digits} onFile={onImageFile} onChange={onImage} onPick={onImagePick} onOrder={onImageOrder} />

      <label className="label" htmlFor="scene-dur">
        المدة: {localizeDigits(`${seconds} ثانية`, digits)}
      </label>
      <input id="scene-dur" type="range" min={3} max={Math.max(3, maxSeconds)} value={seconds} onChange={(e) => onDuration(Number(e.target.value))} />
      <p className="muted small">{localizeDigits(`مدة الفيديو الآن ${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')} دقيقة — تساوي مجموع مدد المشاهد، ولا يتأثر أي مشهد آخر بتغيير هذا المشهد.`, digits)}</p>
    </aside>
  );
}
