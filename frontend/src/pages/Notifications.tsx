import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import type { LucideIcon } from 'lucide-react';
import { AtSign, Bell, Coins, Heart, MessageCircle, Music, Repeat2, UserPlus } from 'lucide-react';

import { api } from '../api/client';
import { PageShell } from '../components/layout/PageShell';

const NOTIFICATION_META: Record<string, { icon: LucideIcon; title: string }> = {
  new_follower: { icon: UserPlus, title: 'Новый подписчик' },
  track_liked: { icon: Heart, title: 'Лайк на треке' },
  track_reposted: { icon: Repeat2, title: 'Репост трека' },
  track_commented: { icon: MessageCircle, title: 'Комментарий к треку' },
  new_track_from_following: { icon: Music, title: 'Новый релиз' },
  royalty_earned: { icon: Coins, title: 'Выплата' },
  mention: { icon: AtSign, title: 'Упоминание' },
};

export function Notifications() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/api/notifications').then((r) => r.data),
  });
  const readAll = useMutation({
    mutationFn: () => api.post('/api/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return (
    <PageShell
      title="Уведомления"
      description="Подписки, реакции и события по вашим трекам"
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
          {data?.map((n: { id: number; type: string; created_at: string; is_read: boolean }) => {
            const meta = NOTIFICATION_META[n.type] ?? { icon: Bell, title: n.type };
            const Icon = meta.icon;
            return (
              <li
                key={n.id}
                className={clsx(
                  'flex gap-4 rounded-2xl border p-4 shadow-[var(--shadow-card)] transition',
                  n.is_read
                    ? 'border-[var(--border)] bg-[var(--bg-surface)] ring-1 ring-black/[0.04] dark:ring-white/[0.06]'
                    : 'border-[var(--primary)]/30 bg-[var(--primary-light)] shadow-[var(--shadow-hover)]'
                )}
              >
                <div
                  className={clsx(
                    'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
                    n.is_read ? 'bg-[var(--bg-elevated)] text-[var(--text-muted)]' : 'bg-[var(--primary)]/15 text-[var(--primary)]'
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[var(--text-primary)]">{meta.title}</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{new Date(n.created_at).toLocaleString('ru-RU')}</p>
                </div>
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
