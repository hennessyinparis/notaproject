import { useEffect } from 'react';

import { usePlayerStore } from '../../store/playerStore';

/** Обновляет position в store без лишних перерисовок GlobalPlayer. */
export function PlayerPositionTicker() {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const trackId = usePlayerStore((s) => s.currentTrack?.id);
  const adId = usePlayerStore((s) => s.currentAd?.id);

  useEffect(() => {
    if (!isPlaying) return;
    const id = window.setInterval(() => {
      const h = usePlayerStore.getState().howl;
      if (h?.playing()) {
        usePlayerStore.setState({ position: h.seek() as number });
      }
    }, 200);
    return () => clearInterval(id);
  }, [isPlaying, trackId, adId]);

  return null;
}
