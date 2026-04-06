import { useQuery } from '@tanstack/react-query';

import { api } from '../api/client';
import { useAuthStore } from '../store/authStore';
import type { AuthUser } from '../types';

/** Профиль по токену; обновляет store. Нужен и для основного сайта, и для зоны /admin вне App. */
export function useMeQuery() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const setUser = useAuthStore((s) => s.setUser);

  return useQuery({
    queryKey: ['me', accessToken],
    queryFn: async () => {
      const { data } = await api.get<AuthUser>('/api/users/me');
      setUser(data);
      return data;
    },
    enabled: !!accessToken,
    retry: false,
  });
}
