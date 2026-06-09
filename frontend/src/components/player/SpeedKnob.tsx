import { useEffect, useRef, useState } from 'react';
import { RATES } from '../../store/playerStore';

interface Props {
  rate: number;
  setRate: (r: number) => void;
}

/** Compact rotary-style speed knob for the player bar. */
export function SpeedKnob({ rate, setRate }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Map rate to arc angle: 0.5→−135°, 1→0°, 2→+135°
  const angle = ((rate - 0.5) / 1.5) * 270 - 135;
  // SVG arc: circumference of r=11 circle ≈ 69.1; 270° = 75% of circle
  const r = 11;
  const circ = 2 * Math.PI * r;
  const arcLen = (270 / 360) * circ; // total arc span
  const progress = ((rate - 0.5) / 1.5) * arcLen;

  const isDefault = rate === 1;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Скорость воспроизведения: ${rate}×`}
        title="Скорость воспроизведения"
        className={`group relative flex h-8 w-8 items-center justify-center rounded-full transition focus:outline-none ${
          isDefault
            ? 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            : 'text-[var(--primary)]'
        } ${open ? 'scale-95' : ''}`}
      >
        {/* SVG knob ring */}
        <svg
          viewBox="0 0 28 28"
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          aria-hidden
        >
          {/* Background track arc */}
          <circle
            cx="14" cy="14" r={r}
            fill="none"
            stroke="var(--border)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={`${arcLen} ${circ}`}
            strokeDashoffset={0}
            transform="rotate(135 14 14)"
          />
          {/* Filled progress arc */}
          {!isDefault && (
            <circle
              cx="14" cy="14" r={r}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={`${progress} ${circ}`}
              strokeDashoffset={0}
              transform="rotate(135 14 14)"
              className="transition-all duration-150"
            />
          )}
          {/* Indicator dot */}
          <circle
            cx={14 + r * Math.cos(((angle - 90) * Math.PI) / 180)}
            cy={14 + r * Math.sin(((angle - 90) * Math.PI) / 180)}
            r="2"
            fill={isDefault ? 'var(--text-muted)' : 'var(--primary)'}
            className="transition-all duration-150"
          />
        </svg>
        {/* Center label */}
        <span
          className={`relative z-10 select-none text-[9px] font-bold leading-none tabular-nums transition-colors ${
            isDefault ? 'text-[var(--text-muted)] group-hover:text-[var(--text-primary)]' : 'text-[var(--primary)]'
          }`}
        >
          {rate}×
        </span>
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute bottom-full right-0 z-[200] mb-2 w-[120px] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-xl shadow-black/20">
          <p className="border-b border-[var(--border)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
            Скорость
          </p>
          <div className="grid grid-cols-3 gap-px bg-[var(--border)] p-px">
            {RATES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => { setRate(r); setOpen(false); }}
                className={`flex items-center justify-center py-2 text-xs font-semibold transition ${
                  rate === r
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
                }`}
              >
                {r}×
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
