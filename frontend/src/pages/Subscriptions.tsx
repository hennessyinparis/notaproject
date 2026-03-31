import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Confetti from 'react-confetti';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { api } from '../api/client';
import { useAuthStore } from '../store/authStore';
import type { AuthUser } from '../types';
import { goToLogin } from '../utils/authNavigation';

type Plan = {
  id: string;
  name: string;
  price: string;
  period: string;
  color: string;
  features: string[];
  canBuy: boolean;
  badge?: string;
};

const PLANS = [
  {
    id: 'free',
    name: 'Нота Бесплатно',
    price: '0 ₽',
    period: 'навсегда',
    color: 'var(--text-muted)',
    features: ['Доступ к библиотеке треков', 'Рекламные вставки', '128 kbps', 'Базовые функции'],
    canBuy: false,
  },
  {
    id: 'listener_plus',
    name: 'Нота Плюс',
    price: '299 ₽',
    period: 'в месяц',
    color: 'var(--primary)',
    badge: 'Популярное',
    features: ['Без рекламы', '320 kbps качество', 'Офлайн прослушивание', 'Скачивание треков', 'Приоритетная поддержка'],
    canBuy: true,
  },
  {
    id: 'listener_student',
    name: 'Нота Студент',
    price: '149 ₽',
    period: 'в месяц',
    color: 'var(--success)',
    badge: 'Скидка 50%',
    features: ['Всё из Нота Плюс', 'Скидка 50% для студентов', 'Нужно подтверждение статуса студента'],
    canBuy: true,
  },
  {
    id: 'artist_pro',
    name: 'Артист Про',
    price: '599 ₽',
    period: 'в месяц',
    color: 'var(--secondary)',
    features: ['Неограниченная загрузка треков', 'Расширенная аналитика', 'Монетизация «Волна»', 'Замена трека без потери статистики'],
    canBuy: true,
  },
] satisfies Plan[];

const AUTO_SLIDE_MS = 5000;
const STEP_X_PX = 232;

function getCircularDelta(index: number, active: number, len: number): number {
  let d = index - active;
  const half = len / 2;
  if (d > half) d -= len;
  if (d < -half) d += len;
  return d;
}

/** Один активный план: приоритет артист Pro → Plus → Студент → Бесплатно */
function getCurrentPlanId(u: AuthUser | null): string {
  if (!u) return 'free';
  if (u.artist_subscription_type === 'pro') return 'artist_pro';
  if (u.subscription_type === 'plus') return 'listener_plus';
  if (u.subscription_type === 'student') return 'listener_student';
  return 'free';
}

