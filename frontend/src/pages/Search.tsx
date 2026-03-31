import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';

import { api } from '../api/client';
import { TrackCard } from '../components/track/TrackCard';
import type { Track } from '../types';

type Filter = 'all' | 'tracks' | 'users' | 'playlists';

const genres = ['Pop', 'Hip-Hop', 'Rock', 'Electronic', 'Lo-fi'] as const;

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
  const inputRef = useRef<HTMLInputElement>(null);
  const qFromUrl = params.get('q') || '';
  const [q, setQ] = useState(qFromUrl);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (qFromUrl && qFromUrl !== q) setQ(qFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qFromUrl]);

  const debounced = useDebouncedValue(q, 300);

  const results = useQuery({
    queryKey: ['search', debounced],
    queryFn: () => api.get(`/api/search?q=${encodeURIComponent(debounced)}`).then((r) => r.data),
    enabled: debounced.trim().length >= 2,
  });

  const empty = q.trim().length === 0;
  const show = results.data ?? { tracks: [], users: [], playlists: [] };

  const visibleTracks = useMemo(() => (filter === 'all' || filter === 'tracks' ? (show.tracks as Track[]) : []), [filter, show.tracks]);
  const visibleUsers = useMemo(() => (filter === 'all' || filter === 'users' ? (show.users as any[]) : []), [filter, show.users]);
  const visiblePlaylists = useMemo(() => (filter === 'all' || filter === 'playlists' ? (show.playlists as any[]) : []), [filter, show.playlists]);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold">Поиск</h1>
      <input
        ref={inputRef}
        className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-5 py-4 text-lg outline-none ring-[var(--primary)] focus:ring-2"
        placeholder="Треки, артисты, плейлисты..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Поиск"
      />

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
            {genres.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setQ(g)}
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
                  <TrackCard key={t.id} track={t} queue={show.tracks as Track[]} />
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
                    className="rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-card transition hover:scale-[1.01]"
                  >
                    <p className="font-semibold">{u.display_name}</p>
                    <p className="text-sm text-[var(--text-muted)]">@{u.username}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {!!visiblePlaylists.length && (
            <section>
              <h2 className="mb-3 font-semibold">Плейлисты</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {visiblePlaylists.map((p: any) => (
                  <Link
                    key={p.id}
                    to={`/playlist/${p.id}`}
                    className="rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-card transition hover:scale-[1.01]"
                  >
                    <p className="font-semibold">{p.title}</p>
                    <p className="text-sm text-[var(--text-muted)]">ID: {p.id}</p>
                  </Link>
                ))}
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
