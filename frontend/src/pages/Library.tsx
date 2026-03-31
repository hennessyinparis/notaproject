import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { api } from '../api/client';
import { EmptyState } from '../components/common/EmptyState';
import { TrackRow } from '../components/track/TrackRow';
import type { Track } from '../types';

export function Library() {
  const [tab, setTab] = useState<'likes' | 'playlists'>('likes');
  const likesQ = useQuery({
    queryKey: ['library-liked-tracks'],
    queryFn: () => api.get<Track[]>('/api/users/me/liked-tracks').then((r) => r.data),
  });
  const playlistsQ = useQuery({
    queryKey: ['my-playlists'],
    queryFn: () =>
      api
        .get<Array<{ id: number; title: string; description?: string | null }>>('/api/playlists/mine')
        .then((r) => r.data),
  });
  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-bold">Библиотека</h1>
      <div className="flex gap-2">
        <button type="button" className={`rounded-full px-4 py-2 text-sm ${tab === 'likes' ? 'bg-[var(--primary)] text-white' : 'bg-[var(--bg-elevated)]'}`} onClick={() => setTab('likes')}>
          Лайки
        </button>
        <button type="button" className={`rounded-full px-4 py-2 text-sm ${tab === 'playlists' ? 'bg-[var(--primary)] text-white' : 'bg-[var(--bg-elevated)]'}`} onClick={() => setTab('playlists')}>
          Плейлисты
        </button>
      </div>
      {tab === 'likes' ? (
        likesQ.data && likesQ.data.length > 0 ? (
          <div className="rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-2">
            {likesQ.data.map((t, i) => (
              <TrackRow key={t.id} track={t} index={i} queue={likesQ.data} />
            ))}
          </div>
        ) : (
          <EmptyState title="Пока пусто" description="Лайкай треки чтобы добавить их в библиотеку" />
        )
      ) : playlistsQ.data && playlistsQ.data.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {playlistsQ.data.map((p) => (
            <a key={p.id} href={`/playlist/${p.id}`} className="rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-4">
              <div className="font-semibold">{p.title}</div>
              {p.description && <div className="mt-1 text-sm text-[var(--text-secondary)]">{p.description}</div>}
            </a>
          ))}
        </div>
      ) : (
        <EmptyState title="Нет плейлистов" description="Создай первый плейлист и добавляй туда треки." />
      )}
    </div>
  );
}
