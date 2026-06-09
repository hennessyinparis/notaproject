import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, KeyRound, Lock, Palette, Settings as SettingsIcon, Trash2, Upload, UserRound, GraduationCap } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

import { api } from '../api/client';
import { Button } from '../components/common/Button';
import { CustomSelect } from '../components/ui/CustomSelect';
import { PageShell } from '../components/layout/PageShell';
import { useAuthStore } from '../store/authStore';
import type { AuthUser } from '../types';
import { useThemeStore } from '../store/themeStore';
import { useNavigate } from 'react-router-dom';

const inputClass =
  'w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm text-[var(--text-primary)] ring-[var(--primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20';

export function Settings() {
  const { mode, setMode } = useThemeStore();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const avatarRef = useRef<HTMLInputElement>(null);
  const studentRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    display_name: user?.display_name ?? '',
    bio: user?.bio ?? '',
    city: user?.city ?? '',
    website: user?.website ?? '',
    messages_privacy: (user as AuthUser & { messages_privacy?: string })?.messages_privacy ?? 'everyone',
    profile_visibility: (user as AuthUser & { profile_visibility?: string })?.profile_visibility ?? 'public',
  });
  const [pwd, setPwd] = useState({ current: '', next: '' });
  const [deletePwd, setDeletePwd] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const saveM = useMutation({
    mutationFn: () => api.patch('/api/users/me', form).then((r) => r.data),
    onSuccess: async (data) => {
      setUser(data);
      toast.success('Профиль обновлён');
      await qc.invalidateQueries({ queryKey: ['me'] });
    },
    onError: () => toast.error('Ошибка сохранения'),
  });

  const avatarM = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.post('/api/users/me/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
    },
    onSuccess: async (data) => {
      setUser(data);
      toast.success('Аватар обновлён');
      await qc.invalidateQueries({ queryKey: ['me'] });
    },
    onError: () => toast.error('Не удалось загрузить аватар'),
  });

  const passwordM = useMutation({
    mutationFn: () =>
      api.post('/api/users/me/change-password', {
        current_password: pwd.current,
        new_password: pwd.next,
      }),
    onSuccess: () => {
      toast.success('Пароль изменён');
      setPwd({ current: '', next: '' });
    },
    onError: () => toast.error('Неверный текущий пароль'),
  });

  const studentM = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.post('/api/users/me/student-verification', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
    },
    onSuccess: async (data) => {
      setUser(data);
      toast.success('Документ отправлен на проверку');
      await qc.invalidateQueries({ queryKey: ['me'] });
    },
    onError: () => toast.error('Не удалось загрузить'),
  });

  const deleteM = useMutation({
    mutationFn: () =>
      api.post('/api/users/me/delete-account', { password: deletePwd, confirm: true }),
    onSuccess: () => {
      logout();
      navigate('/');
      toast.success('Аккаунт удалён');
    },
    onError: () => toast.error('Неверный пароль'),
  });

  const base = import.meta.env.VITE_API_URL || '';
  const avatarSrc = user?.avatar_url
    ? user.avatar_url.startsWith('http')
      ? user.avatar_url
      : `${base}${user.avatar_url}`
    : null;

  const studentStatus = (user as { student_verification_status?: string })?.student_verification_status ?? 'none';

  return (
    <PageShell
      title="Настройки"
      description="Профиль, безопасность, подписка и студенческий статус"
      icon={<SettingsIcon className="h-7 w-7 text-[var(--primary)]" strokeWidth={2} aria-hidden />}
    >
      <div className="mx-auto max-w-xl space-y-6">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6">
          <div className="mb-4 flex items-center gap-3">
            <Palette className="h-5 w-5 text-[var(--primary)]" />
            <h2 className="font-semibold">Внешний вид</h2>
          </div>
          <CustomSelect
            value={mode}
            onChange={(v) => setMode(v as 'light' | 'dark' | 'system')}
            options={[
              { value: 'light', label: 'Светлая' },
              { value: 'dark', label: 'Тёмная' },
              { value: 'system', label: 'Как в системе' },
            ]}
          />
        </section>

        {!user?.is_admin && (
          <>
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6">
              <div className="mb-4 flex items-center gap-3">
                <UserRound className="h-5 w-5 text-[var(--primary)]" />
                <h2 className="font-semibold">Профиль и аватар</h2>
              </div>
              <div className="mb-4 flex items-center gap-4">
                <div className="h-16 w-16 overflow-hidden rounded-full bg-[var(--bg-elevated)]">
                  {avatarSrc ? <img src={avatarSrc} alt="" className="h-full w-full object-cover" /> : null}
                </div>
                <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) avatarM.mutate(f);
                }} />
                <Button variant="secondary" onClick={() => avatarRef.current?.click()} loading={avatarM.isPending}>
                  <Upload className="mr-2 h-4 w-4" />
                  Загрузить аватар
                </Button>
              </div>
              <div className="space-y-3">
                <input value={form.display_name} onChange={(e) => setForm((p) => ({ ...p, display_name: e.target.value }))} placeholder="Отображаемое имя" className={inputClass} />
                <textarea value={form.bio} onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))} placeholder="О себе" rows={3} className={`${inputClass} resize-y`} />
                <input value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} placeholder="Город" className={inputClass} />
                <input value={form.website} onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))} placeholder="Сайт" className={inputClass} />
                <Button onClick={() => saveM.mutate()} loading={saveM.isPending}>Сохранить профиль</Button>
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6">
              <div className="mb-4 flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-[var(--primary)]" />
                <h2 className="font-semibold">Подписка</h2>
              </div>
              <p className="mb-3 text-sm text-[var(--text-muted)]">
                Текущий план: {user?.subscription_type ?? 'free'}
                {user?.subscription_expires_at ? ` · до ${new Date(user.subscription_expires_at).toLocaleDateString('ru-RU')}` : ''}
              </p>
              <Link to="/subscriptions" className="text-sm font-semibold text-[var(--primary)] hover:underline">
                Управление тарифами →
              </Link>
            </section>

            <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6">
              <div className="mb-4 flex items-center gap-3">
                <GraduationCap className="h-5 w-5 text-[var(--primary)]" />
                <h2 className="font-semibold">Статус студента</h2>
              </div>
              <p className="mb-3 text-sm text-[var(--text-muted)]">
                Статус:{' '}
                {studentStatus === 'approved'
                  ? 'подтверждён'
                  : studentStatus === 'pending'
                    ? 'на проверке'
                    : studentStatus === 'rejected'
                      ? 'отклонён'
                      : 'не подтверждён'}
              </p>
              <input ref={studentRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) studentM.mutate(f);
              }} />
              <Button variant="secondary" onClick={() => studentRef.current?.click()} loading={studentM.isPending}>
                Загрузить справку / студенческий
              </Button>
            </section>

            <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6">
              <div className="mb-4 flex items-center gap-3">
                <Lock className="h-5 w-5 text-[var(--primary)]" />
                <h2 className="font-semibold">Приватность</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Кто может писать в сообщения</label>
                  <CustomSelect
                    value={form.messages_privacy}
                    onChange={(v) => setForm((p) => ({ ...p, messages_privacy: v }))}
                    options={[
                      { value: 'everyone', label: 'Все пользователи' },
                      { value: 'followers', label: 'Только подписчики (те, кто на вас подписан)' },
                      { value: 'nobody', label: 'Никто' },
                    ]}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Видимость профиля</label>
                  <CustomSelect
                    value={form.profile_visibility}
                    onChange={(v) => setForm((p) => ({ ...p, profile_visibility: v }))}
                    options={[
                      { value: 'public', label: 'Публичный — виден всем' },
                      { value: 'followers', label: 'Только подписчикам' },
                      { value: 'private', label: 'Скрытый — только вы' },
                    ]}
                    className="mt-1.5"
                  />
                </div>
                <Button onClick={() => saveM.mutate()} loading={saveM.isPending} variant="secondary">
                  Сохранить приватность
                </Button>
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6">
              <div className="mb-4 flex items-center gap-3">
                <KeyRound className="h-5 w-5 text-[var(--primary)]" />
                <h2 className="font-semibold">Безопасность</h2>
              </div>
              <div className="space-y-3">
                <input type="text" name="username_cc" autoComplete="off" className="hidden" aria-hidden tabIndex={-1} readOnly />
                <input type="password" name="current_password" autoComplete="off" value={pwd.current} onChange={(e) => setPwd((p) => ({ ...p, current: e.target.value }))} placeholder="Текущий пароль" className={inputClass} />
                <input type="password" name="new_password" autoComplete="new-password" value={pwd.next} onChange={(e) => setPwd((p) => ({ ...p, next: e.target.value }))} placeholder="Новый пароль" className={inputClass} />
                <Button onClick={() => passwordM.mutate()} loading={passwordM.isPending}>Сменить пароль</Button>
                <p className="text-sm">
                  <Link to="/forgot-password" className="text-[var(--primary)] hover:underline">
                    Забыли пароль?
                  </Link>
                </p>
              </div>
            </section>

            <section className="rounded-2xl border border-red-500/30 bg-[var(--bg-surface)] p-6">
              <div className="mb-4 flex items-center gap-3 text-[var(--error)]">
                <Trash2 className="h-5 w-5" />
                <h2 className="font-semibold">Удаление аккаунта</h2>
              </div>
              <label className="mb-3 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.checked)} />
                Я понимаю, что данные будут удалены безвозвратно
              </label>
              <input type="password" value={deletePwd} onChange={(e) => setDeletePwd(e.target.value)} placeholder="Пароль для подтверждения" className={inputClass} />
              <Button variant="secondary" className="mt-3 !text-[var(--error)]" disabled={!deleteConfirm} onClick={() => deleteM.mutate()} loading={deleteM.isPending}>
                Удалить аккаунт
              </Button>
            </section>
          </>
        )}
      </div>
    </PageShell>
  );
}
