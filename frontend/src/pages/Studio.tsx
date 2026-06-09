import { useMutation, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import {
  Gift,
  Heart,
  MessageCircle,
  Music,
  Play,
  Repeat2,
  Sparkles,
  TrendingUp,
  Upload,
  BarChart3,
  HandCoins,
  Users,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

import { api } from '../api/client';
import { Button } from '../components/common/Button';
import { PageShell } from '../components/layout/PageShell';
import { useAuthStore } from '../store/authStore';
import { formatNumber } from '../utils/format';

interface StudioData {
  total_tracks: number;
  total_plays: number;
  total_likes: number;
  total_reposts: number;
  total_comments: number;
  followers_count: number;
  is_pro: boolean;
  tracks: Array<{
    id: number;
    title: string;
    genre: string | null;
    plays_count: number;
    likes_count: number;
    reposts_count: number;
    comments_count: number;
    cover_url: string | null;
    is_public: boolean;
    duration_seconds: number;
    created_at: string;
  }>;
  plays_daily: Array<{ date: string; plays: number }>;
  donations: {
    total_rub: number;
    total_count: number;
    this_month_rub: number;
    this_month_count: number;
  };
  royalties: { pending_rub: number; paid_rub: number };
  wave?: { coefficient: number; forecast_rub: number };
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent = false,
}: {
  icon: typeof Music;
  label: string;
  value: string | number;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-[var(--shadow-hover)] ring-1 ${
        accent
          ? 'border-[var(--primary)]/30 bg-gradient-to-br from-[var(--primary)]/8 to-transparent ring-[var(--primary)]/15'
          : 'border-[var(--border)] bg-[var(--bg-surface)] ring-black/[0.04] dark:ring-white/[0.06]'
      }`}
    >
      <div className="flex items-center gap-2 text-[var(--text-muted)]">
        <Icon className="h-4 w-4 shrink-0" />
        <span className="text-sm">{label}</span>
      </div>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${accent ? 'text-[var(--primary)]' : 'text-[var(--text-primary)]'}`}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{hint}</p>}
    </div>
  );
}

