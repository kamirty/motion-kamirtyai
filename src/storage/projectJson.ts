import type { Project } from '../domain/types';

export const projectToJson = (project: Project): string => JSON.stringify(project, null, 2);

/** Triggers a browser download for a Blob; the object URL is revoked shortly after. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
