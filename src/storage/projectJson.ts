import { parseProject } from '../domain/sanitize';
import type { Project } from '../domain/types';
import { exportAssets, importAssets, projectAssetIds } from './assets';

export const projectToJson = (project: Project): string => JSON.stringify(project, null, 2);

/** Project file with its pictures embedded, for "save". */
export async function projectFileBlob(project: Project): Promise<Blob> {
  const assets = await exportAssets(projectAssetIds(project));
  const data = Object.keys(assets).length ? { ...project, assets } : project;
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
}

/** Triggers a browser download for a Blob; the object URL is revoked shortly after. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const MAX_IMPORT_BYTES = 120 * 1024 * 1024;

export async function readProjectFile(file: File): Promise<Project> {
  if (file.size > MAX_IMPORT_BYTES) throw new Error('الملف كبير جدًا لمشروع.');
  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error('الملف ليس JSON صالحًا.');
  }
  const project = parseProject(data);
  await importAssets((data as { assets?: unknown }).assets);
  return project;
}

const AUTOSAVE_KEY = 'kamirty-motion:autosave:v1';

export function saveLocal(project: Project, description: string): void {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ project, description }));
  } catch {
    /* storage unavailable or full: autosave is best effort */
  }
}

export function loadLocal(): { project: Project; description: string } | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { project: unknown; description: unknown };
    return { project: parseProject(data.project), description: typeof data.description === 'string' ? data.description : '' };
  } catch {
    return null;
  }
}
