import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { useAuthStore } from '../store/authStore';

type WsEnvelope =
  | { type: 'notification'; payload: Record<string, unknown> }
  | { type: 'message'; payload: { peer_username: string; message: Record<string, unknown> } }
  | { type: 'conversations_updated'; payload: Record<string, unknown> };

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
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<number | null>(null);

  useEffect(() => {
    if (!accessToken) {
      wsRef.current?.close();
      wsRef.current = null;
      return;
    }

    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      const url = `${wsBaseUrl()}/api/ws?token=${encodeURIComponent(accessToken)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

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

      ws.onclose = () => {
        if (cancelled) return;
        retryRef.current = window.setTimeout(connect, 3000);
      };

      ws.onerror = () => ws.close();
    };

    connect();

    const ping = window.setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send('ping');
      }
    }, 25_000);

    return () => {
      cancelled = true;
      window.clearInterval(ping);
      if (retryRef.current) window.clearTimeout(retryRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [accessToken, queryClient]);

  return null;
}
