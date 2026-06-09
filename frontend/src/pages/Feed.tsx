import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Radio, Search, Sparkles, UserPlus, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

import { api } from '../api/client';
import { Button } from '../components/common/Button';
import { Skeleton } from '../components/common/Skeleton';
import { PageShell } from '../components/layout/PageShell';
import { HorizontalTrackShelf, HorizontalTrackShelfSlot } from '../components/track/HorizontalTrackShelf';
import { TrackCard } from '../components/track/TrackCard';
import { TrackRow } from '../components/track/TrackRow';
import { TrackRowStack } from '../components/track/TrackRowStack';
import { useAuthStore } from '../store/authStore';
import type { AuthUser, Track } from '../types';
import { formatFeedTrackTime, groupTracksByPeriod } from '../utils/feedGroups';

type FeedPage = {
  following_count: number;
  tracks: Track[];
};

type SuggestedArtist = {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_verified: boolean;
  public_tracks_count: number;
};

function ArtistAvatar({ user, size = 48 }: { user: { display_name: string; avatar_url?: string | null }; size?: number }) {
  const base = import.meta.env.VITE_API_URL || '';
  const src = user.avatar_url?.startsWith('http') ? user.avatar_url : user.avatar_url ? `${base}${user.avatar_url}` : null;
  const initial = user.display_name?.trim()?.[0]?.toUpperCase() ?? '?';
  return (
    <div
      className="shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-[var(--primary-light)] to-[var(--bg-elevated)] ring-2 ring-[var(--border)]"
      style={{ width: size, height: size }}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-sm font-bold text-[var(--primary)]">{initial}</span>
      )}
    </div>
  );
}

