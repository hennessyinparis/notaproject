import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Flag, Heart, MessageSquare, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { useState } from 'react';

import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';

import { ReportModal } from '../report/ReportModal';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { goToLogin } from '../../utils/authNavigation';
import { usePlayerStore } from '../../store/playerStore';

interface Comment {
  id: number;
  user_id: number;
  track_id: number;
  text: string;
  timestamp_seconds: number;
  likes_count: number;
  created_at: string;
  author_username: string | null;
  author_display: string | null;
  author_avatar: string | null;
  is_liked: boolean;
}

function avatarUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (raw.startsWith('http')) return raw;
  const base = import.meta.env.VITE_API_URL || '';
  return `${base}${raw}`;
}

export function Comments({ trackId }: { trackId: number }) {
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const me = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [newText, setNewText] = useState('');
  const [newTimestamp, setNewTimestamp] = useState<number>(0);
  const [replyToId, setReplyToId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [reportCommentId, setReportCommentId] = useState<number | null>(null);

  const { data: comments, isLoading } = useQuery({
    queryKey: ['comments', trackId],
    queryFn: () => api.get<Comment[]>(`/api/comments/track/${trackId}`).then((r) => r.data),
  });

  const likeMutation = useMutation({
    mutationFn: async ({ commentId, isLiked }: { commentId: number; isLiked: boolean }) => {
      if (isLiked) await api.delete(`/api/comments/${commentId}/like`);
      else await api.post(`/api/comments/${commentId}/like`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', trackId] });
    },
    onError: () => toast.error('Ошибка'),
  });
  const deleteMutation = useMutation({
    mutationFn: async (commentId: number) => {
      await api.delete(`/api/comments/${commentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', trackId] });
      toast.success('Комментарий удалён');
    },
    onError: () => toast.error('Не удалось удалить комментарий'),
  });

  const position = usePlayerStore((s) => s.position);

  const addMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/api/comments/track/${trackId}`, { text: newText, timestamp_seconds: newTimestamp });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', trackId] });
      setNewText('');
      setNewTimestamp(0);
      toast.success('Комментарий добавлен');
    },
    onError: () => toast.error('Не удалось добавить комментарий'),
  });

  const replyMutation = useMutation({
    mutationFn: async ({ parentId, text }: { parentId: number; text: string }) => {
      await api.post(`/api/comments/track/${trackId}`, { text, parent_id: parentId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', trackId] });
      setReplyToId(null);
      setReplyText('');
      toast.success('Ответ добавлен');
    },
    onError: () => toast.error('Не удалось добавить ответ'),
  });

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  if (isLoading) return <div className="text-sm text-[var(--text-muted)]">Загрузка...</div>;

  return (
    <div className="space-y-4">
      {comments?.length ? null : <div className="text-sm text-[var(--text-muted)]">Комментариев пока нет</div>}
      {(comments ?? []).map((comment) => {
        const av = avatarUrl(comment.author_avatar);
        return (
        <div key={comment.id} className="flex gap-3">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[var(--bg-elevated)] ring-1 ring-black/5 dark:ring-white/10">
            {av ? (
              <img src={av} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[var(--primary-light)] text-sm font-bold text-[var(--primary)]">
                {comment.author_display?.[0] || comment.author_username?.[0] || '?'}
              </div>
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Link to={`/artist/${comment.author_username ?? ''}`} className="text-sm font-semibold hover:underline">
                {comment.author_display || comment.author_username}
              </Link>
              <span className="text-xs text-[var(--text-muted)]">
                {new Date(comment.created_at).toLocaleDateString()}
              </span>
              {comment.timestamp_seconds > 0 && (
                <span className="text-xs text-[var(--primary)] font-mono">
                  {formatTime(comment.timestamp_seconds)}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{comment.text}</p>
            <div className="flex items-center gap-3 mt-1">
              <button
                type="button"
                onClick={() => setReplyToId(comment.id)}
                className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--primary)]"
              >
                <MessageSquare className="h-3 w-3" />
                Ответить
              </button>
            <button
              type="button"
              onClick={() => {
                if (!accessToken) {
                  goToLogin(navigate);
                  return;
                }
                likeMutation.mutate({ commentId: comment.id, isLiked: comment.is_liked });
              }}
              className="mt-1 flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--primary)]"
            >
              <Heart className={`h-3 w-3 ${comment.is_liked ? 'fill-current text-[var(--primary)]' : ''}`} />
              {comment.likes_count}
            </button>
            {me && me.id === comment.user_id && (
              <button
                type="button"
                onClick={() => deleteMutation.mutate(comment.id)}
                className="ml-3 mt-1 text-xs text-[var(--error)] hover:underline"
              >
                Удалить
              </button>
            )}
              {accessToken && me && !me.is_admin && (
              <button
                type="button"
                onClick={() => setReportCommentId(comment.id)}
                className="text-xs text-[var(--text-muted)] hover:text-red-400"
                title="Пожаловаться"
              >
                <Flag className="h-3 w-3" />
              </button>
            )}
            </div>
            {replyToId === comment.id && (
              <div className="mt-2 flex gap-2">
                <input
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Ответить..."
                  className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
                <button
                  type="button"
                  disabled={!replyText.trim() || replyMutation.isPending}
                  onClick={() => replyMutation.mutate({ parentId: comment.id, text: replyText })}
                  className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Ответить
                </button>
              </div>
            )}
          </div>
        </div>
        );
      })}
      <ReportModal open={reportCommentId !== null} onClose={() => setReportCommentId(null)} reportType="comment" targetId={reportCommentId ?? 0} />
      {accessToken ? (
        <div className="pt-2">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="Напишите комментарий..."
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 pr-20 text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
              <button
                type="button"
                onClick={() => setNewTimestamp(position > 0 ? Math.round(position) : 0)}
                className={`absolute right-1 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-medium transition ${newTimestamp > 0 ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--primary)]'}`}
                title={newTimestamp > 0 ? `Таймкод: ${formatTime(newTimestamp)}` : 'Добавить таймкод'}
              >
                <Clock className="h-3 w-3 inline mr-1" />
                {newTimestamp > 0 ? formatTime(newTimestamp) : 'Время'}
              </button>
            </div>
            <button
              type="button"
              disabled={!newText.trim() || addMutation.isPending}
              onClick={() => addMutation.mutate()}
              className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Отправить
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => goToLogin(navigate)}
          className="text-sm text-[var(--primary)] hover:underline"
        >
          Войдите, чтобы написать комментарий
        </button>
      )}
    </div>
  );
}
