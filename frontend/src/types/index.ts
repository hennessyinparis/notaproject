export interface UserBrief {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_verified: boolean;
}

export interface Track {
  id: number;
  user_id: number;
  title: string;
  description: string | null;
  genre: string | null;
  tags: string[] | null;
  file_url: string;
  file_size: number;
  duration_seconds: number;
  waveform_data: { peaks?: number[]; version?: number } | null;
  cover_url: string | null;
  plays_count: number;
  likes_count: number;
  reposts_count: number;
  comments_count: number;
  is_public: boolean;
  is_downloadable: boolean;
  allow_comments: boolean;
  bpm: number | null;
  key_signature: string | null;
  created_at: string;
  published_at: string | null;
  user?: UserBrief;
}

export interface AuthUser {
  id: number;
  username: string;
  email?: string | null;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  city: string | null;
  website: string | null;
  is_verified: boolean;
  is_admin?: boolean;
  is_blocked?: boolean;
  subscription_type: string;
  artist_subscription_type: string;
  subscription_expires_at: string | null;
  created_at: string;
}
