import { useQuery } from '@tanstack/react-query';
import { Gift, TrendingUp, TrendingDown, Minus, Calendar, Music, Headphones, Heart, Repeat2, MessageCircle, Users, DollarSign, Eye, Sparkles, BarChart3, PieChart, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';

import { api } from '../api/client';

type DetailedStats = {
  summary: {
    total_tracks: number;
    total_plays: number;
    total_likes: number;
    total_reposts: number;
    total_comments: number;
    followers_count: number;
    engagement_rate: number;
    avg_plays_per_track: number;
  };
  plays_over_time: Array<{
    date: string;
    plays: number;
    avg_seconds: number;
    completions: number;
  }>;
  plays_by_source: Record<string, number>;
  growth: {
    plays_this_week: number;
    plays_last_week: number;
    change_pct: number;
    direction: string;
  };
  best_day: { date: string; plays: number; avg_seconds: number; completions: number } | null;
  top_tracks: Array<{
    id: number;
    title: string;
    plays: number;
    likes: number;
    reposts: number;
    comments: number;
    cover_url: string | null;
    genre: string | null;
    engagement_rate: number;
    completion_rate: number;
    avg_listen_seconds: number;
  }>;
  tracks_breakdown: Array<{
    id: number;
    title: string;
    plays: number;
    likes: number;
    reposts: number;
    comments: number;
    cover_url: string | null;
    is_public: boolean;
    genre: string | null;
    avg_listen_seconds: number;
    completion_rate: number;
    engagement_rate: number;
  }>;
  donations: {
    total_rub: number;
    total_count: number;
    this_month_rub: number;
    this_month_count: number;
  };
  royalties: {
    pending_rub: number;
    paid_rub: number;
  };
  wave: {
    coefficient: number;
    forecast_rub: number;
  };
  recent_engagement: {
    likes_30_days: number;
    reposts_30_days: number;
  };
};

function StatCard({ icon: Icon, label, value, sub, trend }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  trend?: { value: number; up: boolean };
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 transition hover:shadow-md">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
          <p className="mt-0.5 text-xl font-bold tabular-nums text-[var(--text-primary)]">{value}</p>
          {sub && <p className="text-xs text-[var(--text-muted)]">{sub}</p>}
          {trend && (
            <p className={`mt-0.5 flex items-center gap-1 text-xs font-medium ${trend.up ? 'text-green-500' : 'text-red-500'}`}>
              {trend.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {trend.value}%
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniBar({ data, height = 120 }: { data: Array<{ label: string; value: number }>; height?: number }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((d) => (
        <div key={d.label} className="group relative flex flex-1 flex-col items-center justify-end h-full">
          <div
            className="w-full rounded-t bg-[var(--primary)]/70 transition-all hover:bg-[var(--primary)]"
            style={{ height: `${(d.value / max) * 100}%` }}
          />
          <div className="absolute -top-6 hidden whitespace-nowrap rounded bg-[var(--bg-elevated)] px-2 py-1 text-xs shadow group-hover:block">
            {d.label}: {d.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function SourcePie({ sources }: { sources: Record<string, number> }) {
  const total = Object.values(sources).reduce((a, b) => a + b, 0);
  const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500'];
  const labels: Record<string, string> = {
    feed: 'Лента',
    search: 'Поиск',
    profile: 'Профиль',
    embed: 'Встраивание',
    direct: 'Прямая',
    other: 'Другое',
  };
  return (
    <div className="space-y-2">
      {Object.entries(sources).map(([key, val], i) => (
        <div key={key} className="flex items-center gap-2 text-sm">
          <div className={`h-3 w-3 rounded-sm ${colors[i % colors.length]}`} />
          <span className="flex-1 text-[var(--text-secondary)]">{labels[key] || key}</span>
          <span className="font-medium tabular-nums text-[var(--text-primary)]">{val}</span>
          <span className="w-12 text-right text-[var(--text-muted)]">{total > 0 ? Math.round((val / total) * 100) : 0}%</span>
        </div>
      ))}
    </div>
  );
}

export function Analytics() {
  const detailed = useQuery({
    queryKey: ['analytics', 'detailed'],
    queryFn: () => api.get<DetailedStats>('/api/analytics/detailed').then((r) => r.data),
    refetchInterval: 30_000,
  });

  const data = detailed.data;
  const loading = detailed.isLoading;

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-3xl font-bold">Детальная аналитика</h1>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-[var(--bg-elevated)]" />
          ))}
        </div>
      </div>
    );
  }

  if (detailed.isError) {
    const status = (detailed.error as { response?: { status?: number } })?.response?.status;
    if (status === 403) {
      return (
        <div className="space-y-6">
          <h1 className="font-display text-3xl font-bold">Детальная аналитика</h1>
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-6 py-14 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--primary)]/10">
              <Lock className="h-8 w-8 text-[var(--primary)]" />
            </div>
            <div>
              <p className="text-lg font-bold text-[var(--text-primary)]">Функция Артист Про</p>
              <p className="mt-2 max-w-sm text-sm text-[var(--text-muted)]">
                Детальная аналитика — прослушивания по дням, рост, топ треков, источники, донаты и роялти — доступна только для подписчиков Артист Про.
              </p>
            </div>
            <Link
              to="/subscriptions"
              className="mt-2 rounded-xl bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Перейти к тарифам
            </Link>
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-6">
        <h1 className="font-display text-3xl font-bold">Аналитика</h1>
        <p className="text-[var(--error)]">Не удалось загрузить аналитику. Попробуйте обновить страницу.</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-3xl font-bold">Аналитика</h1>
        <p className="text-[var(--text-secondary)]">Нет данных для отображения.</p>
      </div>
    );
  }

  const s = data.summary;
  const srcTotal = Object.values(data.plays_by_source).reduce((a, b) => a + b, 0);
  const chartData = data.plays_over_time.map((d) => ({ label: d.date.slice(5), value: d.plays }));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold">Детальная аналитика</h1>
        <span className="text-xs text-[var(--text-muted)]">Обновляется каждые 30 с</span>
      </div>

      {/* сводка */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
        <StatCard icon={Music} label="Треки" value={s.total_tracks} />
        <StatCard icon={Headphones} label="Прослушивания" value={s.total_plays.toLocaleString()} />
        <StatCard icon={Heart} label="Лайки" value={s.total_likes.toLocaleString()} sub={`${s.engagement_rate}% конверсия`} />
        <StatCard icon={Repeat2} label="Репосты" value={s.total_reposts.toLocaleString()} />
        <StatCard icon={MessageCircle} label="Комментарии" value={s.total_comments.toLocaleString()} />
        <StatCard icon={Users} label="Подписчики" value={s.followers_count.toLocaleString()} />
        <StatCard icon={BarChart3} label="В среднем" value={s.avg_plays_per_track.toLocaleString()} sub="прослуш./трек" />
        <StatCard
          icon={data.growth.direction === 'up' ? TrendingUp : data.growth.direction === 'down' ? TrendingDown : Minus}
          label="Рост (неделя)"
          value={data.growth.plays_this_week.toLocaleString()}
          sub={`пред. ${data.growth.plays_last_week}`}
          trend={{ value: Math.abs(data.growth.change_pct), up: data.growth.direction === 'up' }}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* прослушивания по дням */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
          <h2 className="mb-4 flex items-center gap-2 font-semibold">
            <Calendar className="h-4 w-4 text-[var(--primary)]" />
            Прослушивания по дням (30 дн.)
          </h2>
          {chartData.length > 0 ? (
            <div className="pt-6">
              <MiniBar data={chartData} height={140} />
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-[var(--text-muted)]">Нет данных за этот период</p>
          )}
          {data.best_day && (
            <p className="mt-3 text-xs text-[var(--text-muted)]">
              Лучший день: <span className="font-medium text-[var(--text-primary)]">{data.best_day.date}</span> — {data.best_day.plays} прослушиваний
            </p>
          )}
        </div>

        {/* источники */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
          <h2 className="mb-4 flex items-center gap-2 font-semibold">
            <PieChart className="h-4 w-4 text-[var(--primary)]" />
            Источники прослушиваний
          </h2>
          {Object.keys(data.plays_by_source).length > 0 ? (
            <SourcePie sources={data.plays_by_source} />
          ) : (
            <p className="py-8 text-center text-sm text-[var(--text-muted)]">Нет данных</p>
          )}
          <p className="mt-2 text-xs text-[var(--text-muted)]">Всего: {srcTotal.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* донаты */}
        <div className={`rounded-xl border border-[var(--border)] p-5 ${data.donations.total_count > 0 ? 'bg-[var(--bg-surface)]' : 'bg-[var(--bg-surface)]/50'}`}>
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <Gift className="h-4 w-4 text-amber-500" />
            Донаты
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-[var(--text-muted)]">Всего</p>
              <p className="text-lg font-bold tabular-nums text-[var(--text-primary)]">{data.donations.total_rub.toLocaleString()} ₽</p>
              <p className="text-xs text-[var(--text-muted)]">{data.donations.total_count} транзакций</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">В этом месяце</p>
              <p className="text-lg font-bold tabular-nums text-[var(--text-primary)]">{data.donations.this_month_rub.toLocaleString()} ₽</p>
              <p className="text-xs text-[var(--text-muted)]">{data.donations.this_month_count} транзакций</p>
            </div>
          </div>
        </div>

        {/* роялти */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <DollarSign className="h-4 w-4 text-green-500" />
            Роялти
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-[var(--text-muted)]">В обработке</p>
              <p className="text-lg font-bold tabular-nums text-[var(--text-primary)]">{data.royalties.pending_rub.toLocaleString()} ₽</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Выплачено</p>
              <p className="text-lg font-bold tabular-nums text-[var(--text-primary)]">{data.royalties.paid_rub.toLocaleString()} ₽</p>
            </div>
          </div>
        </div>

        {/* волна */}
        <div className="rounded-xl border border-[var(--border)] bg-gradient-to-br from-purple-500/5 to-pink-500/5 p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <Sparkles className="h-4 w-4 text-purple-500" />
            Волна
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-[var(--text-muted)]">Коэффициент</p>
              <p className="text-lg font-bold tabular-nums text-[var(--text-primary)]">{data.wave.coefficient}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Прогноз выплаты</p>
              <p className="text-lg font-bold tabular-nums text-[var(--text-primary)]">{data.wave.forecast_rub.toLocaleString()} ₽</p>
            </div>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[var(--bg-elevated)]">
            <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all" style={{ width: `${data.wave.coefficient}%` }} />
          </div>
        </div>
      </div>

      {/* вовлечённость за 30 дней */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <Eye className="h-4 w-4 text-[var(--primary)]" />
          Вовлечённость (последние 30 дней)
        </h2>
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-xs text-[var(--text-muted)]">Лайков</p>
            <p className="text-lg font-bold tabular-nums text-[var(--text-primary)]">{data.recent_engagement.likes_30_days.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)]">Репостов</p>
            <p className="text-lg font-bold tabular-nums text-[var(--text-primary)]">{data.recent_engagement.reposts_30_days.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)]">Общий engagement</p>
            <p className="text-lg font-bold tabular-nums text-[var(--text-primary)]">{s.engagement_rate}%</p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)]">Avg. дослушиваний</p>
            <p className="text-lg font-bold tabular-nums text-[var(--text-primary)]">
              {data.plays_over_time.length > 0
                ? Math.round(data.plays_over_time.reduce((a, d) => a + d.completions, 0) / Math.max(data.plays_over_time.reduce((a, d) => a + d.plays, 0), 1) * 100)
                : 0}%
            </p>
          </div>
        </div>
      </div>

      {/* TOP треков */}
      {data.top_tracks.length > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
          <h2 className="mb-4 flex items-center gap-2 font-semibold">
            <TrendingUp className="h-4 w-4 text-[var(--primary)]" />
            Топ треков
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wider text-[var(--text-muted)]">
                  <th className="py-2 pr-2">#</th>
                  <th className="py-2 pr-2">Трек</th>
                  <th className="py-2 pr-2 text-right">Прослушивания</th>
                  <th className="py-2 pr-2 text-right">Лайки</th>
                  <th className="py-2 pr-2 text-right">Репосты</th>
                  <th className="py-2 pr-2 text-right">Комментарии</th>
                  <th className="py-2 pr-2 text-right">Eng.</th>
                  <th className="py-2 pr-2 text-right">Дослуш.</th>
                </tr>
              </thead>
              <tbody>
                {data.top_tracks.map((t, i) => (
                  <tr key={t.id} className="border-b border-[var(--border)]/50 transition hover:bg-[var(--bg-elevated)]/50">
                    <td className="py-2.5 pr-2 text-[var(--text-muted)]">{i + 1}</td>
                    <td className="py-2.5 pr-2">
                      <div className="flex items-center gap-2">
                        {t.cover_url ? (
                          <img src={t.cover_url} alt="" className="h-8 w-8 rounded object-cover" />
                        ) : (
                          <div className="h-8 w-8 rounded bg-[var(--bg-elevated)]" />
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[var(--text-primary)]">{t.title}</p>
                          {t.genre && <p className="text-xs text-[var(--text-muted)]">{t.genre}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 pr-2 text-right tabular-nums">{t.plays.toLocaleString()}</td>
                    <td className="py-2.5 pr-2 text-right tabular-nums">{t.likes.toLocaleString()}</td>
                    <td className="py-2.5 pr-2 text-right tabular-nums">{t.reposts.toLocaleString()}</td>
                    <td className="py-2.5 pr-2 text-right tabular-nums">{t.comments.toLocaleString()}</td>
                    <td className="py-2.5 pr-2 text-right tabular-nums">{t.engagement_rate}%</td>
                    <td className="py-2.5 pr-2 text-right tabular-nums">{t.completion_rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* полная таблица треков */}
      {data.tracks_breakdown.length > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
          <h2 className="mb-4 flex items-center gap-2 font-semibold">
            <BarChart3 className="h-4 w-4 text-[var(--primary)]" />
            Все треки — детальная статистика
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wider text-[var(--text-muted)]">
                  <th className="py-2 pr-2">Трек</th>
                  <th className="py-2 pr-2 text-right">Просл.</th>
                  <th className="py-2 pr-2 text-right">Лайки</th>
                  <th className="py-2 pr-2 text-right">Репосты</th>
                  <th className="py-2 pr-2 text-right">Комм.</th>
                  <th className="py-2 pr-2 text-right">Ср. прослуш.</th>
                  <th className="py-2 pr-2 text-right">Дослуш.</th>
                  <th className="py-2 pr-2 text-right">Eng.</th>
                  <th className="py-2 pr-2 text-right">Статус</th>
                </tr>
              </thead>
              <tbody>
                {data.tracks_breakdown.map((t) => (
                  <tr key={t.id} className="border-b border-[var(--border)]/50 transition hover:bg-[var(--bg-elevated)]/50">
                    <td className="py-2.5 pr-2">
                      <div className="flex items-center gap-2">
                        {t.cover_url ? (
                          <img src={t.cover_url} alt="" className="h-8 w-8 rounded object-cover" />
                        ) : (
                          <div className="h-8 w-8 rounded bg-[var(--bg-elevated)]" />
                        )}
                        <span className="truncate font-medium text-[var(--text-primary)]">{t.title}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-2 text-right tabular-nums">{t.plays.toLocaleString()}</td>
                    <td className="py-2.5 pr-2 text-right tabular-nums">{t.likes.toLocaleString()}</td>
                    <td className="py-2.5 pr-2 text-right tabular-nums">{t.reposts.toLocaleString()}</td>
                    <td className="py-2.5 pr-2 text-right tabular-nums">{t.comments.toLocaleString()}</td>
                    <td className="py-2.5 pr-2 text-right tabular-nums">{t.avg_listen_seconds.toFixed(1)}с</td>
                    <td className="py-2.5 pr-2 text-right tabular-nums">{t.completion_rate}%</td>
                    <td className="py-2.5 pr-2 text-right tabular-nums">{t.engagement_rate}%</td>
                    <td className="py-2.5 pr-2 text-right">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${t.is_public ? 'bg-green-500/10 text-green-500' : 'bg-amber-500/10 text-amber-500'}`}>
                        {t.is_public ? 'Публичный' : 'Черновик'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
