import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ensureFontLoaded } from '../design/fonts';
import { fullTheme, presetById } from '../design/presets';
import { localizeDigits } from '../design/digits';
import { rebalance, restack, sceneIndexAt, setSceneDuration } from '../domain/timeline';
import { ASPECTS, DEFAULT_IMAGE, LIMITS, aspectOf as aspectOfSize, styleOf, type AspectId, type Project, type ProjectStyle, type Scene, type SceneImage, type Theme } from '../domain/types';
import { PreviewAudio } from '../engine/audio/player';
import { decodeAudioFile, fitAudio, renderMusic } from '../engine/audio/music';
import { cuesKey, renderSoundtrack } from '../engine/audio/sfx';
import { detectExportPlan } from '../engine/export/capabilities';
import { generateProject, nextSceneId } from '../engine/planner';
import type { AssistantAction, AssistantContext } from '../assistant/types';
import { clearTextCache } from '../engine/renderer/textLayout';
import { addImageFile, loadAssets, onAssetsChanged, projectAssetIds } from '../storage/assets';
import { downloadBlob, loadLocal, projectFileBlob, readProjectFile, saveLocal } from '../storage/projectJson';
import { Assistant } from './components/Assistant';
import { ExportDialog } from './components/ExportDialog';
import { Inspector } from './components/Inspector';
import { Preview } from './components/Preview';
import { Sidebar } from './components/Sidebar';
import { Timeline } from './components/Timeline';
import { EXAMPLES } from './examples';
import { ThemeToggle, useUiTheme } from './theme';
import { useHistory } from './useHistory';

function initialState(): { project: Project; description: string } {
  const saved = loadLocal();
  if (saved) return saved;
  const description = EXAMPLES[0].text;
  return { project: generateProject(description, { aspect: 'landscape', style: {} }).project, description };
}

