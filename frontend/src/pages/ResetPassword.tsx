import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import { api } from '../api/client';
import { Button } from '../components/common/Button';

export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const token = params.get('token') || '';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error('Нет токена в ссылке');
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/auth/reset-password', { token, new_password: password });
      toast.success('Пароль обновлён');
      navigate('/login');
    } catch {
      toast.error('Не удалось сбросить пароль');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6 p-8">
      <h1 className="font-display text-2xl font-bold">Новый пароль</h1>
      <form onSubmit={submit} className="space-y-4">
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Новый пароль (мин. 8 символов)"
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm"
        />
        <Button type="submit" loading={loading} className="w-full">
          Сохранить
        </Button>
      </form>
      <Link to="/login" className="text-sm text-[var(--primary)]">
        ← Вход
      </Link>
    </div>
  );
}
