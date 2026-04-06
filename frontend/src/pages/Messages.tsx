import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { ArrowLeft, MessageSquare, Pause, Play, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import { api } from '../api/client';
import type { Track } from '../types';
import { PageShell } from '../components/layout/PageShell';
import { usePlayerStore } from '../store/playerStore';
import { formatDuration } from '../utils/format';

type Conversation = {
  user: { id: number; username: string; display_name: string; avatar_url: string | null };
  last_message: string;
  last_time: string;
  unread_count: number;
};

type Message = {
  id: number;
  sender_id: number;
  text: string;
  track_id?: number | null;
  track?: { id: number; title: string; cover_url: string | null; duration_seconds: number } | null;
  is_read: boolean;
  created_at: string;
  is_mine: boolean;
};

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

/** На случай старых превью с префиксом из эмодзи */
function normalizeConversationPreview(raw: string): string {
  const s = raw
    .replace(/^\s*[\u{1F3B5}\u{1F3B6}\u{1F3A7}]\s+/u, '')
    .trim();
  return s || raw.trim();
}

function useNarrowLayout(breakpointPx = 639) {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpointPx}px)`);
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [breakpointPx]);
  return narrow;
}

function Avatar({ user, size = 40 }: { user: { display_name: string; avatar_url?: string | null }; size?: number }) {
  const base = import.meta.env.VITE_API_URL || '';
  const src = user.avatar_url?.startsWith('http') ? user.avatar_url : user.avatar_url ? `${base}${user.avatar_url}` : null;
  const initial = user.display_name?.trim()?.[0]?.toUpperCase() ?? '?';
  return (
    <div
      className="shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-[var(--primary-light)] to-[var(--bg-elevated)] ring-2 ring-[var(--border)]"
      style={{ width: size, height: size }}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-sm font-bold text-[var(--primary)]">{initial}</span>
      )}
    </div>
  );
}

function MessageTrackEmbed({ track: t, isMine }: { track: NonNullable<Message['track']>; isMine: boolean }) {
  const playTrack = usePlayerStore((s) => s.playTrack);
  const toggle = usePlayerStore((s) => s.toggle);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isCurrent = currentTrack != null && Number(currentTrack.id) === Number(t.id);
  const base = import.meta.env.VITE_API_URL || '';
  const cover = t.cover_url ? `${base}${t.cover_url}` : null;

  const loadFullAndPlay = useMutation({
    mutationFn: () => api.get<Track>(`/api/tracks/${t.id}`).then((r) => r.data),
    onSuccess: (full) => {
      playTrack(full, [full]);
    },
    onError: () => toast.error('Не удалось загрузить трек'),
  });

  return (
    <div
      className={clsx(
        'flex min-w-0 max-w-full items-center gap-3 rounded-xl border p-2.5',
        isMine
          ? 'border-white/25 bg-white/10'
          : 'border-[var(--border)] bg-[var(--bg-surface)] shadow-sm'
      )}
    >
      <Link
        to={`/track/${t.id}`}
        className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-elevated)]"
        onClick={(e) => e.stopPropagation()}
      >
        {cover ? (
          <img src={cover} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-[var(--primary)]/35" />
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          to={`/track/${t.id}`}
          className={clsx(
            'block truncate font-display text-sm font-semibold tracking-tight no-underline',
            isMine ? 'text-white' : 'text-[var(--text-primary)]'
          )}
        >
          {t.title}
        </Link>
        <p className={clsx('mt-0.5 text-xs', isMine ? 'text-white/75' : 'text-[var(--text-muted)]')}>
          {formatDuration(t.duration_seconds)}
        </p>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (isCurrent) toggle();
          else loadFullAndPlay.mutate();
        }}
        disabled={loadFullAndPlay.isPending}
        className={clsx(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-0 transition disabled:opacity-60',
          isMine ? 'bg-white text-neutral-900' : 'bg-[var(--primary)] text-white'
        )}
        aria-label={isCurrent && isPlaying ? 'Пауза' : 'Играть'}
      >
        {loadFullAndPlay.isPending ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : isCurrent && isPlaying ? (
          <Pause className="h-[18px] w-[18px]" />
        ) : (
          <Play className="ml-0.5 h-[18px] w-[18px]" />
        )}
      </button>
    </div>
  );
}

export function Messages() {
  const { username } = useParams();
  const navigate = useNavigate();
  const [selectedUser, setSelectedUser] = useState<string | null>(username ?? null);
  const narrow = useNarrowLayout(639);

  useEffect(() => {
    setSelectedUser(username ?? null);
  }, [username]);

  const conversationsQ = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.get<Conversation[]>('/api/messages/conversations').then((r) => r.data),
    refetchInterval: 6000,
  });

  const showList = !narrow || !selectedUser;
  const showChat = !narrow || !!selectedUser;

  return (
    <PageShell
      title="Сообщения"
      description="Личные диалоги с артистами и слушателями"
      icon={<MessageSquare className="h-7 w-7 text-[var(--primary)]" strokeWidth={2} aria-hidden />}
    >
      <div
        className={clsx(
          'grid overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--shadow-hover)] ring-1 ring-black/[0.04] dark:ring-white/[0.06]',
          narrow ? 'min-h-[calc(100vh-14rem)] grid-cols-1' : 'min-h-[min(620px,calc(100vh-11rem))] grid-cols-[minmax(0,340px)_1fr]'
        )}
      >
        {showList && (
          <div className="flex min-h-0 min-w-0 flex-col border-[var(--border)] bg-[var(--bg-surface)] shadow-[4px_0_32px_-12px_rgba(0,0,0,0.12)] dark:shadow-[4px_0_32px_-12px_rgba(0,0,0,0.45)] md:border-r">
            <div className="flex h-14 shrink-0 items-center border-b border-[var(--border)] bg-[var(--bg-elevated)] px-4">
              <h2 className="font-display text-sm font-semibold tracking-tight text-[var(--text-primary)]">Диалоги</h2>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {conversationsQ.data?.length === 0 && (
                <p className="px-4 py-12 text-center text-sm leading-relaxed text-[var(--text-muted)]">
                  Нет переписок — откройте профиль артиста и нажмите «Сообщение»
                </p>
              )}
              {conversationsQ.data?.map((conv) => {
                const active = selectedUser === conv.user.username;
                return (
                  <button
                    key={conv.user.id}
                    type="button"
                    onClick={() => {
                      setSelectedUser(conv.user.username);
                      navigate(`/messages/${conv.user.username}`);
                    }}
                    className={clsx(
                      'flex w-full items-center gap-3 border-b border-[var(--border)] px-4 py-3 text-left outline-none transition',
                      active
                        ? 'border-l-4 border-l-[var(--primary)] bg-[var(--primary-light)]'
                        : 'border-l-4 border-l-transparent hover:bg-[var(--bg-base)]'
                    )}
                  >
                    <Avatar user={conv.user} size={48} />
                    <div className="min-w-0 flex-1 py-0.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <span
                          className={clsx(
                            'truncate font-display text-[15px] tracking-tight',
                            conv.unread_count > 0 ? 'font-semibold text-[var(--text-primary)]' : 'font-medium text-[var(--text-primary)]'
                          )}
                        >
                          {conv.user.display_name}
                        </span>
                        <time
                          className="shrink-0 font-sans text-[12px] tabular-nums leading-none text-[var(--text-muted)]"
                          dateTime={conv.last_time}
                        >
                          {formatTime(conv.last_time)}
                        </time>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate font-sans text-[13px] leading-snug text-[var(--text-secondary)]">
                          {normalizeConversationPreview(conv.last_message)}
                        </span>
                        {conv.unread_count > 0 && (
                          <span className="flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-full bg-[var(--primary)] px-1.5 font-sans text-[11px] font-bold text-white">
                            {conv.unread_count > 9 ? '9+' : conv.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {showChat ? (
          selectedUser ? (
            <ChatWindow username={selectedUser} onBack={narrow ? () => setSelectedUser(null) : undefined} />
          ) : (
            <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 bg-[var(--bg-base)] px-6 text-center">
              <div className="rounded-2xl bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-card)] ring-1 ring-[var(--border)]">
                <MessageSquare className="mx-auto h-10 w-10 text-[var(--primary)] opacity-80" />
              </div>
              <p className="max-w-xs text-sm text-[var(--text-secondary)]">Выберите диалог в списке слева, чтобы открыть переписку</p>
            </div>
          )
        ) : null}
      </div>
    </PageShell>
  );
}

function ChatWindow({ username, onBack }: { username: string; onBack?: () => void }) {
  const [text, setText] = useState('');
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messagesQ = useQuery({
    queryKey: ['messages', username],
    queryFn: () => api.get<Message[]>(`/api/messages/${username}`).then((r) => r.data),
    refetchInterval: 4000,
  });

  const recipientQ = useQuery({
    queryKey: ['user', username, 'message-card'],
    queryFn: () => api.get<{ display_name: string; username: string; avatar_url: string | null }>(`/api/users/${username}`).then((r) => r.data),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesQ.data]);

  useEffect(() => {
    api.put(`/api/messages/${username}/read`).catch(() => undefined);
  }, [username, messagesQ.data?.length]);

  const sendMessage = async () => {
    if (!text.trim()) return;
    await api.post(`/api/messages/${username}`, { text });
    setText('');
    queryClient.invalidateQueries({ queryKey: ['messages', username] });
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--bg-base)]">
      <div className="flex h-[60px] shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-surface)] px-3 sm:px-5">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl p-2 text-[var(--text-secondary)] transition hover:bg-[var(--bg-elevated)]"
            aria-label="Назад"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        ) : null}
        <Avatar user={{ display_name: recipientQ.data?.display_name ?? username, avatar_url: recipientQ.data?.avatar_url }} size={44} />
        <Link
          to={`/artist/${username}`}
          className="min-w-0 flex-1 truncate font-display text-lg font-semibold tracking-tight text-[var(--text-primary)] no-underline hover:text-[var(--primary)]"
        >
          {recipientQ.data?.display_name ?? username}
        </Link>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain bg-[var(--bg-base)] px-3 py-4 sm:px-6">
        {messagesQ.data?.map((msg) => (
          <div key={msg.id} className={clsx('flex w-full', msg.is_mine ? 'justify-end' : 'justify-start')}>
            <div
              className={clsx(
                'max-w-[min(92%,420px)] rounded-2xl',
                msg.track ? 'p-3' : 'px-4 py-3',
                msg.is_mine
                  ? 'rounded-br-md bg-[var(--primary)] text-white shadow-[0_8px_28px_-8px_rgba(233,30,140,0.5)]'
                  : 'rounded-bl-md border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-[var(--shadow-card)]'
              )}
            >
              {msg.track && <MessageTrackEmbed track={msg.track} isMine={msg.is_mine} />}
              {msg.text ? (
                <div
                  className={clsx(
                    'whitespace-pre-wrap break-words font-sans text-[15px] leading-[1.55] antialiased',
                    msg.track && 'mt-2',
                    msg.is_mine ? 'text-white' : 'text-[var(--text-primary)]'
                  )}
                >
                  {msg.text}
                </div>
              ) : null}
              <div
                className={clsx(
                  'mt-2 text-right font-sans text-[11px] tabular-nums',
                  msg.is_mine ? 'text-white/75' : 'text-[var(--text-muted)]'
                )}
              >
                {formatTime(msg.created_at)}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-[var(--border)] bg-[var(--bg-surface)]/95 p-3 backdrop-blur-md sm:p-4">
        <div className="mx-auto flex max-w-3xl items-end gap-3">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), void sendMessage())}
            placeholder="Написать сообщение…"
            className="min-h-[48px] flex-1 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 font-sans text-[15px] leading-normal text-[var(--text-primary)] placeholder:font-normal placeholder:text-[var(--text-muted)] shadow-inner focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
          />
          <button
            type="button"
            onClick={() => void sendMessage()}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary)] text-white shadow-[0_6px_20px_-4px_rgba(233,30,140,0.5)] transition hover:brightness-105"
            aria-label="Отправить"
          >
            <Send className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
