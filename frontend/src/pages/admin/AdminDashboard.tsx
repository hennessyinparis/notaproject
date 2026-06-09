import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  Calendar,
  Flag,
  Headphones,
  LayoutDashboard,
  ListMusic,
  MessageCircle,
  Music2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
  Eye,
  EyeOff,
  DollarSign,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { api } from '../../api/client';
import type { AdminStats, DetailedStats, SubscriptionRevenue } from './adminTypes';
import { formatRub } from './adminPlanLabels';
import { admCard, admCardPad, admMain, admRow } from './adminStyles';

function StatCard({
  label,
  value,
  hint,
  accent = 'default',
  icon: Icon,
}: {
  label: string;
  value: number | string;
  hint?: string;
  accent?: 'default' | 'danger' | 'ok' | 'violet' | 'warning';
  icon: typeof Users;
}) {
  const ringMap: Record<string, string> = {
    danger: 'ring-red-500/15 dark:ring-red-400/20',
    ok: 'ring-emerald-500/15 dark:ring-emerald-400/20',
    violet: 'ring-violet-500/15 dark:ring-violet-400/20',
    warning: 'ring-yellow-500/15 dark:ring-yellow-400/20',
    default: 'ring-[var(--primary)]/12',
  };
  const iconBgMap: Record<string, string> = {
    danger: 'bg-red-500/12 text-red-600 dark:text-red-400',
    ok: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
    violet: 'bg-violet-500/12 text-violet-600 dark:text-violet-400',
    warning: 'bg-yellow-500/12 text-yellow-600 dark:text-yellow-400',
    default: 'bg-[var(--primary)]/12 text-[var(--primary)]',
  };
  const valueMap: Record<string, string> = {
    danger: 'text-red-600 dark:text-red-400',
    ok: 'text-emerald-600 dark:text-emerald-400',
    violet: 'text-violet-600 dark:text-violet-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    default: 'text-[var(--text-primary)]',
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-card)] ring-1 ${ringMap[accent]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBgMap[accent]}`}>
          <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
        </div>
      </div>
      <div className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
      <div className={`mt-1 text-3xl font-bold tabular-nums tracking-tight ${valueMap[accent]}`}>{value}</div>
      {hint ? <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">{hint}</p> : null}
    </div>
  );
}

function StatSkeleton() {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
      <div className="h-11 w-11 animate-pulse rounded-xl bg-[var(--bg-elevated)]" />
      <div className="mt-4 h-3 w-24 animate-pulse rounded bg-[var(--bg-elevated)]" />
      <div className="mt-2 h-9 w-16 animate-pulse rounded bg-[var(--bg-elevated)]" />
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Users; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2.5 px-0.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--bg-elevated)] text-[var(--primary)] ring-1 ring-[var(--border)]">
          <Icon className="h-4 w-4" aria-hidden />
        </div>
        <h2 className="text-sm font-bold tracking-tight text-[var(--text-primary)]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function AdminDashboard() {
  const statsQ = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get<AdminStats>('/api/admin/stats').then((r) => r.data),
  });
  const detailedQ = useQuery({
    queryKey: ['admin-stats-detailed'],
    queryFn: () => api.get<DetailedStats>('/api/admin/stats/detailed').then((r) => r.data),
  });
  const revenueQ = useQuery({
    queryKey: ['subscription-revenue'],
    queryFn: () => api.get<SubscriptionRevenue>('/api/admin/subscription-revenue').then((r) => r.data),
  });

  const s = statsQ.data;
  const d = detailedQ.data;
  const r = revenueQ.data;
  const loading = statsQ.isLoading;

  return (
    <div className={`${admMain} pb-28`}>
      <AdminPageHeader
        icon={LayoutDashboard}
        title="Обзор платформы"
        description="Ключевые показатели в одном месте. Управление пользователями, треками и комментариями — в соответствующих разделах слева."
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => <StatSkeleton key={i} />)}
        </div>
      ) : (
        <>
          <Section title="Пользователи и доступ" icon={Users}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Всего пользователей" value={s?.users_count ?? '—'} icon={Users} />
              <StatCard label="Зарегистрировано сегодня" value={s?.users_today_count ?? '—'} icon={UserPlus} />
              <StatCard label="Верифицированных" value={s?.verified_users_count ?? '—'} hint="Статус верификации меняется в разделе «Пользователи»" accent="ok" icon={Sparkles} />
              <StatCard label="Администраторов" value={s?.admin_users_count ?? '—'} accent="violet" icon={ShieldCheck} />
            </div>
          </Section>

          <Section title="Контент" icon={ListMusic}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Треков всего" value={s?.tracks_count ?? '—'} icon={ListMusic} />
              <StatCard label="Публичных" value={s?.public_tracks_count ?? '—'} hint="Видны в ленте и поиске" accent="ok" icon={Eye} />
              <StatCard label="Скрытых" value={s?.hidden_tracks_count ?? '—'} hint="Не публичные (is_public = false)" icon={EyeOff} />
              <StatCard label="Плейлистов" value={s?.playlists_count ?? '—'} icon={ListMusic} />
            </div>
          </Section>

          <Section title="Активность" icon={Headphones}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Всего прослушиваний" value={(s?.total_plays ?? 0).toLocaleString('ru-RU')} hint="Сумма plays_count по трекам" icon={Headphones} />
              <StatCard label="Комментариев" value={s?.comments_count ?? '—'} icon={MessageCircle} />
              <StatCard label="Сообщений" value={s?.messages_count ?? '—'} icon={MessageCircle} />
            </div>
          </Section>

          <Section title="Жалобы" icon={Flag}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Ожидают" value={s?.reports_pending_count ?? '—'} hint="Требуют модерации" accent="warning" icon={Clock} />
              <StatCard label="Принято" value={s?.reports_resolved_count ?? '—'} hint="Контент заблокирован" accent="danger" icon={CheckCircle} />
              <StatCard label="Отклонено" value={s?.reports_dismissed_count ?? '—'} hint="Нарушений не найдено" icon={XCircle} />
            </div>
          </Section>

          <Section title="Доходы" icon={DollarSign}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="MRR от подписок" value={r != null ? formatRub(r.total_revenue) : '—'} hint={r != null ? `${r.active_subscriptions} активных` : undefined} accent="ok" icon={DollarSign} />
            </div>
          </Section>

          <div className="grid gap-6 lg:grid-cols-2">
            {d?.top_tracks && d.top_tracks.length > 0 && (
              <div className={`${admCard} ${admCardPad}`}>
                <div className="mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-[var(--primary)]" />
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">Топ-5 треков по прослушиваниям</h3>
                </div>
                <div className="space-y-2">
                  {d.top_tracks.map((t, i) => (
                    <div key={t.id} className={`${admRow} gap-3 p-3`}>
                      <span className="w-5 text-center text-xs font-bold text-[var(--text-muted)]">{i + 1}</span>
                      {t.cover_url ? (
                        <img src={t.cover_url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-black/10" />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-elevated)] text-[var(--text-muted)] ring-1 ring-[var(--border)]">
                          <Music2 className="h-4 w-4" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <Link to={`/track/${t.id}`} className="truncate text-sm font-semibold text-[var(--text-primary)] hover:underline">
                          {t.title}
                        </Link>
                        <p className="text-xs text-[var(--text-muted)]">{t.artist_display || t.artist}</p>
                      </div>
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-[var(--text-secondary)]">
                        {t.plays.toLocaleString('ru-RU')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {d?.recent_users && d.recent_users.length > 0 && (
              <div className={`${admCard} ${admCardPad}`}>
                <div className="mb-3 flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-[var(--primary)]" />
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">Новые пользователи</h3>
                </div>
                <div className="space-y-2">
                  {d.recent_users.map((u) => (
                    <div key={u.id} className={`${admRow} gap-3 p-3`}>
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-black/10" />
                      ) : (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--primary-light)] to-[var(--primary)]/20 text-xs font-bold text-[var(--primary)] ring-1 ring-[var(--primary)]/20">
                          {(u.display_name || u.username)[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <Link to={`/artist/${u.username}`} className="truncate text-sm font-semibold text-[var(--text-primary)] hover:underline">
                          {u.display_name || u.username}
                        </Link>
                        <p className="text-xs text-[var(--text-muted)]">@{u.username} · {u.tracks_count} треков</p>
                      </div>
                      <span className="shrink-0 text-[10px] text-[var(--text-muted)]">
                        <Calendar className="mr-1 inline h-3 w-3" />
                        {new Date(u.created_at).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-40 md:left-64">
        <div className={`${admCard} ${admCardPad} mx-auto mb-4 max-w-6xl shadow-[0_-4px_20px_-8px_rgba(0,0,0,0.15)]`}>
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--primary)]" aria-hidden />
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Быстрые действия</h3>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/admin/users" className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--primary)]/35 hover:text-[var(--primary)]">Пользователи</Link>
            <Link to="/admin/tracks" className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--primary)]/35 hover:text-[var(--primary)]">Треки</Link>
            <Link to="/admin/comments" className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--primary)]/35 hover:text-[var(--primary)]">Комментарии</Link>
            <Link to="/admin/revenue" className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--primary)]/35 hover:text-[var(--primary)]">Доходы</Link>
            <Link to="/admin/reports" className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--primary)]/35 hover:text-[var(--primary)]">Жалобы</Link>
            <Link to="/admin/ads" className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--primary)]/35 hover:text-[var(--primary)]">Реклама</Link>
            <Link to="/" className="rounded-xl border border-dashed border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--primary)]/30 hover:text-[var(--primary)]">На главную сайта</Link>
          </div>
        </div>
      </div>

    </div>
  );
}
