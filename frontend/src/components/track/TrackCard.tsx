import { clsx } from 'clsx';
import { Link2, ListMusic, ListPlus, MoreHorizontal, Music2, Pause, Play } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { useAuthStore } from '../../store/authStore';
import { usePlayerStore } from '../../store/playerStore';
import type { Track } from '../../types';
import { goToLogin } from '../../utils/authNavigation';
import { stringToGradient } from '../../utils/color';
import { AddToPlaylistModal } from './AddToPlaylistModal';

interface Props {
  track: Track;
  queue?: Track[];
  /** Уменьшенная карточка для полок в профиле */
  size?: 'default' | 'compact';
  onPlay?: (track: Track) => void;
}

const menuItemCls =
  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-[var(--text-primary)] transition hover:bg-[var(--bg-elevated)]';

export function TrackCard({ track, queue, size = 'default', onPlay }: Props) {
  const compact = size === 'compact';
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [menuOpen, setMenuOpen] = useState(false);
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 160 });

  const trackId = Number(track.id);
  const isCurrentTrack = usePlayerStore((s) => s.currentTrack != null && Number(s.currentTrack.id) === trackId);
  const isPlaying = usePlayerStore(
    (s) => s.isPlaying && s.currentTrack != null && Number(s.currentTrack.id) === trackId
  );
  const base = import.meta.env.VITE_API_URL || '';
  const cover = track.cover_url ? `${base}${track.cover_url}` : null;
  const showOverlay = isCurrentTrack && isPlaying;

  const updateMenuPos = () => {
    const r = menuBtnRef.current?.getBoundingClientRect();
    if (!r) return;
    const w = 168;
    const left = Math.min(Math.max(8, r.right - w), window.innerWidth - w - 8);
    setMenuPos({ top: r.bottom + 6, left, width: w });
  };

  useLayoutEffect(() => {
    if (menuOpen) updateMenuPos();
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onScroll = () => updateMenuPos();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuBtnRef.current?.contains(t)) return;
      const drop = document.getElementById(`track-card-menu-${track.id}`);
      if (drop?.contains(t)) return;
      setMenuOpen(false);
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    document.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      document.removeEventListener('mousedown', onDown);
    };
  }, [menuOpen, track.id]);

  const menuContent =
    menuOpen &&
    createPortal(
      <div
        id={`track-card-menu-${track.id}`}
        className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] py-1.5 shadow-xl ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
        style={{
          position: 'fixed',
          top: menuPos.top,
          left: menuPos.left,
          width: Math.max(menuPos.width, 216),
          zIndex: 10000,
        }}
      >
        <Link
          to={`/track/${track.id}`}
          className={menuItemCls}
          onClick={() => setMenuOpen(false)}
        >
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
            usePlayerStore.getState().addToQueue(track);
            setMenuOpen(false);
          }}
        >
          <ListPlus className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
          В очередь
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
      </div>,
      document.body
    );

  return (
    <div className="flex flex-col transition-transform duration-200 hover:-translate-y-0.5">
      <AddToPlaylistModal trackId={track.id} open={playlistOpen} onClose={() => setPlaylistOpen(false)} />
      <div className="group/cover relative">
        <div
          className={clsx(
            'relative aspect-square overflow-hidden shadow-md ring-1 ring-black/5 transition-shadow duration-200 dark:ring-white/10',
            compact ? 'rounded-xl' : 'rounded-2xl',
            'group-hover/cover:shadow-xl',
            isCurrentTrack && 'ring-2 ring-[var(--primary)]'
          )}
          style={{
            background: cover ? undefined : stringToGradient(track.title ?? track.id),
          }}
        >
          <Link
            to={`/track/${track.id}`}
            className="absolute inset-0 z-0 block"
            aria-label={`Открыть трек «${track.title}»`}
          >
            {cover ? (
              <img src={cover} alt="" className="h-full w-full object-cover" draggable={false} />
            ) : (
              <span className="sr-only">{track.title}</span>
            )}
          </Link>

          <div
            className={clsx(
              'pointer-events-none absolute inset-0 z-[1] flex items-center justify-center bg-gradient-to-t from-black/50 via-black/20 to-black/10 transition-opacity duration-200',
              showOverlay ? 'opacity-100' : 'opacity-0 group-hover/cover:opacity-100'
            )}
          >
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const s = usePlayerStore.getState();
                const isCurrent = s.currentTrack != null && Number(s.currentTrack.id) === trackId;
                if (isCurrent && s.isPlaying) {
                  s.toggle();
                } else {
                  s.playTrack(track, queue);
                  onPlay?.(track);
                }
              }}
              className={clsx(
                'pointer-events-auto flex items-center justify-center rounded-full bg-white text-[#1a1a1a] shadow-lg transition hover:scale-105 active:scale-95',
                compact ? 'h-9 w-9' : 'h-11 w-11'
              )}
              aria-label={isCurrentTrack && isPlaying ? 'Пауза' : 'Играть'}
            >
              {isCurrentTrack && isPlaying ? (
                <Pause className={compact ? 'h-4 w-4' : 'h-[18px] w-[18px]'} strokeWidth={2.25} />
              ) : (
                <Play
                  className={clsx(compact ? 'ml-0.5 h-4 w-4' : 'ml-0.5 h-[18px] w-[18px]')}
                  strokeWidth={2.25}
                />
              )}
            </button>
          </div>

          {isCurrentTrack && isPlaying && (
            <div className="pointer-events-none absolute bottom-2 left-2 z-[1] flex items-end gap-0.5 drop-shadow-md">
              <span className="w-[3px] animate-pulse rounded-sm bg-white" style={{ height: 8 }} />
              <span className="w-[3px] animate-pulse rounded-sm bg-white [animation-delay:75ms]" style={{ height: 12 }} />
              <span className="w-[3px] animate-pulse rounded-sm bg-white [animation-delay:150ms]" style={{ height: 6 }} />
            </div>
          )}

          <button
            ref={menuBtnRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!menuOpen) updateMenuPos();
              setMenuOpen((v) => !v);
            }}
            className={clsx(
              'track-card-menu-btn absolute z-[5] flex items-center justify-center rounded-full',
              compact ? 'right-1.5 top-1.5 h-7 w-7' : 'right-2 top-2 h-8 w-8',
              'bg-black/45 text-white backdrop-blur-sm transition-opacity duration-200',
              'opacity-0 group-hover/cover:opacity-100 focus-visible:opacity-100',
              menuOpen && 'opacity-100'
            )}
            aria-label="Меню"
          >
            <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
        {menuContent}
      </div>

      <div className={clsx('min-h-0 space-y-0.5 px-0.5', compact ? 'mt-2' : 'mt-3 space-y-1')}>
        <Link
          to={`/track/${track.id}`}
          className={clsx(
            'line-clamp-2 font-semibold leading-snug tracking-tight transition-colors hover:text-[var(--primary)]',
            compact ? 'text-xs sm:text-[13px]' : 'text-[15px]',
            isCurrentTrack ? 'text-[var(--primary)]' : 'text-[var(--text-primary)]'
          )}
        >
          {track.title}
        </Link>
        {track.user && (
          <Link
            to={`/artist/${track.user.username}`}
            className={clsx(
              'block truncate font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--primary)]',
              compact ? 'text-[10px] sm:text-[11px]' : 'text-xs'
            )}
          >
            {track.user.display_name}
          </Link>
        )}
      </div>
    </div>
  );
}
