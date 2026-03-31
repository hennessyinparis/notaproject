import { useQuery } from '@tanstack/react-query';

import { api } from '../api/client';

export function Analytics() {
  const wave = useQuery({
    queryKey: ['analytics', 'wave'],
    queryFn: () => api.get('/api/analytics/wave').then((r) => r.data),
  });

  return (
    <div>
      <h1 className="font-display text-3xl font-bold">Аналитика</h1>
      <div className="mt-8 rounded-card border border-[var(--border)] p-6">
        <h2 className="font-semibold">Волна</h2>
        {wave.data && (
          <p className="mt-2 text-[var(--text-secondary)]">
            Коэффициент: {wave.data.wave_coefficient} · Прогноз: {wave.data.payout_forecast_rub} ₽
          </p>
        )}
      </div>
    </div>
  );
}
