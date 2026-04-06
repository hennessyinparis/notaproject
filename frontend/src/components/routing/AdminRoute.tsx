import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

import { useMeQuery } from '../../hooks/useMeQuery';
import { useAuthStore } from '../../store/authStore';

export function AdminRoute({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.accessToken);
  const location = useLocation();
  const meQ = useMeQuery();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (meQ.isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[var(--bg-base)] text-[var(--text-secondary)]">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--primary)]"
          aria-hidden
        />
        <p className="text-sm">Загрузка профиля…</p>
      </div>
    );
  }

  if (meQ.isError || !meQ.data) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!meQ.data.is_admin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
