/**
 * На каждый запрос подставляем актуальный токен из Zustand или из localStorage (ключ nota-auth),
 * пока persist не подгрузит состояние в память — иначе списки треков без is_liked.
 */
import { api } from './client';
import { useAuthStore } from '../store/authStore';

const PERSIST_KEY = 'nota-auth';

function getAccessToken(): string | null {
  const fromStore = useAuthStore.getState().accessToken;
  if (fromStore) return fromStore;
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { state?: { accessToken?: string | null } };
    return data.state?.accessToken ?? null;
  } catch {
    return null;
  }
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    delete config.headers.Authorization;
  }
  return config;
});
