import { useEffect } from 'react';
import { usePlayerStore } from '../store/playerStore';

/**
 * Хук для глобальных клавиатурных шорткатов плеера.
 * Space: play/pause
 * Left/Right: перемотка на 5 секунд
 * Up/Down: громкость
 * N: следующий трек
 * P: предыдущий трек
 * M: mute
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Игнорируем если фокус на input/textarea/contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const state = usePlayerStore.getState();
      if (!state.currentTrack && !state.currentAd) return;

      switch (e.code) {
        case 'Space': {
          e.preventDefault();
          if (state.currentAd) {
            // Не останавливаем рекламу
            return;
          }
          state.toggle();
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          const newPos = Math.max(0, state.position - 5);
          state.seek(newPos);
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          const newPos = Math.min(state.duration, state.position + 5);
          state.seek(newPos);
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          const newVol = Math.min(1, state.volume + 0.05);
          state.setVolume(newVol);
          break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          const newVol = Math.max(0, state.volume - 0.05);
          state.setVolume(newVol);
          break;
        }
        case 'KeyN': {
          e.preventDefault();
          state.next();
          break;
        }
        case 'KeyP': {
          e.preventDefault();
          state.prev();
          break;
        }
        case 'KeyM': {
          e.preventDefault();
          state.toggleMute();
          break;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}

/**
 * Хук для отправки статистики прослушивания при закрытии вкладки.
 * Использует navigator.sendBeacon для гарантированной доставки.
 */
export function useBeforeUnloadStats() {
  useEffect(() => {
    const handler = () => {
      const state = usePlayerStore.getState();
      const { currentTrack, position, duration } = state;

      if (currentTrack && currentTrack.id && position > 0) {
        const base = import.meta.env.VITE_API_URL || '';
        const payload = JSON.stringify({
          listened_seconds: Math.round(position),
          is_complete: duration > 0 && position / duration > 0.9,
          source: 'web',
        });

        try {
          const blob = new Blob([payload], { type: 'application/json' });
          navigator.sendBeacon(
            `${base}/api/tracks/${currentTrack.id}/play`,
            blob,
          );
        } catch {
          // silent fail — статистика не критична
        }
      }
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);
}
