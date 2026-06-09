import {
  ChevronRight,
  ClipboardList,
  DollarSign,
  ExternalLink,
  Flag,
  GraduationCap,
  HandCoins,
  Megaphone,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Music2,
  Shield,
  ShieldAlert,
  Users,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { api } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { AdminThemeToggle } from './AdminThemeToggle';

function navClass({ isActive }: { isActive: boolean }) {
  return [
    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
    isActive
      ? 'bg-[var(--primary)]/14 text-[var(--primary)] shadow-sm ring-1 ring-[var(--primary)]/25'
      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]',
  ].join(' ');
}

function navEnd(to: string) {
  return to === '/admin/dashboard' || to === '/admin/tracks';
}

const navItems = [
  { to: '/admin/dashboard', label: 'Обзор', short: 'Обзор', icon: LayoutDashboard },
  { to: '/admin/users', label: 'Пользователи', short: 'Юзеры', icon: Users },
  { to: '/admin/tracks', label: 'Треки', short: 'Треки', icon: Music2 },
  { to: '/admin/tracks/blocked', label: 'Блокировки', short: 'Блоки', icon: ShieldAlert },
  { to: '/admin/comments', label: 'Комментарии', short: 'Чат', icon: MessageSquare },
  { to: '/admin/reports', label: 'Жалобы', short: 'Жалобы', icon: Flag },
  { to: '/admin/revenue', label: 'Доходы', short: 'Доход', icon: DollarSign },
  { to: '/admin/verifications', label: 'Верификация', short: 'Вер.', icon: GraduationCap },
  { to: '/admin/donations', label: 'Донаты', short: 'Дон.', icon: HandCoins },
  { to: '/admin/withdrawals', label: 'Выплаты', short: 'Выпл.', icon: DollarSign },
  { to: '/admin/ads', label: 'Реклама', short: 'Рекл.', icon: Megaphone },
  { to: '/admin/audit-logs', label: 'Аудит', short: 'Аудит', icon: ClipboardList },
] as const;

function headerMeta(pathname: string) {
  if (pathname.includes('/dashboard')) return { crumb: 'Обзор', hint: 'Сводка по платформе' };
  if (pathname.includes('/users')) return { crumb: 'Пользователи', hint: 'Учётные записи и права' };
  if (pathname.includes('/tracks/blocked')) return { crumb: 'Блокировки', hint: 'Треки, скрытые с витрины' };
  if (pathname.includes('/tracks')) return { crumb: 'Треки', hint: 'Модерация релизов' };
  if (pathname.includes('/comments')) return { crumb: 'Комментарии', hint: 'Сообщения под треками' };
  if (pathname.includes('/revenue')) return { crumb: 'Доходы', hint: 'Суммарная выручка от подписок' };
  if (pathname.includes('/ads')) return { crumb: 'Реклама', hint: 'Аудиоролики между треками' };
  if (pathname.includes('/reports')) return { crumb: 'Жалобы', hint: 'Модерация контента' };
  if (pathname.includes('/verifications')) return { crumb: 'Верификация', hint: 'Подтверждение статуса студента' };
  if (pathname.includes('/donations')) return { crumb: 'Донаты', hint: 'Все донаты на платформе' };
  if (pathname.includes('/withdrawals')) return { crumb: 'Выплаты', hint: 'Заявки артистов на вывод средств' };
  if (pathname.includes('/audit-logs')) return { crumb: 'Аудит', hint: 'Журнал действий пользователей и администраторов' };
  return { crumb: 'Админ', hint: 'Панель управления' };
}

