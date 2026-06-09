/** Безопасно приводит peaks из API к массиву чисел (иначе Waveform падал с белым экраном). */
export function normalizeWaveformPeaks(peaks: unknown): number[] | undefined {
  if (peaks == null) return undefined;
  if (Array.isArray(peaks)) {
    const nums = peaks.map((p) => Number(p)).filter((n) => Number.isFinite(n));
    return nums.length ? nums : undefined;
  }
  if (typeof peaks === 'string') {
    const trimmed = peaks.trim();
    if (!trimmed) return undefined;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      return normalizeWaveformPeaks(parsed);
    } catch {
      return undefined;
    }
  }
  return undefined;
}
