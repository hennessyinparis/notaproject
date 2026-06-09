export function getErrorMessage(error: unknown, fallback: string): string {
  const err = error as {
    response?: {
      data?: { detail?: string | { msg?: string }[]; message?: string };
    };
    message?: string;
  };
  const detail = err?.response?.data?.detail;
  if (Array.isArray(detail)) {
    const msgs = detail.map((d) => d?.msg).filter(Boolean);
    return msgs.length ? msgs.join('; ') : fallback;
  }
  return detail || err?.response?.data?.message || err?.message || fallback;
}
