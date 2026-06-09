/** Строка для генерации градиента/цвета обложки — не падает на null/undefined. */
export function safeColorSeed(value: string | null | undefined, fallback = 'nota'): string {
  const s = typeof value === 'string' ? value.trim() : '';
  return s.length > 0 ? s : fallback;
}

export function stringToGradient(str: string | null | undefined): string {
  const s = safeColorSeed(str);
  let hash = 0;
  for (let i = 0; i < s.length; i += 1) {
    hash = s.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `linear-gradient(135deg, hsl(${hue}, 70%, 55%), hsl(${(hue + 42) % 360}, 72%, 38%))`;
}

export function stringToColor(str: string | null | undefined): string {
  const s = safeColorSeed(str);
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = s.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  return `linear-gradient(135deg, hsl(${hue}, 70%, 50%), hsl(${(hue + 40) % 360}, 80%, 30%))`;
}
