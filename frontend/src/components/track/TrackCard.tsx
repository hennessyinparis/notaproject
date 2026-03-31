import { motion } from 'framer-motion';
import { MoreHorizontal, Pause, Play } from 'lucide-react';
import { Link } from 'react-router-dom';

import { usePlayerStore } from '../../store/playerStore';
import type { Track } from '../../types';

interface Props {
  track: Track;
  queue?: Track[];
}

function stringToGradient(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `linear-gradient(135deg, hsl(${hue}, 70%, 55%), hsl(${(hue + 42) % 360}, 72%, 38%))`;
}

export function TrackCard({ track, queue }: Props) {
  const playTrack = usePlayerStore((s) => s.playTrack);
  const toggle = usePlayerStore((s) => s.toggle);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isCurrentTrack = currentTrack?.id === track.id;
  const base = import.meta.env.VITE_API_URL || '';
  const cover = track.cover_url ? `${base}${track.cover_url}` : null;

  return (
    <motion.article
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      style={{ cursor: 'pointer' }}
    >
      <div
        style={{
          position: 'relative',
          aspectRatio: '1',
          borderRadius: 'var(--radius-cover)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-card)',
          marginBottom: 10,
          background: cover ? undefined : stringToGradient(track.title),
        }}
        onClick={() => (isCurrentTrack ? toggle() : playTrack(track, queue))}
      >
        {cover ? (
          <img
            src={cover}
            alt={track.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%' }} />
        )}

        <div
          className="track-card-overlay"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isCurrentTrack && isPlaying ? 1 : 0,
            transition: 'opacity 0.2s',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            }}
          >
            {isCurrentTrack && isPlaying ? (
              <Pause style={{ width: 18, height: 18, color: '#1d1d1f' }} />
            ) : (
              <Play style={{ width: 18, height: 18, color: '#1d1d1f', marginLeft: 2 }} />
            )}
          </div>
        </div>

        {isCurrentTrack && isPlaying && (
          <div style={{ position: 'absolute', bottom: 8, left: 8, display: 'flex', gap: 2, alignItems: 'flex-end' }}>
            <span style={{ width: 3, height: 8, background: 'white', borderRadius: 2 }} />
            <span style={{ width: 3, height: 12, background: 'white', borderRadius: 2 }} />
            <span style={{ width: 3, height: 6, background: 'white', borderRadius: 2 }} />
          </div>
        )}

        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="track-card-menu-btn"
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: 'rgba(0,0,0,0.5)',
            border: 'none',
            borderRadius: '50%',
            width: 28,
            height: 28,
            cursor: 'pointer',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0,
            transition: 'opacity 0.2s',
          }}
          aria-label="Меню"
        >
          <MoreHorizontal size={14} />
        </button>
      </div>

      <div style={{ padding: '0 2px' }}>
        <Link
          to={`/track/${track.id}`}
          style={{
            display: 'block',
            fontWeight: 600,
            fontSize: 14,
            color: isCurrentTrack ? 'var(--primary)' : 'var(--text-primary)',
            textDecoration: 'none',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginBottom: 2,
          }}
        >
          {track.title}
        </Link>
        {track.user && (
          <Link
            to={`/artist/${track.user.username}`}
            style={{
              display: 'block',
              fontSize: 13,
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {track.user.display_name}
          </Link>
        )}
      </div>
    </motion.article>
  );
}
