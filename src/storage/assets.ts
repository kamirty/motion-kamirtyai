/**
 * Local image store. Pictures the visitor adds are downscaled, re-encoded and kept in the
 * browser (IndexedDB) under a content hash; nothing is uploaded. Decoded bitmaps are cached in
 * memory for the renderer, which reads them synchronously through getBitmap().
 */

export const MAX_IMAGE_BYTES = 25 * 1024 * 1024; // accepted input file size
const MAX_EDGE = 1920; // longest side after downscaling
const DB = 'kamirty-motion';
const STORE = 'assets';

const bitmaps = new Map<string, ImageBitmap>();
const sizes = new Map<string, { width: number; height: number }>();
const listeners = new Set<() => void>();

/** Bitmap for an asset if it is loaded (renderer-side, synchronous). */
export const getBitmap = (id: string): ImageBitmap | undefined => bitmaps.get(id);
export const getImageSize = (id: string) => sizes.get(id);

/** Notifies when a bitmap becomes available so previews can redraw. */
export function onAssetsChanged(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function register(id: string, bmp: ImageBitmap): void {
  bitmaps.set(id, bmp);
  sizes.set(id, { width: bmp.width, height: bmp.height });
  listeners.forEach((fn) => fn());
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  const db = await openDb();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

async function hashBlob(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  // crypto.subtle needs a secure context (HTTPS); fall back to three FNV-1a lanes otherwise.
  if (globalThis.crypto?.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  const lanes = [0x811c9dc5, 0x01000193 ^ 0x5bd1e995, 0x9e3779b9];
  for (let i = 0; i < bytes.length; i++) {
    for (let k = 0; k < 3; k++) lanes[k] = Math.imul(lanes[k] ^ bytes[i] ^ k, 16777619) >>> 0;
  }
  return lanes.map((h) => h.toString(16).padStart(8, '0')).join('');
}

/** Downscales to MAX_EDGE and re-encodes (WebP, JPEG fallback) to keep projects light. */
async function normalise(file: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * k));
  const h = Math.max(1, Math.round(bmp.height * k));
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  // PNG keeps transparency for logos/diagrams; photos become WebP.
  const webp = await canvas.convertToBlob({ type: 'image/webp', quality: 0.88 }).catch(() => null);
  if (webp && webp.type === 'image/webp') return webp;
  return canvas.convertToBlob({ type: 'image/png' });
}

/** Stores a picture from the visitor's device and returns its asset id. */
export async function addImageFile(file: File): Promise<string> {
  if (!/^image\/(png|jpe?g|webp|gif|bmp|avif)$/i.test(file.type)) throw new Error('نوع الملف غير مدعوم. استخدم PNG أو JPG أو WebP.');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('الصورة أكبر من ٢٥ ميجابايت.');
  const blob = await normalise(file);
  const id = await hashBlob(blob);
  if (!bitmaps.has(id)) register(id, await createImageBitmap(blob));
  await idb('readwrite', (s) => s.put(blob, id));
  return id;
}

/** Loads the given assets from IndexedDB into memory; returns ids that could not be found. */
export async function loadAssets(ids: string[]): Promise<string[]> {
  const missing: string[] = [];
  await Promise.all(
    [...new Set(ids)].filter((id) => !bitmaps.has(id)).map(async (id) => {
      const blob = await idb<Blob>('readonly', (s) => s.get(id) as IDBRequest<Blob>);
      if (!blob) {
        missing.push(id);
        return;
      }
      try {
        register(id, await createImageBitmap(blob));
      } catch {
        missing.push(id);
      }
    }),
  );
  return missing;
}

/** Asset ids referenced by a project. */
export const projectAssetIds = (project: { scenes: { image?: { assetId: string } }[] }): string[] =>
  project.scenes.flatMap((s) => (s.image ? [s.image.assetId] : []));

const DATA_URL = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
export const MAX_EMBEDDED_CHARS = 8 * 1024 * 1024;

/** Embeds referenced pictures as data URLs so a saved project file is self-contained. */
export async function exportAssets(ids: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const id of new Set(ids)) {
    const blob = await idb<Blob>('readonly', (s) => s.get(id) as IDBRequest<Blob>);
    if (!blob) continue;
    out[id] = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  }
  return out;
}

/** Imports embedded pictures from a project file (validated: image data URLs only). */
export async function importAssets(assets: unknown): Promise<void> {
  if (!assets || typeof assets !== 'object') return;
  for (const [id, url] of Object.entries(assets as Record<string, unknown>)) {
    if (!/^[0-9a-f]{24}$/.test(id) || typeof url !== 'string' || url.length > MAX_EMBEDDED_CHARS || !DATA_URL.test(url)) continue;
    const blob = await (await fetch(url)).blob();
    if (!bitmaps.has(id)) register(id, await createImageBitmap(blob));
    await idb('readwrite', (s) => s.put(blob, id));
  }
}
