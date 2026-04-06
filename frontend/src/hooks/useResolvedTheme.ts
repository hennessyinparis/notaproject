import { useEffect, useState } from 'react';

import { useThemeStore } from '../store/themeStore';

/** Эффективная тема с учётом system и `data-theme` на `<html>`. */
export function useResolvedTheme(): 'light' | 'dark' {
  const mode = useThemeStore((s) => s.mode);
  const [t, setT] = useState<'light' | 'dark'>(() =>
    typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
  );

  useEffect(() => {
    const read = () => {
      setT(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
    };
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    if (mode === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', read);
      return () => {
        obs.disconnect();
        mq.removeEventListener('change', read);
      };
    }
    return () => obs.disconnect();
  }, [mode]);

  return t;
}
