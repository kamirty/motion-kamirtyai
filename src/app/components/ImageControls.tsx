import { localizeDigits } from '../../design/digits';
import { LIMITS, type DigitSystem, type SceneImage } from '../../domain/types';
import { IMAGE, imageEnterAt, imageExitAt } from '../../engine/timing';

interface Props {
  images: SceneImage[];
  /** Index of the picture the controls act on. */
  active: number;
  portrait: boolean;
  digits: DigitSystem;
  onFile: (file: File, mode: 'add' | 'replace') => void;
  onChange: (patch: Partial<SceneImage> | null) => void;
  onPick: (k: number) => void;
  onOrder: (delta: -1 | 1) => void;
  fps: number;
  /** Length of the scene, for the appearance-time slider. */
  sceneFrames: number;
  /** Preview position inside this scene (frames from its start), or null when it is elsewhere. */
  localFrame: number | null;
}

const pct = (v: number, digits: DigitSystem) => localizeDigits(`${Math.round(v * 100)}%`, digits);

/** Placement shortcuts; values are fractions of the frame. */
const PLACEMENTS = (portrait: boolean): { label: string; patch: Partial<SceneImage> }[] => [
  { label: 'يسار', patch: portrait ? { x: 0.5, y: 0.78, scale: 0.72, layer: 'front' } : { x: 0.24, y: 0.6, scale: 0.34, layer: 'front' } },
  { label: 'وسط', patch: portrait ? { x: 0.5, y: 0.6, scale: 0.8, layer: 'front' } : { x: 0.5, y: 0.6, scale: 0.5, layer: 'front' } },
  { label: 'يمين', patch: portrait ? { x: 0.5, y: 0.3, scale: 0.72, layer: 'front' } : { x: 0.76, y: 0.6, scale: 0.34, layer: 'front' } },
  { label: 'خلفية', patch: { x: 0.5, y: 0.5, scale: portrait ? 1.5 : 1.02, rotation: 0, shape: 'rect', border: false, shadow: false, opacity: 0.3, layer: 'back' } },
];