export function App() {
  const init = useMemo(initialState, []);
  const history = useHistory<Project>(init.project);
  const project = history.value;
  const setProject = history.set;
  const [description, setDescription] = useState(init.description);
  const [selected, setSelected] = useState(0);
  // Start on a frame where the opening title is already visible.
  const [frame, setFrame] = useState(() => Math.min(75, init.project.scenes[0].durationFrames - 1));
  const [playing, setPlaying] = useState(false);
  const [fontReady, setFontReady] = useState<string | null>(null);
  const [renderKey, setRenderKey] = useState(0);
  const [notice, setNotice] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [uiTheme, setUiTheme] = useUiTheme();
  const [exportFormat, setExportFormat] = useState<AssistantContext['exportFormat']>('unknown');
  useEffect(() => {
    detectExportPlan(project.size).then((r) => setExportFormat(r.supported ? r.plan.container : 'none')).catch(() => setExportFormat('unknown'));
    // Capability depends only on the browser; checking once at the starting size is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [customAudio, setCustomAudio] = useState<{ name: string; buffer: AudioBuffer } | null>(null);
  const musicCache = useRef(new Map<string, Promise<AudioBuffer | null>>());
  const player = useRef(new PreviewAudio());
  const fileInput = useRef<HTMLInputElement>(null);
  const style = styleOf(project);
  const ready = fontReady === style.font;

  // Load the chosen font before drawing; cached layouts are measured again afterwards.
  useEffect(() => {
    let alive = true;
    ensureFontLoaded(style.font).then(() => {
      if (!alive) return;
      clearTextCache();
      setFontReady(style.font);
      setRenderKey((k) => k + 1);
    });
    return () => {
      alive = false;
    };
  }, [style.font]);

  // Pictures live in IndexedDB; load the ones this project uses and redraw when they arrive.
  useEffect(() => onAssetsChanged(() => setRenderKey((k) => k + 1)), []);
  const assetKey = projectAssetIds(project).join(',');
  useEffect(() => {
    if (assetKey) void loadAssets(assetKey.split(','));
  }, [assetKey]);

  useEffect(() => {
    const id = setTimeout(() => saveLocal(project, description), 400);
    return () => clearTimeout(id);
  }, [project, description]);

  useEffect(() => {
    if (selected >= project.scenes.length) setSelected(project.scenes.length - 1);
  }, [project.scenes.length, selected]);

  const musicFor = useCallback((id: ProjectStyle['music']) => {
    let p = musicCache.current.get(id);
    if (!p) {
      p = renderMusic(id).catch(() => null);
      musicCache.current.set(id, p);
    }
    return p;
  }, []);

  // Sound effects depend only on scene timing and item counts, not on wording, so typing
  // does not re-render the soundtrack.
  const projectRef = useRef(project);
  projectRef.current = project;
  const sfxKey = useMemo(() => (style.sfx ? cuesKey(project) : 'off'), [project, style.sfx]);
  const soundtrack = useRef<{ key: string; promise: Promise<AudioBuffer | null> } | null>(null);

  const getAudio = useCallback(async (): Promise<AudioBuffer | null> => {
    // Music (or none) + optional narration file + optional effects, mixed together.
    const music = await musicFor(style.music);
    const voice = customAudio?.buffer ?? null;
    if (!style.sfx && !voice) return music;
    const key = `${sfxKey}|${style.music}|${customAudio ? `voice:${customAudio.name}:${customAudio.buffer.length}` : ''}`;
    if (soundtrack.current?.key !== key) {
      soundtrack.current = { key, promise: renderSoundtrack(projectRef.current, music, { sfx: style.sfx, voice }).catch(() => voice ?? music) };
    }
    return soundtrack.current.promise;
  }, [customAudio, style.music, style.sfx, sfxKey, musicFor]);

  // Playback loop: advances frames by wall-clock time; audio starts from the same position.
  useEffect(() => {
    if (!playing) {
      player.current.stop();
      return;
    }
    let raf = 0;
    let alive = true;
    const startFrame = frame >= project.durationFrames - 1 ? 0 : frame;
    const t0 = performance.now();
    getAudio().then((buf) => alive && player.current.play(buf, startFrame / project.fps));
    const tick = (now: number) => {
      const f = startFrame + Math.floor(((now - t0) / 1000) * project.fps);
      if (f >= project.durationFrames) {
        setFrame(project.durationFrames - 1);
        setPlaying(false);
        return;
      }
      setFrame(f);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      player.current.stop();
    };
    // Restart only when play state or audio source changes, not on every frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, getAudio]);

  const seek = (f: number) => {
    setPlaying(false);
    setFrame(f);
    const i = sceneIndexAt(project, f);
    if (i >= 0) setSelected(i);
  };

  const selectScene = (i: number) => {
    setPlaying(false);
    setSelected(i);
    const s = project.scenes[i];
    setFrame(s.startFrame + Math.min(s.durationFrames - 1, Math.floor(s.durationFrames * 0.6)));
  };

  const generate = () => {
    const text = description.trim();
    if (!text) {
      setNotice({ kind: 'error', text: 'اكتب وصفًا للفيديو أولًا.' });
      return;
    }
    const aspect = (Object.keys(ASPECTS) as AspectId[]).find((a) => ASPECTS[a].width === project.size.width && ASPECTS[a].height === project.size.height) ?? 'landscape';
    const { project: next, usedPlaceholders } = generateProject(text, { aspect, style });
    setProject({ ...next, theme: project.theme });
    setSelected(0);
    setFrame(0);
    setPlaying(true);
    setNotice(
      usedPlaceholders
        ? { kind: 'info', text: 'الوصف قصير، فأضفنا مشاهد إرشادية بين [قوسين]. عدّل نصوصها من لوحة المشهد، أو أضف تفاصيل وأرقامًا للوصف وأعد الإنشاء.' }
        : { kind: 'info', text: `تم إنشاء ${localizeDigits(String(next.scenes.length), style.digits)} مشاهد. اضغط أي مشهد لتعديله، ويمكنك التراجع بـ Ctrl+Z.` },
    );
  };

  const updateScene = (patch: Partial<Scene>) =>
    setProject((p) => ({ ...p, scenes: p.scenes.map((s, i) => (i === selected ? { ...s, ...patch } : s)) }), `scene-${selected}-${Object.keys(patch).join()}`);

  const moveScene = (delta: -1 | 1) => {
    const j = selected + delta;
    setProject((p) => {
      const scenes = [...p.scenes];
      [scenes[selected], scenes[j]] = [scenes[j], scenes[selected]];
      return { ...p, scenes: restack(scenes) };
    });
    setSelected(j);
  };

  const duplicateScene = () => {
    setProject((p) => {
      const copy = { ...p.scenes[selected], id: nextSceneId(p.scenes), items: [...p.scenes[selected].items] };
      const scenes = [...p.scenes.slice(0, selected + 1), copy, ...p.scenes.slice(selected + 1)];
      return { ...p, scenes: rebalance(scenes) };
    });
    setSelected(selected + 1);
  };

  const deleteScene = () => {
    setProject((p) => ({ ...p, scenes: rebalance(p.scenes.filter((_, i) => i !== selected)) }));
    setSelected(Math.max(0, selected - 1));
  };

  const addScene = () => {
    if (project.scenes.length >= LIMITS.scenes) return;
    const at = Math.min(selected + 1, project.scenes.length);
    setProject((p) => {
      const scene: Scene = { id: nextSceneId(p.scenes), kind: 'summary', startFrame: 0, durationFrames: 300, title: 'عنوان المشهد', items: ['معلومة أولى', 'معلومة ثانية'], icon: 'lightbulb' };
      return { ...p, scenes: rebalance([...p.scenes.slice(0, at), scene, ...p.scenes.slice(at)]) };
    });
    setSelected(at);
  };

  const onImageFile = async (file: File) => {
    try {
      const assetId = await addImageFile(file);
      const portrait = project.size.height > project.size.width;
      const base: Omit<SceneImage, 'assetId'> = portrait ? { ...DEFAULT_IMAGE, x: 0.5, y: 0.74, scale: 0.72 } : DEFAULT_IMAGE;
      setProject((p) => ({
        ...p,
        scenes: p.scenes.map((sc, i) => (i === selected ? { ...sc, image: { ...base, ...sc.image, assetId } } : sc)),
      }));
      setNotice({ kind: 'info', text: 'أُضيفت الصورة. حرّكها بالسحب في المعاينة أو من لوحة المشهد.' });
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof Error ? e.message : 'تعذّر قراءة الصورة.' });
    }
  };

  const updateImage = (patch: Partial<SceneImage> | null, coalesce?: string) =>
    setProject(
      (p) => ({
        ...p,
        scenes: p.scenes.map((sc, i) => {
          if (i !== selected || !sc.image) return sc;
          if (patch === null) {
            const { image: _removed, ...rest } = sc;
            return rest;
          }
          return { ...sc, image: { ...sc.image, ...patch } };
        }),
      }),
      coalesce ?? (patch ? `image-${selected}-${Object.keys(patch).join()}` : undefined),
    );

  const onAssistantAction = (a: AssistantAction) => {
    if (a.type === 'export') {
      setPlaying(false);
      setExportOpen(true);
    } else if (a.type === 'generate') generate();
    else if (a.type === 'useIdea') {
      setDescription(a.text);
      setNotice({ kind: 'info', text: 'وُضعت الفكرة في خانة «اكتب فكرتك». استبدل ما بين [الأقواس] والأصفار بمعلوماتك، ثم اضغط «أنشئ الفيديو من الوصف».' });
      document.querySelector<HTMLTextAreaElement>('.sidebar textarea')?.focus();
    } else if (a.type === 'link') window.open(a.href, '_blank', 'noopener');
  };

  const setAspect = (a: AspectId) => setProject((p) => ({ ...p, size: { width: ASPECTS[a].width, height: ASPECTS[a].height } }));

  const setStyle = (patch: Partial<ProjectStyle>, theme?: Theme) =>
    setProject((p) => ({ ...p, style: { ...styleOf(p), ...patch }, theme: theme ? fullTheme(theme) : p.theme }));

  const setTheme = (patch: Partial<Theme>) =>
    setProject((p) => ({ ...p, theme: { ...fullTheme(p.theme), ...patch } }), `theme-${Object.keys(patch).join()}`);

  const onAudioFile = async (file: File | null) => {
    if (!file) {
      setCustomAudio(null);
      return;
    }
    if (file.size > 60 * 1024 * 1024) {
      setNotice({ kind: 'error', text: 'الملف الصوتي أكبر من 60 ميجابايت.' });
      return;
    }
    try {
      const buffer = await fitAudio(await decodeAudioFile(file), 120, 48000, false);
      setCustomAudio({ name: file.name, buffer });
      setNotice({ kind: 'info', text: 'أُضيف تعليقك الصوتي، وستُخفض الموسيقى تحته تلقائيًا.' });
    } catch {
      setNotice({ kind: 'error', text: 'تعذّر قراءة الملف الصوتي. جرّب MP3 أو WAV أو M4A.' });
    }
  };

  const importProject = async (file: File) => {
    try {
      const p = await readProjectFile(file);
      setProject(p);
      setSelected(0);
      setFrame(0);
      setNotice({ kind: 'info', text: 'تم فتح المشروع.' });
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof Error ? e.message : 'تعذّر فتح الملف.' });
    }
  };

  const newProject = () => {
    if (!window.confirm('بدء مشروع جديد؟ يمكنك التراجع بعدها.')) return;
    setDescription('');
    const { project: p } = generateProject('عنوان الفيديو', { aspect: 'landscape', style: { ...style } });
    setProject({ ...p, theme: fullTheme(presetById(style.preset).theme) });
    setSelected(0);
    setFrame(0);
  };

  // Keyboard: space = play/pause, Ctrl+Z / Ctrl+Y = undo/redo (outside text fields).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && !typing && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) history.redo();
        else history.undo();
      } else if ((e.ctrlKey || e.metaKey) && !typing && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        history.redo();
      } else if (e.code === 'Space' && !typing && el.tagName !== 'BUTTON') {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [history]);

  return (
    <div className="app">
      <div className="ticker">
        <span className="ticker-label">جديد</span>
        <span className="ticker-text">حوّل فكرتك إلى فيديو إنفوجرافيك عربي متحرك مدته دقيقتان… مجانًا وبدون تسجيل</span>
        <a className="ticker-link" href="https://www.kamirtyai.com/">الموقع الرئيسي</a>
        <ThemeToggle theme={uiTheme} onToggle={() => setUiTheme((t) => (t === 'dark' ? 'light' : 'dark'))} />
      </div>
      <header className="topbar">
        <a className="brand" href="./" aria-label="مولّد الإنفوجرافيك من KamirtyAI">
          <img className="brand-logo" src="/brand/kamirty-logo.png" alt="Kamirty.AI" width={198} height={122} />
          <span className="brand-name">
            <b>مولّد الإنفوجرافيك</b>
            <small>Kamirty Motion</small>
          </span>
        </a>
        <input
          className="title-input"
          value={project.title}
          maxLength={140}
          onChange={(e) => setProject((p) => ({ ...p, title: e.target.value }), 'title')}
          aria-label="اسم المشروع"
        />
        <nav className="actions">
          <button type="button" onClick={history.undo} disabled={!history.canUndo} title="تراجع (Ctrl+Z)" aria-label="تراجع">↶</button>
          <button type="button" onClick={history.redo} disabled={!history.canRedo} title="إعادة (Ctrl+Y)" aria-label="إعادة">↷</button>
          <button type="button" onClick={newProject}>جديد</button>
          <button type="button" onClick={() => fileInput.current?.click()}>فتح</button>
          <button type="button" onClick={() => void projectFileBlob(project).then((b) => downloadBlob(b, 'kamirty-motion-project.json'))}>حفظ</button>
          <button type="button" className="primary" onClick={() => { setPlaying(false); setExportOpen(true); }}>
            ⬇ تصدير الفيديو
          </button>
        </nav>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importProject(f);
            e.target.value = '';
          }}
        />
      </header>

      {notice && (
        <div className={`notice ${notice.kind}`} role="status">
          <span>{notice.text}</span>
          <button type="button" className="ghost" onClick={() => setNotice(null)} aria-label="إغلاق">✕</button>
        </div>
      )}

      <main className="workspace">
        <Sidebar
          description={description}
          onDescription={setDescription}
          onGenerate={generate}
          project={project}
          onAspect={setAspect}
          onStyle={setStyle}
          onTheme={setTheme}
          customAudioName={customAudio?.name ?? null}
          onAudioFile={(f) => void onAudioFile(f)}
        />
        <div className="center">
          <Preview
            project={project}
            frame={frame}
            playing={playing}
            ready={ready}
            onFrame={seek}
            onTogglePlay={() => setPlaying((p) => !p)}
            renderKey={renderKey}
            selected={selected}
            onImageMove={(x, y) => updateImage({ x, y }, `image-drag-${selected}`)}
          />
          <Timeline project={project} selected={selected} currentFrame={frame} onSelect={selectScene} onAdd={addScene} renderKey={renderKey} />
        </div>
        <Inspector
          project={project}
          index={selected}
          onChange={updateScene}
          onDuration={(sec) => setProject((p) => ({ ...p, scenes: setSceneDuration(p.scenes, selected, sec * p.fps) }), `dur-${selected}`)}
          onMove={moveScene}
          onDuplicate={duplicateScene}
          onDelete={deleteScene}
          onImageFile={(f) => void onImageFile(f)}
          onImage={(patch) => updateImage(patch)}
        />
      </main>

      <footer className="footer">
        <div className="footer-brand">
          <img className="brand-logo" src="/brand/kamirty-logo.png" alt="Kamirty.AI" width={198} height={122} />
          <p className="slogan">«نحن نقدم الخبرة… وأنت تصنع الإبداع!»</p>
        </div>
        <p className="footer-note">🔒 كل شيء يعمل داخل متصفحك: لا نرفع نصوصك أو ملفاتك أو فيديوهاتك إلى أي خادم. مجاني بالكامل، والفيديو ملكك دون أي شعار.</p>
        <nav className="footer-links">
          <a href="https://www.kamirtyai.com/">الموقع الرئيسي</a>
          <span aria-hidden="true">·</span>
          <span>KamirtyAI © {new Date().getFullYear()}</span>
        </nav>
      </footer>

      <Assistant
        context={{
          sceneCount: project.scenes.length,
          kinds: project.scenes.map((sc) => sc.kind),
          aspect: aspectOfSize(project.size),
          music: style.music,
          sfx: style.sfx,
          hasImages: project.scenes.some((sc) => !!sc.image),
          exportFormat,
        }}
        onAction={onAssistantAction}
      />

      {exportOpen && <ExportDialog project={project} getAudio={getAudio} onClose={() => setExportOpen(false)} />}
    </div>
  );
}
