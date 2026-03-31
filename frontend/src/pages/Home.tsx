import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

import { api } from '../api/client';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { SectionHeader } from '../components/common/SectionHeader';
import { Skeleton } from '../components/common/Skeleton';
import { TrackCard } from '../components/track/TrackCard';
import type { Track } from '../types';

export function Home() {
  const trending = useQuery({
    queryKey: ['tracks', 'trending'],
    queryFn: () => api.get<Track[]>('/api/tracks/trending').then((r) => r.data),
  });
  const fresh = useQuery({
    queryKey: ['tracks', 'new'],
    queryFn: () => api.get<Track[]>('/api/tracks/new').then((r) => r.data),
  });

  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden rounded-card border border-[var(--border)] bg-gradient-to-br from-[var(--primary-light)] to-[var(--bg-surface)] p-8 md:p-12 dark:from-[#2a1020] dark:to-[var(--bg-surface)]">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative z-[1] max-w-xl">
          <h1 className="font-display text-4xl font-extrabold text-[var(--text-primary)] md:text-5xl">
            Музыка, которая с тобой на одной волне
          </h1>
          <p className="mt-4 text-lg text-[var(--text-secondary)]">
            Нота — стриминг нового поколения: умные рекомендации, волновая монетизация для артистов и плеер без остановки при
            навигации.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/search">
              <Button size="lg">Слушать</Button>
            </Link>
            <Link to="/for-artists">
              <Button size="lg" variant="secondary">
                Для артистов
              </Button>
            </Link>
          </div>
        </motion.div>
        <div className="pointer-events-none absolute -right-10 -top-10 h-64 w-64 rounded-full bg-[var(--primary)]/20 blur-3xl" />
      </section>

      <section>
        <SectionHeader title="Сейчас популярно" href="/search" />
        {trending.data?.length === 0 ? (
          <EmptyState title="Пока нет треков" description="Будь первым — загрузи свой трек!" action={{ label: 'Загрузить', href: '/upload' }} />
        ) : (
          <div className="hide-scrollbar" style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 8 }}>
            {trending.isLoading &&
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-52 w-40 shrink-0" />)}
            {trending.data?.map((t) => (
              <div key={t.id} style={{ flexShrink: 0, width: 160 }}>
                <TrackCard track={t} queue={trending.data} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeader title="Новые релизы" href="/discover" />
        {fresh.data?.length === 0 ? (
          <EmptyState title="Новых релизов пока нет" description="Скоро здесь появятся свежие треки" />
        ) : (
          <div className="hide-scrollbar" style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 8 }}>
            {fresh.isLoading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-52 w-40 shrink-0" />)}
            {fresh.data?.map((t) => (
              <div key={t.id} style={{ flexShrink: 0, width: 160 }}>
                <TrackCard track={t} queue={fresh.data ?? []} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
