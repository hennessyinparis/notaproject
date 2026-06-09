import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../api/client';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { SectionHeader } from '../components/common/SectionHeader';
import { Skeleton } from '../components/common/Skeleton';
import { HorizontalTrackShelf, HorizontalTrackShelfSlot } from '../components/track/HorizontalTrackShelf';
import { TrackCard } from '../components/track/TrackCard';
import { useAuthStore } from '../store/authStore';
import type { Track } from '../types';

export function Home() {
  const user = useAuthStore((s) => s.user);
  const isAuthed = !!user;
  const slides = [
    {
      title: 'Музыка, которая с тобой на одной волне',
      text: 'Нота — стриминг нового поколения: умные рекомендации, волновая монетизация для артистов и плеер без остановки при навигации.',
      actions: (
        <>
          <Link to="/search">
            <Button size="lg">Слушать</Button>
          </Link>
          <Link to="/for-artists">
            <Button size="lg" variant="secondary">
              Для артистов
            </Button>
          </Link>
        </>
      ),
    },
    {
      title: 'Для авторов и продюсеров',
      text: 'Твоя музыка — твои правила. Нота соединяет слушателей и артистов: глобальный плеер, лента подписок и честные инструменты роста.',
      actions: (
        <>
          {!isAuthed && (
            <Link to="/register">
              <Button size="lg">Начать бесплатно</Button>
            </Link>
          )}
          <Link to="/upload">
            <Button size="lg" variant="secondary">
              Загрузить трек
            </Button>
          </Link>
          <Link to="/subscriptions">
            <Button size="lg" variant="ghost">
              Тарифы
            </Button>
          </Link>
        </>
      ),
    },
  ];
  const [slide, setSlide] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setSlide((v) => (v + 1) % slides.length), 5500);
    return () => window.clearInterval(id);
  }, [slides.length]);

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
        <motion.div
          key={slide}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="relative z-[1] max-w-2xl"
        >
          <h1 className="font-display text-4xl font-extrabold text-[var(--text-primary)] md:text-5xl">
            {slides[slide].title}
          </h1>
          <p className="mt-4 text-lg text-[var(--text-secondary)]">
            {slides[slide].text}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {slides[slide].actions}
          </div>
          <div className="mt-5 flex gap-2">
            {slides.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setSlide(idx)}
                className={`h-2.5 rounded-full transition-all ${idx === slide ? 'w-6 bg-[var(--primary)]' : 'w-2.5 bg-[var(--border)]'}`}
                aria-label={`Слайд ${idx + 1}`}
              />
            ))}
          </div>
        </motion.div>
        <div className="pointer-events-none absolute -right-10 -top-10 h-64 w-64 rounded-full bg-[var(--primary)]/20 blur-3xl" />
      </section>

      <section>
        <SectionHeader title="Сейчас популярно" href="/search" />
        {trending.isError ? (
          <EmptyState title="Не удалось загрузить треки" description="Проверь, что бэкенд запущен на порту 8000" />
        ) : trending.data?.length === 0 ? (
          <EmptyState title="Пока нет треков" description="Будь первым — загрузи свой трек!" action={{ label: 'Загрузить', href: '/upload' }} />
        ) : (
          <HorizontalTrackShelf aria-label="Популярные треки">
            {trending.isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <HorizontalTrackShelfSlot key={i}>
                  <Skeleton className="h-52 w-full rounded-xl" />
                </HorizontalTrackShelfSlot>
              ))}
            {trending.data?.map((t) => (
              <HorizontalTrackShelfSlot key={t.id}>
                <TrackCard track={t} queue={trending.data} />
              </HorizontalTrackShelfSlot>
            ))}
          </HorizontalTrackShelf>
        )}
      </section>

      <section>
        <SectionHeader title="Новые релизы" href="/search" />
        {fresh.isError ? (
          <EmptyState title="Не удалось загрузить релизы" description="Проверь, что бэкенд запущен на порту 8000" />
        ) : fresh.data?.length === 0 ? (
          <EmptyState title="Новых релизов пока нет" description="Скоро здесь появятся свежие треки" />
        ) : (
          <HorizontalTrackShelf aria-label="Новые релизы">
            {fresh.isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <HorizontalTrackShelfSlot key={i}>
                  <Skeleton className="h-52 w-full rounded-xl" />
                </HorizontalTrackShelfSlot>
              ))}
            {fresh.data?.map((t) => (
              <HorizontalTrackShelfSlot key={t.id}>
                <TrackCard track={t} queue={fresh.data ?? []} />
              </HorizontalTrackShelfSlot>
            ))}
          </HorizontalTrackShelf>
        )}
      </section>
    </div>
  );
}
