import { Bell, Home, Menu, MessageCircle, Moon, Music, Search, Shield, Sun, Upload, User, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { api } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { useSearchHistory } from '../../hooks/useSearchHistory';
import { Button } from '../common/Button';

const linkCls = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-[var(--primary-light)] text-[var(--primary)]'
      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
  }`;

const loginBtnCls =
  'inline-flex items-center justify-center rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--bg-elevated)] max-md:px-2.5 max-md:text-xs';

const registerBtnCls =
  'inline-flex items-center justify-center rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white transition hover:opacity-95 max-md:px-2.5 max-md:text-xs max-md:whitespace-nowrap';

function useDebouncedCallback<T extends (...args: unknown[]) => void>(cb: T, ms: number) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cbRef = useRef(cb);
  useEffect(() => { cbRef.current = cb; }, [cb]);
  return useMemo(
    () =>
      (...args: Parameters<T>) => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => cbRef.current(...args), ms);
      },
    [ms]
  );
}

function SearchBar() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [focused, setFocused] = useState(false);
  const { items: history, add: addToHistory, remove: removeFromHistory, clear: clearHistory } = useSearchHistory();
  const apiBase = import.meta.env.VITE_API_URL || '';

  useEffect(() => {
    setQuery(searchParams.get('q') || '');
  }, [searchParams]);

  const debouncedNavigate = useDebouncedCallback((url: unknown) => navigate(String(url)), 300);
  const quickResults = useQuery({
    queryKey: ['quick-search', query],
    queryFn: () =>
      api
        .get<{
          tracks: Array<{
            id: number; title: string; cover_url?: string | null;
            user?: { username: string; display_name: string; avatar_url?: string | null }
          }>;
          users: Array<{ id: number; username: string; display_name: string; avatar_url?: string | null }>;
        }>(`/api/search?q=${encodeURIComponent(query)}`)
        .then((r) => r.data),
    enabled: query.trim().length >= 2,
  });

  const showDropdown = focused && (query.trim().length >= 2 || history.length > 0);

  const imgSrc = (url?: string | null) => url ? (url.startsWith('http') ? url : `${apiBase}${url}`) : undefined;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const q = query.trim();
        if (q) navigate(`/search?q=${encodeURIComponent(q)}`);
      }}
      className="hidden flex-1 md:block"
    >
      <div className="relative mx-6 max-w-[480px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            const trimmed = v.trim();
            if (trimmed.length > 1) {
              debouncedNavigate(`/search?q=${encodeURIComponent(trimmed)}`);
            }
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 120)}
          placeholder="Поиск треков, артистов, плейлистов..."
          className="w-full rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-10 py-2 text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary)]"
          aria-label="Поиск"
        />
        {showDropdown && (
          <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-2 shadow-[var(--shadow-card)]">
            {query.trim().length < 2 && history.length > 0 && (
              <>
                <div className="mb-1 flex items-center justify-between px-3 py-1">
                  <span className="text-xs font-semibold text-[var(--text-secondary)]">Недавние</span>
                  <button
                    type="button"
                    onClick={clearHistory}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    Очистить
                  </button>
                </div>
                {history.map((h) => (
                  <div key={`${h.type}-${h.id}`} className="group flex items-center">
                    <button
                      type="button"
                      onClick={() => {
                        addToHistory(h);
                        navigate(h.type === 'track' ? `/track/${h.id}` : `/artist/${h.id}`);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--bg-elevated)]"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--bg-elevated)] ring-1 ring-black/5 dark:ring-white/10">
                        {h.image ? (
                          <img src={imgSrc(h.image)} alt="" className="h-full w-full object-cover" />
                        ) : h.type === 'track' ? (
                          <Music className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                        ) : (
                          <User className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{h.title}</div>
                        <div className="truncate text-xs text-[var(--text-secondary)]">{h.subtitle}</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFromHistory(h)}
                      className="mr-1 rounded-lg p-1.5 opacity-0 transition-opacity hover:bg-[var(--bg-elevated)] group-hover:opacity-100"
                      aria-label="Удалить"
                    >
                      <X className="h-3 w-3 text-[var(--text-muted)]" />
                    </button>
                  </div>
                ))}
              </>
            )}
            {query.trim().length >= 2 && (
              <>
                {(quickResults.data?.tracks?.slice(0, 3) ?? []).map((t) => (
                  <button
                    key={`t-${t.id}`}
                    type="button"
                    onClick={() => {
                      addToHistory({ id: t.id, type: 'track', title: t.title, subtitle: t.user?.display_name ?? 'Трек', image: t.cover_url });
                      navigate(`/track/${t.id}`);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--bg-elevated)]"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded bg-[var(--bg-elevated)] ring-1 ring-black/5 dark:ring-white/10">
                      {t.cover_url ? (
                        <img src={imgSrc(t.cover_url)} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Music className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{t.title}</div>
                      <div className="truncate text-xs text-[var(--text-secondary)]">{t.user?.display_name ?? 'Трек'}</div>
                    </div>
                  </button>
                ))}
                {(quickResults.data?.users?.slice(0, 3) ?? []).map((u) => (
                  <button
                    key={`u-${u.id}`}
                    type="button"
                    onClick={() => {
                      addToHistory({ id: u.username, type: 'artist', title: u.display_name, subtitle: `@${u.username}`, image: u.avatar_url });
                      navigate(`/artist/${u.username}`);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--bg-elevated)]"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--bg-elevated)] ring-1 ring-black/5 dark:ring-white/10">
                      {u.avatar_url ? (
                        <img src={imgSrc(u.avatar_url)} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <User className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{u.display_name}</div>
                      <div className="truncate text-xs text-[var(--text-secondary)]">@{u.username}</div>
                    </div>
                  </button>
                ))}
                {!quickResults.isLoading &&
                (quickResults.data?.tracks?.length ?? 0) + (quickResults.data?.users?.length ?? 0) === 0 ? (
                  <div className="px-3 py-2 text-xs text-[var(--text-muted)]">Ничего не найдено</div>
                ) : null}
              </>
            )}
          </div>
        )}
      </div>
    </form>
  );
}

function UserMenu() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };

  const handleMouseLeave = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  };

  const handleLogout = () => {
    logout();
    nav('/');
  };

  if (!user) return null;

  const apiBase = import.meta.env.VITE_API_URL || '';
  const avatarSrc =
    user.avatar_url &&
    (user.avatar_url.startsWith('http') ? user.avatar_url : `${apiBase}${user.avatar_url}`);

  return (
    <div className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button
        type="button"
        className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] p-1 pr-3 shadow-sm ring-1 ring-black/[0.04] transition hover:bg-[var(--bg-elevated)] dark:ring-white/[0.06]"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--primary-light)] text-[var(--primary)] ring-2 ring-[var(--bg-base)]">
          {avatarSrc ? (
            <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
          ) : (
            <User className="h-4 w-4" />
          )}
        </div>
        <span className="hidden max-w-[120px] truncate text-sm md:inline">{user.display_name}</span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 min-w-[200px] rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-2 shadow-card"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <Link
            to={`/artist/${user.username}`}
            className="block rounded-lg px-3 py-2 text-sm hover:bg-[var(--bg-elevated)]"
            onClick={() => setOpen(false)}
          >
            Профиль
          </Link>
          {!user.is_admin && (
            <Link
              to="/studio"
              className="block rounded-lg px-3 py-2 text-sm hover:bg-[var(--bg-elevated)]"
              onClick={() => setOpen(false)}
            >
              Студия
            </Link>
          )}
          {!user.is_admin && (
            <Link
              to="/library"
              className="block rounded-lg px-3 py-2 text-sm hover:bg-[var(--bg-elevated)]"
              onClick={() => setOpen(false)}
            >
              Библиотека
            </Link>
          )}
          <Link
            to="/settings"
            className="block rounded-lg px-3 py-2 text-sm hover:bg-[var(--bg-elevated)]"
            onClick={() => setOpen(false)}
          >
            Настройки
          </Link>
          {user.is_admin && (
            <Link
              to="/admin/dashboard"
              className="block rounded-lg px-3 py-2 text-sm hover:bg-[var(--bg-elevated)]"
              onClick={() => setOpen(false)}
            >
              Админка
            </Link>
          )}
          <button
            type="button"
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--error)] hover:bg-[var(--bg-elevated)]"
            onClick={handleLogout}
          >
            Выход
          </button>
        </div>
      )}
    </div>
  );
}

export function Navbar() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const { mode, setMode } = useThemeStore();
  const isAuthed = !!accessToken && !!user;
  const unreadQ = useQuery({
    queryKey: ['messages', 'conversations', 'unread'],
    queryFn: () => api.get<Array<{ unread_count: number }>>('/api/messages/conversations').then((r) => r.data),
    enabled: isAuthed,
  });
  const unreadCount = unreadQ.data?.reduce((acc, c) => acc + (c.unread_count || 0), 0) ?? 0;
  const notifUnreadQ = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get<{ count: number }>('/api/notifications/unread-count').then((r) => r.data.count),
    enabled: isAuthed,
  });
  const notifUnreadCount = notifUnreadQ.data ?? 0;

  const cycleTheme = () => {
    setMode(mode === 'dark' ? 'light' : 'dark');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg-base)]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-3 sm:gap-4 sm:px-4">
        <Link to="/" className="flex shrink-0 items-center gap-2 font-display text-lg font-bold text-[var(--primary)] sm:text-xl">
          <Music className="h-7 w-7 sm:h-8 sm:w-8" aria-hidden />
          Нота
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <NavLink to="/" className={linkCls} end>
            Главная
          </NavLink>
          {isAuthed && (
            <NavLink to="/feed" className={linkCls}>
              Лента
            </NavLink>
          )}
        </nav>

        <SearchBar />

        <div className="flex min-w-0 flex-shrink-0 items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={cycleTheme}
            className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
            aria-label="Тема"
          >
            {mode === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </button>
          {isAuthed && !user?.is_admin ? (
            <Link to="/messages" className="relative rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]">
              <MessageCircle className="h-5 w-5" />
              {unreadCount > 0 && (
                <span style={{ position: 'absolute', top: -2, right: -2, background: 'var(--primary)', color: 'white', borderRadius: '50%', width: 16, height: 16, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
          ) : isAuthed ? null : (
            <Link
              to="/login"
              className="relative rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
              title="Сообщения — войдите"
            >
              <MessageCircle className="h-5 w-5" />
            </Link>
          )}
          {isAuthed && !user?.is_admin ? (
            <Link
              to="/notifications"
              className="relative rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
            >
              <Bell className="h-5 w-5" />
              {notifUnreadCount > 0 && (
                <span style={{ position: 'absolute', top: -2, right: -2, background: 'var(--primary)', color: 'white', borderRadius: '50%', width: 16, height: 16, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {notifUnreadCount > 9 ? '9+' : notifUnreadCount}
                </span>
              )}
            </Link>
          ) : isAuthed ? null : (
            <Link
              to="/login"
              className="relative rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
              title="Уведомления — войдите"
            >
              <Bell className="h-5 w-5" />
            </Link>
          )}
          {isAuthed && user?.is_admin && (
            <Link to="/admin/dashboard">
              <Button size="sm" variant="secondary">
                <Shield className="mr-1 h-4 w-4" />
                <span className="hidden sm:inline">Админ-панель</span>
                <span className="sm:hidden">
                  <Shield className="h-4 w-4" />
                </span>
              </Button>
            </Link>
          )}
          {isAuthed && !user?.is_admin && (
            <Link to="/upload">
              <Button size="sm" variant="secondary">
                <Upload className="mr-1 h-4 w-4" />
                <span className="hidden sm:inline">Загрузить</span>
                <span className="sm:hidden">+</span>
              </Button>
            </Link>
          )}
          {isAuthed ? (
            <UserMenu />
          ) : (
            <div className="ml-1 flex items-center gap-1.5 sm:ml-2">
              <Link to="/login" className={loginBtnCls}>
                Войти
              </Link>
              <Link to="/register" className={registerBtnCls}>
                Регистрация
              </Link>
            </div>
          )}
          <button type="button" className="md:hidden rounded-lg p-2" aria-label="Меню">
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </div>
    </header>
  );
}

export function MobileBottomNav() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const isAuthed = !!accessToken && !!user;
  const navTabCls =
    'flex flex-1 min-w-0 flex-col items-center py-2 text-[10px] text-[var(--text-secondary)] [&.active]:text-[var(--primary)]';
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-[var(--border)] bg-[var(--bg-base)]/95 pb-safe md:hidden">
      <NavLink to="/" className={({ isActive }) => `${navTabCls}${isActive ? ' active' : ''}`} end>
        <Home className="h-6 w-6 shrink-0" />
        Главная
      </NavLink>
      <NavLink to="/search" className={({ isActive }) => `${navTabCls}${isActive ? ' active' : ''}`}>
        <Search className="h-6 w-6 shrink-0" />
        Поиск
      </NavLink>
      {user?.is_admin ? (
        <NavLink to="/admin/dashboard" className={({ isActive }) => `${navTabCls}${isActive ? ' active' : ''}`}>
          <Shield className="h-6 w-6 shrink-0" />
          Админка
        </NavLink>
      ) : (
        <NavLink to="/upload" className={({ isActive }) => `${navTabCls}${isActive ? ' active' : ''}`}>
          <Upload className="h-6 w-6 shrink-0" />
          Загрузить
        </NavLink>
      )}
      {isAuthed && !user?.is_admin ? (
        <NavLink to="/notifications" className={({ isActive }) => `${navTabCls}${isActive ? ' active' : ''}`}>
          <Bell className="h-6 w-6 shrink-0" />
          Увед.
        </NavLink>
      ) : isAuthed ? null : (
        <NavLink to="/login" className={({ isActive }) => `${navTabCls}${isActive ? ' active' : ''}`}>
          <Bell className="h-6 w-6 shrink-0" />
          Увед.
        </NavLink>
      )}
      {isAuthed && !user?.is_admin ? (
        <NavLink to="/messages" className={({ isActive }) => `${navTabCls}${isActive ? ' active' : ''}`}>
          <MessageCircle className="h-6 w-6 shrink-0" />
          Чаты
        </NavLink>
      ) : isAuthed ? null : (
        <NavLink to="/login" className={({ isActive }) => `${navTabCls}${isActive ? ' active' : ''}`}>
          <MessageCircle className="h-6 w-6 shrink-0" />
          Чаты
        </NavLink>
      )}
      {isAuthed ? (
        <NavLink to="/settings" className={({ isActive }) => `${navTabCls}${isActive ? ' active' : ''}`}>
          <User className="h-6 w-6 shrink-0" />
          Профиль
        </NavLink>
      ) : (
        <NavLink to="/login" className={({ isActive }) => `${navTabCls}${isActive ? ' active' : ''}`}>
          <User className="h-6 w-6 shrink-0" />
          Войти
        </NavLink>
      )}
    </nav>
  );
}
