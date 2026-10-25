import { useEffect, useRef, useState } from 'react';
import { localizeDigits } from '../../design/digits';
import type { DigitSystem, Scene } from '../../domain/types';
import { getVoiceBlob } from '../../storage/voices';

/** Scene panel section for the scene's recorded narration. */
export function VoiceControls({ scene, fps, digits, canRecord, missing, onRecord, onRemove, onFit }: {
  scene: Scene;
  fps: number;
  digits: DigitSystem;
  canRecord: boolean;
  /** The recording is referenced but not stored in this browser (e.g. site data was cleared). */
  missing: boolean;
  onRecord: () => void;
  onRemove: () => void;
  onFit: () => void;
}) {
  const L = (s: string) => localizeDigits(s, digits);
  const voice = scene.voice;
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  const stop = () => {
    audio.current?.pause();
    if (audio.current?.src) URL.revokeObjectURL(audio.current.src);
    audio.current = null;
    setPlaying(false);
  };
  useEffect(() => stop, [voice?.assetId]);

  const listen = () => {
    if (playing) return stop();
    const blob = voice && getVoiceBlob(voice.assetId);
    if (!blob) return;
    const a = new Audio(URL.createObjectURL(blob));
    a.onended = stop;
    audio.current = a;
    setPlaying(true);
    void a.play().catch(stop);
  };

  const recSeconds = voice ? Math.round((voice.durationFrames / fps) * 10) / 10 : 0;
  const sceneSeconds = Math.round(scene.durationFrames / fps);
  const longer = !!voice && voice.durationFrames > scene.durationFrames;

  return (
    <div className="voice-box">
      <label className="label">🎙 التعليق الصوتي للمشهد</label>
      {!voice ? (
        <>
          <button type="button" onClick={onRecord} disabled={!canRecord}>🎙 سجّل تعليقًا صوتيًا لهذا المشهد</button>
          <p className="muted small">
            {canRecord
              ? 'اقرأ نص المشهد بصوتك أو بصوت أي شخص. يبقى التسجيل على جهازك ويخرج في الفيديو مع الموسيقى (تنخفض تحته تلقائيًا).'
              : 'متصفحك لا يسمح بالتسجيل من الميكروفون هنا. استخدم Chrome أو Edge على الحاسوب، أو ارفع ملفًا صوتيًا مسجّلًا من قسم «الصوت».'}
          </p>
        </>
      ) : (
        <>
          <div className="voice-row">
            <button type="button" onClick={listen} disabled={missing} aria-pressed={playing}>{playing ? '■ إيقاف' : '▶ استمع'}</button>
            <span className="voice-len">{L(`${recSeconds} ث`)}</span>
            <button type="button" onClick={onRecord} disabled={!canRecord}>↺ أعد التسجيل</button>
            <button type="button" className="ghost danger" onClick={onRemove} title="حذف التسجيل">🗑</button>
          </div>
          {missing && <p className="alert error small">لم يُعثر على هذا التسجيل في متصفحك (ربما مُسحت بيانات الموقع). سجّله من جديد أو احذفه.</p>}
          {longer && (
            <p className="muted small">
              {L(`التسجيل (${recSeconds} ث) أطول من المشهد (${sceneSeconds} ث)، فسيُقطع آخره. `)}
              <button type="button" className="ghost add" onClick={onFit}>اجعل المشهد بطول التسجيل</button>
            </p>
          )}
          <p className="muted small">لضبط ظهور العناصر على كلامك: «🎵 مزامنة بالنقر مع الصوت» في توقيت العناصر.</p>
        </>
      )}
    </div>
  );
}
