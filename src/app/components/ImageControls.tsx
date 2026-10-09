import { localizeDigits } from '../../design/digits';
import type { DigitSystem, SceneImage } from '../../domain/types';

interface Props {
  image: SceneImage | undefined;
  portrait: boolean;
  digits: DigitSystem;
  onFile: (file: File) => void;
  onChange: (patch: Partial<SceneImage> | null) => void;
}

const pct = (v: number, digits: DigitSystem) => localizeDigits(`${Math.round(v * 100)}%`, digits);

/** Placement shortcuts; values are fractions of the frame. */
const PLACEMENTS = (portrait: boolean): { label: string; patch: Partial<SceneImage> }[] => [
  { label: 'يسار', patch: portrait ? { x: 0.5, y: 0.78, scale: 0.72, layer: 'front' } : { x: 0.24, y: 0.6, scale: 0.34, layer: 'front' } },
  { label: 'وسط', patch: portrait ? { x: 0.5, y: 0.6, scale: 0.8, layer: 'front' } : { x: 0.5, y: 0.6, scale: 0.5, layer: 'front' } },
  { label: 'يمين', patch: portrait ? { x: 0.5, y: 0.3, scale: 0.72, layer: 'front' } : { x: 0.76, y: 0.6, scale: 0.34, layer: 'front' } },
  { label: 'خلفية', patch: { x: 0.5, y: 0.5, scale: portrait ? 1.5 : 1.02, rotation: 0, shape: 'rect', border: false, shadow: false, opacity: 0.3, layer: 'back' } },
];

export function ImageControls({ image, portrait, digits, onFile, onChange }: Props) {
  const upload = (
    <label className="upload">
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />
      🖼 {image ? 'استبدال الصورة' : 'أضف صورة من جهازك'}
    </label>
  );
  if (!image) {
    return (
      <div className="image-controls">
        {upload}
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
      <span className="label">حركة الظهور</span>
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
      <p className="muted small">اسحب الصورة داخل المعاينة لتحريكها.</p>
      <div className="row">
        {upload}
        <button type="button" className="danger" onClick={() => onChange(null)}>حذف الصورة</button>
      </div>
    </div>
  );
}