export function Subscriptions() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const queryClient = useQueryClient();

  const [slideIndex, setSlideIndex] = useState(0);
  const [carouselPaused, setCarouselPaused] = useState(false);

  const [showPayModal, setShowPayModal] = useState(false);
  const [payStep, setPayStep] = useState<'choose' | 'processing' | 'done'>('choose');
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [selectedPlanName, setSelectedPlanName] = useState<string>('');

  useEffect(() => {
    const id = getCurrentPlanId(user ?? null);
    const idx = PLANS.findIndex((p) => p.id === id);
    if (idx >= 0) setSlideIndex(idx);
  }, [user?.subscription_type, user?.artist_subscription_type]);

  useEffect(() => {
    if (carouselPaused) return;
    const t = window.setInterval(() => {
      setSlideIndex((i) => (i + 1) % PLANS.length);
    }, AUTO_SLIDE_MS);
    return () => window.clearInterval(t);
  }, [carouselPaused]);

  const goPrev = useCallback(() => {
    setSlideIndex((i) => (i - 1 + PLANS.length) % PLANS.length);
  }, []);

  const goNext = useCallback(() => {
    setSlideIndex((i) => (i + 1) % PLANS.length);
  }, []);

  const currentPlanId = getCurrentPlanId(user ?? null);
  const getIsCurrent = (planId: string) => planId === currentPlanId;

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<AuthUser>('/api/subscriptions/cancel');
      return data;
    },
    onSuccess: (data) => {
      setUser(data);
      queryClient.invalidateQueries({ queryKey: ['me'] });
      toast.success('Подписка отменена');
    },
    onError: () => {
      toast.error('Не удалось отменить подписку');
    },
  });

  const handleCancel = () => {
    if (!accessToken) {
      goToLogin(navigate);
      return;
    }
    if (!window.confirm('Отменить текущую платную подписку? После этого можно оформить другой план.')) return;
    cancelMutation.mutate();
  };

  const handleBuy = (planId: string, planName: string) => {
    if (!accessToken) {
      goToLogin(navigate);
      return;
    }
    setSelectedPlan(planId);
    setSelectedPlanName(planName);
    setPayStep('choose');
    setShowPayModal(true);
  };

  const startPay = async (method: string) => {
    setPayStep('processing');
    await new Promise((r) => setTimeout(r, 1200));
    try {
      const { data } = await api.post<AuthUser>('/api/subscriptions/purchase', {
        plan: selectedPlan,
        payment_method: method,
      });
      setUser(data);
      setPayStep('done');
      queryClient.invalidateQueries({ queryKey: ['me'] });
      toast.success('Подписка оформлена');
    } catch {
      setPayStep('choose');
      toast.error('Не удалось оформить подписку');
    }
  };

  return (
    <div>
      {payStep === 'done' && <Confetti recycle={false} numberOfPieces={220} />}
      <h1 className="font-display text-3xl font-bold">Подписки</h1>
      <p className="mt-2 max-w-2xl text-[var(--text-secondary)]">
        Одновременно действует только один платный план. Чтобы сменить тариф — отмените текущую подписку и оформите другой.
      </p>

      <section
        className="relative mx-auto mt-10 max-w-6xl"
        aria-roledescription="carousel"
        onMouseEnter={() => setCarouselPaused(true)}
        onMouseLeave={() => setCarouselPaused(false)}
      >
        <div
          className="pointer-events-none absolute inset-y-8 left-0 z-20 w-16 bg-gradient-to-r from-[var(--bg-base)] to-transparent max-sm:w-8"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-y-8 right-0 z-20 w-16 bg-gradient-to-l from-[var(--bg-base)] to-transparent max-sm:w-8"
          aria-hidden
        />

        <button
          type="button"
          aria-label="Предыдущий план"
          onClick={goPrev}
          className="absolute left-0 top-1/2 z-30 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-lg transition hover:bg-[var(--bg-surface)] max-sm:h-9 max-sm:w-9"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <button
          type="button"
          aria-label="Следующий план"
          onClick={goNext}
          className="absolute right-0 top-1/2 z-30 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-lg transition hover:bg-[var(--bg-surface)] max-sm:h-9 max-sm:w-9"
        >
          <ChevronRight className="h-6 w-6" />
        </button>

        <div
          className="relative mx-auto min-h-[min(560px,85vh)] w-full overflow-hidden px-12 py-4 max-sm:min-h-[520px] max-sm:px-8"
          style={{
            maskImage: 'linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)',
          }}
        >
          <div className="relative flex h-[min(560px,85vh)] items-center justify-center max-sm:h-[520px]">
            {PLANS.map((plan, i) => {
              const delta = getCircularDelta(i, slideIndex, PLANS.length);
              const abs = Math.abs(delta);
              const isCenter = delta === 0;
              const scale = isCenter ? 1 : abs === 1 ? 0.72 : 0.58;
              const opacity = isCenter ? 1 : abs === 1 ? 0.38 : 0.14;
              const blurPx = isCenter ? 0 : abs === 1 ? 1.2 : 2.4;
              const z = 50 - abs;
              const translateX = delta * STEP_X_PX;
              const isCurrent = getIsCurrent(plan.id);
              const showCancel = isCurrent && plan.id !== 'free' && plan.canBuy;

              return (
                <div
                  key={plan.id}
                  role={isCenter ? undefined : 'button'}
                  tabIndex={isCenter ? undefined : 0}
                  aria-label={isCenter ? `${plan.name}, текущий слайд` : `Показать план ${plan.name}`}
                  aria-current={isCenter ? 'true' : undefined}
                  className={`absolute left-1/2 top-1/2 w-[min(100%,300px)] max-w-[300px] rounded-[22px] border bg-[var(--bg-surface)] text-left shadow-[var(--shadow-card)] transition-[transform,opacity,filter,box-shadow] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base)] ${isCenter ? 'cursor-default' : 'cursor-pointer hover:brightness-[1.06]'}`}
                  style={{
                    transform: `translate(calc(-50% + ${translateX}px), -50%) scale(${scale})`,
                    opacity,
                    zIndex: z,
                    filter: blurPx > 0 ? `blur(${blurPx}px)` : undefined,
                    borderColor: isCenter && isCurrent ? plan.color : 'var(--border)',
                    borderWidth: isCenter && isCurrent ? 2 : 1,
                    boxShadow: isCenter ? '0 24px 48px rgba(0,0,0,0.18)' : undefined,
                  }}
                  onClick={() => {
                    if (!isCenter) setSlideIndex(i);
                  }}
                  onKeyDown={(e) => {
                    if (!isCenter && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      setSlideIndex(i);
                    }
                  }}
                >
                  <div className={`flex flex-col p-6 max-sm:p-5 ${!isCenter ? 'pointer-events-none' : ''}`}>
                    <div className="relative min-h-[24px]">
                      {plan.badge && isCenter ? (
                        <div
                          className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3.5 py-1 text-[11px] font-bold text-white"
                          style={{ background: plan.color }}
                        >
                          {plan.badge}
                        </div>
                      ) : null}
                    </div>

                    <div className={`mt-1 flex items-center gap-2 ${isCenter ? '' : 'scale-90'}`}>
                      <div className="h-2 w-2 shrink-0 rounded-full" style={{ background: plan.color }} />
                      <span className="truncate text-xs font-semibold text-[var(--text-secondary)]">{plan.name}</span>
                    </div>

                    <div className={`mt-3 ${isCenter ? '' : 'mt-2'}`}>
                      <span className={`font-extrabold ${isCenter ? 'text-4xl' : 'text-2xl'}`} style={{ color: plan.color }}>
                        {plan.price}
                      </span>
                      <span className={`ml-1 text-[var(--text-muted)] ${isCenter ? 'text-sm' : 'text-xs'}`}>{plan.period}</span>
                    </div>

                    {isCenter ? (
                      <ul className="mt-5 flex flex-1 list-none flex-col gap-2 p-0">
                        {plan.features.map((f) => (
                          <li key={f} className="flex gap-2 text-sm text-[var(--text-secondary)]">
                            <span className="shrink-0" style={{ color: plan.color }}>
                              ✓
                            </span>
                            {f}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-4 line-clamp-2 text-center text-[11px] text-[var(--text-muted)]">
                        Нажмите, чтобы открыть
                      </p>
                    )}

                    {isCenter ? (
                      <div className="mt-5 flex flex-col gap-2">
                        {isCurrent ? (
                          <>
                            <div className="py-1.5 text-center text-sm font-semibold" style={{ color: plan.color }}>
                              Текущий план
                            </div>
                            {showCancel ? (
                              <div className="relative z-10" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  disabled={cancelMutation.isPending}
                                  onClick={handleCancel}
                                  className="w-full rounded-xl border border-[var(--border)] bg-transparent py-2.5 text-[14px] font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--bg-elevated)] disabled:opacity-50"
                                >
                                  {cancelMutation.isPending ? 'Отмена…' : 'Отменить подписку'}
                                </button>
                              </div>
                            ) : null}
                          </>
                        ) : plan.canBuy ? (
                          <div className="relative z-10" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleBuy(plan.id, plan.name)}
                              className="w-full rounded-xl py-2.5 text-[15px] font-bold text-white transition hover:opacity-95"
                              style={{ background: plan.color }}
                            >
                              Оформить
                            </button>
                          </div>
                        ) : (
                          <div className="py-2 text-center text-sm text-[var(--text-muted)]">Включено при регистрации</div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2" role="tablist" aria-label="Номер плана">
          {PLANS.map((plan, i) => {
            const active = i === slideIndex;
            return (
              <button
                key={plan.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={`План ${i + 1} из ${PLANS.length}: ${plan.name}`}
                onClick={() => setSlideIndex(i)}
                className={`rounded-full transition-all duration-500 ${
                  active ? 'h-2.5 w-8 bg-[var(--primary)] shadow-[0_0_16px_rgba(233,30,140,0.4)]' : 'h-2 w-2 bg-[var(--border)] hover:bg-[var(--text-muted)]'
                }`}
              />
            );
          })}
        </div>

        <p className="mt-3 text-center text-xs text-[var(--text-muted)]">
          {carouselPaused
            ? 'Автопрокрутка на паузе — уберите курсор с карусели'
            : `Листается автоматически каждые ${AUTO_SLIDE_MS / 1000} с`}
        </p>
      </section>

      {showPayModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 12 }}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 20, padding: 32, width: 380, maxWidth: '100%', textAlign: 'center' }}>
            {payStep === 'choose' && (
              <>
                <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Способ оплаты</h3>
                {['Банковская карта', 'СБП', 'Криптовалюта'].map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => startPay(method)}
                    style={{ display: 'block', width: '100%', padding: '14px 20px', marginBottom: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 15, cursor: 'pointer', color: 'var(--text-primary)' }}
                  >
                    {method}
                  </button>
                ))}
                <button type="button" onClick={() => setShowPayModal(false)} style={{ marginTop: 4, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  Отмена
                </button>
              </>
            )}
            {payStep === 'processing' && (
              <>
                <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
                <h3 style={{ fontSize: 18, fontWeight: 600 }}>Обрабатываем платёж...</h3>
                <p style={{ color: 'var(--text-secondary)' }}>Пожалуйста подождите</p>
              </>
            )}
            {payStep === 'done' && (
              <>
                <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
                <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Подписка активирована!</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>Добро пожаловать в {selectedPlanName}!</p>
                <button
                  type="button"
                  onClick={() => {
                    setShowPayModal(false);
                    setPayStep('choose');
                  }}
                  style={{ background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 12, padding: '12px 32px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
                >
                  Отлично!
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
