import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { api } from '../api/client';
import { Button } from '../components/common/Button';
import type { AuthUser } from '../types';

type AdminStats = { users_count: number; tracks_count: number; total_plays: number };

export function AdminPage() {
  const qc = useQueryClient();
  const statsQ = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get<AdminStats>('/api/admin/stats').then((r) => r.data),
  });
  const usersQ = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get<AuthUser[]>('/api/admin/users?limit=100').then((r) => r.data),
  });
  const verifyM = useMutation({
    mutationFn: (id: number) => api.patch(`/api/admin/users/${id}/verify`),
    onSuccess: async () => {
      toast.success('Статус верификации изменён');
      await qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });
  const blockM = useMutation({
    mutationFn: (id: number) => api.patch(`/api/admin/users/${id}/block`),
    onSuccess: async () => {
      toast.success('Статус блокировки изменён');
      await qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold">Admin Panel</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-4"><div className="text-sm text-[var(--text-secondary)]">Пользователи</div><div className="mt-1 text-2xl font-bold">{statsQ.data?.users_count ?? 0}</div></div>
        <div className="rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-4"><div className="text-sm text-[var(--text-secondary)]">Треки</div><div className="mt-1 text-2xl font-bold">{statsQ.data?.tracks_count ?? 0}</div></div>
        <div className="rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-4"><div className="text-sm text-[var(--text-secondary)]">Прослушивания</div><div className="mt-1 text-2xl font-bold">{statsQ.data?.total_plays ?? 0}</div></div>
      </div>
      <div className="rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-4">
        <h2 className="mb-3 font-semibold">Пользователи</h2>
        <div className="space-y-2">
          {(usersQ.data ?? []).map((u) => (
            <div key={u.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] p-3">
              <div>
                <div className="font-medium">{u.display_name}</div>
                <div className="text-xs text-[var(--text-secondary)]">@{u.username}</div>
                {u.is_blocked && <div className="text-xs text-[var(--error)]">Заблокирован</div>}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant={u.is_verified ? 'secondary' : 'primary'} onClick={() => verifyM.mutate(u.id)}>{u.is_verified ? 'Снять вериф.' : 'Верифицировать'}</Button>
                <Button size="sm" variant={u.is_blocked ? 'primary' : 'ghost'} onClick={() => blockM.mutate(u.id)}>{u.is_blocked ? 'Разблок.' : 'Блок'}</Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
