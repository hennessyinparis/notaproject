import { useQuery } from '@tanstack/react-query';

import { api } from '../api/client';
import { TrackCard } from '../components/track/TrackCard';
import type { Track } from '../types';

export function Feed() {
  const { data } = useQuery({
    queryKey: ['feed'],
    queryFn: () => api.get<Track[]>('/api/feed').then((r) => r.data),
  });

  return (
    <div>
      <h1 className="font-display text-3xl font-bold">Лента</h1>
      <p className="mt-2 text-[var(--text-secondary)]">Новое от подписок</p>
      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {data?.map((t) => (
          <TrackCard key={t.id} track={t} queue={data} />
        ))}
      </div>
    </div>
  );
}
