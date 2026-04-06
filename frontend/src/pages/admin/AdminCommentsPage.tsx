import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';

import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { api } from '../../api/client';
import { Button } from '../../components/common/Button';
import type { AdminCommentRow } from './adminTypes';
import { admCard, admCardPad, admEmpty, admMain, admRow } from './adminStyles';

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function RowSkeleton() {
  return <div className="min-h-[100px] animate-pulse rounded-xl bg-[var(--bg-elevated)]/80" />;
}

export function AdminCommentsPage() {
  const qc = useQueryClient();

  const commentsQ = useQuery({
    queryKey: ['admin-comments'],
    queryFn: () => api.get<AdminCommentRow[]>('/api/admin/comments?limit=100').then((r) => r.data),
  });

  const commentDelM = useMutation({
    mutationFn: (id: number) => api.delete(`/api/admin/comments/${id}`),
    onSuccess: async () => {
      toast.success('Комментарий удалён');
      await qc.invalidateQueries({ queryKey: ['admin-comments'] });
      await qc.invalidateQueries({ queryKey: ['admin-tracks'] });
      await qc.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: () => toast.error('Не удалось удалить комментарий'),
  });

  return (
    <div className={admMain}>
      <AdminPageHeader
        icon={MessageSquare}
        title="Комментарии"
        description="Последние сообщения под треками. Удаление каскадом затрагивает ответы в ветке; счётчик на треке пересчитывается."
      />

      <div className={`${admCard} ${admCardPad}`}>
        <div className="mb-4 flex items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Лента</h3>
          {commentsQ.data != null ? (
            <span className="text-xs font-medium text-[var(--text-muted)]">{commentsQ.data.length} шт.</span>
          ) : null}
        </div>

        {commentsQ.isLoading ? (
          <div className="space-y-3">
            <RowSkeleton />
            <RowSkeleton />
          </div>
        ) : (
          <div className="space-y-3">
            {(commentsQ.data ?? []).map((c) => (
              <div key={c.id} className={`${admRow} items-stretch sm:items-start`}>
                <div className="min-w-0 flex-1 text-sm">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs text-[var(--text-secondary)]">
                    <span className="font-semibold text-[var(--text-primary)]">{c.display_name}</span>
                    <span className="font-mono text-[var(--text-muted)]">@{c.username}</span>
                    <span className="text-[var(--text-muted)]">·</span>
                    <time className="text-[var(--text-muted)]" dateTime={c.created_at}>
                      {formatWhen(c.created_at)}
                    </time>
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Трек: <span className="font-medium text-[var(--text-secondary)]">«{c.track_title}»</span>
                  </p>
                  <p className="mt-3 whitespace-pre-wrap break-words leading-relaxed text-[var(--text-primary)]">
                    {c.text}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="shrink-0 self-start border border-transparent text-[var(--error)] hover:border-[var(--error)]/25 hover:bg-[var(--error)]/10"
                  disabled={commentDelM.isPending}
                  onClick={() => {
                    if (window.confirm('Удалить этот комментарий (и ответы к нему, если есть)?'))
                      commentDelM.mutate(c.id);
                  }}
                >
                  Удалить
                </Button>
              </div>
            ))}
            {!commentsQ.data?.length && (
              <div className={admEmpty}>Комментариев пока нет.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
