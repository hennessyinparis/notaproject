import { ExternalLink, Pause, Play, SkipForward, Volume2, VolumeX, X } from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';

import { usePlayerStore } from '../../store/playerStore';
import { formatDuration } from '../../utils/format';

type Props = {
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
};

export function AdPlayerBar({ fullscreen, onToggleFullscreen }: Props) {
  const currentAd = usePlayerStore((s) => s.currentAd);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const toggle = usePlayerStore((s) => s.toggle);
  const skipAd = usePlayerStore((s) => s.skipAd);
  const seek = usePlayerStore((s) => s.seek);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const toggleMute = usePlayerStore((s) => s.toggleMute);
  const stop = usePlayerStore((s) => s.stop);

  useEffect(() => {
    if (!isPlaying || !currentAd) return;
    const id = window.setInterval(() => {
      const h = usePlayerStore.getState().howl;
      if (h?.playing()) {
        usePlayerStore.setState({ position: h.seek() as number });
      }
    }, 200);
    return () => clearInterval(id);
  }, [isPlaying, currentAd?.id]);

  if (!currentAd) return null;

  const base = import.meta.env.VITE_API_URL || '';
  const cover =
    currentAd.image_url && currentAd.image_url.startsWith('http')
      ? currentAd.image_url
      : `${base}${currentAd.image_url || ''}`;
  const dur = duration || currentAd.duration_seconds || 30;
  const progress = dur > 0 ? Math.min(100, (position / dur) * 100) : 0;

  const seekBar = (
    <div className="flex flex-col gap-1">
      <div
        className="group relative h-2 cursor-pointer overflow-hidden rounded-full bg-[var(--bg-elevated)]"
        role="slider"
        aria-valuenow={position}
        aria-valuemax={dur}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = (e.clientX - rect.left) / rect.width;
          seek(ratio * dur);
        }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-[var(--primary)] transition-[width]"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-[var(--text-muted)]">
        <span>{formatDuration(position)}</span>
        <span>{formatDuration(dur)}</span>
      </div>
      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={toggle}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary)] text-white shadow-lg"
          aria-label={isPlaying ? 'Пауза' : 'Играть'}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 pl-0.5" />}
        </button>
        <button
          type="button"
          onClick={() => skipAd(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--primary)]/40"
        >
          Пропустить
          <SkipForward className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  if (fullscreen) {
    return (
      <div className="relative z-[1] flex flex-1 flex-col items-center justify-center gap-6 p-6 text-white">
        <div className="relative">
          <div className="h-56 w-56 overflow-hidden rounded-2xl shadow-2xl ring-2 ring-amber-400/40 md:h-72 md:w-72">
            <img src={cover} alt="" className="h-full w-full object-cover" />
          </div>
          <span className="absolute left-3 top-3 rounded-md bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black">
            Реклама
          </span>
        </div>
        <div className="max-w-lg text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-amber-300/90">Реклама</p>
          <h2 className="mt-2 font-display text-2xl font-bold">{currentAd.title}</h2>
          <p className="mt-2 text-sm text-white/65">
            <Link to="/subscriptions" className="font-semibold text-white underline">
              Нота Plus
            </Link>{' '}
            — без рекламы между треками
          </p>
          <a
            href={currentAd.link}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-5 py-2.5 text-sm font-semibold backdrop-blur hover:bg-white/25"
          >
            Подробнее
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
        <div className="w-full max-w-xl px-4 text-[var(--text-primary)] [&_button]:text-white [&_span]:text-white/70">
          {seekBar}
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-amber-500/25 bg-gradient-to-r from-amber-500/8 via-[var(--bg-base)] to-[var(--bg-base)] backdrop-blur-xl">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-3 px-4 py-2.5 md:grid-cols-[240px_1fr_auto] md:gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl shadow-md ring-2 ring-amber-500/35 md:h-[52px] md:w-[52px]">
            <img src={cover} alt="" className="h-full w-full object-cover" />
            <span className="absolute inset-x-0 bottom-0 bg-amber-500 py-0.5 text-center text-[8px] font-bold uppercase text-black">
              Реклама
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Реклама
            </p>
            <p className="truncate text-[15px] font-semibold text-[var(--text-primary)]">{currentAd.title}</p>
            <a
              href={currentAd.link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-[var(--primary)] hover:underline"
            >
              Подробнее
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
        <div className="md:px-4">{seekBar}</div>
        <div className="flex items-center justify-end gap-2">
          <Link
            to="/subscriptions"
            className="hidden rounded-lg border border-[var(--primary)]/30 bg-[var(--primary-light)] px-2.5 py-1 text-xs font-semibold text-[var(--primary)] sm:inline"
          >
            Без рекламы
          </Link>
          <button type="button" onClick={toggleMute} className="text-[var(--text-muted)]" aria-label="Звук">
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={muted ? 0 : volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-14 accent-[var(--primary)] md:w-20"
          />
          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              Полный экран
            </button>
          )}
          <button
            type="button"
            onClick={stop}
            className="rounded-full p-1.5 text-[var(--text-muted)] hover:text-[var(--error)]"
            aria-label="Остановить"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
