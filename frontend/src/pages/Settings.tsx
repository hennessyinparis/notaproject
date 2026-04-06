import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Palette, Settings as SettingsIcon, UserRound } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

import { api } from '../api/client';
import { Button } from '../components/common/Button';
import { PageShell } from '../components/layout/PageShell';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';

const inputClass =
  'w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm text-[var(--text-primary)] ring-[var(--primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20';

export function Settings() {
  const { mode, setMode } = useThemeStore();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const qc = useQueryClient();
  const [form, setForm] = useState({
    display_name: user?.display_name ?? '',
    bio: user?.bio ?? '',
    city: user?.city ?? '',
    website: user?.website ?? '',
  });

  const saveM = useMutation({
    mutationFn: () => api.patch('/api/users/me', form).then((r) => r.data),
    onSuccess: async (data) => {
      setUser(data);
      toast.success('Профиль обновлён');
      await qc.invalidateQueries({ queryKey: ['me'] });
    },
    onError: () => toast.error('Ошибка сохранения'),
  });

  return (
    <PageShell
      title="Настройки"
      description="Тема, отображаемое имя и контакты в профиле"
      icon={<SettingsIcon className="h-7 w-7 text-[var(--primary)]" strokeWidth={2} aria-hidden />}
    >
      <div className="mx-auto max-w-xl space-y-6">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-hover)] ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary-light)] text-[var(--primary)]">
            <Palette className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h2 className="font-semibold text-[var(--text-primary)]">Внешний вид</h2>
            <p className="text-sm text-[var(--text-muted)]">Как отображается интерфейс</p>
          </div>
        </div>
        <label className="block text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Тема</label>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as 'light' | 'dark' | 'system')}
          className={`${inputClass} mt-2`}
        >
          <option value="light">Светлая</option>
          <option value="dark">Тёмная</option>
          <option value="system">Как в системе</option>
        </select>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-hover)] ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary-light)] text-[var(--primary)]">
            <UserRound className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h2 className="font-semibold text-[var(--text-primary)]">Профиль</h2>
            <p className="text-sm text-[var(--text-muted)]">Имя и описание на странице артиста</p>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Отображаемое имя</label>
            <input
              value={form.display_name}
              onChange={(e) => setForm((p) => ({ ...p, display_name: e.target.value }))}
              placeholder="Как вас видят слушатели"
              className={`${inputClass} mt-1.5`}
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">О себе</label>
            <textarea
              value={form.bio}
              onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
              placeholder="Коротко о музыке и проектах"
              rows={4}
              className={`${inputClass} mt-1.5 resize-y`}
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Город</label>
            <input
              value={form.city}
              onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
              placeholder="Необязательно"
              className={`${inputClass} mt-1.5`}
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Сайт или соцсети</label>
            <input
              value={form.website}
              onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))}
              placeholder="https://…"
              className={`${inputClass} mt-1.5`}
            />
          </div>
          <Button onClick={() => saveM.mutate()} loading={saveM.isPending}>
            Сохранить профиль
          </Button>
        </div>
      </section>
      </div>
    </PageShell>
  );
}
