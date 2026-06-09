import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { useAuthStore } from '../store/authStore';
import { api, setAuthHeader } from '../api/client';

type WsEnvelope =
  | { type: 'notification'; payload: Record<string, unknown> }
  | { type: 'message'; payload: { peer_username: string; message: Record<string, unknown> } }
  | { type: 'conversations_updated'; payload: Record<string, unknown> };

function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload.exp) return false;
    return Date.now() >= payload.exp * 1000 - 30000; // 30s buffer
  } catch {
    return true;
  }
}

function wsBaseUrl(): string {
  const api = import.meta.env.VITE_API_URL as string | undefined;
  if (api) {
    return api.replace(/^http/i, (m) => (m.toLowerCase() === 'https' ? 'wss' : 'ws'));
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}`;
}

function handleEvent(queryClient: ReturnType<typeof useQueryClient>, event: WsEnvelope) {
  switch (event.type) {
    case 'notification': {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.setQueryData(['notifications', 'unread-count'], (old: number | undefined) => (old ?? 0) + 1);
      break;
    }
    case 'message': {
      const { peer_username, message } = event.payload;
      queryClient.setQueryData(
        ['messages', peer_username],
        (old: Array<{ id: number }> | undefined) => {
          if (!old) return undefined;
          if (old.some((m) => m.id === message.id)) return old;
          return [...old, message as (typeof old)[number]];
        }
      );
      void queryClient.invalidateQueries({ queryKey: ['messages', peer_username] });
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
      void queryClient.invalidateQueries({ queryKey: ['messages', 'conversations', 'unread'] });
      break;
    }
    case 'conversations_updated':
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
      void queryClient.invalidateQueries({ queryKey: ['messages', 'conversations', 'unread'] });
      break;
    default:
      break;
  }
}

/** Единое WebSocket-подключение для уведомлений и чата. */
export function RealtimeBridge() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<number | null>(null);
  const isRefreshingRef = useRef(false);

  useEffect(() => {
    if (!accessToken) {
      wsRef.current?.close();
      wsRef.current = null;
      return;
    }

    let cancelled = false;
    let effectWs: WebSocket | null = null;

    const refreshAndConnect = async () => {
      if (isRefreshingRef.current) return;
      isRefreshingRef.current = true;
      try {
        const res = await api.post('/api/auth/refresh', { refresh_token: refreshToken });
        const newAccess = res.data.access_token;
        const newRefresh = res.data.refresh_token;
        useAuthStore.getState().setAccessToken(newAccess);
        useAuthStore.getState().setRefreshToken(newRefresh);
        setAuthHeader(newAccess);
        // НЕ вызываем connect() здесь — новый effect запустится при смене токена
      } catch {
        useAuthStore.getState().logout();
      } finally {
        isRefreshingRef.current = false;
      }
    };

    const connect = (token: string) => {
      if (cancelled) return;
      const url = `${wsBaseUrl()}/api/ws?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;
      effectWs = ws;

      ws.onmessage = (ev) => {
        const raw = ev.data;
        if (raw === 'pong') return;
        try {
          const data = JSON.parse(String(raw)) as WsEnvelope;
          handleEvent(queryClient, data);
        } catch {
          /* ignore malformed frames */
        }
      };

      ws.onclose = (ev) => {
        if (cancelled) return;
        // 4401 = Unauthorized — пробуем рефреш токена, не бесконечный ретрай
        if (ev.code === 4401 || ev.code === 1008) {
          void refreshAndConnect();
          return;
        }
        // Остальные ошибки — обычный ретрай с задержкой
        retryRef.current = window.setTimeout(() => {
          const currentToken = useAuthStore.getState().accessToken;
          if (currentToken && !isTokenExpired(currentToken)) {
            connect(currentToken);
          } else {
            void refreshAndConnect();
          }
        }, 5000);
      };

      ws.onerror = () => ws.close();
    };

    // Проверяем токен перед подключением
    if (isTokenExpired(accessToken)) {
      void refreshAndConnect();
    } else {
      connect(accessToken);
    }

    const ping = window.setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send('ping');
      }
    }, 25_000);

    return () => {
      cancelled = true;
      window.clearInterval(ping);
      if (retryRef.current) window.clearTimeout(retryRef.current);
      // Закрываем только WebSocket, созданный этим эффектом (не трогаем новый от следующего рендера)
      effectWs?.close();
    };
  }, [accessToken, refreshToken, queryClient]);

  return null;
}
