import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wallet, CheckCircle, XCircle, Clock, AlertCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { api } from '../../api/client';
import { AdminLayout } from '../../components/admin/AdminLayout';

interface WithdrawalItem {
  id: number;
  artist_id: number;
  artist_username: string | null;
  artist_display_name: string | null;
  amount: number;
  status: string;
  bank_card_mask: string;
  recipient_name: string;
  phone: string | null;
  admin_note: string | null;
  created_at: string;
  processed_at: string | null;
}

export default function AdminWithdrawalsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selected, setSelected] = useState<WithdrawalItem | null>(null);
  const [adminNote, setAdminNote] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-withdrawals', statusFilter],
    queryFn: () =>
      api
        .get<WithdrawalItem[]>(
          `/api/admin/withdrawals${statusFilter !== 'all' ? `?status=${statusFilter}` : ''}`
        )
        .then((r) => r.data),
  });

  const updateM = useMutation({
    mutationFn: async ({ id, status, note }: { id: number; status: string; note: string }) =>
      api.patch(`/api/admin/withdrawals/${id}`, { status, admin_note: note || null }).then((r) => r.data),
    onSuccess: () => {
      toast.success('Статус обновлён');
      queryClient.invalidateQueries({ queryKey: ['admin-withdrawals'] });
      setSelected(null);
      setAdminNote('');
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Ошибка'),
  });

  const statusBadge = (status: string) => {
    const map: Record<string, { cls: string; icon: any; label: string }> = {
      pending: { cls: 'bg-amber-500/10 text-amber-600', icon: Clock, label: 'Ожидает' },
      processing: { cls: 'bg-blue-500/10 text-blue-600', icon: Loader2, label: 'В обработке' },
      completed: { cls: 'bg-green-500/10 text-green-600', icon: CheckCircle, label: 'Выплачено' },
      rejected: { cls: 'bg-red-500/10 text-red-600', icon: XCircle, label: 'Отклонено' },
    };
    const s = map[status] || { cls: 'bg-gray-500/10 text-gray-600', icon: AlertCircle, label: status };
    const Icon = s.icon;
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${s.cls}`}>
        <Icon className="h-3.5 w-3.5" />
        {s.label}
      </span>
    );
  };

  return (
    <AdminLayout title="Выплаты артистам" description="Управление заявками на вывод средств">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          {['all', 'pending', 'processing', 'completed', 'rejected'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                statusFilter === s
                  ? 'bg-[var(--primary)] text-white'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:bg-[var(--border)]'
              }`}
            >
              {s === 'all' && 'Все'}
              {s === 'pending' && 'Ожидают'}
              {s === 'processing' && 'В обработке'}
              {s === 'completed' && 'Выплачены'}
              {s === 'rejected' && 'Отклонены'}
            </button>
          ))}
        </div>

        {isLoading ? (
          <p className="text-sm text-[var(--text-muted)]">Загрузка...</p>
        ) : data && data.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">
                  <th className="px-4 py-3 font-medium text-[var(--text-muted)]">Артист</th>
                  <th className="px-4 py-3 font-medium text-[var(--text-muted)]">Сумма</th>
                  <th className="px-4 py-3 font-medium text-[var(--text-muted)]">Карта</th>
                  <th className="px-4 py-3 font-medium text-[var(--text-muted)]">Статус</th>
                  <th className="px-4 py-3 font-medium text-[var(--text-muted)]">Дата</th>
                  <th className="px-4 py-3 font-medium text-[var(--text-muted)]">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.map((w) => (
                  <tr key={w.id} className="transition hover:bg-[var(--bg-elevated)]/50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-[var(--text-primary)]">
                        {w.artist_display_name || w.artist_username || '—'}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">@{w.artist_username}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-[var(--primary)]">{w.amount} ₽</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--text-muted)]">
                      {w.bank_card_mask}
                    </td>
                    <td className="px-4 py-3">{statusBadge(w.status)}</td>
                    <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                      {new Date(w.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {w.status === 'pending' && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => setSelected(w)}
                            className="rounded-lg bg-[var(--primary)] px-2.5 py-1 text-xs font-medium text-white transition hover:opacity-90"
                          >
                            Обработать
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-surface)] p-8 text-center">
            <Wallet className="mx-auto h-10 w-10 text-[var(--text-muted)]" />
            <p className="mt-2 text-sm text-[var(--text-muted)]">Заявок на вывод пока нет</p>
          </div>
        )}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 font-semibold">Заявка #{selected.id}</h3>
            <p className="mb-4 text-sm text-[var(--text-muted)]">
              {selected.artist_display_name || selected.artist_username} — {selected.amount} ₽ на{' '}
              {selected.bank_card_mask}
            </p>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
                Заметка администратора
              </label>
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-2.5 text-sm"
                rows={3}
                placeholder="Комментарий (опционально)..."
              />
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => updateM.mutate({ id: selected.id, status: 'completed', note: adminNote })}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
              >
                <CheckCircle className="mr-1 inline h-4 w-4" />
                Выплачено
              </button>
              <button
                onClick={() => updateM.mutate({ id: selected.id, status: 'rejected', note: adminNote })}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
              >
                <XCircle className="mr-1 inline h-4 w-4" />
                Отклонить
              </button>
              <button
                onClick={() => setSelected(null)}
                className="rounded-lg bg-[var(--bg-elevated)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:bg-[var(--border)]"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
