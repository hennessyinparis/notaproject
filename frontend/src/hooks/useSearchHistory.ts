import { useCallback, useSyncExternalStore } from 'react';
import { useAuthStore } from '../store/authStore';

const MAX_ITEMS = 10;

export type HistoryItem = {
  id: number | string;
  type: 'track' | 'artist';
  title: string;
  subtitle: string;
  image?: string | null;
};

type Stored = HistoryItem[];

function getKey(userId?: number | string): string {
  return userId ? `search_history_${userId}` : 'search_history_anon';
}

const cache = new Map<string, { json: string | null; parsed: Stored }>();

function getSnapshot(key: string): Stored {
  const raw = localStorage.getItem(key);
  const entry = cache.get(key);
  if (entry && entry.json === raw) return entry.parsed;
  let parsed: Stored = [];
  try {
    parsed = raw ? (JSON.parse(raw) as Stored) : [];
  } catch {
    parsed = [];
  }
  cache.set(key, { json: raw, parsed });
  return parsed;
}

function subscribe(_key: string, cb: () => void) {
  window.addEventListener('storage', cb);
  return () => window.removeEventListener('storage', cb);
}

function persist(key: string, items: Stored) {
  cache.delete(key);
  localStorage.setItem(key, JSON.stringify(items));
  window.dispatchEvent(new Event('storage'));
}

export function useSearchHistory() {
  const user = useAuthStore((s) => s.user);
  const key = getKey(user?.id);

  const items = useSyncExternalStore(
    useCallback((cb: () => void) => subscribe(key, cb), [key]),
    useCallback(() => getSnapshot(key), [key]),
    useCallback(() => getSnapshot(key), [key]),
  );

  const add = useCallback(
    (item: HistoryItem) => {
      let list = getSnapshot(key);
      list = list.filter((i) => !(i.type === item.type && i.id === item.id));
      list.unshift(item);
      if (list.length > MAX_ITEMS) list = list.slice(0, MAX_ITEMS);
      persist(key, list);
    },
    [key],
  );

  const remove = useCallback(
    (item: HistoryItem) => {
      persist(key, getSnapshot(key).filter((i) => !(i.type === item.type && i.id === item.id)));
    },
    [key],
  );

  const clear = useCallback(() => {
    persist(key, []);
  }, [key]);

  return { items, add, remove, clear };
}
