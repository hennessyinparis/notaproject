import { Download, Wifi, WifiOff } from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuthStore } from '../../store/authStore';
import type { Track } from '../../types';
import { addOfflineTrack, isTrackOffline, removeOfflineTrack } from '../../utils/offlineTracks';
import { canDownloadTrack, downloadTrackFile } from '../../utils/trackDownload';
import { isPremiumListener } from '../../utils/subscription';
import { goToLogin } from '../../utils/authNavigation';
import { useNavigate } from 'react-router-dom';

type Props = { track: Track; className?: string };

export function TrackPremiumActions({ track, className = '' }: Props) {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const offline = isTrackOffline(track.id);
  const canDownload = canDownloadTrack(user, track);
  const canOffline = isPremiumListener(user) && track.is_public;

  if (!canDownload && !canOffline) return null;

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {canDownload && (
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
          onClick={() => {
            if (!user) {
              goToLogin(navigate);
              return;
            }
            void downloadTrackFile(track.id, track.title).catch(() => toast.error('Не удалось скачать'));
          }}
        >
          <Download className="h-4 w-4" />
          Скачать
        </button>
      )}
      {canOffline && (
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
          onClick={() => {
            if (!user) {
              goToLogin(navigate);
              return;
            }
            if (offline) {
              removeOfflineTrack(track.id);
              toast.success('Убрано из офлайн');
            } else {
              addOfflineTrack(track.id);
              toast.success('Сохранено для офлайн');
            }
          }}
        >
          {offline ? <WifiOff className="h-4 w-4" /> : <Wifi className="h-4 w-4" />}
          {offline ? 'Убрать офлайн' : 'В офлайн'}
        </button>
      )}
    </div>
  );
}
