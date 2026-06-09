import type { Track } from '../types';

export type FeedPeriodGroup = {
  key: string;
  label: string;
  tracks: Track[];
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function groupTracksByPeriod(tracks: Track[]): FeedPeriodGroup[] {
  const now = new Date();
  const today = startOfDay(now).getTime();
  const weekAgo = today - 7 * 24 * 60 * 60 * 1000;

  const buckets: Record<string, Track[]> = {
    today: [],
    week: [],
    earlier: [],
  };

  for (const t of tracks) {
    const raw = t.published_at ?? t.created_at;
    const ts = raw ? new Date(raw).getTime() : 0;
    if (ts >= today) buckets.today.push(t);
    else if (ts >= weekAgo) buckets.week.push(t);
    else buckets.earlier.push(t);
  }

  const groups: FeedPeriodGroup[] = [];
  if (buckets.today.length) groups.push({ key: 'today', label: 'Сегодня', tracks: buckets.today });
  if (buckets.week.length) groups.push({ key: 'week', label: 'На этой неделе', tracks: buckets.week });
  if (buckets.earlier.length) groups.push({ key: 'earlier', label: 'Ранее', tracks: buckets.earlier });
  return groups;
}

export function formatFeedTrackTime(track: Track): string {
  const raw = track.published_at ?? track.created_at;
  if (!raw) return '';
  const d = new Date(raw);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}
