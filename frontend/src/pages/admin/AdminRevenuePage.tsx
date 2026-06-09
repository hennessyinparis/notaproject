import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, DollarSign, RefreshCw, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { api } from '../../api/client';
import type { SubscriptionDetail, SubscriptionRevenue } from './adminTypes';
import { formatRub, planLabel } from './adminPlanLabels';
import { admCard, admCardPad, admMain, admRow } from './adminStyles';

const ALL_PLANS = ['listener_plus', 'listener_student', 'artist_pro'] as const;

export function AdminRevenuePage() {
  const revenueQ = useQuery({
    queryKey: ['subscription-revenue'],
    queryFn: () => api.get<SubscriptionRevenue>('/api/admin/subscription-revenue').then((r) => r.data),
  });
  const subsQ = useQuery({
    queryKey: ['subscriptions-list'],
    queryFn: () => api.get<SubscriptionDetail[]>('/api/admin/subscriptions/list').then((r) => r.data),
  });

  const qc = useQueryClient();

  const cancelSubM = useMutation({
    mutationFn: (id: number) => api.delete(`/api/admin/subscriptions/${id}`),
    onSuccess: async () => {
      toast.success('Подписка отозвана');
      await qc.invalidateQueries({ queryKey: ['subscriptions-list'] });
      await qc.invalidateQueries({ queryKey: ['subscription-revenue'] });
    },
    onError: () => toast.error('Не удалось отозвать подписку'),
  });

  const data = revenueQ.data;
  const subs = subsQ.data ?? [];
  const activeCount = data?.active_subscriptions ?? 0;
  const total = data?.total_revenue ?? 0;
  const avgCheck = activeCount > 0 ? total / activeCount : 0;

  if (revenueQ.isLoading) {
    return (
      <div className={admMain}>
        <div className="py-12 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--primary)]" />
          <p className="mt-4 text-sm text-[var(--text-secondary)]">Загрузка данных…</p>
        </div>
      </div>
    );
  }

  if (revenueQ.isError) {
    const msg =
      (revenueQ.error as { response?: { data?: { detail?: string } }; message?: string })?.response?.data
        ?.detail ?? revenueQ.error.message;
    return (
      <div className={admMain}>
        <div className="rounded-2xl border border-[var(--error)]/30 bg-[var(--bg-surface)] px-6 py-10 text-center">
          <h2 className="font-semibold text-[var(--error)]">Не удалось загрузить доходы</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">{msg}</p>
          <button
            type="button"
            onClick={() => revenueQ.refetch()}
            className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)]"
          >
            Повторить
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={admMain}>
      <AdminPageHeader
        icon={DollarSign}
        title="Доходы от подписок"
        description="MRR по активным платным подпискам: Нота Plus, Студент и Артист Pro"
        actions={
          <button
            type="button"
            onClick={() => { revenueQ.refetch(); subsQ.refetch(); }}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] transition hover:border-[var(--primary)]/35 hover:text-[var(--primary)]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Обновить
          </button>
        }
      />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className={`${admCard} ${admCardPad}`}>
          <h3 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">Месячный доход (MRR)</h3>
          <p className="font-display text-3xl font-bold text-[var(--text-primary)]">{formatRub(total)}</p>
          <p className="mt-2 text-xs text-[var(--text-muted)]">Сумма price_paid по активным подпискам</p>
        </div>
        <div className={`${admCard} ${admCardPad}`}>
          <h3 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">Активных подписок</h3>
          <p className="font-display text-3xl font-bold text-[var(--text-primary)]">{activeCount}</p>
          <p className="mt-2 text-xs text-[var(--text-muted)]">Записей в subscriptions с is_active</p>
        </div>
        <div className={`${admCard} ${admCardPad}`}>
          <h3 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">Средний чек</h3>
          <p className="font-display text-3xl font-bold text-[var(--text-primary)]">{formatRub(avgCheck)}</p>
          <p className="mt-2 text-xs text-[var(--text-muted)]">MRR ÷ число активных подписок</p>
        </div>
        <div className={`${admCard} ${admCardPad}`}>
          <h3 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">Потенциальный MRR</h3>
          <p className="font-display text-3xl font-bold text-[var(--text-primary)]">{formatRub(avgCheck * activeCount * 1.3)}</p>
          <p className="mt-2 text-xs text-[var(--text-muted)]">При росте на 30%</p>
        </div>
      </div>

      <div className={`${admCard} ${admCardPad}`}>
        <h3 className="mb-4 text-sm font-semibold text-[var(--text-muted)]">По тарифам</h3>
        {activeCount === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">
            Пока нет активных платных подписок. Доход появится после покупки тарифа на странице «Подписки».
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                  <th className="pb-3 pr-4 font-semibold">Тариф</th>
                  <th className="pb-3 pr-4 font-semibold">Подписок</th>
                  <th className="pb-3 font-semibold">Доход / мес</th>
                </tr>
              </thead>
              <tbody>
                {ALL_PLANS.map((plan) => {
                  const count = data?.count_by_plan?.[plan] ?? 0;
                  const revenue = data?.by_plan?.[plan] ?? 0;
                  if (count === 0 && revenue === 0) return null;
                  return (
                    <tr key={plan} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-3 pr-4 font-medium text-[var(--text-primary)]">{planLabel(plan)}</td>
                      <td className="py-3 pr-4 tabular-nums text-[var(--text-secondary)]">{count}</td>
                      <td className="py-3 font-semibold tabular-nums text-[var(--primary)]">{formatRub(revenue)}</td>
                    </tr>
                  );
                })}
                {ALL_PLANS.every((p) => !(data?.count_by_plan?.[p] ?? 0)) && (
                  <tr>
                    <td colSpan={3} className="py-4 text-[var(--text-muted)]">
                      Нет разбивки по планам — проверьте записи subscriptions
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={`${admCard} ${admCardPad}`}>
        <h3 className="mb-4 text-sm font-semibold text-[var(--text-muted)]">
          Кто оформил подписку ({subs.length})
        </h3>
        {subs.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">Нет активных подписок</p>
        ) : (
          <div className="space-y-2">
            {subs.map((sub) => (
              <div key={sub.id} className={`${admRow} gap-3 p-3`}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--primary-light)] to-[var(--primary)]/20 text-xs font-bold text-[var(--primary)] ring-1 ring-[var(--primary)]/20">
                  {(sub.display_name || sub.username)[0]?.toUpperCase() || '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <Link to={`/artist/${sub.username}`} className="truncate text-sm font-semibold text-[var(--text-primary)] hover:underline">
                    {sub.display_name || sub.username}
                  </Link>
                  <p className="text-xs text-[var(--text-muted)]">@{sub.username}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-[var(--primary)]">{formatRub(sub.price_paid)}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">{planLabel(sub.plan_type)}</p>
                </div>
                <div className="shrink-0 text-right text-[10px] text-[var(--text-muted)]">
                  <Calendar className="mr-1 inline h-3 w-3" />
                  {new Date(sub.created_at).toLocaleDateString('ru-RU')}
                  {sub.expires_at && <><br />до {new Date(sub.expires_at).toLocaleDateString('ru-RU')}</>}
                </div>
                <button
                  type="button"
                  title="Отозвать подписку"
                  disabled={cancelSubM.isPending}
                  onClick={() => { if (window.confirm(`Отозвать подписку пользователя @${sub.username}?`)) cancelSubM.mutate(sub.id); }}
                  className="shrink-0 rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-500 transition"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
