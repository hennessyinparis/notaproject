import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Flag, Heart, Link2, ListMusic, MessageCircle, MoreHorizontal, Music2, Pause, Play, Repeat, Repeat2, Share2 } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { api } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { goToLogin } from '../../utils/authNavigation';
import { usePlayerStore } from '../../store/playerStore';
import type { Track } from '../../types';
import { stringToGradient } from '../../utils/color';
import { formatDuration, formatNumber } from '../../utils/format';
import { invalidateMyProfileLikes, invalidateMyProfileReposts } from '../../utils/profileEngagementCache';
import { AddToPlaylistModal } from './AddToPlaylistModal';
import { ReportModal } from '../report/ReportModal';

/** Сетка строки «Популярные треки» — шапка в Artist.tsx должна совпадать по колонкам. */
export const TRACK_ROW_GRID_WITH_PLAY_COUNT =
  '40px 48px minmax(0,1fr) minmax(7.25rem,9rem) minmax(6.75rem,8.5rem) minmax(4.25rem,5rem) 36px';

interface TrackRowProps {
  track: Track;
  index: number;
  queue: Track[];
  showAlbum?: boolean;
  /** Показать число прослушиваний (как в топе Spotify) */
  showPlayCount?: boolean;
}

function patchTrackLikeInList(list: Track[] | undefined, trackId: number, liked: boolean): Track[] | undefined {
  if (!list) return list;
  return list.map((t) => (Number(t.id) === Number(trackId) ? { ...t, is_liked: liked } : t));
}

function patchTrackRepostInList(list: Track[] | undefined, trackId: number, reposted: boolean): Track[] | undefined {
  if (!list) return list;
  return list.map((t) => (Number(t.id) === Number(trackId) ? { ...t, is_reposted: reposted } : t));
}

type InfiniteFeed = { pages: Track[][]; pageParams: unknown[] };

function patchLikeAcrossCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  trackId: number,
  liked: boolean
) {
  queryClient.setQueryData<Track[] | undefined>(['library-liked-tracks'], (old) =>
    patchTrackLikeInList(old, trackId, liked)
  );
  queryClient.setQueriesData<Track[] | undefined>({ queryKey: ['user-tracks'] }, (old) =>
    patchTrackLikeInList(old, trackId, liked)
  );
  queryClient.setQueriesData<Track[] | undefined>({ queryKey: ['playlist-tracks'] }, (old) =>
    patchTrackLikeInList(old, trackId, liked)
  );
  queryClient.setQueriesData<Track[] | undefined>({ queryKey: ['tracks'] }, (old) =>
    patchTrackLikeInList(old, trackId, liked)
  );
  queryClient.setQueryData<InfiniteFeed | undefined>(['feed'], (old) => {
    if (!old) return old;
    return {
      ...old,
      pages: old.pages.map((page) => patchTrackLikeInList(page, trackId, liked) ?? page),
    };
  });
}

function patchRepostAcrossCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  trackId: number,
  reposted: boolean
) {
  queryClient.setQueryData<Track[] | undefined>(['library-reposted-tracks'], (old) =>
    patchTrackRepostInList(old, trackId, reposted)
  );
  queryClient.setQueriesData<Track[] | undefined>({ queryKey: ['user-tracks'] }, (old) =>
    patchTrackRepostInList(old, trackId, reposted)
  );
  queryClient.setQueriesData<Track[] | undefined>({ queryKey: ['playlist-tracks'] }, (old) =>
    patchTrackRepostInList(old, trackId, reposted)
  );
  queryClient.setQueriesData<Track[] | undefined>({ queryKey: ['tracks'] }, (old) =>
    patchTrackRepostInList(old, trackId, reposted)
  );
  queryClient.setQueryData<InfiniteFeed | undefined>(['feed'], (old) => {
    if (!old) return old;
    return {
      ...old,
      pages: old.pages.map((page) => patchTrackRepostInList(page, trackId, reposted) ?? page),
    };
  });
}

