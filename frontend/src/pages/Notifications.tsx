import { useQuery } from '@tanstack/react-query';

import { api } from '../api/client';

const NOTIFICATION_ICONS: Record<string, string> = {
  new_follower: '👤',
  track_liked: '♥',
  track_reposted: '🔁',
  track_commented: '💬',
  new_track_from_following: '🎵',
  royalty_earned: '💰',
  mention: '✉',
};

const NOTIFICATION_TEXT: Record<string, (actor?: string, track?: string) => string> = {
  new_follower: (actor) => `${actor ?? 'Кто-то'} подписался на вас`,
  track_liked: (actor, track) => `${actor ?? 'Кто-то'} лайкнул «${track ?? 'ваш трек'}»`,
  track_reposted: (actor, track) => `${actor ?? 'Кто-то'} репостнул «${track ?? 'ваш трек'}»`,
  track_commented: (actor, track) => `${actor ?? 'Кто-то'} прокомментировал «${track ?? 'ваш трек'}»`,
  new_track_from_following: (actor, track) => `${actor ?? 'Артист'} выпустил «${track ?? 'новый трек'}»`,
  royalty_earned: (_actor, amount) => `Вы заработали ${amount ?? '0'} ₽ в этом месяце`,
  mention: () => 'У вас новое сообщение',
};

export function Notifications() {
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/api/notifications').then((r) => r.data),
  });

  return (
    <div>
      <h1 className="font-display text-3xl font-bold">Уведомления</h1>
      <ul className="mt-6 space-y-2">
        {data?.map((n: { id: number; type: string; created_at: string; is_read: boolean }) => (
          <li key={n.id} className="rounded-xl border border-[var(--border)] px-4 py-3" style={{ background: n.is_read ? 'var(--bg-surface)' : 'var(--primary-light)' }}>
            <div className="flex items-center gap-3">
              <span style={{ fontSize: 20 }}>{NOTIFICATION_ICONS[n.type] ?? '🔔'}</span>
              <div>
                <div>{(NOTIFICATION_TEXT[n.type] ?? (() => n.type))()}</div>
                <div className="text-xs text-[var(--text-muted)]">{new Date(n.created_at).toLocaleString()}</div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
