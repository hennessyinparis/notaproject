const STORAGE_KEY = 'nota_offline_track_ids';

export function getOfflineTrackIds(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'number') : [];
  } catch {
    return [];
  }
}

export function isTrackOffline(trackId: number): boolean {
  return getOfflineTrackIds().includes(trackId);
}

export function addOfflineTrack(trackId: number): void {
  const ids = getOfflineTrackIds();
  if (!ids.includes(trackId)) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids, trackId]));
  }
  void registerOfflineCache(trackId);
}

export function removeOfflineTrack(trackId: number): void {
  const ids = getOfflineTrackIds().filter((id) => id !== trackId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  void unregisterOfflineCache(trackId);
}

async function registerOfflineCache(trackId: number): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.ready.catch(() => null);
  if (!reg?.active) return;
  const base = import.meta.env.VITE_API_URL || '';
  const url = `${base}/api/tracks/${trackId}/stream`;
  reg.active.postMessage({ type: 'CACHE_TRACK', url });
}

async function unregisterOfflineCache(trackId: number): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.ready.catch(() => null);
  if (!reg?.active) return;
  const base = import.meta.env.VITE_API_URL || '';
  const url = `${base}/api/tracks/${trackId}/stream`;
  reg.active.postMessage({ type: 'UNCACHE_TRACK', url });
}

export async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('/sw.js');
  } catch {
    /* ignore */
  }
}