function MiniChart({ data }: { data: Array<{ date: string; plays: number }> }) {
  if (!data.length) return <p className="text-sm text-[var(--text-muted)]">Нет данных за 14 дней</p>;
  const maxVal = Math.max(...data.map((d) => d.plays), 1);
  return (
    <div className="flex items-end gap-[3px]" style={{ height: 120 }}>
      {data.map((d) => {
        const h = (d.plays / maxVal) * 100;
        return (
          <div
            key={d.date}
            className="flex flex-1 flex-col items-center gap-1"
            title={`${d.date}: ${d.plays} прослушиваний`}
          >
            <span className="text-[8px] font-medium text-[var(--text-muted)]">{d.plays}</span>
            <div
              className="w-full rounded-t bg-gradient-to-t from-[var(--primary)]/60 to-[var(--primary)]/30 transition-all"
              style={{ height: `${Math.max(h, 3)}%`, minHeight: 3 }}
            />
            <span className="text-[7px] text-[var(--text-muted)]">{d.date.slice(5)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Studio() {
  const user = useAuthStore((s) => s.user);
  const studioQ = useQuery<StudioData, Error>({
    queryKey: ['studio-dashboard'],
    queryFn: () => api.get<StudioData>('/api/analytics/studio').then((r) => r.data),
    enabled: !!user,
    refetchInterval: 15_000,
  });

  useEffect(() => {
    if (studioQ.error) {
      const err = studioQ.error as any;
      console.error('[Studio] API error:', err);
      toast.error('Ошибка загрузки студии: ' + (err?.response?.data?.detail || err.message));
    }
  }, [studioQ.error]);

  const data = studioQ.data;
  const isPro = data?.is_pro ?? false;

  const [editingTrack, setEditingTrack] = useState<{ id: number; title: string } | null>(null);
  const [title, setTitle] = useState('');

  const updateM = useMutation({
    mutationFn: async () => {
      if (!editingTrack) return;
      await api.patch(`/api/tracks/${editingTrack.id}`, { title });
    },
    onSuccess: async () => {
      toast.success('Трек обновлён');
      setEditingTrack(null);
      await studioQ.refetch();
    },
  });

  const deleteM = useMutation({
    mutationFn: async (id: number) => api.delete(`/api/tracks/${id}`),
    onSuccess: async () => {
      toast.success('Трек удалён');
      await studioQ.refetch();
    },
  });

  if (studioQ.isError) {
    return (
      <PageShell title="Студия" description="Ошибка загрузки данных" icon={<Music className="h-7 w-7 text-[var(--primary)]" strokeWidth={2} aria-hidden />}>
        <div className="mx-auto max-w-6xl text-center">
          <p className="text-red-500">Ошибка загрузки студии</p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            {String((studioQ.error as any)?.response?.data?.detail || (studioQ.error as any)?.message || 'Неизвестная ошибка')}
          </p>
          <Button className="mt-4" onClick={() => studioQ.refetch()}>Повторить</Button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Студия"
      description={isPro ? 'Расширенная статистика, донаты и аналитика' : 'Ваши треки и базовая статистика'}
      icon={<Music className="h-7 w-7 text-[var(--primary)]" strokeWidth={2} aria-hidden />}
      actions={
        <div className="flex items-center gap-2">
          {!isPro && (
            <Link to="/subscriptions">
              <Button variant="secondary" size="sm">
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Артист Про
              </Button>
            </Link>
          )}
          <Link to="/upload">
            <Button size="sm">
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Загрузить
            </Button>
          </Link>
        </div>
      }
    >
      <div className="mx-auto max-w-6xl space-y-8">
        {/* ----- Ключевые показатели ----- */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[var(--primary)]" />
            <h2 className="font-display text-base font-bold text-[var(--text-primary)]">Обзор</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <StatCard icon={Music} label="Треков" value={data?.total_tracks ?? '—'} />
            <StatCard icon={Play} label="Прослушиваний" value={formatNumber(data?.total_plays ?? 0)} />
            <StatCard icon={Heart} label="Лайков" value={formatNumber(data?.total_likes ?? 0)} />
            <StatCard icon={Repeat2} label="Репостов" value={formatNumber(data?.total_reposts ?? 0)} />
            <StatCard icon={Users} label="Подписчиков" value={data?.followers_count ?? 0} />
            <StatCard icon={MessageCircle} label="Комментариев" value={formatNumber(data?.total_comments ?? 0)} />
          </div>
        </div>

        {/* ----- Pro-блок: Доходы + Донаты + Волна ----- */}
        {isPro && (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--primary)]" />
              <h2 className="font-display text-base font-bold text-[var(--text-primary)]">
                Монетизация
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <StatCard
                icon={Wallet}
                label="Доход"
                value={data?.royalties?.pending_rub ? `${data.royalties.pending_rub} ₽` : '0 ₽'}
                hint={`выплачено ${data?.royalties?.paid_rub ?? 0} ₽`}
                accent
              />
              <StatCard
                icon={HandCoins}
                label="Донатов получено"
                value={data?.donations?.total_rub ? `${data.donations.total_rub} ₽` : '0 ₽'}
                hint={
                  data?.donations?.total_count
                    ? `${data.donations.this_month_rub} ₽ в этом месяце · ${data.donations.total_count} всего`
                    : 'нет донатов'
                }
                accent
              />
              <StatCard
                icon={TrendingUp}
                label="Волна"
                value={data?.wave?.coefficient ?? '—'}
                hint={`прогноз: ${data?.wave?.forecast_rub ?? 0} ₽`}
                accent
              />
            </div>
          </div>
        )}

        {/* ----- Pro-блок: График прослушиваний ----- */}
        {isPro && data?.plays_daily && data.plays_daily.length > 0 && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-hover)] ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
            <div className="mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[var(--primary)]" />
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                Прослушивания за 14 дней
              </h3>
              <span className="ml-auto text-xs text-[var(--text-muted)]">
                {data.plays_daily.reduce((a, b) => a + b.plays, 0)} всего
              </span>
            </div>
            <MiniChart data={data.plays_daily} />
          </div>
        )}

        {/* ----- Pro-блок: Донаты (график) ----- */}
        {isPro && (data?.donations?.total_count ?? 0) > 0 && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-hover)]">
            <div className="mb-2 flex items-center gap-2">
              <Gift className="h-4 w-4 text-[var(--primary)]" />
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Донаты</h3>
              <span className="ml-auto text-xs text-[var(--text-muted)]">
                {data?.donations?.this_month_rub ?? 0} ₽ в этом месяце
              </span>
            </div>
            <div className="flex items-baseline gap-4">
              <p className="text-3xl font-bold text-[var(--primary)]">
                {data?.donations?.total_rub ?? 0} ₽
              </p>
              <p className="text-sm text-[var(--text-muted)]">
                {data?.donations?.total_count ?? 0} транзакций
              </p>
            </div>
          </div>
        )}

        {/* ----- Треки с показом статистики по каждому ----- */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-[var(--text-primary)]">Мои треки</h2>
          </div>

          {studioQ.isLoading ? (
            <div className="text-sm text-[var(--text-muted)]">Загрузка...</div>
          ) : data?.tracks && data.tracks.length > 0 ? (
            <div className="space-y-4">
              {data.tracks.map((track) => (
                <div key={track.id} className="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-3 shadow-[var(--shadow-hover)] ring-1 ring-black/[0.04] transition hover:shadow-md dark:ring-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--bg-elevated)] ring-1 ring-[var(--border)]">
                      {track.cover_url ? (
                        <img src={track.cover_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Music className="h-5 w-5 text-[var(--text-muted)]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/track/${track.id}`}
                        className="truncate text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--primary)]"
                      >
                        {track.title}
                      </Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[var(--text-muted)]">
                        <span className="flex items-center gap-1">
                          <Play className="h-3 w-3" />
                          {formatNumber(track.plays_count)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart className="h-3 w-3" />
                          {track.likes_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <Repeat2 className="h-3 w-3" />
                          {track.reposts_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" />
                          {track.comments_count}
                        </span>
                        {!track.is_public && <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-600 dark:text-amber-400">скрыт</span>}
                        {track.genre && <span>{track.genre}</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setEditingTrack({ id: track.id, title: track.title });
                          setTitle(track.title);
                        }}
                      >
                        Ред.
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Удалить трек "${track.title}"?`)) deleteM.mutate(track.id);
                        }}
                      >
                        Удалить
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-surface)] p-8 text-center">
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

        {/* ----- Редактор трека ----- */}
        {editingTrack && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
            onClick={() => setEditingTrack(null)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="mb-3 font-semibold">Редактировать трек</h3>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3 text-sm"
              />
              <div className="mt-4 flex gap-2">
                <Button onClick={() => updateM.mutate()} loading={updateM.isPending}>
                  Сохранить
                </Button>
                <Button variant="secondary" onClick={() => setEditingTrack(null)}>
                  Отмена
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
