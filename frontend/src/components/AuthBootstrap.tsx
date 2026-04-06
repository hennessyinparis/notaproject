import { useEffect } from 'react';

import { setAuthHeader } from '../api/client';
import { useMeQuery } from '../hooks/useMeQuery';
import { useAuthStore } from '../store/authStore';

/**
 * Синхронизация Authorization и загрузка /me при любом маршруте (включая /admin без App).
 */
export function AuthBootstrap() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);
  const meQ = useMeQuery();

  useEffect(() => {
    setAuthHeader(accessToken);
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    if (!meQ.isError) return;
    setTokens(null, null);
    setUser(null);
  }, [accessToken, meQ.isError, setTokens, setUser]);

  return null;
}
