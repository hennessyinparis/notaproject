import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

import { api } from '../api/client';
import { Button } from '../components/common/Button';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [devToken, setDevToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setDevToken(null);
    try {
      const { data } = await api.post<{ ok: boolean; dev_token?: string; dev_reset_url?: string }>(
        '/api/auth/forgot-password',
        { email }
      );
      toast.success('Если email зарегистрирован, инструкция отправлена');
      if (data.dev_token) setDevToken(data.dev_token);
    } catch {
      toast.error('Ошибка запроса');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6 p-8">
      <h1 className="font-display text-2xl font-bold">Сброс пароля</h1>
      <form onSubmit={submit} className="space-y-4">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm"
        />
        <Button type="submit" loading={loading} className="w-full">
          Отправить ссылку
        </Button>
      </form>
      {devToken && (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          Dev-режим:{' '}
          <Link to={`/reset-password?token=${devToken}`} className="font-semibold text-[var(--primary)]">
            сбросить пароль
          </Link>
        </p>
      )}
      <Link to="/login" className="text-sm text-[var(--primary)]">
        ← Вход
      </Link>
    </div>
  );
}
