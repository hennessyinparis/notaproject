export const PLAN_LABELS: Record<string, string> = {
  listener_plus: 'Нота Plus',
  listener_student: 'Нота Студент',
  artist_pro: 'Артист Pro',
};

export function planLabel(plan: string): string {
  return PLAN_LABELS[plan] ?? plan;
}

export function formatRub(amount: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(amount);
}
