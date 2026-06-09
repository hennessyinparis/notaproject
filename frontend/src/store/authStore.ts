import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { setAuthHeader } from '../api/client';
import type { AuthUser } from '../types';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  setTokens: (a: string | null, r: string | null) => void;
  setAccessToken: (a: string) => void;
  setRefreshToken: (r: string) => void;
  setUser: (u: AuthUser | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setTokens: (accessToken, refreshToken) => {
        set({ accessToken, refreshToken });
        setAuthHeader(accessToken);
      },
      setAccessToken: (accessToken) => {
        set({ accessToken });
        setAuthHeader(accessToken);
      },
      setRefreshToken: (refreshToken) => set({ refreshToken }),
      setUser: (user) => set({ user }),
      logout: () => {
        set({ accessToken: null, refreshToken: null, user: null });
        setAuthHeader(null);
      },
    }),
    { name: 'nota-auth', partialize: (s) => ({ accessToken: s.accessToken, refreshToken: s.refreshToken }) }
  )
);
