import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuthStore } from '../../store/authStore';
import { isArtistPro } from '../../utils/subscription';

function useAuthHydrated() {
  const [ok, setOk] = useState(() => useAuthStore.persist.hasHydrated());
  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) setOk(true);
    return useAuthStore.persist.onFinishHydration(() => setOk(true));
  }, []);
  return ok;
}

export function PrivateRoute({ children }: { children: React.ReactNode }) {
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.accessToken);
  const loc = useLocation();

  if (!hydrated) {
    return <div className="py-16 text-center text-sm text-[var(--text-muted)]">Загрузка…</div>;
  }

  if (!token) {
    return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  }

  return <>{children}</>;
}

export function ProRoute({ children }: { children: React.ReactNode }) {
  const hydrated = useAuthHydrated();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const loc = useLocation();

  if (!hydrated) {
    return <div className="py-16 text-center text-sm text-[var(--text-muted)]">Загрузка…</div>;
  }

  if (!accessToken) {
    return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  }

  if (!isArtistPro(user)) return <Navigate to="/studio" replace />;
  return <>{children}</>;
}
