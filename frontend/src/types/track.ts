export interface TrackArtistBrief {
  id: number;
  username: string;
  display_name: string;
  avatar_url?: string | null;
  is_verified?: boolean;
}

export interface Track {
  id: number;
  user_id?: number;
  title: string;
  description?: string | null;
  genre?: string | null;
  tags?: string[] | null;
  mood?: string | null;
  file_url?: string;
  cover_url?: string | null;
  duration_seconds: number;
  waveform_data?: { peaks?: string | number[] } | null;
  plays_count?: number;
  likes_count?: number;
  reposts_count?: number;
  comments_count?: number;
  is_public?: boolean;
  is_downloadable?: boolean;
  allow_comments?: boolean;
  bpm?: number | null;
  key_signature?: string | null;
  created_at?: string;
  published_at?: string | null;
  user?: TrackArtistBrief;
  is_liked?: boolean;
  is_reposted?: boolean;
  /** @deprecated use user.display_name */
  artist?: { name: string };
}
