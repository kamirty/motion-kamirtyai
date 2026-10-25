import { localizeDigits } from '../../design/digits';
import { LIMITS, styleOf, type Project, type Scene, type SceneImage } from '../../domain/types';
import { maxSceneFrames } from '../../domain/timeline';
import { IconPicker } from './IconPicker';
import { effectiveItemIcons, hasItemIcons } from '../../engine/itemIcons';
import { ImageControls } from './ImageControls';
import { TimingControls } from './TimingControls';
import { VoiceControls } from './VoiceControls';
import { KIND_BLURBS, KIND_HINTS, KIND_LABELS } from './kinds';
import { Icon } from './Icon';
import { KIND_ICONS } from '../../design/icons';

interface Props {
  project: Project;
  index: number;
  onChange: (patch: Partial<Scene>) => void;
  /** Opens the scene-kind gallery. */
  onChangeKind: () => void;
  canRecord: boolean;
  voiceMissing: boolean;
  onRecordVoice: () => void;
  /** Sets the scene's length to its recording's. */
  onFitVoice: () => void;
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

export function Inspector({ project, index, onChange, onChangeKind, canRecord, voiceMissing, onRecordVoice, onFitVoice, onDuration, onMove, onDuplicate, onDelete, onImageFile, onImage, activeImage, onImagePick, onImageOrder, syncNext, onStartSync, onTap, onStopSync }: Props) {
  const scene = project.scenes[index];
  if (!scene) return null;
  const digits = styleOf(project).digits;
  const seconds = Math.round(scene.durationFrames / project.fps);
  const maxSeconds = Math.floor(maxSceneFrames(project.scenes, index) / project.fps);
  const totalSeconds = Math.round(project.durationFrames / project.fps);
  const setItem = (k: number, v: string) => onChange({ items: scene.items.map((it, j) => (j === k ? v : it)) });
  // Per-element icons (cards, comparisons, KPI tiles, before/after): what the video draws now.
  const itemIcons = hasItemIcons(scene) ? effectiveItemIcons(scene) : null;
  const setItemIcon = (k: number, id: string) => {
    const next = scene.items.map((_, j) => (j === k ? id : scene.itemIcons?.[j] ?? ''));
    onChange({ itemIcons: next.some(Boolean) ? next : undefined });
  };
  // Removing an element also removes its icon choice, so the others keep theirs.
  const removeItem = (k: number) =>
    onChange({ items: scene.items.filter((_, j) => j !== k), itemIcons: scene.itemIcons?.filter((_, j) => j !== k) });

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
      <button type="button" className="kind-current" onClick={onChangeKind} aria-haspopup="dialog">
        <span className="kind-current-icon"><Icon id={KIND_ICONS[scene.kind] ?? 'sparkles'} size={22} /></span>
        <span className="kind-current-text">
          <b>{KIND_LABELS[scene.kind]}</b>
          <small>{KIND_BLURBS[scene.kind]}</small>
        </span>
        <span className="kind-current-cta">تغيير التصميم</span>
      </button>
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
            {itemIcons && k < itemIcons.length && (
              <IconPicker
                compact
                value={itemIcons[k]}
                isAuto={!scene.itemIcons?.[k]}
                label={localizeDigits(`أيقونة العنصر ${k + 1}`, digits)}
                onChange={(id) => setItemIcon(k, id)}
                onAuto={() => setItemIcon(k, '')}
              />
            )}
            <input value={it} maxLength={LIMITS.itemChars} onChange={(e) => setItem(k, e.target.value)} />
            <button type="button" className="ghost" onClick={() => removeItem(k)} title="حذف العنصر">
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

      <label className="label">{itemIcons ? 'أيقونة المشهد (العنوان)' : 'الأيقونة'}</label>
      <IconPicker value={scene.icon} onChange={(icon) => onChange({ icon })} />

      <VoiceControls
        scene={scene}
        fps={project.fps}
        digits={digits}
        canRecord={canRecord}
        missing={voiceMissing}
        onRecord={onRecordVoice}
        onRemove={() => onChange({ voice: undefined })}
        onFit={onFitVoice}
      />

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
