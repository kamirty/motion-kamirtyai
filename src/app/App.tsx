import { useCallback, useEffect, useRef, useState } from 'react';
import { sampleProject } from '../domain/sampleProject';
import { validateTimeline } from '../domain/timeline';
import { detectExportPlan, type DetectResult } from '../engine/export/capabilities';
import { ExportCancelledError, exportVideo } from '../engine/export/exportVideo';
import { verifyExport, type VerifyReport } from '../engine/export/verify';
import { FONT_FAMILY } from '../engine/renderer/context';
import { renderFrame } from '../engine/renderer/renderFrame';
import { downloadBlob, projectToJson } from '../storage/projectJson';

const project = sampleProject;
const timelineErrors = validateTimeline(project);

type ExportState =
  | { status: 'idle' }
  | { status: 'running'; frame: number; startedAt: number }
  | { status: 'verifying' }
  | { status: 'done'; blob: Blob; filename: string; report: VerifyReport; seconds: number }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

const formatTime = (frame: number) => {
  const s = Math.floor(frame / project.fps);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fontsReady, setFontsReady] = useState(false);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [capability, setCapability] = useState<DetectResult | null>(null);
  const [exportState, setExportState] = useState<ExportState>({ status: 'idle' });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Rendering before the Arabic font loads would bake a fallback font into frames.
    Promise.all([
      document.fonts.load(`400 32px ${FONT_FAMILY}`, 'عربي'),
      document.fonts.load(`700 32px ${FONT_FAMILY}`, 'عربي'),
    ]).finally(() => setFontsReady(true));
    detectExportPlan(project.size).then(setCapability);
  }, []);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && fontsReady) renderFrame(project, frame, ctx);
  }, [frame, fontsReady]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const tick = (now: number) => {
      acc += now - last;
      last = now;
      const advance = Math.floor(acc / (1000 / project.fps));
      if (advance > 0) {
        acc -= advance * (1000 / project.fps);
        setFrame((f) => {
          const next = f + advance;
          if (next >= project.durationFrames) {
            setPlaying(false);
            return project.durationFrames - 1;
          }
          return next;
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const startExport = useCallback(async () => {
    if (!capability?.supported) return;
    const { plan } = capability;
    const controller = new AbortController();
    abortRef.current = controller;
    setPlaying(false);
    const startedAt = performance.now();
    setExportState({ status: 'running', frame: 0, startedAt });
    try {
      const blob = await exportVideo(project, plan, {
        signal: controller.signal,
        onProgress: (p) => setExportState({ status: 'running', frame: p.frame, startedAt }),
      });
      const seconds = (performance.now() - startedAt) / 1000;
      setExportState({ status: 'verifying' });
      const report = await verifyExport(project, blob);
      setExportState({ status: 'done', blob, filename: `kamirty-motion.${plan.extension}`, report, seconds });
    } catch (err) {
      if (err instanceof ExportCancelledError) setExportState({ status: 'cancelled' });
      else setExportState({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      abortRef.current = null;
    }
  }, [capability]);

  const exporting = exportState.status === 'running' || exportState.status === 'verifying';

  return (
    <div className="page">
      <header className="top">
        <h1>مولّد الإنفوجرافيك</h1>
        <a href="https://www.kamirtyai.com/">العودة إلى KamirtyAI</a>
      </header>
      <p className="badge">نسخة تجريبية لمحرك الفيديو (Milestone 0): مشروع ثابت من ثلاثة مشاهد، مدته 120 ثانية.</p>

      {timelineErrors.length > 0 && (
        <div className="alert error">خطأ في الخط الزمني: {timelineErrors.join('، ')}</div>
      )}

      <section className="preview">
        <canvas ref={canvasRef} width={project.size.width} height={project.size.height} aria-label="معاينة الفيديو" />
        <div className="controls">
          <button onClick={() => setPlaying((p) => !p)} disabled={!fontsReady || exporting}>
            {playing ? 'إيقاف' : 'تشغيل'}
          </button>
          <input
            type="range"
            min={0}
            max={project.durationFrames - 1}
            value={frame}
            onChange={(e) => setFrame(Number(e.target.value))}
            aria-label="موضع المعاينة"
            disabled={exporting}
          />
          <span className="time" dir="ltr">
            {formatTime(frame)} / {formatTime(project.durationFrames)} · {frame + 1}/{project.durationFrames}
          </span>
        </div>
        <div className="scenes">
          {project.scenes.map((s) => (
            <button key={s.id} onClick={() => setFrame(s.startFrame)} disabled={exporting}>
              {s.title}
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>التصدير</h2>
        {!capability && <p>جارٍ فحص قدرات المتصفح…</p>}
        {capability && !capability.supported && <div className="alert error">{capability.reason}</div>}
        {capability?.supported && (
          <p>
            الصيغة المتاحة: <b dir="ltr">{capability.plan.container.toUpperCase()} / {capability.plan.codec}</b>
            {capability.plan.container === 'webm' && ' (MP4 غير مدعوم في هذا المتصفح، سيُصدَّر WebM)'}
          </p>
        )}
        <div className="row">
          <button className="primary" onClick={startExport} disabled={!capability?.supported || !fontsReady || exporting || timelineErrors.length > 0}>
            تصدير فيديو 120 ثانية ({project.size.width}×{project.size.height})
          </button>
          {exportState.status === 'running' && <button onClick={() => abortRef.current?.abort()}>إلغاء</button>}
          <button onClick={() => downloadBlob(new Blob([projectToJson(project)], { type: 'application/json' }), 'kamirty-motion-project.json')}>
            تنزيل ملف المشروع (JSON)
          </button>
        </div>

        {exportState.status === 'running' && (
          <div className="progress">
            <progress max={project.durationFrames} value={exportState.frame} />
            <span dir="ltr">
              {exportState.frame}/{project.durationFrames} · {Math.round((exportState.frame / project.durationFrames) * 100)}%
            </span>
          </div>
        )}
        {exportState.status === 'verifying' && <p>جارٍ التحقق من الملف الناتج…</p>}
        {exportState.status === 'cancelled' && <div className="alert">أُلغي التصدير.</div>}
        {exportState.status === 'error' && <div className="alert error">فشل التصدير: {exportState.message}</div>}
        {exportState.status === 'done' && (
          <div className={`alert ${exportState.report.ok ? 'ok' : 'error'}`}>
            <p>{exportState.report.ok ? '✅ اجتاز الملف التحقق.' : '⚠️ الملف لم يطابق المواصفات:'}</p>
            {exportState.report.problems.length > 0 && (
              <ul>{exportState.report.problems.map((p) => <li key={p}>{p}</li>)}</ul>
            )}
            <button className="primary" onClick={() => downloadBlob(exportState.blob, exportState.filename)}>
              تنزيل الفيديو
            </button>
          </div>
        )}
      </section>

      {exportState.status === 'done' && (
        <section className="panel">
          <h2>تشخيص التصدير</h2>
          <pre dir="ltr">
            {JSON.stringify(
              {
                ...exportState.report,
                sizeMB: +(exportState.report.sizeBytes / 1_048_576).toFixed(2),
                encodeSeconds: +exportState.seconds.toFixed(1),
                framesPerSecond: +(project.durationFrames / exportState.seconds).toFixed(1),
                userAgent: navigator.userAgent,
              },
              null,
              2,
            )}
          </pre>
        </section>
      )}
    </div>
  );
}
