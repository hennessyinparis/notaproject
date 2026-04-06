import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Music2, Search } from 'lucide-react';
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
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-[var(--text-primary)]">{t.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-secondary)]">
                    <span className="font-mono">@{t.user?.username ?? `id:${t.user_id}`}</span>
                    <span className="text-[var(--text-muted)]">·</span>
                    <span>{t.plays_count.toLocaleString('ru-RU')} прослушиваний</span>
                    {!t.is_public && (
                      <span className="rounded-md bg-amber-500/12 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                        Скрыт
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
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
    </div>
  );
}
