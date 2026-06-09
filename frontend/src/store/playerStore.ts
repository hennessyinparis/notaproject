import { Howl, Howler } from 'howler';
import { create } from 'zustand';

import { api } from '../api/client';
import type { AudioAd } from '../types/ad';
import type { Track } from '../types';
import {
  adStreamUrl,
  fetchPlayableAds,
  nextAdThreshold,
  pickRandomAd,
  shouldShowAudioAds,
} from '../utils/playerAds';
import { useAuthStore } from './authStore';
import { useEqStore } from './eqStore';

export type RepeatMode = 'off' | 'one' | 'all';

export const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

function normalizeTrack(t: Track): Track {
  return {
    ...t,
    title: t.title?.trim() || 'Без названия',
    duration_seconds: Number.isFinite(t.duration_seconds) ? t.duration_seconds : 0,
    user: t.user
      ? {
          ...t.user,
          username: t.user.username?.trim() || 'artist',
          display_name: t.user.display_name?.trim() || 'Артист',
        }
      : t.user,
  };
}

function streamUrl(trackId: number) {
  const base = import.meta.env.VITE_API_URL || '';
  return `${base}/api/tracks/${trackId}/stream`;
}

function resumeAudioContext(): Promise<void> {
  const ctx = Howler.ctx;
  if (!ctx) return Promise.resolve();
  return ctx.state === 'suspended' ? ctx.resume() : Promise.resolve();
}

