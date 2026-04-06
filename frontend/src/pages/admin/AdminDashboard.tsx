import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  Ban,
  Headphones,
  LayoutDashboard,
  ListMusic,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Users,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { api } from '../../api/client';
import type { AdminStats } from './adminTypes';
import { admCard, admCardPad, admMain } from './adminStyles';

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
  accent?: 'default' | 'danger' | 'ok' | 'violet';
  icon: typeof Users;
}) {
  const ring =
    accent === 'danger'
      ? 'ring-red-500/15 dark:ring-red-400/20'
      : accent === 'ok'
        ? 'ring-emerald-500/15 dark:ring-emerald-400/20'
        : accent === 'violet'
          ? 'ring-violet-500/15 dark:ring-violet-400/20'
          : 'ring-[var(--primary)]/12';
  const iconBg =
    accent === 'danger'
      ? 'bg-red-500/12 text-red-600 dark:text-red-400'
      : accent === 'ok'
        ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
        : accent === 'violet'
          ? 'bg-violet-500/12 text-violet-600 dark:text-violet-400'
          : 'bg-[var(--primary)]/12 text-[var(--primary)]';
  const valueClass =
    accent === 'danger'
      ? 'text-red-600 dark:text-red-400'
      : accent === 'ok'
        ? 'text-emerald-600 dark:text-emerald-400'
        : accent === 'violet'
          ? 'text-violet-600 dark:text-violet-400'
          : 'text-[var(--text-primary)]';

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-card)] ring-1 ${ring}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
        </div>
      </div>
      <div className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
      <div className={`mt-1 text-3xl font-bold tabular-nums tracking-tight ${valueClass}`}>{value}</div>
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

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Users;
  children: ReactNode;
}) {
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

  const s = statsQ.data;
  const loading = statsQ.isLoading;

  return (
    <div className={admMain}>
      <AdminPageHeader
        icon={LayoutDashboard}
        title="Обзор платформы"
        description="Ключевые показатели в одном месте. Управление пользователями, треками и комментариями — в соответствующих разделах слева."
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <StatSkeleton key={i} />
          ))}
        </div>
      ) : (
        <>
          <Section title="Пользователи и доступ" icon={Users}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Всего пользователей" value={s?.users_count ?? '—'} icon={Users} />
              <StatCard
                label="Верифицированных"
                value={s?.verified_users_count ?? '—'}
                hint="Статус верификации меняется в разделе «Пользователи»"
                accent="ok"
                icon={Sparkles}
              />
              <StatCard
                label="Администраторов"
                value={s?.admin_users_count ?? '—'}
                accent="violet"
                icon={ShieldCheck}
              />
              <StatCard
                label="Заблокировано"
                value={s?.blocked_users_count ?? '—'}
                hint="Нет входа и обновления сессии"
                accent="danger"
                icon={Ban}
              />
            </div>
          </Section>

          <Section title="Контент" icon={ListMusic}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Треков всего" value={s?.tracks_count ?? '—'} icon={ListMusic} />
              <StatCard
                label="Публичных"
                value={s?.public_tracks_count ?? '—'}
                hint="Видны в ленте и поиске"
                accent="ok"
                icon={Eye}
              />
              <StatCard
                label="Скрытых"
                value={s?.hidden_tracks_count ?? '—'}
                hint="Не публичные (is_public = false)"
                icon={EyeOff}
              />
              <StatCard label="Плейлистов" value={s?.playlists_count ?? '—'} icon={ListMusic} />
            </div>
          </Section>

          <Section title="Активность" icon={Headphones}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Прослушиваний"
                value={s?.total_plays ?? '—'}
                hint="Сумма счётчиков plays_count по трекам"
                icon={Headphones}
              />
              <StatCard label="Комментариев" value={s?.comments_count ?? '—'} icon={MessageCircle} />
              <StatCard label="Сообщений (личка)" value={s?.messages_count ?? '—'} icon={MessageCircle} />
            </div>
          </Section>
        </>
      )}

      <div className={`${admCard} ${admCardPad}`}>
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--primary)]" aria-hidden />
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Быстрые действия</h3>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/admin/users"
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--primary)]/35 hover:text-[var(--primary)]"
          >
            Пользователи
          </Link>
          <Link
            to="/admin/tracks"
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--primary)]/35 hover:text-[var(--primary)]"
          >
            Треки
          </Link>
          <Link
            to="/admin/comments"
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--primary)]/35 hover:text-[var(--primary)]"
          >
            Комментарии
          </Link>
          <Link
            to="/"
            className="rounded-xl border border-dashed border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--primary)]/30 hover:text-[var(--primary)]"
          >
            На главную сайта
          </Link>
        </div>
      </div>
    </div>
  );
}
