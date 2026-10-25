import { useEffect, useRef, useState } from 'react';
import { localizeDigits } from '../../design/digits';
import type { DigitSystem, Scene } from '../../domain/types';
import { recorderMime } from '../../storage/voices';

/**
 * «سجّل التعليق»: records the narration of one scene from the microphone while its text is shown
 * as a teleprompter. Everything stays in the browser: the recording is handed to the editor,
 * which stores it locally and mixes it into preview and export.
 */

type Phase = 'ready' | 'countdown' | 'recording' | 'review' | 'saving' | 'error';

interface Props {
  scene: Scene;
  index: number;
  total: number;
  fps: number;
  digits: DigitSystem;
  /** Longest recording this scene may take (its maximum length), in seconds. */
  maxSeconds: number;
  onSave: (blob: Blob, fit: boolean, next: boolean) => Promise<void>;
  onClose: () => void;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function micError(e: unknown): string {
  const name = e instanceof DOMException ? e.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return 'لم يُسمح باستخدام الميكروفون. اسمح للموقع بالميكروفون من أيقونة القفل بجانب عنوان الموقع، ثم أعد المحاولة.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'لم يُعثر على ميكروفون متصل بهذا الجهاز.';
  if (name === 'NotReadableError') return 'الميكروفون مستخدم في برنامج آخر. أغلق البرنامج الآخر ثم أعد المحاولة.';
  return 'تعذّر بدء التسجيل في هذا المتصفح. جرّب Chrome أو Edge، أو ارفع ملفًا صوتيًا مسجّلًا من قسم «الصوت».';
}

export function VoiceRecorder({ scene, index, total, fps, digits, maxSeconds, onSave, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>('ready');
  const [error, setError] = useState('');
  const [count, setCount] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [take, setTake] = useState<{ blob: Blob; url: string; seconds: number } | null>(null);
  const [fit, setFit] = useState(true);

  const stream = useRef<MediaStream | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timers = useRef<number[]>([]);
  const raf = useRef(0);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    cancelAnimationFrame(raf.current);
  };

  // Releasing the microphone on close turns the browser's recording indicator off.
  const release = () => {
    clearTimers();
    if (recorder.current && recorder.current.state !== 'inactive') {
      recorder.current.onstop = null;
      recorder.current.stop();
    }
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    void audioCtx.current?.close().catch(() => undefined);
    audioCtx.current = null;
  };
  useEffect(() => release, []);
  useEffect(() => () => {
    if (take) URL.revokeObjectURL(take.url);
  }, [take]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && phase !== 'recording' && phase !== 'saving') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, onClose]);

  const openMic = async (): Promise<MediaStream> => {
    if (stream.current) return stream.current;
    const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    stream.current = s;
    try {
      const ctx = new AudioContext();
      void ctx.resume().catch(() => undefined);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(s).connect(analyser);
      audioCtx.current = ctx;
      const data = new Uint8Array(analyser.fftSize);
      let shown = 0;
      const meter = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += ((v - 128) / 128) ** 2;
        // Rises at once, falls slowly, so speech reads as a steady bar.
        shown = Math.max(Math.min(1, Math.sqrt(sum / data.length) * 4), shown * 0.92);
        setLevel(shown);
        raf.current = requestAnimationFrame(meter);
      };
      meter();
    } catch {
      /* the level meter is optional */
    }
    return s;
  };

  const record = (s: MediaStream) => {
    const mimeType = recorderMime();
    const rec = new MediaRecorder(s, mimeType ? { mimeType, audioBitsPerSecond: 96_000 } : undefined);
    const chunks: Blob[] = [];
    const t0 = performance.now();
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      clearTimers();
      const seconds = (performance.now() - t0) / 1000;
      const blob = new Blob(chunks, { type: rec.mimeType || mimeType || 'audio/webm' });
      setTake({ blob, url: URL.createObjectURL(blob), seconds });
      setFit(seconds > scene.durationFrames / fps || Math.abs(seconds - scene.durationFrames / fps) > 1.5);
      setPhase('review');
    };
    recorder.current = rec;
    rec.start(250);
    setElapsed(0);
    setPhase('recording');
    const tick = () => {
      const s = (performance.now() - t0) / 1000;
      setElapsed(s);
      if (s >= maxSeconds) rec.stop();
      else timers.current.push(window.setTimeout(tick, 100));
    };
    tick();
  };

  const start = async () => {
    setError('');
    setTake(null);
    try {
      const s = await openMic();
      setPhase('countdown');
      setCount(3);
      [2, 1].forEach((n, k) => timers.current.push(window.setTimeout(() => setCount(n), (k + 1) * 1000)));
      timers.current.push(window.setTimeout(() => record(s), 3000));
    } catch (e) {
      setError(micError(e));
      setPhase('error');
    }
  };

  const stop = () => recorder.current?.state === 'recording' && recorder.current.stop();

  const save = async (next: boolean) => {
    if (!take) return;
    setPhase('saving');
    try {
      await onSave(take.blob, fit, next);
    } catch {
      setError('تعذّر قراءة التسجيل. أعد التسجيل من فضلك.');
      setPhase('error');
    }
  };

  const L = (s: string) => localizeDigits(s, digits);
  // Clock times read left to right (m:ss) inside Arabic sentences.
  const T = (s: number) => <bdi dir="ltr">{L(fmt(s))}</bdi>;
  const sceneSeconds = Math.round(scene.durationFrames / fps);
  const fitSeconds = take ? Math.min(maxSeconds, Math.max(3, Math.ceil(take.seconds + 0.4))) : 0;
  const busy = phase === 'recording' || phase === 'countdown' || phase === 'saving';

  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-labelledby="rec-title" onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="modal recorder">
        <div className="modal-head">
          <h2 id="rec-title">{L(`🎙 تعليق المشهد ${index + 1} من ${total}`)}</h2>
          <button type="button" className="ghost" onClick={onClose} disabled={busy} aria-label="إغلاق">✕</button>
        </div>

        <div className={`prompter ${phase === 'recording' ? 'live' : ''}`} dir="rtl">
          {scene.title && <p className="prompter-title">{L(scene.title)}</p>}
          {scene.items.filter((t) => t.trim()).map((t, k) => (
            <p key={k} className="prompter-item">{L(t)}</p>
          ))}
          {!scene.title && !scene.items.some((t) => t.trim()) && <p className="muted">لا يوجد نص في هذا المشهد؛ سجّل ما تريد قوله.</p>}
        </div>

        {phase === 'ready' && (
          <>
            <p className="muted small">
              اقرأ النص بصوتك أو بصوت أي شخص (امرأة، رجل، طفل). بعد الضغط يبدأ عدّ تنازلي (٣، ٢، ١) ثم التسجيل. اترك نصف ثانية صمت في البداية والنهاية.
              التسجيل يبقى على جهازك فقط ولا يُرفع إلى أي خادم.
            </p>
            <button type="button" className="primary rec-big" onClick={() => void start()}>● ابدأ التسجيل</button>
          </>
        )}

        {phase === 'countdown' && <div className="rec-count" aria-live="assertive">{L(String(count))}</div>}

        {phase === 'recording' && (
          <div className="rec-live">
            <span className="rec-dot" aria-hidden="true" />
            <b aria-live="off">{T(elapsed)}</b>
            <span className="muted small">(الحد {T(maxSeconds)})</span>
            <div className="rec-meter" aria-hidden="true"><div style={{ width: `${Math.round(level * 100)}%` }} /></div>
            <button type="button" className="primary" onClick={stop}>■ إيقاف</button>
          </div>
        )}

        {(phase === 'review' || phase === 'saving') && take && (
          <div className="rec-review">
            <audio controls src={take.url} />
            <p className="small">مدة التسجيل {T(take.seconds)} — {L(`مدة المشهد الآن ${sceneSeconds} ثانية.`)}</p>
            <label className="check">
              <input type="checkbox" checked={fit} onChange={(e) => setFit(e.target.checked)} />
              {L(`اجعل مدة المشهد ${fitSeconds} ثانية (بطول التسجيل)`)}
            </label>
            {!fit && take.seconds > sceneSeconds && <p className="muted small">التسجيل أطول من المشهد، فسيُقطع آخره عند نهاية المشهد.</p>}
            <div className="row wrap">
              <button type="button" className="primary" disabled={phase === 'saving'} onClick={() => void save(false)}>✓ احتفظ بالتسجيل</button>
              {index < total - 1 && (
                <button type="button" disabled={phase === 'saving'} onClick={() => void save(true)}>✓ احتفظ وسجّل المشهد التالي</button>
              )}
              <button type="button" className="ghost" disabled={phase === 'saving'} onClick={() => void start()}>↺ أعد التسجيل</button>
            </div>
          </div>
        )}

        {phase === 'error' && (
          <>
            <p className="alert error">{error}</p>
            <button type="button" onClick={() => void start()}>حاول مرة أخرى</button>
          </>
        )}
      </div>
    </div>
  );
}