export function TrackRow({ track, index, queue, showPlayCount = false }: TrackRowProps) {
  const [isLiked, setIsLiked] = useState(() => track.is_liked ?? false);
  const [isReposted, setIsReposted] = useState(() => track.is_reposted ?? false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [searchUser, setSearchUser] = useState('');
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    setIsLiked(track.is_liked ?? false);
    setIsReposted(track.is_reposted ?? false);
  }, [track.id, track.is_liked, track.is_reposted]);

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);
  const currentUser = useAuthStore((s) => s.user);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const repeatMode = usePlayerStore((s) => s.repeat);
  const setRepeat = usePlayerStore((s) => s.setRepeat);
  const trackId = Number(track.id);
  const isCurrentTrack = usePlayerStore((s) => s.currentTrack != null && Number(s.currentTrack.id) === trackId);
  const isPlaying = usePlayerStore(
    (s) => s.isPlaying && s.currentTrack != null && Number(s.currentTrack.id) === trackId
  );

  const base = import.meta.env.VITE_API_URL || '';
  const cover = track.cover_url ? `${base}${track.cover_url}` : null;

  const handlePlay = () => {
    const s = usePlayerStore.getState();
    const isCurrent = s.currentTrack != null && Number(s.currentTrack.id) === trackId;
    if (isCurrent && s.isPlaying) {
      s.toggle();
    } else {
      s.playTrack(track, queue);
    }
  };

  const updateMenuPos = () => {
    const r = moreBtnRef.current?.getBoundingClientRect();
    if (!r) return;
    const w = 200;
    const left = Math.min(Math.max(8, r.right - w), window.innerWidth - w - 8);
    setMenuPos({ top: r.bottom + 6, left });
  };

  useLayoutEffect(() => {
    if (menuOpen) updateMenuPos();
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (ev: MouseEvent) => {
      const t = ev.target as Node;
      if (moreBtnRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setMenuOpen(false);
    };
    const onScroll = () => updateMenuPos();
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [menuOpen]);

  const likeMutation = useMutation({
    mutationFn: async () => {
      if (isLiked) {
        await api.delete(`/api/tracks/${track.id}/like`);
        return false;
      }
      await api.post(`/api/tracks/${track.id}/like`);
      return true;
    },
    onSuccess: async (liked) => {
      setIsLiked(liked);
      patchLikeAcrossCaches(queryClient, track.id, liked);
      await queryClient.invalidateQueries({ queryKey: ['track', String(track.id)] });
      await queryClient.invalidateQueries({ queryKey: ['library-liked-tracks'] });
      await queryClient.invalidateQueries({ queryKey: ['user-tracks'] });
      await queryClient.invalidateQueries({ queryKey: ['feed'] });
      invalidateMyProfileLikes(queryClient, useAuthStore.getState().user?.username);
      void queryClient.invalidateQueries({ queryKey: ['user-liked-tracks'] });
      void queryClient.invalidateQueries({ queryKey: ['user-artist-stats'] });
    },
    onError: () => toast.error('Ошибка'),
  });

  const repostMutation = useMutation({
    mutationFn: async () => {
      const res = isReposted
        ? await api.delete<{ reposted: boolean; reposts_count?: number }>(`/api/tracks/${track.id}/repost`)
        : await api.post<{ reposted: boolean; reposts_count?: number }>(`/api/tracks/${track.id}/repost`);
      return res.data.reposted;
    },
    onSuccess: async (reposted) => {
      setIsReposted(reposted);
      patchRepostAcrossCaches(queryClient, track.id, reposted);
      await queryClient.invalidateQueries({ queryKey: ['track', String(track.id)] });
      await queryClient.invalidateQueries({ queryKey: ['user-tracks'] });
      await queryClient.invalidateQueries({ queryKey: ['feed'] });
      invalidateMyProfileReposts(queryClient, useAuthStore.getState().user?.username);
      void queryClient.invalidateQueries({ queryKey: ['user-reposted-tracks'] });
      void queryClient.invalidateQueries({ queryKey: ['user-artist-stats'] });
      toast.success(reposted ? 'Трек репостнут' : 'Репост убран');
    },
    onError: () => toast.error('Ошибка'),
  });

  const usersQ = useQuery({
    queryKey: ['track-row-share-users', searchUser],
    queryFn: () =>
      api
        .get<{ users: Array<{ username: string; display_name: string; avatar_url: string | null }> }>(
          `/api/search?q=${encodeURIComponent(searchUser)}`
        )
        .then((r) => r.data.users ?? []),
    enabled: sendOpen && searchUser.trim().length > 1,
  });

  const shareTrackTo = async (usernameTo: string) => {
    await api.post(`/api/messages/${usernameTo}`, { text: '', track_id: track.id });
    toast.success('Трек отправлен');
    setSendOpen(false);
    setSearchUser('');
  };

  const isRepeatOneActive = isCurrentTrack && repeatMode === 'one';

  const iconBtn =
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-[var(--text-muted)] transition hover:border-[var(--border)] hover:bg-[var(--bg-base)] hover:text-[var(--text-primary)]';

  const menuItemCls =
    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-[var(--text-primary)] transition hover:bg-[var(--bg-elevated)]';

  const menuPortal =
    menuOpen &&
    createPortal(
      <div
        ref={menuRef}
        className="fixed z-[200] min-w-[220px] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] py-1.5 shadow-xl ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
        style={{ top: menuPos.top, left: menuPos.left }}
      >
        <Link to={`/track/${track.id}`} className={menuItemCls} onClick={() => setMenuOpen(false)}>
          <Music2 className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
          Страница трека
        </Link>
        <button
          type="button"
          className={menuItemCls}
          onClick={() => {
            if (!accessToken) {
              goToLogin(navigate);
              setMenuOpen(false);
              return;
            }
            setMenuOpen(false);
            setPlaylistOpen(true);
          }}
        >
          <ListMusic className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
          В плейлист
        </button>
        <button
          type="button"
          className={menuItemCls}
          onClick={() => {
            if (!accessToken) {
              goToLogin(navigate);
              setMenuOpen(false);
              return;
            }
            setMenuOpen(false);
            setSendOpen(true);
          }}
        >
          <MessageCircle className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
          Отправить…
        </button>
        <button
          type="button"
          className={menuItemCls}
          onClick={() => {
            void navigator.clipboard.writeText(`${window.location.origin}/track/${track.id}`);
            toast.success('Ссылка скопирована');
            setMenuOpen(false);
          }}
        >
          <Link2 className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
          Копировать ссылку
        </button>
        {accessToken && !currentUser?.is_admin ? (
          <button
            type="button"
            className={menuItemCls}
            onClick={() => { setMenuOpen(false); setReportOpen(true); }}
          >
            <Flag className="h-4 w-4 shrink-0 text-red-400" aria-hidden />
            Пожаловаться
          </button>
        ) : null}
      </div>,
      document.body
    );

  const sendPortal =
    sendOpen &&
    createPortal(
      <div
        className="fixed inset-0 z-[240] flex items-center justify-center bg-black/45 p-4"
        role="presentation"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
            setSendOpen(false);
            setSearchUser('');
          }
        }}
      >
        <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-card)]">
          <h3 className="m-0 text-base font-semibold text-[var(--text-primary)]">Отправить трек</h3>
          <input
            className="mt-3 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary)]"
            placeholder="Найти пользователя…"
            value={searchUser}
            onChange={(e) => setSearchUser(e.target.value)}
          />
          <div className="mt-3 max-h-60 space-y-2 overflow-y-auto">
            {usersQ.data?.map((u) => (
              <button
                key={u.username}
                type="button"
                className="flex w-full items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-left text-sm text-[var(--text-primary)] transition hover:bg-[var(--bg-base)]"
                onClick={() => shareTrackTo(u.username)}
              >
                <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[var(--bg-surface)]">
                  {u.avatar_url ? (
                    <img
                      src={u.avatar_url.startsWith('http') ? u.avatar_url : `${base}${u.avatar_url}`}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <span className="min-w-0 truncate font-medium">{u.display_name}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="mt-3 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            onClick={() => {
              setSendOpen(false);
              setSearchUser('');
            }}
          >
            Закрыть
          </button>
        </div>
      </div>,
      document.body
    );

  return (
    <>
      <AddToPlaylistModal trackId={track.id} open={playlistOpen} onClose={() => setPlaylistOpen(false)} />
      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} reportType="track" targetId={Number(track.id)} targetLabel={track.title} />
      {menuPortal}
      {sendPortal}
      <div
        className="track-row group grid cursor-pointer items-center gap-2 rounded-xl border border-transparent px-2 py-1.5 transition-colors hover:border-[var(--border)] hover:bg-[var(--bg-elevated)] sm:gap-3 sm:px-3"
        style={{
          gridTemplateColumns: showPlayCount
            ? TRACK_ROW_GRID_WITH_PLAY_COUNT
            : '36px 44px minmax(0,1fr) minmax(7rem,8.5rem) minmax(3.25rem,3.75rem) 36px',
        }}
        onClick={handlePlay}
      >
        <div className="text-center text-sm text-[var(--text-muted)]">
          <span className="track-row-num group-hover:hidden">{index + 1}</span>
          <button
            type="button"
            className="track-row-play hidden items-center justify-center group-hover:flex"
            onClick={(e) => {
              e.stopPropagation();
              handlePlay();
            }}
            aria-label={isCurrentTrack && isPlaying ? 'Пауза' : 'Играть'}
          >
            {isCurrentTrack && isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 pl-0.5" />}
          </button>
        </div>

        <Link
          to={`/track/${track.id}`}
          onClick={(e) => e.stopPropagation()}
          className="relative z-[1] block h-10 w-10 shrink-0 overflow-hidden rounded-lg shadow-sm ring-1 ring-black/5 dark:ring-white/10 sm:h-11 sm:w-11 sm:rounded-xl"
          aria-label={`Открыть трек «${track.title}»`}
        >
          {cover ? (
            <img src={cover} alt="" className="h-full w-full object-cover" draggable={false} />
          ) : (
            <div className="h-full w-full" style={{ background: stringToGradient(track.title ?? String(track.id)) }} />
          )}
        </Link>

        <div className="min-w-0">
          <div className="min-h-0">
            <Link
              to={`/track/${track.id}`}
              onClick={(e) => e.stopPropagation()}
              className={`line-clamp-2 text-left text-sm font-semibold leading-snug tracking-tight hover:text-[var(--primary)] sm:text-[15px] ${isCurrentTrack ? 'text-[var(--primary)]' : 'text-[var(--text-primary)]'}`}
            >
              {track.title}
            </Link>
          </div>
          <div className="mt-0.5 truncate text-xs font-medium text-[var(--text-muted)]">
            {track.user ? (
              <Link
                to={`/artist/${track.user.username}`}
                onClick={(e) => e.stopPropagation()}
                className="hover:text-[var(--primary)]"
              >
                {track.user.display_name}
              </Link>
            ) : (
              'Неизвестный артист'
            )}
          </div>
        </div>

        <div className="flex items-center gap-0.5 sm:gap-1" onClick={(e) => e.stopPropagation()}>
          {!currentUser?.is_admin && (
            <button
              type="button"
              className={iconBtn}
              title="Нравится"
              aria-label="Нравится"
              disabled={likeMutation.isPending}
              onClick={() => {
                if (!accessToken) {
                  goToLogin(navigate);
                  return;
                }
                likeMutation.mutate();
              }}
            >
              <Heart
                className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isLiked ? 'fill-[var(--primary)] text-[var(--primary)]' : ''}`}
              />
            </button>
          )}
          <button
            type="button"
            className={`${iconBtn} ${isRepeatOneActive ? 'text-[var(--primary)]' : ''}`}
            title="Повтор трека"
            aria-label="Повтор трека"
            onClick={() => {
              if (!isCurrentTrack) {
                playTrack(track, queue);
                setRepeat('one');
                return;
              }
              setRepeat(repeatMode === 'one' ? 'off' : 'one');
            }}
          >
            <Repeat className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>
          {!currentUser?.is_admin && (
            <button
              type="button"
              className={`${iconBtn} ${isReposted ? 'text-[var(--primary)]' : ''}`}
              title="Репост"
              aria-label="Репост"
              disabled={repostMutation.isPending}
              onClick={() => {
                if (!accessToken) {
                  goToLogin(navigate);
                  return;
                }
                repostMutation.mutate();
              }}
            >
              <Repeat2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>
          )}
          <button
            type="button"
            className={iconBtn}
            title="Копировать ссылку"
            aria-label="Копировать ссылку"
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/track/${track.id}`);
              toast.success('Ссылка скопирована');
            }}
          >
            <Share2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>
        </div>

        {showPlayCount ? (
          <div
            className="pr-1 text-right text-sm font-medium tabular-nums tracking-tight text-[var(--text-primary)] sm:text-[15px]"
            title="Прослушивания"
          >
            {formatNumber(track.plays_count ?? 0)}
          </div>
        ) : null}

        <div
          className="pr-0.5 text-right text-xs tabular-nums text-[var(--text-muted)] sm:text-sm"
          title="Длительность"
        >
          {formatDuration(track.duration_seconds)}
        </div>

        <button
          ref={moreBtnRef}
          type="button"
          className={`${iconBtn} opacity-100 sm:opacity-0 sm:group-hover:opacity-100`}
          aria-label="Ещё"
          aria-expanded={menuOpen}
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((o) => !o);
          }}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
    </>
  );
}
