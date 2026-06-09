import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../../api/client';
import type { AudioAd } from '../../types/ad';
import { isFreeListener } from '../../utils/subscription';

import { useAuthStore } from '../../store/authStore';

/** Рекламный блок для бесплатного тарифа. */
export function AdBanner() {
  const user = useAuthStore((s) => s.user);
  const [dismissed, setDismissed] = useState<number | null>(null);
  const base = import.meta.env.VITE_API_URL || '';

  const showAds = isFreeListener(user);

  const adsQ = useQuery({
    queryKey: ['ads'],
    queryFn: () => api.get<AudioAd[]>('/api/ads/').then((r) => r.data),
    enabled: showAds,
    retry: false,
    staleTime: 120_000,
  });

  if (!showAds || !adsQ.data?.length) return null;

  const ad = adsQ.data.find((a) => a.id !== dismissed) ?? adsQ.data[0];
  if (!ad) return null;

  const imgSrc =
    ad.image_url && ad.image_url.startsWith('http') ? ad.image_url : `${base}${ad.image_url || ''}`;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-2">
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-r from-[var(--primary-light)] via-[var(--bg-surface)] to-[var(--bg-surface)] shadow-[var(--shadow-card)] ring-1 ring-black/[0.03] dark:ring-white/[0.05]">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5">
          {ad.image_url ? (
            <div className="h-20 w-full shrink-0 overflow-hidden rounded-xl bg-[var(--bg-elevated)] sm:h-16 sm:w-28">
              <img src={imgSrc} alt="" className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/15 text-[var(--primary)]">
              <Sparkles className="h-7 w-7" aria-hidden />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--primary)]">Реклама</p>
            <p className="mt-0.5 font-display text-base font-semibold text-[var(--text-primary)]">{ad.title}</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Без рекламы —{' '}
              <Link to="/subscriptions" className="font-semibold text-[var(--primary)] hover:underline">
                Нота Plus
              </Link>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={ad.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_16px_-4px_rgba(233,30,140,0.5)] transition hover:brightness-105"
            >
              Подробнее
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <button
              type="button"
              onClick={() => setDismissed(ad.id)}
              className="rounded-full p-2 text-[var(--text-muted)] transition hover:bg-[var(--bg-elevated)]"
              aria-label="Скрыть"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
