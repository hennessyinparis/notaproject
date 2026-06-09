import { usePlayerStore } from '../../store/playerStore';
import { formatDuration } from '../../utils/format';

type Props = {
  duration: number;
  position?: number;
  onSeek: (sec: number) => void;
  compact?: boolean;
};

export function PlayerProgressBar({ duration, position: positionProp, onSeek, compact }: Props) {
  const storePosition = usePlayerStore((s) => s.position);
  const position = positionProp ?? storePosition;
  const dur = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const pos = Number.isFinite(position) && position >= 0 ? position : 0;
  const pct = dur > 0 ? Math.min(100, (pos / dur) * 100) : 0;

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dur <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    onSeek(ratio * dur);
  };

  return (
    <div className="flex flex-col gap-1">
      <div
        role="slider"
        aria-valuenow={pos}
        aria-valuemax={dur}
        tabIndex={0}
        onClick={seek}
        onKeyDown={(e) => {
          if (dur <= 0) return;
          if (e.key === 'ArrowRight') onSeek(Math.min(dur, pos + 5));
          if (e.key === 'ArrowLeft') onSeek(Math.max(0, pos - 5));
        }}
        className="group relative h-2 cursor-pointer overflow-hidden rounded-full bg-[var(--bg-elevated)]"
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-[var(--primary)] transition-[width] duration-75"
          style={{ width: `${pct}%` }}
        />
      </div>
      {!compact && (
        <div className="flex justify-between text-[10px] text-[var(--text-muted)]">
          <span>{formatDuration(pos)}</span>
          <span>{formatDuration(dur)}</span>
        </div>
      )}
    </div>
  );
}
