import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';

import { useAuthStore } from '../../store/authStore';

export function AdminRoute({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.accessToken);

  if (!token) return <Navigate to="/login" replace />;
  if (!user?.is_admin) return <Navigate to="/" replace />;
  return <>{children}</>;
}
