import { useThemeStore } from '../store/themeStore';

export function Settings() {
  const { mode, setMode } = useThemeStore();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="font-display text-3xl font-bold">Настройки</h1>

      <section className="rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-6">
        <h2 className="mb-4 font-semibold">Тема</h2>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as 'light' | 'dark' | 'system')}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3"
        >
          <option value="light">Светлая</option>
          <option value="dark">Тёмная</option>
          <option value="system">Системная</option>
        </select>
      </section>
    </div>
  );
}
