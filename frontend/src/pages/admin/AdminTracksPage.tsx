import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Music2, Pencil, Search, X } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { api } from '../../api/client';
import { Button } from '../../components/common/Button';
import type { Track } from '../../types';
import { adminInputClass } from './adminTypes';
import { admCard, admCardPad, admEmpty, admMain, admRow, admToolbar } from './adminStyles';

function RowSkeleton() {
  return <div className="h-20 animate-pulse rounded-xl bg-[var(--bg-elevated)]/80" />;
}

export function AdminTracksPage() {
  const qc = useQueryClient();
  const [trackSearch, setTrackSearch] = useState('');
  const [trackSearchApplied, setTrackSearchApplied] = useState('');

  const tracksQ = useQuery({
    queryKey: ['admin-tracks', trackSearchApplied],
    queryFn: () =>
      api
        .get<Track[]>('/api/admin/tracks', {
          params: { limit: 80, ...(trackSearchApplied.trim() ? { q: trackSearchApplied.trim() } : {}) },
        })
        .then((r) => r.data),
  });

  const invalidateTracks = () => qc.invalidateQueries({ queryKey: ['admin-tracks'] });

  const trackVisM = useMutation({
    mutationFn: (id: number) => api.patch(`/api/admin/tracks/${id}/visibility`),
    onSuccess: async () => {
      toast.success('Видимость трека изменена');
      await invalidateTracks();
      await qc.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: () => toast.error('Не удалось изменить видимость'),
  });

  const trackDelM = useMutation({
    mutationFn: (id: number) => api.delete(`/api/admin/tracks/${id}`),
    onSuccess: async () => {
      toast.success('Трек удалён');
      await invalidateTracks();
      await qc.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: () => toast.error('Не удалось удалить трек'),
  });

  const delTrack = (t: Track) => {
    if (!window.confirm(`Удалить трек «${t.title}» безвозвратно?`)) return;
    trackDelM.mutate(t.id);
  };

  const [editTrack, setEditTrack] = useState<Track | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editGenre, setEditGenre] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const trackEditM = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      api.patch(`/api/admin/tracks/${id}`, data),
    onSuccess: async () => {
      toast.success('Трек обновлён');
      setEditTrack(null);
      await invalidateTracks();
    },
    onError: () => toast.error('Не удалось обновить трек'),
  });

  const openEdit = (t: Track) => {
    setEditTrack(t);
    setEditTitle(t.title);
    setEditGenre(t.genre ?? '');
    setEditDesc(t.description ?? '');
  };

  return (
    <div className={admMain}>
      <AdminPageHeader
        icon={Music2}
        title="Треки"
        description="Поиск по названию, скрытие с публичной витрины и полное удаление вместе с файлом на сервере."
      />

      <div className={admToolbar}>
        <div className="min-w-0 flex-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Поиск по названию
          </label>
          <div className="relative mt-1.5">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
              aria-hidden
            />
            <input
              className={`${adminInputClass} pl-10`}
              value={trackSearch}
              onChange={(e) => setTrackSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setTrackSearchApplied(trackSearch)}
              placeholder="Название трека"
            />
          </div>
        </div>
        <div className="flex w-full gap-2 sm:w-auto sm:shrink-0">
          <Button type="button" className="flex-1 sm:flex-none" onClick={() => setTrackSearchApplied(trackSearch)}>
            Найти
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="flex-1 sm:flex-none"
            onClick={() => {
              setTrackSearch('');
              setTrackSearchApplied('');
            }}
          >
            Сброс
          </Button>
        </div>
      </div>

      <div className={`${admCard} ${admCardPad}`}>
        <div className="mb-4 flex items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Каталог</h3>
          {tracksQ.data != null ? (
            <span className="text-xs font-medium text-[var(--text-muted)]">{tracksQ.data.length} треков</span>
          ) : null}
        </div>

        {tracksQ.isLoading ? (
          <div className="space-y-3">
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
          </div>
        ) : (
          <div className="space-y-3">
            {(tracksQ.data ?? []).map((t) => (
              <div
                key={t.id}
                className={`${admRow} ${!t.is_public ? 'border-l-[3px] border-l-amber-500/70' : ''}`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {t.cover_url ? (
                    <img src={t.cover_url} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover ring-1 ring-black/10" />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-elevated)] text-[var(--text-muted)] ring-1 ring-[var(--border)]">
                      <Music2 className="h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-[var(--text-primary)]">{t.title}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-secondary)]">
                      <span className="font-mono">@{t.user?.username ?? `id:${t.user_id}`}</span>
                      <span className="text-[var(--text-muted)]">·</span>
                      <span>{(t.plays_count ?? 0).toLocaleString('ru-RU')}</span>
                      {!t.is_public && (
                        <span className="rounded-md bg-amber-500/12 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                          Скрыт
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEdit(t)}
                  >
                    <Pencil className="mr-1 h-3.5 w-3.5" /> Изменить
                  </Button>
                  <Button
                    size="sm"
                    variant={t.is_public ? 'secondary' : 'primary'}
                    disabled={trackVisM.isPending}
                    onClick={() => trackVisM.mutate(t.id)}
                  >
                    {t.is_public ? 'Скрыть' : 'Опубликовать'}
                  </Button>
                  <Button size="sm" variant="ghost" disabled={trackDelM.isPending} onClick={() => delTrack(t)}>
                    Удалить
                  </Button>
                </div>
              </div>
            ))}
            {!tracksQ.data?.length && (
              <div className={admEmpty}>Треков не найдено. Попробуйте другой запрос.</div>
            )}
          </div>
        )}
      </div>

      {editTrack && (
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setEditTrack(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">Редактировать трек</h2>
              <button onClick={() => setEditTrack(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <label className="block text-sm font-medium text-[var(--text-primary)]">Название</label>
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2.5 text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
            <label className="mt-3 block text-sm font-medium text-[var(--text-primary)]">Жанр</label>
            <input
              value={editGenre}
              onChange={(e) => setEditGenre(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2.5 text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
            <label className="mt-3 block text-sm font-medium text-[var(--text-primary)]">Описание</label>
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              rows={3}
              className="mt-1 w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2.5 text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
            <div className="mt-6 flex gap-2">
              <Button
                onClick={() => {
                  trackEditM.mutate({
                    id: editTrack.id,
                    data: {
                      title: editTitle.trim(),
                      genre: editGenre.trim() || null,
                      description: editDesc.trim() || null,
                    },
                  });
                }}
                loading={trackEditM.isPending}
              >
                Сохранить
              </Button>
              <Button variant="secondary" onClick={() => setEditTrack(null)}>
                Отмена
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
