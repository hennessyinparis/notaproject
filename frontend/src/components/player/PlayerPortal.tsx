import { ErrorBoundary } from '../common/ErrorBoundary';
import { usePlayerStore } from '../../store/playerStore';
import { AdPlayerShell } from './AdPlayerShell';
import { GlobalPlayer } from './GlobalPlayer';

export function PlayerPortal() {
  const currentAd = usePlayerStore((s) => s.currentAd);
  const currentTrack = usePlayerStore((s) => s.currentTrack);

  if (currentAd) {
    return (
      <ErrorBoundary fallbackTitle="Ошибка рекламы">
        <AdPlayerShell />
      </ErrorBoundary>
    );
  }

  if (!currentTrack) return null;

  return (
    <ErrorBoundary fallbackTitle="Ошибка плеера">
      <GlobalPlayer />
    </ErrorBoundary>
  );
}
