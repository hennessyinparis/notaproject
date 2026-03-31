import { motion, AnimatePresence } from 'framer-motion';
import {
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
  ListMusic,
  SlidersHorizontal,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { RATES, usePlayerStore } from '../../store/playerStore';
import { useEqStore } from '../../store/eqStore';
import { formatDuration } from '../../utils/format';
import { Equalizer } from './Equalizer';
import { Waveform } from './Waveform';

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  return `linear-gradient(135deg, hsl(${hue}, 70%, 50%), hsl(${(hue + 40) % 360}, 80%, 30%))`;
}

export function GlobalPlayer() {
  const {
    currentTrack,
    isPlaying,
    volume,
    muted,
    rate,
    repeat,
    shuffle,
    position,
    duration,
    fullscreen,
    toggle,
    next,
    prev,
    seek,
    setVolume,
    toggleMute,
    setRate,
    setRepeat,
    toggleShuffle,
    setFullscreen,
    queue,
    stop,
  } = usePlayerStore();

  const eqEnabled = useEqStore((s) => s.enabled);
  const [showQueue, setShowQueue] = useState(false);
  const [showEq, setShowEq] = useState(false);

  useEffect(() => {
    if (!isPlaying) return;
    const updatePosition = () => {
      const h = usePlayerStore.getState().howl;
      if (h?.playing()) {
        usePlayerStore.setState({ position: h.seek() as number });
      }
    };
    const id = window.setInterval(updatePosition, 50);
    return () => clearInterval(id);
  }, [isPlaying, currentTrack?.id]);

  if (!currentTrack) return null;

  const cycleRepeat = () => {
    const order: Array<'off' | 'one' | 'all'> = ['off', 'all', 'one'];
    const i = order.indexOf(repeat);
    setRepeat(order[(i + 1) % order.length]);
  };

  const base = import.meta.env.VITE_API_URL || '';
  const cover = currentTrack.cover_url ? `${base}${currentTrack.cover_url}` : null;
  const dur = duration || currentTrack.duration_seconds;

  const controls = (
    <>
      <Waveform
        peaks={currentTrack.waveform_data?.peaks}
        duration={dur}
        position={position}
        onSeek={seek}
        height={fullscreen ? 72 : 40}
      />
      <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
        <span>{formatDuration(position)}</span>
        <span>{formatDuration(dur)}</span>
      </div>
      <div className="flex items-center justify-center gap-3 md:gap-4">
        <button
          type="button"
          onClick={toggleShuffle}
          className={`rounded-full p-1.5 transition-colors ${shuffle ? 'text-[var(--primary)] bg-[var(--primary-light)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
          aria-label="Перемешать"
        >
          <Shuffle className="h-4 w-4" />
        </button>
        <button type="button" onClick={prev} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]" aria-label="Предыдущий">
          <SkipBack className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={toggle}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary)] text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
          aria-label={isPlaying ? 'Пауза' : 'Играть'}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 pl-0.5" />}
        </button>
        <button type="button" onClick={next} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]" aria-label="Следующий">
          <SkipForward className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={cycleRepeat}
          className={`rounded-full p-1.5 transition-colors ${repeat !== 'off' ? 'text-[var(--primary)] bg-[var(--primary-light)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
          aria-label="Повтор"
        >
          <Repeat className={`h-4 w-4 ${repeat === 'one' ? 'text-[var(--primary)]' : ''}`} />
        </button>
      </div>
    </>
  );

  const bar = (
    <motion.div
      layout
      className="border-t border-[var(--border)] bg-[var(--bg-base)]/98 backdrop-blur-xl"
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-2 md:flex-row md:items-center md:gap-0">
        <div className="flex min-w-0 flex-[0_0_180px] items-center gap-2 md:flex-[0_0_240px]">
          <motion.div
            animate={{ scale: isPlaying ? [1, 1.02, 1] : 1 }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="h-10 w-10 shrink-0 overflow-hidden rounded-lg shadow-md md:h-12 md:w-12"
          >
            {cover ? (
              <img src={cover} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full" style={{ background: stringToColor(currentTrack.title) }} />
            )}
          </motion.div>
          <div className="min-w-0">
            <Link
              to={`/track/${currentTrack.id}`}
              className="block truncate text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--primary)]"
            >
              {currentTrack.title}
            </Link>
            <Link
              to={`/artist/${currentTrack.user?.username}`}
              className="block truncate text-xs text-[var(--text-secondary)] hover:text-[var(--primary)]"
            >
              {currentTrack.user?.display_name ?? 'Артист'}
            </Link>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-0.5 md:px-6">{controls}</div>

        <div className="flex flex-[0_0_auto] items-center justify-end gap-2 md:gap-3">
          <select
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-1.5 py-1 text-xs text-[var(--text-primary)] md:px-2"
            aria-label="Скорость"
          >
            {RATES.map((r) => (
              <option key={r} value={r}>
                {r}x
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <button type="button" onClick={toggleMute} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]" aria-label="Звук">
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
              aria-label="Громкость"
            />
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowEq(!showEq)}
              className={`rounded-full p-1.5 transition-colors ${showEq || eqEnabled ? 'bg-[var(--primary-light)] text-[var(--primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
              aria-label="Эквалайзер"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
            <AnimatePresence>{showEq && <Equalizer onClose={() => setShowEq(false)} />}</AnimatePresence>
          </div>
          <button
            type="button"
            onClick={() => setShowQueue(!showQueue)}
            className={`rounded-full p-1.5 transition-colors ${showQueue ? 'bg-[var(--primary-light)] text-[var(--primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
            aria-label="Очередь"
          >
            <ListMusic className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setFullscreen(!fullscreen)}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            aria-label="Полный экран"
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={stop}
            className="rounded-full p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--error)]"
            aria-label="Остановить"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showQueue && queue.length > 0 && (
        <div className="border-t border-[var(--border)] px-3 py-2">
          <p className="mb-2 text-xs font-medium text-[var(--text-muted)]">Очередь ({queue.length})</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {queue.map((t, i) => (
              <div
                key={t.id}
                className={`shrink-0 cursor-pointer rounded-lg p-2 ${i === usePlayerStore.getState().currentIndex ? 'bg-[var(--primary-light)]' : 'bg-[var(--bg-elevated)]'}`}
                onClick={() => usePlayerStore.getState().playTrack(t, queue)}
              >
                <div className="h-8 w-8 overflow-hidden rounded">
                  {t.cover_url ? (
                    <img src={`${base}${t.cover_url}`} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full" style={{ background: stringToColor(t.title) }} />
                  )}
                </div>
                <p className="mt-1 truncate text-[10px]">{t.title}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{
            backgroundImage: cover ? `url(${cover})` : undefined,
            // Меньше размытия, чтобы фон не «съедал» контраст и текст.
            filter: 'blur(36px)',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80" />
        <button
          type="button"
          className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-3 text-white/80 backdrop-blur transition-colors hover:bg-white/20 hover:text-white"
          onClick={() => setFullscreen(false)}
          aria-label="Закрыть"
        >
          <X className="h-6 w-6" />
        </button>
        <div className="relative z-[1] flex flex-1 flex-col items-center justify-center gap-6 p-6 text-white md:gap-8">
          <motion.div
            animate={{ scale: isPlaying ? [1, 1.01, 1] : 1 }}
            transition={{ repeat: Infinity, duration: 3 }}
            className="h-56 w-56 overflow-hidden rounded-2xl shadow-2xl md:h-72 md:w-72"
          >
            {cover ? (
              <img src={cover} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full" style={{ background: stringToColor(currentTrack.title) }} />
            )}
          </motion.div>
          <div className="text-center">
            <h2 className="font-display text-2xl font-bold md:text-3xl">{currentTrack.title}</h2>
            <p className="mt-1 text-white/60">{currentTrack.user?.display_name}</p>
          </div>
          <div className="w-full max-w-2xl px-4">{controls}</div>
        </div>
      </div>
    );
  }

  return <div className="fixed bottom-0 left-0 right-0 z-50">{bar}</div>;
}
