import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';

import { api } from '../api/client';

export function PlaylistPage() {
  const { id } = useParams();
  const { data: pl } = useQuery({
    queryKey: ['playlist', id],
    queryFn: () => api.get(`/api/playlists/${id}`).then((r) => r.data),
    enabled: !!id,
  });
  const { data: tracks } = useQuery({
    queryKey: ['playlist-tracks', id],
    queryFn: () => api.get(`/api/playlists/${id}/tracks`).then((r) => r.data),
    enabled: !!id,
  });

  if (!pl) return <div>Загрузка…</div>;

  return (
    <div>
      <h1 className="font-display text-3xl font-bold">{pl.title}</h1>
      <ul className="mt-6 space-y-2">
        {tracks?.map((row: { track: { id: number; title: string } }) => (
          <li key={row.track.id} className="rounded-lg border border-[var(--border)] px-4 py-3">
            {row.track.title}
          </li>
        ))}
      </ul>
    </div>
  );
}
