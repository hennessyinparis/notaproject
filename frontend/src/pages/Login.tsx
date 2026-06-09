import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { api, setAuthHeader } from '../api/client';
import { Button } from '../components/common/Button';
import { useMeQuery } from '../hooks/useMeQuery';
import { useAuthStore } from '../store/authStore';
import { getErrorMessage } from '../utils/error';
import type { AuthUser } from '../types';

export function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const meQ = useMeQuery();

  const from = (location.state as { from?: string })?.from || '/';

  const login = useMutation({
    mutationFn: () => api.post('/api/auth/login', { username, password }),
    onSuccess: async (res) => {
      const { access_token, refresh_token } = res.data;
      setTokens(access_token, refresh_token);
      setAuthHeader(access_token);
      try {
        const me = await api.get<AuthUser>('/api/users/me');
        setUser(me.data);
        toast.success('С возвращением!');
        if (me.data.is_admin) {
          navigate('/admin/dashboard', { replace: true });
        } else {
          const dest = from.startsWith('/admin') ? '/' : from;
          navigate(dest, { replace: true });
        }
      } catch (error) {
        logout();
        toast.error(getErrorMessage(error, 'Не удалось загрузить профиль'));
      }
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Ошибка входа')),
  });

  if (accessToken && user) {
    return <Navigate to={user.is_admin ? '/admin/dashboard' : '/'} replace />;
  }

  if (accessToken && !user && meQ.isLoading) {
    return (
      <div className="flex min-h-[min(70vh,720px)] flex-col items-center justify-center gap-3 text-[var(--text-secondary)]">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--primary)]"
          aria-hidden
        />
        <p className="text-sm">Проверяем сессию…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[min(70vh,720px)] flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-8 shadow-[var(--shadow-card)]">
        <h1 className="text-center font-display text-2xl font-bold text-[var(--text-primary)]">Вход в Ноту</h1>
        <p className="mt-2 text-center text-sm text-[var(--text-secondary)]">Лайки, комментарии и загрузка — после входа</p>
        <div className="mt-6 space-y-3">
          <input
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary)]"
            placeholder="Email или имя пользователя"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
          <input
            type="password"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary)]"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <Button className="w-full" loading={login.isPending} onClick={() => login.mutate()}>
            Войти
          </Button>
          <p className="text-center text-sm">
            <Link to="/forgot-password" className="text-[var(--primary)] hover:underline">
              Забыли пароль?
            </Link>
          </p>
        </div>
        <p className="mt-4 text-center text-sm text-[var(--text-secondary)]">
          Нет аккаунта?{' '}
          <Link to="/register" state={location.state} className="font-semibold text-[var(--primary)] hover:underline">
            Регистрация
          </Link>
        </p>
      </div>
    </div>
  );
}
