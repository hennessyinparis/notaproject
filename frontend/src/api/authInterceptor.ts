import { useAuthStore } from "../store/authStore";
import { api, setAuthHeader } from "./client";

let isRefreshing = false;
let pendingQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null) {
  for (const p of pendingQueue) {
    if (error) {
      p.reject(error);
    } else {
      p.resolve(token!);
    }
  }
  pendingQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status !== 401 ||
      originalRequest._retry ||
      originalRequest.url?.includes("/auth/refresh")
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    const store = useAuthStore.getState();

    if (!isRefreshing) {
      if (!store.refreshToken) {
        store.logout();
        return Promise.reject(error);
      }
      isRefreshing = true;

      try {
        const refreshRes = await api.post("/api/auth/refresh", { refresh_token: store.refreshToken });

        const newToken = refreshRes.data.access_token;
        store.setAccessToken(newToken);
        store.setRefreshToken(refreshRes.data.refresh_token);
        setAuthHeader(newToken);
        processQueue(null, newToken);
      } catch (err) {
        processQueue(err, null);
        store.logout();
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    } else {
      const newToken = await new Promise<string>((resolve, reject) => {
        pendingQueue.push({ resolve, reject });
      });
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
    }

    return api(originalRequest);
  },
);
