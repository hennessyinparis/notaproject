import { Monitor, Moon, Sun } from 'lucide-react';

import { useThemeStore, type ThemeMode } from '../../store/themeStore';

const options: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
  { mode: 'light', label: 'Светлая тема', icon: Sun },
  { mode: 'dark', label: 'Тёмная тема', icon: Moon },
  { mode: 'system', label: 'Как в системе', icon: Monitor },
];

export function AdminThemeToggle({ className = '' }: { className?: string }) {
  const { mode, setMode } = useThemeStore();

  return (
    <div
      className={`inline-flex rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-1 shadow-inner ${className}`}
      role="group"
      aria-label="Тема оформления"
    >
      {options.map(({ mode: m, label, icon: Icon }) => {
        const on = mode === m;
        return (
          <button
            key={m}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={on}
            onClick={() => setMode(m)}
            className={[
              'rounded-lg px-2.5 py-2 transition-all',
              on
                ? 'bg-[var(--primary)] text-white shadow-md ring-1 ring-black/10 dark:ring-white/10'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]',
            ].join(' ')}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