function SuggestedArtistsBlock() {
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user);

  const suggestionsQ = useQuery({
    queryKey: ['feed', 'suggestions'],
    queryFn: () => api.get<SuggestedArtist[]>('/api/feed/suggestions').then((r) => r.data),
  });

  const followM = useMutation({
    mutationFn: (username: string) => api.post(`/api/users/${username}/follow`),
    onSuccess: (_, username) => {
      toast.success(`Вы подписались на @${username}`);
      void queryClient.invalidateQueries({ queryKey: ['feed'] });
      void queryClient.invalidateQueries({ queryKey: ['feed', 'suggestions'] });
    },
    onError: () => toast.error('Не удалось подписаться'),
  });

  if (!suggestionsQ.data?.length) return null;

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-card)] ring-1 ring-black/[0.03] dark:ring-white/[0.05]">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary-light)] text-[var(--primary)]">
          <Sparkles className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">Кого послушать</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Подпишитесь на артистов — их новые треки появятся в ленте
          </p>
        </div>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {suggestionsQ.data.map((a) => (
          <li
            key={a.id}
            className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 transition hover:border-[var(--primary)]/30"
          >
            <Link to={`/artist/${a.username}`} className="shrink-0">
              <ArtistAvatar user={a} size={44} />
            </Link>
            <div className="min-w-0 flex-1">
              <Link to={`/artist/${a.username}`} className="block truncate font-semibold text-[var(--text-primary)] hover:text-[var(--primary)]">
                {a.display_name}
              </Link>
              <p className="truncate text-xs text-[var(--text-muted)]">
                @{a.username} · {a.public_tracks_count} {a.public_tracks_count === 1 ? 'трек' : 'треков'}
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              loading={followM.isPending && followM.variables === a.username}
              onClick={() => followM.mutate(a.username)}
              disabled={me?.username === a.username}
            >
              <UserPlus className="mr-1 h-3.5 w-3.5" />
              Подписаться
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DiscoverShelf() {
  const trendingQ = useQuery({
    queryKey: ['tracks', 'trending', 'feed-discover'],
    queryFn: () => api.get<Track[]>('/api/tracks/trending?limit=12').then((r) => r.data),
  });

  if (!trendingQ.data?.length) return null;

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">Пока вы настраиваете ленту</h2>
        <Link to="/search" className="text-sm font-semibold text-[var(--primary)] hover:underline">
          Весь каталог
        </Link>
      </div>
      <HorizontalTrackShelf aria-label="Популярные треки">
        {trendingQ.data.map((t) => (
          <HorizontalTrackShelfSlot key={t.id}>
            <TrackCard track={t} queue={trendingQ.data} />
          </HorizontalTrackShelfSlot>
        ))}
      </HorizontalTrackShelf>
    </section>
  );
}

function FeedHero({ followingCount, user }: { followingCount: number; user: AuthUser | null }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--primary-light)] via-[var(--bg-surface)] to-[var(--bg-surface)] p-6 shadow-[var(--shadow-card)] md:p-8">
      <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-[var(--primary)]/15 blur-3xl" />
      <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">Ваша лента</p>
          <h2 className="mt-2 font-display text-2xl font-bold text-[var(--text-primary)] md:text-3xl">
            {followingCount > 0 ? 'Следите за артистами в одном месте' : 'Лента ждёт ваших подписок'}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)] md:text-base">
            {followingCount > 0 ? (
              <>
                Вы подписаны на <strong className="text-[var(--text-primary)]">{followingCount}</strong>{' '}
                {followingCount === 1 ? 'артиста' : followingCount < 5 ? 'артистов' : 'артистов'}. Здесь появляются
                новые публичные треки сразу после публикации — как в соцсети, только для музыки.
              </>
            ) : (
              <>
                Подпишитесь на артистов — и их релизы будут собираться здесь хронологически. Пока лента пуста, ниже —
                рекомендации и популярное.
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link to="/search">
            <Button variant="secondary">
              <Search className="mr-2 h-4 w-4" />
              Найти артистов
            </Button>
          </Link>
          {followingCount > 0 && user?.username && (
            <Link to={`/artist/${user.username}`}>
              <Button variant="ghost">Мой профиль</Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function FeedTrackGroups({ tracks }: { tracks: Track[] }) {
  const groups = groupTracksByPeriod(tracks);
  let globalIndex = 0;

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.key}>
          <h2 className="mb-3 font-display text-lg font-semibold text-[var(--text-primary)]">{group.label}</h2>
          <div className="space-y-4">
            {group.tracks.map((track) => {
              const artist = track.user;
              const when = formatFeedTrackTime(track);
              const block = (
                <article
                  key={track.id}
                  className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--shadow-card)] ring-1 ring-black/[0.03] dark:ring-white/[0.05]"
                >
                  {artist && (
                    <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-elevated)]/50 px-4 py-3">
                      <Link to={`/artist/${artist.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                        <ArtistAvatar user={artist} size={40} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{artist.display_name}</p>
                          <p className="text-xs text-[var(--text-muted)]">опубликовал(а) новый трек</p>
                        </div>
                      </Link>
                      {when ? <time className="shrink-0 text-xs tabular-nums text-[var(--text-muted)]">{when}</time> : null}
                    </div>
                  )}
                  <TrackRowStack className="rounded-none border-0 shadow-none ring-0">
                    <TrackRow track={track} index={globalIndex} queue={tracks} showPlayCount />
                  </TrackRowStack>
                </article>
              );
              globalIndex += 1;
              return block;
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export function Feed() {
  const user = useAuthStore((s) => s.user) as AuthUser | null;

  const feedQ = useInfiniteQuery({
    queryKey: ['feed'],
    initialPageParam: null as number | null,
    queryFn: ({ pageParam }) => {
      const qs = pageParam != null ? `?cursor=${pageParam}` : '';
      return api.get<FeedPage>(`/api/feed${qs}`).then((r) => r.data);
    },
    getNextPageParam: (lastPage) => {
      const tracks = lastPage.tracks;
      return tracks.length ? tracks[tracks.length - 1].id : undefined;
    },
  });

  const followingCount = feedQ.data?.pages[0]?.following_count ?? 0;
  const tracks = feedQ.data?.pages.flatMap((p) => p.tracks) ?? [];
  const isLoading = feedQ.isLoading;
  const isError = feedQ.isError;

  return (
    <PageShell
      title="Лента"
      description="Новые треки от артистов, на которых вы подписаны"
      icon={<Radio className="h-7 w-7 text-[var(--primary)]" strokeWidth={2} aria-hidden />}
    >
      <div className="mx-auto max-w-3xl space-y-8">
        <FeedHero followingCount={followingCount} user={user} />

        {isLoading && (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-2xl" />
            ))}
          </div>
        )}

        {isError && (
          <div className="rounded-2xl border border-dashed border-[var(--error)]/40 bg-[var(--bg-surface)] px-6 py-10 text-center">
            <p className="font-semibold text-[var(--text-primary)]">Не удалось загрузить ленту</p>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">Проверьте, что бэкенд запущен</p>
            <Button className="mt-4" variant="secondary" onClick={() => feedQ.refetch()}>
              Повторить
            </Button>
          </div>
        )}

        {!isLoading && !isError && tracks.length > 0 && <FeedTrackGroups tracks={tracks} />}

        {!isLoading && !isError && followingCount > 0 && tracks.length === 0 && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-8 text-center shadow-[var(--shadow-card)]">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--primary-light)] text-[var(--primary)]">
              <Check className="h-7 w-7" aria-hidden />
            </div>
            <h3 className="font-display text-xl font-semibold text-[var(--text-primary)]">Подписки есть — ждём релизов</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-[var(--text-secondary)]">
              Артисты, на которых вы подписаны, пока не выложили новых публичных треков. Загляните позже или откройте их профили.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Link to="/search">
                <Button variant="secondary">
                  <Users className="mr-2 h-4 w-4" />
                  Найти ещё артистов
                </Button>
              </Link>
            </div>
          </div>
        )}

        {!isLoading && followingCount === 0 && <SuggestedArtistsBlock />}

        {!isLoading && (followingCount === 0 || tracks.length === 0) && <DiscoverShelf />}

        {tracks.length > 0 && (
          <div className="flex justify-center pb-4">
            <Button
              variant="secondary"
              onClick={() => feedQ.fetchNextPage()}
              disabled={!feedQ.hasNextPage || feedQ.isFetchingNextPage}
            >
              {feedQ.isFetchingNextPage ? 'Загрузка…' : feedQ.hasNextPage ? 'Загрузить ещё' : 'Вы всё посмотрели'}
            </Button>
          </div>
        )}
      </div>
    </PageShell>
  );
}
