import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';

import { api } from '../api/client';
import { PageShell } from '../components/layout/PageShell';
import { formatNotificationTime, getNotificationView, type NotificationItem } from '../utils/notificationContent';

function NotificationAvatar({ actor }: { actor: NotificationItem['actor'] }) {
  const base = import.meta.env.VITE_API_URL || '';
  const src =
    actor?.avatar_url?.startsWith('http') ? actor.avatar_url : actor?.avatar_url ? `${base}${actor.avatar_url}` : null;
  const initial = actor?.display_name?.trim()?.[0]?.toUpperCase() ?? '?';

  return (
    <div className="flex h-12 w-12 shrink-0 overflow-hidden rounded-full bg-[var(--bg-elevated)] ring-2 ring-[var(--border)]">
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-sm font-bold text-[var(--primary)]">{initial}</span>
      )}
    </div>
  );
}

export function Notifications() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<NotificationItem[]>('/api/notifications').then((r) => r.data),
  });
  useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get<{ count: number }>('/api/notifications/unread-count').then((r) => r.data.count),
  });
  const readAll = useMutation({
    mutationFn: () => api.post('/api/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.setQueryData(['notifications', 'unread-count'], 0);
    },
  });

  return (
    <PageShell
      title="Уведомления"
      description="Подписки, сообщения, реакции и события по вашим трекам"
      icon={<Bell className="h-7 w-7 text-[var(--primary)]" strokeWidth={2} aria-hidden />}
      actions={
        <button
          type="button"
          onClick={() => readAll.mutate()}
          disabled={readAll.isPending}
          className="rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] shadow-[var(--shadow-card)] transition hover:bg-[var(--bg-elevated)] disabled:opacity-60"
        >
          Прочитать всё
        </button>
      }
    >
      <div className="mx-auto max-w-2xl">
        <ul className="space-y-3">
          {data?.map((n) => {
            const view = getNotificationView(n);
            const Icon = view.icon;
            const inner = (
              <>
                <div className="relative shrink-0">
                  {n.actor ? <NotificationAvatar actor={n.actor} /> : null}
                  <div
                    className={clsx(
                      'absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-lg border-2 border-[var(--bg-surface)]',
                      n.is_read ? 'bg-[var(--bg-elevated)] text-[var(--text-muted)]' : 'bg-[var(--primary)] text-white'
                    )}
                  >
                    <Icon className="h-3 w-3" aria-hidden />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[var(--text-primary)]">{view.title}</p>
                  <p className="mt-1 text-sm leading-snug text-[var(--text-secondary)]">{view.body}</p>
                  <p className="mt-2 text-xs text-[var(--text-muted)]">{formatNotificationTime(n.created_at)}</p>
                </div>
              </>
            );

            return (
              <li key={n.id}>
                {view.href ? (
                  <Link
                    to={view.href}
                    className={clsx(
                      'flex gap-4 rounded-2xl border p-4 shadow-[var(--shadow-card)] transition hover:brightness-[0.98]',
                      n.is_read
                        ? 'border-[var(--border)] bg-[var(--bg-surface)] ring-1 ring-black/[0.04] dark:ring-white/[0.06]'
                        : 'border-[var(--primary)]/30 bg-[var(--primary-light)] shadow-[var(--shadow-hover)]'
                    )}
                  >
                    {inner}
                  </Link>
                ) : (
                  <div
                    className={clsx(
                      'flex gap-4 rounded-2xl border p-4 shadow-[var(--shadow-card)]',
                      n.is_read
                        ? 'border-[var(--border)] bg-[var(--bg-surface)] ring-1 ring-black/[0.04] dark:ring-white/[0.06]'
                        : 'border-[var(--primary)]/30 bg-[var(--primary-light)] shadow-[var(--shadow-hover)]'
                    )}
                  >
                    {inner}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {Array.isArray(data) && data.length === 0 && (
          <p className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-surface)] py-14 text-center text-sm text-[var(--text-muted)]">
            Пока нет уведомлений
          </p>
        )}
      </div>
    </PageShell>
  );
}
