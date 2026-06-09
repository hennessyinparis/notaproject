import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, ExternalLink, FileText, GraduationCap, Loader2, Search, XCircle } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

import { api } from '../../api/client';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { admCard, admCardPad, admEmpty, admMain } from './adminStyles';

type PendingUser = {
  id: number;
  username: string;
  email: string;
  display_name: string;
  doc_url: string | null;
  created_at: string | null;
};

export function AdminVerificationsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState('');

  const { data: pending, isLoading } = useQuery({
    queryKey: ['admin-student-verifications'],
    queryFn: () => api.get<PendingUser[]>('/api/admin/student-verifications').then((r) => r.data),
    refetchInterval: 15_000,
  });

  const verifyM = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.patch(`/api/admin/users/${id}/student-verification`, { status }),
    onSuccess: async () => {
      toast.success('Статус обновлён');
      await qc.invalidateQueries({ queryKey: ['admin-student-verifications'] });
    },
    onError: () => toast.error('Ошибка'),
  });

  const filtered = pending?.filter(
    (u) =>
      u.username.toLowerCase().includes(filter.toLowerCase()) ||
      u.email.toLowerCase().includes(filter.toLowerCase()) ||
      u.display_name.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className={admMain}>
      <AdminPageHeader
        icon={GraduationCap}
        title="Верификация студентов"
        description="Заявки на подтверждение статуса студента"
      />

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Поиск по имени, email или логину..."
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] py-2.5 pl-10 pr-4 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--primary)]/50 focus:ring-2 focus:ring-[var(--primary)]/20"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
        </div>
      ) : !filtered || filtered.length === 0 ? (
        <div className={admEmpty}>
          {filter ? 'Ничего не найдено' : 'Нет заявок на верификацию'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((u) => (
            <div key={u.id} className={`${admCard} ${admCardPad}`}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-[var(--primary)] shrink-0" aria-hidden />
                    <span className="font-semibold text-[var(--text-primary)] truncate">{u.display_name}</span>
                    <span className="text-sm text-[var(--text-muted)]">@{u.username}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-[var(--text-secondary)]">{u.email}</p>
                  {u.created_at && (
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      Отправлено: {new Date(u.created_at).toLocaleString('ru-RU')}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {u.doc_url && (
                    <a
                      href={u.doc_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--primary)]/30 hover:text-[var(--primary)]"
                    >
                      <FileText className="h-3.5 w-3.5" aria-hidden />
                      Документ
                      <ExternalLink className="h-3 w-3 opacity-60" aria-hidden />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => verifyM.mutate({ id: u.id, status: 'approved' })}
                    disabled={verifyM.isPending}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-500 disabled:opacity-50"
                  >
                    <CheckCircle className="h-3.5 w-3.5" aria-hidden />
                    Подтвердить
                  </button>
                  <button
                    type="button"
                    onClick={() => verifyM.mutate({ id: u.id, status: 'rejected' })}
                    disabled={verifyM.isPending}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3.5 py-2 text-xs font-semibold text-[var(--error)] transition-colors hover:bg-[var(--error)]/10"
                  >
                    <XCircle className="h-3.5 w-3.5" aria-hidden />
                    Отклонить
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
