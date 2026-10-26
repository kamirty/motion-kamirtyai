import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ensureFontLoaded } from '../design/fonts';
import { fullTheme, presetById } from '../design/presets';
import { localizeDigits } from '../design/digits';
import { maxSceneFrames, rebalance, sceneIndexAt, setSceneDuration, totalFrames, withScenes } from '../domain/timeline';
import { ASPECTS, DEFAULT_IMAGE, FPS, LIMITS, aspectOf as aspectOfSize, styleOf, type AspectId, type Project, type ProjectStyle, type Scene, type SceneImage, type SceneKind, type Theme } from '../domain/types';
import { PreviewAudio } from '../engine/audio/player';
import { decodeAudioFile, fitAudio, renderMusic } from '../engine/audio/music';
import { cuesKey, renderSoundtrack, voiceClips } from '../engine/audio/sfx';
import { revealSlots } from '../engine/timing';
import { detectExportPlan } from '../engine/export/capabilities';
import { generateProject, nextSceneId } from '../engine/planner';
import { KIND_STARTERS } from '../engine/kindSamples';
import { KIND_ICONS } from '../design/icons';
import type { AssistantAction, AssistantContext } from '../assistant/types';
import { clearTextCache } from '../engine/renderer/textLayout';
import { addImageFile, loadAssets, onAssetsChanged, projectAssetIds } from '../storage/assets';
import { addVoiceBlob, canRecordVoice, getVoiceBuffer, loadVoices, projectVoiceIds } from '../storage/voices';
import { downloadBlob, loadLocal, projectFileBlob, readProjectFile, saveLocal } from '../storage/projectJson';
import { Assistant } from './components/Assistant';
import { ExportDialog } from './components/ExportDialog';
import { GuideWizard } from './components/GuideWizard';
import { KindGallery } from './components/KindGallery';
import { VoiceRecorder } from './components/VoiceRecorder';
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
  const [wizardOpen, setWizardOpen] = useState(false);
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

  // Scene recordings live in IndexedDB too; decode the ones this project uses.
  const voiceKey = projectVoiceIds(project).join(',');
  const [voicesLoaded, setVoicesLoaded] = useState(0);
  const [missingVoices, setMissingVoices] = useState<string[]>([]);
  useEffect(() => {
    if (!voiceKey) return setMissingVoices([]);
    let alive = true;
    void loadVoices(voiceKey.split(',')).then((missing) => {
      if (!alive) return;
      setMissingVoices(missing);
      setVoicesLoaded((n) => n + 1);
    });
    return () => {
      alive = false;
    };
  }, [voiceKey]);

  useEffect(() => {
    const id = setTimeout(() => saveLocal(project, description), 400);
    return () => clearTimeout(id);
  }, [project, description]);

  useEffect(() => {
    if (selected >= project.scenes.length) setSelected(project.scenes.length - 1);
  }, [project.scenes.length, selected]);

  // Music is rendered to the video length (whole seconds), so its fade-out lands on the last scene.
  const videoSeconds = Math.ceil(project.durationFrames / project.fps);
  const musicFor = useCallback((id: ProjectStyle['music']) => {
    const key = `${id}|${videoSeconds}`;
    let p = musicCache.current.get(key);
    if (!p) {
      p = renderMusic(id, videoSeconds).catch(() => null);
      if (musicCache.current.size >= 6) musicCache.current.clear(); // each buffer is tens of MB
      musicCache.current.set(key, p);
    }
    return p;
  }, [videoSeconds]);

  // Sound effects depend only on scene timing and item counts, not on wording, so typing
  // does not re-render the soundtrack.
  const projectRef = useRef(project);
  projectRef.current = project;
  // While tap-syncing, the soundtrack is frozen so each tap does not restart playback.
  const [sync, setSync] = useState<{ scene: number; next: number } | null>(null);
  const lastSfxKey = useRef('off');
  const sfxKey = useMemo(() => {
    if (sync) return lastSfxKey.current; // keep the soundtrack already rendered
    return (lastSfxKey.current = style.sfx ? cuesKey(project) : 'off');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sync ? 'syncing' : project, style.sfx]);
  const soundtrack = useRef<{ key: string; promise: Promise<AudioBuffer | null> } | null>(null);

  // Scene recordings follow their scenes, so the mix depends on where each scene starts.
  const clipsKey = useMemo(
    () => voiceClips(project).filter((c) => getVoiceBuffer(c.assetId)).map((c) => `${c.assetId}@${c.start}+${c.length}`).join(','),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project, voicesLoaded],
  );
  const getAudio = useCallback(async (): Promise<AudioBuffer | null> => {
    // Music (or none) + optional narration file + scene recordings + optional effects, mixed together.
    const music = await musicFor(style.music);
    const voice = customAudio?.buffer ?? null;
    if (!style.sfx && !voice && !clipsKey) return music;
    const key = `${sfxKey}|${style.music}|${customAudio ? `voice:${customAudio.name}:${customAudio.buffer.length}` : ''}|${clipsKey}`;
    if (soundtrack.current?.key !== key) {
      soundtrack.current = {
        key,
        promise: renderSoundtrack(projectRef.current, music, { sfx: style.sfx, voice, sceneVoices: getVoiceBuffer }).catch(() => voice ?? music),
      };
    }
    return soundtrack.current.promise;
  }, [customAudio, style.music, style.sfx, sfxKey, clipsKey, musicFor]);

  // Render the soundtrack in the background after edits settle, so Play starts at once.
  const [preparing, setPreparing] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => void getAudio(), 1200);
    return () => window.clearTimeout(t);
  }, [getAudio]);

  // Playback loop: the audio clock is the master — each frame is read from where the sound is,
  // and playback starts only after the soundtrack is ready, so picture and sound cannot drift.
  useEffect(() => {
    if (!playing) {
      player.current.stop();
      setPreparing(false);
      return;
    }
    let raf = 0;
    let alive = true;
    const startFrame = frame >= project.durationFrames - 1 ? 0 : frame;
    const tick = () => {
      if (!alive) return;
      const f = Math.floor(player.current.position() * project.fps);
      if (f >= project.durationFrames) {
        setFrame(project.durationFrames - 1);
        setPlaying(false);
        return;
      }
      setFrame(f);
      raf = requestAnimationFrame(tick);
    };
    setPreparing(true);
    void getAudio()
      .catch(() => null)
      .then((x) => {
        if (alive) setPreparing(false);
        return x;
      })
      .then((buf) => (alive ? player.current.play(buf, startFrame / project.fps) : undefined))
      .then(() => {
        if (alive) raf = requestAnimationFrame(tick);
      });
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

  // Tap-to-sync: play the scene with its audio; each tap sets the next element's reveal time.
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const startSync = () => {
    const s = project.scenes[selected];
    const slots = revealSlots({ ...s, pace: style.pace });
    if (!slots.length) return;
    // Until tapped, elements wait near the end of the scene.
    updateScene({ reveals: slots.map(() => s.durationFrames - 12) });
    setSync({ scene: selected, next: 0 });
    setFrame(s.startFrame);
    setPlaying(true);
  };
  const stopSync = () => {
    setSync(null);
    setPlaying(false);
  };
  const tapSync = () => {
    if (!sync) return;
    const s = project.scenes[sync.scene];
    const slots = revealSlots({ ...s, pace: style.pace });
    const slot = slots[sync.next];
    if (!slot) return stopSync();
    const local = Math.max(0, frameRef.current - s.startFrame);
    const reveals = [...(s.reveals ?? slots.map(() => s.durationFrames - 12))];
    reveals[slot.index] = local;
    // Later elements cannot appear before this one.
    for (const later of slots.slice(sync.next + 1)) reveals[later.index] = Math.max(reveals[later.index], local);
    setProject((p) => ({ ...p, scenes: p.scenes.map((x, i) => (i === sync.scene ? { ...x, reveals } : x)) }), `sync-${sync.scene}`);
    if (sync.next + 1 >= slots.length) stopSync();
    else setSync({ ...sync, next: sync.next + 1 });
  };
  const tapRef = useRef(tapSync);
  tapRef.current = tapSync;
  useEffect(() => {
    // Leaving the scene (or stopping playback) ends the sync session.
    if (!sync) return;
    const s = project.scenes[sync.scene];
    if (!s || !playing || frame >= s.startFrame + s.durationFrames || selected !== sync.scene) stopSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame, playing, selected, sync]);

  const moveScene = (delta: -1 | 1) => {
    const j = selected + delta;
    setProject((p) => {
      const scenes = [...p.scenes];
      [scenes[selected], scenes[j]] = [scenes[j], scenes[selected]];
      return withScenes(p, scenes);
    });
    setSelected(j);
  };

  // Adding a scene lengthens the video; other scenes keep their lengths. Refused past 10 minutes.
  const roomFor = () => LIMITS.maxTotalFrames - totalFrames(project.scenes);
  const tooLong = () => {
    setNotice({ kind: 'error', text: 'وصل الفيديو إلى الحد الأقصى (10 دقائق). قصّر مشهدًا أو احذفه أولًا.' });
  };
  const insertScene = (at: number, scene: Scene) => {
    const room = roomFor();
    if (project.scenes.length >= LIMITS.scenes) return;
    if (room < LIMITS.minSceneFrames) return tooLong();
    const fitted = { ...scene, durationFrames: Math.min(scene.durationFrames, room) };
    setProject((p) => withScenes(p, [...p.scenes.slice(0, at), fitted, ...p.scenes.slice(at)]));
    setSelected(at);
    // Show the new scene in the preview.
    setPlaying(false);
    setFrame(totalFrames(project.scenes.slice(0, at)) + Math.floor(fitted.durationFrames * 0.6));
  };

  const duplicateScene = () => {
    const src = project.scenes[selected];
    insertScene(selected + 1, { ...src, id: nextSceneId(project.scenes), items: [...src.items] });
  };

  const deleteScene = () => {
    setProject((p) => withScenes(p, p.scenes.filter((_, i) => i !== selected)));
    setSelected(Math.max(0, selected - 1));
  };

  // «＋ مشهد» opens the scene-kind gallery; the new scene starts with neutral content in that kind's format.
  const [gallery, setGallery] = useState<'change' | 'add' | null>(null);
  const addScene = (kind: SceneKind) => {
    const at = Math.min(selected + 1, project.scenes.length);
    const starter = KIND_STARTERS[kind];
    insertScene(at, { id: nextSceneId(project.scenes), kind, startFrame: 0, durationFrames: 300, title: starter.title, items: [...starter.items], icon: KIND_ICONS[kind] ?? 'sparkles' });
  };

  // «سجّل التعليق»: the recorder modal works on one scene at a time.
  const [recordFor, setRecordFor] = useState<number | null>(null);
  // A scene fitted to its recording lasts the recording plus a short pause, in whole seconds.
  const voiceFit = (voiceFrames: number) => Math.ceil(voiceFrames / project.fps + 0.4) * project.fps;
  const fitSceneToVoice = (index: number, voiceFrames: number) =>
    setProject((p) => withScenes(p, setSceneDuration(p.scenes, index, voiceFit(voiceFrames))));
  const saveRecording = async (index: number, blob: Blob, fit: boolean, next: boolean) => {
    const { id, buffer } = await addVoiceBlob(blob);
    const frames = Math.min(LIMITS.maxSceneFrames, Math.max(1, Math.round(buffer.duration * project.fps)));
    setProject((p) => {
      const scenes = p.scenes.map((s, i) => (i === index ? { ...s, voice: { assetId: id, durationFrames: frames } } : s));
      return withScenes(p, fit ? setSceneDuration(scenes, index, voiceFit(frames)) : scenes);
    });
    setVoicesLoaded((n) => n + 1);
    if (next && index + 1 < project.scenes.length) {
      setSelected(index + 1);
      setRecordFor(index + 1);
    } else {
      setRecordFor(null);
      setNotice({ kind: 'info', text: 'حُفظ التعليق الصوتي للمشهد. اضغط ▶ في المعاينة لتسمعه مع الموسيقى.' });
    }
  };

  /** Stretches or shrinks all scenes proportionally so the video ends with the narration. */
  const fitToVoice = () => {
    if (!customAudio) return;
    const target = Math.round(customAudio.buffer.duration * project.fps);
    const n = project.scenes.length;
    const clamped = Math.min(LIMITS.maxTotalFrames, Math.max(n * LIMITS.minSceneFrames, target));
    setProject((p) => withScenes(p, rebalance(p.scenes, clamped)));
    setNotice({ kind: 'info', text: 'صارت مدة الفيديو مساوية لمدة التعليق الصوتي، ووُزّعت على المشاهد بالنسبة نفسها.' });
  };

  // Which picture of the selected scene the image controls (and preview drag) act on.
  const [imageSel, setImageSel] = useState(0);
  useEffect(() => setImageSel(0), [selected]);
  const sceneImages = project.scenes[selected]?.images ?? [];
  const activeImage = Math.min(imageSel, Math.max(0, sceneImages.length - 1));

  const setImages = (fn: (imgs: SceneImage[]) => SceneImage[], coalesce?: string) =>
    setProject(
      (p) => ({
        ...p,
        scenes: p.scenes.map((sc, i) => {
          if (i !== selected) return sc;
          const next = fn(sc.images ?? []);
          const { images: _old, ...rest } = sc;
          return next.length ? { ...rest, images: next } : rest;
        }),
      }),
      coalesce,
    );

  /** Adds a new picture (mode 'add') or swaps the active one's pixels (mode 'replace'). */
  const onImageFile = async (file: File, mode: 'add' | 'replace') => {
    if (mode === 'add' && sceneImages.length >= LIMITS.images) {
      setNotice({ kind: 'error', text: `الحد الأقصى ${LIMITS.images} صور في المشهد الواحد.` });
      return;
    }
    try {
      const assetId = await addImageFile(file);
      const portrait = project.size.height > project.size.width;
      const base: Omit<SceneImage, 'assetId'> = portrait ? { ...DEFAULT_IMAGE, x: 0.5, y: 0.74, scale: 0.72 } : DEFAULT_IMAGE;
      // From the second picture on, pictures sit in a 2×2 grid so none hides another.
      const slots = portrait
        ? { scale: 0.42, at: [[0.73, 0.62], [0.27, 0.62], [0.73, 0.84], [0.27, 0.84]] }
        : { scale: 0.2, at: [[0.36, 0.4], [0.14, 0.4], [0.36, 0.76], [0.14, 0.76]] };
      const slot = (k: number) => ({ x: slots.at[k][0], y: slots.at[k][1], scale: slots.scale });
      const untouched = (im: SceneImage) => im.x === base.x && im.y === base.y && im.scale === base.scale;
      if (mode === 'replace' && sceneImages.length) {
        setImages((imgs) => imgs.map((im, j) => (j === activeImage ? { ...im, assetId } : im)));
        setNotice({ kind: 'info', text: 'استُبدلت الصورة مع إبقاء إعداداتها.' });
      } else {
        // Computed inside the update so several files picked at once each get their own slot.
        setImages((imgs) => {
          if (imgs.length >= LIMITS.images) return imgs;
          if (!imgs.length) return [{ ...base, assetId }];
          // The first picture joins the grid too if the visitor has not placed it yet.
          const placed = imgs.map((im, j) => (j === 0 && untouched(im) ? { ...im, ...slot(0) } : im));
          return [...placed, { ...base, ...slot(imgs.length), assetId }];
        });
        setImageSel(LIMITS.images); // clamped to the last picture
        setNotice({ kind: 'info', text: 'أُضيفت الصورة. حرّكها بالسحب في المعاينة أو من لوحة المشهد.' });
      }
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof Error ? e.message : 'تعذّر قراءة الصورة.' });
    }
  };

  /** Patches the active picture; null removes it. */
  const updateImage = (patch: Partial<SceneImage> | null, coalesce?: string, index = activeImage) => {
    if (patch === null) {
      setImages((imgs) => imgs.filter((_, j) => j !== index));
      setImageSel(Math.max(0, index - 1));
      return;
    }
    setImages((imgs) => imgs.map((im, j) => (j === index ? { ...im, ...patch } : im)), coalesce ?? `image-${selected}-${index}-${Object.keys(patch).join()}`);
  };

  /** Moves the active picture one step forward/back in drawing order. */
  const reorderImage = (delta: -1 | 1) => {
    const j = activeImage + delta;
    if (j < 0 || j >= sceneImages.length) return;
    setImages((imgs) => {
      const out = [...imgs];
      [out[activeImage], out[j]] = [out[j], out[activeImage]];
      return out;
    });
    setImageSel(j);
  };

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
      const decoded = await decodeAudioFile(file);
      const buffer = await fitAudio(decoded, Math.min(decoded.duration, LIMITS.maxTotalFrames / FPS), 48000, false);
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

  const syncRef = useRef(sync);
  syncRef.current = sync;
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
      } else if (syncRef.current && (e.code === 'Space' || e.code === 'Enter') && !typing) {
        e.preventDefault();
        tapRef.current();
      } else if (syncRef.current && e.key === 'Escape') {
        setSync(null);
        setPlaying(false);
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
        <span className="ticker-text">حوّل فكرتك إلى فيديو إنفوجرافيك عربي متحرك بالمدة التي تختارها… مجانًا وبدون تسجيل</span>
        <a className="ticker-link" href="https://www.kamirtyai.com/">الموقع الرئيسي</a>
        <ThemeToggle theme={uiTheme} onToggle={() => setUiTheme((t) => (t === 'dark' ? 'light' : 'dark'))} />
      </div>
      <header className="topbar">
        <a className="brand" href="./" aria-label="مولّد موشن إنفوجرافيك من KamirtyAI">
          <img className="brand-logo" src="/brand/kamirty-logo.png" alt="Kamirty.AI" width={198} height={122} />
          <span className="brand-name">
            <b>مولّد موشن إنفوجرافيك</b>
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
          onTeacher={() => setWizardOpen(true)}
          project={project}
          onAspect={setAspect}
          onStyle={setStyle}
          onTheme={setTheme}
          customAudioName={customAudio?.name ?? null}
          onAudioFile={(f) => void onAudioFile(f)}
          voiceSeconds={customAudio ? customAudio.buffer.duration : null}
          onFitToVoice={fitToVoice}
        />
        <div className="center">
          <Preview
            project={project}
            frame={frame}
            playing={playing}
            preparing={preparing}
            ready={ready}
            onFrame={seek}
            onTogglePlay={() => setPlaying((p) => !p)}
            renderKey={renderKey}
            selected={selected}
            activeImage={activeImage}
            onImagePick={setImageSel}
            onImageMove={(k, x, y) => updateImage({ x, y }, `image-drag-${selected}-${k}`, k)}
          />
          <Timeline project={project} selected={selected} currentFrame={frame} onSelect={selectScene} onAdd={() => setGallery('add')} renderKey={renderKey} />
        </div>
        <Inspector
          project={project}
          index={selected}
          onChange={updateScene}
          onChangeKind={() => setGallery('change')}
          canRecord={canRecordVoice()}
          voiceMissing={!!project.scenes[selected]?.voice && missingVoices.includes(project.scenes[selected].voice!.assetId)}
          onRecordVoice={() => {
            setPlaying(false);
            setRecordFor(selected);
          }}
          onFitVoice={() => {
            const v = project.scenes[selected]?.voice;
            if (v) fitSceneToVoice(selected, v.durationFrames);
          }}
          onDuration={(sec) => setProject((p) => withScenes(p, setSceneDuration(p.scenes, selected, sec * p.fps)), `dur-${selected}`)}
          onMove={moveScene}
          onDuplicate={duplicateScene}
          onDelete={deleteScene}
          onImageFile={(f, mode) => void onImageFile(f, mode)}
          onImage={(patch) => updateImage(patch)}
          activeImage={activeImage}
          onImagePick={setImageSel}
          onImageOrder={reorderImage}
          syncNext={sync && sync.scene === selected ? sync.next : null}
          onStartSync={startSync}
          onTap={tapSync}
          onStopSync={stopSync}
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
          hasImages: project.scenes.some((sc) => !!sc.images?.length),
          exportFormat,
        }}
        onAction={onAssistantAction}
      />

      {wizardOpen && (
        <GuideWizard
          digits={style.digits}
          onClose={() => setWizardOpen(false)}
          onCreate={(scenes, title) => {
            setPlaying(false);
            setProject((p) => withScenes({ ...p, title }, scenes));
            setSelected(0);
            setFrame(0);
            setWizardOpen(false);
            setNotice({ kind: 'info', text: 'جاهز! هذا فيديوك. عدّل أي مشهد من لوحة المشهد، ثم صدّره.' });
          }}
        />
      )}
      {recordFor !== null && project.scenes[recordFor] && (
        <VoiceRecorder
          key={recordFor}
          scene={project.scenes[recordFor]}
          index={recordFor}
          total={project.scenes.length}
          fps={project.fps}
          digits={style.digits}
          maxSeconds={Math.floor(maxSceneFrames(project.scenes, recordFor) / project.fps)}
          onSave={(blob, fit, next) => saveRecording(recordFor, blob, fit, next)}
          onClose={() => setRecordFor(null)}
        />
      )}
      {gallery && (
        <KindGallery
          project={project}
          scene={gallery === 'change' ? project.scenes[selected] : undefined}
          renderKey={renderKey}
          onClose={() => setGallery(null)}
          onPick={(kind) => {
            if (gallery === 'add') addScene(kind);
            else if (kind !== project.scenes[selected]?.kind) {
              updateScene({ kind });
              selectScene(selected);
            }
            setGallery(null);
          }}
        />
      )}
      {exportOpen && <ExportDialog project={project} getAudio={getAudio} onClose={() => setExportOpen(false)} />}
    </div>
  );
}
