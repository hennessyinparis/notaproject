import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { Heart, ListMusic, Play, Plus, Repeat2, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import toast from 'react-hot-toast';

import { api } from '../api/client';
import { PageShell } from '../components/layout/PageShell';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { useAuthStore } from '../store/authStore';
import { TrackRow } from '../components/track/TrackRow';
import { TrackRowStack } from '../components/track/TrackRowStack';
import type { Track } from '../types';
import { formatNumber } from '../utils/format';

const apiBase = import.meta.env.VITE_API_URL || '';

export function Library() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<'likes' | 'reposts' | 'playlists'>('likes');
  const [createPlOpen, setCreatePlOpen] = useState(false);
  const [newPlTitle, setNewPlTitle] = useState('');
  const isAdmin = !!currentUser?.is_admin;

  const likesQ = useQuery({
    queryKey: ['library-liked-tracks'],
    queryFn: () => api.get<Track[]>('/api/users/me/liked-tracks').then((r) => r.data),
    staleTime: 0,
    refetchOnMount: 'always',
    enabled: !isAdmin,
  });
  const repostsQ = useQuery({
    queryKey: ['library-reposted-tracks'],
    queryFn: () => api.get<Track[]>('/api/users/me/reposted-tracks').then((r) => r.data),
    staleTime: 0,
    refetchOnMount: 'always',
    enabled: !isAdmin,
  });
  const playlistsQ = useQuery({
    queryKey: ['playlists', 'mine'],
    enabled: !isAdmin,
    queryFn: () =>
      api
        .get<
          Array<{
            id: number;
            title: string;
            description?: string | null;
            cover_url?: string | null;
            plays_count?: number;
          }>
        >('/api/playlists/mine')
        .then((r) => r.data),
  });

  const createPlaylistM = useMutation({
    mutationFn: async () => {
      const title = newPlTitle.trim();
      if (!title) {
        toast.error('Введите название');
        return Promise.reject(new Error('empty'));
      }
      const { data } = await api.post<{ id: number }>('/api/playlists', { title, is_public: true });
      return data;
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['playlists', 'mine'] });
      toast.success('Плейлист создан');
      setCreatePlOpen(false);
      setNewPlTitle('');
      navigate(`/playlist/${data.id}`);
    },
    onError: () => toast.error('Не удалось создать плейлист'),
  });

  if (isAdmin) {
    return (
      <PageShell title="Библиотека" description="Недоступно для администраторов">
        <EmptyState title="Нет доступа" description="Администраторы не используют библиотеку." />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Библиотека"
      description="Избранные треки, репосты и плейлисты"
      icon={<ListMusic className="h-7 w-7 text-[var(--primary)]" strokeWidth={2} aria-hidden />}
    >
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex flex-wrap rounded-full border border-[var(--border)] bg-[var(--bg-surface)] p-1 shadow-[var(--shadow-card)] ring-1 ring-black/[0.03] dark:ring-white/[0.05]">
            <button
              type="button"
              className={clsx(
                'inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition sm:px-4',
                tab === 'likes' ? 'bg-[var(--primary)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}
              onClick={() => setTab('likes')}
            >
              <Heart className="h-4 w-4" aria-hidden />
              Лайки
            </button>
            <button
              type="button"
              className={clsx(
                'inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition sm:px-4',
                tab === 'reposts' ? 'bg-[var(--primary)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}
              onClick={() => setTab('reposts')}
            >
              <Repeat2 className="h-4 w-4" aria-hidden />
              Репосты
            </button>
            <button
              type="button"
              className={clsx(
                'inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition sm:px-4',
                tab === 'playlists' ? 'bg-[var(--primary)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}
              onClick={() => setTab('playlists')}
            >
              <ListMusic className="h-4 w-4" aria-hidden />
              Плейлисты
            </button>
          </div>
          {tab === 'playlists' && (
            <Button type="button" onClick={() => setCreatePlOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" aria-hidden />
              Создать плейлист
            </Button>
          )}
        </div>

        {createPlOpen && (
          <div
            className="fixed inset-0 z-[140] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lib-new-pl-title"
            onClick={() => setCreatePlOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 id="lib-new-pl-title" className="font-display text-lg font-bold text-[var(--text-primary)]">
                  Новый плейлист
                </h2>
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]"
                  aria-label="Закрыть"
                  onClick={() => setCreatePlOpen(false)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <input
                autoFocus
                value={newPlTitle}
                onChange={(e) => setNewPlTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), createPlaylistM.mutate())}
                placeholder="Название"
                className="mt-4 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  loading={createPlaylistM.isPending}
                  onClick={() => createPlaylistM.mutate()}
                  disabled={!newPlTitle.trim()}
                >
                  Создать
                </Button>
                <Button type="button" variant="secondary" onClick={() => setCreatePlOpen(false)}>
                  Отмена
                </Button>
              </div>
            </div>
          </div>
        )}

        {tab === 'likes' ? (
          likesQ.data && likesQ.data.length > 0 ? (
            <TrackRowStack>
              {likesQ.data.map((t, i) => (
                <TrackRow key={t.id} track={{ ...t, is_liked: true }} index={i} queue={likesQ.data} />
              ))}
            </TrackRowStack>
          ) : (
            <EmptyState title="Пока пусто" description="Лайкай треки, чтобы собрать их здесь" />
          )
        ) : tab === 'reposts' ? (
          repostsQ.isLoading ? (
            <p className="text-sm text-[var(--text-muted)]">Загрузка…</p>
          ) : repostsQ.data && repostsQ.data.length > 0 ? (
            <TrackRowStack>
              {repostsQ.data.map((t, i) => (
                <TrackRow key={t.id} track={{ ...t, is_reposted: true }} index={i} queue={repostsQ.data} />
              ))}
            </TrackRowStack>
          ) : (
            <EmptyState title="Нет репостов" description="Репостните трек — он появится в этой вкладке" />
          )
        ) : playlistsQ.data && playlistsQ.data.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2">
            {playlistsQ.data.map((p) => {
              const art = p.cover_url ? `${apiBase}${p.cover_url}` : null;
              const plays = p.plays_count ?? 0;
              return (
                <Link
                  key={p.id}
                  to={`/playlist/${p.id}`}
                  className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--shadow-card)] ring-1 ring-black/[0.03] transition hover:-translate-y-0.5 hover:border-[var(--primary)]/40 hover:shadow-[var(--shadow-hover)] dark:ring-white/[0.05]"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-[var(--primary)]/[0.07] via-transparent to-[var(--bg-elevated)] opacity-0 transition group-hover:opacity-100" />
                  <div className="relative flex gap-4 p-4 sm:p-5">
                    <div className="relative h-[5.25rem] w-[5.25rem] shrink-0 overflow-hidden rounded-2xl bg-[var(--bg-elevated)] shadow-lg ring-2 ring-white/60 dark:ring-white/10 sm:h-28 sm:w-28">
                      {art ? (
                        <img src={art} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-[var(--primary)]/15 to-[var(--bg-elevated)] text-[var(--primary)]">
                          <ListMusic className="h-10 w-10 opacity-90" aria-hidden />
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/35 group-hover:opacity-100">
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[var(--text-primary)] shadow-lg">
                          <Play className="ml-0.5 h-5 w-5 fill-current" aria-hidden />
                        </span>
                      </div>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col justify-center py-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                        Плейлист
                      </span>
                      <div className="mt-1 font-display text-lg font-bold leading-snug tracking-tight text-[var(--text-primary)] group-hover:text-[var(--primary)] sm:text-xl">
                        {p.title}
                      </div>
                      {p.description ? (
                        <p className="mt-1 line-clamp-2 text-sm text-[var(--text-secondary)]">{p.description}</p>
                      ) : (
                        <p className="mt-1 text-sm text-[var(--text-muted)]">Откройте, чтобы слушать</p>
                      )}
                      <p className="mt-2 text-xs font-medium tabular-nums text-[var(--text-muted)]">
                        {formatNumber(plays)} прослушиваний плейлиста
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <EmptyState title="Нет плейлистов" description="Создай плейлист и добавляй треки из карточек и страниц треков." />
        )}
      </div>
    </PageShell>
  );
}
