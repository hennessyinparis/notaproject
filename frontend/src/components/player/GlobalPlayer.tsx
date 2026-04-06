import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Repeat,
  Repeat2,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
  ListMusic,
  SlidersHorizontal,
  Heart,
  MessageCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { api } from '../../api/client';
import { RATES, usePlayerStore } from '../../store/playerStore';
import { useEqStore } from '../../store/eqStore';
import { useAuthStore } from '../../store/authStore';
import { goToLogin } from '../../utils/authNavigation';
import { formatDuration } from '../../utils/format';
import { AddToPlaylistModal } from '../track/AddToPlaylistModal';
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [isLiked, setIsLiked] = useState(false);
  const [isReposted, setIsReposted] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [searchUser, setSearchUser] = useState('');

  useEffect(() => {
    if (!currentTrack) {
      setShowSend(false);
      setPlaylistOpen(false);
      setSearchUser('');
      return;
    }
    setIsLiked(currentTrack.is_liked ?? false);
    setIsReposted(currentTrack.is_reposted ?? false);
  }, [currentTrack?.id, currentTrack?.is_liked, currentTrack?.is_reposted]);

  const likeMutation = useMutation({
    mutationFn: async () => {
      const t = usePlayerStore.getState().currentTrack;
      if (!t?.id) throw new Error('no track');
      if (isLiked) {
        await api.delete(`/api/tracks/${t.id}/like`);
        return false;
      }
      await api.post(`/api/tracks/${t.id}/like`);
      return true;
    },
    onSuccess: async (liked) => {
      setIsLiked(liked);
      const id = usePlayerStore.getState().currentTrack?.id;
      if (id) await queryClient.invalidateQueries({ queryKey: ['track', String(id)] });
      await queryClient.invalidateQueries({ queryKey: ['library-liked-tracks'] });
      await queryClient.invalidateQueries({ queryKey: ['feed'] });
      await queryClient.invalidateQueries({ queryKey: ['user-tracks'] });
      toast.success(liked ? 'Лайк добавлен' : 'Лайк убран');
    },
    onError: () => toast.error('Ошибка'),
  });

  const repostMutation = useMutation({
    mutationFn: async () => {
      const t = usePlayerStore.getState().currentTrack;
      if (!t?.id) throw new Error('no track');
      const res = isReposted
        ? await api.delete<{ reposted: boolean }>(`/api/tracks/${t.id}/repost`)
        : await api.post<{ reposted: boolean }>(`/api/tracks/${t.id}/repost`);
      return res.data.reposted;
    },
    onSuccess: async (reposted) => {
      setIsReposted(reposted);
      const id = usePlayerStore.getState().currentTrack?.id;
      if (id) await queryClient.invalidateQueries({ queryKey: ['track', String(id)] });
      await queryClient.invalidateQueries({ queryKey: ['feed'] });
      await queryClient.invalidateQueries({ queryKey: ['user-tracks'] });
      toast.success(reposted ? 'Трек репостнут' : 'Репост убран');
    },
    onError: () => toast.error('Ошибка'),
  });

  const usersQ = useQuery({
    queryKey: ['player-share-users', searchUser],
    queryFn: () =>
      api
        .get<{ users: Array<{ username: string; display_name: string; avatar_url: string | null }> }>(
          `/api/search?q=${encodeURIComponent(searchUser)}`
        )
        .then((r) => r.data.users ?? []),
    enabled: showSend && searchUser.trim().length > 1,
  });

  const shareTrackTo = async (usernameTo: string) => {
    const t = usePlayerStore.getState().currentTrack;
    if (!t?.id) return;
    await api.post(`/api/messages/${usernameTo}`, { text: '', track_id: t.id });
    toast.success('Трек отправлен');
    setShowSend(false);
    setSearchUser('');
  };

  const requireAuth = (fn: () => void) => {
    if (!accessToken) {
      goToLogin(navigate);
      return;
    }
    fn();
  };

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

  const playlistModal = (
    <AddToPlaylistModal
      trackId={currentTrack.id}
      open={playlistOpen}
      onClose={() => setPlaylistOpen(false)}
    />
  );

  const actionIconCls =
    'rounded-lg p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]';

  const cycleRepeat = () => {
    const order: Array<'off' | 'one' | 'all'> = ['off', 'all', 'one'];
    const i = order.indexOf(repeat);
    setRepeat(order[(i + 1) % order.length]);
  };

  const base = import.meta.env.VITE_API_URL || '';
  const cover = currentTrack.cover_url ? `${base}${currentTrack.cover_url}` : null;
  const dur = duration || currentTrack.duration_seconds;

  const sendModal =
    showSend &&
    createPortal(
      <div
        className="fixed inset-0 z-[260] flex items-center justify-center bg-black/45 p-4"
        role="presentation"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
            setShowSend(false);
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
              setShowSend(false);
              setSearchUser('');
            }}
          >
            Закрыть
          </button>
        </div>
      </div>,
      document.body
    );

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
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-3 px-4 py-2.5 md:grid-cols-[240px_1fr_auto] md:gap-4">
        <div className="flex min-w-0 flex-[0_0_180px] items-center gap-3 md:flex-[0_0_260px]">
          <motion.div
            animate={{ scale: isPlaying ? [1, 1.02, 1] : 1 }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="h-11 w-11 shrink-0 overflow-hidden rounded-xl shadow-md ring-1 ring-black/5 dark:ring-white/10 md:h-[52px] md:w-[52px]"
          >
            {cover ? (
              <img src={cover} alt="" className="h-full w-full object-cover" draggable={false} />
            ) : (
              <div className="h-full w-full" style={{ background: stringToColor(currentTrack.title) }} />
            )}
          </motion.div>
          <div className="min-w-0 flex-1">
            <Link
              to={`/track/${currentTrack.id}`}
              className="block truncate text-[15px] font-semibold leading-tight tracking-tight text-[var(--text-primary)] hover:text-[var(--primary)]"
            >
              {currentTrack.title}
            </Link>
            <Link
              to={`/artist/${currentTrack.user?.username}`}
              className="mt-0.5 block truncate text-xs font-medium text-[var(--text-muted)] hover:text-[var(--primary)]"
            >
              {currentTrack.user?.display_name ?? 'Артист'}
            </Link>
            <div className="mt-1 flex items-center gap-0.5">
              <button
                type="button"
                className={actionIconCls}
                aria-label="Нравится"
                disabled={likeMutation.isPending}
                onClick={(e) => {
                  e.preventDefault();
                  requireAuth(() => likeMutation.mutate());
                }}
              >
                <Heart
                  className={`h-4 w-4 ${isLiked ? 'fill-[var(--primary)] text-[var(--primary)]' : ''}`}
                />
              </button>
              <button
                type="button"
                className={`${actionIconCls} ${isReposted ? 'text-[var(--primary)]' : ''}`}
                aria-label="Репост"
                disabled={repostMutation.isPending}
                onClick={(e) => {
                  e.preventDefault();
                  requireAuth(() => repostMutation.mutate());
                }}
              >
                <Repeat2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                className={actionIconCls}
                aria-label="В плейлист"
                onClick={(e) => {
                  e.preventDefault();
                  requireAuth(() => setPlaylistOpen(true));
                }}
              >
                <ListMusic className="h-4 w-4" />
              </button>
              <button
                type="button"
                className={actionIconCls}
                aria-label="Отправить"
                onClick={(e) => {
                  e.preventDefault();
                  requireAuth(() => setShowSend(true));
                }}
              >
                <MessageCircle className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1 md:px-4">{controls}</div>

        <div className="flex flex-[0_0_auto] items-center justify-end gap-2 md:gap-2.5">
          <select
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1 text-xs text-[var(--text-primary)]"
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
      <>
        {playlistModal}
        {sendModal}
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
              <h2 className="mx-auto max-w-xl font-display text-2xl font-bold leading-tight tracking-tight md:text-3xl">
                {currentTrack.title}
              </h2>
              <p className="mt-2 text-sm font-medium text-white/65 md:text-base">{currentTrack.user?.display_name}</p>
            <div className="mt-3 flex items-center justify-center gap-1">
              <button
                type="button"
                className="rounded-full p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
                aria-label="Нравится"
                disabled={likeMutation.isPending}
                onClick={() => requireAuth(() => likeMutation.mutate())}
              >
                <Heart className={`h-5 w-5 ${isLiked ? 'fill-white text-white' : ''}`} />
              </button>
              <button
                type="button"
                className={`rounded-full p-2 text-white/70 transition hover:bg-white/10 hover:text-white ${isReposted ? 'text-white' : ''}`}
                aria-label="Репост"
                disabled={repostMutation.isPending}
                onClick={() => requireAuth(() => repostMutation.mutate())}
              >
                <Repeat2 className="h-5 w-5" />
              </button>
              <button
                type="button"
                className="rounded-full p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
                aria-label="В плейлист"
                onClick={() => requireAuth(() => setPlaylistOpen(true))}
              >
                <ListMusic className="h-5 w-5" />
              </button>
              <button
                type="button"
                className="rounded-full p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
                aria-label="Отправить"
                onClick={() => requireAuth(() => setShowSend(true))}
              >
                <MessageCircle className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="w-full max-w-2xl px-4">{controls}</div>
        </div>
      </div>
      </>
    );
  }

  return (
    <>
      {playlistModal}
      {sendModal}
      <div className="fixed bottom-0 left-0 right-0 z-50">{bar}</div>
    </>
  );
}
