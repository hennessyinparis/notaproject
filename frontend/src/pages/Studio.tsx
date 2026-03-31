import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Music, Play, TrendingUp, Upload } from 'lucide-react';

import { api } from '../api/client';
import { Button } from '../components/common/Button';
import { TrackCard } from '../components/track/TrackCard';
import { useAuthStore } from '../store/authStore';
import { formatNumber } from '../utils/format';
import type { Track } from '../types';

export function Studio() {
  const user = useAuthStore((s) => s.user);

  const tracksQ = useQuery({
    queryKey: ['my-tracks'],
    queryFn: () => api.get<Track[]>('/api/users/me/tracks').then((r) => r.data),
    enabled: !!user,
  });

  const statsQ = useQuery({
    queryKey: ['my-stats'],
    queryFn: () => 
      api.get<{ total: number }>('/api/analytics/plays').then((r) => r.data).catch(() => ({ total: 0 })),
    enabled: !!user,
  });

  const totalPlays = statsQ.data?.total || 0;
  const totalTracks = tracksQ.data?.length || 0;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Студия</h1>
          <p className="mt-1 text-[var(--text-secondary)]">Управление треками и статистика</p>
        </div>
        <Link to="/upload">
          <Button>
            <Upload className="mr-2 h-4 w-4" />
            Загрузить трек
          </Button>
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <div className="flex items-center gap-2 text-[var(--text-muted)]">
            <Music className="h-4 w-4" />
            <span className="text-sm">Треков</span>
          </div>
          <p className="mt-1 text-2xl font-bold">{totalTracks}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <div className="flex items-center gap-2 text-[var(--text-muted)]">
            <Play className="h-4 w-4" />
            <span className="text-sm">Прослушиваний</span>
          </div>
          <p className="mt-1 text-2xl font-bold">{formatNumber(totalPlays)}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <div className="flex items-center gap-2 text-[var(--text-muted)]">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm">Подписчиков</span>
          </div>
          <p className="mt-1 text-2xl font-bold">0</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <div className="flex items-center gap-2 text-[var(--text-muted)]">
            <span className="text-sm">Доход</span>
          </div>
          <p className="mt-1 text-2xl font-bold">0 ₽</p>
        </div>
      </div>

      <div className="mt-10">
        <h2 className="font-display text-xl font-bold">Мои треки</h2>
        
        {tracksQ.isLoading ? (
          <div className="mt-4 text-[var(--text-muted)]">Загрузка...</div>
        ) : tracksQ.data && tracksQ.data.length > 0 ? (
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
            {tracksQ.data.map((track) => (
              <TrackCard key={track.id} track={track} queue={tracksQ.data} />
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
    </div>
  );
}
