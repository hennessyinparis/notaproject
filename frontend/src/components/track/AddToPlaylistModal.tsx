import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ListMusic, Plus } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

import { api } from '../../api/client';
import { useAuthStore } from '../../store/authStore';

type PlaylistBrief = { id: number; title: string; description?: string | null; cover_url?: string | null };

type Props = {
  trackId: number | null;
  open: boolean;
  onClose: () => void;
};

export function AddToPlaylistModal({ trackId, open, onClose }: Props) {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);
  const base = import.meta.env.VITE_API_URL || '';

  const playlistsQ = useQuery({
    queryKey: ['playlists', 'mine'],
    queryFn: () => api.get<PlaylistBrief[]>('/api/playlists/mine').then((r) => r.data),
    enabled: open && !!accessToken && trackId != null,
  });

  const addM = useMutation({
    mutationFn: (playlistId: number) => api.post(`/api/playlists/${playlistId}/tracks/${trackId}`),
    onSuccess: async (_, playlistId) => {
      toast.success('Трек добавлен в плейлист');
      await queryClient.invalidateQueries({ queryKey: ['playlists', 'mine'] });
      await queryClient.invalidateQueries({ queryKey: ['playlist', String(playlistId)] });
      await queryClient.invalidateQueries({ queryKey: ['playlist-tracks', String(playlistId)] });
      onClose();
    },
    onError: () => toast.error('Не удалось добавить в плейлист'),
  });

  if (!open || trackId == null) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[260] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-2xl ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-pl-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[var(--border)] px-5 py-4">
          <h2 id="add-pl-title" className="font-display text-lg font-bold text-[var(--text-primary)]">
            В плейлист
          </h2>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">Выберите плейлист или создайте новый в библиотеке</p>
        </div>
        <div className="max-h-[min(320px,50vh)] overflow-y-auto p-2">
          {playlistsQ.isLoading && <p className="px-3 py-6 text-center text-sm text-[var(--text-muted)]">Загрузка…</p>}
          {!playlistsQ.isLoading && (playlistsQ.data?.length ?? 0) === 0 && (
            <div className="px-3 py-8 text-center">
              <ListMusic className="mx-auto h-10 w-10 text-[var(--text-muted)]" aria-hidden />
              <p className="mt-3 text-sm text-[var(--text-secondary)]">У вас пока нет плейлистов</p>
              <Link
                to="/library"
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95"
                onClick={onClose}
              >
                <Plus className="h-4 w-4" />
                Библиотека
              </Link>
            </div>
          )}
          {playlistsQ.data?.map((p) => {
            const art = p.cover_url ? `${base}${p.cover_url}` : null;
            return (
              <button
                key={p.id}
                type="button"
                disabled={addM.isPending}
                onClick={() => addM.mutate(p.id)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-[var(--bg-elevated)] disabled:opacity-50"
              >
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-elevated)] ring-1 ring-black/5 dark:ring-white/10">
                  {art ? (
                    <img src={art} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[var(--text-muted)]">
                      <ListMusic className="h-5 w-5" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-[var(--text-primary)]">{p.title}</p>
                  {p.description ? (
                    <p className="truncate text-xs text-[var(--text-muted)]">{p.description}</p>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
        <div className="border-t border-[var(--border)] px-3 py-2">
          <button
            type="button"
            className="w-full rounded-xl py-2.5 text-sm font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
            onClick={onClose}
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
