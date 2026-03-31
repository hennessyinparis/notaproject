import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
}

function applyDomTheme(mode: ThemeMode) {
  const root = document.documentElement;
  let effective: 'light' | 'dark' = 'light';
  if (mode === 'system') {
    effective = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } else {
    effective = mode;
  }
  root.setAttribute('data-theme', effective);
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'system',
      setMode: (m) => {
        set({ mode: m });
        applyDomTheme(m);
      },
    }),
    { name: 'nota-theme' }
  )
);

if (typeof window !== 'undefined') {
  applyDomTheme(useThemeStore.getState().mode);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (useThemeStore.getState().mode === 'system') applyDomTheme('system');
  });
}
