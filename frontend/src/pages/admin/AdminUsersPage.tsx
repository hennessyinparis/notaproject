import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Users } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { api } from '../../api/client';
import { Button } from '../../components/common/Button';
import type { AuthUser } from '../../types';
import { adminInputClass } from './adminTypes';
import { admCard, admCardPad, admEmpty, admMain, admRow, admToolbar } from './adminStyles';

function RowSkeleton() {
  return <div className="h-[88px] animate-pulse rounded-xl bg-[var(--bg-elevated)]/80" />;
}

export function AdminUsersPage() {
  const qc = useQueryClient();
  const [userSearch, setUserSearch] = useState('');
  const [userSearchApplied, setUserSearchApplied] = useState('');

  const usersQ = useQuery({
    queryKey: ['admin-users', userSearchApplied],
    queryFn: () =>
      api
        .get<AuthUser[]>('/api/admin/users', {
          params: { limit: 200, ...(userSearchApplied.trim() ? { q: userSearchApplied.trim() } : {}) },
        })
        .then((r) => r.data),
  });

  const invalidateUsers = () => qc.invalidateQueries({ queryKey: ['admin-users'] });

  const verifyM = useMutation({
    mutationFn: (id: number) => api.patch(`/api/admin/users/${id}/verify`),
    onSuccess: async () => {
      toast.success('Статус верификации изменён');
      await invalidateUsers();
      await qc.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: () => toast.error('Не удалось изменить верификацию'),
  });

  const blockM = useMutation({
    mutationFn: (id: number) => api.patch(`/api/admin/users/${id}/block`),
    onSuccess: async () => {
      toast.success('Статус блокировки изменён');
      await invalidateUsers();
      await qc.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: () => toast.error('Не удалось изменить блокировку'),
  });

  const adminRoleM = useMutation({
    mutationFn: (id: number) => api.patch(`/api/admin/users/${id}/admin`),
    onSuccess: async () => {
      toast.success('Права администратора обновлены');
      await invalidateUsers();
      await qc.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: () => toast.error('Не удалось изменить права'),
  });

  return (
    <div className={admMain}>
      <AdminPageHeader
        icon={Users}
        title="Пользователи"
        description="Поиск по имени и email, верификация, блокировка и выдача прав администратора."
      />

      <div className={admToolbar}>
        <div className="min-w-0 flex-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Поиск
          </label>
          <div className="relative mt-1.5">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
              aria-hidden
            />
            <input
              className={`${adminInputClass} pl-10`}
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setUserSearchApplied(userSearch)}
              placeholder="Имя, @ник или email"
            />
          </div>
        </div>
        <div className="flex w-full gap-2 sm:w-auto sm:shrink-0">
          <Button type="button" className="flex-1 sm:flex-none" onClick={() => setUserSearchApplied(userSearch)}>
            Найти
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="flex-1 sm:flex-none"
            onClick={() => {
              setUserSearch('');
              setUserSearchApplied('');
            }}
          >
            Сброс
          </Button>
        </div>
      </div>

      <div className={`${admCard} ${admCardPad}`}>
        <div className="mb-4 flex items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Список</h3>
          {usersQ.data != null ? (
            <span className="text-xs font-medium text-[var(--text-muted)]">
              {usersQ.data.length} записей
            </span>
          ) : null}
        </div>

        {usersQ.isLoading ? (
          <div className="space-y-3">
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
          </div>
        ) : (
          <div className="space-y-3">
            {(usersQ.data ?? []).map((u) => (
              <div
                key={u.id}
                className={`${admRow} ${u.is_blocked ? 'border-l-[3px] border-l-[var(--error)]' : ''}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[var(--text-primary)]">{u.display_name}</span>
                    {u.is_verified && (
                      <span className="rounded-lg bg-[var(--primary)]/12 px-2 py-0.5 text-[11px] font-semibold text-[var(--primary)] ring-1 ring-[var(--primary)]/20">
                        Вериф.
                      </span>
                    )}
                    {u.is_admin && (
                      <span className="rounded-lg bg-amber-500/12 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-500/25 dark:text-amber-300">
                        Админ
                      </span>
                    )}
                  </div>
                  <div className="mt-1 font-mono text-xs text-[var(--text-secondary)]">@{u.username}</div>
                  {u.email ? (
                    <div className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{u.email}</div>
                  ) : null}
                  {u.is_blocked && (
                    <div className="mt-2 inline-flex rounded-lg bg-[var(--error)]/10 px-2 py-1 text-[11px] font-semibold text-[var(--error)]">
                      Заблокирован
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <Button
                    size="sm"
                    variant={u.is_verified ? 'secondary' : 'primary'}
                    disabled={verifyM.isPending}
                    onClick={() => verifyM.mutate(u.id)}
                  >
                    {u.is_verified ? 'Снять вериф.' : 'Верифицировать'}
                  </Button>
                  <Button
                    size="sm"
                    variant={u.is_blocked ? 'primary' : 'ghost'}
                    disabled={blockM.isPending}
                    onClick={() => blockM.mutate(u.id)}
                  >
                    {u.is_blocked ? 'Разблок.' : 'Блок'}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={adminRoleM.isPending || u.is_blocked === true}
                    title={u.is_blocked ? 'Сначала разблокируйте пользователя' : undefined}
                    onClick={() => adminRoleM.mutate(u.id)}
                  >
                    {u.is_admin ? 'Снять админа' : 'Админ'}
                  </Button>
                </div>
              </div>
            ))}
            {!usersQ.data?.length && (
              <div className={admEmpty}>По запросу никого не найдено. Измените поиск или сбросьте фильтр.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
