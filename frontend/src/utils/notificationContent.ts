import type { LucideIcon } from 'lucide-react';
import { AtSign, Ban, Bell, Coins, Disc3, Gift, Heart, MessageCircle, Music, Repeat2, UserPlus } from 'lucide-react';

export type NotificationActor = {
  id: number;
  username: string;
  display_name: string;
  avatar_url?: string | null;
};

export type NotificationItem = {
  id: number;
  type: string;
  actor_id?: number | null;
  actor?: NotificationActor | null;
  entity_id?: number | null;
  entity_type?: string | null;
  entity_title?: string | null;
  preview?: string | null;
  is_read: boolean;
  created_at: string;
};

export type NotificationView = {
  icon: LucideIcon;
  title: string;
  body: string;
  href?: string;
};

function actorName(n: NotificationItem): string {
  return n.actor?.display_name?.trim() || 'Кто-то';
}

export function getNotificationView(n: NotificationItem): NotificationView {
  const actor = actorName(n);
  const effectiveType =
    n.type === 'mention' && n.entity_type === 'message'
      ? 'new_message'
      : n.type === 'mention' && n.entity_type === 'playlist_invite'
        ? 'playlist_invite'
        : n.type === 'mention' && n.entity_type === 'donation'
          ? 'donation'
          : n.type;

  switch (effectiveType) {
    case 'new_message':
      return {
        icon: MessageCircle,
        title: 'Новое сообщение',
        body: n.preview ? `${actor}: ${n.preview}` : `${actor} написал(а) вам`,
        href: n.actor ? `/messages/${n.actor.username}` : undefined,
      };
    case 'playlist_invite':
      return {
        icon: Disc3,
        title: 'Приглашение в плейлист',
        body: n.entity_title
          ? `${actor} пригласил(а) вас в «${n.entity_title}»`
          : `${actor} пригласил(а) вас в совместный плейлист`,
        href: n.entity_id ? `/playlist/${n.entity_id}?accept=1` : undefined,
      };
    case 'new_follower':
      return {
        icon: UserPlus,
        title: 'Новый подписчик',
        body: `${actor} подписался(ась) на вас`,
        href: n.actor ? `/artist/${n.actor.username}` : undefined,
      };
    case 'track_liked':
      return {
        icon: Heart,
        title: 'Лайк на треке',
        body: n.entity_title ? `${actor} лайкнул(а) «${n.entity_title}»` : `${actor} лайкнул(а) ваш трек`,
        href: n.entity_id ? `/track/${n.entity_id}` : undefined,
      };
    case 'track_reposted':
      return {
        icon: Repeat2,
        title: 'Репост трека',
        body: n.entity_title ? `${actor} сделал(а) репост «${n.entity_title}»` : `${actor} сделал(а) репост вашего трека`,
        href: n.entity_id ? `/track/${n.entity_id}` : undefined,
      };
    case 'track_commented':
      return {
        icon: MessageCircle,
        title: 'Комментарий к треку',
        body: n.preview
          ? `${actor} прокомментировал(а) «${n.entity_title ?? 'трек'}»: ${n.preview}`
          : `${actor} оставил(а) комментарий к «${n.entity_title ?? 'треку'}»`,
        href: n.entity_id ? `/track/${n.entity_id}` : undefined,
      };
    case 'new_track_from_following':
      return {
        icon: Music,
        title: 'Новый релиз',
        body: n.entity_title ? `${actor} выпустил(а) «${n.entity_title}»` : `${actor} выпустил(а) новый трек`,
        href: n.entity_id ? `/track/${n.entity_id}` : undefined,
      };
    case 'royalty_earned':
      return {
        icon: Coins,
        title: 'Выплата',
        body: 'Начислена выплата по монетизации',
        href: '/studio',
      };
    case 'report_resolved':
      return {
        icon: Ban,
        title: n.entity_title || 'Нарушение правил',
        body: n.preview || 'Ваш контент скрыт или ограничен по результатам модерации',
        href: undefined,
      };
    case 'donation':
      return {
        icon: Gift,
        title: 'Донат',
        body: n.entity_title ? `${actor}: ${n.entity_title}` : `${actor} поддержал(а) вас`,
        href: n.actor ? `/artist/${n.actor.username}` : '/studio',
      };
    default:
      return {
        icon: n.type === 'mention' ? AtSign : Bell,
        title: 'Уведомление',
        body: n.preview || `${actor} — ${n.type}`,
        href: undefined,
      };
  }
}

export function formatNotificationTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
