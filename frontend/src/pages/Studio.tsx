import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Music, Play, TrendingUp, Upload } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

import { api } from '../api/client';
import { Button } from '../components/common/Button';
import { PageShell } from '../components/layout/PageShell';
import { TrackCard } from '../components/track/TrackCard';
import { useAuthStore } from '../store/authStore';
import { formatNumber } from '../utils/format';
import type { Track } from '../types';

export function Studio() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [title, setTitle] = useState('');

  const tracksQ = useQuery({
    queryKey: ['my-tracks'],
    queryFn: () => api.get<Track[]>('/api/users/me/tracks').then((r) => r.data),
    enabled: !!user,
  });

  const statsQ = useQuery({
    queryKey: ['my-basic-stats'],
    queryFn: () => api.get<{ total: number }>('/api/analytics/my-basic-stats').then((r) => r.data),
    enabled: !!user,
  });
  const followersQ = useQuery({
    queryKey: ['studio-followers-count', user?.username],
    queryFn: () => api.get<{ count: number }>(`/api/users/${user?.username}/followers/count`).then((r) => r.data),
    enabled: !!user?.username,
    refetchInterval: 10000,
  });

  const totalPlays = statsQ.data?.total || 0;
  const totalTracks = tracksQ.data?.length || 0;
  const updateM = useMutation({
    mutationFn: async () => {
      if (!editingTrack) return;
      await api.patch(`/api/tracks/${editingTrack.id}`, { title });
    },
    onSuccess: async () => {
      toast.success('Трек обновлён');
      setEditingTrack(null);
      await qc.invalidateQueries({ queryKey: ['my-tracks'] });
    },
  });
  const deleteM = useMutation({
    mutationFn: async (id: number) => api.delete(`/api/tracks/${id}`),
    onSuccess: async () => {
      toast.success('Трек удалён');
      await qc.invalidateQueries({ queryKey: ['my-tracks'] });
      await qc.invalidateQueries({ queryKey: ['my-basic-stats'] });
    },
  });

  return (
    <PageShell
      title="Студия"
      description="Статистика, релизы и загрузка новых треков"
      icon={<Music className="h-7 w-7 text-[var(--primary)]" strokeWidth={2} aria-hidden />}
      actions={
        <Link to="/upload" className="shrink-0">
          <Button>
            <Upload className="mr-2 h-4 w-4" />
            Загрузить трек
          </Button>
        </Link>
      }
    >
      <div className="mx-auto max-w-6xl space-y-10">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-hover)] ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
          <div className="flex items-center gap-2 text-[var(--text-muted)]">
            <Music className="h-4 w-4" />
            <span className="text-sm">Треков</span>
          </div>
          <p className="mt-1 text-2xl font-bold">{totalTracks}</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-hover)] ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
          <div className="flex items-center gap-2 text-[var(--text-muted)]">
            <Play className="h-4 w-4" />
            <span className="text-sm">Прослушиваний</span>
          </div>
          <p className="mt-1 text-2xl font-bold">{formatNumber(totalPlays)}</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-hover)] ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
          <div className="flex items-center gap-2 text-[var(--text-muted)]">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm">Подписчиков</span>
          </div>
          <p className="mt-1 text-2xl font-bold">{followersQ.data?.count ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-hover)] ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
          <div className="flex items-center gap-2 text-[var(--text-muted)]">
            <span className="text-sm">Доход</span>
          </div>
          <p className="mt-1 text-2xl font-bold">0 ₽</p>
        </div>
      </div>

      <div>
        <h2 className="font-display text-xl font-bold text-[var(--text-primary)]">Мои треки</h2>

        {tracksQ.isLoading ? (
          <div className="mt-4 text-[var(--text-muted)]">Загрузка...</div>
        ) : tracksQ.data && tracksQ.data.length > 0 ? (
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
            {tracksQ.data.map((track) => (
              <div key={track.id} className="space-y-2">
                <TrackCard track={track} queue={tracksQ.data} />
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => {setEditingTrack(track); setTitle(track.title);}} className="flex-1">Редактировать</Button>
                  <Button size="sm" variant="ghost" onClick={() => {if (confirm(`Удалить трек “${track.title}”?`)) deleteM.mutate(track.id);}} className="flex-1">Удалить</Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-surface)] p-8 text-center">
            <Music className="mx-auto h-12 w-12 text-[var(--text-muted)]" />
            <h3 className="mt-4 font-semibold">У вас пока нет треков</h3>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Загрузите свой первый трек, чтобы начать
            </p>
            <Link to="/upload" className="mt-4 inline-block">
              <Button>Загрузить трек</Button>
            </Link>
          </div>
        )}
      </div>
      {editingTrack && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={() => setEditingTrack(null)}>
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 font-semibold">Редактировать трек</h3>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3" />
            <div className="mt-4 flex gap-2">
              <Button onClick={() => updateM.mutate()} loading={updateM.isPending}>Сохранить</Button>
              <Button variant="secondary" onClick={() => setEditingTrack(null)}>Отмена</Button>
            </div>
          </div>
        </div>
      )}
      </div>
    </PageShell>
  );
}
