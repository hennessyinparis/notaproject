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

export const adminInputClass =
  'w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm text-[var(--text-primary)] ring-[var(--primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20';
