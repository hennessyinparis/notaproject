import { useInfiniteQuery } from '@tanstack/react-query';

import { api } from '../api/client';
import { Button } from '../components/common/Button';
import { TrackCard } from '../components/track/TrackCard';
import type { Track } from '../types';

export function Feed() {
  const feedQ = useInfiniteQuery({
    queryKey: ['feed'],
    initialPageParam: null as number | null,
    queryFn: ({ pageParam }) =>
      api
        .get<Track[]>(`/api/feed${pageParam ? `?cursor=${pageParam}` : ''}`)
        .then((r) => r.data),
    getNextPageParam: (lastPage) => (lastPage.length ? lastPage[lastPage.length - 1].id : undefined),
  });
  const data = feedQ.data?.pages.flatMap((p) => p) ?? [];

  return (
    <div>
      <h1 className="font-display text-3xl font-bold">Лента</h1>
      <p className="mt-2 text-[var(--text-secondary)]">Новое от подписок</p>
      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {data?.map((t) => (
          <TrackCard key={t.id} track={t} queue={data} />
        ))}
      </div>
      <div className="mt-6 flex justify-center">
        <Button
          variant="secondary"
          onClick={() => feedQ.fetchNextPage()}
          disabled={!feedQ.hasNextPage || feedQ.isFetchingNextPage}
        >
          {feedQ.isFetchingNextPage ? 'Загрузка...' : feedQ.hasNextPage ? 'Загрузить ещё' : 'Больше нет треков'}
        </Button>
      </div>
    </div>
  );
}
