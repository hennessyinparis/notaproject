export interface User {
  id: number;
  username: string;
  display_name: string;
  avatar_url?: string | null;
}

export interface AuthUser extends User {
  email?: string | null;
  bio?: string | null;
  city?: string | null;
  website?: string | null;
  is_verified?: boolean;
  is_admin?: boolean;
  is_blocked?: boolean;
  subscription_type?: string;
  artist_subscription_type?: string;
  subscription_expires_at?: string | null;
  student_verification_status?: string;
  messages_privacy?: string;
  profile_visibility?: string;
  created_at?: string;
}