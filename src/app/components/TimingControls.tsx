import { localizeDigits } from '../../design/digits';
import { ENTRANCES, type DigitSystem, type EntranceId, type Scene } from '../../domain/types';
import { itemReveal, revealSlots, withReveal, type Pace } from '../../engine/timing';

const ENTRANCE_LABELS: Record<EntranceId, string> = {
  none: 'بدون', rise: 'صعود', drop: 'هبوط', zoom: 'تكبير', side: 'انزلاق', spin: 'دوران',
};

interface Props {
  scene: Scene;
  pace: Pace;
  fps: number;
  digits: DigitSystem;
  /** Slot (position in `revealSlots`) awaiting the next tap, or null when not syncing. */
  syncNext: number | null;
  onChange: (patch: Partial<Scene>) => void;
  onStartSync: () => void;
  onTap: () => void;
  onStopSync: () => void;
}

/** Entrance style plus per-item reveal times: typed in seconds or tapped live with the audio. */
export function TimingControls({ scene, pace, fps, digits, syncNext, onChange, onStartSync, onTap, onStopSync }: Props) {
  const s = { ...scene, pace };
  const slots = revealSlots(s);
  const n = slots.length;
  const fmt = (f: number) => localizeDigits((f / fps).toFixed(1), digits);

  return (
    <>
      <label className="label">شكل دخول المشهد</label>
      <div className="seg wrap">
        {ENTRANCES.map((e) => (
          <button key={e} type="button" className={(scene.entrance ?? 'none') === e ? 'active' : ''} aria-pressed={(scene.entrance ?? 'none') === e} onClick={() => onChange({ entrance: e === 'none' ? undefined : e })}>
            {ENTRANCE_LABELS[e]}
          </button>
        ))}
      </div>

      {n > 0 && (
        <>
          <label className="label">توقيت ظهور العناصر (بالثواني من بداية المشهد)</label>
          {syncNext !== null ? (
            <div className="sync-box">
              <p className="small">
                شغّلنا المشهد مع الصوت. اضغط الزر (أو مسطرة المسافة) لحظة ذكر كل عنصر:
              </p>
              <button type="button" className="primary sync-tap" onClick={onTap}>
                أظهر الآن: {slots[syncNext]?.label || localizeDigits(`العنصر ${syncNext + 1}`, digits)}
              </button>
              <button type="button" className="ghost" onClick={onStopSync}>إنهاء المزامنة</button>
            </div>
          ) : (
            <>
              <ol className="timing-list">
                {slots.map(({ index, label }) => (
                  <li key={index}>
                    <span className="timing-label" title={label}>{label || '—'}</span>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      max={(scene.durationFrames - 12) / fps}
                      value={(itemReveal(s, index, n) / fps).toFixed(1)}
                      aria-label={`وقت ظهور ${label}`}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v)) onChange({ reveals: withReveal(s, index, v * fps) });
                      }}
                    />
                  </li>
                ))}
              </ol>
              <div className="row">
                <button type="button" onClick={onStartSync}>🎵 مزامنة بالنقر مع الصوت</button>
                <button type="button" className="ghost" disabled={!scene.reveals} onClick={() => onChange({ reveals: undefined })}>
                  توقيت تلقائي
                </button>
              </div>
              <p className="muted small">
                {scene.reveals ? 'توقيت مخصّص' : 'توقيت تلقائي'} — مدة المشهد {fmt(scene.durationFrames)} ث. المؤثرات الصوتية تتبع التوقيت نفسه في المعاينة والتصدير.
              </p>
            </>
          )}
        </>
      )}
    </>
  );
}
