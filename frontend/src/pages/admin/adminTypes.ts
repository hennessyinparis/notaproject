export type AdminStats = {
  users_count: number;
  tracks_count: number;
  total_plays: number;
  blocked_users_count: number;
  verified_users_count: number;
  admin_users_count: number;
  comments_count: number;
  playlists_count: number;
  messages_count: number;
  public_tracks_count: number;
  hidden_tracks_count: number;
  reports_pending_count: number;
  reports_resolved_count: number;
  reports_dismissed_count: number;
  users_today_count: number;
};

export type SubscriptionRevenue = {
  total_revenue: number;
  active_subscriptions: number;
  by_plan: Record<string, number>;
  count_by_plan: Record<string, number>;
};

export type SubscriptionDetail = {
  id: number;
  user_id: number;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  plan_type: string;
  price_paid: number;
  created_at: string;
  expires_at: string | null;
};

export type AdminCommentRow = {
  id: number;
  text: string;
  created_at: string;
  user_id: number;
  username: string;
  display_name: string;
  track_id: number;
  track_title: string;
};

export type DetailedStats = {
  top_tracks: {
    id: number;
    title: string;
    plays: number;
    artist: string | null;
    artist_display: string | null;
    cover_url: string | null;
  }[];
  recent_users: {
    id: number;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    created_at: string;
    tracks_count: number;
  }[];
};

export const adminInputClass =
  'w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm text-[var(--text-primary)] ring-[var(--primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20';
