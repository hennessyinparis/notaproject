import { X } from 'lucide-react';

import { usePlayerStore } from '../../store/playerStore';
import { AdPlayerBar } from './AdPlayerBar';
import { PlayerPositionTicker } from './PlayerPositionTicker';

/** Упрощённый плеер — только во время аудиорекламы. */
export function AdPlayerShell() {
  const fullscreen = usePlayerStore((s) => s.fullscreen);
  const setFullscreen = usePlayerStore((s) => s.setFullscreen);

  if (fullscreen) {
    return (
      <>
        <PlayerPositionTicker />
        <div className="fixed inset-0 z-[100] flex flex-col bg-black/90">
          <button
            type="button"
            className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-3 text-white"
            onClick={() => setFullscreen(false)}
            aria-label="Закрыть"
          >
            <X className="h-6 w-6" />
          </button>
          <AdPlayerBar fullscreen />
        </div>
      </>
    );
  }

  return (
    <>
      <PlayerPositionTicker />
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <AdPlayerBar onToggleFullscreen={() => setFullscreen(true)} />
      </div>
    </>
  );
}
