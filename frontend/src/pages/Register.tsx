import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { api, setAuthHeader } from '../api/client';
import { Button } from '../components/common/Button';
import { CopyrightAgreement } from '../components/legal/CopyrightAgreement';
import { useAuthStore } from '../store/authStore';
import { getErrorMessage } from '../utils/error';

function useDebouncedValue(value: string, ms: number): string {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptCopyright, setAcceptCopyright] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);

  const from = (location.state as { from?: string })?.from || '/';

  const trimmedUser = username.trim();
  const debouncedUser = useDebouncedValue(trimmedUser, 450);
  const nameAvailQ = useQuery({
    queryKey: ['username-available', debouncedUser],
    queryFn: () =>
      api
        .get<{ available: boolean }>(`/api/auth/username-available?username=${encodeURIComponent(debouncedUser)}`)
        .then((r) => r.data),
    enabled: debouncedUser.length >= 3,
    staleTime: 30_000,
  });

  const reg = useMutation({
    mutationFn: (vars: {
      username: string;
      email: string;
      password: string;
      accept_terms: boolean;
      accept_content_responsibility: boolean;
    }) => api.post('/api/auth/register', vars),
    onSuccess: async (_, vars) => {
      const loginRes = await api.post('/api/auth/login', { username: vars.username, password: vars.password });
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
          <div>
            <input
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary)]"
              placeholder="Имя пользователя"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
            {trimmedUser.length > 0 && trimmedUser.length < 3 && (
              <p className="mt-1.5 text-xs text-[var(--text-muted)]">Минимум 3 символа в логине</p>
            )}
            {debouncedUser.length >= 3 && trimmedUser === debouncedUser && nameAvailQ.isFetching && (
              <p className="mt-1.5 text-xs text-[var(--text-muted)]">Проверяем логин…</p>
            )}
            {debouncedUser.length >= 3 && trimmedUser === debouncedUser && nameAvailQ.data?.available === true && (
              <p className="mt-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">Логин свободен</p>
            )}
            {debouncedUser.length >= 3 && trimmedUser === debouncedUser && nameAvailQ.data?.available === false && (
              <p className="mt-1.5 text-xs font-medium text-[var(--error)]">Этот логин уже занят</p>
            )}
          </div>
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
          <CopyrightAgreement
            variant="register"
            acceptTerms={acceptTerms}
            acceptCopyright={acceptCopyright}
            onAcceptTerms={setAcceptTerms}
            onAcceptCopyright={setAcceptCopyright}
          />
          <Button
            className="w-full"
            loading={reg.isPending}
            onClick={() => {
              if (trimmedUser.length < 3) {
                toast.error('Логин слишком короткий');
                return;
              }
              if (nameAvailQ.data && !nameAvailQ.data.available) {
                toast.error('Выберите другой логин');
                return;
              }
              if (password !== confirm) {
                toast.error('Пароли не совпадают');
                return;
              }
              if (!acceptTerms || !acceptCopyright) {
                toast.error('Подтвердите соглашения');
                return;
              }
              reg.mutate({
                username: trimmedUser,
                email,
                password,
                accept_terms: true,
                accept_content_responsibility: true,
              });
            }}
            disabled={
              reg.isPending ||
              !acceptTerms ||
              !acceptCopyright ||
              (trimmedUser.length >= 3 &&
                (trimmedUser !== debouncedUser || nameAvailQ.isFetching || nameAvailQ.data?.available === false))
            }
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
