import { Heart, MoreHorizontal, Pause, Play } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuthStore } from '../../store/authStore';
import { goToLogin } from '../../utils/authNavigation';
import { usePlayerStore } from '../../store/playerStore';
import type { Track } from '../../types';
import { formatDuration } from '../../utils/format';

interface TrackRowProps {
  track: Track;
  index: number;
  queue: Track[];
  showAlbum?: boolean;
}

function stringToGradient(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `linear-gradient(135deg, hsl(${hue}, 70%, 55%), hsl(${(hue + 42) % 360}, 72%, 38%))`;
}

export function TrackRow({ track, index, queue }: TrackRowProps) {
  const [isLiked, setIsLiked] = useState(false);
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const toggle = usePlayerStore((s) => s.toggle);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isCurrentTrack = currentTrack?.id === track.id;

  const base = import.meta.env.VITE_API_URL || '';
  const cover = track.cover_url ? `${base}${track.cover_url}` : null;

  const handlePlay = () => {
    if (isCurrentTrack) toggle();
    else playTrack(track, queue);
  };

  return (
    <div
      className="track-row group"
      style={{
        display: 'grid',
        gridTemplateColumns: '32px 40px 1fr auto 60px 28px',
        alignItems: 'center',
        gap: 12,
        padding: '6px 8px',
        borderRadius: 6,
        cursor: 'pointer',
        transition: 'background 0.15s',
      }}
      onClick={handlePlay}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--bg-elevated)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      <div style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-muted)' }}>
        <span className="track-row-num group-hover:hidden">{index + 1}</span>
        <button
          type="button"
          className="hidden track-row-play group-hover:flex"
          onClick={(e) => {
            e.stopPropagation();
            handlePlay();
          }}
        >
          {isCurrentTrack && isPlaying ? <Pause size={14} /> : <Play size={14} />}
        </button>
      </div>
      <div style={{ width: 40, height: 40, borderRadius: 4, overflow: 'hidden', flexShrink: 0 }}>
        {cover ? (
          <img src={cover} alt={track.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: stringToGradient(track.title) }} />
        )}
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontWeight: 500,
            fontSize: 14,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: isCurrentTrack ? 'var(--primary)' : 'var(--text-primary)',
          }}
        >
          {track.title}
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {track.user?.display_name ?? 'Неизвестный артист'}
        </div>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!accessToken) {
            goToLogin(navigate);
            return;
          }
          setIsLiked((v) => !v);
        }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
      >
        <Heart
          size={14}
          style={{
            color: isLiked ? 'var(--primary)' : 'var(--text-muted)',
            fill: isLiked ? 'var(--primary)' : 'none',
          }}
        />
      </button>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'right' }}>
        {formatDuration(track.duration_seconds)}
      </div>
      <button
        type="button"
        className="opacity-0 group-hover:opacity-100"
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
        onClick={(e) => e.stopPropagation()}
      >
        <MoreHorizontal size={14} style={{ color: 'var(--text-muted)' }} />
      </button>
    </div>
  );
}
