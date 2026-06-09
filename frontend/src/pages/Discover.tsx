import { useQuery } from '@tanstack/react-query';
import { Compass } from 'lucide-react';
import { Link } from 'react-router-dom';

import { api } from '../api/client';
import { PageShell } from '../components/layout/PageShell';
import { SectionHeader } from '../components/common/SectionHeader';
import { HorizontalTrackShelf } from '../components/track/HorizontalTrackShelf';
import { TrackCard } from '../components/track/TrackCard';
import type { Track } from '../types';

export function Discover() {
  const trending = useQuery({
    queryKey: ['tracks', 'trending'],
    queryFn: () => api.get<Track[]>('/api/tracks/trending?limit=24').then((r) => r.data),
  });
  const fresh = useQuery({
    queryKey: ['tracks', 'new'],
    queryFn: () => api.get<Track[]>('/api/tracks/new?limit=24').then((r) => r.data),
  });

  return (
    <PageShell
      title="Открытия"
      description="Популярное и свежие релизы на платформе"
      icon={<Compass className="h-7 w-7 text-[var(--primary)]" strokeWidth={2} aria-hidden />}
    >
      <div className="space-y-10">
        <SectionHeader title="В тренде" href="/search" />
        {trending.isLoading ? (
          <p className="text-sm text-[var(--text-muted)]">Загрузка…</p>
        ) : trending.isError ? (
          <p className="text-sm text-[var(--error)]">Не удалось загрузить треки</p>
        ) : (
          <HorizontalTrackShelf>
            {trending.data?.map((t) => (
              <TrackCard key={t.id} track={t} />
            ))}
          </HorizontalTrackShelf>
        )}

        <SectionHeader title="Новинки" href="/search" />
        {fresh.isLoading ? (
          <p className="text-sm text-[var(--text-muted)]">Загрузка…</p>
        ) : fresh.isError ? (
          <p className="text-sm text-[var(--error)]">Не удалось загрузить треки</p>
        ) : (
          <HorizontalTrackShelf>
            {fresh.data?.map((t) => (
              <TrackCard key={t.id} track={t} />
            ))}
          </HorizontalTrackShelf>
        )}

        <p className="text-center text-sm text-[var(--text-muted)]">
          <Link to="/search" className="font-semibold text-[var(--primary)] hover:underline">
            Расширенный поиск с фильтрами →
          </Link>
        </p>
      </div>
    </PageShell>
  );
}
