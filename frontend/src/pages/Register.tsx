import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { api, setAuthHeader } from '../api/client';
import { Button } from '../components/common/Button';
import { useAuthStore } from '../store/authStore';

function getErrorMessage(error: unknown, fallback: string) {
  const err = error as { response?: { data?: { detail?: string; message?: string } }; message?: string };
  return err?.response?.data?.detail || err?.response?.data?.message || err?.message || fallback;
}

export function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);

  const from = (location.state as { from?: string })?.from || '/';

  const reg = useMutation({
    mutationFn: () =>
      api.post('/api/auth/register', {
        username,
        email,
        password,
      }),
    onSuccess: async () => {
      const loginRes = await api.post('/api/auth/login', { username, password });
      const { access_token, refresh_token } = loginRes.data;
      setTokens(access_token, refresh_token);
      setAuthHeader(access_token);
      const me = await api.get('/api/users/me');
      setUser(me.data);
      toast.success('Добро пожаловать в Ноту!');
      navigate(from, { replace: true });
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Ошибка регистрации')),
  });

  if (accessToken && user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-[min(70vh,720px)] flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-8 shadow-[var(--shadow-card)]">
        <h1 className="text-center font-display text-2xl font-bold text-[var(--text-primary)]">Регистрация</h1>
        <p className="mt-2 text-center text-sm text-[var(--text-secondary)]">Слушать можно без аккаунта — остальное после регистрации</p>
        <div className="mt-6 space-y-3">
          <input
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary)]"
            placeholder="Имя пользователя"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
          <input
            type="email"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary)]"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <input
            type="password"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary)]"
            placeholder="Пароль (мин. 8 символов)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <input
            type="password"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary)]"
            placeholder="Повторите пароль"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
          <Button
            className="w-full"
            loading={reg.isPending}
            onClick={() => {
              if (password !== confirm) {
                toast.error('Пароли не совпадают');
                return;
              }
              reg.mutate();
            }}
          >
            Создать аккаунт
          </Button>
        </div>
        <p className="mt-4 text-center text-sm text-[var(--text-secondary)]">
          Уже есть аккаунт?{' '}
          <Link to="/login" state={location.state} className="font-semibold text-[var(--primary)] hover:underline">
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
}
