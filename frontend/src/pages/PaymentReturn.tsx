import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle, Loader2, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

import { api } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { PageShell } from '../components/layout/PageShell';

export function PaymentReturn() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  const paymentId = searchParams.get('payment_id') || localStorage.getItem('last_payment_id');

  const [status, setStatus] = useState<'checking' | 'success' | 'failed' | 'error'>('checking');
  const [errorDetail, setErrorDetail] = useState<string>('');

  const { data, error, refetch } = useQuery({
    queryKey: ['payment-status', paymentId],
    queryFn: () =>
      api.get(`/api/payments/${paymentId}/status`).then((r) => r.data),
    enabled: !!paymentId,
    refetchInterval: (query) => {
      if (query?.state?.data?.status === 'succeeded' || query?.state?.data?.status === 'canceled') return false;
      return 3000;
    },
  });

  useEffect(() => {
    if (data?.status === 'succeeded') {
      setStatus('success');
      // Don't call setUser with partial data — let the me query refresh it
      queryClient.invalidateQueries({ queryKey: ['me'] });
      toast.success('Подписка успешно оформлена!');
      // Clean up localStorage after success
      localStorage.removeItem('last_payment_id');
    } else if (data?.status === 'canceled') {
      setStatus('failed');
      localStorage.removeItem('last_payment_id');
    } else if (error) {
      setStatus('error');
      const err = error as any;
      setErrorDetail(
        err?.response?.status === 404
          ? 'Платёж не найден. Возможно, он уже обработан или ID неверный.'
          : err?.response?.status === 401
          ? 'Сессия истекла. Войдите заново.'
          : err?.response?.data?.detail || 'Не удалось связаться с сервером.'
      );
    }
  }, [data, error, setUser, queryClient]);

  return (
    <PageShell title="Результат оплаты">
      <div className="mx-auto max-w-md pt-10">
        <button
          onClick={() => navigate('/subscriptions')}
          className="mb-6 flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад к подпискам
        </button>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-8 text-center shadow-lg">
          {status === 'checking' && (
            <>
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-[var(--primary)]" />
              <h2 className="mt-4 font-display text-xl font-bold text-[var(--text-primary)]">
                Проверяем оплату...
              </h2>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Это может занять несколько секунд. Не закрывайте страницу.
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
              <h2 className="mt-4 font-display text-xl font-bold text-[var(--text-primary)]">
                Оплата прошла успешно!
              </h2>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Ваша подписка активирована. Приятного прослушивания!
              </p>
              <button
                onClick={() => navigate('/subscriptions')}
                className="mt-6 rounded-xl bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Перейти к подпискам
              </button>
            </>
          )}

          {status === 'failed' && (
            <>
              <XCircle className="mx-auto h-12 w-12 text-red-500" />
              <h2 className="mt-4 font-display text-xl font-bold text-[var(--text-primary)]">
                Оплата не завершена
              </h2>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Платёж был отменён или не прошёл. Попробуйте снова.
              </p>
              <button
                onClick={() => navigate('/subscriptions')}
                className="mt-6 rounded-xl bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Попробовать снова
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="mx-auto h-12 w-12 text-amber-500" />
              <h2 className="mt-4 font-display text-xl font-bold text-[var(--text-primary)]">
                Ошибка проверки
              </h2>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Не удалось проверить статус платежа.
              </p>
              {errorDetail && (
                <p className="mt-2 text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">
                  {errorDetail}
                </p>
              )}
              <div className="mt-6 flex gap-3 justify-center">
                <button
                  onClick={() => {
                    setStatus('checking');
                    refetch();
                  }}
                  className="rounded-xl bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  Проверить снова
                </button>
                <button
                  onClick={() => navigate('/subscriptions')}
                  className="rounded-xl border border-[var(--border)] px-6 py-2.5 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--bg-elevated)]"
                >
                  К подпискам
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </PageShell>
  );
}
