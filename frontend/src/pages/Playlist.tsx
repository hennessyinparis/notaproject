import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Play, Lock, Globe, UserPlus, Share2, ListMusic, Shuffle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import { api } from '../api/client';
import { Button } from '../components/common/Button';
import { TrackRow } from '../components/track/TrackRow';
import { TrackRowStack } from '../components/track/TrackRowStack';
import { useAuthStore } from '../store/authStore';
import { usePlayerStore } from '../store/playerStore';
import type { Track } from '../types';

type PlaylistOut = {
  id: number;
  user_id: number;
  title: string;
  description?: string | null;
  cover_url?: string | null;
  is_public: boolean;
};

export function PlaylistPage() {
  const { id } = useParams();
  const playTrack = usePlayerStore((s) => s.playTrack);
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const base = import.meta.env.VITE_API_URL || '';
  const [collabUsername, setCollabUsername] = useState('');
  const [shareUser, setShareUser] = useState('');
  const [showShare, setShowShare] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const { data: pl } = useQuery({
    queryKey: ['playlist', id],
    queryFn: () => api.get<PlaylistOut>(`/api/playlists/${id}`).then((r) => r.data),
    enabled: !!id,
  });
  const { data: tracks } = useQuery({
    queryKey: ['playlist-tracks', id],
    queryFn: () => api.get<Track[]>(`/api/playlists/${id}/tracks`).then((r) => r.data),
    enabled: !!id,
  });
  const collaboratorsQ = useQuery({
    queryKey: ['playlist-collaborators', id],
    queryFn: () =>
      api
        .get<Array<{ username: string; display_name: string; role: string }>>(`/api/playlists/${id}/collaborators`)
        .then((r) => r.data),
    enabled: !!id && !!user,
  });
  const usersQ = useQuery({
    queryKey: ['playlist-share-users', shareUser],
    queryFn: () =>
      api
        .get<{ users: Array<{ username: string; display_name: string }> }>(`/api/search?q=${encodeURIComponent(shareUser)}`)
        .then((r) => r.data.users ?? []),
    enabled: showShare && shareUser.trim().length > 1,
  });
  const isOwner = !!user && !!pl && user.id === pl.user_id;

  useEffect(() => {
    if (pl && editOpen) {
      setEditTitle(pl.title);
      setEditDescription(pl.description ?? '');
    }
  }, [pl, editOpen]);

  const updateM = useMutation({
    mutationFn: async (payload: { is_public?: boolean; title?: string; description?: string | null }) =>
      api.patch(`/api/playlists/${id}`, payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['playlist', id] });
      await qc.invalidateQueries({ queryKey: ['playlists', 'mine'] });
      toast.success('Плейлист обновлён');
    },
    onError: () => toast.error('Не удалось сохранить'),
  });

  const addCollabM = useMutation({
    mutationFn: async () => api.post(`/api/playlists/${id}/collaborators`, { username: collabUsername }),
    onSuccess: async () => {
      setCollabUsername('');
      await qc.invalidateQueries({ queryKey: ['playlist-collaborators', id] });
      toast.success('Соавтор добавлен');
    },
    onError: () => toast.error('Не удалось добавить соавтора'),
  });
  const shareToUser = async (toUsername: string) => {
    if (!pl) return;
    const link = `${window.location.origin}/playlist/${id}`;
    await api.post(`/api/messages/${toUsername}`, { text: `Плейлист: ${pl.title}\n${link}` });
    toast.success('Плейлист отправлен');
    setShowShare(false);
  };

  if (!pl) return <div className="p-8 text-[var(--text-muted)]">Загрузка…</div>;

  const coverFromPlaylist = pl.cover_url ? `${base}${pl.cover_url}` : null;
  const coverFromTrack =
    !coverFromPlaylist && tracks?.[0]?.cover_url ? `${base}${tracks[0].cover_url}` : null;
  const heroCover = coverFromPlaylist || coverFromTrack;

  return (
    <div className="space-y-8">
      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--shadow-card)] ring-1 ring-black/[0.03] dark:ring-white/[0.05]">
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-end sm:gap-8 sm:p-8">
          <div className="mx-auto shrink-0 sm:mx-0">
            <div className="h-44 w-44 overflow-hidden rounded-2xl bg-[var(--bg-elevated)] shadow-lg ring-1 ring-black/5 dark:ring-white/10 sm:h-52 sm:w-52">
              {heroCover ? (
                <img src={heroCover} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[var(--text-muted)]">
                  <ListMusic className="h-16 w-16 opacity-5" aria-hidden />
                </div>
              )}
            </div>
          </div>
          <div className="min-w-0 flex-1 text-center sm:pb-1 sm:text-left">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Плейлист</p>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-[var(--text-primary)] sm:text-4xl">
              {pl.title}
            </h1>
            {pl.description ? (
              <p className="mt-2 max-w-2xl text-[var(--text-secondary)]">{pl.description}</p>
            ) : null}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <Button onClick={() => tracks?.[0] && playTrack(tracks[0], tracks)} disabled={!tracks?.length}>
                <Play className="mr-2 h-4 w-4" /> Играть всё
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  if (!tracks?.length) return;
                  const shuffled = [...tracks].sort(() => Math.random() - 0.5);
                  playTrack(shuffled[0], shuffled);
                }}
                disabled={!tracks?.length}
              >
                <Shuffle className="mr-2 h-4 w-4" /> Перемешать
              </Button>
              <Button variant="ghost" onClick={() => setShowShare(true)}>
                <Share2 className="mr-2 h-4 w-4" /> Поделиться
              </Button>
              {isOwner && (
                <>
                  <Button variant="secondary" onClick={() => setEditOpen(true)}>
                    <Pencil className="mr-2 h-4 w-4" /> Изменить
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => updateM.mutate({ is_public: !pl.is_public })}
                    loading={updateM.isPending}
                  >
                    {pl.is_public ? <Lock className="mr-2 h-4 w-4" /> : <Globe className="mr-2 h-4 w-4" />}
                    {pl.is_public ? 'Приватный' : 'Публичный'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {isOwner && (
          <div className="border-t border-[var(--border)] px-6 py-4 sm:px-8">
            <p className="mb-2 text-sm font-medium text-[var(--text-primary)]">Совместный плейлист</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={collabUsername}
                onChange={(e) => setCollabUsername(e.target.value)}
                placeholder="username друга"
                className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
              />
              <Button onClick={() => addCollabM.mutate()} disabled={!collabUsername.trim()} loading={addCollabM.isPending}>
                <UserPlus className="mr-2 h-4 w-4" />
                Добавить соавтора
              </Button>
            </div>
            {!!collaboratorsQ.data?.length && (
              <div className="mt-2 text-sm text-[var(--text-secondary)]">
                Соавторы: {collaboratorsQ.data.map((c) => c.display_name).join(', ')}
              </div>
            )}
          </div>
        )}
        {showShare && (
          <div className="border-t border-[var(--border)] px-6 py-4 sm:px-8">
            <input
              placeholder="Найти пользователя..."
              value={shareUser}
              onChange={(e) => setShareUser(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
            />
            <div className="mt-2 grid gap-2">
              {usersQ.data?.map((u) => (
                <button
                  key={u.username}
                  type="button"
                  onClick={() => shareToUser(u.username)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
                >
                  {u.display_name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {editOpen && isOwner && (
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setEditOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">Редактировать плейлист</h2>
            <label className="mt-4 block text-sm font-medium text-[var(--text-primary)]">Название</label>
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2.5 text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
            <label className="mt-4 block text-sm font-medium text-[var(--text-primary)]">Описание</label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2.5 text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
            <div className="mt-6 flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  const t = editTitle.trim();
                  if (!t) {
                    toast.error('Укажите название');
                    return;
                  }
                  updateM.mutate(
                    { title: t, description: editDescription.trim() || null },
                    { onSuccess: () => setEditOpen(false) }
                  );
                }}
                loading={updateM.isPending}
              >
                Сохранить
              </Button>
              <Button variant="secondary" onClick={() => setEditOpen(false)}>
                Отмена
              </Button>
            </div>
            <p className="mt-4 text-xs text-[var(--text-muted)]">
              Обложка подставляется с последнего добавленного трека с обложкой.
            </p>
          </div>
        </div>
      )}

      <TrackRowStack>
        {(tracks ?? []).map((t, i) => (
          <TrackRow key={t.id} track={t} index={i} queue={tracks ?? []} />
        ))}
      </TrackRowStack>
    </div>
  );
}
