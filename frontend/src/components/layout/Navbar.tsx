import { Bell, Home, Menu, MessageCircle, Moon, Music, Search, Sun, Upload, User } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { api } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
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

function useDebouncedCallback<T extends (...args: any[]) => void>(cb: T, ms: number) {
  const [t, setT] = useState<number | null>(null);
  return useMemo(
    () =>
      (...args: Parameters<T>) => {
        if (t) window.clearTimeout(t);
        const id = window.setTimeout(() => cb(...args), ms);
        setT(id);
      },
    [cb, ms, t]
  );
}

function SearchBar() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');

  useEffect(() => {
    setQuery(searchParams.get('q') || '');
  }, [searchParams]);

  const debouncedNavigate = useDebouncedCallback((url: string) => navigate(url), 300);

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
          placeholder="Поиск треков, артистов, плейлистов..."
          className="w-full rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-10 py-2 text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary)]"
          aria-label="Поиск"
        />
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

  return (
    <div className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button
        type="button"
        className="flex items-center gap-2 rounded-full border border-[var(--border)] p-1 pr-3"
      >
        <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[var(--primary-light)] text-[var(--primary)]">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
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
            to={`/profile/${user.username}`}
            className="block rounded-lg px-3 py-2 text-sm hover:bg-[var(--bg-elevated)]"
            onClick={() => setOpen(false)}
          >
            Профиль
          </Link>
          <Link
            to="/studio"
            className="block rounded-lg px-3 py-2 text-sm hover:bg-[var(--bg-elevated)]"
            onClick={() => setOpen(false)}
          >
            Студия
          </Link>
          <Link
            to="/library"
            className="block rounded-lg px-3 py-2 text-sm hover:bg-[var(--bg-elevated)]"
            onClick={() => setOpen(false)}
          >
            Библиотека
          </Link>
          <Link
            to="/settings"
            className="block rounded-lg px-3 py-2 text-sm hover:bg-[var(--bg-elevated)]"
            onClick={() => setOpen(false)}
          >
            Настройки
          </Link>
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
    refetchInterval: 8000,
  });
  const unreadCount = unreadQ.data?.reduce((acc, c) => acc + (c.unread_count || 0), 0) ?? 0;

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
          {isAuthed ? (
            <Link to="/messages" className="relative rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]">
              <MessageCircle className="h-5 w-5" />
              {unreadCount > 0 && (
                <span style={{ position: 'absolute', top: -2, right: -2, background: 'var(--primary)', color: 'white', borderRadius: '50%', width: 16, height: 16, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
          ) : (
            <Link
              to="/login"
              className="relative rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
              title="Сообщения — войдите"
            >
              <MessageCircle className="h-5 w-5" />
            </Link>
          )}
          {isAuthed ? (
            <Link
              to="/notifications"
              className="relative rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
            >
              <Bell className="h-5 w-5" />
            </Link>
          ) : (
            <Link
              to="/login"
              className="relative rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
              title="Уведомления — войдите"
            >
              <Bell className="h-5 w-5" />
            </Link>
          )}
          {isAuthed && (
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
      <NavLink to="/upload" className={({ isActive }) => `${navTabCls}${isActive ? ' active' : ''}`}>
        <Upload className="h-6 w-6 shrink-0" />
        Загрузить
      </NavLink>
      {isAuthed ? (
        <NavLink to="/notifications" className={({ isActive }) => `${navTabCls}${isActive ? ' active' : ''}`}>
          <Bell className="h-6 w-6 shrink-0" />
          Увед.
        </NavLink>
      ) : (
        <NavLink to="/login" className={({ isActive }) => `${navTabCls}${isActive ? ' active' : ''}`}>
          <Bell className="h-6 w-6 shrink-0" />
          Увед.
        </NavLink>
      )}
      {isAuthed ? (
        <NavLink to="/messages" className={({ isActive }) => `${navTabCls}${isActive ? ' active' : ''}`}>
          <MessageCircle className="h-6 w-6 shrink-0" />
          Чаты
        </NavLink>
      ) : (
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
