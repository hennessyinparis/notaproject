import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import toast from 'react-hot-toast';

import { useNavigate } from 'react-router-dom';

import { api } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { goToLogin } from '../../utils/authNavigation';

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
}

export function Comments({ trackId }: { trackId: number }) {
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  const { data: comments, isLoading } = useQuery({
    queryKey: ['comments', trackId],
    queryFn: () => api.get<Comment[]>(`/api/comments/track/${trackId}`).then((r) => r.data),
  });

  const likeMutation = useMutation({
    mutationFn: async (commentId: number) => {
      await api.post(`/api/comments/${commentId}/like`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', trackId] });
    },
    onError: () => toast.error('Ошибка'),
  });

  if (isLoading) return <div className="text-sm text-[var(--text-muted)]">Загрузка...</div>;

  if (!comments?.length) {
    return <div className="text-sm text-[var(--text-muted)]">Комментариев пока нет</div>;
  }

  return (
    <div className="space-y-4">
      {comments.map((comment) => (
        <div key={comment.id} className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary-light)] text-xs font-bold text-[var(--primary)]">
            {comment.author_display?.[0] || comment.author_username?.[0] || '?'}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{comment.author_display || comment.author_username}</span>
              <span className="text-xs text-[var(--text-muted)]">
                {new Date(comment.created_at).toLocaleDateString()}
              </span>
            </div>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{comment.text}</p>
            <button
              type="button"
              onClick={() => {
                if (!accessToken) {
                  goToLogin(navigate);
                  return;
                }
                likeMutation.mutate(comment.id);
              }}
              className="mt-1 flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--primary)]"
            >
              <Heart className="h-3 w-3" />
              {comment.likes_count}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
