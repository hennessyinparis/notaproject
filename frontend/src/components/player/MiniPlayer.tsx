import { usePlayerStore } from '../../store/playerStore';
import { Music } from 'lucide-react';

/**
 * Mini Player — компактная версия плеера для показа при скролле.
 * Появляется когда плеер активен, но пользователь проскроллил далеко вниз.
 */
export function MiniPlayer() {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const toggle = usePlayerStore((s) => s.toggle);
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);

  if (!currentTrack) return null;

  const progress = duration > 0 ? (position / duration) * 100 : 0;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 cursor-pointer 
                 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] 
                 px-4 py-2 shadow-lg backdrop-blur-xl 
                 transition-all duration-300 hover:scale-105 
                 md:bottom-4"
    >
      <div className="flex items-center gap-3">
        {currentTrack.cover_url ? (
          <img
            src={currentTrack.cover_url}
            alt=""
            className="h-8 w-8 rounded-md object-cover"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--primary-light)]">
            <Music className="h-4 w-4 text-[var(--primary)]" />
          </div>
        )}
        <div className="max-w-[120px]">
          <p className="truncate text-sm font-medium">{currentTrack.title}</p>
          <p className="truncate text-xs text-[var(--text-muted)]">
            {currentTrack.user?.display_name || 'Артист'}
          </p>
        </div>
        <div className="h-6 w-px bg-[var(--border)]" />
        <span className="min-w-[40px] text-xs text-[var(--text-muted)]">
          {formatTime(position)}
        </span>
        <div className="h-1 w-16 overflow-hidden rounded-full bg-[var(--bg-base)]">
          <div
            className="h-full rounded-full bg-[var(--primary)] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
          className="flex h-8 w-8 items-center justify-center rounded-full 
                     bg-[var(--primary)] text-white transition-transform 
                     active:scale-95"
        >
          {isPlaying ? (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg className="ml-0.5 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
