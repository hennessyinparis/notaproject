import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  direction?: 'up' | 'down';
}

export function CustomSelect({ value, onChange, options, placeholder, className = '', direction = 'down' }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as HTMLElement)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-1 rounded-xl border-2 border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm font-bold text-[var(--text-primary)] shadow-lg shadow-black/5 transition-all hover:border-[var(--primary)]/40 hover:shadow-[var(--primary)]/10"
      >
        <span className="truncate">{selected?.label || placeholder || ''}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <div
          className={`absolute z-50 min-w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-xl shadow-black/15 ${
            direction === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          }`}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`flex w-full items-center justify-between px-3.5 py-2 text-sm whitespace-nowrap transition-colors ${
                value === opt.value
                  ? 'bg-[var(--primary)]/12 text-[var(--primary)] font-bold'
                  : 'text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
              }`}
            >
              {opt.label}
              {value === opt.value && (
                <svg className="ml-2 h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
