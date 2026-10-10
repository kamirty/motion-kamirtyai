import { useEffect, useMemo, useRef, useState } from 'react';
import { localizeDigits } from '../../design/digits';
import { ASPECTS, aspectOf, styleOf, type Project } from '../../domain/types';
import { validateTimeline } from '../../domain/timeline';
import { detectExportPlan, type DetectResult } from '../../engine/export/capabilities';
import type { VerifyReport } from '../../engine/export/verify';
import { loadAssets, projectAssetIds } from '../../storage/assets';
import { downloadBlob } from '../../storage/projectJson';

type State =
  | { status: 'idle' }
  | { status: 'running'; frame: number; startedAt: number; now: number }
  | { status: 'verifying' }
  | { status: 'done'; blob: Blob; url: string; filename: string; report: VerifyReport; seconds: number }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

interface Props {
  project: Project;
  getAudio: () => Promise<AudioBuffer | null>;
  onClose: () => void;
}

const safeName = (title: string) => title.replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 60) || 'kamirty-motion';

export function ExportDialog({ project, getAudio, onClose }: Props) {
  const aspect = aspectOf(project.size);
  const [quality, setQuality] = useState<'sd' | 'hd'>('sd');
  const size = quality === 'hd' ? ASPECTS[aspect].hd : project.size;
  const [cap, setCap] = useState<DetectResult | null>(null);
  const [state, setState] = useState<State>({ status: 'idle' });
  const abortRef = useRef<AbortController | null>(null);
  const digits = styleOf(project).digits;
  const errors = useMemo(() => validateTimeline(project), [project]);
  const n = (v: string | number) => localizeDigits(String(v), digits);

  useEffect(() => {
    setCap(null);
    detectExportPlan(size).then(setCap);
  }, [size.width, size.height]);

  useEffect(() => () => {
    abortRef.current?.abort();
  }, []);
  useEffect(() => () => {
    if (state.status === 'done') URL.revokeObjectURL(state.url);
  }, [state]);

  const start = async () => {
    if (!cap?.supported) return;
    const controller = new AbortController();
    abortRef.current = controller;
    const startedAt = performance.now();
    setState({ status: 'running', frame: 0, startedAt, now: startedAt });
    try {
      // Every picture must be decoded before the first frame, or it would be missing from the video.
      const missing = await loadAssets(projectAssetIds(project));
      if (missing.length) throw new Error('بعض صور المشروع غير موجودة على هذا الجهاز. أعد إضافتها من لوحة المشهد.');
      const [{ exportVideo }, { verifyExport }, audio] = await Promise.all([
        import('../../engine/export/exportVideo'),
        import('../../engine/export/verify'),
        getAudio(),
      ]);
      const blob = await exportVideo(project, cap.plan, {
        signal: controller.signal,
        audio,
        onProgress: (p) => setState({ status: 'running', frame: p.frame, startedAt, now: performance.now() }),
      });
      const seconds = (performance.now() - startedAt) / 1000;
      setState({ status: 'verifying' });
      const report = await verifyExport(project, blob, size);
      setState({ status: 'done', blob, url: URL.createObjectURL(blob), filename: `${safeName(project.title)}.${cap.plan.extension}`, report, seconds });
    } catch (err) {
      if (controller.signal.aborted) setState({ status: 'cancelled' });
      else setState({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      abortRef.current = null;
    }
  };

  const running = state.status === 'running' || state.status === 'verifying';
  const pct = state.status === 'running' ? state.frame / project.durationFrames : 0;
  const eta = state.status === 'running' && state.frame > 30 ? ((state.now - state.startedAt) / state.frame) * (project.durationFrames - state.frame) / 1000 : null;

  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-labelledby="export-title" onClick={(e) => e.target === e.currentTarget && !running && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <h2 id="export-title">تصدير الفيديو</h2>
          <button type="button" className="ghost" onClick={onClose} disabled={running} aria-label="إغلاق">✕</button>
        </div>

        {errors.length > 0 && <div className="alert error">خطأ في توقيت المشروع: {errors.join('، ')}</div>}

        <label className="label">الجودة</label>
        <div className="seg">
          <button type="button" className={quality === 'sd' ? 'active' : ''} onClick={() => setQuality('sd')} disabled={running}>
            عادية {n(`${project.size.width}×${project.size.height}`)} (أسرع)
          </button>
          {(ASPECTS[aspect].hd.width !== project.size.width) && (
            <button type="button" className={quality === 'hd' ? 'active' : ''} onClick={() => setQuality('hd')} disabled={running}>
              عالية {n(`${ASPECTS[aspect].hd.width}×${ASPECTS[aspect].hd.height}`)}
            </button>
          )}
        </div>

        <div className="cap">
          {!cap && <p className="muted">جارٍ فحص قدرات متصفحك…</p>}
          {cap && !cap.supported && <div className="alert error">{cap.reason}</div>}
          {cap?.supported && (
            <p>
              ✅ الصيغة: <b>{cap.plan.container.toUpperCase()}</b>
              {cap.plan.container === 'webm' && <span className="muted"> (متصفحك لا يدعم MP4، وملفات WebM تعمل على يوتيوب وواتساب ومعظم المشغلات)</span>}
              <br />
              {cap.plan.audioCodec ? '🔊 مع الصوت' : '🔇 بدون صوت (متصفحك لا يدعم ترميز الصوت)'}
            </p>
          )}
        </div>

        {state.status !== 'done' && (
          <div className="row">
            <button type="button" className="primary big" onClick={start} disabled={!cap?.supported || running || errors.length > 0}>
              🎬 ابدأ التصدير ({localizeDigits(`${Math.floor(Math.round(project.durationFrames / project.fps) / 60)}:${String(Math.round(project.durationFrames / project.fps) % 60).padStart(2, '0')}`, styleOf(project).digits)} دقيقة)
            </button>
            {state.status === 'running' && (
              <button type="button" onClick={() => abortRef.current?.abort()}>
                إلغاء
              </button>
            )}
          </div>
        )}

        {state.status === 'running' && (
          <div className="progress">
            <div className="bar">
              <div style={{ width: `${pct * 100}%` }} />
            </div>
            <span>
              {n(`${Math.round(pct * 100)}%`)}
              {eta !== null && ` · ${n(`متبقٍ ~${Math.ceil(eta)} ث`)}`}
            </span>
            <p className="muted small">يُصنع الفيديو داخل جهازك. أبقِ هذه الصفحة مفتوحة حتى ينتهي.</p>
          </div>
        )}
        {state.status === 'verifying' && <p>جارٍ التحقق من الملف الناتج…</p>}
        {state.status === 'cancelled' && <div className="alert">أُلغي التصدير.</div>}
        {state.status === 'error' && <div className="alert error">تعذّر التصدير: {state.message}</div>}

        {state.status === 'done' && (
          <div className="result">
            <video src={state.url} controls playsInline className={aspect} />
            <div className={`alert ${state.report.ok ? 'ok' : 'error'}`}>
              {state.report.ok ? `🎉 جاهز! ${n(`${(state.report.sizeBytes / 1048576).toFixed(1)} ميجابايت`)}، المدة ${n('2:00')} دقيقة.` : '⚠️ الملف لم يطابق المواصفات كاملة:'}
              {state.report.problems.length > 0 && <ul>{state.report.problems.map((p) => <li key={p}>{p}</li>)}</ul>}
            </div>
            <div className="row">
              <button type="button" className="primary big" onClick={() => downloadBlob(state.blob, state.filename)}>
                ⬇ تنزيل الفيديو
              </button>
              <button type="button" onClick={() => setState({ status: 'idle' })}>تصدير مرة أخرى</button>
            </div>
            <details>
              <summary>تفاصيل تقنية</summary>
              <pre dir="ltr">
                {JSON.stringify(
                  {
                    ...state.report,
                    encodeSeconds: +state.seconds.toFixed(1),
                    framesPerSecond: +(project.durationFrames / state.seconds).toFixed(1),
                    userAgent: navigator.userAgent,
                  },
                  null,
                  2,
                )}
              </pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