export function AdminLayout() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const meta = useMemo(() => headerMeta(pathname), [pathname]);

  const { data: pendingCount } = useQuery({
    queryKey: ['admin-student-verifications-count'],
    queryFn: () => api.get<any[]>('/api/admin/student-verifications').then((r) => r.data.length),
    refetchInterval: 30_000,
  });

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      {/* Фон: мягкий градиент + сетка */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,var(--primary)_/0.12,transparent)] dark:bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,var(--primary)_/0.18,transparent)]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.35] dark:opacity-[0.2]"
        style={{
          backgroundImage: `linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }}
        aria-hidden
      />

      <aside
        className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-elevated)]/90 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.15)] backdrop-blur-md dark:shadow-[4px_0_32px_-8px_rgba(0,0,0,0.5)] md:flex"
        aria-label="Админ-навигация"
      >
        <div className="absolute left-0 top-0 h-24 w-full bg-gradient-to-b from-[var(--primary)]/10 to-transparent pointer-events-none" aria-hidden />
        <div className="relative border-b border-[var(--border)] p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--primary)]/25 to-[var(--primary)]/5 ring-1 ring-[var(--primary)]/30">
              <Shield className="h-5 w-5 text-[var(--primary)]" strokeWidth={2.25} aria-hidden />
            </div>
            <div className="min-w-0">
              <div className="truncate font-display text-base font-bold tracking-tight">Нота</div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Консоль
              </div>
            </div>
          </div>
        </div>
        <nav className="relative flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} end={navEnd(to)} to={to} className={navClass}>
              <Icon className="h-[18px] w-[18px] shrink-0 opacity-90" aria-hidden />
              <span className="flex-1 text-left">{label}</span>
              {to === '/admin/verifications' && pendingCount && pendingCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--primary)] px-1.5 text-[10px] font-bold text-white leading-none">
                  {pendingCount}
                </span>
              )}
              <ChevronRight className="h-4 w-4 shrink-0 opacity-25" aria-hidden />
            </NavLink>
          ))}
        </nav>
        <div className="relative border-t border-[var(--border)] p-4">
          <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
            Интерфейс модерации отделён от основного приложения. Тема синхронизируется с сайтом.
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg-surface)]/90 shadow-sm backdrop-blur-lg">
          <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <button
                type="button"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] transition-colors hover:border-[var(--primary)]/30 hover:text-[var(--primary)] md:hidden"
                aria-expanded={mobileNavOpen}
                aria-label={mobileNavOpen ? 'Закрыть меню' : 'Открыть меню'}
                onClick={() => setMobileNavOpen((o) => !o)}
              >
                {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] md:text-[11px]">
                  Нота · админ-панель
                </p>
                <h2 className="truncate font-display text-lg font-bold text-[var(--text-primary)] md:text-xl">
                  {meta.crumb}
                </h2>
                <p className="hidden text-xs text-[var(--text-muted)] sm:block">{meta.hint}</p>
              </div>
            </div>

            <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
              <AdminThemeToggle />
              <div className="hidden h-8 w-px bg-[var(--border)] sm:block" aria-hidden />
              <span className="hidden max-w-[160px] truncate text-xs text-[var(--text-secondary)] lg:inline xl:max-w-[220px]">
                <span className="font-medium text-[var(--text-primary)]">{user?.display_name}</span>{' '}
                <span className="text-[var(--text-muted)]">@{user?.username}</span>
              </span>
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--primary)]/35 hover:text-[var(--primary)]"
              >
                На сайт
                <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden />
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--error)] transition-colors hover:bg-[var(--error)]/10"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden />
                Выход
              </button>
            </div>
          </div>

          {mobileNavOpen && (
            <nav
              className="flex flex-col gap-1 border-t border-[var(--border)] bg-[var(--bg-elevated)]/95 p-3 backdrop-blur-md md:hidden"
              aria-label="Мобильная навигация"
            >
              {navItems.map(({ to, label, short, icon: Icon }) => (
                <NavLink
                  key={to}
                  end={navEnd(to)}
                  to={to}
                  className={navClass}
                  onClick={() => setMobileNavOpen(false)}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0 opacity-90" aria-hidden />
                  <span className="sm:hidden">{short}</span>
                  <span className="hidden sm:inline">{label}</span>
                </NavLink>
              ))}
            </nav>
          )}
        </header>

        <main className="relative flex-1 overflow-x-hidden overflow-y-auto px-4 py-6 md:px-8 md:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
