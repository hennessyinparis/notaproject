import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, HandCoins, RefreshCw, Search, Trash2, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { api } from '../../api/client';
import { admCard, admCardPad, admMain } from './adminStyles';

type DonationRow = {
  id: number;
  amount_rub: number;
  message: string | null;
  is_anonymous: boolean;
  created_at: string;
  donor_id: number | null;
  donor_username: string | null;
  donor_display_name: string | null;
  artist_id: number;
  artist_username: string | null;
  artist_display_name: string | null;
};

type DonationStats = {
  total_rub: number;
  total_count: number;
  this_month_rub: number;
  this_month_count: number;
  top_artists: Array<{ display_name: string; username: string; total_rub: number; count: number }>;
  daily_chart: Array<{ date: string; total_rub: number; count: number }>;
};

export function AdminDonationsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');

  const statsQ = useQuery({
    queryKey: ['admin-donation-stats'],
    queryFn: () => api.get<DonationStats>('/api/admin/donations/stats').then((r) => r.data),
  });

  const listQ = useQuery({
    queryKey: ['admin-donations'],
    queryFn: () => api.get<DonationRow[]>('/api/admin/donations?limit=200').then((r) => r.data),
  });

  const deleteM = useMutation({
    mutationFn: (id: number) => api.delete(`/api/admin/donations/${id}`),
    onSuccess: () => {
      toast.success('Донат удалён');
      qc.invalidateQueries({ queryKey: ['admin-donations'] });
      qc.invalidateQueries({ queryKey: ['admin-donation-stats'] });
    },
    onError: () => toast.error('Ошибка при удалении'),
  });

  const stats = statsQ.data;
  const donations = listQ.data ?? [];

  const filtered = search.trim()
    ? donations.filter(
        (d) =>
          (d.artist_display_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
          (d.artist_username ?? '').toLowerCase().includes(search.toLowerCase()) ||
          (d.donor_display_name ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : donations;

  return (
    <div className={admMain}>
      <AdminPageHeader
        icon={HandCoins}
        title="Донаты"
        description="Все донаты на платформе: статистика, мониторинг, управление"
        actions={
          <button
            type="button"
            onClick={() => { statsQ.refetch(); listQ.refetch(); }}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] transition hover:border-[var(--primary)]/35 hover:text-[var(--primary)]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Обновить
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={`${admCard} ${admCardPad}`}>
          <h3 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">Всего донатов</h3>
          <p className="font-display text-3xl font-bold text-[var(--text-primary)]">
            {stats?.total_rub.toLocaleString('ru-RU') ?? '—'} ₽
          </p>
          <p className="mt-2 text-xs text-[var(--text-muted)]">{stats?.total_count ?? 0} транзакций</p>
        </div>
        <div className={`${admCard} ${admCardPad}`}>
          <h3 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">В этом месяце</h3>
          <p className="font-display text-3xl font-bold text-[var(--text-primary)]">
            {stats?.this_month_rub.toLocaleString('ru-RU') ?? '—'} ₽
          </p>
          <p className="mt-2 text-xs text-[var(--text-muted)]">{stats?.this_month_count ?? 0} транзакций</p>
        </div>
      </div>

      {stats?.top_artists && stats.top_artists.length > 0 && (
        <div className={`${admCard} ${admCardPad}`}>
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[var(--primary)]" />
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Топ артистов по донатам</h3>
          </div>
          <div className="space-y-2">
            {stats.top_artists.map((a, i) => (
              <div key={a.username} className="flex items-center gap-3 rounded-xl bg-[var(--bg-elevated)] p-3">
                <span className="w-5 text-center text-xs font-bold text-[var(--text-muted)]">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{a.display_name}</p>
                  <p className="text-xs text-[var(--text-muted)]">@{a.username}</p>
                </div>
                <span className="shrink-0 text-sm font-bold text-[var(--primary)]">{a.total_rub.toLocaleString('ru-RU')} ₽</span>
                <span className="shrink-0 text-xs text-[var(--text-muted)]">{a.count} раз</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats?.daily_chart && stats.daily_chart.length > 0 && (
        <div className={`${admCard} ${admCardPad}`}>
          <div className="mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[var(--primary)]" />
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Донаты за последние 30 дней</h3>
          </div>
          <div className="overflow-x-auto">
            <div className="flex items-end gap-1" style={{ minHeight: 100 }}>
              {stats.daily_chart.map((d) => {
                const maxVal = Math.max(...stats.daily_chart.map((x) => x.total_rub), 1);
                const heightPct = (d.total_rub / maxVal) * 100;
                return (
                  <div key={d.date} className="flex flex-1 flex-col items-center gap-1" title={`${d.date}: ${d.total_rub} ₽ (${d.count} шт.)`}>
                    <span className="text-[9px] font-medium text-[var(--text-muted)]">{d.total_rub.toLocaleString('ru-RU')}</span>
                    <div
                      className="w-full rounded-t bg-gradient-to-t from-[var(--primary)]/60 to-[var(--primary)]/30"
                      style={{ height: `${Math.max(heightPct, 4)}%`, minHeight: 4 }}
                    />
                    <span className="text-[8px] text-[var(--text-muted)]">{d.date.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className={`${admCard} ${admCardPad}`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Все донаты ({donations.length})</h3>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по артисту или донору…"
              className="w-56 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] py-2 pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                <th className="pb-3 pr-4 font-semibold">ID</th>
                <th className="pb-3 pr-4 font-semibold">Артист</th>
                <th className="pb-3 pr-4 font-semibold">Донор</th>
                <th className="pb-3 pr-4 font-semibold">Сумма</th>
                <th className="pb-3 pr-4 font-semibold">Сообщение</th>
                <th className="pb-3 pr-4 font-semibold">Дата</th>
                <th className="pb-3 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-[var(--text-muted)]">
                    Нет донатов
                  </td>
                </tr>
              ) : (
                filtered.map((d) => (
                  <tr key={d.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-elevated)]/50">
                    <td className="py-3 pr-4 text-[var(--text-muted)]">{d.id}</td>
                    <td className="py-3 pr-4 font-medium text-[var(--text-primary)]">
                      {d.artist_display_name || d.artist_username || '—'}
                    </td>
                    <td className="py-3 pr-4 text-[var(--text-secondary)]">
                      {d.is_anonymous ? (
                        <span className="italic text-[var(--text-muted)]">Анонимно</span>
                      ) : (
                        d.donor_display_name || d.donor_username || '—'
                      )}
                    </td>
                    <td className="py-3 pr-4 font-semibold text-[var(--primary)]">{d.amount_rub.toLocaleString('ru-RU')} ₽</td>
                    <td className="max-w-[200px] truncate py-3 pr-4 text-[var(--text-secondary)]">
                      {d.message || <span className="italic text-[var(--text-muted)]">—</span>}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-4 text-[10px] text-[var(--text-muted)]">
                      {new Date(d.created_at).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--error)]/10 hover:text-[var(--error)]"
                        title="Удалить донат"
                        onClick={() => {
                          if (confirm('Удалить этот донат?')) deleteM.mutate(d.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
