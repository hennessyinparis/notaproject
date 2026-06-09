import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Calendar,
  Headphones,
  Music2,
  ShieldAlert,
  Trash2,
  Undo2,
  UserRound,
} from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

import { api } from '../../api/client';
import { Button } from '../../components/common/Button';
import { admCard, admCardPad, admEmpty, admMain, admRow } from './adminStyles';

interface BlockedTrack {
  id: number;
  title: string;
  user_id: number;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  plays_count: number;
  genre: string | null;
  cover_url: string | null;
  report_reason: string | null;
  report_reason_label: string | null;
  report_created_at: string | null;
  report_id: number | null;
}

interface BlockedUser {
  id: number;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
  is_admin: boolean;
  is_verified: boolean;
  created_at: string;
  report_reason: string | null;
  report_reason_label: string | null;
  report_created_at: string | null;
  report_id: number | null;
}

function Skeleton() {
  return <div className="h-24 animate-pulse rounded-xl bg-[var(--bg-elevated)]/80" />;
}

export function AdminBlockedTracksPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'tracks' | 'users'>('tracks');

  const blockedTracksQ = useQuery({
    queryKey: ['admin-blocked-tracks'],
    queryFn: () => api.get<BlockedTrack[]>('/api/admin/tracks/blocked').then((r) => r.data),
  });

  const blockedUsersQ = useQuery({
    queryKey: ['admin-blocked-users'],
    queryFn: () => api.get<BlockedUser[]>('/api/admin/users/blocked').then((r) => r.data),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-blocked-tracks'] });
    qc.invalidateQueries({ queryKey: ['admin-blocked-users'] });
    qc.invalidateQueries({ queryKey: ['admin-tracks'] });
    qc.invalidateQueries({ queryKey: ['admin-users'] });
    qc.invalidateQueries({ queryKey: ['admin-stats'] });
  };

  const unpublishM = useMutation({
    mutationFn: (id: number) => api.patch(`/api/admin/tracks/${id}/visibility`),
    onSuccess: async () => {
      toast.success('Трек восстановлен');
      await invalidate();
    },
    onError: () => toast.error('Не удалось восстановить трек'),
  });

  const unblockUserM = useMutation({
    mutationFn: (id: number) => api.patch(`/api/admin/users/${id}/block`),
    onSuccess: async () => {
      toast.success('Пользователь разблокирован');
      await invalidate();
    },
    onError: () => toast.error('Не удалось разблокировать пользователя'),
  });

  const deleteM = useMutation({
    mutationFn: (id: number) => api.delete(`/api/admin/tracks/${id}`),
    onSuccess: async () => {
      toast.success('Трек удалён');
      await invalidate();
    },
    onError: () => toast.error('Не удалось удалить трек'),
  });

  const handleDeleteTrack = (t: BlockedTrack) => {
    if (!window.confirm(`Удалить трек «${t.title}» безвозвратно?`)) return;
    deleteM.mutate(t.id);
  };

  const isLoading = blockedTracksQ.isLoading || blockedUsersQ.isLoading;

  const tabClass = (name: string) =>
    `rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
      tab === name
        ? 'bg-[var(--primary)]/14 text-[var(--primary)] ring-1 ring-[var(--primary)]/25'
        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
    }`;

  return (
    <div className={admMain}>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-500/20 ring-1 ring-red-500/30">
          <ShieldAlert className="h-5 w-5 text-red-500" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold text-[var(--text-primary)]">Блокировки</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Контент и пользователи, скрытые с платформы по жалобам или решению администрации
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <button type="button" className={tabClass('tracks')} onClick={() => setTab('tracks')}>
          Треки {blockedTracksQ.data != null ? `(${blockedTracksQ.data.length})` : ''}
        </button>
        <button type="button" className={tabClass('users')} onClick={() => setTab('users')}>
          Пользователи {blockedUsersQ.data != null ? `(${blockedUsersQ.data.length})` : ''}
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton />
          <Skeleton />
          <Skeleton />
        </div>
      ) : (
        <div className={`${admCard} ${admCardPad}`}>
          {tab === 'tracks' && (
            <>
              <div className="mb-4 flex items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Заблокированные треки</h3>
                {blockedTracksQ.data != null ? (
                  <span className="text-xs font-medium text-[var(--text-muted)]">
                    {blockedTracksQ.data.length} треков
                  </span>
                ) : null}
              </div>

              <div className="space-y-3">
                {(blockedTracksQ.data ?? []).length === 0 ? (
                  <div className={admEmpty}>
                    <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-[var(--text-muted)]" />
                    Заблокированных треков нет
                  </div>
                ) : (
                  (blockedTracksQ.data ?? []).map((t) => (
                    <div key={t.id} className={`${admRow} border-l-[3px] border-l-red-500/60`}>
                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <div className="flex items-center gap-3">
                          {t.cover_url ? (
                            <img src={t.cover_url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-black/10" />
                          ) : (
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-elevated)] text-red-400 ring-1 ring-[var(--border)]">
                              <Music2 className="h-5 w-5" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="truncate font-semibold text-[var(--text-primary)]">{t.title}</span>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-secondary)]">
                              <UserRound className="h-3 w-3" />
                              <span className="font-mono">@{t.username}</span>
                              <span className="text-[var(--text-muted)]">·</span>
                              <Headphones className="h-3 w-3" />
                              <span>{(t.plays_count ?? 0).toLocaleString('ru-RU')}</span>
                              <span className="text-[var(--text-muted)]">·</span>
                              <Calendar className="h-3 w-3" />
                              <span>{new Date(t.created_at).toLocaleDateString('ru-RU')}</span>
                            </div>
                          </div>
                        </div>

                        {t.report_reason && (
                          <div className="flex items-center gap-2 rounded-lg bg-red-500/8 px-3 py-2 text-xs">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-400" />
                            <span className="text-[var(--text-secondary)]">
                              Причина блокировки:{' '}
                              <span className="font-semibold text-red-500">{t.report_reason_label}</span>
                            </span>
                            {t.report_created_at && (
                              <span className="ml-auto shrink-0 text-[var(--text-muted)]">
                                {new Date(t.report_created_at).toLocaleDateString('ru-RU')}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={unpublishM.isPending}
                          onClick={() => unpublishM.mutate(t.id)}
                        >
                          <Undo2 className="mr-1 h-3.5 w-3.5" /> Восстановить
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={deleteM.isPending}
                          onClick={() => handleDeleteTrack(t)}
                          className="text-[var(--error)] hover:bg-[var(--error)]/10"
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" /> Удалить
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {tab === 'users' && (
            <>
              <div className="mb-4 flex items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Заблокированные пользователи</h3>
                {blockedUsersQ.data != null ? (
                  <span className="text-xs font-medium text-[var(--text-muted)]">
                    {blockedUsersQ.data.length} пользователей
                  </span>
                ) : null}
              </div>

              <div className="space-y-3">
                {(blockedUsersQ.data ?? []).length === 0 ? (
                  <div className={admEmpty}>
                    <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-[var(--text-muted)]" />
                    Заблокированных пользователей нет
                  </div>
                ) : (
                  (blockedUsersQ.data ?? []).map((u) => (
                    <div key={u.id} className={`${admRow} border-l-[3px] border-l-red-500/60`}>
                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-3">
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-black/10" />
                        ) : (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-500/20 to-red-500/5 text-xs font-bold text-red-500 ring-1 ring-red-500/20">
                            {(u.display_name || u.username)[0]?.toUpperCase() || '?'}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-semibold text-[var(--text-primary)]">
                              {u.display_name ?? u.username}
                            </span>
                            <span className="font-mono text-xs text-[var(--text-muted)]">@{u.username}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-secondary)]">
                            <span className="text-[var(--text-muted)]">email: {u.email ?? '—'}</span>
                            <span className="text-[var(--text-muted)]">·</span>
                            <Calendar className="h-3 w-3" />
                            <span>{new Date(u.created_at).toLocaleDateString('ru-RU')}</span>
                          </div>
                        </div>
                      </div>
                        </div>

                        {u.report_reason && (
                          <div className="flex items-center gap-2 rounded-lg bg-red-500/8 px-3 py-2 text-xs">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-400" />
                            <span className="text-[var(--text-secondary)]">
                              Причина блокировки:{' '}
                              <span className="font-semibold text-red-500">{u.report_reason_label}</span>
                            </span>
                            {u.report_created_at && (
                              <span className="ml-auto shrink-0 text-[var(--text-muted)]">
                                {new Date(u.report_created_at).toLocaleDateString('ru-RU')}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={unblockUserM.isPending}
                          onClick={() => unblockUserM.mutate(u.id)}
                        >
                          <Undo2 className="mr-1 h-3.5 w-3.5" /> Разблокировать
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
