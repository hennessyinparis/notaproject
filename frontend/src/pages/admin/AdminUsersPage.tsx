import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Headphones, ListMusic, Search, Shield, ShieldOff, Sparkles, Users } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { api } from '../../api/client';
import { Button } from '../../components/common/Button';
import type { AuthUser } from '../../types';
import { adminInputClass } from './adminTypes';
import { admCard, admCardPad, admEmpty, admMain, admRow, admToolbar } from './adminStyles';

function RowSkeleton() {
  return <div className="h-24 animate-pulse rounded-xl bg-[var(--bg-elevated)]/80" />;
}

interface UserRow extends AuthUser {
  tracks_count?: number;
  total_plays?: number;
}

export function AdminUsersPage() {
  const qc = useQueryClient();
  const [userSearch, setUserSearch] = useState('');
  const [userSearchApplied, setUserSearchApplied] = useState('');

  const usersQ = useQuery({
    queryKey: ['admin-users', userSearchApplied],
    queryFn: async () => {
      const users = await api
        .get<AuthUser[]>('/api/admin/users', {
          params: { limit: 200, ...(userSearchApplied.trim() ? { q: userSearchApplied.trim() } : {}) },
        })
        .then((r) => r.data);
      const enriched = await Promise.all(
        users.map(async (u) => {
          try {
            const stats = await api.get(`/api/users/${u.username}/stats`).then((r) => r.data);
            return { ...u, tracks_count: stats.public_tracks_count ?? 0, total_plays: stats.total_plays ?? 0 };
          } catch {
            return { ...u, tracks_count: 0, total_plays: 0 };
          }
        })
      );
      return enriched as UserRow[];
    },
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

  const studentM = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.patch(`/api/admin/users/${id}/student-verification`, { status }),
    onSuccess: async () => {
      toast.success('Статус студента обновлён');
      await invalidateUsers();
    },
    onError: () => toast.error('Не удалось обновить статус студента'),
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
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Поиск</label>
          <div className="relative mt-1.5">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden />
            <input className={`${adminInputClass} pl-10`} value={userSearch} onChange={(e) => setUserSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && setUserSearchApplied(userSearch)} placeholder="Имя, @ник или email" />
          </div>
        </div>
        <div className="flex w-full gap-2 sm:w-auto sm:shrink-0">
          <Button type="button" className="flex-1 sm:flex-none" onClick={() => setUserSearchApplied(userSearch)}>Найти</Button>
          <Button type="button" variant="ghost" className="flex-1 sm:flex-none" onClick={() => { setUserSearch(''); setUserSearchApplied(''); }}>Сброс</Button>
        </div>
      </div>

      <div className={`${admCard} ${admCardPad}`}>
        <div className="mb-4 flex items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Каталог</h3>
          {usersQ.data != null ? <span className="text-xs font-medium text-[var(--text-muted)]">{usersQ.data.length} пользователей</span> : null}
        </div>

        {usersQ.isLoading ? (
          <div className="space-y-3">
            <RowSkeleton /> <RowSkeleton /> <RowSkeleton />
          </div>
        ) : (
          <div className="space-y-3">
            {(usersQ.data ?? []).length === 0 ? (
              <div className={admEmpty}>Пользователей не найдено</div>
            ) : (
              (usersQ.data ?? []).map((u) => (
                <div key={u.id} className={`${admRow} ${u.is_blocked ? 'border-l-[3px] border-l-red-500/60' : u.is_admin ? 'border-l-[3px] border-l-violet-500/60' : ''}`}>
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-black/10" />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--primary-light)] to-[var(--primary)]/20 text-sm font-bold text-[var(--primary)] ring-1 ring-[var(--primary)]/20">
                        {(u.display_name || u.username)[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold text-[var(--text-primary)]">{u.display_name || u.username}</span>
                        {u.is_admin && <Shield className="h-3.5 w-3.5 shrink-0 text-violet-500" />}
                        {u.is_verified && <Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-500" />}
                        {u.is_blocked && <span className="rounded-md bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-500">Заблокирован</span>}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[var(--text-muted)]">
                        <span>@{u.username}</span>
                        <span>{u.email}</span>
                        {(u as UserRow).tracks_count != null && (
                          <>
                            <span>·</span>
                            <ListMusic className="h-3 w-3" />
                            <span>{(u as UserRow).tracks_count} треков</span>
                          </>
                        )}
                        {(u as UserRow).total_plays != null && (
                          <>
                            <span>·</span>
                            <Headphones className="h-3 w-3" />
                            <span>{((u as UserRow).total_plays ?? 0).toLocaleString('ru-RU')}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="ghost" disabled={u.is_blocked} onClick={() => adminRoleM.mutate(u.id)} title={u.is_admin ? 'Снять админа' : 'Сделать админом'}>
                      {u.is_admin ? <ShieldOff className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => verifyM.mutate(u.id)} className={u.is_verified ? 'text-emerald-500' : ''}>
                      <Sparkles className="h-3.5 w-3.5" />
                    </Button>
                    {(u as AuthUser & { student_verification_status?: string }).student_verification_status === 'pending' && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => studentM.mutate({ id: u.id, status: 'approved' })}>
                          Студент ✓
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => studentM.mutate({ id: u.id, status: 'rejected' })}>
                          Студент ✗
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost" disabled={u.is_admin} onClick={() => blockM.mutate(u.id)} className={u.is_blocked ? 'text-red-500' : 'text-[var(--text-muted)]'}>
                      {u.is_blocked ? 'Разблок.' : 'Блок'}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
