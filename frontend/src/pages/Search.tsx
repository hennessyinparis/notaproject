import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Music2, User, X } from 'lucide-react';

import { api } from '../api/client';
import { TrackCard } from '../components/track/TrackCard';
import { GENRES } from '../constants/genres';
import { useSearchHistory } from '../hooks/useSearchHistory';
import type { Track } from '../types';

type Filter = 'all' | 'tracks' | 'users' | 'playlists';

function useDebouncedValue<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return v;
}


export function Search() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const qFromUrl = params.get('q') || '';
  const [q, setQ] = useState(qFromUrl);
  const [filter, setFilter] = useState<Filter>('all');
  const [focused, setFocused] = useState(false);
  const focusedRef = useRef(false);
  const { items: history, add: addToHistory, remove: removeFromHistory, clear: clearHistory } = useSearchHistory();
  const syncTimer = useRef<number | null>(null);
  const apiBase = import.meta.env.VITE_API_URL || '';

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (qFromUrl !== q && !focusedRef.current) setQ(qFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qFromUrl]);

  const debounced = useDebouncedValue(q, 300);

  const results = useQuery({
    queryKey: ['search', debounced],
    queryFn: () => api.get(`/api/search?q=${encodeURIComponent(debounced)}`).then((r) => r.data),
    enabled: debounced.trim().length >= 2,
  });

  const syncUrl = (val: string) => {
    const trimmed = val.trim();
    if (syncTimer.current) window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(() => {
      if (trimmed) {
        navigate(`/search?q=${encodeURIComponent(trimmed)}`, { replace: true });
      } else {
        navigate('/search', { replace: true });
      }
    }, 300);
  };

  const imgSrc = (url?: string | null) => url ? (url.startsWith('http') ? url : `${apiBase}${url}`) : undefined;

  const empty = q.trim().length === 0;
  const show = results.data ?? { tracks: [], users: [], playlists: [] };

  const visibleTracks = useMemo(() => (filter === 'all' || filter === 'tracks' ? (show.tracks as Track[]) : []), [filter, show.tracks]);
  const visibleUsers = useMemo(() => (filter === 'all' || filter === 'users' ? (show.users as any[]) : []), [filter, show.users]);
  const visiblePlaylists = useMemo(() => (filter === 'all' || filter === 'playlists' ? (show.playlists as any[]) : []), [filter, show.playlists]);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold">Поиск</h1>
      <div className="relative">
        <input
          ref={inputRef}
          className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-5 py-4 text-lg outline-none ring-[var(--primary)] focus:ring-2"
          placeholder="Треки, артисты, плейлисты..."
          value={q}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && q.trim()) {
              navigate(`/search?q=${encodeURIComponent(q.trim())}`, { replace: true });
            }
          }}
          onChange={(e) => {
            setQ(e.target.value);
            syncUrl(e.target.value);
          }}
          onFocus={() => { setFocused(true); focusedRef.current = true; }}
          onBlur={() => {
            setFocused(false);
            setTimeout(() => { focusedRef.current = false; }, 120);
          }}
          aria-label="Поиск"
        />
        {focused && q.trim().length === 0 && history.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-2 shadow-[var(--shadow-card)]">
            <div className="mb-1 flex items-center justify-between px-3 py-1">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">Недавние</span>
              <button
                type="button"
                onClick={clearHistory}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                Очистить
              </button>
            </div>
            {history.map((h) => (
              <div key={`${h.type}-${h.id}`} className="group flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    addToHistory(h);
                    navigate(h.type === 'track' ? `/track/${h.id}` : `/artist/${h.id}`, { replace: true });
                  }}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--bg-elevated)]"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded bg-[var(--bg-elevated)] ring-1 ring-black/5 dark:ring-white/10">
                    {h.image ? (
                      <img src={imgSrc(h.image)} alt="" className="h-full w-full object-cover" />
                    ) : h.type === 'track' ? (
                      <Music2 className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                    ) : (
                      <User className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{h.title}</div>
                    <div className="truncate text-xs text-[var(--text-secondary)]">{h.subtitle}</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => removeFromHistory(h)}
                  className="mr-1 rounded-lg p-1.5 opacity-0 transition-opacity hover:bg-[var(--bg-elevated)] group-hover:opacity-100"
                  aria-label="Удалить"
                >
                  <X className="h-3 w-3 text-[var(--text-muted)]" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {([
          ['all', 'Всё'],
          ['tracks', 'Треки'],
          ['users', 'Артисты'],
          ['playlists', 'Плейлисты'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`rounded-full border px-4 py-2 text-sm transition ${
              filter === id
                ? 'border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]'
                : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {empty && (
        <div>
          <h2 className="mb-3 font-semibold">Жанры</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            {GENRES.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => { setQ(g); navigate(`/search?q=${encodeURIComponent(g)}`, { replace: true }); }}
                className="rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-4 text-left font-semibold shadow-card transition hover:scale-[1.02]"
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      )}

      {!empty && results.isSuccess && (
        <div className="space-y-8">
          {!!visibleTracks.length && (
            <section>
              <h2 className="mb-3 font-semibold">Треки</h2>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {visibleTracks.map((t: Track) => (
                  <TrackCard
                    key={t.id}
                    track={t}
                    queue={show.tracks as Track[]}
                    onPlay={(track) => addToHistory({ id: track.id, type: 'track', title: track.title, subtitle: track.user?.display_name ?? 'Трек', image: track.cover_url })}
                  />
                ))}
              </div>
            </section>
          )}

          {!!visibleUsers.length && (
            <section>
              <h2 className="mb-3 font-semibold">Артисты</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {visibleUsers.map((u: any) => (
                  <Link
                    key={u.id}
                    to={`/artist/${u.username}`}
                    onClick={() => addToHistory({ id: u.username, type: 'artist', title: u.display_name, subtitle: `@${u.username}`, image: u.avatar_url })}
                    className="flex items-center gap-3 rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-card transition hover:scale-[1.01]"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--bg-elevated)] ring-1 ring-black/5 dark:ring-white/10">
                      {imgSrc(u.avatar_url) ? (
                        <img src={imgSrc(u.avatar_url)} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <User className="h-5 w-5 text-[var(--text-muted)]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold">{u.display_name}</p>
                      <p className="text-sm text-[var(--text-muted)]">@{u.username}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {!!visiblePlaylists.length && (
            <section>
              <h2 className="mb-3 font-semibold">Плейлисты</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {visiblePlaylists.map((p: { id: number; title: string; cover_url?: string | null }) => {
                  const pb = import.meta.env.VITE_API_URL || '';
                  const art = p.cover_url ? `${pb}${p.cover_url}` : null;
                  return (
                    <Link
                      key={p.id}
                      to={`/playlist/${p.id}`}
                      className="flex gap-3 rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-card transition hover:scale-[1.01]"
                    >
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[var(--bg-elevated)] ring-1 ring-black/5 dark:ring-white/10">
                        {art ? <img src={art} alt="" className="h-full w-full object-cover" /> : null}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold">{p.title}</p>
                        <p className="text-sm text-[var(--text-muted)]">Плейлист</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {!visibleTracks.length && !visibleUsers.length && !visiblePlaylists.length && (
            <p className="text-[var(--text-secondary)]">Ничего не найдено.</p>
          )}
        </div>
      )}
    </div>
  );
}
