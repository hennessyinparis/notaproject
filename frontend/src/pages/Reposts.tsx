import { useQuery } from '@tanstack/react-query';

import { api } from '../api/client';
import { EmptyState } from '../components/common/EmptyState';
import { TrackRow } from '../components/track/TrackRow';
import type { Track } from '../types';

export function RepostsPage() {
  const repostsQ = useQuery({
    queryKey: ['reposts-page'],
    queryFn: () => api.get<Track[]>('/api/users/me/reposted-tracks').then((r) => r.data),
  });

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-bold">Мои репосты</h1>
      {repostsQ.data && repostsQ.data.length > 0 ? (
        <div className="rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-2">
          {repostsQ.data.map((t, i) => (
            <TrackRow key={t.id} track={{ ...t, is_reposted: true }} index={i} queue={repostsQ.data} />
          ))}
        </div>
      ) : (
        <EmptyState title="Репостов пока нет" description="Репостни треки, чтобы собрать их в отдельной странице." />
      )}
    </div>
  );
}