interface PlayerState {
  queue: Track[];
  currentIndex: number;
  currentTrack: Track | null;
  currentAd: AudioAd | null;
  tracksSinceAd: number;
  adThreshold: number;
  afterAdCallback: (() => void) | null;
  isPlaying: boolean;
  volume: number;
  muted: boolean;
  rate: number;
  repeat: RepeatMode;
  shuffle: boolean;
  position: number;
  duration: number;
  sleepTimerEnd: number | null;
  fullscreen: boolean;
  howl: Howl | null;
  playTrack: (t: Track, queue?: Track[]) => void;
  playAd: (ad: AudioAd, onComplete: () => void) => void;
  skipAd: (runCallback?: boolean) => void;
  maybePlayAdThen: (continueFn: () => void) => void;
  advanceToNextTrack: () => void;
  toggle: () => void;
  pause: () => void;
  stop: () => void;
  next: () => void;
  prev: () => void;
  seek: (sec: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  setRate: (r: number) => void;
  setRepeat: (m: RepeatMode) => void;
  toggleShuffle: () => void;
  reorderQueue: (from: number, to: number) => void;
  removeFromQueue: (index: number) => void;
  setFullscreen: (v: boolean) => void;
  setSleepTimer: (minutes: number | null) => void;
  tickSleepTimer: () => void;
}

let sleepInterval: ReturnType<typeof setInterval> | null = null;

export const usePlayerStore = create<PlayerState>((set, get) => ({
  queue: [],
  currentIndex: 0,
  currentTrack: null,
  currentAd: null,
  tracksSinceAd: 0,
  adThreshold: nextAdThreshold(),
  afterAdCallback: null,
  isPlaying: false,
  volume: 0.9,
  muted: false,
  rate: 1,
  repeat: 'off',
  shuffle: false,
  position: 0,
  duration: 0,
  sleepTimerEnd: null,
      fullscreen: false,
      howl: null,

  playAd: (ad, onComplete) => {
    const state = get();
    const prev = state.howl;
    set({ howl: null, currentAd: ad, afterAdCallback: onComplete });
    prev?.unload();
    const howl = new Howl({
      src: [adStreamUrl(ad.id)],
      html5: true,
      format: ['mp3', 'mpeg', 'wav', 'ogg'],
      volume: state.muted ? 0 : state.volume,
      rate: 1,
      onload: function () {
        if (get().howl !== howl) return;
        const d = howl.duration() || ad.duration_seconds || 0;
        set({ duration: d });
      },
      onend: () => {
        if (get().howl !== howl) return;
        const cb = get().afterAdCallback;
        set({ currentAd: null, afterAdCallback: null, howl: null });
        howl.unload();
        cb?.();
      },
    });
    howl.on('play', () => {
      if (get().howl !== howl) return;
      set({ isPlaying: true });
    });
    howl.on('pause', () => {
      if (get().howl !== howl) return;
      set({ isPlaying: false });
    });
    set({ howl, position: 0, duration: ad.duration_seconds ?? 0 });
    void resumeAudioContext().then(() => {
      if (get().howl !== howl) return;
      howl.play();
    });
  },

  skipAd: (runCallback = true) => {
    const { currentAd, afterAdCallback, howl } = get();
    if (!currentAd) return;
    howl?.stop();
    howl?.unload();
    const cb = afterAdCallback;
    set({ currentAd: null, afterAdCallback: null, howl: null, isPlaying: false, position: 0 });
    if (runCallback) cb?.();
  },

  maybePlayAdThen: (continueFn) => {
    void (async () => {
      if (!shouldShowAudioAds()) {
        continueFn();
        return;
      }
      const { tracksSinceAd, adThreshold } = get();
      const nextCount = tracksSinceAd + 1;
      if (nextCount < adThreshold) {
        set({ tracksSinceAd: nextCount });
        continueFn();
        return;
      }
      set({ tracksSinceAd: 0, adThreshold: nextAdThreshold() });
      const ads = await fetchPlayableAds();
      const ad = pickRandomAd(ads);
      if (!ad) {
        continueFn();
        return;
      }
      get().playAd(ad, continueFn);
    })();
  },

  playTrack: (t, q) => {
    t = normalizeTrack(t);
    const state = get();
    const prev = state.howl;
    set({
      howl: null,
      currentAd: null,
      afterAdCallback: null,
      fullscreen: false,
    });
    prev?.unload();
    const queue = q?.length ? q : [t];
    const idx = queue.findIndex((x) => x.id === t.id);
    const token = useAuthStore.getState().accessToken;
    const howl = new Howl({
      src: [streamUrl(t.id)],
      html5: false,
      format: ['mp3', 'mpeg', 'wav', 'ogg'],
      volume: state.muted ? 0 : state.volume,
      rate: state.rate,
      xhr: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
      onload: function () {
        if (get().howl !== howl) return;
        set({ duration: howl.duration() || 0 });
      },
      onend: () => {
        if (get().howl !== howl) return;
        const s = get();
        if (s.repeat === 'one') {
          howl.seek(0);
          void resumeAudioContext().then(() => {
            if (get().howl !== howl) return;
            howl.play();
          });
          return;
        }
        get().maybePlayAdThen(() => get().advanceToNextTrack());
      },
    });
    try {
      for (const s of (howl as any)._sounds || []) {
        if (s._node) s._node.preservesPitch = false;
      }
    } catch {}
    howl.on('play', () => {
      if (get().howl !== howl) return;
      set({ isPlaying: true });
      if (useEqStore.getState().enabled) {
        useEqStore.getState().setupForHowl(howl);
      }
    });
    howl.on('pause', () => {
      if (get().howl !== howl) return;
      set({ isPlaying: false });
    });
    howl.on('stop', () => {
      if (get().howl !== howl) return;
      set({ isPlaying: false });
    });
    set({
      currentTrack: t,
      queue,
      currentIndex: idx >= 0 ? idx : 0,
      howl,
      position: 0,
    });
    void resumeAudioContext().then(() => {
      if (get().howl !== howl) return;
      howl.play();
    });
    void api
      .post(`/api/tracks/${t.id}/play`, {
        listened_seconds: 0,
        is_complete: false,
        source: 'feed',
      })
      .catch(() => {
        /* статистика не должна ломать воспроизведение */
      });
  },

  toggle: () => {
    const h = get().howl;
    if (!h) return;
    if (h.playing()) {
      h.pause();
      return;
    }
    void resumeAudioContext().then(() => {
      if (get().howl !== h) return;
      h.play();
    });
  },

  pause: () => get().howl?.pause(),

  stop: () => {
    const h = get().howl;
    h?.stop();
    h?.unload();
    set({
      currentTrack: null,
      currentAd: null,
      afterAdCallback: null,
      howl: null,
      isPlaying: false,
      position: 0,
      duration: 0,
      queue: [],
      currentIndex: 0,
    });
  },

  advanceToNextTrack: () => {
    const { queue, currentIndex, repeat, shuffle, currentTrack } = get();
    if (!queue.length) return;
    const refTrack = currentTrack ?? queue[currentIndex];
    if (!refTrack) return;
    let ni = currentIndex + 1;
    if (shuffle) {
      if (queue.length <= 1) return;
      do {
        ni = Math.floor(Math.random() * queue.length);
      } while (queue[ni].id === refTrack.id);
    } else if (ni >= queue.length) {
      if (repeat === 'all') ni = 0;
      else {
        const h = get().howl;
        h?.stop();
        h?.unload();
        set({ isPlaying: false, howl: null, currentTrack: null, position: 0, duration: 0 });
        return;
      }
    }
    const t = queue[ni];
    if (t) get().playTrack(t, queue);
  },

  next: () => {
    if (get().currentAd) {
      get().skipAd();
      return;
    }
    const { queue, currentTrack } = get();
    if (!queue.length || !currentTrack) return;
    get().maybePlayAdThen(() => get().advanceToNextTrack());
  },

  prev: () => {
    if (get().currentAd) {
      get().skipAd(false);
    }
    const { queue, currentIndex, position } = get();
    if (!queue.length) return;
    if (position > 3) {
      get().howl?.seek(0);
      return;
    }
    let ni = currentIndex - 1;
    if (ni < 0) ni = queue.length - 1;
    const t = queue[ni];
    if (t) get().playTrack(t, queue);
  },

  seek: (sec) => {
    const h = get().howl;
    if (h) h.seek(sec);
    set({ position: sec });
  },

  setVolume: (v) => {
    const vol = Math.min(1, Math.max(0, v));
    get().howl?.volume(get().muted ? 0 : vol);
    set({ volume: vol });
  },

  toggleMute: () => {
    const muted = !get().muted;
    get().howl?.volume(muted ? 0 : get().volume);
    set({ muted });
  },

  setRate: (r) => {
    const state = get();
    const howl = state.howl;
    if (howl) {
      howl.rate(r);
      // Отключаем preservePitch чтобы скорость меняла тональность (как nightcore/slowed)
      try {
        for (const s of (howl as any)._sounds || []) {
          if (s._node) s._node.preservesPitch = false;
        }
      } catch {}
    }
    set({ rate: r });
  },

  setRepeat: (m) => set({ repeat: m }),
  toggleShuffle: () => set({ shuffle: !get().shuffle }),

  reorderQueue: (from, to) => {
    const q = [...get().queue];
    const [item] = q.splice(from, 1);
    q.splice(to, 0, item);
    let ci = get().currentIndex;
    if (from === ci) ci = to;
    else if (from < ci && to >= ci) ci--;
    else if (from > ci && to <= ci) ci++;
    set({ queue: q, currentIndex: ci });
  },

  removeFromQueue: (index) => {
    const q = get().queue.filter((_, i) => i !== index);
    let ci = get().currentIndex;
    if (index < ci) ci--;
    if (index === ci && q.length) get().playTrack(q[Math.min(ci, q.length - 1)], q);
    else if (!q.length) {
      get().howl?.unload();
      set({
        queue: [],
        currentTrack: null,
        howl: null,
        isPlaying: false,
        currentIndex: 0,
      });
    } else set({ queue: q, currentIndex: ci });
  },

  setFullscreen: (v) => set({ fullscreen: v }),

  setSleepTimer: (minutes) => {
    if (sleepInterval) {
      clearInterval(sleepInterval);
      sleepInterval = null;
    }
    if (minutes == null) {
      set({ sleepTimerEnd: null });
      return;
    }
    const end = Date.now() + minutes * 60 * 1000;
    set({ sleepTimerEnd: end });
  },

  tickSleepTimer: () => {
    const end = get().sleepTimerEnd;
    if (!end) return;
    if (Date.now() >= end) {
      get().howl?.stop();
      get().pause();
      set({ sleepTimerEnd: null });
      if (sleepInterval) clearInterval(sleepInterval);
      sleepInterval = null;
    }
  },
}));