export function ImageControls({ images, active, portrait, digits, onFile, onChange, onPick, onOrder, fps, sceneFrames, localFrame }: Props) {
  const image = images[active];
  const full = images.length >= LIMITS.images;
  const upload = (mode: 'add' | 'replace', label: string) => (
    <label className={`upload ${mode === 'add' && full ? 'disabled' : ''}`} title={mode === 'add' && full ? `الحد الأقصى ${LIMITS.images} صور` : undefined}>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
        multiple={mode === 'add'}
        disabled={mode === 'add' && full}
        onChange={(e) => {
          const files = [...(e.target.files ?? [])].slice(0, mode === 'add' ? LIMITS.images - images.length : 1);
          files.forEach((f) => onFile(f, mode));
          e.target.value = '';
        }}
      />
      {label}
    </label>
  );
  if (!image) {
    return (
      <div className="image-controls">
        {upload('add', '🖼 أضف صورة أو أكثر من جهازك')}
        <p className="muted small">الصورة تبقى في متصفحك فقط، ولا تُرفع لأي خادم.</p>
      </div>
    );
  }
  const slider = (label: string, key: 'scale' | 'x' | 'y' | 'opacity', min: number, max: number) => (
    <label className="slider">
      <span>
        {label} <b>{pct(image[key], digits)}</b>
      </span>
      <input type="range" min={min * 100} max={max * 100} value={Math.round(image[key] * 100)} onChange={(e) => onChange({ [key]: Number(e.target.value) / 100 })} />
    </label>
  );
  return (
    <div className="image-controls">
      <div className="seg image-tabs" role="tablist" aria-label="صور المشهد">
        {images.map((_, k) => (
          <button type="button" role="tab" key={k} aria-selected={k === active} className={k === active ? 'active' : ''} onClick={() => onPick(k)}>
            {localizeDigits(`صورة ${k + 1}`, digits)}
          </button>
        ))}
      </div>
      {upload('add', full ? `🖼 وصلت إلى الحد (${localizeDigits(String(LIMITS.images), digits)} صور)` : '＋ أضف صورة أخرى')}
      {images.length > 1 && (
        <div className="row">
          <button type="button" onClick={() => onOrder(1)} disabled={active >= images.length - 1} title="تظهر لاحقًا وفوق الصور السابقة">⬆ للأمام</button>
          <button type="button" onClick={() => onOrder(-1)} disabled={active === 0} title="تظهر أولًا وتحت الصور اللاحقة">⬇ للخلف</button>
        </div>
      )}
      <div className="seg">
        {PLACEMENTS(portrait).map((p) => (
          <button type="button" key={p.label} onClick={() => onChange(p.patch)}>
            {p.label}
          </button>
        ))}
      </div>
      {slider('الحجم', 'scale', 0.05, 1.5)}
      {slider('الموضع الأفقي', 'x', 0, 1)}
      {slider('الموضع الرأسي', 'y', 0, 1)}
      <label className="slider">
        <span>
          التدوير <b>{localizeDigits(`${Math.round(image.rotation)}°`, digits)}</b>
        </span>
        <input type="range" min={-180} max={180} value={Math.round(image.rotation)} onChange={(e) => onChange({ rotation: Number(e.target.value) })} />
      </label>
      {slider('الشفافية', 'opacity', 0.1, 1)}
      <span className="label">الشكل</span>
      <div className="seg">
        {([['rect', 'مستطيل'], ['rounded', 'زوايا منحنية'], ['circle', 'دائري']] as const).map(([v, l]) => (
          <button type="button" key={v} className={image.shape === v ? 'active' : ''} onClick={() => onChange({ shape: v })}>
            {l}
          </button>
        ))}
      </div>
      <span className="label">الطبقة</span>
      <div className="seg">
        <button type="button" className={image.layer === 'front' ? 'active' : ''} onClick={() => onChange({ layer: 'front' })}>أمام المحتوى</button>
        <button type="button" className={image.layer === 'back' ? 'active' : ''} onClick={() => onChange({ layer: 'back' })}>خلف المحتوى</button>
      </div>
      <span className="label">وقت الظهور</span>
      {(() => {
        const at = imageEnterAt(image, active, sceneFrames);
        const sec = (f: number) => localizeDigits(`${(Math.round((f / fps) * 10) / 10).toString()} ث`, digits);
        const maxTenths = Math.max(0, Math.floor(((sceneFrames - IMAGE.length) / fps) * 10));
        return (
          <>
            <div className="seg">
              <button type="button" className={image.enterAt === undefined ? 'active' : ''} aria-pressed={image.enterAt === undefined} onClick={() => onChange({ enterAt: undefined })}>
                تلقائي
              </button>
              <button type="button" className={image.enterAt !== undefined ? 'active' : ''} aria-pressed={image.enterAt !== undefined} onClick={() => onChange({ enterAt: at })}>
                وقت أختاره
              </button>
            </div>
            <label className="slider">
              <span>
                بعد بداية المشهد بـ <b>{sec(at)}</b>
              </span>
              <input
                type="range"
                min={0}
                max={maxTenths}
                value={Math.min(maxTenths, Math.round((at / fps) * 10))}
                onChange={(e) => onChange({ enterAt: Math.round((Number(e.target.value) / 10) * fps) })}
                aria-label="وقت ظهور الصورة بالثواني"
              />
            </label>
            <button type="button" disabled={localFrame === null} onClick={() => localFrame !== null && onChange({ enterAt: Math.max(0, localFrame) })}>
              ⏱ تظهر عند لحظة المعاينة الحالية{localFrame !== null ? ` (${sec(localFrame)})` : ''}
            </button>
            {localFrame === null && <p className="muted small">شغّل المعاينة أو حرّك شريطها داخل هذا المشهد لتختار اللحظة.</p>}
          </>
        );
      })()}
      <span className="label">وقت الاختفاء</span>
      {(() => {
        const enter = imageEnterAt(image, active, sceneFrames);
        const exit = imageExitAt(image, active, sceneFrames);
        const sec = (f: number) => localizeDigits(`${(Math.round((f / fps) * 10) / 10).toString()} ث`, digits);
        // The picture can leave once it has fully appeared, and must start leaving before the scene ends.
        const minTenths = Math.ceil(((enter + IMAGE.length) / fps) * 10);
        const maxTenths = Math.max(minTenths, Math.floor(((sceneFrames - IMAGE.length) / fps) * 10));
        const canLeave = maxTenths > minTenths;
        const nowOk = localFrame !== null && localFrame >= enter + IMAGE.length && localFrame < sceneFrames - 1;
        return (
          <>
            <div className="seg">
              <button type="button" className={exit === null ? 'active' : ''} aria-pressed={exit === null} onClick={() => onChange({ exitAt: undefined })}>
                تبقى حتى نهاية المشهد
              </button>
              <button
                type="button"
                className={exit !== null ? 'active' : ''}
                aria-pressed={exit !== null}
                disabled={!canLeave}
                title={canLeave ? undefined : 'المشهد قصير جدًا بعد ظهور الصورة'}
                onClick={() => onChange({ exitAt: Math.round((((minTenths + maxTenths) / 2) / 10) * fps) })}
              >
                تختفي في وقت أختاره
              </button>
            </div>
            {exit !== null && (
              <>
                <label className="slider">
                  <span>
                    بعد بداية المشهد بـ <b>{sec(exit)}</b>
                  </span>
                  <input
                    type="range"
                    min={minTenths}
                    max={maxTenths}
                    value={Math.max(minTenths, Math.min(maxTenths, Math.round((exit / fps) * 10)))}
                    onChange={(e) => onChange({ exitAt: Math.round((Number(e.target.value) / 10) * fps) })}
                    aria-label="وقت اختفاء الصورة بالثواني"
                  />
                </label>
              </>
            )}
            <button type="button" disabled={!nowOk} onClick={() => nowOk && onChange({ exitAt: localFrame! })}>
              ⏱ تختفي عند لحظة المعاينة الحالية{localFrame !== null ? ` (${sec(localFrame)})` : ''}
            </button>
            {localFrame !== null && !nowOk && <p className="muted small">حرّك المعاينة إلى لحظة بعد ظهور الصورة لتختار وقت اختفائها.</p>}
          </>
        );
      })()}
      <span className="label">حركة الظهور والاختفاء</span>
      <div className="seg">
        {([['zoom', 'تكبير'], ['fade', 'تلاشي'], ['slide', 'انزلاق'], ['none', 'بدون']] as const).map(([v, l]) => (
          <button type="button" key={v} className={image.entrance === v ? 'active' : ''} onClick={() => onChange({ entrance: v })}>
            {l}
          </button>
        ))}
      </div>
      <label className="check">
        <input type="checkbox" checked={image.border} onChange={(e) => onChange({ border: e.target.checked })} />
        إطار بلون الهوية
      </label>
      <label className="check">
        <input type="checkbox" checked={image.shadow} onChange={(e) => onChange({ shadow: e.target.checked })} />
        ظل
      </label>
      <p className="muted small">اسحب أي صورة داخل المعاينة لتحريكها واختيارها. تظهر الصور بالتتابع حسب ترتيبها، إلا إذا اخترت لها وقتًا.</p>
      <div className="row">
        {upload('replace', 'استبدال هذه الصورة')}
        <button type="button" className="danger" onClick={() => onChange(null)}>{localizeDigits(`حذف الصورة ${active + 1}`, digits)}</button>
      </div>
    </div>
  );
}
